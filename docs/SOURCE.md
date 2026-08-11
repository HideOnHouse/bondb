# Data Sources

## Source priority policy

The application resolves the public market-funds indicator in this order:

1. FreeSIS original data, priority `0`.
2. Financial Services Commission Public Data Portal transport for the KOFIA
   statistics, priority `1`.

The second provider improves transport availability but is not an independent
statistical origin: both channels publish KOFIA statistics. No synthetic,
last-known, or partial source is used when both official requests fail.

Portfolio-specific book value, P&L, holdings, settlement workflow, lending
inventory, and exception data are private and must come from an authorized
`SNAPSHOT_URL`.

## Primary source: FreeSIS

The verified live source is FreeSIS `증시자금추이`:

- Registry page:
  <https://freesis.kofia.or.kr/stat/FreeSIS.do?parentDivId=MSIS10000000000000&serviceId=STATSCU0100000060>
- Parent division: `MSIS10000000000000`
- Service ID: `STATSCU0100000060`
- Source priority: `0`
- Collection method: verified browser `XHR`
- Request:
  `POST https://freesis.kofia.or.kr/meta/getMetaDataList.do`
- Object: `STATSCU0100000060BO`
- Registry: [`src/source-registry.js`](../src/source-registry.js)
- Collector: [`src/market-funds-source.js`](../src/market-funds-source.js)

The request body is:

```json
{
  "dmSearch": {
    "tmpV40": "1000000",
    "tmpV41": "1",
    "tmpV1": "D",
    "tmpV45": "YYYYMMDD",
    "tmpV46": "YYYYMMDD",
    "OBJ_NM": "STATSCU0100000060BO"
  }
}
```

`tmpV45` is three months before the current Asia/Seoul date. `tmpV46` is the
current Asia/Seoul date. The response's first/latest observation is selected
after date normalization and descending sort.

## Official fallback: FSC Public Data Portal

The official fallback is dataset `15094809`, 금융위원회_금융투자협회종합통계정보:

- Dataset page: <https://www.data.go.kr/data/15094809/openapi.do>
- Provider: Financial Services Commission
- Statistical origin: KOFIA
- Source priority: `1`
- API:
  `GET https://apis.data.go.kr/1160100/service/GetKofiaStatisticsInfoService/getSecuritiesMarketTotalCapitalInfo`
- Collection method: official REST API
- Registry: [`src/source-registry.js`](../src/source-registry.js)
- Collector: [`src/market-funds-source.js`](../src/market-funds-source.js)

The server sends `serviceKey`, `numOfRows=1`, `pageNo=1`, `basDt=YYYYMMDD`,
and `_type=json`. It checks the current Asia/Seoul date and the prior six
calendar dates until an observation is returned. The service key is never
included in the snapshot metadata, browser code, logs, or public source link.

Configure the server-side credentials:

```bash
DATA_GO_KR_SERVICE_KEY='your-private-key'
DATA_GO_KR_MONETARY_SCALE='1000000'
```

Obtain the key by signing in at <https://www.data.go.kr>, opening dataset
`15094809`, selecting `활용신청`, and copying the `일반 인증키` from
`마이페이지 → 데이터 활용 → Open API`. Keep it outside the repository.

The API documents the five monetary fields as numbers but does not document
their scale. `DATA_GO_KR_MONETARY_SCALE` is therefore mandatory and must be
set only after an authenticated overlap comparison with FreeSIS confirms the
scale. A missing or invalid scale disables the fallback instead of risking an
incorrect conversion.

## Canonical response mapping

Both official transports are normalized to a market-funds snapshot with
`source`, `sourceType`, `asOf`, `snapshotTime`, `unit`, `monetaryScale`,
`series`, and `latest`.

| Meaning | FreeSIS | FSC API | Application field | Unit |
| --- | --- | --- | --- | --- |
| Observation date | `TMPV1` | `basDt` | `date` | `YYYY-MM-DD` |
| Investor deposits excluding derivatives deposits | `TMPV2` | `invrDpsgAmt` | `investorDeposit` | provider monetary unit |
| Exchange-traded derivatives deposits | `TMPV3` | `onbdDrvPrdTrRcAdvAmt` | `derivativesDeposit` | provider monetary unit |
| Customer RP sell balance | `TMPV4` | `toCstRpchCndBndSlgBal` | `rpBalance` | provider monetary unit |
| Brokerage receivables | `TMPV5` | `brkTrdUcolMny` | `receivables` | provider monetary unit |
| Actual forced-sale amount | `TMPV6` | `brkTrdUcolMnyVsOppsTrdAmt` | `forcedSaleAmount` | provider monetary unit |
| Forced-sale ratio | `TMPV7` | `ucolMnyVsOppsTrdRlImpt` | `forcedSaleRatio` | `%` |

FreeSIS monetary values are KRW million. The FSC monetary scale must be
operator-confirmed before use; the UI multiplies monetary fields by the
validated `monetaryScale` and displays source-native KRW.

## Application behavior

The server endpoint `/api/snapshot`:

1. Uses `SNAPSHOT_URL` when an authorized internal portfolio snapshot is
   configured.
2. Otherwise requests FreeSIS first.
3. Requests the FSC API only when FreeSIS fails.
4. Marks fallback snapshots with `isFallback: true` and includes the primary
   failure reason, official reference URL, provider, priority, observation date,
   and retrieval timestamp.
5. Returns `Cache-Control: no-store`.
6. Returns an explicit error when no validated official source is available.

The browser refresh action requests `/api/snapshot` again and does not reuse the
previous response. Public market-funds snapshots are validated in
[`src/live.js`](../src/live.js) and rendered in [`src/main.js`](../src/main.js).

## Private internal data

FreeSIS and the FSC dataset do not publish the application's portfolio-specific
records. Configure an authorized internal endpoint:

```bash
SNAPSHOT_URL=https://internal.example/snapshot
```

The endpoint must return JSON containing:

- `asOf`
- `snapshotTime`
- `cashflows`
- `checklist`
- `drivers`
- `metricDictionary`
- `metrics`
- `positions`
- `lendingRows`
- `exceptions`
- `auditEvents`

The `metrics` array must contain finite numeric `value` entries for:
`book-value`, `pnl`, `settlement`, `settlement-fail`, `lending`, and `critical`.
The internal endpoint is proxied server-side; credentials must not be placed in
browser code. `SNAPSHOT_URL` is an explicit authorized override, not a public
fallback.

## Configuration and deployment

Non-secret provider metadata is versioned in
[`src/source-registry.js`](../src/source-registry.js). Do not add API keys to a
repository `config.yaml`. For production, systemd loads variables from an
operator-managed `/etc/bondb/bondb.env` referenced by
[`deploy/bondb.service`](../deploy/bondb.service). The file should be
root-owned with mode `0600`.

## Limitations

- FreeSIS is an observed site implementation rather than a documented public
  API contract; re-verify the XHR if its UI or service ID changes.
- FSC monetary scale requires authenticated overlap validation before activation.
- ECOS is not a complete daily fallback: its related table is lower frequency
  and lacks the two forced-sale fields. It must not be mixed into a daily
  six-field row.
- Raw provider responses are transformed per request; persistent archival is not
  currently implemented.
