/**
 * generate-pdf.js — Apple-style financial report (Helvetica, no emojis)
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');

/* ── Color palette ── */
const C = {
  bg:      '#FFFFFF',
  dark:    '#1D1D1F',
  text1:   '#1D1D1F',
  text2:   '#6E6E73',
  text3:   '#AEAEB2',
  accent:  '#0071E3',   // Apple blue
  green:   '#30D158',
  red:     '#FF453A',
  orange:  '#FF9F0A',
  card:    '#F5F5F7',
  cardAlt: '#FBFBFD',
  divider: '#E5E5EA',
  headerBg:'#1D1D1F',
};

function fmtN(n) {
  if (n == null || isNaN(n)) return '--';
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function shortDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

async function generatePDF(report, aiInsights, outputPath, options = {}) {
  void options;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 0, bottom: 40, left: 0, right: 0 },
      bufferPages: true,
      info: { Title: 'Reporte Financiero', Author: 'Registro de Finanzas' },
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    const PW = doc.page.width;   // 595
    const PH = doc.page.height;  // 842
    const MX = 40;               // horizontal margin
    const W = PW - MX * 2;       // usable width
    const COL_GAP = 10;

    /* ═══════════════════════════════════════════
       HEADER
    ═══════════════════════════════════════════ */
    doc.rect(0, 0, PW, 80).fill(C.headerBg);
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#FFFFFF')
      .text('Reporte Financiero', MX, 22, { width: W });
    doc.font('Helvetica').fontSize(8.5).fillColor('#AEAEB2')
      .text(`Semana ${shortDate(report.period.weekStart)} al ${shortDate(report.period.weekEnd)}  |  ${fmtDate(report.generatedAt)}  |  TC: $${fmtN(report.usdRate)}`, MX, 46, { width: W });

    let y = 96;

    /* ═══════════════════════════════════════════
       SECTION 1 — DASHBOARD WIDGETS
    ═══════════════════════════════════════════ */

    // ── Row 1: Gasto Semanal | Gasto Ciclo TC | Margen Disponible ──
    const col3W = (W - COL_GAP * 2) / 3;

    y = drawWidgetCard(doc, MX, y, col3W, 68, 'Gasto Semanal', `$${fmtN(report.week.totalARS)}`, `${report.week.txCount} movimientos`, C.accent);

    // Segundo widget: Gasto del Ciclo TC (o gasto mensual si no hay ciclo)
    const ccVal = report.ccCycle ? report.ccCycle.totalARS : report.month.totalARS;
    const ccCount = report.ccCycle ? report.ccCycle.txCount : report.month.txCount;
    const ccLabel = report.ccCycle ? 'Gasto Ciclo TC' : 'Gasto del Mes';
    const ccSub = report.ccCycle ? `${ccCount} mov. | Cierre en ${report.ccCycle.daysLeft}d` : `${ccCount} movimientos`;
    drawWidgetCard(doc, MX + col3W + COL_GAP, y - 68, col3W, 68, ccLabel, `$${fmtN(ccVal)}`, ccSub, C.accent);

    const marginVal = report.marginARS;
    const marginLabel = marginVal != null ? `$${fmtN(marginVal)}` : '--';
    const marginColor = marginVal != null && marginVal < 0 ? C.red : C.green;
    const marginSub = marginVal != null && marginVal < 0 ? 'DEFICIT' : 'Disponible este mes';
    drawWidgetCard(doc, MX + (col3W + COL_GAP) * 2, y - 68, col3W, 68, 'Margen Disponible', marginLabel, marginSub, marginColor);

    // Week vs prev badge
    if (report.weekVsPrevPct != null) {
      const dir = report.weekVsPrevPct > 0 ? '+' : '';
      const col = report.weekVsPrevPct > 10 ? C.red : report.weekVsPrevPct < -5 ? C.green : C.text2;
      doc.font('Helvetica').fontSize(7.5).fillColor(col)
        .text(`${dir}${report.weekVsPrevPct}% vs semana anterior ($${fmtN(report.prevWeek.totalARS)})`, MX, y, { width: W });
      y += 16;
    }

    // ── Row 2: Detalle Ciclo Tarjeta de Credito ──
    if (report.ccCycle) {
      y += 4;
      const cc = report.ccCycle;
      y = drawSectionLabel(doc, MX, y, 'DETALLE CICLO TARJETA DE CREDITO');

      const cc3W = (W - COL_GAP * 2) / 3;
      const ccY = y;
      drawMiniCard(doc, MX, ccY, cc3W, 56, 'Dias al cierre', `${cc.daysLeft}`, `de ${cc.totalDays} dias`, cc.daysLeft <= 5 ? C.orange : C.text2);
      drawMiniCard(doc, MX + cc3W + COL_GAP, ccY, cc3W, 56, 'Prom. diario ciclo', `$${fmtN(cc.dailyAvg)}`, `${cc.daysElapsed} dias transcurridos`, C.text2);
      drawMiniCard(doc, MX + (cc3W + COL_GAP) * 2, ccY, cc3W, 56, 'Proyeccion cierre', `$${fmtN(cc.projectedClose)}`, `al ${cc.closeDate.slice(8)}/${cc.closeDate.slice(5, 7)}`, cc.projectedClose > cc.totalARS * 1.3 ? C.orange : C.accent);
      y = ccY + 56 + 6;
    }

    // ── Row 3: Promedio por dia de la semana ──
    if (report.weekdayAvg) {
      y += 4;
      y = drawSectionLabel(doc, MX, y, 'GASTO PROMEDIO POR DIA');
      const barAreaW = W;
      const barItemW = barAreaW / 7;
      const maxAvg = Math.max(...report.weekdayAvg.map(d => d.total), 1);
      const barMaxH = 36;

      report.weekdayAvg.forEach((d, i) => {
        const bx = MX + i * barItemW + barItemW * 0.2;
        const bw = barItemW * 0.6;
        const bh = maxAvg > 0 ? Math.max(2, (d.total / maxAvg) * barMaxH) : 2;
        const by = y + barMaxH - bh;

        // Bar
        roundedRect(doc, bx, by, bw, bh, 3).fill(i < 5 ? C.accent : '#D1D1D6');

        // Day label
        doc.font('Helvetica-Bold').fontSize(7).fillColor(C.text2)
          .text(d.day, MX + i * barItemW, y + barMaxH + 4, { width: barItemW, align: 'center' });
        // Amount
        doc.font('Helvetica').fontSize(6).fillColor(C.text3)
          .text(d.total > 0 ? `$${fmtN(d.total)}` : '-', MX + i * barItemW, y + barMaxH + 14, { width: barItemW, align: 'center' });
      });
      y += barMaxH + 28;
    }

    // ── Compromisos Section ──
    y += 6;
    y = pageBreak(doc, y, 200, PH);
    y = drawSectionLabel(doc, MX, y, 'COMPROMISOS MENSUALES');

    const commitCol3 = (W - COL_GAP * 2) / 3;
    const cY = y;
    drawMiniCard(doc, MX, cY, commitCol3, 50, 'Gastos Fijos', `$${fmtN(report.fixedExpenses.gastosFijos)}`, `${(report.fixedExpenses.items || []).length} items`, C.text2);
    drawMiniCard(doc, MX + commitCol3 + COL_GAP, cY, commitCol3, 50, 'Suscripciones', `$${fmtN(report.fixedExpenses.suscripciones)}`, `${(report.subscriptionsList || []).length} activas`, C.text2);
    drawMiniCard(doc, MX + (commitCol3 + COL_GAP) * 2, cY, commitCol3, 50, 'Cuotas', `$${fmtN(report.cuotas.monthlyARS)}/mes`, `${report.cuotas.active} activas`, C.text2);
    y = cY + 56;

    // Total compromisos badge
    roundedRect(doc, MX, y, W, 28, 6).fill('#E8F4FD');
    doc.font('Helvetica').fontSize(8).fillColor(C.accent)
      .text('Total compromisos mensuales', MX + 12, y + 5, { width: 200 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.accent)
      .text(`$${fmtN(report.commitments.totalARS)}`, MX + 12, y + 5, { width: W - 24, align: 'right' });
    y += 36;

    // ── Detalle Gastos Fijos ──
    if (report.fixedExpenses.items && report.fixedExpenses.items.length) {
      y = pageBreak(doc, y, 60, PH);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C.text2).text('Gastos fijos', MX + 4, y);
      y += 14;
      report.fixedExpenses.items.forEach(f => {
        y = pageBreak(doc, y, 14, PH);
        doc.font('Helvetica').fontSize(7.5).fillColor(C.text1)
          .text(f.name, MX + 8, y, { width: 260 });
        doc.font('Helvetica').fontSize(7.5).fillColor(C.text1)
          .text(`$${fmtN(f.amountARS)}`, MX + 8, y, { width: W - 16, align: 'right' });
        y += 12;
      });
      y += 4;
    }

    // ── Detalle Suscripciones ──
    if (report.subscriptionsList && report.subscriptionsList.length) {
      y = pageBreak(doc, y, 60, PH);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C.text2).text('Suscripciones', MX + 4, y);
      y += 14;
      report.subscriptionsList.forEach(s => {
        y = pageBreak(doc, y, 14, PH);
        doc.font('Helvetica').fontSize(7.5).fillColor(C.text1)
          .text(s.name, MX + 8, y, { width: 260 });
        doc.font('Helvetica').fontSize(7.5).fillColor(C.text1)
          .text(`$${fmtN(s.amountARS)}`, MX + 8, y, { width: W - 16, align: 'right' });
        y += 12;
      });
      y += 4;
    }

    // ── Detalle Cuotas ──
    if (report.cuotas.items.length) {
      y = pageBreak(doc, y, 80, PH);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C.text2).text('Cuotas activas', MX + 4, y);
      y += 14;
      report.cuotas.items.forEach(c => {
        y = pageBreak(doc, y, 28, PH);
        // Row 1: name + monthly amount
        doc.font('Helvetica').fontSize(7.5).fillColor(C.text1)
          .text(c.desc, MX + 8, y, { width: 280 });
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.text1)
          .text(`$${fmtN(c.monthlyARS)}/mes`, MX + 8, y, { width: W - 16, align: 'right' });
        y += 11;
        // Row 2: progress + total value
        const remaining = c.total - c.paid;
        const pct = c.total > 0 ? Math.round((c.paid / c.total) * 100) : 0;
        doc.font('Helvetica').fontSize(6.5).fillColor(C.text3)
          .text(`${c.paid}/${c.total} pagadas  |  Faltan ${remaining}  |  Total: $${fmtN(c.totalValueARS)}`, MX + 8, y, { width: W - 16 });
        y += 10;
        // Progress bar
        const barW = Math.min(W - 16, 180);
        roundedRect(doc, MX + 8, y, barW, 3, 1.5).fill(C.divider);
        if (pct > 0) {
          roundedRect(doc, MX + 8, y, Math.max(3, barW * pct / 100), 3, 1.5).fill(C.accent);
        }
        y += 10;
      });
      // Total cuotas value
      if (report.cuotas.totalValueARS > 0) {
        doc.font('Helvetica').fontSize(7).fillColor(C.text3)
          .text(`Valor total deuda en cuotas: $${fmtN(report.cuotas.totalValueARS)}`, MX + 8, y, { width: W - 16 });
        y += 14;
      }
    }

    /* ═══════════════════════════════════════════
       SECTION 2 — ANALISIS Y RECOMENDACIONES
    ═══════════════════════════════════════════ */
    if (aiInsights) {
      y += 8;
      y = pageBreak(doc, y, 140, PH);
      y = drawDivider(doc, MX, y, W);
      y = drawSectionLabel(doc, MX, y, 'ANALISIS Y RECOMENDACIONES');

      if (aiInsights.resumen) {
        roundedRect(doc, MX, y, W, 0.01, 8); // just for measuring
        doc.font('Helvetica').fontSize(8.5).fillColor(C.text1);
        const resH = doc.heightOfString(aiInsights.resumen, { width: W - 32 });
        roundedRect(doc, MX, y, W, resH + 20, 8).fill(C.card);
        doc.font('Helvetica').fontSize(8.5).fillColor(C.text1)
          .text(aiInsights.resumen, MX + 16, y + 10, { width: W - 32 });
        y += resH + 30;
      }

      if (aiInsights.insights && aiInsights.insights.length) {
        y = pageBreak(doc, y, 60, PH);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.text1).text('Insights clave', MX + 4, y);
        y += 16;
        aiInsights.insights.forEach((ins, i) => {
          y = pageBreak(doc, y, 20, PH);
          // Numbered circle
          doc.circle(MX + 12, y + 5, 7).fill(C.accent);
          doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF')
            .text(`${i + 1}`, MX + 7, y + 1.5, { width: 10, align: 'center' });
          doc.font('Helvetica').fontSize(8).fillColor(C.text1)
            .text(ins, MX + 26, y, { width: W - 30 });
          y = doc.y + 8;
        });
      }

      if (aiInsights.recomendaciones && aiInsights.recomendaciones.length) {
        y += 4;
        y = pageBreak(doc, y, 60, PH);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.text1).text('Recomendaciones', MX + 4, y);
        y += 16;
        aiInsights.recomendaciones.forEach((rec, i) => {
          y = pageBreak(doc, y, 20, PH);
          doc.circle(MX + 12, y + 5, 7).fill(C.green);
          doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF')
            .text(`${i + 1}`, MX + 7, y + 1.5, { width: 10, align: 'center' });
          doc.font('Helvetica').fontSize(8).fillColor(C.text1)
            .text(rec, MX + 26, y, { width: W - 30 });
          y = doc.y + 8;
        });
      }
    }

    // ── ALERTAS ──
    if (report.alerts && report.alerts.length) {
      y += 6;
      y = pageBreak(doc, y, 40, PH);
      report.alerts.forEach(a => {
        y = pageBreak(doc, y, 24, PH);
        roundedRect(doc, MX, y, W, 22, 6).fill('#FFF8E1');
        doc.font('Helvetica').fontSize(7.5).fillColor('#B8860B')
          .text(`!  ${a}`, MX + 12, y + 5, { width: W - 24 });
        y += 28;
      });
    }

    /* ═══════════════════════════════════════════
       SECTION 3 — CATEGORIAS Y SUBCATEGORIAS
    ═══════════════════════════════════════════ */
    y += 10;
    y = pageBreak(doc, y, 100, PH);
    y = drawDivider(doc, MX, y, W);
    const catLabel = report.period.isCurrentMonth ? 'CATEGORIAS Y SUBCATEGORIAS (MES)' : `CATEGORIAS Y SUBCATEGORIAS (${(report.period.monthLabel || 'MES').toUpperCase()})`;
    y = drawSectionLabel(doc, MX, y, catLabel);

    if (report.categoryGroups && report.categoryGroups.length) {
      report.categoryGroups.forEach(grp => {
        y = pageBreak(doc, y, 40, PH);

        // Category header row
        roundedRect(doc, MX, y, W, 22, 5).fill(C.card);

        // Category name
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.text1)
          .text(grp.group, MX + 12, y + 5, { width: 200 });

        // Amount
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.text1)
          .text(`$${fmtN(grp.totalARS)}`, MX + 220, y + 5, { width: 100, align: 'right' });

        // Percentage bar
        const barX = MX + 340;
        const barMaxW = W - 340 - 50;
        const barPctW = Math.min(grp.pct, 100) / 100 * barMaxW;
        roundedRect(doc, barX, y + 8, barMaxW, 5, 2.5).fill(C.divider);
        if (barPctW > 3) {
          roundedRect(doc, barX, y + 8, barPctW, 5, 2.5).fill(C.accent);
        }

        // Percentage text
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.text2)
          .text(`${grp.pct}%`, MX + W - 40, y + 5, { width: 36, align: 'right' });

        y += 26;

        // Subcategories
        grp.subs.forEach(sub => {
          y = pageBreak(doc, y, 14, PH);
          const subPct = report.month.totalARS > 0 ? Math.round((sub.totalARS / report.month.totalARS) * 100) : 0;

          doc.font('Helvetica').fontSize(7.5).fillColor(C.text2)
            .text(sub.name, MX + 24, y, { width: 196 });
          doc.font('Helvetica').fontSize(7.5).fillColor(C.text2)
            .text(`$${fmtN(sub.totalARS)}`, MX + 220, y, { width: 100, align: 'right' });
          doc.font('Helvetica').fontSize(7).fillColor(C.text3)
            .text(`${sub.count} mov.`, MX + 340, y, { width: 60 });
          doc.font('Helvetica').fontSize(7).fillColor(C.text3)
            .text(`${subPct}%`, MX + W - 40, y, { width: 36, align: 'right' });
          y += 14;
        });
        y += 6;
      });
    }

    /* ═══════════════════════════════════════════
       FOOTER on every page
    ═══════════════════════════════════════════ */
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      // Subtle line
      doc.moveTo(MX, PH - 30).lineTo(MX + W, PH - 30)
        .strokeColor(C.divider).lineWidth(0.5).stroke();
      doc.font('Helvetica').fontSize(6.5).fillColor(C.text3)
        .text('Registro de Finanzas', MX, PH - 24, { width: W * 0.5 });
      doc.font('Helvetica').fontSize(6.5).fillColor(C.text3)
        .text(`${i + 1} / ${totalPages}`, MX + W * 0.5, PH - 24, { width: W * 0.5, align: 'right' });
    }

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

