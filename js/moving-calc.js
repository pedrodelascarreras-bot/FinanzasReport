// ══════════════════════════════════════════════════════════════
//  ¿ME PUEDO MUDAR? — Calculadora de mudanza (moving-calc.js)
//  Compara los costos de una propiedad en alquiler contra tus
//  ingresos, ahorros y gastos reales. Motor 100% local.
// ══════════════════════════════════════════════════════════════

window._movingView = null; // 'setup' | 'result'
window._movingLastResult = null;

function movingRate(){
  return (typeof USD_TO_ARS !== 'undefined' && USD_TO_ARS) || state.usdRate || 1420;
}
function movingToUsd(amount, cur){
  const a = Number(amount)||0;
  return cur === 'ARS' ? a/movingRate() : a;
}
function movingFmtUsd(n){ return 'USD ' + fmtN(Math.round(n||0), 0); }
function movingFmtArs(n){ return '$' + fmtN(Math.round(n||0), 0); }
function movingFmtCur(amount, cur){ return cur === 'ARS' ? movingFmtArs(amount) : movingFmtUsd(amount); }

// Datos "de tu lado" — reusa el análisis del Plan de ahorro si está disponible
function movingSelfData(){
  let incomeUsd = null, currentSpendUsd = null, discretionaryUsd = null;
  if(typeof savPlanBuildAnalysis === 'function'){
    try{
      const a = savPlanBuildAnalysis();
      if(a && a.ok){
        incomeUsd = a.incomeUsd;
        currentSpendUsd = a.prev.totalArs / a.rate;   // gasto típico mensual (ciclo anterior)
        discretionaryUsd = a.projDiscUsd;
      }
    }catch(e){ /* sin análisis disponible */ }
  }
  if(incomeUsd == null && typeof savPlanMonthIncomeUsd === 'function') incomeUsd = savPlanMonthIncomeUsd();
  return { incomeUsd, currentSpendUsd, discretionaryUsd };
}

function ensureMovingCalc(){
  if(!state.movingCalc || typeof state.movingCalc !== 'object'){
    const self = movingSelfData();
    state.movingCalc = {
      name: 'Mi propiedad',
      rentCur: 'USD', rent: 900,
      expensas: 150000, expCur: 'ARS',
      servicios: 150000, servCur: 'ARS',
      deposito: 900, comision: 600, otros: 0,
      mueblesTotal: 1500, mueblesCuotas: 18,
      moveInDate: '',
      currentSavings: 1500, monthlySaving: 1200,
      incomeUsd: self.incomeUsd != null ? Math.round(self.incomeUsd) : 2500
    };
  }
  const m = state.movingCalc;
  ['rent','expensas','servicios','deposito','comision','otros','mueblesTotal','mueblesCuotas','currentSavings','monthlySaving','incomeUsd']
    .forEach(k=>{ if(m[k] == null) m[k] = 0; });
  if(!m.rentCur) m.rentCur = 'USD';
  if(!m.expCur) m.expCur = 'ARS';
  if(!m.servCur) m.servCur = 'ARS';
  if(!m.mueblesCuotas) m.mueblesCuotas = 12;
  return m;
}

// Cuántos sueldos-fin-de-mes entran antes de la fecha de mudanza (desde hoy)
function movingPaychecksUntil(moveDateStr){
  if(!moveDateStr) return 0;
  const move = new Date(moveDateStr + 'T00:00:00');
  const now = new Date();
  let count = 0;
  // recorre fin de cada mes desde el actual; cuenta los que caen antes de la mudanza
  let y = now.getFullYear(), mo = now.getMonth();
  for(let i=0;i<36;i++){
    const monthEnd = new Date(y, mo+1, 0, 23, 59, 59); // último día del mes (y,mo)
    if(monthEnd >= now && monthEnd < move) count++;
    if(monthEnd >= move) break;
    mo++; if(mo>11){ mo=0; y++; }
  }
  return count;
}

