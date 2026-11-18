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
window.innerWidth = 390; var innerWidth = 390;
window.scrollTo = function(){};
var getComputedStyle = function(){ return { getPropertyValue(){ return ''; } }; };
const tx = (id, ymd, pm, amount, extra) => Object.assign({ id, date: D(ymd), description: 'Gasto ' + id, amount, currency: 'ARS', category: 'Delivery', payMethod: pm }, extra || {});
const shellHtml = id => document.getElementById(id).innerHTML;
USD_TO_ARS = 1500; window.USD_TO_ARS = 1500;

// Semana de lunes 16 a domingo 22 de noviembre de 2026; hoy es miércoles 18 (día 3)
const HOY = new Date('2026-11-18T15:00:00');
reset(); state.caminoPlan = null; state.weeklyLimit = null;

// 1) Sin límite: no calcula y la pantalla invita a ponerlo
eq(wkCompute(HOY), null, 'sin límite no hay cálculo');
renderMobileSemana();
eq(shellHtml('mob-week-shell').includes('Poné tu límite semanal'), true, 'vacío: pide poner el límite');

// 2) Qué cuenta: tarjetas, débito, efectivo y dólares; no cuotas ni suscripciones ni otras semanas
state.weeklyLimit = { amount: 350000, weekStart: 1, excluded: [] };
state.transactions = [
  tx('a', '2026-11-16', 'visa', 50000),
  tx('b', '2026-11-17', 'deb', 20000),
  tx('c', '2026-11-18', 'ef', 10000),
  tx('u', '2026-11-18', 'visa', 10, { currency: 'USD', category: 'Juegos' }),
  tx('q', '2026-11-17', 'visa', 80000, { cuotaNum: 2, cuotaGroupId: 'g1' }),
  tx('old', '2026-11-15', 'visa', 99999),
  tx('fut', '2026-11-20', 'visa', 7777)
];
let w = wkCompute(HOY);
eq([w.startStr, w.endStr, w.dayIdx, w.daysLeft], ['2026-11-16', '2026-11-22', 3, 5], 'semana de lunes a domingo, día 3');
eq(w.spent, 95000, 'cuenta 50k + 20k + 10k + USD 10 (15k); no la cuota, ni el domingo anterior, ni el viernes que viene');
eq([w.spentToday, w.left], [25000, 255000], 'hoy y lo que queda');
// Hoy: (350k − 70k gastado antes de hoy) / 5 días = 56k; ya gasté 25k → quedan 31k
eq([Math.round(w.todayBudget), Math.round(w.todayLeft), Math.round(w.perDayAfter)], [56000, 31000, 63750], 'hoy podés gastar y por día desde mañana');
eq(w.status, 'great', '95k de 150k esperados al día 3: va muy bien');
eq(w.days.map(d => d.spent), [50000, 20000, 25000, 0, 0, 0, 0], 'día por día');
eq([w.days[2].isToday, w.days[3].isFuture], [true, true], 'hoy y días que vienen');
eq(w.cats[0], { cat: 'Delivery', v: 80000 }, 'lo que más pesa');

// 3) Dejar un gasto afuera del límite
wkToggleExcluded('a');
w = wkCompute(HOY);
eq([w.spent, state.weeklyLimit.excluded], [45000, ['a']], 'un gasto afuera no cuenta');
wkToggleExcluded('a');
eq(wkCompute(HOY).spent, 95000, 'y vuelve a contar');
eq(stored().weeklyLimit.amount, 350000, 'el límite se guarda con los datos');

