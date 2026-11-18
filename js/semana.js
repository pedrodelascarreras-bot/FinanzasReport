// ══ LÍMITE SEMANAL ══
// Un número para mirar todos los días: cuánto te queda para gastar esta semana. Vos ponés el
// límite y el día en que arranca la semana; la app cuenta solo el gasto del día a día (todos
// los medios de pago: tarjetas, débito y efectivo), sin cuotas, suscripciones ni gastos fijos,
// que ya están comprometidos. Se actualiza solo con cada movimiento nuevo.
// Además: cuánto podés gastar hoy para llegar, cómo venís contra el ritmo de la semana, el
// gasto día por día, las semanas anteriores (y cuántas seguidas cumpliste) y consejos con tus
// números (reglas, sin IA). Un movimiento se puede dejar afuera del límite (una compra
// planeada, un pago que no es del día a día) tocándolo en la lista.
//
// Datos: state.weeklyLimit = {amount, weekStart (0 dom … 6 sáb), excluded:[ids]}

const WK_DAY_SHORT=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const WK_DAY_LONG=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const WK_DAY_LETTER=['D','L','M','M','J','V','S'];
const WK_HISTORY_WEEKS=8;

// ── Estado ──
function wkConfig(){
  const c=state.weeklyLimit;
  if(!c || typeof c!=='object') return null;
  if(!Array.isArray(c.excluded)) c.excluded=[];
  if(!(Number(c.weekStart)>=0 && Number(c.weekStart)<=6)) c.weekStart=1;
  return c;
}
function wkHasLimit(){ const c=wkConfig(); return !!(c && Number(c.amount)>0); }
function wkSetLimit(amount, weekStart){
  const prev=wkConfig()||{};
  state.weeklyLimit={amount:Math.round(Number(amount)||0), weekStart:Number(weekStart)||0, excluded:prev.excluded||[], updatedAt:new Date().toISOString()};
  saveState();
}
// Un tope de partida si todavía no pusiste uno: el de "Camino a cero" llevado a 7 días
function wkSuggestedLimit(){
  const cap=Number(state.caminoPlan && state.caminoPlan.livingCapArs)||0;
  return cap>0 ? Math.round(cap*7/30/1000)*1000 : 0;
}

// ── Fechas ──
function wkNoon(d){ const x=new Date(d); x.setHours(12,0,0,0); return x; }
function wkAddDays(d, n){ const x=wkNoon(d); x.setDate(x.getDate()+n); return x; }
function wkWeekStartOf(date, startDay){
  const d=wkNoon(date);
  return wkAddDays(d, -((d.getDay()-startDay+7)%7));
}
function wkMoney(n){ return '$'+Math.round(Number(n)||0).toLocaleString('es-AR'); }
function wkDayMonth(d){ return d.toLocaleDateString('es-AR',{day:'numeric',month:'short'}).replace('.',''); }

// ── Gasto del día a día ──
// Movimientos reales de cualquier medio de pago, sin compromisos ni los que dejaste afuera.
function wkEntries(startStr, endStr){
  if(typeof getPeriodExpenseEntries!=='function') return [];
  const c=wkConfig();
  const excluded=new Set((c && c.excluded||[]).map(String));
  return getPeriodExpenseEntries({startStr, endStr, includeProjected:false})
    .filter(e=>!(typeof isCommitmentTxn==='function' && isCommitmentTxn(e.txn)))
    .map(e=>{
      const rate=typeof _periodUsdRate==='function'?_periodUsdRate():1;
      return Object.assign({}, e, {ars:(Number(e.amount)||0)*((e.currency||'ARS')==='USD'?rate:1), excluded:excluded.has(String(e.id))});
    });
}
function wkSum(entries){ return entries.filter(e=>!e.excluded).reduce((s,e)=>s+e.ars,0); }

