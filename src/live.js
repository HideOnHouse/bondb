import { isValidCalendarDate } from './state.js';

const requiredCollections = [
  'cashflows',
  'checklist',
  'drivers',
  'lendingRows',
  'metricDictionary',
  'metrics',
  'positions',
  'exceptions',
  'auditEvents',
];
const requiredMetricIds = ['book-value', 'pnl', 'settlement', 'settlement-fail', 'lending', 'critical'];
const marketFundKeys = [
  'investorDeposit',
  'derivativesDeposit',
  'rpBalance',
  'receivables',
  'forcedSaleAmount',
  'forcedSaleRatio',
];

export function validateLiveSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('Live snapshot must be a JSON object.');
  }

  if (snapshot.sourceType === 'market-funds') {
    if (!isValidCalendarDate(snapshot.asOf) || !/^\d{2}:\d{2}$/.test(String(snapshot.snapshotTime))) {
      throw new Error('FreeSIS snapshot must include valid asOf and snapshotTime values.');
    }
    if (!Array.isArray(snapshot.series) || snapshot.series.length === 0 || !snapshot.latest) {
      throw new Error('FreeSIS snapshot must include a latest row and series.');
    }
    if (!snapshot.source || snapshot.source.name !== 'FreeSIS' || !snapshot.source.serviceId) {
      throw new Error('FreeSIS snapshot must include source metadata.');
    }
    const invalidRow = snapshot.series.some((row) => (
      !isValidCalendarDate(row.date)
      || marketFundKeys.some((key) => !Number.isFinite(row[key]))
    ));
    if (invalidRow || !marketFundKeys.every((key) => Number.isFinite(snapshot.latest[key]))) {
      throw new Error('FreeSIS snapshot contains an invalid market funds row.');
    }
    return snapshot;
  }

  const missingCollections = requiredCollections.filter((key) => !Array.isArray(snapshot[key]));
  if (missingCollections.length) {
    throw new Error(`Live snapshot is missing: ${missingCollections.join(', ')}.`);
  }
  const metricIds = new Set(snapshot.metrics.map((metric) => metric?.id));
  const missingMetrics = requiredMetricIds.filter((id) => !metricIds.has(id));
  if (missingMetrics.length) {
    throw new Error(`Live snapshot is missing metrics: ${missingMetrics.join(', ')}.`);
  }
  if (snapshot.metrics.some((metric) => !Number.isFinite(metric.value))) {
    throw new Error('Live snapshot contains a metric without a finite value.');
  }
  if (!isValidCalendarDate(snapshot.asOf)) {
    throw new Error('Live snapshot must include a valid asOf date.');
  }
  if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(String(snapshot.snapshotTime))) {
    throw new Error('Live snapshot must include a valid snapshotTime.');
  }

  return snapshot;
}

export function normalizeSnapshotTime(value) {
  return String(value).slice(0, 5);
}