function movingBuild(){
  const m = ensureMovingCalc();
  const rate = movingRate();
  const self = movingSelfData();

  const rentUsd = movingToUsd(m.rent, m.rentCur);
  const expUsd = movingToUsd(m.expensas, m.expCur);
  const servUsd = movingToUsd(m.servicios, m.servCur);
  const depositoUsd = movingToUsd(m.deposito, m.rentCur);
  const comisionUsd = movingToUsd(m.comision, m.rentCur);
  const otrosUsd = movingToUsd(m.otros, m.rentCur);
  // primer mes por adelantado = un alquiler
  const primerMesUsd = rentUsd;
  const entryUsd = depositoUsd + primerMesUsd + comisionUsd + otrosUsd;

  const mueblesTotalUsd = movingToUsd(m.mueblesTotal, m.rentCur);
  const cuotasN = Math.max(1, Number(m.mueblesCuotas)||1);
  const mueblesCuotaUsd = mueblesTotalUsd / cuotasN;

  const housingUsd = rentUsd + expUsd + servUsd;
  const fixedUsd = housingUsd + mueblesCuotaUsd;

  const incomeUsd = Number(m.incomeUsd) > 0 ? Number(m.incomeUsd) : (self.incomeUsd || 0);
  const remainingUsd = incomeUsd - fixedUsd;
  const pctHousing = incomeUsd > 0 ? Math.round(housingUsd/incomeUsd*100) : 0;

  // Ahorro proyectado a la fecha de mudanza
  const paychecks = movingPaychecksUntil(m.moveInDate);
  const savingsAtMove = Number(m.currentSavings||0) + Number(m.monthlySaving||0) * paychecks;
  const cushion = savingsAtMove - entryUsd;

  // Escenarios de gasto (cuánto sobra por mes)
  const currentSpend = self.currentSpendUsd != null ? self.currentSpendUsd : Math.max(0, incomeUsd*0.6);
  const disc = self.discretionaryUsd != null ? self.discretionaryUsd : currentSpend*0.6;
  const cutB = Math.round(disc*0.35/10)*10;
  const cutC = Math.round(disc*0.65/10)*10;
  const scenarios = [
    { key:'A', name:'Sin cambiar nada', tag:'seguís gastando como hoy', cut:0,
      detail:'Todo igual que ahora — delivery, salidas, kiosco.' },
    { key:'B', name:'Recorte realista', tag:'recortás '+movingFmtUsd(cutB)+', sin sufrir', cut:cutB,
      detail:'Menos delivery y salidas más medidas. Seguís comiendo afuera.' },
    { key:'C', name:'Modo ahorro', tag:'recortás '+movingFmtUsd(cutC)+', apretado', cut:cutC,
      detail:'Delivery casi nulo y pocas salidas. Corte fuerte de gastos chicos.' }
  ].map(s=>{
    const spend = Math.max(0, currentSpend - s.cut);
    const left = remainingUsd - spend;
    return { ...s, spend, left };
  });

  // Veredicto
  const bScen = scenarios[1];
  let verdict;
  if(cushion >= 0 && bScen.left >= 0) verdict = { cls:'ok', em:'🟢', title:'Sí te da', body:'Cubrís la entrada y viviendo ahí te sobra plata con un recorte moderado.' };
  else if(cushion >= 0) verdict = { cls:'warn', em:'🟡', title:'Se puede, pero ajustado', body:'La entrada la cubrís, pero el mes a mes exige recortar bastante para no quedar en rojo.' };
  else verdict = { cls:'bad', em:'🔴', title:'Todavía no te da', body:'Te falta ahorro para la entrada. Mirá la línea de tiempo para saber cuándo llegás.' };

  const result = {
    rate, m, incomeUsd,
    rentUsd, expUsd, servUsd, depositoUsd, primerMesUsd, comisionUsd, otrosUsd, entryUsd,
    mueblesTotalUsd, cuotasN, mueblesCuotaUsd,
    housingUsd, fixedUsd, remainingUsd, pctHousing,
    paychecks, savingsAtMove, cushion,
    scenarios, verdict,
    hasSelf: self.incomeUsd != null
  };
  window._movingLastResult = result;
  return result;
}

