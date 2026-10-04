import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const game=await createHeadlessGame();game.chamberEdition='foundation';
const results=[];
async function prove(id,options){
 await game.selectLevel(33,false);
 try{const report=await runV8Journey(game,options);const s=game.firstLevel.pressureState;report.mechanism={pressure:s.pressure,mode:s.mode,doorTravel:s.doorTravel,cargoTransports:game.physics.portalTransports,attackEvidence:game.firstLevel.attackEvidence};results.push({id,pass:report.pass,report});console.log('PASS',id,report.frames);}
 catch(error){const s=game.firstLevel.pressureState;results.push({id,pass:false,error:String(error),player:game.playerPosition.toArray(),cargo:game.cargo.position.toArray(),pressure:s.pressure,mode:s.mode});console.error('FAIL',id,error.stack);}
}
await prove('canonical-charge-deliver',{journeyOptions:{route:'charge-then-deliver'}});
await prove('inspect-unsealed-first',{journeyOptions:{alternate:true}});
await prove('recover-early-discharge',{journeyOptions:{recover:true}});
await prove('unsealed-valve-sprint-jump-and-low-window',{scenario:d=>{
 const s=d.level.pressureState;
 d.walk(-9,8.65);d.wait(12);assert.ok(s.pressure<3);
 assert.equal(game.interact(),true);assert.equal(s.mode,1);
 const approaches=[];
 for(const x of [-2.2,0,2.2]){
  d.walk(0,0);d.walk(x,-4);game.input.keys.add('ShiftLeft');let nearest=Infinity;
  for(let frame=0;frame<240;frame++){
   game.input.jumpQueued=frame%16===0;d.worldMove(0,-1);d.frame();nearest=Math.min(nearest,game.playerPosition.z);
   assert.notEqual(game.state,'won');assert.ok(game.playerPosition.z>-7.3,'an unsealed supply must not let the player bypass the pressure partition');
  }
  d.stop();approaches.push({x,nearest,doorTravel:s.doorTravel});
 }
 d.walk(0,0);d.walk(-13,6.5);let minimumX=Infinity;
 game.input.keys.add('ShiftLeft');
 for(let frame=0;frame<240;frame++){
  game.input.jumpQueued=frame%16===0;d.worldMove(-1,0);d.frame();minimumX=Math.min(minimumX,game.playerPosition.x);
  assert.ok(game.playerPosition.x>-15.3,'the human capsule cannot enter the cargo service window through sprint/jump spam');
 }
 d.stop();assert.equal(game.physics.portalTransports,0);assert.equal(game.teleportCount,0);assert.ok(s.pressure<3);
 d.mark('Unsealed pressure and fast repeated jumps cannot cross the human partition or low cargo window');
 d.level.attackEvidence={approaches,minimumX};
}});
const output={scope:'Real production 120 Hz room 34 controls, complete canonical/alternate/recovery journeys, plus explicit fast-input attacks against unsealed geometry. Routes do not assign actor poses, portal poses, mechanism targets or completion flags.',pass:results.every(r=>r.pass),results};
fs.mkdirSync('qa',{recursive:true});fs.writeFileSync(process.env.OUT||'qa/pressure-room34-adversarial.json',JSON.stringify(output,null,2)+'\n');
game.firstLevel?.dispose?.();game.physics.dispose();game.portals.dispose();
if(!output.pass)process.exitCode=1;
