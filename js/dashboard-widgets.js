// ══ DASHBOARD — widgets (tarjetas, proyección, evolución, categorías, agenda, cobros, dólar) ══
/* ═══════════════════════════════════════════════════════════
   DB2 DASHBOARD — new widget renderers
═══════════════════════════════════════════════════════════ */

// ── Compact number formatter for metric boxes ──
function _fmtCompact(n){
  if(n==null||isNaN(n))return'—';
  const abs=Math.abs(n);
  if(abs>=1e6) return (n/1e6).toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1})+' M';
  if(abs>=100000) return Math.round(n).toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0});
  return fmtN(Math.round(n),0);
}

// ── Evolution chart state ──
let db2EvoMode = 'month'; // 'daily' | 'month'
let _db2EvolutionState = null;
function _applyDb2CcPrivacy(prefix, hasUsdValue=false){
  const arsEl=document.getElementById(`kpi-${prefix}-ars`);
  const usdEl=document.getElementById(`kpi-${prefix}-usd`);
  const amountSide=arsEl?.closest('.db2-cc-amount-side') || usdEl?.closest('.db2-cc-amount-side');
  if(amountSide) amountSide.classList.add('is-masked');
  if(arsEl){
    if(typeof cancelNumberTextAnimation==='function') cancelNumberTextAnimation(arsEl);
    arsEl.textContent='••••••••';
  }
  if(usdEl){
    if(typeof cancelNumberTextAnimation==='function') cancelNumberTextAnimation(usdEl);
    usdEl.textContent=hasUsdValue?'••••':'';
    usdEl.style.display=hasUsdValue?'':'none';
  }
}
function setDb2EvoMode(mode){
  db2EvoMode = mode === 'month' ? 'month' : 'daily';
  const d = document.getElementById('db2-evo-daily-btn');
  const a = document.getElementById('db2-evo-accum-btn');
  if(d) d.classList.toggle('active', db2EvoMode==='daily');
  if(a) a.classList.toggle('active', db2EvoMode==='month');
  renderDb2EvolutionChart();
}

// ── Smart CC Cycle Widget ──
function _ccwGetCardData(key, data){
  const today = new Date();
  const todayYmd = dateToYMD(today);
  const cards = state.ccCards || [];
  const allCycles = typeof getTcCycles === 'function' ? getTcCycles() : [];
  const cycleByKey = data?.cycleByKey || {};
  const totalsByKey = data?.totalsByKey || {};
  const isMesMode = !!data?.isMesMode;
  const mesMonthKey = data?.mesMonthKey || getMonthKey(today);

  const card = cards.find(c => (c.payMethodKey||'').toLowerCase() === key) || cards.find(c => (c.name||'').toLowerCase().includes(key));
  if(!card) return null;

  const cardCycles = allCycles.filter(c => c.cardId === card.id);
  let activeCycle = cycleByKey[key] || cardCycles.find(c => {
    const idx = allCycles.findIndex(x => x.id === c.id);
    const open = getTcCycleOpen(allCycles, idx);
    return open && todayYmd >= open && todayYmd <= c.closeDate;
  }) || cardCycles[0];

  let openYmd, closeYmd, dueYmd;
  if(isMesMode){
    const [mY,mM] = mesMonthKey.split('-').map(Number);
    openYmd = `${mesMonthKey}-01`;
    closeYmd = dateToYMD(new Date(mY, mM, 0));
    dueYmd = null;
  } else if(activeCycle){
    const cycleIdx = allCycles.findIndex(c => c.id === activeCycle.id);
    openYmd = typeof getTcCycleOpen === 'function' ? getTcCycleOpen(allCycles, cycleIdx) : null;
    closeYmd = activeCycle.closeDate;
    dueYmd = activeCycle.dueDate || null;
  } else { return null; }

  const scopedTotals = totalsByKey[key] || totalsByKey[card.payMethodKey||card.id] || null;
  let cycleTxns = [];
  if(!scopedTotals && !isMesMode && activeCycle && typeof getTcCycleTxns === 'function'){
    cycleTxns = getTcCycleTxns(activeCycle, allCycles);
  }
  const arsTotal = scopedTotals ? (scopedTotals.ars||0) : cycleTxns.filter(t => t.currency==='ARS' && t.amount>0).reduce((s,t)=>s+t.amount,0);
  const usdTotal = scopedTotals ? (scopedTotals.usd||0) : cycleTxns.filter(t => t.currency==='USD' && t.amount>0).reduce((s,t)=>s+t.amount,0);
  const txnCount = scopedTotals ? (scopedTotals.count||0) : cycleTxns.length;

  const openD  = openYmd  ? new Date(openYmd+'T12:00:00')  : null;
  const closeD = closeYmd ? new Date(closeYmd+'T12:00:00') : null;
  const totalDays = openD && closeD ? Math.max(1, Math.round((closeD-openD)/86400000)) : 30;
  const elapsed   = openD ? Math.max(0, Math.round((today-openD)/86400000)) : 0;
  const daysLeft  = closeD ? Math.max(0, Math.round((closeD-today)/86400000)) : 0;
  const pct = Math.min(100, Math.round(elapsed/totalDays*100));
  const dailyAvg = elapsed > 0 ? arsTotal / elapsed : 0;
  const projected = dailyAvg * totalDays;

  // Previous cycle comparison
  let prevArs = 0;
  if(!isMesMode && activeCycle){
    const prevCycle = cardCycles.find(c => c.closeDate < (activeCycle.closeDate||'') && c.id !== activeCycle.id);
    if(prevCycle && typeof getTcCycleTxns === 'function'){
      prevArs = getTcCycleTxns(prevCycle, allCycles).filter(t=>t.currency==='ARS'&&t.amount>0).reduce((s,t)=>s+t.amount,0);
    }
  } else if(isMesMode){
    const [mY,mM] = mesMonthKey.split('-').map(Number);
    const prevMk = (mM===1?(mY-1)+'-12':mY+'-'+String(mM-1).padStart(2,'0'));
    if(typeof getTxnsFor==='function'){
      prevArs = (getTxnsFor(prevMk)||[]).filter(t=>t.currency==='ARS'&&(t.payMethod||'').toLowerCase()===key&&t.amount>0&&!t.isIncome&&t.type!=='income').reduce((s,t)=>s+(typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount),0);
    }
  }
  const deltaPct = prevArs > 0 ? ((arsTotal-prevArs)/prevArs)*100 : 0;

  // Last transaction time
  const allCardTxns = (state.transactions||[]).filter(t=>(t.payMethod||'').toLowerCase()===key).sort((a,b)=>(b.date instanceof Date?b.date:new Date(b.date))-(a.date instanceof Date?a.date:new Date(a.date)));
  const lastTxn = allCardTxns[0] || null;
  let lastTxnAgo = '';
  if(lastTxn){
    const ld = lastTxn.date instanceof Date ? lastTxn.date : new Date(String(lastTxn.date).includes('T')?lastTxn.date:lastTxn.date+'T12:00:00');
    const diffH = Math.round((today-ld)/3600000);
    if(diffH < 1) lastTxnAgo = 'hace minutos';
    else if(diffH < 24) lastTxnAgo = `hace ${diffH}h`;
    else if(diffH < 48) lastTxnAgo = 'ayer';
    else lastTxnAgo = `hace ${Math.round(diffH/24)} días`;
  }

  // Top category
  const catTotals = {};
  const txnPool = cycleTxns.length ? cycleTxns : allCardTxns.filter(t=>{
    const d=dateToYMD(t.date); return openYmd&&closeYmd&&d>=openYmd&&d<=closeYmd;
  });
  txnPool.filter(t=>t.currency==='ARS'&&t.category&&t.category!=='Procesando...').forEach(t=>{
    const g = typeof catGroup==='function' ? catGroup(t.category) : t.category;
    catTotals[g] = (catTotals[g]||0) + (typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):t.amount);
  });
  const topCat = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
  const topCatPct = topCat && arsTotal > 0 ? Math.round(topCat[1]/arsTotal*100) : 0;

  return { key, card, arsTotal, usdTotal, txnCount, openYmd, closeYmd, dueYmd, totalDays, elapsed, daysLeft, pct, dailyAvg, projected, prevArs, deltaPct, lastTxnAgo, topCat: topCat?topCat[0]:null, topCatPct };
}

function _ccwFmt(ymd){
  if(!ymd) return '—';
  try { const d=new Date(ymd+'T12:00:00'); return d.toLocaleDateString('es-AR',{day:'2-digit',month:'short'}).replace('.','').toUpperCase(); }
  catch(e){ return ymd; }
}

