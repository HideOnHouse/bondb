# Investment Operations Intelligence Workbench 구현 TODO

이 문서는 [Investment Operations Intelligence Workbench 설계 문서](./design-document.md)
v0.9를 실제 제품으로 구현하기 위한 작업 목록이다. 설계 문서의 요구사항 ID를
유지하여 구현, 테스트, 사용자 승인(UAT)을 추적한다.

## 구현 원칙

- [ ] `Must` 요구사항은 MVP 출시 조건으로 취급하고 placeholder로 대체하지 않는다.
- [ ] `Should` 요구사항은 MVP 안정화 후 1차 고도화 범위로 구현한다.
- [ ] `Could` 요구사항과 설계 문서에 요구사항 ID가 없는 ML 이상 탐지/자연어 탐색은
      별도 승인 전까지 Backlog로 유지한다.
- [ ] 모든 주요 수치는 Metric ID, 정의, 산식, 단위, Source, As-of, 갱신 시각을
      함께 제공한다.
- [ ] 조회/분석/시나리오 기능은 원천 원장 데이터를 변경하지 않는다.
- [ ] 기능 완료 시 연결된 FR, NFR, AC의 자동 테스트와 UAT 증적을 함께 남긴다.

## Phase 0 — 착수 조건 및 상세 설계

### 업무 범위 확정

- [ ] 내부 Source 목록, 인터페이스 방식, 데이터 Owner, 갱신 주기, SLA를 확정한다.
- [ ] OMS/PMS, 회계, 수탁/결제, Security Master의 식별자 매핑 규칙을 정의한다.
- [ ] 시장금리, 환율, 평가가격, Credit Spread, 대차 Fee 데이터 공급원을 확정한다.
- [ ] 공식 일일/월말 Snapshot과 잠정 Intraday 데이터의 사용 기준을 승인받는다.
- [ ] 대표 Metric의 회계/운용/수탁 정의 충돌을 정리하고 Metric Owner를 지정한다.
- [ ] 실제 운영에서 발생하는 대표 대사 예외 시나리오 20개 이상을 수집한다.
- [ ] 상품별 금액, 수량, 날짜, 이자, 담보 tolerance와 severity 정책을 승인받는다.
- [ ] Official/Indicative/Scenario 수치의 표시 및 사용 정책을 확정한다.
- [ ] 거래/상대방/포트폴리오별 민감정보 분류와 마스킹 정책을 확정한다.
- [ ] 월말 체크리스트, 승인 절차, Waived 처리 권한과 증적 요건을 확정한다.

### 기술 의사결정

- [ ] Frontend, API/BFF, 배치/스트리밍, Data Mart, 캐시, 관측성 기술 스택을
      ADR로 결정한다.
- [ ] 수천만 건 Snapshot 조회를 위한 columnar store, 파티셔닝, 사전집계 전략을
      성능 PoC로 검증한다.
- [ ] 자유로운 group-by를 제한할 query guardrail과 semantic cache 정책을 정한다.
- [ ] SSO 연동 방식과 Role + Data Scope 권한 평가 모델을 확정한다.
- [ ] Audit log의 위변조 방지, 보존 기간, 검색, 백업 정책을 확정한다.
- [ ] 주요 메타데이터와 사용자 설정의 RPO 1시간/RTO 4시간 달성 방안을 검증한다.
- [ ] 사내 표준 Chromium 최신 2개 버전과 1440px 기준 지원 범위를 확정한다.
- [ ] 화면 와이어프레임으로 주요 Persona 대상 사용성 테스트를 수행한다.

## Phase 1 — Foundation

### 저장소와 개발 기반

- [ ] Frontend, API/BFF, domain service, ingestion, database migration의 프로젝트
      구조를 생성한다.
- [ ] 개발/테스트/운영 환경별 설정과 Secret 주입 방식을 구성한다.
- [ ] Formatter, lint, type-check, unit/integration/E2E test 명령을 구성한다.
- [ ] CI에 build, test, migration 검증, 취약점 검사를 연결한다.
- [ ] 개발용 비식별 seed data와 재현 가능한 로컬 실행 환경을 제공한다.
- [ ] API 버전, 오류 응답, pagination, date/time, currency, decimal 규약을 정한다.

### 인증, 권한, 감사 기반

