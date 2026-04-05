// ══ CUOTAS ══
function dismissAutoCuota(key){
  if(!state.dismissedAutoCuotas) state.dismissedAutoCuotas=[];
  if(!state.dismissedAutoCuotas.includes(key)) state.dismissedAutoCuotas.push(key);
  saveState();renderCuotas();showToast('Cuota removida','info');
}

function detectAutoCuotas(){
  if(!state.dismissedAutoCuotas) state.dismissedAutoCuotas=[];
  // Group transactions that look like installments (have cuotaNum/cuotaTotal)
  const groups={};
  state.transactions.filter(t=>t.cuotaNum&&t.cuotaTotal).forEach(t=>{
    // normalize key: strip the cuota number from description to get the base name
    const baseName=t.description.replace(/\s*\d+\/\d+\s*$/,'').replace(/cuota\s+\d+\s+de\s+\d+/i,'').trim();
    const key=baseName.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').substring(0,30);
    const alias=state.autoCuotaConfig?.[key]?.alias?.trim();
    if(!groups[key])groups[key]={key,name:baseName,displayName:alias||baseName,transactions:[],amount:t.amount,currency:t.currency};
    groups[key].transactions.push(t);
  });
  return Object.values(groups).filter(g=>!state.dismissedAutoCuotas.includes(g.key));
}
function getAutoCuotaSnapshot(group, baseDate=new Date()){
  const cfg=state.autoCuotaConfig[group.key]||{};
  const actualTxns=group.transactions.filter(t=>!t.isPendingCuota);
  const txSorted=[...actualTxns].sort((a,b)=>new Date(a.date)-new Date(b.date)||((a.cuotaNum||0)-(b.cuotaNum||0)));
  const firstTxn=txSorted[0]||null;
  const labeledNums=[...new Set(actualTxns.map(t=>parseInt(t.cuotaNum,10)).filter(n=>Number.isFinite(n)&&n>0))].sort((a,b)=>a-b);
  const labelsSequentialFromOne=labeledNums.length>0&&labeledNums.every((n,idx)=>n===idx+1);
  const observedPaidCount=Math.max(actualTxns.length, labeledNums[0]===1?labeledNums.length:0, 1);
  const maxPaidFound=labelsSequentialFromOne?labeledNums[labeledNums.length-1]:observedPaidCount;
  let inferredPaid=maxPaidFound;
  let scheduleDay=cfg.day||null;

  if(firstTxn){
    const startD=new Date(firstTxn.date);
    if(!scheduleDay) scheduleDay=startD.getDate();
    if(firstTxn.cuotaNum===1){
      const monthDiff=(baseDate.getFullYear()-startD.getFullYear())*12+(baseDate.getMonth()-startD.getMonth());
      if(monthDiff>=0){
        const currentMonthMaxDay=new Date(baseDate.getFullYear(),baseDate.getMonth()+1,0).getDate();
        const effectiveDueDay=Math.min(scheduleDay||startD.getDate(), currentMonthMaxDay);
        const dueCount=monthDiff+(baseDate.getDate()>=effectiveDueDay?1:0);
        inferredPaid=Math.max(maxPaidFound, dueCount);
      }
    }
  }

  if(!scheduleDay){
    const projected=state.transactions
      .filter(t=>t.isPendingCuota&&t.cuotaGroupId&&group.transactions[0]?.cuotaGroupId&&t.cuotaGroupId===group.transactions[0].cuotaGroupId)
      .sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
    if(projected) scheduleDay=new Date(projected.date).getDate();
  }

  const total=cfg.total||group.transactions[0]?.cuotaTotal||Math.max(inferredPaid,maxPaidFound,1);
  const paid=cfg.paid!==undefined?cfg.paid:Math.min(total, Math.max(maxPaidFound, inferredPaid));
  const rem=Math.max(0,total-paid);
  const pct=Math.round((paid/Math.max(total,1))*100);
  const acc=actualTxns.reduce((s,t)=>s+(t.currency==='ARS'?t.amount:0),0);
  const amountPerCuota=actualTxns.length>0?acc/actualTxns.length:group.amount;
  const remainingTotal=rem*amountPerCuota;
  return {cfg,actualTxns,txSorted,firstTxn,maxPaidFound,total,paid,rem,pct,amountPerCuota,remainingTotal,scheduleDay};
}
function getDaysUntilNext(day){
  if(!day)return null;
  const today=new Date();const next=new Date(today.getFullYear(),today.getMonth(),day);
  if(next<=today)next.setMonth(next.getMonth()+1);
  return Math.round((next-today)/(1000*60*60*24));
}
function getNextCuotaDate(day){
  if(!day)return null;
  const today=new Date();
  const next=new Date(today.getFullYear(),today.getMonth(),day);
  if(next<=today)next.setMonth(next.getMonth()+1);
  return next;
}
function fmtCuotaNextDate(d){
  if(!d)return null;
  const today=new Date();
  const diff=Math.round((d-today)/86400000);
  const MN=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const label=d.getDate()+' '+MN[d.getMonth()];
  if(diff===0)return'<span style="color:var(--danger);font-weight:700;">hoy</span>';
  if(diff===1)return'<span style="color:var(--accent3);font-weight:700;">mañana</span>';
  if(diff<=7)return'<span style="color:var(--accent3);font-weight:700;">en '+diff+'d ('+label+')</span>';
  return'<span style="color:var(--text2);">'+label+'</span>';
}
function renderCuotas(){
  const autoGroups=detectAutoCuotas();
  const hasCuotas=autoGroups.length>0||state.cuotas.length>0;
  if(!hasCuotas){document.getElementById('cuotas-empty').style.display='block';document.getElementById('cuotas-content').style.display='none';return;}
  document.getElementById('cuotas-empty').style.display='none';document.getElementById('cuotas-content').style.display='flex';
  // Build all auto cuota cards
  const autoCards=autoGroups.map(g=>{
    const snap=getAutoCuotaSnapshot(g);
    const {cfg,actualTxns,total,paid,rem,pct,amountPerCuota,remainingTotal,scheduleDay}=snap;
    const day=cfg.day||scheduleDay||null;
    const daysUntil=getDaysUntilNext(day);
    // Derive next payment date: configured day > transaction day > projected cuota date
    let nextPayDate=null;
    if(rem>0){
      if(cfg.day){nextPayDate=getNextCuotaDate(cfg.day);}
      else if(scheduleDay){
        nextPayDate=getNextCuotaDate(scheduleDay);
      } else {
        // Check projected cuotas matching this group
        const _projected=state.transactions.filter(t=>t.isPendingCuota&&t.cuotaGroupId&&g.transactions[0]?.cuotaGroupId&&t.cuotaGroupId===g.transactions[0].cuotaGroupId&&new Date(t.date)>new Date());
        if(_projected.length>0){const _np=_projected.sort((a,b)=>new Date(a.date)-new Date(b.date))[0];nextPayDate=new Date(_np.date);}
      }
    }
    return buildCuotaCard(g.key,g.displayName||g.name,'🛒',amountPerCuota,g.currency||'ARS',paid,total,rem,pct,daysUntil,day,remainingTotal,false,null,nextPayDate);
  }).join('');
  document.getElementById('cuotas-grid').innerHTML=autoCards||'<div style="color:var(--text3);font-size:13px;font-family:var(--font);">Las cuotas se detectan automáticamente al importar tu CSV.</div>';
  // Manual cuotas
  const manualCards=state.cuotas.map(c=>{
    const rem=c.total-c.paid;const pct=Math.round(c.paid/c.total*100);
    const daysUntil=getDaysUntilNext(c.day);const remainingTotal=rem*c.amount;
    const manNextDate=rem>0?getNextCuotaDate(c.day):null;
    return buildCuotaCard(c.id,c.name,c.emoji||'🛒',c.amount,'ARS',c.paid,c.total,rem,pct,daysUntil,c.day,remainingTotal,true,c.color||null,manNextDate);
  }).join('');
  const manualSection=document.getElementById('cuotas-manual-section');
  if(state.cuotas.length>0){manualSection.style.display='flex';document.getElementById('cuotas-manual-grid').innerHTML=manualCards;}
  else manualSection.style.display='none';
  // Summary
  const allRem=[
    ...autoGroups.map(g=>getAutoCuotaSnapshot(g).remainingTotal),
    ...state.cuotas.map(c=>(c.total-c.paid)*c.amount)
  ];
  const totalRem=allRem.reduce((s,v)=>s+v,0);
  const nextMonth=[
    ...autoGroups.map(g=>{const snap=getAutoCuotaSnapshot(g);return snap.paid>=snap.total?0:snap.amountPerCuota;}),
    ...state.cuotas.filter(c=>c.paid<c.total).map(c=>c.amount)
  ].reduce((s,v)=>s+v,0);
  const totalCount=autoGroups.length+state.cuotas.length;
  document.getElementById('cuotas-summary-bar').innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:18px;"><div><div style="font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--text3);margin-bottom:6px;">CUOTAS ACTIVAS</div><div style="font-size:26px;font-weight:700;letter-spacing:-0.03em;font-family:var(--font);">'+totalCount+'</div></div><div><div style="font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--text3);margin-bottom:6px;">PRÓXIMO MES</div><div style="font-size:26px;font-weight:700;letter-spacing:-0.03em;font-family:var(--font);color:var(--accent3);">$'+fmtN(nextMonth)+'</div></div><div><div style="font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--text3);margin-bottom:6px;">TOTAL RESTANTE</div><div style="font-size:26px;font-weight:700;letter-spacing:-0.03em;font-family:var(--font);color:var(--danger);">$'+fmtN(totalRem)+'</div></div></div>';
}
function buildCuotaCard(key,name,emoji,amount,currency,paid,total,rem,pct,daysUntil,day,remainingTotal,isManual,customColor,nextPayDate){
  const c=customColor||(pct<50?'#ff3b30':pct<80?'#ff9500':'#007aff');
  // Next payment badge: show formatted date if available, otherwise config button
  let nextBadge;
  if(rem<=0){
    nextBadge='<span style="background:rgba(52,199,89,0.12);color:#34c759;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;">✓ Pagada</span>';
  } else if(nextPayDate){
    const _dFmt=fmtCuotaNextDate(nextPayDate);
    nextBadge='<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;background:var(--surface3);border-radius:6px;padding:4px 10px;border:1px solid var(--border2);">📅 Próximo pago '+_dFmt+'</span>';
  } else {
    nextBadge='<button class="btn btn-ghost btn-sm" onclick="'+(isManual?'editCuota(\''+key+'\')':'openAutoCuotaModal(\''+key+'\')')+'">⚙ Config fecha</button>';
  }
  const deleteBtn=isManual
    ?'<button class="btn btn-ghost btn-sm btn-icon" style="margin-left:auto" onclick="editCuota(\''+key+'\')">✎</button>'
    :'<button class="btn btn-ghost btn-sm btn-icon" style="margin-left:auto" onclick="openAutoCuotaModal(\''+key+'\')">✎</button>'
     +'<button class="btn btn-ghost btn-sm btn-icon" style="color:var(--danger);" title="Eliminar cuota" onclick="if(confirm(\'¿Eliminar esta cuota de la lista? Los movimientos existentes no se borran.\')){dismissAutoCuota(\''+key+'\');}">✕</button>';
  return'<div class="cuota-card"><div class="cuota-card-top"><div class="cuota-icon-wrap" style="background:'+c+'22;">'+emoji+'</div><div class="cuota-info"><div class="cuota-name">'+esc(name)+'</div><div class="cuota-desc">Cuota '+paid+'/'+total+' · resta $'+fmtN(remainingTotal)+'</div></div><div><div class="cuota-amount">$'+fmtN(amount)+'</div><div class="cuota-amount-sub">por cuota</div></div></div><div class="cuota-progress-area"><div class="cuota-prog-labels"><span>Pagado '+pct+'%</span><span>'+rem+' cuota'+(rem!==1?'s':'')+' restante'+(rem!==1?'s':'')+'</span></div><div class="cuota-prog-bar"><div class="cuota-prog-fill" style="width:'+pct+'%;background:'+c+'"></div></div></div><div class="cuota-actions">'+nextBadge+deleteBtn+'</div></div>';
}
function openNewCuotaModal(){
  document.getElementById('modal-cuota-title').textContent='Agregar cuota manual';
  document.getElementById('modal-cuota-editing').value='';
  document.getElementById('cuota-name').value='';document.getElementById('cuota-amount').value='';
  document.getElementById('cuota-total').value='';document.getElementById('cuota-paid').value='0';
  document.getElementById('cuota-day').value='';
  initEmojiPicker('cuota','🛒');
  renderGenericColorPicker('cuota-color-picker','');
  document.getElementById('btn-del-cuota').style.display='none';
  openModal('modal-cuota');
}
function editCuota(id){
  const c=state.cuotas.find(x=>x.id===id);if(!c)return;
  document.getElementById('modal-cuota-title').textContent='Editar cuota';
  document.getElementById('modal-cuota-editing').value=id;
  document.getElementById('cuota-name').value=c.name;document.getElementById('cuota-amount').value=c.amount;
  document.getElementById('cuota-total').value=c.total;document.getElementById('cuota-paid').value=c.paid;
  document.getElementById('cuota-day').value=c.day||'';
  initEmojiPicker('cuota',c.emoji||'🛒');
  renderGenericColorPicker('cuota-color-picker',c.color||'');
  document.getElementById('btn-del-cuota').style.display='inline-flex';
  openModal('modal-cuota');
}
function saveCuota(){
  const name=document.getElementById('cuota-name').value.trim();const amount=parseFloat(document.getElementById('cuota-amount').value)||0;
  const total=parseInt(document.getElementById('cuota-total').value)||1;const paid=parseInt(document.getElementById('cuota-paid').value)||0;
  const day=parseInt(document.getElementById('cuota-day').value)||null;const emoji=document.getElementById('cuota-emoji').value||'🛒';
  if(!name||amount<=0){showToast('⚠️ Completá nombre y monto','error');return;}
  const sw=document.querySelector('#cuota-color-picker .color-swatch.selected');const rawC=sw?sw.style.backgroundColor:'#888888';const cuotaColor=rawC.startsWith('#')?rawC:rgbToHex(rawC);
  const editing=document.getElementById('modal-cuota-editing').value;
  if(editing){const c=state.cuotas.find(x=>x.id===editing);if(c){c.name=name;c.amount=amount;c.total=total;c.paid=paid;c.day=day;c.emoji=emoji;c.color=cuotaColor;}}
  else{state.cuotas.push({id:Date.now().toString(36),name,amount,total,paid,day,emoji,color:cuotaColor});}
  saveState();closeModal('modal-cuota');renderCuotas();refreshAll();showToast('✓ Cuota guardada','success');
}
function deleteCuota(){
  const id=document.getElementById('modal-cuota-editing').value;
  state.cuotas=state.cuotas.filter(c=>c.id!==id);
  saveState();closeModal('modal-cuota');renderCuotas();refreshAll();showToast('Cuota eliminada','info');
}
function openAutoCuotaModal(key){
  const g=detectAutoCuotas().find(g=>g.key===key);if(!g)return;
  const cfg=state.autoCuotaConfig[key]||{};
  const snap=getAutoCuotaSnapshot(g);
  document.getElementById('modal-cuota-auto-desc').textContent=(g.displayName||g.name)+' · $'+fmtN(g.amount)+' por cuota';
  document.getElementById('autocuota-alias').value=cfg.alias||'';
  document.getElementById('autocuota-total').value=cfg.total||g.transactions[0]?.cuotaTotal||'';
  document.getElementById('autocuota-paid').value=cfg.paid!==undefined?cfg.paid:snap.paid;
  document.getElementById('autocuota-day').value=cfg.day||'';
  document.getElementById('autocuota-key').value=key;
  openModal('modal-cuota-auto');
}
function saveAutoCuota(){
  const key=document.getElementById('autocuota-key').value;
  const alias=document.getElementById('autocuota-alias').value.trim();
  const total=parseInt(document.getElementById('autocuota-total').value)||null;
  const paid=parseInt(document.getElementById('autocuota-paid').value);
  const day=parseInt(document.getElementById('autocuota-day').value)||null;
  state.autoCuotaConfig[key]={total,paid,day,alias};
  saveState();closeModal('modal-cuota-auto');renderCuotas();refreshAll();showToast('✓ Configuración guardada','success');
}

