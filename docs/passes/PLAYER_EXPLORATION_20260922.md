# Player exploration repair — 22 September 2026

Original reproduction: cb882f9b3e6dc200dedd3ab05a4b3fb0fa9f7faa.
Integrated with concurrently published portal fix 436c184622377f7d311880fd17d54168d383957a.
Its Set-based backing ownership, shader warmup, saved-quality guard and all original
source/native/public regressions are preserved, rather than overwritten.
Scope: shared portal/character controller; open-edition rooms 24, 28, 30.
The other 27 layouts are not rebuilt. Original character/cargo/gun GLBs stay unchanged.

## Reproduced failures, not inferred from a successful walkthrough

In actual room 24, a floor aperture on the pressure pad opened the top skin but not
the reinforced deck below it. The player's feet stopped at -0.58 m, before the
capsule centre crossed the portal plane. Explicit deck-to-pad ownership now opens
that same physical assembly only inside its actual aperture. Unrelated lower
floors and objects remain solid; the global wall-depth tolerance is unchanged.
The reproduction reaches one physical transit after the fix.

Jumping uphill on room 30's first ramp penetrated the visible surface while the
vertical velocity was still positive. Continuous contacts now use motion relative
to the inclined plane, including side, end and underside faces. Grounded downhill
support is separate from airborne collisions. The adjoining flat-deck lip also
supports an uphill traveller instead of treating their uphill velocity as a jump.
The reproduction's worst below-surface depth changed from -37.605 m to 0 m.

These are staged production-physics experiments, not a recording of a human.
`node scripts/exploration-repro.mjs` reproduces the two scenarios.
`tests/lab-player-exploration.test.js` checks frame-step variants, airborne and
underside attempts, real ramp-to-deck transitions, and 8,000 randomized geometric
predicate comparisons. `tests/lab-exploration-rooms.test.js` tries eight approach
directions to an off-centre aperture in the actual room, not only its central path.
The existing complete routes remain required, with no reduced win assertions.

## Portal rendering

The published `LabPortalWarmup.js` path from PR56 remains authoritative: canvas,
HDR output, global/local clipping and depth shadow variants are prepared behind
loading. Its saved-quality guard is retained so `onReady` does not destroy the
already warmed shadow target. A second independent warmup implementation was
removed during integration rather than running duplicate preloads.

Two earlier isolated comparisons on the old baseline reduced paired-view shader
work but did NOT eliminate the very first software-driver stall. They are not
advertised as elimination of all freezes. Final native tests require zero in-play
shader links and successful actual floor entry, reverse exit and original cargo.
Graphics resolution, refresh frequency, MSAA and recursion are not reduced.

Unchanged static masks no longer wake the cargo or invalidate broadphase. A sleeping
cargo still wakes when a nearby reused support moves/resizes or a mask changes;
the regression includes the classic light-bridge recovery. Portal
bounds use equivalent centre/extent arithmetic instead of eight allocated corners,
and floor queries reject unrelated decks before aperture calculations.

`CHROME_PATH=<Chrome> OUT=<folder> PAGE_URL=<preview> node scripts/profile-exploration.mjs`
records synchronized renderer cost and new shader programs in staged cases. Software
WebGL timings are not physical-device FPS. First frames and later frames are kept
separate; visual evidence and ordinary input routes are additional checks.

## Human-facing spatial changes

Room 28 is now a 60 by 47 metre enclosed laboratory, rather than a 128 by 98 metre
open-sky footprint. The exit is visibly above reservoir A. Two 12 metre platforms,
a shared 4 metre gallery, a finite 8 metre water budget and a real return ramp make
the cause/effect inspectable. Instruments display actual A/B heights and actual
flow direction, including disconnected, dry, equal-pressure and same-reservoir states. Colour of a portal is not
a progress flag. Breaking the connection preserves the water. Both equal-head and
full-transfer approaches are supported and separately tested.

Rooms 24 and 30 now have closed structural laboratory walls, roof and interior
lighting rather than floating against a sky dome. Their travel distances are not
uniformly scaled; room 30 still needs a long momentum flight. No random plants or
nonfunctional filler were added. This pass does not claim all rooms are compact or
that every alternative a person might attempt has been enumerated.

No new campaign room is claimed in this repair. Release/native tests and subjective
first-time player clarity must not be conflated; final reports name the exact SHA.