- [ ] SSO 인증과 사용자/조직 동기화를 구현한다. `[NFR-006]`
- [ ] Viewer, Operator, Manager, Admin 역할을 구현한다.
- [ ] Portfolio/Asset/Org 데이터 범위를 역할과 함께 평가한다. `[NFR-006]`
- [ ] 조회와 변경 권한을 분리하고 UI와 API 양쪽에서 동일하게 강제한다.
- [ ] 권한에 따라 거래/상대방 데이터를 마스킹하고 로그 노출도 최소화한다.
      `[NFR-008]`
- [ ] 상태/설정 변경과 Export의 사용자, 시각, 전후값, 사유, Audit ID를 기록하는
      append-only 감사 기반을 구현한다. `[FR-030] [NFR-007]`
- [ ] 권한 거부와 감사 이벤트를 보안 모니터링에 연결한다.

### 데이터 수집과 Snapshot

- [ ] Position, Transaction, Accounting, Settlement, Lending, Market, Metadata의
      canonical schema를 정의한다.
- [ ] Source별 Effective Time, Load Time, Business Date를 별도 저장한다.
- [ ] 공식 일일/월말 Snapshot과 Intraday 상태를 구분하여 저장한다.
- [ ] 재처리/backfill 시 Snapshot 버전, 변경 범위, 실행자를 기록한다.
- [ ] Source identifier를 canonical security/trade/counterparty ID로 정규화한다.
- [ ] 금액은 원통화와 기준통화 환산값, 적용 환율, 환율 기준시각을 함께 보관한다.
- [ ] 중복, 누락, 참조 무결성, 기준일 불일치, 비정상 값 검증을 ingestion에 넣는다.
- [ ] Source SLA에 따라 Fresh/Delayed/Partial/Failed 상태를 계산한다.
- [ ] 부분 실패를 성공으로 표시하지 않고 재처리 가능한 실패 내역을 노출한다.
- [ ] 비식별 fixture로 정상, 지연, 누락, 중복, backfill 경로를 통합 테스트한다.

### Data Mart와 Semantic Layer

- [ ] 기준일, 포트폴리오, 자산군, 등급, 만기, 발행사, 종목, 거래 차원을 모델링한다.
- [ ] Position/Transaction/Cashflow/Lending/Market 시계열 fact를 구현한다.
- [ ] 일별/월말/Intraday 파티셔닝과 핵심 화면용 사전집계를 구현한다.
- [ ] 동일 Metric 정의와 동일 환산 기준으로 현재/전일/전월말/전년말 비교를 계산한다.
- [ ] Metric + Dimensions + Filters + Compare 요청을 처리하는 semantic query
      contract를 구현한다.
- [ ] Metric별 허용 차원, aggregation, 단위, 정밀도, 데이터 범위를 검증한다.
- [ ] 상위 KPI와 하위 차원 합계가 rounding tolerance 내에서 보존되게 한다.
      `[AC-02]`
- [ ] 장부가, 평가손익, Expected Settlement, Settlement Fail,
      Lending Utilization, Expected Lending Revenue, Collateral Coverage를
      첫 Metric Dictionary로 등록한다.
- [ ] Lending Utilization과 Collateral Coverage의 0 분모는 `NULL`/N/A로 처리하고
      대여 Fee 단위, Day-count, FX/As-of, post-haircut 기준을 Metric 버전에 고정한다.
- [ ] Admin이 Metric 정의, 대사 규칙, threshold, Source를 관리하는 설정 모델과
      승인/버전 이력을 구현한다. `[FR-029]`

### API/BFF 공통 기반

- [ ] `POST /analytics/query`에 asOf, portfolio, currency, metric, 허용된
      dimensions/aggregation, filters, compare 검증과 권한 필터를 구현한다.
- [ ] `GET /positions/{securityId}`에 기준일별 position과 transaction history를
      구현한다.
- [ ] 종목명, ISIN, 거래 ID, 전표 ID, 상대방 통합검색과 권한 필터를 구현한다.
      `[FR-025]`
- [ ] 대용량 grid용 cursor pagination, 안정적인 sort, 제한된 group-by를 구현한다.
- [ ] 요청 correlation ID, 구조화 오류, timeout/cancel, rate/query limit을 구현한다.
- [ ] API latency, query error, data lag를 수집하고 운영 알림에 연결한다.
      `[NFR-013]`

### Web Workbench 공통 기반

- [ ] 1440px 우선 반응형 App Shell과 주요 화면 routing을 구현한다.
- [ ] 모든 화면에서 As-of Date, Portfolio, Currency, Compare를 유지하는 Context
      Bar를 구현한다.
