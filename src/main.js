import {
  cashflows,
  checklist,
  drivers,
  lendingRows,
  metricDictionary,
  metrics,
  navigation,
  positions,
} from './data.js';
import { createDemoRepository } from './repository.js';
import { validateScenario } from './scenario.js';
import {
  compareLabels,
  contextSearch,
  filterExceptions,
  formatContextAmount,
  formatSignedNumber,
  formatSignedPercent,
  readExceptionFilters,
  readMetricFilter,
  readContext,
} from './state.js';

const root = document.querySelector('#app');
const repository = createDemoRepository();
const exceptions = repository.getExceptions();
const auditEvents = repository.getAuditEvents();
const initialContext = readContext(window.location.search);
const initialParams = new URLSearchParams(window.location.search);
const requestedView = initialParams.get('view');
const initialView = navigation.some((item) => item.id === requestedView) ? requestedView : 'overview';
const state = {
  view: initialView,
  context: initialContext,
  activeMetric: readMetricFilter(window.location.search),
  exceptionFilters: readExceptionFilters(window.location.search),
  selectedException: null,
  explainMetric: null,
  selectedSecurity: null,
  scenario: {
    rate: -25,
    spread: 10,
    fx: 1,
    fee: 5,
    lendingRatio: 70,
    haircut: 2,
    hasRun: false,
    errors: {},
  },
};

const iconPaths = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  chart: '<path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 5-7"/>',
  inbox: '<path d="M4 4h16v16H4z"/><path d="M4 14h4l2 3h4l2-3h4"/>',
  layers: '<path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4"/><path d="m4 17 8 4 8-4"/>',
  sliders: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  settings: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="4"/>',
  wallet: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19a1 1 0 0 1 1 1v15H6.5A2.5 2.5 0 0 1 4 17.5v-11Z"/><path d="M4 7h14M16 13h4"/>',
  trend: '<path d="M4 17 10 11l4 4 6-8"/><path d="M15 7h5v5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  alert: '<path d="M12 4 3 20h18L12 4Z"/><path d="M12 10v4M12 17h.01"/>',
  flag: '<path d="M6 21V4"/><path d="M6 5c4-3 8 3 12 0v9c-4 3-8-3-12 0"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-4L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14 4l2-2"/><path d="M20 20v-5h-5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>',
};

function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.info}</svg>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatContextDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function statusBadge(label, tone = 'neutral') {
  return `<span class="status-badge status-${tone}"><span class="status-dot"></span>${escapeHtml(label)}</span>`;
}

function severityBadge(severity) {
  return `<span class="severity severity-${severity.toLowerCase()}"><span class="severity-mark">${severity === 'Critical' ? '!' : severity === 'High' ? '↑' : severity === 'Warning' ? '•' : 'i'}</span>${severity}</span>`;
}

function deltaMarkup(metric) {
  const compareValue = metric.comparisons?.[state.context.compare] ?? metric.compare;
  const delta = metric.value - compareValue;
  const direction = delta >= 0 ? 'up' : 'down';
  const value = metric.unit === 'cases'
    ? `${delta >= 0 ? '+' : ''}${delta} cases`
    : formatContextAmount(delta, state.context.currency, metric.unit);
  return `<span class="delta delta-${direction}">${delta >= 0 ? '↑' : '↓'} ${value} · ${formatSignedPercent(delta, compareValue)}</span>`;
}

function metricValue(metric) {
  return formatContextAmount(metric.value, state.context.currency, metric.unit);
}

function metricCompareValue(metric) {
  return metric.comparisons?.[state.context.compare] ?? metric.compare;
}

function syncUrl() {
  const params = new URLSearchParams(contextSearch(state.context).slice(1));
  params.set('view', state.view);
  if (state.activeMetric) params.set('metric', state.activeMetric);
  if (state.exceptionFilters.severity !== 'all') params.set('severity', state.exceptionFilters.severity);
  if (state.exceptionFilters.status !== 'all') params.set('status', state.exceptionFilters.status);
  if (state.exceptionFilters.search) params.set('q', state.exceptionFilters.search);
  const nextUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', nextUrl);
}

function filterCockpitExceptions(rows) {
  if (state.activeMetric === 'critical') {
    return rows.filter((row) => row.severity === 'Critical');
  }
  if (state.activeMetric === 'settlement-fail') {
    return rows.filter((row) => row.type.toLowerCase().includes('settlement'));
  }
  return rows;
}

function renderDriverRow(driver) {
  const value = driver.comparisons?.[state.context.compare] ?? driver.value;
  return `
    <div class="driver-row">
      <span class="driver-label">${escapeHtml(driver.label)}</span>
      <div class="driver-track"><span class="driver-bar driver-${driver.color} ${value < 0 ? 'negative' : 'positive'}" style="width:${Math.min(Math.abs(value) * 1.65, 100)}%"></span></div>
      <strong class="${value < 0 ? 'negative-value' : 'positive-value'}">${formatSignedNumber(value)}%</strong>
    </div>
  `;
}

function render() {
  syncUrl();
  const filteredExceptions = filterExceptions(exceptions, state.exceptionFilters);
  const activeNav = navigation.find((item) => item.id === state.view) || navigation[0];
  root.innerHTML = `
    <div class="app-shell">
      ${renderMasthead()}
      <div class="app-body">
        ${renderSidebar(activeNav.id)}
        <main class="main-content" id="main-content">
          ${renderPageHeader(activeNav)}
          ${renderContextBar()}
          ${renderDataStatus()}
          ${renderView(filteredExceptions)}
        </main>
      </div>
      ${state.explainMetric ? renderExplainDrawer(state.explainMetric) : ''}
      ${state.selectedException ? renderExceptionDrawer(state.selectedException) : ''}
      <div class="toast-region" aria-live="polite"></div>
    </div>
  `;
  bindEvents();
}

