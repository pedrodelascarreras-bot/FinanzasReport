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
const tx = (id, desc, cat, extra) => Object.assign({ id, date: D('2026-11-02'), description: desc, _baseDesc: desc, amount: 1000, currency: 'ARS', category: cat }, extra || {});

// 1) Aprende de los gastos ya categorizados
reset(); state.catRules = []; state.catHistory = {};
state.transactions = [
  tx('a1', 'COTO SUC 123 10:15', 'Supermercado'), tx('a2', 'COTO SUC 456', 'Supermercado'),
  tx('p1', 'COTO SUC 789 19:02', 'Procesando...'),
  tx('b1', 'MERPAGO*JUANPEREZ 13:00', 'Kiosco'), tx('b2', 'MERPAGO*JUANPEREZ 14:00', 'Restaurantes'),
  tx('p2', 'MERPAGO*JUANPEREZ 22:10', 'Procesando...'),
  tx('p3', 'MERPAGO*DESCONOCIDO 11:00', 'Procesando...', { comercio_detectado: 'MercadoPago' }),
  tx('p4', 'NETFLIX.COM', 'Otros'),
  tx('c1', 'GIMNASIO X', 'Otros', { estado_revision: 'confirmado_por_usuario' })
];
state.catHistory = { mercadopago: { Kiosco: 25 } };
const m = acBuildModel();
const sug = id => acSuggest(state.transactions.find(t => t.id === id), m);
eq([sug('p1').category, sug('p1').confidence], ['Supermercado', 'alta'], 'mismo comercio categorizado 2 veces: segura');
eq(sug('p2').confidence, 'media', 'comercio usado en dos categorías: para revisar');
eq(sug('p3'), null, '"MercadoPago" solo no alcanza para sugerir (no inventa)');
eq(state.transactions.filter(acIsPending).map(t => t.id), ['p1', 'p2', 'p3', 'p4'], 'pendientes: Procesando y "Otros" sin confirmar; el "Otros" confirmado no');
state.catRules = [{ keyword: 'netflix', category: 'Plataformas', active: true }];
eq([sug('p4').category, sug('p4').confidence], ['Plataformas', 'alta'], 'regla del usuario: segura');

// 2) Revisión: aplicar solo lo tildado, aprender y poder deshacer
openAutoCategorize();
const row = id => _acRows.find(r => r.id === id);
eq([row('p1').checked, row('p3').checked, row('p3').category], [true, false, ''], 'segura tildada; sin sugerencia destildada');
acToggle(_acRows.indexOf(row('p2')), false);
acApply();
const cat = id => state.transactions.find(t => t.id === id).category;
eq([cat('p1'), cat('p2'), cat('p3'), cat('p4')], ['Supermercado', 'Procesando...', 'Procesando...', 'Plataformas'], 'aplica solo lo tildado');
eq(state.transactions.find(t => t.id === 'p1').estado_revision, 'confirmado_por_usuario', 'queda confirmado');
loadState();
eq(cat('p1'), 'Supermercado', 'queda guardado');

// 3) Elegir a mano la categoría de un gasto la propone para los del mismo comercio
reset(); state.catRules = []; state.catHistory = {};
state.transactions = [tx('q1', 'PANADERIA LOLA 10:00', 'Procesando...'), tx('q2', 'PANADERIA LOLA 18:30', 'Procesando...'), tx('q3', 'OTRO LUGAR', 'Procesando...')];
openAutoCategorize();
acSetCategory(_acRows.findIndex(r => r.id === 'q1'), 'Kiosco');
eq(_acRows.map(r => [r.id, r.category, r.checked]).sort(), [['q1', 'Kiosco', true], ['q2', 'Kiosco', true], ['q3', '', false]], 'se propaga al mismo comercio');
acApply();
acUndo();
eq(state.transactions.map(t => t.category), ['Procesando...', 'Procesando...', 'Procesando...'], 'deshacer vuelve todo como estaba');

// 4) Buscador de categorías
const opts = q => acPickerOptions(q).map(o => o.cat);
eq(opts('')[0], '', 'sin buscar, la primera opción es "Sin categoría"');
eq(opts('super'), ['Supermercado'], 'escribir filtra');
eq(opts('EDUCACION').includes('Libros'), true, 'busca también por grupo y sin acentos');
eq(opts('ma')[0].toLowerCase().startsWith('ma'), true, 'primero las que empiezan con lo escrito');
eq(opts('zzzz'), [], 'sin resultados');
if (errs.length) print('console.error: ' + errs.slice(0, 3).join(' | '));
if (failures) { print('✗ ' + failures + ' fallaron, ' + passed + ' pruebas OK'); throw new Error(failures + ' pruebas fallaron'); }
print('✓ ' + passed + ' pruebas OK');
