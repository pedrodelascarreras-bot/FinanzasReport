// ══ GLOBAL APP SHELL LOGIC ══
// Handles the persistent app header and profile dropdown navigation.

(function(){

  function toggleProfileDropdown() {
    const dd = document.getElementById('profile-dropdown');
    if (!dd) return;

    if (dd.style.display === 'none' || dd.style.display === '') {
      // Refresh profile data before showing
      const userName = window.state?.userName || 'Pedro';
      const userLtr = userName.charAt(0).toUpperCase();

      const ltrEls = [document.getElementById('app-avatar-letter'), document.getElementById('dd-avatar-letter')];
      ltrEls.forEach(el => { if(el) el.textContent = userLtr; });

      const nameEl = document.getElementById('dd-user-name');
      if (nameEl) nameEl.textContent = userName;

      dd.style.display = 'block';
      // Trigger reflow for animation
      dd.offsetHeight;
      dd.classList.add('active');

      // Setup outside click listener
      document.addEventListener('click', handleOutsideClick);
      document.addEventListener('keydown', handleEscapeKey);
    } else {
      closeProfileDropdown();
    }
  }

  function closeProfileDropdown() {
    const dd = document.getElementById('profile-dropdown');
    if (!dd) return;

    dd.classList.remove('active');
    setTimeout(() => {
      dd.style.display = 'none';
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleEscapeKey);
    }, 200); // match transition duration
  }

  function handleOutsideClick(e) {
    const wrap = document.getElementById('app-avatar-wrap');
    if (wrap && !wrap.contains(e.target)) {
      closeProfileDropdown();
    }
  }

  function handleEscapeKey(e) {
    if (e.key === 'Escape') {
      closeProfileDropdown();
    }
  }

  function updateAppHeader(pageId) {
    const secEl = document.getElementById('app-header-section');
    if (!secEl) return;

    const sections = {
      'dashboard': 'Dashboard',
      'transactions': 'Movimientos',
      'insights': 'Insights',
      'expenses': 'Gastos',
      'income': 'Ingresos',
      'savings': 'Ahorros',
      'categories': 'Categorías',
      'reports': 'Reportes',
      'balance': 'Saldo',
      'credit-cards': 'Tarjetas',
      'profile': 'Mi perfil',
      'settings': 'Configuración'
    };

    let title = sections[pageId] || '';
    secEl.textContent = title;
  }

  function saveProfileInfo() {
    const nameInput = document.getElementById('pf-name');
    if(nameInput && nameInput.value.trim() !== '') {
      const newName = nameInput.value.trim();
      if(window.state) {
        window.state.userName = newName;
        if(typeof window.saveState === 'function') window.saveState();
      }
      
      // Update local DOM elements instantly
      const ltr = newName.charAt(0).toUpperCase();
      ['app-avatar-letter', 'dd-avatar-letter', 'profile-avatar-big'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.textContent = ltr;
      });
      ['dd-user-name', 'profile-name'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.textContent = newName;
      });

      // Show toast if available
      if(typeof window.showToast === 'function') window.showToast('Perfil actualizado');
    }
  }

  // Intercept normal navigation to update header
  const originalNav = window.nav;
  if (originalNav) {
    window.nav = function(pageId) {
      originalNav(pageId);
      updateAppHeader(pageId);
    };
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    // Initial header update based on active page
    const activePg = document.querySelector('.page.active');
    if(activePg) {
      const pId = activePg.id.replace('page-','');
      updateAppHeader(pId);
    }
  });

  // Expose Globals
  window.toggleProfileDropdown = toggleProfileDropdown;
  window.closeProfileDropdown = closeProfileDropdown;
  window.updateAppHeader = updateAppHeader;
  window.saveProfileInfo = saveProfileInfo;

})();
