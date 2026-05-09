// ══════════════════════════════════════════════════════════
// INCOME PAGE — Rediseño v2
// Estructura: sueldo (ARS + USD + comisiones USD) + extras
// Schema-aware: maneja tanto V1 (legacy) como V2 (nuevo)
// ══════════════════════════════════════════════════════════

// ── Helpers de cálculo (schema-aware) ──────────────────────
function _isV2(m){ return m && m.schemaVersion === 2; }

function getMonthSalaryARS(m){
  if (_isV2(m)) return Number(m.salary?.ars?.amount || 0);
  let total = (m?.extraArs || 0);
  (m?.sources ? Object.entries(m.sources) : []).forEach(([srcId, amt]) => {
    const src = (state.incomeSources||[]).find(s => s.id === srcId);
    if (src && src.currency === 'ARS') total += amt || 0;
  });
  return total;
}

function getMonthSalaryUSD(m){
  // Sueldo USD only (excluding commissions and extras)
  if (_isV2(m)) return Number(m.salary?.usd?.amount || 0);
  let total = (m?.extraUsd || 0);
  (m?.sources ? Object.entries(m.sources) : []).forEach(([srcId, amt]) => {
    const src = (state.incomeSources||[]).find(s => s.id === srcId);
    if (src && src.currency === 'USD') total += amt || 0;
  });
  return total;
}

function getMonthCommissionsUSD(m){
  // Commissions are always USD in v2; legacy didn't track them
  if (_isV2(m)) return Number(m.salary?.commissions?.amount || 0);
  return 0;
}

function getMonthExtrasV2(m){
  return _isV2(m) ? (m.extras || []) : [];
}

// ── Combined totals (used by dashboard) ────────────────────
function getMonthTotalARS(m){
  // ARS portion: salary ARS + extras ARS
  if (_isV2(m)) {
    let total = Number(m.salary?.ars?.amount || 0);
    (m.extras || []).forEach(e => {
      if ((e.currency || 'ARS') === 'ARS') total += Number(e.amount || 0);
    });
    return total;
  }
  return getMonthSalaryARS(m);
}

function getMonthTotalUSD(m){
  // USD portion: salary USD + commissions USD + extras USD
  if (_isV2(m)) {
    let total = Number(m.salary?.usd?.amount || 0);
    total += Number(m.salary?.commissions?.amount || 0);
    (m.extras || []).forEach(e => {
      if (e.currency === 'USD') total += Number(e.amount || 0);
    });
    return total;
  }
  return getMonthSalaryUSD(m);
}

function getMonthTotalCombined(m){
  return getMonthTotalARS(m) + (getMonthTotalUSD(m) * (USD_TO_ARS||1));
}

function getLatestIncomeARS(){
  if (!state.incomeMonths || !state.incomeMonths.length) return state.income.ars + state.income.varArs || 0;
  const sorted = [...state.incomeMonths].sort((a,b) => b.month.localeCompare(a.month));
  return getMonthTotalARS(sorted[0]);
}

// ── Account-level breakdown for "Mis Cuentas" ──────────────
function getMonthAccountTotals(m, accountId){
  // Returns { salary, commissions, extras, total } for one account in one month
  if (!_isV2(m)) return { salary: 0, commissions: 0, extras: 0, total: 0, currency: 'ARS' };
  let salary = 0, commissions = 0, extras = 0;
  let salaryUSD = 0, commissionsUSD = 0, extrasUSD = 0;
  if (m.salary?.ars?.accountId === accountId) salary += Number(m.salary.ars.amount || 0);
  if (m.salary?.usd?.accountId === accountId) salaryUSD += Number(m.salary.usd.amount || 0);
  if (m.salary?.commissions?.accountId === accountId) commissionsUSD += Number(m.salary.commissions.amount || 0);
  (m.extras || []).forEach(e => {
    if (e.accountId === accountId) {
      if (e.currency === 'USD') extrasUSD += Number(e.amount || 0);
      else extras += Number(e.amount || 0);
    }
  });
  return {
    salaryARS: salary, salaryUSD,
    commissionsUSD,
    extrasARS: extras, extrasUSD,
    totalARS: salary + extras,
    totalUSD: salaryUSD + commissionsUSD + extrasUSD
  };
}

// ── Bank accounts management ───────────────────────────────
function ensureBankAccounts(){
  if (!Array.isArray(state.bankAccounts)) state.bankAccounts = [];
  // First-run defaults: Santander Río (ARS) + Taqueos (USD)
  if (state.bankAccounts.length === 0 && (!state._bankAccountsInitialized)) {
    state.bankAccounts = [
      { id: 'acc_santander', name: 'Santander Río', currency: 'ARS', emoji: '🏦', createdAt: new Date().toISOString() },
      { id: 'acc_taqueos',   name: 'Taqueos',      currency: 'USD', emoji: '💵', createdAt: new Date().toISOString() }
    ];
    state._bankAccountsInitialized = true;
    saveState();
  }
}

function _accId(name){
  return 'acc_' + Math.random().toString(36).slice(2,9);
}

// ── Util ───────────────────────────────────────────────────
function fmtMonthLabel(k){
  if(!k) return '—';
  const [y,m] = k.split('-');
  return new Date(parseInt(y), parseInt(m)-1, 1).toLocaleDateString('es-AR', {month:'short',year:'2-digit'});
}

function _fmtMonthLong(k){
  if(!k) return '—';
  const [y,m] = k.split('-');
  return new Date(parseInt(y), parseInt(m)-1, 1).toLocaleDateString('es-AR', {month:'long',year:'numeric'});
}

function _findAccount(id){
  return (state.bankAccounts||[]).find(a => a.id === id) || null;
}

