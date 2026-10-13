# Animation time and visible carried contact

The presentation owner bounds an active frame once to 100 ms. Player, cargo
wrapper, cargo skin rig, and held device consume the same permitted interval.
Player pose integration uses bounded 1/240 s substeps and consumes the complete
interval. Zero permitted time preserves poses, cues, and contact corrections.
Pause and hidden-tab guards remain in `LabGame`.

Carried cargo now has bounded fin/head/tail follow-through. The rigid cargo
Body and supported shoes retain their established transforms. Repeated pickup
does not restart the gesture. Jump, shot, and portal transitions interrupt stale
interaction reach from the current pose. Release recovers in the player's local
frame, without delaying the physical input.

## Actual glove acceptance

The original authored grip addresses were wrist landmarks. Checking their IK
residual did not establish visible contact: the real optimized right glove had
a measured 64.79 mm gap from the intended cargo Body contact.

`LabCarrySurfaceContact` establishes fixed barycentric cargo contacts on the
actual source Body skin (at least 80% Body influence at all triangle corners):

| Side | Source triangle indices | Barycentric weights |
| --- | --- | --- |
| Left | 41727, 40739, 41728 | 0, 0, 1 |
| Right | 48779, 48472, 48780 | 0, 0.1377240511, 0.8622759489 |

These contacts are chosen in bind pose from the original grip addresses, before
the tested movement. They remain fixed on the source cargo geometry. Gloves
are the actual Hand-dominant triangles (at least 80% Hand influence at every
corner), excluding cuffs and forearms: 617 left and 660 right triangles.

Only existing arm, forearm, and hand rotations change. Wrist movement relative
to the original anatomical solution is bounded to 80 mm; hand-local rotation
is bounded to 0.45 rad. Bone positions, lengths, and scales, geometry, UVs, skin
weights, physical roots, held offsets, cargo identity and physics remain intact.
The correction ramps in over 150 ms after the established full reach and fades
out with that reach's existing local rotation envelope after immediate physical
release. An attached mesh's bind inverse is refreshed before sampling, so the
contact solve measures the same moving-root deformation as the renderer.

The independent probe evaluates actual deformed source triangles using
`SkinnedMesh.getVertexPosition`. Its acceptance test never relies on the
runtime wrist residual or the correction's own surface-gap diagnostics.

## Verification

`tests/lab-visible-glove-contact.test.js` checks ordinary input routes on real
optimized production meshes. Sustained reachable contacts pass the 20 mm limit:

| Presentation sampling | Maximum left gap | Maximum right gap |
| --- | ---: | ---: |
| 15 FPS | 1.92 mm | 0.55 mm |
| 20 FPS | 1.52 mm | 0.58 mm |
| 30 FPS | 1.97 mm | 0.54 mm |
| 60 FPS | 2.00 mm | 0.59 mm |
| 120 FPS | 1.99 mm | 0.59 mm |
| 144 FPS | 1.99 mm | 0.59 mm |
| 80 ms frames with turn/jump/stop | 1.02 mm | 0.60 mm |
| 100 ms frames with turn/jump/stop | 1.61 mm | 0.57 mm |

Native pickup settles to at most 1.89 mm. Release changes any local arm/forearm/
hand rotation by at most 3.49° per 60 FPS frame. Exact geometry/normal/UV/skin/
index hashes and every source bone position/scale remain unchanged. A corrected
384-step physical route is exactly equal to its correction-disabled baseline.
Zero-time pause preserves the pose and invokes no correction.

The prior 104 animation/contact/source/route tests plus the four strict glove
tests pass (108/108). A separate production WebGL capture independently sampled
96 frames at 30 FPS: left maximum 1.932 mm, right maximum 0.586 mm, one ordinary
jump and landing, no actor reset/replacement. Its front/side stills are visibly
labeled diagnostic camera inspection; its continuous clip retains the normal
shoulder camera. Software WebGL evidence does not establish hardware FPS.

Reproduction:

```sh
node --test tests/lab-visible-glove-contact.test.js
CHROME_PATH=/path/to/chromium node scripts/qa-visible-grip-webgl.mjs
```

`animation-review` clips recorded before the final surface correction are
historical presentation evidence. The `visible-glove-final` clip and stills
record the final integrated contact implementation, with source hashes and
per-frame 3D mesh points in their accompanying report.
