# STAR45 스킬 배포 바로 연결

아래 절차는 VoiceFlow 운영 서버의 기존 Private GitHub checkout과 Hermes·Obsidian connector를 사용한다. Secret을 입력하거나 출력하지 않는다.

## 1. 바로가기

- GitHub 원본: <https://github.com/leewonkyu73-sys/voiceflow-smart-workspace>
- 공통 배포 지침: <https://github.com/leewonkyu73-sys/voiceflow-smart-workspace/blob/main/.codex/skills/star45-skill-distribution/SKILL.md>
- Hermes connector: <https://github.com/leewonkyu73-sys/voiceflow-smart-workspace/blob/main/services/hermes-obsidian-discord-service.mjs>
- Hermes Worker 원본: <https://github.com/leewonkyu73-sys/star45-hermes-work/blob/master/automation/execution-plane/skill_distribution_worker.py>
- Hermes Worker 배포 상태: <https://github.com/leewonkyu73-sys/star45-hermes-work/actions/workflows/device-workers-deploy.yml>
- GitHub Actions: <https://github.com/leewonkyu73-sys/voiceflow-smart-workspace/actions>
- Provider Hub: <https://deploy.star45.net/provider-hub>
- VoiceFlow 운영: <https://voice.star45.net>

## 2. 서버에서 복사·실행

운영 서버 터미널에서 다음 두 줄만 실행한다.

```sh
cd /opt/star45/voiceflow-smart-workspace
sh deploy/skill-distribution-control.sh enable
```

스크립트는 작업 폴더가 깨끗한지 확인하고 `origin/main`을 fast-forward로만 반영한다. 승인 SHA와 두 스킬의 SHA-256을 Registry에 기록하고 관련 `.env` 항목만 갱신한 뒤 connector만 다시 만든다. Docker 이미지는 운영 checkout을 더럽히지 않는 임시 detached worktree에서 PR CI와 동일하게 `patch-admin-drive-v262.mjs`로 프런트 자산을 생성하고 UI 계약검사를 통과한 경우에만 교체한다. Connector 재생성 직후에는 포트 기동 경쟁을 실패로 오판하지 않도록 기본 30회·2초 간격으로 Health를 재확인하며, 제한 안에 `enabled=true`와 `configured=true`가 함께 확인된 경우에만 성공한다.

기본 승인 스킬:

- `voiceflow-change-ledger`
- `star45-skill-distribution`

다른 스킬을 승인하려면 실행 전에 값만 추가한다.

```sh
export SKILL_DISTRIBUTION_SKILLS=voiceflow-change-ledger,star45-skill-distribution,추가-스킬명
sh deploy/skill-distribution-control.sh enable
```

## 3. 상태 확인

```sh
cd /opt/star45/voiceflow-smart-workspace
sh deploy/skill-distribution-control.sh status
```

정상 기준:

```json
{
  "enabled": true,
  "configured": true
}
```

## 4. Codex에 바로 복사할 지시문

```text
현재 저장소의 $star45-skill-distribution을 사용한다. main의 승인 SHA에 고정된 voiceflow-change-ledger를 읽고, Hermes 작업에는 승인 SHA와 Registry 체크섬이 검증된 snapshot만 첨부한다. 실행 결과는 Obsidian 장애원장에 판정·증거·롤백 SHA만 기록하고 Secret은 기록하지 않는다.
```

## 5. 즉시 중단·복구

```sh
cd /opt/star45/voiceflow-smart-workspace
sh deploy/skill-distribution-control.sh disable
```

이 명령은 Registry나 기존 Hermes·Obsidian 자료를 삭제하지 않고 기능만 OFF로 전환한다.

## 6. Hermes·Obsidian 운영 E2E

승인 스킬이 실제 Hermes 파일 큐에 기록되고 Obsidian 노트가 생성·검색되는지 확인할 때만 실행한다.

```sh
cd /opt/star45/voiceflow-smart-workspace
sh deploy/skill-distribution-e2e.sh
```

이 검사는 기존 활성 관리자 세션을 재사용하며 인증값을 출력하지 않는다. 고유한 Hermes 검증 작업을 만든 뒤 최대 60초 동안 `pending → processing → completed`를 기다린다. Worker가 생성한 `results/<job_id>.result.json`, 원본 archive, `System-Verification/Hermes Result <job_id>.md`를 모두 확인하고 같은 marker로 Obsidian 검색까지 성공해야 PASS다. Worker는 `skill-distribution-e2e`만 허용하며 지시문·셸·Provider를 실행하지 않는다. 체크섬 불일치·미지원 작업은 fail-closed 처리한다.

## 판정 기준

- 명령·Registry 생성·connector 상태 성공: `SOURCE/CONSUMER_SYNC PASS`
- Hermes 실제 작업 파일 생성 전: `HERMES OPERATING UNVERIFIED`
- Obsidian 결과 저장 전: `OBSIDIAN OPERATING UNVERIFIED`
- Hermes 큐 파일·API 재조회 성공: `HERMES QUEUE PASS`
- Obsidian 파일·API 검색 성공: `OBSIDIAN OPERATING PASS`
- Worker 결과와 상태 전이·archive·Obsidian 결과 노트 성공: `HERMES PROCESSING PASS`
- 60초 내 완료 없음, 체크섬 불일치, 미지원 작업: `HERMES PROCESSING FAIL`
- 미승인 SHA, 체크섬 불일치, dirty worktree, non-fast-forward: 즉시 `FAIL` 후 중단


## 7. 승인 릴리스와 바로 복사

- 릴리스 대상: <https://github.com/leewonkyu73-sys/voiceflow-smart-workspace/blob/main/config/skill-release.json>
- 릴리스 워크플로: <https://github.com/leewonkyu73-sys/voiceflow-smart-workspace/actions/workflows/skill-release.yml>
- 릴리스 태그: <https://github.com/leewonkyu73-sys/voiceflow-smart-workspace/releases/tag/skills-v1.0.0>
- Deployment Center 소비본: <https://github.com/leewonkyu73-sys/star45-deployment-center/tree/main/skills/star45-skill-distribution>
- Hermes 소비본: <https://github.com/leewonkyu73-sys/star45-hermes-work/tree/master/skills/star45-skill-distribution>

`skills-v1.0.0`은 전체 VoiceFlow CI 성공 SHA에서만 생성된다. 두 소비자는 해당 태그의 `star45-skill-distribution` 폴더 전체와 파일별 SHA-256이 일치할 때만 승인된다. 동일 태그 재배포는 변경 없이 끝나며, 체크섬 불일치나 기존 태그의 SHA 변경 시 복사를 중단한다.

새 소비자를 연결할 때는 그 저장소에 이미 쓰는 `skills/` 또는 `.agents/skills/` root가 있는지 먼저 확인하고 `config/skill-release.json`에 PR로 등록한다. 등록되지 않은 저장소, Secret, Provider 설정, 운영 DB는 자동 변경하지 않는다.