// ── Todo lo que muestra la pantalla, en un solo cálculo ──
function wkCompute(todayRef){
  const c=wkConfig();
  if(!c || !(Number(c.amount)>0)) return null;
  const today=wkNoon(todayRef||new Date());
  const limit=Number(c.amount);
  const startDay=Number(c.weekStart)||0;
  const start=wkWeekStartOf(today, startDay);
  const end=wkAddDays(start, 6);
  const todayStr=dateToYMD(today), startStr=dateToYMD(start), endStr=dateToYMD(end);
  const dayIdx=Math.round((today-start)/86400000)+1; // 1…7
  const daysLeft=8-dayIdx; // con hoy

  const entries=wkEntries(startStr, endStr).filter(e=>dateToYMD(e.date)<=todayStr);
  const counted=entries.filter(e=>!e.excluded);
  const spent=wkSum(entries);
  const spentToday=wkSum(entries.filter(e=>dateToYMD(e.date)===todayStr));
  const spentBefore=spent-spentToday;
  const left=limit-spent;
  // Hoy: lo que quedaba al empezar el día, repartido entre los días que faltan
  const todayBudget=Math.max(0, limit-spentBefore)/daysLeft;
  const todayLeft=todayBudget-spentToday;
  // Desde mañana: lo que queda repartido entre los días que faltan después de hoy
  const perDayAfter=daysLeft>1 ? Math.max(0,left)/(daysLeft-1) : 0;
  const perDayNow=Math.max(0,left)/daysLeft;
  const ideal=limit*dayIdx/7;
  const pct=limit?spent/limit*100:0;
  const pctTime=dayIdx/7*100;
  const projection=dayIdx>=2 ? spent/dayIdx*7 : null;

  let status='ok';
  if(spent>limit) status='over';
  else if(spent>ideal*1.05) status='warn';
  else if(spent<=ideal*0.7) status='great';

  // Día por día
  const dailyTarget=limit/7;
  const days=[];
  for(let i=0;i<7;i++){
    const d=wkAddDays(start,i); const ymd=dateToYMD(d);
    const v=wkSum(entries.filter(e=>dateToYMD(e.date)===ymd));
    days.push({ymd, date:d, letter:WK_DAY_LETTER[d.getDay()], short:WK_DAY_SHORT[d.getDay()], spent:v, isToday:ymd===todayStr, isFuture:ymd>todayStr});
  }

  // Categorías de la semana
  const byCat=new Map();
  counted.forEach(e=>{ const k=(!e.category||e.category==='Procesando...'||e.category==='Uncategorized')?'Sin categoría':e.category; byCat.set(k,(byCat.get(k)||0)+e.ars); });
  const cats=[...byCat.entries()].sort((a,b)=>b[1]-a[1]).map(([cat,v])=>({cat,v}));

  // La semana pasada hasta el mismo día
  const prevStart=wkAddDays(start,-7);
  const prevSameDay=wkSum(wkEntries(dateToYMD(prevStart), dateToYMD(wkAddDays(prevStart,dayIdx-1))));

  // Semanas anteriores (con el límite de hoy) y racha de semanas cumplidas
  const history=[];
  for(let w=1; w<=WK_HISTORY_WEEKS; w++){
    const s=wkAddDays(start,-7*w), e=wkAddDays(s,6);
    const all=wkEntries(dateToYMD(s), dateToYMD(e));
    history.push({start:s, end:e, spent:wkSum(all), count:all.length, met:wkSum(all)<=limit});
  }
  // Solo semanas con movimientos: antes de usar la app no hay con qué comparar
  const firstTxn=(state.transactions||[]).reduce((m,t)=>{ const y=dateToYMD(t.date); return !m||y<m?y:m; }, '');
  const historyKnown=history.filter(h=>firstTxn && dateToYMD(h.end)>=firstTxn);
  let streak=0; for(const h of historyKnown){ if(h.met) streak++; else break; }

  // Días seguidos sin gastar, hasta hoy (hoy cuenta si todavía no gastaste)
  let zeroDays=0;
  for(let i=dayIdx-1;i>=0;i--){ if(days[i].spent<=0) zeroDays++; else break; }

  const biggest=counted.slice().sort((a,b)=>b.ars-a.ars)[0]||null;

  return {limit, startDay, start, end, startStr, endStr, todayStr, dayIdx, daysLeft, spent, spentToday, spentBefore, left,
    todayBudget, todayLeft, perDayAfter, perDayNow, ideal, pct, pctTime, projection, status, days, dailyTarget, cats,
    prevSameDay, history:historyKnown, streak, zeroDays, biggest, entries:entries.slice().sort((a,b)=>new Date(b.date)-new Date(a.date))};
}

