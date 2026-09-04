# 회귀 방지 근거와 VoiceFlow 실행 기준

## 공개 근거

- Google SRE의 Canary Release 지침: 작고 독립적인 릴리스는 문제 시 복구 비용과 범위를 줄인다. VoiceFlow는 한 PR 한 원인, 작은 전환 단위를 사용한다.
  - https://sre.google/workbook/canarying-releases/
- Google SRE의 설정 변경 지침: 전면 동시 적용을 피하고 점진 배포와 신속한 롤백 능력을 유지한다.
  - https://sre.google/workbook/configuration-design/
- Martin Fowler의 Feature Toggles: 배포와 기능 노출을 분리해 새 기능을 안전하게 검증한다. VoiceFlow 신규 부가기능은 기본 OFF이며 관리자가 허용한다.
  - https://martinfowler.com/articles/feature-toggles.html
- AWS Branch by Abstraction: 기존과 새 구현을 추상화 뒤에 공존시키고 단계적으로 전환한다. 깊게 결합된 음성·번역 교체에 적용한다.
  - https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-decomposing-monoliths/branch-by-abstraction.html
- AWS Strangler Fig: 기존 정상 경로를 유지한 채 기능을 점진적으로 교체하고 각 단계의 복구 경로를 둔다.
  - https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/strangler-fig.html
- GitHub Required Status Checks: 최신 커밋의 필수 검사가 성공해야 병합한다. 정적 문자열 검사만으로 실제 DEVICE 성공을 대신하지 않는다.
  - https://docs.github.com/en/pull-requests/reference/status-checks

## 영향표 최소 필드

| 필드 | 필수 내용 |
|---|---|
| 기준 | 마지막 실제 정상 SHA와 검증 기기 |
| 변경 | 직접 수정 파일·함수·상태 |
| 생성 | 빌드/패치 스크립트와 생성 산출물 |
| 소비자 | DOM, API, 서비스, 배포 검사 |
| 보호 기능 | STT, 번역, 화상, 채팅, 스크롤, 권한 |
| 격리 | 플래그, 어댑터, 별도 컨테이너/DOM |
| 관측 | 성공률, 지연, 재렌더, 권한 요청 |
| 복구 | 트래픽 전환 또는 정확한 파일 복원 |
| 운영 일치 | Golden SHA, 후보 SHA, 배포 SHA, 실제 응답 자산 버전 |
| 공유 자원 | 마이크, 화면 오디오, MediaRecorder, state.media, render, caption/translation API의 단일 소유자 |
| 비용 관측 | 요청/토큰/오디오 시간/예상비용/확정비용/오류 분류와 데이터 출처 |

## 병합 차단 조건

- 실제 정상 기준이 불명확함
- 핵심 경로와 부가기능이 같은 마이크/렌더 상태를 소유함
- Provider 미구성과 장애가 동일 메시지로 처리됨
- 테스트가 코드 표식만 확인하고 사용자 결과를 확인하지 않음
- 후보가 기준보다 느리거나 기존 기능 하나라도 실패함
- 운영 자산과 실제 기기 결과가 구분 기록되지 않음
- 마이크·MediaRecorder·`state.media`·전체 렌더 중 하나라도 두 기능이 동시에 소유함
- Provider quota/billing 실패를 코드 오류로 분류하거나 반대로 코드 회귀를 결제 문제로 덮음
