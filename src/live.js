import { isValidCalendarDate } from './state.js';
import { FSC, FREESIS, MARKET_FUND_KEYS } from './source-registry.js';

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
const marketFundSources = new Map([FREESIS.marketFunds, FSC.marketFunds].map((source) => [source.sourceId, source]));

function validateMarketFundsSnapshot(snapshot) {
  const source = snapshot.source;
  const registry = source && marketFundSources.get(source.sourceId);
  if (!registry) {
    throw new Error('Market funds snapshot must include a recognized official source.');
  }
  if (source.priority !== registry.priority || source.name !== registry.name || source.referenceUrl !== registry.pageUrl || source.requestUrl !== registry.dataUrl) {
    throw new Error('Market funds snapshot source metadata does not match its registered provider.');
  }
  if (typeof source.isFallback !== 'boolean') {
    throw new Error('Market funds snapshot must identify whether fallback was used.');
  }
  if (source.isFallback !== (registry.sourceId === FSC.marketFunds.sourceId)) {
    throw new Error('Market funds snapshot fallback status does not match its provider.');
  }
  if (!source.referenceUrl || !source.collectionMethod || !source.retrievedAt || !source.origin) {
    throw new Error('Market funds snapshot must include source reference metadata.');
  }
  if (!Number.isFinite(Date.parse(source.retrievedAt))) {
    throw new Error('Market funds snapshot must include a valid retrieval timestamp.');
  }
  if (!Number.isFinite(source.monetaryScale) || source.monetaryScale !== snapshot.monetaryScale) {
    throw new Error('Market funds snapshot source metadata must include its monetary scale.');
  }
  if (source.isFallback && !source.fallbackReason) {
    throw new Error('Fallback market funds snapshot must include the primary failure reason.');
  }
  if (!Number.isFinite(snapshot.monetaryScale) || snapshot.monetaryScale <= 0) {
    throw new Error('Market funds snapshot must include a valid monetary scale.');
  }
  if (!Array.isArray(snapshot.series) || snapshot.series.length === 0 || !snapshot.latest) {
    throw new Error('Market funds snapshot must include a latest row and series.');
  }
  if (!isValidCalendarDate(snapshot.asOf) || !/^\d{2}:\d{2}$/.test(String(snapshot.snapshotTime))) {
    throw new Error('Market funds snapshot must include valid asOf and snapshotTime values.');
  }
  if (snapshot.latest.date !== snapshot.asOf) {
    throw new Error('Market funds snapshot latest row must match asOf.');
  }
  const invalidRow = snapshot.series.some((row) => (
    !isValidCalendarDate(row.date)
    || MARKET_FUND_KEYS.some((key) => !Number.isFinite(row[key]))
  ));
  if (invalidRow || MARKET_FUND_KEYS.some((key) => !Number.isFinite(snapshot.latest[key]))) {
    throw new Error('Market funds snapshot contains an invalid row.');
  }
  return snapshot;
}

export function validateLiveSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('Live snapshot must be a JSON object.');
  }

  if (snapshot.sourceType === 'market-funds') return validateMarketFundsSnapshot(snapshot);

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
