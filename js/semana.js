// ══ LÍMITE SEMANAL ══
// Un número para mirar todos los días: cuánto te queda para gastar esta semana. Vos ponés el
// límite, la fecha en que arranca (por ejemplo, el día que abre la tarjeta) y, si querés, la
// fecha en que termina. Las semanas son bloques de 7 días desde la fecha de arranque; si la
// última queda más corta, su límite es proporcional a los días que tiene.
// Cuenta solo el gasto del día a día (tarjetas, débito y efectivo), sin cuotas, suscripciones,
// gastos fijos ni pagos de "Camino a cero", que ya están comprometidos. Se actualiza sola.
// Además recomienda un límite para el resumen actual o el próximo: tu ingreso del mes menos
// lo que ya está comprometido en ese período, repartido por semana.
//
// Datos: state.weeklyLimit = {amount, startDate 'YYYY-MM-DD', endDate 'YYYY-MM-DD' | '', excluded:[ids]}

const WK_DAY_SHORT=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const WK_DAY_LONG=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const WK_DAY_LETTER=['D','L','M','M','J','V','S'];
const WK_HISTORY_WEEKS=8;

// ── Fechas ──
function wkNoon(d){ const x=d instanceof Date?new Date(d):new Date(String(d).slice(0,10)+'T12:00:00'); x.setHours(12,0,0,0); return x; }
function wkAddDays(d, n){ const x=wkNoon(d); x.setDate(x.getDate()+n); return x; }
function wkAddMonth(d){ const x=wkNoon(d); x.setMonth(x.getMonth()+1); return x; }
function wkDiffDays(a, b){ return Math.round((wkNoon(b)-wkNoon(a))/86400000); }
function wkValidYmd(v){ return /^\d{4}-\d{2}-\d{2}$/.test(String(v||'')) && !Number.isNaN(wkNoon(v).getTime()); }
function wkMoney(n){ return '$'+Math.round(Number(n)||0).toLocaleString('es-AR'); }
function wkDayMonth(d){ return wkNoon(d).toLocaleDateString('es-AR',{day:'numeric',month:'short'}).replace('.',''); }
function wkDayLabel(d){ const x=wkNoon(d); return WK_DAY_SHORT[x.getDay()]+' '+wkDayMonth(x); }

// ── Estado ──
function wkConfig(){
  const c=state.weeklyLimit;
  if(!c || typeof c!=='object') return null;
  if(!Array.isArray(c.excluded)) c.excluded=[];
  // Versión anterior: solo el día de la semana. Se pasa a una fecha: el último de ese día.
  if(!wkValidYmd(c.startDate)){
    const day=Number(c.weekStart)>=0 && Number(c.weekStart)<=6 ? Number(c.weekStart) : 1;
    const t=wkNoon(new Date());
    c.startDate=dateToYMD(wkAddDays(t, -((t.getDay()-day+7)%7)));
  }
  if(c.endDate && (!wkValidYmd(c.endDate) || c.endDate<c.startDate)) c.endDate='';
  return c;
}
function wkHasLimit(){ const c=wkConfig(); return !!(c && Number(c.amount)>0); }
function wkSetLimit(amount, startDate, endDate){
  const prev=wkConfig()||{};
  state.weeklyLimit={amount:Math.round(Number(amount)||0), startDate, endDate:endDate||'', excluded:prev.excluded||[], updatedAt:new Date().toISOString()};
  saveState();
}

// ── Gasto del día a día ──
// Pagos de "Camino a cero" (préstamos, deudas) ya están comprometidos: no cuentan.
function wkIsPlanTxn(e){
  if(typeof czIsPlanEntry!=='function' || typeof czLinkedSets!=='function' || !state.caminoPlan) return false;
  try{ return czIsPlanEntry(e, czLinkedSets()); }catch(_){ return false; }
}
// Movimientos reales de cualquier medio de pago, sin compromisos; marca los que dejaste afuera.
function wkEntries(startStr, endStr){
  if(typeof getPeriodExpenseEntries!=='function') return [];
  const c=wkConfig();
  const excluded=new Set((c && c.excluded||[]).map(String));
  const rate=typeof _periodUsdRate==='function'?_periodUsdRate():1;
  return getPeriodExpenseEntries({startStr, endStr, includeProjected:false})
    .filter(e=>!(typeof isCommitmentTxn==='function' && isCommitmentTxn(e.txn)) && !wkIsPlanTxn(e))
    .map(e=>Object.assign({}, e, {ars:(Number(e.amount)||0)*((e.currency||'ARS')==='USD'?rate:1), excluded:excluded.has(String(e.id))}));
}
function wkSum(entries){ return entries.filter(e=>!e.excluded).reduce((s,e)=>s+e.ars,0); }

// ── Semanas del objetivo ──
// Semana n (desde 0): arranca en startDate + 7n; la última se corta en endDate.
function wkWeekAt(c, n){
  const s=wkAddDays(c.startDate, 7*n);
  let e=wkAddDays(s, 6);
  if(c.endDate && dateToYMD(e)>c.endDate) e=wkNoon(c.endDate);
  const days=wkDiffDays(s,e)+1;
  return {n, start:s, end:e, startStr:dateToYMD(s), endStr:dateToYMD(e), days, limit:Number(c.amount)*days/7};
}
function wkWeekCount(c){ return c.endDate ? Math.floor(wkDiffDays(c.startDate, c.endDate)/7)+1 : null; }

