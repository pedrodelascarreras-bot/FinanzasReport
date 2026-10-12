// Pruebas de la lógica de cuotas (fuente única state.cuotas).
// Correr desde la raíz del repo con JavaScriptCore (viene con macOS):
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/cuotas.test.js
// Carga utils.js y expenses.js con stubs mínimos del navegador.

var window = this;
window.addEventListener = function(){};
var document = { getElementById: function(){ return null; }, querySelector: function(){ return null; }, querySelectorAll: function(){ return []; }, body: { classList: { contains: function(){ return false; } } } };
var localStorage = { getItem: function(){ return null; }, setItem: function(){} };
var console = { log: function(){}, info: function(){}, warn: function(){}, error: function(){} };
var state = { transactions: [], cuotas: [], subscriptions: [], fixedExpenses: [], dismissedAutoCuotas: [], autoCuotaConfig: {}, dismissedCommitmentEntries: [] };
function dateToYMD(d){ const dt=d instanceof Date?d:new Date(d); return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); }
function saveState(){}
function renderCuotas(){}
function refreshAll(){}
function showToast(){}
load('js/utils.js');
load('js/expenses.js');

let failures = 0, passed = 0;
function eq(actual, expected, msg){
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; return; }
  failures++; print('✗ ' + msg + '\n    esperado: ' + e + '\n    obtenido: ' + a);
}
function d(ymd){ return new Date(ymd + 'T12:00:00'); }
function reset(){ state.transactions = []; state.cuotas = []; state.dismissedAutoCuotas = []; state.autoCuotaConfig = {}; }
function realTxn(id, ymd, num, total, amount, groupId, extra){
  return Object.assign({ id, date: d(ymd), month: ymd.slice(0,7), description: 'Notebook (Cuota ' + num + '/' + total + ')', _baseDesc: 'Notebook', amount, currency: 'ARS', cuotaNum: num, cuotaTotal: total, cuotaGroupId: groupId }, extra || {});
}
function cuotaEntries(startStr, endStr, today){
  return getProjectedCommitmentEntriesForRange({ startStr, endStr, todayRef: d(today), txns: state.transactions }).filter(e => e.group === 'cuotas');
}

// 1) El contador de pagadas avanza solo con el tiempo
reset();
state.cuotas = [{ id: 'c1', name: 'Notebook', amount: 1000, total: 12, paid: 3, day: 15, lastPaidDate: '2026-08-15', currency: 'ARS' }];
let st = getCuotaStatus(state.cuotas[0], d('2026-10-12'));
eq([st.paid, st.rem, dateToYMD(st.nextDate)], [4, 8, '2026-10-15'], 'paid avanza con el calendario (3 en ago → 4 al 12/oct)');
st = getCuotaStatus(state.cuotas[0], d('2026-10-15'));
eq(st.paid, 5, 'el día del vencimiento la cuota cuenta como paga');
eq(dateToYMD(st.endDate), '2027-05-15', 'fecha de fin = cuota 12');

// 2) Nunca se proyecta más allá de la última cuota
reset();
state.cuotas = [{ id: 'c2', name: 'Silla', amount: 500, total: 12, paid: 11, day: 10, lastPaidDate: '2026-09-10', currency: 'ARS' }];
eq(cuotaEntries('2026-10-01', '2026-10-31', '2026-10-12').map(e => e.meta), ['Cuota 12/12'], 'octubre proyecta la 12/12');
eq(cuotaEntries('2026-11-01', '2026-11-30', '2026-10-12').length, 0, 'noviembre ya no proyecta nada');
eq(cuotaEntries('2026-10-01', '2027-03-31', '2026-10-12').length, 1, 'rango de 6 meses proyecta solo 1 cuota restante');

// 3) Un cargo real del resumen no se suma dos veces
reset();
state.cuotas = [{ id: 'auto_g1', cuotaGroupId: 'g1', name: 'Notebook', amount: 1000, total: 6, paid: 2, day: 5, lastPaidDate: '2026-09-05', currency: 'ARS' }];
state.transactions = [realTxn('t3', '2026-10-05', 3, 6, 1000, 'g1')];
eq(cuotaEntries('2026-09-26', '2026-10-25', '2026-10-12').length, 0, 'ciclo con la cuota real importada: no se proyecta otra');
state.transactions = [];
let entries = cuotaEntries('2026-09-26', '2026-10-25', '2026-10-12');
eq([entries.length, entries[0] && entries[0].meta, entries[0] && entries[0].includeInTotal], [1, 'Cuota 3/6', true], 'sin el cargo real: se proyecta 1 y cuenta (ya venció)');