/* ══════════════════════════════════════════════
   HELPER COMPONENTS
══════════════════════════════════════════════ */

function roundedRect(doc, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  doc.moveTo(x + r, y)
    .lineTo(x + w - r, y)
    .quadraticCurveTo(x + w, y, x + w, y + r)
    .lineTo(x + w, y + h - r)
    .quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    .lineTo(x + r, y + h)
    .quadraticCurveTo(x, y + h, x, y + h - r)
    .lineTo(x, y + r)
    .quadraticCurveTo(x, y, x + r, y);
  return doc;
}

function drawWidgetCard(doc, x, y, w, h, label, value, subtitle, accentColor) {
  roundedRect(doc, x, y, w, h, 10).fill(C.card);
  doc.font('Helvetica').fontSize(7.5).fillColor(C.text3)
    .text(label, x + 14, y + 10, { width: w - 28 });
  doc.font('Helvetica-Bold').fontSize(17).fillColor(accentColor || C.text1)
    .text(value, x + 14, y + 23, { width: w - 28 });
  if (subtitle) {
    doc.font('Helvetica').fontSize(7).fillColor(C.text3)
      .text(subtitle, x + 14, y + h - 16, { width: w - 28 });
  }
  return y + h + 8;
}

function drawMiniCard(doc, x, y, w, h, label, value, subtitle, accentColor) {
  roundedRect(doc, x, y, w, h, 8).fill(C.card);
  doc.font('Helvetica').fontSize(6.5).fillColor(C.text3)
    .text(label, x + 10, y + 8, { width: w - 20 });
  doc.font('Helvetica-Bold').fontSize(13).fillColor(accentColor || C.text1)
    .text(value, x + 10, y + 20, { width: w - 20 });
  if (subtitle) {
    doc.font('Helvetica').fontSize(6).fillColor(C.text3)
      .text(subtitle, x + 10, y + h - 14, { width: w - 20 });
  }
  return y + h + 6;
}

function drawSectionLabel(doc, x, y, text) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.text2)
    .text(text, x + 4, y, { characterSpacing: 0.8 });
  return y + 18;
}

function drawDivider(doc, x, y, w) {
  doc.moveTo(x, y).lineTo(x + w, y).strokeColor(C.divider).lineWidth(0.5).stroke();
  return y + 12;
}

function pageBreak(doc, y, needed, PH) {
  if (y + needed > (PH || doc.page.height) - 50) {
    doc.addPage();
    return 40;
  }
  return y;
}

module.exports = { generatePDF };
