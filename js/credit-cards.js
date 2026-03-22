// ══ TARJETA DE CRÉDITO ══
// Persistencia: state.ccCards, state.ccCycles (integrado en state global)

// ── Inicializar datos por defecto ──
function ccInit(){
  if(!state.ccCards||!state.ccCards.length){
    state.ccCards=[
      {id:'card_1',name:'Santander Visa',color:'#e63946'},
      {id:'card_2',name:'Santander Mastercard',color:'#457b9d'}
    ];
  }
  if(!state.ccCycles) state.ccCycles=[];
  if(!state.ccActiveCard) state.ccActiveCard=state.ccCards[0]?.id||'card_1';
}

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

// ── Obtener ciclo anterior de una tarjeta ──
function ccPrevCycleClose(cardId, currentCycle){
  const sorted=[...state.ccCycles]
    .filter(c=>c.cardId===cardId&&c.closeDate<currentCycle.closeDate)
    .sort((a,b)=>b.closeDate.localeCompare(a.closeDate));
  return sorted[0]?.closeDate||null;
}

// ── Obtener gastos del ciclo (movimientos + manuales) ──
function ccGetCycleExpenses(cycle){
  const prevClose=ccPrevCycleClose(cycle.cardId,cycle);
  // Rango: día siguiente al cierre anterior → fecha de cierre de este ciclo
  const from=prevClose?(()=>{const d=new Date(prevClose+'T12:00:00');d.setDate(d.getDate()+1);return d.toISOString().slice(0,10);})():null;
  const to=cycle.closeDate;

  // Fuente A: transacciones de movimientos en el rango
  const excluded=new Set(cycle.excludedIds||[]);
  const txnExpenses=(state.transactions||[]).filter(t=>{
    if(excluded.has(t.id))return false;
    const d=t.date instanceof Date?t.date.toISOString().slice(0,10):String(t.date).slice(0,10);
    return(!from||d>=from)&&d<=to;
  }).map(t=>({
    id:t.id,
    date:t.date instanceof Date?t.date.toISOString().slice(0,10):String(t.date).slice(0,10),
    description:t.description,
    category:t.category||'Sin categoría',
    amountARS:t.currency==='ARS'?t.amount:0,
    amountUSD:t.currency==='USD'?t.amount:0,
    source:'txn'
  }));

  // Fuente B: gastos manuales
  const manualExpenses=(cycle.manualExpenses||[]).map(e=>({...e,source:'manual'}));

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
  renderCcHistory();
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
  renderCcCardTabs();
  renderCcActiveCycle();
  renderCcHistory();
}

