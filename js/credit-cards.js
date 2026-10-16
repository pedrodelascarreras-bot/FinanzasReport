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
  try{ _fixSantanderVisaJul2026(); }catch(e){ console.error('fixSantanderVisaJul2026:', e); }
}

function _fixSantanderVisaJul2026(){
  let done='';
  try{ done=localStorage.getItem('_visaJul2026FixedV4')||''; }catch(e){}
  if(done||state._visaJul2026FixedV4) return;
  if(!Array.isArray(state.tcCycles)) state.tcCycles=[];
  // Remove any wrong cycles for card_1 in the current period (null-safe)
  state.tcCycles=state.tcCycles.filter(c=>{
    if(!c) return false;
    if(c.cardId!=='card_1') return true;
    if(c.closeDate==='2026-07-02'&&c.openDate==='2026-05-27'&&c.dueDate==='2026-07-14') return true;
    if((c.closeDate||'')>='2026-06-01'&&(c.closeDate||'')<='2026-07-31') return false;
    return true;
  });
  const hasCorrect=state.tcCycles.some(c=>c&&c.cardId==='card_1'&&c.closeDate==='2026-07-02'&&c.openDate==='2026-05-27'&&c.dueDate==='2026-07-14');
  if(!hasCorrect){
    state.tcCycles.push({id:'tc_visa_jul2026',label:'VISA · jul 2026',cardId:'card_1',openDate:'2026-05-27',closeDate:'2026-07-02',dueDate:'2026-07-14',payMethodKey:'visa',viewMode:'visa',source:'manual'});
  }
  if(!Array.isArray(state.hiddenTcCycles)) state.hiddenTcCycles=[];
  // Solo ocultar el ciclo auto-generado VIEJO (día 25, de cuando closeDay todavía no
  // estaba sincronizado). El de día 2 es el ciclo de junio correcto — un fix anterior (V3)
  // lo ocultaba por error, haciendo desaparecer "VISA junio" del selector.
  if(!state.hiddenTcCycles.includes('visa::card_1::2026-06-25')) state.hiddenTcCycles.push('visa::card_1::2026-06-25');
  // Asegurar que las firmas correctas (jul actual + jun auto) no queden ocultas
  state.hiddenTcCycles=state.hiddenTcCycles.filter(s=>s!=='visa::card_1::2026-07-02'&&s!=='visa::card_1::2026-06-02');
  // Reset selecciones fijas para que la UI resuelva el ciclo actual
  state.dashTcCycle=null;
  if(window._ccViewCycle) window._ccViewCycle['card_1']=null;
  state._visaJul2026FixedV4=true;
  try{ localStorage.setItem('_visaJul2026FixedV4','1'); }catch(e){}
}

