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

## Audited golden contract after the correction

The full source suite on `1c804ce1c3abe401ec122dded23917e384ada2a8` exposed a
stale Room 14 physical/art golden in
`tests/fixtures/early-art-v35-contract.json`. That fixture deliberately hashes
the entire rounded `gameplayContract`, including the world matrices used by
collision, camera and aim registries. It is not merely an image or triangle
count. The pinned old digest had preserved the already corrupted initial mesh
poses produced by the old parented `syncCollision` call.

An isolated runtime replay of that exact old call from `3e0205ebe41804f71eab6792e5d220795fc1028e`,
during ordinary zero-time initialization of the same current game, reproduced
the former golden exactly. No actor pose, mechanism state, portal, source mesh
or victory was assigned. The unchanged production initialization with the
correction yields the new digest:

| Contract | SHA256 |
| --- | --- |
| Old parented proxy synchronization | `6df82b170862362798d6d302e61b792f4422aa85b4d2e15f456c2525d520b51c` |
| Correct authored local poses | `86108a1859f9d7e532d20462c91915355fda34565fa266b3c4fb6503311e84e2` |

The semantic comparison contains exactly 168 changed numeric leaves, all
world-matrix translation entries. They belong to the same 28 staircase meshes:
fourteen `Folded stair / collision` floor proxies change their XYZ translations,
and fourteen unnamed tread casings change only Y. The casings regain precisely
7.2 m lost to the duplicated parent translation. The same objects appear in
three registries, hence the repeated changes: `colliders[53..80].mesh.matrix`,
`camera[81..108].matrix`, and `aim[81..108].matrix`, indices 12 through 14 only.
For example, the first floor proxy changes from `[-3, -2.795, -3.555]` to
`[-1.5, 0.33, -3.225]`; its casing changes from `[-1.5, -7.12, -3.225]` to
`[-1.5, 0.08, -3.225]`.

All initial collider boxes remain exactly equal: the old synchronizer copied
the measured world bounds before wrongly rewriting the mesh's local position.
The corrected meshes now agree with those intended boxes; the existing
long-idle and complete-route regressions additionally check agreement through
subsequent physics steps. Registry lengths and order, enabled/kinematic flags,
matrix rotation/scale entries, visible portal matrices and frames, floor heights,
goal/spawn positions, allowed orders, pads, terminals, state, actor positions and
victory state are unchanged. All nineteen other room digests in this fixture
also still match. Only the Room 14 `contract` value is updated; workload budgets,
route audit metadata, absent-panel assertions and every other golden are retained.

The existing contract test still compares the complete exact digest, checks
both allowed orders, keeps the artwork budgets and proves that applying the art
finish twice leaves gameplay unchanged. The update therefore accepts this
documented physical correction without weakening the future geometry guard.
