# STAR45 PC GPU Voice Worker

VPS에 GPU가 없어도 설치된 Windows PC의 NVIDIA GPU로 고품질 음성을 생성합니다. PC는 외부 요청을 받지 않고 HTTPS로 VPS 작업을 가져가는 발신형 워커입니다.

## 전체 흐름

`휴대폰/PWA 녹음 또는 대본 → VPS 작업 대기열 → Windows PC GPU → 결과 음원 VPS 업로드 → 휴대폰 미리듣기·승인 → SNS/자료 저장`

휴대폰은 녹음, 대본 수정, 작업 요청, 미리듣기와 승인만 담당합니다. 실제 CosyVoice 추론은 PC GPU가 담당하므로 휴대폰 성능이 최종 합성 품질을 제한하지 않습니다.

## 보안

- 공유기 포트포워딩 불필요
- PC 공인 IP 노출 없음
- 일반 앱 토큰과 GPU 워커 토큰 분리
- Windows DPAPI 기반 사용자별 토큰 암호화
- 작업 임대시간 만료 시 자동 재대기
- 실패 3회 후 자동 중단
- 결과 최대 100MB
- 본인 또는 동의받은 음성 프로필만 처리

## Windows 설치

필요 항목:

- Windows 10/11
- NVIDIA GPU와 최신 드라이버
- Node.js 20 이상
- Python 및 CosyVoice 실행환경
- `--job <json> --output <wav>` 계약을 지원하는 CosyVoice 렌더 어댑터

PowerShell에서 `workers` 폴더로 이동한 후:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-voice-gpu-worker.ps1
```

설치 과정에서 입력:

1. CosyVoice 렌더 어댑터 Python 파일 경로
2. Integration Hub가 발급한 Voice Worker 연결 토큰

정상 결과:

- NVIDIA GPU 이름 표시
- Windows 작업 스케줄러에 `STAR45 Voice GPU Worker` 등록
- 로그인할 때 자동 실행

즉시 실행:

```powershell
.\start-voice-gpu-worker.ps1
```

## 렌더 어댑터 계약

워커는 다음 명령을 호출합니다.

```text
python renderer.py --job job.json --output output.wav
```

`job.json`에는 대본, 언어, Provider, 감정, 속도, 음량, 음성 프로필 참조 ID가 들어갑니다. 어댑터는 결과 WAV만 지정된 경로에 저장해야 합니다. 원본 음성 자산은 추후 Asset Storage의 짧은 만료 URL로 전달합니다.

## 모바일 고품질 조건

- 조용한 공간에서 입과 휴대폰 간격 15~20cm
- 최소 10~30초의 깨끗한 기준 음성
- 자동 소음억제가 원음을 과도하게 자르지 않는지 확인
- 결과는 이어폰으로 미리듣기 후 승인
- SNS 공개 전 AI 생성 음성 표시 확인

## 아직 필요한 운영 연결

- VPS 음성 서비스 배포 및 HTTPS 라우팅
- Integration Hub에서 별도 워커 토큰 발급
- Windows PC CosyVoice 모델과 렌더 어댑터 설치
- 모바일 업로드용 Asset Storage 만료 URL 연결
- 실제 한국어 음성 E2E 품질검사