function renderMasthead() {
  return `
    <header class="masthead">
      <div class="brand-lockup">
        <div class="brand-mark">B</div>
        <div>
          <div class="brand-name">bondb</div>
          <div class="brand-subtitle">Operations Intelligence</div>
        </div>
      </div>
      <div class="global-search">
        ${icon('search')}
        <input id="global-search" type="search" placeholder="Search security, ISIN, trade ID, counterparty" value="${escapeHtml(state.exceptionFilters.search)}" aria-label="Global search" />
        <kbd>⌘ K</kbd>
      </div>
      <div class="masthead-actions">
        <button class="icon-button" data-action="refresh" title="Refresh snapshot" aria-label="Refresh snapshot">${icon('refresh')}</button>
        <button class="freshness-chip" data-action="show-status">${icon('info')} <span>Fresh</span><strong>09:42</strong></button>
        <div class="user-menu">
          <span class="avatar">JK</span>
          <div><strong>Jiho Kim</strong><small>Operator</small></div>
          ${icon('chevron')}
        </div>
      </div>
    </header>
  `;
}

function renderSidebar(activeId) {
  return `
    <aside class="sidebar" aria-label="Primary navigation">
      <div class="workspace-label">WORKSPACE</div>
      <nav>
        ${navigation.map((item) => `
          <button class="nav-item ${item.id === activeId ? 'active' : ''}" data-view="${item.id}" aria-current="${item.id === activeId ? 'page' : 'false'}">
            <span class="nav-icon">${icon(item.icon)}</span>
            <span class="nav-copy"><strong>${item.label}</strong><small>${item.caption}</small></span>
            ${item.id === 'operations' ? '<span class="nav-count">7</span>' : ''}
          </button>
        `).join('')}
      </nav>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-footer">
        <div class="environment-line"><span class="environment-dot"></span> Demo snapshot</div>
        <div class="sidebar-version">v0.1 · 11 Aug 2026</div>
      </div>
    </aside>
  `;
}

function renderPageHeader(activeNav) {
  const descriptions = {
    overview: '오늘 무엇을 먼저 처리해야 하는지 한 화면에서 확인합니다.',
    portfolio: '포트폴리오 변화의 위치와 종목별 기여도를 탐색합니다.',
    operations: '결제·대사 예외를 원인, 담당자, 기한과 함께 처리합니다.',
    lending: '대여 가능 잔고, 수익 기회, 담보와 상대방 리스크를 확인합니다.',
    scenario: '가정값을 바꿔 손익·수익·담보 영향을 비교합니다.',
    admin: 'Metric 정의, 데이터 상태, 설정 변경 감사 이력을 관리합니다.',
  };
  return `
    <div class="page-header">
      <div>
        <div class="breadcrumb"><span>Workbench</span><span>/</span><strong>${activeNav.label}</strong></div>
        <h1>${activeNav.caption}</h1>
        <p>${descriptions[activeNav.id]}</p>
      </div>
      <div class="page-actions">
        <button class="button button-secondary" data-action="save-view">Save view</button>
        <button class="button button-primary" data-action="export">${icon('external')} Export</button>
      </div>
    </div>
  `;
}

