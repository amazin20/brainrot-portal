# 29 — Небо под ногами

A lilac, sapphire and citrus inverted garden. The floor and ceiling repeat a
recognisable botanical silhouette; the companion can occupy the second version
while the observer remains on ordinary gravity. Four portal surfaces, no live
weight gates, hidden progress flags, timers or scripted actor movement.

## Two genuine solutions

* Split route: put the original companion in the lower crystal garden, reverse
  that local force and climb the folded observation promenade. Link the lower
  ceiling to the opposite ceiling pocket. The body emerges into a 1.7 m high
  passage, drifts to its open end under actual force, and settles against the
  receiving crown. Borrow the pair for the ordinary observation/receiving
  portals, cross as the grounded observer, and reverse the crown to reunite.
* Carried route: carry the original companion along the longer promenade,
  place it in the broad retaining observation garden, discover the receiving
  portal through the architectural aperture, prepare the human-scale pair,
  retrieve and carry it across. This deliberately accepts a player's longer
  geometric solution instead of adding an arbitrary cargo restriction.

The destination cannot be addressed from the starting floor: the wall and
receiving deck obstruct those rays. The promenade reveals different surfaces
from different landings. The lower northern undercroft reconnects around the
west end through an ordinary 3.2 m high passage, so exploration does not require
a restart. There is no implication that the ceiling method is a mandatory
secret checklist.

## Physical contract

`LabRoom29Gravity` adds forces to the existing Cannon cargo body. Global world
gravity and player acceleration are unchanged. Both fields are finite, bounded,
reversible and visible. The upper force bends laterally within the low passage;
it first cancels vertical drift, then attracts the body to the crown beyond the
passage. A repeated reverse/up sequence is a valid recovery, not a reset.

The ordinary joint-goal predicate requires the grounded observer and original
companion together on the receiving garden at y=9. Nothing sets `won` directly.
Art adds no point lights; crown/leaf shapes are instanced or share geometry.
Directional indicators update only when a switch changes their state.

## Verification

`tests/lab-room29.test.js` drives ordinary walking, looking, portal shots and E
interaction through both complete strategies at 16:9 and 16:10, plus reversed
ceiling recovery and the undercroft loop. It preserves the original rigid body
and rejects any respawn/cargo reset. Independent campaign QA owns start-floor
visibility and joint-goal checks. WebGL video and published verification are
performed by the campaign release workflow, not claimed by these Node tests.
