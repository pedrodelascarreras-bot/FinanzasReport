// ══ FINANCE OS — PREMIUM HOME PANEL ══
// Premium fintech welcome screen with hero, Google connect, and quick actions.
// Dismissed by button, Enter/Space/Escape, or when Google is already connected.

(function(){

  function _requiresGoogleGate(){
    return typeof isGoogleConnected === 'function' ? !isGoogleConnected() : true;
  }

  // ── Entry point ──────────────────────────────────────────
  function initSplash(){
    const el = document.getElementById('splash');
    if(!el) return;

    document.querySelectorAll('#sp-google-gate').forEach(node => node.remove());

    _buildContent();

    el.style.display = 'flex';
    requestAnimationFrame(()=> requestAnimationFrame(()=> el.classList.add('visible')));

    // Ensure the CTA button is clickable
    const cta = el.querySelector('.sp-cta');
    if(cta) {
      cta.onclick = (e) => {
        handleSplashPrimaryAction(e);
      };
    }

    refreshSplashGoogleState(false);

    _startCountdown(el);

    const _kd = e => {
      if(['Enter','Escape',' '].includes(e.key) && !_requiresGoogleGate()){
        dismissSplash();
        document.removeEventListener('keydown', _kd);
      }
    };
    document.addEventListener('keydown', _kd);
    el._kd = _kd;
  }

  // ── Dismiss (exported globally) ──────────────────────────
  function dismissSplash(){
    const el = document.getElementById('splash');
    if(!el || !el.classList.contains('visible')) return;
    if(_requiresGoogleGate()) return;


    if(el._interval) clearInterval(el._interval);
    if(el._kd)       document.removeEventListener('keydown', el._kd);

    el.classList.add('leaving','cinematic-exit');
    setTimeout(()=>{
      el.style.display = 'none';
      el.classList.remove('visible','leaving','cinematic-exit');
    }, 480);
  }

  // ── Countdown + progress bar ─────────────────────────────
  function _startCountdown(el){
    const fill = document.getElementById('splash-progress-fill');
    if(fill){
      fill.style.width = '100%';
      fill.style.transition = 'width 0.5s ease';
    }
    // Auto-dismiss removed per user request.
  }

  // ── Build dynamic content ────────────────────────────────
  function _buildContent(){
    const isMobile = window.innerWidth <= 768;
    const today    = new Date();
    const todayStr = today.toISOString().slice(0,10);

    const curMK  = today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0');
    const pmDate = new Date(today.getFullYear(), today.getMonth()-1, 1);
    const prevMK = pmDate.getFullYear()+'-'+String(pmDate.getMonth()+1).padStart(2,'0');

    // ── CC cycle spending ──
    const allCyc = typeof getTcCycles === 'function' ? getTcCycles() : [];
    let curTotal = 0;
    let prevTotal = 0;
    let hasCycles = false;
    let curTxns = [];
    let activeCycles = [];

    if (allCyc.length > 0) {
      allCyc.forEach((cyc, idx) => {
        const op = typeof getTcCycleOpen === 'function' ? getTcCycleOpen(allCyc, idx) : null;
        if (op && todayStr >= op && todayStr <= cyc.closeDate) {
          activeCycles.push({ cyc, idx });
        }
      });

      if (activeCycles.length > 0) {
        hasCycles = true;
        activeCycles.forEach(({ cyc, idx }) => {
          const txns = typeof getTcCycleTxns === 'function' ? getTcCycleTxns(cyc, allCyc) : [];
          const filtered = txns.filter(t => t.currency === 'ARS' && t.amount > 0);
          curTotal += filtered.reduce((s, t) => s + t.amount, 0);
          curTxns = curTxns.concat(filtered);

          const prevCyc = allCyc.slice().reverse().find(c => c.cardId === cyc.cardId && c.closeDate < cyc.closeDate);
          if (prevCyc) {
            const pTxns = typeof getTcCycleTxns === 'function' ? getTcCycleTxns(prevCyc, allCyc) : [];
            prevTotal += pTxns.filter(t => t.currency === 'ARS' && t.amount > 0).reduce((s, t) => s + t.amount, 0);
          }
        });
      }
    }

    if (!hasCycles) {
      const _mk = t => t.month || getMonthKey(t.date);
      curTxns = state.transactions.filter(t => _mk(t) === curMK && t.currency === 'ARS' && t.amount > 0 && !t.isPendingCuota);
      const prevTxns = state.transactions.filter(t => _mk(t) === prevMK && t.currency === 'ARS' && t.amount > 0 && !t.isPendingCuota);
      curTotal = curTxns.reduce((s, t) => s + t.amount, 0);
      prevTotal = prevTxns.reduce((s, t) => s + t.amount, 0);
    }

    // ── CC cycle alerts ──
    const ccAlerts = [];
    allCyc.forEach((cyc, i)=>{
      const op = typeof getTcCycleOpen === 'function' ? getTcCycleOpen(allCyc, i) : null;
      if(!op) return;
      if(todayStr >= op && todayStr <= cyc.closeDate){
        const card  = (state.ccCards||[]).find(c=>c.id===cyc.cardId);
        const close = new Date(cyc.closeDate+'T12:00:00');
        const days  = Math.round((close - today) / 86400000);
        ccAlerts.push({ name: card?.name || cyc.label || 'Tarjeta', days });
      }
    });
    ccAlerts.sort((a,b)=> a.days - b.days);

    // ── Strings ──
    const DAYS   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
                    'septiembre','octubre','noviembre','diciembre'];
    const h = today.getHours();
    const greeting = h<12 ? 'Buenos días' : h<20 ? 'Buenas tardes' : 'Buenas noches';
    const dateStr  = DAYS[today.getDay()]+' '+today.getDate()+' de '+MONTHS[today.getMonth()]+', '+today.getFullYear();

    const nextCloseAlert = ccAlerts[0] || null;
    const closePillText = nextCloseAlert
      ? (nextCloseAlert.days<=0
        ? 'Tu tarjeta cierra hoy'
        : nextCloseAlert.days===1
          ? 'Tarjeta cierra en 1 día'
          : `Tarjeta cierra en ${nextCloseAlert.days} días`)
      : null;

    // Capture and update last visit
    const lastVisitVal = state.lastVisit;
    state.lastVisit = new Date().toISOString();
    saveState();

    const connectedNow = typeof isGoogleConnected === 'function' && isGoogleConnected();
    const userName = state.userName || 'Pedro';

    // ── Google logo SVG ──
    const googleLogoSVG = `<svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>`;

    // ── Inject ──
    const content = document.getElementById('sp-content');
    if(!content) return;

    if(isMobile){
      content.innerHTML = `
      <div class="fos-shell fos-mobile fade-in">
        <div class="fos-container">
          <!-- Hero -->
          <div class="fos-hero-card fade-in">
            <div class="fos-hero-title">${greeting},<br>${userName}</div>
            <div class="fos-hero-date">${dateStr}</div>
            ${closePillText ? `<div class="fos-hero-pill"><span class="fos-pill-dot"></span>${closePillText}</div>` : ''}
          </div>

          <!-- Google Connect -->
          <div class="fos-google-card fade-in d2">
            <div class="fos-google-left">
              <div class="fos-google-logo">${googleLogoSVG}</div>
              <div class="fos-google-copy">
                <div class="fos-google-title">${connectedNow ? 'Google conectado' : 'Conectá tu cuenta'}</div>
                <div class="fos-google-desc" id="sp-google-gate-inline">${connectedNow ? 'Tus datos están sincronizados.' : 'Iniciá sesión para sincronizar tus datos.'}</div>
              </div>
            </div>
            <button class="sp-cta fos-google-cta" id="splash-primary-cta" onclick="handleSplashPrimaryAction(event)">${connectedNow ? 'Continuar' : 'Conectar'}</button>
          </div>

          <!-- Quick Actions -->
          <div class="fos-actions-row fade-in d3">
            <button class="fos-action-btn" onclick="if(!_requiresGoogleGateLocal())nav('balance')" data-requires-auth="true">
              <span class="fos-action-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
              <span class="fos-action-label">Saldo</span>
            </button>
            <button class="fos-action-btn" onclick="if(!_requiresGoogleGateLocal())nav('transactions')" data-requires-auth="true">
              <span class="fos-action-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg></span>
              <span class="fos-action-label">Movimientos</span>
            </button>
            <button class="fos-action-btn" onclick="if(!_requiresGoogleGateLocal())nav('tendencia')" data-requires-auth="true">
              <span class="fos-action-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></span>
              <span class="fos-action-label">Presupuesto</span>
            </button>
            <button class="fos-action-btn" onclick="if(!_requiresGoogleGateLocal())nav('settings')" data-requires-auth="true">
              <span class="fos-action-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
              <span class="fos-action-label">Config</span>
            </button>
          </div>
        </div>
      </div>
      `;
      return;
    }

    // ── Desktop layout ──
    content.innerHTML = `
    <div class="fos-shell fade-in">
      <div class="fos-container">
        <!-- Header -->
        <div class="fos-header fade-in">
          <div class="fos-header-left">
            <div class="fos-brand-dot"></div>
            <span class="fos-brand-name">FINANZAS</span>
          </div>
          <div class="fos-header-right">
            <button class="fos-header-btn" title="Notificaciones" onclick="if(!_requiresGoogleGateLocal())toggleNotifPanel()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </button>
            <button class="fos-header-btn" title="Notas" onclick="if(!_requiresGoogleGateLocal())nav('insights')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </button>
            <button class="fos-header-btn" title="Agregar gasto" onclick="if(!_requiresGoogleGateLocal())nav('import')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <div class="fos-avatar">${userName.charAt(0).toUpperCase()}</div>
          </div>
        </div>

        <!-- Hero Card -->
        <div class="fos-hero-card fade-in d1">
          <div class="fos-hero-title">${greeting}, ${userName}</div>
          <div class="fos-hero-date">${dateStr}</div>
          ${closePillText ? `<div class="fos-hero-pill"><span class="fos-pill-dot"></span>${closePillText}</div>` : ''}
        </div>

        <!-- Google Connect Card -->
        <div class="fos-google-card fade-in d2">
          <div class="fos-google-left">
            <div class="fos-google-logo">${googleLogoSVG}</div>
            <div class="fos-google-copy">
              <div class="fos-google-title">${connectedNow ? 'Google conectado' : 'Conectá tu cuenta de Google'}</div>
              <div class="fos-google-desc" id="sp-google-gate-inline">${connectedNow ? 'Tu cuenta ya está sincronizada. Podés continuar al dashboard.' : 'Sincronizá tus datos bancarios y accedé desde cualquier dispositivo.'}</div>
            </div>
          </div>
          <button class="sp-cta fos-google-cta" id="splash-primary-cta" onclick="handleSplashPrimaryAction(event)">${connectedNow ? 'Continuar →' : 'Conectar con Google →'}</button>
        </div>

        <!-- Quick Actions -->
        <div class="fos-actions-row fade-in d3">
          <button class="fos-action-btn" onclick="_requiresGoogleGateLocal()||void(dismissSplash(),nav('balance'))">
            <span class="fos-action-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
            <span class="fos-action-label">Saldo actual</span>
          </button>
          <button class="fos-action-btn" onclick="_requiresGoogleGateLocal()||void(dismissSplash(),nav('transactions'))">
            <span class="fos-action-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg></span>
            <span class="fos-action-label">Movimientos</span>
          </button>
          <button class="fos-action-btn" onclick="_requiresGoogleGateLocal()||void(dismissSplash(),nav('tendencia'))">
            <span class="fos-action-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></span>
            <span class="fos-action-label">Presupuesto</span>
          </button>
          <button class="fos-action-btn" onclick="_requiresGoogleGateLocal()||void(dismissSplash(),nav('settings'))">
            <span class="fos-action-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
            <span class="fos-action-label">Configuración</span>
          </button>
        </div>
      </div>
    </div>
    `;
  }

  // helper used by quick action onclick inline
  window._requiresGoogleGateLocal = function(){
    return typeof isGoogleConnected === 'function' ? !isGoogleConnected() : true;
  };

  function refreshSplashGoogleState(autoDismiss){
    const cta = document.getElementById('splash-primary-cta');
    const connected = typeof isGoogleConnected === 'function' && isGoogleConnected();

    if(cta){
      const isMobile = window.innerWidth <= 768;
      cta.innerHTML = connected
        ? (isMobile ? 'Continuar' : 'Continuar →')
        : (isMobile ? 'Conectar' : 'Conectar con Google →');
    }

    const gate = document.getElementById('sp-google-gate-inline');
    if(gate){
      gate.innerHTML = connected
        ? 'Tu cuenta ya está sincronizada. Podés continuar al dashboard.'
        : 'Sincronizá tus datos bancarios y accedé desde cualquier dispositivo.';
      gate.className = connected ? 'fos-google-desc ok' : 'fos-google-desc';

      // Update Google card title too
      const titleEl = gate.closest('.fos-google-card')?.querySelector('.fos-google-title');
      if(titleEl) titleEl.textContent = connected ? 'Google conectado' : 'Conectá tu cuenta de Google';
    }

    if(connected && autoDismiss){
      setTimeout(()=>dismissSplash(), 260);
    }
  }

  function handleSplashPrimaryAction(event){
    if(event){
      event.preventDefault();
      event.stopPropagation();
    }
    if(typeof isGoogleConnected === 'function' && isGoogleConnected()){
      dismissSplash();
      return;
    }
    if(typeof openCloudSync === 'function'){
      openCloudSync(event);
    }
  }

  // ── Expose globals ──
  window.initSplash   = initSplash;
  window.dismissSplash = dismissSplash;
  window.refreshSplashGoogleState = refreshSplashGoogleState;
  window.handleSplashPrimaryAction = handleSplashPrimaryAction;

})();
