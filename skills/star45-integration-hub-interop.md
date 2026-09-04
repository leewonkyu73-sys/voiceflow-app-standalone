# STAR45 Integration Hub Interoperability Skill v1.2

## Purpose
All STAR45 apps and modules should reuse centrally managed API/connector settings instead of duplicating credentials per app. Apps must be able to send settings to, receive settings from, compare with, and bind to STAR45 Integration Hub.

## Core architecture
- Integration Registry: provider/connector identity, capabilities, metadata, health, version.
- Secret Vault: encrypted secrets, rotation/versioning, never returned to browsers in plaintext.
- Binding Resolver: apps/modules reference `integration_id` rather than storing credentials directly.
- Hub Bridge: server-to-server bidirectional synchronization between an app and Integration Hub.
- Audit Log: save push/pull/test/config/conflict history.

## Binding precedence
`AGENT > MODULE > APP > PROJECT > COMPANY > TENANT > GLOBAL`

## Required admin capabilities
Every STAR45 app admin integration page must provide:
1. Local integration add/update/delete/test/status.
2. Integration Hub configuration: Hub Base URL, project ID, tenant/company ID, server access token, conflict policy.
3. Per integration actions: `Hub에서 가져오기`, `Hub에 저장`, `연결 테스트`, `삭제`.
4. Bulk actions: `전체 비교`, `전체 Hub로 보내기`, `전체 Hub에서 받기`.
5. Sync state display: same / different / local only / hub only / conflict / error.
6. Audit history with actor, timestamp, direction, result, versions.
7. Optional connector setup must remain available after deployment from the administrator page.
8. **In-page connection guide is mandatory.** Each connector card must show a short 1→2→3 setup guide using the actual provider terminology (API Key, OAuth Client, Bot Token, Endpoint, etc.).
9. **Do not send admins to separate documentation for the basic setup flow.** The normal connection path must be understandable and executable from the admin page itself; external consoles are opened only for credential/OAuth issuance when required.
10. If an existing Hub binding is available, show `Hub에서 가져오기` before asking for new credentials.
11. If no Hub binding exists, allow the admin to enter the new connection locally and then save it to Hub for future project reuse.
12. A dependent app feature must tell the admin exactly which connector is missing and provide a direct link to the corresponding admin card.

## Mandatory Admin Integration UX
- Keep the page visually simple, compact, and readable.
- Use only three primary connection states: **연결됨 / 연결 필요 / 오류·확인 필요**.
- Show a top summary of connected, required/missing, and error counts.
- Use one card per provider/connector; avoid nested configuration screens unless OAuth itself requires a redirect.
- Card order: `상태 → 연결 방법 1→2→3 → 필요한 입력값 → 저장 → 연결 테스트 → Hub 가져오기/저장`.
- Secret fields remain masked and must never be re-rendered in plaintext after save.
- Do not expose raw JSON/config dumps as the primary UX; detailed logs belong in an expandable diagnostic area.
- Responsive layout: two-column cards on desktop, one-column on mobile/tablet narrow widths.
- Buttons and labels use the user-facing primary language; provider names remain canonical.
- Avoid excessive shadows, large decorative cards, duplicated actions, or long explanatory text.

## Deployment and optional-integration rule
- External integrations are **optional by default** unless a project manifest explicitly marks a binding as `required_for_startup=true`.
- Missing optional integrations must **not block application deployment, startup, health, or 100% core operational completion**.
- When an optional integration is not configured, show `NOT CONFIGURED / CONNECT LATER IN ADMIN` and disable only the dependent feature.
- The administrator must be able to add or connect the integration later without rebuilding or redeploying the whole app.
- When credentials or OAuth are added later, runtime services should resolve the new binding automatically or through a targeted connector refresh/restart, not full application redeployment.
- Google Drive, Google Calendar, Microsoft 365, Discord, Obsidian, Hermes and similar connectors follow this rule unless explicitly declared mandatory for a particular app.
- Connector-specific live verification is reported separately from overall application readiness. Example: `APP 100% PASS / GOOGLE DRIVE NOT CONFIGURED (OPTIONAL)`.

## Security rules
- Never expose stored secret plaintext to browser UI after save.
- Hub transfer is server-to-server only.
- Production Hub URL must use HTTPS. Localhost HTTP is allowed only for development/testing.
- Authenticate Hub calls with a server-side bearer token or stronger workload identity.
- Do not put secrets in Git, client bundles, URLs, logs, or browser localStorage.
- Secret fingerprints/hashes may be used for compare operations without revealing secret values.
- Rotate/revoke credentials centrally where supported.

## Synchronization rules
- `push`: local server resolves secret values and sends them to Hub over authenticated TLS; browser never receives them.
- `pull`: server receives Hub settings and stores secrets through local encrypted Secret Vault.
- `compare`: compare config/fingerprint/version without returning secret values.
- Default conflict policy is `manual`; never silently overwrite when both Hub and App changed after the last common sync.
- Optional policies may be `hub` or `app`, but must be explicit and auditable.
- Central changes should propagate to dependent runtime services without requiring manual credential re-entry.

## Fallback / migration behavior
- If Hub is unavailable, an app may temporarily use its local encrypted Integration Store.
- If an app has a local integration that Hub lacks, the admin can `Hub에 저장` to register/reuse it centrally.
- If Hub has an integration that the app lacks, the admin can `Hub에서 가져오기` and bind it.
- New STAR45 apps should prefer Hub binding from the start and use local storage only as bootstrap/fallback.

## Standard API contract for app-side Hub Bridge
- `GET /api/v1/admin/integration-hub/status`
- `PATCH /api/v1/admin/integration-hub/config`
- `POST /api/v1/admin/integration-hub/test`
- `GET /api/v1/admin/integration-hub/compare`
- `POST /api/v1/admin/integration-hub/push/:integration_id`
- `POST /api/v1/admin/integration-hub/pull/:integration_id`
- `POST /api/v1/admin/integration-hub/push-all`
- `POST /api/v1/admin/integration-hub/pull-all`

## Standard Hub-side compatibility contract
Apps should expect a Hub-compatible implementation of:
- `GET /health`
- `GET /api/v1/integration-hub/projects/:project_id/snapshot`
- `GET /api/v1/integration-hub/projects/:project_id/integrations/:integration_id?include_secrets=1`
- `PUT /api/v1/integration-hub/projects/:project_id/integrations/:integration_id`

The exact Hub implementation may evolve, but app bridges must isolate protocol differences so business modules do not depend directly on Hub transport details.

## STAR45 modularization rule
Hub integration is a Connector/Hub concern and must remain separable from Meeting, ERP, Marketing, Finance, STARON, or other business modules. Business modules consume resolved integration bindings; they do not own provider credentials.