// ── Todo lo que muestra la pantalla, en un solo cálculo ──
function wkCompute(todayRef){
  const c=wkConfig();
  if(!c || !(Number(c.amount)>0)) return null;
  const today=wkNoon(todayRef||new Date());
  const todayStr=dateToYMD(today);
  const total=wkWeekCount(c);
  const base={amount:Number(c.amount), startDate:c.startDate, endDate:c.endDate||'', totalWeeks:total, todayStr};

  // Todavía no arrancó
  if(todayStr<c.startDate){
    return Object.assign(base, {phase:'upcoming', daysToStart:wkDiffDays(today, c.startDate), first:wkWeekAt(c,0)});
  }
  // Ya terminó: resumen del objetivo
  if(c.endDate && todayStr>c.endDate){
    const weeks=[];
    for(let n=0;n<total;n++){ const wk=wkWeekAt(c,n); const sp=wkSum(wkEntries(wk.startStr, wk.endStr)); weeks.push(Object.assign(wk,{spent:sp, met:sp<=wk.limit})); }
    const spent=weeks.reduce((a,w)=>a+w.spent,0), limit=weeks.reduce((a,w)=>a+w.limit,0);
    return Object.assign(base, {phase:'ended', weeks, spent, limit, met:weeks.filter(w=>w.met).length});
  }

  const n=Math.floor(wkDiffDays(c.startDate, today)/7);
  const wk=wkWeekAt(c,n);
  const limit=wk.limit;
  const start=wk.start, end=wk.end, startStr=wk.startStr, endStr=wk.endStr;
  const dayIdx=wkDiffDays(start, today)+1;
  const daysLeft=wk.days-dayIdx+1; // con hoy

  const entries=wkEntries(startStr, endStr).filter(e=>dateToYMD(e.date)<=todayStr);
  const counted=entries.filter(e=>!e.excluded);
  const spent=wkSum(entries);
  const spentToday=wkSum(entries.filter(e=>dateToYMD(e.date)===todayStr));
  const spentBefore=spent-spentToday;
  const left=limit-spent;
  // Hoy: lo que quedaba al empezar el día, repartido entre los días que faltan
  const todayBudget=Math.max(0, limit-spentBefore)/daysLeft;
  const todayLeft=todayBudget-spentToday;
  const perDayAfter=daysLeft>1 ? Math.max(0,left)/(daysLeft-1) : 0;
  const perDayNow=Math.max(0,left)/daysLeft;
  const ideal=limit*dayIdx/wk.days;
  const pct=limit?spent/limit*100:0;
  const pctTime=dayIdx/wk.days*100;
  const projection=dayIdx>=2 ? spent/dayIdx*wk.days : null;

  let status='ok';
  if(spent>limit) status='over';
  else if(spent>ideal*1.05) status='warn';
  else if(spent<=ideal*0.7) status='great';

  const dailyTarget=limit/wk.days;
  const days=[];
  for(let i=0;i<wk.days;i++){
    const d=wkAddDays(start,i); const ymd=dateToYMD(d);
    days.push({ymd, date:d, letter:WK_DAY_LETTER[d.getDay()], short:WK_DAY_SHORT[d.getDay()], spent:wkSum(entries.filter(e=>dateToYMD(e.date)===ymd)), isToday:ymd===todayStr, isFuture:ymd>todayStr});
  }

  const byCat=new Map();
  counted.forEach(e=>{ const k=(!e.category||e.category==='Procesando...'||e.category==='Uncategorized')?'Sin categoría':e.category; byCat.set(k,(byCat.get(k)||0)+e.ars); });
  const cats=[...byCat.entries()].sort((a,b)=>b[1]-a[1]).map(([cat,v])=>({cat,v}));

  // Los 7 días anteriores hasta el mismo día, para comparar
  const prevStart=wkAddDays(start,-7);
  const prevSameDay=wkSum(wkEntries(dateToYMD(prevStart), dateToYMD(wkAddDays(prevStart,dayIdx-1))));

  // Semanas anteriores de este objetivo y racha de semanas cumplidas
  const history=[];
  for(let k=n-1; k>=0 && history.length<WK_HISTORY_WEEKS; k--){
    const h=wkWeekAt(c,k);
    const sp=wkSum(wkEntries(h.startStr, h.endStr));
    history.push(Object.assign(h,{spent:sp, met:sp<=h.limit}));
  }
  let streak=0; for(const h of history){ if(h.met) streak++; else break; }

  let zeroDays=0;
  for(let i=dayIdx-1;i>=0;i--){ if(days[i].spent<=0) zeroDays++; else break; }
  const biggest=counted.slice().sort((a,b)=>b.ars-a.ars)[0]||null;

  return Object.assign(base, {phase:'active', weekNum:n+1, limit, weekDays:wk.days, start, end, startStr, endStr, dayIdx, daysLeft,
    spent, spentToday, spentBefore, left, todayBudget, todayLeft, perDayAfter, perDayNow, ideal, pct, pctTime, projection, status,
    days, dailyTarget, cats, prevSameDay, history, streak, zeroDays, biggest, isLastWeek:!!(total && n+1>=total),
    entries:entries.slice().sort((a,b)=>new Date(b.date)-new Date(a.date))});
}

