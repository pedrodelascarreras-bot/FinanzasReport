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

  function jsString(value){
    return JSON.stringify(String(value ?? ''));
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
          <clipPath id="clipCircle">
            <circle cx="60" cy="60" r="60"/>
          </clipPath>
        </defs>
        <g clip-path="url(#clipCircle)">
          <rect width="120" height="120" fill="url(#bg)"/>
          <circle cx="60" cy="45" r="19" fill="#FFD8BF"/>
          <path d="M38 41c2-17 42-23 48 1c-1-8-8-20-24-20c-14 0-23 8-24 19z" fill="${hair}"/>
          <path d="M37 99c4-17 16-28 23-28s19 10 23 28z" fill="${shirt}"/>
          <circle cx="53" cy="46" r="2" fill="#2A2A2A"/>
          <circle cx="67" cy="46" r="2" fill="#2A2A2A"/>
          <path d="M54 55c2 2 10 2 12 0" stroke="#A35A4A" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        </g>
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
    const profiles = typeof window.ensureBankProfiles === 'function' ? window.ensureBankProfiles() : (window.state?.bankProfiles || []);
    const savingsAccounts = window.state?.savAccounts || [];
    const derivedAccounts = [
      ...profiles,
      ...savingsAccounts.map(account => ({
        id:`sav-${account.id}`,
        name:account.name || 'Cuenta de ahorro',
        bank:account.type || 'Ahorros',
        card:account.emoji || 'Cuenta',
        typeLabel:account.type || 'Ahorro',
        status: 'active',
        methodLabel: account.currency || 'ARS',
        balance: Number(account.balance || 0)
      }))
    ];
    if(!derivedAccounts.length){
      const fallbackCards = window.state?.ccCards || [];
      if(fallbackCards.length){
        el.innerHTML = fallbackCards.map(card => `
          <div class="settings-fintech-row">
            <div class="settings-fintech-main">
              <strong>${esc(card.name || 'Tarjeta')}</strong>
              <small>Tomada desde la configuración de tarjetas</small>
              <div class="settings-fintech-chips">
                <span>${esc(card.type || 'credit-card')}</span>
                <span>${esc(card.payMethodKey || 'manual')}</span>
              </div>
            </div>
            <div class="settings-fintech-actions">
              <button class="dashboard-widget-mini primary" onclick="nav('credit-cards')">Abrir tarjetas</button>
            </div>
          </div>
        `).join('');
        return;
      }
      el.innerHTML = `<div class="settings-empty-block">Todavía no hay cuentas configuradas. Agregá una para definir banco, wallet o tarjeta y su método operativo.</div>`;
      return;
    }
    el.innerHTML = derivedAccounts.map(profile => `
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
          ${String(profile.id || '').startsWith('sav-')
            ? `<button class="dashboard-widget-mini primary" onclick="nav('savings')">Ver ahorro</button>`
            : `<button class="dashboard-widget-mini primary" onclick="openBankProfileManager('${esc(profile.id)}')">Editar</button><button class="dashboard-widget-mini" onclick="deleteBankProfileById('${esc(profile.id)}')">Eliminar</button>`}
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
      if(tcConfig.cardName || cycles.length){
        el.innerHTML = `
          <div class="settings-fintech-row">
            <div class="settings-fintech-main">
              <strong>${esc(tcConfig.cardName || 'Tarjeta configurada')}</strong>
              <small>${cycles.length ? `${cycles.length} ciclo${cycles.length===1?'':'s'} cargado${cycles.length===1?'':'s'}` : 'Sin ciclos cargados'}</small>
              <div class="settings-fintech-chips">
                <span>${tcConfig.limit ? `Límite $${esc(typeof fmtN === 'function' ? fmtN(Math.round(tcConfig.limit)) : Math.round(tcConfig.limit))}` : 'Límite no definido'}</span>
                <span>${tcConfig.closeDay ? `Cierre ${esc(tcConfig.closeDay)}` : 'Sin cierre'}</span>
                <span>${tcConfig.dueDay ? `Vence ${esc(tcConfig.dueDay)}` : 'Sin vencimiento'}</span>
              </div>
            </div>
            <div class="settings-fintech-actions">
              <button class="dashboard-widget-mini primary" onclick="nav('credit-cards');ccSelectPageTab('config')">Configurar</button>
            </div>
          </div>
        `;
        return;
      }
      const creditProfiles = (window.state?.bankProfiles || []).filter(profile => profile.type === 'credit-card');
      if(creditProfiles.length){
        el.innerHTML = creditProfiles.map(profile => `
          <div class="settings-fintech-row">
            <div class="settings-fintech-main">
              <strong>${esc(profile.name || profile.card || 'Tarjeta')}</strong>
              <small>${esc(profile.bank || 'Sin banco')} · ${esc(profile.card || 'Tarjeta')}</small>
              <div class="settings-fintech-chips">
                <span>${profile.closeDay ? `Cierre ${esc(profile.closeDay)}` : 'Sin cierre'}</span>
                <span>${profile.dueDay ? `Vence ${esc(profile.dueDay)}` : 'Sin vencimiento'}</span>
                <span>${profile.balance ? `$${esc(typeof fmtN === 'function' ? fmtN(Math.round(profile.balance)) : Math.round(profile.balance))}` : 'Sin saldo'}</span>
              </div>
            </div>
            <div class="settings-fintech-actions">
              <button class="dashboard-widget-mini primary" onclick="openBankProfileManager('${esc(profile.id)}')">Editar</button>
            </div>
          </div>
        `).join('');
        return;
      }
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

  function getSettingsCategoryGroups(){
    const categories = window.state?.categories || [];
    const order = [];
    categories.forEach(cat => {
      const group = (cat.group || 'Sin clasificar').trim() || 'Sin clasificar';
      if(!order.includes(group)) order.push(group);
    });
    if(!order.includes('Sin clasificar')) order.push('Sin clasificar');
    return order;
  }

  function getSettingsCategoryGroupMeta(groupName){
    const group = (window.CATEGORY_GROUPS || []).find(item => item.group === groupName);
    return {
      emoji: group?.emoji || '•',
      color: group?.color || '#64748b'
    };
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
    const groups = getSettingsCategoryGroups();
    el.innerHTML = groups.map(groupName => {
      const meta = getSettingsCategoryGroupMeta(groupName);
      const groupCategories = categories
        .filter(cat => (cat.group || 'Sin clasificar') === groupName)
        .sort((a,b) => (counts[b.name] || 0) - (counts[a.name] || 0) || a.name.localeCompare(b.name));
      const total = groupCategories.reduce((sum, cat) => sum + (counts[cat.name] || 0), 0);
      return `
        <details class="settings-category-group" ${groupName === 'Sin clasificar' ? 'open' : ''}>
          <summary class="settings-category-summary">
            <div class="settings-category-summary-main">
              <span class="settings-category-group-badge" style="background:${esc(meta.color)}22;color:${esc(meta.color)}">${esc(meta.emoji)}</span>
              <div>
                <strong>${esc(groupName)}</strong>
                <small>${groupCategories.length} categoría${groupCategories.length===1?'':'s'} · ${total} movimiento${total===1?'':'s'}</small>
              </div>
            </div>
            <div class="settings-fintech-actions">
              <button class="dashboard-widget-mini" type="button" onclick="event.preventDefault();event.stopPropagation();startSettingsGroupEdit(${jsString(groupName)})">Renombrar</button>
              <button class="dashboard-widget-mini" type="button" onclick="event.preventDefault();event.stopPropagation();startSettingsCategoryCreate(${jsString(groupName)})">Agregar categoría</button>
            </div>
          </summary>
          <div class="settings-category-items">
            ${groupCategories.length ? groupCategories.map(cat => `
              <div class="settings-category-item">
                <div class="settings-fintech-main">
                  <strong><span class="settings-category-dot" style="background:${esc(cat.color || '#64748b')}"></span>${esc(cat.name)}</strong>
                  <small>${counts[cat.name] || 0} movimiento${(counts[cat.name] || 0) === 1 ? '' : 's'} · ${esc(cat.group || 'Sin grupo')}</small>
                </div>
                <div class="settings-fintech-actions">
                  <button class="dashboard-widget-mini primary" type="button" onclick="startSettingsCategoryEdit(${jsString(cat.name)})">Editar</button>
                  <button class="dashboard-widget-mini" type="button" onclick="deleteSettingsCategory(${jsString(cat.name)})">Eliminar</button>
                </div>
              </div>
            `).join('') : `<div class="settings-empty-block">Este grupo todavía no tiene categorías.</div>`}
          </div>
        </details>
      `;
    }).join('');
  }

  function renderSettingsGmailRulesList(){
    const el = document.getElementById('settings-gmail-rules-list');
    if(!el) return;
    const rules = typeof window.ensureGmailImportRules === 'function'
      ? window.ensureGmailImportRules()
      : (window.state?.gmailImportRules || []);
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
    renderSettingsAccountsList();
    renderSettingsCardsList();
    renderSettingsCategoriesList();
    renderSettingsCategoryEditor();
    renderSettingsGroupEditor();
    renderSettingsGmailRulesList();
    renderSetupGuide();
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
    if(!/^image\/(png|jpeg)$/i.test(file.type)){
      window.showToast?.('Usá una imagen JPG o PNG', 'error');
      event.target.value = '';
      return;
    }
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

  function persistSettingsState(message, tone='success'){
    if(typeof window.syncActiveUserProfileFromState === 'function') window.syncActiveUserProfileFromState(false);
    window.saveState?.();
    renderSettingsCenter();
    window.renderSettingsPage?.();
    window.refreshAll?.();
    if(message) window.showToast?.(message, tone);
  }

  function ensureCategorySettingsDraft(){
    if(!window.state._settingsCategoryDraft){
      window.state._settingsCategoryDraft = { mode:'create', originalName:'', name:'', group:'Sin clasificar', color:'#64748b' };
    }
    return window.state._settingsCategoryDraft;
  }

  function ensureGroupSettingsDraft(){
    if(!window.state._settingsGroupDraft){
      window.state._settingsGroupDraft = { mode:'create', originalName:'', name:'' };
    }
    return window.state._settingsGroupDraft;
  }

  function renderSettingsCategoryColorPicker(){
    const wrap = document.getElementById('settings-category-color-picker');
    const draft = ensureCategorySettingsDraft();
    if(!wrap || !Array.isArray(window.PALETTE)) return;
    wrap.innerHTML = window.PALETTE.map(color => `
      <button type="button" class="color-swatch ${draft.color===color ? 'selected' : ''}" style="background:${color}" onclick="setSettingsCategoryColor('${color}')"></button>
    `).join('');
  }

  function renderSettingsCategoryEditor(){
    const shell = document.getElementById('settings-category-editor');
    if(!shell) return;
    const draft = ensureCategorySettingsDraft();
    if(!draft.mode){
      shell.style.display = 'none';
      shell.innerHTML = '';
      return;
    }
    shell.style.display = 'block';
    const groups = getSettingsCategoryGroups();
    shell.innerHTML = `
      <div class="settings-editor-head">
        <strong>${draft.mode === 'edit' ? 'Editar categoría' : 'Nueva categoría'}</strong>
        <button class="dashboard-widget-mini" type="button" onclick="cancelSettingsCategoryEditor()">Cerrar</button>
      </div>
      <div class="settings-editor-grid">
        <label class="profile-field">
          <span class="profile-field-label">Nombre</span>
          <input id="settings-category-name" class="profile-field-input" value="${esc(draft.name || '')}" placeholder="Ej: Supermercado">
        </label>
        <label class="profile-field">
          <span class="profile-field-label">Grupo</span>
          <select id="settings-category-group" class="profile-field-input">
            ${groups.map(group => `<option value="${esc(group)}" ${draft.group===group?'selected':''}>${esc(group)}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="profile-field">
        <span class="profile-field-label">Color</span>
        <div id="settings-category-color-picker" class="color-picker-row"></div>
      </div>
      <div class="profile-inline-actions">
        <button class="btn btn-primary btn-sm" type="button" onclick="saveSettingsCategory()">Guardar categoría</button>
        ${draft.mode === 'edit' ? `<button class="btn btn-ghost btn-sm" type="button" onclick="deleteSettingsCategory(${jsString(draft.originalName)})">Eliminar</button>` : ''}
      </div>
    `;
    renderSettingsCategoryColorPicker();
  }

  function renderSettingsGroupEditor(){
    const shell = document.getElementById('settings-group-editor');
    if(!shell) return;
    const draft = ensureGroupSettingsDraft();
    if(!draft.mode){
      shell.style.display = 'none';
      shell.innerHTML = '';
      return;
    }
    shell.style.display = 'block';
    shell.innerHTML = `
      <div class="settings-editor-head">
        <strong>${draft.mode === 'edit' ? 'Renombrar grupo' : 'Nuevo grupo'}</strong>
        <button class="dashboard-widget-mini" type="button" onclick="cancelSettingsGroupEditor()">Cerrar</button>
      </div>
      <div class="settings-editor-grid settings-editor-grid-single">
        <label class="profile-field">
          <span class="profile-field-label">Nombre del grupo</span>
          <input id="settings-group-name" class="profile-field-input" value="${esc(draft.name || '')}" placeholder="Ej: Hogar">
        </label>
      </div>
      <div class="profile-inline-actions">
        <button class="btn btn-primary btn-sm" type="button" onclick="saveSettingsGroup()">Guardar grupo</button>
        ${draft.mode === 'edit' && draft.originalName !== 'Sin clasificar' ? `<button class="btn btn-ghost btn-sm" type="button" onclick="deleteSettingsGroup(${jsString(draft.originalName)})">Eliminar grupo</button>` : ''}
      </div>
    `;
  }

  function startSettingsCategoryCreate(groupName){
    window.state._settingsCategoryDraft = {
      mode:'create',
      originalName:'',
      name:'',
      group:groupName || 'Sin clasificar',
      color:'#64748b'
    };
    renderSettingsCategoryEditor();
  }

  function startSettingsCategoryEdit(name){
    const category = (window.state?.categories || []).find(cat => cat.name === name);
    if(!category) return;
    window.state._settingsCategoryDraft = {
      mode:'edit',
      originalName:category.name,
      name:category.name,
      group:category.group || 'Sin clasificar',
      color:category.color || '#64748b'
    };
    renderSettingsCategoryEditor();
  }

  function cancelSettingsCategoryEditor(){
    window.state._settingsCategoryDraft = null;
    renderSettingsCategoryEditor();
  }

  function setSettingsCategoryColor(color){
    const draft = ensureCategorySettingsDraft();
    draft.color = color;
    renderSettingsCategoryEditor();
  }

  function saveSettingsCategory(){
    const draft = ensureCategorySettingsDraft();
    const name = document.getElementById('settings-category-name')?.value.trim() || '';
    const group = document.getElementById('settings-category-group')?.value || 'Sin clasificar';
    if(!name){
      window.showToast?.('Ingresá un nombre de categoría', 'error');
      return;
    }
    const categories = [...(window.state?.categories || [])];
    const duplicate = categories.find(cat => cat.name === name && cat.name !== draft.originalName);
    if(duplicate){
      window.showToast?.('Ya existe una categoría con ese nombre', 'error');
      return;
    }
    if(draft.mode === 'edit'){
      const category = categories.find(cat => cat.name === draft.originalName);
      if(!category) return;
      if(name !== draft.originalName){
        (window.state?.transactions || []).forEach(txn => {
          if(txn.category === draft.originalName) txn.category = name;
        });
      }
      category.name = name;
      category.group = group;
      category.color = draft.color || category.color || '#64748b';
    } else {
      categories.push({ name, group, color:draft.color || '#64748b', emoji:getSettingsCategoryGroupMeta(group).emoji });
    }
    window.state.categories = categories;
    cancelSettingsCategoryEditor();
    persistSettingsState('Categoría guardada', 'success');
  }

  function deleteSettingsCategory(name){
    if(!name) return;
    if(!window.confirm(`¿Eliminar la categoría "${name}"?`)) return;
    window.state.categories = (window.state?.categories || []).filter(cat => cat.name !== name);
    (window.state?.transactions || []).forEach(txn => {
      if(txn.category === name) txn.category = 'Uncategorized';
    });
    cancelSettingsCategoryEditor();
    persistSettingsState('Categoría eliminada', 'info');
  }

  function startSettingsGroupCreate(){
    window.state._settingsGroupDraft = { mode:'create', originalName:'', name:'' };
    renderSettingsGroupEditor();
  }

  function startSettingsGroupEdit(name){
    window.state._settingsGroupDraft = { mode:'edit', originalName:name, name:name };
    renderSettingsGroupEditor();
  }

  function cancelSettingsGroupEditor(){
    window.state._settingsGroupDraft = null;
    renderSettingsGroupEditor();
  }

  function saveSettingsGroup(){
    const draft = ensureGroupSettingsDraft();
    const name = document.getElementById('settings-group-name')?.value.trim() || '';
    if(!name){
      window.showToast?.('Ingresá un nombre de grupo', 'error');
      return;
    }
    const exists = getSettingsCategoryGroups().includes(name);
    if(draft.mode === 'create' && exists){
      window.showToast?.('Ese grupo ya existe', 'error');
      return;
    }
    if(draft.mode === 'edit'){
      (window.state?.categories || []).forEach(cat => {
        if((cat.group || 'Sin clasificar') === draft.originalName) cat.group = name;
      });
    }
    cancelSettingsGroupEditor();
    persistSettingsState('Grupo guardado', 'success');
  }

  function deleteSettingsGroup(name){
    if(!name || name === 'Sin clasificar') return;
    if(!window.confirm(`¿Eliminar el grupo "${name}"? Las categorías pasarán a "Sin clasificar".`)) return;
    (window.state?.categories || []).forEach(cat => {
      if((cat.group || 'Sin clasificar') === name) cat.group = 'Sin clasificar';
    });
    cancelSettingsGroupEditor();
    persistSettingsState('Grupo eliminado', 'info');
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
  window.startSettingsCategoryCreate = startSettingsCategoryCreate;
  window.startSettingsCategoryEdit = startSettingsCategoryEdit;
  window.cancelSettingsCategoryEditor = cancelSettingsCategoryEditor;
  window.setSettingsCategoryColor = setSettingsCategoryColor;
  window.saveSettingsCategory = saveSettingsCategory;
  window.deleteSettingsCategory = deleteSettingsCategory;
  window.startSettingsGroupCreate = startSettingsGroupCreate;
  window.startSettingsGroupEdit = startSettingsGroupEdit;
  window.cancelSettingsGroupEditor = cancelSettingsGroupEditor;
  window.saveSettingsGroup = saveSettingsGroup;
  window.deleteSettingsGroup = deleteSettingsGroup;
})();
