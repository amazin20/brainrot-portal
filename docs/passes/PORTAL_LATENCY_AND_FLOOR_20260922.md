# Portal first-use work and floor traversal — 2026-09-22

## Report and reproduction

The user's recording shows the open edition of room 24. A player stepping into the ground-load floor portal stops at feet y=-0.58 and never crosses the plane. The owned closed hull's front is 0.76 m below the portal, outside the generic 0.7 m backing heuristic. Cargo can cross earlier because it is shorter, so existing cargo routes did not expose this player regression.

The same ordinary-input sequence before the fix produces zero teleports; after the fix it produces one, without changing actor positions, disabling the platform or moving portal planes. A new regression also checks two lateral approaches, carrying the original companion and wall-to-floor return.

## Changes

- Each open-edition pad registers only its own deck skin, chassis and closed hull. The common solver still requires a linked pair, ellipse fit and near-plane throat distance. Unrelated supports, other platforms and areas outside the aperture remain solid. Clearing a portal closes the opening normally.
- Camera exit backing tests recognize that same ownership so a deeper registered hull does not trap the lens.
- Prepare real render variants while the loading screen is active: canvas/linear portal output, global exit clipping, local actor clipping and depth shadows. Restore visibility, lights, viewport, clipping and render target afterward. Driver completion is requested only during loading, never the gameplay loop.
- Preserve an already warmed shadow target when the same saved quality preset is applied onReady. Actual quality changes still rebuild it.
- Reject non-backing collision boxes with an allocation-free exact projection first, and reject irrelevant floors before portal queries. 2,000 randomized comparisons cover equivalence to the original eight-corner projection.

No graphics presets, render-target resolutions, original models, portal recursion limits, controls, movement speeds or level solutions are reduced/changed by this repair.

## Measurements and limits

Baseline native run 35682808370 (runtime before the repair), 1280x720 Chromium/SwiftShader: 20 WebGL linkProgram calls during the ordinary first wall-to-carriage route. Candidate native run 35683320396 (source 55d8f717a9cdb40782204bf919632b741ca2f831): zero on the same route, no page errors, unchanged geometry/pass counts. Both use scripts/portal-profile.mjs.

These are software-renderer diagnostics, not a hardware FPS benchmark. Timing results are not uniformly improved: the first-shot stall disappeared in this sample, but software driver stalls still occurred in the candidate's subsequent portal frames. Consequently neither a universal speedup percentage nor elimination of all device-specific stalls is claimed. The verified improvement is removal of first-use shader linking from the measured gameplay path, plus less CPU allocation/search work.

The new scripts/portal-regression-browser.mjs checks production and public-site floor traversal, reverse exit, carrying, source identity, page errors and zero in-play shader linking. Its screenshot sequence samples ordinary simulated input at 15 captured frames per simulated second; it is not a real-time FPS recording. Existing campaign and release checks remain intact, with additional native and post-publication regression coverage.

## Reproduction

`npm run check`

`node --test tests/lab-floor-portal-backing.test.js tests/lab-portal-warmup.test.js`

For cold diagnostics start Vite dev on port 4173, set CHROME_PATH and run `node scripts/portal-profile.mjs`.

For the production regression build and stamp, serve preview on port 4173, then run `node scripts/portal-regression-browser.mjs`. PAGE_URL selects the published site, BUILD_COMMIT enforces revision identity, RECORD=0 omits the motion PNGs without skipping routes or assertions.
