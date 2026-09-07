# Current work — balance and updraft model repair

Repository: amazin20/nesi-brainrot. Vite / Three.js / cannon-es. Twenty active rooms; no expansion in this pass.

Published baseline is 037b7a9fd1cf6a52588711d648dc4d1bae121977 (merged PR13, successful deployment/public verification run 34134601153). It contains the recorded carry/wall recovery fixes, actual wind and automatic receiver in room11, wandering, travelling portal shots and removed F/X controls. Do not incorrectly report these as unimplemented; read docs/VIDEO_REPAIR_V18.md for scope.

This candidate repairs the supplied seesaw in room7 (both ends on one rigid beam, uniform proportions, fixed bearing/stand, visible deck matching physics and tapered base contact) and the grounded front-emitting fan/soft airflow in room8. Source GLBs, character rigs, other eighteen room definitions and existing full verification gates are retained. No replacement assets or new puzzle mechanic. Details and measured defects: docs/BALANCE_AND_UPDRAFT_REPAIR.md.

Local results: 319 unit tests + production build; all twenty normal-control physical journeys; 180 introductory + 372 full-world negative trials; ferry recovery; recorded carry fixture at 30/60/144 Hz. Full existing browser/visual/public verification remains required before calling the candidate published. Check the actual main commit, successful deploy run and public build-info.json, not stale chat claims.

Still separate work: comprehensive room9–10 visual redesign, a new full player locomotion/emotion set, and third-person portal-camera crossing presentation. Finite tests are not a universal quality or performance guarantee.

Commands: npm run check; node scripts/v8-package-check.mjs; node scripts/v8-journey.mjs; node scripts/v10-shortcuts.mjs; node scripts/v17-audit.mjs; node scripts/v17-recovery.mjs; node scripts/video-repro.mjs. Existing CI additionally runs scripts/v8-browser.mjs, scripts/video-repair-browser.mjs and scripts/v8-yandex-browser.mjs. Public verifier checks exact revision, 18 model hashes and public room11 completion. SDK checks are callback stubs, not live ad-delivery or moderation certification.