// ══════════════════════════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════════════════════════
function movingInitView(){
  ensureMovingCalc();
  if(!window._movingView) window._movingView = 'setup';
}
function renderMovingSection(){
  const mount = document.getElementById('moving-mount');
  if(!mount) return;
  movingInitView();
  const r = movingBuild();
  mount.innerHTML = movingShell(window._movingView==='result' ? movingRenderResult(r) : movingRenderSetup(r));
}

function movingShell(inner){
  return `
  <section class="moving-section">
    <div class="moving-hd">
      <div class="moving-hd-ic">🏠</div>
      <div>
        <h2>¿Me puedo mudar?</h2>
        <p>Cargá los costos de una propiedad y te digo si te da, con tus ingresos y gastos reales</p>
      </div>
    </div>
    ${inner}
  </section>`;
}

function movingCurToggle(field, cur){
  return `<span class="moving-cur-tog">
    <button class="${cur==='USD'?'on':''}" onclick="movingSetCur('${field}','USD')">USD</button>
    <button class="${cur==='ARS'?'on':''}" onclick="movingSetCur('${field}','ARS')">ARS</button>
  </span>`;
}

function movingRenderSetup(r){
  const m = state.movingCalc;
  const self = movingSelfData();
  const incomeHint = self.incomeUsd != null
    ? `Detectado de tus datos: ${movingFmtUsd(self.incomeUsd)}. Podés sobrescribirlo si cambió.`
    : 'Poné tu ingreso mensual en USD.';
  return `
    <div class="moving-card moving-setup">
      <div class="moving-field-full">
        <label class="moving-lbl">Nombre de la propiedad</label>
        <input class="moving-inp" id="mv-name" value="${esc(m.name||'')}" placeholder="ej: Depto Belgrano">
      </div>

      <div class="moving-group-h">🔁 Costos mensuales</div>
      <div class="moving-grid">
        <div class="moving-field"><label class="moving-lbl">Alquiler</label>
          <div class="moving-money"><input class="moving-inp" id="mv-rent" type="number" min="0" value="${m.rent||0}">${movingCurToggle('rentCur',m.rentCur)}</div></div>
        <div class="moving-field"><label class="moving-lbl">Expensas</label>
          <div class="moving-money"><input class="moving-inp" id="mv-exp" type="number" min="0" value="${m.expensas||0}">${movingCurToggle('expCur',m.expCur)}</div></div>
        <div class="moving-field"><label class="moving-lbl">Servicios (luz, gas, agua, internet…)</label>
          <div class="moving-money"><input class="moving-inp" id="mv-serv" type="number" min="0" value="${m.servicios||0}">${movingCurToggle('servCur',m.servCur)}</div></div>
      </div>

      <div class="moving-group-h">💸 Costos de entrada <span class="moving-group-sub">(en la moneda del alquiler)</span></div>
      <div class="moving-grid">
        <div class="moving-field"><label class="moving-lbl">Depósito</label><input class="moving-inp" id="mv-dep" type="number" min="0" value="${m.deposito||0}"></div>
        <div class="moving-field"><label class="moving-lbl">Comisión inmobiliaria</label><input class="moving-inp" id="mv-com" type="number" min="0" value="${m.comision||0}"></div>
        <div class="moving-field"><label class="moving-lbl">Otros (sellado, etc.)</label><input class="moving-inp" id="mv-otros" type="number" min="0" value="${m.otros||0}"></div>
      </div>
      <p class="moving-note">El primer mes por adelantado (= 1 alquiler) lo sumo solo. El flete no está — agregalo en "Otros" si aplica.</p>

      <div class="moving-group-h">🛋️ Muebles en cuotas <span class="moving-group-sub">(opcional)</span></div>
      <div class="moving-grid">
        <div class="moving-field"><label class="moving-lbl">Total en muebles</label>
          <div class="moving-money"><input class="moving-inp" id="mv-mueb" type="number" min="0" value="${m.mueblesTotal||0}"><span class="moving-cur-fixed">${m.rentCur}</span></div></div>
        <div class="moving-field"><label class="moving-lbl">En cuántas cuotas</label><input class="moving-inp" id="mv-cuotas" type="number" min="1" value="${m.mueblesCuotas||12}"></div>
      </div>

      <div class="moving-group-h">📅 Tu situación</div>
      <div class="moving-grid">
        <div class="moving-field"><label class="moving-lbl">Fecha de mudanza (objetivo)</label><input class="moving-inp" id="mv-date" type="date" value="${m.moveInDate||''}"></div>
        <div class="moving-field"><label class="moving-lbl">Ahorro actual (USD)</label><input class="moving-inp" id="mv-sav" type="number" min="0" value="${m.currentSavings||0}"></div>
        <div class="moving-field"><label class="moving-lbl">Cuánto sumás al ahorro por mes (USD)</label><input class="moving-inp" id="mv-msav" type="number" min="0" value="${m.monthlySaving||0}"></div>
      </div>
      <div class="moving-field-full">
        <label class="moving-lbl">Ingreso mensual (USD)</label>
        <input class="moving-inp" id="mv-income" type="number" min="0" value="${m.incomeUsd||0}">
        <p class="moving-note" style="margin-top:6px;">${incomeHint}</p>
      </div>

      <div class="moving-cta">
        <button class="moving-btn primary" onclick="movingCalcNow()">Calcular →</button>
      </div>
    </div>`;
}