// ── Consejos: los más importantes primero, como mucho cuatro ──
function wkInsights(w){
  if(!w) return [];
  const out=[];
  const endName=WK_DAY_LONG[w.end.getDay()];
  const nextStartName=WK_DAY_LONG[w.startDay];
  if(w.status==='over'){
    out.push({tone:'bad', icon:'✋', title:'Te pasaste '+wkMoney(-w.left)+' del límite',
      text:'Lo mejor es no gastar más hasta el '+nextStartName+', que arranca una semana nueva. Lo que no gastes de acá al '+endName+' te ayuda a no repetirlo.'});
  } else if(w.status==='warn'){
    out.push({tone:'warn', icon:'⚡', title:'Vas más rápido que el plan',
      text:'Es el día '+w.dayIdx+' de 7 y ya usaste el '+Math.round(w.pct)+'%. Para llegar, no pases de '+wkMoney(w.daysLeft>1?w.perDayAfter:w.perDayNow)+' por día'+(w.daysLeft>1?' desde mañana':'')+'.'});
  } else if(w.spent<=0 && w.dayIdx>=2){
    out.push({tone:'good', icon:'🌱', title:'Día '+w.dayIdx+' y todavía no gastaste nada',
      text:'Excelente. Así se arma una semana con margen.'});
  } else if(w.status==='great'){
    const spare=w.projection!=null ? w.limit-w.projection : w.left;
    out.push({tone:'good', icon:'🎯', title:'Vas muy bien',
      text:'Usaste el '+Math.round(w.pct)+'% y ya pasó el '+Math.round(w.pctTime)+'% de la semana.'+(spare>0?' Si seguís así te sobran '+wkMoney(spare)+'.':'')});
  } else {
    out.push({tone:'info', icon:'✓', title:'Vas en ritmo',
      text:'Te quedan '+wkMoney(w.left)+' para '+(w.daysLeft===1?'hoy, el último día':w.daysLeft+' días, contando hoy')+'. Mantené este ritmo y llegás bien.'});
  }
  // Un gasto que se llevó una parte grande del límite
  if(w.biggest && w.biggest.ars>=w.limit*0.25 && w.status!=='over'){
    out.push({tone:'warn', icon:'💸', title:'Un gasto se llevó el '+Math.round(w.biggest.ars/w.limit*100)+'% del límite',
      text:(w.biggest.description||'Un movimiento')+': '+wkMoney(w.biggest.ars)+'. Si fue algo planeado, tocalo en la lista para dejarlo afuera.'});
  }
  if(w.zeroDays>=2 && w.spent>0){
    out.push({tone:'good', icon:'🔥', title:w.zeroDays+' días seguidos sin gastar', text:'Seguí así: cada día sin gastos te deja más margen para el resto de la semana.'});
  }
  // Contra la semana pasada a esta altura
  if(w.prevSameDay>0 && w.dayIdx>=2){
    const diff=w.spent-w.prevSameDay;
    if(Math.abs(diff)>=w.limit*0.05){
      out.push(diff<0
        ? {tone:'good', icon:'📉', title:'Gastás menos que la semana pasada', text:'A esta altura llevabas '+wkMoney(w.prevSameDay)+'. Hoy vas '+wkMoney(-diff)+' abajo.'}
        : {tone:'warn', icon:'📈', title:'Gastás más que la semana pasada', text:'A esta altura llevabas '+wkMoney(w.prevSameDay)+'. Hoy vas '+wkMoney(diff)+' arriba.'});
    }
  }
  // Lo que más pesa
  if(w.cats.length && w.spent>0){
    const top=w.cats[0];
    out.push({tone:'info', icon:'🔎', title:'Lo que más pesa: '+top.cat, text:wkMoney(top.v)+', el '+Math.round(top.v/w.spent*100)+'% de lo que gastaste esta semana.'});
  }
  if(w.streak>=2) out.push({tone:'good', icon:'🏆', title:w.streak+' semanas seguidas cumpliendo', text:'Mantené la racha hasta el '+endName+'.'});
  return out.slice(0,4);
}

