// ══════════════════════════════════════════════════════════════
//  PLAN DE AHORRO DEL MES  (savings-plan.js)
//  Analiza el ciclo VISA+AMEX anterior vs. el actual, y arma un
//  plan de ahorro con presupuestos, días sin gasto y tips locales.
//  Sin dependencias externas: toda la matemática es determinista.
// ══════════════════════════════════════════════════════════════

// Categorías que arrancan marcadas como "fijas / no recortables" (el resto = recortable).
const SAVPLAN_FIXED_HINTS = ['suscrip','servicio','alquiler','médic','medic','salud','farmacia',
  'psicó','psico','supermercado','seguro','impuesto','expensas','luz','gas','agua','internet',
  'educación','educacion','matrícula','matricula','cuota','colegio','obra social','transporte','peaje'];

// ── Estado del plan ──
window._savPlanView = null;           // 'setup' | 'result' | 'track'
window._savPlanLastAnalysis = null;   // cache del último análisis para PDF/prompt

function ensureSavPlan(){
  if(!state.savPlan || typeof state.savPlan !== 'object'){
    state.savPlan = { targets:null, discretionaryCats:null, active:null };
  }
  if(!Array.isArray(state.savPlan.targets) || !state.savPlan.targets.length){
    state.savPlan.targets = [
      {id:'t1', name:'Tranqui',   amountUsd:500},
      {id:'t2', name:'Con ganas', amountUsd:900},
      {id:'t3', name:'A full',    amountUsd:1400}
    ];
  }
  if(state.savPlan.discretionaryCats == null){
    state.savPlan.discretionaryCats = savPlanDefaultDiscretionary();
  }
  if(state.savPlan.active === undefined) state.savPlan.active = null;
  return state.savPlan;
}

// ── Helpers de moneda / fecha ──
function savPlanRate(){
  return (typeof USD_TO_ARS !== 'undefined' && USD_TO_ARS) || state.usdRate || 1420;
}
function savPlanTxArs(t){
  const a = Math.abs(Number(t.amount)||0);
  return t.currency === 'USD' ? a * savPlanRate() : a;
}
function savPlanFmtArs(n){ return '$' + fmtN(Math.round(n||0), 0); }
function savPlanFmtUsd(n){ return 'USD ' + fmtN(Math.round(n||0), 0); }

// ── Categorías de gasto de tarjeta que existen en los datos ──
function savPlanExpenseCategoryNames(){
  const set = new Set();
  (state.transactions||[]).forEach(t=>{
    const pm = (t.payMethod||'').toLowerCase();
    if(pm==='deb' || pm==='ef') return;
    if(t.category) set.add(t.category);
  });
  return [...set].sort((a,b)=>a.localeCompare(b,'es'));
}
function savPlanDefaultDiscretionary(){
  return savPlanExpenseCategoryNames().filter(name=>{
    const low = name.toLowerCase();
    return !SAVPLAN_FIXED_HINTS.some(h=>low.includes(h));
  });
}

// ── Resolución de ciclos VISA+AMEX (mismo criterio que el Dashboard) ──
function savPlanResolveCycles(){
  if(typeof getTcCycles !== 'function') return null;
  const cycles = getTcCycles('visa'); // ordenadas desc por closeDate
  if(!cycles.length) return null;
  const today = dateToYMD(new Date());
  let curIdx = cycles.findIndex((c,i)=>{
    const open = getTcCycleOpen(cycles, i);
    return open && open <= today && c.closeDate >= today;
  });
  if(curIdx < 0) curIdx = 0;
  const current = cycles[curIdx];
  const currentOpen = getTcCycleOpen(cycles, curIdx);
  let prev = null, prevOpen = null;
  for(let i=curIdx+1;i<cycles.length;i++){
    if(cycles[i].closeDate < currentOpen){ prev = cycles[i]; prevOpen = getTcCycleOpen(cycles, i); break; }
  }
  if(!prev && cycles.length > curIdx+1){ prev = cycles[curIdx+1]; prevOpen = getTcCycleOpen(cycles, curIdx+1); }
  return { current, currentOpen, prev, prevOpen, today };
}

// Todas las tarjetas (visa+amex+tc) en una ventana de fechas, sin débito/efectivo ni anulaciones
function savPlanWindowTxns(open, close){
  return (state.transactions||[]).filter(t=>{
    const pm = (t.payMethod||'').toLowerCase();
    if(pm==='deb' || pm==='ef') return false;
    if(t.isAnulacion) return false;
    const d = dateToYMD(t.date);
    return d >= open && d <= close;
  });
}

function savPlanAnalyzeWindow(txns, discSet){
  const byCat = {};
  let totalArs = 0, discArs = 0;
  txns.forEach(t=>{
    const cat = t.category || 'Sin categoría';
    const a = savPlanTxArs(t);
    totalArs += a;
    if(!byCat[cat]) byCat[cat] = { cat, totalArs:0, count:0, disc:discSet.has(cat) };
    byCat[cat].totalArs += a; byCat[cat].count++;
    if(discSet.has(cat)) discArs += a;
  });
  const cats = Object.values(byCat).sort((a,b)=>b.totalArs-a.totalArs);
  return { totalArs, discArs, fixedArs: totalArs-discArs, cats, txCount: txns.length };
}

