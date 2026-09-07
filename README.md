# NESI / Transfer Lab

A third-person browser physics puzzle game: take the same animated companion through portals and physical machinery. Twenty selectable rooms, original character models, procedural animation, no progress checkpoints.

Play: https://amazin20.github.io/nesi-brainrot/

## Development

Node.js 22. Install locked dependencies with `npm ci`, then `npm run dev`. `npm run check` runs the unit/regression suite and Vite production build. `npm run preview` serves `dist` locally. The Pages deployment verifies the exact public `build-info.json` commit after publishing. Do not confuse a branch, source archive, unit-test success or concept image with an updated public demo.

## Gameplay and controls

WASD moves; mouse orbits; left/right mouse fire the blue/amber portal charges. E picks up/releases the companion or operates the nearest accessible mechanism. Space jumps, Shift runs, V waves. Escape opens settings, level selection and hints. Click the scene to capture the mouse after resuming. Touch controls are also present. Continuous ivory ceramic areas accept portals; dark graphite construction does not.

The first five rooms introduce linked space, live weight, gravity/momentum, a moving portal surface and exit angle. Later chambers introduce reflection, balance, airflow and tangible workshop interactions: a spring pawl, freight ferry, flywheel and clutch, rotary portal drum, winch brake, gripper crane, duct shutters, lifted sightline, wind sail, roller sorter and elastic rebound. Details and honest limits are in `docs/RELEASE_V17.md`.

The active campaign loads eighteen runtime GLBs across all rooms and four at startup. Nine supplied object derivatives are split into fixed and moving parts; their hashes and source filenames are in `docs/WORKSHOP_ASSETS.json`. Source/reference assets are excluded from `dist`. The original player and companion remain in use.

## Verification

Run `node scripts/v8-journey.mjs` for twenty normal-control routes on production physics, `node scripts/v10-shortcuts.mjs` and `node scripts/v17-audit.mjs` for bounded negative checks, and `node scripts/v17-recovery.mjs` for an unprepared-fall/missed-ferry recovery. Test fixtures that assign positions are clearly separated from the positive playthroughs.

For Chromium evidence, install the CI browser driver and run `scripts/v8-browser.mjs` against a production preview on port 4173 with `CHROME_PATH` pointing to Chrome. The separate Yandex draft (`npm run build -- --mode yandex --outDir dist-yandex`) is tested on port 4174 by `scripts/v8-yandex-browser.mjs` with an explicit SDK stub. This does not verify live advertisements, moderation or revenue. GitHub demo hints are free and do not imitate ad views.

This is a twenty-level demo, not a completed hundred-level release. Finite automated routes and software-rendered evidence cannot establish universal FPS, subjective puzzle quality or the absence of every possible alternative route.
