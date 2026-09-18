# Issue45 — a visible, full-area cargo receiver

Baseline: published `d93eecb9505a7370f9828c5ef4270144d709f571`, tree `b2aff0b3e61afb03e5d88f86df01262dcf154a91`. Source was restored from the retained exact tree and verified before editing.

## Change

The 12.5 × 8 m receiver was using 28 copies of the ordinary floor module (224,000 rendered triangles). Replace only those visible instances with an outlined graphite weighing deck, three matching weight/support pictograms, inlaid cross-ribs and two mechanical load needles. The entire yellow perimeter is the sensor boundary, not just the central icon. The original contact frame, collider, underside backing and broad partial edge-contact predicate are preserved. The deck is stationary; indicator motion never draws fictitious floor compression.

The same real supported-load predicate drives both new needles and the existing remote cable instruments, at the same time-based response rate. Held, hovering and outside cargo do not assert load. No new light, shadow-casting mesh, texture, imported model, physics body, listener, network request or global cache. New static geometry is batched by three materials; only the two needles move. Source generator: `src/game/LabPocketReceiver.js`.

Two framed transparent observation panes replace portions of the front upper casing so the outlined deck can be seen before delivery. They and the sender pier exactly tile the old wall volume (x5.15..5.85, y7.2..16.2, z2..10). They remain solid registered shot/actor/camera blockers. This is a visibility change to the functional enclosure, not an invisible wall or a new route. Roof, low freight opening, sender/cable, portal frames, drive rules, source characters, trajectories and other rooms are unchanged.

## Validation

Targeted test: `node --test tests/lab-pocket-receiver.test.js`. Includes finite mesh/bounds/budget checks, all contact states, matching indicator response, fixed-step smoothing, unchanged sensor/collider, exact enclosure volume, sealed glass ray tests, reset and geometry disposal. Rendering frequency is not device performance. Existing room21, airborne shot and load-link regressions remain mandatory.

`receiver-readability.yml` compares immutable baseline/candidate using one script and lockfile. It walks to a reachable pre-delivery viewpoint with normal input and camera, then runs the complete ordinary brake-first route. Contact/unload clips use an explicitly labelled inspection camera with all room geometry present; this does not modify the route camera, actors or their commands. 1280 × 720, 30 encoded fps, low graphics, **silent**. Normal-camera snapshots are separate. The native result, full campaign CI and public publication must each be confirmed by concrete run/commit; a workflow definition is not proof of completion.

## Limits

This addresses the user's missing/unreadable receiver, not all camera or hardware performance problems. Fewer receiver triangles do not establish faster real-device FPS. Do not claim level difficulty/comfort accepted without player testing. Keep issue42 and the reported camera cost open. No hidden stage flag, new hint button or automatic solution is added. Source art for rooms1–20 and all original GLBs remain protected.
