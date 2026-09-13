# W03 — bounded native capture recovery

Game source baseline: `bd0cc8c6f79e4772fb2a1d6d8dd807d2b8d8d6c7`, PR31. This evidence-only branch must not replace room21 with a parallel prototype. It changes no game source, models, geometry, routes or production dependencies.

The original run34762622264 completed all six cargo-first and all six recovery workers. All six longer scout-first workers hit the Puppeteer protocol deadline after approximately25minutes, before completion. The complete original parts remain valid but were not assembled because the matrix as a whole failed.

The retained cargo/recovery data are assembled in run34766049163, using the original state/pose/image hash validator. Scout-first is re-rendered there with12 strides, the exact original game revision/visual settings and a bounded28minute protocol timeout inside the30minute job budget. Source identity is checked before execution. The operational workflow does not claim a recording is successful until its concrete report and assembly pass.

This durable patch applies the same capture bounds: at most16parts,28minute protocol timeout,12scout workers and6workers for the shorter variants. The assembly stage selects the matching count. Manual dispatch is available. No assertion, physics step, video frame, route or quality setting is removed to fit a timer.

`node --test tests/w03-capture-assembly.test.js` passed13/13 locally on Node22.16.0: the previous10checks remain, plus a12part uneven tail, rejection of a missing worker, and rejection of a changed camera/portal pose digest. The YAML matrix was parsed and checked for exactly6/12/6complete unique part sets. These are capture-unit/configuration tests, not a new full campaign or hardware test.

Keep the recorded gameplay commit separate from the commit of this tooling patch. Do not update main or declare human/visual/platform acceptance from these tests. In the existing candidate's native flight footage at approximately50.67–50.82s, player framing is briefly poor during portal orientation transfer. That W01/W03 camera-polish observation is open and is not repaired by this recorder patch.
