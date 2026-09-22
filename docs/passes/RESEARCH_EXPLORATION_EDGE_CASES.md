# Research chapter: exploration corrections before release

## Off-centre light-sheet placement

The new broad light causeway must fit the actual elliptical portal, rather than
protrude through the opaque rim when the player shoots away from centre. The
research kit opts into transverse interval clipping at both entry and exit.
Both faces of the 14 cm thick sheet are clipped; the visible mesh, floor and
physics bounds use the same interval. These bounds are rebuilt only when the
geometric signature changes. Legacy light-bridge levels keep their existing
behavior; the unchanged room14 route/twist/collision tests remain release gates.

New tests sample 20 aim offsets, 20 full rotations, ellipse boundary points and
an ordinary out-and-back crossing after a displaced source shot. They check the
actual outgoing box corners against the exit aperture. Foot support is checked
against the visible bridge top, which is slightly above the adjoining deck.

## Service portal: floor clearance instead of perfect aim

Native revision f44ba35 rejected the room32 service-return shot at height
2.0987108 m because its 2.1 m half-height reached the physical floor. The panel
is now at 2.4 m. Twelve offset placement checks include ±0.2 m aiming error and
retain the ordinary obstruction rules. The higher turbine aperture is entered
with a normal jump, not a position assignment or disabled floor.

## Returning after selecting the other transmission

An additional input-only reproduction left the original companion on the middle
gallery, selected transmission II and fell to the service floor. The old lower
recall lowered cabin I but left transmission II selected: even with a fully
powered rotor the player could no longer return to the companion.

The recall controls now visibly engage their own transmission as well as
returning the cabin. Their displayed interaction text says so. The same scenario
now walks to the recall, rides back, recovers the original companion, selects II
and completes the room with no resets, respawns or hidden transport. Headless
and dedicated native `RECOVERY=1` routes exercise this independently of the
ordinary powered and disconnected-stored-energy solutions.

Source, normal WebGL, alternate/recovery WebGL, legacy portal and slope checks
run on the final PR SHA. Recording is 15 frames per simulated second, not a
hardware FPS benchmark or a human playtest. No camera #58 fix is included.
