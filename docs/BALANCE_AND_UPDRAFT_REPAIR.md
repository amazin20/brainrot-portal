# Balance and updraft model repair

Based on published main `037b7a9fd1cf6a52588711d648dc4d1bae121977`, not on the older `228accb2` demo. PR13 is merged and its full deploy/public-browser run 34134601153 succeeded. It already includes the stable grip, wall recovery, automatic physical wind in room11, wandering companion, travelling portal shots and removal of F/X controls. Do not report these as missing simply because an earlier chat response failed to track publication.

## Room 7: actual defect

The old source set model34 scale to `(22, .9/.3707, 3.8/.2665)`. It squeezed its vertical shape while greatly stretching its length and width. It trusted the derivative's `Moving` name, which contained only the high end of an already tilted scanned lever; the opposite end remained in `Frame`. The visible art and hidden rectangular physics deck were at different heights. Browser evidence from the previous build shows the player visibly intersecting the high end tray.

The correction reclassifies the full supplied beam and both trays into one rigid assembly, with the stationary stand/bearing cheeks fixed. It removes the scan's initial tilt once, then rotates about the measured bearing. The supplied mesh uses one uniform scale. Every one of the 4198 source triangles is retained with its attributes/material, and per-triangle area checks verify the absence of anisotropic deformation. Source GLBs and cached meshes are not overwritten.

A visible structural deck is mounted above the narrow source beam on crossmembers. The visible deck itself is also the walkable physical shape. It is not another invisible floor under protruding art. The supporting plane, load-contact frame and portal-bearing surface use the same offset from the true pivot. The counterweight is visible beside the deck on a rail. The base stands on a shallow plinth at the chamber floor.

The stand's shape tapers. A single AABB would introduce an invisible wall above its broad foot and block return across the lowered beam; collision proxies now follow clipped horizontal bands instead. Both directions of the normal route pass without new jumps or scripted teleports. The enclosed final dock and anti-bypass geometry are retained; no hidden mechanism-use victory condition is added.

## Room 8: actual defect

The fan used the old wrong-part partition, faced away from its force and floated above the ground. It now reuses the already reviewed front-impeller partition from room11, stands on its feet inside the room and emits from its physical front. Rim, casing and feet remain fixed. The rotor accelerates/coasts on simulation time and resets fully.

The solid line/dots are replaced by the existing soft portal-traced airflow. The updraft continues to apply the established sustained physical force to the player and free companion. Its on/off control and puzzle rule are retained; this pass does not add another mechanic or alter the other eighteen room definitions.

## Verification

Local source result: 319 unit tests and production build pass. All 20 ordinary-control physical routes pass. The existing audits report 180 introductory negative cases plus 372 full-world workshop trials (216 are repeated-jump/counterweight variants for room7), with no tested bypass. Ferry recovery passes with the same companion. The carry-video reproduction passes at 30/60/144 Hz without release/reset; maximum hand error about 2.23 cm in these cases.

Seven new model/contact tests cover uniform triangle preservation, both moving ends and stationary stand, visual/physical support-plane agreement at five angles, safe tapered collisions, fan orientation/grounding/reset and switching/route regression. The existing full Chromium, video-repair, menus/audio and SDK-stub gates must also pass before merging. Public deployment must confirm the exact commit and live game. No extra browser workflow or disabled check is required.

## Still separate work

Comprehensive visual redesign of rooms9–10, a new complete player locomotion/emotion set and the third-person portal-lens transition are not completed by this patch. Twenty levels remain, not more. Finite fixtures and rendered samples do not prove universal bug freedom, subjective quality or performance on the player's GPU.
