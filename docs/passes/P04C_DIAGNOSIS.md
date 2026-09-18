# P04C — continuous camera path, diagnosis retained

Status: reproduced; two runtime experiments rejected; **no P04C runtime fix accepted**.
Specification: master document sections 5.2, 9.1 and 11, continuing issue42.
Base source: `3e18ca63e694bd6aa09dec57c81f839869728dc3`, tree `b2aff0b3e61afb03e5d88f86df01262dcf154a91`; identical game source merged as `d93eecb9505a7370f9828c5ef4270144d709f571`.

## Evidence

The read-only `scripts/p04c-continuity-audit.mjs` executes the entire ordinary room21 route. No actor positions, controls, visibility, camera positions or physics rules are replaced. It records120 display steps following each inclined transfer. Samples straddling a teleport or clip-state change are excluded from the centre-segment test. Actual solid meshes and the existing camera blocker predicate are used.

Solo exit: no late centre-segment hits, largest late camera displacement0.4170m, all endpoint sweeps pass. Joint exit: at tick34 the camera changes position by3.3104m; the centre segment between successive poses intersects the upper front casing at approximately[-5.325,26.455,-5.396]. Its actual mesh bounds are x[-5.325,-4.675], y[24,29], z[-10.7,-1.3]. Both endpoint and actor route checks still pass. A safe endpoint therefore does not establish continuous motion. This is a discontinuous lens relocation, not evidence of a physical actor bypass or a rendered intermediate camera frame.

The exact earlier P04A source489ba611 also reproduces a centre-segment hit against this casing, at tick39 with3.4782m displacement. The defect is not newly introduced by P04B. P04B fixes the retained late silhouette loss, not the remaining motion discontinuity.

## Rejected experiments

1. Limit movement around the previous eye, admitting only collision-safe candidates and a swept centre path. It postponed the forced relocation to tick37 but increased it to3.6990m. Reverted.
2. Anticipate a moving target by0.20s and penalize future occlusion when choosing avoidance. The worst correction rose to5.3009m with further oscillation. Reverted.

Their diagnostic traces are retained in the delivery evidence, not in runtime. No blanket wall exclusion, FOV widening, hidden actor, altered orbit input or geometry workaround was retained.

## Reproduction and acceptance

Run `node scripts/p04c-continuity-audit.mjs`; set `EVIDENCE_OUT` and `SOURCE_COMMIT` for provenance. This writes `motion-audit.json`. A successful route is independent of `centreSegmentContractPassed` and does not imply camera acceptance. Add `--require-safe` to make the currently failing centre-segment contract exit1. Both original sources were actually executed locally; this is not a browser or hardware test.

The next fix must find a connected escape path before the aperture closes, not just select a safe endpoint or delay a snap. Preserve ordinary mouse/orbit control, existing clipping geometry and P04B silhouette regressions. Compare complete routes and both exit windows; retain recovery, alternate order and delivery-offset checks. Full normal-view video and unchanged campaign/deployment gates remain required. The camera at the brake, early recovery framing, human comfort and device performance remain open. This diagnostic increment does not close issue42 or W03.
