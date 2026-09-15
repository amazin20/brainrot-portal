# Room 21 rebuilt demo — gantry patch delivery

The user explicitly requests the playable GitHub demo rather than another source archive. Base is PR #33 at fed8fe641aa55cc99938e8d33baef0ef6bc115a6. This increment transfers the previously delivered local gantry patch and its finite regression tests into the actual repository.

The only changed game module is LabRoom21BridgeArt.js: its visible stationary frame is raised to 12 m from y=0.08, and its collision bounds are rebuilt from that visible geometry. Original models, rooms 1–20, general physics and camera are unchanged. New tests exercise the ordinary two-jump shortcut and walking return, visible frame/collision agreement, and 36 explicit initial-condition carried-fling fixtures. The latter are not 36 full playthroughs.

Prior local evidence: 52 targeted tests passed, six ordinary gantry approaches recovered without bypass, production build and package check succeeded. These are historical local checks, not a substitute for the new exact-commit GitHub checks.

Before demo publication require the full existing campaign verification and the rebuilt-room browser review for this new commit; inspect its new native images. Preserve all existing deployment gates and public-site verification. Publication is a development preview at the user's request, not final W03 acceptance or a promise of no undiscovered shortcuts.

Known remaining limits: inclined-exit player framing, full rebuilt-route video, human difficulty/readability testing, hardware measurements and final art review. The stable-ID W10 package and W02 isolated prototype are not included. Issue #32 remains open for acceptance and further testing.