// Ingreso del mes actual en USD (o null si no hay dato cargado)
function savPlanMonthIncomeUsd(){
  const mk = getMonthKey(new Date());
  const im = (state.incomeMonths||[]).find(m=>m.month===mk);
  if(!im) return null;
  const rate = savPlanRate();
  if(im.schemaVersion===2 && im.salary){
    const ars = Number(im.salary.ars?.amount)||0;
    const usd = (Number(im.salary.usd?.amount)||0) + (Number(im.salary.commissions?.amount)||0);
    const extras = (im.extras||[]).reduce((s,e)=>{
      const amt = Number(e.amount)||0;
      return s + (e.currency==='USD' ? amt : amt/rate);
    },0);
    return usd + ars/rate + extras;
  }
  // Esquema v1
  const srcTotal = im.sources ? Object.values(im.sources).reduce((s,v)=>s+(Number(v)||0),0) : 0;
  return srcTotal/rate + (Number(im.extraUsd)||0) + (Number(im.extraArs)||0)/rate;
}

// ── Análisis completo ──
function savPlanBuildAnalysis(){
  const plan = ensureSavPlan();
  const cyc = savPlanResolveCycles();
  if(!cyc || !cyc.prev){
    return { ok:false, reason: !cyc ? 'no-cycles' : 'no-prev' };
  }
  const rate = savPlanRate();
  const discSet = new Set(plan.discretionaryCats);

  const prevTx = savPlanWindowTxns(cyc.prevOpen, cyc.prev.closeDate);
  const prev = savPlanAnalyzeWindow(prevTx, discSet);

  const curTx = savPlanWindowTxns(cyc.currentOpen, cyc.current.closeDate);
  const cur = savPlanAnalyzeWindow(curTx, discSet);

  // Geometría del ciclo actual
  const cStart = new Date(cyc.currentOpen+'T12:00:00');
  const cEnd = new Date(cyc.current.closeDate+'T12:00:00');
  const cNow = new Date(cyc.today+'T12:00:00');
  const dayMs = 86400000;
  const cycleDays = Math.max(1, Math.round((cEnd-cStart)/dayMs)+1);
  const daysElapsed = Math.min(cycleDays, Math.max(0, Math.round((cNow-cStart)/dayMs)+1));
  const daysRemaining = Math.max(0, cycleDays - daysElapsed);
  const weeksRemaining = Math.max(1, daysRemaining/7);

  const incomeUsd = savPlanMonthIncomeUsd();
  const projTotalUsd = prev.totalArs/rate;               // gasto proyectado = lo del ciclo anterior
  const projDiscUsd = prev.discArs/rate;
  const projFixedUsd = prev.fixedArs/rate;
  const projSaveUsd = incomeUsd != null ? (incomeUsd - projTotalUsd) : null; // ahorro si repetís el mes

  const targets = plan.targets.map(t=>{
    const targetUsd = Number(t.amountUsd)||0;
    let cutUsd;
    if(projSaveUsd != null){
      cutUsd = Math.max(0, targetUsd - projSaveUsd);
    } else {
      // Sin ingreso cargado: modelo simple (ahorrás lo que recortás sobre el gasto discrecional del mes previo)
      cutUsd = Math.min(projDiscUsd, targetUsd);
    }
    const cutArs = cutUsd*rate;
    // Presupuesto discrecional del mes y lo que queda para el resto del ciclo
    const discBudgetArs = Math.max(0, prev.discArs - cutArs);
    const remainingBudgetArs = Math.max(0, discBudgetArs - cur.discArs);
    const weeklyBudgetArs = remainingBudgetArs / weeksRemaining;
    const dailyBudgetArs = remainingBudgetArs / Math.max(1, daysRemaining);
    const avgDailyDiscArs = prev.discArs / cycleDays;
    const daysNoSpend = avgDailyDiscArs>0 ? Math.round(cutArs/avgDailyDiscArs) : 0;
    const cutRatio = projDiscUsd>0 ? cutUsd/projDiscUsd : (cutUsd>0?2:0);
    let feas;
    if(cutUsd<=0) feas='easy';
    else if(cutRatio<=0.35) feas='mid';
    else if(cutRatio<=1) feas='hard';
    else feas='extreme';
    return { ...t, targetUsd, cutUsd, cutArs, discBudgetArs, remainingBudgetArs,
      weeklyBudgetArs, dailyBudgetArs, daysNoSpend, cutRatio, feas };
  });

  const analysis = {
    ok:true, rate, cyc, prev, cur,
    cycleDays, daysElapsed, daysRemaining,
    incomeUsd, projTotalUsd, projDiscUsd, projFixedUsd, projSaveUsd,
    targets,
    discPct: prev.totalArs>0 ? Math.round(prev.discArs/prev.totalArs*100) : 0,
    curRunRateUsd: daysElapsed>0 ? (cur.totalArs/rate)/daysElapsed*cycleDays : 0
  };
  window._savPlanLastAnalysis = analysis;
  return analysis;
}

