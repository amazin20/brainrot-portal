# v49: manufactured chambers and readable lighting

This revision applies the supplied Russian master upgrade specification to the
existing v48 campaign. It preserves the newer electrical room18, tension room20,
and eleven-mechanism castle. It does not claim completion of the entire master
specification.

The graphics finish covers both chamber kits used by foundation rooms1–40 and
the castle41. Ceramic, enamel, nickel, rubber, glass and signal light retain
distinct finishes. Broad recessed bulkheads replace flat boxes inside their
existing envelopes; platform profiles have actual structural connections. The
room20 return spring is wound geometry following its existing pivot. Fine grain,
overlapping skins and floating wire braces were removed. The castle uses eleven
mineral palettes and larger wall profiles clipped around real portal footprints.

The original player, companion and gun GLBs are unchanged. A persistent neutral
radiance probe and one unshadowed fill light improve their volume. Two visual contact marks use floor/ramp support height and fade around open
floor apertures. They are approximate floor projections: top faces of other
solids and clipping of the whole footprint at ledges are not supported. Level-owned contacts are released on level changes; the
shared probe is released with the game controls. No new shadow-casting lights or
downloaded textures were introduced. Save revision identifiers remain unchanged.

## Real-image acceptance

Pilots1,20,41 were captured with identical cameras at960×540, DPR1, low quality.
The new build was also inspected at balanced and high quality. All six before
and six after low-quality captures, plus six balanced captures, contain actual
nonblank WebGL pixels, with no JavaScript errors. Inspection camera positions are not gameplay evidence.

| Pilot | Complete-frame calls before → after | Triangles before → after | Physical colliders |
| --- | --- | --- | --- |
| 1 | 78 → 81 | 207,042 → 207,106 | 77 → 77 |
| 20 | 56 → 57 | 181,302 → 183,138 | 143 → 143 |
| 41 | 303 → 304 | 192,556 → 193,024 | 1,558 → 1,558 |

These are renderer counters from software Chromium, including the passes
accumulated by the game renderer. They are neither GPU timing nor VRAM estimates.
Real-device FPS, sustained memory pressure and human art acceptance remain to be
measured. The fourteen shipped models total3,290,200bytes; the exact CI candidate's
validated Yandex ZIP is3,988,687bytes (5,985,850unpacked), below the100MB limit.

Mobile tutorial presentation was inspected at360×800,390×844,412×915,800×360
and568×320, each with the current lesson and the real254-character castle
prerequisite message. All ten scenarios have visible controls, no text clipping
and no tutorial/control/reticle overlap. The initially observed narrow landscape
overlap was corrected in CSS.

Ten menu-selection cycles1→20→41 with quality changes retain56 textures,
178 geometries and identical scene/light/contact counts at each41/low endpoint.
Program count warms108→115→117 in the first two cycles and then remains117.
The original overly strict cold-program assertion and its full series are
retained alongside the explicit plateau assessment. Baseline/final actual
WebGL captures are byte-identical. These are software renderer allocation
counts, not RAM/VRAM bytes or evidence against every possible long-term leak.
A separate forced WebGL loss displays the error card; ordinary wheel scrolling
and the visible Reload button return the unchanged URL to level1 ready with
nonblank WebGL and unchanged preferences/classic/open keys. Automatic context
restoration is not claimed.

## Physical changes kept separate from art

Before these intentional fixes, the art-only physical/portal/interaction
contracts matched all forty foundation chambers. Castle geometry registries,
flags and transforms matched before/after, and all nineteen castle collision
checks passed.

New ordinary-input trials on the frozen v48 source reproduced three omitted
mechanics: room2 service-deck and island jumps, room14 player transport directly
to the island instead of the first light bridge, and room19 entry through the
open cargo-chamber roof instead of independent cargo delivery. Room2 now has
ten-metre dry gaps; room14 uses an actual cargo-only receiver aperture; room19
has a solid transparent inspection roof. The roof transmits a portal charge to
the existing white floor while retaining physical, airflow, camera and pickup
collision. Canonical routes for all three changed rooms remain tested.

Eight recorded room2 timing variants remain blocked with the original cargo,
zero gameplay resets and no source drift. Dedicated input-only regressions for
14 and19 preserve the original companion/body and verify the precise former
routes fail at their physical boundaries. The strict visual-contract fixture
changes only room19's intentionally audited physical hash.

Earlier departure from moving carriers in3,5,13, partial electrical screw work
in18, partial pneumatic charge in34 and optional return-door controls in37
remain legal physical alternatives. They retain the causal work of their rooms.
The new trials do not establish absence of every possible shortcut. The early
initial matrix includes one incomplete approach; later targeted retries are
recorded separately rather than silently counted as successful checks.

The continuous castle recording, three retained campaign route matrices,
forty production WebGL routes and SDK checks are required by the existing
publication workflow for the exact candidate commit. Matched six-pose camera-only comparisons of pilots1,20,41 were also captured at
640×360 balanced, two samples per second. Their three-second videos are visual
diagnostics rather than gameplay, animation timing or temporal-smoothness proof.
The independently hashed baseline matches all837 tracked blobs at2cb459c.
The broad rig, audio, human playtest and hardware tasks in the master spec remain
separate work.

Evidence: [pilots before](evidence/v49-pilots-before-release.json),
[pilots after](evidence/v49-pilots-after-release.json),
[balanced pilots](evidence/v49-pilots-balanced.json),
[mobile presentation](evidence/v49-mobile-tutorial.json),
[lifecycle summary](evidence/v49-lifecycle-summary.json),
[lifecycle assessment](evidence/v49-lifecycle-assessment.json),
[raw lifecycle](evidence/v49-lifecycle-raw.json),
[native WebGL recovery](evidence/v49-contextloss-native-scroll.json),
[unscrolled initial guard](evidence/v49-contextloss-unscrolled.json),
[room1 camera comparison](evidence/v49-level1-camera-pan.json),
[room20 camera comparison](evidence/v49-level20-camera-pan.json),
[room41 readable camera comparison](evidence/v49-level41-camera-pan.json),
[original room41 occluded endpoint](evidence/v49-level41-original-occluded-pan.json),
[exact CI platform package](evidence/v49-yandex-package.json),
[hashed baseline source](evidence/v49-baseline-source-verification.json),
[prior route observations](evidence/v49-prior-route-observations.json).
