# Level route QA

The default game starts a 30-room **foundation** campaign: five new opening rooms followed by rooms 6–30 using the existing numbered builders. The `classic` menu entry exposes archived levels 1–33, including the previous opening rooms. The separate `open` review edition exposes rebuilt levels 24, 28, 30–33. QA checks every currently selectable room in every edition.

## Run the route audit

```sh
npm ci
mkdir -p qa/route-matrix
node scripts/qa-campaign-routes.mjs --json=qa/route-matrix/all.json
```

The script logs `PASS` or `FAIL` for each edition, level and route, continues after a failed route, and exits with status 1 if any route fails. Its JSON report stores elapsed time and any error for every route; successful routes also record frame count, portal crossings and milestone positions. It saves an atomic checkpoint after each route with `incomplete: true`; only the finished report omits that flag. The default command checks the canonical path for every playable room and a tested alternate or recovery path where one exists. To reduce runtime during development:

```sh
node scripts/qa-campaign-routes.mjs --edition=foundation
node scripts/qa-campaign-routes.mjs --edition=classic --levels=12-16
node scripts/qa-campaign-routes.mjs --edition=open --canonical-only
node scripts/qa-campaign-routes.mjs --edition=classic --kind=recovery
```

`--levels` accepts comma-separated numbers and inclusive ranges; `--json` accepts a writable file path. `--kind` selects canonical, alternate, preparation, exploration, bypass, recovery or timing runs; an empty selection is an error. The report's `gaps` records rooms with no demonstrated *distinct puzzle-solving route*. A successful preparation order, scouting loop, recovery or timing change does not remove that gap. A missing alternate is **not** proof that the room is linear, and a declared design concept is **not** proof it is unique.

The `route-matrix` job in `.github/workflows/verified-build.yml` runs each edition in a separate 30-minute CI job and uploads JSON artifacts named `campaign-route-matrix-foundation`, `campaign-route-matrix-classic` and `campaign-route-matrix-open` for the checked commit.

## What PASS means

The audit runs the production physics in a headless Node environment. The journey driver uses movement, interaction, camera aiming and portal shots, checks that the actual game state becomes `won`, and asserts no player respawn, companion reset or replacement of the companion and its physics body. Most extra routes cite an existing completion test; the room 2 recovery is exercised directly by this CLI and cites its journey implementation. Diagnostic scenarios may report their own success while the level is still active; this audit explicitly rejects such results.

The script does **not** certify that a player can discover the solution, that two paths are meaningfully different, or that every possible wrong move has a recovery. It does not render WebGL or evaluate art, readability, frame rate or enjoyment. Run browser playtests for each room: approach without hints, try the plausible wrong moves and shots, confirm those states have a way back, and have a different player explain the intended portal or physics idea. Record specific bypass attempts and any point where the player cannot understand what to try next. Add a completion route test for each actual new solution or repair.

For the requested nonlinear campaign, review the `gaps` and compare route milestone traces: two scripts reaching the same finish in the same order do not establish nonlinear play. Foundation 1–5 have alternate routes in `tests/lab-foundation.test.js`; rooms 6–30 reuse their classic route evidence. Some routes marked `preparation` change only the order of setup, `exploration` circles back to the original plan, and `bypass` avoids the main mechanic. Treat these as separate checks, not proof that the puzzle has a strong second solution.

Research room options 31–33 came from completion tests of the `open` edition. The `classic` edition currently uses the same builders; this CLI exercises those options in `classic` separately and marks their source as borrowed. A source reference by itself does not claim that the cited test ran in both editions.