// ── Tips locales por escenario ──
function savPlanTipsFor(target, a){
  const tips = [];
  const disc = a.prev.cats.filter(c=>c.disc);
  if(target.cutUsd<=0){
    tips.push({ic:'✅', txt:'Con tu ritmo de ingresos ya llegás sin recortar nada. Podés apuntar más alto.'});
    return tips;
  }
  // Delivery frecuente
  const deli = disc.find(c=>/deliver|rappi|pedidos/i.test(c.cat));
  if(deli && deli.count>=6){
    const save = Math.round(deli.totalArs*0.65);
    const share = target.cutArs>0 ? Math.min(100, Math.round(save/target.cutArs*100)) : 0;
    const shareTxt = target.cutArs>0
      ? (save>=target.cutArs ? 'cubre todo el recorte que necesitás' : `${share}% del recorte`)
      : 'ahorro directo';
    tips.push({ic:'🍔', txt:`Delivery: ${deli.count} pedidos el ciclo pasado. Bajando a ~1 por semana ahorrás ${savPlanFmtArs(save)} (${shareTxt}).`});
  }
  // Categoría top discrecional
  const top = disc[0];
  if(top && (!deli || top.cat!==deli.cat)){
    tips.push({ic:'🎯', txt:`"${top.cat}" fue tu mayor gasto recortable (${savPlanFmtArs(top.totalArs)}). Es donde más margen tenés.`});
  }
  // Gasto hormiga
  const hormiga = disc.find(c=>c.count>=8 && c.totalArs/c.count < 15000);
  if(hormiga){
    tips.push({ic:'🐜', txt:`"${hormiga.cat}": ${hormiga.count} compras chicas suman ${savPlanFmtArs(hormiga.totalArs)}. Fuga silenciosa fácil de frenar.`});
  }
  // Días sin gasto
  if(target.daysNoSpend>0){
    tips.push({ic:'🚫', txt:`Meta concreta: ${target.daysNoSpend} día${target.daysNoSpend!==1?'s':''} sin ningún gasto recortable este ciclo te deja al día con el plan.`});
  }
  if(target.feas==='hard'){
    tips.unshift({ic:'⚠️', txt:`Exigente: requiere cortar ${Math.round(target.cutRatio*100)}% de tu gasto recortable. Realista solo si te comprometés fuerte.`});
  } else if(target.feas==='extreme'){
    tips.length = 0;
    tips.push({ic:'🧗', txt:`Muy difícil: ni recortando el 100% de tu gasto recortable llegás. Te faltarían ${savPlanFmtUsd(target.cutUsd - a.projDiscUsd)} más — tendrías que bajar gastos fijos o sumar ingresos.`});
    tips.push({ic:'💡', txt:`Probá una meta más baja o repartila en 2 meses.`});
  }
  return tips.slice(0,4);
}

// ══ SEGUIMIENTO EN VIVO ══
function savPlanLiveTracking(){
  const a = savPlanBuildAnalysis();
  if(!a.ok) return null;
  const plan = state.savPlan;
  const active = plan.active;
  const target = a.targets.find(t=>t.id===active.targetId) || a.targets[0];
  const rate = a.rate;
  const discBudgetArs = target.discBudgetArs;
  const spentArs = a.cur.discArs;
  const usedPct = discBudgetArs>0 ? Math.round(spentArs/discBudgetArs*100) : 0;
  const elapsedPct = Math.round(a.daysElapsed/a.cycleDays*100);
  // Proyección de ahorro real según ritmo actual
  const projDiscThisCycleArs = a.daysElapsed>0 ? spentArs/a.daysElapsed*a.cycleDays : 0;
  const projSaveUsd = a.incomeUsd!=null
    ? (a.incomeUsd - a.projFixedUsd - projDiscThisCycleArs/rate)
    : (a.projDiscUsd - projDiscThisCycleArs/rate);
  const onTrack = usedPct <= elapsedPct + 8; // margen
  const weeklyLeftArs = Math.max(0, discBudgetArs - spentArs) / Math.max(1, a.daysRemaining/7);
  const dailyLeftArs = Math.max(0, discBudgetArs - spentArs) / Math.max(1, a.daysRemaining);
  return { a, target, discBudgetArs, spentArs, usedPct, elapsedPct, projSaveUsd, onTrack, weeklyLeftArs, dailyLeftArs };
}

// ══════════════════════════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════════════════════════
function savPlanInitView(){
  ensureSavPlan();
  if(window._savPlanView) return;
  window._savPlanView = state.savPlan.active ? 'track' : 'setup';
}

