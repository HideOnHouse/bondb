import { FSC, FREESIS, MARKET_FUND_KEYS } from './source-registry.js';

function sourceMetadata(registry, {
  retrievedAt,
  isFallback = false,
  fallbackReason = null,
  monetaryScale,
} = {}) {
  return {
    sourceId: registry.sourceId,
    name: registry.name,
    datasetName: registry.datasetName,
    priority: registry.priority,
    origin: registry.origin,
    provider: registry.provider || registry.name,
    datasetId: registry.datasetId || null,
    parentDivId: registry.parentDivId || null,
    serviceId: registry.serviceId || null,
    collectionMethod: registry.collectionMethod,
    referenceUrl: registry.pageUrl,
    requestUrl: registry.dataUrl,
    retrievedAt,
    isFallback,
    fallbackReason,
    monetaryScale: monetaryScale ?? registry.monetaryScale ?? null,
  };
}

function parseDate(value, sourceName) {
  const text = String(value);
  if (!/^\d{8}$/.test(text)) {
    throw new Error(`${sourceName} returned an invalid date: ${text}`);
  }
  const date = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6)}`;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${sourceName} returned an invalid calendar date: ${text}`);
  }
  return date;
}

function numberValue(value, field, sourceName) {
  const isNumericInput = typeof value === 'number' || typeof value === 'string';
  const text = typeof value === 'string' ? value.trim() : value;
  if (!isNumericInput || text === '') {
    throw new Error(`${sourceName} returned a non-numeric ${field} value.`);
  }
  const number = Number(text);
  if (!Number.isFinite(number)) {
    throw new Error(`${sourceName} returned a non-numeric ${field} value.`);
  }
  return number;
}

function normalizeRows(rows, {
  registry,
  retrievedAt,
  isFallback,
  fallbackReason,
  monetaryScale,
  dateKey,
  fieldMap,
} = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`${registry.name} returned no market funds rows.`);
  }
  if (!Number.isFinite(monetaryScale) || monetaryScale <= 0) {
    throw new Error(`${registry.name} monetary scale is not configured.`);
  }

  const series = rows.map((row) => {
    const normalized = { date: parseDate(row[dateKey], registry.name) };
    MARKET_FUND_KEYS.forEach((key) => {
      normalized[key] = numberValue(row[fieldMap[key]], key, registry.name);
    });
    return normalized;
  }).sort((a, b) => b.date.localeCompare(a.date));

  return {
    sourceType: 'market-funds',
    asOf: series[0].date,
    snapshotTime: null,
    source: sourceMetadata(registry, {
      retrievedAt,
      isFallback,
      fallbackReason,
      monetaryScale,
    }),
    unit: registry.unit || 'KRW',
    monetaryScale,
    series,
    latest: series[0],
  };
}

function freeSisRows(body) {
  if (!Array.isArray(body?.ds1)) {
    throw new Error('FreeSIS response is missing ds1 rows.');
  }
  return body.ds1;
}

function fscRows(body) {
  const apiHeader = body?.response?.header || body?.header;
  const error = body?.OpenAPI_ServiceResponse?.cmmMsgHeader
    || (apiHeader && apiHeader.resultCode !== '00' && apiHeader);
  if (error && !body?.response?.body && !body?.body?.items) {
    throw new Error(`FSC API returned ${error.returnAuthMsg || error.resultMsg || error.errMsg || 'an error'}.`);
  }
  const candidate = body?.response?.body || body?.body || body;
  const items = candidate?.items?.item;
  if (!items) throw new Error('FSC response is missing body.items.item.');
  return Array.isArray(items) ? items : [items];
}

export function normalizeFreeSisMarketFunds(body, {
  retrievedAt = new Date().toISOString(),
  snapshotTime = null,
} = {}) {
  const snapshot = normalizeRows(freeSisRows(body), {
    registry: FREESIS.marketFunds,
    retrievedAt,
    isFallback: false,
    monetaryScale: FREESIS.marketFunds.monetaryScale,
    dateKey: 'TMPV1',
    fieldMap: {
      investorDeposit: 'TMPV2',
      derivativesDeposit: 'TMPV3',
      rpBalance: 'TMPV4',
      receivables: 'TMPV5',
      forcedSaleAmount: 'TMPV6',
      forcedSaleRatio: 'TMPV7',
    },
  });
  snapshot.snapshotTime = snapshotTime;
  return snapshot;
}

export function normalizeFscMarketFunds(body, {
  retrievedAt = new Date().toISOString(),
  snapshotTime = null,
  monetaryScale,
  fallbackReason = 'FreeSIS request failed',
} = {}) {
  const snapshot = normalizeRows(fscRows(body), {
    registry: FSC.marketFunds,
    retrievedAt,
    isFallback: true,
    fallbackReason,
    monetaryScale,
    dateKey: 'basDt',
    fieldMap: {
      investorDeposit: 'invrDpsgAmt',
      derivativesDeposit: 'onbdDrvPrdTrRcAdvAmt',
      rpBalance: 'toCstRpchCndBndSlgBal',
      receivables: 'brkTrdUcolMny',
      forcedSaleAmount: 'brkTrdUcolMnyVsOppsTrdAmt',
      forcedSaleRatio: 'ucolMnyVsOppsTrdRlImpt',
    },
  });
  snapshot.snapshotTime = snapshotTime;
  return snapshot;
}

export function findMarketFundsObservation(snapshot, asOf) {
  return snapshot.series.find((row) => row.date === asOf) || null;
}
