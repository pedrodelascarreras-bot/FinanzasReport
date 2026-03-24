// cc-compare.js
// Lógica para conciliar resúmenes de TC (Santander PDF vs App)

// State
let cccState = {
  pdfTxns: [],
  matches: [], // { pdfTxn, appTxn, status: 'conc', 'diff', 'orphan_pdf', 'orphan_app', 'bank_fee', notes:'' }
  selectedCard: '',
  selectedCycle: ''
};

// DOM Elements
const cccEls = {
  cycleFilter: null, uploadArea: null, fileInput: null,
  loading: null, resultsArea: null, kpiTotal: null, kpiConc: null,
  kpiDiff: null, kpiOrphan: null, tbody: null, linkList: null
};

document.addEventListener('DOMContentLoaded', () => {
  cccEls.cycleFilter = document.getElementById('ccc-cycle-filter');
  cccEls.uploadArea = document.getElementById('ccc-upload-area');
  cccEls.fileInput = document.getElementById('ccc-file-input');
  cccEls.loading = document.getElementById('ccc-loading');
  cccEls.resultsArea = document.getElementById('ccc-results-area');
  cccEls.kpiTotal = document.getElementById('ccc-kpi-total');
  cccEls.kpiConc = document.getElementById('ccc-kpi-conc');
  cccEls.kpiDiff = document.getElementById('ccc-kpi-diff');
  cccEls.kpiOrphan = document.getElementById('ccc-kpi-orphan');
  cccEls.tbody = document.getElementById('ccc-table-body');
  cccEls.linkList = document.getElementById('ccc-link-list');

  if(cccEls.uploadArea) {
    cccEls.uploadArea.addEventListener('click', () => cccEls.fileInput.click());
    cccEls.uploadArea.addEventListener('dragover', e => { e.preventDefault(); cccEls.uploadArea.style.background = 'var(--surface)'; });
    cccEls.uploadArea.addEventListener('dragleave', () => cccEls.uploadArea.style.background = 'transparent');
    cccEls.uploadArea.addEventListener('drop', e => {
      e.preventDefault();
      cccEls.uploadArea.style.background = 'transparent';
      if(e.dataTransfer.files && e.dataTransfer.files[0]) processPdf(e.dataTransfer.files[0]);
    });
    cccEls.fileInput.addEventListener('change', e => {
      if(e.target.files && e.target.files[0]) processPdf(e.target.files[0]);
    });
  }
});

function initCcCompare() {
  if(typeof ccInit === 'function') ccInit();
  
  // Populate filter
  cccEls.cycleFilter = document.getElementById('ccc-cycle-filter'); // re-bind just in case
  if(!cccEls.cycleFilter) return;
  
  const cycles = typeof getTcCycles === 'function' ? getTcCycles() : state.tcCycles;
  if (!cycles || cycles.length === 0) {
    cccEls.cycleFilter.innerHTML = '<option value="">No hay ciclos configurados</option>';
  } else {
    cccEls.cycleFilter.innerHTML = cycles.map(c => `<option value="${c.id}">${esc(c.label)} (Cierre: ${c.closeDate})</option>`).join('');
  }
  
  cccEls.cycleFilter.onchange = () => {
    if(cccState.pdfTxns.length > 0) {
      runMatchingAlgorithm();
      renderCccResults();
    }
  };
}

// ── PDF Processing ──
async function processPdf(file) {
  if(!file.name.toLowerCase().endsWith('.pdf')) { showToast('Por favor subí un archivo PDF','error'); return; }
  cccEls.loading.style.display = 'block';
  cccEls.resultsArea.style.display = 'none';
  cccState.pdfTxns = [];
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    let fullText = '';
    
    // Extract text from all pages
    for(let i=1; i<=pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // Heuristic: group items by Y roughly to form lines
      const items = content.items;
      items.sort((a,b) => {
        if(Math.abs(a.transform[5] - b.transform[5]) < 5) return a.transform[4] - b.transform[4];
        return b.transform[5] - a.transform[5];
      });
      let currentY = -1;
      let line = '';
      for(const item of items) {
        if(currentY === -1 || Math.abs(item.transform[5] - currentY) > 5) {
          if(line) fullText += line.trim() + '\n';
          line = '';
          currentY = item.transform[5];
        }
        line += item.str + ' ';
      }
      if(line) fullText += line.trim() + '\n';
    }
    
    parseSantanderText(fullText);
    runMatchingAlgorithm();
    renderCccResults();
    
    cccEls.loading.style.display = 'none';
    cccEls.resultsArea.style.display = 'block';
  } catch (err) {
    console.error(err);
    cccEls.loading.style.display = 'none';
    showToast('Error procesando el PDF', 'error');
  }
}

