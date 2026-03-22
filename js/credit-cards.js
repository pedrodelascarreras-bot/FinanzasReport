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
function ccGetCycleExpenses(cycle){
  const card=state.ccCards.find(c=>c.id===cycle.cardId);
  const pmKey=card?.payMethodKey||null;

  // Rango: openDate → 1 día antes del cierre (d >= openDate && d < closeDate)
  const from=cycle.openDate||null;
  const to=cycle.closeDate; // exclusivo: d < to

  const excluded=new Set(cycle.excludedIds||[]);
  const txnExpenses=(state.transactions||[]).filter(t=>{
    if(excluded.has(t.id))return false;
    // Filtrar por tag de tarjeta si está definido
    if(pmKey && t.payMethod!==pmKey)return false;
    const d=t.date instanceof Date?t.date.toISOString().slice(0,10):String(t.date).slice(0,10);
    return(!from||d>=from)&&d<to;
  }).map(t=>({
    id:t.id,
    date:t.date instanceof Date?t.date.toISOString().slice(0,10):String(t.date).slice(0,10),
    description:t.description,
    category:t.category||'Sin categoría',
    amountARS:t.currency==='ARS'?t.amount:0,
    amountUSD:t.currency==='USD'?t.amount:0,
    source:'txn'
  }));

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
  renderCcHistory();
}

function ccSelectViewCycle(cycleId){
  const cardId=state.ccActiveCard||state.ccCards[0]?.id;
  window._ccViewCycle[cardId]=cycleId;
  renderCcActiveCycle();
}

