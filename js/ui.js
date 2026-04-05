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
    showToast('✓ Todos los movimientos están categorizados','success');
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
const PAGE_SECTION={categories:'ns-config',import:'ns-config','credit-cards':'ns-credit-cards','cc-compare':'ns-credit-cards'};

function isMobileAppView(){
  return window.innerWidth <= 768;
}

function isMobileBlockedPage(page){
  return isMobileAppView() && ['insights','reportes','compare','categories','import','cc-compare','dashboard-design'].includes(page);
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

function openTrendDetail(){
  nav(isMobileAppView() ? 'tendencia' : 'compare');
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
  if(document.getElementById('page-compare').classList.contains('active')){renderCompareSelectors();renderCompare();}
  if(document.getElementById('page-reportes').classList.contains('active')) renderReportesPage();
  if(document.getElementById('page-cuotas').classList.contains('active')) {renderCuotas();renderSubs();renderFixed();renderCompromisosSummary();}
  if(document.getElementById('page-income').classList.contains('active')) renderIncomePage();
  if(document.getElementById('page-savings').classList.contains('active')) renderSavingsPage();
  if(document.getElementById('page-credit-cards')&&document.getElementById('page-credit-cards').classList.contains('active')) renderCreditCards();
}

function nav(page){
  closeMobMore();
  if(isMobileBlockedPage(page)){
    showToast('Esa pantalla quedó disponible solo en desktop', 'info');
    page='dashboard';
  }
  if(isMobileAppView() && page==='credit-cards'){
    state.ccPageTab='resumen';
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item,.mob-nav-btn').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll('.nav-section').forEach(s=>s.classList.remove('has-active'));
  document.getElementById('page-'+page).classList.add('active');
  // Activate nav item by id
  const ni=document.getElementById('ni-'+page);
  if(ni)ni.classList.add('active');
  // Open parent section if needed
  const secId=PAGE_SECTION[page];
  if(secId){openSection(secId);document.getElementById(secId)?.classList.add('has-active');}
  // Mobile nav
  const mn=document.getElementById('mn-'+page);if(mn)mn.classList.add('active');
  if(page==='compare'){renderCompareSelectors();renderCompare();}
  if(page==='insights'&&state.transactions.length)generateInsights();
  if(page==='categories'){renderCategoryManage();renderInlineColorPicker('');}
  if(page==='transactions')renderTransactions();
  if(page==='import'){renderImportHistory();updateLastBackupLabel();}
  if(page==='tendencia')renderTendencia();
  if(page==='cuotas'){renderCuotas();renderSubs();renderFixed();renderCompromisosSummary();}
  if(page==='suscripciones'){nav('cuotas');return;}
  if(page==='income')renderIncomePage();
  if(page==='savings')renderSavingsPage();
  if(page==='reportes')renderReportesPage();
  if(page==='dashboard-design')renderDashboardDesignPage();
  if(page==='credit-cards')renderCreditCards();
  if(page==='cc-compare'){if(typeof initCcCompare==='function')initCcCompare();}
  // Apply saved layout for this page
  setTimeout(()=>applyLayout(page), 0);
  requestAnimationFrame(()=>animatePageEnter(document.getElementById('page-'+page)));
}

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
function catGroupColor(g){const grp=CATEGORY_GROUPS.find(x=>x.group===g);return grp?grp.color:'#888888';}
function catGroupEmoji(g){const grp=CATEGORY_GROUPS.find(x=>x.group===g);return grp?grp.emoji:'🗑️';}
// Get all unique group names from current categories
function catGroupNames(){return [...new Set(state.categories.map(c=>c.group))];}
// Get subcategories for a group
function catSubsForGroup(g){return state.categories.filter(c=>c.group===g);}
function catNames(){return state.categories.map(c=>c.name);}
function catParentName(n){return catGroup(n);}
function getParentCat(subName){
  return CATEGORY_GROUPS.find(g=>g.subs.includes(subName))||{group:'Sin clasificar',emoji:'🗑️',color:'#888888',subs:['Uncategorized']};
}

// ══ SIDEBAR TOGGLE ══
function toggleMobMore(){
  const m=document.getElementById('mob-more-menu');
  if(m)m.style.display=m.style.display==='none'?'block':'none';
}
function closeMobMore(){
  const m=document.getElementById('mob-more-menu');
  if(m)m.style.display='none';
}
function toggleSidebar(){
  const app=document.querySelector('.app');
  const collapsed=app.classList.toggle('sidebar-collapsed');
  localStorage.setItem('fin_sidebar',collapsed?'collapsed':'open');
  const btn=document.getElementById('sidebar-open-btn');
  if(btn)btn.style.display=collapsed?'flex':'none';
}
function loadSidebar(){
  const saved=localStorage.getItem('fin_sidebar');
  if(saved==='collapsed'){
    document.querySelector('.app').classList.add('sidebar-collapsed');
    const btn=document.getElementById('sidebar-open-btn');
    if(btn)btn.style.display='flex';
  }
}

// ══ SAVINGS GOALS SUMMARY BAR ══

// ── Scroll to top button visibility ──
window.addEventListener('scroll',()=>{
  const btn=document.getElementById('scroll-top-btn');
  if(btn)btn.classList.toggle('visible',window.scrollY>400);
},{passive:true});

// ══ LAYOUT EDITOR ══════════════════════════════════════════════════════════

const LAYOUT_KEY = 'finanzas_layout_v1';

function loadLayoutState() {
  try { return JSON.parse(localStorage.getItem(LAYOUT_KEY)) || {}; } catch(e) { return {}; }
}
function saveLayoutState(ls) {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(ls));
}

// Apply saved layout on page nav
function applyLayout(page) {
  const ls = loadLayoutState();
  const pageData = ls[page];
  if (!pageData) return;
  const container = getPageContainer(page);
  if (!container) return;
  const sections = Array.from(container.querySelectorAll(':scope > .layout-section'));
  if (!sections.length) return;

  // Re-order
  if (pageData.order && pageData.order.length) {
    const parent = sections[0].parentElement;
    const banner = parent.querySelector('.layout-edit-banner');
    pageData.order.forEach(key => {
      const el = sections.find(s => s.dataset.key === key);
      if (el) parent.appendChild(el);
    });
    if (banner) parent.insertBefore(banner, parent.firstChild);
  }

  // Apply visibility — only hide explicitly saved hidden keys
  const hiddenKeys = (pageData.hidden) || [];
  sections.forEach(s => {
    const key = s.dataset.key;
    s.dataset.hidden = hiddenKeys.includes(key) ? 'true' : 'false';
  });

  if (pageData.widgetGroups) {
    Object.entries(pageData.widgetGroups).forEach(([groupName, order]) => {
      const groupEl = container.querySelector(`[data-layout-group="${groupName}"]`);
      if (!groupEl || !Array.isArray(order) || !order.length) return;
      order.forEach(key => {
        const el = groupEl.querySelector(`:scope > .layout-widget[data-widget-key="${key}"]`);
        if (el) groupEl.appendChild(el);
      });
    });
  }

  const hiddenWidgets = pageData.widgetHidden || [];
  container.querySelectorAll('.layout-widget[data-widget-key]').forEach(widget => {
    const isHidden = hiddenWidgets.includes(widget.dataset.widgetKey);
    widget.hidden = isHidden;
    widget.dataset.widgetHidden = isHidden ? 'true' : 'false';
  });
}

function getPageContainer(page) {
  const pageEl = document.getElementById('page-' + page);
  if (!pageEl) return null;
  // For pages with a content wrapper, return that; otherwise the page itself
  const contentWrap = pageEl.querySelector('#dash-content, #tendencia-content, #compare-content, #cuotas-content, #subs-content');
  return contentWrap || pageEl;
}

// Toggle edit mode on/off for a page
const _editModes = {};
function toggleEditMode(page) {
  _editModes[page] = !_editModes[page];
  const container = getPageContainer(page);
  const banner = document.getElementById('banner-' + page);
  const editBtn = document.getElementById('edit-btn-' + page);

  if (_editModes[page]) {
    // Enter edit mode
    container.classList.add('layout-edit-mode');
    if (banner) banner.classList.add('show');
    if (editBtn) editBtn.classList.add('active');
    enableDragDrop(page, container);
    updateToggleButtons(page, container);
  } else {
    // Exit edit mode
    container.classList.remove('layout-edit-mode');
    if (banner) banner.classList.remove('show');
    if (editBtn) editBtn.classList.remove('active');
    disableDragDrop(container);
    persistLayout(page, container);
  }
}

function updateToggleButtons(page, container) {
  const ls = loadLayoutState();
  const hidden = (ls[page] && ls[page].hidden) || [];
  container.querySelectorAll('.layout-section').forEach(s => {
    const btn = s.querySelector('.section-toggle-btn');
    if (!btn) return;
    const isHidden = hidden.includes(s.dataset.key) || s.dataset.hidden === 'true';
    btn.className = 'section-toggle-btn ' + (isHidden ? 'hidden' : 'visible');
    btn.textContent = isHidden ? '○ Oculto' : '● Visible';
    s.dataset.hidden = isHidden ? 'true' : 'false';
  });
}

function toggleSection_vis(page, key, btn) {
  const container = getPageContainer(page);
  const section = container.querySelector(`.layout-section[data-key="${key}"]`);
  if (!section) return;
  const isNowHidden = section.dataset.hidden !== 'true';
  section.dataset.hidden = isNowHidden ? 'true' : 'false';
  btn.className = 'section-toggle-btn ' + (isNowHidden ? 'hidden' : 'visible');
  btn.textContent = isNowHidden ? '○ Oculto' : '● Visible';
}

function persistLayout(page, container) {
  const ls = loadLayoutState();
  const sections = Array.from(container.querySelectorAll(':scope > .layout-section'));
  const widgetGroups = {};
  container.querySelectorAll('[data-layout-group]').forEach(group => {
    const key = group.dataset.layoutGroup;
    const widgets = Array.from(group.querySelectorAll(':scope > .layout-widget'));
    if (key && widgets.length) widgetGroups[key] = widgets.map(w => w.dataset.widgetKey);
  });
  ls[page] = {
    order: sections.map(s => s.dataset.key),
    hidden: sections.filter(s => s.dataset.hidden === 'true').map(s => s.dataset.key),
    widgetGroups,
    widgetHidden: Array.from(container.querySelectorAll('.layout-widget[data-widget-key]'))
      .filter(w => w.dataset.widgetHidden === 'true' || w.hidden)
      .map(w => w.dataset.widgetKey)
  };
  saveLayoutState(ls);
  showToast('Vista guardada', 'success');
}

// ── Drag & Drop ─────────────────────────────────────────────────────────────
let _dragSrc = null;
let _dragWidgetSrc = null;

function enableDragDrop(page, container) {
  container.querySelectorAll(':scope > .layout-section').forEach(sec => {
    sec.setAttribute('draggable', 'true');
    sec.addEventListener('dragstart', onDragStart);
    sec.addEventListener('dragover', onDragOver);
    sec.addEventListener('dragleave', onDragLeave);
    sec.addEventListener('drop', onDrop);
    sec.addEventListener('dragend', onDragEnd);
  });
  if (page === 'dashboard') {
    container.querySelectorAll('[data-layout-group] > .layout-widget').forEach(widget => {
      widget.setAttribute('draggable', 'true');
      widget.addEventListener('dragstart', onWidgetDragStart);
      widget.addEventListener('dragover', onWidgetDragOver);
      widget.addEventListener('dragleave', onWidgetDragLeave);
      widget.addEventListener('drop', onWidgetDrop);
      widget.addEventListener('dragend', onWidgetDragEnd);
    });
  }
}

function disableDragDrop(container) {
  container.querySelectorAll(':scope > .layout-section').forEach(sec => {
    sec.setAttribute('draggable', 'false');
    sec.removeEventListener('dragstart', onDragStart);
    sec.removeEventListener('dragover', onDragOver);
    sec.removeEventListener('dragleave', onDragLeave);
    sec.removeEventListener('drop', onDrop);
    sec.removeEventListener('dragend', onDragEnd);
  });
  container.querySelectorAll('[data-layout-group] > .layout-widget').forEach(widget => {
    widget.setAttribute('draggable', 'false');
    widget.removeEventListener('dragstart', onWidgetDragStart);
    widget.removeEventListener('dragover', onWidgetDragOver);
    widget.removeEventListener('dragleave', onWidgetDragLeave);
    widget.removeEventListener('drop', onWidgetDrop);
    widget.removeEventListener('dragend', onWidgetDragEnd);
  });
}

function onDragStart(e) {
  _dragSrc = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.key);
}
function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (this !== _dragSrc) this.classList.add('drag-over-section');
}
function onDragLeave(e) {
  this.classList.remove('drag-over-section');
}
function onDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over-section');
  if (!_dragSrc || _dragSrc === this) return;
  const parent = this.parentElement;
  const allSecs = Array.from(parent.querySelectorAll(':scope > .layout-section'));
  const srcIdx  = allSecs.indexOf(_dragSrc);
  const tgtIdx  = allSecs.indexOf(this);
  if (srcIdx < tgtIdx) {
    parent.insertBefore(_dragSrc, this.nextSibling);
  } else {
    parent.insertBefore(_dragSrc, this);
  }
}
function onDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.drag-over-section').forEach(el => el.classList.remove('drag-over-section'));
  _dragSrc = null;
}

