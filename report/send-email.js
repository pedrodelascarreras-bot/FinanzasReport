/**
 * send-email.js — Envía el reporte por email usando Resend
 * 
 * Requiere: RESEND_API_KEY, REPORT_TO_EMAIL, REPORT_FROM_EMAIL
 */

const { Resend } = require('resend');
const fs = require('fs');

function fmtN(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

async function sendReportEmail(report, aiInsights, pdfPath, options = {}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_TO_EMAIL;
  const from = process.env.REPORT_FROM_EMAIL || 'Finanzas <onboarding@resend.dev>';

  if (!apiKey) throw new Error('RESEND_API_KEY no configurada');
  if (!to) throw new Error('REPORT_TO_EMAIL no configurado');

  const resend = new Resend(apiKey);
  const periodKey = options.period || 'week';
  const periodTitle =
    periodKey === 'tc' ? 'Ciclo de tarjeta' :
    periodKey === 'month' ? 'Mes actual' :
    'Semana actual';
  const subject =
    periodKey === 'tc'
      ? '📊 Reporte Financiero — Ciclo de tarjeta'
      : periodKey === 'month'
      ? `📊 Reporte Financiero — ${report.period.monthLabel || 'Mes actual'}`
      : `📊 Reporte Financiero — Semana del ${formatDateShort(report.period.weekStart)}`;
  const primaryDate =
    periodKey === 'tc'
      ? `${report.period.ccCycleStart ? formatDateShort(report.period.ccCycleStart) : '—'} — ${report.period.ccCycleClose ? formatDateShort(report.period.ccCycleClose) : '—'}`
      : periodKey === 'month'
      ? (report.period.monthLabel || 'Mes actual')
      : `${formatDateShort(report.period.weekStart)} — ${formatDateShort(report.period.weekEnd)}`;

  // ── Construir cuerpo del email en HTML ──
  const insightsHtml = (aiInsights?.insights || [])
    .map((ins, i) => `<tr><td style="padding:6px 0;font-size:14px;color:#333;line-height:1.5;"><strong>${i + 1}.</strong> ${ins}</td></tr>`)
    .join('');

  const recsHtml = (aiInsights?.recomendaciones || [])
    .map((rec, i) => `<tr><td style="padding:6px 0;font-size:14px;color:#333;line-height:1.5;"><strong>${i + 1}.</strong> ${rec}</td></tr>`)
    .join('');

  const alertsHtml = (report.alerts || []).length
    ? `<div style="margin:16px 0;padding:12px 16px;background:#FFF3CD;border-radius:8px;border-left:4px solid #FFC107;">
        ${report.alerts.map(a => `<div style="font-size:13px;color:#856404;padding:3px 0;">${a}</div>`).join('')}
       </div>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F5F5F7;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    
    <!-- Header -->
    <div style="background:#1D1D1F;border-radius:12px 12px 0 0;padding:24px 28px;">
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;">📊 Reporte Financiero · ${periodTitle}</h1>
      <p style="margin:6px 0 0;font-size:12px;color:#AEAEB2;">${primaryDate} · TC: $${fmtN(report.usdRate)}</p>
    </div>
    
    <!-- Body -->
    <div style="background:#fff;padding:24px 28px;border-radius:0 0 12px 12px;">
      
      <!-- Resumen ejecutivo -->
      <p style="font-size:15px;color:#1D1D1F;line-height:1.6;margin:0 0 20px;">
        ${aiInsights?.resumen || `Esta semana gastaste $${fmtN(report.week.totalARS)} ARS.`}
      </p>
      
      <!-- KPIs -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td style="padding:8px;background:#F9F9FB;border-radius:8px;text-align:center;width:33%;">
            <div style="font-size:11px;color:#8E8E93;margin-bottom:4px;">Gasto semanal</div>
            <div style="font-size:18px;font-weight:700;color:#0066FF;">$${fmtN(report.week.totalARS)}</div>
          </td>
          <td width="8"></td>
          <td style="padding:8px;background:#F9F9FB;border-radius:8px;text-align:center;width:33%;">
            <div style="font-size:11px;color:#8E8E93;margin-bottom:4px;">Gasto mensual</div>
            <div style="font-size:18px;font-weight:700;color:#0066FF;">$${fmtN(report.month.totalARS)}</div>
          </td>
          <td width="8"></td>
          <td style="padding:8px;background:#F9F9FB;border-radius:8px;text-align:center;width:33%;">
            <div style="font-size:11px;color:#8E8E93;margin-bottom:4px;">Margen</div>
            <div style="font-size:18px;font-weight:700;color:${report.marginARS != null && report.marginARS < 0 ? '#FF3B30' : '#34C759'};">
              ${report.marginARS != null ? '$' + fmtN(report.marginARS) : '—'}
            </div>
          </td>
        </tr>
      </table>

      ${alertsHtml}
      
      <!-- Insights -->
      ${insightsHtml ? `
      <h3 style="font-size:14px;color:#1D1D1F;margin:20px 0 8px;border-bottom:1px solid #E5E5EA;padding-bottom:6px;">🔍 Insights clave</h3>
      <table width="100%" cellpadding="0" cellspacing="0">${insightsHtml}</table>
      ` : ''}
      
      <!-- Recomendaciones -->
      ${recsHtml ? `
      <h3 style="font-size:14px;color:#1D1D1F;margin:20px 0 8px;border-bottom:1px solid #E5E5EA;padding-bottom:6px;">💡 Recomendaciones</h3>
      <table width="100%" cellpadding="0" cellspacing="0">${recsHtml}</table>
      ` : ''}
      
      <p style="font-size:12px;color:#AEAEB2;margin:24px 0 0;text-align:center;">
        📎 Vas a recibir el reporte técnico y una versión visual inspirada en la vista previa de la app
      </p>
    </div>
    
    <p style="font-size:10px;color:#C7C7CC;text-align:center;margin:12px 0 0;">
      Generado automáticamente por Registro de Finanzas
    </p>
  </div>
</body>
</html>`;

  // ── Enviar ──
  const attachments = [];
  const pdfBuffer = fs.readFileSync(pdfPath);
  const fileStamp =
    periodKey === 'tc'
      ? formatDateFile(report.period.ccCycleClose || report.period.weekEnd)
      : periodKey === 'month'
      ? String(report.period.monthKey || formatDateFile(report.period.weekEnd))
      : formatDateFile(report.period.weekEnd);
  const fileName = `reporte-financiero-${periodKey}-${fileStamp}.pdf`;
  attachments.push({
    filename: fileName,
    content: pdfBuffer.toString('base64'),
    contentType: 'application/pdf',
  });

  if (options.previewAttachment?.contentBase64) {
    attachments.push({
      filename: options.previewAttachment.filename || `reporte-financiero-vista-previa-${periodKey}-${fileStamp}.pdf`,
      content: options.previewAttachment.contentBase64,
      contentType: 'application/pdf',
    });
  } else if (options.previewPdfPath) {
    const previewBuffer = fs.readFileSync(options.previewPdfPath);
    const previewFileName = `reporte-financiero-vista-previa-${periodKey}-${fileStamp}.pdf`;
    attachments.push({
      filename: previewFileName,
      content: previewBuffer.toString('base64'),
      contentType: 'application/pdf',
    });
  }

  const result = await resend.emails.send({
    from,
    to: [to],
    subject,
    html,
    attachments,
  });

  console.log(`✓ Email enviado a ${to} (ID: ${result.data?.id || 'ok'})`);
  return result;
}

function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function formatDateFile(iso) {
  return new Date(iso).toISOString().split('T')[0];
}

module.exports = { sendReportEmail };
