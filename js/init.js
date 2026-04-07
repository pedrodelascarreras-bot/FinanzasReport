// ══ TC CONFIG ══
function openTcConfig(){
  // Redirect to Credit Cards page (TC config is now inline there)
  nav('credit-cards');
  // Auto-open the TC config section
  setTimeout(()=>{
    const body=document.getElementById('cc-tc-config-body');
    const arrow=document.getElementById('cc-tc-config-arrow');
    if(body)body.style.display='block';
    if(arrow)arrow.textContent='▾';
  },100);
}
function openTcConfigModal(){ openTcConfig(); }

// ══ TC CYCLE SYSTEM ══

// state.tcCycles = [{id, label, closeDate:'YYYY-MM-DD'}] sorted desc by closeDate
// Derived: openDate = day after previous cycle's closeDate (or closeDate - ~30d if first)

function getTcCycles(){
  return (state.tcCycles||[]).slice().sort((a,b)=>b.closeDate.localeCompare(a.closeDate));
}

function getTcCycleOpen(cycles, idx){
  // cycles is sorted DESC. idx is position in that desc array.
  // Open = day after previous cycle's close (in asc order).
  if(idx<0||idx>=cycles.length)return null;
  const sorted=[...cycles].sort((a,b)=>a.closeDate.localeCompare(b.closeDate)); // asc
  const ascIdx=sorted.findIndex(c=>c.id===cycles[idx].id);
  if(ascIdx===0){
    // First ever cycle: open = closeDate - 30 days
    const d=new Date(sorted[0].closeDate+'T12:00:00');
    d.setDate(d.getDate()-30);
    return dateToYMD(d);
  }
  const prevClose=sorted[ascIdx-1].closeDate;
  const d=new Date(prevClose+'T12:00:00');
  d.setDate(d.getDate()+1);
  return dateToYMD(d);
}

function getTcCycleForDate(dateStr){
  const cycles=getTcCycles();
  const sorted=[...cycles].sort((a,b)=>a.closeDate.localeCompare(b.closeDate));
  for(let i=0;i<sorted.length;i++){
    const open=getTcCycleOpen(cycles,cycles.findIndex(c=>c.id===sorted[i].id));
    const close=sorted[i].closeDate;
    if(dateStr>=open&&dateStr<=close) return sorted[i];
  }
  return null;
}

function dateToYMD(d){
  // Safe conversion of any date value (Date object or string) to 'YYYY-MM-DD'
  const dt=d instanceof Date?d:new Date(d);
  return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
}

function getTcCycleTxns(cycle, cyclesArg){
  if(!cycle)return[];
  const cycles=cyclesArg||getTcCycles();
  const idx=cycles.findIndex(c=>c.id===cycle.id);
  if(idx<0)return[];
  const open=getTcCycleOpen(cycles,idx);
  if(!open)return[];
  return state.transactions.filter(t=>{
    const d=dateToYMD(t.date);
    return d>=open&&d<=cycle.closeDate;
  });
}

function addTcCycle(){
  const label=document.getElementById('tc-cycle-label').value.trim();
  const closeDate=document.getElementById('tc-cycle-close').value;
  const dueDate=document.getElementById('tc-cycle-due')?document.getElementById('tc-cycle-due').value:'';
  if(!label||!closeDate){showToast('⚠️ Completá nombre y fecha de cierre','error');return;}
  if(!state.tcCycles)state.tcCycles=[];
  // Check for duplicate closeDate
  if(state.tcCycles.find(c=>c.closeDate===closeDate)){showToast('⚠️ Ya existe un ciclo con esa fecha de cierre','error');return;}
  const id='tc_'+Date.now().toString(36);
  state.tcCycles.push({id,label,closeDate,dueDate});
  saveState();
  renderTcCycleList();
  showToast('✓ Ciclo agregado: '+label,'success');
  document.getElementById('tc-cycle-label').value='';
  document.getElementById('tc-cycle-close').value='';
  if(document.getElementById('tc-cycle-due'))document.getElementById('tc-cycle-due').value='';
}
// Removed duplicate function
function addTcCycleFromCC(){
  const labelEl=document.getElementById('tc-cycle-label-cc');
  const closeEl=document.getElementById('tc-cycle-close-cc');
  const dueEl=document.getElementById('tc-cycle-due-cc');
  const label=(labelEl?labelEl.value:'').trim();
  const closeDate=(closeEl?closeEl.value:'');
  const dueDate=(dueEl?dueEl.value:'');
  if(!label||!closeDate){showToast('⚠️ Completá nombre y fecha de cierre','error');return;}
  if(!state.tcCycles)state.tcCycles=[];
  if(state.tcCycles.find(c=>c.closeDate===closeDate)){showToast('⚠️ Ya existe un ciclo con esa fecha de cierre','error');return;}
  const id='tc_'+Date.now().toString(36);
  state.tcCycles.push({id,label,closeDate,dueDate});
  saveState();
  renderCcTcConfig();
  if(typeof renderCcConfigPanel==='function') renderCcConfigPanel();
  showToast('✓ Ciclo agregado: '+label,'success');
  if(labelEl)labelEl.value='';
  if(closeEl)closeEl.value='';
  if(dueEl)dueEl.value='';
}

function deleteTcCycle(id){
  if(!confirm('¿Eliminar este ciclo?'))return;
  state.tcCycles=(state.tcCycles||[]).filter(c=>c.id!==id);
  saveState();
  renderTcCycleList();
  renderCcTcConfig();
  if(typeof renderCcConfigPanel==='function') renderCcConfigPanel();
  if(state.dashView==='tc')renderDashboard();
  showToast('Ciclo eliminado','info');
}

function renderTcCycleList(){
  const el=document.getElementById('tc-cycle-list');if(!el)return;
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

function saveTcConfig(){
  // Legacy — now just closes modal
  saveState();closeModal('modal-tc-config');
  showToast('✓ Ciclos guardados','success');
}

// ── Calcular rango del ciclo activo ──
function getTcCycleRange(){
  const{closeDay}=state.tcConfig;if(!closeDay)return null;
  const today=new Date();const y=today.getFullYear(),m=today.getMonth(),d=today.getDate();
  let cycleStart,cycleEnd;
  if(d>closeDay){
    // Estamos después del cierre: ciclo empezó closeDay+1 este mes
    cycleStart=new Date(y,m,closeDay+1);
    cycleEnd=new Date(y,m+1,closeDay);
  } else {
    // Estamos antes del cierre: ciclo empezó closeDay+1 mes pasado
    cycleStart=new Date(y,m-1,closeDay+1);
    cycleEnd=new Date(y,m,closeDay);
  }
  cycleStart.setHours(0,0,0,0);cycleEnd.setHours(23,59,59,999);
  return{start:cycleStart,end:cycleEnd};
}

function renderTcDashboard(){
  // When dashView='tc', renderDashboard calls this to swap the period selector
  // and update all KPIs using the active TC cycle instead of calendar month
  const cycles=getTcCycles();
  const sel=document.getElementById('dash-month-select');
  if(sel){
    const curVal=state.dashTcCycle||'';
    sel.innerHTML='<option value="">Ciclo actual</option>'+cycles.map(c=>{
      return'<option value="'+c.id+'" '+(c.id===curVal?'selected':'')+'>'+esc(c.label)+'</option>';
    }).join('');
  }
}
function renderMixBar(){}
function openPayMethodModal(txnId){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  window._bulkTagMode=false;
  state._assigningTxnId=txnId;
  document.getElementById('modal-pay-txn-id').value=txnId;
  document.getElementById('modal-pay-desc').textContent='"'+t.description+'" — $'+fmtN(t.amount);
  openModal('modal-pay-method');
}
function setPayMethod(method){
  if(window._bulkTagMode){
    window._bulkTagMode=false;
    const ids=[...state._selectedTxns];
    ids.forEach(id=>{const t=state.transactions.find(x=>x.id===id);if(t)t.payMethod=method;});
    clearSelection();saveState();refreshAll();
    const lbl={visa:'Santander VISA',amex:'Santander AMEX',deb:'Santander Débito',ef:'Efectivo'}[method]||method;
    showToast('✓ "'+lbl+'" aplicado a '+ids.length+' movimientos','success');
  } else {
    const id=document.getElementById('modal-pay-txn-id').value;
    const t=state.transactions.find(x=>x.id===id);
    if(t){t.payMethod=method;saveState();showToast('✓ Tag actualizado','success');refreshAll();}
  }
  closeModal('modal-pay-method');
}

// ══ INIT ══
window.addEventListener('DOMContentLoaded',()=>{
  loadState();
  ensureActiveUserProfileBootstrap();
  ensureGmailImportRules();
  state.gmailClientId = getGmailClientId();
  localStorage.setItem('fin_gmail_client_id', state.gmailClientId);
  // One-time cleanup: remove any "Cuota X de Y" standalone entries from old imports
  if(state.transactions.length) deduplicateTransactions();
  loadTheme();
  loadColorTheme();
  loadSidebar();
  updateUsdRateUI();
  setChartMode(state.chartMode||'bars');
  setTxnFilterMode(state.txnFilterMode||'mes');
  if(state.transactions.length){updateSidebarStats();renderDashboard();renderTransactions();document.getElementById('dash-empty').style.display='none';document.getElementById('dash-content').style.display='flex';setTimeout(()=>applyLayout('dashboard'),0);}
  if(typeof enforceMobilePagePreferences === 'function') enforceMobilePagePreferences();
  if(!getApiKey()){/* API Key now always visible in sidebar IA section */}
  fetchUsdRate();
  // Daily briefing — shows once per day when data exists
  if(typeof initSplash === 'function') initSplash();
});

// ══ MANUAL EXPENSE ══
function toggleManualForm(){
  const body=document.getElementById('manual-form-body');
  const btn=document.getElementById('manual-form-toggle');
  const open=body.style.display==='none';
  body.style.display=open?'block':'none';
  btn.textContent=open?'✕ Cerrar':'+ Nuevo gasto';
  if(open){
    // Set today as default date
    document.getElementById('mf-date').value=new Date().toISOString().split('T')[0];
    // Populate category select
    const catSel=document.getElementById('mf-cat');
    let mfOpts='';CATEGORY_GROUPS.forEach(g=>{mfOpts+='<optgroup label="'+g.emoji+' '+g.group+'">';g.subs.forEach(s=>{mfOpts+='<option value="'+s+'">'+s+'</option>';});mfOpts+='</optgroup>';});catSel.innerHTML=mfOpts;
    document.getElementById('mf-desc').focus();
  }
}

function saveManualExpense(){
  const desc=document.getElementById('mf-desc').value.trim();
  const dateVal=document.getElementById('mf-date').value;
  const amountVal=parseFloat(document.getElementById('mf-amount').value)||0;
  const method=document.getElementById('mf-method').value;
  const cat=document.getElementById('mf-cat').value;
  if(!desc){showToast('⚠️ Ingresá una descripción','error');return;}
  if(!dateVal){showToast('⚠️ Ingresá una fecha','error');return;}
  if(!amountVal||amountVal<=0){showToast('⚠️ Ingresá un monto válido','error');return;}
  const currency=method==='usd'?'USD':'ARS';
  const date=new Date(dateVal+'T12:00:00');
  const id=Math.random().toString(36).substr(2,9);
  // payMethod: 'usd' → 'ef' (efectivo en dólares), rest kept as-is
  const payMethodKey=method==='usd'?'ef':method;
  const txn={id,date,description:desc,amount:amountVal,currency,category:cat,
    payMethod:payMethodKey,week:getWeekKey(date),month:getMonthKey(date),manual:true,
    origen_del_movimiento:'pegado_manualmente',
    ownerProfileId:state.activeUserProfileId||'default-profile'};
  state.transactions.push(txn);
  // Add to a "manual" import entry or create one
  let manualImp=state.imports.find(i=>i.id==='manual');
  if(!manualImp){
    manualImp={id:'manual',label:'Gastos manuales',date:new Date().toLocaleDateString('es-AR'),count:0,source:'manual',txnIds:[]};
    state.imports.unshift(manualImp);
  }
  manualImp.txnIds.push(id);
  manualImp.count=manualImp.txnIds.length;
  saveState();
  refreshAll();
  showToast('✓ Gasto agregado: '+desc,'success');
  // Reset form
  document.getElementById('mf-desc').value='';
  document.getElementById('mf-amount').value='';
  document.getElementById('mf-date').value=new Date().toISOString().split('T')[0];
}

// ══ BACKUP / RESTORE ══
function exportBackupJSON(){
  try{
    const now=new Date();
    const data=JSON.stringify({
      _backup:true,_version:1,_date:now.toISOString(),
      state:JSON.parse(localStorage.getItem('fin_state')||'{}')
    },null,2);
    const blob=new Blob([data],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    const dateStr=now.toLocaleDateString('es-AR').replace(/\//g,'-');
    a.href=url;a.download='finanzas-backup-'+dateStr+'.json';
    a.click();URL.revokeObjectURL(url);
    localStorage.setItem('fin_last_backup',now.toISOString());
    updateLastBackupLabel();
    showToast('✓ Backup exportado','success');
  }catch(e){showToast('Error al exportar backup','error');console.error(e);}
}
function updateLastBackupLabel(){
  const el=document.getElementById('last-backup-label');if(!el)return;
  const raw=localStorage.getItem('fin_last_backup');
  if(!raw){el.textContent='Sin backup guardado';return;}
  const d=new Date(raw);
  const now=new Date();
  const diffDays=Math.floor((now-d)/86400000);
  const timeStr=d.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit'});
  const ageStr=diffDays===0?'hoy':diffDays===1?'ayer':diffDays+'d atrás';
  el.textContent='Último: '+timeStr+' ('+ageStr+')';
  el.style.color=diffDays>7?'var(--accent3)':diffDays>30?'var(--danger)':'var(--text3)';
}

function importBackupJSON(event){
  const file=event.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(!data._backup){showToast('⚠️ Archivo no válido','error');return;}
      if(!confirm('¿Restaurar backup del '+new Date(data._date).toLocaleDateString('es-AR')+'? Se reemplazarán todos los datos actuales.')){return;}
      localStorage.setItem('fin_state',JSON.stringify(data.state));
      loadState();
      saveState();
      refreshAll();
      showToast('✓ Backup restaurado correctamente','success');
    }catch(err){showToast('Error al restaurar backup','error');console.error(err);}
  };
  reader.readAsText(file);
  event.target.value='';
}

// ══ DRIVE STATUS BANNER ══
function renderDriveStatusBanner() {
  const el = document.getElementById('drive-status-banner');
  if (!el) return;
  if (driveReady && driveAccessToken) {
    el.style.cssText = 'border-radius:8px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:rgba(100,220,100,0.07);border:1px solid rgba(100,220,100,0.25);';
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:20px;">☁️</span>
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--accent);">Google Drive conectado ✓</div>
          <div style="font-size:11px;color:var(--text3);font-family:var(--font);margin-top:2px;">Tus datos se sincronizan automáticamente. Si borrás el historial del navegador, se recuperan al reconectar.</div>
        </div>
      </div>`;
  } else {
    el.style.cssText = 'border-radius:8px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:rgba(240,200,60,0.07);border:1px solid rgba(240,200,60,0.3);';
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:20px;">⚠️</span>
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--accent3);">Google Drive no conectado</div>
          <div style="font-size:11px;color:var(--text3);font-family:var(--font);margin-top:2px;">Tus datos solo están en este navegador. Si borrás el historial, se pierden. Conectá Drive para tener respaldo automático en la nube.</div>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" style="flex-shrink:0;" onclick="initDriveClient(true)">Conectar Drive</button>`;
  }
}

