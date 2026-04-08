// ══ GLOBAL APP SHELL LOGIC ══

(function(){
  const AVATAR_PRESETS = [
    { id:'coral', label:'Coral' },
    { id:'navy', label:'Navy' },
    { id:'mint', label:'Mint' },
    { id:'sun', label:'Sun' },
    { id:'lilac', label:'Lilac' },
    { id:'forest', label:'Forest' }
  ];
  const SETTINGS_GUIDE_KEY = 'fin_settings_setup_open';
  let uiSyncQueued = false;

  function esc(value){
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getUserName(){
    return (window.getResolvedUserName?.() || window.state?.userName || 'Pedro').trim() || 'Pedro';
  }

  function getGoogleEmail(){
    return (window.state?.googleProfile?.email || '').trim();
  }

  function getManualEmail(){
    return (window.state?.manualUserEmail || window.state?.userEmail || '').trim();
  }

  function getPrimaryEmail(){
    return (window.getResolvedUserEmail?.() || getGoogleEmail() || getManualEmail()).trim();
  }

  function hasRecentSync(){
    return !!window.state?.lastGmailSync;
  }

  function formatDateTime(value, fallback){
    if(!value) return fallback || '—';
    const date = new Date(value);
    if(Number.isNaN(date.getTime())) return fallback || '—';
    return date.toLocaleString('es-AR', { dateStyle:'medium', timeStyle:'short' });
  }

  function getSyncLabel(){
    return hasRecentSync() ? formatDateTime(window.state.lastGmailSync, '—') : 'Sin sincronización todavía';
  }

  function getConnectionLabel(){
    return window.isGoogleConnected?.() ? 'Google conectado' : 'Cuenta local';
  }

  function getConnectionMeta(){
    if(window.isGoogleConnected?.()){
      return hasRecentSync() ? `Última sync: ${formatDateTime(window.state.lastGmailSync, '—')}` : 'Google listo para sincronizar';
    }
    return getManualEmail() ? 'Usando email manual guardado' : 'Completá tu email para identificar la cuenta';
  }

  function getInitials(name){
    return String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() || '')
      .join('') || 'P';
  }

  function getAvatarLetter(){
    return getInitials(getUserName());
  }

  function encodeSvg(svg){
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  function buildPresetSvg(id){
    const themes = {
      coral:['#FFB199','#FF5F6D','#3B1F2B','#FFE8E0'],
      navy:['#8FD3F4','#4A67D6','#14203A','#F2F7FF'],
      mint:['#B7F8DB','#50A7C2','#0F3D44','#F4FFFB'],
      sun:['#FCE38A','#F38181','#5D3A1A','#FFF8E7'],
      lilac:['#D9AFD9','#97D9E1','#2C2340','#FFF3FF'],
      forest:['#C1FBA4','#2F855A','#173225','#F3FFF7']
    };
    const [top,bottom,hair,shirt] = themes[id] || themes.coral;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${top}"/>
            <stop offset="100%" stop-color="${bottom}"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="36" fill="url(#bg)"/>
        <circle cx="60" cy="45" r="19" fill="#FFD8BF"/>
        <path d="M38 41c2-17 42-23 48 1c-1-8-8-20-24-20c-14 0-23 8-24 19z" fill="${hair}"/>
        <path d="M37 99c4-17 16-28 23-28s19 10 23 28z" fill="${shirt}"/>
        <circle cx="53" cy="46" r="2" fill="#2A2A2A"/>
        <circle cx="67" cy="46" r="2" fill="#2A2A2A"/>
        <path d="M54 55c2 2 10 2 12 0" stroke="#A35A4A" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      </svg>`;
    return encodeSvg(svg);
  }

  function getAvatarBackground(){
    if(window.state?.userAvatarMode === 'upload' && window.state?.userAvatar){
      return window.state.userAvatar;
    }
    if(window.state?.userAvatarMode === 'preset' && window.state?.userAvatarPreset){
      return buildPresetSvg(window.state.userAvatarPreset);
    }
    return '';
  }

  function applyAvatarSurface(target, letterId){
    const surface = typeof target === 'string' ? document.getElementById(target) : target;
    if(!surface) return;
    const letterEl = letterId ? document.getElementById(letterId) : surface.querySelector('span');
    const bg = getAvatarBackground();
    if(bg){
      surface.style.backgroundImage = `url("${bg}")`;
      surface.classList.add('has-image');
      if(letterEl) letterEl.style.opacity = '0';
    } else {
      surface.style.backgroundImage = '';
      surface.classList.remove('has-image');
      if(letterEl){
        letterEl.textContent = getAvatarLetter();
        letterEl.style.opacity = '1';
      }
    }
  }

  function renderAvatarPresetGrid(){
    const grid = document.getElementById('profile-avatar-presets');
    if(!grid) return;
    const activePreset = window.state?.userAvatarPreset || '';
    grid.innerHTML = AVATAR_PRESETS.map(preset => `
      <button class="profile-avatar-option ${activePreset===preset.id && window.state?.userAvatarMode==='preset' ? 'active' : ''}" onclick="selectPresetAvatar('${preset.id}')">
        <span class="profile-avatar-option-preview" style="background-image:url('${buildPresetSvg(preset.id)}')"></span>
        <span class="profile-avatar-option-label">${preset.label}</span>
      </button>
    `).join('');
    document.getElementById('avatar-source-upload')?.classList.toggle('active', (window.state?.userAvatarMode || 'upload') === 'upload');
    document.getElementById('avatar-source-preset')?.classList.toggle('active', window.state?.userAvatarMode === 'preset');
  }

  function renderAppShellProfile(){
    document.getElementById('dd-user-name')?.replaceChildren(document.createTextNode(getUserName()));
    document.getElementById('dd-user-email')?.replaceChildren(document.createTextNode(getPrimaryEmail() || 'Sin email configurado'));
    applyAvatarSurface('app-avatar-btn', 'app-avatar-letter');
    applyAvatarSurface(document.querySelector('.profile-dd-avatar'), 'dd-avatar-letter');
  }

  function renderProfilePage(){
    renderAppShellProfile();
    document.getElementById('profile-name')?.replaceChildren(document.createTextNode(getUserName()));
    document.getElementById('profile-email')?.replaceChildren(document.createTextNode(getPrimaryEmail() || 'Email pendiente'));
    document.getElementById('profile-connection-text')?.replaceChildren(document.createTextNode(getConnectionLabel()));
    document.getElementById('profile-connection-meta')?.replaceChildren(document.createTextNode(getConnectionMeta()));

    const prefs = window.state?.userPrefs || { currency:'ARS', language:'es', theme:(document.body.classList.contains('light-mode') ? 'light' : 'dark') };
    const pfName = document.getElementById('pf-name');
    const pfEmail = document.getElementById('pf-email');
    if(pfName && document.activeElement !== pfName) pfName.value = getUserName();
    if(pfEmail && document.activeElement !== pfEmail) pfEmail.value = getManualEmail();
    document.getElementById('pf-currency') && (document.getElementById('pf-currency').value = prefs.currency || 'ARS');
    document.getElementById('pf-lang') && (document.getElementById('pf-lang').value = prefs.language || 'es');
    document.getElementById('pf-theme') && (document.getElementById('pf-theme').value = prefs.theme || 'dark');
    document.getElementById('pf-email-note')?.replaceChildren(document.createTextNode(
      window.isGoogleConnected?.()
        ? `Google usa ${getGoogleEmail() || 'esta cuenta'} como email principal mientras esté conectado.`
        : 'Este email se usa como identidad principal de la cuenta.'
    ));

    applyAvatarSurface('profile-avatar', 'profile-avatar-big');
    renderAvatarPresetGrid();

    document.getElementById('pf-google-conn-status')?.replaceChildren(document.createTextNode(window.isGoogleConnected?.() ? 'Conectado' : 'No conectado'));
    document.getElementById('pf-google-sync-status')?.replaceChildren(document.createTextNode(getSyncLabel()));
    document.getElementById('pf-google-email-status')?.replaceChildren(document.createTextNode(getGoogleEmail() || '—'));
  }

  function renderSecurityPage(){
    const connected = !!window.isGoogleConnected?.();
    document.getElementById('security-google-status')?.replaceChildren(document.createTextNode(connected ? 'Conectado' : 'No conectado'));
    document.getElementById('security-google-email')?.replaceChildren(document.createTextNode(getGoogleEmail() || getManualEmail() || '—'));
    document.getElementById('security-sync-time')?.replaceChildren(document.createTextNode(getSyncLabel()));
    window.updateLastBackupLabel?.();
    window.renderBackupHistory?.();
    const lastRestore = localStorage.getItem('fin_last_restore');
    document.getElementById('security-last-restore')?.replaceChildren(document.createTextNode(
      lastRestore ? formatDateTime(lastRestore, 'Nunca') : 'Nunca'
    ));
    document.getElementById('security-restore-status')?.replaceChildren(document.createTextNode(
      lastRestore ? `Última restauración: ${formatDateTime(lastRestore, 'Nunca')}` : 'Listo para restaurar desde backup'
    ));
  }

  function buildSetupGuideSteps(){
    if(typeof window.getOnboardingWizardSteps !== 'function') return [];
    return window.getOnboardingWizardSteps().map(step => `
      <div class="settings-guide-step ${step.done ? 'done' : ''}">
        <div class="settings-guide-step-icon">${esc(step.icon || (step.done ? '✓' : '•'))}</div>
        <div class="settings-guide-step-copy">
          <strong>${esc(step.title || 'Paso')}</strong>
          <small>${esc(step.sub || '')}</small>
        </div>
        <button class="dashboard-widget-mini ${step.done ? '' : 'primary'}" onclick="${step.onclick || 'void(0)'}">${esc(step.action || 'Abrir')}</button>
      </div>
    `).join('');
  }

  function renderSetupGuide(){
    const body = document.getElementById('settings-setup-guide');
    const arrow = document.getElementById('settings-setup-arrow');
    if(!body || !arrow) return;
    const open = localStorage.getItem(SETTINGS_GUIDE_KEY) !== '0';
    body.style.display = open ? 'block' : 'none';
    arrow.textContent = open ? '⌄' : '›';
    body.innerHTML = `
      <div class="settings-guide-copy">
        <div class="settings-guide-copy-title">Base inicial para una cuenta lista para operar</div>
        <div class="settings-guide-copy-sub">Google, reglas, tarjetas e ingresos forman el bloque que más impacto tiene sobre importación, conciliación y lectura financiera.</div>
      </div>
      <div class="settings-guide-steps">${buildSetupGuideSteps()}</div>
      <div class="profile-inline-actions">
        <button class="btn btn-primary btn-sm" onclick="openModal('modal-onboarding-wizard')">Abrir guía</button>
        <button class="btn btn-ghost btn-sm" onclick="nav('income')">Ir a ingresos</button>
      </div>
    `;
  }

  function renderSettingsAccountsList(){
    const el = document.getElementById('settings-accounts-list');
    if(!el) return;
    const profiles = window.state?.bankProfiles || [];
    if(!profiles.length){
      el.innerHTML = `<div class="settings-empty-block">Todavía no hay cuentas configuradas. Agregá una para definir banco, wallet o tarjeta y su método operativo.</div>`;
      return;
    }
    el.innerHTML = profiles.map(profile => `
      <div class="settings-fintech-row">
        <div class="settings-fintech-main">
          <strong>${esc(profile.name || 'Cuenta')}</strong>
          <small>${esc(profile.bank || 'Sin banco')} · ${esc(profile.card || 'Sin detalle')}</small>
          <div class="settings-fintech-chips">
            <span>${esc(profile.typeLabel || 'Cuenta bancaria')}</span>
            <span>${profile.status === 'inactive' ? 'Inactiva' : 'Activa'}</span>
            <span>${esc(profile.methodLabel || 'Manual')}</span>
            ${profile.balance ? `<span>$${esc(typeof fmtN === 'function' ? fmtN(Math.round(profile.balance)) : Math.round(profile.balance))}</span>` : ''}
          </div>
        </div>
        <div class="settings-fintech-actions">
          <button class="dashboard-widget-mini primary" onclick="openBankProfileManager('${esc(profile.id)}')">Editar</button>
          <button class="dashboard-widget-mini" onclick="deleteBankProfileById('${esc(profile.id)}')">Eliminar</button>
        </div>
      </div>
    `).join('');
  }

  function renderSettingsCardsList(){
    const el = document.getElementById('settings-cards-list');
    if(!el) return;
    const cards = window.state?.ccCards || [];
    const cycles = typeof window.getTcCycles === 'function' ? window.getTcCycles() : [];
    const tcConfig = window.state?.tcConfig || {};
    if(!cards.length){
      el.innerHTML = `<div class="settings-empty-block">No hay tarjetas registradas todavía. La configuración de ciclos y límites vive en el módulo de tarjetas.</div>`;
      return;
    }
    el.innerHTML = cards.map(card => {
      const pendingCycle = cycles.find(cycle => {
        const status = (window.state?.ccCycles || []).find(item => item.cardId === card.id && item.tcCycleId === cycle.id);
        return !status || status.status !== 'paid';
      }) || cycles[0] || null;
      return `
        <div class="settings-fintech-row">
          <div class="settings-fintech-main">
            <strong>${esc(card.name || 'Tarjeta')}</strong>
            <small>${esc(card.payMethodKey ? card.payMethodKey.toUpperCase() : 'Sin identificador')} · ${pendingCycle ? `Cierre ${esc(pendingCycle.closeDate || '—')}` : 'Sin ciclo activo'}</small>
            <div class="settings-fintech-chips">
              <span>${pendingCycle?.dueDate ? `Vence ${esc(pendingCycle.dueDate)}` : 'Sin vencimiento'}</span>
              <span>${tcConfig.limit ? `Límite $${esc(typeof fmtN === 'function' ? fmtN(Math.round(tcConfig.limit)) : Math.round(tcConfig.limit))}` : 'Límite no definido'}</span>
              <span>${cards.length > 1 ? 'Multi-card listo' : '1 tarjeta activa'}</span>
            </div>
          </div>
          <div class="settings-fintech-actions">
            <button class="dashboard-widget-mini primary" onclick="nav('credit-cards');ccSelectPageTab('config')">Configurar</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderSettingsCategoriesList(){
    const el = document.getElementById('settings-categories-list');
    if(!el) return;
    const categories = window.state?.categories || [];
    const counts = {};
    (window.state?.transactions || []).forEach(txn => {
      counts[txn.category] = (counts[txn.category] || 0) + 1;
    });
    if(!categories.length){
      el.innerHTML = `<div class="settings-empty-block">No hay categorías disponibles.</div>`;
      return;
    }
    el.innerHTML = categories.slice().sort((a,b) => (counts[b.name] || 0) - (counts[a.name] || 0)).map(cat => `
      <div class="settings-fintech-row">
        <div class="settings-fintech-main">
          <strong><span class="settings-category-dot" style="background:${esc(cat.color || '#64748b')}"></span>${esc(cat.name)}</strong>
          <small>${esc(cat.group || 'Sin grupo')} · ${counts[cat.name] || 0} movimiento${(counts[cat.name] || 0) === 1 ? '' : 's'}</small>
        </div>
        <div class="settings-fintech-actions">
          <button class="dashboard-widget-mini primary" onclick="openEditCatModal('${esc(cat.name)}')">Editar</button>
        </div>
      </div>
    `).join('');
  }

  function renderSettingsGmailRulesList(){
    const el = document.getElementById('settings-gmail-rules-list');
    if(!el) return;
    const rules = window.state?.gmailImportRules || [];
    if(!rules.length){
      el.innerHTML = `<div class="settings-empty-block">Todavía no hay reglas Gmail. Configurá remitente, filtro, categoría y lógica de parsing para automatizar importaciones.</div>`;
      return;
    }
    el.innerHTML = rules.map(rule => `
      <div class="settings-fintech-row">
        <div class="settings-fintech-main">
          <strong>${esc(rule.name || 'Regla Gmail')}</strong>
          <small>${esc(rule.sender || 'Sin remitente')} · ${esc(rule.query || 'Sin filtro adicional')}</small>
          <div class="settings-fintech-chips">
            <span>${rule.active !== false ? 'Activa' : 'Pausada'}</span>
            <span>${esc(rule.category || 'Auto detectar')}</span>
            <span>${esc(rule.movementType || (rule.importKind === 'subscription' ? 'subscription' : 'expense'))}</span>
            <span>${esc(rule.processor || 'santander_email')}</span>
          </div>
        </div>
        <div class="settings-fintech-actions">
          <button class="dashboard-widget-mini" onclick="toggleGmailRule('${esc(rule.id)}')">${rule.active !== false ? 'Pausar' : 'Activar'}</button>
          <button class="dashboard-widget-mini primary" onclick="openGmailRuleManager('${esc(rule.id)}')">Editar</button>
          <button class="dashboard-widget-mini" onclick="deleteGmailRuleById('${esc(rule.id)}')">Eliminar</button>
        </div>
      </div>
    `).join('');
  }

  function renderSettingsGoogleSection(){
    document.getElementById('settings-google-connection-status')?.replaceChildren(document.createTextNode(getConnectionLabel()));
    document.getElementById('settings-google-email')?.replaceChildren(document.createTextNode(getGoogleEmail() || getManualEmail() || '—'));
    document.getElementById('settings-google-sync')?.replaceChildren(document.createTextNode(getSyncLabel()));
  }

  function renderSettingsCenter(){
    renderSettingsGoogleSection();
    renderSetupGuide();
    renderSettingsAccountsList();
    renderSettingsCardsList();
    renderSettingsCategoriesList();
    renderSettingsGmailRulesList();
  }

  function syncActiveUi(){
    renderAppShellProfile();
    const activePage = document.querySelector('.page.active')?.id?.replace('page-','') || '';
    if(activePage === 'profile') renderProfilePage();
    if(activePage === 'security') renderSecurityPage();
    if(activePage === 'settings') renderSettingsCenter();
  }

  function queueUiSync(){
    if(uiSyncQueued) return;
    uiSyncQueued = true;
    requestAnimationFrame(() => {
      uiSyncQueued = false;
      syncActiveUi();
    });
  }

  function persistProfileShell(){
    window.saveState?.();
    renderAppShellProfile();
    renderProfilePage();
    renderSecurityPage();
    renderSettingsCenter();
  }

  function isValidEmail(value){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  }

  function saveProfileInfo(){
    const nameInput = document.getElementById('pf-name');
    const emailInput = document.getElementById('pf-email');
    if(!nameInput || !emailInput) return;
    const name = nameInput.value.trim();
    const manualEmail = emailInput.value.trim();
    if(!name){
      window.showToast?.('Ingresá un nombre válido', 'error');
      return;
    }
    if(manualEmail && !isValidEmail(manualEmail)){
      window.showToast?.('Ingresá un email válido', 'error');
      return;
    }
    window.state.userName = name;
    window.state.manualUserEmail = manualEmail;
    window.state.userEmail = manualEmail;
    persistProfileShell();
    window.showToast?.('Perfil actualizado', 'success');
  }

  function applyThemePreference(theme){
    const isLight = document.body.classList.contains('light-mode');
    if(theme === 'light' && !isLight) window.toggleTheme?.();
    if(theme === 'dark' && isLight) window.toggleTheme?.();
  }

  function saveAppPreferences(){
    const currency = document.getElementById('settings-currency')?.value || window.state?.userPrefs?.currency || 'ARS';
    const language = document.getElementById('settings-language')?.value || window.state?.userPrefs?.language || 'es';
    const theme = document.getElementById('settings-theme')?.value || window.state?.userPrefs?.theme || 'dark';
    window.state.userPrefs = { currency, language, theme };
    applyThemePreference(theme);
    window.saveState?.();
    renderProfilePage();
    renderSettingsCenter();
    window.showToast?.('Preferencias guardadas', 'success');
  }

  function saveProfilePreferences(){
    const currency = document.getElementById('pf-currency')?.value || window.state?.userPrefs?.currency || 'ARS';
    const language = document.getElementById('pf-lang')?.value || window.state?.userPrefs?.language || 'es';
    const theme = document.getElementById('pf-theme')?.value || window.state?.userPrefs?.theme || 'dark';
    window.state.userPrefs = { currency, language, theme };
    document.getElementById('settings-currency') && (document.getElementById('settings-currency').value = currency);
    document.getElementById('settings-language') && (document.getElementById('settings-language').value = language);
    document.getElementById('settings-theme') && (document.getElementById('settings-theme').value = theme);
    applyThemePreference(theme);
    window.saveState?.();
    renderProfilePage();
    renderSettingsCenter();
    window.showToast?.('Preferencias guardadas', 'success');
  }

  function activateAvatarSource(source){
    if(source === 'upload' && !window.state?.userAvatar){
      document.getElementById('profile-avatar-input')?.click();
      return;
    }
    if(source === 'preset' && !window.state?.userAvatarPreset){
      window.state.userAvatarPreset = AVATAR_PRESETS[0].id;
    }
    window.state.userAvatarMode = source;
    persistProfileShell();
  }

  function selectPresetAvatar(id){
    window.state.userAvatarPreset = id;
    window.state.userAvatarMode = 'preset';
    persistProfileShell();
    window.showToast?.('Avatar actualizado', 'success');
  }

  function handleAvatarUpload(event){
    const file = event?.target?.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      window.state.userAvatar = String(e.target?.result || '');
      window.state.userAvatarMode = 'upload';
      persistProfileShell();
      window.showToast?.('Imagen de perfil actualizada', 'success');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  function removeAvatar(){
    window.state.userAvatar = '';
    if(window.state.userAvatarMode === 'upload'){
      window.state.userAvatarMode = window.state.userAvatarPreset ? 'preset' : 'generated';
    }
    persistProfileShell();
  }

  function toggleProfileDropdown(){
    const dd = document.getElementById('profile-dropdown');
    if(!dd) return;
    const open = dd.style.display === 'block';
    closeCreateMenu();
    window.closeNotifPanel?.();
    if(open){
      closeProfileDropdown();
      return;
    }
    renderAppShellProfile();
    dd.style.display = 'block';
    dd.offsetHeight;
    dd.classList.add('active');
    document.addEventListener('click', handleDropdownDismiss);
    document.addEventListener('keydown', handleDropdownDismiss);
  }

  function closeProfileDropdown(){
    const dd = document.getElementById('profile-dropdown');
    if(!dd) return;
    dd.classList.remove('active');
    setTimeout(()=>{ dd.style.display = 'none'; }, 180);
    document.removeEventListener('click', handleDropdownDismiss);
    document.removeEventListener('keydown', handleDropdownDismiss);
  }

  function handleDropdownDismiss(event){
    const wrap = document.getElementById('app-avatar-wrap');
    if(event.type === 'keydown' && event.key === 'Escape'){
      closeProfileDropdown();
      return;
    }
    if(wrap && !wrap.contains(event.target)) closeProfileDropdown();
  }

  function toggleCreateMenu(){
    const menu = document.getElementById('app-create-menu');
    if(!menu) return;
    const open = menu.style.display === 'block';
    closeProfileDropdown();
    window.closeNotifPanel?.();
    if(open){
      closeCreateMenu();
      return;
    }
    menu.style.display = 'block';
    document.addEventListener('click', handleCreateMenuDismiss);
    document.addEventListener('keydown', handleCreateMenuDismiss);
  }

  function closeCreateMenu(){
    const menu = document.getElementById('app-create-menu');
    if(!menu) return;
    menu.style.display = 'none';
    document.removeEventListener('click', handleCreateMenuDismiss);
    document.removeEventListener('keydown', handleCreateMenuDismiss);
  }

  function handleCreateMenuDismiss(event){
    const menu = document.getElementById('app-create-menu');
    const trigger = document.getElementById('app-btn-add');
    if(!menu || menu.style.display !== 'block') return;
    if(event.type === 'keydown' && event.key === 'Escape'){
      closeCreateMenu();
      return;
    }
    if(trigger?.contains(event.target) || menu.contains(event.target)) return;
    closeCreateMenu();
  }

  function openQuickExpenseFlow(){
    closeCreateMenu();
    if(typeof window.openUniversalImport === 'function'){
      window.openUniversalImport('manual');
      return;
    }
    window.nav?.('import');
  }

  function exportSelectedData(){
    const format = document.getElementById('security-export-format')?.value || 'csv';
    if(format === 'json'){
      window.exportBackupJSON?.();
      window.registrarBackupEnHistorial?.('manual');
      return;
    }
    window.exportarCSV?.();
  }

  function toggleSettingsSetupGuide(){
    const open = localStorage.getItem(SETTINGS_GUIDE_KEY) !== '0';
    localStorage.setItem(SETTINGS_GUIDE_KEY, open ? '0' : '1');
    renderSetupGuide();
  }

  function deleteBankProfileById(id){
    if(!id) return;
    if(!window.confirm('¿Eliminar esta cuenta o perfil financiero?')) return;
    window.state.bankProfiles = (window.state.bankProfiles || []).filter(profile => profile.id !== id);
    if(typeof window.syncActiveUserProfileFromState === 'function') window.syncActiveUserProfileFromState(false);
    window.saveState?.();
    renderSettingsCenter();
    window.renderSettingsPage?.();
    window.showToast?.('Cuenta eliminada', 'info');
  }

  function deleteGmailRuleById(id){
    if(!id) return;
    if(!window.confirm('¿Eliminar esta regla Gmail?')) return;
    window.state.gmailImportRules = (window.state.gmailImportRules || []).filter(rule => rule.id !== id);
    if(typeof window.syncActiveUserProfileFromState === 'function') window.syncActiveUserProfileFromState(false);
    window.saveState?.();
    renderSettingsCenter();
    window.showToast?.('Regla eliminada', 'info');
  }

  const originalNav = window.nav;
  if(originalNav){
    window.nav = function(pageId){
      closeProfileDropdown();
      closeCreateMenu();
      originalNav(pageId);
      renderAppShellProfile();
      if(pageId === 'profile') renderProfilePage();
      if(pageId === 'security') renderSecurityPage();
      if(pageId === 'settings'){
        const prefs = window.state?.userPrefs || {};
        document.getElementById('settings-currency') && (document.getElementById('settings-currency').value = prefs.currency || 'ARS');
        document.getElementById('settings-language') && (document.getElementById('settings-language').value = prefs.language || 'es');
        document.getElementById('settings-theme') && (document.getElementById('settings-theme').value = prefs.theme || (document.body.classList.contains('light-mode') ? 'light' : 'dark'));
        renderSettingsCenter();
      }
    };
  }

  const originalSaveState = window.saveState;
  if(typeof originalSaveState === 'function'){
    window.saveState = function(...args){
      const result = originalSaveState.apply(this, args);
      queueUiSync();
      return result;
    };
  }

  const originalLoadState = window.loadState;
  if(typeof originalLoadState === 'function'){
    window.loadState = function(...args){
      const result = originalLoadState.apply(this, args);
      queueUiSync();
      return result;
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    if(!window.state.userAvatarMode) window.state.userAvatarMode = window.state.userAvatar ? 'upload' : (window.state.userAvatarPreset ? 'preset' : 'generated');
    if(!window.state.manualUserEmail && !window.state.googleProfile?.email && window.state.userEmail){
      window.state.manualUserEmail = window.state.userEmail;
    }
    renderAppShellProfile();
    renderProfilePage();
    renderSecurityPage();
    const prefs = window.state?.userPrefs || {};
    document.getElementById('settings-currency') && (document.getElementById('settings-currency').value = prefs.currency || 'ARS');
    document.getElementById('settings-language') && (document.getElementById('settings-language').value = prefs.language || 'es');
    document.getElementById('settings-theme') && (document.getElementById('settings-theme').value = prefs.theme || (document.body.classList.contains('light-mode') ? 'light' : 'dark'));
    renderSettingsCenter();
  });

  window.renderAppShellProfile = renderAppShellProfile;
  window.renderProfilePage = renderProfilePage;
  window.renderSecurityPage = renderSecurityPage;
  window.renderSettingsCenter = renderSettingsCenter;
  window.saveProfileInfo = saveProfileInfo;
  window.saveAppPreferences = saveAppPreferences;
  window.saveProfilePreferences = saveProfilePreferences;
  window.handleAvatarUpload = handleAvatarUpload;
  window.removeAvatar = removeAvatar;
  window.activateAvatarSource = activateAvatarSource;
  window.selectPresetAvatar = selectPresetAvatar;
  window.toggleProfileDropdown = toggleProfileDropdown;
  window.closeProfileDropdown = closeProfileDropdown;
  window.updateAppHeader = function(){};
  window.toggleCreateMenu = toggleCreateMenu;
  window.closeCreateMenu = closeCreateMenu;
  window.openQuickExpenseFlow = openQuickExpenseFlow;
  window.exportSelectedData = exportSelectedData;
  window.toggleSettingsSetupGuide = toggleSettingsSetupGuide;
  window.deleteBankProfileById = deleteBankProfileById;
  window.deleteGmailRuleById = deleteGmailRuleById;
})();
