// ══ INSIGHTS ENGINE ══
// Análisis financiero local — sin IA, instantáneo, 100% basado en datos reales

// ── Entry point ──────────────────────────────────────────
function generateInsights() {
  const txns = (state.transactions||[]).filter(t => !t.isPendingCuota);
  const emptyEl   = document.getElementById('insights-empty');
  const contentEl = document.getElementById('insights-content');
  const configShell = document.getElementById('insights-config-shell');
  const generalShell = document.getElementById('insights-general-shell');
  const savingsShell = document.getElementById('insights-savings-shell');
  const wealthShell = document.getElementById('insights-wealth-shell');
  if(!txns.length) {
    if(emptyEl)  emptyEl.style.display = 'flex';
    if(contentEl) contentEl.style.display = 'none';
    return;
  }
  if(emptyEl)  emptyEl.style.display = 'none';
  if(contentEl) contentEl.style.display = 'flex';

  const data = _computeInsightsData();
  if(configShell) _renderInsightsConfig(data);
  const view = state.insightsView || 'general';
  const generalBtn = document.getElementById('insights-tab-general');
  const savingsBtn = document.getElementById('insights-tab-ahorro');
  const wealthBtn = document.getElementById('insights-tab-salud');
  if(generalBtn) generalBtn.classList.toggle('active', view === 'general');
  if(savingsBtn) savingsBtn.classList.toggle('active', view === 'ahorro');
  if(wealthBtn) wealthBtn.classList.toggle('active', view === 'salud');
  if(generalShell) generalShell.style.display = view === 'general' ? 'flex' : 'none';
  if(savingsShell) savingsShell.style.display = view === 'ahorro' ? 'flex' : 'none';
  if(wealthShell) wealthShell.style.display = view === 'salud' ? 'flex' : 'none';

  if(view === 'ahorro'){
    _renderSavingsMode(data);
  } else if(view === 'salud'){
    _renderWealthMode(data);
  } else {
    _renderScoreCard(data);
    _renderChallenges(data);
    _renderInsightsChart(data);
    _renderAllInsightSections(data);
  }
  showToast('✓ Insights actualizados','success');
}

// Legacy stub kept for any old callers
function setInsightTab(tab) {
  state.insightsView = tab === 'ahorro' ? 'ahorro' : tab === 'salud' ? 'salud' : 'general';
  saveState();
  generateInsights();
}

function _getInsightsTargets(){
  const saveTargetPct = Math.max(5, Math.min(40, Number(state.savingsGoal) || 20));
  let spendCapPct = Number(state.spendPct);
  if(!isFinite(spendCapPct) || spendCapPct >= 100) spendCapPct = Math.max(55, 100 - saveTargetPct);
  spendCapPct = Math.max(50, Math.min(95, spendCapPct));
  const bufferMonths = Math.max(1, Math.min(12, Number(state.insightsBufferMonths) || 3));
  return { saveTargetPct, spendCapPct, bufferMonths };
}

function saveInsightsPreferences(){
  const saveInput = document.getElementById('ins-pref-save');
  const spendInput = document.getElementById('ins-pref-spend');
  const bufferInput = document.getElementById('ins-pref-buffer');
  const saveTargetPct = Math.max(5, Math.min(40, Number(saveInput?.value) || 20));
  const spendCapPct = Math.max(50, Math.min(95, Number(spendInput?.value) || Math.max(55, 100 - saveTargetPct)));
  const bufferMonths = Math.max(1, Math.min(12, Number(bufferInput?.value) || 3));
  state.savingsGoal = saveTargetPct;
  state.spendPct = spendCapPct;
  state.insightsBufferMonths = bufferMonths;
  saveState();
  generateInsights();
  showToast('✓ Objetivos de insights actualizados', 'success');
}

function _renderInsightsConfig(data){
  const el = document.getElementById('insights-config-shell');
  if(!el) return;
  const { saveTargetPct, spendCapPct, bufferMonths } = _getInsightsTargets();
  const projectedSavings = data.incomeARS > 0 ? Math.round(data.incomeARS - data.projectedMonth) : null;
  const projectedSpendPct = data.incomeARS > 0 ? Math.round((data.projectedMonth / data.incomeARS) * 100) : null;
  const actualSavePct = data.incomeARS > 0 ? Math.round(((data.incomeARS - data.projectedMonth) / data.incomeARS) * 100) : null;
  el.innerHTML = `
    <div class="insights-panel-kicker">Cómo querés que te mida la app</div>
    <div class="insights-panel-sub">Definí tus objetivos base para que el score, el modo ahorro y la salud patrimonial hablen de tu realidad y no de un estándar genérico. La app va a comparar tu cierre proyectado y tu ahorro esperado contra estos límites.</div>
    <div class="insights-config-grid">
      <div class="insights-config-item">
        <label>Meta de ahorro mensual (%)</label>
        <input id="ins-pref-save" type="number" min="5" max="40" step="1" class="input-field" value="${saveTargetPct}">
      </div>
      <div class="insights-config-item">
        <label>Tope de gasto sobre ingreso (%)</label>
        <input id="ins-pref-spend" type="number" min="50" max="95" step="1" class="input-field" value="${spendCapPct}">
      </div>
      <div class="insights-config-item">
        <label>Colchón deseado (meses)</label>
        <input id="ins-pref-buffer" type="number" min="1" max="12" step="1" class="input-field" value="${bufferMonths}">
      </div>
    </div>
    <div class="settings-module-actions" style="margin-top:14px;">
      <button class="btn btn-primary btn-sm" onclick="saveInsightsPreferences()">Guardar objetivos</button>
    </div>
    <div class="insights-config-help">
      <div class="insights-config-help-card">
        <div class="insights-config-help-title">Plata que te quedaría</div>
        <div class="insights-config-help-body">${projectedSavings===null ? 'Se calcula cuando cargás ingresos: es lo que te quedaría al cierre si seguís gastando al ritmo actual.' : `Hoy proyectás cerrar con <strong>$${fmtN(projectedSavings)}</strong> libres. Eso equivale a <strong>${actualSavePct}%</strong> de tu ingreso.`}</div>
      </div>
      <div class="insights-config-help-card">
        <div class="insights-config-help-title">Meta para guardar</div>
        <div class="insights-config-help-body">Es tu meta mensual de ahorro según esta configuración. Hoy la app te va a empujar a guardar <strong>${saveTargetPct}% de lo que entra</strong> y a no pasar de <strong>${spendCapPct}% de gasto</strong>.</div>
      </div>
      <div class="insights-config-help-card">
        <div class="insights-config-help-title">Salud financiera</div>
        <div class="insights-config-help-body">${projectedSpendPct===null ? 'No premia solo “gastar poco”. También mira si ahorrás, si tus cuotas pesan demasiado y si tenés colchón para aguantar meses más duros.' : `Hoy tu cierre proyectado va por <strong>${projectedSpendPct}% del ingreso</strong>. El score compara eso contra tu límite, además del ahorro, las cuotas y el colchón.`}</div>
      </div>
    </div>
  `;
}