function _ccwRenderCard(d){
  if(!d) return '';
  const k = d.key;
  const masked = isMasked();
  const isEmpty = d.arsTotal === 0 && d.usdTotal === 0;
  const calSvg = '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';

  const deltaHtml = d.deltaPct !== 0 ? `<span class="db2-cc-stat-delta ${d.deltaPct>0?'up':'down'}">${d.deltaPct>0?'↑':'↓'}${Math.abs(Math.round(d.deltaPct))}%</span>` : '';

  return `
    <div class="db2-cc-item ${k==='amex'?'db2-cc-item-amex':''}" id="db2-cc-${k}-item">
      <div class="db2-cc-name db2-cc-name-${k}">${k.toUpperCase()}</div>
      <div class="db2-cc-cycle-main">
        <div class="db2-cc-dates-and-bar">
          <div class="db2-cc-dates-row">
            <div class="db2-cc-date-cell"><span class="db2-cc-date-label">${calSvg}Abre</span><span class="db2-cc-date-val">${_ccwFmt(d.openYmd)}</span></div>
            <div class="db2-cc-date-cell"><span class="db2-cc-date-label">${calSvg}Cierra</span><span class="db2-cc-date-val">${_ccwFmt(d.closeYmd)}</span></div>
            <div class="db2-cc-date-cell"><span class="db2-cc-date-label">${calSvg}Vence</span><span class="db2-cc-date-val">${_ccwFmt(d.dueYmd)}</span></div>
          </div>
          <div class="db2-cc-bar-track"><div class="db2-cc-bar-fill" id="ccw-bar-${k}" style="width:0%${k==='amex'?';background:#0066b2':''}"></div></div>
        </div>
        <div class="db2-cc-amount-side">
          <div class="db2-cc-amt" id="kpi-${k}-ars">${masked?'••••••••':(isEmpty?'Sin consumos':'—')}</div>
          <div class="db2-cc-amt-usd" id="kpi-${k}-usd"${d.usdTotal>0?'':' style="display:none"'}></div>
          <div class="db2-cc-days">${d.daysLeft === 0 ? 'Cierra hoy' : d.daysLeft+' día'+(d.daysLeft!==1?'s':'')+' restantes'}</div>
        </div>
      </div>
      <div class="db2-cc-stats-row">
        <div class="db2-cc-stat-box"><div class="db2-cc-stat-label">Prom. diario</div><div class="db2-cc-stat-value">${masked?'••••':'$'+fmtN(Math.round(d.dailyAvg),0)}</div></div>
        <div class="db2-cc-stat-box"><div class="db2-cc-stat-label">Proyección</div><div class="db2-cc-stat-value">${masked?'••••':'$'+fmtN(Math.round(d.projected),0)}</div></div>
        <div class="db2-cc-stat-box"><div class="db2-cc-stat-label">Movimientos</div><div class="db2-cc-stat-value">${d.txnCount}</div></div>
        <div class="db2-cc-stat-box"><div class="db2-cc-stat-label">vs. anterior</div><div class="db2-cc-stat-value">${deltaHtml || '—'}</div></div>
      </div>
    </div>`;
}

function _ccwRenderFocusPremium(d){
  if(!d) return '';
  const k = d.key;
  const masked = isMasked();
  const isEmpty = d.arsTotal === 0 && d.usdTotal === 0;
  const isAmex = k === 'amex';
  const brandColor = isAmex ? '#1D4ED8' : '#7B61FF';

  const deltaVal = Math.abs(Math.round(d.deltaPct));
  const deltaUp = d.deltaPct > 0;
  const deltaHtml = d.deltaPct !== 0
    ? `<span class="ccf-stat-delta ${deltaUp?'up':'down'}">${deltaUp?'↑':'↓'} ${deltaVal}%</span>`
    : '<span class="ccf-stat-delta neutral">—</span>';

  const daysLabel = d.daysLeft === 0 ? 'Cierra hoy' : d.daysLeft + ' día' + (d.daysLeft !== 1 ? 's' : '') + ' restantes';

  const calIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';

  return `<div class="ccf-wrap" data-card="${k}">
    <div class="ccf-header">
      <div class="ccf-hd-left">
        <div class="ccf-hd-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/></svg></div>
        <span class="ccf-hd-title">TARJETA PRINCIPAL</span>
      </div>
      <button class="ccf-hd-link" onclick="nav('credit-cards')">Ver detalle →</button>
    </div>

    <div class="ccf-hero">
      <div class="ccf-brand">${k.toUpperCase()}</div>
      <div class="ccf-hero-center">
        <div class="ccf-ars-label">SALDO EN ARS</div>
        <div class="ccf-ars-amt" id="kpi-${k}-ars">${masked ? '••••••••' : (isEmpty ? 'Sin consumos' : '—')}</div>
      </div>
      <div class="ccf-usd-card"${d.usdTotal > 0 || !isEmpty ? '' : ' style="visibility:hidden"'}>
        <div class="ccf-usd-label">USD</div>
        <div class="ccf-usd-amt" id="kpi-${k}-usd">${masked ? '••••' : '—'}</div>
        <div class="ccf-usd-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10h8M8 14h8"/></svg></div>
      </div>
    </div>

    <div class="ccf-dates-card">
      <div class="ccf-dates-row">
        <div class="ccf-date-cell">${calIcon}<span class="ccf-date-lbl">ABRE</span><span class="ccf-date-val">${_ccwFmt(d.openYmd)}</span></div>
        <div class="ccf-date-cell">${calIcon}<span class="ccf-date-lbl">CIERRA</span><span class="ccf-date-val">${_ccwFmt(d.closeYmd)}</span></div>
        <div class="ccf-date-cell">${calIcon}<span class="ccf-date-lbl">VENCE</span><span class="ccf-date-val">${_ccwFmt(d.dueYmd)}</span></div>
      </div>
      <div class="ccf-days-pill${d.daysLeft <= 10 ? ' ccf-days-urgent' : ''}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> ${daysLabel}</div>
    </div>

    <div class="ccf-bar-section">
      <span class="ccf-bar-label">${d.pct}% utilizado</span>
      <div class="ccf-bar-track"><div class="ccf-bar-fill" id="ccw-bar-${k}" style="width:0%"></div></div>
    </div>

    <div class="ccf-stats">
      <div class="ccf-stat"><div class="ccf-stat-icon ccf-si-avg"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16 10 10l4 4 6-8"/></svg></div><div class="ccf-stat-copy"><div class="ccf-stat-lbl">PROM. DIARIO</div><div class="ccf-stat-val">${masked?'••••':'$'+fmtN(Math.round(d.dailyAvg),0)}</div></div></div>
      <div class="ccf-stat"><div class="ccf-stat-icon ccf-si-proj"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg></div><div class="ccf-stat-copy"><div class="ccf-stat-lbl">PROYECCIÓN</div><div class="ccf-stat-val">${masked?'••••':'$'+fmtN(Math.round(d.projected),0)}</div></div></div>
      <div class="ccf-stat"><div class="ccf-stat-icon ccf-si-count"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg></div><div class="ccf-stat-copy"><div class="ccf-stat-lbl">MOVIMIENTOS</div><div class="ccf-stat-val">${d.txnCount}</div></div></div>
      <div class="ccf-stat"><div class="ccf-stat-icon ccf-si-delta"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V4M5 11l7-7 7 7"/></svg></div><div class="ccf-stat-copy"><div class="ccf-stat-lbl">VS. ANTERIOR</div><div class="ccf-stat-val">${deltaHtml}</div></div></div>
    </div>
  </div>`;
}

function renderDb2CcCycles(data){
  const el = document.getElementById('db2-cc-smart-content');
  if(!el) return;

  const visa = _ccwGetCardData('visa', data);
  const amex = _ccwGetCardData('amex', data);
  const hasVisa = visa && visa.arsTotal > 0;
  const hasAmex = amex && amex.arsTotal > 0;

  const isFocus = (hasVisa && !hasAmex) || (hasAmex && !hasVisa);
  const widget = document.getElementById('db2-cc-smart-widget');

  if(isFocus){
    const focusCard = hasVisa ? visa : amex;
    if(widget) widget.classList.add('ccf-mode');
    el.innerHTML = _ccwRenderFocusPremium(focusCard);
  } else {
    if(widget) widget.classList.remove('ccf-mode');
    const headerHtml = `
      <div class="db2-hd">
        <div class="db2-hd-left">
          <div class="db2-hd-icon" style="background:rgba(56,189,248,0.12);color:#0ea5e9;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/></svg>
          </div>
          <span class="db2-title">Ciclo de Tarjetas</span>
        </div>
        <button class="db2-link" onclick="nav('credit-cards')">Ver detalle →</button>
      </div>`;
    el.innerHTML = headerHtml + '<div class="db2-cc-grid">' + _ccwRenderCard(visa) + _ccwRenderCard(amex) + '</div>';
  }

  // Animate amounts and bars
  [visa, amex].forEach(d => {
    if(!d) return;
    const k = d.key;
    const masked = isMasked();
    const arsEl = document.getElementById(`kpi-${k}-ars`);
    const usdEl = document.getElementById(`kpi-${k}-usd`);
    if(arsEl && !masked && d.arsTotal > 0){
      animateNumberText(arsEl, d.arsTotal, {prefix:'$', decimals:2, duration:760});
    }
    if(usdEl && !masked && d.usdTotal > 0){
      animateNumberText(usdEl, d.usdTotal, {prefix:'U$D ', decimals:2, duration:760});
      usdEl.style.display = '';
    }
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const bar = document.getElementById(`ccw-bar-${k}`);
      if(bar) bar.style.width = d.pct + '%';
    }));
  });
}

