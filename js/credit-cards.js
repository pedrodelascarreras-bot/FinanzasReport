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
  const card=state.ccCards.find(c=>c.id===cardId);
  const pmKey=card?.payMethodKey||null;
  const tcCycles=getTcCycles();
  const idx=tcCycles.findIndex(c=>c.id===tcCycleId);
  if(idx<0)return[];
  const openDate=getTcCycleOpen(tcCycles, idx);
  const cycle=tcCycles[idx];

  const ccState=state.ccCycles.find(c=>c.cardId===cardId && c.tcCycleId===tcCycleId) || {excludedIds:[], manualExpenses:[]};
  const excluded=new Set(ccState.excludedIds||[]);
  
  const txnExpenses=(state.transactions||[]).filter(t=>{
    if(excluded.has(t.id))return false;
    if(pmKey && t.payMethod!==pmKey)return false;
    const d=dateToYMD(t.date);
    return d>=openDate && d<=cycle.closeDate;
  }).map(t=>({
    id:t.id, date:dateToYMD(t.date), description:t.description, category:t.category||'Sin categoría',
    amountARS:t.currency==='ARS'?t.amount:0, amountUSD:t.currency==='USD'?t.amount:0, source:'txn'
  }));

  const manualExpenses=(ccState.manualExpenses||[]).map(e=>({...e,source:'manual'}));
  return [...txnExpenses,...manualExpenses].sort((a,b)=>b.date.localeCompare(a.date));
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

// ── Renderizar página completa ──
function renderCreditCards(){
  ccInit();
  renderCcCardTabs();
  renderCcActiveCycle();
  renderCcTcConfig();
}

function renderCcCardTabs(){
  const el=document.getElementById('cc-card-tabs');if(!el)return;
  el.innerHTML=state.ccCards.map(card=>{
    const isActive=state.ccActiveCard===card.id;
    return '<button onclick="ccSelectCard(\''+card.id+'\')" style="'
      +'display:inline-flex;align-items:center;gap:8px;padding:9px 18px;border-radius:10px;border:2px solid '
      +(isActive?card.color:'var(--border)')+';background:'+(isActive?card.color+'18':'var(--surface)')+';color:'
      +(isActive?card.color:'var(--text)')+';font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;font-family:var(--font);">'
      +'<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+card.color+';"></span>'
      +esc(card.name)
      +'</button>';
  }).join('');
}

function ccSelectCard(cardId){
  ccInit();
  state.ccActiveCard=cardId;
  window._ccViewCycle[cardId]=null; // reset viewed cycle for this card
  renderCcCardTabs();
  renderCcActiveCycle();
}

function ccSelectViewCycle(cycleId){
  const cardId=state.ccActiveCard||state.ccCards[0]?.id;
  window._ccViewCycle[cardId]=cycleId;
  renderCreditCards();
}

