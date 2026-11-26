// شاشة الكاشير ما تنفتح داخل موقع ثاني (حماية من الخداع)
if (window.top !== window.self) { document.documentElement.hidden = true; try { window.top.location = window.location.href; } catch (e) {} }
{
const API=window.JOCKEY_API,$=s=>document.querySelector(s);
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';'),sar=n=>(Math.round(n*100)/100)+' ر.س';
const STAR='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>';
const TYPES={pickup:'استلام',car:'سيارة',dinein:'داخل الكافيه'};
const NEXT={new:['accepted','قبول الطلب'],accepted:['ready','جاهز ✓'],ready:['done','تم التسليم']};
let seen=null,audio=null,soundOn=false;
$('#mode').textContent=API.live?'':'وضع تجربة: افتح صفحة العميل في نفس المتصفح وأرسل طلب، ويطلع هنا.'+(window.JOCKEY_CONFIG.POINTS===false?'':' والنقاط تنضاف للعميل لما تضغط "تم التسليم".');

function beep(){if(!soundOn||!audio)return;const t=audio.currentTime;[0,.25,.5].forEach((d,i)=>{const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=i==2?1046:880;g.gain.setValueAtTime(.0001,t+d);g.gain.exponentialRampToValueAtTime(.3,t+d+.02);g.gain.exponentialRampToValueAtTime(.0001,t+d+.2);o.connect(g).connect(audio.destination);o.start(t+d);o.stop(t+d+.22)})}
$('#snd').onclick=()=>{try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();audio.resume();soundOn=!soundOn;$('#snd').classList.toggle('on',soundOn);$('#snd').textContent=soundOn?'🔔 التنبيه شغّال':'🔔 فعّل التنبيه';if(soundOn)beep()}catch(e){}};

const showPhone=p=>{const d=String(p||'').replace(/\D/g,'');return d.startsWith('966')?'0'+d.slice(3):p};
const ago=d=>{const m=Math.round((Date.now()-new Date(d))/6e4);return m<1?'الحين':m<60?`قبل ${m} د`:`قبل ${Math.floor(m/60)} س`};
const paidOn=o=>o.payment=='test'||o.payment=='paid';
function card(o){
 const n=NEXT[o.status];
 return `<div class="ord ${o.status=='new'?'new':''}"><div class="oh"><span class="no">#${o.no}</span><span class="badge ${o.order_type}">${TYPES[o.order_type]||''}</span></div>
 <div class="who">${esc(o.customer_name)}${o.customer_id||o.customer_phone?`<span class="mem">${STAR}عضو</span>`:''} <small>${ago(o.created_at)}${o.phone?' · '+esc(showPhone(o.phone)):''}</small></div>
 ${o.car?`<div>🚗 <b>${esc(o.car)}</b></div>`:''}${o.table_no?`<div>طاولة <b>${esc(o.table_no)}</b></div>`:''}
 <ul class="its">${(o.items||[]).map(i=>`<li><span><b>${i.q}×</b> ${esc(i.n)} ${i.opt?`<small>(${esc(i.opt)})</small>`:''}</span><span>${sar(i.u*i.q)}</span></li>`).join('')}</ul>
 ${o.notes?`<div class="warn" style="margin:0">📝 ${esc(o.notes)}</div>`:''}
 ${o.points_used>0?`<div class="oh"><span>المجموع ${sar(o.subtotal??(+o.total + +o.points_used))}</span><span class="pd">خصم نقاط −${sar(o.points_used)}</span></div>`:''}
 <div class="oh"><b>${paidOn(o)?'المبلغ':o.points_used>0?'المطلوب':'المجموع'} ${sar(o.total)}</b>${paidOn(o)?`<span class="paid">مدفوع ✓ ${o.pay_method=='applepay'?'أبل باي':'بطاقة'}${o.payment=='test'?' (تجربة)':''}</span>`:+o.total>0?'<small style="color:var(--mute)">الدفع عند الاستلام</small>':'<span class="paid">مدفوع بالنقاط</span>'}</div>
 ${n?`<div class="acts"><button class="p" data-id="${o.id}" data-s="${n[0]}">${n[1]}</button>${o.status=='new'?`<button class="s" data-id="${o.id}" data-s="cancelled">رفض</button>`:''}</div>`:''}</div>`;
}
async function load(){
 let list=[];try{list=await API.listOrders()}catch(e){return}
 const ids=new Set(list.filter(o=>o.status=='new').map(o=>o.id));
 if(seen&&[...ids].some(id=>!seen.has(id)))beep();seen=ids;
 ['new','accepted','ready'].forEach(s=>{const l=list.filter(o=>o.status==s);if(s!='new')l.reverse();
  $('#c_'+s).textContent=l.length;$('#l_'+s).innerHTML=l.length?l.map(card).join(''):'<div class="empty">ما فيه طلبات</div>'});
 document.title=(ids.size?`(${ids.size}) `:'')+'JOCKEY | شاشة الكاشير';
}
$('#app').onclick=async e=>{const b=e.target.closest('[data-s]');if(!b)return;
 if(b.dataset.s=='cancelled'&&b.dataset.confirm!='1'){b.dataset.confirm='1';b.textContent='متأكد؟';return}
 b.disabled=true;try{await API.setStatus(b.dataset.id,b.dataset.s)}catch(e){}load()};

const syncMenu=()=>API.syncMenu(window.JOCKEY_MENU).catch(()=>{});
async function start(){syncMenu();setInterval(syncMenu,15*6e4);$('#loginBox').hidden=true;$('#app').hidden=false;$('#out').hidden=!API.live;$('#setBtn').hidden=window.JOCKEY_CONFIG.POINTS===false;await load();API.subscribe(load)}

// إعدادات النقاط
const dlg=$('#setDlg');
const toEn=s=>String(s||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace('٫','.');
const ex=()=>{const r=parseFloat(toEn($('#sRate').value));$('#sEx').textContent=$('#sEn').checked&&r>=0?`مثال: طلب بـ 50 ريال يعطي ${Math.floor(50*r/100+1e-9)} نقاط، وطلب بـ 200 ريال يعطي ${Math.floor(200*r/100+1e-9)} نقطة.`:'النقاط موقفة: الزبون ما يجمع ولا يصرف.'};
$('#setBtn').onclick=async()=>{const s=await API.getSettings();$('#sEn').checked=!!s.points_enabled;$('#sRate').value=+s.earn_per_100;$('#serr').hidden=true;ex();dlg.showModal()};
$('#setForm').oninput=ex;$('#sCancel').onclick=()=>dlg.close();
$('#setForm').onsubmit=async e=>{e.preventDefault();const r=parseFloat(toEn($('#sRate').value));
 if(!(r>=0&&r<=100)){$('#serr').textContent='اكتب رقم من 0 إلى 100';$('#serr').hidden=false;return}
 try{await API.saveSettings({points_enabled:$('#sEn').checked,earn_per_100:r});dlg.close()}catch(err){$('#serr').textContent='ما قدرنا نحفظ، جرّب مرة ثانية';$('#serr').hidden=false}};
$('#login').onsubmit=async e=>{e.preventDefault();const r=await API.signIn($('#em').value.trim(),$('#pw').value);if(r.ok)start();else{$('#lerr').textContent=r.msg;$('#lerr').hidden=false}};
$('#out').onclick=async()=>{await API.signOut();location.reload()};
(async()=>{if(await API.session())start();else $('#loginBox').hidden=false})();
}
