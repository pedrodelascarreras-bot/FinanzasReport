/**
 * lock.js — Acceso a la app con PIN de 4 dígitos (obligatorio)
 *
 * Flujo:
 *  1. Primera vez (no hay PIN guardado): pantalla para crear el PIN (se pide dos veces).
 *  2. Cada vez que se abre la app (sesión nueva de la pestaña o vuelta desde segundo plano
 *     sin sesión): pantalla de PIN. Los datos se leen del dispositivo; Google es opcional.
 *  3. Cambiar PIN: window.openLockSettings() → PIN actual → nuevo → confirmación.
 *  4. Después de 5 intentos fallidos se espera 30 s (60 s a los 10, etc.).
 *  5. Face ID / Touch ID (opcional, por dispositivo): después de entrar con el PIN se ofrece
 *     activarlo. Usa una llave del dispositivo (WebAuthn); el PIN sigue sirviendo de respaldo.
 *
 * Ojo: es una barrera de acceso a la interfaz. Los datos guardados en el navegador no
 * están cifrados.
 *
 * localStorage:
 *   fluxen_lock_pin    — SHA-256 hex del PIN
 *   fluxen_lock_fails  — intentos fallidos seguidos
 *   fluxen_lock_until  — timestamp (ms) hasta el que no se aceptan intentos
 *   fluxen_lock_cred   — id de la llave de Face ID de este dispositivo (base64url)
 *   fluxen_face_offer  — 'no' si se eligió "Ahora no" al ofrecer Face ID
 */

