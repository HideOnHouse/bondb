import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterExceptions,
  formatCompactKrw,
  formatContextAmount,
  formatRatioPercent,
  formatSignedPercent,
  readContext,
  readExceptionFilters,
  readMetricFilter,
  sortExceptions,
} from '../src/state.js';
import { createDemoRepository } from '../src/repository.js';
import { calculateScenarioImpact, validateScenario } from '../src/scenario.js';
import { explainMetricForException, filterExceptionsForMetric, statusTone } from '../src/operations.js';
import { normalizeSnapshotTime, validateLiveSnapshot } from '../src/live.js';

const rows = [
  { id: 'warning', severity: 'Warning', dueSort: 1, amount: 100 },
  { id: 'critical-later', severity: 'Critical', dueSort: 3, amount: 10 },
  { id: 'critical-now', severity: 'Critical', dueSort: 1, amount: 20 },
];

test('sortExceptions keeps severity, due, and impact priority', () => {
  assert.deepEqual(sortExceptions(rows).map((row) => row.id), [
    'critical-now',
    'critical-later',
    'warning',
  ]);
});

test('filterExceptions applies severity, status, and global search together', () => {
  const result = filterExceptions([
    { id: 'EX-1', isin: 'KR1234567890', severity: 'High', status: 'New', security: 'KTB 2028', type: 'Amount mismatch', owner: 'J. Kim', counterparty: 'Aster', dueSort: 1, amount: 20 },
    { id: 'EX-2', severity: 'Warning', status: 'Waiting', security: 'LG Chem 2030', type: 'Date mismatch', owner: 'M. Lee', counterparty: 'Northstar', dueSort: 2, amount: 30 },
  ], { severity: 'High', status: 'New', search: 'kr123' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'EX-1');
});

test('formatCompactKrw uses compact financial units', () => {
  assert.equal(formatCompactKrw(1284600000000, 'KRW'), '1.28tn KRW');
  assert.equal(formatCompactKrw(-12480000000, 'KRW'), '-12.48bn KRW');
  assert.equal(formatCompactKrw(7, 'cases'), '7 cases');
});

test('formatContextAmount converts KRW values before changing the display currency', () => {
  assert.equal(formatContextAmount(1000000000, 'KRW'), '1.00bn KRW');
  assert.equal(formatContextAmount(1000000000, 'USD'), '730.0k USD');
});

test('readContext rejects unsafe or unsupported URL state', () => {
  assert.deepEqual(readContext('?asOf=%3Cimg%3E&portfolio=bad&currency=JPY&compare=unknown'), {
    asOf: '2026-08-11',
    portfolio: 'Portfolio A',
    currency: 'KRW',
    compare: 'previous-day',
  });
  assert.equal(readContext('?asOf=2026-99-99').asOf, '2026-08-11');
  assert.deepEqual(readExceptionFilters('?severity=bad&status=bad&q=%3Cscript%3E'), {
    severity: 'all',
    status: 'all',
    search: '<script>',
  });
  assert.equal(readMetricFilter('?metric=rating:%3Cimg%3E'), null);
  assert.equal(readMetricFilter('?metric=rating:AAA'), 'rating:AAA');
});

test('validateScenario rejects non-finite and out-of-range assumptions', () => {
  const result = validateScenario({ rate: 101, spread: 0, fx: Number.NaN, fee: 0, lendingRatio: 70, haircut: 2 });
  assert.equal(result.valid, false);
  assert.match(result.errors.rate, /between/);
  assert.match(result.errors.fx, /number/);
});

test('scenario lending fee treats basis points as basis points', () => {
  const result = calculateScenarioImpact({ rate: 0, spread: 0, fx: 1, fee: 5, lendingRatio: 70, haircut: 2 });
  assert.equal(Math.round(result.revenuePerDay), 378575);
  assert.equal(result.pnl, 85000000);
});

test('scenario lending revenue uses the loaded lending balance', () => {
  const result = calculateScenarioImpact(
    { rate: 0, spread: 0, fx: 0, fee: 5, lendingRatio: 100, haircut: 0 },
    { lendingBalance: 100000000000 },
  );
  assert.equal(Math.round(result.revenuePerDay), 136986);
});

test('demo repository records exception updates with a new audit event', () => {
  const repository = createDemoRepository();
  const result = repository.updateException('EX-4821', {
    owner: 'M. Lee',
    status: 'Resolved',
    reason: 'Confirmed after custody replay.',
  });
  assert.equal(result.row.owner, 'M. Lee');
  assert.equal(result.row.status, 'Resolved');
  assert.equal(repository.getAuditEvents()[0].result, result.auditId);
});

test('repository refresh returns a fresh snapshot collection', () => {
  const repository = createDemoRepository();
  const first = repository.getSnapshot();
  const refreshed = repository.refreshSnapshot();
  assert.notEqual(refreshed.metrics, first.metrics);
  assert.deepEqual(refreshed.metrics, first.metrics);
});

test('live snapshot validation rejects incomplete or stale-shaped data', () => {
  assert.throws(() => validateLiveSnapshot({}), /missing: /);
  assert.throws(() => validateLiveSnapshot({
    cashflows: [],
    checklist: [],
    drivers: [],
    lendingRows: [],
    metricDictionary: [],
    positions: [],
    exceptions: [],
    auditEvents: [],
    metrics: ['book-value', 'pnl', 'settlement', 'settlement-fail', 'lending', 'critical'].map((id) => ({ id, value: 0 })),
    asOf: '2026-08-11',
    snapshotTime: 'not-a-time',
  }), /snapshotTime/);
});

test('live snapshot validation accepts the documented contract', () => {
  const snapshot = {
    cashflows: [],
    checklist: [],
    drivers: [],
    lendingRows: [],
    metricDictionary: [],
    metrics: ['book-value', 'pnl', 'settlement', 'settlement-fail', 'lending', 'critical'].map((id) => ({ id, value: 0 })),
    positions: [],
    exceptions: [],
    auditEvents: [],
    asOf: '2026-08-11',
    snapshotTime: '09:42:18',
  };
  assert.equal(validateLiveSnapshot(snapshot), snapshot);
  assert.equal(normalizeSnapshotTime(snapshot.snapshotTime), '09:42');
});

test('live snapshot validation accepts the verified FreeSIS market-funds shape', () => {
  const row = {
    date: '2026-08-10',
    investorDeposit: 100718025,
    derivativesDeposit: 42609036,
    rpBalance: 109124645,
    receivables: 1051270,
    forcedSaleAmount: 40857,
    forcedSaleRatio: 4.1,
  };
  const snapshot = {
    sourceType: 'market-funds',
    asOf: row.date,
    snapshotTime: '18:01',
    source: { name: 'FreeSIS', serviceId: 'STATSCU0100000060', priority: 0 },
    unit: 'KRW million',
    series: [row],
    latest: row,
  };
  assert.equal(validateLiveSnapshot(snapshot), snapshot);
});

test('operations filters distinguish settlement failures from date mismatches', () => {
  const rows = [
    { type: 'Settlement fail', severity: 'Critical' },
    { type: 'Settlement date mismatch', severity: 'High' },
  ];
  assert.deepEqual(filterExceptionsForMetric(rows, 'settlement-fail'), [rows[0]]);
});

test('operations maps exception explanations and workflow tones', () => {
  assert.equal(explainMetricForException({ type: 'Collateral shortfall' }), 'lending');
  assert.equal(explainMetricForException({ type: 'Book value mismatch' }), 'book-value');
  assert.equal(statusTone('Waiting'), 'waiting');
  assert.equal(statusTone('Resolved'), 'resolved');
});

test('formatSignedPercent handles compare values and zero safely', () => {
  assert.equal(formatSignedPercent(12500000000, 1272100000000), '+1.0%');
  assert.equal(formatSignedPercent(10, 0), '—');
  assert.equal(formatSignedPercent(Number.NaN, 10), '—');
});

test('formatRatioPercent handles an empty live dataset without NaN', () => {
  assert.equal(formatRatioPercent(0, 0), '0.0%');
  assert.equal(formatRatioPercent(10, 0), '—');
  assert.equal(formatRatioPercent(0, 100), '0.0%');
});
