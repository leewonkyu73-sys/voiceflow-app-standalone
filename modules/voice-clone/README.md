# Shared Voice Clone Module

STAR45·COREON 공통 음성복제·합성 모듈입니다. VoiceFlow, SNS 자동화, 교육콘텐츠 등 모든 앱은 음성 원본을 복사하지 않고 `voice_profile_id`로 참조합니다.

## 책임

- Voice profile 등록, 동의, 품질검사, 승인, 비활성화
- 조직·사용자·앱·목적별 사용 권한 확인
- 언어·GPU·상업용 여부에 따른 Provider 자동선택
- 생성 작업과 결과 자산의 감사 추적
- SNS 콘텐츠의 대본→음성 작업 계약
- 노이즈 제거와 음량 정규화 기본 처리

## 데이터 소유

- 원본 녹음과 동의 증거: 중앙 비공개 Asset Storage
- 프로필 메타데이터: Voice Profile Registry
- Provider 키: Integration Hub/Vault, 이 모듈에는 `integration_id`만 저장
- 생성 음원: 콘텐츠/회의 앱의 결과 자산 폴더
- 모든 레코드: `organization_id`, `actor_id`, `voice_profile_id` 필수

## Provider 자동선택

1. 한국어 음성복제 + GPU: `cosyvoice_3`
2. 한국어 음성복제 + CPU: `openvoice_v2`
3. 베트남어 등 일반 TTS: `supertonic_3`
4. 지원 언어·환경 불일치: 승인된 `external_tts`
5. `f5_tts_official`: 공식 가중치가 CC-BY-NC이므로 상업 콘텐츠 자동 차단

Provider Registry는 라이선스, 공식 언어, GPU 필요 여부, 상업 이용 가능성을 함께 저장합니다. 실제 모델 키와 엔드포인트는 Integration Hub가 소유합니다.

## SNS 자동화 연결

```js
const request=createSnsVoiceRequest({
  voice_profile_id:'voice_...',
  organization_id:'org_...',
  content_id:'content_...',
  script:'오늘의 메뉴를 소개합니다.',
  language:'ko-KR',
  voice_mode:'clone',
  format:'wav',
  emotion:'cheerful'
});
const job=createVoiceRenderJob(profile,request,currentActor,{gpu_available:true});
```

SNS 콘텐츠 파이프라인:

`대본 확정 → 음성 프로필 선택 → 권한·동의 검사 → Provider 자동선택 → 음성 생성 → 노이즈 제거·-16 LUFS 정규화 → 영상 합성 → 미리보기 승인 → 배포`

## API 계약

- `POST /api/v1/voice-profiles`: 프로필 등록
- `GET /api/v1/voice-profiles?organization_id=`: 사용 가능한 프로필 조회
- `POST /api/v1/voice-profiles/:id/quality-check`: 품질검사
- `POST /api/v1/voice-profiles/:id/approve`: 관리자 승인
- `POST /api/v1/voice-jobs`: 공통 음성 생성
- `GET /api/v1/voice-jobs/:id`: 상태와 결과 자산 조회
- `POST /api/v1/sns/content/:content_id/voice`: SNS 어댑터

## 안전 규칙

- 본인 또는 명시적 동의를 받은 목소리만 등록
- 용도별 동의 범위와 만료일 검사
- 상업 이용이 금지된 모델은 상업 콘텐츠에서 자동 차단
- 일반 사용자는 자기 프로필, 조직관리자는 조직 범위, 최고관리자는 전체 정책 관리
- 외부 공개 음원에는 AI 생성 음성 표시
- 삭제는 즉시 물리 삭제 대신 비활성화→보존기간 만료→폐기 순서
