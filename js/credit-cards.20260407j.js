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
    if(t.isPendingCuota||t.isPendingSubscription)return false;
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

function ccGetVisibleCyclesForCard(cardId, cycles){
  const cards=state.ccCards||[];
  const todayYmd=dateToYMD(new Date());
  return cycles
    .map((cycle, idx)=>({cycle, idx, open:cycle.openDate||getTcCycleOpen(cycles,idx)||cycle.closeDate}))
    .filter(({cycle,open})=>((cycle.cardId||cards[0]?.id)===cardId) && (!open || open<=todayYmd))
    .sort((a,b)=>(b.cycle.closeDate||'').localeCompare(a.cycle.closeDate||''));
}

function ccFindDefaultCycleForCard(cardId, cycles){
  const todayYmd=dateToYMD(new Date());
  const visible=ccGetVisibleCyclesForCard(cardId, cycles);
  return visible.find(({cycle,open})=>open<=todayYmd && todayYmd<=cycle.closeDate)?.cycle
    || visible[0]?.cycle
    || cycles.find(c=>(c.cardId||(state.ccCards||[])[0]?.id)===cardId)
    || null;
}

function ccCardBrandLabel(card){
  return (card?.payMethodKey||card?.name||'').toLowerCase().includes('amex') ? 'AMEX' : 'VISA';
}

function ccCategoryIcon(cat=''){
  const name=String(cat||'').toLowerCase();
  if(name.includes('super')||name.includes('mercado')||name.includes('aliment')) return '🛒';
  if(name.includes('restaurant')||name.includes('delivery')||name.includes('comida')||name.includes('cafe')) return '🍽';
  if(name.includes('transporte')||name.includes('viaje')||name.includes('uber')||name.includes('cabify')) return '🚕';
  if(name.includes('nafta')||name.includes('combustible')) return '⛽';
  if(name.includes('salud')||name.includes('farmacia')||name.includes('medic')) return '✚';
  if(name.includes('entreten')||name.includes('stream')||name.includes('cine')) return '▶';
  if(name.includes('regalo')) return '🎁';
  if(name.includes('cuota')) return '◫';
  if(name.includes('suscrip')) return '↻';
  if(name.includes('servicio')||name.includes('luz')||name.includes('gas')||name.includes('internet')) return '⚡';
  if(name.includes('educ')) return '⌁';
  if(name.includes('compra')) return '▣';
  return '◆';
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
    sub.textContent=tab==='history'
      ? 'Historial simple de ciclos por tarjeta, separado de la configuración.'
      : tab==='config'
      ? 'Ajustá aperturas, cierres y vencimientos sin perder consistencia en la app.'
      : 'Centro operativo para revisar resumen, vencimiento, consumos y conciliación.';
  }
  // Apply tab visibility
  document.getElementById('cpt-resumen')?.classList.toggle('active',tab==='resumen');
  document.getElementById('cpt-config')?.classList.toggle('active',tab==='config');
  document.getElementById('cpt-compare')?.classList.remove('active');
  const pr=document.getElementById('cc-panel-resumen');
  const pc=document.getElementById('cc-panel-config');
  const ph=document.getElementById('cc-panel-history');
  if(pr){
    pr.hidden=tab!=='resumen';
    pr.style.display=tab==='resumen'?'flex':'none';
  }
  if(pc){
    pc.hidden=tab!=='config';
    pc.style.display=tab==='config'?'flex':'none';
  }
  if(ph){
    ph.hidden=tab!=='history';
    ph.style.display=tab==='history'?'flex':'none';
  }
  if(tab==='resumen'){
    renderCcActiveCycle();
  } else if(tab==='config') {
    renderCcConfigPanel();
  } else if(tab==='history') {
    renderCcHistoryPanel();
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
    const statusText=status?.status==='paid'?'pago':status?.status==='minimum'?'mínimo':'pendiente';
    const last=card.last4||card.digits||card.lastDigits||'••••';
    const brandText=ccCardBrandLabel(card);
    const brandClass=brandText==='AMEX'?'is-amex':'is-visa';
    return `<button class="cc-card-switch ${isActive?'is-active':''} ${brandClass}" onclick="ccSelectCard('${card.id}')" style="--cc-card-color:${card.color};">
      <span class="cc-card-switch-dot"></span>
      <span class="cc-card-switch-main">
        <strong>${esc(card.name)}</strong>
        <small>${esc(last)} · ${cycle?esc(cycle.label):'Sin ciclo'} · ${statusText}</small>
      </span>
      <span class="cc-card-switch-total">${totals.ars>0?'$'+fmtN(Math.round(totals.ars)):'—'}</span>
      ${isActive?'<span class="cc-card-switch-active-label">Viendo ahora</span>':''}
      <span class="cc-card-switch-brand">${brandText}</span>
    </button>`;
  }).join('')+`
    <button class="cc-card-switch cc-card-switch-add is-new-card" onclick="ccCreateCardPrompt()">
      <span class="cc-card-switch-add-icon">+</span>
      <span class="cc-card-switch-main">
        <strong>Nueva tarjeta</strong>
        <small>Crear tarjeta para futuros ciclos</small>
      </span>
    </button>
  `;
}