function isBusinessDay(date){
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function getSecondBusinessDay(year, month){
  let count = 0;
  for(let day = 1; day <= 31; day += 1){
    const date = new Date(year, month, day);
    if(date.getMonth() !== month) break;
    if(isBusinessDay(date)) count += 1;
    if(count === 2) return date;
  }
  return null;
}

function getNextConfiguredIncomePayment(salaryLimit){
  if(!(salaryLimit > 0)) return null;
  const today = new Date();
  today.setHours(0,0,0,0);

  let next = getSecondBusinessDay(today.getFullYear(), today.getMonth());
  if(!next || next < today){
    next = getSecondBusinessDay(today.getFullYear(), today.getMonth() + 1);
  }
  if(!next) return null;
  next.setHours(0,0,0,0);
  return {
    date: next,
    days: Math.max(0, Math.round((next - today) / 86400000))
  };
}

// ── Projection widget extras ──
function renderDb2ProjExtras(projected, totalGastoARS, incTotalARS, spendBudget, daysLeft, dailyRate, projPeriodClose){
  const remainingEl = document.getElementById('db2-proj-remaining');
  const closeDateEl = document.getElementById('db2-proj-closedate');
  const nextIncomeEl = document.getElementById('db2-proj-next-income');
  const nextIncomeSubEl = document.getElementById('db2-proj-next-income-sub');
  const pctEl = document.getElementById('db2-proj-pct');
  const pctLimitEl = document.getElementById('db2-proj-pct-limit');
  const pctRingEl = document.getElementById('db2-proj-pct-ring');
  const r1El = document.getElementById('db2-proj-r1');
  const r2El = document.getElementById('db2-proj-r2');
  const l2El = document.getElementById('db2-proj-l2');
  const r3El = document.getElementById('db2-proj-r3');
  const barEl = document.getElementById('db2-proj-bar');
  const barAccumEl = document.getElementById('db2-proj-bar-accum');
  const limitMarkerEl = document.getElementById('db2-proj-limit-marker');
  void spendBudget;
  const salaryLimit = incTotalARS || 0;

  if(remainingEl){
    if(salaryLimit > 0){
      const rem = salaryLimit - totalGastoARS;
      if(isMasked()) remainingEl.textContent = '••••••••';
      else remainingEl.textContent = (rem >= 0 ? '$' : '-$') + fmtN(Math.abs(Math.round(rem)));
      remainingEl.style.color = rem < 0 ? '#F3382E' : '#070B1D';
    } else {
      remainingEl.textContent = '—';
      remainingEl.style.color = '#070B1D';
    }
  }

  if(closeDateEl){
    if(projPeriodClose instanceof Date){
      closeDateEl.textContent = projPeriodClose.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
    } else if(!projPeriodClose){
      const today = new Date();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
      const closeDate = new Date(today.getFullYear(), today.getMonth(), daysInMonth);
      closeDateEl.textContent = closeDate.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
    } else closeDateEl.textContent = '—';
  }

  if(r1El){
    if(isMasked()) r1El.textContent = '••••••••';
    else r1El.textContent = Number.isFinite(projected) ? '$' + fmtN(Math.round(projected || 0)) : '—';
  }
  if(r2El){
    if(l2El) l2El.textContent = 'Gasto acumulado';
    if(isMasked()) r2El.textContent = '••••••••';
    else r2El.textContent = Number.isFinite(totalGastoARS) ? '$' + fmtN(Math.round(totalGastoARS || 0)) : '—';
  }
  if(r3El){
    if(isMasked()) r3El.textContent = '••••••••';
    else r3El.textContent = salaryLimit > 0 ? '$' + fmtN(Math.round(salaryLimit)) : '—';
  }

  if(pctEl && pctLimitEl && pctRingEl){
    if(salaryLimit > 0){
      const pct = Math.max(0, Math.round((totalGastoARS || 0) / salaryLimit * 100));
      pctEl.textContent = pct + '%';
      pctLimitEl.textContent = 'de $' + fmtN(Math.round(salaryLimit), 0);
      pctRingEl.style.setProperty('--db2-proj-pct', Math.min(360, pct * 3.6) + 'deg');
      pctRingEl.classList.toggle('over', pct >= 100);
    } else {
      pctEl.textContent = '—';
      pctLimitEl.textContent = 'Sin datos';
      pctRingEl.style.setProperty('--db2-proj-pct', '0deg');
      pctRingEl.classList.remove('over');
    }
  }

  if(nextIncomeEl){
    const nextIncome = getNextConfiguredIncomePayment(salaryLimit);
    if(nextIncome){
      nextIncomeEl.textContent = nextIncome.date.toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'}).replace('.', '');
      if(nextIncomeSubEl){
        nextIncomeSubEl.textContent = nextIncome.days === 0 ? 'hoy' : `en ${nextIncome.days} día${nextIncome.days !== 1 ? 's' : ''}`;
      }
    } else {
      nextIncomeEl.textContent = '—';
      if(nextIncomeSubEl) nextIncomeSubEl.textContent = 'Sin datos';
    }
  }

  if(barEl && barAccumEl){
    const maxRef = Math.max(totalGastoARS || 0, projected || 0, salaryLimit || 0);
    if(maxRef > 0){
      const accumPct = Math.min(100, Math.max(0, (totalGastoARS || 0) / maxRef * 100));
      const projectedPct = Math.min(100, Math.max(accumPct, (projected || 0) / maxRef * 100));
      barAccumEl.style.width = accumPct + '%';
      barEl.style.left = accumPct + '%';
      barEl.style.width = Math.max(0, projectedPct - accumPct) + '%';
      barEl.classList.toggle('over', salaryLimit > 0 && projected > salaryLimit);
      if(limitMarkerEl){
        if(salaryLimit > 0){
          limitMarkerEl.style.display = '';
          limitMarkerEl.style.left = Math.min(100, Math.max(0, salaryLimit / maxRef * 100)) + '%';
        } else {
          limitMarkerEl.style.display = 'none';
        }
      }
    } else {
      barAccumEl.style.width = '0%';
      barEl.style.left = '0%';
      barEl.style.width = '0%';
      barEl.classList.remove('over');
      if(limitMarkerEl) limitMarkerEl.style.display = 'none';
    }
  }
}

// ── Hero sub-cards ──
function renderDb2HeroExtras(arsMonth, usdMonth, margen, pct, incTotalARS, spendBudget, thirdPartyTxns=[]){
  const heroMasked = state.globalHide;

  // ARS card
  const arsEl = document.getElementById('db2-ars-val');
  if(arsEl) {
    if(heroMasked) arsEl.textContent = '••••••••';
    else animateNumberText(arsEl, arsMonth, {prefix:'$', decimals:2, duration:760});
  }

  // USD card
  const usdEl = document.getElementById('db2-usd-val');
  if(usdEl){
    if(usdMonth > 0) {
      if(heroMasked) usdEl.textContent = '••••';
      else animateNumberText(usdEl, usdMonth, {prefix:'U$D ', decimals:2, duration:760});
    }
    else usdEl.textContent = '—';
  }

  // USD sub-line below main amount
  const usdLine = document.getElementById('dhc-usd-line');
  if(usdLine){
    if(usdMonth > 0) {
      if(heroMasked) usdLine.textContent = 'USD ••••';
      else animateNumberText(usdLine, usdMonth, {prefix:'USD ', decimals:2, duration:760});
    }
    else usdLine.textContent = '';
  }

  // Margen card
  const margenEl  = document.getElementById('db2-margen-val');
  const margenPct = document.getElementById('db2-margen-pct');
  const margenTitle = document.querySelector('.db2-hero-sub-margen .db2-hero-sub-title');

  if(margenEl){
    if(margen !== null && incTotalARS > 0){
      const isOver = margen < 0;
      if(heroMasked) {
        margenEl.textContent = '••••••••';
      } else {
        animateNumberText(margenEl, Math.abs(Math.round(margen)), {
          formatter: n => (isOver ? '-$' : '$') + fmtN(n)
        });
      }
      margenEl.style.color = isOver ? '#ff453a' : '#32d74b'; // Bright premium colors
      
      if(margenTitle) {
        margenTitle.textContent = isOver ? 'EXCESO DE GASTO' : 'MARGEN DISPONIBLE';
        margenTitle.style.color = isOver ? 'rgba(255,255,255,0.9)' : '';
      }

      if(margenPct){
        const remPct = spendBudget > 0 ? Math.max(0, Math.round(margen / spendBudget * 100)) : 0;
        margenPct.textContent = isOver ? 'Excediste tu presupuesto' : Math.round(remPct) + '% del presupuesto';
        margenPct.style.display = '';
        margenPct.style.background = isOver ? 'rgba(255,69,58,0.2)' : '';
        margenPct.style.color = isOver ? '#ff9f0a' : '';
      }
    } else {
      margenEl.textContent = incTotalARS > 0 ? '—' : 'Sin ingreso';
      margenEl.style.color = 'rgba(255,255,255,0.6)';
      if(margenPct) margenPct.style.display = 'none';
      if(margenTitle) margenTitle.textContent = 'MARGEN DISPONIBLE';
    }
  }

  // % badge
  const pctBadge = document.getElementById('dhc-pct-inline');
  if(pctBadge){
    if(pct !== null){
      pctBadge.textContent = pct + '% del presupuesto';
      pctBadge.style.display = '';
    } else {
      pctBadge.style.display = 'none';
    }
  }

  // Dynamic Third Party Note
  const tpNote = document.getElementById('dhc-third-party-note');
  if(tpNote){
    const toArs = (amount, currency) => ((currency || 'ARS') === 'USD'
      ? (Number(amount) || 0) * (USD_TO_ARS || 0)
      : (Number(amount) || 0));
    const tpItems = (thirdPartyTxns || []).filter(t => !!t && !!t.isThirdParty);
    const pendingSum = tpItems.reduce((s,t) => {
       const base = Number(t.thirdPartyAmount) || Number(t.amount) || 0;
       const status = t.thirdPartyStatus || 'pending';
       const settled = status === 'partial' ? Math.min(base, Number(t.thirdPartySettledAmount) || 0) : 0;
       return status === 'settled' ? s : s + toArs(Math.max(0, base - settled), t.currency);
    }, 0);
    const recoveredSum = tpItems.reduce((s,t) => {
      if((t.thirdPartyStatus || 'pending') !== 'settled') return s;
      const base = Number(t.thirdPartyAmount) || Number(t.amount) || 0;
      const settled = Number(t.thirdPartySettledAmount) || base;
      return s + toArs(Math.min(base, settled), t.currency);
    }, 0);

    if(pendingSum > 0 || recoveredSum > 0){
      tpNote.style.display = 'block';
      let html = '';
      if(heroMasked) {
        html = '<span style="color:var(--accent);font-weight:700;">+ $••••••</span> de terceros';
      } else {
        if(pendingSum > 0 && recoveredSum > 0) {
          html = `<span style="color:#32d74b;font-weight:800;">+$${fmtN(Math.round(recoveredSum))} recuperados</span> · <span style="color:#ff9f0a;font-weight:800;">$${fmtN(Math.round(pendingSum))} a recuperar</span>`;
        } else if(pendingSum > 0) {
          html = `<span style="color:#ff9f0a;font-weight:800;">$${fmtN(Math.round(pendingSum))}</span> a recuperar de terceros`;
        } else {
          html = `<span style="color:#32d74b;font-weight:800;">+$${fmtN(Math.round(recoveredSum))}</span> recuperado totalmente`;
        }
      }
      tpNote.innerHTML = html;
    } else {
      tpNote.style.display = 'none';
    }
  }

  // Update Eye Icons based on state
  const heroEye = document.getElementById('db2-hero-privacy-btn');
  if(heroEye) heroEye.classList.toggle('is-hidden', state.globalHide);
  
  const globalEye = document.getElementById('db2-global-privacy-btn');
  const globalLabel = document.getElementById('db2-global-privacy-label');
  if(globalEye) globalEye.classList.toggle('active', state.globalHide);
  if(globalLabel) globalLabel.textContent = state.globalHide ? 'Montos ocultos' : 'Ocultar montos';
}

function isMasked() {
  return !!state.globalHide;
}

function enforceDashboardPrivacyMask(){
  if(!isMasked()) return;
  _applyDb2CcPrivacy('visa', !!document.getElementById('kpi-visa-usd')?.textContent.trim());
  _applyDb2CcPrivacy('amex', !!document.getElementById('kpi-amex-usd')?.textContent.trim());
  [
    'kpi-ars',
    'dhc-ars-line',
    'dhc-usd-line',
    'kpi-ars-d',
    'kpi-total-ars',
    'kpi-total-usd',
    'kpi-inc-total',
    'dhc-bal-income',
    'dhc-bal-gasto',
    'dhc-bal-result',
    'dhc-margin-val',
    'dhc-margin-sub',
    'dhc-margin-ingreso',
    'dhc-margen',
    'kpi-usd',
    'kpi-tc',
    'kpi-proj',
    'kpi-proj-daily',
    'db2-proj-r1',
    'db2-proj-r2',
    'db2-proj-r3',
    'db2-proj-remaining',
    'db2-proj-pct-limit',
    'db2-ars-val',
    'db2-usd-val',
    'db2-margen-val',
    'db2-evo-ingresos',
    'db2-evo-gastos',
    'db2-cat-total'
  ].forEach(id=>{
    const el=document.getElementById(id);
    if(el){
      if(typeof cancelNumberTextAnimation==='function') cancelNumberTextAnimation(el);
      el.textContent='••••••••';
    }
  });
  const thirdPartyNote=document.getElementById('dhc-third-party-note');
  if(thirdPartyNote && thirdPartyNote.style.display!=='none'){
    thirdPartyNote.innerHTML='<span style="color:var(--accent);font-weight:700;">+ $••••••</span> de terceros';
  }
}

function toggleHeroPrivacy() {
  state.globalHide = !state.globalHide;
  state.hideHero = state.globalHide;
  saveState();
  renderDashboard();
  updateUsdRateUI();
}

function toggleGlobalPrivacy() {
  state.globalHide = !state.globalHide;
  state.hideHero = state.globalHide;
  saveState();
  renderDashboard();
  updateUsdRateUI();
}

function _db2ToArsAmount(item){
  return ((item?.currency || 'ARS') === 'USD'
    ? (Number(item?.amount) || 0) * (USD_TO_ARS || 1420)
    : (Number(item?.amount) || 0));
}

function _db2ShortMonthLabel(monthKey){
  const [year,month]=String(monthKey||'').split('-').map(Number);
  if(!year || !month) return '—';
  return new Date(year,month-1,1).toLocaleDateString('es-AR',{month:'short'}).replace('.','');
}

function _db2CycleIncomeMonth(cycle, cycles){
  if(!cycle) return '';
  const idx=Array.isArray(cycles)?cycles.findIndex(item=>item.id===cycle.id):-1;
  return getTcCycleOpen(cycles||[], idx)?.slice(0,7) || cycle.closeDate?.slice(0,7) || '';
}

function _db2BuildMonthExpenseEntries(monthKey){
  const range=getMonthRange(monthKey);
  return range?getPeriodTxnList(range):[];
}

function _db2BuildCycleExpenseEntries(cycleMode, cycleId){
  const cycles=(typeof getTcCycles==='function'?getTcCycles(cycleMode):[]).slice().sort((a,b)=>a.closeDate.localeCompare(b.closeDate));
  const cycle=cycles.find(item=>item.id===cycleId) || cycles[cycles.length-1] || null;
  if(!cycle) return {cycle:null, cycles, entries:[]};
  if(typeof getTcCycleTrendTxns==='function'){
    return {cycle, cycles, entries:getTcCycleTrendTxns(cycle, cycles)};
  }
  return {cycle, cycles, entries:typeof getTcCycleTxns==='function'?getTcCycleTxns(cycle, cycles):[]};
}

function _db2BuildEvolutionDaySeries(scope){
  const isTc=scope?.mode==='tc';
  const labels=[];
  const expenseDaily=[];
  let incomeTotal=Number(scope?.totalIncomeArs)||0;
  let expenseEntries=[];
  let maxDay=0;
  let monthKey=scope?.monthKey || getMonthKey(new Date());

  if(isTc){
    const cycleScope=_db2BuildCycleExpenseEntries(scope?.cycleMode, scope?.cycleId);
    expenseEntries=cycleScope.entries || [];
    const cycle=cycleScope.cycle;
    if(cycle){
      const incomeMonth=_db2CycleIncomeMonth(cycle, cycleScope.cycles);
      incomeTotal=(getIncomeSnapshot(incomeMonth).total || incomeTotal);
      const openStr=_db2CycleIncomeMonth(cycle, cycleScope.cycles) ? getTcCycleOpen(cycleScope.cycles, cycleScope.cycles.findIndex(item=>item.id===cycle.id)) : null;
      const openDate=new Date((openStr || cycle.closeDate)+'T12:00:00');
      const closeDate=new Date(cycle.closeDate+'T12:00:00');
      maxDay=Math.max(1, Math.round((closeDate-openDate)/86400000)+1);
      const byDay=Array.from({length:maxDay},()=>0);
      expenseEntries.forEach(item=>{
        const dt=new Date(String(item.date).includes('T')?item.date:`${item.date}T12:00:00`);
        const idx=Math.round((dt-openDate)/86400000);
        if(idx>=0 && idx<maxDay) byDay[idx]+=_db2ToArsAmount(item);
      });
      let expenseAccum=0;
      for(let i=0;i<maxDay;i++){
        expenseAccum+=byDay[i]||0;
        expenseDaily.push(expenseAccum);
        labels.push(i===0 || i===maxDay-1 || i%3===0 ? `Día ${i+1}` : '');
      }
    }
  } else {
    expenseEntries=_db2BuildMonthExpenseEntries(monthKey);
    incomeTotal=(getIncomeSnapshot(monthKey).total || incomeTotal);
    const [year,month]=String(monthKey||'').split('-').map(Number);
    maxDay=year && month ? new Date(year,month,0).getDate() : 0;
    const byDay=Array.from({length:maxDay},()=>0);
    expenseEntries.forEach(item=>{
      const dt=new Date(String(item.date).includes('T')?item.date:`${item.date}T12:00:00`);
      if(dt.getFullYear()!==year || dt.getMonth()!==month-1) return;
      const idx=dt.getDate()-1;
      if(idx>=0 && idx<maxDay) byDay[idx]+=_db2ToArsAmount(item);
    });
    let expenseAccum=0;
    for(let i=0;i<maxDay;i++){
      expenseAccum+=byDay[i]||0;
      expenseDaily.push(expenseAccum);
      labels.push(i===0 || i===maxDay-1 || (i+1)%3===0 ? `${i+1} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][month-1]}` : '');
    }
  }

  const finalExpense=expenseDaily[expenseDaily.length-1] || 0;
  const totalExpense=Number(scope?.totalExpenseArs);
  if(Number.isFinite(totalExpense) && Math.abs(totalExpense-finalExpense) > 0.5 && expenseDaily.length){
    expenseDaily[expenseDaily.length-1]=totalExpense;
  }
  const remainingIncome=expenseDaily.map(value=>Math.max(incomeTotal - value, 0));
  return {
    labels,
    expenseData:expenseDaily,
    incomeData:remainingIncome,
    totalIncome:incomeTotal,
    totalExpense:Number.isFinite(totalExpense)?totalExpense:(expenseDaily[expenseDaily.length-1]||0)
  };
}

function _db2BuildEvolutionPeriodSeries(scope){
  if(scope?.mode==='tc'){
    const cycles=(typeof getTcCycles==='function'?getTcCycles(scope.cycleMode):[]).slice().sort((a,b)=>a.closeDate.localeCompare(b.closeDate));
    const selectedIdx=cycles.findIndex(item=>item.id===scope.cycleId);
    const endIdx=selectedIdx>=0?selectedIdx:Math.max(cycles.length-1,0);
    const slice=(endIdx>=0?cycles.slice(Math.max(0,endIdx-5), endIdx+1):cycles.slice(-6));
    return {
      labels:slice.map(cycle=>cleanHeroCycleLabel(cycle.label||cycle.closeDate)),
      expenseData:slice.map(cycle=>{
        const cycleScope=_db2BuildCycleExpenseEntries(scope.cycleMode, cycle.id);
        return (cycleScope.entries||[]).reduce((sum,item)=>sum+_db2ToArsAmount(item),0);
      }),
      incomeData:slice.map(cycle=>getIncomeSnapshot(_db2CycleIncomeMonth(cycle, cycles)).total || 0),
      subtitle:'Últimos ciclos · gasto vs ingreso'
    };
  }

  const currentMonth=scope?.monthKey || getMonthKey(new Date());
  const txMonths=(state.transactions||[]).map(t=>t.month||getMonthKey(t.date));
  const incomeMonths=(state.incomeMonths||[]).map(item=>item.month);
  const monthKeys=[...new Set([...txMonths, ...incomeMonths, currentMonth])].filter(Boolean).sort();
  return {
    labels:monthKeys.map(_db2ShortMonthLabel),
    expenseData:monthKeys.map(monthKey=>_db2BuildMonthExpenseEntries(monthKey).reduce((sum,item)=>sum+_db2ToArsAmount(item),0)),
    incomeData:monthKeys.map(monthKey=>getIncomeSnapshot(monthKey).total || 0),
    subtitle:'Todos los meses · gasto vs ingreso'
  };
}

// ── Evolution line chart ──
function renderDb2EvolutionChart(){
  const ctx = document.getElementById('chart-evolution');
  if(!ctx) return;

  if(state.charts && state.charts.evolution){ state.charts.evolution.destroy(); state.charts.evolution = null; }
  const scope=_db2EvolutionState || {
    mode: normalizeViewMode(state.dashView||'visa')!=='mes' ? 'tc' : 'mes',
    monthKey:getActiveDashMonth(),
    cycleMode:normalizeViewMode(state.dashView||'visa'),
    cycleId:state.dashTcCycle||null,
    totalExpenseArs:0,
    totalIncomeArs:0
  };
  const titleEl=document.querySelector('.db2-evo-heading .db2-title');
  const subTitleEl=document.querySelector('.db2-evo-heading .db2-evo-sub');

  // Update legend totals
  const evoIng = document.getElementById('db2-evo-ingresos');
  const evoGas = document.getElementById('db2-evo-gastos');
  const useMonthMode = db2EvoMode === 'month';
  const series = useMonthMode ? _db2BuildEvolutionPeriodSeries(scope) : _db2BuildEvolutionDaySeries(scope);
  const labels = series.labels || [];
  const gasData = series.expenseData || [];
  const incData = series.incomeData || [];
  const totalGastos = Number(scope?.totalExpenseArs) || (gasData[gasData.length-1] || 0);
  const totalIngresos = Number(scope?.totalIncomeArs) || (useMonthMode ? Math.max(...incData,0) : (series.totalIncome || 0));
  if(evoIng) evoIng.textContent = isMasked() ? '••••••••' : '$' + _fmtCompact(totalIngresos);
  if(evoGas) evoGas.textContent = isMasked() ? '••••••••' : '$' + _fmtCompact(totalGastos);

  // Compute 12-month averages
  const evoAvgInc = document.getElementById('db2-evo-avg-income');
  const evoAvgExp = document.getElementById('db2-evo-avg-expense');
  if(evoAvgInc || evoAvgExp){
    const now = new Date();
    const curMk = getMonthKey(now);
    // Income average from incomeMonths (the app's income records)
    const incEntries = (state.incomeMonths||[]).filter(m=>{
      if(!m.month) return false;
      const diff = (parseInt(curMk.split('-')[0])*12+parseInt(curMk.split('-')[1])) - (parseInt(m.month.split('-')[0])*12+parseInt(m.month.split('-')[1]));
      return diff >= 0 && diff < 12;
    });
    let avgInc = 0;
    if(incEntries.length && typeof getMonthTotalARS==='function'){
      const totalInc = incEntries.reduce((s,m)=>s+getMonthTotalARS(m)+(getMonthTotalUSD(m)*(USD_TO_ARS||1420)),0);
      avgInc = totalInc / incEntries.length;
    } else if((state.income?.ars||0)+(state.income?.varArs||0) > 0){
      avgInc = (state.income.ars||0)+(state.income.varArs||0);
    }
    // Expense average from transactions
    const monthlyExp = {};
    (state.transactions||[]).forEach(t=>{
      if(!t.date || t.currency !== 'ARS') return;
      if(t.isIncome || t.type==='income') return;
      const d = t.date instanceof Date ? t.date : new Date(String(t.date).includes('T') ? t.date : (String(t.date)+'T12:00:00'));
      if(isNaN(d.getTime())) return;
      const diffMs = now - d;
      if(diffMs < 0 || diffMs > 365.25*86400000) return;
      const mk = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      const amt = typeof getTxnPersonalAmount==='function' ? getTxnPersonalAmount(t) : t.amount;
      if(amt > 0) monthlyExp[mk] = (monthlyExp[mk]||0) + amt;
    });
    const expMonths = Object.keys(monthlyExp);
    const avgExp = expMonths.length ? expMonths.reduce((s,k)=>s+monthlyExp[k],0) / expMonths.length : 0;
    if(evoAvgInc) evoAvgInc.textContent = isMasked() ? '••••••••' : '$' + _fmtCompact(avgInc);
    if(evoAvgExp) evoAvgExp.textContent = isMasked() ? '••••••••' : '$' + _fmtCompact(avgExp);
  }
  if(titleEl) titleEl.textContent = useMonthMode ? 'Evolución por período' : 'Evolución del período';
  if(subTitleEl){
    subTitleEl.textContent = useMonthMode
      ? (series.subtitle || 'Gasto vs ingreso')
      : (scope.mode==='tc' ? 'Ingreso restante vs gasto acumulado del ciclo' : 'Ingreso restante vs gasto acumulado del período');
  }

  const maxValue = Math.max(...incData, ...gasData, 0);
  const yMax = Math.max(200000, Math.ceil(maxValue / 50000) * 50000);
  const gridColor = 'rgba(197, 206, 231, 0.7)';
  const tickColor = '#77819d';
  const tickFont  = {size:12, weight:'600', family:'-apple-system,SF Pro Display,sans-serif'};

  const chart = new Chart(ctx, {
    type: useMonthMode ? 'bar' : 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: incData,
          borderColor: '#56c683',
          backgroundColor: useMonthMode ? 'rgba(86,198,131,0.82)' : 'rgba(86,198,131,0.16)',
          borderWidth: useMonthMode ? 1.5 : 4,
          pointRadius: useMonthMode ? 0 : 7,
          pointHoverRadius: useMonthMode ? 0 : 7,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#56c683',
          pointBorderWidth: useMonthMode ? 0 : 4,
          tension: useMonthMode ? 0 : 0.42,
          fill: !useMonthMode,
          borderRadius: useMonthMode ? 10 : 0,
          maxBarThickness: useMonthMode ? 28 : undefined,
          categoryPercentage: useMonthMode ? 0.7 : undefined,
          barPercentage: useMonthMode ? 0.84 : undefined
        },
        {
          label: 'Gastos',
          data: gasData,
          borderColor: '#f36a2b',
          backgroundColor: useMonthMode ? 'rgba(243,106,43,0.82)' : 'rgba(243,106,43,0.16)',
          borderWidth: useMonthMode ? 1.5 : 4,
          pointRadius: useMonthMode ? 0 : 7,
          pointHoverRadius: useMonthMode ? 0 : 7,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#f36a2b',
          pointBorderWidth: useMonthMode ? 0 : 4,
          tension: useMonthMode ? 0 : 0.42,
          fill: !useMonthMode,
          borderRadius: useMonthMode ? 10 : 0,
          maxBarThickness: useMonthMode ? 28 : undefined,
          categoryPercentage: useMonthMode ? 0.7 : undefined,
          barPercentage: useMonthMode ? 0.84 : undefined
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ..._chartTooltip(),
          backgroundColor: '#1b2345',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 12,
          displayColors: true,
          callbacks: { label: c => ' ' + c.dataset.label + ': $' + fmtN(Math.round(c.parsed.y),0) }
        }
      },
      scales: {
        x: {
          ticks: {
            color: tickColor,
            font: tickFont,
            maxRotation: 0,
            minRotation: 0,
            padding: useMonthMode ? 10 : 16,
            autoSkip: false
          },
          grid: { display: false, drawBorder: false },
          border: { display: false }
        },
        y: {
          min: 0,
          max: yMax,
          ticks: {
            color: tickColor,
            font: tickFont,
            stepSize: 50000,
            padding: 16,
            callback: v => v === 0 ? '$0' : '$' + fmtN(v,0)
          },
          grid: {
            color: gridColor,
            drawBorder: false,
            borderDash: [4,6]
          },
          border: { display: false }
        }
      }
    }
  });

  if(state.charts) state.charts.evolution = chart;

  // Insight line
  const insightEl = document.getElementById('db2-evo-insight');
  if(insightEl){
    if(totalGastos > 0 && totalIngresos > 0){
      const remaining = totalIngresos - totalGastos;
      const remainingPct = totalIngresos > 0 ? Math.round(Math.abs(remaining) / totalIngresos * 100) : 0;
      const copy = remaining < 0
        ? `El gasto va <b>${remainingPct}%</b> por encima del ingreso del período.`
        : `Te queda <b>${remainingPct}%</b> del ingreso del período antes de agotarlo.`;
      insightEl.innerHTML = `<span class="db2-evo-insight-icon"><svg viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.44 1 1.08 1 1.8V17h6v-.5c0-.72.4-1.36 1-1.8A7 7 0 0 0 12 2Z"/></svg></span><span>${copy}</span>`;
      insightEl.style.display = 'flex';
    } else {
      insightEl.style.display = 'none';
    }
  }
}

