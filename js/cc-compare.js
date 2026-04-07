// cc-compare.js
// Lógica para conciliar resúmenes de TC (Santander PDF vs App)

// State
let cccState = {
  pdfTxns: [],
  matches: [],
  selectedCard: '',
  selectedCycle: '',
  pdfSaldoActual: null,
  pdfPeriod: null,    // { open: 'YYYY-MM-DD', close: 'YYYY-MM-DD', vencimiento: 'YYYY-MM-DD' }
  dismissedIds: []    // match IDs dismissed permanently
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
    
    let loadingTask;
    try {
      loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, stopAtErrors: false });
    } catch(e) {
      // Fallback for different pdf.js versions
      loadingTask = pdfjsLib.getDocument(arrayBuffer);
    }
    
    const pdf = await loadingTask.promise;
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
    // Extract the real SALDO ACTUAL from the PDF (last page)
    cccState.pdfSaldoActual = extractSaldoActual(fullText);
    // Extract period dates (open/close/vencimiento)
    cccState.pdfPeriod = extractPeriodDates(fullText);
    if(cccState.pdfPeriod) {
      console.log(`✓ Período PDF: ${cccState.pdfPeriod.open} → ${cccState.pdfPeriod.close}`);
      // Auto-select the cycle whose closeDate matches the PDF close date
      const cycles = typeof getTcCycles === 'function' ? getTcCycles() : (state.tcCycles||[]);
      const el = document.getElementById('ccc-cycle-filter');
      if(el && cycles.length) {
        const matched = cycles.find(c => c.closeDate === cccState.pdfPeriod.close);
        if(matched) {
          el.value = matched.id;
          console.log(`✓ Ciclo auto-seleccionado: ${matched.label}`);
        }
      }
    }
    runMatchingAlgorithm();
    cccSmartMatch(false);
    renderCccResults();
    
    cccEls.loading.style.display = 'none';
    cccEls.resultsArea.style.display = 'block';
  } catch (err) {
    console.error(err);
    cccEls.loading.style.display = 'none';
    showToast('Error procesando el PDF', 'error');
  }
}

function cccSmartMatch(notify=true) {
  let matchedCount = 0;
  cccState.matches.forEach(m => {
    if(m.status === 'posible' || m.status === 'diff') {
      // If it's a high-confidence match already, "confirm" it
      if(m.appTxn && m.pdfTxn) {
        m.status = 'conc';
        matchedCount++;
      }
    }
  });
  if(notify && matchedCount > 0) showToast(`✓ ${matchedCount} vinculaciones automáticas realizadas`,'success');
  else if(notify) showToast('No se encontraron nuevas coincidencias exactas','info');
  if(matchedCount > 0) renderCccResults();
}

