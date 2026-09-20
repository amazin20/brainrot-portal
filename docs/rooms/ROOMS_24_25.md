# Rooms 24 and 25 — ordinary campaign puzzles

These are permanent campaign rooms, not speed-mode stages. Both use the
original dynamic companion, ordinary portal shots/carry/movement, production
colliders, and `Workshop.finish`'s joint grounded arrival predicate. No collected
stage bits or hidden win checklist unlock the exit.

## 24 — Обратное давление

The compressor at the low court feeds a separate reservoir only when its real
portal-traced air ray reaches the round receiver. Pressure is bounded, leaks,
and is consumed by actual cylinder/ferry displacement. A closed cylinder valve
holds its current extension; closing it never creates air or movement.

The first ascent reveals a folded service gallery. Isolating the raised
cylinder retains that access while the same pair is borrowed for cargo. A
separate observation arm looks down into the glass chamber. The companion
falls through the chamber's floor portal and emerges into the upper freight
pocket. Opening the crossing valve then spends the reservoir on the real
moving ferry. The friend may ride that ferry freely, without being held.

Four ceramic surfaces each have one clear physical role: source capture,
reservoir delivery, chamber extraction, and upper freight reception. The
freight receiver faces sideways behind a solid baffle; no valid standing/jump
shot from the lower court can skip the first ascent. The lower court catches
falls, and the low recall control can vent/return the first cylinder.

Verification:

- Complete production-input route, no resets or respawns, same cargo body.
- Source deliberately interrupted and restored through ordinary shots.
- Sixty-second pause after the pair is borrowed; isolated lift stays raised
  and the stored air still completes the loaded crossing.
- Finite pressure accounting: zero pressure without feed; charging, leakage,
  and displacement expenditure; no negative pressure.
- Independent early sightline/bypass scan in the campaign QA suite.

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
- Real interruption/restoration of the second optical circuit, then finish.
- With the counterweight empty, a complete source/relay portal pair terminates
  on the first opaque shutter and leaves the first lift at its lower stop.
- Shutter mesh and production collision boxes agree after repeated resets.
- Independent lower-floor and first-gallery sightline/bypass scans.
- Intended receiver shots pass all 25 camera/muzzle samples over ±0.30 m;
  the final home panel is raised to centre that usable aim window.

## Presentation and runtime cost

The rooms reuse shipped models/materials. Room24 has the existing compressor
and freight-deck assets; it does not layer a second generic lift chassis over
them. Room25 has two optical lift models and one optical source. Fixed geometry
is ordinary instanced architecture. Neither room creates a full-screen effect,
particle swarm, additional render pass, or a recurring GLB load.

`LabRoom24Journey.js` and `LabRoom25Journey.js` are input-only route modules.
Passing routes never assign actor transforms, body velocity, mechanism state,
portal placement, or win state directly. Their controls are ordinary `E`,
portal fire requests, walking, camera input, and simulation time.
