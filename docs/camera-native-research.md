# Targeted camera research: lower17 and canonical50

This isolated research branch starts at public L `8d2c01eacd86fe9235a35e7ec5f624ba62c3b29e` and combines the reviewed lower17 camera patch from `33dc111bea27a50ca86ac004a6b98004393b0a39` (reviewed local twin `35becf21a75ce4fc57f82a819b51872ef4797ac2`) with the canonical50 camera patch from `07670da6b0dfff5273b36cf72448f0feb5609778` (reviewed local twin `72223dd5bec019072bd4ccef605b67eca22ff716`). Their game source changes occupy different files. Controls, physics, bodies, room geometry, original model assets and CameraRig remain those of L.

The dedicated workflow runs only on a push to `research/camera-native-20261008`. It first executes the targeted CPU fixtures, original-body observer regression and actual ordinary-route comparisons with retained L. Each physical scalar must be finite and differ by at most `1e-6`; shots, E requests, impact metadata and milestone frame timing must match. This is a numeric bound, with no raw or full quantized trace hash equality claim.

One exact `github.sha` production package is built, checked and stamped with `verified:false`. Two native jobs consume that same artifact without rebuilding or restamping:

| Job | LEVEL | ALTERNATIVE_ROUTE | Capture |
| --- | --- | --- | --- |
| lower17 | 17 | lower-branch | 854×480, 12 fps |
| canonical50 | 50 | empty | 854×480, 12 fps |

The existing `record-foundation-walkthrough.mjs` drives the production debug ordinary route and renders actual WebGL frames through the normal camera. There is no `qa-production-level.mjs` in the retained L source. No overview, actor pose, direct camera position, extra route wait, input suppression or body override is introduced. Dependencies include `puppeteer-core@24.16.0`, `Pillow==12.3.0` with an import/version sanity check, Chrome, FFmpeg and FFprobe.

The opt-in `CAMERA_RESEARCH_REPORT=1` observer stops the renderer animation loop and installs its reference/frame observations atomically in the same browser invocation. Ordinary Play reactivates the loop, so an earlier ready-screen pause cannot establish this boundary. The scheduling-gap regression executes the real engine visual callback between turns, demonstrates the unpaused ordering failure and checks a self-contained serialized atomic installer. This is a CPU scheduling model, not a browser/GPU acceptance claim.

The observer delegates the existing update/reset/respawn functions. It verifies exact cargo, Cannon body, animated player mesh and loaded actor asset object references during every positive visual frame. Start/finish UUIDs and body ID, sampled image identities, actual joint victory and zero **in-route** resets/respawns are recorded. The existing V8 driver performs one legacy `resetRun(true)` initialization, which calls `resetCargo` and `respawn(false)`, before its first positive visual frame; the envelope explicitly counts and discloses these three calls separately. Normal Play initialization occurs before observer installation. No reset is suppressed.

Package inventory, source-input digest and browser HTTP actor GLB bytes are checked. The retained runtime player and cargo hashes are `e5b09ff0281377b679d6fdd505fa1ed89550bb662e94e7f593ed67ee50a66a91` and `65763c87e7f14cc807cffa8fc2adc364e8421dae819271a0c406a6b0d2c8c697`. These are the unchanged production runtime GLBs, with original reference assets retained in source. Reports, capture logs, posters, continuous MP4s and failure frames/diagnostics are uploaded for review.

Before a successful fresh workflow run and review of its actual artifacts, native camera acceptance remains open. Even successful targeted recordings do not establish full-panel visibility, all actor pixels, portrait/device performance, human readability, upper17, all51, live platform acceptance or production integration. Existing lower17/50 source reviews have zero blockers for isolated research only. Active L and main are not upgraded by this branch.