// 4) Estados y consejos
const msg = w => wkInsights(w).map(i => i.title).join(' | ');
state.transactions = [];
w = wkCompute(HOY);
eq([w.spent, /Día 3 y todavía no gastaste nada/.test(msg(w))], [0, true], 'sin gastar: lo felicita');
eq(w.zeroDays, 3, 'tres días seguidos sin gastar');
state.transactions = [tx('a', '2026-11-16', 'visa', 100000), tx('b', '2026-11-17', 'visa', 100000)];
w = wkCompute(HOY);
eq([w.status, /Vas más rápido que el plan/.test(msg(w))], ['warn', true], '200k al día 3 de 350k: avisa que va rápido');
eq(wkInsights(w)[0].text.includes('$37.500 por día desde mañana'), true, 'dice cuánto por día para llegar (150k / 4)');
state.transactions.push(tx('c', '2026-11-18', 'visa', 200000));
w = wkCompute(HOY);
eq([w.status, Math.round(w.left), /Te pasaste \$50\.000 del límite/.test(msg(w))], ['over', -50000, true], 'pasado: lo dice con el monto');
eq(Math.round(w.todayLeft) < 0, true, 'hoy ya no queda');
state.transactions = [tx('a', '2026-11-16', 'visa', 100000)];
w = wkCompute(HOY);
eq(/Un gasto se llevó el 29% del límite/.test(msg(w)), true, 'un gasto grande se marca');

// 5) Semana pasada y racha (con el límite de hoy)
state.transactions = [
  tx('h1', '2026-11-09', 'visa', 300000), tx('h1b', '2026-11-10', 'visa', 20000), // semana del 9: 320k → cumplió
  tx('h2', '2026-11-03', 'visa', 200000),  // semana del 2: 200k → cumplió
  tx('h3', '2026-10-27', 'visa', 400000),  // semana del 26/10: 400k → se pasó
  tx('n1', '2026-11-16', 'visa', 10000)
];
w = wkCompute(HOY);
eq(w.history.slice(0, 3).map(h => [dateToYMD(h.start), h.spent, h.met]), [['2026-11-09', 320000, true], ['2026-11-02', 200000, true], ['2026-10-26', 400000, false]], 'semanas anteriores');
eq(w.history.length, 3, 'no muestra semanas de antes del primer movimiento');
eq(w.streak, 2, 'dos semanas seguidas cumpliendo');
eq(w.prevSameDay, 320000, 'la semana pasada a esta altura (lun a mié)');
eq(/Gastás menos que la semana pasada/.test(msg(w)), true, 'compara con la semana pasada');

// 6) Otro día de arranque: la semana empieza el viernes
state.weeklyLimit.weekStart = 5;
w = wkCompute(HOY);
eq([w.startStr, w.endStr, w.dayIdx], ['2026-11-13', '2026-11-19', 6], 'semana de viernes a jueves');
state.weeklyLimit.weekStart = 1;

// 7) Pantallas
state.transactions = [tx('a', '2026-11-16', 'visa', 50000)];
var _RealDate = Date;
renderMobileSemana();
const cel = shellHtml('mob-week-shell');
eq([cel.includes('Te quedan esta semana'), cel.includes('Hoy podés gastar'), cel.includes('Día por día'), cel.includes('Cómo vas'), cel.includes('wkToggleExcluded')], [true, true, true, true, true], 'celular: número, hoy, día por día, consejos y lista');
renderSemanaDesktop();
const pc = shellHtml('wk-desktop');
eq([pc.includes('Límite semanal'), pc.includes('Te quedan esta semana'), pc.includes('Semanas anteriores')], [true, true, true], 'compu: misma información');
// Guardar desde la hoja
mxOpenSheet = function(){}; mxDismissSheet = function(){};
wkOpenEditor();
document.getElementById('wk-amount').value = '420.000';
_wkStartPick = 0;
wkSaveEditor();
eq([state.weeklyLimit.amount, state.weeklyLimit.weekStart], [420000, 0], 'la hoja guarda monto y día de arranque');
document.getElementById('wk-amount').value = '';
wkSaveEditor();
eq(state.weeklyLimit.amount, 420000, 'sin monto no guarda');
eq(typeof nav, 'function', 'nav existe');

if (errs.length) { failures++; print('✗ errores en consola: ' + errs.slice(0, 3).join(' | ')); }
print(failures ? ('✗ ' + failures + ' fallas, ' + passed + ' OK') : ('✓ ' + passed + ' pruebas OK'));
