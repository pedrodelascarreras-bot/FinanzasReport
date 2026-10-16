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

// 13) Mails reales de Santander (misma estructura HTML): compra, compra en cuotas y débito automático
reset();
const ROW = (label, value) => '<div style="padding: 15.5px 0px; width: 288px; border-bottom: 1px solid rgb(219, 222, 225);"><div style="min-width: 50%; max-width: 50%; display: inline-block; white-space: pre-wrap; vertical-align: middle; text-align: left;">' + label + '</div><div style="min-width: 50%; max-width: 50%; display: inline-block; white-space: pre-wrap; vertical-align: middle; text-align: right;"><strong style="font-weight: bold;">' + value + '</strong></div></div>';
const santanderHtml = (intro, rows) => '<html><head><title>2225 Aviso</title></head><body><h2>Información sobre tu pago</h2><p style="margin: 0px;">' + intro +
  '\r\n <strong style="font-weight: 600;">Tarjeta Santander Visa Crédito</strong> terminada en\r\n <strong style="font-weight: 600;">3177.</strong></p><div><table><div>' +
  rows.map(r => ROW(r[0], r[1])).join('') + '</div></table></div><p>Si vos no hiciste este pago, <strong style="font-weight: 600;">te pedimos que denuncies la tarjeta</strong> ingresando a la sección Tarjetas desde <strong style="font-weight: 600;">Online Banking</strong> o la <strong style="font-weight: 600;">App Santander.</strong></p></body></html>';
const realMail = (id, subject, dateHeader, html) => ({ id, payload: { headers: [{ name: 'Subject', value: subject }, { name: 'Date', value: dateHeader }], plainText: html } });
const compra = parseSantanderEmail(realMail('r-compra', 'Pagaste $193.651,90', 'Thu, 8 Oct 2026 17:53:10 -0300',
  santanderHtml('Te acercamos el detalle de tu consumo con la', [['Monto', '$193.651,90'], ['Cuotas', '1'], ['Comercio', 'MERPAGO*FALCOM ARIAFERN'], ['Fecha', '08/10/2026'], ['Hora', '17:53']])), [], getDefaultGmailImportRules()[0]);
eq([compra.amount, compra.currency, compra.description, dateToYMD(compra.date), compra.txnTime, compra.payMethod, compra.cuotaTotal, compra.isAutoDebit],
   [193651.9, 'ARS', 'MERPAGO*FALCOM ARIAFERN', '2026-10-08', '17:53', 'visa', undefined, false], 'compra común: monto, comercio, fecha, hora, Visa, sin cuotas');
const enCuotas = parseSantanderEmail(realMail('r-cuotas', 'Pagaste $1.007.880,00', 'Thu, 29 Jan 2026 17:45:00 -0300',
  santanderHtml('Te acercamos el detalle de tu consumo con la', [['Monto', '$1.007.880,00'], ['Cuotas', '12'], ['Comercio', 'MEGATLON MARTINEZ'], ['Fecha', '29/01/2026'], ['Hora', '17:45']])), [], getDefaultGmailImportRules()[0]);
eq([enCuotas.amount, enCuotas.cuotaNum, enCuotas.cuotaTotal, enCuotas.cuotaTotalAmount, enCuotas.description],
   [83990, 1, 12, 1007880, 'MEGATLON MARTINEZ'], 'compra en 12 cuotas: cuota 1/12 de $83.990');
finishImport([compra, enCuotas], 'gmail', 'importado_desde_gmail');
const megatlon = state.cuotas.find(c => /MEGATLON/.test(c.name));
eq([!!megatlon, megatlon && getCuotaStatus(megatlon, D('2026-10-16')).paid, megatlon && megatlon.payMethod], [true, 9, 'visa'], 'Megatlon: en octubre va 9/12 sin ningún mail nuevo');
const debito = (id, monto, comercio, fecha, hora) => parseSantanderEmail(realMail(id, 'Aviso de débito automático', 'Fri, 9 Oct 2026 05:36:00 -0300',
  santanderHtml('Te acercamos el detalle del débito con tu', [['Monto', monto], ['Comercio', comercio], ['Fecha', fecha], ['Hora', hora]])), [], getDefaultGmailImportRules()[0]);