function renderCcActiveCycle(){
  ccInit();
  const emptyEl=document.getElementById('cc-empty-state');
  const activeEl=document.getElementById('cc-active-cycle');
  const actionsEl=document.getElementById('cc-page-actions');
  if(!emptyEl||!activeEl)return;

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
  
  // Buscar o crear estado en ccCycles para este par {cardId, tcCycleId}
  let ccState=state.ccCycles.find(c=>c.cardId===cardId && c.tcCycleId===activeTcCycle.id);
  if(!ccState){
    ccState={id:activeTcCycle.id+'_'+cardId, cardId, tcCycleId:activeTcCycle.id, status:'pending', manualExpenses:[], excludedIds:[]};
    // No lo pusheamos al state real a menos que se modifique algo (pago, gasto manual, etc) para evitar engrosar el state innecesariamente
  }

  // Rango del ciclo
  const idx=tcCycles.findIndex(c=>c.id===activeTcCycle.id);
  const openDate=getTcCycleOpen(tcCycles, idx);
  
  // Gastos
  const pmKey=card?.payMethodKey||null;
  const excluded=new Set(ccState.excludedIds||[]);
  const txnExpenses=(state.transactions||[]).filter(t=>{
    if(excluded.has(t.id))return false;
    if(pmKey && t.payMethod!==pmKey)return false;
    const d=dateToYMD(t.date);
    return d>=openDate && d<=activeTcCycle.closeDate;
  }).map(t=>({
    id:t.id, date:dateToYMD(t.date), description:t.description, category:t.category||'Sin categoría',
    amountARS:t.currency==='ARS'?t.amount:0, amountUSD:t.currency==='USD'?t.amount:0, source:'txn'
  }));

  const manualExpenses=(ccState.manualExpenses||[]).map(e=>({...e,source:'manual'}));
  const expenses = [...txnExpenses,...manualExpenses].sort((a,b)=>b.date.localeCompare(a.date));
  const totals=ccGetTotals(expenses);
  const catSummary=ccGetCatSummary(expenses);
  const isPaid=ccState.status==='paid';

  const statusBadge=isPaid
    ?'<span style="background:var(--green-sys);color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.04em;">✓ PAGADO</span>'
    :'<span style="background:var(--orange);color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.04em;">⏳ PENDIENTE</span>';

  // Selector de ciclo en la cabecera
  if(actionsEl){
    actionsEl.innerHTML=`
      <div style="display:flex;align-items:center;gap:10px;background:var(--surface2);padding:4px 12px;border-radius:10px;border:1px solid var(--border);">
        <span style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;">Período</span>
        <select onchange="ccSelectViewCycle(this.value)" style="background:none;border:none;color:var(--text);font-size:13px;font-weight:700;font-family:var(--font);cursor:pointer;outline:none;">
          ${tcCycles.map(c=>{
            const s=state.ccCycles.find(x=>x.cardId===cardId && x.tcCycleId===c.id);
            const paid=s && s.status==='paid';
            return `<option value="${c.id}" ${c.id===activeTcCycle.id?'selected':''}>${paid?'✓ ':'⏳ '}${esc(c.label)}</option>`;
          }).join('')}
        </select>
      </div>
    `;
  }

  const catRows=catSummary.map(r=>'<tr>'
    +'<td style="padding:6px 8px;font-size:12px;color:var(--text);">'+esc(r.cat)+'</td>'
    +'<td style="padding:6px 8px;font-size:12px;font-family:var(--font);text-align:right;color:var(--accent);">'+(r.ars>0?'$'+fmtN(Math.round(r.ars)):'—')+'</td>'
    +'<td style="padding:6px 8px;font-size:12px;font-family:var(--font);text-align:right;color:var(--accent2);">'+(r.usd>0?'U$D '+fmtN(r.usd):'—')+'</td>'
    +'</tr>'
  ).join('');

  const expRows=expenses.map(e=>{
    const removeBtn=e.source==='txn'
      ?'<button onclick="ccExcludeTxn(\''+activeTcCycle.id+'\',\''+e.id+'\')" title="Excluir de este ciclo" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:13px;padding:2px 6px;border-radius:4px;opacity:.5;transition:opacity .13s;" onmouseover="this.style.opacity=1;this.style.color=\'var(--danger)\'" onmouseout="this.style.opacity=.5;this.style.color=\'var(--text3)\'">✕</button>'
      :'<button onclick="ccDeleteManualExpense(\''+activeTcCycle.id+'\',\''+e.id+'\')" title="Eliminar gasto manual" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:13px;padding:2px 6px;border-radius:4px;opacity:.5;transition:opacity .13s;" onmouseover="this.style.opacity=1;this.style.color=\'var(--danger)\'" onmouseout="this.style.opacity=.5;this.style.color=\'var(--text3)\'">✕</button>';
    return '<tr style="border-bottom:1px solid var(--border);">'
      +'<td style="padding:8px;font-size:12px;color:var(--text3);white-space:nowrap;font-family:var(--font);">'+ccFmtDate(e.date)+'</td>'
      +'<td style="padding:8px;font-size:13px;color:var(--text);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(e.description)+'</td>'
      +'<td style="padding:8px;font-size:11px;color:var(--text3);">'+esc(e.category)+'</td>'
      +'<td style="padding:8px;font-size:13px;font-family:var(--font);text-align:right;color:var(--accent);">'+(e.amountARS>0?'$'+fmtN(Math.round(e.amountARS)):'—')+'</td>'
      +'<td style="padding:8px;font-size:13px;font-family:var(--font);text-align:right;color:var(--accent2);">'+(e.amountUSD>0?'U$D '+fmtN(e.amountUSD):'—')+'</td>'
      +'<td style="padding:8px;text-align:right;">'+removeBtn+'</td>'
    +'</tr>';
  }).join('');

  // Botón PAGADO
  const actionBtns=isPaid
    ?''
    :'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
      +'<button class="btn btn-ghost btn-sm" onclick="ccOpenManualExpenseModal(\''+activeTcCycle.id+'\')">+ Agregar gasto</button>'
      +'<button onclick="ccMarkPaid(\''+activeTcCycle.id+'\')" style="'
        +'padding:12px 28px;border-radius:12px;border:none;cursor:pointer;'
        +'background:linear-gradient(135deg,#00c853,#00e676);color:#fff;'
        +'font-size:15px;font-weight:800;letter-spacing:.06em;'
        +'box-shadow:0 4px 16px rgba(0,200,83,0.35);'
        +'transition:transform .12s,box-shadow .12s;'
        +'font-family:var(--font);"'
        +' onmouseover="this.style.transform=\'scale(1.04)\';this.style.boxShadow=\'0 6px 24px rgba(0,200,83,0.5)\'"'
        +' onmouseout="this.style.transform=\'\';this.style.boxShadow=\'0 4px 16px rgba(0,200,83,0.35)\'"'
      +'>✓ PAGADO</button>'
    +'</div>';

  const noGastosHtml='<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">Sin gastos en este ciclo</div>';

  // Due date
  const countdown = ccCountdown(ccState?.dueDate);

  // Paid history
  const paidCycles = (state.ccCycles||[]).filter(c => c.cardId === cardId && c.status === 'paid');
  const paidHistoryHtml = paidCycles.length ? _ccBuildPaidHistoryHtml(cardId, paidCycles, tcCycles) : '';

  activeEl.innerHTML=`
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;">
      <div style="padding:18px 20px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${statusBadge}
            ${card?'<span style="font-size:11px;font-weight:700;color:'+card.color+';background:'+card.color+'15;padding:2px 8px;border-radius:6px;">'+esc(card.name)+'</span>':''}
          </div>
          <div style="margin-top:8px;font-size:13px;color:var(--text3);display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
            <span>Apertura: <strong style="color:var(--text);">${ccFmtDate(openDate)}</strong></span>
            <span>Cierre: <strong style="color:var(--text);">${ccFmtDate(activeTcCycle.closeDate)}</strong></span>
            ${(() => {
              const d = ccState.dueDate || activeTcCycle.dueDate;
              if (d) {
                const c = ccCountdown(d);
                return `<span>Vencimiento: <strong style="color:${c.overdue?'var(--red)':c.urgent?'var(--orange)':'var(--text)'}">${ccFmtDate(d)}</strong>&nbsp;<span style="font-size:10px;font-weight:600;color:${c.overdue?'var(--red)':c.urgent?'var(--orange)':'var(--text3)'};">(${c.text})</span></span>`;
              }
              return `<button onclick="ccSetDueDate('${activeTcCycle.id}')" style="background:none;border:1px dashed var(--border);border-radius:6px;padding:3px 9px;cursor:pointer;color:var(--text3);font-size:11px;font-family:var(--font);transition:border-color .12s,color .12s;" onmouseover="this.style.color='var(--text)';this.style.borderColor='var(--text3)'" onmouseout="this.style.color='var(--text3)';this.style.borderColor='var(--border)'">📅 + Vencimiento</button>`;
            })()}
          </div>
        </div>
        ${actionBtns}
      </div>

      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:1px;background:var(--border);">
        <div style="background:var(--surface);padding:16px 20px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text3);margin-bottom:4px;">Total ARS</div>
          <div style="font-size:22px;font-weight:700;font-family:var(--font);color:var(--accent);">$${fmtN(Math.round(totals.ars))}</div>
        </div>
        <div style="background:var(--surface);padding:16px 20px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text3);margin-bottom:4px;">Total USD</div>
          <div style="font-size:22px;font-weight:700;font-family:var(--font);color:var(--accent2);">${totals.usd>0?'U$D '+fmtN(totals.usd):'—'}</div>
        </div>
        <div style="background:var(--surface);padding:16px 20px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text3);margin-bottom:4px;">Items</div>
          <div style="font-size:22px;font-weight:700;font-family:var(--font);">${totals.count}</div>
        </div>
      </div>

      ${catSummary.length?`
      <!-- Resumen por categoría -->
      <div style="padding:16px 20px;border-top:1px solid var(--border);">
        <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text3);margin-bottom:10px;">Por categoría</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:left;font-size:10px;color:var(--text3);font-weight:600;padding:4px 8px;text-transform:uppercase;letter-spacing:.03em;">Categoría</th>
            <th style="text-align:right;font-size:10px;color:var(--text3);font-weight:600;padding:4px 8px;text-transform:uppercase;letter-spacing:.03em;">ARS</th>
            <th style="text-align:right;font-size:10px;color:var(--text3);font-weight:600;padding:4px 8px;text-transform:uppercase;letter-spacing:.03em;">USD</th>
          </tr></thead>
          <tbody>${catRows}</tbody>
        </table>
      </div>
      `:''}

      <!-- Tabla de gastos (collapsible) -->
      <div style="padding:16px 20px;border-top:1px solid var(--border);">
        <div onclick="ccToggleExpenses()" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;">
          <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text3);">Gastos del ciclo (${expenses.length})</div>
          <span id="cc-expenses-toggle-arrow" style="font-size:12px;color:var(--text3);transition:transform .15s;">▾</span>
        </div>
        <div id="cc-expenses-toggle-body" style="margin-top:10px;">
        ${expenses.length?`
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>
              <th style="text-align:left;font-size:10px;color:var(--text3);font-weight:600;padding:6px 8px;text-transform:uppercase;letter-spacing:.03em;">Fecha</th>
              <th style="text-align:left;font-size:10px;color:var(--text3);font-weight:600;padding:6px 8px;text-transform:uppercase;letter-spacing:.03em;">Descripción</th>
              <th style="text-align:left;font-size:10px;color:var(--text3);font-weight:600;padding:6px 8px;text-transform:uppercase;letter-spacing:.03em;">Categoría</th>
              <th style="text-align:right;font-size:10px;color:var(--text3);font-weight:600;padding:6px 8px;text-transform:uppercase;letter-spacing:.03em;">ARS</th>
              <th style="text-align:right;font-size:10px;color:var(--text3);font-weight:600;padding:6px 8px;text-transform:uppercase;letter-spacing:.03em;">USD</th>
              <th style="width:36px;"></th>
            </tr></thead>
            <tbody>${expRows}</tbody>
          </table>
        </div>
        `:noGastosHtml}
        </div>
      </div>
    </div>
  `;

  // Update History Section
  const histSec = document.getElementById('cc-history-section');
  const histList = document.getElementById('cc-history-list');
  if (histSec && histList) {
    if (paidCycles.length) {
      histSec.style.display = 'block';
      histList.innerHTML = _ccBuildPaidHistoryHtml(cardId, paidCycles, tcCycles);
    } else {
      histSec.style.display = 'none';
      histList.innerHTML = '';
    }
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

// ── Render TC Config section inline dentro de la página de Tarjeta de Crédito ──
function renderCcTcConfig(){
  const el=document.getElementById('cc-tc-config-list');if(!el)return;
  const cycles=getTcCycles();
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
        '<div style="font-size:13px;font-weight:700;color:var(--text);">'+esc(c.label)+'</div>'+
        '<div style="font-size:11px;color:var(--text3);font-family:var(--font);margin-top:2px;">'+fmtD(openD)+' → '+fmtD(closeD)+dueDStr+'</div>'+
      '</div>'+
      '<div style="font-size:13px;font-weight:700;color:var(--accent);font-family:var(--font);">'+(total>0?'$'+fmtN(total):'sin gastos')+'</div>'+
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
