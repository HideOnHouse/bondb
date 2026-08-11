import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FREESIS } from './src/source-registry.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const snapshotUrl = process.env.SNAPSHOT_URL || '';
const snapshotTimeoutMs = 10_000;
const freeSisRegistry = FREESIS.marketFunds;

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

async function fetchJson(url, options) {
  let upstream;
  try {
    upstream = await fetch(url, {
      ...options,
      headers: { accept: 'application/json', ...options?.headers },
      signal: AbortSignal.timeout(snapshotTimeoutMs),
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

function kstDateRange() {
  const now = new Date();
  const parts = formatKstParts(now);
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

function toIsoDate(value) {
  const text = String(value);
  if (!/^\d{8}$/.test(text)) throw new Error(`FreeSIS returned an invalid date: ${text}`);
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6)}`;
}

async function fetchFreeSisMarketFunds() {
  const range = kstDateRange();
  const payload = {
    dmSearch: {
      tmpV40: '1000000',
      tmpV41: '1',
      tmpV1: 'D',
      tmpV45: range.start,
      tmpV46: range.end,
      OBJ_NM: freeSisRegistry.objectName,
    },
  };
  const body = await fetchJson(freeSisRegistry.dataUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json;charset=UTF-8' },
    body: JSON.stringify(payload),
  });
  if (!Array.isArray(body.ds1) || body.ds1.length === 0) {
    throw new Error('FreeSIS returned no market funds rows.');
  }

  const series = body.ds1.map((row) => ({
    date: toIsoDate(row.TMPV1),
    investorDeposit: Number(row.TMPV2),
    derivativesDeposit: Number(row.TMPV3),
    rpBalance: Number(row.TMPV4),
    receivables: Number(row.TMPV5),
    forcedSaleAmount: Number(row.TMPV6),
    forcedSaleRatio: Number(row.TMPV7),
  }));
  const invalid = series.some((row) => Object.values(row).some((value) => typeof value === 'number' && !Number.isFinite(value)));
  if (invalid) throw new Error('FreeSIS returned a non-numeric market funds value.');

  return {
    sourceType: 'market-funds',
    asOf: series[0].date,
    snapshotTime: range.time,
    source: {
      name: 'FreeSIS',
      priority: freeSisRegistry.priority,
      parentDivId: freeSisRegistry.parentDivId,
      serviceId: freeSisRegistry.serviceId,
      collectionMethod: freeSisRegistry.collectionMethod,
      requestUrl: freeSisRegistry.dataUrl,
      retrievedAt: new Date().toISOString(),
      isFallback: false,
    },
    unit: 'KRW million',
    series,
    latest: series[0],
  };
}

async function serveSnapshot(response) {
  try {
    const body = snapshotUrl
      ? await fetchJson(snapshotUrl)
      : await fetchFreeSisMarketFunds();
    sendJson(response, 200, body);
  } catch (error) {
    console.error(error.message);
    sendJson(response, 502, { error: error.message });
  }
}

const server = createServer(async (request, response) => {
  const requestPath = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname;
  if (requestPath === '/api/snapshot') {
    await serveSnapshot(response);
    return;
  }

  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const filePath = normalize(join(root, relativePath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch (error) {
    if (error.code === 'ENOENT') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Unable to read resource');
  }
});

server.listen(port, () => {
  console.log(`Bondb workbench running at http://localhost:${port}`);
});