function movingRenderResult(r){
  const m = state.movingCalc;
  const dateLabel = m.moveInDate ? new Date(m.moveInDate+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'}) : null;
  const timeline = m.moveInDate ? `
    <div class="moving-tl-note">Ahorrás <b>${movingFmtUsd(m.monthlySaving)}</b>/mes · para el <b>${dateLabel}</b> vas a tener <b>${movingFmtUsd(r.savingsAtMove)}</b> (hoy: ${movingFmtUsd(m.currentSavings)} + ${r.paychecks} sueldo${r.paychecks!==1?'s':''})</div>` : '';

  const scenHtml = r.scenarios.map((s,i)=>{
    const neg = s.left < 0;
    return `
    <div class="moving-scen ${i===1?'win':''}">
      <div class="moving-scen-l">
        <div class="moving-scen-name">${s.key} · ${esc(s.name)}</div>
        <div class="moving-scen-tag">${esc(s.tag)}</div>
        <div class="moving-scen-det">${esc(s.detail)}</div>
      </div>
      <div class="moving-scen-num ${neg?'bad':'good'}">${neg?'− ':'+ '}${movingFmtUsd(Math.abs(s.left))}<small>por mes</small></div>
    </div>`;
  }).join('');

  return `
    <div class="moving-verdict ${r.verdict.cls}">
      <span class="em">${r.verdict.em}</span>
      <div><div class="vt">${esc(m.name)}: ${r.verdict.title}</div><div class="vb">${esc(r.verdict.body)}</div></div>
    </div>

    <div class="moving-two">
      <div class="moving-card moving-block">
        <div class="moving-block-h">La entrada (una sola vez)</div>
        <div class="moving-row"><span>Depósito</span><b>${movingFmtUsd(r.depositoUsd)}</b></div>
        <div class="moving-row"><span>Primer mes adelantado</span><b>${movingFmtUsd(r.primerMesUsd)}</b></div>
        <div class="moving-row"><span>Comisión</span><b>${movingFmtUsd(r.comisionUsd)}</b></div>
        ${r.otrosUsd>0?`<div class="moving-row"><span>Otros</span><b>${movingFmtUsd(r.otrosUsd)}</b></div>`:''}
        <div class="moving-row tot"><span>Total para entrar</span><b>${movingFmtUsd(r.entryUsd)}</b></div>
        <div class="moving-row"><span>Ahorro disponible${m.moveInDate?' a la fecha':''}</span><b class="good">${movingFmtUsd(r.savingsAtMove)}</b></div>
        <div class="moving-row tot"><span>Colchón que te queda</span><b class="${r.cushion>=0?'good':'bad'}">${r.cushion>=0?'':'−'}${movingFmtUsd(Math.abs(r.cushion))}</b></div>
        ${timeline}
      </div>
      <div class="moving-card moving-block">
        <div class="moving-block-h">El mes a mes</div>
        <div class="moving-row"><span>Alquiler</span><b>${movingFmtUsd(r.rentUsd)}</b></div>
        <div class="moving-row"><span>Expensas + servicios</span><b>${movingFmtUsd(r.expUsd+r.servUsd)}</b></div>
        ${r.mueblesCuotaUsd>0?`<div class="moving-row"><span>Cuota muebles (${r.cuotasN})</span><b>${movingFmtUsd(r.mueblesCuotaUsd)}</b></div>`:''}
        <div class="moving-row tot"><span>Gasto fijo total</span><b>${movingFmtUsd(r.fixedUsd)}</b></div>
        <div class="moving-meter"><div style="width:${Math.min(100,r.pctHousing)}%;"></div></div>
        <div class="moving-meter-cap"><b class="${r.pctHousing>35?'warn':'good'}">${r.pctHousing}% de tu ingreso</b> se va en vivienda (lo sano es ≤30%)</div>
      </div>
    </div>

    <div class="moving-card moving-block" style="margin-top:14px;">
      <div class="moving-block-h">Cuánto te sobra por mes, según cuánto recortes</div>
      ${scenHtml}
    </div>

    <div class="moving-cta">
      <button class="moving-btn" onclick="movingBackToSetup()">← Editar datos</button>
      <button class="moving-btn" onclick="movingExportPdf()">⬇ Exportar PDF</button>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
//  INTERACCIONES
// ══════════════════════════════════════════════════════════════
function movingSetCur(field, cur){
  ensureMovingCalc();
  movingSyncFromDOM();
  state.movingCalc[field] = cur;
  saveState();
  renderMovingSection();
}
function movingSyncFromDOM(){
  const m = state.movingCalc; if(!m) return;
  const g = (id)=>document.getElementById(id);
  if(g('mv-name')) m.name = g('mv-name').value.trim() || 'Mi propiedad';
  const num = (id,k)=>{ const el=g(id); if(el) m[k] = Math.max(0, Number(el.value)||0); };
  num('mv-rent','rent'); num('mv-exp','expensas'); num('mv-serv','servicios');
  num('mv-dep','deposito'); num('mv-com','comision'); num('mv-otros','otros');
  num('mv-mueb','mueblesTotal'); num('mv-cuotas','mueblesCuotas');
  num('mv-sav','currentSavings'); num('mv-msav','monthlySaving'); num('mv-income','incomeUsd');
  if(g('mv-date')) m.moveInDate = g('mv-date').value || '';
  if(m.mueblesCuotas < 1) m.mueblesCuotas = 1;
}
function movingCalcNow(){
  ensureMovingCalc();
  movingSyncFromDOM();
  saveState();
  window._movingView = 'result';
  renderMovingSection();
}
function movingBackToSetup(){
  window._movingView = 'setup';
  renderMovingSection();
}

// ── Export PDF (reusa html2canvas + jsPDF) ──
async function movingExportPdf(){
  const r = window._movingLastResult || movingBuild();
  if(!window.html2canvas || !window.jspdf?.jsPDF){ showToast('Faltan librerías de PDF','error'); return; }
  showToast('Generando PDF…','info');
  const shell = document.createElement('div');
  shell.style.cssText = 'position:fixed;left:-20000px;top:0;width:1000px;padding:24px;background:#f4f2fb;z-index:-1;font-family:-apple-system,Segoe UI,Roboto,sans-serif;';
  shell.innerHTML = movingBuildPdfHtml(r);
  document.body.appendChild(shell);
  try{
    const canvas = await window.html2canvas(shell, {scale:2, backgroundColor:'#f4f2fb', logging:false, windowWidth:1040});
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
    link.href = url; link.download = 'mudanza-'+(state.movingCalc.name||'analisis').replace(/[^\w-]+/g,'_')+'.pdf';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
    showToast('✓ PDF descargado','success');
  }catch(err){ console.error(err); showToast('No pude generar el PDF','error'); }
  finally{ shell.remove(); }
}
function movingBuildPdfHtml(r){
  const m = state.movingCalc;
  const row = (k,v,c)=>`<tr><td style="padding:5px 0;color:#585c74;font-size:12px;">${k}</td><td style="padding:5px 0;text-align:right;font-weight:700;font-size:12px;color:${c||'#1c1a25'};">${v}</td></tr>`;
  const scen = r.scenarios.map(s=>{
    const neg = s.left<0;
    return `<tr><td style="padding:8px 0;font-size:12px;"><b>${s.key} · ${esc(s.name)}</b><br><span style="color:#8a8ea6;font-size:11px;">${esc(s.tag)}</span></td>
      <td style="padding:8px 0;text-align:right;font-weight:800;font-size:15px;color:${neg?'#c62b21':'#1c9e60'};">${neg?'− ':'+ '}${movingFmtUsd(Math.abs(s.left))}</td></tr>`;
  }).join('');
  const vColor = r.verdict.cls==='ok'?'#1c9e60':r.verdict.cls==='warn'?'#c26900':'#c62b21';
  return `<div style="background:#fff;border-radius:20px;padding:26px;box-shadow:0 20px 50px rgba(15,23,42,.08);">
    <div style="font-size:20px;font-weight:800;color:#1c1a25;">¿Me puedo mudar? — ${esc(m.name)}</div>
    <div style="font-size:12px;color:#8a8ea6;font-weight:600;margin-bottom:16px;">Análisis con ingresos y gastos reales · TC $${fmtN(r.rate,0)}</div>
    <div style="background:${vColor}1a;border-radius:12px;padding:14px 16px;margin-bottom:18px;">
      <div style="font-size:14px;font-weight:800;color:${vColor};">${r.verdict.em} ${r.verdict.title}</div>
      <div style="font-size:12px;color:#1c1a25;margin-top:3px;">${esc(r.verdict.body)}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;">
      <div style="background:#F5F3FF;border-radius:12px;padding:14px 16px;">
        <div style="font-size:12px;font-weight:800;color:#585c74;margin-bottom:8px;">LA ENTRADA</div>
        <table style="width:100%;">
          ${row('Depósito', movingFmtUsd(r.depositoUsd))}
          ${row('Primer mes adelantado', movingFmtUsd(r.primerMesUsd))}
          ${row('Comisión', movingFmtUsd(r.comisionUsd))}
          ${r.otrosUsd>0?row('Otros', movingFmtUsd(r.otrosUsd)):''}
          ${row('<b>Total para entrar</b>', '<b>'+movingFmtUsd(r.entryUsd)+'</b>')}
          ${row('Ahorro disponible', movingFmtUsd(r.savingsAtMove), '#1c9e60')}
          ${row('<b>Colchón</b>', '<b>'+(r.cushion>=0?'':'−')+movingFmtUsd(Math.abs(r.cushion))+'</b>', r.cushion>=0?'#1c9e60':'#c62b21')}
        </table>
      </div>
      <div style="background:#F5F3FF;border-radius:12px;padding:14px 16px;">
        <div style="font-size:12px;font-weight:800;color:#585c74;margin-bottom:8px;">EL MES A MES</div>
        <table style="width:100%;">
          ${row('Alquiler', movingFmtUsd(r.rentUsd))}
          ${row('Expensas + servicios', movingFmtUsd(r.expUsd+r.servUsd))}
          ${r.mueblesCuotaUsd>0?row('Cuota muebles ('+r.cuotasN+')', movingFmtUsd(r.mueblesCuotaUsd)):''}
          ${row('<b>Gasto fijo total</b>', '<b>'+movingFmtUsd(r.fixedUsd)+'</b>')}
          ${row('Vivienda / ingreso', r.pctHousing+'%', r.pctHousing>35?'#c26900':'#1c9e60')}
        </table>
      </div>
    </div>
    <div style="font-size:14px;font-weight:800;margin-bottom:6px;color:#1c1a25;">Cuánto te sobra por mes</div>
    <table style="width:100%;border-collapse:collapse;">${scen}</table>
  </div>`;
}