function ccSelectCard(cardId){
  ccInit();
  state.ccActiveCard=cardId;
  window._ccViewCycle[cardId]=null; // reset viewed cycle for this card
  if((state.ccPageTab||'resumen')==='history') window._ccHistoryCardId=cardId;
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

    const visibleCycles=ccGetVisibleCyclesForCard(cardId, tcCycles);
    const visibleCycleIds=new Set(visibleCycles.map(({cycle})=>cycle.id));
    // Ciclo visible: selección válida del usuario, o ciclo actual por defecto.
    const viewingId=window._ccViewCycle[cardId];
    let activeTcCycle=null;
    if (viewingId && visibleCycleIds.has(viewingId)) activeTcCycle = tcCycles.find(c=>c.id===viewingId) || null;
    if(!activeTcCycle) activeTcCycle = ccFindDefaultCycleForCard(cardId, tcCycles) || tcCycles[0];
    window._ccViewCycle[cardId]=activeTcCycle?.id||null;
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
          ${visibleCycles.map(({cycle:c})=>{
            const s=state.ccCycles.find(x=>x.cardId===cardId && x.tcCycleId===c.id);
            const paid=s && s.status==='paid';
            return `<option value="${c.id}" ${c.id===activeTcCycle.id?'selected':''}>${paid?'✓ ':'⏳ '}${esc(c.label)}</option>`;
          }).join('')}
        </select>
      </div>
    `;
  }

  const totalForPct=totals.ars+(totals.usd*(USD_TO_ARS||0));
  const limitRaw=Number(card?.limitARS||card?.limit||card?.creditLimit||0);
  const available=limitRaw>0?limitRaw-totals.ars:null;
  const minPayment=Number(card?.minimumPaymentARS||card?.minPaymentARS||0);
  const cardBrand=ccCardBrandLabel(card);
  const cardLast=card?.last4||card?.digits||card?.lastDigits||'••••';
  const cycleStatus=ccState.status==='paid'?'pago total':ccState.status==='minimum'?'pago mínimo':'pendiente';
  const cycleTone=ccState.status==='paid'?'is-paid':ccState.status==='minimum'?'is-minimum':'is-pending';
  const ringDeg=Math.round(progressPct*3.6);
  const catRows=catSummary.slice(0,10).map((r,idx)=>{
    const amountArs=r.ars+(r.usd*(USD_TO_ARS||0));
    const pct=totalForPct>0?Math.round((amountArs/totalForPct)*100):0;
    const pctWidth=Math.max(3,Math.min(100,pct));
    const txns=expenses
      .filter(e=>(e.category||'Sin categoría')===r.cat)
      .slice(0,4)
      .map(e=>`<li><span>${esc(e.description)}</span><b>${e.amountARS>0?'$'+fmtN(Math.round(e.amountARS)):e.amountUSD>0?'U$D '+fmtN(e.amountUSD):'—'}</b></li>`)
      .join('');
    return `<details class="ccs-cat-accordion" ${idx<3?'open':''}>
      <summary>
        <span class="ccs-cat-icon">${ccCategoryIcon(r.cat)}</span>
        <span class="ccs-cat-copy">
          <strong>${esc(r.cat)}</strong>
          <small>${pct}% del resumen</small>
          <i><span style="width:${pctWidth}%;"></span></i>
        </span>
        <span class="ccs-cat-amount">
          <b>${r.ars>0?'$'+fmtN(Math.round(r.ars)):r.usd>0?'U$D '+fmtN(r.usd):'—'}</b>
          <small>${expenses.filter(e=>(e.category||'Sin categoría')===r.cat).length} mov.</small>
        </span>
      </summary>
      <ul>${txns||'<li><span>Sin movimientos visibles</span><b>—</b></li>'}</ul>
    </details>`;
  }).join('');

  const expRows=expenses.slice(0,10).map(e=>{
    const removeBtn=e.source==='txn'
      ?`<button class="ccs-row-menu" onclick="ccExcludeTxn('${activeTcCycle.id}','${e.id}')" title="Excluir de este ciclo">—</button>`
      :`<button class="ccs-row-menu" onclick="ccDeleteManualExpense('${activeTcCycle.id}','${e.id}')" title="Eliminar gasto manual">—</button>`;
    const sourceLabel=e.source==='projected'?'Proyectado':e.source==='manual'?'Manual':'Movimiento';
    return `<div class="ccs-txn-row">
      <div class="ccs-txn-date">${ccFmtDate(e.date)}</div>
      <div class="ccs-txn-main">
        <strong>${esc(e.description)}</strong>
        <small>${sourceLabel}</small>
      </div>
      <div class="ccs-txn-cat">${esc(e.category)}</div>
      <div class="ccs-txn-amount">
        <strong>${e.amountARS>0?'$'+fmtN(Math.round(e.amountARS)):e.amountUSD>0?'U$D '+fmtN(e.amountUSD):'—'}</strong>
      </div>
      ${removeBtn}
    </div>`;
  }).join('');

  activeEl.innerHTML=`
    <div class="ccs-workspace">
      <section class="cc-active-card-banner fade-up d0" style="--cc-card-color:${card?.color||'#6d4aff'};">
        <div class="cc-active-card-mark">${esc(cardBrand)}</div>
        <div class="cc-active-card-copy">
          <span>Estás viendo</span>
          <strong>${esc(card?.name||'Tarjeta')}</strong>
          <small>${esc(cardLast)} · ${esc(activeTcCycle.label)} · ${cycleStatus}</small>
        </div>
        <button onclick="document.getElementById('cc-card-tabs')?.scrollIntoView({behavior:'smooth',block:'center'});">Cambiar tarjeta</button>
      </section>
      <section class="ccs-top-grid fade-up d1">
        <div class="ccs-main-stack">
          <article class="ccs-hero">
            <div class="ccs-hero-copy">
              <div class="ccs-hero-tags">
                <span class="ccs-status ${cycleTone}">${cycleStatus}</span>
                ${card?`<span class="ccs-card-pill" style="--cc-card-color:${card.color};">${esc(card.name)}</span>`:''}
                <span>${esc(activeTcCycle.label)}</span>
              </div>
              <div class="ccs-kicker">Total a pagar</div>
              <div class="ccs-total">$${fmtN(Math.round(totals.ars))}</div>
              <div class="ccs-sub">${totals.usd>0?'USD '+fmtN(totals.usd)+' · ':''}${expenses.length} item${expenses.length===1?'':'s'} en el ciclo</div>
              <div class="ccs-due-line">
                <strong>Vencimiento</strong>
                <span>${ccFmtDate(dueDate)} · ${dueMeta.text}</span>
              </div>
              <div class="ccs-progress-head"><span>${ccFmtDate(openDate)}</span><strong>${progressPct}% del ciclo</strong><span>${ccFmtDate(activeTcCycle.closeDate)}</span></div>
              <div class="ccs-progress"><span style="width:${progressPct}%;"></span></div>
            </div>
            <div class="ccs-ring" style="--ccs-ring:${ringDeg}deg;">
              <div><strong>${progressPct}%</strong><span>del ciclo</span></div>
            </div>
          </article>

          <section class="ccs-category-board">
            <div class="ccs-section-head">
              <div><h3>Categorías del resumen</h3><span>${catSummary.length} categoría${catSummary.length===1?'':'s'} en este ciclo</span></div>
              <small>% del total</small>
            </div>
            <div class="ccs-cat-accordion-list">${catRows||'<div class="cc-empty-inline">Sin categorías en este ciclo</div>'}</div>
          </section>
        </div>

        <aside class="ccs-side-stack">
          <article class="ccs-actions-panel">
            <h3>Acciones rápidas</h3>
            <button class="ccs-pay-action is-success" onclick="ccMarkPaid('${activeTcCycle.id}')"><span>✓</span><strong>Marcar como pago</strong><small>Confirmá el pago total del resumen.</small></button>
            <button class="ccs-pay-action is-warn" onclick="ccMarkMinimumPaid('${activeTcCycle.id}')"><span>$</span><strong>Pagar mínimo</strong><small>Registrá el mínimo y dejá saldo pendiente.</small></button>
            <button class="ccs-pay-action is-danger" onclick="ccMarkPending('${activeTcCycle.id}')"><span>!</span><strong>Marcar como pendiente</strong><small>Volvé este ciclo a estado pendiente.</small></button>
          </article>
          <article class="ccs-quick-metrics">
            <h3>Resumen rápido</h3>
            <div><span>Disponible</span><strong>${available===null?'—':'$'+fmtN(Math.round(available))}</strong></div>
            <div><span>Consumos del ciclo</span><strong>${expenses.length}</strong></div>
            <div><span>Pago mínimo</span><strong>${minPayment>0?'$'+fmtN(Math.round(minPayment)):'—'}</strong></div>
            <div><span>Límite total</span><strong>${limitRaw>0?'$'+fmtN(Math.round(limitRaw)):'—'}</strong></div>
          </article>
        </aside>
      </section>

      <section class="ccs-table-card fade-up d3">
        <div class="ccs-table-head">
          <div><h3>Desglose de gastos</h3><span>Mostrando ${Math.min(expenses.length,10)} de ${expenses.length} item${expenses.length===1?'':'s'}</span></div>
          <div class="ccs-table-tools"><button class="ccs-table-primary" onclick="ccOpenManualExpenseModal('${activeTcCycle.id}')">+ Agregar gasto</button><button>Todos</button><button>☷</button><button>⊙</button></div>
        </div>
        <div class="ccs-txn-list">
          <div class="ccs-txn-header"><span>Fecha</span><span>Descripción</span><span>Categoría</span><span>Monto</span><span></span></div>
          ${expenses.length?expRows:'<div class="cc-empty-inline">Sin gastos en este ciclo</div>'}
        </div>
      </section>
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

function ccMarkMinimumPaid(tcCycleId){
  const cardId=state.ccActiveCard||state.ccCards[0]?.id;
  let ccState=state.ccCycles.find(c=>c.cardId===cardId && c.tcCycleId===tcCycleId);
  if(!ccState){
    ccState={id:tcCycleId+'_'+cardId, cardId, tcCycleId, status:'minimum', manualExpenses:[], excludedIds:[]};
    state.ccCycles.push(ccState);
  } else {
    ccState.status='minimum';
  }
  saveState();
  renderCreditCards();
  showToast('✓ Pago mínimo registrado','success');
}

function ccMarkPending(tcCycleId){
  const cardId=state.ccActiveCard||state.ccCards[0]?.id;
  let ccState=state.ccCycles.find(c=>c.cardId===cardId && c.tcCycleId===tcCycleId);
  if(!ccState){
    ccState={id:tcCycleId+'_'+cardId, cardId, tcCycleId, status:'pending', manualExpenses:[], excludedIds:[]};
    state.ccCycles.push(ccState);
  } else {
    ccState.status='pending';
  }
  saveState();
  renderCreditCards();
  showToast('Resumen marcado como pendiente','info');
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
  const openEl=document.getElementById('tc-cycle-open-cc');
  const closeEl=document.getElementById('tc-cycle-close-cc');
  const focusEl=openEl||closeEl||document.getElementById('tc-cycle-label-cc');
  focusEl?.focus();
  focusEl?.scrollIntoView({behavior:'smooth',block:'center'});
}

function ccOpenCycleComposer(cardId){
  window._tcCycleEditId='';
  window._ccConfigDraftCardId=cardId||state.ccActiveCard||state.ccCards?.[0]?.id||'';
  renderCcConfigPanel();
  ccFocusCycleComposer();
}

function ccApplyCloseDayFromConfig(dayValue){
  const day=Math.max(1,Math.min(31,parseInt(dayValue,10)||1));
  const closeEl=document.getElementById('tc-cycle-close-cc');
  const openEl=document.getElementById('tc-cycle-open-cc');
  if(!closeEl)return;
  const baseValue=closeEl.value||openEl?.value||dateToYMD(new Date());
  const base=new Date(baseValue+'T12:00:00');
  const year=base.getFullYear();
  const month=base.getMonth();
  const maxDay=new Date(year,month+1,0).getDate();
  closeEl.value=dateToYMD(new Date(year,month,Math.min(day,maxDay),12));
}

function ccSyncCloseDayFromDate(){
  const closeEl=document.getElementById('tc-cycle-close-cc');
  const dayEl=document.getElementById('tc-cycle-day-cc');
  if(closeEl?.value&&dayEl){
    dayEl.value=String(new Date(closeEl.value+'T12:00:00').getDate());
  }
}

// ── Render Apple-style Configuración panel ──
function renderCcConfigPanel(){
  const el=document.getElementById('cc-config-panel-body');if(!el)return;
  const cycles=getTcCycles();
  const cards=state.ccCards||[];
  const editingId=window._tcCycleEditId||'';
  const editingCycle=editingId ? cycles.find(c=>c.id===editingId) : null;
  const draftCardId=window._ccConfigDraftCardId||editingCycle?.cardId||state.ccActiveCard||cards[0]?.id||'';
  state.ccActiveCard=draftCardId||state.ccActiveCard;
  const activeCard=cards.find(card=>card.id===draftCardId)||cards[0]||null;
  const cardOptions=cards.map(card=>`<option value="${esc(card.id)}" ${card.id===draftCardId?'selected':''}>${esc(card.name)}</option>`).join('');
  const fmtD=s=>s?new Date(s+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'}):'—';
  const fmtShort=s=>s?new Date(s+'T12:00:00').toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'}):'—';
  const fmtPeriod=s=>s?new Date(s+'T12:00:00').toLocaleDateString('es-AR',{month:'short',year:'numeric'}).replace('.',''):'Sin período';
  const todayYmd=dateToYMD(new Date());
  const cycleGroups=cards.map(card=>{
    const items=cycles
      .map((cycle, idx)=>({cycle, idx}))
      .filter(({cycle})=>((cycle.cardId||cards[0]?.id)===card.id));
    return { card, items };
  });
  const activeGroup=cycleGroups.find(group=>group.card.id===draftCardId)||cycleGroups[0]||{items:[]};
  const visibleCycles=[...activeGroup.items]
    .filter(({cycle})=>(cycle.openDate||getTcCycleOpen(cycles,cycles.findIndex(c=>c.id===cycle.id))||'')<=todayYmd)
    .sort((a,b)=>(b.cycle.closeDate||'').localeCompare(a.cycle.closeDate||''));
  const currentCycle=(editingCycle&&editingCycle.cardId===draftCardId?{cycle:editingCycle,idx:cycles.findIndex(c=>c.id===editingCycle.id)}:null)
    || visibleCycles.find(({cycle,idx})=>{
      const open=cycle.openDate||getTcCycleOpen(cycles,idx)||cycle.closeDate;
      return open<=todayYmd&&todayYmd<=cycle.closeDate;
    })
    || visibleCycles[0]
    || activeGroup.items[0]
    || null;
  const currentOpen=currentCycle?(currentCycle.cycle.openDate||getTcCycleOpen(cycles,currentCycle.idx)||currentCycle.cycle.closeDate):'';
  const currentClose=currentCycle?.cycle?.closeDate||'';
  const currentDue=currentCycle?.cycle?.dueDate||'';
  const currentDay=currentClose?String(new Date(currentClose+'T12:00:00').getDate()):'—';
  const selectedCloseDay=editingCycle?.closeDate
    ? String(new Date(editingCycle.closeDate+'T12:00:00').getDate())
    : (currentClose?String(new Date(currentClose+'T12:00:00').getDate()):'1');
  const closeDayOptions=Array.from({length:31},(_,i)=>String(i+1))
    .map(day=>`<option value="${day}" ${day===selectedCloseDay?'selected':''}>${day}</option>`)
    .join('');
  const currentTotals=currentCycle&&activeCard?ccGetTotals(ccGetCycleExpenses(activeCard.id,currentCycle.cycle.id)):{ars:0,usd:0};
  const currentStatus=currentCycle&&activeCard?state.ccCycles.find(x=>x.tcCycleId===currentCycle.cycle.id&&x.cardId===activeCard.id):null;
  const statusText=currentStatus?.status==='paid'?'pagado':'pendiente';
  const last4=activeCard?.last4||activeCard?.digits||activeCard?.lastDigits||'••••';
  const activeBrand=ccCardBrandLabel(activeCard);

  const actionsEl=document.getElementById('cc-page-actions');
  if(actionsEl){
    actionsEl.innerHTML=activeCard?`
      <div class="cc-period-picker cc-config-period-pill">
        <span class="cc-period-picker-label">Período</span>
        <strong>${esc(activeCard.name.replace(/^Santander\s+/i,''))} · ${esc(fmtPeriod(currentClose))}</strong>
      </div>
    `:'';
  }

  const quickCardsHtml=cards.map(card=>{
    const cardCycles=(cycleGroups.find(group=>group.card.id===card.id)?.items||[])
      .filter(({cycle})=>(cycle.openDate||cycle.closeDate)<=todayYmd)
      .sort((a,b)=>(b.cycle.closeDate||'').localeCompare(a.cycle.closeDate||''));
    const activeCycle=cardCycles[0]?.cycle||null;
    const totals=activeCycle?ccGetTotals(ccGetCycleExpenses(card.id,activeCycle.id)):{ars:0,usd:0};
    const status=activeCycle?state.ccCycles.find(s=>s.cardId===card.id&&s.tcCycleId===activeCycle.id):null;
    const last=card.last4||card.digits||card.lastDigits||'••••';
    return `
      <button class="cc-config-top-card ${card.id===draftCardId?'is-active':''}" onclick="ccSelectConfigCard('${card.id}')">
        <span class="cc-config-card-icon" style="--cc-color:${card.color};"></span>
        <span class="cc-config-quick-copy">
          <strong>${esc(card.name)}</strong>
          <small>${activeCycle?esc(activeCycle.label)+' · ':''}${status?.status==='paid'?'pagado':'pendiente'}</small>
          <small>${esc(last)}</small>
        </span>
        <span class="cc-config-top-total">${totals.ars>0?'$'+fmtN(Math.round(totals.ars)):'—'}</span>
        <span class="cc-config-top-arrow">›</span>
      </button>
    `;
  }).join('')+`
    <button class="cc-config-add-card" onclick="ccCreateCardPrompt()">
      <span>+</span>
      <strong>Nueva tarjeta</strong>
    </button>
  `;

  const timelineSteps=[
    {icon:'▶',label:'Apertura del ciclo',value:fmtShort(currentOpen),sub:'Inicio del ciclo',tone:'violet'},
    {icon:'□',label:'Cierre del resumen',value:fmtShort(currentClose),sub:'Cierre del período',tone:'red'},
    {icon:'□',label:'Vencimiento',value:fmtShort(currentDue),sub:'Fecha de pago',tone:'blue'},
    {icon:'↻',label:'Día de cierre',value:currentDay,sub:'de cada mes',tone:'green'}
  ].map((step,idx)=>`
    <div class="cc-config-time-step ${step.tone}">
      <div class="cc-config-time-icon">${step.icon}</div>
      <div>
        <span>${step.label}</span>
        <strong>${esc(step.value)}</strong>
        <small>${step.sub}</small>
      </div>
      ${idx<3?'<i></i>':''}
    </div>
  `).join('');

  // ── Build records: dedup auto+manual pairs and only show the newest cycles ──
  const recordsHtml=cycleGroups.map((group)=>{
    const { card, items } = group;

    // Dedup: if a manual cycle and an auto cycle share the same closeDate, keep only the manual one
    const dedupedItems=[];
    const seenClose=new Set();
    // manual first so they win the dedup
    const sorted=[...items].sort((a,b)=>{
      const aM=(a.cycle.source||'manual')!=='auto'?0:1;
      const bM=(b.cycle.source||'manual')!=='auto'?0:1;
      return aM-bM || b.cycle.closeDate.localeCompare(a.cycle.closeDate);
    });
    sorted.forEach(item=>{
      const key=item.cycle.closeDate;
      if(!seenClose.has(key)){ seenClose.add(key); dedupedItems.push(item); }
    });
    // newest first
    dedupedItems.sort((a,b)=>b.cycle.closeDate.localeCompare(a.cycle.closeDate));

    const historyOpen=window._ccRecordsExpanded?.[card.id]===true;
    const VISIBLE=2;
    const visibleItems=historyOpen?dedupedItems:dedupedItems.slice(0,VISIBLE);
    const oldCount=Math.max(dedupedItems.length-VISIBLE,0);

    const pendingCount=dedupedItems.filter(({cycle})=>{
      const statusEntry=state.ccCycles.find(x=>x.tcCycleId===cycle.id&&x.cardId===card.id);
      return statusEntry?.status!=='paid';
    }).length;

    // Short date: "30 abr"
    const shortD=s=>{
      if(!s)return'—';
      const d=new Date(s+'T12:00:00');
      return d.toLocaleDateString('es-AR',{day:'numeric',month:'short'});
    };

    const rowsHtml=visibleItems.length ? visibleItems.map(({cycle},rowIdx)=>{
      const open=cycle.openDate||getTcCycleOpen(cycles,cycles.findIndex(c=>c.id===cycle.id));
      const totals=ccGetTotals(ccGetCycleExpenses(card.id, cycle.id));
      const statusEntry=state.ccCycles.find(x=>x.tcCycleId===cycle.id&&x.cardId===card.id);
      const isPaid=statusEntry?.status==='paid';
      const isManual=(cycle.source||'manual')!=='auto';
      const isCurrent=rowIdx===0;
      const arsStr=totals.ars>0?'$'+fmtN(Math.round(totals.ars)):'Sin gastos';
      const usdStr=totals.usd>0?'U$D '+fmtN(totals.usd):'';
      return `
        <article class="ccr-cycle ${isCurrent?'is-current':''}">
          <div class="ccr-cycle-main">
            <span class="ccr-status-dot ${isPaid?'is-paid':'is-pending'}"></span>
            <div>
              <div class="ccr-cycle-title">
                <span>${isCurrent?'Ciclo actual':'Anterior'}</span>
                ${isPaid?'<b class="ccr-badge ccr-badge-paid">Pagado</b>':'<b class="ccr-badge ccr-badge-pending">Pendiente</b>'}
                ${isManual?'<b class="ccr-badge ccr-badge-manual">Editado</b>':''}
              </div>
              <div class="ccr-cycle-period">${esc(cycle.label)}</div>
              <div class="ccr-cycle-dates">
                <span><b>Apertura</b>${esc(shortD(open))}</span>
                <span><b>Cierre</b>${esc(shortD(cycle.closeDate))}</span>
                <span><b>Vence</b>${cycle.dueDate?esc(shortD(cycle.dueDate)):'—'}</span>
              </div>
            </div>
          </div>
          <div class="ccr-cycle-money">
            <strong>${arsStr}</strong>
            ${usdStr?`<small>${usdStr}</small>`:''}
          </div>
          <div class="ccr-cycle-actions">
            <button class="ccr-btn-edit" onclick="editTcCycle('${cycle.id}')" title="Editar ciclo">Editar</button>
            <button class="ccr-btn-del" onclick="deleteTcCycle('${cycle.id}')" title="Borrar ciclo">Borrar</button>
          </div>
        </article>
      `;
    }).join('') : `
      <div class="cc-config-empty-card">
        <div class="cc-config-empty-title">Sin ciclos para ${esc(card.name)}</div>
        <button class="btn btn-primary btn-sm" onclick="ccOpenCycleComposer('${card.id}')">Agregar ciclo</button>
      </div>
    `;

    const historyBtn=oldCount>0?`
      <button class="ccr-history-btn" onclick="ccToggleRecordsExpanded('${card.id}')">
        ${historyOpen?'Ocultar historial':'Ver historial'}
      </button>`:'';
    const bulkBtn=oldCount>0?`
      <button class="ccr-clean-btn" onclick="ccDeleteOldCycles('${card.id}')">
        Borrar ${oldCount} antiguo${oldCount===1?'':'s'}
      </button>`:'';

    return `
      <div class="ccr-card">
        <div class="ccr-card-header">
          <div class="ccr-card-title">
            <span class="cc-config-accordion-dot" style="background:${card.color};"></span>
            <strong>${esc(card.name)}</strong>
            <span class="ccr-card-meta">${pendingCount} pendiente${pendingCount===1?'':'s'}${oldCount>0?' · '+oldCount+' antiguo'+(oldCount===1?'':'s'):''}</span>
          </div>
          <div class="ccr-card-actions">${historyBtn}${bulkBtn}</div>
        </div>
        <div class="ccr-rows">${rowsHtml}</div>
      </div>
    `;
  }).join('');

  el.innerHTML=`
    <div class="cc-config-shell cc-config-modern-shell">
      <section class="cc-active-card-banner cc-active-card-banner-config fade-up d1" style="--cc-card-color:${activeCard?.color||'#6d4aff'};">
        <div class="cc-active-card-mark">${esc(activeBrand)}</div>
        <div class="cc-active-card-copy">
          <span>Configurando</span>
          <strong>${esc(activeCard?.name||'Tarjeta')}</strong>
          <small>${esc(last4)} · ${currentCycle?esc(currentCycle.cycle.label):'Sin ciclo actual'} · ${statusText}</small>
        </div>
        <button onclick="document.getElementById('cc-card-tabs')?.scrollIntoView({behavior:'smooth',block:'center'});">Cambiar tarjeta</button>
      </section>
      <section class="cc-config-modern-grid fade-up d2">
        <div class="cc-config-left-stack">
          <article class="cc-config-modern-card cc-config-dates-card">
            <div class="cc-config-card-head">
              <h3>Fechas del ciclo actual</h3>
              <button onclick="${currentCycle?`editTcCycle('${currentCycle.cycle.id}')`:`ccOpenCycleComposer('${draftCardId}')`}">✎ Editar</button>
            </div>
            <div class="cc-config-timeline">${timelineSteps}</div>
            <div class="cc-config-ok">✓ Tu ciclo está configurado correctamente.</div>
          </article>

          <article class="cc-config-modern-card">
            <div class="cc-config-card-head"><h3>Acciones rápidas</h3></div>
            <div class="cc-config-actions-grid">
              <button onclick="ccOpenHistoryPanel('${draftCardId}')"><span>□</span><div class="cc-config-action-copy"><strong>Ver historial de ciclos</strong><small>Consultá todos los ciclos anteriores y actuales.</small></div><b>›</b></button>
              <button onclick="ccDownloadConfig('${draftCardId}')"><span>↓</span><div class="cc-config-action-copy"><strong>Descargar configuración</strong><small>Descargá la configuración actual de tu ciclo.</small></div><b>›</b></button>
            </div>
          </article>

          <article class="cc-config-modern-card cc-config-helper-card">
            <div class="cc-config-card-head"><h3>Información del ciclo</h3></div>
            <p>La apertura define desde cuándo entran consumos, el cierre arma el resumen y el vencimiento marca la fecha límite de pago.</p>
          </article>
        </div>

        <aside class="cc-config-modern-card cc-config-new-cycle">
          <h3>Configurar nuevo ciclo</h3>
          <p>Definí las fechas de tu nuevo ciclo de tarjeta.</p>
          ${editingCycle?`<div class="cc-config-edit-banner">Estás editando ${esc(editingCycle.label||'este ciclo')}.</div>`:''}
          <label class="cc-config-field">
            <span>Tarjeta</span>
            <select class="cc-cfg-input" id="tc-cycle-card-cc">${cardOptions}</select>
          </label>
          <label class="cc-config-field">
            <span>Apertura del ciclo</span>
            <input type="date" class="cc-cfg-input" id="tc-cycle-open-cc">
          </label>
          <label class="cc-config-field">
            <span>Cierre del resumen</span>
            <input type="date" class="cc-cfg-input" id="tc-cycle-close-cc" onchange="ccSyncCloseDayFromDate()">
          </label>
          <label class="cc-config-field">
            <span>Vencimiento</span>
            <input type="date" class="cc-cfg-input" id="tc-cycle-due-cc">
          </label>
          <label class="cc-config-field">
            <span>Día de cierre</span>
            <select class="cc-cfg-input" id="tc-cycle-day-cc" onchange="ccApplyCloseDayFromConfig(this.value)">
              ${closeDayOptions}
            </select>
          </label>
          <input type="hidden" id="tc-cycle-label-cc" value="${editingCycle?esc(editingCycle.label||''):''}">
          <button class="cc-config-save-btn" onclick="addTcCycleFromCC()">⊕ ${editingCycle?'Guardar cambios':'Guardar nuevo ciclo'}</button>
          ${editingCycle?'<button class="cc-config-cancel-btn" onclick="cancelTcCycleEdit()">Cancelar edición</button>':''}
        </aside>
      </section>
    </div>
  `;
}

function ccSelectConfigCard(cardId){
  state.ccActiveCard=cardId;
  window._ccConfigDraftCardId=cardId;
  window._tcCycleEditId='';
  renderCreditCards();
}

function ccOpenHistoryPanel(cardId){
  window._ccHistoryCardId=cardId||state.ccActiveCard||state.ccCards?.[0]?.id||'';
  state.ccActiveCard=window._ccHistoryCardId;
  state.ccPageTab='history';
  renderCreditCards();
}

function renderCcHistoryPanel(){
  const el=document.getElementById('cc-history-panel-body');if(!el)return;
  const cycles=getTcCycles();
  const cards=state.ccCards||[];
  const activeCardId=window._ccHistoryCardId||state.ccActiveCard||cards[0]?.id||'';
  const activeCard=cards.find(c=>c.id===activeCardId)||cards[0];
  const shortD=s=>{
    if(!s)return'—';
    const d=new Date(s+'T12:00:00');
    return d.toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'}).replace('.','');
  };
  const today=dateToYMD(new Date());
  const cardCycles=cycles
    .map((cycle,idx)=>({cycle,idx}))
    .filter(({cycle})=>((cycle.cardId||cards[0]?.id)===activeCard?.id))
    .sort((a,b)=>(b.cycle.closeDate||'').localeCompare(a.cycle.closeDate||''));

  const rows=cardCycles.map(({cycle,idx},rowIdx)=>{
    const open=cycle.openDate||getTcCycleOpen(cycles,idx);
    const totals=ccGetTotals(ccGetCycleExpenses(activeCard.id,cycle.id));
    const status=state.ccCycles.find(x=>x.tcCycleId===cycle.id&&x.cardId===activeCard.id);
    const isPaid=status?.status==='paid';
    const isActive=!!open&&!!cycle.closeDate&&open<=today&&today<=cycle.closeDate;
    return `<details class="cch-row ${isActive?'is-active-now':''}" ${isActive||rowIdx<2?'open':''}>
      <summary>
        <div class="cch-row-main">
          <span class="cch-dot ${isActive?'is-active':isPaid?'is-paid':'is-pending'}"></span>
          <div>
            <strong>${esc(cycle.label||'Ciclo')}${isActive?'<em>Activo ahora</em>':''}</strong>
            <small>${esc(shortD(open))} → ${esc(shortD(cycle.closeDate))}${cycle.dueDate?' · vence '+esc(shortD(cycle.dueDate)):''}</small>
          </div>
        </div>
        <div class="cch-row-money">
          <strong>${totals.ars>0?'$'+fmtN(Math.round(totals.ars)):'Sin gastos'}</strong>
          ${totals.usd>0?`<small>USD ${fmtN(totals.usd)}</small>`:''}
        </div>
      </summary>
      <div class="cch-row-body">
        <div><span>Apertura</span><strong>${esc(shortD(open))}</strong></div>
        <div><span>Cierre</span><strong>${esc(shortD(cycle.closeDate))}</strong></div>
        <div><span>Vencimiento</span><strong>${cycle.dueDate?esc(shortD(cycle.dueDate)):'—'}</strong></div>
        <div><span>Estado</span><strong>${isPaid?'Pagado':'Pendiente'}</strong></div>
        <div class="cch-row-actions">
          <button onclick="editTcCycle('${cycle.id}')">Editar</button>
          <button onclick="deleteTcCycle('${cycle.id}')">Borrar</button>
        </div>
      </div>
    </details>`;
  }).join('');

  el.innerHTML=`
    <section class="cc-history-clean fade-up d1">
      <div class="cc-history-clean-head">
        <div>
          <div class="cc-config-kicker">Historial</div>
          <h3>Historial de ciclos</h3>
          <p>Elegí una tarjeta arriba y abrí cada ciclo para ver sus fechas o editarlo.</p>
        </div>
        <button onclick="ccSelectPageTab('config')">Volver a configuración</button>
      </div>
      <div class="cch-list">${rows||'<div class="cc-config-empty-card"><div class="cc-config-empty-title">Sin ciclos para esta tarjeta</div></div>'}</div>
    </section>
  `;
}

function ccCreateCardPrompt(){
  const name=prompt('Nombre de la nueva tarjeta:','');
  if(!name||!name.trim()) return;
  const key=name.toLowerCase().includes('amex')?'amex':name.toLowerCase().includes('visa')?'visa':'tc_'+Date.now().toString(36).slice(-4);
  const color=key==='amex'?'#457b9d':key==='visa'?'#e63946':'#6d4aff';
  const card={id:'card_'+Date.now().toString(36),name:name.trim(),color,payMethodKey:key};
  state.ccCards=[...(state.ccCards||[]),card];
  state.ccActiveCard=card.id;
  window._ccConfigDraftCardId=card.id;
  saveState();
  renderCreditCards();
  showToast('✓ Tarjeta creada','success');
}

function ccDownloadConfig(cardId){
  const card=(state.ccCards||[]).find(c=>c.id===cardId);
  const cycles=getTcCycles().filter(c=>(c.cardId||state.ccCards?.[0]?.id)===cardId);
  const payload={card,cycles};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`configuracion-${(card?.name||'tarjeta').toLowerCase().replace(/\s+/g,'-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Toggle "ver más / ver menos" en la sección de registros ──
if(!window._ccRecordsExpanded) window._ccRecordsExpanded={};
function ccToggleRecordsExpanded(cardId){
  window._ccRecordsExpanded[cardId]=!window._ccRecordsExpanded[cardId];
  renderCcConfigPanel();
}

// ── Borrar ciclos más antiguos (mantiene solo los 2 más recientes por tarjeta) ──
function ccDeleteOldCycles(cardId){
  if(!confirm('¿Borrar los ciclos antiguos de esta tarjeta y dejar solo el actual y el anterior? Esta acción no se puede deshacer.')) return;
  const cycles=getTcCycles();
  const cards=state.ccCards||[];
  const cardCycles=[...cycles]
    .filter(c=>(c.cardId||cards[0]?.id)===cardId)
    .sort((a,b)=>b.closeDate.localeCompare(a.closeDate));

  // Dedup by closeDate (same logic as render)
  const seen=new Set();
  const deduped=[];
  cardCycles.forEach(c=>{
    if(!seen.has(c.closeDate)){ seen.add(c.closeDate); deduped.push(c); }
  });

  const toDelete=deduped.slice(2); // everything beyond the 2 most recent
  if(!toDelete.length){ showToast('Sin ciclos para limpiar','info'); return; }

  toDelete.forEach(cycle=>{
    const signature=getTcCycleSignature(cycle);
    if(signature) state.hiddenTcCycles=Array.from(new Set([...(state.hiddenTcCycles||[]),signature]));
    state.tcCycles=(state.tcCycles||[]).filter(c=>c.id!==cycle.id && getTcCycleSignature(c)!==signature);
    state.ccCycles=(state.ccCycles||[]).filter(c=>c.tcCycleId!==cycle.id);
  });

  saveState();
  if(typeof refreshAll==='function') refreshAll();
  renderCcConfigPanel();
  showToast(`${toDelete.length} ciclo${toDelete.length===1?'':'s'} eliminado${toDelete.length===1?'':'s'}`,'success');
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