// ── Límite recomendado ──
// Ingreso del mes menos lo comprometido en el período del resumen (cuotas, suscripciones,
// gastos fijos y pagos de "Camino a cero"), repartido por semana. En el resumen actual se
// descuenta además lo que ya gastaste y se reparte entre los días que faltan.
function wkMonthlyIncome(){
  const rate=typeof _periodUsdRate==='function'?_periodUsdRate():1;
  const months=(state.incomeMonths||[]).slice().sort((a,b)=>String(b.month).localeCompare(String(a.month)));
  if(months.length && typeof getMonthTotalCombined==='function'){
    const v=getMonthTotalCombined(months[0]);
    if(v>0) return {ars:v, source:'Ingreso: '+(typeof fmtMonthLabel==='function'?fmtMonthLabel(months[0].month):months[0].month)};
  }
  const usd=Number(state.caminoPlan && state.caminoPlan.salaryUsd)||0;
  if(usd>0) return {ars:usd*rate, source:'Ingreso: sueldo de Camino a cero'};
  return {ars:0, source:''};
}
// Los períodos de la tarjeta principal (la Visa; si no hay, las dos juntas; si no, el mes)
function wkCyclePeriods(todayRef){
  const today=dateToYMD(wkNoon(todayRef||new Date()));
  let list=[];
  try{
    for(const mode of ['visa','tarjetas']){
      const cycles=(typeof getTcCycles==='function'?getTcCycles(mode):[])||[];
      list=cycles.map((cy,i)=>({open:getTcCycleOpen(cycles,i), close:cy.closeDate})).filter(p=>p.open&&p.close)
        .sort((a,b)=>a.close.localeCompare(b.close));
      if(list.some(p=>today>=p.open && today<=p.close)) break;
    }
  }catch(_){ list=[]; }
  const cur=list.find(p=>today>=p.open && today<=p.close);
  if(cur){
    const next=list.find(p=>p.open>cur.close)
      || {open:dateToYMD(wkAddDays(cur.close,1)), close:dateToYMD(wkAddMonth(cur.close))};
    return {current:cur, next, byCard:true};
  }
  const r=getMonthRange(getMonthKey(wkNoon(today)));
  const r2=getMonthRange(getMonthKey(wkAddDays(r.endStr,1)));
  return {current:{open:r.startStr, close:r.endStr}, next:{open:r2.startStr, close:r2.endStr}, byCard:false};
}
function wkCommitmentsInRange(startStr, endStr){
  const rate=typeof _periodUsdRate==='function'?_periodUsdRate():1;
  const toArs=(a,cur)=>(Number(a)||0)*((cur||'ARS')==='USD'?rate:1);
  const out={cuotas:0, suscripciones:0, fijos:0, plan:0, items:[]};
  const add=(group, name, ars, date)=>{ if(!(ars>0)) return; out[group]+=ars; out.items.push({group, name, ars, date}); };
  const links=(typeof czLinkedSets==='function' && state.caminoPlan)?czLinkedSets():null;
  // Cobros reales que ya entraron (cuotas, suscripciones, fijos)
  (state.transactions||[]).forEach(t=>{
    if(!t || t.isPendingCuota || t.isPendingSubscription) return;
    const y=dateToYMD(t.date); if(y<startStr || y>endStr) return;
    if(links && wkIsPlanTxn({txn:t})) return;
    if(typeof isCommitmentTxn!=='function' || !isCommitmentTxn(t)) return;
    const group=(t.cuotaNum||t.cuotaGroupId)?'cuotas':t.sourceSubscriptionId?'suscripciones':'fijos';
    add(group, t.description||'', toArs(t.amount,t.currency), y);
  });
  // Los que todavía no se cobraron
  if(typeof getProjectedCommitmentEntriesForRange==='function'){
    getProjectedCommitmentEntriesForRange({startStr, endStr, txns:state.transactions||[]}).forEach(e=>{
      if(!['cuotas','suscripciones','fijos'].includes(e.group)) return;
      if(links && (links.groups.has(e.cuotaGroupId) || links.fixed.has(e.sourceFixedId))) return;
      add(e.group, e.title||'', toArs(e.personalAmount!=null?e.personalAmount:e.amount, e.currency), dateToYMD(e.date));
    });
  }
  // Pagos de "Camino a cero" (préstamos y deudas) que caen en el período
  if(state.caminoPlan && typeof czSchedule==='function' && typeof czPlan==='function'){
    czPlan().items.filter(i=>i.status!=='esperando' && i.status!=='pagado').forEach(item=>{
      czSchedule(item).forEach(s=>{ const y=dateToYMD(s.date); if(y>=startStr && y<=endStr) add('plan', item.name||'', toArs(s.amount,s.currency), y); });
    });
  }
  out.total=out.cuotas+out.suscripciones+out.fijos+out.plan;
  return out;
}
// Calculadora: gastos extra que vas a tener y cuánto querés ahorrar (se guardan para la próxima)
function wkCalc(){
  if(!state.weeklyLimitCalc || typeof state.weeklyLimitCalc!=='object') state.weeklyLimitCalc={extras:[], savings:0};
  const c=state.weeklyLimitCalc;
  if(!Array.isArray(c.extras)) c.extras=[];
  c.savings=Math.max(0, Number(c.savings)||0);
  return c;
}
function wkRecommend(which, todayRef, opts){
  const today=wkNoon(todayRef||new Date());
  const periods=wkCyclePeriods(today);
  const p=which==='current'?periods.current:periods.next;
  const income=wkMonthlyIncome();
  const com=wkCommitmentsInRange(p.open, p.close);
  let startStr=p.open, spent=0;
  if(which==='current'){
    startStr=dateToYMD(today);
    const before=dateToYMD(wkAddDays(today,-1));
    spent=before>=p.open?wkSum(wkEntries(p.open, before)):0;
  }
  const days=wkDiffDays(startStr, p.close)+1;
  const weeks=days/7;
  const calc=opts||{extras:[], savings:0};
  const extras=(calc.extras||[]).reduce((a,e)=>a+(Number(e.amount)||0),0);
  const savings=Math.max(0, Number(calc.savings)||0);
  const available=income.ars-com.total-spent-extras-savings;
  const raw=weeks>0?available/weeks:0;
  const weekly=raw>0?Math.floor(raw/5000)*5000:0;
  return {which, open:p.open, close:p.close, startStr, endStr:p.close, days, weeks, byCard:periods.byCard,
    income:income.ars, incomeSource:income.source, commitments:com, spent, extras, savings, available, weekly, raw};
}

// ── Consejos: los más importantes primero, como mucho cuatro ──
function wkInsights(w){
  if(!w || w.phase!=='active') return [];
  const out=[];
  const endName=WK_DAY_LONG[w.end.getDay()];
  const nextName=WK_DAY_LONG[wkAddDays(w.end,1).getDay()];
  if(w.status==='over'){
    out.push({tone:'bad', icon:'✋', title:'Te pasaste '+wkMoney(-w.left)+' del límite',
      text:w.isLastWeek?'Es la última semana del objetivo: lo mejor es no gastar más hasta el '+endName+'.'
        :'Lo mejor es no gastar más hasta el '+nextName+', que arranca una semana nueva.'});
  } else if(w.status==='warn'){
    out.push({tone:'warn', icon:'⚡', title:'Vas más rápido que el plan',
      text:'Es el día '+w.dayIdx+' de '+w.weekDays+' y ya usaste el '+Math.round(w.pct)+'%. Para llegar, no pases de '+wkMoney(w.daysLeft>1?w.perDayAfter:w.perDayNow)+' por día'+(w.daysLeft>1?' desde mañana':'')+'.'});
  } else if(w.spent<=0 && w.dayIdx>=2){
    out.push({tone:'good', icon:'🌱', title:'Día '+w.dayIdx+' y todavía no gastaste nada', text:'Excelente. Así se arma una semana con margen.'});
  } else if(w.status==='great'){
    const spare=w.projection!=null ? w.limit-w.projection : w.left;
    out.push({tone:'good', icon:'🎯', title:'Vas muy bien',
      text:'Usaste el '+Math.round(w.pct)+'% y ya pasó el '+Math.round(w.pctTime)+'% de la semana.'+(spare>0?' Si seguís así te sobran '+wkMoney(spare)+'.':'')});
  } else {
    out.push({tone:'info', icon:'✓', title:'Vas en ritmo',
      text:'Te quedan '+wkMoney(w.left)+' para '+(w.daysLeft===1?'hoy, el último día':w.daysLeft+' días, contando hoy')+'. Mantené este ritmo y llegás bien.'});
  }
  if(w.biggest && w.biggest.ars>=w.limit*0.25 && w.status!=='over'){
    out.push({tone:'warn', icon:'💸', title:'Un gasto se llevó el '+Math.round(w.biggest.ars/w.limit*100)+'% del límite',
      text:(w.biggest.description||'Un movimiento')+': '+wkMoney(w.biggest.ars)+'. Si fue algo planeado, tocalo en la lista para dejarlo afuera.'});
  }
  if(w.zeroDays>=2 && w.spent>0) out.push({tone:'good', icon:'🔥', title:w.zeroDays+' días seguidos sin gastar', text:'Seguí así: cada día sin gastos te deja más margen para el resto de la semana.'});
  if(w.prevSameDay>0 && w.dayIdx>=2){
    const diff=w.spent-w.prevSameDay;
    if(Math.abs(diff)>=w.limit*0.05){
      out.push(diff<0
        ? {tone:'good', icon:'📉', title:'Gastás menos que la semana pasada', text:'A esta altura llevabas '+wkMoney(w.prevSameDay)+'. Hoy vas '+wkMoney(-diff)+' abajo.'}
        : {tone:'warn', icon:'📈', title:'Gastás más que la semana pasada', text:'A esta altura llevabas '+wkMoney(w.prevSameDay)+'. Hoy vas '+wkMoney(diff)+' arriba.'});
    }
  }
  if(w.cats.length && w.spent>0){
    const top=w.cats[0];
    out.push({tone:'info', icon:'🔎', title:'Lo que más pesa: '+top.cat, text:wkMoney(top.v)+', el '+Math.round(top.v/w.spent*100)+'% de lo que gastaste esta semana.'});
  }
  if(w.streak>=2) out.push({tone:'good', icon:'🏆', title:w.streak+' semanas seguidas cumpliendo', text:'Mantené la racha hasta el '+endName+'.'});
  return out.slice(0,4);
}

