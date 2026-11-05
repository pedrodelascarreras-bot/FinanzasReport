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
const tx = id => ({ id, date: D('2026-11-02'), description: 'Gasto ' + id, amount: 1000, currency: 'ARS', category: 'Otros' });
const settle = () => { for (let i = 0; i < 50; i++) drainMicrotasks(); };
// IndexedDB de mentira (en memoria), con callbacks asincrónicos como la real
var idbData = {};
function fakeIndexedDB(){
  const db = { createObjectStore(){}, transaction(){ const tx = {}; tx.objectStore = () => ({
    get(k){ const q = {}; Promise.resolve().then(() => { q.result = idbData[k]; q.onsuccess(); }); return q; },
    put(v, k){ idbData[k] = v; Promise.resolve().then(() => tx.oncomplete && tx.oncomplete()); }
  }); return tx; } };
  return { open(){ const req = {}; Promise.resolve().then(() => { req.result = db; req.onupgradeneeded && req.onupgradeneeded(); req.onsuccess(); }); return req; } };
}
const boot = () => { initStateStorage(); settle(); loadState(); };
const ids = () => state.transactions.map(t => t.id).join(',');
window._appBooted = true;
const toasts = []; showToast = (m, t) => toasts.push(t + ':' + m);
const realSet = localStorage.setItem;
const fillLocalStorage = on => { localStorage.setItem = on ? function(k, v){ if (k === 'fin_state') throw new Error('QuotaExceededError'); return realSet.call(this, k, v); } : realSet; };

// 1) Primera vez con IndexedDB: los datos de localStorage se copian (migración)
reset(); state.transactions = [tx('a')]; saveState();
indexedDB = fakeIndexedDB();
boot();
eq([ids(), !!idbData['fin_state'], JSON.parse(idbData['fin_state']).transactions.length], ['a', true, 1], 'migra los datos a IndexedDB y los carga');

// 2) localStorage lleno: se sigue guardando en IndexedDB, sin aviso de error
fillLocalStorage(true);
state.transactions.push(tx('b')); saveState(); settle();
eq([JSON.parse(idbData['fin_state']).transactions.length, store['fin_state']], [2, undefined], 'con localStorage lleno, IndexedDB tiene lo nuevo y se libera la copia vieja');
eq(toasts.filter(t => t.startsWith('error')).length, 0, 'no avisa error: no se perdió nada');

// 3) Reabrir la app: carga lo más nuevo (IndexedDB), no la copia vieja de localStorage
state.transactions = [];
boot();
eq(ids(), 'a,b', 'al reabrir están los gastos guardados con localStorage lleno');

// 4) Si la pestaña se cerró antes de que IndexedDB guardara, gana localStorage (es más nuevo)
fillLocalStorage(false);
state.transactions.push(tx('c')); saveState();
idbData['fin_state'] = idbData['fin_state'].replace(/"savedAt":"[^"]*"/, '"savedAt":"2000-01-01T00:00:00.000Z"'); // IndexedDB quedó vieja
state.transactions = [];
boot(); settle();
eq([ids(), JSON.parse(idbData['fin_state']).transactions.length], ['a,b,c', 3], 'usa la copia más nueva y la vuelve a copiar a IndexedDB');

// 5) Restaurar un backup viejo (savedAt de antes) queda restaurado al reabrir
writeStoredStateRaw(JSON.stringify(compactStoredState({ savedAt: '2026-10-01T00:00:00.000Z', transactions: [tx('viejo')] })));
settle(); state.transactions = [];
boot();
eq(ids(), 'viejo', 'el backup restaurado no lo pisa una copia más nueva');

// 6) Sin IndexedDB (navegador viejo / modo privado): todo sigue con localStorage
indexedDB = undefined;
reset(); state.transactions = [tx('solo')]; saveState();
boot();
eq(ids(), 'solo', 'sin IndexedDB funciona como antes');
toasts.length = 0; _storageWarned = false;
checkStorageUsage(4000000);
eq(toasts.some(t => t.startsWith('error') && /\d+%/.test(t)), true, 'sin IndexedDB avisa al pasar el 70% del espacio');

if (errs.length) print('console.error: ' + errs.slice(0, 3).join(' | '));
if (failures) { print('✗ ' + failures + ' fallaron, ' + passed + ' pruebas OK'); throw new Error(failures + ' pruebas fallaron'); }
print('✓ ' + passed + ' pruebas OK');
