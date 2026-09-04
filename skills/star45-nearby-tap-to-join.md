# STAR45 Nearby Tap-to-Join Skill v1.0

## Purpose
Enable nearby smartphones to discover and join an active STAR45 meeting with minimal interaction. The host starts a meeting; nearby participants discover it through a native BLE/Nearby bridge and join the same session.

## Product UX
- Host starts a meeting normally.
- If Nearby is enabled, the host device advertises an ephemeral meeting beacon.
- Nearby participant devices show `STAR45 회의 발견` with host/meeting label and a single `참가` action.
- Joining never depends on another participant being present; solo sessions remain fully functional.
- After join, the standard session UI provides recording/video, live transcription, translation, chat, and meeting/consultation notes.
- QR/link remains a fallback only when the native bridge is unavailable.

## Architecture
- Business layer: Meeting Core owns meeting/session identity and participant authorization.
- Connector layer: `C-Device-Nearby` owns BLE/Nearby advertise/discover behavior.
- Native bridge: Android/iOS wrapper exposes a small JavaScript bridge to the PWA/WebView.
- Web/PWA must not assume BLE advertising support in the browser.

## Ephemeral beacon contract
Advertised payload must contain only short-lived, non-secret join metadata:
- `protocol`: `star45-nearby-v1`
- `room_hint`: opaque short room identifier
- `join_nonce`: random one-time/short-lived nonce
- `expires_at`: Unix timestamp
- `host_device_hint`: opaque device label/fingerprint

Never advertise API keys, access tokens, account IDs, or long-lived meeting secrets.

## Server API contract
Recommended endpoints:
- `POST /api/v1/nearby/advertise` -> create/refresh ephemeral beacon data for current host meeting.
- `POST /api/v1/nearby/resolve` -> exchange beacon payload for a server-side join token after validation.
- `POST /api/v1/meetings/:id/join` -> normal authenticated/guest meeting join.
- `POST /api/v1/nearby/stop` -> revoke current beacon.

## Native JavaScript bridge contract
When native Nearby is available, expose:
```js
window.STAR45Nearby = {
  available: true,
  startAdvertise(payload),
  stopAdvertise(),
  startDiscovery(),
  stopDiscovery(),
  onDiscovered(callback),
  onStateChanged(callback)
}
```
The Web/PWA layer owns UI and API calls; the native layer owns radio transport only.

## Android implementation target
Prefer Google Nearby Connections or BLE advertising/scanning in the native wrapper. Use low-power mode when possible and stop advertising when the meeting ends, app goes background beyond policy, or nonce expires.

## iOS implementation target
Use CoreBluetooth/Multipeer Connectivity or the native wrapper's supported nearby transport. Do not depend on Web Bluetooth for core functionality.

## Security
- Beacon nonce TTL: default 2 minutes; renewable while the host meeting is active.
- Server validates meeting active state, nonce, expiry, tenant/company policy, guest policy, and rate limits.
- Joining should issue a new per-participant token; never reuse the advertised nonce as a long-lived session credential.
- Host can disable Nearby or require an explicit join confirmation.
- Audit discovery resolution and join events without storing raw radio identifiers longer than required.

## STAR45 modularization
Module ID suggestion: `C-DEVICE-NEARBY-01`.
This connector must be reusable by Meeting, STARON attendance, warehouse, store, and other STAR45 apps without coupling those business modules to BLE APIs directly.
