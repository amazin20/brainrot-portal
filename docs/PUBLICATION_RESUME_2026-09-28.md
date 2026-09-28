# Continuation checkpoint — 2026-09-28

## Current public game
- Repository: https://github.com/amazin20/brainrot-portal (renamed from nesi-brainrot).
- Main and deployed game commit: `8f63b6270b97fd0f1cb9d0cd9b07ef31bc3af4f6`.
- Game: https://amazin20.github.io/brainrot-portal/
- Gallery: https://amazin20.github.io/brainrot-portal/walkthroughs.html
- Published manifest and build-info were independently read and match this commit.
- 40 videos: 182.0 MiB, 2502.2 seconds in total. All are already recorded and hosted.
- Mobile sprint and gallery were merged in PR #67 (`a93d3dc`); 10 additional campaign rooms were merged in PR #66 (`e320ab9`). Do not recreate them.

## Original workflow
https://github.com/amazin20/brainrot-portal/actions/runs/36373086433

All 47 pre-publication checks and all 40 capture jobs succeeded. The Pages deployment itself succeeded at 2026-09-28 04:34:26 UTC. The gallery check passed all 40 MP4 range requests and browser decoding/seeking in rooms 1 and 40.

The overall workflow is red because the subsequent `scripts/verify-public.mjs` timed out at its combined Play/FPS wait, before archive room 29. Reported successful archive routes: 1, 9, 10, 20, 24, 26, 27, 28. No browser page errors were recorded. The old probe did not capture failure state, so the precise cause is not proven.

## Repair and verification
- Fix commit: `2150f11dabd3e4bdb0b8a30c2c5b4c4b507918be`.
- Branch: `codex/resume-public-verification`.
- Checker now waits for the active menu and true click target, uses trusted locator input, separately waits for playing/FPS, and captures failure stage/state/screenshot.
- A read-only workflow checks the existing public version without rebuilding, recording, or deploying.
- Verification run: https://github.com/amazin20/brainrot-portal/actions/runs/36382749405
- Final result: all five jobs succeeded on 2026-09-28; the last job completed at 05:55:05 UTC. The workflow conclusion is success. The previous failure point was passed, including archive routes 29–33, continuation/wrap, portal-edge and flight/audio checks.
- Public checks passed: all 40 videos/gallery; open rooms 24,28,30; default rooms 1,30,31,35,40; both horizontal-portal routes; archive routes/transitions and model hashes.
- Final main remained `8f63b6270b97fd0f1cb9d0cd9b07ef31bc3af4f6`. This continuation created no new publication and did not regenerate any gameplay video.
- Syntax, whitespace, workflow YAML, unchanged gameplay source guard, and a separate code review passed.

## Avoid duplicates
Do not rerun the full deployment workflow or push this verification-only fix to main just to clear the red badge. Main pushes currently always rebuild, record all 40 rooms, and deploy. Carry the checker fix into the next planned gameplay release after these standalone checks finish. No new PR was opened because existing PR workflows also unconditionally repeat the full campaign suite.

The old checkout at /workspace/scratch/6ae4beaa919d/brainrot-portal is from September 26. The current isolated checkout is /workspace/scratch/fe6cb511c290/brainrot-portal. Do not use the old Sites preview as the game source or publish a parallel Site.

## Recording scope
The videos are complete automated solutions using ordinary simulated movement, aiming, portal firing, and interaction. They are not a human playtest or a hardware FPS measurement. Format: 854×480, H.264/yuv420p, 12 fps, silent, simulation-time speed. Canvas capture omits DOM HUD/tutorial/crosshair/win overlays. Completion is independently validated by won state, continuous capture, zero in-route resets/respawns, source identity, hashes, and ffprobe.

The cloud browser in this session could play gallery videos but could not create a WebGL context. Runtime gameplay verification is therefore done by the existing GitHub Chromium probes; do not claim an interactive human-style playthrough from this browser.

## Visual follow-up
All 40 published posters were inspected. No blank/corrupt frame or absent player was found. Room 17 has an excessively close/low first-frame preview that crops the upper body; choose a clearer existing-video frame in the next gallery update. Similar starting compositions in rooms 31 and 33 are distinct images and rooms.
