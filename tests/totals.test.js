// Pruebas de la receta única de totales (js/totals.js).
// Correr desde la raíz del repo:  npm run test:totals

var window = this;
window.addEventListener = function(){};
var document = { getElementById: function(){ return null; }, querySelector: function(){ return null; }, querySelectorAll: function(){ return []; }, body: { classList: { contains: function(){ return false; } } } };
var localStorage = { getItem: function(){ return null; }, setItem: function(){} };
var console = { log: function(){}, info: function(){}, warn: function(){}, error: function(){} };
var state = { transactions: [], cuotas: [], subscriptions: [], fixedExpenses: [], dismissedAutoCuotas: [], autoCuotaConfig: {}, dismissedCommitmentEntries: [], usdRate: 1000 };
var USD_TO_ARS = 1000;
function dateToYMD(d){ const dt=d instanceof Date?d:new Date(d); return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); }
function saveState(){} function renderCuotas(){} function refreshAll(){} function showToast(){}
load('js/utils.js');
load('js/expenses.js');
load('js/totals.js');

let failures = 0, passed = 0;
function eq(actual, expected, msg){
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; return; }
  failures++; print('✗ ' + msg + '\n    esperado: ' + e + '\n    obtenido: ' + a);
}
function d(ymd){ return new Date(ymd + 'T12:00:00'); }
function tx(id, ymd, amount, extra){ return Object.assign({ id, date: d(ymd), description: id, amount, currency: 'ARS', category: 'Varios' }, extra || {}); }
function reset(){ state.transactions = []; state.cuotas = []; state.subscriptions = []; state.fixedExpenses = []; }
const OCT = { startStr: '2026-10-01', endStr: '2026-10-31', todayRef: d('2026-10-20') };
const CYCLE = { startStr: '2026-09-26', endStr: '2026-10-25', todayRef: d('2026-10-20') };

// 1) Filtro de tarjeta: cada tarjeta por separado
reset();
state.transactions = [
  tx('visa', '2026-10-02', 100, { payMethod: 'visa' }),
  tx('generica', '2026-10-03', 10, { payMethod: 'tc' }),
  tx('sinMedio', '2026-10-04', 1, {}),
  tx('amex', '2026-10-05', 1000, { payMethod: 'amex' }),
  tx('debito', '2026-10-06', 5000, { payMethod: 'deb' }),
  tx('efectivo', '2026-10-07', 50000, { payMethod: 'ef' }),
  tx('fuera', '2026-11-01', 9, { payMethod: 'visa' })
];
eq(getPeriodTotals(Object.assign({ card: 'visa' }, OCT)).ars, 111, 'Visa = visa + genérica + sin medio');
eq(getPeriodTotals(Object.assign({ card: 'amex' }, OCT)).ars, 1000, 'Amex = solo amex');
eq(getPeriodTotals(OCT).ars, 56111, 'mes sin tarjeta = todo lo del rango');

// 2) Gastos compartidos: tu parte vs. lo que cobra el banco
reset();
state.transactions = [tx('cena', '2026-10-10', 3000, { payMethod: 'visa', sharedExpense: { enabled: true, myAmount: 1000, splits: [] } })];
eq(getPeriodTotals(OCT).ars, 1000, 'modo personal usa tu parte');
eq(getPeriodTotals(Object.assign({ amountMode: 'full' }, OCT)).ars, 3000, 'modo full usa el monto completo');

// 3) Proyectados vencidos suman; los futuros no
reset();
state.subscriptions = [{ id: 's1', name: 'Netflix', price: 5000, currency: 'ARS', freq: 'monthly', day: 5, active: true, payMethod: 'visa' }];
state.fixedExpenses = [{ id: 'f1', name: 'Alquiler', amount: 400000, currency: 'ARS', day: 28 }];
let r = getPeriodTotals(OCT);
eq([r.real.count, r.projected.ars, r.ars], [0, 5000, 5000], 'Netflix vencida suma; alquiler del 28 todavía no');
r = getPeriodTotals(Object.assign({}, OCT, { todayRef: d('2026-10-30') }));
eq(r.ars, 405000, 'el 30/10 ya suma el alquiler');

// 4) El cargo real reemplaza al proyectado (sin duplicar)
state.transactions = [tx('netflix-real', '2026-10-05', 5100, { description: 'NETFLIX.COM', payMethod: 'visa' }), tx('alq', '2026-10-28', 400000, { description: 'Alquiler octubre', payMethod: 'deb' })];
r = getPeriodTotals(Object.assign({}, OCT, { todayRef: d('2026-10-30') }));
eq([r.real.ars, r.projected.ars, r.ars], [405100, 0, 405100], 'Netflix y alquiler reales: no se proyectan de nuevo');

