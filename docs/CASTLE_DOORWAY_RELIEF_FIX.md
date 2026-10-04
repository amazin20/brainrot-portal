# Castle doorway relief correction

The continuous native castle recording from `f57fd03` reached victory and passed
its original-body/no-reset route assertions, then failed the unchanged per-frame
nonblank gate. Its 4 FPS capture has 4,173 contiguous JPEGs; only frame 001645
(presentation time 411.25 s) has FFmpeg YMAX−YMIN <=12: 204..206, range 2.
Neighbors 001643/001644 show a close pale wall and 001646/001647 recover to the
ordinary third-person view. The bad frame matches the visible wall material,
rather than the castle's dark background. Neither the frame nor the gate is
removed or weakened.

The actual cause is architectural artwork covering an authored physical door.
`LabSingularityArt.wallFace` cut around portal addresses but omitted real room
entrances. The magnet west entrance is at x=24, z=35±3.4, y=18..23. Its center
relief cassette occupied x≈24.14..24.24, z=33.25..36.75, y=19.2..23.7. It was an
opaque visual-only face through the otherwise open doorway, outside both the
physical and camera collision registries.

A separate canonical headless trace uses real optimized source meshes and the
same procedural castle architecture. At visual frame 24675 (physics time
411.2667 s), its camera ray was:

| Item | World value |
| --- | --- |
| Origin | 23.826632849, 20.227030245, 36.399975883 |
| Direction | 0.988304747, −0.139273769, −0.062101086 |
| Original first visible hit | 24.139999390, 20.182870041, 36.380285193 |
| Original distance | 0.317074811 m |
| Original material | Castle wing enamel / magnet |
| Corrected first hit | Existing floor at 15.990306486 m |

The recording did not save native camera transforms before its gate failed.
The headless transform and geometry rays are therefore separate diagnostic
evidence, not a newly captured native frame. They prove the artwork/doorway
mismatch directly.

The fix extends existing relief clipping to the same lower entrance openings
used by the physical shell and to the hoist's authored upper entrance. It changes
only generated artwork pieces. Camera policy, input route, physics, real door
dimensions, source GLBs, UVs, materials, player rig and capture threshold remain
unchanged. Supported relief elsewhere and existing portal reveals remain.

`tests/lab-castle-doorway-relief.test.js` passes four independent geometry checks:
the archived ray, 300 production opening rays across all eleven lower entrances
and the hoist upper entrance, retained art outside the opening/opposite wall with
unchanged collision registries, and all existing portal-front reveals.

The strict full native continuous castle recording must be rerun on the combined
release candidate. Source-geometry success does not substitute for that native
recording. Failed original frames, neighbors, before/after rays and scope are
retained in the separate evidence archive.
