# V12 — ten playable chambers

Base: main 4e631d13 (the five working rooms). The first five definitions are preserved byte-for-byte in LabIntroductoryCampaign.js. LabCampaignLevels.js joins the introductory and extended registries.

## New playable rooms
6. Высота взаймы: use the friend's live weight to raise a portal-bearing elevator, reach the fixed gallery, create an independent receiving portal, return to a sightline to the load, and recover the friend. Removing weight lowers the elevator.
7. Эстафета импульса: two gravity wells, two hinged exits and one portal pair, with a sealed intermediate chamber.
8. Три долга: retrieve the same friend after each of two independent reversible weight gates, then solve the load-driven elevator.
9. Цена высоты: a reversible gate, a borrowed-height elevator and two consecutive gravity/angle transfers.
10. Архитектор маршрута: two gates, the load elevator and two gravity wells; five connected physical sections, each requiring setup and recovery.

The new footprints grow, and their stage counts are 1, 2, 3, 4, 5. Each stage itself has several ordinary input actions. All use original cached meshes. The nine campaign GLBs remain the only downloaded assets; the first level still starts with four. No invisible mechanism-use completion flags, scripted launch boosts or checkpoints are introduced. Alternate physically valid solutions are allowed.

## Life and UI
The upper-right HUD contains only the Arabic level number. The pause glyph and question mark are absent there. Desktop settings/hints remain on Escape; touch pause remains in the touch controls.

The player's chest/pelvis counter-motion is broader; a relaxed left-arm swing and smooth acknowledgement gesture preserve the original model, foot contacts and held-device grip. The friend no longer suppresses its anatomy animation just because its held body is airborne. Head, fins, tail, pickup/release reactions and flight bracing are more expressive without writing physical transforms. This is procedural animation, not motion capture.

## Verification and publication
Commands: npm run check; node scripts/v8-journey.mjs; node scripts/v10-shortcuts.mjs; node scripts/v12-shortcuts.mjs; scripts/v8-browser.mjs; scripts/v8-yandex-browser.mjs.

Local baseline for this source: 245 unit tests, all ten normal-control physical journeys, 540 new-stage adversarial jump trials and 370 early-sightline probes. Positive journeys never assign actor transforms or mechanism targets. Jump fixtures deliberately start at reachable edges and include sprinting, carried/unladen states and a 0.9 m extra height allowance. The earlier 180-trial introductory audit is retained.

Publication must additionally pass actual Chromium/WebGL routes, real menu buttons, Arabic-only level HUD, sound/settings persistence and the Yandex callback-contract stub. The deployment checks public build-info.json for its exact commit, ten levels and v12-ten. A successful source build alone is not a published demo. CI's software renderer is not a user-device performance benchmark; SDK stubs are not real ads or revenue verification. These are bounded tests, not an exhaustive proof against every imaginable exploit.

## Not part of this release
The seven previously supplied additional static GLBs are not silently substituted or claimed integrated. New single-object pictures requested in this conversation are art concepts for later mechanics, not screenshots or completed 3D assets. Only ten levels are implemented, not the planned one hundred.
