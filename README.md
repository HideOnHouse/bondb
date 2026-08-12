# bondb

External market intelligence dashboard for bond closing, settlement-calendar,
and securities-lending reference data.

The approved product scope uses public or properly licensed external data only.
It does not connect to internal systems or accept holdings, trades, accounting,
settlement, counterparty, or other private business data.

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

Additional approved external sources such as ECOS, OpenDART, KRX, KSD, and
licensed pricing providers will be added through server-side source adapters.
Provider keys must remain outside browser code and the repository. See
[`docs/design-document.md`](docs/design-document.md) and
[`docs/SOURCE.md`](docs/SOURCE.md).

## Deploy on EC2

The production service is defined in [`deploy/bondb.service`](deploy/bondb.service).
It runs the Node server on port 80 using the Node 22 runtime installed with nvm.
Create `/etc/bondb/bondb.env` outside the repository, keep it root-owned with
mode `0600`, and place the server-side values there:

```text
DATA_GO_KR_SERVICE_KEY=your-private-key
DATA_GO_KR_MONETARY_SCALE=1000000
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

- Official KOFIA market-funds data through FreeSIS.
- Financial Services Commission Public Data Portal fallback.
- Source provenance, observation date, retrieval time, explicit unavailable
  states, and URL date context.

The remaining dashboard, rates, calendar, event, and lending-market features are
tracked in [`docs/TODO.md`](docs/TODO.md).