// ══ HISTORIAL DE BACKUPS ══
function renderBackupHistory() {
  const el = document.getElementById('backup-history-list');
  if (!el) return;
  const raw = localStorage.getItem('fin_backup_history');
  let history = [];
  try { history = raw ? JSON.parse(raw) : []; } catch(e) { history = []; }
  const legacy = localStorage.getItem('fin_last_backup');
  if (legacy && !history.find(h => h.date === legacy)) {
    history.unshift({ date: legacy, type: 'manual', size: '—' });
  }
  if (!history.length) {
    el.innerHTML = '<div style="color:var(--text3);font-size:11px;padding:4px 0;">Aún no hay backups registrados. Te recomendamos hacer uno ahora.</div>';
    return;
  }
  el.innerHTML = history.slice(0, 5).map(h => {
    const d = new Date(h.date);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    const ageStr = diffDays === 0 ? 'hoy' : diffDays === 1 ? 'ayer' : diffDays + 'd atrás';
    const color = diffDays > 30 ? 'var(--danger)' : diffDays > 7 ? 'var(--accent3)' : 'var(--accent)';
    const typeLabel = h.type === 'csv' ? '📊 CSV' : h.type === 'drive' ? '☁️ Drive' : '💾 Manual';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);gap:12px;">
      <span>${typeLabel}</span>
      <span>${d.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit'})} ${d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</span>
      <span style="color:${color}">${ageStr}</span>
    </div>`;
  }).join('');
}

function registrarBackupEnHistorial(tipo) {
  const raw = localStorage.getItem('fin_backup_history');
  let history = [];
  try { history = raw ? JSON.parse(raw) : []; } catch(e) { history = []; }
  history.unshift({ date: new Date().toISOString(), type: tipo });
  localStorage.setItem('fin_backup_history', JSON.stringify(history.slice(0, 20)));
  localStorage.setItem('fin_last_backup', new Date().toISOString());
  updateLastBackupLabel();
  renderBackupHistory();
}

function updateCSVExportCount() {
  const el = document.getElementById('csv-export-count');
  if (!el) return;
  const n = (state.transactions || []).length;
  el.textContent = n === 0 ? 'Sin movimientos cargados' : n + ' movimiento' + (n !== 1 ? 's' : '') + ' para exportar';
}

// ══════════════════════════════════════════════════════════
// GMAIL INTEGRATION — configurable auto-import
// ══════════════════════════════════════════════════════════
const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
const GMAIL_SENDER = 'mensajesyavisos@mails.santander.com.ar';
const DEFAULT_GOOGLE_CLIENT_ID = '1074091090601-7t3s8snviodd5ec66vdefe7inmiqr15n.apps.googleusercontent.com';
let gmailTokenClient = null;
let gmailAccessToken = null;
let pendingGmailTxns = [];
let driveReconnectInFlight = false;

function getDefaultGmailImportRules(){
  return [{
    id: 'gmail-rule-santander-default',
    name: 'Santander · Compras',
    bank: 'Santander Río',
    sender: GMAIL_SENDER,
    query: 'subject:Pagaste OR subject:"Tu pago fue anulado"',
    cardType: 'auto',
    processor: 'santander_email',
    active: true
  }];
}

function ensureGmailImportRules(){
  if(!Array.isArray(state.gmailImportRules) || !state.gmailImportRules.length){
    state.gmailImportRules = getDefaultGmailImportRules();
  }
  return state.gmailImportRules;
}

function formatGmailRuleCardType(cardType){
  const map = {
    auto: 'Auto detectar',
    visa: 'Visa',
    amex: 'Amex',
    deb: 'Débito',
    ef: 'Efectivo'
  };
  return map[cardType] || cardType || 'Sin asignar';
}

function getGmailRuleImportKind(rule){
  if(rule?.importKind) return rule.importKind;
  const hint = `${rule?.name||''} ${rule?.query||''}`.toLowerCase();
  return /d[eé]bito autom[aá]tico|aviso de d[eé]bito/i.test(hint) ? 'subscription' : 'transaction';
}

function summarizeGmailRule(rule){
  return {
    sender: rule.sender ? `Lee correos de ${rule.sender}` : 'Lee correos según la consulta',
    query: rule.query ? `Filtra por ${rule.query}` : 'Sin filtro extra',
    assign: `${getGmailRuleImportKind(rule)==='subscription'?'Crea o actualiza una suscripción en':'Los asigna a'} ${rule.bank || 'tu banco'} · ${formatGmailRuleCardType(rule.cardType)}`
  };
}

function applyGmailRuleTemplate(templateId){
  const defaults = getDefaultGmailImportRules()[0];
  const templates = {
    'santander-compras': {
      name:'Santander · Compras',
      bank:'Santander Río',
      sender:defaults.sender,
      query:'subject:Pagaste OR subject:"Tu pago fue anulado"',
      importKind:'transaction',
      card:'auto',
      processor:'santander_email'
    },
    'santander-pagos': {
      name:'Débito Automático',
      bank:'Santander Río',
      sender:defaults.sender,
      query:'subject:"Aviso de débito automático"',
      importKind:'subscription',
      card:'auto',
      processor:'santander_email'
    },
    custom: {
      name:'Nueva regla Gmail',
      bank:'Banco / tarjeta',
      sender:'',
      query:'',
      importKind:'transaction',
      card:'auto',
      processor:'santander_email'
    }
  };
  const values = templates[templateId] || templates.custom;
  const map = {
    'gmail-rule-name':values.name,
    'gmail-rule-bank':values.bank,
    'gmail-rule-sender':values.sender,
    'gmail-rule-query':values.query,
    'gmail-rule-import-kind':values.importKind,
    'gmail-rule-card':values.card,
    'gmail-rule-processor':values.processor
  };
  Object.entries(map).forEach(([id,val])=>{ const el=document.getElementById(id); if(el) el.value = val; });
}

function getActiveGmailImportRules(){
  return ensureGmailImportRules().filter(rule => rule.active !== false);
}

function buildGmailRuleQuery(rule, dateQuery){
  const parts = [];
  if(rule.sender) parts.push(`from:${rule.sender}`);
  if(rule.query) parts.push(`(${rule.query})`);
  if(!rule.query && rule.processor === 'santander_email'){
    parts.push('(subject:Pagaste OR subject:"Tu pago fue anulado")');
  }
  return encodeURIComponent(`${parts.join(' ')}${dateQuery}`);
}

function isGoogleConnected() {
  return !!(driveReady && driveAccessToken);
}

function sanitizeGoogleClientId(raw) {
  const id = String(raw || '').replace(/\s+/g, '').trim();
  return /\.apps\.googleusercontent\.com$/.test(id) ? id : '';
}

function isEmbeddedMobileBrowser() {
  const ua = navigator.userAgent || '';
  return /Instagram|FBAN|FBAV|Line|MicroMessenger|wv|WhatsApp/i.test(ua);
}

function getGmailClientId() {
  const stateId = sanitizeGoogleClientId(state.gmailClientId);
  const localId = sanitizeGoogleClientId(localStorage.getItem('fin_gmail_client_id'));
  const defaultId = sanitizeGoogleClientId(DEFAULT_GOOGLE_CLIENT_ID);
  return stateId || localId || defaultId;
}

function saveGmailClientId() {
  const id = sanitizeGoogleClientId(document.getElementById('gmail-client-id-input').value);
  if (!id) { showToast('Ingresá un Client ID válido', 'error'); return; }
  state.gmailClientId = id;
  state.onboardingState = { ...(state.onboardingState || {}), google: true };
  localStorage.setItem('fin_gmail_client_id', id);
  saveState();
  closeModal('modal-gmail-setup');
  showToast('✓ Client ID guardado', 'success');
  initDriveClient();
}

function openCloudSync(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (isEmbeddedMobileBrowser()) {
    showToast('Abrí la app en Safari o Chrome para conectar Google correctamente', 'info');
  }
  const clientId = getGmailClientId();
  if (!clientId) {
    const input = document.getElementById('gmail-client-id-input');
    if (input) input.value = DEFAULT_GOOGLE_CLIENT_ID;
    openModal('modal-gmail-setup');
    return;
  }
  initDriveClient(false);
}

function attemptDriveReconnect(force){
  const clientId = getGmailClientId();
  if (!clientId) return;
  if (driveReconnectInFlight && !force) return;
  if (driveReady && driveAccessToken) return;
  driveReconnectInFlight = true;
  initDriveClient(false);
  setTimeout(() => { driveReconnectInFlight = false; }, 4000);
}

function loadGoogleScript(cb) {
  if (window.google && window.google.accounts) { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.onload = cb;
  s.onerror = () => showToast('No se pudo cargar Google Identity. Verificá tu conexión.', 'error');
  document.head.appendChild(s);
}

function initGmailClient(autoSync) {
  const clientId = getGmailClientId();
  if (!clientId) { openModal('modal-gmail-setup'); return; }
  loadGoogleScript(() => {
    gmailTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_SCOPES,
      callback: (resp) => {
        if (resp.error) { showToast('Error de autenticación: ' + resp.error, 'error'); return; }
        gmailAccessToken = resp.access_token;
        updateGmailBtn('connected');
        fetchSantanderEmails();
      }
    });
    if (autoSync) requestGmailToken();
  });
}

function requestGmailToken() {
  if (!gmailTokenClient) { initGmailClient(true); return; }
  if (gmailAccessToken) { fetchSantanderEmails(); return; }
  gmailTokenClient.requestAccessToken({ prompt: '' });
}

// ── Modal de período para sincronización manual Gmail ──
function openGmailPeriodModal() {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const toISO = d => d.toISOString().slice(0,10);
  document.getElementById('gmail-period-from').value = toISO(firstOfMonth);
  document.getElementById('gmail-period-to').value = toISO(now);
  gmailPeriodQuick('month');
  openModal('modal-gmail-period');
}

function gmailPeriodQuick(preset) {
  const now = new Date();
  const toISO = d => d.toISOString().slice(0,10);
  document.querySelectorAll('.gmail-period-quick-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById('gp-quick-' + preset);
  if(activeBtn) activeBtn.classList.add('active');
  let from, to = now;
  if (preset === 'week') { from = new Date(now); from.setDate(now.getDate() - 7); }
  else if (preset === 'month') { from = new Date(now.getFullYear(), now.getMonth(), 1); }
  else if (preset === 'last-month') { from = new Date(now.getFullYear(), now.getMonth()-1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0); }
  else if (preset === '3months') { from = new Date(now); from.setMonth(now.getMonth()-3); }
  else if (preset === 'year') { from = new Date(now.getFullYear(), 0, 1); }
  if(from) { document.getElementById('gmail-period-from').value = toISO(from); document.getElementById('gmail-period-to').value = toISO(to); }
}

function confirmGmailPeriod() {
  const fromVal = document.getElementById('gmail-period-from').value;
  const toVal = document.getElementById('gmail-period-to').value;
  if (!fromVal || !toVal) { showToast('Seleccioná un período válido', 'error'); return; }
  const dateFrom = new Date(fromVal + 'T00:00:00');
  const dateTo = new Date(toVal + 'T23:59:59');
  if (dateFrom > dateTo) { showToast('La fecha inicio no puede ser mayor al final', 'error'); return; }
  closeModal('modal-gmail-period');
  fetchSantanderEmails(dateFrom, dateTo);
}

function gmailSync() {
  const clientId = getGmailClientId();
  if (!clientId) { openModal('modal-gmail-setup'); return; }
  if (gmailAccessToken) { openGmailPeriodModal(); return; }
  if (driveTokenClient) {
    window._gmailSyncPending = true;
    driveTokenClient.requestAccessToken({ prompt: '' });
  } else {
    initDriveClient(true);
  }
}

function updateGmailBtn(status) {
  const btn = document.getElementById('gmail-sync-btn');
  const label = document.getElementById('gmail-sync-label');
  const dot = document.getElementById('gmail-sync-dot');
  const mobBtn = document.getElementById('mn-google-sync');
  if (btn) btn.className = 'gmail-sync-btn';
  if (status === 'syncing') {
    if (btn) btn.classList.add('syncing');
    if (label) label.innerHTML = '<span class="spinning">↻</span> Sincronizando…';
    if (dot) dot.style.background = 'var(--accent3)';
    if (mobBtn) mobBtn.innerHTML = '<span class="mn-icon">↻</span>Google';
  } else if (status === 'connected') {
    if (btn) btn.classList.add('connected');
    const lastSyncTag = _getLastSyncTag();
    if (label) label.innerHTML = 'Gmail · Conectado' + (lastSyncTag ? ' · ' + lastSyncTag : '');
    if (dot) dot.style.background = 'var(--accent2)';
    if (mobBtn) mobBtn.innerHTML = '<span class="mn-icon">☁</span>Google ✓';
  } else if (status === 'done') {
    if (btn) btn.classList.add('connected');
    const lastSyncTag = _getLastSyncTag();
    if (label) label.innerHTML = 'Gmail · Sincronizado ✓' + (lastSyncTag ? ' · ' + lastSyncTag : '');
    if (dot) dot.style.background = 'var(--accent)';
    if (mobBtn) mobBtn.innerHTML = '<span class="mn-icon">☁</span>Google ✓';
  } else {
    const lastSyncTag = _getLastSyncTag();
    if (lastSyncTag) {
      if (label) label.innerHTML = `Gmail · ${lastSyncTag}`;
    } else {
      if (label) label.textContent = 'Gmail · Sincronizar';
    }
    if (dot) dot.style.background = 'var(--text3)';
    if (mobBtn) mobBtn.innerHTML = '<span class="mn-icon">☁</span>Conectar';
  }
}

function _getLastSyncTag() {
  if (!state.lastGmailSync) return '';
  const today = new Date();
  const d = new Date(state.lastGmailSync);
  const time = d.toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'});
  const isToday = d.toDateString() === today.toDateString();
  const date = isToday ? 'Hoy' : d.toLocaleDateString('es-AR', {day:'2-digit', month:'2-digit'});
  return `<span style="font-size:11px;opacity:0.9;font-weight:600;display:block;margin-top:2px;color:var(--text3);">Sincronizado: ${date} ${time}</span>`;
}

async function fetchSantanderEmails(dateFrom, dateTo) {
  updateGmailBtn('syncing');
  try {
    const now = new Date();
    dateFrom = dateFrom || new Date(now.getFullYear(), now.getMonth(), 1);
    dateTo = dateTo || now;
    const fmtGmail = d => d.toISOString().slice(0,10).replace(/-/g,'/');
    const beforeDate = new Date(dateTo); beforeDate.setDate(beforeDate.getDate()+1);
    const dateQuery = ` after:${fmtGmail(dateFrom)} before:${fmtGmail(beforeDate)}`;
    const rules = getActiveGmailImportRules();
    if(!rules.length){
      showToast('Configurá al menos una regla Gmail activa', 'error');
      updateGmailBtn('connected'); return;
    }
    
    // Obtenemos los IDs de emails ya importados y anulados procesados
    const importedEmailIds = new Set([
      ...state.transactions.map(t => t.gmailId).filter(Boolean),
      ...(state.gmailAnulados || [])
    ]);

    // Fetch ALL pages across active rules
    let allMessages = [];
    const seenRuleMessages = new Set();
    for (const rule of rules) {
      let pageToken = null;
      do {
        const tokenParam = pageToken ? `&pageToken=${pageToken}` : '';
        const query = buildGmailRuleQuery(rule, dateQuery);
        const listRes = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=500${tokenParam}`);
        const data = await listRes.json();
        (data.messages || []).forEach(m => {
          if(seenRuleMessages.has(m.id)) return;
          seenRuleMessages.add(m.id);
          allMessages.push({ id:m.id, threadId:m.threadId, ruleId:rule.id });
        });
        pageToken = data.nextPageToken || null;
      } while (pageToken);
    }

    if (!allMessages.length) {
      showToast('No se encontraron correos en ese período', 'error');
      updateGmailBtn('connected'); return;
    }
    const newMessages = allMessages.filter(m => !importedEmailIds.has(m.id));
    const totalFound = allMessages.length;
    if (newMessages.length === 0) {
      showToast(`✓ Sin correos nuevos — los ${totalFound} ya están importados`, 'success');
      updateGmailBtn('done'); return;
    }
    // Fetch todos los correos nuevos en batches de 25 para evitar rate limiting
    const BATCH_SIZE = 25;
    const emails = [];
    const ruleMap = Object.fromEntries(rules.map(rule => [rule.id, rule]));
    for (let i = 0; i < newMessages.length; i += BATCH_SIZE) {
      const batch = newMessages.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(m => gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`)
          .then(r => r.json())
          .then(email => ({ email, rule: ruleMap[m.ruleId] || null })))
      );
      emails.push(...batchResults);
      if (i + BATCH_SIZE < newMessages.length) await new Promise(r => setTimeout(r, 200));
    }
    
    const txns = [];
    const annulments = [];
    for (const bundle of emails) { 
        const txn = parseSantanderEmail(bundle.email, txns, bundle.rule); 
        if (txn) {
            if (txn.isAnulacion) annulments.push(txn);
            else txns.push(txn);
        } 
    }
    
    // Procesar anulaciones
    if (annulments.length > 0) {
      if (!state.gmailAnulados) state.gmailAnulados = [];
      let stateChanged = false;
      
      for (const an of annulments) {
        state.gmailAnulados.push(an.gmailId);
        stateChanged = true;

        // Helper: match flexible — mismo monto/moneda + descripción similar o sin comercio detectado
        const _anBase = (an._baseDesc||'').toLowerCase();
        const _matchesTxn = (t) => {
          if (t.amount !== an.amount || t.currency !== an.currency) return false;
          const tBase = (t._baseDesc||t.description||'').toLowerCase();
          // Exact base match OR annulment has generic 'santander' (comercio not extracted)
          return tBase === _anBase || _anBase === 'santander' || tBase.startsWith(_anBase) || _anBase.startsWith(tBase.split(' ')[0]);
        };

        // Buscar en la lista de nuevos (por si llegaron ambos juntos)
        let matchIdx = txns.findIndex(t => _matchesTxn(t));
        if (matchIdx !== -1) {
            txns.splice(matchIdx, 1);
        } else {
            // Buscar en transacciones existentes (tolerancia 5 días)
            let stateIdx = state.transactions.findIndex(t =>
                _matchesTxn(t) &&
                Math.abs(new Date(t.date) - an.date) < 86400000 * 5
            );
            if (stateIdx !== -1) {
                state.transactions.splice(stateIdx, 1);
                stateChanged = true;
            }
        }
      }
      if (stateChanged) saveState();
    }

    if (!txns.length) {
      if (annulments.length > 0) {
        showToast('Correos procesados. Se registraron anulaciones sin gastos extra.', 'success');
      } else {
        showToast('✓ No se encontraron movimientos nuevos', 'success');
      }
      updateGmailBtn('connected');
      state.lastGmailSync = new Date().toISOString(); // Update last sync even if no new txns
      saveState();
      return;
    }
    pendingGmailTxns = txns;
    showGmailResultModal(txns, totalFound, dateFrom, dateTo);
    updateGmailBtn('done');
  } catch(err) {
    console.error('Gmail sync error:', err);
    if (err.message && err.message.includes('401')) {
      gmailAccessToken = null;
      showToast('Sesión expirada — reconectando…', 'error');
      if(gmailTokenClient) gmailTokenClient.requestAccessToken({ prompt: '' });
    } else { showToast('Error al conectar con Gmail', 'error'); }
    updateGmailBtn('connected');
  }
}

function gmailFetch(url) {
  return fetch(url, {
    headers: { Authorization: 'Bearer ' + gmailAccessToken }
  }).then(r => {
    if (r.status === 401) throw new Error('401');
    return r;
  });
}

function getEmailBody(payload) {
  // Recursively find text/html or text/plain parts
  if (!payload) return '';
  if (payload.body && payload.body.data) {
    return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      // Prefer HTML for better parsing
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
    }
    for (const part of payload.parts) {
      if (part.body && part.body.data) {
        return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
      // Recurse into multipart
      if (part.parts) {
        const nested = getEmailBody(part);
        if (nested) return nested;
      }
    }
  }
  return '';
}

function parseSantanderEmail(email, currentBatch, rule) {
  try {
    const emailId = email.id;
    const headers = email.payload.headers || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const dateHeader = headers.find(h => h.name === 'Date')?.value || '';

    const isAnulacion = /anulado/i.test(subject);
    const importKind = getGmailRuleImportKind(rule);
    const isAutoDebit = importKind === 'subscription' || /d[eé]bito autom[aá]tico/i.test(subject);

    // Parse email body early to extract amount if necessary
    const body = getEmailBody(email.payload);

    // Auto-detect card type from email body (VISA termina en 3177, AMEX termina en 7262)
    let payMethod = null;
    if (rule?.cardType && rule.cardType !== 'auto') payMethod = rule.cardType;
    else if (/terminada en 3177|tarjeta santander visa|visa cr[eé]dito/i.test(body)) payMethod = 'visa';
    else if (/terminada en 7262|american express|amex/i.test(body)) payMethod = 'amex';
    // Also check state.ccCards for card name matching (fallback)
    if (!payMethod && state.ccCards?.length) {
      const _visaCard = state.ccCards.find(c => /visa/i.test(c.name||''));
      const _amexCard = state.ccCards.find(c => /amex|american express/i.test(c.name||''));
      if (_amexCard && /american express|amex/i.test(body)) payMethod = 'amex';
      else if (_visaCard && /visa/i.test(body)) payMethod = 'visa';
    }

    let txnCurrency = 'ARS';
    let amount = 0;

    if (isAnulacion) {
      const montoMatch = body.match(/Monto[\s\S]*?(U\$S|\$)\s*([\d.,]+)/i);
      if (!montoMatch) return null;
      if (montoMatch[1].toUpperCase() === 'U$S') txnCurrency = 'USD';
      amount = parseFloat(montoMatch[2].replace(/\./g, '').replace(',', '.'));
    } else {
      let subjectMatch = subject.match(/Pagaste\s+U\$S\s*([\d.,]+)/i);
      if (subjectMatch) {
        txnCurrency = 'USD';
      } else {
        subjectMatch = subject.match(/Pagaste\s*\$?([\d.,]+)/i);
      }
      if(!subjectMatch && isAutoDebit){
        subjectMatch = body.match(/Monto[\s\S]*?(U\$S|US\$|\$)\s*([\d.,]+)/i);
        if(subjectMatch){
          if(/U\$S|US\$/i.test(subjectMatch[1])) txnCurrency = 'USD';
          amount = parseFloat(subjectMatch[2].replace(/\./g, '').replace(',', '.'));
        }
      }
      if (!subjectMatch && !isAutoDebit) return null;
      if (!amount && subjectMatch) {
        const rawAmount = subjectMatch[2] || subjectMatch[1];
        amount = parseFloat(String(rawAmount || '').replace(/\./g, '').replace(',', '.'));
      }
    }
    
    if (!amount || amount <= 0) return null;

    // Extract Comercio
    let comercio = 'Santander';
    const comercioMatch = body.match(/Comercio[\s\S]*?<strong[^>]*>(.*?)<\/strong>/i) ||
                          body.match(/Comercio[^>]*>[\s\S]*?>([A-Z0-9*\s]+)</i);
    if (comercioMatch) {
      comercio = comercioMatch[1].replace(/<[^>]+>/g, '').trim();
    } else {
      // Plain text fallback
      const ptMatch = body.replace(/<[^>]+>/g, '\n').match(/Comercio\s*\n+([^\n]+)/i);
      if (ptMatch) comercio = ptMatch[1].trim();
    }
    comercio = comercio.replace(/\s*\*[A-Z0-9]+$/i, '').replace(/\s{2,}/g, ' ').trim();
    const merchantKey = comercio.toLowerCase().replace(/[^a-z0-9]/g,'');

    // Extract Fecha (DD/MM/YYYY)
    let txnDate = new Date();
    const fechaMatch = body.match(/Fecha[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i);
    if (fechaMatch) {
      const [d, m, y] = fechaMatch[1].split('/');
      txnDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    } else if (dateHeader) {
      txnDate = new Date(dateHeader);
    }

    // Extract Hora
    let hora = '';
    const horaMatch = body.match(/Hora[\s\S]*?(\d{2}:\d{2})/i);
    if (horaMatch) hora = horaMatch[1];

    // Detect Cuotas (installments) from email body
    let cuotaTotal = null;
    const cuotasHtmlMatch = body.match(/Cuotas[\s\S]{0,200}?<strong[^>]*>\s*(\d+)\s*<\/strong>/i)
                         || body.match(/Cuotas[\s\S]{0,200}?<td[^>]*>\s*<strong[^>]*>\s*(\d+)\s*<\/strong>/i)
                         || body.match(/Cuotas[\s\S]{0,200}?<\/td>[\s\S]{0,50}?<td[^>]*>\s*(\d+)\s*<\/td>/i);
    if (!cuotasHtmlMatch) {
      // Plain text fallback
      const cuotasPtMatch = body.replace(/<[^>]+>/g, '\n').match(/Cuotas\s*\n+(\d+)/i);
      if (cuotasPtMatch) {
        const n = parseInt(cuotasPtMatch[1]);
        if (n >= 2 && n <= 72) cuotaTotal = n;
      }
    } else {
      const n = parseInt(cuotasHtmlMatch[1]);
      if (n >= 2 && n <= 72) cuotaTotal = n;
    }

    const totalAmount = amount;
    let cuotaNum = null;
    let cuotaGroupId = null;
    if (cuotaTotal && cuotaTotal >= 2) {
      amount = Math.round(totalAmount / cuotaTotal);
      // ID estable basado en comercio + monto por cuota + total (no en el emailId)
      // Así todos los emails del mismo plan de cuotas quedan en el mismo grupo
      const _cgSlug = comercio.toLowerCase().replace(/[^a-z0-9]/g,'').substring(0,15);
      cuotaGroupId = 'cg_' + _cgSlug + '_' + amount + '_' + cuotaTotal;
      
      // Determinar qué número de cuota es: contamos los reales ya existentes en el grupo
      const _prevReal = (state.transactions||[]).filter(t => t.cuotaGroupId === cuotaGroupId && !t.isPendingCuota);
      const _prevInBatch = (currentBatch||[]).filter(t => t.cuotaGroupId === cuotaGroupId && !t.isAnulacion);
      cuotaNum = _prevReal.length + _prevInBatch.length + 1;
      
      if(cuotaNum > cuotaTotal) cuotaNum = cuotaTotal;
    }

    const baseDesc = comercio;
    const description = cuotaTotal && cuotaTotal >= 2
      ? baseDesc + ' (Cuota ' + cuotaNum + '/' + cuotaTotal + ')' + (hora ? ' ' + hora : '')
      : baseDesc + (hora ? ' ' + hora : '');
    const id = 'gmail_' + emailId; // stable ID = no duplicates

    return {
      id,
      gmailId: emailId,
      isAnulacion,
      date: txnDate,
      description,
      _baseDesc: baseDesc,
      amount,
      currency: txnCurrency,
      category: 'Procesando...',
      week: getWeekKey(txnDate),
      month: getMonthKey(txnDate),
      source: 'gmail',
      importRuleId: rule?.id || null,
      importRuleName: rule?.name || 'Gmail',
      sourceBank: rule?.bank || 'Gmail',
      importKind,
      isAutoDebit,
      merchantKey,
      subscriptionName: isAutoDebit ? baseDesc : null,
      subscriptionDay: isAutoDebit ? txnDate.getDate() : null,
      ...(payMethod ? { payMethod } : {}),
      ...(cuotaTotal && cuotaTotal >= 2 ? {
        cuotaNum,
        cuotaTotal,
        cuotaTotalAmount: totalAmount,
        cuotaGroupId
      } : {})
    };
  } catch(e) {
    console.error('Error parsing email:', e);
    return null;
  }
}

// Find possible duplicates: same day + same amount, OR same comercio + same amount within 2 days
function findPossibleDuplicates(newTxns) {
  const conflicts = [];
  const clean = [];
  for (const t of newTxns) {
    const tDate = dateToYMD(t.date);
    const tBase = (t._baseDesc||t.description||'').toLowerCase().split(' ')[0]; // first word of merchant
    const existing = state.transactions.filter(e => {
      const eDate = dateToYMD(e.date);
      const sameDay = eDate === tDate;
      const samePeriod = Math.abs(new Date(eDate) - new Date(tDate)) <= 86400000 * 2; // 2-day window
      const sameAmt = e.amount === t.amount && e.currency === t.currency;
      const eBase = (e._baseDesc||e.description||'').toLowerCase().split(' ')[0];
      // Case 1: same day + same amount (exact duplicate check)
      if (sameDay && sameAmt) return true;
      // Case 2: same merchant (first word match) + same amount within 2 days (different hora)
      if (samePeriod && sameAmt && tBase.length > 3 && eBase === tBase) return true;
      return false;
    });
    if (existing.length > 0) {
      conflicts.push({ incoming: t, existing });
    } else {
      clean.push(t);
    }
  }
  return { conflicts, clean };
}

function gmailUpdateCounter(){
  const btn = document.getElementById('gmail-result-confirm-btn');
  if(!btn) return;
  const total = document.querySelectorAll('#gmail-result-body input[type=checkbox]').length;
  const checked = document.querySelectorAll('#gmail-result-body input[type=checkbox]:checked').length;
  btn.textContent = checked > 0 ? '✓ Importar ' + checked + (total!==checked?' de '+total:'') + (checked===1?' gasto':' gastos') : 'No importar nada';
  btn.style.opacity = checked > 0 ? '1' : '0.5';
}

function showGmailResultModal(txns, totalFound, dateFrom, dateTo) {
  const title = document.getElementById('gmail-result-title');
  const sub = document.getElementById('gmail-result-sub');
  const body = document.getElementById('gmail-result-body');
  const confirmBtn = document.getElementById('gmail-result-confirm-btn');

  // Detect possible duplicates
  const { conflicts, clean } = findPossibleDuplicates(txns);

  const fmtPeriod = d => d ? d.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  title.textContent = '📧 Gmail · Revisión antes de importar';
  let subParts = [];
  if(dateFrom && dateTo) subParts.push(fmtPeriod(dateFrom) + ' → ' + fmtPeriod(dateTo));
  subParts.push(totalFound + ' correo' + (totalFound!==1?'s':'') + ' encontrado' + (totalFound!==1?'s':''));
  subParts.push(txns.length + ' gasto' + (txns.length!==1?'s':'') + ' a importar');
  if (conflicts.length > 0) subParts.push('⚠️ ' + conflicts.length + ' posible' + (conflicts.length !== 1 ? 's duplicados' : ' duplicado'));
  sub.textContent = subParts.join(' · ');

  // Safe helpers in case of context issues
  const safeEsc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const safeFmt = (n) => {
    const num = Number(n);
    if (isNaN(num)) return String(n||'—');
    return num.toLocaleString('es-AR');
  };
  const safeDateFmt = (d) => {
    try {
      const dt = d instanceof Date ? d : new Date(d);
      if (isNaN(dt)) return String(d||'—');
      return dt.toLocaleDateString('es-AR', {day:'2-digit', month:'short', year:'numeric'});
    } catch(e) { return String(d||'—'); }
  };

  let html = '';

  if (conflicts.length > 0) {
    html += `<div style="font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#c87a00;margin-bottom:8px;padding:0 2px;">⚠️ Posibles duplicados — mismo día y monto (${conflicts.length})</div>`;
    for (const c of conflicts) {
      const t = c.incoming;
      const d = safeDateFmt(t.date);
      const amt = 'ARS' === t.currency ? '$' + safeFmt(t.amount) : 'U$D ' + safeFmt(t.amount);
      html += `<div style="border:2px solid #ff950044;border-radius:12px;overflow:hidden;margin-bottom:10px;">
        <div style="background:#ff950018;padding:10px 14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
            <span style="font-size:9px;font-weight:700;color:#c87a00;letter-spacing:0.04em;text-transform:uppercase;">📧 Nuevo · Gmail</span>
            <span style="font-size:14px;font-weight:700;color:#007aff;font-family:var(--font);">${amt}</span>
          </div>
          <div style="font-size:14px;font-weight:700;margin-bottom:2px;">${safeEsc(t.description)}</div>
          <div style="font-size:11px;color:#888;font-family:var(--font);">${d}</div>
          <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;margin-top:8px;background:var(--surface2);border-radius:6px;padding:5px 10px;border:1px solid var(--border2);">
            <input type="checkbox" checked data-gmail-id="${safeEsc(t.id)}" style="width:15px;height:15px;cursor:pointer;accent-color:#007aff;">
            <span style="font-size:12px;font-weight:600;">Importar este gasto</span>
          </label>
        </div>`;
      for (const e of c.existing) {
        const eAmt = 'ARS' === e.currency ? '$' + safeFmt(e.amount) : 'U$D ' + safeFmt(e.amount);
        html += `<div style="background:var(--surface2);padding:10px 14px;border-top:1px solid var(--border);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:2px;">
            <span style="font-size:9px;font-weight:700;color:#888;letter-spacing:0.04em;text-transform:uppercase;">📋 Ya existe</span>
            <span style="font-size:13px;font-weight:700;color:#888;font-family:var(--font);">${eAmt}</span>
          </div>
          <div style="font-size:13px;color:#666;">${safeEsc(e.description)}</div>
          <div style="font-size:11px;color:#aaa;font-family:var(--font);margin-top:2px;">${safeDateFmt(e.date)}</div>
        </div>`;
      }
      html += `</div>`;
    }
  }

  if (clean.length > 0) {
    html += `<div style="font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--accent);margin:${conflicts.length>0?'14px':0} 0 8px;padding:0 2px;">✓ Gastos nuevos (${clean.length}) — deseleccioná los que no quieras</div>`;
    for (const t of clean) {
      const d = safeDateFmt(t.date);
      const amt = t.currency === 'ARS' ? '$' + safeFmt(t.amount) : 'U$D ' + safeFmt(t.amount);
      const isCuota = t.cuotaTotal >= 2;
      const cuotaBadge = isCuota
        ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:var(--accent3);background:rgba(255,149,0,0.12);border:1px solid rgba(255,149,0,0.3);border-radius:5px;padding:2px 7px;margin-top:3px;">📋 ${t.cuotaTotal} cuotas · ${amt}/mes · Total $${safeFmt(t.cuotaTotalAmount)}</span>`
        : '';
      html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface2);border-radius:8px;border:1px solid ${isCuota?'rgba(255,149,0,0.35)':'var(--border)'};gap:12px;margin-bottom:5px;" id="row-${safeEsc(t.id)}">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;min-width:0;">
          <input type="checkbox" checked data-gmail-id="${safeEsc(t.id)}" onchange="gmailUpdateCounter();this.closest('[id]').style.opacity=this.checked?'1':'0.4';" style="width:14px;height:14px;flex-shrink:0;cursor:pointer;accent-color:var(--accent);">
          <div style="min-width:0;">
            <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${safeEsc(t.description)}</div>
            <div style="font-size:11px;color:var(--text2);font-family:var(--font);margin-top:1px;">${d}</div>
            ${cuotaBadge}
          </div>
        </label>
        <div style="font-size:14px;font-weight:700;color:${isCuota?'var(--accent3)':'var(--accent)'};font-family:var(--font);white-space:nowrap;flex-shrink:0;">${amt}</div>
      </div>`;
    }
  }

  if (html === '') {
    html = `<div style="padding:20px;text-align:center;color:#888;">No hay transacciones para mostrar.</div>`;
  }

  body.innerHTML = html;
  confirmBtn.style.display = 'flex';
  gmailUpdateCounter();
  openModal('modal-gmail-result');
}

function confirmGmailImport() {
  if (!pendingGmailTxns.length) return;
  closeModal('modal-gmail-result');

  // Check which conflicting txns the user chose to keep
  const { conflicts, clean } = findPossibleDuplicates(pendingGmailTxns);
  const uncheckedIds = new Set();
  document.querySelectorAll('#gmail-result-body input[type=checkbox]').forEach(cb => {
    if (!cb.checked) uncheckedIds.add(cb.dataset.gmailId);
  });

  // Only import clean + checked conflict txns
  const toImport = [
    ...clean,
    ...conflicts.map(c => c.incoming).filter(t => !uncheckedIds.has(t.id))
  ];

  if (toImport.length > 0) {
    const labels = [...new Set(toImport.map(t => t.sourceBank || t.importRuleName || 'Gmail'))];
    finishImport(toImport, 'Gmail · ' + labels.join(' + '));
  } else {
    showToast('No se importó ningún gasto', 'info');
  }
  pendingGmailTxns = [];
}

function getOnboardingChecklist(){
  ensureGmailImportRules();
  const activeRules = getActiveGmailImportRules().length;
  const activeIncome = (state.incomeMonths||[]).length || (state.incomeSources||[]).length || (state.income?.ars||0) || (state.income?.usd||0);
  return [
    {
      id:'google',
      done:isGoogleConnected(),
      icon:isGoogleConnected() ? '✓' : '1',
      title:'Conectar Google',
      sub:isGoogleConnected() ? 'La cuenta ya está lista para sincronizar datos entre dispositivos.' : 'Necesario para Drive, Gmail y sincronización de datos.',
      action:isGoogleConnected() ? 'Revisar' : 'Conectar',
      onclick:'openCloudSync(event)'
    },
    {
      id:'gmail-rules',
      done:activeRules > 0,
      icon:activeRules > 0 ? '✓' : '2',
      title:'Definir reglas Gmail',
      sub:activeRules > 0 ? `${activeRules} regla${activeRules!==1?'s':''} activa${activeRules!==1?'s':''} para leer gastos desde correos.` : 'Elegí remitentes, consultas y tarjeta asociada para leer gastos automáticamente.',
      action:'Configurar',
      onclick:'openGmailRuleManager()'
    },
    {
      id:'cards',
      done:(state.ccCards||[]).length > 0 || (state.tcCycles||[]).length > 0,
      icon:(state.ccCards||[]).length > 0 || (state.tcCycles||[]).length > 0 ? '✓' : '3',
      title:'Configurar tarjetas y ciclos',
      sub:(state.ccCards||[]).length > 0 || (state.tcCycles||[]).length > 0 ? 'Ya hay tarjetas o ciclos listos para usar en la app.' : 'Cierre, vencimiento, tarjeta y banco para calcular ciclos correctamente.',
      action:'Abrir',
      onclick:"nav('credit-cards');ccSelectPageTab('config')"
    },
    {
      id:'income',
      done:Boolean(activeIncome),
      icon:activeIncome ? '✓' : '4',
      title:'Registrar ingresos base',
      sub:activeIncome ? 'La app ya tiene una base de ingreso para métricas, ahorro y salud financiera.' : 'Necesario para ahorro, score financiero y proyecciones más realistas.',
      action:'Abrir',
      onclick:"nav('income')"
    }
  ];
}

function applyUsageProfile(profile){
  state.profileTemplate = profile;
  const presetMap = {
    personal:'balanceado',
    ahorro:'modo-ahorro',
    familiar:'seguimiento',
    freelance:'analitico'
  };
  const preset = presetMap[profile];
  if(preset && typeof applyDashboardDesignPreset === 'function') applyDashboardDesignPreset(preset);
  syncActiveUserProfileFromState(false);
  saveState();
  renderSettingsPage();
  showToast('✓ Perfil aplicado', 'success');
}

function ensureBankProfiles(){
  if(!Array.isArray(state.bankProfiles)) state.bankProfiles = [];
  return state.bankProfiles;
}

function ensureUserProfiles(){
  if(!Array.isArray(state.userProfiles)) state.userProfiles = [];
  return state.userProfiles;
}

function cloneDeepProfileValue(value){
  return JSON.parse(JSON.stringify(value));
}

function markOwnedItems(items, ownerProfileId){
  if(!Array.isArray(items)) return [];
  return items.map(item=>{
    if(!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return { ...item, ownerProfileId: item.ownerProfileId || ownerProfileId };
  });
}

function normalizeStateOwnership(ownerProfileId){
  const profileId = ownerProfileId || state.activeUserProfileId || 'default-profile';
  state.transactions = markOwnedItems(state.transactions, profileId);
  state.imports = markOwnedItems(state.imports, profileId);
  state.cuotas = markOwnedItems(state.cuotas, profileId);
  state.subscriptions = markOwnedItems(state.subscriptions, profileId);
  state.fixedExpenses = markOwnedItems(state.fixedExpenses, profileId);
  state.gmailImportRules = markOwnedItems(state.gmailImportRules, profileId);
  state.bankProfiles = markOwnedItems(state.bankProfiles, profileId);
  state.incomeSources = markOwnedItems(state.incomeSources, profileId);
  state.incomeMonths = markOwnedItems(state.incomeMonths, profileId);
  state.ccCards = markOwnedItems(state.ccCards, profileId);
  state.ccCycles = markOwnedItems(state.ccCycles, profileId);
  state.savAccounts = markOwnedItems(state.savAccounts, profileId);
  state.savGoals = markOwnedItems(state.savGoals, profileId);
  state.savDeposits = markOwnedItems(state.savDeposits, profileId);
  state.catRules = markOwnedItems(state.catRules, profileId);
}

function ensureActiveUserProfileBootstrap(){
  const profiles = ensureUserProfiles();
  if(state.activeUserProfileId && profiles.some(profile => profile.id === state.activeUserProfileId)){
    normalizeStateOwnership(state.activeUserProfileId);
    return;
  }
  if(profiles.length){
    state.activeUserProfileId = profiles[0].id;
    applyUserProfile(profiles[0].id);
    return;
  }
  const newId = 'user-profile-' + Date.now().toString(36);
  normalizeStateOwnership(newId);
  profiles.unshift({
    id:newId,
    name: state.userName || 'Perfil principal',
    note:'Perfil base creado automáticamente',
    ...getCurrentProfileSnapshot()
  });
  state.userProfiles = profiles;
  state.activeUserProfileId = newId;
  saveState();
}

function getCurrentProfileSnapshot(){
  return {
    userName: state.userName || 'Usuario',
    profileTemplate: state.profileTemplate || 'personal',
    transactions: cloneDeepProfileValue(markOwnedItems((state.transactions || []).map(txn => ({
      ...txn,
      date: txn.date instanceof Date ? txn.date.toISOString() : txn.date
    })), state.activeUserProfileId || 'default-profile')),
    imports: cloneDeepProfileValue(markOwnedItems(state.imports || [], state.activeUserProfileId || 'default-profile')),
    cuotas: cloneDeepProfileValue(markOwnedItems(state.cuotas || [], state.activeUserProfileId || 'default-profile')),
    autoCuotaConfig: cloneDeepProfileValue(state.autoCuotaConfig || {}),
    subscriptions: cloneDeepProfileValue(markOwnedItems(state.subscriptions || [], state.activeUserProfileId || 'default-profile')),
    fixedExpenses: cloneDeepProfileValue(markOwnedItems(state.fixedExpenses || [], state.activeUserProfileId || 'default-profile')),
    gmailImportRules: cloneDeepProfileValue(markOwnedItems(state.gmailImportRules || [], state.activeUserProfileId || 'default-profile')),
    bankProfiles: cloneDeepProfileValue(markOwnedItems(state.bankProfiles || [], state.activeUserProfileId || 'default-profile')),
    importConfig: cloneDeepProfileValue(state.importConfig || {}),
    automationPrefs: cloneDeepProfileValue(state.automationPrefs || {}),
    income: cloneDeepProfileValue(state.income || {}),
    incomeSources: cloneDeepProfileValue(markOwnedItems(state.incomeSources || [], state.activeUserProfileId || 'default-profile')),
    incomeMonths: cloneDeepProfileValue(markOwnedItems(state.incomeMonths || [], state.activeUserProfileId || 'default-profile')),
    tcConfig: cloneDeepProfileValue(state.tcConfig || {}),
    tcCycles: cloneDeepProfileValue(state.tcCycles || []),
    ccCards: cloneDeepProfileValue(markOwnedItems(state.ccCards || [], state.activeUserProfileId || 'default-profile')),
    ccCycles: cloneDeepProfileValue(markOwnedItems(state.ccCycles || [], state.activeUserProfileId || 'default-profile')),
    ccActiveCard: state.ccActiveCard || null,
    savAccounts: cloneDeepProfileValue(markOwnedItems(state.savAccounts || [], state.activeUserProfileId || 'default-profile')),
    savGoals: cloneDeepProfileValue(markOwnedItems(state.savGoals || [], state.activeUserProfileId || 'default-profile')),
    savDeposits: cloneDeepProfileValue(markOwnedItems(state.savDeposits || [], state.activeUserProfileId || 'default-profile')),
    incViewCurrency: state.incViewCurrency || 'ARS',
    categories: cloneDeepProfileValue(state.categories || []),
    catRules: cloneDeepProfileValue(markOwnedItems(state.catRules || [], state.activeUserProfileId || 'default-profile')),
    catHistory: cloneDeepProfileValue(state.catHistory || {}),
    savingsGoal: state.savingsGoal || 20,
    alertThreshold: state.alertThreshold || 80,
    spendPct: state.spendPct || 100,
    insightsBufferMonths: state.insightsBufferMonths || 3,
    dashView: state.dashView || 'mes',
    dashMonth: state.dashMonth || null,
    dashTcCycle: state.dashTcCycle || null,
    chartMode: state.chartMode || 'bars',
    tendMode: state.tendMode || 'tc',
    activeTendCats: cloneDeepProfileValue(state.activeTendCats || null),
    compareMode: state.compareMode || 'month',
    repDesign: state.repDesign || 'executive',
    txnFilterMode: state.txnFilterMode || 'tc',
    txnCardFilter: state.txnCardFilter || '',
    lastGmailSync: state.lastGmailSync || null,
    dismissedNotifs: cloneDeepProfileValue(state.dismissedNotifs || []),
    decisionCenterCollapsed: !!state.decisionCenterCollapsed,
    dismissedAutoCuotas: cloneDeepProfileValue(state.dismissedAutoCuotas || []),
    gmailClientId: state.gmailClientId || localStorage.getItem('fin_gmail_client_id') || '',
    onboardingState: cloneDeepProfileValue(state.onboardingState || {})
  };
}

function syncActiveUserProfileFromState(saveNow=true){
  if(!state.activeUserProfileId) return;
  const profiles = ensureUserProfiles();
  const idx = profiles.findIndex(profile => profile.id === state.activeUserProfileId);
  if(idx < 0) return;
  const current = profiles[idx];
  profiles[idx] = {
    ...current,
    ...getCurrentProfileSnapshot(),
    name: current.name || state.userName || 'Perfil',
    note: current.note || ''
  };
  state.userProfiles = profiles;
  if(saveNow) saveState();
}

function getUserProfileStats(profile){
  const activeRules = (profile.gmailImportRules || []).filter(rule => rule.active !== false).length;
  const bankProfiles = (profile.bankProfiles || []).length;
  const cards = (profile.ccCards || []).length;
  const incomeMonths = (profile.incomeMonths || []).length;
  const txns = (profile.transactions || []).length;
  return {
    activeRules,
    bankProfiles,
    cards,
    incomeMonths,
    txns
  };
}

function saveActiveUserProfile(){
  const profiles = ensureUserProfiles();
  if(!state.activeUserProfileId){
    const newId = 'user-profile-' + Date.now().toString(36);
    profiles.unshift({
      id:newId,
      name: state.userName || 'Perfil principal',
      note:'Creado desde la configuración actual',
      ...getCurrentProfileSnapshot()
    });
    state.activeUserProfileId = newId;
  } else {
    const idx = profiles.findIndex(p => p.id === state.activeUserProfileId);
    if(idx >= 0){
      profiles[idx] = {
        ...profiles[idx],
        ...getCurrentProfileSnapshot()
      };
    }
  }
  state.userProfiles = profiles;
  saveState();
  renderSettingsPage();
  renderUserProfilesModal(state.activeUserProfileId);
  showToast('✓ Perfil activo guardado', 'success');
}

function duplicateCurrentUserProfile(){
  const payload = {
    id:'user-profile-' + Date.now().toString(36),
    name:`${state.userName || 'Perfil'} copia`,
    note:'Duplicado desde la configuración actual',
    ...getCurrentProfileSnapshot()
  };
  state.userProfiles = [payload, ...ensureUserProfiles()];
  state.activeUserProfileId = payload.id;
  saveState();
  renderSettingsPage();
  renderUserProfilesModal(payload.id);
  openUserProfileManager(payload.id);
  showToast('✓ Perfil duplicado', 'success');
}

function applyUserProfile(profileId){
  const profile = ensureUserProfiles().find(p => p.id === profileId);
  if(!profile) return;
  state.activeUserProfileId = profile.id;
  state.userName = profile.userName || profile.name || 'Usuario';
  state.profileTemplate = profile.profileTemplate || 'personal';
  state.transactions = (profile.transactions || []).map(txn => ({
    ...txn,
    date: txn.date ? new Date(txn.date) : new Date()
  }));
  state.imports = cloneDeepProfileValue(profile.imports || []);
  state.cuotas = cloneDeepProfileValue(profile.cuotas || []);
  state.autoCuotaConfig = cloneDeepProfileValue(profile.autoCuotaConfig || {});
  state.subscriptions = cloneDeepProfileValue(profile.subscriptions || []);
  state.fixedExpenses = cloneDeepProfileValue(profile.fixedExpenses || []);
  state.gmailImportRules = cloneDeepProfileValue(profile.gmailImportRules || getDefaultGmailImportRules());
  state.bankProfiles = cloneDeepProfileValue(profile.bankProfiles || []);
  state.importConfig = cloneDeepProfileValue(profile.importConfig || state.importConfig || {});
  state.automationPrefs = cloneDeepProfileValue(profile.automationPrefs || {});
  state.income = cloneDeepProfileValue(profile.income || state.income || {});
  state.incomeSources = cloneDeepProfileValue(profile.incomeSources || []);
  state.incomeMonths = cloneDeepProfileValue(profile.incomeMonths || []);
  state.tcConfig = { ...(state.tcConfig || {}), ...(profile.tcConfig || {}) };
  state.tcCycles = cloneDeepProfileValue(profile.tcCycles || []);
  state.ccCards = cloneDeepProfileValue(profile.ccCards || []);
  state.ccCycles = cloneDeepProfileValue(profile.ccCycles || []);
  state.ccActiveCard = profile.ccActiveCard || null;
  state.savAccounts = cloneDeepProfileValue(profile.savAccounts || []);
  state.savGoals = cloneDeepProfileValue(profile.savGoals || []);
  state.savDeposits = cloneDeepProfileValue(profile.savDeposits || []);
  state.incViewCurrency = profile.incViewCurrency || state.incViewCurrency || 'ARS';
  state.categories = cloneDeepProfileValue(profile.categories || state.categories || []);
  state.catRules = cloneDeepProfileValue(profile.catRules || []);
  state.catHistory = cloneDeepProfileValue(profile.catHistory || {});
  state.savingsGoal = profile.savingsGoal || state.savingsGoal || 20;
  state.alertThreshold = profile.alertThreshold || state.alertThreshold || 80;
  state.spendPct = profile.spendPct || state.spendPct || 100;
  state.insightsBufferMonths = profile.insightsBufferMonths || state.insightsBufferMonths || 3;
  state.dashView = profile.dashView || state.dashView || 'mes';
  state.dashMonth = profile.dashMonth || null;
  state.dashTcCycle = profile.dashTcCycle || null;
  state.chartMode = profile.chartMode || state.chartMode || 'bars';
  state.tendMode = profile.tendMode || state.tendMode || 'tc';
  state.activeTendCats = cloneDeepProfileValue(profile.activeTendCats || null);
  state.compareMode = profile.compareMode || state.compareMode || 'month';
  state.repDesign = profile.repDesign || state.repDesign || 'executive';
  state.txnFilterMode = profile.txnFilterMode || state.txnFilterMode || 'tc';
  state.txnCardFilter = profile.txnCardFilter || '';
  state.lastGmailSync = profile.lastGmailSync || null;
  state.dismissedNotifs = cloneDeepProfileValue(profile.dismissedNotifs || []);
  state.decisionCenterCollapsed = !!profile.decisionCenterCollapsed;
  state.dismissedAutoCuotas = cloneDeepProfileValue(profile.dismissedAutoCuotas || []);
  state.onboardingState = { ...(state.onboardingState || {}), ...(profile.onboardingState || {}) };
  if(profile.gmailClientId){
    state.gmailClientId = profile.gmailClientId;
    localStorage.setItem('fin_gmail_client_id', profile.gmailClientId);
  }
  saveState();
  if(typeof refreshAll === 'function') refreshAll();
  renderSettingsPage();
  renderUserProfilesModal(profile.id);
  if(typeof renderOnboardingWizard === 'function') renderOnboardingWizard();
  if(document.getElementById('page-insights')?.classList.contains('active') && typeof generateInsights === 'function') generateInsights();
  showToast('✓ Perfil aplicado', 'success');
}

function ensureAutomationPrefs(){
  if(!state.automationPrefs || typeof state.automationPrefs !== 'object') state.automationPrefs = {};
  state.automationPrefs = {
    weeklyReport: !!state.automationPrefs.weeklyReport,
    spendingAlerts: state.automationPrefs.spendingAlerts !== false,
    backupReminder: state.automationPrefs.backupReminder !== false,
    cardCloseReminder: state.automationPrefs.cardCloseReminder !== false,
    ...state.automationPrefs
  };
  return state.automationPrefs;
}

function resetUserProfileEditor(){
  const idEl = document.getElementById('user-profile-id');
  const delBtn = document.getElementById('user-profile-delete-btn');
  if(idEl) idEl.value = '';
  if(delBtn) delBtn.style.display = 'none';
  const nameEl = document.getElementById('user-profile-name');
  const templateEl = document.getElementById('user-profile-template');
  const noteEl = document.getElementById('user-profile-note');
  if(nameEl) nameEl.value = state.userName || 'Nuevo perfil';
  if(templateEl) templateEl.value = state.profileTemplate || 'personal';
  if(noteEl) noteEl.value = '';
}

function renderUserProfilesModal(editingId){
  const listEl = document.getElementById('user-profiles-list');
  if(!listEl) return;
  const profiles = ensureUserProfiles();
  if(!profiles.length){
    listEl.innerHTML = `
      <div class="settings-method-item">
        <div class="settings-method-title">Todavía no hay perfiles guardados</div>
        <div class="settings-method-sub">Guardá la configuración actual para empezar a alternar entre distintas personas o contextos.</div>
      </div>
    `;
    return;
  }
  listEl.innerHTML = profiles.map(profile => `
    <div class="settings-rule-row">
      <div class="settings-rule-main">
        <div class="settings-rule-title">${profile.name}${state.activeUserProfileId===profile.id ? ' · Activo' : ''}</div>
        <div class="settings-rule-sub">${profile.note || 'Sin notas'} · ${profile.profileTemplate || 'personal'}</div>
        <div class="settings-rule-meta">
          <span class="settings-rule-chip">${getUserProfileStats(profile).activeRules} regla${getUserProfileStats(profile).activeRules===1?'':'s'} Gmail</span>
          <span class="settings-rule-chip">${getUserProfileStats(profile).bankProfiles} banco${getUserProfileStats(profile).bankProfiles===1?'':'s'} / tarjeta${getUserProfileStats(profile).bankProfiles===1?'':'s'}</span>
          <span class="settings-rule-chip">${getUserProfileStats(profile).cards} tarjeta${getUserProfileStats(profile).cards===1?'':'s'} configurada${getUserProfileStats(profile).cards===1?'':'s'}</span>
          <span class="settings-rule-chip">${getUserProfileStats(profile).incomeMonths} mes${getUserProfileStats(profile).incomeMonths===1?'':'es'} con ingresos</span>
        </div>
      </div>
      <div class="settings-rule-actions">
        <button class="dashboard-widget-mini ${state.activeUserProfileId===profile.id?'primary':''}" onclick="applyUserProfile('${profile.id}')">${state.activeUserProfileId===profile.id?'Activo':'Aplicar'}</button>
        <button class="dashboard-widget-mini" onclick="openUserProfileManager('${profile.id}')">${editingId===profile.id?'Editando':'Editar'}</button>
      </div>
    </div>
  `).join('');
}

function openUserProfileManager(profileId){
  ensureUserProfiles();
  openModal('modal-user-profiles');
  renderUserProfilesModal(profileId);
  const profile = state.userProfiles.find(item => item.id === profileId);
  if(!profile){
    resetUserProfileEditor();
    return;
  }
  document.getElementById('user-profile-id').value = profile.id;
  document.getElementById('user-profile-name').value = profile.name || '';
  document.getElementById('user-profile-template').value = profile.profileTemplate || 'personal';
  document.getElementById('user-profile-note').value = profile.note || '';
  document.getElementById('user-profile-delete-btn').style.display = 'inline-flex';
}

function saveUserProfile(){
  const id = document.getElementById('user-profile-id')?.value || '';
  const payload = {
    id: id || 'user-profile-' + Date.now().toString(36),
    name: (document.getElementById('user-profile-name')?.value || '').trim() || 'Perfil',
    profileTemplate: document.getElementById('user-profile-template')?.value || 'personal',
    note: (document.getElementById('user-profile-note')?.value || '').trim(),
    ...getCurrentProfileSnapshot()
  };
  payload.userName = payload.name;
  payload.profileTemplate = document.getElementById('user-profile-template')?.value || payload.profileTemplate || 'personal';
  const profiles = [...ensureUserProfiles()];
  const idx = profiles.findIndex(item => item.id === payload.id);
  if(idx >= 0) profiles[idx] = { ...profiles[idx], ...payload };
  else profiles.unshift(payload);
  state.userProfiles = profiles;
  state.activeUserProfileId = payload.id;
  saveState();
  if(typeof refreshAll === 'function') refreshAll();
  renderSettingsPage();
  renderUserProfilesModal(payload.id);
  openUserProfileManager(payload.id);
  showToast('✓ Perfil guardado', 'success');
}

function deleteCurrentUserProfile(){
  const id = document.getElementById('user-profile-id')?.value;
  if(!id) return;
  if(!confirm('¿Eliminar este perfil de usuario?')) return;
  state.userProfiles = ensureUserProfiles().filter(item => item.id !== id);
  if(state.activeUserProfileId === id) state.activeUserProfileId = state.userProfiles[0]?.id || null;
  saveState();
  if(state.activeUserProfileId) applyUserProfile(state.activeUserProfileId);
  resetUserProfileEditor();
  renderSettingsPage();
  renderUserProfilesModal();
  showToast('Perfil eliminado', 'info');
}

function openUniversalImport(mode){
  nav('import');
  setTimeout(()=>{
    if(mode==='paste'){
      const textarea = document.getElementById('paste-input');
      if(textarea) textarea.focus();
    }else if(mode==='csv'){
      const input = document.getElementById('csvInput');
      if(input) input.click();
    }else if(mode==='manual'){
      if(typeof toggleManualForm === 'function'){
        const body = document.getElementById('manual-form-body');
        if(body && body.style.display==='none') toggleManualForm();
      }
      const desc = document.getElementById('mf-desc');
      if(desc) desc.focus();
    }
  },120);
}

function openImportAssistant(){
  renderImportAssistant();
  openModal('modal-import-assistant');
}

function renderImportAssistant(){
  const body = document.getElementById('import-assistant-body');
  const actions = document.getElementById('import-assistant-actions');
  if(!body || !actions) return;
  const rules = getActiveGmailImportRules().length;
  const profiles = ensureBankProfiles().length;
  body.innerHTML = `
    <div class="onboarding-wizard-shell">
      <div class="onboarding-wizard-panel">
        <div class="onboarding-wizard-title">¿Cómo te conviene cargar tus gastos?</div>
        <div class="onboarding-wizard-sub">Elegí según cómo te informa tu banco y qué tan automática querés la experiencia. La app ya puede convivir con varios métodos a la vez.</div>
        <div class="onboarding-wizard-grid">
          <div class="onboarding-wizard-note"><strong>Gmail / alertas</strong><br>Mejor si tu banco manda mails por compra o resumen.<br><br><strong>Hoy:</strong> ${rules} regla${rules===1?'':'s'} activa${rules===1?'':'s'}.</div>
          <div class="onboarding-wizard-note"><strong>Texto pegado</strong><br>Ideal para cualquier banco si copiás el resumen y querés revisar antes de importar.</div>
          <div class="onboarding-wizard-note"><strong>Archivo / CSV</strong><br>Útil cuando el banco deja descargar movimientos. Hoy es la vía más limpia para formatos estructurados.</div>
          <div class="onboarding-wizard-note"><strong>Perfiles bancarios</strong><br>Ya hay ${profiles} perfil${profiles===1?'':'es'} guardado${profiles===1?'':'s'} para bancos o tarjetas distintas.</div>
        </div>
        <div class="onboarding-wizard-bullets">
          <div><strong>Si recibís alertas por mail:</strong> conectá Google y armá reglas Gmail.</div>
          <div><strong>Si tu banco no manda alertas claras:</strong> usá texto pegado o archivo.</div>
          <div><strong>Si querés compartir la app con otra persona:</strong> primero creá su perfil bancario y después definí su método preferido.</div>
        </div>
      </div>
    </div>
  `;
  actions.innerHTML = `
    <button class="btn btn-ghost" onclick="closeModal('modal-import-assistant')">Cerrar</button>
    <button class="btn btn-ghost" onclick="openCloudSync(event)">Conectar Google</button>
    <button class="btn btn-ghost" onclick="openGmailRuleManager()">Reglas Gmail</button>
    <button class="btn btn-ghost" onclick="openUniversalImport('paste');closeModal('modal-import-assistant')">Texto pegado</button>
    <button class="btn btn-primary" onclick="openUniversalImport('csv');closeModal('modal-import-assistant')">Archivo / CSV</button>
  `;
}

function toggleAutomationPref(key){
  ensureAutomationPrefs();
  state.automationPrefs[key] = !state.automationPrefs[key];
  syncActiveUserProfileFromState(false);
  saveState();
  renderSettingsPage();
  showToast('✓ Automatización actualizada', 'success');
}

function renderSettingsPage(){
  ensureGmailImportRules();
  ensureBankProfiles();
  ensureUserProfiles();
  ensureAutomationPrefs();
  updateLastBackupLabel();
  const onboardingEl = document.getElementById('settings-onboarding-shell');
  const rulesEl = document.getElementById('settings-gmail-rules-shell');
  const importEl = document.getElementById('settings-import-shell');
  const bankEl = document.getElementById('settings-bank-profiles-shell');
  const usersEl = document.getElementById('settings-user-profiles-shell');
  const multiEl = document.getElementById('settings-multiuser-shell');
  const overviewEl = document.getElementById('settings-overview-shell');
  const safetyEl = document.getElementById('settings-safety-shell');
  const advancedPanel = document.getElementById('settings-advanced-panel');
  const advancedArrow = document.getElementById('settings-advanced-arrow');
  if(!onboardingEl || !rulesEl || !importEl || !bankEl || !usersEl || !multiEl || !overviewEl || !safetyEl || !advancedPanel || !advancedArrow) return;

  const activeRules = getActiveGmailImportRules().length;
  const backupRaw = localStorage.getItem('fin_last_backup');
  const backupLabel = backupRaw ? new Date(backupRaw).toLocaleDateString('es-AR') : 'Pendiente';
  const activeProfile = (state.userProfiles || []).find(profile => profile.id === state.activeUserProfileId);
  const connectedGoogle = isGoogleConnected();
  overviewEl.innerHTML = `
    <div class="settings-overview-card profile">
      <div class="settings-overview-kicker">Perfil activo</div>
      <div class="settings-overview-value">${activeProfile?.name || state.userName || 'Sin perfil'}</div>
      <div class="settings-overview-sub">${activeProfile?.profileTemplate || state.profileTemplate || 'personal'}</div>
    </div>
    <div class="settings-overview-card google">
      <div class="settings-overview-kicker">Google</div>
      <div class="settings-overview-value">${connectedGoogle ? 'Conectado' : 'Pendiente'}</div>
      <div class="settings-overview-sub">${activeRules} regla${activeRules===1?'':'s'} Gmail activa${activeRules===1?'':'s'}</div>
    </div>
    <div class="settings-overview-card bank">
      <div class="settings-overview-kicker">Bancos</div>
      <div class="settings-overview-value">${(state.bankProfiles || []).length}</div>
      <div class="settings-overview-sub">perfil${(state.bankProfiles || []).length===1?'':'es'} bancario${(state.bankProfiles || []).length===1?'':'s'}</div>
    </div>
    <div class="settings-overview-card backup">
      <div class="settings-overview-kicker">Backup</div>
      <div class="settings-overview-value">${backupLabel}</div>
      <div class="settings-overview-sub">${backupRaw ? 'última copia guardada' : 'sin respaldo reciente'}</div>
    </div>
  `;

  const advancedOpen = localStorage.getItem('fin_settings_advanced_open') === '1';
  advancedPanel.style.display = advancedOpen ? 'flex' : 'none';
  advancedArrow.textContent = advancedOpen ? '⌄' : '›';

  const checklist = getOnboardingChecklist();
  onboardingEl.innerHTML = checklist.map(step => `
    <div class="settings-status-row">
      <div class="settings-status-badge">${step.icon}</div>
      <div class="settings-status-copy">
        <div class="settings-status-title">${step.title}</div>
        <div class="settings-status-sub">${step.sub}</div>
      </div>
      <button class="dashboard-widget-mini ${step.done ? 'primary' : ''}" onclick="${step.onclick}">${step.action}</button>
    </div>
  `).join('');

  safetyEl.innerHTML = `
    <div class="settings-safety-item backup">
      <div class="settings-safety-icon">🛟</div>
      <div class="settings-safety-copy">
        <div class="settings-safety-title">Descargar backup</div>
        <div class="settings-safety-sub">Guardá una copia completa antes de importar, limpiar o probar cambios grandes.</div>
      </div>
      <button class="dashboard-widget-mini primary" onclick="exportBackupJSON()">Guardar</button>
    </div>
    <div class="settings-safety-item restore">
      <div class="settings-safety-icon">♻️</div>
      <div class="settings-safety-copy">
        <div class="settings-safety-title">Restaurar backup</div>
        <div class="settings-safety-sub">Recuperá una copia previa si querés volver a un estado estable.</div>
      </div>
      <button class="dashboard-widget-mini" onclick="document.getElementById('restore-json-input')?.click()">Restaurar</button>
    </div>
    <div class="settings-safety-item export">
      <div class="settings-safety-icon">📄</div>
      <div class="settings-safety-copy">
        <div class="settings-safety-title">Exportar movimientos</div>
        <div class="settings-safety-sub">Bajá tus transacciones en CSV para revisar, auditar o compartir por fuera de la app.</div>
      </div>
      <button class="dashboard-widget-mini" onclick="exportarCSV()">Exportar</button>
    </div>
  `;

  const rules = ensureGmailImportRules();
  rulesEl.innerHTML = `
    <div class="gmail-rules-shell-head">
      <div class="gmail-rules-shell-copy">
        <div class="settings-rule-title">Reglas activas</div>
        <div class="settings-rule-sub">Cada regla define qué correos mirar y cómo asignarlos dentro de la app.</div>
      </div>
      <div class="settings-module-actions settings-module-actions-tight">
        <button class="dashboard-widget-mini primary" onclick="openGmailRuleManager()">+ Nueva regla</button>
      </div>
    </div>
    ${rules.map(rule => {
      const summary = summarizeGmailRule(rule);
      return `
        <div class="settings-rule-row gmail-rule-row-rich">
          <div class="settings-rule-main">
            <div class="settings-rule-title">${rule.name}</div>
            <div class="gmail-rule-summary-list">
              <div class="gmail-rule-summary-item"><span class="gmail-rule-summary-label">Mira</span><span>${summary.sender}</span></div>
              <div class="gmail-rule-summary-item"><span class="gmail-rule-summary-label">Filtro</span><span>${summary.query}</span></div>
              <div class="gmail-rule-summary-item"><span class="gmail-rule-summary-label">Asigna</span><span>${summary.assign}</span></div>
            </div>
            <div class="settings-rule-meta">
              <span class="settings-rule-chip">${rule.active!==false?'Activa':'Pausada'}</span>
              <span class="settings-rule-chip">${getGmailRuleImportKind(rule)==='subscription'?'Suscripción':'Movimiento'}</span>
              <span class="settings-rule-chip">${rule.bank || 'Sin banco'}</span>
              <span class="settings-rule-chip">${formatGmailRuleCardType(rule.cardType)}</span>
            </div>
          </div>
          <div class="settings-rule-actions">
            <button class="dashboard-widget-mini" onclick="toggleGmailRule('${rule.id}')">${rule.active!==false?'Pausar':'Activar'}</button>
            <button class="dashboard-widget-mini primary" onclick="openGmailRuleManager('${rule.id}')">Editar</button>
          </div>
        </div>
      `;
    }).join('')}
  `;

  importEl.innerHTML = `
    <div class="settings-method-item">
      <div class="settings-method-head">
        <div>
          <div class="settings-method-title">Pegar resumen</div>
          <div class="settings-method-sub">Ideal para cualquier banco. Copiás el resumen, lo pegás y la app intenta interpretarlo antes de importar.</div>
        </div>
      </div>
      <div class="settings-method-actions">
        <button class="dashboard-widget-mini primary" onclick="openUniversalImport('paste')">Pegar ahora</button>
        <button class="dashboard-widget-mini" onclick="nav('import')">Abrir importación</button>
      </div>
    </div>
    <div class="settings-method-item">
      <div class="settings-method-head">
        <div>
          <div class="settings-method-title">Importar archivo</div>
          <div class="settings-method-sub">CSV, backup o archivo estructurado cuando el banco ya te deja descargar movimientos.</div>
        </div>
      </div>
      <div class="settings-method-actions">
        <button class="dashboard-widget-mini primary" onclick="openUniversalImport('csv')">Subir archivo</button>
        <button class="dashboard-widget-mini" onclick="nav('import')">Ver opciones</button>
      </div>
      <div class="settings-inline-note">Hoy la lectura más afinada está orientada a CSV compatibles y backups; después podemos sumar asistentes por banco.</div>
    </div>
    <div class="settings-method-item">
      <div class="settings-method-head">
        <div>
          <div class="settings-method-title">Gmail / alertas bancarias</div>
          <div class="settings-method-sub">Lee emails configurados por regla y transforma compras en movimientos revisables antes de importar.</div>
        </div>
      </div>
      <div class="settings-method-actions">
        <button class="dashboard-widget-mini primary" onclick="openCloudSync(event)">Conectar Google</button>
        <button class="dashboard-widget-mini" onclick="openGmailRuleManager()">Ver reglas</button>
      </div>
    </div>
  `;

  const bankProfiles = ensureBankProfiles();
  const userProfiles = ensureUserProfiles();

  if(userProfiles.length){
    usersEl.innerHTML = userProfiles.map(profile => `
      <div class="settings-rule-row">
        <div class="settings-rule-main">
          <div class="settings-rule-title">${profile.name}${state.activeUserProfileId===profile.id ? ' · Activo' : ''}</div>
          <div class="settings-rule-sub">${profile.note || 'Sin notas'} · ${profile.profileTemplate || 'personal'}</div>
          <div class="settings-rule-meta">
            <span class="settings-rule-chip">${getUserProfileStats(profile).activeRules} regla${getUserProfileStats(profile).activeRules===1?'':'s'} Gmail</span>
            <span class="settings-rule-chip">${getUserProfileStats(profile).bankProfiles} banco${getUserProfileStats(profile).bankProfiles===1?'':'s'} / tarjeta${getUserProfileStats(profile).bankProfiles===1?'':'s'}</span>
            <span class="settings-rule-chip">${getUserProfileStats(profile).cards} tarjeta${getUserProfileStats(profile).cards===1?'':'s'} configurada${getUserProfileStats(profile).cards===1?'':'s'}</span>
            <span class="settings-rule-chip">${getUserProfileStats(profile).incomeMonths} mes${getUserProfileStats(profile).incomeMonths===1?'':'es'} con ingresos</span>
            <span class="settings-rule-chip">${getUserProfileStats(profile).txns} movimiento${getUserProfileStats(profile).txns===1?'':'s'}</span>
          </div>
        </div>
        <div class="settings-rule-actions">
          <button class="dashboard-widget-mini ${state.activeUserProfileId===profile.id?'primary':''}" onclick="applyUserProfile('${profile.id}')">${state.activeUserProfileId===profile.id?'Activo':'Aplicar'}</button>
          <button class="dashboard-widget-mini" onclick="openUserProfileManager('${profile.id}')">Editar</button>
        </div>
      </div>
    `).join('');
  } else {
    usersEl.innerHTML = `
      <div class="settings-method-item">
        <div class="settings-method-title">Solo está la configuración actual</div>
        <div class="settings-method-sub">Guardala como perfil para empezar a alternar entre distintas personas o contextos.</div>
        <div class="settings-method-actions">
          <button class="dashboard-widget-mini primary" onclick="saveActiveUserProfile()">Guardar como perfil</button>
        </div>
      </div>
    `;
  }

  if(bankProfiles.length){
    bankEl.innerHTML = bankProfiles.map(profile => `
      <div class="settings-rule-row">
        <div class="settings-rule-main">
          <div class="settings-rule-title">${profile.name}</div>
          <div class="settings-rule-sub">${profile.bank || 'Sin banco'} · ${profile.card || 'Sin tarjeta'}${profile.note ? ' · ' + profile.note : ''}</div>
          <div class="settings-rule-meta">
            <span class="settings-rule-chip">${profile.methodLabel || 'Sin método'}</span>
            ${profile.closeDay ? `<span class="settings-rule-chip">Cierre ${profile.closeDay}</span>` : ''}
            ${profile.dueDay ? `<span class="settings-rule-chip">Vence ${profile.dueDay}</span>` : ''}
          </div>
        </div>
        <div class="settings-rule-actions">
          <button class="dashboard-widget-mini" onclick="openBankProfileManager('${profile.id}')">Editar</button>
        </div>
      </div>
    `).join('');
  } else {
    bankEl.innerHTML = `
      <div class="settings-method-item">
        <div class="settings-method-title">Todavía no hay perfiles guardados</div>
        <div class="settings-method-sub">Creá uno para dejar preparado el banco, la tarjeta, el cierre y la vía de importación preferida de cada persona.</div>
        <div class="settings-method-actions">
          <button class="dashboard-widget-mini primary" onclick="openBankProfileManager()">Crear primer perfil</button>
        </div>
      </div>
    `;
  }

  multiEl.innerHTML = `
    <div class="settings-list-item"><strong>Perfil activo</strong><span>${activeProfile?.name || 'Sin perfil'} usa su propia configuración de Google, bancos, reglas e ingresos.</span></div>
    <div class="settings-list-item"><strong>Datos aislados</strong><span>Movimientos, compromisos, importaciones, ahorros y layout del dashboard ya quedan asociados al perfil activo.</span></div>
    <div class="settings-list-item"><strong>Preparada para otros</strong><span>Podés duplicar un perfil y armar rápidamente la base de un amigo o familiar sin mezclar su información con la tuya.</span></div>
  `;
}

function toggleSettingsAdvanced(){
  const panel = document.getElementById('settings-advanced-panel');
  const arrow = document.getElementById('settings-advanced-arrow');
  if(!panel || !arrow) return;
  const opening = panel.style.display === 'none';
  panel.style.display = opening ? 'flex' : 'none';
  arrow.textContent = opening ? '⌄' : '›';
  localStorage.setItem('fin_settings_advanced_open', opening ? '1' : '0');
}

function resetBankProfileEditor(){
  const idEl = document.getElementById('bank-profile-id');
  const delBtn = document.getElementById('bank-profile-delete-btn');
  if(idEl) idEl.value = '';
  if(delBtn) delBtn.style.display = 'none';
  const defaults = {
    name:'Nuevo perfil',
    bank:'Banco',
    card:'Tarjeta o cuenta',
    method:'gmail',
    close:'',
    due:'',
    note:''
  };
  const map = {
    'bank-profile-name':defaults.name,
    'bank-profile-bank':defaults.bank,
    'bank-profile-card':defaults.card,
    'bank-profile-method':defaults.method,
    'bank-profile-close':defaults.close,
    'bank-profile-due':defaults.due,
    'bank-profile-note':defaults.note
  };
  Object.entries(map).forEach(([id,val])=>{ const el=document.getElementById(id); if(el) el.value = val; });
}

function renderBankProfilesModal(editingId){
  const listEl = document.getElementById('bank-profiles-list');
  if(!listEl) return;
  const profiles = ensureBankProfiles();
  if(!profiles.length){
    listEl.innerHTML = `
      <div class="settings-method-item">
        <div class="settings-method-title">Sin perfiles todavía</div>
        <div class="settings-method-sub">Creá uno para dejar guardado el banco, la tarjeta y el método de importación recomendado.</div>
      </div>
    `;
    return;
  }
  listEl.innerHTML = profiles.map(profile => `
    <div class="settings-rule-row">
      <div class="settings-rule-main">
        <div class="settings-rule-title">${profile.name}</div>
        <div class="settings-rule-sub">${profile.bank || 'Sin banco'} · ${profile.card || 'Sin tarjeta'}${profile.note ? ' · ' + profile.note : ''}</div>
        <div class="settings-rule-meta">
          <span class="settings-rule-chip">${profile.methodLabel || 'Sin método'}</span>
          ${profile.closeDay ? `<span class="settings-rule-chip">Cierre ${profile.closeDay}</span>` : ''}
          ${profile.dueDay ? `<span class="settings-rule-chip">Vence ${profile.dueDay}</span>` : ''}
        </div>
      </div>
      <div class="settings-rule-actions">
        <button class="dashboard-widget-mini primary" onclick="openBankProfileManager('${profile.id}')">${editingId===profile.id?'Editando':'Editar'}</button>
      </div>
    </div>
  `).join('');
}

function openBankProfileManager(profileId){
  ensureBankProfiles();
  openModal('modal-bank-profiles');
  renderBankProfilesModal(profileId);
  const profile = state.bankProfiles.find(item => item.id === profileId);
  if(!profile){
    resetBankProfileEditor();
    return;
  }
  document.getElementById('bank-profile-id').value = profile.id;
  document.getElementById('bank-profile-name').value = profile.name || '';
  document.getElementById('bank-profile-bank').value = profile.bank || '';
  document.getElementById('bank-profile-card').value = profile.card || '';
  document.getElementById('bank-profile-method').value = profile.method || 'gmail';
  document.getElementById('bank-profile-close').value = profile.closeDay || '';
  document.getElementById('bank-profile-due').value = profile.dueDay || '';
  document.getElementById('bank-profile-note').value = profile.note || '';
  document.getElementById('bank-profile-delete-btn').style.display = 'inline-flex';
}

function saveBankProfile(){
  ensureBankProfiles();
  const id = document.getElementById('bank-profile-id')?.value || '';
  const method = document.getElementById('bank-profile-method')?.value || 'gmail';
  const labels = { gmail:'Gmail', paste:'Texto pegado', csv:'Archivo / CSV', manual:'Manual' };
  const payload = {
    id: id || 'bank-profile-' + Date.now().toString(36),
    name: (document.getElementById('bank-profile-name')?.value || '').trim() || 'Perfil bancario',
    bank: (document.getElementById('bank-profile-bank')?.value || '').trim() || 'Banco',
    card: (document.getElementById('bank-profile-card')?.value || '').trim() || 'Tarjeta o cuenta',
    method,
    methodLabel: labels[method] || 'Manual',
    closeDay: parseInt(document.getElementById('bank-profile-close')?.value || '', 10) || null,
    dueDay: parseInt(document.getElementById('bank-profile-due')?.value || '', 10) || null,
    note: (document.getElementById('bank-profile-note')?.value || '').trim()
  };
  const profiles = [...ensureBankProfiles()];
  const idx = profiles.findIndex(item => item.id === payload.id);
  if(idx >= 0) profiles[idx] = { ...profiles[idx], ...payload };
  else profiles.unshift(payload);
  state.bankProfiles = profiles;
  syncActiveUserProfileFromState(false);
  saveState();
  renderSettingsPage();
  renderOnboardingWizard();
  renderBankProfilesModal(payload.id);
  openBankProfileManager(payload.id);
  showToast('✓ Perfil bancario guardado', 'success');
}

function deleteCurrentBankProfile(){
  const id = document.getElementById('bank-profile-id')?.value;
  if(!id) return;
  if(!confirm('¿Eliminar este perfil bancario?')) return;
  state.bankProfiles = ensureBankProfiles().filter(item => item.id !== id);
  syncActiveUserProfileFromState(false);
  saveState();
  resetBankProfileEditor();
  renderSettingsPage();
  renderBankProfilesModal();
  showToast('Perfil bancario eliminado', 'info');
}

function getOnboardingWizardSteps(){
  return [
    {
      id:'welcome',
      kicker:'Paso 1',
      title:'Base personal',
      done:!!state.userName && !!state.profileTemplate
    },
    {
      id:'google',
      kicker:'Paso 2',
      title:'Google',
      done:isGoogleConnected()
    },
    {
      id:'capture',
      kicker:'Paso 3',
      title:'Captura',
      done:getActiveGmailImportRules().length > 0
    },
    {
      id:'banking',
      kicker:'Paso 4',
      title:'Banco y tarjeta',
      done:ensureBankProfiles().length > 0 || (state.ccCards||[]).length > 0 || (state.tcCycles||[]).length > 0
    },
    {
      id:'income',
      kicker:'Paso 5',
      title:'Ingresos',
      done:!!((state.incomeMonths||[]).length || (state.incomeSources||[]).length || (state.income?.ars||0) || (state.income?.usd||0))
    }
  ];
}

function getOnboardingCurrentStep(){
  const saved = Number(state.onboardingState?.currentStep || 0);
  return Math.max(0, Math.min(saved, getOnboardingWizardSteps().length - 1));
}

function setOnboardingCurrentStep(step){
  state.onboardingState = { ...(state.onboardingState || {}), currentStep: step };
  saveState();
}

function openOnboardingWizard(step){
  if(typeof step === 'number') setOnboardingCurrentStep(step);
  renderOnboardingWizard();
  openModal('modal-onboarding-wizard');
}

function onboardingPrevStep(){
  const next = Math.max(0, getOnboardingCurrentStep() - 1);
  setOnboardingCurrentStep(next);
  renderOnboardingWizard();
}

function onboardingNextStep(){
  const next = Math.min(getOnboardingWizardSteps().length - 1, getOnboardingCurrentStep() + 1);
  setOnboardingCurrentStep(next);
  renderOnboardingWizard();
}

function saveOnboardingIdentity(){
  const name = (document.getElementById('onboarding-user-name')?.value || '').trim();
  const profile = document.getElementById('onboarding-profile')?.value || state.profileTemplate || 'personal';
  if(name) state.userName = name;
  state.profileTemplate = profile;
  state.onboardingState = { ...(state.onboardingState || {}), welcome: true };
  syncActiveUserProfileFromState(false);
  saveState();
  renderSettingsPage();
  renderOnboardingWizard();
  showToast('✓ Base personal guardada', 'success');
}

function completeOnboardingWizard(){
  state.onboardingState = {
    ...(state.onboardingState || {}),
    completed: true,
    completedAt: new Date().toISOString(),
    currentStep: getOnboardingWizardSteps().length - 1
  };
  saveState();
  renderSettingsPage();
  closeModal('modal-onboarding-wizard');
  showToast('✓ Onboarding completado', 'success');
}

function renderOnboardingWizard(){
  const body = document.getElementById('onboarding-wizard-body');
  const actions = document.getElementById('onboarding-wizard-actions');
  if(!body || !actions) return;

  const steps = getOnboardingWizardSteps();
  const stepIndex = getOnboardingCurrentStep();
  const step = steps[stepIndex];
  const progress = steps.map((item, idx) => `
    <div class="onboarding-wizard-step ${idx===stepIndex?'active':''} ${item.done?'done':''}">
      <div class="onboarding-wizard-step-kicker">${item.kicker}</div>
      <div class="onboarding-wizard-step-title">${item.title}</div>
    </div>
  `).join('');

  let panel = '';
  if(step.id === 'welcome'){
    panel = `
      <div class="onboarding-wizard-panel">
        <div class="onboarding-wizard-title">Arranquemos por la base</div>
        <div class="onboarding-wizard-sub">Definí cómo se llama la persona que usa la app y qué perfil le conviene. Esto orienta dashboard, lectura y configuración inicial sin encasillarlo.</div>
        <div class="onboarding-wizard-grid">
          <div>
            <label class="field-label-premium">Nombre</label>
            <input id="onboarding-user-name" type="text" class="field-control-premium" value="${esc(state.userName || '')}" placeholder="Ej: Pedro">
          </div>
          <div>
            <label class="field-label-premium">Perfil de uso</label>
            <select id="onboarding-profile" class="field-control-premium">
              <option value="personal" ${state.profileTemplate==='personal'?'selected':''}>Personal</option>
              <option value="ahorro" ${state.profileTemplate==='ahorro'?'selected':''}>Modo ahorro</option>
              <option value="familiar" ${state.profileTemplate==='familiar'?'selected':''}>Familiar</option>
              <option value="freelance" ${state.profileTemplate==='freelance'?'selected':''}>Freelance</option>
            </select>
          </div>
        </div>
        <div class="onboarding-wizard-note">No es definitivo. Después se puede cambiar desde Configuración sin perder datos.</div>
      </div>
    `;
  } else if(step.id === 'google'){
    panel = `
      <div class="onboarding-wizard-panel">
        <div class="onboarding-wizard-title">Conectá Google una sola vez</div>
        <div class="onboarding-wizard-sub">Esto habilita sincronización entre dispositivos, respaldo en Drive y lectura de Gmail para importar gastos automáticamente.</div>
        <div class="onboarding-wizard-bullets">
          <div>Drive mantiene los datos sincronizados y recuperables.</div>
          <div>Gmail permite leer correos bancarios y convertirlos en movimientos revisables.</div>
          <div>La conexión es personal: cada usuario usa su propia cuenta.</div>
        </div>
        <div class="onboarding-wizard-actions">
          <button class="btn btn-primary" onclick="openCloudSync(event)">Conectar Google</button>
          <button class="btn btn-ghost" onclick="nav('settings');closeModal('modal-onboarding-wizard')">Abrir configuración</button>
        </div>
      </div>
    `;
  } else if(step.id === 'capture'){
    panel = `
      <div class="onboarding-wizard-panel">
        <div class="onboarding-wizard-title">Elegí cómo capturar gastos</div>
        <div class="onboarding-wizard-sub">La app ya queda preparada para distintos bancos y distintos hábitos. Lo importante es elegir por dónde van a entrar los movimientos.</div>
        <div class="onboarding-wizard-grid">
          <div class="onboarding-wizard-note"><strong>Gmail</strong><br>Ideal si el banco manda alertas por compra o resumen. Podés definir remitente, búsqueda y tarjeta asociada.</div>
          <div class="onboarding-wizard-note"><strong>Texto pegado / archivo</strong><br>Sirve para cualquier banco cuando copiás el resumen o descargás un archivo.</div>
        </div>
        <div class="onboarding-wizard-actions">
          <button class="btn btn-primary" onclick="openGmailRuleManager()">Configurar reglas Gmail</button>
          <button class="btn btn-ghost" onclick="openUniversalImport('paste');closeModal('modal-onboarding-wizard')">Probar texto pegado</button>
          <button class="btn btn-ghost" onclick="openUniversalImport('csv');closeModal('modal-onboarding-wizard')">Probar archivo</button>
        </div>
      </div>
    `;
  } else if(step.id === 'banking'){
    panel = `
      <div class="onboarding-wizard-panel">
        <div class="onboarding-wizard-title">Prepará banco, tarjeta y ciclo</div>
        <div class="onboarding-wizard-sub">Este paso deja guardado cómo funciona el banco o la tarjeta de cada persona: nombre visible, cierre, vencimiento y vía de importación preferida.</div>
        <div class="onboarding-wizard-bullets">
          <div>Si una persona usa Santander y otra Galicia, cada una puede tener su propia base.</div>
          <div>Los perfiles bancarios complementan la configuración más profunda de tarjetas y ciclos.</div>
          <div>Esto es clave para volver la app realmente multiusuario.</div>
        </div>
        <div class="onboarding-wizard-actions">
          <button class="btn btn-primary" onclick="openBankProfileManager()">Crear perfil bancario</button>
          <button class="btn btn-ghost" onclick="nav('credit-cards');ccSelectPageTab('config');closeModal('modal-onboarding-wizard')">Ir a tarjetas y ciclos</button>
        </div>
      </div>
    `;
  } else {
    panel = `
      <div class="onboarding-wizard-panel">
        <div class="onboarding-wizard-title">Definí ingresos y cerrá la base</div>
        <div class="onboarding-wizard-sub">Con ingresos cargados, la app ya puede calcular ahorro, proyecciones, score y salud financiera con más sentido para cada usuario.</div>
        <div class="onboarding-wizard-bullets">
          <div>El ingreso base sirve para porcentaje de uso, modo ahorro, compromisos y score financiero.</div>
          <div>Podés cargar pesos, dólares o fuentes distintas según cada caso.</div>
          <div>Después de esto, la app ya queda lista para crecer con automatizaciones y multiusuario real.</div>
        </div>
        <div class="onboarding-wizard-actions">
          <button class="btn btn-primary" onclick="nav('income');closeModal('modal-onboarding-wizard')">Abrir ingresos</button>
          <button class="btn btn-ghost" onclick="completeOnboardingWizard()">Marcar como completo</button>
        </div>
      </div>
    `;
  }

  body.innerHTML = `
    <div class="onboarding-wizard-shell">
      <div class="onboarding-wizard-progress">${progress}</div>
      ${panel}
    </div>
  `;

  actions.innerHTML = `
    <button class="btn btn-ghost" onclick="closeModal('modal-onboarding-wizard')">Cerrar</button>
    ${stepIndex>0 ? `<button class="btn btn-ghost" onclick="onboardingPrevStep()">← Anterior</button>` : ''}
    ${step.id==='welcome' ? `<button class="btn btn-primary" onclick="saveOnboardingIdentity()">Guardar base</button>` : ''}
    ${stepIndex<steps.length-1 ? `<button class="btn btn-primary" onclick="onboardingNextStep()">Siguiente →</button>` : `<button class="btn btn-primary" onclick="completeOnboardingWizard()">Finalizar</button>`}
  `;
}

function resetGmailRuleEditor(){
  const idEl = document.getElementById('gmail-rule-id');
  const delBtn = document.getElementById('gmail-rule-delete-btn');
  if(idEl) idEl.value = '';
  if(delBtn) delBtn.style.display = 'none';
  applyGmailRuleTemplate('santander-compras');
}

function renderGmailRulesModal(editingId){
  const listEl = document.getElementById('gmail-rules-list');
  if(!listEl) return;
  const rules = ensureGmailImportRules();
  listEl.innerHTML = rules.map(rule => {
    const summary = summarizeGmailRule(rule);
    return `
      <div class="settings-rule-row gmail-rule-row-rich ${editingId===rule.id?'is-editing':''}">
        <div class="settings-rule-main">
          <div class="settings-rule-title">${rule.name}</div>
          <div class="gmail-rule-summary-list">
            <div class="gmail-rule-summary-item"><span class="gmail-rule-summary-label">Mira</span><span>${summary.sender}</span></div>
              <div class="gmail-rule-summary-item"><span class="gmail-rule-summary-label">Filtro</span><span>${summary.query}</span></div>
              <div class="gmail-rule-summary-item"><span class="gmail-rule-summary-label">Asigna</span><span>${summary.assign}</span></div>
          </div>
          <div class="settings-rule-meta">
            <span class="settings-rule-chip">${rule.active!==false?'Activa':'Pausada'}</span>
            <span class="settings-rule-chip">${getGmailRuleImportKind(rule)==='subscription'?'Suscripción':'Movimiento'}</span>
            <span class="settings-rule-chip">${rule.bank || 'Sin banco'}</span>
            <span class="settings-rule-chip">${formatGmailRuleCardType(rule.cardType)}</span>
          </div>
        </div>
        <div class="settings-rule-actions">
          <button class="dashboard-widget-mini" onclick="toggleGmailRule('${rule.id}', true)">${rule.active!==false?'Pausar':'Activar'}</button>
          <button class="dashboard-widget-mini primary" onclick="openGmailRuleManager('${rule.id}')">${editingId===rule.id?'Editando':'Editar'}</button>
        </div>
      </div>
    `;
  }).join('');
}

function openGmailRuleManager(ruleId){
  ensureGmailImportRules();
  openModal('modal-gmail-rules');
  renderGmailRulesModal(ruleId);
  const rule = (state.gmailImportRules||[]).find(r => r.id === ruleId);
  if(!rule){
    resetGmailRuleEditor();
    return;
  }
  document.getElementById('gmail-rule-id').value = rule.id;
  document.getElementById('gmail-rule-name').value = rule.name || '';
  document.getElementById('gmail-rule-bank').value = rule.bank || '';
  document.getElementById('gmail-rule-sender').value = rule.sender || '';
  document.getElementById('gmail-rule-query').value = rule.query || '';
  document.getElementById('gmail-rule-import-kind').value = getGmailRuleImportKind(rule);
  document.getElementById('gmail-rule-card').value = rule.cardType || 'auto';
  document.getElementById('gmail-rule-processor').value = rule.processor || 'santander_email';
  document.getElementById('gmail-rule-delete-btn').style.display = 'inline-flex';
}

function saveGmailRule(){
  ensureGmailImportRules();
  const id = document.getElementById('gmail-rule-id')?.value || '';
  const payload = {
    id: id || 'gmail-rule-' + Date.now().toString(36),
    name: (document.getElementById('gmail-rule-name')?.value || '').trim() || 'Regla Gmail',
    bank: (document.getElementById('gmail-rule-bank')?.value || '').trim() || 'Banco / tarjeta',
    sender: (document.getElementById('gmail-rule-sender')?.value || '').trim(),
    query: (document.getElementById('gmail-rule-query')?.value || '').trim(),
    importKind: document.getElementById('gmail-rule-import-kind')?.value || 'transaction',
    cardType: document.getElementById('gmail-rule-card')?.value || 'auto',
    processor: document.getElementById('gmail-rule-processor')?.value || 'santander_email',
    active: true
  };
  if(!payload.sender && !payload.query){
    showToast('Definí al menos remitente o consulta', 'error');
    return;
  }
  const rules = [...ensureGmailImportRules()];
  const idx = rules.findIndex(rule => rule.id === payload.id);
  if(idx >= 0) rules[idx] = { ...rules[idx], ...payload };
  else rules.unshift(payload);
  state.gmailImportRules = rules;
  state.onboardingState = { ...(state.onboardingState||{}), gmailRules:true };
  syncActiveUserProfileFromState(false);
  saveState();
  renderSettingsPage();
  renderOnboardingWizard();
  renderGmailRulesModal(payload.id);
  openGmailRuleManager(payload.id);
  showToast('✓ Regla Gmail guardada', 'success');
}

function toggleGmailRule(ruleId, keepModalOpen){
  ensureGmailImportRules();
  state.gmailImportRules = state.gmailImportRules.map(rule => rule.id === ruleId ? { ...rule, active: rule.active === false } : rule);
  syncActiveUserProfileFromState(false);
  saveState();
  renderSettingsPage();
  if(keepModalOpen) renderGmailRulesModal(ruleId);
}

function deleteCurrentGmailRule(){
  const id = document.getElementById('gmail-rule-id')?.value;
  if(!id) return;
  if(!confirm('¿Eliminar esta regla Gmail?')) return;
  state.gmailImportRules = ensureGmailImportRules().filter(rule => rule.id !== id);
  syncActiveUserProfileFromState(false);
  saveState();
  resetGmailRuleEditor();
  renderSettingsPage();
  renderGmailRulesModal();
  showToast('Regla eliminada', 'info');
}

// Auto-sync DESACTIVADO — sync solo manual via botón Gmail
window.addEventListener('load', () => {
  updateGmailBtn(isGoogleConnected() ? 'connected' : 'idle');
});