// ── Data computation ──────────────────────────────────────
function _computeInsightsData() {
  const today  = new Date();
  const txns   = (state.transactions||[]).filter(t => !t.isPendingCuota);
  const MNAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const currentMonth = getMonthKey(today);
  const prevMonth    = getMonthKey(new Date(today.getFullYear(), today.getMonth()-1, 1));

  const monthTxns = txns.filter(t => (t.month||getMonthKey(t.date)) === currentMonth);
  const prevTxns  = txns.filter(t => (t.month||getMonthKey(t.date)) === prevMonth);

  const arsThis = monthTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const arsPrev = prevTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const usdThis = monthTxns.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);

  // Category totals
  const catThis={}, catPrev={};
  monthTxns.filter(t=>t.currency==='ARS'&&t.category&&t.category!=='Procesando...').forEach(t=>{ catThis[t.category]=(catThis[t.category]||0)+t.amount; });
  prevTxns.filter(t=>t.currency==='ARS'&&t.category&&t.category!=='Procesando...').forEach(t=>{  catPrev[t.category]=(catPrev[t.category]||0)+t.amount;  });
  const topCats    = Object.entries(catThis).sort((a,b)=>b[1]-a[1]);
  const growingCats = Object.entries(catThis)
    .filter(([c,v])=>catPrev[c]>0)
    .map(([c,v])=>({cat:c,current:v,prev:catPrev[c],pctChange:Math.round((v-catPrev[c])/catPrev[c]*100)}))
    .sort((a,b)=>b.pctChange-a.pctChange);

  // Day-of-week spending
  const dayTotals=[0,0,0,0,0,0,0];
  const dayNames=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  monthTxns.filter(t=>t.currency==='ARS').forEach(t=>{ dayTotals[new Date(t.date).getDay()]+=t.amount; });
  const maxDayAmt=Math.max(...dayTotals);
  const topDay=maxDayAmt>0?dayTotals.indexOf(maxDayAmt):-1;

  // Income — ARS + USD converted, from incomeSources or incomeMonths or legacy income object
  let incomeARS = 0;
  if(state.incomeMonths && state.incomeMonths.length) {
    // Use incomeMonths for the current month if available
    const _activeInc = state.incomeMonths.find(m => m.month === currentMonth) || [...state.incomeMonths].sort((a,b) => b.month.localeCompare(a.month))[0];
    if(_activeInc) {
      incomeARS = (typeof getMonthTotalARS === 'function' ? getMonthTotalARS(_activeInc) : 0) + (typeof getMonthTotalUSD === 'function' ? getMonthTotalUSD(_activeInc) : 0) * (USD_TO_ARS||1500);
    }
  } else if((state.incomeSources||[]).length) {
    incomeARS = (state.incomeSources||[]).reduce((s,src)=>{
        if(src.active===false) return s;
        const monthly = src.freq==='annual' ? (src.amount/12) : src.amount;
        return s + (src.currency==='USD' ? monthly*(USD_TO_ARS||1500) : monthly);
      }, 0);
  } else {
    // Legacy: include BOTH ARS and USD income
    incomeARS = ((state.income?.ars||0) + (state.income?.varArs||0)) + ((state.income?.usd||0) + (state.income?.varUsd||0))*(USD_TO_ARS||1500);
  }
  
  // Ensure we don't have 0 income if we have sources (fallback)
  if(incomeARS <= 0 && (state.incomeSources||[]).length) {
    incomeARS = state.incomeSources.reduce((s,src)=> s + (src.currency==='USD' ? src.amount*(USD_TO_ARS||1500) : src.amount), 0);
  }

  const spendPct=incomeARS>0?Math.round(arsThis/incomeARS*100):null;

  // Days
  const daysInMonth=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
  const daysPassed=today.getDate();
  const daysLeft=daysInMonth-daysPassed;
  const dayAvg=daysPassed>0?arsThis/daysPassed:0;
  const projectedMonth=Math.round(dayAvg*daysInMonth);
  const daysWithSpending=new Set(monthTxns.map(t=>new Date(t.date).getDate())).size;
  const daysWithout=daysPassed-daysWithSpending;
  const momChange=arsPrev>0?Math.round((arsThis-arsPrev)/arsPrev*100):null;

  // Cuotas (Installments) — Sum physical payments + upcoming/manual ones
  const cuotasTxns=monthTxns.filter(t=>t.cuotaNum || t.cuotaGroupId);
  let cuotasTotal=cuotasTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  
  // Supplement with detectable quotas not yet paid this month
  try {
    const autoGroups=typeof detectAutoCuotas==='function'?detectAutoCuotas():[];
    autoGroups.forEach(g=>{
      const snap=typeof getAutoCuotaSnapshot==='function'?getAutoCuotaSnapshot(g):null;
      if(!snap||snap.paid>=snap.total) return;
      const groupId=g.transactions?.[0]?.cuotaGroupId||null;
      const alreadyPaid = monthTxns.some(t => (groupId&&t.cuotaGroupId===groupId) || (t.description.includes(g.name) && t.amount === snap.amountPerCuota));
      if(!alreadyPaid) cuotasTotal += ((g.currency === 'USD' ? snap.amountPerCuota * (USD_TO_ARS||1500) : snap.amountPerCuota) || 0);
    });
    (state.cuotas||[]).forEach(c=>{
       if(c.paid < c.total) {
         const alreadyPaid = monthTxns.some(t => t.description.includes(c.name));
         if(!alreadyPaid) cuotasTotal += (c.currency === 'USD' ? c.amount * (USD_TO_ARS||1500) : c.amount);
       }
    });
  } catch(e){}
  
  const cuotasPct=incomeARS>0?Math.round(cuotasTotal/incomeARS*100):null;

  // Fixed expenses
  const fixedTotal=(state.fixedExpenses||[]).reduce((s,f)=>s+(f.currency==='USD'?f.amount*(USD_TO_ARS||1500):f.amount),0);
  const fixedPct=incomeARS>0?Math.round(fixedTotal/incomeARS*100):null;

  // Subscriptions
  const subsTotal=(state.subscriptions||[]).reduce((s,sub)=>{
    if(sub.active===false)return s;
    const monthly=sub.freq==='annual'?sub.amount/12:sub.amount;
    return s+(sub.currency==='USD'?monthly*(USD_TO_ARS||1500):monthly);
  },0);

  // Upcoming cuota payments
  const upcomingPayments=[];
  try {
    const autoGroups=typeof detectAutoCuotas==='function'?detectAutoCuotas():[];
    autoGroups.forEach(g=>{
      const cfg=(state.autoCuotaConfig||{})[g.key]||{};
      if(!cfg.day)return;
      const snap=typeof getAutoCuotaSnapshot==='function'?getAutoCuotaSnapshot(g):null;
      if(snap&&snap.paid<snap.total) upcomingPayments.push({name:g.name,daysUntil:getDaysUntilNext(cfg.day),amount:snap.amountPerCuota});
    });
    (state.cuotas||[]).forEach(c=>{
      if(c.day&&c.paid<c.total) upcomingPayments.push({name:c.name,daysUntil:getDaysUntilNext(c.day),amount:c.amount});
    });
    upcomingPayments.sort((a,b)=>a.daysUntil-b.daysUntil);
  } catch(e){}

  // Historical monthly
  const allMonths=[...new Set(txns.map(t=>t.month||getMonthKey(t.date)))].sort();
  const monthlyData=allMonths.map(m=>({
    month:m,
    label:MNAMES[parseInt(m.split('-')[1])-1]+' '+m.split('-')[0].slice(2),
    total:txns.filter(t=>(t.month||getMonthKey(t.date))===m&&t.currency==='ARS').reduce((s,t)=>s+t.amount,0)
  }));
  const avgMonthly=monthlyData.length>0?monthlyData.reduce((s,m)=>s+m.total,0)/monthlyData.length:0;

  // Largest txn this month
  const largestTxn=monthTxns.filter(t=>t.currency==='ARS').sort((a,b)=>b.amount-a.amount)[0]||null;

  // USD exposure
  const usdInARS=usdThis*(USD_TO_ARS||1500);
  const totalInARS=arsThis+usdInARS;
  const usdExposurePct=totalInARS>0?Math.round(usdInARS/totalInARS*100):0;

  // Pending cuotas next month
  const nextMonthKey=getMonthKey(new Date(today.getFullYear(),today.getMonth()+1,1));
  const nextMonthCuotas=(state.transactions||[]).filter(t=>t.isPendingCuota&&t.currency==='ARS'&&(t.month||getMonthKey(t.date))===nextMonthKey);
  const nextCuotasTotal=nextMonthCuotas.reduce((s,t)=>s+t.amount,0);

  return {
    today,MNAMES,currentMonth,prevMonth,
    monthTxns:monthTxns.length,prevTxnsCount:prevTxns.length,
    arsThis,arsPrev,usdThis,usdInARS,usdExposurePct,
    topCats,catThis,catPrev,growingCats,
    dayTotals,dayNames,topDay,maxDayAmt,
    incomeARS,spendPct,
    daysInMonth,daysPassed,daysLeft,
    dayAvg,projectedMonth,
    daysWithSpending,daysWithout,
    momChange,
    cuotasTotal,cuotasPct,cuotasTxns:cuotasTxns.length,
    fixedTotal,fixedPct,
    subsTotal,
    upcomingPayments,
    avgMonthly,monthlyData,
    largestTxn,
    nextCuotasTotal,nextMonthCuotas:nextMonthCuotas.length
  };
}

