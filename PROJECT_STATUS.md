# Current focus: one readable existing room

New content is paused. Only room 11 is being cleaned up; no new levels or GLBs. See `docs/ROOM_11_POLISH.md`. Keep the remaining nineteen rooms and source models unchanged. Publication still requires the full existing checks and actual single-room visual review.

# NESI — twenty physical workshops, V17

Repository: amazin20/nesi-brainrot. Vite / Three.js / cannon-es.
Live URL: https://amazin20.github.io/nesi-brainrot/
Confirm the exact public build-info.json commit, version v17-twenty and levels 20 against a successful Pages run before calling a revision live.

There are twenty active, selectable rooms: original introductory 1–5, revised 6–8, tangible replacements 9–10, and ten new workshop chambers 11–20. Rejected vector-maze control is not part of the active campaign. The seventh exit has a physical enclosed dock and low shot-only sightline, not merely a higher exposed ledge.

Nine supplied GLB derivatives (31–39) are integrated and articulated. Provenance: docs/WORKSHOP_ASSETS.json. First level loads four models, total campaign eighteen. Original characters remain. Read docs/RELEASE_V17.md for exact chamber concepts, animations, tests and limits.

Entry: src/main.js -> LabGame -> LabCampaignLevels. Workshops: LabWorkshopCampaign.js and LabWorkshopKit.js. Normal-control routes: LabV8Journey.js / LabWorkshopJourney.js. Ferry recovery: LabWorkshopRecovery.js. Full-world negative audit: scripts/v17-audit.mjs. Whole-inset pressure contact: LabPlateContact.js.

Verify npm run check, scripts/v8-package-check.mjs, v8-journey.mjs, v10-shortcuts.mjs, v17-audit.mjs, v17-recovery.mjs. Browser CI runs scripts/v8-browser.mjs and v8-yandex-browser.mjs. Yandex checks use a stub, not live ads; software CI FPS is not a hardware benchmark. No claim of 100 levels or exhaustive exploit-proofing.
