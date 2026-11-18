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

// Objetivo desde el lunes 16 de noviembre de 2026; hoy es miércoles 18 (día 3)
const HOY = new Date('2026-11-18T15:00:00');
reset(); state.caminoPlan = null; state.weeklyLimit = null; state.incomeMonths = [];

// 1) Sin límite: no calcula y la pantalla invita a ponerlo
eq(wkCompute(HOY), null, 'sin límite no hay cálculo');
renderMobileSemana();
eq(shellHtml('mob-week-shell').includes('Poné tu límite semanal'), true, 'vacío: pide poner el límite');

// 2) Qué cuenta: tarjetas, débito, efectivo y dólares; no cuotas ni otras semanas
state.weeklyLimit = { amount: 350000, startDate: '2026-11-16', endDate: '', excluded: [] };
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
eq([w.phase, w.startStr, w.endStr, w.dayIdx, w.daysLeft, w.weekNum], ['active', '2026-11-16', '2026-11-22', 3, 5, 1], 'semana 1, de lunes a domingo, día 3');
eq(w.spent, 95000, 'cuenta 50k + 20k + 10k + USD 10 (15k); no la cuota, ni el domingo anterior, ni el viernes');
eq([w.spentToday, w.left], [25000, 255000], 'hoy y lo que queda');
eq([Math.round(w.todayBudget), Math.round(w.todayLeft), Math.round(w.perDayAfter)], [56000, 31000, 63750], 'hoy podés gastar y por día desde mañana');
eq(w.status, 'great', '95k de 150k esperados al día 3: va muy bien');
eq(w.days.map(d => d.spent), [50000, 20000, 25000, 0, 0, 0, 0], 'día por día');
eq(w.cats[0], { cat: 'Delivery', v: 80000 }, 'lo que más pesa');

// 3) Dejar un gasto afuera del límite
wkToggleExcluded('a');
eq([wkCompute(HOY).spent, state.weeklyLimit.excluded], [45000, ['a']], 'un gasto afuera no cuenta');
wkToggleExcluded('a');
eq(wkCompute(HOY).spent, 95000, 'y vuelve a contar');
eq(stored().weeklyLimit.startDate, '2026-11-16', 'el límite se guarda con los datos');

// 4) Estados y consejos
const msg = w => wkInsights(w).map(i => i.title).join(' | ');
state.transactions = [];
w = wkCompute(HOY);
eq([w.spent, /Día 3 y todavía no gastaste nada/.test(msg(w)), w.zeroDays], [0, true, 3], 'sin gastar: lo felicita');
state.transactions = [tx('a', '2026-11-16', 'visa', 100000), tx('b', '2026-11-17', 'visa', 100000)];
w = wkCompute(HOY);
eq([w.status, wkInsights(w)[0].text.includes('$37.500 por día desde mañana')], ['warn', true], 'va rápido: dice cuánto por día para llegar');
state.transactions.push(tx('c', '2026-11-18', 'visa', 200000));
w = wkCompute(HOY);
eq([w.status, Math.round(w.left), /Te pasaste \$50\.000 del límite/.test(msg(w))], ['over', -50000, true], 'pasado: lo dice con el monto');
state.transactions = [tx('a', '2026-11-16', 'visa', 100000)];
eq(/Un gasto se llevó el 29% del límite/.test(msg(wkCompute(HOY))), true, 'un gasto grande se marca');

// 5) Arranca en una fecha: el viernes 20 (cuando abre la tarjeta). Semanas de viernes a jueves
state.weeklyLimit = { amount: 350000, startDate: '2026-11-20', endDate: '', excluded: [] };
w = wkCompute(HOY);
eq([w.phase, w.daysToStart, w.first.startStr, w.first.endStr], ['upcoming', 2, '2026-11-20', '2026-11-26'], 'todavía no arrancó');
renderMobileSemana();
eq(shellHtml('mob-week-shell').includes('Tu límite arranca en 2 días'), true, 'la pantalla dice cuándo arranca');
w = wkCompute(new Date('2026-11-30T10:00:00'));
eq([w.weekNum, w.startStr, w.endStr, w.dayIdx], [2, '2026-11-27', '2026-12-03', 4], 'semana 2 de viernes a jueves');

// 6) Con fecha de fin: la última semana es más corta y su límite proporcional
state.weeklyLimit = { amount: 350000, startDate: '2026-11-20', endDate: '2026-12-17', excluded: [] };
state.transactions = [tx('x', '2026-11-21', 'visa', 300000), tx('y', '2026-11-28', 'visa', 400000), tx('z', '2026-12-15', 'visa', 10000)];
w = wkCompute(new Date('2026-12-12T10:00:00'));
eq([w.totalWeeks, w.weekNum, w.startStr, w.endStr, w.weekDays, Math.round(w.limit), w.isLastWeek], [4, 4, '2026-12-11', '2026-12-17', 7, 350000, true], 'cuatro semanas justas hasta el jueves 17');
state.weeklyLimit.endDate = '2026-12-19';
w = wkCompute(new Date('2026-12-19T10:00:00'));
eq([w.totalWeeks, w.weekNum, w.weekDays, Math.round(w.limit)], [5, 5, 2, 100000], 'última semana de 2 días: límite proporcional');
eq(w.history.slice(0,4).map(h => h.met), [true, true, false, true], 'semanas del objetivo (la del 27/11 se pasó)');
w = wkCompute(new Date('2026-12-20T10:00:00'));
eq([w.phase, w.weeks.length, w.met, w.spent], ['ended', 5, 4, 710000], 'terminado: resumen del objetivo');