// ── Piezas comunes ──
function wkStatusLabel(w){
  return {over:'Te pasaste', warn:'Más rápido que el plan', great:'Vas muy bien', ok:'En ritmo'}[w.status];
}
function wkStatusColor(status){
  return {over:'#E5383B', warn:'#E8730C', great:'#169C4B', ok:'#169C4B'}[status]||'#169C4B';
}
// Barra de la semana: lo gastado y una marca de dónde "deberías" estar hoy
function wkProgressHtml(w, cls){
  const used=Math.min(100, w.pct);
  return '<div class="'+cls+'"><i style="width:'+used.toFixed(1)+'%;background:'+wkStatusColor(w.status)+'"></i>'
    +'<em style="left:'+Math.min(100,w.pctTime).toFixed(1)+'%" title="Hoy"></em></div>';
}
function wkDaysChartHtml(w, cls){
  const max=Math.max(w.dailyTarget*1.6, ...w.days.map(d=>d.spent), 1);
  const line=(w.dailyTarget/max*100).toFixed(1);
  return '<div class="'+cls+'"><div class="wk-bars" role="img" aria-label="Gasto de cada día de la semana contra el promedio diario del límite">'
    +w.days.map(d=>{
      const h=d.isFuture?0:Math.max(d.spent>0?4:0, d.spent/max*100);
      const color=d.spent>w.dailyTarget?'#E8730C':'var(--wk-c)';
      return '<div class="wk-bar'+(d.isToday?' today':'')+(d.isFuture?' future':'')+'">'
        +'<b>'+(d.isFuture||d.spent<=0?'':esc(wkShort(d.spent)))+'</b>'
        +'<span class="wk-col"><i style="height:'+h.toFixed(1)+'%;background:'+color+'"></i><u style="bottom:'+line+'%"></u></span>'
        +'<small>'+esc(d.letter)+'</small></div>';
    }).join('')
    +'</div><div class="wk-bars-foot"><span><i class="wk-dash"></i>Promedio por día: '+esc(wkMoney(w.dailyTarget))+'</span></div></div>';
}
function wkShort(n){
  n=Math.round(n);
  if(n>=1000000) return '$'+(n/1000000).toFixed(n>=10000000?0:1).replace('.',',')+'M';
  if(n>=1000) return '$'+Math.round(n/1000)+'k';
  return '$'+n;
}
function wkRangeLabel(w){ return WK_DAY_SHORT[w.start.getDay()]+' '+wkDayMonth(w.start)+' al '+WK_DAY_SHORT[w.end.getDay()]+' '+wkDayMonth(w.end); }

// ── Pantalla ──
function renderSemanaPage(){
  renderSemanaDesktop();
  renderMobileSemana();
}