// ── Piezas comunes ──
function wkStatusLabel(w){ return {over:'Te pasaste', warn:'Más rápido que el plan', great:'Vas muy bien', ok:'En ritmo'}[w.status]; }
function wkStatusColor(status){ return {over:'#E5383B', warn:'#E8730C', great:'#169C4B', ok:'#169C4B'}[status]||'#169C4B'; }
function wkProgressHtml(w, cls){
  return '<div class="'+cls+'"><i style="width:'+Math.min(100,w.pct).toFixed(1)+'%;background:'+wkStatusColor(w.status)+'"></i>'
    +'<em style="left:'+Math.min(100,w.pctTime).toFixed(1)+'%" title="Hoy"></em></div>';
}
function wkShort(n){
  n=Math.round(n);
  if(n>=1000000) return '$'+(n/1000000).toFixed(n>=10000000?0:1).replace('.',',')+'M';
  if(n>=1000) return '$'+Math.round(n/1000)+'k';
  return '$'+n;
}
function wkDaysChartHtml(w, cls){
  const max=Math.max(w.dailyTarget*1.6, ...w.days.map(d=>d.spent), 1);
  const line=(w.dailyTarget/max*100).toFixed(1);
  return '<div class="'+cls+'"><div class="wk-bars" style="grid-template-columns:repeat('+w.days.length+',1fr)" role="img" aria-label="Gasto de cada día de la semana contra el promedio diario del límite">'
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
function wkRangeLabel(w){ return wkDayLabel(w.start)+' al '+wkDayLabel(w.end); }
function wkObjectiveLabel(w){ return 'Desde el '+wkDayLabel(w.startDate)+(w.endDate?' hasta el '+wkDayLabel(w.endDate):', sin fecha de fin'); }
function wkWeekTag(w){ return 'Semana '+w.weekNum+(w.totalWeeks?' de '+w.totalWeeks:''); }

// ── Pantalla ──
function renderSemanaPage(){
  renderSemanaDesktop();
  renderMobileSemana();
}

// ══ Celular ══
function wkMobileEmpty(){
  return mxBand('Semana')
    +'<div class="mx-grid"><div class="mx-w full mx-empty wk-empty">'
      +'<div class="wk-empty-ic">🎯</div>'
      +'<div class="mx-md">Poné tu límite semanal</div>'
      +'<div class="mx-sub">Elegís cuánto querés gastar por semana en el día a día, desde qué fecha y, si querés, hasta cuándo. Te vamos diciendo cuánto te queda, cuánto podés gastar hoy y cómo venís. Las cuotas, suscripciones y gastos fijos no cuentan: ya están comprometidos.</div>'
      +'<button class="mx-go wide" onclick="wkOpenEditor()">Poner límite</button>'
    +'</div></div>';
}
function renderMobileSemana(){
  const shell=document.getElementById('mob-week-shell');
  if(!shell || typeof mxIsMobile!=='function' || !mxIsMobile()) return;
  if(typeof mxSyncThemeColor==='function') mxSyncThemeColor();
  const w=wkCompute();
  if(!w){ shell.innerHTML=wkMobileEmpty(); return; }
  const chip='<button class="wk-chip" onclick="wkOpenEditor()" aria-label="Cambiar límite">'+esc(wkShort(w.amount))+' / sem ✎</button>';
  if(w.phase==='upcoming'){
    shell.innerHTML=mxBand('Semana')
      +'<div class="mx-grid"><div class="mx-w full wk-hero">'
        +'<div class="wk-hero-top"><div class="mx-lb">Tu límite arranca '+(w.daysToStart===1?'mañana':'en '+w.daysToStart+' días')+'</div>'+chip+'</div>'
        +'<div class="mx-big wk-amt">'+esc(wkMoney(w.first.limit))+'</div>'
        +'<div class="mx-sub">Primera semana: '+esc(wkDayLabel(w.first.start))+' al '+esc(wkDayLabel(w.first.end))+'</div>'
        +'<div class="wk-obj">'+esc(wkObjectiveLabel(w))+(w.totalWeeks?' · '+w.totalWeeks+' semana'+(w.totalWeeks===1?'':'s'):'')+'</div>'
      +'</div></div>'
      +'<div class="wk-foot">Hasta entonces no cuenta nada. Podés cambiar el monto o las fechas tocando el límite.</div>'
      +wkActionsHtml(true);
    return;
  }
  if(w.phase==='ended'){
    shell.innerHTML=mxBand('Semana')
      +'<div class="mx-grid"><div class="mx-w full wk-hero">'
        +'<div class="wk-hero-top"><div class="mx-lb">Terminó tu objetivo</div>'+chip+'</div>'
        +'<div class="mx-big wk-amt">'+w.met+' de '+w.weeks.length+'</div>'
        +'<div class="mx-sub">semanas cumplidas · gastaste '+esc(wkMoney(w.spent))+' de '+esc(wkMoney(w.limit))+'</div>'
        +'<div class="wk-obj">'+esc(wkObjectiveLabel(w))+'</div>'
        +'<button class="mx-go wide" onclick="wkOpenEditor(true)">Nuevo objetivo</button>'
      +'</div></div>'
      +mxSh('Cómo te fue', '', true)
      +'<div class="mx-list">'+w.weeks.slice().reverse().map(h=>wkHistItem(h)).join('')+'</div>'
      +wkActionsHtml(true);
    return;
  }
  const over=w.left<0;
  const insights=wkInsights(w);
  const todayTxt=w.todayLeft>=0?wkMoney(w.todayLeft):'−'+wkMoney(-w.todayLeft);
  shell.innerHTML=mxBand('Semana')
    +'<div class="mx-grid">'
      +'<div class="mx-w full wk-hero wk-'+w.status+'">'
        +'<div class="wk-hero-top"><div class="mx-lb">'+(over?'Te pasaste esta semana':'Te quedan esta semana')+'</div>'+chip+'</div>'
        +'<div class="mx-big wk-amt">'+esc(wkMoney(Math.abs(w.left)))+'</div>'
        +wkProgressHtml(w,'wk-prog')
        +'<div class="wk-prog-leg"><span>Gastaste <b>'+esc(wkMoney(w.spent))+'</b> de '+esc(wkMoney(w.limit))+'</span><span>Día '+w.dayIdx+' de '+w.weekDays+'</span></div>'
        +'<div class="wk-hero-foot"><span class="wk-pill" style="color:'+wkStatusColor(w.status)+';background:color-mix(in srgb, '+wkStatusColor(w.status)+' 12%, white)">'+esc(wkStatusLabel(w))+'</span>'
          +'<span class="wk-week-tag">'+esc(wkWeekTag(w))+'</span></div>'
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
      +'<div class="mx-list">'+w.history.slice(0,6).map(h=>wkHistItem(h)).join('')+'</div>':'')
    +mxSh('Gastos de la semana', w.entries.length?w.entries.length+'':'', true)
    +'<div class="mx-list">'+(w.entries.length?w.entries.map(e=>{
        const tap='onclick="wkToggleExcluded(this.dataset.id)" data-id="'+esc(String(e.id))+'"';
        const m=typeof mxCatMeta==='function'&&e.category?mxCatMeta(e.category):{color:'#A0A4AE',emoji:''};
        const lead='<div class="mx-ib" style="background:'+esc(mxTint(m.color,22))+';color:'+esc(m.color)+'">'+esc(m.emoji||mxInitial(e.description))+'</div>';
        return '<div class="mx-it tap'+(e.excluded?' wk-off':'')+'" role="button" '+tap+'>'+lead
          +'<div class="mx-tx"><div class="mx-t">'+esc(e.description||'Movimiento')+'</div><div class="mx-s">'+esc(mxDayLabel(dateToYMD(e.date)))+(e.excluded?' · No cuenta en el límite':'')+'</div></div>'
          +'<div class="mx-r">'+esc(wkMoney(e.ars))+'</div></div>';
      }).join(''):'<div class="mx-none">Todavía no hay gastos esta semana</div>')+'</div>'
    +'<div class="wk-foot">'+esc(wkObjectiveLabel(w))+'.<br>Cuenta tarjetas, débito y efectivo. No cuenta cuotas, suscripciones ni gastos fijos. Tocá un gasto para dejarlo afuera del límite.</div>'
    +wkActionsHtml(true);
}
function wkHistItem(h){
  return '<div class="mx-it"><div class="mx-ib wk-hist"><span class="wk-hist-ic '+(h.met?'ok':'bad')+'">'+(h.met?'✓':'✕')+'</span></div>'
    +'<div class="mx-tx"><div class="mx-t">'+esc(wkDayMonth(h.start)+' al '+wkDayMonth(h.end))+'</div>'
    +'<div class="mx-s">'+esc(h.met?'Cumpliste · sobraron '+wkMoney(h.limit-h.spent):'Te pasaste '+wkMoney(h.spent-h.limit))+'</div></div>'
    +'<div class="mx-r">'+esc(wkMoney(h.spent))+'<small class="'+(h.met?'ok':'wa')+'">'+Math.round(h.limit?h.spent/h.limit*100:0)+'% del límite</small></div></div>';
}

