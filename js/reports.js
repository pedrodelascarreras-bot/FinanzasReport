// ══ REPORTES ══
const MNAMES_R=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── Email Report ──────────────────────────────────────────────────────────────
// URL del servidor de reportes:
// prioridad: state -> localStorage -> Render -> localhost
const REPORT_SERVER_URL = String(
  state.reportServerUrl
  || localStorage.getItem('fin_report_server_url')
  || 'https://finanzas-report-server.onrender.com'
  || 'http://localhost:3001'
).replace(/\/+$/,'');

if(!state.reportServerUrl) state.reportServerUrl = REPORT_SERVER_URL;
if(!localStorage.getItem('fin_report_server_url')) {
  localStorage.setItem('fin_report_server_url', REPORT_SERVER_URL);
}

function openSendReportModal() {
  openModal('modal-send-report');
  // Reset status
  const status = document.getElementById('sre-status');
  if(status) { status.style.display='none'; status.textContent=''; }
  const preferredPeriod = state.repMode === 'tc' ? 'tc' : (state.repMode === 'mes' ? 'month' : 'week');
  const activeRadio = document.querySelector(`input[name="sre-period"][value="${preferredPeriod}"]`);
  if(activeRadio){
    activeRadio.checked = true;
    document.querySelectorAll('.sre-option-card').forEach(card => {
      const input = card.querySelector('input[type="radio"]');
      card.classList.toggle('active', !!input?.checked);
    });
  }
  // Wire up period option cards
  document.querySelectorAll('input[name="sre-period"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.getElementById('sre-period-week')?.classList.toggle('active', radio.value==='week' && radio.checked);
      document.getElementById('sre-period-month')?.classList.toggle('active', radio.value==='month' && radio.checked);
      document.getElementById('sre-period-tc')?.classList.toggle('active', radio.value==='tc' && radio.checked);
    });
  });
  document.querySelectorAll('.sre-option-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.sre-option-card').forEach(c=>c.classList.remove('active'));
      card.classList.add('active');
      card.querySelector('input[type="radio"]').checked = true;
    });
  });
  // Check server availability
  _checkReportServerStatus();
}

async function _checkReportServerStatus() {
  const indEl = document.getElementById('sre-server-indicator');
  const sendBtn = document.getElementById('sre-send-btn');
  if(!indEl) return;
  indEl.innerHTML = '<span style="opacity:.5">⏳ Verificando servidor…</span>';
  const isHosted = !/localhost|127\.0\.0\.1/.test(REPORT_SERVER_URL);
  try {
    let res = null;
    let lastErr = null;
    for(let attempt=0;attempt<2;attempt++){
      try{
        res = await fetch(`${REPORT_SERVER_URL}/health`, { signal: AbortSignal.timeout(isHosted?12000:4000) });
        if(res.ok) break;
        lastErr = new Error('not ok');
      }catch(err){
        lastErr = err;
        if(isHosted && attempt===0){
          indEl.innerHTML = '<span style="opacity:.7">⏳ Despertando servidor de Render… puede tardar unos segundos</span>';
          await new Promise(resolve=>setTimeout(resolve, 3500));
        }
      }
    }
    if(res && res.ok) {
      state._reportServerAvailable = true;
      indEl.innerHTML = '<span style="color:var(--green-sys);">🟢 Servidor activo — listo para enviar</span>';
      if(sendBtn){ sendBtn.disabled = false; sendBtn.innerHTML=`<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M1 8L15 1M15 1L8 15M15 1L1 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Enviar ahora`; }
      return;
    }
    throw lastErr || new Error('not ok');
  } catch(e) {
    state._reportServerAvailable = false;
    indEl.innerHTML = isHosted
      ? '<span style="color:var(--accent3);">🟠 No se pudo conectar con tu servidor de reportes</span> <span style="color:var(--text3);font-size:10px;">Si el servicio está dormido, esperá unos segundos y volvé a probar. Mientras tanto podés abrir el PDF local.</span>'
      : '<span style="color:var(--accent3);">🟠 Servidor local no disponible</span> <span style="color:var(--text3);font-size:10px;">Podés abrir el PDF local ahora. Para envío por email automático, corré <code style="background:var(--surface3);padding:1px 5px;border-radius:4px;">node report/server.js</code> en Terminal</span>';
    if(sendBtn){ sendBtn.disabled = false; sendBtn.innerHTML=`<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 2h12v12H2z" stroke="currentColor" stroke-width="1.6"/><path d="M5 6h6M5 9h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg> Abrir PDF`; }
  }
}

async function sendReportNow() {
  const btn = document.getElementById('sre-send-btn');
  const statusEl = document.getElementById('sre-status');

  if(state._reportServerAvailable === false) {
    await _checkReportServerStatus();
  }

  if(state._reportServerAvailable === false) {
    if(statusEl) {
      statusEl.style.display='block';
      statusEl.style.background='var(--blue-light)';
      statusEl.style.color='var(--accent)';
      statusEl.textContent='No pude conectar con el servidor de reportes. Te abro el reporte para guardarlo como PDF manualmente.';
    }
    exportRepPDF();
    showToast('PDF abierto localmente', 'info');
    return;
  }

  const period = document.querySelector('input[name="sre-period"]:checked')?.value || 'week';
  const options = {
    period,
    include: {
      summary:  document.getElementById('sre-inc-summary')?.checked ?? true,
      cats:     document.getElementById('sre-inc-cats')?.checked ?? true,
      ai:       document.getElementById('sre-inc-ai')?.checked ?? true,
      txns:     document.getElementById('sre-inc-txns')?.checked ?? false,
      alerts:   document.getElementById('sre-inc-alerts')?.checked ?? false,
    }
  };

  try {
    const previewBlob = await renderPreviewPdfBlob();
    options.previewAttachment = {
      filename: `reporte-vista-previa-${String(getRepPeriodLabel() || 'periodo').replace(/[^\w\-]+/g, '_')}.pdf`,
      contentBase64: await blobToBase64(previewBlob),
    };
  } catch(err) {
    console.warn('No se pudo adjuntar la vista previa real del frontend', err);
  }

  // UI: loading state
  if(btn) { btn.disabled=true; btn.innerHTML='<span style="opacity:.7">Enviando…</span>'; }
  if(statusEl) { statusEl.style.display='block'; statusEl.style.background='var(--blue-light)'; statusEl.style.color='var(--accent)'; statusEl.textContent='⏳ Generando PDF y enviando email…'; }

  try {
    const res = await fetch(`${REPORT_SERVER_URL}/send-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
      signal: AbortSignal.timeout(90000) // 90s timeout (PDF generation can take a while)
    });

    if(res.ok) {
      const data = await res.json();
      if(statusEl) { statusEl.style.background='rgba(48,209,88,0.15)'; statusEl.style.color='var(--green-sys)'; statusEl.textContent='✓ Reporte enviado a ' + (data.to || 'tu casilla'); }
      showToast('✓ Reporte enviado por email', 'success');
      setTimeout(() => closeModal('modal-send-report'), 2500);
    } else {
      const err = await res.json().catch(()=>({error:'Error del servidor'}));
      throw new Error(err.error || `Error ${res.status}`);
    }
  } catch(err) {
    let msg;
    if(err.name === 'AbortError' || err.message?.includes('fetch')) {
      msg = /localhost|127\.0\.0\.1/.test(REPORT_SERVER_URL)
        ? '⚠️ No se pudo conectar con el servidor local. ¿Está corriendo report/server.js?\n\nCorré en Terminal: node report/server.js'
        : '⚠️ No se pudo conectar con tu servidor de reportes en Render. Esperá unos segundos y volvé a probar.';
    } else {
      msg = '✕ ' + (err.message || 'Error desconocido');
    }
    if(statusEl) {
      statusEl.style.background='var(--red-light)';
      statusEl.style.color='var(--danger)';
      statusEl.style.whiteSpace='pre-wrap';
      statusEl.textContent = msg;
    }
    showToast('Error enviando el reporte', 'error');
  } finally {
    if(btn) {
      btn.disabled=false;
      btn.innerHTML=`<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M1 8L15 1M15 1L8 15M15 1L1 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Enviar ahora`;
    }
  }
}

function renderReportesPage(){
  setRepMode(state.repMode||'mes');
}

function setRepMode(mode){
  state.repMode=mode;
  // HTML button id "rep-mode-all" maps to mode value "todo"
  ['mes','tc','rango','all'].forEach(m=>{
    const modeKey = m==='all' ? 'todo' : m;
    document.getElementById('rep-mode-'+m)?.classList.toggle('active', modeKey===mode);
  });
  const sel=document.getElementById('rep-period-select');
  const rangeWrap=document.getElementById('rep-range-wrap');

  // Show/hide appropriate controls
  if(sel)sel.style.display=(mode==='rango'||mode==='todo')?'none':'block';
  if(rangeWrap)rangeWrap.style.display=mode==='rango'?'flex':'none';

  if(!sel)return;

  if(mode==='todo'){
    sel.innerHTML='<option value="all">Todos los datos</option>';
    sel.disabled=true;
  } else if(mode==='mes'){
    sel.disabled=false;
    const months=[...new Set(state.transactions.map(t=>t.month||getMonthKey(t.date)))].sort().reverse();
    sel.innerHTML=months.map(m=>{const[y,mo]=m.split('-');return'<option value="'+m+'">'+MNAMES_R[+mo-1]+' '+y+'</option>';}).join('');
  } else if(mode==='tc'){
    sel.disabled=false;
    const cycles=getTcCycles();
    if(cycles.length){
      sel.innerHTML=cycles.map(c=>'<option value="tc:'+c.id+'">'+esc(c.label||c.closeDate)+'</option>').join('');
    } else {
      sel.innerHTML='<option value="">Sin ciclos configurados</option>';
    }
  } else if(mode==='rango'){
    // Set defaults: last 30 days
    const from=document.getElementById('rep-range-from');
    const to=document.getElementById('rep-range-to');
    if(from&&!from.value){const d=new Date();d.setDate(d.getDate()-30);from.value=dateToYMD(d);}
    if(to&&!to.value) to.value=dateToYMD(new Date());
  }
  updateRepPreview();
}

function setRepDesign(design){
  state.repDesign=design||'executive';
  document.getElementById('rep-design-exec')?.classList.toggle('active',design==='executive');
  document.getElementById('rep-design-detail')?.classList.toggle('active',design==='detailed');
  document.getElementById('rep-design-minimal')?.classList.toggle('active',design==='minimal');
  updateRepPreview();
}

function toggleAllReportSections(checked){
  document.querySelectorAll('#rep-sections input[type="checkbox"]').forEach(input=>{ input.checked = !!checked; });
  updateRepPreview();
}

function toggleReportSectionGroup(group, checked){
  document.querySelectorAll(`#rep-sections [data-section-group="${group}"] input[type="checkbox"]`).forEach(input=>{
    input.checked = !!checked;
  });
  updateRepPreview();
}

