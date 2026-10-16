// Importación: duplicados entre Gmail y resumen, compras repetidas reales, cuotas y
// detección de suscripciones. Carga TODA la app (DOM falso) y usa el flujo real (finishImport).
// Correr desde la raíz del repo:  npm run test:importacion
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

// 1) Compra por Gmail y después el resumen: queda una sola, con el monto del resumen
reset();
state.transactions = [gmail('a1', '2026-10-05', 'COTO', 85000, { category: 'Supermercado', sharedExpense: { enabled: true, myAmount: 40000, splits: [] } })];
finishImport([stmt('a1', '2026-10-05', 'COTO SUC 123', 85000.5)], 'resumen.txt', 'pegado_manualmente');
eq(real().length, 1, 'Gmail + resumen de la misma compra = 1 movimiento');
eq([real()[0].amount, real()[0].category, real()[0].sharedExpense.myAmount, real()[0].statementConfirmed], [85000.5, 'Supermercado', 40000, true], 'manda el monto del resumen; se conservan categoría y reparto');

// 2) Dos compras distintas el mismo día y mismo monto en comercios distintos: no se fusionan
reset();
state.transactions = [gmail('b1', '2026-10-06', 'FARMACITY', 5000)];
finishImport([stmt('b1', '2026-10-06', 'KIOSCO EL SOL', 5000)], 'resumen.txt', 'pegado_manualmente');
eq(real().length, 2, 'distinto comercio = distinta compra');

// 3) Dos cafés idénticos en el MISMO resumen son reales; reimportar el resumen no duplica
reset();
finishImport([stmt('c1', '2026-10-07', 'CAFE MARTINEZ', 3000), stmt('c2', '2026-10-07', 'CAFE MARTINEZ', 3000)], 'resumen.txt', 'pegado_manualmente');
eq(real().length, 2, 'dos compras idénticas en el mismo resumen se conservan');
finishImport([stmt('c3', '2026-10-07', 'CAFE MARTINEZ', 3000), stmt('c4', '2026-10-07', 'CAFE MARTINEZ', 3000)], 'resumen.txt', 'pegado_manualmente');
eq(real().length, 2, 'reimportar el mismo resumen no agrega nada');

// 4) Una compra Uber por Gmail y DOS iguales en el resumen: empareja una sola
reset();
state.transactions = [gmail('u1', '2026-10-08', 'UBER', 4500)];
finishImport([stmt('u1', '2026-10-08', 'UBER *TRIP', 4500), stmt('u2', '2026-10-08', 'UBER *TRIP', 4500)], 'resumen.txt', 'pegado_manualmente');
eq(real().length, 2, 'Gmail(1) + resumen(2) iguales = 2 movimientos, no 3');

// 5) Cuota 1/6: el mail redondea (total/6) y el resumen trae el monto exacto → 1 movimiento, 1 plan
reset();
const g1 = gmail('q1', '2026-09-10', 'MERPAGO*TIENDAXYZ', 16667, { cuotaNum: 1, cuotaTotal: 6, cuotaGroupId: 'cg_merpagotiendax_16667_6' });
finishImport([g1], 'gmail', 'importado_desde_gmail');
finishImport([stmt('q1', '2026-09-10', 'MERCADOPAGO*TIENDAXYZ (Cuota 1/6)', 16666.67, { _baseDesc: 'MERCADOPAGO*TIENDAXYZ', cuotaNum: 1, cuotaTotal: 6, cuotaGroupId: 'cg_mercadopagotien_16666.67_6' })], 'resumen.txt', 'pegado_manualmente');
eq([real().length, state.cuotas.length], [1, 1], 'cuota 1 por Gmail y por resumen = 1 movimiento y 1 plan');
// el mes siguiente llega la cuota 2 en el resumen: se suma al mismo plan
finishImport([stmt('q2', '2026-10-10', 'MERCADOPAGO*TIENDAXYZ (Cuota 2/6)', 16666.67, { _baseDesc: 'MERCADOPAGO*TIENDAXYZ', cuotaNum: 2, cuotaTotal: 6, cuotaGroupId: 'cg_mercadopagotien_16666.67_6' })], 'resumen.txt', 'pegado_manualmente');
eq([real().length, state.cuotas.length, getCuotaStatus(state.cuotas[0], D('2026-10-12')).paid], [2, 1, 2], 'cuota 2 del resumen: 2 movimientos, el mismo plan en 2/6');
const oct = getPeriodTotals({ startStr: '2026-10-01', endStr: '2026-10-31', todayRef: D('2026-10-20') });
eq(Math.round(oct.ars), 16667, 'octubre: la cuota 2 cuenta una sola vez (real, sin proyección extra)');