const bibop = debito('r-deb1', '$42.658,00', 'BIBOP SA', '09/10/2026', '05:36');
eq([bibop.amount, bibop.currency, bibop.description, bibop.isAutoDebit, bibop.importKind, bibop.subscriptionDay], [42658, 'ARS', 'BIBOP SA', true, 'subscription', 9],
   'débito automático: es suscripción aunque venga por la regla de compras');
const claude = debito('r-deb2', 'U$S20,00', 'ANTHROPIC* CLAUDE SUB', '04/10/2026', '12:21');
eq([claude.amount, claude.currency], [20, 'USD'], 'débito en dólares');
finishImport([bibop, claude], 'gmail', 'importado_desde_gmail');
eq(state.subscriptions.map(s => [s.name, s.price, s.currency, s.day]).sort(), [['ANTHROPIC* CLAUDE SUB', 20, 'USD', 4], ['BIBOP SA', 42658, 'ARS', 9]], 'se crean las 2 suscripciones');
eq(getDefaultGmailImportRules().some(r => /débito automático/.test(r.query)), true, 'la regla de débitos automáticos viene por defecto');

// 14) LinkedIn cambia el número de referencia cada mes: sigue siendo UNA suscripción
reset();
finishImport([debito('li1', 'U$S1,22', 'LinkedIn*P3048105918', '06/07/2026', '21:00')], 'gmail', 'importado_desde_gmail');
finishImport([debito('li2', 'U$S1,21', 'LinkedIn*P3066131454', '06/08/2026', '21:00')], 'gmail', 'importado_desde_gmail');
finishImport([debito('li3', 'U$S1,20', 'LinkedIn*P3083413982', '06/09/2026', '21:00')], 'gmail', 'importado_desde_gmail');
eq([state.subscriptions.length, state.subscriptions[0].price], [1, 1.2], 'LinkedIn: 1 suscripción con el último precio');

// 15) Apple tiene DOS suscripciones (U$S 1,99 el 25 y U$S 9,99 el 30): no se mezclan
reset();
finishImport([
  debito('ap1', 'U$S9,99', 'APPLECOMBILL', '31/08/2026', '11:25'), debito('ap2', 'U$S1,99', 'APPLECOMBILL', '25/08/2026', '04:51'),
  debito('ap3', 'U$S9,99', 'APPLECOMBILL', '30/09/2026', '11:26'), debito('ap4', 'U$S1,99', 'APPLECOM BILL', '25/09/2026', '04:51')
], 'gmail', 'importado_desde_gmail');
eq(state.subscriptions.map(s => [s.price, s.day]).sort((a, b) => a[0] - b[0]), [[1.99, 25], [9.99, 30]], 'Apple: 2 suscripciones, cada una con su precio y día');
// un mail viejo importado después no pisa el precio actual
finishImport([debito('ap0', 'U$S9,99', 'APPLECOMBILL', '31/07/2026', '11:25')], 'gmail', 'importado_desde_gmail');
eq([state.subscriptions.length, state.subscriptions.find(s => s.price === 9.99)?.lastChargeDate], [2, '2026-09-30'], 'mail viejo: no crea otra ni retrocede la fecha');