function getRepTxns(){
  const mode=state.repMode||'mes';
  const sel=document.getElementById('rep-period-select')?.value||'';
  if(mode==='todo'||sel==='all')return state.transactions;
  if(mode==='mes')return state.transactions.filter(t=>(t.month||getMonthKey(t.date))===sel);
  if(mode==='tc'){
    const cycleId=sel.replace('tc:','');
    const cycles=getTcCycles();
    const cycle=cycles.find(c=>c.id===cycleId);
    return cycle?getTcCycleTxns(cycle,cycles):[];
  }
  if(mode==='rango'){
    const from=document.getElementById('rep-range-from')?.value||'';
    const to=document.getElementById('rep-range-to')?.value||'';
    if(!from||!to)return[];
    return state.transactions.filter(t=>{const d=dateToYMD(t.date);return d>=from&&d<=to;});
  }
  return state.transactions;
}

function getRepSections(){
  return [...document.querySelectorAll('[data-section]')]
    .filter(el=>el.checked).map(el=>el.dataset.section);
}

function getRepPeriodLabel(){
  const mode=state.repMode||'mes';
  if(mode==='todo')return 'Todos los datos';
  if(mode==='rango'){
    const from=document.getElementById('rep-range-from')?.value||'';
    const to=document.getElementById('rep-range-to')?.value||'';
    if(!from||!to)return '—';
    return new Date(from+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'})+' → '+new Date(to+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
  }
  const sel=document.getElementById('rep-period-select');
  if(!sel||!sel.value)return '—';
  return sel.options[sel.selectedIndex]?.text||sel.value;
}

function getReportStyleSheet(s){
  const cfg=s||{accent:'#1d1d1f',fontSz:'12px',pad:'32px',brand:'20px',headerBorder:'3px solid #1d1d1f',kpiBg:'#f7f7f7',sectionTitle:'11px'};
  return '*{box-sizing:border-box;margin:0;padding:0;}'
    +'body{background:#fff;font-family:-apple-system,"SF Pro Display","Helvetica Neue",sans-serif;}'
    +'.rpt{color:'+cfg.accent+';padding:'+cfg.pad+';width:100%;max-width:none;font-size:'+cfg.fontSz+';background:linear-gradient(180deg,#ffffff,#fbfcff);border-radius:28px;box-shadow:0 18px 40px rgba(15,23,42,0.08);}'
    +'.rpt-header{border-bottom:1px solid #e8edf5;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end;}'
    +'.rpt-brand{font-size:'+cfg.brand+';font-weight:700;letter-spacing:-0.02em;}'
    +'.rpt-meta{text-align:right;font-size:10px;color:#667085;line-height:1.7;}'
    +'.rpt-section{margin-bottom:22px;}'
    +'.rpt-section-title{font-size:'+cfg.sectionTitle+';font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e9edf3;padding-bottom:6px;margin-bottom:12px;}'
    +'.rpt-kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:6px;}'
    +'.rpt-kpi{background:linear-gradient(180deg,#ffffff,#f8fafc);border-radius:12px;padding:12px 14px;border:1px solid #edf1f6;box-shadow:inset 0 1px 0 rgba(255,255,255,0.65);}'
    +'.rpt-kpi-label{font-size:9px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#94a3b8;margin-bottom:3px;}'
    +'.rpt-kpi-val{font-size:17px;font-weight:700;letter-spacing:-0.02em;color:#0f172a;}'
    +'.rpt-kpi-sub{font-size:9px;color:#94a3b8;margin-top:1px;}'
    +'.rpt-table{width:100%;border-collapse:collapse;font-size:11px;}'
    +'.rpt-table th{text-align:left;font-size:9px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#94a3b8;padding:5px 8px;border-bottom:2px solid #e7ecf3;}'
    +'.rpt-table td{padding:6px 8px;border-bottom:1px solid #eef2f7;color:#334155;}'
    +'.td-r{text-align:right;font-family:"SF Mono",ui-monospace,monospace;font-weight:600;}'
    +'.rpt-cat-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;}'
    +'.rpt-cat-name{font-size:11px;font-weight:600;min-width:110px;}'
    +'.rpt-cat-bar-track{flex:1;height:7px;background:#edf2f7;border-radius:999px;overflow:hidden;}'
    +'.rpt-cat-bar-fill{height:100%;border-radius:999px;}'
    +'.rpt-cat-val{font-size:10px;font-family:"SF Mono",ui-monospace,monospace;color:#64748b;min-width:80px;text-align:right;}'
    +'.rpt-footer{margin-top:24px;padding-top:10px;border-top:1px solid #e7ecf3;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between;}'
    +'.rpt-exec-hero{margin-bottom:28px;border-radius:30px;overflow:hidden;border:1px solid rgba(15,23,42,0.08);background:radial-gradient(circle at top right, rgba(214,232,255,0.32), transparent 30%),linear-gradient(135deg,#0f172a 0%,#18263d 48%,#243b53 100%);color:#f8fafc;box-shadow:0 22px 60px rgba(15,23,42,0.18);}'
    +'.rpt-exec-inner{padding:30px 32px 26px;}'
    +'.rpt-exec-top{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap;margin-bottom:20px;}'
    +'.rpt-exec-kicker{font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(248,250,252,0.62);margin-bottom:8px;}'
    +'.rpt-exec-title{max-width:640px;font-size:36px;line-height:1.02;letter-spacing:-0.06em;font-weight:760;}'
    +'.rpt-exec-summary{margin-top:10px;max-width:640px;font-size:13px;line-height:1.6;color:rgba(248,250,252,0.74);}'
    +'.rpt-exec-score{min-width:210px;border-radius:22px;padding:18px 20px;background:rgba(255,255,255,0.09);border:1px solid rgba(255,255,255,0.12);backdrop-filter:blur(16px);}'
    +'.rpt-exec-score-label{font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(248,250,252,0.62);margin-bottom:8px;}'
    +'.rpt-exec-score-value{font-size:48px;line-height:.95;letter-spacing:-0.06em;font-weight:760;color:#fff;}'
    +'.rpt-exec-score-sub{margin-top:8px;font-size:12px;color:rgba(248,250,252,0.78);}'
    +'.rpt-exec-metric-band{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px;}'
    +'.rpt-exec-metric{border-radius:18px;padding:16px 18px;background:rgba(255,255,255,0.09);border:1px solid rgba(255,255,255,0.1);}'
    +'.rpt-exec-metric-label{font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(248,250,252,0.58);margin-bottom:6px;}'
    +'.rpt-exec-metric-value{font-size:24px;font-weight:720;letter-spacing:-0.04em;color:#fff;overflow-wrap:anywhere;}'
    +'.rpt-exec-metric-sub{margin-top:5px;font-size:11px;color:rgba(248,250,252,0.72);overflow-wrap:anywhere;}'
    +'.rpt-exec-panel-grid{display:grid;grid-template-columns:1.18fr .82fr;gap:14px;}'
    +'.rpt-exec-panel{border-radius:22px;padding:20px;border:1px solid rgba(255,255,255,0.1);}'
    +'.rpt-exec-panel.light{background:rgba(248,250,252,0.98);color:#0f172a;}'
    +'.rpt-exec-panel.dark{background:rgba(255,255,255,0.08);color:#f8fafc;}'
    +'.rpt-exec-panel-title{font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:12px;}'
    +'.rpt-exec-panel.light .rpt-exec-panel-title{color:#64748b;}'
    +'.rpt-exec-panel.dark .rpt-exec-panel-title{color:rgba(248,250,252,0.66);}'
    +'.rpt-story-list,.rpt-action-list{display:flex;flex-direction:column;gap:10px;}'
    +'.rpt-story-item,.rpt-action-item{display:flex;gap:10px;align-items:flex-start;}'
    +'.rpt-story-bullet{width:8px;height:8px;border-radius:999px;background:#0f172a;margin-top:6px;flex-shrink:0;}'
    +'.rpt-story-copy{font-size:13px;line-height:1.58;color:#1e293b;}'
    +'.rpt-action-card{width:100%;padding:12px 13px;border-radius:16px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.08);}'
    +'.rpt-action-kicker{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(248,250,252,0.62);margin-bottom:4px;}'
    +'.rpt-action-title{font-size:14px;line-height:1.25;font-weight:660;color:#fff;}'
    +'.rpt-action-copy{font-size:11px;line-height:1.5;color:rgba(248,250,252,0.72);margin-top:4px;}'
    +'@page{margin:1cm;}'
    +'@media print{.no-print{display:none !important;}.rpt{box-shadow:none;border-radius:0;padding:18px;}.rpt-exec-metric-band{grid-template-columns:repeat(2,1fr);}.rpt-exec-panel-grid{grid-template-columns:1fr 1fr;}}';
}

function buildReportHTML(txns,sections,periodLabel){
  const design=state.repDesign||'executive';
  const now=new Date().toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'});
  const today=new Date();
  const arsT=txns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const usdT=txns.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);
  const incArs=state.income.ars+state.income.varArs;
  const incUsd=state.income.usd+state.income.varUsd;
  const incTotal=incArs+(incUsd*USD_TO_ARS);
  const totalArs=arsT+(usdT*USD_TO_ARS);
  const margen=incTotal>0?Math.max(0,incTotal-totalArs):null;
  const pct=incTotal>0?Math.round(totalArs/incTotal*100):null;

  // Categorías del período
  const catMap={};txns.filter(t=>t.currency==='ARS').forEach(t=>{catMap[t.category]=(catMap[t.category]||0)+t.amount;});
  const cats=Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  const maxCat=cats[0]?.[1]||1;

  // Medios de pago
  const medios={tc:0,deb:0,ef:0,sin:0};
  txns.filter(t=>t.currency==='ARS').forEach(t=>{medios[t.payMethod||'sin']+=t.amount;});

  // Top 10
  const top10=[...txns].filter(t=>t.currency==='ARS').sort((a,b)=>b.amount-a.amount).slice(0,10);

  // Cuotas activas
  const autoGroups=typeof detectAutoCuotas==='function'?detectAutoCuotas():[];
  const cuotasActivas=[
    ...autoGroups.filter(g=>{const snap=typeof getAutoCuotaSnapshot==='function'?getAutoCuotaSnapshot(g):null;return !!snap&&snap.paid<snap.total;}),
    ...state.cuotas.filter(c=>c.paid<c.total)
  ];
  const toMonthly=s=>{if(s.freq==='monthly')return s.price;if(s.freq==='annual')return s.price/12;if(s.freq==='weekly')return s.price*4.3;return s.price;};

  // Proyección (solo si es mes actual)
  const activeMk=getActiveDashMonth();
  const txnMk=txns.length?txns[0].month||getMonthKey(txns[0].date):'';
  const isCurrentMonth=txnMk===getMonthKey(today);
  const dayOfMonth=today.getDate();
  const daysInMonth=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
  const dailyRate=dayOfMonth>0?arsT/dayOfMonth:0;
  const projected=Math.round(dailyRate*daysInMonth);
  const daysLeft=daysInMonth-dayOfMonth;

  // Comparación mes anterior
  const prevMonths=getAvailableMonths().sort();
  const curIdx=prevMonths.indexOf(txnMk);
  const prevMk=curIdx>0?prevMonths[curIdx-1]:null;
  const prevTxns=prevMk?state.transactions.filter(t=>(t.month||getMonthKey(t.date))===prevMk):[];
  const prevArs=prevTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const prevCatMap={};prevTxns.filter(t=>t.currency==='ARS').forEach(t=>{prevCatMap[t.category]=(prevCatMap[t.category]||0)+t.amount;});
  const diffTotal=arsT-prevArs;
  const diffPct=prevArs>0?((diffTotal/prevArs)*100).toFixed(1):null;

  // Hábitos: día de semana con más gasto
  const DIAS=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const byDow={};txns.filter(t=>t.currency==='ARS').forEach(t=>{const d=new Date(t.date+'T12:00:00').getDay();byDow[d]=(byDow[d]||0)+t.amount;});
  const peakDow=Object.entries(byDow).sort((a,b)=>b[1]-a[1])[0];
  // Semana más cara
  const byWeek={};txns.filter(t=>t.currency==='ARS').forEach(t=>{const w=t.week||getWeekKey(t.date);byWeek[w]=(byWeek[w]||0)+t.amount;});
  const peakWeek=Object.entries(byWeek).sort((a,b)=>b[1]-a[1])[0];
  const ticketProm=txns.filter(t=>t.currency==='ARS').length>0?arsT/txns.filter(t=>t.currency==='ARS').length:0;

  // Score financiero (0-100)
  let score=100;const scoreFactors=[];
  if(pct!==null){if(pct>100){score-=35;scoreFactors.push({icon:'🔴',txt:'Gastaste más de lo que ingresás ('+pct+'%)'});}else if(pct>85){score-=20;scoreFactors.push({icon:'🟡',txt:'Gasto alto: '+pct+'% del ingreso'});}else{scoreFactors.push({icon:'🟢',txt:'Gasto controlado: '+pct+'% del ingreso'});}}
  if(prevArs>0){if(diffTotal>0&&diffPct>15){score-=15;scoreFactors.push({icon:'🟡',txt:'Subiste el gasto un '+diffPct+'% vs mes anterior'});}else if(diffTotal<0){score+=5;scoreFactors.push({icon:'🟢',txt:'Bajaste el gasto un '+Math.abs(diffPct)+'% vs mes anterior'});}}
  if(cuotasActivas.length>3){score-=10;scoreFactors.push({icon:'🟡',txt:cuotasActivas.length+' cuotas activas acumuladas'});}
  const topCatPct=cats[0]?Math.round(cats[0][1]/arsT*100):0;
  if(topCatPct>50){score-=10;scoreFactors.push({icon:'🟡',txt:'El '+topCatPct+'% del gasto está en una sola categoría: '+cats[0][0]});}
  score=Math.max(0,Math.min(100,score));
  const scoreColor=score>=75?'#16a34a':score>=50?'#d97706':'#dc2626';
  const scoreLabel=score>=75?'Excelente':score>=60?'Bueno':score>=40?'Regular':'Crítico';

  // Alertas
  const alertas=[];
  const allMonths=getAvailableMonths();
  cats.forEach(([cat,val])=>{
    const hist=allMonths.slice(-4).map(m=>state.transactions.filter(t=>(t.month||getMonthKey(t.date))===m&&t.currency==='ARS'&&t.category===cat).reduce((s,t)=>s+t.amount,0)).filter(v=>v>0);
    if(hist.length>=2){const avg=hist.slice(0,-1).reduce((s,v)=>s+v,0)/Math.max(hist.length-1,1);if(avg>0&&val>avg*1.3)alertas.push({tipo:'warn',txt:cat+': $'+fmtN(val)+' ('+Math.round(val/avg*100-100)+'% sobre tu promedio histórico de $'+fmtN(avg)+')'});}
  });
  if(isCurrentMonth&&projected>incTotal&&incTotal>0)alertas.push({tipo:'danger',txt:'Al ritmo actual vas a gastar $'+fmtN(projected-incTotal)+' más de lo que ingresás este mes'});
  if(top10.length&&top10[0].amount>arsT*0.2)alertas.push({tipo:'info',txt:'Un solo gasto (' +esc(top10[0].description)+') representa el '+Math.round(top10[0].amount/arsT*100)+'% del total del mes'});
  if(!alertas.length)alertas.push({tipo:'ok',txt:'Sin anomalías detectadas en este período. ¡Bien!'});

  const aiBrief=[];
  if(pct===null) aiBrief.push('Definí ingresos para convertir este reporte en una lectura completa de margen y ritmo.');
  else if(pct>=100) aiBrief.push('El gasto del período ya supera el ingreso estimado y necesita una corrección inmediata.');
  else if(pct>=85) aiBrief.push(`El gasto ya absorbió ${pct}% del ingreso disponible y conviene moderar consumo variable.`);
  else aiBrief.push(`El período mantiene un uso de ${pct}% del ingreso estimado, dentro de una zona de control razonable.`);
  if(diffPct!==null&&diffTotal>0) aiBrief.push(`El gasto subió ${Math.abs(diffPct)}% frente al período anterior.`);
  if(diffPct!==null&&diffTotal<0) aiBrief.push(`El gasto bajó ${Math.abs(diffPct)}% frente al período anterior.`);
  if(cats[0]&&arsT>0&&Math.round(cats[0][1]/arsT*100)>=35) aiBrief.push(`${cats[0][0]} concentra ${Math.round(cats[0][1]/arsT*100)}% del gasto y es la principal palanca de ajuste.`);
  if(cuotasActivas.length) aiBrief.push(`Hay ${cuotasActivas.length} compromisos en cuotas todavía activos para el próximo cierre.`);

  const projectedOverrun=Math.max(0,(projected||0)-(incTotal||0));
  const execActions=[];
  if(projectedOverrun>0) execActions.push({label:'Recortar gasto variable', body:`Necesitás absorber aproximadamente $${fmtN(Math.round(projectedOverrun))} para cerrar sin desvío.`});
  if(cats[0]) execActions.push({label:'Auditar categoría líder', body:`${cats[0][0]} suma $${fmtN(Math.round(cats[0][1]))} y merece una revisión puntual.`});
  if(state.subscriptions.length>=4) execActions.push({label:'Revisar suscripciones', body:`Tenés ${state.subscriptions.length} servicios activos que podrían optimizarse.`});
  if(cuotasActivas.length) execActions.push({label:'Preparar próximo cierre', body:`El próximo período arranca con ${cuotasActivas.length} cuotas activas ya comprometidas.`});
  if(!execActions.length) execActions.push({label:'Sostener disciplina', body:'No hay desvíos graves: el foco pasa por mantener consistencia y calidad de datos.'});

  // Metas de ahorro
  const savGoals=state.savGoals||[];
  const savDeposits=state.savDeposits||[];
  const savAccounts=state.savAccounts||[];

  let html=`<div class="rpt">
  <div class="rpt-header">
    <div>
      <div class="rpt-brand">● FINANZAS</div>
      <div style="font-size:12px;color:#666;margin-top:4px;">Reporte Financiero Personal</div>
    </div>
    <div class="rpt-meta">
      <div style="font-weight:700;font-size:14px;">${periodLabel}</div>
      <div>Generado el ${now}</div>
      <div>${txns.length} movimientos · ${cats.length} categorías</div>
    </div>
  </div>`;

  if(design==='executive'){
    html+=`<div class="rpt-exec-hero">
      <div class="rpt-exec-inner">
        <div class="rpt-exec-top">
          <div>
            <div class="rpt-exec-kicker">Reporte ejecutivo</div>
            <div class="rpt-exec-title">Una lectura clara del período, con foco en decisiones y próximos movimientos.</div>
            <div class="rpt-exec-summary">Pensado para entender rápido qué cambió, qué está bajo control y dónde conviene actuar primero.</div>
          </div>
          <div class="rpt-exec-score">
            <div class="rpt-exec-score-label">Score del período</div>
            <div class="rpt-exec-score-value">${score}</div>
            <div class="rpt-exec-score-sub">${scoreLabel}</div>
          </div>
        </div>
        <div class="rpt-exec-metric-band">
          <div class="rpt-exec-metric"><div class="rpt-exec-metric-label">Gasto total</div><div class="rpt-exec-metric-value">$${fmtN(Math.round(totalArs))}</div><div class="rpt-exec-metric-sub">${txns.length} movimientos</div></div>
          <div class="rpt-exec-metric"><div class="rpt-exec-metric-label">Uso del ingreso</div><div class="rpt-exec-metric-value">${pct!==null?pct+'%':'—'}</div><div class="rpt-exec-metric-sub">${incTotal>0?'Ingreso estimado $'+fmtN(Math.round(incTotal)):'Sin ingreso configurado'}</div></div>
          <div class="rpt-exec-metric"><div class="rpt-exec-metric-label">Margen ejecutivo</div><div class="rpt-exec-metric-value">${margen!==null?'$'+fmtN(Math.round(margen)):'—'}</div><div class="rpt-exec-metric-sub">${margen!==null&&margen>0?'Todavía disponible':'Exige seguimiento'}</div></div>
          <div class="rpt-exec-metric"><div class="rpt-exec-metric-label">Categoría dominante</div><div class="rpt-exec-metric-value">${esc(cats[0]?.[0]||'Sin datos')}</div><div class="rpt-exec-metric-sub">${cats[0]&&arsT>0?Math.round(cats[0][1]/arsT*100)+'% del gasto':'Sin concentración relevante'}</div></div>
        </div>
        <div class="rpt-exec-panel-grid">
          <div class="rpt-exec-panel light">
            <div class="rpt-exec-panel-title">Lectura asistida</div>
            <div class="rpt-story-list">
              ${aiBrief.slice(0,3).map(txt=>`<div class="rpt-story-item"><span class="rpt-story-bullet"></span><span class="rpt-story-copy">${esc(txt)}</span></div>`).join('')}
            </div>
          </div>
          <div class="rpt-exec-panel dark">
            <div class="rpt-exec-panel-title">Próximas acciones</div>
            <div class="rpt-action-list">
              ${execActions.slice(0,3).map((item,idx)=>`<div class="rpt-action-item"><div class="rpt-action-card"><div class="rpt-action-kicker">Acción ${idx+1}</div><div class="rpt-action-title">${esc(item.label)}</div><div class="rpt-action-copy">${esc(item.body)}</div></div></div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── RESUMEN ──
  if(sections.includes('resumen')){
    html+=`<div class="rpt-section">
    <div class="rpt-section-title">Resumen general</div>
    <div class="rpt-kpi-row">
      <div class="rpt-kpi"><div class="rpt-kpi-label">Gasto total ARS</div><div class="rpt-kpi-val">$${fmtN(arsT)}</div><div class="rpt-kpi-sub">${txns.filter(t=>t.currency==='ARS').length} movimientos</div></div>
      <div class="rpt-kpi"><div class="rpt-kpi-label">Gasto total USD</div><div class="rpt-kpi-val">U$D ${fmtN(usdT)}</div><div class="rpt-kpi-sub">= $${fmtN(Math.round(usdT*USD_TO_ARS))} ARS</div></div>
      <div class="rpt-kpi"><div class="rpt-kpi-label">Margen disponible</div><div class="rpt-kpi-val" style="color:${margen!==null&&margen<=0?'#dc2626':'#1d1d1f'};">${margen!==null?'$'+fmtN(margen):'—'}</div><div class="rpt-kpi-sub">${pct!==null?pct+'% del ingreso utilizado':''}</div></div>
    </div>
    ${incTotal>0?`<div style="margin-top:14px;background:#f7f7f7;border-radius:8px;padding:12px 16px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px;"><span style="color:#666;">Ingreso mensual estimado</span><strong>$${fmtN(incTotal)}</strong></div>
      <div style="height:8px;background:#e5e5e5;border-radius:6px;overflow:hidden;"><div style="height:100%;width:${Math.min(100,pct||0)}%;background:${(pct||0)>=100?'#dc2626':(pct||0)>=80?'#d97706':'#16a34a'};border-radius:6px;"></div></div>
      <div style="font-size:10px;color:#aaa;margin-top:4px;">${pct||0}% utilizado · meta: ${state.alertThreshold}%</div>
    </div>`:''}
  </div>`;
  }

  // ── SCORE ──
  if(sections.includes('score')){
    html+=`<div class="rpt-section">
    <div class="rpt-section-title">Score financiero del período</div>
    <div style="display:flex;align-items:center;gap:24px;background:#f7f7f7;border-radius:12px;padding:18px 22px;">
      <div style="text-align:center;flex-shrink:0;">
        <div style="font-size:52px;font-weight:700;color:${scoreColor};line-height:1;letter-spacing:-0.04em;">${score}</div>
        <div style="font-size:12px;font-weight:700;color:${scoreColor};margin-top:2px;">${scoreLabel}</div>
        <div style="font-size:10px;color:#aaa;margin-top:2px;">sobre 100</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
        ${scoreFactors.map(f=>`<div style="font-size:12px;display:flex;gap:7px;"><span>${f.icon}</span><span style="color:#444;">${f.txt}</span></div>`).join('')}
      </div>
    </div></div>`;
  }

  // ── PROYECCIÓN ──
  if(sections.includes('proyeccion')){
    const projColor=incTotal>0&&projected>incTotal?'#dc2626':'#1d1d1f';
    html+=`<div class="rpt-section">
    <div class="rpt-section-title">Proyección al cierre del mes</div>
    <div class="rpt-kpi-row">
      <div class="rpt-kpi"><div class="rpt-kpi-label">Gasto hasta hoy</div><div class="rpt-kpi-val">$${fmtN(arsT)}</div><div class="rpt-kpi-sub">Día ${dayOfMonth} de ${daysInMonth}</div></div>
      <div class="rpt-kpi"><div class="rpt-kpi-label">Ritmo diario</div><div class="rpt-kpi-val">$${fmtN(Math.round(dailyRate))}</div><div class="rpt-kpi-sub">Promedio por día</div></div>
      <div class="rpt-kpi"><div class="rpt-kpi-label">Estimado a fin de mes</div><div class="rpt-kpi-val" style="color:${projColor};">$${fmtN(projected)}</div><div class="rpt-kpi-sub">${daysLeft} días restantes</div></div>
    </div>
    ${incTotal>0?`<div style="margin-top:12px;padding:10px 14px;border-radius:8px;background:${projected>incTotal?'#fef2f2':'#f0fdf4'};border:1px solid ${projected>incTotal?'#fecaca':'#bbf7d0'};font-size:12px;color:${projected>incTotal?'#991b1b':'#166534'};">
      ${projected>incTotal?'Al ritmo actual vas a <strong>superar tu ingreso</strong> en $'+fmtN(projected-incTotal)+' al cierre del mes.':'Al ritmo actual vas a cerrar el mes con <strong>$'+fmtN(incTotal-projected)+'</strong> de margen disponible.'}
    </div>`:''}
  </div>`;
  }

  // ── COMPARACIÓN ──
  if(sections.includes('comparacion')&&prevMk){
    const[py,pm]=prevMk.split('-').map(Number);
    const prevLabel=MNAMES_R[pm-1]+' '+py;
    const allCatsCmp=[...new Set([...Object.keys(catMap),...Object.keys(prevCatMap)])].sort((a,b)=>(catMap[b]||0)-(catMap[a]||0));
    html+=`<div class="rpt-section">
    <div class="rpt-section-title">Comparación con ${prevLabel}</div>
    <div class="rpt-kpi-row" style="grid-template-columns:1fr 1fr 1fr;">
      <div class="rpt-kpi"><div class="rpt-kpi-label">${prevLabel}</div><div class="rpt-kpi-val">$${fmtN(prevArs)}</div></div>
      <div class="rpt-kpi"><div class="rpt-kpi-label">${periodLabel}</div><div class="rpt-kpi-val">$${fmtN(arsT)}</div></div>
      <div class="rpt-kpi"><div class="rpt-kpi-label">Diferencia</div><div class="rpt-kpi-val" style="color:${diffTotal>0?'#dc2626':'#16a34a'};">${diffTotal>0?'+':''}$${fmtN(Math.abs(diffTotal))}</div><div class="rpt-kpi-sub">${diffPct?(diffTotal>0?'▲ +':'▼ ')+Math.abs(diffPct)+'%':''}</div></div>
    </div>
    <div style="margin-top:12px;">
      <table class="rpt-table"><thead><tr><th>Categoría</th><th style="text-align:right">${prevLabel}</th><th style="text-align:right">${periodLabel}</th><th style="text-align:right">Variación</th></tr></thead><tbody>
      ${allCatsCmp.slice(0,8).map(cat=>{const a=prevCatMap[cat]||0,b=catMap[cat]||0,d=b-a;return`<tr><td>${esc(cat)}</td><td class="td-r" style="color:#999;">$${fmtN(a)}</td><td class="td-r">$${fmtN(b)}</td><td class="td-r" style="color:${d>0?'#dc2626':d<0?'#16a34a':'#aaa'};">${d>0?'+':''}$${fmtN(d)}</td></tr>`;}).join('')}
      </tbody></table>
    </div></div>`;
  }

  // ── ALERTAS ──
  if(sections.includes('alertas')){
    const alertColors={warn:'#fffbeb',danger:'#fef2f2',info:'#eff6ff',ok:'#f0fdf4'};
    const alertBorders={warn:'#fde68a',danger:'#fecaca',info:'#bfdbfe',ok:'#bbf7d0'};
    const alertIcons={warn:'▲',danger:'●',info:'◇',ok:'✓'};
    html+=`<div class="rpt-section">
    <div class="rpt-section-title">Alertas y recomendaciones</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
    ${alertas.map(a=>`<div style="padding:10px 14px;border-radius:8px;background:${alertColors[a.tipo]||'#f9f9f9'};border:1px solid ${alertBorders[a.tipo]||'#eee'};font-size:12px;display:flex;gap:8px;">
      <span>${alertIcons[a.tipo]||'•'}</span><span>${a.txt}</span>
    </div>`).join('')}
    </div></div>`;
  }

  // ── HÁBITOS ──
  if(sections.includes('habitos')&&txns.length){
    const peakDowLabel=peakDow?DIAS[+peakDow[0]]:'—';
    const peakDowAmt=peakDow?peakDow[1]:0;
    let peakWeekLabel='—';
    if(peakWeek){const d=new Date(peakWeek[0]+'T12:00:00');const e=new Date(d);e.setDate(e.getDate()+6);peakWeekLabel=d.getDate()+'/'+(d.getMonth()+1)+' – '+e.getDate()+'/'+(e.getMonth()+1);}
    html+=`<div class="rpt-section">
    <div class="rpt-section-title">Hábitos de consumo</div>
    <div class="rpt-kpi-row">
      <div class="rpt-kpi"><div class="rpt-kpi-label">Día de más gasto</div><div class="rpt-kpi-val">${peakDowLabel}</div><div class="rpt-kpi-sub">$${fmtN(peakDowAmt)} acumulado</div></div>
      <div class="rpt-kpi"><div class="rpt-kpi-label">Semana más cara</div><div class="rpt-kpi-val" style="font-size:16px;">${peakWeekLabel}</div><div class="rpt-kpi-sub">$${peakWeek?fmtN(peakWeek[1]):'—'}</div></div>
      <div class="rpt-kpi"><div class="rpt-kpi-label">Ticket promedio</div><div class="rpt-kpi-val">$${fmtN(Math.round(ticketProm))}</div><div class="rpt-kpi-sub">por transacción ARS</div></div>
    </div>
    <div style="margin-top:12px;background:#f7f7f7;border-radius:8px;padding:12px 16px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#aaa;margin-bottom:10px;">Distribución por día de la semana</div>
      ${DIAS.map((d,i)=>{const v=byDow[i]||0;const w=arsT>0?Math.round(v/arsT*100):0;return`<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;"><div style="width:24px;font-size:10px;color:#888;font-weight:600;">${d}</div><div style="flex:1;height:6px;background:#e5e5e5;border-radius:3px;overflow:hidden;"><div style="height:100%;width:${w}%;background:#6366f1;border-radius:3px;"></div></div><div style="font-size:10px;color:#666;min-width:36px;text-align:right;">${w}%</div></div>`;}).join('')}
    </div></div>`;
  }

  // ── CATEGORÍAS ──
  if(sections.includes('categorias')&&cats.length){
    html+=`<div class="rpt-section">
    <div class="rpt-section-title">Gastos por categoría</div>`;
    cats.forEach(([cat,val])=>{
      const w=Math.round(val/maxCat*100);
      const col=catColor(cat)||'#888';
      html+=`<div class="rpt-cat-bar-row">
        <div class="rpt-cat-name">${catEmoji(cat)} ${esc(cat)}</div>
        <div class="rpt-cat-bar-track"><div class="rpt-cat-bar-fill" style="width:${w}%;background:${col};"></div></div>
        <div class="rpt-cat-val">$${fmtN(val)} · ${Math.round(val/arsT*100)}%</div>
      </div>`;
    });
    html+=`</div>`;
  }

  // ── MEDIOS DE PAGO ──
  if(sections.includes('medios')&&txns.some(t=>t.payMethod)){
    const totalMed=medios.tc+medios.deb+medios.ef;
    html+=`<div class="rpt-section">
    <div class="rpt-section-title">Medios de pago</div>
    <div class="rpt-kpi-row">
      <div class="rpt-kpi"><div class="rpt-kpi-label">Tarjeta de crédito</div><div class="rpt-kpi-val">$${fmtN(medios.tc)}</div><div class="rpt-kpi-sub">${totalMed>0?Math.round(medios.tc/totalMed*100):0}%</div></div>
      <div class="rpt-kpi"><div class="rpt-kpi-label">Débito / Transferencia</div><div class="rpt-kpi-val">$${fmtN(medios.deb)}</div><div class="rpt-kpi-sub">${totalMed>0?Math.round(medios.deb/totalMed*100):0}%</div></div>
      <div class="rpt-kpi"><div class="rpt-kpi-label">Efectivo</div><div class="rpt-kpi-val">$${fmtN(medios.ef)}</div><div class="rpt-kpi-sub">${totalMed>0?Math.round(medios.ef/totalMed*100):0}%</div></div>
    </div></div>`;
  }

  // ── COMPROMISOS PRÓXIMO MES ──
  if(sections.includes('compromisos')){
    const subsTotal=state.subscriptions.reduce((s,sub)=>s+(sub.currency==='ARS'?toMonthly(sub):toMonthly(sub)*USD_TO_ARS),0);
    const cuotasTotal=cuotasActivas.reduce((s,c)=>s+(c.amount||c.monthlyAmount||0),0);
    const totalComp=subsTotal+cuotasTotal;
    html+=`<div class="rpt-section">
    <div class="rpt-section-title">Compromisos próximo mes</div>
    <div class="rpt-kpi-row">
      <div class="rpt-kpi"><div class="rpt-kpi-label">Cuotas activas</div><div class="rpt-kpi-val">$${fmtN(Math.round(cuotasTotal))}</div><div class="rpt-kpi-sub">${cuotasActivas.length} cuotas</div></div>
      <div class="rpt-kpi"><div class="rpt-kpi-label">Suscripciones</div><div class="rpt-kpi-val">$${fmtN(Math.round(subsTotal))}</div><div class="rpt-kpi-sub">${state.subscriptions.length} servicios</div></div>
      <div class="rpt-kpi"><div class="rpt-kpi-label">Total comprometido</div><div class="rpt-kpi-val">$${fmtN(Math.round(totalComp))}</div><div class="rpt-kpi-sub">${incTotal>0?Math.round(totalComp/incTotal*100)+'% del ingreso':''}</div></div>
    </div></div>`;
  }

  // ── GASTOS FIJOS VS VARIABLES ──
  if(sections.includes('fijosvar')){
    // Categorías "fijas": suscripciones, cuotas detectadas, servicios, alquiler, etc.
    const FIXED_KEYWORDS=['suscripción','servicio','alquiler','expensa','seguro','plan','cuota','internet','luz','gas','agua','telefonía','streaming'];
    let fixedAmt=0,varAmt=0;
    const fixedCats=[],varCats=[];
    cats.forEach(([cat,val])=>{
      const isFixed=FIXED_KEYWORDS.some(k=>cat.toLowerCase().includes(k))||
        state.subscriptions.some(s=>s.name.toLowerCase().includes(cat.toLowerCase()));
      if(isFixed){fixedAmt+=val;fixedCats.push(cat);}
      else{varAmt+=val;varCats.push(cat);}
    });
    const fixedPct=arsT>0?Math.round(fixedAmt/arsT*100):0;
    const varPct=100-fixedPct;
    html+=`<div class="rpt-section">
    <div class="rpt-section-title">Gastos fijos vs variables</div>
    <div style="display:flex;gap:14px;margin-bottom:12px;">
      <div class="rpt-kpi" style="flex:1;border-left:3px solid #6366f1;"><div class="rpt-kpi-label">🔒 Fijos / Predecibles</div><div class="rpt-kpi-val">$${fmtN(Math.round(fixedAmt))}</div><div class="rpt-kpi-sub">${fixedPct}% del gasto total</div></div>
      <div class="rpt-kpi" style="flex:1;border-left:3px solid #f59e0b;"><div class="rpt-kpi-label">🎲 Variables / Discrecionales</div><div class="rpt-kpi-val">$${fmtN(Math.round(varAmt))}</div><div class="rpt-kpi-sub">${varPct}% del gasto total</div></div>
    </div>
    <div style="height:12px;border-radius:6px;overflow:hidden;display:flex;margin-bottom:8px;">
      <div style="width:${fixedPct}%;background:#6366f1;"></div>
      <div style="width:${varPct}%;background:#f59e0b;"></div>
    </div>
    <div style="font-size:11px;color:#888;line-height:1.7;">
      <span style="color:#6366f1;font-weight:700;">Fijos:</span> ${fixedCats.length?fixedCats.join(', '):'—'}<br>
      <span style="color:#f59e0b;font-weight:700;">Variables:</span> ${varCats.length?varCats.slice(0,6).join(', ')+(varCats.length>6?' y más...':''):'—'}
    </div>
    <div style="margin-top:10px;padding:8px 12px;border-radius:8px;background:#f8f8f8;font-size:11px;color:#555;">
      ${varPct>60?'⚠️ Más del 60% de tu gasto es variable y discrecional — hay mayor margen para recortar si necesitás.':varPct>40?'💡 Tu gasto tiene buena mezcla. Los gastos variables te dan flexibilidad para ajustar si es necesario.':'✅ La mayoría de tu gasto es predecible, lo que facilita la planificación mensual.'}
    </div></div>`;
  }

  // ── TENDENCIA POR CATEGORÍA ──
  if(sections.includes('tendcats')){
    const allMks=getAvailableMonths().sort().slice(-5);
    const topCatsForTrend=cats.slice(0,7).map(([c])=>c);
    if(allMks.length>=2&&topCatsForTrend.length){
      html+=`<div class="rpt-section">
      <div class="rpt-section-title">Tendencia de categorías (últimos ${allMks.length} meses)</div>
      <div style="overflow-x:auto;">
      <table class="rpt-table"><thead><tr><th>Categoría</th>
      ${allMks.map(m=>{const[y,mo]=m.split('-');return`<th style="text-align:right">${MNAMES_R[+mo-1].slice(0,3)}</th>`;}).join('')}
      <th style="text-align:center">Tendencia</th></tr></thead><tbody>
      ${topCatsForTrend.map(cat=>{
        const vals=allMks.map(m=>state.transactions.filter(t=>(t.month||getMonthKey(t.date))===m&&t.currency==='ARS'&&t.category===cat).reduce((s,t)=>s+t.amount,0));
        const last=vals[vals.length-1];const prev=vals[vals.length-2]||0;
        const trend=last>prev*1.1?'↑':last<prev*0.9?'↓':'→';
        const trendColor=trend==='↑'?'#dc2626':trend==='↓'?'#16a34a':'#888';
        return`<tr><td style="font-weight:600;">${esc(cat)}</td>${vals.map(v=>`<td class="td-r" style="color:${v>0?'#333':'#ccc'};">${v>0?'$'+fmtN(v):'—'}</td>`).join('')}<td style="text-align:center;font-size:16px;color:${trendColor};font-weight:700;">${trend}</td></tr>`;
      }).join('')}
      </tbody></table></div></div>`;
    }
  }

  // ── VARIABILIDAD / CONSISTENCIA ──
  if(sections.includes('variabilidad')){
    const allMksFull=getAvailableMonths().sort().slice(-6);
    const monthlyTotals=allMksFull.map(m=>state.transactions.filter(t=>(t.month||getMonthKey(t.date))===m&&t.currency==='ARS').reduce((s,t)=>s+t.amount,0)).filter(v=>v>0);
    if(monthlyTotals.length>=2){
      const avg=monthlyTotals.reduce((s,v)=>s+v,0)/monthlyTotals.length;
      const variance=monthlyTotals.reduce((s,v)=>s+Math.pow(v-avg,2),0)/monthlyTotals.length;
      const stddev=Math.sqrt(variance);
      const cv=avg>0?(stddev/avg*100):0; // coeficiente de variación
      const cvLabel=cv<10?'Muy consistente':cv<20?'Bastante estable':cv<35?'Moderadamente variable':'Muy variable';
      const cvColor=cv<10?'#16a34a':cv<20?'#65a30d':cv<35?'#d97706':'#dc2626';
      const minM=Math.min(...monthlyTotals),maxM=Math.max(...monthlyTotals);
      html+=`<div class="rpt-section">
      <div class="rpt-section-title">Consistencia mensual</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:12px;">
        <div class="rpt-kpi" style="flex:1;min-width:120px;"><div class="rpt-kpi-label">Promedio mensual</div><div class="rpt-kpi-val">$${fmtN(Math.round(avg))}</div></div>
        <div class="rpt-kpi" style="flex:1;min-width:120px;"><div class="rpt-kpi-label">Desvío estándar</div><div class="rpt-kpi-val">$${fmtN(Math.round(stddev))}</div><div class="rpt-kpi-sub">±${Math.round(cv)}% de variación</div></div>
        <div class="rpt-kpi" style="flex:1;min-width:120px;"><div class="rpt-kpi-label">Rango</div><div class="rpt-kpi-val" style="font-size:15px;">$${fmtN(Math.round(minM))} – $${fmtN(Math.round(maxM))}</div><div class="rpt-kpi-sub">min – max</div></div>
      </div>
      <div style="padding:12px 16px;border-radius:8px;border-left:4px solid ${cvColor};background:#f8f8f8;display:flex;align-items:center;gap:12px;">
        <div style="font-size:28px;font-weight:700;color:${cvColor};">${Math.round(cv)}%</div>
        <div><div style="font-weight:700;font-size:13px;color:${cvColor};">${cvLabel}</div><div style="font-size:11px;color:#777;margin-top:2px;">Tu gasto varía un ${Math.round(cv)}% mes a mes en promedio. ${cv<15?'Eso indica buena disciplina presupuestaria.':cv<30?'Hay algunos meses atípicos que inflan la variación.':'Tus meses son muy distintos entre sí, puede ser útil identificar qué los dispara.'}</div></div>
      </div>
      <div style="margin-top:10px;display:flex;align-items:flex-end;gap:3px;height:40px;">
        ${monthlyTotals.map((v,i)=>{const h=Math.round(v/maxM*38);const mk=allMksFull[i];const[,mo]=mk.split('-');return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;"><div style="height:${h}px;width:100%;background:${v===maxM?'#dc2626':v===minM?'#16a34a':'#6366f1'};border-radius:3px 3px 0 0;opacity:0.8;"></div><div style="font-size:8px;color:#aaa;">${MNAMES_R[+mo-1].slice(0,3)}</div></div>`;}).join('')}
      </div>
    </div>`;
    }
  }

  // ── SIMULADOR ──
  if(sections.includes('simulador')&&isCurrentMonth&&incTotal>0){
    const gastoHoy=arsT;const diasPasados=dayOfMonth;const diasRestantes=daysLeft;
    const presupuestoRestante=Math.max(0,incTotal-gastoHoy);
    const disponibleDiario=diasRestantes>0?presupuestoRestante/diasRestantes:0;
    const puedoGastarHoy=Math.max(0,disponibleDiario);
    const comprometido=(cuotasActivas.reduce((s,c)=>s+(c.amount||c.monthlyAmount||0),0))+(state.subscriptions.reduce((s,sub)=>s+toMonthly(sub),0));
    const libreReal=Math.max(0,presupuestoRestante-comprometido);
    html+=`<div class="rpt-section">
    <div class="rpt-section-title">¿Cuánto podés gastar este mes?</div>
    <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);border-radius:14px;padding:20px 22px;color:#fff;margin-bottom:12px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;opacity:0.6;margin-bottom:6px;">Presupuesto restante (${diasRestantes} días)</div>
      <div style="font-size:38px;font-weight:700;letter-spacing:-0.04em;margin-bottom:4px;">$${fmtN(Math.round(presupuestoRestante))}</div>
      <div style="font-size:12px;opacity:0.7;">= $${fmtN(Math.round(disponibleDiario))} por día sin pasarte</div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <div class="rpt-kpi" style="flex:1;min-width:140px;border-top:3px solid #10b981;"><div class="rpt-kpi-label">Libre real (sin compromisos)</div><div class="rpt-kpi-val" style="color:#059669;">$${fmtN(Math.round(libreReal))}</div><div class="rpt-kpi-sub">Descontando cuotas y subs</div></div>
      <div class="rpt-kpi" style="flex:1;min-width:140px;border-top:3px solid #8b5cf6;"><div class="rpt-kpi-label">Compromisos restantes</div><div class="rpt-kpi-val" style="color:#7c3aed;">$${fmtN(Math.round(comprometido))}</div><div class="rpt-kpi-sub">Cuotas + suscripciones</div></div>
    </div></div>`;
  }

  // ── ETA CUOTAS ──
  if(sections.includes('etacuotas')&&cuotasActivas.length){
    html+=`<div class="rpt-section">
    <div class="rpt-section-title">¿Cuándo terminan tus cuotas?</div>
    <table class="rpt-table"><thead><tr><th>Cuota</th><th style="text-align:right">Monto/mes</th><th style="text-align:right">Pagadas</th><th style="text-align:right">Total</th><th style="text-align:right">Fin estimado</th></tr></thead><tbody>`;
    const nowDate=new Date();
    cuotasActivas.slice(0,12).forEach(item=>{
      const nombre=item.key||item.description||'Cuota';
      const monto=item.amount||item.monthlyAmount||0;
      let paid=0,total=0;
      if(item.key){const snap=typeof getAutoCuotaSnapshot==='function'?getAutoCuotaSnapshot(item):null;paid=snap?snap.paid:0;total=snap?snap.total:1;}
      else{paid=item.paid||0;total=item.total||1;}
      const remaining=total-paid;
      const etaDate=new Date(nowDate.getFullYear(),nowDate.getMonth()+remaining,1);
      const etaLabel=MNAMES_R[etaDate.getMonth()]+' '+etaDate.getFullYear();
      html+=`<tr><td style="font-weight:600;">${esc(String(nombre).slice(0,30))}</td><td class="td-r">$${fmtN(monto)}</td><td class="td-r">${paid}/${total}</td><td class="td-r" style="color:#888;">${remaining} restantes</td><td class="td-r" style="color:#6366f1;font-weight:700;">${etaLabel}</td></tr>`;
    });
    html+=`</tbody></table></div>`;
  }

  // ── RECOMENDACIONES ──
  if(sections.includes('recomendaciones')){
    const recs=[];
    // Top categorías sobre promedio histórico
    const allMksHist=getAvailableMonths().sort().slice(-4);
    cats.slice(0,8).forEach(([cat,val])=>{
      const hist=allMksHist.slice(0,-1).map(m=>state.transactions.filter(t=>(t.month||getMonthKey(t.date))===m&&t.currency==='ARS'&&t.category===cat).reduce((s,t)=>s+t.amount,0)).filter(v=>v>0);
      if(hist.length>=1){const avg=hist.reduce((s,v)=>s+v,0)/hist.length;const diff=val-avg;if(diff>avg*0.2&&diff>5000){recs.push({icon:'✂️',prioridad:'alta',txt:`Recortá <strong>${esc(cat)}</strong> — gastaste $${fmtN(Math.round(diff))} más que tu promedio ($${fmtN(Math.round(avg))}). Volver al promedio te ahorraría <strong>$${fmtN(Math.round(diff))}/mes</strong>.`});}}
    });
    // Suscripciones acumuladas
    if(state.subscriptions.length>=4){const subsTotal=state.subscriptions.reduce((s,sub)=>s+toMonthly(sub),0);recs.push({icon:'🔄',prioridad:'media',txt:`Tenés <strong>${state.subscriptions.length} suscripciones activas</strong> por un total de $${fmtN(Math.round(subsTotal))}/mes. Revisá si todas las usás activamente.`});}
    // Gasto en TC alto
    const totalMedRec=medios.tc+medios.deb+medios.ef;
    if(totalMedRec>0&&medios.tc/totalMedRec>0.7){recs.push({icon:'💳',prioridad:'media',txt:`El <strong>${Math.round(medios.tc/totalMedRec*100)}% de tus gastos</strong> son con tarjeta de crédito. Si no pagás el total, los intereses pueden ser significativos.`});}
    // Margen negativo
    if(pct!==null&&pct>95){recs.push({icon:'🚨',prioridad:'alta',txt:`Estás usando el <strong>${pct}% de tu ingreso</strong>. Intentá reducir cualquier gasto variable este mes para evitar cerrar en rojo.`});}
    // Default positivo
    if(!recs.length){recs.push({icon:'🎯',prioridad:'ok',txt:'No hay categorías fuera de lo normal. ¡Tus gastos están dentro del rango habitual!'});}
    const priCol={alta:'#fef2f2',media:'#fffbeb',ok:'#f0fdf4'};
    const priBorder={alta:'#fecaca',media:'#fde68a',ok:'#bbf7d0'};
    html+=`<div class="rpt-section">
    <div class="rpt-section-title">Recomendaciones personalizadas</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
    ${recs.slice(0,5).map(r=>`<div style="padding:12px 14px;border-radius:8px;background:${priCol[r.prioridad]||'#f9f9f9'};border:1px solid ${priBorder[r.prioridad]||'#eee'};font-size:12px;display:flex;gap:10px;line-height:1.6;align-items:flex-start;"><span style="font-size:16px;flex-shrink:0;">${r.icon}</span><span>${r.txt}</span></div>`).join('')}
    </div></div>`;
  }

  // ── METAS DE AHORRO ──
  if(sections.includes('metas')&&savGoals.length){
    html+=`<div class="rpt-section">
    <div class="rpt-section-title">Progreso de metas de ahorro</div>
    <div style="display:flex;flex-direction:column;gap:12px;">
    ${(()=>{
      const _rAccARS=savAccounts.filter(a=>a.currency==='ARS').reduce((s,a)=>s+a.balance,0);
      const _rAccUSD=savAccounts.filter(a=>a.currency==='USD').reduce((s,a)=>s+a.balance,0);
      return savGoals.map(g=>{
      const saved=g.currency==='USD'?_rAccUSD+(_rAccARS/USD_TO_ARS):_rAccARS+(_rAccUSD*USD_TO_ARS);
      const target=g.target;
      const prefix=g.currency==='USD'?'U$D ':'$';
      const pctG=target>0?Math.min(100,Math.round(saved/target*100)):0;
      const remaining=Math.max(0,target-saved);
      return`<div style="background:#f7f7f7;border-radius:8px;padding:14px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div style="font-weight:700;font-size:13px;">${esc(g.name)}</div>
          <div style="font-size:12px;color:#666;">${prefix}${fmtN(Math.round(saved))} / ${prefix}${fmtN(target)}</div>
        </div>
        <div style="height:10px;background:#e5e5e5;border-radius:5px;overflow:hidden;margin-bottom:6px;">
          <div style="height:100%;width:${pctG}%;background:${pctG>=100?'#16a34a':'#6366f1'};border-radius:5px;"></div>
        </div>
        <div style="font-size:10px;color:#aaa;display:flex;justify-content:space-between;">
          <span>${pctG}% completado</span>
          <span>${pctG>=100?'Meta alcanzada':'Faltan '+prefix+fmtN(Math.round(remaining))}</span>
        </div>
      </div>`;
    }).join('');})()}
    </div></div>`;
  }

  // ── TOP 10 ──
  if(sections.includes('top10')&&top10.length){
    html+=`<div class="rpt-section">
    <div class="rpt-section-title">Top 10 gastos del período</div>
    <table class="rpt-table"><thead><tr><th>#</th><th>Fecha</th><th>Descripción</th><th>Categoría</th><th style="text-align:right">Monto</th></tr></thead><tbody>`;
    top10.forEach((t,i)=>{html+=`<tr><td style="color:#aaa;font-weight:700;">${i+1}</td><td>${fmtDate(t.date)}</td><td>${esc(t.description)}</td><td>${esc(t.category)}</td><td class="td-r">$${fmtN(t.amount)}</td></tr>`;});
    html+=`</tbody></table></div>`;
  }

  // ── CUOTAS ACTIVAS ──
  if(sections.includes('cuotas')&&(cuotasActivas.length||state.subscriptions.length)){
    html+=`<div class="rpt-section"><div class="rpt-section-title">Cuotas y suscripciones activas</div><table class="rpt-table"><thead><tr><th>Descripción</th><th>Tipo</th><th style="text-align:right">Monto mensual</th></tr></thead><tbody>`;
    cuotasActivas.slice(0,15).forEach(item=>{const nombre=item.key||item.description||'Cuota';const monto=item.monthlyAmount||item.amount||0;html+=`<tr><td>${esc(nombre)}</td><td style="color:#888;">Cuota</td><td class="td-r">$${fmtN(monto)}</td></tr>`;});
    state.subscriptions.forEach(s=>{html+=`<tr><td>${esc(s.name)}</td><td style="color:#888;">Suscripción</td><td class="td-r">${s.currency==='USD'?'U$D ':'$'}${fmtN(toMonthly(s))}</td></tr>`;});
    html+=`</tbody></table></div>`;
  }

  // ── TODOS LOS MOVIMIENTOS ──
  if(sections.includes('todos')&&txns.length){
    const sorted=[...txns].sort((a,b)=>new Date(b.date)-new Date(a.date));
    html+=`<div class="rpt-section"><div class="rpt-section-title">Todos los movimientos (${sorted.length})</div><table class="rpt-table"><thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th style="text-align:right">Monto</th></tr></thead><tbody>`;
    sorted.forEach(t=>{html+=`<tr><td style="white-space:nowrap;">${fmtDate(t.date)}</td><td>${esc(t.description)}</td><td>${esc(t.category)}</td><td class="td-r">${t.currency==='USD'?'U$D ':'$'}${fmtN(t.amount)}</td></tr>`;});
    html+=`</tbody></table></div>`;
  }

  html+=`<div class="rpt-footer"><span>● FINANZAS — Reporte personal</span><span>Generado el ${now}</span></div></div>`;
  return html;
}

function updateRepPreview(){
  const txns=getRepTxns();
  const sections=getRepSections();
  const label=getRepPeriodLabel();
  const content=document.getElementById('rep-preview-content');
  const meta=document.getElementById('rep-preview-meta');
  if(meta)meta.textContent=txns.length+' movimientos · '+sections.length+' secciones · diseño '+(state.repDesign||'executive');
  if(!content)return;
  if(!txns.length){
    content.innerHTML='<div class="rep-preview-empty">Sin datos para el período seleccionado</div>';
    return;
  }
  // Update check item styles
  document.querySelectorAll('.rep-check-item').forEach(el=>{
    el.classList.toggle('checked',el.querySelector('input').checked);
  });

  const design = state.repDesign || 'executive';
  const html = buildReportHTML(txns,sections,label);
  
  // Apply design-specific classes to simulation preview
  content.className = 'rep-preview-content design-' + design;
  content.innerHTML = html;
}

function exportRepHTML(){showToast('Usá Guardar PDF','info');}

async function renderPreviewPdfBlob(){
  const preview = document.getElementById('rep-preview-content');
  if(!preview || !preview.innerHTML.trim()) throw new Error('La vista previa todavía no está lista');
  if(!window.html2canvas || !window.jspdf?.jsPDF) throw new Error('Faltan librerías de PDF en el navegador');

  const label = getRepPeriodLabel();
  const shell = document.createElement('div');
  shell.style.position = 'fixed';
  shell.style.left = '-20000px';
  shell.style.top = '0';
  shell.style.width = '1340px';
  shell.style.padding = '18px';
  shell.style.background = '#f4f7fb';
  shell.style.zIndex = '-1';

  const paper = document.createElement('div');
  paper.style.background = '#ffffff';
  paper.style.padding = '16px';
  paper.style.borderRadius = '20px';
  paper.style.boxShadow = '0 20px 50px rgba(15,23,42,0.08)';
  paper.style.fontFamily = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';

  const meta = document.createElement('div');
  meta.style.display = 'flex';
  meta.style.justifyContent = 'space-between';
  meta.style.alignItems = 'center';
  meta.style.gap = '12px';
  meta.style.marginBottom = '16px';
  meta.innerHTML = `<div style="font-size:15px;font-weight:700;color:#0f172a;">FINANZAS · Vista previa del informe</div><div style="font-size:12px;color:#64748b;">${esc(label)}</div>`;

  const clone = preview.cloneNode(true);
  clone.style.padding = '0';
  clone.style.margin = '0';

  paper.appendChild(meta);
  paper.appendChild(clone);
  shell.appendChild(paper);
  document.body.appendChild(shell);

  try {
    const canvas = await window.html2canvas(shell, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#f4f7fb',
      logging: false,
      windowWidth: 1280,
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const drawW = pageW - margin * 2;
    const fullDrawH = canvas.height * drawW / canvas.width;
    const availablePageH = pageH - margin * 2;
    const pageCanvasHeight = Math.floor(canvas.width * (availablePageH / drawW));

    let srcY = 0;
    let pageIndex = 0;
    while(srcY < canvas.height){
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.min(pageCanvasHeight, canvas.height - srcY);
      const ctx = pageCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, srcY, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height);
      const pageImg = pageCanvas.toDataURL('image/png');
      const pageImgH = pageCanvas.height * drawW / pageCanvas.width;
      if(pageIndex > 0) pdf.addPage();
      pdf.addImage(pageImg, 'PNG', margin, margin, drawW, pageImgH, undefined, 'FAST');
      srcY += pageCanvas.height;
      pageIndex += 1;
    }

    return pdf.output('blob');
  } finally {
    shell.remove();
  }
}

async function blobToBase64(blob){
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for(let i=0;i<bytes.length;i+=chunk){
    binary += String.fromCharCode(...bytes.subarray(i, i+chunk));
  }
  return btoa(binary);
}

async function exportRepPDF(){
  const txns=getRepTxns();const sections=getRepSections();const label=getRepPeriodLabel();
  if(!txns.length){showToast('Sin datos para exportar','error');return;}
  try {
    showToast('Generando PDF…', 'info');
    const blob = await renderPreviewPdfBlob();
    const safeLabel = String(label || 'reporte').replace(/[^\w\-]+/g, '_');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-finanzas-${safeLabel}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
    showToast('✓ PDF descargado en tu computadora', 'success');
  } catch(err) {
    console.error(err);
    showToast('No pude generar el PDF visual', 'error');
  }
}

function fallbackPrintPDF(reportBody,s,label){
  const html='<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte — '+label+'</title><style>'
    +getReportStyleSheet(s)
    +'</style></head><body>'+reportBody+'</body></html>';
  const win=window.open('','_blank');
  if(win){
    win.document.write(html);win.document.close();
    setTimeout(()=>{win.print();},600);
    showToast('📄 Usá "Guardar como PDF" en el diálogo','info');
  } else {
    showToast('⚠️ Desbloqueá popups para exportar','error');
  }
}

function printReport(){
  const txns=getRepTxns();const sections=getRepSections();const label=getRepPeriodLabel();
  if(!txns.length){showToast('Sin datos','error');return;}
  const design=state.repDesign||'executive';
  const s={executive:{accent:'#1d1d1f',fontSz:'12px',pad:'32px',brand:'20px',headerBorder:'3px solid #1d1d1f',kpiBg:'#f7f7f7',sectionTitle:'11px'},detailed:{accent:'#007aff',fontSz:'11px',pad:'24px',brand:'18px',headerBorder:'2px solid #007aff',kpiBg:'#f0f5ff',sectionTitle:'10px'},minimal:{accent:'#333',fontSz:'11px',pad:'28px',brand:'16px',headerBorder:'1px solid #ccc',kpiBg:'#fafafa',sectionTitle:'9px'}}[design]||{accent:'#1d1d1f',fontSz:'12px',pad:'32px',brand:'20px',headerBorder:'3px solid #1d1d1f',kpiBg:'#f7f7f7',sectionTitle:'11px'};
  fallbackPrintPDF(buildReportHTML(txns,sections,label),s,label);
}



// ══ RESUMEN ══
function openResumen(){
  if(!state.transactions.length){showToast('Importá datos primero','error');return;}
  const lastImp=state.imports[0];
  const periodTxns=lastImp&&lastImp.txnIds?state.transactions.filter(t=>lastImp.txnIds.includes(t.id)):state.transactions;
  const label=lastImp?lastImp.label:'Todos los datos';
  const ars=periodTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const usd=periodTxns.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);
  const inc=state.income.ars+state.income.varArs;const pct=inc>0?Math.round((ars/inc)*100):null;
  const catMap={};periodTxns.filter(t=>t.currency==='ARS').forEach(t=>{catMap[t.category]=(catMap[t.category]||0)+t.amount;});
  const topCats=Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  let diffHtml='';
  if(state.imports.length>=2){const prevImp=state.imports[1];const prevTxns=prevImp.txnIds?state.transactions.filter(t=>prevImp.txnIds.includes(t.id)):[];const prevArs=prevTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);const diff=ars-prevArs;const dp=prevArs>0?((diff/prevArs)*100).toFixed(1):null;diffHtml='<div class="resumen-block"><h4>vs período anterior ('+prevImp.label+')</h4><div class="resumen-row"><span class="rr-label">Diferencia</span><span class="rr-val" style="color:'+(diff>0?'var(--danger)':'var(--accent)')+';">'+(diff>0?'+':'')+'$'+fmtN(Math.abs(diff))+' ARS</span></div>'+(dp?'<div class="resumen-row"><span class="rr-label">Variación</span><span class="rr-val" style="color:'+(diff>0?'var(--danger)':'var(--accent)')+';">'+(diff>0?'▲':'▼')+' '+Math.abs(dp)+'%</span></div>':'')+'</div>';}
  document.getElementById('resumen-periodo').textContent=label;
  document.getElementById('resumen-body').innerHTML='<div class="resumen-block"><h4>💰 Gastos del período</h4><div class="resumen-row"><span class="rr-label">Total ARS</span><span class="rr-val">$'+fmtN(ars)+'</span></div>'+(usd>0?'<div class="resumen-row"><span class="rr-label">Total USD</span><span class="rr-val">U$D '+fmtN(usd)+'</span></div>':'')+(pct!==null?'<div class="resumen-row"><span class="rr-label">% del ingreso</span><span class="rr-val" style="color:'+(pct>state.alertThreshold?'var(--danger)':'var(--accent)')+';">'+pct+'%</span></div>':'')+'<div class="resumen-row"><span class="rr-label">Transacciones</span><span class="rr-val">'+periodTxns.length+'</span></div></div><div class="resumen-block"><h4>🏆 Top categorías</h4>'+topCats.map(([cat,amt])=>'<div class="resumen-row"><span class="rr-label">'+cat+'</span><span class="rr-val">$'+fmtN(amt)+'</span></div>').join('')+'</div>'+diffHtml;
  openModal('modal-resumen');
}
function copyResumen(){
  let txt='📋 RESUMEN FINANCIERO — '+document.getElementById('resumen-periodo').textContent+'\n━━━━━━━━━━━━━━━━━━\n';
  document.querySelectorAll('#resumen-body .resumen-block').forEach(block=>{const h4=block.querySelector('h4');if(h4)txt+='\n'+h4.textContent+'\n';block.querySelectorAll('.resumen-row').forEach(row=>{txt+='  '+(row.querySelector('.rr-label')?.textContent||'')+': '+(row.querySelector('.rr-val')?.textContent||'')+'\n';});});
  navigator.clipboard.writeText(txt).then(()=>showToast('✓ Copiado','success')).catch(()=>showToast('Error al copiar','error'));
}

// ══ IMPORT HISTORY ══
function renderImportHistory(){
  renderDriveStatusBanner();
  renderBackupHistory();
  updateCSVExportCount();
  const el=document.getElementById('import-history-list');if(!el)return;
  if(!state.imports.length){el.innerHTML='<div class="empty-state import-history-empty"><div class="empty-icon">📋</div><div class="empty-title import-history-empty-title">Sin importaciones aún</div></div>';return;}
  el.innerHTML=state.imports.map(imp=>'<div class="import-row"><span class="import-badge">'+imp.count+' mov.</span><div class="import-row-copy"><div class="import-row-title">'+imp.label+'</div><div class="import-meta">'+imp.date+' · Texto pegado</div></div><button class="btn btn-ghost btn-sm btn-icon import-row-btn" onclick="openRenameImport(\''+imp.id+'\');" title="Renombrar">✏️</button><button class="btn btn-danger btn-sm btn-icon" onclick="deleteImport(\''+imp.id+'\');" title="Eliminar">🗑</button></div>').join('');
}

function openRenameImport(id){
  const imp=state.imports.find(i=>i.id===id);if(!imp)return;
  document.getElementById('rename-import-id').value=id;
  document.getElementById('rename-import-val').value=imp.label;
  document.getElementById('modal-rename-import').classList.add('open');
  setTimeout(()=>document.getElementById('rename-import-val').select(),50);
}

function confirmRenameImport(){
  const id=document.getElementById('rename-import-id').value;
  const val=document.getElementById('rename-import-val').value.trim();
  if(!val){showToast('⚠️ Ingresá un nombre','error');return;}
  const imp=state.imports.find(i=>i.id===id);
  if(imp){imp.label=val;saveState();renderImportHistory();showToast('✓ Nombre actualizado','success');}
  closeModal('modal-rename-import');
}
function deleteImport(id){const imp=state.imports.find(i=>i.id===id);if(!imp)return;if(imp.txnIds)state.transactions=state.transactions.filter(t=>!imp.txnIds.includes(t.id));state.imports=state.imports.filter(i=>i.id!==id);saveState();renderImportHistory();updateSidebarStats();renderDashboard();renderTransactions();showToast('Importación eliminada','info');}
function clearAllData(){
  state.transactions=[];
  state.imports=[];
  state.categories=[...DEFAULT_CATS];
  state.income={ars:0,varArs:0,usd:0,varUsd:0};
  state.savingsGoal=20;
  state.alertThreshold=80;
  state.spendPct=100;
  state.cuotas=[];
  state.autoCuotaConfig={};
  state.subscriptions=[];
  state.fixedExpenses=[];
  state.incomeSources=[];
  state.incomeMonths=[];
  state.savAccounts=[];
  state.savGoals=[];
  state.savDeposits=[];
  state.tcConfig={cardName:'',closeDay:0,dueDay:0,limit:0,mixTarget:70};
  state.tcCycles=[];
  state.dashTcCycle=null;
  state.dashView='mes';
  state.dashMonth=null;
  state.catRules=[];
  state.catHistory={};
  state.txnEstadoFilter='all';
  saveState();
  renderImportHistory();
  updateSidebarStats();
  document.getElementById('dash-empty').style.display='block';
  document.getElementById('dash-content').style.display='none';
  showToast('Todos los datos fueron eliminados','info');
}

// ══ CONFIRMACIÓN DE ACCIONES DE GUARDADO ══
const ACCIONES_INFO = {
  backup: {
    titulo: '💾 Descargar Backup',
    descripcion: 'Vas a descargar un archivo <strong>.json</strong> con <strong>todos tus datos</strong>: movimientos, categorías, reglas, ahorros y configuraciones.',
    detalle: 'Guardá este archivo en un lugar seguro. Podés usarlo para restaurar todo si alguna vez borrás el historial del navegador o querés migrar a otro dispositivo.',
    accion: 'Descargar ahora',
    fn: () => { exportBackupJSON(); registrarBackupEnHistorial('manual'); }
  },
  restaurar: {
    titulo: '📂 Restaurar desde Backup',
    descripcion: 'Vas a <strong>reemplazar todos tus datos actuales</strong> con los de un archivo de backup (.json) que generaste antes con esta app.',
    detalle: '⚠️ Esto sobreescribe todo lo que tenés cargado ahora. Si querés conservar los datos actuales, primero hacé un backup.',
    accion: 'Elegir archivo y restaurar',
    danger: false,
    fn: () => document.getElementById('restore-json-input').click()
  },
  csv: {
    titulo: '📊 Exportar a CSV',
    descripcion: 'Vas a descargar todos tus movimientos en formato <strong>.csv</strong>, compatible con Excel, Google Sheets y cualquier planilla de cálculo.',
    detalle: 'El archivo incluye: fecha, descripción, monto, moneda, categoría, medio de pago y estado. Solo se exportan movimientos — no configuraciones ni reglas.',
    accion: 'Descargar CSV',
    fn: () => { exportarCSV(); registrarBackupEnHistorial('csv'); }
  },
  borrar: {
    titulo: '🗑 Borrar todos los datos',
    descripcion: 'Vas a eliminar <strong>permanentemente</strong> todos tus movimientos, categorías, reglas, ahorros y configuraciones del navegador.',
    detalle: '⚠️ Esta acción NO se puede deshacer. Se recomienda hacer un backup antes de continuar.',
    accion: 'Sí, borrar todo',
    danger: true,
    fn: () => clearAllData()
  }
};

function confirmarAccion(tipo) {
  const info = ACCIONES_INFO[tipo];
  if (!info) return;
  let modal = document.getElementById('modal-confirm-accion');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-confirm-accion';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:460px;">
        <div id="mca-titulo" class="modal-title" style="margin-bottom:6px;"></div>
        <div id="mca-desc" class="modal-sub" style="font-size:13px;line-height:1.7;margin-bottom:12px;"></div>
        <div id="mca-detalle" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;font-size:11px;color:var(--text3);font-family:var(--font);line-height:1.7;margin-bottom:22px;"></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="closeModalConfirm()">Cancelar</button>
          <button id="mca-btn-ok" class="btn btn-primary"></button>
        </div>
      </div>`;
    modal.style.display = 'none';
    document.body.appendChild(modal);
  }
  document.getElementById('mca-titulo').innerHTML = info.titulo;
  document.getElementById('mca-desc').innerHTML = info.descripcion;
  document.getElementById('mca-detalle').innerHTML = info.detalle;
  const btnOk = document.getElementById('mca-btn-ok');
  btnOk.textContent = info.accion;
  btnOk.style.background = info.danger ? 'var(--danger)' : '';
  btnOk.onclick = () => { closeModalConfirm(); setTimeout(info.fn, 80); };
  modal.style.display = 'flex';
  _iosLock();
}

function closeModalConfirm() {
  const m = document.getElementById('modal-confirm-accion');
  if (m&&m.style.display!=='none'){m.style.display = 'none';_iosUnlock();}
}

// ══ EXPORTAR CSV ══
function exportarCSV() {
  const txns = state.transactions;
  if (!txns.length) { showToast('Sin movimientos para exportar', 'error'); return; }
  const headers = ['Fecha','Descripción','Comercio','Monto','Moneda','Categoría','Medio de pago','Estado','Origen'];
  const rows = txns.map(t => [
    t.date || '',
    (t.description || '').replace(/"/g,'""'),
    (t.comercio_detectado || '').replace(/"/g,'""'),
    t.amount || 0,
    t.currency || 'ARS',
    (t.category || '').replace(/"/g,'""'),
    (t.method || '').replace(/"/g,'""'),
    t.estado_revision || '',
    t.origen_del_movimiento || ''
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toLocaleDateString('es-AR').replace(/\//g,'-');
  a.href = url; a.download = 'finanzas-movimientos-' + dateStr + '.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('✓ CSV exportado (' + txns.length + ' movimientos)', 'success');
}
