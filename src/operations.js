const metricExceptionMatchers = {
  'book-value': (row) => row.type.toLowerCase().includes('book value'),
  pnl: (row) => ['book value mismatch', 'accrued interest'].includes(row.type.toLowerCase()),
  settlement: (row) => ['settlement', 'trade amount'].some((term) => row.type.toLowerCase().includes(term)),
  'settlement-fail': (row) => row.type.toLowerCase() === 'settlement fail',
  lending: (row) => row.type.toLowerCase().includes('collateral'),
  critical: (row) => row.severity === 'Critical',
};

export function filterExceptionsForMetric(rows, metricId) {
  const matcher = metricExceptionMatchers[metricId];
  return matcher ? rows.filter(matcher) : rows;
}

export function statusTone(status) {
  return {
    New: 'new',
    Investigating: 'investigating',
    Waiting: 'waiting',
    Resolved: 'resolved',
    Waived: 'waived',
  }[status] || 'neutral';
}

export function explainMetricForException(exception) {
  if (!exception) return null;
  const type = exception.type.toLowerCase();
  if (type.includes('collateral')) return 'lending';
  if (type.includes('book value')) return 'book-value';
  if (type.includes('accrued interest')) return 'pnl';
  return 'settlement';
}
