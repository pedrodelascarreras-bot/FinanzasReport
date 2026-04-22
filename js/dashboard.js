// ══ DASHBOARD ══
function _chartTooltip(){
  const l=_isL();
  return {
    backgroundColor:l?'rgba(255,255,255,0.96)':'rgba(15,22,34,0.95)',
    titleColor:l?'#1d1d1f':'#f5f7fb',
    bodyColor:l?'#425066':'#b5bece',
    borderColor:l?'rgba(49,67,96,0.15)':'rgba(255,255,255,0.1)',
    borderWidth:1,
    padding:{top:10,bottom:10,left:14,right:14},
    cornerRadius:12,
    titleFont:{size:11,weight:'600',family:'-apple-system,SF Pro Display,sans-serif'},
    bodyFont:{size:13,weight:'500',family:'-apple-system,SF Pro Display,sans-serif'},
    displayColors:false,
    caretSize:0,
    boxPadding:4
  };
}
function _chartTickColor(){return _isL()?'#748096':'#566172';}
function _chartTickFont(){return {size:10,weight:'500',family:'-apple-system,SF Pro Display,sans-serif'};}
function _chartGridY(){return {color:_isL()?'rgba(0,0,0,0.04)':'rgba(255,255,255,0.03)',drawBorder:false};}
let USD_TO_ARS = state.usdRate || 1420;
function recordUsdRateSnapshot(buy, sell, source){
  const venta = Number(sell || 0);
  if(!(venta > 0)) return;
  const now = new Date();
  const history = Array.isArray(state.usdRateHistory) ? state.usdRateHistory.slice() : [];
  const snapshot = {
    ts: now.toISOString(),
    buy: Number(buy || venta),
    sell: venta,
    source: source || state.usdRateSource || 'oficial BNA'
  };
  const last = history[history.length - 1];
  if(last){
    const lastDate = new Date(last.ts);
    if(!Number.isNaN(lastDate.getTime()) && (now - lastDate) < 60 * 60 * 1000){
      history[history.length - 1] = snapshot;
    }else{
      history.push(snapshot);
    }
  }else{
    history.push(snapshot);
  }
  state.usdRateHistory = history
    .filter(item => item && Number(item.sell) > 0 && item.ts)
    .slice(-30);
}
async function fetchUsdRate(manual=false){
  const btn=document.getElementById('btn-refresh-usd');
  const statusEl=document.getElementById('usd-rate-status');
  if(btn){btn.disabled=true;btn.querySelector('span') ? btn.querySelector('span').textContent='...' : btn.textContent='↻ ...';}
  if(statusEl)statusEl.textContent='Actualizando...';

  // Múltiples fuentes con fallback — todas tienen CORS abierto
  const sources=[
    // 1. dolarapi directo
    {url:'https://dolarapi.com/v1/dolares/oficial', parse:d=>({buy:d.compra,sell:d.venta})},
    // 2. dolarapi via allorigins proxy
    {url:'https://api.allorigins.win/get?url='+encodeURIComponent('https://dolarapi.com/v1/dolares/oficial'), parse:d=>{const j=JSON.parse(d.contents);return {buy:j.compra,sell:j.venta};}},
    // 3. bluelytics directo
    {url:'https://api.bluelytics.com.ar/v2/latest', parse:d=>({buy:d.oficial?.value_buy,sell:d.oficial?.value_sell})},
    // 4. bluelytics via allorigins
    {url:'https://api.allorigins.win/get?url='+encodeURIComponent('https://api.bluelytics.com.ar/v2/latest'), parse:d=>{const j=JSON.parse(d.contents);return {buy:j.oficial?.value_buy,sell:j.oficial?.value_sell};}},
    // 5. Argentina.gob.ar series de tiempo (BCRA oficial)
    {url:'https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD', parse:d=>({buy:d.results?.[0]?.tipoPase,sell:d.results?.[0]?.tipoPase})}
  ];

  for(const src of sources){
    try{
      const _ctrl=new AbortController();const _tmr=setTimeout(()=>_ctrl.abort(),5000);
      const r=await fetch(src.url,{signal:_ctrl.signal});
      clearTimeout(_tmr);
      if(!r.ok)continue;
      const d=await r.json();
      const parsed=src.parse(d);
      const compra=Number(parsed?.buy||parsed||0);
      const venta=Number(parsed?.sell||parsed||0);
      if(venta&&venta>0){
        USD_TO_ARS=venta;state.usdRate=venta;
        state.usdRateBuy=compra&&compra>0?compra:venta;
        state.usdRateSell=venta;
        state.usdRateSource='oficial BNA';
        state.usdRateUpdated=new Date().toISOString();
        recordUsdRateSnapshot(state.usdRateBuy, state.usdRateSell, state.usdRateSource);
        saveState();updateUsdRateUI();
        if(manual)showToast('✓ Oficial BNA: $'+fmtN(venta)+'/USD');
        if(btn){btn.disabled=false;btn.querySelector('span') ? btn.querySelector('span').textContent='Actualizar' : btn.textContent='↻ Actualizar';}
        if(statusEl)statusEl.textContent='';
        return;
      }
    }catch(e){}
  }

  if(manual)showToast('⚠️ No se pudo conectar. Editá el valor manualmente.');
  if(btn){btn.disabled=false;btn.querySelector('span') ? btn.querySelector('span').textContent='Actualizar' : btn.textContent='↻ Actualizar';}
  if(statusEl)statusEl.textContent='';
}
function updateUsdRateUI(){
  const rate=USD_TO_ARS;
  const buyRate=Number(state.usdRateBuy||rate||0) || rate;
  const sellRate=Number(state.usdRateSell||rate||0) || rate;
  // Card en dashboard
  const buyDisp=document.getElementById('usd-rate-buy-display');
  const sellDisp=document.getElementById('usd-rate-sell-display');
  if(buyDisp){
    if(isMasked()) buyDisp.textContent='$••••••';
    else animateNumberText(buyDisp,buyRate,{prefix:'$',decimals:2,duration:620});
  }
  if(sellDisp){
    if(isMasked()) sellDisp.textContent='$••••••';
    else animateNumberText(sellDisp,sellRate,{prefix:'$',decimals:2,duration:700});
  }
  const src=document.getElementById('usd-rate-source-badge');
  if(src)src.textContent=state.usdRateSource||'manual';
  const upd=document.getElementById('usd-rate-updated');
  if(upd&&state.usdRateUpdated){
    const d=new Date(state.usdRateUpdated);
    const label='Actualizado '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
    const span=upd.querySelector('span');
    if(span) span.textContent=label;
    else upd.textContent=label;
  }
  const status=document.getElementById('usd-rate-status');
  if(status)status.textContent='Tocá para ver compra y venta';
  // Legacy badge selector (otros lugares que puedan tener el badge)
  document.querySelectorAll('.usd-rate-badge').forEach(el=>{el.textContent='U$D 1 = '+(isMasked()?'$••••••':'$'+fmtN(rate))+' ('+( state.usdRateSource||'manual')+')'});
  renderDb2DollarSparkline();
  // Si el dashboard ya tiene datos, recalcular
  if(state.transactions.length)renderDashboard();
}
function openUsdRateModal(){
  document.getElementById('modal-usd-input').value=Math.round(USD_TO_ARS);
  openModal('modal-usd-rate');
  loadAllRates();
}
function saveUsdRateManual(){
  const val=parseFloat(document.getElementById('modal-usd-input').value);
  if(!val||val<1){showToast('⚠️ Ingresá un valor válido','error');return;}
  USD_TO_ARS=val;state.usdRate=val;state.usdRateBuy=state.usdRateBuy||val;state.usdRateSell=val;state.usdRateSource='manual';state.usdRateUpdated=new Date().toISOString();
  saveState();updateUsdRateUI();closeModal('modal-usd-rate');showToast('✓ Tipo de cambio actualizado: $'+fmtN(val),'success');
}
async function loadAllRates(){
  const blueEl=document.getElementById('ref-blue');
  const oficialEl=document.getElementById('ref-oficial');
  const oficialRangeEl=document.getElementById('ref-oficial-range');
  const mepEl=document.getElementById('ref-mep');
  if(blueEl)blueEl.textContent='Cargando...';
  try{
    const r=await fetch('https://dolarapi.com/v1/dolares');
    if(r.ok){
      const list=await r.json();
      const blue=list.find(d=>d.casa==='blue');
      const oficial=list.find(d=>d.casa==='oficial');
      const mep=list.find(d=>d.casa==='bolsa')||list.find(d=>d.casa==='mep');
      if(blueEl)blueEl.textContent=blue?'$'+fmtN(blue.venta):'—';
      if(oficialEl)oficialEl.textContent=oficial?'$'+fmtN(oficial.venta):'—';
      if(oficialRangeEl)oficialRangeEl.textContent=oficial?`$${fmtN(oficial.compra)} · $${fmtN(oficial.venta)}`:'—';
      if(mepEl)mepEl.textContent=mep?'$'+fmtN(mep.venta):'—';
      // Pre-fill input with blue
      if(blue&&blue.venta){const inp=document.getElementById('modal-usd-input');if(inp&&!inp.value)inp.value=Math.round(blue.venta);}
      return;
    }
  }catch(e){}
  // fallback bluelytics
  try{
    const r2=await fetch('https://api.bluelytics.com.ar/v2/latest');
    if(r2.ok){const d=await r2.json();
      if(blueEl)blueEl.textContent=d.blue?.value_sell?'$'+fmtN(d.blue.value_sell):'—';
      if(oficialEl)oficialEl.textContent=d.oficial?.value_sell?'$'+fmtN(d.oficial.value_sell):'—';
      if(oficialRangeEl)oficialRangeEl.textContent=d.oficial?.value_buy&&d.oficial?.value_sell?`$${fmtN(d.oficial.value_buy)} · $${fmtN(d.oficial.value_sell)}`:'—';
      if(mepEl)mepEl.textContent='—';
    }
  }catch(e2){if(blueEl)blueEl.textContent='Sin conexión';if(oficialRangeEl)oficialRangeEl.textContent='Sin conexión';}
}
function getActiveDashMonth(){
  const range=typeof getViewWindowRange==='function'
    ? getViewWindowRange()
    : {currentMonthKey:getMonthKey(new Date()), startMonthKey:getMonthKey(new Date(new Date().getFullYear(),new Date().getMonth()-6,1))};
  // Clamp: never devolver meses fuera de la ventana habilitada
  if(state.dashMonth && (state.dashMonth>range.currentMonthKey || state.dashMonth<range.startMonthKey)){
    state.dashMonth=null;
  }
  if(state.dashMonth) return state.dashMonth;
  return range.currentMonthKey;
}
function getCurrentMonthTxns(){
  const mk=getActiveDashMonth();
  return state.transactions.filter(t=>t.month===mk||getMonthKey(t.date)===mk);
}
function getAvailableMonths(){
  const range=typeof getViewWindowRange==='function'
    ? getViewWindowRange()
    : {currentMonthKey:getMonthKey(new Date()), startMonthKey:getMonthKey(new Date(new Date().getFullYear(),new Date().getMonth()-6,1))};
  const set=new Set(state.transactions.map(t=>t.month||getMonthKey(t.date)));
  // Asegurar que el mes actual siempre esté disponible y no devolver meses fuera de ventana
  set.add(range.currentMonthKey);
  return [...set].filter(m=>m<=range.currentMonthKey&&m>=range.startMonthKey).sort();
}
function renderUiGlyph(name){
  const icons={
    bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
    card:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/></svg>',
    alert:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.8 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/></svg>',
    trend:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16 10 10l4 4 6-8"/><path d="M20 6v4h-4"/></svg>',
    loop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1v6h-6"/><path d="M7 23v-6h6"/><path d="M20.5 9A9 9 0 0 0 6 5.3L3 8" style="clip-path: polygon(0 0, 94% 0, 100% 0, 88% 100%, 0 100%);"/><path d="M3.5 15A9 9 0 0 0 18 18.7L21 16"/></svg>',
    tag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m20 10-8 8-8-8V4h6z"/><path d="M7.5 7.5h.01"/></svg>',
    spark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M5 3v3"/><path d="M19 18v3"/><path d="M3 5h3"/><path d="M18 19h3"/></svg>',
    calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>',
    focus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4"/><path d="M15 3h4a2 2 0 0 1 2 2v4"/><path d="M21 15v4a2 2 0 0 1-2 2h-4"/><path d="M3 15v4a2 2 0 0 0 2 2h4"/><circle cx="12" cy="12" r="3"/></svg>',
    report:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6M9 9h2"/></svg>',
    safe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>',
    ai:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.9 4.9 7.7 7.7"/><path d="m16.3 16.3 2.8 2.8"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.9 19.1 2.8-2.8"/><path d="m16.3 7.7 2.8-2.8"/><circle cx="12" cy="12" r="4"/></svg>'
  };
  return `<span class="ui-glyph" aria-hidden="true">${icons[name]||icons.spark}</span>`;
}
function stripHtml(text){
  return String(text||'').replace(/<[^>]*>/g,'').trim();
}
function expandPeriodYearLabel(label=''){
  return String(label||'').replace(/\b(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+(\d{2})\b/gi,(_,month,yy)=>`${month} 20${yy}`);
}
function cleanHeroCycleLabel(label=''){
  return String(label||'')
    .replace(/^\s*(VISA|AMEX|Mastercard|TC)\s*[·\-–—]\s*/i,'')
    .trim();
}
function getIncomeSnapshot(monthKey){
  let ars=(state.income?.ars||0)+(state.income?.varArs||0);
  let usd=(state.income?.usd||0)+(state.income?.varUsd||0);
  const exact=(state.incomeMonths||[]).find(m=>m.month===monthKey);
  const hasBases=(state.incomeSources||[]).some(s=>(s.base||0)>0);
  if(exact&&typeof getMonthTotalARS==='function'){
    ars=getMonthTotalARS(exact);
    usd=typeof getMonthTotalUSD==='function'?getMonthTotalUSD(exact):0;
  } else if(hasBases){
    ars=(state.incomeSources||[]).filter(s=>s.currency==='ARS').reduce((a,s)=>a+(s.base||0),0);
    usd=(state.incomeSources||[]).filter(s=>s.currency==='USD').reduce((a,s)=>a+(s.base||0),0);
  } else if(state.incomeMonths?.length&&typeof getMonthTotalARS==='function'){
    const last=[...state.incomeMonths].sort((a,b)=>b.month.localeCompare(a.month))[0];
    if(last){
      ars=getMonthTotalARS(last);
      usd=typeof getMonthTotalUSD==='function'?getMonthTotalUSD(last):0;
    }
  }
  return {ars,usd,total:ars+(usd*(USD_TO_ARS||1420))};
}
function getUpcomingCardMilestone(baseDate=new Date()){
  const today=new Date(baseDate);
  const cycles=typeof getTcCycles==='function'?getTcCycles():[];
  const events=[];
  cycles.forEach(cyc=>{
    const card=(state.ccCards||[]).find(c=>c.id===cyc.cardId);
    const label=card?.name||cyc.label||'Tarjeta';
    const close=new Date(cyc.closeDate+'T12:00:00');
    const due=cyc.dueDate?new Date(cyc.dueDate+'T12:00:00'):null;
    if(close>=today) events.push({type:'close',label,date:close,days:Math.round((close-today)/86400000)});
    if(due&&due>=today) events.push({type:'due',label,date:due,days:Math.round((due-today)/86400000)});
  });
  events.sort((a,b)=>a.date-b.date);
  return events[0]||null;
}
function getBackupHealth(baseDate=new Date()){
  const raw=localStorage.getItem('fin_last_backup');
  if(!raw) return {state:'missing', level:'alert', label:'Sin backup', desc:'Todavía no generaste una copia de seguridad.', days:null};
  const stamp=new Date(raw);
  const days=Math.floor((new Date(baseDate)-stamp)/86400000);
  if(days>=21) return {state:'stale', level:'alert', label:'Backup desactualizado', desc:`Última copia hace ${days} días.`, days};
  if(days>=10) return {state:'aging', level:'warn', label:'Conviene renovar backup', desc:`Última copia hace ${days} días.`, days};
  return {state:'healthy', level:'info', label:'Backup al día', desc:days<=0?'Copia realizada hoy.':`Última copia hace ${days} días.`, days};
}
function getDashboardTimelineData(baseDate=new Date()){
  const today=new Date(baseDate);
  const normalizeDate=d=>{
    const dt=d instanceof Date?new Date(d):new Date(d);
    if(isNaN(dt)) return null;
    dt.setHours(12,0,0,0);
    return dt;
  };
  const daysAway=d=>Math.round((normalizeDate(d)-normalizeDate(today))/86400000);
  const events=[];
  const cycles=typeof getTcCycles==='function'?getTcCycles():[];
  cycles.forEach(cyc=>{
    const card=(state.ccCards||[]).find(c=>c.id===cyc.cardId);
    const close=normalizeDate(cyc.closeDate+'T12:00:00');
    const due=cyc.dueDate?normalizeDate(cyc.dueDate+'T12:00:00'):null;
    if(close&&close>=today) events.push({type:'close', title:`${card?.name||cyc.label||'Tarjeta'} cierra`, shortLabel:card?.name||cyc.label||'Tarjeta', date:close, days:daysAway(close), page:'credit-cards'});
    if(due&&due>=today) events.push({type:'due', title:`${card?.name||cyc.label||'Tarjeta'} vence`, shortLabel:card?.name||cyc.label||'Tarjeta', date:due, days:daysAway(due), page:'credit-cards'});
  });
  const autoGroups=typeof detectAutoCuotas==='function'?detectAutoCuotas():[];
  autoGroups.forEach(g=>{
    const snap=typeof getAutoCuotaSnapshot==='function'?getAutoCuotaSnapshot(g,today):null;
    const day=snap?.cfg?.day||snap?.scheduleDay||null;
    if(!snap||snap.paid>=snap.total||!day||typeof getNextCuotaDate!=='function') return;
    const nextDate=getNextCuotaDate(day);
    const cuotaName=g.displayName||g.name;
    if(nextDate&&nextDate>=today){
      events.push({type:'commitment', title:cuotaName, shortLabel:cuotaName, date:normalizeDate(nextDate), days:daysAway(nextDate), amount:snap.amountPerCuota, page:'cuotas'});
    }
  });
  (state.cuotas||[]).forEach(c=>{
    if(c.paid>=c.total||!c.day||typeof getNextCuotaDate!=='function') return;
    const nextDate=getNextCuotaDate(c.day);
    if(nextDate&&nextDate>=today){
      events.push({type:'commitment', title:c.name, shortLabel:c.name, date:normalizeDate(nextDate), days:daysAway(nextDate), amount:c.amount, page:'cuotas'});
    }
  });
  const toMonthly=s=>{if(s.freq==='monthly')return s.price;if(s.freq==='annual')return s.price/12;if(s.freq==='weekly')return s.price*4.3;return s.price;};
  (state.subscriptions||[]).forEach(s=>{
    if(s.active===false||!s.day||typeof getNextCuotaDate!=='function') return;
    const nextDate=getNextCuotaDate(s.day);
    if(nextDate&&nextDate>=today){
      events.push({type:'subscription', title:s.name, shortLabel:s.name, date:normalizeDate(nextDate), days:daysAway(nextDate), amount:s.currency==='USD'?toMonthly(s)*(USD_TO_ARS||1420):toMonthly(s), page:'subs'});
    }
  });
  (state.fixedExpenses||[]).forEach(f=>{
    if(!f.day||typeof getNextCuotaDate!=='function') return;
    const nextDate=getNextCuotaDate(f.day);
    if(nextDate&&nextDate>=today){
      events.push({type:'fixed', title:f.name, shortLabel:f.name, date:normalizeDate(nextDate), days:daysAway(nextDate), amount:f.currency==='USD'?f.amount*(USD_TO_ARS||1420):f.amount, page:'fixed'});
    }
  });
  events.sort((a,b)=>a.date-b.date||((a.days||0)-(b.days||0)));
  const nextClose=events.find(e=>e.type==='close'||e.type==='due')||null;
  const nextCommitment=events.find(e=>e.type!=='close'&&e.type!=='due')||events.find(e=>e.type==='due')||null;
  const nextWeek=events.filter(e=>e.days>=0&&e.days<=7&&e.amount);
  return {events,nextClose,nextCommitment,nextWeekCount:nextWeek.length,nextWeekAmount:nextWeek.reduce((s,e)=>s+(e.amount||0),0)};
}
function normalizeAgendaDate(value){
  if(!value) return null;
  const dt=value instanceof Date?new Date(value):new Date(value);
  if(isNaN(dt)) return null;
  dt.setHours(12,0,0,0);
  return dt;
}
function dateToInputValue(value){
  const dt=normalizeAgendaDate(value);
  if(!dt) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function getTaskAgendaItems(baseDate=new Date(), opts={}){
  const includePast=!!opts.includePast;
  const includeDone=!!opts.includeDone;
  const today=normalizeAgendaDate(baseDate)||normalizeAgendaDate(new Date());
  return (state.tasks||[])
    .filter(task=>task && (includeDone || !task.done))
    .map(task=>{
      const date=normalizeAgendaDate(task.dueDate);
      if(!date) return null;
      const days=Math.round((date-today)/86400000);
      if(!includePast && days<0) return null;
      return {
        type:'task',
        title:task.text,
        shortLabel:task.text,
        date,
        days,
        page:'calendar',
        taskId:task.id,
        done:!!task.done
      };
    })
    .filter(Boolean);
}
function getCalendarAgendaItems(baseDate=new Date(), opts={}){
  const timeline=getDashboardTimelineData(baseDate);
  const includePast=!!opts.includePast;
  const includeDoneTasks=!!opts.includeDoneTasks;
  const merged=[
    ...(timeline.events||[]),
    ...getTaskAgendaItems(baseDate,{includePast,includeDone:includeDoneTasks})
  ];
  merged.sort((a,b)=>{
    const ad=normalizeAgendaDate(a.date);
    const bd=normalizeAgendaDate(b.date);
    return ad-bd || String(a.title||'').localeCompare(String(b.title||''),'es');
  });
  return merged;
}
function openGlobalSearch(prefill=''){
  openModal('modal-global-search');
  setTimeout(()=>{
    const input=document.getElementById('global-search-input');
    if(!input)return;
    input.value=prefill;
    input.focus();
    input.select();
    renderGlobalSearchResults(prefill);
  },80);
}
function handleGlobalSearchInput(el){
  renderGlobalSearchResults(el?.value||'');
}
function getGlobalSearchBuckets(query=''){
  const q=String(query||'').trim().toLowerCase();
  const match=text=>String(text||'').toLowerCase().includes(q);
  const buckets=[];
  const shortcuts=[
    {icon:'spark', title:'Dashboard', meta:'Volver al tablero principal', action:'page', payload:'dashboard', tag:'atajo'},
    {icon:'trend', title:'Movimientos', meta:'Buscar, revisar y corregir movimientos', action:'page', payload:'transactions', tag:'atajo'},
    {icon:'loop', title:'Compromisos', meta:'Cuotas, suscripciones y gastos fijos', action:'page', payload:'cuotas', tag:'atajo'},
    {icon:'card', title:'Tarjeta de crédito', meta:'Ciclos, vencimientos y detalle de tarjetas', action:'page', payload:'credit-cards', tag:'atajo'},
    {icon:'safe', title:'Descargar backup', meta:'Exportar una copia de seguridad ahora', action:'backup', payload:'backup', tag:'seguridad'},
    {icon:'report', title:'Restaurar backup', meta:'Importar una copia guardada desde un archivo JSON', action:'restore', payload:'restore', tag:'seguridad'},
    {icon:'ai', title:'Conectar Google', meta:'Sincronizar tu archivo para verlo también desde el celular', action:'google', payload:'google', tag:'sync'}
  ].filter(item=>!q||match(item.title)||match(item.meta)||match(item.tag));
  buckets.push({title:q?'Coincidencias rápidas':'Atajos', items:shortcuts.slice(0,6)});

  const txns=(state.transactions||[])
    .filter(t=>!q||match(t.description)||match(t.category)||match(t.comercio_detectado)||match(fmtN(t.amount))||match(fmtDate(t.date)))
    .sort((a,b)=>new Date(b.date)-new Date(a.date))
    .slice(0,q?6:4)
    .map(t=>({icon:'report',title:t.description,meta:`${fmtDate(t.date)} · ${t.currency==='USD'?'U$D ':'$'}${fmtN(t.amount)} · ${t.category||'Sin categoría'}`,action:'txn-search',payload:t.description,tag:'movimiento'}));
  if(txns.length) buckets.push({title:'Movimientos', items:txns});

  const autoGroups=(typeof detectAutoCuotas==='function'?detectAutoCuotas():[])
    .filter(g=>!q||match(g.displayName||g.name)||match(g.name))
    .slice(0,4)
    .map(g=>{
      const snap=typeof getAutoCuotaSnapshot==='function'?getAutoCuotaSnapshot(g):null;
      const cuotaName=g.displayName||g.name;
      return {icon:'loop',title:cuotaName,meta:`${snap?snap.paid:1}/${snap?snap.total:(g.transactions?.[0]?.cuotaTotal||1)} pagadas · $${fmtN(Math.round(snap?snap.amountPerCuota:g.amount||0))} por cuota`,action:'page',payload:'cuotas',tag:'cuota'};
    });
  if(autoGroups.length) buckets.push({title:'Cuotas', items:autoGroups});

  const recurring=[
    ...(state.subscriptions||[]).map(s=>({icon:'bell', title:s.name, meta:`Suscripción · ${(s.currency==='USD'?'U$D ':'$')+fmtN(s.price)} · día ${s.day||'sin definir'}`, action:'page', payload:'cuotas', tag:'suscripción'})),
    ...((state.fixedExpenses||[]).map(f=>({icon:'calendar', title:f.name, meta:`Gasto fijo · ${(f.currency==='USD'?'U$D ':'$')+fmtN(f.amount)} · día ${f.day||'sin definir'}`, action:'page', payload:'cuotas', tag:'fijo'})))
  ].filter(item=>!q||match(item.title)||match(item.meta)||match(item.tag)).slice(0,6);
  if(recurring.length) buckets.push({title:'Compromisos', items:recurring});

  const cats=(state.categories||[])
    .filter(c=>!q||match(c.name)||match(c.group))
    .slice(0,6)
    .map(c=>({icon:'tag', title:c.name, meta:`Categoría · ${c.group||'Sin grupo'}`, action:'txn-search', payload:c.name, tag:'categoría'}));
  if(cats.length) buckets.push({title:'Categorías', items:cats});

  return buckets.filter(bucket=>bucket.items.length);
}
function runGlobalSearchAction(action,payload){
  closeModal('modal-global-search');
  if(action==='page'){nav(payload);return;}
  if(action==='txn-search'){
    nav('transactions');
    setTimeout(()=>{
      const input=document.getElementById('f-search');
      if(input){input.value=payload||'';onSearchInput(input);}
    },120);
    return;
  }
  if(action==='backup'){if(typeof confirmarAccion==='function') confirmarAccion('backup');return;}
  if(action==='restore'){document.getElementById('restore-json-input')?.click();return;}
  if(action==='google'){
    if(typeof openCloudSync==='function') openCloudSync();
    else if(typeof gmailSync==='function') gmailSync();
  }
}
function renderGlobalSearchResults(query=''){
  const el=document.getElementById('global-search-results');
  if(!el)return;
  const buckets=getGlobalSearchBuckets(query);
  if(!buckets.length){
    el.innerHTML='<div class="global-search-empty">No encontré resultados para esa búsqueda. Probá con otro comercio, categoría o acción.</div>';
    return;
  }
  el.innerHTML=buckets.map(bucket=>`
    <div class="global-search-section">
      <div class="global-search-section-title">${esc(bucket.title)}</div>
      ${bucket.items.map(item=>`
        <button class="global-search-item" onclick="runGlobalSearchAction('${item.action}','${String(item.payload||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')">
          <div class="global-search-item-icon">${renderUiGlyph(item.icon||'spark')}</div>
          <div class="global-search-item-copy">
            <div class="global-search-item-title">${esc(item.title)}</div>
            <div class="global-search-item-meta">${item.meta}</div>
          </div>
          <div class="global-search-item-tag">${esc(item.tag||'ir')}</div>
        </button>
      `).join('')}
    </div>
  `).join('');
}
function fallbackInsights(summary){
  const items=[];
  const top=summary.categories?.[0];
  if(summary.income_ars<=0){
    items.push({
      type:'info',
      emoji:renderUiGlyph('focus'),
      label:'Base financiera pendiente',
      headline:'Definí el ingreso mensual para activar decisiones más precisas',
      body:'Cuando cargás ingresos, el panel puede medir margen, ritmo de gasto y alertas accionables.'
    });
  } else if(summary.spending_pct>=100){
    items.push({
      type:'bad',
      emoji:renderUiGlyph('alert'),
      label:'Riesgo inmediato',
      headline:`Tu gasto ya consume ${summary.spending_pct}% del ingreso`,
      body:'Congelá gastos variables y priorizá sólo pagos comprometidos hasta recuperar margen.'
    });
  } else if(summary.spending_pct>=85){
    items.push({
      type:'warn',
      emoji:renderUiGlyph('trend'),
      label:'Zona de control',
      headline:`Entraste en una franja exigente: ${summary.spending_pct}% del ingreso usado`,
      body:'Todavía hay margen para cerrar bien el período si frenás compras tácticas y revisás categorías altas.'
    });
  } else {
    items.push({
      type:'good',
      emoji:renderUiGlyph('safe'),
      label:'Lectura general',
      headline:'El ritmo del período está bajo control',
      body:summary.spending_pct===null?'Todavía falta contexto para medir ingresos vs gasto.':'Tu gasto está por debajo del umbral de alerta y eso te deja capacidad para decidir con calma.'
    });
  }
  if(top&&top.pct>=35){
    items.push({
      type:'warn',
      emoji:renderUiGlyph('spark'),
      label:'Concentración',
      headline:`${top.name} domina el período con ${top.pct}% del gasto`,
      body:`Esa categoría es hoy la palanca más grande para ajustar o explicarle a tu yo futuro qué pasó este mes.`
    });
  } else if(top){
    items.push({
      type:'info',
      emoji:renderUiGlyph('report'),
      label:'Categoría líder',
      headline:`${top.name} encabeza el período`,
      body:`Representa ${top.pct}% del gasto relevado y sirve como referencia para tu resumen ejecutivo.`
    });
  }
  if(summary.txn_count>=45){
    items.push({
      type:'info',
      emoji:renderUiGlyph('tag'),
      label:'Volumen operativo',
      headline:`Tuviste ${summary.txn_count} movimientos cargados`,
      body:'Con este volumen, categorizar bien y mantener reglas activas mejora mucho la claridad del cierre.'
    });
  }
  return items.slice(0,3);
}
function renderDecisionCenter(model){
  const el=document.getElementById('dash-decision-center');
  if(el) el.style.display='none';
}
function addTask(){
  const input=document.getElementById('notif-task-input');
  if(!input)return;
  const text=input.value.trim();
  if(!text)return;
  if(!state.tasks)state.tasks=[];
  state.tasks.push({id:Math.random().toString(36).substr(2,9),text,done:false,createdAt:Date.now(),doneAt:null});
  input.value='';
  saveState();if(typeof renderNotifications==='function')renderNotifications();
}
function addCalendarTask(){
  const input=document.getElementById('calendar-task-input');
  const dateInput=document.getElementById('calendar-task-date');
  if(!input||!dateInput)return;
  const text=input.value.trim();
  const dueDate=dateInput.value||dateToInputValue(state.calendarSelectedDate||state.calendarMonth||new Date());
  if(!text||!dueDate)return;
  if(!state.tasks)state.tasks=[];
  state.tasks.push({
    id:Math.random().toString(36).substr(2,9),
    text,
    done:false,
    createdAt:Date.now(),
    doneAt:null,
    dueDate
  });
  input.value='';
  dateInput.value=dueDate;
  saveState();
  if(typeof renderNotifications==='function')renderNotifications();
  if(document.getElementById('page-calendar')?.classList.contains('active')) renderCalendarPage();
  if(document.getElementById('page-dashboard')?.classList.contains('active')) renderDashboard();
}
function toggleTask(id){
  const t=(state.tasks||[]).find(x=>x.id===id);
  if(!t)return;
  t.done=!t.done;
  t.doneAt=t.done?Date.now():null;
  saveState();if(typeof renderNotifications==='function')renderNotifications();
  if(document.getElementById('page-calendar')?.classList.contains('active')) renderCalendarPage();
  if(document.getElementById('page-dashboard')?.classList.contains('active')) renderDashboard();
}
function deleteTask(id){
  state.tasks=(state.tasks||[]).filter(x=>x.id!==id);
  saveState();if(typeof renderNotifications==='function')renderNotifications();
  if(document.getElementById('page-calendar')?.classList.contains('active')) renderCalendarPage();
  if(document.getElementById('page-dashboard')?.classList.contains('active')) renderDashboard();
}
function clearDoneTasks(){
  state.tasks=(state.tasks||[]).filter(t=>!t.done);
  saveState();if(typeof renderNotifications==='function')renderNotifications();
  if(document.getElementById('page-calendar')?.classList.contains('active')) renderCalendarPage();
  if(document.getElementById('page-dashboard')?.classList.contains('active')) renderDashboard();
}
function getCalendarMinMonth(){
  const today=normalizeAgendaDate(new Date())||new Date();
  return new Date(today.getFullYear(), today.getMonth()-5, 1, 12, 0, 0, 0);
}
function clampCalendarMonth(date){
  const min=getCalendarMinMonth();
  return date < min ? new Date(min.getFullYear(), min.getMonth(), 1, 12, 0, 0, 0) : date;
}
function getCalendarItemToneClass(item){
  if(!item) return 'neutral';
  if(item.type==='task') return 'task';
  if(item.type==='due') return 'due';
  if(item.type==='close') return 'close';
  if(item.type==='subscription') return 'subscription';
  if(item.type==='fixed') return 'fixed';
  return 'cuota';
}
function setCalendarMonthOffset(offset){
  const base=normalizeAgendaDate(state.calendarMonth||new Date())||new Date();
  const next=clampCalendarMonth(new Date(base.getFullYear(),base.getMonth()+offset,1,12,0,0,0));
  state.calendarMonth=dateToInputValue(next);
  const selected=normalizeAgendaDate(state.calendarSelectedDate);
  if(!selected || selected.getMonth()!==next.getMonth() || selected.getFullYear()!==next.getFullYear()){
    state.calendarSelectedDate=dateToInputValue(next);
  }
  renderCalendarPage();
}
function jumpCalendarToToday(){
  const today=normalizeAgendaDate(new Date());
  state.calendarMonth=dateToInputValue(today);
  state.calendarSelectedDate=dateToInputValue(today);
  renderCalendarPage();
}
function selectCalendarDate(dateValue){
  state.calendarSelectedDate=dateValue;
  renderCalendarPage();
}
function renderCalendarPage(){
  const page=document.getElementById('page-calendar');
  if(!page) return;
  const baseMonth=clampCalendarMonth(normalizeAgendaDate(state.calendarMonth||new Date())||normalizeAgendaDate(new Date()));
  const monthStart=new Date(baseMonth.getFullYear(),baseMonth.getMonth(),1,12,0,0,0);
  const monthEnd=new Date(baseMonth.getFullYear(),baseMonth.getMonth()+1,0,12,0,0,0);
  const monthLabel=document.getElementById('calendar-month-label');
  const gridEl=document.getElementById('calendar-grid');
  const selectedLabelEl=document.getElementById('calendar-selected-label');
  const selectedSubEl=document.getElementById('calendar-selected-sub');
  const dayListEl=document.getElementById('calendar-day-list');
  const upcomingEl=document.getElementById('calendar-upcoming-list');
  const taskDateEl=document.getElementById('calendar-task-date');
  const prevBtn=document.getElementById('calendar-prev-btn');
  const nextBtn=document.getElementById('calendar-next-btn');
  if(!gridEl||!selectedLabelEl||!selectedSubEl||!dayListEl||!upcomingEl) return;

  state.calendarMonth=dateToInputValue(monthStart);
  if(prevBtn){
    const minMonth=getCalendarMinMonth();
    prevBtn.disabled=monthStart.getFullYear()===minMonth.getFullYear() && monthStart.getMonth()===minMonth.getMonth();
  }
  if(nextBtn) nextBtn.disabled=false;
  if(monthLabel){
    monthLabel.textContent=monthStart.toLocaleDateString('es-AR',{month:'long',year:'numeric'});
  }

  const allItems=getCalendarAgendaItems(new Date(),{includePast:true,includeDoneTasks:false});
  const monthItems=allItems.filter(item=>{
    const dt=normalizeAgendaDate(item.date);
    return dt && dt.getMonth()===monthStart.getMonth() && dt.getFullYear()===monthStart.getFullYear();
  });
  const itemsByDay=new Map();
  monthItems.forEach(item=>{
    const key=dateToInputValue(item.date);
    if(!itemsByDay.has(key)) itemsByDay.set(key,[]);
    itemsByDay.get(key).push(item);
  });

  const selectedDate=normalizeAgendaDate(
    state.calendarSelectedDate && normalizeAgendaDate(state.calendarSelectedDate)?.getMonth()===monthStart.getMonth() && normalizeAgendaDate(state.calendarSelectedDate)?.getFullYear()===monthStart.getFullYear()
      ? state.calendarSelectedDate
      : monthStart
  ) || monthStart;
  state.calendarSelectedDate=dateToInputValue(selectedDate);
  if(taskDateEl) taskDateEl.value=state.calendarSelectedDate;

  const startWeekday=(monthStart.getDay()+6)%7;
  const cells=[];
  for(let i=0;i<startWeekday;i++) cells.push(null);
  for(let d=1;d<=monthEnd.getDate();d++){
    cells.push(new Date(monthStart.getFullYear(),monthStart.getMonth(),d,12,0,0,0));
  }
  while(cells.length%7!==0) cells.push(null);

  gridEl.innerHTML=cells.map((cell,idx)=>{
    if(!cell) return `<div class="calendar-cell calendar-cell-empty" aria-hidden="true"></div>`;
    const key=dateToInputValue(cell);
    const items=itemsByDay.get(key)||[];
    const isToday=key===dateToInputValue(new Date());
    const isSelected=key===state.calendarSelectedDate;
    const itemCount=items.length;
    const priorities=['due','close','subscription','fixed','task'];
    const primaryType=priorities.find(type=>items.some(item=>item.type===type)) || (items[0]?.type || '');
    const toneClass=items.length?`has-${getCalendarItemToneClass({type:primaryType})}`:'';
    const preview=items.slice(0,2).map(item=>`<span class="calendar-chip ${getCalendarItemToneClass(item)}">${esc((item.shortLabel||item.title||'').slice(0,18))}</span>`).join('');
    return `<button class="calendar-cell ${isToday?'is-today':''} ${isSelected?'is-selected':''} ${toneClass}" onclick="selectCalendarDate('${key}')">
      <span class="calendar-cell-day">${cell.getDate()}</span>
      ${itemCount?`<span class="calendar-cell-count">${itemCount}</span>`:''}
      <span class="calendar-cell-preview">${preview}</span>
    </button>`;
  }).join('');

  const selectedItems=(itemsByDay.get(state.calendarSelectedDate)||[]).sort((a,b)=>normalizeAgendaDate(a.date)-normalizeAgendaDate(b.date));
  selectedLabelEl.textContent=selectedDate.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
  const selectedTasks=selectedItems.filter(item=>item.type==='task').length;
  selectedSubEl.textContent=selectedItems.length
    ? `${selectedItems.length} item${selectedItems.length!==1?'s':''}${selectedTasks?` · ${selectedTasks} task${selectedTasks!==1?'s':''}`:''}`
    : 'No hay items para este día';
  dayListEl.innerHTML=selectedItems.length ? selectedItems.map(item=>{
    const when=item.type==='task'
      ? 'Task'
      : item.type==='due'
        ? 'Vencimiento'
        : item.type==='close'
          ? 'Cierre TC'
          : item.type==='subscription'
            ? 'Suscripción'
            : item.type==='fixed'
              ? 'Gasto fijo'
              : 'Compromiso';
    const amount=item.amount?`$${fmtN(Math.round(item.amount))}`:'';
    const meta=[when,amount].filter(Boolean).join(' · ');
    const action=item.type==='task'
      ? `<div class="calendar-item-actions">
          <button class="calendar-item-check ${item.done?'checked':''}" onclick="event.stopPropagation();toggleTask('${item.taskId}')">${item.done?'✓':''}</button>
          <button class="calendar-item-delete" onclick="event.stopPropagation();deleteTask('${item.taskId}')">✕</button>
        </div>`
      : `<button class="calendar-item-link" onclick="event.stopPropagation();nav('${item.page||'cuotas'}')">Abrir</button>`;
    return `<div class="calendar-item-card ${getCalendarItemToneClass(item)}">
      <div class="calendar-item-main">
        <div class="calendar-item-title">${esc(item.shortLabel||item.title||'Item')}</div>
        <div class="calendar-item-meta">${meta}</div>
      </div>
      ${action}
    </div>`;
  }).join('') : '<div class="calendar-empty">Este día está libre. Podés usarlo para programar una task.</div>';

  const upcoming=getCalendarAgendaItems(new Date(),{includePast:false,includeDoneTasks:false}).slice(0,8);
  upcomingEl.innerHTML=upcoming.length ? upcoming.map(item=>{
    const dt=normalizeAgendaDate(item.date);
    const when=item.days===0?'Hoy':item.days===1?'Mañana':`En ${item.days} días`;
    return `<div class="calendar-upcoming-item ${getCalendarItemToneClass(item)}">
      <div class="calendar-upcoming-date">${dt?dt.toLocaleDateString('es-AR',{day:'2-digit',month:'short'}).replace('.',''):'—'}</div>
      <div class="calendar-upcoming-copy">
        <div class="calendar-upcoming-title">${esc(item.shortLabel||item.title||'Item')}</div>
        <div class="calendar-upcoming-meta">${when}</div>
      </div>
    </div>`;
  }).join('') : '<div class="calendar-empty">No hay nada próximo en la agenda.</div>';
}
function toggleDecisionCenter(){
  state.decisionCenterCollapsed=!state.decisionCenterCollapsed;
  saveState();
  renderDashboard();
}
function setDashView(mode){
  state.dashView=normalizeViewMode(mode);
  const btnMes=document.getElementById('dash-toggle-mes');
  const btnVisa=document.getElementById('dash-toggle-visa');
  if(btnMes&&btnVisa){
    const isMes=state.dashView==='mes';
    const isVisa=state.dashView==='visa';
    btnMes.style.background=isMes?'var(--accent)':'transparent';
    btnMes.style.color=isMes?'#ffffff':'var(--text3)';
    btnVisa.style.background=isVisa?'var(--accent)':'transparent';
    btnVisa.style.color=isVisa?'#ffffff':'var(--text3)';
  }
  saveState();
  renderDashboard();
}

function setDashMonthFromSelect(val){
  if(state.dashView!=='mes'){
    state.dashTcCycle=val||null;
  } else {
    const range=typeof getViewWindowRange==='function'
      ? getViewWindowRange()
      : {currentMonthKey:getMonthKey(new Date()), startMonthKey:getMonthKey(new Date(new Date().getFullYear(),new Date().getMonth()-6,1))};
    const currentMk=range.currentMonthKey;
    // Bloqueo defensivo: no aceptar meses futuros
    if(val && (val>currentMk || val<range.startMonthKey)){
      val='';
      if(typeof showToast==='function') showToast('Solo podés ver hasta 6 meses atrás y nunca meses futuros','warn');
    }
    state.dashMonth=val||null;
  }
  saveState();
  renderDashboard();
}
function updateMonthPicker(){
  // In TC mode, the selector is managed by renderDashboard's TC branch — don't touch it
  if(state.dashView!=='mes') return;
  const sel=document.getElementById('dash-month-select');
  if(!sel)return;
  const months=getAvailableMonths();
  const cur=state.dashMonth||'';
  const MNAMES=[t('month_1'),t('month_2'),t('month_3'),t('month_4'),t('month_5'),t('month_6'),t('month_7'),t('month_8'),t('month_9'),t('month_10'),t('month_11'),t('month_12')];
  sel.innerHTML='<option value="">Mes actual</option>'+months.reverse().map(m=>{
    const[y,mo]=m.split('-');
    return'<option value="'+m+'" '+(m===cur?'selected':'')+'>'+MNAMES[+mo-1]+' '+y+'</option>';
  }).join('');
}
function toggleDashInsights(){
  const panel=document.getElementById('dash-insights-panel');
  if(!panel)return;
  const visible=panel.style.display!=='none';
  panel.style.display=visible?'none':'flex';
  if(!visible)generateDashInsights();
}
async function generateDashInsights(){
  const panel=document.getElementById('dash-insights-panel');
  const loadEl=document.getElementById('dash-insights-loading');
  const feedEl=document.getElementById('dash-insight-feed');
  const monthLabelEl=document.getElementById('insights-month-label');
  if(!panel||!loadEl||!feedEl)return;
  const monthTxns=getCurrentMonthTxns();
  if(!monthTxns.length){feedEl.innerHTML='<div style="padding:16px;color:var(--text3);font-size:13px;">Sin movimientos para este mes.</div>';return;}
  const activeMk=getActiveDashMonth();
  const[iY,iM]=activeMk.split('-').map(Number);
  const MNAMES=[t('month_1'),t('month_2'),t('month_3'),t('month_4'),t('month_5'),t('month_6'),t('month_7'),t('month_8'),t('month_9'),t('month_10'),t('month_11'),t('month_12')];
  if(monthLabelEl)monthLabelEl.textContent=MNAMES[iM-1]+' '+iY;
  loadEl.style.display='flex';feedEl.style.display='none';
  const arsT=monthTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const usdT=monthTxns.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);
  const catD=getCatData(monthTxns);
  // Resolve income for this month using the new income system (same logic as renderDashboard)
  let incArs=state.income.ars+state.income.varArs;
  const _iEntry=(state.incomeMonths||[]).find(m=>m.month===activeMk);
  if(_iEntry && typeof getMonthTotalARS==='function'){incArs=getMonthTotalARS(_iEntry)+getMonthTotalUSD(_iEntry)*(USD_TO_ARS||1420);}
  else if((state.incomeSources||[]).some(s=>s.base>0)){incArs=(state.incomeSources||[]).filter(s=>s.currency==='ARS').reduce((a,s)=>a+(s.base||0),0)+((state.incomeSources||[]).filter(s=>s.currency==='USD').reduce((a,s)=>a+(s.base||0),0))*(USD_TO_ARS||1420);}
  else if(state.incomeMonths?.length && typeof getMonthTotalARS==='function'){const _l=[...state.incomeMonths].sort((a,b)=>b.month.localeCompare(a.month))[0];if(_l)incArs=getMonthTotalARS(_l)+getMonthTotalUSD(_l)*(USD_TO_ARS||1420);}
  const summary={mes:MNAMES[iM-1]+' '+iY,total_ars:arsT,total_usd:usdT,income_ars:incArs,spending_pct:incArs>0?Math.round(arsT/incArs*100):null,categories:catD.labels.map((l,i)=>({name:l,amount:catD.values[i],pct:Math.round(catD.values[i]/arsT*100)})).slice(0,8),txn_count:monthTxns.length,alert_threshold:state.alertThreshold};
  // Insights locales (sin llamada a API externa)
  const items=fallbackInsights(summary);
  feedEl.innerHTML=items.map(item=>'<div class="insight-item '+(item.type||'info')+'-item"><div class="i-emoji">'+item.emoji+'</div><div class="i-content"><div class="i-label">'+esc(item.label)+'</div><div class="i-headline">'+esc(item.headline)+'</div><div class="i-body">'+item.body+'</div></div></div>').join('');
  loadEl.style.display='none';feedEl.style.display='flex';
}

function collectDashboardAlerts(baseDate=new Date()) {
  const today = new Date(baseDate);
  const monthKey = today.toISOString().slice(0,7);
  const notifs = [];
  const cycles = typeof getTcCycles === 'function' ? getTcCycles() : [];
  cycles.forEach(cyc => {
    const card = (state.ccCards||[]).find(c => c.id === cyc.cardId);
    const closeDate = new Date(cyc.closeDate + 'T12:00:00');
    const dueDate = cyc.dueDate ? new Date(cyc.dueDate + 'T12:00:00') : null;
    const daysToClose = Math.round((closeDate - today) / 86400000);
    if(daysToClose >= 0 && daysToClose <= 5) {
      notifs.push({id:`tc-close-${cyc.id}-${cyc.closeDate}`,type:'warn',icon:'card',title:'Cierre de Tarjeta',body:`Tu tarjeta <strong>${card?.name || 'TC'}</strong> cierra en ${daysToClose === 0 ? 'hoy' : daysToClose + ' días'}.`,link:'credit-cards'});
    }
    if(dueDate) {
      const daysToDue = Math.round((dueDate - today) / 86400000);
      if(daysToDue >= 0 && daysToDue <= 7) {
        notifs.push({id:`tc-due-${cyc.id}-${cyc.dueDate}`,type:'alert',icon:'alert',title:'Vencimiento de Tarjeta',body:`El pago de <strong>${card?.name || 'TC'}</strong> vence en ${daysToDue === 0 ? 'hoy' : daysToDue + ' días'}.`,link:'credit-cards'});
      }
    }
  });

  const monthTxns = getCurrentMonthTxns().filter(t=>!t.isPendingCuota);
  const arsT = monthTxns.filter(t => t.currency === 'ARS').reduce((s,t) => s + t.amount, 0);
  let totalIncome = (state.income?.ars||0)+(state.income?.varArs||0);
  const _notifIncEntry=(state.incomeMonths||[]).find(m=>m.month===monthKey);
  if(_notifIncEntry&&typeof getMonthTotalARS==='function'){
    totalIncome=getMonthTotalARS(_notifIncEntry)+getMonthTotalUSD(_notifIncEntry)*(USD_TO_ARS||1420);
  } else if((state.incomeSources||[]).some(s=>s.base>0)){
    totalIncome=(state.incomeSources||[]).filter(s=>s.currency==='ARS').reduce((a,s)=>a+(s.base||0),0)+
      (state.incomeSources||[]).filter(s=>s.currency==='USD').reduce((a,s)=>a+(s.base||0),0)*(USD_TO_ARS||1420);
  } else if(state.incomeMonths?.length&&typeof getMonthTotalARS==='function'){
    const _l=[...state.incomeMonths].sort((a,b)=>b.month.localeCompare(a.month))[0];
    if(_l)totalIncome=getMonthTotalARS(_l)+getMonthTotalUSD(_l)*(USD_TO_ARS||1420);
  }
  if(totalIncome > 0) {
    const pct = (arsT / totalIncome) * 100;
    if(pct >= 85) notifs.push({id:`budget-85-${monthKey}`,type:'alert',icon:'alert',title:'Límite de Presupuesto',body:`Ya gastaste el <strong>${Math.round(pct)}%</strong> de tus ingresos este mes. Recomendamos moderar gastos.`,link:'dashboard'});
    else if(pct >= 70) notifs.push({id:`budget-70-${monthKey}`,type:'warn',icon:'trend',title:'Alerta de Gasto',body:`Has consumido el <strong>${Math.round(pct)}%</strong> de tu presupuesto mensual.`,link:'dashboard'});
  }

  const cuotas = state.transactions.filter(t => t.isPendingCuota && t.currency === 'ARS');
  cuotas.forEach(c => {
    const cDate = new Date(c.date + 'T12:00:00');
    if(cDate.getMonth() === today.getMonth() && cDate.getFullYear() === today.getFullYear()) {
      const dDiff = Math.round((cDate - today) / 86400000);
      if(dDiff >= 0 && dDiff <= 3) {
        notifs.push({id:`cuota-${c.id}-${monthKey}`,type:'info',icon:'loop',title:'Próximo Compromiso',body:`En ${dDiff === 0 ? 'hoy' : dDiff + ' días'} vence la cuota de: <strong>${c.descripcion || c.description}</strong>.`,link:'cuotas'});
      }
    }
  });

  const uncategorized = monthTxns.filter(t => !t.category || t.category === 'Uncategorized' || t.category === 'Procesando...');
  if(uncategorized.length >= 5) {
    notifs.push({id:`uncat-${monthKey}`,type:'info',icon:'tag',title:'Mejorá tu Reporte',body:`Tenés <strong>${uncategorized.length}</strong> movimientos sin categoría. Clasificalos para mejores insights.`,link:'transactions'});
  }
  const backupHealth=getBackupHealth(today);
  if(backupHealth.level!=='info'){
    notifs.push({id:`backup-${backupHealth.state}`,type:backupHealth.level==='alert'?'alert':'warn',icon:'safe',title:backupHealth.label,body:`${backupHealth.desc} Tener una copia reciente te protege antes de grandes cambios o importaciones.`,link:'import'});
  }
  if(typeof getSavingsDeviationAlerts === 'function'){
    getSavingsDeviationAlerts().slice(0,2).forEach(a=>{
      notifs.push({
        id:a.id,
        type:a.type,
        icon:a.type==='alert'?'alert':'trend',
        title:a.title,
        body:a.desc,
        link:'insights'
      });
    });
  }
  const dismissed = state.dismissedNotifs || [];
  const priority={alert:0,warn:1,info:2,success:3};
  return notifs.filter(n => !dismissed.includes(n.id)).sort((a,b)=>(priority[a.type]??9)-(priority[b.type]??9));
}
function renderDashNotifications() {
  const notifEl = document.getElementById('dash-notifications');
  const heroRow = document.querySelector('.dash-row-hero');
  if(!notifEl) return;
  notifEl.style.display = 'none';
  heroRow?.classList.remove('has-side-notifs');
  notifEl.innerHTML = '';
}


function renderDashboard(){
  renderDashNotifications();
  if(typeof ccInit==='function') ccInit();
  state.dashView=normalizeViewMode(state.dashView||'visa');
  const today=new Date();
  const todayYmd=dateToYMD(today);
  const allTcCycles=typeof getTcCycles==='function'?getTcCycles(state.dashView):[];
  const currentTcCycle=allTcCycles.find((c,i)=>{
    const open=getTcCycleOpen(allTcCycles,i);
    return open&&todayYmd>=open&&todayYmd<=c.closeDate;
  })||allTcCycles[0]||null;
  // Always default to real current month if state is empty or has an old stale value
  let activeMk = getActiveDashMonth();
  if(!activeMk) activeMk = getMonthKey(new Date());
  // ── TC vs Mes mode (declared here, used throughout the function) ──
  const isTcView=state.dashView!=='mes';
  const activeCycleMode=isTcView?state.dashView:'mes';
  // ── Sync toggle buttons ──
  const _btnM=document.getElementById('dash-toggle-mes');
  const _btnV=document.getElementById('dash-toggle-visa');
  if(_btnM&&_btnV){
    const isMes=state.dashView==='mes';
    const isVisa=state.dashView==='visa';
    _btnM.style.background=isMes?'var(--accent)':'transparent';
    _btnM.style.color=isMes?'#ffffff':'var(--text3)';
    _btnV.style.background=isVisa?'var(--accent)':'transparent';
    _btnV.style.color=isVisa?'#ffffff':'var(--text3)';
  }
  // Keep period selector in sync
  const _dashSel=document.getElementById('dash-month-select');
  if(_dashSel){
    if(isTcView){
      // TC mode: show cycle list
      const _cycles=getTcCycles(activeCycleMode);
      const _selId=state.dashTcCycle||'';
      const _title=getViewModeLabel(activeCycleMode);
      _dashSel.innerHTML='<option value="">'+esc(_title+' actual')+'</option>'+_cycles.map(c=>'<option value="'+c.id+'" '+(c.id===_selId?'selected':'')+'>'+esc(expandPeriodYearLabel(c.label||''))+'</option>').join('');
    } else {
      // Mes mode: show calendar months (sin meses futuros)
      const _range=typeof getViewWindowRange==='function'
        ? getViewWindowRange()
        : {currentMonthKey:getMonthKey(new Date()), startMonthKey:getMonthKey(new Date(new Date().getFullYear(),new Date().getMonth()-6,1))};
      const _curMk=_range.currentMonthKey;
      if(!_dashSel.querySelector('option[value="'+activeMk+'"]')){
        const _set=new Set(state.transactions.map(t=>t.month||getMonthKey(t.date)));
        _set.add(_curMk);
        const months=[..._set].filter(m=>m<=_curMk&&m>=_range.startMonthKey).sort().reverse();
        const _MN=['Enero','Feb','Marzo','Abril','Mayo','Junio','Julio','Agosto','Sep','Oct','Nov','Dic'];
        _dashSel.innerHTML='<option value="">Mes actual</option>'+months.map(m=>{const[y,mo]=m.split('-');return'<option value="'+m+'" '+(m===activeMk?'selected':'')+'>'+_MN[+mo-1]+' '+y+'</option>';}).join('');
      } else {
        _dashSel.value=state.dashMonth||'';
      }
    }
  }
  const isCurrentMonth=activeMk===getMonthKey(today);
  const _resolveDashboardTcCycle=cyclesArg=>{
    const list=cyclesArg||[];
    if(!list.length) return null;
    const selectedId=state.dashTcCycle||'';
    if(selectedId){
      const selected=list.find(c=>c.id===selectedId);
      if(selected) return selected;
    }
    const todayStr=dateToYMD(today);
    const current=list.find(c=>{
      const idx=list.findIndex(x=>x.id===c.id);
      const open=getTcCycleOpen(list,idx);
      return open&&todayStr>=open&&todayStr<=c.closeDate;
    });
    if(current) return current;
    const latestPast=list.find(c=>{
      const idx=list.findIndex(x=>x.id===c.id);
      const open=getTcCycleOpen(list,idx);
      return open&&open<=todayStr;
    });
    if(latestPast) return latestPast;
    return list[list.length-1]||list[0];
  };
  // ── Cabecera de ciclo de tarjeta (apertura / cierre / vencimiento) ──
  const _tcHeader=document.getElementById('dash-tc-cycle-header');
  if(_tcHeader) _tcHeader.style.display='none';
  let monthTxns, tcPeriodLabel='', activeTcCycle=null;
  if(isTcView){
    const cycles=getTcCycles(activeCycleMode); // sorted desc by closeDate
    if(cycles.length){
      activeTcCycle=_resolveDashboardTcCycle(cycles);
      // Sync selector value
      if(_dashSel) _dashSel.value=activeTcCycle.id;
      state.dashTcCycle=activeTcCycle.id;
      const idx2=cycles.findIndex(c=>c.id===activeTcCycle.id);
      const open=getTcCycleOpen(cycles,idx2);
      if(open){
        const openD=new Date(open+'T12:00:00');
        const closeD=new Date(activeTcCycle.closeDate+'T12:00:00');
        tcPeriodLabel=getViewModeLabel(activeCycleMode)+' · '+expandPeriodYearLabel(activeTcCycle.label)+' · '+openD.toLocaleDateString('es-AR',{day:'2-digit',month:'short'})+' → '+closeD.toLocaleDateString('es-AR',{day:'2-digit',month:'short'});
        // In TC views, dashboard metrics should use the selected cycle window,
        // but aggregate charges across both cards in that same date range.
        monthTxns=(state.transactions||[]).filter(t=>{
          const d=dateToYMD(t.date);
          const pm=(t.payMethod||'').toLowerCase();
          const isNonCc=pm==='deb'||pm==='ef';
          return d>=open&&d<=activeTcCycle.closeDate&&!isNonCc;
        });
      } else {
        monthTxns=[];
        tcPeriodLabel=getViewModeLabel(activeCycleMode)+' · '+expandPeriodYearLabel(activeTcCycle.label);
      }
    } else {
      monthTxns=[];
      tcPeriodLabel='Sin ciclos configurados para '+getViewModeLabel(activeCycleMode)+' — configurá fechas en ⚙ Tarjeta de Crédito';
    }
  } else {
    monthTxns=getCurrentMonthTxns();
  }

  // ── Gastos ──
  // En modo TC: excluir débito/efectivo (payMethod=deb/ef) ya que el resumen de TC solo incluye cargos de tarjeta
  // En ambos modos: excluir cuotas proyectadas (isPendingCuota) — son gastos futuros, no actuales
  const _tcModeActive=isTcView&&activeTcCycle;
  const _isNonCC=(t)=>t.payMethod==='deb'||t.payMethod==='ef';
  const _todayYmd=dateToYMD(today);
  const _hasReachedChargeDate=(value)=>{
    const ymd=dateToYMD(value);
    return !!ymd && ymd<=_todayYmd;
  };
  const _getRecurringDatesInRange=(day,start,end)=>{
    if(!day||!start||!end) return [];
    const dates=[];
    const cursor=new Date(start.getFullYear(), start.getMonth(), 1);
    const limit=new Date(end.getFullYear(), end.getMonth(), 1);
    while(cursor<=limit){
      const maxDay=new Date(cursor.getFullYear(), cursor.getMonth()+1, 0).getDate();
      const date=new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(day, maxDay));
      if(date>=start&&date<=end) dates.push(date);
      cursor.setMonth(cursor.getMonth()+1);
    }
    return dates;
  };
  const isCountableCycleExpense=expense=>{
    if(!expense) return false;
    if(!expense.isPendingCuota && !expense.isPendingSubscription) return true;
    return _hasReachedChargeDate(expense.date);
  };
  const _allBillable=monthTxns.filter(t=>!t.isPendingCuota&&!t.isPendingSubscription&&(_tcModeActive?!_isNonCC(t):true));
  const billableTxns=_allBillable.filter(t=>!t.isThirdParty);
  const thirdPartyTxns=_allBillable.filter(t=>!!t.isThirdParty);
  const tpSettled=thirdPartyTxns.filter(t=>t.thirdPartyStatus==='settled');
  const tpSettledArs=tpSettled.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const tpSettledUsd=tpSettled.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);
  let arsMonth=_allBillable.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  let usdMonth=_allBillable.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);
  let cntMonth=_allBillable.length;
  const projectedMonthRange=(()=>{
    if(_tcModeActive&&activeTcCycle){
      const scopedCycles=getTcCycles(activeCycleMode);
      const openStr=getTcCycleOpen(scopedCycles, scopedCycles.findIndex(c=>c.id===activeTcCycle.id))||activeTcCycle.closeDate;
      return {startStr:openStr,endStr:activeTcCycle.closeDate};
    }
    const [year,month]=String(activeMk).split('-').map(Number);
    const lastDay=new Date(year,month,0).getDate();
    return {
      startStr:`${year}-${String(month).padStart(2,'0')}-01`,
      endStr:`${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
    };
  })();
  const projectedMonthTotals=sumProjectedCommitmentTotals(
    getProjectedCommitmentEntriesForRange({
      ...projectedMonthRange,
      todayRef:today,
      txns:state.transactions||[]
    }).filter(entry=>entry.synthetic || entry.kind==='Cuota proyectada' || entry.kind==='Suscripción proyectada')
  );
  if(!_tcModeActive){
    arsMonth+=projectedMonthTotals.ars;
    usdMonth+=projectedMonthTotals.usd;
    cntMonth+=projectedMonthTotals.count;
  }
  const futureCommitmentTotals=sumProjectedCommitmentTotals(
    getProjectedCommitmentEntriesForRange({
      ...projectedMonthRange,
      todayRef:today,
      txns:state.transactions||[]
    }).filter(entry=>
      !entry.includeInTotal &&
      (entry.group==='cuotas'||entry.group==='suscripciones') &&
      (entry.synthetic || entry.kind==='Cuota proyectada' || entry.kind==='Suscripción proyectada' || entry.kind==='Cuota del ciclo' || entry.kind==='Cuota manual' || entry.kind==='Suscripción')
    ).map(entry=>({...entry,includeInTotal:true}))
  );
  // Disclaimer only for pending third party
  const tpPendingSumArs=thirdPartyTxns.filter(t=>t.thirdPartyStatus!=='settled' && t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  let syntheticARS=0;
  let syntheticUSD=0;
  let syntheticCount=0;
  const getSyntheticCycleTotals=cycle=>{
    if(!cycle) return {ars:0,usd:0,count:0};
    const totals={ars:0,usd:0,count:0};
    const scopedCycles=getTcCycles(activeCycleMode);
    const openDateValue=getTcCycleOpen(scopedCycles, scopedCycles.findIndex(c=>c.id===cycle.id))||cycle.closeDate;
    const openDate=new Date(openDateValue+'T00:00:00');
    const closeDate=new Date(cycle.closeDate+'T23:59:59');
    const extraKeys=new Set();
    const add=(key,currency,amount)=>{
      if(!key||extraKeys.has(key)) return;
      extraKeys.add(key);
      if((currency||'ARS')==='USD') totals.usd+=Number(amount)||0;
      else totals.ars+=Number(amount)||0;
      totals.count++;
    };
    (state.transactions||[]).filter(t=>(t.isPendingCuota||t.isPendingSubscription)).forEach(t=>{
      if(!_hasReachedChargeDate(t.date)) return;
      const d=new Date(String(t.date).includes('T')?t.date:(String(t.date)+'T12:00:00'));
      if(d<openDate||d>closeDate) return;
      if(t.isPendingSubscription && t.sourceSubscriptionId){
        const sub=(state.subscriptions||[]).find(s=>s.id===t.sourceSubscriptionId);
        const monthKey=getMonthKey(t.date);
        if(sub && typeof hasRealSubscriptionChargeInMonth==='function' && hasRealSubscriptionChargeInMonth(sub, monthKey, state.transactions||[])) return;
      }
      const key=t.isPendingCuota?`cuota-${t.cuotaGroupId}-${t.cuotaNum}`:`sub-${t.sourceSubscriptionId||t.id}`;
      add(key,t.currency,t.amount);
    });
    if(typeof detectAutoCuotas==='function' && typeof getAutoCuotaSnapshot==='function'){
      detectAutoCuotas().forEach(g=>{
        const snap=getAutoCuotaSnapshot(g, new Date(Math.min(today.getTime(), closeDate.getTime())));
        if(!snap || snap.rem<=0) return;
        const dueDay=snap.cfg?.day||snap.scheduleDay||null;
        if(!dueDay) return;
        _getRecurringDatesInRange(dueDay,openDate,closeDate).forEach(dueDate=>{
          if(!_hasReachedChargeDate(dueDate)) return;
          add(`auto-${g.key}-${dateToYMD(dueDate)}`,'ARS',snap.amountPerCuota);
        });
      });
    }
    (state.cuotas||[]).forEach(c=>{
      if(c.paid>=c.total||!c.day) return;
      _getRecurringDatesInRange(c.day,openDate,closeDate).forEach(dueDate=>{
        if(!_hasReachedChargeDate(dueDate)) return;
        add(`manual-${c.id}-${dateToYMD(dueDate)}`,'ARS',c.amount);
      });
    });
    (state.subscriptions||[]).filter(s=>s.active!==false&&s.freq==='monthly'&&s.day).forEach(s=>{
      _getRecurringDatesInRange(s.day,openDate,closeDate).forEach(dueDate=>{
        if(!_hasReachedChargeDate(dueDate)) return;
        const monthKey=getMonthKey(dueDate);
        if(typeof hasRealSubscriptionChargeInMonth==='function' && hasRealSubscriptionChargeInMonth(s, monthKey, state.transactions||[])) return;
        add(`sub-cycle-${s.id}-${dateToYMD(dueDate)}`,s.currency||'ARS',s.price);
      });
    });
    (state.fixedExpenses||[]).filter(f=>f.day).forEach(f=>{
      _getRecurringDatesInRange(f.day,openDate,closeDate).forEach(dueDate=>{
        if(!_hasReachedChargeDate(dueDate)) return;
        add(`fixed-cycle-${f.id||f.name}-${dateToYMD(dueDate)}`,f.currency||'ARS',f.amount);
      });
    });
    return totals;
  };
  if(_tcModeActive){
    const _scopedCycles=getTcCycles(activeCycleMode);
    const _openDate=new Date((getTcCycleOpen(_scopedCycles, _scopedCycles.findIndex(c=>c.id===activeTcCycle.id))||activeTcCycle.closeDate)+'T00:00:00');
    const _closeDate=new Date(activeTcCycle.closeDate+'T23:59:59');
    let extraARS=0;
    let extraUSD=0;
    let extraCount=0;
    const extraKeys=new Set();
    const addExtra=(key,currency,amount)=>{
      if(!key||extraKeys.has(key)) return;
      extraKeys.add(key);
      if((currency||'ARS')==='USD') extraUSD+=Number(amount)||0;
      else extraARS+=Number(amount)||0;
      extraCount++;
    };
    const addSyntheticExtra=(key,currency,amount)=>{
      addExtra(key,currency,amount);
      if((currency||'ARS')==='USD') syntheticUSD+=Number(amount)||0;
      else syntheticARS+=Number(amount)||0;
      syntheticCount++;
    };
    (state.transactions||[]).filter(t=>(t.isPendingCuota||t.isPendingSubscription)).forEach(t=>{
      if(!_hasReachedChargeDate(t.date)) return;
      const d=new Date(String(t.date).includes('T')?t.date:(String(t.date)+'T12:00:00'));
      if(d<_openDate||d>_closeDate) return;
      if(t.isPendingSubscription && t.sourceSubscriptionId){
        const sub=(state.subscriptions||[]).find(s=>s.id===t.sourceSubscriptionId);
        const monthKey=getMonthKey(t.date);
        if(sub && typeof hasRealSubscriptionChargeInMonth==='function' && hasRealSubscriptionChargeInMonth(sub, monthKey, state.transactions||[])) return;
      }
      const key=t.isPendingCuota?`cuota-${t.cuotaGroupId}-${t.cuotaNum}`:`sub-${t.sourceSubscriptionId||t.id}`;
      addExtra(key,t.currency,t.amount);
    });
    if(typeof detectAutoCuotas==='function' && typeof getAutoCuotaSnapshot==='function'){
      detectAutoCuotas().forEach(g=>{
        const snap=getAutoCuotaSnapshot(g, new Date(Math.min(today.getTime(), _closeDate.getTime())));
        if(!snap || snap.rem<=0) return;
        const dueDay=snap.cfg?.day||snap.scheduleDay||null;
        if(!dueDay) return;
        _getRecurringDatesInRange(dueDay,_openDate,_closeDate).forEach(dueDate=>{
          if(!_hasReachedChargeDate(dueDate)) return;
          addSyntheticExtra(`auto-${g.key}-${dateToYMD(dueDate)}`,'ARS',snap.amountPerCuota);
        });
      });
    }
    (state.cuotas||[]).forEach(c=>{
      if(c.paid>=c.total||!c.day) return;
      _getRecurringDatesInRange(c.day,_openDate,_closeDate).forEach(dueDate=>{
        if(!_hasReachedChargeDate(dueDate)) return;
        addSyntheticExtra(`manual-${c.id}-${dateToYMD(dueDate)}`,'ARS',c.amount);
      });
    });
    (state.subscriptions||[]).filter(s=>s.active!==false&&s.freq==='monthly'&&s.day).forEach(s=>{
      _getRecurringDatesInRange(s.day,_openDate,_closeDate).forEach(dueDate=>{
        if(!_hasReachedChargeDate(dueDate)) return;
        const monthKey=getMonthKey(dueDate);
        if(typeof hasRealSubscriptionChargeInMonth==='function' && hasRealSubscriptionChargeInMonth(s, monthKey, state.transactions||[])) return;
        addSyntheticExtra(`sub-cycle-${s.id}-${dateToYMD(dueDate)}`,s.currency||'ARS',s.price);
      });
    });
    (state.fixedExpenses||[]).filter(f=>f.day).forEach(f=>{
      _getRecurringDatesInRange(f.day,_openDate,_closeDate).forEach(dueDate=>{
        if(!_hasReachedChargeDate(dueDate)) return;
        addSyntheticExtra(`fixed-cycle-${f.id||f.name}-${dateToYMD(dueDate)}`,f.currency||'ARS',f.amount);
      });
    });
    arsMonth+=extraARS;
    usdMonth+=extraUSD;
    cntMonth+=extraCount;
  }
  const arsCnt=billableTxns.filter(t=>t.currency==='ARS').length;
  const uncategorizedCount=billableTxns.filter(t=>!t.category||t.category==='Uncategorized'||t.category==='Procesando...').length;
  const catTotals={};
  billableTxns.filter(t=>t.currency==='ARS').forEach(t=>{catTotals[t.category||'Sin categoría']=(catTotals[t.category||'Sin categoría']||0)+t.amount;});
  const topCategories=Object.entries(catTotals)
    .sort((a,b)=>b[1]-a[1])
    .map(([name,amount])=>({name,amount,pct:arsMonth>0?Math.round(amount/arsMonth*100):0}));

  // TC del mes
  const tcMonth=monthTxns.filter(t=>t.currency==='ARS'&&t.payMethod==='tc').reduce((s,t)=>s+t.amount,0);
  const debMonth=monthTxns.filter(t=>t.currency==='ARS'&&t.payMethod==='deb').reduce((s,t)=>s+t.amount,0);
  const hasPayTags=monthTxns.some(t=>t.payMethod);

  // ── Widget Tarjeta: usa el mismo ciclo activo del dashboard en vista TC, o el actual como fallback ──
  const _tcCycles=getTcCycles(isTcView?activeCycleMode:null);
  const dashboardCycleForCards=(isTcView&&activeTcCycle)?activeTcCycle:currentTcCycle;
  let _tcWidgetTxns=monthTxns; // fallback: mismo período
  if(dashboardCycleForCards){
    _tcWidgetTxns=getTcCycleTxns(dashboardCycleForCards,_tcCycles);
  }
  // TC widget: incluir VISA, AMEX, y 'tc' (todos son cargos de tarjeta de crédito)
  const _isCCCharge=(t)=>t.payMethod==='tc'||t.payMethod==='visa'||t.payMethod==='amex'||(!t.payMethod&&!t.isPendingCuota);
  const tcWidgetAmt=_tcWidgetTxns.filter(t=>t.currency==='ARS'&&_isCCCharge(t)&&!t.isPendingCuota).reduce((s,t)=>s+t.amount,0);
  const debWidgetAmt=_tcWidgetTxns.filter(t=>t.currency==='ARS'&&t.payMethod==='deb').reduce((s,t)=>s+t.amount,0);
  const hasPayTagsWidget=_tcWidgetTxns.some(t=>t.payMethod);

  const dashboardCardTotals={};
  const dashboardCardDisplayTotals={};
  let dashboardCardsArs=0;
  let dashboardCardsUsd=0;
  let dashboardCardsCount=0;
  const dashboardCards=(state.ccCards||[]);
  const dashboardCardCycleByCardId={};
  const dashboardCardCycleByKey={};
  const _dashboardAnchorYmd=(dashboardCycleForCards?.closeDate)||dateToYMD(today);
  const _resolveCardCycleByMode=(modeKey)=>{
    const mode=normalizeViewMode(modeKey||'mes');
    const cardCycles=getTcCycles(mode);
    if(!cardCycles.length) return null;
    const containing=cardCycles.find(c=>{
      const idx=cardCycles.findIndex(x=>x.id===c.id);
      const open=getTcCycleOpen(cardCycles, idx);
      return open&&_dashboardAnchorYmd>=open&&_dashboardAnchorYmd<=c.closeDate;
    });
    if(containing) return containing;
    const latestPast=cardCycles.find(c=>(c.closeDate||'')<=_dashboardAnchorYmd);
    if(latestPast) return latestPast;
    return cardCycles[cardCycles.length-1]||cardCycles[0]||null;
  };
  if(dashboardCards.length){
    dashboardCards.forEach(card=>{
      const cardMode=normalizeViewMode((card.payMethodKey||'mes').toLowerCase());
      let cardCycle=null;
      if(
        dashboardCycleForCards &&
        (
          (dashboardCycleForCards.cardId&&dashboardCycleForCards.cardId===card.id) ||
          (
            !dashboardCycleForCards.cardId &&
            normalizeViewMode((dashboardCycleForCards.payMethodKey||activeCycleMode||'mes').toLowerCase())===cardMode
          )
        )
      ){
        cardCycle=dashboardCycleForCards;
      }else{
        cardCycle=_resolveCardCycleByMode(cardMode);
      }
      if(cardCycle){
        dashboardCardCycleByCardId[card.id]=cardCycle;
        dashboardCardCycleByKey[(card.payMethodKey||card.id||'').toLowerCase()]=cardCycle;
      }
    });
  }
  if(isTcView&&dashboardCycleForCards&&dashboardCards.length&&typeof ccGetCycleExpenses==='function'&&typeof ccGetTotals==='function'){
    dashboardCards.forEach(card=>{
      const scopedCycle=dashboardCardCycleByCardId[card.id]||dashboardCycleForCards;
      if(!scopedCycle){
        dashboardCardTotals[card.payMethodKey||card.id]={ars:0,usd:0,count:0};
        dashboardCardDisplayTotals[card.payMethodKey||card.id]={ars:0,usd:0,count:0};
        return;
      }
      const expenses=ccGetCycleExpenses(card.id,scopedCycle.id).filter(isCountableCycleExpense);
      const totals=ccGetTotals(expenses);
      dashboardCardTotals[card.payMethodKey||card.id]={ars:totals.ars||0,usd:totals.usd||0,count:totals.count||0};
      dashboardCardDisplayTotals[card.payMethodKey||card.id]={ars:totals.ars||0,usd:totals.usd||0,count:totals.count||0};
      dashboardCardsArs+=totals.ars||0;
      dashboardCardsUsd+=totals.usd||0;
      dashboardCardsCount+=totals.count||0;
    });
  } else if(!isTcView&&dashboardCards.length){
    // Vista Mes: monthly totals per card from monthTxns
    dashboardCards.forEach(card=>{
      const key=(card.payMethodKey||card.id||'').toLowerCase();
      const cardTxns=monthTxns.filter(t=>(t.payMethod||'').toLowerCase()===key&&!t.isPendingCuota&&!t.isPendingSubscription);
      const ars=cardTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
      const usd=cardTxns.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);
      const count=cardTxns.length;
      dashboardCardTotals[key]={ars,usd,count};
      dashboardCardDisplayTotals[key]={ars,usd,count};
      dashboardCardsArs+=ars;
      dashboardCardsUsd+=usd;
      dashboardCardsCount+=count;
    });
  }
  const widgetSyntheticTotals=(dashboardCycleForCards&&dashboardCards.length)
    ? ((_tcModeActive&&activeTcCycle&&dashboardCycleForCards.id===activeTcCycle.id)
        ? {ars:syntheticARS,usd:syntheticUSD,count:syntheticCount}
        : getSyntheticCycleTotals(dashboardCycleForCards))
    : {ars:0,usd:0,count:0};
  if(dashboardCycleForCards&&dashboardCards.length){
    const cycleOwnerCardId=state.ccActiveCard||dashboardCards.find(c=>c.payMethodKey==='visa')?.id||dashboardCards[0]?.id||null;
    const cycleOwnerCard=dashboardCards.find(c=>c.id===cycleOwnerCardId)||dashboardCards[0]||null;
    const cycleOwnerKey=cycleOwnerCard?.payMethodKey||cycleOwnerCard?.id||null;
    if(cycleOwnerKey){
      const ownerTotals=dashboardCardDisplayTotals[cycleOwnerKey]||{ars:0,usd:0,count:0};
      dashboardCardDisplayTotals[cycleOwnerKey]={
        ars:(ownerTotals.ars||0)+widgetSyntheticTotals.ars,
        usd:(ownerTotals.usd||0)+widgetSyntheticTotals.usd,
        count:(ownerTotals.count||0)+widgetSyntheticTotals.count
      };
    }
  }
  if(isTcView&&dashboardCycleForCards&&dashboardCards.length){
    arsMonth=dashboardCardsArs+syntheticARS;
    usdMonth=dashboardCardsUsd+syntheticUSD;
    cntMonth=dashboardCardsCount+syntheticCount;
  }
  const rawPeriodArsMonth=_allBillable.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0) + (_tcModeActive?syntheticARS:projectedMonthTotals.ars);
  const rawPeriodUsdMonth=_allBillable.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0) + (_tcModeActive?syntheticUSD:projectedMonthTotals.usd);
  const rawPeriodCntMonth=_allBillable.length + (_tcModeActive?syntheticCount:projectedMonthTotals.count);
  const operationalArsMonth=rawPeriodArsMonth;
  const operationalUsdMonth=rawPeriodUsdMonth;
  const operationalCntMonth=rawPeriodCntMonth;
  const creditCycleArsTotal=arsMonth;

  // ── Ingresos ──
  // Priority: 1) income month linked to active TC cycle open month  2) exact active month
  // 3) most recent logged month  4) source bases  5) legacy fallback
  let incARS=state.income.ars+state.income.varArs;
  let incUSD=state.income.usd+state.income.varUsd;
  const incomeCandidates=[];
  if(isTcView&&activeTcCycle){
    const _cycleList=getTcCycles(activeCycleMode);
    const _cycleIdx=_cycleList.findIndex(c=>c.id===activeTcCycle.id);
    const _openMonth=getTcCycleOpen(_cycleList,_cycleIdx)?.slice(0,7);
    const _closeMonth=activeTcCycle.closeDate?.slice(0,7);
    if(_openMonth)incomeCandidates.push(_openMonth);
    if(_closeMonth&&_closeMonth!==_openMonth)incomeCandidates.push(_closeMonth);
  }
  if(!incomeCandidates.includes(activeMk))incomeCandidates.push(activeMk);
  const _exactIncMonth=incomeCandidates.map(mk=>(state.incomeMonths||[]).find(m=>m.month===mk)).find(Boolean);
  const _incFromSrcBases=(state.incomeSources||[]).some(s=>s.base>0);
  if(_exactIncMonth){
    incARS=getMonthTotalARS(_exactIncMonth);
    incUSD=getMonthTotalUSD(_exactIncMonth);
  } else if(state.incomeMonths?.length){
    // Most recent logged entry
    const _last=[...state.incomeMonths].sort((a,b)=>b.month.localeCompare(a.month))[0];
    if(_last){incARS=getMonthTotalARS(_last);incUSD=getMonthTotalUSD(_last);}
  } else if(_incFromSrcBases){
    incARS=(state.incomeSources||[]).filter(s=>s.currency==='ARS').reduce((a,s)=>a+(s.base||0),0);
    incUSD=(state.incomeSources||[]).filter(s=>s.currency==='USD').reduce((a,s)=>a+(s.base||0),0);
  }
  // (Sync button removed from margin widget)
  const incTotalARS=incARS+(incUSD*USD_TO_ARS);
  arsMonth=operationalArsMonth;
  usdMonth=operationalUsdMonth;
  cntMonth=operationalCntMonth;
  const totalGastoARS=arsMonth+(usdMonth*USD_TO_ARS);
  const pct=incTotalARS>0?Math.round((totalGastoARS/incTotalARS)*100):null;
  const spendBudget=incTotalARS>0?incTotalARS*(state.spendPct||100)/100:0;
  const margen=incTotalARS>0?spendBudget-totalGastoARS:null;

  // ── Proyección ──
  const[pY,pM]=activeMk.split('-').map(Number);
  const daysInMonth=new Date(pY,pM,0).getDate();
  let dailyRate=0, projected=0, daysLeft=0, projPeriodOpen=null, projPeriodClose=null;

  if(isTcView && activeTcCycle){
    // Modo TC: proyectar hasta el cierre del ciclo TC activo
    const _cycleList=getTcCycles(activeCycleMode);
    const _tcOpen=getTcCycleOpen(_cycleList, _cycleList.findIndex(c=>c.id===activeTcCycle.id));
    const _tcOpenD = _tcOpen ? new Date(_tcOpen+'T12:00:00') : new Date();
    const _tcCloseD = new Date(activeTcCycle.closeDate+'T12:00:00');
    const _totalDays = Math.max(1, Math.round((_tcCloseD - _tcOpenD) / 86400000) + 1);
    const _daysElapsed = Math.max(1, Math.min(_totalDays, Math.round((today - _tcOpenD) / 86400000) + 1));
    daysLeft = Math.max(0, _totalDays - _daysElapsed);
    dailyRate = totalGastoARS / _daysElapsed;
    projected = Math.round(totalGastoARS + (dailyRate * daysLeft) + futureCommitmentTotals.ars + (futureCommitmentTotals.usd * USD_TO_ARS));
    projPeriodClose = _tcCloseD;
  } else {
    // Modo Mes: proyectar hasta fin del mes calendario
    const dayOfMonth = isCurrentMonth ? today.getDate() : daysInMonth;
    daysLeft = isCurrentMonth ? daysInMonth - today.getDate() : 0;
    dailyRate = dayOfMonth > 0 ? totalGastoARS / dayOfMonth : 0;
    projected = isCurrentMonth
      ? Math.round(totalGastoARS + (dailyRate * daysLeft) + futureCommitmentTotals.ars + (futureCommitmentTotals.usd * USD_TO_ARS))
      : totalGastoARS;
    // Keep close date aligned to selected month, not necessarily current month.
    projPeriodClose = new Date(pY, pM, 0, 12, 0, 0);
  }

  const dashMonthNames=[t('month_1'),t('month_2'),t('month_3'),t('month_4'),t('month_5'),t('month_6'),t('month_7'),t('month_8'),t('month_9'),t('month_10'),t('month_11'),t('month_12')];
  const insightSummary={
    mes:isTcView?(activeTcCycle?.label||'Ciclo actual'):(dashMonthNames[pM-1]+' '+pY),
    total_ars:arsMonth,
    total_usd:usdMonth,
    income_ars:incTotalARS,
    spending_pct:pct,
    categories:topCategories.slice(0,8),
    txn_count:cntMonth,
    alert_threshold:state.alertThreshold
  };
  const aiItems=fallbackInsights(insightSummary);
  const upcomingCard=getUpcomingCardMilestone(today);
  const liveAlerts=collectDashboardAlerts(today);
  const decisionCards=[];
  liveAlerts.slice(0,2).forEach(alert=>{
    decisionCards.push({
      icon:alert.icon||'alert',
      tone:alert.type==='alert'?'danger':alert.type==='warn'?'warning':'info',
      kicker:'Alerta real',
      title:alert.title,
      body:alert.body,
      cta:'Resolver',
      link:alert.link||'dashboard'
    });
  });
  if(incTotalARS<=0){
    decisionCards.push({
      icon:'focus',
      tone:'warning',
      kicker:'Configuración',
      title:'Definí tu base de ingresos',
      body:'Sumá ingresos fijos o del período para habilitar alertas de margen, proyección y decisiones de cierre.',
      cta:'Abrir ingresos',
      link:'income'
    });
  } else if(projected>incTotalARS){
    decisionCards.push({
      icon:'alert',
      tone:'danger',
      kicker:'Prioridad del día',
      title:'El ritmo actual proyecta cierre en rojo',
      body:`Si seguís así, el período puede cerrar con un desvío estimado de <strong>$${fmtN(Math.round(projected-incTotalARS))}</strong>.`,
      cta:'Revisar movimientos',
      link:'transactions'
    });
  } else if(pct!==null&&pct>=state.alertThreshold){
    decisionCards.push({
      icon:'trend',
      tone:'warning',
      kicker:'Control de ritmo',
      title:`Ya consumiste ${pct}% del ingreso disponible`,
      body:'Todavía podés sostener un cierre sano si frenás gasto variable y priorizás compromisos reales.',
      cta:'Ver detalle',
      link:'dashboard'
    });
  } else {
    decisionCards.push({
      icon:'safe',
      tone:'success',
      kicker:'Panorama',
      title:'El período viene estable',
      body:margen!==null?`Hoy te queda un margen estimado de <strong>$${fmtN(Math.round(margen))}</strong> sobre tu presupuesto disponible.`:'El ritmo del gasto está controlado y sin alertas críticas.',
      cta:'Seguir monitoreando',
      link:'dashboard'
    });
  }
  if(aiItems[0]){
    decisionCards.push({
      icon:'ai',
      tone:'info',
      kicker:'Motor IA',
      title:stripHtml(aiItems[0].headline),
      body:aiItems[0].body,
      cta:'Abrir insights',
      link:'insights'
    });
  }
  if(upcomingCard){
    const labelDate=upcomingCard.date.toLocaleDateString('es-AR',{day:'2-digit',month:'short'});
    decisionCards.push({
      icon:upcomingCard.type==='due'?'alert':'calendar',
      tone:upcomingCard.days<=2?'warning':'neutral',
      kicker:'Próximo hito',
      title:`${upcomingCard.label} · ${upcomingCard.type==='due'?'vence':'cierra'} ${upcomingCard.days===0?'hoy':'en '+upcomingCard.days+' días'}`,
      body:`Próximo evento relevante el <strong>${labelDate}</strong>. Ideal para ordenar pagos y evitar sorpresas en el cierre.`,
      cta:'Abrir tarjetas',
      link:'credit-cards'
    });
  }
  if(uncategorizedCount>0){
    decisionCards.push({
      icon:'tag',
      tone:'neutral',
      kicker:'Calidad de datos',
      title:`${uncategorizedCount} movimientos piden clasificación`,
      body:'Resolver categorías mejora reportes, tendencias y recomendaciones del motor de análisis.',
      cta:'Ordenar movimientos',
      link:'transactions'
    });
  } else if(topCategories[0]){
    decisionCards.push({
      icon:'spark',
      tone:'neutral',
      kicker:'Palanca principal',
      title:`${topCategories[0].name} explica ${topCategories[0].pct}% del gasto`,
      body:`Es la categoría con más impacto económico del período: <strong>$${fmtN(Math.round(topCategories[0].amount))}</strong>.`,
      cta:'Ver tendencias',
      link:'tendencia'
    });
  }
  renderDecisionCenter({
    kicker:liveAlerts.length?'CENTRO DE ALERTAS Y DECISIONES':'CENTRO DE DECISIONES',
    title:liveAlerts.length?`Alertas reales y próximos pasos para ${isTcView?(expandPeriodYearLabel(activeTcCycle?.label||'este ciclo')):(dashMonthNames[pM-1]+' '+pY)}`:`Prioridades claras para ${isTcView?(expandPeriodYearLabel(activeTcCycle?.label||'este ciclo')):(dashMonthNames[pM-1]+' '+pY)}`,
    periodLabel:isTcView?(expandPeriodYearLabel(activeTcCycle?.label||'este ciclo')):(dashMonthNames[pM-1]+' '+pY),
    summary:liveAlerts[0]?stripHtml(liveAlerts[0].body):aiItems[1]?stripHtml(aiItems[1].headline):'Tu tablero ahora destaca lo urgente, lo importante y la próxima mejor acción.',
    alertCount:liveAlerts.length,
    cards:decisionCards.slice(0,4)
  });

  // ── Compromisos (cuotas + subs + gastos fijos) ──
  const autoGroups=typeof detectAutoCuotas==='function'?detectAutoCuotas():[];
  const cuotasAmt=autoGroups.map(g=>{
    const snap=typeof getAutoCuotaSnapshot==='function'?getAutoCuotaSnapshot(g,today):null;
    if(!snap||snap.paid>=snap.total) return 0;
    return snap.amountPerCuota;
  }).reduce((s,v)=>s+v,0) + state.cuotas.filter(c=>c.paid<c.total).reduce((s,c)=>s+c.amount,0);
  const toMonthly=s=>{if(s.freq==='monthly')return s.price;if(s.freq==='annual')return s.price/12;if(s.freq==='weekly')return s.price*4.3;return s.price;};
  const subsARS=state.subscriptions.filter(s=>s.currency==='ARS').reduce((acc,s)=>acc+toMonthly(s),0);
  const subsUSD=state.subscriptions.filter(s=>s.currency==='USD').reduce((acc,s)=>acc+toMonthly(s),0);
  const fixedARS=(state.fixedExpenses||[]).filter(f=>f.currency==='ARS').reduce((a,f)=>a+f.amount,0);
  const fixedUSD=(state.fixedExpenses||[]).filter(f=>f.currency==='USD').reduce((a,f)=>a+f.amount,0);
  const compromisoARS=cuotasAmt+subsARS+fixedARS;
  const compromisoUSD=subsUSD+fixedUSD;
  const compromisoTotal=compromisoARS+(compromisoUSD*USD_TO_ARS);

  // ── Selector y fecha ──
  updateMonthPicker();
  const MNAMES=[t('month_1'),t('month_2'),t('month_3'),t('month_4'),t('month_5'),t('month_6'),t('month_7'),t('month_8'),t('month_9'),t('month_10'),t('month_11'),t('month_12')];
  const _spendLabel = totalGastoARS>0 ? ' · $'+fmtN(totalGastoARS)+' gastados' : '';
  const dashDateEl=document.getElementById('dash-date');
  if(dashDateEl){
    dashDateEl.textContent='';
    dashDateEl.style.display='none';
  }

  // ── Título dinámico del dashboard ──
  const _titleEl=document.getElementById('dash-page-title');
  if(_titleEl){_titleEl.innerHTML='';_titleEl.style.display='none';}
  const timelineData=getDashboardTimelineData(today);
  const backupHealth=getBackupHealth(today);
  const slotEls=[1,2,3].map(i=>({
    label:document.getElementById(`timeline-slot-${i}-label`),
    chip:document.getElementById(`timeline-slot-${i}-chip`),
    value:document.getElementById(`timeline-slot-${i}-value`),
    meta:document.getElementById(`timeline-slot-${i}-meta`)
  }));
  // Agenda viva: simplemente tomamos los próximos 4 eventos por fecha
  // (cuotas, suscripciones, gastos fijos, cierre de TC y vencimiento de TC)
  const rawEvents=getCalendarAgendaItems(today,{includePast:false,includeDoneTasks:false});
  const seenTimeline=new Set();
  const timelineCards=[];
  const pushTimelineEvent=e=>{
    if(!e||timelineCards.length>=3) return;
    const key=`${e.type}-${e.title}-${e.date instanceof Date?e.date.toISOString():e.date}`;
    if(seenTimeline.has(key)) return;
    seenTimeline.add(key);
    timelineCards.push(e);
  };
  rawEvents.forEach(pushTimelineEvent);
  const fallbackCards=[
    {label:'Presión semanal',chip:'caja',value:timelineData.nextWeekAmount>0?`$${fmtN(Math.round(timelineData.nextWeekAmount||0))}`:'Semana despejada',meta:timelineData.nextWeekCount?`${timelineData.nextWeekCount} evento${timelineData.nextWeekCount!==1?'s':''} en los próximos 7 días.`:`Sin presión inmediata en la agenda financiera.`},
    {label:'Backup',chip:backupHealth.level==='info'?'al día':'revisar',value:backupHealth.label,meta:backupHealth.desc},
    {label:'Agenda',chip:'sin eventos',value:'Sin urgencias',meta:'Tu agenda financiera se ve estable por ahora.'}
  ];
  while(timelineCards.length<3&&fallbackCards.length) timelineCards.push(fallbackCards.shift());
  const formatTimelineCard=e=>{
    if(e.label) return e;
    const when=e.days===0?'Hoy':e.days===1?'Mañana':`En ${e.days} días`;
    const dateLabel=e.date instanceof Date?e.date.toLocaleDateString('es-AR',{day:'2-digit',month:'short'}):'';
    if(e.type==='close'||e.type==='due'){
      return {
        label:e.type==='due'?'Vencimiento tarjeta':'Cierre tarjeta',
        chip:e.type==='due'?'pago TC':'cierre TC',
        value:e.shortLabel,
        meta:`${when} · ${dateLabel}`
      };
    }
    if(e.type==='subscription'){
      return {
        label:'Suscripción',
        chip:'suscripción',
        value:e.shortLabel,
        meta:`${when} · $${fmtN(Math.round(e.amount||0))}`
      };
    }
    if(e.type==='task'){
      return {
        label:'Task',
        chip:'agenda',
        value:e.shortLabel,
        meta:`${when} · Pendiente`
      };
    }
    if(e.type==='fixed'){
      return {
        label:'Gasto fijo',
        chip:'fijo',
        value:e.shortLabel,
        meta:`${when} · $${fmtN(Math.round(e.amount||0))}`
      };
    }
    return {
      label:'Próxima cuota',
      chip:'cuota',
      value:e.shortLabel,
      meta:`${when} · $${fmtN(Math.round(e.amount||0))}`
    };
  };
  slotEls.forEach((slot,idx)=>{
    const card=formatTimelineCard(timelineCards[idx]||fallbackCards[0]);
    if(slot.label)slot.label.textContent=card.label;
    if(slot.chip)slot.chip.textContent=card.chip;
    if(slot.value)slot.value.textContent=card.value;
    if(slot.meta)slot.meta.textContent=card.meta;
  });
  const timelinePill=document.getElementById('timeline-card-pill');
  if(timelinePill){
    const visibleCount=Math.min(3,timelineCards.length||0);
    timelinePill.textContent=visibleCount===1?'1 evento':`${visibleCount||3} eventos`;
  }

  // ── Hero ──
  const dhcML=document.getElementById('dhc-month-label');
  if(dhcML){
    let label = isTcView&&activeTcCycle?expandPeriodYearLabel(cleanHeroCycleLabel(activeTcCycle.label||'')):((MNAMES[pM-1]||'')+ ' ' + pY);
    if(isTcView) label = 'VISA + AMEX · ' + label;
    dhcML.textContent = label.toUpperCase();
  }
  if(isMasked()) {
    const _kpiMain = document.getElementById('kpi-ars');
    if(_kpiMain) _kpiMain.textContent = '••••••••';
  } else {
    animateNumberText(document.getElementById('kpi-ars'),totalGastoARS,{prefix:'$',decimals:2,duration:920});
  }
  // ARS/USD breakdown line
  const _arsLine=document.getElementById('dhc-ars-line');
  const _usdLine=document.getElementById('dhc-usd-line');
  const _pctInline=document.getElementById('dhc-pct-inline');
  if(_arsLine)animateNumberText(_arsLine,arsMonth,{prefix:'$',decimals:2,duration:760});
  if(_usdLine){
    if(usdMonth>0)animateNumberText(_usdLine,usdMonth,{prefix:'U$D ',decimals:2,duration:760});
    else _usdLine.textContent='—';
  }
  if(_pctInline&&pct!==null){
    if(isMasked()) _pctInline.textContent = '••% del presupuesto';
    else _pctInline.textContent=pct+'% del ingreso';
  }
  else if(_pctInline)_pctInline.textContent='';

  const tpNoteEl=document.getElementById('dhc-third-party-note');
  if(tpNoteEl){
    if(tpPendingSumArs>0){
      tpNoteEl.style.display='block';
      tpNoteEl.innerHTML=`<span style="color:#ff9f0a;font-weight:800;">$${fmtN(Math.round(tpPendingSumArs))}</span> a recuperar de terceros`;
    } else {
      tpNoteEl.style.display='none';
    }
  }
  // Hidden compat
  document.getElementById('kpi-ars-d').textContent=cntMonth+' movimientos · $'+fmtN(cntMonth>0?totalGastoARS/cntMonth:0)+' promedio';
  // 3 totals breakdown
  const _kpiArs = document.getElementById('kpi-total-ars');
  if(_kpiArs) {
    if(isMasked()) _kpiArs.textContent = '••••••••';
    else animateNumberText(_kpiArs,arsMonth,{prefix:'$',decimals:2,duration:760});
  }
  const _usdTotalEl=document.getElementById('kpi-total-usd');
  if(usdMonth>0 && _usdTotalEl) {
    if(isMasked()) _usdTotalEl.textContent = '••••••••';
    else animateNumberText(_usdTotalEl,usdMonth,{prefix:'U$D ',decimals:2,duration:760});
  }
  else if(_usdTotalEl){ _usdTotalEl.textContent='—'; }

  // Badge %
  const badge=document.getElementById('dhc-pct-badge');
  if(badge){
    if(pct!==null){
      const cls=pct>=100?'danger':pct>=state.alertThreshold?'warn':'safe';
      badge.className='dhc-badge '+cls;badge.textContent=pct+'% del ingreso';
    } else { badge.className='dhc-badge neutral';badge.textContent='Ingreso no configurado'; }
  }

  if(incTotalARS>0)animateNumberText(document.getElementById('kpi-inc-total'),incTotalARS,{prefix:'$',decimals:2,duration:760});
  else{const _incEl=document.getElementById('kpi-inc-total');if(_incEl)_incEl.textContent='—';}

  // ── Third-party expenses indicator ──
  const _tpEl=document.getElementById('dash-tp-indicator');
  if(_tpEl){
    _tpEl.style.display='none';
    _tpEl.innerHTML='';
  }

  // ── Balance (hidden compat) ──
  const balRow=document.getElementById('dhc-balance-row');
  if(balRow)balRow.style.display='none';
  const resEl=document.getElementById('dhc-bal-result');
  if(resEl){
    if(incTotalARS>0){
      const result=incTotalARS-totalGastoARS;
      const positive=result>=0;
      document.getElementById('dhc-bal-income').textContent='$'+fmtN(Math.round(incTotalARS));
      document.getElementById('dhc-bal-gasto').textContent='$'+fmtN(Math.round(totalGastoARS));
      resEl.textContent=(positive?'+$':'−$')+fmtN(Math.abs(Math.round(result)));
    }
  }

  // ── Margin bar ──
  const marginSection=document.getElementById('dhc-margin-section');
  if(marginSection&&incTotalARS>0){
    marginSection.style.display='block';
    // Use spendBudget (respects the configured spend % from Ingresos window)
    const margenDisp=spendBudget-totalGastoARS;
    const margenPct=Math.max(0,Math.min(100,Math.round(margenDisp/spendBudget*100)));
    const gastoPct=Math.min(100,Math.round(totalGastoARS/spendBudget*100));
    const isOver=margenDisp<0;
    animateNumberText(document.getElementById('dhc-margin-val'),Math.abs(Math.round(margenDisp)),{
      decimals:2,
      formatter:(n)=>(isOver?'−$':'$')+fmtN(n)
    });
    document.getElementById('dhc-margin-val').style.color=isOver?'var(--danger)':margenPct<20?'var(--accent3)':'var(--green-sys)';
    const mFill=document.getElementById('dhc-margin-fill');
    animateProgressBar(mFill,gastoPct);
    mFill.style.background=isOver?'var(--danger)':gastoPct>=state.alertThreshold?'var(--accent3)':'var(--accent)';
    document.getElementById('dhc-margin-sub').textContent=isOver?'Excedido en $'+fmtN(Math.abs(Math.round(margenDisp))):'Te quedan $'+fmtN(Math.round(margenDisp))+' disponibles';
    const _sp=state.spendPct||100;
    document.getElementById('dhc-margin-ingreso').textContent=_sp<100?'Presupuesto $'+fmtN(Math.round(spendBudget))+' ('+_sp+'% del ingreso)':'Ingreso $'+fmtN(Math.round(incTotalARS));
  } else if(marginSection){
    marginSection.style.display='none';
  }
  const _mpLabel=document.getElementById('dhc-margen-pct-label');
  if(_mpLabel){const _sp=state.spendPct||100;_mpLabel.textContent=_sp<100?'('+_sp+'%)':'';}
  const margenEl=document.getElementById('dhc-margen');
  if(margenEl){
    if(margen!==null){
      const spPct=state.spendPct||100;
      margenEl.textContent='$'+fmtN(margen);
      margenEl.title=spPct<100?'Sobre el '+spPct+'% del ingreso ($'+fmtN(spendBudget)+')':'Sobre el ingreso total';
    } else { margenEl.textContent='—'; }
  }

  // ── Payment method breakdown ──
  const payMethodSection=document.getElementById('dhc-pay-method-section');
  const payBar=document.getElementById('dhc-pay-bar');
  const payLabels=document.getElementById('dhc-pay-labels');
  if(payMethodSection&&payBar&&payLabels){
    const methods=[
      {key:'visa', label:'TC VISA', color:'#e63946'},
      {key:'amex', label:'TC AMEX', color:'#457b9d'},
      {key:'deb', label:'Débito', color:'var(--accent)'},
      {key:'ef', label:'Efectivo', color:'var(--accent3)'}
    ];
    const filteredTxns=monthTxns.filter(t=>t.amount>0);
    const totByMethod={};
    let totalForBar=0;
    methods.forEach(m=>{totByMethod[m.key]=0;});
    filteredTxns.forEach(t=>{
      const pm=t.payMethod||'';
      const amt=t.currency==='USD'?t.amount*(USD_TO_ARS||1):t.amount;
      if(methods.find(m=>m.key===pm)){totByMethod[pm]+=amt;totalForBar+=amt;}
    });
    if(totalForBar>0){
      payMethodSection.style.display='block';
      payBar.innerHTML=methods.map(m=>{
        const pct=totalForBar>0?(totByMethod[m.key]/totalForBar*100):0;
        if(pct<0.5)return '';
        return '<div style="width:'+pct.toFixed(1)+'%;background:'+m.color+';height:100%;transition:width .5s ease;"></div>';
      }).join('');
      payLabels.innerHTML=methods.map(m=>{
        const pct=totalForBar>0?(totByMethod[m.key]/totalForBar*100):0;
        if(pct<0.5)return '';
        return '<div style="display:flex;align-items:center;gap:4px;">'+
          '<div style="width:8px;height:8px;border-radius:50%;background:'+m.color+';flex-shrink:0;"></div>'+
          '<span style="font-size:11px;color:var(--text3);">'+m.label+'</span>'+
          '<span style="font-size:11px;font-weight:700;color:var(--text);font-family:var(--font);">'+Math.round(pct)+'%</span>'+
        '</div>';
      }).join('');
    } else {
      payMethodSection.style.display='none';
    }
  }
  if(usdMonth>0)animateNumberText(document.getElementById('kpi-usd'),usdMonth,{prefix:'U$D ',decimals:2,duration:760});
  else{const _kpiUsdEl=document.getElementById('kpi-usd');if(_kpiUsdEl)_kpiUsdEl.textContent='—';}

  const pFill=document.getElementById('dhc-progress-fill');
  const pLabel=document.getElementById('dhc-progress-label');
  if(pFill&&pct!==null){
    const col=pct>=100?'var(--danger)':pct>=state.alertThreshold?'var(--accent3)':'var(--accent)';
    animateProgressBar(pFill,Math.min(100,pct));pFill.style.background=col;
    if(pLabel)pLabel.textContent=pct+'% usado del ingreso · meta: '+state.alertThreshold+'%';
  } else if(pFill){pFill.style.width='0%';}

  // ── KPI: Tarjeta — split VISA / AMEX usando el mismo ciclo que está activo en el dashboard ──
  ccInit();
  const _ccCards=state.ccCards||[];
  _ccCards.forEach(card=>{
    const cardTotals=(isTcView?dashboardCardDisplayTotals:dashboardCardTotals)[card.payMethodKey||card.id]||{ars:0,usd:0};
    const cardArs=cardTotals.ars||0;
    const cardUsd=cardTotals.usd||0;
    const prefix=card.payMethodKey==='visa'?'visa':'amex';
    const arsEl=document.getElementById('kpi-'+prefix+'-ars');
    const usdEl=document.getElementById('kpi-'+prefix+'-usd');
    if(arsEl){
      if(cardArs>0)animateNumberText(arsEl,Math.round(cardArs),{prefix:'$',decimals:2,duration:720});
      else arsEl.textContent='—';
    }
    if(usdEl){
      if(cardUsd>0)animateNumberText(usdEl,cardUsd,{prefix:'U$D ',decimals:2,duration:720});
      else usdEl.textContent='';
    }
  });
  const cycleCaption=document.getElementById('kpi-cycle-caption');
  if(cycleCaption){
    cycleCaption.textContent=dashboardCycleForCards?.label?expandPeriodYearLabel(dashboardCycleForCards.label):'Sin ciclo activo';
  }
  // Hidden compat element
  let compatCycleTotal;
  if(isTcView){
    // Keep the cycle widget aligned with the card cycle totals in TC mode.
    compatCycleTotal=creditCycleArsTotal;
  }else if(dashboardCycleForCards&&dashboardCards.length){
    compatCycleTotal=dashboardCardsArs;
  }else if(hasPayTagsWidget){
    compatCycleTotal=tcWidgetAmt+debWidgetAmt;
  }else{
    compatCycleTotal=_tcWidgetTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  }
  animateNumberText(document.getElementById('kpi-tc'),compatCycleTotal,{prefix:'$',decimals:2,duration:760});
  // kpi-tc-d removed from HTML

  // ── KPI: Proyección ──
  const projEl=document.getElementById('kpi-proj');
  const projD=document.getElementById('kpi-proj-d');
  const projTitle=document.getElementById('kpi-proj-title');
  const getProjectionColor=value=>{
    if(!(incTotalARS>0)) return 'var(--text)';
    if(value>incTotalARS) return 'var(--danger)';
    if(value>=incTotalARS*0.85) return 'var(--accent3)';
    return 'var(--green-sys)';
  };
  if(projEl){
    if(isTcView && activeTcCycle){
      // TC mode: project to cycle close date
      if(daysLeft===0 && totalGastoARS===0){
        projEl.textContent='—'; projEl.style.color='var(--text3)';
        if(projD)projD.textContent='Sin datos cargados en este ciclo';
      } else {
        animateNumberText(projEl,projected,{prefix:'$',decimals:2,duration:860});
        const overBudget=incTotalARS>0&&projected>incTotalARS;
        projEl.style.color=getProjectionColor(projected);
        const closeLabel=projPeriodClose?projPeriodClose.toLocaleDateString('es-AR',{day:'2-digit',month:'short'}):'cierre';
        if(projD)projD.textContent=overBudget?'Exige ajuste antes del '+closeLabel:'Estimación activa hasta '+closeLabel;
        const _dailyEl=document.getElementById('kpi-proj-daily');
        if(_dailyEl)animateNumberText(_dailyEl,Math.round(dailyRate),{prefix:'$',decimals:2,duration:720});
        const _daysEl=document.getElementById('kpi-proj-days');
        if(_daysEl)animateNumberText(_daysEl,daysLeft,{decimals:0,duration:620,formatter:(n)=>`${Math.round(n)} día${Math.round(n) !== 1 ? 's' : ''}`});
        const _daysLabel=document.getElementById('kpi-proj-days-label');
        if(_daysLabel)_daysLabel.textContent='DÍAS RESTANTES';
      }
      if(projTitle)projTitle.textContent='PROYECCIÓN AL CIERRE TC';
    } else {
      // Mes mode
      if(isCurrentMonth){
        animateNumberText(projEl,projected,{prefix:'$',decimals:2,duration:860});
        const overBudget=incTotalARS>0&&projected>incTotalARS;
        projEl.style.color=getProjectionColor(projected);
        if(projD)projD.textContent=overBudget?'Ritmo alto para este mes':'Ritmo estimado al cierre mensual';
        const _dailyEl2=document.getElementById('kpi-proj-daily');
        if(_dailyEl2)animateNumberText(_dailyEl2,Math.round(dailyRate),{prefix:'$',decimals:2,duration:720});
        const _daysEl2=document.getElementById('kpi-proj-days');
        if(_daysEl2)animateNumberText(_daysEl2,daysLeft,{decimals:0,duration:620,formatter:(n)=>`${Math.round(n)} día${Math.round(n) !== 1 ? 's' : ''}`});
        const _daysLabel2=document.getElementById('kpi-proj-days-label');
        if(_daysLabel2)_daysLabel2.textContent='DÍAS RESTANTES';
      } else {
        projEl.textContent='—'; projEl.style.color='var(--text3)';
        if(projD)projD.textContent='Mes cerrado';
        const _dailyEl3=document.getElementById('kpi-proj-daily');
        if(_dailyEl3)_dailyEl3.textContent='—';
        const _daysEl3=document.getElementById('kpi-proj-days');
        if(_daysEl3)_daysEl3.textContent='—';
      }
      if(projTitle)projTitle.textContent='PROYECCIÓN AL CIERRE';
    }
  }

  // ── KPI: Compromisos ──
  const compEl=document.getElementById('kpi-compromisos');
  const compD=document.getElementById('kpi-compromisos-d');
  if(compEl){
    animateNumberText(compEl,Math.round(compromisoTotal),{prefix:'$',decimals:2,duration:820});
    const nC=autoGroups.length+state.cuotas.filter(c=>c.paid<c.total).length;
    const nS=state.subscriptions.length;
    const nF=(state.fixedExpenses||[]).length;
    
    // Detailed visibility for counts
    let htmlCounts = '';
    if(nC>0) htmlCounts += `<div class="comp-mini-badge"><span class="mini-icon">🛒</span> <strong>${nC}</strong> cuota${nC!==1?'s':''}</div>`;
    if(nS>0) htmlCounts += `<div class="comp-mini-badge"><span class="mini-icon">🔔</span> <strong>${nS}</strong> sub${nS!==1?'s':''}</div>`;
    if(nF>0) htmlCounts += `<div class="comp-mini-badge"><span class="mini-icon">🏠</span> <strong>${nF}</strong> fijo${nF!==1?'s':''}</div>`;
    
    if(compD) {
      compD.innerHTML = htmlCounts || '<span style="color:var(--text3)">Vencimientos de este mes</span>';
      // Use styles for the mini badges
      compD.style.display = 'flex';
      compD.style.gap = '8px';
      compD.style.marginTop = '12px';
      compD.style.flexWrap = 'wrap';
    }
    // Animate compromisos donut (% of income)
    const compDonut=document.getElementById('comp-donut-fill');
    const compDonutLabel=document.getElementById('comp-donut-label');
    const compMeta=document.querySelector('.comp-donut-meta');
    if(compDonut&&incTotalARS>0){
      const compPct=Math.min(Math.round(compromisoTotal/incTotalARS*100),100);
      const tone=compPct>50?'var(--danger)':compPct>30?'var(--accent3)':'var(--accent2)';
      compDonut.style.stroke=tone;
      animateDonutStroke(compDonut,compPct,38);
      if(compDonutLabel){
        animateNumberText(compDonutLabel,compPct,{decimals:0,duration:760,suffix:'%',formatter:(n)=>`${Math.round(n)}%`});
        compDonutLabel.style.color=tone;
      }
      if(compMeta)compMeta.textContent='Porcentaje del ingreso comprometido';
    } else if(compDonut){
      const circumference=2*Math.PI*38;
      compDonut.style.strokeDasharray=`${circumference}`;
      compDonut.style.strokeDashoffset=`${circumference}`;
      if(compDonutLabel)compDonutLabel.textContent='—';
      if(compMeta)compMeta.textContent='Porcentaje del ingreso comprometido';
    }
  }

  // Ensure a valid chart mode is always set before rendering
  if(!['bars','week','daily'].includes(state.chartMode)) state.chartMode='bars';
  ['bars','week','daily'].forEach(m=>{
    const btn=document.getElementById('cmt-'+m);
    if(btn)btn.classList.toggle('active',state.chartMode===m);
  });
  renderWeeklyChart(monthTxns);
  renderCatBars(monthTxns);
  renderDashWidgets(monthTxns, arsMonth, incTotalARS, margen, pct, daysLeft, compromisoTotal, projected);
  renderTop5();
  renderDb2Dashboard({
    arsMonth, usdMonth, margen, pct, incTotalARS, spendBudget,
    projected, totalGastoARS, daysLeft, dailyRate, projPeriodClose,
    timelineData, monthTxns, thirdPartyTxns,
    ccWidgetData:{
      cycleByKey:dashboardCardCycleByKey,
      totalsByKey:dashboardCardDisplayTotals,
      isMesMode:!isTcView,
      mesMonthKey:activeMk
    }
  });
}

function getWeeklyData(txns){
  txns=txns||state.transactions;
  const w={};txns.filter(t=>t.currency==='ARS').forEach(t=>{const k=t.week||getWeekKey(t.date);w[k]=(w[k]||0)+t.amount;});
  const s=Object.keys(w).sort();return{labels:s.map(k=>fmtWeekLabel(k)),values:s.map(k=>w[k]),keys:s};
}
function getCatData(txns,byGroup){
  txns=txns||state.transactions;
  const c={};
  txns.filter(t=>t.category&&t.category!=='Procesando...'&&t.category!=='Uncategorized').forEach(t=>{
    const amt=t.currency==='USD'?t.amount*USD_TO_ARS:t.amount;
    const key=byGroup?catGroup(t.category):t.category;
    c[key]=(c[key]||0)+amt;
  });
  const s=Object.entries(c).filter(e=>e[1]>0).sort((a,b)=>b[1]-a[1]);
  return{labels:s.map(e=>e[0]),values:s.map(e=>e[1])};
}

function setChartMode(mode){
  const validModes=['bars','week','daily'];
  state.chartMode=validModes.includes(mode)?mode:'bars';
  validModes.forEach(m=>{
    const btn=document.getElementById('cmt-'+m);
    if(btn)btn.classList.toggle('active',state.chartMode===m);
  });
  renderWeeklyChart(getCurrentMonthTxns());
}

function renderWeeklyChart(monthTxns){
  const mode=state.chartMode||'bars';
  if(state.charts.weekly)state.charts.weekly.destroy();
  const ctx=document.getElementById('chart-weekly');if(!ctx)return;
  const sub=document.getElementById('weekly-chart-sub');
  const titleEl=document.getElementById('dash-chart-title');
  const legEl=document.getElementById('weekly-chart-legend');

  const formatMonthLabel=(k)=>{
    const [y,m]=k.split('-');
    return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][+m-1]+' '+y.slice(2);
  };
  const formatWeekRange=(weekKey)=>{
    const start=new Date(weekKey+'T12:00:00');
    const end=new Date(start);
    end.setDate(end.getDate()+6);
    const startLabel=`${start.getDate()} ${start.toLocaleDateString('es-AR',{month:'short'}).replace('.','')}`;
    const endLabel=`${end.getDate()} ${end.toLocaleDateString('es-AR',{month:'short'}).replace('.','')}`;
    return `${startLabel} → ${endLabel}`;
  };

  if(mode==='bars'){
    // Monthly bars — all months
    const byMonth={};
    state.transactions.filter(t=>t.currency==='ARS').forEach(t=>{
      const k=t.month||getMonthKey(t.date);
      byMonth[k]=(byMonth[k]||0)+t.amount;
    });
    const sorted=Object.keys(byMonth).sort();
    const labels=sorted.map(formatMonthLabel);
    const values=sorted.map(k=>byMonth[k]);
    const avg=values.length?values.reduce((s,v)=>s+v,0)/values.length:0;
    const currentMonthKey=getMonthKey(new Date());
    const barColors=sorted.map(k=>k===currentMonthKey?'rgba(200,240,96,0.9)':'rgba(200,240,96,0.5)');

    if(titleEl)titleEl.textContent='Gasto mensual';
    if(sub)sub.textContent=sorted.length+' meses · promedio $'+fmtN(Math.round(avg))+'/mes';
    if(legEl)legEl.innerHTML='';

    state.charts.weekly=new Chart(ctx,{type:'bar',data:{labels,datasets:[
      {data:values,backgroundColor:barColors,borderColor:'rgba(200,240,96,0.3)',borderWidth:0,borderRadius:8,maxBarThickness:42,borderSkipped:false},
      {type:'line',data:values.map(()=>avg),borderColor:'rgba(160,154,148,0.5)',borderWidth:1.5,borderDash:[5,4],pointRadius:0,fill:false,order:0}
    ]},options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{..._chartTooltip(),callbacks:{label:c=>c.datasetIndex===1?' Promedio: $'+fmtN(Math.round(c.parsed.y)):' $'+fmtN(c.parsed.y)}}},
      scales:{x:{ticks:{color:_chartTickColor(),font:_chartTickFont()},grid:{display:false}},y:{ticks:{color:_chartTickColor(),font:_chartTickFont(),callback:v=>'$'+fmtN(v)},grid:_chartGridY()}}
    }});

  } else if(mode==='week'){
    const byWeek={};
    state.transactions.filter(t=>t.currency==='ARS').forEach(t=>{
      const k=t.week||getWeekKey(t.date);
      byWeek[k]=(byWeek[k]||0)+t.amount;
    });
    const sorted=Object.keys(byWeek).sort();
    const labels=sorted.map(formatWeekRange);
    const values=sorted.map(k=>byWeek[k]);
    const avg=values.length?values.reduce((s,v)=>s+v,0)/values.length:0;
    const currentWeekKey=getWeekKey(new Date());
    const barColors=sorted.map(k=>k===currentWeekKey?'rgba(79,140,255,0.88)':'rgba(79,140,255,0.42)');

    if(titleEl)titleEl.textContent='Gasto semanal';
    if(sub)sub.textContent=sorted.length+' semanas · promedio $'+fmtN(Math.round(avg))+'/semana';
    if(legEl)legEl.innerHTML='';

    state.charts.weekly=new Chart(ctx,{type:'bar',data:{labels,datasets:[
      {data:values,backgroundColor:barColors,borderColor:'rgba(79,140,255,0.28)',borderWidth:0,borderRadius:8,maxBarThickness:42,borderSkipped:false},
      {type:'line',data:values.map(()=>avg),borderColor:'rgba(160,154,148,0.5)',borderWidth:1.5,borderDash:[5,4],pointRadius:0,fill:false,order:0}
    ]},options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{..._chartTooltip(),callbacks:{label:c=>c.datasetIndex===1?' Promedio: $'+fmtN(Math.round(c.parsed.y)):' $'+fmtN(c.parsed.y)}}},
      scales:{x:{ticks:{color:_chartTickColor(),font:_chartTickFont(),maxRotation:0,minRotation:0},grid:{display:false}},y:{ticks:{color:_chartTickColor(),font:_chartTickFont(),callback:v=>'$'+fmtN(v)},grid:_chartGridY()}}
    }});

  } else if(mode==='daily'){
    // Daily spending for current month — scatter-like with trend
    const txns=(monthTxns||getCurrentMonthTxns()).filter(t=>t.currency==='ARS');
    const byDay={};
    txns.forEach(t=>{
      const d=dateToYMD(t.date);
      byDay[d]=(byDay[d]||0)+t.amount;
    });
    const sorted=Object.keys(byDay).sort();
    const labels=sorted.map(d=>{const dt=new Date(d+'T12:00:00');return dt.getDate()+'/'+(dt.getMonth()+1);});
    const values=sorted.map(d=>byDay[d]);
    const avg=values.length?values.reduce((s,v)=>s+v,0)/values.length:0;

    if(titleEl)titleEl.textContent='Gasto diario';
    if(sub)sub.textContent='Mes actual · promedio $'+fmtN(Math.round(avg))+'/día · '+sorted.length+' días';
    if(legEl)legEl.innerHTML='';

    state.charts.weekly=new Chart(ctx,{type:'bar',data:{labels,datasets:[
      {data:values,backgroundColor:values.map(v=>v>avg*1.5?'rgba(255,100,80,0.7)':v>avg?'rgba(255,200,80,0.6)':'rgba(200,240,96,0.6)'),borderWidth:0,borderRadius:8,maxBarThickness:42,borderSkipped:false},
      {type:'line',data:values.map(()=>avg),borderColor:'rgba(160,154,148,0.5)',borderWidth:1.5,borderDash:[5,4],pointRadius:0,fill:false,order:0}
    ]},options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{..._chartTooltip(),callbacks:{label:c=>c.datasetIndex===1?' Promedio: $'+fmtN(Math.round(c.parsed.y)):' $'+fmtN(c.parsed.y)}}},
      scales:{x:{ticks:{color:_chartTickColor(),font:_chartTickFont(),maxRotation:0},grid:{display:false}},y:{ticks:{color:_chartTickColor(),font:_chartTickFont(),callback:v=>'$'+fmtN(v)},grid:_chartGridY()}}
    }});
  }
}

if(!window._globalSearchShortcutBound){
  window._globalSearchShortcutBound=true;
  document.addEventListener('keydown',e=>{
    const tag=(document.activeElement?.tagName||'').toLowerCase();
    const typingField=['input','textarea','select'].includes(tag);
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){
      e.preventDefault();
      openGlobalSearch();
    } else if(!typingField&&e.key==='/'&&document.getElementById('page-dashboard')?.classList.contains('active')){
      e.preventDefault();
      openGlobalSearch();
    }
  });
}


function renderCatBars(monthTxns){
  const txns = monthTxns || getCurrentMonthTxns();
  // Group by parent category
  const grouped={};
  CATEGORY_GROUPS.forEach(g=>{grouped[g.group]={total:0,color:g.color,emoji:g.emoji};});
  txns.filter(t=>t.category&&t.category!=='Procesando...'&&t.category!=='Uncategorized').forEach(t=>{
    const amt=t.currency==='USD'?t.amount*USD_TO_ARS:t.amount;
    const parent=catGroup(t.category);
    if(!grouped[parent])grouped[parent]={total:0,color:'#888',emoji:''};
    grouped[parent].total+=amt;
  });
  const sorted=Object.entries(grouped).filter(([,d])=>d.total>0).sort((a,b)=>b[1].total-a[1].total);
  const total=sorted.reduce((s,[,d])=>s+d.total,0);
  const el=document.getElementById('cat-bars');if(!el)return;
  if(!sorted.length){
    el.innerHTML='<div style="color:var(--text3);font-size:12px;font-family:var(--font);padding:8px 0;">Sin gastos este mes</div>';
    return;
  }
  const maxVal=sorted[0][1].total;
  el.innerHTML=sorted.map(([name,d])=>{
    const pct=total>0?Math.round(d.total/total*100):0;
    const barW=maxVal>0?Math.max(Math.round(d.total/maxVal*100),2):0;
    return '<div style="display:flex;align-items:center;gap:10px;padding:5px 0;">'
      +'<span style="font-size:13px;width:20px;text-align:center;flex-shrink:0;">'+d.emoji+'</span>'
      +'<div style="flex:1;min-width:0;">'
        +'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">'
          +'<span style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+name+'</span>'
          +'<span style="font-size:11px;font-family:var(--font);color:var(--text3);flex-shrink:0;margin-left:8px;">$'+fmtN(d.total)+'<span style="opacity:.5;margin-left:3px;">'+pct+'%</span></span>'
        +'</div>'
        +'<div style="height:4px;background:var(--surface3);border-radius:3px;overflow:hidden;">'
          +'<div style="height:100%;width:'+barW+'%;background:'+d.color+';border-radius:3px;transition:width .5s ease;"></div>'
        +'</div>'
      +'</div>'
    +'</div>';
  }).join('');
}

function renderTop5(){
  const el=document.getElementById('top5-list');
  const sub=document.getElementById('top5-sub');
  if(!el)return;
  const mode=normalizeViewMode(state.dashView||'visa');
  const isTcView=mode!=='mes';
  let txns=[];
  if(isTcView){
    const cycles=getTcCycles(mode);
    const selId=state.dashTcCycle||'';
    const activeCycle=(selId&&cycles.find(c=>c.id===selId))||cycles[0]||null;
    txns=activeCycle?getTcCycleTxns(activeCycle,cycles):[];
  } else {
    txns=getCurrentMonthTxns();
  }
  txns=txns.filter(t=>t.currency==='ARS'&&!t.isPendingCuota).sort((a,b)=>b.amount-a.amount).slice(0,5);
  if(!txns.length){
    const cycleLabel=isTcView?getViewModeLabel(mode).toLowerCase():'este mes';
    el.innerHTML='<div style="color:var(--text3);font-size:12px;font-family:var(--font);padding:8px 0;">'+(isTcView?('Sin movimientos en '+cycleLabel):'Sin movimientos este mes')+'</div>';
    return;
  }
  if(sub)sub.textContent=txns.length+' movimientos más altos del '+(isTcView?getViewModeLabel(mode).toLowerCase():'mes');
  const medals=['🥇','🥈','🥉','4º','5º'];
  el.innerHTML=txns.map((t,i)=>{
    const c=catColor(t.category);
    return'<div class="top5-inline-item">'+
      '<div class="top5-inline-rank">'+medals[i]+'</div>'+
      '<div class="top5-inline-amount" style="color:var(--text);">$'+fmtN(t.amount)+'</div>'+
      '<div class="top5-inline-desc">'+esc(t.description)+'</div>'+
      '<div class="top5-inline-cat" style="color:'+c+';">'+catEmoji(t.category)+' '+t.category+'</div>'+
    '</div>';
  }).join('');
}

function renderDashWidgets(monthTxns, arsMonth, incTotalARS, margen, pct, daysLeft, compromisoTotal, projected){
  ensureDashboardCustomWidgets();
  const cleanTxns = (monthTxns || []).filter(t =>
    !t.isPendingCuota &&
    !t.isPendingSubscription &&
    !t.isThirdParty
  );
  const usdSpend = cleanTxns.filter(t => t.currency === 'USD').reduce((s,t)=>s + (t.amount||0), 0);
  const usdSpendArs = usdSpend * (USD_TO_ARS || 1420);
  const totalSpendArs = arsMonth + usdSpendArs;

  /* ── Widget 1: Margen disponible ── */
  const wMargenVal = document.getElementById('dw-margen-val');
  const wMargenSub = document.getElementById('dw-margen-sub');
  const wMargenBar = document.getElementById('dw-margen-bar');
  const wMargenFoot= document.getElementById('dw-margen-footer');
  if(incTotalARS > 0 && margen !== null){
    const dailyLeft = daysLeft > 0 ? Math.round(margen / daysLeft) : 0;
    const usedPct   = Math.min(100, Math.round((arsMonth / incTotalARS) * 100));
    const col       = usedPct >= 100 ? 'var(--danger)' : usedPct >= 80 ? 'var(--accent3)' : 'var(--accent)';
    animateNumberText(wMargenVal,margen,{prefix:'$',decimals:2,duration:760});
    wMargenVal.style.color   = margen <= 0 ? 'var(--danger)' : 'var(--text)';
    wMargenSub.textContent   = margen > 0 ? (daysLeft > 0 ? daysLeft + ' días restantes este mes' : 'Fin de mes') : 'Ingreso superado ⚠️';
    animateProgressBar(wMargenBar,usedPct);
    wMargenBar.style.background = col;
    wMargenFoot.textContent  = dailyLeft > 0 ? '$' + fmtN(dailyLeft) + '/día disponible · ' + usedPct + '% del ingreso usado' : usedPct + '% del ingreso usado';
  } else {
    wMargenVal.textContent  = '—';
    wMargenSub.textContent  = 'hasta fin de mes';
    wMargenBar.style.width  = '0%';
    wMargenFoot.textContent = 'Configurá tu ingreso en Ingresos para ver esto';
  }

  /* ── Widget 2: Categoría que más creció vs mes anterior ── */
  const wTrendVal   = document.getElementById('dw-trend-val');
  const wTrendSub   = document.getElementById('dw-trend-sub');
  const wTrendBadge = document.getElementById('dw-trend-badge');
  const wTrendAmt   = document.getElementById('dw-trend-amounts');
  const activeMk    = getActiveDashMonth();
  const [pY, pM]    = activeMk.split('-').map(Number);
  const prevMk      = getMonthKey(new Date(pY, pM - 2, 1));
  const prevTxns    = getTxnsFor(prevMk).filter(t =>
    t.currency === 'ARS' &&
    !t.isThirdParty &&
    !t.isPendingCuota &&
    !t.isPendingSubscription
  );
  if(prevTxns.length && cleanTxns.length){
    // build category totals for both months
    const sumCats = txns => {
      const c = {};
      txns.filter(t => t.currency === 'ARS').forEach(t => { c[t.category] = (c[t.category] || 0) + t.amount; });
      return c;
    };
    const curCats  = sumCats(cleanTxns);
    const prevCats = sumCats(prevTxns);
    // Find category with biggest absolute increase
    let biggest = null, biggestDiff = 0;
    Object.entries(curCats).forEach(([cat, cur]) => {
      const prev = prevCats[cat] || 0;
      const diff = cur - prev;
      if(diff > biggestDiff){ biggestDiff = diff; biggest = { cat, cur, prev, diff }; }
    });
    if(biggest){
      const pctDiff = biggest.prev > 0 ? Math.round((biggest.diff / biggest.prev) * 100) : null;
      const c = catColor(biggest.cat);
      wTrendVal.textContent       = biggest.cat;
      wTrendVal.style.color       = c;
      wTrendSub.textContent       = 'gastaste más que el mes pasado';
      wTrendBadge.className       = 'dw-badge up';
      wTrendBadge.textContent     = pctDiff !== null ? '+' + pctDiff + '%' : '+nuevo';
      wTrendAmt.textContent       = '$' + fmtN(biggest.prev) + ' → $' + fmtN(biggest.cur);
    } else {
      wTrendVal.textContent  = '✓ Sin alzas';
      wTrendVal.style.color  = 'var(--accent)';
      wTrendSub.textContent  = 'ninguna categoría creció vs el mes anterior';
      wTrendBadge.textContent= '';
      wTrendAmt.textContent  = '';
    }
  } else {
    wTrendVal.textContent  = '—';
    wTrendSub.textContent  = 'necesitás al menos 2 meses de datos';
    wTrendBadge.textContent= '';
    wTrendAmt.textContent  = '';
  }

  /* ── Widget 3: Meta de ahorro más cercana ── */
  const wGoalVal  = document.getElementById('dw-goal-val');
  const wGoalSub  = document.getElementById('dw-goal-sub');
  const wGoalBar  = document.getElementById('dw-goal-bar');
  const wGoalFoot = document.getElementById('dw-goal-footer');
  const goals     = (state.savGoals || []).filter(g => g.target > 0);
  const _dAccARS = (state.savAccounts||[]).filter(a=>a.currency==='ARS').reduce((s,a)=>s+a.balance,0);
  const _dAccUSD = (state.savAccounts||[]).filter(a=>a.currency==='USD').reduce((s,a)=>s+a.balance,0);
  const _dRate   = USD_TO_ARS || 1420;
  // Closest = highest completion percentage that's not yet 100%
  const active    = goals.filter(g => { const _gc = g.currency==='USD' ? _dAccUSD+(_dAccARS/_dRate) : _dAccARS+(_dAccUSD*_dRate); return _gc < g.target; })
                         .sort((a, b) => { const ca=a.currency==='USD'?_dAccUSD+(_dAccARS/_dRate):_dAccARS+(_dAccUSD*_dRate); const cb=b.currency==='USD'?_dAccUSD+(_dAccARS/_dRate):_dAccARS+(_dAccUSD*_dRate); return (cb/b.target)-(ca/a.target); });
  if(active.length){
    const g   = active[0];
    const _gCur = g.currency==='USD' ? _dAccUSD+(_dAccARS/_dRate) : _dAccARS+(_dAccUSD*_dRate);
    const pct = Math.round((_gCur / g.target) * 100);
    const rem = g.target - _gCur;
    const prefix = g.currency === 'USD' ? 'U$D ' : '$';
    const deps   = state.savDeposits || [];
    const depsARS = deps.filter(d => d.currency === 'ARS');
    const months  = [...new Set(depsARS.map(d => d.month))];
    const avgDep  = months.length ? Math.round(depsARS.reduce((s,d) => s + d.amount, 0) / months.length) : 0;
    const eta     = avgDep > 0 ? Math.ceil(rem / avgDep) : null;
    const c       = g.color || 'var(--accent3)';
    wGoalVal.textContent    = (g.emoji || '🎯') + ' ' + g.name;
    wGoalVal.style.color    = 'var(--text)';
    wGoalSub.textContent    = prefix + fmtN(Math.round(_gCur)) + ' de ' + prefix + fmtN(g.target) + ' · ' + pct + '%';
    animateProgressBar(wGoalBar,pct);
    wGoalBar.style.background = c;
    wGoalFoot.textContent   = eta ? eta + ' mes' + (eta !== 1 ? 'es' : '') + ' estimados al ritmo actual' : 'Registrá depósitos para estimar el tiempo';
  } else if(goals.length){
    wGoalVal.textContent  = '🎉 Todas completadas';
    wGoalVal.style.color  = 'var(--accent)';
    wGoalSub.textContent  = goals.length + ' meta' + (goals.length !== 1 ? 's' : '') + ' alcanzada' + (goals.length !== 1 ? 's' : '');
    animateProgressBar(wGoalBar,100);
    wGoalFoot.textContent = '¡Creá una nueva meta!';
  } else {
    wGoalVal.textContent  = '—';
    wGoalSub.textContent  = 'Sin metas configuradas';
    animateProgressBar(wGoalBar,0);
    wGoalFoot.textContent = 'Ir a Ahorros → Nueva meta →';
  }

  /* ── Widget gastos de terceros ── */
  const tpPendingEl=document.getElementById('kpi-third-party-pending');
  const tpSubEl=document.getElementById('kpi-third-party-sub');
  const tpBadgeEl=document.getElementById('kpi-third-party-badge');
  const tpTotalEl=document.getElementById('kpi-third-party-total');
  const tpCollectedEl=document.getElementById('kpi-third-party-collected');
  const tpOpenEl=document.getElementById('kpi-third-party-open');
  const tpFootEl=document.getElementById('kpi-third-party-foot');
  const tpBarEl=document.getElementById('kpi-third-party-bar');
  const historyWrap=document.querySelector('.dash-history-row[data-widget-key="history-kpis"]');
  const historyCard=historyWrap?historyWrap.querySelector('.dash-third-party-card'):null;
  const avgWidget=document.getElementById('dash-avg-widget');
  const _layoutState=typeof loadLayoutState==='function'?loadLayoutState():{};
  const _hiddenWidgets=_layoutState.dashboard?.widgetHidden||[];
  const thirdPartySummary=getThirdPartyDashboardSummary();
  const manuallyHidden=_hiddenWidgets.includes('history-kpis');
  const noTerceros=!thirdPartySummary.count;
  const shouldHideThirdPartyWidget=manuallyHidden||noTerceros;
  /* logic: no terceros → hide entire row (original behavior)
            manually hidden + has terceros → show fallback avg widget
            has terceros + not hidden → show terceros card */
  if(noTerceros&&!manuallyHidden){
    if(historyWrap){historyWrap.hidden=true;historyWrap.style.display='none';}
  } else {
    if(historyWrap){historyWrap.hidden=false;historyWrap.style.display='';}
    if(historyCard) historyCard.style.display=manuallyHidden?'none':'';
    if(avgWidget) avgWidget.style.display=manuallyHidden?'':'none';
  }
  if(tpPendingEl&&tpSubEl&&tpBadgeEl&&tpTotalEl&&tpCollectedEl&&tpOpenEl&&tpFootEl&&tpBarEl&&thirdPartySummary.count){
    historyWrap&&historyWrap.classList.remove('is-empty');
    historyCard&&historyCard.classList.remove('is-empty');
    const openCount=thirdPartySummary.pendingCount+thirdPartySummary.partialCount;
    const recoveredPct=thirdPartySummary.totalRecoverArs>0
      ?Math.round((thirdPartySummary.collectedArs/thirdPartySummary.totalRecoverArs)*100)
      :0;
    animateNumberText(tpPendingEl,thirdPartySummary.pendingArs,{prefix:'$',decimals:2,duration:760});
    tpSubEl.textContent=`${thirdPartySummary.count} registro${thirdPartySummary.count!==1?'s':''} · ${openCount} abierto${openCount!==1?'s':''} · ${thirdPartySummary.settledCount} cobrado${thirdPartySummary.settledCount!==1?'s':''}`;
    tpBadgeEl.textContent=openCount?`${openCount} por cobrar`:'Todo cobrado';
    tpBadgeEl.className=`dash-third-party-badge ${openCount?'pending':'settled'}`;
    tpTotalEl.textContent='$'+fmtN(Math.round(thirdPartySummary.totalRecoverArs));
    tpCollectedEl.textContent='$'+fmtN(Math.round(thirdPartySummary.collectedArs));
    tpOpenEl.textContent='$'+fmtN(Math.round(thirdPartySummary.pendingArs));
    tpFootEl.textContent=`${thirdPartySummary.pendingCount} pendiente${thirdPartySummary.pendingCount!==1?'s':''} · ${thirdPartySummary.partialCount} parcial${thirdPartySummary.partialCount!==1?'es':''} · ${thirdPartySummary.settledCount} cobrado${thirdPartySummary.settledCount!==1?'s':''}${thirdPartySummary.hasUsd?' · incluye equivalencia USD→ARS':''}`;
    animateProgressBar(tpBarEl,recoveredPct);
    tpBarEl.style.background=openCount?'#a882ff':'var(--green-sys)';
  } else {
    historyWrap&&historyWrap.classList.add('is-empty');
    historyCard&&historyCard.classList.add('is-empty');
    if(tpPendingEl)tpPendingEl.textContent='—';
    if(tpSubEl)tpSubEl.textContent='Sin gastos de terceros por ahora';
    if(tpBadgeEl){
      tpBadgeEl.textContent='todo limpio';
      tpBadgeEl.className='dash-third-party-badge';
    }
    if(tpTotalEl)tpTotalEl.textContent='—';
    if(tpCollectedEl)tpCollectedEl.textContent='—';
    if(tpOpenEl)tpOpenEl.textContent='—';
    if(tpFootEl)tpFootEl.textContent='Cuando marques uno, esta tarjeta se expande sola con el seguimiento completo.';
    if(tpBarEl)tpBarEl.style.width='0%';
  }
  /* populate fallback avg widget (only when manually hidden, not when no terceros) */
  if(manuallyHidden && avgWidget){
    const fbDaily=document.getElementById('kpi-fallback-daily');
    const fbTotal=document.getElementById('kpi-fallback-total');
    const fbProj=document.getElementById('kpi-fallback-projected');
    if(fbDaily) animateNumberText(fbDaily,dailyRate,{prefix:'$',decimals:0,duration:600});
    if(fbTotal) animateNumberText(fbTotal,totalGastoARS,{prefix:'$',decimals:0,duration:760});
    if(fbProj && projected){
      const projColor=typeof getProjectionColor==='function'?getProjectionColor(projected,incTotalARS):'var(--text3)';
      fbProj.innerHTML=`Proyección: <span style="color:${projColor};font-weight:600;">$${fmtN(Math.round(projected))}</span>`;
    } else if(fbProj){
      fbProj.textContent='';
    }
  }

  /* ── Widget extra: ingreso del período ── */
  const incomeVal=document.getElementById('dw-income-val');
  const incomeSub=document.getElementById('dw-income-sub');
  const incomeBadge=document.getElementById('dw-income-badge');
  const incomeMeta=document.getElementById('dw-income-meta');
  const incomeFooter=document.getElementById('dw-income-footer');
  if(incomeVal){
    if(incTotalARS > 0){
      animateNumberText(incomeVal,incTotalARS,{prefix:'$',decimals:2,duration:720});
      if(incomeSub)incomeSub.textContent='Ingreso consolidado del período activo';
      if(incomeBadge)incomeBadge.textContent = pct !== null ? `${Math.round(Math.min(999,pct))}% usado` : 'registrado';
      if(incomeMeta)incomeMeta.textContent = margen !== null ? `${margen >= 0 ? '$'+fmtN(margen) : '−$'+fmtN(Math.abs(margen))} de margen` : 'Sin margen calculado';
      if(incomeFooter)incomeFooter.textContent = 'Incluye ARS + USD convertidos al cambio operativo';
    } else {
      incomeVal.textContent='—';
      if(incomeSub)incomeSub.textContent='Todavía no cargaste ingresos';
      if(incomeBadge)incomeBadge.textContent='pendiente';
      if(incomeMeta)incomeMeta.textContent='';
      if(incomeFooter)incomeFooter.textContent='Registrá el ingreso en la pestaña de Ingresos';
    }
  }

  /* ── Widget extra: exposición USD ── */
  const usdVal=document.getElementById('dw-usd-val');
  const usdSub=document.getElementById('dw-usd-sub');
  const usdBar=document.getElementById('dw-usd-bar');
  const usdFooter=document.getElementById('dw-usd-footer');
  if(usdVal){
    if(totalSpendArs > 0 && usdSpend > 0){
      const exposurePct = Math.round((usdSpendArs / totalSpendArs) * 100);
      usdVal.textContent = `${exposurePct}%`;
      if(usdSub)usdSub.textContent = `U$D ${fmtN(usdSpend)} del período`;
      animateProgressBar(usdBar, exposurePct);
      if(usdFooter)usdFooter.textContent = `$${fmtN(Math.round(usdSpendArs))} equivalentes al cambio actual`;
    } else {
      usdVal.textContent = '0%';
      if(usdSub)usdSub.textContent = 'Sin gasto relevante en USD';
      if(usdBar)usdBar.style.width='0%';
      if(usdFooter)usdFooter.textContent = 'Si volvés a gastar en USD, lo vas a ver acá enseguida';
    }
  }

  /* ── Widget extra: gasto más alto ── */
  const largestVal=document.getElementById('dw-largest-val');
  const largestSub=document.getElementById('dw-largest-sub');
  const largestBadge=document.getElementById('dw-largest-badge');
  const largestMeta=document.getElementById('dw-largest-meta');
  const largestFooter=document.getElementById('dw-largest-footer');
  if(largestVal){
    const largestTxn = [...cleanTxns].sort((a,b)=>{
      const aArs=(a.currency==='USD'?(a.amount||0)*(USD_TO_ARS||1420):(a.amount||0));
      const bArs=(b.currency==='USD'?(b.amount||0)*(USD_TO_ARS||1420):(b.amount||0));
      return bArs-aArs;
    })[0];
    if(largestTxn){
      largestVal.textContent = largestTxn.description || largestTxn.comercio_detectado || 'Movimiento';
      if(largestSub)largestSub.textContent = `${largestTxn.currency==='USD'?'U$D ':'$'}${fmtN(largestTxn.amount || 0)} · ${fmtDate(largestTxn.date)}`;
      if(largestBadge)largestBadge.textContent = largestTxn.category || 'sin categoría';
      if(largestMeta)largestMeta.textContent = largestTxn.currency==='USD' ? `$${fmtN(Math.round((largestTxn.amount||0) * (USD_TO_ARS||1420)))} en ARS` : '';
      if(largestFooter)largestFooter.textContent = 'Tu ticket individual más pesado del período activo';
    } else {
      largestVal.textContent='—';
      if(largestSub)largestSub.textContent='Todavía no hay movimientos suficientes';
      if(largestBadge)largestBadge.textContent='sin datos';
      if(largestMeta)largestMeta.textContent='';
      if(largestFooter)largestFooter.textContent='Aparece cuando hay movimientos reales en el período';
    }
  }

  renderDashboardCustomWidgets({
    monthTxns,
    cleanTxns,
    arsMonth,
    incTotalARS,
    margen,
    pct,
    daysLeft,
    compromisoTotal,
    projected,
    usdSpend,
    usdSpendArs,
    totalSpendArs,
    thirdPartySummary
  });
  applyDashboardWidgetConfigs();
}

function ensureDashboardCustomWidgets(){
  const row=document.getElementById('dash-widgets-row');
  if(!row||typeof getDashboardCustomWidgets!=='function')return;
  const customWidgets=getDashboardCustomWidgets();
  const activeIds=new Set(customWidgets.map(w=>w.id));
  row.querySelectorAll('.dw-card.dw-custom.layout-widget').forEach(card=>{
    if(!activeIds.has(card.dataset.widgetKey))card.remove();
  });
  customWidgets.forEach(widget=>{
    let card=row.querySelector(`.dw-card.dw-custom.layout-widget[data-widget-key="${widget.id}"]`);
    if(!card){
      card=document.createElement('div');
      card.className='dw-card dw-custom layout-widget';
      card.dataset.widgetKey=widget.id;
      card.innerHTML=`
        <div class="dw-label">—</div>
        <div class="dw-value widget-value-tight" data-role="value">—</div>
        <div class="dw-sub" data-role="sub">—</div>
        <div class="widget-inline-row" data-role="inline">
          <span class="dw-badge neutral" data-role="badge"></span>
          <span class="widget-microcopy" data-role="meta"></span>
        </div>
        <div class="dw-bar-track" data-role="bar-track" hidden><div class="dw-bar-fill" data-role="bar"></div></div>
        <div class="dw-footer widget-footer-tight" data-role="footer">—</div>
      `;
      row.appendChild(card);
    }
  });
}

function getDashboardHistoryAverages(){
  const historyTxns=(state.transactions||[]).filter(t=>
    Number(t.amount)>0 &&
    !t.isPendingCuota &&
    !t.isPendingSubscription &&
    !t.isThirdParty &&
    t.estado_revision!=='duplicado_sospechoso'
  );
  if(!historyTxns.length)return{dailyAvg:0,monthlyAvg:0,daySpan:0,monthSpan:0};
  const totalHistoryARS=historyTxns.reduce((sum,t)=>sum+((t.currency==='USD'?t.amount*USD_TO_ARS:t.amount)||0),0);
  const dateKeys=[...new Set(historyTxns.map(t=>dateToYMD(t.date)).filter(Boolean))].sort();
  const monthKeys=[...new Set(historyTxns.map(t=>t.month||getMonthKey(t.date)).filter(Boolean))].sort();
  const firstDate=dateKeys.length?new Date(dateKeys[0]+'T12:00:00'):null;
  const lastDate=dateKeys.length?new Date(dateKeys[dateKeys.length-1]+'T12:00:00'):null;
  const daySpan=firstDate&&lastDate?Math.max(1,Math.round((lastDate-firstDate)/(1000*60*60*24))+1):Math.max(1,dateKeys.length);
  const monthSpan=Math.max(1,monthKeys.length);
  return{
    dailyAvg:totalHistoryARS/daySpan,
    monthlyAvg:totalHistoryARS/monthSpan,
    daySpan,
    monthSpan
  };
}

function getThirdPartyDashboardSummary(){
  const toArs=(amount,currency)=>((currency||'ARS')==='USD'?(Number(amount)||0)*(USD_TO_ARS||1420):(Number(amount)||0));
  const txns=(state.transactions||[]).filter(t=>
    !!t.isThirdParty &&
    Number(t.amount)>0 &&
    !t.isPendingCuota &&
    !t.isPendingSubscription
  );
  const summary={
    count:txns.length,
    pendingCount:0,
    partialCount:0,
    settledCount:0,
    totalRecoverArs:0,
    collectedArs:0,
    pendingArs:0,
    hasUsd:false
  };
  txns.forEach(t=>{
    const recoverBase=Number(t.thirdPartyAmount)||Number(t.amount)||0;
    const settledBase=Number(t.thirdPartySettledAmount)||0;
    const status=t.thirdPartyStatus||'pending';
    const recoveredAmount=status==='settled'
      ?(settledBase>0?Math.min(settledBase,recoverBase):recoverBase)
      :(status==='partial'?Math.min(settledBase,recoverBase):0);
    const pendingAmount=Math.max(0,recoverBase-recoveredAmount);
    summary.totalRecoverArs+=toArs(recoverBase,t.currency);
    summary.collectedArs+=toArs(recoveredAmount,t.currency);
    summary.pendingArs+=toArs(pendingAmount,t.currency);
    if((t.currency||'ARS')==='USD') summary.hasUsd=true;
    if(status==='settled') summary.settledCount++;
    else if(status==='partial') summary.partialCount++;
    else summary.pendingCount++;
  });
  return summary;
}

function openThirdPartyTransactions(){
  state.txnEstadoFilter='terceros';
  state._dupFilterOn=false;
  saveState();
  nav('transactions');
  if(typeof renderTransactions==='function') renderTransactions();
}

function renderDashboardCustomWidgets(context){
  const row=document.getElementById('dash-widgets-row');
  if(!row||typeof getDashboardCustomWidgets!=='function')return;
  const customWidgets=getDashboardCustomWidgets();
  const history=getDashboardHistoryAverages();
  const thirdPartySummary=context.thirdPartySummary||getThirdPartyDashboardSummary();
  customWidgets.forEach(widget=>{
    const card=row.querySelector(`.dw-card.dw-custom.layout-widget[data-widget-key="${widget.id}"]`);
    if(!card)return;
    const labelEl=card.querySelector('.dw-label');
    const valueEl=card.querySelector('[data-role="value"]');
    const subEl=card.querySelector('[data-role="sub"]');
    const inlineEl=card.querySelector('[data-role="inline"]');
    const badgeEl=card.querySelector('[data-role="badge"]');
    const metaEl=card.querySelector('[data-role="meta"]');
    const barTrack=card.querySelector('[data-role="bar-track"]');
    const barEl=card.querySelector('[data-role="bar"]');
    const footerEl=card.querySelector('[data-role="footer"]');
    if(labelEl)labelEl.textContent=`${widget.icon||'✨'} ${(widget.name||'Widget custom').toUpperCase()}`;
    if(barTrack)barTrack.hidden=true;
    if(inlineEl)inlineEl.hidden=false;
    if(badgeEl)badgeEl.textContent='';
    if(metaEl)metaEl.textContent='';

    const largestTxn=[...(context.cleanTxns||[])].sort((a,b)=>{
      const aArs=(a.currency==='USD'?(a.amount||0)*(USD_TO_ARS||1420):(a.amount||0));
      const bArs=(b.currency==='USD'?(b.amount||0)*(USD_TO_ARS||1420):(b.amount||0));
      return bArs-aArs;
    })[0];
    const exposurePct=context.totalSpendArs>0&&context.usdSpend>0?Math.round((context.usdSpendArs/context.totalSpendArs)*100):0;
    const commitmentsPct=context.incTotalARS>0?Math.min(100,Math.round(((context.compromisoTotal||0)/context.incTotalARS)*100)):0;

    switch(widget.metric){
      case 'margin_available':
        if(valueEl)valueEl.textContent=context.margen!==null?`${context.margen>=0?'$':'−$'}${fmtN(Math.round(Math.abs(context.margen||0)))}`:'—';
        if(subEl)subEl.textContent=context.margen!==null?`${context.daysLeft} días para cerrar el período`:'Sin ingreso configurado';
        if(badgeEl)badgeEl.textContent=context.pct!==null?`${Math.round(Math.min(999,context.pct))}% usado`:'pendiente';
        if(metaEl)metaEl.textContent=context.margen>0?'Todavía tenés margen':'Ya estás al límite';
        if(footerEl)footerEl.textContent='Lo que todavía podés gastar sin pasarte del objetivo';
        if(barTrack&&barEl){
          barTrack.hidden=false;
          animateProgressBar(barEl,Math.max(0,Math.min(100,Math.round(context.pct||0))));
        }
        break;
      case 'usd_exposure':
        if(valueEl)valueEl.textContent=`${exposurePct}%`;
        if(subEl)subEl.textContent=context.usdSpend>0?`U$D ${fmtN(context.usdSpend)} del período`:'Sin gasto relevante en USD';
        if(badgeEl)badgeEl.textContent=context.usdSpend>0?'sensibilidad FX':'estable';
        if(metaEl)metaEl.textContent=context.usdSpend>0?`$${fmtN(Math.round(context.usdSpendArs))} equivalentes en ARS`:'';
        if(footerEl)footerEl.textContent='Qué parte de tu gasto depende del dólar';
        if(barTrack&&barEl){
          barTrack.hidden=false;
          animateProgressBar(barEl,exposurePct);
        }
        break;
      case 'largest_expense':
        if(valueEl)valueEl.textContent=largestTxn?`${largestTxn.currency==='USD'?'U$D ':'$'}${fmtN(largestTxn.amount||0)}`:'—';
        if(subEl)subEl.textContent=largestTxn?(largestTxn.description||largestTxn.comercio_detectado||'Movimiento'):'Sin movimientos suficientes';
        if(badgeEl)badgeEl.textContent=largestTxn?.category||'sin datos';
        if(metaEl)metaEl.textContent=largestTxn?fmtDate(largestTxn.date):'';
        if(footerEl)footerEl.textContent='El ticket individual más alto del período';
        break;
      case 'avg_daily':
        if(valueEl)valueEl.textContent=history.daySpan?`$${fmtN(Math.round(history.dailyAvg))}`:'—';
        if(subEl)subEl.textContent=history.daySpan?`Promedio sobre ${history.daySpan} días`:'Necesitás más historial';
        if(badgeEl)badgeEl.textContent='histórico';
        if(metaEl)metaEl.textContent=history.monthSpan?`${history.monthSpan} meses cargados`:'';
        if(footerEl)footerEl.textContent='Tu ritmo diario promedio usando toda la historia';
        break;
      case 'avg_monthly':
        if(valueEl)valueEl.textContent=history.monthSpan?`$${fmtN(Math.round(history.monthlyAvg))}`:'—';
        if(subEl)subEl.textContent=history.monthSpan?`Promedio de ${history.monthSpan} ${history.monthSpan===1?'mes':'meses'}`:'Necesitás más historial';
        if(badgeEl)badgeEl.textContent='histórico';
        if(metaEl)metaEl.textContent=history.daySpan?`${history.daySpan} días registrados`:'';
        if(footerEl)footerEl.textContent='Tu gasto mensual promedio con toda la historia';
        break;
      case 'third_party_tracker': {
        const openCount=thirdPartySummary.pendingCount+thirdPartySummary.partialCount;
        if(valueEl)valueEl.textContent=thirdPartySummary.count?`$${fmtN(Math.round(thirdPartySummary.pendingArs))}`:'—';
        if(subEl)subEl.textContent=thirdPartySummary.count
          ?`${thirdPartySummary.count} registro${thirdPartySummary.count!==1?'s':''} · ${openCount} abierto${openCount!==1?'s':''}`
          :'No hay gastos de terceros';
        if(badgeEl)badgeEl.textContent=thirdPartySummary.count?`${thirdPartySummary.settledCount} cobrados`:'sin casos';
        if(metaEl)metaEl.textContent=thirdPartySummary.count?`$${fmtN(Math.round(thirdPartySummary.collectedArs))} recuperados`:'';
        if(footerEl)footerEl.textContent=thirdPartySummary.count
          ?`Total gestionado $${fmtN(Math.round(thirdPartySummary.totalRecoverArs))}${thirdPartySummary.hasUsd?' · incluye USD→ARS':''}`
          :'Marcá un movimiento como tercero para seguirlo acá';
        if(barTrack&&barEl){
          if(thirdPartySummary.count&&thirdPartySummary.totalRecoverArs>0){
            barTrack.hidden=false;
            animateProgressBar(barEl,Math.round((thirdPartySummary.collectedArs/thirdPartySummary.totalRecoverArs)*100));
          } else {
            barTrack.hidden=true;
          }
        }
        break;
      }
      case 'commitments_total':
        if(valueEl)valueEl.textContent=`$${fmtN(Math.round(context.compromisoTotal||0))}`;
        if(subEl)subEl.textContent='Compromisos del próximo mes';
        if(badgeEl)badgeEl.textContent=`${commitmentsPct}% del ingreso`;
        if(metaEl)metaEl.textContent=commitmentsPct>0?'peso financiero comprometido':'sin compromisos fuertes';
        if(footerEl)footerEl.textContent='Cuánto ya está tomado antes de arrancar el próximo período';
        if(barTrack&&barEl){
          barTrack.hidden=false;
          animateProgressBar(barEl,commitmentsPct);
        }
        break;
      case 'projected_close':
        if(valueEl)valueEl.textContent=context.projected?`$${fmtN(Math.round(context.projected))}`:'—';
        if(subEl)subEl.textContent='Cierre estimado al ritmo actual';
        if(badgeEl)badgeEl.textContent=`${context.daysLeft} días`;
        if(metaEl)metaEl.textContent=context.incTotalARS>0&&context.projected?`${Math.round((context.projected/context.incTotalARS)*100)}% del ingreso`:'';
        if(footerEl)footerEl.textContent='Proyección automática del período activo';
        break;
      case 'income_total':
      default:
        if(valueEl)valueEl.textContent=context.incTotalARS>0?`$${fmtN(Math.round(context.incTotalARS))}`:'—';
        if(subEl)subEl.textContent=context.incTotalARS>0?'Ingreso consolidado del período':'Todavía no cargaste ingresos';
        if(badgeEl)badgeEl.textContent=context.pct!==null?`${Math.round(Math.min(999,context.pct))}% usado`:'pendiente';
        if(metaEl)metaEl.textContent=context.margen!==null?`${context.margen>=0?'$'+fmtN(Math.round(context.margen)):'−$'+fmtN(Math.round(Math.abs(context.margen)))} de margen`:'';
        if(footerEl)footerEl.textContent='Incluye ARS + USD convertidos al cambio operativo';
        break;
    }
    if(inlineEl)inlineEl.hidden=!((badgeEl&&badgeEl.textContent)||(metaEl&&metaEl.textContent));
  });
}

function applyDashboardWidgetConfigs(){
  if(typeof getDashboardWidgetConfigs!=='function')return;
  const configs=getDashboardWidgetConfigs()||{};
  const metaMap=typeof getDashboardWidgetMetaMap==='function'?getDashboardWidgetMetaMap():{};
  const customWidgets=typeof getDashboardCustomWidgets==='function'?getDashboardCustomWidgets():[];
  const layoutState=typeof loadLayoutState==='function'?loadLayoutState():{};
  const widgetSizes=layoutState.dashboard?.widgetSizes||{};
  document.querySelectorAll('#dash-content .layout-widget[data-widget-key]').forEach(widget=>{
    const key=widget.dataset.widgetKey;
    const config=configs[key]||{};
    const custom=customWidgets.find(w=>w.id===key)||null;
    const variant=custom?.variant||config.variant||'default';
    const size=widgetSizes[key]||'regular';
    widget.classList.remove('widget-variant-default','widget-variant-minimal','widget-variant-accent','widget-variant-premium','widget-size-compact','widget-size-regular','widget-size-wide');
    widget.classList.add(`widget-variant-${variant}`);
    widget.classList.add(`widget-size-${size}`);
    const selector=metaMap[key]?.titleSelector;
    const titleEl=selector?widget.querySelector(selector):widget.querySelector('.dw-label,.chart-card-title,.dkpi-label');
    if(titleEl){
      if(!titleEl.dataset.baseTitle)titleEl.dataset.baseTitle=titleEl.textContent.trim();
      const label=custom?.name||config.labelOverride||metaMap[key]?.label||titleEl.dataset.baseTitle;
      const icon=custom?.icon||config.icon||'';
      titleEl.textContent=(key==='usd-card' && icon)?`${icon} ${label}`:`${icon?`${icon} `:''}${label}`;
    }
  });
}

// Stubs para IDs que ya no existen pero podrian ser llamados desde otro lado
function renderDonutChart(){}
function renderProjection(){}
function renderDowHeatmap(){}

function getDashCycleTotal() {
  const allCyc = typeof getTcCycles === 'function' ? getTcCycles() : state.tcCycles;
  if(state.dashView === 'tc' && state.dashTcCycle) {
    const cyc = allCyc.find(c => c.id === state.dashTcCycle);
    if(cyc) {
       const txns = typeof getTcCycleTxns === 'function' ? getTcCycleTxns(cyc, allCyc) : [];
       return txns.filter(t => t.currency === 'ARS' && t.amount > 0).reduce((s,t) => s + t.amount, 0);
    }
  }
  // Fallback to current month if not in TC view
  const mk = state.dashMonth || getMonthKey(new Date());
  return state.transactions
    .filter(t => (t.month === mk || getMonthKey(t.date) === mk) && t.currency === 'ARS' && t.amount > 0 && !t.isPendingCuota)
    .reduce((s,t) => s + t.amount, 0);
}

function getDashMonthIncome() {
  const mk = state.dashMonth || getMonthKey(new Date());
  const monthData = state.incomeMonths.find(m => m.month === mk);
  if(monthData) {
    let total = 0;
    Object.values(monthData.sources).forEach(v => total += v);
    if(monthData.extraArs) total += monthData.extraArs;
    return total;
  }
  return state.income.ars || 0;
}

/* ═══════════════════════════════════════════════════════════
   DB2 DASHBOARD — new widget renderers
═══════════════════════════════════════════════════════════ */

// ── Evolution chart state ──
let db2EvoMode = 'daily'; // 'daily' | 'accum'
function setDb2EvoMode(mode){
  db2EvoMode = mode;
  const d = document.getElementById('db2-evo-daily-btn');
  const a = document.getElementById('db2-evo-accum-btn');
  if(d) d.classList.toggle('active', mode==='daily');
  if(a) a.classList.toggle('active', mode==='accum');
  renderDb2EvolutionChart();
}

// ── CC Cycle widget ──
function renderDb2CcCycles(data){
  const today = new Date();
  const todayYmd = dateToYMD(today);
  const cards = state.ccCards || [];
  const allCycles = typeof getTcCycles === 'function' ? getTcCycles() : [];
  const cycleByKey = data?.cycleByKey || {};
  const totalsByKey = data?.totalsByKey || {};
  const isMesMode = !!data?.isMesMode;
  const mesMonthKey = data?.mesMonthKey || getMonthKey(today);

  const fmt = ymd => {
    if(!ymd) return '—';
    try {
      const d = new Date(ymd + 'T12:00:00');
      return d.toLocaleDateString('es-AR',{day:'2-digit',month:'short'}).replace('.','').toUpperCase();
    } catch(e){ return ymd; }
  };

  // Determine which cards to show (visa + amex by payMethodKey)
  const cardKeys = ['visa','amex'];
  cardKeys.forEach(key => {
    const card = cards.find(c => (c.payMethodKey||'').toLowerCase() === key) || cards.find(c => (c.name||'').toLowerCase().includes(key));
    const prefix = key; // visa / amex

    const openEl   = document.getElementById(`db2-${prefix}-open`);
    const closeEl  = document.getElementById(`db2-${prefix}-close`);
    const dueEl    = document.getElementById(`db2-${prefix}-due`);
    const barEl    = document.getElementById(`db2-${prefix}-bar`);
    const daysEl   = document.getElementById(`db2-${prefix}-days`);
    const itemEl   = document.getElementById(`db2-cc-${prefix}-item`);

    if(!card){ if(itemEl) itemEl.style.opacity='0.4'; return; }
    if(itemEl) itemEl.style.opacity='1';

    // Prefer dashboard-scoped cycle (keeps widget aligned with selected period),
    // then fallback to active/first card cycle.
    const cardCycles = allCycles.filter(c => c.cardId === card.id);
    let activeCycle = cycleByKey[prefix] || cardCycles.find(c => {
      const idx = allCycles.findIndex(x => x.id === c.id);
      const open = getTcCycleOpen(allCycles, idx);
      return open && todayYmd >= open && todayYmd <= c.closeDate;
    }) || cardCycles[0];

    if(!activeCycle && allCycles.length){
      // fallback: try any cycle matching close day
      activeCycle = allCycles[0];
    }

    if(isMesMode){
      // Vista Mes: show calendar month period
      const [mY, mM] = mesMonthKey.split('-').map(Number);
      const monthFirstYmd = `${mesMonthKey}-01`;
      const monthLastD = new Date(mY, mM, 0);
      const monthLastYmd = dateToYMD(monthLastD);

      if(openEl) openEl.textContent = fmt(monthFirstYmd);
      if(closeEl) closeEl.textContent = fmt(monthLastYmd);
      if(dueEl) dueEl.textContent = '—';

      const scopedTotals = totalsByKey[prefix] || totalsByKey[card.payMethodKey||card.id] || null;
      const amtArsEl = document.getElementById(`kpi-${prefix}-ars`);
      const amtUsdEl = document.getElementById(`kpi-${prefix}-usd`);
      if(amtArsEl){
        const arsTotal = scopedTotals ? (scopedTotals.ars||0) : 0;
        const usdTotal = scopedTotals ? (scopedTotals.usd||0) : 0;
        if(isMasked()) amtArsEl.textContent = '••••••••';
        else animateNumberText(amtArsEl, arsTotal, {prefix: '$', decimals: 2, duration: 760});
        
        if(amtUsdEl){
          if(usdTotal > 0){
            if(isMasked()) amtUsdEl.textContent = '••••';
            else animateNumberText(amtUsdEl, usdTotal, {prefix: 'USD ', decimals: 2, duration: 760});
            amtUsdEl.style.display = '';
          } else {
            amtUsdEl.textContent = '';
          }
        }
      }

      // Month progress bar
      if(barEl && daysEl){
        const openD  = new Date(monthFirstYmd + 'T12:00:00');
        const closeD = new Date(monthLastYmd  + 'T12:00:00');
        const totalDays = Math.max(1, Math.round((closeD - openD) / 86400000));
        const elapsed   = Math.max(0, Math.round((today - openD) / 86400000));
        const daysLeft  = Math.max(0, Math.round((closeD - today) / 86400000));
        const pct = Math.min(100, Math.round(elapsed / totalDays * 100));
        animateProgressBar(barEl, pct);
        daysEl.textContent = daysLeft === 0 ? 'Fin de mes' : `Cierran en ${daysLeft} día${daysLeft!==1?'s':''}`;
      }
      return;
    }

    if(!activeCycle){
      if(openEl) openEl.textContent = '—';
      if(closeEl) closeEl.textContent = '—';
      if(dueEl)   dueEl.textContent = '—';
      if(daysEl)  daysEl.textContent = 'Sin ciclo activo';
      return;
    }

    const cycleIdx = allCycles.findIndex(c => c.id === activeCycle.id);
    const openYmd = typeof getTcCycleOpen === 'function' ? getTcCycleOpen(allCycles, cycleIdx) : null;
    const closeYmd = activeCycle.closeDate;
    const dueYmd = activeCycle.dueDate || null;

    if(openEl) openEl.textContent = fmt(openYmd);
    if(closeEl) closeEl.textContent = fmt(closeYmd);
    if(dueEl) dueEl.textContent = fmt(dueYmd);

    // Cycle spending amounts
    const amtArsEl = document.getElementById(`kpi-${prefix}-ars`);
    const amtUsdEl = document.getElementById(`kpi-${prefix}-usd`);
    if(amtArsEl){
      const scopedTotals = totalsByKey[prefix] || totalsByKey[card.payMethodKey||card.id] || null;
      const cycleTxns = !scopedTotals && typeof getTcCycleTxns === 'function' ? getTcCycleTxns(activeCycle, allCycles) : [];
      const arsTotal = scopedTotals ? (scopedTotals.ars||0) : cycleTxns.filter(t => t.currency === 'ARS' && t.amount > 0).reduce((s,t) => s + t.amount, 0);
      const usdTotal = scopedTotals ? (scopedTotals.usd||0) : cycleTxns.filter(t => t.currency === 'USD' && t.amount > 0).reduce((s,t) => s + t.amount, 0);
      if(isMasked()){
        amtArsEl.textContent = '••••••••';
        if(amtUsdEl) amtUsdEl.textContent = (usdTotal > 0 ? '••••' : '');
      } else {
        animateNumberText(amtArsEl, arsTotal, {prefix: '$', decimals: 2, duration: 760});
        if(amtUsdEl){
          if(usdTotal > 0){
            animateNumberText(amtUsdEl, usdTotal, {prefix: 'USD ', decimals: 2, duration: 760});
            amtUsdEl.style.display = '';
          } else {
            amtUsdEl.textContent = '';
          }
        }
      }
    }

    // Days until close
    if(barEl && daysEl && closeYmd && openYmd){
      const closeD = new Date(closeYmd + 'T12:00:00');
      const openD  = new Date(openYmd  + 'T12:00:00');
      const totalDays = Math.max(1, Math.round((closeD - openD) / 86400000));
      const elapsed   = Math.max(0, Math.round((today - openD) / 86400000));
      const daysLeft  = Math.max(0, Math.round((closeD - today) / 86400000));
      const pct = Math.min(100, Math.round(elapsed / totalDays * 100));
      animateProgressBar(barEl, pct);
      daysEl.textContent = daysLeft === 0 ? 'Cierra hoy' : `Cierran en ${daysLeft} día${daysLeft!==1?'s':''}`;
    }
  });
}

function isBusinessDay(date){
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function getSecondBusinessDay(year, month){
  let count = 0;
  for(let day = 1; day <= 31; day += 1){
    const date = new Date(year, month, day);
    if(date.getMonth() !== month) break;
    if(isBusinessDay(date)) count += 1;
    if(count === 2) return date;
  }
  return null;
}

function getNextConfiguredIncomePayment(salaryLimit){
  if(!(salaryLimit > 0)) return null;
  const today = new Date();
  today.setHours(0,0,0,0);

  let next = getSecondBusinessDay(today.getFullYear(), today.getMonth());
  if(!next || next < today){
    next = getSecondBusinessDay(today.getFullYear(), today.getMonth() + 1);
  }
  if(!next) return null;
  next.setHours(0,0,0,0);
  return {
    date: next,
    days: Math.max(0, Math.round((next - today) / 86400000))
  };
}

// ── Projection widget extras ──
function renderDb2ProjExtras(projected, totalGastoARS, incTotalARS, spendBudget, daysLeft, dailyRate, projPeriodClose){
  const remainingEl = document.getElementById('db2-proj-remaining');
  const closeDateEl = document.getElementById('db2-proj-closedate');
  const nextIncomeEl = document.getElementById('db2-proj-next-income');
  const nextIncomeSubEl = document.getElementById('db2-proj-next-income-sub');
  const pctEl = document.getElementById('db2-proj-pct');
  const pctLimitEl = document.getElementById('db2-proj-pct-limit');
  const pctRingEl = document.getElementById('db2-proj-pct-ring');
  const r1El = document.getElementById('db2-proj-r1');
  const r2El = document.getElementById('db2-proj-r2');
  const l2El = document.getElementById('db2-proj-l2');
  const r3El = document.getElementById('db2-proj-r3');
  const barEl = document.getElementById('db2-proj-bar');
  const barAccumEl = document.getElementById('db2-proj-bar-accum');
  const limitMarkerEl = document.getElementById('db2-proj-limit-marker');
  void spendBudget;
  const salaryLimit = incTotalARS || 0;

  if(remainingEl){
    if(salaryLimit > 0){
      const rem = salaryLimit - totalGastoARS;
      if(isMasked()) remainingEl.textContent = '••••••••';
      else remainingEl.textContent = (rem >= 0 ? '$' : '-$') + fmtN(Math.abs(Math.round(rem)));
      remainingEl.style.color = rem < 0 ? '#F3382E' : '#070B1D';
    } else {
      remainingEl.textContent = '—';
      remainingEl.style.color = '#070B1D';
    }
  }

  if(closeDateEl){
    if(projPeriodClose instanceof Date){
      closeDateEl.textContent = projPeriodClose.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
    } else if(!projPeriodClose){
      const today = new Date();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
      const closeDate = new Date(today.getFullYear(), today.getMonth(), daysInMonth);
      closeDateEl.textContent = closeDate.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
    } else closeDateEl.textContent = '—';
  }

  if(r1El){
    if(isMasked()) r1El.textContent = '••••••••';
    else r1El.textContent = Number.isFinite(projected) ? '$' + fmtN(Math.round(projected || 0)) : '—';
  }
  if(r2El){
    if(l2El) l2El.textContent = 'Gasto acumulado';
    if(isMasked()) r2El.textContent = '••••••••';
    else r2El.textContent = Number.isFinite(totalGastoARS) ? '$' + fmtN(Math.round(totalGastoARS || 0)) : '—';
  }
  if(r3El){
    if(isMasked()) r3El.textContent = '••••••••';
    else r3El.textContent = salaryLimit > 0 ? '$' + fmtN(Math.round(salaryLimit)) : '—';
  }

  if(pctEl && pctLimitEl && pctRingEl){
    if(salaryLimit > 0){
      const pct = Math.max(0, Math.round((totalGastoARS || 0) / salaryLimit * 100));
      pctEl.textContent = pct + '%';
      pctLimitEl.textContent = 'de $' + fmtN(Math.round(salaryLimit), 0);
      pctRingEl.style.setProperty('--db2-proj-pct', Math.min(360, pct * 3.6) + 'deg');
      pctRingEl.classList.toggle('over', pct >= 100);
    } else {
      pctEl.textContent = '—';
      pctLimitEl.textContent = 'Sin datos';
      pctRingEl.style.setProperty('--db2-proj-pct', '0deg');
      pctRingEl.classList.remove('over');
    }
  }

  if(nextIncomeEl){
    const nextIncome = getNextConfiguredIncomePayment(salaryLimit);
    if(nextIncome){
      nextIncomeEl.textContent = nextIncome.date.toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'}).replace('.', '');
      if(nextIncomeSubEl){
        nextIncomeSubEl.textContent = nextIncome.days === 0 ? 'hoy' : `en ${nextIncome.days} día${nextIncome.days !== 1 ? 's' : ''}`;
      }
    } else {
      nextIncomeEl.textContent = '—';
      if(nextIncomeSubEl) nextIncomeSubEl.textContent = 'Sin datos';
    }
  }

  if(barEl && barAccumEl){
    const maxRef = Math.max(totalGastoARS || 0, projected || 0, salaryLimit || 0);
    if(maxRef > 0){
      const accumPct = Math.min(100, Math.max(0, (totalGastoARS || 0) / maxRef * 100));
      const projectedPct = Math.min(100, Math.max(accumPct, (projected || 0) / maxRef * 100));
      barAccumEl.style.width = accumPct + '%';
      barEl.style.left = accumPct + '%';
      barEl.style.width = Math.max(0, projectedPct - accumPct) + '%';
      barEl.classList.toggle('over', salaryLimit > 0 && projected > salaryLimit);
      if(limitMarkerEl){
        if(salaryLimit > 0){
          limitMarkerEl.style.display = '';
          limitMarkerEl.style.left = Math.min(100, Math.max(0, salaryLimit / maxRef * 100)) + '%';
        } else {
          limitMarkerEl.style.display = 'none';
        }
      }
    } else {
      barAccumEl.style.width = '0%';
      barEl.style.left = '0%';
      barEl.style.width = '0%';
      barEl.classList.remove('over');
      if(limitMarkerEl) limitMarkerEl.style.display = 'none';
    }
  }
}

// ── Hero sub-cards ──
function renderDb2HeroExtras(arsMonth, usdMonth, margen, pct, incTotalARS, spendBudget, thirdPartyTxns=[]){
  const heroMasked = state.hideHero || state.globalHide;

  // ARS card
  const arsEl = document.getElementById('db2-ars-val');
  if(arsEl) {
    if(heroMasked) arsEl.textContent = '••••••••';
    else animateNumberText(arsEl, arsMonth, {prefix:'$', decimals:2, duration:760});
  }

  // USD card
  const usdEl = document.getElementById('db2-usd-val');
  if(usdEl){
    if(usdMonth > 0) {
      if(heroMasked) usdEl.textContent = '••••';
      else animateNumberText(usdEl, usdMonth, {prefix:'U$D ', decimals:2, duration:760});
    }
    else usdEl.textContent = '—';
  }

  // USD sub-line below main amount
  const usdLine = document.getElementById('dhc-usd-line');
  if(usdLine){
    if(usdMonth > 0) {
      if(heroMasked) usdLine.textContent = 'USD ••••';
      else animateNumberText(usdLine, usdMonth, {prefix:'USD ', decimals:2, duration:760});
    }
    else usdLine.textContent = '';
  }

  // Margen card
  const margenEl  = document.getElementById('db2-margen-val');
  const margenPct = document.getElementById('db2-margen-pct');
  const margenTitle = document.querySelector('.db2-hero-sub-margen .db2-hero-sub-title');

  if(margenEl){
    if(margen !== null && incTotalARS > 0){
      const isOver = margen < 0;
      if(heroMasked) {
        margenEl.textContent = '••••••••';
      } else {
        animateNumberText(margenEl, Math.abs(Math.round(margen)), {
          formatter: n => (isOver ? '-$' : '$') + fmtN(n)
        });
      }
      margenEl.style.color = isOver ? '#ff453a' : '#32d74b'; // Bright premium colors
      
      if(margenTitle) {
        margenTitle.textContent = isOver ? 'EXCESO DE GASTO' : 'MARGEN DISPONIBLE';
        margenTitle.style.color = isOver ? 'rgba(255,255,255,0.9)' : '';
      }

      if(margenPct){
        const remPct = spendBudget > 0 ? Math.max(0, Math.round(margen / spendBudget * 100)) : 0;
        margenPct.textContent = isOver ? 'Excediste tu presupuesto' : Math.round(remPct) + '% del presupuesto';
        margenPct.style.display = '';
        margenPct.style.background = isOver ? 'rgba(255,69,58,0.2)' : '';
        margenPct.style.color = isOver ? '#ff9f0a' : '';
      }
    } else {
      margenEl.textContent = incTotalARS > 0 ? '—' : 'Sin ingreso';
      margenEl.style.color = 'rgba(255,255,255,0.6)';
      if(margenPct) margenPct.style.display = 'none';
      if(margenTitle) margenTitle.textContent = 'MARGEN DISPONIBLE';
    }
  }

  // % badge
  const pctBadge = document.getElementById('dhc-pct-inline');
  if(pctBadge){
    if(pct !== null){
      pctBadge.textContent = pct + '% del presupuesto';
      pctBadge.style.display = '';
    } else {
      pctBadge.style.display = 'none';
    }
  }

  // Dynamic Third Party Note
  const tpNote = document.getElementById('dhc-third-party-note');
  if(tpNote){
    const toArs = (amount, currency) => ((currency || 'ARS') === 'USD'
      ? (Number(amount) || 0) * (USD_TO_ARS || 0)
      : (Number(amount) || 0));
    const tpItems = (thirdPartyTxns || []).filter(t => !!t && !!t.isThirdParty);
    const pendingSum = tpItems.reduce((s,t) => {
       const base = Number(t.thirdPartyAmount) || Number(t.amount) || 0;
       const status = t.thirdPartyStatus || 'pending';
       const settled = status === 'partial' ? Math.min(base, Number(t.thirdPartySettledAmount) || 0) : 0;
       return status === 'settled' ? s : s + toArs(Math.max(0, base - settled), t.currency);
    }, 0);
    const recoveredSum = tpItems.reduce((s,t) => {
      if((t.thirdPartyStatus || 'pending') !== 'settled') return s;
      const base = Number(t.thirdPartyAmount) || Number(t.amount) || 0;
      const settled = Number(t.thirdPartySettledAmount) || base;
      return s + toArs(Math.min(base, settled), t.currency);
    }, 0);

    if(pendingSum > 0 || recoveredSum > 0){
      tpNote.style.display = 'block';
      let html = '';
      if(heroMasked) {
        html = '<span style="color:var(--accent);font-weight:700;">+ $••••••</span> de terceros';
      } else {
        if(pendingSum > 0 && recoveredSum > 0) {
          html = `<span style="color:#32d74b;font-weight:800;">+$${fmtN(Math.round(recoveredSum))} recuperados</span> · <span style="color:#ff9f0a;font-weight:800;">$${fmtN(Math.round(pendingSum))} a recuperar</span>`;
        } else if(pendingSum > 0) {
          html = `<span style="color:#ff9f0a;font-weight:800;">$${fmtN(Math.round(pendingSum))}</span> a recuperar de terceros`;
        } else {
          html = `<span style="color:#32d74b;font-weight:800;">+$${fmtN(Math.round(recoveredSum))}</span> recuperado totalmente`;
        }
      }
      tpNote.innerHTML = html;
    } else {
      tpNote.style.display = 'none';
    }
  }

  // Update Eye Icons based on state
  const heroEye = document.getElementById('db2-hero-privacy-btn');
  if(heroEye) heroEye.classList.toggle('is-hidden', state.hideHero);
  
  const globalEye = document.getElementById('db2-global-privacy-btn');
  const globalLabel = document.getElementById('db2-global-privacy-label');
  if(globalEye) globalEye.classList.toggle('active', state.globalHide);
  if(globalLabel) globalLabel.textContent = state.globalHide ? 'Montos ocultos' : 'Ocultar montos';
}

function isMasked() {
  return !!state.globalHide;
}

function enforceDashboardPrivacyMask(){
  if(!isMasked()) return;
  [
    'kpi-ars',
    'dhc-ars-line',
    'dhc-usd-line',
    'kpi-ars-d',
    'kpi-total-ars',
    'kpi-total-usd',
    'kpi-inc-total',
    'dhc-bal-income',
    'dhc-bal-gasto',
    'dhc-bal-result',
    'dhc-margin-val',
    'dhc-margin-sub',
    'dhc-margin-ingreso',
    'dhc-margen',
    'kpi-usd',
    'kpi-visa-ars',
    'kpi-visa-usd',
    'kpi-amex-ars',
    'kpi-amex-usd',
    'kpi-tc',
    'kpi-proj',
    'kpi-proj-daily',
    'db2-proj-r1',
    'db2-proj-r2',
    'db2-proj-r3',
    'db2-proj-remaining',
    'db2-proj-pct-limit',
    'db2-ars-val',
    'db2-usd-val',
    'db2-margen-val',
    'db2-evo-ingresos',
    'db2-evo-gastos',
    'db2-cat-total',
    'usd-rate-buy-display',
    'usd-rate-sell-display'
  ].forEach(id=>{
    const el=document.getElementById(id);
    if(el){
      if(typeof cancelNumberTextAnimation==='function') cancelNumberTextAnimation(el);
      el.textContent='••••••••';
    }
  });
  const thirdPartyNote=document.getElementById('dhc-third-party-note');
  if(thirdPartyNote && thirdPartyNote.style.display!=='none'){
    thirdPartyNote.innerHTML='<span style="color:var(--accent);font-weight:700;">+ $••••••</span> de terceros';
  }
}

function toggleHeroPrivacy() {
  state.hideHero = !state.hideHero;
  saveState();
  renderDashboard();
}

function toggleGlobalPrivacy() {
  state.globalHide = !state.globalHide;
  saveState();
  renderDashboard();
  updateUsdRateUI();
}

// ── Evolution line chart ──
function renderDb2EvolutionChart(){
  const ctx = document.getElementById('chart-evolution');
  if(!ctx) return;

  if(state.charts && state.charts.evolution){ state.charts.evolution.destroy(); state.charts.evolution = null; }

  const isLight = _isL();
  const mk = getActiveDashMonth();
  const [y, m] = mk.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const isCurrentMonth = mk === getMonthKey(new Date());

  // Build daily income and expense arrays
  const monthTxns = getCurrentMonthTxns().filter(t => !t.isPendingCuota && !t.isPendingSubscription);
  const byDay = {};
  for(let d = 1; d <= daysInMonth; d++) byDay[d] = {gastos: 0};
  monthTxns.forEach(t => {
    const dt = new Date(String(t.date).includes('T') ? t.date : t.date + 'T12:00:00');
    if(dt.getMonth()+1 !== m || dt.getFullYear() !== y) return;
    const day = dt.getDate();
    const amt = t.currency === 'USD' ? t.amount * (USD_TO_ARS||1420) : t.amount;
    byDay[day].gastos += amt;
  });

  // Daily income (spread evenly or from income sources)
  const incSnap = getIncomeSnapshot(mk);
  const dailyIncome = incSnap.total > 0 ? incSnap.total / daysInMonth : 0;

  // Build label list (only days up to today if current month)
  const today = new Date();
  const maxDay = isCurrentMonth ? Math.min(today.getDate(), daysInMonth) : daysInMonth;
  const labels = [];
  const gastosDailyData = [];
  const ingresosDailyData = [];
  const gastosAccumData = [];
  const ingresosAccumData = [];
  let accumGastos = 0, accumIngresos = 0;

  for(let d = 1; d <= maxDay; d++){
    const dayLabel = d + ' ' + ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][m-1];
    if(d === 1 || d % 3 === 0 || d === maxDay) labels.push(dayLabel);
    else labels.push('');

    const g = byDay[d]?.gastos || 0;
    const inc = dailyIncome;
    accumGastos += g;
    accumIngresos += inc;
    gastosDailyData.push(g);
    ingresosDailyData.push(inc);
    gastosAccumData.push(accumGastos);
    ingresosAccumData.push(accumIngresos);
  }

  // Update legend totals
  const evoIng = document.getElementById('db2-evo-ingresos');
  const evoGas = document.getElementById('db2-evo-gastos');
  const totalGastos = gastosAccumData[gastosAccumData.length-1] || 0;
  const totalIngresos = ingresosAccumData[ingresosAccumData.length-1] || 0;
  if(evoIng) evoIng.textContent = isMasked() ? '••••••••' : '$' + fmtN(Math.round(totalIngresos));
  if(evoGas) evoGas.textContent = isMasked() ? '••••••••' : '$' + fmtN(Math.round(totalGastos));

  const useAccum = db2EvoMode === 'accum';
  const gasData   = useAccum ? gastosAccumData   : gastosDailyData;
  const incData   = useAccum ? ingresosAccumData  : ingresosDailyData;

  const maxValue = Math.max(...incData, ...gasData, 0);
  const yMax = Math.max(200000, Math.ceil(maxValue / 50000) * 50000);
  const gridColor = 'rgba(197, 206, 231, 0.7)';
  const tickColor = '#77819d';
  const tickFont  = {size:12, weight:'600', family:'-apple-system,SF Pro Display,sans-serif'};

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: incData,
          borderColor: '#56c683',
          backgroundColor: 'rgba(86,198,131,0.16)',
          borderWidth: 4,
          pointRadius: 7,
          pointHoverRadius: 7,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#56c683',
          pointBorderWidth: 4,
          tension: 0.42,
          fill: true
        },
        {
          label: 'Gastos',
          data: gasData,
          borderColor: '#f36a2b',
          backgroundColor: 'rgba(243,106,43,0.16)',
          borderWidth: 4,
          pointRadius: 7,
          pointHoverRadius: 7,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#f36a2b',
          pointBorderWidth: 4,
          tension: 0.42,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ..._chartTooltip(),
          backgroundColor: '#1b2345',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 12,
          displayColors: true,
          callbacks: { label: c => ' ' + c.dataset.label + ': $' + fmtN(Math.round(c.parsed.y)) }
        }
      },
      scales: {
        x: {
          ticks: { color: tickColor, font: tickFont, maxRotation: 0, minRotation: 0, padding: 16 },
          grid: { display: false, drawBorder: false },
          border: { display: false }
        },
        y: {
          min: 0,
          max: yMax,
          ticks: {
            color: tickColor,
            font: tickFont,
            stepSize: 50000,
            padding: 16,
            callback: v => v === 0 ? '$0' : '$' + fmtN(v)
          },
          grid: {
            color: gridColor,
            drawBorder: false,
            borderDash: [4,6]
          },
          border: { display: false }
        }
      }
    }
  });

  if(state.charts) state.charts.evolution = chart;

  // Insight line
  const insightEl = document.getElementById('db2-evo-insight');
  if(insightEl){
    if(totalGastos > 0 && totalIngresos > 0){
      const pct = Math.round(totalGastos / totalIngresos * 100);
      const diff = Math.abs(pct - 100);
      const copy = pct > 100
        ? `Vas <b>${diff}%</b> por encima del ingreso estimado del período.`
        : `Vas <b>${diff}%</b> por debajo del ingreso estimado del período.`;
      insightEl.innerHTML = `<span class="db2-evo-insight-icon"><svg viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.44 1 1.08 1 1.8V17h6v-.5c0-.72.4-1.36 1-1.8A7 7 0 0 0 12 2Z"/></svg></span><span>${copy}</span>`;
      insightEl.style.display = 'flex';
    } else {
      insightEl.style.display = 'none';
    }
  }
}

