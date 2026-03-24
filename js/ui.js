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
  if(state.transactions.length) renderDashboard();

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
  if(page==='credit-cards')renderCreditCards();
  if(page==='cc-compare'){if(typeof initCcCompare==='function')initCcCompare();}
  // Apply saved layout for this page
  setTimeout(()=>applyLayout(page), 0);
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
  ls[page] = {
    order: sections.map(s => s.dataset.key),
    hidden: sections.filter(s => s.dataset.hidden === 'true').map(s => s.dataset.key)
  };
  saveLayoutState(ls);
  showToast('Vista guardada', 'success');
}

// ── Drag & Drop ─────────────────────────────────────────────────────────────
let _dragSrc = null;

function enableDragDrop(page, container) {
  container.querySelectorAll(':scope > .layout-section').forEach(sec => {
    sec.setAttribute('draggable', 'true');
    sec.addEventListener('dragstart', onDragStart);
    sec.addEventListener('dragover', onDragOver);
    sec.addEventListener('dragleave', onDragLeave);
    sec.addEventListener('drop', onDrop);
    sec.addEventListener('dragend', onDragEnd);
  });
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

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if(!panel) return;
  const isShow = panel.style.display === 'none';
  panel.style.display = isShow ? 'flex' : 'none';
  if(isShow) renderNotifications();
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

  list.innerHTML = activeNotifs.map(n => `
    <div class="notif-item" id="notif-${n.id}">
      <div class="notif-icon-box" style="background:${n.color}22;color:${n.color};">
        ${n.icon}
      </div>
      <div class="notif-content">
        <div class="notif-title">${n.title}</div>
        <div class="notif-desc">${n.desc}</div>
        <div class="notif-time">${n.time}</div>
      </div>
      <button class="notif-item-close" onclick="dismissNotif('${n.id || n.title}')" title="Quitar">✕</button>
    </div>
  `).join('');
}

function dismissNotif(id) {
  if(!state.dismissedNotifs) state.dismissedNotifs = [];
  state.dismissedNotifs.push(id);
  saveState();
  renderNotifications();
  if(typeof renderDashNotifications === 'function') renderDashNotifications();
}
