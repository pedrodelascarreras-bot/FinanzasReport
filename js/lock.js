/**
 * lock.js — Acceso a la app con PIN de 4 dígitos (obligatorio)
 *
 * Flujo:
 *  1. Primera vez (no hay PIN guardado): pantalla para crear el PIN (se pide dos veces).
 *  2. Cada vez que se abre la app (sesión nueva de la pestaña o vuelta desde segundo plano
 *     sin sesión): pantalla de PIN. Los datos se leen del dispositivo; Google es opcional.
 *  3. Cambiar PIN: window.openLockSettings() → PIN actual → nuevo → confirmación.
 *  4. Después de 5 intentos fallidos se espera 30 s (60 s a los 10, etc.).
 *
 * Ojo: es una barrera de acceso a la interfaz. Los datos guardados en el navegador no
 * están cifrados.
 *
 * localStorage:
 *   fluxen_lock_pin    — SHA-256 hex del PIN
 *   fluxen_lock_fails  — intentos fallidos seguidos
 *   fluxen_lock_until  — timestamp (ms) hasta el que no se aceptan intentos
 */

(function () {
  'use strict';

  const LS_PIN = 'fluxen_lock_pin';
  const LS_TYPE = 'fluxen_lock_type';      // legado: se mantiene en 'pin'
  const LS_CRED = 'fluxen_lock_cred';      // legado (Face ID): se borra
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

  function buildLockHTML() {
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => {
      if (k === '') return '<div class="lk-key lk-key-empty"></div>';
      const isDel = k === '⌫';
      return `<button class="lk-key${isDel ? ' lk-key-del' : ''}" onclick="window._lkDigit(${isDel ? "'del'" : k})" aria-label="${isDel ? 'Borrar' : k}">${k}</button>`;
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
    refreshWait();
  }

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
    localStorage.removeItem(LS_CRED);
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
      if (_mode === 'unlock') { markUnlocked(); closeShell(); return; }
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
      closeShell();
      notify(_cancellable ? 'PIN actualizado' : 'PIN creado. Te lo vamos a pedir cada vez que abras la app.');
    }
  }

  window._lkDigit = function (key) {
    if (!_mode) return;
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
})();