// ── Categories donut ──
let _db2CatView = 'groups';
function setDb2CatView(view){
  _db2CatView = view;
  document.querySelectorAll('.db2-cat-view-btn').forEach(b => b.classList.toggle('active', b.id === 'db2-cat-view-'+view));
  renderDb2CatDonut();
}

function _db2CatBuildData(txns, view){
  const grouped = {};
  if(view === 'tags'){
    txns.filter(t => t.currency === 'ARS' && t.tags && t.tags.length).forEach(t => {
      const _pa = typeof getTxnPersonalAmount==='function' ? getTxnPersonalAmount(t) : t.amount;
      (t.tags||[]).forEach(tag => {
        if(!grouped[tag]) grouped[tag] = {total:0, color: typeof _tagColor==='function' ? _tagColor(tag) : '#6C5CE7'};
        grouped[tag].total += _pa;
      });
    });
  } else {
    txns.filter(t => t.currency === 'ARS' && t.category && t.category !== 'Procesando...' && t.category !== 'Uncategorized').forEach(t => {
      const _pa = typeof getTxnPersonalAmount==='function' ? getTxnPersonalAmount(t) : t.amount;
      if(view === 'subs'){
        const key = t.category;
        if(!grouped[key]) grouped[key] = {total:0, color: typeof catColor==='function' ? catColor(key) : '#666'};
        grouped[key].total += _pa;
      } else {
        const parent = typeof catGroup==='function' ? catGroup(t.category) : t.category;
        if(!grouped[parent]) grouped[parent] = {total:0, color: typeof catColor==='function' ? catColor(t.category) : '#666'};
        grouped[parent].total += _pa;
      }
    });
  }
  return grouped;
}