// ── Categories donut ──
function renderDb2CatDonut(monthTxns){
  const ctx = document.getElementById('chart-cat-donut');
  if(!ctx) return;
  if(state.charts && state.charts.catDonut){ state.charts.catDonut.destroy(); state.charts.catDonut = null; }

  const txns = monthTxns || getCurrentMonthTxns();
  const grouped = {};
  txns.filter(t => t.category && t.category !== 'Procesando...' && t.category !== 'Uncategorized').forEach(t => {
    const amt = t.currency === 'USD' ? t.amount * (USD_TO_ARS||1420) : t.amount;
    const parent = typeof catGroup === 'function' ? catGroup(t.category) : t.category;
    if(!grouped[parent]) grouped[parent] = {total: 0, color: typeof catColor === 'function' ? catColor(t.category) : '#666', emoji: ''};
    grouped[parent].total += amt;
  });

  const sorted = Object.entries(grouped).filter(([,d]) => d.total > 0).sort((a,b) => b[1].total - a[1].total).slice(0,8);
  const total = sorted.reduce((s,[,d]) => s + d.total, 0);
  const activeMonthKey=typeof getActiveDashMonth==='function'?getActiveDashMonth():getMonthKey(new Date());
  const [catYear,catMonth]=String(activeMonthKey||'').split('-').map(Number);
  const catMonthEl=document.getElementById('db2-cat-month');
  if(catMonthEl && catYear && catMonth){
    const dt=new Date(catYear,catMonth-1,1);
    catMonthEl.textContent=dt.toLocaleDateString('es-AR',{month:'long',year:'numeric'}).toUpperCase();
  }

  // Update donut total label
  const totalEl = document.getElementById('db2-cat-total');
  if(totalEl) {
    if(isMasked()) totalEl.textContent = '••••••••';
    else totalEl.textContent = total > 0 ? '$' + fmtN(Math.round(total)) : '—';
  }

  if(!sorted.length){
    const listEl = document.getElementById('db2-cat-list');
    if(listEl) listEl.innerHTML = '<div style="font-size:12px;color:var(--text3)">Sin gastos categorizados</div>';
    return;
  }

  const DONUT_COLORS = ['#3f7dff','#6a35f2','#e64ac2','#f38a2f','#59c8b7','#3ca38c','#7ca8ff','#ffc463'];
  const colors = sorted.map(([,d],i) => d.color || DONUT_COLORS[i % DONUT_COLORS.length]);

  const getCategoryIconSvg = name => {
    const n=String(name||'').toLowerCase();
    if(n.includes('aliment')) return `<svg viewBox="0 0 24 24"><path d="M7 4v8"/><path d="M10 4v8"/><path d="M8.5 12v8"/><path d="M15 4v18"/><path d="M18 4c0 3-1.6 4.5-3 4.5S12 7 12 4"/></svg>`;
    if(n.includes('regal')) return `<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13"/><path d="M3 12h18"/><path d="M7.5 8C6 8 5 7 5 5.8 5 4.6 6 4 7.2 4c1.8 0 3 1.7 4.8 4"/><path d="M16.5 8c1.5 0 2.5-1 2.5-2.2 0-1.2-1-1.8-2.2-1.8-1.8 0-3 1.7-4.8 4"/></svg>`;
    if(n.includes('vida')||n.includes('social')) return `<svg viewBox="0 0 24 24"><path d="M12 20s-6.5-4.3-8.5-8A5.2 5.2 0 0 1 12 5.8 5.2 5.2 0 0 1 20.5 12C18.5 15.7 12 20 12 20Z"/></svg>`;
    if(n.includes('transp')) return `<svg viewBox="0 0 24 24"><path d="M5 16V9.5A2.5 2.5 0 0 1 7.5 7h9A2.5 2.5 0 0 1 19 9.5V16"/><path d="M3 16h18"/><circle cx="7" cy="17.5" r="1.7"/><circle cx="17" cy="17.5" r="1.7"/><path d="M7 12h10"/></svg>`;
    if(n.includes('educ')) return `<svg viewBox="0 0 24 24"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H12v16H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M20 6.5A2.5 2.5 0 0 0 17.5 4H12v16h5.5A2.5 2.5 0 0 1 20 22z"/></svg>`;
    return `<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="4"/><path d="M8 10h8"/><path d="M8 14h5"/></svg>`;
  };
  const getCategoryTone = index => {
    const tones=[
      {bg:'linear-gradient(180deg,#dbe8ff 0%,#cfdcff 100%)', color:'#3f7dff'},
      {bg:'linear-gradient(180deg,#ede7ff 0%,#e3dcff 100%)', color:'#6a35f2'},
      {bg:'linear-gradient(180deg,#f8e2f3 0%,#f2d8ee 100%)', color:'#e64ac2'},
      {bg:'linear-gradient(180deg,#fdebd9 0%,#f8e0c7 100%)', color:'#f38a2f'},
      {bg:'linear-gradient(180deg,#def5f1 0%,#d4f0ea 100%)', color:'#59c8b7'}
    ];
    return tones[index % tones.length];
  };

  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(([name]) => name),
      datasets: [{
        data: sorted.map(([,d]) => d.total),
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 0,
        hoverOffset: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: { ..._chartTooltip(), callbacks: {
          label: c => ' $' + fmtN(Math.round(c.parsed)) + ' (' + Math.round(c.parsed/total*100) + '%)'
        }}
      }
    }
  });
  if(state.charts) state.charts.catDonut = chart;

  // Category list
  const listEl = document.getElementById('db2-cat-list');
  if(listEl){
    listEl.innerHTML = sorted.slice(0,5).map(([name,d],i) => {
      const pct = total > 0 ? Math.round(d.total/total*100) : 0;
      const color = colors[i];
      const tone=getCategoryTone(i);
      return `<div class="db2-cat-item ${i===0?'is-top':''}">
        <div class="db2-cat-iconbox" style="background:${tone.bg};color:${tone.color}">
          ${getCategoryIconSvg(name)}
        </div>
        <div class="db2-cat-copy">
          <span class="db2-cat-name">${esc(name)}</span>
          <span class="db2-cat-amt">${isMasked() ? '••••••••' : '$' + fmtN(Math.round(d.total))}</span>
        </div>
        <span class="db2-cat-pct" style="color:${color}">${pct}%</span>
      </div>`;
    }).join('');
  }

  // Bottom note
  const noteEl = document.getElementById('db2-cat-note');
  if(noteEl){
    const prevTxns = typeof getTxnsFor==='function'
      ? getTxnsFor(getMonthKey(new Date(catYear, (catMonth||1)-2, 1)))
      : [];
    const prevGrouped = {};
    (prevTxns||[]).filter(t => t.category && t.category !== 'Procesando...' && t.category !== 'Uncategorized').forEach(t => {
      const amt = t.currency === 'USD' ? t.amount * (USD_TO_ARS||1420) : t.amount;
      const parent = typeof catGroup === 'function' ? catGroup(t.category) : t.category;
      prevGrouped[parent] = (prevGrouped[parent] || 0) + amt;
    });
    const prevTotal = Object.values(prevGrouped).reduce((s,v)=>s+v,0);
    const deltaPct = prevTotal>0 ? ((total-prevTotal)/prevTotal)*100 : 0;
    const deltaText = `${Math.abs(deltaPct).toFixed(1).replace('.',',')}%`;
    noteEl.innerHTML = `<div class="db2-cat-note-icon">
      <svg viewBox="0 0 24 24"><path d="M4 18h16"/><path d="M7 15v-5"/><path d="M12 18V8"/><path d="M17 18v-9"/><path d="m8 8 3-3 3 3"/><path d="M11 5h6v6"/></svg>
    </div>
    <div class="db2-cat-note-copy">
      <div class="db2-cat-note-value">${deltaText} ${deltaPct>=0?'más':'menos'} que</div>
      <div class="db2-cat-note-text">el mes anterior</div>
    </div>`;
    noteEl.style.display = 'flex';
  }
}

