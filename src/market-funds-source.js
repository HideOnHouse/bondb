import { FSC, FREESIS } from './source-registry.js';
import {
  normalizeFscMarketFunds,
  normalizeFreeSisMarketFunds,
} from './market-funds.js';

const requestTimeoutMs = 10_000;
const fallbackLookbackDays = 7;

function formatKstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
}

export function kstDateRange(date = new Date()) {
  const parts = formatKstParts(date);
  const end = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  end.setUTCMonth(end.getUTCMonth() - 3);
  const start = [
    end.getUTCFullYear(),
    String(end.getUTCMonth() + 1).padStart(2, '0'),
    String(end.getUTCDate()).padStart(2, '0'),
  ].join('');
  return {
    start,
    end: `${parts.year}${parts.month}${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function dateCandidates(date = new Date()) {
  const parts = formatKstParts(date);
  const candidate = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  return Array.from({ length: fallbackLookbackDays }, (_, index) => {
    const current = new Date(candidate);
    current.setUTCDate(current.getUTCDate() - index);
    return [
      current.getUTCFullYear(),
      String(current.getUTCMonth() + 1).padStart(2, '0'),
      String(current.getUTCDate()).padStart(2, '0'),
    ].join('');
  });
}

async function fetchJson(url, options = {}, fetchImpl = fetch) {
  let upstream;
  try {
    upstream = await fetchImpl(url, {
      ...options,
      headers: { accept: 'application/json', ...options.headers },
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch (error) {
    throw new Error(`Live data request failed: ${error.message}`);
  }

  if (!upstream.ok) {
    throw new Error(`Live data source returned HTTP ${upstream.status}.`);
  }
  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Live data source did not return JSON.');
  }
  try {
    return await upstream.json();
  } catch (error) {
    throw new Error(`Live data source returned invalid JSON: ${error.message}`);
  }
}

function snapshotTime(date = new Date()) {
  return kstDateRange(date).time;
}

export async function fetchFreeSisMarketFunds({
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const range = kstDateRange(now);
  const payload = {
    dmSearch: {
      tmpV40: '1000000',
      tmpV41: '1',
      tmpV1: 'D',
      tmpV45: range.start,
      tmpV46: range.end,
      OBJ_NM: FREESIS.marketFunds.objectName,
    },
  };
  const body = await fetchJson(FREESIS.marketFunds.dataUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json;charset=UTF-8' },
    body: JSON.stringify(payload),
  }, fetchImpl);
  return normalizeFreeSisMarketFunds(body, {
    snapshotTime: range.time,
  });
}

function requiredFallbackScale(value) {
  const scale = Number(value);
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error('Official fallback is not enabled: set DATA_GO_KR_MONETARY_SCALE after validating it against FreeSIS.');
  }
  return scale;
}

export async function fetchOfficialFallbackMarketFunds({
  fetchImpl = fetch,
  now = new Date(),
  serviceKey = process.env.DATA_GO_KR_SERVICE_KEY,
  monetaryScale = process.env.DATA_GO_KR_MONETARY_SCALE,
  fallbackReason = 'FreeSIS request failed',
} = {}) {
  if (!serviceKey) {
    throw new Error('Official fallback is not configured: DATA_GO_KR_SERVICE_KEY is missing.');
  }
  const scale = requiredFallbackScale(monetaryScale);
  let lastError;
  for (const basDt of dateCandidates(now)) {
    const url = new URL(FSC.marketFunds.dataUrl);
    url.searchParams.set('serviceKey', serviceKey);
    url.searchParams.set('numOfRows', '1');
    url.searchParams.set('pageNo', '1');
    url.searchParams.set('basDt', basDt);
    url.searchParams.set('_type', 'json');
    try {
      const body = await fetchJson(url, {}, fetchImpl);
      const snapshot = normalizeFscMarketFunds(body, {
        snapshotTime: snapshotTime(now),
        monetaryScale: scale,
        fallbackReason,
      });
      return snapshot;
    } catch (error) {
      lastError = error;
      if (!/no market funds rows|missing body\.items\.item/i.test(error.message)) {
        throw error;
      }
    }
  }
  throw new Error(`Official fallback returned no rows in the last ${fallbackLookbackDays} days: ${lastError?.message || 'unknown error'}`);
}

export async function fetchMarketFunds({
  fetchImpl = fetch,
  now = new Date(),
  serviceKey = process.env.DATA_GO_KR_SERVICE_KEY,
  monetaryScale = process.env.DATA_GO_KR_MONETARY_SCALE,
} = {}) {
  try {
    return await fetchFreeSisMarketFunds({ fetchImpl, now });
  } catch (primaryError) {
    try {
      return await fetchOfficialFallbackMarketFunds({
        fetchImpl,
        now,
        serviceKey,
        monetaryScale,
        fallbackReason: primaryError.message,
      });
    } catch (fallbackError) {
      throw new Error(`FreeSIS unavailable: ${primaryError.message} Official fallback unavailable: ${fallbackError.message}`);
    }
  }
}

export async function fetchInternalSnapshot(url, fetchImpl = fetch) {
  return fetchJson(url, {}, fetchImpl);
}
