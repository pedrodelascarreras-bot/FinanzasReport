/**
 * generate-preview-pdf.js — Variante de PDF con look más cercano a la vista previa de la app
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');

const C = {
  page: '#F5F7FB',
  panel: '#FFFFFF',
  border: '#E7ECF3',
  text: '#111827',
  text2: '#667085',
  text3: '#98A2B3',
  blue: '#3B82F6',
  green: '#30C76A',
  orange: '#FF7A1A',
  red: '#EF4444',
  softBlue: '#ECF3FF',
};

function fmtN(n, digits = 0) {
  if (n == null || Number.isNaN(Number(n))) return '--';
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function shortDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function moneyLabel(n) {
  return `$${fmtN(n)}`;
}

async function generatePreviewPDF(report, aiInsights, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 0, bottom: 32, left: 0, right: 0 },
      bufferPages: true,
      info: { Title: 'Reporte Financiero — Vista previa app', Author: 'Registro de Finanzas' },
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    const PW = doc.page.width;
    const PH = doc.page.height;
    const MX = 28;
    const W = PW - MX * 2;
    const GAP = 12;

    doc.rect(0, 0, PW, PH).fill(C.page);

    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.blue)
      .text('FINANZAS', MX, 22, { characterSpacing: 1.8 });
    doc.font('Helvetica-Bold').fontSize(28).fillColor(C.text)
      .text('Reporte ejecutivo', MX, 40, { width: W });
    doc.font('Helvetica').fontSize(10).fillColor(C.text2)
      .text(`Período ${shortDate(report.period.weekStart)} → ${shortDate(report.period.weekEnd)} · Generado ${new Date(report.generatedAt).toLocaleDateString('es-AR')}`, MX, 74, { width: W });

    let y = 104;

    // Hero
    drawPanel(doc, MX, y, W * 0.62, 160);
    drawPanel(doc, MX + W * 0.62 + GAP, y, W * 0.38 - GAP, 160);

    doc.font('Helvetica').fontSize(8).fillColor(C.text3)
      .text('GASTO TOTAL DEL PERÍODO', MX + 18, y + 18, { width: 220 });
    doc.font('Helvetica-Bold').fontSize(30).fillColor(C.text)
      .text(moneyLabel(report.month.totalARS), MX + 18, y + 38, { width: 300 });

    const incomePct = report.incomeUsedPct != null ? `${report.incomeUsedPct}% del ingreso` : 'Sin ingreso base';
    doc.font('Helvetica-Bold').fontSize(12).fillColor(C.text2)
      .text(incomePct, MX + 18, y + 86, { width: 220 });

    drawMiniStat(doc, MX + 18, y + 110, 170, 34, 'Margen disponible', report.marginARS != null ? moneyLabel(report.marginARS) : '--', report.marginARS != null && report.marginARS < 0 ? C.red : C.green);
    drawMiniStat(doc, MX + 198, y + 110, 150, 34, 'Compromisos', moneyLabel(report.commitments.totalARS), C.orange);

    const sideX = MX + W * 0.62 + GAP + 18;
    doc.font('Helvetica').fontSize(8).fillColor(C.text3)
      .text('RESUMEN RÁPIDO', sideX, y + 18, { width: 180 });
    doc.font('Helvetica-Bold').fontSize(26).fillColor(C.orange)
      .text(moneyLabel(report.ccCycle?.projectedClose || report.month.totalARS), sideX, y + 40, { width: 170 });
    doc.font('Helvetica').fontSize(9).fillColor(C.text2)
      .text('Proyección al cierre', sideX, y + 74, { width: 160 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.text)
      .text(`Dólar oficial ${moneyLabel(report.usdRate)}`, sideX, y + 100, { width: 180 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.text)
      .text(`Cuotas activas ${report.cuotas.active || 0}`, sideX, y + 122, { width: 180 });

    y += 180;

    // Timeline + categories
    const leftW = W * 0.52;
    const rightW = W - leftW - GAP;
    drawPanel(doc, MX, y, leftW, 214);
    drawPanel(doc, MX + leftW + GAP, y, rightW, 214);

    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.text)
      .text('Agenda financiera', MX + 18, y + 18, { width: 220 });
    doc.font('Helvetica').fontSize(8).fillColor(C.text3)
      .text('Próximos 3 hitos útiles', MX + 18, y + 34, { width: 220 });

    const timelineItems = buildTimelineItems(report);
    let itemY = y + 60;
    timelineItems.forEach((item, idx) => {
      drawTimelineRow(doc, MX + 18, itemY, leftW - 36, item, idx === timelineItems.length - 1);
      itemY += 48;
    });

    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.text)
      .text('Categorías dominantes', MX + leftW + GAP + 18, y + 18, { width: 220 });
    doc.font('Helvetica').fontSize(8).fillColor(C.text3)
      .text('Dónde se está yendo más plata', MX + leftW + GAP + 18, y + 34, { width: 220 });

    let catY = y + 62;
    (report.categoryGroups || []).slice(0, 4).forEach((cat, idx) => {
      drawCategoryRow(doc, MX + leftW + GAP + 18, catY, rightW - 36, cat, idx);
      catY += 30;
    });

    y += 234;

    // Insights + alerts
    drawPanel(doc, MX, y, W, 220);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.text)
      .text('Lectura asistida', MX + 18, y + 18, { width: 200 });

    const summary = aiInsights?.resumen || `El período cerró con ${moneyLabel(report.month.totalARS)} y ${report.alerts?.length || 0} alertas activas.`;
    doc.font('Helvetica').fontSize(10).fillColor(C.text2)
      .text(summary, MX + 18, y + 38, { width: W - 36, lineGap: 3 });

    let insightY = y + 92;
    (aiInsights?.insights || []).slice(0, 3).forEach((item, idx) => {
      drawBulletRow(doc, MX + 18, insightY, W - 36, idx + 1, item, C.blue);
      insightY += 32;
    });

    let alertY = insightY + 6;
    (report.alerts || []).slice(0, 2).forEach((alert) => {
      drawAlertPill(doc, MX + 18, alertY, W - 36, alert);
      alertY += 28;
    });

    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(7).fillColor(C.text3)
        .text('Vista previa app · Registro de Finanzas', MX, PH - 20, { width: W * 0.6 });
      doc.text(`${i + 1}/${totalPages}`, MX + W * 0.6, PH - 20, { width: W * 0.4, align: 'right' });
    }

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

function buildTimelineItems(report) {
  const items = [];
  if (report.ccCycle?.daysLeft != null && report.ccCycle.daysLeft <= 7) {
    items.push({
      title: 'Cierre de tarjeta',
      meta: `En ${report.ccCycle.daysLeft} días`,
      amount: moneyLabel(report.ccCycle.projectedClose || report.ccCycle.totalARS),
      color: C.orange,
    });
  }
  (report.subscriptionsList || []).slice(0, 2).forEach(sub => {
    items.push({
      title: sub.name,
      meta: 'Suscripción',
      amount: moneyLabel(sub.amountARS),
      color: C.blue,
    });
  });
  (report.cuotas.items || []).slice(0, 3).forEach(c => {
    if (items.length >= 3) return;
    items.push({
      title: c.desc,
      meta: `${c.paid}/${c.total} pagadas`,
      amount: moneyLabel(c.monthlyARS),
      color: C.green,
    });
  });
  while (items.length < 3) {
    items.push({
      title: 'Sin evento crítico',
      meta: 'Agenda en orden',
      amount: moneyLabel(0),
      color: C.text3,
    });
  }
  return items.slice(0, 3);
}

function drawPanel(doc, x, y, w, h) {
  doc.save();
  doc.roundedRect(x, y, w, h, 22).fillAndStroke(C.panel, C.border);
  doc.restore();
}

function drawMiniStat(doc, x, y, w, h, label, value, color) {
  doc.roundedRect(x, y, w, h, 12).fillAndStroke('#F8FAFC', C.border);
  doc.font('Helvetica').fontSize(7).fillColor(C.text3)
    .text(label.toUpperCase(), x + 12, y + 8, { width: w - 24 });
  doc.font('Helvetica-Bold').fontSize(12).fillColor(color || C.text)
    .text(value, x + 12, y + 18, { width: w - 24 });
}

function drawTimelineRow(doc, x, y, w, item, isLast) {
  doc.circle(x + 6, y + 10, 4).fill(item.color || C.blue);
  if (!isLast) {
    doc.moveTo(x + 6, y + 16).lineTo(x + 6, y + 42).strokeColor('#D9E5F6').lineWidth(1.2).stroke();
  }
  doc.font('Helvetica-Bold').fontSize(12).fillColor(C.text)
    .text(item.title, x + 18, y, { width: w - 120, ellipsis: true });
  doc.font('Helvetica').fontSize(9).fillColor(C.text2)
    .text(item.meta, x + 18, y + 16, { width: w - 120 });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.text)
    .text(item.amount, x + w - 100, y + 6, { width: 100, align: 'right' });
}

function drawCategoryRow(doc, x, y, w, cat, idx) {
  const colors = [C.blue, '#D94CF2', '#FB923C', '#10B981'];
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.text)
    .text(cat.group, x, y, { width: w - 110 });
  doc.font('Helvetica').fontSize(9).fillColor(C.text2)
    .text(moneyLabel(cat.totalARS), x + w - 110, y, { width: 70, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(C.text2)
    .text(`${cat.pct}%`, x + w - 36, y, { width: 36, align: 'right' });
  doc.roundedRect(x, y + 16, w, 6, 3).fill('#EEF2F6');
  doc.roundedRect(x, y + 16, Math.max(12, (w * Math.min(cat.pct, 100)) / 100), 6, 3).fill(colors[idx % colors.length]);
}

function drawBulletRow(doc, x, y, w, num, text, color) {
  doc.circle(x + 8, y + 8, 8).fill(color);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF')
    .text(String(num), x + 4, y + 4, { width: 8, align: 'center' });
  doc.font('Helvetica').fontSize(9.5).fillColor(C.text)
    .text(text, x + 22, y + 1, { width: w - 22, lineGap: 2 });
}

function drawAlertPill(doc, x, y, w, text) {
  doc.roundedRect(x, y, w, 22, 11).fill(C.softBlue);
  doc.font('Helvetica').fontSize(8.5).fillColor(C.blue)
    .text(text, x + 12, y + 7, { width: w - 24, ellipsis: true });
}

module.exports = { generatePreviewPDF };