// ── Agenda Viva widget ──
function renderDb2Agenda(timelineData){
  const listEl = document.getElementById('db2-agenda-list');
  const pillEl = document.getElementById('timeline-card-pill');
  if(!listEl) return;

  const cardEl = listEl.closest('.db2-agenda-card');
  const titleEl = cardEl?.querySelector('.db2-title');
  if(titleEl) titleEl.textContent = 'CALENDARIO';
  const headerEl = cardEl?.querySelector('.db2-hd');
  const cardHeight = cardEl?.getBoundingClientRect?.().height || 0;
  const availableHeight = cardHeight
    ? cardHeight - (headerEl?.offsetHeight || 42) - (pillEl?.offsetHeight || 42) - 54
    : 250;
  const maxVisible = Math.max(3, Math.min(7, Math.floor((availableHeight + 8) / 62) || 4));
  const events = getCalendarAgendaItems(new Date(),{includePast:false,includeDoneTasks:false}).slice(0, maxVisible);

  // Update pill count
  if(pillEl) pillEl.textContent = events.length + ' evento' + (events.length!==1?'s':'') + ' →';

  if(!events.length){
    listEl.innerHTML = '<div style="padding:12px 0;font-size:12px;color:var(--text3)">Sin eventos próximos</div>';
    return;
  }

  const getLogoProps = (name, type) => {
    const n = (name||'').toLowerCase();
    if(n.includes('netflix'))   return {bg:'#e50914', letter:'N'};
    if(n.includes('spotify'))   return {bg:'#1DB954', letter:'S'};
    if(n.includes('amazon'))    return {bg:'#ff9900', letter:'A'};
    if(n.includes('apple'))     return {bg:'#1c1c1e', letter:'🍎'};
    if(n.includes('google'))    return {bg:'#4285f4', letter:'G'};
    if(n.includes('disney'))    return {bg:'#113CCF', letter:'D'};
    if(n.includes('youtube'))   return {bg:'#ff0000', letter:'▶'};
    if(n.includes('sueldo')||n.includes('ingreso')||n.includes('cobro')) return {bg:'#30d158', letter:'$'};
    if(n.includes('alquiler'))  return {bg:'#ff9f0a', letter:'🏠'};
    if(n.includes('gym')||n.includes('gimnasio')||n.includes('megatlon')) return {bg:'#e63946', letter:'M'};
    if(n.includes('uca')||n.includes('ingles')) return {bg:'#003087', letter:'U'};
    if(n.includes('soporte')||n.includes('pc')||n.includes('tech')) return {bg:'#6366f1', letter:'💻'};
    if(type === 'close') return {bg:'#ff9f0a', letter:'💳'};
    if(type === 'due')   return {bg:'#ff3b30', letter:'!'};
    if(type === 'fixed') return {bg:'#7d3aec', letter:'📌'};
    if(type === 'task')  return {bg:'#4f46e5', letter:'✓'};
    const palette = ['#4361ee','#e63946','#2ec4b6','#7b2d8b','#0096c7','#ff6b6b'];
    const bg = palette[(name||'?').charCodeAt(0) % palette.length];
    return {bg, letter: (name||'?')[0].toUpperCase()};
  };

  listEl.innerHTML = events.map(e => {
    const when = e.days === 0 ? 'Hoy' : e.days === 1 ? 'Mañana' : `En ${e.days} días`;
    const chipCls = e.days === 0 ? 'today' : e.days <= 3 ? 'soon' : '';
    const name = e.shortLabel || e.title || 'Evento';
    const logo = getLogoProps(name, e.type);
    const amtStr = e.amount ? '-$' + (isMasked() ? '••••' : fmtN(Math.round(e.amount))) : '';
    const typeLabel = e.type === 'subscription' ? 'Suscripción' :
                      e.type === 'close'        ? 'Cierre TC'   :
                      e.type === 'due'          ? 'Vencimiento' :
                      e.type === 'fixed'        ? 'Gasto fijo'  :
                      e.type === 'task'         ? 'Task'        : 'Cuota';
    const descLine = [typeLabel, amtStr].filter(Boolean).join(' · ');
    const dayStr = e.date instanceof Date
      ? e.date.toLocaleDateString('es-AR',{day:'2-digit'})
      : '—';
    const monthStr = e.date instanceof Date
      ? e.date.toLocaleDateString('es-AR',{month:'short'}).replace('.','')
      : '';
    return `<button class="db2-agenda-item" type="button" onclick="nav('calendar')">
      <div class="db2-agenda-date">
        <span class="db2-agenda-day">${dayStr}</span>
        <span class="db2-agenda-month">${esc(monthStr)}</span>
      </div>
      <div class="db2-agenda-main">
        <div class="db2-agenda-logo" style="background:${logo.bg}">${logo.letter}</div>
        <div class="db2-agenda-body">
          <div class="db2-agenda-name">${esc(name)}</div>
          <div class="db2-agenda-desc">${descLine}</div>
        </div>
      </div>
      <div class="db2-agenda-chip ${chipCls}">${when}</div>
    </button>`;
  }).join('');
}

