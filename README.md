# bondb

Investment Operations Intelligence Workbench for bond operations.

## Run locally

```bash
npm run dev
```

Open <http://localhost:4173>. By default, the app fetches the verified FreeSIS
market-funds XHR and displays official source data. If that source is
unavailable, the app shows a data-unavailable state rather than inventing
financial values.

## Live data

The default application does **not** display the bundled demo numbers. It calls
the verified FreeSIS request for `증시자금추이`:

```
POST https://freesis.kofia.or.kr/meta/getMetaDataList.do
OBJ_NM=STATSCU0100000060BO
```

The response is retained as source-priority `0`, with the service registry
metadata shown in the UI. To use an internal portfolio snapshot instead,
configure the server with a live snapshot endpoint:

```bash
SNAPSHOT_URL=https://your-internal-service.example/snapshot npm run dev
```

An internal endpoint must return JSON with `asOf`, `snapshotTime`, and these arrays:
`cashflows`, `checklist`, `drivers`, `lendingRows`, `metricDictionary`, `metrics`,
`positions`, `exceptions`, and `auditEvents`. Refresh requests the endpoint again
with `Cache-Control: no-store`. If either source is missing or invalid, the UI
shows an unavailable state instead of presenting synthetic values.

For local-only UI testing, explicitly use
<http://localhost:4173/?demo=true>. Demo mode is labeled as demo data and is
never presented as live or official data.

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
