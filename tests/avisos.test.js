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

const _gtc0 = getTcCycles;
const D = s => new Date(s + 'T12:00:00');
const tx = (id, ymd, amount, extra) => Object.assign({ id, date: D(ymd), description: 'Gasto ' + id, amount, currency: 'ARS', category: 'Super', payMethod: 'visa' }, extra || {});
state.cuotas = []; state.fixedExpenses = []; state.imports = []; state.userProfiles = []; state.activeUserProfileId = null; state.catRules = [];
window.USD_TO_ARS = 1500;

// Noviembre inventado: tope de vida $1.000.000, súper todos los días y un delivery grande hoy
const now = new Date(2026, 10, 20, 15, 0);
const txns = [];
for (let d = 1; d <= 19; d++) txns.push(tx('s' + d, '2026-11-' + String(d).padStart(2, '0'), 30000));
txns.push(tx('hoy', '2026-11-20', 230000, { category: 'Delivery', description: 'PEDIDOSYA' }));
['2026-08-15', '2026-09-15', '2026-10-15'].forEach((d, i) => txns.push(tx('del' + i, d, 100000, { category: 'Delivery', description: 'PEDIDOSYA' })));
txns.push(tx('nf1', '2026-10-10', 8000, { category: 'Suscripciones', description: 'NETFLIX.COM' }));
txns.push(tx('nf2', '2026-11-10', 9500, { category: 'Suscripciones', description: 'NETFLIX.COM' }));
state.transactions = txns;
state.subscriptions = [{ id: 'sub1', name: 'Netflix', merchantKey: 'netflix', price: 9500, currency: 'ARS', freq: 'monthly', day: 10, active: true }];
state.caminoPlan = { version: 1, salaryUsd: 0, livingCapArs: 1000000, startMonth: '2026-11', aguinaldo: { month: '', netUsd: 0 },
  items: [{ id: 'p1', kind: 'prestamo', name: 'Préstamo X', amount: 100000, currency: 'ARS', count: 6, firstDate: '2026-11-25', everyMonths: 1, autoDebit: true, status: 'activo' }] };
getTcCycles = card => card === 'tarjetas' ? [] : [
  { id: card + '1', closeDate: '2026-11-26', openDate: '2026-10-27', dueDate: '2026-12-07', source: 'manual' },
  { id: card + '0', closeDate: '2026-10-26', openDate: '2026-09-27', dueDate: '2026-11-23', source: 'manual' }];

const avisos = avisosBuild(now);
const byKey = Object.fromEntries(avisos.map(a => [a.key, a]));
const keys = avisos.map(a => a.key).sort();
eq(keys, ['cat-2026-11-Delivery', 'cierre-visa-2026-11-26', 'dia-2026-11-20', 'hecho-p1-1', 'hecho-p1-2', 'pago-p1-1', 'pago-p1-2', 'ritmo-2026-11-s3', 'semana-2026-11-16', 'sub-sub1-nf2', 'tope-2026-11-75', 'vence-visa-2026-11-23'].sort(), 'los avisos que tocan, con las cuotas de los próximos 40 días (Amex sin gastos no avisa)');

// Para frenarte a tiempo: en el momento, solo el escalón más alto del tope
eq(Date.parse(byKey['tope-2026-11-75'].at) - now.getTime(), 5000, 'el tope avisa en el momento');
eq(byKey['tope-2026-11-75'].title, 'Llevás el 75% de tu tope', 'escalón del tope');
eq(!!byKey['tope-2026-11-50'], false, 'no manda el 50 % junto con el 75 %');
eq(byKey['ritmo-2026-11-s3'].title, 'Vas más rápido que tu plan', 'ritmo arriba del tope');
eq(byKey['cat-2026-11-Delivery'].body, 'Este mes ya van $230.000. En un mes normal gastás $100.000.', 'categoría por encima de lo normal');
eq(byKey['dia-2026-11-20'].title, 'Día caro', 'día caro');

// Para no olvidarte: con fecha y hora
eq(new Date(byKey['cierre-visa-2026-11-26'].at).toString().slice(0, 21), new Date(2026, 10, 23, 10, 0).toString().slice(0, 21), 'cierre 3 días antes a las 10');
eq(byKey['vence-visa-2026-11-23'].title, 'Mañana vence la Visa', 'vencimiento');
eq(new Date(byKey['vence-visa-2026-11-23'].at).getDate(), 22, 'vencimiento el día anterior');
eq(byKey['pago-p1-1'].body, '$100.000 · cuota 1 de 6.', 'pago del plan con su cuota');
eq(byKey['sub-sub1-nf2'].body, 'De $8.000 a $9.500 (+19%).', 'suscripción que subió');

// Para motivarte
eq(new Date(byKey['semana-2026-11-16'].at).getDay(), 0, 'resumen el domingo');
eq(new Date(byKey['semana-2026-11-16'].at).getHours(), 20, 'a las 20');
eq(byKey['hecho-p1-1'].body, 'Se pagó la cuota 1 de 6 de Préstamo X. Faltan 5.', 'cuota pagada del plan');
eq(/semana/.test(byKey['semana-2026-11-16'].body) && /más que la semana pasada/.test(byKey['semana-2026-11-16'].body), true, 'compara con la semana anterior');

// Mes tranquilo: "vas bien" y ningún aviso de frenar
state.transactions = [];
for (let d = 1; d <= 19; d++) state.transactions.push(tx('q' + d, '2026-11-' + String(d).padStart(2, '0'), 15000));
const calmos = avisosBuild(now).map(a => a.key);
eq([calmos.includes('bien-2026-11'), calmos.some(k => /^(tope|ritmo|dia|cat)-/.test(k))], [true, false], 'mes tranquilo: vas bien y nada para frenar');

// Sin plan del Camino no inventa topes (y no crea el plan)
state.caminoPlan = null;
const sinPlan = avisosBuild(now).map(a => a.key);
eq([sinPlan.some(k => /^(tope|ritmo|bien|pago|hecho)-/.test(k)), state.caminoPlan], [false, null], 'sin plan: sin topes ni cuotas, y el plan no se crea solo');

// En la compu (sin avisos del sistema) el bloque pide abrir desde el celular
eq(avisosStatus(), 'install', 'sin soporte de avisos');
eq(avisosWidgetHtml().includes('Abrí Fluxen desde el ícono de inicio'), true, 'bloque del Inicio');

getTcCycles = _gtc0;
if (errs.length) print('errores: ' + errs.slice(0, 3).join(' | '));
if (failures) { print('✗ ' + failures + ' fallaron, ' + passed + ' pruebas OK'); throw new Error(failures + ' pruebas fallaron'); }
print('✓ ' + passed + ' pruebas OK');