- [ ] 필터/정렬/선택 상태를 URL 또는 직렬화 가능한 view state에 반영한다.
- [ ] Cross-filter, drill-down breadcrumb, Undo, Reset 인터랙션 기반을 구현한다.
- [ ] 원/천원/백만원/억원/조원 자동축약과 원 단위 상세 표시를 구현한다.
- [ ] 증가/감소 색상은 Metric 의미에 따라 적용하고 아이콘/텍스트 상태를 병행한다.
- [ ] 공통 grid에 Search, Sort, Group, Pin, Column selector를 구현한다.
- [ ] Fresh/Delayed/Partial/Failed를 화면 상단과 Metric 수준에 표시한다.
      `[FR-031]`
- [ ] Loading, empty, partial, forbidden, error 상태를 명시적으로 구현한다.
- [ ] 키보드 탐색, focus, 스크린리더 label, 색상 외 상태 표현, 대비를 WCAG 2.1
      AA 기준으로 점검한다. `[NFR-011]`

### Phase 1 완료 조건

- [ ] 동일 기준일/필터에서 Metric 결과가 재현되고 원천 합계와 대사된다.
      `[NFR-005]`
- [ ] Must Metric 100%에 정의, 산식, Source, As-of 메타데이터가 등록된다.
      `[NFR-009]`
- [ ] 권한별 허용/거부/마스킹 통합 테스트를 통과한다.
- [ ] Backfill과 데이터 지연이 Snapshot 또는 최신성 상태를 훼손하지 않는다.
- [ ] 대표 데이터 규모의 semantic query 부하 하네스와 성능 baseline을 확정한다.
      `[NFR-002]`

## Phase 2 — Core Analytics

### Morning Cockpit

- [ ] 기준일 장부가, 손익, 금일 결제, 미결제, 대여잔고, 예외 KPI strip을
      구현한다. `[FR-001]`
- [ ] `GET /cockpit`에 KPI, 데이터 상태, 예외 Summary, 향후 현금흐름을 구현한다.
- [ ] 전일/전월말/전년말 대비 절대차와 증감률을 구현한다. `[FR-002]`
- [ ] 중요 변화 Driver를 차원/종목 contribution으로 계산하고 표시한다.
      `[FR-002]`
- [ ] severity, 금액 영향, 마감기한 기반 Action Queue 정렬을 구현한다.
      `[FR-003]`
- [ ] KPI/Driver/Exception 선택이 연결 뷰와 상세 grid를 Cross-filter하게 한다.
- [ ] KPI에서 원천 거래까지 3~4단계 이내로 도달하는 drill-through를 구현한다.
      `[G-01]`

### Portfolio Explorer

- [ ] 사용자가 Metric, X/Y축, Color, Size, Group By를 선택하는 query builder를
      구현한다. `[FR-004]`
- [ ] 등급 x 잔존만기 Heatmap과 셀 선택 Cross-filter를 구현한다. `[FR-005]`
- [ ] 현재와 전일/전월말/전년말/Benchmark 비교 선택을 구현한다. `[FR-006]`
- [ ] 절대차와 증감률을 차트와 grid에 병렬 표시한다. `[FR-006]`
- [ ] 자산군 → 등급/만기 → 발행사 → 종목 → 거래/전표 drill-down을 구현한다.
- [ ] Position 상세에서 관련 거래와 전표로 이동하는 링크를 구현한다.
- [ ] 모든 연결 뷰가 동일한 context와 filter state를 사용하게 한다.

### Explain / Lineage

- [ ] Metric, KPI, 셀, 거래에서 공통 Explain Drawer를 열 수 있게 한다.
- [ ] `GET /metrics/{metricId}/explain`에 정의, 산식, 단위, Source, As-of,
      갱신 시각을 구현한다. `[FR-023]`
- [ ] 계산 노드에서 집계/원천 field까지 이어지는 lineage를 구현한다.
- [ ] 운용/회계/수탁 시스템별 값과 차이를 동일 화면에 표시한다. `[FR-024]`
- [ ] 사용 중인 Metric 정의와 Snapshot 버전을 Explain 결과에 고정한다.
- [ ] 권한 없는 Source 상세는 숨기되 차이/메타데이터 제공 정책을 일관되게 적용한다.

### Phase 2 완료 조건

