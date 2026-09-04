# VoiceFlow v4 shared core — Phase 2 mobile speech

This directory is isolated from the v3 runtime and string-patch chain.

Phase 1 contains only:

- meeting and caption contracts
- explicit meeting lifecycle transitions
- optimistic caption state with failure recovery and reconnect deduplication
- TypeScript declarations without adding a new runtime or build dependency
- focused isolation and frozen v3.5.17 artifact checks

The Phase 1 core does not access browser media, the network, the DOM, providers, databases or production routes.

Phase 1.5 adds a platform-neutral meeting API adapter with injected transport and an additive
`client_id` caption contract. The existing server stores that key, replays an identical request,
and rejects a different caption that reuses the key. Requests without `client_id` keep v3 behavior.
The adapter has no direct network implementation.

Phase 2 adds a default-off mobile caption screen. Its `mobile-media-session` adapter owns one
injected microphone stream per session, shares concurrent starts, pauses the existing audio track
while the page is hidden, and never reacquires after an error without an explicit new user action.

The Samsung Golden path uses `mobile-browser-speech-session`: one explicit button press creates
one Android Chrome `SpeechRecognition` instance, recognizes one utterance, and commits the final
original through the same caption session used by typed input. It has no timer, automatic restart,
MediaRecorder, `getUserMedia` owner, or automatic server fallback. This reproduces the successful
b98 browser-STT path without the later watchdog/restart cycle. DeepL translation remains owned by
the shared caption API.

Devices outside the Golden Android Chrome predicate keep the isolated `mobile-speech-session`
manual MediaRecorder/server-STT path. That fallback stays explicit and can require an available
OpenAI or Gemini STT provider. The v3 runtime artifact remains unchanged; `/v4/mobile` is available
only when the deployment canary switch is explicitly enabled.

Focused checks:

    node frontend-v4/tests/phase1-state-caption.test.mjs
    node frontend-v4/tests/phase1-isolation.test.mjs
    node frontend-v4/tests/phase15-api-adapter.test.mjs
    node frontend-v4/tests/phase2-mobile-caption-session.test.mjs
    node frontend-v4/tests/phase2-mobile-media-session.test.mjs
    node frontend-v4/tests/phase2-mobile-speech-session.test.mjs
    node frontend-v4/tests/phase2-mobile-browser-speech-session.test.mjs
    node frontend-v4/tests/phase2-mobile-off-route.test.mjs
    node caption-idempotency-api.test.mjs

Run the frozen v3 artifact check only after the existing frontend patch generator:

    node scripts/patch-admin-drive-v262.mjs
    node frontend-v4/tests/v3-artifact-immutability.test.mjs
