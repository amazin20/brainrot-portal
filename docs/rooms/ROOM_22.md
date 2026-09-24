# 22 — Обратная сторона шлюза

The freight plate at the west court drives a single opposed mechanism. With
the original companion on the plate the lower throat rises open and the upper
inspection opening closes. Removing that load reverses both shutters. The
permanent east gallery preserves player height so the load can be recovered
through its own floor portal; the elevated reverse sight line reveals the
receiver on the far west side. The player can carry the companion through the
final high pair or send it ahead from the connected freight step.

## What changed in the visual revision

- The full-size continuous floor is now two abutting structural surfaces.
  Cool west freight tiles and warm east service tiles use their existing
  authored floor mesh and colliders, without a second paint layer.
- An articulated 28 KB cable winch has a real collision proxy, a fixed press
  gantry and a sheathed overhead link to both shutter mouths. The drum angle
  follows the real pad-driven shutter position, including reversal.
- Copper conduit and shutter-mounted status bands make the two opposite door
  states readable from the respective routes. Fixed machinery has registered
  physical collision. Thin inlays share the moving doors' transforms and do
  not block portal aiming or third-person camera rays.
- Fixed machine casings and inlays are drawn in four instanced material batches;
  their separate hidden meshes remain available to collision and ray tests.
- Upper and lower inspection apertures keep their original size. The cargo
  loading shelf, ordinary return stairs and shared low recovery court remain
  physically connected; no hidden checkpoint or additional puzzle object was
  introduced.

## Verification

Run `node --test tests/lab-room22-architecture.test.js tests/lab-room22-23.test.js tests/lab-room22-send-first.test.js tests/lab-new-campaign-art.test.js`. The structural check also ensures the two clearances remain unobstructed and the same winch/indicators change with both opposite shutter states during a successful ordinary route.
