# Issue 58 — local candidate, NOT integrated or published

Target base: main `f8a652d7425d17b2a3378d2c77f3d97ba3f63958`, tree `1b006b5d3d567e43cc488297efb1d7377956e956`.
This note is on a separate review branch only. Do not treat it as a main change,
a native visual sign-off, or a replacement for release verification.

The old ordinary-obstruction score considered only the chest pivot. Score the
whole vertical envelope when the view is obstructed, not just after inclined
portal transport. Keep the already swept emergency candidate available when
spring lag produces bad framing but that candidate has a clear full-body view.

A local replay of the SAME continuous `runRampExploration` scenario from normal
room30 spawn measured a simple vertical envelope at world heights [0,1.2,2.5] m:

- Baseline: 10/480 sampled poses clipped by the viewport.
- This candidate: 0/480 clipped; the physical route still passes.
- Maximum per-frame camera displacement RELATIVE to the player pivot, excluding
  discontinuities between the four sampled excerpts: 3.924999 -> 0.370442 m.
  These are scene-pose differences at the simulated input cadence, NOT FPS.
- `node --test tests/lab-camera*.test.js`: 54/54 tests passed locally in 57.2 s.
- Simply raising the old emergency distance from 2.2 to3.1 previously made the
  issue worse and is NOT part of this candidate.

Still required before integration: a dedicated regression including framing and
relative camera motion, actual native captures with the original animated skin,
all full-source/portal/mouse-input gates on the final SHA, and public verification.
The simple vertical-point test is not a full deformed-mesh silhouette audit.

```diff
diff --git a/src/game/LabCamera.js b/src/game/LabCamera.js
--- a/src/game/LabCamera.js
+++ b/src/game/LabCamera.js
@@ -355,7 +355,9 @@
     // A fast fall past a balcony can close the available boom in one physics
     // step. In that exceptional case collision safety outranks spring lag:
     // use the already swept escape rather than render from inside the body.
-    if (escapePosition && this.camera.position.distanceTo(this.playerPivot) < 2.2) {
+    if (escapePosition && (this.camera.position.distanceTo(this.playerPivot) < 2.2
+      || (this.obstructed && this.framingPenalty(this.camera.position) > .02
+        && this.framingPenalty(escapePosition) < .001))) {
       this.camera.position.copy(escapePosition);
       this.distance = this.camera.position.distanceTo(this.focus);
       this.distanceVelocity = 0;
@@ -390,7 +392,7 @@
     const forward = this.lookPoint.clone().sub(position).normalize();
     const right = new THREE.Vector3().crossVectors(forward, this.viewUp).normalize();
     const up = new THREE.Vector3().crossVectors(right, forward).normalize();
-    if (!this.inclinedFraming) {
+    if (!this.inclinedFraming && !this.obstructed) {
       const subject = this.playerPivot.clone().sub(position);
       const depth = subject.dot(forward);
       if (depth <= .1) return 100;
```

No camera collision, source actor geometry/scale, orbit input or aiming control
is bypassed by these two candidate conditions. The issued release remains f8a652d
WITHOUT this camera change until its own final verification is complete.
