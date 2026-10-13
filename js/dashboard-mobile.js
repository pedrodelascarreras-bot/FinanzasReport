// ══ DASHBOARD — versión celular ══
// ── Mobile Dashboard — rendered on mobile only (max-width:768px) ──
function renderMobileDashboard(data) {
  const shell = document.getElementById('mob-dash-shell');
  if (!shell || window.innerWidth > 768) return;

  const {
    arsMonth=0, usdMonth=0, margen=0, pct=0, incTotalARS=0, spendBudget=0,
    projected=0, projPeriodClose=null, monthTxns=[], ccWidgetData={},
    dailyRate=0, totalGastoARS=0, projInfo=null
  } = data || {};
  const _projEarly = !!projInfo?.tooEarly;

  // Helpers
  const fmtN = (n) => Number(n||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const fmtAmt = (n, prefix='$') => `${prefix}${fmtN(n)}`;
  // fmtDate handles both 'YYYY-MM-DD' strings AND Date objects
  const fmtDate = (val) => {
    if (!val) return '—';
    try {
      const d = (val instanceof Date) ? val : new Date(val+'T12:00:00');
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('es-AR',{day:'2-digit',month:'short'}).replace(/\./g,'').toUpperCase();
    } catch(e){return '—';}
  };

  // Period label — reflects actual selected view (TC cycle or month)
  const today = new Date();
  const _MN=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  const _isTcView = typeof state!=='undefined' && state.dashView && state.dashView !== 'mes';
  let periodLabel;
  if (_isTcView) {
    // Get the active cycle label
    try {
      const _cycles = typeof getTcCycles==='function' ? getTcCycles() : [];
      const _actCyc = typeof _resolveDashboardTcCycle==='function' ? _resolveDashboardTcCycle(_cycles) : _cycles[0];
      periodLabel = _actCyc?.label ? ('CICLO ' + (_actCyc.label||'').toUpperCase()) : 'CICLO VISA';
    } catch(e){ periodLabel = 'CICLO VISA'; }
  } else {
    periodLabel = _MN[today.getMonth()] + ' ' + today.getFullYear();
  }

  // Promedio diario: el mismo que el dashboard de escritorio (getPeriodProjection).
  // Antes recalculaba los días con una función interna de renderDashboard que acá no existe,
  // y siempre dividía por el día del mes.
  const dailyAvg = dailyRate || 0;

  // CC Cycles
  const cycleByKey = ccWidgetData?.cycleByKey || {};
  const visaCycle = cycleByKey.visa;
  const amexCycle = cycleByKey.amex;

  const ccPct = (cycle) => {
    if (!cycle) return 0;
    try {
      const allC = getTcCycles();
      const idx = allC.findIndex(c => c.id === cycle.id);
      const open = getTcCycleOpen(allC, idx);
      if (!open) return 0;
      const openD = new Date(open+'T12:00:00');
      const closeD = new Date(cycle.closeDate+'T12:00:00');
      const total = Math.max(1,(closeD-openD)/86400000);
      const elapsed = Math.max(0,(today-openD)/86400000);
      return Math.min(100,Math.round(elapsed/total*100));
    } catch(e){return 0;}
  };

  // Top categories
  const catTotalsM = {};
  (monthTxns||[]).filter(t=>t.currency==='ARS'&&!t.isPendingCuota&&!t.isPendingSubscription).forEach(t=>{
    const k=t.category||'Sin categoría';
    catTotalsM[k]=(catTotalsM[k]||0)+(typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):(t.amount||0));
  });
  const topCats = Object.entries(catTotalsM)
    .sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([name,amount])=>({name,amount,pct:arsMonth>0?Math.round(amount/arsMonth*100):0}));

  // Projection
  const projLimitArs = spendBudget||incTotalARS||0;
  const projPct = projLimitArs>0 ? Math.min(100,Math.round((projected||0)/projLimitArs*100)) : 0;

  // Totals display
  const totalDisplay = arsMonth + (usdMonth*(USD_TO_ARS||1));
  const margenPct = incTotalARS>0 ? Math.round((margen/incTotalARS)*100) : 0;

  // Category palette & icons
  const catPalette=['#7C4DFF','#247CFF','#FF4545','#FF9500','#28E878'];
  const catIconMap={'consumos sensibles':'🛍️','alimentación':'🍔','alimentos':'🍔','supermercado':'🛒','transporte':'🚗','uber':'🚗','taxi':'🚕','combustible':'⛽','salud':'🏥','farmacia':'💊','médico':'🩺','regalos':'🎁','sin clasificar':'📦','ocio':'🎬','entretenimiento':'🎮','servicios':'💡','educación':'📚','tecnología':'💻','ropa':'👕','restaurant':'🍽️','comida':'🍕','viajes':'✈️','hogar':'🏠','suscripciones':'📱','seguros':'🛡️'};
  const getCatIcon = (name) => {
    const k=(name||'').toLowerCase();
    for(const[kw,icon] of Object.entries(catIconMap)){if(k.includes(kw))return icon;}
    return '📦';
  };

  shell.innerHTML = `
    <div class="mob-dash-header">
      <button class="mob-dash-hamburger" onclick="openMobDrawer()" aria-label="Menú">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <img class="mob-brand-logo-img" src="brand/fluxen-logo.png" alt="Fluxen" onclick="nav('dashboard')" style="cursor:pointer">
      <div class="mob-dash-hdr-right"></div>
    </div>

    <button class="mob-dash-period" onclick="openMobPeriodPicker()" aria-label="Cambiar período">
      <span>${periodLabel}</span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
    </button>

    <div class="mob-main-card" onclick="nav('transactions')" style="cursor:pointer">
      <div class="mob-main-card-top">
        <div class="mob-main-icon-row">
          <div class="mob-main-icon-sq">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="13" rx="3"/><path d="M2.5 10.5h19"/></svg>
          </div>
          <span class="mob-main-kicker">GASTO PERSONAL</span>
        </div>
        <button class="mob-main-eye" onclick="event.stopPropagation();toggleHeroPrivacy()" title="Ocultar montos">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
      <div class="mob-main-amount" id="mob-main-amount">${fmtAmt(totalDisplay)}</div>
      ${pct>0?`<div class="mob-main-budget-badge">${pct}% del presupuesto</div>`:''}
      <div class="mob-main-curve-wrap" aria-hidden="true">
        <svg class="mob-main-curve-svg" viewBox="0 0 160 70" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 50 C40 50 60 15 100 25 S140 8 160 18" stroke="rgba(124,77,255,0.55)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <path d="M0 58 C40 58 60 23 100 33 S140 16 160 26" stroke="rgba(124,77,255,0.2)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <circle cx="160" cy="18" r="4" fill="#7C4DFF" opacity="0.8"/>
        </svg>
      </div>
      <div class="mob-main-rows">
        <div class="mob-main-row" onclick="event.stopPropagation();nav('transactions')">
          <div class="mob-row-icon-sq" style="background:rgba(124,77,255,0.15);color:#7C4DFF;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/></svg>
          </div>
          <span class="mob-row-label">Total en ARS</span>
          <span class="mob-row-val">${fmtAmt(arsMonth)}</span>
          <svg class="mob-row-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="mob-row-sep"></div>
        <div class="mob-main-row" onclick="event.stopPropagation();nav('transactions')">
          <div class="mob-row-icon-sq" style="background:rgba(36,124,255,0.15);color:#247CFF;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M9.5 9.5h4a2 2 0 1 1 0 4h-3a2 2 0 1 0 0 4h4"/></svg>
          </div>
          <span class="mob-row-label">Total en USD</span>
          <span class="mob-row-val">${usdMonth>0?fmtAmt(usdMonth,'U$D '):'USD 0,00'}</span>
          <svg class="mob-row-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="mob-row-sep"></div>
        <div class="mob-main-row" onclick="event.stopPropagation();nav('income')">
          <div class="mob-row-icon-sq" style="background:rgba(40,232,120,0.15);color:#28E878;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7h-1a2 2 0 0 0-2 2v1H8.5A2.5 2.5 0 0 0 6 12.5v4A2.5 2.5 0 0 0 8.5 19H17a3 3 0 0 0 3-3V9a2 2 0 0 0-2-2Z"/><path d="M16 12h4"/><path d="M6 10V8a3 3 0 0 1 3-3h7"/></svg>
          </div>
          <span class="mob-row-label">Margen disponible</span>
          <span class="mob-row-val" style="color:#28E878;">${fmtAmt(margen)}</span>
          ${margenPct>0?`<span class="mob-margen-badge">${margenPct}% del presupuesto</span>`:''}
          <svg class="mob-row-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>
    </div>

    <div class="mob-section-card">
      <div class="mob-sec-hd">
        <span class="mob-sec-title">CICLO DE TARJETAS</span>
      </div>
      <div class="mob-cc-grid">
        <div class="mob-cc-item mob-cc-visa-item">
          <div class="mob-cc-brand-label">VISA</div>
          <div class="mob-cc-date-pair">
            <div class="mob-cc-dp"><span class="mob-cc-dl">Cierre</span><strong class="mob-cc-dv">${fmtDate(visaCycle?.closeDate)}</strong></div>
            <div class="mob-cc-dp"><span class="mob-cc-dl">Vence</span><strong class="mob-cc-dv">${fmtDate(visaCycle?.dueDate)}</strong></div>
          </div>
          <div class="mob-cc-bar-track"><div class="mob-cc-bar-fill mob-cc-bar-visa" style="width:${ccPct(visaCycle)}%"></div></div>
        </div>
        <div class="mob-cc-item mob-cc-amex-item">
          <div class="mob-cc-brand-label mob-cc-brand-amex">AMEX</div>
          <div class="mob-cc-date-pair">
            <div class="mob-cc-dp"><span class="mob-cc-dl">Cierre</span><strong class="mob-cc-dv">${fmtDate(amexCycle?.closeDate)}</strong></div>
            <div class="mob-cc-dp"><span class="mob-cc-dl">Vence</span><strong class="mob-cc-dv">${fmtDate(amexCycle?.dueDate)}</strong></div>
          </div>
          <div class="mob-cc-bar-track"><div class="mob-cc-bar-fill mob-cc-bar-amex" style="width:${ccPct(amexCycle)}%"></div></div>
        </div>
      </div>
    </div>

    ${projected>0?`
    <div class="mob-section-card mob-proj-card">
      <div class="mob-proj-body">
        <div class="mob-proj-left">
          <div class="mob-proj-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16 10 10l4 4 6-8"/><path d="M20 6v4h-4"/></svg>
          </div>
          <div class="mob-proj-info">
            <div class="mob-proj-kicker">PROYECCIÓN A CIERRE</div>
            ${_projEarly
              ? `<div class="mob-proj-amount" style="font-size:18px !important;color:#9AA3B8 !important;">Muy temprano para proyectar</div>
            <div class="mob-proj-sub">Llevás ${projInfo.daysElapsed} día${projInfo.daysElapsed!==1?'s':''} · Seguro hasta ahora: <strong>${fmtAmt(projInfo.secureTotal)}</strong></div>
            <div class="mob-proj-sub">Se calcula a partir del día ${projInfo.minDays}</div>`
              : `<div class="mob-proj-amount">${fmtAmt(projected)}</div>
            <div class="mob-proj-sub">Estimación activa hasta ${fmtDate(projPeriodClose)}</div>
            ${dailyAvg>0?`<div class="mob-proj-daily">Promedio diario: <strong>${fmtAmt(Math.round(dailyAvg))}</strong></div>`:''}`}
          </div>
        </div>
        ${_projEarly?'':'<span class="mob-proj-badge">Según tu ritmo actual</span>'}
      </div>
      <div class="mob-proj-bar-row">
        <div class="mob-proj-bar-track"><div class="mob-proj-bar-fill" style="width:${projPct}%"></div></div>
        <span class="mob-proj-pct">${projPct}% del límite</span>
      </div>
    </div>`:''}

    ${topCats.length>0?`
    <div class="mob-section-card mob-cats-card">
      <div class="mob-sec-hd">
        <span class="mob-sec-title">CATEGORÍAS DEL MES</span>
        <button class="mob-sec-link" onclick="nav('tendencia')">Ver detalle →</button>
      </div>
      <div class="mob-cats-list">
        ${topCats.map((cat,i)=>`
          <div class="mob-cat-row">
            <div class="mob-cat-icon" style="background:${catPalette[i]}22;color:${catPalette[i]};">${getCatIcon(cat.name)}</div>
            <div class="mob-cat-body">
              <div class="mob-cat-top">
                <span class="mob-cat-name">${cat.name}</span>
                <span class="mob-cat-amt">${fmtAmt(cat.amount)}</span>
                <span class="mob-cat-pct">${cat.pct}%</span>
              </div>
              <div class="mob-cat-bar-track"><div class="mob-cat-bar-fill" style="width:${cat.pct}%;background:${catPalette[i]};"></div></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`:''}

    ${(()=>{
      // Gastos Compartidos widget
      const _gcTxns=(typeof state!=='undefined'&&state.transactions?state.transactions:[]).filter(t=>t.sharedExpense&&t.sharedExpense.enabled);
      if(!_gcTxns.length) return '';
      const _gcSummary=typeof getSharedExpenseSummary==='function'?getSharedExpenseSummary(_gcTxns):[];
      // Solo pendientes: los gastos ya cobrados no figuran en móvil.
      const _gcPending=_gcSummary.filter(p=>p.count>0);
      if(!_gcPending.length) return '';
      const _gcTotalPendingArs=_gcPending.reduce((s,p)=>s+p.pendingArs,0);
      const _gcEsc=(s)=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      // Guardamos los pendientes para que el botón "Cobré" sepa a quién marcar.
      window._mobGcPending = _gcPending;
      return `
        <div class="mob-section-card mob-gc-card">
          <div class="mob-sec-hd">
            <span class="mob-sec-title">GASTOS COMPARTIDOS</span>
            ${_gcTotalPendingArs>0?`<span class="mob-gc-pending-total">$${fmtN(Math.round(_gcTotalPendingArs))} pendiente</span>`:''}
          </div>
          <div class="mob-gc-list">
            ${_gcPending.slice(0,6).map((p,i)=>`
              <div class="mob-gc-person-row">
                <div class="mob-gc-avatar">${_gcEsc(p.name.slice(0,2).toUpperCase())}</div>
                <div class="mob-gc-info">
                  <div class="mob-gc-name">${_gcEsc(p.name)}</div>
                  <div class="mob-gc-meta">${p.count+' gasto'+(p.count!==1?'s':'')}</div>
                </div>
                <div class="mob-gc-right">
                  <div class="mob-gc-amount pending">${p.pendingArs>0?'$'+fmtN(Math.round(p.pendingArs)):'Pendiente'}</div>
                  <button class="mob-gc-cobrar-btn" onclick="event.stopPropagation();mobGcCobrar(${i})">✓ Cobré</button>
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    })()}

    ${(monthTxns||[]).length === 0 ? `
    <div class="mob-connect-cta">
      <div class="mob-connect-icon">☁️</div>
      <div class="mob-connect-copy">
        <div class="mob-connect-title">Conectá tus datos</div>
        <div class="mob-connect-sub">Importá CSV o conectá Google Drive para ver tus finanzas aquí.</div>
      </div>
      <button class="mob-connect-btn" onclick="openCloudSync(event)">Conectar</button>
    </div>` : ''}

    <div style="height:32px"></div>
  `;
}

// Botón "✓ Cobré" de la tarjeta de gastos compartidos del móvil: marca como
// cobrados todos los gastos pendientes de esa persona y refresca la vista.
function mobGcCobrar(i){
  const p = (window._mobGcPending || [])[i];
  if (p && typeof gcMarkPersonCobrado === 'function') gcMarkPersonCobrado(p.name);
}
