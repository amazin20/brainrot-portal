# Current candidate — portal shot contact and room 7–8 repair

Repository: amazin20/nesi-brainrot. Base main: 037b7a9fd1cf6a52588711d648dc4d1bae121977. Vite / Three.js / cannon-es, twenty active rooms. Work stays in a separate branch.

This pass integrates reviewed gameplay changes from PR14 candidate 446650cc4d16cc02e7e28adcffe5bcd12ae883be, excluding its later automatic-merge workflow. It repairs the balanced beam/support and room8 fan placement, and additionally makes room8 wind strength/radius agree with rotor spin-up, coast and the visible plume.

Travelling shots gain explicit outcomes, static front-face checking, live-transform/range/timing/level-lifetime safeguards, a larger coloured energy core and short trail, stronger local muzzle pulse, and distinct same-colour success/rejection effects. A constant shoulder offset clears the centre ray beside the avatar; a bounded low camera boom avoids the floor-induced close-up when aiming upward. Mouse/keyboard controls remain unchanged. Source GLBs and character rigs are retained.

Read docs/PORTAL_SHOT_CONTACT_REPAIR.md for reproducible cases and limits. The two user recordings were found, but the supported transfer returned HTTP502; their exact visual scenario has NOT been reviewed or declared fixed. Verify the actual main commit and public build-info.json before calling this candidate published.

Validation: npm run check; existing twenty physical journeys, shortcut/adversarial/recovery/carry suites; all original browser gates plus scripts/portal-shot-browser.mjs (trusted mouse input from room1 spawn and actual WebM). Public verification must check the exact revision, eighteen model hashes, room11 route and the new mouse-shot scenario.

Open master-TZ work: exact recorded portal failure; comprehensive room9–10 visual redesign; new full locomotion/emotion set; third-person portal-lens transition; volumetric wind/aperture clipping. These are not declared complete by the bounded changes above. SDK tests use a stub, not real ads; software rendering does not certify user-device FPS.
