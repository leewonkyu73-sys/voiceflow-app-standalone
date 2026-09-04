# STAR45 VoiceFlow v4 전환 설계

작성 기준: 2026-08-29  
운영 기준 SHA: `3502ce63340dfe9ec3d4e94bd10f12a3ac66753f`  
운영 프런트: app v3.5.17 / service worker v343  
상태: 설계 확정 후보 · 운영 코드/DB/DNS/Secret 미변경

## 1. 결정

현재 v3.5.17은 운영 안전판으로 유지한다. 기존 서버, DB, 인증, 조직·권한, 회의·caption API, 번역, 결과·자료·업무·일정, 배포 인프라는 재사용한다.

v4는 하나의 공통 회의 도메인과 API 계약 위에 다음 두 실행 번들을 둔다.

- Desktop Web: PC 입력, 장치 선택, 다중 영상, 넓은 회의 화면
- Mobile PWA: Samsung/Android 마이크 수명주기, 화면 복귀, 한 손 조작, 저속망 복구

두 번들은 업무 로직을 복제하지 않는다. 공통 상태기계, API client, caption store, 번역·저장 계약을 공유하고 media/UI adapter만 분리한다.

## 2. 확인된 구조적 문제

- 최종 프런트가 `public/app.js` 하나와 순서 의존 생성 패치 15개 이상으로 만들어진다.
- `state.media`, SpeechRecognition, 서버 STT fallback, 전체 `render()`, `postCaption()`, 회의 종료 상태가 같은 실행면에 결합돼 있다.
- 패치 하나의 문자열이나 렌더 순서 변경이 뒤 패치의 anchor와 다른 정상 기능을 바꾼 사례가 원장에 반복 기록돼 있다.
- 자동 Chromium 검사는 UI/가짜 미디어를 검증하지만 실제 Samsung SpeechRecognition 이벤트와 시스템음을 증명하지 못한다.
- 저장소의 격리형 `/voice-core-v1`은 단일 마이크와 공통 caption API 방향을 입증하지만 4초 segment, 전송 전 draft 삭제, 실제 기기 미검증 때문에 그대로 운영 승격하지 않는다.

## 3. 기준 상태

| 계층 | 기준 | 판정 |
|---|---|---|
| SOURCE | main `3502ce6`, app 생성물 v3.5.17 | PASS |
| CI/DOCKER | VoiceFlow CI run `33242385218` | PASS |
| DEPLOY/OPERATING | E2E 18/18, OVERALL 100% | PASS |
| PC 실제 음성·화상 재입장·입력 | v3.5.17 배포 후 사용자 재확인 없음 | UNVERIFIED |
| Samsung 원문·주기음 | v3.5.15까지 원문 FAIL, v3.5.16/17 재확인 없음 | UNVERIFIED |
| Mobile DEVICE Golden | `b98dcdd6d5b97f18fd3d5fc960817b3f50959740`, app v3.5.6 | PASS 기준 |

v4는 자동검사 PASS를 DEVICE PASS로 바꾸지 않는다.

## 4. 재사용과 교체 경계

| 영역 | 결정 | 근거 |
|---|---|---|
| 인증·세션·조직·권한 | 재사용 | 실시간 미디어 장애와 직접 관련 없음 |
| Meeting API·caption API·signals·finalize/result | 계약 고정 후 재사용 | 이미 모듈 manifest와 운영 API 존재 |
| 번역·Provider Hub·DeepL | adapter로 재사용 | Provider 실응답·비용 상태는 별도 게이트 |
| 회의 결과·Drive·업무·일정·자료 | 재사용 | downstream 모듈로 이미 분리됨 |
| 배포센터·Docker·Health | 재사용 | 운영 100% 검사 자산 존재 |
| `public/app.js` 패치 체인 | v4에서 사용 금지 | 순서 의존 회귀의 중심 |
| 모바일 SpeechRecognition 주 경로 | 사용 금지 | 기기 이벤트 비결정성과 반복 실패 |
| 모바일 음성 capture/STT | 새 adapter | 단일 소유자·명시적 전환 필요 |
| PC 음성·텍스트·화상 UI | 새 Desktop adapter | 모바일 수명주기와 격리 필요 |
| 회의 상태·caption store | 공통 모듈로 새로 작성 | 재입장·종료·낙관적 입력의 단일 기준 필요 |
| 영상 transport | 2기기 spike 후 결정 | 기존 WebRTC 보존 vs LiveKit 교체를 실측 비교 |

## 5. 목표 모듈 구조