function parseSantanderText(text) {
  const lines = text.split('\n');
  const txns = [];

  const MONTHS = {
    ene:1, enero:1, jan:1, feb:2, febrero:2, mar:3, marzo:3,
    abr:4, abril:4, apr:4, may:5, mayo:5, jun:6, junio:6,
    jul:7, julio:7, ago:8, agosto:8, aug:8, sep:9, septiembre:9,
    oct:10, octubre:10, nov:11, noviembre:11, dic:12, diciembre:12
  };

  const parseAmt = (s) => {
    if(!s || s==='-') return 0;
    return parseFloat(s.replace(/\./g,'').replace(',','.')) || 0;
  };

  const isBankFeeLine = (l) =>
    /impuesto de sellos/i.test(l) || /iibb percep/i.test(l) ||
    /iva rg \d/i.test(l) || /db\.rg \d/i.test(l) ||
    /mantenimiento/i.test(l);

  const isPaymentLine = (l) =>
    /su pago en pesos/i.test(l) || /su pago en d[oó]lares/i.test(l);

  // Pattern: "26 Feb 19 0002789842 K[/*] DESCRIPTION [C.N/T] 1.234,56 [20,00]"
  // Supports both Spanish abbreviated months (Feb) and numeric dates (DD/MM fallback)
  const TXN_RE = /^(\d{2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-záéíóú]*\s+(\d{1,2})\s+\d{4,12}\s+[Kk]\/?[*]?\s*(.*?)\s+([\d\.]+,\d{2})(?:\s+([\d\.]+,\d{2}))?$/i;
  // Fallback pattern for old "DD/MM" format
  const OLD_RE = /^(\d{2})\/(\d{2})\s+(.+?)\s+([\d\.]+,\d{2})(?:\s+([\d\.]+,\d{2}))?$/;

  for(let rawLine of lines) {
    const line = rawLine.trim().replace(/\s{2,}/g,' ');
    if(!line) continue;

    // ── Bank fee lines ─────────────────────────────────
    if(isBankFeeLine(line)) {
      const amtM = line.match(/([\d\.]+,\d{2})$/);
      if(amtM) {
        const desc = line.replace(/([\d\.]+,\d{2})$/, '').trim();
        txns.push({
          id: 'pdf_'+Date.now()+Math.random().toString(36).substr(2,5),
          rawDate: null, isoDate: null,
          rawDesc: desc,
          amountARS: parseAmt(amtM[1]),
          amountUSD: 0,
          cuotas: null,
          isBankFee: true,
          isPayment: false
        });
      }
      continue;
    }

    // ── Payment lines ──────────────────────────────────
    if(isPaymentLine(line)) {
      const amtM = line.match(/-?([\d\.]+,\d{2})$/);
      if(amtM) {
        const isUSD = /d[oó]lares/i.test(line);
        txns.push({
          id: 'pdf_'+Date.now()+Math.random().toString(36).substr(2,5),
          rawDate: null, isoDate: null,
          rawDesc: line.replace(/-?([\d\.]+,\d{2})$/, '').trim(),
          amountARS: isUSD ? 0 : parseAmt(amtM[1]),
          amountUSD: isUSD ? parseAmt(amtM[1]) : 0,
          cuotas: null,
          isBankFee: false,
          isPayment: true
        });
      }
      continue;
    }

    // ── New Santander format: YY MON DD comprobante K/ DESCRIPTION amt [usd] ──
    const m = line.match(TXN_RE);
    if(m) {
      const yy = parseInt(m[1]);
      const monStr = m[2].toLowerCase().slice(0,3);
      const dd = parseInt(m[3]);
      let desc = (m[4]||'').trim();
      const amtStr1 = m[5], amtStr2 = m[6];
      const mm = MONTHS[monStr];
      if(!mm) continue;
      const yyyy = 2000 + yy;
      const isoDate = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;

      // Extract cuota notation C.N/T from end of description
      let cuotas = null;
      const cuotaM = desc.match(/\s+C\.(\d+)\/(\d+)$/i);
      if(cuotaM) {
        cuotas = `${cuotaM[1]}/${cuotaM[2]}`;
        desc = desc.replace(/\s+C\.\d+\/\d+$/i,'').trim();
      }

      // Determine ARS vs USD amounts
      let amountARS = parseAmt(amtStr1);
      let amountUSD = amtStr2 ? parseAmt(amtStr2) : 0;

      txns.push({
        id: 'pdf_'+Date.now()+Math.random().toString(36).substr(2,5),
        rawDate: `${String(dd).padStart(2,'0')}/${String(mm).padStart(2,'0')}`,
        isoDate,
        rawDesc: desc,
        amountARS, amountUSD,
        cuotas,
        isBankFee: false,
        isPayment: false
      });
      continue;
    }

    // ── Fallback: old DD/MM format ──────────────────────
    const fo = line.match(OLD_RE);
    if(fo) {
      const dd2 = fo[1], mm2 = fo[2];
      let desc2 = fo[3], amt1 = fo[4], amt2 = fo[5];
      let cuotas2 = null;
      const cM2 = desc2.match(/\s+C\.(\d+)\/(\d+)$/i) || desc2.match(/\s+(\d{2})\/(\d{2})$/);
      if(cM2) { cuotas2 = `${cM2[1]}/${cM2[2]}`; desc2 = desc2.replace(cM2[0],'').trim(); }
      if(desc2.length > 2 && parseAmt(amt1) !== 0) {
        txns.push({
          id: 'pdf_'+Date.now()+Math.random().toString(36).substr(2,5),
          rawDate: `${dd2}/${mm2}`, isoDate: null,
          rawDesc: desc2,
          amountARS: parseAmt(amt1),
          amountUSD: parseAmt(amt2),
          cuotas: cuotas2,
          isBankFee: false,
          isPayment: false
        });
      }
    }
  }

  cccState.pdfTxns = txns;
}

// ── Matching Algorithm ──
function runMatchingAlgorithm() {
  cccState.selectedCycle = cccEls.cycleFilter.value;
  
  const cycles = typeof getTcCycles === 'function' ? getTcCycles() : state.tcCycles;
  const cycle = cycles.find(c => c.id === cccState.selectedCycle);
  if(!cycle) return;
  
  // Get all app transactions belonging to this cycle
  const appTxns = typeof ccGetCycleExpenses === 'function' ? ccGetCycleExpenses(cycle) : [];
  let availableAppTxns = [...appTxns];
  
  cccState.matches = [];
  
  // 1. Pass: Match PDF Txns
  for(const pTxn of cccState.pdfTxns) {
    let bestMatch = null;
    let bestScore = -1;
    let idxToRemove = -1;
    
    // Parse PDF date (DD/MM) assuming current cycle year
    // This is tricky, simplified assumption:
    let pdfDateObj = null;
    if(cycle.closeDate && pTxn.rawDate) {
      let [dd, mm] = pTxn.rawDate.split('/');
      let yyyy = cycle.closeDate.split('-')[0];
      // If month is 12 and close is 01, year is prev year
      if(mm === '12' && cycle.closeDate.split('-')[1] === '01') yyyy = String(Number(yyyy)-1);
      pdfDateObj = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
    }

    for(let i=0; i<availableAppTxns.length; i++) {
       const aTxn = availableAppTxns[i];
       const aDateObj = new Date(aTxn.date + 'T12:00:00');
       const dayDiff = pdfDateObj ? Math.abs((pdfDateObj - aDateObj) / 86400000) : 100;
       
       let arsDiff = Math.abs(pTxn.amountARS - Math.abs(aTxn.currency==='ARS'?aTxn.amount:0));
       let usdDiff = Math.abs(pTxn.amountUSD - Math.abs(aTxn.currency==='USD'?aTxn.amount:0));
       
       // Handle installments matching (if PDF says 3000 ARS, app might correctly be 3000 ARS)
       // Or manual expense which has both ARS and USD
       if(aTxn.amountARS !== undefined) {
          arsDiff = Math.abs(pTxn.amountARS - aTxn.amountARS);
          usdDiff = Math.abs(pTxn.amountUSD - aTxn.amountUSD);
       }

       if(arsDiff < 1 && usdDiff < 1) { // Same amount
          let score = 50;
          if(dayDiff <= 3) score += 30;
          
          // Check text similarity (basic JS includes)
          const pDesc = pTxn.rawDesc.toLowerCase();
          const aDesc = (aTxn.descripcion || aTxn.description).toLowerCase();
          if(pDesc.includes(aDesc.substring(0,5)) || aDesc.includes(pDesc.substring(0,5))) score += 20;
          
          if(score > bestScore) {
            bestScore = score;
            bestMatch = aTxn;
            idxToRemove = i;
          }
       }
    }
    
    if(bestMatch && bestScore >= 50) {
      cccState.matches.push({
        id: 'mat_' + Date.now() + Math.random().toString(36).substr(2,5),
        pdfTxn: pTxn,
        appTxn: bestMatch,
        status: bestScore >= 80 ? 'conc' : 'posible',
        diffARS: 0,
        diffUSD: 0
      });
      availableAppTxns.splice(idxToRemove, 1);
    } else {
      // Check if it's a bank fee automatically
      const isFee = pTxn.rawDesc.toLowerCase().includes('iva') || 
                    pTxn.rawDesc.toLowerCase().includes('mantenimiento') ||
                    pTxn.rawDesc.toLowerCase().includes('impuesto') ||
                    pTxn.rawDesc.toLowerCase().includes('rg 4815');
                    
      cccState.matches.push({
        id: 'mat_' + Date.now() + Math.random().toString(36).substr(2,5),
        pdfTxn: pTxn,
        appTxn: null,
        status: isFee ? 'bank_fee' : 'orphan_pdf',
        diffARS: pTxn.amountARS,
        diffUSD: pTxn.amountUSD
      });
    }
  }
  
  // 2. Pass: Remaining App Txns are orphans
  for(const aTxn of availableAppTxns) {
    const isARS = aTxn.currency === 'ARS' || aTxn.amountARS > 0;
    const isUSD = aTxn.currency === 'USD' || aTxn.amountUSD > 0;
    cccState.matches.push({
        id: 'mat_' + Date.now() + Math.random().toString(36).substr(2,5),
        pdfTxn: null,
        appTxn: aTxn,
        status: 'orphan_app',
        diffARS: -(isARS ? aTxn.amount || aTxn.amountARS : 0),
        diffUSD: -(isUSD ? aTxn.amount || aTxn.amountUSD : 0)
    });
  }
}

// ── Rendering ──
function renderCccResults() {
  let conc = 0, diff = 0, orphan = 0;
  
  const rows = cccState.matches.map(m => {
    if(m.status === 'conc') conc++;
    else if(m.status === 'posible' || m.status === 'diff') diff++;
    else if(m.status === 'orphan_pdf') orphan++;
    
    return `
      <tr style="background:${m.status==='orphan_app'?'var(--danger)10':''}">
        <td>${renderCccStatusBadge(m.status)}</td>
        <td>${m.pdfTxn ? m.pdfTxn.rawDate : '—'}</td>
        <td style="font-weight:${m.pdfTxn?'700':'400'}">${m.pdfTxn ? esc(m.pdfTxn.rawDesc) + (m.pdfTxn.cuotas ? ' <span style="font-size:10px;color:var(--text3)">('+m.pdfTxn.cuotas+')</span>' : '') : '<span style="color:var(--text3)">Ausente en resumen</span>'}</td>
        <td style="text-align:right;">
          ${m.pdfTxn && m.pdfTxn.amountARS ? '<div style="color:var(--accent)">$'+fmtN(m.pdfTxn.amountARS)+'</div>' : ''}
          ${m.pdfTxn && m.pdfTxn.amountUSD ? '<div style="color:var(--accent2)">U$D '+fmtN(m.pdfTxn.amountUSD)+'</div>' : ''}
        </td>
        <td>
          ${m.appTxn ? 
            '<div style="font-size:12px;color:var(--text3)">' + ccFmtDate(m.appTxn.date) + '</div>' + 
            '<div style="font-weight:600">' + esc(m.appTxn.descripcion || m.appTxn.description) + '</div>' 
            : '<span style="color:var(--danger)">Asignar manualmente...</span>'}
        </td>
        <td style="text-align:right;">
           ${m.diffARS ? '<div style="color:var(--danger);font-weight:700">ARS '+fmtN(m.diffARS)+'</div>' : ''}
           ${m.diffUSD ? '<div style="color:var(--danger);font-weight:700">USD '+fmtN(m.diffUSD)+'</div>' : ''}
           ${!m.diffARS && !m.diffUSD ? '—' : ''}
        </td>
        <td style="text-align:center;">
          ${m.status==='orphan_pdf' ? `<button class="btn btn-sm btn-secondary" onclick="cccLinkApp('${m.id}')">Vincular</button><button class="btn btn-sm" style="margin-top:4px;" onclick="cccAddMissing('${m.id}')">Alta</button>` : ''}
          ${m.appTxn && m.pdfTxn ? `<button class="btn btn-sm btn-danger btn-icon" title="Desvincular" onclick="cccUnlink('${m.id}')">✖</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
  
  cccEls.tbody.innerHTML = rows;
  cccEls.kpiTotal.textContent = cccState.pdfTxns.length;
  cccEls.kpiConc.textContent = conc;
  cccEls.kpiDiff.textContent = diff;
  cccEls.kpiOrphan.textContent = orphan;
}

function renderCccStatusBadge(status) {
  const map = {
    'conc': '<span style="background:var(--green-sys)20;color:var(--green-sys);padding:4px 8px;border-radius:12px;font-size:10px;font-weight:700">Conciliado</span>',
    'posible': '<span style="background:var(--warning-sys)20;color:var(--warning-sys);padding:4px 8px;border-radius:12px;font-size:10px;font-weight:700">Revisar</span>',
    'diff': '<span style="background:var(--danger)20;color:var(--danger);padding:4px 8px;border-radius:12px;font-size:10px;font-weight:700">Dif. Monto</span>',
    'orphan_pdf': '<span style="background:var(--danger)20;color:var(--danger);padding:4px 8px;border-radius:12px;font-size:10px;font-weight:700">Falta en App</span>',
    'orphan_app': '<span style="background:var(--danger)20;color:var(--danger);padding:4px 8px;border-radius:12px;font-size:10px;font-weight:700">Falta PDF</span>',
    'bank_fee': '<span style="background:var(--surface3);color:var(--text3);padding:4px 8px;border-radius:12px;font-size:10px;font-weight:700">Impositivo</span>'
  };
  return map[status] || status;
}

// ── Manual Actions ──
function cccUnlink(matchId) {
  const m = cccState.matches.find(x => x.id === matchId);
  if(!m || !m.appTxn || !m.pdfTxn) return;
  
  // Split into two orphans
  const appOrphan = {
    id: 'mat_' + Date.now(), pdfTxn: null, appTxn: m.appTxn, status: 'orphan_app',
    diffARS: -(m.appTxn.amountARS || m.appTxn.amount || 0), diffUSD: -(m.appTxn.amountUSD || 0)
  };
  m.appTxn = null;
  m.status = 'orphan_pdf';
  m.diffARS = m.pdfTxn.amountARS;
  m.diffUSD = m.pdfTxn.amountUSD;
  
  cccState.matches.push(appOrphan);
  renderCccResults();
}

function cccLinkApp(matchId) {
  window._cccLinkingMatchId = matchId;
  const m = cccState.matches.find(x => x.id === matchId);
  if(!m) return;
  
  // Build orphan apps list
  const orphans = cccState.matches.filter(x => x.status === 'orphan_app');
  if(!orphans.length) { showToast('No hay transacciones registradas sueltas', 'info'); return; }
  
  cccEls.linkList.innerHTML = orphans.map(o => {
    return `
      <div style="padding:12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;cursor:pointer;"
           onclick="cccDoLinkApp('${o.id}')">
        <div>
           <div style="font-size:11px;color:var(--text3)">${o.appTxn.date}</div>
           <div style="font-weight:600">${esc(o.appTxn.descripcion || o.appTxn.description)}</div>
        </div>
        <div style="font-weight:700;color:var(--accent)">
           $${fmtN(o.appTxn.amountARS || o.appTxn.amount || 0)}
        </div>
      </div>
    `;
  }).join('');
  openModal('modal-ccc-link');
}

function cccDoLinkApp(orphanAppId) {
  const mPdf = cccState.matches.find(x => x.id === window._cccLinkingMatchId);
  const mApp = cccState.matches.find(x => x.id === orphanAppId);
  if(!mPdf || !mApp) return;
  
  mPdf.appTxn = mApp.appTxn;
  mPdf.status = 'conc';
  mPdf.diffARS = 0; // Simplified
  mPdf.diffUSD = 0;
  
  cccState.matches = cccState.matches.filter(x => x.id !== orphanAppId);
  closeModal('modal-ccc-link');
  renderCccResults();
}

function cccAddMissing(matchId) {
   const m = cccState.matches.find(x => x.id === matchId);
   if(!m || !m.pdfTxn) return;
   
   window._cccAddingMatchId = matchId;
   
   // Pre-fill modal
   const yyyy = cccState.selectedCycle ? state.ccCycles.find(c=>c.id===cccState.selectedCycle)?.closeDate.split('-')[0] : new Date().getFullYear();
   const mm = m.pdfTxn.rawDate.split('/')[1];
   const dd = m.pdfTxn.rawDate.split('/')[0];
   let finalY = yyyy;
   if(mm==='12' && cccState.selectedCycle && state.ccCycles.find(c=>c.id===cccState.selectedCycle)?.closeDate.split('-')[1]==='01') finalY = String(Number(yyyy)-1);
   
   document.getElementById('ccc-add-date').value = `${finalY}-${mm}-${dd}`;
   document.getElementById('ccc-add-desc').value = m.pdfTxn.rawDesc;
   
   // Populate categories
   const catSel = document.getElementById('ccc-add-cat');
   if(catSel) catSel.innerHTML = state.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
   
   document.getElementById('ccc-add-ars').value = m.pdfTxn.amountARS || '';
   document.getElementById('ccc-add-usd').value = m.pdfTxn.amountUSD || '';
   
   openModal('modal-ccc-add-missing');
}

function cccSaveMissingExpense() {
   const matchId = window._cccAddingMatchId;
   const m = cccState.matches.find(x => x.id === matchId);
   if(!m) return;
   
   const date = document.getElementById('ccc-add-date').value;
   const desc = document.getElementById('ccc-add-desc').value.trim();
   const catId = document.getElementById('ccc-add-cat').value;
   const cat = state.categories.find(c=>c.id===catId)?.name || 'Sin clasificar';
   const ars = parseFloat(document.getElementById('ccc-add-ars').value) || 0;
   const usd = parseFloat(document.getElementById('ccc-add-usd').value) || 0;
   
   if(!desc || !date) { showToast('⚠️ Faltan datos', 'error'); return; }
   
   // Inject to ccCycles
   const cycle = state.ccCycles.find(c => c.id === cccState.selectedCycle);
   if(!cycle) return;
   
   if(!cycle.manualExpenses) cycle.manualExpenses = [];
   const newExp = {
     id: 'mce_' + Date.now().toString(36),
     date, description: desc, category: cat, amountARS: ars, amountUSD: usd
   };
   cycle.manualExpenses.push(newExp);
   saveState();
   
   // Automatically link it
   m.appTxn = newExp;
   m.status = 'conc';
   m.diffARS = 0;
   m.diffUSD = 0;
   
   closeModal('modal-ccc-add-missing');
   renderCccResults();
   showToast('Gasto agregado y conciliado', 'success');
}

function cccSaveSession() {
  const cccKey = 'cc_conc_' + cccState.selectedCycle;
  localStorage.setItem(cccKey, JSON.stringify(cccState));
  showToast('Progreso de conciliación guardado', 'success');
}
