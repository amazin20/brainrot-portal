# 28 — Обсерватория приливов

Two equal-area basins share six metres of initial water head: west 6, east 0.
The clear turquoise water is safe; the common foundation catches every fall.
The moving islands carry the original free companion with ordinary collision.
No stage, completion flag, timed race or cargo replacement is used.

The portals change the hydraulic circuit itself. The bottom of each actual
placed aperture determines its sill. A low-to-low connection stops at equal
hydrostatic heads; a high receiving aperture discharges freely until the source
dries. Positioning a portal a little higher changes the final level a little.
The closed-form flow integration stops exactly at submersion/equilibrium and
keeps the combined volume constant regardless of update duration. Breaking the
pair retains both existing tides.

## Two solutions

* **Equal-tide garden:** connect the two low collectors. Both floating islands
  meet the three-metre garden. Cross the low arch to the west island, then
  replace the western low collector with its high inner outlet. Eastern water
  returns under the occupied west island and lifts both travellers to the exit.
* **Full-tide observatory:** connect west low to east high. Almost the entire
  volume enters the east basin, meeting the 5.3-metre observatory instead of the
  lower garden. Its separate northern promenade descends to the garden. From
  there, change the east collector to low, meet the equal tide and return via
  the coral island. This uses different portal assignments, water levels and
  a physically distinct exploration loop.

The outside western overflow is a visible recovery option: after falling off
the garden, drain the eastern tide through it, retain the new levels by clearing
the pair, and board again from the low landing. Portals can then refill the east
island without resetting the room or losing the friend.

## Legibility and physical restrictions

Ivory ceramics are the five real portal surfaces. Low collectors are visibly
ribbed plumbing mouths: a broad shooting slot admits portal shots, while solid
horizontal ribs exclude the standing capsule. This prevents direct portal
traversal from replacing the water puzzle. Early sightlines to the inner high
outlet are allowed where geometry permits; the initial dry east basin has no
water to send, and the elevated goal still requires boarding the island.

The default campaign room now labels the **A coral well** and **B lagoon** at
their separate collectors. Real manifold pipes run behind those apertures and
join their own basin, without blocking the white shooting faces or changing the
hydraulic simulation. Two freestanding instruments have physical housings,
live rising columns and 0, 3 and 5.3 metre marks. A shared meter shows that
the two heights always total six units, the actual direction of flow, and the
reason an experiment has stopped (broken connection, same basin, dry mouth or
equal pressure). A small transparent current appears at the actual receiving
portal only while water moves. The player can compare the height of the middle
garden with the observatory, try either collector and infer which connection
reaches each landing. These instruments explain cause and effect in the room;
they neither prescribe a portal placement nor set any completion state.
After native screenshot review, the shared meter is mounted on the visible
rear wall above the crossing, and each basin has an additional live meter and
waterline beside its upper collector. The original perimeter gauges remain for
close inspection. All read from the same conserved simulation; no screen or
waterline is a fabricated progress marker. The upper collectors, status boards
and narrow pipework have separate physical clearances from the white shooting
faces and the walking route.

Coral crowns identify the west well; golden and cobalt armillary rings mark the
upper optional route. Broad aquamarine slab foundations give the walking islands
visible thickness. Two transparent equal-sized water volumes and the actual
changing pontoon heights expose what each experiment does. Static decorations
are merged into five material batches, with no new light or texture.

## Verification

`tests/lab-room28-tides.test.js` checks conservation, physical equilibrium,
disconnection, frame-rate independence, and eight input-driven routes: two
solutions, interrupted flow and a recovered fall, each at 16:10 and 16:9.
Each route checks the same original companion body, free cargo riding both
moving floors, physical joint arrival and zero resets/respawns. The same tests
now verify that the visible gauges follow the actual volume and the in-world
status distinguishes reverse flow, equal pressure and a dry collector.

Motion review milestones:

* `the collector opens and the lagoon begins to rise`
* `the east gauge and receiving current show the moving tide`
* `the occupied coral island begins its return tide`

The new middle marker uses ordinary player looking after the receiving shot
while the original six-unit tide is still moving. The other two markers occur
before their final shots; continuing capture through subsequent frames records
the actual mechanism in motion. No actor or camera position is staged.
