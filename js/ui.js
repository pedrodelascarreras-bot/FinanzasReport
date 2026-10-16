// ══════════════════════════════════════════
//  QUICK CATEGORY REVIEW — triage engine
// ══════════════════════════════════════════
let _qrQueue = [];   // txn ids to review
let _qrIndex = 0;
let _qrTotal = 0;

function openCatReview(mode){
  // mode: 'uncat' (default) = Procesando.../missing cat, 'all' = every txn
  const uncat = mode==='all'
    ? [...state.transactions].sort((a,b)=> new Date(b.date)-new Date(a.date)).map(t=>t.id)
    : state.transactions
        .filter(t=>!t.category||t.category==='Procesando...'||t.category==='Otros'||t.category==='Uncategorized')
        .sort((a,b)=>new Date(b.date)-new Date(a.date))
        .map(t=>t.id);

  if(!uncat.length){
    showToast(t('all_categorized', '✓ Todos los movimientos están categorizados'),'success');
    return;
  }
  _qrQueue = uncat;
  _qrIndex = 0;
  _qrTotal = uncat.length;
  window._qrExpandedGroup=null;
  _qrRender();
  openModal('modal-catreview');
}

function _qrRender(){
  if(_qrIndex >= _qrQueue.length){
    // Done!
    document.getElementById('qr-card').innerHTML='<div style="text-align:center;padding:24px 0;"><div style="font-size:32px;margin-bottom:10px;">✓</div><div style="font-size:15px;font-weight:700;color:var(--accent);">¡Todo categorizado!</div><div style="font-size:12px;color:var(--text3);margin-top:6px;font-family:var(--font);">Revisaste '+_qrTotal+' movimiento'+ (_qrTotal!==1?'s':'')+'</div></div>';
    document.getElementById('qr-cats').innerHTML='';
    document.getElementById('qr-current-cat').textContent='';
    document.getElementById('qr-count-label').textContent='✓ Listo';
    document.getElementById('qr-footer-counter').textContent='';
    document.getElementById('qr-progress').style.width='100%';
    updateQrBadge();
    return;
  }

  const id = _qrQueue[_qrIndex];
  const t = state.transactions.find(x=>x.id===id);
  if(!t){ _qrIndex++; _qrRender(); return; }

  const done = _qrTotal - _qrQueue.length + _qrIndex;
  const pct = Math.round(done / _qrTotal * 100);
  document.getElementById('qr-progress').style.width = pct+'%';
  document.getElementById('qr-count-label').textContent = (_qrIndex+1)+' / '+_qrQueue.length;
  document.getElementById('qr-footer-counter').textContent = (_qrQueue.length-_qrIndex-1)+' por revisar';

  // Date + description + amount
  const d = (t.date instanceof Date ? t.date : new Date(t.date));
  const fmtD = d.toLocaleDateString('es-AR',{weekday:'short',day:'2-digit',month:'short'});
  document.getElementById('qr-meta').textContent = fmtD + (t.category==='Procesando...'?' · ⏳ sin categoría':' · '+catEmoji(t.category)+' '+t.category);
  document.getElementById('qr-desc').textContent = t.description;
  const amtEl = document.getElementById('qr-amount');
  amtEl.textContent = (t.currency==='USD'?'U$D ':'$') + fmtN(t.amount);
  amtEl.className = 'qr-amount'+(t.currency==='USD'?' usd':'');

  // Current category pill
  const curCat = document.getElementById('qr-current-cat');
  const cc = catColor(t.category); 
  curCat.textContent = t.category||'—';
  curCat.style.cssText = 'font-size:11px;font-weight:700;font-family:var(--font);padding:3px 10px;border-radius:12px;background:'+cc+'18;border:1px solid '+cc+'44;color:'+cc+';';

  // Category buttons — 2-step: parent categories first, click to expand subs
  const catsEl = document.getElementById('qr-cats');
  if(!window._qrExpandedGroup) window._qrExpandedGroup=null;

  let qrHtml='<div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;">';
  CATEGORY_GROUPS.forEach(g=>{
    const isExpanded=(window._qrExpandedGroup===g.group);
    const hasCurrent=g.subs.includes(t.category);
    const c=g.color;
    // Only the expanded group gets colored border. hasCurrent just gets a subtle ✓
    const borderCol=isExpanded?c:'var(--border)';
    const bgCol=isExpanded?c+'18':'var(--surface)';
    const textCol=isExpanded?c:'var(--text)';
    const fw=isExpanded?'700':'500';
    qrHtml+='<button style="display:flex;align-items:center;gap:5px;padding:8px 14px;border-radius:10px;border:1.5px solid '
      +borderCol+';background:'+bgCol+';color:'+textCol+';font-size:12px;font-weight:'+fw
      +';cursor:pointer;font-family:var(--font);transition:all .12s;" onclick="window._qrExpandedGroup='
      +(isExpanded?"null":"'"+g.group+"'")+';_qrRender();">'
      +'<span style="font-size:14px;">'+g.emoji+'</span>'+g.group
      +(hasCurrent?' <span style="font-size:9px;opacity:.4;">✓</span>':'')
    +'</button>';
  });
  qrHtml+='</div>';

  // Expanded subcategories
  if(window._qrExpandedGroup){
    const grp=CATEGORY_GROUPS.find(g=>g.group===window._qrExpandedGroup);
    if(grp){
      const c=grp.color;
      qrHtml+='<div style="padding:8px 0 4px;border-top:1px solid var(--border);margin-top:4px;display:flex;flex-wrap:wrap;gap:6px;">';
      qrHtml+='<div style="width:100%;font-size:10px;font-weight:700;color:'+c+';margin-bottom:2px;">'+grp.emoji+' '+grp.group+' →</div>';
      grp.subs.forEach(sub=>{
        const sel=(sub===t.category);
        qrHtml+='<button style="padding:8px 16px;border-radius:10px;border:1.5px solid '+(sel?c:'var(--border)')
          +';background:'+(sel?c+'22':'var(--surface)')+';color:'+(sel?c:'var(--text)')
          +';font-size:12px;font-weight:'+(sel?'700':'500')+';cursor:pointer;font-family:var(--font);transition:all .12s;" '
          +'onclick="assignQrCat(\''+sub+'\')">'+sub+(sel?' ✓':'')+'</button>';
      });
      qrHtml+='</div>';
    }
  }
  catsEl.innerHTML = qrHtml;

  // Prev button
  document.getElementById('qr-prev').style.opacity = _qrIndex>0?'1':'0.3';
  document.getElementById('qr-prev').disabled = _qrIndex===0;
}

