// ══ DASHBOARD ══
let USD_TO_ARS = state.usdRate || 1420;
async function fetchUsdRate(manual=false){
  const btn=document.getElementById('btn-refresh-usd');
  const statusEl=document.getElementById('usd-rate-status');
  if(btn){btn.disabled=true;btn.textContent='↻ ...';}
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
        saveState();updateUsdRateUI();
        if(manual)showToast('✓ Oficial BNA: $'+fmtN(venta)+'/USD');
        if(btn){btn.disabled=false;btn.textContent='↻ Actualizar';}
        if(statusEl)statusEl.textContent='';
        return;
      }
    }catch(e){}
  }

  if(manual)showToast('⚠️ No se pudo conectar. Editá el valor manualmente.');
  if(btn){btn.disabled=false;btn.textContent='↻ Actualizar';}
  if(statusEl)statusEl.textContent='';
}
function updateUsdRateUI(){
  const rate=USD_TO_ARS;
  const buyRate=Number(state.usdRateBuy||rate||0) || rate;
  const sellRate=Number(state.usdRateSell||rate||0) || rate;
  // Card en dashboard
  const buyDisp=document.getElementById('usd-rate-buy-display');
  const sellDisp=document.getElementById('usd-rate-sell-display');
  if(buyDisp)animateNumberText(buyDisp,buyRate,{prefix:'$',decimals:2,duration:620});
  if(sellDisp)animateNumberText(sellDisp,sellRate,{prefix:'$',decimals:2,duration:700});
  const src=document.getElementById('usd-rate-source-badge');
  if(src)src.textContent=state.usdRateSource||'manual';
  const upd=document.getElementById('usd-rate-updated');
  if(upd&&state.usdRateUpdated){const d=new Date(state.usdRateUpdated);upd.textContent='Actualizado '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});}
  const status=document.getElementById('usd-rate-status');
  if(status)status.textContent='Tocá para ver compra y venta';
  // Legacy badge selector (otros lugares que puedan tener el badge)
  document.querySelectorAll('.usd-rate-badge').forEach(el=>{el.textContent='U$D 1 = $'+fmtN(rate)+' ('+( state.usdRateSource||'manual')+')'});
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
  if(state.dashMonth) return state.dashMonth;
  // Fallback to real-world current month (2026-04 if it's March 24, 2026)
  return getMonthKey(new Date());
}
function getCurrentMonthTxns(){
  const mk=getActiveDashMonth();
  return state.transactions.filter(t=>t.month===mk||getMonthKey(t.date)===mk);
}
function getAvailableMonths(){
  const set=new Set(state.transactions.map(t=>t.month||getMonthKey(t.date)));
  return [...set].sort();
}
function renderUiGlyph(name){
  const icons={
    bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
    card:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/></svg>',
    alert:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.8 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/></svg>',
    trend:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16 10 10l4 4 6-8"/><path d="M20 6v4h-4"/></svg>',
    loop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1v6h-6"/><path d="M7 23v-6h6"/><path d="M20.5 9A9 9 0 0 0 6 5.3L3 8"/><path d="M3.5 15A9 9 0 0 0 18 18.7L21 16"/></svg>',
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
  if(!el)return;
  if(!model||!model.cards?.length){
    el.style.display='none';
    return;
  }
  const collapsed=!!state.decisionCenterCollapsed;
  el.style.display='block';
  el.innerHTML=`
    <div class="decision-center ${collapsed?'is-collapsed':''}">
      <div class="decision-center-head">
        <div>
          <div class="section-kicker">${esc(model.kicker||'CENTRO DE ALERTAS Y DECISIONES')}</div>
          <div class="decision-center-title">${esc(model.title||('Prioridades claras para '+model.periodLabel))}</div>
          <div class="decision-center-sub">${model.summary}</div>
        </div>
        <div class="decision-center-actions">
          ${model.alertCount?`<div class="decision-center-badge alerts">${renderUiGlyph('alert')} ${model.alertCount} alerta${model.alertCount!==1?'s':''}</div>`:''}
          <div class="decision-center-badge">${renderUiGlyph('ai')} Lectura asistida</div>
          <button class="decision-center-toggle" type="button" onclick="event.stopPropagation();toggleDecisionCenter()">${collapsed?'Mostrar':'Minimizar'}</button>
        </div>
      </div>
      <div class="decision-card-grid" style="display:${collapsed?'none':'grid'};">
        ${model.cards.map(card=>`
          <button class="decision-card ${card.tone||'neutral'}" onclick="nav('${card.link||'dashboard'}')">
            <div class="decision-card-top">
              <div class="decision-card-icon">${renderUiGlyph(card.icon||'spark')}</div>
              <div class="decision-card-chip">${esc(card.kicker||'Acción')}</div>
            </div>
            <div class="decision-card-title">${esc(card.title||'Siguiente paso')}</div>
            <div class="decision-card-body">${card.body||''}</div>
            <div class="decision-card-footer">
              <span>${esc(card.cta||'Abrir')}</span>
              <span class="decision-card-arrow">›</span>
            </div>
          </button>
        `).join('')}
      </div>
    </div>`;
}
function toggleDecisionCenter(){
  state.decisionCenterCollapsed=!state.decisionCenterCollapsed;
  saveState();
  renderDashboard();
}
function setDashView(mode){
  state.dashView=mode;
  // Update toggle button styles
  const btnMes=document.getElementById('dash-toggle-mes');
  const btnTc=document.getElementById('dash-toggle-tc');
  if(btnMes&&btnTc){
    if(mode==='tc'){
      btnMes.style.background='transparent';btnMes.style.color='var(--text3)';
      btnTc.style.background='var(--accent)';btnTc.style.color='#ffffff';
    } else {
      btnMes.style.background='var(--accent)';btnMes.style.color='#ffffff';
      btnTc.style.background='transparent';btnTc.style.color='var(--text3)';
    }
  }
  saveState();
  renderDashboard();
}

function setDashMonthFromSelect(val){
  if(state.dashView==='tc'){
    state.dashTcCycle=val||null;
  } else {
    state.dashMonth=val||null;
  }
  saveState();
  renderDashboard();
}
function updateMonthPicker(){
  // In TC mode, the selector is managed by renderDashboard's TC branch — don't touch it
  if(state.dashView==='tc') return;
  const sel=document.getElementById('dash-month-select');
  if(!sel)return;
  const months=getAvailableMonths();
  const cur=state.dashMonth||'';
  const MNAMES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
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
  const MNAMES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
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
  const today=new Date();
  // Always default to real current month if state is empty or has an old stale value
  let activeMk = getActiveDashMonth();
  if(!activeMk) activeMk = getMonthKey(new Date());
  // ── TC vs Mes mode (declared here, used throughout the function) ──
  const isTcView=state.dashView==='tc';
  // ── Sync toggle buttons ──
  const _btnM=document.getElementById('dash-toggle-mes');
  const _btnT=document.getElementById('dash-toggle-tc');
  if(_btnM&&_btnT){
    _btnM.style.background=isTcView?'transparent':'var(--accent)';
    _btnM.style.color=isTcView?'var(--text3)':'#ffffff';
    _btnT.style.background=isTcView?'var(--accent)':'transparent';
    _btnT.style.color=isTcView?'#ffffff':'var(--text3)';
  }
  // Keep period selector in sync
  const _dashSel=document.getElementById('dash-month-select');
  if(_dashSel){
    if(isTcView){
      // TC mode: show cycle list
      const _cycles=getTcCycles();
      const _selId=state.dashTcCycle||'';
      _dashSel.innerHTML='<option value="">Ciclo actual</option>'+_cycles.map(c=>'<option value="'+c.id+'" '+(c.id===_selId?'selected':'')+'>'+esc(expandPeriodYearLabel(c.label||''))+'</option>').join('');
    } else {
      // Mes mode: show calendar months
      if(!_dashSel.querySelector('option[value="'+activeMk+'"]')){
        const months=[...new Set(state.transactions.map(t=>t.month||getMonthKey(t.date)))].sort().reverse();
        const _MN=['Enero','Feb','Marzo','Abril','Mayo','Junio','Julio','Agosto','Sep','Oct','Nov','Dic'];
        _dashSel.innerHTML='<option value="">Mes actual</option>'+months.map(m=>{const[y,mo]=m.split('-');return'<option value="'+m+'" '+(m===activeMk?'selected':'')+'>'+_MN[+mo-1]+' '+y+'</option>';}).join('');
      } else {
        _dashSel.value=state.dashMonth||'';
      }
    }
  }
  const isCurrentMonth=activeMk===getMonthKey(today);
  let monthTxns, tcPeriodLabel='', activeTcCycle=null;
  if(isTcView){
    const cycles=getTcCycles(); // sorted desc by closeDate
    if(cycles.length){
      // Pick selected cycle, fall back to most recent (cycles[0])
      const selId=state.dashTcCycle||'';
      activeTcCycle=(selId&&cycles.find(c=>c.id===selId))||cycles[0];
      // Sync selector value
      if(_dashSel) _dashSel.value=activeTcCycle.id;
      state.dashTcCycle=activeTcCycle.id;
      const idx2=cycles.findIndex(c=>c.id===activeTcCycle.id);
      const open=getTcCycleOpen(cycles,idx2);
      if(open){
        const openD=new Date(open+'T12:00:00');
        const closeD=new Date(activeTcCycle.closeDate+'T12:00:00');
        tcPeriodLabel='Ciclo actual · '+expandPeriodYearLabel(activeTcCycle.label)+' · '+openD.toLocaleDateString('es-AR',{day:'2-digit',month:'short'})+' → '+closeD.toLocaleDateString('es-AR',{day:'2-digit',month:'short'});
        monthTxns=getTcCycleTxns(activeTcCycle, cycles);
      } else {
        monthTxns=[];
        tcPeriodLabel='Ciclo actual · '+expandPeriodYearLabel(activeTcCycle.label);
      }
    } else {
      monthTxns=[];
      tcPeriodLabel='Sin ciclos configurados — agregá uno en ⚙ Tarjeta de Crédito';
    }
  } else {
    monthTxns=getCurrentMonthTxns();
  }

  // ── Gastos ──
  // En modo TC: excluir débito/efectivo (payMethod=deb/ef) ya que el resumen de TC solo incluye cargos de tarjeta
  // En ambos modos: excluir cuotas proyectadas (isPendingCuota) — son gastos futuros, no actuales
  const _tcModeActive=isTcView&&activeTcCycle;
  const _isNonCC=(t)=>t.payMethod==='deb'||t.payMethod==='ef';
  const billableTxns=monthTxns.filter(t=>!t.isPendingCuota&&(_tcModeActive?!_isNonCC(t):true));
  const arsMonth=billableTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const usdMonth=billableTxns.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);
  const cntMonth=billableTxns.length;
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

  // ── Widget Tarjeta: SIEMPRE usa el ciclo TC activo (independiente del modo) ──
  const _tcCycles=getTcCycles();
  let _tcWidgetTxns=monthTxns; // fallback: mismo período
  if(_tcCycles.length){
    const _activeTc=_tcCycles.find(c=>{
      const _i=_tcCycles.findIndex(x=>x.id===c.id);
      const _op=getTcCycleOpen(_tcCycles,_i);
      const _today=dateToYMD(new Date());
      return _op&&_today>=_op&&_today<=c.closeDate;
    })||_tcCycles[0];
    _tcWidgetTxns=getTcCycleTxns(_activeTc,_tcCycles);
  }
  // TC widget: incluir VISA, AMEX, y 'tc' (todos son cargos de tarjeta de crédito)
  const _isCCCharge=(t)=>t.payMethod==='tc'||t.payMethod==='visa'||t.payMethod==='amex'||(!t.payMethod&&!t.isPendingCuota);
  const tcWidgetAmt=_tcWidgetTxns.filter(t=>t.currency==='ARS'&&_isCCCharge(t)&&!t.isPendingCuota).reduce((s,t)=>s+t.amount,0);
  const debWidgetAmt=_tcWidgetTxns.filter(t=>t.currency==='ARS'&&t.payMethod==='deb').reduce((s,t)=>s+t.amount,0);
  const hasPayTagsWidget=_tcWidgetTxns.some(t=>t.payMethod);

  // ── Ingresos ──
  // Priority: 1) income month linked to active TC cycle open month  2) exact active month
  // 3) most recent logged month  4) source bases  5) legacy fallback
  let incARS=state.income.ars+state.income.varArs;
  let incUSD=state.income.usd+state.income.varUsd;
  const incomeCandidates=[];
  if(isTcView&&activeTcCycle){
    const _cycleList=getTcCycles();
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
  const totalGastoARS=arsMonth+(usdMonth*USD_TO_ARS);
  const pct=incTotalARS>0?Math.round((totalGastoARS/incTotalARS)*100):null;
  const spendBudget=incTotalARS>0?incTotalARS*(state.spendPct||100)/100:0;
  const margen=incTotalARS>0?Math.max(0,spendBudget-totalGastoARS):null;

  // ── Proyección ──
  const[pY,pM]=activeMk.split('-').map(Number);
  const daysInMonth=new Date(pY,pM,0).getDate();
  let dailyRate=0, projected=0, daysLeft=0, projPeriodOpen=null, projPeriodClose=null;

  if(isTcView && activeTcCycle){
    // Modo TC: proyectar hasta el cierre del ciclo TC activo
    const _tcOpen=getTcCycleOpen(getTcCycles(), getTcCycles().findIndex(c=>c.id===activeTcCycle.id));
    const _tcOpenD = _tcOpen ? new Date(_tcOpen+'T12:00:00') : new Date();
    const _tcCloseD = new Date(activeTcCycle.closeDate+'T12:00:00');
    const _totalDays = Math.max(1, Math.round((_tcCloseD - _tcOpenD) / 86400000) + 1);
    const _daysElapsed = Math.max(1, Math.min(_totalDays, Math.round((today - _tcOpenD) / 86400000) + 1));
    daysLeft = Math.max(0, _totalDays - _daysElapsed);
    dailyRate = totalGastoARS / _daysElapsed;
    projected = Math.round(dailyRate * _totalDays);
    projPeriodClose = _tcCloseD;
  } else {
    // Modo Mes: proyectar hasta fin del mes calendario
    const dayOfMonth = isCurrentMonth ? today.getDate() : daysInMonth;
    daysLeft = isCurrentMonth ? daysInMonth - today.getDate() : 0;
    dailyRate = dayOfMonth > 0 ? totalGastoARS / dayOfMonth : 0;
    projected = isCurrentMonth ? Math.round(dailyRate * daysInMonth) : totalGastoARS;
  }

  const dashMonthNames=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
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
  const MNAMES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const _spendLabel = totalGastoARS>0 ? ' · $'+fmtN(totalGastoARS)+' gastados' : '';
  document.getElementById('dash-date').textContent=isTcView
    ?tcPeriodLabel
    :(isCurrentMonth
      ?today.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+_spendLabel
      :MNAMES[pM-1]+' '+pY+' · mes cerrado'+_spendLabel);

  // ── Título dinámico del dashboard ──
  const _titleEl=document.getElementById('dash-page-title');
  if(_titleEl){
    const _h=today.getHours();
    const _greeting=_h<12?'Buenos días':_h<20?'Buenas tardes':'Buenas noches';
    _titleEl.textContent=_greeting+', '+(state.userName||'Pedro');
  }
  const timelineData=getDashboardTimelineData(today);
  const backupHealth=getBackupHealth(today);
  const slotEls=[1,2,3].map(i=>({
    label:document.getElementById(`timeline-slot-${i}-label`),
    chip:document.getElementById(`timeline-slot-${i}-chip`),
    value:document.getElementById(`timeline-slot-${i}-value`),
    meta:document.getElementById(`timeline-slot-${i}-meta`)
  }));
  const rawEvents=(timelineData.events||[]).filter(e=>e&&e.days>=0);
  const seenTimeline=new Set();
  const timelineCards=[];
  const pushTimelineEvent=e=>{
    if(!e) return;
    const key=`${e.type}-${e.title}-${e.date instanceof Date?e.date.toISOString():e.date}`;
    if(seenTimeline.has(key)) return;
    seenTimeline.add(key);
    timelineCards.push(e);
  };
  pushTimelineEvent(rawEvents.find(e=>(e.type==='close'||e.type==='due')&&e.days<=7));
  rawEvents.filter(e=>e.type!=='close'&&e.type!=='due').forEach(pushTimelineEvent);
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
        label:e.type==='due'?'Vencimiento TC':'Cierre TC',
        chip:e.type==='due'?'tarjeta':'tarjeta',
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
  if(dhcML)dhcML.textContent=isTcView&&activeTcCycle?expandPeriodYearLabel(activeTcCycle.label||'').toUpperCase():(MNAMES[pM-1]+' '+pY).toUpperCase();
  animateNumberText(document.getElementById('kpi-ars'),totalGastoARS,{prefix:'$',decimals:2,duration:920});
  // ARS/USD breakdown line
  const _arsLine=document.getElementById('dhc-ars-line');
  const _usdLine=document.getElementById('dhc-usd-line');
  const _pctInline=document.getElementById('dhc-pct-inline');
  if(_arsLine)animateNumberText(_arsLine,arsMonth,{prefix:'$',decimals:2,duration:760});
  if(_usdLine){
    if(usdMonth>0)animateNumberText(_usdLine,usdMonth,{prefix:'U$D ',decimals:2,duration:760});
    else _usdLine.textContent='—';
  }
  if(_pctInline&&pct!==null)_pctInline.textContent=pct+'% del ingreso';
  else if(_pctInline)_pctInline.textContent='';
  // Hidden compat
  document.getElementById('kpi-ars-d').textContent=cntMonth+' movimientos · $'+fmtN(cntMonth>0?totalGastoARS/cntMonth:0)+' promedio';
  // 3 totals breakdown
  document.getElementById('kpi-total-ars').textContent='$'+fmtN(arsMonth);
  document.getElementById('kpi-total-usd').textContent=usdMonth>0?'U$D '+fmtN(usdMonth):'—';

  // Badge %
  const badge=document.getElementById('dhc-pct-badge');
  if(badge){
    if(pct!==null){
      const cls=pct>=100?'danger':pct>=state.alertThreshold?'warn':'safe';
      badge.className='dhc-badge '+cls;badge.textContent=pct+'% del ingreso';
    } else { badge.className='dhc-badge neutral';badge.textContent='Ingreso no configurado'; }
  }

  document.getElementById('kpi-inc-total').textContent=incTotalARS>0?'$'+fmtN(incTotalARS):'—';

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
  document.getElementById('kpi-usd').textContent=usdMonth>0?'U$D '+fmtN(usdMonth):'—';

  const pFill=document.getElementById('dhc-progress-fill');
  const pLabel=document.getElementById('dhc-progress-label');
  if(pFill&&pct!==null){
    const col=pct>=100?'var(--danger)':pct>=state.alertThreshold?'var(--accent3)':'var(--accent)';
    animateProgressBar(pFill,Math.min(100,pct));pFill.style.background=col;
    if(pLabel)pLabel.textContent=pct+'% usado del ingreso · meta: '+state.alertThreshold+'%';
  } else if(pFill){pFill.style.width='0%';}

  // ── KPI: Tarjeta — split VISA / AMEX usando el tcCycle que contiene HOY (siempre período actual) ──
  ccInit();
  const _ccCards=state.ccCards||[];
  const _allTcCyc=getTcCycles();
  const _todayStr=dateToYMD(new Date());
  // Encontrar el ciclo TC que contiene hoy (independiente de la vista seleccionada)
  let _currentTcCyc=null;
  if(_allTcCyc.length){
    _currentTcCyc=_allTcCyc.find((c,i)=>{
      const op=getTcCycleOpen(_allTcCyc,i);
      return op&&_todayStr>=op&&_todayStr<=c.closeDate;
    })||_allTcCyc[0];
  }
  _ccCards.forEach(card=>{
    let cardArs=0,cardUsd=0;
    if(_currentTcCyc){
      const _idx=_allTcCyc.findIndex(c=>c.id===_currentTcCyc.id);
      const _openDate=getTcCycleOpen(_allTcCyc,_idx);
      const pmKey=card.payMethodKey||null;
      const ccState=(state.ccCycles||[]).find(c=>c.cardId===card.id&&c.tcCycleId===_currentTcCyc.id);
      const excluded=new Set(ccState?.excludedIds||[]);
      const expenses=(state.transactions||[]).filter(t=>{
        if(excluded.has(t.id))return false;
        if(pmKey&&t.payMethod!==pmKey)return false;
        const d=dateToYMD(t.date);
        return d>=_openDate&&d<=_currentTcCyc.closeDate;
      });
      cardArs=expenses.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
      cardUsd=expenses.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);
      (ccState?.manualExpenses||[]).forEach(e=>{cardArs+=e.amountARS||0;cardUsd+=e.amountUSD||0;});
    }
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
    cycleCaption.textContent=_currentTcCyc?.label?expandPeriodYearLabel(_currentTcCyc.label):'Sin ciclo activo';
  }
  // Hidden compat element
  document.getElementById('kpi-tc').textContent=hasPayTagsWidget?'$'+fmtN(tcWidgetAmt+debWidgetAmt):'$'+fmtN(_tcWidgetTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0));
  // kpi-tc-d removed from HTML

  // ── KPI: Proyección ──
  const projEl=document.getElementById('kpi-proj');
  const projD=document.getElementById('kpi-proj-d');
  const projTitle=document.getElementById('kpi-proj-title');
  if(projEl){
    if(isTcView && activeTcCycle){
      // TC mode: project to cycle close date
      if(daysLeft===0 && totalGastoARS===0){
        projEl.textContent='—'; projEl.style.color='var(--text3)';
        if(projD)projD.textContent='Sin datos cargados en este ciclo';
      } else {
        animateNumberText(projEl,projected,{prefix:'$',decimals:2,duration:860});
        const overBudget=incTotalARS>0&&projected>incTotalARS;
        projEl.style.color=overBudget?'var(--danger)':projected>incTotalARS*0.85?'var(--accent3)':'var(--text)';
        const closeLabel=projPeriodClose?projPeriodClose.toLocaleDateString('es-AR',{day:'2-digit',month:'short'}):'cierre';
        if(projD)projD.textContent=overBudget?'Exige ajuste antes del '+closeLabel:'Estimación activa hasta '+closeLabel;
        const _dailyEl=document.getElementById('kpi-proj-daily');
        if(_dailyEl)animateNumberText(_dailyEl,Math.round(dailyRate),{prefix:'$',decimals:2,duration:720});
        const _daysEl=document.getElementById('kpi-proj-days');
        if(_daysEl)animateNumberText(_daysEl,daysLeft,{decimals:0,duration:620,formatter:(n)=>String(Math.round(n))});
        const _daysLabel=document.getElementById('kpi-proj-days-label');
        if(_daysLabel)_daysLabel.textContent='CIERRE TC'+(projPeriodClose?' · '+projPeriodClose.toLocaleDateString('es-AR',{day:'2-digit',month:'short'}):'');
      }
      if(projTitle)projTitle.textContent='PROYECCIÓN AL CIERRE TC';
    } else {
      // Mes mode
      if(isCurrentMonth){
        animateNumberText(projEl,projected,{prefix:'$',decimals:2,duration:860});
        const overBudget=incTotalARS>0&&projected>incTotalARS;
        projEl.style.color=overBudget?'var(--danger)':projected>incTotalARS*0.85?'var(--accent3)':'var(--text)';
        if(projD)projD.textContent=overBudget?'Ritmo alto para este mes':'Ritmo estimado al cierre mensual';
        const _dailyEl2=document.getElementById('kpi-proj-daily');
        if(_dailyEl2)animateNumberText(_dailyEl2,Math.round(dailyRate),{prefix:'$',decimals:2,duration:720});
        const _daysEl2=document.getElementById('kpi-proj-days');
        if(_daysEl2)animateNumberText(_daysEl2,daysLeft,{decimals:0,duration:620,formatter:(n)=>String(Math.round(n))});
        const _daysLabel2=document.getElementById('kpi-proj-days-label');
        if(_daysLabel2)_daysLabel2.textContent='DÍAS AL CIERRE';
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
      {data:values,backgroundColor:barColors,borderColor:'rgba(200,240,96,0.3)',borderWidth:0,borderRadius:6,borderSkipped:false},
      {type:'line',data:values.map(()=>avg),borderColor:'rgba(160,154,148,0.5)',borderWidth:1.5,borderDash:[5,4],pointRadius:0,fill:false,order:0}
    ]},options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#1c1a18',titleColor:'#f0ebe6',bodyColor:'#a09a94',borderColor:'#2e2b28',borderWidth:1,padding:10,callbacks:{label:c=>c.datasetIndex===1?' Promedio: $'+fmtN(Math.round(c.parsed.y)):' $'+fmtN(c.parsed.y)}}},
      scales:{x:{ticks:{color:_isL()?'#86868b':'#8a8480',font:{size:10}},grid:{display:false}},y:{ticks:{color:_isL()?'#86868b':'#8a8480',font:{size:10},callback:v=>'$'+fmtN(v)},grid:{color:_isL()?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.04)'}}}
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
      {data:values,backgroundColor:barColors,borderColor:'rgba(79,140,255,0.28)',borderWidth:0,borderRadius:6,borderSkipped:false},
      {type:'line',data:values.map(()=>avg),borderColor:'rgba(160,154,148,0.5)',borderWidth:1.5,borderDash:[5,4],pointRadius:0,fill:false,order:0}
    ]},options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#1c1a18',titleColor:'#f0ebe6',bodyColor:'#a09a94',borderColor:'#2e2b28',borderWidth:1,padding:10,callbacks:{label:c=>c.datasetIndex===1?' Promedio: $'+fmtN(Math.round(c.parsed.y)):' $'+fmtN(c.parsed.y)}}},
      scales:{x:{ticks:{color:_isL()?'#86868b':'#8a8480',font:{size:9},maxRotation:0,minRotation:0},grid:{display:false}},y:{ticks:{color:_isL()?'#86868b':'#8a8480',font:{size:10},callback:v=>'$'+fmtN(v)},grid:{color:_isL()?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.04)'}}}
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
      {data:values,backgroundColor:values.map(v=>v>avg*1.5?'rgba(255,100,80,0.7)':v>avg?'rgba(255,200,80,0.6)':'rgba(200,240,96,0.6)'),borderWidth:0,borderRadius:4,borderSkipped:false},
      {type:'line',data:values.map(()=>avg),borderColor:'rgba(160,154,148,0.5)',borderWidth:1.5,borderDash:[5,4],pointRadius:0,fill:false,order:0}
    ]},options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#1c1a18',titleColor:'#f0ebe6',bodyColor:'#a09a94',borderColor:'#2e2b28',borderWidth:1,padding:10,callbacks:{label:c=>c.datasetIndex===1?' Promedio: $'+fmtN(Math.round(c.parsed.y)):' $'+fmtN(c.parsed.y)}}},
      scales:{x:{ticks:{color:_isL()?'#86868b':'#8a8480',font:{size:9},maxRotation:0},grid:{display:false}},y:{ticks:{color:_isL()?'#86868b':'#8a8480',font:{size:10},callback:v=>'$'+fmtN(v)},grid:{color:_isL()?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.04)'}}}
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
  const isTcView=state.dashView==='tc';
  let txns=[];
  if(isTcView){
    const cycles=getTcCycles();
    const selId=state.dashTcCycle||'';
    const activeCycle=(selId&&cycles.find(c=>c.id===selId))||cycles[0]||null;
    txns=activeCycle?getTcCycleTxns(activeCycle,cycles):[];
  } else {
    txns=getCurrentMonthTxns();
  }
  txns=txns.filter(t=>t.currency==='ARS'&&!t.isPendingCuota).sort((a,b)=>b.amount-a.amount).slice(0,5);
  if(!txns.length){
    el.innerHTML='<div style="color:var(--text3);font-size:12px;font-family:var(--font);padding:8px 0;">'+(isTcView?'Sin movimientos en este ciclo':'Sin movimientos este mes')+'</div>';
    return;
  }
  if(sub)sub.textContent=txns.length+' movimientos más altos del '+(isTcView?'ciclo':'mes');
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
  const cleanTxns = (monthTxns || []).filter(t => !t.isPendingCuota);
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
  const prevTxns    = getTxnsFor(prevMk).filter(t => t.currency === 'ARS');
  if(prevTxns.length && monthTxns.length){
    // build category totals for both months
    const sumCats = txns => {
      const c = {};
      txns.filter(t => t.currency === 'ARS').forEach(t => { c[t.category] = (c[t.category] || 0) + t.amount; });
      return c;
    };
    const curCats  = sumCats(monthTxns);
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

  /* ── Widgets históricos: promedio diario y mensual ── */
  const histDailyEl=document.getElementById('kpi-hist-daily');
  const histDailySub=document.getElementById('kpi-hist-daily-sub');
  const histMonthlyEl=document.getElementById('kpi-hist-monthly');
  const histMonthlySub=document.getElementById('kpi-hist-monthly-sub');
  const historyTxns=(state.transactions||[]).filter(t=>Number(t.amount)>0);
  if(histDailyEl&&histMonthlyEl&&historyTxns.length){
    const totalHistoryARS=historyTxns.reduce((sum,t)=>sum+((t.currency==='USD'?t.amount*USD_TO_ARS:t.amount)||0),0);
    const dateKeys=[...new Set(historyTxns.map(t=>dateToYMD(t.date)).filter(Boolean))].sort();
    const monthKeys=[...new Set(historyTxns.map(t=>t.month||getMonthKey(t.date)).filter(Boolean))].sort();
    const firstDate=dateKeys.length?new Date(dateKeys[0]+'T12:00:00'):null;
    const lastDate=dateKeys.length?new Date(dateKeys[dateKeys.length-1]+'T12:00:00'):null;
    const daySpan=firstDate&&lastDate?Math.max(1,Math.round((lastDate-firstDate)/(1000*60*60*24))+1):Math.max(1,dateKeys.length);
    const monthSpan=Math.max(1,monthKeys.length);
    const dailyAvg=totalHistoryARS/daySpan;
    const monthlyAvg=totalHistoryARS/monthSpan;
    animateNumberText(histDailyEl,dailyAvg,{prefix:'$',decimals:2,duration:700});
    animateNumberText(histMonthlyEl,monthlyAvg,{prefix:'$',decimals:2,duration:760});
    if(histDailySub)histDailySub.textContent=`Ritmo sobre ${daySpan} días registrados`;
    if(histMonthlySub)histMonthlySub.textContent=`Promedio de ${monthSpan} ${monthSpan===1?'mes':'meses'} con gasto`;
  } else {
    if(histDailyEl)histDailyEl.textContent='—';
    if(histMonthlyEl)histMonthlyEl.textContent='—';
    if(histDailySub)histDailySub.textContent='Necesitás más historial';
    if(histMonthlySub)histMonthlySub.textContent='Necesitás más historial';
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
    totalSpendArs
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
  const historyTxns=(state.transactions||[]).filter(t=>Number(t.amount)>0);
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

function renderDashboardCustomWidgets(context){
  const row=document.getElementById('dash-widgets-row');
  if(!row||typeof getDashboardCustomWidgets!=='function')return;
  const customWidgets=getDashboardCustomWidgets();
  const history=getDashboardHistoryAverages();
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
