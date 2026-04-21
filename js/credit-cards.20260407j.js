// ══ TARJETA DE CRÉDITO ══
// Persistencia: state.ccCards, state.ccCycles (integrado en state global)

// ── Inicializar datos por defecto ──
function ccInit(){
  if(!state.ccCards||!state.ccCards.length){
    state.ccCards=[
      {id:'card_1',name:'Santander VISA',color:'#e63946',payMethodKey:'visa'},
      {id:'card_2',name:'Santander AMEX',color:'#457b9d',payMethodKey:'amex'}
    ];
  }
  // Migrar tarjetas viejas sin payMethodKey
  state.ccCards.forEach(c=>{
    if(!c.payMethodKey){
      if(c.name&&c.name.toLowerCase().includes('visa'))c.payMethodKey='visa';
      else if(c.name&&(c.name.toLowerCase().includes('amex')||c.name.toLowerCase().includes('mastercard')))c.payMethodKey='amex';
    }
    // Fix legacy "Santander Mastercard" name
    if(c.name==='Santander Mastercard')c.name='Santander AMEX';
  });
  if(!state.ccCycles) state.ccCycles=[];
  if(!state.ccActiveCard) state.ccActiveCard=state.ccCards[0]?.id||'card_1';
}

// ── Per-card: which cycle is being viewed ──
// window._ccViewCycle = { cardId: cycleId }
if(!window._ccViewCycle) window._ccViewCycle={};

// ── Utilidades de fecha ──
function ccFmtDate(str){
  if(!str)return'—';
  const d=new Date(str+'T12:00:00');
  return d.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
}
function ccCountdown(dueDateStr){
  if(!dueDateStr)return{text:'—',overdue:false};
  const today=new Date();today.setHours(0,0,0,0);
  const due=new Date(dueDateStr+'T12:00:00');due.setHours(0,0,0,0);
  const diff=Math.round((due-today)/(1000*60*60*24));
  if(diff<0)return{text:'VENCIDO ('+Math.abs(diff)+'d)',overdue:true};
  if(diff===0)return{text:'Vence hoy',overdue:false,urgent:true};
  return{text:'Vence en '+diff+' días',overdue:false,urgent:diff<=3};
}

// ── Obtener gastos del ciclo (movimientos + manuales) ──
function ccGetCycleExpenses(cardId, tcCycleId){
  if(!state.ccCards) state.ccCards=[];
  const card=state.ccCards.find(c=>c.id===cardId);
  const pmKey=card?.payMethodKey||null;
  const genericOwnerId=state.ccActiveCard||state.ccCards.find(c=>c.payMethodKey==='visa')?.id||state.ccCards[0]?.id||null;
  const tcCycles=getTcCycles();
  const idx=tcCycles.findIndex(c=>c.id===tcCycleId);
  if(idx<0)return[];
  const openDate=getTcCycleOpen(tcCycles, idx);
  const cycle=tcCycles[idx];

  const ccState=state.ccCycles.find(c=>c.cardId===cardId && c.tcCycleId===tcCycleId) || {excludedIds:[], manualExpenses:[]};
  const excluded=new Set(ccState.excludedIds||[]);
  
  // TC payMethod values that count as a credit card charge for this cycle
  const _tcGeneric=['tc','Tarjeta de Crédito','tarjeta_credito'];
  const txnExpenses=(state.transactions||[]).filter(t=>{
    if(excluded.has(t.id))return false;
    if(pmKey){
      // Exact card match always counts. Generic TC tags count only once on the owner card.
      const _match=t.payMethod===pmKey||(_tcGeneric.includes(t.payMethod)&&cardId===genericOwnerId);
      if(!_match)return false;
    }
    const d=dateToYMD(t.date);
    return d>=openDate && d<=cycle.closeDate;
  }).map(t=>({
    id:t.id, date:dateToYMD(t.date), description:t.description, category:t.category||'Sin categoría',
    amountARS:t.currency==='ARS'?t.amount:0,
    amountUSD:t.currency==='USD'?t.amount:0,
    isPendingCuota:!!t.isPendingCuota,
    isPendingSubscription:!!t.isPendingSubscription,
    source:'txn'
  }));
  const projectedExpenses=getProjectedCommitmentEntriesForRange({
    startStr:openDate,
    endStr:cycle.closeDate,
    todayRef:new Date(),
    txns:state.transactions||[]
  }).filter(entry=>{
    if(!(entry.includeInTotal && (entry.synthetic || entry.kind==='Cuota proyectada' || entry.kind==='Suscripción proyectada'))) return false;
    if(pmKey){
      const match=entry.payMethod===pmKey||((!entry.payMethod||_tcGeneric.includes(entry.payMethod))&&cardId===genericOwnerId);
      if(!match) return false;
    }
    return !excluded.has(entry._key||'');
  }).map(entry=>({
    id:entry._key||`proj-${dateToYMD(entry.date)}-${entry.title}`,
    date:dateToYMD(entry.date),
    description:entry.title,
    category:entry.group==='cuotas'?'Cuotas':entry.group==='suscripciones'?'Suscripciones':'Compromisos',
    amountARS:(entry.currency||'ARS')==='USD'?0:Number(entry.amount)||0,
    amountUSD:(entry.currency||'ARS')==='USD'?Number(entry.amount)||0:0,
    isPendingCuota:entry.group==='cuotas',
    isPendingSubscription:entry.group==='suscripciones',
    source:'projected'
  }));

  const manualExpenses=(ccState.manualExpenses||[]).map(e=>({...e,source:'manual'}));
  return [...txnExpenses,...projectedExpenses,...manualExpenses].sort((a,b)=>b.date.localeCompare(a.date));
}