// 16) Datos viejos: LinkedIn repetido y Apple mezclado se arreglan al cargar
reset();
state.subscriptions = [
  { id: 'sub_auto_linkedinp1_gmail', name: 'LinkedIn*P3048105918', merchantKey: 'linkedinp3048105918', price: 1.22, currency: 'USD', freq: 'monthly', day: 6, active: true, autoManaged: true, emoji: '💼' },
  { id: 'sub_auto_linkedinp2_gmail', name: 'LinkedIn*P3066131454', merchantKey: 'linkedinp3066131454', price: 1.21, currency: 'USD', freq: 'monthly', day: 6, active: true, autoManaged: true },
  { id: 'sub_auto_apple_gmail', name: 'APPLECOMBILL', merchantKey: 'applecombill', price: 9.99, currency: 'USD', freq: 'monthly', day: 30, active: true, autoManaged: true, emoji: '🍎' }
];
const old = (id, ymd, amount, desc, subId) => gmail(id, ymd, desc, amount, { currency: 'USD', isAutoDebit: true, sourceSubscriptionId: subId });
state.transactions = [
  old('l1', '2026-07-06', 1.22, 'LinkedIn*P3048105918', 'sub_auto_linkedinp1_gmail'), old('l2', '2026-08-06', 1.21, 'LinkedIn*P3066131454', 'sub_auto_linkedinp2_gmail'),
  old('a1', '2026-08-25', 1.99, 'APPLECOMBILL', 'sub_auto_apple_gmail'), old('a2', '2026-08-31', 9.99, 'APPLECOMBILL', 'sub_auto_apple_gmail'),
  old('a3', '2026-09-25', 1.99, 'APPLECOM BILL', 'sub_auto_apple_gmail'), old('a4', '2026-09-30', 9.99, 'APPLECOMBILL', 'sub_auto_apple_gmail')
];
normalizeImportedSubscriptions();
const li = state.subscriptions.filter(s => /linkedin/i.test(s.name));
const ap = state.subscriptions.filter(s => /apple/i.test(s.name)).sort((a, b) => a.price - b.price);
eq([li.length, li[0].emoji, li[0].price], [1, '💼', 1.21], 'LinkedIn: queda 1, conserva el emoji, último precio');
eq(ap.map(s => [s.price, s.day, s.emoji]), [[1.99, 25, '🍎'], [9.99, 30, '🍎']], 'Apple: se separa en 1,99 y 9,99');
eq(state.transactions.filter(t => t.sourceSubscriptionId === ap[0].id).map(t => t.amount), [1.99, 1.99], 'los cobros de 1,99 quedan en su suscripción');
normalizeImportedSubscriptions(); // LinkedIn (último cobro en agosto) queda pausada
eq(normalizeImportedSubscriptions(), false, 'después no cambia nada');

// 17) "Tu resumen vence pronto" menciona "débito automático": NO es un gasto aunque lo traiga la regla de débitos
reset();
const aviso = parseSantanderEmail(realMail('r-resumen', 'Tu resumen vence pronto', 'Wed, 7 Oct 2026 02:04:45 -0300',
  '<p>Te recordamos que el resumen de tu Tarjeta Santander Visa terminada en 3177 vence el 09/10/2026.</p><p>Monto en pesos $ 6.654.397,34 Monto en dólares U$S 5.919,52 Forma de pago Débito automático por el pago total</p>'),
  [], { id: 'r1', name: 'Debito Automatico', query: 'Aviso de débito automático' });
eq(aviso, null, 'aviso de resumen: se ignora');
state.gmailImportRules = [{ id: 'r1', name: 'Debito Automatico', query: 'Aviso de débito automático' }];
ensureGmailImportRules();
eq(state.gmailImportRules.map(r => r.query), ['subject:"Aviso de débito automático"'], 'la regla de débitos sin subject: se acota al asunto');
// datos viejos: el aviso importado como suscripción "Santander" se borra al cargar
state.subscriptions = [{ id: 'sub_auto_santander_r1', name: 'Santander', price: 6654397.34, currency: 'ARS', freq: 'monthly', day: 7, active: true, autoManaged: true, lastChargeDate: '2026-10-07' }];
state.transactions = [
  gmail('res1', '2026-10-07', 'Santander', 6654397.34, { isAutoDebit: true, gmailMerchantRaw: 'Santander', sourceSubscriptionId: 'sub_auto_santander_r1' }),
  { id: 'proj_sub_santander_nov', date: D('2026-11-07'), description: 'Santander', amount: 6654397.34, currency: 'ARS', isPendingSubscription: true, sourceSubscriptionId: 'sub_auto_santander_r1' },
  gmail('ok1', '2026-10-09', 'BIBOP SA', 42658, { isAutoDebit: true, gmailMerchantRaw: 'BIBOP SA' })
];
normalizeImportedSubscriptions();
eq([state.subscriptions.length, state.transactions.map(t => t.id)], [0, ['gmail_ok1']], 'se borran el aviso, la suscripción falsa y sus proyecciones; el débito real queda');

