# W03 — 21 / Гравитационный карман

Baseline: `4d179a004458ccf06c1ba6514837507d553234cb` (reviewed W01, on v36). Candidate label: **v37-gravity-pocket**. This increment adds room21, not the remaining nine rooms. Main/public v36 are not changed by a draft branch.

## Passport

**Deduction:** drop height supplies speed; portal direction supplies upward motion. A low freight path parks the companion on a real load plate. The player must crest a visible transverse lintel and land on permanent support before spending the portal pair on retrieval.

**Space, metres:** connected recovery foundation at y0, x[-20,18], z[-17,18]. Loading balcony y4 southwest, broad freight catch y3 northwest, independent west observation gallery y8, high falling lip y14, upward exit at [8,1.4,-11], receiving pocket y9 southeast. The goal is visible across sealed observation glazing. A narrow permanent inspection stair on the receiver's west edge rises to y12 and reveals the freight rest from above. North is negative z.

```
NORTH / z−              west gallery       inclined exit ↑
                       freight rest       hinged aperture
                         [load]            transverse lintel
                             sealed       receiving pocket [goal]
                       fall well   glazing   reverse-face rescue
SOUTH / z+             low/high lips, return stairs and upper stair
```

**Section:** the low y4 cargo fall exits horizontally into the freight rest. The y14 player fall exits 20° from vertical, crosses the open aperture, rises above the lintel, and descends onto y9 permanent support. Gravity 19.5 and all original player/cargo/portal parameters are unchanged. The aperture has a 6.2 m width and 15.8 m clear height, with actual hinged leaves/frame colliders. It is driven by real plate contact, not by identity, visited flags or a synthetic launch bonus.

**Dependency graph:** observe/reach upper gallery → high lip; independently deliver original cargo → loaded plate → open flight aperture. Both meet at `high fall + upward exit + open aperture`. Landing frees the pair → reverse-side outlet + freight-rest entry → retrieve same cargo → physical joint arrival. The scouting-first route returns to the original loading balcony by an ordinary fall before freight delivery. Scouting is useful route knowledge, not a fake permanent switch. The plate is the actual persistent physical preparation.

**States:** empty/closed; scouted/closed; loaded/open; landed/loaded; landed/retrieved/closing; joint exit. Only the actual body positions/contact and ordinary gate response determine the state. No checkpoint/phase-speed or hidden prerequisite victory flag is added.

**Normal actions:** walk, aim camera, fire each portal, pick up/release cargo, traverse portals and stairs. Scripts `LabRoom21Journey.js` and `LabRoom21Recording.js` do not assign actor/portal transforms or victory. They use public commands and monitor the original companion group and physics-body identity. Fixture-only predicate tests explicitly assign positions and are not route evidence.

## Recovery and variation

Missing entry before the high fall leads to the continuous lower foundation; freight remains loaded. Real stairs and the observation pair recover the high approach without a room reset. The recorded recovery route also clears both portals after the traveller is clear of the exit frame, pauses in flight, resumes with preserved velocity and completes the original joint goal.

Early clearing while still inside the inclined exit's collision envelope can hit the restored backing and land on the lower foundation. That was observed in a development attempt; it is not presented as a successful direct landing. The accepted in-flight erasure test explicitly waits until z > -6.5, before the apex. A complete ordinary recovery of the earlier backing-hit case is still to be recorded. No universal guarantee over arbitrary erasure times is claimed.

The original aperture header at 11.7 m clipped a trial starting 0.25 m left. Raising the actual clear frame to 15.8 m fixes that geometric obstruction without changing speed or gravity. Whole-route variants at ±0.5 m lateral offset and approach factors0.1/0.2 are regression cases, not a proof for arbitrary starting speed. The normal approach factor is0.15. These are ordinary analog input values; the game does not snap players to them.

## Protected scope / art

Rooms1–20 retain exact numeric gameplay-geometry fingerprints from the reviewed W01 tree, stored in `tests/fixtures/w03-protected-geometry.json`. Shared art entry guards extend only to index20; the first20 builders, original models, physics constants, movement and portal rules are untouched. Room21 uses existing authored tiles, batched folded architectural cassettes, portal frames, visible wiring and an actual hinged aperture. The new architectural palette is specific to21. No new downloaded character mesh is introduced.

The ordinary registry and next-room transition include21. Existing CI/publishing assertions and WebGL matrix include21, not an excluded draft room. Old v36 completed indices0–19 remain intact and do not mark21 complete. The long-term stable-ID/versioned save redesign and mid-level checkpoints of W10 are **not** implemented here; continuation from a reload starts the room normally. The last available room temporarily returns to selection/first room through the existing interface; the final30-room ending is not claimed.

## Verification contract

`node --test tests/room21-gravity-pocket.test.js` covers protected20-room geometry, append-only save continuity, the two full orders, recovery/pause/erasure, lateral/approach variations, synchronous-vs-recording command equivalence and physical joint victory. Equivalence requires equal display-step counts and coordinates within1e-8; independent world rebuilds exposed ~1e-13 floating-point contact differences, not a changed route.

`node scripts/w03-route.mjs '{"order":"scout-first"}'` writes a standalone headless route report. These elapsed times measure execution of a known solution, not human first-solve difficulty.

The specialized `W03 room21 native routes` workflow records three full native Chromium/WebGL runs: cargo-first, scout-first and recovery. Video is sequential1280×720 at30 encoded fps, original120Hz physics with60Hz visual state updates, **silent**. Source frames are encoded directly using WebCodecs VP8 and converted toMP4; contiguous timestamps and exact decoded frame counts are asserted. See the W3C WebCodecs draft https://www.w3.org/TR/webcodecs/ . Encoding cadence is not hardware performance. A created workflow is not a passed test: inspect its exact commit, retained JSON and video before acceptance.

**Still open until demonstrated:** actual browser visual review, broad adversarial routes/sightlines beyond the finite cases, human difficulty/readability, complete W01 animation polish, real devices, stable-ID saves/checkpoints, true Yandex environment and moderation. No automatic main merge or deployment is performed.