// ── Totales del ciclo ──
function ccGetTotals(expenses){
  return{
    ars:expenses.reduce((s,e)=>s+(e.amountARS||0),0),
    usd:expenses.reduce((s,e)=>s+(e.amountUSD||0),0),
    count:expenses.length
  };
}

// ── Resumen por categoría ──
function ccGetCatSummary(expenses){
  const cats={};
  expenses.forEach(e=>{
    const cat=e.category||'Sin categoría';
    if(!cats[cat])cats[cat]={ars:0,usd:0};
    cats[cat].ars+=(e.amountARS||0);
    cats[cat].usd+=(e.amountUSD||0);
  });
  return Object.entries(cats)
    .sort((a,b)=>b[1].ars-a[1].ars)
    .map(([cat,v])=>({cat,...v}));
}

// ── Alertas al cargar la app ──
function checkCreditCardAlerts(){
  if(!state.ccCycles||!state.ccCards)return;
  const todayStr=new Date().toISOString().slice(0,10);
  state.ccCycles.filter(c=>c.status==='pending').forEach(c=>{
    const card=state.ccCards.find(x=>x.id===c.cardId);
    const name=card?card.name:'Tarjeta';
    if(c.closeDate===todayStr){
      setTimeout(()=>showToast('💳 Hoy cierra el ciclo de '+name+'. Ya podés pagar el resumen.','info'),800);
    } else if(c.dueDate&&c.dueDate===todayStr){
      setTimeout(()=>showToast('⚠️ Hoy es el último día para pagar '+name+'. ¡No lo dejes para después!','error'),800);
    } else if(c.dueDate&&todayStr>c.dueDate){
      setTimeout(()=>showToast('🚨 El pago de '+name+' está VENCIDO (venció el '+ccFmtDate(c.dueDate)+')','error'),800);
    }
  });
}

// ── Tab de página: Resumen | Configuración ──
function ccSelectPageTab(tab){
  if(!tab) tab='resumen';
  if(tab==='compare'){
    nav('cc-compare');
    return;
  }
  state.ccPageTab=tab;
  renderCreditCards();
}

// ── Renderizar página completa ──
function renderCreditCards(){
  ccInit();
  renderCcCardTabs();
  const tab=state.ccPageTab||'resumen';
  const sub=document.getElementById('cc-page-subtitle');
  if(sub){
    sub.textContent=tab==='config'
      ? 'Ajustá aperturas, cierres y vencimientos sin perder consistencia en la app.'
      : 'Centro operativo para revisar resumen, vencimiento, consumos y conciliación.';
  }
  // Apply tab visibility
  document.getElementById('cpt-resumen')?.classList.toggle('active',tab==='resumen');
  document.getElementById('cpt-config')?.classList.toggle('active',tab==='config');
  document.getElementById('cpt-compare')?.classList.remove('active');
  const pr=document.getElementById('cc-panel-resumen');
  const pc=document.getElementById('cc-panel-config');
  if(pr){
    pr.hidden=tab!=='resumen';
    pr.style.display=tab==='resumen'?'flex':'none';
  }
  if(pc){
    pc.hidden=tab!=='config';
    pc.style.display=tab==='config'?'flex':'none';
  }
  if(tab==='resumen'){
    renderCcActiveCycle();
  } else {
    renderCcConfigPanel();
  }
}

function renderCcCardTabs(){
  const el=document.getElementById('cc-card-tabs');if(!el)return;
  const cycles=getTcCycles();
  el.innerHTML=state.ccCards.map(card=>{
    const isActive=state.ccActiveCard===card.id;
    const cycle=cycles.find(c=>((c.cardId||state.ccCards[0]?.id)===card.id));
    const totals=cycle?ccGetTotals(ccGetCycleExpenses(card.id,cycle.id)):{ars:0,usd:0,count:0};
    const status=cycle?state.ccCycles.find(s=>s.cardId===card.id&&s.tcCycleId===cycle.id):null;
    return `<button class="cc-card-switch ${isActive?'is-active':''}" onclick="ccSelectCard('${card.id}')" style="--cc-card-color:${card.color};">
      <span class="cc-card-switch-dot"></span>
      <span class="cc-card-switch-main">
        <strong>${esc(card.name)}</strong>
        <small>${cycle?esc(cycle.label):'Sin ciclo'} · ${status?.status==='paid'?'pagado':'pendiente'}</small>
      </span>
      <span class="cc-card-switch-total">${totals.ars>0?'$'+fmtN(Math.round(totals.ars)):'—'}</span>
    </button>`;
  }).join('');
}

function ccSelectCard(cardId){
  ccInit();
  state.ccActiveCard=cardId;
  window._ccViewCycle[cardId]=null; // reset viewed cycle for this card
  renderCreditCards();
}

function ccSelectViewCycle(cycleId){
  const cardId=state.ccActiveCard||state.ccCards[0]?.id;
  window._ccViewCycle[cardId]=cycleId;
  renderCreditCards();
}

function ccEditCycleFromSummary(cycleId){
  state.ccPageTab='config';
  renderCreditCards();
  editTcCycle(cycleId);
}

