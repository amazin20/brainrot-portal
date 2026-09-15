# Room 21 R2 — actual preparation, not an extra walk

Base: public v37 `c24f3dca6129283f6f0335bfa05cc644cf139942`. Responds to issue #32 and the user's rejected level. This is a redesigned **development candidate**, not an accepted puzzle. Original rooms 1–20, common physics/controllers, original character files and dependency lockfile remain unchanged.

## Revised spatial contract

The shaft remains the shared transport resource. A west pneumatic wing and a separate north return bay replace the freely accessible upper staircase and immediate goal. The footprint is 52 × 47 game metres, compared with 42 × 34 in the rejected room. The extra space is not itself evidence of complexity.

1. Route air through the only portal pair to the source-carriage drive. The carriage really changes height; the same moving portal surface travels with it.
2. Apply the ordinary mechanical brake to retain its actual position without the power pair. Releasing it without power lets the counterweighted actuator descend. The brake is not an automatically awarded visited-location flag.
3. Independently deliver the same free companion through the low freight throat. This retracts the high guard but lowers the north bridge through the same opposing load linkage. Stages 1–2 and stage 3 work in either order.
4. Reuse the central well to reach the retained high source. Change the exit direction and use the greater fall to reach the permanent east niche.
5. Operate the service hood from the far side to expose the cargo floor. Standing on permanent support now makes it safe to reuse both portals for extraction.
6. Removing the original load reverses the linkage and restores the north bridge. Carry the same companion across to the joint exit.

There is no win checklist. `Workshop.finish().isWon` remains the spatial joint-arrival check. The new lift/hood/bridge use the existing guided-kinematic actuator abstraction, not a claim of a complete multibody gearbox or energy-conserving motor simulation. Air is traced through actual portal frames and opaque occluders and affects player/free cargo with the existing fan field. No scripted teleport speed is added.

## Shortcut handling

Floor portals remain legal on the freight pad. Visibility of a pad through the freight throat is not itself a bug. The closed hood must prevent a vertical floor exit from becoming a high route. The original low hood prototype was invalid: a carried exit already overlapped its underside and the collision solver ejected the traveller sideways. Its internal height was increased so the traveller is fully below the roof after transfer and makes a real upward ceiling contact. This is not an invisible portal ban or a new global collision rule.

Twelve explicit carried high-fall contact fixtures exercise four pad positions and three longitudinal positions, including steering toward the niche. They initialize actor poses and portals directly and are **not** player playthroughs. A failure to place a portal or to transfer is not counted as a successful bypass rejection. These cases are finite, not proof that no alternative exists. Eighty-one further contact fixtures check the prepared carriage, inclined outlet and horizontal outlet, with transverse speed and landing-target variations. Each must place legal portals and actually transfer the carried pair. Source/hood reachability checks supplement them. These are still finite fixtures, not an exhaustive reachability proof.

## Recovery and visual work

The lower court stays connected. The known short-flight failure and portal deletion recover by normal walking while the load and retained source persist. The independent source can be lowered and repowered after an incorrect brake setting. New sibling visual assemblies show the travelling service hood, segmented shells, beams, gantry, carriage, brake lever and bridge underframe without changing their collider bounds.

Existing room21 offset, freight, joint-victory and aperture regressions are retained or adapted where the deliberately replaced upper stair/goal made the old route obsolete. No checks for rooms 1–20 are removed. The review workflow runs source tests and three complete ordinary routes in real WebGL, retaining milestone screenshots; those screenshots are not a full 30fps video.

## Still required for acceptance

Inspect the new native browser images, review all source-test results, add broader early portal combinations and error recoveries as needed, record complete candidate videos, and run blind human playtests. The requested 8–15 minute first solution is unmeasured. Do not infer it from the known-solution route length. The already known inclined-exit camera framing issue is not claimed fixed. Do not mark issue #32 closed merely because selected trajectories are contained. Do not publish this candidate automatically in place of the rejected demo.

The additional floor-to-wall access exposed a nonconvergent aiming heuristic in the test driver at two offset starts. The room-local journey now acquires that target with bounded yaw/pitch input and checks convergence before firing. It never assigns the camera pose or portal placement and does not change player camera code. An art-bounds assertion permits only 1e-8 coordinate-roundoff tolerance under pure translation.