function onWidgetDragStart(e) {
  e.stopPropagation();
  _dragWidgetSrc = this;
  this.classList.add('dragging-widget');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.widgetKey || '');
}
function onWidgetDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
  if (this !== _dragWidgetSrc && this.parentElement === _dragWidgetSrc?.parentElement) {
    this.classList.add('drag-over-widget');
  }
}
function onWidgetDragLeave(e) {
  e.stopPropagation();
  this.classList.remove('drag-over-widget');
}
function onWidgetDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  this.classList.remove('drag-over-widget');
  if (!_dragWidgetSrc || _dragWidgetSrc === this || this.parentElement !== _dragWidgetSrc.parentElement) return;
  const parent = this.parentElement;
  const widgets = Array.from(parent.querySelectorAll(':scope > .layout-widget'));
  const srcIdx = widgets.indexOf(_dragWidgetSrc);
  const tgtIdx = widgets.indexOf(this);
  if (srcIdx < tgtIdx) parent.insertBefore(_dragWidgetSrc, this.nextSibling);
  else parent.insertBefore(_dragWidgetSrc, this);
}
function onWidgetDragEnd(e) {
  e.stopPropagation();
  this.classList.remove('dragging-widget');
  document.querySelectorAll('.drag-over-widget').forEach(el => el.classList.remove('drag-over-widget'));
  _dragWidgetSrc = null;
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if(!panel) return;
  const isShow = panel.style.display === 'none';
  panel.style.display = isShow ? 'flex' : 'none';
  if(isShow){
    renderNotifications();
    requestAnimationFrame(()=>replayFadeUp(panel));
  }
}