function renderCcActiveCycle(){
  ccInit();
  const panelEl=document.getElementById('cc-panel-resumen');
  const stageEl=document.getElementById('cc-active-cycle-section');
  const emptyEl=document.getElementById('cc-empty-state');
  const activeEl=document.getElementById('cc-active-cycle');
  const actionsEl=document.getElementById('cc-page-actions');
  if(!emptyEl||!activeEl)return;
  if(panelEl){
    panelEl.hidden=false;
    panelEl.style.display='flex';
  }
  if(stageEl) stageEl.style.display='block';
  try{
    const cardId=state.ccActiveCard||state.ccCards[0]?.id;
    const card=state.ccCards.find(c=>c.id===cardId);
    const tcCycles=getTcCycles(); 

    if(!tcCycles.length){
      emptyEl.style.display='block';activeEl.style.display='none';
      if(actionsEl)actionsEl.innerHTML='';
      return;
    }
    emptyEl.style.display='none';activeEl.style.display='block';

    // Ciclo visible: el que seleccionó el usuario, o el más reciente PENDIENTE
    const viewingId=window._ccViewCycle[cardId];
    let activeTcCycle=null;
    if (viewingId) {
      activeTcCycle = tcCycles.find(c=>c.id===viewingId) || tcCycles[0];
    } else {
      // Buscar el más reciente no pagado
      activeTcCycle = tcCycles.find(c=>{
        const s = state.ccCycles.find(x => x.cardId === cardId && x.tcCycleId === c.id);
        return !s || s.status !== 'paid';
      }) || tcCycles[0];
    }
    const activeCycleIdx=tcCycles.findIndex(c=>c.id===activeTcCycle.id);
    const openDate=getTcCycleOpen(tcCycles, activeCycleIdx) || activeTcCycle.closeDate;
  
  // Buscar o crear estado en ccCycles para este par {cardId, tcCycleId}
  let ccState=state.ccCycles.find(c=>c.cardId===cardId && c.tcCycleId===activeTcCycle.id);
  if(!ccState){
    ccState={id:activeTcCycle.id+'_'+cardId, cardId, tcCycleId:activeTcCycle.id, status:'pending', manualExpenses:[], excludedIds:[]};
    // No lo pusheamos al state real a menos que se modifique algo (pago, gasto manual, etc) para evitar engrosar el state innecesariamente
  }

  const expenses = ccGetCycleExpenses(cardId, activeTcCycle.id);
  const totals=ccGetTotals(expenses);
  const catSummary=ccGetCatSummary(expenses);
  const isPaid=ccState.status==='paid';
  const dueDate=ccState.dueDate || activeTcCycle.dueDate;
  const dueMeta=ccCountdown(dueDate);
  const today=new Date();today.setHours(0,0,0,0);
  const openD=new Date(openDate+'T12:00:00');openD.setHours(0,0,0,0);
  const closeD=new Date(activeTcCycle.closeDate+'T12:00:00');closeD.setHours(0,0,0,0);
  const totalDays=Math.max(1,Math.round((closeD-openD)/86400000)+1);
  const elapsedDays=Math.min(totalDays,Math.max(0,Math.round((today-openD)/86400000)+1));
  const progressPct=Math.max(0,Math.min(100,Math.round((elapsedDays/totalDays)*100)));
  const projectedCount=expenses.filter(e=>e.source==='projected').length;
  const manualCount=expenses.filter(e=>e.source==='manual').length;
  const realCount=expenses.filter(e=>e.source==='txn').length;

  // Selector de ciclo en la cabecera
  if(actionsEl){
    actionsEl.innerHTML=`
      <div class="cc-period-picker">
        <span class="cc-period-picker-label">Período</span>
        <select class="cc-period-picker-select" onchange="ccSelectViewCycle(this.value)">
          ${tcCycles.map(c=>{
            const s=state.ccCycles.find(x=>x.cardId===cardId && x.tcCycleId===c.id);
            const paid=s && s.status==='paid';
            return `<option value="${c.id}" ${c.id===activeTcCycle.id?'selected':''}>${paid?'✓ ':'⏳ '}${esc(c.label)}</option>`;
          }).join('')}
        </select>
      </div>
    `;
  }

  const catRows=catSummary.slice(0,6).map(r=>`
    <div class="cc-cat-line">
      <span>${esc(r.cat)}</span>
      <strong>${r.ars>0?'$'+fmtN(Math.round(r.ars)):'—'}${r.usd>0?' · U$D '+fmtN(r.usd):''}</strong>
    </div>
  `).join('');

  const expRows=expenses.map(e=>{
    const removeBtn=e.source==='txn'
      ?`<button class="cc-row-clean-btn" onclick="ccExcludeTxn('${activeTcCycle.id}','${e.id}')" title="Excluir de este ciclo">Excluir</button>`
      :`<button class="cc-row-clean-btn" onclick="ccDeleteManualExpense('${activeTcCycle.id}','${e.id}')" title="Eliminar gasto manual">Borrar</button>`;
    const sourceLabel=e.source==='projected'?'Proyectado':e.source==='manual'?'Manual':'Movimiento';
    return `<div class="cc-expense-row">
      <div class="cc-expense-date">${ccFmtDate(e.date)}</div>
      <div class="cc-expense-main">
        <strong>${esc(e.description)}</strong>
        <small>${esc(e.category)} · ${sourceLabel}</small>
      </div>
      <div class="cc-expense-amount">
        <strong>${e.amountARS>0?'$'+fmtN(Math.round(e.amountARS)):'—'}</strong>
        <small>${e.amountUSD>0?'U$D '+fmtN(e.amountUSD):''}</small>
      </div>
      ${removeBtn}
    </div>`;
  }).join('');

  // Paid history
  const paidCycles = (state.ccCycles||[]).filter(c => c.cardId === cardId && c.status === 'paid');

  activeEl.innerHTML=`
    <div class="cc-workspace">
      <section class="cc-focus-panel fade-up d1">
        <div class="cc-focus-main">
          <div class="cc-focus-topline">
            <span class="cc-focus-chip ${isPaid?'is-paid':'is-pending'}">${isPaid?'Pagado':'Pendiente'}</span>
            ${card?`<span class="cc-focus-card" style="--cc-card-color:${card.color};">${esc(card.name)}</span>`:''}
            <span class="cc-focus-muted">${esc(activeTcCycle.label)}</span>
          </div>
          <div class="cc-focus-total">$${fmtN(Math.round(totals.ars))}</div>
          <div class="cc-focus-sub">${totals.usd>0?'U$D '+fmtN(totals.usd)+' · ':''}${expenses.length} item${expenses.length===1?'':'s'} en el ciclo</div>
          <div class="cc-cycle-progress">
            <div class="cc-cycle-progress-head"><span>${ccFmtDate(openDate)}</span><strong>${progressPct}% del ciclo</strong><span>${ccFmtDate(activeTcCycle.closeDate)}</span></div>
            <div class="cc-cycle-progress-track"><span style="width:${progressPct}%;"></span></div>
          </div>
        </div>
        <aside class="cc-focus-side">
          <div class="cc-due-block ${dueMeta.overdue?'is-overdue':dueMeta.urgent?'is-urgent':''}">
            <span>Vencimiento</span>
            <strong>${ccFmtDate(dueDate)}</strong>
            <small>${dueMeta.text}</small>
          </div>
          <div class="cc-action-grid">
            <button class="btn btn-primary btn-sm" onclick="ccOpenManualExpenseModal('${activeTcCycle.id}')">Agregar gasto</button>
            <button class="btn btn-ghost btn-sm" onclick="ccEditCycleFromSummary('${activeTcCycle.id}')">Editar ciclo</button>
            <button class="btn btn-ghost btn-sm" onclick="nav('cc-compare')">Comparar PDF</button>
            ${isPaid?'<button class="btn btn-ghost btn-sm" disabled>Pagado</button>':`<button class="btn btn-ghost btn-sm" onclick="ccMarkPaid('${activeTcCycle.id}')">Marcar pagado</button>`}
          </div>
        </aside>
      </section>

      <section class="cc-ops-grid fade-up d2">
        <div class="table-card cc-insight-panel">
          <div class="cc-panel-head">
            <div><span class="cc-panel-kicker">Composición</span><strong>Qué pesa en este resumen</strong></div>
            <small>${catSummary.length} categoría${catSummary.length===1?'':'s'}</small>
          </div>
          <div class="cc-cat-list">${catRows || '<div class="cc-empty-inline">Sin categorías todavía</div>'}</div>
        </div>
        <div class="table-card cc-insight-panel">
          <div class="cc-panel-head">
            <div><span class="cc-panel-kicker">Origen</span><strong>Lectura del total</strong></div>
          </div>
          <div class="cc-origin-grid">
            <div><span>Reales</span><strong>${realCount}</strong></div>
            <div><span>Proyectados</span><strong>${projectedCount}</strong></div>
            <div><span>Manuales</span><strong>${manualCount}</strong></div>
          </div>
          <p class="cc-panel-note">Los proyectados incluyen cuotas y compromisos ya maduros dentro del período.</p>
        </div>
      </section>

      <details class="table-card cc-record-panel fade-up d3" open>
        <summary>
          <div><span class="cc-panel-kicker">Movimientos</span><strong>Gastos del ciclo (${expenses.length})</strong></div>
          <span>Desplegar</span>
        </summary>
        <div class="cc-expense-list">${expenses.length?expRows:'<div class="cc-empty-inline">Sin gastos en este ciclo</div>'}</div>
      </details>

      ${paidCycles.length?`
        <details class="table-card cc-record-panel fade-up d3">
          <summary>
            <div><span class="cc-panel-kicker">Historial</span><strong>Ciclos pagados (${paidCycles.length})</strong></div>
            <span>Desplegar</span>
          </summary>
          <div class="cc-paid-list">${_ccBuildPaidHistoryHtml(cardId, paidCycles, tcCycles)}</div>
        </details>
      `:''}
    </div>
  `;

    // Update History Section
    const histSec = document.getElementById('cc-history-section');
    const histList = document.getElementById('cc-history-list');
    if (histSec && histList) {
      histSec.style.display = 'none';
      histList.innerHTML = '';
    }
  }catch(err){
    console.error('renderCcActiveCycle error', err);
    if(actionsEl) actionsEl.innerHTML='';
    emptyEl.style.display='block';
    activeEl.style.display='none';
    emptyEl.innerHTML=`
      <div class="cc-empty-icon">◫</div>
      <div class="cc-empty-title">No pude cargar el resumen</div>
      <div class="cc-empty-sub">Hubo un problema al armar esta vista. Probá cambiar de tarjeta o recargar la página.</div>
    `;
  }
}

