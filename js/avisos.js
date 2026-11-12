// ══ AVISOS (notificaciones del celular) ══
// Mismo esquema que TasksApp: el celular calcula con tus datos qué avisos tocan y cuándo, y
// manda la lista al Worker de avisos (push-worker/). El Worker se despierta justo a la hora de
// cada uno y lo manda, aunque la app esté cerrada. Lo ya mandado no se repite.
//
// Tres grupos:
//  · Para frenarte a tiempo (en el momento en que llegan los gastos): tope del mes del Camino a
//    cero al 50/75/90/100 %, ritmo por encima del tope, una categoría por encima de lo normal y
//    un día mucho más caro que el promedio.
//  · Para no olvidarte (con fecha): cierre de cada tarjeta 3 días antes, vencimiento el día
//    anterior, pagos del plan el día anterior y suscripciones que subieron de precio.
//  · Para motivarte: resumen del domingo a la noche, "vas bien" a mitad de mes y cada cuota
//    que se paga del plan.

const AVISOS_ENDPOINT = 'https://fluxen-push.pedrotasks.workers.dev/api/push';
const AV_TOKEN_KEY = 'fluxen_push_device';
const AV_SENT_KEY = 'fluxen_push_synced';
const AV_CHECKED_KEY = 'fluxen_push_checked';
const AV_CHECK_EVERY = 20 * 3600000;
const AV_HOUR_MORNING = '10:00';
const AV_HOUR_EVENING = '20:00';
const AV_CARDS = { visa: 'Visa', amex: 'Amex' };

