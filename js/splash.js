// ══ DAILY BRIEFING SPLASH ══
// Shows once per calendar day, only when there is data.
// Dismissed by button, Enter/Space/Escape, or auto after 8s.

(function(){

  // ── Entry point ──────────────────────────────────────────
  function initSplash(){
    if(!state.transactions||!state.transactions.length) return;

    const today = new Date().toISOString().slice(0,10);
    if(localStorage.getItem('fin_splash_last') === today) return;

    const el = document.getElementById('splash');
    if(!el) return;

    _buildContent();

    el.style.display = 'flex';
    requestAnimationFrame(()=> requestAnimationFrame(()=> el.classList.add('visible')));

    _startCountdown(el);

    const _kd = e => {
      if(['Enter','Escape',' '].includes(e.key)){
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

    localStorage.setItem('fin_splash_last', new Date().toISOString().slice(0,10));

    if(el._interval) clearInterval(el._interval);
    if(el._kd)       document.removeEventListener('keydown', el._kd);

    el.classList.add('leaving');
    setTimeout(()=>{
      el.style.display = 'none';
      el.classList.remove('visible','leaving');
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
    const today    = new Date();
    const todayStr = today.toISOString().slice(0,10);

    const curMK  = today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0');
    const pmDate = new Date(today.getFullYear(), today.getMonth()-1, 1);
    const prevMK = pmDate.getFullYear()+'-'+String(pmDate.getMonth()+1).padStart(2,'0');

    // ── Month spending ──
    const _mk = t => t.month || getMonthKey(t.date);
    const curTxns  = state.transactions.filter(t=> _mk(t)===curMK  && t.currency==='ARS' && t.amount>0 && !t.isPendingCuota);
    const prevTxns = state.transactions.filter(t=> _mk(t)===prevMK && t.currency==='ARS' && t.amount>0 && !t.isPendingCuota);
    const curTotal  = curTxns.reduce((s,t)=>s+t.amount, 0);
    const prevTotal = prevTxns.reduce((s,t)=>s+t.amount, 0);
    const delta     = prevTotal > 0 ? (curTotal - prevTotal) / prevTotal * 100 : null;

    // ── CC cycle alerts ──
    const allCyc   = typeof getTcCycles === 'function' ? getTcCycles() : [];
    const ccAlerts = [];
    allCyc.forEach((cyc, i)=>{
      const op = typeof getTcCycleOpen === 'function' ? getTcCycleOpen(allCyc, i) : null;
      if(!op) return;
      if(todayStr >= op && todayStr <= cyc.closeDate){
        const card  = (state.creditCards||[]).find(c=>c.id===cyc.cardId);
        const close = new Date(cyc.closeDate+'T12:00:00');
        const days  = Math.round((close - today) / 86400000);
        ccAlerts.push({ name: card?.name || cyc.label || 'Tarjeta', days });
      }
    });
    ccAlerts.sort((a,b)=> a.days - b.days);

    // ── Top category ──
    const catTotals = {};
    curTxns.forEach(t=>{
      const g = typeof catGroup === 'function' ? catGroup(t.category) : (t.category||'Otros');
      catTotals[g] = (catTotals[g]||0) + t.amount;
    });
    const topEntry = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
    const topGrp   = topEntry ? (CATEGORY_GROUPS||[]).find(g=>g.group===topEntry[0]) : null;
    const topEmoji = topGrp?.emoji || '📊';

    // ── Strings ──
    const DAYS   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
                    'septiembre','octubre','noviembre','diciembre'];
    const h = today.getHours();
    const greeting = h<12 ? 'Buen día' : h<20 ? 'Buenas tardes' : 'Buenas noches';
    const dateStr  = DAYS[today.getDay()]+' · '+today.getDate()+' de '+MONTHS[today.getMonth()]+' '+today.getFullYear();

    // ── Delta display ──
    const hasCur   = curTotal > 0;
    const deltaAbs = delta !== null ? Math.abs(Math.round(delta)) : null;
    const deltaUp  = delta !== null && delta > 0;
    const deltaClr = delta === null ? 'rgba(255,255,255,0.4)' : deltaUp ? '#FF9F0A' : '#34C759';
    const deltaArrow = delta === null ? '' : deltaUp ? '↑ ' : '↓ ';
    const deltaLbl   = delta === null
      ? 'primer mes registrado'
      : `${deltaArrow}${deltaAbs}% vs ${MONTHS[pmDate.getMonth()]}`;

    // ── CC badges HTML ──
    let ccHtml = '';
    if(ccAlerts.length){
      const badges = ccAlerts.map(a=>{
        const clr  = a.days <= 3 ? '#FF453A' : a.days <= 7 ? '#FF9F0A' : '#34C759';
        const icon = a.days <= 3 ? '🔴' : a.days <= 7 ? '🟡' : '🟢';
        const lbl  = a.days <= 0 ? 'cierra hoy' : `en ${a.days} día${a.days!==1?'s':''}`;
        return `<div class="sp-cc-badge">
          <span class="sp-cc-icon">${icon}</span>
          <span class="sp-cc-name">${a.name}</span>
          <span class="sp-cc-days" style="color:${clr};">${lbl}</span>
        </div>`;
      }).join('');
      ccHtml = `
        <div class="sp-section-label">CIERRES DE TARJETA</div>
        <div class="sp-cc-row">${badges}</div>`;
    }

    // ── Top category chip ──
    let catHtml = '';
    if(topEntry && hasCur){
      const pct = Math.round(topEntry[1] / curTotal * 100);
      catHtml = `
        <div class="sp-section-label">DESTACADO</div>
        <div class="sp-cat-chip">
          <span class="sp-cat-emoji">${topEmoji}</span>
          <span><strong>${topEntry[0]}</strong> concentra el ${pct}% de tu gasto este mes · <span style="opacity:.65;">$${fmtN(topEntry[1])}</span></span>
        </div>`;
    }

    // ── Month card ──
    const monthCard = hasCur
      ? `<div class="sp-main-card">
          <div class="sp-card-lbl">GASTO · ${MONTHS[today.getMonth()].toUpperCase()}</div>
          <div class="sp-card-amount">$${fmtN(curTotal)}</div>
          <div class="sp-card-delta" style="color:${deltaClr};">${deltaLbl}</div>
        </div>`
      : `<div class="sp-main-card sp-no-data">
          <div class="sp-card-lbl">SIN MOVIMIENTOS ESTE MES</div>
          <div class="sp-card-sub">Importá tus gastos para ver el resumen diario</div>
        </div>`;

    // ── Inject ──
    const content = document.getElementById('sp-content');
    if(content){
      content.innerHTML = `
        <div class="sp-date">${dateStr}</div>
        <div class="sp-greeting">${greeting} 👋</div>
        ${monthCard}
        ${ccHtml}
        ${catHtml}
      `;
    }
  }

  // ── Expose globals ──
  window.initSplash   = initSplash;
  window.dismissSplash = dismissSplash;

})();