function renderCcActiveCycle(){
  ccInit();
  const emptyEl=document.getElementById('cc-empty-state');
  const activeEl=document.getElementById('cc-active-cycle');
  if(!emptyEl||!activeEl)return;

  const cardId=state.ccActiveCard||state.ccCards[0]?.id;
  const cardCycles=[...state.ccCycles]
    .filter(c=>c.cardId===cardId)
    .sort((a,b)=>b.closeDate.localeCompare(a.closeDate));

  // Ciclo activo = el pending más reciente, o el más reciente si todos paid
  const pending=cardCycles.filter(c=>c.status==='pending');
  const activeCycle=pending.length?pending[0]:cardCycles[0]||null;

  if(!activeCycle){
    emptyEl.style.display='block';activeEl.style.display='none';return;
  }
  emptyEl.style.display='none';activeEl.style.display='block';

  const expenses=ccGetCycleExpenses(activeCycle);
  const totals=ccGetTotals(expenses);
  const catSummary=ccGetCatSummary(expenses);
  const cd=ccCountdown(activeCycle.dueDate);
  const isPaid=activeCycle.status==='paid';

  const statusBadge=isPaid
    ?'<span style="background:#00c853;color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.04em;">✓ PAGADO</span>'
    :'<span style="background:#ff9500;color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.04em;">⏳ PENDIENTE</span>';

  const countdownStyle=cd.overdue?'color:var(--danger);font-weight:700;':cd.urgent?'color:var(--accent3);font-weight:700;':'color:var(--text3);';

  const catRows=catSummary.map(r=>'<tr>'
    +'<td style="padding:6px 8px;font-size:12px;color:var(--text);">'+esc(r.cat)+'</td>'
    +'<td style="padding:6px 8px;font-size:12px;font-family:var(--font);text-align:right;color:var(--accent);">'+(r.ars>0?'$'+fmtN(Math.round(r.ars)):'—')+'</td>'
    +'<td style="padding:6px 8px;font-size:12px;font-family:var(--font);text-align:right;color:var(--accent2);">'+(r.usd>0?'U$D '+fmtN(r.usd):'—')+'</td>'
    +'</tr>'
  ).join('');

  const expRows=expenses.map(e=>{
    const removeBtn=e.source==='txn'
      ?'<button onclick="ccExcludeTxn(\''+activeCycle.id+'\',\''+e.id+'\')" title="Excluir de este ciclo" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:13px;padding:2px 6px;border-radius:4px;opacity:.5;transition:opacity .13s;" onmouseover="this.style.opacity=1;this.style.color=\'var(--danger)\'" onmouseout="this.style.opacity=.5;this.style.color=\'var(--text3)\'">✕</button>'
      :'<button onclick="ccDeleteManualExpense(\''+activeCycle.id+'\',\''+e.id+'\')" title="Eliminar gasto manual" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:13px;padding:2px 6px;border-radius:4px;opacity:.5;transition:opacity .13s;" onmouseover="this.style.opacity=1;this.style.color=\'var(--danger)\'" onmouseout="this.style.opacity=.5;this.style.color=\'var(--text3)\'">✕</button>';
    return '<tr style="border-bottom:1px solid var(--border);">'
      +'<td style="padding:8px;font-size:12px;color:var(--text3);white-space:nowrap;font-family:var(--font);">'+ccFmtDate(e.date)+'</td>'
      +'<td style="padding:8px;font-size:13px;color:var(--text);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(e.description)+'</td>'
      +'<td style="padding:8px;font-size:11px;color:var(--text3);">'+esc(e.category)+'</td>'
      +'<td style="padding:8px;font-size:13px;font-family:var(--font);text-align:right;color:var(--accent);">'+(e.amountARS>0?'$'+fmtN(Math.round(e.amountARS)):'—')+'</td>'
      +'<td style="padding:8px;font-size:13px;font-family:var(--font);text-align:right;color:var(--accent2);">'+(e.amountUSD>0?'U$D '+fmtN(e.amountUSD):'—')+'</td>'
      +'<td style="padding:8px;text-align:right;">'+removeBtn+'</td>'
    +'</tr>';
  }).join('');

  activeEl.innerHTML=`
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;">
      <!-- Header del ciclo -->
      <div style="padding:18px 20px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
          ${statusBadge}
          <div style="margin-top:8px;font-size:13px;color:var(--text3);">
            <span>Cierre: <strong style="color:var(--text);">${ccFmtDate(activeCycle.closeDate)}</strong></span>
            ${activeCycle.dueDate?`<span style="margin-left:14px;">Vencimiento: <strong style="color:var(--text);">${ccFmtDate(activeCycle.dueDate)}</strong></span>`:''}
          </div>
          ${activeCycle.dueDate&&!isPaid?`<div style="margin-top:4px;font-size:12px;${countdownStyle}">${cd.text}</div>`:''}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${!isPaid?`<button class="btn btn-ghost btn-sm" onclick="ccOpenManualExpenseModal('${activeCycle.id}')">+ Agregar gasto</button>`:''}
          ${!isPaid?`<button class="btn btn-primary btn-sm" onclick="ccMarkPaid('${activeCycle.id}')">✓ Marcar pagado</button>`:''}
        </div>
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

      <!-- Tabla de gastos -->
      <div style="padding:16px 20px;border-top:1px solid var(--border);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text3);">Gastos del ciclo</div>
        </div>
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
        `:'<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">Sin gastos en este ciclo</div>'}
      </div>
    </div>
  `;
}

function renderCcHistory(){
  ccInit();
  const cardId=state.ccActiveCard||state.ccCards[0]?.id;
  const histSection=document.getElementById('cc-history-section');
  const histList=document.getElementById('cc-history-list');
  if(!histSection||!histList)return;

  const cardCycles=[...state.ccCycles]
    .filter(c=>c.cardId===cardId)
    .sort((a,b)=>b.closeDate.localeCompare(a.closeDate));

  // Historial = todos menos el ciclo activo/pending más reciente
  const pending=cardCycles.filter(c=>c.status==='pending');
  const activeCycleId=pending.length?pending[0].id:cardCycles[0]?.id;
  const history=cardCycles.filter(c=>c.id!==activeCycleId);

  if(!history.length){histSection.style.display='none';return;}
  histSection.style.display='block';

  histList.innerHTML=history.map(cycle=>{
    const expenses=ccGetCycleExpenses(cycle);
    const totals=ccGetTotals(expenses);
    const isPaid=cycle.status==='paid';
    const statusIcon=isPaid?'<span style="color:#00c853;font-weight:700;">✓</span>':'<span style="color:#ff9500;font-weight:700;">⏳</span>';
    const detailId='cc-hist-detail-'+cycle.id;
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:8px;">'
      +'<div style="display:flex;align-items:center;gap:12px;padding:13px 16px;cursor:pointer;" onclick="ccToggleHistory(\''+detailId+'\')">'
        +statusIcon
        +'<div style="flex:1;min-width:0;">'
          +'<div style="font-size:13px;font-weight:600;color:var(--text);">Cierre '+ccFmtDate(cycle.closeDate)+'</div>'
          +'<div style="font-size:11px;color:var(--text3);font-family:var(--font);margin-top:1px;">'
            +(cycle.dueDate?'Vence '+ccFmtDate(cycle.dueDate)+' · ':'')
            +totals.count+' gastos'
          +'</div>'
        +'</div>'
        +'<div style="text-align:right;">'
          +'<div style="font-size:14px;font-weight:700;color:var(--accent);font-family:var(--font);">$'+fmtN(Math.round(totals.ars))+'</div>'
          +(totals.usd>0?'<div style="font-size:11px;color:var(--accent2);font-family:var(--font);">U$D '+fmtN(totals.usd)+'</div>':'')
        +'</div>'
        +'<span style="color:var(--text3);font-size:12px;">▸</span>'
      +'</div>'
      +'<div id="'+detailId+'" style="display:none;border-top:1px solid var(--border);padding:12px 16px;">'
        +'<table style="width:100%;border-collapse:collapse;">'
        +'<tbody>'
        +expenses.map(e=>'<tr style="border-bottom:1px solid var(--border);">'
          +'<td style="padding:6px 8px;font-size:11px;color:var(--text3);white-space:nowrap;font-family:var(--font);">'+ccFmtDate(e.date)+'</td>'
          +'<td style="padding:6px 8px;font-size:12px;color:var(--text);">'+esc(e.description)+'</td>'
          +'<td style="padding:6px 8px;font-size:11px;color:var(--text3);">'+esc(e.category)+'</td>'
          +'<td style="padding:6px 8px;font-size:12px;font-family:var(--font);text-align:right;color:var(--accent);">'+(e.amountARS>0?'$'+fmtN(Math.round(e.amountARS)):'—')+'</td>'
          +'<td style="padding:6px 8px;font-size:12px;font-family:var(--font);text-align:right;color:var(--accent2);">'+(e.amountUSD>0?'U$D '+fmtN(e.amountUSD):'—')+'</td>'
          +'</tr>'
        ).join('')
        +'</tbody></table>'
      +'</div>'
    +'</div>';
  }).join('');
}

function ccToggleHistory(detailId){
  const el=document.getElementById(detailId);if(!el)return;
  el.style.display=el.style.display==='none'?'block':'none';
}

// ── Nuevo ciclo ──
function ccOpenNewCycleModal(){
  ccInit();
  document.getElementById('modal-cc-cycle-title').textContent='Nuevo ciclo';
  document.getElementById('cc-cycle-close').value='';
  document.getElementById('cc-cycle-due').value='';
  openModal('modal-cc-cycle');
}

function ccSaveCycle(){
  ccInit();
  const closeDate=document.getElementById('cc-cycle-close').value;
  const dueDate=document.getElementById('cc-cycle-due').value;
  if(!closeDate){showToast('⚠️ Ingresá la fecha de cierre','error');return;}
  const cardId=state.ccActiveCard||state.ccCards[0]?.id;
  const id='cc_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  state.ccCycles.push({id,cardId,closeDate,dueDate:dueDate||null,status:'pending',manualExpenses:[],excludedIds:[]});
  saveState();
  closeModal('modal-cc-cycle');
  renderCreditCards();
  showToast('✓ Ciclo agregado','success');
}

// ── Marcar pagado ──
function ccMarkPaid(cycleId){
  if(!confirm('¿Marcar este ciclo como pagado?'))return;
  const cycle=state.ccCycles.find(c=>c.id===cycleId);
  if(!cycle)return;
  cycle.status='paid';
  saveState();
  renderCreditCards();
  showToast('✓ Ciclo marcado como pagado','success');
}

// ── Excluir transacción de movimientos ──
function ccExcludeTxn(cycleId, txnId){
  const cycle=state.ccCycles.find(c=>c.id===cycleId);if(!cycle)return;
  if(!cycle.excludedIds)cycle.excludedIds=[];
  if(!cycle.excludedIds.includes(txnId)) cycle.excludedIds.push(txnId);
  saveState();
  renderCcActiveCycle();
}

// ── Gasto manual ──
function ccOpenManualExpenseModal(cycleId){
  window._ccEditingCycleId=cycleId;
  const today=new Date().toISOString().slice(0,10);
  document.getElementById('cc-exp-date').value=today;
  document.getElementById('cc-exp-desc').value='';
  document.getElementById('cc-exp-ars').value='';
  document.getElementById('cc-exp-usd').value='';
  // Populate category dropdown
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
  const cycleId=window._ccEditingCycleId;
  const cycle=state.ccCycles.find(c=>c.id===cycleId);if(!cycle)return;
  const date=document.getElementById('cc-exp-date').value;
  const desc=(document.getElementById('cc-exp-desc').value||'').trim();
  const cat=document.getElementById('cc-exp-cat').value||'Sin categoría';
  const ars=parseFloat(document.getElementById('cc-exp-ars').value)||0;
  const usd=parseFloat(document.getElementById('cc-exp-usd').value)||0;
  if(!desc){showToast('⚠️ Ingresá una descripción','error');return;}
  if(!ars&&!usd){showToast('⚠️ Ingresá al menos un monto','error');return;}
  if(!cycle.manualExpenses)cycle.manualExpenses=[];
  cycle.manualExpenses.push({
    id:'mce_'+Date.now().toString(36),
    date,description:desc,category:cat,amountARS:ars,amountUSD:usd
  });
  saveState();
  closeModal('modal-cc-expense');
  renderCcActiveCycle();
  showToast('✓ Gasto agregado','success');
}

function ccDeleteManualExpense(cycleId, expId){
  const cycle=state.ccCycles.find(c=>c.id===cycleId);if(!cycle)return;
  cycle.manualExpenses=(cycle.manualExpenses||[]).filter(e=>e.id!==expId);
  saveState();
  renderCcActiveCycle();
}

// ── Alertas al cargar la app (llamado desde afterDataLoad en state.js) ──
// checkCreditCardAlerts() es invocado por el sistema de init existente
// También se registra en el window para que init.js pueda llamarlo
window.checkCreditCardAlerts = checkCreditCardAlerts;