function assignQrCat(catName){
  // Called from QR review panel — uses current queue item
  const txnId=_qrQueue[_qrIndex];
  if(txnId) qrAssign(txnId, catName);
}
function qrAssign(txnId, catName){
  const t = state.transactions.find(x=>x.id===txnId);
  if(t){
    t.category = catName;
    saveState();
    // Animate card out and go next
    const card = document.getElementById('qr-card');
    card.style.transition='opacity .15s,transform .15s';
    card.style.opacity='0';
    card.style.transform='translateX(20px)';
    setTimeout(()=>{
      card.style.transition='';
      card.style.opacity='';
      card.style.transform='';
      _qrIndex++;
      _qrRender();
    },150);
    updateQrBadge();
  }
}

function qrSkip(){
  const card=document.getElementById('qr-card');
  card.style.transition='opacity .12s';
  card.style.opacity='0';
  setTimeout(()=>{ card.style.transition=''; card.style.opacity=''; _qrIndex++; _qrRender(); },120);
}

function qrNav(dir){
  _qrIndex = Math.max(0, _qrIndex+dir);
  window._qrExpandedGroup=null; _qrRender();
}

function updateQrBadge(){
  const badge = document.getElementById('qr-badge');
  if(!badge) return;
  const n = state.transactions.filter(t=>!t.category||t.category==='Procesando...'||t.category==='Uncategorized').length;
  if(n>0){ badge.style.display='block'; badge.textContent=n; }
  else { badge.style.display='none'; }
}

// ══ NAV ══
// Map page → which nav-section contains it (if any)
const PAGE_SECTION={settings:'ns-config',security:'ns-config','credit-cards':'ns-config'};

function isMobileAppView(){
  return window.innerWidth <= 768;
}

function isMobileBlockedPage(page){
  return isMobileAppView() && ['categories','import'].includes(page);
}

function handleDashEmptyTap(event){
  if(event){
    event.preventDefault();
    event.stopPropagation();
  }
  if(isMobileAppView()){
    openCloudSync(event);
    return;
  }
  nav('import');
}


function enforceMobilePagePreferences(){
  if(!isMobileAppView()) return;
  if(state.ccPageTab === 'config') state.ccPageTab = 'resumen';
  const active = document.querySelector('.page.active');
  if(active){
    const activeId = active.id.replace('page-','');
    if(isMobileBlockedPage(activeId)) nav('dashboard');
  }
}