// ── Paid History HTML builder ──
function _ccBuildPaidHistoryHtml(cardId, paidCycles, tcCycles) {
  const rows = paidCycles.map(pc => {
    const tc = tcCycles.find(c => c.id === pc.tcCycleId);
    if(!tc) return '';
    const pidx = tcCycles.findIndex(c => c.id === pc.tcCycleId);
    const pOpen = getTcCycleOpen(tcCycles, pidx);
    const pExp = ccGetCycleExpenses(cardId, pc.tcCycleId);
    const pTot = ccGetTotals(pExp);
    const isViewing = window._ccViewCycle[cardId] === pc.tcCycleId;
    const dueTxt = pc.dueDate ? ccFmtDate(pc.dueDate) : '—';
    return `<div onclick="ccSelectViewCycle('${pc.tcCycleId}')"
      style="padding:12px 20px;display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--border);cursor:pointer;background:${isViewing?'rgba(52,199,89,0.07)':'transparent'};transition:background .12s;"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='${isViewing?'rgba(52,199,89,0.07)':'transparent'}'">
      <span style="font-size:18px;color:var(--green-sys);">✓</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:var(--text);">${esc(tc.label)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">${ccFmtDate(pOpen)} → ${ccFmtDate(tc.closeDate)}${pc.dueDate?' · Vto. '+dueTxt:''}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:13px;font-weight:700;color:var(--accent);font-family:var(--font);">$${fmtN(Math.round(pTot.ars))}</div>
        ${pTot.usd>0?`<div style="font-size:11px;color:var(--accent2);">U$D ${fmtN(pTot.usd)}</div>`:''}
      </div>
    </div>`;
  }).join('');

  return `<div id="cc-paid-history-wrap" style="margin-top:10px;background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;">
    <div onclick="ccTogglePaidHistory()" style="padding:14px 20px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:14px;color:var(--green-sys);">✓</span>
        <span style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text3);">Historial de pagos (${paidCycles.length})</span>
      </div>
      <span id="cc-hist-arrow" style="font-size:12px;color:var(--text3);transition:transform .15s;">▾</span>
    </div>
    <div id="cc-paid-history-body" style="border-top:1px solid var(--border);">${rows}</div>
  </div>`;
}

