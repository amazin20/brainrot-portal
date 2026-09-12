import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom20} from '../src/game/LabRoom20Journey.js';
const game=await createHeadlessGame();after(()=>{game.physics.dispose();game.portals.dispose();});
for(const [order,aspect] of [['cargo-first',16/9],['scout-first',1.6]])test(`braided exchange completes ${order} at ${aspect} through real optics, free cargo and steering`,async()=>{
 await game.selectLevel(19,false);game.camera.aspect=aspect;game.camera.updateProjectionMatrix();const body=game.physics.cargoBody;
 const seen=[];
 const report=await runV8Journey(game,{scenario:d=>runRoom20({...d,mark(name){
  const s=d.level.state;
  if(name==='loaded mirror raises the first crossing'){
   assert.equal(s.optical.loaded,true);assert.deepEqual(s.optical.receivers,[false,true]);assert.equal(s['first-cage'].powered,true);assert.equal(s['return-cage'].powered,true);assert.equal(s['second-cage'].powered,false);assert.equal(s.funnel.enabled,false);
   assert.ok(s.optical.segments.some(x=>x.kind==='portal')&&s.optical.segments.some(x=>x.kind==='mirror'));
  }
  if(name==='a new view of the original counterweight'){
   assert.deepEqual(s.optical.receivers,[true,false]);assert.ok(game.cargo.position.y>8&&game.cargo.position.y<9);assert.ok(game.playerPosition.y>15.9);assert.ok(s['return-cage'].position.y<16.1);
  }
  if(name==='final field transfer over the shared hub'){
   assert.deepEqual(s.optical.receivers,[false,false]);assert.equal(s.funnel.enabled,true);assert.ok(game.heldCube);assert.ok(game.playerPosition.y>21.9);
  }
  seen.push(name);d.mark(name);
 }},{order})});
 assert.equal(report.pass,true);assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);assert.equal(game.physics.cargoBody,body);
 assert.equal(game.firstLevel.id,'braided-exchange');assert.ok(game.heldCube);assert.ok(Math.abs(game.playerPosition.y-20)<.1);
 assert.ok(seen.includes('cargo exchange changes the live optical branch'));assert.ok(seen.includes('steering across the suspended return'));
 assert.equal(seen.includes('unloaded exchange seen from the court'),order==='scout-first');
});
test('an interrupted occupied car falls under its counterweight and the entire exchange remains solvable',async()=>{
 await game.selectLevel(19,false);game.camera.aspect=16/9;game.camera.updateProjectionMatrix();
 const report=await runV8Journey(game,{scenario:d=>runRoom20(d,{interruptPower:true})});
 assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);
 const lost=report.milestones.find(m=>m.name==='occupied exchange car loses the real ray');assert.ok(lost);assert.ok(lost.player[1]<.1&&lost.cargo[1]<1);
});
test('both freight pockets retain the original free body after their flywheels coast down completely',async()=>{
 await game.selectLevel(19,false);game.camera.aspect=16/9;game.camera.updateProjectionMatrix();let pauses=0;
 const report=await runV8Journey(game,{scenario:d=>runRoom20({...d,mark(name){
  d.mark(name);
  if(name==='a new view of the original counterweight'||name==='original load rests in the final pocket'){
   const upper=name==='original load rests in the final pocket';d.wait(35);pauses++;
   assert.ok(d.level.state.offloaderDrive.speed<.08,'Real shaft inertia must decay without a power ray');
   assert.ok(Math.abs(game.cargo.position.y-(upper?22.415:8.415))<.2,'Cargo must settle on the actual pocket floor');
   assert.ok(d.level.cargoOnAnyPad(),'Free cargo remains supported without freezing its body');
  }
 }})});
 assert.equal(pauses,2);assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);
});
