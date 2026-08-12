# External Data Sources

이 문서는 외부 공개·계약 데이터의 등록, 인증, 정규화 및 fallback 정책을 정의한다.

## 1. Source 범위 정책

- 애플리케이션은 공개 데이터 또는 정식 계약한 외부 데이터만 사용한다.
- 사내 시스템, 내부 endpoint, 내부 DB 및 내부망에 연결하지 않는다.
- 내부 파일·CSV, 보유종목, 거래, 전표, 결제상태, 상대방, 담보 및 대차계약
  데이터를 입력·업로드·저장하지 않는다.
- 값의 원천, 단위 또는 이용조건이 확인되지 않으면 운영 화면에 표시하지 않는다.
- 누락값을 추정하거나 이전 관측값을 새 관측값으로 복제하지 않는다.

## 2. Source Registry 필수 항목

각 Source와 dataset은 다음 정보를 등록해야 한다.

| 항목 | 설명 |
|---|---|
| `sourceId` | 애플리케이션 내부의 안정적인 Source ID |
| `provider` | 데이터를 공표하거나 제공하는 기관 |
| `datasetName` | 공식 dataset 또는 통계 명칭 |
| `origin` | 통계의 원 공표기관 |
| `referenceUrl` | 사용자가 확인할 공식 페이지 |
| `requestUrl` | 서버가 호출하는 endpoint |
| `collectionMethod` | documented API, official REST, verified XHR 등 |
| `unit` | 원천 단위 |
| `monetaryScale` | 금액 변환 배율 |
| `timezone` | 발표·관측시각 기준 timezone |
| `refreshSchedule` | 예상 갱신주기와 발표시각 |
| `freshnessSla` | Delayed/Stale 판정 기준 |
| `license` | 저장·표시·Export·재배포 허용범위 |
| `priority` | 동일 통계 transport 간 우선순위 |

## 3. Source 후보

| Source | 데이터 | 인증/계약 | 상태 |
|---|---|---|---|
| 금융투자협회 FreeSIS | 시장자금 및 채권시장 통계 | 현재 확인된 조회는 key 없음 | 시장자금 사용 중 |
| 금융위원회 공공데이터포털 | KOFIA 통계의 공식 transport | 일반 인증키 | fallback 사용 가능 |
| 한국은행 ECOS | 기준금리, 금리, 환율, 거시지표 | API key | 도입 후보 |
| OpenDART | 발행사 공시 | API key | 도입 후보 |
| KRX Open API/Data Marketplace | 시장 일정, 채권·공매도 통계 | 인증 및 항목별 이용조건 | 검증 필요 |
| KSD SEIBro/데이터 서비스 | 종목, 이자·상환, 대차 관련 공개정보 | 공개 범위 또는 계약 | 검증 필요 |
| 외부 평가사 | 평가가격, 수익률, spread, fee | 유료 계약 | 선택 범위 |

Source 후보는 실제 공식 문서, 이용약관, 호출 제한 및 재배포 조건을 확인한 뒤
Registry에 추가한다. 표에 있다는 이유만으로 사용 가능하다고 간주하지 않는다.

## 4. 현재 구현된 시장자금 Source

### 4.1 우선순위

시세자금 지표는 다음 순서로 조회한다.

1. FreeSIS 원통계 transport, priority `0`
2. 금융위원회 공공데이터포털의 KOFIA 통계 transport, priority `1`

두 provider는 서로 독립적인 통계가 아니다. 공공데이터포털은 KOFIA 통계의 공식
transport fallback이며, 두 요청이 모두 실패하면 합성값이나 last-known 값을
사용하지 않는다.

### 4.2 Primary: FreeSIS

현재 확인된 데이터는 FreeSIS `증시자금추이`다.

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

요청 body는 다음과 같다.

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

`tmpV45`는 현재 Asia/Seoul 날짜의 3개월 전이며 `tmpV46`은 현재 날짜다.
응답은 날짜 정규화 후 내림차순으로 정렬한다.

> FreeSIS endpoint는 문서화된 공개 API contract가 아니라 확인된 사이트 XHR이다.
> 화면 또는 service ID가 변경되면 재검증해야 하며, 실패 시 값을 추정하지 않는다.

### 4.3 Official fallback: FSC Public Data Portal

fallback은 dataset `15094809`, 금융위원회_금융투자협회종합통계정보다.

- Dataset page: <https://www.data.go.kr/data/15094809/openapi.do>
- Provider: Financial Services Commission
- Statistical origin: KOFIA
- Source priority: `1`
- API:
  `GET https://apis.data.go.kr/1160100/service/GetKofiaStatisticsInfoService/getSecuritiesMarketTotalCapitalInfo`
- Collection method: official REST API

서버는 `serviceKey`, `numOfRows=1`, `pageNo=1`, `basDt=YYYYMMDD`,
`_type=json`을 전송한다. 현재 Asia/Seoul 날짜부터 이전 6일까지 관측값을 찾는다.

```bash
DATA_GO_KR_SERVICE_KEY='your-private-key'
DATA_GO_KR_MONETARY_SCALE='1000000'
```

