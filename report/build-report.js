/**
 * build-report.js — Construye el resumen estructurado del periodo
 * Incluye categorias agrupadas con subcategorias.
 */

const CATEGORY_GROUPS = [
  {group:'Alimentacion', subs:['Supermercado','Restaurantes','Delivery','Kiosco']},
  {group:'Transporte', subs:['Transporte publico','Uber','Combustible','Mantenimiento auto','Estacionamiento']},
  {group:'Vida Social', subs:['Fiesta','Alcohol','Eventos','Juegos']},
  {group:'Consumo Personal', subs:['Ropa','Cuidado personal','Compras generales','Otros']},
  {group:'Salud', subs:['Consultas medicas','Farmacia']},
  {group:'Bienestar', subs:['Gimnasio','Deportes','Terapia']},
  {group:'Educacion', subs:['Cursos','Libros','Universidad']},
  {group:'Servicios & Hogar', subs:['Alquiler','Expensas','Internet','Telefonia','Plataformas']},
  {group:'Tecnologia', subs:['Dispositivos','Suscripciones tech','Accesorios']},
  {group:'Viajes', subs:['Vuelos','Alojamiento','Transporte en destino','Comida en viaje','Actividades']},
  {group:'Finanzas', subs:['Transferencias','Comisiones bancarias','Inversiones','Ahorro']},
  {group:'Regalos', subs:['Regalos']},
  {group:'Consumos Sensibles', subs:['Sustancias','Marihuana']},
  {group:'Sin clasificar', subs:['Uncategorized']},
];

function findGroup(catName) {
  for (const g of CATEGORY_GROUPS) {
    if (g.subs.includes(catName)) return g.group;
  }
  return 'Sin clasificar';
}

