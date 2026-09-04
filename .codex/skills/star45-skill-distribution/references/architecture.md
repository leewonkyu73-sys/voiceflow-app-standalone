# STAR45 스킬 확장 아키텍처

## 권장 저장소

```text
star45-codex-skills/
├── .codex-plugin/
│   └── plugin.json
├── registry/
│   └── skills.json
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md
│       ├── agents/openai.yaml
│       └── references/
├── adapters/
│   ├── hermes/
│   └── obsidian/
└── tests/
```

불필요한 빈 폴더는 만들지 않는다. Adapter나 테스트가 실제로 생길 때만 추가한다.

## Registry 계약

각 항목은 최소한 다음 필드를 가진다.

| 필드 | 의미 |
| --- | --- |
| `name` | 스킬 폴더와 frontmatter의 동일 이름 |
| `version` | 호환성 판단용 SemVer |
| `path` | 저장소 내 스킬 경로 |
| `commit_sha` | 운영 소비자가 고정할 승인 커밋 |
| `sha256` | 배포 파일 무결성 확인값 |
| `schema_version` | Registry/Adapter 계약 버전 |
| `products` | 허용 소비자: Codex, Hermes 등 |
| `permissions` | 필요한 읽기·쓰기·외부 실행 범위 |
| `secret_refs` | 값이 아닌 환경변수 또는 Hub 참조 이름 |

`commit_sha`와 `sha256`은 릴리스 생성 단계에서 확정한다. 개발 중 임시값이나 Secret 예시를 운영 Registry에 넣지 않는다.

## Hermes Adapter

Hermes에는 스킬 전체를 임의 해석해 수정할 권한을 주지 않는다. 작업 요청은 다음 계약으로 전달한다.

- `task_id`, `skill_name`, `skill_version`, `commit_sha`
- 입력 artifact 참조와 허가 범위
- 중단 조건, 최대 재시도, 시간·비용 한도
- 결과 상태, 증거 링크, 변경 SHA, 롤백 정보

Webhook이나 폴링은 승인된 릴리스만 감지한다. 실패 시 마지막 정상 pin을 유지하고 같은 작업을 무한 재시도하지 않는다.

## Obsidian Adapter

Obsidian에는 다음만 기록한다.

- 스킬 설명과 승인 버전 링크
- 실행 결과, 판정, 변경 SHA, 운영 증거
- 장애원장, 교훈, 재발 방지와 롤백 지점

SKILL 원본과 실행 스크립트를 Obsidian에서 독립 수정하지 않는다. Obsidian 문서에서 제안된 변경은 GitHub PR로 되돌려 검증·승인한다.

## 승격 흐름

1. 작업 브랜치에서 최소 변경
2. 스킬·플러그인·Secret 검사
3. PR 검토와 후보 패키지 생성
4. 격리된 Codex/Hermes 소비자에서 pin 검증
5. 승인 태그 생성
6. 운영 소비자 pin 갱신
7. 실제 로드 SHA와 실행 결과 확인

롤백은 6단계 pin을 이전 승인 태그로 되돌리고 7단계를 다시 확인한다. Git 이력을 삭제하거나 운영 장애 중 새 스킬을 즉흥 생성하지 않는다.


## 릴리스 파일 계약

원본 저장소의 `config/skill-release.json`은 릴리스 태그, 포함 스킬, 승인된 소비자 저장소·branch·install root만 선언한다. 실제 승인 SHA와 파일별 SHA-256, 전체 스킬 digest는 CI가 `scripts/create-skill-release.mjs`로 생성한 artifact에 기록한다.

- 태그 형식: `skills-v<major>.<minor>.<patch>`
- 태그 생성 조건: VoiceFlow CI 전체 성공과 명시적 `[release-star45-skills]` 표식
- 최초 대상: Deployment Center와 Hermes의 기존 `skills/` root
- 동기화 단위: 스킬 폴더 전체와 소비자 pin
- 멱등성: 같은 태그가 같은 SHA를 가리키면 재사용, 다른 SHA를 가리키면 즉시 실패
- 확장: 새 프로젝트는 실제 스킬 root와 기본 branch 확인 후 매니페스트 PR로 추가