function renderSavPlanSection(){
  const mount = document.getElementById('sav-plan-mount');
  if(!mount) return;
  savPlanInitView();
  const a = savPlanBuildAnalysis();

  if(!a.ok){
    mount.innerHTML = savPlanShell(`
      <div class="savplan-empty">
        <div class="savplan-empty-ic">📊</div>
        <div class="savplan-empty-t">Necesito al menos un ciclo de tarjeta cerrado para armar tu plan</div>
        <div class="savplan-empty-s">${a.reason==='no-cycles'
          ? 'Configurá tu ciclo VISA en Configuraciones → Tarjeta de crédito.'
          : 'Cuando cierre tu primer ciclo completo vas a poder comparar mes contra mes.'}</div>
      </div>`);
    return;
  }

  let body;
  if(window._savPlanView==='track' && state.savPlan.active) body = savPlanRenderTrack();
  else if(window._savPlanView==='result') body = savPlanRenderResult(a);
  else body = savPlanRenderSetup(a);
  mount.innerHTML = savPlanShell(body);
}

function savPlanShell(inner){
  return `
  <section class="savplan-section">
    <div class="savplan-hd">
      <div class="savplan-hd-ic">🎯</div>
      <div>
        <h2>Plan de ahorro del mes</h2>
        <p>Deciles cuánto querés ahorrar y armo el plan analizando tu ciclo VISA + AMEX</p>
      </div>
    </div>
    ${inner}
  </section>`;
}

function savPlanSteps(active){
  const steps = [
    {k:'setup', n:'1', t:'Definí tus metas'},
    {k:'result', n:'2', t:'Mirá el análisis'},
    {k:'track', n:'3', t:'Seguí tu progreso'}
  ];
  const order = ['setup','result','track'];
  const ai = order.indexOf(active);
  return `<div class="savplan-steps">${steps.map((s,i)=>{
    const cls = s.k===active ? 'on' : (i<ai ? 'done' : '');
    const n = i<ai ? '✓' : s.n;
    return `<div class="savplan-step ${cls}"><span class="n">${n}</span> ${s.t}</div>`;
  }).join('')}</div>`;
}

// ── Vista 1: Definir ──
function savPlanRenderSetup(a){
  const plan = state.savPlan;
  const discSet = new Set(plan.discretionaryCats);
  const cats = savPlanExpenseCategoryNames();
  const tlabels = ['Escenario suave','Escenario medio','Escenario duro'];
  const targetsHtml = plan.targets.slice(0,3).map((t,i)=>`
    <div class="savplan-tinput ${i===1?'mid':''}">
      <div class="savplan-tl" ${i===1?'style="color:var(--blue);"':''}>${tlabels[i]}</div>
      <input class="savplan-name" data-ti="${i}" value="${esc(t.name)}" maxlength="24">
      <div class="savplan-amt"><span class="cur">USD</span><input class="savplan-val" data-ti="${i}" type="number" min="0" value="${Number(t.amountUsd)||0}"></div>
    </div>`).join('');
  const chipsHtml = cats.length ? cats.map(c=>`
    <span class="savplan-chip ${discSet.has(c)?'on':''}" onclick="savPlanToggleCat('${esc(c).replace(/'/g,"\\'")}')">${esc(c)}</span>`).join('')
    : '<div class="savplan-muted">No hay categorías de gasto todavía. Importá movimientos primero.</div>';
  return `
    ${savPlanSteps('setup')}
    <div class="savplan-card savplan-setup">
      <h3>¿Cuánto querés ahorrar este mes?</h3>
      <p class="savplan-sub">Cargá hasta 3 escenarios. Calculo qué recorte necesita cada uno y qué tan realista es.</p>
      <div class="savplan-targets">${targetsHtml}</div>
      <div class="savplan-recort">
        <div class="savplan-rlbl">
          <span class="savplan-lbl">¿Qué gastos considerás recortables?</span>
          <a onclick="savPlanResetCats()">Restaurar sugeridos</a>
        </div>
        <div class="savplan-chips">${chipsHtml}</div>
      </div>
      <div class="savplan-cta">
        <button class="savplan-btn primary" onclick="savPlanAnalyze()">Analizar mi mes →</button>
      </div>
    </div>`;
}