(function () {
  'use strict';

  const LS_PIN = 'fluxen_lock_pin';
  const LS_TYPE = 'fluxen_lock_type';      // legado: se mantiene en 'pin'
  const LS_CRED = 'fluxen_lock_cred';      // llave de Face ID / Touch ID de este dispositivo
  const LS_FACE_OFFER = 'fluxen_face_offer';
  const LS_FAILS = 'fluxen_lock_fails';
  const LS_UNTIL = 'fluxen_lock_until';
  const SESSION_KEY = 'fluxen_session_unlocked';
  const MAX_TRIES = 5;
  const WAIT_MS = 30000;

  // mode: 'unlock' | 'create' | 'confirm' | 'change-current'
  let _mode = null;
  let _entered = [];
  let _newPin = null;
  let _cancellable = false;
  let _waitTimer = null;

  async function sha256hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function hasPin() { return !!localStorage.getItem(LS_PIN); }
  function getLockType() { return hasPin() ? 'pin' : 'none'; }
  function isSessionUnlocked() { return sessionStorage.getItem(SESSION_KEY) === '1'; }
  function markUnlocked() { sessionStorage.setItem(SESSION_KEY, '1'); }

  // ── Face ID / Touch ID (WebAuthn con el sensor del dispositivo) ──
  const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const FACE_NAME = IS_IOS ? 'Face ID' : 'Touch ID';
  let _faceAvailable = null;
  let _faceBusy = false;
  function hasFace() { return !!localStorage.getItem(LS_CRED); }
  async function faceAvailable() {
    if (_faceAvailable !== null) return _faceAvailable;
    try {
      _faceAvailable = !!(window.PublicKeyCredential && window.isSecureContext &&
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    } catch (_) { _faceAvailable = false; }
    return _faceAvailable;
  }
  const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)), c => c.charCodeAt(0));
  const randomBytes = n => crypto.getRandomValues(new Uint8Array(n));

  async function createFace() {
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: randomBytes(32),
      rp: { name: 'Fluxen', id: location.hostname },
      user: { id: randomBytes(16), name: 'Fluxen', displayName: 'Fluxen' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
      attestation: 'none'
    } });
    if (!cred) throw new Error('sin llave');
    localStorage.setItem(LS_CRED, b64u(cred.rawId));
    localStorage.removeItem(LS_FACE_OFFER);
  }
  async function verifyFace() {
    const id = localStorage.getItem(LS_CRED);
    if (!id) return false;
    const got = await navigator.credentials.get({ publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ type: 'public-key', id: unb64u(id), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000
    } });
    return !!got;
  }
  function removeFace() { localStorage.removeItem(LS_CRED); }

  function lockedUntil() { return Number(localStorage.getItem(LS_UNTIL)) || 0; }
  function registerFailure() {
    const fails = (Number(localStorage.getItem(LS_FAILS)) || 0) + 1;
    localStorage.setItem(LS_FAILS, String(fails));
    if (fails % MAX_TRIES === 0) {
      localStorage.setItem(LS_UNTIL, String(Date.now() + WAIT_MS * (fails / MAX_TRIES)));
    }
  }
  function clearFailures() {
    localStorage.removeItem(LS_FAILS);
    localStorage.removeItem(LS_UNTIL);
  }

  const LABELS = {
    'unlock': 'Ingresá tu PIN',
    'create': 'Creá un PIN de 4 dígitos',
    'confirm': 'Confirmá tu PIN',
    'change-current': 'Ingresá tu PIN actual'
  };

  const FACE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1"/><path d="M9 15.5c1.6 1.3 4.4 1.3 6 0"/></svg>';

  function buildLockHTML() {
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => {
      if (k === '') return '<div class="lk-key lk-key-empty" id="lk-face-slot"></div>';
      const isDel = k === '⌫';
      const face = isDel ? '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><line x1="17.5" y1="9.5" x2="12.5" y2="14.5"/><line x1="12.5" y1="9.5" x2="17.5" y2="14.5"/></svg>' : k;
      return `<button class="lk-key${isDel ? ' lk-key-del' : ''}" onclick="window._lkDigit(${isDel ? "'del'" : k})" aria-label="${isDel ? 'Borrar' : k}">${face}</button>`;
    }).join('');
    return `
    <div class="lk-shell" id="lk-shell" role="dialog" aria-modal="true" aria-label="Acceso con PIN">
      <div class="lk-bg"></div>
      <div class="lk-inner">
        <div class="lk-brand"><img src="brand/fluxen-logo.png" alt="Fluxen" class="lk-logo"></div>
        <div class="lk-icon-wrap">
          <svg class="lk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/>
          </svg>
        </div>
        <p class="lk-label" id="lk-label"></p>
        <div class="lk-dots" id="lk-dots">
          <span class="lk-dot" id="lk-dot-0"></span><span class="lk-dot" id="lk-dot-1"></span>
          <span class="lk-dot" id="lk-dot-2"></span><span class="lk-dot" id="lk-dot-3"></span>
        </div>
        <p class="lk-error" id="lk-error"></p>
        <div class="lk-keypad">${keys}</div>
        <div class="lk-offer" id="lk-offer" hidden>
          <div class="lk-offer-icon">${FACE_ICON}</div>
          <p class="lk-offer-t">¿Entrar con ${FACE_NAME}?</p>
          <p class="lk-offer-s">La próxima vez abrís la app ${IS_IOS ? 'con la cara' : 'con tu huella'}, sin escribir el PIN. El PIN sigue sirviendo si ${FACE_NAME} falla.</p>
          <button class="lk-offer-yes" onclick="window._lkFaceEnable()">Activar ${FACE_NAME}</button>
          <button class="lk-offer-no" onclick="window._lkFaceSkip()">Ahora no</button>
        </div>
        <button class="lk-setup-back" id="lk-cancel" style="display:none" onclick="window._lkCancel()">Cancelar</button>
      </div>
    </div>`;
  }

  function setMode(mode, message) {
    _mode = mode;
    _entered = [];
    updateDots();
    const label = document.getElementById('lk-label');
    if (label) label.textContent = LABELS[mode] || '';
    setError(message || '');
    const cancel = document.getElementById('lk-cancel');
    if (cancel) cancel.style.display = _cancellable ? '' : 'none';
    showFaceKey(mode === 'unlock' && hasFace());
    refreshWait();
  }

  function showFaceKey(on) {
    const slot = document.getElementById('lk-face-slot');
    if (!slot) return;
    slot.className = on ? 'lk-key lk-key-face' : 'lk-key lk-key-empty';
    slot.innerHTML = on ? '<button type="button" onclick="window._lkFace()" aria-label="Usar ' + FACE_NAME + '">' + FACE_ICON + '</button>' : '';
  }

  // Entrar con Face ID. Si falla o se cancela, queda el PIN.
  window._lkFace = async function () {
    if (_mode !== 'unlock' || _faceBusy) return;
    _faceBusy = true;
    try {
      if (await verifyFace()) { clearFailures(); markUnlocked(); closeShell(); return; }
    } catch (e) {
      if (e && e.name !== 'NotAllowedError' && e.name !== 'AbortError') setError('No se pudo usar ' + FACE_NAME + '. Poné tu PIN.');
    } finally { _faceBusy = false; }
  };

  // Después de entrar con el PIN: ofrecer Face ID una vez (si el dispositivo lo tiene)
  async function maybeOfferFace() {
    if (hasFace() || localStorage.getItem(LS_FACE_OFFER) === 'no' || !(await faceAvailable())) return false;
    const offer = document.getElementById('lk-offer');
    const shell = document.getElementById('lk-shell');
    if (!offer || !shell) return false;
    _mode = 'offer';
    shell.classList.add('lk-offering');
    offer.hidden = false;
    return true;
  }
  window._lkFaceEnable = async function () {
    try {
      await createFace();
      closeShell();
      notify(FACE_NAME + ' activado. La próxima vez entrás ' + (IS_IOS ? 'con la cara.' : 'con tu huella.'));
    } catch (e) {
      const msg = e && e.name === 'NotAllowedError' ? 'Se canceló. Podés activarlo la próxima vez.' : 'No se pudo activar ' + FACE_NAME + '.';
      closeShell();
      if (typeof showToast === 'function') showToast(msg, 'error');
    }
  };
  window._lkFaceSkip = function () {
    localStorage.setItem(LS_FACE_OFFER, 'no');
    closeShell();
  };

  function updateDots() {
    for (let i = 0; i < 4; i++) {
      const d = document.getElementById('lk-dot-' + i);
      if (d) d.classList.toggle('filled', i < _entered.length);
    }
  }

  function setError(msg, shake) {
    const el = document.getElementById('lk-error');
    if (el) el.textContent = msg;
    if (shake) {
      const dots = document.getElementById('lk-dots');
      if (dots) { dots.classList.add('shake'); setTimeout(() => dots.classList.remove('shake'), 600); }
    }
  }

  // Cuenta regresiva mientras hay espera por intentos fallidos
  function refreshWait() {
    clearTimeout(_waitTimer);
    if (_mode !== 'unlock' && _mode !== 'change-current') return;
    const left = lockedUntil() - Date.now();
    if (left <= 0) return;
    setError('Demasiados intentos. Esperá ' + Math.ceil(left / 1000) + ' s');
    _waitTimer = setTimeout(() => { if (lockedUntil() - Date.now() <= 0) setError(''); refreshWait(); }, 1000);
  }

  // Mientras se pide el PIN, el resto de la página queda inerte: no se puede hacer clic,
  // enfocar con Tab ni leer con lectores de pantalla lo que está detrás.
  function setAppInert(on) {
    Array.from(document.body.children).forEach(el => {
      if (el.id === 'lk-shell' || el.tagName === 'SCRIPT') return;
      if (on) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
      else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
    });
  }

  function showShell(mode, opts = {}) {
    _cancellable = !!opts.cancellable;
    _newPin = null;
    if (!document.getElementById('lk-shell')) {
      const container = document.createElement('div');
      container.innerHTML = buildLockHTML();
      document.body.appendChild(container.firstElementChild);
    }
    setAppInert(true);
    setMode(mode);
  }

  function closeShell() {
    clearTimeout(_waitTimer);
    _mode = null;
    setAppInert(false);
    const shell = document.getElementById('lk-shell');
    if (!shell) return;
    shell.classList.add('lk-exit');
    setTimeout(() => shell.remove(), 420);
  }

  async function savePin(pin) {
    localStorage.setItem(LS_PIN, await sha256hex(pin));
    localStorage.setItem(LS_TYPE, 'pin');
    clearFailures();
  }

  async function handleComplete(pin) {
    _entered = [];
    updateDots();
    if (_mode === 'unlock' || _mode === 'change-current') {
      if (lockedUntil() > Date.now()) { refreshWait(); return; }
      const ok = (await sha256hex(pin)) === localStorage.getItem(LS_PIN);
      if (!ok) {
        registerFailure();
        setMode(_mode);
        setError('PIN incorrecto', true);
        refreshWait();
        return;
      }
      clearFailures();
      if (_mode === 'unlock') { markUnlocked(); if (!(await maybeOfferFace())) closeShell(); return; }
      setMode('create');
      return;
    }
    if (_mode === 'create') {
      _newPin = pin;
      setMode('confirm');
      return;
    }
    if (_mode === 'confirm') {
      if (pin !== _newPin) {
        _newPin = null;
        setMode('create');
        setError('Los PIN no coinciden. Probá de nuevo.', true);
        return;
      }
      await savePin(pin);
      markUnlocked();
      const wasCancellable = _cancellable;
      if (!wasCancellable && await maybeOfferFace()) return;
      closeShell();
      notify(wasCancellable ? 'PIN actualizado' : 'PIN creado. Te lo vamos a pedir cada vez que abras la app.');
    }
  }

  window._lkDigit = function (key) {
    if (!_mode || _mode === 'offer') return;
    if (key === 'del') {
      if (_entered.length) { _entered.pop(); updateDots(); }
      return;
    }
    if (_entered.length >= 4) return;
    // Durante la espera por intentos fallidos no se aceptan dígitos
    if ((_mode === 'unlock' || _mode === 'change-current') && lockedUntil() > Date.now()) { refreshWait(); return; }
    _entered.push(String(key));
    updateDots();
    if (_entered.length === 4) {
      const pin = _entered.join('');
      setTimeout(() => handleComplete(pin), 120);
    }
  };

  window._lkCancel = function () {
    if (_cancellable) closeShell();
  };

  // Teclado físico (desktop): números y borrar
  document.addEventListener('keydown', function (e) {
    if (!_mode) return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); window._lkDigit(Number(e.key)); }
    else if (e.key === 'Backspace') { e.preventDefault(); window._lkDigit('del'); }
    else if (e.key === 'Escape' && _cancellable) { e.preventDefault(); closeShell(); }
  });

  function notify(msg) {
    if (typeof showToast === 'function') showToast(msg, 'success');
  }

  function boot() {
    if (!hasPin()) { showShell('create'); return; }
    if (isSessionUnlocked()) return;
    showShell('unlock');
    // Con Face ID activado se pide la cara al abrir; si el sistema no lo deja sin un toque,
    // queda el botón en el teclado.
    if (hasFace()) setTimeout(() => window._lkFace(), 350);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // PWA que vuelve desde segundo plano (bfcache) sin sesión desbloqueada
  window.addEventListener('pageshow', function (e) {
    if (e.persisted && !isSessionUnlocked() && !_mode) boot();
  });

  // ── API para Ajustes ──
  window.openLockSettings = function () {
    if (!hasPin()) { showShell('create'); return; }
    showShell('change-current', { cancellable: true });
  };
  window.getLockType = getLockType;
  window.fluxenFace = { name: FACE_NAME, has: hasFace, available: faceAvailable, remove: removeFace,
    offerAgain: () => localStorage.removeItem(LS_FACE_OFFER) };
})();