// ══ GASTOS FIJOS ══
function renderFixed(){
  const grid=document.getElementById('fixed-grid');
  const empty=document.getElementById('fixed-empty');
  if(!grid)return;
  if(!state.fixedExpenses||!state.fixedExpenses.length){
    if(empty)empty.style.display='block';
    grid.innerHTML='';return;
  }
  if(empty)empty.style.display='none';
  grid.innerHTML=state.fixedExpenses.map(f=>{
    const daysUntil=getDaysUntilNext(f.day);
    const nextText=daysUntil!==null?'Vence en '+daysUntil+'d (día '+f.day+')':'Sin día configurado';
    const sym=f.currency==='USD'?'U$D ':'$';
    const c=f.color||'#ff9500';
    return'<div style="display:flex;align-items:stretch;background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">'
      +'<div style="width:4px;background:'+c+';flex-shrink:0;"></div>'
      +'<div style="display:flex;align-items:center;gap:12px;flex:1;padding:13px 14px;">'
        +'<div style="font-size:22px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:'+c+'22;border-radius:9px;flex-shrink:0;">'+(f.emoji||'🏠')+'</div>'
        +'<div style="flex:1;">'
          +'<div style="font-size:14px;font-weight:700;color:var(--text);">'+esc(f.name)+'</div>'
          +'<div style="font-size:11px;color:var(--text3);font-family:var(--font);margin-top:2px;">'+nextText+'</div>'
        +'</div>'
        +'<div style="text-align:right;">'
          +'<div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;font-family:var(--font);color:'+c+';">'+sym+fmtN(f.amount)+'</div>'
          +'<div style="font-size:10px;color:var(--text3);font-family:var(--font);">'+f.currency+' · mensual</div>'
        +'</div>'
        +'<button class="btn btn-ghost btn-sm btn-icon" onclick="editFixed(\''+f.id+'\')" style="margin-left:4px;">✎</button>'
      +'</div>'
    +'</div>';
  }).join('');
}
function openNewFixedModal(){
  document.getElementById('modal-fixed-title').textContent='Nuevo gasto fijo';
  document.getElementById('modal-fixed-editing').value='';
  document.getElementById('fixed-name').value='';
  document.getElementById('fixed-amount').value='';
  document.getElementById('fixed-currency').value='ARS';
  document.getElementById('fixed-day').value='';
  initEmojiPicker('fixed','🏠');
  renderGenericColorPicker('fixed-color-picker','');
  document.getElementById('btn-del-fixed').style.display='none';
  openModal('modal-fixed');
}
function editFixed(id){
  const f=(state.fixedExpenses||[]).find(x=>x.id===id);if(!f)return;
  document.getElementById('modal-fixed-title').textContent='Editar gasto fijo';
  document.getElementById('modal-fixed-editing').value=id;
  document.getElementById('fixed-name').value=f.name;
  document.getElementById('fixed-amount').value=f.amount;
  document.getElementById('fixed-currency').value=f.currency||'ARS';
  document.getElementById('fixed-day').value=f.day||'';
  initEmojiPicker('fixed',f.emoji||'🏠');
  renderGenericColorPicker('fixed-color-picker',f.color||'');
  document.getElementById('btn-del-fixed').style.display='inline-flex';
  openModal('modal-fixed');
}
function saveFixed(){
  const name=document.getElementById('fixed-name').value.trim();
  const amount=parseFloat(document.getElementById('fixed-amount').value)||0;
  if(!name||amount<=0){showToast('⚠️ Completá nombre y monto');return;}
  const sw=document.querySelector('#fixed-color-picker .color-swatch.selected');const rawC=sw?sw.style.backgroundColor:'#888888';const fixedColor=rawC.startsWith('#')?rawC:rgbToHex(rawC);
  const obj={
    id:document.getElementById('modal-fixed-editing').value||Date.now().toString(36),
    name,amount,
    currency:document.getElementById('fixed-currency').value,
    day:parseInt(document.getElementById('fixed-day').value)||null,
    emoji:document.getElementById('fixed-emoji').value||'🏠',
    color:fixedColor
  };
  if(!state.fixedExpenses)state.fixedExpenses=[];
  const editing=document.getElementById('modal-fixed-editing').value;
  if(editing){const i=state.fixedExpenses.findIndex(x=>x.id===editing);if(i>=0)state.fixedExpenses[i]=obj;}
  else state.fixedExpenses.push(obj);
  saveState();closeModal('modal-fixed');
  renderFixed();renderCompromisosSummary();refreshAll();
  showToast('✓ Gasto fijo guardado');
}
function deleteFixed(){
  const id=document.getElementById('modal-fixed-editing').value;
  state.fixedExpenses=(state.fixedExpenses||[]).filter(f=>f.id!==id);
  saveState();closeModal('modal-fixed');
  renderFixed();renderCompromisosSummary();refreshAll();
  showToast('Gasto fijo eliminado');
}
function renderCompromisosSummary(){
  const toMonthly=s=>{if(s.freq==='monthly')return s.price;if(s.freq==='annual')return s.price/12;if(s.freq==='weekly')return s.price*4.3;return s.price;};
  // ARS: cuotas + subs ARS + fijos ARS
  const autoGroups=typeof detectAutoCuotas==='function'?detectAutoCuotas():[];
  const cuotasARS=[
    ...autoGroups.map(g=>{const snap=getAutoCuotaSnapshot(g);return snap.paid>=snap.total?0:snap.amountPerCuota;}),
    ...state.cuotas.filter(c=>c.paid<c.total).map(c=>c.amount)
  ].reduce((s,v)=>s+v,0);
  const subsARS=state.subscriptions.filter(s=>s.currency==='ARS').reduce((a,s)=>a+toMonthly(s),0);
  const fixedARS=(state.fixedExpenses||[]).filter(f=>f.currency==='ARS').reduce((a,f)=>a+f.amount,0);
  const totalARS=cuotasARS+subsARS+fixedARS;
  // USD: subs USD + fijos USD
  const subsUSD=state.subscriptions.filter(s=>s.currency==='USD').reduce((a,s)=>a+toMonthly(s),0);
  const fixedUSD=(state.fixedExpenses||[]).filter(f=>f.currency==='USD').reduce((a,f)=>a+f.amount,0);
  const totalUSD=subsUSD+fixedUSD;
  const combinado=totalARS+(totalUSD*USD_TO_ARS);
  const sumEl=document.getElementById('compromisos-summary');
  if(sumEl){
    sumEl.style.display=(totalARS>0||totalUSD>0)?'block':'none';
    const arsEl=document.getElementById('comp-total-ars');
    const usdEl=document.getElementById('comp-total-usd');
    const combEl=document.getElementById('comp-total-combinado');
    if(arsEl)arsEl.textContent='$'+fmtN(Math.round(totalARS));
    if(usdEl)usdEl.textContent=totalUSD>0?'U$D '+fmtN(totalUSD):'—';
    if(combEl)combEl.textContent='$'+fmtN(Math.round(combinado));

    // ── Fill inner cards ──
    const fijosVal=fixedARS+(fixedUSD*USD_TO_ARS);
    const subsVal=subsARS+(subsUSD*USD_TO_ARS);
    const nF=(state.fixedExpenses||[]).length;
    const nS=state.subscriptions.length;
    const nC=autoGroups.length+state.cuotas.filter(c=>c.paid<c.total).length;
    const cardFijos=document.getElementById('comp-card-fijos');
    const cardCuotas=document.getElementById('comp-card-cuotas');
    const cardSubs=document.getElementById('comp-card-subs');
    if(cardFijos){cardFijos.textContent='$'+fmtN(Math.round(fijosVal));}
    if(cardCuotas){cardCuotas.textContent='$'+fmtN(Math.round(cuotasARS));}
    if(cardSubs){cardSubs.textContent='$'+fmtN(Math.round(subsVal));}
    const cardFijosN=document.getElementById('comp-card-fijos-n');
    const cardCuotasN=document.getElementById('comp-card-cuotas-n');
    const cardSubsN=document.getElementById('comp-card-subs-n');
    if(cardFijosN)cardFijosN.textContent=nF+' gasto'+(nF!==1?'s':'')+' fijo'+(nF!==1?'s':'');
    if(cardCuotasN)cardCuotasN.textContent=nC+' cuota'+(nC!==1?'s':'')+' activa'+(nC!==1?'s':'');
    if(cardSubsN)cardSubsN.textContent=nS+' suscripci'+(nS!==1?'ones':'ón');

    // ── Stacked distribution bar ──
    const distBar=document.getElementById('comp-dist-bar');
    if(distBar&&combinado>0){
      const segments=[
        {value:fijosVal, color:'var(--accent2)'},
        {value:cuotasARS, color:'var(--accent3)'},
        {value:subsVal, color:'var(--purple)'},
      ].filter(s=>s.value>0);
      distBar.innerHTML=segments.map(s=>{
        const pct=Math.max(2,Math.round(s.value/combinado*100));
        return '<div style="width:'+pct+'%;height:100%;background:'+s.color+';transition:width .6s ease;"></div>';
      }).join('');
    }

    // USD badge
    const usdBadge=document.getElementById('comp-usd-badge');
    if(usdBadge){
      if(totalUSD>0){usdBadge.style.display='block';usdBadge.textContent='Incluye U$D '+fmtN(totalUSD)+' (TC $'+fmtN(USD_TO_ARS)+')';}
      else usdBadge.style.display='none';
    }

    // ── Old dist chart (hidden compat) ──
    const distEl=document.getElementById('comp-dist-chart');
    if(distEl)distEl.innerHTML='';
  }
}