// 4) Migración: cuotas detectadas desde movimientos → state.cuotas; proyecciones viejas afuera
reset();
state.transactions = [
  realTxn('a', '2026-07-20', 3, 12, 2000, 'g2'),
  realTxn('b', '2026-08-20', 4, 12, 2000, 'g2'),
  realTxn('c', '2026-09-20', 5, 12, 2000, 'g2'),
  { id: 'p', date: d('2026-10-20'), amount: 2000, currency: 'ARS', isPendingCuota: true, cuotaGroupId: 'g2', cuotaNum: 6, cuotaTotal: 12 }
];
migrateCuotasToSingleSource();
eq(state.cuotas.map(c => [c.cuotaGroupId, c.paid, c.total, c.lastPaidDate, c.day]), [['g2', 5, 12, '2026-09-20', 20]], 'arranque a mitad del plan: toma la 5/12 (antes decía 3)');
eq(state.transactions.some(t => t.isPendingCuota), false, 'se borran las proyecciones viejas guardadas como movimientos');
migrateCuotasToSingleSource();
eq(state.cuotas.length, 1, 'la migración es idempotente');

// 5) Cuotas en USD: el monto queda en USD
reset();
state.transactions = [realTxn('u', '2026-09-03', 2, 3, 50, 'g3', { currency: 'USD' })];
migrateCuotasToSingleSource();
eq([state.cuotas[0].amount, state.cuotas[0].currency], [50, 'USD'], 'cuota USD conserva monto y moneda');
entries = cuotaEntries('2026-10-01', '2026-10-31', '2026-10-12');
eq([entries[0].amount, entries[0].currency, entries[0].meta], [50, 'USD', 'Cuota 3/3'], 'proyección USD');

// 6) Un plan borrado por el usuario no vuelve al reimportar
reset();
state.transactions = [realTxn('x', '2026-09-08', 1, 3, 300, 'g4')];
migrateCuotasToSingleSource();
deleteManualCuotaById('auto_g4', { silent: true });
upsertCuotasFromTxns([realTxn('y', '2026-10-08', 2, 3, 300, 'g4')]);
eq(state.cuotas.length, 0, 'plan borrado no se recrea');

// 7) Reimportar un resumen viejo no hace retroceder el plan; uno nuevo lo re-ancla
reset();
state.cuotas = [{ id: 'auto_g5', cuotaGroupId: 'g5', name: 'TV', amount: 100, total: 10, paid: 6, day: 1, lastPaidDate: '2026-09-01', currency: 'ARS' }];
upsertCuotasFromTxns([realTxn('o', '2026-07-01', 4, 10, 100, 'g5')]);
eq([state.cuotas[0].paid, state.cuotas[0].lastPaidDate], [6, '2026-09-01'], 'resumen viejo no retrocede');
upsertCuotasFromTxns([realTxn('n', '2026-10-01', 7, 10, 100, 'g5')]);
eq([state.cuotas[0].paid, state.cuotas[0].lastPaidDate], [7, '2026-10-01'], 'resumen nuevo re-ancla');

// 8) Cuota cargada a mano sin fecha: "pagadas" se toma a hoy y después avanza sola
reset();
state.cuotas = [{ id: 'm1', name: 'Curso', amount: 800, total: 5, paid: 2, day: 10 }];
migrateCuotasToSingleSource();
const realToday = new Date();
st = getCuotaStatus(state.cuotas[0], realToday);
eq(st.paid, 2, 'manual sin fecha: a hoy sigue en 2 pagas');
const anchor = d(state.cuotas[0].lastPaidDate);
st = getCuotaStatus(state.cuotas[0], new Date(anchor.getFullYear(), anchor.getMonth() + 2, 28));
eq(st.paid, 4, 'dos vencimientos después: 4 pagas');

