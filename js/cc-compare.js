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
    runMatchingAlgorithm();
    cccSmartMatch(false); // Silent smart match on first load
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
    jul:7, julio:7, ago:8, agosto:8, aug:8, sep:9, septiembre:9,
    oct:10, octubre:10, nov:11, noviembre:11, dic:12, diciembre:12
  };

  const parseAmt = (s) => {
    if(!s || s==='-') return 0;
    // Remove dots (thousands), change comma to dot (decimal)
    let clean = s.replace(/\./g,'').replace(',','.');
    return parseFloat(clean) || 0;
  };

  const isBankFeeLine = (l) =>
    /impuesto de sellos/i.test(l) || /iibb percep/i.test(l) ||
    /iva rg \d/i.test(l) || /db\.rg \d/i.test(l) ||
    /mantenimiento/i.test(l) || /percepc/i.test(l);

  const isPaymentLine = (l) =>
    /su pago en pesos/i.test(l) || /su pago en d[oó]lares/i.test(l);

  // Patterns
  // 1. YY MON DD comprobante K/ DESCRIPTION amt [usd]
  const TXN_RE1 = /^(\d{2})\s+([a-z]{3})[a-z]*\s+(\d{1,2})\s+\d{4,12}\s+[Kk]\/?[*]?\s*(.*?)\s+([\d\.]+,\d{2})(?:\s+([\d\.]+,\d{2}))?$/i;
  // 2. DD MON DESCRIPTION amt [usd] (Newer format)
  const TXN_RE2 = /^(\d{1,2})\s+([a-z]{3})[a-z]*\s+(.*?)\s+([\d\.]+,\d{2})(?:\s+([\d\.]+,\d{2}))?$/i;
  // 3. DD/MM DESCRIPTION amt [usd]
  const TXN_RE3 = /^(\d{1,2})\/(\d{1,2})\s+(.*?)\s+([\d\.]+,\d{2})(?:\s+([\d\.]+,\d{2}))?$/i;
  // 4. YY MON DD DESCRIPTION amt [usd]
  const TXN_RE4 = /^(\d{2})\s+([a-z]{3})[a-z]*\s+(\d{1,2})\s+(.*?)\s+([\d\.]+,\d{2})(?:\s+([\d\.]+,\d{2}))?$/i;

  let currentHolder = 'Titular';
  const currentYear = new Date().getFullYear();

  for(let rawLine of lines) {
    const line = rawLine.trim().replace(/\s{2,}/g,' ');
    if(!line) continue;

    // Holder detection
    const holderM = line.match(/^(TITULAR|ADICIONAL):\s*(.*)/i);
    if(holderM) { currentHolder = holderM[2].trim(); continue; }

    // Bank fees
    if(isBankFeeLine(line)) {
      const amtM = line.match(/([\d\.]+,\d{2})$/);
      if(amtM) {
        txns.push({
          id: 'pdf_'+Date.now()+Math.random().toString(36).substr(2,5),
          rawDate: null, isoDate: null,
          rawDesc: line.replace(/([\d\.]+,\d{2})$/, '').trim(),
          amountARS: parseAmt(amtM[1]), amountUSD: 0,
          cuotas: null, isBankFee: true, isPayment: false
        });
      }
      continue;
    }

    // Payments
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
           cuotas: null, isBankFee: false, isPayment: true
         });
       }
       continue;
    }

    let m = line.match(TXN_RE1);
    let day, month, year, desc, arsStr, usdStr;

    if(m) {
      year = 2000 + parseInt(m[1]); month = MONTHS[m[2].toLowerCase().slice(0,3)]; day = parseInt(m[3]);
      desc = m[4]; arsStr = m[5]; usdStr = m[6];
    } else if((m = line.match(TXN_RE4))) {
      year = 2000 + parseInt(m[1]); month = MONTHS[m[2].toLowerCase().slice(0,3)]; day = parseInt(m[3]);
      desc = m[4]; arsStr = m[5]; usdStr = m[6];
    } else if((m = line.match(TXN_RE2))) {
      year = currentYear; month = MONTHS[m[2].toLowerCase().slice(0,3)]; day = parseInt(m[1]);
      desc = m[3]; arsStr = m[4]; usdStr = m[5];
    } else if((m = line.match(TXN_RE3))) {
      year = currentYear; day = parseInt(m[1]); month = parseInt(m[2]);
      desc = m[3]; arsStr = m[4]; usdStr = m[5];
    }

    if(day && month && desc && arsStr) {
      const isoDate = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      desc = desc.trim();

      // Extract cuota notation C.N/T from end of description
      let cuotas = null;
      const cuotaM = desc.match(/\s+C\.(\d+)\/(\d+)$/i);
      if(cuotaM) {
        cuotas = `${cuotaM[1]}/${cuotaM[2]}`;
        desc = desc.replace(/\s+C\.\d+\/\d+$/i,'').trim();
      }

      txns.push({
        id: 'pdf_'+Date.now()+Math.random().toString(36).substr(2,5),
        rawDate: `${day} ${month}`, isoDate,
        rawDesc: desc,
        amountARS: parseAmt(arsStr),
        amountUSD: usdStr ? parseAmt(usdStr) : 0,
        cuotas, isBankFee: false, isPayment: false,
        holder: currentHolder
      });
      console.log(`Matched: ${isoDate} | ${desc} | ARS ${arsStr}`);
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

// ── Matching Algorithm ──
function runMatchingAlgorithm() {
  cccState.selectedCycle = cccEls.cycleFilter.value;
  
  const cycles = typeof getTcCycles === 'function' ? getTcCycles() : state.tcCycles;
  const cycle = cycles.find(c => c.id === cccState.selectedCycle);
  if(!cycle) return;
  
  // Get all app transactions belonging to this cycle
  // Fix: ccGetCycleExpenses expects (cardId, tcCycleId)
  const appTxns = typeof ccGetCycleExpenses === 'function' ? ccGetCycleExpenses(cycle.cardId, cycle.id) : [];
  let availableAppTxns = [...appTxns];
  
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
  let conc = 0, diff = 0, orphanPdf = 0, orphanApp = 0;
  let totalPdfARS = 0, totalAppARS = 0;
  let totalPdfUSD = 0, totalAppUSD = 0;

  cccState.matches.forEach(m => {
    if(m.status === 'conc' || m.status === 'bank_fee') conc++;
    else if(m.status === 'orphan_pdf') orphanPdf++;
    else if(m.status === 'orphan_app') orphanApp++;
    else if(m.status === 'diff' || m.status === 'posible') diff++;

    // Totals for the hero
    if(m.pdfTxn) {
      totalPdfARS += m.pdfTxn.amountARS || 0;
      totalPdfUSD += m.pdfTxn.amountUSD || 0;
    }
    if(m.appTxn) {
      totalAppARS += m.appTxn.amountARS || m.appTxn.amount || 0;
      totalAppUSD += m.appTxn.amountUSD || (m.appTxn.currency==='USD'?m.appTxn.amount:0) || 0;
    }
  });

  const diffARS = totalPdfARS - totalAppARS;
  const groups = {
    pending: cccState.matches.filter(m => ['orphan_pdf','orphan_app','diff','posible'].includes(m.status)),
    conciliated: cccState.matches.filter(m => ['conc','bank_fee'].includes(m.status)),
    excluded: cccState.matches.filter(m => m.status === 'excluded')
  };

  cccEls.resultsArea.innerHTML = `
    <!-- Summary Hero -->
    <div class="ccc-summary-hero fade-up">
      <div class="ccc-stat-item">
        <div class="ccc-stat-label">Total Resumen (PDF)</div>
        <div class="ccc-stat-val">$${fmtN(Math.round(totalPdfARS))}</div>
      </div>
      <div class="ccc-stat-item">
        <div class="ccc-stat-label">Registrado en App</div>
        <div class="ccc-stat-val">$${fmtN(Math.round(totalAppARS))}</div>
      </div>
      <div class="ccc-stat-item">
        <div class="ccc-stat-label">Diferencia / Gap</div>
        <div class="ccc-stat-val ${Math.abs(diffARS) > 1 ? 'diff' : 'match'}">
          ${diffARS > 0 ? '+' : ''}$${fmtN(Math.round(diffARS))}
        </div>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:12px;flex-wrap:wrap;">
       <div style="font-size:14px;font-weight:700;color:var(--text2);">Detalle de conciliación</div>
       <div style="display:flex;gap:8px;">
         <button class="btn btn-sm btn-accent" onclick="cccSmartMatch()"><span style="margin-right:4px;">✨</span> Smart Match</button>
         <button class="btn btn-sm" onclick="cccImportAllFees()">Importar Impuestos</button>
         <button class="btn btn-sm btn-secondary" onclick="cccSaveSession()">Guardar</button>
       </div>
    </div>

    <div id="ccc-matching-container">
      ${renderGroup('Pendientes', groups.pending, '¡Excelente! No hay diferencias pendientes.')}
      ${renderGroup('Conciliados', groups.conciliated, 'Nada conciliado aún.')}
    </div>
  `;
}

function renderGroup(title, list, emptyMsg) {
  const iconMap = { 'Pendientes': '⏳', 'Conciliados': '✅', 'Excluidos': '🚫' };
  return `
    <div class="ccc-group-title">${iconMap[title] || ''} ${title} (${list.length})</div>
    <div class="ccc-row-list">
      ${list.length ? list.map(m => renderCccRow(m)).join('') : `<div class="ccc-empty-notice">${emptyMsg}</div>`}
    </div>
  `;
}

function renderCccRow(m) {
  const isMatch = m.status === 'conc' || m.status === 'bank_fee';
  const isMissing = m.status === 'orphan_pdf';
  const isExtra = m.status === 'orphan_app';
  const isDiff = m.status === 'diff' || m.status === 'posible';

  let rowClass = 'match';
  if(isMissing) rowClass = 'missing';
  if(isExtra) rowClass = 'extra';
  if(isDiff) rowClass = 'diff';
  if(m.status === 'bank_fee') rowClass = 'fee';

  const actions = [];
  if (isMissing) {
     actions.push(`<button class="ccc-row-btn primary" onclick="cccAddMissing('${m.id}')">Agregar a App</button>`);
     actions.push(`<button class="ccc-row-btn" onclick="cccLinkApp('${m.id}')">Vincular</button>`);
  } else if (isDiff) {
     actions.push(`<button class="ccc-row-btn primary" onclick="cccEditAppTxn('${m.id}')">Ajustar</button>`);
     actions.push(`<button class="ccc-row-btn danger" onclick="cccUnlink('${m.id}')">Separar</button>`);
  } else if (isMatch) {
     actions.push(`<button class="ccc-row-btn danger" title="Desvincular" onclick="cccUnlink('${m.id}')">✖</button>`);
  }

  return `
    <div class="ccc-row ${rowClass} fade-up" id="${m.id}">
      <!-- PDF SIDE -->
      <div class="ccc-row-side">
        <div class="ccc-row-label">Resumen PDF</div>
        ${m.pdfTxn ? `
          <div class="ccc-row-desc">${esc(m.pdfTxn.rawDesc)}</div>
          <div class="ccc-row-date">${m.pdfTxn.rawDate} ${m.pdfTxn.holder ? '· '+esc(m.pdfTxn.holder) : ''}</div>
        ` : '<div class="ccc-row-desc" style="color:var(--text3); font-style:italic;">— No presente —</div>'}
      </div>

      <!-- MIDDLE ICON -->
      <div class="ccc-row-middle">
        ${isMatch ? '🔗' : isDiff ? '⚠️' : '❓'}
      </div>

      <!-- APP SIDE -->
      <div class="ccc-row-side">
        <div class="ccc-row-label">Registrado en App</div>
        ${m.appTxn ? `
          <div class="ccc-row-desc">${esc(m.appTxn.descripcion || m.appTxn.description)}</div>
          <div class="ccc-row-date">${ccFmtDate(m.appTxn.date)}</div>
        ` : '<div class="ccc-row-desc" style="color:var(--text3); font-style:italic;">— Pendiente —</div>'}
      </div>

      <!-- AMOUNT -->
      <div style="text-align:right; min-width:100px;">
        <div class="ccc-row-label">Monto</div>
        ${m.pdfTxn ? `
          <div class="ccc-row-amt ars">$${fmtN(Math.round(m.pdfTxn.amountARS || 0))}</div>
          ${m.pdfTxn.amountUSD ? `<div class="ccc-row-amt usd">U$D ${fmtN(m.pdfTxn.amountUSD)}</div>` : ''}
        ` : `
          <div class="ccc-row-amt ars">$${fmtN(Math.round(m.appTxn.amountARS || m.appTxn.amount || 0))}</div>
        `}
      </div>

      <!-- ACTIONS -->
      <div class="ccc-row-actions">
        ${actions.join('')}
      </div>
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
  
  const cycle = state.ccCycles.find(c => c.id === cccState.selectedCycle);
  if(!cycle) return;
  if(!cycle.manualExpenses) cycle.manualExpenses = [];
  
  fees.forEach(f => {
    const newExp = {
      id: 'mce_' + Date.now().toString(36) + Math.random().toString(36).substr(2,3),
      date: cycle.closeDate, // Default to close date of cycle
      description: f.pdfTxn.rawDesc,
      category: 'Impuestos y Comisiones',
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