// ── Cálculo de los avisos (sin red: se puede probar) ──
function avYmd(d){ return dateToYMD(d); }
function avAddDays(ymd, n){ const d = new Date(ymd + 'T12:00:00'); d.setDate(d.getDate() + n); return avYmd(d); }
function avAt(ymd, hhmm){ return new Date(ymd + 'T' + hhmm + ':00'); }
function avArs(n){ return '$' + Math.round(Number(n) || 0).toLocaleString('es-AR'); }
function avMoney(n, currency){ return (currency || 'ARS') === 'USD' ? 'USD ' + (Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 }) : avArs(n); }
function avShort(ymd){ return new Date(ymd + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', ''); }
function avRate(){ return Number(window.USD_TO_ARS || (typeof USD_TO_ARS !== 'undefined' ? USD_TO_ARS : 0)) || Number(state.usdRate) || 1420; }
function avHasPlan(){ return !!(state.caminoPlan && typeof state.caminoPlan === 'object' && typeof czRealLiving === 'function'); }

// Gasto de vida entre dos fechas: sin las cuotas y fijos del plan (igual que el tope del Camino)
function avLiving(startStr, endStr, today){
  if(avHasPlan()) return czRealLiving(startStr, endStr, today);
  const r = getPeriodTotals({ startStr, endStr, todayRef: today });
  const byCat = getPeriodCategoryTotals(r.entries.filter(e => !e.isProjected));
  return { ars: r.real.ars + r.real.usd * avRate(), byCat };
}

// Lo gastado de verdad con una tarjeta en un rango (sin lo que todavía no se cobró)
function avCardSpent(startStr, endStr, card, today){
  const r = getPeriodTotals({ startStr, endStr, card, todayRef: today });
  return r.real.ars + r.real.usd * avRate();
}

function avFrenarte(now, out){
  if(!avHasPlan()) return;
  const today = new Date(now); today.setHours(12, 0, 0, 0);
  const ymd = avYmd(today);
  const mk = getMonthKey(today);
  const w = czWeekly(today);
  const day = today.getDate();
  const instant = new Date(now.getTime() + 5000);

  if(w.cap > 0){
    // Tope del mes: solo el escalón más alto alcanzado (no cuatro avisos juntos)
    const pct = w.spentMonth / w.cap * 100;
    const step = [100, 90, 75, 50].find(s => pct >= s);
    if(step){
      out.push(step >= 100
        ? { key: 'tope-' + mk + '-100', at: instant, page: 'dashboard', title: 'Te pasaste del tope del mes',
            body: 'Vas ' + avArs(w.spentMonth - w.cap) + ' arriba de tu tope de ' + avArs(w.cap) + '. Lo que falta del mes, cuanto menos mejor.' }
        : { key: 'tope-' + mk + '-' + step, at: instant, page: 'dashboard', title: 'Llevás el ' + step + '% de tu tope',
            body: 'Gastaste ' + avArs(w.spentMonth) + ' de ' + avArs(w.cap) + ' este mes. Te quedan ' + avArs(w.perDay) + ' por día.' });
    }
    // Ritmo: desde el día 7, si al paso actual el mes termina 10 % arriba del tope (una vez por semana)
    if(day >= 7 && pct < 100 && w.pace > w.cap * 1.1){
      out.push({ key: 'ritmo-' + mk + '-s' + Math.ceil(day / 7), at: instant, page: 'dashboard', title: 'Vas más rápido que tu plan',
        body: 'A este ritmo terminás el mes en ' + avArs(w.pace) + ', ' + avArs(w.pace - w.cap) + ' más que tu tope.' });
    }
    // Vas bien: desde el día 10, si el mes termina 10 % o más por debajo del tope (una vez por mes)
    if(day >= 10 && w.pace <= w.cap * 0.9){
      out.push({ key: 'bien-' + mk, at: instant, page: 'dashboard', title: 'Vas bien 👏',
        body: 'A este ritmo terminás el mes en ' + avArs(w.pace) + ', ' + Math.round((1 - w.pace / w.cap) * 100) + '% por debajo de tu tope.' });
    }
  }

  // Categoría por encima de lo normal: en lo que va del mes ya superó un mes entero promedio
  const cur = avLiving(getMonthRange(mk).startStr, ymd, today).byCat || {};
  const prev = [1, 2, 3].map(n => {
    const m = getMonthKey(new Date(today.getFullYear(), today.getMonth() - n, 15));
    const r = getMonthRange(m);
    return avLiving(r.startStr, r.endStr, today).byCat || {};
  });
  Object.keys(cur).map(cat => {
    const avg = prev.reduce((a, m) => a + (m[cat] || 0), 0) / 3;
    return { cat, cur: cur[cat], avg };
  }).filter(x => x.avg >= 20000 && x.cur > x.avg * 1.2 && x.cur - x.avg >= 30000)
    .sort((a, b) => (b.cur - b.avg) - (a.cur - a.avg)).slice(0, 2)
    .forEach(x => out.push({ key: 'cat-' + mk + '-' + x.cat.slice(0, 40), at: instant, page: 'transactions', title: x.cat + ': más de lo normal',
      body: 'Este mes ya van ' + avArs(x.cur) + '. En un mes normal gastás ' + avArs(x.avg) + '.' }));

  // Día caro: hoy va 3 veces el promedio diario del mes (y al menos $50.000)
  if(day >= 4){
    const todaySpent = avLiving(ymd, ymd, today).ars;
    const before = avLiving(getMonthRange(mk).startStr, avAddDays(ymd, -1), today).ars;
    const avgDay = before / (day - 1);
    if(avgDay > 0 && todaySpent >= 50000 && todaySpent >= avgDay * 3){
      out.push({ key: 'dia-' + ymd, at: instant, page: 'transactions', title: 'Día caro',
        body: 'Hoy llevás ' + avArs(todaySpent) + ', ' + Math.floor(todaySpent / avgDay) + ' veces tu promedio diario (' + avArs(avgDay) + ').' });
    }
  }
}

function avNoOlvidarte(now, out){
  const today = new Date(now); today.setHours(12, 0, 0, 0);
  const ymd = avYmd(today);
  const instant = new Date(now.getTime() + 5000);

  // Cierre (3 días antes) y vencimiento (el día anterior) de cada tarjeta
  Object.keys(AV_CARDS).forEach(card => {
    const name = AV_CARDS[card];
    const cycles = (getTcCycles(card) || []).filter(c => c && c.closeDate);
    cycles.forEach((c, i) => {
      const open = getTcCycleOpen(cycles, i) || c.openDate;
      const spent = open && ymd >= open && ymd <= c.closeDate ? avCardSpent(open, ymd, card, today) : 0;
      if(spent > 0){
        out.push({ key: 'cierre-' + card + '-' + c.closeDate, at: avAt(avAddDays(c.closeDate, -3), AV_HOUR_MORNING), page: 'credit-cards',
          title: 'La ' + name + ' cierra en 3 días', body: 'Llevás ' + avArs(spent) + ' en este ciclo. Cierra el ' + avShort(c.closeDate) + '.' });
      }
      const due = c.dueDate && open && ymd > c.closeDate && ymd <= c.dueDate ? getPeriodTotals({ startStr: open, endStr: c.closeDate, card, todayRef: today }).totalArs : 0;
      if(due > 0){
        out.push({ key: 'vence-' + card + '-' + c.dueDate, at: avAt(avAddDays(c.dueDate, -1), AV_HOUR_MORNING), page: 'credit-cards',
          title: 'Mañana vence la ' + name, body: 'A pagar: ' + avArs(due) + '.' });
      }
    });
  });

  // Pagos del plan (préstamos, deudas, fijos): el día anterior
  if(avHasPlan()){
    (state.caminoPlan.items || []).filter(it => it && it.status !== 'pagado' && it.status !== 'esperando').forEach(it => {
      czSchedule(it, { today }).filter(s => !s.paid).forEach(s => {
        const date = avYmd(s.date);
        if(date <= ymd || date > avAddDays(ymd, 40)) return;
        out.push({ key: 'pago-' + it.id + '-' + s.num, at: avAt(avAddDays(date, -1), AV_HOUR_MORNING), page: 'cuotas',
          title: 'Mañana se paga ' + (it.name || 'un compromiso'), body: avMoney(s.amount, s.currency) + (s.total ? ' · cuota ' + s.num + ' de ' + s.total : '') + '.' });
      });
    });
  }

  // Suscripción que subió: el último cobro es más caro que el anterior
  if(typeof txnMatchesSubscription === 'function'){
    (state.subscriptions || []).filter(s => s && s.active !== false).forEach(sub => {
      const charges = (state.transactions || []).filter(t => !t.isPendingSubscription && txnMatchesSubscription(t, sub))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      if(charges.length < 2) return;
      const last = charges[charges.length - 1], prev = charges[charges.length - 2];
      if((last.currency || 'ARS') !== (prev.currency || 'ARS')) return;
      if(avAddDays(avYmd(new Date(last.date)), 35) < ymd) return;
      if(!(Number(last.amount) > Number(prev.amount) * 1.03)) return;
      out.push({ key: 'sub-' + sub.id + '-' + last.id, at: instant, page: 'cuotas', title: (sub.name || 'Una suscripción') + ' subió',
        body: 'De ' + avMoney(prev.amount, prev.currency) + ' a ' + avMoney(last.amount, last.currency) + ' (+' + Math.round((last.amount / prev.amount - 1) * 100) + '%).' });
    });
  }
}

function avMotivarte(now, out){
  const today = new Date(now); today.setHours(12, 0, 0, 0);
  const ymd = avYmd(today);
  const instant = new Date(now.getTime() + 5000);

  // Resumen del domingo a las 20: lo de esta semana contra los mismos días de la anterior
  const dow = today.getDay();
  const monday = avAddDays(ymd, -((dow + 6) % 7));
  const sunday = avAddDays(monday, 6);
  if(!(dow === 0 && now.getHours() >= 20)){
    const week = avLiving(monday, ymd, today).ars;
    const lastWeek = avLiving(avAddDays(monday, -7), avAddDays(ymd, -7), today).ars;
    const upTo = ymd === sunday ? '' : ' (hasta el ' + today.toLocaleDateString('es-AR', { weekday: 'long' }) + ')';
    let body = 'Esta semana' + upTo + ' gastaste ' + avArs(week) + '.';
    if(lastWeek > 0){
      const diff = Math.round((week / lastWeek - 1) * 100);
      body += diff <= -1 ? ' ' + (-diff) + '% menos que la semana pasada 👏' : diff >= 1 ? ' ' + diff + '% más que la semana pasada.' : ' Igual que la semana pasada.';
    }
    out.push({ key: 'semana-' + monday, at: avAt(sunday, AV_HOUR_EVENING), page: 'dashboard', title: 'Tu semana', body });
  }

  // Cada cuota del plan que se paga: los débitos automáticos a las 18 del día, las marcadas a mano en el momento
  if(avHasPlan()){
    (state.caminoPlan.items || []).filter(it => it && czItemIsDebt(it)).forEach(it => {
      czSchedule(it, { today }).forEach(s => {
        if(!s.total) return;
        const date = avYmd(s.date);
        const left = s.total - s.num;
        const body = 'Se pagó la cuota ' + s.num + ' de ' + s.total + ' de ' + (it.name || 'tu plan') + '. ' + (left ? 'Faltan ' + left + '.' : '¡Era la última!');
        if(it.autoDebit && !s.paid && date > ymd && date <= avAddDays(ymd, 40)){
          out.push({ key: 'hecho-' + it.id + '-' + s.num, at: avAt(date, '18:00'), page: 'dashboard', title: left ? 'Una cuota menos 🎉' : 'Terminaste de pagar 🎉', body });
        } else if(s.paid && date >= avAddDays(ymd, -2) && date <= ymd){
          out.push({ key: 'hecho-' + it.id + '-' + s.num, at: instant, page: 'dashboard', title: left ? 'Una cuota menos 🎉' : 'Terminaste de pagar 🎉', body });
        }
      });
    });
  }
}

/** Todos los avisos que tocan desde ahora, ordenados. */
function avisosBuild(now = new Date()){
  const out = [];
  [avFrenarte, avNoOlvidarte, avMotivarte].forEach(fn => {
    try{ fn(now, out); }catch(e){ console.warn('avisos', fn.name, e); }
  });
  const seen = new Set();
  return out.filter(a => a.at > new Date(now.getTime() - 60000) && !seen.has(a.key) && seen.add(a.key))
    .sort((a, b) => a.at - b.at)
    .map(a => ({ key: a.key, at: a.at.toISOString(), title: a.title, body: a.body, page: a.page || null }));
}

// ── Avisos en el celular (Web Push) ──
function avStandalone(){
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
}
function avisosStatus(){
  if(!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) return 'install';
  if(!avStandalone() && /iPhone|iPad|iPod/.test(navigator.userAgent)) return 'install';
  if(Notification.permission === 'denied') return 'denied';
  return Notification.permission === 'granted' && localStorage.getItem(AV_TOKEN_KEY) ? 'on' : 'off';
}
function avDeviceToken(){
  let t = localStorage.getItem(AV_TOKEN_KEY);
  if(!t){
    t = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(AV_TOKEN_KEY, t);
  }
  return t;
}
// Publicada en Vercel la app usa su propio puente (api/push.js): el Worker solo acepta
// pedidos directos desde la dirección vieja de GitHub Pages o desde la compu en local.
function avEndpoint(){
  const host = String((typeof location !== 'undefined' && location.hostname) || '');
  return /\.github\.io$|^localhost$|^127\.0\.0\.1$/.test(host) ? AVISOS_ENDPOINT : '/api/push';
}
function avCall(body, keepalive){
  return fetch(avEndpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: !!keepalive })
    .then(r => { if(!r.ok) throw new Error('avisos ' + r.status); return r.json(); });
}
function avKeyBytes(b64url){
  const raw = atob(b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
let _avSwReg = null;
function avServiceWorker(){
  if(!_avSwReg) _avSwReg = navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready);
  return _avSwReg;
}
async function avSubscribe(reg){
  let sub = await reg.pushManager.getSubscription();
  if(!sub){
    const { publicKey } = await avCall({ action: 'key' });
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: avKeyBytes(publicKey) });
  }
  await avCall({ action: 'register', token: avDeviceToken(), subscription: sub.toJSON() });
  localStorage.removeItem(AV_SENT_KEY);
  localStorage.setItem(AV_CHECKED_KEY, String(Date.now()));
}

