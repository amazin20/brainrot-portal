# W02 — isolated inertial distributor prototype

Status: **technical prototype, not a finished level or final exported asset**. It is not registered in the 20-room campaign or bundled into its production build. No character source geometry, material or texture has changed.

## Physical contract

One 8 kg compound rigid rotor is attached to a stationary bearing with a cannon-es hinge. A broad 1.6 × 1.3 m paddle receives ordinary collision impulses. Side, mass, speed and lever arm produce the rotation; no object-id check selects an angle. Two actual collision posts limit travel to approximately ±0.62 radians.

A reduced passive spring-detent model uses `U=0.5*(1-cos(2πθ/0.6))`, torque `-dU/dθ` and viscous damping 16. This is a declared elastic cam approximation, not a claim that a full spring/roller assembly is simulated with many bodies. Stable orientations are approximately -0.6, 0 and +0.6 radians. The bounded brake opposes angular velocity. Stops are not implemented by angle clamps or position assignments. Only explicit fixture reset sets body transforms.

The fixture keeps the same 3.2 kg cargo rigid body, 0.78 m collision cube, 19.5 m/s² gravity and 120 Hz step as the current game's corresponding defaults. This does **not** establish compatibility with the game's portal/carry controller: integration is a separate remaining check. The original 0.82 m visible companion source is reused without editing it. No transparent collider is shown.

## Executed local tests

`node --test tests/distributor-prototype.test.js`: 27/27 passed on Node 22.16.0 with actual cannon-es 0.20.0. Includes 18 side/speed/lever variants, real weak contact, reverse impact using the same cargo, large repeated impacts, brake release, bounded-force holding, unloaded energy decay, reset/disposal and invalid input. 30/60/120 Hz display groupings plus one 250 ms frame run the identical 1440 physics ticks.

The first weak-contact fixture fell onto a rail before touching the paddle. Its test failed the required contact check. The launch gap was reduced from 0.19 m to 0.03 m, not the assertion weakened. Contact now occurs at about 0.5 m/s, stays in the centre detent and returns toward zero. Early spring/damping tuning also exposed reverse impacts returning to the first side; the retained passive parameters pass reversal and the stated range. These tests are finite fixtures, not exhaustive guarantees.

Run `node scripts/w02-distributor-report.mjs` for the parameterized 20-case matrix and source/model SHA-256 hashes. `npx vite build --config vite.prototype.config.js` builds the separate viewer. Its numerical initial conditions are initialized by the review buttons; this is not an ordinary player route.

## Visual evidence and limitations

The editable procedural viewer shows the load tray, paddle, central bearing, grounded supports, physical stops and a diagrammatic spring-detent follower. It remains review art, not a final campaign GLB. The separate workflow records native 1280×720 Chromium frames at 30 encoded fps, 120 Hz simulation, without audio. Inspect the concrete browser run and JSON before claiming visual success. Local Chromium is blocked by environment policy, so its availability is not assumed.

Still open: player-driven delivery via actual portals, shared carry-force contract, full collision/readability review, all receiver routes, final production model, human understanding and physical-device performance. The full W02 package also includes other compositions not covered by this bench. Level 23 cannot be marked complete from this prototype.
