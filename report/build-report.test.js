const test = require('node:test');
const assert = require('node:assert/strict');

const { buildReport } = require('./build-report');

function makeRaw(overrides = {}) {
  return {
    usdRate: 1000,
    transactions: [],
    income: { ars: 0, varArs: 0, usd: 0, varUsd: 0 },
    incomeSources: [],
    incomeMonths: [],
    fixedExpenses: [],
    subscriptions: [],
    cuotas: [],
    savAccounts: [],
    savGoals: [],
    tcCycles: [],
    ccCards: [],
    ...overrides,
  };
}

test('usa incomeMonths.sources + extras para calcular ingreso mensual', () => {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const raw = makeRaw({
    incomeSources: [
      { id: 'src_ars', currency: 'ARS', base: 2000 },
      { id: 'src_usd', currency: 'USD', base: 2 },
    ],
    incomeMonths: [
      {
        month: monthKey,
        sources: { src_ars: 150000, src_usd: 2 },
        extraArs: 5000,
        extraUsd: 1,
      },
    ],
  });

  const report = buildReport(raw);

  assert.equal(report.income.ars, 155000);
  assert.equal(report.income.usd, 3);
  assert.equal(report.income.totalARS, 158000);
});

test('excluye cuotas y suscripciones proyectadas del gasto real', () => {
  const now = new Date();
  const iso = now.toISOString();
  const raw = makeRaw({
    transactions: [
      { id: 'real', date: iso, amount: 10000, currency: 'ARS', category: 'Supermercado' },
      { id: 'pending-cuota', date: iso, amount: 99999, currency: 'ARS', isPendingCuota: true, category: 'Supermercado' },
      { id: 'pending-sub', date: iso, amount: 88888, currency: 'ARS', isPendingSubscription: true, category: 'Supermercado' },
    ],
  });

  const report = buildReport(raw);

  assert.equal(report.month.totalARS, 10000);
  assert.equal(report.week.totalARS, 10000);
});

test('no cuenta suscripciones inactivas en compromisos', () => {
  const raw = makeRaw({
    subscriptions: [
      { name: 'Activa', price: 10, currency: 'USD', freq: 'monthly', active: true },
      { name: 'Inactiva', price: 999, currency: 'USD', freq: 'monthly', active: false },
    ],
  });

  const report = buildReport(raw);

  assert.equal(report.fixedExpenses.suscripciones, 10000);
  assert.equal(report.commitments.totalARS, 10000);
  assert.equal(report.subscriptionsList.length, 1);
});

test('convierte cuotas en USD dentro de compromisos', () => {
  const raw = makeRaw({
    cuotas: [
      { name: 'Laptop', amount: 20, currency: 'USD', total: 6, paid: 2 },
    ],
  });

  const report = buildReport(raw);

  assert.equal(report.cuotas.monthlyARS, 20000);
  assert.equal(report.commitments.totalARS, 20000);
});
