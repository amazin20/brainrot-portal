# User video: floor rim and low wall shot, 19 September 2026

User source: `БРЕЙНРОТ ПОРТАЛ — физическая 3D-головоломка - Google Chrome 2026-09-18 20-00-30(1).mp4`, 40.726 seconds. The visible URL identifies c47364e8. The first segment shows the actor resting at the lip of a linked floor portal without dropping; the second shows low shots on the white departure panel rejected with the front-clearance message. Coordinates and input events are not recorded by that video. Our parameterized reproductions cover those symptoms, not a claim to recover its exact input trace.

Base of this increment: PR48 source 0d852419 / tree52cc28b4, on top of published c47364e8. Existing campaign-wide portal optimization is preserved.

## Floor contact

The original solver required the capsule's full middle radius to fit before its rounded foot could start entering the floor aperture. A stationary actor could therefore rest on an invisible flat disc although its feet were visually over the opening. The narrow reproduction at short-axis offset0.8175m remains stationary in the original version.

For a resting foot on a flat portal lip, the collision slice now starts at the capsule's rounded bottom. The rim's contact normal clips only outward velocity; gravity makes the actor descend and slide into the throat. No centre snap, positive energy impulse, lower character radius, larger portal or global pull is applied. The established moving-entry throat remains unchanged. The temporary contact belongs to that exact logical portal; reset, removal, replacement or transfer retires it. Inclined and wall portals retain the previous capsule policy. A rim landing after emergence keeps its previous support policy until the traveller leaves that exit footprint; normal centre-plane re-entry still works. This geometric guard avoids involuntary return trips, rather than a timer or level-specific rule.

The first unconditional rounded-foot trial affected two existing moving-entry regressions and was rejected. The full669-test run then caught a room18 recovery regression: a resting floor-exit landing was being pulled into a second passage before its normal outward walk. The exit-footprint guard fixes that case without changing the existing regression or route. The retained change is limited to the resting-lip case, preserving those existing routes and assertions. This is a deliberate interaction correction, not a claim that the game's simplified controller is a full rigid capsule solver.

## Low wall shot

The white departure panel reaches0.3m below its adjoining floor. Existing adjustment clamped the aperture to the full white rectangle and left the bottom embedded in the floor, so low shots were rejected while higher ones worked. For an upright wall panel with an obstruction at its bottom edge, allow a bounded upward fit of at most0.5m on that same panel; the complete rim, clearance, other portal and all blockers are checked again. A mid-panel pillar, off-panel hit, undersized panel or overlap stays rejected. No collider is hidden or disabled by placement.

The actual low shot at[-14.8,10.5,14], fired by the ordinary input driver from the departure gallery, now fits at approximatelyy11.759. The actor traverses it without a jump. The first test fixture approached the second panel from a different camera path and hit the departure wall; using the established reachable brake route corrected the fixture without weakening collision checks.

## Evidence and boundaries

New regressions cover resting contact at four rim orientations and30/60/120Hz grouping, rotated apertures, a250ms display interval, unlinked/solid floor, stale contact after replacement/reset, bounded same-panel fitting and a normal-input wall passage. Parameterized fixtures are not complete campaign playthroughs. Existing38 portal/moving/edge tests passed after the retained correction; full campaign/source CI and native evidence are separate requirements.

Native workflow records before/after at1280x720,30encoded fps,low graphics,without sound. Floor starts from a labelled numerical fixture in the complete room; wall footage uses ordinary walk/aim/fire after reset. Do not call either a full level walkthrough or a hardware-FPS measurement. Full regular WebGL verification1–21 remains mandatory. No model, room-layout, graphics-quality, save, portal impulse or camera patch is hidden in these two fixes. CPU/GPU optimization is separately described in P09B_PORTAL_PIPELINE.md. Zero frame drops on unnamed hardware cannot be certified by the runner.
