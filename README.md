# bondb

Investment Operations Intelligence Workbench for bond operations.

## Run locally

```bash
npm run dev
```

Open <http://localhost:4173>. The app uses a deterministic demo snapshot so the
core investigation flows can be exercised without internal data sources.

## Deploy on EC2

The production service is defined in [`deploy/bondb.service`](deploy/bondb.service).
It runs the Node server on port 80 using the Node 22 runtime installed with nvm.
When replacing an existing deployment, stop its service and move the current
`/home/ubuntu/bondb` directory to a timestamped archive before copying this
repository into its place.

```bash
sudo install -m 0644 deploy/bondb.service /etc/systemd/system/bondb.service
sudo systemctl daemon-reload
sudo systemctl enable --now bondb.service
```

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

The implementation follows the supplied Investment Operations Intelligence
Workbench design package. This branch intentionally keeps the reference
documents outside the runnable demo so the application can remain dependency-free.