// ── Vista 2: Análisis ──
function savPlanRenderResult(a){
  const feasBadge = {easy:'😌 Muy alcanzable', mid:'💪 Ajustado pero se puede', hard:'🥵 Exigente', extreme:'🧗 Muy difícil'};
  const prevLabel = a.cyc.prevOpen && a.cyc.prev
    ? savPlanShortDate(a.cyc.prevOpen)+' → '+savPlanShortDate(a.cyc.prev.closeDate) : '';
  const curLabel = 'día '+a.daysElapsed+' de '+a.cycleDays;
  const incomeCard = a.incomeUsd!=null
    ? `<div class="savplan-ctx-card"><span class="savplan-lbl">Ingreso del mes</span><div class="cv">${savPlanFmtUsd(a.incomeUsd)}</div><div class="cs">ya está en los cálculos</div></div>`
    : `<div class="savplan-ctx-card"><span class="savplan-lbl">Ingreso del mes</span><div class="cv">—</div><div class="cs warn">cargalo en Ingresos para más precisión</div></div>`;

  const plansHtml = a.targets.map(t=>{
    const tips = savPlanTipsFor(t, a);
    return `
    <div class="savplan-card savplan-plan ${t.feas}">
      <div class="top">
        <div class="pn">${esc(t.name)}</div>
        <div class="pa">${savPlanFmtUsd(t.targetUsd)}</div>
        <div class="badge">${feasBadge[t.feas]}</div>
      </div>
      <div class="body">
        <div class="savplan-metric"><span class="mk">✂️ Recorte necesario</span><span class="mv">${t.cutUsd<=0?'USD 0':savPlanFmtUsd(t.cutUsd)+' · '+savPlanFmtArs(t.cutArs)}</span></div>
        <div class="savplan-metric"><span class="mk">📅 Presupuesto semanal</span><span class="mv hl">${savPlanFmtArs(t.weeklyBudgetArs)}</span></div>
        <div class="savplan-metric"><span class="mk">☀️ Presupuesto diario</span><span class="mv">${savPlanFmtArs(t.dailyBudgetArs)}</span></div>
        <div class="savplan-metric"><span class="mk">🚫 Días sin gasto</span><span class="mv">${t.daysNoSpend} día${t.daysNoSpend!==1?'s':''}</span></div>
        <div class="savplan-tips">${tips.map(tp=>`<div class="savplan-tip"><span class="ti">${tp.ic}</span><span>${esc(tp.txt)}</span></div>`).join('')}</div>
        <button class="savplan-btn primary savplan-activate" onclick="savPlanActivate('${t.id}')">Activar este plan →</button>
      </div>
    </div>`;
  }).join('');

  return `
    ${savPlanSteps('result')}
    <div class="savplan-ctx">
      <div class="savplan-ctx-card"><span class="savplan-lbl">Ciclo anterior gastado</span><div class="cv">${savPlanFmtUsd(a.prev.totalArs/a.rate)}</div><div class="cs">${prevLabel} · ${savPlanFmtArs(a.prev.totalArs)}</div></div>
      <div class="savplan-ctx-card"><span class="savplan-lbl">De eso, recortable</span><div class="cv">${a.discPct}%</div><div class="cs">${savPlanFmtUsd(a.projDiscUsd)} discrecional</div></div>
      <div class="savplan-ctx-card"><span class="savplan-lbl">Ciclo actual (en curso)</span><div class="cv">${savPlanFmtUsd(a.cur.totalArs/a.rate)}</div><div class="cs ${a.curRunRateUsd>a.projTotalUsd?'warn':''}">${curLabel}${a.curRunRateUsd>a.projTotalUsd?' · ritmo alto':''}</div></div>
      ${incomeCard}
    </div>
    <div class="savplan-plans">${plansHtml}</div>
    <div class="savplan-cta">
      <button class="savplan-btn" onclick="savPlanBackToSetup()">← Ajustar metas</button>
      <button class="savplan-btn" onclick="savPlanShowAiPrompt()">✨ Profundizar con IA</button>
      <button class="savplan-btn" onclick="savPlanExportPdf()">⬇ Exportar PDF</button>
    </div>`;
}

// ── Vista 3: Seguimiento en vivo ──
function savPlanRenderTrack(){
  const tr = savPlanLiveTracking();
  if(!tr){ window._savPlanView='setup'; return savPlanRenderSetup(savPlanBuildAnalysis()); }
  const a = tr.a, t = tr.target;
  const closeLabel = savPlanShortDate(a.cyc.current.closeDate);
  const pillCls = tr.onTrack ? '' : 'warn';
  const pillTxt = tr.onTrack ? 'Dentro de presupuesto' : 'Ojo, vas rápido';
  const headline = tr.onTrack ? 'Vas bien encaminado 🎯' : 'Cuidado con el ritmo ⚡';
  const streak = savPlanBuildStreak(a);
  const projVsTarget = tr.projSaveUsd - t.targetUsd;
  const tip = tr.onTrack
    ? (projVsTarget>=0
        ? `Vas por debajo del ritmo: si mantenés esto, cerrás ahorrando ~${savPlanFmtUsd(tr.projSaveUsd)}, ${savPlanFmtUsd(Math.abs(projVsTarget))} más que tu meta.`
        : `Vas bien, pero para asegurar la meta te conviene sumar ${savPlanFmtUsd(Math.abs(projVsTarget))} más de recorte en lo que queda del ciclo.`)
    : `Vas gastando por encima del plan. Si seguís así, cerrás ahorrando ~${savPlanFmtUsd(tr.projSaveUsd)} (meta: ${savPlanFmtUsd(t.targetUsd)}). Frená el gasto recortable unos días.`;

  return `
    ${savPlanSteps('track')}
    <div class="savplan-card savplan-track">
      <div class="savplan-track-hd">
        <div>
          <div class="tt">${headline}</div>
          <div class="ts">Plan activo: <b>${esc(t.name)} · ${savPlanFmtUsd(t.targetUsd)}</b> · ciclo VISA+AMEX que cierra el ${closeLabel}</div>
        </div>
        <span class="savplan-pill ${pillCls}">${pillTxt}</span>
      </div>
      <div class="savplan-bigbar">
        <div class="bl"><span>Gasto recortable: <b>${savPlanFmtArs(tr.spentArs)}</b> de ${savPlanFmtArs(tr.discBudgetArs)}</span><span class="r">${tr.usedPct}% usado · ${tr.elapsedPct}% del ciclo</span></div>
        <div class="savplan-bar"><div style="width:${Math.min(100,tr.usedPct)}%;"></div><div class="marker" style="left:${Math.min(100,tr.elapsedPct)}%;"></div></div>
      </div>
      <div class="savplan-track-grid">
        <div class="savplan-tstat ${tr.projSaveUsd>=t.targetUsd?'good':''}"><div class="tv">${savPlanFmtUsd(tr.projSaveUsd)}</div><div class="tl2">Proyección de ahorro</div></div>
        <div class="savplan-tstat"><div class="tv">${savPlanFmtArs(tr.weeklyLeftArs)}</div><div class="tl2">Te queda esta semana</div></div>
        <div class="savplan-tstat"><div class="tv">${savPlanFmtArs(tr.dailyLeftArs)}</div><div class="tl2">Presupuesto diario</div></div>
        <div class="savplan-tstat ${streak.hits>=t.daysNoSpend?'good':''}"><div class="tv">${streak.hits} / ${t.daysNoSpend||0}</div><div class="tl2">Días sin gasto</div></div>
      </div>
      <div class="savplan-streak-wrap">
        <span class="savplan-lbl">Últimos ${streak.days.length} días · verde = día sin gasto recortable</span>
        <div class="savplan-streak">${streak.days.map(d=>`<span class="d ${d}"></span>`).join('')}</div>
      </div>
      <div class="savplan-tipbox"><div class="savplan-tip"><span class="ti">💡</span><span><b>Tip del día:</b> ${esc(tip)}</span></div></div>
      <div class="savplan-cta">
        <button class="savplan-btn" onclick="savPlanShowAiPrompt()">✨ Profundizar con IA</button>
        <button class="savplan-btn" onclick="savPlanExportPdf()">⬇ Exportar PDF</button>
        <button class="savplan-btn" onclick="savPlanBackToSetup()">Cambiar de plan</button>
      </div>
    </div>`;
}

