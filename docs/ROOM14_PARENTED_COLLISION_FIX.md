# Room 14: parented staircase collision correction

The targeted 5 October audit reproduced a defect with normal Play and no input.
The counterweight offset stayed at -7.2 m, but its casing's local Y changed from
-4.13 m to -11.33 m on the next physics tick and to -40.13 m by tick five.
The invisible floor proxy also accumulated its rotated parent transform.
Longer ordinary attempts moved these registered solids thousands of metres
away from the visible standing surface.

The staircase already poses all of its meshes through the translated group.
`LabGame.syncCollision` is for a separately positioned world-space proxy; it
writes a world-space centre into `mesh.position`. Calling it on these parented
authored meshes reapplied the parent transform on every tick.

Room 14 now measures each already posed world box, updates its collider bounds
and publishes them to the existing physical body. It does not rewrite the
mesh's local position, scale or rotation. The original staircase geometry,
load rule, floor height, actor identities and input route are preserved.

Two independent regressions failed before the change and passed afterward:

- 30 seconds of normal unloaded simulation followed by three ordinary restarts;
  local poses, visible world bounds, registered physical targets and floor
  heights stay aligned.
- The complete ordinary-input Room 14 route, including actual unloaded,
  loaded and lowering transitions and independent portal delivery of the
  original companion; victory, no resets, no respawns and original body.

The previous successful `3e0205` package does not contain this correction.
The combined candidate must pass the full release workflow and receive a new
Room 14 continuous recording before publication. Finite attack coverage and
software WebGL measurements remain distinct from human and device acceptance.
