---
name: star45-common-integration
version: "1.0.0"
description: STAR45/Total ERP 계열의 독립 앱·모듈을 통합 ERP와 연결할 때 기본 포함해야 하는 공통 API·Connector·인증·키·권한·이벤트·상태점검 표준.
---

# STAR45 Common Integration Skill

이 스킬은 향후 Total ERP 및 STAR45 계열의 모든 모듈형 앱, 독립 SaaS, PWA, 모바일 앱을 중앙 ERP와 쉽게 연결하기 위한 공통 연동 규격이다. 사용자가 "ERP와 연동", "다른 앱과 연결", "DB 연결", "API 연결"을 요청하면 아래 기능을 기본 포함한다.

## 1. 필수 공통 연동 레이어
- API Gateway: `/api/v1/...` 버전형 REST API, 필요 시 WebSocket/SSE 지원.
- Connector Registry: Google Workspace, Outlook/Microsoft 365, ERP, Obsidian, GitHub, Slack/Zalo/Kakao/WeChat/Line 등 Connector를 Provider 방식으로 등록.
- Integration Settings UI: 관리자 화면에서 Connector 추가/수정/활성화/비활성화/연결 테스트/재연결 가능.
- DB Adapter: 중앙 ERP DB 직접 연결 또는 API Gateway 연결을 선택할 수 있는 데이터 접근 계층.
- Event/Webhook Layer: 업무 생성, 회의 종료, 재고 변경, 승인, 일정 생성 등 이벤트를 표준 Event Envelope로 발행.
- Health & Diagnostics: Connector별 연결 상태, 마지막 성공시각, 오류, 지연, 재시도 상태, 추천 조치 표시.

## 2. 공통 인증 및 키 관리
- Client ID / Client Secret / API Key / Access Token / Refresh Token / Webhook Secret / Endpoint URL을 공통 Secret Store 규격으로 관리.
- 키는 프런트엔드 코드나 Git 저장소에 하드코딩하지 않는다.
- 환경변수 또는 서버측 Secret Store를 사용한다.
- 관리자 UI에서는 전체 키를 재노출하지 않고 마스킹하여 표시한다.
- OAuth 2.0/OIDC/SAML/API Key/HMAC 방식 지원.
- 키 회전, 만료, 재인증 상태를 저장한다.

## 3. 멀티테넌트 및 권한
- Tenant -> Org -> Department -> Member 구조를 기본으로 적용한다.
- Connector 설정은 global / tenant / org / user scope를 구분한다.
- RBAC + 필요 시 ABAC를 적용한다.
- 다른 회사/외부 사용자 데이터가 서로 섞이지 않도록 tenant_id를 모든 핵심 데이터와 이벤트에 포함한다.

## 4. 표준 Connector 인터페이스
모든 Connector는 최소 다음 기능을 갖는다.
- `connect()`
- `disconnect()`
- `testConnection()`
- `getStatus()`
- `refreshCredential()`
- `pull()`
- `push()`
- `handleWebhook()`

Connector 결과는 공통 형식으로 반환한다.
- `ok`
- `connector_id`
- `provider`
- `scope`
- `latency_ms`
- `last_success_at`
- `error_code`
- `message`
- `recommended_action`

## 5. 표준 데이터/이벤트 Envelope
앱 간 데이터 전송 시 최소 아래 필드를 사용한다.
- `event_id`
- `event_type`
- `tenant_id`
- `org_id`
- `source_app`
- `source_module`
- `entity_type`
- `entity_id`
- `occurred_at`
- `actor_id`
- `schema_version`
- `payload`
- `trace_id`

## 6. 중앙 ERP와 독립 앱 동시 지원
- 독립 앱은 자체 DB로 먼저 운영 가능해야 한다.
- 추후 Total ERP 통합 시 DB를 뜯어고치지 않고 Adapter만 `local` -> `erp-api` 또는 `central-db`로 전환할 수 있어야 한다.
- 공통 Master(사용자, 조직, 거래처, 품목, 매장, 프로젝트 등)는 ERP Master API와 매핑 가능해야 한다.
- 동기화는 `master_id + external_id + source_system` 매핑 테이블을 기본으로 둔다.

## 7. 관리자 Integration Center 기본 화면
모든 신규 앱은 필요 시 관리자 메뉴에 다음을 기본 포함한다.
- 연결된 시스템 목록
- Provider/Connector 선택
- API URL/Client ID/Secret/Scope 등록
- 연결 테스트
- 마지막 동기화 시각
- 오류 로그
- 재시도/재연결
- 권한 범위
- 동기화 방향(Push/Pull/Bidirectional)
- 활성/비활성
- 품질/지연/실패율
- 더 나은 Provider 추천

## 8. 자동 Fallback 및 장애 대응
- 외부 Provider 장애 시 가능한 경우 보조 Provider로 자동 전환한다.
- 데이터 write는 idempotency key를 사용해 중복 저장을 방지한다.
- 재시도는 exponential backoff를 적용한다.
- 실패 이벤트는 Dead Letter Queue 또는 오류 큐에 보존한다.
- 중요 데이터는 즉시 삭제하지 않고 재처리 가능 상태로 유지한다.

## 9. 보안 기본값
- HTTPS/TLS 필수.
- 최소권한 Scope 사용.
- Secret 로그 출력 금지.
- 감사 로그(Audit Log) 저장.
- 개인정보/민감정보는 필드단위 마스킹 또는 암호화 고려.
- 국가별 법률 및 보존기간 설정을 Connector/Locale 정책과 연계한다.

## 10. 사용자가 "연동해줘"라고 요청했을 때의 기본 동작
1. 대상 앱의 현재 API/DB/Auth 구조를 확인한다.
2. Integration Center와 Connector Registry 유무를 확인한다.
3. 없으면 공통 Connector 인터페이스와 설정 화면을 추가한다.
4. 필요한 키/Endpoint/Scope 입력란을 만든다.
5. 연결 테스트 API와 상태 진단을 만든다.
6. tenant/org/user scope를 매핑한다.
7. Push/Pull/Event/Webhook 흐름을 정의한다.
8. 자동 테스트와 실패/재시도 테스트를 추가한다.
9. 중앙 ERP 연결이 아직 없어도 Mock/Local Adapter로 작동하게 한다.
10. 향후 ERP API Gateway 주소만 입력하면 전환 가능하게 유지한다.

## 11. 기본 원칙
- 앱별로 제각각 연동 코드를 만들지 않는다.
- 공통 Connector SDK/Contract를 재사용한다.
- API 버전과 Schema Version을 명시한다.
- 특정 외부 서비스에 종속되지 않는 Provider 구조를 우선한다.
- 관리자에게는 원리 설명보다 어디서 무엇을 입력/연결/테스트하는지 행동 중심 UI를 제공한다.
- 통합 ERP 개발 시 기존 독립 앱의 기능을 다시 만들기보다 API/Connector로 연결하는 것을 우선한다.
