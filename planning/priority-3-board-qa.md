# Priority 3 — Board / Notice / Library Operational QA

## Goal
공지사항·자료실·일반 게시판을 실제 사내 공용 기능으로 사용한다.

## Implemented
- `/board.html`
- 탭: notice / library / general
- 검색
- 작성 / 수정 / 삭제
- 상단 고정(pinned)
- 공개범위 메타데이터
- 태그
- 첨부 메타데이터(파일명/URL)
- 현재 로그인 사용자 정보를 author 메타데이터로 사용
- Board API CRUD service: `services/board-service.mjs`
- start command: `npm run start:board`

## API
- `GET /api/v1/board/posts?type=notice`
- `POST /api/v1/board/posts`
- `PATCH /api/v1/board/posts/:id`
- `DELETE /api/v1/board/posts/:id`

## Important limitation before production
현재 Board Service는 별도 포트 4175 서비스다. `voice.star45.net/api/v1/board/*`가 4175로 라우팅되기 전까지 `/board.html`에서 운영 API를 사용할 수 없다.

또한 현재 Board Service 자체에는 VoiceFlow 세션 기반 write permission 검증이 없다. 운영 배포 전에는 다음 중 하나를 적용해야 한다.
1. Main `server-v2.mjs` 안으로 Board API 통합 — 권장
2. Board Service가 공유 session/users storage를 읽어 admin/member 권한 검증
3. Internal API Gateway에서 인증 후 Board Service로 전달

## Recommended permission model
- notice create/update/delete/pin: admin 또는 지정 board_manager
- library create: member 이상
- library update/delete: 작성자 또는 admin
- general create: member 이상
- private visibility: 작성자/admin만 조회
- department visibility: 같은 department만 조회
- org visibility: 같은 tenant/org만 조회

## File upload phase
현재 attachments는 metadata만 저장한다. 실제 파일은 다음 단계에서 Storage Connector로 연결한다.
- Google Drive
- Supabase Storage
- S3-compatible storage
- STAR45 central file service

DB에는 storage_key, name, mime_type, size, checksum, uploader_id만 저장하는 것을 권장한다.

## Manual QA
1. `npm run start:board`
2. `curl http://127.0.0.1:4175/health`
3. POST notice 생성
4. GET notice 확인
5. PATCH title/pinned 확인
6. DELETE 확인
7. browser `/board.html`에서 탭 변경
8. 검색
9. 작성 모달
10. 수정
11. 삭제
12. 공지 고정 순서
13. 자료실 첨부 메타 표시

## Done criteria
- 모든 CRUD 성공
- API 오류가 UI에 표시
- 권한 없는 사용자가 공지 수정/삭제 불가
- 데이터가 컨테이너 재생성 후에도 보존
- HTTPS production route 정상
- 모바일/데스크톱 UI 정상
