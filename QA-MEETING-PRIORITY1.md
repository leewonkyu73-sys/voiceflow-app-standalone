# Priority 1 Meeting QA

Confirmed defects:
1. Frontend calls PATCH /api/v1/meetings/{id} to end a meeting, but v2 server implements POST /api/v1/meetings/{id}/finalize.
2. startMeeting() and quickJoin() call startAudio() immediately after room entry.
3. startAudio() sets recording=true and starts speech recognition immediately, so room entry and recording are not separated.

Required behavior:
- Meeting preparation screen supports Voice-first / Video-capable option.
- Preflight: camera check, microphone check, 5-second local recording playback.
- Room entry automatically checks camera and microphone only; recording remains OFF.
- Recording starts and stops only by explicit user button.
- End Meeting calls finalize, then stops timers/media/polling and shows result or returns home.
- Visible failures; do not silently swallow end/start errors.

Acceptance checks:
- Home, Work, Meeting, Client, Admin navigation.
- Device test and permissions.
- Room entry no REC timer and no STT until Record Start.
- Record Start/Stop independently of meeting lifecycle.
- Video request remains optional and consent-based.
- End Meeting returns 200 from finalize and meeting result is retrievable.
