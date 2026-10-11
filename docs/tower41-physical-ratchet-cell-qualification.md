# First physical room41 ratchet cell: bounded prototype qualification

This candidate is based on accepted source `65207e98b463c03fa7614e04c2865aa471a37f7e`. It introduces one opt-in physical cell, not a replacement of the eleven-node castle or its completion logic. The default route, original player, companion/cargo, gun and portal ownership remain unchanged. Enable it explicitly with `game.tower41RatchetQualification` before selecting the room.

## Physical behavior

The original 3.2 kg cargo loads a 1 kg rack through real Cannon contacts. A five-equation guide leaves vertical translation free. Four real ConvexPolyhedron teeth engage a 0.12 kg hinged pawl; both rack and pawl use actual force Springs. The rack has a 1 m stroke and a 1.4 × 0.2 × 1.4 m tray. Real stops and fixed glazing bound the mechanism. The rear spring attachment and its visual coil remain under the roof. No runtime dynamic pose clamp, artificial retained-position counter, motor, completion gate or substitute cargo is introduced.

Forces are applied through the existing level hook before the physics step, once per world step. Owned bodies, constraints and the post-step listener have idempotent cleanup. Reset acts on owned mechanism bodies; it does not rewrite the original cargo. Meshes and collision descriptors track actual body poses.

## Qualification and practical limits

Four focused Cannon tests cover two genuine load/unload cycles, physical pawl removal, restoring-spring removal, floor clearance, lazy ownership, force ordering, zero-dt behavior, and double reset/disposal. One ordinary-input CPU journey reaches the cell through the existing freight puzzle, then loads and unloads the same original body twice, drops it onto the existing floor and retrieves it with native E. Two ordinary stationary frames observe cargo speed and angular speed below 0.15 before each release; E preserves its actual pose and momentum.

The author's final ordinary journey measured 0.2167036608 m and 0.4636232489 m retained travel. Each release had 40 observed 120 Hz steps, 26 and 24 free cargo/tray contact ticks, and zero observed cargo/fixed-guard or cargo/roof contacts. The maximum raw solved cargo/tray penetration was 0.0263111106 m during the second load. This finite solver penetration is reported rather than treated as perfect contact.

A separate 684-tick attempt to press the held cargo onto the rack did not reach actual contact: `NOTREACHED / OPEN`. It does not prove resistance to the held-cargo servo. Earlier release during a jump left about 20.3 m/s rearward cargo velocity and produced transient guard/roof penetration; neutral release avoids that observed case but does not fix or qualify arbitrary high-speed release. Compound guard contacts use discrete Cannon stepping; a general swept-contact guarantee is not established.

The executable fixtures contain observations and assertions for real body contacts, source identity, native E preservation, no resets/respawns/transfers, retained pawl/tooth contacts, and actual fall/recovery. Headless GLB geometry loading does not reproduce the native fifteen-bone renderer. These CPU results are not native-video, human, physical-device, full active-suite, 500-mechanism, 1,275-pair, or fifteen-minute master acceptance. This candidate is not published with the room50 camera release.

## Reproducible focused checks

```sh
node --test tests/lab-singularity-ratchet-cell.test.js tests/lab-singularity-ratchet-input.test.js tests/lab-singularity.test.js
npm run build
```

The two new test files use the active `lab-singularity*` prefix; the active runner archives `lab-tower*`. There are five newly authored tests. The existing `lab-singularity.test.js` includes the complete ordinary-input eleven-mechanism route, independently of the opt-in cell. Run results and exact candidate/tree identities belong in the accompanying evidence receipt, not in an inferred full-suite acceptance claim.