function toggleSection(id){
  const sec=document.getElementById(id);if(!sec)return;
  sec.classList.toggle('open');
}
function openSection(id){
  const sec=document.getElementById(id);if(sec)sec.classList.add('open');
}


// ══ CENTRAL REFRESH — keeps all views in sync ══
function refreshAll(){
  // Siempre actualizar dashboard y sidebar (aunque no haya transacciones aún)
  updateSidebarStats();
  updateQrBadge();
  renderDashboard(); // Always refresh — income changes affect widgets even without transactions

  // Siempre actualizar lista de categorías (afecta colores y nombres en toda la app)
  renderCategoryManage();

  // Actualizar las otras páginas solo si están abiertas en este momento
  if(document.getElementById('page-tendencia').classList.contains('active')) renderTendencia();
  if(document.getElementById('page-transactions').classList.contains('active')) renderTransactions();
  if(document.getElementById('page-cuotas').classList.contains('active')) { if(typeof renderCommitmentsPage==='function') renderCommitmentsPage(); else {renderCuotas();renderSubs();renderFixed();renderCompromisosSummary();} }
  if(document.getElementById('page-income').classList.contains('active')) renderIncomePage();
  if(document.getElementById('page-savings').classList.contains('active')) renderSavingsPage();
  if(document.getElementById('page-credit-cards')&&document.getElementById('page-credit-cards').classList.contains('active')) renderCreditCards();
  if(document.getElementById('page-import')?.classList.contains('active') && typeof renderImportConfigPanel === 'function') renderImportConfigPanel();
}

function syncActivePageState(page){
  if(!document.body) return;
  document.body.setAttribute('data-active-page', page || '');
}

function nav(page){
  // ── Safety: reset any stuck iOS scroll lock (body overflow:hidden / position:fixed) ──
  // This protects against modals or panels that were opened but not properly closed.
  if(typeof _iosOvCnt !== 'undefined') _iosOvCnt = 0;
  document.body.style.overflow   = '';
  document.body.style.position   = '';
  document.body.style.top        = '';
  document.body.style.width      = '';
  // Also close mobile theme picker if open
  if(typeof closeMobileThemePicker === 'function') closeMobileThemePicker();

  closeMobMore();
  if(typeof closeNotifPanel === 'function') closeNotifPanel();
  if(typeof closeImportHistoryMenu === 'function') closeImportHistoryMenu();
  if(typeof closeProfileDropdown === 'function') closeProfileDropdown();
  if(isMobileBlockedPage(page)){
    showToast(t('desktop_only_page', 'Esa pantalla quedó disponible solo en desktop'), 'info');
    page='dashboard';
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item,.mob-nav-btn').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll('.nav-section').forEach(s=>s.classList.remove('has-active'));
  const _pageEl=document.getElementById('page-'+page);
  if(!_pageEl){ console.warn('[nav] pantalla inexistente:', page); return nav('dashboard'); }
  _pageEl.classList.add('active');
  syncActivePageState(page);
  // Activate nav item by id
  const navTarget = page;
  const ni=document.getElementById('ni-'+navTarget);
  if(ni)ni.classList.add('active');
  // Open parent section if needed
  const secId=PAGE_SECTION[page];
  if(secId){openSection(secId);document.getElementById(secId)?.classList.add('has-active');}
  // Mobile nav
  const mn=document.getElementById('mn-'+navTarget);if(mn)mn.classList.add('active');
  if(page==='categories'){renderCategoryManage();renderInlineColorPicker('');}
  if(page==='transactions'){ setTxnFilterMode(state.txnFilterMode||'visa'); }
  if(page==='import'){renderImportHistory();updateLastBackupLabel();if(typeof renderImportConfigPanel==='function')renderImportConfigPanel();}
  if(page==='import-history'){renderImportHistory();}
  if(page==='tendencia')renderTendencia();
  if(page==='cuotas'){ if(typeof renderCommitmentsPage==='function') renderCommitmentsPage(); else {renderCuotas();renderSubs();renderFixed();renderCompromisosSummary();} }
  if(page==='suscripciones'){nav('cuotas');return;}
  if(page==='income')renderIncomePage();
  if(page==='savings')renderSavingsPage();
  if(page==='settings' && typeof renderSettingsPage==='function')renderSettingsPage();
  if(page==='profile' && typeof renderProfilePage==='function')renderProfilePage();
  if(page==='security' && typeof renderSecurityPage==='function')renderSecurityPage();
  if(page==='dashboard')renderDashboard();
  if(page==='calendar' && typeof jumpCalendarToToday==='function') jumpCalendarToToday();
  if(page==='credit-cards')renderCreditCards();
  requestAnimationFrame(()=>animatePageEnter(document.getElementById('page-'+page)));
}

syncActivePageState(document.querySelector('.page.active')?.id?.replace('page-','') || 'dashboard');

// ══ CAT HELPERS ══
function _resolveCat(n){
  // 1. Direct match in state.categories (subcategory name)
  const direct=state.categories.find(c=>c.name===n);
  if(direct) return direct;
  // 2. Old name → migration map → resolve to new sub
  const migrated=CAT_MIGRATION_MAP[n];
  if(migrated){const m=state.categories.find(c=>c.name===migrated);if(m)return m;}
  // 3. n is itself a parent group name? return first sub of that group
  const grp=CATEGORY_GROUPS.find(g=>g.group===n);
  if(grp){const first=state.categories.find(c=>c.group===grp.group);if(first)return first;}
  return null;
}
function catColor(n){return _resolveCat(n)?.color||'#888888';}
function catStyle(n){const c=catColor(n);return 'background:'+c+'22;color:'+c+';border:1px solid '+c+'44;';}
function catGroup(n){return _resolveCat(n)?.group||'Sin clasificar';}
function catEmoji(n){return _resolveCat(n)?.emoji||'🗑️';}
function catGroupEmoji(g){const grp=CATEGORY_GROUPS.find(x=>x.group===g);return grp?grp.emoji:'🗑️';}
function catNames(){return state.categories.map(c=>c.name);}

// ══ SAVINGS GOALS SUMMARY BAR ══

// ── Scroll to top button visibility ──
window.addEventListener('scroll',()=>{
  const btn=document.getElementById('scroll-top-btn');
  if(btn)btn.classList.toggle('visible',window.scrollY>400);
},{passive:true});

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if(!panel) return;
  const isShow = panel.style.display !== 'block';
  if(!isShow){
    closeNotifPanel();
    return;
  }
  if(typeof closeImportHistoryMenu === 'function') closeImportHistoryMenu();
  if(typeof closeProfileDropdown === 'function') closeProfileDropdown();
  panel.style.display = 'block';
  renderNotifications();
  document.addEventListener('click', handleNotifDismiss);
  document.addEventListener('keydown', handleNotifDismiss);
}

