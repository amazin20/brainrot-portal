import fs from 'node:fs';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
fs.mkdirSync('qa',{recursive:true});
const g=await createHeadlessGame();g.chamberEdition='foundation';const reports=[];
for(const n of (process.env.ROOMS||'1,2,3,4,5').split(',').map(Number)){
 await g.selectLevel(n-1,false);
 try{const report=await runV8Journey(g,{journeyOptions:{alternate:process.env.ALTERNATE==='1',recover:process.env.RECOVER==='1'}});reports.push(report);console.log('FOUNDATION',n,report.pass,report.frames,report.teleports);}
 catch(e){console.error('FOUNDATION FAILED',n,e.stack);console.error('PLAYER',g.playerPosition.toArray(),'CARGO',g.cargo.position.toArray());console.error('PORTALS',g.portals.portals.map(p=>p&&p.position.toArray()));process.exitCode=1;break;}
}
fs.writeFileSync(process.env.OUT||'qa/foundation-headless.json',JSON.stringify(reports,null,2));
