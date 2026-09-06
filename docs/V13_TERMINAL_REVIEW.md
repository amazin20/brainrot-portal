# Final V13 interaction review

The successful dedicated baseline is documented in RELEASE_V13.md and qa/V13_VERIFIED.json (258 tests, all ten Chromium routes). A subsequent manual shortcut review found that range-only terminal interaction could operate the mirror from outside the cabin wall, even though the capsule could not enter.

The final source adds terminalAccessible: a range and solid-occlusion check from the player's hand height to the console. Only that console's own collision shell is excluded; cabin walls, glass and other devices remain blockers. Both the contextual prompt and E interaction use the same predicate. This change is applied to all five new rooms, with no change to the first five layouts.

A new test rejects access from four outside positions and accepts interaction from inside. The local complete suite now passes 259 tests; all ten ordinary-control routes still complete without respawns or companion resets. The final PR and Pages workflows repeat the complete source, negative-audit and production-browser checks on this final code before publication. Do not substitute the earlier baseline commit for the final deployed SHA.
