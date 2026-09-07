# Video regression repair — first core delivery

Base: public `228accb2`. Keeps all twenty existing levels, all source GLBs, source textures and character rigs. This is NOT a declaration that room 7–10 art or the camera-crossing presentation has been rebuilt.

## Reproduced user recording failures

The old holding spring allowed the physical friend to lag the hand point by 1.60–1.66 metres during sprint/jump/rapid-turn fixtures. The held flag was still true; the arms could not reach it, so it visually fell out. A second flaw was single-centre-ray wall clamping, which ignored rotated box corners. An established carry now follows an endpoint velocity constraint, with a gradual pickup onset, a volume-constrained target and modest elbow clearance alongside tall walls. Contacts still run on the same dynamic mass; there is no per-frame parenting or replacement body. A swept inscribed-volume guard catches thin-static-wall tunnelling after the solver, respecting disabled portal backing walls and leaving sloped/moving surfaces to their real collision shapes. Only explicit interaction releases the grip.

A toppled box beside a wall repeatedly attempted to roll into the same obstruction. Recovery now includes a force-driven clearance shuffle, followed by standing torque, with short support-contact grace. No room reset or teleport is used for that repair. The explicit restart and actual out-of-world fall policy are not silently removed.

## Wind and autonomy

Room 11 uses the same finite blocked/portal-transformed air path for rendering, body forces and the receiving drive. It pushes the player and the free friend; carried weight moves with the player. The round model remains the source and the louvred model the receiver. The second console is removed; receiving air automatically drives the existing work latch and door. Trails have the width of the operative stream rather than a thin centre wire. A brief brace/startle response accompanies actual wind exposure.

Workshop rooms erroneously returned `cargoOnAnyPad() === true` everywhere, freezing all wandering. Now only actual loaded pads/platforms or a working crane restrain the companion. A seeded sequence picks new walking directions inside a safe 3.2 m area, with cliff/wall probes. The crane's starting cradle and loaded mechanisms retain stay behaviour so autonomy does not sabotage a puzzle. Existing head/tail/foot motion gains movement/recovery cues; this is not a facial-expression/mocap replacement.

## Visible portal firing

Mouse/touch shots request a brief turn-and-raise pose, then a visible charge from the actual animated muzzle. The charge travels on the simulation clock, sweep-tests current objects, and opens a portal only after a valid hit. Invalid surfaces receive an impact effect while the previous pair remains. A wall between shoulder and muzzle constrains the shot to its near side. Effects use fixed pools, reset fully and do not progress just because a portal camera renders. The camera does not enter a zoom/aim mode. Player F and X actions and touch aim/clear buttons are removed. Geometric unit tests retain direct placement; the full ordinary-control journeys now use real delayed firing, without debug aim.

The stronger honest grip exposed a room-9 hand-press bypass missed by the old spring. Its visible open-top protective enclosure now covers all four sides and retracts after the actual piston latches, allowing recovery of the same friend. No hidden portal-use completion condition was added.

## Verification boundary

Run `npm run check`, `scripts/v8-journey.mjs`, `scripts/v10-shortcuts.mjs`, `scripts/v17-audit.mjs`, `scripts/v17-recovery.mjs`, and `scripts/video-repro.mjs`. New tests explicitly cover the recorded jump/turn grip, wall/corner pushes, standing beside a wall, thin walls, disabled portal backing, real wind, invalid shots, muzzle occlusion, queues/reset and automatic door. The focused Chromium script renders the actual production models and firing/grip sequences; the unchanged full suite still checks all twenty routes and menus/SDK callbacks. These are finite fixtures and reviewed rendered samples, not a proof that the whole game is flawless, a user-GPU FPS measurement or an estimate of human puzzle-solving time.

## Still requires separate visual redesign

The distorted balance geometry in room 7, comprehensive art/animation rework of rooms 8–10, a new complete walk/jump animation set, and the third-person portal-lens transition remain separate work. This patch does not mask them with extra levels or substitute screenshots for a live release.
