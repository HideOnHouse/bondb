import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterExceptions,
  formatCompactKrw,
  formatContextAmount,
  formatRatioPercent,
  formatSignedPercent,
  currentKstDate,
  readContext,
  readExceptionFilters,
  readMetricFilter,
  sortExceptions,
} from '../src/state.js';
import { explainMetricForException, filterExceptionsForMetric, statusTone } from '../src/operations.js';
import { normalizeSnapshotTime, validateLiveSnapshot } from '../src/live.js';
import { fetchMarketFunds } from '../src/market-funds-source.js';
import {
  findMarketFundsObservation,
  normalizeFscMarketFunds,
  normalizeFreeSisMarketFunds,
} from '../src/market-funds.js';

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

test('formatContextAmount keeps official values in source-native KRW', () => {
  assert.equal(formatContextAmount(1000000000, 'KRW'), '1.00bn KRW');
  assert.throws(() => formatContextAmount(1000000000, 'USD'), /Unsupported display currency/);
});

test('readContext rejects unsafe or unsupported URL state', () => {
  assert.deepEqual(readContext('?asOf=%3Cimg%3E&portfolio=bad&currency=JPY&compare=unknown'), {
    asOf: currentKstDate(),
    portfolio: 'Portfolio A',
    currency: 'KRW',
    compare: 'previous-day',
  });
  assert.equal(readContext('?asOf=2026-99-99').asOf, currentKstDate());
  assert.deepEqual(readExceptionFilters('?severity=bad&status=bad&q=%3Cscript%3E'), {
    severity: 'all',
    status: 'all',
    search: '<script>',
  });
  assert.equal(readMetricFilter('?metric=rating:%3Cimg%3E'), null);
  assert.equal(readMetricFilter('?metric=rating:AAA'), 'rating:AAA');
});

test('context defaults to the current Asia/Seoul calendar date', () => {
  assert.equal(currentKstDate(new Date('2026-08-11T15:00:00.000Z')), '2026-08-12');
  assert.equal(readContext('?asOf=not-a-date').asOf, currentKstDate());
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

const freeSisBody = {
  ds1: [{
    TMPV1: '20260811',
    TMPV2: '100',
    TMPV3: '200',
    TMPV4: '300',
    TMPV5: '400',
    TMPV6: '50',
    TMPV7: '12.5',
  }],
};

const fscBody = {
  response: {
    header: { resultCode: '00', resultMsg: 'NORMAL SERVICE' },
    body: {
      items: {
        item: {
          basDt: '20260811',
          invrDpsgAmt: 100,
          onbdDrvPrdTrRcAdvAmt: 200,
          toCstRpchCndBndSlgBal: 300,
          brkTrdUcolMny: 400,
          brkTrdUcolMnyVsOppsTrdAmt: 50,
          ucolMnyVsOppsTrdRlImpt: 12.5,
        },
      },
    },
  },
};

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

test('FreeSIS and FSC normalize to the same canonical fields', () => {
  const primary = normalizeFreeSisMarketFunds(freeSisBody, {
    retrievedAt: '2026-08-11T09:00:00.000Z',
    snapshotTime: '18:00',
  });
  const fallback = normalizeFscMarketFunds(fscBody, {
    retrievedAt: '2026-08-11T09:00:00.000Z',
    snapshotTime: '18:00',
    monetaryScale: 1_000_000,
    fallbackReason: 'primary unavailable',
  });
  assert.deepEqual(primary.latest, fallback.latest);
  assert.equal(primary.source.isFallback, false);
  assert.equal(fallback.source.isFallback, true);
  assert.equal(fallback.source.referenceUrl, 'https://www.data.go.kr/data/15094809/openapi.do');
});

test('provider fields reject missing, boolean, and malformed numeric values', () => {
  for (const value of [null, '', false, {}, 'not-a-number']) {
    const body = {
      ds1: [{ ...freeSisBody.ds1[0], TMPV2: value }],
    };
    assert.throws(() => normalizeFreeSisMarketFunds(body), /non-numeric investorDeposit/);
  }
});

test('market-funds selection follows the requested observation date', () => {
  const snapshot = normalizeFreeSisMarketFunds(freeSisBody, { snapshotTime: '18:00' });
  assert.equal(findMarketFundsObservation(snapshot, '2026-08-11').date, '2026-08-11');
  assert.equal(findMarketFundsObservation(snapshot, '2026-08-12'), null);
});

test('source resolver uses FreeSIS without calling fallback when primary succeeds', async () => {
  const calls = [];
  const snapshot = await fetchMarketFunds({
    now: new Date('2026-08-11T00:00:00.000Z'),
    serviceKey: 'secret-key',
    monetaryScale: 1_000_000,
    fetchImpl: async (url) => {
      calls.push(String(url));
      return jsonResponse(freeSisBody);
    },
  });
  assert.equal(snapshot.source.sourceId, 'freesis-market-funds');
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0], /secret-key/);
});

test('source resolver activates the official fallback after FreeSIS fails', async () => {
  const calls = [];
  const snapshot = await fetchMarketFunds({
    now: new Date('2026-08-11T00:00:00.000Z'),
    serviceKey: 'secret-key',
    monetaryScale: 1_000_000,
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (calls.length === 1) return jsonResponse({ error: 'upstream down' }, 503);
      return jsonResponse(fscBody);
    },
  });
  assert.equal(snapshot.source.sourceId, 'fsc-public-data-market-funds');
  assert.equal(snapshot.source.isFallback, true);
  assert.match(snapshot.source.fallbackReason, /HTTP 503/);
  assert.match(calls[1], /basDt=20260811/);
  assert.doesNotMatch(snapshot.source.requestUrl, /secret-key/);
});

test('source resolver reports missing fallback credentials instead of inventing values', async () => {
  await assert.rejects(
    fetchMarketFunds({
      serviceKey: '',
      monetaryScale: 1_000_000,
      fetchImpl: async () => jsonResponse({ error: 'upstream down' }, 503),
    }),
    /DATA_GO_KR_SERVICE_KEY is missing/,
  );
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
    source: {
      sourceId: 'freesis-market-funds',
      name: 'FreeSIS',
      origin: 'KOFIA',
      serviceId: 'STATSCU0100000060',
      priority: 0,
      isFallback: false,
      referenceUrl: 'https://freesis.kofia.or.kr/stat/FreeSIS.do',
      requestUrl: 'https://freesis.kofia.or.kr/meta/getMetaDataList.do',
      collectionMethod: 'xhr',
      retrievedAt: '2026-08-11T09:00:00.000Z',
      monetaryScale: 1_000_000,
    },
    unit: 'KRW million',
    monetaryScale: 1_000_000,
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
