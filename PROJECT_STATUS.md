# Current candidate — V18 core video regressions

Base main: 228accb2bfce4ff620c743f68c3d52c2e9e46a4d. Repository: amazin20/nesi-brainrot. Vite / Three.js / cannon-es, twenty active rooms.

Current work addresses the user video: stable collision-aware held companion, wall/corner recovery, physical wind and automatic drive in room 11, wandering instead of a global stay flag, travelling portal shots/weapon turn pose, and removed F/X aim/clear controls. The stronger grip exposed a hand-press bypass in room 9: its real open-top protective enclosure now retracts after piston compression.

All normal journeys now fire travelling charges, not instant placement or debug aim. Geometric unit fixtures still have a direct placement method. Original GLBs are unchanged. New wind brace and curiosity/recovery cues retain the existing rig and hands/feet contacts.

Read docs/VIDEO_REPAIR_V18.md. The comprehensive room7–10 art cleanup, full new locomotion set and portal-lens transition redesign are NOT claimed completed. No new levels have been added.

Verify npm run check; node scripts/v8-journey.mjs; node scripts/v10-shortcuts.mjs; node scripts/v17-audit.mjs; node scripts/v17-recovery.mjs; node scripts/video-repro.mjs. CI must also pass scripts/v8-browser.mjs, scripts/video-repair-browser.mjs, scripts/v8-yandex-browser.mjs. Publication requires the exact public revision/model hashes and a real public room-11 route. Before those checks, this status is a candidate, not a live-release claim.