function _renderWealthMode(data){
  const el = document.getElementById('insights-wealth-shell');
  if(!el) return;
  const health = _getHealthScore(data);
  const { bufferMonths } = _getInsightsTargets();
  const savAccounts = state.savAccounts || [];
  const savGoals = state.savGoals || [];
  const totalSavingsARS = savAccounts.reduce((sum, acc) => sum + (acc.currency==='USD' ? (acc.balance||0)*(USD_TO_ARS||1500) : (acc.balance||0)), 0);
  const totalGoalsARS = savGoals.reduce((sum, goal) => sum + (goal.currency==='USD' ? (goal.target||0)*(USD_TO_ARS||1500) : (goal.target||0)), 0);
  const totalGoalsCurrentARS = savGoals.reduce((sum, goal) => sum + (goal.currency==='USD' ? (goal.current||0)*(USD_TO_ARS||1500) : (goal.current||0)), 0);
  const autoGroups = typeof detectAutoCuotas === 'function' ? detectAutoCuotas() : [];
  const autoDebt = autoGroups.reduce((sum,g)=>{
    const snap = typeof getAutoCuotaSnapshot==='function' ? getAutoCuotaSnapshot(g) : null;
    if(!snap) return sum;
    const remaining = Math.max(0, (snap.total - snap.paid) * (snap.amountPerCuota || 0));
    return sum + ((g.currency==='USD') ? remaining*(USD_TO_ARS||1500) : remaining);
  },0);
  const manualDebt = (state.cuotas||[]).reduce((sum,c)=>{
    const remaining = Math.max(0, ((c.total||0) - (c.paid||0)) * (c.amount||0));
    return sum + ((c.currency==='USD') ? remaining*(USD_TO_ARS||1500) : remaining);
  },0);
  const totalDebtARS = autoDebt + manualDebt;
  const projectedSavings = data.incomeARS > 0 ? Math.max(0, data.incomeARS - data.projectedMonth) : 0;
  const netPatrimony = totalSavingsARS + projectedSavings - totalDebtARS;
  const liquidityMonths = data.avgMonthly > 0 ? ((totalSavingsARS + projectedSavings) / data.avgMonthly) : 0;
  const goalProgressPct = totalGoalsARS > 0 ? Math.round((totalGoalsCurrentARS / totalGoalsARS) * 100) : 0;

  const patrimonySeries = data.monthlyData.slice(-6).map((m, idx)=>{
    const cumulativeSpend = data.monthlyData.slice(0, data.monthlyData.findIndex(x=>x.month===m.month)+1).reduce((s,item)=>s+item.total,0);
    const estimatedBase = totalSavingsARS - (data.arsThis - m.total);
    return {
      label: m.label,
      value: Math.max(0, estimatedBase - Math.max(0, cumulativeSpend * 0.02) + (idx===data.monthlyData.slice(-6).length-1 ? projectedSavings : 0))
    };
  });

  const healthFactors = [
    `Score actual: <strong>${health.score}</strong> · ${health.label}`,
    `Patrimonio neto estimado: <strong>$${fmtN(Math.round(netPatrimony))}</strong>`,
    `Deuda activa restante: <strong>$${fmtN(Math.round(totalDebtARS))}</strong>`,
    `Liquidez estimada: <strong>${liquidityMonths ? liquidityMonths.toFixed(1) : '0.0'} meses</strong> de gasto promedio (objetivo: ${bufferMonths} meses)`
  ];

  el.innerHTML = `
    <div class="fade-up d1 savings-hero-shell">
      <div class="insights-panel-kicker">Salud y patrimonio</div>
      <div class="savings-hero-title">Cómo está tu estructura financiera hoy</div>
      <div class="savings-hero-copy">Esta vista junta score financiero, ahorro acumulado, deuda activa y liquidez. La idea es responder una pregunta simple: si mañana se complica un mes, ¿qué tan parado estás?</div>
      <div class="savings-metric-grid">
        <div class="savings-metric-card">
          <div class="savings-metric-label">Lo que te quedaría si pagás todo</div>
          <div class="savings-metric-value ${netPatrimony < 0 ? 'bad' : ''}">$${fmtN(Math.round(netPatrimony))}</div>
          <div class="savings-metric-sub">lo que te quedaría si sumás ahorro registrado, proyección del período y restás la deuda pendiente</div>
        </div>
        <div class="savings-metric-card">
          <div class="savings-metric-label">Ahorro ya guardado</div>
          <div class="savings-metric-value">$${fmtN(Math.round(totalSavingsARS))}</div>
          <div class="savings-metric-sub">plata que hoy ya registraste como ahorro disponible</div>
        </div>
        <div class="savings-metric-card">
          <div class="savings-metric-label">Deuda que todavía debés</div>
          <div class="savings-metric-value ${totalDebtARS > 0 ? 'bad' : ''}">$${fmtN(Math.round(totalDebtARS))}</div>
          <div class="savings-metric-sub">todo lo que todavía te queda pagar en cuotas</div>
        </div>
        <div class="savings-metric-card">
          <div class="savings-metric-label">Meses que aguantarías</div>
          <div class="savings-metric-value">${liquidityMonths ? liquidityMonths.toFixed(1) : '0.0'}x</div>
          <div class="savings-metric-sub">cuántos meses promedio podrías cubrir con tu ahorro actual</div>
        </div>
      </div>
    </div>

    <div class="fade-up d2 savings-split-grid">
      <div class="insights-panel-shell">
        <div class="insights-panel-kicker">Lectura patrimonial</div>
        <div class="insights-panel-sub">Las variables que hoy mejor describen tu situación</div>
        <div class="savings-week-plan">
          ${healthFactors.map((item, idx)=>`
            <div class="savings-week-step">
              <div class="savings-week-index">0${idx+1}</div>
              <div class="savings-week-copy">${item}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="insights-panel-shell">
        <div class="insights-panel-kicker">Metas y cobertura</div>
        <div class="insights-panel-sub">Qué tan respaldado está tu plan financiero</div>
        <div class="savings-advice-grid">
          <div class="savings-advice-card savings-advice-good">
            <div class="savings-advice-title">Progreso de metas</div>
            <div class="savings-advice-body">${totalGoalsARS > 0 ? `Llevás cubierto <strong>${goalProgressPct}%</strong> del total de tus metas registradas.` : 'Todavía no definiste metas de ahorro en la app.'}</div>
          </div>
          <div class="savings-advice-card savings-advice-info">
            <div class="savings-advice-title">Cobertura operativa</div>
            <div class="savings-advice-body">${liquidityMonths >= bufferMonths ? `Tenés una cobertura razonable para absorber meses más pesados.` : `Tu colchón todavía es corto frente al objetivo de ${bufferMonths} meses: conviene priorizar liquidez antes de sumar más compromisos.`}</div>
          </div>
          <div class="savings-advice-card savings-advice-${health.score >= 70 ? 'good' : 'warn'}">
            <div class="savings-advice-title">Salud financiera</div>
            <div class="savings-advice-body">${health.desc}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="fade-up d3 insights-panel-shell">
      <div class="insights-panel-kicker">Historial patrimonial</div>
      <div class="insights-panel-sub">Una lectura simple de cómo viene tu posición en los últimos meses</div>
      <div class="savings-scenario-grid">
        ${patrimonySeries.length ? patrimonySeries.map(point=>`
          <div class="savings-scenario-card">
            <div class="savings-scenario-top">
              <span class="savings-scenario-label">${point.label}</span>
              <span class="savings-scenario-chip">Patrimonio</span>
            </div>
            <div class="savings-scenario-value">$${fmtN(Math.round(point.value))}</div>
            <div class="savings-scenario-sub">estimación histórica</div>
          </div>
        `).join('') : `<div class="savings-scenario-card"><div class="savings-scenario-value">—</div><div class="savings-scenario-sub">Necesitás más historial para esta lectura</div></div>`}
      </div>
    </div>
  `;
  const subEl = document.getElementById('insights-subtitle');
  if(subEl) subEl.textContent = 'Salud financiera y patrimonio · liquidez, deuda y posición estimada';
}

function getSavingsDeviationAlerts(dataArg){
  const data = dataArg || _computeInsightsData();
  const alerts = [];
  const income = data.incomeARS || 0;
  if(income > 0){
    const projectedPct = data.projectedMonth > 0 ? Math.round(data.projectedMonth / income * 100) : 0;
    if(projectedPct >= 90){
      alerts.push({
        id:`sav-projection-${data.currentMonth}`,
        type: projectedPct >= 100 ? 'alert' : 'warn',
        title:'Ritmo de gasto demasiado alto',
        desc:`Tu proyección ya consume el ${projectedPct}% del ingreso. Esta semana conviene recortar gasto variable.`,
        icon:'📉',
        color: projectedPct >= 100 ? 'var(--danger)' : 'var(--warning-sys)',
        time:'Modo ahorro'
      });
    }
    if(data.subsTotal > income * 0.08){
      alerts.push({
        id:`sav-subs-${data.currentMonth}`,
        type:'warn',
        title:'Suscripciones por encima del rango ideal',
        desc:`Las suscripciones ya representan ${Math.round(data.subsTotal / income * 100)}% de tu ingreso mensual.`,
        icon:'🔁',
        color:'var(--warning-sys)',
        time:'Modo ahorro'
      });
    }
    if(data.cuotasTotal > income * 0.25){
      alerts.push({
        id:`sav-cuotas-${data.currentMonth}`,
        type:'alert',
        title:'Cuotas pesadas para este ingreso',
        desc:`Tus cuotas absorben ${Math.round(data.cuotasTotal / income * 100)}% del ingreso disponible.`,
        icon:'💳',
        color:'var(--danger)',
        time:'Desvío importante'
      });
    }
  }
  if(data.growingCats?.length){
    const topGrowth = data.growingCats[0];
    if(topGrowth && topGrowth.pctChange >= 25){
      alerts.push({
        id:`sav-growth-${topGrowth.cat}-${data.currentMonth}`,
        type:'warn',
        title:`Desvío fuerte en ${topGrowth.cat}`,
        desc:`Subió ${topGrowth.pctChange}% versus el mes pasado. Es una palanca clara para ahorrar más.`,
        icon:'📈',
        color:'var(--warning-sys)',
        time:'Categoría en alza'
      });
    }
  }
  if(data.topCats?.length && data.arsThis > 0){
    const [catName, catAmount] = data.topCats[0];
    const catPct = Math.round(catAmount / data.arsThis * 100);
    if(catPct >= 35){
      alerts.push({
        id:`sav-concentration-${catName}-${data.currentMonth}`,
        type:'info',
        title:`Concentración alta en ${catName}`,
        desc:`Esa categoría ya explica el ${catPct}% del gasto actual.`,
        icon:'🎯',
        color:'var(--accent)',
        time:'Modo ahorro'
      });
    }
  }
  return alerts;
}

function _renderSavingsMode(data){
  const el = document.getElementById('insights-savings-shell');
  if(!el) return;
  const income = data.incomeARS || 0;
  const { saveTargetPct, spendCapPct } = _getInsightsTargets();
  const targetSave = income > 0 ? income * (saveTargetPct / 100) : 0;
  const targetSpend = income > 0 ? Math.max(0, income - targetSave) : 0;
  const projectedSavings = income > 0 ? income - data.projectedMonth : 0;
  const savingsGap = income > 0 ? Math.max(0, targetSave - Math.max(0, projectedSavings)) : 0;
  const currentSaveRate = income > 0 ? Math.round((Math.max(0, projectedSavings) / income) * 100) : 0;
  const topLevers = (data.growingCats || [])
    .filter(c=>c.current>0)
    .slice(0,3)
    .map(c=>({
      name:c.cat,
      current:c.current,
      pctChange:c.pctChange,
      recoverable: Math.round(Math.max(0, c.current - (c.prev || c.current * 0.82)) || c.current * 0.15)
    }));
  while(topLevers.length < 3 && (data.topCats||[])[topLevers.length]){
    const [name, amount] = data.topCats[topLevers.length];
    topLevers.push({ name, current: amount, pctChange: 15, recoverable: Math.round(amount * 0.12) });
  }
  const recoverableTotal = topLevers.reduce((s,l)=>s+(l.recoverable||0),0);
  const alerts = getSavingsDeviationAlerts(data);
  const sevenDayTarget = savingsGap > 0 ? Math.max(0, Math.round(savingsGap / 4)) : Math.round(recoverableTotal * 0.35);
  const scenarioBase = Math.max(recoverableTotal, Math.max(0, data.projectedMonth - targetSpend), Math.max(0, data.arsThis * 0.08));
  const scenarios = income > 0 ? [
    { label:'Ajuste suave', pct:'5%', recorte: Math.round(scenarioBase * 0.5), ahorro: Math.round(Math.max(0, projectedSavings) + scenarioBase * 0.5) },
    { label:'Meta recomendada', pct:'10%', recorte: Math.round(scenarioBase * 0.85), ahorro: Math.round(Math.max(0, projectedSavings) + scenarioBase * 0.85) },
    { label:'Modo agresivo', pct:'15%', recorte: Math.round(scenarioBase * 1.15), ahorro: Math.round(Math.max(0, projectedSavings) + scenarioBase * 1.15) }
  ] : [];
  const weeklyPlan = income > 0 ? [
    `Poné un techo semanal de <strong>$${fmtN(Math.round(targetSpend / 4.3))}</strong> para no comerte el margen del mes.`,
    topLevers[0] ? `Bajá primero <strong>${esc(topLevers[0].name)}</strong>: hoy es tu mejor palanca para recuperar plata rápido.` : 'Empezá por una sola categoría variable para que el ajuste sea sostenible.',
    sevenDayTarget > 0 ? `Intentá liberar <strong>$${fmtN(Math.round(sevenDayTarget))}</strong> en los próximos 7 días para acercarte al objetivo.` : 'Tu foco esta semana debería ser sostener el ritmo y evitar compras impulsivas.',
    `Cuando cobres, separá de entrada <strong>$${fmtN(Math.round(targetSave))}</strong> y gastá con el monto restante, no al revés.`
  ] : [
    'Cargá el ingreso ARS y USD del período para que la vista calcule ahorro real.',
    'Una vez cargado, esta pantalla te va a sugerir recortes concretos por categoría.',
    'Usá las alertas como semáforo para saber qué corregir primero.',
    'Después definí una meta automática de ahorro para no depender de “lo que sobre”.'
  ];

  const advices = income <= 0 ? [
    {tone:'info', title:'Definí primero el ingreso del período', body:'El modo ahorro necesita saber cuánto entra realmente por mes para recomendarte un plan financiero serio.'},
    {tone:'info', title:'Registrá sueldo ARS y USD', body:'Como cobrás en dos monedas, la app tiene que sumar ambas para mostrarte margen, ahorro y gasto objetivo reales.'},
    {tone:'info', title:'Usá esta vista para ordenar prioridades', body:'Cuando cargues ingresos, esta pantalla te va a decir cuánto podés guardar y dónde conviene recortar primero.'}
  ] : [
    {tone: projectedSavings >= targetSave ? 'good' : 'warn', title:'Objetivo de ahorro sano', body:`Con tu ingreso actual, una meta razonable es separar <strong>$${fmtN(Math.round(targetSave))}</strong> por mes y tratar de no pasar de <strong>$${fmtN(Math.round(targetSpend))}</strong> de gasto total.`},
    {tone: savingsGap > 0 ? 'warn' : 'good', title:'Lo que hoy te falta ajustar', body:savingsGap > 0 ? `Para llegar a esa meta, hoy tendrías que recortar alrededor de <strong>$${fmtN(Math.round(savingsGap))}</strong> en gasto variable.` : `Tu proyección ya está alineada con una meta de ahorro cercana al <strong>${saveTargetPct}%</strong> del ingreso.`},
    {tone:'info', title:'La regla más efectiva para vos', body:'No esperes a ver qué sobra a fin de mes. Apenas cobrás, separá el ahorro primero y después administrá el gasto con el monto restante.'}
  ];

  el.innerHTML = `
    <div class="fade-up d1 savings-hero-shell">
      <div class="insights-panel-kicker">Modo ahorro</div>
      <div class="savings-hero-title">Cómo bajar tu gasto sin vivir peor</div>
      <div class="savings-hero-copy">${income>0 ? `Esta vista compara lo que hoy proyectás gastar contra la meta que definiste para ahorrar. La lectura es simple: cuánto te quedaría, cuánto querés guardar y qué tendrías que corregir para llegar.` : `Primero necesitás registrar ingresos para que la estrategia de ahorro sea precisa y realmente útil.`}</div>
      <div class="savings-metric-grid">
        <div class="savings-metric-card">
          <div class="savings-metric-label">Plata que te quedaría</div>
          <div class="savings-metric-value ${projectedSavings < 0 ? 'bad' : ''}">${income>0 ? '$'+fmtN(Math.round(projectedSavings)) : '—'}</div>
          <div class="savings-metric-sub">lo que te quedaría al cierre si seguís gastando al ritmo actual</div>
        </div>
        <div class="savings-metric-card">
          <div class="savings-metric-label">Meta para guardar</div>
          <div class="savings-metric-value">${income>0 ? '$'+fmtN(Math.round(targetSave)) : '—'}</div>
          <div class="savings-metric-sub">${saveTargetPct}% del ingreso mensual según tu configuración</div>
        </div>
        <div class="savings-metric-card">
          <div class="savings-metric-label">Lo que deberías bajar</div>
          <div class="savings-metric-value">${income>0 ? '$'+fmtN(Math.round(savingsGap)) : '—'}</div>
          <div class="savings-metric-sub">cuánto deberías bajar tu gasto proyectado para llegar a esa meta</div>
        </div>
        <div class="savings-metric-card">
          <div class="savings-metric-label">Ajuste posible en 3 categorías</div>
          <div class="savings-metric-value">${topLevers.length ? '$'+fmtN(Math.round(recoverableTotal)) : '—'}</div>
          <div class="savings-metric-sub">ahorro posible en corto plazo si ajustás las tres palancas sugeridas</div>
        </div>
      </div>
    </div>

    <div class="fade-up d2 savings-split-grid">
      <div class="insights-panel-shell">
        <div class="insights-panel-kicker">Palancas de ahorro</div>
        <div class="insights-panel-sub">Las tres categorías donde más conviene ajustar hoy</div>
        <div class="savings-lever-list">
          ${topLevers.map((lever,idx)=>`
            <div class="savings-lever-card">
              <div class="savings-lever-rank">0${idx+1}</div>
              <div class="savings-lever-copy">
                <div class="savings-lever-name">${esc(lever.name)}</div>
                <div class="savings-lever-meta">Gasto actual: <strong>$${fmtN(Math.round(lever.current))}</strong> · desvío: <strong>${lever.pctChange>0?'+':''}${lever.pctChange}%</strong></div>
              </div>
              <div class="savings-lever-impact">Ahorro posible<br><strong>$${fmtN(Math.round(lever.recoverable))}</strong></div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="insights-panel-shell">
        <div class="insights-panel-kicker">Alertas de desvío</div>
        <div class="insights-panel-sub">Señales importantes que hoy te alejan del ahorro</div>
        <div class="savings-alert-stack">
          ${alerts.length ? alerts.map(a=>`
            <div class="savings-alert-item savings-alert-${a.type}">
              <div class="savings-alert-icon">${a.icon}</div>
              <div>
                <div class="savings-alert-title">${a.title}</div>
                <div class="savings-alert-desc">${a.desc}</div>
              </div>
            </div>
          `).join('') : `<div class="savings-alert-item savings-alert-success"><div class="savings-alert-icon">✅</div><div><div class="savings-alert-title">Sin alertas críticas</div><div class="savings-alert-desc">Tu situación actual no muestra desvíos fuertes. Ahora el desafío es sostener hábitos y automatizar ahorro.</div></div></div>`}
        </div>
      </div>
    </div>

    <div class="fade-up d3 insights-panel-shell">
      <div class="insights-panel-kicker">Consejos profesionales</div>
      <div class="insights-panel-sub">Qué haría un asesor financiero para ayudarte a guardar más plata</div>
      <div class="savings-advice-grid">
        ${advices.map(card=>`
          <div class="savings-advice-card savings-advice-${card.tone}">
            <div class="savings-advice-title">${card.title}</div>
            <div class="savings-advice-body">${card.body}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="fade-up d3 savings-bottom-grid">
      <div class="insights-panel-shell">
        <div class="insights-panel-kicker">Escenarios de ahorro</div>
        <div class="insights-panel-sub">Cómo cambia tu mes si ajustás un poco el gasto variable</div>
        <div class="savings-scenario-grid">
          ${scenarios.length ? scenarios.map(s=>`
            <div class="savings-scenario-card">
              <div class="savings-scenario-top">
                <span class="savings-scenario-label">${s.label}</span>
                <span class="savings-scenario-chip">${s.pct}</span>
              </div>
              <div class="savings-scenario-value">$${fmtN(Math.round(s.ahorro))}</div>
              <div class="savings-scenario-sub">ahorro final estimado</div>
              <div class="savings-scenario-foot">recorte sugerido: <strong>$${fmtN(Math.round(s.recorte))}</strong></div>
            </div>
          `).join('') : `
            <div class="savings-scenario-card">
              <div class="savings-scenario-value">—</div>
              <div class="savings-scenario-sub">Cargá ingresos para ver escenarios reales</div>
            </div>
          `}
        </div>
      </div>
      <div class="insights-panel-shell">
        <div class="insights-panel-kicker">Plan de 7 días</div>
        <div class="insights-panel-sub">Pasos concretos para que el modo ahorro se vuelva una rutina</div>
        <div class="savings-week-plan">
          ${weeklyPlan.map((step, idx)=>`
            <div class="savings-week-step">
              <div class="savings-week-index">0${idx+1}</div>
              <div class="savings-week-copy">${step}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  const subEl=document.getElementById('insights-subtitle');
  if(subEl) subEl.textContent=`Modo ahorro · meta ${saveTargetPct}% · tope de gasto ${spendCapPct}%${income > 0 ? ` · ahorro proyectado ${currentSaveRate}%` : ''}`;
}

// ── Desafíos Financieros ──────────────────────────────────
// Auto-genera challenges basados en los datos reales del usuario y los evalúa automáticamente

function _renderChallenges(data) {
  const el = document.getElementById('ins-challenges-section');
  if(!el) return;

  const challenges = _buildChallenges(data);
  if(!challenges.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';

  // Persist completed challenge IDs so dismissed ones survive re-render
  if(!state._challengesCompleted) state._challengesCompleted = {};

  el.innerHTML = `
    <div class="insights-challenges-head">
      <div>
        <div class="insights-panel-kicker">Desafíos activos</div>
        <div class="insights-challenges-sub">Objetivos calculados automáticamente con tus datos</div>
      </div>
      <div class="insights-challenges-badge">
        ${challenges.filter(c=>c.status==='done').length}/${challenges.length} completados
      </div>
    </div>
    <div class="insights-challenges-grid">
      ${challenges.map(c => _renderChallenge(c)).join('')}
    </div>
  `;
}

function _buildChallenges(data) {
  const txns = (state.transactions||[]).filter(t => !t.isPendingCuota);
  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);

  // Week start (Monday)
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay()+6)%7));
  const weekStartStr = weekStart.toISOString().slice(0,10);

  const challenges = [];

  // ── Challenge 1: Presupuesto diario ──
  if(data.dayAvg > 0) {
    const dailyBudget = Math.round(data.dayAvg * 1.15);
    const todayARS = txns
      .filter(t => t.currency==='ARS' && (dateToYMD?dateToYMD(t.date):t.date?.slice(0,10)) === todayStr)
      .reduce((s,t)=>s+t.amount, 0);
    const pct = dailyBudget > 0 ? Math.min(100, Math.round(todayARS/dailyBudget*100)) : 0;
    const status = todayARS === 0 ? 'pristine'
      : pct <= 80 ? 'done'
      : pct <= 100 ? 'warning'
      : 'fail';
    challenges.push({
      id: 'daily', icon: '🎯',
      title: 'Presupuesto del día',
      desc: `Gastá menos de $${fmtN(dailyBudget)} hoy`,
      detail: todayARS === 0 ? '¡Todavía no gastaste nada hoy!' : `$${fmtN(Math.round(todayARS))} de $${fmtN(dailyBudget)}`,
      pct, status, period: 'Hoy'
    });
  }

  // ── Challenge 2: Semana vs. promedio mensual pasado ──
  if(data.arsPrev > 0) {
    const weeklyTarget = Math.round(data.arsPrev / 4.3);
    const weekARS = txns
      .filter(t => t.currency==='ARS' && (t.date?.slice?.(0,10)||'') >= weekStartStr)
      .reduce((s,t)=>s+t.amount, 0);
    const pct = weeklyTarget > 0 ? Math.min(100, Math.round(weekARS/weeklyTarget*100)) : 0;
    const status = pct <= 80 ? 'done' : pct <= 100 ? 'warning' : 'fail';
    challenges.push({
      id: 'weekly', icon: '📊',
      title: 'Semana bajo control',
      desc: `Gastá menos que tu promedio semanal del mes pasado`,
      detail: `$${fmtN(Math.round(weekARS))} de $${fmtN(weeklyTarget)}`,
      pct, status, period: 'Esta semana'
    });
  }

  // ── Challenge 3: Controlá la categoría más creciente ──
  if(data.growingCats.length > 0 && data.growingCats[0].pctChange > 20) {
    const cat = data.growingCats[0];
    const target = Math.round(cat.prev * 1.05);
    const pct = target > 0 ? Math.min(100, Math.round(cat.current/target*100)) : 0;
    const status = pct <= 80 ? 'done' : pct <= 100 ? 'warning' : 'fail';
    challenges.push({
      id: 'cat_' + cat.cat, icon: '⚡',
      title: `Controlá ${cat.cat}`,
      desc: `Subió ${cat.pctChange}% vs. el mes pasado. Mantente en control`,
      detail: `$${fmtN(Math.round(cat.current))} de $${fmtN(target)}`,
      pct, status, period: 'Este mes'
    });
  }

  // ── Challenge 4: Días sin gastar (racha) ──
  {
    const target = 5;
    const streak = data.daysWithout || 0;
    const pct = Math.min(100, Math.round(streak/target*100));
    const status = streak >= target ? 'done' : streak >= 2 ? 'warning' : 'pristine';
    const flame = streak >= target ? '🔥' : streak >= 2 ? '✨' : '💤';
    challenges.push({
      id: 'streak', icon: flame,
      title: 'Racha sin gastar',
      desc: `Acumulá ${target} días sin registrar gastos este mes`,
      detail: `${streak} de ${target} días`,
      pct, status, period: 'Este mes', isStreak: true
    });
  }

  // ── Challenge 5: Proyección del mes ──
  if(data.projectedMonth > 0 && data.incomeARS > 0) {
    const target = Math.round(data.incomeARS * 0.85);
    const pct = target > 0 ? Math.min(100, Math.round(data.projectedMonth/target*100)) : 0;
    const status = pct <= 80 ? 'done' : pct <= 100 ? 'warning' : 'fail';
    challenges.push({
      id: 'projection', icon: '📈',
      title: 'Proyección del mes',
      desc: `Tu ritmo proyecta $${fmtN(data.projectedMonth)} — objetivo ≤ $${fmtN(target)}`,
      detail: `${pct}% del objetivo (${data.daysLeft}d restantes)`,
      pct, status, period: 'Este mes'
    });
  }

  return challenges;
}

function _renderChallenge(c) {
  const statusColor = {
    done: 'var(--green-sys)',
    warning: 'var(--orange)',
    fail: 'var(--danger)',
    pristine: 'var(--accent)'
  }[c.status] || 'var(--accent)';

  const statusLabel = {
    done: '✓ Cumplido',
    warning: '⚠ En zona límite',
    fail: '✕ Superado',
    pristine: '→ En progreso'
  }[c.status] || '→ En progreso';

  const barBg = c.status === 'fail'
    ? 'linear-gradient(90deg,var(--danger),rgba(255,59,48,.5))'
    : c.status === 'warning'
    ? 'linear-gradient(90deg,var(--orange),rgba(255,159,10,.5))'
    : c.status === 'done'
    ? 'linear-gradient(90deg,var(--green-sys),rgba(48,209,88,.5))'
    : 'linear-gradient(90deg,var(--accent),var(--blue-mid))';

  return `
    <div class="insight-challenge-card">
      <!-- Top accent bar -->
      <div class="insight-challenge-accent" style="background:${barBg};opacity:${c.status==='done'?1:.6};"></div>
      <!-- Header -->
      <div class="insight-challenge-head">
        <div class="insight-challenge-id">
          <span class="insight-challenge-icon">${c.icon}</span>
          <div>
            <div class="insight-challenge-title">${c.title}</div>
            <div class="insight-challenge-period">${c.period}</div>
          </div>
        </div>
        <span class="insight-challenge-state" style="color:${statusColor};background:${statusColor}18;">${statusLabel}</span>
      </div>
      <!-- Description -->
      <div class="insight-challenge-desc">${c.desc}</div>
      <!-- Progress bar -->
      <div class="insight-challenge-track">
        <div class="insight-challenge-fill" style="width:${c.pct}%;background:${barBg};"></div>
      </div>
      <!-- Detail -->
      <div class="insight-challenge-detail">${c.detail}</div>
    </div>
  `;
}

// ── Monthly Evolution Chart ───────────────────────────────
function _renderInsightsChart(data) {
  const ctx = document.getElementById('ins-chart');
  const subEl = document.getElementById('ins-chart-sub');
  if(!ctx) return;

  if(window._insChart) { try{window._insChart.destroy();}catch(e){} }

  const months = data.monthlyData.slice(-12); // last 12 months
  if(months.length < 2) { ctx.parentElement.style.display='none'; return; }
  ctx.parentElement.style.display='block';

  const labels = months.map(m=>m.label);
  const values = months.map(m=>m.total);
  const avg    = data.avgMonthly;
  const isL    = typeof _isL==='function'?_isL():false;

  // Color bars: red if above avg, green if below
  const barColors = values.map(v=>v>avg*1.1?'rgba(255,59,48,0.75)':v<avg*0.9?'rgba(52,199,89,0.75)':'rgba(0,122,255,0.65)');

  if(subEl) subEl.textContent = `Últimos ${months.length} meses · Promedio $${fmtN(Math.round(avg))}/mes`;

  window._insChart = new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[
        {label:'Gasto ARS', data:values, backgroundColor:barColors, borderRadius:8, maxBarThickness:42, borderSkipped:false, order:2},
        {label:'Promedio', data:values.map(()=>avg), type:'line', borderColor:'rgba(160,154,148,0.5)', borderWidth:1.5,
         borderDash:[5,4], pointRadius:0, fill:false, tension:0, order:1}
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{..._chartTooltip(),
          callbacks:{label:c=>c.datasetIndex===1?' Promedio: $'+fmtN(Math.round(c.parsed.y)):' $'+fmtN(Math.round(c.parsed.y))}}
      },
      scales:{
        x:{ticks:{color:_chartTickColor(),font:_chartTickFont()}, grid:{display:false}},
        y:{ticks:{color:_chartTickColor(),font:_chartTickFont(),callback:v=>'$'+fmtN(v)},
           grid:_chartGridY()}
      }
    }
  });
}

// ── Health score ──────────────────────────────────────────
function _getHealthScore(data) {
  const { saveTargetPct, spendCapPct, bufferMonths } = _getInsightsTargets();
  const totalSavingsARS = (state.savAccounts || []).reduce((sum, acc) => sum + (acc.currency==='USD' ? (acc.balance||0)*(USD_TO_ARS||1500) : (acc.balance||0)), 0);
  const liquidityMonths = data.avgMonthly > 0 ? (totalSavingsARS / data.avgMonthly) : 0;
  const projectedSavings = data.incomeARS > 0 ? data.incomeARS - data.projectedMonth : null;
  const projectedSpendPct = data.incomeARS > 0 ? Math.round((data.projectedMonth / data.incomeARS) * 100) : null;
  const actualSavePct = data.incomeARS > 0 ? Math.round((projectedSavings / data.incomeARS) * 100) : null;
  if(!data.arsThis && !data.incomeARS) {
    return {
      score: 0, 
      factors: [], 
      label: 'Sin datos ⚪️', 
      desc: 'Agregá movimientos para calcular tu salud financiera.', 
      scoreColor: '#8e8e93'
    };
  }
  let score=0;
  const factors=[];

  const budgetScore = projectedSpendPct===null ? 35
    : projectedSpendPct <= spendCapPct - 5 ? 100
    : projectedSpendPct <= spendCapPct ? 84
    : projectedSpendPct <= 100 ? Math.max(22, Math.round(84 - ((projectedSpendPct - spendCapPct) / Math.max(1, 100 - spendCapPct)) * 62))
    : projectedSpendPct <= 115 ? Math.max(6, Math.round(22 - (projectedSpendPct - 100) * 1.2))
    : 0;
  const savingsScore = actualSavePct===null ? 35
    : actualSavePct >= saveTargetPct ? 100
    : actualSavePct >= Math.round(saveTargetPct * 0.6) ? 68
    : actualSavePct >= 0 ? 28
    : 0;
  const trendScore = data.momChange===null ? 50
    : data.momChange <= 0 ? 92
    : data.momChange <= 10 ? 72
    : data.momChange <= 20 ? 42
    : 12;
  const cuotasScore = data.cuotasPct===null ? 60
    : data.cuotasPct <= 15 ? 95
    : data.cuotasPct <= 25 ? 75
    : data.cuotasPct <= 35 ? 50
    : data.cuotasPct <= 50 ? 20
    : 0;
  const fixedScore = data.fixedPct===null ? 60
    : data.fixedPct <= 35 ? 90
    : data.fixedPct <= 50 ? 65
    : data.fixedPct <= 65 ? 35
    : 10;
  const liquidityScore = liquidityMonths >= bufferMonths ? 100
    : liquidityMonths >= bufferMonths * 0.6 ? 72
    : liquidityMonths > 0 ? 42
    : 12;

  score = Math.round(
    budgetScore * 0.30 +
    savingsScore * 0.22 +
    trendScore * 0.13 +
    cuotasScore * 0.13 +
    fixedScore * 0.12 +
    liquidityScore * 0.10
  );

  factors.push({label:'Cierre proyectado',value:projectedSpendPct!==null?`${projectedSpendPct}% ingreso`:'Sin ingreso',pct:budgetScore,color:budgetScore>=80?'var(--accent2)':budgetScore>=55?'var(--accent3)':'var(--danger)'});
  factors.push({label:'Ahorro mensual',value:actualSavePct!==null?`${actualSavePct}%`:'Sin definir',pct:savingsScore,color:savingsScore>=80?'var(--accent2)':savingsScore>=55?'var(--accent3)':'var(--danger)'});
  factors.push({label:'Tendencia',value:data.momChange!==null?`${data.momChange>0?'+':''}${data.momChange}%`:'Sin base',pct:trendScore,color:trendScore>=80?'var(--accent2)':trendScore>=55?'var(--accent3)':'var(--danger)'});
  factors.push({label:'Cuotas',value:data.cuotasPct!==null?`${data.cuotasPct}% ingreso`:'Sin dato',pct:cuotasScore,color:cuotasScore>=80?'var(--accent2)':cuotasScore>=55?'var(--accent3)':'var(--danger)'});
  factors.push({label:'Gastos fijos',value:data.fixedPct!==null?`${data.fixedPct}% ingreso`:'Sin dato',pct:fixedScore,color:fixedScore>=80?'var(--accent2)':fixedScore>=55?'var(--accent3)':'var(--danger)'});
  factors.push({label:'Colchón',value:`${liquidityMonths ? liquidityMonths.toFixed(1) : '0.0'} meses`,pct:liquidityScore,color:liquidityScore>=80?'var(--accent2)':liquidityScore>=55?'var(--accent3)':'var(--danger)'});

  score=Math.max(5,Math.min(100,Math.round(score)));
  let label,desc,scoreColor;
  if(score>=85){label='Muy saludable 🟢';desc='Tus finanzas muestran orden, margen y una estructura bastante sólida.';scoreColor='#34c759';}
  else if(score>=68){label='Aceptable 🟡';desc='Estás encaminado, pero todavía hay señales que podrían complicarte si no las corregís.';scoreColor='#ffcc00';}
  else if(score>=50){label='Frágil 🟠';desc='Llegás con poco margen. Si seguís gastando al mismo ritmo, te puede costar ahorrar o absorber un mes pesado.';scoreColor='#ff9500';}
  else{label='En riesgo 🔴';desc='Hoy tu estructura financiera está exigida. Conviene bajar gasto y fortalecer ahorro cuanto antes.';scoreColor='#ff3b30';}

  return{score,factors,label,desc,scoreColor};
}

// ── Score card render ─────────────────────────────────────
function _renderScoreCard(data) {
  const{score,factors,label,desc,scoreColor}=_getHealthScore(data);
  const circumference=2*Math.PI*40;
  const offset=circumference-(score/100)*circumference;
  const arc=document.getElementById('score-arc');
  if(arc){arc.style.strokeDashoffset=circumference;arc.style.stroke=scoreColor;setTimeout(()=>{arc.style.strokeDashoffset=offset;},100);}
  const numEl=document.getElementById('score-number');
  if(numEl){numEl.textContent=score;numEl.setAttribute('fill',scoreColor);}
  const labelEl=document.getElementById('score-label');
  if(labelEl)labelEl.textContent=label;
  const descEl=document.getElementById('score-desc');
  if(descEl)descEl.textContent=desc;
  const factorsEl=document.getElementById('score-factors');
  if(factorsEl){
    const tooltipMap = {
      'Cierre proyectado': 'Mide cuánto del ingreso te consumiría el mes si seguís gastando al ritmo actual.',
      'Ahorro mensual': 'Compara lo que proyectás ahorrar con la meta que elegiste para este mes.',
      'Tendencia': 'Compara tu gasto actual contra el mismo período del mes pasado.',
      'Cuotas': 'Impacto de tus compras financiadas sobre tus ingresos mensuales.',
      'Gastos fijos': 'Porcentaje de ingresos comprometido en gastos recurrentes obligatorios.',
      'Colchón': 'Cuántos meses de gasto promedio cubrirías con tu ahorro líquido actual.'
    };
    factorsEl.innerHTML=factors.map(f=>`
      <div style="display:flex;flex-direction:column;gap:3px;" title="${tooltipMap[f.label] || ''}">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;color:var(--text3);">${f.label}</span>
          <span style="font-size:11px;font-weight:700;color:${f.color};">${f.value}</span>
        </div>
        <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${Math.round(f.pct)}%;background:${f.color};border-radius:2px;transition:width 0.9s ease;"></div>
        </div>
      </div>`).join('');
  }
  const subEl=document.getElementById('insights-subtitle');
  if(subEl)subEl.textContent='Vista general · el score compara tu cierre proyectado, tu ahorro, tus cuotas y tu colchón contra objetivos configurables';
}

// ── Render ALL sections expanded ──────────────────────────
function _renderAllInsightSections(data) {
  const grid = document.getElementById('insights-grid');
  if(!grid) return;

  const SECTIONS = [
    { key:'general',  emoji:'📊', title:'General',        desc:'Resumen del mes en curso' },
    { key:'ahorro',   emoji:'💰', title:'Ahorro',          desc:'Proyección y oportunidades de ahorro' },
    { key:'cuidado',  emoji:'🛡', title:'Cuidá tu plata',  desc:'Cuotas, fijos y compromisos' },
    { key:'economia', emoji:'📈', title:'Economía',        desc:'Contexto macro y tendencias' },
  ];

  grid.innerHTML = SECTIONS.map(sec => {
    const cards = _buildCards(data, sec.key);
    const cardsHtml = cards.length
      ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px;">${cards.map(c=>_cardHTML(c)).join('')}</div>`
      : `<div style="color:var(--text3);font-size:13px;padding:20px 0;">No hay suficientes datos para este análisis todavía.</div>`;
    return `
      <div class="ins-section-block">
        <div class="ins-section-hdr">
          <span class="ins-section-ico">${sec.emoji}</span>
          <div>
            <div class="ins-section-ttl">${sec.title}</div>
            <div class="ins-section-dsc">${sec.desc}</div>
          </div>
        </div>
        ${cardsHtml}
      </div>`;
  }).join('');
}

// ── Build cards per section ───────────────────────────────
function _buildCards(data,tab) {
  const fmtM=n=>'$'+fmtN(Math.round(n));
  const MNAMES=data.MNAMES;
  const mesActual=MNAMES[data.today.getMonth()];
  const cards=[];

  /* ─── GENERAL ─── */
  if(tab==='general'){
    if(data.arsThis>0){
      const mom=data.momChange!==null
        ?(data.momChange>0?`<strong style="color:var(--danger)">+${data.momChange}%</strong> vs el mes pasado`:`<strong style="color:var(--accent2)">${data.momChange}%</strong> vs el mes pasado`)
        :'Primer mes con datos.';
      cards.push({type:data.momChange>15?'warn':'info',emoji:'📊',tag:'GASTO MENSUAL',
        headline:`Gastaste ${fmtM(data.arsThis)} en ${mesActual}`,
        body:`${mom} · ${data.monthTxns} movimientos registrados.`});
    }
    if(data.topCats.length>0){
      const[tc,ta]=data.topCats[0];
      const pct=data.arsThis>0?Math.round(ta/data.arsThis*100):0;
      cards.push({type:'info',emoji:'🏆',tag:'CATEGORÍA TOP',
        headline:`${tc} es tu mayor gasto este mes`,
        body:`Representa el <strong>${pct}%</strong> del total (${fmtM(ta)}). ${pct>40?'Proporción alta — analizá si hay margen para reducirlo.':'Dentro de rangos normales.'}`,
        barPct:pct,barColor:typeof catColor==='function'?catColor(tc):'var(--accent)'});
    }
    if(data.dayAvg>0){
      cards.push({type:'info',emoji:'📅',tag:'RITMO DIARIO',
        headline:`Gastás ${fmtM(data.dayAvg)} por día en promedio`,
        body:`Llevás ${data.daysPassed} días del mes · <strong>${data.daysWithSpending} días con gastos</strong> y <strong>${data.daysWithout} sin gastar</strong>. ${data.daysWithout>6?'¡Bien! Buenos hábitos de cero-gasto.':''}`});
    }
    if(data.topDay>=0&&data.maxDayAmt>0){
      cards.push({type:'info',emoji:'📆',tag:'DÍA MÁS ACTIVO',
        headline:`Los ${data.dayNames[data.topDay]} son tu día más caro`,
        body:`${fmtM(data.dayTotals[data.topDay])} gastados en total los ${data.dayNames[data.topDay]} este mes.`,
        bars:data.dayTotals.map((v,i)=>({label:data.dayNames[i],value:v,active:i===data.topDay})),
        maxBar:data.maxDayAmt});
    }
    if(data.usdThis>0){
      cards.push({type:data.usdExposurePct>30?'warn':'info',emoji:'💵',tag:'GASTOS EN USD',
        headline:`U$D ${fmtN(data.usdThis)} en gastos dolarizados`,
        body:`Equivalen a <strong>${fmtM(data.usdInARS)}</strong> al tipo ${fmtM(USD_TO_ARS||1500)}/USD. ${data.usdExposurePct>30?`${data.usdExposurePct}% de tu gasto total — alta exposición cambiaria.`:'Exposición moderada.'}`});
    }
    cards.push({type:'info',emoji:'🔢',tag:'ACTIVIDAD',
      headline:`${data.monthTxns} movimientos en ${mesActual}`,
      body:`Promedio de <strong>${data.daysPassed>0?(data.monthTxns/data.daysPassed).toFixed(1):0} transacciones por día</strong>. ${data.monthTxns>60?'Alta actividad — revisá que todo esté categorizado.':'Actividad normal.'}`});
  }

  /* ─── AHORRO ─── */
  if(tab==='ahorro'){
    if(data.projectedMonth>0){
      const vsI=data.incomeARS>0
        ?(data.projectedMonth>data.incomeARS?`⚠️ <strong style="color:var(--danger)">Supera tu ingreso total</strong> de ${fmtM(data.incomeARS)} (ARS+USD)`:`Margen restante: <strong style="color:var(--accent2)">${fmtM(data.incomeARS-data.projectedMonth)}</strong>`)
        :'';
      cards.push({type:data.incomeARS>0&&data.projectedMonth>data.incomeARS?'alert':'info',emoji:'🔮',tag:'PROYECCIÓN AL CIERRE',
        headline:`Cerrarás ${mesActual} en ~${fmtM(data.projectedMonth)}`,
        body:`Ritmo: ${fmtM(data.dayAvg)}/día × ${data.daysInMonth} días. ${vsI}`,
        metric:data.projectedMonth,metricLabel:'proyectado'});
    }
    if(data.growingCats.length>0&&data.growingCats[0].pctChange>15){
      const top=data.growingCats[0];
      cards.push({type:'warn',emoji:'📈',tag:'OPORTUNIDAD DE AHORRO',
        headline:`${top.cat} subió +${top.pctChange}% vs el mes pasado`,
        body:`De <strong>${fmtM(top.prev)}</strong> a <strong>${fmtM(top.current)}</strong>. Si volvés al nivel anterior ahorrarías <strong>${fmtM(top.current-top.prev)}</strong> este mes.`,
        barPct:Math.min(100,top.pctChange),barColor:'var(--danger)'});
    }
    if(data.daysWithout>0){
      cards.push({type:'good',emoji:'🌱',tag:'DÍAS SIN GASTAR',
        headline:`${data.daysWithout} día${data.daysWithout!==1?'s':''} sin gastos este mes`,
        body:`${data.daysWithout>=8?'¡Excelente! Estás construyendo hábitos sólidos.':'Intentá llegar a 8+ días para un impacto real en tu ahorro.'}`,
        metric:data.daysWithout,metricLabel:'días "cero-gasto"'});
    }
    if(data.momChange!==null){
      cards.push({type:data.momChange>10?'warn':data.momChange<-5?'good':'info',
        emoji:data.momChange<0?'📉':'📈',tag:'VARIACIÓN MES A MES',
        headline:`Gastaste ${data.momChange>0?'+':''}${data.momChange}% ${data.momChange>=0?'más':'menos'} que el mes pasado`,
        body:`Este mes: <strong>${fmtM(data.arsThis)}</strong> · Anterior: <strong>${fmtM(data.arsPrev)}</strong>. ${data.momChange>15?'El aumento es significativo.':data.momChange<-5?'¡Muy bien! Vas en la dirección correcta.':'Gasto estable.'}`});
    }
    if(data.subsTotal>0){
      cards.push({type:'info',emoji:'📱',tag:'SUSCRIPCIONES',
        headline:`Pagás ${fmtM(data.subsTotal)}/mes en suscripciones`,
        body:`Revisá regularmente si usás todos tus servicios.${data.incomeARS>0?` Representan el ${Math.round(data.subsTotal/data.incomeARS*100)}% de tu ingreso.`:''} Cada suscripción sin uso es dinero que podés ahorrar.`});
    }
    if(data.largestTxn){
      cards.push({type:'info',emoji:'🧾',tag:'MAYOR GASTO',
        headline:`Tu gasto más grande: ${fmtM(data.largestTxn.amount)}`,
        body:`<strong>${esc(data.largestTxn.description)}</strong> — ${new Date(data.largestTxn.date).toLocaleDateString('es-AR',{day:'2-digit',month:'short'})}. Los gastos grandes impactan mucho en el total.`});
    }
  }

  /* ─── CUIDÁ TU PLATA ─── */
  if(tab==='cuidado'){
    if(data.cuotasTotal>0){
      const burdenType=data.cuotasPct===null?'info':data.cuotasPct>35?'alert':data.cuotasPct>20?'warn':'good';
      cards.push({type:burdenType,emoji:'💳',tag:'PESO DE CUOTAS',
        headline:`Cuotas: ${fmtM(data.cuotasTotal)} este mes (${data.cuotasTxns} pagos)`,
        body:data.cuotasPct!==null
          ?`Representan el <strong>${data.cuotasPct}% de tu ingreso</strong>. ${data.cuotasPct>35?'🚨 Nivel alto — no sumes más cuotas por ahora.':data.cuotasPct>20?'Nivel moderado — mantené el control.':'✅ Dentro de límites saludables (menos del 20%).'}`
          :'Configurá tu ingreso para ver el peso relativo de las cuotas.',
        barPct:data.cuotasPct!==null?Math.min(100,data.cuotasPct*2.5):null,
        barColor:data.cuotasPct>35?'var(--danger)':data.cuotasPct>20?'var(--accent3)':'var(--accent2)'});
    }
    if(data.upcomingPayments.length>0){
      const next=data.upcomingPayments[0];
      cards.push({type:next.daysUntil<=3?'alert':'info',emoji:'⏰',tag:'PRÓXIMOS VENCIMIENTOS',
        headline:`"${esc(next.name)}" vence en ${next.daysUntil} día${next.daysUntil!==1?'s':''}`,
        body:`<strong>Próximos pagos:</strong><br>${data.upcomingPayments.slice(0,3).map(p=>`${esc(p.name)} en <strong>${p.daysUntil}d</strong> — ${fmtM(p.amount)}`).join('<br>')}`});
    }
    if(data.fixedTotal>0){
      const fp=data.fixedPct;
      cards.push({type:fp!==null&&fp>60?'warn':'info',emoji:'🏠',tag:'GASTOS FIJOS',
        headline:`Tus gastos fijos suman ${fmtM(data.fixedTotal)}/mes`,
        body:fp!==null
          ?`Representan el <strong>${fp}%</strong> de tu ingreso. ${fp>60?'Nivel elevado — analizá si podés reducir alguno.':fp>40?'Nivel moderado — rango aceptable.':'✅ Bien manejados.'}`
          :'Configurá tu ingreso para ver el impacto real de tus gastos fijos.',
        barPct:fp!==null?Math.min(100,fp):null,barColor:fp>60?'var(--danger)':fp>40?'var(--accent3)':'var(--accent2)'});
    }
    if(data.usdExposurePct>30){
      cards.push({type:'warn',emoji:'⚠️',tag:'EXPOSICIÓN CAMBIARIA',
        headline:`El ${data.usdExposurePct}% de tus gastos son en USD`,
        body:`Con el tipo de cambio a <strong>${fmtM(USD_TO_ARS||1500)}/USD</strong>, una devaluación te impacta directo. Considerá renegociar servicios en pesos donde sea posible.`});
    }
    if(data.topCats.length>0){
      const[tc,ta]=data.topCats[0];
      const pct=data.arsThis>0?Math.round(ta/data.arsThis*100):0;
      if(pct>45){
        cards.push({type:'warn',emoji:'⚡',tag:'CONCENTRACIÓN DE GASTO',
          headline:`El ${pct}% de tu gasto está en una sola categoría`,
          body:`<strong>${esc(tc)}</strong> domina tu presupuesto este mes. Alta concentración reduce tu flexibilidad ante imprevistos.`,
          barPct:pct,barColor:'var(--accent3)'});
      }
    }
    if(!data.cuotasTotal&&!data.upcomingPayments.length&&!data.fixedTotal){
      cards.push({type:'good',emoji:'✅',tag:'TODO EN ORDEN',
        headline:'No detectamos compromisos financieros pendientes',
        body:'No tenés cuotas, gastos fijos ni vencimientos configurados. Si los tenés, agregálos en la sección Compromisos para un análisis completo.'});
    }
  }

  /* ─── ECONOMÍA ─── */
  if(tab==='economia'){
    if(data.spendPct!==null){
      const remaining=data.incomeARS-data.arsThis;
      cards.push({type:data.spendPct>100?'alert':data.spendPct>85?'warn':'good',
        emoji:data.spendPct>100?'🚨':data.spendPct>85?'⚠️':'✅',tag:'RATIO INGRESO/GASTO',
        headline:`Usaste el ${data.spendPct}% de tu ingreso este mes`,
        body:remaining>=0
          ?`Te quedan <strong style="color:var(--accent2)">${fmtM(remaining)}</strong> de ${fmtM(data.incomeARS)} de ingreso. ${data.spendPct<=70?'¡Excelente margen! Destiná algo al ahorro.':''}`
          :`Superaste tu ingreso por <strong style="color:var(--danger)">${fmtM(Math.abs(remaining))}</strong>. Revisá de dónde salió la diferencia.`,
        barPct:Math.min(100,data.spendPct),barColor:data.spendPct>100?'var(--danger)':data.spendPct>85?'var(--accent3)':'var(--accent2)'});
    }
    if(data.monthlyData.length>=2){
      const delta=data.arsThis>0&&data.avgMonthly>0?Math.round((data.arsThis-data.avgMonthly)/data.avgMonthly*100):null;
      cards.push({type:delta!==null&&delta>20?'warn':'info',emoji:'📊',tag:'VS PROMEDIO HISTÓRICO',
        headline:`Tu promedio histórico es ${fmtM(data.avgMonthly)}/mes`,
        body:delta!==null
          ?`Este mes estás <strong>${delta>0?'+':''}${delta}%</strong> respecto a tu promedio de ${data.monthlyData.length} mes${data.monthlyData.length!==1?'es':''}. ${delta>20?'Revisá qué generó el desvío.':delta<-10?'¡Por debajo del promedio — muy bien!':'Dentro del promedio normal.'}`
          :`Basado en ${data.monthlyData.length} mes${data.monthlyData.length!==1?'es':''} de datos.`});
    }
    const sigGrowing=data.growingCats.filter(c=>c.pctChange>20).slice(0,3);
    if(sigGrowing.length>0){
      cards.push({type:'warn',emoji:'📈',tag:'CATEGORÍAS EN ALZA',
        headline:`${sigGrowing.length} categoría${sigGrowing.length!==1?'s':''} con tendencia creciente`,
        body:sigGrowing.map(c=>`<strong>${esc(c.cat)}</strong>: +${c.pctChange}% (${fmtM(c.current-c.prev)} más que el mes pasado)`).join('<br>')});
    }
    if(data.nextCuotasTotal>0){
      cards.push({type:'info',emoji:'🔮',tag:'CUOTAS PRÓXIMO MES',
        headline:`El mes que viene tenés ${fmtM(data.nextCuotasTotal)} en cuotas`,
        body:`${data.nextMonthCuotas} cuota${data.nextMonthCuotas!==1?'s':''} proyectadas para ${MNAMES[data.today.getMonth()+1]||'el próximo mes'}. Compromiso fijo — planificalo en tu presupuesto.`,
        metric:data.nextCuotasTotal,metricLabel:'comprometido'});
    }
    if(data.monthlyData.length<3){
      cards.push({type:'info',emoji:'💡',tag:'TIP',
        headline:'Con más datos, el análisis mejora',
        body:`Tenés ${data.monthlyData.length} mes${data.monthlyData.length!==1?'es':''} de datos. Importá al menos 3-4 meses para ver tendencias y proyecciones más confiables.`});
    }
    if(!data.spendPct&&!data.monthlyData.length){
      cards.push({type:'info',emoji:'🎯',tag:'PRIMEROS PASOS',
        headline:'Configurá tu perfil financiero',
        body:'Agregá tu ingreso mensual en la sección Ingresos e importá movimientos de al menos 2 meses para desbloquear el análisis económico completo.'});
    }
  }

  return cards;
}

// ── Card HTML builder ─────────────────────────────────────
function _cardHTML(c) {
  const TYPES={
    good: {color:'var(--accent2)', bg:'rgba(52,199,89,0.07)',  border:'rgba(52,199,89,0.2)'},
    info: {color:'var(--accent)',  bg:'var(--surface)',        border:'var(--border)'},
    warn: {color:'var(--accent3)', bg:'rgba(255,149,0,0.07)', border:'rgba(255,149,0,0.2)'},
    alert:{color:'var(--danger)',  bg:'rgba(255,59,48,0.07)', border:'rgba(255,59,48,0.2)'},
  };
  const cfg=TYPES[c.type]||TYPES.info;
  let extra='';
  if(c.barPct!=null){
    extra+=`<div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden;margin-top:12px;">
      <div style="height:100%;width:${Math.round(c.barPct)}%;background:${c.barColor||cfg.color};border-radius:3px;transition:width 0.9s ease;"></div>
    </div>`;
  }
  if(c.metric!=null){
    extra+=`<div style="margin-top:12px;display:flex;align-items:baseline;gap:6px;">
      <span style="font-size:20px;font-weight:700;font-family:var(--font);color:${cfg.color};">$${fmtN(Math.round(c.metric))}</span>
      <span style="font-size:11px;color:var(--text3);">${c.metricLabel||''}</span>
    </div>`;
  }
  if(c.bars){
    const mx=c.maxBar||Math.max(...c.bars.map(b=>b.value))||1;
    extra+=`<div style="display:flex;gap:4px;align-items:flex-end;height:40px;margin-top:12px;">
      ${c.bars.map(b=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">
        <div style="width:100%;background:${b.active?cfg.color:'var(--border)'};border-radius:3px 3px 0 0;height:${mx>0?Math.round(b.value/mx*30):0}px;transition:height 0.6s ease;min-height:${b.value>0?2:0}px;"></div>
        <span style="font-size:8px;color:${b.active?cfg.color:'var(--text3)'};font-weight:${b.active?'700':'400'};">${b.label}</span>
      </div>`).join('')}
    </div>`;
  }
  return `<div style="background:${cfg.bg};border:1px solid ${cfg.border};border-radius:16px;overflow:hidden;display:flex;flex-direction:column;transition:transform .15s,box-shadow .15s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 28px rgba(0,0,0,.18)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
    <div style="width:100%;height:3px;background:${cfg.color};"></div>
    <div style="padding:16px 18px 18px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:22px;line-height:1;">${c.emoji}</span>
        <span style="font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${cfg.color};background:${cfg.color}18;border:1px solid ${cfg.color}30;padding:2px 8px;border-radius:20px;">${c.tag}</span>
      </div>
      <div style="font-size:14px;font-weight:700;color:var(--text);line-height:1.35;margin-bottom:7px;">${c.headline}</div>
      <div style="font-size:12px;color:var(--text3);line-height:1.6;">${c.body}</div>
      ${extra}
    </div>
  </div>`;
}
