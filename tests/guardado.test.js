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
const stored = () => JSON.parse(store['fin_state']);
const LOGO = 'data:image/webp;base64,' + 'A'.repeat(3000);
const tx = (id, extra) => Object.assign({ id, date: D('2026-11-02'), description: 'Gasto ' + id, amount: 1000, currency: 'ARS', category: 'Otros' }, extra || {});

// 1) El logo de un comercio se guarda una sola vez, no una copia por gasto
reset();
state.transactions = [tx('a', { customLogoUrl: LOGO }), tx('b', { customLogoUrl: LOGO }), tx('c')];
saveState();
eq([stored().logoBlobs.length, stored().transactions[0].customLogoUrl, stored().transactions[2].customLogoUrl], [1, '@logo:0', undefined], 'logo guardado una vez y referenciado');
eq(store['fin_state'].split(LOGO).length - 1, 1, 'lo guardado no repite la imagen');
loadState();
eq(state.transactions.map(t => t.customLogoUrl === LOGO), [true, true, false], 'al cargar, cada gasto recupera su logo');

// 2) El perfil activo no guarda una copia de todos los datos
reset();
state.transactions = [tx('a'), tx('b')];
state.userProfiles = [{ id: 'p1', name: 'Yo', transactions: [tx('viejo')], categories: [] }];
state.activeUserProfileId = 'p1';
saveState();
eq([stored().userProfiles[0].transactions, stored().userProfiles[0].name, stored().transactions.length], [undefined, 'Yo', 2], 'el perfil activo guarda solo su identidad');
applyUserProfile('p1');
eq(state.transactions.map(t => t.id), ['a', 'b'], 'aplicar el perfil activo no pisa los gastos con una copia vieja');

// 3) Cambiar de perfil conserva los datos de los dos
reset();
state.transactions = [tx('mio')];
state.userProfiles = [{ id: 'p1', name: 'Yo', _live: true }, { id: 'p2', name: 'Otro', transactions: [tx('otro')], categories: [] }];
state.activeUserProfileId = 'p1';
applyUserProfile('p2');
eq(state.transactions.map(t => t.id), ['otro'], 'al pasar al perfil 2 se ven sus gastos');
applyUserProfile('p1');
eq(state.transactions.map(t => t.id), ['mio'], 'al volver al perfil 1 están sus gastos');

// 4) Si el navegador no puede guardar, se avisa (antes fallaba en silencio)
reset();
const toasts = []; const _toast = showToast; showToast = (m, t) => toasts.push(t);
const _set = localStorage.setItem; localStorage.setItem = function(k, v){ if (k === 'fin_state') throw new Error('QuotaExceededError'); return _set.call(this, k, v); };
state.transactions = [tx('a')]; saveState();
localStorage.setItem = _set; showToast = _toast;
eq(toasts.includes('error'), true, 'aviso de error cuando no se puede guardar');

// 5) Backup viejo (con copia en el perfil y logos repetidos) se achica al restaurar
const old = { transactions: [tx('a', { customLogoUrl: LOGO }), tx('b', { customLogoUrl: LOGO })], userProfiles: [{ id: 'p1', name: 'Yo', transactions: [tx('a'), tx('b')] }], activeUserProfileId: 'p1' };
const comp = compactStoredState(old);
eq([comp.logoBlobs.length, comp.userProfiles[0].transactions, comp.transactions[1].customLogoUrl], [1, undefined, '@logo:0'], 'backup viejo compactado');

// 6) Suscripción de Gmail borrada: no se vuelve a crear al reimportar
reset();
state.transactions = [tx('otro')]; // (un estado vacío no pisa lo guardado: el guard lo bloquea)
const debit = (id, ymd, amount) => tx(id, { date: D(ymd), description: 'APPLECOMBILL', amount, currency: 'USD', isAutoDebit: true, subscriptionName: 'APPLECOMBILL', importKind: 'subscription', importRuleId: 'r1' });
const s1 = upsertImportedSubscriptionFromTxn(debit('g1', '2026-11-01', 8));
eq(state.subscriptions.length, 1, 'el débito crea la suscripción');
deleteSubscriptionById(s1.id, { silent: true, keepHistory: false });
eq(state.subscriptions.length, 0, 'suscripción borrada');
loadState();
eq((state.dismissedImportedSubs || []).length, 1, 'el borrado queda guardado');
eq(upsertImportedSubscriptionFromTxn(debit('g2', '2026-12-01', 7.9)), null, 'mismo comercio y precio parecido: no se vuelve a crear');
eq(state.subscriptions.length, 0, 'sigue sin la suscripción borrada');
const s2 = upsertImportedSubscriptionFromTxn(debit('g3', '2026-12-30', 9.99));
eq([state.subscriptions.length, s2 && s2.price], [1, 9.99], 'otra suscripción del mismo comercio con otro precio sí se crea');

if (errs.length) print('console.error: ' + errs.slice(0, 3).join(' | '));
if (failures) { print('✗ ' + failures + ' fallaron, ' + passed + ' pruebas OK'); throw new Error(failures + ' pruebas fallaron'); }
print('✓ ' + passed + ' pruebas OK');
