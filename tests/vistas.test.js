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
const T = new Date('2026-11-06T12:00:00');
const tx = (id, pm, amount, extra) => Object.assign({ id, date: new Date('2026-11-03T12:00:00'), description: 'Gasto ' + id, amount, currency: 'ARS', category: 'Otros', payMethod: pm }, extra || {});
const meta = { cycle: { id: 'tarjetas_x', closeDate: '2026-11-29', parts: {} }, openStr: '2026-10-30', closeStr: '2026-11-29' };

// 1) Qué entra en la vista Tarjetas
eq(['visa', 'amex', 'deb', 'ef', ''].map(pm => payMethodMatchesCard(pm, 'tarjetas')), [true, true, false, false, true], 'Visa y Amex sí; débito y efectivo no');
eq(normalizeViewMode('tarjetas'), 'tarjetas', 'la vista Tarjetas es válida');

// 2) Totales: juntos y separados por resumen, con lo que falta cobrar
reset(); state.caminoPlan = null;
state.transactions = [tx('v', 'visa', 1000), tx('a', 'amex', 2000), tx('d', 'deb', 5000)];
state.cuotas = [{ id: 'mp', name: 'MP', amount: 900, total: 6, day: 12, startDate: '2026-11-12', currency: 'ARS', payMethod: 'amex', cuotaGroupId: 'cg_mp' }];
const t = getTxnDisplaySummaryTotals({ mode: 'tarjetas', activeCycleMeta: meta, searchVal: '', txns: [], summaryTxns: [], todayRef: T, estadoFilter: 'all' });
eq([t.ars, t.pendingArs, Math.round(t.perCard.visa), Math.round(t.perCard.amex)], [3900, 900, 1000, 2900], 'suma las dos tarjetas (no el débito) y separa cada resumen');

// 3) Migración: quien tenía Vista VISA pasa a Tarjetas una sola vez, y no queda un filtro de tarjeta escondido
reset(); state.transactions = [tx('v', 'visa', 1000)];
state.txnFilterMode = 'visa'; state.txnCardFilter = 'amex'; state._viewsSimplified = false;
saveState(); loadState();
eq([state.txnFilterMode, state.txnCardFilter, state._viewsSimplified], ['tarjetas', '', true], 'pasa a Tarjetas y limpia el filtro');
state.txnFilterMode = 'visa'; saveState(); loadState();
eq(state.txnFilterMode, 'visa', 'si después elegís Visa, se respeta');

if (errs.length) print('console.error: ' + errs.slice(0, 3).join(' | '));
if (failures) { print('✗ ' + failures + ' fallaron, ' + passed + ' pruebas OK'); throw new Error(failures + ' pruebas fallaron'); }
print('✓ ' + passed + ' pruebas OK');
