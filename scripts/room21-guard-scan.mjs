import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHeadlessGame} from './lab-headless.mjs';
import {probeRoom21ClosedGuard} from './room21-guard-probe.mjs';
const game=await createHeadlessGame();await game.selectLevel(20,false);
const cases=[];let failure;
try {
 for(const offset of [-1.4,0,1.4])for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const steer of [-1,0,1]) {
  const result=probeRoom21ClosedGuard(game,{offset,yaw,steer});cases.push(result);
  console.log(JSON.stringify(result));assert.equal(result.pass,true,'Guard fixture failed or did not exercise its transfer');
 }
} catch(error) {failure=error.stack;throw error;}
finally {
 const out=process.env.EVIDENCE_OUT||'qa/room21-guard';fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(`${out}/audit.json`,JSON.stringify({scope:'36 declared initial-condition fixtures. NOT a full route, visual test or proof for all reachable poses.',failure,
  cases,pass:cases.length===36&&cases.every(c=>c.pass)},null,2));
 game.physics.dispose();game.portals.dispose();
}
