// Historial de importaciones, borrar todo, confirmación de backup/restauración y exportar CSV.
// ══ IMPORT HISTORY ══
function getImportSourceLabel(source){
  if(source === 'gmail') return 'Gmail';
  if(source === 'manual') return 'Manual';
  return 'Manual';
}

function getImportStatusMeta(imp){
  if((imp.count || 0) <= 0) return { key:'empty', label:'Sin movimientos' };
  if(imp.source === 'gmail') return { key:'gmail', label:'Importada' };
  if(imp.source === 'manual') return { key:'manual', label:'Manual' };
  return { key:'success', label:'Importada' };
}

function getImportTotalAmount(imp){
  const ids = new Set(imp.txnIds || []);
  return (state.transactions || [])
    .filter(t => ids.has(t.id))
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

function getImportDateValue(imp){
  const raw = String(imp.date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return '';
}

function getFilteredImports(){
  const statusFilter = document.getElementById('import-history-filter-status')?.value || 'all';
  const monthFilter = document.getElementById('import-history-filter-date')?.value || '';
  return (state.imports || []).filter(imp => {
    const status = getImportStatusMeta(imp);
    const dateValue = getImportDateValue(imp);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'success' && status.key === 'success') ||
      (statusFilter === 'gmail' && imp.source === 'gmail') ||
      (statusFilter === 'manual' && imp.source === 'manual');
    const matchesMonth = !monthFilter || (dateValue && dateValue.startsWith(monthFilter));
    return matchesStatus && matchesMonth;
  });
}

function renderImportHistoryItems(targetId, compact){
  const el = document.getElementById(targetId);
  if(!el) return;
  const imports = getFilteredImports();
  if(!imports.length){
    el.innerHTML = `
      <div class="import-history-empty">
        <div class="empty-icon">📋</div>
        <div class="empty-title import-history-empty-title">${state.imports?.length ? 'Sin coincidencias' : 'Todavía no hay importaciones'}</div>
        <div class="empty-sub">${state.imports?.length ? 'Probá con otro estado o período para encontrar una importación específica.' : 'Importá movimientos desde la pantalla de Importaciones para construir historial y poder revisar cambios después.'}</div>
      </div>`;
    return;
  }
  el.innerHTML = imports.map(imp => {
    const status = getImportStatusMeta(imp);
    const amount = getImportTotalAmount(imp);
    const source = getImportSourceLabel(imp.source);
    const count = Number(imp.count || 0);
    const date = imp.date || '—';
    return `
      <div class="import-history-item">
        <span class="import-history-badge import-history-status ${status.key}">${status.label}</span>
        <div class="import-history-copy">
          <div class="import-history-title">${esc(imp.label || 'Importación')}</div>
          <div class="import-history-meta">${date} · ${source}</div>
          <div class="import-history-submeta">${count} movimiento${count===1?'':'s'} · $${fmtN(Math.round(amount || 0))}</div>
        </div>
        ${compact ? '' : `
          <div class="import-history-actions">
            <button class="btn btn-ghost btn-sm btn-icon import-row-btn" onclick="openRenameImport('${imp.id}')" title="Renombrar">✏️</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="deleteImport('${imp.id}')" title="Eliminar">🗑</button>
          </div>
        `}
      </div>`;
  }).join('');
}

function renderImportHistoryMenu(){
  if(!document.getElementById('import-history-menu-list')) return;
  renderImportHistoryItems('import-history-menu-list', true);
}


function closeImportHistoryMenu(){
  const menu = document.getElementById('import-history-menu');
  if(!menu) return;
  menu.style.display = 'none';
  document.removeEventListener('click', handleImportHistoryDismiss);
  document.removeEventListener('keydown', handleImportHistoryDismiss);
}

function handleImportHistoryDismiss(event){
  const menu = document.getElementById('import-history-menu');
  const trigger = document.getElementById('app-btn-add');
  if(!menu || menu.style.display !== 'block') return;
  if(event.type === 'keydown' && event.key === 'Escape'){
    closeImportHistoryMenu();
    return;
  }
  if(trigger?.contains(event.target) || menu.contains(event.target)) return;
  closeImportHistoryMenu();
}

function renderImportHistory(){
  renderImportHistoryItems('import-history-list', false);
}

function openRenameImport(id){
  const imp=state.imports.find(i=>i.id===id);if(!imp)return;
  document.getElementById('rename-import-id').value=id;
  document.getElementById('rename-import-val').value=imp.label;
  document.getElementById('modal-rename-import').classList.add('open');
  setTimeout(()=>document.getElementById('rename-import-val').select(),50);
}

function confirmRenameImport(){
  const id=document.getElementById('rename-import-id').value;
  const val=document.getElementById('rename-import-val').value.trim();
  if(!val){showToast('⚠️ Ingresá un nombre','error');return;}
  const imp=state.imports.find(i=>i.id===id);
  if(imp){imp.label=val;saveState();renderImportHistory();renderImportHistoryMenu();showToast('✓ Nombre actualizado','success');}
  closeModal('modal-rename-import');
}
function deleteImport(id){const imp=state.imports.find(i=>i.id===id);if(!imp)return;if(imp.txnIds){rememberDeletedGmailTxns(state.transactions.filter(t=>imp.txnIds.includes(t.id)));}if(imp.txnIds)state.transactions=state.transactions.filter(t=>!imp.txnIds.includes(t.id));state.imports=state.imports.filter(i=>i.id!==id);saveState();renderImportHistory();renderImportHistoryMenu();updateSidebarStats();renderDashboard();renderTransactions();showToast('Importación eliminada','info');}
function clearAllData(){
  state.transactions=[];
  state.imports=[];
  state.categoryGroups=[...DEFAULT_CATEGORY_GROUPS];
  state.categories=[...DEFAULT_CATS];
  state.income={ars:0,varArs:0,usd:0,varUsd:0};
  state.savingsGoal=20;
  state.alertThreshold=80;
  state.spendPct=100;
  state.cuotas=[];
  state.autoCuotaConfig={};
  state.subscriptions=[];
  state.fixedExpenses=[];
  state.incomeSources=[];
  state.incomeMonths=[];
  state.savAccounts=[];
  state.savGoals=[];
  state.savDeposits=[];
  state.tcConfig={cardName:'',closeDay:0,dueDay:0,limit:0,mixTarget:70};
  state.tcCycles=[];
  state.ccCards=[];
  state.ccCycles=[];
  state.ccActiveCard=null;
  state.dashTcCycle=null;
  state.dashView='mes';
  state.dashMonth=null;
  state.catRules=[];
  state.catHistory={};
  state.txnEstadoFilter='all';
  state.txnCardFilter='';
  state.gmailImportRules=[];
  state.bankProfiles=[];
  state.importConfig={};
  state.automationPrefs={};
  state.userProfiles=[];
  state.activeUserProfileId=null;
  state.profileTemplate='personal';
  state.onboardingState={};
  state.lastGmailSync=null;
  state.dismissedNotifs=[];
  state.decisionCenterCollapsed=false;
  state.dismissedAutoCuotas=[];
  state.userName='Pedro';
  state.userEmail='';
  state.manualUserEmail='';
  state.userAvatar='';
  state.userAvatarMode='generated';
  state.userAvatarPreset='';
  state.userPrefs={ currency:'ARS', language:'es', theme:'light' };
  state.googleProfile=null;
  if(typeof normalizeCategoryState === 'function') normalizeCategoryState(state);
  saveState();
  renderImportHistory();
  if(typeof renderImportHistoryMenu === 'function') renderImportHistoryMenu();
  if(typeof renderProfilePage === 'function') renderProfilePage();
  if(typeof renderSecurityPage === 'function') renderSecurityPage();
  if(typeof renderAppShellProfile === 'function') renderAppShellProfile();
  updateSidebarStats();
  document.getElementById('dash-empty').style.display='block';
  document.getElementById('dash-content').style.display='none';
  showToast('Todos los datos fueron eliminados','info');
}

// ══ CONFIRMACIÓN DE ACCIONES DE GUARDADO ══
const ACCIONES_INFO = {
  backup: {
    titulo: '💾 Descargar Backup',
    descripcion: 'Vas a descargar un archivo <strong>.json</strong> con <strong>todos tus datos</strong>: movimientos, categorías, reglas, ahorros y configuraciones.',
    detalle: 'Guardá este archivo en un lugar seguro. Podés usarlo para restaurar todo si alguna vez borrás el historial del navegador o querés migrar a otro dispositivo.',
    accion: 'Descargar ahora',
    fn: () => { exportBackupJSON(); registrarBackupEnHistorial('manual'); }
  },
  restaurar: {
    titulo: '📂 Restaurar desde Backup',
    descripcion: 'Vas a <strong>reemplazar todos tus datos actuales</strong> con los de un archivo de backup (.json) que generaste antes con esta app.',
    detalle: '⚠️ Esto sobreescribe todo lo que tenés cargado ahora. Si querés conservar los datos actuales, primero hacé un backup.',
    accion: 'Elegir archivo y restaurar',
    danger: false,
    fn: () => document.getElementById('restore-json-input').click()
  },
  csv: {
    titulo: '📊 Exportar a CSV',
    descripcion: 'Vas a descargar todos tus movimientos en formato <strong>.csv</strong>, compatible con Excel, Google Sheets y cualquier planilla de cálculo.',
    detalle: 'El archivo incluye: fecha, descripción, monto, moneda, categoría, medio de pago y estado. Solo se exportan movimientos — no configuraciones ni reglas.',
    accion: 'Descargar CSV',
    fn: () => { exportarCSV(); registrarBackupEnHistorial('csv'); }
  },
  borrar: {
    titulo: '🗑 Borrar todos los datos',
    descripcion: 'Vas a eliminar <strong>permanentemente</strong> todos tus movimientos, categorías, reglas, ahorros y configuraciones del navegador.',
    detalle: '⚠️ Esta acción NO se puede deshacer. Se recomienda hacer un backup antes de continuar.',
    accion: 'Sí, borrar todo',
    danger: true,
    fn: () => clearAllData()
  }
};

function confirmarAccion(tipo) {
  const info = ACCIONES_INFO[tipo];
  if (!info) return;
  let modal = document.getElementById('modal-confirm-accion');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-confirm-accion';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:460px;">
        <div id="mca-titulo" class="modal-title" style="margin-bottom:6px;"></div>
        <div id="mca-desc" class="modal-sub" style="font-size:13px;line-height:1.7;margin-bottom:12px;"></div>
        <div id="mca-detalle" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;font-size:11px;color:var(--text3);font-family:var(--font);line-height:1.7;margin-bottom:22px;"></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="closeModalConfirm()">Cancelar</button>
          <button id="mca-btn-ok" class="btn btn-primary"></button>
        </div>
      </div>`;
    modal.style.display = 'none';
    document.body.appendChild(modal);
  }
  document.getElementById('mca-titulo').innerHTML = info.titulo;
  document.getElementById('mca-desc').innerHTML = info.descripcion;
  document.getElementById('mca-detalle').innerHTML = info.detalle;
  const btnOk = document.getElementById('mca-btn-ok');
  btnOk.textContent = info.accion;
  btnOk.style.background = info.danger ? 'var(--danger)' : '';
  btnOk.onclick = () => { closeModalConfirm(); setTimeout(info.fn, 80); };
  modal.style.display = 'flex';
  _iosLock();
}

function closeModalConfirm() {
  const m = document.getElementById('modal-confirm-accion');
  if (m&&m.style.display!=='none'){m.style.display = 'none';_iosUnlock();}
}

// ══ EXPORTAR CSV ══
function exportarCSV() {
  const txns = state.transactions;
  if (!txns.length) { showToast('Sin movimientos para exportar', 'error'); return; }
  const headers = ['Fecha','Descripción','Comercio','Monto','Moneda','Categoría','Medio de pago','Estado','Origen'];
  const rows = txns.map(t => [
    t.date || '',
    (t.description || '').replace(/"/g,'""'),
    (t.comercio_detectado || '').replace(/"/g,'""'),
    t.amount || 0,
    t.currency || 'ARS',
    (t.category || '').replace(/"/g,'""'),
    (t.payMethod || '').replace(/"/g,'""'),
    t.estado_revision || '',
    t.origen_del_movimiento || ''
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toLocaleDateString('es-AR').replace(/\//g,'-');
  a.href = url; a.download = 'finanzas-movimientos-' + dateStr + '.csv';
  a.click(); URL.revokeObjectURL(url);
  state.lastTransactionsExport = new Date().toISOString();
  showToast('✓ CSV exportado (' + txns.length + ' movimientos)', 'success');
  saveState();
}