// ══ Celular ══
function renderMobileSemana(){
  const shell=document.getElementById('mob-week-shell');
  if(!shell || typeof mxIsMobile!=='function' || !mxIsMobile()) return;
  if(typeof mxSyncThemeColor==='function') mxSyncThemeColor();
  const w=wkCompute();
  if(!w){
    shell.innerHTML=mxBand('Semana')
      +'<div class="mx-grid"><div class="mx-w full mx-empty wk-empty">'
        +'<div class="wk-empty-ic">🎯</div>'
        +'<div class="mx-md">Poné tu límite semanal</div>'
        +'<div class="mx-sub">Elegís cuánto querés gastar por semana en el día a día y te vamos diciendo cuánto te queda, cuánto podés gastar hoy y cómo venís. Las cuotas, suscripciones y gastos fijos no cuentan: ya están comprometidos.</div>'
        +'<button class="mx-go wide" onclick="wkOpenEditor()">Poner límite</button>'
      +'</div></div>';
    return;
  }
  const over=w.left<0;
  const insights=wkInsights(w);
  const todayTxt=w.todayLeft>=0?wkMoney(w.todayLeft):'−'+wkMoney(-w.todayLeft);
  shell.innerHTML=mxBand('Semana')
    +'<div class="mx-grid">'
      +'<div class="mx-w full wk-hero wk-'+w.status+'">'
        +'<div class="wk-hero-top"><div class="mx-lb">'+(over?'Te pasaste esta semana':'Te quedan esta semana')+'</div>'
          +'<button class="wk-chip" onclick="wkOpenEditor()" aria-label="Cambiar límite">'+esc(wkShort(w.limit))+' / sem ✎</button></div>'
        +'<div class="mx-big wk-amt">'+esc(wkMoney(Math.abs(w.left)))+'</div>'
        +wkProgressHtml(w,'wk-prog')
        +'<div class="wk-prog-leg"><span>Gastaste <b>'+esc(wkMoney(w.spent))+'</b> de '+esc(wkMoney(w.limit))+'</span><span>Día '+w.dayIdx+' de 7</span></div>'
        +'<div class="wk-pill" style="color:'+wkStatusColor(w.status)+';background:color-mix(in srgb, '+wkStatusColor(w.status)+' 12%, white)">'+esc(wkStatusLabel(w))+'</div>'
      +'</div>'
      +'<div class="mx-w tint"><div class="mx-lb">Hoy podés gastar</div><div class="mx-md spaced">'+esc(over?'$0':todayTxt)+'</div>'
        +'<div class="mx-sub">'+(w.spentToday>0?'Ya gastaste '+esc(wkMoney(w.spentToday))+' hoy':'Para seguir en ritmo')+'</div></div>'
      +'<div class="mx-w soft"><div class="mx-lb">'+(w.daysLeft>1?'Por día desde mañana':'Último día')+'</div><div class="mx-md spaced">'+esc(over?'$0':wkMoney(w.daysLeft>1?w.perDayAfter:w.perDayNow))+'</div>'
        +'<div class="mx-sub">'+(w.daysLeft>1?(w.daysLeft-1)+' día'+(w.daysLeft-1===1?'':'s')+' hasta el '+esc(WK_DAY_SHORT[w.end.getDay()].toLowerCase()):'La semana cierra hoy')+'</div></div>'
    +'</div>'
    +mxSh('Cómo vas', '', false)
    +'<div class="mx-list wk-ins">'+insights.map(i=>'<div class="mx-it"><div class="mx-ib wk-ins-ic '+i.tone+'">'+esc(i.icon)+'</div>'
      +'<div class="mx-tx"><div class="mx-t wk-wrap">'+esc(i.title)+'</div><div class="mx-s wk-wrap">'+esc(i.text)+'</div></div></div>').join('')+'</div>'
    +mxSh('Día por día', wkRangeLabel(w), true)
    +'<div class="mx-w wk-days-w">'+wkDaysChartHtml(w,'wk-days')+'</div>'
    +(w.history.length?mxSh('Semanas anteriores', w.streak?('🏆 '+w.streak+' seguida'+(w.streak===1?'':'s')):'', true)
      +'<div class="mx-list">'+w.history.slice(0,6).map(h=>mxItem(
          '<span class="wk-hist-ic '+(h.met?'ok':'bad')+'">'+(h.met?'✓':'✕')+'</span>',
          wkDayMonth(h.start)+' al '+wkDayMonth(h.end),
          h.met?'Cumpliste · sobraron '+wkMoney(w.limit-h.spent):'Te pasaste '+wkMoney(h.spent-w.limit),
          wkMoney(h.spent), Math.round(h.spent/w.limit*100)+'% del límite', h.met?'ok':'wa', '')).join('').replace(/<div class="mx-ib"><span/g,'<div class="mx-ib wk-hist"><span')+'</div>':'')
    +mxSh('Gastos de la semana', w.entries.length?w.entries.length+'':'', true)
    +'<div class="mx-list">'+(w.entries.length?w.entries.map(e=>{
        const tap='onclick="wkToggleExcluded(this.dataset.id)" data-id="'+esc(String(e.id))+'"';
        const m=typeof mxCatMeta==='function'&&e.category?mxCatMeta(e.category):{color:'#A0A4AE',emoji:''};
        const lead='<div class="mx-ib" style="background:'+esc(mxTint(m.color,22))+';color:'+esc(m.color)+'">'+esc(m.emoji||mxInitial(e.description))+'</div>';
        return '<div class="mx-it tap'+(e.excluded?' wk-off':'')+'" role="button" '+tap+'>'+lead
          +'<div class="mx-tx"><div class="mx-t">'+esc(e.description||'Movimiento')+'</div><div class="mx-s">'+esc(mxDayLabel(dateToYMD(e.date)))+(e.excluded?' · No cuenta en el límite':'')+'</div></div>'
          +'<div class="mx-r">'+esc(wkMoney(e.ars))+'</div></div>';
      }).join(''):'<div class="mx-none">Todavía no hay gastos esta semana</div>')+'</div>'
    +'<div class="wk-foot">Cuenta tarjetas, débito y efectivo. No cuenta cuotas, suscripciones ni gastos fijos. Tocá un gasto para dejarlo afuera del límite.</div>';
}

