# VoiceFlow 변경·장애 누적 원장

검색 태그: `STT` `번역` `마이크` `깜빡임` `외부음성` `CI` `배포` `모바일` `Provider`

상태 정의: `SOURCE` 소스 수정 · `CI` 자동검사 · `DOCKER` 이미지 빌드 · `DEPLOY` 배포 · `OPERATING` 운영 자산/응답 · `DEVICE` 실제 기기 기능

---

## 2026-08-27 · PR #110 · Android Chrome STT 마이크 경합 제거

- 태그: STT, 마이크, 모바일
- 증상: 브라우저 STT 감시 타이머가 서버 MediaRecorder를 동시에 시작해 두 인식기가 마이크를 경쟁함.
- 원인: 결과 지연을 실패로 오판하고 4.5초 후 서버 fallback을 병렬 시작.
- 수정: 모바일 Chrome은 브라우저 STT를 계속 유지하고 상태만 갱신.
- 결과: SOURCE 성공 · CI 성공 · DOCKER 성공 · DEPLOY 운영 반영 · DEVICE 미확인.
- 증거: PR #110, CI #714/715, 운영 자산의 `음성을 계속 듣는 중`.
- 교훈: 같은 스트림이라도 브라우저 STT와 MediaRecorder 전환은 단일 소유 상태로 관리한다.
- 후속 보호: 모바일에서 동시 fallback 금지 계약 유지.

## 2026-08-27 · PR #111 · 외부 음성 버튼 배치 및 배포 표식 수정

- 태그: 외부음성, UI, CI, 배포
- 증상: 홈의 외부 음성 버튼이 주 버튼과 같은 비중이었고 배포가 오래된 관리자 문구에서 실패.
- 수정: 홈 보조 버튼과 회의방 그룹, 관리자 배포 표식 갱신.
- 결과: SOURCE/CI/DOCKER/DEPLOY 성공. 이후 DEVICE/운영 사용에서 회의방 상단 UI 침범 확인.
- 실패 분류: 자동검사 성공이 실제 UI 성공을 보장하지 못한 사례.
- 교훈: 부가기능을 핵심 회의 툴바에 넣지 않는다. 실제 좁은 화면 기준을 별도 확인한다.
- superseded by: PR #112, PR #113.

## 2026-08-27 · PR #112 · PC STT 서버 전환과 회의방 외부 음성 숨김

- 태그: STT, 번역, 외부음성, PC
- 증상: PC 브라우저 STT 결과가 없고 외부 음성 버튼이 상단 UI를 무너뜨림.
- 수정: 4.5초 무응답 시 브라우저 인식을 abort하고 서버 STT로 단일 전환. 회의방 외부 음성 그룹 숨김.
- 결과: SOURCE/CI/DOCKER/DEPLOY/OPERATING 자산 성공. DEVICE 실패 보고: 말해도 텍스트 없음, 직접입력 번역 없음, 상단 깜빡임.
- 실패 원인: 서버 전환 코드 존재만 검사했고 실제 Provider 응답과 마이크 입력 결과를 배포 게이트로 검증하지 않음. 마이크 상태 MutationObserver의 상단 재삽입을 놓침.
- 교훈: 코드 표식 검사는 실제 음성·번역 검증을 대체할 수 없다.
- superseded by: PR #113.

## 2026-08-27 · PR #113 · 음성·번역 경로 고정 및 상단 깜빡임 제거

- 태그: STT, 번역, Provider, 깜빡임, UI
- 증상: 직접입력 번역 대기, 음성 무응답, `소리 확인 필요`와 상단 버튼 깜빡임·폭 증가.
- 확인 원인:
  - `audio-monitor.js`가 MutationObserver로 상태 위젯을 상단 툴바에 재삽입.
  - 번역 실패 시 원문 동일 결과가 화면에서 계속 처리 중으로 보임.
  - 이전 배포에는 실제 Provider 번역 응답 사전검사가 없었음.
- 수정:
  - 마이크 품질 상태를 대화 영역 별도 상태줄로 이동.
  - 상단 툴바 재삽입 금지.
  - 배포 전에 중앙 Gemini/OpenAI/DeepL로 한국어→베트남어 실제 번역 호출; 실패 시 컨테이너 교체 전 중단.
  - 음성·번역 안정성 계약검사 추가.
- 결과: SOURCE 성공 · 협업 회귀검사 성공 · CI 성공 · DOCKER 성공 · 실제 번역 Provider 게이트 성공 · DEPLOY 성공 · OPERATING Health/자산 성공 · DEVICE 음성 최종 확인 대기.
- 증거: PR #113, CI #722, 운영 `voice-core-stability-v365.css`, `audio-monitor.js`의 `insertBefore(box,toolbar.nextSibling)`, 운영 Health 정상.
- 롤백 기준: 상단 툴바 재삽입, 번역 Provider 실응답 실패, 음성→텍스트 미생성 시 부가기능 중단 후 마지막 실제 기기 정상 커밋으로 복구.
- 남은 미확인: PC·Android Chrome 실제 음성→원문→베트남어 번역, 저장 후 재접속 유지.

## 지속 적용 결정

- 핵심 출시 게이트: 음성 입력 → 원문 텍스트 → 선택 언어 번역.
- 위 세 단계 중 하나라도 실패하면 외부 음성, Zoom 연동, 관리자 확장 등 신규 기능을 진행하지 않는다.
- 모든 VoiceFlow 변경은 이 원장을 먼저 조회하고 작업 종료 시 증거 기반 새 항목을 추가한다.
- CI 성공과 실제 기능 성공을 분리한다.


## 2026-08-27 · 격리형 Voice Core v1 개발 시작

- 태그: STT, 번역, PC, 모바일, 구조분리
- 증상: PR #113 운영 후에도 DEVICE에서 PC·스마트폰 음성→텍스트 실패, 직접입력 번역 실패, 명령 응답 `입력을 확인했습니다`, 화상 회귀 보고.
- 판단: 연속 패치형 `app.js`에서 핵심 기능과 명령·화상·상태 렌더링이 결합되어 부분 수정마다 다른 기능이 회귀.
- 결정: 기존 운영 앱을 동결하고 `/voice-core-v1.html` 독립 경로에서 핵심만 재구축.
- 설계:
  - Web Speech API 미사용.
  - 단일 `getUserMedia` 스트림과 단일 MediaRecorder 서버 STT.
  - 음성·직접입력을 동일 caption/translation API로 처리.
  - 명령 파서·화상·외부 음성·전체 화면 재렌더링 제외.
- 현재 상태: SOURCE 작성 · CI/DOCKER/DEPLOY/OPERATING/DEVICE 대기.
- 롤백: 독립 정적 파일 제거만으로 기존 운영에 영향 없이 복구.
- 완료 기준: 격리 URL에서 PC·Android 실제 음성→원문→번역과 직접입력→번역 연속 성공 후에만 기존 홈 전환 검토.


## 2026-08-27 · CI #727 · 번역 Provider 부재가 격리 코어 배포를 차단

- 태그: 번역, Provider, CI, 배포, 구조분리
- 증상: PR #115 SOURCE/CI/DOCKER 성공 후 운영 `/voice-core-v1.html` 404.
- 원인: 운영 중앙 저장소와 `.env`에 Gemini/OpenAI/DeepL 키가 모두 없는 상태에서 사전 실응답 검사가 배포 전체를 중단.
- 수정: Provider가 구성된 경우에만 실응답 실패를 배포 차단으로 유지하고, 미구성 상태는 명확한 경고와 함께 격리 코어 배포를 허용.
- 범위: 기존 홈·DB·DNS·Secret 값은 변경하지 않음.
- 재발 방지: Provider 미구성과 Provider 장애를 구분한다. 미구성은 기능 상태 `UNAVAILABLE`, 구성 후 실응답 실패는 `DEPLOY BLOCK`.
- 상태: SOURCE 수정 중 · CI/DOCKER/DEPLOY/OPERATING 대기 · DEVICE 대기.


## 2026-08-27 · CI #729 · 빈 Provider 저장소 오판 수정

- 태그: 번역, Provider, CI, 배포
- 증상: CI #729에서 빈 `integration-secrets.json` 파일을 Provider 구성 상태로 오판하여 배포 재차 차단.
- 원인: 파일 존재·크기만 확인해 JSON `{}`도 구성됨으로 판정.
- 수정: 파일 내부에 실제 `GEMINI_API_KEY`, `OPENAI_API_KEY`, `DEEPL_API_KEY` 키 이름이 있는지 검사.
- 재발 방지: 구성 여부 검사는 파일 존재가 아닌 필요한 설정 항목 존재로 판정.
- 상태: SOURCE 수정 중 · CI/DOCKER/DEPLOY/OPERATING 대기 · DEVICE 대기.


## 2026-08-27 · CI #731 · Provider 암호문 복호화 불가와 핵심 배포 분리

- 태그: 번역, Provider, Secret, CI, 배포
- 증상: Provider 키 이름은 저장돼 있으나 모든 Provider가 `not-configured`로 판정되어 배포 차단.
- 원인: 저장된 암호문이 현재 `INTEGRATION_SECRET_KEY`로 복호화되지 않는 상태로 추정. Secret을 임의 변경하지 않음.
- 수정: Provider 실응답 실패를 명확히 경고하고 번역 상태를 `UNAVAILABLE`로 유지하되, 독립 Voice Core 정적 자산 배포와 STT 검증은 진행.
- 안전: DB·DNS·Secret 값은 변경하지 않음. Provider 정상으로 보고하지 않음.
- 후속: 운영 코어 배포 후 관리자에서 Provider를 다시 저장하고 실응답 검증해야 번역 `DEVICE PASS` 가능.
- 상태: SOURCE 수정 중 · CI/DOCKER/DEPLOY/OPERATING 대기 · 번역 DEVICE BLOCKED.


## 2026-08-27 · PR #103 정상 기준 복원 및 무회귀 가드 강화

- 태그: STT, 번역, 화상, 회귀, 격리, 복구
- 사용자 결정: 새 우회 구현보다 마지막 정상 기능을 찾아 필요한 파일만 복원.
- 기준: PR #103 병합 SHA `632b042cbe2f4eceb0ac147ebede228fa4ad00c1`.
- 보호 범위: #103의 참가자 수, 상호 화상, 채팅 스크롤 수정 유지.
- 복원 범위: 프런트 생성 진입점, 음성 패치, index 로더, audio-monitor, 테스트 목록만 #103 기준.
- 추가 조치: 영향표, 기능 격리, 기준/후보 성능 비교, 기능 플래그, 단계 검증, 실패 기록을 스킬 필수 게이트로 승격.
- 공개 근거: Google SRE Canary/Configuration, Fowler Feature Toggles, AWS Branch by Abstraction/Strangler Fig, GitHub Status Checks.
- 상태: SOURCE 진행 · CI/DOCKER/DEPLOY/OPERATING/DEVICE 대기.


## 2026-08-27 · 중복 운영 배포 파이프라인 격리

- 태그: CI, 배포, 회귀, 격리
- 증상: 같은 main 커밋에서 VoiceFlow CI, Live v276, UI Live v328, Tasks Live v361가 연속/병렬 실행되어 취소·실패와 덮어쓰기 위험 발생.
- 원인: 여러 워크플로가 push 자동 배포를 각각 소유하고 CI는 별도 concurrency 그룹 사용.
- 수정: 운영 자동 배포 소유자를 VoiceFlow CI 하나로 고정. 세 구형 배포 워크플로는 수동 실행 전용으로 전환하고 production rollout 잠금 유지.
- 배포 검증: SPA 셸 HTML에 존재하지 않는 `hubCard` 문자열 검사를 제거하고 후속 admin JS Hub 기능 검사는 유지.
- 재발 방지: 스킬에 단일 자동 배포 소유자와 공통 운영 잠금 규칙 추가.
- 상태: SOURCE 진행 · CI/DOCKER/DEPLOY/OPERATING 대기.


## 2026-08-27 · 일주일 반복 회귀와 기존 성공 복구 원칙 확정

- 태그: STT, 번역, 화상, 외부음성, 회귀, 프로세스, Golden, 이분탐색
- 증상: 음성인식·번역·화상 문제를 수정한 뒤 다른 정상 기능이 다시 실패하는 순환이 일주일 동안 반복됨.
- 사용자 지시: 새로운 방법을 만들지 말고 실제로 잘되던 기존 구현을 찾아 확인·복원할 것. 새로운 문제가 발생하면 해결 결과와 재발 방지 규칙을 이 스킬과 원장에 계속 업데이트할 것.
- 확인된 작업상 원인:
  - 실제 DEVICE 성공이 없는 상태에서 CI·Docker·운영 자산 성공을 정상으로 오판함.
  - 마지막 실제 정상 커밋을 고정하지 않고 연속 패치를 적용함.
  - 외부 음성 도입 후 핵심 마이크·번역·렌더 경로까지 함께 수정함.
  - PR #115에서 기존 성공 구현 복구보다 신규 Voice Core 경로를 만듦.
  - PR #119에서 실제 기기 근거가 불충분한 PR #103을 정상 기준으로 삼고 외부 음성 활성 패치와 일부 보호 테스트까지 제거함.
- 기존 성공 후보:
  - `632b042cbe2f4eceb0ac147ebede228fa4ad00c1`: PR #103, 외부 음성 추가 직전.
  - `cfd2b6f667d8d99a7cf7f5388aa5d65d87759712`: PR #104, 기존 파이프라인을 재사용한 외부 음성 구현.
  - `ff40f2d54519b4ae2f47bb66cd53726b30232d4c`: PR #107, 외부 음성 v3.6.3 운영 자산 반영.
  - `fef4a9a23daa32b5dc9404b51dccf7079eee3f85`: PR #109, 기능 변경 없이 배포 검사만 수정.
  - 위 커밋은 SOURCE/배포 증거가 있는 후보이며 실제 DEVICE Golden 여부는 미확인.
- 최초 회귀 조사 범위: `632b042`부터 `91d669d` 사이에서 PC 음성, Android 음성, 직접입력 번역, 상호 화상, 참가자 수, 채팅 위치, 외부 음성을 동일 시나리오로 비교.
- 강제 조치:
  - 동일 증상 두 번, 세 개 PR 또는 일주일 지속 시 신규 기능·새 경로·리팩터링·운영 배포 자동 중단.
  - 실제 정상 SHA가 없으면 Git 이분 탐색과 DEVICE 비교를 먼저 수행.
  - 기존 성공 구현을 우선 복원하고 새 코어·우회 페이지·대체 경로는 사용자 승인 없이 금지.
  - 원인 확정 전 DB·DNS·Secret·Provider 설정 변경 금지.
  - 이후 발생하는 새로운 장애는 증상·정상 SHA·최초 실패 SHA·원인·수정·단계별 검증·복구점을 원장에 누적.
- 현재 상태: SKILL 규칙 등록 · 장애 원장 등록 · 앱 소스/운영 미변경 · DEVICE Golden 조사 대기.


## 2026-08-27 · 대화·위험도 기반 모델 추천 규칙 등록

- 태그: 모델선택, Sol, Terra, Luna, 비용, 정확도, 작업라우팅
- 사용자 지시: 현재 지시와 대화 내용을 분석해 가장 효율적인 모델을 추천하고 이유를 설명할 것.
- 결정:
  - 반복 회귀·근본 원인·다중 커밋/서비스·운영 위험·Golden 불명확은 Sol.
  - 원인과 정상 기준이 확정된 단일 원인 최소 수정·검증은 Terra.
  - 변경 없는 상태 조회·정해진 로그 요약·단순 반복 확인은 Luna.
- 현재 VoiceFlow 핵심 복구: 일주일 반복 회귀, STT·번역·화상·외부음성·CI·운영·DEVICE가 얽혀 있으므로 Sol 권장.
- 하향 조건: Golden SHA, 최초 실패, 변경 파일, 복구 지점, 자동·DEVICE 검증 절차가 모두 확정된 뒤 Terra/Luna 사용 검토.
- 상태: SKILL 모델 추천 규칙 등록 · 앱 소스/운영 미변경.


## 2026-08-27 · Sol 추론 강도별 작업 라우팅 보강

- 태그: Sol, low, medium, high, xhigh, max, ultra, 속도, 비용, 정확도
- 사용자 지시: Sol 내부의 속도·추론 강도 차이까지 종합해 추천할 것.
- 현재 권장: VoiceFlow Golden 기준 확정과 최초 회귀 조사에는 GPT-5.6 Sol xhigh.
- 이유: 여러 커밋·서비스·기기 증거를 깊게 비교해야 하지만 max/ultra가 필요한 근거 충돌은 아직 확정되지 않음.
- 단계별 전환: 원인 확정 후 최소 수정은 Sol/Terra high, 반복 검증은 Terra medium, 상태 요약은 Luna low/medium, xhigh에서도 근거 충돌 시 Sol max.
- 상태: SKILL 세부 모델 라우팅 등록 · 앱 소스/운영 미변경.


## 2026-08-27 · 배포 후 운영 작동 확인 강제

- 태그: 배포, E2E, 인증, 작동확인, DEVICE, 완료게이트
- 사용자 지시: 모든 운영 수정은 배포 후 실제 작동 확인을 무조건 수행하고, 확인 전 완료로 보고하지 않는다.
- 관측된 실패: 음성 복구 배포는 서비스·자산 검사를 통과했지만 Chromium E2E 회원가입 완료 전 로그인 경쟁 조건으로 6/7에서 중단됨.
- 원인: 회원가입 버튼 클릭 뒤 고정 500ms만 기다려 실제 POST 완료를 보장하지 않았고 테스트 계정 고유성도 시간값에만 의존함.
- 최소 수정: PR #123에서 회원가입 POST 응답과 UI 전환을 기다리고 UUID 이메일을 사용하도록 변경. 배포 콘텐츠 검사는 pipe-safe 문자열 검사로 변경.
- 추가 이상: PR #123 병합 SHA `3d4e26f64aae6301f7a14a628218731636f429c4`의 main push에 GitHub Actions 실행이 생성되지 않음. 워크플로 미실행도 완료 차단 조건으로 기록.
- 영구 규칙: 배포→운영 Health/자산→인증→핵심 메뉴→음성/원문/번역→화상/외부음성→저장/재접속 순서의 후검사를 실행한다. 자동으로 증명하지 못한 실제 음성과 Provider 번역은 DEVICE/PROVIDER UNVERIFIED로 분리한다.
- 현재 상태: SOURCE 성공 · PR #123 CI 성공 · DEPLOY 재실행 대기 · OPERATING/DEVICE 재검증 대기.

## 2026-08-27 · PR #132–#135 · 녹음 종료 결과 모달 및 운영 E2E 근본 복구

- 태그: 결과모달, 생성패치, E2E, 관리자권한, 배포
- 증상: 운영 E2E가 녹음 종료 뒤 `#vfResultModal` 미표시로 중단됐고, 수정 후에는 다음 화면 이동과 관리자 Integration/Hub 검사에서 연속 실패함.
- 기준: 실패가 확인된 main `078e2d290d74944aae642a09711ff0424f5ce386`. 마지막 실제 기기 정상 SHA는 미확인.
- 확인된 원인:
  - `patch-in-room-result-v347.mjs`와 후속 소비자 `patch-result-ready-library-v353.mjs`가 종료 후 `state.resultModal=false`를 생성해 현재 결과 검토 화면을 숨김.
  - 앞 패치만 바꾸면 v353의 문자열 앵커가 끊겨 프런트 생성이 실패함.
  - 결과 검증 뒤 E2E가 모달을 닫지 않아 다음 홈 클릭이 오버레이에 차단됨.
  - 일반 사용자 관리자 요청의 정상 302 리다이렉트를 따라간 홈 HTTP 200을 관리자 HTML로 오판함.
- 실패한 접근: v347 한 파일의 상태값만 변경. 후속 v353 앵커가 `v353_anchor_missing:fast-completed-tools`로 실패하여 병합하지 않음.
- 최종 최소 수정:
  - PR #132: v347과 v353의 종료 상태를 함께 `resultModal=true`로 정렬하고 최종 생성 자산 계약검사 추가.
  - PR #133: 결과 모달 검증 뒤 닫기와 DOM 제거를 확인.
  - PR #134–#135: 캐시 진단을 추가한 뒤 실제 원인을 권한 경계로 확정하고, 공개 관리자 접근 차단과 내부 UI 자산 검사를 분리.
- 최종 복구점: 앱 수정 병합 `566012b6452860e0366f90a1cad5d95a41cc9acd`; 전체 운영검사 병합 `1f4087ccd342618be849a3e29da540fceb7c0eeb`.
- 단계별 상태:
  - SOURCE PASS · PR #132–#135 병합.
  - CI PASS · 테스트, 문법, 프런트 생성·UI 계약.
  - DOCKER PASS · 운영 이미지 빌드.
  - DEPLOY PASS · GitHub Actions run `33069621850`, attempt 14, deploy job `98597092306`.
  - OPERATING PASS · 모든 런타임 Health/페이지/Integration Hub 및 Chromium E2E `18/18 PASS`.
  - DEVICE UNVERIFIED · 실제 PC/Android 마이크 음성→원문→선택 언어 번역은 별도 실기기 증거 없음.
  - PROVIDER BLOCKED · Gemini/OpenAI/DeepL 미구성 상태이며 실제 번역 응답은 PASS로 판정하지 않음.
- 재발 방지:
  - 생성 패치의 앞 출력 변경 시 뒤 앵커와 최종 `public/app.js`를 함께 검증.
  - 모달 시나리오는 열기→필수 컨트롤→닫기→DOM 제거를 한 계약으로 유지.
  - 보호 페이지는 권한 응답과 정적 UI 자산을 분리하고 리다이렉트 결과를 UI 성공으로 사용하지 않음.

## 2026-08-27 · PR #137 · 이전 암호화 키 호환 가설 검증과 Secret 복구 경계 확정

- 태그: 번역, STT, 외부음성, Provider, Secret, 배포, 가설기각
- 증상: 운영 저장소에 Provider Secret 이름은 존재하지만 배포 사전검사가 Gemini/OpenAI/DeepL을 모두 `not-configured`로 판정해 실제 번역과 외부음성 서버 STT를 실행할 Provider가 없음.
- 기준: 앱 운영검사 정상 SHA `1f4087ccd342618be849a3e29da540fceb7c0eeb`. 이 기준도 Provider는 `BLOCKED`였으며 실제 PC/Android 음성은 `DEVICE UNVERIFIED`였음.
- 검증 가설: 기존 암호문이 과거 `GOOGLE_DRIVE_TOKEN_SECRET`로 저장된 뒤 `INTEGRATION_SECRET_KEY` 우선순위에 가려졌을 가능성.
- 최소 수정: PR #137에서 새 저장은 현재 키만 유지하고, 읽기는 현재 키 복호화 실패 시 구성된 과거 Google Drive 키를 한 번 더 시도. 과거 키 암호문 회귀검사 추가. Secret 값·DB·DNS는 변경하지 않음.
- 운영 결과: 배포가 실제 main `c341d7186aff91a0f418471b1f1311ecc4519d29`를 체크아웃했지만 Provider 사전검사는 다시 `gemini:not-configured`, `openai:not-configured`, `deepl:not-configured`. 따라서 위 가설만으로는 복구되지 않았으며 알려진 두 키 후보 어느 쪽에서도 사용 가능한 Provider 값을 얻지 못함.
- 단계별 상태:
  - SOURCE PASS · PR #137 병합.
  - CI PASS · provider router 및 이전 키 복호화 회귀검사 포함.
  - DOCKER PASS.
  - DEPLOY PASS · GitHub Actions run `33069621850`, attempt 15, deploy job `98602476577`.
  - OPERATING PASS · Health/서비스/자산 및 Chromium E2E `18/18 PASS`.
  - PROVIDER BLOCKED · 실제 번역 Provider 실응답 없음.
  - DEVICE UNVERIFIED · PC/Android 마이크 음성→원문→번역 및 PC 시스템 오디오 공유 입력 미검증. 모바일 PWA 시스템 오디오 캡처는 지원 대상 아님.
- 실패한 접근: 알려진 이전 Google Drive 키 fallback만으로 기존 Provider 암호문을 복구하려 한 시도. 운영 실응답 검사에서 가설이 기각되어 추가 코드 패치를 중단함.
- 확정된 다음 경계: 정확한 역사적 암호화 키를 운영 Secret 저장소에서 복구하거나, 관리자가 Provider 한 곳의 키를 관리자 화면에서 다시 저장한 뒤 실응답 사전검사와 전체 운영 E2E를 재실행해야 함. Secret을 채팅으로 받거나 자동 생성·덮어쓰지 않음.
- 재발 방지: Secret 이름/암호문 존재와 복호화 가능한 구성을 분리하고, 키 변경은 성공한 복호화 뒤 명시적 이관으로 처리. 모든 알려진 키 후보 실패 시 `SECRET RECOVERY REQUIRED`로 중단하고 같은 유형의 코드 패치를 반복하지 않음.

## 2026-08-28 · PR #139 · Android Chrome 무결과 서버 STT 전환 복원 준비

- 태그: STT, 모바일, Provider, 회귀, 배포차단
- DEVICE 증상: Samsung Chrome에서 회의방 진입, 마이크 권한, 녹음 타이머, 주변 소음 감지는 작동했으나 15초 동안 원문과 베트남어 번역이 생성되지 않음.
- 정상 소스 후보: `632b042cbe2f4eceb0ac147ebede228fa4ad00c1`. 실제 DEVICE Golden 증거는 불명확하므로 SOURCE 후보로만 사용.
- 최초 회귀: PR #122 병합 `3973b0d4d177ca0e36f5c48bed6d108ddeba2234`가 모바일 4.5초 무결과 시 `startServerSpeechFallback()` 호출을 제거하고 `state.media.stt='listening'` 상태만 유지함.
- 회귀검사 증거: fallback 계약을 먼저 추가한 CI run `33136275396`은 `npm test`에서 의도대로 실패.
- 최소 복원: PR #139에서 기존 `_mobileSpeechFastFallback=true → startServerSpeechFallback() → stt='server'` 단일 전환을 복구하고 최종 생성 `public/app.js` 계약검사를 반대로 고정. UI·화상·채팅·DB·DNS·Secret은 변경하지 않음.
- 단계별 상태:
  - SOURCE PASS · PR #139 head `1766cf3172c2c997ce9be229c640b210599f0786`.
  - CI PASS · run `33136372007`, npm test·문법·프런트 생성 계약 성공.
  - DOCKER PASS · 같은 run의 production image build 성공.
  - DEPLOY BLOCKED · 중앙 Provider 실응답 불가 상태이므로 운영 미배포.
  - OPERATING FAIL · 현재 운영 main `394e381dbd5633d32d4a3f6cf1d62ae1244d8dd6`은 모바일 listening-only 코드 유지.
  - DEVICE Android FAIL · 음성 신호 감지 후 원문·번역 미생성.
  - DEVICE PC UNVERIFIED · 실제 PC 마이크 원문 생성은 별도 실기기 증거 없음.
  - PROVIDER BLOCKED · 중앙 Integration Hub의 OpenAI·Gemini·Claude 항목은 모두 `has_credential=false`, VoiceFlow 소비자 연결 0건.
- 배포 재개 조건: 중앙 Hub에 Provider 자격정보를 한 번만 안전하게 등록하고 VoiceFlow consumer/binding을 연결한 뒤, Provider 실응답 성공을 확인해야 함. 앱별 관리자 Secret 재등록이나 채팅을 통한 Secret 전달은 금지.
- 배포 후 완료 조건: Android Chrome과 PC Chrome/Edge를 분리해 실제 음성 → 원문 → 선택 언어 번역을 확인하고 기존 운영 E2E를 함께 통과해야 함.
- 롤백: 운영은 변경하지 않았으며 현재 운영 복구점은 `1f4087ccd342618be849a3e29da540fceb7c0eeb`.


## 2026-08-28 · PR #141 · 중앙 Provider Hub 연결 준비와 RLS 잠금

- 태그: Provider Hub, Supabase Vault, RLS, STT, 번역, 배포차단
- 사용자 확인: 기존 OpenAI Project API Keys 화면에는 활성 키 3개가 보이지만 값은 마스킹되어 기존 전체 Secret을 다시 읽을 수 없음. 기존 키를 삭제하지 않음.
- 잘못된 이전 안내: `deploy.star45.net/meeting-admin`은 중앙 Provider Hub 등록 화면이 아니며 로그인 라우트에도 입력 폼이 없었음. 해당 경로를 Provider 등록 경로로 사용하지 않음.
- 중앙 Hub 복구:
  - `integration_hub` 20개 테이블 모두 RLS 활성화.
  - `anon`/`authenticated` 직접 테이블 권한 0건. 브라우저는 인증된 Edge Function만 사용.
  - Integration Hub v9에서 OpenAI 선택 필드를 필수로 오판하던 검증을 수정하고 PROJECT 소비자 생성 시 resolver binding도 함께 생성.
  - Provider Hub Admin v1 등록 화면과 Worker Credential Resolver v2 배포. Resolver는 tenant/scope/provider 허용목록 및 앱 토큰 해시를 요구하며 기존 platform worker 인증은 유지.
- VoiceFlow 최소 연결: PR #141에서 로컬 정상 키를 우선하고 없을 때만 중앙 Hub를 조회하는 런타임 hydration, 60초 실패 backoff, 토큰/Provider 값 비노출 회귀검사, core/AI compose 설정을 추가.
- 단계별 상태:
  - HUB RLS PASS · 20/20 RLS, direct grants 0.
  - HUB OPERATING PASS · Admin health HTTP 200, Resolver invalid token HTTP 401, Integration Hub v9/Resolver v2 ACTIVE.
  - SOURCE PASS · VoiceFlow PR #141 병합 `c94b672f3060009d7a275234e743f3a1ab9d3666`.
  - CI PASS · run `33146281664`, 전체 npm test·문법·프런트 생성 계약.
  - DOCKER PASS · 같은 run production image build.
  - DEPLOY BLOCKED · VoiceFlow 앱 전용 Hub 접근 토큰 생성·운영 저장은 RLS 승인과 별도 Secret 변경이며 승인 없음.
  - PROVIDER BLOCKED · 중앙 OpenAI/Gemini 자격증명이 아직 등록되지 않아 실응답 없음.
  - DEVICE PC/Android UNVERIFIED · 실제 음성→원문→선택 언어 번역 미검증.
- 중앙 소스 추적: Deployment Center PR #48에 RLS migration과 세 Edge Function 소스를 기록. 기존 frontend 전용 GitHub-hosted 두 검사는 job step이 생성되기 전에 인프라 실패하여 런타임 검증과 분리.
- 재개 조건: 앱 전용 Hub 토큰 생성·VoiceFlow 서버 저장 승인을 받은 뒤 중앙 권한 해시를 등록하고 배포. 관리자가 중앙 Hub 화면에서 OpenAI 전체 Secret을 한 번 입력하면 Provider 실응답, PC, Android를 분리 검증.
- 금지: 마스킹된 OpenAI 키 복구 시도, 채팅으로 Secret 전달, 서비스 역할 키를 VoiceFlow에 배포, 기존 OpenAI 키 삭제.


## 2026-08-28 · Deployment Center PR #49 · Provider Hub HTML 원문 표시 복구

- 태그: Provider Hub, UI, Content-Type, 배포, PC, 모바일
- 증상: Supabase Edge Function URL을 브라우저에서 열면 Provider Hub 화면 대신 HTML 원문과 깨진 한글이 표시됨.
- 정확한 원인: Supabase 기본 Edge Function 도메인은 공식 제한상 GET의 `text/html` 응답을 `text/plain`으로 강제 변환함. 헤더 누락이나 HTML 인코딩 결함이 아니었음.
- 최소 복구:
  - 실제 화면을 Deployment Center 웹앱의 `/provider-hub` React 라우트로 이동.
  - 사이드 메뉴에 Provider Hub 진입점 추가.
  - 기존 Edge Function 주소는 새 웹 경로로 302 전환해 이미 전달된 링크도 복구.
  - Supabase는 Auth, Integration Hub API, Vault, Provider 실응답 검사만 담당.
- 단계별 상태:
  - SOURCE PASS · Deployment Center PR #49 병합 `c3fb0132f968db18523e04dd951fc4daedc279eb`.
  - FRONTEND BUILD PASS · Actions run `33150986950`.
  - BROWSER E2E PASS · 같은 run의 기존 Project Control/Guide Center 브라우저 검사.
  - DEPLOY PASS · Actions run `33151082432`, syntax/smoke/build/health 전 단계 성공.
  - OPERATING PC PASS · `https://deploy.star45.net/provider-hub` GET 200, `text/html; charset=utf-8`, 실제 브라우저 DOM에서 한글 제목·관리자 로그인·이메일·비밀번호·로그인 버튼 확인.
  - OLD LINK PASS · `star45-provider-hub-admin` v2가 새 경로로 HTTP 302.
  - MOBILE SOURCE PASS · 단일 열·반응형 버튼 레이아웃 포함 및 프런트 빌드 성공.
  - MOBILE DEVICE UNVERIFIED · 실제 Android 화면 터치·로그인은 별도 실기기 증거 없음.
  - PROVIDER BLOCKED · API Key와 VoiceFlow 앱 토큰 미등록으로 Provider 실응답·음성→원문→번역 미검증.
- 재발 방지: Supabase 기본 Edge Function URL을 HTML 화면 주소로 안내하지 않음. Edge Function은 API/redirect만 제공하고 사용자 화면은 정적/웹앱 도메인에서 제공.

## 2026-08-28 · PR #144–#145 · VoiceFlow 전용 Hub 토큰 생성·권한 연결

- 태그: Provider Hub, 앱 토큰, RLS, 배포, PC, 모바일, Provider 차단
- 승인 범위: VoiceFlow 앱 전용 Hub 토큰 생성과 운영 서버 저장. Provider API Secret 생성·변경·삭제는 승인 범위에 포함하지 않음.
- 정확한 추가 원인: VoiceFlow compose 기본 tenant가 `star45`였으나 중앙 Integration Hub의 tenant는 `STAR45`여서 토큰이 있어도 resolver 조회가 일치하지 않을 수 있었음.
- 최소 수정:
  - PR #144에서 운영 서버 최초 배포 시 32바이트 앱 토큰을 생성하고 `.env` 권한을 `0600`으로 고정. 재배포 시 기존 토큰 재사용.
  - 토큰 원문은 GitHub·CI·로그·DB에 남기지 않고 중앙 `permissions`에는 SHA-256 해시만 등록.
  - tenant를 `STAR45`, scope를 `meeting`, 허용 Provider를 OpenAI/Gemini/DeepL로 제한.
  - PR #145에서 운영 배포 중 실제 resolver 인증을 검사. 인증 401은 배포 실패, 인증 통과 뒤 중앙 Provider 자격정보 부재는 별도 BLOCKED로 판정.
- 단계별 상태:
  - SOURCE PASS · PR #144 병합 `5394b4cc658f53b409c55ec704c9da6178c07463`, PR #145 병합 `34012ba09a14f8e749e8383bb657b48c81afb65b`.
  - CI PASS · PR run `33153062130`, `33153526655`; 토큰 생성·0600·재사용·비노출·인증 경계 회귀검사.
  - DOCKER PASS · 두 PR의 production image build.
  - DEPLOY PASS · main run `33153655565`, deploy job `98791595655`.
  - HUB AUTH PASS · 서버 토큰 재사용 확인 및 `PROVIDER_HUB_AUTH_PASS`; 중앙 해시 권한과 tenant/scope/provider 제한 일치.
  - OPERATING PC AUTOMATED PASS · Chromium 운영 E2E `18/18 PASS`, Health/회의/녹음/결과/Hub UI 정상.
  - OPERATING MOBILE AUTOMATED PASS · 모바일 자산, 단일 하단 메뉴, 음성방 overflow, 서버 STT fallback 계약 PASS.
  - PROVIDER BLOCKED · resolver 인증은 성공했으나 OpenAI 중앙 credential/binding이 없어 `integration_not_resolved`. 마스킹된 기존 OpenAI 키 원문은 복구할 수 없음.
  - DEVICE PC UNVERIFIED · 실제 PC 마이크/시스템 오디오 → 원문 → 번역은 중앙 Provider 등록 전 실검증 불가.
  - DEVICE Android UNVERIFIED/BLOCKED · 실제 Samsung 음성 입력의 원문·번역은 중앙 Provider 등록 전 재검증 불가.
- 다음 단일 조치: 실제 Provider Hub `https://deploy.star45.net/provider-hub`에서 기존에 안전하게 보관한 OpenAI 전체 Secret을 한 번 등록하거나, 전체 Secret을 보유하지 않았다면 기존 키를 삭제하지 않고 새 Secret을 생성해 Hub에 등록. 이후 Provider 실응답과 PC/Android 실음성을 분리 검증.
- 금지: 앱 토큰 원문 기록, 마스킹된 OpenAI 키 복원 시도, 기존 OpenAI 키 삭제, 서비스 역할 키의 앱 배포.

## 2026-08-28 · 외부회의 음성 도입 전후 비교 및 현재 Provider 결제 차단