// ── Gastos de terceros (recordatorios de cobro) ──
function renderDb2DueStrip(timelineData){
  const grid = document.getElementById('db2-third-grid');
  const summary = document.getElementById('db2-third-summary');
  if(!grid) return;

  const today = new Date();
  const toArs = (amount, currency) => ((currency || 'ARS') === 'USD'
    ? (Number(amount) || 0) * (USD_TO_ARS || 1420)
    : (Number(amount) || 0));
  const toDisplayAmount = (amount, currency) => `${(currency || 'ARS') === 'USD' ? 'U$D ' : '$'}${fmtN(Math.round(Number(amount) || 0))}`;
  const getAgeLabel = dateValue => {
    const d = new Date(String(dateValue).includes('T') ? dateValue : `${dateValue}T12:00:00`);
    if(Number.isNaN(d.getTime())) return 'sin fecha';
    const diff = Math.max(0, Math.round((today - d) / 86400000));
    if(diff === 0) return 'hoy';
    if(diff === 1) return 'hace 1 día';
    return `hace ${diff} días`;
  };
  const shortDate = dateValue => {
    const d = new Date(String(dateValue).includes('T') ? dateValue : `${dateValue}T12:00:00`);
    if(Number.isNaN(d.getTime())) return 'sin fecha';
    return d.toLocaleDateString('es-AR', {day:'2-digit', month:'short'}).replace('.', '');
  };
  const initials = text => {
    const base = String(text || '').trim();
    if(!base) return '$';
    const words = base.split(/\s+/).slice(0,2);
    const chars = words.map(w => (w[0] || '').toUpperCase()).join('');
    return chars || base.slice(0,1).toUpperCase();
  };
  const palette = ['#5B3BFF','#2D6BFF','#F97316','#14B8A6','#E11D48','#7C3AED'];

  const pendingItems = (state.transactions || [])
    .filter(t =>
      !!t.isThirdParty &&
      !t.isPendingCuota &&
      !t.isPendingSubscription &&
      Number(t.amount) > 0
    )
    .map(t => {
      const recoverBase = Number(t.thirdPartyAmount) || Number(t.amount) || 0;
      const settledBase = Number(t.thirdPartySettledAmount) || 0;
      const status = t.thirdPartyStatus || 'pending';
      const recoveredAmount = status === 'settled'
        ? (settledBase > 0 ? Math.min(settledBase, recoverBase) : recoverBase)
        : (status === 'partial' ? Math.min(settledBase, recoverBase) : 0);
      const pendingAmount = Math.max(0, recoverBase - recoveredAmount);
      return {
        id: t.id,
        name: t.thirdPartyNote || t.description || 'Gasto de tercero',
        date: dateToYMD(t.date),
        currency: t.currency || 'ARS',
        pendingAmount,
        recoveredAmount,
        recoverBase,
        status,
        pendingArs: toArs(pendingAmount, t.currency),
        totalArs: toArs(recoverBase, t.currency)
      };
    })
    .filter(item => item.pendingAmount > 0 && item.status !== 'settled')
    .sort((a, b) => {
      if(a.status !== b.status) return a.status === 'partial' ? -1 : 1;
      return new Date(a.date) - new Date(b.date);
    });

  const totalOpenArs = pendingItems.reduce((s, item) => s + item.pendingArs, 0);
  const partialCount = pendingItems.filter(item => item.status === 'partial').length;
  const pendingCount = pendingItems.filter(item => item.status === 'pending').length;

  if(summary){
    if(pendingItems.length){
      const maskedSum = isMasked() ? '$••••••' : `$${fmtN(Math.round(totalOpenArs))}`;
      summary.innerHTML = `
        <div class="db2-third-pill">
          <span class="db2-third-pill-label">Por cobrar</span>
          <span class="db2-third-pill-value">${maskedSum}</span>
        </div>
        <div class="db2-third-pill">
          <span class="db2-third-pill-label">Pendientes</span>
          <span class="db2-third-pill-value">${pendingCount}</span>
        </div>
        <div class="db2-third-pill">
          <span class="db2-third-pill-label">Parciales</span>
          <span class="db2-third-pill-value">${partialCount}</span>
        </div>
      `;
    }else{
      summary.innerHTML = `
        <div class="db2-third-pill is-ok">
          <span class="db2-third-pill-label">Estado</span>
          <span class="db2-third-pill-value">Todo cobrado</span>
        </div>
      `;
    }
  }

  if(!pendingItems.length){
    grid.innerHTML = `
      <div class="db2-third-empty">
        No tenés gastos de terceros pendientes. Cuando marques uno en Movimientos, aparece acá como recordatorio.
      </div>
    `;
    return;
  }

  grid.innerHTML = pendingItems.slice(0, 3).map((item, i) => {
    const tone = item.status === 'partial' ? 'partial' : 'pending';
    const statusLabel = item.status === 'partial' ? 'Cobro parcial' : 'Pendiente';
    const since = shortDate(item.date);
    const age = getAgeLabel(item.date);
    const color = palette[i % palette.length];
    return `<button class="db2-third-item ${tone}" onclick="openThirdPartyTransactions()" title="Abrir terceros en Movimientos">
      <div class="db2-third-avatar" style="background:${color}">${initials(item.name)}</div>
      <div class="db2-third-body">
        <div class="db2-third-name">${esc(item.name)}</div>
        <div class="db2-third-meta">${statusLabel} · desde ${since}</div>
      </div>
      <div class="db2-third-amount">${isMasked() ? (item.currency === 'USD' ? 'U$D ••••' : '$••••••') : toDisplayAmount(item.pendingAmount, item.currency)}</div>
      <div class="db2-third-chip">${age}</div>
    </button>`;
  }).join('');

  if(pendingItems.length > 3){
    grid.innerHTML += `
      <button class="db2-third-more" onclick="openThirdPartyTransactions()">
        Ver ${pendingItems.length - 3} recordatorio${pendingItems.length - 3 !== 1 ? 's' : ''} más →
      </button>
    `;
  }
}