// ══ SUSCRIPCIONES ══
function renderSubs(){
  if(!state.subscriptions.length){document.getElementById('subs-empty').style.display='block';document.getElementById('subs-content').style.display='none';return;}
  document.getElementById('subs-empty').style.display='none';document.getElementById('subs-content').style.display='flex';
  const toMonthly=(s)=>{if(s.freq==='monthly')return s.price;if(s.freq==='annual')return s.price/12;if(s.freq==='weekly')return s.price*4.3;return s.price;};
  const totalARS=state.subscriptions.filter(s=>s.currency==='ARS').reduce((acc,s)=>acc+toMonthly(s),0);
  const totalUSD=state.subscriptions.filter(s=>s.currency==='USD').reduce((acc,s)=>acc+toMonthly(s),0);
  document.getElementById('subs-total-bar').innerHTML='<div class="subs-total-item"><div class="subs-total-label">TOTAL MENSUAL ARS</div><div class="subs-total-val" style="color:var(--accent);">$'+fmtN(totalARS)+'</div></div><div class="subs-divider"></div><div class="subs-total-item"><div class="subs-total-label">TOTAL MENSUAL USD</div><div class="subs-total-val" style="color:var(--accent2);">U$D '+fmtN(totalUSD)+'</div></div><div class="subs-divider"></div><div class="subs-total-item"><div class="subs-total-label">SUSCRIPCIONES</div><div class="subs-total-val">'+state.subscriptions.length+'</div></div>';
  const freqLabel={monthly:'Mensual',annual:'Anual',weekly:'Semanal'};
  document.getElementById('subs-grid').innerHTML=state.subscriptions.map(s=>{
    const c=s.color||'#888888';const monthly=toMonthly(s);
    const day=s.day;const daysUntil=getDaysUntilNext(day);
    const nextText=daysUntil!==null?'Próximo cobro en <span>'+daysUntil+' días (día '+day+')</span>':'Día de cobro no configurado';
    return'<div class="sub-card"><div class="sub-card-accent" style="background:'+c+';"></div><div class="sub-header"><div class="sub-icon" style="background:'+c+'22;color:'+c+'">'+esc(s.emoji||'●')+'</div><div><div class="sub-name">'+esc(s.name)+'</div><div class="sub-cat">'+esc(s.cat||'Plataformas')+'</div></div><button class="btn btn-ghost btn-sm btn-icon" style="margin-left:auto" onclick="editSub(\''+s.id+'\')">✎</button></div><div class="sub-price-row"><div class="sub-price" style="color:'+c+';">'+(s.currency==='USD'?'U$D ':'$')+fmtN(s.price)+'</div><div class="sub-freq">'+freqLabel[s.freq||'monthly']+(s.freq==='annual'?' · $'+fmtN(monthly)+'/mes':'')+' · '+s.currency+'</div></div><div class="sub-next">'+nextText+'</div></div>';
  }).join('');
  renderSubsAnnual();
}
function openNewSubModal(){
  document.getElementById('modal-sub-title').textContent='Nueva suscripción';
  document.getElementById('modal-sub-editing').value='';
  document.getElementById('sub-name').value='';
  document.getElementById('sub-price').value='';document.getElementById('sub-day').value='';
  document.getElementById('sub-currency').value='ARS';document.getElementById('sub-freq').value='monthly';
  document.getElementById('btn-del-sub').style.display='none';
  initEmojiPicker('sub','🔔');
  // Populate category dropdown
  let scOpts='';CATEGORY_GROUPS.forEach(g=>{scOpts+='<optgroup label="'+g.emoji+' '+g.group+'">';g.subs.forEach(s=>{scOpts+='<option value="'+s+'">'+s+'</option>';});scOpts+='</optgroup>';});
  document.getElementById('sub-cat').innerHTML=scOpts;
  renderSubColorPicker('');openModal('modal-sub');
}
function editSub(id){
  const s=state.subscriptions.find(x=>x.id===id);if(!s)return;
  document.getElementById('modal-sub-title').textContent='Editar suscripción';
  document.getElementById('modal-sub-editing').value=id;
  document.getElementById('sub-name').value=s.name;
  document.getElementById('sub-price').value=s.price;document.getElementById('sub-day').value=s.day||'';
  document.getElementById('sub-currency').value=s.currency||'ARS';document.getElementById('sub-freq').value=s.freq||'monthly';
  document.getElementById('sub-cat').value=s.cat||'Plataformas';
  document.getElementById('btn-del-sub').style.display='inline-flex';
  initEmojiPicker('sub',s.emoji||'●');
  renderSubColorPicker(s.color||'');openModal('modal-sub');
}
function renderSubColorPicker(sel){document.getElementById('sub-color-picker').innerHTML=PALETTE.map(c=>'<div class="color-swatch '+(c===sel?'selected':'')+'" style="background:'+c+'" onclick="selectSwatch(\''+c+'\',this,\'sub-color-picker\')"></div>').join('');}
function saveSub(){
  const name=document.getElementById('sub-name').value.trim();const price=parseFloat(document.getElementById('sub-price').value)||0;
  if(!name||price<=0){showToast('⚠️ Completá nombre y precio','error');return;}
  const sw=document.querySelector('#sub-color-picker .color-swatch.selected');const rawC=sw?sw.style.backgroundColor:'#888888';const color=rawC.startsWith('#')?rawC:rgbToHex(rawC);
  const obj={id:Date.now().toString(36),name,emoji:document.getElementById('sub-emoji').value||'🔔',price,currency:document.getElementById('sub-currency').value,freq:document.getElementById('sub-freq').value,day:parseInt(document.getElementById('sub-day').value)||null,cat:document.getElementById('sub-cat').value,color};
  const editing=document.getElementById('modal-sub-editing').value;
  if(editing){const i=state.subscriptions.findIndex(x=>x.id===editing);if(i>=0)state.subscriptions[i]={...state.subscriptions[i],...obj,id:editing};}
  else state.subscriptions.push(obj);
  saveState();closeModal('modal-sub');renderSubs();refreshAll();showToast('✓ Suscripción guardada','success');
}
function deleteSub(){
  const id=document.getElementById('modal-sub-editing').value;
  state.subscriptions=state.subscriptions.filter(s=>s.id!==id);
  saveState();closeModal('modal-sub');renderSubs();refreshAll();showToast('Suscripción eliminada','info');
}

