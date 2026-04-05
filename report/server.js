/**
 * server.js — Servidor HTTP local para trigger manual de reportes
 *
 * Expone un endpoint POST /send-report que ejecuta el pipeline completo:
 * fetchFinanceData → buildReport → generateInsights → generatePDF → sendEmail
 *
 * USO:
 *   node report/server.js
 *
 * El botón "Enviar reporte ahora" de la app llama a http://localhost:3001/send-report
 *
 * Para que esté disponible en Google Cloud Run, deployá este archivo como
 * el entrypoint del contenedor (en vez de main.js) y exponé el puerto 8080.
 */

const http = require('http');
const path = require('path');
const { fetchFinanceData } = require('./fetch-data');
const { buildReport }      = require('./build-report');
const { generateInsights } = require('./ai-insights');
const { generatePDF }      = require('./generate-pdf');
const { sendReportEmail }  = require('./send-email');

const PORT = process.env.PORT || 3001;

// ── CORS helper ─────────────────────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJSON(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// ── Pipeline ─────────────────────────────────────────────────────────────────
async function runReportPipeline(options = {}) {
  const { period = 'week', include = {} } = options;

  console.log(`\n▶ Iniciando pipeline (período: ${period})…`);

  // 1. Datos
  const { data, lastModified } = await fetchFinanceData();
  console.log(`  ✓ Datos obtenidos (última modificación: ${new Date(lastModified).toLocaleString('es-AR')})`);

  // 2. Reporte
  const report = buildReport(data, { period });
  console.log(`  ✓ Reporte construido — ${report.week?.txCount ?? '?'} txns`);

  // 3. Insights IA (sólo si se pidió)
  let aiInsights = null;
  if(include.ai !== false) {
    aiInsights = await generateInsights(report);
    console.log(`  ✓ Insights generados`);
  }

  // 4. PDF
  const pdfPath = path.join(__dirname, `reporte-${period}-${Date.now()}.pdf`);
  await generatePDF(report, aiInsights, pdfPath, { include });
  console.log(`  ✓ PDF generado: ${pdfPath}`);

  // 5. Email
  const result = await sendReportEmail(report, aiInsights, pdfPath, {
    include,
    period,
    previewAttachment: options.previewAttachment || null,
  });
  console.log(`  ✓ Email enviado`);

  return { to: process.env.REPORT_TO_EMAIL, period, pdfPath };
}

// ── Server ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  setCors(res);

  // Pre-flight CORS
  if(req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Health check
  if(req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    sendJSON(res, 200, { status: 'ok', message: 'Servidor de reportes corriendo ✓' });
    return;
  }

  // Trigger de reporte
  if(req.method === 'POST' && req.url === '/send-report') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      let options = {};
      try { options = JSON.parse(body); } catch(_) {}

      try {
        const result = await runReportPipeline(options);
        sendJSON(res, 200, { ok: true, ...result });
      } catch(err) {
        console.error('  ✕ Error en pipeline:', err.message);
        sendJSON(res, 500, { ok: false, error: err.message });
      }
    });
    return;
  }

  sendJSON(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log('════════════════════════════════════════════');
  console.log('  📊 Servidor de reportes financieros');
  console.log(`  Escuchando en http://localhost:${PORT}`);
  console.log('  POST /send-report  → dispara el pipeline');
  console.log('  GET  /             → health check');
  console.log('════════════════════════════════════════════');
  console.log('  Apretá Ctrl+C para detener\n');
});

server.on('error', err => {
  if(err.code === 'EADDRINUSE') {
    console.error(`\n✕ Puerto ${PORT} ya está en uso.`);
    console.error(`  Detené el proceso anterior o cambiá PORT= variable de entorno.\n`);
  } else {
    console.error('Error del servidor:', err);
  }
  process.exit(1);
});