function savPlanBuildStreak(a){
  // Últimos días del ciclo actual: verde = sin gasto recortable, rojo = con gasto, gris = futuro
  const discSet = new Set(state.savPlan.discretionaryCats);
  const spentByDay = {};
  savPlanWindowTxns(a.cyc.currentOpen, a.cyc.current.closeDate).forEach(t=>{
    if(!discSet.has(t.category)) return;
    const d = dateToYMD(t.date);
    spentByDay[d] = (spentByDay[d]||0) + savPlanTxArs(t);
  });
  const days = [];
  let hits = 0;
  const start = new Date(a.cyc.currentOpen+'T12:00:00');
  const totalToShow = Math.min(14, a.daysElapsed);
  const firstIdx = Math.max(0, a.daysElapsed - totalToShow);
  for(let i=firstIdx;i<a.daysElapsed;i++){
    const d = new Date(start); d.setDate(d.getDate()+i);
    const key = dateToYMD(d);
    if((spentByDay[key]||0) > 0) days.push('spent');
    else { days.push('hit'); hits++; }
  }
  // contar todos los días sin gasto del ciclo (no solo los visibles)
  let totalHits = 0;
  for(let i=0;i<a.daysElapsed;i++){
    const d = new Date(start); d.setDate(d.getDate()+i);
    if((spentByDay[dateToYMD(d)]||0) === 0) totalHits++;
  }
  return { days, hits: totalHits };
}

function savPlanShortDate(ymd){
  if(!ymd) return '';
  const d = new Date(ymd+'T12:00:00');
  return d.toLocaleDateString('es-AR',{day:'2-digit',month:'short'}).replace('.','');
}

// ══════════════════════════════════════════════════════════════
//  INTERACCIONES
// ══════════════════════════════════════════════════════════════
function savPlanSyncTargetsFromDOM(){
  document.querySelectorAll('.savplan-name').forEach(inp=>{
    const i = +inp.dataset.ti;
    if(state.savPlan.targets[i]) state.savPlan.targets[i].name = inp.value.trim() || state.savPlan.targets[i].name;
  });
  document.querySelectorAll('.savplan-val').forEach(inp=>{
    const i = +inp.dataset.ti;
    if(state.savPlan.targets[i]) state.savPlan.targets[i].amountUsd = Math.max(0, Number(inp.value)||0);
  });
}
function savPlanToggleCat(name){
  ensureSavPlan();
  savPlanSyncTargetsFromDOM();
  const set = new Set(state.savPlan.discretionaryCats);
  if(set.has(name)) set.delete(name); else set.add(name);
  state.savPlan.discretionaryCats = [...set];
  saveState();
  renderSavPlanSection();
}
function savPlanResetCats(){
  ensureSavPlan();
  savPlanSyncTargetsFromDOM();
  state.savPlan.discretionaryCats = savPlanDefaultDiscretionary();
  saveState();
  renderSavPlanSection();
}
function savPlanAnalyze(){
  ensureSavPlan();
  savPlanSyncTargetsFromDOM();
  saveState();
  const a = savPlanBuildAnalysis();
  if(!a.ok){ showToast('Necesito un ciclo de tarjeta cerrado para analizar','error'); return; }
  window._savPlanView = 'result';
  renderSavPlanSection();
}
function savPlanActivate(targetId){
  ensureSavPlan();
  const a = savPlanBuildAnalysis();
  state.savPlan.active = { targetId, cycleId: a.cyc.current.id, activatedAt: dateToYMD(new Date()) };
  saveState();
  window._savPlanView = 'track';
  renderSavPlanSection();
  const t = state.savPlan.targets.find(x=>x.id===targetId);
  showToast('✓ Plan activado: '+(t?t.name:''),'success');
}
function savPlanBackToSetup(){
  window._savPlanView = 'setup';
  renderSavPlanSection();
}

