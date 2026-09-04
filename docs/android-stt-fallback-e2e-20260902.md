# Android STT 간헐 실패 격리 검증

- 작성일: 2026-09-02
- 운영 변경: 없음
- 목적: 기존 격리형 local-STT 브라우저 E2E 실행
- 현상: Samsung Chrome/PWA에서 녹음은 진행되지만 SpeechRecognition 원문 결과가 간헐적으로 오지 않음
- 보호 기준: PR #281(Android 단문 인식), PR #284(신호등) 유지
- 금지: DB, DNS, Provider Secret, 운영 배포 변경

이 PR은 테스트 조건 `[browser-e2e]`만 활성화하며 운영에 병합하지 않는다.
