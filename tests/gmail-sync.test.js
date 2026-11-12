// Sincronización de Gmail completa (Gmail simulado): anulaciones, gastos borrados y rango de fechas.
// Correr desde la raíz del repo:  npm run test:gmail
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
function reset(){ state.transactions = []; state.cuotas = []; state.subscriptions = []; state.fixedExpenses = []; state.imports = []; state.dismissedAutoCuotas = []; state.autoCuotaConfig = {}; }
const gmail = (id, ymd, desc, amount, extra) => Object.assign({ id: 'gmail_' + id, gmailId: id, source: 'gmail', origen_del_movimiento: 'importado_desde_gmail', date: D(ymd), description: desc, _baseDesc: desc, amount, currency: 'ARS', payMethod: 'visa', category: 'Varios', tags: [] }, extra || {});
const stmt = (id, ymd, desc, amount, extra) => Object.assign({ id: 'st_' + id, date: D(ymd), description: desc, _baseDesc: desc, amount, currency: 'ARS', category: 'Procesando...', tags: [] }, extra || {});
const real = () => state.transactions.filter(t => !t.isPendingCuota && !t.isPendingSubscription);
getEmailBody = payload => payload.plainText;
const ROW = (label, value) => '<div><div style="text-align: left;">' + label + '</div><div style="text-align: right;"><strong style="font-weight: bold;">' + value + '</strong></div></div>';
const mailHtml = rows => '<p>Tarjeta Santander Visa Crédito terminada en 3177.</p>' + rows.map(r => ROW(r[0], r[1])).join('');
const mail = (id, subject, rows) => ({ id, payload: { headers: [{ name: 'Subject', value: subject }, { name: 'Date', value: 'Mon, 5 Oct 2026 10:00:00 -0300' }], plainText: mailHtml(rows) } });
let inbox = [];
let lastQuery = '';
gmailFetch = async url => {
  if (url.includes('/messages?')) { lastQuery = decodeURIComponent(url.split('q=')[1].split('&')[0]); return { json: async () => ({ messages: inbox.map(m => ({ id: m.id, threadId: m.id })) }) }; }
  const id = url.split('/messages/')[1].split('?')[0];
  return { json: async () => inbox.find(m => m.id === id) };
};
gmailAccessToken = 'x';
let shown = null;
showGmailResultModal = (txns) => { shown = txns.map(t => t.gmailId); };
state.gmailImportRules = [{ id: 'r', name: 'Santander · Compras', sender: 's', query: 'subject:Pagaste OR subject:"Tu pago fue anulado"', active: true }];

