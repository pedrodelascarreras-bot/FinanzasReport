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
    _bindDepth(el);

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

    _unbindDepth(el);
    el.classList.add('leaving','cinematic-exit');
    setTimeout(()=>{
      el.style.display = 'none';
      el.classList.remove('visible','leaving','cinematic-exit');
      _resetDepth(el);
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
        const card  = (state.ccCards||[]).find(c=>c.id===cyc.cardId);
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
    const incomeSnap = typeof getIncomeSnapshot==='function' ? getIncomeSnapshot(curMK) : {total:0};
    const spendPct = incomeSnap.total>0 ? Math.round(curTotal/incomeSnap.total*100) : null;
    const monthDays = new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
    const projected = Math.round((curTotal/Math.max(today.getDate(),1))*monthDays);
    const projectedGap = incomeSnap.total>0 ? projected-incomeSnap.total : null;
    const topPct = topEntry && curTotal>0 ? Math.round(topEntry[1]/curTotal*100) : 0;
    const milestone = typeof getUpcomingCardMilestone==='function' ? getUpcomingCardMilestone(today) : null;
    const aiSummary = typeof fallbackInsights==='function'
      ? fallbackInsights({
          mes: hasCycles ? 'Ciclo actual' : curMK,
          total_ars: curTotal,
          total_usd: 0,
          income_ars: incomeSnap.total||0,
          spending_pct: spendPct,
          categories: topEntry ? [{name:topEntry[0],amount:topEntry[1],pct:topPct}] : [],
          txn_count: curTxns.length,
          alert_threshold: state.alertThreshold
        })
      : [];
    const aiLead = aiSummary[0] || null;
    const cycleLabel = hasCycles ? 'CICLO ACTUAL' : 'ESTE MES';
    const exposureTone = spendPct!==null && spendPct>=state.alertThreshold ? 'Tensión alta' : 'Ritmo controlado';
    const commitmentPreview = typeof detectAutoCuotas==='function'
      ? ((detectAutoCuotas().length||0) + (state.subscriptions||[]).length + ((state.fixedExpenses||[]).length||0))
      : ((state.subscriptions||[]).length + ((state.fixedExpenses||[]).length||0));

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
        <div class="sp-scene">
          <div class="sp-content-shell fade-in">
            <div class="sp-pre-header">
              <div class="sp-pre-greeting">${greeting}, ${state.userName || 'Pedro'}</div>
              <div class="sp-pre-date">${dateStr}</div>
              ${lastVisitStr ? `<div class="sp-pre-last-visit">${lastVisitStr}</div>` : ''}
            </div>

            <div class="sp-pre-main">
               <div class="sp-pre-label fade-in d1">${cycleLabel}</div>
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
                  <div class="sp-pre-item-icon">${typeof renderUiGlyph==='function'?renderUiGlyph('spark'):'◔'}</div>
                  <div class="sp-pre-item-label">Palanca principal</div>
                  <div class="sp-pre-item-val">${topEntry[0]} · ${topPct}% del gasto</div>
                </div>
              ` : ''}
              ${milestone ? `
                <div class="sp-pre-item">
                  <div class="sp-pre-item-icon">${typeof renderUiGlyph==='function'?renderUiGlyph(milestone.type==='due'?'alert':'calendar'):'◎'}</div>
                  <div class="sp-pre-item-label">Próximo hito</div>
                  <div class="sp-pre-item-val">${milestone.label} · ${milestone.days===0?'hoy':'en '+milestone.days+' días'}</div>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="sp-hero-stack" aria-hidden="true">
            <div class="sp-stage-card sp-stage-card-primary fade-in d2">
              <div class="sp-stage-kicker">Resumen ejecutivo</div>
              <div class="sp-stage-value">$${fmtN(curTotal)}</div>
              <div class="sp-stage-sub">${cycleLabel.toLowerCase()} · ${exposureTone}</div>
            </div>
            <div class="sp-stage-card sp-stage-card-secondary fade-in d3">
              <div class="sp-stage-mini-row">
                <span class="sp-stage-mini-label">Dólar oficial</span>
                <span class="sp-stage-mini-value">$${fmtN(state.usdRate||USD_TO_ARS||1420)}</span>
              </div>
              <div class="sp-stage-mini-row">
                <span class="sp-stage-mini-label">Compromisos</span>
                <span class="sp-stage-mini-value">${commitmentPreview}</span>
              </div>
            </div>
            <div class="sp-stage-card sp-stage-card-tertiary fade-in d4">
              <div class="sp-stage-kicker">Motor IA</div>
              <div class="sp-stage-quote">${aiLead ? esc(aiLead.headline) : 'Briefing listo para entrar.'}</div>
            </div>
          </div>
        </div>

        <div class="sp-brief-grid fade-in d4">
          <div class="sp-brief-card">
            <div class="sp-brief-head">
              <span class="sp-brief-kicker">Prioridad del día</span>
              <span class="sp-brief-icon">${typeof renderUiGlyph==='function'?renderUiGlyph('focus'):'◎'}</span>
            </div>
            <div class="sp-brief-title">${spendPct!==null&&spendPct>=state.alertThreshold?'Bajá el gasto discrecional':'Mantené el ritmo bajo control'}</div>
            <div class="sp-brief-body">${spendPct===null?'Cargar ingresos te va a dar una lectura mucho más precisa del período.':spendPct>=state.alertThreshold?`Ya usaste ${spendPct}% del ingreso estimado. Cada compra variable pesa más en el cierre.`:`Vas usando ${spendPct}% del ingreso estimado. Seguís con margen para cerrar el período bien.`}</div>
          </div>
          <div class="sp-brief-card">
            <div class="sp-brief-head">
              <span class="sp-brief-kicker">Radar de riesgo</span>
              <span class="sp-brief-icon">${typeof renderUiGlyph==='function'?renderUiGlyph(projectedGap!==null&&projectedGap>0?'alert':'safe'):'◔'}</span>
            </div>
            <div class="sp-brief-title">${projectedGap!==null&&projectedGap>0?'La proyección exige ajuste':'La proyección sigue razonable'}</div>
            <div class="sp-brief-body">${projectedGap===null?'Con ingresos configurados, este radar te va a mostrar el desvío proyectado al cierre.':projectedGap>0?`Al ritmo actual, el período podría cerrar con un exceso estimado de $${fmtN(Math.round(projectedGap))}.`:`Si sostenés este ritmo, el cierre seguiría dentro del ingreso estimado.`}</div>
          </div>
          <div class="sp-brief-card">
            <div class="sp-brief-head">
              <span class="sp-brief-kicker">Lectura asistida</span>
              <span class="sp-brief-icon">${typeof renderUiGlyph==='function'?renderUiGlyph('ai'):'◫'}</span>
            </div>
            <div class="sp-brief-title">${aiLead ? esc(aiLead.headline) : 'Tu briefing inteligente está listo'}</div>
            <div class="sp-brief-body">${aiLead ? aiLead.body : 'A medida que cargues más contexto, esta portada va a priorizar señales, próximos hitos y acciones concretas.'}</div>
          </div>
        </div>

      </div>
    `;
    }
  }

  function _bindDepth(el){
    const shell = el.querySelector('.sp-inner');
    if(!shell) return;
    _unbindDepth(el);
    const move = evt => {
      const point = evt.touches ? evt.touches[0] : evt;
      const rect = el.getBoundingClientRect();
      const px = ((point.clientX - rect.left) / rect.width) - 0.5;
      const py = ((point.clientY - rect.top) / rect.height) - 0.5;
      shell.style.setProperty('--sp-tilt-x', `${(-py * 9).toFixed(2)}deg`);
      shell.style.setProperty('--sp-tilt-y', `${(px * 12).toFixed(2)}deg`);
      shell.style.setProperty('--sp-shift-x', `${(px * 28).toFixed(2)}px`);
      shell.style.setProperty('--sp-shift-y', `${(py * 22).toFixed(2)}px`);
      shell.style.setProperty('--sp-glow-x', `${50 + px * 18}%`);
      shell.style.setProperty('--sp-glow-y', `${28 + py * 16}%`);
    };
    const leave = () => _resetDepth(el);
    el.addEventListener('mousemove', move);
    el.addEventListener('touchmove', move, { passive:true });
    el.addEventListener('mouseleave', leave);
    el.addEventListener('touchend', leave);
    el._spMove = move;
    el._spLeave = leave;
  }

  function _unbindDepth(el){
    if(el._spMove){
      el.removeEventListener('mousemove', el._spMove);
      el.removeEventListener('touchmove', el._spMove);
      el._spMove = null;
    }
    if(el._spLeave){
      el.removeEventListener('mouseleave', el._spLeave);
      el.removeEventListener('touchend', el._spLeave);
      el._spLeave = null;
    }
  }

  function _resetDepth(el){
    const shell = el?.querySelector('.sp-inner');
    if(!shell) return;
    shell.style.setProperty('--sp-tilt-x','0deg');
    shell.style.setProperty('--sp-tilt-y','0deg');
    shell.style.setProperty('--sp-shift-x','0px');
    shell.style.setProperty('--sp-shift-y','0px');
    shell.style.setProperty('--sp-glow-x','50%');
    shell.style.setProperty('--sp-glow-y','28%');
  }

  // ── Expose globals ──
  window.initSplash   = initSplash;
  window.dismissSplash = dismissSplash;

})();
