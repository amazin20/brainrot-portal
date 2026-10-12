# Private room 20 near-hook research checkpoint

This checkpoint is diagnostic research based on source commit
`5e552e9c3ac248b535d619741f15e99e29979cbf`. It does not modify the production
room, publisher or CI and does not establish ordinary-player acceptance.
`ordinaryAccepted`, `sourceAccepted`, `fullRoomAccepted`,
`privatePrototypeAccepted` and `productionForceBudgetAccepted` are all false.

Run the current bounded physics tests from the complete repository root, using
the repository's existing dependencies:

```sh
node --test tests/lab-room20-near-hook-slip-prototype.test.js
```

The final recorded v2 TAP has eight tests, eight passes, zero failures,
cancellations, skips and todos. It binds the four frozen input hashes before
and after execution. The independent final ownership check separately passed
eight cases on those same hashes. Neither result is a full campaign or browser
route result.

To create a fresh diagnostic rate record without overwriting historical data:

```sh
OUT=/tmp/room20-hook-current-rate-probe.json node scripts/qa-room20-hook-slip-spam.mjs
```

That script applies every finite input to a real motor-free rotor, verifies a
reached loaded bearing and actual original-cargo tray support, and records six
30-second input-rate cases. It is an isolated physics diagnostic, not an
ordinary portal/player/human route.

The current causal sequence uses the same 0.7 Nms rotor impulse under load and
after real original-cargo gravity unloading. Equal and opposite passive body
torques are limited to 4 Nm and apply only in the actual 120 Hz solver
subsystem. The loaded gate stays closed; cargo gravity removes bearing load
while a second real face still captures the gate; the same input withdraws
the hook and opens to the passive 2.4 m stop; a cable cut returns the gate.
There is no constraint motor, velocity target, ignored E, cooldown, load-ready
input gate or pose clamp. Input is rejected only when physical ownership is
invalid.

The fixture imports `LabRoom20NearHookStrokePrototype.js`, so that module is
retained as an exact dependency. Its stroke-drive alternative is rejected:
repeated physical inputs mechanically override its loaded hook. Its failing
tests are archived as text under `history`, outside the active tests glob.
The earlier direct-hook alternative is also rejected. The historical nine-case
TAP really has eight passes and one failure; it has not been relabelled as a
success.

`receipts` contains original revision-scoped diagnostics. The old 60-second
independent rate matrix belongs to base `d55d5725...` and slip `2a82c01a...`.
It must not be described as a new 60-second matrix on v2. Current v2 local
tests repeat six 30-second rate cases; the final independent v2 review targets
authored body type/mass and current physics-owner regressions. Older ghost
torque, prepared-force race, foreign-registration cleanup, inherited type/mass
and owner-diagnostic failures remain in immutable history.

Historical independent scripts in `reproducers` are preserved byte-for-byte
with their original workspace-specific imports and output paths. They are
provenance/reproduction inputs, not automatically portable CI entry points.
To replay a historical revision, overlay its archived source bytes onto a
separate complete checkout of the recorded base, restore archived test filenames
from their `.txt` suffix and retain the runner's documented directory layout.
Do not overlay a historical revision onto the active production checkout.

The production adaptation remains open. Room 20 opens in −X and its return
force is already `4 + 1.2*q` N, at most 12.64 N; the prototype's `20 + 5*q`
force cannot be transplanted. A free vertical 3.2 kg cargo supplies nominal
centered end-of-stroke gate pull about 17.178 N, but portal offsets, supports,
far-hanging clearance and transients require actual solver evidence. The
current hook's intrinsic closed spring torque is about 0.292 Nm, so the same
4 Nm coupling is not blocked by a production 4 N load at the current short
bearing lever. Mirrored real geometry or a passive force transmission must be
designed and proved before integration. There is no actual portal traversal,
player/capsule, far retaining finger or full-room acceptance in this checkpoint.

The shared `LabPhysics` crash when an isolated mutant removes the only cargo
shape entirely is preserved as an open issue outside the prototype edit scope.
It is not an ordinary-player exploit claim. The isolated actual-world-only
solver probe verifies that the prototype supplies no stale cable force, while
the complete caller's post-solver CCD guard still requires investigation.

Exact copied paths, source/dependency hashes, input/output binding and scope
are recorded in `checkpoint-provenance.json` and `receipts/hook-slip-final-v2-manifest.json`.