function renderDb2CatDonut(monthTxns){
  const ctx = document.getElementById('chart-cat-donut');
  if(!ctx) return;
  if(state.charts && state.charts.catDonut){ state.charts.catDonut.destroy(); state.charts.catDonut = null; }

  const txns = monthTxns || getCurrentMonthTxns();
  const grouped = _db2CatBuildData(txns, _db2CatView);

  const allSorted = Object.entries(grouped).filter(([,d]) => d.total > 0).sort((a,b) => b[1].total - a[1].total);
  const sorted = allSorted.slice(0,8);
  const total = allSorted.reduce((s,[,d]) => s + d.total, 0);
  const activeMonthKey=typeof getActiveDashMonth==='function'?getActiveDashMonth():getMonthKey(new Date());
  const [catYear,catMonth]=String(activeMonthKey||'').split('-').map(Number);
  const catMonthEl=document.getElementById('db2-cat-month');
  if(catMonthEl && catYear && catMonth){
    const dt=new Date(catYear,catMonth-1,1);
    catMonthEl.textContent=dt.toLocaleDateString('es-AR',{month:'long',year:'numeric'}).toUpperCase();
  }

  const viewTitles = {groups:'Categorías del Mes', subs:'Subcategorías del Mes', tags:'Tags del Mes'};
  const catTitleEl = document.querySelector('.db2-cat-card .db2-title');
  if(catTitleEl) catTitleEl.textContent = viewTitles[_db2CatView] || viewTitles.groups;

  const donutLblEl = document.querySelector('.db2-cat-donut-lbl');
  if(donutLblEl) donutLblEl.textContent = _db2CatView === 'tags' ? 'TAGS' : 'TOTAL';

  // Update donut total label
  const totalEl = document.getElementById('db2-cat-total');
  if(totalEl) {
    if(isMasked()) totalEl.textContent = '••••••••';
    else totalEl.textContent = total > 0 ? '$' + fmtN(Math.round(total),0) : '—';
  }

  const emptyMsgs = {groups:'Sin gastos categorizados', subs:'Sin gastos categorizados', tags:'Sin tags asignados'};
  if(!sorted.length){
    const listEl = document.getElementById('db2-cat-list');
    if(listEl) listEl.innerHTML = '<div style="font-size:12px;color:var(--text3)">'+(emptyMsgs[_db2CatView]||emptyMsgs.groups)+'</div>';
    return;
  }

  const DONUT_COLORS = ['#3f7dff','#6a35f2','#e64ac2','#f38a2f','#59c8b7','#3ca38c','#7ca8ff','#ffc463'];
  const colors = sorted.map(([,d],i) => d.color || DONUT_COLORS[i % DONUT_COLORS.length]);

  const getCategoryIconSvg = name => {
    const n=String(name||'').toLowerCase();
    if(n.includes('aliment')) return `<svg viewBox="0 0 24 24"><path d="M7 4v8"/><path d="M10 4v8"/><path d="M8.5 12v8"/><path d="M15 4v18"/><path d="M18 4c0 3-1.6 4.5-3 4.5S12 7 12 4"/></svg>`;
    if(n.includes('regal')) return `<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13"/><path d="M3 12h18"/><path d="M7.5 8C6 8 5 7 5 5.8 5 4.6 6 4 7.2 4c1.8 0 3 1.7 4.8 4"/><path d="M16.5 8c1.5 0 2.5-1 2.5-2.2 0-1.2-1-1.8-2.2-1.8-1.8 0-3 1.7-4.8 4"/></svg>`;
    if(n.includes('vida')||n.includes('social')) return `<svg viewBox="0 0 24 24"><path d="M12 20s-6.5-4.3-8.5-8A5.2 5.2 0 0 1 12 5.8 5.2 5.2 0 0 1 20.5 12C18.5 15.7 12 20 12 20Z"/></svg>`;
    if(n.includes('transp')) return `<svg viewBox="0 0 24 24"><path d="M5 16V9.5A2.5 2.5 0 0 1 7.5 7h9A2.5 2.5 0 0 1 19 9.5V16"/><path d="M3 16h18"/><circle cx="7" cy="17.5" r="1.7"/><circle cx="17" cy="17.5" r="1.7"/><path d="M7 12h10"/></svg>`;
    if(n.includes('educ')) return `<svg viewBox="0 0 24 24"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H12v16H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M20 6.5A2.5 2.5 0 0 0 17.5 4H12v16h5.5A2.5 2.5 0 0 1 20 22z"/></svg>`;
    return `<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="4"/><path d="M8 10h8"/><path d="M8 14h5"/></svg>`;
  };
  const getCategoryTone = index => {
    const tones=[
      {bg:'linear-gradient(180deg,#dbe8ff 0%,#cfdcff 100%)', color:'#3f7dff'},
      {bg:'linear-gradient(180deg,#ede7ff 0%,#e3dcff 100%)', color:'#6a35f2'},
      {bg:'linear-gradient(180deg,#f8e2f3 0%,#f2d8ee 100%)', color:'#e64ac2'},
      {bg:'linear-gradient(180deg,#fdebd9 0%,#f8e0c7 100%)', color:'#f38a2f'},
      {bg:'linear-gradient(180deg,#def5f1 0%,#d4f0ea 100%)', color:'#59c8b7'}
    ];
    return tones[index % tones.length];
  };

  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(([name]) => name),
      datasets: [{
        data: sorted.map(([,d]) => d.total),
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 0,
        hoverOffset: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: { ..._chartTooltip(), callbacks: {
          label: c => ' $' + fmtN(Math.round(c.parsed),0) + ' (' + Math.round(c.parsed/total*100) + '%)'
        }}
      }
    }
  });
  if(state.charts) state.charts.catDonut = chart;

  // Category / Sub / Tag list
  const listEl = document.getElementById('db2-cat-list');
  if(listEl){
    listEl.innerHTML = sorted.slice(0,5).map(([name,d],i) => {
      const pct = total > 0 ? Math.round(d.total/total*100) : 0;
      const color = colors[i];
      const tone = getCategoryTone(i);
      if(_db2CatView === 'tags'){
        const tc = typeof _tagColor==='function' ? _tagColor(name) : color;
        return `<div class="db2-cat-item ${i===0?'is-top':''}">
          <div class="db2-cat-iconbox" style="background:${tc}18;color:${tc}">
            <svg viewBox="0 0 24 24"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>
          </div>
          <div class="db2-cat-copy">
            <span class="db2-cat-name">${esc(name)}</span>
            <span class="db2-cat-amt">${isMasked() ? '••••••••' : '$' + fmtN(Math.round(d.total),0)}</span>
          </div>
          <span class="db2-cat-pct" style="color:${tc}">${pct}%</span>
        </div>`;
      }
      return `<div class="db2-cat-item ${i===0?'is-top':''}">
        <div class="db2-cat-iconbox" style="background:${tone.bg};color:${tone.color}">
          ${getCategoryIconSvg(name)}
        </div>
        <div class="db2-cat-copy">
          <span class="db2-cat-name">${esc(name)}</span>
          <span class="db2-cat-amt">${isMasked() ? '••••••••' : '$' + fmtN(Math.round(d.total),0)}</span>
        </div>
        <span class="db2-cat-pct" style="color:${color}">${pct}%</span>
      </div>`;
    }).join('');
  }

  // Bottom note — month-over-month comparison
  const noteEl = document.getElementById('db2-cat-note');
  if(noteEl){
    const prevTxns = typeof getTxnsFor==='function'
      ? getTxnsFor(getMonthKey(new Date(catYear, (catMonth||1)-2, 1)))
      : [];
    const prevGrouped = _db2CatBuildData(prevTxns||[], _db2CatView);
    const prevTotal = Object.values(prevGrouped).reduce((s,d)=>s+d.total,0);
    const deltaPct = prevTotal>0 ? ((total-prevTotal)/prevTotal)*100 : 0;
    const deltaText = `${Math.abs(deltaPct).toFixed(1).replace('.',',')}%`;
    noteEl.innerHTML = `<div class="db2-cat-note-icon">
      <svg viewBox="0 0 24 24"><path d="M4 18h16"/><path d="M7 15v-5"/><path d="M12 18V8"/><path d="M17 18v-9"/><path d="m8 8 3-3 3 3"/><path d="M11 5h6v6"/></svg>
    </div>
    <div class="db2-cat-note-copy">
      <div class="db2-cat-note-value">${deltaText} ${deltaPct>=0?'más':'menos'} que</div>
      <div class="db2-cat-note-text">el mes anterior</div>
    </div>`;
    noteEl.style.display = 'flex';
  }
}