// ── Exportar PDF (reutiliza html2canvas + jsPDF ya cargados) ──
async function savPlanExportPdf(){
  const a = window._savPlanLastAnalysis || savPlanBuildAnalysis();
  if(!a.ok){ showToast('Sin datos para exportar','error'); return; }
  if(!window.html2canvas || !window.jspdf?.jsPDF){ showToast('Faltan librerías de PDF','error'); return; }
  showToast('Generando PDF…','info');
  const html = savPlanBuildPdfHtml(a);
  const shell = document.createElement('div');
  shell.style.cssText = 'position:fixed;left:-20000px;top:0;width:1120px;padding:24px;background:#f4f2fb;z-index:-1;font-family:-apple-system,Segoe UI,Roboto,sans-serif;';
  shell.innerHTML = html;
  document.body.appendChild(shell);
  try{
    const canvas = await window.html2canvas(shell, {scale:2, backgroundColor:'#f4f2fb', logging:false, windowWidth:1160});
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p','pt','a4');
    const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
    const margin = 12, drawW = pageW - margin*2;
    const pageCanvasH = Math.floor(canvas.width * ((pageH-margin*2)/drawW));
    let srcY=0, pi=0;
    while(srcY < canvas.height){
      const pc = document.createElement('canvas');
      pc.width = canvas.width; pc.height = Math.min(pageCanvasH, canvas.height-srcY);
      pc.getContext('2d').drawImage(canvas,0,srcY,canvas.width,pc.height,0,0,canvas.width,pc.height);
      if(pi>0) pdf.addPage();
      pdf.addImage(pc.toDataURL('image/png'),'PNG',margin,margin,drawW,pc.height*drawW/pc.width,undefined,'FAST');
      srcY += pc.height; pi++;
    }
    const url = URL.createObjectURL(pdf.output('blob'));
    const link = document.createElement('a');
    link.href = url; link.download = 'plan-ahorro-fluxen.pdf';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
    showToast('✓ PDF descargado','success');
  }catch(err){ console.error(err); showToast('No pude generar el PDF','error'); }
  finally{ shell.remove(); }
}

function savPlanBuildPdfHtml(a){
  const row = (k,v)=>`<tr><td style="padding:5px 0;color:#585c74;font-size:12px;">${k}</td><td style="padding:5px 0;text-align:right;font-weight:700;font-size:12px;color:#1c1a25;">${v}</td></tr>`;
  const catRows = a.prev.cats.slice(0,14).map(c=>`
    <tr>
      <td style="padding:4px 0;font-size:11.5px;color:#1c1a25;">${esc(c.cat)}</td>
      <td style="padding:4px 0;font-size:11.5px;text-align:right;font-weight:700;">${savPlanFmtArs(c.totalArs)}</td>
      <td style="padding:4px 0;font-size:11px;text-align:right;color:${c.disc?'#7C3AED':'#00838a'};">${c.disc?'recortable':'fijo'}</td>
    </tr>`).join('');
  const planCards = a.targets.map(t=>{
    const tips = savPlanTipsFor(t,a).map(tp=>`<li style="margin-bottom:4px;color:#585c74;font-size:11px;">${esc(tp.txt)}</li>`).join('');
    const color = t.feas==='easy'?'#1c9e60':t.feas==='mid'?'#7C3AED':'#c26900';
    return `
    <div style="border:1px solid #e4e2f0;border-radius:14px;overflow:hidden;">
      <div style="background:${color};color:#fff;padding:12px 14px;">
        <div style="font-size:12px;opacity:.9;">${esc(t.name)}</div>
        <div style="font-size:22px;font-weight:800;">${savPlanFmtUsd(t.targetUsd)}</div>
      </div>
      <div style="padding:12px 14px;">
        <table style="width:100%;">
          ${row('Recorte necesario', t.cutUsd<=0?'USD 0':savPlanFmtUsd(t.cutUsd))}
          ${row('Presupuesto semanal', savPlanFmtArs(t.weeklyBudgetArs))}
          ${row('Presupuesto diario', savPlanFmtArs(t.dailyBudgetArs))}
          ${row('Días sin gasto', t.daysNoSpend+' días')}
        </table>
        <ul style="margin:10px 0 0;padding-left:16px;">${tips}</ul>
      </div>
    </div>`;
  }).join('');
  return `
    <div style="background:#fff;border-radius:20px;padding:26px;box-shadow:0 20px 50px rgba(15,23,42,.08);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <div>
          <div style="font-size:20px;font-weight:800;color:#1c1a25;">Plan de ahorro — Fluxen</div>
          <div style="font-size:12px;color:#8a8ea6;font-weight:600;">Ciclo VISA+AMEX · ${savPlanShortDate(a.cyc.prevOpen)} → ${savPlanShortDate(a.cyc.prev.closeDate)} vs. ciclo actual</div>
        </div>
        <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#7C3AED,#00B8D4);"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;">
        <div style="background:#F5F3FF;border-radius:12px;padding:12px;"><div style="font-size:9.5px;font-weight:800;color:#8a8ea6;text-transform:uppercase;">Gastado ciclo previo</div><div style="font-size:16px;font-weight:800;margin-top:5px;">${savPlanFmtUsd(a.prev.totalArs/a.rate)}</div></div>
        <div style="background:#F5F3FF;border-radius:12px;padding:12px;"><div style="font-size:9.5px;font-weight:800;color:#8a8ea6;text-transform:uppercase;">Recortable</div><div style="font-size:16px;font-weight:800;margin-top:5px;">${a.discPct}%</div></div>
        <div style="background:#F5F3FF;border-radius:12px;padding:12px;"><div style="font-size:9.5px;font-weight:800;color:#8a8ea6;text-transform:uppercase;">Ciclo actual</div><div style="font-size:16px;font-weight:800;margin-top:5px;">${savPlanFmtUsd(a.cur.totalArs/a.rate)}</div></div>
        <div style="background:#F5F3FF;border-radius:12px;padding:12px;"><div style="font-size:9.5px;font-weight:800;color:#8a8ea6;text-transform:uppercase;">Ingreso del mes</div><div style="font-size:16px;font-weight:800;margin-top:5px;">${a.incomeUsd!=null?savPlanFmtUsd(a.incomeUsd):'—'}</div></div>
      </div>
      <div style="font-size:14px;font-weight:800;margin-bottom:10px;color:#1c1a25;">Escenarios de ahorro</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px;">${planCards}</div>
      <div style="font-size:14px;font-weight:800;margin-bottom:8px;color:#1c1a25;">Gasto por categoría (ciclo anterior)</div>
      <table style="width:100%;border-collapse:collapse;">${catRows}</table>
    </div>`;
}

