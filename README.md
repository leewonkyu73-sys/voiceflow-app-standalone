# Global VoiceFlow Smart Workspace

Voice-first 글로벌 B2B AI 업무·회의·미팅 플랫폼입니다.

## UX 원칙
- 첫 화면은 **업무 / 회의 / 미팅** 3개 핵심 기능만 노출합니다.
- 회의 기본은 **녹음 + 텍스트**이며 카메라는 자동 시작하지 않습니다.
- 화상은 요청 → 상대방 수락/거절 후 선택적으로 추가합니다.
- 회의 화면은 **실시간 음성 파형 / REC 상태 / 원문 / 상대방 언어 번역 / Translation Assurance 점수**를 중심으로 구성합니다.
- 관리자·연동·국가별 설정·ERP·지식연동은 메인에서 숨기고 Control Center에서 관리합니다.

## v5.0 Master Plan 기능 체크

### 접속·회의
- [x] PWA First
- [x] NFC/URL Quick Join (`?session_id=`)
- [x] 녹음 중심 회의
- [x] 실시간 음성 입력 파형/레벨 표시
- [x] 실제 MediaRecorder 데이터 생성 상태 확인
- [x] 선택형 화상 요청/수락/거절 signaling
- [ ] 완전한 WebRTC 영상/이미지 MediaStream 송수신
- [ ] BLE / Wi-Fi Direct 오프라인 보조 세션
- [ ] Native 전화수신 interruption 보호 및 3초 버퍼 병합

### 다국어·검정
- [x] 첫 실행 한국어 / 베트남어 / 영어 / 중국어 UI
- [x] 발화 텍스트 언어 자동 감지
- [x] 원문 + 상대방 언어 번역 병기
- [x] Translation Assurance 점수/신호등
- [x] 숫자 보존 기본 검정
- [ ] 실제 OpenAI / Gemini / Google / Azure / DeepL Provider 연결
- [ ] 문맥·전문용어·계약용어 실데이터 A/B 자동평가

### AI 보고·업무
- [x] 자연어 업무 등록
- [x] 담당자/마감일 구조화
- [x] 회의 Action Item 기반 구조
- [ ] 회의/미팅/출장/현장 4대 보고서 완성 파이프라인
- [ ] 사진 OCR/Vision 멀티모달 분석
- [ ] 2개 언어 병기 인포그래픽 카드 렌더링

### ERP Operations
- [ ] 회계: 영수증 OCR → 지출결의
- [ ] 재고: 음성/사진 → 입출고 반영
- [ ] HR: 출장 승인 → 근태 반영
- [ ] Calendar: Action Item → Google/Outlook 등록

### Knowledge & Sharing
- [ ] Obsidian Vault 자동 적재
- [ ] Google Drive / Sheets 동기화
- [ ] 보안 Short URL 24h/7d + 암호
- [ ] Kakao / Zalo / WeChat / Line / Teams Connector

### 조직·글로벌·보안
- [x] 회원가입/로그인/계정삭제
- [x] 이용약관/개인정보 필수 동의 + 마케팅 선택 동의
- [x] 관리자 회원 활성/정지
- [x] Provider 설정/품질진단 Control Center
- [ ] Tenant → Org → Department → Member 실제 데이터 격리 고도화
- [ ] Locale Plugin YAML: KR/VN/CN/US/JP + 신규 국가 동적 확장
- [ ] 국가별 Compliance Rule Engine
- [ ] Capacitor iOS/Android Native 패키징

## 현재 운영
- GitHub Actions: npm test + Docker build
- Docker port: `4173`
- Health: `GET /api/health`
- Production: `https://voice.star45.net`

## 개발 원칙
API-First · Connector-First · Event-Driven · Multi-Tenant · Agent-Ready · Voice-First