function renderContextBar() {
  return `
    <section class="context-bar" aria-label="Analysis context">
      <div class="context-field">
        <label for="as-of">AS-OF DATE</label>
        <input id="as-of" type="date" value="${escapeHtml(state.context.asOf)}" />
      </div>
      <div class="context-divider"></div>
      <div class="context-field">
        <label for="portfolio">PORTFOLIO</label>
        <select id="portfolio">
          <option ${state.context.portfolio === 'Portfolio A' ? 'selected' : ''}>Portfolio A</option>
          <option ${state.context.portfolio === 'Portfolio B' ? 'selected' : ''}>Portfolio B</option>
          <option ${state.context.portfolio === 'All portfolios' ? 'selected' : ''}>All portfolios</option>
        </select>
      </div>
      <div class="context-field context-currency">
        <label for="currency">CURRENCY</label>
        <select id="currency">
          <option ${state.context.currency === 'KRW' ? 'selected' : ''}>KRW</option>
          <option ${state.context.currency === 'USD' ? 'selected' : ''}>USD</option>
        </select>
      </div>
      <div class="context-field context-compare">
        <label for="compare">COMPARE</label>
        <select id="compare">
          ${Object.entries(compareLabels).map(([value, label]) => `<option value="${value}" ${state.context.compare === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
      <div class="context-spacer"></div>
      <button class="saved-view-button" data-action="saved-view">${icon('layers')} <span>Saved view</span>${icon('chevron')}</button>
      <button class="reset-button" data-action="reset">${icon('refresh')} Reset</button>
    </section>
  `;
}

function renderDataStatus() {
  return `
    <div class="data-banner">
      <span class="banner-icon">${icon('info')}</span>
      <div><strong>Official daily snapshot</strong><span> · Data through ${formatContextDate(state.context.asOf)} 09:42 KST. Intraday settlement and exception data are refreshed every 15 minutes.</span></div>
      <button data-action="show-status">View data status ${icon('external')}</button>
    </div>
  `;
}

function renderView(filteredExceptions) {
  if (state.view === 'portfolio') return renderPortfolio();
  if (state.view === 'operations') return renderOperations(filteredExceptions);
  if (state.view === 'lending') return renderLending();
  if (state.view === 'scenario') return renderScenario();
  if (state.view === 'admin') return renderAdmin();
  return renderCockpit(filteredExceptions);
}

function renderCockpit(filteredExceptions) {
  const queueExceptions = filterCockpitExceptions(filteredExceptions);
  const activeFilterLabel = state.activeMetric
    ? metrics.find((metric) => metric.id === state.activeMetric)?.koreanLabel
    : null;
  return `
    <section class="kpi-grid" aria-label="Key performance indicators">
      ${metrics.map((metric) => `
        <article class="metric-card ${state.activeMetric === metric.id ? 'selected' : ''}" data-metric="${metric.id}" tabindex="0">
          <div class="metric-card-top">
            <div class="metric-label"><span class="metric-icon tone-${metric.tone}">${icon(metric.icon)}</span><span>${metric.koreanLabel}<small>${metric.label}</small></span></div>
            ${statusBadge(metric.status, metric.status === 'Official' ? 'official' : metric.status === 'Intraday' ? 'intraday' : 'fresh')}
          </div>
          <div class="metric-value">${metricValue(metric)}</div>
          <div class="metric-meta">${deltaMarkup(metric)}<button class="why-button" data-explain="${metric.id}">Why? <span>↗</span></button></div>
        </article>
      `).join('')}
    </section>
    <div class="filter-strip ${activeFilterLabel ? '' : 'hidden'}">
      <span class="filter-title">Active filter</span>
      ${activeFilterLabel ? `<button class="filter-chip" data-action="clear-metric">${activeFilterLabel} ${icon('close')}</button>` : ''}
      <button class="clear-filter" data-action="reset">Clear all</button>
    </div>
    <section class="cockpit-grid">
      <article class="panel drivers-panel">
        <div class="panel-header">
          <div><span class="eyebrow">COMPARE · ${compareLabels[state.context.compare]}</span><h2>Change drivers</h2></div>
          <button class="text-button" data-view="portfolio">Explore contributors ${icon('external')}</button>
        </div>
        <div class="drivers-summary"><strong>${formatContextAmount(metrics.find((metric) => metric.id === 'pnl').value - metricCompareValue(metrics.find((metric) => metric.id === 'pnl')), state.context.currency)}</strong><span>vs ${compareLabels[state.context.compare]}</span></div>
        <div class="drivers-chart" aria-label="P and L change drivers">
          ${drivers.map(renderDriverRow).join('')}
        </div>
        <div class="chart-legend"><span><i class="legend-dot dot-negative"></i> Negative impact</span><span><i class="legend-dot dot-positive"></i> Positive impact</span><button class="why-button" data-explain="pnl">Why? ↗</button></div>
      </article>
      <article class="panel queue-panel">
        <div class="panel-header">
          <div><span class="eyebrow">EXCEPTION-FIRST</span><h2>Action queue <span class="count-badge">${queueExceptions.length}</span></h2></div>
          <button class="text-button" data-view="operations">View all ${icon('external')}</button>
        </div>
        <div class="queue-toolbar">
          <select data-filter="severity" aria-label="Filter by severity">
            <option value="all" ${state.exceptionFilters.severity === 'all' ? 'selected' : ''}>All severity</option>
            <option value="Critical" ${state.exceptionFilters.severity === 'Critical' ? 'selected' : ''}>Critical</option>
            <option value="High" ${state.exceptionFilters.severity === 'High' ? 'selected' : ''}>High</option>
            <option value="Warning" ${state.exceptionFilters.severity === 'Warning' ? 'selected' : ''}>Warning</option>
          </select>
          <select data-filter="status" aria-label="Filter by status">
            <option value="all" ${state.exceptionFilters.status === 'all' ? 'selected' : ''}>All status</option>
            ${['New', 'Investigating', 'Waiting', 'Resolved'].map((value) => `<option ${state.exceptionFilters.status === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
          <span class="queue-sort">${icon('alert')} Sorted by severity · due · impact</span>
        </div>
        ${renderExceptionTable(queueExceptions.slice(0, 5))}
      </article>
    </section>
    <section class="bottom-grid">
      <article class="panel cashflow-panel">
        <div class="panel-header"><div><span class="eyebrow">EXPECTED CASHFLOW</span><h2>Upcoming settlement</h2></div><button class="text-button" data-view="operations">Open settlement ${icon('external')}</button></div>
        <div class="cashflow-list">${cashflows.map((cashflow) => `
          <div class="cashflow-row"><div class="cashflow-date">${cashflow.date}<small>${cashflow.status}</small></div><div class="cashflow-description">${cashflow.label}<small>Cash movement · ${state.context.currency}</small></div><strong>${formatContextAmount(cashflow.amount, state.context.currency)}</strong></div>
        `).join('')}</div>
      </article>
      <article class="panel checklist-panel">
        <div class="panel-header"><div><span class="eyebrow">MONTH-END CLOSE</span><h2>Closing checklist</h2></div><span class="progress-label">2 / 4 complete</span></div>
        <div class="progress-track"><span style="width:50%"></span></div>
        <div class="checklist">${checklist.map((item) => `<div class="check-row"><span class="check-state state-${item.state.toLowerCase().replaceAll(' ', '-')}">${item.state === 'Complete' ? '✓' : item.state === 'Blocked' ? '!' : '•'}</span><span>${item.label}</span>${item.state === 'Blocked' ? '<small>Needs attention</small>' : ''}</div>`).join('')}</div>
        <button class="button button-secondary button-full" data-view="operations">Open close controls</button>
      </article>
    </section>
  `;
}

function renderExceptionTable(rows) {
  if (!rows.length) {
    return `<div class="empty-state">${icon('info')}<strong>No exceptions match these filters</strong><span>Clear a filter or search for another item.</span><button class="button button-secondary" data-action="clear-exceptions">Clear filters</button></div>`;
  }
  return `
    <div class="table-wrap">
      <table class="data-table exception-table">
        <thead><tr><th>Severity</th><th>Due</th><th>Exception</th><th>Security</th><th class="align-right">Impact</th><th>Owner</th><th>Status</th></tr></thead>
        <tbody>${rows.map((row) => `
          <tr class="${state.selectedException === row.id ? 'row-selected' : ''}" data-exception="${row.id}" tabindex="0">
            <td>${severityBadge(row.severity)}</td>
            <td class="${row.dueSort <= 2 ? 'due-soon' : ''}">${row.due}</td>
            <td><strong>${row.type}</strong><small>${row.id}</small></td>
            <td><span class="security-cell">${row.security}</span><small>${row.counterparty}</small></td>
            <td class="align-right numeric">${formatContextAmount(row.amount, state.context.currency)}</td>
            <td>${row.owner}</td>
            <td>${statusBadge(row.status, row.status === 'New' ? 'new' : row.status === 'Investigating' ? 'investigating' : 'waiting')}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;
}

function renderPortfolio() {
  const selected = state.selectedSecurity ? positions.find((row) => row.security === state.selectedSecurity) : null;
  const selectedRating = state.activeMetric?.startsWith('rating:') ? state.activeMetric.slice(7) : null;
  const visiblePositions = selectedRating ? positions.filter((row) => row.rating === selectedRating) : positions;
  const heatmap = ['AAA', 'AA-', 'AA', 'A+'].map((rating) => `
    <button class="heat-cell ${selectedRating === rating ? 'selected' : ''}" data-rating="${rating}">
      <span>${rating}</span><strong>${positions.filter((row) => row.rating === rating).length}</strong><small>${formatContextAmount(positions.filter((row) => row.rating === rating).reduce((sum, row) => sum + row.current, 0), state.context.currency)}</small>
    </button>
  `).join('');
  return `
    <section class="analysis-toolbar panel">
      <div class="toolbar-group"><label>METRIC</label><button class="select-button">P&L ${icon('chevron')}</button></div>
      <div class="toolbar-group"><label>VIEW</label><button class="select-button">Heatmap ${icon('chevron')}</button></div>
      <div class="toolbar-group"><label>GROUP BY</label><button class="select-button">Rating ${icon('chevron')}</button></div>
      <div class="toolbar-group"><label>X AXIS</label><button class="select-button">Maturity ${icon('chevron')}</button></div>
      <div class="toolbar-divider"></div>
      <div class="active-filters"><span class="eyebrow">ACTIVE FILTERS</span>${selectedRating ? `      <button class="filter-chip" data-action="clear-metric">${escapeHtml(selectedRating)} ${icon('close')}</button>` : '<span class="muted">None</span>'}</div>
      <button class="button button-secondary toolbar-reset" data-action="clear-metric">Reset</button>
    </section>
    <section class="explorer-grid">
      <article class="panel heatmap-panel">
        <div class="panel-header"><div><span class="eyebrow">PORTFOLIO EXPLORER</span><h2>Rating × residual maturity</h2></div><span class="compare-label">Current vs ${compareLabels[state.context.compare]}</span></div>
        <div class="heatmap-layout"><div class="heatmap-y-label">RATING</div><div class="heatmap"><div class="heatmap-axis"><span>0–1Y</span><span>1–3Y</span><span>3–5Y</span><span>5–7Y</span></div><div class="heatmap-grid">${heatmap}</div></div></div>
        <div class="chart-legend"><span><i class="legend-square square-low"></i> Lower exposure</span><span><i class="legend-square square-high"></i> Higher exposure</span></div>
      </article>
      <article class="panel contributors-panel">
        <div class="panel-header"><div><span class="eyebrow">CONTRIBUTION</span><h2>Top / bottom</h2></div><button class="text-button" data-explain="pnl">Explain ${icon('external')}</button></div>
        <div class="contributor-list">${positions.slice().sort((a, b) => a.contribution - b.contribution).map((row) => `<button class="contributor-row" data-security="${row.security}"><span class="contributor-name">${row.security}</span><span class="contributor-bar"><i class="${row.contribution < 0 ? 'negative' : 'positive'}" style="width:${Math.min(Math.abs(row.contribution) * 12, 100)}%"></i></span><strong class="${row.contribution < 0 ? 'negative-value' : 'positive-value'}">${formatSignedNumber(row.contribution)}%</strong></button>`).join('')}</div>
      </article>
    </section>
    <section class="panel table-panel">
      <div class="panel-header"><div><span class="eyebrow">POSITION DETAIL</span><h2>Positions <span class="count-badge">${visiblePositions.length}</span></h2></div><div class="table-actions"><button class="button button-secondary" data-action="export">Export CSV</button><button class="button button-secondary">Columns ${icon('chevron')}</button></div></div>
      <div class="table-wrap"><table class="data-table position-table"><thead><tr><th>Security</th><th>Issuer</th><th>Rating</th><th>Maturity</th><th class="align-right">Current</th><th class="align-right">Δ</th><th class="align-right">Contribution</th><th>Action</th></tr></thead><tbody>${visiblePositions.map((row) => `<tr class="${selected?.security === row.security ? 'row-selected' : ''}" data-security="${escapeHtml(row.security)}" tabindex="0"><td><strong class="security-cell">${escapeHtml(row.security)}</strong><small>${escapeHtml(row.assetClass)}</small></td><td>${escapeHtml(row.issuer)}</td><td><span class="rating-label">${escapeHtml(row.rating)}</span></td><td>${escapeHtml(row.maturity)}</td><td class="align-right numeric">${formatContextAmount(row.current, state.context.currency)}</td><td class="align-right numeric ${row.delta < 0 ? 'negative-value' : 'positive-value'}">${formatContextAmount(row.delta, state.context.currency)}</td><td class="align-right numeric">${formatSignedNumber(row.contribution)}%</td><td><button class="link-button" data-security-detail="${escapeHtml(row.security)}">View detail ${icon('external')}</button></td></tr>`).join('')}</tbody></table></div>
    </section>
    ${selected ? renderSecurityDetail(selected) : ''}
  `;
}

function renderSecurityDetail(row) {
  return `<div class="detail-inline"><div><span class="eyebrow">SELECTED SECURITY</span><h2>${escapeHtml(row.security)}</h2><p>${escapeHtml(row.isin)} · ${escapeHtml(row.issuer)} · ${escapeHtml(row.rating)}</p></div><div class="detail-inline-grid"><span>Position value<strong>${formatContextAmount(row.current, state.context.currency)}</strong></span><span>Available to lend<strong>${formatContextAmount(row.available, state.context.currency)}</strong></span><span>Fee benchmark<strong>${row.fee.toFixed(2)}%</strong></span><span>Contribution<strong class="${row.contribution < 0 ? 'negative-value' : 'positive-value'}">${formatSignedNumber(row.contribution)}%</strong></span></div><button class="button button-secondary" data-explain="pnl">Explain this number</button><button class="icon-button detail-close" data-action="clear-security" aria-label="Close detail">${icon('close')}</button></div>`;
}

function renderOperations(filteredExceptions) {
  const selected = exceptions.find((row) => row.id === state.selectedException) || filteredExceptions[0];
  return `
    <section class="operations-layout">
      <article class="panel operations-queue">
        <div class="panel-header"><div><span class="eyebrow">RECONCILIATION ENGINE</span><h2>Exception queue <span class="count-badge">${filteredExceptions.length}</span></h2></div><button class="button button-secondary" data-action="refresh">${icon('refresh')} Re-run checks</button></div>
        <div class="queue-toolbar"><select data-filter="severity"><option value="all">All severity</option>${['Critical', 'High', 'Warning', 'Info'].map((value) => `<option ${state.exceptionFilters.severity === value ? 'selected' : ''}>${value}</option>`).join('')}</select><select data-filter="status"><option value="all">All status</option>${['New', 'Investigating', 'Waiting', 'Resolved'].map((value) => `<option ${state.exceptionFilters.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select><span class="queue-sort">${icon('info')} ${state.exceptionFilters.search ? `Search: ${escapeHtml(state.exceptionFilters.search)}` : 'All operational exceptions'}</span></div>
        ${renderExceptionTable(filteredExceptions)}
      </article>
      ${selected ? renderOperationsDetail(selected) : '<article class="panel empty-state">Select an exception to inspect its system values.</article>'}
    </section>
  `;
}

function renderOperationsDetail(row) {
  return `
    <article class="panel exception-detail">
      <div class="detail-heading"><div><span class="eyebrow">${escapeHtml(row.id)} · EXCEPTION DETAIL</span><h2>${escapeHtml(row.type)}</h2><p>${escapeHtml(row.security)} · ${escapeHtml(row.isin)}</p></div>${severityBadge(row.severity)}</div>
      <div class="detail-alert"><span>${icon('alert')}</span><div><strong>${formatContextAmount(row.amount, state.context.currency)} impact</strong><p>${escapeHtml(row.reason)}</p></div></div>
      <div class="detail-section"><span class="eyebrow">SYSTEM COMPARISON</span><div class="comparison-grid">${Object.entries(row.systems).map(([system, value]) => `<div><span>${escapeHtml(system)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div></div>
      <div class="detail-form"><label for="reason">Root cause / handling note</label><textarea id="reason" rows="3" placeholder="Add an auditable handling note...">${escapeHtml(row.reason)}</textarea><div class="form-row"><label for="owner">Owner<select id="owner"><option>${escapeHtml(row.owner)}</option><option>J. Kim</option><option>M. Lee</option><option>S. Park</option></select></label><label for="status">Status<select id="status"><option>${escapeHtml(row.status)}</option><option>New</option><option>Investigating</option><option>Waiting</option><option>Resolved</option></select></label></div><div class="form-actions"><button class="button button-secondary" data-action="open-explain-exception">Explain source</button><button class="button button-primary" data-action="save-exception" data-exception-id="${escapeHtml(row.id)}">Save update</button></div></div>
      <div class="audit-note">${icon('info')} Save is server-confirmed and creates an Audit ID. Waived requires reason and Manager approval.</div>
    </article>
  `;
}

function renderLending() {
  const totalHolding = lendingRows.reduce((sum, row) => sum + row.holding, 0);
  const totalOnLoan = lendingRows.reduce((sum, row) => sum + row.onLoan, 0);
  const totalAvailable = lendingRows.reduce((sum, row) => sum + row.available, 0);
  const avgUtilization = (totalOnLoan / totalHolding) * 100;
  return `
    <section class="mini-kpi-grid">${[
      ['Holding balance', formatContextAmount(totalHolding, state.context.currency), 'Official'],
      ['On loan', formatContextAmount(totalOnLoan, state.context.currency), `${avgUtilization.toFixed(1)}% utilization`],
      ['Available balance', formatContextAmount(totalAvailable, state.context.currency), 'Across 5 securities'],
      ['Collateral coverage', '99.4%', '1 Critical exception'],
    ].map(([label, value, sub]) => `<article class="mini-kpi"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>`).join('')}</section>
    <section class="explorer-grid">
      <article class="panel lending-chart"><div class="panel-header"><div><span class="eyebrow">OPPORTUNITY MAP</span><h2>Fee × available balance</h2></div><span class="compare-label">Size = holding value</span></div><div class="scatter">${lendingRows.map((row) => `<button class="scatter-dot ${row.collateral < 100 ? 'risk' : ''}" style="left:${Math.min(row.fee * 90, 92)}%;bottom:${Math.min(row.available / 1400000000, 88)}%" data-security="${row.security}" title="${row.security}">${row.security.split(' ')[0].slice(0, 2)}</button>`).join('')}<span class="axis-label axis-x">Fee benchmark →</span><span class="axis-label axis-y">Available balance</span></div><div class="chart-legend"><span><i class="legend-dot dot-positive"></i> Opportunity</span><span><i class="legend-dot dot-negative"></i> Collateral below 100%</span></div></article>
      <article class="panel lending-ranking"><div class="panel-header"><div><span class="eyebrow">RANKING</span><h2>Opportunity ranking</h2></div><button class="why-button" data-explain="lending">Why?</button></div><div class="ranking-list">${lendingRows.slice().sort((a, b) => b.fee * b.available - a.fee * a.available).map((row, index) => `<button class="ranking-row" data-security="${escapeHtml(row.security)}"><span class="rank">${String(index + 1).padStart(2, '0')}</span><span><strong>${escapeHtml(row.security)}</strong><small>${formatContextAmount(row.available, state.context.currency)} available · ${row.fee.toFixed(2)}% fee</small></span><b>${formatContextAmount(row.available * row.fee / 100 / 365, state.context.currency)}<small>/ day</small></b></button>`).join('')}</div></article>
    </section>
    <section class="panel table-panel"><div class="panel-header"><div><span class="eyebrow">INVENTORY & COLLATERAL</span><h2>Inventory detail</h2></div><span class="compare-label">Intraday · 09:40 KST</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Security</th><th>Rating</th><th class="align-right">Holding</th><th class="align-right">On loan</th><th class="align-right">Available</th><th class="align-right">Utilization</th><th class="align-right">Fee</th><th class="align-right">Collateral</th><th>Counterparty</th></tr></thead><tbody>${lendingRows.map((row) => `<tr data-security="${escapeHtml(row.security)}" tabindex="0"><td><strong>${escapeHtml(row.security)}</strong></td><td>${escapeHtml(row.rating)}</td><td class="align-right numeric">${formatContextAmount(row.holding, state.context.currency)}</td><td class="align-right numeric">${formatContextAmount(row.onLoan, state.context.currency)}</td><td class="align-right numeric">${formatContextAmount(row.available, state.context.currency)}</td><td class="align-right numeric">${row.utilization.toFixed(1)}%</td><td class="align-right numeric">${row.fee.toFixed(2)}%</td><td class="align-right numeric ${row.collateral < 100 ? 'negative-value' : 'positive-value'}">${row.collateral.toFixed(1)}%</td><td>${escapeHtml(row.counterparty)}</td></tr>`).join('')}</tbody></table></div></section>
  `;
}

function renderScenario() {
  const scenario = state.scenario;
  const validation = validateScenario(scenario);
  const fields = [
    ['rate', 'Rate shock', 'bp', -100, 100],
    ['spread', 'Spread shock', 'bp', -100, 200],
    ['fx', 'FX shock', '%', -10, 10],
    ['fee', 'Lending fee', 'bp', -50, 100],
    ['lendingRatio', 'Lending ratio', '%', 0, 100],
    ['haircut', 'Haircut', '%', 0, 20],
  ];
  const currentPnl = -12480000000;
  const pnlImpact = (scenario.rate * 420000000) + (scenario.spread * -210000000) + ((scenario.fx - 1) * 8500000000);
  const revenueImpact = ((scenario.fee / 100) * 394800000000 * (scenario.lendingRatio / 100)) / 365;
  const collateralImpact = scenario.haircut * -1.8;
  const assumptions = fields.map(([key, label, suffix, min, max]) => `
    <label class="assumption-row" for="scenario-${key}">
      <span>${label}<small>Allowed ${min} to ${max} ${suffix}</small></span>
      <span>
        <span class="input-suffix">
          <input id="scenario-${key}" data-scenario="${key}" type="number" min="${min}" max="${max}" value="${escapeHtml(scenario[key])}" aria-invalid="${validation.errors[key] ? 'true' : 'false'}" />
          <b>${suffix}</b>
        </span>
        <small class="input-error" data-error-for="${key}">${escapeHtml(validation.errors[key] || '')}</small>
      </span>
    </label>
  `).join('');
  return `
    <div class="simulation-banner"><span class="simulation-tag">SIMULATION</span><strong>Scenario Draft 03</strong><span>Base: ${escapeHtml(state.context.asOf)} · ${escapeHtml(state.context.portfolio)}</span><button data-action="reset-scenario">Reset assumptions</button></div>
    <section class="scenario-layout">
      <article class="panel assumptions-panel"><div class="panel-header"><div><span class="eyebrow">ASSUMPTIONS</span><h2>Market & lending shocks</h2></div><span class="status-badge status-scenario"><span class="status-dot"></span>Draft</span></div><div class="assumptions">${assumptions}</div><div class="form-actions"><button class="button button-secondary" data-action="reset-scenario">Reset</button><button class="button button-primary" data-action="run-scenario" ${validation.valid ? '' : 'disabled'}>Run scenario</button></div><div class="audit-note">${icon('info')} Scenario is indicative and never writes to official ledger or operations state.</div></article>
      <article class="panel scenario-results"><div class="panel-header"><div><span class="eyebrow">RESULTS · INDICATIVE</span><h2>Current vs Scenario</h2></div>${scenario.hasRun ? statusBadge('Applied', 'scenario') : statusBadge('Not run', 'neutral')}</div><div class="result-table"><div class="result-head"><span>Metric</span><span>Current</span><span>Scenario</span><span>Delta</span></div>${[['P&L', formatContextAmount(currentPnl, state.context.currency), formatContextAmount(currentPnl + pnlImpact, state.context.currency), formatContextAmount(pnlImpact, state.context.currency)], ['Lending revenue / day', formatContextAmount(452000000, state.context.currency), formatContextAmount(452000000 + revenueImpact, state.context.currency), formatContextAmount(revenueImpact, state.context.currency)], ['Collateral coverage', '99.4%', `${(99.4 + collateralImpact).toFixed(1)}%`, `${collateralImpact.toFixed(1)} pp`]].map(([label, current, result, delta]) => `<div class="result-row"><strong>${label}</strong><span>${current}</span><span>${result}</span><b class="${delta.startsWith('-') ? 'negative-value' : 'positive-value'}">${delta}</b></div>`).join('')}</div><div class="scenario-callout">${icon('info')} Model: duration approximation · FX translation · simple fee/day-count. Full reprice is not included.</div></article>
    </section>
  `;
}

function renderAdmin() {
  return `
    <section class="admin-grid">
      <article class="panel table-panel"><div class="panel-header"><div><span class="eyebrow">METRIC DICTIONARY</span><h2>Registered metrics <span class="count-badge">${metricDictionary.length}</span></h2></div><button class="button button-primary">Add metric</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Metric</th><th>Definition</th><th>Unit</th><th>Source</th><th>Version</th><th>Owner</th></tr></thead><tbody>${metricDictionary.map((row) => `<tr><td><strong>${row.metric}</strong><small>${row.id}</small></td><td class="definition-cell">${row.definition}</td><td>${row.unit}</td><td>${row.source}</td><td><span class="version-label">${row.version}</span></td><td>${row.owner}</td></tr>`).join('')}</tbody></table></div></article>
      <article class="panel audit-panel"><div class="panel-header"><div><span class="eyebrow">AUDIT TRAIL</span><h2>Recent activity</h2></div><button class="text-button">View all ${icon('external')}</button></div><div class="audit-list">${auditEvents.map((event) => `<div class="audit-row"><time>${event.time}</time><div><strong>${event.action}</strong><span>${event.actor} · ${event.target}</span></div><code>${event.result}</code></div>`).join('')}</div><div class="audit-note">${icon('info')} Audit events are append-only and retain before/after values for controlled updates.</div></article>
    </section>
    <section class="mini-kpi-grid admin-status">${[['Data quality', 'Fresh', '7 / 7 sources within SLA'], ['Metric coverage', '100%', 'Must metrics have lineage'], ['Last snapshot', '09:42 KST', 'Official · 2026-08-11'], ['Access policy', 'RBAC active', 'Portfolio + role scope']].map(([label, value, sub]) => `<article class="mini-kpi"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>`).join('')}</section>
  `;
}

function renderExplainDrawer(metricId) {
  const metric = metricId === 'lending'
    ? { ...metrics[4], label: 'Lending opportunity', koreanLabel: '대여 기회', value: 18, unit: 'securities', definition: '대여가능 잔고, fee, 예상수익, 담보 리스크를 함께 고려한 후보 목록', formula: 'available_balance × fee × day_count', source: 'Lending inventory + fee benchmark', systemValues: { Inventory: 18, 'Fee benchmark': 0.64, 'Risk flags': 1 } }
    : metrics.find((item) => item.id === metricId) || metrics[0];
  const systemUnit = metric.unit === 'cases' || metric.unit === 'securities' ? metric.unit : 'KRW';
  return `
    <div class="drawer-backdrop" data-action="close-drawer"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="Explain metric">
      <div class="drawer-header"><div><span class="eyebrow">EXPLAIN THIS NUMBER</span><h2>${metric.koreanLabel}</h2><p>${metricValue(metric)} · ${state.context.asOf} ${statusBadge(metric.status, metric.status === 'Official' ? 'official' : 'intraday')}</p></div><button class="icon-button" data-action="close-drawer" aria-label="Close explain drawer">${icon('close')}</button></div>
      <div class="drawer-body">
        <section class="drawer-section"><span class="drawer-label">DEFINITION</span><p>${metric.definition}</p></section>
        <section class="drawer-section"><span class="drawer-label">CALCULATION</span><code>${metric.formula}</code><small>Same metric definition and currency conversion are used for Current and Compare.</small></section>
        <section class="drawer-section"><span class="drawer-label">SYSTEM VALUES</span><div class="system-values">${Object.entries(metric.systemValues || {}).map(([system, value]) => `<div><span>${escapeHtml(system)}</span><strong>${formatContextAmount(value, state.context.currency, systemUnit)}</strong></div>`).join('')}</div></section>
        <section class="drawer-section"><span class="drawer-label">SOURCE & LINEAGE</span><div class="lineage"><div><span class="lineage-node node-source">1</span><span>Source snapshot<strong>${escapeHtml(metric.source)}</strong></span></div><i></i><div><span class="lineage-node node-transform">2</span><span>Semantic metric<strong>${escapeHtml(metric.formula)}</strong></span></div><i></i><div><span class="lineage-node node-view">3</span><span>Current view<strong>${escapeHtml(state.context.portfolio)} · ${escapeHtml(state.context.currency)}</strong></span></div></div></section>
        <section class="drawer-section meta-grid"><div><span class="drawer-label">AS-OF</span><strong>${escapeHtml(state.context.asOf)} 09:42 KST</strong></div><div><span class="drawer-label">OWNER</span><strong>${escapeHtml(metric.owner)}</strong></div><div><span class="drawer-label">VERSION</span><strong>Metric definition v1.0</strong></div><div><span class="drawer-label">STATUS</span><strong>${statusBadge('Fresh', 'fresh')}</strong></div></section>
      </div>
      <div class="drawer-footer"><button class="button button-secondary" data-action="close-drawer">Close</button><button class="button button-primary" data-view="portfolio">Open related records ${icon('external')}</button></div>
    </aside>
  `;
}

function renderExceptionDrawer(exceptionId) {
  const row = exceptions.find((item) => item.id === exceptionId);
  if (!row) return '';
  return `
    <div class="drawer-backdrop" data-action="close-drawer"></div>
    <aside class="drawer drawer-exception" role="dialog" aria-modal="true" aria-label="Exception detail">
      <div class="drawer-header"><div><span class="eyebrow">${escapeHtml(row.id)} · EXCEPTION DETAIL</span><h2>${escapeHtml(row.type)}</h2><p>${escapeHtml(row.security)} · ${escapeHtml(row.counterparty)}</p></div><button class="icon-button" data-action="close-drawer" aria-label="Close detail">${icon('close')}</button></div>
      <div class="drawer-body"><div class="detail-alert"><span>${icon('alert')}</span><div><strong>${escapeHtml(row.severity)} · ${formatContextAmount(row.amount, state.context.currency)} impact</strong><p>${escapeHtml(row.reason)}</p></div></div><section class="drawer-section"><span class="drawer-label">SYSTEM COMPARISON</span><div class="system-values">${Object.entries(row.systems).map(([system, value]) => `<div><span>${escapeHtml(system)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div></section><section class="drawer-section"><span class="drawer-label">WORKFLOW</span><div class="workflow-meta"><div><span>Owner</span><strong>${escapeHtml(row.owner)}</strong></div><div><span>Due</span><strong class="${row.dueSort <= 2 ? 'due-soon' : ''}">${escapeHtml(row.due)}</strong></div><div><span>Status</span><strong>${statusBadge(row.status, row.status === 'New' ? 'new' : 'investigating')}</strong></div></div></section><section class="drawer-section"><span class="drawer-label">SOURCE</span><p>${escapeHtml(row.source)}<br /><small>As-of ${escapeHtml(row.asOf)} · Rule version R-01</small></p></section></div>
      <div class="drawer-footer"><button class="button button-secondary" data-action="close-drawer">Close</button><button class="button button-primary" data-view="operations">Open workflow ${icon('external')}</button></div>
    </aside>
  `;
}

function showToast(message) {
  const region = root.querySelector('.toast-region');
  if (!region) return;
  region.innerHTML = `<div class="toast">${icon('info')} ${escapeHtml(message)}</div>`;
  window.setTimeout(() => { region.innerHTML = ''; }, 2800);
}

function bindEvents() {
  root.querySelectorAll('[data-view]').forEach((element) => {
    element.addEventListener('click', () => {
      state.view = element.dataset.view;
      state.selectedException = null;
      state.explainMetric = null;
      render();
    });
  });

  root.querySelectorAll('[data-explain]').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      state.explainMetric = element.dataset.explain;
      state.selectedException = null;
      render();
    });
  });

  root.querySelectorAll('[data-metric]').forEach((element) => {
    const selectMetric = () => {
      state.activeMetric = state.activeMetric === element.dataset.metric ? null : element.dataset.metric;
      if (state.activeMetric === 'settlement-fail' || state.activeMetric === 'critical') {
        state.exceptionFilters.severity = 'all';
        state.exceptionFilters.status = 'all';
      }
      render();
    };
    element.addEventListener('click', selectMetric);
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectMetric();
      }
    });
  });

  root.querySelectorAll('[data-exception]').forEach((element) => {
    const selectException = () => {
      state.selectedException = element.dataset.exception;
      state.explainMetric = null;
      render();
    };
    element.addEventListener('click', selectException);
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectException();
      }
    });
  });

  root.querySelectorAll('[data-security]').forEach((element) => {
    element.addEventListener('click', () => {
      state.selectedSecurity = element.dataset.security;
      render();
      if (state.view === 'lending') showToast(`${element.dataset.security} selected`);
    });
  });

  root.querySelectorAll('[data-rating]').forEach((element) => {
    element.addEventListener('click', () => {
      state.activeMetric = state.activeMetric === `rating:${element.dataset.rating}`
        ? null
        : `rating:${element.dataset.rating}`;
      render();
    });
  });

  root.querySelectorAll('[data-security-detail]').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      state.selectedSecurity = element.dataset.securityDetail;
      render();
    });
  });

  root.querySelectorAll('[data-filter]').forEach((element) => {
    element.addEventListener('change', () => {
      state.exceptionFilters[element.dataset.filter] = element.value;
      render();
    });
  });

  const search = root.querySelector('#global-search');
  if (search) {
    search.addEventListener('input', () => {
      state.exceptionFilters.search = search.value;
      const cursorPosition = search.selectionStart;
      render();
      const nextSearch = root.querySelector('#global-search');
      nextSearch.focus();
      nextSearch.setSelectionRange(cursorPosition, cursorPosition);
    });
  }

  ['as-of', 'portfolio', 'currency', 'compare'].forEach((field) => {
    const element = root.querySelector(`#${field}`);
    if (!element) return;
    element.addEventListener('change', () => {
      state.context[field === 'as-of' ? 'asOf' : field] = element.value;
      syncUrl();
      render();
    });
  });

  root.querySelectorAll('[data-scenario]').forEach((element) => {
    element.addEventListener('input', () => {
      state.scenario[element.dataset.scenario] = Number(element.value);
      state.scenario.hasRun = false;
      const validation = validateScenario(state.scenario);
      state.scenario.errors = validation.errors;
      element.setAttribute('aria-invalid', validation.errors[element.dataset.scenario] ? 'true' : 'false');
      const error = element.closest('.assumption-row')?.querySelector('.input-error');
      if (error) error.textContent = validation.errors[element.dataset.scenario] || '';
      const runButton = root.querySelector('[data-action="run-scenario"]');
      if (runButton) runButton.disabled = !validation.valid;
    });
  });

  root.querySelectorAll('[data-action]').forEach((element) => {
    element.addEventListener('click', () => handleAction(element.dataset.action, element));
  });
}

const actionHandlers = {
  'close-drawer': () => {
    state.explainMetric = null;
    state.selectedException = null;
    render();
  },
  'clear-metric': () => {
    state.activeMetric = null;
    state.selectedSecurity = null;
    render();
  },
  'clear-exceptions': () => {
    state.exceptionFilters = { severity: 'all', status: 'all', search: '' };
    render();
  },
  reset: () => {
    state.activeMetric = null;
    state.selectedSecurity = null;
    state.exceptionFilters = { severity: 'all', status: 'all', search: '' };
    render();
  },
  refresh: () => {
    showToast('Snapshot refresh requested · last successful load 09:42 KST');
  },
  'show-status': () => {
    showToast('All 7 sources are Fresh or within their SLA');
  },
  'saved-view': () => {
    showToast('Saved views are scoped to the current user');
  },
  'save-view': () => {
    showToast('View saved for Jiho Kim');
  },
  export: () => {
    showToast('Export queued with current context and metric definition v1.0');
  },
  'reset-scenario': () => {
    state.scenario = { rate: -25, spread: 10, fx: 1, fee: 5, lendingRatio: 70, haircut: 2, hasRun: false, errors: {} };
    render();
  },
  'run-scenario': () => {
    const validation = validateScenario(state.scenario);
    if (!validation.valid) {
      state.scenario.errors = validation.errors;
      render();
      showToast('Scenario contains invalid assumptions');
      return;
    }
    state.scenario.hasRun = true;
    render();
    showToast('Scenario applied · no official data was changed');
  },
  'save-exception': (element) => {
    const id = element.dataset.exceptionId || state.selectedException;
    const reason = root.querySelector('#reason')?.value.trim();
    const owner = root.querySelector('#owner')?.value;
    const status = root.querySelector('#status')?.value;
    if (!id || !reason) {
      showToast('A handling note is required before saving');
      return;
    }
    try {
      const result = repository.updateException(id, { reason, owner, status });
      state.selectedException = id;
      render();
      showToast(`Update saved · Audit ID ${result.auditId}`);
    } catch (error) {
      showToast(`Unable to save update: ${error.message}`);
    }
  },
  'open-explain-exception': () => {
    state.explainMetric = 'settlement';
    state.selectedException = null;
    render();
  },
  'clear-security': () => {
    state.selectedSecurity = null;
    render();
  },
};

function handleAction(action, element) {
  const handler = actionHandlers[action];
  if (!handler) {
    console.error(`Unsupported UI action: ${action}`);
    showToast(`Unsupported action: ${action}`);
    return;
  }
  handler(element);
}

render();
