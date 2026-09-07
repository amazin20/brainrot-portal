import fs from 'node:fs';
import {createHeadlessGame} from './lab-headless.mjs';
import {runRecoveryJourney} from '../src/game/LabWorkshopRecovery.js';
const game=await createHeadlessGame();
try{
 await game.selectLevel(16,false);
 const report=await runRecoveryJourney(game,{onMilestone:m=>console.log(m.name,m.player)});
 fs.mkdirSync('qa',{recursive:true});fs.writeFileSync('qa/v17-recovery.json',JSON.stringify(report,null,2));
 console.log('PASS empty ferry, unprepared fall, stairs, winch recall and same-companion recovery',report.frames);
}finally{game.physics.dispose();game.portals.dispose();}
