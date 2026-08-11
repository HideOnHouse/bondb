# Data Sources

## Source priority policy

This is the intended source-resolution policy when multiple providers for the
same indicator are wired:

1. FreeSIS original data
2. Official public APIs connected to FreeSIS
3. Official source institutions such as SEIBro, KOFIA Bond, KRX, ECOS, and DART
4. Official overseas APIs
5. Unofficial sources such as FinanceDataReader or yfinance

FreeSIS is the source of truth for the indicators it publishes. The current
runtime has one verified public collector, FreeSIS, plus an explicit
`SNAPSHOT_URL` operator override; it does not yet compare provider priorities
automatically. When additional providers are added, the resolver must compare
their registered priorities before selecting a value.

## Verified live source

The default live source is FreeSIS **증시자금추이** (market funds trend).

- Registry page:
  <https://freesis.kofia.or.kr/stat/FreeSIS.do?parentDivId=MSIS10000000000000&serviceId=STATSCU0100000060>
- Parent division: `MSIS10000000000000`
- Service ID: `STATSCU0100000060`
- Source priority: `0`
- Collection method: verified browser `XHR`
- Data request:
  `POST https://freesis.kofia.or.kr/meta/getMetaDataList.do`
- Registry implementation: [`src/source-registry.js`](../src/source-registry.js)
- Collector implementation: [`server.mjs`](../server.mjs)

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

`tmpV45` is the start date three months before the current Asia/Seoul date.
`tmpV46` is the current Asia/Seoul date.

## Response mapping

FreeSIS returns rows in `ds1`. Values `TMPV2` through `TMPV6` are in million
KRW. `TMPV7` is a percentage.

| FreeSIS field | Application field | Meaning | Unit |
| --- | --- | --- | --- |
| `TMPV1` | `date` | Observation date | `YYYY-MM-DD` |
| `TMPV2` | `investorDeposit` | Investor deposits, excluding exchange-traded derivatives deposits | KRW million |
| `TMPV3` | `derivativesDeposit` | Exchange-traded derivatives deposits | KRW million |
| `TMPV4` | `rpBalance` | Customer RP sell balance | KRW million |
| `TMPV5` | `receivables` | Brokerage receivables | KRW million |
| `TMPV6` | `forcedSaleAmount` | Actual forced-sale amount | KRW million |
| `TMPV7` | `forcedSaleRatio` | Forced-sale amount / receivables | `%` |

The first returned row is treated as the latest observation. The API response
also includes `retrievedAt`, `isFallback: false`, the source registry IDs, and
the request URL.

## Application behavior

The server endpoint `/api/snapshot`:

1. Uses `SNAPSHOT_URL` when an internal portfolio snapshot is configured.
2. Otherwise fetches the verified FreeSIS market-funds XHR.
3. Returns `Cache-Control: no-store`.
4. Returns an explicit error when the source is unavailable or returns invalid
   data.

The browser refresh action requests `/api/snapshot` again. It does not reuse the
previous response.

The live response is validated in [`src/live.js`](../src/live.js) and rendered
in [`src/main.js`](../src/main.js). The default UI therefore shows actual
FreeSIS market-funds values rather than bundled demo numbers.

## Internal portfolio data

FreeSIS does not publish this application's portfolio-specific book value, P&L,
settlement workflow, holdings, or exception queue. Those values must come from
an authorized internal source.

Configure an internal snapshot endpoint with:

```bash
SNAPSHOT_URL=https://internal.example/snapshot npm run dev
```

The endpoint must return JSON containing:

- `Content-Type: application/json`

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

The `metrics` array must contain finite numeric `value` entries for all six
required IDs:

- `book-value`
- `pnl`
- `settlement`
- `settlement-fail`
- `lending`
- `critical`

The internal endpoint is proxied server-side; credentials should not be placed
in browser code. Setting `SNAPSHOT_URL` is an explicit operator override of the
default FreeSIS source, not an automatic source-priority decision.

## Demo mode

Bundled synthetic values are available only for local UI testing:

<http://localhost:4173/?demo=true>

Demo mode is labeled **Demo** and must not be treated as live or official data.
The bundled values are defined in [`src/data.js`](../src/data.js).

## Source limitations and next steps

- The FreeSIS XHR is an observed site implementation, not a documented public
  API contract. The request registry should be re-verified if the FreeSIS UI or
  service ID changes.
- Only `증시자금추이` is currently verified and wired. Other FreeSIS,
  KOFIA Bond, SEIBro, KRX, ECOS, and DART routes remain source candidates until
  their request shape is captured and tested.
- Raw FreeSIS response archival is not yet persistent. The current server
  transforms each response for the live request and exposes retrieval metadata.
