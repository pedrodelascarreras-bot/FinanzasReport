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

/** Suscripciones usan price + freq (monthly/annual/weekly), NO amount */
function subToMonthlyARS(s, usdRate) {
  const price = s.price || 0;
  let monthly;
  if (s.freq === 'annual') monthly = price / 12;
  else if (s.freq === 'weekly') monthly = price * 4.3;
  else monthly = price; // monthly or default
  return s.currency === 'USD' ? monthly * usdRate : monthly;
}

function buildReport(rawData) {
  const now = new Date();
  const usdRate = rawData.usdRate || 1420;
  const transactions = (rawData.transactions || []).map(t => ({
    ...t,
    date: new Date(t.date),
  }));

  // ── Periodos ──
  // Semana: ultimos 7 dias
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 7);
  startDate.setHours(0, 0, 0, 0);

  // Mes: si estamos en los primeros 2 dias del mes, usar el mes anterior
  // (el reporte del lunes 1ro debe mostrar datos de marzo, no de abril vacio)
  let refDate = now;
  if (now.getDate() <= 2) {
    refDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  }
  const monthStart = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const monthEnd = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59);
  const monthLabel = monthStart.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

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

  // Ingresos — buscar en el mes del reporte
  const incomeMonths = rawData.incomeMonths || [];
  const reportMonthKey = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`;
  const currentIncome = incomeMonths.find(m => m.month === reportMonthKey);
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

  // ── Gastos fijos: usan name + amount + currency ──
  const fixedExpenses = rawData.fixedExpenses || [];
  const fixedTotalARS = fixedExpenses.reduce((s, f) => {
    const amt = f.amount || 0;
    return s + (f.currency === 'USD' ? amt * usdRate : amt);
  }, 0);

  const fixedExpensesList = fixedExpenses.map(f => ({
    name: f.name || 'Gasto fijo',
    amountARS: Math.round(f.currency === 'USD' ? (f.amount || 0) * usdRate : (f.amount || 0)),
    currency: f.currency || 'ARS',
    originalAmount: f.amount || 0,
  }));

  // ── Suscripciones: usan name + price + freq + currency (NO amount) ──
  const subscriptions = rawData.subscriptions || [];
  const subsTotalARS = subscriptions.reduce((s, sub) => s + subToMonthlyARS(sub, usdRate), 0);
  const fixedAndSubsTotal = fixedTotalARS + subsTotalARS;

  const activeSubscriptions = subscriptions.map(s => {
    const monthlyARS = Math.round(subToMonthlyARS(s, usdRate));
    return {
      name: s.name || 'Suscripcion',
      amountARS: monthlyARS,
      currency: s.currency || 'ARS',
      originalPrice: s.price || 0,
      freq: s.freq || 'monthly',
    };
  });

  // ── Cuotas: usan name + amount (mensual) + total + paid (NO installments, NO description) ──
  const cuotas = (rawData.cuotas || []).filter(c => {
    const paid = c.paid || 0;
    const total = c.total || 0;
    return paid < total;
  });
  const cuotasMonthlyARS = cuotas.reduce((s, c) => {
    const amt = c.amount || 0;
    return s + (c.currency === 'USD' ? amt * usdRate : amt);
  }, 0);

  const cuotasDetailed = cuotas.map(c => {
    const monthly = c.amount || 0;
    const monthlyARS = Math.round(c.currency === 'USD' ? monthly * usdRate : monthly);
    const totalVal = monthly * (c.total || 0);
    const totalValARS = Math.round(c.currency === 'USD' ? totalVal * usdRate : totalVal);
    return {
      desc: c.name || c.key || c.description || 'Cuota',
      paid: c.paid || 0,
      total: c.total || 0,
      monthlyARS,
      totalValueARS: totalValARS,
      currency: c.currency || 'ARS',
      originalMonthly: monthly,
    };
  });

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

  // ── Ciclo de Tarjeta de Credito ──
  const tcCycles = (rawData.tcCycles || []).slice().sort((a, b) => b.closeDate.localeCompare(a.closeDate));
  const ccCards = rawData.ccCards || [];
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  let activeCcCycle = null;
  function getTcCycleOpenDate(cycles, idx) {
    const sorted = [...cycles].sort((a, b) => a.closeDate.localeCompare(b.closeDate));
    const ascIdx = sorted.findIndex(c => c.id === cycles[idx].id);
    if (ascIdx === 0) {
      const d = new Date(sorted[0].closeDate + 'T12:00:00');
      d.setDate(d.getDate() - 30);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    const prevClose = sorted[ascIdx - 1].closeDate;
    const d = new Date(prevClose + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  for (let i = 0; i < tcCycles.length; i++) {
    const openDate = getTcCycleOpenDate(tcCycles, i);
    const closeDate = tcCycles[i].closeDate;
    if (todayStr >= openDate && todayStr <= closeDate) {
      const tcPayMethods = ['tc', 'Tarjeta de Crédito', 'tarjeta_credito'];
      const cardKeys = ccCards.map(c => c.payMethodKey).filter(Boolean);
      const allTcMethods = [...tcPayMethods, ...cardKeys];

      const cycleExpenses = transactions.filter(t => {
        const d = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}-${String(t.date.getDate()).padStart(2, '0')}`;
        return d >= openDate && d <= closeDate && allTcMethods.includes(t.payMethod);
      });
      const cycleARS = cycleExpenses.filter(t => t.currency !== 'USD').reduce((s, t) => s + (t.amount || 0), 0);
      const cycleUSD = cycleExpenses.filter(t => t.currency === 'USD').reduce((s, t) => s + (t.amount || 0), 0);
      const cycleTotalARS = cycleARS + (cycleUSD * usdRate);

      const closeD = new Date(closeDate + 'T12:00:00');
      const todayD = new Date(todayStr + 'T12:00:00');
      const daysLeft = Math.max(0, Math.round((closeD - todayD) / (1000 * 60 * 60 * 24)));
      const daysElapsed = Math.max(1, Math.round((todayD - new Date(openDate + 'T12:00:00')) / (1000 * 60 * 60 * 24)));
      const totalCycleDays = daysElapsed + daysLeft;
      const dailyAvgCycle = cycleTotalARS / daysElapsed;
      const projectedClose = Math.round(dailyAvgCycle * totalCycleDays);

      activeCcCycle = {
        label: tcCycles[i].label || `Ciclo ${openDate} - ${closeDate}`,
        openDate,
        closeDate,
        daysLeft,
        daysElapsed,
        totalDays: totalCycleDays,
        totalARS: Math.round(cycleTotalARS),
        txCount: cycleExpenses.length,
        dailyAvg: Math.round(dailyAvgCycle),
        projectedClose,
      };
      break;
    }
  }

  // ── Promedio por dia de la semana (usa monthTx) ──
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  monthTx.forEach(t => {
    const dow = t.date.getDay();
    const amtARS = t.currency === 'USD' ? (t.amount || 0) * usdRate : (t.amount || 0);
    dayTotals[dow] += amtARS;
    dayCounts[dow]++;
  });
  const weekdayAvg = [1, 2, 3, 4, 5, 6, 0].map(i => ({
    day: dayNames[i],
    total: Math.round(dayTotals[i]),
    count: dayCounts[i],
    avg: dayCounts[i] > 0 ? Math.round(dayTotals[i] / dayCounts[i]) : 0,
  }));

  // Proyeccion — usar dias del mes de reporte
  const refDaysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
  // Si es mes anterior (refDate != now month), ya cerro — usar total real
  const isCurrentMonth = refDate.getMonth() === now.getMonth() && refDate.getFullYear() === now.getFullYear();
  const dayOfMonth = isCurrentMonth ? now.getDate() : refDaysInMonth;
  const dailyAvg = dayOfMonth > 0 ? monthTotalARS / dayOfMonth : 0;
  const projectedMonthTotal = isCurrentMonth ? Math.round(dailyAvg * refDaysInMonth) : Math.round(monthTotalARS);
  const daysRemaining = isCurrentMonth ? refDaysInMonth - dayOfMonth : 0;

  // Alertas (sin emojis)
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
      monthKey: reportMonthKey,
      monthLabel,
      isCurrentMonth,
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
    fixedExpenses: { gastosFijos: Math.round(fixedTotalARS), suscripciones: Math.round(subsTotalARS), total: Math.round(fixedAndSubsTotal), items: fixedExpensesList },
    subscriptionsList: activeSubscriptions,
    cuotas: {
      active: cuotas.length,
      monthlyARS: Math.round(cuotasMonthlyARS),
      totalValueARS: cuotasDetailed.reduce((s, c) => s + c.totalValueARS, 0),
      items: cuotasDetailed,
    },
    commitments: { totalARS: Math.round(fixedAndSubsTotal + cuotasMonthlyARS) },
    budgetRemaining: marginARS !== null ? Math.round(marginARS - fixedAndSubsTotal - cuotasMonthlyARS) : null,
    savings: { totalARS: Math.round(savTotalARS), totalUSD: Math.round(savTotalUSD * 100) / 100, equivARS: Math.round(savEquivARS), goals: savGoals },
    projection: { dailyAvg: Math.round(dailyAvg), projectedMonthTotal, daysRemaining },
    ccCycle: activeCcCycle,
    weekdayAvg,
    alerts,
  };
}

function fmtN(n) {
  if (n == null || isNaN(n)) return '--';
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

module.exports = { buildReport };