function parseSantanderText(text) {
  const lines = text.split('\n');
  const txns = [];

  const MONTHS = {
    ene:1, enero:1, jan:1, feb:2, febrero:2, mar:3, marzo:3,
    abr:4, abril:4, apr:4, may:5, mayo:5, jun:6, junio:6,
    jul:7, julio:7, ago:8, agosto:8, aug:8, sep:9, septiembre:9, set:9,
    oct:10, octubre:10, nov:11, noviembre:11, dic:12, diciembre:12
  };

  // Handles Argentine format: 1.234.567,89 or 1934.112,80 — dots=thousands, comma=decimal, optional trailing dash
  const parseAmt = (s) => {
    if(!s || s==='-') return 0;
    let clean = s.replace(/\./g,'').replace(',','.').replace(/-$/,'');
    return parseFloat(clean) || 0;
  };

  const isBankFeeLine = (l) =>
    /impuesto de sellos/i.test(l) || /iibb percep/i.test(l) ||
    /iva rg \d/i.test(l) || /db\.rg \d/i.test(l) ||
    /mantenimiento/i.test(l) || /percepc/i.test(l);

  const isPaymentLine = (l) =>
    /su pago en pesos/i.test(l) || /su pago en d[oó]lares/i.test(l) ||
    /cancel\.deuda c\/saldo/i.test(l) || /^anulacion de pago/i.test(l);

  const isSkipLine = (l) =>
    /^[-_=]{5,}/.test(l) ||
    /tarjeta \d{4} total consumos/i.test(l) ||
    /^saldo actual/i.test(l) ||
    /^pago minimo/i.test(l) ||
    /^\(.*\)$/.test(l) ||
    /el presente es copia/i.test(l) ||
    /debitaremos de su/i.test(l) ||
    /plan v:/i.test(l) ||
    /cuotas de \$/i.test(l) ||
    /^cuotas a vencer/i.test(l) ||
    /^resumen de cuenta/i.test(l) ||
    /^santander/i.test(l) ||
    /^le recordamos/i.test(l) ||
    /^grupo:/i.test(l) ||
    /^cuenta:/i.test(l) ||
    /^sucursal:/i.test(l) ||
    /^limites:/i.test(l) ||
    /^fecha\s+comprobante/i.test(l) ||
    /^tna\s+\d/i.test(l) ||
    /^prox\.(cierre|vto)/i.test(l) ||
    /^cierre ant\./i.test(l);

  // AMT pattern: Argentine format with optional trailing dash (e.g.: 83.990,00 or 1934.112,80-)
  const A = '([\\d\\.]+,\\d{2}-?)';

  // RE1: YY MONTH DD  COMPROBANTE  [K/*]  DESCRIPTION  ARS  [USD]
  // "26 Enero 29 077079 * MEGATLON MARTINEZ C.02/12 83.990,00"
  const TXN_RE1 = new RegExp(`^(\\d{2})\\s+([a-záéíóúñ]+)\\s+(\\d{1,2})\\s+\\d{4,12}\\s+[Kk*]\\s*(.*?)\\s+${A}(?:\\s+${A})?$`, 'i');

  // RE4: YY MONTH DD  DESCRIPTION  ARS  [USD]  (no comprobante — bank fees already handled, this is for misc)
  const TXN_RE4 = new RegExp(`^(\\d{2})\\s+([a-záéíóúñ]+)\\s+(\\d{1,2})\\s+(.*?)\\s+${A}(?:\\s+${A})?$`, 'i');

  // RE5 (NEW): DD  COMPROBANTE  [K/*]  DESCRIPTION  ARS  [USD]  — continuation line, no year/month prefix
  // "19 700751 K MERPAGO*MARCELOMATIASSCHE 32.097,00"
  const TXN_RE5 = new RegExp(`^(\\d{1,2})\\s+\\d{4,12}\\s+[Kk*]\\s+(.*?)\\s+${A}(?:\\s+${A})?$`, 'i');

  // RE2: DD MONTH DESCRIPTION ARS [USD]
  const TXN_RE2 = new RegExp(`^(\\d{1,2})\\s+([a-záéíóúñ]{3}[a-záéíóúñ]*)\\s+(.*?)\\s+${A}(?:\\s+${A})?$`, 'i');

  // RE3: DD/MM DESCRIPTION ARS [USD]
  const TXN_RE3 = new RegExp(`^(\\d{1,2})\\/(\\d{1,2})\\s+(.*?)\\s+${A}(?:\\s+${A})?$`, 'i');

  let currentHolder = 'Titular';
  // Track running year/month from year+month header lines (for continuation lines)
  let curYear = new Date().getFullYear();
  let curMonth = 1;

  for(let rawLine of lines) {
    const line = rawLine.trim().replace(/\s{2,}/g,' ');
    if(!line || isSkipLine(line)) continue;

    // Holder detection
    const holderM = line.match(/^(TITULAR|ADICIONAL):\s*(.*)/i);
    if(holderM) { currentHolder = holderM[2].trim(); continue; }

    // Bank fees — capture and skip rest of matching
    if(isBankFeeLine(line)) {
      const amtM = line.match(new RegExp(A + '$'));
      if(amtM) {
        const rawDesc = line.replace(new RegExp(A+'$'),'').trim().replace(/\$\s*$/,'').trim();
        txns.push({
          id: 'pdf_'+Date.now()+Math.random().toString(36).substr(2,5),
          rawDate: null, isoDate: null,
          rawDesc,
          amountARS: parseAmt(amtM[1]), amountUSD: 0,
          cuotas: null, isBankFee: true, isPayment: false
        });
      }
      continue;
    }

    // Payments
    if(isPaymentLine(line)) {
      const amtM = line.match(new RegExp(A + '$'));
      if(amtM) {
        const isUSD = /d[oó]lares|DLS/i.test(line);
        txns.push({
          id: 'pdf_'+Date.now()+Math.random().toString(36).substr(2,5),
          rawDate: null, isoDate: null,
          rawDesc: line.replace(new RegExp(A+'$'),'').trim(),
          amountARS: isUSD ? 0 : parseAmt(amtM[1]),
          amountUSD: isUSD ? parseAmt(amtM[1]) : 0,
          cuotas: null, isBankFee: false, isPayment: true
        });
      }
      continue;
    }

    let m;
    let day, month, year, desc, arsStr, usdStr;

    if((m = line.match(TXN_RE1))) {
      // Full line WITH comprobante and year+month
      const monKey = m[2].toLowerCase().slice(0,3);
      if(!MONTHS[monKey]) { console.warn(`Unmatched month "${m[2]}" in: ${line}`); continue; }
      year = 2000 + parseInt(m[1]); month = MONTHS[monKey]; day = parseInt(m[3]);
      curYear = year; curMonth = month;
      desc = m[4]; arsStr = m[5]; usdStr = m[6];
    } else if((m = line.match(TXN_RE5))) {
      // Continuation line WITH comprobante, NO year+month — uses last seen year/month
      year = curYear; month = curMonth; day = parseInt(m[1]);
      desc = m[2]; arsStr = m[3]; usdStr = m[4];
    } else if((m = line.match(TXN_RE4))) {
      // Full line WITHOUT comprobante, WITH year+month
      const monKey = m[2].toLowerCase().slice(0,3);
      if(!MONTHS[monKey]) { console.warn(`Unmatched month "${m[2]}" in: ${line}`); continue; }
      year = 2000 + parseInt(m[1]); month = MONTHS[monKey]; day = parseInt(m[3]);
      curYear = year; curMonth = month;
      desc = m[4]; arsStr = m[5]; usdStr = m[6];
    } else if((m = line.match(TXN_RE2))) {
      const monKey = m[2].toLowerCase().slice(0,3);
      if(MONTHS[monKey]) {
        year = curYear; month = MONTHS[monKey]; day = parseInt(m[1]);
        desc = m[3]; arsStr = m[4]; usdStr = m[5];
      } else { console.warn(`Unmatched line (RE2): ${line}`); continue; }
    } else if((m = line.match(TXN_RE3))) {
      year = curYear; day = parseInt(m[1]); month = parseInt(m[2]);
      desc = m[3]; arsStr = m[4]; usdStr = m[5];
    } else {
      console.warn(`Unmatched line: ${line}`);
      continue;
    }

    if(day && month && desc && arsStr) {
      const isoDate = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      desc = desc.trim().replace(/\$\s*$/,'').trim();

      // Extract cuota notation C.N/T from end of description
      let cuotas = null;
      const cuotaM = desc.match(/\s+C\.(\d+)\/(\d+)$/i);
      if(cuotaM) {
        cuotas = `${cuotaM[1]}/${cuotaM[2]}`;
        desc = desc.replace(/\s+C\.\d+\/\d+$/i,'').trim();
      }

      // If description ends with "USD XX,XX" strip it out — it's the USD note in the merchant name
      // and the ARS column is actually 0 (the arsStr value IS the USD value in disguise)
      let amountARS = parseAmt(arsStr);
      let amountUSD = usdStr ? parseAmt(usdStr) : 0;
      const usdInDesc = desc.match(/\s+USD\s+([\d.]+,\d{2})$/i);
      if(usdInDesc && !usdStr) {
        // ARS column was empty; arsStr holds the USD amount, description had "USD XX,XX"
        amountUSD = parseAmt(usdInDesc[1]);
        amountARS = 0;
        desc = desc.replace(/\s+USD\s+[\d.]+,\d{2}$/i,'').trim();
      }

      txns.push({
        id: 'pdf_'+Date.now()+Math.random().toString(36).substr(2,5),
        rawDate: `${day} ${month}`, isoDate,
        rawDesc: desc,
        amountARS,
        amountUSD,
        cuotas, isBankFee: false, isPayment: false,
        holder: currentHolder
      });
      console.log(`✓ Parsed: ${isoDate} | ${desc} | ARS ${arsStr}${usdStr?' | USD '+usdStr:''}`);
    } else {
      console.warn(`Unmatched line: ${line}`);
    }
  }

  cccState.pdfTxns = txns;
  console.log(`Finished parsing. Found ${txns.length} transactions.`);
  if(txns.length === 0) {
    throw new Error('No se detectaron transacciones en el formato esperado. Verificá que sea un resumen de Santander.');
  }
}

// ── Extract real SALDO ACTUAL from Santander PDF text ──
function extractSaldoActual(text) {
  const parseArgAmt = (s) => {
    if(!s) return 0;
    return parseFloat(s.replace(/\./g,'').replace(',','.').replace(/-$/,'')) || 0;
  };

  // Last page format: "SALDO ACTUAL $1928.358,40 U $ S 391,18"
  // Also: "SALDO ACTUAL $1928.358,40 U$S 391,18"
  let m = text.match(/SALDO ACTUAL\s*\$?\s*([\d.]+,\d{2})\s*U[\s$]*S\s*([\d.]+,\d{2})/i);
  if(m) return { ars: parseArgAmt(m[1]), usd: parseArgAmt(m[2]) };

  // Only ARS: "SALDO ACTUAL $1928.358,40"
  m = text.match(/SALDO ACTUAL\s*\$?\s*([\d.]+,\d{2})/i);
  if(m) return { ars: parseArgAmt(m[1]), usd: 0 };

  // DEBITAREMOS format (page 11): "LA SUMA DE $ 1928358,40 + U$S 391,18"
  m = text.match(/LA SUMA DE\s*\$\s*([\d.]+,\d{2})\s*\+\s*U\$S\s*([\d.]+,\d{2})/i);
  if(m) return { ars: parseArgAmt(m[1]), usd: parseArgAmt(m[2]) };

  return null;
}

