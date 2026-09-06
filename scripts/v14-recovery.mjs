import fs from 'node:fs';
import {createHeadlessGame} from './lab-headless.mjs';
import {runRecoveryJourney} from '../src/game/LabRecoveryJourney.js';
const g=await createHeadlessGame();await g.selectLevel(9,false);
try{const r=await runRecoveryJourney(g);console.log(JSON.stringify(r,null,2));fs.writeFileSync('qa/v14-recovery.json',JSON.stringify(r,null,2));}finally{g.physics.dispose();g.portals.dispose();}
