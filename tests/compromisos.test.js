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
window.scrollTo = function(){};
const T = new Date('2026-11-06T12:00:00');
const cuota = (id, extra) => Object.assign({ id, name: 'Cuota ' + id, amount: 100000, total: 6, day: 5, startDate: '2026-11-05', currency: 'ARS', payMethod: 'deb', cuotaGroupId: 'cg_' + id }, extra || {});
const meta = { cycle: { id: 'c', closeDate: '2026-11-29' }, openStr: '2026-10-30', closeStr: '2026-11-29' };

// 1) El panel de Movimientos muestra los compromisos de cualquier tarjeta o débito
reset(); state.caminoPlan = null;
state.cuotas = [cuota('brubank', { payMethod: 'deb', day: 5 }), cuota('mp', { payMethod: 'amex', day: 12, startDate: '2026-11-12', amount: 900000 }), cuota('gym', { payMethod: 'visa', day: 20, startDate: '2026-11-20', amount: 50000 })];
let e = getTxnCycleCommitmentEntries('visa', meta, '', [], T, '');
const byName = n => e.find(x => x.title === 'Cuota ' + n);
eq([!!byName('brubank'), !!byName('mp'), !!byName('gym')], [true, true, true], 'vista Visa: se ven también el débito y la de Amex');
eq([byName('brubank').inView, byName('mp').inView, byName('gym').inView], [false, false, true], 'marca cuáles van en el resumen de Visa');
eq([byName('brubank').payLabel, byName('mp').payLabel], ['Débito', 'Amex'], 'dice dónde se cobra cada una');
eq([byName('brubank').isSettled, byName('mp').isSettled], [true, false], 'la que ya llegó a su fecha figura cobrada; la que no, sin cobrar');
e = getTxnCycleCommitmentEntries('mes', null, '', [], T, '2026-11');
eq(e.length, 3, 'vista Mes: también aparece el panel con todo el mes');
eq(getTxnCycleCommitmentEntries('visa', meta, 'algo', [], T, '').length, 0, 'buscando, no hay panel');

// 2) Los totales suman lo comprometido que todavía no se cobró (de la tarjeta de la vista)
const tot = mode => getTxnDisplaySummaryTotals({ mode, activeCycleMeta: mode === 'mes' ? null : meta, searchVal: '', txns: [], summaryTxns: [], todayRef: T, monthKey: '2026-11', estadoFilter: 'all' });
eq([tot('mes').pendingArs, tot('mes').ars], [950000, 1050000], 'vista Mes: suma Brubank (cobrado) + Mercado Pago y gimnasio (sin cobrar)');
eq([tot('amex').pendingArs, tot('amex').ars], [900000, 900000], 'vista Amex: Mercado Pago sin cobrar ya está en el total');
eq(tot('visa').pendingArs, 50000, 'vista Visa: solo lo de Visa');

// 3) Cancelar una deuda desde Cuotas (sin plan de Camino a cero)
reset(); state.caminoPlan = null;
state.cuotas = [cuota('b', { startDate: '2026-10-05' })];
cancelCuota('b', 450000, '2026-11-20');
const cb = () => state.cuotas.find(c => c.id === 'b');
eq([cb().total, cb().cancelled.amount, state.transactions.filter(t => t.id === 'cuota_cancel_b').length], [2, 450000, 1], 'queda en las 2 pagadas y el pago se registra');
eq(getTxnCycleCommitmentEntries('mes', null, '', [], new Date('2026-12-10T12:00:00'), '2026-12').length, 0, 'diciembre ya no tiene cuota');
undoCancelCuota('b');
eq([cb().total, !!cb().cancelled, state.transactions.length], [6, false, 0], 'deshacer vuelve todo como estaba');
cancelCuota('b', 600000, '2026-10-01');
eq([state.cuotas.length, state.transactions.length], [0, 1], 'cancelada antes de la primera cuota: no queda nada que proyectar');

// 4) Préstamo de Camino a cero: se cancela en un solo lugar y queda igual en los dos
reset();
state.caminoPlan = { items: [
  { id: 'L1', kind: 'prestamo', name: 'Préstamo B', currency: 'ARS', amount: 100000, count: 6, firstDate: '2026-11-05', everyMonths: 1, autoDebit: true, status: 'activo', cuotaGroupId: 'cg_b' },
  { id: 'L2', kind: 'prestamo', name: 'Préstamo MP', currency: 'ARS', amount: 900000, count: 6, firstDate: '2026-11-12', everyMonths: 1, autoDebit: true, status: 'activo', cuotaGroupId: 'cg_mp', viaCard: 'Amex' }
] };
state.cuotas = [cuota('b'), cuota('mp', { payMethod: 'amex' })];
eq([cuotaCanPrepay(state.cuotas[0]), cuotaCanPrepay(state.cuotas[1])], [true, false], 'Brubank se puede cancelar; Mercado Pago (va por Amex) no');
cancelCuota('b', 400000, '2026-11-20');
eq([czFindItem('L1').status, !!czFindItem('L1').cancelled, cb().total, !!cuotaCancelInfo(cb())], ['pagado', true, 1, true], 'cancelar desde Cuotas también cancela el préstamo del plan');
undoCancelCuota('b');
eq([czFindItem('L1').status, cb().total], ['activo', 6], 'y deshacer también vuelve los dos');

if (errs.length) print('console.error: ' + errs.slice(0, 3).join(' | '));
if (failures) { print('✗ ' + failures + ' fallaron, ' + passed + ' pruebas OK'); throw new Error(failures + ' pruebas fallaron'); }
print('✓ ' + passed + ' pruebas OK');
