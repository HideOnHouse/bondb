# External Intelligence Dashboard 구현 TODO

이 문서는 [설계 문서](./design-document.md) v1.0을 구현하기 위한 작업 목록이다.
애플리케이션은 공개 또는 정식 계약한 외부 데이터만 사용한다.

## 절대 제약

- [ ] 사내 시스템, 내부 API, 내부 DB 및 내부망에 연결하지 않는다. `[FR-020]`
- [ ] 사내 파일·CSV와 보유종목·거래·전표·결제상태·상대방 데이터를 입력받지
      않는다. `[FR-020]`
- [ ] 공개 데이터 또는 정식 계약 데이터 외의 값을 수집하지 않는다.
- [ ] 누락값을 추정하거나 마지막 값을 최신 관측값으로 복제하지 않는다.
- [ ] API key를 브라우저, 응답, 로그, 오류, Export에 포함하지 않는다.
- [ ] 모든 표시값에 source, as-of, unit, retrieved-at을 제공한다.

## Phase 0 — Source 승인

### 업무지표 확정

- [ ] 결산 담당자가 매일 확인하는 외부지표 상위 20개를 확정한다.
- [ ] Settlement 참고용 시장·통화별 휴장일과 결제 영업일 범위를 확정한다.
- [ ] 이자·상환·조기상환·공시 이벤트의 필요한 범위를 확정한다.
- [ ] 채권대여 담당자가 필요한 대차·공매도 지표를 확정한다.
- [ ] 무료 공개 데이터와 유료 계약 데이터의 출시 범위를 분리한다.
- [ ] 각 화면에 외부 참고정보 disclaimer를 승인받는다.

### Source 검증

- [ ] FreeSIS의 대상 통계, object ID, 단위, 발표주기, 이용조건을 등록한다.
- [ ] 공공데이터포털 fallback의 통계 원천과 금액 단위를 검증한다.
- [ ] 한국은행 ECOS의 기준금리·금리·환율 통계 코드를 확정한다.
- [ ] OpenDART의 발행사 공시 검색 범위와 호출 제한을 확인한다.
- [ ] KRX의 휴장일·채권·공매도 데이터 제공 범위와 이용조건을 확인한다.
- [ ] KSD의 종목정보·상환·이자·대차 데이터 제공 범위와 이용조건을 확인한다.
- [ ] 평가가격·spread·fee benchmark의 유료 공급자 계약 필요성을 결정한다.
- [ ] 각 Source의 저장, 캐시, 화면 표시, Export, 재배포 허용범위를 기록한다.

### Key 발급과 운영

- [ ] `DATA_GO_KR_SERVICE_KEY`의 운영용 인증키를 발급한다.
- [ ] ECOS API key를 발급한다.
- [ ] OpenDART API key를 발급한다.
- [ ] 필요한 경우 KRX/KSD 또는 계약 공급자 credential을 발급한다.
- [ ] key를 서버 환경변수 또는 Secret Manager로만 주입한다.
- [ ] credential 만료·교체·폐기 절차를 정한다.
- [ ] Source별 read-only 최소권한을 확인한다.

## Phase 1 — Public Data Foundation

### Source Registry

- [ ] Source ID, provider, dataset, official reference URL을 등록한다.
- [ ] Observation Date, Published Time, Retrieved-at 및 timezone을 등록한다.
- [ ] 원천 단위, monetary scale, 정밀도, 개정정책을 등록한다.
- [ ] 갱신주기, 예상 발표시각, 지연·stale SLA를 등록한다.
- [ ] 라이선스와 cache/export 허용범위를 등록한다.
- [ ] primary와 fallback의 통계적 동등성을 명시한다.

### Adapter 및 정규화

- [ ] Source별 timeout, response size, content type, schema 검증을 구현한다.
- [ ] 날짜, 숫자, 단위, 비율, bp, 환율 통화쌍을 명시적으로 정규화한다.
- [ ] 원천 응답의 누락·비정상·중복 관측값을 거부한다.
- [ ] 비슷하지만 정의가 다른 지표를 별도 Metric ID로 유지한다.
- [ ] 공휴일·미발표일에 이전 관측값을 새 관측값으로 복제하지 않는다.
- [ ] Source 개정값과 최초 공표값의 보존 정책을 구현한다.
- [ ] 원천 fixture와 정규화 결과의 contract test를 작성한다. `[AC-02]`

### Cache 및 최신성

- [ ] Source 이용조건에 맞는 cache TTL을 구현한다.
- [ ] Fresh/Delayed/Stale/Partial/Failed/Unlicensed 상태를 계산한다.
- [ ] 일부 Source 실패를 전체 Fresh 상태로 표시하지 않는다.
- [ ] fallback 사용 시 실제 provider와 primary 실패 사유를 보존한다.
- [ ] source latency, error, data lag, cache age를 수집한다.

### 공통 API