// ── Extract statement period dates from Santander PDF ──
function extractPeriodDates(text) {
  const MESES = {
    ene:1,enero:1, feb:2,febrero:2, mar:3,marzo:3, abr:4,abril:4,
    may:5,mayo:5, jun:6,junio:6, jul:7,julio:7, ago:8,agosto:8,
    sep:9,septiembre:9,set:9, oct:10,octubre:10, nov:11,noviembre:11,
    dic:12,diciembre:12
  };
  const parseDate = (d,m,y) => {
    const mon = MESES[m.toLowerCase().slice(0,3)];
    if(!mon) return null;
    const yr = y.length===2 ? 2000+parseInt(y) : parseInt(y);
    return `${yr}-${String(mon).padStart(2,'0')}-${String(parseInt(d)).padStart(2,'0')}`;
  };
  // "CIERRE  19 Mar 26  VENCIMIENTO 06 Abr 26"
  const closeM = text.match(/CIERRE\s+(\d{1,2})\s+([A-Za-záéíóúñ]+)\s+(\d{2,4})/i);
  const vtoM   = text.match(/VENCIMIENTO\s+(\d{1,2})\s+([A-Za-záéíóúñ]+)\s+(\d{2,4})/i);
  // "Cierre Ant.: 19 Feb 26"
  const prevM  = text.match(/Cierre\s+Ant\.\s*:\s*(\d{1,2})\s+([A-Za-záéíóúñ]+)\s+(\d{2,4})/i);

  const close = closeM ? parseDate(closeM[1], closeM[2], closeM[3]) : null;
  const vto   = vtoM   ? parseDate(vtoM[1],   vtoM[2],   vtoM[3])   : null;
  const open  = prevM  ? parseDate(prevM[1],  prevM[2],  prevM[3])  : null;

  if(!close) return null;
  return { open, close, vencimiento: vto };
}

