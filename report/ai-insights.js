/**
 * ai-insights.js — Genera insights y recomendaciones con IA
 * Usa Claude (Anthropic) por defecto. Fácil de cambiar a OpenAI.
 * 
 * Requiere: ANTHROPIC_API_KEY
 */

const Anthropic = require('@anthropic-ai/sdk').default;
const fs = require('fs');
const path = require('path');

// Prompt del sistema — separado para fácil edición
const SYSTEM_PROMPT = `Sos un asesor financiero personal argentino. Tu cliente es una persona joven que trackea sus finanzas personales en pesos argentinos (ARS) y dólares (USD).

Recibís un JSON con el resumen financiero de la semana y del mes. Tu trabajo es:

1. RESUMEN: Un párrafo corto (2-3 oraciones) con lo más importante del período.

2. INSIGHTS: Exactamente 3 observaciones clave sobre los datos. Sé específico, mencioná números. No repitas lo que ya dicen las alertas.

3. RECOMENDACIONES: Exactamente 3 acciones concretas para la próxima semana. Que sean prácticas y accionables, no genéricas.

Respondé ÚNICAMENTE en JSON válido con esta estructura exacta:
{
  "resumen": "string",
  "insights": ["string", "string", "string"],
  "recomendaciones": ["string", "string", "string"]
}

Reglas:
- Hablá en español rioplatense (vos, tenés, podés)
- Sé directo, no uses frases motivacionales vacías
- Si hay déficit o alertas, priorizá eso
- Mencioná montos concretos cuando sea relevante
- No uses emojis en el JSON
- Máximo 60 palabras por insight/recomendación`;

async function generateInsights(report) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('⚠️ ANTHROPIC_API_KEY no configurada — generando insights básicos');
    return generateFallbackInsights(report);
  }

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: `Analizá este reporte financiero y respondé en JSON:\n\n${JSON.stringify(report, null, 2)}`,
        },
      ],
      system: SYSTEM_PROMPT,
    });

    const text = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Limpiar posibles backticks de markdown
    const clean = text.replace(/```json\s*|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Validar estructura
    if (!parsed.resumen || !Array.isArray(parsed.insights) || !Array.isArray(parsed.recomendaciones)) {
      throw new Error('Estructura de respuesta IA inválida');
    }

    console.log('✓ Insights generados con IA');
    return parsed;
  } catch (err) {
    console.error('Error generando insights con IA:', err.message);
    console.log('→ Usando fallback local');
    return generateFallbackInsights(report);
  }
}

/**
 * Fallback: genera insights básicos sin IA (por si falla la API o no hay key)
 */
function generateFallbackInsights(report) {
  const insights = [];
  const recs = [];

  // Insight 1: gasto semanal vs anterior
  if (report.weekVsPrevPct != null) {
    if (report.weekVsPrevPct > 0) {
      insights.push(`Gastaste ${report.weekVsPrevPct}% más que la semana pasada ($${fmtN(report.week.totalARS)} vs $${fmtN(report.prevWeek.totalARS)}).`);
    } else {
      insights.push(`Redujiste el gasto un ${Math.abs(report.weekVsPrevPct)}% respecto a la semana anterior.`);
    }
  } else {
    insights.push(`Esta semana gastaste $${fmtN(report.week.totalARS)} en ${report.week.txCount} movimientos.`);
  }

  // Insight 2: categoría principal
  if (report.topCategory) {
    insights.push(`"${report.topCategory.name}" es tu categoría más fuerte con el ${report.topCategory.pct}% del gasto mensual.`);
  }

  // Insight 3: uso del ingreso
  if (report.incomeUsedPct != null) {
    insights.push(`Llevás usado el ${report.incomeUsedPct}% del ingreso mensual con ${report.projection.daysRemaining} días restantes.`);
  } else {
    insights.push(`Tenés $${fmtN(report.month.totalARS)} en gastos este mes.`);
  }

  // Rec 1
  if (report.marginARS != null && report.marginARS < 0) {
    recs.push('Estás en déficit. Revisá si podés postergar compras no esenciales esta semana.');
  } else if (report.incomeUsedPct != null && report.incomeUsedPct > 70) {
    recs.push(`Ya usaste ${report.incomeUsedPct}% del ingreso. Intentá que el gasto diario no supere $${fmtN(Math.round(report.projection.dailyAvg * 0.8))} esta semana.`);
  } else {
    recs.push('Buen ritmo de gasto. Mantené el promedio diario actual y vas a cerrar bien el mes.');
  }

  // Rec 2
  if (report.topCategory && report.topCategory.pct > 30) {
    recs.push(`Revisá los gastos en "${report.topCategory.name}" — concentra el ${report.topCategory.pct}% del total.`);
  } else {
    recs.push('Tu gasto está bien distribuido entre categorías. Seguí así.');
  }

  // Rec 3
  recs.push('Verificá que tus suscripciones y gastos fijos estén actualizados en la app.');

  return {
    resumen: `Esta semana gastaste $${fmtN(report.week.totalARS)} ARS. En el mes llevás $${fmtN(report.month.totalARS)} de $${fmtN(report.income.totalARS)} de ingreso.`,
    insights: insights.slice(0, 3),
    recomendaciones: recs.slice(0, 3),
  };
}

function fmtN(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

module.exports = { generateInsights };