// ── Set due date ──
function ccSetDueDate(tcCycleId) {
  const cardId = state.ccActiveCard || state.ccCards[0]?.id;
  let ccState = state.ccCycles.find(c => c.cardId === cardId && c.tcCycleId === tcCycleId);
  const current = ccState?.dueDate || '';
  const date = prompt('Fecha de vencimiento (YYYY-MM-DD):', current);
  if(date === null) return;
  if(date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { showToast('⚠️ Formato inválido. Usá YYYY-MM-DD','error'); return; }
  if(!ccState) {
    ccState = {id:tcCycleId+'_'+cardId, cardId, tcCycleId, status:'pending', manualExpenses:[], excludedIds:[]};
    state.ccCycles.push(ccState);
  }
  ccState.dueDate = date || null;
  saveState();
  renderCcActiveCycle();
  showToast(date ? '✓ Vencimiento guardado' : 'Vencimiento eliminado','success');
}

// ── Toggle paid history ──
function ccTogglePaidHistory() {
  const body = document.getElementById('cc-paid-history-body');
  const arrow = document.getElementById('cc-hist-arrow');
  if(!body) return;
  const open = body.style.display === 'none';
  body.style.display = open ? 'block' : 'none';
  if(arrow) { arrow.style.transform = open ? '' : 'rotate(-90deg)'; }
}




// ── Marcar pagado ──
function ccMarkPaid(tcCycleId){
  if(!confirm('¿Marcar este ciclo como pagado?'))return;
  const cardId=state.ccActiveCard||state.ccCards[0]?.id;
  let ccState=state.ccCycles.find(c=>c.cardId===cardId && c.tcCycleId===tcCycleId);
  if(!ccState){
    ccState={id:tcCycleId+'_'+cardId, cardId, tcCycleId, status:'paid', manualExpenses:[], excludedIds:[]};
    state.ccCycles.push(ccState);
  } else {
    ccState.status='paid';
  }
  saveState();
  renderCreditCards();
  showToast('✓ ¡Ciclo marcado como pagado!','success');
}

// ── Excluir transacción de movimientos ──
function ccExcludeTxn(tcCycleId, txnId){
  const cardId=state.ccActiveCard||state.ccCards[0]?.id;
  let ccState=state.ccCycles.find(c=>c.cardId===cardId && c.tcCycleId===tcCycleId);
  if(!ccState){
    ccState={id:tcCycleId+'_'+cardId, cardId, tcCycleId, status:'pending', manualExpenses:[], excludedIds:[]};
    state.ccCycles.push(ccState);
  }
  if(!ccState.excludedIds)ccState.excludedIds=[];
  if(!ccState.excludedIds.includes(txnId)) ccState.excludedIds.push(txnId);
  saveState();
  renderCcActiveCycle();
}

// ── Gasto manual ──
function ccOpenManualExpenseModal(tcCycleId){
  window._ccCurrentTcCycleId=tcCycleId;
  const today=new Date().toISOString().slice(0,10);
  document.getElementById('cc-exp-date').value=today;
  document.getElementById('cc-exp-desc').value='';
  document.getElementById('cc-exp-ars').value='';
  document.getElementById('cc-exp-usd').value='';
  const sel=document.getElementById('cc-exp-cat');
  if(sel){
    let opts='<option value="Sin categoría">Sin categoría</option>';
    if(typeof CATEGORY_GROUPS!=='undefined'){
      CATEGORY_GROUPS.forEach(g=>{
        opts+='<optgroup label="'+g.emoji+' '+g.group+'">';
        g.subs.forEach(s=>{opts+='<option value="'+s+'">'+s+'</option>';});
        opts+='</optgroup>';
      });
    }
    sel.innerHTML=opts;
  }
  openModal('modal-cc-expense');
}

function ccSaveManualExpense(){
  const tcCycleId=window._ccCurrentTcCycleId;
  const cardId=state.ccActiveCard||state.ccCards[0]?.id;
  let ccState=state.ccCycles.find(c=>c.cardId===cardId && c.tcCycleId===tcCycleId);
  if(!ccState){
    ccState={id:tcCycleId+'_'+cardId, cardId, tcCycleId, status:'pending', manualExpenses:[], excludedIds:[]};
    state.ccCycles.push(ccState);
  }
  const date=document.getElementById('cc-exp-date').value;
  const desc=(document.getElementById('cc-exp-desc').value||'').trim();
  const cat=document.getElementById('cc-exp-cat').value||'Sin categoría';
  const ars=parseFloat(document.getElementById('cc-exp-ars').value)||0;
  const usd=parseFloat(document.getElementById('cc-exp-usd').value)||0;
  if(!desc){showToast('⚠️ Ingresá una descripción','error');return;}
  if(!ars&&!usd){showToast('⚠️ Ingresá al menos un monto','error');return;}
  if(!ccState.manualExpenses)ccState.manualExpenses=[];
  ccState.manualExpenses.push({
    id:'mce_'+Date.now().toString(36),
    date,description:desc,category:cat,amountARS:ars,amountUSD:usd
  });
  saveState();
  closeModal('modal-cc-expense');
  renderCcActiveCycle();
  showToast('✓ Gasto agregado','success');
}

function ccDeleteManualExpense(tcCycleId, expId){
  const cardId=state.ccActiveCard||state.ccCards[0]?.id;
  const ccState=state.ccCycles.find(c=>c.cardId===cardId && c.tcCycleId===tcCycleId);
  if(!ccState)return;
  ccState.manualExpenses=(ccState.manualExpenses||[]).filter(e=>e.id!==expId);
  saveState();
  renderCcActiveCycle();
}

function ccFocusCycleComposer(){
  const labelEl=document.getElementById('tc-cycle-label-cc');
  labelEl?.focus();
  labelEl?.scrollIntoView({behavior:'smooth',block:'center'});
}

function ccOpenCycleComposer(cardId){
  window._tcCycleEditId='';
  window._ccConfigDraftCardId=cardId||state.ccActiveCard||state.ccCards?.[0]?.id||'';
  renderCcConfigPanel();
  ccFocusCycleComposer();
}

// ── Render Apple-style Configuración panel ──
function renderCcConfigPanel(){
  const el=document.getElementById('cc-config-panel-body');if(!el)return;
  const cycles=getTcCycles();
  const cards=state.ccCards||[];
  const editingId=window._tcCycleEditId||'';
  const editingCycle=editingId ? cycles.find(c=>c.id===editingId) : null;
  const draftCardId=window._ccConfigDraftCardId||editingCycle?.cardId||state.ccActiveCard||cards[0]?.id||'';
  const cardOptions=cards.map(card=>`<option value="${esc(card.id)}" ${card.id===draftCardId?'selected':''}>${esc(card.name)}</option>`).join('');
  const cardNameById=id=>cards.find(card=>card.id===id)?.name||'Tarjeta';
  const totalManual=cycles.filter(c=>(c.source||'manual')!=='auto').length;
  const totalAuto=cycles.filter(c=>(c.source||'manual')==='auto').length;
  const totalPending=cycles.filter(c=>{
    const ownerCardId=c.cardId||draftCardId||cards[0]?.id;
    const statusEntry=state.ccCycles.find(x=>x.tcCycleId===c.id&&x.cardId===ownerCardId);
    return statusEntry?.status!=='paid';
  }).length;
  const fmtD=s=>s?new Date(s+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'}):'—';
  const cycleGroups=cards.map(card=>{
    const items=cycles
      .map((cycle, idx)=>({cycle, idx}))
      .filter(({cycle})=>((cycle.cardId||cards[0]?.id)===card.id));
    return { card, items };
  });

  const summaryHtml=`
    <div class="txn-summary-row">
      <div class="txn-summary-grid">
        <div class="summary-stat-card">
          <span class="summary-stat-label">Tarjetas activas</span>
          <span class="summary-stat-value">${cards.length}</span>
        </div>
        <div class="summary-stat-card">
          <span class="summary-stat-label">Ciclos visibles</span>
          <span class="summary-stat-value">${cycles.length}</span>
        </div>
        <div class="summary-stat-card">
          <span class="summary-stat-label">Overrides manuales</span>
          <span class="summary-stat-value">${totalManual}</span>
        </div>
        <div class="summary-stat-card total">
          <span class="summary-stat-label">Pendientes</span>
          <span class="summary-stat-value primary">${totalPending}</span>
        </div>
      </div>
      <div class="txns-detail txn-summary-detail">Base automática: ${totalAuto} ciclo${totalAuto===1?'':'s'} · Editar un ciclo lo convierte en override manual y se refleja en Dashboard, Movimientos y Tarjetas.</div>
    </div>
  `;

  const quickCardsHtml=cards.map(card=>{
    const cardCycles=cycleGroups.find(group=>group.card.id===card.id)?.items||[];
    const activeCycle=cardCycles[0]?.cycle||null;
    return `
      <button class="cc-config-quick-card ${card.id===draftCardId?'is-active':''}" onclick="ccOpenCycleComposer('${card.id}')">
        <span class="cc-config-quick-dot" style="background:${card.color};"></span>
        <span class="cc-config-quick-copy">
          <strong>${esc(card.name)}</strong>
          <small>${cardCycles.length} ciclo${cardCycles.length===1?'':'s'}${activeCycle?' · último cierre '+esc(fmtD(activeCycle.closeDate)):''}</small>
        </span>
      </button>
    `;
  }).join('');

  const recordsHtml=cycleGroups.map((group,groupIdx)=>{
    const { card, items } = group;
    const openAccordion=(editingCycle?.cardId||draftCardId||state.ccActiveCard||cards[0]?.id)===card.id || (!editingCycle && groupIdx===0);
    const manualCount=items.filter(({cycle})=>(cycle.source||'manual')!=='auto').length;
    const pendingCount=items.filter(({cycle})=>{
      const statusEntry=state.ccCycles.find(x=>x.tcCycleId===cycle.id&&x.cardId===card.id);
      return statusEntry?.status!=='paid';
    }).length;
    const rowsHtml=items.length ? items.map(({cycle, idx})=>{
      const open=getTcCycleOpen(cycles,idx);
      const totals=ccGetTotals(ccGetCycleExpenses(card.id, cycle.id));
      const statusEntry=state.ccCycles.find(x=>x.tcCycleId===cycle.id&&x.cardId===card.id);
      const isPaid=statusEntry?.status==='paid';
      const isManual=(cycle.source||'manual')!=='auto';
      return `
        <div class="cc-config-row">
          <div class="cc-config-row-main">
            <div class="cc-config-row-title">
              <span class="cc-config-row-name">${esc(cycle.label)}</span>
              <span class="cc-config-chip ${isPaid?'is-paid':'is-pending'}">${isPaid?'Pagado':'Pendiente'}</span>
              <span class="cc-config-chip ${isManual?'is-manual':'is-auto'}">${isManual?'Editable':'Auto'}</span>
            </div>
            <div class="cc-config-row-meta">
              <span>Apertura ${esc(fmtD(open))}</span>
              <span>Cierre ${esc(fmtD(cycle.closeDate))}</span>
              <span>Vto ${esc(fmtD(cycle.dueDate))}</span>
            </div>
          </div>
          <div class="cc-config-row-amounts">
            <strong>${totals.ars>0?'$'+fmtN(Math.round(totals.ars)):'—'}</strong>
            <small>${totals.usd>0?'U$D '+fmtN(totals.usd):totals.count+' item'+(totals.count===1?'':'s')}</small>
          </div>
          <div class="cc-config-row-actions">
            <button class="btn btn-ghost btn-sm" onclick="editTcCycle('${cycle.id}')">Editar</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteTcCycle('${cycle.id}')">Borrar</button>
          </div>
        </div>
      `;
    }).join('') : `
      <div class="cc-config-empty-card">
        <div class="cc-config-empty-title">Todavía no hay ciclos visibles para ${esc(card.name)}</div>
        <div class="cc-config-empty-sub">Podés cargar uno manual o usar esta tarjeta como base para un ajuste puntual.</div>
        <button class="btn btn-primary btn-sm" onclick="ccOpenCycleComposer('${card.id}')">Nuevo ciclo</button>
      </div>
    `;

    return `
      <details class="cc-config-accordion" ${openAccordion?'open':''}>
        <summary class="cc-config-accordion-summary">
          <div class="cc-config-accordion-title">
            <span class="cc-config-accordion-dot" style="background:${card.color};"></span>
            <div>
              <strong>${esc(card.name)}</strong>
              <small>${items.length} ciclo${items.length===1?'':'s'} · ${manualCount} editable${manualCount===1?'':'s'} · ${pendingCount} pendiente${pendingCount===1?'':'s'}</small>
            </div>
          </div>
          <span class="cc-config-accordion-cta">Ver registros</span>
        </summary>
        <div class="cc-config-accordion-body">
          <div class="cc-config-table-head">
            <span>Período</span>
            <span>Total</span>
            <span>Acciones</span>
          </div>
          ${rowsHtml}
        </div>
      </details>
    `;
  }).join('');

  el.innerHTML=`
    <div class="cc-config-shell">
      <section class="txn-filter-bar cc-config-overview fade-up d1">
        <div class="cc-config-overview-copy">
          <div class="cc-config-kicker">Configuración de ciclos</div>
          <h3>Administrá ciclos sin perderte entre aperturas, cierres y vencimientos.</h3>
          <p>El flujo ahora está ordenado como Movimientos: resumen rápido arriba, editor único en el medio y registros agrupados abajo por tarjeta.</p>
        </div>
        <div class="cc-config-quick-grid">${quickCardsHtml}</div>
        <div class="txn-summary cc-config-summary">${summaryHtml}</div>
      </section>

      <section class="table-card cc-config-composer fade-up d2">
        <div class="cc-config-block-head">
          <div>
            <div class="cc-config-kicker">${editingCycle?'Editando ciclo':'Editor de ciclos'}</div>
            <div class="cc-config-block-title">${editingCycle?esc(editingCycle.label||'Ciclo actual'):'Nuevo ciclo manual u override puntual'}</div>
          </div>
          <div class="cc-config-head-actions">
            <button class="btn btn-ghost btn-sm" onclick="ccOpenCycleComposer('${draftCardId}')">Nuevo</button>
            ${editingCycle?'<button class="btn btn-ghost btn-sm" onclick="cancelTcCycleEdit()">Cancelar edición</button>':''}
          </div>
        </div>
        ${editingCycle?`<div class="cc-config-edit-banner">Estás ajustando un ciclo existente. Si era automático, esta edición pasa a ser un registro manual editable.</div>`:''}
        <div class="cc-config-form-grid">
          <label class="cc-config-field">
            <span>Nombre del ciclo</span>
            <input class="cc-cfg-input" id="tc-cycle-label-cc" placeholder="Ej: Abril 2026 extendido" autocomplete="off">
          </label>
          <label class="cc-config-field">
            <span>Tarjeta</span>
            <select class="cc-cfg-input" id="tc-cycle-card-cc">${cardOptions}</select>
          </label>
          <label class="cc-config-field">
            <span>Fecha de apertura</span>
            <input type="date" class="cc-cfg-input" id="tc-cycle-open-cc">
          </label>
          <label class="cc-config-field">
            <span>Fecha de cierre</span>
            <input type="date" class="cc-cfg-input" id="tc-cycle-close-cc">
          </label>
          <label class="cc-config-field">
            <span>Fecha de vencimiento</span>
            <input type="date" class="cc-cfg-input" id="tc-cycle-due-cc">
          </label>
        </div>
        <div class="cc-config-form-actions">
          <button class="btn btn-primary" onclick="addTcCycleFromCC()">${editingCycle?'Guardar cambios':'Guardar ciclo'}</button>
          <div class="cc-config-form-note">Consejo: usá este editor cuando el banco te corra el cierre o el vencimiento y quieras que toda la app quede alineada con el resumen real.</div>
        </div>
      </section>

      <section class="table-card cc-config-records fade-up d3">
        <div class="cc-config-block-head">
          <div>
            <div class="cc-config-kicker">Registros</div>
            <div class="cc-config-block-title">Ciclos agrupados por tarjeta</div>
          </div>
          <div class="cc-config-records-note">Abrí cada tarjeta para ver, editar o borrar sus períodos.</div>
        </div>
        <div class="cc-config-accordion-stack">${recordsHtml}</div>
      </section>
    </div>
  `;
}

// ── Render TC Config section inline dentro de la página de Tarjeta de Crédito ──
function renderCcTcConfig(){
  const el=document.getElementById('cc-tc-config-list');if(!el)return;
  const cycles=getTcCycles();
  const cards=state.ccCards||[];
  const cardNameById=id=>cards.find(card=>card.id===id)?.name||'Tarjeta';
  if(!cycles.length){
    el.innerHTML='<div style="color:var(--text3);font-size:12px;font-family:var(--font);padding:16px 0;text-align:center;">Sin ciclos registrados.<br>Agregá el primero arriba.</div>';
    return;
  }
  el.innerHTML=cycles.map((c,idx)=>{
    const open=getTcCycleOpen(cycles,idx);
    const openD=new Date(open+'T12:00:00');
    const closeD=new Date(c.closeDate+'T12:00:00');
    const fmtD=d=>d.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
    const dueDStr=c.dueDate?' · Vence: '+fmtD(new Date(c.dueDate+'T12:00:00')):'';
    const txns=getTcCycleTxns(c, cycles);
    const total=txns.reduce((s,t)=>s+(t.currency==='USD'?t.amount*USD_TO_ARS:t.amount),0);
    return '<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);">'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="font-size:13px;font-weight:700;color:var(--text);">'+esc(c.label)+' · <span style="color:var(--text3);font-weight:600;">'+esc(cardNameById(c.cardId))+'</span></div>'+
        '<div style="font-size:11px;color:var(--text3);font-family:var(--font);margin-top:2px;">'+fmtD(openD)+' → '+fmtD(closeD)+dueDStr+'</div>'+
      '</div>'+
      '<div style="font-size:13px;font-weight:700;color:var(--accent);font-family:var(--font);">'+(total>0?'$'+fmtN(total):'sin gastos')+'</div>'+
      '<button class="btn btn-secondary btn-sm btn-icon" onclick="editTcCycle(\''+c.id+'\')" title="Editar">✎</button>'+
      '<button class="btn btn-danger btn-sm btn-icon" onclick="deleteTcCycle(\''+c.id+'\')" title="Eliminar">🗑</button>'+
    '</div>';
  }).join('');
}

function ccToggleTcConfig(){
  const body=document.getElementById('cc-tc-config-body');
  const arrow=document.getElementById('cc-tc-config-arrow');
  if(!body)return;
  const open=body.style.display==='none';
  body.style.display=open?'block':'none';
  if(arrow)arrow.textContent=open?'▾':'▸';
}

window.checkCreditCardAlerts = checkCreditCardAlerts;