```text
frontend-v4/
  packages/
    meeting-contracts/       API DTO, event, 오류 규격
    meeting-state/           명시적 상태기계
    caption-store/           원문·번역·전송·재접속 상태
    api-client/              인증·재시도·idempotency
    media-contracts/         마이크/카메라 단일 소유권
    design-tokens/           공통 색상·간격·타이포
  apps/
    desktop-web/             PC adapter와 UI
    mobile-pwa/              Samsung/Android adapter와 UI
  tests/
    contract/
    desktop-e2e/
    mobile-e2e/
    device-checklists/
```

기술 원칙은 TypeScript 기반 독립 번들이다. v3 파일을 문자열 치환해 만들지 않고, 빌드 입력과 산출물을 명확히 분리한다. React 등 UI framework 채택은 첫 vertical slice의 번들 크기·개발속도 비교 후 결정하며 이번 설계에서 강제하지 않는다.

## 6. 단일 소유권

| 자원 | 단일 소유자 |
|---|---|
| microphone stream | 각 플랫폼의 `MediaSessionAdapter` |
| camera/screen tracks | `VideoSessionAdapter` |
| recording/STT transition | `SpeechSessionMachine` |
| meeting lifecycle | `MeetingSessionMachine` |
| captions and drafts | `CaptionStore` |
| translation request | `CaptionService` |
| reconnect and idempotency | `MeetingApiClient` |
| room UI rendering | Desktop/Mobile view 각각의 root |

브라우저 STT와 서버 STT는 동시에 마이크를 소유하지 않는다. 모바일 browser STT는 사용 가능할 때 임시 preview 후보일 뿐 저장 원문의 기본 경로가 아니다.

## 7. 상태기계

회의 상태:

`idle -> preparing -> ready -> live -> paused -> finalizing -> ended`

음성 상태:

`idle -> permission -> capturing -> transcribing -> caption_committed -> capturing`

오류는 `recoverable_error`와 `fatal_error`로 분리한다. 회의 ID가 변경되면 이전 caption, system notice, result, cursor, draft binding을 반드시 분리한다. 종료된 회의는 재개하지 않고 결과 보기만 허용한다.

## 8. 입력·원문·번역 계약

1. 입력에는 client-generated idempotency key를 부여한다.
2. 직접입력은 즉시 `pending` 원문으로 화면에 표시한다.
3. API 성공 후 동일 항목을 `committed`로 바꾼다.
4. 실패하면 원문과 draft를 보존하고 재시도 상태를 표시한다.
5. 음성도 확정 원문 이후 같은 caption API를 사용한다.
6. 번역은 원문 저장과 별도 상태로 처리해 번역 실패가 원문을 숨기지 못하게 한다.
7. 재접속 시 서버 cursor와 client pending queue를 idempotency key로 병합한다.

## 9. 모바일 음성 결정 게이트

첫 구현 전 같은 Samsung 녹음 샘플로 아래 후보를 비교한다.

| 후보 | 지연 | 정확도 | 비용 | 기기 안정성 | 기본값 조건 |
|---|---|---|---|---|---|
| 현재 브라우저 STT | 실측 | 실측 | 무료 | 현재 실패 이력 | preview로만 검토 |
| 기존 서버 STT adapter | 실측 | 실측 | Provider별 측정 | MediaRecorder 지원 | 실제 Provider PASS 필요 |
| 로컬/자체 Whisper | 실측 | 실측 | 서버/PC 자원 | 네트워크 영향 | VPS/PC 처리량 PASS 필요 |

유료 Provider, LiveKit 또는 새 인프라는 비용·지연·복구 비교와 사용자 승인 전 기본값으로 전환하지 않는다.

## 10. 영상 결정 게이트

기존 WebRTC와 self-hosted LiveKit 후보를 PC 1대 + Samsung 1대에서 다음 동일 조건으로 비교한다.

- 입장 성공률과 입장 시간
- 참가자 수 일치
- 송출/수신 지속성
- 화면 전환·백그라운드 복귀
- TURN 사용 시 지연과 서버 CPU/메모리
- 30분 세션 중 재연결 횟수
- 운영비와 롤백 시간

기존 구현이 기준을 만족하면 유지한다. LiveKit가 명확하게 개선되고 비용·운영 게이트를 통과할 때만 v4 영상 adapter로 채택한다.

## 11. 단계별 이관

### Phase 0 — 기준 동결과 계측, 1~2일

- v3.5.17 운영 SHA와 v3.5.6 DEVICE Golden 기록
- main 직접 변경 차단/필수 CI는 별도 승인 후 설정
- PC·Samsung 기준 시나리오와 측정표 확정
- 앱 기능 변경 없음

