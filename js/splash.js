// ══ DAILY BRIEFING SPLASH ══
// Shows once per calendar day, only when there is data.
// Dismissed by button, Enter/Space/Escape, or auto after 8s.

(function(){

  // ── Entry point ──────────────────────────────────────────
  function initSplash(){
    if(!state.transactions||!state.transactions.length) return;

    const el = document.getElementById('splash');
    if(!el) return;

    _buildContent();

    el.style.display = 'flex';
    requestAnimationFrame(()=> requestAnimationFrame(()=> el.classList.add('visible')));

    // Ensure the CTA button is clickable
    const cta = el.querySelector('.sp-cta');
    if(cta) {
      cta.onclick = (e) => {
        dismissSplash();
      };
    }

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

    // ── CC cycle spending (User request) ──
    const allCyc = typeof getTcCycles === 'function' ? getTcCycles() : [];
    let curTotal = 0;
    let prevTotal = 0;
    let hasCycles = false;
    let curTxns = [];

    if (allCyc.length > 0) {
      const activeCycles = [];
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

          // Previous cycle for comparison
          const prevCyc = allCyc.slice().reverse().find(c => c.cardId === cyc.cardId && c.closeDate < cyc.closeDate);
          if (prevCyc) {
            const pTxns = typeof getTcCycleTxns === 'function' ? getTcCycleTxns(prevCyc, allCyc) : [];
            prevTotal += pTxns.filter(t => t.currency === 'ARS' && t.amount > 0).reduce((s, t) => s + t.amount, 0);
          }
        });
      }
    }

    // Fallback if no active cycles: use monthly
    if (!hasCycles) {
      const _mk = t => t.month || getMonthKey(t.date);
      curTxns = state.transactions.filter(t => _mk(t) === curMK && t.currency === 'ARS' && t.amount > 0 && !t.isPendingCuota);
      const prevTxns = state.transactions.filter(t => _mk(t) === prevMK && t.currency === 'ARS' && t.amount > 0 && !t.isPendingCuota);
      curTotal = curTxns.reduce((s, t) => s + t.amount, 0);
      prevTotal = prevTxns.reduce((s, t) => s + t.amount, 0);
    }
    const delta = prevTotal > 0 ? (curTotal - prevTotal) / prevTotal * 100 : null;

    // ── CC cycle alerts ──
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
    // ── Greet & Last Visit ──
    const h = today.getHours();
    const greeting = h<12 ? 'Buen día' : h<20 ? 'Buenas tardes' : 'Buenas noches';
    const dateStr  = DAYS[today.getDay()]+' · '+today.getDate()+' de '+MONTHS[today.getMonth()]+' '+today.getFullYear();
    
    // Capture and update last visit
    const lastVisitVal = state.lastVisit;
    state.lastVisit = new Date().toISOString();
    saveState();

    let lastVisitStr = '';
    if(lastVisitVal) {
      const lv = new Date(lastVisitVal);
      lastVisitStr = `Tu última visita fue el ${lv.toLocaleDateString('es-AR')} a las ${lv.getHours()}:${String(lv.getMinutes()).padStart(2,'0')}`;
    }

    // ── Inject ──
    const content = document.getElementById('sp-content');
    if(content){
      content.innerHTML = `
      <div class="sp-presentation">
        <div class="sp-pre-header fade-in">
          <div class="sp-pre-greeting">${greeting}, ${state.userName || 'Pedro'}</div>
          <div class="sp-pre-date">${dateStr}</div>
          ${lastVisitStr ? `<div class="sp-pre-last-visit" style="font-size:10px;opacity:0.6;margin-top:4px;font-weight:500;">${lastVisitStr}</div>` : ''}
        </div>

        <div class="sp-pre-main">
           <div class="sp-pre-label fade-in d1">${hasCycles ? 'CICLO ACTUAL' : 'ESTE MES'}</div>
           <div class="sp-pre-amount-wrap fade-in d2">
              <span class="sp-pre-sym">$</span><span class="sp-pre-amount">${fmtN(curTotal)}</span>
           </div>
           ${delta !== null ? `
             <div class="sp-pre-delta ${delta > 0 ? 'up' : 'down'} fade-in d3">
               ${delta > 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}% <span>vs anterior</span>
             </div>
           ` : ''}
        </div>

        <div class="sp-pre-grid fade-in d4">
          ${topEntry ? `
            <div class="sp-pre-item">
              <div class="sp-pre-item-icon">${topEmoji}</div>
              <div class="sp-pre-item-label">Top Categoría</div>
              <div class="sp-pre-item-val">${topEntry[0]}</div>
            </div>
          ` : ''}
          ${ccAlerts.length > 0 ? `
            <div class="sp-pre-item">
              <div class="sp-pre-item-icon">💳</div>
              <div class="sp-pre-item-label">Próximo Cierre</div>
              <div class="sp-pre-item-val">${ccAlerts[0].name} (${ccAlerts[0].days}d)</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    }
  }

  // ── Expose globals ──
  window.initSplash   = initSplash;
  window.dismissSplash = dismissSplash;

})();
