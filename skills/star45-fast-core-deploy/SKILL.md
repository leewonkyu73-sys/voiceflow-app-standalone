---
name: star45-fast-core-deploy
version: "1.0.0"
description: STAR45 계열 앱의 소규모 Backend/Core 수정 시 전체 Docker build를 피하고 변경 파일만 안전하게 주입·재시작·검증·롤백하는 공통 Fast Core 배포 표준.
---

# STAR45 Fast Core Deploy Skill

## 목적
STAR45/Total ERP 계열 앱에서 JS/MJS 기반 Backend/Core 수정이 발생했을 때 전체 Docker image rebuild 대신 변경 파일만 실행 중인 컨테이너에 반영하여 배포 시간을 크게 줄인다. 이 스킬은 UI의 Fast UI와 짝을 이루는 Backend용 공통 배포 규격이다.

## 기본 목표
- 일반적인 Core 코드 수정: 20~60초 내 운영 반영 목표.
- 전체 Docker build는 예외 경로로 취급한다.
- 소스 수정과 운영 반영을 구분한다.
- Health 통과만으로 기능 정상 판정하지 않는다.
- 실제 기능 Synthetic/E2E 테스트가 통과해야 완료로 판정한다.

## Fast Core 적용 가능 조건
다음 변경은 Fast Core를 우선 사용한다.
- `server*.mjs`, `services/*.mjs`, `lib/*.mjs` 등의 애플리케이션 코드 수정.
- API 라우팅, Provider/Fallback, 데이터 변환, Validation, 업무 로직 수정.
- 패키지 설치가 필요 없는 순수 JS/TS 런타임 변경.
- DB schema 변경이 없는 수정.

## Full Build가 필요한 조건
다음은 Fast Core를 사용하지 않고 전체 build/deploy를 사용한다.
- `package.json` 의존성 추가/삭제/버전 변경.
- Dockerfile, OS package, native module 변경.
- Node/Python 런타임 버전 변경.
- DB migration 또는 schema 변경.
- 새 binary/compiled artifact 필요.
- container volume/network/port/environment 구조 변경.
- 운영 데이터 구조를 대량 변경하는 작업.

## 표준 실행 순서
1. 최신 소스를 동기화한다.
2. 변경 파일 문법/정적 검사를 수행한다.
3. 실행 중 컨테이너의 교체 대상 파일을 backup 한다.
4. 변경 파일만 `docker cp`로 컨테이너에 주입한다.
5. 해당 서비스 컨테이너만 restart한다.
6. 로컬 Health endpoint를 확인한다.
7. 실제 핵심 기능 Synthetic 테스트를 실행한다.
8. 필요 시 공개 URL/API를 확인한다.
9. 하나라도 실패하면 backup 파일을 복원하고 restart한다.
10. 모든 테스트 PASS 후에만 운영 완료로 판정한다.

## 공통 런너
`scripts/star45-fast-core-deploy.sh`를 재사용한다.

필수 인자:
- 컨테이너 이름
- Health URL
- 변경 파일 1개 이상

파일은 repository 기준 상대경로를 사용하고 기본 container root는 `/app`이다.

예시:
```sh
FAST_CORE_VERIFY_CMD='curl -fsSL http://127.0.0.1:4180/api/example | grep -q ok' \
  sh scripts/star45-fast-core-deploy.sh \
  my-app-core \
  http://127.0.0.1:4180/api/health \
  server.mjs lib/provider.mjs
```

## 앱별 Wrapper 규칙
각 앱은 `deploy/fast-core-<feature>.sh` 또는 `deploy/fast-core.sh` wrapper를 둔다.
Wrapper는 다음만 책임진다.
- 최신 main 동기화
- 필요한 source patch/generation
- 공통 runner 호출
- 기능별 `FAST_CORE_VERIFY_CMD` 정의
- 임시 source 변경 복원

공통 runner 로직을 앱별로 복사하지 않는다.

## 검증 규칙
Health 외에 실제 기능 테스트를 반드시 1개 이상 둔다.
예:
- 번역: 실제 KO → VI 문장을 보내고 번역문이 원문과 다른지 확인.
- 결제: sandbox 주문 생성 → 승인 응답 확인.
- 재고: test item 입고 → 조회 → rollback.
- AI: 실제 Provider 응답 및 모델명 확인.
- Calendar: test event 생성/조회/삭제.

## 안전/롤백
- 배포 전 컨테이너 파일을 `/tmp/star45-fast-core-*`에 backup한다.
- 주입 또는 재시작 후 Health/Synthetic 실패 시 자동 rollback한다.
- 운영 DB나 volume 데이터는 Fast Core runner가 수정하지 않는다.
- Secret은 출력하거나 복사하지 않는다.
- container 자체를 recreate하지 않는 것을 기본값으로 한다.
- restart로 부족하거나 image dependency가 달라진 경우 즉시 Full Build 경로로 전환한다.

## 완료 보고 규칙
Fast Core 완료 시 아래를 분리해서 보고한다.
- SOURCE SYNC
- SYNTAX CHECK
- FILE INJECT
- CORE RESTART
- LOCAL HEALTH
- SYNTHETIC FEATURE TEST
- PUBLIC CHECK (가능한 경우)
- ROLLBACK READY

`SOURCE`만 바뀐 상태를 운영 완료라고 말하지 않는다.

## 신규 STAR45 앱 기본 적용
새 앱을 만들 때 처음부터 다음 두 경로를 모두 준비한다.
- Fast UI: 정적/프런트 변경 빠른 배포
- Fast Core: Backend/Core 변경 빠른 배포

전체 Docker build는 dependency/container 구조 변경 시에만 사용한다.

## Deployment Center 연동 권장
향후 STAR45 Deployment Center에서는 변경 파일을 분석해 자동으로 배포 모드를 선택한다.
- UI only → Fast UI
- Core source only → Fast Core
- Dependency/Container/DB schema → Full Build

배포센터에는 예상시간, 위험도, 변경파일, 검증항목, 롤백 가능 여부를 표시한다.