// 6) Gmail después del resumen: el control de duplicados lo detecta aunque el mail redondee
reset();
finishImport([stmt('r1', '2026-10-03', 'MERCADOPAGO*TIENDAXYZ (Cuota 1/3)', 33333.33, { _baseDesc: 'MERCADOPAGO*TIENDAXYZ', cuotaNum: 1, cuotaTotal: 3 })], 'resumen.txt', 'pegado_manualmente');
const dup = findPossibleDuplicates([gmail('r1', '2026-10-03', 'MERPAGO*TIENDAXYZ', 33333, { cuotaNum: 1, cuotaTotal: 3 })]);
eq(dup.conflicts.length, 1, 'Gmail que llega después del resumen se marca como posible duplicado');

// 7) Suscripciones: el prefijo del procesador no confunde comercios
reset();
const spotify = { id: 's1', name: 'MERPAGO*SPOTIFY', price: 5500, currency: 'ARS', freq: 'monthly', day: 5, active: true };
eq(txnMatchesSubscription(stmt('s1', '2026-10-05', 'MERPAGO*SUBE CARGA', 5000), spotify), false, 'una carga de SUBE no es Spotify');
eq(txnMatchesSubscription(stmt('s2', '2026-10-05', 'DLO*SPOTIFY P3A8', 5500), spotify), true, 'Spotify por otro procesador se reconoce');
eq(txnMatchesSubscription(stmt('s3', '2026-10-05', 'MERPAGO*SPOTIFY P1234', 5500), spotify), true, 'Spotify con código se reconoce');
const netflix = { id: 's2', name: 'Netflix', price: 9000, currency: 'ARS', freq: 'monthly', day: 12, active: true };
eq(txnMatchesSubscription(stmt('s4', '2026-10-12', 'NETFLIX.COM', 9000), netflix), true, 'Netflix.com = Netflix');
eq(txnMatchesSubscription(stmt('s5', '2026-10-12', 'NETSHOES', 9000), netflix), false, 'Netshoes no es Netflix');
// Spotify proyectada no desaparece por una carga de SUBE
state.subscriptions = [spotify];
state.transactions = [stmt('s6', '2026-10-03', 'MERPAGO*SUBE CARGA', 5000, { category: 'Transporte' })];
const subs = getProjectedCommitmentEntriesForRange({ startStr: '2026-10-01', endStr: '2026-10-31', todayRef: D('2026-10-20') }).filter(e => e.group === 'suscripciones');
eq(subs.length, 1, 'Spotify sigue proyectada aunque haya una carga de SUBE');

// 8) Detección de cuotas en imports de resumen (CSV / texto genérico)
eq(detectCuotaInfo('FRAVEGA CTA 03/12'), { num: 3, total: 12 }, '"CTA 03/12" es la cuota 3 de 12');
eq(detectCuotaInfo('NOTEBOOK CUOTA 2 DE 6'), { num: 2, total: 6 }, '"CUOTA 2 DE 6"');
eq(detectCuotaInfo('GARBARINO C.04/18'), { num: 4, total: 18 }, '"C.04/18"');
eq(detectCuotaInfo('PAGO SEGURO 15/10'), null, '"15/10" no es una cuota (15 > 10)');
eq(detectCuotaInfo('KIOSCO 24HS'), null, 'sin cuota');

// 9) Cuota 3/12 que el resumen trae con la fecha de compra (agosto) → va al período del resumen
reset();
finishImport([
  stmt('f1', '2026-08-15', 'FRAVEGA CTA 03/12', 50000),
  stmt('f2', '2026-10-20', 'COTO', 12000)
], 'resumen.csv', 'importado_desde_resumen');
const fr = real().find(t => /FRAVEGA/.test(t.description));
eq([fr.cuotaNum, fr.cuotaTotal, dateToYMD(fr.date), dateToYMD(fr._originalDate)], [3, 12, '2026-10-15', '2026-08-15'], 'cuota 3/12 movida a octubre, fecha original guardada');
eq(state.cuotas.map(c => [getCuotaStatus(c, D('2026-10-20')).paid, c.total, c.lastPaidDate]), [[3, 12, '2026-10-15']], 'se crea el plan en 3/12 anclado en octubre');
const nov = getPeriodTotals({ startStr: '2026-11-01', endStr: '2026-11-30', todayRef: D('2026-11-20') });
eq(nov.projected.ars, 50000, 'noviembre proyecta la cuota 4/12 una vez');

