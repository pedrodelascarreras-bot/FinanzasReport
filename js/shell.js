// ══ GLOBAL APP SHELL LOGIC ══

(function(){
  const AVATAR_PRESETS = [
    { id:'sunset',  label:'Sunset'  },
    { id:'ocean',   label:'Ocean'   },
    { id:'mint',    label:'Mint'    },
    { id:'lavender',label:'Lavender'},
    { id:'peach',   label:'Peach'   },
    { id:'noir',    label:'Noir'    },
    { id:'forest',  label:'Forest'  },
    { id:'aurora',  label:'Aurora'  }
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
    // Each theme: [bgTop, bgBottom, accent, faceTone]
    const themes = {
      sunset:   ['#FF9966','#FF5E62','#FFE66D','#FFD8BF'],
      ocean:    ['#36D1DC','#5B86E5','#A8FFCE','#FFE0CC'],
      mint:     ['#43E97B','#38F9D7','#FFF8B5','#FFD8BF'],
      lavender: ['#C471F5','#FA71CD','#FFEAA7','#FFE0CC'],
      peach:    ['#FFD3A5','#FD6585','#FFFBE6','#FFE0CC'],
      noir:     ['#232526','#414345','#00C9FF','#FFD8BF'],
      forest:   ['#11998E','#38EF7D','#FFF59D','#FFE0CC'],
      aurora:   ['#7F00FF','#00FFEE','#FFEB3B','#FFE0CC']
    };
    const [c1,c2,accent,faceTone] = themes[id] || themes.sunset;
    const initial = getAvatarLetter().slice(0,1) || 'P';
    // SVG moderno: gradiente + glyph geométrico + inicial central
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c2}"/>
        </linearGradient>
        <radialGradient id="halo-${id}" cx="50%" cy="38%" r="55%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
        </radialGradient>
        <clipPath id="clip-${id}"><circle cx="80" cy="80" r="80"/></clipPath>
      </defs>
      <g clip-path="url(#clip-${id})">
        <rect width="160" height="160" fill="url(#bg-${id})"/>
        <circle cx="80" cy="65" r="78" fill="url(#halo-${id})"/>
        <circle cx="120" cy="32" r="14" fill="${accent}" opacity="0.75"/>
        <circle cx="32" cy="120" r="22" fill="${faceTone}" opacity="0.18"/>
        <text x="80" y="100" font-family="-apple-system, SF Pro Display, sans-serif"
              font-size="68" font-weight="800" fill="#ffffff"
              text-anchor="middle" letter-spacing="-2">${esc(initial)}</text>
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

    // Google status now lives only in Security page (dedup cleanup)
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
    if(!cards.length){
      el.innerHTML = `<div class="settings-empty-block">No hay tarjetas registradas todavía. Agregalas desde el módulo de Tarjetas para ver sus ciclos acá.</div>`;
      return;
    }
    const fmtDate = ymd => {
      if(!ymd) return '—';
      try{ return new Date(ymd+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short'}); }
      catch(e){ return ymd; }
    };
    const today = new Date(); today.setHours(0,0,0,0);
    el.innerHTML = cards.map(card => {
      // Filter cycles that belong to this card (or general cycles if no cardId set)
      const cardCycles = cycles.filter(c => !c.cardId || c.cardId === card.id);
      // Pick the next upcoming (or current) cycle: smallest dueDate >= today, else most recent
      let activeCycle = null;
      const sortedAsc = [...cardCycles].sort((a,b)=>(a.dueDate||a.closeDate||'').localeCompare(b.dueDate||b.closeDate||''));
      for(const c of sortedAsc){
        const ref = c.dueDate || c.closeDate;
        if(ref && new Date(ref+'T12:00:00') >= today){ activeCycle = c; break; }
      }
      if(!activeCycle) activeCycle = sortedAsc[sortedAsc.length-1] || null;
      const idxInDesc = activeCycle ? cycles.findIndex(c=>c.id===activeCycle.id) : -1;
      const openDate = (idxInDesc>=0 && typeof window.getTcCycleOpen === 'function') ? window.getTcCycleOpen(cycles, idxInDesc) : null;
      const status = (window.state?.ccCycles || []).find(s => s.cardId === card.id && activeCycle && s.tcCycleId === activeCycle.id);
      const isPaid = status?.status === 'paid';
      return `
        <div class="settings-card-redesign">
          <div class="settings-card-redesign-head">
            <div class="settings-card-redesign-name">
              <span class="settings-card-redesign-dot" style="background:${esc(card.color || '#64748b')}"></span>
              ${esc(card.name || 'Tarjeta')}
            </div>
            <span class="settings-card-redesign-tag">${esc((card.payMethodKey||'tc').toUpperCase())} · ${cardCycles.length} ciclo${cardCycles.length===1?'':'s'}${isPaid?' · pagado':''}</span>
          </div>
          ${activeCycle ? `
            <div class="settings-card-redesign-cycles">
              <div class="settings-card-redesign-cycle">
                <span class="settings-card-redesign-cycle-label">Apertura</span>
                <span class="settings-card-redesign-cycle-value">${esc(fmtDate(openDate))}</span>
              </div>
              <div class="settings-card-redesign-cycle">
                <span class="settings-card-redesign-cycle-label">Cierre</span>
                <span class="settings-card-redesign-cycle-value">${esc(fmtDate(activeCycle.closeDate))}</span>
              </div>
              <div class="settings-card-redesign-cycle">
                <span class="settings-card-redesign-cycle-label">Vencimiento</span>
                <span class="settings-card-redesign-cycle-value">${esc(fmtDate(activeCycle.dueDate))}</span>
              </div>
            </div>
          ` : `<div class="settings-empty-block">Sin ciclos cargados para esta tarjeta.</div>`}
          <div class="settings-card-redesign-actions">
            <button class="dashboard-widget-mini primary" type="button" onclick="nav('credit-cards');if(typeof ccSelectPageTab==='function')ccSelectPageTab('config')">Gestionar ciclos</button>
            <button class="dashboard-widget-mini" type="button" onclick="nav('credit-cards');if(typeof state!=='undefined'){state.ccActiveCard='${esc(card.id)}';}if(typeof renderCcPage==='function')renderCcPage()">Ver tarjeta</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function getSettingsCategoryGroups(){
    if(typeof window.getCategoryGroups === 'function'){
      return window.getCategoryGroups();
    }
    const categories = window.state?.categories || [];
    const order = [];
    categories.forEach(cat => {
      const group = (cat.group || 'Sin clasificar').trim() || 'Sin clasificar';
      if(!order.includes(group)) order.push(group);
    });
    if(!order.includes('Sin clasificar')) order.push('Sin clasificar');
    return order.map(name => ({ id:name, name, emoji:'•', color:'#64748b' }));
  }

  function getSettingsCategoryGroupMeta(groupRef){
    const groupName = typeof groupRef === 'string' ? groupRef : groupRef?.name;
    const dynamicGroup = typeof window.getCategoryGroupByName === 'function' ? window.getCategoryGroupByName(groupName) : null;
    const group = dynamicGroup || (window.CATEGORY_GROUPS || []).find(item => item.group === groupName);
    return {
      id: dynamicGroup?.id || group?.id || `group-${String(groupName || 'sin-clasificar').toLowerCase()}`,
      name: dynamicGroup?.name || group?.group || groupName || 'Sin clasificar',
      emoji: group?.emoji || '•',
      color: group?.color || '#64748b'
    };
  }

  function renderSettingsCategoriesList(){
    const el = document.getElementById('settings-categories-list');
    if(!el) return;
    if(typeof window.normalizeCategoryState === 'function') window.normalizeCategoryState(window.state);
    const categories = window.state?.categories || [];
    const groups = getSettingsCategoryGroups();
    const counts = {};
    (window.state?.transactions || []).forEach(txn => {
      counts[txn.category] = (counts[txn.category] || 0) + 1;
    });
    if(!groups.length){
      el.innerHTML = `<div class="settings-empty-block">Todavía no hay grupos. Creá el primero para organizar las categorías.</div>`;
      return;
    }
    // Aunque no haya categorías cargadas, igual renderizamos los grupos
    // (cada grupo muestra su mensaje vacío individualmente y permite crear).
    el.innerHTML = groups.map(groupItem => {
      const meta = getSettingsCategoryGroupMeta(groupItem);
      const groupCategories = categories
        .filter(cat => (cat.groupId && cat.groupId === meta.id) || (cat.group || 'Sin clasificar') === meta.name)
        .sort((a,b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));
      const total = groupCategories.reduce((sum, cat) => sum + (counts[cat.name] || 0), 0);
      return `
        <details class="settings-category-group" ${meta.name === 'Sin clasificar' ? 'open' : ''}>
          <summary class="settings-category-summary">
            <div class="settings-category-summary-inner">
              <div class="settings-category-summary-main">
                <span class="settings-category-group-badge" style="background:${esc(meta.color)}22;color:${esc(meta.color)}">${esc(meta.emoji)}</span>
                <div>
                  <strong>${esc(meta.name)}</strong>
                  <small>${groupCategories.length} categoría${groupCategories.length===1?'':'s'} · ${total} movimiento${total===1?'':'s'}</small>
                </div>
              </div>
              <div class="settings-fintech-actions">
                <button class="dashboard-widget-mini" type="button" onclick="event.preventDefault();event.stopPropagation();startSettingsGroupEdit(${jsString(meta.id)})">Renombrar</button>
                <button class="dashboard-widget-mini" type="button" onclick="event.preventDefault();event.stopPropagation();startSettingsCategoryCreate(${jsString(meta.id)})">Agregar categoría</button>
              </div>
            </div>
          </summary>
          <div class="settings-category-items">
            ${groupCategories.length ? groupCategories.map(cat => `
              <div class="settings-category-item">
                <div class="settings-fintech-main">
                  <strong><span class="settings-category-dot" style="background:${esc(cat.color || '#64748b')}"></span>${esc(cat.name)}</strong>
                  <small>${counts[cat.name] || 0} movimiento${(counts[cat.name] || 0) === 1 ? '' : 's'} · ${esc(cat.group || 'Sin grupo')} · ${esc(cat.type || 'expense')}</small>
                </div>
                <div class="settings-fintech-actions">
                  <button class="dashboard-widget-mini primary" type="button" onclick="startSettingsCategoryEdit(${jsString(cat.id || cat.name)})">Editar</button>
                  <button class="dashboard-widget-mini" type="button" onclick="deleteSettingsCategory(${jsString(cat.id || cat.name)})">Eliminar</button>
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
    // Asegurar que las reglas estén pobladas (init.js seedea Santander por defecto)
    if(typeof window.ensureGmailImportRules === 'function') window.ensureGmailImportRules();
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

  // renderSettingsGoogleSection removed — Google integration now centralized in Security page only
  function renderSettingsGoogleSection(){ /* no-op: elements removed from settings HTML */ }

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
    if(source === 'upload'){
      // Si ya hay imagen, simplemente activamos el modo upload.
      if(window.state?.userAvatar){
        window.state.userAvatarMode = 'upload';
        persistProfileShell();
      } else {
        document.getElementById('profile-avatar-input')?.click();
      }
      return;
    }
    if(source === 'preset'){
      if(!window.state?.userAvatarPreset){
        window.state.userAvatarPreset = AVATAR_PRESETS[0].id;
      }
      window.state.userAvatarMode = 'preset';
      persistProfileShell();
    }
  }

  function selectPresetAvatar(id){
    window.state.userAvatarPreset = id;
    window.state.userAvatarMode = 'preset';
    // Lógica de prioridad: el avatar pasa a ser la imagen activa.
    // No borramos la foto subida (se conserva), pero el modo activo es preset.
    persistProfileShell();
    window.showToast?.('Avatar actualizado', 'success');
  }

  // Reduce imágenes grandes para evitar quota exceeded en localStorage
  function downscaleImage(dataUrl, maxSize = 384){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if(width > maxSize || height > maxSize){
          if(width >= height){
            height = Math.round(height * (maxSize / width));
            width = maxSize;
          } else {
            width = Math.round(width * (maxSize / height));
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        try{
          resolve(canvas.toDataURL('image/jpeg', 0.86));
        }catch(e){ reject(e); }
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function handleAvatarUpload(event){
    const file = event?.target?.files?.[0];
    if(!file) return;
    if(!/^image\/(png|jpe?g|webp)$/i.test(file.type)){
      window.showToast?.('Usá una imagen JPG, PNG o WebP', 'error');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async e => {
      try{
        const raw = String(e.target?.result || '');
        const compact = await downscaleImage(raw, 384);
        window.state.userAvatar = compact;
        // Lógica de prioridad: la nueva imagen pasa a ser la activa.
        window.state.userAvatarMode = 'upload';
        persistProfileShell();
        window.showToast?.('Imagen de perfil actualizada', 'success');
      } catch(err){
        console.error('avatar upload', err);
        window.showToast?.('No pude procesar la imagen', 'error');
      }
    };
    reader.onerror = () => window.showToast?.('No pude leer el archivo', 'error');
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
      const fallback = getSettingsCategoryGroupMeta('Sin clasificar');
      window.state._settingsCategoryDraft = { mode:'create', originalId:'', originalName:'', name:'', groupId:fallback.id, type:'expense', color:fallback.color };
    }
    return window.state._settingsCategoryDraft;
  }

  function ensureGroupSettingsDraft(){
    if(!window.state._settingsGroupDraft){
      window.state._settingsGroupDraft = { mode:'create', originalId:'', originalName:'', name:'', type:'expense', color:'#64748b' };
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
            ${groups.map(group => `<option value="${esc(group.id)}" ${draft.groupId===group.id?'selected':''}>${esc(group.emoji || '•')} ${esc(group.name)}</option>`).join('')}
          </select>
        </label>
        <label class="profile-field">
          <span class="profile-field-label">Tipo</span>
          <select id="settings-category-type" class="profile-field-input">
            <option value="expense" ${draft.type==='expense'?'selected':''}>Gasto</option>
            <option value="income" ${draft.type==='income'?'selected':''}>Ingreso</option>
            <option value="transfer" ${draft.type==='transfer'?'selected':''}>Transferencia</option>
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
    const fallback = getSettingsCategoryGroupMeta(groupName || 'Sin clasificar');
    window.state._settingsCategoryDraft = {
      mode:'create',
      originalId:'',
      originalName:'',
      name:'',
      groupId:fallback.id,
      type:'expense',
      color:fallback.color || '#64748b'
    };
    renderSettingsCategoryEditor();
  }

  function startSettingsCategoryEdit(categoryId){
    const category = typeof window.getCategoryById === 'function'
      ? window.getCategoryById(categoryId) || window.getCategoryByName?.(categoryId)
      : (window.state?.categories || []).find(cat => cat.name === categoryId || cat.id === categoryId);
    if(!category) return;
    window.state._settingsCategoryDraft = {
      mode:'edit',
      originalId:category.id || '',
      originalName:category.name,
      name:category.name,
      groupId:category.groupId || getSettingsCategoryGroupMeta(category.group || 'Sin clasificar').id,
      type:category.type || 'expense',
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
    const groupId = document.getElementById('settings-category-group')?.value || getSettingsCategoryGroupMeta('Sin clasificar').id;
    const type = document.getElementById('settings-category-type')?.value || 'expense';
    if(!name){
      window.showToast?.('Ingresá un nombre de categoría', 'error');
      return;
    }
    if(!groupId){
      window.showToast?.('Seleccioná un grupo', 'error');
      return;
    }
    const result = draft.mode === 'edit'
      ? window.updateCategory?.(draft.originalId || draft.originalName, { name, groupId, type, color:draft.color || '#64748b' })
      : window.createCategory?.({ name, groupId, type, color:draft.color || '#64748b' });
    if(!result?.ok){
      window.showToast?.(result?.error || 'No se pudo guardar', 'error');
      return;
    }
    cancelSettingsCategoryEditor();
    persistSettingsState('Categoría guardada', 'success');
  }

  function deleteSettingsCategory(categoryId){
    const category = typeof window.getCategoryById === 'function'
      ? window.getCategoryById(categoryId) || window.getCategoryByName?.(categoryId)
      : (window.state?.categories || []).find(cat => cat.id === categoryId || cat.name === categoryId);
    if(!category) return;
    if(!window.confirm(`¿Eliminar la categoría "${category.name}"?`)) return;
    const result = window.deleteCategory?.(category.id || category.name);
    if(!result?.ok){
      window.showToast?.(result?.error || 'No se pudo eliminar', 'error');
      return;
    }
    cancelSettingsCategoryEditor();
    persistSettingsState('Categoría eliminada', 'info');
  }

  function startSettingsGroupCreate(){
    window.state._settingsGroupDraft = { mode:'create', originalId:'', originalName:'', name:'', type:'expense', color:'#64748b' };
    renderSettingsGroupEditor();
  }

  function startSettingsGroupEdit(groupId){
    const group = typeof window.getCategoryGroupById === 'function'
      ? window.getCategoryGroupById(groupId) || window.getCategoryGroupByName?.(groupId)
      : null;
    const meta = group || getSettingsCategoryGroupMeta(groupId);
    window.state._settingsGroupDraft = { mode:'edit', originalId:meta.id, originalName:meta.name, name:meta.name, type:meta.type || 'expense', color:meta.color || '#64748b' };
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
    const result = draft.mode === 'edit'
      ? window.updateCategoryGroup?.(draft.originalId || draft.originalName, { name, color:draft.color || '#64748b', type:draft.type || 'expense' })
      : window.createCategoryGroup?.({ name, color:draft.color || '#64748b', type:draft.type || 'expense' });
    if(!result?.ok){
      window.showToast?.(result?.error || 'No se pudo guardar', 'error');
      return;
    }
    cancelSettingsGroupEditor();
    persistSettingsState('Grupo guardado', 'success');
  }

  function deleteSettingsGroup(groupId){
    const group = typeof window.getCategoryGroupById === 'function'
      ? window.getCategoryGroupById(groupId) || window.getCategoryGroupByName?.(groupId)
      : null;
    const groupName = group?.name || groupId;
    if(!groupName || groupName === 'Sin clasificar') return;
    if(!window.confirm(`¿Eliminar el grupo "${groupName}"? Las categorías pasarán a "Sin clasificar".`)) return;
    const result = window.deleteCategoryGroup?.(group?.id || groupName, 'Sin clasificar');
    if(!result?.ok){
      window.showToast?.(result?.error || 'No se pudo eliminar', 'error');
      return;
    }
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
