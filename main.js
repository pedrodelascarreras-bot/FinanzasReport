/**
 * main.js — Orquestador del reporte financiero semanal
 * 
 * Pipeline:
 * 1. Descargar datos de Google Drive
 * 2. Construir reporte estructurado
 * 3. Generar insights con IA
 * 4. Generar PDF
 * 5. Enviar email
 * 
 * Uso: node scripts/main.js
 * Variables de entorno necesarias — ver README.md
 */

const path = require('path');
const { fetchFinanceData } = require('./fetch-data');
const { buildReport } = require('./build-report');
const { generateInsights } = require('./ai-insights');
const { generatePDF } = require('./generate-pdf');
const { sendReportEmail } = require('./send-email');

async function run() {
  const startTime = Date.now();
  console.log('═══════════════════════════════════════════');
  console.log('  📊 Reporte Financiero Semanal');
  console.log(`  ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`);
  console.log('═══════════════════════════════════════════\n');

  try {
    // ── Paso 1: Obtener datos ──
    console.log('📂 Paso 1/5: Descargando datos de Google Drive...');
    const { data, lastModified } = await fetchFinanceData();
    console.log(`   Última modificación: ${new Date(lastModified).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}\n`);

    // Verificar que los datos no estén demasiado desactualizados
    const hoursOld = (Date.now() - new Date(lastModified).getTime()) / (1000 * 60 * 60);
    if (hoursOld > 72) {
      console.warn(`   ⚠️ ATENCIÓN: Los datos tienen ${Math.round(hoursOld)} horas de antigüedad.`);
      console.warn('   Asegurate de abrir la app y sincronizar con Google.\n');
    }

    // ── Paso 2: Construir reporte ──
    console.log('📊 Paso 2/5: Construyendo reporte...');
    const report = buildReport(data);
    console.log(`   Semana: ${report.week.txCount} transacciones, $${fmtN(report.week.totalARS)} ARS`);
    console.log(`   Mes: ${report.month.txCount} transacciones, $${fmtN(report.month.totalARS)} ARS`);
    console.log(`   Alertas: ${report.alerts.length}\n`);

    // ── Paso 3: Generar insights con IA ──
    console.log('🤖 Paso 3/5: Generando insights con IA...');
    const aiInsights = await generateInsights(report);
    console.log(`   Resumen: ${aiInsights.resumen.substring(0, 80)}...`);
    console.log(`   ${aiInsights.insights.length} insights, ${aiInsights.recomendaciones.length} recomendaciones\n`);

    // ── Paso 4: Generar PDF ──
    console.log('📄 Paso 4/5: Generando PDF...');
    const pdfPath = path.join(__dirname, '..', 'reporte-semanal.pdf');
    await generatePDF(report, aiInsights, pdfPath);
    console.log(`   PDF guardado: ${pdfPath}\n`);

    // ── Paso 5: Enviar email ──
    console.log('📧 Paso 5/5: Enviando email...');
    await sendReportEmail(report, aiInsights, pdfPath);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n═══════════════════════════════════════════');
    console.log(`  ✅ Reporte enviado exitosamente (${elapsed}s)`);
    console.log('═══════════════════════════════════════════');

  } catch (err) {
    console.error('\n❌ Error en el pipeline:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

function fmtN(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

run();
