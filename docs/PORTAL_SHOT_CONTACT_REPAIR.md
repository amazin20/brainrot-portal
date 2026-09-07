# Portal contact, shot readability and room 7–8 follow-up

Base: `037b7a9fd1cf6a52588711d648dc4d1bae121977`. Twenty existing rooms; no new models or rooms.

## Evidence boundary

The requested user videos `20-48-15.mp4` and `15-24-55.mp4` were found by exact filenames and IDs. Their supported download returned HTTP502, including a retry for the latest recording. No frames were obtained. This delivery cannot claim the exact recorded failure has been reproduced or resolved.

Production-geometry probes use the real GLB/Draco meshes, but do not render their textures. The new isolated shot regression suite exercises `firePortal`, its preparation/launch and swept impact. Positive browser evidence separately starts from the authored room1 spawn and uses trusted pointer-lock mouse movement plus left/right clicks. No actor positioning, direct portal placement, manual simulation or win flags drive that browser scenario.

## Changes

- Keep collision ownership local to the surface; unrelated foreground geometry still wins the first hit. Static panels validate their front face just as moving panels do.
- Resolve the current world transforms at simulation time. Charge flight uses only the portion of a step after preparation completes.
- Track accepted/refused commands and final outcomes. Misses and invalid impacts preserve the existing pair; pause freezes charges and reset invalidates old events.
- A coloured elongated core, short plasma tail and rotating arc replace the tiny sphere. Local muzzle expansion, colour-matched light and original synthesised sound provide feedback. Success expands outward; rejection collapses into the same channel colour. Effects use bounded reusable pools and do not write camera or actor transforms.
- The steady shoulder offset is 1.4m; the low end of the camera boom stays within0.65m below its focus before the existing collision sweeps. This opens the centre ray beside the avatar and prevents upward aiming from collapsing the camera against the floor. It introduces no fire-triggered camera motion. Actual animated-skin ray tests cover room1 entry/exit and room11 intake/high aim: all four targets and impacts are clear, with at least half of travelling-charge frames unobscured. Very early charge frames can still pass behind the visible character.
- Integrate the eight gameplay/source/test/doc files reviewed in PR14 candidate `446650cc4d16cc02e7e28adcffe5bcd12ae883be`. Its subsequent automatic merge/publication workflow is excluded. See `BALANCE_AND_UPDRAFT_REPAIR.md` for model geometry changes.
- Room8 wind now shares radius1.65 with its plume, weakens at the edge and follows the rotor during acceleration and coast. Before: initial centre acceleration was70m/s², identical to steady state; edge force also70; disabling immediately removed force. After: first tick0.058m/s², steady69.288, first coast tick66.239, after1s0.299, stopped0. The ordinary room8 route remains unchanged.

## Verification and remaining work

Run `npm run check` and the existing campaign scripts. CI retains the existing full production/browser/SDK gates and adds `portal-shot-browser.mjs`. It preserves four ordinary mouse shots (blue, amber, blue reposition, dark-wall rejection), screenshots, event/flight timing and `mouse-portal-shots.webm`. `verify-public.mjs` repeats that scenario on the published URL after the exact revision and all runtime model hashes are checked.

These finite fixtures do not certify every camera angle, hardware FPS, or human puzzle quality. The exact inaccessible recording, room9–10 art overhaul, full locomotion/emotion set and portal-camera transition remain open. Wind still uses the existing centre-line path; this is not a volumetric aperture/obstacle transport rewrite.