/** Tiene que llamarse desde un toque. */
async function avisosEnable(){
  try{
    if(avisosStatus() === 'install'){ showToast('Abrí Fluxen desde el ícono de la pantalla de inicio para activar los avisos', 'info'); return; }
    if((await Notification.requestPermission()) !== 'granted'){ showToast('Sin permiso no te podemos avisar. Lo podés cambiar en Ajustes del iPhone → Fluxen.', 'error'); avisosRefreshUi(); return; }
    await avSubscribe(await avServiceWorker());
    avisosQueue(true);
    avCall({ action: 'test', token: avDeviceToken() }).catch(() => {});
    showToast('Avisos activados. Te mandamos uno de prueba.', 'success');
  }catch(e){
    console.warn('avisos', e);
    showToast('No se pudieron activar los avisos. Probá de nuevo en un rato.', 'error');
  }
  avisosRefreshUi();
}
async function avisosTest(){
  try{
    const r = await avCall({ action: 'test', token: avDeviceToken() });
    showToast(r.ok ? 'Listo: te llega un aviso de prueba' : 'No llegó. Tocá "Activar avisos" de nuevo.', r.ok ? 'success' : 'error');
  }catch(_){ showToast('No se pudo mandar la prueba. Revisá la conexión.', 'error'); }
}