// Hoja para poner o cambiar el límite y el día en que arranca la semana
let _wkStartPick=1;
function wkOpenEditor(){
  const c=wkConfig();
  _wkStartPick=c?Number(c.weekStart):1;
  const amount=c&&c.amount?c.amount:wkSuggestedLimit();
  const inner=mxSheetTop('Límite semanal', '<button onclick="mxDismissSheet()">Cancelar</button>', '<button class="strong" onclick="wkSaveEditor()">Guardar</button>')
    +'<div class="mx-sheet-stack">'
      +'<div class="mx-w full"><div class="mx-lb">¿Cuánto querés gastar por semana?</div>'
        +'<div class="wk-input"><span>$</span><input id="wk-amount" type="text" inputmode="numeric" autocomplete="off" placeholder="390.000" value="'+(amount?esc(Math.round(amount).toLocaleString('es-AR')):'')+'" oninput="wkFormatInput(this)"></div>'
        +'<div class="mx-sub">Solo el gasto del día a día: comida, salidas, transporte, compras.</div></div>'
      +'<div class="mx-w full"><div class="mx-lb">La semana arranca el</div><div class="wk-days-pick" id="wk-days-pick">'+wkStartPickHtml()+'</div></div>'
    +'</div>';
  if(typeof mxOpenSheet==='function' && mxIsMobile()) mxOpenSheet(inner, 'wk-sheet');
  else wkOpenDesktopEditor(amount);
}
function wkStartPickHtml(){
  return [1,2,3,4,5,6,0].map(d=>'<button class="'+(d===_wkStartPick?'active':'')+'" onclick="wkPickStart('+d+')">'+WK_DAY_SHORT[d]+'</button>').join('');
}
function wkPickStart(d){ _wkStartPick=d; const el=document.getElementById('wk-days-pick'); if(el) el.innerHTML=wkStartPickHtml(); }
function wkFormatInput(el){
  const digits=String(el.value||'').replace(/\D/g,'').slice(0,12);
  el.value=digits?Number(digits).toLocaleString('es-AR'):'';
}
function wkParseAmount(v){ return Number(String(v||'').replace(/\D/g,''))||0; }
function wkSaveEditor(){
  const amount=wkParseAmount(document.getElementById('wk-amount')?.value);
  if(!(amount>0)){ showToast('Poné un monto','error'); return; }
  wkSetLimit(amount, _wkStartPick);
  if(typeof mxDismissSheet==='function') mxDismissSheet();
  closeWkDesktopEditor();
  renderSemanaPage();
  showToast('✓ Límite guardado: '+wkMoney(amount)+' por semana','success');
}
function wkToggleExcluded(id){
  const c=wkConfig(); if(!c) return;
  const k=String(id);
  const i=c.excluded.map(String).indexOf(k);
  if(i>=0){ c.excluded.splice(i,1); showToast('Vuelve a contar en el límite','info'); }
  else { c.excluded.push(k); showToast('Ya no cuenta en el límite','info'); }
  saveState();
  if(typeof mxKeepRowInPlace==='function' && mxIsMobile()) mxKeepRowInPlace(k, renderSemanaPage);
  else renderSemanaPage();
}