// ── Agenda Viva widget ──
function renderDb2Agenda(timelineData){
  const listEl = document.getElementById('db2-agenda-list');
  const pillEl = document.getElementById('timeline-card-pill');
  if(!listEl) return;

  const cardEl = listEl.closest('.db2-agenda-card');
  const titleEl = cardEl?.querySelector('.db2-title');
  if(titleEl) titleEl.textContent = 'CALENDARIO';
  const headerEl = cardEl?.querySelector('.db2-hd');
  const cardHeight = cardEl?.getBoundingClientRect?.().height || 0;
  const availableHeight = cardHeight
    ? cardHeight - (headerEl?.offsetHeight || 42) - (pillEl?.offsetHeight || 42) - 54
    : 250;
  const maxVisible = Math.max(3, Math.min(7, Math.floor((availableHeight + 8) / 62) || 4));
  const events = getCalendarAgendaItems(new Date(),{includePast:false,includeDoneTasks:false}).slice(0, maxVisible);

  // Update pill count
  if(pillEl) pillEl.textContent = events.length + ' evento' + (events.length!==1?'s':'') + ' →';

  if(!events.length){
    listEl.innerHTML = '<div style="padding:12px 0;font-size:12px;color:var(--text3)">Sin eventos próximos</div>';
    return;
  }

  const getLogoProps = (name, type) => {
    const n = (name||'').toLowerCase();
    if(n.includes('netflix'))   return {bg:'#e50914', letter:'N'};
    if(n.includes('spotify'))   return {bg:'#1DB954', letter:'S'};
    if(n.includes('amazon'))    return {bg:'#ff9900', letter:'A'};
    if(n.includes('apple'))     return {bg:'#1c1c1e', letter:'🍎'};
    if(n.includes('google'))    return {bg:'#4285f4', letter:'G'};
    if(n.includes('disney'))    return {bg:'#113CCF', letter:'D'};
    if(n.includes('youtube'))   return {bg:'#ff0000', letter:'▶'};
    if(n.includes('sueldo')||n.includes('ingreso')||n.includes('cobro')) return {bg:'#30d158', letter:'$'};
    if(n.includes('alquiler'))  return {bg:'#ff9f0a', letter:'🏠'};
    if(n.includes('gym')||n.includes('gimnasio')||n.includes('megatlon')) return {bg:'#e63946', letter:'M'};
    if(n.includes('uca')||n.includes('ingles')) return {bg:'#003087', letter:'U'};
    if(n.includes('soporte')||n.includes('pc')||n.includes('tech')) return {bg:'#6366f1', letter:'💻'};
    if(type === 'close') return {bg:'#ff9f0a', letter:'💳'};
    if(type === 'due')   return {bg:'#ff3b30', letter:'!'};
    if(type === 'fixed') return {bg:'#7d3aec', letter:'📌'};
    if(type === 'task')  return {bg:'#4f46e5', letter:'✓'};
    const palette = ['#4361ee','#e63946','#2ec4b6','#7b2d8b','#0096c7','#ff6b6b'];
    const bg = palette[(name||'?').charCodeAt(0) % palette.length];
    return {bg, letter: (name||'?')[0].toUpperCase()};
  };

  listEl.innerHTML = events.map(e => {
    const when = e.days === 0 ? 'Hoy' : e.days === 1 ? 'Mañana' : `${e.days} días`;
    const urgentCls = e.days <= 2 ? 'urgent' : '';
    const name = e.shortLabel || e.title || 'Evento';
    const logo = getLogoProps(name, e.type);
    const amtStr = e.amount ? '-$' + (isMasked() ? '••••' : fmtN(Math.round(e.amount))) : '';
    const typeLabel = e.type === 'subscription' ? 'Suscripción' :
                      e.type === 'close'        ? 'Cierre TC'   :
                      e.type === 'due'          ? 'Vencimiento' :
                      e.type === 'fixed'        ? 'Gasto fijo'  :
                      e.type === 'task'         ? 'Task'        : 'Cuota';
    const descLine = [typeLabel, amtStr].filter(Boolean).join(' · ');
    const dayStr = e.date instanceof Date
      ? e.date.toLocaleDateString('es-AR',{day:'2-digit'})
      : '—';
    return `<button class="db2-agenda-item ${urgentCls}" type="button" onclick="nav('calendar')">
      <div class="db2-agenda-logo" style="background:${logo.bg}">${logo.letter}</div>
      <div class="db2-agenda-body">
        <div class="db2-agenda-name">${esc(name)}</div>
        <div class="db2-agenda-desc">${descLine}</div>
      </div>
      <div class="db2-agenda-right">
        <div class="db2-agenda-daynum">${dayStr}</div>
        <div class="db2-agenda-daylbl">${when}</div>
      </div>
    </button>`;
  }).join('');
}