// ── Profundizar con IA: genera prompt + PDF para pegar en Claude ──
function savPlanShowAiPrompt(){
  const a = window._savPlanLastAnalysis || savPlanBuildAnalysis();
  if(!a.ok){ showToast('Sin datos para el prompt','error'); return; }
  const prompt = savPlanBuildAiPrompt(a);
  const ta = document.getElementById('savplan-ai-prompt');
  if(ta) ta.value = prompt;
  openModal('modal-savplan-ai');
}
function savPlanCopyAiPrompt(){
  const ta = document.getElementById('savplan-ai-prompt');
  if(!ta) return;
  ta.select();
  navigator.clipboard?.writeText(ta.value).then(
    ()=>showToast('✓ Prompt copiado — pegalo en Claude','success'),
    ()=>{ document.execCommand('copy'); showToast('✓ Prompt copiado','success'); }
  );
}
function savPlanBuildAiPrompt(a){
  const cats = a.prev.cats.slice(0,16).map(c=>`- ${c.cat}: ${savPlanFmtArs(c.totalArs)} (${c.count} mov., ${c.disc?'recortable':'fijo'})`).join('\n');
  const targets = a.targets.map(t=>`- "${t.name}": ahorrar ${savPlanFmtUsd(t.targetUsd)} → recorte estimado ${savPlanFmtUsd(t.cutUsd)}, ${t.daysNoSpend} días sin gasto`).join('\n');
  return `Actuá como mi asesor financiero personal. Te paso el análisis real de mi tarjeta y quiero que profundices con recomendaciones concretas y accionables para ahorrar este mes.

CONTEXTO (ciclo VISA+AMEX):
- Ciclo anterior (cerrado): gasté ${savPlanFmtArs(a.prev.totalArs)} (${savPlanFmtUsd(a.prev.totalArs/a.rate)}), de los cuales ${a.discPct}% es discrecional/recortable.
- Ciclo actual (en curso): llevo gastado ${savPlanFmtArs(a.cur.totalArs)}, voy por el día ${a.daysElapsed} de ${a.cycleDays}.
- Ingreso del mes: ${a.incomeUsd!=null?savPlanFmtUsd(a.incomeUsd):'no cargado'}.
- Tipo de cambio usado: 1 USD = ${savPlanFmtArs(a.rate)}.

GASTO POR CATEGORÍA (ciclo anterior):
${cats}

MIS METAS DE AHORRO PARA ESTE MES:
${targets}

Quiero que me des:
1. Un diagnóstico honesto de mis 3 principales fugas de dinero.
2. Para cada meta, un plan semana a semana de cómo llegar, priorizando los recortes de mayor impacto y menor sacrificio.
3. Hábitos concretos (no genéricos) que pueda aplicar según MIS categorías reales.
4. Qué meta me recomendás y por qué.
Sé específico con los números y hablame en español rioplatense.`;
}
