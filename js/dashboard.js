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
    animateNumberText(buyDisp,buyRate,{prefix:'$',decimals:2,duration:620});
  }
  if(sellDisp){
    animateNumberText(sellDisp,sellRate,{prefix:'$',decimals:2,duration:700});
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
  document.querySelectorAll('.usd-rate-badge').forEach(el=>{el.textContent='U$D 1 = $'+fmtN(rate)+' ('+( state.usdRateSource||'manual')+')'});
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
    if(close&&close>=today) events.push({type:'close', title:`${card?.name||cyc.label||'Tarjeta'} cierra`, shortLabel:card?.name||cyc.label||'Tarjeta', date:close, days:daysAway(close), page:'credit-cards', cardId:cyc.cardId, tcCycleId:cyc.id||null});
    if(due&&due>=today) events.push({type:'due', title:`${card?.name||cyc.label||'Tarjeta'} vence`, shortLabel:card?.name||cyc.label||'Tarjeta', date:due, days:daysAway(due), page:'credit-cards', cardId:cyc.cardId, tcCycleId:cyc.id||null});
  });
  const autoGroups=typeof detectAutoCuotas==='function'?detectAutoCuotas():[];
  autoGroups.forEach(g=>{
    const snap=typeof getAutoCuotaSnapshot==='function'?getAutoCuotaSnapshot(g,today):null;
    const day=snap?.cfg?.day||snap?.scheduleDay||null;
    if(!snap||snap.paid>=snap.total||!day||typeof getNextCuotaDate!=='function') return;
    const nextDate=getNextCuotaDate(day);
    const cuotaName=g.displayName||g.name;
    if(nextDate&&nextDate>=today){
      events.push({type:'commitment', title:cuotaName, shortLabel:cuotaName, date:normalizeDate(nextDate), days:daysAway(nextDate), amount:snap.amountPerCuota, page:'cuotas', autoCuotaKey:g.key});
    }
  });
  (state.cuotas||[]).forEach(c=>{
    if(c.paid>=c.total||!c.day||typeof getNextCuotaDate!=='function') return;
    const nextDate=getNextCuotaDate(c.day);
    if(nextDate&&nextDate>=today){
      events.push({type:'commitment', title:c.name, shortLabel:c.name, date:normalizeDate(nextDate), days:daysAway(nextDate), amount:c.amount, page:'cuotas', manualCuotaId:c.id});
    }
  });
  const toMonthly=s=>{if(s.freq==='monthly')return s.price;if(s.freq==='annual')return s.price/12;if(s.freq==='weekly')return s.price*4.3;return s.price;};
  (state.subscriptions||[]).forEach(s=>{
    if(s.active===false||!s.day||typeof getNextCuotaDate!=='function') return;
    const nextDate=getNextCuotaDate(s.day);
    if(nextDate&&nextDate>=today){
      events.push({type:'subscription', title:s.name, shortLabel:s.name, date:normalizeDate(nextDate), days:daysAway(nextDate), amount:s.currency==='USD'?toMonthly(s)*(USD_TO_ARS||1420):toMonthly(s), page:'subs', subscriptionId:s.id});
    }
  });
  (state.fixedExpenses||[]).forEach(f=>{
    if(!f.day||typeof getNextCuotaDate!=='function') return;
    const nextDate=getNextCuotaDate(f.day);
    if(nextDate&&nextDate>=today){
      events.push({type:'fixed', title:f.name, shortLabel:f.name, date:normalizeDate(nextDate), days:daysAway(nextDate), amount:f.currency==='USD'?f.amount*(USD_TO_ARS||1420):f.amount, page:'fixed', fixedExpenseId:f.id});
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
  let dt=null;
  if(value instanceof Date){
    dt=new Date(value);
  } else if(typeof value==='string'){
    const trimmed=value.trim();
    const match=trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(match){
      const [,yy,mm,dd]=match;
      dt=new Date(Number(yy), Number(mm)-1, Number(dd), 12, 0, 0, 0);
    } else {
      dt=new Date(trimmed);
    }
  } else {
    dt=new Date(value);
  }
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
  refreshCalendarViews();
}
function toggleTask(id){
  const t=(state.tasks||[]).find(x=>x.id===id);
  if(!t)return;
  t.done=!t.done;
  t.doneAt=t.done?Date.now():null;
  saveState();if(typeof renderNotifications==='function')renderNotifications();
  refreshCalendarViews();
}
function deleteTask(id){
  state.tasks=(state.tasks||[]).filter(x=>x.id!==id);
  saveState();if(typeof renderNotifications==='function')renderNotifications();
  refreshCalendarViews();
}
function clearDoneTasks(){
  state.tasks=(state.tasks||[]).filter(t=>!t.done);
  saveState();if(typeof renderNotifications==='function')renderNotifications();
  if(document.getElementById('page-calendar')?.classList.contains('active')) renderCalendarPage();
  if(document.getElementById('page-dashboard')?.classList.contains('active')) renderDashboard();
}
function getCalendarMinMonth(){
  const today=normalizeAgendaDate(new Date())||new Date();
  return new Date(today.getFullYear(), today.getMonth()-1, 1, 12, 0, 0, 0);
}
function getCalendarMaxMonth(){
  const today=normalizeAgendaDate(new Date())||new Date();
  return new Date(today.getFullYear(), today.getMonth()+6, 1, 12, 0, 0, 0);
}
function clampCalendarMonth(date){
  const min=getCalendarMinMonth();
  const max=getCalendarMaxMonth();
  if(date < min) return new Date(min.getFullYear(), min.getMonth(), 1, 12, 0, 0, 0);
  if(date > max) return new Date(max.getFullYear(), max.getMonth(), 1, 12, 0, 0, 0);
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
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
function getCalendarDayItems(dateValue){
  const selected=normalizeAgendaDate(dateValue);
  if(!selected) return [];
  return getCalendarAgendaItems(new Date(),{includePast:true,includeDoneTasks:false})
    .filter(item=>{
      const dt=normalizeAgendaDate(item.date);
      return dt && dateToInputValue(dt)===dateToInputValue(selected);
    })
    .sort((a,b)=>normalizeAgendaDate(a.date)-normalizeAgendaDate(b.date) || String(a.title||'').localeCompare(String(b.title||''),'es'));
}
function getCalendarItemMeta(item){
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
  return [when,amount].filter(Boolean).join(' · ');
}
function getCalendarAgendaItemKey(item, index){
  if(item?.taskId) return `task:${item.taskId}`;
  if(item?.subscriptionId) return `subscription:${item.subscriptionId}`;
  if(item?.fixedExpenseId) return `fixed:${item.fixedExpenseId}`;
  if(item?.manualCuotaId) return `cuota:${item.manualCuotaId}`;
  if(item?.autoCuotaKey) return `autocuota:${item.autoCuotaKey}`;
  if(item?.tcCycleId) return `${item.type}:${item.tcCycleId}`;
  return `${item?.type||'item'}:${dateToInputValue(item?.date)||'nodate'}:${index}`;
}
function calendarSupportsDirectEdit(item){
  return !!(item?.taskId || item?.subscriptionId || item?.fixedExpenseId || item?.manualCuotaId || item?.autoCuotaKey);
}
function renderCalendarDayItems(items, opts={}){
  const emptyMessage=opts.emptyMessage || 'Este día está libre. Podés usarlo para programar una task.';
  if(!items.length) return `<div class="calendar-empty">${emptyMessage}</div>`;
  window._calendarAgendaItemsByKey={};
  return items.map((item, index)=>{
    const key=getCalendarAgendaItemKey(item,index);
    window._calendarAgendaItemsByKey[key]=item;
    const meta=getCalendarItemMeta(item);
    let actions='';
    if(item.type==='task'){
      actions=`<div class="calendar-item-actions">
        <button class="calendar-item-check ${item.done?'checked':''}" onclick="event.stopPropagation();toggleTask('${item.taskId}')">${item.done?'✓':''}</button>
        <button class="calendar-item-link calendar-item-secondary" onclick="event.stopPropagation();editCalendarTask('${item.taskId}')">Editar</button>
        <button class="calendar-item-delete" onclick="event.stopPropagation();deleteCalendarAgendaItem('${key}')">✕</button>
      </div>`;
    } else if(calendarSupportsDirectEdit(item)){
      actions=`<div class="calendar-item-actions">
        <button class="calendar-item-link" onclick="event.stopPropagation();editCalendarAgendaItem('${key}')">Editar</button>
        <button class="calendar-item-delete" onclick="event.stopPropagation();deleteCalendarAgendaItem('${key}')">✕</button>
      </div>`;
    } else {
      actions=`<button class="calendar-item-link" onclick="event.stopPropagation();openCalendarAgendaItem('${key}')">Abrir</button>`;
    }
    return `<div class="calendar-item-card ${getCalendarItemToneClass(item)}">
      <div class="calendar-item-main">
        <div class="calendar-item-title">${esc(item.shortLabel||item.title||'Item')}</div>
        <div class="calendar-item-meta">${meta}</div>
      </div>
      ${actions}
    </div>`;
  }).join('');
}
function setCalendarMonthOffset(offset){
  const base=normalizeAgendaDate(state.calendarMonth||new Date())||new Date();
  const next=clampCalendarMonth(new Date(base.getFullYear(),base.getMonth()+offset,1,12,0,0,0));
  if(base.getFullYear()===next.getFullYear() && base.getMonth()===next.getMonth()){
    renderCalendarPage();
    return;
  }
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
function selectCalendarDate(dateValue, openDetail){
  state.calendarSelectedDate=dateValue;
  renderCalendarPage();
  if(openDetail) openCalendarDayModal(dateValue);
}
function refreshCalendarViews(){
  if(document.getElementById('page-calendar')?.classList.contains('active')) renderCalendarPage();
  if(document.getElementById('modal-calendar-day')?.classList.contains('open')) openCalendarDayModal(state.calendarSelectedDate||dateToInputValue(new Date()));
  if(document.getElementById('page-dashboard')?.classList.contains('active')) renderDashboard();
}
function openCalendarNewTask(dateValue){
  const safeDate=dateToInputValue(dateValue||state.calendarSelectedDate||new Date());
  closeModal('modal-calendar-day');
  document.getElementById('modal-calendar-task-title').textContent='Nueva task';
  document.getElementById('modal-calendar-task-editing').value='';
  document.getElementById('modal-calendar-task-text').value='';
  document.getElementById('modal-calendar-task-date').value=safeDate;
  document.getElementById('btn-del-calendar-task').style.display='none';
  openModal('modal-calendar-task');
  setTimeout(()=>document.getElementById('modal-calendar-task-text')?.focus(),80);
}
function editCalendarTask(taskId){
  const task=(state.tasks||[]).find(x=>x.id===taskId);
  if(!task) return;
  closeModal('modal-calendar-day');
  document.getElementById('modal-calendar-task-title').textContent='Editar task';
  document.getElementById('modal-calendar-task-editing').value=task.id;
  document.getElementById('modal-calendar-task-text').value=task.text||'';
  document.getElementById('modal-calendar-task-date').value=task.dueDate||dateToInputValue(state.calendarSelectedDate||new Date());
  document.getElementById('btn-del-calendar-task').style.display='inline-flex';
  openModal('modal-calendar-task');
  setTimeout(()=>document.getElementById('modal-calendar-task-text')?.focus(),80);
}
function saveCalendarTaskModal(){
  const text=document.getElementById('modal-calendar-task-text').value.trim();
  const dueDate=document.getElementById('modal-calendar-task-date').value||dateToInputValue(state.calendarSelectedDate||new Date());
  const editing=document.getElementById('modal-calendar-task-editing').value||'';
  if(!text||!dueDate){ showToast('Completá la task y la fecha','warn'); return; }
  if(!state.tasks) state.tasks=[];
  if(editing){
    const task=state.tasks.find(x=>x.id===editing);
    if(task){
      task.text=text;
      task.dueDate=dueDate;
    }
  } else {
    state.tasks.push({id:Math.random().toString(36).substr(2,9),text,done:false,createdAt:Date.now(),doneAt:null,dueDate});
  }
  state.calendarSelectedDate=dueDate;
  saveState();
  closeModal('modal-calendar-task');
  refreshCalendarViews();
  if(typeof renderNotifications==='function') renderNotifications();
  showToast(editing?'Task actualizada':'Task agregada','success');
}
function deleteCalendarTaskModal(){
  const taskId=document.getElementById('modal-calendar-task-editing').value||'';
  if(!taskId) return;
  deleteTask(taskId);
  closeModal('modal-calendar-task');
  refreshCalendarViews();
}
function openCalendarSubscriptionModal(dateValue){
  const safeDate=dateToInputValue(dateValue||state.calendarSelectedDate||new Date());
  const dt=normalizeAgendaDate(safeDate);
  closeModal('modal-calendar-day');
  openNewSubModal();
  if(dt){
    document.getElementById('sub-day').value=dt.getDate();
    document.getElementById('sub-start-date').value=safeDate;
  }
}
function openCalendarCuotaModal(dateValue){
  const dt=normalizeAgendaDate(dateValue||state.calendarSelectedDate||new Date());
  closeModal('modal-calendar-day');
  openNewCuotaModal();
  if(dt) document.getElementById('cuota-day').value=dt.getDate();
}
function openCalendarFixedModal(dateValue){
  const dt=normalizeAgendaDate(dateValue||state.calendarSelectedDate||new Date());
  closeModal('modal-calendar-day');
  openNewFixedModal();
  if(dt) document.getElementById('fixed-day').value=dt.getDate();
}
function openCalendarDayModal(dateValue){
  const safeDate=dateToInputValue(dateValue||state.calendarSelectedDate||new Date());
  const selectedDate=normalizeAgendaDate(safeDate);
  const labelEl=document.getElementById('calendar-day-modal-label');
  const subEl=document.getElementById('calendar-day-modal-sub');
  const listEl=document.getElementById('calendar-day-modal-list');
  const dateInput=document.getElementById('calendar-day-modal-date');
  if(!selectedDate||!labelEl||!subEl||!listEl||!dateInput) return;
  const items=getCalendarDayItems(safeDate);
  const taskCount=items.filter(item=>item.type==='task').length;
  dateInput.value=safeDate;
  labelEl.textContent=selectedDate.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
  subEl.textContent=items.length
    ? `${items.length} item${items.length!==1?'s':''}${taskCount?` · ${taskCount} task${taskCount!==1?'s':''}`:''}`
    : 'No hay items para este día';
  listEl.innerHTML=renderCalendarDayItems(items,{emptyMessage:'No hay nada cargado para este día. Podés sumar una task o un compromiso nuevo.'});
  openModal('modal-calendar-day');
}
function openCalendarAgendaItem(itemKey){
  const item=window._calendarAgendaItemsByKey?.[itemKey];
  if(!item) return;
  if(item.page) nav(item.page);
}
function editCalendarAgendaItem(itemKey){
  const item=window._calendarAgendaItemsByKey?.[itemKey];
  if(!item) return;
  closeModal('modal-calendar-day');
  if(item.taskId) return editCalendarTask(item.taskId);
  if(item.subscriptionId) return editSub(item.subscriptionId);
  if(item.fixedExpenseId) return editFixed(item.fixedExpenseId);
  if(item.manualCuotaId) return editCuota(item.manualCuotaId);
  if(item.autoCuotaKey) return openAutoCuotaModal(item.autoCuotaKey);
  openCalendarAgendaItem(itemKey);
}
function deleteCalendarAgendaItem(itemKey){
  const item=window._calendarAgendaItemsByKey?.[itemKey];
  if(!item) return;
  if(item.taskId){
    if(!confirm('¿Eliminar esta task?')) return;
    deleteTask(item.taskId);
    refreshCalendarViews();
    return;
  }
  if(item.subscriptionId){
    if(!confirm('¿Eliminar esta suscripción?')) return;
    if(typeof deleteSubscriptionById==='function') deleteSubscriptionById(item.subscriptionId,{silent:true});
    else {
      state.subscriptions=(state.subscriptions||[]).filter(s=>s.id!==item.subscriptionId);
      if(typeof syncProjectedSubscriptionTransactions==='function') syncProjectedSubscriptionTransactions();
      saveState();
    }
    refreshCalendarViews();
    showToast('Suscripción eliminada','info');
    return;
  }
  if(item.fixedExpenseId){
    if(!confirm('¿Eliminar este gasto fijo?')) return;
    state.fixedExpenses=(state.fixedExpenses||[]).filter(f=>f.id!==item.fixedExpenseId);
    saveState();
    refreshCalendarViews();
    showToast('Gasto fijo eliminado','info');
    return;
  }
  if(item.manualCuotaId){
    if(!confirm('¿Eliminar esta cuota manual?')) return;
    if(typeof deleteManualCuotaById==='function') deleteManualCuotaById(item.manualCuotaId,{silent:true});
    else {
      state.cuotas=(state.cuotas||[]).filter(c=>c.id!==item.manualCuotaId);
      saveState();
    }
    refreshCalendarViews();
    showToast('Cuota eliminada','info');
    return;
  }
  if(item.autoCuotaKey){
    if(!confirm('¿Ocultar esta cuota automática del seguimiento?')) return;
    if(typeof dismissAutoCuotaWithHistory==='function') dismissAutoCuotaWithHistory(item.autoCuotaKey,{silent:true});
    else if(typeof dismissAutoCuota==='function') dismissAutoCuota(item.autoCuotaKey);
    refreshCalendarViews();
  }
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
  if(nextBtn){
    const maxMonth=getCalendarMaxMonth();
    nextBtn.disabled=monthStart.getFullYear()===maxMonth.getFullYear() && monthStart.getMonth()===maxMonth.getMonth();
  }
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
    return `<button class="calendar-cell ${isToday?'is-today':''} ${isSelected?'is-selected':''} ${toneClass}" onclick="selectCalendarDate('${key}', true)">
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
  dayListEl.innerHTML=renderCalendarDayItems(selectedItems);

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
  const arsT=monthTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+(typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount),0);
  const usdT=monthTxns.filter(t=>t.currency==='USD').reduce((s,t)=>s+(typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount),0);
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
  const arsT = monthTxns.filter(t => t.currency === 'ARS').reduce((s,t) => s + (typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount), 0);
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
  const billableTxns=_allBillable; // sharedExpense replaces isThirdParty
  const thirdPartyTxns=_allBillable.filter(t=>!!t.sharedExpense&&!!t.sharedExpense.enabled);
  const tpSettled=thirdPartyTxns.filter(t=>t.thirdPartyStatus==='settled');
  const tpSettledArs=tpSettled.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const tpSettledUsd=tpSettled.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);
  let arsMonth=_allBillable.filter(t=>t.currency==='ARS').reduce((s,t)=>s+(typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount),0);
  let usdMonth=_allBillable.filter(t=>t.currency==='USD').reduce((s,t)=>s+(typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount),0);
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
  const dashboardRangeMeta=(()=>{
    if(_tcModeActive&&activeTcCycle){
      const scopedCycles=getTcCycles(activeCycleMode);
      const openStr=getTcCycleOpen(scopedCycles, scopedCycles.findIndex(c=>c.id===activeTcCycle.id))||activeTcCycle.closeDate;
      return {openStr,closeStr:activeTcCycle.closeDate};
    }
    return null;
  })();
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
      const remaining = Math.max(0, (Number(c.total)||0) - (Number(c.paid)||0));
      if(remaining <= 0 || !c.day) return;
      // CAP: never emit more dates than unpaid cuotas left
      const allDates = _getRecurringDatesInRange(c.day, openDate, closeDate);
      const cappedDates = allDates.slice(0, remaining);
      const cuotaNameNorm = String(c.name||'').toLowerCase().trim();
      const cuotaAmt = Number(c.amount)||0;
      const matchingRealInMonth = (monthKey)=>{
        if(!cuotaNameNorm) return false;
        return (state.transactions||[]).some(t=>{
          if(t.isPendingCuota || t.isPendingSubscription) return false;
          const tMonth = t.month || getMonthKey(t.date);
          if(tMonth !== monthKey) return false;
          const desc = String(t.description||t._baseDesc||'').toLowerCase();
          if(!desc.includes(cuotaNameNorm) && !cuotaNameNorm.includes(desc.split(' ')[0]||'__')) return false;
          const amt = Math.abs(Number(t.amount)||0);
          return cuotaAmt>0 && Math.abs(amt - cuotaAmt) / cuotaAmt < 0.05;
        });
      };
      cappedDates.forEach(dueDate=>{
        if(!_hasReachedChargeDate(dueDate)) return;
        if(matchingRealInMonth(getMonthKey(dueDate))) return;
        add(`manual-${c.id}-${dateToYMD(dueDate)}`, 'ARS', cuotaAmt);
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
      // Use personal amount so shared expenses don't double-count
      const _pa=typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount;
      addExtra(key,t.currency,_pa);
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
  billableTxns.filter(t=>t.currency==='ARS').forEach(t=>{catTotals[t.category||'Sin categoría']=(catTotals[t.category||'Sin categoría']||0)+(typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount);});
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

  const dashboardCards=(state.ccCards||[]);
  const dashboardCardTotals={};
  const dashboardCardDisplayTotals={};
  const dashboardCardCycleByKey={};
  let dashboardCardsArs=0;
  let dashboardCardsUsd=0;
  let dashboardCardsCount=0;
  const _todayYmdDash=dateToYMD(today);
  // Always use ALL cycles (unfiltered by mode) for per-card active cycle lookup.
  // _tcCycles may be filtered to a single card mode (e.g. 'visa'), which would
  // leave AMEX with no cardSpecificCycles and incorrectly fall back to the VISA cycle.
  const _allCardCycles=getTcCycles();
  dashboardCards.forEach(card=>{
    const key=(card.payMethodKey||card.id||'').toLowerCase();
    dashboardCardTotals[key]={ars:0,usd:0,count:0};
    dashboardCardDisplayTotals[key]={ars:0,usd:0,count:0};
    // Find the active cycle for THIS specific card using the full cycle set
    const cardSpecificCycles=_allCardCycles.filter(c=>c.cardId===card.id);
    const cardActiveCycle=cardSpecificCycles.find(c=>{
      const idx=_allCardCycles.findIndex(x=>x.id===c.id);
      const open=getTcCycleOpen(_allCardCycles,idx);
      return open&&_todayYmdDash>=open&&_todayYmdDash<=c.closeDate;
    })||cardSpecificCycles[0]||null;
    dashboardCardCycleByKey[key]=cardActiveCycle||null;
  });
  const dashboardCardBaseTxns=(monthTxns||[]).filter(t=>{
    if(t.isPendingCuota||t.isPendingSubscription) return false;
    const key=(t.payMethod||'').toLowerCase();
    return key==='visa'||key==='amex';
  });
  dashboardCardBaseTxns.forEach(t=>{
    const key=(t.payMethod||'').toLowerCase();
    if(!dashboardCardTotals[key]) dashboardCardTotals[key]={ars:0,usd:0,count:0};
    if((t.currency||'ARS')==='USD') dashboardCardTotals[key].usd+=(Number(t.amount)||0);
    else dashboardCardTotals[key].ars+=(Number(t.amount)||0);
    dashboardCardTotals[key].count++;
  });
  const dashboardProjectedEntries=(dashboardRangeMeta&&typeof getProjectedCommitmentEntriesForRange==='function')
    ? getProjectedCommitmentEntriesForRange({
        startStr:dashboardRangeMeta.openStr,
        endStr:dashboardRangeMeta.closeStr,
        todayRef:today,
        txns:state.transactions||[]
      }).filter(entry=>entry.includeInTotal)
    : [];
  dashboardProjectedEntries.forEach(entry=>{
    const ownerKey=(entry.payMethod||'').toLowerCase()==='amex'?'amex':'visa';
    if(!dashboardCardDisplayTotals[ownerKey]) dashboardCardDisplayTotals[ownerKey]={ars:0,usd:0,count:0};
    if((entry.currency||'ARS')==='USD') dashboardCardDisplayTotals[ownerKey].usd+=(Number(entry.amount)||0);
    else dashboardCardDisplayTotals[ownerKey].ars+=(Number(entry.amount)||0);
    dashboardCardDisplayTotals[ownerKey].count++;
  });
  Object.keys(dashboardCardTotals).forEach(key=>{
    dashboardCardDisplayTotals[key]={
      ars:(dashboardCardTotals[key]?.ars||0)+(dashboardCardDisplayTotals[key]?.ars||0),
      usd:(dashboardCardTotals[key]?.usd||0)+(dashboardCardDisplayTotals[key]?.usd||0),
      count:(dashboardCardTotals[key]?.count||0)+(dashboardCardDisplayTotals[key]?.count||0)
    };
    dashboardCardsArs+=dashboardCardDisplayTotals[key].ars||0;
    dashboardCardsUsd+=dashboardCardDisplayTotals[key].usd||0;
    dashboardCardsCount+=dashboardCardDisplayTotals[key].count||0;
  });
  const dashboardSummaryTotals=(typeof getTxnDisplaySummaryTotals==='function')
    ? getTxnDisplaySummaryTotals({
        mode:isTcView?activeCycleMode:'mes',
        activeCycleMeta:dashboardRangeMeta,
        searchVal:'',
        txns:monthTxns||[],
        summaryTxns:monthTxns||[],
        todayRef:today,
        monthKey:activeMk,
        hasCategoryFilter:false,
        hasCurrencyFilter:false,
        hasCardFilter:false,
        estadoFilter:'all'
      })
    : {ars:arsMonth,usd:usdMonth,grand:arsMonth+(usdMonth*(window.USD_TO_ARS||USD_TO_ARS||1))};
  arsMonth=dashboardSummaryTotals.ars||0;
  usdMonth=dashboardSummaryTotals.usd||0;
  if(isTcView&&dashboardCards.length){
    cntMonth=dashboardCardsCount||cntMonth;
  }
  const rawPeriodArsMonth=_allBillable.filter(t=>t.currency==='ARS').reduce((s,t)=>s+(typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount),0) + (_tcModeActive?syntheticARS:projectedMonthTotals.ars);
  const rawPeriodUsdMonth=_allBillable.filter(t=>t.currency==='USD').reduce((s,t)=>s+(typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount),0) + (_tcModeActive?syntheticUSD:projectedMonthTotals.usd);
  const rawPeriodCntMonth=_allBillable.length + (_tcModeActive?syntheticCount:projectedMonthTotals.count);
  const operationalArsMonth=dashboardSummaryTotals.ars||rawPeriodArsMonth;
  const operationalUsdMonth=dashboardSummaryTotals.usd||rawPeriodUsdMonth;
  const operationalCntMonth=rawPeriodCntMonth;
  const creditCycleArsTotal=dashboardCardsArs||arsMonth;

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
      const _pa=typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount;
      const amt=t.currency==='USD'?_pa*(USD_TO_ARS||1):_pa;
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
        if(isMasked()) projEl.textContent='••••••••';
        else animateNumberText(projEl,projected,{prefix:'$',decimals:2,duration:860});
        const overBudget=incTotalARS>0&&projected>incTotalARS;
        projEl.style.color=getProjectionColor(projected);
        const closeLabel=projPeriodClose?projPeriodClose.toLocaleDateString('es-AR',{day:'2-digit',month:'short'}):'cierre';
        if(projD)projD.textContent=overBudget?'Exige ajuste antes del '+closeLabel:'Estimación activa hasta '+closeLabel;
        const _dailyEl=document.getElementById('kpi-proj-daily');
        if(_dailyEl){
          if(isMasked()) _dailyEl.textContent='••••••••';
          else animateNumberText(_dailyEl,Math.round(dailyRate),{prefix:'$',decimals:2,duration:720});
        }
        const _daysEl=document.getElementById('kpi-proj-days');
        if(_daysEl)animateNumberText(_daysEl,daysLeft,{decimals:0,duration:620,formatter:(n)=>`${Math.round(n)} día${Math.round(n) !== 1 ? 's' : ''}`});
        const _daysLabel=document.getElementById('kpi-proj-days-label');
        if(_daysLabel)_daysLabel.textContent='DÍAS RESTANTES';
      }
      if(projTitle)projTitle.textContent='PROYECCIÓN AL CIERRE TC';
    } else {
      // Mes mode
      if(isCurrentMonth){
        if(isMasked()) projEl.textContent='••••••••';
        else animateNumberText(projEl,projected,{prefix:'$',decimals:2,duration:860});
        const overBudget=incTotalARS>0&&projected>incTotalARS;
        projEl.style.color=getProjectionColor(projected);
        if(projD)projD.textContent=overBudget?'Ritmo alto para este mes':'Ritmo estimado al cierre mensual';
        const _dailyEl2=document.getElementById('kpi-proj-daily');
        if(_dailyEl2){
          if(isMasked()) _dailyEl2.textContent='••••••••';
          else animateNumberText(_dailyEl2,Math.round(dailyRate),{prefix:'$',decimals:2,duration:720});
        }
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
    evolutionData:{
      mode:isTcView?'tc':'mes',
      monthKey:activeMk,
      cycleMode:activeCycleMode,
      cycleId:activeTcCycle?.id || null,
      totalExpenseArs:totalGastoARS,
      totalIncomeArs:incTotalARS
    },
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
  const w={};txns.filter(t=>t.currency==='ARS').forEach(t=>{const k=t.week||getWeekKey(t.date);w[k]=(w[k]||0)+(typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount);});
  const s=Object.keys(w).sort();return{labels:s.map(k=>fmtWeekLabel(k)),values:s.map(k=>w[k]),keys:s};
}
function getCatData(txns,byGroup){
  txns=txns||state.transactions;
  const c={};
  txns.filter(t=>t.category&&t.category!=='Procesando...'&&t.category!=='Uncategorized').forEach(t=>{
    const _pa=typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount;
    const amt=t.currency==='USD'?_pa*USD_TO_ARS:_pa;
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
      byMonth[k]=(byMonth[k]||0)+(typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount);
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
      byWeek[k]=(byWeek[k]||0)+(typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount);
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
      byDay[d]=(byDay[d]||0)+(typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount);
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
  // Group by parent category — ARS only, matches Tendencias view
  const grouped={};
  CATEGORY_GROUPS.forEach(g=>{grouped[g.group]={total:0,color:g.color,emoji:g.emoji};});
  txns.filter(t=>t.currency==='ARS'&&t.category&&t.category!=='Procesando...'&&t.category!=='Uncategorized').forEach(t=>{
    const _pa=typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount;
    const parent=catGroup(t.category);
    if(!grouped[parent])grouped[parent]={total:0,color:'#888',emoji:''};
    grouped[parent].total+=_pa;
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
    !t.isPendingSubscription
  );
  const usdSpend = cleanTxns.filter(t => t.currency === 'USD').reduce((s,t)=>s + (typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):(t.amount||0)), 0);
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
    !t.isPendingCuota &&
    !t.isPendingSubscription
  );
  if(prevTxns.length && cleanTxns.length){
    // build category totals for both months
    const sumCats = txns => {
      const c = {};
      txns.filter(t => t.currency === 'ARS').forEach(t => { c[t.category] = (c[t.category] || 0) + (typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount); });
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
    tpSubEl.textContent=`${thirdPartySummary.count} gasto${thirdPartySummary.count!==1?'s':''} compartido${thirdPartySummary.count!==1?'s':''} · ${openCount} pendiente${openCount!==1?'s':''} de cobro`;
    tpBadgeEl.textContent=openCount?`${openCount} pendiente${openCount!==1?'s':''} de cobro`:'Todo cobrado';
    tpBadgeEl.className=`dash-third-party-badge ${openCount?'pending':'settled'}`;
    tpTotalEl.textContent='$'+fmtN(Math.round(thirdPartySummary.totalRecoverArs));
    tpCollectedEl.textContent='$'+fmtN(Math.round(thirdPartySummary.collectedArs));
    tpOpenEl.textContent='$'+fmtN(Math.round(thirdPartySummary.pendingArs));
    tpFootEl.textContent=`${thirdPartySummary.pendingCount} pendiente${thirdPartySummary.pendingCount!==1?'s':''} de cobro · ${thirdPartySummary.settledCount} cobrado${thirdPartySummary.settledCount!==1?'s':''}${thirdPartySummary.hasUsd?' · incluye equivalencia USD→ARS':''}`;
    animateProgressBar(tpBarEl,recoveredPct);
    tpBarEl.style.background=openCount?'#a882ff':'var(--green-sys)';
  } else {
    historyWrap&&historyWrap.classList.add('is-empty');
    historyCard&&historyCard.classList.add('is-empty');
    if(tpPendingEl)tpPendingEl.textContent='—';
    if(tpSubEl)tpSubEl.textContent='Sin gastos compartidos por ahora';
    if(tpBadgeEl){
      tpBadgeEl.textContent='todo limpio';
      tpBadgeEl.className='dash-third-party-badge';
    }
    if(tpTotalEl)tpTotalEl.textContent='—';
    if(tpCollectedEl)tpCollectedEl.textContent='—';
    if(tpOpenEl)tpOpenEl.textContent='—';
    if(tpFootEl)tpFootEl.textContent='Cuando dividas un gasto, esta tarjeta se expande con el seguimiento completo.';
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
    t.estado_revision!=='duplicado_sospechoso'
  );
  if(!historyTxns.length)return{dailyAvg:0,monthlyAvg:0,daySpan:0,monthSpan:0};
  const totalHistoryARS=historyTxns.reduce((sum,t)=>{const _pa=typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):(t.amount||0);return sum+((t.currency==='USD'?_pa*USD_TO_ARS:_pa)||0);},0);
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
  // Kept for backward compat — delegates to getSharedExpenseSummary
  const txns=(state.transactions||[]).filter(t=>t.sharedExpense&&t.sharedExpense.enabled);
  const toArs=(amount,currency)=>((currency||'ARS')==='USD'?(Number(amount)||0)*(USD_TO_ARS||1420):(Number(amount)||0));
  let pendingArs=0,collectedArs=0,count=0;
  txns.forEach(t=>{
    (t.sharedExpense.splits||[]).forEach(s=>{
      const amt=toArs(s.amount,t.currency);
      if(s.status==='cobrado') collectedArs+=amt; else { pendingArs+=amt; count++; }
    });
  });
  return {
    count:txns.length,
    pendingCount:count,
    partialCount:0,
    settledCount:0,
    totalRecoverArs:pendingArs+collectedArs,
    collectedArs,
    pendingArs,
    hasUsd:txns.some(t=>t.currency==='USD')
  };
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
let db2EvoMode = 'month'; // 'daily' | 'month'
let _db2EvolutionState = null;
function _applyDb2CcPrivacy(prefix, hasUsdValue=false){
  const arsEl=document.getElementById(`kpi-${prefix}-ars`);
  const usdEl=document.getElementById(`kpi-${prefix}-usd`);
  const amountSide=arsEl?.closest('.db2-cc-amount-side') || usdEl?.closest('.db2-cc-amount-side');
  if(amountSide) amountSide.classList.add('is-masked');
  if(arsEl){
    if(typeof cancelNumberTextAnimation==='function') cancelNumberTextAnimation(arsEl);
    arsEl.textContent='••••••••';
  }
  if(usdEl){
    if(typeof cancelNumberTextAnimation==='function') cancelNumberTextAnimation(usdEl);
    usdEl.textContent=hasUsdValue?'••••':'';
    usdEl.style.display=hasUsdValue?'':'none';
  }
}
function _clearDb2CcPrivacy(prefix){
  const arsEl=document.getElementById(`kpi-${prefix}-ars`);
  const usdEl=document.getElementById(`kpi-${prefix}-usd`);
  const amountSide=arsEl?.closest('.db2-cc-amount-side') || usdEl?.closest('.db2-cc-amount-side');
  if(amountSide) amountSide.classList.remove('is-masked');
}
function setDb2EvoMode(mode){
  db2EvoMode = mode === 'month' ? 'month' : 'daily';
  const d = document.getElementById('db2-evo-daily-btn');
  const a = document.getElementById('db2-evo-accum-btn');
  if(d) d.classList.toggle('active', db2EvoMode==='daily');
  if(a) a.classList.toggle('active', db2EvoMode==='month');
  renderDb2EvolutionChart();
}

// ── Smart CC Cycle Widget ──
function _ccwGetCardData(key, data){
  const today = new Date();
  const todayYmd = dateToYMD(today);
  const cards = state.ccCards || [];
  const allCycles = typeof getTcCycles === 'function' ? getTcCycles() : [];
  const cycleByKey = data?.cycleByKey || {};
  const totalsByKey = data?.totalsByKey || {};
  const isMesMode = !!data?.isMesMode;
  const mesMonthKey = data?.mesMonthKey || getMonthKey(today);

  const card = cards.find(c => (c.payMethodKey||'').toLowerCase() === key) || cards.find(c => (c.name||'').toLowerCase().includes(key));
  if(!card) return null;

  const cardCycles = allCycles.filter(c => c.cardId === card.id);
  let activeCycle = cycleByKey[key] || cardCycles.find(c => {
    const idx = allCycles.findIndex(x => x.id === c.id);
    const open = getTcCycleOpen(allCycles, idx);
    return open && todayYmd >= open && todayYmd <= c.closeDate;
  }) || cardCycles[0];

  let openYmd, closeYmd, dueYmd;
  if(isMesMode){
    const [mY,mM] = mesMonthKey.split('-').map(Number);
    openYmd = `${mesMonthKey}-01`;
    closeYmd = dateToYMD(new Date(mY, mM, 0));
    dueYmd = null;
  } else if(activeCycle){
    const cycleIdx = allCycles.findIndex(c => c.id === activeCycle.id);
    openYmd = typeof getTcCycleOpen === 'function' ? getTcCycleOpen(allCycles, cycleIdx) : null;
    closeYmd = activeCycle.closeDate;
    dueYmd = activeCycle.dueDate || null;
  } else { return null; }

  const scopedTotals = totalsByKey[key] || totalsByKey[card.payMethodKey||card.id] || null;
  let cycleTxns = [];
  if(!scopedTotals && !isMesMode && activeCycle && typeof getTcCycleTxns === 'function'){
    cycleTxns = getTcCycleTxns(activeCycle, allCycles);
  }
  const arsTotal = scopedTotals ? (scopedTotals.ars||0) : cycleTxns.filter(t => t.currency==='ARS' && t.amount>0).reduce((s,t)=>s+t.amount,0);
  const usdTotal = scopedTotals ? (scopedTotals.usd||0) : cycleTxns.filter(t => t.currency==='USD' && t.amount>0).reduce((s,t)=>s+t.amount,0);
  const txnCount = scopedTotals ? (scopedTotals.count||0) : cycleTxns.length;

  const openD  = openYmd  ? new Date(openYmd+'T12:00:00')  : null;
  const closeD = closeYmd ? new Date(closeYmd+'T12:00:00') : null;
  const totalDays = openD && closeD ? Math.max(1, Math.round((closeD-openD)/86400000)) : 30;
  const elapsed   = openD ? Math.max(0, Math.round((today-openD)/86400000)) : 0;
  const daysLeft  = closeD ? Math.max(0, Math.round((closeD-today)/86400000)) : 0;
  const pct = Math.min(100, Math.round(elapsed/totalDays*100));
  const dailyAvg = elapsed > 0 ? arsTotal / elapsed : 0;
  const projected = dailyAvg * totalDays;

  // Previous cycle comparison
  let prevArs = 0;
  if(!isMesMode && activeCycle){
    const prevCycle = cardCycles.find(c => c.closeDate < (activeCycle.closeDate||'') && c.id !== activeCycle.id);
    if(prevCycle && typeof getTcCycleTxns === 'function'){
      prevArs = getTcCycleTxns(prevCycle, allCycles).filter(t=>t.currency==='ARS'&&t.amount>0).reduce((s,t)=>s+t.amount,0);
    }
  } else if(isMesMode){
    const [mY,mM] = mesMonthKey.split('-').map(Number);
    const prevMk = (mM===1?(mY-1)+'-12':mY+'-'+String(mM-1).padStart(2,'0'));
    if(typeof getTxnsFor==='function'){
      prevArs = (getTxnsFor(prevMk)||[]).filter(t=>t.currency==='ARS'&&(t.payMethod||'').toLowerCase()===key&&t.amount>0&&!t.isIncome&&t.type!=='income').reduce((s,t)=>s+(typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount),0);
    }
  }
  const deltaPct = prevArs > 0 ? ((arsTotal-prevArs)/prevArs)*100 : 0;

  // Last transaction time
  const allCardTxns = (state.transactions||[]).filter(t=>(t.payMethod||'').toLowerCase()===key).sort((a,b)=>(b.date instanceof Date?b.date:new Date(b.date))-(a.date instanceof Date?a.date:new Date(a.date)));
  const lastTxn = allCardTxns[0] || null;
  let lastTxnAgo = '';
  if(lastTxn){
    const ld = lastTxn.date instanceof Date ? lastTxn.date : new Date(String(lastTxn.date).includes('T')?lastTxn.date:lastTxn.date+'T12:00:00');
    const diffH = Math.round((today-ld)/3600000);
    if(diffH < 1) lastTxnAgo = 'hace minutos';
    else if(diffH < 24) lastTxnAgo = `hace ${diffH}h`;
    else if(diffH < 48) lastTxnAgo = 'ayer';
    else lastTxnAgo = `hace ${Math.round(diffH/24)} días`;
  }

  // Top category
  const catTotals = {};
  const txnPool = cycleTxns.length ? cycleTxns : allCardTxns.filter(t=>{
    const d=dateToYMD(t.date); return openYmd&&closeYmd&&d>=openYmd&&d<=closeYmd;
  });
  txnPool.filter(t=>t.currency==='ARS'&&t.category&&t.category!=='Procesando...').forEach(t=>{
    const g = typeof catGroup==='function' ? catGroup(t.category) : t.category;
    catTotals[g] = (catTotals[g]||0) + (typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount);
  });
  const topCat = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
  const topCatPct = topCat && arsTotal > 0 ? Math.round(topCat[1]/arsTotal*100) : 0;

  return { key, card, arsTotal, usdTotal, txnCount, openYmd, closeYmd, dueYmd, totalDays, elapsed, daysLeft, pct, dailyAvg, projected, prevArs, deltaPct, lastTxnAgo, topCat: topCat?topCat[0]:null, topCatPct };
}

function _ccwFmt(ymd){
  if(!ymd) return '—';
  try { const d=new Date(ymd+'T12:00:00'); return d.toLocaleDateString('es-AR',{day:'2-digit',month:'short'}).replace('.','').toUpperCase(); }
  catch(e){ return ymd; }
}

function _ccwBuildInsight(d){
  const lines = [];
  if(d.deltaPct !== 0 && d.prevArs > 0){
    const dir = d.deltaPct > 0 ? 'más' : 'menos';
    lines.push(`Tu consumo es <strong>${Math.abs(d.deltaPct).toFixed(1).replace('.',',')}% ${dir}</strong> que el ciclo anterior`);
  }
  if(d.projected > 0 && d.daysLeft > 2){
    lines.push(`Si mantenés este ritmo, cerrarías en <strong>$${fmtN(Math.round(d.projected))}</strong>`);
  }
  if(d.topCat && d.topCatPct > 25){
    lines.push(`El <strong>${d.topCatPct}%</strong> fue en ${d.topCat}`);
  }
  if(d.lastTxnAgo){
    lines.push(`Último consumo <strong>${d.lastTxnAgo}</strong>`);
  }
  return lines;
}

function _ccwRenderFocus(d){
  const k = d.key;
  const masked = isMasked();
  const insights = _ccwBuildInsight(d);
  const insightHtml = insights.length ? insights.map(t=>`<div class="ccw-insight"><span class="ccw-insight-icon">✦</span><span class="ccw-insight-text">${t}</span></div>`).join('') : '';

  return `
    <div class="ccw-focus">
      <div class="ccw-focus-hero ${k==='amex'?'is-amex':''}">
        <div class="ccw-focus-logo ${k}">${k.toUpperCase()}</div>
        <div class="ccw-focus-main">
          <div class="ccw-focus-name">Santander ${k.toUpperCase()}</div>
          <div class="ccw-focus-amt">${masked?'••••••••':'$'+fmtN(Math.round(d.arsTotal))}</div>
          ${d.usdTotal>0?'<div class="ccw-focus-amt-usd">'+(masked?'••••':'U$D '+fmtN(d.usdTotal))+'</div>':''}
        </div>
        <div class="ccw-focus-right">
          <div class="ccw-focus-days ${k}">${d.daysLeft}</div>
          <div class="ccw-focus-days-label">días restantes</div>
          <div class="ccw-focus-bar"><div class="ccw-focus-bar-fill ${k}" style="width:0%" id="ccw-bar-${k}"></div></div>
        </div>
      </div>

      <div class="ccw-stats">
        <div class="ccw-stat">
          <div class="ccw-stat-val">${masked?'••••':'$'+fmtN(Math.round(d.dailyAvg))}</div>
          <div class="ccw-stat-label">Prom. diario</div>
        </div>
        <div class="ccw-stat">
          <div class="ccw-stat-val">${masked?'••••':'$'+fmtN(Math.round(d.projected))}</div>
          <div class="ccw-stat-label">Proyección</div>
        </div>
        <div class="ccw-stat">
          <div class="ccw-stat-val">${d.txnCount}</div>
          <div class="ccw-stat-label">Movimientos</div>
        </div>
        <div class="ccw-stat">
          <div class="ccw-stat-val">${d.deltaPct!==0&&d.prevArs>0?(d.deltaPct>0?'+':'')+d.deltaPct.toFixed(1).replace('.',',')+'%':'—'}</div>
          <div class="ccw-stat-label">vs anterior</div>
        </div>
      </div>

      <div class="ccw-dates">
        <div class="ccw-date-pill"><span class="ccw-date-pill-icon">📅</span><div class="ccw-date-pill-copy"><span class="ccw-date-pill-label">Abre</span><span class="ccw-date-pill-val">${_ccwFmt(d.openYmd)}</span></div></div>
        <div class="ccw-date-pill"><span class="ccw-date-pill-icon">🔒</span><div class="ccw-date-pill-copy"><span class="ccw-date-pill-label">Cierra</span><span class="ccw-date-pill-val">${_ccwFmt(d.closeYmd)}</span></div></div>
        ${d.dueYmd?'<div class="ccw-date-pill"><span class="ccw-date-pill-icon">⏰</span><div class="ccw-date-pill-copy"><span class="ccw-date-pill-label">Vence</span><span class="ccw-date-pill-val">'+_ccwFmt(d.dueYmd)+'</span></div></div>':''}
      </div>

      ${insightHtml}
    </div>`;
}

function _ccwRenderCompareCard(d){
  if(!d) return '';
  const k = d.key;
  const masked = isMasked();
  const isEmpty = d.arsTotal === 0 && d.usdTotal === 0;
  const insight = d.deltaPct!==0 && d.prevArs>0
    ? `<strong>${Math.abs(d.deltaPct).toFixed(1).replace('.',',')}%</strong> ${d.deltaPct>0?'más':'menos'} vs anterior`
    : (d.lastTxnAgo ? `Último consumo <strong>${d.lastTxnAgo}</strong>` : '');

  return `
    <div class="ccw-compare-card ${k==='amex'?'is-amex':''} ${isEmpty?'is-empty':''}">
      <div class="ccw-compare-top">
        <div class="ccw-compare-logo ${k}">${k.toUpperCase()}</div>
        <div style="flex:1;min-width:0;">
          <div class="ccw-compare-name">Santander ${k.toUpperCase()}</div>
          <div class="ccw-compare-amt">${masked?'••••••••':(isEmpty?'Sin consumos':'$'+fmtN(Math.round(d.arsTotal)))}</div>
          ${d.usdTotal>0?'<div class="ccw-compare-usd">'+(masked?'••••':'U$D '+fmtN(d.usdTotal))+'</div>':''}
        </div>
      </div>
      <div class="ccw-compare-bar"><div class="ccw-compare-bar-fill ${k}" style="width:0%" id="ccw-bar-${k}"></div></div>
      <div class="ccw-compare-meta">
        <span class="ccw-compare-days">${d.daysLeft} día${d.daysLeft!==1?'s':''} restantes</span>
        <span class="ccw-compare-close">Cierra ${_ccwFmt(d.closeYmd)}</span>
      </div>
      ${insight?'<div class="ccw-compare-insight">'+insight+'</div>':''}
    </div>`;
}

function renderDb2CcCycles(data){
  const el = document.getElementById('db2-cc-smart-content');
  if(!el) return;

  const visa = _ccwGetCardData('visa', data);
  const amex = _ccwGetCardData('amex', data);
  const hasVisa = visa && visa.arsTotal > 0;
  const hasAmex = amex && amex.arsTotal > 0;

  // Determine mode: Focus only when one card has 100% of spend
  const focusCard = (hasVisa && !hasAmex) ? visa
                  : (hasAmex && !hasVisa) ? amex
                  : null;
  const isFocus = !!focusCard;

  const headerHtml = `
    <div class="ccw-hd">
      <div class="ccw-hd-left">
        <div class="ccw-hd-icon"><svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/></svg></div>
        <span class="ccw-title">${isFocus ? 'Tarjeta Principal' : 'Ciclo de Tarjetas'}</span>
        <span class="ccw-mode-badge ${isFocus?'focus':'compare'}">${isFocus?'Focus':'Comparar'}</span>
      </div>
      <button class="ccw-link" onclick="nav('credit-cards')">Ver detalle →</button>
    </div>`;

  if(isFocus){
    el.innerHTML = headerHtml + _ccwRenderFocus(focusCard);
  } else {
    el.innerHTML = headerHtml + `<div class="ccw-compare-grid">${_ccwRenderCompareCard(visa)}${_ccwRenderCompareCard(amex)}</div>`;
  }

  // Animate bars after DOM insert
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(visa){
      const vBar = document.getElementById('ccw-bar-visa');
      if(vBar) vBar.style.width = visa.pct + '%';
    }
    if(amex){
      const aBar = document.getElementById('ccw-bar-amex');
      if(aBar) aBar.style.width = amex.pct + '%';
    }
  }));
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
  const heroMasked = state.globalHide;

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
  if(heroEye) heroEye.classList.toggle('is-hidden', state.globalHide);
  
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
  _applyDb2CcPrivacy('visa', !!document.getElementById('kpi-visa-usd')?.textContent.trim());
  _applyDb2CcPrivacy('amex', !!document.getElementById('kpi-amex-usd')?.textContent.trim());
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
    'db2-cat-total'
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
  state.globalHide = !state.globalHide;
  state.hideHero = state.globalHide;
  saveState();
  renderDashboard();
  updateUsdRateUI();
}

function toggleGlobalPrivacy() {
  state.globalHide = !state.globalHide;
  state.hideHero = state.globalHide;
  saveState();
  renderDashboard();
  updateUsdRateUI();
}

function _db2ToArsAmount(item){
  return ((item?.currency || 'ARS') === 'USD'
    ? (Number(item?.amount) || 0) * (USD_TO_ARS || 1420)
    : (Number(item?.amount) || 0));
}

function _db2ShortMonthLabel(monthKey){
  const [year,month]=String(monthKey||'').split('-').map(Number);
  if(!year || !month) return '—';
  return new Date(year,month-1,1).toLocaleDateString('es-AR',{month:'short'}).replace('.','');
}

function _db2CycleIncomeMonth(cycle, cycles){
  if(!cycle) return '';
  const idx=Array.isArray(cycles)?cycles.findIndex(item=>item.id===cycle.id):-1;
  return getTcCycleOpen(cycles||[], idx)?.slice(0,7) || cycle.closeDate?.slice(0,7) || '';
}

function _db2BuildMonthExpenseEntries(monthKey){
  const base=(state.transactions||[]).filter(t=>
    (t.month||getMonthKey(t.date))===monthKey &&
    !t.isPendingCuota &&
    !t.isPendingSubscription
  );
  const [year,month]=String(monthKey||'').split('-').map(Number);
  if(!year || !month) return base;
  const lastDay=new Date(year,month,0).getDate();
  const projected=getProjectedCommitmentEntriesForRange({
    startStr:`${year}-${String(month).padStart(2,'0')}-01`,
    endStr:`${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`,
    todayRef:new Date(),
    txns:state.transactions||[]
  }).filter(entry=>entry.synthetic || entry.kind==='Cuota proyectada' || entry.kind==='Suscripción proyectada');
  return [...base, ...projected];
}

function _db2BuildCycleExpenseEntries(cycleMode, cycleId){
  const cycles=(typeof getTcCycles==='function'?getTcCycles(cycleMode):[]).slice().sort((a,b)=>a.closeDate.localeCompare(b.closeDate));
  const cycle=cycles.find(item=>item.id===cycleId) || cycles[cycles.length-1] || null;
  if(!cycle) return {cycle:null, cycles, entries:[]};
  if(typeof getTcCycleTrendTxns==='function'){
    return {cycle, cycles, entries:getTcCycleTrendTxns(cycle, cycles)};
  }
  return {cycle, cycles, entries:typeof getTcCycleTxns==='function'?getTcCycleTxns(cycle, cycles):[]};
}

function _db2BuildEvolutionDaySeries(scope){
  const isTc=scope?.mode==='tc';
  const labels=[];
  const expenseDaily=[];
  let incomeTotal=Number(scope?.totalIncomeArs)||0;
  let expenseEntries=[];
  let maxDay=0;
  let monthKey=scope?.monthKey || getMonthKey(new Date());

  if(isTc){
    const cycleScope=_db2BuildCycleExpenseEntries(scope?.cycleMode, scope?.cycleId);
    expenseEntries=cycleScope.entries || [];
    const cycle=cycleScope.cycle;
    if(cycle){
      const incomeMonth=_db2CycleIncomeMonth(cycle, cycleScope.cycles);
      incomeTotal=(getIncomeSnapshot(incomeMonth).total || incomeTotal);
      const openStr=_db2CycleIncomeMonth(cycle, cycleScope.cycles) ? getTcCycleOpen(cycleScope.cycles, cycleScope.cycles.findIndex(item=>item.id===cycle.id)) : null;
      const openDate=new Date((openStr || cycle.closeDate)+'T12:00:00');
      const closeDate=new Date(cycle.closeDate+'T12:00:00');
      maxDay=Math.max(1, Math.round((closeDate-openDate)/86400000)+1);
      const byDay=Array.from({length:maxDay},()=>0);
      expenseEntries.forEach(item=>{
        const dt=new Date(String(item.date).includes('T')?item.date:`${item.date}T12:00:00`);
        const idx=Math.round((dt-openDate)/86400000);
        if(idx>=0 && idx<maxDay) byDay[idx]+=_db2ToArsAmount(item);
      });
      let expenseAccum=0;
      for(let i=0;i<maxDay;i++){
        expenseAccum+=byDay[i]||0;
        expenseDaily.push(expenseAccum);
        labels.push(i===0 || i===maxDay-1 || i%3===0 ? `Día ${i+1}` : '');
      }
    }
  } else {
    expenseEntries=_db2BuildMonthExpenseEntries(monthKey);
    incomeTotal=(getIncomeSnapshot(monthKey).total || incomeTotal);
    const [year,month]=String(monthKey||'').split('-').map(Number);
    maxDay=year && month ? new Date(year,month,0).getDate() : 0;
    const byDay=Array.from({length:maxDay},()=>0);
    expenseEntries.forEach(item=>{
      const dt=new Date(String(item.date).includes('T')?item.date:`${item.date}T12:00:00`);
      if(dt.getFullYear()!==year || dt.getMonth()!==month-1) return;
      const idx=dt.getDate()-1;
      if(idx>=0 && idx<maxDay) byDay[idx]+=_db2ToArsAmount(item);
    });
    let expenseAccum=0;
    for(let i=0;i<maxDay;i++){
      expenseAccum+=byDay[i]||0;
      expenseDaily.push(expenseAccum);
      labels.push(i===0 || i===maxDay-1 || (i+1)%3===0 ? `${i+1} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][month-1]}` : '');
    }
  }

  const finalExpense=expenseDaily[expenseDaily.length-1] || 0;
  const totalExpense=Number(scope?.totalExpenseArs);
  if(Number.isFinite(totalExpense) && Math.abs(totalExpense-finalExpense) > 0.5 && expenseDaily.length){
    expenseDaily[expenseDaily.length-1]=totalExpense;
  }
  const remainingIncome=expenseDaily.map(value=>Math.max(incomeTotal - value, 0));
  return {
    labels,
    expenseData:expenseDaily,
    incomeData:remainingIncome,
    totalIncome:incomeTotal,
    totalExpense:Number.isFinite(totalExpense)?totalExpense:(expenseDaily[expenseDaily.length-1]||0)
  };
}

function _db2BuildEvolutionPeriodSeries(scope){
  if(scope?.mode==='tc'){
    const cycles=(typeof getTcCycles==='function'?getTcCycles(scope.cycleMode):[]).slice().sort((a,b)=>a.closeDate.localeCompare(b.closeDate));
    const selectedIdx=cycles.findIndex(item=>item.id===scope.cycleId);
    const endIdx=selectedIdx>=0?selectedIdx:Math.max(cycles.length-1,0);
    const slice=(endIdx>=0?cycles.slice(Math.max(0,endIdx-5), endIdx+1):cycles.slice(-6));
    return {
      labels:slice.map(cycle=>cleanHeroCycleLabel(cycle.label||cycle.closeDate)),
      expenseData:slice.map(cycle=>{
        const cycleScope=_db2BuildCycleExpenseEntries(scope.cycleMode, cycle.id);
        return (cycleScope.entries||[]).reduce((sum,item)=>sum+_db2ToArsAmount(item),0);
      }),
      incomeData:slice.map(cycle=>getIncomeSnapshot(_db2CycleIncomeMonth(cycle, cycles)).total || 0),
      subtitle:'Últimos ciclos · gasto vs ingreso'
    };
  }

  const currentMonth=scope?.monthKey || getMonthKey(new Date());
  const txMonths=(state.transactions||[]).map(t=>t.month||getMonthKey(t.date));
  const incomeMonths=(state.incomeMonths||[]).map(item=>item.month);
  const monthKeys=[...new Set([...txMonths, ...incomeMonths, currentMonth])].filter(Boolean).sort();
  return {
    labels:monthKeys.map(_db2ShortMonthLabel),
    expenseData:monthKeys.map(monthKey=>_db2BuildMonthExpenseEntries(monthKey).reduce((sum,item)=>sum+_db2ToArsAmount(item),0)),
    incomeData:monthKeys.map(monthKey=>getIncomeSnapshot(monthKey).total || 0),
    subtitle:'Todos los meses · gasto vs ingreso'
  };
}

// ── Evolution line chart ──
function renderDb2EvolutionChart(){
  const ctx = document.getElementById('chart-evolution');
  if(!ctx) return;

  if(state.charts && state.charts.evolution){ state.charts.evolution.destroy(); state.charts.evolution = null; }
  const scope=_db2EvolutionState || {
    mode: normalizeViewMode(state.dashView||'visa')!=='mes' ? 'tc' : 'mes',
    monthKey:getActiveDashMonth(),
    cycleMode:normalizeViewMode(state.dashView||'visa'),
    cycleId:state.dashTcCycle||null,
    totalExpenseArs:0,
    totalIncomeArs:0
  };
  const titleEl=document.querySelector('.db2-evo-heading .db2-title');
  const subTitleEl=document.querySelector('.db2-evo-heading .db2-evo-sub');

  // Update legend totals
  const evoIng = document.getElementById('db2-evo-ingresos');
  const evoGas = document.getElementById('db2-evo-gastos');
  const useMonthMode = db2EvoMode === 'month';
  const series = useMonthMode ? _db2BuildEvolutionPeriodSeries(scope) : _db2BuildEvolutionDaySeries(scope);
  const labels = series.labels || [];
  const gasData = series.expenseData || [];
  const incData = series.incomeData || [];
  const totalGastos = Number(scope?.totalExpenseArs) || (gasData[gasData.length-1] || 0);
  const totalIngresos = Number(scope?.totalIncomeArs) || (useMonthMode ? Math.max(...incData,0) : (series.totalIncome || 0));
  if(evoIng) evoIng.textContent = isMasked() ? '••••••••' : '$' + fmtN(Math.round(totalIngresos));
  if(evoGas) evoGas.textContent = isMasked() ? '••••••••' : '$' + fmtN(Math.round(totalGastos));

  // Compute 12-month averages
  const evoAvgInc = document.getElementById('db2-evo-avg-income');
  const evoAvgExp = document.getElementById('db2-evo-avg-expense');
  if(evoAvgInc || evoAvgExp){
    const now = new Date();
    const monthlyInc = {};
    const monthlyExp = {};
    (state.transactions||[]).forEach(t=>{
      if(!t.date || t.currency !== 'ARS') return;
      const d = t.date instanceof Date ? t.date : new Date(String(t.date).includes('T') ? t.date : (String(t.date)+'T12:00:00'));
      if(isNaN(d.getTime())) return;
      const diffMs = now - d;
      if(diffMs < 0 || diffMs > 365.25*86400000) return;
      const mk = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      const amt = typeof getTxnPersonalAmount==='function' ? getTxnPersonalAmount(t) : t.amount;
      if(t.isIncome || t.type==='income'){
        monthlyInc[mk] = (monthlyInc[mk]||0) + (amt||0);
      } else if(amt > 0){
        monthlyExp[mk] = (monthlyExp[mk]||0) + (amt||0);
      }
    });
    const incMonths = Object.keys(monthlyInc);
    const expMonths = Object.keys(monthlyExp);
    const avgInc = incMonths.length ? incMonths.reduce((s,k)=>s+monthlyInc[k],0) / incMonths.length : 0;
    const avgExp = expMonths.length ? expMonths.reduce((s,k)=>s+monthlyExp[k],0) / expMonths.length : 0;
    if(evoAvgInc) evoAvgInc.textContent = isMasked() ? '••••••••' : '$' + fmtN(Math.round(avgInc));
    if(evoAvgExp) evoAvgExp.textContent = isMasked() ? '••••••••' : '$' + fmtN(Math.round(avgExp));
  }
  if(titleEl) titleEl.textContent = useMonthMode ? 'Evolución por período' : 'Evolución del período';
  if(subTitleEl){
    subTitleEl.textContent = useMonthMode
      ? (series.subtitle || 'Gasto vs ingreso')
      : (scope.mode==='tc' ? 'Ingreso restante vs gasto acumulado del ciclo' : 'Ingreso restante vs gasto acumulado del período');
  }

  const maxValue = Math.max(...incData, ...gasData, 0);
  const yMax = Math.max(200000, Math.ceil(maxValue / 50000) * 50000);
  const gridColor = 'rgba(197, 206, 231, 0.7)';
  const tickColor = '#77819d';
  const tickFont  = {size:12, weight:'600', family:'-apple-system,SF Pro Display,sans-serif'};

  const chart = new Chart(ctx, {
    type: useMonthMode ? 'bar' : 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: incData,
          borderColor: '#56c683',
          backgroundColor: useMonthMode ? 'rgba(86,198,131,0.82)' : 'rgba(86,198,131,0.16)',
          borderWidth: useMonthMode ? 1.5 : 4,
          pointRadius: useMonthMode ? 0 : 7,
          pointHoverRadius: useMonthMode ? 0 : 7,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#56c683',
          pointBorderWidth: useMonthMode ? 0 : 4,
          tension: useMonthMode ? 0 : 0.42,
          fill: !useMonthMode,
          borderRadius: useMonthMode ? 10 : 0,
          maxBarThickness: useMonthMode ? 28 : undefined,
          categoryPercentage: useMonthMode ? 0.7 : undefined,
          barPercentage: useMonthMode ? 0.84 : undefined
        },
        {
          label: 'Gastos',
          data: gasData,
          borderColor: '#f36a2b',
          backgroundColor: useMonthMode ? 'rgba(243,106,43,0.82)' : 'rgba(243,106,43,0.16)',
          borderWidth: useMonthMode ? 1.5 : 4,
          pointRadius: useMonthMode ? 0 : 7,
          pointHoverRadius: useMonthMode ? 0 : 7,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#f36a2b',
          pointBorderWidth: useMonthMode ? 0 : 4,
          tension: useMonthMode ? 0 : 0.42,
          fill: !useMonthMode,
          borderRadius: useMonthMode ? 10 : 0,
          maxBarThickness: useMonthMode ? 28 : undefined,
          categoryPercentage: useMonthMode ? 0.7 : undefined,
          barPercentage: useMonthMode ? 0.84 : undefined
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
          ticks: {
            color: tickColor,
            font: tickFont,
            maxRotation: 0,
            minRotation: 0,
            padding: useMonthMode ? 10 : 16,
            autoSkip: false
          },
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
      const remaining = totalIngresos - totalGastos;
      const remainingPct = totalIngresos > 0 ? Math.round(Math.abs(remaining) / totalIngresos * 100) : 0;
      const copy = remaining < 0
        ? `El gasto va <b>${remainingPct}%</b> por encima del ingreso del período.`
        : `Te queda <b>${remainingPct}%</b> del ingreso del período antes de agotarlo.`;
      insightEl.innerHTML = `<span class="db2-evo-insight-icon"><svg viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.44 1 1.08 1 1.8V17h6v-.5c0-.72.4-1.36 1-1.8A7 7 0 0 0 12 2Z"/></svg></span><span>${copy}</span>`;
      insightEl.style.display = 'flex';
    } else {
      insightEl.style.display = 'none';
    }
  }
}

// ── Categories donut ──
let _db2CatView = 'groups';
function setDb2CatView(view){
  _db2CatView = view;
  document.querySelectorAll('.db2-cat-view-btn').forEach(b => b.classList.toggle('active', b.id === 'db2-cat-view-'+view));
  renderDb2CatDonut();
}

function _db2CatBuildData(txns, view){
  const grouped = {};
  if(view === 'tags'){
    txns.filter(t => t.currency === 'ARS' && t.tags && t.tags.length).forEach(t => {
      const _pa = typeof getTxnPersonalAmount==='function' ? getTxnPersonalAmount(t) : t.amount;
      (t.tags||[]).forEach(tag => {
        if(!grouped[tag]) grouped[tag] = {total:0, color: typeof _tagColor==='function' ? _tagColor(tag) : '#6C5CE7'};
        grouped[tag].total += _pa;
      });
    });
  } else {
    txns.filter(t => t.currency === 'ARS' && t.category && t.category !== 'Procesando...' && t.category !== 'Uncategorized').forEach(t => {
      const _pa = typeof getTxnPersonalAmount==='function' ? getTxnPersonalAmount(t) : t.amount;
      if(view === 'subs'){
        const key = t.category;
        if(!grouped[key]) grouped[key] = {total:0, color: typeof catColor==='function' ? catColor(key) : '#666'};
        grouped[key].total += _pa;
      } else {
        const parent = typeof catGroup==='function' ? catGroup(t.category) : t.category;
        if(!grouped[parent]) grouped[parent] = {total:0, color: typeof catColor==='function' ? catColor(t.category) : '#666'};
        grouped[parent].total += _pa;
      }
    });
  }
  return grouped;
}

function renderDb2CatDonut(monthTxns){
  const ctx = document.getElementById('chart-cat-donut');
  if(!ctx) return;
  if(state.charts && state.charts.catDonut){ state.charts.catDonut.destroy(); state.charts.catDonut = null; }

  const txns = monthTxns || getCurrentMonthTxns();
  const grouped = _db2CatBuildData(txns, _db2CatView);

  const allSorted = Object.entries(grouped).filter(([,d]) => d.total > 0).sort((a,b) => b[1].total - a[1].total);
  const sorted = allSorted.slice(0,8);
  const total = allSorted.reduce((s,[,d]) => s + d.total, 0);
  const activeMonthKey=typeof getActiveDashMonth==='function'?getActiveDashMonth():getMonthKey(new Date());
  const [catYear,catMonth]=String(activeMonthKey||'').split('-').map(Number);
  const catMonthEl=document.getElementById('db2-cat-month');
  if(catMonthEl && catYear && catMonth){
    const dt=new Date(catYear,catMonth-1,1);
    catMonthEl.textContent=dt.toLocaleDateString('es-AR',{month:'long',year:'numeric'}).toUpperCase();
  }

  const viewTitles = {groups:'Categorías del Mes', subs:'Subcategorías del Mes', tags:'Tags del Mes'};
  const catTitleEl = document.querySelector('.db2-cat-card .db2-title');
  if(catTitleEl) catTitleEl.textContent = viewTitles[_db2CatView] || viewTitles.groups;

  const donutLblEl = document.querySelector('.db2-cat-donut-lbl');
  if(donutLblEl) donutLblEl.textContent = _db2CatView === 'tags' ? 'TAGS' : 'TOTAL';

  // Update donut total label
  const totalEl = document.getElementById('db2-cat-total');
  if(totalEl) {
    if(isMasked()) totalEl.textContent = '••••••••';
    else totalEl.textContent = total > 0 ? '$' + fmtN(Math.round(total)) : '—';
  }

  const emptyMsgs = {groups:'Sin gastos categorizados', subs:'Sin gastos categorizados', tags:'Sin tags asignados'};
  if(!sorted.length){
    const listEl = document.getElementById('db2-cat-list');
    if(listEl) listEl.innerHTML = '<div style="font-size:12px;color:var(--text3)">'+(emptyMsgs[_db2CatView]||emptyMsgs.groups)+'</div>';
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

  // Category / Sub / Tag list
  const listEl = document.getElementById('db2-cat-list');
  if(listEl){
    listEl.innerHTML = sorted.slice(0,5).map(([name,d],i) => {
      const pct = total > 0 ? Math.round(d.total/total*100) : 0;
      const color = colors[i];
      const tone = getCategoryTone(i);
      if(_db2CatView === 'tags'){
        const tc = typeof _tagColor==='function' ? _tagColor(name) : color;
        return `<div class="db2-cat-item ${i===0?'is-top':''}">
          <div class="db2-cat-iconbox" style="background:${tc}18;color:${tc}">
            <svg viewBox="0 0 24 24"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>
          </div>
          <div class="db2-cat-copy">
            <span class="db2-cat-name">${esc(name)}</span>
            <span class="db2-cat-amt">${isMasked() ? '••••••••' : '$' + fmtN(Math.round(d.total))}</span>
          </div>
          <span class="db2-cat-pct" style="color:${tc}">${pct}%</span>
        </div>`;
      }
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

  // Bottom note — month-over-month comparison
  const noteEl = document.getElementById('db2-cat-note');
  if(noteEl){
    const prevTxns = typeof getTxnsFor==='function'
      ? getTxnsFor(getMonthKey(new Date(catYear, (catMonth||1)-2, 1)))
      : [];
    const prevGrouped = _db2CatBuildData(prevTxns||[], _db2CatView);
    const prevTotal = Object.values(prevGrouped).reduce((s,d)=>s+d.total,0);
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

  // ── New shared-expense system: items per split (per-person) ──
  // Build BOTH pending and cobrado lists so the pills can act as filter tabs.
  const buildItems = (statusFilter) => (state.transactions || [])
    .filter(t => t.sharedExpense && t.sharedExpense.enabled && !t.isPendingCuota && !t.isPendingSubscription)
    .flatMap(t => {
      const splits = t.sharedExpense.splits || [];
      return splits
        .filter(s => statusFilter(s.status))
        .map(s => {
          const splitAmt = Number(s.amount) || 0;
          return {
            id: t.id + '-' + s.id,
            txnId: t.id,
            name: (s.name || '').trim() || '(sin nombre)',
            txnDesc: t.description || 'Gasto compartido',
            date: dateToYMD(t.date),
            currency: t.currency || 'ARS',
            pendingAmount: splitAmt,
            recoveredAmount: s.status === 'cobrado' ? splitAmt : 0,
            recoverBase: splitAmt,
            status: s.status === 'cobrado' ? 'cobrado' : 'pending',
            pendingArs: toArs(splitAmt, t.currency),
            totalArs: toArs(splitAmt, t.currency)
          };
        });
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const pendingItems = buildItems(status => status !== 'cobrado');
  const cobradoItems = buildItems(status => status === 'cobrado');

  const totalOpenArs = pendingItems.reduce((s, item) => s + item.pendingArs, 0);
  const totalCobradoArs = cobradoItems.reduce((s, item) => s + item.pendingArs, 0);
  const pendingCount = pendingItems.length;
  const cobradoCount = cobradoItems.length;

  // Active view: 'pending' (default) or 'cobrado'
  if (!state._dueStripView) state._dueStripView = 'pending';
  // Auto-fallback: if user is on pending view but there's nothing pending, stay on pending
  // (empty state will display). If on cobrado but no cobrado items, switch back to pending.
  if (state._dueStripView === 'cobrado' && cobradoCount === 0 && pendingCount > 0) {
    state._dueStripView = 'pending';
  }
  const activeView = state._dueStripView;

  if(summary){
    if (pendingCount === 0 && cobradoCount === 0) {
      summary.innerHTML = `
        <div class="db2-third-pill is-ok">
          <span class="db2-third-pill-label">Estado</span>
          <span class="db2-third-pill-value">Sin gastos compartidos</span>
        </div>`;
    } else {
      const maskedPending = isMasked() ? '$••••••' : `$${fmtN(Math.round(totalOpenArs))}`;
      const maskedCobrado = isMasked() ? '$••••••' : `$${fmtN(Math.round(totalCobradoArs))}`;
      summary.innerHTML = `
        <button type="button" class="db2-third-pill is-clickable${activeView === 'pending' ? ' is-active' : ''}" onclick="setDueStripView('pending')" title="Ver pendientes">
          <span class="db2-third-pill-label">Por cobrar</span>
          <span class="db2-third-pill-value">${maskedPending}</span>
        </button>
        <div class="db2-third-pill">
          <span class="db2-third-pill-label">Pendientes</span>
          <span class="db2-third-pill-value">${pendingCount}</span>
        </div>
        ${cobradoCount > 0 ? `
        <button type="button" class="db2-third-pill is-cobrado is-clickable${activeView === 'cobrado' ? ' is-active' : ''}" onclick="setDueStripView('cobrado')" title="Ver cobrados">
          <span class="db2-third-pill-label">Cobrado</span>
          <span class="db2-third-pill-value">$${fmtN(Math.round(totalCobradoArs))}</span>
        </button>` : ''}
      `;
    }
  }

  // Pick which list to render based on the active view
  const itemsToRender = activeView === 'cobrado' ? cobradoItems : pendingItems;
  const isCobradoView = activeView === 'cobrado';

  if (!itemsToRender.length) {
    grid.innerHTML = `
      <div class="db2-third-empty">
        ${isCobradoView
          ? 'Todavía no marcaste ninguna parte como cobrada. Cuando lo hagas, aparece acá.'
          : 'No tenés gastos compartidos pendientes. Cuando dividas un gasto en Movimientos, aparece acá como recordatorio.'}
      </div>`;
    return;
  }

  // ── Group items by person (same name = same person) ──
  // If a person owes/paid from multiple txns, group them under one card.
  // Click expands to show the breakdown of each individual transaction.
  const groupedByPerson = new Map();
  itemsToRender.forEach(item => {
    const key = item.name.toLowerCase().trim();
    if (!groupedByPerson.has(key)) {
      groupedByPerson.set(key, {
        name: item.name,
        items: [],
        totalArs: 0,
        // We track per-currency totals so the display can be honest
        // when amounts span ARS and USD.
        totalsByCurrency: {}
      });
    }
    const g = groupedByPerson.get(key);
    g.items.push(item);
    g.totalArs += item.pendingArs;
    const cur = item.currency || 'ARS';
    g.totalsByCurrency[cur] = (g.totalsByCurrency[cur] || 0) + (Number(item.pendingAmount) || 0);
  });
  const personGroups = Array.from(groupedByPerson.values())
    .sort((a, b) => b.totalArs - a.totalArs);

  // Track which person rows are expanded — persist across re-renders
  if (!state._dueStripExpanded) state._dueStripExpanded = {};

  // Helper: render currency totals for a person ("$50.000  +  USD 30")
  const formatPersonTotal = g => {
    const parts = Object.entries(g.totalsByCurrency)
      .filter(([, v]) => v > 0)
      .map(([cur, v]) => isMasked()
        ? (cur === 'USD' ? 'U$D ••••' : '$••••••')
        : toDisplayAmount(v, cur));
    return parts.join('  +  ') || '—';
  };

  const VISIBLE_LIMIT = 9;
  const visiblePersons = personGroups.slice(0, VISIBLE_LIMIT);

  grid.innerHTML = visiblePersons.map((g, i) => {
    const color = palette[i % palette.length];
    const itemClass = isCobradoView ? 'cobrado' : 'pending';
    const personKey = g.name.toLowerCase().trim() + '::' + activeView;
    const isExpanded = !!state._dueStripExpanded[personKey];
    const totalDisplay = formatPersonTotal(g);
    const txnCount = g.items.length;
    const metaLabel = isCobradoView ? 'cobrado' : 'pendiente';
    const metaText = txnCount === 1
      ? `${esc(g.items[0].txnDesc)}`
      : `${txnCount} movimientos · ${metaLabel}${txnCount !== 1 ? 's' : ''}`;

    // Breakdown rows (only rendered when expanded)
    const breakdown = isExpanded
      ? `<div class="db2-third-breakdown">${g.items.map(item => `
          <button class="db2-third-bd-row" onclick="event.stopPropagation();openTxnDetail('${item.txnId}')" title="Ver gasto compartido">
            <div class="db2-third-bd-info">
              <div class="db2-third-bd-desc">${esc(item.txnDesc)}</div>
              <div class="db2-third-bd-date">${shortDate(item.date)} · ${getAgeLabel(item.date)}</div>
            </div>
            <div class="db2-third-bd-amount">${isMasked() ? (item.currency === 'USD' ? 'U$D ••••' : '$••••••') : toDisplayAmount(item.pendingAmount, item.currency)}</div>
          </button>`).join('')}</div>`
      : '';

    return `<div class="db2-third-item-wrap">
      <button class="db2-third-item ${itemClass} ${isExpanded ? 'is-expanded' : ''}" onclick="toggleDueStripPerson('${personKey}')" title="${txnCount > 1 ? 'Click para ver el desglose' : 'Click para expandir'}">
        <div class="db2-third-avatar" style="background:${color}">${initials(g.name)}</div>
        <div class="db2-third-body">
          <div class="db2-third-name">${esc(g.name)}</div>
          <div class="db2-third-meta">${metaText}</div>
        </div>
        <div class="db2-third-amount">${totalDisplay}</div>
        <div class="db2-third-chip">${txnCount > 1 ? `${txnCount} ${isExpanded ? '▴' : '▾'}` : ''}</div>
      </button>
      ${breakdown}
    </div>`;
  }).join('');

  if (personGroups.length > VISIBLE_LIMIT) {
    const remaining = personGroups.length - VISIBLE_LIMIT;
    grid.innerHTML += `
      <button class="db2-third-more" onclick="openThirdPartyTransactions()">
        Ver ${remaining} persona${remaining !== 1 ? 's' : ''} más →
      </button>`;
  }
}

// Toggle expand/collapse of a person row in the Gastos Compartidos widget
function toggleDueStripPerson(personKey){
  if (!state._dueStripExpanded) state._dueStripExpanded = {};
  state._dueStripExpanded[personKey] = !state._dueStripExpanded[personKey];
  // No saveState — this is UI-only ephemeral state. Re-render the widget.
  if (typeof renderDashboard === 'function') renderDashboard();
}

// Toggle view in the dashboard "Gastos Compartidos" widget
function setDueStripView(view){
  state._dueStripView = view === 'cobrado' ? 'cobrado' : 'pending';
  saveState();
  // Re-render just this widget — the calling context provides the data.
  // The cheapest reliable path is to re-render the whole dashboard.
  if(typeof renderDashboard === 'function') renderDashboard();
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
  _db2EvolutionState = data.evolutionData || null;
  renderDb2HeroExtras(data.arsMonth, data.usdMonth, data.margen, data.pct, data.incTotalARS, data.spendBudget, data.thirdPartyTxns);
  renderDb2CcCycles(data.ccWidgetData);
  renderDb2ProjExtras(data.projected, data.totalGastoARS, data.incTotalARS, data.spendBudget, data.daysLeft, data.dailyRate, data.projPeriodClose);
  renderDb2Agenda(data.timelineData);
  renderDb2EvolutionChart();
  renderDb2CatDonut(data.monthTxns);
  renderDb2DueStrip(data.timelineData);
  renderDb2DollarSparkline();
  enforceDashboardPrivacyMask();
  renderMobileDashboard(data);
}

// ── Mobile Dashboard — rendered on mobile only (max-width:768px) ──
function renderMobileDashboard(data) {
  const shell = document.getElementById('mob-dash-shell');
  if (!shell || window.innerWidth > 768) return;

  const {
    arsMonth=0, usdMonth=0, margen=0, pct=0, incTotalARS=0, spendBudget=0,
    projected=0, projPeriodClose=null, monthTxns=[], ccWidgetData={},
    dailyRate=0, totalGastoARS=0
  } = data || {};

  // Helpers
  const fmtN = (n) => Number(n||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const fmtAmt = (n, prefix='$') => `${prefix}${fmtN(n)}`;
  // fmtDate handles both 'YYYY-MM-DD' strings AND Date objects
  const fmtDate = (val) => {
    if (!val) return '—';
    try {
      const d = (val instanceof Date) ? val : new Date(val+'T12:00:00');
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('es-AR',{day:'2-digit',month:'short'}).replace(/\./g,'').toUpperCase();
    } catch(e){return '—';}
  };

  // Period label — reflects actual selected view (TC cycle or month)
  const today = new Date();
  const _MN=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  const _isTcView = typeof state!=='undefined' && state.dashView && state.dashView !== 'mes';
  let periodLabel;
  if (_isTcView) {
    // Get the active cycle label
    try {
      const _cycles = typeof getTcCycles==='function' ? getTcCycles() : [];
      const _actCyc = typeof _resolveDashboardTcCycle==='function' ? _resolveDashboardTcCycle(_cycles) : _cycles[0];
      periodLabel = _actCyc?.label ? ('CICLO ' + (_actCyc.label||'').toUpperCase()) : 'CICLO VISA';
    } catch(e){ periodLabel = 'CICLO VISA'; }
  } else {
    periodLabel = _MN[today.getMonth()] + ' ' + today.getFullYear();
  }

  // Daily average (spending per elapsed day in the period)
  const _daysElapsed = _isTcView
    ? (() => {
        try {
          const _cycles = typeof getTcCycles==='function' ? getTcCycles() : [];
          const _actCyc = typeof _resolveDashboardTcCycle==='function' ? _resolveDashboardTcCycle(_cycles) : null;
          if (!_actCyc) return today.getDate();
          const idx = _cycles.findIndex(c=>c.id===_actCyc.id);
          const openStr = typeof getTcCycleOpen==='function' ? getTcCycleOpen(_cycles, idx) : null;
          if (!openStr) return today.getDate();
          const diff = (today - new Date(openStr+'T12:00:00')) / 86400000;
          return Math.max(1, Math.round(diff));
        } catch(e){ return today.getDate(); }
      })()
    : today.getDate();
  const dailyAvg = _daysElapsed > 0 ? (totalGastoARS || arsMonth) / _daysElapsed : 0;

  // CC Cycles
  const cycleByKey = ccWidgetData?.cycleByKey || {};
  const visaCycle = cycleByKey.visa;
  const amexCycle = cycleByKey.amex;

  const ccPct = (cycle) => {
    if (!cycle) return 0;
    try {
      const allC = getTcCycles();
      const idx = allC.findIndex(c => c.id === cycle.id);
      const open = getTcCycleOpen(allC, idx);
      if (!open) return 0;
      const openD = new Date(open+'T12:00:00');
      const closeD = new Date(cycle.closeDate+'T12:00:00');
      const total = Math.max(1,(closeD-openD)/86400000);
      const elapsed = Math.max(0,(today-openD)/86400000);
      return Math.min(100,Math.round(elapsed/total*100));
    } catch(e){return 0;}
  };

  // Top categories
  const catTotalsM = {};
  (monthTxns||[]).filter(t=>t.currency==='ARS'&&!t.isPendingCuota&&!t.isPendingSubscription).forEach(t=>{
    const k=t.category||'Sin categoría';
    catTotalsM[k]=(catTotalsM[k]||0)+(typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):(t.amount||0));
  });
  const topCats = Object.entries(catTotalsM)
    .sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([name,amount])=>({name,amount,pct:arsMonth>0?Math.round(amount/arsMonth*100):0}));

  // Projection
  const projLimitArs = spendBudget||incTotalARS||0;
  const projPct = projLimitArs>0 ? Math.min(100,Math.round((projected||0)/projLimitArs*100)) : 0;

  // Totals display
  const totalDisplay = arsMonth + (usdMonth*(window.USD_TO_ARS||1));
  const margenPct = incTotalARS>0 ? Math.round((margen/incTotalARS)*100) : 0;

  // Mini-calendar data
  const calYear  = today.getFullYear();
  const calMonth = today.getMonth();
  const _calMN = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const firstDOW = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  // Always use real calendar-month transactions for the calendar widget
  // (monthTxns may be TC-period filtered, which can span a different month)
  const _calSourceTxns = (typeof state !== 'undefined' && state.transactions)
    ? state.transactions.filter(t => !t.isPendingCuota && !t.isPendingSubscription)
    : (monthTxns || []);
  // Map each calendar-month transaction to its day number
  const txnsByDay = {};
  _calSourceTxns.forEach(t => {
    if (!t.date) return;
    try {
      const d = new Date(t.date+'T12:00:00');
      if (d.getMonth()===calMonth && d.getFullYear()===calYear) {
        const dn = d.getDate();
        (txnsByDay[dn] = txnsByDay[dn]||[]).push(t);
      }
    } catch(e){}
  });
  // Store for tap handler (rebuilt each render, safe)
  window._mobCalTxns = txnsByDay;

  // Build calendar cells HTML
  const _calDOW = ['D','L','M','X','J','V','S'];
  let calCells = _calDOW.map(d=>`<div class="mob-cal-dow">${d}</div>`).join('');
  // Leading empty cells
  for (let i=0; i<firstDOW; i++) calCells += '<div class="mob-cal-empty"></div>';
  for (let d=1; d<=daysInMonth; d++) {
    const hasTxns = !!(txnsByDay[d]?.length);
    const isToday = (d===today.getDate());
    const cls = ['mob-cal-day', isToday?'mob-cal-today':'', hasTxns?'mob-cal-has-txn':''].filter(Boolean).join(' ');
    calCells += `<div class="${cls}" onclick="window._mobCalTap(${d})" role="button" tabindex="${hasTxns?0:-1}">
      <span class="mob-cal-dnum">${d}</span>
      ${hasTxns?'<div class="mob-cal-dot"></div>':''}
    </div>`;
  }

  // Category palette & icons
  const catPalette=['#7C4DFF','#247CFF','#FF4545','#FF9500','#28E878'];
  const catIconMap={'consumos sensibles':'🛍️','alimentación':'🍔','alimentos':'🍔','supermercado':'🛒','transporte':'🚗','uber':'🚗','taxi':'🚕','combustible':'⛽','salud':'🏥','farmacia':'💊','médico':'🩺','regalos':'🎁','sin clasificar':'📦','ocio':'🎬','entretenimiento':'🎮','servicios':'💡','educación':'📚','tecnología':'💻','ropa':'👕','restaurant':'🍽️','comida':'🍕','viajes':'✈️','hogar':'🏠','suscripciones':'📱','seguros':'🛡️'};
  const getCatIcon = (name) => {
    const k=(name||'').toLowerCase();
    for(const[kw,icon] of Object.entries(catIconMap)){if(k.includes(kw))return icon;}
    return '📦';
  };

  shell.innerHTML = `
    <div class="mob-dash-header">
      <button class="mob-dash-hamburger" onclick="openMobDrawer()" aria-label="Menú">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <img class="mob-brand-logo-img" src="brand/fluxen-logo.png" alt="Fluxen">
      <div class="mob-dash-hdr-right"></div>
    </div>

    <button class="mob-dash-period" onclick="openMobPeriodPicker()" aria-label="Cambiar período">
      <span>${periodLabel}</span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
    </button>

    <div class="mob-main-card" onclick="nav('transactions')" style="cursor:pointer">
      <div class="mob-main-card-top">
        <div class="mob-main-icon-row">
          <div class="mob-main-icon-sq">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="13" rx="3"/><path d="M2.5 10.5h19"/></svg>
          </div>
          <span class="mob-main-kicker">GASTO PERSONAL</span>
        </div>
        <button class="mob-main-eye" onclick="event.stopPropagation();toggleHeroPrivacy()" title="Ocultar montos">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
      <div class="mob-main-amount" id="mob-main-amount">${fmtAmt(totalDisplay)}</div>
      ${pct>0?`<div class="mob-main-budget-badge">${pct}% del presupuesto</div>`:''}
      <div class="mob-main-curve-wrap" aria-hidden="true">
        <svg class="mob-main-curve-svg" viewBox="0 0 160 70" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 50 C40 50 60 15 100 25 S140 8 160 18" stroke="rgba(124,77,255,0.55)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <path d="M0 58 C40 58 60 23 100 33 S140 16 160 26" stroke="rgba(124,77,255,0.2)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <circle cx="160" cy="18" r="4" fill="#7C4DFF" opacity="0.8"/>
        </svg>
      </div>
      <div class="mob-main-rows">
        <div class="mob-main-row" onclick="event.stopPropagation();nav('transactions')">
          <div class="mob-row-icon-sq" style="background:rgba(124,77,255,0.15);color:#7C4DFF;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/></svg>
          </div>
          <span class="mob-row-label">Total en ARS</span>
          <span class="mob-row-val">${fmtAmt(arsMonth)}</span>
          <svg class="mob-row-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="mob-row-sep"></div>
        <div class="mob-main-row" onclick="event.stopPropagation();nav('transactions')">
          <div class="mob-row-icon-sq" style="background:rgba(36,124,255,0.15);color:#247CFF;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M9.5 9.5h4a2 2 0 1 1 0 4h-3a2 2 0 1 0 0 4h4"/></svg>
          </div>
          <span class="mob-row-label">Total en USD</span>
          <span class="mob-row-val">${usdMonth>0?fmtAmt(usdMonth,'U$D '):'USD 0,00'}</span>
          <svg class="mob-row-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="mob-row-sep"></div>
        <div class="mob-main-row" onclick="event.stopPropagation();nav('income')">
          <div class="mob-row-icon-sq" style="background:rgba(40,232,120,0.15);color:#28E878;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7h-1a2 2 0 0 0-2 2v1H8.5A2.5 2.5 0 0 0 6 12.5v4A2.5 2.5 0 0 0 8.5 19H17a3 3 0 0 0 3-3V9a2 2 0 0 0-2-2Z"/><path d="M16 12h4"/><path d="M6 10V8a3 3 0 0 1 3-3h7"/></svg>
          </div>
          <span class="mob-row-label">Margen disponible</span>
          <span class="mob-row-val" style="color:#28E878;">${fmtAmt(margen)}</span>
          ${margenPct>0?`<span class="mob-margen-badge">${margenPct}% del presupuesto</span>`:''}
          <svg class="mob-row-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>
    </div>

    <div class="mob-section-card">
      <div class="mob-sec-hd">
        <span class="mob-sec-title">CICLO DE TARJETAS</span>
      </div>
      <div class="mob-cc-grid">
        <div class="mob-cc-item mob-cc-visa-item">
          <div class="mob-cc-brand-label">VISA</div>
          <div class="mob-cc-date-pair">
            <div class="mob-cc-dp"><span class="mob-cc-dl">Cierre</span><strong class="mob-cc-dv">${fmtDate(visaCycle?.closeDate)}</strong></div>
            <div class="mob-cc-dp"><span class="mob-cc-dl">Vence</span><strong class="mob-cc-dv">${fmtDate(visaCycle?.dueDate)}</strong></div>
          </div>
          <div class="mob-cc-bar-track"><div class="mob-cc-bar-fill mob-cc-bar-visa" style="width:${ccPct(visaCycle)}%"></div></div>
        </div>
        <div class="mob-cc-item mob-cc-amex-item">
          <div class="mob-cc-brand-label mob-cc-brand-amex">AMEX</div>
          <div class="mob-cc-date-pair">
            <div class="mob-cc-dp"><span class="mob-cc-dl">Cierre</span><strong class="mob-cc-dv">${fmtDate(amexCycle?.closeDate)}</strong></div>
            <div class="mob-cc-dp"><span class="mob-cc-dl">Vence</span><strong class="mob-cc-dv">${fmtDate(amexCycle?.dueDate)}</strong></div>
          </div>
          <div class="mob-cc-bar-track"><div class="mob-cc-bar-fill mob-cc-bar-amex" style="width:${ccPct(amexCycle)}%"></div></div>
        </div>
      </div>
    </div>

    ${projected>0?`
    <div class="mob-section-card mob-proj-card">
      <div class="mob-proj-body">
        <div class="mob-proj-left">
          <div class="mob-proj-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16 10 10l4 4 6-8"/><path d="M20 6v4h-4"/></svg>
          </div>
          <div class="mob-proj-info">
            <div class="mob-proj-kicker">PROYECCIÓN A CIERRE</div>
            <div class="mob-proj-amount">${fmtAmt(projected)}</div>
            <div class="mob-proj-sub">Estimación activa hasta ${fmtDate(projPeriodClose)}</div>
            ${dailyAvg>0?`<div class="mob-proj-daily">Promedio diario: <strong>${fmtAmt(Math.round(dailyAvg))}</strong></div>`:''}
          </div>
        </div>
        <span class="mob-proj-badge">Según tu ritmo actual</span>
      </div>
      <div class="mob-proj-bar-row">
        <div class="mob-proj-bar-track"><div class="mob-proj-bar-fill" style="width:${projPct}%"></div></div>
        <span class="mob-proj-pct">${projPct}% del límite</span>
      </div>
    </div>`:''}

    ${topCats.length>0?`
    <div class="mob-section-card mob-cats-card">
      <div class="mob-sec-hd">
        <span class="mob-sec-title">CATEGORÍAS DEL MES</span>
        <button class="mob-sec-link" onclick="nav('tendencia')">Ver detalle →</button>
      </div>
      <div class="mob-cats-list">
        ${topCats.map((cat,i)=>`
          <div class="mob-cat-row">
            <div class="mob-cat-icon" style="background:${catPalette[i]}22;color:${catPalette[i]};">${getCatIcon(cat.name)}</div>
            <div class="mob-cat-body">
              <div class="mob-cat-top">
                <span class="mob-cat-name">${cat.name}</span>
                <span class="mob-cat-amt">${fmtAmt(cat.amount)}</span>
                <span class="mob-cat-pct">${cat.pct}%</span>
              </div>
              <div class="mob-cat-bar-track"><div class="mob-cat-bar-fill" style="width:${cat.pct}%;background:${catPalette[i]};"></div></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`:''}

    ${(()=>{
      // Gastos Compartidos widget
      const _gcTxns=(typeof state!=='undefined'&&state.transactions?state.transactions:[]).filter(t=>t.sharedExpense&&t.sharedExpense.enabled);
      if(!_gcTxns.length) return '';
      const _gcSummary=typeof getSharedExpenseSummary==='function'?getSharedExpenseSummary(_gcTxns):[];
      const _gcPending=_gcSummary.filter(p=>p.count>0);
      const _gcCobrado=_gcSummary.filter(p=>p.count===0&&p.cobradoCount>0);
      const _gcTotalPendingArs=_gcPending.reduce((s,p)=>s+p.pendingArs,0);
      const _gcEsc=(s)=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return `
        <div class="mob-section-card mob-gc-card">
          <div class="mob-sec-hd">
            <span class="mob-sec-title">GASTOS COMPARTIDOS</span>
            ${_gcTotalPendingArs>0?`<span class="mob-gc-pending-total">$${fmtN(Math.round(_gcTotalPendingArs))} pendiente</span>`:''}
          </div>
          <div class="mob-gc-list">
            ${[..._gcPending,..._gcCobrado].slice(0,6).map(p=>`
              <div class="mob-gc-person-row">
                <div class="mob-gc-avatar">${_gcEsc(p.name.slice(0,2).toUpperCase())}</div>
                <div class="mob-gc-info">
                  <div class="mob-gc-name">${_gcEsc(p.name)}</div>
                  <div class="mob-gc-meta">${p.count>0?p.count+' gasto'+(p.count!==1?'s':''):''} ${p.cobradoCount>0?'· '+p.cobradoCount+' cobrado'+(p.cobradoCount!==1?'s':''):''}</div>
                </div>
                <div class="mob-gc-right">
                  ${p.count>0?`<div class="mob-gc-amount pending">${p.pendingArs>0?'$'+fmtN(Math.round(p.pendingArs)):'Pendiente'}</div><div class="mob-gc-badge pending">⏳ Pendiente</div>`:''}
                  ${p.count===0&&p.cobradoCount>0?`<div class="mob-gc-amount cobrado">$${fmtN(Math.round(p.cobradoArs))}</div><div class="mob-gc-badge cobrado">✓ Cobrado</div>`:''}
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    })()}

    ${(monthTxns||[]).length === 0 ? `
    <div class="mob-connect-cta">
      <div class="mob-connect-icon">☁️</div>
      <div class="mob-connect-copy">
        <div class="mob-connect-title">Conectá tus datos</div>
        <div class="mob-connect-sub">Importá CSV o conectá Google Drive para ver tus finanzas aquí.</div>
      </div>
      <button class="mob-connect-btn" onclick="openCloudSync(event)">Conectar</button>
    </div>` : ''}

    <!-- Calendar widget -->
    <div class="mob-section-card mob-cal-card">
      <div class="mob-sec-hd">
        <span class="mob-sec-title">${_calMN[calMonth].toUpperCase()} ${calYear}</span>
      </div>
      <div class="mob-cal-grid">${calCells}</div>
      <div id="mob-cal-detail" class="mob-cal-detail" style="display:none;"></div>
    </div>

    <div style="height:32px"></div>
  `;
}

/* ─── Calendar day tap handler ─── */
window._mobCalTap = function(day) {
  const detail = document.getElementById('mob-cal-detail');
  if (!detail) return;
  const txns = (window._mobCalTxns||{})[day];
  if (!txns || !txns.length) { detail.style.display='none'; return; }

  // If already showing this day, toggle off
  if (detail.dataset.day == day && detail.style.display !== 'none') {
    detail.style.display = 'none';
    // Deselect all days
    document.querySelectorAll('.mob-cal-day.mob-cal-selected').forEach(el=>el.classList.remove('mob-cal-selected'));
    return;
  }

  // Highlight selected day
  document.querySelectorAll('.mob-cal-day.mob-cal-selected').forEach(el=>el.classList.remove('mob-cal-selected'));
  const dayEls = document.querySelectorAll('.mob-cal-day');
  dayEls.forEach(el => {
    const num = parseInt(el.querySelector('.mob-cal-dnum')?.textContent||'0',10);
    if (num===day) el.classList.add('mob-cal-selected');
  });

  detail.dataset.day = day;
  const fmt = (n) => '$'+Number(n||0).toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0});
  const rows = txns.slice(0,8).map(t=>`
    <div class="mob-cal-det-row">
      <div class="mob-cal-det-dot" style="background:${t.currency==='USD'?'#247CFF':'#7C4DFF'}"></div>
      <span class="mob-cal-det-desc">${t.description||'Sin descripción'}</span>
      <span class="mob-cal-det-amt">${t.currency==='USD'?'U$D '+Number(t.amount||0).toFixed(2):fmt(t.amount)}</span>
    </div>`).join('');
  const extra = txns.length>8 ? `<div class="mob-cal-det-more">+${txns.length-8} más</div>` : '';
  detail.innerHTML = rows + extra;
  detail.style.display = 'block';
};