- [ ] `GET /api/dashboard`를 구현한다.
- [ ] `GET /api/rates`를 구현한다.
- [ ] `GET /api/bond-market`을 구현한다.
- [ ] `GET /api/metrics/{id}/explain`을 구현한다.
- [ ] `GET /api/sources/status`를 구현한다.
- [ ] 응답에 source, asOf, publishedAt, retrievedAt, unit, status,
      referenceUrl을 포함한다.
- [ ] cursor pagination과 안정적인 정렬을 구현한다.
- [ ] correlation ID, 구조화 오류, timeout 및 rate limit을 구현한다.

### 공통 UI

- [ ] As-of, Compare, Market, Currency, Source Context Bar를 구현한다.
- [ ] Portfolio, Account, Owner, Counterparty 필드를 제공하지 않는다.
- [ ] 모든 Metric에 출처·기준일·단위·갱신시각을 표시한다. `[FR-014]`
- [ ] 지표 Explain에서 공식 원천 페이지 또는 방법론 문서로 이동한다. `[FR-015]`
- [ ] Fresh/Delayed/Stale/Partial/Failed/Unlicensed 상태를 표시한다.
      `[FR-016]`
- [ ] Loading, empty, partial, error 상태를 구분한다.
- [ ] 필터를 URL state에 반영한다.
- [ ] 키보드 탐색, focus, 색상 외 상태표현을 구현한다.

### Dashboard

- [ ] 기준금리, 주요 채권금리, 환율, 시장자금, 거래지표 KPI를 표시한다.
      `[FR-001]`
- [ ] 전일·전주·전월말 절대차와 증감률을 표시한다. `[FR-002]`
- [ ] 주요 변화와 예정 외부 이벤트를 표시한다. `[FR-003]`
- [ ] 기준일에 관측값이 없으면 명시적 미발표 상태를 표시한다.
- [ ] Dashboard P95 3초 이내 성능 baseline을 측정한다. `[AC-10]`

### Rates Explorer

- [ ] 지표, 만기, 등급, 기간을 선택하는 query UI를 구현한다. `[FR-004]`
- [ ] 금리 시계열과 수익률곡선을 구현한다.
- [ ] 동일 기준일의 호환 가능한 만기에서만 spread를 계산한다. `[FR-005]`
- [ ] 차트와 표가 같은 source와 as-of를 사용하게 한다.
- [ ] 지표에서 Explain과 공식 원문으로 이동한다.

## Phase 2 — Calendar, Events, Search

### Settlement Calendar

- [ ] `GET /api/calendar`를 구현한다.
- [ ] 국내외 시장·통화별 휴장일과 결제 영업일을 표시한다. `[FR-007]`
- [ ] 시장 timezone과 KST 표시를 구분한다.
- [ ] 공개 일정의 coverage와 한계를 표시한다.
- [ ] 결제 완료 여부나 내부 예상 결제 건은 표시하지 않는다.

### Security Events 및 Disclosures

- [ ] `GET /api/security-events`를 구현한다.
- [ ] 공개 이자·상환·조기상환·Corporate Action을 표시한다. `[FR-008]`
- [ ] OpenDART 공시와 발행사 이벤트를 연결한다. `[FR-009]`
- [ ] 신용등급·등급전망 데이터는 이용권한 확인 후 표시한다.
- [ ] 이벤트별 공식 원문 링크와 공표시각을 제공한다.

### Search

- [ ] `GET /api/search`를 구현한다.
- [ ] 종목명, ISIN, 발행사, 외부 공시를 검색한다. `[FR-013]`
- [ ] 내부 거래 ID와 전표 ID 검색을 제공하지 않는다.
- [ ] 검색 결과에 source와 데이터 coverage를 표시한다.

### Bond Market

- [ ] 발행·상환·잔액·거래량을 기간별로 조회한다. `[FR-006]`
- [ ] 채권유형과 source별 정의 차이를 표시한다.
- [ ] 원천 통계와 합계가 일치하는지 검증한다.

## Phase 3 — Lending Market

- [ ] `GET /api/lending-market`을 구현한다.
- [ ] 공개 대차 체결·상환·잔고 추이를 표시한다. `[FR-010]`
- [ ] 공매도 거래량·잔고를 대차지표와 함께 비교한다. `[FR-011]`
- [ ] 수량·금액·비율 단위를 혼합하지 않는다.
- [ ] 종목별 fee는 정식 이용권한과 정의가 있을 때만 표시한다. `[FR-012]`
- [ ] 내부 대여 가능 잔고, 계약, 담보, 상대방 exposure를 표시하지 않는다.
- [ ] 대차·공매도 수치가 투자 추천이 아니라는 설명을 제공한다.

## Phase 4 — Export 및 계약 데이터

