// ══ TRANSACTIONS ══
function onSearchInput(el){
  const clearBtn=document.getElementById('search-clear-btn');
  if(clearBtn)clearBtn.classList.toggle('visible',el.value.length>0);
  renderTransactions();
}
function clearSearch(){
  const inp=document.getElementById('f-search');
  if(inp)inp.value='';
  const clearBtn=document.getElementById('search-clear-btn');
  if(clearBtn)clearBtn.classList.remove('visible');
  renderTransactions();
}

// Card filter for transactions
if(state.txnCardFilter===undefined) state.txnCardFilter='';
function setCardFilter(key){
  state.txnCardFilter=key||'';
  document.getElementById('tcf-all')?.classList.toggle('active',!key);
  document.getElementById('tcf-visa')?.classList.toggle('active',key==='visa');
  document.getElementById('tcf-amex')?.classList.toggle('active',key==='amex');
  renderTransactions();
}

window.exportTransactionsCSV = function() {
  var txns = window.currentRenderedTxns || state.transactions || [];
  if (!txns || txns.length === 0) {
    if(window.showToast) window.showToast(window.t('global_no_results'), 'warning');
    return;
  }
  
  var dateLabel = window.t('global_date');
  var descLabel = window.t('global_description');
  var catLabel = window.t('global_category');
  var amtLabel = window.t('global_amount');
  var methLabel = window.t('global_method');

  var data = txns.map(function(tx) {
    var row = {};
    row[dateLabel] = tx.date || '';
    row[descLabel] = tx.name || tx.description || '';
    row[catLabel] = tx.category || '';
    row[amtLabel] = tx.amount || 0;
    row[methLabel] = tx.payMethod || '';
    row['Moneda'] = tx.currency || 'ARS';
    row['Notas'] = tx.notes || '';
    return row;
  });
  
  var csv = '';
  if (typeof Papa !== 'undefined') {
    csv = Papa.unparse(data);
  } else {
    var headers = Object.keys(data[0]);
    csv = headers.join(',') + '\n';
    data.forEach(function(row) {
      csv += headers.map(function(h) { return '"' + String(row[h]).replace(/"/g, '""') + '"'; }).join(',') + '\n';
    });
  }
  
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', 'finanzas_movimientos_' + new Date().toISOString().slice(0,10) + '.csv');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  state.lastTransactionsExport = new Date().toISOString();
  saveState();
  if(window.showToast) window.showToast('CSV ✓', 'success');
};

// Toggle modo filtro: 'mes' | 'tc'
function setTxnFilterMode(mode){
  state.txnFilterMode=normalizeViewMode(mode||'visa');
  document.getElementById('tft-mes')?.classList.toggle('active',state.txnFilterMode==='mes');
  document.getElementById('tft-visa')?.classList.toggle('active',state.txnFilterMode==='visa');
  document.getElementById('txn-month-wrap').style.display=state.txnFilterMode==='mes'?'':'none';
  document.getElementById('txn-tc-wrap').style.display=state.txnFilterMode!=='mes'?'':'none';
  renderTransactions();
}

if(state.txnInsightsCollapsed===undefined) state.txnInsightsCollapsed=false;
if(state._txnActionMenuId===undefined) state._txnActionMenuId='';
if(state._txnAdvancedFiltersOpen===undefined) state._txnAdvancedFiltersOpen=false;

function toggleTxnInsightsPanel(){
  state.txnInsightsCollapsed=!state.txnInsightsCollapsed;
  renderTransactions();
}
function toggleTxnAdvancedFilters(){
  state._txnAdvancedFiltersOpen=!state._txnAdvancedFiltersOpen;
  renderTransactions();
}
function toggleTxnActionMenu(id){
  state._txnActionMenuId=state._txnActionMenuId===id?'':id;
  renderTransactions();
}
function txnSetSearch(val){
  const inp=document.getElementById('f-search');
  if(inp) inp.value=val||'';
  renderTransactions();
  const nativeInp=document.querySelector('.mv-search input');
  if(nativeInp){
    nativeInp.focus();
    const len=nativeInp.value.length;
    nativeInp.setSelectionRange(len,len);
  }
}
function txnSetCategoryFilter(val){
  const el=document.getElementById('f-cat');
  if(el) el.value=val||'';
  renderTransactions();
}
function txnSetCurrencyFilter(val){
  const el=document.getElementById('f-cur');
  if(el) el.value=val||'';
  renderTransactions();
}
function txnSetMonthFilter(val){
  const el=document.getElementById('f-month');
  if(el) el.value=val||'';
  renderTransactions();
}
function txnSetCycleFilter(val){
  const el=document.getElementById('f-tc-cycle');
  if(el) el.value=val||'';
  renderTransactions();
}
function txnQuickFilter(key){
  const curEl=document.getElementById('f-cur');
  const catEl=document.getElementById('f-cat');
  if(curEl && key==='ars-usd') curEl.value='';
  if(curEl && key==='usd') curEl.value='USD';
  if(curEl && key==='ars') curEl.value='ARS';
  if(catEl && key==='sin-cat') catEl.value='';
  state.txnQuickFilter=key;
  renderTransactions();
}
function txnSetMode(mode){
  setTxnFilterMode(mode);
}
function txnSetCardChip(val){
  setCardFilter(val||'');
}
function txnSetEstadoChip(val){
  setEstadoFilter(val||'all');
}
function txnShowCategoryDetails(){
  state._txnAdvancedFiltersOpen=true;
  renderTransactions();
}

function txnDateKey(d){
  return dateToYMD(d instanceof Date?d:new Date(d));
}
function txnAmountArs(tx){
  if((tx.currency||'ARS')==='USD') return (Number(tx.amount)||0) * (window.USD_TO_ARS||1);
  return Number(tx.amount)||0;
}
function txnAmountLabel(tx){
  return (tx.currency==='USD'?'USD ':'$')+fmtN(Number(tx.amount)||0);
}
function txnEquivalentLabel(tx){
  if((tx.currency||'ARS')!=='USD') return '';
  return '($'+fmtN(Math.round(txnAmountArs(tx)))+')';
}
function txnMerchantName(tx){
  const isGmailTxn = (typeof isGmailSourceTransaction === 'function')
    ? isGmailSourceTransaction(tx)
    : (tx.source === 'gmail' || tx.origen_del_movimiento === 'importado_desde_gmail' || !!tx.gmailId);
  if(isGmailTxn) return tx.description || tx.gmailMerchantRaw || tx._baseDesc || tx.comercio_detectado || 'Movimiento';
  return tx.comercio_detectado || tx._baseDesc || tx.description || 'Movimiento';
}
function txnCategoryName(tx){
  return tx.category && tx.category!=='Procesando...' && tx.category!=='Uncategorized' ? tx.category : 'Sin categoría';
}
function txnNoteText(tx){
  return tx.notes || tx.note || tx.thirdPartyNote || '';
}
function txnExtractTimeToken(value){
  const m = String(value || '').match(/(?:^|\s)([01]\d|2[0-3]):([0-5]\d)(?:\s|$)/);
  return m ? (m[1] + ':' + m[2]) : '';
}
function txnTimeLabel(tx){
  const asHHMM = d => {
    if(!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  };
  const fromField = txnExtractTimeToken(tx.txnTime || tx.hora || '');
  if(fromField) return fromField;

  const isGmailTxn = (tx.source === 'gmail') || (tx.origen_del_movimiento === 'importado_desde_gmail') || !!tx.gmailId;
  if(isGmailTxn){
    const fromDesc = txnExtractTimeToken(tx.description || '');
    if(fromDesc) return fromDesc;
    if(tx.gmailDateHeader){
      const h = asHHMM(new Date(tx.gmailDateHeader));
      if(h) return h;
    }
    const fromDate = asHHMM(tx.date instanceof Date ? tx.date : new Date(tx.date));
    if(fromDate && fromDate !== '00:00') return fromDate;
    return '00:00';
  }

  // Manual / pasted / CSV without reliable time metadata.
  return '00:00';
}
function txnRelativeTimeLabel(iso){
  if(!iso) return '';
  const d=txnParseMetaDate(iso);
  if(Number.isNaN(d.getTime())) return '';
  const diffMin=Math.round((Date.now()-d.getTime())/60000);
  if(diffMin<1) return 'hace instantes';
  if(diffMin<60) return 'hace '+diffMin+' min';
  const diffHours=Math.round(diffMin/60);
  if(diffHours<24) return 'hace '+diffHours+' h';
  const diffDays=Math.round(diffHours/24);
  return diffDays===1?'ayer':'hace '+diffDays+' días';
}
function txnParseMetaDate(value){
  if(value instanceof Date) return value;
  if(typeof value==='string'){
    const localMatch=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*)?$/);
    if(localMatch){
      return new Date(Number(localMatch[3]), Number(localMatch[2])-1, Number(localMatch[1]), 12, 0, 0, 0);
    }
  }
  return new Date(value);
}
function txnSyncLabel(){
  const items=txnSyncMetadata();
  return items[0] ? (items[0].label+': '+items[0].relative) : 'Última actualización: sin registros recientes';
}
function txnAbsoluteTimeLabel(iso){
  if(!iso) return 'Sin registros';
  const d=txnParseMetaDate(iso);
  if(Number.isNaN(d.getTime())) return 'Sin registros';
  return d.toLocaleDateString('es-AR',{day:'2-digit',month:'short'})+' · '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',hour12:false});
}
function txnSyncMetadata(){
  const items=[];
  if(state.lastGmailSync){
    items.push({key:'gmail',label:'Última sincronización con Gmail',relative:txnRelativeTimeLabel(state.lastGmailSync),absolute:txnAbsoluteTimeLabel(state.lastGmailSync),raw:state.lastGmailSync});
  }
  const lastImport=(state.imports||[])[0];
  if(lastImport){
    const rawDate=lastImport.createdAt||lastImport.date||lastImport.importedAt||lastImport.updatedAt||null;
    if(rawDate) items.push({key:'import',label:'Última importación',relative:txnRelativeTimeLabel(rawDate),absolute:txnAbsoluteTimeLabel(rawDate),raw:rawDate});
  }
  if(state.lastTransactionsExport){
    items.push({key:'export',label:'Última exportación CSV',relative:txnRelativeTimeLabel(state.lastTransactionsExport),absolute:txnAbsoluteTimeLabel(state.lastTransactionsExport),raw:state.lastTransactionsExport});
  }
  if(state.lastTransactionsRefresh){
    items.push({key:'refresh',label:'Última actualización visual',relative:txnRelativeTimeLabel(state.lastTransactionsRefresh),absolute:txnAbsoluteTimeLabel(state.lastTransactionsRefresh),raw:state.lastTransactionsRefresh});
  }
  return items;
}
function txnMerchantLogoData(tx){
  const presets=(typeof getBrandLogoPresets==='function' ? getBrandLogoPresets() : null) || {};
  const fromRule = tx.logoKey && presets[tx.logoKey] ? presets[tx.logoKey] : null;
  if(fromRule){
    return { bg:fromRule.bg, text:fromRule.text, label:fromRule.label, kind:'text' };
  }
  const merchant=txnMerchantName(tx).toLowerCase();
  const logoMap=[
    {match:['mcdonald'], bg:'#DA1E2A', text:'#FFC928', label:'M', kind:'text'},
    {match:['pedidosya','pedido ya'], bg:'#EF4354', text:'#FFFFFF', label:'P', kind:'text'},
    {match:['rappi'], bg:'#20BFA9', text:'#FFFFFF', label:'R', kind:'text'},
    {match:['mercadopago','merpago'], bg:'#009EE3', text:'#FFFFFF', label:'MP', kind:'text'},
    {match:['ypf'], bg:'#1F64D8', text:'#FFFFFF', label:'YPF', kind:'text'},
    {match:['netflix'], bg:'#F5F5F8', text:'#E30C18', label:'N', kind:'text'},
    {match:['starbucks'], bg:'#0B7A52', text:'#FFFFFF', label:'S', kind:'text'},
  ];
  return logoMap.find(item=>item.match.some(m=>merchant.includes(m))) || null;
}
function txnCategoryGlyph(cat){
  const key=(cat||'').toLowerCase();
  if(key.includes('restaur')) return '🍽';
  if(key.includes('delivery')) return '🛵';
  if(key.includes('transporte')) return '🚕';
  if(key.includes('caf')) return '☕';
  if(key.includes('super')) return '🛒';
  if(key.includes('entreten')) return '▶';
  if(key.includes('kiosco')) return '🏪';
  return '•';
}
function txnMerchantAvatar(tx){
  const customLogo=tx.customLogoUrl||tx.logoUrl||tx.merchantLogoUrl||'';
  const namedLogo=txnMerchantLogoData(tx);
  if(customLogo){
    return '<span class="mv-avatar mv-avatar-img"><img src="'+esc(customLogo)+'" alt=""></span>';
  }
  if(namedLogo){
    return '<span class="mv-avatar" style="background:'+namedLogo.bg+';color:'+namedLogo.text+';">'+esc(namedLogo.label)+'</span>';
  }
  const cat=txnCategoryName(tx);
  if(cat && cat!=='Sin categoría'){
    return '<span class="mv-avatar mv-avatar-cat" style="color:'+catColor(cat)+';">'+txnCategoryGlyph(cat)+'</span>';
  }
  const name=txnMerchantName(tx).trim();
  const initials=name.split(/\s+/).slice(0,2).map(p=>p[0]||'').join('').toUpperCase() || 'M';
  return '<span class="mv-avatar mv-avatar-fallback">'+esc(initials.slice(0,3))+'</span>';
}
function txnFormatDayHeader(dateObj){
  const DAYS=['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'];
  const MONTHS=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  return DAYS[dateObj.getDay()]+' '+dateObj.getDate()+' '+MONTHS[dateObj.getMonth()];
}
function txnCategoryBreakdown(txns){
  const map={};
  txns.forEach(tx=>{
    const cat=txnCategoryName(tx);
    map[cat]=(map[cat]||0)+Math.abs(txnAmountArs(tx));
  });
  const total=Object.values(map).reduce((s,v)=>s+v,0)||1;
  return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([label,amount])=>({label,amount,pct:Math.round((amount/total)*100)}));
}

function deleteTxn(id){
  const t=state.transactions.find(x=>x.id===id);
  if(!t)return;
  const label=t.description.length>50?t.description.slice(0,50)+'…':t.description;
  // Show inline confirm toast instead of browser confirm()
  showDeleteConfirm(id, label, t.amount, t.currency, t.date);
}
function confirmDeleteTxn(id){
  state.transactions=state.transactions.filter(t=>t.id!==id);
  state.imports.forEach(imp=>{if(imp.txnIds)imp.txnIds=imp.txnIds.filter(x=>x!==id);});
  saveState();
  renderTransactions();
  renderDashboard();
  showToast('Gasto eliminado');
}
function showDeleteConfirm(id, label, amount, currency, date){
  // Remove any existing confirm bar
  const existing=document.getElementById('del-confirm-bar');
  if(existing)existing.remove();
  const bar=document.createElement('div');
  bar.id='del-confirm-bar';
  bar.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--danger);border-radius:12px;padding:14px 20px;display:flex;align-items:center;gap:14px;z-index:9999;box-shadow:0 4px 24px rgba(0,0,0,.3);max-width:480px;width:90%;font-family:var(--font);';
  const sym=currency==='USD'?'U$D ':'$';
  bar.innerHTML='<div style="flex:1;font-size:13px;"><div style="color:var(--text3);font-size:11px;margin-bottom:3px;">¿Eliminar gasto?</div><div style="color:var(--text);font-weight:600;">'+esc(label)+'</div><div style="color:var(--danger);font-size:12px;">'+sym+fmtN(amount)+' · '+fmtDate(date)+'</div></div>'
    +'<button id="del-confirm-yes" style="background:var(--danger);color:#fff;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-weight:700;font-size:13px;">Eliminar</button>'
    +'<button id="del-confirm-no" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px 14px;cursor:pointer;font-size:13px;">Cancelar</button>';
  bar.querySelector('#del-confirm-yes').onclick=function(){confirmDeleteTxn(id);};
  bar.querySelector('#del-confirm-no').onclick=function(){bar.remove();};
  document.body.appendChild(bar);
  // Auto-dismiss after 6s
  setTimeout(()=>{const b=document.getElementById('del-confirm-bar');if(b)b.remove();},6000);
}

function getTxnCycleCommitmentsTab(){
  return localStorage.getItem('fin_txn_cycle_commitments_tab') || 'all';
}

function setTxnCycleCommitmentsTab(tab){
  localStorage.setItem('fin_txn_cycle_commitments_tab', tab || 'all');
  renderTransactions();
}

function getTxnCycleCommitmentEntry(key){
  return (window._txnCycleCommitmentsByKey||{})[key] || null;
}

function dismissTxnCycleCommitmentEntry(key){
  if(!key) return;
  if(!state.dismissedCommitmentEntries) state.dismissedCommitmentEntries=[];
  if(!state.dismissedCommitmentEntries.includes(key)) state.dismissedCommitmentEntries.push(key);
  saveState();
  refreshAll();
  showToast('Compromiso ocultado de este período','success');
}

function editTxnCycleCommitment(key){
  const entry=getTxnCycleCommitmentEntry(key);
  if(!entry) return;
  if(entry.sourceTxnId){
    openEditTxnModal(entry.sourceTxnId);
    return;
  }
  if(entry.group==='suscripciones' && entry.sourceSubscriptionId){
    editSub(entry.sourceSubscriptionId);
    return;
  }
  if(entry.group==='cuotas' && entry.sourceManualCuotaId){
    editCuota(entry.sourceManualCuotaId);
    return;
  }
  if(entry.group==='cuotas' && entry.sourceAutoCuotaKey){
    openAutoCuotaModal(entry.sourceAutoCuotaKey);
    return;
  }
  showToast('No encontramos un editor para este compromiso','info');
}

function deleteTxnCycleCommitment(key){
  const entry=getTxnCycleCommitmentEntry(key);
  if(!entry) return;
  if(entry.sourceTxnId){
    deleteTxn(entry.sourceTxnId);
    return;
  }
  dismissTxnCycleCommitmentEntry(key);
}