// 5) Gastos fijos proyectados solo cuentan en una tarjeta si tienen ese medio explícito
reset();
state.fixedExpenses = [{ id: 'f1', name: 'Alquiler', amount: 400000, currency: 'ARS', day: 1 }, { id: 'f2', name: 'Gimnasio', amount: 30000, currency: 'ARS', day: 1, payMethod: 'visa' }];
eq(getPeriodTotals(Object.assign({ card: 'visa' }, CYCLE)).ars, 30000, 'ciclo Visa: solo el fijo pagado con Visa');
eq(getPeriodTotals(OCT).ars, 430000, 'mes: todos los fijos');

// 6) Cuotas: misma lógica que state.cuotas, por tarjeta y moneda
reset();
state.cuotas = [
  { id: 'c1', cuotaGroupId: 'g1', name: 'Notebook', amount: 2000, total: 12, paid: 5, day: 15, lastPaidDate: '2026-09-15', currency: 'ARS', payMethod: 'visa' },
  { id: 'c2', cuotaGroupId: 'g2', name: 'Pasaje', amount: 100, total: 3, paid: 1, day: 3, lastPaidDate: '2026-09-03', currency: 'USD', payMethod: 'amex' }
];
r = getPeriodTotals(Object.assign({ card: 'visa' }, CYCLE));
eq([r.ars, r.usd], [2000, 0], 'ciclo Visa: cuota 6/12 de la notebook');
r = getPeriodTotals(Object.assign({ card: 'amex' }, CYCLE));
eq([r.ars, r.usd], [0, 100], 'Amex: cuota en USD');
eq(Math.round(getPeriodTotals(OCT).totalArs), 102000, 'totalArs convierte USD con la cotización');

// 7) Categorías incluyen lo proyectado
r = getPeriodTotals(OCT);
const cats = getPeriodCategoryTotals(r.entries);
eq([cats['Cuotas']], [102000], 'categoría Cuotas en ARS');

// 8) Proyección: el alquiler no se multiplica por día; los compromisos futuros suman una vez
reset();
state.fixedExpenses = [{ id: 'f1', name: 'Alquiler', amount: 600000, currency: 'ARS', day: 1 }, { id: 'f2', name: 'Expensas', amount: 100000, currency: 'ARS', day: 25 }];
state.cuotas = [{ id: 'c1', cuotaGroupId: 'g1', name: 'Notebook', amount: 50000, total: 12, paid: 3, day: 15, lastPaidDate: '2026-09-15', currency: 'ARS' }];
state.transactions = [tx('super', '2026-10-05', 100000, { payMethod: 'visa' })];
const pr = getPeriodProjection(Object.assign({}, OCT, { todayRef: d('2026-10-10') }));
// gastado: super 100000 + alquiler 600000 · variable 100000 en 10 días → 10000/día × 21 días
// + compromisos futuros: cuota del 15 (50000) + expensas del 25 (100000)
eq([pr.spent, pr.variableSpent, pr.daysLeft, pr.futureCommitted, pr.projected], [700000, 100000, 21, 150000, 700000 + 210000 + 150000], 'proyección separa variable de compromisos');
const prPast = getPeriodProjection(Object.assign({}, OCT, { todayRef: d('2026-11-20') }));
eq([prPast.daysLeft, prPast.projected], [0, prPast.spent], 'período cerrado: proyección = gastado');

// 9) Una suscripción con su proyección guardada como movimiento no se cuenta dos veces
reset();
state.subscriptions = [{ id: 's1', name: 'Spotify', price: 5500, currency: 'ARS', freq: 'monthly', day: 1, active: true, payMethod: 'visa' }];
state.transactions = [{ id: 'proj_sub_s1_2026-11', date: d('2026-11-01'), description: 'Spotify (suscripción)', amount: 5500, currency: 'ARS', isPendingSubscription: true, sourceSubscriptionId: 's1', payMethod: 'visa' }];
eq(getPeriodTotals({ startStr: '2026-11-01', endStr: '2026-11-30', todayRef: d('2026-11-02') }).ars, 5500, 'Spotify vencida cuenta una sola vez');

print((failures ? '✗ ' + failures + ' fallaron, ' : '✓ ') + passed + ' pruebas OK');
if (failures) throw new Error(failures + ' pruebas fallaron');