- [ ] Cockpit KPI가 공식 원장 합계와 정의된 tolerance 내에서 일치한다. `[AC-01]`
- [ ] 상위 KPI와 drill-down 하위 합계가 rounding tolerance 내에서 일치한다.
      `[AC-02]`
- [ ] Compare 변경 시 모든 연결 뷰가 동일 context로 갱신된다. `[AC-03]`
- [ ] 모든 Must Metric의 Explain 필수 항목이 누락 없이 표시된다. `[AC-06]`
- [ ] 핵심 KPI에서 예외 원인 또는 원천 거래까지 평균 4 interaction 이내다.
      `[NFR-010]`
- [ ] 대표 데이터 규모로 Cockpit P95 3초, 일반 drill-down P95 2초를 달성한다.
      `[NFR-001] [NFR-002] [AC-08]`

## Phase 3 — Operations MVP

### Reconciliation Engine

- [ ] Source별 거래/금액/상태를 canonical key로 매칭하는 대사 엔진을 구현한다.
      `[FR-010]`
- [ ] Trade amount, Settlement date, Position nominal, Book value,
      Accrued interest, Collateral 규칙을 metadata-driven 방식으로 구현한다.
- [ ] 상품/통화/규칙별 tolerance와 severity 설정을 적용한다.
- [ ] 미결제, 금액/결제일/종목/수량 불일치를 자동 탐지한다. `[FR-011]`
- [ ] 대사 실행 버전, 입력 Snapshot, 규칙 버전, 결과를 재현 가능하게 저장한다.
- [ ] reconciliation failure와 처리 지연을 운영 모니터링에 연결한다.

### Settlement & Reconciliation

- [ ] 당일/향후 결제 예정 건을 현금, 증권, 통화, 상대방별로 조회한다.
      `[FR-009]`
- [ ] 예상/실제 결제금액, cash/security movement, 결제 상태를 표시한다.
- [ ] 시스템별 거래조건, 장부/전표, 수탁/결제 값을 나란히 비교한다.
- [ ] 예외에 원인 유형, 담당자, 상태, 메모, 처리기한을 관리한다. `[FR-012]`
- [ ] New/Investigating/Waiting/Resolved/Waived 상태 전이를 권한별로 검증한다.
- [ ] Waived 변경은 사유와 승인자를 필수로 하고 Audit ID를 반환한다.
- [ ] 예상/실제 차이에서 거래 단위까지 drill-through한다. `[FR-013]`
- [ ] `GET /exceptions`와 원인 유형, 담당자, 상태, 메모, 처리기한, Waived
      사유/승인자를 변경하는 `PATCH /exceptions/{id}`를 구현한다.
- [ ] `version`/`If-Match` 기반 충돌 탐지와 412 응답으로 최신 상태를 덮어쓰지
      않게 한다.

### Closing

- [ ] 전월말 장부가에서 매수/매도/상환/상각/FX/평가를 거쳐 당월말 장부가로
      연결되는 Bridge를 구현한다. `[FR-014]`
- [ ] Bridge 항목에서 종목/거래/전표 contribution으로 drill-down한다.
- [ ] 미수이자, 이자수익, 평가손익, 처분손익의 시스템 간 대사를 구현한다.
      `[FR-015]`
- [ ] 반올림, Day-count, 환율, Snapshot 차이가 설명 결과에 포함되게 한다.

### Securities Lending의 Must 범위

- [ ] 보유, 대여 중, 대여 가능 잔고와 평균/종목별 Fee 조회를 구현한다.
      `[FR-017]`
- [ ] `GET /lending/opportunities`에 inventory, utilization, fee, ranking을
      구현한다.
- [ ] 담보가치, 요구담보액, 담보비율, haircut, 부족액을 계산한다. `[FR-019]`
- [ ] 상대방별 exposure와 concentration을 조회한다. `[FR-019]`
- [ ] 담보 부족을 Critical 예외로 생성하고 Action Queue에 연결한다.
- [ ] Lending Metric에서 inventory, 계약, 담보 원천까지 drill-through한다.

### Audit 및 운영 관리

- [ ] 예외 상태/담당자/메모/기한의 모든 변경에 전후값과 Audit ID를 기록한다.
- [ ] Metric, 대사 규칙, threshold, Source 변경에 승인자와 버전을 기록한다.
- [ ] Admin 화면에서 설정 이력과 적용 시점을 조회한다.
- [ ] 감사로그 검색과 보존/백업/복구 절차를 운영 문서화한다.

