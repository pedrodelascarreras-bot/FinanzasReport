// Consistencia entre pantallas: carga TODA la app (con un DOM falso) y verifica que
// Dashboard, Movimientos, Tendencias y Tarjetas den el mismo total.
// Correr desde la raíz del repo:  npm run test:consistencia
var window = this;
function mk(name){
  const fn = function(){ return mk(name+'()'); };
  return new Proxy(fn, {
    get(t, k){
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'toString' || k === 'valueOf') return () => '';
      if (k === Symbol.iterator) return function*(){};
      if (k === 'length') return 0;
      if (k === 'then') return undefined;
      if (k in t) return t[k];
      return mk(name+'.'+String(k));
    },
    set(t,k,v){ t[k]=v; return true; },
    apply(){ return mk(name+'()'); },
    construct(){ return mk('new '+name); }
  });
}
var store = {};
var localStorage = { getItem(k){ return k in store ? store[k] : null; }, setItem(k,v){ store[k]=String(v); }, removeItem(k){ delete store[k]; } };
var sessionStorage = localStorage;
var document = mk('document');
var _els = {};
document.getElementById = function(id){ return _els[id] || (_els[id] = mk('#'+id)); };
document.querySelector = function(q){ return mk(q); };
document.querySelectorAll = function(){ return []; };
document.addEventListener = function(){};
document.createElement = function(){ return mk('el'); };
window.addEventListener = function(){};
window.matchMedia = function(){ return { matches:false, addEventListener(){}, addListener(){} }; };
window.location = { href:'http://x/', hash:'', search:'' };
var navigator = { userAgent:'jsc', language:'es' };
var location = window.location;
var setTimeout = function(){ return 0; }, clearTimeout = function(){}, setInterval = function(){ return 0; }, clearInterval = function(){};
var requestAnimationFrame = function(){ return 0; }, cancelAnimationFrame = function(){};
var performance = { now(){ return Date.now(); } };
var fetch = function(){ return new Promise(()=>{}); };
var Chart = mk('Chart'), gsap = mk('gsap'), Papa = mk('Papa'), html2canvas = mk('h2c'), jspdf = mk('jspdf'), pdfjsLib = mk('pdfjs'), google = mk('google');
var IntersectionObserver = function(){ return { observe(){}, disconnect(){} }; };
var ResizeObserver = IntersectionObserver, MutationObserver = IntersectionObserver;
var console = { log(){}, info(){}, warn(){}, error(m){ errs.push(String(m)); }, debug(){} };
var errs = [];
// Scripts en el mismo orden que index.html
var html = readFile('index.html');
var files = (html.match(/<script src="js\/[^"?]+/g) || []).map(m => m.replace('<script src="', ''));
for (const f of files) {
  try { load(f); } catch (e) { print('LOAD ERROR ' + f + ': ' + e + (e.stack? '\n' + e.stack.split('\n').slice(0,3).join('\n') : '')); }
}


let failures = 0, passed = 0;
function eq(actual, expected, msg){
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; return; }
  failures++; print('✗ ' + msg + '\n    esperado: ' + e + '\n    obtenido: ' + a);
}
const D = s => new Date(s + 'T12:00:00');
const todayYmd = dateToYMD(new Date());
// Datos relativos a hoy: mes actual y ciclo Visa en curso
const now = new Date();
const monthKeyNow = getMonthKey(now);
const day = n => dateToYMD(new Date(now.getFullYear(), now.getMonth(), n));
state.transactions = [
  { id: 'c', date: D(day(1)), description: 'Super', amount: 5000, currency: 'ARS', payMethod: 'visa', category: 'Supermercado', tags: [] },
  { id: 'x', date: D(todayYmd), description: 'Amazon', amount: 30, currency: 'USD', payMethod: 'amex', category: 'Compras', tags: [] },
  { id: 'd', date: D(day(1)), description: 'Verdu', amount: 800, currency: 'ARS', payMethod: 'deb', category: 'Supermercado', tags: [] },
  { id: 's', date: D(day(1)), description: 'Cena', amount: 9000, currency: 'ARS', payMethod: 'visa', category: 'Restaurantes', tags: [], sharedExpense: { enabled: true, myAmount: 3000, splits: [{ name: 'Juan', amount: 6000, status: 'pendiente' }] } }
];
state.subscriptions = [{ id: 's1', name: 'Spotify', price: 3000, currency: 'ARS', freq: 'monthly', day: 1, active: true, payMethod: 'visa' }];
state.fixedExpenses = [{ id: 'f1', name: 'Alquiler', amount: 400000, currency: 'ARS', day: 1 }];
state.ccCards = [{ id: 'card_visa', name: 'Visa', payMethodKey: 'visa' }, { id: 'card_amex', name: 'Amex', payMethodKey: 'amex' }];
migrateCuotasToSingleSource();
USD_TO_ARS = 1000;
const sum = list => list.reduce((a, t) => { a[(t.currency || 'ARS') === 'USD' ? 'usd' : 'ars'] += getTxnPersonalAmount(t); return a; }, { ars: 0, usd: 0 });

