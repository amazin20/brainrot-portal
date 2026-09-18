# P09A — remove redundant camera collision work

User report: lag, freezes and falling frame rate. Base: published `ae949365fe690421e7d1972d284cdc8ea6785eb8`, source tree `a0354e9b561c9984ef55b3ad3a85c87cc698483d`. The restored tracked archive exactly matched that tree; locked dependencies are unchanged. Scope follows master specification section9.2, not a claim to finish device acceptance.

## Measured bottleneck and bounded change

The camera casts the same nine near-plane safety rays at every avoidance candidate. In room21 the original complete route issued153774 ray queries after warmup, each scanning292 root blockers:44902008 root visits, up to105120 in one update. The new conservative broad phase selects only the roots whose world bounds overlap the WHOLE swept nine-ray volume, including the far extension. It then uses the original Three.js raycast, recursive policy, material/layer handling, hit order and original portal/contact filter. All nine rays and all avoidance candidates remain; the visible result is not traded for fewer safety samples.

Only ordinary rigid leaf meshes with the original Mesh.raycast are culled. Custom, hierarchical, skinned, instanced and morphing objects retain the complete path. Raw geometry bounds are cached weakly and invalidated by position-buffer identity/version/count. World bounds are refreshed each camera update after the existing world-matrix refresh; they cannot outlive that update. Standalone constrain calls use the unfiltered original query. Result arrays are reused. Reset and finally blocks release active state; no global retained room cache.

Runtime changes: LabCamera.js (query setup and reusable results) and new LabCameraBroadPhase.js. No changes to camera goals, spring constants, horizon recovery, FOV, controls, portal rules, physical bodies/colliders, level geometry, model geometry/materials, lighting, quality defaults, saved progress or solutions. The receiver, visible cable, all existing camera fixes and early-shot protections remain. This does NOT repair the separately documented camera continuity jump.

## Executed local initial measurement

Node22.16.0 CPU profiler, no renderer, full5200-step known-solution room21 route, first120 display samples excluded, source models loaded. Both runs completed the joint exit without reset/respawn, exact same full actor/camera trace digest091bbae18a84fa3a93395cd91feaa34fa79331dcf60541a7f24518874de312b0.

Initial before → after camera timings: median0.663→0.225ms, p952.437→0.447ms, avoiding median18.941→0.984ms. Total measured camera CPU5861→1379ms. Root visits44902008→57501. Physics time unchanged within measurement noise. These are this container's CPU samples, NOT user FPS, GPU frame time or a promise of60FPS. Multiple serial CI repeats and browser measurements are separate pending evidence; retain concrete results rather than extrapolating.

46 local targeted tests passed (new culling cases plus core/exit-plane/silhouette camera contracts). New tests include1200 seeded casts against the brute path, grazing/inside rays, original custom/recursive/layer/duplicate semantics, moving parents, geometry edits, interleaved versions, reset/exception cleanup, and full normal/recovery room21 trace equality with culling disabled/enabled. Existing suite and all21-route CI remain mandatory.

## Browser and publication contract

Local Chromium navigation was blocked by administrator policy; no policy was changed. The normal GitHub browser workflow runs the complete route before/after on immutable versions with one recording script and lockfile. Camera CPU timings are measured separately from rendering/encoding, 1280×720 low mode on both, Chromium/SwiftShader. It retains60 successive native30Hz joint-exit frames per source; silent fixed-simulation clips show unchanged appearance, NOT hardware FPS. Trace equality and render work counts are checked. Pixel hashes are recorded, not assumed identical.

Only publish through the unchanged full campaign checks and public-site verification. This source card does not imply deployment. Remaining separate work: actual-device p95/long-frame traces, GPU/portal rendering cost, memory plateau, camera continuity/console comfort and human puzzle acceptance. Do not lower visual settings or change physics to make this comparison look faster.

API references checked for this pass: Three.js official Raycaster and Ray documentation; runtime behavior tested on locked Three.js0.180.0. No dependency added.
