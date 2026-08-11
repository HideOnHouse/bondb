import {
  auditEvents,
  cashflows,
  checklist,
  drivers,
  exceptions,
  lendingRows,
  metricDictionary,
  metrics,
  navigation,
  positions,
} from './data.js';

function cloneException(row) {
  return { ...row, systems: { ...row.systems } };
}

function cloneRows(rows) {
  return rows.map((row) => ({ ...row }));
}

export function createDemoRepository() {
  const exceptionStore = exceptions.map(cloneException);
  const auditStore = auditEvents.map((event) => ({ ...event }));
  let auditSequence = 98219;

  function readSnapshot() {
    return {
      cashflows: cloneRows(cashflows),
      checklist: cloneRows(checklist),
      drivers: cloneRows(drivers),
      lendingRows: cloneRows(lendingRows),
      metricDictionary: cloneRows(metricDictionary),
      metrics: cloneRows(metrics),
      navigation: cloneRows(navigation),
      positions: cloneRows(positions),
    };
  }

  return {
    getSnapshot: readSnapshot,
    refreshSnapshot: readSnapshot,
    getExceptions() {
      return exceptionStore;
    },
    getAuditEvents() {
      return auditStore;
    },
    updateException(id, changes) {
      const row = exceptionStore.find((exception) => exception.id === id);
      if (!row) {
        throw new Error(`Exception ${id} was not found`);
      }

      const before = { owner: row.owner, status: row.status, reason: row.reason };
      Object.assign(row, {
        owner: changes.owner || row.owner,
        status: changes.status || row.status,
        reason: changes.reason || row.reason,
      });
      const auditId = `AUD-${auditSequence}`;
      auditSequence += 1;
      auditStore.unshift({
        time: new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Seoul',
        }).format(new Date()),
        actor: 'Jiho Kim',
        action: 'Updated exception',
        target: `${id} · ${before.status} → ${row.status}`,
        result: auditId,
      });
      return { row, auditId };
    },
  };
}
