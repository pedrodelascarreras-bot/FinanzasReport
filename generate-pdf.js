/**
 * generate-pdf.js — PDF limpio sin emojis (Helvetica no los soporta)
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');

function fmtN(n) {
  if (n == null || isNaN(n)) return '--';
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function shortDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

async function generatePDF(report, aiInsights, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
      info: { Title: 'Reporte Financiero Semanal', Author: 'Registro de Finanzas' },
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    const W = doc.page.width - 100;
    const BLUE = '#0066FF';
    const RED = '#FF3B30';
    const GREEN = '#34C759';
    const GRAY = '#8E8E93';
    const LGRAY = '#F2F2F7';
    const DARK = '#1D1D1F';

    // ── HEADER ──
    doc.rect(0, 0, doc.page.width, 90).fill(DARK);
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#FFFFFF')
      .text('Reporte Financiero Semanal', 50, 25, { width: W });
    doc.font('Helvetica').fontSize(9).fillColor('#AEAEB2')
      .text(`Semana ${shortDate(report.period.weekStart)} al ${shortDate(report.period.weekEnd)}  |  Generado: ${fmtDate(report.generatedAt)}  |  TC: $${fmtN(report.usdRate)}`, 50, 52, { width: W });

    let y = 110;

    // ── RESUMEN ──
    y = section(doc, 'RESUMEN DEL PERIODO', y, W);

    const kpis = [
      ['Gasto semanal', `$${fmtN(report.week.totalARS)}`, `${report.week.txCount} mov.`, BLUE],
      ['Gasto mensual', `$${fmtN(report.month.totalARS)}`, `${report.month.txCount} mov.`, BLUE],
      ['Ingreso del mes', `$${fmtN(report.income.totalARS)}`, report.incomeUsedPct != null ? `${report.incomeUsedPct}% usado` : 'Sin registrar', GREEN],
      ['Margen disponible', report.marginARS != null ? `$${fmtN(report.marginARS)}` : '--', report.marginARS != null && report.marginARS < 0 ? 'DEFICIT' : 'Este mes', report.marginARS != null && report.marginARS < 0 ? RED : GREEN],
    ];
    y = kpiGrid(doc, kpis, y, W);

    if (report.weekVsPrevPct != null) {
      const dir = report.weekVsPrevPct > 0 ? '+' : '';
      const col = report.weekVsPrevPct > 10 ? RED : report.weekVsPrevPct < -5 ? GREEN : GRAY;
      doc.font('Helvetica').fontSize(9).fillColor(col)
        .text(`${dir}${report.weekVsPrevPct}% vs semana anterior ($${fmtN(report.prevWeek.totalARS)})`, 50, y, { width: W });
      y += 16;
    }

    // ── CATEGORIAS CON SUBCATEGORIAS ──
    y = pageBreak(doc, y, 180);
    y = section(doc, 'CATEGORIAS (MES)', y, W);

    if (report.categoryGroups && report.categoryGroups.length) {
      report.categoryGroups.forEach(grp => {
        y = pageBreak(doc, y, 40);

        // Group header
        doc.rect(50, y - 2, W, 18).fill('#E8E8ED');
        doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK)
          .text(grp.group, 55, y, { width: 220 });
        doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK)
          .text(`$${fmtN(grp.totalARS)}`, 300, y, { width: 100, align: 'right' });
        // Bar
        const barW = Math.min(grp.pct, 100) * 1.2;
        doc.rect(420, y + 2, barW, 10).fill(BLUE);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY)
          .text(`${grp.pct}%`, 480, y, { width: 40, align: 'right' });
        y += 20;

        // Subcategories
        grp.subs.forEach(sub => {
          y = pageBreak(doc, y, 14);
          const subPct = grp.totalARS > 0 ? Math.round((sub.totalARS / report.month.totalARS) * 100) : 0;
          doc.font('Helvetica').fontSize(8).fillColor('#555555')
            .text(`  ${sub.name}`, 65, y, { width: 220 });
          doc.font('Helvetica').fontSize(8).fillColor('#555555')
            .text(`$${fmtN(sub.totalARS)}`, 300, y, { width: 100, align: 'right' });
          doc.font('Helvetica').fontSize(7).fillColor(GRAY)
            .text(`${sub.count} mov.`, 420, y, { width: 50 });
          doc.font('Helvetica').fontSize(7).fillColor(GRAY)
            .text(`${subPct}%`, 480, y, { width: 40, align: 'right' });
          y += 14;
        });
        y += 4;
      });
    }

    // ── COMPROMISOS ──
    y = pageBreak(doc, y, 130);
    y = section(doc, 'COMPROMISOS FIJOS', y, W);

    const commitKpis = [
      ['Gastos fijos', `$${fmtN(report.fixedExpenses.gastosFijos)}`, 'Mensuales', GRAY],
      ['Suscripciones', `$${fmtN(report.fixedExpenses.suscripciones)}`, 'Activas', GRAY],
      ['Cuotas', `$${fmtN(report.cuotas.monthlyARS)}`, `${report.cuotas.active} activas`, GRAY],
      ['Total compromisos', `$${fmtN(report.commitments.totalARS)}`, 'Por mes', BLUE],
    ];
    y = kpiGrid(doc, commitKpis, y, W);

    if (report.cuotas.items.length) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('Cuotas activas:', 50, y);
      y += 14;
      report.cuotas.items.forEach(c => {
        y = pageBreak(doc, y, 14);
        doc.font('Helvetica').fontSize(8).fillColor(DARK)
          .text(`- ${c.desc}  |  ${c.paid}/${c.total} cuotas  |  $${fmtN(c.monthlyARS)}/mes`, 55, y, { width: W - 10 });
        y += 14;
      });
    }

    // ── AHORROS ──
    y = pageBreak(doc, y, 100);
    y = section(doc, 'AHORROS', y, W);

    const savKpis = [
      ['Total ARS', `$${fmtN(report.savings.totalARS)}`, '', GREEN],
      ['Total USD', `U$D ${fmtN(report.savings.totalUSD)}`, '', '#007AFF'],
      ['Equivalente ARS', `$${fmtN(report.savings.equivARS)}`, `TC $${fmtN(report.usdRate)}`, BLUE],
    ];
    y = kpiRow(doc, savKpis, y, W);

    if (report.savings.goals.length) {
      y += 4;
      report.savings.goals.forEach(g => {
        y = pageBreak(doc, y, 30);
        const prefix = g.currency === 'USD' ? 'U$D ' : '$';
        doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK)
          .text(g.name, 55, y, { width: 200 });
        doc.font('Helvetica').fontSize(8).fillColor(GRAY)
          .text(`${prefix}${fmtN(g.current)} de ${prefix}${fmtN(g.target)}  |  ${g.pct}%`, 280, y, { width: 200, align: 'right' });
        y += 13;
        doc.rect(55, y, W - 10, 5).fill(LGRAY);
        doc.rect(55, y, Math.min(g.pct, 100) / 100 * (W - 10), 5).fill(g.pct >= 100 ? GREEN : BLUE);
        y += 14;
      });
    }

    // ── PROYECCION ──
    y = pageBreak(doc, y, 70);
    y = section(doc, 'PROYECCION AL CIERRE', y, W);

    doc.font('Helvetica').fontSize(9).fillColor(DARK);
    doc.text(`Promedio diario: $${fmtN(report.projection.dailyAvg)}`, 55, y); y += 14;
    doc.text(`Proyeccion total del mes: $${fmtN(report.projection.projectedMonthTotal)}`, 55, y); y += 14;
    doc.text(`Dias restantes: ${report.projection.daysRemaining}`, 55, y); y += 14;
    if (report.budgetRemaining != null) {
      const col = report.budgetRemaining >= 0 ? GREEN : RED;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(col)
        .text(`Presupuesto libre: $${fmtN(report.budgetRemaining)}`, 55, y);
      y += 16;
    }

    // ── ALERTAS ──
    if (report.alerts.length) {
      y = pageBreak(doc, y, 50);
      y = section(doc, 'ALERTAS', y, W);
      report.alerts.forEach(a => {
        y = pageBreak(doc, y, 18);
        doc.rect(50, y - 2, W, 18).fill('#FFF3CD');
        doc.font('Helvetica').fontSize(9).fillColor('#856404')
          .text(`! ${a}`, 55, y, { width: W - 10 });
        y += 20;
      });
    }

    // ── ANALISIS IA ──
    if (aiInsights) {
      y = pageBreak(doc, y, 120);
      y = section(doc, 'ANALISIS Y RECOMENDACIONES', y, W);

      if (aiInsights.resumen) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text('Resumen:', 55, y);
        y += 14;
        doc.font('Helvetica').fontSize(9).fillColor('#3A3A3C').text(aiInsights.resumen, 55, y, { width: W - 10 });
        y = doc.y + 10;
      }

      if (aiInsights.insights && aiInsights.insights.length) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text('Insights clave:', 55, y);
        y += 14;
        aiInsights.insights.forEach((ins, i) => {
          y = pageBreak(doc, y, 14);
          doc.font('Helvetica').fontSize(9).fillColor('#3A3A3C')
            .text(`${i + 1}. ${ins}`, 60, y, { width: W - 20 });
          y = doc.y + 5;
        });
      }

      if (aiInsights.recomendaciones && aiInsights.recomendaciones.length) {
        y += 4;
        y = pageBreak(doc, y, 14);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text('Recomendaciones:', 55, y);
        y += 14;
        aiInsights.recomendaciones.forEach((rec, i) => {
          y = pageBreak(doc, y, 14);
          doc.font('Helvetica').fontSize(9).fillColor('#3A3A3C')
            .text(`${i + 1}. ${rec}`, 60, y, { width: W - 20 });
          y = doc.y + 5;
        });
      }
    }

    // ── FOOTER en cada pagina ──
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(7).fillColor(GRAY)
        .text(`Registro de Finanzas  |  Pag. ${i + 1} de ${totalPages}`, 50, doc.page.height - 35, {
          width: W, align: 'center',
        });
    }

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

// ── Helpers ──

function section(doc, text, y, W) {
  y += 6;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1D1D1F').text(text, 50, y, { width: W });
  y += 16;
  doc.moveTo(50, y).lineTo(50 + W, y).strokeColor('#D1D1D6').lineWidth(0.5).stroke();
  y += 8;
  return y;
}

function kpiGrid(doc, kpis, y, W) {
  const colW = (W - 12) / 2;
  const rowH = 48;
  kpis.forEach((k, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 50 + col * (colW + 12);
    const ky = y + row * (rowH + 6);
    doc.rect(x, ky, colW, rowH).fill('#F9F9FB');
    doc.font('Helvetica').fontSize(8).fillColor('#8E8E93').text(k[0], x + 10, ky + 6, { width: colW - 20 });
    doc.font('Helvetica-Bold').fontSize(15).fillColor(k[3] || '#1D1D1F').text(k[1], x + 10, ky + 18, { width: colW - 20 });
    if (k[2]) doc.font('Helvetica').fontSize(7).fillColor('#AEAEB2').text(k[2], x + 10, ky + 37, { width: colW - 20 });
  });
  return y + Math.ceil(kpis.length / 2) * (rowH + 6) + 4;
}

function kpiRow(doc, kpis, y, W) {
  const colW = (W - (kpis.length - 1) * 10) / kpis.length;
  const rowH = 44;
  kpis.forEach((k, i) => {
    const x = 50 + i * (colW + 10);
    doc.rect(x, y, colW, rowH).fill('#F9F9FB');
    doc.font('Helvetica').fontSize(8).fillColor('#8E8E93').text(k[0], x + 10, y + 6, { width: colW - 20 });
    doc.font('Helvetica-Bold').fontSize(13).fillColor(k[3] || '#1D1D1F').text(k[1], x + 10, y + 18, { width: colW - 20 });
    if (k[2]) doc.font('Helvetica').fontSize(7).fillColor('#AEAEB2').text(k[2], x + 10, y + 34, { width: colW - 20 });
  });
  return y + rowH + 6;
}

function pageBreak(doc, y, needed) {
  if (y + needed > doc.page.height - 55) { doc.addPage(); return 50; }
  return y;
}

module.exports = { generatePDF };