### Phase 3 완료 조건

- [ ] 예외 fixture가 규칙에 따라 탐지되고 severity가 기대값과 일치한다. `[AC-04]`
- [ ] 예외 변경 후 사용자, 시각, 전후값, 사유, Audit ID를 조회할 수 있다.
      `[AC-05]`
- [ ] Operator/Manager/Admin의 상태 변경 범위와 Viewer 읽기 전용을 검증한다.
- [ ] 공식/잠정 값과 Fresh/Delayed/Partial/Failed 상태가 모든 운영 화면에서
      구분된다.
- [ ] Phase 1~3의 모든 `Must` 요구사항과 연결된 UAT가 통과한다.

## Phase 4 — 1차 고도화 (`Should`)

### 분석과 Closing 고도화

- [ ] 손익/장부가 변동 Waterfall과 contribution 분해를 구현한다. `[FR-007]`
- [ ] Top/Bottom contributor와 종목별 기여도를 구현한다. `[FR-008]`
- [ ] 월말 체크리스트, 담당자, 완료/미완료, 마감기한 관리를 구현한다.
      `[FR-016]`

### Securities Lending 고도화

- [ ] Fee x 가용잔고 x 보유액 Scatter/Heatmap과 Cross-filter를 구현한다.
      `[FR-018]`
- [ ] 상환예정, Recall, Corporate Action 영향을 표시한다. `[FR-020]`
- [ ] 기회 종목 ranking 기준과 예상수익 산식을 Metric Dictionary로 관리한다.

### Scenario Lab

- [ ] 금리, Spread, FX, Lending Fee, 대여율, Haircut 가정 입력을 구현한다.
      `[FR-021]`
- [ ] `POST /scenario/run`에 허용 범위 검증, 모델 버전, 입력 Snapshot 고정을
      구현한다.
- [ ] Current와 Scenario의 평가손익, 수익, 담보 영향을 계산한다. `[FR-022]`
- [ ] Duration 근사와 Full Reprice 등 모델 수준/한계를 결과에 표시한다.
- [ ] Scenario를 운영 수치와 시각적으로 구분하고 쓰기 경로를 분리한다.
- [ ] Scenario 실행이 원장 데이터 변경을 발생시키지 않는지 검증한다. `[AC-07]`

### Saved View, Export, Alert

- [ ] 사용자 context, layout, filters, sort, chart 구성을 저장/재호출한다.
      `[FR-026]`
- [ ] `GET /views`, `POST /views`, `GET/PATCH/DELETE /views/{id}`와 소유자 기반
      Saved View lifecycle 권한을 구현한다.
- [ ] 조회 시 현재 권한을 재평가하되 저장 당시 Metric 정의 버전과 Snapshot/data
      버전을 고정하여 context를 재현한다.
- [ ] 최신 Metric 정의로의 전환은 영향 차이를 보여 주는 명시적 migration으로
      제공하고 원본 Saved View 버전을 보존한다.
- [ ] 현재 분석 context를 Excel/CSV/PDF/이미지로 Export한다. `[FR-027]`
- [ ] Export에 As-of, filters, Metric 정의 버전, 생성자, 생성시각을 포함한다.
- [ ] 대용량/민감정보 Export를 권한과 정책으로 제한하고 감사로그를 기록한다.
- [ ] 금액, 건수, 임계치, 마감시간 기반 알림 규칙과 전달 상태를 구현한다.
      `[FR-028]`
- [ ] 중복 알림 억제, 확인, 재시도, 비활성화와 알림 감사 이력을 구현한다.

## Phase 5 — Optimization Backlog (`Could`/별도 승인)

- [ ] 동일 context를 재현하는 예외/분석 화면 링크 공유를 구현한다. `[FR-032]`
- [ ] 공유 링크 접근 시 현재 사용자의 데이터 범위 권한을 다시 평가한다.
- [ ] ML anomaly 후보 탐지의 학습 데이터, 설명가능성, 오탐 관리 기준을 설계한다.
- [ ] 자연어 탐색의 허용 Metric/Dimension, 권한, query preview, 비용 제한을
      설계한다.
- [ ] Phase 5 항목은 별도 요구사항/수용 기준 승인 후 구현한다.

## 공통 비기능 요구사항 및 출시 Gate

### 성능, 가용성, 복구

