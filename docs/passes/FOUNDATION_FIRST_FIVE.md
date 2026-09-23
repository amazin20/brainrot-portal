# A new beginning, not a renumbering of rooms 31–33

Base: `711a47fa70afbfb97dc4bd69f0b88b9b5b65b45e`.

The human default opens a new numbered opening, 1–5, with independent progress.
The previous 33-room registry and its original mechanisms remain accessible as
`edition=classic`; explicit later bookmarks and `edition=open` remain supported.
A new user is not dropped into an unexplained room 31. Completion of new room 5
says the FIRST CHAPTER is finished, not that all archive rooms were rebuilt.

## Different questions, gradually combined

1. **По ту сторону.** A raised gallery is visible from the start. Two equivalent
   entry surfaces allow either side. First learn movement, the linked pair and
   carrying the same companion. Scout above and return before carrying also works.
2. **Свет под ногами.** The connection carries a solid light sheet. No timed door,
   precision platforming or extra machine. Extinguishing the path leads to the
   lower service floor; a continuous visible ramp returns to the original deck.
3. **Адрес в движении.** A portal rides on a suspended cabin between different
   heights. Ride with the companion or send the empty cabin, physically return
   to the original entry, and arrive where that same linked surface has moved.
   Independent cabin and gallery controls and real hangers explain the machine.
4. **Цена высоты.** One actual falling impulse introduces a fling. A high drop and
   tilted outlet are visible; stepping into the floor aperture does not invent a
   launch bonus. A service floor and two broad ramp connections permit recovery.
5. **Одной парой.** The pair is shared by air, a loaded lift and solid light.
   The rotor retains motion and the worm drive retains height. Lift first then
   project the bridge, or charge the rotor, project first, then ride using stored
   energy. Recall permits returning to the companion after a fall from the landing.

These are learning goals and tested interactions, not measured human solve times.
The existing chamber kit supplies closed roofs/walls, separated materials, bolted
panels, support structures, filtered deck joints and original character assets.
No cloned character, floating sky map or plants used to fill empty space.

## Bugs found during exploratory routes

- The initial projector support blocked the lower return ramp in room 2. Move
  the machine off that passage instead of removing its physical collision.
- Air could strike an incorrectly positioned motor pedestal before reaching its
  front grille in room 5. The pedestal now sits below/behind the actual receiver.
- An inaccurate pair height could place the light sheet under a deck chassis.
  The introductory optical mounts now physically bound vertical aperture motion
  using the pre-existing general portal-fit rule. The sheet is 0.20 m above the
  deck before offsets; supported offset combinations remain within a normal step.
  Light is still ray-traced and clipped by both real portal ellipses. No invisible
  path or scripted activation is added. The freer late research mounts are unchanged.
- A bumped waiting companion could fall from the permanent room-5 landing. A
  visible, collidable perimeter rail catches it while the cabin and bridge mouths
  remain open. Companion behavior and identity are not disabled or replaced.
- The old menu still described the six-room review as three rooms. Counts and
  the three clearly labelled campaign entry links now reflect actual registries.
- Desktop instructions no longer mistake the presence of touch-control options
  for an actual coarse-pointer device in this chapter.

## Reproduction and evidence boundaries

`node --test tests/lab-foundation.test.js` verifies two camera aspect ratios for
all five ordinary routes, alternatives, leave/return for the original companion,
independent progress, physical enclosure, idle non-completion, tutorial independence,
and deliberately displaced optical placements. Placement-level fixtures are marked
separately from full ordinary-input route tests; they do not stage a walkthrough.

`scripts/foundation-browser.mjs` uses the public default URL, no `edition` override,
checks the actual first-five menu, preserves archive/review saves, tests ordinary
and alternative routes, detects in-play shader linking and page errors, and clicks
the actual next-level button including 5→1. Native game frames are separate from
source physics checks. Recording is 15 frames per simulated second, not device FPS.

The original 33 source/physical/browser gates remain. Old browser probes explicitly
select `edition=classic` because their purpose is still to test the original rooms,
not silently run their old coordinates through a different new room. Their actual
assertions and route scenarios are retained. The public deployment also checks the
new default campaign; it does not rely solely on archive results.

Local Chromium navigation was blocked by administrator policy. Authorized repository
CI performs the native browser review; no workaround changes the local policy.
Final source SHA, native reports and publication status belong to GitHub Actions.
A route script does not establish human fun, a guaranteed difficulty curve or the
absence of every possible shortcut. No universal FPS guarantee or fix to camera
issue #58 is claimed by this chapter.
