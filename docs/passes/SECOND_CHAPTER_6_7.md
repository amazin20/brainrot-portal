# Second foundation chapter, levels 6–7

Base: e9fefd03726e706b3fd6e55775e52fd112bd146d. The original foundation 1–5,
classic archive 33, research review and thirteen runtime character/mechanism GLBs
are retained. This is an extension from five to seven, not five more rooms or a
completed full-campaign redesign. No preference migration/reset is performed.

## New choices

6, Вес решения: two lift cabins share eight metres of cable travel. Effective
loads through the reduction gear are marked (traveller 1, original companion 2).
A heavier side descends; the other rises. The common brake locks both positions.
It is operated on each cabin and at the service floor. Normal and alternate
routes respectively raise the player using the companion as counterweight, or
lower both travellers and use the newly raised destination through the same
moving pair. Retrieval after a fall retains the same companion and brake state.
The balance has damping and end stops; no sequence flag or timer unlocks it.

7, Смена назначения: one rail carriage has a low optical window and a higher
walk-through window, with shared movement. Light first reaches the permanent
relay gallery; a real switch moves the carriage to the other berth. Walking
around an opaque cabinet exposes its usable portal face. The same pair changes
from an optical route to transport, then back to light toward the exit. The
companion can wait on a marked permanent bay outside the moving light sheet.
The service recall remains reachable after losing both portals and falling.
The same actual stairs return to the dispatch dock, without a hidden teleport.

Both rooms are enclosed laboratories built with the existing manufactured kit.
New content reuses the original traveller models. No plant filler or sky scene.
Permanent decks have at least eight-metre dimensions; optical bridges are 4.8 m
wide, clipped by actual portal apertures. The capsule and collisions are not
shrunk or disabled to make solutions pass.

## Corrections found during exploratory route work

- A walking portal on a counterweight cabin was initially too high to re-enter
  after arriving through it. Its physical mount was lowered to 2.35 m above the
  deck; existing aperture and capsule rules are unchanged.
- A proposed return incline collided with the remote dock. It was replaced with
  twenty closed 0.25 m stair risers, eight metres wide, in the service zone.
- The projector's support crossed its low aperture; the physical support was
  relocated lower, not made intangible.
- A companion left ON the moving light sheet can be displaced by that support.
  The permanent waiting bay is clearly separate and tested; this is not a claim
  that a companion on temporary moving support will remain magically fixed.
- The second-chapter service-return scenario clears both links AFTER transfer,
  returns the carriage through the real floor console, climbs the stairs and
  returns to the unchanged companion before completing the ordinary solution.

## Reproduction and acceptance

`node --test tests/lab-second-chapter.test.js` exercises conservation, equal and
absent loads, braking, reversal, bounded timesteps, validation, six routes at
16:9 and 9:16, unchanged save keys, aperture tolerance, and aligned light meshes
and collision at both carriage positions. Existing first-five and archive
assertions remain; only the explicit foundation registry/transition counts grow.

`ROOMS=6,7 RECORD=1 node scripts/foundation-browser.mjs` repeats ordinary,
alternative and recovery inputs in native production WebGL, checks exact build
SHA, default menu and metadata, original companion, absence of new shader links,
archive save isolation, and real next-button transitions 6→7→1. The full matrix
also verifies 5→6 and every earlier room. Captured excerpts are 15 frames per
simulated second, not device FPS or full human playthroughs.

Native visual acceptance, final test numbers and publication are recorded per
exact SHA in GitHub Actions. Local results do not imply completed deployment.
Camera issue #58 and hardware stutter remain outside this chapter's claimed fixes.
