// ══ GLOBAL APP SHELL LOGIC ══
// Shared source of truth for header avatar, profile, and security pages.

(function(){
  let profileListenerBound = false;

  function getUserName() {
    return (window.getResolvedUserName?.() || window.state?.userName || 'Pedro').trim() || 'Pedro';
  }

  function getUserEmail() {
    return (window.getResolvedUserEmail?.() || '').trim();
  }

  function getAvatarLetter() {
    return getUserName().charAt(0).toUpperCase();
  }

  function getAvatarImage() {
    return window.state?.userAvatar || '';
  }

  function applyAvatarSurface(container, letterId, sizeClass) {
    const surface = typeof container === 'string' ? document.getElementById(container) : container;
    if (!surface) return;
    const letterEl = letterId ? document.getElementById(letterId) : surface.querySelector('span');
    const avatar = getAvatarImage();
    if (avatar) {
      surface.style.backgroundImage = `linear-gradient(135deg, rgba(11,15,23,0.08), rgba(11,15,23,0.08)), url("${avatar}")`;
      surface.classList.add('has-image');
      if (letterEl) letterEl.style.opacity = '0';
    } else {
      surface.style.backgroundImage = '';
      surface.classList.remove('has-image');
      if (letterEl) {
        letterEl.textContent = getAvatarLetter();
        letterEl.style.opacity = '1';
      }
    }
    if (sizeClass) surface.setAttribute('data-avatar-size', sizeClass);
  }

  function renderAppShellProfile() {
    const name = getUserName();
    const email = getUserEmail() || 'Sin email conectado';
    const isConnected = typeof window.isGoogleConnected === 'function' ? window.isGoogleConnected() : false;

    const ddName = document.getElementById('dd-user-name');
    const ddEmail = document.getElementById('dd-user-email');
    if (ddName) ddName.textContent = name;
    if (ddEmail) ddEmail.textContent = email;

    applyAvatarSurface('app-avatar-btn', 'app-avatar-letter', 'sm');
    applyAvatarSurface(document.querySelector('.profile-dd-avatar'), 'dd-avatar-letter', 'md');

    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const pfName = document.getElementById('pf-name');
    const pfEmail = document.getElementById('pf-email');
    const connectionText = document.getElementById('profile-connection-text');
    const connectionMeta = document.getElementById('profile-connection-meta');

    if (profileName) profileName.textContent = name;
    if (profileEmail) profileEmail.textContent = email || 'Email pendiente';
    if (pfName && document.activeElement !== pfName) pfName.value = name;
    if (pfEmail) pfEmail.value = email;
    if (connectionText) connectionText.textContent = isConnected ? 'Google conectado' : 'Cuenta local';
    if (connectionMeta) {
      connectionMeta.textContent = window.state?.lastGmailSync
        ? `Última sincronización: ${new Date(window.state.lastGmailSync).toLocaleString('es-AR', { dateStyle:'medium', timeStyle:'short' })}`
        : 'Sin sincronización reciente';
    }

    if (document.getElementById('profile-avatar')) {
      applyAvatarSurface('profile-avatar', 'profile-avatar-big', 'lg');
    }
  }

  function renderProfilePage() {
    renderAppShellProfile();
    const prefs = window.state?.userPrefs || { currency:'ARS', language:'es', theme:'dark' };
    const googleEmail = window.state?.googleProfile?.email || getUserEmail() || '—';
    const connected = typeof window.isGoogleConnected === 'function' ? window.isGoogleConnected() : false;

    const currency = document.getElementById('pf-currency');
    const lang = document.getElementById('pf-lang');
    const theme = document.getElementById('pf-theme');
    if (currency) currency.value = prefs.currency || 'ARS';
    if (lang) lang.value = prefs.language || 'es';
    if (theme) theme.value = prefs.theme || (document.body.classList.contains('light-mode') ? 'light' : 'dark');

    const connStatus = document.getElementById('pf-google-conn-status');
    const syncStatus = document.getElementById('pf-google-sync-status');
    const emailStatus = document.getElementById('pf-google-email-status');
    if (connStatus) connStatus.textContent = connected ? 'Conectado' : 'No conectado';
    if (syncStatus) {
      syncStatus.textContent = window.state?.lastGmailSync
        ? new Date(window.state.lastGmailSync).toLocaleString('es-AR', { dateStyle:'medium', timeStyle:'short' })
        : '—';
    }
    if (emailStatus) emailStatus.textContent = googleEmail;
  }

  function renderSecurityPage() {
    const connected = typeof window.isGoogleConnected === 'function' ? window.isGoogleConnected() : false;
    const email = window.state?.googleProfile?.email || getUserEmail() || '—';
    const statusEl = document.getElementById('security-google-status');
    const emailEl = document.getElementById('security-google-email');
    if (statusEl) statusEl.textContent = connected ? 'Conectado' : 'No conectado';
    if (emailEl) emailEl.textContent = email;
    if (typeof window.updateLastBackupLabel === 'function') window.updateLastBackupLabel();
  }

  function saveProfileInfo() {
    const input = document.getElementById('pf-name');
    if (!input) return;
    const newName = input.value.trim();
    if (!newName) {
      if (typeof window.showToast === 'function') window.showToast('Ingresá un nombre válido', 'error');
      return;
    }
    window.state.userName = newName;
    if (!window.state.userEmail && window.getResolvedUserEmail) window.state.userEmail = window.getResolvedUserEmail();
    if (typeof window.saveState === 'function') window.saveState();
    renderProfilePage();
    renderSecurityPage();
    if (typeof window.showToast === 'function') window.showToast('Perfil actualizado', 'success');
  }

  function saveProfilePreferences() {
    const currency = document.getElementById('pf-currency')?.value || 'ARS';
    const language = document.getElementById('pf-lang')?.value || 'es';
    const theme = document.getElementById('pf-theme')?.value || 'dark';
    window.state.userPrefs = { currency, language, theme };
    const isLight = document.body.classList.contains('light-mode');
    if (theme === 'light' && !isLight) window.toggleTheme?.();
    if (theme === 'dark' && isLight) window.toggleTheme?.();
    if (typeof window.saveState === 'function') window.saveState();
    renderProfilePage();
    if (typeof window.showToast === 'function') window.showToast('Preferencias guardadas', 'success');
  }

  function handleAvatarUpload(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      window.state.userAvatar = String(e.target?.result || '');
      if (typeof window.saveState === 'function') window.saveState();
      renderProfilePage();
      renderSecurityPage();
      if (typeof window.showToast === 'function') window.showToast('Avatar actualizado', 'success');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  function removeAvatar() {
    window.state.userAvatar = '';
    if (typeof window.saveState === 'function') window.saveState();
    renderProfilePage();
    renderSecurityPage();
    if (typeof window.showToast === 'function') window.showToast('Avatar removido', 'info');
  }

  function saveSecurityPassword() {
    const current = document.getElementById('security-current-password')?.value || '';
    const next = document.getElementById('security-new-password')?.value || '';
    const confirm = document.getElementById('security-confirm-password')?.value || '';
    if (!current || !next || !confirm) {
      window.showToast?.('Completá los tres campos', 'error');
      return;
    }
    if (next.length < 6) {
      window.showToast?.('La nueva contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }
    if (next !== confirm) {
      window.showToast?.('Las contraseñas no coinciden', 'error');
      return;
    }
    localStorage.setItem('fin_password_updated_at', new Date().toISOString());
    ['security-current-password','security-new-password','security-confirm-password'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    window.showToast?.('Contraseña actualizada', 'success');
  }

  function updateAppHeader() {}

  function toggleProfileDropdown() {
    const dd = document.getElementById('profile-dropdown');
    if (!dd) return;
    const isOpen = dd.style.display === 'block';
    window.closeImportHistoryMenu?.();
    window.closeNotifPanel?.();
    renderAppShellProfile();
    if (isOpen) {
      closeProfileDropdown();
      return;
    }
    dd.style.display = 'block';
    dd.offsetHeight;
    dd.classList.add('active');
    bindProfileListeners();
  }

  function closeProfileDropdown() {
    const dd = document.getElementById('profile-dropdown');
    if (!dd) return;
    dd.classList.remove('active');
    window.setTimeout(() => { dd.style.display = 'none'; }, 180);
  }

  function handleProfileDismiss(e) {
    const wrap = document.getElementById('app-avatar-wrap');
    if (e.type === 'keydown' && e.key === 'Escape') {
      closeProfileDropdown();
      return;
    }
    if (wrap && !wrap.contains(e.target)) closeProfileDropdown();
  }

  function bindProfileListeners() {
    if (profileListenerBound) return;
    document.addEventListener('click', handleProfileDismiss);
    document.addEventListener('keydown', handleProfileDismiss);
    profileListenerBound = true;
  }

  const originalNav = window.nav;
  if (originalNav) {
    window.nav = function(pageId) {
      closeProfileDropdown();
      originalNav(pageId);
      renderAppShellProfile();
      if (pageId === 'profile') renderProfilePage();
      if (pageId === 'security') renderSecurityPage();
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderProfilePage();
    renderSecurityPage();
    renderAppShellProfile();
  });

  window.toggleProfileDropdown = toggleProfileDropdown;
  window.closeProfileDropdown = closeProfileDropdown;
  window.updateAppHeader = updateAppHeader;
  window.saveProfileInfo = saveProfileInfo;
  window.saveProfilePreferences = saveProfilePreferences;
  window.handleAvatarUpload = handleAvatarUpload;
  window.removeAvatar = removeAvatar;
  window.renderProfilePage = renderProfilePage;
  window.renderSecurityPage = renderSecurityPage;
  window.renderAppShellProfile = renderAppShellProfile;
  window.saveSecurityPassword = saveSecurityPassword;
})();
