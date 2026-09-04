# VoiceFlow v4 PC-aligned mobile UI · Design QA

- Source visual truth:
  - `/workspace/scratch/d5dc3941a924/upload/5aa19d8b-327f-4465-a059-d0671e8c0126.png` — PC meeting-room information architecture, 1511×1996 px.
  - `/workspace/scratch/d5dc3941a924/upload/851371b9-6e81-4280-8315-63c6d97c7191.png` — confirmed Samsung Golden speech/result state, 1759×2048 px.
- Implementation evidence: cloud-browser inline capture of the local `/mobile-frame` preview; app iframe 393×852 CSS px inside a 1365×936 browser capture.
- Viewport and normalization: implementation app content was forced to 393×852 at CSS scale 1. Source browser/device chrome was excluded from product-content judgment. The PC source supplied structure and tokens; the Samsung source supplied the successful controls/result state.
- State: Korean source, Vietnamese target, Golden browser speech ready, two committed captions, composer visible.

## Full-view comparison evidence

- PC hierarchy is preserved in the implementation: meeting title → language/participant/speech toolbar → status → transcript → composer.
- The mobile implementation intentionally compresses the PC toolbar into two rows while retaining the same order and semantic colors.
- The previous mobile page scrolled the composer below the visible area. The implementation uses a 100dvh grid with only the transcript region scrolling; measured document size is exactly 393×852 with no horizontal or vertical page overflow.

## Focused region comparison evidence

- Toolbar: Korean/Vietnamese selectors, participant count, green start and red completion controls retain the source order and state meaning.
- Transcript: source/translation typography, green committed accent, blue translated text, rounded white cards and pale workspace background are retained.
- Composer: the PC bottom composer pattern is retained and reduced to a compact textarea plus blue send control; it remains visible at 393×852.

## Required fidelity surfaces

- Fonts and typography: PASS. Existing Inter/Pretendard/Noto Sans KR stack and bold hierarchy are preserved; mobile controls remain readable at 0.72–1.02rem and 44px touch height.
- Spacing and layout rhythm: PASS. Header, toolbar, status, transcript and composer align to the PC sequence; mobile gaps are compressed without clipping.
- Colors and visual tokens: PASS. Existing navy text, blue action, green speech/success, red completion and pale gray-blue panels are reused.
- Image quality and assets: N/A. The target contains no app-owned raster assets that need generation; browser/device chrome is excluded.
- Copy and content: PASS. Confirmed Golden provider/status text, original/translation copy, language choices and input action remain present.

## Primary interactions tested

- Speech start changes to listening state and enables completion: PASS.
- Completion changes to `원문 표시 0.1초 · 번역 완료 1.1초`: PASS.
- Manual text submit appends a caption and clears the input: PASS.
- 393×852 document overflow: PASS (`scrollHeight=clientHeight=852`, `scrollWidth=clientWidth=393`).
- Page-origin console errors: PASS (0). Browser-extension-only metadata errors were excluded.

## Findings

- No actionable P0/P1/P2 visual mismatches remain within the v4 caption-room scope.

## Scope constraint

- Invite, video, materials, chair mode and global bottom navigation are not implemented in the isolated v4 caption module. They are not rendered as fake controls; the real existing application remains reachable through `홈으로`. This is a feature-parity follow-up, not a visual defect in this scope.

## Follow-up polish

- P3: after the first Samsung production capture, confirm that the browser address/bottom bars do not reduce the effective 100dvh area on that exact Chrome build.

## Comparison history

- Initial source mobile screen: full page scrolling placed the composer below the transcript and separated it from the PC room hierarchy.
- Fix: converted the shell to a fixed-height responsive grid, aligned PC toolbar/order/tokens, and isolated scrolling to the caption region.
- Post-fix evidence: 393×852 capture shows title, controls, captions and composer together with zero page overflow and passing interactions.

final result: passed
