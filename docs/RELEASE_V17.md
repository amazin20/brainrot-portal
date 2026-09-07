# V17 — twenty playable physical workshops

Base: main cbfad2228c6e517f9235b4c96064dd0c015901a5. This extends the existing Three.js/cannon-es game, not a new prototype. Complete source and binary models were imported from the intact user-authorized archive with a SHA-256 check, then verified again. No base64 chunks are required at runtime or in the final branch.

## Active campaign

There are exactly **20** active levels. Chambers 1–5 retain the introductory puzzles and open ceramic surfaces. The optical, balance and air principles in 6–8 remain; 7 and 8 now use the supplied mechanism art. The old impact/vector-maze definitions for 9–10 are not in the active campaign; they are replaced by tangible machinery. Levels 11–20 are actual selectable rooms, not locked menu placeholders.

| Level | Title | Main physical idea |
|---|---|---|
| 9 | Пружинная почта | Gravity drop compresses a spring-guided piston until the visible pawl catches. A static weight alone is insufficient. |
| 10 | Грузовой паром | A small cargo carriage crosses a low roof that does not fit the player. Loaded docking physically opens the station cover. |
| 11 | Запас ветра | Portal-routed air spins a turbine and stores flywheel energy. Engaging the clutch transfers useful work to a lifting ratchet. |
| 12 | Карусель адресов | A portal rotates with a drum to serve isolated radial balconies. Retrieve the companion and change the exit orientation for the second journey. |
| 13 | Тормоз высоты | Live load raises a platform. A reachable upper winch brake holds its actual position while the same portal pair retrieves the load. |
| 14 | Бережный кран | A force-driven gripper carries the original companion body out of a covered bay to a receiving cup. |
| 15 | Жалюзи | Two independently operated physical shutters stop airflow through a transparent duct. Open the channel and repurpose the portal path. |
| 16 | Перестановка опор | A lifted panel opens a firing sightline through a low service window. The player cannot simply ride and jump through the window. |
| 17 | Парусный док | Sustained wind accelerates a loaded rail platform. A real return winch and stairs recover a missed ferry and an unprepared fall. |
| 18 | Поворотный сортировщик | Orient a roller table, feed the companion through a portal and deliver it to the covered receiving cup. The access shields open after delivery. |
| 19 | Мягкая посадка | An angled elastic bed redirects a falling body's velocity into a separate overhead plunger, inside a transparent test well. |
| 20 | Общая мастерская | Convert the same portal pair from an air-power connection to a travel route. Secure a driven platform with a brake before returning for the companion. |

These rooms use different layouts and causal arrangements, not concatenated copies of the earlier gate/lift/fling route. White ceramic areas allow continuous placement, including useful and non-solution experiments. Winning checks grounded player + nearby original companion at the exit, not a hidden list of required actions. Physically valid alternate solutions are not disallowed by progress flags. No midlevel checkpoints have been added.

## Seventh-room repair

The final dock is now a physically enclosed upper bay, not an exposed ledge. Visible walls, a roof and a low service sightline separate it from the whole moving-lever envelope. The sightline admits portal shots but not the standing player. Negative tests use the full game update, moving machinery, sprinting, repeated jumping, all three counterweight settings, loaded/unladen states and generous elevated edge fixtures. This is different from testing a single ballistic jump on a frozen platform.

## Nine supplied GLB derivatives actually in runtime

31 wind generator, 32 spring ram, 33 telescopic lift, 34 balance mechanism, 35 shutter/turbine fan, 36 gripper, 37 extendible bridge/carriage, 38 turntable, 39 cable winch.

`docs/WORKSHOP_ASSETS.json` records each uploaded filename, original hash, derivative hash, byte count and triangle count. The derivatives have a fixed Frame and separate Moving geometry, baked source colors and approximately 4,200–4,500 triangles each. They are lighter game versions, not the full-detail original textures/meshes. The source player and companion are not substituted. Individual rooms load only their declared dependencies; the first starts with four models and the whole campaign uses eighteen. Not every extra historical upload is claimed integrated.

## Animation and feedback

The independent chest, planted feet, hand contact, flight bracing and companion attention are preserved. Terminals trigger a short relaxed hand/body acknowledgement. The companion retains head, fin, tail and foot response while carried. Supplied rotor, ram, gripper, drum, lift and winch moving parts animate independently of their fixed frames. Fan rotors accelerate and coast continuously; winch drums follow the actual platform travel. Animation does not assign the player's physics transform or shake the camera. This is procedural animation, not motion capture.

The top-right display is the Arabic level number alone. Escape opens level selection, graphics, sound, tutorial and hints. The GitHub build has free hints and no actual ads. The separate Yandex draft exercises rewarded/fullscreen callback behavior only.

## Verification procedure

- `npm run check` — all unit/regression tests and production build.
- `node scripts/v8-package-check.mjs` — eighteen declared packaged models and source/reference exclusion.
- `node scripts/v8-journey.mjs` — all twenty routes using ordinary movement, aim and E controls, no actor-transform/win-state fixtures.
- `node scripts/v10-shortcuts.mjs` — 180 introductory negative jump fixtures.
- `node scripts/v17-audit.mjs` — 372 full-update negative cases, including 216 seventh-room repeated-jump trials and 12 generous raised-platform window probes.
- `node scripts/v17-recovery.mjs` — empty ferry departure, fall without a prepared pair, stairs, return winch and recovery of the same companion without resetting.
- `node scripts/v8-browser.mjs` — twenty Chromium/WebGL routes, ferry recovery, actual menu loop and selector, HUD, lazy asset requests, sound/settings persistence, narrow-screen settings and rendered animation frames.
- `node scripts/v8-yandex-browser.mjs` — production Yandex build with an explicit SDK callback stub, not real ad delivery.

The complete imported candidate passed source and browser run 34085977017. The final release additionally includes sorter-access, ferry-recovery and rotor/winch refinements; use its successful PR/Pages run, not the earlier candidate run, as final evidence. Publication writes `build-info.json` with the exact commit, version `v17-twenty` and `levels:20`, then verifies it on the public site.

## Limits

This is a playable twenty-level demo, not the planned hundred-level finished product. Tests cover finite paths and adversarial cases; they do not prove there is no imaginable exploit or determine human solving time. Software-rendered CI is not a benchmark of the user's GPU. Real Yandex ads, moderation and revenue are not verified. Level difficulty and the subjective expressiveness of animation still require human play feedback.