// ── Hoja / ventana para poner el límite, las fechas y ver el recomendado ──
let _wkForm=null;
function wkOpenEditor(fresh){
  const c=wkConfig();
  const today=dateToYMD(wkNoon(new Date()));
  const keep=!!(c && Number(c.amount)>0 && !fresh);
  // El monto es siempre el tuyo: el último que guardaste (también al empezar uno nuevo).
  // El recomendado solo se usa si tocás "Usar este límite" en la calculadora.
  _wkForm={amount:c&&Number(c.amount)>0?Number(c.amount):0, startDate:keep?c.startDate:today, endDate:keep?(c.endDate||''):'', rec:'next', recOpen:false, adding:false};
  if(typeof mxOpenSheet==='function' && mxIsMobile()) mxOpenSheet(wkEditorInner(true), 'wk-sheet mx-tall');
  else wkOpenDesktopEditor();
}
function wkEditorInner(mobile){
  const f=_wkForm;
  const amountVal=f.amount?Math.round(f.amount).toLocaleString('es-AR'):'';
  const top=mobile?mxSheetTop('Límite semanal', '<button onclick="mxDismissSheet()">Cancelar</button>', '<button class="strong" onclick="wkSaveEditor()">Guardar</button>'):'';
  return top+'<div class="'+(mobile?'mx-sheet-scroll':'wk-dlg-scroll')+'"><div class="'+(mobile?'mx-sheet-stack':'wk-dlg-stack')+'">'
    +'<div class="mx-w full wk-card"><div class="mx-lb">¿Cuánto querés gastar por semana?</div>'
      +'<div class="wk-input"><span>$</span><input id="wk-amount" type="text" inputmode="numeric" autocomplete="off" placeholder="390.000" value="'+esc(amountVal)+'" oninput="wkFormatInput(this)"></div>'
      +'<div class="mx-sub">Solo el gasto del día a día: comida, salidas, transporte, compras.</div></div>'
    +'<div class="mx-w full wk-card"><div class="wk-date-row"><label for="wk-start">Arranca el</label><input id="wk-start" type="date" value="'+esc(f.startDate)+'" onchange="wkFormDates()"></div>'
      +'<div class="wk-date-row"><label for="wk-end">Termina el <small>(opcional)</small></label><span class="wk-date-end"><input id="wk-end" type="date" value="'+esc(f.endDate)+'" min="'+esc(f.startDate)+'" onchange="wkFormDates()">'
        +'<button class="wk-clear" onclick="wkClearEnd()" aria-label="Sin fecha de fin"'+(f.endDate?'':' hidden')+'>✕</button></span></div>'
      +'<div class="mx-sub wk-date-hint" id="wk-date-hint">'+esc(wkFormHint())+'</div></div>'
    +'<div id="wk-rec">'+wkRecHtml()+'</div>'
    +(mobile?'<button class="wk-save" onclick="wkSaveEditor()">Guardar límite</button>':'')
  +'</div></div>';
}
function wkFormHint(){
  const f=_wkForm; if(!wkValidYmd(f.startDate)) return 'Elegí la fecha de arranque.';
  const d=WK_DAY_LONG[wkNoon(f.startDate).getDay()];
  const d2=WK_DAY_LONG[wkAddDays(f.startDate,6).getDay()];
  if(!f.endDate) return 'Cada semana va de '+d+' a '+d2+', sin fecha de fin.';
  const span=wkDiffDays(f.startDate,f.endDate);
  const n=Math.floor(span/7)+1, lastDays=span%7+1;
  return n+' semana'+(n===1?'':'s')+' de '+d+' a '+d2+(lastDays<7?' (la última de '+lastDays+' día'+(lastDays===1?'':'s')+', con límite proporcional)':'')+'.';
}
function wkRecHtml(){
  const f=_wkForm;
  if(!f.recOpen){
    return '<button class="mx-w full wk-card wk-rec-closed" onclick="wkToggleRec(true)">'
      +'<span class="wk-rec-closed-ic">🧮</span><span class="wk-rec-closed-tx"><b>¿No sabés cuánto poner?</b>'
      +'<small>Calculadora: tu sueldo, tus cuotas, gastos extra y lo que quieras ahorrar.</small></span><span class="wk-rec-closed-go">Abrir ›</span></button>';
  }
  const calc=wkCalc();
  const r=wkRecommend(f.rec, null, calc);
  const head='<div class="wk-rec-head"><div class="wk-rec-h">🧮 Calculadora de límite</div><button class="wk-link" onclick="wkToggleRec(false)">Ocultar</button></div>';
  const seg='<div class="wk-seg"><button class="'+(f.rec==='current'?'active':'')+'" onclick="wkPickRec(\'current\')">'+(r.byCard?'Resumen actual':'Este mes')+'</button>'
    +'<button class="'+(f.rec==='next'?'active':'')+'" onclick="wkPickRec(\'next\')">'+(r.byCard?'Próximo resumen':'Mes que viene')+'</button></div>';
  if(!(r.income>0)){
    return '<div class="mx-w full wk-card wk-rec">'+head+seg+'<div class="mx-sub">Para calcularlo necesitamos tu ingreso: cargalo en Ingresos (o en Camino a cero) y volvé acá.</div></div>';
  }
  const row=(label, v, cls)=>'<div class="wk-rec-row'+(cls?' '+cls:'')+'"><span>'+esc(label)+'</span><b>'+esc(v)+'</b></div>';
  const c=r.commitments;
  const lines=[row('Ingreso del mes', wkMoney(r.income))];
  if(c.cuotas) lines.push(row('Cuotas', '−'+wkMoney(c.cuotas), 'neg'));
  if(c.plan) lines.push(row('Préstamos y deudas', '−'+wkMoney(c.plan), 'neg'));
  if(c.suscripciones) lines.push(row('Suscripciones', '−'+wkMoney(c.suscripciones), 'neg'));
  if(c.fijos) lines.push(row('Gastos fijos', '−'+wkMoney(c.fijos), 'neg'));
  if(r.spent) lines.push(row('Ya gastado en el período', '−'+wkMoney(r.spent), 'neg'));
  // Gastos extra que vas a tener
  const extras=calc.extras.map((e,i)=>'<div class="wk-rec-row neg wk-extra"><span>'+esc(e.name||'Gasto extra')+'</span><b>−'+esc(wkMoney(e.amount))+'</b>'
    +'<button class="wk-x" onclick="wkRemoveExtra('+i+')" aria-label="Quitar">✕</button></div>').join('');
  const addForm=f.adding
    ?'<div class="wk-add"><input id="wk-extra-name" type="text" placeholder="¿Qué gasto?" autocomplete="off" maxlength="40">'
      +'<input id="wk-extra-amount" type="text" inputmode="numeric" placeholder="$ monto" autocomplete="off" oninput="wkFormatInput(this)">'
      +'<div class="wk-add-btns"><button class="wk-link" onclick="wkCancelExtra()">Cancelar</button><button class="wk-add-ok" onclick="wkAddExtra()">Agregar</button></div></div>'
    :'<button class="wk-add-btn" onclick="wkStartExtra()">＋ Agregar un gasto extra</button>';
  // Ahorro: monto o un porcentaje del ingreso
  const pcts=[0,5,10,15].map(p=>{ const v=Math.round(r.income*p/100/1000)*1000; return '<button class="'+(Math.abs(calc.savings-v)<1?'active':'')+'" onclick="wkSetSavings('+v+')">'+(p?p+'%':'Nada')+'</button>'; }).join('');
  const wks=Math.round(r.weeks*10)/10;
  const weeksTxt=wks.toLocaleString('es-AR')+' semana'+(wks===1?'':'s');
  return '<div class="mx-w full wk-card wk-rec">'+head+seg
    +'<div class="mx-sub wk-rec-period">'+esc(wkDayLabel(r.startStr)+' al '+wkDayLabel(r.endStr))+' · '+esc(weeksTxt)+'</div>'
    +lines.join('')
    +'<div class="wk-rec-sub">Gastos extra del período</div>'+extras+addForm
    +'<div class="wk-rec-sub">Quiero ahorrar</div>'
    +'<div class="wk-sav"><span>$</span><input id="wk-savings" type="text" inputmode="numeric" placeholder="0" autocomplete="off" value="'+(calc.savings?esc(Math.round(calc.savings).toLocaleString('es-AR')):'')+'" oninput="wkFormatInput(this)" onchange="wkSetSavings(wkParseAmount(this.value))"></div>'
    +'<div class="wk-chips">'+pcts+'</div>'
    +row('Te queda para el día a día', wkMoney(r.available), 'sum')
    +(r.weekly>0
      ?'<div class="wk-rec-big"><span>Podés gastar por semana</span><b>'+esc(wkMoney(r.weekly))+'</b></div>'
        +'<button class="wk-rec-use" onclick="wkUseRec()">Usar este límite</button>'
        +'<div class="wk-rec-note">Al usarlo se completa el monto y las fechas del '+esc(wkDayMonth(r.startStr))+' al '+esc(wkDayMonth(r.endStr))+'. Después tocá Guardar.</div>'
      :'<div class="wk-rec-warn">Con estos gastos no queda margen para el día a día'+(r.savings?': probá ahorrar menos o sacar algún gasto extra.':' en este período.')+'</div>')
    +'<div class="wk-rec-note">'+esc(r.incomeSource)+'. Compromisos según lo cargado en Compromisos y Camino a cero.</div>'
  +'</div>';
}
function wkRecRefresh(){ const el=document.getElementById('wk-rec'); if(el) el.innerHTML=wkRecHtml(); }
function wkToggleRec(open){ wkReadForm(); _wkForm.recOpen=!!open; _wkForm.adding=false; wkRecRefresh(); }
function wkStartExtra(){ _wkForm.adding=true; wkRecRefresh(); setTimeout(()=>document.getElementById('wk-extra-name')?.focus(),50); }
function wkCancelExtra(){ _wkForm.adding=false; wkRecRefresh(); }
function wkAddExtra(){
  const name=String(document.getElementById('wk-extra-name')?.value||'').trim();
  const amount=wkParseAmount(document.getElementById('wk-extra-amount')?.value);
  if(!(amount>0)){ showToast('Poné el monto del gasto','error'); return; }
  wkCalc().extras.push({name:name||'Gasto extra', amount});
  _wkForm.adding=false;
  saveState();
  wkRecRefresh();
}
function wkRemoveExtra(i){ wkCalc().extras.splice(i,1); saveState(); wkRecRefresh(); }
function wkSetSavings(v){ wkCalc().savings=Math.max(0, Math.round(Number(v)||0)); saveState(); wkRecRefresh(); }
function wkReadForm(){
  if(!_wkForm) return;
  const a=document.getElementById('wk-amount'); if(a) _wkForm.amount=wkParseAmount(a.value);
  const s=document.getElementById('wk-start'); if(s && s.value) _wkForm.startDate=s.value;
  const e=document.getElementById('wk-end'); if(e) _wkForm.endDate=e.value||'';
}
function wkFormDates(){
  wkReadForm();
  if(_wkForm.endDate && _wkForm.endDate<_wkForm.startDate) _wkForm.endDate='';
  const e=document.getElementById('wk-end'); if(e){ e.min=_wkForm.startDate; e.value=_wkForm.endDate; }
  const clr=document.querySelector('.wk-clear'); if(clr) clr.hidden=!_wkForm.endDate;
  const h=document.getElementById('wk-date-hint'); if(h) h.textContent=wkFormHint();
}
function wkClearEnd(){ const e=document.getElementById('wk-end'); if(e) e.value=''; wkFormDates(); }
function wkPickRec(which){ wkReadForm(); _wkForm.rec=which; wkRecRefresh(); }
function wkUseRec(){
  wkReadForm();
  const sv=document.getElementById('wk-savings'); if(sv) wkCalc().savings=wkParseAmount(sv.value);
  const r=wkRecommend(_wkForm.rec, null, wkCalc());
  if(!(r.weekly>0)) return;
  _wkForm.amount=r.weekly; _wkForm.startDate=r.startStr; _wkForm.endDate=r.endStr;
  const a=document.getElementById('wk-amount'); if(a) a.value=Math.round(r.weekly).toLocaleString('es-AR');
  const s=document.getElementById('wk-start'); if(s) s.value=r.startStr;
  const e=document.getElementById('wk-end'); if(e) e.value=r.endStr;
  wkFormDates();
  showToast('Listo: tocá Guardar para usarlo','info');
  const amt=document.getElementById('wk-amount'); if(amt && amt.scrollIntoView) amt.scrollIntoView({behavior:'smooth', block:'center'});
}
function wkFormatInput(el){
  const digits=String(el.value||'').replace(/\D/g,'').slice(0,12);
  el.value=digits?Number(digits).toLocaleString('es-AR'):'';
}
function wkParseAmount(v){ return Number(String(v||'').replace(/\D/g,''))||0; }
function wkSaveEditor(){
  wkReadForm();
  const f=_wkForm||{};
  if(!(f.amount>0)){ showToast('Poné un monto','error'); return; }
  if(!wkValidYmd(f.startDate)){ showToast('Elegí la fecha de arranque','error'); return; }
  if(f.endDate && f.endDate<f.startDate){ showToast('La fecha de fin tiene que ser después del arranque','error'); return; }
  wkSetLimit(f.amount, f.startDate, f.endDate);
  if(typeof mxDismissSheet==='function') mxDismissSheet();
  closeWkDesktopEditor();
  renderSemanaPage();
  showToast('✓ Límite guardado: '+wkMoney(f.amount)+' por semana','success');
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
  const head=(sub, btn)=>'<header class="wk-d-head"><div><h1>Límite semanal</h1><p>'+esc(sub)+'</p></div>'+(btn||'')+'</header>';
  if(!w){
    root.innerHTML='<div class="wk-d-shell">'+head('Un tope para el gasto del día a día, semana a semana.')
      +'<section class="wk-d-card wk-d-empty"><div class="wk-empty-ic">🎯</div><h2>Poné tu límite semanal</h2>'
      +'<p>Elegís cuánto querés gastar por semana, desde qué fecha y, si querés, hasta cuándo. Te vamos diciendo cuánto te queda, cuánto podés gastar hoy y cómo venís. Las cuotas, suscripciones y gastos fijos no cuentan: ya están comprometidos.</p>'
      +'<button class="btn btn-primary" onclick="wkOpenEditor()">Poner límite</button></section></div>';
    return;
  }
  const editBtn='<button class="btn btn-ghost btn-sm" onclick="wkOpenEditor()">✎ '+esc(wkMoney(w.amount))+' por semana</button>';
  if(w.phase==='upcoming'){
    root.innerHTML='<div class="wk-d-shell">'+head(wkObjectiveLabel(w), editBtn)
      +'<section class="wk-d-hero wk-d-hero-one"><div class="wk-d-hero-main"><div class="wk-d-kicker">Tu límite arranca '+(w.daysToStart===1?'mañana':'en '+w.daysToStart+' días')+'</div>'
      +'<div class="wk-d-amount">'+esc(wkMoney(w.first.limit))+'</div><div class="wk-d-muted">Primera semana: '+esc(wkDayLabel(w.first.start))+' al '+esc(wkDayLabel(w.first.end))+(w.totalWeeks?' · '+w.totalWeeks+' semana'+(w.totalWeeks===1?'':'s')+' en total':'')+'</div></div></section>'+wkActionsHtml(false)+'</div>';
    return;
  }
  if(w.phase==='ended'){
    root.innerHTML='<div class="wk-d-shell">'+head(wkObjectiveLabel(w), '<button class="btn btn-primary btn-sm" onclick="wkOpenEditor(true)">Nuevo objetivo</button>')
      +'<section class="wk-d-hero wk-d-hero-one"><div class="wk-d-hero-main"><div class="wk-d-kicker">Terminó tu objetivo</div><div class="wk-d-amount">'+w.met+' de '+w.weeks.length+' semanas</div>'
      +'<div class="wk-d-muted">Gastaste '+esc(wkMoney(w.spent))+' de '+esc(wkMoney(w.limit))+'</div></div></section>'
      +'<section class="wk-d-card">'+wkDesktopHist(w.weeks.slice().reverse())+'</section>'+wkActionsHtml(false)+'</div>';
    return;
  }
  const over=w.left<0;
  const insights=wkInsights(w);
  const color=wkStatusColor(w.status);
  root.innerHTML=`
  <div class="wk-d-shell">
    ${head(wkWeekTag(w)+' · '+wkRangeLabel(w)+' · día '+w.dayIdx+' de '+w.weekDays, editBtn)}
    <section class="wk-d-hero wk-${w.status}">
      <div class="wk-d-hero-main">
        <div class="wk-d-kicker">${over?'Te pasaste esta semana':'Te quedan esta semana'}</div>
        <div class="wk-d-amount" style="color:${over?color:'var(--text)'}">${esc(wkMoney(Math.abs(w.left)))}</div>
        ${wkProgressHtml(w,'wk-prog')}
        <div class="wk-prog-leg"><span>Gastaste <b>${esc(wkMoney(w.spent))}</b> de ${esc(wkMoney(w.limit))}</span><span class="wk-pill" style="color:${color};background:color-mix(in srgb, ${color} 13%, transparent)">${esc(wkStatusLabel(w))}</span></div>
        <div class="wk-d-obj">${esc(wkObjectiveLabel(w))}</div>
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
      <section class="wk-d-card">${w.history.length?wkDesktopHist(w.history.slice(0,6), w.streak):'<div class="wk-d-card-head"><h2>Semanas anteriores</h2></div><p class="wk-d-muted">Es la primera semana del objetivo.</p>'}</section>
      <section class="wk-d-card">
        <div class="wk-d-card-head"><h2>Gastos de la semana</h2><span class="wk-d-muted">Clic para dejar uno afuera</span></div>
        ${w.entries.length?`<div class="wk-d-list">${w.entries.map(e=>`<button class="wk-d-row${e.excluded?' wk-off':''}" onclick="wkToggleExcluded(this.dataset.id)" data-id="${esc(String(e.id))}"><span class="wk-d-rdate">${esc(wkDayLabel(e.date))}</span><span class="wk-d-rname">${esc(e.description||'Movimiento')}${e.excluded?' <em>no cuenta</em>':''}</span><span class="wk-d-rcat">${esc(e.category||'')}</span><b>${esc(wkMoney(e.ars))}</b></button>`).join('')}</div>`:'<p class="wk-d-muted">Todavía no hay gastos esta semana.</p>'}
      </section>
    </div>
    <p class="wk-d-foot">Cuenta tarjetas, débito y efectivo. No cuenta cuotas, suscripciones ni gastos fijos.</p>
    ${wkActionsHtml(false)}
  </div>`;
}
function wkDesktopHist(list, streak){
  return '<div class="wk-d-card-head"><h2>'+(streak!=null?'Semanas anteriores':'Semana por semana')+'</h2>'
    +(streak?'<span class="wk-pill" style="color:#169C4B;background:color-mix(in srgb, #169C4B 13%, transparent)">🏆 '+streak+' seguida'+(streak===1?'':'s')+'</span>':'')+'</div>'
    +'<div class="wk-d-hist">'+list.map(h=>'<div class="wk-d-hrow"><span class="wk-hist-ic '+(h.met?'ok':'bad')+'">'+(h.met?'✓':'✕')+'</span><span class="wk-d-hlab">'+esc(wkDayMonth(h.start))+' al '+esc(wkDayMonth(h.end))+'</span>'
      +'<span class="wk-d-hbar"><i style="width:'+Math.min(100,h.limit?h.spent/h.limit*100:0).toFixed(1)+'%;background:'+(h.met?'#169C4B':'#E5383B')+'"></i></span><b>'+esc(wkMoney(h.spent))+'</b></div>').join('')+'</div>';
}
function wkOpenDesktopEditor(){
  closeWkDesktopEditor();
  const el=document.createElement('div');
  el.id='wk-modal'; el.className='modal-overlay open';
  el.innerHTML='<div class="modal wk-modal"><div class="modal-title">Límite semanal</div>'
    +'<div class="modal-sub">Cuánto querés gastar por semana en el día a día, desde cuándo y hasta cuándo.</div>'
    +wkEditorInner(false)
    +'<div class="modal-actions"><button class="btn btn-ghost" onclick="closeWkDesktopEditor()">Cancelar</button><button class="btn btn-primary" onclick="wkSaveEditor()">Guardar</button></div></div>';
  el.addEventListener('click', ev=>{ if(ev.target===el) closeWkDesktopEditor(); });
  document.body.appendChild(el);
  setTimeout(()=>document.getElementById('wk-amount')?.focus(), 50);
}
function closeWkDesktopEditor(){ document.getElementById('wk-modal')?.remove(); }

