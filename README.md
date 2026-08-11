# bondb

Investment Operations Intelligence Workbench for bond operations.

## Run locally

```bash
npm run dev
```

Open <http://localhost:4173>. The app uses a deterministic demo snapshot so the
core investigation flows can be exercised without internal data sources.

## Implemented first slice

- PatternFly-aligned application shell with persistent As-of, Portfolio, Currency,
  and Compare context.
- Morning Cockpit KPI strip, data freshness banner, change drivers, exception-first
  Action Queue, upcoming cashflow, and closing checklist.
- Portfolio Explorer, Settlement & Reconciliation, Securities Lending, Scenario
  Lab, and Administration views using the same context and demo data.
- Cross-filtering, URL context state, keyboard-accessible table rows, explain
  drawer with metric lineage, scenario reset, and auditable exception update
  feedback.

The reference requirements remain in `docs/design-document.md` and
`docs/todo.md`.
