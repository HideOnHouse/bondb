# bondb

Investment Operations Intelligence Workbench for bond operations.

## Run locally

```bash
npm run dev
```

Open <http://localhost:4173>. The app fetches official market-funds data and
shows a data-unavailable state rather than inventing financial values.

## Live data

The primary source is the verified FreeSIS request for `증시자금추이`:

```
POST https://freesis.kofia.or.kr/meta/getMetaDataList.do
OBJ_NM=STATSCU0100000060BO
```

FreeSIS is source priority `0`. If FreeSIS fails, the server can use the
official Financial Services Commission Public Data Portal API as priority `1`.
The fallback is labelled in the UI with its provider, reason, observation date,
retrieval time, and official reference link.

Obtain the fallback key:

1. Sign in at <https://www.data.go.kr>.
2. Open dataset `15094809`, 금융위원회_금융투자협회종합통계정보.
3. Select `활용신청` and request access.
4. Copy the `일반 인증키` from `마이페이지 → 데이터 활용 → Open API`.

Keep the key server-side and configure it with:

```bash
export DATA_GO_KR_SERVICE_KEY='your-private-key'
export DATA_GO_KR_MONETARY_SCALE='1000000'
npm run dev
```

`DATA_GO_KR_MONETARY_SCALE` must be set only after comparing an authenticated
fallback row with an overlapping FreeSIS row. The official API documents the
field meanings but not the monetary scale, so the server refuses to activate
the fallback without this explicit operator validation.

To use an authorized internal portfolio snapshot instead, configure the server
with a live snapshot endpoint:

```bash
SNAPSHOT_URL=https://your-internal-service.example/snapshot npm run dev
```

An internal endpoint must return JSON with `asOf`, `snapshotTime`, and these arrays:
`cashflows`, `checklist`, `drivers`, `lendingRows`, `metricDictionary`, `metrics`,
`positions`, `exceptions`, and `auditEvents`. Refresh requests the endpoint again
with `Cache-Control: no-store`. This endpoint is for authorized private
portfolio data only; the public FreeSIS/FSC sources do not provide portfolio
holdings, P&L, settlement workflow, lending inventory, or exception queues.
If a source is missing or invalid, the UI remains unavailable.

## Deploy on EC2

The production service is defined in [`deploy/bondb.service`](deploy/bondb.service).
It runs the Node server on port 80 using the Node 22 runtime installed with nvm.
Create `/etc/bondb/bondb.env` outside the repository, keep it root-owned with
mode `0600`, and place the server-side values there:

```text
DATA_GO_KR_SERVICE_KEY=your-private-key
DATA_GO_KR_MONETARY_SCALE=1000000
SNAPSHOT_URL=https://internal.example/snapshot
```

When replacing an existing deployment, stop its service and move the current
`/home/ubuntu/bondb` directory to a timestamped archive before copying this
repository into its place.

```bash
sudo install -m 0644 deploy/bondb.service /etc/systemd/system/bondb.service
sudo systemctl daemon-reload
sudo systemctl enable --now bondb.service
```

## Implemented first slice

- PatternFly-aligned application shell with persistent As-of, portfolio, and
  compare context for authorized internal snapshots.
- Morning Cockpit KPI strip, data freshness banner, change drivers, exception-first
  Action Queue, upcoming cashflow, and closing checklist.
- Portfolio Explorer, Settlement & Reconciliation, Securities Lending, and
  Administration views for an authorized internal snapshot.
- Cross-filtering, URL context state, keyboard-accessible table rows, and an
  explain drawer with metric lineage.

The implementation follows the supplied Investment Operations Intelligence
Workbench design package. Reference documents remain outside the runtime
dependency graph so the application stays dependency-free.