function addTxnCycleCommitment(kind){
  if(kind==='suscripciones'){
    openNewSubModal();
    return;
  }
  if(kind==='cuotas'){
    openNewCuotaModal();
    return;
  }
  openNewExpenseModal();
}

function renderTxnCycleCommitmentsPanel(wrap, entries){
  const oldPanel=document.getElementById('txn-cycle-commitments');
  if(oldPanel) oldPanel.remove();
  if(!wrap || !entries.length) return;
  window._txnCycleCommitmentsByKey=entries.reduce((acc,entry)=>{
    if(entry?._key) acc[entry._key]=entry;
    return acc;
  },{});

  const groupTabs=[
    {key:'all', label:'Todo'},
    ...(entries.some(e=>e.group==='cuotas') ? [{key:'cuotas', label:'Cuotas'}] : []),
    ...(entries.some(e=>e.group==='suscripciones') ? [{key:'suscripciones', label:'Suscripciones'}] : []),
    ...(entries.some(e=>e.group==='fijos') ? [{key:'fijos', label:'Fijos'}] : []),
    ...(entries.some(e=>e.group==='terceros') ? [{key:'terceros', label:'Terceros'}] : [])
  ];
  const activeTab=getTxnCycleCommitmentsTab();
  const tabs=groupTabs;
  const counts=tabs.reduce((acc,tab)=>{
    acc[tab.key]=tab.key==='all'?entries.length:entries.filter(e=>e.group===tab.key).length;
    return acc;
  },{});
  const effectiveTab=tabs.some(tab=>tab.key===activeTab)?activeTab:'all';
  const visible=effectiveTab==='all'?entries:entries.filter(e=>e.group===effectiveTab);
  const panel=document.createElement('div');
  panel.id='txn-cycle-commitments';
  panel.className='txn-cycle-panel';
  panel.innerHTML=
    '<div class="txn-cycle-panel-head">'
      +'<div>'
        +'<div class="txn-cycle-panel-kicker">Cuotas y compromisos del ciclo</div>'
        +'<div class="txn-cycle-panel-sub">Acá ves lo que cae dentro del ciclo actual aunque el banco no mande un mail nuevo todos los meses.</div>'
      +'</div>'
      +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;">'
        +'<button class="txn-cycle-tab" onclick="addTxnCycleCommitment(\'suscripciones\')">+ Suscripción</button>'
        +'<button class="txn-cycle-tab" onclick="addTxnCycleCommitment(\'cuotas\')">+ Cuota</button>'
        +`<div class="txn-cycle-panel-count">${entries.length} item${entries.length!==1?'s':''}</div>`
      +'</div>'
    +'</div>'
    +'<div class="txn-cycle-tabs">'
      +tabs.map(tab=>`<button class="txn-cycle-tab ${effectiveTab===tab.key?'active':''}" onclick="setTxnCycleCommitmentsTab('${tab.key}')">${tab.label} <span>${counts[tab.key]||0}</span></button>`).join('')
    +'</div>'
    +(
      visible.length
        ? (()=>{
            const GROUP_META={cuotas:{label:'Cuota',bg:'#7c3aed18',color:'#7c3aed'},suscripciones:{label:'Suscripción',bg:'#0ea5e918',color:'#0ea5e9'},terceros:{label:'Tercero',bg:'#d9770618',color:'#d97706'},fijos:{label:'Fijo',bg:'#10b98118',color:'#10b981'}};
            const list='<div class="txn-cycle-list">'+visible.map(item=>{
              const amount=(item.currency==='USD'?'U$D ':'$')+fmtN(item.amount);
              const settled=item.isSettled===true || item.includeInTotal===true;
              const gm=effectiveTab==='all'?GROUP_META[item.group]:null;
              const badge=gm?`<span style="font-size:9px;font-weight:700;letter-spacing:.04em;padding:1px 6px;border-radius:4px;background:${gm.bg};color:${gm.color};text-transform:uppercase;flex-shrink:0;">${gm.label}</span>`:'';
              return '<div class="txn-cycle-entry">'
                +`<div class="txn-cycle-avatar" style="--entry-tone:${item.tone};"><span></span></div>`
                +`<div class="txn-cycle-date">${fmtDate(item.date)}</div>`
                +'<div class="txn-cycle-copy">'
                  +`<div class="txn-cycle-title">${esc(item.title)}${badge}</div>`
                  +`<div class="txn-cycle-meta">${esc(item.kind)} · ${esc(item.meta)} · ${settled?'Cobrado':'Pendiente'}</div>`
                +'</div>'
                +`<div class="txn-cycle-status ${settled?'is-settled':'is-pending'}">${settled?'Cobrado':'Pendiente'}</div>`
                +'<div style="display:flex;align-items:center;gap:10px;justify-content:flex-end;">'
                  +`<div class="txn-cycle-amount" style="color:${item.tone};">${amount}</div>`
                  +'<div style="display:flex;align-items:center;gap:6px;">'
                    +`<button class="calendar-item-link" onclick="event.stopPropagation();editTxnCycleCommitment('${item._key}')">Editar</button>`
                    +`<button class="calendar-item-delete" onclick="event.stopPropagation();deleteTxnCycleCommitment('${item._key}')">Borrar</button>`
                  +'</div>'
                +'</div>'
              +'</div>';
            }).join('')+'</div>';
            const isARS=e=>(e.currency||'ARS')!=='USD';
            const isCob=e=>e.isSettled===true||e.includeInTotal===true;
            const totARS=visible.filter(isARS).reduce((s,e)=>s+Number(e.amount||0),0);
            const totUSD=visible.filter(e=>!isARS(e)).reduce((s,e)=>s+Number(e.amount||0),0);
            const cobARS=visible.filter(e=>isARS(e)&&isCob(e)).reduce((s,e)=>s+Number(e.amount||0),0);
            const pendARS=visible.filter(e=>isARS(e)&&!isCob(e)).reduce((s,e)=>s+Number(e.amount||0),0);
            const cobUSD=visible.filter(e=>!isARS(e)&&isCob(e)).reduce((s,e)=>s+Number(e.amount||0),0);
            const pendUSD=visible.filter(e=>!isARS(e)&&!isCob(e)).reduce((s,e)=>s+Number(e.amount||0),0);
            const hasUSD=totUSD>0;
            const mainTotal=totARS>0?'$'+fmtN(totARS):(hasUSD?'U$D '+fmtN(totUSD):'—');
            const footer='<div class="txn-cycle-footer">'
              +'<div class="txn-cycle-footer-main">'
                +'<span class="txn-cycle-footer-label">Total del ciclo</span>'
                +`<span class="txn-cycle-footer-total">${mainTotal}</span>`
              +'</div>'
              +'<div class="txn-cycle-footer-breakdown">'
                +(cobARS>0?`<span class="txn-cycle-footer-item" style="color:#34c759;">✓ Cobrado $${fmtN(cobARS)}</span>`:'')
                +(pendARS>0?`<span class="txn-cycle-footer-item" style="color:#ff9500;">⏳ Pendiente $${fmtN(pendARS)}</span>`:'')
                +(cobUSD>0?`<span class="txn-cycle-footer-item" style="color:#34c759;">✓ Cobrado U$D ${fmtN(cobUSD)}</span>`:'')
                +(pendUSD>0?`<span class="txn-cycle-footer-item" style="color:#ff9500;">⏳ Pendiente U$D ${fmtN(pendUSD)}</span>`:'')
                +(totARS>0&&hasUSD?`<span class="txn-cycle-footer-item" style="color:var(--text3);">+ U$D ${fmtN(totUSD)}</span>`:'')
              +'</div>'
            +'</div>';
            return list+footer;
          })()
        : '<div class="txn-cycle-empty">No hay elementos para esta vista dentro del ciclo actual.</div>'
    );
  wrap.appendChild(panel);
}

function getTxnCycleCommitmentEntries(mode, activeCycleMeta, searchVal, txns, todayRef){
  if(!(mode!=='mes' && activeCycleMeta && !searchVal)) return [];
  const entries=getProjectedCommitmentEntriesForRange({
    startStr:activeCycleMeta.openStr,
    endStr:activeCycleMeta.closeStr,
    todayRef,
    txns:state.transactions||[]
  }).map(entry=>({...entry,_key:entry._key||`${entry.kind}-${entry.group}-${dateToYMD(entry.date)}-${entry.title}`}));
  const seenKeys=new Set(entries.map(entry=>entry._key));

  txns.filter(t=>!t.isPendingSubscription).forEach(t=>{
    const sub=(state.subscriptions||[]).find(s=>typeof txnMatchesSubscription==='function' && txnMatchesSubscription(t,s));
    if(!sub) return;
    const key=`sub-real-${t.id}`;
    if(seenKeys.has(key)) return;
    seenKeys.add(key);
    entries.push({
      _key:key,
      date:t.date,
      title:sub.name||t.subscriptionName||t._baseDesc||t.description,
      amount:t.amount,
      currency:t.currency||sub.currency||'ARS',
      sourceTxnId:t.id,
      sourceSubscriptionId:sub.id,
      group:'suscripciones',
      kind:'Suscripción registrada',
      meta:'Cobro ya recibido',
      includeInTotal:true,
      synthetic:false,
      isSettled:true,
      tone:'#34c759'
    });
  });

  txns.filter(t=>t.isThirdParty).forEach(t=>{
    const status=t.thirdPartyStatus||'pending';
    const recoverBase=Number(t.thirdPartyAmount)||Number(t.amount)||0;
    const settledBase=Math.min(recoverBase, Number(t.thirdPartySettledAmount)||0);
    const pendingBase=Math.max(0, recoverBase-settledBase);
    const isSettled=status==='settled';
    const isPartial=status==='partial';
    let meta='Pendiente de cobro';
    if(isSettled) meta='Cobrado';
    else if(isPartial) meta=`Cobro parcial · faltan ${(t.currency||'ARS')==='USD'?'U$D ':'$'}${fmtN(pendingBase)}`;
    const key=`third-party-${t.id}`;
    if(seenKeys.has(key)) return;
    seenKeys.add(key);
    entries.push({
      _key:key,
      date:t.date,
      title:t.thirdPartyNote||t._baseDesc||t.description,
      amount:recoverBase,
      currency:t.currency||'ARS',
      sourceTxnId:t.id,
      group:'terceros',
      kind:'Gasto de terceros',
      meta,
      includeInTotal:false,
      isSettled:isSettled,
      synthetic:false,
      tone:isSettled?'#34c759':'#ff9500'
    });
  });

  entries.sort((a,b)=>new Date(a.date)-new Date(b.date));
  return entries;
}