// ═══════════════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════════════
function renderIncomePage(){
  ensureBankAccounts();
  const root = document.getElementById('income-native-root');
  if (!root) return;

  const TC = USD_TO_ARS || state.usdRate || 1420;
  const months = [...(state.incomeMonths||[])].sort((a,b) => b.month.localeCompare(a.month));
  const curMonthKey = getMonthKey(new Date());
  const curMonthData = months.find(m => m.month === curMonthKey);
  const isPending = !curMonthData;

  // ── Active month for display: current if registered, otherwise latest ──
  const displayMonth = curMonthData || months[0] || null;
  const displayLabel = displayMonth ? _fmtMonthLong(displayMonth.month) : _fmtMonthLong(curMonthKey);

  // ── KPI calcs ──
  const dispARS = displayMonth ? getMonthTotalARS(displayMonth) : 0;
  const dispUSD = displayMonth ? getMonthTotalUSD(displayMonth) : 0;
  const dispCommUSD = displayMonth ? getMonthCommissionsUSD(displayMonth) : 0;
  const dispCombined = dispARS + dispUSD * TC;

  // ── Comparativa: current vs avg of last 3 prev months ──
  const dispIdx = displayMonth ? months.indexOf(displayMonth) : -1;
  const prev3 = dispIdx >= 0 ? months.slice(dispIdx + 1, dispIdx + 4) : [];
  const avg3Combined = prev3.length ? prev3.reduce((s,m) => s + getMonthTotalCombined(m), 0) / prev3.length : 0;
  const avg3Salary = prev3.length ? prev3.reduce((s,m) => s + getMonthSalaryARS(m) + getMonthSalaryUSD(m)*TC, 0) / prev3.length : 0;
  const dispSalaryARS = displayMonth ? getMonthSalaryARS(displayMonth) : 0;
  const dispSalaryUSD = displayMonth ? getMonthSalaryUSD(displayMonth) : 0;
  const dispSalaryCombined = dispSalaryARS + dispSalaryUSD * TC;
  const diffCombined = dispCombined - avg3Combined;
  const diffPctCombined = avg3Combined > 0 ? Math.round((diffCombined / avg3Combined) * 100) : 0;
  const diffSalary = dispSalaryCombined - avg3Salary;
  const diffPctSalary = avg3Salary > 0 ? Math.round((diffSalary / avg3Salary) * 100) : 0;

  // ── Margin config ──
  const spendPct = state.spendPct != null ? state.spendPct : 70;
  const savePct = 100 - spendPct;

  root.innerHTML = `
    <style>
      #income-native-root { padding: 0; font-family: var(--font); color: var(--text); }
      .inc2-hdr { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 22px; flex-wrap: wrap; gap: 14px; }
      .inc2-hdr-title { font-size: 36px; font-weight: 850; letter-spacing: -0.04em; color: #1a1a24; line-height: 1; margin-bottom: 6px; }
      .inc2-hdr-sub { font-size: 13px; color: #6e6b81; }
      .inc2-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .inc2-btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: 12px; border: none; cursor: pointer; font-size: 13px; font-weight: 700; font-family: var(--font); transition: all .15s; }
      .inc2-btn-primary { background: linear-gradient(135deg, #5d35f3, #7c3aed); color: #fff; box-shadow: 0 6px 16px rgba(93,53,243,0.25); }
      .inc2-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 10px 22px rgba(93,53,243,0.35); }
      .inc2-btn-secondary { background: rgba(93,53,243,0.08); color: #5d35f3; border: 1px solid rgba(93,53,243,0.15); }
      .inc2-btn-secondary:hover { background: rgba(93,53,243,0.14); }

      /* Pending banner */
      .inc2-pending { background: linear-gradient(135deg, rgba(255,149,0,0.08), rgba(255,149,0,0.04)); border: 1.5px solid rgba(255,149,0,0.3); border-radius: 16px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; }
      .inc2-pending-icon { width: 38px; height: 38px; border-radius: 50%; background: rgba(255,149,0,0.15); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
      .inc2-pending-text { flex: 1; }
      .inc2-pending-title { font-size: 13.5px; font-weight: 800; color: #c2410c; }
      .inc2-pending-sub { font-size: 12px; color: #92400e; margin-top: 2px; }
      .inc2-pending-btn { padding: 9px 16px; border-radius: 10px; border: none; cursor: pointer; background: #ff9500; color: #fff; font-size: 12.5px; font-weight: 700; }
      .inc2-pending-btn:hover { background: #f97316; }

      /* KPI Grid */
      .inc2-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 22px; }
      @media(max-width:980px) { .inc2-kpis { grid-template-columns: repeat(2, 1fr); } }
      .inc2-kpi { background: linear-gradient(145deg, #fff 0%, #fbfbff 100%); border-radius: 18px; padding: 20px; border: 1px solid var(--ikpi-border, rgba(0,0,0,0.05)); position: relative; overflow: hidden; box-shadow: 0 6px 18px rgba(43,37,68,0.04); }
      .inc2-kpi::before { content:""; position:absolute; right:-30px; bottom:-38px; width:120px; height:120px; border-radius:50%; background:var(--ikpi-soft); }
      .inc2-kpi::after { content:""; position:absolute; left:0; right:0; top:0; height:4px; background:linear-gradient(90deg, var(--ikpi-tone), var(--ikpi-tone-2)); }
      .inc2-kpi-h { display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 800; color: #8e8b9e; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; position: relative; z-index: 1; }
      .inc2-kpi-icon { width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 13px; background: var(--ikpi-soft); color: var(--ikpi-tone); }
      .inc2-kpi-v { font-size: 24px; font-weight: 850; letter-spacing: -0.03em; color: #1a1a24; line-height: 1.05; position: relative; z-index: 1; }
      .inc2-kpi-sub { margin-top: 6px; font-size: 11.5px; color: #6e6b81; font-weight: 600; position: relative; z-index: 1; }
      .inc2-kpi-c1 { --ikpi-tone:#5d35f3; --ikpi-tone-2:#ec4899; --ikpi-soft:rgba(93,53,243,0.13); --ikpi-border:rgba(93,53,243,0.16); }
      .inc2-kpi-c2 { --ikpi-tone:#10b981; --ikpi-tone-2:#84cc16; --ikpi-soft:rgba(16,185,129,0.13); --ikpi-border:rgba(16,185,129,0.16); }
      .inc2-kpi-c3 { --ikpi-tone:#0ea5e9; --ikpi-tone-2:#38bdf8; --ikpi-soft:rgba(14,165,233,0.13); --ikpi-border:rgba(14,165,233,0.16); }
      .inc2-kpi-c4 { --ikpi-tone:#f97316; --ikpi-tone-2:#facc15; --ikpi-soft:rgba(249,115,22,0.13); --ikpi-border:rgba(249,115,22,0.18); }
      .inc2-kpi-aux { font-size: 12px; color: #6e6b81; font-weight: 700; margin-top: 4px; position: relative; z-index: 1; }

      /* Block */
      .inc2-block { background: #fff; border-radius: 20px; padding: 22px 24px; border: 1px solid rgba(93,53,243,0.07); box-shadow: 0 6px 20px rgba(43,37,68,0.04); margin-bottom: 22px; }
      .inc2-block-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
      .inc2-block-title { font-size: 13px; font-weight: 800; color: #1a1a24; text-transform: uppercase; letter-spacing: 0.05em; }
      .inc2-block-sub { font-size: 11.5px; color: #8e8b9e; font-weight: 600; margin-top: 2px; }

      /* Comparativa */
      .inc2-comp-row { display: grid; grid-template-columns: 130px 1fr 110px; gap: 14px; align-items: center; margin-bottom: 14px; }
      .inc2-comp-label { font-size: 11px; font-weight: 800; color: #8e8b9e; text-transform: uppercase; letter-spacing: 0.04em; }
      .inc2-comp-track { height: 14px; background: #eef2ff; border-radius: 7px; position: relative; overflow: hidden; }
      .inc2-comp-fill { height: 100%; border-radius: 7px; transition: width .5s ease; }
      .inc2-comp-fill.total { background: linear-gradient(90deg, #5d35f3, #ec4899); }
      .inc2-comp-fill.salary { background: linear-gradient(90deg, #10b981, #38bdf8); }
      .inc2-comp-fill.avg { background: linear-gradient(90deg, #cbd5e1, #94a3b8); }
      .inc2-comp-val { font-size: 13px; font-weight: 800; color: #1a1a24; text-align: right; }
      .inc2-comp-tip { background: linear-gradient(135deg, #ecfdf5, #f5f3ff); border: 1px solid rgba(16,185,129,0.15); border-radius: 12px; padding: 11px 14px; display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: #475569; margin-top: 10px; }
      .inc2-comp-tip-icon { font-size: 16px; }

      /* Cuentas */
      .inc2-acc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
      .inc2-acc-card { border-radius: 18px; padding: 18px; position: relative; overflow: hidden; cursor: pointer; transition: all .2s; min-height: 180px; display: flex; flex-direction: column; }
      .inc2-acc-card:hover { transform: translateY(-2px); box-shadow: 0 14px 28px rgba(43,37,68,0.10); }
      .inc2-acc-card.ars { background: linear-gradient(145deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid rgba(14,165,233,0.18); }
      .inc2-acc-card.usd { background: linear-gradient(145deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid rgba(16,185,129,0.2); }
      .inc2-acc-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
      .inc2-acc-icon { font-size: 22px; }
      .inc2-acc-edit { background: rgba(0,0,0,0.04); border: none; width: 26px; height: 26px; border-radius: 8px; cursor: pointer; color: #6e6b81; font-size: 13px; display: flex; align-items: center; justify-content: center; }
      .inc2-acc-edit:hover { background: rgba(0,0,0,0.08); }
      .inc2-acc-name { font-size: 14px; font-weight: 800; color: #1a1a24; margin-bottom: 2px; }
      .inc2-acc-currency { font-size: 11px; color: #6e6b81; font-weight: 600; margin-bottom: 14px; }
      .inc2-acc-total { font-size: 22px; font-weight: 850; color: #1a1a24; letter-spacing: -0.025em; line-height: 1; margin-bottom: 4px; }
      .inc2-acc-sub { font-size: 11px; color: #6e6b81; font-weight: 600; margin-bottom: 12px; }
      .inc2-acc-breakdown { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; background: rgba(255,255,255,0.55); border-radius: 10px; margin-top: auto; margin-bottom: 8px; }
      .inc2-acc-bd-row { display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #475569; }
      .inc2-acc-bd-row span:first-child { opacity: .8; }
      .inc2-acc-bd-row span:last-child { font-weight: 800; color: #1a1a24; }
      .inc2-acc-delta { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 8px; display: inline-block; align-self: flex-start; }
      .inc2-acc-delta.up { background: rgba(16,185,129,0.13); color: #047857; }
      .inc2-acc-delta.down { background: rgba(239,68,68,0.12); color: #b91c1c; }
      .inc2-acc-delta.flat { background: rgba(100,116,139,0.12); color: #475569; }
      .inc2-acc-add-card { border: 2px dashed rgba(93,53,243,0.3); border-radius: 18px; padding: 18px; min-height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all .2s; background: rgba(93,53,243,0.03); }
      .inc2-acc-add-card:hover { background: rgba(93,53,243,0.07); border-color: rgba(93,53,243,0.5); }
      .inc2-acc-add-icon { font-size: 28px; color: #5d35f3; }
      .inc2-acc-add-text { font-size: 13px; font-weight: 700; color: #5d35f3; }

      /* Historial */
      .inc2-hist-table { width: 100%; border-collapse: collapse; }
      .inc2-hist-head { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr 100px; padding: 10px 12px; font-size: 10px; font-weight: 800; color: #8e8b9e; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e2e8f0; }
      .inc2-hist-row { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr 100px; padding: 14px 12px; border-bottom: 1px solid #f1f5f9; align-items: center; font-size: 13px; transition: background .15s; }
      .inc2-hist-row:hover { background: #fafbff; }
      .inc2-hist-row.current { background: linear-gradient(90deg, rgba(93,53,243,0.04), transparent); }
      .inc2-hist-month { font-weight: 700; color: #1a1a24; display: flex; align-items: center; gap: 8px; }
      .inc2-hist-tag { font-size: 9px; font-weight: 800; background: rgba(93,53,243,0.13); color: #5d35f3; padding: 2px 7px; border-radius: 5px; letter-spacing: 0.04em; }
      .inc2-hist-amount { font-weight: 700; color: #475569; }
      .inc2-hist-total { font-weight: 800; color: #1a1a24; }
      .inc2-hist-actions { display: flex; gap: 4px; justify-content: flex-end; }
      .inc2-hist-action { width: 28px; height: 28px; border-radius: 8px; border: none; cursor: pointer; background: rgba(0,0,0,0.04); color: #6e6b81; font-size: 13px; display: flex; align-items: center; justify-content: center; transition: all .15s; }
      .inc2-hist-action:hover { background: rgba(0,0,0,0.08); }
      .inc2-hist-action.danger:hover { background: rgba(239,68,68,0.1); color: #dc2626; }
      .inc2-hist-empty { padding: 30px 12px; text-align: center; color: #8e8b9e; font-size: 12.5px; font-weight: 600; }

      /* Margin Config */
      .inc2-margin-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
      .inc2-margin-item { flex: 1; min-width: 200px; }
      .inc2-margin-label { font-size: 11.5px; font-weight: 700; color: #6e6b81; margin-bottom: 6px; }
      .inc2-margin-input-wrap { display: flex; align-items: center; gap: 8px; padding: 9px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; }
      .inc2-margin-input-wrap input { flex: 1; background: transparent; border: none; outline: none; font-size: 17px; font-weight: 800; color: #1e293b; font-family: var(--font); }
      .inc2-margin-input-wrap span { font-size: 13px; color: #64748b; font-weight: 700; }

      /* Modal */
      .inc2-modal-bg { position: fixed; inset: 0; background: rgba(20, 17, 40, 0.55); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
      .inc2-modal { background: #fff; border-radius: 20px; padding: 24px; max-width: 480px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 60px rgba(20,17,40,0.3); }
      .inc2-modal-h { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
      .inc2-modal-title { font-size: 18px; font-weight: 850; color: #1a1a24; letter-spacing: -0.02em; }
      .inc2-modal-sub { font-size: 12px; color: #6e6b81; margin-top: 3px; }
      .inc2-modal-close { width: 30px; height: 30px; border-radius: 10px; border: none; cursor: pointer; background: #f1f5f9; color: #64748b; font-size: 14px; }
      .inc2-modal-close:hover { background: #e2e8f0; }
      .inc2-modal-section { margin-bottom: 16px; padding: 14px; background: #fafbff; border-radius: 12px; border: 1px solid rgba(93,53,243,0.06); }
      .inc2-modal-section-title { font-size: 11px; font-weight: 800; color: #5d35f3; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
      .inc2-field { margin-bottom: 10px; }
      .inc2-field-label { font-size: 11px; font-weight: 700; color: #6e6b81; margin-bottom: 5px; display: block; }
      .inc2-field-input, .inc2-field-select { width: 100%; padding: 10px 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13.5px; font-weight: 600; color: #1a1a24; font-family: var(--font); outline: none; transition: border-color .15s; }
      .inc2-field-input:focus, .inc2-field-select:focus { border-color: #5d35f3; }
      .inc2-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .inc2-modal-summary { background: linear-gradient(135deg, rgba(93,53,243,0.08), rgba(236,72,153,0.04)); border-radius: 12px; padding: 12px 14px; margin: 14px 0; }
      .inc2-modal-summary-label { font-size: 10.5px; font-weight: 800; color: #6e6b81; text-transform: uppercase; letter-spacing: 0.05em; }
      .inc2-modal-summary-value { font-size: 22px; font-weight: 850; color: #5d35f3; letter-spacing: -0.025em; margin-top: 3px; }
      .inc2-modal-summary-detail { font-size: 11.5px; color: #6e6b81; margin-top: 4px; font-weight: 600; }
      .inc2-modal-actions { display: flex; gap: 10px; margin-top: 18px; justify-content: flex-end; }
      .inc2-modal-btn { padding: 10px 20px; border-radius: 10px; border: none; cursor: pointer; font-size: 13px; font-weight: 700; font-family: var(--font); transition: all .15s; }
      .inc2-modal-btn.primary { background: linear-gradient(135deg, #5d35f3, #7c3aed); color: #fff; }
      .inc2-modal-btn.primary:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(93,53,243,0.3); }
      .inc2-modal-btn.ghost { background: #f1f5f9; color: #475569; }
      .inc2-modal-btn.ghost:hover { background: #e2e8f0; }
      .inc2-modal-btn.danger { background: rgba(239,68,68,0.1); color: #dc2626; }
      .inc2-modal-btn.danger:hover { background: rgba(239,68,68,0.18); }

      /* Light/Dark mode adaptations (Fluxen palette) */
      body:not(.light-mode) #income-native-root .inc2-hdr-title { color: var(--text); }
      body:not(.light-mode) #income-native-root .inc2-hdr-sub { color: var(--text3); }
      body:not(.light-mode) #income-native-root .inc2-block { background: var(--surface); border-color: var(--border); }
      body:not(.light-mode) #income-native-root .inc2-kpi { background: var(--surface); border-color: var(--border); }
      body:not(.light-mode) #income-native-root .inc2-kpi-v { color: var(--text); }
      body:not(.light-mode) #income-native-root .inc2-block-title { color: var(--text); }
      body:not(.light-mode) #income-native-root .inc2-comp-val { color: var(--text); }
      body:not(.light-mode) #income-native-root .inc2-comp-track { background: var(--surface3); }
      body:not(.light-mode) #income-native-root .inc2-acc-card.ars { background: linear-gradient(145deg, rgba(14,165,233,0.07), rgba(14,165,233,0.03)); border-color: rgba(14,165,233,0.25); }
      body:not(.light-mode) #income-native-root .inc2-acc-card.usd { background: linear-gradient(145deg, rgba(16,185,129,0.07), rgba(16,185,129,0.03)); border-color: rgba(16,185,129,0.25); }
      body:not(.light-mode) #income-native-root .inc2-acc-name, body:not(.light-mode) #income-native-root .inc2-acc-total { color: var(--text); }
      body:not(.light-mode) #income-native-root .inc2-acc-breakdown { background: rgba(255,255,255,0.04); }
      body:not(.light-mode) #income-native-root .inc2-acc-bd-row span:last-child { color: var(--text); }
      body:not(.light-mode) #income-native-root .inc2-acc-add-card { background: rgba(93,53,243,0.06); }
      body:not(.light-mode) #income-native-root .inc2-hist-row { border-color: var(--border); }
      body:not(.light-mode) #income-native-root .inc2-hist-row.current { background: linear-gradient(90deg, rgba(93,53,243,0.10), transparent); }
      body:not(.light-mode) #income-native-root .inc2-hist-month, body:not(.light-mode) #income-native-root .inc2-hist-total { color: var(--text); }
      body:not(.light-mode) #income-native-root .inc2-hist-amount { color: var(--text2); }
      body:not(.light-mode) #income-native-root .inc2-margin-input-wrap { background: var(--surface3); border-color: var(--border); }
      body:not(.light-mode) #income-native-root .inc2-margin-input-wrap input { color: var(--text); }
      body:not(.light-mode) #income-native-root .inc2-modal { background: var(--surface); }
      body:not(.light-mode) #income-native-root .inc2-modal-title { color: var(--text); }
      body:not(.light-mode) #income-native-root .inc2-modal-section { background: var(--surface2); border-color: var(--border); }
      body:not(.light-mode) #income-native-root .inc2-field-input, body:not(.light-mode) #income-native-root .inc2-field-select { background: var(--surface); border-color: var(--border); color: var(--text); }
      body:not(.light-mode) #income-native-root .inc2-modal-btn.ghost { background: var(--surface3); color: var(--text2); }
    </style>

    <div class="inc2-hdr">
      <div>
        <div class="inc2-hdr-title">Ingresos</div>
        <div class="inc2-hdr-sub">Tu sueldo, mes a mes · ${displayLabel}</div>
      </div>
      <div class="inc2-actions">
        <button class="inc2-btn inc2-btn-primary" onclick="openSueldoModal()"><span>＋</span> Registrar sueldo</button>
        <button class="inc2-btn inc2-btn-secondary" onclick="openExtraModal()"><span>＋</span> Registrar extra</button>
      </div>
    </div>

    ${isPending ? `
      <div class="inc2-pending">
        <div class="inc2-pending-icon">⚠️</div>
        <div class="inc2-pending-text">
          <div class="inc2-pending-title">${_fmtMonthLong(curMonthKey)} — pendiente de registrar</div>
          <div class="inc2-pending-sub">Todavía no cargaste el sueldo de este mes. ¿Lo agregamos?</div>
        </div>
        <button class="inc2-pending-btn" onclick="openSueldoModal('${curMonthKey}')">Registrar ahora</button>
      </div>
    ` : ''}

    <div class="inc2-kpis">
      <div class="inc2-kpi inc2-kpi-c1">
        <div class="inc2-kpi-h"><span class="inc2-kpi-icon">Σ</span> Total del mes</div>
        <div class="inc2-kpi-v">$${fmtN(Math.round(dispCombined))}</div>
        <div class="inc2-kpi-sub">ARS + USD convertido</div>
      </div>
      <div class="inc2-kpi inc2-kpi-c2">
        <div class="inc2-kpi-h"><span class="inc2-kpi-icon">$</span> Total en ARS</div>
        <div class="inc2-kpi-v">$${fmtN(Math.round(dispARS))}</div>
        <div class="inc2-kpi-sub">Sueldo + extras en pesos</div>
      </div>
      <div class="inc2-kpi inc2-kpi-c3">
        <div class="inc2-kpi-h"><span class="inc2-kpi-icon">US</span> Total en USD</div>
        <div class="inc2-kpi-v">USD ${fmtN(dispUSD)}</div>
        <div class="inc2-kpi-sub">Sueldo + comisiones + extras</div>
      </div>
      <div class="inc2-kpi inc2-kpi-c4">
        <div class="inc2-kpi-h"><span class="inc2-kpi-icon">%</span> Comisiones</div>
        <div class="inc2-kpi-v">USD ${fmtN(dispCommUSD)}</div>
        <div class="inc2-kpi-aux">≈ $${fmtN(Math.round(dispCommUSD * TC))}</div>
      </div>
    </div>

    ${prev3.length ? `
      <div class="inc2-block">
        <div class="inc2-block-h">
          <div>
            <div class="inc2-block-title">Comparativa inteligente</div>
            <div class="inc2-block-sub">${displayLabel} vs promedio últimos ${prev3.length} ${prev3.length===1?'mes':'meses'}</div>
          </div>
        </div>

        <div class="inc2-comp-row">
          <span class="inc2-comp-label">Total este mes</span>
          <div class="inc2-comp-track"><div class="inc2-comp-fill total" style="width:100%;"></div></div>
          <span class="inc2-comp-val">$${fmtN(Math.round(dispCombined))}</span>
        </div>
        <div class="inc2-comp-row">
          <span class="inc2-comp-label">Promedio total</span>
          <div class="inc2-comp-track"><div class="inc2-comp-fill avg" style="width:${dispCombined > 0 ? Math.min(100, Math.round(avg3Combined / dispCombined * 100)) : 0}%;"></div></div>
          <span class="inc2-comp-val" style="color:${diffCombined>=0?'#10b981':'#ef4444'};">${diffCombined>=0?'+':''}${diffPctCombined}%</span>
        </div>
        <div class="inc2-comp-row" style="border-top:1px solid #f1f5f9;padding-top:14px;margin-top:14px;">
          <span class="inc2-comp-label">Sueldo fijo este mes</span>
          <div class="inc2-comp-track"><div class="inc2-comp-fill salary" style="width:${dispSalaryCombined > 0 && dispCombined > 0 ? Math.round(dispSalaryCombined/dispCombined*100) : 0}%;"></div></div>
          <span class="inc2-comp-val">$${fmtN(Math.round(dispSalaryCombined))}</span>
        </div>
        <div class="inc2-comp-row">
          <span class="inc2-comp-label">Promedio sueldo fijo</span>
          <div class="inc2-comp-track"><div class="inc2-comp-fill avg" style="width:${dispSalaryCombined > 0 && dispCombined > 0 ? Math.min(100, Math.round(avg3Salary/dispCombined*100)) : 0}%;"></div></div>
          <span class="inc2-comp-val" style="color:${diffSalary>=0?'#10b981':'#ef4444'};">${diffSalary>=0?'+':''}${diffPctSalary}%</span>
        </div>

        <div class="inc2-comp-tip">
          <span class="inc2-comp-tip-icon">${diffCombined >= 0 ? '📈' : '📉'}</span>
          <span>${_buildCompTip(diffPctCombined, diffPctSalary, dispCommUSD)}</span>
        </div>
      </div>
    ` : ''}

    <div class="inc2-block">
      <div class="inc2-block-h">
        <div>
          <div class="inc2-block-title">Mis cuentas</div>
          <div class="inc2-block-sub">Dónde llega tu dinero · ${displayLabel}</div>
        </div>
      </div>
      <div class="inc2-acc-grid">
        ${(state.bankAccounts||[]).map(acc => _renderAccountCard(acc, displayMonth, prev3[0], TC)).join('')}
        <div class="inc2-acc-add-card" onclick="openAccountModal()">
          <div class="inc2-acc-add-icon">＋</div>
          <div class="inc2-acc-add-text">Agregar cuenta</div>
        </div>
      </div>
    </div>

    <div class="inc2-block">
      <div class="inc2-block-h">
        <div>
          <div class="inc2-block-title">Historial mensual</div>
          <div class="inc2-block-sub">Últimos meses registrados</div>
        </div>
      </div>
      ${months.length ? `
        <div class="inc2-hist-table">
          <div class="inc2-hist-head">
            <span>Mes</span>
            <span>ARS</span>
            <span>USD</span>
            <span>Total (ARS)</span>
            <span></span>
          </div>
          ${months.slice(0, 12).map(m => {
            const ars = getMonthTotalARS(m);
            const usd = getMonthTotalUSD(m);
            const tot = ars + usd*TC;
            const isCur = m.month === curMonthKey;
            const isV2 = _isV2(m);
            return `
              <div class="inc2-hist-row${isCur?' current':''}">
                <span class="inc2-hist-month">${fmtMonthLabel(m.month)}${isCur?'<span class="inc2-hist-tag">ACTUAL</span>':''}${!isV2?'<span class="inc2-hist-tag" style="background:rgba(100,116,139,0.13);color:#475569;">V1</span>':''}</span>
                <span class="inc2-hist-amount">$${fmtN(Math.round(ars))}</span>
                <span class="inc2-hist-amount">${usd>0?'USD '+fmtN(usd):'—'}</span>
                <span class="inc2-hist-total">$${fmtN(Math.round(tot))}</span>
                <span class="inc2-hist-actions">
                  ${isV2 ? `<button class="inc2-hist-action" onclick="openSueldoModal('${m.month}')" title="Editar">✎</button>` : ''}
                  <button class="inc2-hist-action danger" onclick="deleteIncomeMonth('${m.month}')" title="Eliminar">🗑</button>
                </span>
              </div>
            `;
          }).join('')}
        </div>
      ` : '<div class="inc2-hist-empty">Sin registros todavía. Agregá el primer mes con "Registrar sueldo".</div>'}
    </div>

    <div class="inc2-block">
      <div class="inc2-block-h">
        <div>
          <div class="inc2-block-title">Configuración del margen mensual</div>
          <div class="inc2-block-sub">Cuánto querés gastar y cuánto querés ahorrar de tu ingreso</div>
        </div>
      </div>
      <div class="inc2-margin-row">
        <div class="inc2-margin-item">
          <div class="inc2-margin-label">% objetivo de gasto</div>
          <div class="inc2-margin-input-wrap">
            <input type="number" id="inc2-spend-pct" value="${spendPct}" min="0" max="100" onchange="saveIncMargenConfig(this.value)">
            <span>%</span>
          </div>
        </div>
        <div class="inc2-margin-item">
          <div class="inc2-margin-label">% objetivo de ahorro</div>
          <div class="inc2-margin-input-wrap">
            <input type="number" value="${savePct}" min="0" max="100" disabled style="opacity:.7;">
            <span>%</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Render single account card ─────────────────────────────
function _renderAccountCard(acc, curMonth, prevMonth, TC){
  const cur = getMonthAccountTotals(curMonth, acc.id);
  const prev = getMonthAccountTotals(prevMonth, acc.id);
  const isUSD = acc.currency === 'USD';
  const curTotal = isUSD ? cur.totalUSD : cur.totalARS;
  const prevTotal = isUSD ? prev.totalUSD : prev.totalARS;
  const sign = isUSD ? 'USD ' : '$';
  const totalDisp = sign + fmtN(curTotal);
  const totalArs = isUSD ? curTotal * TC : curTotal;

  let deltaHtml = '';
  if (prevMonth) {
    if (prevTotal > 0 && curTotal > 0) {
      const pct = Math.round((curTotal - prevTotal) / prevTotal * 100);
      const cls = pct > 1 ? 'up' : pct < -1 ? 'down' : 'flat';
      const arrow = pct > 1 ? '↑' : pct < -1 ? '↓' : '·';
      deltaHtml = `<span class="inc2-acc-delta ${cls}">${arrow} ${pct>=0?'+':''}${pct}% vs ${fmtMonthLabel(prevMonth.month)}</span>`;
    } else if (curTotal > 0 && prevTotal === 0) {
      deltaHtml = `<span class="inc2-acc-delta up">↑ Nuevo</span>`;
    }
  }

  // Breakdown (salary / commissions / extras)
  const breakdown = [];
  if (isUSD) {
    if (cur.salaryUSD > 0) breakdown.push(`<div class="inc2-acc-bd-row"><span>Sueldo</span><span>USD ${fmtN(cur.salaryUSD)}</span></div>`);
    if (cur.commissionsUSD > 0) breakdown.push(`<div class="inc2-acc-bd-row"><span>Comisiones</span><span>USD ${fmtN(cur.commissionsUSD)}</span></div>`);
    if (cur.extrasUSD > 0) breakdown.push(`<div class="inc2-acc-bd-row"><span>Extras</span><span>USD ${fmtN(cur.extrasUSD)}</span></div>`);
  } else {
    if (cur.salaryARS > 0) breakdown.push(`<div class="inc2-acc-bd-row"><span>Sueldo</span><span>$${fmtN(cur.salaryARS)}</span></div>`);
    if (cur.extrasARS > 0) breakdown.push(`<div class="inc2-acc-bd-row"><span>Extras</span><span>$${fmtN(cur.extrasARS)}</span></div>`);
  }

  const arsEquiv = isUSD && curTotal > 0 ? `≈ $${fmtN(Math.round(totalArs))}` : '';

  return `
    <div class="inc2-acc-card ${isUSD?'usd':'ars'}" onclick="openAccountModal('${acc.id}')">
      <div class="inc2-acc-head">
        <div class="inc2-acc-icon">${esc(acc.emoji || (isUSD?'💵':'🏦'))}</div>
        <button class="inc2-acc-edit" onclick="event.stopPropagation();openAccountModal('${acc.id}')" title="Editar">✎</button>
      </div>
      <div class="inc2-acc-name">${esc(acc.name)}</div>
      <div class="inc2-acc-currency">${acc.currency}</div>
      <div class="inc2-acc-total">${totalDisp}</div>
      <div class="inc2-acc-sub">${arsEquiv || (curTotal > 0 ? 'este mes' : 'sin movimientos este mes')}</div>
      ${breakdown.length ? `<div class="inc2-acc-breakdown">${breakdown.join('')}</div>` : ''}
      ${deltaHtml}
    </div>
  `;
}

function _buildCompTip(diffPctTotal, diffPctSalary, commUSD){
  if (Math.abs(diffPctTotal) < 3) return 'Tu ingreso este mes es similar al promedio reciente. Estable.';
  if (diffPctTotal > 15 && commUSD > 0) return `Tu mes superó el promedio en ${diffPctTotal}%. Buena parte vino de comisiones (USD ${fmtN(commUSD)}).`;
  if (diffPctTotal > 5) return `Tu ingreso supera al promedio en ${diffPctTotal}%. Si es por extras, ojo no acostumbrarte a ese nivel.`;
  if (diffPctTotal < -10) return `Bajaste ${Math.abs(diffPctTotal)}% vs promedio. Revisá si hay algún ingreso pendiente de cargar.`;
  if (diffPctSalary >= 0 && diffPctTotal < 0) return 'El sueldo fijo se mantiene, pero faltaron extras o comisiones que tenías el mes pasado.';
  return `Diferencia del ${diffPctTotal>=0?'+':''}${diffPctTotal}% respecto al promedio reciente.`;
}

// ═══════════════════════════════════════════════════════════
// MODAL: Registrar / Editar Sueldo
// ═══════════════════════════════════════════════════════════
function openSueldoModal(monthKey){
  ensureBankAccounts();
  const accounts = state.bankAccounts || [];
  const arsAccounts = accounts.filter(a => a.currency === 'ARS');
  const usdAccounts = accounts.filter(a => a.currency === 'USD');

  // Determine target month
  const today = new Date();
  const targetKey = monthKey || getMonthKey(today);

  // Pre-fill: if month already exists → load it. Otherwise → use last month's values
  const months = [...(state.incomeMonths||[])].sort((a,b) => b.month.localeCompare(a.month));
  const existing = months.find(m => m.month === targetKey);
  const prefillSrc = existing || months.find(m => _isV2(m)) || null;

  const arsAmt = existing && _isV2(existing) ? (existing.salary?.ars?.amount || 0) : (prefillSrc && _isV2(prefillSrc) ? prefillSrc.salary?.ars?.amount || 0 : 0);
  const arsAcc = existing && _isV2(existing) ? (existing.salary?.ars?.accountId || arsAccounts[0]?.id || '') : (prefillSrc && _isV2(prefillSrc) ? prefillSrc.salary?.ars?.accountId || arsAccounts[0]?.id || '' : (arsAccounts[0]?.id || ''));
  const usdAmt = existing && _isV2(existing) ? (existing.salary?.usd?.amount || 0) : (prefillSrc && _isV2(prefillSrc) ? prefillSrc.salary?.usd?.amount || 0 : 0);
  const usdAcc = existing && _isV2(existing) ? (existing.salary?.usd?.accountId || usdAccounts[0]?.id || '') : (prefillSrc && _isV2(prefillSrc) ? prefillSrc.salary?.usd?.accountId || usdAccounts[0]?.id || '' : (usdAccounts[0]?.id || ''));
  const commAmt = existing && _isV2(existing) ? (existing.salary?.commissions?.amount || 0) : 0;
  const commAcc = existing && _isV2(existing) ? (existing.salary?.commissions?.accountId || usdAccounts[0]?.id || '') : (prefillSrc && _isV2(prefillSrc) ? prefillSrc.salary?.commissions?.accountId || usdAccounts[0]?.id || '' : (usdAccounts[0]?.id || ''));

  // Months dropdown: last 12 months + next 1
  const monthOpts = [];
  for (let i = -1; i <= 11; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthOpts.push({ value: getMonthKey(d), label: _fmtMonthLong(getMonthKey(d)) });
  }

  const arsAccOpts = arsAccounts.map(a => `<option value="${a.id}" ${a.id===arsAcc?'selected':''}>${esc(a.name)}</option>`).join('') || '<option value="">— sin cuentas ARS —</option>';
  const usdAccOpts = usdAccounts.map(a => `<option value="${a.id}" ${a.id===usdAcc?'selected':''}>${esc(a.name)}</option>`).join('') || '<option value="">— sin cuentas USD —</option>';
  const commAccOpts = usdAccounts.map(a => `<option value="${a.id}" ${a.id===commAcc?'selected':''}>${esc(a.name)}</option>`).join('') || '<option value="">— sin cuentas USD —</option>';

  const modal = document.createElement('div');
  modal.className = 'inc2-modal-bg';
  modal.id = 'inc2-modal-sueldo';
  modal.onclick = (e) => { if (e.target === modal) closeIncModal(); };
  modal.innerHTML = `
    <div class="inc2-modal" onclick="event.stopPropagation()">
      <div class="inc2-modal-h">
        <div>
          <div class="inc2-modal-title">${existing ? '✎ Editar sueldo' : '＋ Registrar sueldo'}</div>
          <div class="inc2-modal-sub">${existing ? 'Modificar valores del mes' : 'Cargar el sueldo del mes'}</div>
        </div>
        <button class="inc2-modal-close" onclick="closeIncModal()">✕</button>
      </div>

      <div class="inc2-field">
        <label class="inc2-field-label">Mes</label>
        <select class="inc2-field-select" id="inc2-su-month">
          ${monthOpts.map(o => `<option value="${o.value}" ${o.value===targetKey?'selected':''}>${o.label}</option>`).join('')}
        </select>
      </div>

      <div class="inc2-modal-section">
        <div class="inc2-modal-section-title">💰 Sueldo en pesos</div>
        <div class="inc2-field-row">
          <div class="inc2-field">
            <label class="inc2-field-label">Monto (ARS)</label>
            <input type="number" class="inc2-field-input" id="inc2-su-ars-amt" value="${arsAmt || ''}" placeholder="0" oninput="_updateSueldoSummary()">
          </div>
          <div class="inc2-field">
            <label class="inc2-field-label">Cuenta destino</label>
            <select class="inc2-field-select" id="inc2-su-ars-acc">${arsAccOpts}</select>
          </div>
        </div>
      </div>

      <div class="inc2-modal-section">
        <div class="inc2-modal-section-title">💵 Sueldo en dólares</div>
        <div class="inc2-field-row">
          <div class="inc2-field">
            <label class="inc2-field-label">Monto (USD)</label>
            <input type="number" class="inc2-field-input" id="inc2-su-usd-amt" value="${usdAmt || ''}" placeholder="0" oninput="_updateSueldoSummary()">
          </div>
          <div class="inc2-field">
            <label class="inc2-field-label">Cuenta destino</label>
            <select class="inc2-field-select" id="inc2-su-usd-acc">${usdAccOpts}</select>
          </div>
        </div>
      </div>

      <div class="inc2-modal-section">
        <div class="inc2-modal-section-title">📈 Comisiones del mes (USD)</div>
        <div class="inc2-field-row">
          <div class="inc2-field">
            <label class="inc2-field-label">Total comisiones (USD)</label>
            <input type="number" class="inc2-field-input" id="inc2-su-comm-amt" value="${commAmt || ''}" placeholder="0" oninput="_updateSueldoSummary()">
          </div>
          <div class="inc2-field">
            <label class="inc2-field-label">Cuenta destino</label>
            <select class="inc2-field-select" id="inc2-su-comm-acc">${commAccOpts}</select>
          </div>
        </div>
      </div>

      <div class="inc2-modal-summary">
        <div class="inc2-modal-summary-label">Total estimado del mes</div>
        <div class="inc2-modal-summary-value" id="inc2-su-summary">$0</div>
        <div class="inc2-modal-summary-detail" id="inc2-su-summary-detail">— · —</div>
      </div>

      <div class="inc2-modal-actions">
        <button class="inc2-modal-btn ghost" onclick="closeIncModal()">Cancelar</button>
        <button class="inc2-modal-btn primary" onclick="saveSueldo()">${existing ? 'Guardar cambios' : 'Registrar'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(_updateSueldoSummary, 50);
}

function _updateSueldoSummary(){
  const arsAmt = parseFloat(document.getElementById('inc2-su-ars-amt')?.value || 0);
  const usdAmt = parseFloat(document.getElementById('inc2-su-usd-amt')?.value || 0);
  const commAmt = parseFloat(document.getElementById('inc2-su-comm-amt')?.value || 0);
  const TC = USD_TO_ARS || 1420;
  const total = arsAmt + (usdAmt + commAmt) * TC;
  const summaryEl = document.getElementById('inc2-su-summary');
  const detailEl = document.getElementById('inc2-su-summary-detail');
  if (summaryEl) summaryEl.textContent = '$' + fmtN(Math.round(total));
  if (detailEl) {
    const parts = [];
    if (arsAmt > 0) parts.push(`$${fmtN(arsAmt)} ARS`);
    if (usdAmt > 0) parts.push(`USD ${fmtN(usdAmt)} sueldo`);
    if (commAmt > 0) parts.push(`USD ${fmtN(commAmt)} comisiones`);
    detailEl.textContent = parts.length ? parts.join(' · ') : 'Cargá los montos arriba';
  }
}

function saveSueldo(){
  const month = document.getElementById('inc2-su-month').value;
  const arsAmt = parseFloat(document.getElementById('inc2-su-ars-amt').value || 0);
  const arsAcc = document.getElementById('inc2-su-ars-acc').value;
  const usdAmt = parseFloat(document.getElementById('inc2-su-usd-amt').value || 0);
  const usdAcc = document.getElementById('inc2-su-usd-acc').value;
  const commAmt = parseFloat(document.getElementById('inc2-su-comm-amt').value || 0);
  const commAcc = document.getElementById('inc2-su-comm-acc').value;

  if (arsAmt === 0 && usdAmt === 0 && commAmt === 0) {
    alert('Cargá al menos un monto para registrar el sueldo.');
    return;
  }

  if (!Array.isArray(state.incomeMonths)) state.incomeMonths = [];
  let entry = state.incomeMonths.find(m => m.month === month);

  // Preserve existing extras if entry already exists
  const existingExtras = entry && _isV2(entry) ? (entry.extras || []) : [];

  const newEntry = {
    id: entry?.id || ('inc_' + Math.random().toString(36).slice(2,9)),
    month,
    schemaVersion: 2,
    salary: {
      ars: { amount: arsAmt || 0, accountId: arsAcc || null },
      usd: { amount: usdAmt || 0, accountId: usdAcc || null },
      commissions: { amount: commAmt || 0, accountId: commAcc || null }
    },
    extras: existingExtras
  };

  if (entry) {
    Object.assign(entry, newEntry);
  } else {
    state.incomeMonths.push(newEntry);
  }
  saveState();
  closeIncModal();
  renderIncomePage();
  if (typeof refreshAll === 'function') refreshAll(); else if (typeof renderDashboard === 'function') renderDashboard();
  showToast('✓ Sueldo guardado', 'success');
}

// ═══════════════════════════════════════════════════════════
// MODAL: Registrar Extra
// ═══════════════════════════════════════════════════════════
function openExtraModal(monthKey, extraId){
  ensureBankAccounts();
  const accounts = state.bankAccounts || [];
  const today = new Date();
  const targetKey = monthKey || getMonthKey(today);
  const dateStr = today.toISOString().slice(0, 10);

  // If editing, find the extra
  let extra = null;
  if (extraId) {
    const m = (state.incomeMonths||[]).find(m => m.month === targetKey);
    extra = m?.extras?.find(e => e.id === extraId);
  }

  const types = [
    { val: 'aguinaldo', label: 'Aguinaldo' },
    { val: 'freelance', label: 'Freelance' },
    { val: 'regalo', label: 'Regalo' },
    { val: 'otro', label: 'Otro' }
  ];

  // Months dropdown
  const monthOpts = [];
  for (let i = -1; i <= 11; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthOpts.push({ value: getMonthKey(d), label: _fmtMonthLong(getMonthKey(d)) });
  }

  const accOpts = accounts.map(a => `<option value="${a.id}" data-currency="${a.currency}" ${a.id===extra?.accountId?'selected':''}>${esc(a.name)} (${a.currency})</option>`).join('');

  const modal = document.createElement('div');
  modal.className = 'inc2-modal-bg';
  modal.id = 'inc2-modal-extra';
  modal.onclick = (e) => { if (e.target === modal) closeIncModal(); };
  modal.innerHTML = `
    <div class="inc2-modal" onclick="event.stopPropagation()">
      <div class="inc2-modal-h">
        <div>
          <div class="inc2-modal-title">${extra ? '✎ Editar extra' : '＋ Registrar extra'}</div>
          <div class="inc2-modal-sub">${extra ? 'Modificar ingreso extra' : 'Agregar un ingreso fuera del sueldo'}</div>
        </div>
        <button class="inc2-modal-close" onclick="closeIncModal()">✕</button>
      </div>

      <div class="inc2-field">
        <label class="inc2-field-label">Mes</label>
        <select class="inc2-field-select" id="inc2-ex-month">
          ${monthOpts.map(o => `<option value="${o.value}" ${o.value===targetKey?'selected':''}>${o.label}</option>`).join('')}
        </select>
      </div>

      <div class="inc2-field-row">
        <div class="inc2-field">
          <label class="inc2-field-label">Tipo</label>
          <select class="inc2-field-select" id="inc2-ex-type">
            ${types.map(t => `<option value="${t.val}" ${t.val===extra?.type?'selected':''}>${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="inc2-field">
          <label class="inc2-field-label">Fecha</label>
          <input type="date" class="inc2-field-input" id="inc2-ex-date" value="${extra?.date || dateStr}">
        </div>
      </div>

      <div class="inc2-field">
        <label class="inc2-field-label">Descripción</label>
        <input type="text" class="inc2-field-input" id="inc2-ex-label" value="${esc(extra?.label || '')}" placeholder="ej. Aguinaldo segundo semestre">
      </div>

      <div class="inc2-field-row">
        <div class="inc2-field">
          <label class="inc2-field-label">Monto</label>
          <input type="number" class="inc2-field-input" id="inc2-ex-amount" value="${extra?.amount || ''}" placeholder="0">
        </div>
        <div class="inc2-field">
          <label class="inc2-field-label">Moneda</label>
          <select class="inc2-field-select" id="inc2-ex-currency">
            <option value="ARS" ${extra?.currency==='ARS'?'selected':''}>ARS</option>
            <option value="USD" ${extra?.currency==='USD'?'selected':''}>USD</option>
          </select>
        </div>
      </div>

      <div class="inc2-field">
        <label class="inc2-field-label">Cuenta destino</label>
        <select class="inc2-field-select" id="inc2-ex-account">${accOpts}</select>
      </div>

      <div class="inc2-modal-actions">
        ${extra ? `<button class="inc2-modal-btn danger" onclick="deleteExtra('${targetKey}','${extraId}')">Eliminar</button>` : ''}
        <button class="inc2-modal-btn ghost" onclick="closeIncModal()">Cancelar</button>
        <button class="inc2-modal-btn primary" onclick="saveExtra('${extraId||''}')">${extra ? 'Guardar' : 'Registrar'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function saveExtra(extraId){
  const month = document.getElementById('inc2-ex-month').value;
  const type = document.getElementById('inc2-ex-type').value;
  const date = document.getElementById('inc2-ex-date').value;
  const label = document.getElementById('inc2-ex-label').value.trim();
  const amount = parseFloat(document.getElementById('inc2-ex-amount').value || 0);
  const currency = document.getElementById('inc2-ex-currency').value;
  const accountId = document.getElementById('inc2-ex-account').value;

  if (amount <= 0) { alert('Cargá un monto mayor a cero.'); return; }
  if (!label) { alert('Cargá una descripción.'); return; }

  if (!Array.isArray(state.incomeMonths)) state.incomeMonths = [];
  let entry = state.incomeMonths.find(m => m.month === month);
  if (!entry) {
    entry = {
      id: 'inc_' + Math.random().toString(36).slice(2,9),
      month,
      schemaVersion: 2,
      salary: { ars: {amount:0,accountId:null}, usd: {amount:0,accountId:null}, commissions: {amount:0,accountId:null} },
      extras: []
    };
    state.incomeMonths.push(entry);
  } else if (!_isV2(entry)) {
    // Upgrade legacy entry to v2 in place by adding the new fields (preserving legacy data)
    entry.schemaVersion = 2;
    entry.salary = { ars: {amount:0,accountId:null}, usd: {amount:0,accountId:null}, commissions: {amount:0,accountId:null} };
    entry.extras = entry.extras || [];
  }

  if (extraId) {
    const ex = entry.extras.find(e => e.id === extraId);
    if (ex) Object.assign(ex, { type, date, label, amount, currency, accountId });
  } else {
    entry.extras.push({
      id: 'ext_' + Math.random().toString(36).slice(2,9),
      type, date, label, amount, currency, accountId
    });
  }
  saveState();
  closeIncModal();
  renderIncomePage();
  if (typeof refreshAll === 'function') refreshAll(); else if (typeof renderDashboard === 'function') renderDashboard();
  showToast(extraId ? '✓ Extra actualizado' : '✓ Extra registrado', 'success');
}

function deleteExtra(monthKey, extraId){
  if (!confirm('¿Eliminar este extra?')) return;
  const m = (state.incomeMonths||[]).find(m => m.month === monthKey);
  if (m && m.extras) m.extras = m.extras.filter(e => e.id !== extraId);
  saveState();
  closeIncModal();
  renderIncomePage();
  if (typeof refreshAll === 'function') refreshAll(); else if (typeof renderDashboard === 'function') renderDashboard();
  showToast('Extra eliminado', 'success');
}

// ═══════════════════════════════════════════════════════════
// MODAL: Cuentas (agregar / editar / eliminar)
// ═══════════════════════════════════════════════════════════
function openAccountModal(accountId){
  const acc = (state.bankAccounts||[]).find(a => a.id === accountId);
  const isEdit = !!acc;

  const modal = document.createElement('div');
  modal.className = 'inc2-modal-bg';
  modal.id = 'inc2-modal-account';
  modal.onclick = (e) => { if (e.target === modal) closeIncModal(); };
  modal.innerHTML = `
    <div class="inc2-modal" onclick="event.stopPropagation()" style="max-width:420px;">
      <div class="inc2-modal-h">
        <div>
          <div class="inc2-modal-title">${isEdit ? '✎ Editar cuenta' : '＋ Nueva cuenta'}</div>
          <div class="inc2-modal-sub">${isEdit ? 'Modificá nombre, moneda o emoji' : 'Agregá una cuenta donde recibís ingresos'}</div>
        </div>
        <button class="inc2-modal-close" onclick="closeIncModal()">✕</button>
      </div>

      <div class="inc2-field">
        <label class="inc2-field-label">Nombre</label>
        <input type="text" class="inc2-field-input" id="inc2-acc-name" value="${esc(acc?.name || '')}" placeholder="ej. Galicia, Mercado Pago, Wise">
      </div>

      <div class="inc2-field-row">
        <div class="inc2-field">
          <label class="inc2-field-label">Moneda</label>
          <select class="inc2-field-select" id="inc2-acc-currency">
            <option value="ARS" ${acc?.currency==='ARS'?'selected':''}>ARS (Pesos)</option>
            <option value="USD" ${acc?.currency==='USD'?'selected':''}>USD (Dólares)</option>
          </select>
        </div>
        <div class="inc2-field">
          <label class="inc2-field-label">Emoji</label>
          <input type="text" class="inc2-field-input" id="inc2-acc-emoji" value="${esc(acc?.emoji || '🏦')}" maxlength="4">
        </div>
      </div>

      <div class="inc2-modal-actions">
        ${isEdit ? `<button class="inc2-modal-btn danger" onclick="deleteAccount('${accountId}')">Eliminar</button>` : ''}
        <button class="inc2-modal-btn ghost" onclick="closeIncModal()">Cancelar</button>
        <button class="inc2-modal-btn primary" onclick="saveAccount('${accountId||''}')">${isEdit ? 'Guardar' : 'Agregar'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function saveAccount(accountId){
  const name = document.getElementById('inc2-acc-name').value.trim();
  const currency = document.getElementById('inc2-acc-currency').value;
  const emoji = document.getElementById('inc2-acc-emoji').value.trim() || (currency==='USD'?'💵':'🏦');
  if (!name) { alert('Cargá un nombre para la cuenta.'); return; }

  ensureBankAccounts();
  if (accountId) {
    const acc = state.bankAccounts.find(a => a.id === accountId);
    if (acc) {
      acc.name = name;
      acc.currency = currency;
      acc.emoji = emoji;
    }
  } else {
    state.bankAccounts.push({
      id: _accId(name),
      name, currency, emoji,
      createdAt: new Date().toISOString()
    });
  }
  saveState();
  closeIncModal();
  renderIncomePage();
  showToast(accountId ? '✓ Cuenta actualizada' : '✓ Cuenta agregada', 'success');
}

function deleteAccount(accountId){
  // Check if any income references this account
  let inUse = false;
  (state.incomeMonths||[]).forEach(m => {
    if (!_isV2(m)) return;
    if (m.salary?.ars?.accountId === accountId) inUse = true;
    if (m.salary?.usd?.accountId === accountId) inUse = true;
    if (m.salary?.commissions?.accountId === accountId) inUse = true;
    (m.extras||[]).forEach(e => { if (e.accountId === accountId) inUse = true; });
  });
  const msg = inUse
    ? 'Esta cuenta está usada en algunos ingresos. Si la eliminás, esos ingresos quedarán sin cuenta asociada (pero se conservarán). ¿Continuar?'
    : '¿Eliminar esta cuenta?';
  if (!confirm(msg)) return;
  state.bankAccounts = (state.bankAccounts||[]).filter(a => a.id !== accountId);
  saveState();
  closeIncModal();
  renderIncomePage();
  showToast('Cuenta eliminada', 'success');
}

// ═══════════════════════════════════════════════════════════
// HELPERS: cerrar modales, eliminar mes, guardar margen
// ═══════════════════════════════════════════════════════════
function closeIncModal(){
  ['inc2-modal-sueldo','inc2-modal-extra','inc2-modal-account'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
}

function deleteIncomeMonth(monthKey){
  if (!confirm('¿Eliminar el mes ' + fmtMonthLabel(monthKey) + ' completo? (incluye sueldo y extras)')) return;
  state.incomeMonths = (state.incomeMonths||[]).filter(m => m.month !== monthKey);
  saveState();
  renderIncomePage();
  if (typeof refreshAll === 'function') refreshAll(); else if (typeof renderDashboard === 'function') renderDashboard();
  showToast('Mes eliminado', 'success');
}

function saveIncMargenConfig(val){
  const pct = Math.max(0, Math.min(100, parseInt(val || 70)));
  state.spendPct = pct;
  saveState();
  if (typeof refreshAll === 'function') refreshAll(); else if (typeof renderDashboard === 'function') renderDashboard();
}

// ═══════════════════════════════════════════════════════════
// LEGACY API SHIMS (kept for backward compatibility)
// Some other files may still call these — preserve no-ops or basic behavior
// ═══════════════════════════════════════════════════════════
function openIncomeSourceModal(){ openSueldoModal(); }
function openLogIncomeModal(){ openSueldoModal(); }
function editIncMonth(monthKey){ openSueldoModal(monthKey); }
function deleteIncMonth(monthKey){ deleteIncomeMonth(monthKey); }
function syncCurrentMonthIncome(){ /* legacy no-op */ }
function saveIncSource(){ /* legacy no-op */ }
function deleteIncSource(){ /* legacy no-op */ }
function buildLogIncSourceFields(){ return ''; }
function updateIncModalPreview(){ /* legacy no-op */ }
function saveIncMonth(){ saveSueldo(); }
function saveIncConfig(){ /* legacy no-op */ }
function saveIncome(){ /* legacy no-op */ }
function toggleIncomeInsights(){ /* legacy no-op — insights panel removed in v2 */ }
function getApiKey(){ return state.apiKey || localStorage.getItem('fin_apikey') || ''; }
function saveApiKey(){
  const inp = document.getElementById('input-apikey');
  if (!inp) return;
  const k = inp.value.trim();
  if (!k) return;
  state.apiKey = k;
  localStorage.setItem('fin_apikey', k);
  if (typeof closeModal === 'function') closeModal('modal-apikey');
  if (typeof showToast === 'function') showToast('✓ API Key guardada', 'success');
}
