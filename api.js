// طبقة البيانات: Supabase إذا موجود، وإلا وضع تجربة على نفس الجهاز.
(function () {
  const C = window.JOCKEY_CONFIG;
  const live = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase);
  const STATUS = { new: 'وصل الطلب', accepted: 'انقبل', ready: 'جاهز للاستلام', done: 'تم التسليم', cancelled: 'ملغي' };
  const DEFAULTS = { points_enabled: true, earn_per_100: 10 };
  const earnFor = (amount, s) => (s.points_enabled ? Math.floor((amount * s.earn_per_100) / 100 + 1e-9) : 0);
  // نفس حساب السيرفر: السعر من المنيو، مو من السلة
  const priceItems = (items, menu) => {
    const out = []; let sub = 0;
    if (!Array.isArray(items) || !items.length) throw new Error('empty order');
    for (const it of items) {
      const m = menu.items.find((x) => x.id === it.id); if (!m) throw new Error('unknown item');
      const q = Math.max(1, Math.min(20, it.q | 0));
      const keys = m.noOpt ? [] : Object.keys(menu.options).sort();
      let u = m.p; const labels = [];
      for (const k of keys) {
        const ch = menu.options[k].choices; let i = (it.o && it.o[k]) | 0; if (i < 0 || i >= ch.length) i = 0;
        u += ch[i][1]; labels.push(ch[i][0]);
      }
      out.push({ id: m.id, n: m.n, opt: labels.join('، '), q, u }); sub += u * q;
    }
    return { items: out, subtotal: Math.round(sub * 100) / 100 };
  };

  // ---------- وضع التجربة (localStorage) ----------
  const KEY = 'jockey_orders_v1', CK = 'jockey_customers_v1', SK = 'jockey_session_v1', STK = 'jockey_settings_v1';
  const jget = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const read = () => jget(KEY, []);
  const write = (a) => jset(KEY, a);
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const now = () => new Date().toISOString();
  let pending = null; // الكود اللي "أرسلناه" في وضع التجربة

  const demo = {
    async placeOrder(o) {
      const a = read(); const no = (a.reduce((m, x) => Math.max(m, x.no), 100)) + 1;
      const s = await demo.getSettings(); const cs = jget(CK, {}); const ph = jget(SK, null); const c = ph && cs[ph];
      if (!c || !c.name) throw new Error('login required');
      const { items, subtotal: sub } = priceItems(o.items, window.JOCKEY_MENU);
      const use = s.points_enabled ? Math.max(0, Math.min(o.use_points | 0, c.points, Math.floor(sub))) : 0;
      const pay = o.payment === 'test' && sub - use > 0 ? 'test' : 'cash';
      const row = {
        id: uid(), no, token: uid(), status: 'new', created_at: now(),
        order_type: o.order_type, customer_name: String(o.customer_name || '').trim().slice(0, 60), car: o.car || '', table_no: o.table_no || '', notes: o.notes || '',
        items, subtotal: sub, total: sub - use, points_used: use, points_earned: 0,
        payment: pay, pay_method: pay === 'test' && ['applepay', 'card'].includes(o.pay_method) ? o.pay_method : null,
        customer_phone: c.phone, phone: c.phone
      };
      if (use) { c.points -= use; c.ledger.unshift({ order_no: no, delta: -use, reason: 'redeem', created_at: now() }); jset(CK, cs); }
      a.push(row); write(a);
      return { no, token: row.token, points_used: use, subtotal: sub, total: row.total, payment: pay, items };
    },
    async getOrder(token) { return read().find((x) => x.token === token) || null; },
    async signIn() { return { ok: true }; },
    async signOut() {},
    async session() { return true; },
    async listOrders() { return read().filter((x) => Date.now() - new Date(x.created_at) < 864e5).reverse(); },
    async setStatus(id, status) {
      const a = read(); const r = a.find((x) => x.id === id); if (!r || r.status === status) return;
      const cs = jget(CK, {}); const c = r.customer_phone && cs[r.customer_phone];
      if (c) {
        if (status === 'done' && !r.points_earned) {
          const earn = earnFor(r.total, await demo.getSettings());
          if (earn > 0) { r.points_earned = earn; c.points += earn; c.ledger.unshift({ order_no: r.no, delta: earn, reason: 'earn', created_at: now() }); }
        } else if (status === 'cancelled' && r.points_used > 0) {
          c.points += r.points_used; c.ledger.unshift({ order_no: r.no, delta: r.points_used, reason: 'refund', created_at: now() });
        }
        jset(CK, cs);
      }
      r.status = status; write(a);
    },
    subscribe(cb) { window.addEventListener('storage', (e) => { if (e.key === KEY) cb(); }); const t = setInterval(cb, 4000); return () => clearInterval(t); },

    // الحساب والنقاط
    async getSettings() { return Object.assign({}, DEFAULTS, jget(STK, {})); },
    async saveSettings(s) { jset(STK, { points_enabled: !!s.points_enabled, earn_per_100: +s.earn_per_100 }); },
    async sendCode(phone) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      pending = { phone, code };
      return { ok: true, demoCode: code };
    },
    async verifyCode(phone, code) {
      if (!pending || pending.phone !== phone || pending.code !== code) return { ok: false, msg: 'الكود غلط، تأكد منه وجرّب مرة ثانية' };
      pending = null;
      const cs = jget(CK, {}); if (!cs[phone]) cs[phone] = { phone, name: '', points: 0, ledger: [], created_at: now() };
      jset(CK, cs); jset(SK, phone); return { ok: true };
    },
    async me() {
      const ph = jget(SK, null); const c = ph && jget(CK, {})[ph];
      return c ? { name: c.name, phone: c.phone, points: c.points, ledger: c.ledger.slice(0, 30) } : null;
    },
    async saveName(name) { const ph = jget(SK, null); const cs = jget(CK, {}); if (ph && cs[ph]) { cs[ph].name = name; jset(CK, cs); } },
    async logout() { try { localStorage.removeItem(SK); } catch (e) {} },
    async deleteMe() {
      const ph = jget(SK, null); if (!ph) return;
      const cs = jget(CK, {}); delete cs[ph]; jset(CK, cs);
      write(read().map((x) => (x.customer_phone === ph ? Object.assign(x, { customer_name: 'عميل محذوف', phone: null, car: null, notes: null, customer_phone: null }) : x)));
      try { localStorage.removeItem(SK); } catch (e) {}
    },
    async syncMenu() {}
  };

  // ---------- Supabase ----------
  let sb = null;
  if (live) sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  const e164 = (p) => '+966' + String(p).replace(/^0/, '');
  const isStaff = async () => { const { data } = await sb.rpc('is_staff'); return !!data; };
  const real = {
    async placeOrder(o) {
      const { data, error } = await sb.rpc('place_order', { p: o });
      if (error) throw error; return data;
    },
    async getOrder(token) {
      const { data, error } = await sb.rpc('get_order', { p_token: token });
      if (error) throw error; return data;
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, msg: 'الإيميل أو كلمة المرور غلط' };
      if (!(await isStaff())) { await sb.auth.signOut(); return { ok: false, msg: 'هذا الحساب مو مسجّل ككاشير' }; }
      return { ok: true };
    },
    async signOut() { await sb.auth.signOut(); },
    async session() { const { data } = await sb.auth.getSession(); return !!data.session && (await isStaff()); },
    async listOrders() {
      const since = new Date(Date.now() - 864e5).toISOString();
      const { data, error } = await sb.from('orders').select('*').gte('created_at', since).order('created_at', { ascending: false });
      if (error) throw error; return data;
    },
    async setStatus(id, status) {
      const { error } = await sb.from('orders').update({ status }).eq('id', id);
      if (error) throw error;
    },
    subscribe(cb) {
      const ch = sb.channel('orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, cb).subscribe();
      const t = setInterval(cb, 15000);
      return () => { clearInterval(t); sb.removeChannel(ch); };
    },

    // الحساب والنقاط
    async getSettings() {
      const { data } = await sb.from('settings').select('points_enabled,earn_per_100').eq('id', 1).maybeSingle();
      return Object.assign({}, DEFAULTS, data || {}, data ? { earn_per_100: +data.earn_per_100 } : {});
    },
    async saveSettings(s) {
      const { error } = await sb.from('settings').update({ points_enabled: !!s.points_enabled, earn_per_100: +s.earn_per_100 }).eq('id', 1);
      if (error) throw error;
    },
    async sendCode(phone) {
      const { error } = await sb.auth.signInWithOtp({ phone: e164(phone) });
      return error ? { ok: false, msg: 'ما قدرنا نرسل الكود، جرّب بعد شوي' } : { ok: true };
    },
    async verifyCode(phone, code) {
      const { error } = await sb.auth.verifyOtp({ phone: e164(phone), token: code, type: 'sms' });
      return error ? { ok: false, msg: 'الكود غلط أو انتهى، جرّب مرة ثانية' } : { ok: true };
    },
    async me() {
      const { data: s } = await sb.auth.getSession(); const u = s.session && s.session.user;
      if (!u || !u.phone) return null;
      const { data, error } = await sb.rpc('get_me'); if (error) return null;
      return data || { name: '', phone: u.phone, points: 0, ledger: [] };
    },
    async saveName(name) { const { error } = await sb.rpc('save_me', { p_name: name }); if (error) throw error; },
    async logout() { await sb.auth.signOut(); },
    async deleteMe() { const { error } = await sb.rpc('delete_me'); if (error) throw error; await sb.auth.signOut(); },
    async syncMenu(menu) { const { error } = await sb.rpc('sync_menu', { p: { options: menu.options, items: menu.items } }); if (error) throw error; }
  };

  window.JOCKEY_API = Object.assign({ live, STATUS, earnFor, priceItems }, live ? real : demo);
})();