// 7) Límite recomendado: ingreso − compromisos del período, por semana
state.weeklyLimit = null;
state.incomeMonths = [{ month: '2026-11', schemaVersion: 2, salary: { usd: { amount: 2900 } }, extras: [] }];
state.transactions = [];
state.cuotas = [{ id: 'q1', name: 'Megatlon', amount: 84000, total: 12, startDate: '2026-02-01', day: 1, currency: 'ARS', payMethod: 'visa', cuotaGroupId: 'cg1' }];
state.subscriptions = [{ id: 's1', name: 'Claude', price: 20, currency: 'USD', day: 4, freq: 'monthly', active: true, payMethod: 'visa' }];
const per = wkCyclePeriods(HOY);
let r = wkRecommend('next', HOY);
eq(r.income, 2900 * 1500, 'ingreso del mes en pesos');
eq([r.commitments.cuotas, r.commitments.suscripciones], [84000, 30000], 'compromisos del próximo período');
const esperado = Math.floor(((2900 * 1500 - 114000) / (r.days / 7)) / 5000) * 5000;
eq([r.startStr, r.endStr, r.weekly], [per.next.open, per.next.close, esperado], 'recomendado por semana, redondeado a $5.000');
state.caminoPlan = { version: 1, salaryUsd: 0, items: [{ id: 'p1', kind: 'prestamo', name: 'Mercado Pago', amount: 1300000, currency: 'ARS', count: 1, firstDate: per.next.open, everyMonths: 1 }] };
r = wkRecommend('next', HOY);
eq(r.commitments.plan, 1300000, 'suma los préstamos de Camino a cero');
state.caminoPlan = null;
state.transactions = [tx('g1', per.current.open, 'visa', 100000)];
r = wkRecommend('current', HOY);
eq([r.startStr, r.spent > 0 || per.current.open === dateToYMD(HOY)], [dateToYMD(HOY), true], 'resumen actual: desde hoy y descuenta lo gastado');
state.incomeMonths = [];
eq(wkRecommend('next', HOY).weekly, 0, 'sin ingreso no recomienda');

// 8) Hoja: guardar monto y fechas, usar el recomendado
mxOpenSheet = function(){}; mxDismissSheet = function(){};
state.incomeMonths = [{ month: '2026-11', schemaVersion: 2, salary: { usd: { amount: 2900 } }, extras: [] }];
wkOpenEditor();
eq(_wkForm.amount > 0, true, 'la hoja nueva arranca con el recomendado');
document.getElementById('wk-amount').value = '390.000';
document.getElementById('wk-start').value = '2026-11-20';
document.getElementById('wk-end').value = '2026-12-17';
wkSaveEditor();
eq([state.weeklyLimit.amount, state.weeklyLimit.startDate, state.weeklyLimit.endDate], [390000, '2026-11-20', '2026-12-17'], 'guarda monto y fechas');
wkOpenEditor();
document.getElementById('wk-amount').value = '390.000'; document.getElementById('wk-start').value = '2026-11-20'; document.getElementById('wk-end').value = '';
_wkForm.rec = 'next'; wkUseRec();
eq([_wkForm.startDate, _wkForm.endDate, _wkForm.amount === wkRecommend('next').weekly], [wkRecommend('next').startStr, wkRecommend('next').endStr, true], 'usar el recomendado completa monto y fechas del resumen');
document.getElementById('wk-amount').value = '';
wkSaveEditor();
eq(state.weeklyLimit.amount, 390000, 'sin monto no guarda');
// Versión anterior (solo día de la semana) se pasa a una fecha
state.weeklyLimit = { amount: 100000, weekStart: 5, excluded: [] };
const c = wkConfig();
eq([wkValidYmd(c.startDate), wkNoon(c.startDate).getDay()], [true, 5], 'límite viejo: arranca el último viernes');

// 9) Pantallas
state.weeklyLimit = { amount: 350000, startDate: '2026-11-16', endDate: '', excluded: [] };
state.transactions = [tx('a', dateToYMD(new Date()), 'visa', 50000)];
renderMobileSemana();
const cel = shellHtml('mob-week-shell');
eq([cel.includes('Hoy podés gastar'), cel.includes('Día por día'), cel.includes('Cómo vas'), /Semana \d+/.test(cel)], [true, true, true, true], 'celular: número, hoy, día por día, consejos y número de semana');
renderSemanaDesktop();
eq(shellHtml('wk-desktop').includes('Límite semanal'), true, 'compu');

if (errs.length) { failures++; print('✗ errores en consola: ' + errs.slice(0, 3).join(' | ')); }
print(failures ? ('✗ ' + failures + ' fallas, ' + passed + ' OK') : ('✓ ' + passed + ' pruebas OK'));