function closeNotifPanel(){
  const panel = document.getElementById('notif-panel');
  if(!panel) return;
  panel.style.display = 'none';
  document.removeEventListener('click', handleNotifDismiss);
  document.removeEventListener('keydown', handleNotifDismiss);
}

function handleNotifDismiss(event){
  const panel = document.getElementById('notif-panel');
  const trigger = document.getElementById('app-btn-notif');
  if(!panel || panel.style.display !== 'block') return;
  if(event.type === 'keydown' && event.key === 'Escape'){
    closeNotifPanel();
    return;
  }
  if(trigger?.contains(event.target) || panel.contains(event.target)) return;
  closeNotifPanel();
}

function renderNotifications() {
  const list = document.getElementById('notif-list');
  const badge = document.getElementById('app-notif-dot');
  if(!list) return;

  const notifs = [];
  const today = new Date();

  // 1. Credit Card Closures
  const cycles = typeof getTcCycles === 'function' ? getTcCycles() : state.tcCycles;
  cycles.forEach(c => {
    const closeD = new Date(c.closeDate + 'T12:00:00');
    const diff = Math.ceil((closeD - today) / (1000 * 60 * 60 * 24));
    if(diff > 0 && diff <= 5) {
      notifs.push({
        id: `tc-close-${c.id}-${c.closeDate}`,
        type: 'tc-close',
        title: `Cierre de ${c.label}`,
        desc: `Tu tarjeta cierra en ${diff} día${diff!==1?'s':''}. ¡Revisá tus consumos!`,
        icon: '💳',
        color: 'var(--accent)',
        time: `Vence el ${closeD.toLocaleDateString('es-AR')}`
      });
    }
  });

  // 2. Credit Card Payments (Due dates)
  cycles.forEach(c => {
    if(!c.dueDate) return;
    const dueD = new Date(c.dueDate + 'T12:00:00');
    const diff = Math.ceil((dueD - today) / (1000 * 60 * 60 * 24));
    if(diff > 0 && diff <= 5) {
      notifs.push({
        id: `tc-due-${c.id}-${c.dueDate}`,
        type: 'tc-due',
        title: `Vencimiento de ${c.label}`,
        desc: `El pago de tu tarjeta es en ${diff} día${diff!==1?'s':''}.`,
        icon: '💸',
        color: 'var(--danger)',
        time: `Pagar antes del ${dueD.toLocaleDateString('es-AR')}`
      });
    }
  });

  // 3. Subscriptions (if any renewal is close)
  state.subscriptions.forEach(s => {
    if(s.freq === 'monthly') {
      const day = s.day || 15;
      const nextDate = new Date(today.getFullYear(), today.getMonth(), day);
      if(nextDate < today) nextDate.setMonth(nextDate.getMonth() + 1);
      const diff = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
      if(diff <= 3) {
        notifs.push({
          id: `sub-${s.id}-${nextDate.toISOString().slice(0,10)}`,
          type: 'sub',
          title: `Renovación: ${s.name}`,
          desc: `Tu suscripción de ${s.currency}$ ${s.price} se renueva en ${diff} día${diff!==1?'s':''}.`,
          icon: '🔔',
          color: 'var(--accent2)',
          time: diff === 0 ? 'Hoy' : `En ${diff} días`
        });
      }
    }
  });

  // 4. Spending vs Income (Fixed Logic)
  const cycleTotal = typeof getDashCycleTotal === 'function' ? getDashCycleTotal() : 0;
  const monthIncome = typeof getDashMonthIncome === 'function' ? getDashMonthIncome() : 0;
  if(monthIncome > 0) {
    const usage = (cycleTotal / monthIncome) * 100;
    if(usage >= 80) {
      notifs.push({
        id: `spend-limit-${getMonthKey(today)}`,
        type: 'alert',
        title: 'Límite de Gastos',
        desc: `Atención: ya utilizaste el ${Math.round(usage)}% de tus ingresos del ciclo actual.`,
        icon: '⚠️',
        color: 'var(--danger)',
        time: 'Alerta crítica'
      });
    }
  }

  if(typeof getSavingsDeviationAlerts === 'function') {
    getSavingsDeviationAlerts().slice(0,2).forEach(a => {
      notifs.push({
        id: a.id,
        type: a.type,
        title: a.title,
        desc: a.desc,
        icon: a.icon,
        color: a.color,
        time: a.time
      });
    });
  }

  // 5. Backup health
  if(typeof getBackupHealth === 'function') {
    const bh = getBackupHealth();
    if(bh.level !== 'info') {
      notifs.push({
        id: `backup-${bh.state}`,
        type: bh.level,
        title: bh.label,
        desc: bh.desc + ' Tener una copia reciente te protege antes de grandes cambios.',
        icon: '🛡️',
        color: bh.level === 'alert' ? 'var(--danger)' : 'var(--warning, #f59e0b)',
        time: bh.days != null ? `Hace ${bh.days} días` : 'Pendiente'
      });
    }
  }

  // 6. Uncategorized transactions (5+)
  const _monthKey = getMonthKey(today);
  const _monthTxns = (state.transactions||[]).filter(t => {
    const m = t.month || (t.date ? String(t.date).slice(0,7) : '');
    return m === _monthKey && !t.isPendingCuota;
  });
  const _uncatCount = _monthTxns.filter(t => !t.category || t.category === 'Uncategorized' || t.category === 'Procesando...').length;
  if(_uncatCount >= 5) {
    notifs.push({
      id: `uncat-${_monthKey}`,
      type: 'info',
      title: 'Movimientos sin categoría',
      desc: `Tenés ${_uncatCount} movimientos sin clasificar este mes. Categorizarlos mejora tus reportes.`,
      icon: '🏷️',
      color: 'var(--accent)',
      time: 'Pendiente de revisión'
    });
  }

  // 7. Upcoming cuotas (within 3 days)
  (state.cuotas||[]).forEach(c => {
    const cDate = getCuotaStatus(c).nextDate;
    if(!cDate) return;
    const diff = Math.round((new Date(cDate.getFullYear(), cDate.getMonth(), cDate.getDate()) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
    if(diff >= 0 && diff <= 3) {
      notifs.push({
        id: `cuota-notif-${c.id}-${dateToYMD(cDate)}`,
        type: 'info',
        title: 'Próxima cuota',
        desc: `${diff === 0 ? 'Hoy' : 'En ' + diff + ' día' + (diff !== 1 ? 's' : '')} vence: ${esc(c.name || '')}.`,
        icon: '💳',
        color: 'var(--accent)',
        time: diff === 0 ? 'Hoy' : `En ${diff} día${diff !== 1 ? 's' : ''}`
      });
    }
  });

  // Filter out dismissed
  const activeNotifs = notifs.filter(n => !(state.dismissedNotifs || []).includes(n.id || n.title));

  // Badge: show if there are active notifs OR pending tasks
  const _pendingTaskCount = (state.tasks||[]).filter(t => !t.done).length;
  if(badge) badge.style.display = (activeNotifs.length > 0 || _pendingTaskCount > 0) ? 'block' : 'none';

  if(activeNotifs.length === 0) {
    list.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon">✨</div>
        <div class="notif-empty-title">Todo al día</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px;">No tenés avisos o alertas pendientes por ahora.</div>
      </div>
    `;
  } else {
    list.innerHTML = activeNotifs.map(n => {
      const key = n.id || n.title;
      return `
      <div class="notif-item"${n.id ? ` id="notif-${n.id}"` : ''}>
        <div class="notif-icon-box" style="background:${n.color}22;color:${n.color};">
          ${n.icon}
        </div>
        <div class="notif-content">
          <div class="notif-title">${n.title}</div>
          <div class="notif-desc">${n.desc}</div>
          <div class="notif-time">${n.time}</div>
        </div>
        <button class="notif-item-close" onclick="event.stopPropagation();dismissNotif('${key.replace(/'/g,"\\'")}')" title="Quitar">✕</button>
      </div>
    `}).join('');
  }

  renderNotifTasks();
}

function renderNotifTasks() {
  const el = document.getElementById('notif-tasks-section');
  if(!el) return;
  const now = Date.now();
  state.tasks = (state.tasks||[]).filter(t => !t.done || !t.doneAt || (now - t.doneAt) < 86400000);
  const pending = (state.tasks||[]).filter(t => !t.done);
  const done = (state.tasks||[]).filter(t => t.done);
  const all = [...pending, ...done];
  el.innerHTML = `
    <div style="border-top:1px solid var(--border);padding:14px 16px 12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);">Pendientes${pending.length ? ' (' + pending.length + ')' : ''}</span>
        ${done.length ? `<button style="font-size:10px;color:var(--text3);background:none;border:none;cursor:pointer;padding:2px 4px;font-family:var(--font);" onclick="event.stopPropagation();clearDoneTasks()">Limpiar</button>` : ''}
      </div>
      ${all.length ? `<div style="display:flex;flex-direction:column;gap:2px;margin-bottom:10px;">
        ${all.map(t => `
          <div style="display:flex;align-items:center;gap:8px;padding:5px 2px;opacity:${t.done ? '0.4' : '1'};">
            <button style="width:16px;height:16px;border-radius:4px;border:1.5px solid ${t.done ? '#34c759' : 'var(--border)'};background:${t.done ? '#34c759' : 'transparent'};color:#fff;font-size:9px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .12s;" onclick="event.stopPropagation();toggleTask('${t.id}')">${t.done ? '✓' : ''}</button>
            <span style="flex:1;font-size:12px;color:var(--text);text-decoration:${t.done ? 'line-through' : 'none'};">${esc(t.text)}</span>
            <button style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--text3);opacity:.4;padding:2px;line-height:1;" onclick="event.stopPropagation();deleteTask('${t.id}')" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.4">✕</button>
          </div>`).join('')}
      </div>` : ''}
      <div style="display:flex;gap:8px;">
        <input type="text" id="notif-task-input" placeholder="Anotar tarea…" style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;font-family:var(--font);outline:none;" onkeydown="if(event.key==='Enter'){event.stopPropagation();addTask();}" onclick="event.stopPropagation()">
        <button style="padding:7px 13px;border-radius:8px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-size:14px;font-weight:700;line-height:1;" onclick="event.stopPropagation();addTask()">+</button>
      </div>
    </div>
  `;
}

function dismissNotif(id) {
  if(!state.dismissedNotifs) state.dismissedNotifs = [];
  state.dismissedNotifs.push(id);
  saveState();
  renderNotifications();
  if(typeof renderDashNotifications === 'function') renderDashNotifications();
}