// 9) Misma compra por Gmail (cuota 1, monto redondeado) y por resumen (cuota 3, monto exacto)
reset();
const gmail = { id: 'gm', date: d('2026-08-10'), description: 'MERPAGO*TIENDAXYZ', _baseDesc: 'MERPAGO*TIENDAXYZ', amount: 16667, currency: 'ARS', cuotaNum: 1, cuotaTotal: 6, cuotaGroupId: 'cg_merpagotiendax_16667_6' };
state.transactions = [gmail];
upsertCuotasFromTxns([gmail]);
const resumen = { id: 'rs', date: d('2026-10-10'), description: 'MERCADOPAGO*TIENDAXYZ (Cuota 3/6)', _baseDesc: 'MERCADOPAGO*TIENDAXYZ', amount: 16666.67, currency: 'ARS', cuotaNum: 3, cuotaTotal: 6, cuotaGroupId: 'cg_mercadopagotien_16666.67_6' };
state.transactions.push(resumen);
upsertCuotasFromTxns([resumen]);
eq(state.cuotas.length, 1, 'Gmail + resumen de la misma compra = un solo plan');
eq([state.cuotas[0].paid, state.cuotas[0].lastPaidDate, resumen.cuotaGroupId], [3, '2026-10-10', 'cg_merpagotiendax_16667_6'], 'el resumen re-ancla el plan y queda vinculado');
eq(cuotaEntries('2026-10-01', '2026-10-31', '2026-10-20').length, 0, 'octubre: la cuota real del resumen no se proyecta de nuevo');

// 10) Otra compra en el mismo comercio pero distinto monto: plan aparte
const otra = { id: 'ot', date: d('2026-10-12'), description: 'MERPAGO*TIENDAXYZ', _baseDesc: 'MERPAGO*TIENDAXYZ', amount: 5000, currency: 'ARS', cuotaNum: 1, cuotaTotal: 6, cuotaGroupId: 'cg_merpagotiendax_5000_6' };
upsertCuotasFromTxns([otra]);
eq(state.cuotas.length, 2, 'distinto monto = plan distinto');

// 11) Duplicados ya guardados de imports anteriores se fusionan al cargar
reset();
state.cuotas = [
  { id: 'auto_a', cuotaGroupId: 'ga', name: 'MERPAGO*TIENDAXYZ', amount: 16667, total: 6, paid: 1, day: 10, lastPaidDate: '2026-08-10', currency: 'ARS' },
  { id: 'auto_b', cuotaGroupId: 'gb', name: 'MERCADOPAGO*TIENDAXYZ', amount: 16666.67, total: 6, paid: 3, day: 10, lastPaidDate: '2026-10-10', currency: 'ARS' }
];
state.transactions = [{ id: 'x1', date: d('2026-10-10'), description: 'MERCADOPAGO*TIENDAXYZ', amount: 16666.67, currency: 'ARS', cuotaNum: 3, cuotaTotal: 6, cuotaGroupId: 'gb' }];
migrateCuotasToSingleSource();
eq(state.cuotas.map(c => [c.id, c.paid, c.lastPaidDate]), [['auto_a', 3, '2026-10-10']], 'se fusionan y queda el calendario más reciente');
eq(state.transactions[0].cuotaGroupId, 'ga', 'los movimientos pasan al plan que queda');

// 12) Cuota cargada a mano + después importada del resumen: no se duplica
reset();
state.cuotas = [{ id: 'm9', name: 'Heladera Garbarino', amount: 50000, total: 12, paid: 2, day: 5, lastPaidDate: '2026-09-05', currency: 'ARS' }];
const imp = { id: 'h', date: d('2026-10-05'), description: 'GARBARINO HELADERA (Cuota 3/12)', _baseDesc: 'GARBARINO HELADERA', amount: 50000, currency: 'ARS', cuotaNum: 3, cuotaTotal: 12, cuotaGroupId: 'cg_garbarinohelad_50000_12' };
eq(cuotaMerchantsMatch('Heladera Garbarino', 'GARBARINO HELADERA'), true, 'mismo comercio con palabras en otro orden');
state.transactions = [imp];
upsertCuotasFromTxns([imp]);
eq([state.cuotas.length, state.cuotas[0].cuotaGroupId, state.cuotas[0].paid], [1, 'cg_garbarinohelad_50000_12', 3], 'la cuota manual adopta el plan importado');

print((failures ? '✗ ' + failures + ' fallaron, ' : '✓ ') + passed + ' pruebas OK');
if (failures) throw new Error(failures + ' pruebas fallaron');
