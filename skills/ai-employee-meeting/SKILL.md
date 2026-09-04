---
name: star45-ai-employee-meeting
version: 1.0.0
description: 관리자에서 AI 가상직원을 생성하고 역할·페르소나·스킬·권한·LLM Provider·검색 허용범위를 지정하여 VoiceFlow 회의에 참석시키고, 의견·반론·제안·업무수행·학습 메모리를 운영하는 STAR45 공통 스킬.
---

# STAR45 AI Employee Meeting Skill

## 적용 원칙
모든 VoiceFlow/Total ERP 계열 앱에서 AI 직원 기능 요청 시 아래 구조를 기본 포함한다.

## AI Employee Entity
필수 필드:
- tenant_id, org_id, department_id
- employee_id, display_name, avatar
- title, role, mission
- persona: tone, decision_style, expertise, challenge_level
- languages
- model_provider: openai | gemini | anthropic | auto
- model_id
- skills[]
- tool_permissions[]
- search_policy: off | internal_only | web_allowed
- memory_policy: meeting_summary | approved_learning | long_term
- autonomy: observe | advise | execute_with_approval | execute_within_scope
- status: active | paused

## 회의 행동
AI 직원은 회의 초대 시 사람 참가자처럼 참가한다.
- 발언권: 진행자 호출 / 자동 발언 / 반론 요청 / 요약 요청
- 의견: 역할·전문성·기억·현재 회의 맥락을 기반으로 생성
- 검증: 사실 주장/수치/외부정보는 가능한 경우 출처 또는 근거 상태 표시
- 다국어: 본인 기본언어로 생성 후 회의 Translation Assurance 파이프라인을 통과
- 행동: 할당된 업무를 Task로 변환하고 권한 범위 내 Tool/Connector 실행
- 중요한 외부 변경/발송/ERP 반영은 권한 정책에 따라 승인 게이트 적용

## 성장/메모리
AI 직원은 무제한 자기변경을 하지 않는다. 성장 데이터는 다음 3층으로 분리한다.
1. Working Memory: 현재 회의/업무 임시 맥락
2. Team Memory: 승인된 SOP, 결정사항, 반복업무 패턴
3. Long-term Profile: 관리자가 승인한 선호·전문지식·성과 피드백

대화 자체를 즉시 영구 학습시키지 않고, 회의 종료 시 Learning Candidate를 생성한다.
관리자가 승인하거나 정책이 허용된 범주만 장기 메모리에 반영한다.

## Provider Router
AI 직원별로 OpenAI, Gemini, Anthropic(Claude)을 선택하거나 auto로 둔다.
- API Key는 서버 Secret Store/환경변수에서만 읽는다.
- 브라우저/프런트에 키를 노출하지 않는다.
- Provider 장애 시 자동 Fallback 허용
- 관리자에서 연결 테스트/지연/비용/품질 상태 표시

## Search & Research
search_policy가 web_allowed인 직원만 외부 검색 가능하다.
검색 결과는 출처 URL/제목/시간과 함께 Research Note로 저장한다.
내부 자료 우선 → 최신 공개자료 필요 시 외부 검색 순서로 작동한다.

## Tool/Connector
공통 STAR45 Integration Layer를 사용한다.
- Total ERP API Gateway
- Google Workspace / Calendar / Drive
- Outlook / Microsoft 365
- Obsidian / Knowledge Vault
- GitHub
- 기타 Connector Registry

도구 실행은 tenant/org/member 권한과 AI 직원 tool_permissions를 동시에 통과해야 한다.

## 관리자 UI
관리자 > AI 직원센터
- 직원 생성/복제/중지
- 이름/직책/부서/역할/미션
- 페르소나
- 사용 언어
- 모델 Provider/Model
- 스킬
- 검색 허용
- 도구 권한
- 자율성 수준
- 메모리/성장 정책
- 비용 한도
- 회의 자동참석 규칙
- 테스트 대화
- 품질/응답속도/비용 진단

## AI Meeting Lab
웹에서 실제 직원 없이 테스트 가능해야 한다.
- 사람 1 + AI 직원 N명
- AI 직원들끼리만 가상회의
- 주제 입력 후 3/5/10분 자동 토론
- 각 직원 발언, 찬성/반론, 근거, Action Item 표시
- 회의 종료 후 요약/결정/이견/업무/리스크 생성
- 실제 ERP 쓰기는 기본 비활성화(mock mode)

## Event Standard
ai.employee.created
ai.employee.updated
ai.employee.joined_meeting
ai.employee.spoke
ai.employee.research.completed
ai.employee.task.proposed
ai.employee.task.executed
ai.employee.learning.candidate
ai.employee.learning.approved

모든 Event는 STAR45 공통 Event Envelope를 사용한다.
