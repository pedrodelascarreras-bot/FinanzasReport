// ══ INCOME PAGE ══
function getMonthTotalARS(m){
  let total=(m.extraArs||0);
  (m.sources?Object.entries(m.sources):[]).forEach(([srcId,amt])=>{
    const src=state.incomeSources.find(s=>s.id===srcId);
    if(src&&src.currency==='ARS')total+=amt||0;
  });
  return total;
}
function getMonthTotalUSD(m){
  let total=(m.extraUsd||0);
  (m.sources?Object.entries(m.sources):[]).forEach(([srcId,amt])=>{
    const src=state.incomeSources.find(s=>s.id===srcId);
    if(src&&src.currency==='USD')total+=amt||0;
  });
  return total;
}
// Combined ARS + USD×TC for income KPIs and chart
function getMonthTotalCombined(m){
  return getMonthTotalARS(m) + (getMonthTotalUSD(m) * USD_TO_ARS);
}

function getLatestIncomeARS(){
  if(!state.incomeMonths.length)return state.income.ars+state.income.varArs||0;
  const sorted=[...state.incomeMonths].sort((a,b)=>b.month.localeCompare(a.month));
  return getMonthTotalARS(sorted[0]);
}
// setIncCurrency replaced by setIncChartMode
function renderIncomePage() {
  const root = document.getElementById('income-native-root');
  if(!root) return;

  const TC=USD_TO_ARS||state.usdRate||1420;
  const months=[...state.incomeMonths].sort((a,b)=>b.month.localeCompare(a.month));
  const curMonthKey=getMonthKey(new Date());
  const curMonthData=months.find(m=>m.month===curMonthKey)||months[0];
  const curLabel=curMonthData?fmtMonthLabel(curMonthData.month):fmtMonthLabel(curMonthKey);

  // Helper: combined
  function getIncCombined(m){ return getMonthTotalARS(m) + getMonthTotalUSD(m)*TC; }

  // 1. Calculate top KPIs
  const curARS = curMonthData ? getMonthTotalARS(curMonthData) : 0;
  const curUSD = curMonthData ? getMonthTotalUSD(curMonthData) : 0;
  const curCombined = curARS + curUSD*TC;

  let prevCombined = 0, deltaPct = 0, deltaMonto = 0;
  if(months.length>1 && curMonthData) {
    const prevData = months[months.indexOf(curMonthData)+1];
    if(prevData){
      prevCombined=getIncCombined(prevData);
      deltaMonto = curCombined - prevCombined;
      deltaPct = prevCombined>0 ? Math.round((deltaMonto/prevCombined)*100) : 0;
    }
  }

  // 2. Próximo Ingreso. No se infiere una fecha si el usuario no la configuró.
  let nextIncomeDate = null;
  let nextIncomeDays = 0;
  void nextIncomeDays;

  // 3. Comparativa Inteligente (Promedio 3 meses)
  const last3 = months.slice(0,3);
  const avg3 = last3.length? last3.reduce((s,m)=>s+getIncCombined(m),0) / last3.length : 0;
  const diffAvg = curCombined - avg3;

  // 4. Mis Cuentas / Fuentes
  const fuentesCardsHtml = state.incomeSources.map(s=>{
    let icon='🏛'; let darkTheme=false; let badge=''; let badgeStyle='';
    const nLow=s.name.toLowerCase();
    if(nLow.includes('galicia')){ icon='🏦'; darkTheme=true; badge='Último ingreso 02 abr'; badgeStyle='background:rgba(255,255,255,0.1);color:#fff;'; }
    else if(nLow.includes('payoneer')){ icon='💳'; darkTheme=true; badge='8,1% del mes'; badgeStyle='background:rgba(59,130,246,0.3);color:#60a5fa;'; }
    else if(nLow.includes('naranja')||s.type==='credito'){ icon='N'; darkTheme=true; badge='+ Límite $3.200.000'; badgeStyle='background:rgba(255,255,255,0.1);color:#fff;'; }
    
    // Default fallback
    if(!badge) {
       badge = s.type==='fijo'?'Principal':'Mensual';
       badgeStyle = s.type==='fijo'?'background:#7c3aed;color:#fff;':'background:rgba(124,58,237,0.1);color:#7c3aed;';
    }

    const isUSD = s.currency==='USD';
    const amountVal = isUSD? 'USD '+fmtN(s.base||0) : '$'+fmtN(s.base||0);
    const bgClass = darkTheme ? 'bg-darked' : 'bg-white';

    return `
      <div class="icard cursor-pointer ${bgClass}" onclick="openIncomeSourceModal('${s.id}')">
        <div class="icard-head">
          <div class="icard-icon">${icon}</div>
          <div class="icard-badge" style="${badgeStyle}">${badge}</div>
        </div>
        <div class="icard-name">${esc(s.name)}</div>
        <div class="icard-sub">${esc(s.type)} · ${s.currency}</div>
        <div class="icard-amount">${amountVal}</div>
        <div class="icard-bottom-chip" style="${badgeStyle}">${esc(badge)}</div>
      </div>
    `;
  }).join('') || '<div class="empty-state" style="grid-column:1/-1;">Sin fuentes configuradas. Clickeá en "Estructura" para sumar ingresos.</div>';

  // 5. Historial Escaneable
  const historyHtml = months.slice(0,5).map(m=>{
    const ars = getMonthTotalARS(m);
    const usd = getMonthTotalUSD(m);
    const isCur = m.month===curMonthKey;
    return `
      <div class="ihist-row">
        <div class="ihist-m">
          <span style="font-weight:${isCur?'700':'500'};color:${isCur?'#7c3aed':'var(--text)'}">${fmtMonthLabel(m.month)}</span>
          ${isCur?'<span class="ihist-tag">Actual</span>':''}
        </div>
        <div class="ihist-ars">$${fmtN(ars)}</div>
        <div class="ihist-usd">${usd?'USD '+fmtN(usd):'—'}</div>
        <div class="ihist-tot">$${fmtN(getIncCombined(m))}</div>
      </div>
    `;
  }).join('');

  // 6. Insights Right Panel calcs
  const incomeScheduleDate = src => {
    const dateFields = ['nextPaymentDate','nextIncomeDate','payDate','salaryDate','cobroDate','fechaCobro'];
    const dayFields = ['payDay','paymentDay','salaryDay','cobroDay','diaCobro','diaDeCobro'];
    const today = new Date(); today.setHours(0,0,0,0);
    for(const field of dateFields){
      if(!src[field]) continue;
      const date = new Date(String(src[field]) + (String(src[field]).includes('T') ? '' : 'T12:00:00'));
      if(Number.isNaN(date.getTime())) continue;
      date.setHours(0,0,0,0);
      if(date >= today) return date;
    }
    for(const field of dayFields){
      const day = Number(src[field]);
      if(!Number.isFinite(day) || day < 1 || day > 31) continue;
      const buildDate = (year, month) => new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()));
      let date = buildDate(today.getFullYear(), today.getMonth());
      if(date < today) date = buildDate(today.getFullYear(), today.getMonth() + 1);
      return date;
    }
    return null;
  };
  const nextIncomesRows = state.incomeSources.map(s => ({source:s, date:incomeScheduleDate(s)})).filter(item => item.date).sort((a,b)=>a.date-b.date).slice(0,3);
  const nextIncomes = nextIncomesRows.length ? nextIncomesRows.map(({source:s, date})=>`
    <div class="i-next-row">
      <div class="i-next-date"><span>${date.toLocaleDateString('es-AR',{day:'numeric'})}</span><small>${date.toLocaleDateString('es-AR',{month:'short'}).replace('.','').toUpperCase()}</small></div>
      <div class="i-next-name">${esc(s.name)} (${s.currency})</div>
      <div class="i-next-val">${s.currency==='USD'?'USD':'$'}${fmtN(s.base||0)}</div>
    </div>
  `).join('') : '<div class="i-next-row"><div class="i-next-name">Sin fechas configuradas</div><div class="i-next-val">—</div></div>';

  const arsPct = curCombined>0? Math.round((curARS/curCombined)*100) : 0;
  const usdPct = curCombined>0? Math.round(((curUSD*TC)/curCombined)*100) : 0;

  // New generic dynamic logic for insights
  let biggestSourceAmt = 0;
  let biggestSourceName = "—";
  let biggestSourceType = "N";
  let biggestSourceColor = "#7c3aed";
  let activeSrcs = [];
  state.incomeSources.forEach(s => {
    let amt = curMonthData?.sources?.[s.id] || 0;
    if (s.currency === 'USD') amt *= TC;
    if (amt > 0) activeSrcs.push({ name: s.name, color: s.color||'#7c3aed', amt });
    if (amt > biggestSourceAmt) {
      biggestSourceAmt = amt;
      biggestSourceName = s.name;
      biggestSourceColor = s.color || "#7c3aed";
      biggestSourceType = s.name.charAt(0).toUpperCase();
    }
  });

  const biggestHtml = biggestSourceAmt > 0 ? `<div style="display:flex;align-items:center;gap:8px;margin-top:6px;"><div style="width:24px;height:24px;background:${biggestSourceColor}22;color:${biggestSourceColor};border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;">${biggestSourceType}</div><div><div style="font-size:12px;font-weight:700;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;">${esc(biggestSourceName)}</div><div style="font-size:12px;font-weight:800;">$${fmtN(biggestSourceAmt)}</div></div></div>` : '<div style="font-size:12px;font-weight:700;color:#64748b;margin-top:10px;">—</div>';

  let alertHtml = '';
  if (months.length > 1) {
    const prevMk = months[1].month;
    const prevUsd = getMonthTotalUSD(months[1]);
    const diffUsd = curUSD - prevUsd;
    if (diffUsd < 0 && prevUsd > 0) {
      const pctDrop = Math.abs((diffUsd / prevUsd) * 100).toFixed(1);
      alertHtml = `<div class="ipalert"><div class="ipalert-k">⚠️ ATENCIÓN</div><div class="ipalert-t">Tu ingreso en USD bajó</div><div class="ipalert-s">Recibiste USD ${fmtN(Math.abs(diffUsd))} menos que el mes anterior.</div><div class="ipalert-circ"><div class="ipalert-circ-t">-${pctDrop}%</div><div class="ipalert-circ-s">vs. ${fmtMonthLabel(prevMk)}</div></div></div>`;
    }
  }

  activeSrcs.sort((a,b)=>b.amt-a.amt);
  let dOff = 0;
  const totDist = activeSrcs.reduce((sum, s)=>sum+s.amt, 0) || 1;
  const donutCircles = activeSrcs.slice(0,3).map(s => {
     let cPct = (s.amt/totDist) * 220;
     let html = `<circle cx="45" cy="45" r="35" fill="none" stroke="${s.color}" stroke-width="12" stroke-dasharray="220" stroke-dashoffset="${220 - cPct}" style="transform: rotate(${(dOff/220)*360}deg); transform-origin: center;"/>`;
     dOff += cPct;
     return html;
  }).join('');
  const distribListHtml = activeSrcs.slice(0,3).map(s => `<div style="display:flex;justify-content:space-between;"><span><span style="color:${s.color};">●</span> ${esc(s.name)}</span> <span>${Math.round((s.amt/totDist)*100)}%</span></div>`).join('');

  // 7. Inject DOM
  const incInsightsHidden = localStorage.getItem('fin_inc_insights') === 'hidden';
  root.innerHTML = `
    <style>
      #income-native-root {
        padding: 0;
        font-family: var(--font);
        color: var(--text);
        box-sizing: border-box;
        background: transparent;
      }
      .inc-hdr { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; }
      .inc-hdr-title { font-size: 38px; font-weight: 850; letter-spacing: -0.045em; color: #1a1a24; line-height: 1; margin-bottom: 6px; }
      .inc-hdr-sub { font-size: 13px; color: #6e6b81; }
      
      .inc-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 24px; transition: grid-template-columns 0.35s cubic-bezier(.22,1,.36,1); }
      .inc-layout.insights-hidden { grid-template-columns: 1fr 0px !important; }
      .inc-layout.insights-hidden .ipan { width:0; overflow:hidden; padding:0; opacity:0; pointer-events:none; min-width:0; }
      .ipan { transition: width 0.35s cubic-bezier(.22,1,.36,1), opacity 0.25s ease, padding 0.3s ease; overflow:hidden; min-width:0; }
      @media(max-width:1100px){ .inc-layout{ grid-template-columns: 1fr !important; } }
      
      /* Top Widgets */
      .inc-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
      .ikpi { background: linear-gradient(145deg,#fff 0%,#fbfbff 100%); border-radius: 18px; padding: 20px; box-shadow: 0 8px 22px rgba(43,37,68,0.045); border: 1px solid rgba(0,0,0,0.04); position: relative; overflow: hidden; transition: transform .18s ease, box-shadow .18s ease; }
      .ikpi:hover { transform: translateY(-2px); box-shadow: 0 16px 32px rgba(43,37,68,0.08); }
      .ikpi::before { content:""; position:absolute; right:-34px; bottom:-42px; width:126px; height:126px; border-radius:50%; background:var(--ikpi-soft); }
      .ikpi::after { content:""; position:absolute; left:0; right:0; top:0; height:4px; background:linear-gradient(90deg,var(--ikpi-tone),var(--ikpi-tone-2)); }
      .ikpi-h { display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 800; color: #8e8b9e; text-transform: uppercase; letter-spacing: 0.065em; margin-bottom: 12px; position:relative; z-index:1; }
      .ikpi-v { font-size: 26px; font-weight: 850; letter-spacing: -0.035em; color: #1a1a24; margin-bottom: 8px; position:relative; z-index:1; }
      .ikpi-sub { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #6e6b81; font-weight: 650; position:relative; z-index:1; }
      .ikpi-sub.up { color: #10b981; }
      
      .ikpi-icon { width: 28px; height: 28px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 14px; background:var(--ikpi-soft); color:var(--ikpi-tone); box-shadow:inset 0 1px 0 rgba(255,255,255,.78); }
      .ikpi-c1 { --ikpi-tone:#5d35f3; --ikpi-tone-2:#ec4899; --ikpi-soft:rgba(93,53,243,.12); border-color:rgba(93,53,243,.16); }
      .ikpi-c2 { --ikpi-tone:#10b981; --ikpi-tone-2:#84cc16; --ikpi-soft:rgba(16,185,129,.13); border-color:rgba(16,185,129,.16); }
      .ikpi-c3 { --ikpi-tone:#0ea5e9; --ikpi-tone-2:#38bdf8; --ikpi-soft:rgba(14,165,233,.13); border-color:rgba(14,165,233,.16); }
      .ikpi-c4 { --ikpi-tone:#f97316; --ikpi-tone-2:#facc15; --ikpi-soft:rgba(249,115,22,.13); border-color:rgba(249,115,22,.18); }
      
      /* Bloques Blancos base */
      .iblock { background: linear-gradient(180deg,#fff 0%,#fbfcff 100%); border-radius: 22px; padding: 24px; box-shadow: 0 8px 24px rgba(43,37,68,0.045); border: 1px solid rgba(93,53,243,0.08); margin-bottom: 24px; }
      .iblock-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
      .iblock-title { font-size: 14px; font-weight: 800; color: #1a1a24; text-transform: uppercase; letter-spacing: 0.05em; }
      .iblock-sub { font-size: 12px; color: #8e8b9e; margin-top: 2px; }
      
      /* Comparativa Inteligente */
      .icomp-text { font-size: 20px; font-weight: 700; color: #1a1a24; margin-bottom: 24px; }
      .icomp-text span { color: #10b981; }
      
      .icomp-bar-row { display: grid; grid-template-columns: 140px 1fr 100px; gap: 16px; align-items: center; margin-bottom: 16px; }
      .icomp-bar-label { font-size: 11px; font-weight: 700; color: #8e8b9e; text-transform: uppercase; letter-spacing: 0.04em; }
      .icomp-bar-val { font-size: 14px; font-weight: 800; color: #1a1a24; }
      .icomp-bar-avg { height: 16px; background: linear-gradient(90deg,#e2e8f0,#eef2ff); border-radius: 8px; width: 85%; }
      .icomp-bar-cur { height: 16px; background: linear-gradient(90deg,#10b981,#38bdf8,#7c3aed); border-radius: 8px; width: 100%; box-shadow:0 8px 18px rgba(16,185,129,.16); }
      .icomp-bar-diff { font-size: 14px; font-weight: 700; color: #10b981; text-align: right; }
      
      .icomp-axis { display: flex; justify-content: space-between; margin-left: 156px; margin-right: 116px; font-size: 11px; color: #8e8b9e; border-top: 1px solid #f1f5f9; padding-top: 8px; margin-bottom: 24px; }
      .icomp-tip { background: linear-gradient(135deg,#ecfdf5 0%,#f5f3ff 100%); border:1px solid rgba(16,185,129,.12); border-radius: 14px; padding: 12px 16px; display: flex; align-items: center; gap: 12px; font-size: 13px; color: #475569; }
      .icomp-tip-icon { color: #7c3aed; font-size: 18px; }
      
      /* Mis Cuentas Carts */
      .icm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; margin-bottom: 16px; }
      .icard { border-radius: 18px; padding: 20px; position: relative; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow .2s; }
      .icard::after { content:""; position:absolute; right:-28px; bottom:-34px; width:94px; height:94px; border-radius:50%; background:rgba(255,255,255,.13); pointer-events:none; }
      .icard:hover { transform: translateY(-3px); box-shadow:0 16px 30px rgba(43,37,68,.10); }
      .icard.bg-darked { background: linear-gradient(145deg,#111827 0%,#25315f 58%,#5d35f3 140%); color: #fff; }
      .icard.bg-darked .icard-name { color: #f8fafc; }
      .icard.bg-darked .icard-sub { color: #94a3b8; }
      .icard.bg-white { background: linear-gradient(145deg,#f8fafc 0%,#eefcf5 100%); border: 1px solid rgba(16,185,129,.14); }
      .icard-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
      .icard-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 1px solid rgba(255,255,255,0.1); }
      .icard-badge { font-size: 9px; font-weight: 700; padding: 3px 8px; border-radius: 12px; }
      .icard-name { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 2px; }
      .icard-sub { font-size: 11px; color: #64748b; margin-bottom: 20px; }
      .icard-amount { font-size: 18px; font-weight: 800; margin-top: auto; margin-bottom: 8px; }
      .icard-bottom-chip { font-size: 10px; font-weight: 600; text-align: center; padding: 4px; border-radius: 6px; }
      
      .ifilters { display: flex; gap: 8px; align-items: center; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
      .ichip { background: #f1f5f9; border-radius: 16px; padding: 6px 12px; color: #475569; border:1px solid rgba(93,53,243,.08); }
      
      /* Bottom Split */
      .ibot-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 24px; }
      
      .ihist-table { width: 100%; border-collapse: collapse; }
      .ihist-header { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-size: 10px; font-weight: 700; color: #8e8b9e; text-transform: uppercase; }
      .ihist-row { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; padding: 16px 0; border-bottom: 1px solid #f1f5f9; align-items: center; font-size: 13px; font-weight: 500; }
      .ihist-tag { font-size: 10px; font-weight: 700; background: #e0e7ff; color: #4f46e5; padding: 2px 6px; border-radius: 4px; margin-left: 8px; }
      .ihist-tot { font-weight: 800; color: #1a1a24; }
      
      .iconf-row { margin-bottom: 16px; }
      .iconf-label { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; color: #475569; font-size: 13px; font-weight: 600; }
      .iconf-label-icon { width: 28px; height: 28px; background: #f3e8ff; color: #7c3aed; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
      .iconf-inp-wrap { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; margin-left: 40px; }
      .iconf-inp-wrap input { flex:1; background:transparent; border:none; outline:none; font-size: 15px; font-weight: 700; color:#1e293b; }
      .iconf-inp-suf { font-size: 13px; color: #64748b; }
      
      /* Panel Derecho (Insights) */
      .ipan { display: flex; flex-direction: column; gap: 16px; }
      .ipan-hdr { font-size: 12px; font-weight: 700; display: flex; justify-content: space-between; align-items: center; color: #7c3aed; }
      
      .ipalert { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); border-radius: 16px; padding: 20px; color: #fff; position: relative; overflow: hidden; }
      .ipalert-k { font-size: 10px; font-weight: 700; color: #a5b4fc; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
      .ipalert-t { font-size: 18px; font-weight: 800; margin-bottom: 8px; }
      .ipalert-s { font-size: 13px; color: #c7d2fe; line-height: 1.4; width: 60%; }
      .ipalert-circ { position: absolute; right: -20px; top: 10px; width: 110px; height: 110px; border-radius: 50%; background: #312e81; border: 12px solid #4338ca; border-top-color: #f43f5e; display: flex; align-items: center; justify-content: center; flex-direction: column; }
      .ipalert-circ-t { font-size: 16px; font-weight: 800; color: #fff; }
      .ipalert-circ-s { font-size: 9px; color: #a5b4fc; }
      
      .ipan-box { background: linear-gradient(180deg,#fff 0%,#fbfbff 100%); border-radius: 16px; padding: 20px; border: 1px solid rgba(93,53,243,.08); box-shadow: 0 8px 18px rgba(43,37,68,.045); }
      .ip-title { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #8e8b9e; text-transform: uppercase; margin-bottom: 16px; }
      .ip-title a { color: #7c3aed; text-transform: none; text-decoration: none; }
      
      .i-next-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
      .i-next-date { width: 36px; height: 36px; background: #f3e8ff; color: #7c3aed; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; }
      .i-next-date span { font-size: 14px; font-weight: 800; }
      .i-next-date small { font-size: 9px; font-weight: 700; }
      .i-next-name { font-size: 13px; font-weight: 600; color: #334155; flex: 1; }
      .i-next-val { font-size: 13px; font-weight: 800; color: #0f172a; }
      
      .ip-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .ip-mini { border: 1px solid #f1f5f9; border-radius: 12px; padding: 12px; }
      .ip-mini-lbl { font-size: 9px; font-weight: 700; color: #8e8b9e; text-transform: uppercase; margin-bottom: 6px; }
      .ip-mini-val { font-size: 15px; font-weight: 800; color: #1e293b; margin-bottom: 2px; }
      
      .ip-bars-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; font-size: 12px; font-weight: 700; color: #1e293b; }
      .ip-bar-track { flex:1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
      .ip-bar-fill { height: 100%; border-radius: 4px; }
    </style>

    <div class="inc-hdr fade-up">
      <div>
        <div class="inc-hdr-title">Ingresos</div>
        <div class="inc-hdr-sub">Mes correspondiente · sueldo ARS/USD · estructura laboral flexible</div>
      </div>
      <div style="display:flex;gap:12px;">
        <button class="btn btn-ghost" style="background:#fff;border:1px solid #e2e8f0;" onclick="openIncomeSourceModal()">⚙ Estructura</button>
        <button class="btn btn-primary" style="background:#7c3aed;" onclick="openLogIncomeModal()">+ Registrar mes</button>
      </div>
    </div>

    <div class="inc-layout ${incInsightsHidden ? 'insights-hidden' : ''}">
      <!-- MAIN LEFT -->
      <div class="inc-main fade-up">
        
        <!-- 4 KPIs -->
        <div class="inc-kpi-grid">
          <div class="ikpi ikpi-c1">
            <div class="ikpi-h"><div class="ikpi-icon">💳</div> TOTAL DEL MES</div>
            <div class="ikpi-v">$${fmtN(curCombined)}</div>
            <div class="ikpi-sub ${deltaMonto>=0?'up':''}"><span style="font-size:14px;">${deltaMonto>=0?'↑':'↓'}</span> ${Math.abs(deltaPct)}% vs ${months[1]?fmtMonthLabel(months[1].month):'Mes ant'}</div>
          </div>
          <div class="ikpi ikpi-c2">
            <div class="ikpi-h"><div class="ikpi-icon">💵</div> TOTAL ARS</div>
            <div class="ikpi-v">$${fmtN(curARS)}</div>
            <div class="ikpi-sub" style="color:#64748b;">USD ${fmtN(curUSD)}</div>
          </div>
          <div class="ikpi ikpi-c3">
            <div class="ikpi-h"><div class="ikpi-icon">💲</div> TOTAL USD</div>
            <div class="ikpi-v">USD ${fmtN(curUSD)}</div>
            <div class="ikpi-sub" style="color:#64748b;">≈ $${fmtN(curUSD*TC)}</div>
          </div>
          <div class="ikpi ikpi-c4">
            <div class="ikpi-h"><div class="ikpi-icon">📅</div> PRÓXIMO INGRESO</div>
            <div class="ikpi-v">${nextIncomeDate||'—'}</div>
            <div class="ikpi-sub" style="background:#fef3c7;padding:2px 8px;border-radius:12px;color:#d97706;width:fit-content;font-weight:700;">Sin datos</div>
          </div>
        </div>

        <!-- Comparativa -->
        <div class="iblock">
          <div class="iblock-h">
            <div>
              <div class="iblock-title">COMPARATIVA INTELIGENTE</div>
              <div class="iblock-sub">${curLabel} vs. promedio de últimos 3 meses</div>
            </div>
            <div style="display:flex;gap:4px;background:#f1f5f9;padding:4px;border-radius:20px;">
              <button class="btn btn-sm" style="background:#7c3aed;color:#fff;border-radius:16px;">Mensual</button>
              <button class="btn btn-ghost btn-sm" style="border-radius:16px;">Acumulado</button>
            </div>
          </div>
          <div class="icomp-text">Estás <span style="color:${diffAvg>=0?'#10b981':'#ef4444'}">${diffAvg>=0?'+':''}$${fmtN(diffAvg)}</span> por encima de tu promedio.</div>
          
          <div class="icomp-bar-row">
            <div>
              <div class="icomp-bar-label">PROMEDIO 3 MESES</div>
              <div class="icomp-bar-val">$${fmtN(avg3)}</div>
            </div>
            <div class="icomp-bar-avg"></div>
            <div></div>
          </div>
          <div class="icomp-bar-row" style="margin-bottom:8px;">
            <div>
              <div class="icomp-bar-label" style="color:#7c3aed;">${curLabel}</div>
              <div class="icomp-bar-val">$${fmtN(curCombined)}</div>
            </div>
            <div class="icomp-bar-cur"></div>
            <div class="icomp-bar-diff" style="color:${diffAvg>=0?'#10b981':'#ef4444'}">${diffAvg>=0?'+':''}$${fmtN(diffAvg)}</div>
          </div>
          <div class="icomp-axis">
            <span>$${fmtN(avg3*0.8)}</span>
            <span>$${fmtN(avg3)}</span>
            <span>$${fmtN(avg3*1.2)}</span>
            <span>$${fmtN(avg3*1.4)}</span>
          </div>
          
          <div class="icomp-tip">
            <div class="icomp-tip-icon">💡</div>
            <div style="flex:1;">Llevás 3 meses con tendencia positiva. ${curLabel} mantiene el crecimiento.</div>
            <a href="#" style="color:#7c3aed;font-weight:700;text-decoration:none;">Ver análisis →</a>
          </div>
        </div>

        <!-- Mis Cuentas -->
        <div class="iblock">
          <div class="iblock-h">
            <div>
              <div class="iblock-title" style="font-size:16px;text-transform:none;">Mis cuentas</div>
              <div class="iblock-sub">Donde recibís tus ingresos</div>
            </div>
            <div style="display:flex;gap:16px;align-items:center;">
              <a href="#" style="color:#7c3aed;font-weight:700;text-decoration:none;font-size:13px;" onclick="openIncomeSourceModal()">Ver todas (${state.incomeSources.length}) →</a>
              <button class="btn btn-primary btn-sm" style="background:#7c3aed;" onclick="openIncomeSourceModal()">+ Agregar cuenta</button>
            </div>
          </div>
          
          <div class="icm-grid">
            ${fuentesCardsHtml}
          </div>
          
          <div class="ifilters">
            VER TODO: 
            <span class="ichip">Cuentas bancarias (3)</span>
            <span class="ichip">Tarjetas (2)</span>
            <span class="ichip">Efectivo</span>
            <span class="ichip">Otras (1)</span>
          </div>
        </div>

        <!-- Bottom Split -->
        <div class="ibot-grid">
          <div class="iblock">
            <div class="iblock-h" style="margin-bottom:24px;">
              <div>
                <div class="iblock-title" style="font-size:13px;">HISTORIAL MENSUAL</div>
                <div class="iblock-sub">Tus ingresos de los últimos meses</div>
              </div>
              <a href="#" style="color:#7c3aed;font-weight:700;text-decoration:none;font-size:13px;">Ver histórico completo →</a>
            </div>
            
            <table class="ihist-table">
              <tr><td colspan="4"><div class="ihist-header"><div>MES</div><div>ARS</div><div>USD</div><div>TOTAL (ARS)</div></div></td></tr>
              <tr><td colspan="4">${historyHtml}</td></tr>
            </table>
            
            <div style="margin-top:20px;">
              <button class="btn btn-ghost" style="background:#f1f5f9;color:#475569;">📥 Exportar histórico</button>
            </div>
          </div>
          
          <div class="iblock">
            <div class="iblock-h" style="margin-bottom:24px;">
              <div>
                <div class="iblock-title" style="font-size:13px;">CONFIGURACIÓN DEL MARGEN MENSUAL</div>
                <div class="iblock-sub">Metas y alertas para tus ingresos</div>
              </div>
              <a href="#" style="color:#7c3aed;font-weight:700;text-decoration:none;font-size:13px;">Editar configuración</a>
            </div>
            
            <div class="iconf-row">
              <div class="iconf-label"><div class="iconf-label-icon">🎯</div> META DE AHORRO</div>
              <div class="iconf-inp-wrap">
                <input type="number" id="inc-save" value="${state.savingsGoal||20}" onchange="saveIncConfig()">
                <span class="iconf-inp-suf">% del ingreso</span>
              </div>
            </div>
            <div class="iconf-row">
              <div class="iconf-label"><div class="iconf-label-icon" style="background:#fee2e2;color:#ef4444;">🔔</div> ALERTA DE GASTO</div>
              <div class="iconf-inp-wrap">
                <input type="number" id="inc-alert" value="${state.alertThreshold||80}" onchange="saveIncConfig()">
                <span class="iconf-inp-suf">% del ingreso</span>
              </div>
            </div>
            <div class="iconf-row">
              <div class="iconf-label"><div class="iconf-label-icon" style="background:#ede9fe;color:#6366f1;">💰</div> PRESUPUESTO DISPONIBLE</div>
              <div class="iconf-inp-wrap">
                <input type="number" id="inc-spend-pct" value="${state.spendPct||100}" onchange="saveIncConfig()">
                <span class="iconf-inp-suf">% del ingreso</span>
              </div>
            </div>
            
            <div class="icomp-tip" style="margin-top:24px;">
              <div class="icomp-tip-icon">💡</div>
              <div><strong>TIP:</strong> Con un margen del <strong>${state.savingsGoal||20}%</strong> estás ahorrando $${fmtN(curCombined*(state.savingsGoal||20)/100)} este mes si mantenés tus gastos bajo control.</div>
            </div>
          </div>
        </div>

      </div>

      <!-- INSIGHTS RIGHT PANE -->
      <div class="ipan fade-up" style="animation-delay:0.1s;">
        <div class="ipan-hdr">
          <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:16px;">💡</span> REPORTE MENSUAL</div>
          <button class="ipan-toggle-btn" onclick="toggleIncomeInsights()" title="Ocultar insights">×</button>
        </div>

        ${alertHtml}

        <div class="ipan-box" style="display:flex;gap:16px;align-items:center;">
          <div style="width:40px;height:40px;border-radius:8px;background:#f3e8ff;color:#9333ea;display:flex;align-items:center;justify-content:center;font-size:20px;">💼</div>
          <div style="flex:1;">
            <div style="font-size:10px;font-weight:800;color:#8e8b9e;letter-spacing:0.04em;">POTENCIAL BASE</div>
            <div style="font-size:18px;font-weight:800;color:#1e293b;margin:2px 0;">$${fmtN(state.incomeSources.reduce((s,i)=>s+(i.currency==='USD'?i.base*TC:i.base),0))}</div>
            <div style="font-size:11px;color:#64748b;">Si cobrás todos tus fijos configurados.</div>
          </div>
        </div>

        <div class="ip-grid2">
          <div class="ip-mini">
            <div class="ip-mini-lbl">PROMEDIO MENSUAL</div>
            <div class="ip-mini-val">$${fmtN(avg3)}</div>
            <div style="font-size:11px;font-weight:600;color:#7c3aed;">Últimos 3 meses.</div>
          </div>
          <div class="ip-mini">
            <div class="ip-mini-lbl">MAYOR INGRESO</div>
            ${biggestHtml}
          </div>
        </div>

        <div class="ipan-box">
          <div class="ip-title">INGRESOS POR MONEDA <span style="text-transform:none;color:#64748b;font-weight:500;">${curLabel}</span></div>
          <div class="ip-bars-row">
            <div style="width:30px;">ARS</div>
            <div class="ip-bar-track"><div class="ip-bar-fill" style="width:${arsPct}%;background:#7c3aed;"></div></div>
            <div style="width:36px;color:#8e8b9e;font-weight:600;">${arsPct}%</div>
            <div style="width:80px;text-align:right;">$${fmtN(curARS)}</div>
          </div>
          <div class="ip-bars-row">
            <div style="width:30px;">USD</div>
            <div class="ip-bar-track"><div class="ip-bar-fill" style="width:${usdPct}%;background:#0ea5e9;"></div></div>
            <div style="width:36px;color:#8e8b9e;font-weight:600;">${usdPct}%</div>
            <div style="width:80px;text-align:right;">USD ${fmtN(curUSD)}</div>
          </div>
        </div>

        <div class="ipan-box">
          <div class="ip-title">DISTRIBUCIÓN DE FUENTES</div>
          <div style="display:flex;gap:20px;align-items:center;">
            <div style="position:relative;width:90px;height:90px;">
              <svg width="90" height="90" viewBox="0 0 90 90" style="transform:rotate(-90deg);">
                <circle cx="45" cy="45" r="35" fill="none" stroke="#f1f5f9" stroke-width="12"/>
                ${donutCircles}
              </svg>
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;">$${fmtN(curCombined/1000)}k</div>
            </div>
            <div style="flex:1;font-size:10px;font-weight:600;display:flex;flex-direction:column;gap:8px;">
              ${distribListHtml}
            </div>
          </div>
        </div>
        
        <div class="ipan-box" style="background:#f0fdf4;border:1px solid #bbf7d0;">
          <div style="display:flex;gap:12px;align-items:flex-start;">
            <div style="width:32px;height:32px;background:#dcfce7;color:#16a34a;border-radius:16px;display:flex;align-items:center;justify-content:center;">↗</div>
            <div style="flex:1;">
              <div style="font-size:11px;font-weight:700;color:#16a34a;letter-spacing:0.04em;margin-bottom:4px;">TENDENCIA</div>
              <div style="font-size:12px;color:#166534;line-height:1.4;">Llevás 3 meses creciendo. Sostenelo para alcanzar tu meta de ahorro del ${state.savingsGoal||20}%.</div>
              <div style="font-size:12px;font-weight:700;color:#15803d;margin-top:6px;">+12,4% en el trimestre</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}
function fmtMonthLabel(k){if(!k)return'—';const[y,m]=k.split('-');return new Date(parseInt(y),parseInt(m)-1,1).toLocaleDateString('es-AR',{month:'short',year:'2-digit'});}

// ── Income source modal ──
function openIncomeSourceModal(id){
  const editing=id?state.incomeSources.find(s=>s.id===id):null;
  document.getElementById('modal-inc-src-title').textContent=editing?'Editar fuente':'Nueva fuente de ingreso';
  document.getElementById('modal-inc-src-editing').value=editing?editing.id:'';
  document.getElementById('inc-src-name').value=editing?editing.name:'';
  document.getElementById('inc-src-type').value=editing?editing.type:'fijo';
  document.getElementById('inc-src-currency').value=editing?editing.currency:'ARS';
  document.getElementById('inc-src-base').value=editing&&editing.base?editing.base:'';
  document.getElementById('btn-del-inc-src').style.display=editing?'inline-flex':'none';
  renderGenericColorPicker('inc-src-color-picker',editing?editing.color:'');
  openModal('modal-inc-source');
}
function saveIncSource(){
  const name=document.getElementById('inc-src-name').value.trim();if(!name){showToast('⚠️ Ingresá nombre','error');return;}
  const sw=document.querySelector('#inc-src-color-picker .color-swatch.selected');
  const color=sw?rgbToHex(sw.style.backgroundColor):'#007aff';
  const obj={id:document.getElementById('modal-inc-src-editing').value||Date.now().toString(36),name,type:document.getElementById('inc-src-type').value,currency:document.getElementById('inc-src-currency').value,base:parseFloat(document.getElementById('inc-src-base').value)||0,color};
  const idx=state.incomeSources.findIndex(s=>s.id===obj.id);
  if(idx>=0)state.incomeSources[idx]=obj;else state.incomeSources.push(obj);
  // Auto-sync: if current month already has an entry, update this source's amount in it
  if(obj.base>0){
    const _mk=getMonthKey(new Date());
    const _cur=state.incomeMonths.find(m=>m.month===_mk);
    if(_cur){
      if(!_cur.sources)_cur.sources={};
      _cur.sources[obj.id]=obj.base;
      state.income.ars=getMonthTotalARS(_cur);
      state.income.usd=getMonthTotalUSD(_cur);
    }
  }
  saveState();closeModal('modal-inc-source');renderIncomePage();refreshAll();showToast('✓ Fuente guardada','success');
}

// ── Sync current month with source bases ──────────────────────────────────────
function syncCurrentMonthIncome(){
  if(!(state.incomeSources||[]).some(s=>s.base>0)){
    showToast('⚠️ Configurá un monto base en las fuentes primero','error');return;
  }
  const mk=getMonthKey(new Date());
  const sources={};
  state.incomeSources.forEach(s=>{if(s.base>0)sources[s.id]=s.base;});
  let entry=state.incomeMonths.find(m=>m.month===mk);
  if(entry){
    // Merge: update each source amount but preserve extra and notes
    entry.sources=Object.assign({},entry.sources,sources);
  } else {
    entry={id:Date.now().toString(36),month:mk,sources,extraArs:0,extraUsd:0,note:'Auto-sincronizado'};
    state.incomeMonths.push(entry);
  }
  state.income.ars=getMonthTotalARS(entry);
  state.income.usd=getMonthTotalUSD(entry);
  saveState();renderIncomePage();refreshAll();
  showToast('✓ Ingreso del mes sincronizado con las fuentes configuradas','success');
}
function deleteIncSource(){
  const id=document.getElementById('modal-inc-src-editing').value;
  state.incomeSources=state.incomeSources.filter(s=>s.id!==id);
  saveState();closeModal('modal-inc-source');renderIncomePage();refreshAll();showToast('Fuente eliminada','info');
}

// ── Log income month modal ──
function openLogIncomeModal(){
  document.getElementById('modal-log-inc-title').textContent='Registrar ingresos del mes';
  document.getElementById('modal-log-inc-sub').textContent='Registrá el ingreso correspondiente a ese mes, aunque lo hayas cobrado después';
  document.getElementById('log-inc-editing').value='';
  document.getElementById('log-inc-month').value=getMonthKey(new Date());
  document.getElementById('log-inc-note').value='';
  document.getElementById('log-inc-extra-ars').value='';
  document.getElementById('log-inc-extra-usd').value='';
  document.getElementById('btn-del-inc-month').style.display='none';
  buildLogIncSourceFields({});updateIncModalPreview();openModal('modal-log-income');
}
function editIncMonth(id){
  const m=state.incomeMonths.find(x=>x.id===id);if(!m)return;
  document.getElementById('modal-log-inc-title').textContent='Editar — '+fmtMonthLabel(m.month);
  document.getElementById('modal-log-inc-sub').textContent='Ajustá el mes al que corresponde el ingreso, no solamente la fecha en que entró.';
  document.getElementById('log-inc-editing').value=id;
  document.getElementById('log-inc-month').value=m.month;
  document.getElementById('log-inc-note').value=m.note||'';
  document.getElementById('log-inc-extra-ars').value=m.extraArs||'';
  document.getElementById('log-inc-extra-usd').value=m.extraUsd||'';
  document.getElementById('btn-del-inc-month').style.display='inline-flex';
  buildLogIncSourceFields(m.sources||{});updateIncModalPreview();openModal('modal-log-income');
}
function buildLogIncSourceFields(values){
  const el=document.getElementById('log-inc-sources-fields');
  if(!state.incomeSources.length){el.innerHTML='<div style="font-size:12px;color:var(--text3);font-family:var(--font);padding:8px 0;">No necesitás configurar estructura si solo querés cargar tu sueldo principal ARS/USD. Usala cuando tengas otros trabajos, freelance o rentas.</div>';return;}
  el.innerHTML='<div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:2px;">Otras fuentes o componentes</div>'+state.incomeSources.map(src=>{
    const c=src.color||'#888888';
    return'<div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:var(--surface2);border-radius:var(--r2);border:1px solid var(--border);">'
      +'<div style="width:8px;height:8px;border-radius:50%;background:'+c+';flex-shrink:0;"></div>'
      +'<div style="flex:1;font-size:13px;font-weight:600;">'+esc(src.name)+'<span style="font-size:10px;color:var(--text3);margin-left:6px;font-family:var(--font);">'+src.currency+'</span></div>'
      +'<input type="number" class="input-field" style="width:150px;padding:7px 10px;" id="log-src-'+src.id+'" placeholder="'+(src.base||0)+'" value="'+(values[src.id]||'')+'" oninput="updateIncModalPreview()">'
      +'</div>';
  }).join('');
}
function updateIncModalPreview(){
  let arsTotal=parseFloat(document.getElementById('log-inc-extra-ars')?.value)||0;
  let usdTotal=parseFloat(document.getElementById('log-inc-extra-usd')?.value)||0;
  state.incomeSources.forEach(src=>{const v=parseFloat(document.getElementById('log-src-'+src.id)?.value)||0;if(src.currency==='ARS')arsTotal+=v;else usdTotal+=v;});
  document.getElementById('log-inc-preview-ars').textContent='$'+fmtN(arsTotal);
  document.getElementById('log-inc-preview-usd').textContent='U$D '+fmtN(usdTotal);
}
function saveIncMonth(){
  const month=document.getElementById('log-inc-month').value;if(!month){showToast('⚠️ Seleccioná el mes','error');return;}
  const sources={};
  state.incomeSources.forEach(src=>{const v=parseFloat(document.getElementById('log-src-'+src.id)?.value)||0;if(v>0)sources[src.id]=v;});
  const extraArs=parseFloat(document.getElementById('log-inc-extra-ars').value)||0;
  const extraUsd=parseFloat(document.getElementById('log-inc-extra-usd').value)||0;
  const note=document.getElementById('log-inc-note').value.trim();
  const editing=document.getElementById('log-inc-editing').value;
  const obj={id:editing||Date.now().toString(36),month,sources,extraArs,extraUsd,note};
  const idx=state.incomeMonths.findIndex(x=>x.id===obj.id);
  if(idx>=0)state.incomeMonths[idx]=obj;else{
    // also check by month key
    const mIdx=state.incomeMonths.findIndex(x=>x.month===month&&!editing);
    if(mIdx>=0)state.incomeMonths[mIdx]=obj;else state.incomeMonths.push(obj);
  }
  // update legacy income fields so dashboard still works
  const totalARS=getMonthTotalARS(obj);
  const totalUSD=getMonthTotalUSD(obj);
  state.income.ars=totalARS;
  state.income.usd=totalUSD;
  saveState();closeModal('modal-log-income');renderIncomePage();
  showToast('✓ '+fmtMonthLabel(month)+' guardado','success');
  refreshAll();
}
function deleteIncMonth(){
  const id=document.getElementById('log-inc-editing').value;
  state.incomeMonths=state.incomeMonths.filter(m=>m.id!==id);
  saveState();closeModal('modal-log-income');renderIncomePage();refreshAll();showToast('Mes eliminado','info');
}
function saveIncConfig(){
  state.savingsGoal=parseInt(document.getElementById('inc-save').value)||20;
  state.alertThreshold=parseInt(document.getElementById('inc-alert').value)||80;
  const _sp=parseInt(document.getElementById('inc-spend-pct')?.value);
  state.spendPct=(_sp>0&&_sp<=100)?_sp:100;
  saveState();refreshAll();
}

// ══ INCOME (legacy compat) ══
function saveIncome(){
  const pn=s=>{const c=String(s||'').replace(/\./g,'').replace(',','.');return parseFloat(c)||0;};
  state.income.ars=pn(document.getElementById('inc-ars').value);state.income.varArs=pn(document.getElementById('inc-var-ars').value);state.income.usd=pn(document.getElementById('inc-usd').value);state.income.varUsd=pn(document.getElementById('inc-var-usd').value);
  state.savingsGoal=parseInt(document.getElementById('inc-save').value)||20;state.alertThreshold=parseInt(document.getElementById('inc-alert').value)||80;
  saveState();showToast('✓ Guardado','success');refreshAll();
}

function toggleIncomeInsights() {
  const layout = document.querySelector('.inc-layout');
  if (!layout) return;
  const isHidden = layout.classList.toggle('insights-hidden');
  localStorage.setItem('fin_inc_insights', isHidden ? 'hidden' : 'visible');
  
  // Change button text/content
  const btn = layout.querySelector('.ipan-toggle-btn');
  if (btn) btn.textContent = isHidden ? '📊' : '×';
}

// ══ API KEY ══
function getApiKey(){return state.apiKey||localStorage.getItem('fin_apikey')||'';}
function saveApiKey(){const k=document.getElementById('input-apikey').value.trim();if(!k)return;state.apiKey=k;localStorage.setItem('fin_apikey',k);closeModal('modal-apikey');showToast('✓ API Key guardada','success');}