/** Una vez por día renueva la suscripción si el iPhone la dio de baja, para que no dejen de llegar callados. */
async function avisosRefresh(){
  if(avisosStatus() !== 'on' || Date.now() - Number(localStorage.getItem(AV_CHECKED_KEY) || 0) < AV_CHECK_EVERY) return;
  try{ await avSubscribe(await avServiceWorker()); }catch(_){}
}

let _avTimer = 0;
function avSend(keepalive){
  _avTimer = 0;
  if(avisosStatus() !== 'on') return;
  let avisos;
  try{ avisos = avisosBuild(new Date()); }catch(e){ console.warn('avisos', e); return; }
  // Lo inmediato cambia de hora en cada cálculo: la firma lo ignora para no mandar lo mismo de nuevo
  const firma = JSON.stringify(avisos.map(a => [a.key, Date.parse(a.at) - Date.now() < 60000 ? 'ya' : a.at, a.title, a.body]));
  if(firma === localStorage.getItem(AV_SENT_KEY)) return;
  avCall({ action: 'sync', token: avDeviceToken(), avisos }, keepalive)
    .then(() => localStorage.setItem(AV_SENT_KEY, firma))
    .catch(() => { /* se reintenta en el próximo cambio o al abrir */ });
}
/** Recalcula los avisos unos segundos después del último cambio, lejos de cualquier toque. */
function avisosQueue(immediately){
  if(avisosStatus() !== 'on') return;
  clearTimeout(_avTimer);
  _avTimer = setTimeout(() => avSend(false), immediately ? 0 : 3000);
}