// 10) Borrar una cuota con cuotas ya pagas: conservar o no el historial
reset();
const mkc = id => ({ id, name: 'TV ' + id, amount: 20000, total: 6, paid: 2, day: 5, lastPaidDate: '2026-10-05', currency: 'ARS' });
state.cuotas = [mkc('k1'), mkc('k2')];
eq(countManualCuotaHistory(state.cuotas[0]), 2, 'detecta 2 cuotas pagas sin movimiento');
deleteManualCuotaById('k1', { silent: true, keepHistory: true });
eq(real().filter(t => /TV k1/.test(t.description)).length, 2, 'Conservar: quedan las 2 cuotas como gastos');
deleteManualCuotaById('k2', { silent: true, keepHistory: false });
eq([real().filter(t => /TV k2/.test(t.description)).length, state.cuotas.length], [0, 0], 'Borrar todo: no queda ningún gasto');

// 11) Compras en cuotas por Gmail: cada mail es una compra nueva (cuota 1), aunque se repita
reset();
// el cuerpo del mail va en texto plano (getEmailBody decodifica base64 en el navegador)
getEmailBody = payload => payload.plainText;
const mailCuota = (id, dmy) => ({ id, payload: { headers: [
  { name: 'Subject', value: 'Pagaste $30.000 con tu tarjeta' }, { name: 'Date', value: 'Mon, 5 Oct 2026 10:00:00 -0300' }],
  plainText: 'Comercio\nREMERAS SA\nFecha\n' + dmy + '\nHora\n10:00\nCuotas\n3\nTarjeta Santander Visa terminada en 3177' } });
const p1 = parseSantanderEmail(mailCuota('m1', '05/10/2026'), [], null);
const p2 = parseSantanderEmail(mailCuota('m2', '05/10/2026'), [p1], null);
eq([p1 && p1.cuotaNum, p1 && p1.cuotaTotal, p1 && p1.amount, p2 && p2.cuotaNum], [1, 3, 10000, 1], 'mail en 3 cuotas: cuota 1 de 3, monto por cuota; el segundo mail igual también es cuota 1');
eq(!!(p1 && p2 && p1.cuotaGroupId !== p2.cuotaGroupId), true, 'dos compras iguales = dos planes distintos');
if (p1 && p2) {
  finishImport([Object.assign(p1, { category: 'Ropa' }), Object.assign(p2, { category: 'Ropa' })], 'gmail', 'importado_desde_gmail');
  eq(state.cuotas.length, 2, 'se crean 2 planes, no uno en cuota 2');
  // el mes siguiente no llega mail: las cuotas avanzan solas
  eq(state.cuotas.map(c => getCuotaStatus(c, D('2026-11-20')).paid), [2, 2], 'en noviembre cada plan va 2/3 sin mail nuevo');
  eq(state.cuotas.map(c => getCuotaStatus(c, D('2027-01-20')).rem), [0, 0], 'en enero ambos terminaron');
  // un tercer mail igual un mes después: tampoco se pega a los anteriores
  const p3 = parseSantanderEmail(mailCuota('m3', '05/11/2026'), [], null);
  finishImport([Object.assign(p3, { category: 'Ropa' })], 'gmail', 'importado_desde_gmail');
  eq([state.cuotas.length, getCuotaStatus(state.cuotas[2], D('2026-11-20')).paid], [3, 1], 'compra igual al mes siguiente: plan nuevo en 1/3');
}

// 12) Datos viejos: dos compras por Gmail que habían quedado en un mismo plan como "cuota 1" y "cuota 2"
reset();
state.transactions = [
  gmail('v1', '2026-08-03', 'REMERAS SA', 10000, { cuotaNum: 1, cuotaTotal: 3, cuotaGroupId: 'cg_remerassa_10000_3' }),
  gmail('v2', '2026-09-20', 'REMERAS SA', 10000, { cuotaNum: 2, cuotaTotal: 3, cuotaGroupId: 'cg_remerassa_10000_3' })
];
state.cuotas = [{ id: 'auto_cg_remerassa_10000_3', cuotaGroupId: 'cg_remerassa_10000_3', name: 'Remeras', emoji: '👕', amount: 10000, total: 3, paid: 2, day: 20, lastPaidDate: '2026-09-20', currency: 'ARS', payMethod: 'visa', source: 'auto-import' }];
migrateCuotasToSingleSource();
eq(state.cuotas.length, 2, 'migración: se separan en 2 planes');
eq(state.cuotas.map(c => [c.name, c.emoji, getCuotaStatus(c, D('2026-10-25')).paid]).sort(), [['Remeras', '👕', 2], ['Remeras', '👕', 3]].sort(), 'cada plan conserva nombre/emoji y su propio calendario');
eq(real().map(t => t.cuotaNum), [1, 1], 'los dos movimientos quedan como cuota 1');
migrateCuotasToSingleSource();
eq(state.cuotas.length, 2, 'la migración no vuelve a cambiar nada');

print((failures ? '✗ ' + failures + ' fallaron, ' : '✓ ') + passed + ' pruebas OK');
if (failures) throw new Error(failures + ' pruebas fallaron');
