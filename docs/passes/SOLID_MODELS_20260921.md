# Solid model repair — 21 September 2026

Base: `0530acb61c1d1c0d0377a40e9dae34c945aad6f9`. This is a candidate, not a
claim that the public build has already changed or all flicker is eliminated.

## Repair scope

Rooms 24, 27–30 receive seven original modeled families: fluted botanical
planters, finned gearmotors, ribbed thick canopies, open segmented flight collars,
field resonators, sealed tidal pontoons and a solar observatory crown. The
reproducible source is `src/game/LabSolidModels.js`. All opaque geometry uses
front-face rendering, finite unit normals and closed shapes. Colors are grouped
into four material roles; repeated instances share immutable geometry/materials.
Characters, original imported GLBs, portal frames, control laws and saved progress
are not redesigned.

Physical envelopes use the production player, cargo, camera and aim registries.
Rings have separately bounded rim sections, never a solid box across their holes.
Moving hulls, the garden arm and the final flight collars update collision from
fixed-step mechanism poses. The visible structures were repositioned where the
old paths passed through formerly nonphysical scenery; existing route scripts
and assertions are not relaxed to obtain a pass.

Conveyor decks retain exactly one authored finish. For rooms 24–30, the common
architectural pass replaces layered near-coplanar face sheets with one closed
beveled cassette and a vertex-colored shoulder. Existing structural boxes are
beveled in place instead of covered with four overlapping side sheets. Redundant
thin floor-edge fascia is not stacked on these rooms. Portal ceramic and genuine
water/effect transparency remain intentional.

Cannon's sweep broadphase now omits provably masked solid/solid candidates while
retaining the stock ordering and intersection predicates for all eligible pairs.
Tests compare exact ordered results against stock SAP for randomized worlds,
all axes, masks, sleeping/type states and both bounding modes.

## Reproduction and evidence

- `npm run check`: unchanged complete source suite and production build.
- `node --test tests/lab-solid-models.test.js tests/lab-static-aware-sap.test.js`:
  new closed/opaque geometry, compound collision, open aperture, player contact,
  moving registration and broadphase equivalence checks.
- `node scripts/export-solid-models.mjs qa/solid-models`: write each binary GLB,
  read those exact bytes back, inspect normals/indices/triangles/size, record
  SHA-256 and a source hash. A full Khronos validation is separately reported;
  install `gltf-validator` for that check. Missing validator is `not_tested`,
  never silently presented as passed.
- `node scripts/solid-offline-capture.mjs`: WebGL asset studies, explicitly not
  gameplay evidence.
- `node scripts/solid-preview-capture.mjs`: native game start views in five rooms.
- Existing `scripts/v8-browser.mjs`: ordinary input routes and mechanism motion.

Structural checks cannot prove visual quality, absence of every possible bypass,
or performance on the player's device. Native review uses actual WebGL, with
SwiftShader in CI; its speed is not hardware FPS. The exact commit, run results
and image/video artifacts are the acceptance record. No release gate is disabled.
