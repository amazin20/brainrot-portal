# V13 — five different physical puzzles replace levels 6–10

Base: main 79fd1715 (V12). The user rejected concatenated old stages. The entire extended campaign and its solution driver are replaced, not lengthened. The first five layouts and approved player/companion assets are retained.

## Independent concepts and spaces
6. Перекрёстный свет: an optical workshop with a low service window. Reach a mirror control via a temporary portal route, then repurpose the pair to carry a beam through space and reflect it into a sensor. The ray is actually traced through portal transforms and a reflecting plane; breaking the beam closes the door. All four cabin sides are sealed against walk/jump entry.
7. Точка опоры: an open pit crossed by a long rotating balance beam. A movable counterweight, the companion's distance from the fulcrum and the player's own weight affect gravity torque. After reaching the fixed high gallery, retrieve the load through a portal. Rotation is a damped one-degree-of-freedom spring/torque model; cargo collision is an oriented physical box, and foot support samples the same tilted plane. Load contact projects the rotated companion footprint onto the deck.
8. Ветер за углом: a tall pneumatic column. An on/off blower provides continuous acceleration that can be redirected through portals into an updraft. Exit the stream sideways onto a high gallery. There is no lift deck or scripted launch impulse. Closed glass transmits light but blocks airflow.
9. Работа удара: a loading table and long covered roller conveyor opposite a low impact channel. Redirect the accelerated companion through portals into a real dynamic piston. Collision momentum compresses its restoring spring far enough to engage a visible ratchet; the channel cover then opens for retrieval. Gentle contacts do not latch it. Conveyor rollers, cover, pawl and piston are animated functional components. Rendered review increased entry clearance and motor speed so a correct shot does not lose its energy against the cover.
10. Векторный сейф: an upper observation ring around a low glass-covered maze. A terminal changes the direction of a continuous force on the loose companion. Navigate offset corridors, then use the open extraction well and a prepared portal pair to receive the same companion on the upper gallery. Glass blocks hands and portal shots. A receiving cradle contains the exit motion, and the well tile is aligned to accept the approaching load without pixel-precise aiming.

Shared code is confined to geometry, contacts, ray transforms and actuator primitives. There is no old gate/lift/fling stage composition and no mechanism-use checklist attached to victory. Legitimate alternate physical solutions remain allowed. These new devices are procedural geometry integrated into the game, not a claim to have installed the previously pending additional GLBs.

## Pressure plate repair
Load detection projects the oriented companion footprint onto the real moving inset's tangent plane, using its load bounds rather than the smaller portal-safe rectangle or a radius around the centre. The top responds at its corners and edges. Held loads, hovering bodies and non-overlapping stationary frame positions do not activate it. Existing free teaching remains separate from optional solution hints.

## Executed verification
Successful full verification: https://github.com/amazin20/nesi-brainrot/actions/runs/34003259190
Verified runtime commit: 78651346c7c5d8c97ab4ead5710019ebf8cc3a82.
Evidence artifact: 9980184860; tested browser artifact: 9980185094.

258 unit tests passed locally on the identical runtime source. The dedicated CI passed the same test suite, production build, all ten ordinary-control physical routes in Node, and all ten production Chromium/WebGL routes with zero player respawns and zero companion resets. The browser report contains no page errors, verifies real menu/next-level controls, Arabic-only level HUD, graphics/volume/mute persistence, 60 rendered animation frames and a Yandex callback-contract stub. Actual new chamber and mechanism screenshots were inspected after the successful run.

Pressure tests cover the centre, four edges and four corners of the original moving inset, corner release, rotated cargo, hovering and held objects. Other tests cover optical transport/reflection, glass versus air, signed lever moments and support, sustained airflow, weak/strong piston collisions, field forces, the piston/player collider and blocked cabin entry from four sides.

Bounded negative audit: 108 no-power jump trials on the new optical/air/impact obstacles, 45 through-cover grab probes, 12 weak impacts, 9 wrong balance arrangements. The existing 180 introductory jump trials remain. These checks are not an exhaustive proof against every possible strategy, nor a human assessment of puzzle difficulty. A valid alternative solution using world physics is not prohibited.

The first browser review exposed an impact-channel clearance issue. It was corrected and the full browser suite rerun successfully, rather than suppressing that check. Temporary patch/export workflows and transport files are removed from the final branch; runtime files are ordinary reviewed source.

Publication is a separate gate: Pages repeats the routes and browser tests and must confirm the exact public SHA with version v13-distinct and 10 levels. Do not call a branch build live before that check succeeds. Software-rendered CI does not benchmark the player's GPU; the SDK stub is not a real-ad delivery test.

## Art request and remaining scope
After the playable result, supply separate object-only renders for future mechanics: one object per image, no captions, grids, level screenshots or promotional collages. Pictures are references for new models, not already imported GLBs or images of the running game. The seven previously pending GLBs are not claimed installed. The current playable count is ten, not the planned hundred.
