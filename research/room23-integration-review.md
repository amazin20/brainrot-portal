# Room23 physical integration checkpoint

This isolated candidate combines the frozen ownership-v2 source, the successful
ordinary-spawn journey geometry, and the constraint-contract regressions. It
keeps the physical builder explicitly enabled through
`game.room23PhysicalPrototype === true`; the resulting level exposes
`level.room23PhysicalPrototype === true` for route dispatch.

The production route adapter is
`runRoom23PhysicalJourney(d, options)` from `LabRoom23PhysicalJourney.js`.
It uses the standard journey controls, camera, jump and E inputs. It does not
set actor poses, mechanism targets, forces, collision state, or win flags.

## Source provenance

The original worktrees were read and snapshotted, not edited. The integration
checkout starts from constraint checkpoint
`c74138c716a2f276ba46042472452971ca46f1f1`. The ownership-v2 worktree was based on
`85110688317bd150f93d31fad144dacc24c7502e`, and the journey worktree on
`804bed87639df7603ad529a53a3f22579a91105b`; their current source/test bytes were
dirty worktree snapshots, not assumed to be those commits' bytes. The frozen
snapshot manifest SHA-256 is
`44e67fe4d734055547a97cc27f3f781d820bfb814760865760aef37f95c6ea14`.
Ownership-v2 already implements a superset of the earlier contract fix; its
implementation is retained alongside the earlier five regression tests.

## Reproduced gameplay defects and fixes

Ordinary movement into the open shaft let the dynamic traveller continue below
-5,000 metres while the game stayed playing. Its controller had bypassed the
shared void check. The dynamic wrapper now invokes the same whole-room restart
below -12 metres between physics steps. The regression walks into the shaft and
verifies recovery of the original cargo and traveller, initial mechanisms, and
cleared portals. This adds no checkpoint.

Repeated ordinary jumps could put 1,117 N of passenger support on the freight
pan's narrow backstop and pulse its compression-driven supply without original
cargo contact. The same visible bumper is now carried by the cabin, so this
footing loads the cabin instead of the freight spring. The reproduced reach
attempt's passenger spring support and unintended supply steps both became zero.
The original still reaches the pan through real delivery and handoff contacts.

## Validation and limits

The final default adapter reached joint `WON` from the normal authored spawn in
14,957 physics steps with the same original body/shape. The recorded route had
zero interval resets and zero respawns. The legacy driver's setup still calls
`resetRun(true)` before its observed route; setup calls are recorded as
`[false, true]`, not hidden or counted as zero.

The frozen-default proof JSON SHA-256 is
`a0161d194b69dfa35b47ede8576ddf27f1b4ae06f3b361ef82e8c3558de478ac`.
All seven source hashes in that proof match this frozen source. Its native,
public, source-acceptance and unique-master flags remain false.

All 39 focused tests passed with zero failures, cancellations, skips or TODOs:
the earlier 32 checks, five ownership-v2 additions, and two ordinary-input
gameplay regressions. `npm run build` passed; the campaign reported 6.92 MB of
complete files before ZIP. The existing chunk-size warning remains.

Bounded ordinary-input probes also attempted direct ground goal jumps, repeated
roof jumps, ascent without high delivery, skipping the opposite-pan transfer,
return while still holding the original, and early release onto the permanent
landing. They produced no `WON`. This is specific attempted-route evidence,
not an exhaustive claim that all shortcuts are absent. A dangerous shaft fall
was retained as a recovery regression rather than called a successful shortcut.
Fresh native browser validation and default activation remain separate work.
