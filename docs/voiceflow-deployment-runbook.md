# VoiceFlow 배포 Runbook

## 목적
검증된 VoiceFlow 커밋을 기존 STAR45 배포센터와 VPS Docker Compose 방식으로 안전하게 운영 반영한다. Vercel은 사용하지 않는다.

## 고정 배포 경로
- 저장소: `leewonkyu73-sys/voiceflow-smart-workspace`
- 개발 PR: 기능 브랜치 → `main`
- 운영 구성: `deploy/docker-compose.v23.yml`
- 운영 URL: `https://voice.star45.net`
- 운영 데이터: `/opt/star45/voiceflow-data`
- 런타임 프런트: `/opt/star45/voiceflow-runtime-public`

## 배포 전 단일 게이트
1. VoiceFlow CI의 `test`, `docker`, `browser-e2e`가 모두 성공인지 확인한다.
2. Meeting Collaboration 워크플로가 성공인지 확인한다.
3. 승인된 UI 계약을 확인한다.
   - VoiceFlow v3 CSS
   - 녹음 일시정지/계속
   - 채팅 내 초대
   - 채팅 하단 4개 메뉴
   - AI 업무 자연어 등록
   - 회의 종료 후 결과 검토
4. 운영 DB, DNS, Secret, Provider 설정 변경이 없는지 확인한다.
5. PR HEAD SHA와 CI가 검사한 SHA가 같은지 확인한다.

## 표준 배포
1. 통과한 PR을 `main`에 병합한다.
2. STAR45 배포센터에서 VoiceFlow 프로젝트의 최신 `main` 커밋을 선택한다.
3. 기존 VPS/Docker Compose 배포 방식을 실행한다.
4. 새 컨테이너가 정상 상태인지 확인한다.
5. `deploy/qa-v23.sh`를 실행한다.
6. 운영 URL에서 모바일 핵심 흐름을 확인한다.

## 운영 확인
- `/api/health` 응답 `ok:true`
- 홈 화면 로드
- 스마트폰 마이크 권한 요청
- 녹음 시작 → 일시정지 → 계속 → 종료
- 채팅 입력과 초대 버튼
- AI 업무 텍스트/음성 입력 → 해석 → 확인 저장
- 회의 결과 검토 화면
- 재접속 후 저장 결과 확인

## 롤백
1. 배포센터에서 직전 정상 커밋/이미지를 선택한다.
2. 동일 Compose 구성으로 재배포한다.
3. `deploy/qa-v23.sh`와 운영 `/api/health`를 다시 확인한다.
4. 운영 데이터 볼륨은 삭제하거나 초기화하지 않는다.

## 금지 사항
- CI 실패 커밋 배포 금지
- DNS 변경 금지
- 운영 Secret 교체 금지
- 운영 데이터 볼륨 삭제 금지
- Vercel 배포 금지

## 테스트 유지 규칙
- 화면 문구보다 안정적인 컨트롤 ID와 API 결과를 우선 검증한다.
- 보호된 관리자 화면은 Gateway 리다이렉트와 Core 정적 화면을 분리해 검사한다.
- HTTP E2E에서 `Secure` 세션 쿠키는 테스트 컨텍스트에만 주입하며 운영 보안 설정은 변경하지 않는다.
- UI 버전 변경 시 QA와 브라우저 E2E 계약을 같은 커밋에서 함께 갱신한다.
