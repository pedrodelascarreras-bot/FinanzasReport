// Private welcome splash focused on secure Google sign-in.

(function(){
  function requiresGoogleGate(){
    return typeof isGoogleConnected === 'function' ? !isGoogleConnected() : true;
  }

  function getUserName(){
    const raw = window.getResolvedUserName?.() || window.state?.userName || 'Pedro';
    return String(raw || 'Pedro').trim() || 'Pedro';
  }

  function getAvatarLetter(){
    return getUserName().charAt(0).toUpperCase() || 'P';
  }

  function esc(value){
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function googleLogoSVG(size){
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>`;
  }

  function iconSVG(name){
    const icons = {
      search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
      bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
      plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
      shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-3.6 7-9.2V6.3L12 3 5 6.3v5.5C5 17.4 12 21 12 21Z"/><path d="M9.7 11.8 11.4 13.5 14.8 10.2"/></svg>',
      sync: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.9-4"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.9 4"/><path d="M20 20v-4h-4"/></svg>',
      spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.6 4.7L18 9.3l-4.4 1.5L12 15.5l-1.6-4.7L6 9.3l4.4-1.6L12 3Z"/><path d="m19 15 .7 2.1L22 18l-2.3.8L19 21l-.7-2.2L16 18l2.3-.9L19 15Z"/></svg>',
      lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></svg>',
      timer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2h4"/><path d="M12 13V8"/><circle cx="12" cy="14" r="8"/></svg>',
      key: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8.5" cy="15.5" r="3.5"/><path d="M12 15.5h8"/><path d="M17 12.5v6"/><path d="M20 13.5v4"/></svg>',
      unlink: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1 0l2.4-2.4a5 5 0 0 0-7.1-7.1L10.5 5"/><path d="M14 11a5 5 0 0 0-7.1 0l-2.4 2.4a5 5 0 1 0 7.1 7.1L13.5 19"/></svg>',
      wallet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v2H5.5A2.5 2.5 0 0 1 3 6.5v1Z"/><path d="M3 9h17a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><circle cx="16.5" cy="14" r="1"/></svg>',
      pie: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v9h9"/><path d="M21 12a9 9 0 1 1-9-9"/></svg>',
      bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 6 13h5l-1 9 8-12h-5l0-8Z"/></svg>',
      arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
      user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>'
    };
    return icons[name] || icons.shield;
  }

  function renderFeature(icon, title, text){
    return `
      <div class="spw-feature">
        <div class="spw-feature-icon">${iconSVG(icon)}</div>
        <div class="spw-feature-copy">
          <strong>${title}</strong>
          <span>${text}</span>
        </div>
      </div>
    `;
  }

  function renderBenefit(icon, tag, title, text, tone){
    return `
      <article class="spw-benefit-card ${tone}">
        <div class="spw-benefit-icon">${iconSVG(icon)}</div>
        <span class="spw-benefit-tag">${tag}</span>
        <h3>${title}</h3>
        <p>${text}</p>
      </article>
    `;
  }

  function buildContent(){
    const connected = !requiresGoogleGate();
    const ctaLabel = connected ? 'Continuar' : 'Iniciar sesión con Google';
    const reassurance = connected
      ? 'Conexión segura activa. Ya podés continuar con tu cuenta protegida.'
      : 'Conexión segura. Estándares de seguridad de Google.';

    const content = document.getElementById('sp-content');
    if(!content) return;

    content.innerHTML = `
      <div class="sp-private-shell">
        <div class="spw-topbar">
          <div class="spw-brand">
            <span class="spw-brand-dot"></span>
            <span class="spw-brand-name">FINANZAS</span>
          </div>
          <div class="spw-top-actions">
            <button class="spw-icon-btn" type="button" title="Buscar" onclick="handleSplashTopAction('search', event)">${iconSVG('search')}</button>
            <button class="spw-icon-btn" type="button" title="Notificaciones" onclick="handleSplashTopAction('notif', event)">${iconSVG('bell')}</button>
            <button class="spw-icon-btn" type="button" title="Crear" onclick="handleSplashTopAction('add', event)">${iconSVG('plus')}</button>
            <button class="spw-avatar-btn" type="button" title="${esc(getUserName())}" onclick="handleSplashTopAction('profile', event)">${esc(getAvatarLetter())}</button>
          </div>
        </div>

        <section class="spw-hero">
          <div class="spw-hero-copy">
            <div class="spw-kicker">
              <span class="spw-kicker-icon">${iconSVG('lock')}</span>
              <span>ACCESO PRIVADO</span>
            </div>
            <h1 class="spw-title">
              <span>Tu información</span>
              <span>merece <em>seguridad.</em></span>
            </h1>
            <p class="spw-subtitle">Conectá tu cuenta de Google y empezá a tener el control total de tus finanzas.</p>
            <div class="spw-feature-row">
              ${renderFeature('shield', 'Privado y seguro', 'Solo vos podés ver tu información.')}
              ${renderFeature('sync', 'Actualización automática', 'Tus datos siempre al día, sin esfuerzo.')}
              ${renderFeature('spark', 'Decisiones inteligentes', 'Detectá patrones y optimizá tu dinero.')}
            </div>
          </div>

          <div class="spw-hero-visual" aria-hidden="true">
            <div class="spw-visual-glow spw-visual-glow-a"></div>
            <div class="spw-visual-glow spw-visual-glow-b"></div>
            <div class="spw-orbit spw-orbit-a"></div>
            <div class="spw-orbit spw-orbit-b"></div>
            <div class="spw-visual-stack">
              <div class="spw-main-glass-card">
                <div class="spw-main-glass-inner">${googleLogoSVG(92)}</div>
              </div>
              <div class="spw-side-card spw-side-card-lock">
                <div class="spw-side-card-icon">${iconSVG('lock')}</div>
              </div>
              <div class="spw-side-card spw-side-card-user">
                <div class="spw-side-card-icon">${iconSVG('user')}</div>
              </div>
            </div>
          </div>
        </section>

        <section class="spw-login-card">
          <div class="spw-login-copy">
            <span class="spw-section-kicker">INICIAR SESIÓN</span>
            <h2>Accedé a tu cuenta</h2>
            <p>Usamos Google para que puedas iniciar sesión de forma rápida y segura. No compartimos tus datos con terceros y solo accedemos a lo que necesitás.</p>
            <button class="spw-google-cta" id="splash-primary-cta" type="button" onclick="handleSplashPrimaryAction(event)">
              <span class="spw-google-cta-bg"></span>
              <span class="spw-google-cta-icon">${googleLogoSVG(20)}</span>
              <span class="spw-google-cta-text">${ctaLabel}</span>
              <span class="spw-google-cta-arrow">${iconSVG('arrow')}</span>
            </button>
            <div class="spw-security-note" id="sp-google-gate-inline">
              <span class="spw-security-note-icon">${iconSVG('lock')}</span>
              <span>${reassurance}</span>
            </div>
          </div>

          <aside class="spw-login-side">
            <div class="spw-login-side-panel">
              <div class="spw-login-side-item">
                <span class="spw-login-side-icon">${iconSVG('timer')}</span>
                <span>Tarda menos de 30 segundos</span>
              </div>
              <div class="spw-login-side-item">
                <span class="spw-login-side-icon">${iconSVG('key')}</span>
                <span>Sin contraseñas para recordar</span>
              </div>
              <div class="spw-login-side-item">
                <span class="spw-login-side-icon">${iconSVG('unlink')}</span>
                <span>Podés desconectar cuando quieras</span>
              </div>
            </div>
          </aside>
        </section>

        <section class="spw-benefits">
          <span class="spw-benefits-kicker">¿QUÉ PODÉS HACER UNA VEZ CONECTADO?</span>
          <div class="spw-benefits-grid">
            ${renderBenefit('wallet', 'CONTROL TOTAL', 'Vas a ver todo claro', 'Tus gastos, ingresos y proyecciones en un solo lugar.', 'tone-violet')}
            ${renderBenefit('pie', 'MEJORES DECISIONES', 'Entendés y decidís mejor', 'Detectás patrones y optimizás tu dinero.', 'tone-blue')}
            ${renderBenefit('bolt', 'TODO SINCRONIZADO', 'Se actualiza solo', 'Tus datos se sincronizan automáticamente.', 'tone-cyan')}
          </div>
        </section>

        <section class="spw-trust-bar">
          <div class="spw-trust-copy">
            <div class="spw-trust-icon">${iconSVG('shield')}</div>
            <p>Tu información está protegida. Nunca compartimos tus datos con terceros y solo accedemos a lo que necesitás para que todo funcione.</p>
          </div>
          <button class="spw-trust-link" type="button" onclick="handleSplashTopAction('security', event)">
            <span>Saber más</span>
            <span class="spw-trust-link-arrow">${iconSVG('arrow')}</span>
          </button>
        </section>
      </div>
    `;
  }

  function initSplash(){
    const splash = document.getElementById('splash');
    if(!splash) return;

    buildContent();

    splash.style.display = 'flex';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => splash.classList.add('visible'));
    });

    refreshSplashGoogleState(false);

    const onKeyDown = (event) => {
      if(['Enter', 'Escape', ' '].includes(event.key) && !requiresGoogleGate()){
        dismissSplash();
        document.removeEventListener('keydown', onKeyDown);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    splash._kd = onKeyDown;
  }

  function dismissSplash(){
    const splash = document.getElementById('splash');
    if(!splash || !splash.classList.contains('visible')) return;
    if(requiresGoogleGate()) return;

    if(splash._kd) document.removeEventListener('keydown', splash._kd);

    splash.classList.add('leaving', 'cinematic-exit');
    setTimeout(() => {
      splash.style.display = 'none';
      splash.classList.remove('visible', 'leaving', 'cinematic-exit');
    }, 420);
  }

  function refreshSplashGoogleState(autoDismiss){
    const connected = !requiresGoogleGate();
    const cta = document.getElementById('splash-primary-cta');
    const gate = document.getElementById('sp-google-gate-inline');

    if(cta){
      const textEl = cta.querySelector('.spw-google-cta-text');
      if(textEl) textEl.textContent = connected ? 'Continuar' : 'Iniciar sesión con Google';
    }

    if(gate){
      gate.classList.toggle('is-connected', connected);
      const label = connected
        ? 'Conexión segura activa. Ya podés continuar con tu cuenta protegida.'
        : 'Conexión segura. Estándares de seguridad de Google.';
      const textNode = gate.querySelector('span:last-child');
      if(textNode) textNode.textContent = label;
    }

    if(connected && autoDismiss){
      setTimeout(() => dismissSplash(), 220);
    }
  }

  function handleSplashPrimaryAction(event){
    if(event){
      event.preventDefault();
      event.stopPropagation();
    }

    if(!requiresGoogleGate()){
      dismissSplash();
      return;
    }

    if(typeof openCloudSync === 'function'){
      openCloudSync(event);
    }
  }

  function handleSplashTopAction(action, event){
    if(event){
      event.preventDefault();
      event.stopPropagation();
    }

    if(requiresGoogleGate()){
      handleSplashPrimaryAction(event);
      return;
    }

    if(action === 'search' && typeof openGlobalSearch === 'function'){
      dismissSplash();
      openGlobalSearch();
      return;
    }

    if(action === 'notif' && typeof toggleNotifPanel === 'function'){
      dismissSplash();
      toggleNotifPanel();
      return;
    }

    if(action === 'add' && typeof toggleCreateMenu === 'function'){
      dismissSplash();
      toggleCreateMenu();
      return;
    }

    if(action === 'profile' && typeof toggleProfileDropdown === 'function'){
      dismissSplash();
      toggleProfileDropdown();
      return;
    }

    if(action === 'security' && typeof nav === 'function'){
      dismissSplash();
      nav('security');
    }
  }

  window.initSplash = initSplash;
  window.dismissSplash = dismissSplash;
  window.refreshSplashGoogleState = refreshSplashGoogleState;
  window.handleSplashPrimaryAction = handleSplashPrimaryAction;
  window.handleSplashTopAction = handleSplashTopAction;
})();