// Bloque del Inicio del celular
function avisosWidgetHtml(){
  const st = avisosStatus();
  const bell = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  const t = { on: 'Avisos activados', off: 'Avisos', denied: 'Avisos bloqueados', install: 'Avisos' }[st];
  const s = { on: 'Topes, cierres, cuotas y tu semana', off: 'Te avisamos antes de pasarte del tope', denied: 'Permitilos en Ajustes del iPhone → Fluxen', install: 'Abrí Fluxen desde el ícono de inicio' }[st];
  const btn = st === 'on' ? '<button class="mx-go ghost" onclick="avisosTest()">Probar</button>'
    : st === 'off' ? '<button class="mx-go" onclick="avisosEnable()">Activar</button>' : '';
  return '<div class="mx-w full" id="mx-avisos"><div class="mx-goo"><div class="mx-goo-l"><span class="mx-g mx-bell' + (st === 'on' ? ' on' : '') + '">' + bell + '</span><span>'
    + '<span class="mx-goo-t">' + esc(t) + '</span><span class="mx-goo-s fresh">' + esc(s) + '</span></span></div>' + btn + '</div></div>';
}
function avisosRefreshUi(){
  const el = document.getElementById('mx-avisos');
  if(el) el.outerHTML = avisosWidgetHtml();
}

// Al tocar un aviso se abre la pantalla que corresponde
function avOpenPage(page){
  if(page && typeof nav === 'function' && ['dashboard', 'transactions', 'cuotas', 'credit-cards'].includes(page)) nav(page);
}
if(typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.addEventListener){
  navigator.serviceWorker.addEventListener('message', e => { if(e.data && e.data.type === 'fluxen-open') avOpenPage(e.data.page); });
}
if(typeof document !== 'undefined' && document.addEventListener){
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible'){ avisosRefresh(); avisosQueue(); } });
  document.addEventListener('DOMContentLoaded', () => {
    try{
      const page = new URLSearchParams(location.search).get('page');
      if(page) setTimeout(() => avOpenPage(page), 600);
    }catch(_){}
    if(avisosStatus() === 'on'){ avServiceWorker().catch(() => {}); avisosRefresh(); }
  });
}
