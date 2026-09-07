# Current player-recording regression scope

The current user recording is 54.44 seconds, from room 11 at revision 228accb2. This note records the newly reported defects; it does not claim any of them fixed or any tests passed.

Immediate priorities:
1. Reproduce combined repeated jumping and rapid yaw while carrying the original companion. Check both physical grip and visible hand contact, not merely body identity.
2. Reproduce pinning the companion against a wall, releasing it and moving away. Check stand-up clearance, swept collision, absence of tunnelling and no whole-room reset.
3. Room 11: the round fan remains the source and the louvred drive remains the receiver. Actual traced airflow must push the player and loose companion. Receiving air must operate the door automatically; remove the unnecessary second console and its collider, not only its text.

Follow-up scope, not yet delivered: inspect the level-7 seesaw source/pivot and rooms 8–10, improve autonomous companion movement and expressions, add visible short-flight portal charges and invalid-surface impact, remove aim/clear-pair input buttons, and investigate camera/actor/portal clipping discontinuities.

Keep the accepted character and source meshes, room-11 layout and soft airflow. Do not expand level count while repairing these reported regressions. Run ordinary-input reproductions and visual review in addition to happy-path routes. Never label unexecuted or failed checks as a verified release.
