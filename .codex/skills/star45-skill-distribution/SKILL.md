---
name: star45-skill-distribution
description: GitHub를 원본으로 STAR45 스킬을 Codex 프로젝트·플러그인·Hermes·Obsidian·다른 Agent에 버전 고정, 승인, 검증, 롤백 가능한 방식으로 배포한다. 공통 스킬 저장소 구축, 패키징, 동기화, 운영 승격 또는 Agent 연동을 설계·실행할 때 사용한다.
---

# STAR45 스킬 배포

GitHub의 승인된 커밋이나 릴리스 태그를 실행 규칙의 기준 원본으로 유지한다. Hermes·Obsidian·다른 Agent에 같은 파일을 임의 복사해 각각 수정하지 않는다.

## 역할 경계

- GitHub: `SKILL.md`, 참조자료, 스크립트, 플러그인 매니페스트, 버전과 변경이력의 원본.
- Codex: 승인된 스킬을 읽고 허가 범위 안에서 작업·검증·보고.
- Hermes: 작업 전달, 실행 상태 회수, 재시도·중단 조건 적용. 스킬 원본이나 Secret 저장소가 아님.
- Obsidian: 설명, 회의결과, 판정, 장애원장과 지식의 사람용 보관. 실행 원본이 아님.
- Integration Hub: Provider 연결, 자격정보, 토큰 범위와 소비자 권한. 스킬에는 Secret 값이 아닌 환경변수명·scope·검증 계약만 기록.

구체적인 저장소 구조와 연결 계약이 필요하면 [확장 아키텍처](references/architecture.md)를 읽는다.
서버에서 복사 한 번으로 승인 Registry와 Hermes connector를 연결하거나 해제해야 하면 [바로 연결 절차](references/quick-connect.md)를 끝까지 읽고 제공된 제어 스크립트만 사용한다.

## 배포 원칙

1. 대상 프로젝트의 기존 스킬, 플러그인, 저장 위치, 호출자와 마지막 정상 버전을 먼저 조사한다.
2. 중복 스킬을 만들지 않는다. 기존 스킬이 목적을 충족하면 원본을 재사용하고 배포 메타데이터만 추가한다.
3. 개발 Agent는 브랜치를 사용할 수 있지만 운영 Agent는 승인된 커밋 SHA 또는 불변 릴리스 태그에 고정한다.
4. 스킬 변경은 검증 후 후보 버전으로 승격한다. `main` 변경을 Hermes나 운영 Agent가 즉시 자동 실행하게 하지 않는다.
5. Adapter는 Codex, Hermes, Obsidian, 다른 Agent별로 분리한다. 공통 `SKILL.md`에 특정 실행기의 로그인·Secret·로컬 경로를 결합하지 않는다.
6. 동기화 실패 시 기존 승인 버전을 유지한다. 부분 다운로드나 검증되지 않은 최신 파일로 교체하지 않는다.
7. 롤백은 코드를 재작성하지 않고 대상 Agent의 pin을 이전 승인 SHA/tag로 되돌린다.

## 승인 릴리스 태그와 소비자 동기화

- 릴리스 정의는 저장소의 [대상 매니페스트](../../../config/skill-release.json)에 기록한다.
- `skills-v<major>.<minor>.<patch>` 형식의 불변 태그만 운영 소비자에 배포한다. `main`, 이동 가능한 branch, `latest`는 운영 pin으로 사용하지 않는다.
- 태그는 [릴리스 워크플로](../../../.github/workflows/skill-release.yml)가 VoiceFlow CI 성공 SHA에서 전체 스킬 파일 체크섬을 생성한 뒤에만 만든다.
- 소비자 저장소에는 기존 `skills/` 구조를 유지하고 대상 스킬 폴더와 release pin만 원자적으로 교체한다. 같은 tag·checksum 재실행은 변경 없이 종료한다.
- 대상 저장소의 기본 branch와 install root가 실제 확인된 경우에만 매니페스트에 등록한다. 미등록 프로젝트에는 자동 복사하지 않는다.
- 소비자 동기화는 별도 PR과 CI를 통과시킨다. 원본 태그 성공을 소비자 로드 성공으로 대신하지 않는다.

## 변경과 검증

- 새 스킬이나 큰 수정은 `skill-creator`의 검증기로 검사한다.
- 플러그인 패키지는 `plugin-creator`의 매니페스트 검증을 통과시킨다.
- 매니페스트에 스킬 이름, 버전, 경로, SHA-256, 호환 schema, 대상 제품, 필수 권한, Secret 참조 이름을 기록한다.
- 실제 Secret, Hub Token, API Key, OAuth Secret, refresh token, service-role key, 개인 경로는 커밋하지 않는다.
- 동기화 결과를 `SOURCE`, `VALIDATION`, `PACKAGE`, `PUBLISH`, `CONSUMER_SYNC`, `OPERATING`으로 나눠 `PASS`, `CONDITIONAL`, `FAIL`, `UNVERIFIED`, `N/A` 중 하나로 기록한다.
- 소비자가 실제 승인 SHA를 로드했는지 확인하기 전 `CONSUMER_SYNC PASS`로 판정하지 않는다.
- Hermes 실행이나 Obsidian 기록이 미연결이면 해당 단계는 `UNVERIFIED`이며 전체 구조 가능성을 실제 연결 성공으로 보고하지 않는다.

## 승인과 중단

운영 권한 확대, 외부 저장소 공개, Webhook 생성, OAuth/API 토큰 생성·교체, Secret 이동, 대량 Agent 승격은 실행 직전에 별도 승인을 받는다. 검증 실패, 체크섬 불일치, 미승인 버전, Secret 탐지, 호환성 위반이 있으면 승격과 자동 동기화를 중단한다.

## 완료 보고

원본 저장소와 승인 SHA/tag, 포함 스킬, 대상 소비자, 검증 결과, 미연결 단계, 롤백 pin, 실제 링크를 보고한다. Obsidian에는 실행 원문 복사 대신 판정·증거·장애 링크를 기록하고, GitHub에는 실행 가능한 원본을 유지한다.
