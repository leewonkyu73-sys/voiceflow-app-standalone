# Priority 5 QA — AI Employee System

## Goal
AI 직원 등록/수정 → Provider 테스트 → AI Meeting Lab → 의견/반론 → 업무 후보 생성까지 실제 작동 확인.

## Service
- Port: 4177
- Command: `npm run start:ai-employees`
- Health: `GET /health`

## Required checks
1. 로그인 회원이 AI 직원 목록을 읽을 수 있다.
2. 비로그인 사용자는 목록/회의 실행이 거절된다.
3. 관리자만 AI 직원 생성/수정/비활성화가 가능하다.
4. 기본 AI 직원 3명(전략/운영/검증)이 초기 생성된다.
5. Provider 상태에서 OpenAI/Gemini/Claude 키 연결 여부만 노출되고 키 값은 노출되지 않는다.
6. Provider=auto는 연결된 Provider를 우선 사용한다.
7. Provider가 없거나 호출 실패하면 local-safe/local-fallback으로 회의 테스트는 중단되지 않는다.
8. AI 직원 테스트 대화가 실제 응답을 반환한다.
9. Meeting Lab에서 최대 5명, 최대 5라운드 제한이 작동한다.
10. 각 발언에 직원명/직책/역할/Provider가 표시된다.
11. AI끼리 무한 대화하지 않고 설정한 라운드 후 종료된다.
12. 업무 후보는 자동 실행되지 않고 `awaiting_approval` 상태로만 생성된다.
13. 업무 후보 등록은 tool audit에 기록된다.
14. 기억 후보는 `pending_approval` 상태로 생성된다.
15. disabled/paused 직원은 자동 회의 참여 대상에서 제외된다.

## Security
- Provider API keys are server-side env vars only.
- Real ERP/Calendar/Email writes are not executed in this phase.
- External write actions remain approval-gated.
- Admin CRUD requires VoiceFlow admin session.

## Next integration
Production routing target:
- `/api/v1/ai-employees*` → `:4177`
- `/api/v1/ai-meeting/*` → `:4177`
- `/api/v1/ai-actions/*` → `:4177`
- `/api/v1/ai-memory/*` → `:4177`

Then wire approved `task.create` proposals to Task Calendar Service (`:4176`).