// ══ RENDER SUBS ANNUAL BREAKDOWN ══
function renderSubsAnnual(){
  const toMonthly=(s)=>{if(s.freq==='monthly')return s.price;if(s.freq==='annual')return s.price/12;if(s.freq==='weekly')return s.price*4.3;return s.price;};
  const toAnnual=(s)=>toMonthly(s)*12;
  if(!state.subscriptions.length){document.getElementById('subs-annual-card').style.display='none';return;}
  const sorted=[...state.subscriptions].sort((a,b)=>toAnnual(b)-toAnnual(a));
  const totalAnnual=sorted.filter(s=>s.currency==='ARS').reduce((acc,s)=>acc+toAnnual(s),0);
  const totalAnnualUSD=sorted.filter(s=>s.currency==='USD').reduce((acc,s)=>acc+toAnnual(s),0);
  const maxAnn=Math.max(...sorted.map(s=>toAnnual(s)),1);
  document.getElementById('subs-annual-card').style.display='block';
  const totalParts=[];
  if(totalAnnual>0)totalParts.push('$'+fmtN(Math.round(totalAnnual))+' ARS/año');
  if(totalAnnualUSD>0)totalParts.push('U$D '+fmtN(Math.round(totalAnnualUSD))+'/año');
  document.getElementById('subs-annual-total').textContent=totalParts.join(' + ');
  document.getElementById('subs-annual-list').innerHTML=sorted.map(s=>{
    const c=s.color||'#888888';const ann=toAnnual(s);const w=Math.round(ann/maxAnn*100);
    const prefix=s.currency==='USD'?'U$D ':'$';
    return`<div style="display:flex;align-items:center;gap:12px;">
      <div style="font-size:18px;width:28px;text-align:center;flex-shrink:0;">${esc(s.emoji||'●')}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:5px;">
          <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(s.name)}</div>
          <div style="font-size:13px;font-family:var(--font);font-weight:700;color:${c};flex-shrink:0;">${prefix}${fmtN(Math.round(ann))}/año</div>
        </div>
        <div style="height:5px;background:var(--surface3);border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${w}%;background:${c};border-radius:3px;transition:width 0.5s ease;"></div>
        </div>
        <div style="font-size:10px;color:var(--text3);font-family:var(--font);margin-top:3px;">${prefix}${fmtN(Math.round(ann/12))}/mes · ${s.freq==='annual'?'Cobro anual':s.freq==='weekly'?'Semanal':'Mensual'}</div>
      </div>
    </div>`;
  }).join('');
}