// Mes: 5000 + 800 + 3000 (tu parte) + Spotify 3000 + alquiler 400000 · USD 30
const range = getMonthRange(monthKeyNow);
const expected = { ars: 411800, usd: 30 };
const base = getPeriodTotals(range);
eq({ ars: base.ars, usd: base.usd }, expected, 'receta única (mes)');
const mov = getTxnDisplaySummaryTotals({ mode: 'mes', monthKey: monthKeyNow, summaryTxns: [] });
eq({ ars: mov.ars, usd: mov.usd }, expected, 'Movimientos (mes)');
state.tendMode = 'mes';
eq(sum(getTxnsForTendPeriod(monthKeyNow)), expected, 'Tendencias (mes)');
eq(sum(_db2BuildMonthExpenseEntries(monthKeyNow)), expected, 'Dashboard evolución (mes)');
eq(Math.round(getDashCycleTotal()), 411800 + 30 * 1000, 'Dashboard total del período en ARS (mes)');

// Ciclo Visa en curso: Super 5000 + Cena 3000 (tu parte) + Spotify 3000; sin débito, Amex ni alquiler
const cycles = getTcCycles('visa');
const idx = cycles.findIndex(c => { const o = getTcCycleOpen(cycles, cycles.indexOf(c)); return o && o <= todayYmd && todayYmd <= c.closeDate; });
eq(idx >= 0, true, 'hay un ciclo Visa en curso');
if (idx >= 0) {
  const cyc = cycles[idx], open = getTcCycleOpen(cycles, idx);
  const inCycle = ymd => ymd >= open && ymd <= cyc.closeDate;
  const visaExpected = inCycle(day(1)) ? { ars: 11000, usd: 0 } : { ars: 0, usd: 0 };
  const visa = getPeriodTotals({ startStr: open, endStr: cyc.closeDate, card: 'visa' });
  eq({ ars: visa.ars, usd: visa.usd }, visaExpected, 'receta única (ciclo Visa)');
  const movTc = getTxnDisplaySummaryTotals({ mode: 'visa', activeCycleMeta: { openStr: open, closeStr: cyc.closeDate }, summaryTxns: [] });
  eq({ ars: movTc.ars, usd: movTc.usd }, visaExpected, 'Movimientos (ciclo Visa)');
  eq(sum(getTcCycleTrendTxns(cyc, cycles)), visaExpected, 'Tendencias (ciclo Visa)');
  const ccVisa = ccGetTotals(ccGetCycleExpenses('card_visa', cyc.id));
  eq({ ars: ccVisa.ars, usd: ccVisa.usd }, inCycle(day(1)) ? { ars: 17000, usd: 0 } : { ars: 0, usd: 0 }, 'Tarjetas Visa usa el monto completo (cena 9000)');
}

