# Release candidate preparation — 26 September 2026

Base publication: `9c91806585a2b9f85e6e67130af83c609e50f337`.
This is a technical candidate, not a claim of final player or platform acceptance.

## Changes

- Retains the preceding deck UV and shadow-batch corrections.
- Persists the last successfully started room per edition. A victory stores the next room; final victory retains the final room. Explicit room links override resume. Legacy saves select the first incomplete room; no completion is invented.
- The first Play action in a browser session does not request an interstitial, including returning players.
- Normal UI hides the solution-hint button; control tutorials remain available. Debug verification retains the hint path.
- Lost WebGL context stops gameplay/audio and shows the existing reload screen. Room progress survives; in-room physical state is restarted. This is recovery by reload, not transparent GPU restoration.
- Camera escape selection checks the full character silhouette near physical slopes. Other camera contexts retain their established framing. The room-30 exploration reproduction improves from 10/480 clipped subject samples to 0/480, with ordinary inputs and no respawn or reset.

## Verification

- Saved-resume and migration tests: 14/14 passing.
- Camera regression suite: 56/56 passing, including ordinary room-12/13/14 routes, portal exits, aiming and collision sweeps.
- Room-30 ramp exploration: 480 samples; 0 outside-frame samples after repair. This is geometric projection evidence, not native WebGL visual acceptance.
- Production build and 14-model package validation pass before the final session-recovery change; final rebuild and full suite are running.
- Added `release-session-browser.mjs` to the required verification workflow for a real room-1 victory, reload, explicit links, ordinary UI, landscape mobile layout and WebGL-loss recovery.
- Native local browser execution is unavailable: the browser installation download was not a valid archive. Browser checks and captures must pass in CI before publication.

## Remaining release gates

1. Full source suite and exact-commit native browser workflows, including the new session check and ramp footage.
2. Inspect native opening rooms, the ramp repair and representative late-room imagery. Headless projection tests do not replace this.
3. Independent blind playthrough and recovery testing across the 30-room default campaign; `LEVEL_QA_STATUS_2026-09-24.md` records the existing evidence and gaps.
4. Real desktop/mobile device performance and touch usability measurements.
5. Live Yandex SDK/ad lifecycle validation and moderation package review. Build mode alone does not establish platform acceptance.

Reproduce locally: `npm run check`, `node scripts/v8-package-check.mjs`, `node scripts/qa-ramp-framing.mjs`.