// 18) Suscripción de Gmail dada de baja: si no llega el débito no se cuenta
reset();
state.subscriptions = [
  { id: 'par', name: 'PARAMOUNT', price: 3.78, currency: 'USD', freq: 'monthly', day: 9, active: true, autoManaged: true, payMethod: 'visa', lastChargeDate: '2026-07-09' },
  { id: 'li', name: 'LinkedIn', price: 1.2, currency: 'USD', freq: 'monthly', day: 6, active: true, autoManaged: true, payMethod: 'visa', lastChargeDate: '2026-09-06' },
  { id: 'cl', name: 'CLAUDE', price: 20, currency: 'USD', freq: 'monthly', day: 15, active: true, autoManaged: true, payMethod: 'visa', lastChargeDate: '2026-09-15' }
];
const cyc = getPeriodTotals({ card: 'visa', startStr: '2026-09-30', endStr: '2026-10-29', todayRef: D('2026-10-16') });
eq(cyc.usd, 20, 'Paramount (sin cobros desde julio) y LinkedIn (no llegó el 6/10) no suman; Claude del 15/10 sí (margen de 3 días)');
const novEntries = getProjectedCommitmentEntriesForRange({ startStr: '2026-10-30', endStr: '2026-11-29', todayRef: D('2026-10-16') });
eq(novEntries.map(e => e.title).sort(), ['CLAUDE', 'LinkedIn'], 'a futuro se proyectan las activas; Paramount no');

// 19) Un gasto de Gmail borrado no vuelve: se recuerda el mail y se guarda con el resto de los datos
reset(); state.gmailDeletedIds = [];
state.transactions = [gmail('del1', '2026-10-10', 'RAPPI', 16042), gmail('del2', '2026-10-11', 'UBER', 9000), gmail('del3', '2026-10-12', 'COTO', 5000)];
confirmDeleteTxn('gmail_del1');
state._selectedTxns = new Set(['gmail_del2']); bulkDelete = bulkDelete; confirm = () => true; bulkDelete();
eq(state.gmailDeletedIds.sort(), ['del1', 'del2'], 'se recuerdan los mails de los gastos borrados (uno y en lote)');
saveState();
eq(JSON.parse(localStorage.getItem('fin_state')).gmailDeletedIds.sort(), ['del1', 'del2'], 'la lista se guarda (no se pierde al recargar)');

// 20) Suscripción sin débitos hace más de 45 días: se pausa sola; un débito nuevo la reactiva
reset();
state.subscriptions = [{ id: 'par2', name: 'PARAMOUNT', merchantKey: 'paramount', price: 3.78, currency: 'USD', freq: 'monthly', day: 9, active: true, autoManaged: true, lastChargeDate: '2026-07-09' }];
pauseStaleImportedSubscriptions(D('2026-10-16'));
eq(state.subscriptions[0].active, false, 'Paramount sin cobros desde julio queda pausada');
state.subscriptions[0].active = true; pauseStaleImportedSubscriptions(D('2026-10-16'));
eq(state.subscriptions[0].active, true, 'si la reactivás a mano, no se vuelve a pausar');
state.subscriptions[0].active = false;
finishImport([debito('par-nov', 'U$S3,78', 'PARAMOUNT', '09/11/2026', '23:00')], 'gmail', 'importado_desde_gmail');
eq([state.subscriptions.length, state.subscriptions[0].active], [1, true], 'un débito nuevo la reactiva');

// 21) Limpieza única de cuotas duplicadas de la versión vieja: solo esas 5, el resto de las cuotas viejas queda
reset();
state.transactions = [
  { id: 'mat_manual_cuota_mq7gs0ua_1', isMaterializedCommitment: true, date: D('2026-07-09'), amount: 39990, currency: 'ARS', description: 'AirPods Max (Cuota 1/2)' },
  { id: 'mat_cuota_manual_auto_cg_dloeldon_49950_3_2', isMaterializedCommitment: true, date: D('2026-07-14'), amount: 49950, currency: 'ARS', description: 'El Don' },
  { id: 'mat_cuota_cg_dloeldon_49950_3_3', isMaterializedCommitment: true, date: D('2026-07-14'), amount: 49950, currency: 'ARS', description: 'El Don (Cuota 3/3)' },
  { id: 'mat_cuota_manual_auto_cg_merpagoalejoagu_39950_2_2', isMaterializedCommitment: true, date: D('2026-07-09'), amount: 39950, currency: 'ARS', description: 'AirPods Max (Cuota 2/2)' }
];
removeLegacyDuplicateCuotaCharges();
eq(state.transactions.map(t => t.id), ['mat_cuota_cg_dloeldon_49950_3_3', 'mat_cuota_manual_auto_cg_merpagoalejoagu_39950_2_2'], 'se borran solo los duplicados; las cuotas reales quedan');

print((failures ? '✗ ' + failures + ' fallaron, ' : '✓ ') + passed + ' pruebas OK');
if (failures) throw new Error(failures + ' pruebas fallaron');