// ══ Compu ══
function renderSemanaDesktop(){
  const root=document.getElementById('wk-desktop');
  if(!root) return;
  const w=wkCompute();
  if(!w){
    root.innerHTML='<div class="wk-d-shell"><header class="wk-d-head"><div><h1>Límite semanal</h1><p>Un tope para el gasto del día a día, semana a semana.</p></div></header>'
      +'<section class="wk-d-card wk-d-empty"><div class="wk-empty-ic">🎯</div><h2>Poné tu límite semanal</h2>'
      +'<p>Elegís cuánto querés gastar por semana y te vamos diciendo cuánto te queda, cuánto podés gastar hoy y cómo venís. Las cuotas, suscripciones y gastos fijos no cuentan: ya están comprometidos.</p>'
      +'<button class="btn btn-primary" onclick="wkOpenEditor()">Poner límite</button></section></div>';
    return;
  }
  const over=w.left<0;
  const insights=wkInsights(w);
  const color=wkStatusColor(w.status);
  root.innerHTML=`
  <div class="wk-d-shell">
    <header class="wk-d-head">
      <div><h1>Límite semanal</h1><p>${esc(wkRangeLabel(w))} · día ${w.dayIdx} de 7</p></div>
      <button class="btn btn-ghost btn-sm" onclick="wkOpenEditor()">✎ ${esc(wkMoney(w.limit))} por semana</button>
    </header>
    <section class="wk-d-hero wk-${w.status}">
      <div class="wk-d-hero-main">
        <div class="wk-d-kicker">${over?'Te pasaste esta semana':'Te quedan esta semana'}</div>
        <div class="wk-d-amount" style="color:${over?color:'var(--text)'}">${esc(wkMoney(Math.abs(w.left)))}</div>
        ${wkProgressHtml(w,'wk-prog')}
        <div class="wk-prog-leg"><span>Gastaste <b>${esc(wkMoney(w.spent))}</b> de ${esc(wkMoney(w.limit))}</span><span class="wk-pill" style="color:${color};background:color-mix(in srgb, ${color} 13%, transparent)">${esc(wkStatusLabel(w))}</span></div>
      </div>
      <div class="wk-d-stats">
        <div><span>Hoy podés gastar</span><strong>${esc(over?'$0':(w.todayLeft>=0?wkMoney(w.todayLeft):'−'+wkMoney(-w.todayLeft)))}</strong><small>${w.spentToday>0?'Ya gastaste '+esc(wkMoney(w.spentToday))+' hoy':'Para seguir en ritmo'}</small></div>
        <div><span>${w.daysLeft>1?'Por día desde mañana':'Último día'}</span><strong>${esc(over?'$0':wkMoney(w.daysLeft>1?w.perDayAfter:w.perDayNow))}</strong><small>${w.daysLeft>1?(w.daysLeft-1)+' día'+(w.daysLeft-1===1?'':'s')+' más':'La semana cierra hoy'}</small></div>
        <div><span>Al ritmo de hoy cerrás en</span><strong>${w.projection!=null?esc(wkMoney(w.projection)):'—'}</strong><small>${w.projection!=null?(w.projection>w.limit?'Pasado por '+esc(wkMoney(w.projection-w.limit)):'Te sobran '+esc(wkMoney(w.limit-w.projection))):'Desde el segundo día'}</small></div>
      </div>
    </section>
    <div class="wk-d-grid">
      <section class="wk-d-card">
        <div class="wk-d-card-head"><h2>Cómo vas</h2></div>
        <div class="wk-d-ins">${insights.map(i=>`<div class="wk-d-in"><span class="wk-ins-ic ${i.tone}">${esc(i.icon)}</span><div><b>${esc(i.title)}</b><p>${esc(i.text)}</p></div></div>`).join('')}</div>
      </section>
      <section class="wk-d-card">
        <div class="wk-d-card-head"><h2>Día por día</h2><span class="wk-d-muted">${esc(wkRangeLabel(w))}</span></div>
        ${wkDaysChartHtml(w,'wk-days')}
      </section>
      <section class="wk-d-card">
        <div class="wk-d-card-head"><h2>Semanas anteriores</h2>${w.streak?`<span class="wk-pill" style="color:#169C4B;background:color-mix(in srgb, #169C4B 13%, transparent)">🏆 ${w.streak} seguida${w.streak===1?'':'s'}</span>`:''}</div>
        ${w.history.length?`<div class="wk-d-hist">${w.history.slice(0,6).map(h=>`<div class="wk-d-hrow"><span class="wk-hist-ic ${h.met?'ok':'bad'}">${h.met?'✓':'✕'}</span><span class="wk-d-hlab">${esc(wkDayMonth(h.start))} al ${esc(wkDayMonth(h.end))}</span><span class="wk-d-hbar"><i style="width:${Math.min(100,h.spent/w.limit*100).toFixed(1)}%;background:${h.met?'#169C4B':'#E5383B'}"></i></span><b>${esc(wkMoney(h.spent))}</b></div>`).join('')}</div>`:'<p class="wk-d-muted">Todavía no hay semanas anteriores.</p>'}
      </section>
      <section class="wk-d-card">
        <div class="wk-d-card-head"><h2>Gastos de la semana</h2><span class="wk-d-muted">Clic para dejar uno afuera</span></div>
        ${w.entries.length?`<div class="wk-d-list">${w.entries.map(e=>`<button class="wk-d-row${e.excluded?' wk-off':''}" onclick="wkToggleExcluded(this.dataset.id)" data-id="${esc(String(e.id))}"><span class="wk-d-rdate">${esc(WK_DAY_SHORT[wkNoon(e.date).getDay()])} ${esc(wkDayMonth(wkNoon(e.date)))}</span><span class="wk-d-rname">${esc(e.description||'Movimiento')}${e.excluded?' <em>no cuenta</em>':''}</span><span class="wk-d-rcat">${esc(e.category||'')}</span><b>${esc(wkMoney(e.ars))}</b></button>`).join('')}</div>`:'<p class="wk-d-muted">Todavía no hay gastos esta semana.</p>'}
      </section>
    </div>
    <p class="wk-d-foot">Cuenta tarjetas, débito y efectivo. No cuenta cuotas, suscripciones ni gastos fijos.</p>
  </div>`;
}
function wkOpenDesktopEditor(amount){
  closeWkDesktopEditor();
  const el=document.createElement('div');
  el.id='wk-modal'; el.className='modal-overlay open';
  el.innerHTML='<div class="modal" style="width:440px;"><div class="modal-title">Límite semanal</div>'
    +'<div class="modal-sub">Cuánto querés gastar por semana en el día a día.</div>'
    +'<div class="input-group"><label class="input-label">Monto por semana</label>'
    +'<input id="wk-amount" class="input-field" type="text" inputmode="numeric" placeholder="390.000" value="'+(amount?esc(Math.round(amount).toLocaleString('es-AR')):'')+'" oninput="wkFormatInput(this)"></div>'
    +'<div class="input-group" style="margin-top:14px;"><label class="input-label">La semana arranca el</label><div class="wk-days-pick" id="wk-days-pick">'+wkStartPickHtml()+'</div></div>'
    +'<div class="modal-actions"><button class="btn btn-ghost" onclick="closeWkDesktopEditor()">Cancelar</button><button class="btn btn-primary" onclick="wkSaveEditor()">Guardar</button></div></div>';
  el.addEventListener('click', ev=>{ if(ev.target===el) closeWkDesktopEditor(); });
  document.body.appendChild(el);
  setTimeout(()=>document.getElementById('wk-amount')?.focus(), 50);
}
function closeWkDesktopEditor(){ document.getElementById('wk-modal')?.remove(); }
