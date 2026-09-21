# Rooms 24 and 25 — ordinary campaign puzzles

These are permanent campaign rooms, not speed-mode stages. Both use the
original dynamic companion, ordinary portal shots/carry/movement, production
colliders, and `Workshop.finish`'s joint grounded arrival predicate. No collected
stage bits or hidden win checklist unlock the exit.

## 24 — Сад поворотных дверей (redesigned)

The old pressure reservoir, compressor and ferry have been removed. This is
an open-sky garden with coral, mint and gold courtyard walls, topiary,
a freestanding stair/pergola and a gold receiving pavilion. The central
ceramic door orbits around an offset hinge: a quarter turn moves the same
physical portal eight metres behind the courtyard divider and rotates its
outward direction by ninety degrees. The visible overhead arm and ground
orbit inlay explain the architectural motion.

There are two materially different portal strategies:

- **Carry through the balcony.** Enter the unturned door with the original
  friend, park them in the south balcony, discover its manual worm drive,
  move the entrance portal onto that balcony, turn the retained exit around
  the corner, and carry the friend directly into the west conservatory.
- **Use the live counterweight.** Leave the original friend on the lower
  garden planter. Their real weight turns the door. Enter the west courtyard,
  engage its brake, and use the observation branch to replace the entrance
  with a portal beneath the original weight. The friend emerges through the
  same moving ceramic, while the real brake holds the unloaded door.

These are alternative solutions, not different orders of the same checklist.
The west court branches towards the planter observation window and the
folded stair. Its reverse pergola gives a comfortable view of the pavilion's
ceramic face, which is physically hidden from the lower recovery court.
The final receiver has a broad 6.4 by 5 metre face. Shallow planter kerbs
retain a loose companion on both working balconies without altering physics.

Every state is a physical actuator condition (door angle, loaded planter,
manual drive and brake). Joint grounded arrival of the same dynamic companion
is sufficient for completion; no visited-room or solved-stage bits exist.
Deleting the pair is recoverable from the permanent west gallery. If the
player also falls, the low release handwheel disengages the drive and brake:
the unloaded door returns to its original visible face and can be reached
again through normal portal placement. There are no respawn checkpoints.

Verification in `tests/lab-room24-garden.test.js`:

- Both full strategies at 16:9 and 1.6, using production movement, camera,
  interaction, projectiles and portal traversal, with the original body.
- A portal keeps its frame identity through the complete eight-metre orbit.
- Erased-pair recovery and a separate fall plus erased-pair recovery route.
- Brake arrest, reversal, repeated reset and moving collision alignment.
- No overlapping coplanar floor footprints.
- The independent campaign QA suite scans early floor and jump sightlines.

## 25 — Обратная сторона тени

A loaded floor counterweight moves two opposed opaque shutters. Their actual
kinematic boxes, not a selected receiver ID, occlude the portal-traced source.
Weight clears the first optical motor and obstructs the second. Retrieving
the original companion through the plate reverses both shutters.

The first lift leads to a permanent gallery. The inspection arm provides a
new view of the counterweight; the sideways freight receiver retains the
companion after power is lost. With the weight removed, the same source is
routed through a second relay to the higher lift. Both travellers reach the
18-metre overlook. An open inspection prow exposes the back of the start
through a 1.35-metre sight slit; an ordinary portal traversal returns both to
the recessed home chamber.

The middle receiver, upper return entrance, and home panel are recessed or
screened so lower galleries cannot skip their associated ascent. The home
slit admits shots but is shorter than the player capsule. The inspection prow
keeps the camera and muzzle clear of the return hood during the intended shot.

Verification:

- Weight-first and source-first input routes, both retaining the same body.
- Full routes at 16:9 and 1.6 aspect ratios. The first relay is sighted
  from the car's rear-left quarter, clear of its real front guide column.
- Real interruption/restoration of the second optical circuit, then finish.
- With the counterweight empty, a complete source/relay portal pair terminates
  on the first opaque shutter and leaves the first lift at its lower stop.
- Shutter mesh and production collision boxes agree after repeated resets.
- Independent lower-floor and first-gallery sightline/bypass scans.
- Intended receiver shots pass all 25 camera/muzzle samples over ±0.30 m;
  the final home panel is raised to centre that usable aim window.

## Presentation and runtime cost

The rooms reuse shipped models/materials. Room24 uses the shipped architectural modules with a lightweight articulated
ceramic door and shared low-poly topiary geometry; it adds no model downloads. Room25 has two optical lift models and one optical source. Fixed geometry
is ordinary instanced architecture. Neither room creates a full-screen effect,
particle swarm, additional render pass, or a recurring GLB load.

`LabRoom24Journey.js` and `LabRoom25Journey.js` are input-only route modules.
Passing routes never assign actor transforms, body velocity, mechanism state,
portal placement, or win state directly. Their controls are ordinary `E`,
portal fire requests, walking, camera input, and simulation time.