// Ciclo AMEX en curso: solo el cargo Amex (Amazon USD 30); nada de Visa, débito ni fijos
const amexCycles = getTcCycles('amex');
const aIdx = amexCycles.findIndex(c => { const o = getTcCycleOpen(amexCycles, amexCycles.indexOf(c)); return o && o <= todayYmd && todayYmd <= c.closeDate; });
eq(aIdx >= 0, true, 'hay un ciclo AMEX en curso');
if (aIdx >= 0) {
  const cyc = amexCycles[aIdx], open = getTcCycleOpen(amexCycles, aIdx);
  const amexExpected = { ars: 0, usd: 30 };
  const amex = getPeriodTotals({ startStr: open, endStr: cyc.closeDate, card: 'amex' });
  eq({ ars: amex.ars, usd: amex.usd }, amexExpected, 'receta única (ciclo AMEX)');
  const movA = getTxnDisplaySummaryTotals({ mode: 'amex', activeCycleMeta: { openStr: open, closeStr: cyc.closeDate }, summaryTxns: [] });
  eq({ ars: movA.ars, usd: movA.usd }, amexExpected, 'Movimientos (ciclo AMEX)');
  eq(sum(getTcCycleTrendTxns(cyc, amexCycles)), amexExpected, 'Tendencias (ciclo AMEX)');
  const ccA = ccGetTotals(ccGetCycleExpenses('card_amex', cyc.id));
  eq({ ars: ccA.ars, usd: ccA.usd }, amexExpected, 'Tarjetas (ciclo AMEX)');
  state.dashView = 'amex'; state.dashTcCycle = cyc.id;
  eq(Math.round(getDashCycleTotal()), amexExpected.usd * 1000, 'Dashboard total (ciclo AMEX)');
  state.dashView = 'mes'; state.dashTcCycle = null;
}
// Compromisos: la página y el KPI del dashboard suman lo mismo (suscripción pausada, fijo sin moneda, USD)
{
  const saved = { subs: state.subscriptions, fixed: state.fixedExpenses };
  state.subscriptions = saved.subs.concat([
    { id: 'pausada', name: 'Disney', price: 7000, currency: 'ARS', freq: 'monthly', day: 3, active: false },
    { id: 'usd', name: 'ChatGPT', price: 20, currency: 'USD', freq: 'monthly', day: 9, active: true }
  ]);
  state.fixedExpenses = saved.fixed.concat([{ id: 'sinmoneda', name: 'Expensas', amount: 90000, day: 10 }]);
  const page = Math.round(commitmentsBuildData().allActive.reduce((s, i) => s + i.amountArs, 0));
  state.dashView = 'mes';
  const kpi = Math.round(_dashBuildContext().compromisoTotal);
  eq(kpi, page, 'Compromisos: página = KPI del dashboard');
  state.subscriptions = saved.subs; state.fixedExpenses = saved.fixed;
}

// Ciclos sin huecos: un ciclo cargado a mano entre automáticos no deja días afuera
{
  const savedCycles = state.tcCycles;
  const vis = getTcCycles('visa').slice().sort((a, b) => a.closeDate.localeCompare(b.closeDate));
  let gaps = 0;
  for (let i = 1; i < vis.length; i++) { const d = new Date(vis[i - 1].closeDate + 'T12:00:00'); d.setDate(d.getDate() + 1); if (dateToYMD(d) !== getTcCycleOpen(vis, i)) gaps++; }
  if (gaps) print('  ciclos: ' + vis.map(c => c.id + ' ' + (c.openDate||'?') + '→' + c.closeDate + ' ' + c.source).join(' | '));
  eq(gaps, 0, 'ciclos Visa contiguos (sin días sin ciclo)');
  state.tcCycles = savedCycles;
}

// La vista AMEX sobrevive a guardar y recargar
eq(_normalizeViewMode('amex'), 'amex', 'la vista AMEX no se convierte en VISA al recargar');

// Las pantallas cargan sin errores
['renderDashboard', 'renderTransactions', 'renderSavingsPage', 'renderIncomePage', 'renderCreditCards', 'renderProfilePage', 'renderTendencia', 'renderCommitmentsPage', 'renderCalendarPage'].forEach(fn => {
  try { window[fn](); passed++; } catch (e) { failures++; print('✗ ' + fn + ': ' + e); }
});

print((failures ? '✗ ' + failures + ' fallaron, ' : '✓ ') + passed + ' pruebas OK');
if (failures) throw new Error(failures + ' pruebas fallaron');
