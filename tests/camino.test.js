// Camino a cero: calendario de compromisos, fecha de libertad, tope semanal, extraordinarios e importación del plan.
// Correr desde la raíz del repo:  npm run test:camino
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
function reset(){ state.transactions = []; state.cuotas = []; state.subscriptions = []; state.fixedExpenses = []; state.imports = []; state.dismissedAutoCuotas = []; state.autoCuotaConfig = {}; }
const gmail = (id, ymd, desc, amount, extra) => Object.assign({ id: 'gmail_' + id, gmailId: id, source: 'gmail', origen_del_movimiento: 'importado_desde_gmail', date: D(ymd), description: desc, _baseDesc: desc, amount, currency: 'ARS', payMethod: 'visa', category: 'Varios', tags: [] }, extra || {});
const stmt = (id, ymd, desc, amount, extra) => Object.assign({ id: 'st_' + id, date: D(ymd), description: desc, _baseDesc: desc, amount, currency: 'ARS', category: 'Procesando...', tags: [] }, extra || {});
const real = () => state.transactions.filter(t => !t.isPendingCuota && !t.isPendingSubscription);
const T = new Date('2026-10-18T12:00:00');
reset(); state.caminoPlan = null;
// Plan de ejemplo (datos ficticios)
const plan = {
  camino: { salaryUsd: 2000, usdRate: 1000, livingCapArs: 1000000, startSavingsUsd: 0, aguinaldo: { month: '2026-12', netUsd: 500 }, emergencyMonths: 1, startMonth: '2026-10',
    items: [
      { id: 'L1', kind: 'prestamo', name: 'Préstamo A', currency: 'ARS', amount: 300000, count: 3, firstDate: '2026-11-05', everyMonths: 1, autoDebit: true, status: 'activo', cuotaGroupId: 'cg_test_a' },
      { id: 'P1', kind: 'personal', name: 'Amigo', currency: 'USD', amount: 600, status: 'activo', schedule: [{ date: '2026-10-30', amount: 400 }, { date: '2026-11-30', amount: 200 }] },
      { id: 'W1', kind: 'personal', name: 'Familiar', currency: 'USD', amount: 100, status: 'esperando', waitingFor: 'depende de otro' },
      { id: 'F1', kind: 'fijo', name: 'Seguro', currency: 'ARS', amount: 100000, firstDate: '2026-11-10', everyMonths: 1, autoDebit: true, status: 'activo', fixedId: 'fx_t' },
      { id: 'X1', kind: 'puntual', name: 'Impuesto', currency: 'ARS', amount: 50000, status: 'activo', schedule: [{ date: '2026-12-15', amount: 50000 }], registerAsExpense: true, category: 'Otros' }
    ] },
  createCuotas: [{ id: 'cq', cuotaGroupId: 'cg_test_a', name: 'Préstamo A', amount: 300000, total: 3, paid: 0, day: 5, startDate: '2026-11-05', currency: 'ARS', payMethod: 'deb' }],
  createFixed: [{ id: 'fx_t', name: 'Seguro', amount: 100000, currency: 'ARS', day: 10, startDate: '2026-11-01' }]
};
const res = czApplyPlanData(plan);
eq(res, { items: 5, cuotas: 1, fixed: 1 }, 'importa ítems, crea la cuota y el gasto fijo');
const fr = czFreedom(T);
eq([dateToYMD(fr.date), fr.undated.map(i => i.name)], ['2027-01-05', ['Familiar']], 'fecha de libertad = última cuota; la deuda "esperando" va aparte');
const cal = czCalendar({ today: T });
const row = mk => cal.find(c => c.mk === mk);
eq(Math.round(row('2026-11').commitments), 300000 + 200000 + 100000, 'noviembre: cuota + 200 USD + seguro');
eq(Math.round(row('2026-12').aguinaldo), 500000, 'diciembre suma el aguinaldo');
eq(Math.round(row('2027-02').commitments), 100000, 'febrero: solo el seguro (las cuotas terminaron)');
// Gasto real de octubre: un gasto normal y uno extraordinario
state.transactions = [gmail('n1', '2026-10-05', 'SUPER', 200000), gmail('x1', '2026-10-06', 'HOTEL', 500000)];
let rl = czRealLiving('2026-10-01', '2026-10-31', T);
eq([rl.ars, rl.extraArs], [700000, 0], 'sin marcar, todo es gasto de vida');
czToggleExtra('gmail_x1');
rl = czRealLiving('2026-10-01', '2026-10-31', T);
eq([rl.ars, rl.extraArs], [200000, 500000], 'el extraordinario no cuenta para el tope');
const c2 = czCalendar({ today: T });
eq(Math.round(c2.find(c => c.mk === '2026-10').savings), 2000000 - 400000 - 1000000 - 500000, 'pero sí sale del ahorro del mes');
// Las cuotas del plan no cuentan como gasto de vida aunque estén en la app
state.transactions.push(Object.assign(gmail('q1', '2026-10-07', 'PRESTAMO', 300000), { cuotaGroupId: 'cg_test_a', cuotaNum: 1, cuotaTotal: 3 }));
eq(czRealLiving('2026-10-01', '2026-10-31', T).ars, 200000, 'la cuota vinculada no suma al gasto de vida');
// Tope semanal
const w = czWeekly(T);
eq([w.cap, w.spentMonth, w.remainingMonth], [1000000, 200000, 800000], 'tope del mes, gastado y disponible');
eq(w.weekBudget > 0 && w.weekLeft <= w.weekBudget, true, 'presupuesto de la semana calculado');
// Marcar pagos
czMarkNextPaid('P1');
eq(czFindItem('P1').schedule[0].paid, true, 'marcar pagado la deuda personal');
czMarkNextPaid('X1');
eq([czFindItem('X1').status, state.transactions.some(t => t.caminoItemId === 'X1')], ['pagado', true], 'el pago puntual se registra como gasto y queda pagado');
eq(czRealLiving('2026-10-01', '2026-12-31', T).ars, 200000, 'el gasto registrado desde el plan no se cuenta dos veces');
// Asesor: queda en rojo → sugiere mover el pago a la persona
state.caminoPlan.livingCapArs = 1900000;
const ins = czInsights(T).map(i => i.title).join(' | ');
eq(/rojo/.test(ins), true, 'avisa cuando el ahorro queda en rojo');
// Resumen para Claude
eq(/Préstamo A/.test(czBuildClaudePrompt()) && /Fecha de libertad/.test(czBuildClaudePrompt()), true, 'el resumen para Claude incluye compromisos y fecha de libertad');
// Seguro con fecha de inicio: no se proyecta antes de noviembre
const octEntries = getProjectedCommitmentEntriesForRange({ startStr: '2026-10-01', endStr: '2026-10-31', todayRef: T });
eq(octEntries.some(e => e.sourceFixedId === 'fx_t'), false, 'un gasto fijo con fecha de inicio no aparece antes');
// Persistencia
saveState();
eq(!!JSON.parse(localStorage.getItem('fin_state')).caminoPlan, true, 'el plan se guarda');
print((failures ? '✗ ' + failures + ' fallaron, ' : '✓ ') + passed + ' pruebas OK');
if (failures) throw new Error(failures + ' pruebas fallaron');
