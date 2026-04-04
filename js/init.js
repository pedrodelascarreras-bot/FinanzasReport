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
  // One-time cleanup: remove any "Cuota X de Y" standalone entries from old imports
  if(state.transactions.length) deduplicateTransactions();
  loadTheme();
  loadColorTheme();
  loadSidebar();
  updateUsdRateUI();
  setChartMode(state.chartMode||'week');
  setTxnFilterMode(state.txnFilterMode||'mes');
  if(state.transactions.length){updateSidebarStats();renderDashboard();renderTransactions();document.getElementById('dash-empty').style.display='none';document.getElementById('dash-content').style.display='flex';setTimeout(()=>applyLayout('dashboard'),0);}
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
    origen_del_movimiento:'pegado_manualmente'};
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
      loadState();refreshAll();
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
// GMAIL INTEGRATION — Santander Río auto-import
// ══════════════════════════════════════════════════════════
const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
const GMAIL_SENDER = 'mensajesyavisos@mails.santander.com.ar';
let gmailTokenClient = null;
let gmailAccessToken = null;
let pendingGmailTxns = [];
let driveReconnectInFlight = false;

function getGmailClientId() {
  return state.gmailClientId || localStorage.getItem('fin_gmail_client_id') || '';
}

function saveGmailClientId() {
  const id = document.getElementById('gmail-client-id-input').value.trim();
  if (!id) { showToast('Ingresá un Client ID válido', 'error'); return; }
  state.gmailClientId = id;
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
  const clientId = getGmailClientId();
  if (!clientId) {
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
    const fmtGmail = d => d.toISOString().slice(0,10).replace(/-/g,'/');
    const beforeDate = new Date(dateTo); beforeDate.setDate(beforeDate.getDate()+1);
    const dateQuery = ` after:${fmtGmail(dateFrom)} before:${fmtGmail(beforeDate)}`;
    
    // Obtenemos los IDs de emails ya importados y anulados procesados
    const importedEmailIds = new Set([
      ...state.transactions.map(t => t.gmailId).filter(Boolean),
      ...(state.gmailAnulados || [])
    ]);

    // Fetch ALL pages (paginación) para no limitar a los primeros 50
    let allMessages = [];
    let pageToken = null;
    do {
      const tokenParam = pageToken ? `&pageToken=${pageToken}` : '';
      const query = encodeURIComponent(`from:${GMAIL_SENDER} (subject:Pagaste OR subject:"Tu pago fue anulado")${dateQuery}`);
      const listRes = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=500${tokenParam}`);
      const data = await listRes.json();
      if (data.messages) allMessages = allMessages.concat(data.messages);
      pageToken = data.nextPageToken || null;
    } while (pageToken);

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
    for (let i = 0; i < newMessages.length; i += BATCH_SIZE) {
      const batch = newMessages.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(m => gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`).then(r => r.json()))
      );
      emails.push(...batchResults);
      if (i + BATCH_SIZE < newMessages.length) await new Promise(r => setTimeout(r, 200));
    }
    
    const txns = [];
    const annulments = [];
    for (const email of emails) { 
        const txn = parseSantanderEmail(email, txns); 
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

function parseSantanderEmail(email, currentBatch) {
  try {
    const emailId = email.id;
    const headers = email.payload.headers || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const dateHeader = headers.find(h => h.name === 'Date')?.value || '';

    const isAnulacion = /anulado/i.test(subject);

    // Parse email body early to extract amount if necessary
    const body = getEmailBody(email.payload);

    // Auto-detect card type from email body (VISA termina en 3177, AMEX termina en 7262)
    let payMethod = null;
    if (/terminada en 3177|tarjeta santander visa|visa cr[eé]dito/i.test(body)) payMethod = 'visa';
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
      if (!subjectMatch) return null;
      amount = parseFloat(subjectMatch[1].replace(/\./g, '').replace(',', '.'));
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
      ? baseDesc + ' (Cuota 1/' + cuotaTotal + ')' + (hora ? ' ' + hora : '')
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
    finishImport(toImport, 'Gmail · Santander Río');
  } else {
    showToast('No se importó ningún gasto', 'info');
  }
  pendingGmailTxns = [];
}

// Auto-sync DESACTIVADO — sync solo manual via botón Gmail
window.addEventListener('load', () => {
  const clientId = getGmailClientId();
  if (clientId) {
    setTimeout(() => attemptDriveReconnect(false), 900);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    attemptDriveReconnect(false);
  }
});
