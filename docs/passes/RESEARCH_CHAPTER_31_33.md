# Research chapter: rooms 31–33

Base: f8a652d7425d17b2a3378d2c77f3d97ba3f63958. Existing room indices,
character GLBs, portal warmup, floor backing and ramp controller fixes are retained.

## Playable mechanisms

31, Световая развязка: one projected solid-light sheet crosses a gap to a permanent
switching island, then is redirected toward a perpendicular receiving gallery.
The dark deck is independent of the light bridge. Clearing a link removes its
actual collision; the continuous service floor and return ramp allow rebuilding
it without restarting. Carry-first and scout-first routes are tested separately.

32, Запас хода: a portal-routed air ray must hit the front of the turbine. A heavy
rotor stores motion, and the selected worm drive raises a loaded cabin. Its other
cabin holds its height. A selector and two physical recall controls are visible.
The ordinary powered route and an ascent after disconnecting the portal pair use
the same mechanisms. The instrument reports actual speed, gear and air state.

33, Обратный вектор: two physical falls launch the same travellers to opposite
raised galleries. The first gallery exposes the second outlet's front. A solid
service core blocks the low sight line, not an invisible unlock flag. Its southern
service passage is an actual opening; the recovery ramp meets the low walkway
flush instead of disappearing beneath it. The test releases the companion on
permanent floors before shooting: shooting while carrying is still disallowed.

## Scope and verification

All three are enclosed laboratories with structural roofs, walls, supports,
material-separated casings and no plants or sky islands. Ordinary decks and ramps
are at least 8 m wide. The projected light causeway is 5.2 m wide. Existing source
models are reused unchanged. These rooms are appended to the main registry and
also available alongside 24/28/30 in the separate-save review edition.

`tests/lab-research-chapter.test.js` covers six routes at two aspect ratios, bridge
loss/recovery, a dry service return, finite mechanical energy and frame-step
agreement, absent input, physical roof coverage and the service passage. The
normal source suite and all previous thirty browser routes remain release gates.
The expanded registry changes expected counts from 30 to 33, not old assertions
about particular room mechanics. The public verification checks 30→31 and 33→1.

`scripts/research-browser.mjs` records native ordinary-input route excerpts and
separate labelled architecture inspection cameras. It checks the original
companion identity through the existing route driver and isolates classic saves.
Captured 15 frames per simulated second are not a device FPS measurement.

Final SHA-specific results belong to GitHub Actions, not this design note. The
local browser endpoint was blocked by its environment policy; native review uses
the repository's authorized CI browser. A scripted route is not a human playtest.
No claim of a guaranteed solve time, no possible shortcuts, universal absence of
stutter, or fixing the outstanding camera framing issue #58 is made here.
