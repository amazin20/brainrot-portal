# NESI current delivery — V12

Repository: amazin20/nesi-brainrot. Vite / Three.js / cannon-es.
Entry: src/main.js → LabGame → LabCampaignLevels.
Ten active rooms: five unchanged introductory rooms plus five progressively larger multistage rooms. No checkpoints or hidden mechanism-use win flags.
New definitions: LabExtendedCampaign.js. Existing first five: LabIntroductoryCampaign.js.
New route driver: LabExtendedJourney.js; all routes enter through LabV8Journey.js.
Original meshes retained; carried friend animation suppression fixed; broader player body/arm motion. Upper-right HUD: Arabic level number only; desktop menus: Escape.
Read docs/RELEASE_V12.md for the exact scope, tests, honest limits and pending extra GLBs.
Verify: npm run check; node scripts/v8-journey.mjs; node scripts/v10-shortcuts.mjs; node scripts/v12-shortcuts.mjs. CI runs both production browser scripts before deployment.
Live site: https://amazin20.github.io/nesi-brainrot/ . Confirm public build-info.json matches the successful deploy commit before calling it updated.
