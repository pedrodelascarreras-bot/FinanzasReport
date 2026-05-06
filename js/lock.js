/**
 * lock.js — Fluxen PIN / Face ID lock screen
 *
 * Flow:
 *  1. On every PWA launch (pageshow): if lock is configured → show lock screen.
 *  2. Lock screen: PIN keypad or Face ID button.
 *  3. On success: dismiss overlay, app runs normally.
 *  4. Settings entry point: window.openLockSettings() lets users set/change/remove protection.
 *
 * Storage keys (localStorage):
 *   fluxen_lock_type   — 'pin' | 'faceid' | 'none'
 *   fluxen_lock_pin    — SHA-256 hex of the 4-digit PIN
 *   fluxen_lock_cred   — JSON of WebAuthn credentialId (base64url)
 */

(function () {
  'use strict';

  /* ─── Constants ──────────────────────────────────────────── */
  const LS_TYPE   = 'fluxen_lock_type';
  const LS_PIN    = 'fluxen_lock_pin';
  const LS_CRED   = 'fluxen_lock_cred';
  const RP_ID     = location.hostname || 'localhost';
  const RP_NAME   = 'Fluxen';

  /* ─── State ──────────────────────────────────────────────── */
  let _unlocked = false;   // true once user authenticates this session
  let _entered  = [];      // digits entered so far

  /* ─── SHA-256 helper (no server needed) ─────────────────── */
  async function sha256hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ─── Base64url helpers for WebAuthn ────────────────────── */
  function b64uEncode(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
  function b64uDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer;
  }

  /* ─── Random bytes helper ────────────────────────────────── */
  function randomBytes(n) {
    const arr = new Uint8Array(n);
    crypto.getRandomValues(arr);
    return arr;
  }

  /* ─── Check WebAuthn / platform authenticator support ────── */
  async function faceIdAvailable() {
    if (!window.PublicKeyCredential) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch { return false; }
  }

  /* ─── Register Face ID credential ───────────────────────── */
  async function registerFaceId() {
    const userId = randomBytes(16);
    const challenge = randomBytes(32);
    const cred = await navigator.credentials.create({
      publicKey: {
        rp:        { id: RP_ID, name: RP_NAME },
        user:      { id: userId, name: 'pedro', displayName: 'Pedro' },
        challenge,
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred'
        },
        timeout: 60000
      }
    });
    if (!cred) throw new Error('No credential returned');
    localStorage.setItem(LS_CRED, JSON.stringify({
      id:     b64uEncode(cred.rawId),
      userId: b64uEncode(userId)
    }));
    localStorage.setItem(LS_TYPE, 'faceid');
    return cred;
  }

  /* ─── Verify Face ID ──────────────────────────────────────── */
  async function verifyFaceId() {
    const stored = JSON.parse(localStorage.getItem(LS_CRED) || 'null');
    if (!stored) throw new Error('No credential stored');
    const challenge = randomBytes(32);
    await navigator.credentials.get({
      publicKey: {
        rpId:            RP_ID,
        challenge,
        allowCredentials: [{ type: 'public-key', id: b64uDecode(stored.id) }],
        userVerification: 'required',
        timeout: 60000
      }
    });
  }

  /* ─── Lock type getters ──────────────────────────────────── */
  function getLockType() { return localStorage.getItem(LS_TYPE) || 'none'; }

  /* ─── Session tracking — show lock on each fresh launch ──── */
  function markUnlocked() {
    _unlocked = true;
    sessionStorage.setItem('fluxen_session_unlocked', '1');
  }
  function isSessionUnlocked() {
    return sessionStorage.getItem('fluxen_session_unlocked') === '1';
  }

  /* ══════════════════════════════════════════════════════════
     LOCK SCREEN HTML
  ══════════════════════════════════════════════════════════ */
  function buildLockHTML(type) {
    const isPIN    = type === 'pin';
    const isFaceId = type === 'faceid';

    return `
    <div class="lk-shell" id="lk-shell" role="dialog" aria-modal="true" aria-label="Pantalla de bloqueo">
      <div class="lk-bg"></div>

      <div class="lk-inner">
        <!-- Brand -->
        <div class="lk-brand">
          <img src="brand/fluxen-logo.png" alt="Fluxen" class="lk-logo">
        </div>

        <!-- Lock icon -->
        <div class="lk-icon-wrap">
          <svg class="lk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="3"/>
            <path d="M8 11V8a4 4 0 1 1 8 0v3"/>
          </svg>
        </div>

        <p class="lk-label">${isPIN ? 'Ingresá tu PIN' : 'Verificá tu identidad'}</p>

        ${isPIN ? `
        <!-- PIN dots -->
        <div class="lk-dots" id="lk-dots">
          <span class="lk-dot" id="lk-dot-0"></span>
          <span class="lk-dot" id="lk-dot-1"></span>
          <span class="lk-dot" id="lk-dot-2"></span>
          <span class="lk-dot" id="lk-dot-3"></span>
        </div>

        <!-- Error message -->
        <p class="lk-error" id="lk-error"></p>

        <!-- Keypad -->
        <div class="lk-keypad">
          ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, i) => {
            if (k === '') return `<div class="lk-key lk-key-empty"></div>`;
            const isBackspace = k === '⌫';
            return `<button class="lk-key${isBackspace ? ' lk-key-del' : ''}"
              onclick="window._lkDigit(${isBackspace ? "'del'" : k})"
              aria-label="${isBackspace ? 'Borrar' : k}">${k}</button>`;
          }).join('')}
        </div>` : ''}

        ${isFaceId ? `
        <!-- Face ID button -->
        <button class="lk-faceid-btn" id="lk-faceid-btn" onclick="window._lkFaceId()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 2H6a2 2 0 0 0-2 2v2"/>
            <path d="M16 2h2a2 2 0 0 1 2 2v2"/>
            <path d="M8 22H6a2 2 0 0 1-2-2v-2"/>
            <path d="M16 22h2a2 2 0 0 0 2-2v-2"/>
            <path d="M9 9h.01"/>
            <path d="M15 9h.01"/>
            <path d="M9.5 14a3.5 3.5 0 0 0 5 0"/>
            <path d="M12 6v3"/>
          </svg>
          <span>Usar Face ID</span>
        </button>
        <p class="lk-error" id="lk-error"></p>` : ''}
      </div>
    </div>
    `;
  }

  /* ─── Dot rendering ──────────────────────────────────────── */
  function updateDots() {
    for (let i = 0; i < 4; i++) {
      const d = document.getElementById('lk-dot-' + i);
      if (d) d.classList.toggle('filled', i < _entered.length);
    }
  }

  /* ─── Show error + shake ─────────────────────────────────── */
  function showLockError(msg) {
    const el = document.getElementById('lk-error');
    if (el) el.textContent = msg;
    const dots = document.getElementById('lk-dots');
    if (dots) {
      dots.classList.add('shake');
      setTimeout(() => dots.classList.remove('shake'), 600);
    }
    _entered = [];
    updateDots();
  }

  /* ─── Dismiss lock screen ────────────────────────────────── */
  function dismissLock() {
    markUnlocked();
    const shell = document.getElementById('lk-shell');
    if (!shell) return;
    shell.classList.add('lk-exit');
    setTimeout(() => shell.remove(), 420);
  }

  /* ─── PIN digit handler ──────────────────────────────────── */
  window._lkDigit = async function(key) {
    if (key === 'del') {
      if (_entered.length > 0) { _entered.pop(); updateDots(); }
      return;
    }
    if (_entered.length >= 4) return;
    _entered.push(String(key));
    updateDots();

    if (_entered.length === 4) {
      const entered = _entered.join('');
      _entered = [];
      updateDots();
      const stored = localStorage.getItem(LS_PIN);
      const hash   = await sha256hex(entered);
      if (hash === stored) {
        dismissLock();
      } else {
        setTimeout(() => showLockError('PIN incorrecto'), 100);
      }
    }
  };

  /* ─── Face ID handler ────────────────────────────────────── */
  window._lkFaceId = async function() {
    const btn = document.getElementById('lk-faceid-btn');
    if (btn) btn.classList.add('loading');
    try {
      await verifyFaceId();
      dismissLock();
    } catch (e) {
      const err = document.getElementById('lk-error');
      if (err) err.textContent = 'Verificación fallida. Intentá de nuevo.';
      if (btn) btn.classList.remove('loading');
    }
  };

  /* ─── Show lock screen ───────────────────────────────────── */
  async function showLockScreen() {
    const type = getLockType();
    if (type === 'none') return;

    const container = document.createElement('div');
    container.innerHTML = buildLockHTML(type);
    document.body.appendChild(container.firstElementChild);

    // Auto-trigger Face ID on open
    if (type === 'faceid') {
      setTimeout(() => window._lkFaceId(), 400);
    }
  }

  /* ─── Boot: show lock on every fresh launch ──────────────── */
  function boot() {
    if (getLockType() === 'none') return;
    if (isSessionUnlocked()) return; // already unlocked in this tab session
    showLockScreen();
  }

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Also fire when PWA is resumed from background (iOS pageshow)
  window.addEventListener('pageshow', function (e) {
    // e.persisted = true means it was loaded from bfcache (background → foreground)
    if (e.persisted && !isSessionUnlocked()) {
      showLockScreen();
    }
  });

  /* ══════════════════════════════════════════════════════════
     SETTINGS API — called from Settings page
  ══════════════════════════════════════════════════════════ */

  /* Open the lock settings bottom sheet */
  window.openLockSettings = function() {
    _showLockSetupSheet();
  };

  /* Remove all lock protection */
  window.removeLockProtection = async function() {
    localStorage.removeItem(LS_TYPE);
    localStorage.removeItem(LS_PIN);
    localStorage.removeItem(LS_CRED);
  };

  /* ─── Setup sheet ─────────────────────────────────────────── */
  function _showLockSetupSheet() {
    const existing = document.getElementById('lk-setup-sheet');
    if (existing) existing.remove();

    faceIdAvailable().then(hasFaceId => {
      const current = getLockType();
      const isNone  = current === 'none';

      const sheet = document.createElement('div');
      sheet.id = 'lk-setup-sheet';
      sheet.className = 'lk-setup-sheet';
      sheet.innerHTML = `
        <div class="lk-setup-backdrop" onclick="document.getElementById('lk-setup-sheet').remove()"></div>
        <div class="lk-setup-panel">
          <div class="lk-setup-handle"></div>
          <h3 class="lk-setup-title">Bloqueo de la app</h3>
          <p class="lk-setup-sub">
            ${isNone
              ? 'Elegí cómo querés proteger tu app cuando la abrís.'
              : 'Tu app está protegida. Cambiá o quitá la seguridad.'}
          </p>

          <div class="lk-setup-options" id="lk-setup-options">
            <!-- PIN option -->
            <button class="lk-setup-opt${current === 'pin' ? ' active' : ''}" id="lk-opt-pin"
                    onclick="window._lkSetupChoose('pin')">
              <span class="lk-setup-opt-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <rect x="5" y="11" width="14" height="10" rx="3"/>
                  <path d="M8 11V8a4 4 0 1 1 8 0v3"/>
                </svg>
              </span>
              <span class="lk-setup-opt-body">
                <strong>PIN de 4 dígitos</strong>
                <span>Ingresás un código cada vez que abrís la app</span>
              </span>
              ${current === 'pin' ? '<span class="lk-setup-opt-check">✓</span>' : ''}
            </button>

            ${hasFaceId ? `
            <!-- Face ID option -->
            <button class="lk-setup-opt${current === 'faceid' ? ' active' : ''}" id="lk-opt-faceid"
                    onclick="window._lkSetupChoose('faceid')">
              <span class="lk-setup-opt-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                     stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 2H6a2 2 0 0 0-2 2v2"/><path d="M16 2h2a2 2 0 0 1 2 2v2"/>
                  <path d="M8 22H6a2 2 0 0 1-2-2v-2"/><path d="M16 22h2a2 2 0 0 0 2-2v-2"/>
                  <path d="M9 9h.01"/><path d="M15 9h.01"/>
                  <path d="M9.5 14a3.5 3.5 0 0 0 5 0"/><path d="M12 6v3"/>
                </svg>
              </span>
              <span class="lk-setup-opt-body">
                <strong>Face ID / Touch ID</strong>
                <span>Tu cara o huella desbloquean la app al instante</span>
              </span>
              ${current === 'faceid' ? '<span class="lk-setup-opt-check">✓</span>' : ''}
            </button>` : ''}

            ${!isNone ? `
            <!-- Remove protection -->
            <button class="lk-setup-opt lk-setup-opt-danger" onclick="window._lkSetupRemove()">
              <span class="lk-setup-opt-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </span>
              <span class="lk-setup-opt-body">
                <strong>Quitar protección</strong>
                <span>La app no pedirá contraseña al abrirse</span>
              </span>
            </button>` : ''}
          </div>

          <!-- PIN setup flow (hidden, shown inline) -->
          <div class="lk-setup-pin-flow" id="lk-setup-pin-flow" style="display:none">
            <p class="lk-setup-pin-label" id="lk-setup-pin-label">Elegí un PIN de 4 dígitos</p>
            <div class="lk-dots lk-setup-dots" id="lk-setup-dots">
              <span class="lk-dot" id="lk-sdot-0"></span>
              <span class="lk-dot" id="lk-sdot-1"></span>
              <span class="lk-dot" id="lk-sdot-2"></span>
              <span class="lk-dot" id="lk-sdot-3"></span>
            </div>
            <p class="lk-error" id="lk-setup-error"></p>
            <div class="lk-keypad lk-setup-keypad">
              ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => {
                if (k === '') return `<div class="lk-key lk-key-empty"></div>`;
                const isDel = k === '⌫';
                return `<button class="lk-key${isDel ? ' lk-key-del' : ''}"
                  onclick="window._lkSetupDigit(${isDel ? "'del'" : k})"
                  aria-label="${isDel ? 'Borrar' : k}">${k}</button>`;
              }).join('')}
            </div>
            <button class="lk-setup-back" onclick="window._lkSetupBackToOptions()">← Volver</button>
          </div>
        </div>
      `;
      document.body.appendChild(sheet);
      requestAnimationFrame(() => sheet.classList.add('open'));
    });
  }

  /* ─── Setup flow state ──────────────────────────────────── */
  let _setupPin1 = null;
  let _setupEntered = [];

  function _setupUpdateDots(len) {
    for (let i = 0; i < 4; i++) {
      const d = document.getElementById('lk-sdot-' + i);
      if (d) d.classList.toggle('filled', i < len);
    }
  }

  window._lkSetupBackToOptions = function() {
    _setupPin1 = null;
    _setupEntered = [];
    document.getElementById('lk-setup-pin-flow').style.display = 'none';
    document.getElementById('lk-setup-options').style.display = '';
  };

  window._lkSetupChoose = async function(type) {
    if (type === 'pin') {
      // Show PIN setup flow
      _setupPin1 = null;
      _setupEntered = [];
      document.getElementById('lk-setup-options').style.display = 'none';
      const flow = document.getElementById('lk-setup-pin-flow');
      flow.style.display = '';
      document.getElementById('lk-setup-pin-label').textContent = 'Elegí un PIN de 4 dígitos';
      _setupUpdateDots(0);
    } else if (type === 'faceid') {
      const btn = document.getElementById('lk-opt-faceid');
      if (btn) btn.textContent = '...registrando Face ID';
      try {
        await registerFaceId();
        markUnlocked();
        const sheet = document.getElementById('lk-setup-sheet');
        if (sheet) sheet.remove();
        _showToast('Face ID activado correctamente');
      } catch (e) {
        const opts = document.getElementById('lk-setup-options');
        if (opts) {
          const err = document.createElement('p');
          err.className = 'lk-error';
          err.style.textAlign = 'center';
          err.textContent = 'No se pudo registrar Face ID. Intentá con PIN.';
          opts.appendChild(err);
        }
        if (btn) btn.textContent = 'Face ID / Touch ID';
      }
    }
  };

  window._lkSetupDigit = async function(key) {
    if (key === 'del') {
      if (_setupEntered.length > 0) { _setupEntered.pop(); _setupUpdateDots(_setupEntered.length); }
      return;
    }
    if (_setupEntered.length >= 4) return;
    _setupEntered.push(String(key));
    _setupUpdateDots(_setupEntered.length);

    if (_setupEntered.length === 4) {
      const entered = _setupEntered.join('');
      _setupEntered = [];
      _setupUpdateDots(0);

      if (_setupPin1 === null) {
        // First entry: ask for confirmation
        _setupPin1 = entered;
        document.getElementById('lk-setup-pin-label').textContent = 'Confirmá tu PIN';
      } else {
        // Second entry: verify match
        if (entered === _setupPin1) {
          const hash = await sha256hex(entered);
          localStorage.setItem(LS_PIN, hash);
          localStorage.setItem(LS_TYPE, 'pin');
          localStorage.removeItem(LS_CRED);
          _setupPin1 = null;
          markUnlocked();
          const sheet = document.getElementById('lk-setup-sheet');
          if (sheet) sheet.remove();
          _showToast('PIN configurado correctamente');
        } else {
          _setupPin1 = null;
          const errEl = document.getElementById('lk-setup-error');
          if (errEl) errEl.textContent = 'Los PINs no coinciden. Intentá de nuevo.';
          document.getElementById('lk-setup-pin-label').textContent = 'Elegí un PIN de 4 dígitos';
          // shake
          const dots = document.getElementById('lk-setup-dots');
          if (dots) { dots.classList.add('shake'); setTimeout(() => dots.classList.remove('shake'), 600); }
        }
      }
    }
  };

  window._lkSetupRemove = async function() {
    await window.removeLockProtection();
    const sheet = document.getElementById('lk-setup-sheet');
    if (sheet) sheet.remove();
    _showToast('Protección eliminada');
  };

  /* ─── Mini toast ─────────────────────────────────────────── */
  function _showToast(msg) {
    if (typeof showToast === 'function') { showToast(msg, 'success'); return; }
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);' +
      'background:#27E47A;color:#0B1020;padding:10px 20px;border-radius:99px;' +
      'font-weight:700;font-size:14px;z-index:99999;pointer-events:none;';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  /* ─── Expose for Settings page ───────────────────────────── */
  window.getLockType   = getLockType;
  window.faceIdAvailable = faceIdAvailable;

})();