- [ ] 운영 유사 데이터에서 Cockpit 최초 로드 P95 3초 이내를 달성한다.
      `[NFR-001] [AC-08]`
- [ ] 일반 drill-down P95 2초 이내를 달성한다. `[NFR-001] [AC-08]`
- [ ] 수천만 건 거래/포지션 이력의 일/월말 Snapshot 조회 부하 테스트를 통과한다.
      `[NFR-002]`
- [ ] 업무시간 월 가용성 99.9% SLO와 error budget을 운영한다. `[NFR-003]`
- [ ] 메타데이터/사용자 설정 백업 복구 훈련으로 RPO 1시간/RTO 4시간을 검증한다.
      `[NFR-014]`

### 보안과 관측성

- [ ] 인증 우회, 수평/수직 권한 상승, data scope 누출, Export 누출을 보안
      테스트한다.
- [ ] Secret, PII, 민감 거래/상대방 값이 application/audit/trace 로그에
      불필요하게 남지 않는지 점검한다.
- [ ] API latency, query error, data lag, ingestion/reconciliation failure
      dashboard와 경보를 운영한다. `[NFR-013]`
- [ ] Audit 보존, 접근, 위변조 탐지, 복구 절차를 검증한다.

### 품질과 접근성

- [ ] Unit test로 Metric 산식, tolerance, severity, 상태 전이, 권한 평가를
      검증한다.
- [ ] Integration test로 ingestion → mart → semantic query → API 흐름을
      검증한다.
- [ ] Contract test로 Frontend/API 및 Source adapter schema 변경을 탐지한다.
- [ ] E2E test로 UC-01~UC-08의 기본/권한/오류 흐름을 검증한다.
- [ ] Chrome 최신 2개 버전에서 핵심 화면 회귀 테스트를 수행한다. `[NFR-012]`
- [ ] 키보드 전용 탐색, focus order, screen reader label, 대비를 검증한다.
      `[NFR-011]`
- [ ] 새 자산군/Metric/대사 규칙을 최소한의 코드 변경으로 추가하는 확장성
      테스트를 수행한다. `[NFR-015]`

### 요구사항 추적과 출시

- [ ] 각 FR/NFR에 코드 모듈, 테스트케이스, UAT 결과, 운영 runbook 링크를
      연결한다. `[NFR-016]`
- [ ] 데이터 Owner가 Metric Dictionary와 원천 대사 결과를 승인한다.
- [ ] 업무 Owner가 예외 workflow, Closing Bridge, Lending 결과를 승인한다.
- [ ] 보안 담당자가 RBAC, data scope, 마스킹, Audit, Export 정책을 승인한다.
- [ ] 운영 담당자가 배포, rollback, backfill, 장애, 데이터 지연, 복구 runbook을
      승인한다.
- [ ] 모든 Must 항목과 AC-01~AC-08을 통과한 뒤 MVP를 출시한다.

## 요구사항 추적 체크리스트

| 요구사항 | 우선순위 | 구현 Phase | 상태 |
|---|---|---:|---|
| FR-001~003 Morning Cockpit | Must | 2 | [ ] |
| FR-004~006 Portfolio Explorer | Must | 2 | [ ] |
| FR-007~008 Attribution | Should | 4 | [ ] |
| FR-009~013 Settlement/Reconciliation | Must | 3 | [ ] |
| FR-014~015 Closing | Must | 3 | [ ] |
| FR-016 Closing Checklist | Should | 4 | [ ] |
| FR-017 Lending Inventory/Fee | Must | 3 | [ ] |
| FR-018 Lending Opportunity | Should | 4 | [ ] |
| FR-019 Collateral/Exposure | Must | 3 | [ ] |
| FR-020 Recall/Corporate Action | Should | 4 | [ ] |
| FR-021~022 Scenario Lab | Should | 4 | [ ] |
| FR-023~024 Explain/Lineage | Must | 2 | [ ] |
| FR-025 Unified Search | Must | 1 | [ ] |
| FR-026 Saved View | Should | 4 | [ ] |
| FR-027 Export | Should | 4 | [ ] |
| FR-028 Alert | Should | 4 | [ ] |
| FR-029 Admin | Must | 1/3 | [ ] |
| FR-030 Audit | Must | 1/3 | [ ] |
| FR-031 Data Quality Status | Must | 1 | [ ] |
| FR-032 Context Link Sharing | Could | 5 | [ ] |