// ── Matching Algorithm ──
function runMatchingAlgorithm() {
  // Defensive: re-bind filter in case DOMContentLoaded ran before element existed
  if(!cccEls.cycleFilter) cccEls.cycleFilter = document.getElementById('ccc-cycle-filter');
  cccState.selectedCycle = cccEls.cycleFilter ? cccEls.cycleFilter.value : '';

  const cycles = typeof getTcCycles === 'function' ? getTcCycles() : (state.tcCycles||[]);
  const cycle = cycles.find(c => c.id === cccState.selectedCycle);
  if(!cycle) return;
  
  // Use the active card (VISA or AMEX) so we only compare expenses from that card
  const activeCardId = state.ccActiveCard || state.ccCards?.[0]?.id || cycle.cardId;
  // Get app transactions for this cycle, filtered by PDF period if available
  const allAppTxns = typeof ccGetCycleExpenses === 'function' ? ccGetCycleExpenses(activeCardId, cycle.id) : [];
  // If we have PDF period dates, only match txns within that period
  let availableAppTxns;
  if(cccState.pdfPeriod && cccState.pdfPeriod.open && cccState.pdfPeriod.close) {
    const pOpen = cccState.pdfPeriod.open;
    const pClose = cccState.pdfPeriod.close;
    availableAppTxns = allAppTxns.filter(t => {
      const d = t.date ? t.date.slice(0,10) : '';
      return d >= pOpen && d <= pClose;
    });
  } else {
    availableAppTxns = [...allAppTxns];
  }
  
  cccState.matches = [];
  
  // 1. Pass: Match PDF Txns
  for(const pTxn of cccState.pdfTxns) {
    let bestMatch = null;
    let bestScore = -1;
    let idxToRemove = -1;
    
    // Parse PDF date
    let pdfDateObj = null;
    if(pTxn.isoDate) {
      pdfDateObj = new Date(pTxn.isoDate + 'T12:00:00');
    } else if(cycle.closeDate && pTxn.rawDate) {
      let [dd, mm] = pTxn.rawDate.split('/');
      let yyyy = cycle.closeDate.split('-')[0];
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
          if(dayDiff <= 3) score += 40;
          
          // Check text similarity
          const pDesc = pTxn.rawDesc.toLowerCase();
          const aDesc = (aTxn.descripcion || aTxn.description || '').toLowerCase();
          // Splitting into words for better fuzzy match
          const pWords = pDesc.split(/\s+/).filter(w => w.length > 3);
          const aWords = aDesc.split(/\s+/).filter(w => w.length > 3);
          const matchCount = pWords.filter(pw => aWords.some(aw => aw.includes(pw) || pw.includes(aw))).length;
          
          if(matchCount > 0) score += 20 + (matchCount * 5);
          
          if(score > bestScore) {
            bestScore = score;
            bestMatch = aTxn;
            idxToRemove = i;
          }
        }
    }
    
    // 2. Pass: If no exact amount match, try fuzzy amount (for rounding or discrepancies)
    if(!bestMatch) {
       for(let i=0; i<availableAppTxns.length; i++) {
          const aTxn = availableAppTxns[i];
          const aDateObj = new Date(aTxn.date + 'T12:00:00');
          const dayDiff = pdfDateObj ? Math.abs((pdfDateObj - aDateObj) / 86400000) : 100;
          
          if(dayDiff > 7) continue;

          let arsDiff = Math.abs(pTxn.amountARS - Math.abs(aTxn.currency==='ARS'?aTxn.amount:0));
          if(aTxn.amountARS !== undefined) arsDiff = Math.abs(pTxn.amountARS - aTxn.amountARS);

          // If difference is small (e.g. < 50 pesos) or percentage is small
          if(arsDiff > 0 && arsDiff < 50) { 
             const pDesc = pTxn.rawDesc.toLowerCase();
             const aDesc = (aTxn.descripcion || aTxn.description || '').toLowerCase();
             if(pDesc.includes(aDesc.substring(0,6)) || aDesc.includes(pDesc.substring(0,6))) {
                bestMatch = aTxn;
                bestScore = 60; // Flag as "posible"
                idxToRemove = i;
                break;
             }
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
      cccState.matches.push({
        id: 'mat_' + Date.now() + Math.random().toString(36).substr(2,5),
        pdfTxn: pTxn,
        appTxn: null,
        status: pTxn.isBankFee ? 'bank_fee' : 'orphan_pdf',
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

function renderCccResults() {
  // Separate bank fees from regular transactions
  const bankFees = cccState.matches.filter(m => m.status === 'bank_fee' || m.pdfTxn?.isBankFee);
  const regular  = cccState.matches.filter(m => m.status !== 'bank_fee' && !m.pdfTxn?.isBankFee);

  let totalAppARS = 0, totalAppUSD = 0;
  let pendCount = 0, concCount = 0;

  regular.forEach(m => {
    if(['orphan_pdf','orphan_app','diff','posible'].includes(m.status)) pendCount++;
    else if(m.status === 'conc') concCount++;
    if(m.appTxn) {
      totalAppARS += m.appTxn.amountARS || (m.appTxn.currency==='ARS'?m.appTxn.amount:0) || 0;
      totalAppUSD += m.appTxn.amountUSD || (m.appTxn.currency==='USD'?m.appTxn.amount:0) || 0;
    }
  });

  const heroARS = cccState.pdfSaldoActual ? cccState.pdfSaldoActual.ars : 0;
  const heroUSD = cccState.pdfSaldoActual ? cccState.pdfSaldoActual.usd : 0;
  const diffARS = heroARS - totalAppARS;
  const diffUSD = heroUSD - totalAppUSD;
  const isBalanced = Math.abs(diffARS) < 1 && Math.abs(diffUSD) < 0.01;

  // Period info bar
  let periodHtml = '';
  if(cccState.pdfPeriod) {
    const fmtPD = s => s ? new Date(s+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    periodHtml = `<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:rgba(var(--accent-rgb,52,199,89),0.07);border:1px solid rgba(52,199,89,0.2);border-radius:12px;margin-bottom:20px;flex-wrap:wrap;">
      <span style="font-size:20px;">📄</span>
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);">Período del resumen</div>
        <div style="font-size:13px;font-weight:700;color:var(--text);">${fmtPD(cccState.pdfPeriod.open)} → ${fmtPD(cccState.pdfPeriod.close)}</div>
      </div>
      ${cccState.pdfPeriod.vencimiento ? `<div style="margin-left:auto;text-align:right;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);">Vencimiento</div><div style="font-size:13px;font-weight:700;color:var(--orange);">${fmtPD(cccState.pdfPeriod.vencimiento)}</div></div>` : ''}
    </div>`;
  }

  // Groups
  const groups = {
    pending: regular.filter(m => ['orphan_pdf','orphan_app','diff','posible'].includes(m.status)),
    conc:    regular.filter(m => m.status === 'conc'),
    excl:    regular.filter(m => m.status === 'excluded')
  };

  const allResolved = groups.pending.length === 0;

  cccEls.resultsArea.innerHTML = `
    ${periodHtml}
    <!-- Hero -->
    <div class="ccc-summary-hero fade-up" id="ccc-hero-widget">
      <div class="ccc-stat-item">
        <div class="ccc-stat-label">Saldo Actual (PDF)</div>
        <div class="ccc-stat-val">$${fmtN(Math.round(heroARS))}</div>
        ${heroUSD > 0 ? `<div style="font-size:12px;font-weight:600;color:var(--accent2);margin-top:2px;">+ U$S ${fmtN(heroUSD)}</div>` : ''}
      </div>
      <div class="ccc-stat-item">
        <div class="ccc-stat-label">Registrado en App</div>
        <div class="ccc-stat-val">$${fmtN(Math.round(totalAppARS))}</div>
        ${totalAppUSD > 0 ? `<div style="font-size:12px;font-weight:600;color:var(--accent2);margin-top:2px;">U$S ${fmtN(totalAppUSD)}</div>` : ''}
      </div>
      <div class="ccc-stat-item">
        <div class="ccc-stat-label">Gap ARS</div>
        <div class="ccc-stat-val ${Math.abs(diffARS) > 1 ? 'diff' : 'match'}">${diffARS > 0 ? '+' : ''}$${fmtN(Math.round(diffARS))}</div>
      </div>
      ${Math.abs(diffUSD) > 0.01 ? `<div class="ccc-stat-item">
        <div class="ccc-stat-label">Gap USD</div>
        <div class="ccc-stat-val diff">${diffUSD > 0 ? '+' : ''}U$S ${fmtN(Math.abs(diffUSD))}</div>
      </div>` : ''}
    </div>

    <!-- Controls -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:12px;flex-wrap:wrap;">
      <div style="font-size:14px;font-weight:700;color:var(--text2);">Conciliación · <span style="color:var(--text3);font-weight:500;font-size:12px;">${concCount} OK · ${pendCount} pendientes · ${bankFees.length} cargos bancarios</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-accent" onclick="cccSmartMatch()"><span style="margin-right:4px;">✨</span>Auto-match</button>
        <button class="btn btn-sm btn-secondary" onclick="cccSaveSession()">💾 Guardar</button>
        ${allResolved ? `<button class="btn btn-sm" style="background:linear-gradient(135deg,#00c853,#00e676);color:#fff;font-weight:700;border:none;" onclick="cccMarkReviewed()">✓ Marcar pagado y cerrar</button>` : ''}
      </div>
    </div>

    <div id="ccc-matching-container">
      ${renderGroup('Pendientes', groups.pending, '¡Todo conciliado! No hay diferencias pendientes.')}
      ${renderBankFeeGroup(bankFees)}
      ${renderGroup('Conciliados', groups.conc, 'Nada conciliado aún.')}
      ${groups.excl.length ? renderGroup('Descartados', groups.excl, '') : ''}
    </div>
  `;
}

function cccUpdateHero() {
  // Partial re-render of just the hero widget (called after adds/changes)
  const regular = cccState.matches.filter(m => m.status !== 'bank_fee' && !m.pdfTxn?.isBankFee);
  let totalAppARS = 0, totalAppUSD = 0;
  regular.forEach(m => {
    if(m.appTxn) {
      totalAppARS += m.appTxn.amountARS || (m.appTxn.currency==='ARS'?m.appTxn.amount:0) || 0;
      totalAppUSD += m.appTxn.amountUSD || (m.appTxn.currency==='USD'?m.appTxn.amount:0) || 0;
    }
  });
  const heroARS = cccState.pdfSaldoActual ? cccState.pdfSaldoActual.ars : 0;
  const heroUSD = cccState.pdfSaldoActual ? cccState.pdfSaldoActual.usd : 0;
  const diffARS = heroARS - totalAppARS;
  const diffUSD = heroUSD - totalAppUSD;
  const el = document.getElementById('ccc-hero-widget');
  if(!el) return;
  el.innerHTML = `
    <div class="ccc-stat-item">
      <div class="ccc-stat-label">Saldo Actual (PDF)</div>
      <div class="ccc-stat-val">$${fmtN(Math.round(heroARS))}</div>
      ${heroUSD > 0 ? `<div style="font-size:12px;font-weight:600;color:var(--accent2);margin-top:2px;">+ U$S ${fmtN(heroUSD)}</div>` : ''}
    </div>
    <div class="ccc-stat-item">
      <div class="ccc-stat-label">Registrado en App</div>
      <div class="ccc-stat-val">$${fmtN(Math.round(totalAppARS))}</div>
      ${totalAppUSD > 0 ? `<div style="font-size:12px;font-weight:600;color:var(--accent2);margin-top:2px;">U$S ${fmtN(totalAppUSD)}</div>` : ''}
    </div>
    <div class="ccc-stat-item">
      <div class="ccc-stat-label">Gap ARS</div>
      <div class="ccc-stat-val ${Math.abs(diffARS) > 1 ? 'diff' : 'match'}">${diffARS > 0 ? '+' : ''}$${fmtN(Math.round(diffARS))}</div>
    </div>
    ${Math.abs(diffUSD) > 0.01 ? `<div class="ccc-stat-item"><div class="ccc-stat-label">Gap USD</div><div class="ccc-stat-val diff">${diffUSD > 0 ? '+' : ''}U$S ${fmtN(Math.abs(diffUSD))}</div></div>` : ''}
  `;
}

function renderGroup(title, list, emptyMsg) {
  const iconMap = { 'Pendientes': '⏳', 'Conciliados': '✅', 'Descartados': '🚫' };
  const collapsible = title !== 'Pendientes';
  const bodyId = 'ccc-grp-' + title.toLowerCase().replace(/\s/g,'_');
  return `
    <div class="ccc-group-header" ${collapsible ? `onclick="this.nextElementSibling.classList.toggle('collapsed')"` : ''} style="${collapsible?'cursor:pointer;':''}" >
      <span class="ccc-group-title">${iconMap[title] || ''} ${title} <span class="ccc-group-count">${list.length}</span></span>
      ${collapsible ? '<span style="font-size:12px;color:var(--text3);margin-left:auto;">▾</span>' : ''}
    </div>
    <div class="ccc-row-list ${collapsible&&list.length?'':''}">
      ${list.length ? list.map(m => renderCccRow(m)).join('') : `<div class="ccc-empty-notice">${emptyMsg}</div>`}
    </div>
  `;
}

function renderBankFeeGroup(fees) {
  if(!fees.length) return '';
  const pendingFees = fees.filter(m => !m.appTxn);
  const addedFees   = fees.filter(m =>  m.appTxn);
  return `
    <div class="ccc-group-header" onclick="this.nextElementSibling.classList.toggle('collapsed')" style="cursor:pointer;">
      <span class="ccc-group-title">🏦 Cargos del Banco <span class="ccc-group-count">${fees.length}</span></span>
      ${pendingFees.length ? `<span style="font-size:10px;font-weight:700;color:var(--orange);background:rgba(255,149,0,0.12);padding:2px 7px;border-radius:20px;margin-left:6px;">${pendingFees.length} sin agregar</span>` : ''}
      <span style="font-size:12px;color:var(--text3);margin-left:auto;">▾</span>
    </div>
    <div class="ccc-row-list">
      ${fees.map(m => renderBankFeeRow(m)).join('')}
    </div>
  `;
}

function renderBankFeeRow(m) {
  const added = !!m.appTxn;
  return `<div class="ccc-row fee ${added?'match':''}" id="${m.id}" style="opacity:${added?0.6:1};">
    <div class="ccc-row-side" style="flex:1;">
      <div class="ccc-row-label">Cargo bancario</div>
      <div class="ccc-row-desc">${esc(m.pdfTxn.rawDesc)}</div>
    </div>
    <div style="text-align:right;min-width:90px;">
      <div class="ccc-row-amt ars">$${fmtN(Math.round(m.pdfTxn.amountARS||0))}</div>
      ${m.pdfTxn.amountUSD ? `<div class="ccc-row-amt usd">U$D ${fmtN(m.pdfTxn.amountUSD)}</div>` : ''}
    </div>
    <div class="ccc-row-actions">
      ${added
        ? `<span style="font-size:11px;font-weight:600;color:var(--green-sys);">✓ Agregado</span>`
        : `<button class="ccc-row-btn primary" onclick="cccAddBankFee('${m.id}')">+ Agregar a App</button>
           <button class="ccc-row-btn" style="color:var(--text3);" onclick="cccDismissPending('${m.id}')" title="Descartar">✕</button>`
      }
    </div>
  </div>`;
}

function renderCccRow(m) {
  const isMatch  = m.status === 'conc';
  const isMissing= m.status === 'orphan_pdf';
  const isExtra  = m.status === 'orphan_app';
  const isDiff   = m.status === 'diff';
  const isPosible= m.status === 'posible';
  const isExcluded = m.status === 'excluded';

  let rowClass = 'match';
  if(isMissing)  rowClass = 'missing';
  if(isExtra)    rowClass = 'extra';
  if(isDiff)     rowClass = 'diff';
  if(isPosible)  rowClass = 'diff';
  if(isExcluded) rowClass = 'excluded';

  // Format ISO date nicely
  const fmtISO = s => s ? new Date(s+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short'}) : '—';

  const actions = [];
  if(isMissing) {
    actions.push(`<button class="ccc-row-btn primary" onclick="cccAddMissing('${m.id}')">+ Agregar</button>`);
    actions.push(`<button class="ccc-row-btn" onclick="cccLinkApp('${m.id}')">Vincular</button>`);
    actions.push(`<button class="ccc-row-btn dismiss" onclick="cccDismissPending('${m.id}')" title="Descartar permanentemente">✕</button>`);
  } else if(isExtra) {
    actions.push(`<button class="ccc-row-btn dismiss" onclick="cccDismissPending('${m.id}')" title="Descartar">✕</button>`);
  } else if(isPosible) {
    actions.push(`<button class="ccc-row-btn success" onclick="cccConfirmPosible('${m.id}')">✓ Confirmar</button>`);
    actions.push(`<button class="ccc-row-btn danger" onclick="cccUnlink('${m.id}')">Separar</button>`);
  } else if(isDiff) {
    actions.push(`<button class="ccc-row-btn primary" onclick="cccEditAppTxn('${m.id}')">Ajustar</button>`);
    actions.push(`<button class="ccc-row-btn danger" onclick="cccUnlink('${m.id}')">Separar</button>`);
  } else if(isMatch) {
    actions.push(`<button class="ccc-row-btn dismiss" title="Desvincular" onclick="cccUnlink('${m.id}')">✕</button>`);
  }

  const middleIcon = isMatch ? '🔗' : isPosible ? '❓' : isDiff ? '⚠️' : isExcluded ? '🚫' : '—';

  return `
    <div class="ccc-row ${rowClass} fade-up" id="${m.id}">
      <!-- PDF SIDE -->
      <div class="ccc-row-side">
        <div class="ccc-row-label">PDF</div>
        ${m.pdfTxn ? `
          <div class="ccc-row-desc">${esc(m.pdfTxn.rawDesc)}</div>
          <div class="ccc-row-date">${fmtISO(m.pdfTxn.isoDate)}${m.pdfTxn.cuotas ? ' · <span style="color:var(--accent3);font-weight:700;">C.'+m.pdfTxn.cuotas+'</span>' : ''}</div>
        ` : '<div class="ccc-row-desc" style="color:var(--text3);font-style:italic;">— No presente —</div>'}
      </div>

      <!-- MIDDLE -->
      <div class="ccc-row-middle">${middleIcon}</div>

      <!-- APP SIDE -->
      <div class="ccc-row-side">
        <div class="ccc-row-label">App</div>
        ${m.appTxn ? `
          <div class="ccc-row-desc">${esc(m.appTxn.descripcion || m.appTxn.description || '—')}</div>
          <div class="ccc-row-date">${ccFmtDate(m.appTxn.date)}</div>
        ` : '<div class="ccc-row-desc" style="color:var(--text3);font-style:italic;">— Pendiente —</div>'}
      </div>

      <!-- AMOUNT -->
      <div style="text-align:right;min-width:90px;">
        ${m.pdfTxn ? `
          <div class="ccc-row-amt ars">${m.pdfTxn.amountARS > 0 ? '$'+fmtN(Math.round(m.pdfTxn.amountARS)) : ''}</div>
          ${m.pdfTxn.amountUSD > 0 ? `<div class="ccc-row-amt usd">U$S ${fmtN(m.pdfTxn.amountUSD)}</div>` : ''}
        ` : `
          <div class="ccc-row-amt ars">$${fmtN(Math.round(m.appTxn?.amountARS || m.appTxn?.amount || 0))}</div>
        `}
      </div>

      <!-- ACTIONS -->
      <div class="ccc-row-actions">${actions.join('')}</div>
    </div>
  `;
}

function renderCccStatusBadge(status) {
  const map = {
    'conc': '<span class="ccc-badge conc">CONCILIADO</span>',
    'posible': '<span class="ccc-badge possible">REVISAR</span>',
    'diff': '<span class="ccc-badge diff">DIFERENCIA</span>',
    'orphan_pdf': '<span class="ccc-badge missing">FALTA EN APP</span>',
    'orphan_app': '<span class="ccc-badge extra">FALTA EN PDF</span>',
    'bank_fee': '<span class="ccc-badge fee">IMPUESTO</span>',
    'excluded': '<span class="ccc-badge excluded">EXCLUIDO</span>'
  };
  return map[status] || status;
}

// ── Discrepancy Resolution ──
function cccEditAppTxn(matchId) {
  const m = cccState.matches.find(x => x.id === matchId);
  if(!m || !m.appTxn) return;
  
  const a = m.appTxn;
  const currAmt = a.amountARS || a.amount || 0;
  const newAmt = prompt(`Editar monto para "${a.descripcion || a.description}"\n\nMonto actual: ${currAmt}\nNuevo monto ARS:`, currAmt);
  if (newAmt === null) return;
  
  const val = parseFloat(newAmt);
  if (isNaN(val)) { showToast('Monto inválido','error'); return; }
  
  // 1. Check if it's a manual expense in the cycle
  const cycle = state.ccCycles.find(c => c.id === cccState.selectedCycle);
  if(cycle && cycle.manualExpenses) {
    const manualExp = cycle.manualExpenses.find(e => e.id === a.id);
    if (manualExp) {
      manualExp.amountARS = val;
      saveState();
      runMatchingAlgorithm();
      renderCccResults();
      showToast('✓ Gasto manual actualizado','success');
      return;
    }
  }
  
  // 2. Check if it's a general transaction
  if (state.transactions) {
    const txn = state.transactions.find(t => t.id === a.id);
    if (txn) {
       txn.amount = val;
       saveState();
       runMatchingAlgorithm();
       renderCccResults();
       showToast('✓ Transacción institucional actualizada','success');
       return;
    }
  }
  
  showToast('No se puede editar este gasto (puede ser un gasto automático o cuota)','info');
}

function cccImportAllFees() {
  const fees = cccState.matches.filter(m => m.status === 'bank_fee' && !m.appTxn);
  if (!fees.length) { showToast('No hay impuestos pendientes de importar','info'); return; }

  if (!confirm(`¿Importar ${fees.length} cargos impositivos del PDF a la App?`)) return;

  // BUG FIX: find by tcCycleId and create entry if missing
  if(!state.ccCycles) state.ccCycles = [];
  let cycle = state.ccCycles.find(c => c.tcCycleId === cccState.selectedCycle);
  if(!cycle) {
    const tcCycles = typeof getTcCycles === 'function' ? getTcCycles() : [];
    const tcCycle = tcCycles.find(c => c.id === cccState.selectedCycle);
    if(!tcCycle) { showToast('Ciclo no encontrado','error'); return; }
    const cardId = state.ccActiveCard || state.ccCards?.[0]?.id || '';
    cycle = {
      id: tcCycle.id + '_' + cardId,
      cardId, tcCycleId: tcCycle.id,
      closeDate: tcCycle.closeDate || null,
      status: 'pending', manualExpenses: [], excludedIds: []
    };
    state.ccCycles.push(cycle);
  }
  if(!cycle.manualExpenses) cycle.manualExpenses = [];
  
  fees.forEach(f => {
    const newExp = {
      id: 'mce_' + Date.now().toString(36) + Math.random().toString(36).substr(2,3),
      date: cycle.closeDate || new Date().toISOString().slice(0,10),
      description: f.pdfTxn.rawDesc,
      category: 'Comisiones bancarias',
      amountARS: f.pdfTxn.amountARS,
      amountUSD: f.pdfTxn.amountUSD
    };
    cycle.manualExpenses.push(newExp);
  });
  
  saveState();
  runMatchingAlgorithm();
  renderCccResults();
  showToast(`✓ ${fees.length} cargos importados`,'success');
}

function cccExcludePdfTxn(matchId) {
  const m = cccState.matches.find(x => x.id === matchId);
  if(!m || !m.pdfTxn) return;
  
  if(!confirm('¿Excluir esta línea del PDF? No aparecerá como pendiente.')) return;
  
  m.status = 'excluded';
  m.diffARS = 0;
  m.diffUSD = 0;
  renderCccResults();
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

  // Show ALL cycle transactions regardless of payMethod (user picks manually)
  const cycles = typeof getTcCycles === 'function' ? getTcCycles() : (state.tcCycles||[]);
  const cycle  = cycles.find(c => c.id === cccState.selectedCycle);
  let allTxns = [];
  if(cycle) {
    const idx = cycles.findIndex(c => c.id === cycle.id);
    const openDate = typeof getTcCycleOpen==='function' ? getTcCycleOpen(cycles, idx) : null;
    if(openDate) {
      // All real transactions in the cycle period (exclude projected cuotas)
      allTxns = (state.transactions||[]).filter(t=>{
        if(t.isPendingCuota) return false;
        const d = typeof dateToYMD==='function' ? dateToYMD(t.date) : (t.date instanceof Date?t.date.toISOString().slice(0,10):t.date);
        return d >= openDate && d <= cycle.closeDate;
      }).map(t=>({
        id:t.id, date: typeof dateToYMD==='function'?dateToYMD(t.date):(t.date instanceof Date?t.date.toISOString().slice(0,10):t.date),
        description:t.description, category:t.category||'Sin categoría',
        amountARS:t.currency==='ARS'?t.amount:0, amountUSD:t.currency==='USD'?t.amount:0, source:'txn'
      }));
    }
  }

  if(!allTxns.length) {
    showToast('No hay transacciones registradas en este ciclo para vincular. Importá primero los movimientos.', 'info');
    return;
  }

  // Store for cccDoLinkByIndex
  window._cccLinkCycleTxns = allTxns;

  // Already-linked txn IDs (excluding current match)
  const usedIds = new Set(
    cccState.matches.filter(x => x.id !== matchId && x.appTxn).map(x => x.appTxn.id)
  );

  const el = cccEls.linkList || document.getElementById('ccc-link-list');
  if(!el) return;

  el.innerHTML = allTxns.map((t, i) => {
    const amtStr = t.amountUSD > 0 && !t.amountARS
      ? 'U$S ' + fmtN(t.amountUSD)
      : '$' + fmtN(Math.round(t.amountARS || 0));
    const alreadyLinked = usedIds.has(t.id);
    return `<div style="padding:12px;background:var(--surface2);border-radius:10px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;cursor:pointer;opacity:${alreadyLinked?0.55:1};"
         onclick="cccDoLinkByIndex(${i})">
      <div style="min-width:0;flex:1;">
        <div style="font-size:10px;color:var(--text3);margin-bottom:2px;">${t.date}${alreadyLinked?' · <span style="color:var(--accent3);">ya vinculado</span>':''}</div>
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.description||'—')}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:1px;">${t.category||''}</div>
      </div>
      <div style="font-size:14px;font-weight:700;color:var(--accent);margin-left:12px;flex-shrink:0;">${amtStr}</div>
    </div>`;
  }).join('');

  openModal('modal-ccc-link');
}

function cccDoLinkByIndex(idx) {
  const txn  = (window._cccLinkCycleTxns || [])[idx];
  const mPdf = cccState.matches.find(x => x.id === window._cccLinkingMatchId);
  if(!txn || !mPdf) return;

  // If this txn was linked to another match, unlink it first
  const prev = cccState.matches.find(x => x.id !== mPdf.id && x.appTxn?.id === txn.id);
  if(prev) {
    prev.appTxn = null;
    prev.status = prev.pdfTxn ? 'orphan_pdf' : 'orphan_app';
    prev.diffARS = prev.pdfTxn ? prev.pdfTxn.amountARS : 0;
    prev.diffUSD = prev.pdfTxn ? prev.pdfTxn.amountUSD : 0;
  }
  // Remove any standalone orphan_app entry for this txn
  cccState.matches = cccState.matches.filter(x => !(x.status === 'orphan_app' && x.appTxn?.id === txn.id));

  mPdf.appTxn = txn;
  mPdf.status = 'conc';
  mPdf.diffARS = 0;
  mPdf.diffUSD = 0;

  closeModal('modal-ccc-link');
  renderCccResults();
  cccUpdateHero();
  showToast('✓ Vinculado correctamente', 'success');
}

// Keep legacy cccDoLinkApp for backwards compat (session restores)
function cccDoLinkApp(orphanAppId) {
  const mPdf = cccState.matches.find(x => x.id === window._cccLinkingMatchId);
  const mApp = cccState.matches.find(x => x.id === orphanAppId);
  if(!mPdf || !mApp) return;
  mPdf.appTxn = mApp.appTxn;
  mPdf.status = 'conc';
  mPdf.diffARS = 0;
  mPdf.diffUSD = 0;
  cccState.matches = cccState.matches.filter(x => x.id !== orphanAppId);
  closeModal('modal-ccc-link');
  renderCccResults();
}

function cccAddMissing(matchId) {
   const m = cccState.matches.find(x => x.id === matchId);
   if(!m || !m.pdfTxn) return;

   window._cccAddingMatchId = matchId;

   // Use isoDate if available; fallback to PDF period close or today
   document.getElementById('ccc-add-date').value = m.pdfTxn.isoDate
     || cccState.pdfPeriod?.close
     || new Date().toISOString().slice(0,10);
   document.getElementById('ccc-add-desc').value = m.pdfTxn.rawDesc;
   
   // Populate categories (use name as value — categories don't always have id)
   const catSel = document.getElementById('ccc-add-cat');
   if(catSel){
     let catOpts='';
     (typeof CATEGORY_GROUPS!=='undefined'?CATEGORY_GROUPS:[]).forEach(g=>{
       const subs=state.categories.filter(c=>c.group===g.group);
       if(subs.length){catOpts+=`<optgroup label="${g.emoji} ${g.group}">`;subs.forEach(c=>{catOpts+=`<option value="${esc(c.name)}">${esc(c.name)}</option>`;});catOpts+='</optgroup>';}
     });
     if(!catOpts) catSel.innerHTML=state.categories.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
     else catSel.innerHTML=catOpts;
   }

   document.getElementById('ccc-add-ars').value = m.pdfTxn.amountARS || '';
   document.getElementById('ccc-add-usd').value = m.pdfTxn.amountUSD || '';

   openModal('modal-ccc-add-missing');
}

function cccSaveMissingExpense() {
   const matchId = window._cccAddingMatchId;
   const m = cccState.matches.find(x => x.id === matchId);
   if(!m) return;

   const date = document.getElementById('ccc-add-date').value
     || cccState.pdfPeriod?.close
     || new Date().toISOString().slice(0,10);
   const desc = document.getElementById('ccc-add-desc').value.trim();
   // catSel value is now the category name directly
   const cat = document.getElementById('ccc-add-cat').value || 'Sin clasificar';
   const ars = parseFloat(document.getElementById('ccc-add-ars').value) || 0;
   const usd = parseFloat(document.getElementById('ccc-add-usd').value) || 0;

   if(!desc) { showToast('⚠️ La descripción es obligatoria', 'error'); return; }
   if(!ars && !usd) { showToast('⚠️ Ingresá al menos un monto (ARS o USD)', 'error'); return; }

   // If no cycle selected, try to resolve from PDF period or fall back to first available
   if(!cccState.selectedCycle) {
     const allCycles = typeof getTcCycles === 'function' ? getTcCycles() : [];
     const pdfClose = cccState.pdfPeriod?.close;
     const best = (pdfClose && allCycles.find(c => c.closeDate === pdfClose)) || allCycles[0];
     if(best) {
       cccState.selectedCycle = best.id;
       if(cccEls.cycleFilter) cccEls.cycleFilter.value = best.id;
     } else {
       showToast('⚠️ No hay ciclos configurados. Creá uno en Tarjetas de Crédito primero.', 'error');
       return;
     }
   }

   if(!state.ccCycles) state.ccCycles = [];
   let cycle = state.ccCycles.find(c => c.tcCycleId === cccState.selectedCycle);
   if(!cycle) {
     const tcCycles = typeof getTcCycles === 'function' ? getTcCycles() : [];
     const tcCycle = tcCycles.find(c => c.id === cccState.selectedCycle);
     if(!tcCycle) { showToast('Ciclo no encontrado. Seleccioná un ciclo en el filtro.', 'error'); return; }
     const cardId = state.ccActiveCard || state.ccCards?.[0]?.id || '';
     cycle = { id: tcCycle.id+'_'+cardId, cardId, tcCycleId: tcCycle.id, closeDate: tcCycle.closeDate||null, status:'pending', manualExpenses:[], excludedIds:[] };
     state.ccCycles.push(cycle);
   }

   if(!cycle.manualExpenses) cycle.manualExpenses = [];
   const newExp = {
     id: 'mce_' + Date.now().toString(36),
     date, description: desc, category: cat, amountARS: ars, amountUSD: usd
   };
   cycle.manualExpenses.push(newExp);

   // NOTE: expense is stored only in ccCycles.manualExpenses (not in state.transactions)
   saveState();

   // Link it in the match
   m.appTxn = newExp;
   m.status = 'conc';
   m.diffARS = 0;
   m.diffUSD = 0;

   closeModal('modal-ccc-add-missing');
   renderCccResults();
   cccUpdateHero();
   showToast('✓ Gasto agregado a la conciliación', 'success');
}

function cccSaveSession() {
  const cccKey = 'cc_conc_' + cccState.selectedCycle;
  localStorage.setItem(cccKey, JSON.stringify(cccState));
  showToast('Progreso de conciliación guardado', 'success');
}

// ── Dismiss a pending item permanently ──
function cccDismissPending(matchId) {
  const m = cccState.matches.find(x => x.id === matchId);
  if(!m) return;
  m.status = 'excluded';
  m.diffARS = 0;
  m.diffUSD = 0;
  if(!cccState.dismissedIds) cccState.dismissedIds = [];
  cccState.dismissedIds.push(matchId);
  cccSaveSession();
  renderCccResults();
  cccUpdateHero();
}

// ── Confirm a "posible" match as conciliated ──
function cccConfirmPosible(matchId) {
  const m = cccState.matches.find(x => x.id === matchId);
  if(!m) return;
  m.status = 'conc';
  m.diffARS = 0;
  m.diffUSD = 0;
  renderCccResults();
  cccUpdateHero();
  showToast('✓ Coincidencia confirmada', 'success');
}

// ── Add individual bank fee to App ──
function cccAddBankFee(matchId) {
  const m = cccState.matches.find(x => x.id === matchId);
  if(!m || !m.pdfTxn) return;

  // Same fallback cycle resolution as cccSaveMissingExpense
  if(!cccState.selectedCycle) {
    const allCycles = typeof getTcCycles === 'function' ? getTcCycles() : [];
    const pdfClose = cccState.pdfPeriod?.close;
    const best = (pdfClose && allCycles.find(c => c.closeDate === pdfClose)) || allCycles[0];
    if(best) { cccState.selectedCycle = best.id; if(cccEls.cycleFilter) cccEls.cycleFilter.value = best.id; }
    else { showToast('⚠️ No hay ciclos configurados.', 'error'); return; }
  }

  if(!state.ccCycles) state.ccCycles = [];
  let cycle = state.ccCycles.find(c => c.tcCycleId === cccState.selectedCycle);
  if(!cycle) {
    const tcCycles = typeof getTcCycles === 'function' ? getTcCycles() : [];
    const tcCycle = tcCycles.find(c => c.id === cccState.selectedCycle);
    if(!tcCycle) { showToast('Ciclo no encontrado', 'error'); return; }
    const cardId = state.ccActiveCard || state.ccCards?.[0]?.id || '';
    cycle = { id: tcCycle.id+'_'+cardId, cardId, tcCycleId: tcCycle.id, closeDate: tcCycle.closeDate||null, status:'pending', manualExpenses:[], excludedIds:[] };
    state.ccCycles.push(cycle);
  }
  if(!cycle.manualExpenses) cycle.manualExpenses = [];

  const closeDate = cccState.pdfPeriod?.close || new Date().toISOString().slice(0,10);
  const newExp = {
    id: 'mce_' + Date.now().toString(36) + Math.random().toString(36).substr(2,3),
    date: closeDate,
    description: m.pdfTxn.rawDesc,
    category: 'Impuestos y Comisiones',
    amountARS: m.pdfTxn.amountARS || 0,
    amountUSD: m.pdfTxn.amountUSD || 0
  };
  cycle.manualExpenses.push(newExp);

  // NOTE: stored only in ccCycles.manualExpenses (not in state.transactions)
  m.appTxn = newExp;
  m.status = 'bank_fee'; // keep as bank_fee but now has appTxn
  saveState();
  renderCccResults();
  cccUpdateHero();
  showToast('✓ Cargo bancario agregado a la conciliación', 'success');
}

// ── Mark cycle as reviewed/paid and close ──
function cccMarkReviewed() {
  if(!cccState.selectedCycle) { showToast('Seleccioná un ciclo primero', 'error'); return; }
  const pendingCount = cccState.matches.filter(m => ['orphan_pdf','orphan_app','diff','posible'].includes(m.status)).length;
  if(pendingCount > 0) {
    if(!confirm(`Todavía hay ${pendingCount} item(s) pendiente(s). ¿Marcarlo igual como pagado?`)) return;
  } else {
    if(!confirm('¿Marcar este resumen como revisado y el ciclo como pagado?')) return;
  }

  if(!state.ccCycles) state.ccCycles = [];
  const cardId = state.ccActiveCard || state.ccCards?.[0]?.id || '';
  let cycle = state.ccCycles.find(c => c.tcCycleId === cccState.selectedCycle);
  if(!cycle) {
    const tcCycle = (getTcCycles()||[]).find(c => c.id === cccState.selectedCycle);
    if(!tcCycle) { showToast('Ciclo no encontrado', 'error'); return; }
    cycle = { id: tcCycle.id+'_'+cardId, cardId, tcCycleId: tcCycle.id, closeDate: tcCycle.closeDate||null, status:'pending', manualExpenses:[], excludedIds:[] };
    state.ccCycles.push(cycle);
  }
  cycle.status = 'paid';
  // Update vencimiento from PDF if not set
  if(!cycle.dueDate && cccState.pdfPeriod?.vencimiento) {
    cycle.dueDate = cccState.pdfPeriod.vencimiento;
  }
  saveState();
  cccSaveSession();
  showToast('✓ Ciclo marcado como pagado', 'success');
  // Navigate back to credit cards
  if(typeof nav === 'function') setTimeout(() => nav('credit-cards'), 800);
  if(typeof renderCreditCards === 'function') setTimeout(() => renderCreditCards(), 900);
}