// ── Empezar uno nuevo o borrar el actual ──
// Borrar pide confirmar en el mismo lugar: un toque de más no borra nada.
function wkActionsHtml(mobile){
  return '<div class="wk-actions'+(mobile?'':' desk')+'" id="wk-actions">'+wkActionsButtons(mobile)+'</div>';
}
function wkActionsButtons(mobile){
  return mobile
    ?'<button class="mx-del ghost" onclick="wkOpenEditor(true)">Empezar un límite nuevo</button>'
      +'<button class="mx-del" onclick="wkAskReset(true)">Borrar este límite</button>'
    :'<button class="btn btn-ghost btn-sm" onclick="wkOpenEditor(true)">Empezar un límite nuevo</button>'
      +'<button class="btn btn-ghost btn-sm wk-danger" onclick="wkAskReset(false)">Borrar este límite</button>';
}
function wkAskReset(mobile){
  document.querySelectorAll('#wk-actions').forEach(zone=>{
    zone.innerHTML='<div class="mx-del-q wk-reset-q">¿Borrar tu límite semanal? Se pierden el monto, las fechas y el historial de semanas. Tus gastos no se tocan.</div>'
      +'<div class="mx-del-row wk-reset-row">'
        +(mobile?'<button class="mx-del ghost" onclick="wkCancelReset(true)">No</button><button class="mx-del strong" onclick="wkReset()">Sí, borrar</button>'
          :'<button class="btn btn-ghost btn-sm" onclick="wkCancelReset(false)">No</button><button class="btn btn-sm wk-danger-strong" onclick="wkReset()">Sí, borrar</button>')
      +'</div>';
  });
}
function wkCancelReset(mobile){ document.querySelectorAll('#wk-actions').forEach(z=>{ z.innerHTML=wkActionsButtons(mobile); }); }
function wkReset(){
  state.weeklyLimit=null;
  saveState();
  renderSemanaPage();
  showToast('Límite borrado. Podés poner uno nuevo cuando quieras','info');
}
