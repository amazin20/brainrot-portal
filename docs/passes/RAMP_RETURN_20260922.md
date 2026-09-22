# Continue the human-laboratory repair: real ramp return

Base: PR57 candidate `4c357dab7877ce56a1f70460a7c2281c2579bdb4`.
The earlier portal shader preparation and all existing release gates are retained.

## Additional failures found by exploring from the normal spawn

The original full puzzle solution never stops to repeat jumps on the first ramp
and never walks back down from the high launch terrace. The new exploratory route
performs both, without assigning actor positions, velocities or mechanism targets.

On the base revision, stopping after running jumps could prevent an uphill restart
at approximately `[-45.67,17.06,-7.64]`. A tiny downhill drift was accelerated past
the near-rest threshold before the controller decided its new heading. The next
tick braked it again, creating a repeating accelerate/brake loop. The controller
now takes the incoming speed into account when resolving near-rest reversal.
Normal high-speed braking, airborne momentum and slide tuning are unchanged.

After fixing that, the same route found the return blocked at `z=2.4301`, just
outside the high end of the second ramp. Its radius-expanded end was treated as
a vertical wall above the real flush landing. Ramp ends now use the same bounded
grounded step policy as ordinary deck edges. This does not open side or underside
faces, catch an airborne actor, or admit a segment that penetrates more than the
existing 0.37 m step allowance. The actual sloped support remains authoritative.

## Verification

- `node --test tests/lab-ramp-return.test.js`: 7 tests passed. These include
  48 combinations of small reverse drift, frame step and heading; return from both
  ramp orientations at 30/60/120/240 Hz in both movement controllers; negative
  airborne/underside/deep-entry cases; and the complete exploratory round trip.
- Existing targeted kinetic, ramp, and open-room tests: 35 passed.
- `node scripts/exploration-continuous.mjs`: continuous simulated-input exploration
  from the ordinary room-30 spawn; repeated takeoffs, landings, stop/restart,
  two inclines in both directions and return to the start. This is not the level's
  puzzle solution or a claim of a human playtest.
- `node scripts/ramp-exploration-browser.mjs`: executes the SAME scenario through
  the production WebGL bundle. It records four two-second excerpts at 15 captured
  frames per simulated second. In-between walks remain in the route trace, not in
  the video. Recording rate is not hardware FPS.

Exact final source, browser and public-site results are recorded in GitHub Actions.
Local tests do not substitute for those final revision-specific gates. No new
level number or universal elimination of portal stutter is claimed by this patch.