(async () => {
  // 1) Compra en 12 cuotas importada
  reset(); state.gmailDeletedIds = []; state.gmailAnulados = [];
  inbox = [mail('p1', 'Pagaste $1.200.000,00', [['Monto', '$1.200.000,00'], ['Cuotas', '12'], ['Comercio', 'TIENDA SA'], ['Fecha', '05/10/2026'], ['Hora', '10:00']])];
  await fetchSantanderEmails(new Date(2026, 9, 1), new Date(2026, 9, 31));
  eq(shown, ['p1'], 'la compra se ofrece para importar');
  finishImport(pendingGmailTxns, 'gmail', 'importado_desde_gmail');
  eq([real().length, state.cuotas.length, real()[0].amount], [1, 1, 100000], 'importada: 1 movimiento de $100.000 (cuota 1/12) y 1 plan');
  eq(/after:\d{9,} before:\d{9,}/.test(lastQuery), true, 'la búsqueda de Gmail usa el rango exacto en hora local');

  // 2) Llega la anulación (trae el TOTAL, no la cuota): se borra la compra y el plan
  inbox.push(mail('a1', 'Tu pago fue anulado', [['Monto', '$1.200.000,00'], ['Cuotas', '12'], ['Comercio', 'TIENDA SA']]));
  shown = null;
  await fetchSantanderEmails(new Date(2026, 9, 1), new Date(2026, 9, 31));
  eq([real().length, state.cuotas.length], [0, 0], 'anulación de compra en cuotas: se borra el movimiento y el plan');

  // 3) La próxima sincronización no la vuelve a traer
  shown = null;
  await fetchSantanderEmails(new Date(2026, 9, 1), new Date(2026, 9, 31));
  eq([shown, real().length], [null, 0], 'la compra anulada no vuelve a aparecer');

  // 4) Un gasto borrado a mano tampoco vuelve
  reset(); state.gmailDeletedIds = []; state.gmailAnulados = [];
  inbox = [mail('p2', 'Pagaste $5.000,00', [['Monto', '$5.000,00'], ['Cuotas', '1'], ['Comercio', 'KIOSCO'], ['Fecha', '06/10/2026'], ['Hora', '11:00']])];
  await fetchSantanderEmails(new Date(2026, 9, 1), new Date(2026, 9, 31));
  finishImport(pendingGmailTxns, 'gmail', 'importado_desde_gmail');
  confirmDeleteTxn(real()[0].id);
  shown = null;
  await fetchSantanderEmails(new Date(2026, 9, 1), new Date(2026, 9, 31));
  eq([shown, real().length], [null, 0], 'un gasto borrado no se vuelve a importar');

  // 5) Importar "desde el 1/10": un mail con fecha de compra 15/09 no entra
  reset(); state.gmailDeletedIds = []; state.gmailAnulados = [];
  inbox = [mail('p3', 'Pagaste $9.000,00', [['Monto', '$9.000,00'], ['Cuotas', '1'], ['Comercio', 'VIEJO'], ['Fecha', '15/09/2026'], ['Hora', '11:00']]),
           mail('p4', 'Pagaste $7.000,00', [['Monto', '$7.000,00'], ['Cuotas', '1'], ['Comercio', 'NUEVO'], ['Fecha', '01/10/2026'], ['Hora', '00:30']])];
  shown = null;
  await fetchSantanderEmails(new Date(2026, 9, 1), new Date(2026, 9, 31));
  eq(shown, ['p4'], 'solo entran gastos con fecha dentro del período elegido');

  // 6) "Tu resumen vence pronto" nunca entra, aunque lo traiga una regla
  reset(); state.gmailDeletedIds = []; state.gmailAnulados = [];
  inbox = [mail('r1', 'Tu resumen vence pronto', [['Monto en pesos', '$ 6.654.397,34']])];
  shown = null;
  await fetchSantanderEmails(new Date(2026, 9, 1), new Date(2026, 9, 31));
  eq([shown, real().length], [null, 0], 'el aviso del resumen no se importa');

  // 7) Al abrir la app (automático): la compra nueva entra directo, sin la lista para revisar
  reset(); state.gmailDeletedIds = []; state.gmailAnulados = []; state.lastGmailSync = null;
  inbox = [mail('q1', 'Pagaste $3.000,00', [['Monto', '$3.000,00'], ['Cuotas', '1'], ['Comercio', 'CAFE'], ['Fecha', '07/10/2026'], ['Hora', '09:00']])];
  shown = null;
  let ok = await fetchSantanderEmails(new Date(2026, 9, 1), new Date(2026, 9, 31), { auto: true });
  eq([ok, shown, real().map(t => t.gmailId), !!state.lastGmailSync], [true, null, ['q1'], true], 'automático: importa directo y anota la última sincronización');
  eq(real()[0].estado_revision, 'pendiente_de_revision', 'automático: queda para categorizar como cualquier gasto de Gmail');

  // 8) Abrir de nuevo no repite nada
  ok = await fetchSantanderEmails(new Date(2026, 9, 1), new Date(2026, 9, 31), { auto: true });
  eq([ok, shown, real().length], [true, null, 1], 'automático: abrir otra vez no duplica');

  // 9) Si algo parece repetido, eso no entra solo: se muestra para decidir; lo demás sí entra
  reset(); state.gmailDeletedIds = []; state.gmailAnulados = [];
  state.transactions.push(stmt('m1', '2026-10-08', 'SUPER', 8000, { category: 'Supermercado' }));
  inbox = [mail('q2', 'Pagaste $8.000,00', [['Monto', '$8.000,00'], ['Cuotas', '1'], ['Comercio', 'SUPER'], ['Fecha', '08/10/2026'], ['Hora', '18:00']]),
           mail('q3', 'Pagaste $1.500,00', [['Monto', '$1.500,00'], ['Cuotas', '1'], ['Comercio', 'FARMACIA'], ['Fecha', '09/10/2026'], ['Hora', '12:00']])];
  shown = null;
  await fetchSantanderEmails(new Date(2026, 9, 1), new Date(2026, 9, 31), { auto: true });
  eq([shown, real().filter(t => t.gmailId).map(t => t.gmailId)], [['q2'], ['q3']], 'automático: el posible repetido se muestra, el resto entra');

  // 10) Desde cuándo busca: la última vez con 7 días de margen; la primera vez, desde el 1 del mes
  localStorage.removeItem('fin_gmail_auto_at'); state.lastGmailSync = null;
  eq(dateToYMD(gsAutoImportRange(new Date(2026, 10, 11, 10)).from), '2026-11-01', 'primera vez: desde el 1 del mes');
  localStorage.setItem('fin_gmail_auto_at', new Date(2026, 10, 9, 10).toISOString());
  eq(dateToYMD(gsAutoImportRange(new Date(2026, 10, 11, 10)).from), '2026-11-02', 'después: última vez menos 7 días');
  localStorage.setItem('fin_gmail_auto_at', new Date(2026, 0, 1).toISOString());
  eq(dateToYMD(gsAutoImportRange(new Date(2026, 10, 11, 10)).from), '2026-09-12', 'nunca más de 60 días para atrás');
  localStorage.removeItem('fin_gmail_auto_at');

  print((failures ? '✗ ' + failures + ' fallaron, ' : '✓ ') + passed + ' pruebas OK');
  if (failures) throw new Error(failures + ' pruebas fallaron');
})().catch(e => { print('✗ ERROR ' + e + '\n' + (e.stack||'')); throw e; });
