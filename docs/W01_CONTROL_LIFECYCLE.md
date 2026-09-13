# W01 — pause and touch lifecycle, second increment

Base: `7ffcf1c2216c4cf347de05b5c29e591cb807c816`, on top of v36.
This is an input increment, not a finished W01 animation/camera polish pass and not room 21.

## Changes

- `LabControls` owns camera/action events for the lifetime of one game. The first look finger keeps ownership when a second finger lands or lifts; cancellation/lost capture clears that owner.
- `LabGame.resetInput()` unifies keyboard, joystick capture, look capture, queued interaction and the unconsumed jump buffer. Menu pauses, level/restart transitions, application holds and failures use it. It does not erase physical velocity or change jump/movement parameters.
- Input handlers reject events outside active play, including touch camera movement during external holds. Repeated keydown cannot resurrect a key cleared by a pause; a new press is required.
- Non-persisted page teardown detaches control listeners. Back/forward-cache visits retain the controller and use an independent `page` hold. This is not a complete GPU-memory/disposal audit.
- The fixed-step loop stops immediately if victory or an external hold occurs inside a substep.
- The ordinary interface no longer creates the FPS display or exposes the hint button. Debug/smoke mode keeps diagnostic tools and existing hint contract tests; contextual teaching still updates without an FPS element.

## Evidence and reproducibility

The source tree imported for local work matches GitHub tree `5f644061cd502817c36a086fa1e31f657794049e` exactly. A credential-free GitHub Actions source/dependency artifact enabled the offline Node environment; its operational workflow is not part of this PR.

`node --test tests/input-focus-recovery.test.js tests/lab-control-lifecycle.test.js`: **27/27 passing locally**, Node 22.16.0. The 15 new tests execute actual game/controller code and Three vectors with explicit DOM/pointer-capture doubles. They are not touchscreen-device evidence.

The preceding commit's full workflow passed: https://github.com/amazin20/brainrot-portal/actions/runs/34754757779 . That result does not validate this increment. The full `npm run check` is run again on an immutable source copy, and the normal PR campaign CI remains required.

`w01-controls-review.yml` compares the exact previous commit with its candidate. It runs real Chromium/CDP multi-touch in the loaded game, records per-check JSON and sequential 1280×720 native frames, and encodes silent 30 fps camera comparison clips. Physics is deliberately paused for that isolated camera experiment: these clips are neither level playthroughs nor device FPS measurements. The baseline is expected to expose failures; the candidate must pass every check. A workflow definition is not a successful test result: inspect its concrete run and retained JSON.

Local Chromium navigation was blocked by the execution environment's administrator policy. No browser policy was changed; browser verification belongs to GitHub Actions. A real Android phone, human comfort/readability, a full animation comparison, and hardware performance remain unverified.

## Protected scope

Room layouts and solutions 1–20, character GLBs, collision/portal rules, movement speeds, jump impulse, physics timestep and save format are unchanged. No unverified room is added to the public campaign. No main merge or public deployment is authorized by this report alone.
