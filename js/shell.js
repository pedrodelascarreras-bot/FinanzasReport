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

  function getUserName(){
    return (window.getResolvedUserName?.() || window.state?.userName || 'Pedro').trim() || 'Pedro';
  }

  function getUserEmail(){
    return (window.getResolvedUserEmail?.() || '').trim();
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
    const uploadBtn = document.getElementById('avatar-source-upload');
    const presetBtn = document.getElementById('avatar-source-preset');
    uploadBtn?.classList.toggle('active', (window.state?.userAvatarMode || 'upload') === 'upload');
    presetBtn?.classList.toggle('active', window.state?.userAvatarMode === 'preset');
  }

  function renderAppShellProfile(){
    const name = getUserName();
    const email = getUserEmail() || 'Sin email conectado';
    document.getElementById('dd-user-name')?.replaceChildren(document.createTextNode(name));
    document.getElementById('dd-user-email')?.replaceChildren(document.createTextNode(email));
    applyAvatarSurface('app-avatar-btn', 'app-avatar-letter');
    applyAvatarSurface(document.querySelector('.profile-dd-avatar'), 'dd-avatar-letter');
  }

  function renderProfilePage(){
    renderAppShellProfile();
    document.getElementById('profile-name')?.replaceChildren(document.createTextNode(getUserName()));
    document.getElementById('profile-email')?.replaceChildren(document.createTextNode(getUserEmail() || 'Email pendiente'));
    const pfName = document.getElementById('pf-name');
    const pfEmail = document.getElementById('pf-email');
    const prefs = window.state?.userPrefs || { currency:'ARS', language:'es', theme:(document.body.classList.contains('light-mode') ? 'light' : 'dark') };
    if(pfName && document.activeElement !== pfName) pfName.value = getUserName();
    if(pfEmail) pfEmail.value = getUserEmail();
    if(document.getElementById('pf-currency')) document.getElementById('pf-currency').value = prefs.currency || 'ARS';
    if(document.getElementById('pf-lang')) document.getElementById('pf-lang').value = prefs.language || 'es';
    if(document.getElementById('pf-theme')) document.getElementById('pf-theme').value = prefs.theme || 'dark';
    applyAvatarSurface('profile-avatar', 'profile-avatar-big');
    renderAvatarPresetGrid();
    const connected = window.isGoogleConnected?.() ? 'Google conectado' : 'Cuenta local';
    document.getElementById('profile-connection-text')?.replaceChildren(document.createTextNode(connected));
    document.getElementById('profile-connection-meta')?.replaceChildren(document.createTextNode(
      window.state?.userAvatarMode === 'preset'
        ? 'Usando avatar predefinido'
        : window.state?.userAvatar ? 'Usando imagen subida' : 'Usando avatar generado'
    ));
    document.getElementById('pf-google-conn-status')?.replaceChildren(document.createTextNode(window.isGoogleConnected?.() ? 'Conectado' : 'No conectado'));
    document.getElementById('pf-google-sync-status')?.replaceChildren(document.createTextNode(
      window.state?.lastGmailSync ? new Date(window.state.lastGmailSync).toLocaleString('es-AR', { dateStyle:'medium', timeStyle:'short' }) : '—'
    ));
    document.getElementById('pf-google-email-status')?.replaceChildren(document.createTextNode(window.state?.googleProfile?.email || getUserEmail() || '—'));
  }

  function renderSecurityPage(){
    const connected = !!window.isGoogleConnected?.();
    document.getElementById('security-google-status')?.replaceChildren(document.createTextNode(connected ? 'Conectado' : 'No conectado'));
    document.getElementById('security-google-email')?.replaceChildren(document.createTextNode(window.state?.googleProfile?.email || getUserEmail() || '—'));
    document.getElementById('security-sync-time')?.replaceChildren(document.createTextNode(
      window.state?.lastGmailSync ? new Date(window.state.lastGmailSync).toLocaleString('es-AR', { dateStyle:'medium', timeStyle:'short' }) : '—'
    ));
    window.updateLastBackupLabel?.();
    window.renderBackupHistory?.();
    const lastRestore = localStorage.getItem('fin_last_restore');
    document.getElementById('security-last-restore')?.replaceChildren(document.createTextNode(
      lastRestore ? new Date(lastRestore).toLocaleString('es-AR', { dateStyle:'medium', timeStyle:'short' }) : 'Nunca'
    ));
  }

  function persistProfileShell(){
    window.saveState?.();
    renderAppShellProfile();
    renderProfilePage();
    renderSecurityPage();
  }

  function saveProfileInfo(){
    const input = document.getElementById('pf-name');
    if(!input) return;
    const value = input.value.trim();
    if(!value){
      window.showToast?.('Ingresá un nombre válido', 'error');
      return;
    }
    window.state.userName = value;
    persistProfileShell();
    window.showToast?.('Perfil actualizado', 'success');
  }

  function saveAppPreferences(){
    const currency = document.getElementById('settings-currency')?.value || window.state?.userPrefs?.currency || 'ARS';
    const language = document.getElementById('settings-language')?.value || window.state?.userPrefs?.language || 'es';
    const theme = document.getElementById('settings-theme')?.value || window.state?.userPrefs?.theme || 'dark';
    window.state.userPrefs = { currency, language, theme };
    const isLight = document.body.classList.contains('light-mode');
    if(theme === 'light' && !isLight) window.toggleTheme?.();
    if(theme === 'dark' && isLight) window.toggleTheme?.();
    window.saveState?.();
    window.showToast?.('Preferencias guardadas', 'success');
  }

  function saveProfilePreferences(){
    const currency = document.getElementById('pf-currency')?.value || window.state?.userPrefs?.currency || 'ARS';
    const language = document.getElementById('pf-lang')?.value || window.state?.userPrefs?.language || 'es';
    const theme = document.getElementById('pf-theme')?.value || window.state?.userPrefs?.theme || 'dark';
    window.state.userPrefs = { currency, language, theme };
    if(document.getElementById('settings-currency')) document.getElementById('settings-currency').value = currency;
    if(document.getElementById('settings-language')) document.getElementById('settings-language').value = language;
    if(document.getElementById('settings-theme')) document.getElementById('settings-theme').value = theme;
    const isLight = document.body.classList.contains('light-mode');
    if(theme === 'light' && !isLight) window.toggleTheme?.();
    if(theme === 'dark' && isLight) window.toggleTheme?.();
    window.saveState?.();
    renderProfilePage();
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

  window.exportSelectedData = function(){
    const format = document.getElementById('security-export-format')?.value || 'csv';
    if(format === 'json'){
      window.exportBackupJSON?.();
      return;
    }
    window.exportarCSV?.();
  };

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
        document.getElementById('settings-currency') && (document.getElementById('settings-currency').value = window.state?.userPrefs?.currency || 'ARS');
        document.getElementById('settings-language') && (document.getElementById('settings-language').value = window.state?.userPrefs?.language || 'es');
        document.getElementById('settings-theme') && (document.getElementById('settings-theme').value = window.state?.userPrefs?.theme || (document.body.classList.contains('light-mode') ? 'light' : 'dark'));
      }
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    if(!window.state.userAvatarMode) window.state.userAvatarMode = window.state.userAvatar ? 'upload' : (window.state.userAvatarPreset ? 'preset' : 'generated');
    renderAppShellProfile();
    renderProfilePage();
    renderSecurityPage();
    if(document.getElementById('settings-currency')) document.getElementById('settings-currency').value = window.state?.userPrefs?.currency || 'ARS';
    if(document.getElementById('settings-language')) document.getElementById('settings-language').value = window.state?.userPrefs?.language || 'es';
    if(document.getElementById('settings-theme')) document.getElementById('settings-theme').value = window.state?.userPrefs?.theme || (document.body.classList.contains('light-mode') ? 'light' : 'dark');
  });

  window.renderAppShellProfile = renderAppShellProfile;
  window.renderProfilePage = renderProfilePage;
  window.renderSecurityPage = renderSecurityPage;
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
})();