function renderCcActiveCycle(){
  ccInit();
  const emptyEl=document.getElementById('cc-empty-state');
  const activeEl=document.getElementById('cc-active-cycle');
  if(!emptyEl||!activeEl)return;

  const cardId=state.ccActiveCard||state.ccCards[0]?.id;
  const card=state.ccCards.find(c=>c.id===cardId);
  const cardCycles=[...state.ccCycles]
    .filter(c=>c.cardId===cardId)
    .sort((a,b)=>b.closeDate.localeCompare(a.closeDate));

  if(!cardCycles.length){
    emptyEl.style.display='block';activeEl.style.display='none';return;
  }
  emptyEl.style.display='none';activeEl.style.display='block';

  // Ciclo visible: el que seleccionó el usuario, o el pending más reciente, o el más reciente
  const viewingId=window._ccViewCycle[cardId];
  const pending=cardCycles.filter(c=>c.status==='pending');
  const defaultCycle=pending.length?pending[0]:cardCycles[0];
  const activeCycle=viewingId?cardCycles.find(c=>c.id===viewingId)||defaultCycle:defaultCycle;

  const expenses=ccGetCycleExpenses(activeCycle);
  const totals=ccGetTotals(expenses);
  const catSummary=ccGetCatSummary(expenses);
  const cd=ccCountdown(activeCycle.dueDate);
  const isPaid=activeCycle.status==='paid';

  const statusBadge=isPaid
    ?'<span style="background:#00c853;color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.04em;">✓ PAGADO</span>'
    :'<span style="background:#ff9500;color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.04em;">⏳ PENDIENTE</span>';

  const countdownStyle=cd.overdue?'color:var(--danger);font-weight:700;':cd.urgent?'color:var(--accent3);font-weight:700;':'color:var(--text3);';

  // Pre-compute strings that can't be safely inline in template literals
  const dueDateHtml=activeCycle.dueDate
    ?'<span>Vencimiento: <strong style="color:var(--text);">'+ccFmtDate(activeCycle.dueDate)+'</strong></span>'
    :'';
  const openDateHtml=activeCycle.openDate
    ?'<span>Apertura: <strong style="color:var(--text);">'+ccFmtDate(activeCycle.openDate)+'</strong></span>'
    :'';
  const rangeLabelHtml=activeCycle.openDate
    ?'<div style="margin-top:4px;font-size:11px;color:var(--text3);">Gastos: '+ccFmtDate(activeCycle.openDate)+' al '+ccFmtDate(new Date(new Date(activeCycle.closeDate+'T12:00:00').getTime()-86400000).toISOString().slice(0,10))+'</div>'
    :'';
  const countdownHtml=activeCycle.dueDate&&!isPaid
    ?'<div style="margin-top:4px;font-size:12px;'+countdownStyle+'">'+cd.text+'</div>'
    :'';
  const noGastosTip=(!activeCycle.openDate&&activeCycle.closeDate)
    ?'<br><span style="font-size:11px;">Tip: agregá una fecha de apertura al ciclo para filtrar correctamente</span>'
    :'';
  const noGastosHtml='<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">Sin gastos en este ciclo'+noGastosTip+'</div>';

  // Selector de ciclo
  const cycleSelector=cardCycles.length>1
    ?'<div style="margin-top:8px;">'
      +'<select onchange="ccSelectViewCycle(this.value)" style="padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:12px;font-family:var(--font);cursor:pointer;">'
      +cardCycles.map(c=>'<option value="'+c.id+'"'+(c.id===activeCycle.id?' selected':'')+'>'+
        (c.status==='paid'?'✓ ':'⏳ ')+
        'Cierre '+ccFmtDate(c.closeDate)+(c.openDate?' (desde '+ccFmtDate(c.openDate)+')':'')
      +'</option>').join('')
      +'</select>'
      +'</div>'
    :'';

  const catRows=catSummary.map(r=>'<tr>'
    +'<td style="padding:6px 8px;font-size:12px;color:var(--text);">'+esc(r.cat)+'</td>'
    +'<td style="padding:6px 8px;font-size:12px;font-family:var(--font);text-align:right;color:var(--accent);">'+(r.ars>0?'$'+fmtN(Math.round(r.ars)):'—')+'</td>'
    +'<td style="padding:6px 8px;font-size:12px;font-family:var(--font);text-align:right;color:var(--accent2);">'+(r.usd>0?'U$D '+fmtN(r.usd):'—')+'</td>'
    +'</tr>'
  ).join('');

  const expRows=expenses.map(e=>{
    const removeBtn=e.source==='txn'
      ?'<button data-cid="'+activeCycle.id+'" data-tid="'+e.id+'" onclick="ccExcludeTxn(this.dataset.cid,this.dataset.tid)" title="Excluir de este ciclo" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:13px;padding:2px 6px;border-radius:4px;opacity:.5;transition:opacity .13s;" onmouseover="this.style.opacity=1;this.style.color=\'var(--danger)\'" onmouseout="this.style.opacity=.5;this.style.color=\'var(--text3)\'">✕</button>'
      :'<button data-cid="'+activeCycle.id+'" data-eid="'+e.id+'" onclick="ccDeleteManualExpense(this.dataset.cid,this.dataset.eid)" title="Eliminar gasto manual" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:13px;padding:2px 6px;border-radius:4px;opacity:.5;transition:opacity .13s;" onmouseover="this.style.opacity=1;this.style.color=\'var(--danger)\'" onmouseout="this.style.opacity=.5;this.style.color=\'var(--text3)\'">✕</button>';
    return '<tr style="border-bottom:1px solid var(--border);">'
      +'<td style="padding:8px;font-size:12px;color:var(--text3);white-space:nowrap;font-family:var(--font);">'+ccFmtDate(e.date)+'</td>'
      +'<td style="padding:8px;font-size:13px;color:var(--text);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(e.description)+'</td>'
      +'<td style="padding:8px;font-size:11px;color:var(--text3);">'+esc(e.category)+'</td>'
      +'<td style="padding:8px;font-size:13px;font-family:var(--font);text-align:right;color:var(--accent);">'+(e.amountARS>0?'$'+fmtN(Math.round(e.amountARS)):'—')+'</td>'
      +'<td style="padding:8px;font-size:13px;font-family:var(--font);text-align:right;color:var(--accent2);">'+(e.amountUSD>0?'U$D '+fmtN(e.amountUSD):'—')+'</td>'
      +'<td style="padding:8px;text-align:right;">'+removeBtn+'</td>'
    +'</tr>';
  }).join('');

  // Botón PAGADO: grande y verde, o acciones si pendiente
  const actionBtns=isPaid
    ?''
    :'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
      +'<button class="btn btn-ghost btn-sm" data-cid="'+activeCycle.id+'" onclick="ccOpenManualExpenseModal(this.dataset.cid)">+ Agregar gasto</button>'
      +'<button data-cid="'+activeCycle.id+'" onclick="ccMarkPaid(this.dataset.cid)" style="'
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

  activeEl.innerHTML=`
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;">
      <!-- Header del ciclo -->
      <div style="padding:18px 20px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${statusBadge}
            ${card?'<span style="font-size:11px;font-weight:700;color:'+card.color+';background:'+card.color+'15;padding:2px 8px;border-radius:6px;">'+esc(card.name)+'</span>':''}
          </div>
          <div style="margin-top:8px;font-size:13px;color:var(--text3);display:flex;flex-wrap:wrap;gap:12px;">
            ${openDateHtml}
            <span>Cierre: <strong style="color:var(--text);">${ccFmtDate(activeCycle.closeDate)}</strong></span>
            ${dueDateHtml}
          </div>
          ${rangeLabelHtml}
          ${countdownHtml}
          ${cycleSelector}
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

      <!-- Tabla de gastos -->
      <div style="padding:16px 20px;border-top:1px solid var(--border);">
        <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text3);margin-bottom:10px;">Gastos del ciclo</div>
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

  // Historial = todos los PAGADOS
  const history=cardCycles.filter(c=>c.status==='paid');

  if(!history.length){histSection.style.display='none';return;}
  histSection.style.display='block';

  histList.innerHTML=history.map(cycle=>{
    const expenses=ccGetCycleExpenses(cycle);
    const totals=ccGetTotals(expenses);
    const detailId='cc-hist-detail-'+cycle.id;
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:8px;">'
      +'<div style="display:flex;align-items:center;gap:12px;padding:13px 16px;cursor:pointer;">'
        +'<span style="color:#00c853;font-weight:700;" onclick="ccToggleHistory(\''+detailId+'\')">'+'✓</span>'
        +'<div style="flex:1;min-width:0;cursor:pointer;" onclick="ccToggleHistory(\''+detailId+'\')">'
          +'<div style="font-size:13px;font-weight:600;color:var(--text);">Cierre '+ccFmtDate(cycle.closeDate)+'</div>'
          +'<div style="font-size:11px;color:var(--text3);font-family:var(--font);margin-top:1px;">'
            +(cycle.openDate?'Apertura '+ccFmtDate(cycle.openDate)+' · ':'')
            +(cycle.dueDate?'Vence '+ccFmtDate(cycle.dueDate)+' · ':'')
            +totals.count+' gastos'
          +'</div>'
        +'</div>'
        +'<div style="text-align:right;cursor:pointer;" onclick="ccToggleHistory(\''+detailId+'\')">'
          +'<div style="font-size:14px;font-weight:700;color:var(--accent);font-family:var(--font);">$'+fmtN(Math.round(totals.ars))+'</div>'
          +(totals.usd>0?'<div style="font-size:11px;color:var(--accent2);font-family:var(--font);">U$D '+fmtN(totals.usd)+'</div>':'')
        +'</div>'
        +'<div style="display:flex;gap:4px;align-items:center;flex-shrink:0;">'
          +'<button onclick="ccEditHistCycle(\''+cycle.id+'\')" title="Editar ciclo" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;padding:4px 6px;border-radius:6px;transition:all .15s;" onmouseover="this.style.color=\'var(--accent)\';this.style.background=\'var(--surface2)\'" onmouseout="this.style.color=\'var(--text3)\';this.style.background=\'none\'">✎</button>'
          +'<button onclick="ccDeleteHistCycle(\''+cycle.id+'\')" title="Eliminar ciclo" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;padding:4px 6px;border-radius:6px;transition:all .15s;" onmouseover="this.style.color=\'var(--danger)\';this.style.background=\'var(--surface2)\'" onmouseout="this.style.color=\'var(--text3)\';this.style.background=\'none\'">🗑</button>'
          +'<span style="color:var(--text3);font-size:12px;cursor:pointer;" onclick="ccToggleHistory(\''+detailId+'\')">' + '▸</span>'
        +'</div>'
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
  window._ccEditingCycleId=null;
  document.getElementById('modal-cc-cycle-title').textContent='Nuevo ciclo';
  document.getElementById('cc-cycle-open').value='';
  document.getElementById('cc-cycle-close').value='';
  document.getElementById('cc-cycle-due').value='';
  openModal('modal-cc-cycle');
}

// ── Editar ciclo del historial ──
function ccEditHistCycle(cycleId){
  ccInit();
  const cycle=state.ccCycles.find(c=>c.id===cycleId);if(!cycle)return;
  window._ccEditingCycleId=cycleId;
  document.getElementById('modal-cc-cycle-title').textContent='Editar ciclo';
  document.getElementById('cc-cycle-open').value=cycle.openDate||'';
  document.getElementById('cc-cycle-close').value=cycle.closeDate||'';
  document.getElementById('cc-cycle-due').value=cycle.dueDate||'';
  openModal('modal-cc-cycle');
}

// ── Eliminar ciclo del historial ──
function ccDeleteHistCycle(cycleId){
  if(!confirm('¿Eliminar este ciclo del historial? Se perderán los gastos manuales asociados.'))return;
  state.ccCycles=state.ccCycles.filter(c=>c.id!==cycleId);
  saveState();
  renderCreditCards();
  showToast('Ciclo eliminado','info');
}

function ccSaveCycle(){
  ccInit();
  const openDate=document.getElementById('cc-cycle-open').value;
  const closeDate=document.getElementById('cc-cycle-close').value;
  const dueDate=document.getElementById('cc-cycle-due').value;
  if(!closeDate){showToast('⚠️ Ingresá la fecha de cierre','error');return;}
  const editId=window._ccEditingCycleId;
  if(editId){
    // Editing existing cycle
    const cycle=state.ccCycles.find(c=>c.id===editId);
    if(!cycle){showToast('⚠️ Ciclo no encontrado','error');return;}
    cycle.openDate=openDate||null;
    cycle.closeDate=closeDate;
    cycle.dueDate=dueDate||null;
    window._ccEditingCycleId=null;
    saveState();
    closeModal('modal-cc-cycle');
    renderCreditCards();
    showToast('✓ Ciclo actualizado','success');
  } else {
    // Creating new cycle
    const cardId=state.ccActiveCard||state.ccCards[0]?.id;
    const id='cc_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    state.ccCycles.push({id,cardId,openDate:openDate||null,closeDate,dueDate:dueDate||null,status:'pending',manualExpenses:[],excludedIds:[]});
    window._ccViewCycle[cardId]=id; // auto-select new cycle
    saveState();
    closeModal('modal-cc-cycle');
    renderCreditCards();
    showToast('✓ Ciclo agregado','success');
  }
}

// ── Marcar pagado ──
function ccMarkPaid(cycleId){
  if(!confirm('¿Marcar este ciclo como pagado?'))return;
  const cycle=state.ccCycles.find(c=>c.id===cycleId);
  if(!cycle)return;
  cycle.status='paid';
  const cardId=state.ccActiveCard||state.ccCards[0]?.id;
  window._ccViewCycle[cardId]=null; // volver al ciclo activo
  saveState();
  renderCreditCards();
  showToast('✓ ¡Ciclo marcado como pagado!','success');
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
    const txns=getTcCycleTxns(c, cycles);
    const total=txns.reduce((s,t)=>s+(t.currency==='USD'?t.amount*USD_TO_ARS:t.amount),0);
    return '<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);">'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="font-size:13px;font-weight:700;color:var(--text);">'+esc(c.label)+'</div>'+
        '<div style="font-size:11px;color:var(--text3);font-family:var(--font);margin-top:2px;">'+fmtD(openD)+' → '+fmtD(closeD)+'</div>'+
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
