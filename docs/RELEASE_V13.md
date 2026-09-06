# V13 — replace repetition with five different physical puzzles

Base: main 79fd1715 (V12). The user explicitly rejected concatenated old stages. The entire extended campaign and its solution driver are replaced, not lengthened. The first five layouts and approved player/companion assets are retained.

## Independent concepts and spaces
6. Перекрёстный свет: an optical workshop with a low service window. Reach a mirror control via a temporary portal route, then repurpose the pair to carry a beam through space and reflect it into a sensor. The ray is actually traced through portal transforms and a reflecting plane; breaking the beam closes the door.
7. Точка опоры: an open pit crossed by a long rotating balance beam. A movable counterweight, the companion's distance from the fulcrum and the player's own weight affect gravity torque. After reaching the fixed high gallery, retrieve the load through a portal. Rotation is a damped one-degree-of-freedom spring/torque model; cargo collision is an oriented physical box, and foot support samples the same tilted plane.
8. Ветер за углом: a tall pneumatic column. A reversible on/off blower provides continuous acceleration that can be redirected through portals into an updraft. Exit the stream sideways onto a high gallery. There is no lift deck or scripted launch impulse. Closed glass transmits light but blocks airflow.
9. Работа удара: a loading table and long covered roller conveyor opposite a low impact channel. Redirect the accelerated companion through portals into a real dynamic piston. Collision momentum compresses its restoring spring far enough to engage a visible ratchet; the channel cover then opens for retrieval. Gentle contacts do not latch it. Conveyor rollers, cover, pawl and piston are animated functional components.
10. Векторный сейф: an upper observation ring around a low glass-covered maze. A terminal changes the direction of a continuous force on the loose companion. Navigate offset corridors, then use the open extraction well and a prepared portal pair to receive the same companion on the upper gallery. Glass blocks hands and portal shots. A receiving cradle contains the exit motion.

Shared code is confined to geometry, contacts, ray transforms and actuator primitives. There is no old gate/lift/fling stage composition and no mechanism-use checklist attached to victory. Legitimate alternate physical solutions remain allowed. These new devices are procedural geometry integrated into the game, not a claim to have installed the previously pending additional GLBs.

## Pressure plate repair
Load detection now projects the oriented companion footprint onto the real moving inset's tangent plane, using its load bounds rather than the smaller portal-safe rectangle or a radius around the centre. The top responds at its corners and edges. Held loads, hovering bodies and non-overlapping stationary frame positions do not activate it. Existing free teaching remains separate from optional solution hints.

## Verification
Local source before browser review: 256 passing unit tests, all ten ordinary-control physical routes without respawns or companion resets. New tests cover nine positions across the original pressure inset, release at a corner, rotated cargo, optical transport/reflection, glass versus air, signed lever moments, rotated support, sustained airflow, weak/strong piston collisions, field forces and blocked pickup through the cover.

Bounded negative audit: 108 no-power jump trials on the new optical/air/impact obstacles, 45 through-cover grab probes, 12 weak impacts, 9 wrong balance arrangements. Existing 180 introductory jump trials remain. These checks are not an exhaustive proof against all possible exploits, nor a human assessment of puzzle difficulty.

The GitHub Chromium run must additionally complete all ten routes, the actual level-menu loop, settings/audio persistence and the Yandex SDK callback stub. Gameplay milestone screenshots and walking frames are stored as evidence. A local build or a branch commit is not a live release. Pages must confirm the exact deployed SHA and version v13-distinct before claiming publication. CI software rendering does not benchmark player GPU FPS; SDK stubs are not live ad delivery verification.

## Art request
After the playable result, supply separate object-only renders for future mechanics: one object per image, no captions, grids, level screenshots or promotional collages. These pictures are visual references, not already imported GLB assets. Do not present generated pictures as images of this running build.