- 태그: 외부음성, STT, 번역, 마이크, 생성패치, Provider, quota, 비용관측, 회귀분석
- 비교 기준:
  - 외부음성 직전 정상 소스 후보 `632b042cbe2f4eceb0ac147ebede228fa4ad00c1` (PR #103). 실제 DEVICE Golden은 미확인.
  - 최초 위험 변경 `cfd2b6f667d8d99a7cf7f5388aa5d65d87759712`: 외부 앱 오디오 캡처를 기존 생성 패치 체인 끝에 삽입.
  - 현재 소스 `f3177aca8a0193de608f113f3ec1cbc36c5736ce`: 중앙 Hub 자격정보를 이용한 실제 음성/번역 Provider 검증을 배포 게이트로 고정.
- 확인된 구조 원인:
  - 외부음성이 독립 어댑터가 아니라 순서 의존 문자열 치환으로 생성되는 단일 `public/app.js`에 결합됨.
  - 기존 `state.media`, `MediaRecorder`, 전체 `render()`, `/transcribe`, `postCaption()`을 공유해 핵심 마이크·렌더·번역 소비자까지 영향 범위가 확장됨.
  - 초기 검사는 버튼·문자열·호출 표식 중심이어서 실제 스마트폰 음성→원문과 직접입력→번역 결과를 보장하지 못함.
  - 직후 Android 브라우저 STT와 서버 MediaRecorder가 경쟁했고, UI 앵커/배포 표식 불일치와 핵심 경로 복원 PR이 연속 발생함.
- 현재 별도 원인: 중앙 Hub 인증과 OpenAI credential resolution은 성공했으나 실제 OpenAI 호출이 `quota exceeded`로 실패. 이는 외부음성 코드 회귀가 아니라 `PROVIDER BILLING BLOCKED`다.
- 실패한 접근: Provider 미구성/실패를 경고로 낮춰 핵심 배포를 진행한 방식은 배포 자산 성공과 실제 번역 성공의 차이를 숨겼다.
- 재발 방지:
  - 변경 전 `Golden → 직전 → 후보 → 운영` SHA와 동일 시나리오 결과를 비교한다.
  - 마이크, 화면 오디오, MediaRecorder, `state.media`, 전체 render, caption/translation API의 단일 소유자를 영향표에 기록한다.
  - Provider credential/binding/live/auth/model/quota/usage/cost를 기본 장애분석 체크로 분리한다.
  - quota/billing이면 코드 패치를 중단하고 결제 복구 후 같은 바이너리로 실응답을 재검증한다.
- 상태: SOURCE 비교 PASS · 근본 구조 원인 PASS · 현재 Provider 결제 원인 PASS · HUB 비용관측 설계 진행 · DEPLOY 미실행 · DEVICE 스마트폰 FAIL 유지.

## 2026-08-28 · 기존 정상 구현 우선 기본방침 확정

- 태그: 기존방식, Golden, 업그레이드, 비용, 승인, 기본경로
- 사용자 지시: 품질 개선·업그레이드를 명시적으로 요청한 경우에만 새 방식을 비교·추천한다. 그 외 오류 수정과 정상화는 실제로 잘 작동한 기존 구현을 기준으로 한다.
- 발생한 문제: 모바일 원문 복구 과정에서 기존 브라우저 STT를 유지하지 않고 서버 STT와 중앙 OpenAI 호출을 자동 fallback으로 승격해 시간·비용·운영 의존성을 늘렸으나 문제를 해결하지 못함.
- 기본방침:
  - 복구 요청은 마지막 DEVICE 정상 구현의 최소 복원만 허용한다.
  - 신규 방식·새 Provider·유료 API·우회 경로·자동 fallback은 기본 금지한다.
  - 명시적 업그레이드 요청이 있어도 기존 경로를 유지하고 후보를 기본 OFF로 분리한다.
  - 정확도·지연·비용·영향·복구를 사전 비교해 보고하고 사용자 승인 후에만 기본값 전환을 허용한다.
  - 후보가 기존 기능 하나라도 악화시키거나 비용/운영 의존성이 불명확하면 적용하지 않는다.
- 회피 규칙: 결제 가능한 API Key가 있다는 이유만으로 브라우저·로컬 정상 경로를 교체하지 않는다. 오류 복구와 품질 업그레이드를 같은 PR이나 배포에 섞지 않는다.
- 상태: SKILL 반영 · 운영 코드/DB/DNS/Secret 미변경 · 기존 음성 경로 복구는 별도 작업 대기.

## 2026-08-28 · 스마트폰 브라우저 STT 단독 경로 최소 복원

- 태그: 모바일, STT, 기존방식, 비용, Provider, 최소복원
- 기준: PR #110 `b6a2225`의 모바일 브라우저 STT 단독 유지. 80ms 재시작은 경고음 반복 위험이 확인되어 후속 정상화 `cc419f0`의 350ms 지연을 유지.
- 현재 실패 원인: 4.5초 무결과 watchdog과 `onend`가 서버 STT를 자동 시작하고 중앙 Hub OpenAI 자격정보를 core에 주입해, 기존 브라우저 경로가 유료 Provider 의존 경로로 자동 전환됨.
- 최소 복원:
  - 모바일 watchdog은 `listening` 상태만 유지하고 서버 STT를 호출하지 않음.
  - 브라우저 STT 종료 시 350ms 후 같은 기존 STT만 재시작.
  - VoiceFlow core에서 Hub Provider 자동 hydration 환경을 제거하되 AI 서비스의 명시적 Hub 연결은 유지.
  - 배포 Provider 실응답 검사는 로컬 Provider가 명시적으로 구성된 경우만 실행하며 브라우저 core 배포를 차단하지 않음.
- 보호 범위: UI·화상·채팅·DB·DNS·Secret·Hub 저장 자격정보 미변경. 외부음성 코드는 수정하지 않음.
- 상태: SOURCE PASS · 핵심/화상/외부음성 계약 PASS · Docker 로컬 도구 부재로 UNVERIFIED · CI/DEPLOY/OPERATING/DEVICE 대기.
- 완료 기준: 운영 배포 후 Samsung Chrome에서 경고음 반복 없이 한국어 음성 원문 생성. 번역·PC·저장·재접속은 다음 단계로 분리.


## 2026-08-28 · CI #845 · 취소로 중단된 전체 스택 운영 복구

- 태그: 502, CI, 배포, 전체이미지복구, 취소, 롤백
- 증상: 운영 `https://voice.star45.net`이 Nginx 502. 취소된 CI #838 이전에는 gateway가 존재했으나 복구 스크립트 실행 중 전체 compose stack이 내려감.
- 최초 실패 지점: CI #838이 2026-08-28 12:13 UTC `[RUNTIME] stop current compose stack cleanly` 이후 gateway/identity를 중지했고, `[RUNTIME] start full production stack` 전에 사용자 중단으로 취소됨. 취소 경로에 전체 stack 재기동 trap이 없어 502가 지속됨.
- 복구 기준: 백업 태그 `backup-pre-632b042-rollback-20260828` → `9714fc46c27c28afe6c61ba38253716fe9a30144`. 복구 커밋 `2ae49c459cc35179cb4e4f984ed9077d53511831`과 소스 트리 동일. `632b042cbe2f4eceb0ac147ebede228fa4ad00c1`은 DEVICE Golden으로 사용하지 않음.
- 실행: 애플리케이션 파일 변경 없이 empty 배포 트리거 `efb70b2317c4f5c37432b1ebd2bf454b48b6a0e1` 생성. DB·DNS·Secret 값은 변경하지 않음.
- 단계별 상태:
  - SOURCE PASS · 배포 트리거의 파일 변경 0건.
  - CI PASS · VoiceFlow CI #845 test 성공.
  - DOCKER PASS · 이미지 `voiceflow-smart-workspace:v2.6`, manifest list `sha256:06ffa3c1b694e68ec13e80b7ea063a552657f05238fe20d2ad93452c700096cc`.
  - DEPLOY PASS · Actions run `33172256249`, deploy job `98852381040`.
  - OPERATING PASS · 13개 컨테이너 Up, 전체 runtime health 응답, local/public version 2.6.2, Chromium E2E 18/18 PASS.
  - DEVICE UNVERIFIED · 복구 후 PC/Android 실제 마이크 음성→원문→선택 언어 번역은 미확인. 복구 전 Android 실패를 성공으로 바꾸지 않음.
  - PROVIDER UNVERIFIED · 이번 복구는 Provider 설정·Secret을 변경하거나 실제 번역 실응답을 증명하지 않음.
- 영향·비용·위험: 전체 stack 교체로 진행 중 세션이 끊기며 이번 관측상 stop부터 gateway start까지 약 55초. 추가 인프라 구매 없음; CI/이미지 빌드 시간과 짧은 중단 비용만 발생. 영속 DB/운영 데이터는 변경하지 않음.
- 롤백: 문제 발생 시 신규 기능 추가 없이 백업 태그의 동일 소스 트리와 마지막 운영 정상 이미지 manifest `sha256:312a08127f37fc29581fd42711198006fe0cc4b1b83f784e6531d4aa55b75ac3`를 기준으로 전체 stack 재배포 후 health/E2E/실기기를 다시 분리 검증.
- 재발 방지 제안: compose down 이후 취소·오류 시 마지막 정상 stack을 자동 재기동하는 rollback trap을 별도 최소 변경으로 검토. 사용자 승인 전 구현하지 않음.


## 2026-08-28 · PR #166 · 외부회의 음성 도입 직전 입력·출력 경로 복원

- 태그: 외부음성, STT, 번역, 모바일, PC, Golden, 최소롤백
- 사용자 DEVICE 증거: 외부회의 음성 받기 기능 도입 전에는 스마트폰과 PC의 입력·출력 기능 문제가 없었다고 2026-08-28 확인. 이 확인에 따라 외부음성 직전 `632b042cbe2f4eceb0ac147ebede228fa4ad00c1`을 이번 복구의 사용자 확인 Golden 기준으로 승격.
- 최초 실패 변경: `cfd2b6f667d8d99a7cf7f5388aa5d65d87759712`. Golden보다 정확히 1커밋 뒤이며 외부음성 패치·CSS·생성 연결·CI 계약 6개 파일을 추가함.
- 증상: Samsung 브라우저 운영 홈에 `외부 회의 음성 받기`가 노출되고, 이후 스마트폰 음성 원문·번역 및 채팅 입력 번역 장애가 반복됨.
- 확인 원인 범위: 외부음성 패치가 기존 `state.media`, `MediaRecorder`, 전체 render, `/transcribe`, `postCaption()`을 직접 공유해 핵심 입력·출력 경로와 격리되지 않음.
- 최소 복원:
  - 저장소 전체를 과거로 되돌리지 않고 외부음성 패치 호출과 132줄 패치 파일·CSS만 제거.
  - 최종 생성 앱을 외부음성 직전 `APP_VERSION='3.5.9'`로 복원.
  - CI·운영 배포에서 `externalAudioStart`, `externalAudioToggle`, `postCaption(text,'external-audio')`가 다시 나타나면 실패하도록 계약을 반전.
  - 현재 배포 안전장치·조직·저장·DB·DNS·Secret·Provider 설정은 유지.
- 실패한 검사와 수정: PR CI #847에서 후속 `deploy-runtime-guard.test.mjs`가 제거된 외부음성 성공 문구를 계속 요구해 최초 실패. 앱 코드는 수정하지 않고 이 후속 소비자 1줄만 외부음성 부재 계약으로 정렬. CI #848 성공.
- 단계별 상태:
  - SOURCE PASS · PR #166, 7개 파일의 외부음성 제거/회귀 차단만 변경.
  - CI PASS · PR #848 및 운영 CI #849.
  - DOCKER PASS · 운영 이미지 `voiceflow-smart-workspace:v2.6`, manifest list `sha256:13676322f0bfd1dfe8b510a390cec1b61ed1f2efa8d91785c08e35f51aaf334f`.
  - DEPLOY PASS · 운영 SHA `01a0b3e932f6bb6cd9fe809b3855564b096a4ffd`, Actions run `33173588955`, deploy job `98856875611`.
  - OPERATING PASS · 13개 컨테이너 시작, 전체 runtime health, local/public version 2.6.2, 외부음성 부재 계약, Chromium E2E 18/18, persistence PASS.
  - DEVICE BASELINE PASS · 주인님이 외부음성 도입 전 PC·스마트폰 입력·출력 정상 확인.
  - DEVICE CANDIDATE UNVERIFIED · 이번 운영 복원본의 Samsung/PC 실제 음성→원문→번역과 채팅 입력 번역은 배포 후 실기기 확인 대기.
  - PROVIDER UNVERIFIED · Provider Secret·설정·결제 상태는 이번 롤백에서 변경하거나 실응답 검증하지 않음.
- 운영 중단: stack stop 13:04:06 UTC, gateway start 13:05:10 UTC로 약 64초.
- 롤백: 예상 밖 회귀 시 직전 운영 SHA `efb70b2317c4f5c37432b1ebd2bf454b48b6a0e1` 및 이미지 `sha256:06ffa3c1b694e68ec13e80b7ea063a552657f05238fe20d2ad93452c700096cc`로 전체 stack 재배포.
- 재발 방지: 핵심 음성→원문→번역이 실제 기기에서 다시 PASS하기 전 외부음성·새 Provider·새 입력 경로를 재도입하지 않음. 같은 증상 재발 시 추가 패치를 중단하고 `632b042`과 현재 후보를 동일 기기 시나리오로 비교.


## 2026-08-28 · 실제 성공 운영본 기반 음성·번역 핵심 복구 후보

- 태그: STT, 번역, 모바일, PC, Provider Hub, Golden, 복구
- 실제 운영 Golden: `b98dcdd6d5b97f18fd3d5fc960817b3f50959740`. Actions run `32926323490`에서 Core/UI/Health와 실제 DeepL 번역 응답이 모두 PASS.
- 소스 경계: 외부회의 음성 직전 `632b042cbe2f4eceb0ac147ebede228fa4ad00c1`; 해당 SHA의 운영 배포는 실패 후 이전 컨테이너 파일로 롤백되어 실제 운영 Golden으로 사용하지 않음.
- 현재 증상: Samsung 브라우저 음성 원문 미생성, 직접입력 및 음성 번역 미생성.
- 확인 원인:
  - 모바일 4.5초 무결과 감시가 마지막 성공 경로의 단일 서버 STT 전환 대신 listening-only 상태를 유지함.
  - Provider Hub hydration은 환경변수에 자격정보를 주입하지만 Provider adapter가 암호화 저장소만 읽어 Core STT/번역이 Hub 자격정보를 사용하지 못함.
  - 배포 사전검사가 실제 Provider 실패를 경고로 낮춰 운영 교체를 계속 허용함.
- 최소 복원 후보:
  - `632b042`의 기존 모바일 `_mobileSpeechFastFallback → startServerSpeechFallback → stt=server` 경로 재사용.
  - 기존 승인·구현된 Provider Hub 환경을 Core에 전달하고 adapter가 저장소 우선, 런타임 환경 fallback으로 읽도록 연결.
  - 컨테이너 교체 전에 실제 번역이 원문과 다른지 검증하고 실패 시 배포 중단.
- 보호 범위: 외부음성 재도입 없음. DB·DNS·Secret 값·조직·NFC·업무·관리자 데이터 미변경.
- 단계별 상태:
  - SOURCE PASS · PR #167 병합 SHA `9752fc7f8e132d1c4e60b144c9b00282377a394d`.
  - CI PASS · PR run `33185037816`과 main run `33185249770`의 npm test·문법·프런트 생성 계약 성공.
  - DOCKER PASS · 두 run의 production image build 성공.
  - PROVIDER HUB AUTH PASS · VoiceFlow 앱 토큰 재사용, OpenAI credential resolution 성공. 값은 기록하지 않음.
  - PROVIDER BILLING BLOCKED · 실제 OpenAI 번역 호출이 quota/billing 초과로 실패. Gemini·DeepL은 미등록.
  - DEPLOY BLOCKED/SAFE · run `33185249770`, deploy job `98896942301`이 전체 stack 중지 전 12% Provider 사전검사에서 중단. 운영 중단 없음.
  - OPERATING UNCHANGED · 운영 SHA `01a0b3e932f6bb6cd9fe809b3855564b096a4ffd`, 이미지 `sha256:13676322f0bfd1dfe8b510a390cec1b61ed1f2efa8d91785c08e35f51aaf334f` 유지.
  - DEVICE Samsung FAIL 유지 · 현재 운영본 음성 원문·번역 미생성.
  - DEVICE PC UNVERIFIED · 복구 후보 미배포로 실기기 검증 미실행.
- 실패 시점: `PROVIDER_HUB_AUTH_PASS` 다음 실제 번역 요청에서 OpenAI quota/billing 초과. 코드·인증·Secret 판독 실패와 분리.
- 재개 조건: OpenAI 프로젝트의 결제/한도 복구 또는 승인된 Provider Hub에 Gemini/DeepL 중 하나를 등록한 뒤 같은 SHA의 실패한 배포 job만 재실행. 추가 코드 패치 금지.
- 롤백: 운영 이상 시 현재 운영 SHA `01a0b3e932f6bb6cd9fe809b3855564b096a4ffd`, 이미지 `sha256:13676322f0bfd1dfe8b510a390cec1b61ed1f2efa8d91785c08e35f51aaf334f`로 전체 stack 복구.


## 2026-08-28 · DeepL 저장 표시와 실제 Secret 복구 불가 확정

- 태그: DeepL, 번역, Secret, Golden, 배포, 복구
- 사용자 증거: VoiceFlow 관리자 화면의 Translation → DeepL 카드가 `연결됨`, `API Key: 저장됨`으로 표시됨.
- 화면 출처 확인: 첨부 화면 문구는 VoiceFlow `public/provider-setup-guides.js`, `public/admin-integrations.js`, `public/admin-integrations-ux.js`에서 생성됨. Deployment Center Meeting Provider 화면이 아님.
- 실제 의미: 관리자 화면의 저장 표시는 `integration-secrets.json`의 Secret 이름/암호문 존재를 기준으로 하며 현재 암호화 키로 원문을 복호화할 수 있는지 증명하지 않음.
- 실제 Golden: `b98dcdd6d5b97f18fd3d5fc960817b3f50959740`, Actions run `32926323490`. 당시 실행 컨테이너 환경을 비노출로 재사용해 DeepL 실제 번역이 PASS.
- 최초 잘못된 복구 시도:
  - PR #168 / main `4c2f16652caef094ff2f4b9e8fe55f7d655ccd26`에서 화면 저장소를 Deployment Center로 오판.
  - run `33189800435`이 `Existing Deployment Center DeepL connection was not uniquely resolvable` 후 실제 번역 게이트에서 중단.
  - 운영 stack 중지·교체 전 실패하여 OPERATING 변경 없음.
- Golden 방식 재검증:
  - PR #169 / main `4a2b2c611676c76822439f0b3a1941275a6e3300`에서 Golden의 `voiceflow-ai-v26` / `voiceflow-admin-integrations-v26` Provider 환경 handoff를 정확히 복원.
  - run `33190372760`에서 현재 컨테이너에 DeepL 값이 없어 `deepl:not-configured`로 배포 전 중단.
- 제한된 기존 Secret 복구 검사:
  - PR #171 / main `141934d50b23416469ee0dbe3f1a20658a6bb6db`.
  - VoiceFlow 프로젝트의 `.env` 계열 백업, 실행·중지 `voiceflow-*` 컨테이너 환경, 현재 알려진 Integration 암호화 키 후보만 읽기 전용으로 검사.
  - Secret 값·해시·파일명은 로그에 기록하지 않고 서로 다른 후보가 정확히 1개일 때만 실제 번역 게이트로 전달하도록 구현·검사.
  - main run `33191113479`: SOURCE/CI/DOCKER PASS, 복구 결과 `existing-key-not-recoverable`, `candidateCount: 0`; 실제 번역 게이트에서 `deepl:not-configured`로 DEPLOY 차단.
- 확정 원인: DeepL 암호문/이름은 남아 있으나 이를 복호화할 과거 키 또는 직접 DeepL 원문이 제한된 기존 운영 복구 소스에 남아 있지 않음. DeepL 계정의 키 자체가 폐기됐는지는 원문 부재로 UNVERIFIED.
- OpenAI 분리: 중앙 OpenAI 인증은 되지만 quota/billing 초과. 기존 무료 운영 Golden은 DeepL을 사용했으므로 OpenAI 결제는 이번 복구 조건이 아님.
- 단계별 상태:
  - SOURCE PASS · Golden handoff와 비노출 기존 Secret 복구기 및 회귀검사 반영.
  - CI PASS · PR #169/#171 및 각 main의 테스트·문법·프런트 계약 성공.
  - DOCKER PASS · PR/main production image build 성공.
  - DEPLOY FAIL/SAFE · 세 시도 모두 실제 번역 사전검사에서 운영 교체 전 중단.
  - OPERATING UNCHANGED · 기존 운영 SHA `01a0b3e932f6bb6cd9fe809b3855564b096a4ffd`, 이미지 `sha256:13676322f0bfd1dfe8b510a390cec1b61ed1f2efa8d91785c08e35f51aaf334f` 유지.
  - PROVIDER SECRET RECOVERY REQUIRED · 기존 DeepL 전체 Authentication Key를 보유하면 새 키 발급 없이 VoiceFlow DeepL 카드에 다시 저장해야 함. 보유하지 않으면 DeepL 계정에서 현재 전체 키 확인 또는 새 키 발급이 필요.
  - DEVICE Samsung FAIL 유지 · 음성 원문·번역 미생성.
  - DEVICE PC UNVERIFIED.
- 재개 방법: DeepL 전체 Key를 VoiceFlow 자체 DeepL 카드에 한 번 다시 저장하고 카드의 실제 연결 테스트를 PASS한 뒤 run `33191113479`의 실패 배포를 재실행. Secret은 채팅·로그에 입력하지 않음.
- 롤백: 운영은 변경되지 않아 운영 롤백 불필요. 소스 복구기 제거가 필요하면 `141934d`의 5개 파일 변경만 되돌리고 Golden handoff는 유지.

## 2026-08-28 · PR #174 · DeepL 재저장 후 핵심 음성·번역 운영 복구

- 태그: DeepL, 번역, STT, 모바일, PC, Secret, 배포, Golden, 회귀검사
- 사용자 조치: VoiceFlow 자체 Translation → DeepL 카드에서 보유한 기존 DeepL Authentication Key를 다시 저장. Secret 원문은 채팅·CI 로그·원장에 기록하지 않음.
- 최초 실패 지점: 저장 표시만 남은 기존 DeepL 암호문을 현재 키로 복호화할 수 없어 배포 사전 실번역이 `deepl:not-configured`로 운영 교체 전에 차단됨. OpenAI는 별도 quota/billing 문제였으며 이번 번역 복구 경로로 사용하지 않음.
- 실제 성공 기준: 운영 Golden `b98dcdd6d5b97f18fd3d5fc960817b3f50959740`, Actions run `32926323490`의 기존 DeepL 실번역 경로를 재사용. 외부회의 음성은 재도입하지 않음.
- 재저장 후 증거:
  - 기존 VoiceFlow DeepL Secret의 비노출 복구 PASS.
  - 운영 교체 전 실제 한국어→베트남어 요청이 `provider=deepl`, `translated=true`로 PASS.
  - 실제 번역 키가 배포 프로세스 환경에 존재할 때 단위 테스트 fixture에 혼입되는 최초 실패를 확인하고, PR #174에서 테스트 환경의 Provider 변수만 제거해 격리. 앱·DB·DNS·Secret 값은 수정하지 않음.
- 단계별 상태:
  - SOURCE PASS · PR #174 병합 SHA `f70a8cfea650bae1d4d4d6dda113638f989f9f59`.
  - CI PASS · PR run `33192391240`, main run `33192571097`의 테스트·문법·프런트 생성 계약 성공.
  - DOCKER PASS · 운영 이미지 `voiceflow-smart-workspace:v2.6`, manifest list `sha256:00b3bab42cbe745181c6d07028dc15e36979b8a6c9ba3f934d9df4cb11324193`.
  - PROVIDER PASS · DeepL 실번역 응답이 원문과 다름을 운영 교체 전에 확인. 이번 번역 검증은 OpenAI 호출에 의존하지 않음.
  - DEPLOY PASS · Actions run `33192571097`, deploy job `98921983993`.
  - OPERATING PASS · 외부 도메인 HTTP 200, local/public version 2.6.2, 13개 컨테이너와 전체 runtime health PASS, Chromium E2E 18/18, persistence 포함 OVERALL 100% PASS.
  - DEVICE PC CONDITIONAL · 자동 브라우저의 홈·녹음·채팅·결과 흐름은 PASS, 실제 PC 마이크 음성→원문→선택 언어 번역은 사용자 확인 대기.
  - DEVICE Samsung CONDITIONAL · 모바일 UI·음성방·서버 STT 계약은 PASS, 실제 Samsung 마이크 음성→원문→번역과 채팅 입력 번역은 사용자 확인 대기.
- 운영 중단: stack stop부터 gateway start까지 약 45초. DB·DNS는 변경하지 않음.
- 비용: 신규 인프라 구매 없음. OpenAI 결제를 복구 조건으로 사용하지 않았고 실제 번역 Provider는 DeepL. DeepL 계정의 사용량·요금은 계정 플랜에 따르므로 별도 확인 전 무료로 단정하지 않음.
- 롤백: 예상 밖 회귀 시 직전 운영 SHA `01a0b3e932f6bb6cd9fe809b3855564b096a4ffd`, 이미지 `sha256:13676322f0bfd1dfe8b510a390cec1b61ed1f2efa8d91785c08e35f51aaf334f`로 전체 stack 재배포 후 health/E2E/실기기를 재검증.
- 재발 방지: 관리자 카드의 저장 표시는 연결 성공으로 사용하지 않는다. 운영 교체 전 비노출 실제 번역 응답과 테스트 환경 격리를 함께 검증한다. 실제 PC·Samsung DEVICE PASS 전 외부회의 음성·새 Provider·유료 fallback을 재도입하지 않는다.

## 2026-08-28 · Hermes Worker 결과 연동 후보

- 태그: Hermes, Obsidian, 스킬배포, Worker, E2E, 무회귀
- 기존 기준: VoiceFlow `5887d713bef20164ddad37881db3834c26d8c3c2`에서 승인 스킬 snapshot의 Hermes 큐 기록과 Obsidian 직접 write/search는 OPERATING PASS였으나 외부 Worker 처리는 UNVERIFIED.
- 확인된 기존 자산: 별도 Private 저장소 `star45-hermes-work`와 self-hosted 배포 파이프라인. 신규 저장소나 Provider를 만들지 않고 이 실행면을 재사용.
- 최소 변경:
  - Hermes Worker는 `skill-distribution-e2e`만 처리하고 snapshot SHA-256을 다시 계산한다.
  - 작업 지시문·셸·Provider 호출은 실행하지 않으며 미지원 타입과 체크섬 오류는 fail-closed.
  - 파일 rename으로 단일 claim, result ID로 중복 방지, 원본 archive와 Obsidian 결과 노트 유지.
  - VoiceFlow API는 공유 result/processing 파일을 읽어 `pending → processing → completed|failed` 상태를 반환.
- 보호 범위: 음성·번역·화상·UI·DB·DNS·Secret·Provider·기존 Hermes Supabase Worker 미변경.
- 변경 전 영향표:
  - 변경 기능: 스킬 배포 E2E 결과 상태.
  - 직접 소비자: connector Hermes jobs GET, 운영 E2E, 별도 Hermes file worker.
  - 간접 영향: skill registry 승인 SHA와 Obsidian System-Verification 감사 노트.
  - 복구점: VoiceFlow `5887d713`, Hermes `74629b0a`.
- 최종 상태:
  - SOURCE PASS · Hermes PR #6 병합 `2d512906d4b6487452501055c43365f9fcf44420`, VoiceFlow PR #177 병합 `f8af1be8ae5a7200190d20b60ad512fc24686e4d`.
  - UNIT/CONTRACT PASS · Worker 4개 테스트(성공 전이, 체크섬 fail-closed, 미지원 타입 fail-closed, 중복 idempotency)와 VoiceFlow result overlay 계약검사 성공.
  - CI PASS · Hermes main run `33192831482`, VoiceFlow PR run `33193697243`, VoiceFlow main run `33193933925`.
  - DOCKER PASS · VoiceFlow PR/main production image build 성공.
  - DEPLOY PASS · Hermes Worker deploy run `33192831530`; 새 Worker container running, restart count 0. VoiceFlow skill distribution enable job `98926144243` 성공.
  - OPERATING/API PASS · Skill Distribution Operations run `33193933975`; API가 Worker result를 읽어 `pending → processing → completed` 반환.
  - E2E PASS · job `hrm_mtd7uw5u_bsy9o2`, result `results/hrm_mtd7uw5u_bsy9o2.result.json`, Obsidian note `System-Verification/Hermes Result hrm_mtd7uw5u_bsy9o2.md`, marker `skill-e2e-f8af1be8-1787937556`.
  - DB/DEVICE N/A · 배경 파일 Worker 범위이며 DB와 실제 기기 경로는 변경·검증 대상 아님.
- 비용/보안: 외부 AI/Provider 호출 없음. 작업 지시문을 실행하지 않으며 승인된 타입·커밋·체크섬만 처리.
- 롤백: VoiceFlow는 `5887d713`, Hermes는 `74629b0a`로 각각 되돌린 뒤 Worker container를 제거/중지하고 기존 queue-write 전용 상태로 복구.


## 2026-08-28 · STAR45 승인 스킬 릴리스 v1 후보

- 태그: 스킬배포, 릴리스, GitHub, Deployment Center, Hermes, 체크섬
- 목표: 승인된 `star45-skill-distribution`을 이동 가능한 `main` 대신 불변 SemVer 태그로 고정하고 확인된 소비자에 동일 파일로 배포.
- 기존 자산: VoiceFlow registry/운영 E2E, Deployment Center와 Hermes의 기존 `skills/` root, GitHub Actions self-hosted runner를 재사용.
- 대상: `leewonkyu73-sys/star45-deployment-center@main`, `leewonkyu73-sys/star45-hermes-work@master`.
- 최소 변경: release config, 파일별/전체 SHA-256 manifest 생성기, focused test, VoiceFlow CI 성공 후 멱등 태그 생성 workflow, 배포 지침.
- 보호 범위: VoiceFlow 음성·번역·화상·UI·DB·DNS·Secret·Provider와 Hermes 실행 Worker 동작 미변경.
- 중단 조건: 미승인 대상, 잘못된 SemVer, commit 불일치, symlink, 경로 이탈, 체크섬 불일치, 기존 태그가 다른 SHA를 가리키면 publish/sync 중단.
- 최종 상태:
  - SOURCE PASS · VoiceFlow PR #182, 릴리스 기준 SHA `a8a9b92fd7d0cedd3bc86a59f9ded9fdbef69e93`.
  - UNIT/CI/DOCKER PASS · `SKILL_RELEASE_PASS`; PR run `33196903447`, main run `33197061493`.
  - PUBLISH PASS · `skills-v1.0.0` annotated tag가 정확히 기준 SHA를 가리킴. release run `33197289890`, artifact `star45-skills-v1.0.0` ID `9696268741`, artifact digest `sha256:8975a9401bd6b9e22c1d97a2833ea6e4300caf008c7b83cfc944c43ab5dc23a3`.
  - CONSUMER_SYNC PASS · bundle digest `f79ce72fb38105e4c9909eb6186f52faf2fa48d26c1e7164f86c597d2d11d5aa`. Deployment Center PR #51 / `020af13bf512a33de2942370fadd70e003a931e7`, Hermes PR #7 / `6d67c306264f601283e04ffb2174c9415115bffd`.
  - CONSUMER CI PASS · Deployment Center PR run `33197779387`·main run `33197826127`, Hermes PR run `33197671657`·main run `33197790870`에서 동일 tag·source SHA·4개 파일·전체 digest 확인.
  - OPERATING PASS · VoiceFlow operations run `33197061406`, job `hrm_mtd9as6i_5qiu2k`, Obsidian `System-Verification/Hermes Result hrm_mtd9as6i_5qiu2k.md`, marker `skill-e2e-a8a9b92f-1787939977`.
  - DEPLOYMENT CENTER DEPLOY PASS · 최초 workflow 가드 변경 커밋은 `deploy.yml` 자체가 포함돼 run `33197826131`에서 1회 재배포됐고 preflight·smoke·build/start·Health·container status가 모두 성공. 이후 `skills/**`, `skill-releases/**`, 전용 verify workflow 변경은 앱 재배포에서 제외.
  - CI INFRA FAIL(비차단) · 기존 GitHub-hosted UI 검사 run `33197570822`, `33197570862` 등은 `steps=null`인 러너 할당 전 실패. 이번 스킬 파일 검증과 무관하며 앱 코드 수정 근거로 사용하지 않음.
  - DEVICE N/A · 저장소 스킬 동기화 범위. Deployment Center/Hermes 장기 실행 Agent가 새 스킬을 자동 발견해 호출한 세션은 별도 `OPERATING UNVERIFIED`.
- 롤백: 소비자 pin을 직전 승인 SHA `10f96d57e5bdd1267160e6aca26010b5a219345f`로 되돌리고 새 태그를 이동·재작성하지 않는다.

## 2026-08-28 · Samsung STT DEVICE 실패와 Golden 단일 소유권 복구 후보

- 태그: Samsung, 모바일, STT, 원문, 주기적 소리, Golden, 단일 소유자, 회귀검사
- 사용자 증거: PR #178 운영 배포 후 Samsung 휴대폰 음성방에서 주기적인 시스템음이 계속 발생하고 말한 음성 원문이 표시되지 않음을 사용자가 직접 재확인.
- 보호 중인 정상 기능: PC 음성 원문, 직접 채팅 입력, DeepL 채팅 번역, 회의 저장·결과, 화상·관리자·DB·DNS·Secret. 후보는 이 경로들을 변경하지 않음.
- 마지막 실제 DEVICE Golden: `b98dcdd6d5b97f18fd3d5fc960817b3f50959740`, Actions run `32926323490`. 사용자 확인 기준으로 PC와 Samsung 음성 입력·원문·번역 정상.
- 최초 실패 SHA: `c3e0ed77605f9fb85e1875bd0f61356c17a870d8`.
  - Golden의 단일 1.5초 모바일 인식 시작 감시를 제거하고 `onspeechstart` 기반 4.5초 서버 fallback을 추가.
  - 모바일 STT continuous/restart 동작도 변경.
- 실패를 남긴 후속 변경: `8e0fae09edee0e41c3841a0c1fc69b7370afc1f3`에서 세션 시작 `checkDevices(false)` 재실행과 `r.start()` 직후 두 번째 4.5초 서버 fallback을 추가.
- 실패한 복구: PR #178 병합 SHA `e8dbd958fbaaabbc2527f5c9b9d8a8b0d0e5974e`는 continuous=true와 350ms restart만 복원. 두 4.5초 fallback과 세션 시작 장치 재검사가 남아 Samsung 증상이 계속됨.
- 확인된 원인:
  - 브라우저 STT, `onspeechstart` timer, `r.start()` timer가 같은 모바일 마이크/STT 상태를 중복 소유.
  - timer가 서버 STT로 전환하지만 OpenAI STT는 quota/billing 차단, Gemini는 미등록, DeepL은 번역 전용이라 원문을 생성하지 못함.
  - 브라우저 인식 재시작과 장치 재검사가 반복되어 Samsung 시스템음의 주기적 발생 경로가 됨.
- 최소 복구 후보:
  - 운영 병합 SHA `6ce4b540698039b255cc97181d8eec3333ff0cfd`, PR #183.
  - `patch-mobile-live-interim-v357.mjs`는 Golden의 continuous=true, 350ms restart, 단일 1.5초 인식 시작 감시를 보존.
  - `patch-immediate-original-v358.mjs`는 즉시 원문 렌더만 유지하고 세션 시작 장치 재검사와 중복 4.5초 fallback 두 경로를 제거.
  - 생성물 버전 `3.5.11`, PWA cache `voiceflow-shell-v336`.
- 단계별 상태:
  - TEST RED PASS · 계약검사만 넣은 PR #181 run `33196399395`의 `npm test`가 기존 중복 소유권에서 의도대로 실패.
  - SOURCE PASS · 두 생성 스크립트와 CI/배포 가드를 Golden 단일 소유권으로 최소 수정.
  - ISOLATED FRONTEND PASS · 동일 HEAD 생성 체인, Node syntax, 127개 프런트 계약 성공.
  - CI PASS · PR run `33197633096` attempt 2와 main run `33197958132`의 npm test·문법·프런트 생성 계약 성공.
  - DOCKER PASS · PR와 main의 production image build 성공.
  - PROVIDER PASS · 운영 교체 전 DeepL 한국어→베트남어 실응답 `translated=true`; OpenAI 결제는 이번 번역 경로에 사용하지 않음.
  - DEPLOY PASS · main run `33197958132`, deploy job `98940291424`.
  - OPERATING PASS · local/public version 2.6.2, 전체 서비스 Health, Chromium E2E 18/18, persistence, OVERALL 100% PASS. 생성 자산은 app 3.5.11과 PWA cache v336 계약 통과.
  - DEVICE Samsung PENDING · 새 운영본의 주기적 소리 중단과 음성 원문 표시를 실제 Samsung에서 확인해야 함. 자동검사로 대체하지 않음.
  - DEVICE PC 기존 PASS · 사용자 기존 확인 기준. 이번 후보의 PC 실기기 재검증은 UNVERIFIED.
- 롤백: 후보 배포 후 자동 또는 실기기 회귀 시 `e8dbd958fbaaabbc2527f5c9b9d8a8b0d0e5974e` 운영 자산으로 복원하고 Health/E2E를 재실행.
- 자동 중단: 후보에서도 Samsung 주기적 소리 또는 원문 미표시가 한 번이라도 재현되면 추가 timer·fallback·Provider 패치를 금지하고 Golden `b98dcdd6`의 전체 모바일 STT 생성 체인을 다시 비교.

## 2026-08-28 · PR #187 · Samsung Golden 전체 음성·원문 경로 복원

- 태그: Samsung, 모바일, STT, 원문, 주기적 소리, Golden, PWA, 실기기
- 재현 결과: PR #183 / 운영 SHA `6ce4b540698039b255cc97181d8eec3333ff0cfd` 배포 후에도 사용자가 Samsung에서 주기적 소리와 음성 원문 미표시를 직접 재확인. PR #183은 자동검사 PASS였지만 DEVICE FAIL로 판정.
- 중단 규칙 적용: 추가 timer·fallback·Provider 패치를 중단하고 실제 DEVICE Golden `b98dcdd6d5b97f18fd3d5fc960817b3f50959740`과 현재 생성 체인을 전체 재구성해 비교.
- 확인된 증거:
  - 현재와 Golden의 `startSpeech()`는 바이트 단위로 동일하여 음성 시작 함수 자체는 추가 수정 대상이 아님.
  - Golden 이후 기존 생성 패치가 다시 수정되어 `renderRoomStable()`과 `postCaption()`의 원문 표시·커밋 순서가 달라짐.
  - 마이크 상태 요소에 `aria-live`가 추가되어 주기적 상태 변경을 휴대폰 접근성 알림 소유자가 소비할 수 있음.
  - 설치형 PWA는 새 service worker가 controller가 되어도 이미 열린 최초 실패 JavaScript를 자동 교체하지 않음.
- 최소 복원:
  - Golden의 `renderRoomStable()`, `startSpeech()`, `postCaption()` 생성 결과를 정확히 복원.
  - 마이크 상태의 반복 live-region 소유자를 제거하고 Golden audio monitor로 복원.
  - service worker `controllerchange` 시 1회 자동 reload하여 설치형 Samsung PWA를 새 생성물로 교체.
  - 생성물 app v3.5.12, shell v337, PWA/audio asset v3.6.6.
- 보호 범위: DB·DNS·Secret·DeepL·Provider routing·PC 경로·참여자 sync·결과 modal·STT 사용량 대시보드 미변경.
- 단계별 상태:
  - SOURCE PASS · PR #187 병합 SHA `025a1bd2ace0acb5e575ec20eaff28ccaf156e0f`.
  - ISOLATED PASS · 생성된 세 핵심 함수가 Golden과 정확히 동일, JS syntax, live-region 제거, PWA update handoff 확인.
  - CI PASS · PR run `33201513156`의 전체 test와 frontend 계약 성공.
  - DOCKER PASS · PR run `33201513156`과 main run `33201807552` production image build 성공.
  - DEPLOY PENDING · main merge 제목에 `[deploy-production]` 표식이 없어 첫 main run 배포 job이 안전하게 skipped. 이 원장 커밋으로 동일 코드를 배포 트리거.
  - DEVICE Samsung PENDING · 운영 배포 후 주기적 소리 없음과 말한 원문 표시를 실제 Samsung에서 확인해야 최종 PASS.
- 롤백: 운영 교체 후 자동 또는 실기기 회귀 시 직전 운영 SHA `6ce4b540698039b255cc97181d8eec3333ff0cfd`로 복원하고 Health/E2E를 재실행. 해당 SHA도 Samsung DEVICE FAIL이므로 복구 완료로 판정하지 않고 조사 기준점으로만 사용.

## 2026-08-28 · PR #188 · Golden 복원 운영 E2E 보정과 최종 배포

- 태그: Samsung, 모바일, 마이크 레벨, 접근성 알림, Golden, 운영, E2E
- 첫 운영 시도: 원장 배포 트리거 SHA `e72cf8a554fc04e6ef0d848f33d2974dd26ff58e`, run `33202054104`. 실제 stack 교체와 전체 health는 PASS했으나 Chromium E2E가 `stable live quality monitor missing`에서 10/11로 실패.
- 확정 원인: 반복 알림 소유자를 제거하면서 시각적 마이크 레벨 표시의 현행 slot/class까지 Golden으로 되돌려 E2E가 필수 상태 표시를 찾지 못함.
- 최소 보정: PR #188에서 현행 monitor slot/class와 삽입 위치만 복원하고 명시적 `aria-live`와 암시적 live-region `role=status`는 계속 제거. Golden `startSpeech()`, `renderRoomStable()`, `postCaption()`는 변경하지 않음.
- 최종 생성물: app v3.5.12, service-worker shell v338, audio asset v3.6.7, PWA update handoff 유지.
- 단계별 상태:
  - SOURCE PASS · PR #188 병합/운영 SHA `edd527e7e788cbca798bfd7c16e6db2c3f045bfd`.
  - CI PASS · PR run `33202552041`, main run `33202732402`.
  - DOCKER PASS · 최종 manifest list `sha256:196b797b4ec282fcd09820bbca4dd6457bbd96a5214c4163db9de77d7b8431d7`.
  - PROVIDER PASS · 기존 VoiceFlow DeepL Secret 비노출 복구, 실제 한국어→베트남어 `provider=deepl`, `translated=true`.
  - DEPLOY PASS · main run `33202732402`, deploy job `98956385669`.
  - OPERATING PASS · 13개 container, local/public 2.6.2, 전체 runtime health, 핵심 UI, persistence, Chromium E2E 18/18, OVERALL 100% PASS.
  - DEVICE Samsung PENDING · 실제 휴대폰에서 자동 1회 reload 후 주기적 소리 없음과 말한 원문 표시를 사용자가 확인해야 최종 DEVICE PASS.
  - DEVICE PC 기존 PASS · 이번 최종 SHA의 실제 PC 마이크 재검증은 UNVERIFIED.
- 운영 중단: 최종 stack 교체 기준 stop 시작부터 gateway start까지 약 64초. DB·DNS·Secret 값은 변경하지 않음.
- 롤백: 최종 자동검사 회귀 시 직전 운영 교체 SHA `e72cf8a554fc04e6ef0d848f33d2974dd26ff58e` 또는 조사 기준점 `6ce4b540698039b255cc97181d8eec3333ff0cfd`로 복원. 두 기준 모두 Samsung DEVICE PASS가 아니므로 실기기 복구 완료로 판정하지 않음.



## 2026-08-28 · PR #189 · Samsung 지연 발화 STT 이중 소유 제거

- 태그: Samsung, Android Chrome, STT, 원문, 주기적 소리, 단일 소유자, 실행 회귀검사
- DEVICE 증상: 최종 PR #188 운영본에서도 Samsung 휴대폰의 주기적 시스템음과 음성 원문 미표시가 계속됨. 따라서 PR #188은 DEVICE FAIL로 정정.
- 자동검사 결함: 기존 Chromium E2E의 current voice recording flow는 가짜 미디어 장치에서 UI·버튼·상태 요소만 확인했고 실제 SpeechRecognition 결과나 Samsung 지연 발화를 실행하지 않았음.
- 재현된 최초 잘못된 상태: 운영 app v3.5.12의 Android startSpeech()가 시작 1.5초 뒤 결과가 없으면 startServerSpeechFallback()을 동시에 시작. 브라우저 STT 오류와 시작 예외도 server MediaRecorder STT로 병렬 전환해 단일 마이크/STT 소유권을 위반.
- 최소 수정:
  - Android Chrome에서 browser SpeechRecognition을 단일 STT 소유자로 유지.
  - 1.5초 server fallback timer와 browser 오류/시작 예외의 병렬 server fallback을 제거.
  - 실제 browser STT 미지원 모바일의 기존 server fallback, PC 경로, DeepL 번역, 채팅·화상·저장, DB·DNS·Secret은 변경하지 않음.
  - 생성물 app v3.5.13, PWA shell v339.
- 실행 회귀검사:
  - 기존 운영 app.js를 Samsung Android Chrome UA와 지연 발화로 실행한 검사에서 1.5초 fallback 예약을 검출해 RED.
  - 후보 생성 app.js에서 server STT 시작 0회, 1.5초 fallback 0개, browser final 안녕하세요 원문 커밋을 확인해 MOBILE_STT_DELAYED_SPEECH_PASS.
- 단계별 상태:
  - SOURCE PASS · PR #189 병합 SHA 5a7cc2542e05746fca1b8e1a41f135f9f7465f01.
  - CI PASS · PR run 33204710405, npm test·문법·생성된 Android 지연 발화 실행검사 성공.
  - DOCKER PASS · 같은 PR run의 production image build 성공.
  - DEPLOY PASS · main run `33202732402`의 안전한 재실행 deploy job `98964015258`이 main SHA `b69d6d3e509e634d477dfdc2775cb56f269d21eb`를 동기화·배포. manifest list `sha256:dd142b9a5dd03683f411666979bc114bc615b8eb826fe60a8a47f801bcfc3bf3`.
  - PROVIDER PASS · 운영 교체 전 DeepL 한국어→베트남어 실응답 `provider=deepl`, `translated=true`.
  - OPERATING PASS · 운영 index `app.js?v=3.5.13`, app `APP_VERSION=3.5.13`, service worker `voiceflow-shell-v339`; public health 전체 정상, Chromium E2E 18/18, persistence 포함 OVERALL 100% PASS.
  - PRODUCTION RUNTIME PASS · 운영 `app.js`를 Samsung Android Chrome UA와 지연 발화로 직접 실행해 server STT 시작 0회, 1.5초 fallback 0개, browser final `안녕하세요` 원문 커밋 확인.
  - DEVICE Samsung FAIL · 운영 app v3.5.13 배포 후에도 사용자가 실제 Samsung에서 주기적 시스템음과 음성 원문 미표시가 그대로임을 재확인. 자동 Samsung-UA 검사는 실제 기기 성공을 대체하지 못함.
- 가설 기각: 1.5초 server fallback 제거 후에도 실제 증상이 변하지 않았으므로 해당 fallback을 주원인으로 확정한 판단은 기각. 운영·자동검사 PASS와 DEVICE FAIL을 다시 분리하며 추가 STT 패치를 중단.
- 다음 조사 경계: 설치형 PWA가 실제 v3.5.13을 실행했는지와 실제 브라우저 SpeechRecognition의 `error`/`end` 반복을 분리 확인한 뒤에만 수정 재개.
- 비용/복구: 신규 Provider·인프라 비용 없음. 운영 회귀 시 직전 운영 SHA edd527e7e788cbca798bfd7c16e6db2c3f045bfd, app v3.5.12, shell v338로 재배포.

## 2026-08-29 · Samsung v3.5.13 전달 확인 후 공유 마이크 트랙 후보

- 태그: Samsung, Android, PWA, STT, 주기음, 원문, MediaStreamTrack, v3.5.14
- 실제 증거:
  - DEVICE DELIVERY PASS · 사용자가 설치형 앱의 `앱 버전 v3.5.13`을 직접 확인하여 구형 PWA 자산 가설을 제외함.
  - DEVICE FUNCTION FAIL · 같은 v3.5.13에서 주기적 시스템음과 음성 원문 미표시가 지속됨.
  - 재현 PASS · 모바일 `network` 오류 뒤 `onend`가 1.2초마다 `startSpeech`를 다시 예약하는 운영 코드를 격리 시험으로 재현함.
  - 읽기 전용 nginx 진단은 최근 Android 요청을 찾지 못해 실제 기기의 브라우저명과 SpeechRecognition 오류 코드는 UNVERIFIED.
- 최초 잘못된 경계:
  - v3.5.13은 이미 존재하는 녹음용 live `MediaStreamTrack`을 사용하지 않고 `SpeechRecognition.start()`로 별도 마이크 입력 세션을 시작함.
  - 결과 없는 모바일 오류/종료 주기도 무제한 자동 재시작하여 사용자 에이전트의 녹음 알림음이 반복될 수 있음.
- 최소 후보:
  - Chrome 135+ Web Speech 표준 경로인 `SpeechRecognition.start(audioTrack)`에 기존 live 오디오 트랙을 전달하고, 미지원 구현은 기존 `start()`로 즉시 폴백.
  - 모바일에서 결과가 전혀 없는 오류/종료 주기는 자동 재시작하지 않음. 결과가 있었던 정상 주기만 기존 350ms 연속 듣기를 유지.
  - 서버 STT, Provider, 번역, PC 경로, DB, DNS, Secret, 화상, 채팅은 변경하지 않음.
- 자동 검증: 격리 VM 후보 시험 `SAMSUNG_SHARED_TRACK_CYCLE_PASS`; 실제 생성물·CI·Docker·운영·Samsung DEVICE는 대기.
- 롤백: v3.5.13 운영 SHA `b69d6d3e509e634d477dfdc2775cb56f269d21eb` 기준으로 즉시 복원.


## 2026-08-29 · Samsung 속도 변경점 비교와 Golden 단일 서버 handoff 후보

- DEVICE v3.5.14 결과: 주기적 시스템음 없음 PASS, 음성 원문 미표시 FAIL. 따라서 공유 MediaStreamTrack 후보는 소리 회귀만 제거했고 원문 복구에는 실패함.
- 전체 모바일 원문 코드 계보: browser-first v349 → watchdog/result v351 → latency v352 → finalization v355 → live interim v357 → immediate original v358.
- 마지막 사용자 확인 DEVICE Golden: `b98dcdd6d5b97f18fd3d5fc960817b3f50959740` (app v3.5.6). 최초 실패: `c3e0ed77605f9fb85e1875bd0f61356c17a870d8` (app v3.5.7).
- 속도 변경 경계:
  - v3.5.2에서 서버 chunk 6.5초→2.2초, 모바일 무결과 watchdog 3.5초→1.5초로 단축.
  - v3.5.7에서 Golden 1.5초 서버 fallback을 제거하고 onspeechstart 4.5초 fallback, continuous=false, 80ms restart를 도입하면서 최초 DEVICE 실패.
- v3.5.14 반증: `SpeechRecognition.start(audioTrack)` 사용 후에도 실제 Samsung 원문이 생성되지 않아 공유 track이 근본 해결이라는 가설을 기각.
- 최소 후보 v3.5.15:
  - 실패한 shared-track 호출을 제거하고 Golden `SpeechRecognition.start()` 서명을 복원.
  - 브라우저 결과가 있는 정상 cycle은 기존 350ms 연속 듣기와 browser caption commit 유지.
  - 결과 없는 error/end cycle은 브라우저를 재시작하지 않아 주기음을 차단하고, 기존 server STT로 정확히 한 번 handoff.
  - PC STT, 번역, 채팅, 화상, DB, DNS, Secret, Provider 설정, 저장 데이터는 변경하지 않음.
- 격리 검증: `SAMSUNG_GOLDEN_FALLBACK_HANDOFF_PASS`. SOURCE/CI/DOCKER/DEPLOY/OPERATING/DEVICE는 후보 반영 후 분리 판정.
- 비용: browser STT 성공 시 추가 비용 없음. Samsung browser 빈 cycle에서만 기존 server STT가 사용되며 저장소 기준 추정 단가는 OpenAI 사용 시 분당 USD 0.006. 신규 Provider나 인프라 추가 없음.
- 롤백: v3.5.14 운영 SHA `3097e7e5c903123e8906d28a7755c81dc91b0019`.


## 2026-08-29 · v3.5.15 Samsung 실기기 재실패와 v3.5.16 Golden 감시 복원

- 실기기 결과: PC 원문 PASS, Samsung 원문 FAIL. v3.5.15의 주기적 소리 없음은 유지됨.
- 최초 잘못된 상태: v3.5.7에서 마지막 실기기 정상 v3.5.6의 1.5초 무결과 서버 STT 감시가 제거됨.
- v3.5.15 실패 이유: 서버 인계를 SpeechRecognition `onend`에만 연결했다. Samsung Chrome이 결과와 종료 이벤트를 모두 내지 않고 계속 대기하면 인계 경로가 실행되지 않는다.
- 운영 재현: `결과 없음 + onend 없음` Samsung 세션에서 1.5초 watchdog 존재를 요구한 테스트가 v3.5.15에 대해 FAIL.
- 최소 수정 후보 v3.5.16: Golden `r.start()`, 연속 모드와 빈 onend 재시작 금지를 유지하고, 결과가 1.5초 없을 때만 기존 서버 STT를 한 번 시작한다. 브라우저 결과가 오면 timer를 취소한다.
- 보호 범위: PC STT, 번역, 채팅, 화상, DB, DNS, Secret, Provider 설정, 저장 데이터 불변.
- 비용: Samsung 브라우저 무결과 때만 기존 OpenAI STT 약 $0.006/분.
- 롤백: v3.5.15 `3898ad17ac014306beccdc388607821725e7438c`.


## 2026-08-29 · PC 화상 종료 후 재입장 유령 세션과 원문 입력 손실

- 증상: 화상회의 종료·홈 이동 후 새 PC 회의에 이전 저장 완료 막대와 안내 문구가 반복되고, 수동 원문 입력이 전송 후 사라짐. 종료 버튼은 `완료`로만 표시됨.
- 화면 증거: 새 회의가 녹음 중인데 이전 `저장 완료` 도구가 동시에 보이고, 첫 음성인식 안내/준비 완료가 여러 번 누적됨.
- 최초 잘못된 상태: `completedBarV347`가 현재 회의 종료 상태를 확인하지 않고 `lastMeetingId`만 보며, `launchSimpleSession`은 이전 결과 상태를 초기화하지 않음. meeting-collab의 `systemRows`도 회의 변경 시 비우지 않음.
- 원문 손실: send handler가 `postCaption` 성공 전에 draft와 textarea를 지우고, 임시 caption을 API 응답 전 렌더링하지 않음.
- 최소 수정 v3.5.17: 새 세션 결과 상태 초기화, 완료 막대는 현재 회의가 ended일 때만 표시, 회의 변경 시 안내 배열 초기화, 임시 원문 즉시 렌더링, 성공 후 입력 지우기/실패 시 복원, 화상 방에서는 기존 endMeeting 버튼을 `화상 종료`로 표시.
- 보호 범위: v3.5.16 Samsung watchdog, 번역, DB, DNS, Secret, Provider 설정, 저장 데이터 불변.
- 롤백: v3.5.16 `2919c89edd53b04f75e26f2e0bc659444b10a751`.


## 2026-08-29 · VoiceFlow v4 PC·모바일 실행부 분리 설계 확정 후보

- 태그: v4, 구조분리, PC, 모바일, STT, 화상, caption, 단계이관, 무회귀
- 배경: Samsung 원문 미표시와 주기음, PC 입력 손실과 종료 후 재입장 유령 상태가 연속 발생했고, 단일 `public/app.js`와 순서 의존 생성 패치가 마이크·STT·전체 render·caption·회의 상태를 함께 소유함.
- 운영 동결 기준: main `3502ce63340dfe9ec3d4e94bd10f12a3ac66753f`, 운영 app v3.5.17 / service worker v343. SOURCE/CI/DOCKER/DEPLOY/OPERATING PASS, PC·Samsung 최신 DEVICE UNVERIFIED.
- 마지막 Samsung DEVICE Golden: `b98dcdd6d5b97f18fd3d5fc960817b3f50959740`, app v3.5.6.
- 결정: 전체 재개발이나 두 개의 완전 독립 업무 앱을 만들지 않는다. 기존 인증·조직·권한·Meeting/caption API·번역·결과·Drive·업무·일정·배포는 재사용하고, 공통 TypeScript 계약·상태기계·caption store 위에 Desktop Web과 Mobile PWA media/UI adapter를 독립 번들로 만든다.
- 기존 자산 평가: `/voice-core-v1`의 단일 마이크·서버 STT·공통 caption API 방향은 재사용하지만, 4초 segment·전송 전 draft 삭제·실기기 미검증 구현은 그대로 승격하지 않음.
- 격리: v4는 `/v4/mobile`, `/v4/desktop` 기본 OFF 경로로 시작하며 v3 패치 체인을 사용하지 않는다. 실패 시 DB/전체 stack rollback 없이 route/flag만 v3.5.17로 복귀.
- Provider/영상 경계: 유료 STT·새 Provider·LiveKit는 Samsung/PC 동일 입력의 지연·정확도·비용·자원·복구 실측과 사용자 승인 전 기본값으로 전환하지 않음.
- 첫 구현 단위: `meeting-contracts`, `meeting-state`, `caption-store`와 focused test, v3.5.17 산출물 불변 검사. 운영 기능 변경 없음.
- 예상: Mobile 핵심 실기기 후보 약 2주, 단계적 운영 전환 4~6주.
- 상태: ARCHITECTURE SOURCE PASS 후보 · 앱 코드/DB/DNS/Secret/Provider/운영 미변경 · CI/DEVICE N/A.
- 상세 문서: `architecture/voiceflow-v4-migration-plan.md`.


## 2026-08-29 · PR #197 · VoiceFlow v4 Phase 1 공통 상태 코어 격리

- 태그: v4, 구조분리, meeting-state, caption-store, idempotency, 원문보존, v3동결
- 기준: 운영 app v3.5.17 배포 SHA `3502ce63340dfe9ec3d4e94bd10f12a3ac66753f`, service worker v343. 최신 main 문서 SHA `12d0af21c71204bd9ff3ecb875bb938407879d94`.
- 목표: PC·모바일 실행부를 만들기 전에 UI·미디어·네트워크와 무관한 공통 회의 상태, caption 계약, 실패복구·재접속 중복방지 규칙만 구현.
- RED 증거: 모듈 구현 전 focused test가 `ERR_MODULE_NOT_FOUND`로 실패. 리뷰 중 종료된 동일 회의 재개 차단 검사도 기존 후보에서 의도대로 실패.
- 최소 구현:
  - `meeting-contracts`: 회의/caption 상태, event, 유효 meeting id, caption request 계약.
  - `meeting-state`: 허용 전이만 가능한 immutable lifecycle과 회의 변경 generation.
  - `caption-store`: 입력 즉시 pending 원문, 실패 시 원문·draft 보존, 성공 후에만 draft 삭제, 번역 실패와 원문 분리, 재접속 deduplication.
  - 같은 idempotency key와 같은 문장은 no-op, 다른 문장은 `caption_idempotency_conflict`로 차단.
  - 종료된 동일 meeting id는 `ended_meeting_cannot_reopen`으로 차단.
  - `.mjs`용 TypeScript 선언을 `.d.mts`로 제공하며 새 runtime/build dependency는 추가하지 않음.
- 격리: 신규 `frontend-v4` package는 DOM, browser media, fetch, Provider, DB, v3 `public/app.js`, patch script를 참조하지 못하도록 focused test로 차단.
- v3 불변 증거: 운영에서 독립 수집한 app.js, index.html, sw.js, meeting-collab.js SHA-256을 freeze하고 기존 frontend generator 후 정확히 일치하는지 검사. `VOICEFLOW_V3_5_17_ARTIFACTS_UNCHANGED` PASS.
- 단계별 상태:
  - SOURCE PASS · PR #197 code head `6f7ef0e70df92412dcb79b3f28a864422094a3d8`.
  - FOCUSED PASS · `VOICEFLOW_V4_PHASE1_STATE_CAPTION_PASS`, `VOICEFLOW_V4_PHASE1_ISOLATION_PASS`.
  - CI PASS · Actions run `33243855919`, test 성공.
  - DOCKER PASS · 같은 run production image build 성공.
  - V3 ARTIFACT PASS · frozen v3.5.17 네 산출물 hash 일치.
  - DEPLOY N/A/SKIPPED · 운영 배포를 요청하거나 트리거하지 않음.
  - OPERATING UNCHANGED · UI/API/DB/DNS/Secret/Provider/route 미변경.
  - DEVICE N/A · 실행 UI와 미디어 adapter가 없는 공통 순수 모듈 단계.
- 보호 범위: 기존 STT·번역·화상·채팅·스크롤·권한·결과·관리자·데이터 전체 불변.
- 롤백: `frontend-v4` Phase 1 파일을 제거하고 package test 및 CI hash check 두 연결만 되돌리면 됨. 운영 rollback 불필요.
- 다음 게이트: 기존 API를 변경하지 않는 adapter 계약검사 뒤에만 기본 OFF `/v4/mobile` vertical slice를 시작. Provider·LiveKit·운영 route 전환 금지.

## 2026-08-29 · PR #198 · VoiceFlow v4 Phase 1.5 caption API 재전송 계약

- 태그: v4, caption, API, client_id, idempotency, 재접속, v3동결
- 기준:
  - 변경 직전 main `e5195a5843dbb8a796e862c2a4f96a6b2bdc39ac`.
  - 운영 동결 `3502ce63340dfe9ec3d4e94bd10f12a3ac66753f`, app v3.5.17 / service worker v343.
  - 마지막 Samsung DEVICE Golden `b98dcdd6d5b97f18fd3d5fc960817b3f50959740`, app v3.5.6. 이번 단계는 UI·미디어가 없어 DEVICE 성공을 주장하지 않음.
- RED 증거: 실제 `server-v2.mjs`를 임시 데이터 디렉터리에서 실행한 계약검사가 첫 caption 응답의 `client_id`가 `undefined`여서 실패. 기존 API는 재접속 재전송과 새 입력을 구분할 수 없었음.
- 영향·소유권:
  - 직접 변경: caption POST의 JSON 저장 계약, 순수 idempotency claim, 주입형 v4 meeting API adapter.
  - 직접 소비자: 기존 Meeting/caption API와 향후 v4 caption store transport 연결.
  - 보호 기능: v3 `postCaption()` 생성물, STT·번역 Provider·화상·채팅·스크롤·권한·결과·DB schema·DNS·Secret·운영 route.
  - 공유 자원: 마이크·MediaRecorder·`state.media`·DOM·render 소유권 변경 없음. caption 파일 쓰기는 기존 `mutate()` 직렬화가 단독 소유.
- 최소 구현:
  - `client_id`가 있으면 저장하고 같은 meeting/client_id/text 재전송은 기존 caption을 200(번역 처리 중이면 202)으로 반환하며 번역·저장을 반복하지 않음.
  - 같은 meeting/client_id에 다른 text가 오면 `409 caption_idempotency_conflict`로 차단.
  - `client_id`가 없는 기존 v3 요청은 매번 201로 저장하는 기존 동작 유지.
  - 첫 처리의 Provider 오류에서는 해당 신규 claim만 제거해 같은 `client_id` 재시도가 영구 pending에 묶이지 않게 함.
  - v4 adapter는 `fetch`, DOM, browser media를 직접 소유하지 않고 호출자가 제공한 transport만 사용.
- 검증:
  - FOCUSED PASS · `VOICEFLOW_V4_PHASE15_API_ADAPTER_PASS`, `VOICEFLOW_V4_CAPTION_API_IDEMPOTENCY_PASS`.
  - CORE REGRESSION PASS · `VOICEFLOW_V4_PHASE1_STATE_CAPTION_PASS`, `VOICEFLOW_V4_PHASE1_ISOLATION_PASS`.
  - FULL CI PASS · PR code head `1abbd8d233a40334a25a98bca50c3e72d388c769`, Actions run `33244531434`, test job `99079586962`.
  - DOCKER PASS · 같은 run docker job `99079721690`.
  - V3 ARTIFACT PASS · `VOICEFLOW_V3_5_17_ARTIFACTS_UNCHANGED`.
  - 기존 핵심 보호 PASS · `MOBILE_STT_SILENT_SESSION_WATCHDOG_PASS`, `PC_VIDEO_REENTRY_AND_CHAT_PASS`, 기존 Meeting Core v2 통합검사.
  - DEPLOY N/A/SKIPPED · deploy-production과 browser-e2e job은 표식 부재로 skipped. 운영 배포 요청 없음.
  - OPERATING UNCHANGED · 운영 UI/API binary/DB/DNS/Secret/Provider/route 변경 없음.
  - DEVICE N/A · v4 실행 화면·미디어 adapter가 없는 API 계약 단계.
- 비용: 새 Provider·API 호출·인프라 없음. 동일 재전송의 중복 번역 호출을 제거해 잠재 호출량만 감소.
- 롤백: `server-v2.mjs`의 claim 연결, `lib/caption-idempotency.mjs`, `frontend-v4/packages/meeting-api-adapter`, 두 focused test와 package test 연결만 되돌림. 운영 미배포이므로 stack rollback 불필요.
- 다음 게이트: 기본 OFF `/v4/mobile` vertical slice에서 이 adapter를 caption-store와 연결하되, 실제 Samsung 음성→원문→번역 DEVICE PASS 전 운영 route 전환·Provider 변경·PC 화면 이관 금지.

## 2026-08-29 · PR #199 · TURN 일반 main push 자동배포 차단

- 태그: CI, 배포, TURN, workflow_dispatch, 자동배포, 롤백, 회귀차단
- 증상: 배포 표식이 없는 PR #198 병합 SHA `9aa915f8cec4b9f32be6d6293d58a0695d453776`의 `server-v2.mjs` 변경만으로 `VoiceFlow WebRTC TURN v343` run `33244790593`이 자동 실행됨.
- 실제 영향:
  - `coturn/coturn:4.17.0-r0` pull 후 `voiceflow-turn-v343` 컨테이너가 강제 재생성·시작됨.
  - 이어진 core fast deploy가 `http://127.0.0.1:4180/api/health` 연결 실패로 중단되고 `ROLLBACK DONE`을 기록함.
  - run은 FAIL. 로그만으로 TURN 컨테이너의 최종 외부 통신과 공개 운영 Health는 확인할 수 없어 OPERATING UNVERIFIED로 유지.
- 최초 잘못된 상태:
  - 자동 TURN workflow 도입 전 부모 `ceec845adacc52ae55cce11af7800a7d4acdfaf7`은 일반 main push TURN 배포가 없음.
  - 최초 자동 trigger 도입 `49db0ef83d2a75112da0c88a03ca67875bee3df0`가 `push: main`과 `server-v2.mjs` path를 결합함.
  - 2026-08-27 원장의 “운영 자동 배포 소유자는 VoiceFlow CI 하나” 격리에서 이 후발 TURN workflow가 누락됨.
- RED 증거: repository event trigger 부재를 요구한 `turn-deploy-trigger.test.mjs`가 기존 `push:` 블록을 검출해 `TURN deployment must not run from repository events`로 실패.
- 최소 수정:
  - `.github/workflows/deploy-webrtc-turn-v343.yml`의 push/path trigger만 제거하고 `workflow_dispatch`를 유지.
  - protected runner labels, concurrency, 기존 TURN 배포 스크립트와 TURN 설정은 변경하지 않음.
  - npm 회귀검사에 `VOICEFLOW_TURN_MANUAL_DEPLOY_GUARD_PASS` 추가.
- 단계별 상태:
  - SOURCE PASS · PR #199 code head `ee621b310e83b6666fda889b49bfa7d6b74098c4`.
  - FOCUSED PASS · `VOICEFLOW_TURN_MANUAL_DEPLOY_GUARD_PASS`.
  - CI PASS · PR run `33245124664`, test job `99081163851`.
  - DOCKER PASS · 같은 run docker job `99081304367`.
  - V3 ARTIFACT PASS · `VOICEFLOW_V3_5_17_ARTIFACTS_UNCHANGED`.
  - 보호 회귀 PASS · v4 caption 계약, 모바일 무음 watchdog, PC 화상 재입장·채팅 검사.
  - DEPLOY N/A/SKIPPED · PR deploy-production/browser-e2e skipped, TURN workflow run 생성 없음.
  - OPERATING UNCHANGED BY CANDIDATE · PR 후보는 운영 파일·컨테이너·TURN 설정·DB·DNS·Secret을 변경하지 않음.
  - DEVICE N/A · CI trigger 격리만 변경.
- 비용: 추가 Provider·인프라 비용 없음. 불필요한 이미지 pull·TURN 재시작·core fast deploy 위험을 제거.
- 롤백: workflow에 push trigger를 복원할 수 있으나 자동 운영 충돌을 재도입하므로 권장하지 않음. TURN 배포가 필요하면 GitHub Actions에서 해당 workflow를 명시적으로 수동 실행하고 전체 운영 Health를 확인.
- 다음 게이트: main 병합 커밋에서 VoiceFlow CI만 실행되고 TURN workflow가 생성되지 않음을 확인한 뒤 v4 mobile vertical slice 재개.

## 2026-08-29 · PR #200 · VoiceFlow v4 Phase 2 모바일 원문 저장 수직 단위

- 태그: v4, 모바일, caption, 원문보존, API, 재시도, 재접속, 기본OFF, v3동결
- 기준:
  - 변경 직전 main `eabe7494a2048a429c7520846ffc44b82d4eaf05`.
  - 운영 동결 `3502ce63340dfe9ec3d4e94bd10f12a3ac66753f`, app v3.5.17 / service worker v343.
  - 마지막 Samsung DEVICE Golden `b98dcdd6d5b97f18fd3d5fc960817b3f50959740`, app v3.5.6. 이번 단계는 마이크/STT가 없어 DEVICE 성공을 주장하지 않음.
- 목표: 기존 `meeting-contracts`, `caption-store`, `meeting-api-adapter`를 재사용해 모바일 수동 원문 입력을 저장 전 즉시 표시하고, API 성공 후에만 draft를 지우며, 실패·재접속에서도 원문과 idempotency를 보존.
- RED 증거: focused test가 신규 `mobile-caption-session` 부재로 `ERR_MODULE_NOT_FOUND` 실패.
- 영향·소유권:
  - 직접 변경: 신규 모바일 caption session, 최소 모바일 화면, 기본 OFF route/asset gate, Docker source 포함, focused tests.
  - 직접 소비자: `/v4/mobile?meeting=mtg_...` 격리 화면과 기존 caption API.
  - 보호 기능: v3 `public/app.js`, index, service worker, meeting-collab, STT·번역 Provider·화상·PC UI·DB·DNS·Secret.
  - 공유 자원: 마이크·MediaRecorder·SpeechRecognition·`state.media`·v3 DOM/render 소유권 없음. caption 저장은 기존 API와 idempotency 계약만 사용.
- 최소 구현:
  - 입력 즉시 immutable caption store에 `pending` 원문과 draft를 표시.
  - API commit 뒤에만 draft 삭제; 실패 시 원문·draft와 재시도 버튼 유지.
  - 재시도는 같은 `client_id`를 재사용하고 재접속은 cursor/client_id로 병합.
  - `VOICEFLOW_V4_MOBILE_ENABLED=1`일 때만 모바일 HTML/CSS/JS와 필요한 package `index.mjs`를 제공. 기본값에서는 실제 서버가 404 `v4_mobile_disabled` 반환.
  - 모바일 module URL을 `/v4/mobile/modules/**`로 한정해 향후 desktop 경로와 소유권 충돌 방지.
  - 운영 image에는 격리 source를 포함하지만 기능 플래그 기본 OFF와 배포 표식 부재를 유지.
- 검증:
  - FOCUSED PASS · `VOICEFLOW_V4_PHASE2_MOBILE_CAPTION_SESSION_PASS`.
  - ROUTE PASS · `VOICEFLOW_V4_PHASE2_MOBILE_OFF_ROUTE_PASS`: 실제 server-v2에서 OFF 404, ON HTML/JS/package 200, 기존 `/` 불변, 미허용 asset 404.
  - CORE REGRESSION PASS · Phase 1 state/isolation, Phase 1.5 adapter, caption API idempotency.
  - CI PASS · code head `6684d1ce881787cc5b6043686aa34f8f76e03ddd`, Actions run `33246371870`, test job `99084437358`.
  - DOCKER PASS · 같은 run docker job `99084577232`.
  - V3 ARTIFACT PASS · `VOICEFLOW_V3_5_17_ARTIFACTS_UNCHANGED`.
  - 기존 핵심 보호 PASS · 모바일 silent-session watchdog, PC 화상 재입장·채팅, TURN manual-only guard.
  - DEPLOY N/A/SKIPPED · deploy-production과 browser-e2e는 배포 표식·수동 실행 부재로 skipped.
  - OPERATING UNCHANGED · 운영 route/환경변수/API binary/DB/DNS/Secret/Provider 미변경. 운영 v4 URL은 기본 OFF 상태로 배포하지 않음.
  - DEVICE N/A/UNVERIFIED · 실제 Samsung UI·터치·저장·재접속과 음성은 운영 미배포로 미검증.
- 비용: 신규 Provider/API 종류·DB·인프라 없음. 사용자가 플래그를 명시적으로 켜고 원문을 저장할 때만 기존 caption/번역 API 호출이 발생.
- 롤백: `frontend-v4/apps/mobile-pwa`, `mobile-caption-session`, Phase 2 tests, server gate, Docker/CI/package 연결만 제거. v3 운영 stack rollback 불필요.
- 다음 게이트: 운영 기본 경로를 켜지 않은 채 단일 `MediaSessionAdapter`의 녹음 권한·화면 복귀·오류복구 계약을 추가하고, 실제 Samsung 동일 샘플 비교 전 유료 STT·Provider·LiveKit·PC 이관을 금지.

## 2026-08-29 · PR #201 · VoiceFlow v4 Phase 2 모바일 단일 MediaSessionAdapter

- 태그: v4, 모바일, 마이크, 단일소유, 권한, 화면복귀, 오류복구, 기본OFF, v3동결
- 기준:
  - 변경 직전 main `dbc47649eebb4d23a0bb55ad6c46e18d97333887`.
  - 운영 동결 `3502ce63340dfe9ec3d4e94bd10f12a3ac66753f`, app v3.5.17 / service worker v343.
  - 마지막 Samsung DEVICE Golden `b98dcdd6d5b97f18fd3d5fc960817b3f50959740`, app v3.5.6. 이번 단계는 STT가 없어 원문 복구 성공을 주장하지 않음.
- 목표: 기본 OFF v4 모바일 화면에 브라우저 마이크의 단일 소유 계층만 추가하고, 과거 Samsung 주기음 원인이 된 자동 재시작·다중 소유·타이머 경로를 구조적으로 차단.
- RED 증거: focused test가 신규 `mobile-media-session` 부재로 `ERR_MODULE_NOT_FOUND` 실패.
- 영향·소유권:
  - 직접 변경: 신규 순수 MediaSessionAdapter, TypeScript 선언, 명시적 마이크 연결/중지 UI, focused test와 CI 연결.
  - 직접 소비자: 기본 OFF `/v4/mobile` 화면.
  - 보호 기능: v3 STT·번역·화상·채팅·결과·DB·DNS·Secret·Provider·운영 route 전체.
  - 공유 자원: 한 adapter session이 한 MediaStream만 소유. MediaRecorder·SpeechRecognition·STT Provider는 이번 단계에서 소유하지 않음.
- 최소 구현:
  - 동시에 여러 번 start해도 동일 promise와 한 번의 `getUserMedia` 요청만 사용.
  - 화면 숨김에서는 기존 live audio track의 `enabled=false`, 화면 복귀에서는 같은 track을 다시 활성화하며 새 권한 요청 없음.
  - track 종료·권한 거부·장치 없음은 명시적 상태로 전환하고 timer·자동 재요청 금지.
  - 오류 뒤 재연결은 사용자가 버튼을 누를 때만 새 adapter session을 생성.
  - stop과 요청 도중 stop 이후 늦게 도착한 stream 해제를 멱등 처리.
  - 반복 접근성 알림을 만들 수 있는 media 상태 `aria-live`와 주기 timer 없음.
- 검증:
  - FOCUSED PASS · `VOICEFLOW_V4_PHASE2_MOBILE_MEDIA_SESSION_PASS`.
  - ISOLATION PASS · `VOICEFLOW_V4_PHASE1_ISOLATION_PASS`; package가 DOM·browser global·MediaRecorder·SpeechRecognition·fetch를 직접 소유하지 않음.
  - ROUTE PASS · 기존 Phase 2 route test가 ON 상태의 media module 제공과 OFF 404를 확인.
  - CI PASS · PR code head `26f3e05413407c6b5772974f9858bb42ece9af59`, Actions run `33247246754`, test job `99086749185`.
  - DOCKER PASS · 같은 run docker job `99086898045`.
  - V3 ARTIFACT PASS · 기존 generator 후 v3.5.17 네 산출물 hash 불변.
  - DEPLOY N/A/SKIPPED · deploy-production과 browser-e2e는 배포 표식·수동 실행 부재로 skipped.
  - OPERATING UNCHANGED · 운영 route, 컨테이너, API binary, DB, DNS, Secret, Provider 미변경.
  - DEVICE UNVERIFIED · 실제 Samsung의 권한 1회·화면 복귀·중지와 음성 원문은 운영 미배포/기본 OFF이므로 확인하지 않음.
- 비용: 신규 Provider, STT 호출, 인프라, DB 사용 없음. 마이크 연결만 준비하며 음성 업로드·번역 호출을 만들지 않음.
- 롤백: `mobile-media-session`, focused test, 모바일 UI media wiring, package/CI 연결만 제거. v3 운영 stack rollback 불필요.
- 다음 게이트: 기본 OFF 상태에서 MediaRecorder/STT transport 계약을 별도 추가하되 Samsung 동일 샘플의 권한·첫 원문 지연·주기음·화면 복귀를 실기기 비교하기 전 운영 전환·유료 Provider·PC 이관 금지.



## 2026-08-29 · PR #202 · VoiceFlow v4 Phase 2 모바일 수동 음성 원문 카나리

- 태그: v4, 모바일, Samsung, MediaRecorder, 서버STT, 원문보존, 단일소유, 카나리, 기본OFF, v3동결
- 사용자 증상·시점:
  - 2026-08-29 대화 기준 Samsung 스마트폰에서 며칠째 주기적 소리가 나고 음성 원문이 표시되지 않음. PC에서는 원문이 되지만 화상 실행 중 텍스트 입력이 사라지거나 종료 후 재입장 화면이 남는 별도 증상도 보고됨.
  - 정확한 최초 발생 일시와 v3 최초 실패 SHA는 DEVICE 증거가 없어 미확정. 마지막 Samsung DEVICE Golden은 `b98dcdd6d5b97f18fd3d5fc960817b3f50959740`, app v3.5.6.
  - 반복 수정 중단 후 사용자가 기존 앱 유지보수보다 새 v4 구조를 단계별로 진행하고 마지막 실행단계까지 가도록 명시적으로 요청한 업그레이드 후보임. PC 증상은 이번 모바일 PR의 해결 범위로 주장하지 않음.
- 기준:
  - 변경 직전 main `3b861ff7eefbfdd17bbdbdf1c4f09e7cc603a3a0`.
  - 운영 동결 `3502ce63340dfe9ec3d4e94bd10f12a3ac66753f`, app v3.5.17 / service worker v343.
  - v3 정확한 주기음 원인은 DEVICE/브라우저 trace가 없어 미확정. v4 후보는 원인 확정 주장 대신 자동 녹음 순환·브라우저 SpeechRecognition·재시작 timer·병렬 STT 소유권을 사용하지 않는 격리 구조로 위험 경로를 제거.
- 영향·소유권:
  - `mobile-media-session` 하나가 한 MediaStream을 소유하고, 사용자의 명시적 `음성 원문 시작`마다 `mobile-speech-session`이 MediaRecorder 하나만 생성.
  - 녹음 완료 뒤 기존 `POST /api/v1/meetings/{id}/transcribe`만 호출하고, 인식된 원문은 직접입력과 같은 `mobile-caption-session.submit()`으로 저장·번역.
  - STT 요청에는 번역 target을 보내지 않아 transcribe와 caption API의 중복 번역을 차단. caption store가 저장 전 원문을 즉시 표시하고 실패 시 원문/draft를 보존.
  - 백그라운드·녹음 오류·짧은 오디오·Provider 실패에서 자동 재시작·자동 재권한·timer가 없으며 사용자의 새 동작만 재시도 가능.
  - 보호 기능: v3 `public/app.js`, index, service worker, meeting-collab, 기존 PC·화상·채팅·결과·DB·DNS·Secret·Provider 설정 불변.
- 배포 격리:
  - `VOICEFLOW_V4_MOBILE_ENABLED` 기본값 0. `[deploy-production] [v4-mobile-canary]`가 함께 있는 배포 커밋에서만 v4 모바일 route를 ON.
  - 카나리 배포 전에 기존 STT Provider의 인증·모델·quota/billing 경로를 작은 WebM probe로 확인. 실패하면 runtime replacement 전에 `live STT Provider unavailable`로 중단.
  - 배포 뒤 기존/재사용 demo meeting id, local/public v4 HTML marker, app wiring, speech module을 확인하고 Samsung용 URL을 로그에 남김.
- 검증:
  - RED PASS · 신규 `mobile-speech-session` 구현 전 focused test가 `ERR_MODULE_NOT_FOUND`로 실패.
  - FOCUSED PASS · `VOICEFLOW_V4_PHASE2_MOBILE_SPEECH_SESSION_PASS`, media/caption focused tests PASS.
  - ISOLATION PASS · browser SpeechRecognition, timer, 자동 MediaRecorder cycle 부재와 기존 단일 media owner 계약 확인.
  - ROUTE PASS · 실제 server-v2에서 기본 OFF 404, ON 상태 phase2-speech HTML/app/caption/media/speech module 200, 기존 `/` 불변.
  - CI PASS · code head `5dc027937c45affb1c5d9fd69ffa8f5bc7500a94`, Actions run `33248398869`, test job `99089732309`.
  - DOCKER PASS · 같은 run docker job `99089870293`.
  - V3 ARTIFACT PASS · 기존 generator 후 v3.5.17 네 산출물 hash 불변. 기존 모바일 watchdog, PC 화상 재입장·채팅, TURN manual-only 회귀검사 PASS.
  - DEPLOY PENDING · 코드 PR에서는 deploy-production/browser-e2e가 skipped. 별도 표식 PR 병합 뒤에만 실행.
  - OPERATING PENDING · v4 route/STT Provider/공개 URL/기존 v3 browser E2E는 카나리 배포 후 확인.
  - DEVICE UNVERIFIED · 실제 Samsung 권한 요청 횟수, 10회 음성 원문, 주기음, 첫 원문 지연, 화면 숨김/복귀는 사용자 실기기 확인 전 PASS 금지.
- 비용:
  - 신규 Provider·DB·DNS·Secret·인프라 추가 없음.
  - 카나리 배포 사전검사에서 기존 STT Provider 1회 호출. 사용자가 음성 clip을 완료할 때마다 기존 STT 1회와, 원문 저장 시 선택 언어가 다르면 기존 번역 1회가 발생함. 실제 단가는 Provider 계약·모델 사용량에 따르며 이번 PR에서 신규 비용 약정이나 Provider 전환은 하지 않음.
- 롤백:
  - 즉시 완화는 canary 표식 없는 정상 production deploy 또는 `VOICEFLOW_V4_MOBILE_ENABLED=0` reconcile로 `/v4/mobile`만 OFF. v3 운영 route와 frozen artifact는 그대로 유지.
  - 소스 롤백은 speech package/test/UI wiring, STT preflight, compose/workflow canary env와 배포 route 검증만 되돌림. DB migration·DNS·Secret rollback 없음.
- 재발 자동 중단:
  - Samsung 10회 중 원문 누락 1회 이상, 주기음 1회 이상, 한 사용자 동작에서 권한 요청/recorder/STT 호출이 2회 이상, 화면 복귀 후 새 권한 요청, v3 E2E 실패, Provider billing/auth 실패 중 하나라도 있으면 카나리를 OFF하고 코드 패치를 반복하지 않음.
  - 복구 지점은 main `3b861ff7eefbfdd17bbdbdf1c4f09e7cc603a3a0`의 기본-OFF v4 source 및 운영 `3502ce63340dfe9ec3d4e94bd10f12a3ac66753f`의 v3.5.17 route.
- 다음 게이트: 최종 PR CI/Docker 재확인 → main 병합(배포 없음) → 별도 카나리 배포 표식 PR → STT 사전검증·운영 health·v3 browser E2E·v4 공개 URL 확인 → 사용자 Samsung DEVICE 검증.


## 2026-08-29 · VoiceFlow v4 모바일 음성 카나리 운영 배포 트리거

- 사용자 승인: “마지막 실행단계까지 가” 지시에 따라 PR #202 main 병합과 main CI/Docker 성공 뒤 격리된 v4 모바일 카나리 운영 배포를 진행.
- 배포 대상 source: main `575da8242ce8c275e3067869028a7ab18b0f85ec`.
- 트리거 계약: squash commit 제목에 `[deploy-production] [v4-mobile-canary]`를 함께 포함. 전자는 기존 production workflow를 실행하고 후자는 이 배포에서만 `VOICEFLOW_V4_MOBILE_ENABLED=1`을 전달.
- 배포 전 상태: main Actions run `33248597007` test job `99090244257` PASS, Docker job `99090367520` PASS, deploy/browser-e2e는 표식 부재로 SKIPPED. 운영 v3 route·container는 아직 변경 없음.
- 필수 중단점: 기존 STT Provider 실호출 사전검사가 auth/model/quota/billing/configuration 오류로 실패하면 runtime replacement 전에 STOP. Secret·Provider·과금 설정을 자동 변경하거나 코드 패치로 우회하지 않음.
- 배포 후 필수 증거: local/public health, v3.5.17 artifact, v3 browser E2E, local/public `phase2-speech` marker, speech module, 카나리 meeting URL. Samsung DEVICE는 사용자 실기기 결과 전 UNVERIFIED 유지.
- 롤백: canary 표식 없는 정상 production deploy 또는 환경 플래그 0 reconcile로 v4 route만 OFF. frozen v3.5.17는 유지.


## 2026-08-29 · VoiceFlow v4 모바일 음성 카나리 · PROVIDER BILLING BLOCKED

- 최종 source: main `36da9faaa7b60ed9aab20c69b05bd20b0a670733`.
- 배포 시도와 안전 결과:
  - run `33248773795`, deploy job `99090862200`: DeepL 실번역 PASS, Hub OpenAI credential ready, STT preflight configuration 실패. runtime replacement 전에 STOP.
  - run `33249066434`, deploy job `99091665960`: Provider별 안전 분류를 추가했으나 preflight가 Hub hydration을 우회한 원인을 확인. runtime replacement 전에 STOP.
  - 최소 원인 수정 PR #205: preflight를 운영 core와 동일한 `services/integration-env-launcher.mjs`로 실행하고 deploy guard에 계약 고정. test/Docker PASS.
  - run `33249317949`, deploy job `99092305163`: Hub hydration 후 최종 실호출 결과 OpenAI `billing_or_quota`, Gemini `configuration`. DeepL 번역 PASS. runtime replacement 전에 STOP.
- 확정 원인:
  - 첫 기술 원인: 신규 배포 사전검사가 Provider Hub 주입 launcher를 통하지 않음. PR #205에서 최소 수정 완료.
  - 남은 외부 차단: OpenAI STT 자격은 연결되지만 실제 transcription 호출의 billing/quota가 차단됨. Gemini STT 자격은 구성되지 않음.
  - 이 상태는 코드 회귀가 아니므로 추가 fallback·모델 변경·Secret 생성·Provider 전환·과금 변경을 자동 수행하지 않음.
- 단계별 최종 상태:
  - SOURCE PASS · v4 speech session, default-OFF canary, hydrated preflight가 main에 병합됨.
  - CI PASS · run `33249317949`, test job `99092125313`.
  - DOCKER PASS · 같은 run docker job `99092259784`.
  - PROVIDER STT FAIL/BLOCKED · OpenAI billing_or_quota / Gemini configuration.
  - DEPLOY BLOCKED BEFORE REPLACEMENT · 세 실행 모두 `say 20` 이전 STT gate에서 종료. `say 40` runtime artifact copy, `say 54` reconcile, v4 route ON, canary meeting 생성, 운영 E2E는 실행되지 않음.
  - OPERATING UNCHANGED BY ATTEMPTS · 실행 중 container/image/runtime-public에 대한 교체 명령 이전에 종료. 운영 v3.5.17 경로 보존, v4 공개 카나리 미활성.
  - DEVICE UNVERIFIED · Samsung URL이 생성되지 않았으므로 권한·10회 원문·주기음·지연·화면복귀 검증 미실행.
- 비용 상태:
  - 신규 Provider·Secret·DB·DNS·인프라 추가 없음.
  - DeepL 사전번역 3회와 OpenAI STT probe 호출 시도만 발생. 확정 청구액은 Provider 관리자 청구 화면 없이는 확인하지 않으며 예상/확정 비용을 혼동하지 않음.
- 사용자에게 필요한 외부 조치:
  - 선택 1: 현재 OpenAI 프로젝트의 billing/credit/quota를 활성화하고 `gpt-4o-mini-transcribe` 사용 가능 상태를 복구.
  - 선택 2: STAR45 Provider Hub에 유효한 Gemini 자격·지원 STT 모델을 구성.
  - 둘 중 하나가 완료되면 동일 카나리 배포 표식으로 재실행. 새 Provider 구매·Secret 저장·과금 승인은 사용자/관리자 권한 없이는 수행 금지.
- 정확한 복구/재개 지점:
  - 현재 안전 운영은 v3.5.17 frozen route. v4 source는 default OFF.
  - Provider 복구 뒤 main `36da9faaa7b60ed9aab20c69b05bd20b0a670733` 이상에서 test/Docker → hydrated STT live PASS → runtime replacement → v3 E2E → v4 URL → Samsung DEVICE 순서만 허용.


## 2026-08-29 · Golden b98 API 확정 및 v4 단발 브라우저 STT 후보

- 사용자 확인 요청:
  - 이전에 실제 사용한 API를 확인한 뒤 다음 단계와 최종 실행까지 진행.
  - Samsung 스마트폰 주기음과 원문 미표시를 반복 패치하지 말고, 과거 성공 코드와 속도 단축 시점을 먼저 비교.
- Golden 근거:
  - Samsung DEVICE Golden `b98dcdd6d5b97f18fd3d5fc960817b3f50959740`, app v3.5.6.
  - b98 생성 체인의 `patch-mobile-browser-first-v349.mjs`는 Android Chrome의 `SpeechRecognition/webkitSpeechRecognition`을 1차 원문 인식으로 사용하고, 지원하지 않는 모바일만 서버 STT로 보냄.
  - 서버 `/api/v1/meetings/{id}/transcribe`의 순서는 OpenAI `gpt-4o-mini-transcribe` 우선, Gemini 오디오 대체였으나 Samsung Golden의 주 경로는 이 서버 API가 아니라 브라우저 Web Speech API였음.
  - 원문 저장 뒤 번역 주 경로는 DeepL. v3.5.5/v3.5.6은 입력언어 고정과 발화 종료→최종문장 지연 측정/표시 변경이며 Provider 선택을 바꾸지 않음.
  - 이후 모바일 watchdog과 `r.onend -> setTimeout(startSpeech,350)` 자동 재시작, no-result 서버 handoff가 주기적 소리/다중 처리 위험을 만들 수 있음. DEVICE trace가 없어 이것을 단일 확정 원인으로 과장하지 않음.
- 이번 후보 변경:
  - 신규 Provider·Secret·DB·DNS 추가 없이 b98의 Android Chrome browser STT를 격리된 `mobile-browser-speech-session`으로 복원.
  - 사용자 버튼 1회당 recognition 1개, `continuous=false`, 자동 재시작·watchdog·timer·MediaRecorder·getUserMedia·자동 서버 fallback 없음.
  - final 원문은 기존 `mobile-caption-session.submit()`으로 즉시 표시·저장하고 번역은 기존 caption/DeepL 경로가 단독 소유.
  - Golden predicate 밖의 기기만 기존 수동 MediaRecorder/server-STT 경로를 유지. server STT live gate는 해당 fallback을 명시적으로 요구할 때만 수행.
  - v3.5.17 운영 route와 frozen artifact는 변경하지 않으며 v4 route는 계속 기본 OFF.
- 검증 상태:
  - RED 계약: 신규 adapter 생성 전 테스트가 참조할 모듈이 없음을 확인하고 단발성/무 timer/무 자동 재시작 계약을 먼저 추가.
  - CODE/PR/CI/DOCKER/OPERATING/DEVICE: 진행 중. PASS는 해당 증거가 생성된 뒤 갱신.
- 자동 중단:
  - 한 버튼 동작에서 recognition 시작 2회 이상, onend/error 뒤 자동 재시작, 주기음, 10회 중 원문 누락 1회 이상, 원문 저장 전 소실, 기존 v3 artifact/E2E 변화 중 하나라도 확인되면 카나리 OFF.
- 롤백:
  - `VOICEFLOW_V4_MOBILE_ENABLED=0`으로 v4 route만 즉시 OFF. v3 운영 rollback·DB migration·Secret 복구는 필요 없음.


### PR #207 검증 갱신

- PR: #207, 최종 검증 head `ee6e3df0ab58276a49c549688924cf800f100ca2`.
- FOCUSED PASS:
  - `VOICEFLOW_V4_PHASE2_GOLDEN_BROWSER_SPEECH_PASS`.
  - 버튼 1회→recognition 1개, `continuous=false`, final 원문 1회 commit, onend/error 자동 재시작 0회.
  - browser adapter에 timer/MediaRecorder/getUserMedia 없음.
- CI PASS: Actions run `33250460484`, test job `99095139153`.
  - 기존 caption/media/server-STT/v4 OFF route, v3 frozen artifact, PC video session reentry와 전체 repository test PASS.
- DOCKER PASS: 같은 run docker job `99095292439`.
- DEPLOY/OPERATING/DEVICE PENDING:
  - PR CI에서는 deploy-production과 browser-e2e가 표식 부재로 skipped.
  - main 병합 뒤 별도 `[deploy-production] [v4-mobile-canary]` 표식에서 DeepL live gate, runtime 교체, v3 browser E2E, v4 공개 URL을 확인해야 함.
  - Samsung 10회 원문·권한 횟수·주기음·화면복귀는 실제 기기 확인 전 PASS 금지.


## 2026-08-29 · v4 Golden 브라우저 STT 카나리 배포 요청

- 배포 대상: main `da50fea34742fc7a2ea14a483e581d0bff5db6b3` 이상.
- 표식: `[deploy-production] [v4-mobile-canary]`.
- 사전 근거: PR #207 exact head `143edf71ab62d861b8b8db38b83b6902fdec8d32`, Actions run `33250570456`, test `99095415634` PASS, docker `99095548017` PASS.
- 배포 목적: v3.5.17 운영 회귀를 유지하면서 `/v4/mobile` Golden browser STT 카나리만 활성화.
- Provider 정책: DeepL live translation gate 유지. Samsung Golden browser STT는 서버 STT를 호출하지 않으므로 `VOICEFLOW_V4_MOBILE_SERVER_STT_REQUIRED=0`; OpenAI/Gemini STT 과금·설정 변경 없음.
- 운영 게이트: runtime replacement, health, v3 browser E2E, 공개 v4 marker/module/URL이 모두 PASS해야 링크 제공.
- DEVICE gate: Samsung에서 10회 원문, 권한 요청 횟수, 주기음, 화면 숨김/복귀를 확인하기 전 최종 PASS 금지.
- 실패 시: 배포 script가 replacement 전후 해당 단계에서 중단하며, v4 route OFF 재배포로 즉시 롤백.


### v4 Golden 브라우저 STT 카나리 운영 증거

- 배포 main: `1223d15348624cd290643ba92de64c4db11f1c68`.
- Actions: run `33250792205`.
  - test `99096004205` PASS.
  - docker `99096143264` PASS.
  - deploy-production `99096192159` PASS.
- Provider:
  - 기존 DeepL Secret 복구 후 live `ko → vi-VN` 번역 응답 `{"ok":true,"provider":"deepl","translated":true}` PASS.
  - Samsung Golden path는 browser STT이므로 paid server STT gate 불필요. OpenAI/Gemini Secret·billing·모델 변경 없음.
- 운영:
  - runtime 전체 health PASS.
  - 기존 v3.5.17 브라우저 E2E 18/18 PASS, no browser page errors.
  - 공개 v4 HTML marker `phase2-browser-speech`, app wiring, `mobile-browser-speech-session` module PASS.
  - 카나리 URL: `https://voice.star45.net/v4/mobile?meeting=mtg_mtebg0ak_r0gd6p`.
  - 배포 스크립트 최종 `OVERALL 100% PASS`.
- 별도 직접 브라우저 확인:
  - 위 공개 URL이 redirect 없이 열리고 title `VoiceFlow v4 모바일 원문`, status `원문 입력 준비 완료`, marker `phase2-browser-speech`, module script `/v4/mobile/app.mjs` 확인.
  - `voice.star45.net` page-origin warning/error 0건. Cloud 데스크톱 UA에서는 설계대로 서버 수동 fallback UI가 보이며 Android Chrome Golden 분기는 Samsung UA에서만 활성화.
- DEVICE PENDING:
  - 실제 Samsung Chrome의 마이크 권한·브라우저 음성 final 이벤트·스피커 소리는 원격 브라우저로 대신 판정 불가.
  - 주인님 Samsung에서 링크를 열고 `음성 원문 시작` 10회, 주기음 0회, 원문 누락 0회, 화면 숨김/복귀 후 자동 재시작 0회를 확인해야 최종 DEVICE PASS.
- 즉시 롤백:
  - DEVICE 실패 시 `VOICEFLOW_V4_MOBILE_ENABLED=0` 배포로 v4 route만 OFF. 기존 v3.5.17 운영은 유지.


## 2026-08-29 · v4 Samsung 원문 체감속도 분리 및 운영 배포

- DEVICE 제보 증거:
  - Samsung 화면에서 browser Web Speech 원문·DeepL 번역은 성공했으나 상태가 `원문 완료 · 17.2초 · browser-web-speech`로 표시되어 체감속도 FAIL.
  - 이 17.2초는 기존 코드가 recognition 시작부터 caption 저장·번역 응답까지를 하나의 latency로 계산한 값이며 순수 인식 지연이 아니었음.
- 최소 변경:
  - PR #210에서 Android Chrome Web Speech의 `onspeechend`에 recognition stop을 단 한 번만 요청하여 final 확정을 앞당김.
  - final 수신 즉시 `lastText`와 optimistic caption을 먼저 표시하고, 저장·DeepL 번역은 이어서 비동기 완료.
  - `speechend → final` recognition latency와 `final → caption/translation 완료` latency를 분리 표시.
  - timer·watchdog·자동 재시작·MediaRecorder·getUserMedia·Provider 변경 없음. v3/PC 코드 변경 없음.
- API/Provider:
  - Samsung Golden 주 경로는 `SpeechRecognition/webkitSpeechRecognition` (`browser-web-speech`).
  - 원문 저장은 기존 caption API, 번역은 기존 DeepL 경로 유지. OpenAI/Gemini 서버 STT·Secret·과금 설정 변경 없음.
- 검증 증거:
  - PR #210 head `cae909b85a9dac8558ce144c12528f57869a5a93`, Actions run `33252192800`: test `99099670660` PASS, docker `99099821328` PASS.
  - source main `b9435f3ada45ff44371e388d2d970179d0939c56`; main run `33252286107`: test `99099931321` PASS, docker `99100070053` PASS.
  - deployment marker main `c3d90e354c01fd6009733793c7f448199b14b61b`, run `33252400020`: test `99100226294` PASS, docker `99100371968` PASS, deploy `99100424375` PASS.
  - 운영 runtime health 전체 PASS, v3 browser E2E 18/18 PASS, no browser page errors, v4 canary URL 유지, 배포 최종 OVERALL 100% PASS.
  - 공개 운영 app/module에서 새 원문-first 문구, split timing, `onspeechend`, `recognitionLatencyMs` 반영 확인. 신규 timer/MediaRecorder/getUserMedia 없음.
- 단계 판정:
  - SOURCE PASS · CI PASS · DOCKER PASS · DEPLOY PASS · OPERATING PASS.
  - DEVICE FUNCTION CONDITIONAL: 이전 Samsung 캡처에서 원문·번역 동작은 확인되었으나 이번 속도 변경 후 실기기 지연은 UNVERIFIED.
  - DEVICE SOUND UNVERIFIED: 이번 사용자가 주기음 0회를 직접 확인하기 전 PASS 금지.
  - PC/MOBILE UI PARITY N/A: 이번 변경 범위가 아니며 다음 UI 공통화 단계에서 별도 처리.
- 비용: 신규 API·Secret·DB·DNS·인프라 없음. 기존 사용량 외 증분 고정비 없음.
- 롤백: `VOICEFLOW_V4_MOBILE_ENABLED=0` 배포로 v4 route만 OFF하거나 source main `b9435f3` 이전으로 v4 세 파일만 되돌림. 기존 v3.5.17 운영은 유지.

## 2026-08-29 · PR #212 · v4 모바일 캡션룸 PC형 UI 정렬 및 운영 배포

- 태그: 모바일, UI, PC정렬, Golden, CI, 배포, E2E
- 사용자 목표: Samsung에서 확인된 빠른 원문 경로를 유지하면서 모바일 화면을 PC 대화방의 정보 구조와 일치시키고 실제 운영까지 반영.
- 최소 변경:
  - `frontend-v4/apps/mobile-pwa/index.html`, `styles.css`, UI 계약 테스트만 수정.
  - 제목·언어/참여자/음성 툴바·원문/번역 영역·하단 입력창을 PC 순서로 정렬.
  - `100dvh` 그리드에서 대화 영역만 스크롤해 393×852에서도 입력창이 항상 보이도록 함.
  - 실제 v4 기능이 없는 초대/화상/자료/의장모드 버튼은 가짜로 만들지 않고 기존 앱 `홈으로` 링크 유지.
- Golden 보호:
  - `app.mjs`, browser Web Speech adapter, caption/API/Provider, timer/자동재시작/MediaRecorder/getUserMedia 경로 불변.
  - Samsung Golden 주 경로 `browser-web-speech`, 기존 caption 저장·DeepL 번역 경로 유지. 신규 API/Secret/DB/DNS/비용 없음.
- 검증 증거:
  - PR #212 head `16723850d7eef6d5ad200aa4556555399fdd2f08`, CI run `33254440360`: test `99105597334` PASS, docker `99105783429` PASS.
  - source main `e4420e5865c169b35eaa5e283c27ceaf8b091df6`; deployment marker `cfb90379efe560f01bdd11c0037f6d868bd685a6`.
  - production run `33254568171`: test `99106034215` PASS, docker `99106193230` PASS, deploy `99106239652` PASS.
  - runtime health 전체 PASS, 기존 v3 browser E2E 18/18 PASS, v4 canary 검증, 배포 최종 OVERALL 100% PASS.
  - 공개 URL redirect 없음, title `음성메모 · 기본 대화방`, marker `pc-aligned-mobile-v1`, toolbar/conversation/composer와 필수 control 존재, 데스크톱 public viewport page overflow 0 확인.
  - 로컬 393×852에서 client/scroll 크기 일치, 시작→완료 상태와 수동 원문 전송, page-origin console error 0 확인. `design-qa.md` final result passed.
- 단계 판정:
  - SOURCE PASS · SYNTAX/TEST PASS · CI PASS · DOCKER PASS · DEPLOY PASS · OPERATING PASS · DESIGN QA PASS.
  - API/DB N/A(변경 없음).
  - DEVICE UI UNVERIFIED: 실제 Samsung Chrome 주소·하단 바가 포함된 100dvh 배치는 사용자 새 캡처 전 PASS 금지.
  - DEVICE SOUND UNVERIFIED: 주기음 0회는 사용자 확인 전 PASS 금지.
  - 전체 PC 기능 동등성 CONDITIONAL: 초대/화상/자료/의장모드는 격리 v4 캡션 모듈 범위 밖이며 기존 앱에서만 제공.
- 롤백: `VOICEFLOW_V4_MOBILE_ENABLED=0`으로 v4 route만 OFF하거나 PR #212의 HTML/CSS/테스트를 되돌림. v3.5.17·DB·DNS·Secret·Provider는 영향 없음.

## 2026-08-30 · 운영 502 재배포 복구와 시작 버튼 증거 충돌

- 사용자 제보: 과거 테스트에서 시작 버튼을 눌렀을 때 음성이 정상 동작했으며, 일반 앱에도 명시적인 대화 녹음 시작 버튼을 유지할 것을 요청.
- 소스 확인:
  - main `e62a20a65d55f3f7bfeb83e05f43ecc380d3e070`의 일반 앱에는 `meetingStart` → `startMeeting` → `startAudio` → `startSpeech` 사용자 클릭 경로가 존재.
  - v4 모바일에는 `#startSpeech` `음성 원문 시작` 버튼과 단발 Golden browser speech 경로가 존재.
  - 따라서 신규 음성 엔진·자동 시작·Provider 변경은 하지 않고 기존 사용자 동작 기반 시작 경로를 보호.
- 장애 관측:
  - 외부 Cloud Browser에서 `https://voice.star45.net/`와 `/v4/mobile`이 모두 `502 Bad Gateway · [Errno 111] Connection refused`로 관측됨.
  - 기존 검증된 production run `33254568171`의 deploy job `99106239652`를 새 코드 변경 없이 재실행.
- 재배포 attempt 2:
  - run `33254568171`, attempt 2.
  - test job `99185610155` PASS.
  - docker job `99185610450` PASS.
  - deploy-production job `99185610192` PASS.
  - 서버 내부 local/public version·health, v4 marker/module, 기존 v3 browser E2E 18/18, `home voice start opens recording room`, `current voice recording flow` PASS; 최종 `OVERALL 100% PASS`.
- 증거 충돌:
  - 동일 시점 외부 Cloud Browser는 캐시 우회 URL에서도 502가 지속됨.
  - 따라서 SOURCE·CI·DOCKER·DEPLOY는 PASS, 서버 내부 OPERATING 검사는 PASS이나 독립 외부 OPERATING은 CONDITIONAL.
  - Samsung 실제 마이크 권한, 시작 버튼 탭, 원문·번역·주기음은 DEVICE UNVERIFIED.
- 변경 범위: 운영 재배포 재실행과 원장 기록만 수행. 기능 코드·DB·DNS·Secret·Provider·비용 설정 변경 없음.
- 다음 중단점:
  - 외부 502가 실제 사용자 기기에서도 재현되면 UI 수정 금지. public reverse proxy → host port 4173 연결을 먼저 진단.
  - 앱이 열리면 기존 시작 버튼의 사용자 동작 기반 권한 획득을 유지하고 자동 마이크 시작으로 대체하지 않음.
- 롤백: 코드 변경 없음. 재배포된 compose stack은 기존 main `e62a20a`와 v4 canary ON 계약이며, v4만 문제면 `VOICEFLOW_V4_MOBILE_ENABLED=0` 배포로 격리 가능.


## 2026-08-30 · PR #215 · Gemini 3.5 Transcribe 전용 엔드포인트 계약 복구

- 태그: STT, Gemini, Provider, API, 회귀검사, 기본경로보호
- 증상: 관리자에서 `gemini-3.5-transcribe`를 선택해도 서버 adapter가 전용 Interactions API가 아니라 `:generateContent`를 호출하고, 실패 시 일반 Flash 모델로 우회할 수 있어 선택 모델과 실제 런타임이 불일치함.
- 최초 잘못된 상태: main `6f280bf4e3cd4d78e7cdb4808eba627b18c89958`에서 전용 모델명을 기존 generateContent 전송에 결합. 최신 main `f92e5712bbcc193223411b096a7f982b8973e97e`에도 유지됨.
- 공식 계약 확인: 2026-08-30 Google Gemini 공식 문서는 비실시간 `gemini-3.5-transcribe`를 Files API 업로드 후 `POST /v1beta/interactions`로 호출하고, Live 모델은 별도 WebSocket Live API를 사용하도록 규정.
- RED 증거: PR #215 head `6f5ff4e6c2f2dee98e2f1ff8d57e608e6d00be6f`, run `33290927342`, test job `99202296474`가 첫 `npm test`에서 `unexpected_fetch:...gemini-3.5-transcribe:generateContent`로 실패. Docker는 의존 실패로 skipped.
- 최소 수정:
  - 전용 비실시간 모델에만 Files API resumable upload → Interactions API → 업로드 파일 DELETE 적용.
  - BCP-47 입력 언어를 `transcription_config.language_codes`로 전달.
  - 일반 Gemini Flash의 기존 generateContent, OpenAI, DeepL, browser Web Speech, v3.5.17 및 v4 Samsung Golden 경로는 변경하지 않음.
  - 전용 모델에서 generateContent 금지, 응답 텍스트, transport, 파일 삭제를 검증하는 focused test 추가.
- 검증:
  - SOURCE PASS · 후보 head `7d8b4d29fee3848155f328e7eb919f815d8880fe`.
  - CONTRACT/CI PASS · run `33290996539`, test job `99202477167`; `GEMINI_3_5_TRANSCRIBE_INTERACTIONS_PASS`와 전체 `npm test` 성공.
  - DOCKER PASS · 같은 run docker job `99202621159`.
  - DEPLOY SKIPPED · 배포 표식 없음. 운영 코드·컨테이너·DB·DNS·Secret 미변경.
  - OPERATING UNCHANGED · 기존 검증 운영본과 v4 카나리 유지.
  - PROVIDER LIVE UNVERIFIED · 실제 Gemini 자격과 실제 오디오 호출은 운영 배포 전 별도 사전검사 필요.
  - DEVICE UNVERIFIED · PC/Samsung 실기기 원문·번역은 후보 미배포로 미실행.
- 비용: 테스트는 mock fetch만 사용해 Provider 호출·청구 없음. 실제 카나리에서는 음성 구간당 Gemini 업로드·Interactions 1회가 발생하며 확정 단가는 Provider 청구 화면으로 별도 확인.
- 롤백: PR #215의 adapter/test/package 변경만 제거. 운영에는 아직 반영되지 않아 운영 롤백 불필요.
- 다음 게이트: PR 병합 전 실제 Gemini live probe를 격리 실행하고 성공한 경우에만 배포 표식 카나리에서 runtime health·v3 E2E·v4 공개 URL·Samsung DEVICE를 순서대로 검증.


## 2026-08-30 · PR #217 · v4 STT runtime 라우팅을 v3/PC 공용 경로에서 격리

- 태그: STT, v4, v3보호, PC보호, Provider, 회귀검사, 배포가드
- 선행 정정: Gemini 전용 Interactions 수정은 draft PR #215를 닫고 일반 PR #216으로 동일 head를 재개해 main `f166bf93b860b87cd7f3dbbba31992b1fdf86cdd`에 병합됨.
- 증상: `transcribeExternal()`의 `provider='auto'` 기본 호출이 관리자 `functionRouting.stt_realtime`을 항상 읽어, 공용 `/api/v1/meetings/{id}/transcribe`를 쓰는 기존 v3/PC 서버 fallback도 v4용 Gemini 선택의 영향을 받을 수 있었음.
- 소비자 추적:
  - 기존 v3/PC 서버 fallback과 v4 mobile speech가 동일 transcribe endpoint를 공유.
  - v4 요청을 구분하는 header가 없었고, live provider probe도 공용 기본 호출을 사용.
- RED 증거:
  - PR #217 head `e8c00f1d7a1a5ac003ed23effaf905a06bbb41b0`, run `33291354819`, test job `99203415284` FAIL.
  - 신규 회귀검사가 기존 경로 예상 `v3-openai` 대신 실제 `v4-gemini`를 관측해 라우팅 누수를 재현.
- 최소 수정:
  - adapter runtime routing을 `useRuntimeRouting:true`일 때만 읽도록 opt-in화.
  - v4 mobile adapter만 `x-voice-client: v4-mobile`을 전송하고 서버 endpoint가 그 요청에만 opt-in 전달.
  - 배포 전 live STT probe는 `useRuntimeRouting:true`로 실제 선택된 v4 provider/model을 검사.
  - build-time STT usage patch도 동일 client marker와 opt-in을 보존하도록 exact anchor 갱신.
  - OpenAI→Gemini 기본 fallback, v3 browser Web Speech, DeepL 번역, Gemini 일반 Flash, DB·DNS·Secret은 변경하지 않음.
- GREEN 검증:
  - 후보 head `5c2938e70e56db5f419c5c49c2fa04506880a0cd`, run `33291479943`.
  - SOURCE/TEST PASS · test job `99203765519`: 신규 `VOICEFLOW_STT_RUNTIME_ROUTING_ISOLATION_PASS`, Gemini Interactions test, v4 mobile speech test 및 전체 npm test 성공.
  - BUILD ARTIFACT PASS · 새 server 형태에서 `patch-stt-usage-v364` 재생성 검증 성공.
  - DOCKER PASS · job `99203903935`.
  - DEPLOY SKIPPED · job `99203961497`; 배포 표식 없음.
  - BROWSER E2E SKIPPED · job `99203961469`; source-only PR.
  - OPERATING UNCHANGED · 기존 검증 운영본 유지.
  - PROVIDER LIVE UNVERIFIED · 실제 Gemini 자격·모델·quota probe는 안전한 배포 preflight 전 미실행.
  - DEVICE UNVERIFIED · PC/Samsung 실제 원문·번역·권한·주기음 검증 전 최종 PASS 금지.
- 비용: mock 테스트만 실행하여 신규 Provider 청구 없음. 운영 preflight/카나리 실행 시 실제 Gemini STT 요청 비용이 발생할 수 있음.
- 롤백: PR #217의 adapter/server/v4 mobile/verify script/build patch/test/package 변경만 되돌림. 미배포 상태이므로 현재 운영 롤백 불필요.
- 다음 게이트: final head CI/Docker PASS 후 source 병합. 운영 배포는 live provider preflight가 runtime replacement 전에 PASS하고 BLOCKER/HIGH가 없을 때만 별도 카나리로 진행.


## 2026-08-30 · PR #219 · v4 서버 STT 카나리 preflight 표식 가드

- 태그: 배포가드, STT, Gemini, 카나리, Provider, 회귀검사
- 증상: 기존 `[v4-mobile-canary]`는 Golden browser STT로 분류되어 `VOICEFLOW_V4_MOBILE_SERVER_STT_REQUIRED`가 0인 채 실제 Gemini server STT live probe를 건너뜀.
- RED: PR #219 head `084021b5ab14def0a311b55d3c1c69d832eac36b`, run `33291853839`, test `99204744967`가 CI workflow에 `[v4-mobile-server-stt]` 표식이 없음을 정확히 검출해 FAIL.
- 최소 수정:
  - `.github/workflows/ci.yml` deploy job에 `[v4-mobile-server-stt]` commit marker 기반 `VOICEFLOW_V4_MOBILE_SERVER_STT_REQUIRED=1` env 연결.
  - deploy/runtime guard test가 marker/env와 live STT probe가 production artifact replacement 이전에 위치함을 검증.
  - Provider·Secret·모델·운영 runtime 변경 없음.
- GREEN: head `4adbab327ec46a8243de9226b9c0899a5c3f401c`, run `33291888938`; test `99204845070` PASS, Docker `99204978305` PASS, deploy `99205025462` SKIPPED, browser E2E `99205025249` SKIPPED.
- 단계 판정: SOURCE/CI/DOCKER PASS · DEPLOY/OPERATING/PROVIDER LIVE/DEVICE UNVERIFIED.
- 비용: 이 PR은 Provider를 호출하지 않아 추가 과금 없음. 실제 marker 배포에서는 replacement 전에 짧은 live STT probe 1회가 발생할 수 있음.
- 롤백: workflow env 한 줄과 guard assertion만 되돌림. 미배포 상태이므로 운영 롤백 불필요.
- 다음 게이트: source 병합과 main CI/Docker PASS 후 `[deploy-production] [v4-mobile-canary] [v4-mobile-server-stt]` marker로 controlled deploy. live probe 실패 시 replacement 전 중단.


## 2026-08-30 · Gemini 3.5 서버 STT controlled canary 배포 시도 시작

- 배포 기준 source main: `43d4217694c9b48f6ae11c9d01c44a28524f3cc8`.
- main 검증: run `33292072137`; test `99205333749` PASS, Docker `99205589412` PASS.
- trigger: `[deploy-production] [v4-mobile-canary] [v4-mobile-server-stt]`.
- 의도: 실제 관리자 STT route를 live probe로 검사한 뒤에만 production replacement 진행.
- 현재 판정: SOURCE/CI/DOCKER PASS · DEPLOY IN PROGRESS · OPERATING/PROVIDER LIVE/DEVICE UNVERIFIED.
- 중단/롤백: live STT 또는 번역 Provider preflight 실패 시 replacement 전 중단. 교체 후 검증 실패 시 기존 deploy script의 복구 절차와 v4 route OFF 사용.


## 2026-08-30 · Gemini 3.5 서버 STT controlled canary 사전검사 중단

- trigger main: `61dfd620b0f6bdd8a20f2be5c96bc694f15a9bd4`.
- Actions run `33292215627`: test `99205717658` PASS, Docker `99205840055` PASS, deploy-production `99205897641` FAIL.
- 사전검사 증거:
  - Provider Hub OpenAI credential resolution PASS.
  - DeepL live `ko → vi-VN` translation PASS.
  - live STT FAIL: OpenAI `billing_or_quota`, Gemini `configuration`.
  - `VOICEFLOW_LIVE_STT_PROVIDER_FAIL` 후 `FAIL: live STT Provider unavailable before v4 mobile server fallback`.
- 안전 판정:
  - deploy script 12% Prepare runtime environment 단계에서 중단.
  - production artifact build·container replacement·runtime reconcile·운영 E2E 단계에 도달하지 않음.
  - 따라서 DEPLOY FAIL(BLOCKED BEFORE REPLACEMENT), OPERATING CODE UNCHANGED.
  - 독립 외부 URL 확인은 현재 검사 환경에서 직접 확인되지 않아 EXTERNAL OPERATING UNVERIFIED.
  - PC/Samsung DEVICE UNVERIFIED.
- 변경 금지 유지: API Secret·billing·quota·관리자 provider 설정을 임의 수정하지 않음.
- 비용: 짧은 DeepL 번역 probe와 STT provider probe 시도 외 배포·인프라 증분 없음. OpenAI는 quota 단계, Gemini는 configuration 단계에서 실패.
- 다음 게이트:
  1. Provider Hub에서 Gemini STT credential/configuration과 `gemini-3.5-transcribe` 선택 상태 확인.
  2. OpenAI fallback을 유지하려면 billing/quota 복구.
  3. 동일 세 marker controlled deploy 재시도 전 live probe 단독 PASS 증거 확보.
- 롤백: 운영 교체 전 중단되어 운영 롤백 불필요. source main은 배포되지 않은 상태로 유지.


## 2026-08-30 · 사용자 결정 · 브라우저 STT 유지, Gemini 서버 STT 추후 등록

- 사용자 결정: 현재 Samsung Golden 경로인 browser Web Speech STT를 운영 기본으로 유지하고, Gemini API 등록과 서버 STT 카나리는 추후 별도 진행.
- 읽기 전용 중앙 Hub 확인:
  - Gemini integration `int-gemini-star45-company-os`는 production/active이나 활성 credential 0개.
  - Gemini binding은 `APP:company-os`, `APP:coreon-marketing`만 존재하고 VoiceFlow 소비자 `PROJECT:meeting` 연결은 없음.
  - OpenAI는 활성 credential 2개와 `PROJECT:meeting` 연결이 있으나 live STT는 `billing_or_quota` 차단.
  - DeepL은 중앙 Hub integration이 없지만 배포 preflight에서 기존 운영 Secret 복구 및 실제 번역 PASS.
- 확정 원인: Gemini 서버 STT 실패는 코드·런처 회귀가 아니라 Provider credential과 VoiceFlow consumer binding 미구성.
- 변경 범위: 의사결정·진단 기록만 수행. 앱 코드, DB 행, Provider Secret, billing/quota, 운영 컨테이너, DNS 변경 없음.
- 단계 판정:
  - SOURCE PASS/UNCHANGED · 기존 v3/PC 및 v4 browser STT 보호.
  - CI/DOCKER PENDING · 원장 기록 커밋 검증 예정.
  - DEPLOY N/A · 배포 표식 없음.
  - OPERATING UNCHANGED · 직전 서버 STT 카나리는 replacement 전에 차단됨.
  - PROVIDER DeepL PASS · OpenAI FAIL(BILLING/QUOTA) · Gemini FAIL(NOT CONFIGURED).
  - DEVICE Samsung CONDITIONAL · 기존 browser STT Golden 경로 유지, 이번 결정 이후 새 실기기 테스트 미실행.
  - DEVICE PC UNVERIFIED · 운영 변경 없음.
- 재개 조건:
  1. Provider Hub에서 Gemini API Key를 관리자 화면에 직접 등록하며 Secret을 채팅·로그에 노출하지 않음.
  2. Gemini integration에 VoiceFlow `PROJECT:meeting` binding/consumer를 명시적으로 연결.
  3. `gemini-3.5-transcribe` 선택 → live provider probe PASS → controlled canary → 운영/PC/Samsung 검증 순서.
- 자동 중단: 위 credential과 binding이 준비되기 전에는 Gemini 코드 패치·서버 STT 재배포를 반복하지 않음.
- 롤백: 운영·DB 변경이 없어 불필요.

## 2026-08-30 · 브라우저 STT 전용 v4 모바일 카나리 운영 배포 시작

- 사용자 결정: Samsung Golden 경로인 browser Web Speech STT를 유지하고 Gemini 서버 STT 등록은 추후 별도 진행.
- 배포 기준 source main: `0fcd9e0df4ece5a0ffce93b1c5100be92557549c`.
- 직전 main 검증: Actions run `33293545863`; test/Docker PASS, deploy/browser E2E는 배포 표식 부재로 SKIPPED.
- trigger: `[deploy-production] [v4-mobile-canary]`. `[v4-mobile-server-stt]`는 의도적으로 제외.
- Provider 정책:
  - Samsung STT는 기존 `browser-web-speech` 경로를 유지.
  - OpenAI/Gemini 서버 STT live probe와 서버 STT 과금 경로는 N/A.
  - 기존 DeepL live 번역 preflight는 유지하며 실패 시 production replacement 전에 중단.
- 보호 범위: v3.5.17/PC, 기존 브라우저 STT, caption/DeepL 계약, DB·DNS·Secret·Provider 설정 불변.
- 현재 판정: SOURCE PASS · CI/DOCKER PASS · DEPLOY IN PROGRESS · OPERATING/DEVICE UNVERIFIED.
- 완료 기준: DeepL preflight, runtime replacement, 전체 health, v3 browser E2E 18/18, 공개 v4 marker/module/canary URL이 모두 PASS.
- 롤백: 배포 후 자동검사 실패 시 기존 deploy script 복구 절차를 사용하고, v4 문제는 `VOICEFLOW_V4_MOBILE_ENABLED=0`으로 route만 OFF. 실제 Samsung 마이크는 사용자 확인 전 PASS로 판정하지 않음.


## 2026-08-30 · 브라우저 STT 전용 v4 모바일 카나리 운영 배포 완료

- 배포 trigger SHA: `356af4d3b30bb4cbf4377703acad4908907d0e54`.
- Actions run `33293743838`:
  - test job `99209756672` PASS.
  - Docker job `99209888378` PASS.
  - deploy-production job `99209948651` PASS.
  - 별도 browser-e2e job은 SKIPPED; 운영 E2E는 deploy script 내부에서 실행됨.
- STT/Provider 증거:
  - `VOICEFLOW_V4_MOBILE_ENABLED=1`.
  - `VOICEFLOW_V4_MOBILE_SERVER_STT_REQUIRED=0`.
  - 로그 `Golden browser STT canary selected; paid server STT gate not required` 확인.
  - 기존 DeepL Secret을 비노출 복구하고 live `ko → vi-VN` 응답 `provider=deepl`, `translated=true` PASS.
  - OpenAI/Gemini 서버 STT probe·호출·과금 경로는 N/A. Gemini credential/binding 미구성 상태를 변경하지 않음.
- 운영 증거:
  - runtime 전체 health endpoint와 서비스/페이지 PASS.
  - 기존 v3 browser E2E `18/18 PASS`, browser page error 0.
  - v4 모바일 카나리 검증 PASS.
  - 카나리 URL: `https://voice.star45.net/v4/mobile?meeting=mtg_mtebg0ak_r0gd6p`.
  - 최종 `OVERALL 100% PASS`.
- 단계 판정:
  - SOURCE PASS · CI PASS · DOCKER PASS · DEPLOY PASS · OPERATING PASS(배포 러너의 local/public 검증).
  - INDEPENDENT EXTERNAL OPERATING UNVERIFIED · 별도 외부 네트워크 관측 도구로 재확인하지 못함.
  - DEVICE Samsung UNVERIFIED · 실제 마이크 권한, 원문·번역, 주기음 0회, 화면 복귀는 사용자 실기기 확인 전 PASS 금지.
  - DEVICE PC UNVERIFIED · 이번 배포 후 실제 PC 마이크 확인은 미실행.
  - API 변경 N/A · DB/DNS/Secret/Provider 설정 변경 N/A.
- 운영 교체 관측: 첫 container stop부터 gateway start까지 약 65초. 영속 DB 변경 없음.
- 비용: 서버 STT 호출 없음. 짧은 DeepL live 번역 probe 1회 외 신규 Provider·인프라 증분 없음; 확정 청구액은 Provider 청구 화면 미확인.
- 롤백: v4 이상 시 `VOICEFLOW_V4_MOBILE_ENABLED=0` 배포로 v4 route만 OFF. v3.5.17·DB·DNS·Secret은 유지.


## 2026-08-30 · Samsung 실기기 브라우저 STT 원문·DeepL 번역 성공 증거

- 사용자 제공 Samsung 화면 증거:
  - 운영 도메인 `voice.star45.net`의 v4 모바일 기본 대화방이 실제 기기에서 열림.
  - 화면 UI상 KakaoTalk 인앱 브라우저로 추정되나 정확한 앱/버전은 UNVERIFIED.
  - 입력 문장 `오늘 회의를 시작하겠습니다`가 원문으로 정확히 표시됨.
  - 베트남어 `Hôm nay chúng ta sẽ bắt đầu cuộc họp`이 원문과 다른 번역 결과로 표시됨.
  - 화면 상태 `원문 표시 0.1초 · 번역 완료 1.0초 · browser-web-speech` 확인.
  - `Golden 브라우저 음성인식 · 서버 STT 없이 한 문장씩 처리` 표시 확인.
- 판정:
  - DEVICE Samsung ACCESS PASS · 운영 URL과 v4 모바일 UI 실제 접근 확인.
  - DEVICE Samsung STT FUNCTION PASS(SINGLE SAMPLE) · 실제 음성 한 문장의 원문 생성 확인.
  - DEVICE Samsung TRANSLATION PASS(SINGLE SAMPLE) · 한국어→베트남어 번역 표시 확인.
  - DEVICE LATENCY PASS(SCREEN-REPORTED) · 원문 0.1초, 번역 완료 1.0초.
  - DEVICE SOUND UNVERIFIED · 주기음 0회 여부는 정지 화면으로 판정 불가.
  - DEVICE PERMISSION CONDITIONAL · 한 발화가 성공했으므로 마이크 권한 획득은 확인되나 반복 권한 팝업 여부는 정지 화면으로 판정 불가.
  - DEVICE 10-RUN RELIABILITY UNVERIFIED · 단일 성공 화면이며 10회 누락 0건 조건은 아직 미확인.
  - SAVE/RECONNECT UNVERIFIED · 새로고침·재접속 후 동일 caption 보존은 화면만으로 미확인.
- SOURCE/CI/DOCKER/DEPLOY/OPERATING: 직전 배포 PASS 유지. 이번 단계는 코드·운영·DB·DNS·Secret·Provider 설정 변경 없음.
- 비용: browser STT는 서버 STT 호출 없음. 번역은 기존 DeepL 경로 사용.
- 다음 게이트: 주기음 없음·권한창 반복 없음 확인 후 짧은 반복 발화와 새로고침 보존을 검증. 실패 시 신규 패치 없이 v4 route OFF 또는 Golden 배포점 `356af4d3` 기준으로 증상을 분리.


## 2026-08-30 · Samsung 주기음·반복 권한 팝업 없음 확인

- 사용자 실기기 확인: 앞선 Samsung browser STT 성공 시험 중 주기적인 시스템음과 마이크 허용창 반복이 모두 없었음.
- 판정 갱신:
  - DEVICE Samsung SOUND PASS · 주기음 0회.
  - DEVICE Samsung PERMISSION PASS · 마이크 허용창 반복 0회.
  - DEVICE Samsung CORE FLOW PASS(SINGLE SAMPLE) · 마이크 권한 → 한국어 음성 → 원문 표시 → 베트남어 번역 완료.
  - DEVICE LATENCY PASS(SCREEN-REPORTED) · 원문 0.1초, 번역 1.0초.
  - DEVICE 10-RUN RELIABILITY UNVERIFIED · 반복 10회 성공률은 아직 미확인.
  - SAVE/RECONNECT UNVERIFIED · 새로고침 후 caption 보존은 아직 미확인.
- 변경 범위: 증거 기록만 수행. 앱 소스·운영 컨테이너·DB·DNS·Secret·Provider 설정 변경 없음.
- 현재 Samsung Golden 운영 기준: 배포 trigger `356af4d3b30bb4cbf4377703acad4908907d0e54`, browser Web Speech + 기존 caption/DeepL 경로.
- 다음 게이트: 서로 다른 짧은 문장 3회 추가 성공 후 새로고침하여 이전 원문·번역 유지 여부 확인. 주기음·권한 반복·원문 누락이 한 번이라도 재발하면 신규 패치 없이 즉시 원인 분리.


## 2026-08-30 · PR #221 · Samsung 문장별 재시작을 단일 연속 browser STT로 전환

- 사용자 DEVICE 증상: Samsung 운영 v4에서 원문 0.2초·번역 1.1초, 주기음 0회, 반복 권한 팝업 0회로 정확·빠르게 작동하지만 문장마다 `음성 원문 시작`을 다시 눌러야 함.
- 기대 결과: 시작 버튼 1회 후 여러 문장을 계속 인식·저장·번역하고 `말하기 완료`에서만 종료.
- 마지막 실제 정상 기준: 운영 배포 trigger `356af4d3b30bb4cbf4377703acad4908907d0e54`의 단발 browser Web Speech. 정확도·지연·무주기음·권한 안정성은 보호하고 조작성만 확장.
- 최초 잘못된 상태:
  - v4 `mobile-browser-speech-session`이 `continuous=false`를 강제.
  - 매 `onspeechend`에서 recognition stop을 요청하고 첫 final 뒤 recognition을 제거하여 문장마다 새 사용자 동작이 필요.
- RED 증거:
  - PR #221 run `33300445628`, test job `99227462237`.
  - 현행 구현이 `one user start must keep one continuous browser recognition`에서 `false !== true`로 정확히 실패.
  - 앞선 두 실행의 테스트 정규식 문법 오류는 제품 원인과 무관해 테스트 파일만 수정하고 폐기.
- 최소 후보:
  - Android Chrome 계열 Golden 분기에서 recognition 1개를 `continuous=true`로 유지.
  - 각 final result index를 한 번만 caption/DeepL 경로에 순차 저장하고 listening 상태를 유지.
  - 사용자 `말하기 완료`에서만 recognition stop 1회.
  - unexpected end·오류·화면 숨김에서는 자동 재시작하지 않고 명시적 오류로 종료.
  - 자동 timer, MediaRecorder, getUserMedia, 서버 STT, OpenAI/Gemini fallback을 추가하지 않음.
- GREEN 증거:
  - PR #221 head `cd61bf691b81c0d503b8f15b90394837abe6d557`, run `33300620112`.
  - focused `VOICEFLOW_V4_PHASE3_CONTINUOUS_BROWSER_SPEECH_RED_GREEN_PASS`.
  - 한 recognition/start로 final 두 문장 저장, speechend stop 0회, 수동 finish stop 1회, 자동 restart 0회.
  - 전체 test PASS, v3.5.17 frozen artifact PASS, PC video reentry/chat PASS, mobile watchdog PASS.
  - Docker PASS.
- 현재 단계: SOURCE/FOCUSED/CI/DOCKER PASS · PR REVIEW 진행 · MERGE/DEPLOY/OPERATING/DEVICE 연속모드 UNVERIFIED.
- 비용: browser STT는 서버 STT 호출 없음. 문장별 기존 DeepL 번역 호출만 유지하며 신규 Provider·Secret·DB·DNS·인프라 없음.
- 롤백: PR #221의 v4 module/app/HTML/test만 되돌리거나 v4 flag OFF. 기존 운영 단발 Golden과 v3.5.17는 영향 없음.
- DEVICE 중단 조건: 시작 1회 후 두 문장 연속 인식 실패, 주기음 1회, 권한 반복 1회, 원문 누락·중복, 종료 버튼 실패 중 하나라도 발생하면 연속 후보를 OFF하고 단발 Golden으로 복귀.

## 2026-08-30 · PR #222 병합 · v4 연속 browser STT 카나리 배포 시작

- **상태**: `CONDITIONAL` — 자동 회귀/빌드/배포 게이트 진행, Samsung 실기기 연속 발화는 아직 `UNVERIFIED`.
- **병합**: PR #222, squash SHA `46daf89a1cb34866d0d1cacf8df7ba83d510723d`.
- **PR 게이트**: workflow `33300933992`에서 test `PASS`, Docker `PASS`, deploy/browser E2E는 PR이라 `SKIPPED`.
- **배포 대상**: v4 mobile canary만. v3.5.17/PC와 기존 운영 경로는 불변.
- **STT 계약**: 브라우저 Web Speech만 사용. server STT required = 0, OpenAI/Gemini server STT 미사용.
- **비용**: 신규 서버 STT 비용 없음. 기존 DeepL 번역 경로만 사용.
- **중단 조건**: test/Docker/health/v3 E2E 중 하나라도 실패, 서버 STT gate 활성화, 반복 권한 요청 또는 주기적 소리 징후.
- **롤백**: v4 canary route off 또는 Golden browser STT 기준 `356af4d3b30bb4cbf4377703acad4908907d0e54` 복귀.

## 2026-08-30 · PR #223 · 모바일 PC 4제어 UI 표시와 배포 검증 강화

- **실기기 증상**: PC v4에는 `마이크 연결·마이크 중지·음성 원문 시작·말하기 완료`가 보이지만 Samsung Golden browser 모드에서는 앞의 두 버튼이 숨겨져 구형 UI처럼 보임.
- **최초 잘못된 상태**: `app.mjs`의 Golden 분기에서 `startMicrophone.hidden=true`, `stopMicrophone.hidden=true`를 강제하고 있었음.
- **사용자 선택**: 휴대폰에도 PC와 동일한 4버튼 표시.
- **안전 구현**: Golden의 `마이크 연결`은 준비 상태만 전환하며 별도 `getUserMedia`, MediaRecorder, timer, 자동 재시작을 만들지 않음. `음성 원문 시작`이 기존 단일 browser SpeechRecognition을 시작.
- **RED**: workflow `33302017500` — `data-v4-controls="pc-four-control-mobile-v1"` 부재로 test FAIL, Docker/deploy SKIPPED.
- **GREEN**: workflow `33302101013` 재실행 — 첫 시도는 runner 포트 45180 충돌, 앱 계약은 이미 PASS. 동일 코드 재실행에서 test PASS, Docker PASS.
- **배포 차단 강화**: local/public HTML의 4제어 marker와 public app.mjs의 준비 문구가 없으면 배포 실패.
- **보호 범위**: v3.5.17, PC, server STT=0, DeepL, DB, DNS, Secret 불변.
- **원도메인 승격**: 이 PR에는 포함하지 않음. 모바일 실제 음성메모 진입 연결을 별도 변경으로 검증 예정.
- **롤백**: PR #223의 app/index/test/deploy guard만 되돌리면 직전 v4 UI로 복귀.

## 2026-08-30 — Production root Android voice start → v4 mobile

- Symptom: Samsung Android users opening `https://voice.star45.net` still entered the frozen v3 mobile room unless they used a separate v4 test URL.
- RED evidence: PR run 33302695446 failed because `shouldUseV4MobileEntry` was absent.
- Root cause: the production home always executed frozen v3.5.17 `startMeeting`; the v4 route existed only as an explicit URL.
- Implementation: preserve all frozen v3.5.17 artifacts; use the already-loaded `meeting-auto-dispatch-v361.js` fetch extension to detect Android Chrome browser speech capability, keep the real meeting created by the existing API, and route audio starts to `/v4/mobile?meeting=<created id>`. The redirected v3 promise remains pending so it cannot acquire another microphone stream before navigation.
- Protection: PC and non-Android continue through the frozen v3 flow; no hardcoded meeting ID, server STT, extra `getUserMedia`, timer, or automatic recognition restart was added.
- GREEN evidence: PR run 33302926706 — npm/contract tests PASS, v3.5.17 artifact immutability PASS, frontend artifact PASS, Docker PASS.
- Rollback: revert this PR; `public/app.js`, `public/index.html`, `public/sw.js`, and `public/meeting-collab.js` remain byte-identical to the v3.5.17 baseline.

- Production deployment requested from merge `1c6d9d878b1cc816f3f51fffdfd7922b1634bd60`; server STT remains disabled and v4 validation gates remain enabled.

### Production E2E correction

- RED evidence: deploy run 33303303362 passed service health, v4 canary, and frozen v3 checks, then failed only `Android root voice start opens v4 four-control room` (8/9 PASS) because the production button creates `type: internal`, not `type: audio`.
- Fix: match only `type: internal`; `type: client` and all PC/non-Android paths remain on v3.
- Rollback: revert the follow-up PR; the production stack remained healthy during the blocked E2E deployment.

- Corrected production redeployment requested from merge `12063c52c36051afc395017134a7d3eec1d47143`; v4 validation enabled, server STT disabled.

### Final production verification

- Deploy run: `33303698358` from `9816a1e2d52065243e3fd8c07c383b9d97fec033`.
- Result: test PASS, Docker PASS, production deploy PASS, public version/health PASS, DeepL live translation PASS.
- Android root production entry: PASS; actual meeting creation routed to the v4 four-control room.
- Frozen v3 protection: PC/non-Android home voice start recording room PASS; PC video re-entry/chat PASS.
- Browser E2E: 19/19 PASS; overall 100% PASS.
- Cost guard: `VOICEFLOW_V4_MOBILE_SERVER_STT_REQUIRED=0`; Golden browser STT selected and paid server STT gate not required.
- Device status: Samsung physical-device two-sentence speech remains UNVERIFIED until user confirmation.

## 2026-08-30 — Android root immediate v4 entry

- User evidence: opening the production root still showed v3.5.17 and therefore appeared unchanged.
- Interpretation correction: the prior implementation preserved the v3 root and redirected only after clicking voice start; the requested outcome is immediate v4 display on Android root.
- RED: PR run `33304510146` failed on the missing `shouldAutoOpenV4MobileRoot` contract.
- Root cause: the production entry was attached to the meeting-start action and additionally gated on browser SpeechRecognition exposure.
- Fix: on Android root only, create a real internal meeting without requesting media permission and replace the location with `/v4/mobile?meeting=<created id>`; PC/non-Android remain frozen v3.5.17. `/?classic=1` provides an explicit mobile home escape.
- GREEN: PR run `33304603778` — tests, v3 artifact immutability, frontend artifact, and Docker PASS.
- Cost/security: no server STT, Secret, DNS, DB schema, OAuth, or new provider cost.
- Rollback: revert this PR; the four frozen v3.5.17 files remain byte-identical.

- Production deployment requested from `648ab9d5c507c32368870029b6b83a7dc4f6ddd5`; Android root immediate-entry E2E enabled and server STT disabled.

### Final immediate-entry production evidence

- Production run `33304892863` from `0047089d562954f76967e42077aebbee60d7ac5c`: test PASS, Docker PASS, deploy PASS, DeepL live PASS, public version/health PASS.
- Android root without any click: real meeting creation and v4 four-control display PASS.
- PC/non-Android v3 home voice start PASS; PC video re-entry/chat PASS.
- Browser E2E 19/19 PASS; overall 100% PASS.
- Server STT required remained `0`; no paid server STT gate.
- Samsung physical-device display remains UNVERIFIED until user confirmation.


## 2026-08-30 · Samsung 연속 browser STT 실제 종료 회귀 복구 후보

- **사용자 DEVICE 증상**: PWA 최신 v4 화면은 표시되지만 Android Chrome이 첫 문장 뒤 recognition을 종료하면 다시 `음성 원문 시작`을 눌러야 함.
- **마지막 실제 정상 기준**: 단발 정확도·번역·무주기음 DEVICE PASS `356af4d3b30bb4cbf4377703acad4908907d0e54`; v3.5.17의 PC 브라우저 STT는 unexpected `onend` 후 350ms 재시작을 사용.
- **최초 실패 원인**: PR #221 연속 후보가 자동 재시작을 금지하고 unexpected `onend`를 `speech_session_ended`로 종료함. CI의 한 recognition 모형은 PASS했지만 Samsung 실제 브라우저 종료 동작을 재현하지 못함.
- **최소 후보 범위**: v4 mobile browser STT 모듈과 집중 테스트만 변경. final 결과가 한 건 이상 있었던 recognition 종료에서만 350ms 후 같은 recognition 소유자를 재시작하며, 결과 없는 종료·오류·화면 숨김·사용자 완료는 재시작하지 않음.
- **보호 조건**: 서버 STT·MediaRecorder·추가 getUserMedia·Provider·DB·DNS·Secret·초대/화상 UI 변경 없음. 마이크/STT 소유자는 1개 유지.
- **현재 판정**: SOURCE CANDIDATE · FOCUSED/CI/DOCKER/DEPLOY/OPERATING/DEVICE UNVERIFIED.
- **중단 조건**: 주기음, 권한 반복, 중복/누락, 완료 실패가 1회라도 발생하면 후보를 OFF하고 Golden 단발 `356af4d3`로 복귀.
- **롤백**: 이 후보 PR의 모듈·테스트·원장 변경만 되돌림.


### PR #230 병합 및 제한 운영 배포 요청

- 병합 SHA: `931571917b277b1dbaa73ec01a47594000c7481a`.
- PR run `33305985621`: test PASS, Docker PASS, deploy/browser E2E SKIPPED.
- 배포 범위: 기존 `VOICEFLOW_V4_MOBILE_ENABLED=1` 모바일 v4 카나리만; server STT required=0 유지.
- PC v3.5.17, 초대·화상 UI, DB·DNS·Secret·Provider 설정 불변.
- 배포 후 Samsung 두 문장 연속, 주기음, 권한 반복, 완료 버튼을 DEVICE 확인하기 전 전체 PASS 금지.


### PR #230 Samsung DEVICE FAIL 및 즉시 롤백

- **실기기 결과**: 사용자 확인 결과 시작 1회 후 한 문장 뒤 다음 문장이 인식되지 않음.
- **판정**: SOURCE/CI/DOCKER/DEPLOY/OPERATING 자동검사 PASS였으나 DEVICE FAIL. PR #230 전체 성공 주장을 금지.
- **실패 원인 후보**: PR #230은 v3.5.17처럼 새 SpeechRecognition 객체를 만들지 않고 종료된 같은 객체에 `start()`를 다시 호출함. 정확한 원인은 롤백 후 별도 최소 실험 전까지 UNVERIFIED.
- **조치**: PR #230의 STT 모듈과 집중 테스트를 배포 직전 `095798de5909c476bb783f329df834ae3013477f` 상태로 복원. PC·초대 UI·서버 STT·Provider·DB·DNS·Secret 불변.
- **다음 게이트**: 새 패치 금지 상태에서 v3.5.17의 새 recognition 생성 방식과 v4의 같은 객체 재시작 차이만 검증.
- **롤백 완료 판정**: CI/DOCKER/DEPLOY/OPERATING/DEVICE 재확인 전 PENDING.


### PR #231 롤백 배포 요청

- 롤백 병합 SHA: `e4c9aad9e8c8d5c8d4f7d56d3994ffe463f336e2`.
- PR run `33306743900`: test PASS, Docker PASS.
- 목표: DEVICE FAIL인 PR #230 운영 코드 제거. 모바일은 직전 단발 browser STT 상태로 복귀.
- 전체 상태: 운영 롤백과 Samsung 재확인 전 FAIL.


## 2026-08-30 · 스마트폰 시작 1회→다중 원문·번역 단일목표 복구 후보

- **사용자 고정 목표**: 스마트폰에서 `음성 원문 시작`을 한 번 누르면 여러 문장이 각각 원문으로 표시되고 기존 caption/DeepL 경로로 번역. 다른 기능은 변경 금지.
- **DEVICE 실패 기준**: PR #230은 종료된 같은 SpeechRecognition 객체에 `start()`를 재호출했으나 Samsung에서 한 문장 뒤 계속되지 않아 즉시 롤백됨.
- **마지막 정상 구현 근거**: v3.5.17 `public/app.js`의 `onend → setTimeout(startSpeech,350)`는 매번 새 SpeechRecognition 객체를 생성함.
- **단일 후보**: final 결과가 있었던 unexpected end에만 350ms 후 새 SpeechRecognition 객체 1개를 생성. 결과 없는 종료·권한 오류·화면 숨김·사용자 완료는 재시작하지 않음.
- **변경 범위**: `mobile-browser-speech-session`, 집중 테스트, 원장만. UI·PC·초대·화상·자료·의장·DB·DNS·Secret·Provider·서버 STT·MediaRecorder·getUserMedia 불변.
- **검증 계약**: 첫 객체 첫 문장→Android end→새 객체 생성→둘째 문장→같은 caption submit/번역 경로→사용자 완료.
- **현재 판정**: SOURCE CANDIDATE · FOCUSED/CI/DOCKER/DEPLOY/OPERATING/DEVICE UNVERIFIED.
- **롤백**: 후보 PR만 되돌려 PR #231 복원 상태로 복귀.


### PR #232 모바일 다중 원문·번역 제한 배포 요청

- 병합 SHA: `4e4806e2cec259ed470bc94c57717a765192737a`.
- PR run `33307274160`: test PASS, Docker PASS, 변경 파일 3개 확인.
- 배포 범위: 모바일 v4 browser STT만. server STT required=0 유지.
- 보호 범위: PC·UI·초대·화상·자료·의장·DB·DNS·Secret·Provider 불변.
- 완료 금지: Samsung에서 시작 1회→서로 다른 원문 2개 이상→각 번역 확인 전 DEVICE UNVERIFIED.


### PR #232 Samsung DEVICE FAIL 및 자동 중단

- **실기기 결과**: PWA 완전 재실행 후 `음성 원문 시작` 1회, 첫 원문 1줄은 표시·번역되지만 다음 문장은 다시 인식되지 않음.
- **판정**: SOURCE/CI/DOCKER/DEPLOY/OPERATING 자동검사 PASS, DEVICE FAIL.
- **반복 실패**: PR #230 같은 객체 재시작 실패, PR #232 새 객체 재생성도 동일 증상. unexpected `onend` 의존 방식은 Samsung 실제 동작을 복구하지 못함.
- **조치**: PR #232 모듈·집중 테스트를 배포 전 `5200ed3f` 상태로 복원. 신규 패치·배포 자동 중단.
- **보호 범위**: PC·UI·초대·화상·자료·의장·번역 API·DB·DNS·Secret·Provider 불변.
- **다음 조사 한정**: 단발 Golden의 final-result 처리와 Samsung 이벤트 순서를 먼저 계측·확정하고, 추측성 재시작 패치 금지.
- **전체 상태**: DEVICE FAIL. 롤백 운영 검증 전 PENDING.


### PR #233 운영 롤백 배포 요청

- 롤백 병합 SHA: `70a87befe546413f085f7a0099e6a96ed8aea669`.
- PR run `33308877428`: test PASS, Docker PASS.
- 목표: Samsung DEVICE FAIL인 PR #232 운영 코드 제거. 모바일은 PR #231 직후 단발 browser STT 상태로 복귀.
- 변경 제한: PC·UI·초대·화상·자료·의장·번역 Provider·DB·DNS·Secret·서버 STT 불변.
- 다음 행동: 운영 배포/E2E 완료 후 추가 동작 패치 없이 첫 문장 이후 실제 Samsung 이벤트 증거부터 수집.


## 2026-08-30 · Samsung 첫 문장 이후 이벤트 계측 후보

- **목표**: 시작 1회 후 첫 문장만 표시되고 다음 문장이 수신되지 않는 실제 Samsung 이벤트 순서를 확정.
- **배경**: PR #230의 같은 recognition 재시작과 PR #232의 새 recognition 재생성이 모두 DEVICE FAIL. 추가 동작 패치 자동 중단.
- **최소 계측**: 기존 모바일 browser STT 모듈의 `start`, `speechstart`, `speechend`, `interim`, `final`, `error:<code>`, `end`를 최근 8개까지만 메모리에 기록하고 기존 음성 상태줄에 표시.
- **행동 변경 없음**: 자동 재시작·timer·서버 STT·MediaRecorder·getUserMedia·Provider 변경 없음. 인식·번역·저장 로직 불변.
- **변경 범위**: 모바일 browser STT 모듈, 모바일 상태 표시 1줄, 집중 테스트, 원장만.
- **보호 범위**: PC·초대·화상·자료·의장·DB·DNS·Secret·Provider·기존 번역 경로 불변.
- **완료 기준**: 자동 테스트/빌드/운영 E2E PASS와 Samsung 첫 문장 후 화면의 진단 순서 확보. 실기기 증거 전 원인 UNVERIFIED.
- **롤백**: 진단 PR의 네 파일만 되돌리면 PR #233 운영 복구 상태로 복귀.


### PR #234 Samsung 이벤트 진단 제한 배포 요청

- 병합 SHA: `3be6f45bdb092474ece91596b9f048bc47fb774b`.
- PR run `33309465243`: test PASS, Docker PASS.
- 배포 목적: 첫 문장 뒤 실제 Samsung browser speech 이벤트 증거 수집만 수행.
- 동작 변경 없음: 자동 재시작·timer·서버 STT·MediaRecorder·getUserMedia 없음.
- 보호 범위: PC·초대·화상·자료·의장·번역·저장·DB·DNS·Secret·Provider 불변.
- DEVICE 판정: 운영 배포 후 Samsung 진단 문자열 확보 전 UNVERIFIED.


## 2026-08-30 · 설치형 PWA 전체 기능 화면 복구 후보

- **DEVICE 증거**: Samsung 설치형 PWA가 격리 v4 화면을 열어 전체 스크롤이 막히고 초대·화상·자료·의장 버튼이 사라짐. 화면에는 구형 2버튼 자산이 남아 최신 4버튼·진단 표시도 보이지 않음.
- **원인 확정**: PR #226/#229가 Android 운영 루트와 내부 회의 생성을 기능이 축소된 `/v4/mobile`로 자동 전환. v4 CSS는 `html,body overflow:hidden`이며 v4 HTML에는 초대·화상·자료·의장 기능이 존재하지 않음.
- **마지막 전체 UI 기준**: v4 자동진입 전 PR #224 병합 `22820df87d29016f97d7ae5b589394cdf2664310`의 설치형 PWA 전체 회의 화면.
- **최소 복구**: 설치형 standalone PWA는 v4 자동진입에서 제외하고, 이미 v4 화면을 연 standalone PWA는 `/?classic=1` 전체 화면으로 복귀. 기존 서비스워커 갱신·재로딩 계약은 유지.
- **격리 유지**: 일반 Android 브라우저의 v4 진단 경로와 PC 동작은 유지. 음성·번역·저장 로직은 이번 변경에서 수정하지 않음.
- **검증 기준**: SOURCE/CI/DOCKER/DEPLOY/OPERATING 후 Samsung PWA 전체 UI·스크롤·초대 버튼 DEVICE 확인.
- **롤백**: dispatch, v4 index, service worker, 집중 테스트, 원장만 되돌려 직전 상태 복귀.


### PR #235 설치형 PWA 전체 화면 복구 배포 요청

- 병합 SHA: `0a3ee4ffdd7bd98f3cffd27baec436684e226b2d`.
- CI run `33311652339`: test PASS, Docker PASS.
- 배포 범위: standalone PWA 진입 경계만. PC·일반 브라우저 v4·음성·번역·저장 로직 불변.
- DEVICE 완료 금지: Samsung PWA에서 전체 화면, 스크롤, 초대 등 기존 버튼 확인 전 UNVERIFIED.


## 2026-08-30 · 전체 PWA 음성→원문 0건 서버전환 증거 계측

- **DEVICE 상태**: Samsung standalone PWA 전체 UI·초대/화상/자료/의장 복구 PASS. 녹음 11초·입력 양호 PASS. 원문 0건 DEVICE FAIL.
- **대조 증거**: v4 Golden은 별도 MediaRecorder 없이 첫 문장 인식 PASS. 전체 PWA는 main MediaRecorder와 browser SpeechRecognition을 동시에 시작하고 1.5초 무결과 시 server STT로 전환.
- **미확정 분기**: browser no-result와 server STT 실패 중 어느 단계가 최종 원문 0건을 만드는지 UI에 오류값이 없어 UNVERIFIED.
- **실패한 계측 시도**: 생성된 `app.js`에 상태값을 표시하려 했으나 v3.5.17 고정 자산 보호검사가 즉시 차단. 보호검사를 해제하지 않고 변경을 전부 철회.
- **최소 계측**: 기존 `audio-monitor.js`가 앱보다 먼저 로드되는 점을 사용해 native SpeechRecognition 이벤트와 `/transcribe` 응답 상태만 읽기 전용으로 관측하고 `입력 양호` 줄에 표시. 인식·녹음·번역·저장·재시작 및 고정 `app.js`는 변경하지 않음.
- **보호 범위**: PC·초대·화상·자료·의장·DB·DNS·Secret·Provider 설정 불변.
- **다음 게이트**: Samsung 화면의 `진단 ...` 문자열로 최초 실패 분기 확정 전 행동 수정 금지.
- **롤백**: `audio-monitor.js`의 이벤트 관측과 집중 테스트·원장만 되돌림.


### PR #236 전체 PWA STT 읽기 전용 진단 배포 요청

- 병합 SHA: `deae3a97febf022e190366fa66f78f39a69042ea`.
- CI run `33312697375`: test PASS, Docker PASS, v3.5.17 고정 자산 PASS.
- 배포 범위: 기존 audio monitor의 읽기 전용 browser/server STT 이벤트 표시만.
- 행동 변경: 없음. PC·녹음·초대·화상·자료·의장·번역·저장·Provider 설정 불변.
- DEVICE 완료 금지: Samsung의 진단 문자열 확보 전 원인·수정 UNVERIFIED.


### PR #236 운영 E2E FAIL 및 즉시 롤백

- SOURCE/CI/DOCKER/v3.5.17 고정 자산은 PASS했으나 운영 E2E `Android root immediately opens v4 four-control room`이 FAIL, 전체 8/9.
- 진단을 위한 SpeechRecognition/fetch 관측 래퍼가 일반 Android 진입과 충돌했을 가능성을 배제할 수 없어 전체 성공 판정 금지.
- 조치: `audio-monitor.js`와 집중 테스트를 PR #236 전 `016f7a8c` 상태로 복원. 신규 진단/행동 패치 중단.
- 보호: 설치형 PWA 전체 화면 복구 PR #235, PC, 초대, 화상, 자료, 의장, 번역, DB, DNS, Secret, Provider 설정 유지.
- 다음 조사: 운영 서버/브라우저를 변경하지 않는 기존 로그·API 증거만 사용.


### PR #237 운영 진단 롤백 배포 요청

- 롤백 병합 SHA: `25daabe8569c39175b364ba0dc763923187627f2`.
- CI run `33313175707`: test PASS, Docker PASS.
- 목표: 운영 E2E 8/9를 만든 PR #236 진단 래퍼 제거. PR #235 설치형 PWA 전체 화면 복구는 유지.
- DEVICE 원문 인식은 FAIL 유지. 추가 패치 없이 운영 정상성부터 복구.


## 2026-08-30 · 설치형 PWA와 일반 Android v4 진입 경계 수정

- **운영 실패**: PR #236 진단 배포와 PR #237 롤백 배포 모두 동일 E2E `Android root immediately opens v4 four-control room` FAIL(8/9).
- **원인 확정**: 일반 Android가 정상적으로 v4 URL에 도달한 뒤, v4 HTML의 standalone 판정이 테스트 브라우저를 PWA로 오판해 즉시 `/?classic=1`로 이동. 진단 코드가 원인이 아니었음.
- **최소 수정**: 일반 Android 자동진입 URL에 `entry=browser`를 부여하고 v4 PWA 복귀 경계가 이 명시적 브라우저 진입만 허용.
- **보호 범위**: 설치형 PWA는 전체 기능 화면 유지. 일반 Android 브라우저는 v4 유지. PC·음성·녹음·번역·초대·화상·자료·의장·DB·DNS·Secret·Provider 불변.
- **검증**: SOURCE/CI/DOCKER/DEPLOY/OPERATING/E2E 진행. DEVICE 원문 인식 FAIL은 별도 유지.
- **롤백**: dispatch, v4 index, 진입 계약/E2E 테스트, 원장만 복원.


### PR #238 병합 및 원도메인 배포 요청

- 병합 SHA: `17d023753a78a3d06af16de6d309b15622bcf065`.
- PR run `33313626985`: test PASS, Docker PASS.
- 배포 목표: 설치형 PWA는 전체 기능 화면, 일반 Android 브라우저는 명시적 `entry=browser` v4 화면으로 분리.
- 보호 범위: PC·음성·녹음·번역·초대·화상·자료·의장·DB·DNS·Secret·Provider 불변.
- 완료 금지: 운영 배포 및 Chromium E2E 19/19 PASS 전 OPERATING 미확인. DEVICE 원문 인식은 FAIL 유지.


### PR #238 첫 배포 실패 원인 확정 및 v4 재배포

- 실패 run: `33313753744`, E2E 8/9. 원도메인 `/v4/mobile`은 실제 HTTP 404 `v4_mobile_disabled`.
- 원인: 배포 커밋 메시지에 `[v4-mobile-canary]`가 없어 workflow가 `VOICEFLOW_V4_MOBILE_ENABLED=0`으로 실행됨. PWA 경계나 음성 코드 문제가 아님.
- 조치: 소스 변경 없이 정확한 `[deploy-production] [v4-mobile-canary]` 표식으로 재배포. 서버 STT required 표식은 추가하지 않아 0 유지.
- 완료 기준: 공개 v4 route 200/4제어 marker, 운영 E2E 19/19 PASS. DEVICE 원문 인식은 별도 FAIL 유지.


### PR #238 최종 운영 복구 및 원문 인식 외부 차단 확정

- 재배포 SHA `8e2a894f711179540c0be50a0499b8641261cc60`, run `33314128399`, deploy job `99264530446` PASS.
- 공개 v4 route HTTP 200, `x-voiceflow-v4: mobile-phase2`, 4제어 marker PASS.
- Chromium 운영 E2E `19/19 PASS`, overall `100% PASS`. 설치형 PWA 전체 기능/일반 Android v4 진입 경계 OPERATING PASS.
- DEVICE 원문 인식은 계속 FAIL. 실제 운영 `/transcribe` 호출은 HTTP 500: OpenAI 크레딧 소진, Gemini API 키 미구성.
- 판단: 브라우저 결과가 없을 때 전환되는 서버 STT가 Provider 비용/구성으로 차단됨. Billing·Secret은 사용자 승인 없이 변경하지 않음.
- 다음 게이트: OpenAI 크레딧 충전 또는 Gemini STT 키 구성 후 동일 운영 STT 실응답 PASS → Samsung 원문/번역 DEVICE 재검증.


## 2026-08-30 · Android 무료 브라우저 STT 복원 후보

- **사용자 결정**: API 비용이 드는 서버 STT가 아니라 이전 무료 Android Chrome Web Speech 방식으로 복원.
- **확정 원인**: 운영 서버 STT 실호출 HTTP 500. OpenAI 크레딧 소진, Gemini API 키 미구성. 현재 v3.5.17 생성 패치가 Android browser 무결과 1.5초 후 이 실패 경로로 강제 전환.
- **마지막 기존 구현**: PR #110 / commit `b6a2225ad16596a0b795648b544c537746461bb8`의 Android Chrome 단일 browser STT 소유. 기본 `onend → 350ms startSpeech` 재시작 유지.
- **최소 수정**: v358 생성 패치에서 `recognitionCycle`, 1.5초 server watchdog, empty-cycle server handoff만 제거. PC·녹음·번역·초대·화상·자료·의장·DB·DNS·Secret·Provider 불변.
- **PWA 반영**: 생성 cache marker만 `voiceflow-shell-v344`로 전진. frozen source artifact는 변경하지 않음.
- **비용**: browser STT 추가 API 비용 없음. DeepL 기존 번역 경로 유지.
- **검증**: SOURCE 진행 · FOCUSED/CI/DOCKER/DEPLOY/OPERATING/DEVICE 대기.
- **롤백**: 이번 PR의 생성 패치·집중 테스트·cache 계약·원장만 되돌림.


### PR #239 병합 및 무료 STT 원도메인 배포 요청

- 병합 SHA: `370a399270aad77da285ee3629ee3c21d05587f5`.
- PR run `33315778376`: SOURCE/FOCUSED/CI/DOCKER PASS. 첫 run `33315604551`은 이전 frozen hash/서버전환 CI 계약이 후보를 차단해 운영 미반영; 정확한 새 해시와 browser-only 금지계약으로 수정.
- 배포 표식: `[v4-mobile-canary]` ON, `[v4-mobile-server-stt]` OFF. Android Chrome은 추가 API 비용 없는 Web Speech 단일 소유.
- 완료 기준: public v4 200, generated app에 1.5초 server handoff 없음, E2E 19/19 PASS, Samsung DEVICE 2문장 원문·번역 확인.


### PR #239 첫 운영검사 76% 차단 및 배포 가드 수정

- run `33315937791`: SOURCE/CI/DOCKER PASS, 앱·v4 공개 배포 후 72% v4 canary PASS. 76%에서 옛 `Samsung silent-session watchdog missing` 보호조건으로 중단.
- 운영 확인: 공개 app SHA-256 `ae414289684dfcb498bff190b3c8e91fefe3a6d900876fc6df2389d3e72b4f86`로 새 pinned hash와 일치. 1.5초 server handoff 없음, browser restart delay 유지.
- 원인: 배포 스크립트가 제거 대상인 유료 server watchdog/empty-cycle handoff를 여전히 필수로 요구.
- 최소 수정: 해당 5개 운영조건만 역전해 server handoff가 존재하면 배포 실패하도록 변경. 앱·DB·DNS·Secret·Provider 불변.
- 다음: CI/DOCKER 후 동일 코드 운영 후검사/E2E 19/19 재개.


### PR #240 병합 및 무료 STT 운영 후검사 재개

- 병합 SHA: `c8e43c2b3df1158c2cf29e6a91134171ed776e17`.
- PR run `33316224205`: test PASS, Docker PASS.
- 변경 범위: 낡은 유료 server-handoff 운영 가드 5개와 집중 계약, 원장만. 공개 앱 무료 STT 산출물 불변.
- 배포 표식: v4 canary ON, server STT required OFF. 목표는 76% 이후 E2E 19/19 완료.


### 무료 Android browser STT 최종 운영 자동검증

- 운영 run `33316347077` 재실행 deploy job `99270832275`: PASS.
- 첫 시도는 Provider Hub 5초 네트워크 timeout으로 서버 교체 전 중단; 코드 변경 없이 동일 job 재실행 후 정상 통과.
- 배포 로그: `Golden browser STT canary selected; paid server STT gate not required`.
- 공개 app: pinned SHA-256 `ae414289684dfcb498bff190b3c8e91fefe3a6d900876fc6df2389d3e72b4f86`, Android 1.5초 server handoff 없음.
- 운영: v4 canary PASS, Android root v4 4제어 PASS, 녹음/채팅/초대/결과/PC 보호 PASS, E2E 19/19 PASS, overall 100% PASS.
- DEVICE: Samsung PWA 시작 1회→서로 다른 두 문장 원문·각 번역은 사용자 확인 전 UNVERIFIED.


### 2026-08-31 · PR #239 무료 browser STT Samsung DEVICE FAIL 및 롤백

- **실기기 증거**: Samsung 설치형 PWA에서 녹음 15초, 주변 소음 감지, 음성인식·번역 준비 완료이나 원문 0건. 반복 소리 발생.
- **판정**: SOURCE/CI/DOCKER/DEPLOY/OPERATING/E2E 자동검사는 PASS였으나 DEVICE 원문 FAIL, 소리 회귀 FAIL.
- **원인 범위**: 무료 후보의 browser recognition onend 재시작 루프가 소리 회귀와 연결된 것으로 추정. 정확한 기기 이벤트는 UNVERIFIED.
- **조치**: PR #239의 생성 패치·집중 테스트·artifact hash/cache 계약과 PR #240 배포 가드만 pre-candidate `db86cbd61ca65016f7aa1f844191854ba55159c3` 기준으로 복원. 전체 PWA UI와 PC·초대·화상·자료·의장 유지.
- **중단**: full PWA 음성 경로 신규 패치 금지. 롤백 운영검증 후 마지막 DEVICE 정상 경로 재선정 전 추가 배포 금지.


### 2026-08-31 · 실패한 무료 Android STT 후보 운영 롤백 요청

- 롤백 PR: #241, merge `d7c66882fab3f41052acf10581435aa3dd31d50c`.
- PR 검증: run `33318609157`, test PASS, Docker PASS.
- 배포 범위: PR #239/#240의 무료 browser-only STT 후보만 제거. 전체 PWA UI·PC·초대·화상·자료·의장 불변.
- 배포 표식: `[v4-mobile-canary]` ON, `[v4-mobile-server-stt]` OFF.
- 완료 기준: 운영 E2E 19/19 PASS, public app 롤백 hash 일치. DEVICE 원문과 반복 소리는 사용자 재확인 전 FAIL/UNVERIFIED 유지.


### 2026-08-31 · PR #241 운영 롤백 완료

- 병합: PR #241, merge `d7c66882fab3f41052acf10581435aa3dd31d50c`.
- 배포: run `33318738052`, deploy job `99277172076` PASS.
- 자동검증: SOURCE/CI/DOCKER/DEPLOY/OPERATING PASS, E2E 19/19 PASS, OVERALL 100% PASS.
- 운영 산출물 계약: app v3.5.17, service worker v343, app SHA-256 `a9d8943a176e3ec8613bfa11705482a6149e10d3505bd4a0e7f1acead6014ffc`.
- 보존 확인: 전체 PWA UI, Android root v4 4제어, PC, 녹음, 채팅, 초대, 결과 흐름 자동검사 PASS.
- DEVICE 판정: 원문 인식은 FAIL 유지. 반복 소리 제거는 Samsung PWA 완전 종료·재실행 후 사용자 확인 전 UNVERIFIED.
- 다음 제한: 같은 full PWA browser-only STT 재패치 금지. 기기 확인 결과와 별도로 마지막 DEVICE 성공 경로를 선정한다.


## 2026-08-31 · 무료 localhost Whisper STT 기본-OFF 후보

- **고정 목표**: PC/설치형 PWA 전체 UI를 보존하고, 스마트폰 입력 1회 후 여러 음성 구간을 기존 원문·DeepL 번역 경로로 처리. 신규 Provider 비용 없음.
- **Golden 대조 결론**: Samsung에서 시작 1회→다중 문장까지 DEVICE PASS한 기존 SHA는 없음. 단발 browser STT만 `356af4d3b30bb4cbf4377703acad4908907d0e54`에서 DEVICE PASS. PR #230/#232의 recognition 재시작 방식은 모두 DEVICE FAIL.
- **외부 차단**: OpenAI STT는 quota/credit FAIL, Gemini STT는 credential binding 미구성. DeepL 번역은 OPERATING PASS.
- **서버 용량**: AMD EPYC 9354P 2 vCPU, RAM 약 8 GB, GPU 없음. 공식 whisper.cpp tiny 모델 메모리 적합.
- **속도 증거**: 진단 run `33320050989`, 11.0초 공식 음성을 2.905초에 인식, RTF 0.264, transcript PASS.
- **브라우저 형식 증거**: 진단 run `33320405810`, 공식 pinned image digest `sha256:479a53894c39c912bec0e06c010313602f070bfef6ac6ca26e143b61a54b2b3b`의 localhost HTTP 서버가 WebM/Opus 업로드를 원문으로 변환 PASS.
- **포트 격리**: 기존 4185는 identity-organization 서비스가 사용 중임을 사전 재검사에서 확인. 로컬 STT는 4186 전용이며 runtime reconcile이 충돌·health를 검증.
- **후보 범위**: PR #242에서 `lib/provider-adapters.mjs`, `deploy/docker-compose.v23.yml`, 집중 테스트, package test 명령만 변경. UI·PC·초대·화상·자료·의장·스크롤·DB·DNS·Secret·번역 UI 불변.
- **안전 스위치**: `LOCAL_STT_ENABLED=0` 기본값과 compose profile `local-stt`로 이중 OFF. OFF에서는 기존 OpenAI/Gemini 순서와 운영 동작 불변. 로컬 실패 시 기존 Provider fallback 유지.
- **검증**: PR run `33320368226` SOURCE/FOCUSED/CI/DOCKER PASS. deploy-production/browser-e2e는 draft PR이라 SKIPPED.
- **현재 판정**: SOURCE PASS · CI PASS · DOCKER PASS · LOCAL HTTP/WebM PASS · DEPLOY/OPERATING/DEVICE UNVERIFIED.
- **중단 조건**: 운영 제한 시험에서 원문 0건, 1회 입력 후 후속 구간 미전송, 반복 소리, 기존 버튼/UI 회귀, 번역 실패 중 하나라도 발생하면 `LOCAL_STT_ENABLED=0` 및 `local-stt` profile OFF로 즉시 복귀.
- **완료 금지**: Samsung 시작 1회→서로 다른 원문 2개 이상→각 번역 확인 전 DEVICE PASS 금지.


### 2026-08-31 · 첫 local STT canary 배포 차단과 Compose 명령 수정

- 병합 SHA `b41af630a2e33eff758d6c16ab4c2558e8474307`, run `33321225686`: SOURCE/CI/DOCKER PASS, DEPLOY FAIL.
- 실패 위치: runtime reconcile에서 `voiceflow-local-stt`가 재시작. 로그는 모델 다운로드 스크립트 usage만 출력.
- 원인: Compose folded string이 image의 `bash -c` 뒤 여러 argv로 분리되어 첫 토큰만 실행되고 `tiny /models`가 스크립트에 전달되지 않음.
- 운영 영향: 기존 core/gateway/identity 등은 재기동 PASS. 로컬 STT만 미기동이며 DEVICE 검증 시작 전 자동 중단.
- 최소 수정: local STT command를 단일 배열 원소로 고정하고 CI가 rendered compose command 배열 길이 1과 전체 명령을 검증.
- 보호 범위: UI·PC·초대·화상·자료·의장·번역·DB·DNS·Secret 불변.
- 다음: CI/Docker PASS 후 동일 `[local-stt-canary]` 제한 재배포. OPERATING/DEVICE는 계속 UNVERIFIED.


## 2026-08-31 · 최대 8명 상호 대화방 운영 연결 후보

- **사용자 목표**: PC·휴대폰에서 같은 초대방에 동시 접속하고, 각 기기의 원문과 번역을 발언자 이름과 함께 같은 대화방에 기록. 권장 최대 인원은 8명.
- **Golden 기준**: main `d8395a8ad79a72d84bc807dfb4cdaf0626f50562`. Samsung PWA 시작 1회 → 서로 다른 원문 2줄 → 각 DeepL 번역 → 반복 소리 없음 DEVICE PASS.
- **영향표**:
  - 변경: `server-v2.mjs`의 회의 생성·join API, 신규 `meeting-max-participants.test.mjs`, package test 목록.
  - 직접 소비자: 초대 링크 join, participant-joined 신호, captions의 `peer_id`·`speaker`.
  - 기존 생성/UI: `scripts/patch-voiceflow-planned-v314.mjs`의 참여 인원과 `captionCard` 발언자 표시를 재사용하며 UI 파일은 수정하지 않음.
  - 보호: 마이크·MediaRecorder·browser/server STT·local whisper·번역 Provider·대화 렌더·초대·화상·자료·의장·DB·DNS·Secret 불변.
- **최소 수정**:
  - 회의 생성 응답에 `max_participants:8`을 기록.
  - 신규 peer는 현재 8명일 때 HTTP 409 `meeting_full`; 기존 peer 재접속은 8명 상태에서도 허용.
  - join 직렬 저장으로 동시 입장에서도 8명을 넘지 않음.
- **FOCUSED 증거**: 실제 `server-v2.mjs` 격리 실행에서 호스트+동시 8회 join 중 7회 성공/1회 409, 최종 8명·중복 peer 0, 기존 peer 재접속 성공, 8개 `speaker`·8개 `peer_id`·번역 행 유지, participant-joined 7개. `VOICEFLOW_MEETING_MAX_EIGHT_PASS`.
- **단계 상태**: SOURCE CANDIDATE · FOCUSED PASS · CI/DOCKER/DEPLOY/OPERATING PENDING · 실제 8대 PC/휴대폰 DEVICE UNVERIFIED.
- **롤백**: 이번 후보의 server join 변경, 신규 집중 테스트, package test 항목만 되돌리면 Golden 동작으로 복구. STT·번역·UI 파일 복원은 필요 없음.


### 2026-08-31 · PR #245 최대 8명 상호 대화방 운영 반영 완료

- **PR/병합**: PR #245, 운영 코드 SHA `78ee3a25d621ee8e9a37d20ec2cb1635d7217a67`.
- **FOCUSED PASS**: `VOICEFLOW_MEETING_MAX_EIGHT_PASS`. 동시 신규 join 8회 중 정원까지 7회 성공/초과 1회 HTTP 409, 최종 8명, peer 중복 0, 기존 peer 재접속 성공, 8명 speaker·caption·번역 행 유지.
- **PR CI/DOCKER PASS**: run `33323857724`, test job `99290432602`, Docker job `99290597805`.
- **운영 CI/DOCKER/DEPLOY PASS**: run `33323965098`, test `99290731560`, Docker `99290905855`, deploy `99290973065`.
- **운영 후검사 PASS**: 전체 runtime health, local STT service, DeepL 실번역 `translated:true`, inline invite, current voice recording flow, current chat and invite flow, Chromium E2E 19/19, OVERALL 100%.
- **독립 공개 확인 PASS**: `https://voice.star45.net/` title `STAR45 AI Meeting Workspace`, 공개 `/version.json` 2.6.2, `/api/health` gateway/core와 전체 서비스 ok. 공개 브라우저 콘솔의 앱 origin 오류 0; 관측된 extension 오류는 페이지 코드가 아님.
- **단계 판정**: SOURCE PASS · FOCUSED PASS · CI PASS · DOCKER PASS · DEPLOY PASS · OPERATING PASS.
- **DEVICE 판정**: 실제 PC·휴대폰 8대 동시 음성 입력은 UNVERIFIED. 기존 Samsung 2줄 원문·번역·무소음 Golden은 변경 대상에서 제외됐고 자동 음성/초대 회귀검사는 PASS했으나, 이번 배포 후 Samsung 실기기 재확인은 별도 DEVICE 검사 전 PASS로 대체하지 않음.
- **운영 복구점**: 다중 참여만 되돌릴 때 PR #245의 `server-v2.mjs`, 신규 테스트, package test 항목을 되돌림. 전체 운영 복구는 직전 실제 Samsung Golden `d8395a8ad79a72d84bc807dfb4cdaf0626f50562`.


## 2026-08-31 · 초대 링크 QR 공백 원인 확정 및 로컬 생성 후보

- **사용자 증상**: 초대 링크 기능 전체 작동 여부 확인 중 링크는 열리지만 QR 표시를 통과로 확인할 수 없음.
- **Golden/변경 직전**: Samsung 원문·번역·무소음 Golden `d8395a8ad79a72d84bc807dfb4cdaf0626f50562`; 변경 직전 main `5b48e085465fa51fbd8819d24583f0fa36886a85`.
- **원인 확정**: `/api/v1/tapjoin/activate`는 `tap_url`만 반환하고 `qr_url`은 반환하지 않음. `public/meeting-collab.js`는 `qr_url`이 있을 때만 이미지를 표시하여 “초대 링크·QR 활성화” 문구와 실제 빈 QR이 불일치.
- **첫 시도와 차단**: `public/meeting-collab.js`에서 로컬 QR fallback을 추가했으나 CI의 v3.5.17 운영 자산 동결 검사가 해시 변경을 차단. 보호검사·기준 해시는 변경하지 않고 UI와 public vendor를 즉시 원상복구.
- **최종 최소 수정**: 검증된 MIT `qrcode-generator 1.4.4`를 서버 `lib/vendor`에 보관하고 기존 TapJoin 활성화 응답에 `tap_url`과 함께 로컬 생성 `qr_url` data URI를 반환. 동결 UI는 이미 이 계약을 소비하므로 변경 없음.
- **비용·보안**: 신규 Provider/API/Secret/비용 없음. 초대 URL을 외부 QR 서비스에 전송하지 않음.
- **직접 소비자**: 외부 초대 패널의 링크·QR 만들기. 링크 복사·Web Share·NFC는 기존 URL을 그대로 사용.
- **보호 범위**: 마이크·MediaRecorder·브라우저/서버/local STT·원문·번역·대화 렌더·화상·자료·의장·DB·DNS·Secret·Provider·8명 제한 불변.
- **집중검사**: 격리된 임시 사용자·세션·live meeting으로 TapJoin 활성화 후 `tap_url`, `qr_url`, GIF 헤더와 이미지 데이터 생성 확인.
- **단계 상태**: SOURCE CANDIDATE · FOCUSED/CI/DOCKER/DEPLOY/OPERATING/DEVICE PENDING.
- **롤백**: `services/device-nearby-tapjoin-service.mjs`, `lib/vendor/qrcode-generator-1.4.4.cjs`, `meeting-invite-qr.test.mjs`, `package.json`, 원장 항목만 되돌리면 직전 동작으로 복귀.


### PR #246 초대 링크·QR 운영 반영 완료

- **PR/병합**: [PR #246](https://github.com/leewonkyu73-sys/voiceflow-smart-workspace/pull/246), merge SHA `8139f852726ebcae1c67c1aed5435e5ae2ce46f7`.
- **첫 시도 차단**: run `33325296150`에서 `meeting-collab.js` frozen v3.5.17 해시 변경을 정확히 차단. 보호검사·기준 해시를 바꾸지 않고 동결 UI와 public vendor를 원상복구.
- **최종 수정**: TapJoin 활성화 서비스가 기존 `tap_url`과 동일 내용을 로컬 생성한 `qr_url` data URI로 함께 반환. 신규 API·Secret·비용·외부 QR 서비스 없음.
- **FOCUSED PASS**: 격리 서비스에서 TapJoin 활성화 HTTP 200, `tap_url`, GIF QR 생성과 헤더 확인. `MEETING_INVITE_QR_TEST PASS`.
- **PR CI/DOCKER PASS**: run `33325484877`; test job `99295378129`, Docker job `99295548867`. npm test, v3.5.17 frozen artifacts, 프런트 생성, Docker 이미지 모두 PASS.
- **운영 전환 증거**: merge 후 원도메인 health가 재기동 구간 `502 → 503 → 200`으로 복귀했고 전체 gateway/core/deviceNearby health PASS. main push Actions run ID는 현재 Connector 조회 범위 밖이라 별도 메타데이터는 UNVERIFIED.
- **OPERATING API PASS**: 시험 회의 `mtg_mtg3mtp3_z3ozda`에서 TapJoin 활성화 HTTP 200, `tap_url`과 `qr_url` 동시 반환, QR GIF `GIF87a` 1,967 bytes.
- **OPERATING QR DECODE PASS**: 독립 판독기로 운영 QR 173×173을 해독해 반환된 `tap_url`과 정확히 일치 확인.
- **OPERATING BROWSER PASS**: Tap URL에서 “근처 회의 활성”·회의 제목·“회의 참가” 표시 후 버튼 클릭 시 `/?session_id=mtg_mtg3mtp3_z3ozda`의 이름·언어·“참가하기” 화면으로 정상 전환.
- **보존 확인**: `public/app.js`, `public/index.html`, `public/sw.js`, `public/meeting-collab.js` frozen SHA 불변. 음성·원문·번역·화상·자료·의장·8명 제한 코드 불변.
- **단계 판정**: SOURCE PASS · FOCUSED PASS · CI PASS · DOCKER PASS · OPERATING PASS. 실제 스마트폰 카메라 스캔, native Share sheet, NFC 태그 기록은 DEVICE UNVERIFIED.
- **롤백**: PR #246의 `services/device-nearby-tapjoin-service.mjs`, `lib/vendor/qrcode-generator-1.4.4.cjs`, 집중 테스트와 package test 항목만 되돌리면 직전 상태 복귀.


### 2026-08-31 · 전체 배포와 NFC 단독 배포 동시 실행 충돌 직렬화 후보

- **사용자 목표**: PR #246 초대 링크·QR 운영 반영 뒤 남은 초대·NFC 경로를 정상화하고 기존 음성·원문·번역·8명 방을 보존.
- **증상**: main SHA `8139f852726ebcae1c67c1aed5435e5ae2ce46f7`에서 VoiceFlow CI run `33325831903`과 NFC Admin run `33325831905`가 2026-08-30 17:38:39 UTC에 동시에 시작. NFC job `99295665128`이 `127.0.0.1:4183/health` 연결 거부로 실패하고 격리 롤백 실행.
- **운영 영향**: NFC 단독 workflow는 FAIL이지만 같은 SHA의 전체 VoiceFlow CI/운영 배포는 PASS. 2026-08-31 재확인에서 공개 `/api/health`의 gateway/core/deviceNearby 포함 전 서비스 HTTP 200. 잔존 운영 장애 없음.
- **최초 잘못된 상태**: `.github/workflows/deploy-nfc-admin-v1.yml`은 `voiceflow-production-rollout` 동시성 그룹을 사용하지만 `.github/workflows/ci.yml`의 `deploy-production` job은 해당 그룹에 참여하지 않아 동일 VPS·checkout·4183 컨테이너를 동시에 재기동 가능.
- **확정 원인**: 동일 시각 전체 배포와 NFC 단독 배포가 같은 runner `STAR45-VOICEFLOW-01`, 저장소 `/opt/star45/voiceflow-smart-workspace`, deviceNearby 컨테이너/포트 4183을 공유. NFC 검증이 전체 배포 재기동 구간과 충돌.
- **최소 수정**: `.github/workflows/ci.yml`의 `deploy-production` job에 기존 NFC와 동일한 `voiceflow-production-rollout`, `cancel-in-progress:false`를 추가해 두 운영 배포만 직렬화. CI에 두 workflow의 공유 잠금 계약검사 추가.
- **보호 범위**: 앱 소스, 음성·마이크·STT, 원문·번역, 대화 UI, 초대 API/QR, 8명 제한, 화상, DB, DNS, Secret, Provider, 컨테이너 정의는 변경하지 않음.
- **단계 상태**: SOURCE CANDIDATE. PR CI/DOCKER PENDING. 운영 코드는 불변이므로 DEPLOY/OPERATING/DEVICE는 이 후보에 N/A이며, 다음 실제 동시 트리거에서 직렬 실행 증거를 추가 확인.
- **롤백**: `.github/workflows/ci.yml`의 deploy-production job-level concurrency 3줄과 `Validate production deploy serialization` 검사만 되돌리면 직전 상태로 복귀.


### 2026-08-31 · PR #247 운영 배포 직렬화 가드 반영 완료

- **PR/병합**: [PR #247](https://github.com/leewonkyu73-sys/voiceflow-smart-workspace/pull/247), squash SHA `62ced215461182eb87e0b75d13f42b43441e6a71`.
- **PR CI/DOCKER PASS**: run `33365581119`; test job `99405419572`, Docker job `99405721021`. 새 `Validate production deploy serialization`, npm test, 전체 문법·프런트 생성, Docker build PASS.
- **main CI/DOCKER PASS**: run `33365745876`; test job `99405917270`, Docker job `99406175272`. browser-e2e와 deploy-production은 배포 표식 없는 workflow-only 변경이라 의도대로 SKIPPED.
- **수정 결과**: 전체 `deploy-production`과 NFC 단독 workflow가 동일 `voiceflow-production-rollout` 그룹 및 `cancel-in-progress:false`를 사용. 실행 중 배포를 취소하지 않고 같은 VPS 운영 재기동을 직렬화.
- **운영 보존**: 배포·앱 코드 미변경. 공개 `https://voice.star45.net/api/health`에서 gateway/core/deviceNearby 포함 전 서비스 HTTP 200 확인 상태 유지.
- **단계 판정**: SOURCE PASS · CI PASS · DOCKER PASS · DEPLOY N/A · OPERATING PASS(기존 운영 불변) · DEVICE N/A. 다음 실제 동시 트리거의 대기/직렬 실행 로그는 후속 관측 전 UNVERIFIED.
- **롤백**: merge SHA의 `.github/workflows/ci.yml` job-level concurrency 3줄과 집중 계약검사를 되돌리면 직전 상태로 복귀.


## 2026-08-31 · Samsung PWA 무음·소음 STT 환각 차단 후보

- **실기기 증상**: Samsung 설치형 PWA에서 사용자 발화와 다른 `그러니까요`, `[끝]` 등이 원문으로 확정되고 번역됨. 화면의 `서버 확정`으로 local Whisper 경로임을 확인.
- **운영 재현**: 운영 transcribe API에 3초 합성 무음을 보내 `[미리보기]`, 3초 저잡음을 보내 `[끝]` 응답. provider는 모두 `local-whisper`. 번역기가 아니라 STT 비음성 환각으로 원인 확정.
- **Golden/보호**: Samsung 2줄 원문·번역·무소음 Golden `d8395a8ad79a72d84bc807dfb4cdaf0626f50562`; 현재 PC·동결 public app·번역·대화·초대·화상·자료·의장·DB·DNS·Secret·Provider 불변.
- **최소 수정**: 공식 whisper.cpp 서버의 `--suppress-nst`와 `--no-speech-thold 0.45`를 localhost STT 컨테이너에만 적용. 프런트와 API 계약은 변경하지 않음.
- **회귀 보호**: local STT 집중 테스트가 Compose의 두 비음성 억제 옵션을 강제.
- **단계 상태**: ROOT CAUSE PASS · SOURCE CANDIDATE · FOCUSED/CI/DOCKER/DEPLOY/OPERATING PENDING · Samsung DEVICE UNVERIFIED.
- **완료 기준**: 운영 합성 무음·저잡음 transcript 공백, 실제 발화 2줄 원문·각 번역, 반복/대꾸형 문장 없음, PC 보호검사 PASS.
- **롤백**: local STT command의 두 옵션과 집중 테스트/원장 항목만 되돌리면 현재 운영으로 복귀.


### PR #248 비음성 억제 SOURCE 검증

- PR #248, squash `61ce74b7a4e4ae9a293e0b3f0880fdcf1b716149`; PR run `33385716063`에서 npm test와 Docker PASS.
- 첫 병합 메시지에 운영 표식이 없어 deploy-production은 의도대로 미실행. 운영 합성 무음·저잡음은 기존 컨테이너에서 `[끝]` 유지.
- 후속은 코드 변경 없이 `[deploy-production] [v4-mobile-canary] [v4-mobile-server-stt] [local-stt-canary]` 표식으로 동일 후보를 배포하고 운영 probe를 재실행.


### 첫 비음성 억제 옵션 운영 FAIL 및 2차 최소 방어

- 배포 후 health 전 서비스 PASS. 동일 운영 probe에서 무음 `[끝끝끝]`, 저잡음 `[끝]`으로 공식 suppress/no-speech 옵션만으로는 FAIL.
- 추가 원인: tiny 모델이 비음성을 일반 텍스트 토큰으로 생성해 non-speech token 억제를 우회.
- 2차 후보: local-whisper 결과에만 운영에서 직접 재현된 `끝` 반복·`미리보기`·`그러니까요` 정규화 일치 결과를 공백 처리. 정상 문장 회귀 테스트 추가.
- PC·public app·번역·UI·API 계약·DB·DNS·Secret·Provider 불변. SOURCE CANDIDATE · CI/DOCKER/DEPLOY/OPERATING/DEVICE PENDING.


### 2026-08-31 · PR #248/#250 모바일 STT 방어 실패 및 부분 롤백

- DEVICE 재현: 무음에서 `끝`, `끝끝`, `그러니까요`; 실제 `말해볼까`가 `네 박사님`으로 오인식. BLOCKER FAIL.
- 실패한 시도: whisper.cpp suppress/no-speech 옵션과 재현 문구 사후 필터. 문구가 계속 변해 근본 해결이 아니며 패치 누적 중단.
- 부분 롤백: `lib/provider-adapters.mjs`, `local-stt-adapter.test.mjs`, local STT compose command만 PR #248 이전 blob으로 정확히 복원. PC·8명 방·초대·QR·화상·UI·DB·DNS·Secret 불변.
- 다음 원칙: 마지막 Samsung DEVICE Golden `d8395a8ad79a72d84bc807dfb4cdaf0626f50562`과 현재 오디오 입력을 비교하기 전 신규 STT 패치/모델 변경 금지.
- 상태: SOURCE CANDIDATE · CI/DOCKER/DEPLOY/OPERATING PENDING · MOBILE DEVICE FAIL.

## 2026-08-31 · 모바일 서버 STT 무음 환각 근본 원인 및 Silero VAD 격리 수정

- 태그: Android, PWA, STT, Whisper, tiny, Silero, VAD, 무음환각, 배포게이트
- 사용자 증상: Samsung PWA에서 실제 발화 `말해볼까`가 `네 박사님`으로 확정되고, 말하지 않은 `끝`, `끝끝`, `그러니까요` 등이 계속 생성됨. 화면에 `서버 확정 9.3초`가 표시됨.
- 보호 범위: PC 브라우저 STT, UI, 번역, 초대, 화상, 8인 회의실, QR, DB, DNS, Secret은 변경하지 않음.
- Golden 재판정:
  - `d8395a8ad79a72d84bc807dfb4cdaf0626f50562`와 현재 `5a1ff2d3b9b0ade91e25b487410ad3484826de43`의 STT 관련 소스·운영 정적 자산은 동일.
  - 당시 Samsung 2문장 성공이 browser STT인지 local tiny fallback인지 증거가 없고 무음·주변소음 장시간 검증도 없어, 기존 Golden은 `CONDITIONAL`로 강등.
- 최초 실패 경계:
  - SOURCE first bad: `b41af630a2e33eff758d6c16ab4c2558e8474307` — `LOCAL_STT_ENABLED=1`에서 local tiny를 최우선 경로로 추가.
  - OPERATING first bad: `d8395a8ad79a72d84bc807dfb4cdaf0626f50562` — sidecar 명령을 고쳐 실제 4186 tiny가 기동.
- 확정 원인:
  - Android browser STT가 1.5초 동안 결과를 내지 않으면 서버 fallback 시작.
  - fallback은 발화 여부를 확인하지 않고 2.2초 WebM을 `blob.size>900`만으로 반복 업로드.
  - local Whisper tiny가 무음·저잡음을 문장으로 생성하고, 비어 있지 않은 응답이 즉시 원문 저장·번역됨.
  - 운영 API에서 3초 순수 무음은 임의 문구, 낮은 pink noise는 `수고하셨습니다.`로 직접 재현.
- 실패한 접근:
  - PR #248의 `--suppress-nst --no-speech-thold 0.45`: 고신뢰 환각을 막지 못함.
  - PR #250의 특정 문구 차단: 환각 문구가 계속 변해 근본 해결이 아님.
  - PR #251은 위 두 변경을 복원했으나 배포 사전검사가 local provider를 허용하지 않아 run `33390093825`가 컨테이너 교체 전에 중단.
- 단일 수정 가설:
  - tiny 모델·2.2초 프런트 경로를 유지하고, 고정 whisper.cpp sidecar에 `silero-v6.2.0` VAD 모델만 로드.
  - local adapter 요청에만 `vad=true`와 공식 기본값 `0.50 / 250ms / 100ms / 30ms`를 전송.
  - 특정 문구 blacklist와 모델 업그레이드는 포함하지 않음.
  - 격리 Docker 검사는 3초 순수 무음과 낮은 pink noise의 transcript가 모두 빈 문자열인지 확인.
- 연동 수정: `LOCAL_STT_ENABLED=1`인 배포 사전검사는 실제 활성 provider인 `local-whisper`만 허용하도록 정렬. 외부 provider 모드에서는 기존 `openai/gemini` 계약 유지.
- 변경 파일:
  - `deploy/docker-compose.v23.yml`
  - `lib/provider-adapters.mjs`
  - `local-stt-adapter.test.mjs`
  - `tests/local-stt-vad-runtime.sh`
  - `.github/workflows/ci.yml`
  - `scripts/verify-live-stt-provider.mjs`
  - `deploy-runtime-guard.test.mjs`
- 현재 상태: ROOT CAUSE PASS · SOURCE PASS · PR/CI/DOCKER/VAD RUNTIME/DEPLOY/OPERATING/DEVICE 대기.
- 완료 기준: PR CI와 고정 이미지 VAD runtime PASS → 운영 배포 PASS → 운영 무음·저잡음 응답 공백 → Samsung에서 고정 한국어 2문장 원문·번역 정확 및 5초 무음 중 유령 문장 0건.
- 별도 후속 경계: 무음은 해결됐지만 짧은 한국어가 틀리면 동일 Samsung 음원으로 tiny와 multilingual base만 별도 A/B. 이번 수정과 묶지 않음.
- 롤백: 위 변경 파일을 `5a1ff2d3b9b0ade91e25b487410ad3484826de43` 내용으로 복원하거나 `LOCAL_STT_ENABLED=0`으로 local sidecar를 차단. DB·DNS·Secret 변경 없음.



### 2026-08-31 · Silero VAD 운영 반영 및 비음성 환각 차단 검증

- **변경 계보**: PR #252 / merge `0d9c6fc407e5fd8630c7bd01452afb8d54f7cf98`에서 Silero VAD와 무음·저잡음 격리 검사를 추가. PR #253 / `b9bb58ea8058df90afb8ca48b6119a2312d15ff9`에서 공식 JFK WebM 양성 음성 control을 추가. PR #254 / `9ad28639cf8cc103b5ac894ee1f8373a3af03736`에서 workflow 플래그 보존과 배포 후 양성 probe를 추가. PR #255 / `14d442c8007cef2a501033f8ca2b1732c134585f`에서 구형 sidecar를 VAD 후보로 오인하던 사전검사를 수정.
- **회귀검사**: PR #255 run `33396574442`에서 test와 Docker PASS. 고정 whisper.cpp 이미지의 격리 runtime은 3초 무음·저잡음 transcript 공백, 2.2초 실제 음성 `and so my fellow Americans.` 검출을 모두 통과.
- **배포 차단 이력**: main run `33394020135`는 배포 플래그가 .env에 덮여 외부 provider 경로로 빠져 중단. run `33395562739`는 살아 있는 구형 4186 sidecar를 신형으로 오인해 VAD 요청이 거부되어 교체 전에 중단. 두 실행 모두 운영 컨테이너 교체 전 실패로 기존 운영을 보존.
- **최종 배포**: main run `33396914774` test·Docker·deploy-production PASS. 로그에서 `Local STT VAD preflight deferred until sidecar reconcile` 확인 후 구형 `voiceflow-local-stt` stop/remove, 신형 sidecar create/start, 전체 health PASS.
- **양성 운영 증거**: 배포 후 실제 음성 probe가 `provider=local-whisper`, `model=tiny`, `text_detected=true` 및 `VOICEFLOW_LIVE_STT_PROVIDER_PASS`. 내부 Chromium 회의·메뉴 E2E `19/19 PASS`, 최종 `OVERALL 100% PASS`.
- **비음성 운영 증거**: 공개 모바일 transcribe 경로에 3초 순수 무음과 3초 저강도 pink noise를 각각 전송. 두 응답 모두 HTTP 200, `provider=local-whisper`, `text=""`, `translation=""`로 PASS. 문구 blacklist가 아니라 발화 전 VAD 차단으로 해결.
- **PC 보호**: 공개 `app.js` SHA-256은 `a9d8943a176e3ec8613bfa11705482a6149e10d3505bd4a0e7f1acead6014ffc`로 기존 동결 자산과 동일. 공개 gateway/core 전 서비스 health PASS.
- **현재 판정**: ROOT CAUSE PASS · SOURCE PASS · CI PASS · DOCKER PASS · DEPLOY PASS · OPERATING PASS · Samsung DEVICE PENDING.
- **기기 완료 기준**: Samsung PWA를 닫았다 다시 열고 `오늘 회의를 시작합니다.`, `내일 오전 열 시에 다시 만나요.`를 말한 뒤 5~10초 침묵. 원문 2개와 각 번역만 남고 침묵 중 신규 문장 0건이면 DEVICE PASS.
- **분리 원칙**: 침묵 환각은 해결됐지만 실제 짧은 한국어 정확도가 낮으면 동일 기기 음원으로 tiny 대 multilingual base A/B를 별도 변경으로 진행. 현재 VAD 수정과 섞지 않음.


## 2026-08-31 · Android Chrome 기기 내 고정밀 STT 전용 후보

- **사용자 DEVICE 증상과 결정**: Samsung 휴대폰의 원문이 실제 발화와 다르고 PC보다 정확도가 낮으며 응답도 늦음. 서버에서 음성을 받아 처리하지 말고 휴대폰 Chrome에서 직접 해결하도록 명시 요청.
- **확정된 경계 문제**: 기존 v4 `browser-web-speech`는 `SpeechRecognition`을 사용했지만 `processLocally` 기본값이 false여서 브라우저가 원격 인식을 선택할 수 있었고, Android Chrome 외 분기에는 MediaRecorder `/transcribe` 서버 STT가 남아 있었음. 따라서 “브라우저 STT”가 “휴대폰 내부 STT”를 보장하지 않았음.
- **공식 기준**: Chrome 139부터 `processLocally`, `available()`, `install()` 기반 기기 내 Web Speech가 제공되고, Chrome 150부터 `conversation`·`dictation` 품질 수준을 선택할 수 있음. 이번 후보는 정확도 저하를 숨기지 않도록 Android Chrome 150 이상만 허용.
- **최소 후보**:
  - 일반 Android Chrome의 기존 `/v4/mobile?...&entry=browser` 경로에서만 `recognition.processLocally=true`를 강제.
  - `SpeechRecognition.available({langs,processLocally:true,quality})`로 `conversation`을 우선 확인하고 불가할 때만 `dictation`을 사용. 다운로드 가능 상태면 `install()`로 기기 내 언어팩을 설치한 뒤 재확인.
  - 기기 내 고정밀 모델을 확인하지 못하면 인식을 시작하지 않고 명시적 오류로 중단. 서버 STT·원격 Web Speech로 자동 우회하지 않음.
  - v4 앱에서 `mobile-speech-session`, `mobile-media-session`, `createMobileTranscriptionAdapter`, `MediaRecorder`, `/transcribe` 연결을 제거. 음성 오디오는 서버에 업로드하지 않음.
  - 인식된 **텍스트**의 기존 caption 저장과 DeepL 번역은 유지. 설치형 전체 PWA, PC, 초대·화상·자료·의장·8인 방, DB·DNS·Secret·Provider 설정은 변경하지 않음.
- **집중 검증**:
  - `VOICEFLOW_V4_ON_DEVICE_CHROME_SPEECH_PASS`.
  - conversation 즉시 사용, 언어팩 설치 후 재확인, conversation→dictation 기기 내 전용 하향, 언어팩 불가 시 recognition start 0회를 검증.
  - app/module 문법과 deploy shell 문법 PASS. v4 app에 서버 STT 어댑터·MediaRecorder·getUserMedia·`/transcribe`·timer 부재 계약 PASS.
- **첫 PR CI 차단**: PR #258 head `7425d530ff6dc3a185b4566005f9ab58270999e6`, run `33408281901`의 기존 media-session 테스트가 v4 app에 `createMobileMediaSession` 연결이 계속 있어야 한다는 과거 계약으로 FAIL. 제품 후보의 focused 검사는 PASS였고 Docker/배포는 안전하게 SKIPPED.
- **후속 최소 정렬**: 독립 media/server-speech 모듈 자체 단위검사는 유지하되 활성 v4 Chrome 앱에는 두 모듈이 연결되지 않아야 한다는 반대 계약으로 media/speech 소비자 테스트만 갱신. `VOICEFLOW_V4_ON_DEVICE_MEDIA_UNWIRED_PASS`, `VOICEFLOW_V4_ON_DEVICE_SERVER_STT_UNWIRED_PASS` 로컬 PASS. 제품 코드 추가 변경 없음.
- **현재 판정**: SOURCE PASS · FOCUSED PASS · CI/DOCKER/DEPLOY/OPERATING PENDING · Samsung Chrome DEVICE UNVERIFIED. 설치형 PWA와 PC는 변경 범위 밖이며 운영 배포 전 상태 유지.
- **비용·개인정보**: 신규 STT Provider 호출·Secret·고정 인프라 비용 없음. 최초 언어팩 다운로드 데이터만 발생할 수 있음. 원문 저장·번역 시 기존 caption/DeepL 텍스트 경로는 유지.
- **중단 조건**: 운영 자산에 v4 서버 STT 코드가 다시 나타남, `processLocally`/언어팩 확인 실패 후 recognition이 시작됨, PC·설치형 PWA·기존 E2E 회귀, Samsung에서 원문 오인식·지연·한 문장 종료가 재현되면 전체 성공 판정 금지.
- **롤백**: 이번 후보의 v4 module/app/HTML/test와 deploy guard만 main `91cda89daeb69199dc3b3309da49ea09ea9db95f` 내용으로 복원. DB·DNS·Secret·Provider rollback 없음.


## 2026-08-31 · PWA 다운로드 Whisper Small·브라우저·동의 서버·텍스트 4모드 격리 후보

- **사용자 결정**: 앱스토어 심사 없는 PWA를 유지하고 품질을 우선한다. 휴대폰별로 `다운로드 모델`, `기존 브라우저 인식`, `명시 동의 후 서버 인식`, `텍스트 전용`을 선택할 수 있어야 한다. 성능·저장공간·브라우저 제약이 있으면 서버를 자동 선택하거나 몰래 업로드하지 않고 텍스트 전용을 안전 기본값으로 둔다.
- **가입·초대 동의 추가 결정**: PWA 설치 안내와 초대 회의 참여 전에 회원가입 및 이용약관·개인정보 필수 동의를 확인한다. 서버 음성 업로드 동의는 가입 약관에 묶지 않고 매 브라우저 세션에서 별도 체크한다. 미가입 후보 클라이언트의 회의 API는 `signup_consent_required`, 가입했어도 서버 오디오 동의 헤더가 없으면 `server_audio_consent_required`로 거부한다.
- **기준과 문제 경계**: 작업 기준 main은 `4832a7dc83a2281922c05f94c446490da1dca412`. 기존 `/v4/mobile`은 Android Chrome 기기 내 Web Speech만 강제하지만 사용자 Samsung에서 선택 언어팩을 사용할 수 없어 DEVICE 실패. 과거 Samsung 단일 샘플 browser STT+DeepL 성공 배포 `356af4d3...`는 0.1초 원문·1.0초 번역 증거가 있으나 다문장·iPhone Golden은 없음.
- **격리 구조**: 운영 기본값 OFF인 `VOICEFLOW_V4_LOCAL_STT_ENABLED`와 별도 `/v4/local-stt-test/` 경로를 추가한다. 현재 `/v4/mobile`, PC, 전체 PWA 홈, 초대·화상·자료·의장·8인 방, DB, DNS, Secret, Provider 설정은 수정하지 않는다. 입력 방식 전환 때 기존 음성·미디어 세션을 중지해 마이크 단일 소유권을 유지한다.
- **로컬 품질 후보**: 공식 Transformers.js `4.2.0`, 모델 `onnx-community/whisper-small`, revision `3bed9fc1d07404f8e39e3e71d76538ae225ce2aa`, WebGPU, encoder/merged decoder Q8을 고정. 예상 모델 가중치 약 249MB, 런타임 포함 안내 약 260MB. 음성 Blob은 브라우저 AudioContext에서 16kHz mono Float32로 변환해 Worker로만 전달하며 로컬 Worker에는 `/transcribe` 호출이 없다.
- **기기 정책**: WebGPU·MediaRecorder·AudioContext가 있고 알려진 여유 저장공간이 모델+128MB 이상이며 메모리/CPU가 명백히 낮지 않을 때만 다운로드 모델을 권장. Android Chrome 고정밀 Web Speech가 가능하면 기존 브라우저 방식을 사용할 수 있다. 서버는 온라인·MediaRecorder·세션 동의가 모두 있어야 활성화한다. 나머지는 텍스트 전용이며 caption/DeepL/저장/회의정리 계약은 동일하다.
- **PWA·캐시 경계**: 전용 manifest id/start/scope와 전용 service worker를 사용한다. 전용 service worker는 앱 셸만 캐시하고 API·모델·오디오를 캐시하지 않는다. Transformers Cache API key는 `voiceflow-local-stt-whisper-small-q8-v1`로 격리하며 모델 삭제는 해당 격리 캐시만 제거한다. 기존 동결 root service worker는 바이트 단위로 변경하지 않는다.
- **가입 후 설치 동작**: 미로그인 상태에서는 회의 앱과 설치 버튼을 숨긴다. 가입 API의 `termsAccepted`·`privacyAccepted` 성공 또는 기존 로그인 후에만 회의 UI와 PWA worker를 연다. 설치형 시작 URL에 meeting id가 없으면 인증 후 새 회의를 만들고 URL에 id를 고정한다.
- **SOURCE 검증**: phase1 isolation, 기존 mobile speech/browser/off-route, 신규 4모드 정책/Worker 계약, 플래그 OFF/ON 실서버 자산, 미가입 401, 필수동의 400, 가입 후 200, 서버 오디오 무동의 403, 기존 `/v4/mobile` 불변이 로컬 PASS. app/worker/service-worker/server 문법, deploy shell, CI/Compose YAML PASS.
- **PWA checker**: 로컬 부분 복원본에는 PNG 아이콘 파일이 없어 자동 checker가 icon missing에서 중단. 기준 GitHub commit에서 192/512/maskable PNG blob 존재는 확인. 전체 checkout CI/배포와 브라우저 E2E 증거 전까지 PWA 자동 판정은 CONDITIONAL.
- **브라우저 자동검사**: 가입 게이트→4모드→서버 동의→텍스트 caption→전용 SW/API 비캐시를 검증하는 `tests/e2e-v4-local-stt.mjs`를 추가. 현재 작업 컨테이너는 Playwright 패키지만 있고 Chromium 실행 파일이 없어 로컬 브라우저 실행은 UNVERIFIED; workflow_dispatch/배포 Playwright에서 실행한다.
- **단계 판정**: ROOT BOUNDARY PASS · SOURCE PASS · FOCUSED PASS · PWA CONDITIONAL · CI PENDING · DOCKER PENDING · DEPLOY PENDING · OPERATING 기존 경로 PASS/신규 경로 N/A · Samsung/iPhone DEVICE UNVERIFIED.
- **중단 조건**: 기존 `/v4/mobile` 또는 PC 자산 변경, 자동 서버 업로드, 가입·서버 동의 우회, 마이크 중복 소유, 모델 Worker의 오디오 네트워크 전송, caption/번역/정리 회귀, 모델 다운로드 후 실행 실패, Samsung/iPhone 실제 원문 품질·지연 실패 중 하나라도 확인되면 병합/전면 노출 금지.
- **롤백**: `VOICEFLOW_V4_LOCAL_STT_ENABLED=0`으로 신규 경로만 즉시 404 전환. 이후 신규 app/packages/tests와 server의 local route, Compose/CI/deploy 변수만 되돌리면 기준 main으로 복귀. 기존 root SW, DB·DNS·Secret·Provider 롤백 없음.

### PR #259 첫 CI 생성 앵커 실패와 소비자 정렬

- PR head `fc70a4270d820e215761445379976eea2aec0f4a`, run `33451178276`: `npm test`, 신규 모듈·앱·Worker·service worker 문법은 PASS. `Build and validate frontend artifact`에서 `stt_usage_anchor_missing:transcribe-timing`으로 FAIL하고 Docker는 안전하게 SKIPPED.
- 원인: 후보가 `server-v2.mjs`의 transcribe 선언을 세션 동의와 두 v4 client runtime routing 형태로 바꿨지만, 후속 생성 소비자 `scripts/patch-stt-usage-v364.mjs`는 직전 단일 `v4-mobile` 문자열만 exact anchor로 사용. 제품 런타임 실패가 아니라 누적 생성 체인의 소비자 미정렬.
- 최소 수정: STT usage 생성기가 신규 candidate anchor를 우선 인식해 같은 usage timing 필드를 주입하고, 직전 anchor도 fallback으로 유지. 신규 계약검사가 candidate anchor와 두 client routing 보존을 강제.
- 현재 판정: SOURCE PASS · FOCUSED PASS · 첫 PR CI FAIL(원인 확정/수정 후보) · 재실행 CI/DOCKER PENDING · DEPLOY/DEVICE PENDING.

### PR #259 두 번째 CI 동결 PWA 자산 보호와 완전 복원

- PR head `2865d1d7b1697c603b607586d1dc84af8112291d`, run `33451453276`: 앞서 실패한 STT usage 생성 체인까지 PASS. 이후 `v3-artifact-immutability`에서 동결 자산 `public/sw.js`의 기준 해시와 후보 해시가 달라 FAIL하고 Docker는 안전하게 SKIPPED.
- 원인: 신규 후보 캐시를 보존하려고 기존 root service worker의 activate/fetch 범위를 수정했으나, 이는 신규 경로 격리 원칙을 넘어 기존 설치형 PWA 운영 자산을 바꾸는 변경이었다. 보호 게이트가 의도대로 차단했다.
- 최소 수정: `public/sw.js`를 기준 blob `ba24ca188518465ade928d888170350123a72a81`로 완전 복원. 신규 `/v4/local-stt-test/` 전용 worker만 자기 prefix 앱 셸 캐시를 관리하고 API·모델·오디오 요청을 우회한다. 기존 PC·PWA root worker 변경은 0건이다.
- 명시적 트레이드오프: 이후 기존 root worker가 새로 활성화되는 시점에는 Transformers 모델 CacheStorage가 지워져 약 260MB 모델을 다시 내려받아야 할 수 있다. 기존 운영 PWA 불변성을 우선하며, 후보 앱은 모델 부재를 감지해 재다운로드를 안내한다.
- 현재 판정: ROOT SW RESTORE PASS · SOURCE PASS · FOCUSED PASS · 두 번째 PR CI FAIL(보호 게이트/원인 확정/복원 완료) · 세 번째 CI/DOCKER PENDING · DEPLOY/DEVICE PENDING.

### PR #259 세 번째 CI·Docker 통과와 명시적 브라우저 E2E 호출

- PR head `e318b50a4f134c0280da863aac8a966d85573e7e`, run `33451860188`: test job의 전체 `npm test`, 신규 app/worker/local worker 문법, STT usage 누적 생성 체인, `v3-artifact-immutability`, frontend artifact 검증이 모두 PASS. Docker job의 고정 local STT VAD runtime과 production image build도 PASS.
- 기존 root `public/sw.js` blob은 기준 `ba24ca188518465ade928d888170350123a72a81`와 동일하며 PR diff에서 제거된다. 앞선 두 보호 실패의 원인을 보존하면서 제품 변경은 후보 경로 안으로 다시 격리됐다.
- 브라우저 검증은 기본 PR 비용을 늘리지 않도록 기존 `workflow_dispatch`를 유지하고, PR 제목에 `[browser-e2e]`가 명시된 경우에만 같은 full-stack Chromium E2E를 실행하도록 opt-in 조건을 추가한다. 이 후보 PR에서만 marker를 붙여 가입 동의→4모드→서버 세션 동의→텍스트 caption→전용 SW/API 비캐시를 병합 전에 검증한다.
- 현재 판정: ROOT SW RESTORE PASS · SOURCE PASS · FOCUSED PASS · CI PASS · DOCKER PASS · BROWSER E2E PENDING · DEPLOY/DEVICE PENDING.

### iPhone PWA 설치 안내 보완

- 수동 iPhone 경계 감사에서 iOS Safari는 Chromium의 `beforeinstallprompt` 이벤트를 제공하지 않으므로, 기존 후보 코드에서는 가입 후에도 설치 버튼이 계속 숨겨지는 진입 문제를 확인했다.
- 후보 앱 안에서만 iPhone/iPadOS를 판별해 가입 확인 후 `iPhone 설치 방법` 버튼을 노출하고, `공유(□↑) → 홈 화면에 추가 → 추가` 절차를 안내한다. 설치형 실행에서는 기존처럼 숨긴다.
- manifest와 함께 iOS 홈 화면 표시를 위한 `apple-mobile-web-app-capable`, 앱 제목, 기존 192px 아이콘의 `apple-touch-icon`을 추가한다. 가입 전 설치 UI 숨김과 초대 가입 동의 게이트는 유지된다.
- 현재 판정: iPHONE INSTALL ENTRY SOURCE PASS · 실제 Safari 홈 화면 추가/재실행은 DEVICE UNVERIFIED.

### PR #259 hosted runner 복구와 기존 full-stack QA 선행 실패 분리

- UTC 2026-09-01 월 전환 직후 run `33452737684`의 browser job을 재실행하자 step 0 실패가 사라지고 Playwright 설치·production image build·full-stack 시작까지 진입했다. 따라서 직전 무로그 실패는 월말 hosted-runner 사용 한도였으며 후보 제품 실패가 아니다.
- 실제 실행은 후보 E2E 전에 기존 `deploy/qa-v23.sh`의 첫 gateway health에서 중단. 로그상 모든 컨테이너는 시작됐으나 gateway health는 동일 core 4180의 identity 상태를 실제 `/api/health`가 아니라 `/health`에서 읽는 기존 clean-stack 계약 문제다. 신규 후보 브라우저 코드는 아직 실행되지 않았다.
- 범위 분리: 기존 `browser-e2e`는 원래 `workflow_dispatch` 전용으로 복원하고 gateway/운영 코드는 변경하지 않는다. PR marker는 신규 `local-stt-browser-e2e`만 켜며, 임시 DATA_DIR의 core server를 `VOICEFLOW_V4_LOCAL_STT_ENABLED=1`로 격리 실행해 가입 동의→4모드→서버 세션 동의→텍스트 caption→전용 SW/API 비캐시만 검증한 뒤 종료한다.
- 현재 판정: SOURCE PASS · CI PASS · DOCKER PASS · HOSTED RUNNER PASS · LEGACY FULL-STACK QA CONDITIONAL(기존 gateway health) · CANDIDATE BROWSER E2E PENDING · DEPLOY/DEVICE PENDING.

### PR #259 후보 전용 Chromium E2E 통과

- PR head `e57b406ea05d27c51f3c245de4e3d5eac6554d9f`, run `33453302166`: 전체 test와 frozen artifact 검증 PASS, Docker/VAD runtime 및 production image build PASS, 신규 `local-stt-browser-e2e` PASS. job `99688287489` 로그에 `VOICEFLOW_V4_LOCAL_STT_BROWSER_E2E_PASS`가 기록됐다.
- 실제 Chromium 412×915 viewport에서 가입 전 회의 UI·설치 버튼 비노출, 이용약관·개인정보 동의 가입 201, 회의 UI 공개, 4모드 존재, 무동의 서버 모드의 텍스트 강제, 세션 동의 후 서버 모드 활성화, 텍스트 모드 마이크 비활성, caption 저장 201·화면 표시, 전용 service worker 등록, 인증 API cache 미저장을 검증했다.
- 기존 full-stack 수동 job은 원래의 `workflow_dispatch` 전용으로 복원돼 이 PR의 일반 경로에서는 SKIP. 후보 브라우저 검사는 기존 gateway 결함과 분리된 임시 core/data에서 통과했으며 운영 gateway·PC·기존 PWA 코드는 변경하지 않았다.
- 한계: headless Chromium은 약 260MB Whisper 가중치를 실제 내려받거나 WebGPU 추론·마이크를 실행하지 않는다. Samsung/iPhone의 다운로드 시간·재실행·한국어 정확도·속도는 운영 canary 배포 후 DEVICE 검증까지 UNVERIFIED.
- 현재 판정: SOURCE PASS · CI PASS · DOCKER PASS · CANDIDATE BROWSER E2E PASS · PWA CONTRACT PASS · DEPLOY PENDING · Samsung/iPhone DEVICE UNVERIFIED.


## 2026-09-01 · 600MB 다운로드 모델 Samsung DEVICE FAIL 및 품질 비교 기반 재시작

- **운영 기준**: main/deploy SHA `5d1a1f21a602b20322a5215698b5b06e51de210b`. PR #263은 누락된 모델 자산을 완전한 Whisper Small `fp32 encoder + q4 decoder` 약 600MB 구성으로 교체하고 확대·스크롤 계약을 보정했으며, PR #264는 시작 후 6초 clip 자동 완료를 추가했다.
- **실기기 증거**:
  - Samsung 화면에서 모델 다운로드 완료와 마이크 연결 완료가 표시됨.
  - `음성 원문 시작` 뒤 말한 원문이 나타나지 않는 증상이 보고됨.
  - 이후 생성된 내용도 실제 발화와 다르고, PC 대비 성능 향상이 없으며, 4모드·4버튼 UI가 복잡하다는 사용자 판정이 확인됨.
- **판정 정정**: PR #259/#263/#264의 SOURCE·CI·Docker·Chromium 계약 PASS는 유지하지만 실제 기능은 `DEVICE FAIL`. 현재 600MB 다운로드 모델을 운영 권장값이나 메인화면 기본값으로 승격하지 않는다.
- **반복 패치 중단**: 다운로드 모델 크기·타이머·버튼을 추가 보정하지 않는다. 기존 `/v4/local-stt-test/`는 실패 증거와 롤백 대상으로 격리하며 PC 메인화면·root PWA·기존 `/v4/mobile`에 새 연결을 만들지 않는다.
- **새 단일 목표**: 동일 Samsung 녹음 파일을 브라우저, Google Chirp 3, Deepgram Nova-3, OpenAI Transcribe, Azure Speech, 자가호스팅 후보에 순차 적용해 말한 내용 일치 여부를 먼저 측정한다. STT final 원문은 답변·요약·번역으로 재작성하지 않는다.
- **Phase 5 기반 변경**:
  - `architecture/mobile-chrome-pwa-speech-quality-recovery-plan.md`: PC 화면 동결, 단일 마이크 소유, API 옵션, 품질 게이트, 예상 시간·비용·승인·롤백 계획.
  - `speech-provider-contract`: 서버 음성 동의, 한 세션 한 Provider, source language 고정, interim 저장 금지, session/utterance/sequence 불일치 폐기, final 원문 보존 계약.
  - `speech-quality-evaluator`: 무음 환각, 발화 누락, CER, 숫자, 고유명사, 순서, p50/p95 지연과 비용 정규화.
  - `speech-quality-benchmark`: 같은 오디오 객체를 Provider별로 **순차** 실행하고 하나의 비교 보고서로 집계. 병렬 마이크/STT 실행 없음.
  - `speech-provider-selection`: 실측 `PASS` Provider만 세션 시작 전에 선택. 동의·온라인·비용 상한을 만족하지 않거나 미검증이면 텍스트 전용.
  - `speech-quality-provider-adapters`: Google Chirp 3, Deepgram Nova-3, OpenAI Transcribe의 키 주입형·mock 가능 adapter. 아직 server route나 운영 Secret에 연결하지 않음.
- **집중 검증**:
  - `VOICEFLOW_V4_PHASE5_SPEECH_PROVIDER_CONTRACT_PASS`.
  - `VOICEFLOW_V4_PHASE5_SPEECH_QUALITY_EVALUATOR_PASS`.
  - `VOICEFLOW_V4_PHASE5_SPEECH_QUALITY_BENCHMARK_PASS`.
  - `VOICEFLOW_V4_PHASE5_SPEECH_PROVIDER_SELECTION_PASS`.
  - `VOICEFLOW_SPEECH_QUALITY_PROVIDER_ADAPTERS_PASS`.
  - `VOICEFLOW_V4_PHASE1_ISOLATION_PASS`와 신규 모듈 문법 PASS.
- **현재 단계**: ROOT BOUNDARY PASS · SOURCE PASS · FOCUSED PASS · 전체 repository CI/DOCKER PENDING · ROUTE/DEPLOY/OPERATING N/A · API LIVE/DEVICE UNVERIFIED.
- **품질 게이트**: 무음 환각 0, 발화 누락 0, 평균 CER 12% 이하, 숫자 오류 0, 고유명사 recall 95% 이상, p95 최종 원문 2.5초 이하, 순서 오류 0. 한 항목이라도 실패하면 자동 기본 Provider로 선택하지 않는다.
- **비용·개인정보**: 이번 단계는 mock 요청만 사용하며 실제 Provider 호출·청구·음성 업로드·Secret 변경 0건. 실제 A/B는 별도 세션 음성 전송 동의와 사용자 비용 승인 뒤에만 실행한다.
- **보호 범위**: PC·root PWA·현재 모바일 route·가입/로그인·초대·화상·자료·의장·caption/DeepL·회의정리·DB·DNS·Secret·Provider Hub 설정 불변.
- **롤백**: 신규 계획 문서, Phase 5 packages/tests, `lib/speech-quality-provider-adapters.mjs`, package test 연결과 이 원장 항목만 제거. 운영 배포가 없으므로 stack·DB·Secret rollback 불필요.

### PR #265 품질 기반 병합 및 격리 비교 화면 후보

- PR #265 head `3f0682d7b1787b96118a08b4e3d89244016addcd`, VoiceFlow CI run `33473342582`: 전체 `npm test`, 누적 생성·동결 자산 검사, frontend artifact와 production Docker build가 PASS. local-whisper/browser/deploy jobs는 marker가 없어 의도대로 SKIP. squash merge SHA `b8e792a07a3a8c5b855064185c34ff3955ed968e`.
- 다음 후보는 운영 UI와 분리된 `/v4/speech-quality-lab/`를 추가한다. 확대·축소 허용 viewport, 문서 전체 세로 스크롤, 한 번 녹음/한 번 완료, 동일 `Blob`의 Provider 순차 전송, 원문·CER·숫자·필수 단어·p95·비용 표만 제공한다. 번역·회의정리·caption 저장은 호출하지 않는다.
- 화면과 API는 `VOICEFLOW_SPEECH_QUALITY_LAB_ENABLED=1`일 때만 존재한다. 실제 외부 호출은 별도 `VOICEFLOW_SPEECH_QUALITY_API_ENABLED=1`, Provider allowlist, 해당 credential, 로그인, 브라우저 세션 음성 동의가 모두 있어야 한다. 기본값은 전부 OFF이며 시간당 사용자별 기본 30회 제한을 둔다.
- 서버 응답과 UI에는 Secret 값을 포함하지 않는다. 녹음은 client 메모리 Blob과 요청 body에만 있고 filesystem/DB/CacheStorage에 저장하지 않는다. service worker는 API 요청을 가로채거나 오디오를 캐시하지 않는다.
- 품질 보고서의 PASS 최소 표본을 서로 다른 발화 4개와 무음 1개로 강화했다. 표본 부족은 `UNVERIFIED`, Provider 오류·빈 발화·환각·숫자/CER/키워드/지연 실패는 `FAIL`; 측정 PASS 이전에는 자동 라우터 후보가 되지 않는다.
- 로컬 집중검사: provider adapter, lab service, evaluator, sequential benchmark, provider selection, lab route/auth/consent/API-lock, phase1 isolation 및 관련 문법 모두 PASS. 실제 Provider 호출·비용·Secret 변경·배포는 0건.
- 현재 단계: SOURCE PASS · FOCUSED PASS · PR/전체 CI PENDING · PWA 자동검사 PENDING · BROWSER PENDING · DEPLOY/OPERATING/DEVICE PENDING.
- 보호 범위: PC·root PWA·기존 `/v4/mobile`·실패 격리 `/v4/local-stt-test`·가입/로그인 데이터·초대·화상·자료·caption/DeepL·회의정리·DB·DNS·기존 Secret·Provider Hub 불변.
- 롤백: 신규 lab app/service/tests와 server의 feature-flagged route/API, evaluator 최소 표본 변경만 제거한다. 아직 운영 배포가 없으므로 데이터·Secret·stack rollback은 없다.

### PR #266 CI·Docker PASS와 API 잠금 배포 후보

- PR #266 head `418c5b41ad589ebff7ed54b8b7641f8336daf2bd`, VoiceFlow CI run `33474711587`: 전체 `npm test`, 누적 생성·동결 자산 검사, frontend artifact와 production Docker build PASS. 외부 API·browser·deploy jobs는 marker가 없어 SKIP. squash merge SHA `15b5553568b1de470ee6224b9340481954db81e9`.
- 완전한 원격 checkout에서 기존 PWA 아이콘을 다시 확인했다: `voiceflow-icon-192.png` 192×192 PNG, `voiceflow-icon-512.png` 512×512 PNG, `voiceflow-icon-maskable-512.png` 512×512 PNG. 부분 작업 사본의 icon missing은 제품 자산 누락이 아니다.
- 다음 배포 후보는 `[speech-quality-lab]` marker에서 화면 flag만 1로 전달한다. workflow가 `VOICEFLOW_SPEECH_QUALITY_API_ENABLED='0'`을 강제하고 deploy script가 실제 core 환경에서도 API flag 0을 확인하지 못하면 실패한다. Provider allowlist·credential·가격·기본 Provider는 변경하지 않는다.
- 기존 600MB `/v4/local-stt-test/` marker는 새 배포에 포함하지 않아 flag 0/HTTP 404로 격리한다. 모델 파일·사용자 데이터는 삭제하지 않으며 marker를 되돌리면 재노출 가능하다.
- 신규 Chromium E2E는 412×915에서 확대 가능 viewport, 문서 세로 스크롤, root 가로 넘침 없음, 내부 결과표 스크롤, 로그인 전 Provider 비공개, 실행 버튼 비활성, service worker 제어와 API 비캐시를 확인한다. 운영 계정 생성·삭제는 하지 않는다.
- 로컬 판정: DEPLOY CONTRACT PASS · ROUTE PASS · YAML PASS · shell/node syntax PASS · Docker CLI N/A(작업 컨테이너 미설치). 전체 CI/Docker와 opt-in browser E2E를 PR에서 다시 실행한다.
- 운영 배포 종료 조건: 전체 CI·Docker·speech-quality-browser-e2e PASS, public HTTPS page/manifest/app/SW PASS, 익명 Provider API 401, core API flag 0, 실패 local-STT route 404. 한 항목이라도 실패하면 배포/병합 중단.
- 비용·데이터: 실제 STT API 호출·음성 업로드·Secret 변경·DB migration 0건. 새 시험 화면도 로그인·Provider·동의가 없으면 외부 전송 불가.
- 롤백: `VOICEFLOW_SPEECH_QUALITY_LAB_ENABLED=0`으로 새 URL을 즉시 404 전환. 기존 PC/root PWA/caption/DeepL/회의정리/DB는 별도 롤백 없음.

### 첫 speech-quality 운영 배포의 기존 Android v4 flag 회귀

- merge/deploy SHA `65d8b1528be3986ac552c369e6e5362901a81c3a`, push run `33475596434`: 전체 test와 Docker PASS. runtime stack 재기동, public speech-quality page/app/SW/manifest, core `LAB_ENABLED=1`, `API_ENABLED=0`, 익명 Provider API 401, 실패 local-STT route 404까지 PASS.
- 이후 기존 운영 `tests/e2e-meeting.mjs`의 `Android root immediately opens v4 four-control room`이 FAIL. 실제 marker가 `null`이었다.
- 원인: 새 merge marker에 `[speech-quality-lab]`만 있고 `[v4-mobile-canary]`가 없어 workflow가 기존 `VOICEFLOW_V4_MOBILE_ENABLED`를 0으로 재계산했다. 새 lab 기능 실패나 DB/Provider 문제는 아니다.
- HIGH 판정: Android root 진입 회귀가 있으므로 첫 배포 run 전체는 FAIL이며 완료로 인정하지 않는다.
- 최소 수정: production workflow에서 `[speech-quality-lab]` 배포도 기존 Android v4 flag를 1로 보존하도록 명시하고 계약검사에 고정한다. 실패 600MB local-STT는 계속 0, speech-quality API도 계속 0이다.
- 재배포 종료 조건: 기존 Android root v4 E2E PASS + speech-quality public/PWA/API-lock E2E PASS + 전체 deploy 100% PASS.

### PR #268 Android v4 보존 복구 및 운영 100% PASS

- 복구 PR #268 head `0536d648c0e8f7605004a8b9fe8e391ca562e46a`, PR run `33476254034`: 전체 test, Docker, 412×915 speech-quality Chromium PWA E2E PASS. 변경 파일은 workflow, 배포 계약검사, 장애원장 3개뿐이며 미해결 review thread 0건.
- squash/deploy SHA `e3b44701c2d24d16cd326c7f909f545d370b8c84`, push run `33476510828`: `[deploy-production] [speech-quality-lab] [v4-mobile-canary]`를 함께 사용했다. 자체 실행기 `STAR45-VOICEFLOW-01` 중단으로 Docker가 일시 대기했으나 runner service 재기동 후 Docker와 deploy-production이 모두 PASS했다.
- 근본 수정: `VOICEFLOW_V4_MOBILE_ENABLED`가 `[v4-mobile-canary]`뿐 아니라 `[speech-quality-lab]` 배포에서도 1을 유지하도록 하고 `speech-quality-deploy-contract.test.mjs`로 재발 방지 계약을 고정했다.
- 운영 증거: 모든 runtime health PASS, 기존 VoiceFlow UI V3 계약 PASS, `PC_VIDEO_REENTRY_AND_CHAT_PASS`, Android root v4 진입 PASS, register/login PASS, current voice recording/chat/invite/result review PASS, 회의 E2E `19/19 PASS`.
- 품질 PWA 증거: `VOICEFLOW_SPEECH_QUALITY_LAB_BROWSER_E2E_PASS`; 412px viewport에서 root/body `overflow-y:auto`, root 가로 넘침 없음, 문서 높이 2060/viewport 915, 결과표 내부 가로 스크롤 `auto`. 운영 URL `https://voice.star45.net/v4/speech-quality-lab/` 직접 응답과 로그인 보호도 재확인했다.
- 비용·보호: `VOICEFLOW_SPEECH_QUALITY_API_ENABLED=0` 강제 유지, 실제 Provider 호출·음성 업로드·Secret 변경·DB/DNS migration 0건. 실패 600MB local-STT route는 계속 OFF. PC·가입·초대·화상·자료·caption/DeepL·회의정리 보호 계약 유지.
- 최종 판정: SOURCE PASS · CI PASS · DOCKER PASS · DEPLOY PASS · OPERATING HEALTH PASS · ANDROID AUTOMATED E2E PASS · SPEECH QUALITY PWA PASS · OVERALL 100% PASS · 실제 Samsung 마이크/API 품질 DEVICE UNVERIFIED.
- 롤백: 회귀 시 `e3b4470`의 workflow/contract 변경만 되돌리고 speech-quality lab flag를 0으로 내려 새 URL을 격리한다. DB·DNS·Secret·기존 PC/root artifact rollback은 필요 없다.

## 2026-09-01 · 설치형 PWA 기존 음성 시작의 v4 실제 마이크 연결 후보

- **사용자 목표**: 스마트폰에서 별도 테스트 URL이나 별도 앱 없이 설치된 기존 PWA의 `음성 시작` 버튼으로 현재 v4 실제 마이크 경로를 실행.
- **확정 연결 경계**: root PWA의 `#quickAudioStart`가 내부 회의를 생성하지만 기존 fetch 전환 조건은 설치형 PWA를 명시적으로 제외해 classic 녹음방에 남았다. v4 화면은 `entry=browser`일 때 standalone에서도 유지되는 기존 경계를 이미 제공한다.
- **최소 수정**: 설치형 PWA에서 `#quickAudioStart`를 누른 15초 안의 내부 회의 생성 1회만 `/v4/mobile?meeting=...&entry=browser`로 전환한다. Android 일반 브라우저 자동 진입과 PC/일반 브라우저의 기존 quick start는 유지한다.
- **보호 범위**: 메인 UI, 로그인·가입 동의, 초대, 회의정리, caption/번역 API, 마이크/STT 구현, DB·DNS·Secret·Provider 불변. 별도 PWA 설치·새 URL 입력·600MB 모델 재도입 없음.
- **회귀 검사**: 정적 계약에 설치형 PWA trigger/route를 고정하고, Chromium standalone 모사에서 기존 버튼→회의 생성→v4 4제어 화면을 검증한다. 일반 브라우저 quick start는 classic 녹음방 유지 검사를 보존한다.
- **현재 판정**: SOURCE CANDIDATE · FOCUSED/CI/DOCKER/DEPLOY/OPERATING PENDING · Samsung 실제 음성 원문 DEVICE UNVERIFIED.
- **롤백**: `public/meeting-auto-dispatch-v361.js`의 PWA trigger/전환, index cache query, 관련 계약·E2E·배포 가드만 되돌리면 직전 운영으로 복구.

### PR #271 첫 CI의 기존 검사 구간 경계 충돌 수정

- run `33489549436`의 test는 v4/PWA 소스 계약까지 통과한 뒤 기존 `autoE2e` 문자열 구간이 새 standalone 시나리오까지 포함해 `quickAudioStart` 금지 assertion에서 FAIL. 제품 코드 실패가 아니라 검사 구간의 종료 표식 충돌이다.
- 최소 수정: Android 자동진입 전용 구간의 종료점을 새 `installed PWA voice start...` 시나리오 시작으로 이동. 기존 Android 자동진입이 버튼 클릭 없이 실행된다는 금지계약은 그대로 유지한다.
- 현재 판정: 첫 CI FAIL(원인 확정) · SOURCE PASS · 재실행 CI/DOCKER PENDING · DEPLOY/OPERATING/DEVICE PENDING.

### PR #271 두 번째 CI의 동결 root PWA 자산 보호 및 복원

- run `33489761634`: 신규 PWA 연결 계약과 전체 npm test는 해당 지점까지 PASS했으나, `public/index.html` cache query 변경이 frozen v3.5.18 해시 보호에서 FAIL하고 Docker는 차단됐다.
- 원인: network-first JavaScript 갱신에 불필요한 root index query 변경이 기존 설치형 PWA 동결 자산을 건드렸다.
- 최소 복원: `public/index.html`을 운영 기준 `e688058` blob으로 완전 복원하고 배포 probe URL도 기존 v3.6.1로 되돌린다. 연결 구현과 새 standalone E2E는 유지한다.
- 현재 판정: ROOT INDEX RESTORE PASS · SOURCE PASS · 첫/두 번째 CI FAIL(원인 확정/복원 완료) · 세 번째 CI/DOCKER PENDING · DEPLOY/DEVICE PENDING.

### PR #271 설치형 PWA 연동 운영 완료

- **PR/운영 SHA**: PR #271, squash/deploy `86226b181c575568ad2a31ecb6c1af569c432af1`.
- **PR 검증**: run `33490026166`에서 전체 npm test PASS, production Docker image build PASS. 앞선 두 CI 실패는 각각 검사 구간 경계와 frozen root index 보호가 원인이었고 최소 수정·복원 후 재발 없이 통과.
- **운영 검증**: run `33490353957`, deploy job `99800743679` PASS. runtime health, v4 canary, 로그인·가입, 초대, 녹음, 채팅, 결과 흐름과 운영 자산 계약 PASS.
- **브라우저 E2E**: Android 일반 브라우저 자동 v4 진입 PASS, 설치형 standalone PWA의 기존 `#quickAudioStart`→회의 생성→`/v4/mobile?...&entry=browser`→4제어 화면 PASS, 일반 브라우저 quick start의 기존 classic 녹음방 유지 PASS. 전체 `20/20 PASS`.
- **동결 보호**: `public/index.html`은 운영 기준과 동일하며 메인 UI·로그인·초대·회의정리·번역·DB·DNS·Secret·Provider 변경 0건.
- **최종 판정**: SOURCE PASS · CI PASS · DOCKER PASS · DEPLOY PASS · OPERATING PASS · BROWSER E2E PASS · OVERALL 100% PASS.
- **DEVICE**: Samsung PWA에서 실제 마이크 연결→음성 시작→말한 한국어 원문 표시와 번역은 사용자 확인 전 `UNVERIFIED`. 자동 E2E는 실제 Samsung 음성 인식 성공을 대체하지 않는다.
- **복구점**: 연동 회귀 시 PR #271의 `public/meeting-auto-dispatch-v361.js`, 계약·E2E·배포 가드만 되돌린다. 운영 코드 복구 기준은 직전 `e68805870847a011abcb217b00f0a69c4de2d797`.

## 2026-09-01 · v4 4버튼 DEVICE FAIL 후 PC형 모바일 기본경로 복원 후보

- **사용자 증상/기기**: Samsung Chrome/PWA에서 `마이크 연결·마이크 중지·음성 원문 시작·말하기 완료` 4버튼 화면이 열리고, `선택 언어의 기기 내 음성팩을 사용할 수 없습니다. 서버 우회는 하지 않습니다 · 진단 prepare`가 표시되며 실제 발화 원문이 입력되지 않음.
- **기대 결과**: 스마트폰 Chrome/PWA도 PC와 같은 root 화면·`음성 시작` 단일 진입·완료/일시정지·초대·화상·자료·회의정리 기능을 사용하고, 브라우저 인식 실패 시 기존 서버 `/transcribe` 경로를 사용.
- **최초 잘못된 진입 경계**:
  - Android Chrome을 v4로 보내기 시작한 SHA `1c6d9d878b1cc816f3f51fffdfd7922b1634bd60`; 즉시 자동진입 확장 `648ab9d5c507c32368870029b6b83a7dc4f6ddd5`.
  - 설치형 PWA의 기존 `음성 시작`까지 v4로 전환한 최초 SHA `86226b181c575568ad2a31ecb6c1af569c432af1`(PR #271). 자동 E2E는 PASS였으나 이번 Samsung DEVICE는 원문 FAIL.
- **복원 기준**: v4 자동진입 이전 `c3b61c95c75c0cddfa099aee70d02cb1e4e2974a`의 `public/meeting-auto-dispatch-v361.js` blob `6a1016cd0c7e195875e38d8492a825c1dc114ee8`. 현재 파일과 `function sourceRows()` 이후 회의정리·업무배분·초대 로직은 완전히 동일하고, 진입 코드만 다름.
- **음성 기준**: 사용자가 Samsung에서 원문 2줄·각 번역·반복 소리 없음으로 확인한 `d8395a8ad79a72d84bc807dfb4cdaf0626f50562`는 classic root 경로의 마지막 DEVICE 성공 증거이나 당시 실제 STT Provider 소유 증거가 없어 `CONDITIONAL GOLDEN` 유지.
- **서버 연동 보존**: 현재 생성 체인 `scripts/patch-mobile-stt-ownership-v366.mjs`의 단일 `startServerSpeechFallback`→`/transcribe`→`postCaption(text,'server')`를 수정하지 않음. 직전 운영에서 Provider Hub OpenAI credential resolved 및 DeepL 실번역 PASS. 신규 키·Provider·DB·DNS 변경 없음.
- **최소 복원**: 진입 파일 하나를 위 Golden blob으로 복원해 Android/PWA 기본 v4 전환을 모두 제거. v4 실험 화면은 기본경로에서 제거하고 feature flag OFF로 격리. PC root UI·서버 STT·번역·초대·화상·자료·회의정리 코드는 변경하지 않음.
- **회귀검사**: 390×844 Android Chrome 및 standalone PWA에서 root 유지, 4버튼 DOM 부재, 기존 `#quickAudioStart` 클릭 후 `#stopCapture`·`#speechState` 표시를 검증. 운영 배포 전 live STT Provider gate를 필수 실행.
- **현재 판정**: DEVICE FAIL(기존 v4) · ROOT CAUSE PASS · GOLDEN ENTRY PASS · SOURCE CANDIDATE · CI/DOCKER/DEPLOY/OPERATING PENDING · 복원 후 Samsung 원문/번역 DEVICE UNVERIFIED.
- **롤백**: 진입만 되돌릴 경우 후보의 `public/meeting-auto-dispatch-v361.js`, 계약/E2E/배포 가드를 복원. 직전 운영 전체 복구는 `86226b181c575568ad2a31ecb6c1af569c432af1`.

### PR #273 첫 운영 배포의 live 서버 STT Provider 차단

- **병합 SHA/검증**: PR #273 squash `bf4950c25f82dda9e4f9499bb659b5679d56966c`; PR run `33495326919` 전체 npm test·production Docker PASS.
- **운영 run**: `33495559077`, deploy job `99817435257`은 서버/컨테이너 교체 전 12% Provider preflight에서 FAIL. 운영 런타임은 직전 배포 상태를 유지.
- **실응답 분류**: Provider Hub OpenAI credential resolution은 PASS했으나 실제 STT는 `billing_or_quota`; Gemini는 `configuration`; 따라서 `VOICEFLOW_LIVE_STT_PROVIDER_FAIL`. DeepL 베트남어 실번역은 PASS.
- **판정**: 서버 `/transcribe` 배선과 생성 계약은 PASS지만 외부 서버 STT 실응답은 `PROVIDER BILLING/CONFIG BLOCKED`. 코드 회귀로 수정하거나 Secret·결제·Provider를 임의 교체하지 않음.
- **분리 진행**: 사용자가 요청한 PC형 모바일 UI 복원과 v4 4버튼 기본경로 제거는 Provider와 독립적이므로 서버 필수 gate 없이 배포 재시도. 서버 STT는 코드에 연결된 상태를 유지하되 실응답 전까지 FAIL이며 완료로 선언하지 않음.
- **다음 사용자 조치**: OpenAI API 크레딧/한도 복구 또는 Provider Hub에 Gemini STT credential 구성 중 하나가 필요. 설정 후 동일 live STT gate를 재실행해야 PASS 가능.


### PR #274 PC형 모바일 기본경로 운영 복원 완료

- **운영 SHA/실행**: PR #274 squash/deploy `22f63c15afe198f9117b87979eadcaa51d58db82`; GitHub Actions run `33496244064`, deploy job `99819624334` PASS.
- **운영 UI**: `VOICEFLOW_V4_MOBILE_ENABLED=0`. Android Chrome과 설치형 PWA 모두 root PC형 화면을 유지하며 v4의 `마이크 연결·마이크 중지·음성 원문 시작·말하기 완료` 4버튼 기본 진입은 제거됨.
- **자동 작동검증**: Android root PC형 홈→기존 음성 시작→서버 사용 가능 회의방 PASS, standalone PWA 동일 흐름 PASS, 홈 음성 시작 녹음방 진입 PASS. 운영 회의 E2E `20/20 PASS`, 전체 배포 `OVERALL 100% PASS`.
- **번역**: 배포 중 DeepL 한국어→베트남어 실응답 `translated:true` PASS.
- **서버 STT 분리 판정**: 기존 `/transcribe` 배선·fallback·caption 반영 SOURCE/계약 PASS. 그러나 직전 실응답에서 OpenAI `billing_or_quota`, Gemini `configuration`이므로 외부 서버 STT는 계속 `PROVIDER BLOCKED`; 운영 성공으로 선언하지 않음.
- **최종 단계 판정**: SOURCE PASS · CI PASS · DOCKER PASS · DEPLOY PASS · OPERATING UI PASS · BROWSER E2E PASS · TRANSLATION PROVIDER PASS · SERVER STT PROVIDER FAIL/BLOCKED · Samsung 실제 음성→원문→번역 DEVICE UNVERIFIED.
- **사용자 확인**: 기존 설치 PWA를 완전히 종료 후 다시 열어 PC형 root와 단일 `음성 시작`을 확인. 서버 STT 실응답 복구에는 OpenAI API 크레딧/한도 복구 또는 Provider Hub Gemini STT 구성이 필요하며, 설정 후 동일 live STT gate와 Samsung 실제 발화 검증을 재실행.
- **복구점**: PC형 진입 복원은 PR #273의 Golden entry blob `6a1016cd0c7e195875e38d8492a825c1dc114ee8`. UI 회귀 시 진입/계약/E2E만 조사하고 DB·DNS·Secret은 변경하지 않는다. 직전 v4 운영 전체 복구점은 `86226b181c575568ad2a31ecb6c1af569c432af1`.


## 2026-09-01 · OpenAI 없는 기존 whisper.cpp 서버 STT 재활성화 후보

- **사용자 결정**: OpenAI STT를 사용하지 않고 오픈소스 등 다른 방법으로 모바일 음성인식을 다시 시도.
- **기준**: PC형 Android Chrome/PWA UI 운영 PASS SHA `22f63c15afe198f9117b87979eadcaa51d58db82`. UI·번역·초대·화상·자료·회의정리·DB·DNS·Secret은 동결.
- **재사용 자원**: PR #252~#255에서 운영 검증된 고정 `whisper.cpp` 이미지, multilingual `tiny` 모델, Silero v6.2.0 VAD, localhost `4186/inference`, 기존 `/transcribe` 어댑터. 새 PWA·휴대폰 모델 다운로드·유료 STT API를 추가하지 않음.
- **현재 비활성 원인**: PR #274 배포 표식에 `[local-stt-canary]`가 없어 workflow가 `LOCAL_STT_ENABLED=0`으로 재계산. 소스의 local STT 경로와 모델 볼륨은 보존돼 있음.
- **최소 수정**: `LOCAL_STT_ENABLED=1`일 때 local sidecar 실패 후 OpenAI/Gemini로 진행하지 않도록 `LOCAL_STT_EXCLUSIVE=1`을 기본 강제. 로컬 성공·실패 모두 외부 STT 호출 0회 계약을 추가.
- **운영 후보**: 병합 메시지 `[deploy-production] [local-stt-canary]`로 현재 PC형 UI를 그대로 재배포. 서버 음성은 자체 VPS 안에서 처리하고 텍스트만 기존 caption/DeepL 경로에 전달.
- **비용·데이터**: OpenAI/Gemini STT 호출 0건을 목표로 하며 별도 API 비용 0원. 기존 VPS CPU·디스크·네트워크만 사용. 음성 원본은 기존 localhost 요청 범위를 벗어나지 않음.
- **품질 경계**: tiny+VAD는 운영에서 양성 음성·무음·저잡음 PASS 이력이 있으나 Samsung 짧은 한국어 정확도는 DEVICE UNVERIFIED. 고정 문장 결과가 낮으면 이번 배포와 섞지 않고 동일 서버의 multilingual base를 별도 A/B.
- **현재 판정**: ROOT CAUSE PASS · GOLDEN SERVER PATH PASS · SOURCE CANDIDATE · CI/DOCKER/DEPLOY/OPERATING/DEVICE PENDING.
- **롤백**: `LOCAL_STT_ENABLED=0`과 compose profile 제거로 즉시 직전 외부 Provider-blocked 상태로 복귀. UI·DB·DNS·Secret rollback 불필요.


### PR #276/#277 · OpenAI 없는 local-whisper 운영 복구 완료

- **소스/운영 SHA**: PR #276 merge/deploy `a7dd1d749ab4335867d4a707da5de15cdea03b1d`; PR #277 최종 merge/deploy `26b3e34115dd90f24c8578c3f18343498d70bea7`.
- **변경**: `LOCAL_STT_ENABLED=1`이면 `whisper.cpp + multilingual tiny + Silero VAD` localhost만 사용. local sidecar 실패 시 OpenAI/Gemini STT로 진행하지 않고 `STT_all_providers_failed`로 종료. core compose에 `LOCAL_STT_EXCLUSIVE='1'`을 고정하고 배포가 실제 컨테이너 환경값을 검사.
- **검사 이력**: PR #276 run `33499044620` test/Docker PASS. PR #277 첫 run `33499774280`은 제품이 아니라 기존 guard가 이전 compose 문자열을 요구해 test FAIL/Docker SKIP; 예상 문자열 한 줄만 정렬 후 run `33499923183` test/Docker PASS.
- **최종 운영**: run `33500120505`, deploy job `99831854547` PASS. live probe `provider=local-whisper model=tiny text_detected=true`, `VOICEFLOW_LIVE_STT_PROVIDER_PASS`, `LOCAL STT SERVICE PASS`.
- **보호 기능**: Android Chrome root PC형 홈 PASS, installed PWA PC형 홈 PASS, 회의 E2E `20/20 PASS`, DeepL 번역 gate PASS, `OVERALL 100% PASS`. v4 4버튼 canary와 600MB 다운로드 PWA는 계속 OFF.
- **비용/외부 호출 판정**: STT source/contract/runtime은 OpenAI·Gemini fallback 차단 PASS. OpenAI API 크레딧 불필요. 기존 Provider Hub credential 상태 조회와 STT 외 다른 기능 설정은 변경하지 않음.
- **단계 판정**: SOURCE PASS · CI PASS · DOCKER/VAD RUNTIME PASS · DEPLOY PASS · OPERATING LOCAL STT PASS · BROWSER E2E PASS · Samsung 실제 한국어 정확도 DEVICE UNVERIFIED.
- **기기 완료 기준**: Samsung PWA에서 `오늘 회의를 시작합니다.`, `내일 오전 열 시에 다시 만나요.`를 말하고 5~10초 침묵. 원문 2개와 각 베트남어 번역만 남고 유령 문장 0개면 DEVICE PASS. 짧은 한국어 정확도가 낮으면 운영 기본을 즉시 바꾸지 않고 동일 녹음으로 multilingual tiny/base A/B.
- **롤백**: `LOCAL_STT_ENABLED=0` 및 `local-stt` compose profile 제거로 자체 STT만 중단. PC형 UI·DB·DNS·Secret·번역·회의 데이터 rollback 불필요.


## 2026-09-01 — Samsung Chrome 원문 오인식: server tiny 자동 이관 제거, browser 단일 소유 복원 (v3.5.19)

- **사용자 증상**: Samsung 휴대폰 Chrome/PWA에서 음성 입력은 생성되지만 실제 발화와 다른 원문이 표시됨. 사용자는 휴대폰 Chrome 기능으로 하나씩 복구할 것을 요청함.
- **분류**: 기존 기능 복구. PC형 UI·DeepL 번역·가입·회의정리·DB·DNS·Secret은 범위 밖으로 동결.
- **마지막 실제 기기 정상 기준**: `356af4d3b30bb4cbf4377703acad4908907d0e54` / Samsung Chrome Web Speech + DeepL에서 `오늘 회의를 시작하겠습니다` 원문과 베트남어 번역 확인. 단일 표본 DEVICE PASS.
- **변경 직전 SHA**: `0d1e8d23db9c1205d3c58ad1d71e678500605264` (생성물 v3.5.18). v366은 Chrome 인식 시작 전 server shadow recorder를 시작하고, 최종 결과가 1.5초 안에 없으면 Chrome을 abort한 뒤 local Whisper tiny 결과를 게시하도록 강제함.
- **확정 원인**: Android Chrome에서 브라우저 STT와 서버 STT의 소유권이 겹쳤고, `browser-no-result-timeout`이 실제 발화 완료 전에 서버 tiny로 이관할 수 있었음. 화면에는 browser 결과가 아니라 server tiny 결과가 저장될 수 있었음.
- **최소 수정**: PR #279 / 운영 SHA `3f0f9a322a870e85b85c9d43ac7aa558e7643415`.
  - `if(mobileBrowserSpeech)startServerSpeechFallback()` 제거.
  - speech-start의 server segment 연장 제거.
  - 1.5초 browser→server watchdog 및 `r.abort()` 이관 제거.
  - Android Chrome 오류·interim-only 종료는 server 이관 없이 browser retry 유지.
  - 비지원 모바일의 명시적 server fallback과 PC 경로는 유지.
- **회귀 차단**:
  - Samsung Chrome harness에서 `serverStarts=0`, 1500ms timer 0개, 최종 caption origin=`browser`.
  - CI 생성물에서 Chrome shadow start/extend, timeout handoff, abort handoff를 금지.
  - 생성물 v3.5.19 / service worker v345 해시 동결.
- **자동 검증**: PR CI run `33516474758` test PASS, Docker PASS. 운영 도메인에서 `APP_VERSION='3.5.19'`, browser-only ownership marker, `app.js?v=3.5.19`, service worker v345, Health 200 확인. 금지된 shadow/watchdog/abort marker 0개.
- **단계 판정**: SOURCE PASS · CI PASS · DOCKER PASS · DEPLOY PASS(운영 자산 교체 확인) · OPERATING CONTRACT PASS · DEVICE UNVERIFIED.
- **기기 완료 기준**: Samsung Chrome/PWA를 완전히 종료 후 다시 열어 `오늘 회의를 시작하겠습니다`를 한 번 말한다. 화면 원문이 동일하고 번역이 이어지며 서버 전환 오류가 없으면 이 단일 문장 단계 DEVICE PASS. 연속 문장·장시간 회의는 다음 단계에서 별도 검증한다.
- **복구**: 코드 긴급 롤백 기준은 merge 직전 `0d1e8d23db9c1205d3c58ad1d71e678500605264`. 단, 이 롤백은 사용자 증상의 원인이 된 server shadow/watchdog도 복원하므로 v3.5.19 자체 회귀가 확인된 경우에만 사용한다.
- **자동 중단 조건**: 동일 문장에서 실제 Samsung 결과가 다시 다르면 추가 Provider·모델·fallback 패치를 중단하고, 브라우저가 반환한 raw final 텍스트와 선택 언어만 수집해 DEVICE 원인을 분리한다.

## 2026-09-01 — Samsung Chrome 원문 미표시: 단문 종료 확정 복원 (v3.5.20)

- **사용자 DEVICE 결과**: v3.5.19 배포 후 설치 PWA와 직접 Chrome 모두 원문이 표시되지 않았고, 완전 종료·재실행 후에도 동일. 따라서 캐시 가설을 기각하고 v3.5.19 DEVICE FAIL로 판정.
- **실기기 성공 기준 재확인**: Samsung에서 실제 성공했던 SHA `356af4d3b30bb4cbf4377703acad4908907d0e54`의 browser session은 `continuous=false`이며 `onspeechend`에서 `stop()`하여 Chrome에 최종 결과 확정을 요청함.
- **현재 PC형 root와의 최초 차이**: v3.5.19는 `continuous=true`이고 발화 종료 시각만 기록했으며, caption 저장은 `isFinal` 결과만 허용. Android Chrome이 final을 내지 않으면 원문 게시가 영구적으로 발생하지 않는 구조.
- **최소 수정**: PR #281 / 운영 SHA `1b54bc73b23d04f49e2a82b45626d8e0bed984c6`.
  - Android Chrome만 `r.continuous=false`.
  - Android Chrome만 `onspeechend→r.stop()`으로 final 확정 요청.
  - PC는 `continuous=true` 유지.
  - Android Chrome server shadow/watchdog/abort 이관 금지 유지.
  - 비지원 모바일의 기존 server fallback, DeepL, UI, 초대, 화상, 회의정리, DB는 변경하지 않음.
- **자동 검증**: PR run `33521922321` test PASS · Docker PASS. Samsung harness `ANDROID_CHROME_ONE_SHOT_FINAL_PASS`; PC continuous 불변, iPhone server fallback 불변.
- **운영 검증**: APP_VERSION 3.5.20, index `app.js?v=3.5.20`, service worker v346, Health 200. app/index/sw SHA-256가 v3.5.20 frozen baseline과 일치. Android Chrome server shadow/watchdog marker 0개.
- **단계 판정**: SOURCE PASS · CI PASS · DOCKER PASS · DEPLOY PASS · OPERATING CONTRACT PASS · DEVICE UNVERIFIED.
- **기기 완료 기준**: PWA를 완전히 종료 후 다시 열어 `오늘 회의를 시작하겠습니다`를 한 번 말한다. 같은 원문과 번역이 표시되면 DEVICE PASS. 실패 시 신규 방식·Provider를 추가하지 않고 Chrome recognition event(raw result/isFinal/error) 증거만 수집한다.
- **롤백**: v3.5.20 이상 시 운영 코드 복구점은 직전 v3.5.19 SHA `3f0f9a322a870e85b85c9d43ac7aa558e7643415`. 단, v3.5.19는 사용자 DEVICE FAIL이므로 운영 안전성 문제가 아닌 기능 회귀 조사에만 사용.



## 2026-09-02 · PR #285 · Android 녹음→STT 격리 검증

- 태그: STT, 녹음, Android, PWA, 회귀, 격리
- 사용자 증상: Samsung Chrome/PWA에서 녹음 시간과 준비 신호는 표시되지만 원문 텍스트가 간헐적으로 생성되지 않음. 됐다가 안 됐다가 반복됨.
- 확정 경계: 마이크 입력과 녹음은 동작하며, 브라우저 SpeechRecognition의 원문 결과 생성 단계가 간헐 실패하는 것으로 관측. 실제 raw event는 아직 수집하지 않아 브라우저 내부 원인은 UNVERIFIED.
- 보호 기준: PR #281 / 운영 SHA `1b54bc73b23d04f49e2a82b45626d8e0bed984c6`의 Android `continuous=false`와 `onspeechend→stop()`; PR #284 / 운영 SHA `b5824eaaeaecb1b2e1af3e315eb961a2f59c10ea`의 준비 신호. PC·번역·초대·화상·회의정리·DB·DNS·Secret 변경 금지.
- 첫 시험 실패: run `33634560843`은 제품 실패가 아니라 생성형 `public/app.js` 작성 전에 focused test를 실행하여 `generated startSpeech function missing`으로 실패. 시험 순서만 수정했으며 같은 순서를 반복하지 않음.
- 격리 시험 성공: hosted runner run `33634791389`, job `100262828543`. production frontend artifact 생성 PASS, mobile browser/server STT ownership contracts PASS, local STT adapter PASS, 실제 `whisper.cpp + Silero VAD` runtime PASS.
- 운영 영향: 시험 전용 Draft PR이며 병합·운영 배포 없음. 기존 운영 코드·컨테이너·데이터 변경 없음.
- 단계 판정: SOURCE TEST-ONLY · ISOLATED CI PASS · LOCAL STT RUNTIME PASS · DEPLOY N/A · OPERATING UNCHANGED · Samsung 한국어 DEVICE UNVERIFIED.
- 다음 게이트: 동일 녹음으로 browser 결과와 local Whisper tiny/base/small을 격리 비교하고, 정확도·지연·VPS CPU/RAM을 측정한 뒤 사용자 승인 전까지 자동 fallback을 기본 OFF로 유지.
- 롤백: PR #285 브랜치와 Draft PR을 사용하지 않으면 운영 영향 없음. 운영 Golden은 PR #284 SHA를 유지.


## 2026-09-02 — Android Chrome browser-final → VPS STT handoff v3.5.22 (DRAFT / NOT DEPLOYED)

- 증상: 삼성 Android Chrome/PWA에서 녹음은 진행되지만 브라우저 SpeechRecognition이 final 원문을 반환하지 않는 간헐 실패.
- 근본 경계: v3.5.21은 Android Chrome의 서버 STT 경로를 완전히 차단하므로, final 미수신 시 원문 생성 경로가 없었음.
- 최소 변경: 동일 MediaStream의 음성만 임시 버퍼링. 브라우저 final 성공 시 버퍼 폐기. final 없이 종료되거나 인식 오류 시에만 기존 VPS `/transcribe` 경로로 단독 인계.
- 보호 범위: UI/DB/API 스키마/다른 프로젝트 변경 없음. 브라우저와 서버의 동시 텍스트 확정 금지.
- 첫 검증 실패: 기존 browser-only 계약 테스트가 임시 버퍼 시작을 회귀로 판정. 제품 실패가 아니라 이전 정책과 새 정책의 계약 불일치.
- 재검증: GitHub Actions `Android STT Fallback Isolated Test` run `33636579574` SUCCESS.
- 통과 범위: 생성 프런트엔드 문법, Android browser→VPS handoff 계약, browser final 시 버퍼 폐기, server ownership, local STT adapter, whisper.cpp/Silero VAD runtime.
- 운영 상태: Draft PR #285 브랜치만 변경. main 병합 및 운영 배포 없음.
- DEVICE: Samsung 실제 기기 E2E UNVERIFIED. 운영 반영 후 실제 발화→원문→번역 확인 전 PASS 선언 금지.
- 롤백: v3.5.22 import 및 patch/test 파일 제거 시 v3.5.21 browser-only 기준으로 복귀.
