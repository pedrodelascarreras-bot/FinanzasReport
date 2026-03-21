/**
 * generate-pdf.js — Genera un PDF prolijo con el reporte financiero
 * Usa PDFKit (sin dependencias de browser/puppeteer).
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function fmtN(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n) {
  if (n == null) return '—';
  return n + '%';
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function generatePDF(report, aiInsights, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: 'Reporte Financiero Semanal',
        Author: 'Registro de Finanzas',
      },
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    const W = doc.page.width - 100; // ancho útil
    const COL_ACCENT = '#0066FF';
    const COL_DANGER = '#FF3B30';
    const COL_SUCCESS = '#34C759';
    const COL_GRAY = '#8E8E93';
    const COL_LIGHT = '#F2F2F7';

    // ════════════════════════════════════════════════
    // HEADER
    // ════════════════════════════════════════════════
    doc
      .rect(0, 0, doc.page.width, 100)
      .fill('#1D1D1F');

    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor('#FFFFFF')
      .text('Reporte Financiero Semanal', 50, 30, { width: W });

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#AEAEB2')
      .text(
        `Semana del ${fmtDate(report.period.weekStart)} al ${fmtDate(report.period.weekEnd)}  ·  Generado: ${fmtDate(report.generatedAt)}  ·  TC: $${fmtN(report.usdRate)}`,
        50, 60, { width: W }
      );

    let y = 120;

    // ════════════════════════════════════════════════
    // RESUMEN EJECUTIVO
    // ════════════════════════════════════════════════
    y = sectionTitle(doc, 'Resumen del período', y, W);

    // KPI cards en grid 2x2
    const kpis = [
      { label: 'Gasto semanal', value: `$${fmtN(report.week.totalARS)}`, sub: `${report.week.txCount} movimientos`, color: COL_ACCENT },
      { label: 'Gasto mensual', value: `$${fmtN(report.month.totalARS)}`, sub: `${report.month.txCount} movimientos`, color: COL_ACCENT },
      { label: 'Ingreso del mes', value: `$${fmtN(report.income.totalARS)}`, sub: report.incomeUsedPct != null ? `${report.incomeUsedPct}% utilizado` : 'Sin registrar', color: COL_SUCCESS },
      { label: 'Margen disponible', value: report.marginARS != null ? `$${fmtN(report.marginARS)}` : '—', sub: report.marginARS != null && report.marginARS < 0 ? 'DÉFICIT' : 'Este mes', color: report.marginARS != null && report.marginARS < 0 ? COL_DANGER : COL_SUCCESS },
    ];

    y = drawKPIGrid(doc, kpis, y, W);
    y += 8;

    // Comparación semanal
    if (report.weekVsPrevPct != null) {
      const arrow = report.weekVsPrevPct > 0 ? '↑' : report.weekVsPrevPct < 0 ? '↓' : '→';
      const color = report.weekVsPrevPct > 10 ? COL_DANGER : report.weekVsPrevPct < -5 ? COL_SUCCESS : COL_GRAY;
      doc.font('Helvetica').fontSize(9).fillColor(color)
        .text(`${arrow} ${Math.abs(report.weekVsPrevPct)}% vs semana anterior ($${fmtN(report.prevWeek.totalARS)})`, 50, y, { width: W });
      y += 18;
    }

    // ════════════════════════════════════════════════
    // CATEGORÍAS
    // ════════════════════════════════════════════════
    y = checkPageBreak(doc, y, 200);
    y = sectionTitle(doc, 'Categorías principales (mes)', y, W);

    if (report.categories.length) {
      // Header
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COL_GRAY);
      doc.text('Categoría', 50, y, { width: 200 });
      doc.text('Monto', 300, y, { width: 100, align: 'right' });
      doc.text('%', 420, y, { width: 60, align: 'right' });
      y += 14;

      doc.moveTo(50, y).lineTo(50 + W, y).strokeColor('#E5E5EA').lineWidth(0.5).stroke();
      y += 6;

      report.categories.forEach((cat, i) => {
        y = checkPageBreak(doc, y, 20);
        const bg = i % 2 === 0 ? '#FAFAFA' : '#FFFFFF';
        doc.rect(50, y - 2, W, 18).fill(bg);

        doc.font('Helvetica').fontSize(9).fillColor('#1D1D1F');
        doc.text(cat.name, 55, y, { width: 240 });
        doc.text(`$${fmtN(cat.totalARS)}`, 300, y, { width: 100, align: 'right' });

        // Mini barra
        const barW = Math.min(cat.pct, 100) * 0.5;
        doc.rect(430, y + 1, barW, 8).fill(COL_ACCENT + '44');
        doc.font('Helvetica').fontSize(8).fillColor(COL_GRAY)
          .text(`${cat.pct}%`, 485, y, { width: 40, align: 'right' });

        y += 18;
      });
    }
    y += 6;

    // ════════════════════════════════════════════════
    // COMPROMISOS
    // ════════════════════════════════════════════════
    y = checkPageBreak(doc, y, 120);
    y = sectionTitle(doc, 'Compromisos fijos', y, W);

    const commitKpis = [
      { label: 'Gastos fijos', value: `$${fmtN(report.fixedExpenses.gastosFijos)}`, sub: 'Mensuales', color: COL_GRAY },
      { label: 'Suscripciones', value: `$${fmtN(report.fixedExpenses.suscripciones)}`, sub: 'Activas', color: COL_GRAY },
      { label: 'Cuotas', value: `$${fmtN(report.cuotas.monthlyARS)}`, sub: `${report.cuotas.active} activas`, color: COL_GRAY },
      { label: 'Total compromisos', value: `$${fmtN(report.commitments.totalARS)}`, sub: 'Por mes', color: COL_ACCENT },
    ];
    y = drawKPIGrid(doc, commitKpis, y, W);
    y += 6;

    // Cuotas detalle
    if (report.cuotas.items.length) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COL_GRAY).text('Cuotas activas:', 50, y);
      y += 14;
      report.cuotas.items.forEach(c => {
        y = checkPageBreak(doc, y, 16);
        doc.font('Helvetica').fontSize(8).fillColor('#1D1D1F')
          .text(`· ${c.desc}  —  ${c.paid}/${c.total} cuotas  —  $${fmtN(c.monthlyARS)}/mes`, 55, y, { width: W - 10 });
        y += 14;
      });
    }

    // ════════════════════════════════════════════════
    // AHORROS
    // ════════════════════════════════════════════════
    y = checkPageBreak(doc, y, 120);
    y = sectionTitle(doc, 'Ahorros', y, W);

    const savKpis = [
      { label: 'Total ARS', value: `$${fmtN(report.savings.totalARS)}`, sub: '', color: COL_SUCCESS },
      { label: 'Total USD', value: `U$D ${fmtN(report.savings.totalUSD)}`, sub: '', color: '#007AFF' },
      { label: 'Equivalente ARS', value: `$${fmtN(report.savings.equivARS)}`, sub: `TC $${fmtN(report.usdRate)}`, color: COL_ACCENT },
    ];
    y = drawKPIRow(doc, savKpis, y, W);
    y += 8;

    // Metas
    if (report.savings.goals.length) {
      report.savings.goals.forEach(g => {
        y = checkPageBreak(doc, y, 35);
        const prefix = g.currency === 'USD' ? 'U$D ' : '$';
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1D1D1F')
          .text(`${g.emoji || '🎯'} ${g.name}`, 55, y, { width: 200 });
        doc.font('Helvetica').fontSize(8).fillColor(COL_GRAY)
          .text(`${prefix}${fmtN(g.current)} de ${prefix}${fmtN(g.target)}  ·  ${g.pct}%`, 280, y, { width: 200, align: 'right' });
        y += 14;
        // Progress bar
        doc.rect(55, y, W - 10, 6).fill(COL_LIGHT);
        doc.rect(55, y, Math.min(g.pct, 100) / 100 * (W - 10), 6).fill(g.pct >= 100 ? COL_SUCCESS : COL_ACCENT);
        y += 16;
      });
    }

    // ════════════════════════════════════════════════
    // PROYECCIÓN
    // ════════════════════════════════════════════════
    y = checkPageBreak(doc, y, 80);
    y = sectionTitle(doc, 'Proyección al cierre del mes', y, W);

    doc.font('Helvetica').fontSize(9).fillColor('#1D1D1F');
    doc.text(`Promedio diario: $${fmtN(report.projection.dailyAvg)}`, 55, y);
    y += 14;
    doc.text(`Proyección total del mes: $${fmtN(report.projection.projectedMonthTotal)}`, 55, y);
    y += 14;
    doc.text(`Días restantes: ${report.projection.daysRemaining}`, 55, y);
    y += 14;
    if (report.budgetRemaining != null) {
      const color = report.budgetRemaining >= 0 ? COL_SUCCESS : COL_DANGER;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(color)
        .text(`Presupuesto libre (ingreso - gasto - compromisos): $${fmtN(report.budgetRemaining)}`, 55, y);
      y += 16;
    }

    // ════════════════════════════════════════════════
    // ALERTAS
    // ════════════════════════════════════════════════
    if (report.alerts.length) {
      y = checkPageBreak(doc, y, 60);
      y = sectionTitle(doc, 'Alertas', y, W);

      report.alerts.forEach(a => {
        y = checkPageBreak(doc, y, 16);
        doc.rect(50, y - 2, W, 18).fill('#FFF3CD');
        doc.font('Helvetica').fontSize(9).fillColor('#856404').text(a, 55, y, { width: W - 10 });
        y += 20;
      });
    }

    // ════════════════════════════════════════════════
    // INSIGHTS IA
    // ════════════════════════════════════════════════
    if (aiInsights) {
      y = checkPageBreak(doc, y, 150);
      y = sectionTitle(doc, 'Análisis y recomendaciones (IA)', y, W);

      if (aiInsights.resumen) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1D1D1F').text('Resumen:', 55, y);
        y += 14;
        doc.font('Helvetica').fontSize(9).fillColor('#3A3A3C').text(aiInsights.resumen, 55, y, { width: W - 10 });
        y = doc.y + 12;
      }

      if (aiInsights.insights?.length) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1D1D1F').text('Insights clave:', 55, y);
        y += 14;
        aiInsights.insights.forEach((ins, i) => {
          y = checkPageBreak(doc, y, 16);
          doc.font('Helvetica').fontSize(9).fillColor('#3A3A3C')
            .text(`${i + 1}. ${ins}`, 60, y, { width: W - 20 });
          y = doc.y + 6;
        });
      }

      if (aiInsights.recomendaciones?.length) {
        y += 4;
        y = checkPageBreak(doc, y, 16);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1D1D1F').text('Recomendaciones para esta semana:', 55, y);
        y += 14;
        aiInsights.recomendaciones.forEach((rec, i) => {
          y = checkPageBreak(doc, y, 16);
          doc.font('Helvetica').fontSize(9).fillColor('#3A3A3C')
            .text(`${i + 1}. ${rec}`, 60, y, { width: W - 20 });
          y = doc.y + 6;
        });
      }
    }

    // ════════════════════════════════════════════════
    // FOOTER
    // ════════════════════════════════════════════════
    doc.font('Helvetica').fontSize(7).fillColor(COL_GRAY)
      .text('Generado automáticamente por Registro de Finanzas', 50, doc.page.height - 40, {
        width: W, align: 'center',
      });

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

// ── Helpers ──

function sectionTitle(doc, text, y, W) {
  y += 8;
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#1D1D1F').text(text, 50, y, { width: W });
  y += 18;
  doc.moveTo(50, y).lineTo(50 + W, y).strokeColor('#E5E5EA').lineWidth(0.5).stroke();
  y += 10;
  return y;
}

function drawKPIGrid(doc, kpis, y, W) {
  const colW = (W - 12) / 2;
  const rowH = 52;

  kpis.forEach((kpi, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 50 + col * (colW + 12);
    const ky = y + row * (rowH + 8);

    doc.rect(x, ky, colW, rowH).fill('#F9F9FB');
    doc.font('Helvetica').fontSize(8).fillColor('#8E8E93').text(kpi.label, x + 12, ky + 8, { width: colW - 24 });
    doc.font('Helvetica-Bold').fontSize(16).fillColor(kpi.color || '#1D1D1F').text(kpi.value, x + 12, ky + 20, { width: colW - 24 });
    if (kpi.sub) {
      doc.font('Helvetica').fontSize(7).fillColor('#AEAEB2').text(kpi.sub, x + 12, ky + 40, { width: colW - 24 });
    }
  });

  const rows = Math.ceil(kpis.length / 2);
  return y + rows * (rowH + 8);
}

function drawKPIRow(doc, kpis, y, W) {
  const colW = (W - (kpis.length - 1) * 10) / kpis.length;
  const rowH = 48;

  kpis.forEach((kpi, i) => {
    const x = 50 + i * (colW + 10);
    doc.rect(x, y, colW, rowH).fill('#F9F9FB');
    doc.font('Helvetica').fontSize(8).fillColor('#8E8E93').text(kpi.label, x + 10, y + 6, { width: colW - 20 });
    doc.font('Helvetica-Bold').fontSize(14).fillColor(kpi.color || '#1D1D1F').text(kpi.value, x + 10, y + 18, { width: colW - 20 });
    if (kpi.sub) doc.font('Helvetica').fontSize(7).fillColor('#AEAEB2').text(kpi.sub, x + 10, y + 36, { width: colW - 20 });
  });

  return y + rowH + 6;
}

function checkPageBreak(doc, y, needed) {
  if (y + needed > doc.page.height - 60) {
    doc.addPage();
    return 50;
  }
  return y;
}

module.exports = { generatePDF };