// ── Gastos de terceros (recordatorios de cobro) ──
function renderDb2DueStrip(timelineData){
  const grid = document.getElementById('db2-third-grid');
  const summary = document.getElementById('db2-third-summary');
  if(!grid) return;

  const today = new Date();
  const toArs = (amount, currency) => ((currency || 'ARS') === 'USD'
    ? (Number(amount) || 0) * (USD_TO_ARS || 1420)
    : (Number(amount) || 0));
  const toDisplayAmount = (amount, currency) => `${(currency || 'ARS') === 'USD' ? 'U$D ' : '$'}${fmtN(Math.round(Number(amount) || 0))}`;
  const getAgeLabel = dateValue => {
    const d = new Date(String(dateValue).includes('T') ? dateValue : `${dateValue}T12:00:00`);
    if(Number.isNaN(d.getTime())) return 'sin fecha';
    const diff = Math.max(0, Math.round((today - d) / 86400000));
    if(diff === 0) return 'hoy';
    if(diff === 1) return 'hace 1 día';
    return `hace ${diff} días`;
  };
  const shortDate = dateValue => {
    const d = new Date(String(dateValue).includes('T') ? dateValue : `${dateValue}T12:00:00`);
    if(Number.isNaN(d.getTime())) return 'sin fecha';
    return d.toLocaleDateString('es-AR', {day:'2-digit', month:'short'}).replace('.', '');
  };
  const initials = text => {
    const base = String(text || '').trim();
    if(!base) return '$';
    const words = base.split(/\s+/).slice(0,2);
    const chars = words.map(w => (w[0] || '').toUpperCase()).join('');
    return chars || base.slice(0,1).toUpperCase();
  };
  const palette = ['#5B3BFF','#2D6BFF','#F97316','#14B8A6','#E11D48','#7C3AED'];

  // ── New shared-expense system: items per split (per-person) ──
  // Build BOTH pending and cobrado lists so the pills can act as filter tabs.
  const buildItems = (statusFilter) => (state.transactions || [])
    .filter(t => t.sharedExpense && t.sharedExpense.enabled && !t.isPendingCuota && !t.isPendingSubscription)
    .flatMap(t => {
      const splits = t.sharedExpense.splits || [];
      return splits
        .filter(s => statusFilter(s.status))
        .map(s => {
          const splitAmt = Number(s.amount) || 0;
          return {
            id: t.id + '-' + s.id,
            txnId: t.id,
            name: (s.name || '').trim() || '(sin nombre)',
            txnDesc: t.description || 'Gasto compartido',
            date: dateToYMD(t.date),
            currency: t.currency || 'ARS',
            pendingAmount: splitAmt,
            recoveredAmount: s.status === 'cobrado' ? splitAmt : 0,
            recoverBase: splitAmt,
            status: s.status === 'cobrado' ? 'cobrado' : 'pending',
            pendingArs: toArs(splitAmt, t.currency),
            totalArs: toArs(splitAmt, t.currency)
          };
        });
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const pendingItems = buildItems(status => status !== 'cobrado');
  const cobradoItems = buildItems(status => status === 'cobrado');

  const totalOpenArs = pendingItems.reduce((s, item) => s + item.pendingArs, 0);
  const totalCobradoArs = cobradoItems.reduce((s, item) => s + item.pendingArs, 0);
  const pendingCount = pendingItems.length;
  const cobradoCount = cobradoItems.length;

  // Active view: 'pending' (default) or 'cobrado'
  if (!state._dueStripView) state._dueStripView = 'pending';
  // Auto-fallback: if user is on pending view but there's nothing pending, stay on pending
  // (empty state will display). If on cobrado but no cobrado items, switch back to pending.
  if (state._dueStripView === 'cobrado' && cobradoCount === 0 && pendingCount > 0) {
    state._dueStripView = 'pending';
  }
  const activeView = state._dueStripView;

  if(summary){
    if (pendingCount === 0 && cobradoCount === 0) {
      summary.innerHTML = `
        <div class="db2-third-pill is-ok">
          <span class="db2-third-pill-label">Estado</span>
          <span class="db2-third-pill-value">Sin gastos compartidos</span>
        </div>`;
    } else {
      const maskedPending = isMasked() ? '$••••••' : `$${fmtN(Math.round(totalOpenArs))}`;
      const maskedCobrado = isMasked() ? '$••••••' : `$${fmtN(Math.round(totalCobradoArs))}`;
      summary.innerHTML = `
        <button type="button" class="db2-third-pill is-clickable${activeView === 'pending' ? ' is-active' : ''}" onclick="setDueStripView('pending')" title="Ver pendientes">
          <span class="db2-third-pill-label">Por cobrar</span>
          <span class="db2-third-pill-value">${maskedPending}</span>
        </button>
        <div class="db2-third-pill">
          <span class="db2-third-pill-label">Pendientes</span>
          <span class="db2-third-pill-value">${pendingCount}</span>
        </div>
        ${cobradoCount > 0 ? `
        <button type="button" class="db2-third-pill is-cobrado is-clickable${activeView === 'cobrado' ? ' is-active' : ''}" onclick="setDueStripView('cobrado')" title="Ver cobrados">
          <span class="db2-third-pill-label">Cobrado</span>
          <span class="db2-third-pill-value">$${fmtN(Math.round(totalCobradoArs))}</span>
        </button>` : ''}
      `;
    }
  }

  // Pick which list to render based on the active view
  const itemsToRender = activeView === 'cobrado' ? cobradoItems : pendingItems;
  const isCobradoView = activeView === 'cobrado';

  if (!itemsToRender.length) {
    grid.innerHTML = `
      <div class="db2-third-empty">
        ${isCobradoView
          ? 'Todavía no marcaste ninguna parte como cobrada. Cuando lo hagas, aparece acá.'
          : 'No tenés gastos compartidos pendientes. Cuando dividas un gasto en Movimientos, aparece acá como recordatorio.'}
      </div>`;
    return;
  }

  // ── Group items by person (same name = same person) ──
  // If a person owes/paid from multiple txns, group them under one card.
  // Click expands to show the breakdown of each individual transaction.
  const groupedByPerson = new Map();
  itemsToRender.forEach(item => {
    const key = item.name.toLowerCase().trim();
    if (!groupedByPerson.has(key)) {
      groupedByPerson.set(key, {
        name: item.name,
        items: [],
        totalArs: 0,
        // We track per-currency totals so the display can be honest
        // when amounts span ARS and USD.
        totalsByCurrency: {}
      });
    }
    const g = groupedByPerson.get(key);
    g.items.push(item);
    g.totalArs += item.pendingArs;
    const cur = item.currency || 'ARS';
    g.totalsByCurrency[cur] = (g.totalsByCurrency[cur] || 0) + (Number(item.pendingAmount) || 0);
  });
  const personGroups = Array.from(groupedByPerson.values())
    .sort((a, b) => b.totalArs - a.totalArs);

  // Track which person rows are expanded — persist across re-renders
  if (!state._dueStripExpanded) state._dueStripExpanded = {};

  // Helper: render currency totals for a person ("$50.000  +  USD 30")
  const formatPersonTotal = g => {
    const parts = Object.entries(g.totalsByCurrency)
      .filter(([, v]) => v > 0)
      .map(([cur, v]) => isMasked()
        ? (cur === 'USD' ? 'U$D ••••' : '$••••••')
        : toDisplayAmount(v, cur));
    return parts.join('  +  ') || '—';
  };

  const VISIBLE_LIMIT = 9;
  const visiblePersons = personGroups.slice(0, VISIBLE_LIMIT);

  grid.innerHTML = visiblePersons.map((g, i) => {
    const color = palette[i % palette.length];
    const itemClass = isCobradoView ? 'cobrado' : 'pending';
    const personKey = g.name.toLowerCase().trim() + '::' + activeView;
    const isExpanded = !!state._dueStripExpanded[personKey];
    const totalDisplay = formatPersonTotal(g);
    const txnCount = g.items.length;
    const metaLabel = isCobradoView ? 'cobrado' : 'pendiente';
    const metaText = txnCount === 1
      ? `${esc(g.items[0].txnDesc)}`
      : `${txnCount} movimientos · ${metaLabel}${txnCount !== 1 ? 's' : ''}`;

    // Breakdown rows (only rendered when expanded)
    const breakdown = isExpanded
      ? `<div class="db2-third-breakdown">${g.items.map(item => `
          <button class="db2-third-bd-row" onclick="event.stopPropagation();openTxnDetail('${item.txnId}')" title="Ver gasto compartido">
            <div class="db2-third-bd-info">
              <div class="db2-third-bd-desc">${esc(item.txnDesc)}</div>
              <div class="db2-third-bd-date">${shortDate(item.date)} · ${getAgeLabel(item.date)}</div>
            </div>
            <div class="db2-third-bd-amount">${isMasked() ? (item.currency === 'USD' ? 'U$D ••••' : '$••••••') : toDisplayAmount(item.pendingAmount, item.currency)}</div>
          </button>`).join('')}</div>`
      : '';

    return `<div class="db2-third-item-wrap">
      <button class="db2-third-item ${itemClass} ${isExpanded ? 'is-expanded' : ''}" onclick="toggleDueStripPerson('${personKey}')" title="${txnCount > 1 ? 'Click para ver el desglose' : 'Click para expandir'}">
        <div class="db2-third-avatar" style="background:${color}">${initials(g.name)}</div>
        <div class="db2-third-body">
          <div class="db2-third-name">${esc(g.name)}</div>
          <div class="db2-third-meta">${metaText}</div>
        </div>
        <div class="db2-third-amount">${totalDisplay}</div>
        <div class="db2-third-chip">${txnCount > 1 ? `${txnCount} ${isExpanded ? '▴' : '▾'}` : ''}</div>
      </button>
      ${breakdown}
    </div>`;
  }).join('');

  if (personGroups.length > VISIBLE_LIMIT) {
    const remaining = personGroups.length - VISIBLE_LIMIT;
    grid.innerHTML += `
      <button class="db2-third-more" onclick="openThirdPartyTransactions()">
        Ver ${remaining} persona${remaining !== 1 ? 's' : ''} más →
      </button>`;
  }
}

// Toggle expand/collapse of a person row in the Gastos Compartidos widget
function toggleDueStripPerson(personKey){
  if (!state._dueStripExpanded) state._dueStripExpanded = {};
  state._dueStripExpanded[personKey] = !state._dueStripExpanded[personKey];
  // No saveState — this is UI-only ephemeral state. Re-render the widget.
  if (typeof renderDashboard === 'function') renderDashboard();
}

// Toggle view in the dashboard "Gastos Compartidos" widget
function setDueStripView(view){
  state._dueStripView = view === 'cobrado' ? 'cobrado' : 'pending';
  saveState();
  // Re-render just this widget — the calling context provides the data.
  // The cheapest reliable path is to re-render the whole dashboard.
  if(typeof renderDashboard === 'function') renderDashboard();
}

// ── Dollar sparkline ──
function renderDb2DollarSparkline(){
  const ctx = document.getElementById('db2-dollar-spark');
  if(!ctx) return;
  if(state.charts && state.charts.dollarSpark){ state.charts.dollarSpark.destroy(); state.charts.dollarSpark = null; }
  const emptyEl = document.getElementById('db2-dollar-empty');
  const changeEl = document.getElementById('db2-dollar-change');
  const history = (state.usdRateHistory || []).filter(item => item && Number(item.sell) > 0);
  let points = history.slice(-15).map(item => Number(item.sell));
  const hasRealHistory = points.length >= 2;

  if(points.length < 2){
    const currentSell = Number(state.usdRateSell || state.usdRate || USD_TO_ARS || 0);
    if(currentSell > 0){
      points = [currentSell, currentSell];
    }else{
      ctx.style.display = 'none';
      if(emptyEl) emptyEl.style.display = 'grid';
      if(changeEl) changeEl.textContent = '—';
      return;
    }
  }

  ctx.style.display = '';
  if(emptyEl) emptyEl.style.display = 'none';
  const first = points[0];
  const last = points[points.length - 1];
  const variation = first > 0 ? ((last - first) / first) * 100 : 0;
  
  if(changeEl && hasRealHistory){
    const sign = variation >= 0 ? '+' : '';
    changeEl.textContent = sign + variation.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}) + '%';
    changeEl.classList.toggle('down', variation < 0);
    changeEl.style.color = variation < 0 ? '#ff453a' : '#30d158'; // iOS style colors
  }else if(changeEl){
    changeEl.textContent = '—';
    changeEl.classList.remove('down');
    changeEl.style.color = '';
  }

  // Create gradient
  const chartCtx = ctx.getContext('2d');
  const gradient = chartCtx.createLinearGradient(0, 0, 0, 118);
  gradient.addColorStop(0, 'rgba(48, 209, 88, 0.22)');
  gradient.addColorStop(1, 'rgba(48, 209, 88, 0.02)');

  const c = new Chart(ctx, {
    type:'line',
    data:{
      labels: points.map((_,i)=>i),
      datasets:[{
        data: points,
        borderColor: '#30d158',
        borderWidth: 2.8,
        pointRadius: (context) => (context.dataIndex === points.length - 1 ? 4.5 : 0),
        pointBackgroundColor: '#30d158',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        fill: true,
        backgroundColor: gradient,
        tension: 0.4,
        capBezierPoints: true
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      animation:{ duration: 800, easing: 'easeOutQuart' },
      plugins:{
        legend:{display:false},
        tooltip:{
          enabled: true,
          mode: 'index',
          intersect: false,
          ..._chartTooltip(),
          callbacks: {
            label: (context) => ` $${fmtN(context.parsed.y,0)}`
          }
        }
      },
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales:{
        x:{display:false},
        y:{
          display:false,
          min: Math.min(...points) * 0.998,
          max: Math.max(...points) * 1.002
        }
      },
      elements: {
        line: { borderCapStyle: 'round' }
      }
    }
  });
  if(state.charts) state.charts.dollarSpark = c;
}

// ── Main caller — appended at end of renderDashboard ──
function renderDb2Dashboard(data){
  // data: { arsMonth, usdMonth, margen, pct, incTotalARS, spendBudget,
  //         projected, totalGastoARS, daysLeft, dailyRate, projPeriodClose,
  //         timelineData, monthTxns, thirdPartyTxns }
  _db2EvolutionState = data.evolutionData || null;
  renderDb2HeroExtras(data.arsMonth, data.usdMonth, data.margen, data.pct, data.incTotalARS, data.spendBudget, data.thirdPartyTxns);
  renderDb2CcCycles(data.ccWidgetData);
  renderDb2ProjExtras(data.projected, data.totalGastoARS, data.incTotalARS, data.spendBudget, data.daysLeft, data.dailyRate, data.projPeriodClose);
  renderDb2Agenda(data.timelineData);
  renderDb2EvolutionChart();
  renderDb2CatDonut(data.monthTxns);
  renderDb2DueStrip(data.timelineData);
  renderDb2DollarSparkline();
  enforceDashboardPrivacyMask();
  renderMobileDashboard(data);
}