완료: Golden/현재/후보/운영 SHA와 DEVICE 결과가 분리 기록됨.

### Phase 1 — 공통 계약과 상태기계, 3~5일

- meeting/caption/error/idempotency 계약
- MeetingSessionMachine, CaptionStore 단위검사
- 기존 API adapter

완료: 실제 UI 없이 입력→저장→재접속→종료 상태 계약 PASS.

### Phase 2 — Mobile voice vertical slice, 7~10일

- 별도 `/v4/mobile` 기본 OFF 경로
- 단일 MediaSessionAdapter
- 원문→번역→저장→재접속
- 화면 복귀와 권한 오류복구

완료: Samsung 실기기에서 10회 연속 원문, 주기음 0회, 권한 요청 세션당 최대 1회.

### Phase 3 — Desktop vertical slice, 5~7일

- 별도 `/v4/desktop` 기본 OFF 경로
- 직접입력 보존, PC 마이크, 결과 종료·재입장
- 기존 관리자/결과 모듈 연결

완료: PC 입력→번역→저장→종료→홈→새 회의 E2E와 실기기 PASS.

### Phase 4 — 영상 adapter, 5~8일

- Phase 10 비교에서 선택된 transport 연결
- 참가자·트랙·재접속 상태를 공통 meeting state와 연결

완료: PC↔Samsung 30분 상호 영상/음성, 참가자 수, 종료·재입장 PASS.

### Phase 5 — 결과·업무·일정 통합, 3~5일

- finalize/result/review/Drive/task/calendar 기존 모듈 연결

완료: 실제 입력→처리→표시→저장→재접속→승인→업무/일정 E2E PASS.

### Phase 6 — Canary 전환, 3~5일

- 관리자·내부 계정만 v4 기능 플래그 ON
- Mobile 10%, Desktop 10%부터 단계적 전환
- 실패 시 라우팅만 v3.5.17로 복귀

완료: 운영·Provider·PC·Samsung BLOCKER/HIGH 0건 뒤 기본 경로 전환 승인.

예상 총기간: 4~6주. 약 2주 후 Mobile 핵심 실기기 후보 제공.

## 12. 성능·품질 완료 기준

- Samsung 원문 생성 성공률: 20문장 중 19문장 이상
- 첫 원문 표시: 네트워크 정상 조건 p95 2.5초 이내를 목표로 실측 기준 확정
- 주기적 시스템음: 30분 세션 0회
- 마이크 권한 요청: 세션당 최대 1회
- 직접입력 손실: 0건; 실패 시 draft 보존 100%
- caption 중복/순서 뒤바뀜: 재접속 포함 0건
- 종료 후 새 회의의 이전 UI/상태 노출: 0건
- PC↔Samsung 참가자 수와 트랙 상태 일치
- 번역 실패 시에도 원문은 항상 표시·저장
- 운영 E2E, Provider 실응답, DEVICE 결과를 각각 별도 PASS로 확보

## 13. 배포와 롤백

- v4는 기존 `/`를 바꾸지 않고 `/v4/mobile`, `/v4/desktop`에서 시작한다.
- 기능 플래그는 사용자/기기별로 분리하고 기본 OFF다.
- v4가 실패하면 DB rollback이나 전체 stack rollback 없이 route/flag만 v3.5.17로 되돌린다.
- 기존 DB schema 변경이 필요한 기능은 additive migration만 허용하고 rollback 전 호환성을 유지한다.
- 한 PR은 하나의 vertical slice와 하나의 원인만 포함한다.

## 14. 금지사항

- v3 `app.js` 패치 체인에 v4 기능 추가
- PC와 모바일 UI만 갈라놓고 media/state를 다시 공유
- 실기기 실패를 자동 Samsung-UA 검사로 PASS 처리
- Provider 미구성·billing·코드 오류를 하나의 실패 메시지로 처리
- 유료 STT/새 인프라를 승인 없이 기본 경로로 전환
- v4 검증 전 v3.5.17 제거 또는 기존 DB/API 파괴적 변경

## 15. 첫 구현 단위

첫 PR은 운영 기능을 바꾸지 않는다.

1. `frontend-v4/packages/meeting-contracts`
2. `frontend-v4/packages/meeting-state`
3. `frontend-v4/packages/caption-store`
4. focused unit test
5. v3.5.17 번들과 배포 산출물 불변 검사

이 PR이 통과한 뒤에만 `/v4/mobile`의 최소 화면과 MediaSessionAdapter를 시작한다.
