// ══ DAILY BRIEFING SPLASH ══
// Shows once per calendar day, only when there is data.
// Dismissed by button, Enter/Space/Escape, or auto after 8s.

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
    const isMobileSimple = window.innerWidth <= 768;
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
    let projected = curTotal;
    if (hasCycles && activeCycles.length > 0) {
      const primaryCycle = [...activeCycles].sort((a, b) => a.cyc.closeDate.localeCompare(b.cyc.closeDate))[0];
      const openStr = typeof getTcCycleOpen === 'function' ? getTcCycleOpen(allCyc, primaryCycle.idx) : null;
      const openDate = openStr ? new Date(openStr + 'T12:00:00') : today;
      const closeDate = new Date(primaryCycle.cyc.closeDate + 'T12:00:00');
      const totalDays = Math.max(1, Math.round((closeDate - openDate) / 86400000) + 1);
      const daysElapsed = Math.max(1, Math.min(totalDays, Math.round((today - openDate) / 86400000) + 1));
      const dailyRate = curTotal / daysElapsed;
      projected = Math.round(dailyRate * totalDays);
    } else {
      const monthDays = new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
      projected = Math.round((curTotal/Math.max(today.getDate(),1))*monthDays);
    }
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
    const connectedNow = typeof isGoogleConnected === 'function' && isGoogleConnected();

    // ── Strings ──
    const DAYS   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
                    'septiembre','octubre','noviembre','diciembre'];
    // ── Greet & Last Visit ──
    const h = today.getHours();
    const greeting = h<12 ? 'Buenos días' : h<20 ? 'Buenas tardes' : 'Buenas noches';
    const dateStr  = DAYS[today.getDay()]+' · '+today.getDate()+' de '+MONTHS[today.getMonth()]+' '+today.getFullYear();
    const nextCloseAlert=ccAlerts[0]||null;
    const closeCopy=nextCloseAlert
      ?(nextCloseAlert.days<=0
        ? `Tu tarjeta cierra hoy.`
        : nextCloseAlert.days===1
          ? `Falta 1 día para que cierre tu tarjeta.`
          : `Faltan ${nextCloseAlert.days} días para que cierre tu tarjeta.`)
      :'Agregá el cierre de tu tarjeta para verlo acá.';
    
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
      if(isMobileSimple){
        content.innerHTML = `
        <div class="sp-mobile-simple fade-in">
          <div class="sp-mobile-card">
            <div class="sp-mobile-kicker">Finanzas</div>
            <div class="sp-mobile-title">${greeting}, ${state.userName || 'Pedro'}</div>
            <div class="sp-mobile-sub">${dateStr}</div>
            <div class="sp-mobile-auth-body">${closeCopy}</div>
            <div class="sp-mobile-auth-copy">
              <div class="sp-mobile-auth-title">${connectedNow?'Google conectado':'Conectá Google'}</div>
              <div class="sp-mobile-auth-body" id="sp-google-gate-inline">
                ${connectedNow?'Tu cuenta ya está lista para seguir con tus datos sincronizados.':'Para entrar a la app y ver tus datos sincronizados, iniciá sesión con Google.'}
              </div>
            </div>
            <button class="sp-cta sp-mobile-cta" id="splash-primary-cta" onclick="handleSplashPrimaryAction(event)">${connectedNow?'Continuar &nbsp;→':'Iniciar sesión con Google &nbsp;→'}</button>
          </div>
        </div>
        `;
        return;
      }
      content.innerHTML = `
      <div class="sp-simple-home fade-in">
        <div class="sp-simple-hero">
          <div class="sp-simple-kicker">Inicio de hoy</div>
          <div class="sp-simple-title">${greeting}, ${state.userName || 'Pedro'}</div>
          <div class="sp-simple-date">${dateStr}</div>
          <div class="sp-simple-close">${closeCopy}</div>
        </div>
        <div class="sp-auth-strip fade-in d2">
          <div class="sp-auth-strip-copy">
            <div class="sp-auth-strip-kicker">Google</div>
            <div class="sp-auth-strip-title">${connectedNow?'Google ya está conectado':'Conectá Google para entrar a tu app'}</div>
            <div class="sp-auth-strip-body" id="sp-google-gate-inline">${connectedNow?'Tu cuenta ya está lista para seguir con tus datos sincronizados.':'Conectá tu cuenta para ver tus datos sincronizados y seguir al dashboard.'}</div>
          </div>
          <button class="sp-cta sp-auth-strip-btn" id="splash-primary-cta" onclick="handleSplashPrimaryAction(event)">${connectedNow?'Continuar &nbsp;→':'Iniciar sesión con Google &nbsp;→'}</button>
        </div>
      </div>
    `;
    }
  }

  function refreshSplashGoogleState(autoDismiss){
    const cta = document.getElementById('splash-primary-cta');
    const content = document.getElementById('sp-content');
    const connected = typeof isGoogleConnected === 'function' && isGoogleConnected();

    if(cta){
      cta.innerHTML = connected ? 'Continuar &nbsp;→' : 'Iniciar sesión con Google &nbsp;→';
    }

    if(content){
      const gate = document.getElementById('sp-google-gate-inline');
      if(!gate) return;
      gate.innerHTML = connected
        ? 'Google conectado. Ya podés entrar a la app con tus datos sincronizados.'
        : 'Para entrar a la app y ver tus datos sincronizados, iniciá sesión con Google desde este panel.';
      gate.className = connected ? 'sp-auth-strip-body ok' : 'sp-auth-strip-body warn';
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