// ── Per-card: which cycle is being viewed ──
// window._ccViewCycle = { cardId: cycleId }
if(!window._ccViewCycle) window._ccViewCycle={};


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
  
  // Receta única (js/totals.js) con el monto completo, que es lo que cobra el banco.
  // La tarjeta principal se lleva también los cargos "tarjeta" genéricos y sin medio de pago.
  const cardRule=pmKey==='amex'?'amex':(cardId===genericOwnerId?'visa':(pmKey||'visa'));
  const periodEntries=getPeriodExpenseEntries({
    startStr:openDate,
    endStr:cycle.closeDate,
    card:cardRule,
    amountMode:'full',
    todayRef:new Date()
  }).filter(e=>!excluded.has(e.id));
  const txnExpenses=periodEntries.filter(e=>!e.isProjected).map(e=>({
    id:e.id, date:dateToYMD(e.date), description:e.description, category:e.category,
    amountARS:e.currency==='USD'?0:e.amount,
    amountUSD:e.currency==='USD'?e.amount:0,
    isPendingCuota:false,
    isPendingSubscription:false,
    source:'txn'
  }));
  const projectedExpenses=periodEntries.filter(e=>e.isProjected).map(e=>({
    id:e.id, date:dateToYMD(e.date), description:e.description, category:e.category,
    amountARS:e.currency==='USD'?0:e.amount,
    amountUSD:e.currency==='USD'?e.amount:0,
    isPendingCuota:e.group==='cuotas',
    isPendingSubscription:e.group==='suscripciones',
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




function ccCardBrandLabel(card){
  return (card?.payMethodKey||card?.name||'').toLowerCase().includes('amex') ? 'AMEX' : 'VISA';
}



// ── Página: solo la configuración de cada tarjeta (aperturas, cierres, vencimientos) ──
function ccSelectPageTab(){
  renderCreditCards();
}

function renderCreditCards(){
  ccInit();
  const sub=document.getElementById('cc-page-subtitle');
  if(sub) sub.textContent='Aperturas, cierres y vencimientos de cada tarjeta.';
  renderCcConfigPanel();
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


function ccSyncCloseDayFromDate(){
  const closeEl=document.getElementById('tc-cycle-close-cc');
  const dayEl=document.getElementById('tc-cycle-day-cc');
  if(closeEl?.value&&dayEl){
    dayEl.value=String(new Date(closeEl.value+'T12:00:00').getDate());
  }
}

// ── Render Configuración panel — multi-card dashboard ──
function renderCcConfigPanel(){
  const el=document.getElementById('cc-config-panel-body');if(!el)return;
  const cycles=getTcCycles();
  const cards=state.ccCards||[];
  const editingId=window._tcCycleEditId||'';
  const editingCycle=editingId ? cycles.find(c=>c.id===editingId) : null;
  const draftCardId=window._ccConfigDraftCardId||editingCycle?.cardId||state.ccActiveCard||cards[0]?.id||'';
  const todayYmd=dateToYMD(new Date());
  const today=new Date();today.setHours(0,0,0,0);
  const fmtShort=s=>{if(!s)return'—';const d=new Date(s+'T12:00:00');return d.toLocaleDateString('es-AR',{day:'numeric',month:'short'});};
  const daysFrom=s=>{if(!s)return null;const d=new Date(s+'T12:00:00');d.setHours(0,0,0,0);return Math.round((d-today)/86400000);};
  const cardOptions=cards.map(card=>`<option value="${esc(card.id)}" ${card.id===draftCardId?'selected':''}>${esc(card.name)}</option>`).join('');

  const actionsEl=document.getElementById('cc-page-actions');
  if(actionsEl) actionsEl.innerHTML='';

  // Build per-card status cards
  const cardStatusHtml=cards.map(card=>{
    const cardCycles=cycles
      .filter(c=>(c.cardId||cards[0]?.id)===card.id)
      .sort((a,b)=>(b.closeDate||'').localeCompare(a.closeDate||''));
    const activeCycle=cardCycles.find(c=>{
      const open=c.openDate||getTcCycleOpen(cycles,cycles.findIndex(x=>x.id===c.id))||c.closeDate;
      return open<=todayYmd&&todayYmd<=c.closeDate;
    })||cardCycles[0]||null;
    const hasActiveCycle=!!activeCycle;
    const open=activeCycle?(activeCycle.openDate||getTcCycleOpen(cycles,cycles.findIndex(x=>x.id===activeCycle.id))||activeCycle.closeDate):'';
    const totals=activeCycle?ccGetTotals(ccGetCycleExpenses(card.id,activeCycle.id)):{ars:0,usd:0};
    const statusEntry=activeCycle?state.ccCycles.find(x=>x.tcCycleId===activeCycle.id&&x.cardId===card.id):null;
    const isPaid=statusEntry?.status==='paid';
    const isCurrentlyActive=activeCycle&&open<=todayYmd&&todayYmd<=activeCycle.closeDate;
    const brand=ccCardBrandLabel(card);
    const isEditing=editingCycle?.cardId===card.id;
    const dueDateStr=statusEntry?.dueDate||activeCycle?.dueDate||'';
    const daysToClose=activeCycle?daysFrom(activeCycle.closeDate):null;
    const daysToDue=dueDateStr?daysFrom(dueDateStr):null;

    const statusBadgeClass=isPaid?'ccr-badge-paid':isCurrentlyActive?'ccfg-badge-active':'ccr-badge-pending';
    const statusBadgeText=isPaid?'Pagado':isCurrentlyActive?'Activo':'Pendiente';

    const fmtDays=(n,label)=>{
      if(n===null)return'';
      if(n<0)return`<span class="ccfg-countdown-chip is-overdue"><b>${label}</b>Vencido</span>`;
      if(n===0)return`<span class="ccfg-countdown-chip is-urgent"><b>${label}</b>Hoy</span>`;
      return`<span class="ccfg-countdown-chip ${n<=5?'is-urgent':''}"><b>${label}</b>${n} día${n===1?'':'s'}</span>`;
    };

    // Past cycles for history
    const pastCycles=cardCycles.filter(c=>c.id!==activeCycle?.id&&c.closeDate<todayYmd).slice(0,8);
    const historyHtml=pastCycles.length?pastCycles.map(c=>{
      const ps=state.ccCycles.find(x=>x.tcCycleId===c.id&&x.cardId===card.id);
      const pp=ps?.status==='paid';
      const pt=ccGetTotals(ccGetCycleExpenses(card.id,c.id));
      return`<div class="ccfg-hist-row">
        <span class="ccr-status-dot ${pp?'is-paid':'is-pending'}"></span>
        <span class="ccfg-hist-label">${esc(c.label)}</span>
        <span class="ccfg-hist-total">${pt.ars>0?'$'+fmtN(Math.round(pt.ars)):'$0'}</span>
        <button class="ccfg-hist-edit" onclick="editTcCycle('${c.id}')">✎</button>
      </div>`;
    }).join(''):'<div class="ccfg-hist-empty">Sin ciclos anteriores</div>';

    if(!hasActiveCycle){
      return`<article class="ccfg-card ccfg-card-empty" style="--cc-card-color:${card.color};">
        <div class="ccfg-card-head">
          <span class="ccfg-card-dot" style="background:${card.color};"></span>
          <strong>${esc(card.name)}</strong>
          <span class="ccfg-card-brand">${brand}</span>
        </div>
        <div class="ccfg-card-empty-msg">Sin ciclo activo</div>
        <button class="ccfg-card-action" onclick="ccOpenCycleComposer('${card.id}')">+ Configurar ciclo</button>
      </article>`;
    }

    return`<article class="ccfg-card ${isPaid?'is-paid':''} ${isEditing?'is-editing':''}" style="--cc-card-color:${card.color};">
      <div class="ccfg-card-head">
        <span class="ccfg-card-dot" style="background:${card.color};"></span>
        <strong>${esc(card.name)}</strong>
        <span class="ccfg-card-brand">${brand}</span>
        <span class="ccr-badge ${statusBadgeClass}">${statusBadgeText}</span>
      </div>
      <div class="ccfg-card-label">${esc(activeCycle.label)}</div>
      <div class="ccfg-card-dates">
        <div><b>Apertura</b><span>${esc(fmtShort(open))}</span></div>
        <div><b>Cierre</b><span>${esc(fmtShort(activeCycle.closeDate))}</span></div>
        <div><b>Vencimiento</b><span>${dueDateStr?esc(fmtShort(dueDateStr)):'—'}</span></div>
      </div>
      <div class="ccfg-card-countdown">
        ${fmtDays(daysToClose,'Cierre')}
        ${fmtDays(daysToDue,'Vence')}
      </div>
      <div class="ccfg-card-total">
        <span>Total</span>
        <strong>${totals.ars>0?'$'+fmtN(Math.round(totals.ars)):'$0'}</strong>
        ${totals.usd>0?`<small>USD ${fmtN(totals.usd)}</small>`:''}
      </div>
      <div class="ccfg-card-actions">
        <button onclick="editTcCycle('${activeCycle.id}')">Editar ciclo</button>
        <button onclick="ccOpenCycleComposer('${card.id}')">Nuevo ciclo</button>
      </div>
      ${pastCycles.length?`
      <details class="ccfg-history">
        <summary>Historial · ${pastCycles.length} ciclo${pastCycles.length===1?'':'s'} anterior${pastCycles.length===1?'':'es'}</summary>
        <div class="ccfg-hist-list">${historyHtml}</div>
      </details>`:''}
    </article>`;
  }).join('');

  el.innerHTML=`
    <div class="cc-config-shell cc-config-modern-shell">
      <section class="ccfg-dashboard fade-up d1">
        <div class="ccfg-dashboard-head">
          <h3>Estado de tus tarjetas</h3>
          <small>${cards.length} tarjeta${cards.length===1?'':'s'} configurada${cards.length===1?'':'s'}</small>
        </div>
        <div class="ccfg-cards-grid">
          ${cardStatusHtml}
        </div>
      </section>

      <section class="ccfg-form-section fade-up d2">
        <div class="cc-config-modern-card ccfg-form-card">
          <div class="ccfg-form-header">
            <div>
              <h3>${editingCycle?'Editar ciclo':'Nuevo ciclo'}</h3>
              <p>${editingCycle?'Modificá las fechas de este ciclo.':'Elegí la tarjeta y definí las fechas del nuevo período.'}</p>
            </div>
            ${editingCycle?`<div class="cc-config-edit-banner">Editando: ${esc(editingCycle.label||'ciclo')}</div>`:''}
          </div>
          <div class="ccfg-form-grid">
            <label class="cc-config-field ccfg-field-card">
              <span>Tarjeta</span>
              <select class="cc-cfg-input" id="tc-cycle-card-cc">${cardOptions}</select>
            </label>
            <label class="cc-config-field">
              <span>Apertura del ciclo</span>
              <input type="date" class="cc-cfg-input" id="tc-cycle-open-cc" value="${editingCycle?(editingCycle.openDate||getTcCycleOpen(cycles,cycles.findIndex(x=>x.id===editingCycle.id))||''):''}">
            </label>
            <label class="cc-config-field">
              <span>Cierre del resumen</span>
              <input type="date" class="cc-cfg-input" id="tc-cycle-close-cc" onchange="ccSyncCloseDayFromDate()" value="${editingCycle?(editingCycle.closeDate||''):''}">
            </label>
            <label class="cc-config-field">
              <span>Vencimiento</span>
              <input type="date" class="cc-cfg-input" id="tc-cycle-due-cc" value="${editingCycle?(editingCycle.dueDate||''):''}">
            </label>
            <div class="ccfg-form-actions">
              <input type="hidden" id="tc-cycle-label-cc" value="${editingCycle?esc(editingCycle.label||''):''}">
              <button class="cc-config-save-btn" onclick="addTcCycleFromCC()">${editingCycle?'Guardar cambios':'Guardar ciclo'}</button>
              ${editingCycle?'<button class="cc-config-cancel-btn" onclick="cancelTcCycleEdit()">Cancelar</button>':''}
            </div>
          </div>
        </div>
      </section>
    </div>
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



// ── Borrar ciclos más antiguos (mantiene solo los 2 más recientes por tarjeta) ──

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


