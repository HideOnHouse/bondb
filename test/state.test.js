import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterExceptions,
  formatCompactKrw,
  formatContextAmount,
  formatSignedPercent,
  readContext,
  readExceptionFilters,
  readMetricFilter,
  sortExceptions,
} from '../src/state.js';
import { createDemoRepository } from '../src/repository.js';
import { calculateScenarioImpact, validateScenario } from '../src/scenario.js';

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

test('formatSignedPercent handles compare values and zero safely', () => {
  assert.equal(formatSignedPercent(12500000000, 1272100000000), '+1.0%');
  assert.equal(formatSignedPercent(10, 0), '—');
});