API 문서는 금액 필드의 의미를 제공하지만 monetary scale을 명확히 제공하지 않는다.
따라서 `DATA_GO_KR_MONETARY_SCALE`은 동일 날짜의 FreeSIS 관측값과 비교해 확인한
후에만 설정한다. scale이 없거나 유효하지 않으면 fallback을 비활성화한다.

### 4.4 Canonical mapping

| 의미 | FreeSIS | FSC API | 애플리케이션 필드 | 단위 |
|---|---|---|---|---|
| 관측일 | `TMPV1` | `basDt` | `date` | `YYYY-MM-DD` |
| 투자자예탁금 | `TMPV2` | `invrDpsgAmt` | `investorDeposit` | provider monetary unit |
| 장내파생상품 거래 예수금 | `TMPV3` | `onbdDrvPrdTrRcAdvAmt` | `derivativesDeposit` | provider monetary unit |
| 대고객 RP 매도잔고 | `TMPV4` | `toCstRpchCndBndSlgBal` | `rpBalance` | provider monetary unit |
| 위탁매매 미수금 | `TMPV5` | `brkTrdUcolMny` | `receivables` | provider monetary unit |
| 실제 반대매매금액 | `TMPV6` | `brkTrdUcolMnyVsOppsTrdAmt` | `forcedSaleAmount` | provider monetary unit |
| 미수금 대비 반대매매비중 | `TMPV7` | `ucolMnyVsOppsTrdRlImpt` | `forcedSaleRatio` | `%` |

FreeSIS 금액값은 KRW million이다. FSC 값은 검증한 `monetaryScale`을 적용한다.

## 5. 추가 Source 도입 체크리스트

### 5.1 ECOS

- [ ] 필요한 통계표와 item code 확정
- [ ] 일·월·발표시점 등 주기 확인
- [ ] 금리·환율의 단위와 quote convention 확인
- [ ] API key 발급 및 호출 제한 확인
- [ ] 개정값 처리정책 확인

### 5.2 OpenDART

- [ ] 발행사 식별자와 종목·ISIN 연결방식 확인
- [ ] 필요한 보고서와 event 분류 확정
- [ ] API key 발급 및 호출 제한 확인
- [ ] 정정공시와 원문 링크 처리 확인

### 5.3 KRX/KSD

- [ ] 휴장일·결제 영업일 coverage 확인
- [ ] 채권 발행·상환·거래 통계 coverage 확인
- [ ] 대차·공매도 데이터의 수량·금액·비율 정의 확인
- [ ] 공개 API 또는 계약 endpoint 여부 확인
- [ ] 저장, cache, Export와 재배포 조건 확인

### 5.4 계약 데이터

- [ ] 평가가격, YTM, duration, spread의 산출기관과 방법론 확인
- [ ] 대차 fee의 단위, 기간, 표본과 익명화 수준 확인
- [ ] 사용 사용자 수와 화면 표시 범위 확인
- [ ] 원천 데이터 저장기간과 Export 허용범위 확인
- [ ] 계약 만료 시 신규 제공과 cache 삭제정책 확인

## 6. Key 및 Secret 관리

| Secret | 용도 | 브라우저 전달 |
|---|---|---|
| `DATA_GO_KR_SERVICE_KEY` | 공공데이터포털 | 금지 |
| ECOS API key | 한국은행 통계 | 금지 |
| OpenDART API key | 공시 | 금지 |
| KRX/KSD credential | 해당 외부 데이터 | 금지 |
| 계약 공급자 credential | 평가가격·fee 등 | 금지 |

- key는 서버 환경변수 또는 Secret Manager에 저장한다.
- repository의 JavaScript, JSON, YAML 및 문서 예시에 실제 key를 넣지 않는다.
- query string에 key가 필요한 provider라도 로그와 오류에서 제거한다.
- 브라우저에는 source ID, provider, reference URL만 전달한다.
- credential이 없거나 만료되면 Source 상태를 `Unlicensed` 또는 `Failed`로
  표시한다.

## 7. Freshness 및 오류

- Source마다 Observation Date, Published Time, Retrieved-at을 별도로 보관한다.
- source SLA 안이면 `Fresh`, 발표 지연 중이면 `Delayed`, 허용범위를 넘으면
  `Stale`로 표시한다.
- 일부 지표만 검증되면 `Partial`, 요청 또는 schema 검증 실패면 `Failed`다.
- 계약 또는 credential이 없으면 `Unlicensed`다.
- Source 실패를 0, 빈 성공 응답 또는 다른 의미의 지표로 대체하지 않는다.

## 8. 현재 구현과 목표 범위의 차이

현재 코드에 남아 있는 `SNAPSHOT_URL` 기반 내부 Snapshot 경로는 v1.0 목표 범위에
포함되지 않는다. 정책상 사용할 수 없으며 출시 전에 서버, 검증 contract, UI 및
배포 설정에서 제거해야 한다. 제거가 완료되기 전까지 해당 경로를 운영 환경에
설정하지 않는다.

## 9. 배포 설정

운영 Secret은 repository 밖의 운영자 관리 환경파일 또는 Secret Manager에서
주입한다. systemd를 사용할 경우 `/etc/bondb/bondb.env`는 root 소유, mode `0600`
으로 관리한다.

비밀값이 아닌 provider metadata만
[`src/source-registry.js`](../src/source-registry.js)에 versioning한다.
