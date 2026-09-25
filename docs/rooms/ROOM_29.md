# 29 — Небо под ногами

A lilac, sapphire and citrus inverted garden. The floor and ceiling repeat a
recognisable botanical silhouette; the companion can occupy the second version
while the observer remains on ordinary gravity. Four portal surfaces, a visible
companion detector and return shutter, no timers or scripted actor movement.

## Two genuine solutions

* Split route: put the original companion in the lower crystal garden, reverse
  that local force and climb the folded observation promenade. Rising through
  the root ceiling detector opens the solid return shutter. Link the lower
  ceiling to the opposite ceiling pocket. The body emerges into a 1.7 m high
  passage, drifts to its open end under actual force, and settles against the
  receiving crown. Borrow the pair for the ordinary observation/receiving
  portals, cross as the grounded observer, and reverse the crown to reunite.
* Direct garden catch: reverse the receiving crown before releasing the
  companion from the root ceiling. Link the root ceiling directly to the
  garden wall. The downward field catches the same body on the receiving
  garden floor. Borrow the pair for the observer's route and reunite there.

The return panel is physically covered until the free companion enters the
visible ring at the top of the root field. A conduit leads from that detector
to the sliding metal shutter. Carrying the companion around the promenade
leaves the shutter closed, and the ordinary portal shot strikes its solid face.
The promenade reveals different surfaces from different landings. The lower
northern undercroft reconnects around the west end through an ordinary 3.2 m
high passage, so exploration does not require a restart.

## Physical contract

`LabRoom29Gravity` adds forces to the existing Cannon cargo body. Global world
gravity and player acceleration are unchanged. Both fields are finite, bounded,
reversible and visible. The upper force bends laterally within the low passage;
it first cancels vertical drift, then attracts the body to the crown beyond the
passage. A repeated reverse/up sequence is a valid recovery, not a reset.
The detector responds to the same free cargo body inside the reversed root
field. The shutter has a moving collider and opens by physical motion; its
mechanical catch stays set while the portal pair is reused. The catch is
visible and does not participate in the victory predicate.

The ordinary joint-goal predicate requires the grounded observer and original
companion together on the receiving garden at y=9. Nothing sets `won` directly.
Art adds no point lights; crown/leaf shapes are instanced or share geometry.
Directional indicators update only when a switch changes their state.

## Verification

`tests/lab-room29.test.js` drives ordinary walking, looking, portal shots and E
interaction through both complete strategies at 16:9 and 16:10, plus reversed
ceiling recovery and the undercroft loop. It verifies that the carried
promenade attempt hits the shutter and cannot win. All winning routes preserve
the original rigid body without a respawn or cargo reset. Independent campaign
QA owns start-floor visibility and joint-goal checks. WebGL video and published
verification are performed by the campaign release workflow, not claimed by
these Node tests.