function renderNotifications() {
  const list = document.getElementById('notif-list');
  const badge = document.getElementById('notif-badge');
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
        id: `spend-limit-${today.toISOString().slice(0,7)}`,
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

  // Filter out dismissed
  const activeNotifs = notifs.filter(n => !(state.dismissedNotifs || []).includes(n.id || n.title));

  // Badge handling
  if(badge) badge.style.display = activeNotifs.length > 0 ? 'block' : 'none';

  if(activeNotifs.length === 0) {
    list.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon">✨</div>
        <div class="notif-empty-title">Todo al día</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px;">No tenés avisos o alertas pendientes por ahora.</div>
      </div>
    `;
    return;
  }

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

function dismissNotif(id) {
  if(!state.dismissedNotifs) state.dismissedNotifs = [];
  state.dismissedNotifs.push(id);
  saveState();
  renderNotifications();
  if(typeof renderDashNotifications === 'function') renderDashNotifications();
}

const DASHBOARD_WIDGET_META = {
  'usd-card': { label:'Dólar oficial', group:'dashboard-utility', desc:'Tipo de cambio operativo con acceso rápido a compra y venta.' },
  'timeline-card': { label:'Agenda viva', group:'dashboard-utility', desc:'Tus próximos eventos financieros relevantes en formato agenda.' },
  'credit-kpi': { label:'Ciclo tarjetas', group:'dashboard-kpis', desc:'Resumen del ciclo actual por tarjeta.' },
  'projection-kpi': { label:'Proyección al cierre', group:'dashboard-kpis', desc:'Estimación del cierre si seguís al ritmo actual.' },
  'commitments-kpi': { label:'Compromisos próximos', group:'dashboard-kpis', desc:'Cuánto del ingreso ya está comprometido el próximo mes.' },
  'history-kpis': { label:'Promedios históricos', group:'dashboard-kpis', desc:'Promedio diario y mensual sobre toda tu historia cargada.' },
  'main-chart': { label:'Gráfico principal', group:'dashboard-charts', desc:'Lectura mensual, diaria o semanal del gasto.' },
  'categories-chart': { label:'Categorías del mes', group:'dashboard-charts', desc:'Distribución y peso de cada categoría en el período.' },
  'margin-widget': { label:'Margen disponible', group:'dashboard-widgets', desc:'Lo que todavía podés gastar sin pasarte del ingreso.' },
  'trend-widget': { label:'Categoría en alza', group:'dashboard-widgets', desc:'La categoría que más se aceleró contra el período anterior.' },
  'goal-widget': { label:'Meta más cercana', group:'dashboard-widgets', desc:'Qué objetivo de ahorro tenés más próximo a completar.' },
  'income-widget': { label:'Ingreso del período', group:'dashboard-widgets', desc:'Lectura consolidada del ingreso ARS + USD del período activo.' },
  'usd-exposure-widget': { label:'Exposición USD', group:'dashboard-widgets', desc:'Qué porcentaje del gasto del período depende del dólar.' },
  'largest-widget': { label:'Gasto más alto', group:'dashboard-widgets', desc:'El ticket más grande registrado en el período activo.' }
};

const DASHBOARD_GROUP_META = {
  'dashboard-utility': 'Franja utilitaria',
  'dashboard-kpis': 'KPIs del período',
  'dashboard-charts': 'Gráficos centrales',
  'dashboard-widgets': 'Widgets secundarios'
};

const DASHBOARD_DESIGN_PRESETS = {
  balanced: {
    name: 'Balanceado',
    desc: 'La vista más completa y equilibrada para el día a día.',
    widgetHidden: []
  },
  minimal: {
    name: 'Minimal',
    desc: 'Menos ruido, más foco en gasto, agenda y compromisos.',
    widgetHidden: ['usd-card', 'history-kpis', 'margin-widget', 'trend-widget', 'goal-widget', 'income-widget', 'usd-exposure-widget', 'largest-widget']
  },
  ahorro: {
    name: 'Modo ahorro',
    desc: 'Resalta margen, agenda, compromisos y metas.',
    widgetHidden: ['credit-kpi', 'usd-card'],
    widgetGroups: {
      'dashboard-kpis': ['projection-kpi', 'commitments-kpi', 'history-kpis', 'credit-kpi'],
      'dashboard-widgets': ['margin-widget', 'goal-widget', 'income-widget', 'trend-widget', 'usd-exposure-widget', 'largest-widget']
    }
  },
  analitico: {
    name: 'Analítico',
    desc: 'Prioriza lectura histórica, categorías y comparaciones.',
    widgetHidden: [],
    widgetGroups: {
      'dashboard-kpis': ['projection-kpi', 'credit-kpi', 'history-kpis', 'commitments-kpi'],
      'dashboard-charts': ['categories-chart', 'main-chart'],
      'dashboard-widgets': ['income-widget', 'usd-exposure-widget', 'largest-widget', 'margin-widget', 'trend-widget', 'goal-widget']
    }
  },
  ejecutivo: {
    name: 'Ejecutivo',
    desc: 'Menos detalle operativo y más lectura de alto nivel.',
    widgetHidden: ['trend-widget', 'goal-widget'],
    widgetGroups: {
      'dashboard-utility': ['timeline-card', 'usd-card'],
      'dashboard-kpis': ['projection-kpi', 'commitments-kpi', 'credit-kpi', 'history-kpis'],
      'dashboard-widgets': ['income-widget', 'margin-widget', 'usd-exposure-widget', 'largest-widget', 'trend-widget', 'goal-widget']
    }
  },
  seguimiento: {
    name: 'Seguimiento',
    desc: 'Ideal para mirar todos los días ritmo, ingreso y tickets grandes.',
    widgetHidden: [],
    widgetGroups: {
      'dashboard-widgets': ['income-widget', 'largest-widget', 'margin-widget', 'trend-widget', 'usd-exposure-widget', 'goal-widget']
    }
  }
};

function getDashboardWidgetOrder(container){
  const widgetGroups = {};
  container.querySelectorAll('[data-layout-group]').forEach(group => {
    const key = group.dataset.layoutGroup;
    const widgets = Array.from(group.querySelectorAll(':scope > .layout-widget'));
    if (key && widgets.length) widgetGroups[key] = widgets.map(w => w.dataset.widgetKey);
  });
  return widgetGroups;
}

function getDashboardDesignState(){
  const ls = loadLayoutState();
  const pageData = ls.dashboard || {};
  const container = document.getElementById('dash-content');
  const currentGroups = container ? getDashboardWidgetOrder(container) : {};
  const mergedGroups = {};
  Object.keys(DASHBOARD_GROUP_META).forEach(groupKey=>{
    const saved = Array.isArray(pageData.widgetGroups?.[groupKey]) ? [...pageData.widgetGroups[groupKey]] : [];
    const current = Array.isArray(currentGroups[groupKey]) ? [...currentGroups[groupKey]] : [];
    const merged = [...saved];
    current.forEach(key=>{
      if(!merged.includes(key)) merged.push(key);
    });
    mergedGroups[groupKey] = merged.filter(key => DASHBOARD_WIDGET_META[key]);
  });
  return {
    order: Array.isArray(pageData.order) ? [...pageData.order] : [],
    hidden: Array.isArray(pageData.hidden) ? [...pageData.hidden] : [],
    widgetGroups: mergedGroups,
    widgetHidden: Array.isArray(pageData.widgetHidden) ? [...pageData.widgetHidden] : ['income-widget','usd-exposure-widget','largest-widget']
  };
}

function saveDashboardDesignState(pageData, silent){
  const ls = loadLayoutState();
  ls.dashboard = {
    ...(ls.dashboard || {}),
    order: Array.isArray(pageData.order) ? pageData.order : (ls.dashboard?.order || []),
    hidden: Array.isArray(pageData.hidden) ? pageData.hidden : (ls.dashboard?.hidden || []),
    widgetGroups: pageData.widgetGroups || (ls.dashboard?.widgetGroups || {}),
    widgetHidden: Array.isArray(pageData.widgetHidden) ? pageData.widgetHidden : (ls.dashboard?.widgetHidden || [])
  };
  saveLayoutState(ls);
  applyLayout('dashboard');
  if(!silent) showToast('Diseño del dashboard guardado', 'success');
}

function getDashboardSavedViews(){
  const ls = loadLayoutState();
  return Array.isArray(ls.dashboard?.savedViews) ? ls.dashboard.savedViews : [];
}

function saveDashboardSavedViews(views){
  const ls = loadLayoutState();
  ls.dashboard = {
    ...(ls.dashboard || {}),
    savedViews: views
  };
  saveLayoutState(ls);
}

function buildDashboardMiniPreview(designState){
  const rows = [
    (designState.widgetGroups['dashboard-utility'] || []).filter(key => !designState.widgetHidden.includes(key)).slice(0,2),
    (designState.widgetGroups['dashboard-kpis'] || []).filter(key => !designState.widgetHidden.includes(key)).slice(0,4),
    (designState.widgetGroups['dashboard-charts'] || []).filter(key => !designState.widgetHidden.includes(key)).slice(0,2),
    (designState.widgetGroups['dashboard-widgets'] || []).filter(key => !designState.widgetHidden.includes(key)).slice(0,6)
  ];
  return `
    <div class="dashboard-preview-canvas">
      ${rows.map((row, idx)=>`
        <div class="dashboard-preview-row row-${idx+1}">
          ${row.length ? row.map(key=>`
            <div class="dashboard-preview-block size-${row.length >= 4 ? 's' : row.length === 3 ? 'm' : 'l'}">
              <span>${(DASHBOARD_WIDGET_META[key]?.label || key).replace(' del período','').replace(' próximos','')}</span>
            </div>
          `).join('') : `<div class="dashboard-preview-empty">sin widgets</div>`}
        </div>
      `).join('')}
    </div>
  `;
}

function renderDashboardDesignPage(){
  const presetsEl = document.getElementById('dashboard-design-presets');
  const groupsEl = document.getElementById('dashboard-design-groups');
  const summaryEl = document.getElementById('dashboard-design-summary');
  const libraryEl = document.getElementById('dashboard-design-library');
  const previewEl = document.getElementById('dashboard-design-preview');
  const savedEl = document.getElementById('dashboard-design-saved');
  if(!presetsEl || !groupsEl || !summaryEl || !libraryEl || !previewEl || !savedEl) return;

  const designState = getDashboardDesignState();
  const groups = designState.widgetGroups || {};
  const visibleCount = Object.keys(DASHBOARD_WIDGET_META).filter(key => !designState.widgetHidden.includes(key)).length;
  const savedViews = getDashboardSavedViews();

  presetsEl.innerHTML = Object.entries(DASHBOARD_DESIGN_PRESETS).map(([id,preset])=>`
    <button class="dashboard-preset-card" onclick="applyDashboardDesignPreset('${id}')">
      <span class="dashboard-preset-preview">
        <span></span><span></span><span></span><span></span>
      </span>
      <span class="dashboard-preset-name">${preset.name}</span>
      <span class="dashboard-preset-desc">${preset.desc}</span>
    </button>
  `).join('');

  savedEl.innerHTML = savedViews.length ? savedViews.map(view=>`
    <div class="dashboard-saved-card">
      <div class="dashboard-saved-top">
        <div class="dashboard-saved-name">${view.name}</div>
        <span class="dashboard-library-state on">guardada</span>
      </div>
      <div class="dashboard-saved-preview">
        ${buildDashboardMiniPreview(view)}
      </div>
      <div class="dashboard-saved-actions">
        <button class="dashboard-widget-mini" onclick="applySavedDashboardView('${view.id}')">Aplicar</button>
        <button class="dashboard-widget-mini" onclick="renameSavedDashboardView('${view.id}')">Renombrar</button>
        <button class="dashboard-widget-mini" onclick="deleteSavedDashboardView('${view.id}')">Borrar</button>
      </div>
    </div>
  `).join('') : `<div class="dashboard-empty-note">Todavía no guardaste vistas propias. Cuando armes una que te guste, tocá <strong>Guardar vista</strong>.</div>`;

  libraryEl.innerHTML = Object.entries(DASHBOARD_WIDGET_META).map(([key, meta])=>{
    const hidden = designState.widgetHidden.includes(key);
    return `
      <div class="dashboard-library-card ${hidden ? 'is-hidden' : 'is-visible'}">
        <div class="dashboard-library-top">
          <div>
            <div class="dashboard-library-title">${meta.label}</div>
            <div class="dashboard-library-desc">${meta.desc}</div>
          </div>
          <span class="dashboard-library-state ${hidden ? 'off' : 'on'}">${hidden ? 'Oculto' : 'Visible'}</span>
        </div>
        <div class="dashboard-library-meta">${DASHBOARD_GROUP_META[meta.group] || 'Dashboard'}</div>
        <div class="dashboard-library-actions">
          <button class="dashboard-widget-toggle ${hidden ? 'off' : 'on'}" onclick="toggleDashboardWidgetVisibility('${key}')">${hidden ? 'Agregar al dashboard' : 'Quitar del dashboard'}</button>
        </div>
      </div>
    `;
  }).join('');

  groupsEl.innerHTML = Object.entries(DASHBOARD_GROUP_META).map(([groupKey, groupName])=>{
    const order = groups[groupKey] || [];
    const widgets = order.filter(key => DASHBOARD_WIDGET_META[key]).map((key, idx)=>{
      const hidden = designState.widgetHidden.includes(key);
      return `
        <div class="dashboard-widget-row ${hidden ? 'is-hidden' : ''}">
          <div class="dashboard-widget-row-main">
            <div class="dashboard-widget-name">${DASHBOARD_WIDGET_META[key].label}</div>
            <div class="dashboard-widget-meta">${hidden ? 'Oculto en el dashboard' : 'Visible en el dashboard'}</div>
          </div>
          <div class="dashboard-widget-row-actions">
            <button class="dashboard-widget-mini" onclick="moveDashboardWidget('${groupKey}','${key}',-1)" ${idx===0?'disabled':''}>↑</button>
            <button class="dashboard-widget-mini" onclick="moveDashboardWidget('${groupKey}','${key}',1)" ${idx===order.length-1?'disabled':''}>↓</button>
            <button class="dashboard-widget-toggle ${hidden ? 'off' : 'on'}" onclick="toggleDashboardWidgetVisibility('${key}')">${hidden ? 'Mostrar' : 'Ocultar'}</button>
          </div>
        </div>
      `;
    }).join('');
    return `
      <div class="dashboard-group-editor">
        <div class="dashboard-group-editor-head">
          <div class="dashboard-group-editor-title">${groupName}</div>
          <div class="dashboard-group-editor-sub">${order.length} widgets</div>
        </div>
        <div class="dashboard-group-editor-list">${widgets}</div>
      </div>
    `;
  }).join('');

  summaryEl.innerHTML = `
    <div class="dashboard-summary-stat">
      <span class="dashboard-summary-label">Widgets visibles</span>
      <strong>${visibleCount}</strong>
    </div>
    <div class="dashboard-summary-stat">
      <span class="dashboard-summary-label">Widgets ocultos</span>
      <strong>${Object.keys(DASHBOARD_WIDGET_META).length - visibleCount}</strong>
    </div>
    <div class="dashboard-summary-stat">
      <span class="dashboard-summary-label">Grupos editables</span>
      <strong>${Object.keys(DASHBOARD_GROUP_META).length}</strong>
    </div>
    <div class="dashboard-summary-stat">
      <span class="dashboard-summary-label">Widgets disponibles</span>
      <strong>${Object.keys(DASHBOARD_WIDGET_META).length}</strong>
    </div>
    <div class="dashboard-summary-stat">
      <span class="dashboard-summary-label">Vistas guardadas</span>
      <strong>${savedViews.length}</strong>
    </div>
    <div class="dashboard-summary-copy">Usá presets para cambiar rápido el estilo general y guardá tus propias vistas para alternar entre tableros más minimalistas, ejecutivos o analíticos.</div>
  `;

  previewEl.innerHTML = buildDashboardMiniPreview(designState);
}

function applyDashboardDesignPreset(presetId){
  const preset = DASHBOARD_DESIGN_PRESETS[presetId];
  if(!preset) return;
  const designState = getDashboardDesignState();
  saveDashboardDesignState({
    ...designState,
    widgetGroups: {
      ...designState.widgetGroups,
      ...(preset.widgetGroups || {})
    },
    widgetHidden: [...(preset.widgetHidden || [])]
  });
  renderDashboardDesignPage();
}

function toggleDashboardWidgetVisibility(widgetKey){
  const designState = getDashboardDesignState();
  const hidden = new Set(designState.widgetHidden || []);
  if(hidden.has(widgetKey)) hidden.delete(widgetKey);
  else hidden.add(widgetKey);
  saveDashboardDesignState({
    ...designState,
    widgetHidden: Array.from(hidden)
  });
  renderDashboardDesignPage();
}

function moveDashboardWidget(groupKey, widgetKey, direction){
  const designState = getDashboardDesignState();
  const order = [...(designState.widgetGroups[groupKey] || [])];
  const index = order.indexOf(widgetKey);
  if(index < 0) return;
  const nextIndex = index + direction;
  if(nextIndex < 0 || nextIndex >= order.length) return;
  const temp = order[index];
  order[index] = order[nextIndex];
  order[nextIndex] = temp;
  saveDashboardDesignState({
    ...designState,
    widgetGroups: {
      ...designState.widgetGroups,
      [groupKey]: order
    }
  });
  renderDashboardDesignPage();
}

function resetDashboardDesign(){
  const ls = loadLayoutState();
  delete ls.dashboard;
  saveLayoutState(ls);
  applyLayout('dashboard');
  renderDashboardDesignPage();
  showToast('Diseño restablecido', 'success');
}

function saveCurrentDashboardView(){
  const name = prompt('¿Cómo querés llamar a esta vista del dashboard?');
  if(!name || !name.trim()) return;
  const designState = getDashboardDesignState();
  const views = getDashboardSavedViews();
  const id = 'dashview-' + Date.now();
  views.unshift({
    id,
    name: name.trim(),
    ...designState
  });
  saveDashboardSavedViews(views.slice(0,8));
  renderDashboardDesignPage();
  showToast('Vista guardada', 'success');
}

function applySavedDashboardView(id){
  const view = getDashboardSavedViews().find(v => v.id === id);
  if(!view) return;
  saveDashboardDesignState({
    order: view.order || [],
    hidden: view.hidden || [],
    widgetGroups: view.widgetGroups || {},
    widgetHidden: view.widgetHidden || []
  });
  renderDashboardDesignPage();
}

function renameSavedDashboardView(id){
  const views = getDashboardSavedViews();
  const view = views.find(v => v.id === id);
  if(!view) return;
  const next = prompt('Nuevo nombre para esta vista:', view.name || '');
  if(!next || !next.trim()) return;
  view.name = next.trim();
  saveDashboardSavedViews(views);
  renderDashboardDesignPage();
}

function deleteSavedDashboardView(id){
  const views = getDashboardSavedViews().filter(v => v.id !== id);
  saveDashboardSavedViews(views);
  renderDashboardDesignPage();
  showToast('Vista eliminada', 'success');
}