function getTxnDisplaySummaryTotals(opts){
  const mode=opts?.mode||'mes';
  const activeCycleMeta=opts?.activeCycleMeta||null;
  const searchVal=opts?.searchVal||'';
  const txns=Array.isArray(opts?.txns)?opts.txns:[];
  const summaryTxns=Array.isArray(opts?.summaryTxns)?opts.summaryTxns:[];
  const todayRef=opts?.todayRef instanceof Date?opts.todayRef:new Date();
  const hasCategoryFilter=!!opts?.hasCategoryFilter;
  const hasCurrencyFilter=!!opts?.hasCurrencyFilter;
  const hasCardFilter=!!opts?.hasCardFilter;
  const estadoFilter=opts?.estadoFilter||'all';

  let arsTotal=summaryTxns.filter(t=>(t.currency||'ARS')==='ARS').reduce((s,t)=>s+(Number(t.amount)||0),0);
  let usdTotal=summaryTxns.filter(t=>(t.currency||'ARS')==='USD').reduce((s,t)=>s+(Number(t.amount)||0),0);

  const canUseProjectedTotals=
    !searchVal &&
    !hasCategoryFilter &&
    !hasCurrencyFilter &&
    estadoFilter==='all';

  if(canUseProjectedTotals && mode!=='mes' && activeCycleMeta){
    const isNonCC=t=>t.payMethod==='deb'||t.payMethod==='ef';
    const billableActualTxns=txns.filter(t=>
      !t.isPendingCuota &&
      !t.isPendingSubscription &&
      !isNonCC(t)
    );
    arsTotal=billableActualTxns.filter(t=>(t.currency||'ARS')!=='USD').reduce((s,t)=>s+(Number(t.amount)||0),0);
    usdTotal=billableActualTxns.filter(t=>(t.currency||'ARS')==='USD').reduce((s,t)=>s+(Number(t.amount)||0),0);
  }

  if(canUseProjectedTotals){
    let range=null;
    if(mode!=='mes' && activeCycleMeta){
      range={startStr:activeCycleMeta.openStr,endStr:activeCycleMeta.closeStr};
    } else if(mode==='mes' && opts?.monthKey){
      const [year,month]=String(opts.monthKey).split('-').map(Number);
      const lastDay=new Date(year,month,0).getDate();
      range={
        startStr:`${year}-${String(month).padStart(2,'0')}-01`,
        endStr:`${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
      };
    }
    if(range){
      const projectedEntries=getProjectedCommitmentEntriesForRange({
        ...range,
        todayRef,
        txns:state.transactions||[]
      }).filter(entry=>{
        if(!(entry.synthetic || entry.kind==='Cuota proyectada' || entry.kind==='Suscripción proyectada')) return false;
        if(!entry.includeInTotal) return false;
        if(hasCardFilter && entry.payMethod && entry.payMethod!==state.txnCardFilter) return false;
        if(hasCardFilter && !entry.payMethod && entry.synthetic){
          const ownerId=state.ccActiveCard||(state.ccCards||[]).find(c=>c.payMethodKey==='visa')?.id||(state.ccCards||[])[0]?.id||null;
          const ownerKey=(state.ccCards||[]).find(c=>c.id===ownerId)?.payMethodKey||'visa';
          if(state.txnCardFilter!==ownerKey) return false;
        }
        return true;
      });
      const projectedTotals=sumProjectedCommitmentTotals(projectedEntries);
      arsTotal+=projectedTotals.ars;
      usdTotal+=projectedTotals.usd;
    }
  }

  return {
    ars:arsTotal,
    usd:usdTotal,
    grand:arsTotal+(usdTotal*(window.USD_TO_ARS||USD_TO_ARS||1))
  };
}

// ── Duplicate filter in transactions list ──
state._dupFilterOn = state._dupFilterOn || false;
// toggleDupFilter removed — legacy, f-dup-toggle element no longer exists

function txnDupKey(t){
  const d=t.date instanceof Date?t.date.toISOString().slice(0,10):String(t.date).slice(0,10);
  return String(t.amount)+'|'+t.currency+'|'+d;
}

function getDuplicateAmountKeys(){
  // Returns a Set of "amount|currency|date" keys that appear 2+ times
  var counts={};
  state.transactions.forEach(function(t){
    if(t.notDuplicate) return; // user confirmed not a duplicate
    var k=txnDupKey(t);
    counts[k]=(counts[k]||0)+1;
  });
  var dupKeys=new Set();
  Object.keys(counts).forEach(function(k){ if(counts[k]>1) dupKeys.add(k); });
  return dupKeys;
}

if(!window._dupGroups) window._dupGroups=[];

function resolveDupInline(groupIdx, action){
  const ids=window._dupGroups[groupIdx];
  if(!ids||!ids.length)return;
  if(action==='delete'){
    const toDelete=new Set(ids.slice(1)); // keep first, delete rest
    state.transactions=state.transactions.filter(t=>!toDelete.has(t.id));
    showToast('🗑 Duplicado eliminado','success');
  } else {
    ids.forEach(id=>{const t=state.transactions.find(x=>x.id===id);if(t)t.notDuplicate=true;});
    showToast('✓ Marcados como gastos distintos','success');
  }
  saveState();renderTransactions();renderDashboard();
}

function renderTransactions(){
  state.lastTransactionsRefresh = new Date().toISOString();
  const mode=normalizeViewMode(state.txnFilterMode||'visa');
  state.txnFilterMode=mode;
  let activeCycleMeta=null;
  const todayRef=new Date();
  todayRef.setHours(23,59,59,999);
  // ── Poblar selects ──
  const range=typeof getViewWindowRange==='function'
    ? getViewWindowRange()
    : {currentMonthKey:getMonthKey(new Date()), startMonthKey:getMonthKey(new Date(new Date().getFullYear(),new Date().getMonth()-6,1))};
  const months=[...new Set(state.transactions.map(t=>t.month||getMonthKey(t.date)))]
    .filter(m=>m>=range.startMonthKey&&m<=range.currentMonthKey)
    .sort()
    .reverse();
  const MNAMES=[t('month_1'),t('month_2'),t('month_3'),t('month_4'),t('month_5'),t('month_6'),t('month_7'),t('month_8'),t('month_9'),t('month_10'),t('month_11'),t('month_12')];
  const mf=document.getElementById('f-month');
  const activeMesKey = getActiveDashMonth();
  if(mf){
    const rawMv=mf.value||activeMesKey;
    const mv=(rawMv>=range.startMonthKey&&rawMv<=range.currentMonthKey)?rawMv:range.currentMonthKey;
    mf.innerHTML='<option value="">'+t('global_all_months')+'</option>'+months.map(m=>{
      const[y,mo]=m.split('-');
      return'<option value="'+m+'" '+(m===mv?'selected':'')+'>'+MNAMES[+mo-1]+' '+y+'</option>';
    }).join('');
    if(!mf.value || mf.value<range.startMonthKey || mf.value>range.currentMonthKey) mf.value=mv;
  }
  const tcf=document.getElementById('f-tc-cycle');const tcv=tcf?.value||'';
  if(tcf){
    const cycles=getTcCycles(mode);
    if(cycles.length){
      const pickerLabel=getViewModeLabel(mode);
      tcf.innerHTML='<option value="">'+esc(pickerLabel+' actual')+'</option>'+cycles.map(c=>'<option value="'+c.id+'" '+(c.id===tcv?'selected':'')+'>'+esc(c.label)+'</option>').join('');
    } else { tcf.innerHTML='<option value="">Sin ciclos</option>'; }
  }
  const cats=[...new Set(state.transactions.map(t=>t.category))].filter(c=>c&&c!=='Procesando...'&&c!=='Uncategorized').sort();
  const cf=document.getElementById('f-cat');const cv=cf?.value||'';
  if(cf){
    let fHtml='<option value="">'+t('global_all_categories')+'</option>';
    // Group filter options
    const usedGroups=[...new Set(cats.map(c=>catGroup(c)))];
    CATEGORY_GROUPS.forEach(g=>{
      const groupCats=cats.filter(c=>catGroup(c)===g.group);
      if(!groupCats.length)return;
      fHtml+='<optgroup label="'+g.emoji+' '+g.group+'">';
      // Add group-level filter
      fHtml+='<option value="__group__'+g.group+'" '+(cv==='__group__'+g.group?'selected':'')+'>── Todo '+g.group+'</option>';
      groupCats.forEach(c=>{
        fHtml+='<option value="'+c+'" '+(c===cv?'selected':'')+'>'+c+'</option>';
      });
      fHtml+='</optgroup>';
    });
    // Uncategorized cats not in any group
    const ungrouped=cats.filter(c=>!CATEGORY_GROUPS.find(g=>g.group===catGroup(c)));
    if(ungrouped.length){
      ungrouped.forEach(c=>{fHtml+='<option value="'+c+'" '+(c===cv?'selected':'')+'>'+c+'</option>';});
    }
    cf.innerHTML=fHtml;
  }

  // ── Filtrar ──
  let txns=[...state.transactions];
  const searchVal=(document.getElementById('f-search')?.value||'').toLowerCase().trim();
  const cfv=cf?.value||'';
  const cufv=document.getElementById('f-cur')?.value||'';
  let periodoLabel='';

  // When searching, skip period filter to search across ALL transactions
  const _isSearching=searchVal.length>=1;
  if(_isSearching){
    periodoLabel='🔍 Búsqueda en todos los períodos';
  } else if(state._dupFilterOn){
    periodoLabel='Todos (duplicados)';
  } else if(mode==='mes'){
    const mfvRaw=mf?.value||activeMesKey;
    const mfv=(mfvRaw>=range.startMonthKey&&mfvRaw<=range.currentMonthKey)?mfvRaw:range.currentMonthKey;
    if(mfv){
      txns=txns.filter(t=>(t.month||getMonthKey(t.date))===mfv);
      const[y,mo]=mfv.split('-');periodoLabel=MNAMES[+mo-1]+' '+y;
    } else { periodoLabel=t('global_all_months'); }
  } else {
    const selCycleId=tcf?.value||'';
    const allCycles=getTcCycles(mode);
    let activeCycle=selCycleId?allCycles.find(c=>c.id===selCycleId):null;
    if(!activeCycle&&allCycles.length){
      const todayStr=dateToYMD(new Date());
      const currentCycle=allCycles.find(c=>{const i2=allCycles.findIndex(x=>x.id===c.id);const op=getTcCycleOpen(allCycles,i2);return op&&todayStr>=op&&todayStr<=c.closeDate;})||null;
      const latestPast=allCycles.find(c=>{const i2=allCycles.findIndex(x=>x.id===c.id);const op=getTcCycleOpen(allCycles,i2);return op&&op<=todayStr;})||null;
      activeCycle=currentCycle||latestPast||allCycles[allCycles.length-1]||allCycles[0];
    }
    if(activeCycle){
      const i2=allCycles.findIndex(c=>c.id===activeCycle.id);
      const openStr=getTcCycleOpen(allCycles,i2);
      activeCycleMeta={cycle:activeCycle,openStr,closeStr:activeCycle.closeDate};
      txns=txns.filter(t=>{const d=dateToYMD(t.date);return d>=openStr&&d<=activeCycle.closeDate;});
      const openD=new Date(openStr+'T12:00:00');const closeD=new Date(activeCycle.closeDate+'T12:00:00');
      periodoLabel=getViewModeLabel(mode)+' · '+activeCycle.label+' ('+openD.toLocaleDateString('es-AR',{day:'2-digit',month:'short'})+' → '+closeD.toLocaleDateString('es-AR',{day:'2-digit',month:'short'})+')';
    }
  }

  if(cfv)txns=txns.filter(t=>t.category===cfv);
  if(cufv)txns=txns.filter(t=>t.currency===cufv);
  const cardFv=state.txnCardFilter||'';
  if(cardFv)txns=txns.filter(t=>t.payMethod===cardFv);
  // Sync card filter button states
  document.getElementById('tcf-all')?.classList.toggle('active',!cardFv);
  document.getElementById('tcf-visa')?.classList.toggle('active',cardFv==='visa');
  document.getElementById('tcf-amex')?.classList.toggle('active',cardFv==='amex');
  if(searchVal){
    const sv=searchVal.replace(/^\$/,'').trim(); // strip leading $ for amount search
    txns=txns.filter(t=>{
      const desc=(t.description||'').toLowerCase();
      const cat=(t.category||'').toLowerCase();
      const comercio=(t.comercio_detectado||'').toLowerCase();
      const parentCat=catGroup(t.category).toLowerCase();
      const dateStr=(fmtDate(t.date)||'').toLowerCase();
      const amtStr=fmtN(t.amount);
      const amtRaw=String(t.amount);
      const cur=t.currency.toLowerCase();
      return desc.includes(sv)||cat.includes(sv)||comercio.includes(sv)||
        parentCat.includes(sv)||dateStr.includes(sv)||
        amtStr.includes(sv)||amtRaw.includes(sv)||cur.includes(sv);
    });
    // Sort by relevance: exact description match first, then by date desc
    txns.sort((a,b)=>{
      const aExact=a.description.toLowerCase().startsWith(sv)?0:1;
      const bExact=b.description.toLowerCase().startsWith(sv)?0:1;
      if(aExact!==bExact)return aExact-bExact;
      return new Date(b.date)-new Date(a.date);
    });
  }

  // ── Filtro duplicados — calcular SIEMPRE para poder contar y marcar ──
  const dupKeys = getDuplicateAmountKeys();

  // Marcar duplicados en todos los movimientos (no solo los visibles)
  if(state._dupFilterOn){
    txns = txns.filter(t=>dupKeys.has(txnDupKey(t)));
  }

  // ── Filtro de estado (solo si NO estamos en modo duplicados) ──
  const estadoF = state.txnEstadoFilter||'all';
  if(estadoF==='sin_categoria'){
    txns = txns.filter(t=>!t.category||t.category==='Procesando...'||t.category==='Uncategorized');
  } else if(estadoF==='terceros'){
    txns = txns.filter(t=>!!t.isThirdParty);
  }

  txns.sort((a,b)=>new Date(b.date)-new Date(a.date));

  // ── Contar estados para badges ──
  const allPeriodTxns = (() => {
    let base=[...state.transactions];
    if(!state._dupFilterOn){
      if(mode==='mes'){
        const mfvRaw=mf?.value||activeMesKey;
        const mfv=(mfvRaw>=range.startMonthKey&&mfvRaw<=range.currentMonthKey)?mfvRaw:range.currentMonthKey;
        if(mfv)base=base.filter(t=>(t.month||getMonthKey(t.date))===mfv);
      } else if(mode!=='mes'){
        // Aplicar el mismo filtro de ciclo para que los badges sean del período actual
        const _selId=tcf?.value||'';
        const _allCyc=getTcCycles(mode);
        let _actCyc=_selId?_allCyc.find(c=>c.id===_selId):null;
        if(!_actCyc&&_allCyc.length){
          const _todayS=dateToYMD(new Date());
          const _current=_allCyc.find(c=>{const _i=_allCyc.findIndex(x=>x.id===c.id);const _op=getTcCycleOpen(_allCyc,_i);return _op&&_todayS>=_op&&_todayS<=c.closeDate;})||null;
          const _latestPast=_allCyc.find(c=>{const _i=_allCyc.findIndex(x=>x.id===c.id);const _op=getTcCycleOpen(_allCyc,_i);return _op&&_op<=_todayS;})||null;
          _actCyc=_current||_latestPast||_allCyc[_allCyc.length-1]||_allCyc[0];
        }
        if(_actCyc){
          const _i2=_allCyc.findIndex(c=>c.id===_actCyc.id);
          const _op2=getTcCycleOpen(_allCyc,_i2);
          base=base.filter(t=>{const d=dateToYMD(t.date);return d>=_op2&&d<=_actCyc.closeDate;});
        }
      }
    }
    return base;
  })();
  const _dupKeysForCount = getDuplicateAmountKeys();
  const estadoCounts = {
    sin_categoria: allPeriodTxns.filter(t=>!t.category||t.category==='Procesando...'||t.category==='Uncategorized').length,
    duplicado_sospechoso: _dupKeysForCount.size>0?allPeriodTxns.filter(t=>_dupKeysForCount.has(txnDupKey(t))).length:0,
    terceros: allPeriodTxns.filter(t=>!!t.isThirdParty).length,
  };

  // Actualizar estado tabs
  const estadoTabs = document.getElementById('estado-filter-tabs');
  if(estadoTabs){
    estadoTabs.innerHTML = [
      {k:'all',label:'Todos',cls:''},
      {k:'sin_categoria',label:'⏳ Sin categoría',cls:'pendiente'},
      {k:'duplicado_sospechoso',label:'⊘ Duplicados',cls:'duplicado'},
      ...(estadoCounts.terceros>0?[{k:'terceros',label:'👤 De terceros',cls:'terceros'}]:[]),
    ].map(tab=>{
      const cnt=tab.k==='all'?allPeriodTxns.length:(estadoCounts[tab.k]||0);
      const act=estadoF===tab.k;
      return '<button class="eft-btn'+(act?' active'+( tab.cls?' '+tab.cls:''):'')+(tab.cls&&!act?' '+tab.cls:'')+'" onclick="setEstadoFilter(\''+tab.k+'\')" >'+tab.label+' <span class="eft-count">'+cnt+'</span></button>';
    }).join('');
  }

  // Banner sin categoría
  const banEl=document.getElementById('pendientes-banner');
  if(banEl){
    const nPend=estadoCounts.sin_categoria;
    if(nPend>0&&estadoF==='all'){
      banEl.classList.add('show');
      banEl.innerHTML='<span class="pb-text">⏳ '+nPend+' movimiento'+(nPend!==1?'s':'')+' sin categoría</span><button class="pb-btn" onclick="setEstadoFilter(\'sin_categoria\')">Categorizar ahora →</button>';
    } else { banEl.classList.remove('show'); }
  }

  // ── Resumen ──
  const summaryTxns=txns;
  const thirdPartyCount=estadoF==='terceros'?0:txns.filter(t=>!!t.isThirdParty).length;
  const displayTotals=getTxnDisplaySummaryTotals({
    mode,
    activeCycleMeta,
    searchVal,
    txns,
    summaryTxns,
    todayRef,
    monthKey:mode==='mes'?(mf?.value||activeMesKey):'',
    hasCategoryFilter:!!cfv,
    hasCurrencyFilter:!!cufv,
    hasCardFilter:!!cardFv,
    estadoFilter:estadoF
  });
  const arsTotal=displayTotals.ars;
  const usdTotal=displayTotals.usd;
  const grandTotal=displayTotals.grand;
  const mainEl=document.getElementById('txns-main');const detailEl=document.getElementById('txns-detail');
  const arsEl=document.getElementById('txns-total-ars');const usdEl=document.getElementById('txns-total-usd');
  if(searchVal){const sArs=summaryTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);const sUsd=summaryTxns.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);if(mainEl)mainEl.textContent=txns.length+' resultado'+(txns.length!==1?'s':'');if(arsEl)arsEl.textContent=sArs>0?'$'+fmtN(sArs):'—';if(usdEl)usdEl.textContent=sUsd>0?'U$D '+fmtN(sUsd):'—';}
  else{if(mainEl)mainEl.textContent='$'+fmtN(grandTotal);if(arsEl)arsEl.textContent='$'+fmtN(arsTotal);if(usdEl)usdEl.textContent=usdTotal>0?'U$D '+fmtN(usdTotal):'—';}
  if(detailEl){const parts=[];if(searchVal)parts.push('"'+searchVal+'"');else parts.push(periodoLabel||'Todos');parts.push('Mostrando '+txns.length+' de '+state.transactions.length+' movimientos');if(cfv)parts.push(cfv);if(thirdPartyCount>0)parts.push(thirdPartyCount+' marcados como terceros');detailEl.textContent=parts.join(' · ');}

  // ── Helpers visuales ──
  const highlight=(text,q)=>{if(!q)return esc(text);const re=new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');return esc(text).replace(re,'<mark style="background:rgba(200,240,96,0.2);color:var(--accent);border-radius:2px;padding:0 1px;">$1</mark>');};

  const ESTADO_MAP = {
    detectado_automaticamente: {cls:'estado-detectado',  label:'Auto'},
    pendiente_de_revision:     {cls:'estado-pendiente',  label:'Pendiente'},
    confirmado_por_usuario:    {cls:'', label:''},  // hidden
    duplicado_sospechoso:      {cls:'estado-duplicado',  label:'Duplicado'},
  };
  const ORIGEN_MAP = {
    importado_desde_resumen: {cls:'origen-resumen', label:'📄 Resumen'},
    pegado_manualmente:       {cls:'origen-manual',  label:'✎ Manual'},
    importado_desde_gmail:    {cls:'origen-gmail',   label:'✉ Gmail'},
    suscripcion_proyectada:   {cls:'origen-gmail',   label:'🔁 Suscripción'},
  };
  function cuotaProjectedChip(t){
    if(!t.isPendingCuota) return '';
    const _crd=t.payMethod==='visa'?'<span style="background:rgba(230,57,70,0.12);color:#e63946;border:1px solid rgba(230,57,70,0.25);border-radius:4px;padding:1px 5px;font-size:9px;font-weight:700;letter-spacing:.03em;margin-left:3px;vertical-align:middle;">VISA</span>'
      :t.payMethod==='amex'?'<span style="background:rgba(69,123,157,0.12);color:#457b9d;border:1px solid rgba(69,123,157,0.25);border-radius:4px;padding:1px 5px;font-size:9px;font-weight:700;letter-spacing:.03em;margin-left:3px;vertical-align:middle;">AMEX</span>':'';
    return '<span class="origen-chip" style="background:rgba(255,149,0,0.12);color:var(--accent3);border:1px solid rgba(255,149,0,0.3);">📋 Cuota '+t.cuotaNum+'/'+t.cuotaTotal+_crd+'</span>';
  }
  function subscriptionProjectedChip(t){
    if(!t.isPendingSubscription) return '';
    return '<span class="origen-chip" style="background:rgba(90,200,250,0.12);color:#5ac8fa;border:1px solid rgba(90,200,250,0.28);">🔁 Próximo cobro</span>';
  }

  function estadoBadge(t){
    const estado = t.estado_revision || 'detectado_automaticamente';
    const m = ESTADO_MAP[estado]||{cls:'estado-detectado',label:estado};
    return '<span class="estado-badge '+m.cls+'">'+m.label+'</span>';
  }
  function origenChip(t){
    let origen = t.origen_del_movimiento||(t.source==='gmail'?'importado_desde_gmail':'importado_desde_resumen');
    // Si tiene payMethod visa/amex pero origen está marcado como resumen → fue importado desde Gmail
    if((t.payMethod==='visa'||t.payMethod==='amex')&&origen==='importado_desde_resumen') origen='importado_desde_gmail';
    const m = ORIGEN_MAP[origen]||{cls:'origen-resumen',label:origen};
    return '<span class="origen-chip '+m.cls+'">'+m.label+'</span>';
  }
  function sugerenciaBadge(t){ return ''; }

  const nativeRoot=document.getElementById('transactions-native-root');
  if(nativeRoot){
    const visibleTxns=txns.filter(t=>!t.isPendingCuota&&!t.isPendingSubscription);
    const focusTxns=summaryTxns.filter(t=>!t.isPendingCuota&&!t.isPendingSubscription);
    const sortedVisible=visibleTxns.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
    const groupedMap={};
    sortedVisible.forEach(tx=>{
      const key=txnDateKey(tx.date);
      if(!groupedMap[key]) groupedMap[key]=[];
      groupedMap[key].push(tx);
    });
    const groupedDays=Object.keys(groupedMap).sort().reverse().map(key=>{
      const items=groupedMap[key].slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
      const total=items.reduce((s,tx)=>s+Math.abs(txnAmountArs(tx)),0);
      return {key,date:new Date(key+'T12:00:00'),items,total};
    });
    const totalSpend=focusTxns.reduce((s,tx)=>s+Math.abs(txnAmountArs(tx)),0);
    const dayCount=Math.max(groupedDays.length,1);
    const avgDaily=totalSpend/dayCount;
    const breakdown=txnCategoryBreakdown(focusTxns);
    const dominant=breakdown[0]||{label:'Sin categoría',amount:0,pct:0};
    const todaySpend=groupedDays[0]?.total||0;
    const budgetTarget=Math.max(avgDaily*0.95,1);
    const progressPct=Math.min(100, Math.max(8, (todaySpend/budgetTarget)*100));
    const periodSubscriptionTxns=focusTxns.filter(tx=>
      (state.subscriptions||[]).some(sub=>typeof txnMatchesSubscription==='function' && txnMatchesSubscription(tx,sub))
    );
    const periodQuotaTxns=focusTxns.filter(tx=>!!tx.cuotaNum && !tx.isPendingCuota);
    const periodSubscriptionTotal=periodSubscriptionTxns.reduce((s,tx)=>s+Math.abs(txnAmountArs(tx)),0);
    const periodQuotaTotal=periodQuotaTxns.reduce((s,tx)=>s+Math.abs(txnAmountArs(tx)),0);
    const syncLabel=txnSyncLabel();
    const syncItems=txnSyncMetadata();
    const commitmentEntries=getTxnCycleCommitmentEntries(mode, activeCycleMeta, searchVal, txns, todayRef);
    const quickFilter=state.txnQuickFilter||'todos';
    const activeCur=document.getElementById('f-cur')?.value||'';
    const activeCat=document.getElementById('f-cat')?.value||'';
    const activeSearch=(document.getElementById('f-search')?.value||'').trim();
    const activeMode=normalizeViewMode(state.txnFilterMode||'visa');
    const activeEstado=state.txnEstadoFilter||'all';
    const monthOptions=Array.from(mf?.options||[]).map(opt=>'<option value="'+esc(opt.value)+'" '+(opt.selected?'selected':'')+'>'+esc(opt.textContent||'')+'</option>').join('');
    const cycleOptions=Array.from(tcf?.options||[]).map(opt=>'<option value="'+esc(opt.value)+'" '+(opt.selected?'selected':'')+'>'+esc(opt.textContent||'')+'</option>').join('');
    const pageClass=state.txnInsightsCollapsed?'mv-page expanded':'mv-page';
    const statusChips=[
      {key:'all',label:'Todos',count:allPeriodTxns.length},
      {key:'sin_categoria',label:'Sin categoría',count:estadoCounts.sin_categoria},
      {key:'duplicado_sospechoso',label:'Duplicadas',count:estadoCounts.duplicado_sospechoso},
      {key:'terceros',label:'De terceros',count:estadoCounts.terceros},
    ].filter(item=>item.count>0 || item.key==='all');
    const chips=[
      {key:'todos',label:'Todos',active:quickFilter==='todos' && !activeCur && !activeCat},
      {key:'ciclo-visa',label:'Vista VISA',active:activeMode==='visa'},
      {key:'ciclo-act',label:'Vista Mes',active:activeMode==='mes'},
      {key:'ars-usd',label:'ARS + USD',active:!activeCur},
      {key:'sin-cat',label:'Sin categoría',active:activeEstado==='sin_categoria'},
    ];
    let donutCursor=0;
    const donutGradient=(breakdown.slice(0,5).length?breakdown.slice(0,5).map(item=>{
      const start=donutCursor;
      donutCursor+=item.pct;
      return catColor(item.label)+' '+start+'% '+donutCursor+'%';
    }).join(', '):'#E8E6F2 0 100%');

    const menuForTxn=id=>state._txnActionMenuId===id?(
      '<div class="mv-menu">'
        +'<button onclick="openEditTxnModal(\''+id+'\');event.stopPropagation();state._txnActionMenuId=\'\';">Editar monto y fecha</button>'
        +'<button onclick="openEditMerchantModal(\''+id+'\');event.stopPropagation();state._txnActionMenuId=\'\';">Editar comercio</button>'
        +'<button onclick="openAssignModal(\''+id+'\',this);event.stopPropagation();state._txnActionMenuId=\'\';">Cambiar categoría</button>'
        +'<button onclick="openEditNoteModal(\''+id+'\');event.stopPropagation();state._txnActionMenuId=\'\';">Agregar nota</button>'
        +'<button class="danger" onclick="deleteTxn(\''+id+'\');event.stopPropagation();state._txnActionMenuId=\'\';">Eliminar movimiento</button>'
      +'</div>'
    ):'';

    nativeRoot.innerHTML=
      '<style>'
        +'#page-transactions{padding:0 18px 22px 22px;overflow:auto;background:transparent;}'
        +'#transactions-native-root{padding:16px 0 0;}'
        +'.mv-page{display:grid;grid-template-columns:minmax(0,1fr) 332px;gap:18px;align-items:start;}'
        +'.mv-page.expanded{grid-template-columns:minmax(0,1fr);}'
        +'.mv-main{min-width:0;}'
        +'.mv-page.expanded .mv-main{max-width:none;}'
        +'.mv-right{min-width:0;}'
        +'.mv-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:14px;}'
        +'.mv-title h1{font-size:27px;line-height:1.02;font-weight:800;letter-spacing:-.035em;color:#1f1a33;margin:0 0 7px;font-family:var(--font);}'
        +'.mv-title p{margin:0;font-size:13.5px;line-height:1.45;color:#7c7791;font-weight:600;max-width:360px;font-family:var(--font);}'
        +'.mv-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;}'
        +'.mv-period-select{height:42px;border-radius:999px;border:1px solid rgba(95,88,126,.12);background:#fff;padding:0 15px;font-size:12.8px;font-weight:700;color:#403a5b;box-shadow:0 1px 0 rgba(255,255,255,.8) inset;cursor:pointer;min-width:172px;font-family:var(--font);}'
        +'.mv-btn,.mv-btn-primary{height:42px;border-radius:999px;border:1px solid rgba(95,88,126,.12);background:#fff;padding:0 17px;font-size:12.8px;font-weight:700;color:#403a5b;display:inline-flex;align-items:center;gap:8px;box-shadow:0 1px 0 rgba(255,255,255,.8) inset;cursor:pointer;font-family:var(--font);}'
        +'.mv-btn-primary{background:linear-gradient(135deg,#5d35f3,#8c5cff);color:#fff;border:none;box-shadow:0 10px 24px rgba(93,53,243,.22);}'
        +'.mv-btn-soft{background:#f0ecff;color:#5732f3;}'
        +'.mv-search-row{display:block;margin-bottom:12px;}'
        +'.mv-search{height:44px;border-radius:20px;background:#f4f4fa;border:1px solid rgba(113,106,144,.09);display:flex;align-items:center;gap:11px;padding:0 16px;color:#7a7590;}'
        +'.mv-search input{flex:1;border:none;outline:none;background:transparent;font:600 13.2px var(--font);color:#231d39;}'
        +'.mv-chip-row{display:none;}'
        +'.mv-chip{height:31px;border-radius:999px;border:1px solid rgba(113,106,144,.11);background:#fff;padding:0 13px;font-size:11.6px;font-weight:700;color:#5c5675;display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-family:var(--font);}'
        +'.mv-chip.active{background:#5732f3;color:#fff;border-color:transparent;box-shadow:0 8px 16px rgba(87,50,243,.18);}'
        +'.mv-filter-surface{padding:13px 14px;margin-bottom:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;}'
        +'.mv-filter-surface .txn-select{height:34px;border-radius:999px;border:1px solid rgba(97,89,139,.1);background:#fbfbfe;padding:0 13px;font-size:11.8px;font-weight:700;color:#514b68;font-family:var(--font);}'
        +'.mv-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin-bottom:16px;}'
        +'.mv-card{background:#fff;border:1px solid rgba(97,89,139,.1);border-radius:18px;box-shadow:0 4px 14px rgba(43,37,68,.035);}'
        +'.mv-summary-card{padding:17px 19px 18px;min-height:104px;position:relative;overflow:hidden;background:linear-gradient(145deg,#ffffff 0%,#fbfbff 100%);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;}'
        +'.mv-summary-card:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(43,37,68,.08);}'
        +'.mv-summary-card::before{content:"";position:absolute;inset:auto -18px -34px auto;width:104px;height:104px;border-radius:50%;background:var(--mv-tone-soft);}'
        +'.mv-summary-card::after{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,var(--mv-tone),var(--mv-tone-2));}'
        +'.mv-summary-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px;position:relative;z-index:1;}'
        +'.mv-summary-card .k{font-size:9.7px;font-weight:800;letter-spacing:.07em;color:#7d7894;font-family:var(--font);}'
        +'.mv-summary-icon{width:30px;height:30px;border-radius:11px;background:var(--mv-tone-soft);color:var(--mv-tone);display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.78);}'
        +'.mv-summary-card .v{font-size:21.5px;font-weight:850;letter-spacing:-.035em;color:#1f1a33;font-family:var(--font);position:relative;z-index:1;}'
        +'.mv-summary-card .s{margin-top:7px;font:700 11px var(--font);color:#8b86a1;position:relative;z-index:1;}'
        +'.mv-summary-card.ars{--mv-tone:#2563eb;--mv-tone-2:#38bdf8;--mv-tone-soft:rgba(37,99,235,.11);border-color:rgba(37,99,235,.14);}'
        +'.mv-summary-card.usd{--mv-tone:#10b981;--mv-tone-2:#84cc16;--mv-tone-soft:rgba(16,185,129,.12);border-color:rgba(16,185,129,.16);}'
        +'.mv-summary-card.total{--mv-tone:#5d35f3;--mv-tone-2:#ec4899;--mv-tone-soft:rgba(93,53,243,.12);border-color:rgba(93,53,243,.18);}'
        +'.mv-summary-card .v.usd{color:#0f9f6e;}'
        +'.mv-summary-card .v.total{color:#5732f3;}'
        +'.mv-status-pills{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;}'
        +'.mv-status-pill{height:31px;padding:0 13px;border-radius:999px;border:1px solid rgba(113,106,144,.11);background:#fff;font-size:11.1px;font-weight:700;color:#666179;display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-family:var(--font);}'
        +'.mv-status-pill.active{background:#f2f2f8;color:#2e2944;}'
        +'.mv-day{margin-bottom:16px;}'
        +'.mv-commitments-slot{margin-top:18px;}'
        +'.mv-day-head{display:flex;align-items:center;gap:9px;padding:0 4px 9px;}'
        +'.mv-day-head .title{font-size:13.1px;font-weight:800;color:#1f1a33;font-family:var(--font);}'
        +'.mv-day-head .delta{height:24px;padding:0 10px;border-radius:999px;font-size:10.8px;font-weight:800;display:inline-flex;align-items:center;font-family:var(--font);}'
        +'.mv-day-head .delta.up{background:rgba(255,99,114,.12);color:#ff5a6b;}'
        +'.mv-day-head .delta.down{background:rgba(30,173,104,.12);color:#1ead68;}'
        +'.mv-day-head .count{margin-left:auto;font-size:11.5px;font-weight:700;color:#6d6784;font-family:var(--font);}'
        +'.mv-day-bar{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-radius:14px;background:#eef0ff;margin-bottom:5px;font-size:12.6px;font-weight:700;color:#4a4463;font-family:var(--font);}'
        +'.mv-list{background:#fff;border:1px solid rgba(97,89,139,.1);border-radius:18px;box-shadow:0 3px 10px rgba(43,37,68,.025);overflow:hidden;}'
        +'.mv-row{display:grid;grid-template-columns:42px 48px minmax(0,1fr) auto 20px;gap:11px;align-items:center;padding:11px 15px 11px 13px;min-height:66px;border-bottom:1px solid rgba(83,74,119,.062);position:relative;cursor:pointer;}'
        +'.mv-row:last-child{border-bottom:none;}'
        +'.mv-row:hover{background:#fbfbfe;}'
        +'.mv-avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid rgba(0,0,0,.04);background:#17131f;color:#fff;font-size:12px;font-weight:800;box-shadow:inset 0 1px 0 rgba(255,255,255,.75),0 2px 8px rgba(23,19,31,.06);overflow:hidden;}'
        +'.mv-avatar img{width:100%;height:100%;object-fit:contain;}'
        +'.mv-avatar-cat{background:#f6f3ff;font-size:15px;font-weight:700;}'
        +'.mv-time{font-size:11.8px;font-weight:600;color:#7e7997;font-variant-numeric:tabular-nums;font-family:var(--font);}'
        +'.mv-merchant{font-size:14px;font-weight:700;color:#1f1a33;line-height:1.18;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px;font-family:var(--font);}'
        +'.mv-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}'
        +'.mv-cat{display:inline-flex;align-items:center;gap:4px;height:23px;padding:0 9px;border-radius:999px;border:0;font-size:10.9px;font-weight:800;font-family:var(--font);cursor:pointer;}'
        +'.mv-note{font-size:11.4px;color:#7c7791;font-weight:600;font-family:var(--font);}'
        +'.mv-amount{text-align:right;min-width:102px;}'
        +'.mv-amount-main{font-size:14.2px;font-weight:800;letter-spacing:-.01em;font-variant-numeric:tabular-nums;color:#221c38;font-family:var(--font);}'
        +'.mv-amount-main.usd{color:#1ead68;}'
        +'.mv-amount-sub{margin-top:2px;font-size:11px;font-weight:600;color:#8c88a2;font-variant-numeric:tabular-nums;font-family:var(--font);}'
        +'.mv-menu-btn{width:18px;height:18px;border:none;border-radius:5px;background:transparent;color:#706b87;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:15px;}'
        +'.mv-menu{position:absolute;right:10px;top:34px;width:214px;border-radius:16px;background:#fff;border:1px solid rgba(97,89,139,.1);box-shadow:0 14px 30px rgba(21,17,45,.14),0 3px 10px rgba(21,17,45,.06);padding:5px 0;z-index:20;}'
        +'.mv-menu button{width:100%;border:none;background:transparent;text-align:left;padding:11px 14px;font-size:12.8px;color:#2b2544;cursor:pointer;font-weight:600;font-family:var(--font);}'
        +'.mv-menu button:hover{background:#f7f7fc;}'
        +'.mv-menu button.danger{color:#ff5a6b;}'
        +'.mv-right-col{position:sticky;top:0;padding-top:111px;}'
        +'.mv-insights-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:0 3px;}'
        +'.mv-insights-top .label{font-size:12.5px;color:#615b79;font-weight:700;font-family:var(--font);}'
        +'.mv-toggle{width:44px;height:24px;border-radius:999px;border:none;background:#5732f3;position:relative;cursor:pointer;}'
        +'.mv-toggle::after{content:"";position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.18);}'
        +'.mv-ins-show-bar{margin:0 0 12px;display:flex;justify-content:flex-end;}'
        +'.mv-ins-show-btn{height:34px;border:none;border-radius:999px;background:#f0ecff;color:#5732f3;padding:0 14px;font:800 11.8px var(--font);letter-spacing:.02em;cursor:pointer;box-shadow:0 8px 18px rgba(87,50,243,.12);}'
        +'.mv-right-stack{display:flex;flex-direction:column;gap:12px;}'
        +'.mv-hero{border-radius:20px;padding:18px 18px 17px;min-height:214px;background:linear-gradient(145deg,#075985 0%,#0284c7 100%);color:#fff;position:relative;overflow:hidden;box-shadow:0 12px 30px rgba(2,132,199,0.22);}'
        +'.mv-hero .eyebrow{display:flex;align-items:center;gap:6px;margin-bottom:14px;font-size:10.1px;font-weight:800;letter-spacing:.045em;opacity:.82;font-family:var(--font);}'
        +'.mv-hero h3{margin:0 0 10px;font-size:17px;line-height:1.32;font-weight:800;max-width:215px;font-family:var(--font);}'
        +'.mv-hero p{margin:0 0 14px;font-size:12.6px;line-height:1.48;color:rgba(255,255,255,.82);max-width:215px;font-family:var(--font);}'
        +'.mv-bar{height:6px;border-radius:999px;background:rgba(255,255,255,.16);margin-bottom:7px;overflow:hidden;}'
        +'.mv-bar > span{display:block;height:100%;width:'+progressPct+'%;background:linear-gradient(90deg,#38bdf8,#7dd3fc);border-radius:999px;box-shadow:0 0 8px rgba(56,189,248,0.6);}'
        +'.mv-mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}'
        +'.mv-mini{padding:14px 14px 12px;min-height:130px;}'
        +'.mv-mini .k{font-size:10.8px;font-weight:700;color:#625d78;margin-bottom:8px;font-family:var(--font);}'
        +'.mv-mini .v{font-size:18.5px;font-weight:800;color:#1f1a33;margin-bottom:5px;font-family:var(--font);}'
        +'.mv-mini .s{font-size:10.8px;font-weight:700;color:#0ea5e9;margin-bottom:10px;font-family:var(--font);}'
        +'.mv-dominant{display:flex;align-items:center;gap:10px;}'
        +'.mv-dominant-icon{width:34px;height:34px;border-radius:11px;background:#e0f2fe;color:#0284c7;display:flex;align-items:center;justify-content:center;font-size:16px;}'
        +'.mv-breakdown{padding:16px 16px 15px;}'
        +'.mv-breakdown-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}'
        +'.mv-breakdown-head .t{font-size:12.7px;font-weight:800;color:#1f1a33;font-family:var(--font);letter-spacing:.02em;}'
        +'.mv-breakdown-head button{border:none;background:transparent;color:#0284c7;font-size:12.5px;font-weight:700;cursor:pointer;font-family:var(--font);}'
        +'.mv-breakdown-bars{display:flex;height:8px;border-radius:999px;overflow:hidden;gap:3px;margin:8px 0 16px;}'
        +'.mv-breakdown-list{display:flex;flex-direction:column;gap:8px;}'
        +'.mv-breakdown-row{display:grid;grid-template-columns:12px 1fr 34px 82px;align-items:center;gap:8px;}'
        +'.mv-breakdown-row span{font-family:var(--font);}'
        +'.mv-sync-card{padding:14px 15px;}'
        +'.mv-sync-row{display:flex;align-items:center;gap:12px;}'
        +'.mv-sync-icon{width:34px;height:34px;border-radius:12px;background:#f0ecff;color:#5732f3;display:flex;align-items:center;justify-content:center;font-size:15px;}'
        +'.mv-sync-list{display:flex;flex-direction:column;gap:8px;margin-top:14px;padding-top:13px;border-top:1px solid rgba(97,89,139,.08);}'
        +'.mv-sync-item{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}'
        +'.mv-sync-item-label{font-size:11.5px;line-height:1.35;color:#6f6986;font-weight:700;font-family:var(--font);}'
        +'.mv-sync-item-meta{font-size:10.9px;line-height:1.35;color:#908ba5;font-weight:700;text-align:right;white-space:nowrap;font-family:var(--font);}'
        +'.mv-secondary-btn{margin-top:14px;width:170px;height:38px;border-radius:999px;border:none;background:#f0ecff;color:#5732f3;font-size:12.8px;font-weight:800;cursor:pointer;font-family:var(--font);}'
        +'.mv-ghost-btn{margin-top:8px;width:180px;height:34px;border-radius:999px;border:1px solid rgba(87,50,243,.14);background:#fff;color:#4a28d9;font-size:12.2px;font-weight:800;cursor:pointer;font-family:var(--font);}'
        +'.txn-cycle-panel{background:#fff;border:1px solid rgba(97,89,139,.1);border-radius:18px;box-shadow:0 4px 14px rgba(43,37,68,.035);padding:16px 16px 14px;font-family:var(--font);}'
        +'.txn-cycle-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px;}'
        +'.txn-cycle-panel-kicker{font-size:13px;font-weight:800;color:#221c38;margin-bottom:4px;}'
        +'.txn-cycle-panel-sub{font-size:12px;line-height:1.45;color:#7c7791;max-width:540px;}'
        +'.txn-cycle-panel-count{height:30px;padding:0 12px;border-radius:999px;background:#f4f4fa;border:1px solid rgba(113,106,144,.1);display:inline-flex;align-items:center;font-size:11px;font-weight:700;color:#5e5976;}'
        +'.txn-cycle-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;}'
        +'.txn-cycle-tab{height:31px;padding:0 13px;border:none;border-radius:999px;background:#f5f5fb;color:#615b79;font-size:11.2px;font-weight:700;cursor:pointer;font-family:var(--font);}'
        +'.txn-cycle-tab.active{background:#5732f3;color:#fff;box-shadow:0 8px 16px rgba(87,50,243,.18);}'
        +'.txn-cycle-list{display:flex;flex-direction:column;gap:8px;}'
        +'.txn-cycle-entry{display:grid;grid-template-columns:42px 58px minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:13px 14px;border:1px solid rgba(97,89,139,.08);border-radius:16px;background:#fff;box-shadow:0 4px 12px rgba(43,37,68,.025);transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease;}'
        +'.txn-cycle-entry:hover{transform:translateY(-1px);border-color:rgba(87,50,243,.14);box-shadow:0 10px 22px rgba(43,37,68,.055);}'
        +'.txn-cycle-avatar{width:38px;height:38px;border-radius:13px;background:color-mix(in srgb, var(--entry-tone,#5732f3) 13%, white);display:flex;align-items:center;justify-content:center;}'
        +'.txn-cycle-avatar span{width:10px;height:10px;border-radius:50%;background:var(--entry-tone,#5732f3);box-shadow:0 0 0 5px color-mix(in srgb, var(--entry-tone,#5732f3) 12%, white);}'
        +'.txn-cycle-date{font-size:11.4px;font-weight:800;color:#7d7894;text-transform:uppercase;font-family:var(--font);}'
        +'.txn-cycle-title{font-size:13.2px;font-weight:700;color:#221c38;display:flex;align-items:center;gap:6px;}'
        +'.txn-cycle-meta{font-size:11.4px;color:#7d7894;margin-top:4px;line-height:1.35;}'
        +'.txn-cycle-status{height:25px;padding:0 10px;border-radius:999px;display:inline-flex;align-items:center;font-size:10.6px;font-weight:800;font-family:var(--font);}'
        +'.txn-cycle-status.is-settled{background:#ebfff5;color:#16a34a;}.txn-cycle-status.is-pending{background:#fff7ed;color:#ea580c;}'
        +'.txn-cycle-amount{font-size:13.4px;font-weight:800;font-variant-numeric:tabular-nums;}'
        +'.txn-cycle-footer{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(97,89,139,.08);}'
        +'.txn-cycle-footer-label{display:block;font-size:11.4px;color:#7c7791;font-weight:700;margin-bottom:4px;}'
        +'.txn-cycle-footer-total{font-size:18px;font-weight:800;color:#221c38;}'
        +'.txn-cycle-footer-breakdown{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;}'
        +'.txn-cycle-footer-item{font-size:11px;font-weight:700;padding:5px 8px;border-radius:999px;background:#f7f7fb;}'
        +'.txn-cycle-empty{padding:18px 0 8px;color:#7c7791;font-size:12.2px;font-weight:600;text-align:center;}'
        +'#txn-detail-panel,#rules-panel{background:#fff;border:1px solid rgba(97,89,139,.1);border-radius:24px;box-shadow:0 24px 60px rgba(34,26,61,.18),0 8px 18px rgba(34,26,61,.08);font-family:var(--font);}'
        +'#txn-detail-panel .tdp-header,#rules-panel .rp-header{padding:20px 20px 16px;border-bottom:1px solid rgba(97,89,139,.08);}'
        +'#txn-detail-panel .tdp-body,#rules-panel .rp-body{padding:18px 20px 20px;}'
        +'#txn-detail-panel .tdp-section{padding:14px 0;border-bottom:1px solid rgba(97,89,139,.07);}'
        +'#txn-detail-panel .tdp-section:last-child{border-bottom:none;padding-bottom:4px;}'
        +'#txn-detail-panel .tdp-section-label{font-size:11.5px;font-weight:800;color:#7b7594;letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px;}'
        +'#txn-detail-panel .tdp-field{margin-bottom:9px;}'
        +'#txn-detail-panel .tdp-field-label{font-size:11px;color:#8a85a0;font-weight:700;margin-bottom:3px;}'
        +'#txn-detail-panel .tdp-field-value{font-size:13.2px;color:#241e3b;font-weight:600;line-height:1.4;}'
        +'#txn-detail-panel .tdp-amount-big{font-size:22px;font-weight:800;color:#221c38;}'
        +'#txn-detail-panel .tdp-amount-big.usd{color:#1ead68;}'
        +'#txn-detail-panel .tdp-tp-input,#rules-panel input,#rules-panel select{width:100%;padding:11px 12px;border:1px solid rgba(97,89,139,.12);border-radius:14px;background:#fbfbfe;color:#241e3b;font-size:13px;font-family:var(--font);}'
        +'#txn-detail-panel .tdp-close,#rules-panel .tdp-close{width:34px;height:34px;border:none;border-radius:12px;background:#f4f4fa;color:#655f7f;font-size:14px;cursor:pointer;}'
        +'#txn-detail-panel .btn,#rules-panel .btn{border-radius:999px;font-family:var(--font);font-weight:700;}'
        +'#rules-panel .rp-title{font-size:19px;font-weight:800;color:#221c38;letter-spacing:-.02em;}'
        +'#rules-panel .rp-header > div > div:last-child{font-size:12px !important;color:#7c7791 !important;margin-top:4px !important;}'
        +'#rules-panel .rp-body{display:flex;flex-direction:column;gap:14px;}'
        +'#rules-panel .rp-body button.btn,#rules-panel .rp-body .btn{font-family:var(--font);}'
        +'.modal-overlay#modal-edit-txn .modal,.modal-overlay#modal-edit-merchant .modal,.modal-overlay#modal-edit-note .modal{max-width:460px !important;border-radius:24px;background:#fff;border:1px solid rgba(97,89,139,.1);box-shadow:0 24px 60px rgba(34,26,61,.18),0 8px 18px rgba(34,26,61,.08);padding:22px;font-family:var(--font);}'
        +'.modal-overlay#modal-edit-txn .modal-title,.modal-overlay#modal-edit-merchant .modal-title,.modal-overlay#modal-edit-note .modal-title{font-size:20px;font-weight:800;color:#221c38;letter-spacing:-.02em;margin-bottom:6px;}'
        +'.modal-overlay#modal-edit-txn .modal-sub,.modal-overlay#modal-edit-merchant .modal-sub,.modal-overlay#modal-edit-note .modal-sub{font-size:12.4px;color:#7c7791;font-weight:600;margin-bottom:10px !important;}'
        +'.modal-overlay#modal-edit-txn .input-label,.modal-overlay#modal-edit-merchant .input-label,.modal-overlay#modal-edit-note .input-label{font-size:11.2px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#7b7594;}'
        +'.modal-overlay#modal-edit-txn .input-field,.modal-overlay#modal-edit-merchant .input-field,.modal-overlay#modal-edit-note .textarea-premium{border-radius:15px;border:1px solid rgba(97,89,139,.12);background:#fbfbfe;font-size:13.2px;color:#241e3b;font-family:var(--font);padding:12px 13px;}'
        +'.modal-overlay#modal-edit-note .textarea-premium{min-height:126px;}'
        +'.modal-overlay#modal-edit-txn .modal-actions,.modal-overlay#modal-edit-merchant .modal-actions,.modal-overlay#modal-edit-note .modal-actions{margin-top:18px;}'
        +'@media (max-width: 1180px){.mv-page{grid-template-columns:minmax(0,1fr);} .mv-right-col{position:relative;padding-top:0;}}'
      +'</style>'
      +'<div class="'+pageClass+'">'
        +'<div class="mv-main">'
          +'<div class="mv-title-row">'
            +'<div class="mv-title">'
              +'<h1>Movimientos</h1>'
              +'<p>Controlá tus gastos, entendé tus hábitos.</p>'
            +'</div>'
            +'<div class="mv-actions">'
              +(activeMode==='mes'
                ?'<select class="mv-period-select" onchange="txnSetMonthFilter(this.value)">'+monthOptions+'</select>'
                :'<select class="mv-period-select" onchange="txnSetCycleFilter(this.value)">'+cycleOptions+'</select>')
              +'<button class="mv-btn" onclick="openRulesPanel()">Crear regla</button>'
              +'<button class="mv-btn" onclick="openNewExpenseModal()">Nuevo gasto</button>'
              +'<button class="mv-btn-primary" onclick="openCatReview()">Revisar categorías</button>'
            +'</div>'
          +'</div>'
          +(state.txnInsightsCollapsed?'<div class="mv-ins-show-bar"><button class="mv-ins-show-btn" onclick="toggleTxnInsightsPanel()">✦ Mostrar insights</button></div>':'')
          +'<div class="mv-search-row">'
            +'<label class="mv-search"><span>🔍</span><input value="'+esc(activeSearch)+'" placeholder="Buscar descripción, monto o categoría..." oninput="txnSetSearch(this.value)"></label>'
          +'</div>'
          +('<div class="mv-card mv-filter-surface">'
              +'<select class="txn-select" onchange="txnSetCurrencyFilter(this.value)"><option value="" '+(!activeCur?'selected':'')+'>ARS + USD</option><option value="ARS" '+(activeCur==='ARS'?'selected':'')+'>Solo ARS</option><option value="USD" '+(activeCur==='USD'?'selected':'')+'>Solo USD</option></select>'
              +'<select class="txn-select" onchange="txnSetCategoryFilter(this.value)">'+(function(){const cats=[...new Set(state.transactions.map(t=>txnCategoryName(t)))].sort();return '<option value="">Todas las categorías</option>'+cats.map(c=>'<option value="'+esc(c)+'" '+(activeCat===c?'selected':'')+'>'+esc(c)+'</option>').join('');})()+'</select>'
              +'<button class="mv-chip'+(activeMode==='mes'?' active':'')+'" onclick="txnSetMode(\'mes\')">Por mes</button>'
              +'<button class="mv-chip'+(activeMode==='visa'?' active':'')+'" onclick="txnSetMode(\'visa\')">Vista VISA</button>'
              +'<button class="mv-chip'+((state.txnCardFilter||'')===''?' active':'')+'" onclick="txnSetCardChip(\'\')">Todas</button>'
              +'<button class="mv-chip'+((state.txnCardFilter||'')==='visa'?' active':'')+'" onclick="txnSetCardChip(\'visa\')">Solo VISA</button>'
              +'<button class="mv-chip'+((state.txnCardFilter||'')==='amex'?' active':'')+'" onclick="txnSetCardChip(\'amex\')">Solo AMEX</button>'
            +'</div>')
          +'<div class="mv-summary">'
            +'<div class="mv-card mv-summary-card ars"><div class="mv-summary-head"><div class="k">SALDO EN ARS</div><div class="mv-summary-icon">$</div></div><div class="v">$'+fmtN(arsTotal)+'</div><div class="s">Gasto local del período</div></div>'
            +'<div class="mv-card mv-summary-card usd"><div class="mv-summary-head"><div class="k">EN USD</div><div class="mv-summary-icon">US</div></div><div class="v usd">'+(usdTotal>0?'USD '+fmtN(usdTotal):'—')+'</div><div class="s">Consumos dolarizados</div></div>'
            +'<div class="mv-card mv-summary-card total"><div class="mv-summary-head"><div class="k">TOTAL DEL PERÍODO</div><div class="mv-summary-icon">Σ</div></div><div class="v total">$'+fmtN(grandTotal)+'</div><div class="s">ARS + USD convertido</div></div>'
          +'</div>'
          +'<div class="mv-status-pills">'
            +statusChips.map(ch=>'<button class="mv-status-pill'+(activeEstado===ch.key?' active':'')+'" onclick="txnSetEstadoChip(\''+ch.key+'\')">'+esc(ch.label)+' <span>'+ch.count+'</span></button>').join('')
          +'</div>'
          +(groupedDays.length?groupedDays.map((group,idx)=>{
            const delta=avgDaily?Math.round(((group.total-avgDaily)/avgDaily)*100):0;
            const deltaCls=delta>=0?'up':'down';
            return '<section class="mv-day">'
              +'<div class="mv-day-head">'
                +'<div class="title">'+txnFormatDayHeader(group.date)+'</div>'
                +'<div class="delta '+deltaCls+'">'+(delta>=0?'+':'')+delta+'% vs. promedio</div>'
                +'<div class="count">'+group.items.length+' movimientos</div>'
              +'</div>'
              +'<div class="mv-day-bar"><div>Gasto del día: <strong>$'+fmtN(group.total)+'</strong></div></div>'
              +'<div class="mv-list">'
                +group.items.map(tx=>{
                  const cat=txnCategoryName(tx);
                  const amountClass=(tx.currency==='USD'?' usd':'');
                  return '<div class="mv-row" onclick="openTxnDetail(\''+tx.id+'\')">'
                    +txnMerchantAvatar(tx)
                    +'<div class="mv-time">'+txnTimeLabel(tx)+'</div>'
                    +'<div><div class="mv-merchant">'+esc(txnMerchantName(tx))+'</div><div class="mv-meta"><button class="mv-cat" style="background:'+catColor(cat)+'18;color:'+catColor(cat)+';" onclick="event.stopPropagation();openAssignModal(\''+tx.id+'\',this)" title="Cambiar categoría"><span style="font-size:7px;">◆</span>'+esc(cat)+'</button>'+(txnNoteText(tx)?'<span class="mv-note">↪ '+esc(txnNoteText(tx))+'</span>':'')+'</div></div>'
                    +'<div class="mv-amount"><div class="mv-amount-main'+amountClass+'">'+txnAmountLabel(tx)+'</div>'+(((tx.currency||'ARS')==='USD')?'<div class="mv-amount-sub">'+txnEquivalentLabel(tx)+'</div>':'')+'</div>'
                    +'<div style="position:relative;"><button class="mv-menu-btn" onclick="event.stopPropagation();toggleTxnActionMenu(\''+tx.id+'\')">⋮</button>'+menuForTxn(tx.id)+'</div>'
                  +'</div>';
                }).join('')
              +'</div>'
            +'</section>';
          }).join(''):'<div class="mv-card" style="padding:24px;text-align:center;color:#6d6784;font-weight:700;">No hay movimientos para este filtro.</div>')
          +'<div id="mv-commitments-slot" class="mv-commitments-slot"></div>'
        +'</div>'
        +(state.txnInsightsCollapsed?'':'<div class="mv-right"><div class="mv-right-col">'
              +'<div class="mv-insights-top"><div class="label">Mostrando insights</div><button class="mv-toggle" onclick="toggleTxnInsightsPanel()"></button></div>'
              +'<div class="mv-right-stack">'
                +'<div class="mv-hero">'
              +'<div style="position:absolute;right:8px;top:16px;opacity:.88;"><svg width="84" height="72" viewBox="0 0 82 70" fill="none"><path d="M2 58c8-2 10-14 16-14 7 0 9 10 15 10 8 0 10-16 18-16 9 0 11 18 20 18 5 0 7-5 11-13" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/><circle cx="72" cy="31" r="4" fill="#38bdf8"/></svg></div>'
                  +'<div class="eyebrow"><span style="color:#7dd3fc;">✦</span> DATOS DEL PERÍODO · '+esc((groupedDays[0]?groupedDays[0].date.toLocaleDateString('es-AR',{day:'2-digit',month:'long'}):'sin datos')).toUpperCase()+'</div>'
                  +'<h3>'+esc(periodoLabel||'Vista actual')+'</h3>'
                  +'<p><strong style="color:#fff;">'+focusTxns.length+' movimientos</strong> reales · <strong style="color:#fff;">$'+fmtN(totalSpend)+'</strong> en consumo registrado</p>'
                  +'<div class="mv-bar"><span></span></div>'
                  +'<div style="text-align:right;font-size:10.5px;font-weight:700;color:rgba(255,255,255,.8)">'+breakdown.length+' categorías con actividad</div>'
                +'</div>'
                +'<div class="mv-mini-grid">'
                  +'<div class="mv-card mv-mini" style="border:1px solid #e0f2fe;"><div class="k">Mayor impacto</div><div class="mv-dominant"><div class="mv-dominant-icon">'+txnCategoryGlyph(dominant.label)+'</div><div style="min-width:0;flex:1;"><div style="font-size:12.5px;font-weight:800;color:#0c4a6e;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;">'+esc(dominant.label)+'</div><div style="margin-top:3px;font-size:11.1px;color:#0284c7;font-weight:700;">'+dominant.pct+'% del total</div></div></div></div>'
                  +'<div class="mv-card mv-mini"><div class="k">Suscripciones</div><div class="v">$'+fmtN(periodSubscriptionTotal)+'</div><div class="s">'+periodSubscriptionTxns.length+' cobro'+(periodSubscriptionTxns.length===1?'':'s')+' real'+(periodSubscriptionTxns.length===1?'':'es')+' en este período</div></div>'
                  +'<div class="mv-card mv-mini"><div class="k">Cuotas</div><div class="v">$'+fmtN(periodQuotaTotal)+'</div><div class="s">'+periodQuotaTxns.length+' cuota'+(periodQuotaTxns.length===1?'':'s')+' cobrada'+(periodQuotaTxns.length===1?'':'s')+' en este período</div></div>'
                +'</div>'
                +'<div class="mv-card mv-breakdown"><div class="mv-breakdown-head"><div class="t">TOP 5 CATEGORÍAS</div><button onclick="txnShowCategoryDetails()">Ranking</button></div>'
                +'<div style="font-size:22px;font-weight:800;color:#0c4a6e;margin-top:4px;letter-spacing:-0.03em;">$'+fmtN(totalSpend)+'</div><div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:8px;">Total del período</div>'
                +'<div class="mv-breakdown-bars">'+breakdown.slice(0,5).map(b=>'<div style="height:100%;background:'+catColor(b.label)+';width:'+b.pct+'%;"></div>').join('')+'<div style="flex:1;background:#f1f5f9;"></div></div>'
                +'<div class="mv-breakdown-list">'+breakdown.slice(0,5).map(b=>'<button class="mv-breakdown-row" onclick="txnSetCategoryFilter(\''+esc(b.label)+'\');renderTransactions();" style="border:none;background:transparent;padding:0;cursor:pointer;"><span style="width:8px;height:8px;border-radius:50%;background:'+catColor(b.label)+';"></span><span style="font-size:12.3px;color:#334155;font-weight:600;text-align:left;">'+esc(b.label)+'</span><span style="font-size:11.7px;color:#64748b;font-weight:700;">'+b.pct+'%</span><span style="text-align:right;font-size:12.2px;color:#0f172a;font-weight:700;">$'+fmtN(b.amount)+'</span></button>').join('')+'</div></div>'
                +'<div class="mv-card mv-sync-card" style="box-shadow:none;border:1px dashed #cbd5e1;"><div class="mv-sync-row"><div class="mv-sync-icon" style="background:#f8fafc;color:#64748b;width:30px;height:30px;font-size:13px;">↻</div><div><div style="font-size:12px;font-weight:700;color:#334155;">'+esc(syncLabel)+'</div></div><div style="margin-left:auto;"><button class="mv-ghost-btn" style="color:#0284c7;font-size:11px;padding:6px 12px;height:auto;" onclick="gmailSync()">Sincronizar</button></div></div></div>'
              +'</div>'
            +'</div></div>')
      +'</div>';
    const commitmentSlot=document.getElementById('mv-commitments-slot');
    if(commitmentSlot){
      if(commitmentEntries.length) renderTxnCycleCommitmentsPanel(commitmentSlot, commitmentEntries);
      else document.getElementById('txn-cycle-commitments')?.remove();
    }
    return;
  }

  // ── Tabla ──
  window.currentRenderedTxns = txns;
  const wrap=document.getElementById('txn-wrap');
  if(!txns.length){
    wrap.innerHTML=`
      <div class="empty-state fade-up">
        <div class="empty-icon">📊</div>
        <div class="empty-title">${searchVal ? t('global_no_results') : 'Sin movimientos aún'}</div>
        <p class="empty-sub">${searchVal ? 'No encontramos nada que coincida con "' + esc(searchVal) + '" en este período. Probá con otra categoría, monto o descripción.' : 'Todavía no hay movimientos para revisar. Importá datos o cargá un gasto manual para empezar a ordenar el día a día.'}</p>
        <div class="empty-actions">
           ${searchVal ? '<button class="btn btn-secondary" onclick="clearSearch()">Limpiar búsqueda</button>' : '<button class="btn btn-primary" onclick="nav(\'import\')">Importar datos</button><button class="btn btn-ghost" onclick="openNewExpenseModal()">Nuevo gasto</button>'}
        </div>
      </div>`;
    return;
  }

  const _payLbls={visa:'💳 VISA',amex:'💳 AMEX',deb:'🏦 Débito',ef:'💵 Efectivo'};
  const _payCls={visa:'tc',amex:'tc',deb:'deb',ef:'ef'};

  // Sort duplicates together
  let displayTxns = txns;
  let _dupAmtGroupMap = {};
  if(state._dupFilterOn){
    displayTxns = txns.slice().sort((a,b)=>{const d=b.amount-a.amount;if(d!==0)return d;return new Date(b.date)-new Date(a.date);});
    let _gi=0,_lastKey='';
    displayTxns.forEach(t=>{const k=txnDupKey(t);if(k!==_lastKey){_gi++;_lastKey=k;}_dupAmtGroupMap[t.id]=_gi;});
  }

  if(window.innerWidth<=768){
    // ── MOBILE ──
    wrap.innerHTML='<div style="border-radius:14px;overflow:hidden;border:1px solid var(--border);">'
      +displayTxns.map((t,i)=>{
        const d=(t.date instanceof Date?t.date:new Date(t.date+'T12:00:00')).toLocaleDateString('es-AR',{day:'2-digit',month:'short'});
        const amt=(t.currency==='USD'?'U$D ':'$')+fmtN(t.amount);
        const amtColor=t.currency==='USD'?'var(--accent2)':'var(--accent)';
        const catDot='<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:'+catColor(t.category)+';margin-right:4px;flex-shrink:0;"></span>';
        const _mChecked=state._selectedTxns&&state._selectedTxns.has(t.id)?' checked':'';
        const _mAmtColor=t.isPendingCuota?'var(--accent3)':amtColor;
        return '<div style="display:flex;align-items:center;padding:11px 14px;'+(i>0?'border-top:1px solid var(--border)':'')+';gap:10px;'+(t.isPendingCuota?'border-left:3px solid var(--accent3);':'')+'" data-txnid="'+t.id+'">'
          +'<input type="checkbox" class="txn-cb" data-id="'+t.id+'"'+_mChecked+' onclick="event.stopPropagation();toggleSelectTxn(\''+t.id+'\')">'
          +'<div style="flex:1;min-width:0;">'
            +'<div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(t.description)+'</div>'
            +'<div style="font-size:10px;color:var(--text3);margin-top:3px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;">'
              +'<span>'+d+'</span>'
              +'<span style="color:var(--border2);">·</span>'
              +'<button style="display:inline-flex;align-items:center;border:none;background:transparent;color:inherit;padding:0;cursor:pointer;font:inherit;" onclick="event.stopPropagation();openAssignModal(\''+t.id+'\',this)">'+catDot+esc(t.category||'—')+'</button>'
              +(t.isPendingCuota?'<span style="color:var(--accent3);font-weight:700;">📋 '+t.cuotaNum+'/'+t.cuotaTotal+'</span>':'')
              +(t.isThirdParty?'<span class="tp-badge'+(t.thirdPartyStatus==='settled'?' settled':'')+'">3ro'+(t.thirdPartyStatus==='settled'?' ✓':t.thirdPartyStatus==='partial'?' ~':'')+'</span>':'')
            +'</div>'
          +'</div>'
          +'<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">'
            +'<span style="font-size:14px;font-weight:700;color:'+_mAmtColor+';font-family:var(--font);">'+amt+'</span>'
            +'<button class="txn-edit-btn" data-id="'+t.id+'" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;padding:4px;line-height:1;border-radius:6px;">✎</button>'
            +'<button class="txn-del-btn" data-id="'+t.id+'" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:16px;padding:4px;line-height:1;border-radius:6px;">✕</button>'
          +'</div>'
        +'</div>';
      }).join('')+'</div>';
  } else {
    // ── DESKTOP: tabla enriquecida ──
    wrap.innerHTML='<div class="table-wrap"><table>'
      +'<thead><tr>'
        +'<th style="width:30px;padding:0 6px;"><input type="checkbox" class="txn-cb-header" onchange="toggleSelectAll(this.checked)"></th>'
        +'<th style="width:80px">Fecha</th>'
        +'<th>Descripción</th>'
        +'<th style="width:140px">Categoría</th>'
        +'<th style="width:70px">Medio</th>'
        
        +'<th style="text-align:right;width:110px">Monto</th>'
        +'<th style="width:48px"></th>'
      +'</tr></thead><tbody>'
      +(()=>{
        const buildRow=(t)=>{
          const _pTag=t.payMethod
            ?('<span class="pay-tag '+_payCls[t.payMethod]+'" onclick="event.stopPropagation();openPayMethodModal(\''+t.id+'\')" title="Cambiar medio">'+_payLbls[t.payMethod]+'</span>')
            :('<span class="pay-tag" style="background:var(--surface2);color:var(--text3);border:1px solid var(--border);" onclick="event.stopPropagation();openPayMethodModal(\''+t.id+'\')" title="Asignar medio">+ tag</span>');
          const _dupBg=state._dupFilterOn&&_dupAmtGroupMap[t.id]%2===0?'background:rgba(200,240,96,0.03);':'';
          const _isSelected=state._detailTxnId===t.id?'selected':'';
          const amtColor=t.currency==='USD'?'color:var(--accent2)':t.isPendingCuota?'color:var(--accent3)':'';
          const _tpBadge=t.isThirdParty?'<span class="tp-badge'+(t.thirdPartyStatus==='settled'?' settled':'')+'">3ro'+(t.thirdPartyStatus==='settled'?' ✓':t.thirdPartyStatus==='partial'?' ~':'')+'</span>':'';
          const comercioHtml=t.comercio_detectado&&t.comercio_detectado.toLowerCase()!==t.description.toLowerCase()
            ?'<span class="td-desc-secondary"><span class="comercio-detected">'+esc(t.comercio_detectado)+'</span>'+_tpBadge+origenChip(t)+cuotaProjectedChip(t)+subscriptionProjectedChip(t)+sugerenciaBadge(t)+'</span>'
            :'<span class="td-desc-secondary">'+_tpBadge+origenChip(t)+cuotaProjectedChip(t)+subscriptionProjectedChip(t)+sugerenciaBadge(t)+'</span>';
          const _checked=state._selectedTxns&&state._selectedTxns.has(t.id)?' checked':'';
          const _projStyle=t.isPendingCuota?'border-left:3px solid var(--accent3);':'';
          return '<tr class="txn-row-v2 '+_isSelected+(_checked?' multi-selected':'')+'" data-txnid="'+t.id+'" style="'+_dupBg+_projStyle+'">'
            +'<td style="padding:0 6px;"><input type="checkbox" class="txn-cb" data-id="'+t.id+'"'+_checked+' onclick="event.stopPropagation();toggleSelectTxn(\''+t.id+'\')"></td>'
            +'<td style="font-family:var(--font);font-size:13px;font-weight:500;color:var(--text3);white-space:nowrap;">'+fmtDate(t.date)+'</td>'
            +'<td class="td-main">'
              +'<span class="td-desc-primary">'+highlight(t.description,searchVal)+'</span>'
              +comercioHtml
            +'</td>'
            +'<td><span class="cat-badge" style="'+catStyle(t.category)+';cursor:pointer;" onclick="event.stopPropagation();openAssignModal(\''+t.id+'\',this)">'
              +'<span class="cat-dot" style="background:'+catColor(t.category)+'"></span>'+esc(t.category)+'</span></td>'
            +'<td>'+_pTag+'</td>'
            +'<td class="td-amount" style="'+amtColor+';font-size:15px;font-weight:700;letter-spacing:-.4px;">'+(t.currency==='USD'?'U$D ':'$')+fmtN(t.amount)+'</td>'
            +'<td style="padding:0 4px;white-space:nowrap;text-align:right;">'
              +'<button class="txn-edit-btn" data-id="'+t.id+'" title="Editar" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:12px;padding:4px 5px;border-radius:6px;opacity:.5;transition:opacity .13s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.5">✎</button>'
              +'<button class="txn-del-btn" data-id="'+t.id+'" title="Eliminar" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:13px;padding:4px 5px;border-radius:6px;opacity:.5;transition:opacity .13s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.5">✕</button>'
            +'</td>'
          +'</tr>';
        };
        if(!state._dupFilterOn) return displayTxns.map(buildRow).join('');
        // ── Dup mode: render groups with action rows ──
        window._dupGroups=[];
        const grpMap={},grpOrder=[];
        displayTxns.forEach(t=>{const k=txnDupKey(t);if(!grpMap[k]){grpMap[k]=[];grpOrder.push(k);}grpMap[k].push(t);});
        return grpOrder.map((k,gi)=>{
          const grp=grpMap[k];
          window._dupGroups.push(grp.map(t=>t.id));
          const amt=(grp[0].currency==='USD'?'U$D ':'$')+fmtN(grp[0].amount);
          return grp.map(buildRow).join('')
            +'<tr style="background:var(--surface2);"><td colspan="7" style="padding:7px 14px;border-top:1px solid var(--border);border-bottom:2px solid var(--border);">'
            +'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
            +'<span style="font-size:11px;color:var(--text3);">'+grp.length+' movimientos · '+amt+'</span>'
            +'<span style="flex:1;"></span>'
            +'<button onclick="resolveDupInline('+gi+',\'delete\')" style="font-size:11px;padding:5px 14px;border-radius:6px;border:1px solid rgba(240,96,96,0.4);background:rgba(240,96,96,0.1);color:#ff3b30;cursor:pointer;font-weight:700;white-space:nowrap;">🗑 Sí, es duplicado — borrar uno</button>'
            +'<button onclick="resolveDupInline('+gi+',\'keep\')" style="font-size:11px;padding:5px 14px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;font-weight:600;white-space:nowrap;">✓ No, son gastos distintos</button>'
            +'</div>'
            +'</td></tr>'
            +'<tr><td colspan="7" style="height:10px;background:var(--bg);"></td></tr>';
        }).join('');
      })()
      +'</tbody></table></div>';
  }

  // Event delegation
  wrap.onclick=function(e){
    const del=e.target.closest('.txn-del-btn');if(del){e.stopPropagation();deleteTxn(del.dataset.id);return;}
    const edit=e.target.closest('.txn-edit-btn');if(edit){e.stopPropagation();openEditTxnModal(edit.dataset.id);return;}
    const row=e.target.closest('[data-txnid]');
    if(row&&!e.target.closest('.cat-badge')&&!e.target.closest('.pay-tag')&&!e.target.closest('.sugerencia-badge')){
      openTxnDetail(row.dataset.txnid);
    }
  };

  if(mode!=='mes' && activeCycleMeta && !searchVal){
    const entries=getTxnCycleCommitmentEntries(mode, activeCycleMeta, searchVal, txns, todayRef);
    renderTxnCycleCommitmentsPanel(wrap, entries);

    if(mainEl && !searchVal){
      mainEl.textContent='$'+fmtN(grandTotal);
      if(arsEl) arsEl.textContent=arsTotal>0?'$'+fmtN(arsTotal):'—';
      if(usdEl) usdEl.textContent=usdTotal>0?'U$D '+fmtN(usdTotal):'—';
      if(detailEl){
        const baseParts=[periodoLabel||'Ciclo actual',`Mostrando ${txns.length} de ${state.transactions.length} movimientos`];
        if(cfv) baseParts.push(cfv);
        detailEl.textContent=baseParts.join(' · ');
      }
    }
  } else {
    document.getElementById('txn-cycle-commitments')?.remove();
  }
}

// ══ MULTI-SELECT ══
if(!state._selectedTxns) state._selectedTxns=new Set();

function toggleSelectTxn(id){
  if(!state._selectedTxns) state._selectedTxns=new Set();
  if(state._selectedTxns.has(id)) state._selectedTxns.delete(id);
  else state._selectedTxns.add(id);
  updateSelectBar();
  // Update checkbox visually
  const cb=document.querySelector('.txn-cb[data-id="'+id+'"]');
  if(cb) cb.checked=state._selectedTxns.has(id);
  // Update header checkbox
  updateHeaderCheckbox();
}

function toggleSelectAll(checked){
  if(!state._selectedTxns) state._selectedTxns=new Set();
  const allCbs=document.querySelectorAll('.txn-cb[data-id]');
  allCbs.forEach(cb=>{
    const id=cb.dataset.id;
    if(checked) state._selectedTxns.add(id);
    else state._selectedTxns.delete(id);
    cb.checked=checked;
  });
  updateSelectBar();
}

function updateHeaderCheckbox(){
  const hcb=document.querySelector('.txn-cb-header');
  if(!hcb)return;
  const allCbs=document.querySelectorAll('.txn-cb[data-id]');
  const allChecked=allCbs.length>0&&[...allCbs].every(cb=>cb.checked);
  hcb.checked=allChecked;
}

function clearSelection(){
  state._selectedTxns=new Set();
  document.querySelectorAll('.txn-cb').forEach(cb=>{cb.checked=false;});
  const hcb=document.querySelector('.txn-cb-header');
  if(hcb) hcb.checked=false;
  updateSelectBar();
}

function updateSelectBar(){
  const bar=document.getElementById('txn-select-bar');
  const count=document.getElementById('sb-count');
  if(!bar)return;
  const n=state._selectedTxns?state._selectedTxns.size:0;
  bar.classList.toggle('visible',n>0);
  if(count) count.textContent=n+' seleccionado'+(n!==1?'s':'');
}

function bulkCategorize(){
  const ids=[...state._selectedTxns];
  if(!ids.length)return;
  // Open a modal-style picker
  const picker=document.getElementById('cat-inline-picker');
  if(!picker)return;
  let html='<input class="cip-search" id="cip-search-input" placeholder="Buscar categoría..." oninput="filterCipList(this.value)" autocomplete="off">';
  html+='<div class="cip-list" id="cip-list-container">';
  CATEGORY_GROUPS.forEach(g=>{
    html+='<div class="cip-group" data-group="'+g.group+'">'+g.emoji+' '+g.group+'</div>';
    g.subs.forEach(sub=>{
      const c=g.color;
      html+='<div class="cip-item" data-sub="'+sub.toLowerCase()+'" data-group="'+g.group.toLowerCase()+'" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;cursor:pointer;transition:background .1s;"'
        +' onclick="applyBulkCategory(\''+sub+'\')"'
        +' onmouseover="this.style.background=\''+c+'12\'" onmouseout="this.style.background=\'\'">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+c+';flex-shrink:0;opacity:.5;"></span>'
        +'<span style="font-size:12px;font-weight:500;color:var(--text);flex:1;">'+sub+'</span>'
      +'</div>';
    });
  });
  html+='</div>';
  picker.innerHTML=html;
  picker.style.display='flex';
  // Center it
  picker.style.top='50%';picker.style.left='50%';picker.style.transform='translate(-50%,-50%)';
  picker.style.position='fixed';
  setTimeout(()=>{const si=document.getElementById('cip-search-input');if(si)si.focus();},50);
  setTimeout(()=>document.addEventListener('click',_closeCipOnOutside,{once:true}),10);
}

function applyBulkCategory(catName){
  const ids=[...state._selectedTxns];
  ids.forEach(id=>{
    const t=state.transactions.find(x=>x.id===id);
    if(t) t.category=catName;
  });
  const picker=document.getElementById('cat-inline-picker');
  if(picker)picker.style.display='none';
  clearSelection();
  saveState();refreshAll();
  showToast('✓ '+ids.length+' movimientos → '+catName,'success');
}

function bulkUncategorize(){
  const ids=[...state._selectedTxns];
  if(!ids.length)return;
  if(!confirm('¿Descategorizar '+ids.length+' movimiento'+(ids.length!==1?'s':'')+'?'))return;
  ids.forEach(id=>{
    const t=state.transactions.find(x=>x.id===id);
    if(t) t.category='';
  });
  clearSelection();
  saveState();refreshAll();
  showToast('↩ '+ids.length+' descategorizados','info');
}

function bulkDelete(){
  const ids=[...state._selectedTxns];
  if(!ids.length)return;
  if(!confirm('¿Eliminar '+ids.length+' movimiento'+(ids.length!==1?'s':'')+'? Esta acción no se puede deshacer.'))return;
  state.transactions=state.transactions.filter(t=>!ids.includes(t.id));
  clearSelection();
  saveState();refreshAll();
  showToast('✕ '+ids.length+' eliminados','info');
}

function bulkTag(){
  const ids=[...state._selectedTxns];
  if(!ids.length)return;
  window._bulkTagMode=true;
  document.getElementById('modal-pay-desc').textContent=ids.length+' movimientos seleccionados';
  document.getElementById('modal-pay-txn-id').value='';
  openModal('modal-pay-method');
}

function setEstadoFilter(k){
  // Si es duplicados, activar también el _dupFilterOn para que la tabla los muestre
  if(k==='duplicado_sospechoso'){
    state._dupFilterOn = true;
  } else {
    state._dupFilterOn = false;
  }
  state.txnEstadoFilter=k;
  renderTransactions();
}

function acceptTxnSuggestion(txnId){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  if(t.cat_sugerida){
    learnFromConfirmation(t,t.cat_sugerida);
    t.category=t.cat_sugerida;
    t.estado_revision='confirmado_por_usuario';
    saveState();renderTransactions();updateQrBadge();
    showToast('✓ '+t.cat_sugerida+' aplicada','success');
  }
}

// ══ PANEL DETALLE TRANSACCIÓN ══
function openTxnDetail(txnId){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  state._detailTxnId=txnId;
  const panel=document.getElementById('txn-detail-panel');
  if(!panel)return;

  const ESTADO_LABELS={
    detectado_automaticamente:'🤖 Detectado automáticamente',
    pendiente_de_revision:'⏳ Pendiente de revisión',
    confirmado_por_usuario:'✓ Confirmado',
    duplicado_sospechoso:'⊘ Posible duplicado',
  };
  const ORIGEN_LABELS={
    importado_desde_resumen:'📄 Resumen bancario',
    pegado_manualmente:'✎ Manual',
    paste:'✎ Pegado',
    importado_desde_gmail:'✉ Gmail',
  };

  const cc=catColor(t.category);
  const catLabel=t.category&&t.category!=='Procesando...'&&t.category!=='Uncategorized'
    ?catEmoji(t.category)+' '+t.category
    :'⏳ Pendiente de categoría';
  const catBadgeStyle=t.category&&t.category!=='Procesando...'&&t.category!=='Uncategorized'
    ?'background:'+cc+'18;border:1.5px solid '+cc+'44;color:'+cc
    :'background:var(--surface3);border:1.5px solid var(--border);color:var(--text3)';

  panel.innerHTML=`
    <div class="tdp-header">
      <div style="flex:1;">
        <div style="font-size:11px;color:var(--text3);font-family:var(--font);margin-bottom:5px;">${fmtDate(t.date)}</div>
        <div style="font-size:16px;font-weight:700;color:var(--text);line-height:1.3;margin-bottom:7px;font-family:var(--font);">${esc(t.description)}</div>
        <div class="tdp-amount-big${t.currency==='USD'?' usd':''}">${t.currency==='USD'?'U$D ':'$'}${fmtN(t.amount)}</div>
      </div>
      <button class="tdp-close" onclick="closeTxnDetail()">✕</button>
    </div>
    <div class="tdp-body">
      <!-- Category badge — click to change via inline picker -->
      <div class="tdp-section">
        <div class="tdp-section-label">Categoría</div>
        <button style="display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:14px;${catBadgeStyle};font-size:13px;font-weight:700;font-family:var(--font);cursor:pointer;transition:all .13s;" onclick="event.stopPropagation();openAssignModal('${txnId}',this)">
          ${catLabel} <span style="font-size:10px;opacity:.5;">✎</span>
        </button>
      </div>

      <!-- Info fields -->
      <div class="tdp-section">
        <div class="tdp-section-label">Información</div>
        ${t.comercio_detectado?'<div class="tdp-field"><div class="tdp-field-label">Comercio detectado</div><div class="tdp-field-value" style="font-weight:700;">'+esc(t.comercio_detectado)+'</div></div>':''}
        ${txnNoteText(t)?'<div class="tdp-field"><div class="tdp-field-label">Nota</div><div class="tdp-field-value">'+esc(txnNoteText(t))+'</div></div>':''}
        <div class="tdp-field"><div class="tdp-field-label">Origen</div><div class="tdp-field-value">${esc(ORIGEN_LABELS[t.origen_del_movimiento]||t.origen_del_movimiento||'—')}</div></div>
        <div class="tdp-field"><div class="tdp-field-label">Estado</div><div class="tdp-field-value">${esc(ESTADO_LABELS[t.estado_revision]||t.estado_revision||'—')}</div></div>
        ${t.payMethod?'<div class="tdp-field"><div class="tdp-field-label">Tag de pago</div><div class="tdp-field-value">'+({visa:'💳 Santander VISA',amex:'💳 Santander AMEX',deb:'🏦 Santander Débito',ef:'💵 Efectivo'}[t.payMethod]||t.payMethod)+'</div></div>':''}
      </div>

      <!-- Third-party / reimbursable -->
      <div class="tdp-section">
        <div class="tdp-section-label">Gasto de tercero</div>
        <label class="tdp-toggle-row" style="cursor:pointer;">
          <span style="font-size:12px;color:var(--text2);">Marcar como gasto de tercero</span>
          <input type="checkbox" class="tdp-toggle-cb" ${t.isThirdParty?'checked':''} onchange="toggleThirdParty('${txnId}',this.checked)">
        </label>
        <div id="tdp-tp-details-${txnId}" style="display:${t.isThirdParty?'block':'none'};margin-top:8px;">
          <div class="tdp-field" style="margin-bottom:6px;">
            <div class="tdp-field-label">Nota</div>
            <input type="text" class="tdp-tp-input" placeholder="Ej: Wifi de Caro" value="${esc(t.thirdPartyNote||'')}" onchange="setThirdPartyField('${txnId}','thirdPartyNote',this.value)">
          </div>
          <div class="tdp-field" style="margin-bottom:6px;">
            <div class="tdp-field-label">Monto a recuperar</div>
            <input type="number" class="tdp-tp-input" placeholder="${t.amount}" value="${t.thirdPartyAmount||''}" onchange="setThirdPartyField('${txnId}','thirdPartyAmount',parseFloat(this.value)||0)">
          </div>
          <div class="tdp-field" style="margin-bottom:6px;">
            <div class="tdp-field-label">Estado del reembolso</div>
            <select class="tdp-tp-input" onchange="setThirdPartyField('${txnId}','thirdPartyStatus',this.value)">
              <option value="pending" ${(t.thirdPartyStatus||'pending')==='pending'?'selected':''}>Pendiente de cobro</option>
              <option value="partial" ${t.thirdPartyStatus==='partial'?'selected':''}>Cobro parcial</option>
              <option value="settled" ${t.thirdPartyStatus==='settled'?'selected':''}>Cobrado</option>
            </select>
          </div>
          ${t.thirdPartyStatus==='partial'||t.thirdPartyStatus==='settled'?`
          <div class="tdp-field" style="margin-bottom:6px;">
            <div class="tdp-field-label">Monto cobrado</div>
            <input type="number" class="tdp-tp-input" value="${t.thirdPartySettledAmount||''}" placeholder="0" onchange="setThirdPartyField('${txnId}','thirdPartySettledAmount',parseFloat(this.value)||0)">
          </div>
          <div class="tdp-field" style="margin-bottom:6px;">
            <div class="tdp-field-label">Fecha de cobro</div>
            <input type="date" class="tdp-tp-input" value="${t.thirdPartySettledDate||''}" onchange="setThirdPartyField('${txnId}','thirdPartySettledDate',this.value)">
          </div>
          ${(state.savAccounts||[]).length?`
          <div class="tdp-field" style="margin-bottom:6px;">
            <div class="tdp-field-label">Cuenta destino</div>
            <select class="tdp-tp-input" onchange="setThirdPartyField('${txnId}','thirdPartyAccountId',this.value)">
              <option value="">— Sin asignar —</option>
              ${(state.savAccounts||[]).map(a=>'<option value="'+a.id+'" '+(t.thirdPartyAccountId===a.id?'selected':'')+'>'+esc((a.emoji||'')+' '+a.name)+'</option>').join('')}
            </select>
          </div>`:''}
          `:''}
        </div>
      </div>

      <!-- Actions -->
      <div class="tdp-section">
        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="openEditTxnModal('${txnId}');closeTxnDetail();">✎ Editar</button>
          <button class="btn btn-ghost btn-sm" style="flex:1;color:var(--danger);" onclick="if(confirm('¿Eliminar?')){deleteTxn('${txnId}');closeTxnDetail();}">✕ Eliminar</button>
        </div>
        ${t.comercio_detectado?'<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px;" onclick="openAddRuleFromTxn(\''+txnId+'\')">＋ Crear regla para "'+esc(t.comercio_detectado)+'"</button>':''}
      </div>
    </div>
  `;
  panel.classList.add('open');
  if(window.innerWidth<=768)_iosLock();
  // Marcar fila seleccionada
  document.querySelectorAll('.txn-row-v2').forEach(r=>r.classList.toggle('selected',r.dataset.txnid===txnId));
  setTimeout(()=>{ document.addEventListener('click', _closePanelsOnOutside); }, 50);
}

// ══ THIRD-PARTY / REIMBURSABLE ══
function toggleThirdParty(txnId,checked){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  t.isThirdParty=!!checked;
  if(checked){
    if(!t.thirdPartyStatus) t.thirdPartyStatus='pending';
    if(!t.thirdPartyAmount) t.thirdPartyAmount=t.amount;
  }
  saveState();
  openTxnDetail(txnId); // re-render panel to show/hide details
  renderTransactions();
  renderDashboard();
}
function setThirdPartyField(txnId,field,value){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  t[field]=value;
  saveState();
  // Re-render panel if status changed (shows/hides settled fields)
  if(field==='thirdPartyStatus') openTxnDetail(txnId);
  renderTransactions();
  renderDashboard();
}

function closeTxnDetail(){
  state._detailTxnId=null;
  const panel=document.getElementById('txn-detail-panel');
  if(panel&&panel.classList.contains('open')){
    panel.classList.remove('open');
    if(window.innerWidth<=768)_iosUnlock();
  }
  document.querySelectorAll('.txn-row-v2').forEach(r=>r.classList.remove('selected'));
  document.removeEventListener('click', _closePanelsOnOutside);
}

function setDetailCat(txnId, catName){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  t.category=catName;
  // Re-render cat buttons
  const sel=document.getElementById('tdp-cat-selector');
  if(sel) sel.querySelectorAll('.tdp-cat-btn').forEach(btn=>{
    const isSel=btn.textContent.trim()===catName;
    const c=state.categories.find(x=>x.name===catName);
    btn.classList.toggle('active',isSel);
    if(isSel&&c){btn.style.borderColor=c.color;btn.style.color=c.color;btn.style.background=c.color+'18';}
    else{btn.style.borderColor='';btn.style.color='';btn.style.background='';}
  });
  // Update cat dot in table row
  const row=document.querySelector('[data-txnid="'+txnId+'"]');
  if(row){
    const badge=row.querySelector('.cat-badge');
    if(badge)badge.innerHTML='<span class="cat-dot" style="background:'+catColor(catName)+'"></span>'+esc(catName)+' ✎';
    badge&&(badge.style.cssText=catStyle(catName)+';cursor:pointer;');
  }
}

function _closePanelsOnOutside(e){
  // Guard: if rules panel just re-rendered, the clicked element may no longer be in DOM
  // Use coordinates to check if click was within panel bounds
  const detailPanel = document.getElementById('txn-detail-panel');
  const rulesPanel  = document.getElementById('rules-panel');
  const catPicker = document.getElementById('cat-inline-picker');

  let clickedInsideDetail = detailPanel && detailPanel.contains(e.target);
  let clickedInsideRules  = rulesPanel  && rulesPanel.contains(e.target);
  let clickedInsidePicker = catPicker && catPicker.contains(e.target);

  // Fallback: check by bounding rect (handles re-rendered DOM)
  if(!clickedInsideRules && rulesPanel && rulesPanel.classList.contains('open')){
    const r=rulesPanel.getBoundingClientRect();
    if(e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom){
      clickedInsideRules=true;
    }
  }
  if(!clickedInsideDetail && detailPanel && detailPanel.classList.contains('open')){
    const r=detailPanel.getBoundingClientRect();
    if(e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom){
      clickedInsideDetail=true;
    }
  }

  if(!clickedInsideDetail && !clickedInsideRules && !clickedInsidePicker){
    if(detailPanel && detailPanel.classList.contains('open')) closeTxnDetail();
    if(rulesPanel  && rulesPanel.classList.contains('open'))  closeRulesPanel();
  }
}

function markAsNormal(txnId){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  t.estado_revision='confirmado_por_usuario';
  // Guardar en historial para que no vuelva a marcarse como duplicado automáticamente
  learnFromConfirmation(t, t.category);
  saveState();
  closeTxnDetail();
  renderTransactions();
  showToast('✓ Marcado como gasto normal','success');
}

function confirmTxnDetail(txnId){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  learnFromConfirmation(t,t.category);
  t.estado_revision='confirmado_por_usuario';
  const btn=document.getElementById('tdp-confirm-btn');
  if(btn){btn.textContent='✓ Confirmado';btn.classList.add('confirmed');}
  saveState();renderTransactions();updateQrBadge();
  showToast('✓ '+t.category+' confirmado','success');
}

function openAddRuleFromTxn(txnId){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  openRulesPanel();
  setTimeout(()=>{
    const kw=document.getElementById('rule-new-keyword');
    const cat=document.getElementById('rule-new-cat');
    if(kw)kw.value=t.comercio_detectado||t.description;
    if(cat)cat.value=t.category||'';
  },300);
}

// ══ EDIT TRANSACTION MODAL ══
function openEditTxnModal(txnId){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  state._editingTxnId=txnId;
  document.getElementById('modal-edit-desc').textContent='"'+t.description+'"';
  document.getElementById('modal-edit-description').value=t.description||'';
  document.getElementById('modal-edit-amount').value=t.amount||'';
  document.getElementById('modal-edit-currency').value=t.currency||'ARS';
  const _editDateStr=t.date?(t.date instanceof Date?t.date.toISOString():String(t.date)).slice(0,10):'';
  document.getElementById('modal-edit-date').value=_editDateStr;
  // Category select removed from edit modal
  openModal('modal-edit-txn');
}
function confirmEditTxn(){
  const id=state._editingTxnId;if(!id)return;
  const t=state.transactions.find(x=>x.id===id);if(!t)return;
  const desc=document.getElementById('modal-edit-description').value.trim();
  const amt=parseFloat(document.getElementById('modal-edit-amount').value);
  const cur=document.getElementById('modal-edit-currency').value;
  const date=document.getElementById('modal-edit-date').value;
  // const cat removed — category edited via badge
  if(!desc||isNaN(amt)||amt<=0){showToast('Completá todos los campos');return;}
  t.description=desc;t.amount=amt;t.currency=cur;
  if(date){t.date=date;t.month=date.slice(0,7);}
  // t.category preserved
  saveState();closeModal('modal-edit-txn');
  renderTransactions();renderDashboard();
  showToast('✓ Gasto actualizado');
}

function openEditMerchantModal(txnId){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  state._editingMerchantTxnId=txnId;
  document.getElementById('modal-edit-merchant-desc').textContent='"'+(t.description||'—')+'"';
  document.getElementById('modal-edit-merchant-name').value=t.comercio_detectado||'';
  openModal('modal-edit-merchant');
  setTimeout(()=>document.getElementById('modal-edit-merchant-name')?.focus(),80);
}
function confirmEditMerchant(){
  const id=state._editingMerchantTxnId;if(!id)return;
  const t=state.transactions.find(x=>x.id===id);if(!t)return;
  const merchant=document.getElementById('modal-edit-merchant-name').value.trim();
  t.comercio_detectado=merchant||null;
  t.estado_revision='confirmado_por_usuario';
  saveState();
  closeModal('modal-edit-merchant');
  renderTransactions();renderDashboard();
  if(state._detailTxnId===id) openTxnDetail(id);
  showToast('✓ Comercio actualizado','success');
}

function openEditNoteModal(txnId){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  state._editingNoteTxnId=txnId;
  document.getElementById('modal-edit-note-desc').textContent='"'+(t.description||'—')+'"';
  document.getElementById('modal-edit-note-text').value=t.notes||t.note||'';
  openModal('modal-edit-note');
  setTimeout(()=>document.getElementById('modal-edit-note-text')?.focus(),80);
}
function confirmEditNote(){
  const id=state._editingNoteTxnId;if(!id)return;
  const t=state.transactions.find(x=>x.id===id);if(!t)return;
  const note=document.getElementById('modal-edit-note-text').value.trim();
  t.notes=note;
  if('note' in t) t.note=note;
  if(!note){
    delete t.notes;
    if('note' in t) delete t.note;
  }
  t.estado_revision='confirmado_por_usuario';
  saveState();
  closeModal('modal-edit-note');
  renderTransactions();renderDashboard();
  if(state._detailTxnId===id) openTxnDetail(id);
  showToast(note?'✓ Nota guardada':'Nota eliminada','success');
}

// ══ ASSIGN MODAL ══
// ── Inline category picker (click on cat-badge in table) ──
function openAssignModal(txnId, anchorEl){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  state._assigningTxnId=txnId;
  const picker=document.getElementById('cat-inline-picker');
  if(!picker)return;
  picker.style.transform='none';
  picker.style.position='fixed';
  picker.style.zIndex='420';

  // Build: search + grouped list
  let html='<input class="cip-search" id="cip-search-input" placeholder="Buscar categoría..." oninput="filterCipList(this.value)" autocomplete="off">';
  html+='<div class="cip-list" id="cip-list-container">';
  CATEGORY_GROUPS.forEach(g=>{
    html+='<div class="cip-group" data-group="'+g.group+'">'+g.emoji+' '+g.group+'</div>';
    g.subs.forEach(sub=>{
      const sel=(sub===t.category);
      const c=g.color;
      html+='<div class="cip-item" data-sub="'+sub.toLowerCase()+'" data-group="'+g.group.toLowerCase()+'" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;cursor:pointer;transition:background .1s;'+(sel?'background:'+c+'18;':'')
        +'" onclick="confirmAssignInline(\''+txnId+'\',\''+sub+'\')"'
        +' onmouseover="this.style.background=\''+c+'12\'" onmouseout="this.style.background=\''+(sel?c+'18':'')+'\'">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+c+';flex-shrink:0;'+(sel?'box-shadow:0 0 0 2px '+c+'44;':'opacity:.5;')+'"></span>'
        +'<span style="font-size:12px;font-weight:'+(sel?'700':'500')+';color:'+(sel?c:'var(--text)')+';flex:1;">'+sub+'</span>'
        +(sel?'<span style="font-size:10px;color:'+c+';">✓</span>':'')
      +'</div>';
    });
  });
  html+='</div>';
  picker.innerHTML=html;

  picker.style.display='flex';
  const src2=anchorEl||document.querySelector('[onclick*="'+txnId+'"]');
  if(src2){
    const r=src2.getBoundingClientRect();
    let top=r.bottom+window.scrollY+6;
    let left=r.left+window.scrollX;
    if(left+320>window.innerWidth-12) left=window.innerWidth-332;
    if(top+420>window.scrollY+window.innerHeight-12) top=r.top+window.scrollY-420-6;
    picker.style.top=Math.max(12, top-window.scrollY)+'px';
    picker.style.left=Math.max(12, left)+'px';
  } else {
    picker.style.top='96px';
    picker.style.left='50%';
    picker.style.transform='translateX(-50%)';
  }
  // Focus search
  setTimeout(()=>{const si=document.getElementById('cip-search-input');if(si)si.focus();},50);
  setTimeout(()=>document.addEventListener('click',_closeCipOnOutside,{once:true}),10);
}
function filterCipList(val){
  const q=val.toLowerCase().trim();
  const container=document.getElementById('cip-list-container');if(!container)return;
  const items=container.querySelectorAll('.cip-item');
  const groups=container.querySelectorAll('.cip-group');
  const visibleGroups=new Set();
  items.forEach(el=>{
    const sub=el.dataset.sub||'';
    const grp=el.dataset.group||'';
    const show=!q||sub.includes(q)||grp.includes(q);
    el.style.display=show?'flex':'none';
    if(show)visibleGroups.add(grp);
  });
  groups.forEach(el=>{
    el.style.display=visibleGroups.has((el.dataset.group||'').toLowerCase())?'flex':'none';
  });
}
function _closeCipOnOutside(e){
  const p=document.getElementById('cat-inline-picker');
  if(p&&!p.contains(e.target)){
    p.style.display='none';
    p.style.transform='none';
  }
}
// confirmAssign removed — legacy, modal-assign-cat element no longer exists
function confirmAssignInline(txnId, catName){
  const t=state.transactions.find(x=>x.id===txnId);
  if(t){
    t.category=catName;
    t.estado_revision='confirmado_por_usuario';
    learnFromConfirmation(t, catName);
    saveState();refreshAll();
    updateQrBadge();
    const picker=document.getElementById('cat-inline-picker');
    if(picker){
      picker.style.display='none';
      picker.style.transform='none';
    }
    if(state._detailTxnId===txnId) openTxnDetail(txnId);
    showToast('✓ '+catName,'success');
  }
}

// ══ SMART DUPLICATE REVIEW ══
// Tracks groups the user dismissed ("not a duplicate")
window._dupDismissedGroups = window._dupDismissedGroups || new Set();

function showDuplicatesModal(){
  const allGroups = findDuplicateGroups();
  const groups = allGroups.filter(function(g){
    var key = g.map(function(t){ return t.id; }).sort().join('|');
    return !window._dupDismissedGroups.has(key);
  });

  var sub  = document.getElementById('dupe-modal-sub');
  var body = document.getElementById('dupe-modal-body');
  var foot = document.getElementById('dupe-delete-btn');

  if(!groups.length){
    sub.textContent = allGroups.length ? 'Revisaste todos los grupos' : 'Sin movimientos con el mismo monto';
    body.innerHTML = '';
    var doneWrap = document.createElement('div');
    doneWrap.style.cssText = 'text-align:center;padding:48px 20px;';
    doneWrap.innerHTML = '<div style="font-size:32px;margin-bottom:12px;">&#10003;</div><div style="font-size:14px;font-weight:700;color:var(--accent);">Todo revisado</div><div style="font-size:11px;color:var(--text3);margin-top:6px;font-family:var(--font);">No hay grupos pendientes</div>';
    body.appendChild(doneWrap);
    if(foot) foot.style.display='none';
    openModal('modal-duplicates');
    return;
  }

  sub.textContent = groups.length + ' grupo' + (groups.length>1?'s':'') + ' con el mismo monto';
  if(foot){ foot.style.display='block'; foot.textContent = groups.length + ' grupo' + (groups.length>1?'s':'') + ' por revisar'; }

  body.innerHTML = '';

  groups.forEach(function(grp, gi){
    var gKey = grp.map(function(t){ return t.id; }).sort().join('|');
    var amtStr = (grp[0].currency==='ARS' ? '$' : 'U$D ') + fmtN(grp[0].amount);

    // ── Contenedor del grupo ──
    var grpEl = document.createElement('div');
    grpEl.id = 'dupgrp-' + gi;
    grpEl.style.cssText = 'border:1px solid var(--border2);border-radius:14px;overflow:hidden;margin-bottom:4px;';

    // ── Header del grupo ──
    var hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px;background:var(--surface3);border-bottom:1px solid var(--border2);';

    var hdrLeft = document.createElement('div');
    hdrLeft.style.cssText = 'display:flex;align-items:center;gap:12px;';
    var hdrAmt = document.createElement('div');
    hdrAmt.style.cssText = 'font-size:18px;font-weight:700;letter-spacing:-0.02em;font-family:var(--font);color:var(--accent);';
    hdrAmt.textContent = amtStr;
    var hdrCount = document.createElement('div');
    hdrCount.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:.05em;color:var(--text3);text-transform:uppercase;font-family:var(--font);background:var(--surface2);padding:3px 8px;border-radius:6px;border:1px solid var(--border);';
    hdrCount.textContent = grp.length + ' mov.';
    hdrLeft.appendChild(hdrAmt);
    hdrLeft.appendChild(hdrCount);

    var hdrRight = document.createElement('div');
    hdrRight.style.cssText = 'display:flex;gap:7px;flex-shrink:0;';

    var btnDejar = document.createElement('button');
    btnDejar.textContent = '🗑 Dejar 1 solo';
    btnDejar.title = 'Mantiene el primero, borra el resto';
    btnDejar.style.cssText = 'font-size:11px;padding:5px 12px;border-radius:6px;border:1px solid rgba(240,96,96,0.4);background:rgba(240,96,96,0.1);color:#ff3b30;cursor:pointer;font-weight:700;';
    btnDejar.addEventListener('click', (function(key, group){ return function(){ dupGroupAction('delAll', key, group); }; })(gKey, grp));

    var btnDismiss = document.createElement('button');
    btnDismiss.textContent = '✓ No son dup.';
    btnDismiss.title = 'Son gastos distintos, no tocar';
    btnDismiss.style.cssText = 'font-size:11px;padding:5px 12px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text2);cursor:pointer;font-weight:600;';
    btnDismiss.addEventListener('click', (function(key){ return function(){ dupGroupAction('dismiss', key); }; })(gKey));

    hdrRight.appendChild(btnDejar);
    hdrRight.appendChild(btnDismiss);
    hdr.appendChild(hdrLeft);
    hdr.appendChild(hdrRight);
    grpEl.appendChild(hdr);

    // ── Tarjetas de cada transacción (layout vertical, cada una completa) ──
    grp.forEach(function(t, ti){
      var dateObj = t.date instanceof Date ? t.date : new Date(t.date);
      var dateStr = dateObj.toLocaleDateString('es-AR',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
      var catC = catColor(t.category||'Otros');
      var srcIcon = t.source==='gmail' ? '📧' : (t.source==='csv' ? '📄' : '✏');
      var srcText = t.source==='gmail' ? 'Gmail' : (t.source==='csv' ? 'CSV' : 'Manual');

      var card = document.createElement('div');
      card.id = 'duprow-' + t.id;
      card.style.cssText = 'padding:12px 16px;' + (ti > 0 ? 'border-top:1px solid var(--border);' : '') + (ti%2===1 ? 'background:rgba(255,255,255,0.02);' : '');

      // ── Row 1: Badge + Descripción (full width) ──
      var topRow = document.createElement('div');
      topRow.style.cssText = 'display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;';

      var numBadge = document.createElement('div');
      numBadge.style.cssText = 'flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--surface3);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--text2);font-family:var(--font);margin-top:1px;';
      numBadge.textContent = ti + 1;

      var descEl = document.createElement('div');
      descEl.style.cssText = 'flex:1;font-size:14px;font-weight:700;color:var(--text);line-height:1.35;word-break:break-word;min-width:0;';
      descEl.textContent = t.description || '—';

      topRow.appendChild(numBadge);
      topRow.appendChild(descEl);

      // ── Row 2: Metadata chips (fecha, categoría, fuente, cuenta) ──
      var metaRow = document.createElement('div');
      metaRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-left:32px;margin-bottom:8px;';

      var dateChip = document.createElement('span');
      dateChip.style.cssText = 'font-size:11px;color:var(--text2);font-family:var(--font);padding:2px 8px;border-radius:6px;background:var(--surface3);border:1px solid var(--border);display:inline-flex;align-items:center;gap:4px;';
      dateChip.textContent = '📅 ' + dateStr;
      metaRow.appendChild(dateChip);

      var catChip = document.createElement('span');
      catChip.style.cssText = 'font-size:11px;padding:2px 8px;border-radius:6px;font-weight:700;background:' + catC + '18;border:1px solid ' + catC + '33;color:' + catC + ';';
      catChip.textContent = t.category || '—';
      metaRow.appendChild(catChip);

      var srcChip = document.createElement('span');
      srcChip.style.cssText = 'font-size:10px;color:var(--text3);font-family:var(--font);padding:2px 7px;border-radius:6px;background:var(--surface2);border:1px solid var(--border);';
      srcChip.textContent = srcIcon + ' ' + srcText;
      metaRow.appendChild(srcChip);

      if(t.account){
        var accChip = document.createElement('span');
        accChip.style.cssText = 'font-size:10px;color:var(--text3);font-family:var(--font);padding:2px 7px;border-radius:6px;background:var(--surface2);border:1px solid var(--border);';
        accChip.textContent = '💳 ' + t.account;
        metaRow.appendChild(accChip);
      }

      // ── Row 3: Botones de acción ──
      var actRow = document.createElement('div');
      actRow.style.cssText = 'display:flex;gap:8px;margin-left:32px;';

      var btnDel = document.createElement('button');
      btnDel.textContent = '🗑 Eliminar este';
      btnDel.style.cssText = 'font-size:11px;padding:5px 14px;border-radius:6px;border:1px solid rgba(240,96,96,0.4);background:rgba(240,96,96,0.08);color:#ff3b30;cursor:pointer;font-weight:700;';
      btnDel.addEventListener('click', (function(id, key){ return function(){ dupAction('del', id, key); }; })(t.id, gKey));

      var btnEdit = document.createElement('button');
      btnEdit.textContent = '✏ Editar';
      btnEdit.style.cssText = 'font-size:11px;padding:5px 14px;border-radius:6px;border:1px solid var(--border);background:var(--surface3);color:var(--text2);cursor:pointer;font-weight:600;';
      btnEdit.addEventListener('click', (function(id, key){ return function(){ dupAction('edit', id, key); }; })(t.id, gKey));

      actRow.appendChild(btnDel);
      actRow.appendChild(btnEdit);

      card.appendChild(topRow);
      card.appendChild(metaRow);
      card.appendChild(actRow);
      grpEl.appendChild(card);
    });

    body.appendChild(grpEl);
  });

  openModal('modal-duplicates');
}


function dupGroupAction(action, gKey, grpArray){
  if(action==='dismiss'){
    window._dupDismissedGroups.add(gKey);
    _dupRefreshModal();
  } else if(action==='delAll'){
    // Keep first (index 0), delete the rest
    var toDelete = new Set();
    for(var i=1; i<grpArray.length; i++) toDelete.add(String(grpArray[i].id));
    state.transactions = state.transactions.filter(function(t){ return !toDelete.has(String(t.id)); });
    saveState(); renderTransactions(); renderDashboard();
    showToast('Duplicado' + (toDelete.size!==1?'s':'') + ' eliminado' + (toDelete.size!==1?'s':'') + ' (' + toDelete.size + ')', 'success');
    _dupRefreshModal();
  }
}

function dupAction(action, txnId, gKey){
  if(action==='delete'||action==='del'){
    state.transactions = state.transactions.filter(t=>t.id!==txnId);
    saveState(); renderTransactions(); renderDashboard();
    const row=document.getElementById('duprow-'+txnId);
    if(row){
      row.style.transition='opacity .2s, max-height .3s';row.style.opacity='0';row.style.maxHeight='0';row.style.overflow='hidden';row.style.padding='0 16px';
      setTimeout(()=>{ row.remove(); _dupCheckGroupEmpty(); },300);
    }
    showToast('🗑 Eliminado','success');
  } else if(action==='edit'){
    closeModal('modal-duplicates');
    openEditTxnModal(txnId);
  }
}

function _dupCheckGroupEmpty(){
  document.querySelectorAll('[id^="dupgrp-"]').forEach(grpEl=>{
    if(!grpEl.querySelectorAll('[id^="duprow-"]').length){
      grpEl.style.transition='opacity .2s';grpEl.style.opacity='0';
      setTimeout(()=>{ grpEl.remove(); _dupUpdateFooter(); },220);
    }
  });
  _dupUpdateFooter();
}

function _dupUpdateFooter(){
  const remaining=document.querySelectorAll('[id^="dupgrp-"]').length;
  const foot=document.getElementById('dupe-delete-btn');
  const sub=document.getElementById('dupe-modal-sub');
  if(!remaining){
    document.getElementById('dupe-modal-body').innerHTML='<div style="text-align:center;padding:48px 20px;"><div style="font-size:28px;margin-bottom:10px;">✓</div><div style="font-size:14px;font-weight:700;color:var(--accent);">¡Todo revisado!</div></div>';
    if(sub)sub.textContent='✓ Sin grupos pendientes';
    if(foot)foot.style.display='none';
  } else {
    if(foot){foot.style.display='block';foot.textContent=remaining+' grupo'+(remaining!==1?'s':'')+' por revisar';}
  }
}

function _dupRefreshModal(){ showDuplicatesModal(); }

function confirmDeleteDuplicates(){ showDuplicatesModal(); }
function confirmDeleteDupes(){ showDuplicatesModal(); }

// ── Nuevo gasto desde Movimientos ──
function openNewExpenseModal(){
  document.getElementById('ne-desc').value='';
  document.getElementById('ne-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('ne-amount').value='';
  document.getElementById('ne-method').value='ef';
  const catSel=document.getElementById('ne-cat');
  let opts='';CATEGORY_GROUPS.forEach(g=>{opts+='<optgroup label="'+g.group+'">';g.subs.forEach(s=>{opts+='<option value="'+s+'">'+s+'</option>';});opts+='</optgroup>';});
  catSel.innerHTML=opts;
  openModal('modal-new-expense');
  setTimeout(()=>document.getElementById('ne-desc').focus(),100);
}
function saveNewExpense(){
  const desc=document.getElementById('ne-desc').value.trim();
  const dateVal=document.getElementById('ne-date').value;
  const amountVal=parseFloat(document.getElementById('ne-amount').value)||0;
  const method=document.getElementById('ne-method').value;
  const cat=document.getElementById('ne-cat').value;
  if(!desc){showToast('Ingresa una descripcion','error');return;}
  if(!dateVal){showToast('Ingresa una fecha','error');return;}
  if(!amountVal||amountVal<=0){showToast('Ingresa un monto valido','error');return;}
  const payMethodMap={ef:'ef',deb:'deb',tc:'tc',usd:'ef'};
  const currency=method==='usd'?'USD':'ARS';
  const date=new Date(dateVal+'T12:00:00');
  const id=Math.random().toString(36).substr(2,9);
  const txn={id,date,description:desc,amount:amountVal,currency,category:cat,
    payMethod:payMethodMap[method]||'ef',week:getWeekKey(date),month:getMonthKey(date),manual:true};
  state.transactions.push(txn);
  let manualImp=state.imports.find(i=>i.id==='manual');
  if(!manualImp){manualImp={id:'manual',label:'Gastos manuales',date:new Date().toLocaleDateString('es-AR'),count:0,source:'manual',txnIds:[]};state.imports.unshift(manualImp);}
  manualImp.txnIds.push(id);manualImp.count=manualImp.txnIds.length;
  saveState();refreshAll();
  closeModal('modal-new-expense');
  showToast('Gasto agregado: '+desc,'success');
}
