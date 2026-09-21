# 27 — Город обратных лент

The room is a bright kinetic carnival, not a powered-lift progression. Saffron
frames and turquoise roller belts wind beneath pink barrel canopies. A blue
structural street overlooks a safe common plaza; an asymmetric pink marquee
identifies the remote destination throughout the puzzle.

## Physical idea

The two conveyor decks apply finite tangential contact traction to the real
player velocity and to the original Cannon companion body. There is no force
in air or on adjacent floors. A shared reversible transmission and brake are
accessible on both storeys. Braking a belt leaves normal walking friction;
it does not freeze either actor. No actor is attached to a belt or assigned a
position, portal velocity, progress stage or completion flag.

The lower wall address receives the belt's horizontal speed. An up-facing
ground ceramic turns that speed into a vertical launch. The side balcony is
wide and permanent: the player can retain height before borrowing the pair.
A folded observation stair reveals the reverse side of a high wall address.
The final island has no portal ceramic and cannot be reached by walking into
the high outlet at ordinary speed.

## Two valid routes

1. **Motor route.** Carry the companion through the first ascent, leave it on
   the permanent balcony, inspect the upper return, address the high outlet,
   then reuse the upper belt intake. Retrieve the companion and let the belt
   provide the momentum needed to cross the final gap.
2. **Gravity route.** Carry the companion up the observation stair. The rear
   street overlooks the low white post; the hood reveals the high outlet.
   The quiet western observation spur supplies a sixteen-metre fall into the
   low address; gravitational momentum replaces the second conveyor motor.

The two low inspection loops are freely accessible. Neither reversing the
transmission nor exploring the upper loop commits the player to a route.
The lower plaza catches both actors after mistakes. The existing portal pair
can repeat the first ascent without resetting the room or replacing cargo.

## Validation

`tests/lab-room27.test.js` uses the production journey driver and original
uploaded models. Both complete routes run at 1280:800 and 16:9 camera aspects.
The recovery route deliberately leaves the first balcony, returns to the
plaza, and reuses the same pair. Separate tests exercise live free-cargo belt
contact, reversal, braking, airborne exclusion and side-floor exclusion.
These are simulation checks; native WebGL publication checks remain separate.

Useful native capture markers are `ready to ride the saffron belt into the
sky well` and `ready for the upper conveyor crossing`.

Only existing uploaded asset IDs 1, 2, 11, 22, 23 and 24 are required. Repeated
supports, rollers, moving slats and transmission drums use instancing. Portal
frames, floor records and original companion-body identity remain unchanged.
