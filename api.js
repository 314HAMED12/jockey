// طبقة البيانات: Supabase إذا موجود، وإلا وضع تجربة على نفس الجهاز.
(function () {
  const C = window.JOCKEY_CONFIG;
  const live = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase);
  const STATUS = { new: 'وصل الطلب', accepted: 'انقبل', ready: 'جاهز للاستلام', done: 'تم التسليم', cancelled: 'ملغي' };

  // ---------- وضع التجربة (localStorage) ----------
  const KEY = 'jockey_orders_v1';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const write = (a) => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} };
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const demo = {
    async placeOrder(o) {
      const a = read(); const no = (a.reduce((m, x) => Math.max(m, x.no), 100)) + 1;
      const row = Object.assign({ id: uid(), no, token: uid(), status: 'new', created_at: new Date().toISOString() }, o);
      a.push(row); write(a); return { no, token: row.token };
    },
    async getOrder(token) { return read().find((x) => x.token === token) || null; },
    async signIn() { return { ok: true }; },
    async signOut() {},
    async session() { return true; },
    async listOrders() { return read().filter((x) => Date.now() - new Date(x.created_at) < 864e5).reverse(); },
    async setStatus(id, status) { const a = read(); const r = a.find((x) => x.id === id); if (r) { r.status = status; write(a); } },
    subscribe(cb) { window.addEventListener('storage', (e) => { if (e.key === KEY) cb(); }); const t = setInterval(cb, 4000); return () => clearInterval(t); }
  };

  // ---------- Supabase ----------
  let sb = null;
  if (live) sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
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
      return error ? { ok: false, msg: 'الإيميل أو كلمة المرور غلط' } : { ok: true };
    },
    async signOut() { await sb.auth.signOut(); },
    async session() { const { data } = await sb.auth.getSession(); return !!data.session; },
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
    }
  };

  window.JOCKEY_API = Object.assign({ live, STATUS }, live ? real : demo);
})();