// ── Dollar sparkline ──
function renderDb2DollarSparkline(){
  const ctx = document.getElementById('db2-dollar-spark');
  if(!ctx) return;
  if(state.charts && state.charts.dollarSpark){ state.charts.dollarSpark.destroy(); state.charts.dollarSpark = null; }
  const emptyEl = document.getElementById('db2-dollar-empty');
  const changeEl = document.getElementById('db2-dollar-change');
  const history = (state.usdRateHistory || []).filter(item => item && Number(item.sell) > 0);
  let points = history.slice(-15).map(item => Number(item.sell));
  const hasRealHistory = points.length >= 2;

  if(points.length < 2){
    const currentSell = Number(state.usdRateSell || state.usdRate || USD_TO_ARS || 0);
    if(currentSell > 0){
      points = [currentSell, currentSell];
    }else{
      ctx.style.display = 'none';
      if(emptyEl) emptyEl.style.display = 'grid';
      if(changeEl) changeEl.textContent = '—';
      return;
    }
  }

  ctx.style.display = '';
  if(emptyEl) emptyEl.style.display = 'none';
  const first = points[0];
  const last = points[points.length - 1];
  const variation = first > 0 ? ((last - first) / first) * 100 : 0;
  
  if(changeEl && hasRealHistory){
    const sign = variation >= 0 ? '+' : '';
    changeEl.textContent = sign + variation.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}) + '%';
    changeEl.classList.toggle('down', variation < 0);
    changeEl.style.color = variation < 0 ? '#ff453a' : '#30d158'; // iOS style colors
  }else if(changeEl){
    changeEl.textContent = '—';
    changeEl.classList.remove('down');
    changeEl.style.color = '';
  }

  // Create gradient
  const chartCtx = ctx.getContext('2d');
  const gradient = chartCtx.createLinearGradient(0, 0, 0, 118);
  gradient.addColorStop(0, 'rgba(48, 209, 88, 0.22)');
  gradient.addColorStop(1, 'rgba(48, 209, 88, 0.02)');

  const c = new Chart(ctx, {
    type:'line',
    data:{
      labels: points.map((_,i)=>i),
      datasets:[{
        data: points,
        borderColor: '#30d158',
        borderWidth: 2.8,
        pointRadius: (context) => (context.dataIndex === points.length - 1 ? 4.5 : 0),
        pointBackgroundColor: '#30d158',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        fill: true,
        backgroundColor: gradient,
        tension: 0.4,
        capBezierPoints: true
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      animation:{ duration: 800, easing: 'easeOutQuart' },
      plugins:{
        legend:{display:false},
        tooltip:{
          enabled: true,
          mode: 'index',
          intersect: false,
          ..._chartTooltip(),
          callbacks: {
            label: (context) => ` $${fmtN(context.parsed.y)}`
          }
        }
      },
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales:{
        x:{display:false},
        y:{
          display:false,
          min: Math.min(...points) * 0.998,
          max: Math.max(...points) * 1.002
        }
      },
      elements: {
        line: { borderCapStyle: 'round' }
      }
    }
  });
  if(state.charts) state.charts.dollarSpark = c;
}

// ── Main caller — appended at end of renderDashboard ──
function renderDb2Dashboard(data){
  // data: { arsMonth, usdMonth, margen, pct, incTotalARS, spendBudget,
  //         projected, totalGastoARS, daysLeft, dailyRate, projPeriodClose,
  //         timelineData, monthTxns, thirdPartyTxns }
  renderDb2HeroExtras(data.arsMonth, data.usdMonth, data.margen, data.pct, data.incTotalARS, data.spendBudget, data.thirdPartyTxns);
  renderDb2CcCycles(data.ccWidgetData);
  renderDb2ProjExtras(data.projected, data.totalGastoARS, data.incTotalARS, data.spendBudget, data.daysLeft, data.dailyRate, data.projPeriodClose);
  renderDb2Agenda(data.timelineData);
  renderDb2EvolutionChart();
  renderDb2CatDonut(data.monthTxns);
  renderDb2DueStrip(data.timelineData);
  renderDb2DollarSparkline();
  enforceDashboardPrivacyMask();
}
