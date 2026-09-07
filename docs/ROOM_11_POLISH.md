# One-room polish — stop expansion

The next delivery is deliberately confined to the existing room 11, **Запас ветра**. No new levels, model dependencies or physical puzzle mechanics. The other nineteen rooms are retained, not declared polished. Original uploaded GLBs remain byte-for-byte unchanged.

## Concrete problems found in the old room

- The front view was dominated by the dark reverse of a free-standing portal billboard, obscuring the receiver and exit.
- Wall panels floated metres inside the outer shell; the two right-hand areas overlapped.
- The wind-generator model was used backwards as a blower: air emerged from its closed motor cap. The separate louvred device was used as a flywheel and floated above the floor.
- The derivative's generic `Moving` partition selected the back of the generator rather than its visible front impeller.
- A loose reel and a floating progress stick had no legible physical purpose. Control names talked about raising a shutter, although the actual door swung open.

## Limited correction

Existing model 35 is a grounded louvred blower, with a stationary grille. Existing model 31 is a grounded wind receiver, with its open front facing the arriving air. Its front impeller is re-partitioned from the same triangles at runtime: housing, feet and rear cap stay still, no triangles or source material attributes are removed. The rear is no longer animated as if it were the impeller. Air intake requires the front disc, not an arbitrary nearby point or the back of the housing.

The single puzzle still uses the existing portal-routed air, flywheel inertia, clutch, useful-work threshold, latch and hinged door. A visible cable associates the receiver and the exit. The unrelated reel and floating progress stick are removed from this room. Controls sit by their machines and state the next action in the existing lower-screen prompt. The locked door is visible on entry; lamps distinguish locked and open states. No wall instructions, centre-screen text, extra counters or force-vector graphics were added.

Four broad portal work areas and a fifth smaller area sit flush on the perimeter walls with no overlap, allowing free placement rather than exactly two sockets. The internal billboard is gone. No portal surface extends past the locked exit partition. Existing materials have been adjusted only in this room; the character rigs and the rest of the campaign are untouched.

## Checks

`tests/lab-wind-room.test.js` checks source-preserving articulation, floor placement, grille/air alignment, panel overlap/attachment, entry-to-door visibility, directional/occluded airflow, unpowered controls, restart and the ordinary-control route. The complete existing suite, twenty physical routes and negative/recovery checks remain required. `scripts/room-polish-browser.mjs` captures actual in-room views and six real rotor frames during the ordinary-control solution; it does not use rooftop overview shots as visual evidence.

This is a correction to one room, not a claim that the campaign is now visually finished or that the user must review all twenty rooms. Mechanical test success does not establish human readability or enjoyment. New content stays paused while this limited slice is brought into order.

Final visual inspection also caught painted intake-rim facets in the radial rotor selection. The painted outer rim remains fixed; the impeller and central hub rotate. A dedicated regression retains that separation. Both machine fronts now face the player’s working aisle, and the starting camera has clearance from the rear wall.