- [ ] 현재 표를 CSV로 Export한다. `[FR-017]`
- [ ] 차트를 이미지로 Export한다. `[FR-017]`
- [ ] Export에 source, as-of, unit, retrieved-at, 생성시각을 포함한다.
- [ ] 공급자별 Export 허용범위를 서버에서 강제한다. `[AC-08]`
- [ ] 외부 이벤트와 지표 임계치의 브라우저 알림 범위를 결정한다. `[FR-018]`
- [ ] Source 상태·라이선스·갱신주기 조회 화면을 구현한다. `[FR-019]`
- [ ] 평가가격, spread, fee benchmark는 계약 확인 후 feature flag로 활성화한다.
- [ ] 계약 만료 시 데이터를 `Unlicensed`로 전환하고 신규 제공을 중단한다.

## 공통 검증 Gate

### External-only

- [ ] 내부 endpoint 설정이 존재하지 않는다. `[AC-01]`
- [ ] 내부 파일·CSV 업로드 UI와 API가 존재하지 않는다. `[AC-01]`
- [ ] 포트폴리오·보유·거래·전표·상대방 입력 필드가 존재하지 않는다.
- [ ] 로그와 telemetry에 내부 업무정보를 수집하는 필드가 없다.

### 출처와 정합성

- [ ] 표시 Metric 100%에 source·as-of·unit·retrieved-at이 있다. `[AC-04]`
- [ ] 원천 fixture와 변환 결과가 정의된 단위로 일치한다. `[AC-02]`
- [ ] Compare 변경 시 연결된 화면이 동일한 기준으로 갱신된다. `[AC-03]`
- [ ] Source 장애 시 0이나 가상값을 표시하지 않는다. `[AC-06]`
- [ ] freshness 상태 경계가 Source SLA와 일치한다. `[AC-05]`

### Secret과 라이선스

- [ ] API key가 브라우저 bundle과 네트워크 응답에 없다. `[AC-07]`
- [ ] API key가 로그, 오류, URL, Export에 없다. `[AC-07]`
- [ ] 저장·캐시·표시·Export가 Source 이용조건과 일치한다. `[AC-08]`
- [ ] 미계약 데이터가 유사한 공개값으로 대체되지 않는다.

### 품질

- [ ] 단위·날짜·Metric mapping unit test를 통과한다.
- [ ] Source adapter contract test를 통과한다.
- [ ] 부분 실패와 fallback integration test를 통과한다.
- [ ] 주요 Use Case E2E test를 통과한다.
- [ ] Chromium 최신 2개 버전에서 회귀 테스트를 수행한다.
- [ ] 키보드 전용 탐색과 focus order를 검증한다. `[AC-09]`
- [ ] Dashboard P95 3초를 검증한다. `[AC-10]`

## 요구사항 추적 체크리스트

| 요구사항 | 범위 | 상태 |
|---|---|---|
| FR-001~003 | External Dashboard | [ ] |
| FR-004~005 | Rates & Spread Explorer | [ ] |
| FR-006 | Bond Market | [ ] |
| FR-007 | Settlement Calendar | [ ] |
| FR-008~009 | Security Events/Disclosures | [ ] |
| FR-010~012 | Lending Market | [ ] |
| FR-013 | External Search | [ ] |
| FR-014~016 | Explain/Data Status | [ ] |
| FR-017~019 | Export/Alert/Source Admin | [ ] |
| FR-020 | External-only Privacy Guard | [ ] |
| NFR-001~015 | 공통 비기능 요구사항 | [ ] |

## 비기능 요구사항 추적 체크리스트

| 요구사항 | 검증 작업 | 상태 |
|---|---|---|
| NFR-001 | Dashboard P95 부하 테스트 | [ ] |
| NFR-002 | Source SLA와 freshness 시간 경계 테스트 | [ ] |
| NFR-003 | 원천 fixture와 정규화 결과 정합성 테스트 | [ ] |
| NFR-004 | Metric provenance 100% coverage test | [ ] |
| NFR-005 | 독립 Source 부분 실패 테스트 | [ ] |
| NFR-006 | 브라우저·응답·로그 Secret 노출 검사 | [ ] |
| NFR-007 | 내부 업무정보 입력·로그·telemetry 부재 검사 | [ ] |
| NFR-008 | Source별 저장·표시·Export 라이선스 승인 | [ ] |
| NFR-009 | WCAG 2.1 AA 접근성 점검 | [ ] |
| NFR-010 | Chromium 최신 2개 버전 회귀 테스트 | [ ] |
| NFR-011 | source latency·error·lag·cache age 관측성 검증 | [ ] |
| NFR-012 | Source adapter 확장성 contract test | [ ] |
| NFR-013 | cache TTL과 계약 만료 데이터 삭제 테스트 | [ ] |
| NFR-014 | URL allowlist·timeout·response size/schema 보안 테스트 | [ ] |
| NFR-015 | FR/NFR·Source·테스트 추적성 완전성 검사 | [ ] |
