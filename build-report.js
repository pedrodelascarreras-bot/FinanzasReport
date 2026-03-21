/**
 * build-report.js — Construye el resumen estructurado del período
 * Reutiliza la misma lógica que la app usa en el dashboard/reportes.
 */

function buildReport(rawData) {
  const now = new Date();
  const usdRate = rawData.usdRate || 1420;
  const transactions = (rawData.transactions || []).map(t => ({
    ...t,
    date: new Date(t.date),
  }));

  // Período: última semana (lunes a domingo)
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 7);
  startDate.setHours(0, 0, 0, 0);

  // También período del mes actual
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Período anterior (semana previa)
  const prevStart = new Date(startDate);
  prevStart.setDate(prevStart.getDate() - 7);
  const prevEnd = new Date(startDate);
  prevEnd.setMilliseconds(-1);

  // Filtrar transacciones
  const weekTx = transactions.filter(t => t.date >= startDate && t.date <= endDate);
  const monthTx = transactions.filter(t => t.date >= monthStart && t.date <= monthEnd);
  const prevWeekTx = transactions.filter(t => t.date >= prevStart && t.date <= prevEnd);

  // ── Gastos de la semana ──
  const weekExpARS = weekTx.filter(t => t.currency !== 'USD').reduce((s, t) => s + (t.amount || 0), 0);
  const weekExpUSD = weekTx.filter(t => t.currency === 'USD').reduce((s, t) => s + (t.amount || 0), 0);
  const weekTotalARS = weekExpARS + (weekExpUSD * usdRate);

  // Gastos del mes
  const monthExpARS = monthTx.filter(t => t.currency !== 'USD').reduce((s, t) => s + (t.amount || 0), 0);
  const monthExpUSD = monthTx.filter(t => t.currency === 'USD').reduce((s, t) => s + (t.amount || 0), 0);
  const monthTotalARS = monthExpARS + (monthExpUSD * usdRate);

  // Semana anterior
  const prevExpARS = prevWeekTx.filter(t => t.currency !== 'USD').reduce((s, t) => s + (t.amount || 0), 0);
  const prevExpUSD = prevWeekTx.filter(t => t.currency === 'USD').reduce((s, t) => s + (t.amount || 0), 0);
  const prevTotalARS = prevExpARS + (prevExpUSD * usdRate);

  // ── Ingresos del mes ──
  const incomeMonths = rawData.incomeMonths || [];
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentIncome = incomeMonths.find(m => m.month === currentMonthKey);
  const incomeARS = currentIncome ? (currentIncome.ars || 0) : 0;
  const incomeUSD = currentIncome ? (currentIncome.usd || 0) : 0;
  const incomeTotalARS = incomeARS + (incomeUSD * usdRate);

  // ── % del ingreso utilizado ──
  const incomeUsedPct = incomeTotalARS > 0 ? Math.round((monthTotalARS / incomeTotalARS) * 100) : null;
  const marginARS = incomeTotalARS > 0 ? incomeTotalARS - monthTotalARS : null;

  // ── Comparación semana vs semana anterior ──
  const weekVsPrevPct = prevTotalARS > 0
    ? Math.round(((weekTotalARS - prevTotalARS) / prevTotalARS) * 100)
    : null;

  // ── Categorías ──
  const catMap = {};
  monthTx.forEach(t => {
    const cat = t.category || 'Sin categoría';
    if (!catMap[cat]) catMap[cat] = { ars: 0, usd: 0 };
    if (t.currency === 'USD') catMap[cat].usd += t.amount || 0;
    else catMap[cat].ars += t.amount || 0;
  });

  const categories = Object.entries(catMap)
    .map(([name, v]) => ({
      name,
      ars: v.ars,
      usd: v.usd,
      totalARS: v.ars + (v.usd * usdRate),
    }))
    .sort((a, b) => b.totalARS - a.totalARS);

  const topCategory = categories[0] || null;
  const topCatPct = topCategory && monthTotalARS > 0
    ? Math.round((topCategory.totalARS / monthTotalARS) * 100)
    : 0;

  // ── Gastos fijos vs variables ──
  const fixedExpenses = rawData.fixedExpenses || [];
  const subscriptions = rawData.subscriptions || [];
  const fixedTotalARS = fixedExpenses.reduce((s, f) => {
    return s + (f.currency === 'USD' ? (f.amount || 0) * usdRate : (f.amount || 0));
  }, 0);
  const subsTotalARS = subscriptions.filter(s => s.active !== false).reduce((s, sub) => {
    return s + (sub.currency === 'USD' ? (sub.amount || 0) * usdRate : (sub.amount || 0));
  }, 0);
  const fixedAndSubsTotal = fixedTotalARS + subsTotalARS;

  // ── Cuotas activas ──
  const cuotas = (rawData.cuotas || []).filter(c => {
    const paid = c.paid || 0;
    const total = c.installments || c.cuotas || 0;
    return paid < total;
  });
  const cuotasMonthlyARS = cuotas.reduce((s, c) => {
    const amt = c.monthlyAmount || c.amount || 0;
    return s + (c.currency === 'USD' ? amt * usdRate : amt);
  }, 0);

  // ── Ahorros ──
  const savAccounts = rawData.savAccounts || [];
  const savTotalARS = savAccounts.filter(a => a.currency === 'ARS').reduce((s, a) => s + a.balance, 0);
  const savTotalUSD = savAccounts.filter(a => a.currency === 'USD').reduce((s, a) => s + a.balance, 0);
  const savEquivARS = savTotalARS + (savTotalUSD * usdRate);

  // ── Metas de ahorro ──
  const savGoals = (rawData.savGoals || []).map(g => {
    const current = g.currency === 'USD'
      ? savTotalUSD + (savTotalARS / usdRate)
      : savTotalARS + (savTotalUSD * usdRate);
    const pct = g.target > 0 ? Math.min(100, Math.round((current / g.target) * 100)) : 0;
    return { ...g, current: Math.round(current), pct };
  });

  // ── Proyección al cierre del mes ──
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyAvg = dayOfMonth > 0 ? monthTotalARS / dayOfMonth : 0;
  const projectedMonthTotal = Math.round(dailyAvg * daysInMonth);

  // ── Alertas / anomalías ──
  const alerts = [];
  if (incomeUsedPct !== null && incomeUsedPct > 80) {
    alerts.push(`⚠️ Ya usaste el ${incomeUsedPct}% del ingreso mensual`);
  }
  if (weekVsPrevPct !== null && weekVsPrevPct > 30) {
    alerts.push(`📈 Gastaste ${weekVsPrevPct}% más que la semana anterior`);
  }
  if (topCategory && topCatPct > 40) {
    alerts.push(`🔍 "${topCategory.name}" concentra el ${topCatPct}% del gasto`);
  }
  if (marginARS !== null && marginARS < 0) {
    alerts.push(`🚨 Estás en déficit: gastaste más de lo que ingresó`);
  }
  if (projectedMonthTotal > incomeTotalARS && incomeTotalARS > 0) {
    alerts.push(`📊 Proyección: $${fmtN(projectedMonthTotal)} supera el ingreso de $${fmtN(Math.round(incomeTotalARS))}`);
  }

  const report = {
    generatedAt: now.toISOString(),
    period: {
      weekStart: startDate.toISOString(),
      weekEnd: endDate.toISOString(),
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString(),
      monthKey: currentMonthKey,
    },
    usdRate,

    // Gastos semana
    week: {
      expARS: Math.round(weekExpARS),
      expUSD: Math.round(weekExpUSD * 100) / 100,
      totalARS: Math.round(weekTotalARS),
      txCount: weekTx.length,
    },

    // Comparación
    prevWeek: {
      totalARS: Math.round(prevTotalARS),
      txCount: prevWeekTx.length,
    },
    weekVsPrevPct,

    // Gastos mes
    month: {
      expARS: Math.round(monthExpARS),
      expUSD: Math.round(monthExpUSD * 100) / 100,
      totalARS: Math.round(monthTotalARS),
      txCount: monthTx.length,
    },

    // Ingresos
    income: {
      ars: incomeARS,
      usd: incomeUSD,
      totalARS: Math.round(incomeTotalARS),
    },
    incomeUsedPct,
    marginARS: marginARS !== null ? Math.round(marginARS) : null,

    // Categorías top 10
    categories: categories.slice(0, 10).map(c => ({
      name: c.name,
      totalARS: Math.round(c.totalARS),
      pct: monthTotalARS > 0 ? Math.round((c.totalARS / monthTotalARS) * 100) : 0,
    })),
    topCategory: topCategory ? { name: topCategory.name, pct: topCatPct } : null,

    // Fijos
    fixedExpenses: {
      gastosFijos: Math.round(fixedTotalARS),
      suscripciones: Math.round(subsTotalARS),
      total: Math.round(fixedAndSubsTotal),
    },

    // Cuotas
    cuotas: {
      active: cuotas.length,
      monthlyARS: Math.round(cuotasMonthlyARS),
      items: cuotas.slice(0, 5).map(c => ({
        desc: c.description || c.desc || 'Cuota',
        paid: c.paid || 0,
        total: c.installments || c.cuotas || 0,
        monthlyARS: Math.round(c.currency === 'USD' ? (c.monthlyAmount || c.amount || 0) * usdRate : (c.monthlyAmount || c.amount || 0)),
      })),
    },

    // Compromisos totales (fijos + subs + cuotas)
    commitments: {
      totalARS: Math.round(fixedAndSubsTotal + cuotasMonthlyARS),
    },

    // Presupuesto restante
    budgetRemaining: marginARS !== null ? Math.round(marginARS - fixedAndSubsTotal - cuotasMonthlyARS) : null,

    // Ahorros
    savings: {
      totalARS: Math.round(savTotalARS),
      totalUSD: Math.round(savTotalUSD * 100) / 100,
      equivARS: Math.round(savEquivARS),
      goals: savGoals,
    },

    // Proyección
    projection: {
      dailyAvg: Math.round(dailyAvg),
      projectedMonthTotal,
      daysRemaining: daysInMonth - dayOfMonth,
    },

    // Alertas
    alerts,
  };

  return report;
}

function fmtN(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

module.exports = { buildReport };
