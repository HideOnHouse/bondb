export const compareLabels = {
  'previous-day': 'Previous day',
  'month-end': 'Month-end',
  'year-end': 'Year-end',
  benchmark: 'Benchmark',
};

export const contextOptions = {
  portfolios: ['Portfolio A', 'Portfolio B', 'All portfolios'],
  currencies: ['KRW'],
  compares: Object.keys(compareLabels),
};

export const severityOrder = {
  Critical: 0,
  High: 1,
  Warning: 2,
  Info: 3,
};

export function sortExceptions(rows) {
  return [...rows].sort((a, b) => (
    severityOrder[a.severity] - severityOrder[b.severity]
    || a.dueSort - b.dueSort
    || b.amount - a.amount
  ));
}

export function filterExceptions(rows, { severity = 'all', status = 'all', search = '' } = {}) {
  const normalizedSearch = search.trim().toLowerCase();
  return sortExceptions(rows).filter((row) => {
    const matchesSeverity = severity === 'all' || row.severity === severity;
    const matchesStatus = status === 'all' || row.status === status;
    const haystack = `${row.id} ${row.isin || ''} ${row.tradeId || ''} ${row.journalId || ''} ${row.security} ${row.type} ${row.owner} ${row.counterparty}`.toLowerCase();
    return matchesSeverity && matchesStatus && (!normalizedSearch || haystack.includes(normalizedSearch));
  });
}

export function formatCompactKrw(value, unit = 'KRW') {
  if (unit === 'cases') return `${new Intl.NumberFormat('en-US').format(value)} cases`;
  if (unit === 'securities') return `${new Intl.NumberFormat('en-US').format(value)} securities`;
  const absolute = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absolute >= 1e12) return `${sign}${(absolute / 1e12).toFixed(2)}tn ${unit}`;
  if (absolute >= 1e9) return `${sign}${(absolute / 1e9).toFixed(2)}bn ${unit}`;
  if (absolute >= 1e6) return `${sign}${(absolute / 1e6).toFixed(1)}m ${unit}`;
  if (absolute >= 1e3) return `${sign}${(absolute / 1e3).toFixed(1)}k ${unit}`;
  return `${sign}${new Intl.NumberFormat('en-US').format(absolute)} ${unit}`;
}

export function formatContextAmount(value, currency = 'KRW', unit = 'KRW') {
  if (currency !== 'KRW') throw new Error(`Unsupported display currency: ${currency}`);
  if (unit !== 'KRW') return formatCompactKrw(value, unit);
  return formatCompactKrw(value, currency);
}

export function formatSignedPercent(value, total) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total === 0) return '—';
  const percentage = (value / Math.abs(total)) * 100;
  return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%`;
}

export function formatRatioPercent(value, total, digits = 1) {
  if (!Number.isFinite(value) || !Number.isFinite(total)) return '—';
  if (total === 0) return value === 0 ? `${(0).toFixed(digits)}%` : '—';
  return `${((value / Math.abs(total)) * 100).toFixed(digits)}%`;
}

export function formatSignedNumber(value, digits = 1) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

export function readContext(search = '') {
  const params = new URLSearchParams(search);
  const requestedAsOf = params.get('asOf') || '';
  const asOf = isValidCalendarDate(requestedAsOf) ? requestedAsOf : currentKstDate();
  const portfolio = contextOptions.portfolios.includes(params.get('portfolio'))
    ? params.get('portfolio')
    : 'Portfolio A';
  const currency = contextOptions.currencies.includes(params.get('currency'))
    ? params.get('currency')
    : 'KRW';
  const compare = contextOptions.compares.includes(params.get('compare'))
    ? params.get('compare')
    : 'previous-day';
  return {
    asOf,
    portfolio,
    currency,
    compare,
  };
}

export function currentKstDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isValidCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function readExceptionFilters(search = '') {
  const params = new URLSearchParams(search);
  const severity = ['all', 'Critical', 'High', 'Warning', 'Info'].includes(params.get('severity'))
    ? params.get('severity')
    : 'all';
  const status = ['all', 'New', 'Investigating', 'Waiting', 'Resolved', 'Waived'].includes(params.get('status'))
    ? params.get('status')
    : 'all';
  return {
    severity,
    status,
    search: params.get('q') || '',
  };
}

export function readMetricFilter(search = '') {
  const value = new URLSearchParams(search).get('metric');
  if (!value) return null;
  const allowed = ['book-value', 'pnl', 'settlement', 'settlement-fail', 'lending', 'critical'];
  if (allowed.includes(value)) return value;
  if (/^rating:(AAA|AA-|AA|A\+)$/.test(value)) return value;
  return null;
}

export function contextSearch(context) {
  const params = new URLSearchParams(context);
  return `?${params.toString()}`;
}