function buildReport(rawData) {
  const now = new Date();
  const usdRate = rawData.usdRate || 1420;
  const transactions = (rawData.transactions || []).map(t => ({
    ...t,
    date: new Date(t.date),
  }));

  // Periodos
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 7);
  startDate.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const prevStart = new Date(startDate);
  prevStart.setDate(prevStart.getDate() - 7);
  const prevEnd = new Date(startDate);
  prevEnd.setMilliseconds(-1);

  const weekTx = transactions.filter(t => t.date >= startDate && t.date <= endDate);
  const monthTx = transactions.filter(t => t.date >= monthStart && t.date <= monthEnd);
  const prevWeekTx = transactions.filter(t => t.date >= prevStart && t.date <= prevEnd);

  // Gastos semana
  const weekExpARS = weekTx.filter(t => t.currency !== 'USD').reduce((s, t) => s + (t.amount || 0), 0);
  const weekExpUSD = weekTx.filter(t => t.currency === 'USD').reduce((s, t) => s + (t.amount || 0), 0);
  const weekTotalARS = weekExpARS + (weekExpUSD * usdRate);

  // Gastos mes
  const monthExpARS = monthTx.filter(t => t.currency !== 'USD').reduce((s, t) => s + (t.amount || 0), 0);
  const monthExpUSD = monthTx.filter(t => t.currency === 'USD').reduce((s, t) => s + (t.amount || 0), 0);
  const monthTotalARS = monthExpARS + (monthExpUSD * usdRate);

  // Semana anterior
  const prevExpARS = prevWeekTx.filter(t => t.currency !== 'USD').reduce((s, t) => s + (t.amount || 0), 0);
  const prevExpUSD = prevWeekTx.filter(t => t.currency === 'USD').reduce((s, t) => s + (t.amount || 0), 0);
  const prevTotalARS = prevExpARS + (prevExpUSD * usdRate);

  // Ingresos
  const incomeMonths = rawData.incomeMonths || [];
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentIncome = incomeMonths.find(m => m.month === currentMonthKey);
  const incomeARS = currentIncome ? (currentIncome.ars || 0) : 0;
  const incomeUSD = currentIncome ? (currentIncome.usd || 0) : 0;
  const incomeTotalARS = incomeARS + (incomeUSD * usdRate);

  const incomeUsedPct = incomeTotalARS > 0 ? Math.round((monthTotalARS / incomeTotalARS) * 100) : null;
  const marginARS = incomeTotalARS > 0 ? incomeTotalARS - monthTotalARS : null;

  const weekVsPrevPct = prevTotalARS > 0
    ? Math.round(((weekTotalARS - prevTotalARS) / prevTotalARS) * 100)
    : null;

  // Categorias con subcategorias agrupadas
  const subCatMap = {};
  monthTx.forEach(t => {
    const sub = t.category || 'Sin categoria';
    if (!subCatMap[sub]) subCatMap[sub] = { ars: 0, usd: 0, count: 0 };
    if (t.currency === 'USD') subCatMap[sub].usd += t.amount || 0;
    else subCatMap[sub].ars += t.amount || 0;
    subCatMap[sub].count++;
  });

  // Agrupar por grupo
  const groupMap = {};
  for (const [subName, vals] of Object.entries(subCatMap)) {
    const grp = findGroup(subName);
    if (!groupMap[grp]) groupMap[grp] = { totalARS: 0, subs: [] };
    const subTotalARS = vals.ars + (vals.usd * usdRate);
    groupMap[grp].totalARS += subTotalARS;
    groupMap[grp].subs.push({
      name: subName,
      totalARS: Math.round(subTotalARS),
      count: vals.count,
    });
  }

  const categoryGroups = Object.entries(groupMap)
    .map(([name, v]) => ({
      group: name,
      totalARS: Math.round(v.totalARS),
      pct: monthTotalARS > 0 ? Math.round((v.totalARS / monthTotalARS) * 100) : 0,
      subs: v.subs.sort((a, b) => b.totalARS - a.totalARS),
    }))
    .sort((a, b) => b.totalARS - a.totalARS);

  // Top category flat (para alertas)
  const topGroup = categoryGroups[0] || null;

  // Gastos fijos
  const fixedExpenses = rawData.fixedExpenses || [];
  const subscriptions = rawData.subscriptions || [];
  const fixedTotalARS = fixedExpenses.reduce((s, f) => s + (f.currency === 'USD' ? (f.amount || 0) * usdRate : (f.amount || 0)), 0);
  const subsTotalARS = subscriptions.filter(s => s.active !== false).reduce((s, sub) => s + (sub.currency === 'USD' ? (sub.amount || 0) * usdRate : (sub.amount || 0)), 0);
  const fixedAndSubsTotal = fixedTotalARS + subsTotalARS;

  // Cuotas
  const cuotas = (rawData.cuotas || []).filter(c => {
    const paid = c.paid || 0;
    const total = c.installments || c.cuotas || 0;
    return paid < total;
  });
  const cuotasMonthlyARS = cuotas.reduce((s, c) => {
    const amt = c.monthlyAmount || c.amount || 0;
    return s + (c.currency === 'USD' ? amt * usdRate : amt);
  }, 0);

  // Ahorros
  const savAccounts = rawData.savAccounts || [];
  const savTotalARS = savAccounts.filter(a => a.currency === 'ARS').reduce((s, a) => s + a.balance, 0);
  const savTotalUSD = savAccounts.filter(a => a.currency === 'USD').reduce((s, a) => s + a.balance, 0);
  const savEquivARS = savTotalARS + (savTotalUSD * usdRate);

  // Metas
  const savGoals = (rawData.savGoals || []).map(g => {
    const current = g.currency === 'USD'
      ? savTotalUSD + (savTotalARS / usdRate)
      : savTotalARS + (savTotalUSD * usdRate);
    const pct = g.target > 0 ? Math.min(100, Math.round((current / g.target) * 100)) : 0;
    return { name: g.name, currency: g.currency, target: g.target, current: Math.round(current), pct };
  });

  // Proyeccion
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyAvg = dayOfMonth > 0 ? monthTotalARS / dayOfMonth : 0;
  const projectedMonthTotal = Math.round(dailyAvg * daysInMonth);

  // Alertas (sin emojis para evitar problemas en PDF)
  const alerts = [];
  if (incomeUsedPct !== null && incomeUsedPct > 80) {
    alerts.push(`Ya usaste el ${incomeUsedPct}% del ingreso mensual`);
  }
  if (weekVsPrevPct !== null && weekVsPrevPct > 30) {
    alerts.push(`Gastaste ${weekVsPrevPct}% mas que la semana anterior`);
  }
  if (topGroup && topGroup.pct > 40) {
    alerts.push(`"${topGroup.group}" concentra el ${topGroup.pct}% del gasto`);
  }
  if (marginARS !== null && marginARS < 0) {
    alerts.push(`Deficit: gastaste mas de lo que ingreso`);
  }
  if (projectedMonthTotal > incomeTotalARS && incomeTotalARS > 0) {
    alerts.push(`Proyeccion: $${fmtN(projectedMonthTotal)} supera el ingreso de $${fmtN(Math.round(incomeTotalARS))}`);
  }

  return {
    generatedAt: now.toISOString(),
    period: {
      weekStart: startDate.toISOString(),
      weekEnd: endDate.toISOString(),
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString(),
      monthKey: currentMonthKey,
    },
    usdRate,
    week: { expARS: Math.round(weekExpARS), expUSD: Math.round(weekExpUSD * 100) / 100, totalARS: Math.round(weekTotalARS), txCount: weekTx.length },
    prevWeek: { totalARS: Math.round(prevTotalARS), txCount: prevWeekTx.length },
    weekVsPrevPct,
    month: { expARS: Math.round(monthExpARS), expUSD: Math.round(monthExpUSD * 100) / 100, totalARS: Math.round(monthTotalARS), txCount: monthTx.length },
    income: { ars: incomeARS, usd: incomeUSD, totalARS: Math.round(incomeTotalARS) },
    incomeUsedPct,
    marginARS: marginARS !== null ? Math.round(marginARS) : null,
    categoryGroups,
    topCategory: topGroup ? { name: topGroup.group, pct: topGroup.pct } : null,
    fixedExpenses: { gastosFijos: Math.round(fixedTotalARS), suscripciones: Math.round(subsTotalARS), total: Math.round(fixedAndSubsTotal) },
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
    commitments: { totalARS: Math.round(fixedAndSubsTotal + cuotasMonthlyARS) },
    budgetRemaining: marginARS !== null ? Math.round(marginARS - fixedAndSubsTotal - cuotasMonthlyARS) : null,
    savings: { totalARS: Math.round(savTotalARS), totalUSD: Math.round(savTotalUSD * 100) / 100, equivARS: Math.round(savEquivARS), goals: savGoals },
    projection: { dailyAvg: Math.round(dailyAvg), projectedMonthTotal, daysRemaining: daysInMonth - dayOfMonth },
    alerts,
  };
}

function fmtN(n) {
  if (n == null || isNaN(n)) return '--';
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

module.exports = { buildReport };
