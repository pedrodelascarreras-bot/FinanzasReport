var window = this;
function mk(name){
  const fn = function(){ return mk(name+'()'); };
  return new Proxy(fn, {
    get(t, k){
      if (k === Symbol.toPrimitive) return () => '';
      if (k === Symbol.match) return undefined;
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
function reset(){ state.transactions = []; state.cuotas = []; state.subscriptions = []; state.fixedExpenses = []; state.imports = []; state.userProfiles = []; state.activeUserProfileId = null; state.dismissedImportedSubs = []; }
const stored = () => JSON.parse(store['fin_state']);
window.innerWidth = 390; var innerWidth = 390;
window.scrollTo = function(){};
var getComputedStyle = function(){ return { getPropertyValue(){ return ''; } }; };
const tx = (id, ymd, pm, amount, extra) => Object.assign({ id, date: D(ymd), description: 'Gasto ' + id, amount, currency: 'ARS', category: 'Otros', payMethod: pm }, extra || {});
const shellHtml = id => document.getElementById(id).innerHTML;
const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
const dia = n => { const d = new Date(hoy); d.setDate(d.getDate() + n); return dateToYMD(d); };
const period = { cycle: { id: 'c', closeDate: dia(10) }, start: dia(-10), end: dia(10), daysLeft: 10 };
const cycles = () => [{ id: 'c', closeDate: dia(10), openDate: dia(-10), dueDate: dia(20), label: 'Tarjetas', source: 'manual' }];
const _gtc = getTcCycles;
getTcCycles = cycles;

// 1) Inicio: el número grande son las dos tarjetas; abajo Visa, Amex y lo comprometido
reset(); state.caminoPlan = null; state.catRules = [];
state.transactions = [tx('v', dia(-1), 'visa', 1000), tx('a', dia(-2), 'amex', 2000), tx('d', dia(-3), 'deb', 5000)];
state.cuotas = [{ id: 'q', name: 'Prestamo', amount: 300, total: 6, day: new Date(dia(5) + 'T12:00:00').getDate(), startDate: dia(5), currency: 'ARS', payMethod: 'deb', cuotaGroupId: 'cg_q' }];
eq([mxPeriodTotals(period, 'tarjetas').totalArs, mxPeriodTotals(period, 'visa').totalArs, mxPeriodTotals(period, 'amex').totalArs], [3000, 1000, 2000], 'las dos tarjetas juntas; débito afuera');
renderMobileDashboard();
const home = shellHtml('mob-dash-shell');
eq([home.includes('$3.000'), home.includes('Proyección al cierre'), home.includes('Promedio diario'), home.includes('Traer gastos de Gmail')], [true, true, true, true], 'el inicio trae total, proyección, promedio y botón de Gmail');
eq(home.includes('$3.300'), true, 'Gastado + compromisos suma lo que falta cobrar');

eq(home.includes('Conectar con Google'), true, 'botón para conectar con Google');
// Mismo número que el Dashboard: un gasto compartido cuenta solo tu parte
state.transactions.push(tx('s', dia(-1), 'visa', 1000, { sharedExpense: { enabled: true, myAmount: 400, splits: [] } }));
eq(mxPeriodTotals(period, 'tarjetas').totalArs, getPeriodTotals({ startStr: period.start, endStr: period.end, card: 'tarjetas', todayRef: mxEndOfToday() }).totalArs, 'coincide con la cuenta del Dashboard');
state.transactions.pop();
// Conectar pide el acceso directo en el toque y no abre la ventana de importar
let pedidos = 0; driveTokenClient = { requestAccessToken(){ pedidos++; } }; window._gmailSyncPending = false;
mxConnectGoogle();
eq([pedidos, !!window._gmailSyncPending], [1, false], 'conectar solo pide el acceso');
driveTokenClient = null;

// Cuándo se conectó con Google por última vez
const ahora = new Date(2026, 10, 10, 15, 0);
delete store['fin_last_google_at'];
eq(mxLastGoogle(ahora), { text: 'Nunca se conectó en este celular', stale: true }, 'nunca conectado');
store['fin_last_google_at'] = new Date(2026, 10, 10, 14, 50).toISOString();
eq(mxLastGoogle(ahora), { text: 'Última vez: hace 10 min', stale: false }, 'hace un rato');
store['fin_last_google_at'] = new Date(2026, 10, 7, 9, 0).toISOString();
eq(mxLastGoogle(ahora), { text: 'Última vez: hace 3 días', stale: true }, 'hace días: conviene actualizar');
delete store['fin_last_google_at'];

// 2) Movimientos: solo lectura, totales ARS / USD / Total
state.transactions.push(tx('u', dia(-1), 'visa', 10, { currency: 'USD' }));
renderMobileTransactions();
const movs = shellHtml('mob-txn-shell');
eq([/onclick="(?!openMobDrawer|mxImportGmail)/.test(movs), movs.includes('USD 10'), movs.includes('Gasto d')], [false, true, false], 'nada se puede abrir; el débito no aparece');

// 3) Sin datos: ofrece conectar con Google
reset(); state.transactions = []; renderMobileDashboard();
eq(shellHtml('mob-dash-shell').includes('Conectar con Google'), true, 'celular vacío: botón para traer los datos');
getTcCycles = _gtc;

// 4) Ciclos: se guardan con el mismo motor que la compu
reset(); state.tcCycles = []; state.hiddenTcCycles = [];
state.ccCards = [{ id: 'card_v', name: 'Santander Visa', payMethodKey: 'visa' }];
eq(saveTcCycleData({ cardId: 'card_v', openDate: '2027-02-01', closeDate: '2027-01-01', dueDate: '2027-03-10' }), false, 'apertura posterior al cierre: no guarda');
eq(saveTcCycleData({ cardId: 'card_v', openDate: '2027-02-01', closeDate: '2027-03-01', dueDate: '2027-03-10' }), true, 'guarda un ciclo nuevo');
eq([state.tcCycles.length, state.tcCycles[0].payMethodKey, state.tcCycles[0].label.includes('Visa')], [1, 'visa', true], 'con su tarjeta y nombre');

// 5) Solo un cambio real de datos cuenta como cambio de este dispositivo
reset(); state.transactions = [tx('a', dia(-1), 'visa', 1000)];
window._appBooted = true; store['fin_local_edited_at'] = undefined; delete store['fin_local_edited_at'];
resetDataFingerprint();
state.usdRate = 1999; state.dashView = 'amex'; saveState();
eq(store['fin_local_edited_at'], undefined, 'actualizar el dólar o cambiar de vista no es un cambio');
state.transactions.push(tx('b', dia(-1), 'visa', 500)); saveState();
eq(typeof store['fin_local_edited_at'], 'string', 'un gasto nuevo sí');
eq(stored().savedAt, store['fin_local_edited_at'], 'y lo guardado lleva esa fecha');

if (errs.length) print('console.error: ' + errs.slice(0, 3).join(' | '));
if (failures) { print('✗ ' + failures + ' fallaron, ' + passed + ' pruebas OK'); throw new Error(failures + ' pruebas fallaron'); }
print('✓ ' + passed + ' pruebas OK');
