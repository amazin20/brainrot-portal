# Room41 physical ratchet: held contact and bounded native qualification

This isolated candidate starts from accepted camera/pickup source `0e257837ca157d59d29c2e892e9a81e4f21fc5a1`. It carries forward the physical prototype from `b62a8bd0dcdf05080d830843d3a204f82d5453e1` and addresses the two previously observed qualification gaps: a held cargo target stayed about 35 mm above the tray, and fixed compound guard shapes were absent from the legacy swept-cargo list. Historical failures remain evidence of those earlier sources.

The cell is explicitly opt-in through `game.tower41RatchetQualification`. Native qualification uses `?edition=foundation&level=41&debug=1&tower41ratchet=1` and actual Play. It has an isolated save prefix; the original foundation, pilot and finale saves must remain byte-identical. The eleven castle mechanisms and their completion logic retain their normal behavior. Completing this bounded route does not complete room41 or the master campaign.

## Mechanism and exposed loading platform

The original 3.2 kg cargo contacts a 1 kg rack through real Cannon equations. A five-equation guide leaves vertical translation free. Four ConvexPolyhedron teeth engage a 0.12 kg hinged pawl. Actual rack and pawl Springs provide restoring force; the rack has a 1 m stroke. The cell owns four bodies and two five-equation constraints. Its fixed glazing, roof and stops are genuine compound Box shapes.

The tray is now 1.4 × 0.2 × 2.0 m, with its centre 0.3 m towards the loading side. Its front extends 0.6 m beyond the roof and front guards. This exposed part allows the original 2.4 m tall, 0.43 m radius character to stand on the real moving tray. Meshes, Cannon shapes and collision descriptors share the same geometry and live body transforms. No synthetic walkable plane, replacement character or cargo is used.

Force application is once per actual physics step. Owned bodies, constraints, listeners, carry-face descriptors and swept-guard registrations have idempotent cleanup. Cell reset affects its owned mechanism bodies and preserves original cargo identity. The gameplay driver uses ordinary input vectors, keys, jump and native E; measured actor poses, velocity and completion state are observations.

With the pawl physically absent, the enlarged tray returns through its spring to the actual upper stop. The local fixture observes a 0.5903 mm position band and a 0.0708333 m/s one-tick vertical pulse under the continuing 8.5 N net upward force. The test requires real opposing upper-stop impulses, no withdrawn-cargo load, a position band under 2 mm and motion under 1 mm per fixed tick; it does not mistake discrete contact jitter for an exactly stationary body.

## Genuine held top contact

The native cargo carry motor, mass and speed limits remain unchanged. One level-local policy admits physical top contact only on the genuine tagged rack tray, with verified cell ownership, original cargo body, shape, collision masks and current descriptor transform. The desired hand endpoint permits at most 0.5 mm top-face overlap. Side, underside, unowned descriptors, fixed guards and ordinary rooms retain the existing clearance policy. The helper does not write actor pose or velocity.

The ordinary pressure route jumps at the exposed loading edge and descends while holding the original cargo. Contact counts and impulse are derived from actual solved Cannon equations, with preintegration contact points and completed-step binding. Mere geometric overlap is insufficient.

The pre-freeze diagnostic route observed 21 positive held-contact ticks, 1.692722068 N·s downward impulse on the rack and maximum raw cargo/tray penetration 1.008238 mm. After ordinary withdrawal, retained travel was unchanged at 0.463533238 m. A separate 240-tick physical fixture observed 222 positive held-contact ticks and 18.968879810 N·s downward impulse; disabling qualification in the same fixture preserved zero held contact. These are bounded results, not general servo resistance acceptance.

## Fixed compound guard sweep and native release

The cell registers every actual fixed Box shape with `LabPhysics`. The registry is empty in ordinary rooms. Sweeps use the full original cargo Box, actual compound shape offsets and orientations, and previous/current cargo orientations. Translation uses exact separating-axis interval collision time; rotating paths use conservative advancement with an explicit motion bound and ordered refinement. Clear motion does not rewrite the cargo.

Collision response is reported separately from Cannon equations. Corrections include collision time, normal, true contact geometry, normal impulse and velocity before/after native limits. The numerical motion skin is 10 µm. The bounded multi-contact fallback retains the last pose proven clear against every registered guard and reports its use. A fallback is not hidden as an actor reset or fabricated contact equation. Native 22 m/s linear and 18 rad/s angular limits remain enforced with inward-contact velocity checked after limiting.

The ordinary early-E route preserves the actual cargo position, quaternion, linear velocity and angular velocity across native release. It observes all 124 consecutive completed production ticks after release and checks the full oriented cargo against every real fixed guard. Its pre-freeze diagnostic release speed was 4.712548252 m/s, with two swept corrections and zero observed post-production fixed-guard penetration. That release is distinct from the historical approximately 22 m/s failure. Seventeen focused sweep tests cover translation, rotation, corner grazing, compound ownership, masks, initial overlap, native-limit response, multi-guard budgets and true final support. They do not establish every possible high-speed trajectory.

## Real boarding and continuous native evidence

Boarding requires elevated grounded feet supported at the current height and upward normal of the actual rack tray shape. Grounded samples on the floor do not qualify. The pre-freeze ordinary route observed 40 actual tray support samples while the original cargo remained held. The completed mechanism list remained `["freight"]` before and after boarding; the physical rack retained its third shoulder after the preceding free early-E load. No checkpoint, win state or artificial retained-position counter is written.

The source review workflow builds one stamped production package, runs every active regression with an exact frozen TAP count and performs actual WebGL qualification on that same package. Native checks bind original player skins, fifteen-bone rig, cargo visual and physics body, all completed physics steps, contacts, pause/resume, touch emulation, restart/reload and prior save bytes. The separate recorder captures the entire ordinary freight approach and local qualification route at 4 fps, including the real terminal sample, without physical padding or a synthetic win. Movie frame/state/camera ledgers remain part of the evidence.

Only an actual successful source-bound workflow and independently inspected output establish final qualification. The pre-freeze figures above are local diagnostics; exact frozen source, attempt, test footer, package, native observations and video hashes belong in the resulting receipt. This cell does not close whole-room camera framing, human playtesting, physical devices, all boarding/servo attacks, the 500-mechanism campaign, 1,275 camera pairs or the fifteen-minute master route.

## Focused reproduction

```sh
node --test --test-reporter=tap tests/lab-singularity-ratchet-cell.test.js tests/lab-singularity-ratchet-carry-contact.test.js tests/lab-singularity-ratchet-compound-sweep.test.js tests/lab-singularity-ratchet-input.test.js
npm run build
```

The four new `lab-singularity-ratchet*` files contain 27 active tests: four mechanism fixtures, five held-contact fixtures, seventeen compound-sweep fixtures and one complete ordinary-input route. The existing `lab-singularity.test.js` includes the original full eleven-mechanism route with the cell disabled. `npm test` continues to archive only the historical `lab-tower*` fixtures.
