import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runEchoHorizon} from '../src/game/LabEchoHorizonJourney.js';
import {installRoom21Aim} from '../src/game/LabRoom21Journey.js';
import {LabPreferences,CREATIVE_CAMPAIGN_REVISION} from '../src/game/LabPreferences.js';
const game=await createHeadlessGame();game.chamberEdition='foundation';
after(()=>{game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();});
for(const [aspect,options]of [[16/9,{}],[390/844,{swapColours:true}],[16/9,{missFirst:true}]])test(`new51 input route / ${aspect} / ${JSON.stringify(options)}`,async()=>{
 await game.selectLevel(50,false);game.camera.aspect=aspect;game.camera.updateProjectionMatrix();const cargo=game.cargo,body=game.physics.cargoBody;
 const proof=await runV8Journey(game,{journeyOptions:options});
 assert.equal(game.state,'won');assert.equal(proof.pass,true);assert.equal(proof.resets+proof.respawns,0);
 assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);assert.equal(game.firstLevel.shuttle,undefined);
 assert.ok(game.firstLevel.field.arrivals.every(hit=>hit.portalCrossings>0));
 assert.ok(game.firstLevel.field.arrivals.some(hit=>hit.receiver==='long'));assert.ok(game.firstLevel.field.arrivals.some(hit=>hit.receiver==='short'));
 if(options.missFirst)assert.ok(proof.milestones.some(m=>m.name==='missed coincidence decays without a checkpoint'));
 game.resetRun(true);assert.equal(game.firstLevel.coincidence.latched,false);assert.equal(game.firstLevel.field.packets.length,0);assert.equal(game.firstLevel.charge.value,0);
});
test('unlinked emitter hits a real support and cannot preassign a receiver',async()=>{
 await game.selectLevel(50,false);
 await runV8Journey(game,{scenario:d=>{d.walk(-1,14.7);d.until(()=>d.level.charge.value>.99,3,'No source load');assert.equal(game.interact(),true);d.wait(6);
  assert.equal(d.level.field.emitted,1);assert.equal(d.level.field.arrivals.length,0);assert.equal(d.level.field.absorbed.length,1);
  assert.equal(d.level.field.absorbed[0].crossings,0);assert.equal(d.level.coincidence.latched,false);
 }});
});
test('erasing the pair after actual transit does not recall the departed packet',async()=>{
 await game.selectLevel(50,false);
 await runV8Journey(game,{scenario:d=>{installRoom21Aim(d);const l=d.level;d.walk(-1,14.7);d.aim(0,l.intake.getFrame().center);d.aim(1,l.long.getFrame().center);assert.equal(game.interact(),true);
  d.until(()=>l.field.packets.some(p=>p.portalCrossings===1),3,'No real transit');const p=l.field.packets[0],position=p.position.clone();game.clearPortals();d.wait(.6);
  assert.equal(game.portals.ready,false);assert.ok(p.position.z>position.z+5.5);d.until(()=>l.field.arrivals.length===1,5,'Free packet did not arrive');assert.equal(l.field.arrivals[0].receiver,'long');assert.equal(l.coincidence.latched,false);
 }});
});
test('repeated hits on one membrane do not accumulate an imaginary second hit',async()=>{
 await game.selectLevel(50,false);
 await runV8Journey(game,{scenario:d=>{installRoom21Aim(d);const l=d.level;d.walk(-1,14.7);d.aim(0,l.intake.getFrame().center);d.aim(1,l.short.getFrame().center);
  for(let i=0;i<5;i++){d.until(()=>l.charge.value>.99,3,'Charge did not return');assert.equal(game.interact(),true);d.wait(1.6);}
  d.wait(3);assert.ok(l.field.arrivals.length>=4);assert.ok(l.field.arrivals.every(a=>a.receiver==='short'));assert.equal(l.coincidence.latched,false);assert.equal(game.state,'playing');
 }});
});
for(const x of [-21,0,21])test(`actual loaded approach and jumping cannot cross the unexcited gate at x=${x}`,async()=>{
 await game.selectLevel(50,false);let minZ=Infinity,maxY=0;
 await runV8Journey(game,{scenario:d=>{d.walk(8,16.9);d.pickup();d.walk(x,8);d.walk(x,-9.5);
  assert.ok(game.playerPosition.distanceTo(new THREE.Vector3(x,0,-9.5))<.3,'Attack must reach the real wall approach');
  for(let i=0;i<540;i++){if(i%55===0)game.input.jumpQueued=true;d.worldMove(0,-1);d.frame();minZ=Math.min(minZ,game.playerPosition.z);maxY=Math.max(maxY,game.playerPosition.y);}
  assert.ok(maxY>1,'Actually exercise jumping');assert.ok(minZ>-12.2,'Observer crossed an unexcited structural partition');assert.equal(game.firstLevel.coincidence.latched,false);assert.equal(game.state,'playing');
 }});
});
test('only the replaced room loses obsolete completion and hints, once',()=>{
 const key='brainrot-portal.preferences.v24',data=new Map([[key,JSON.stringify({campaignRevision:CREATIVE_CAMPAIGN_REVISION,completed:Array.from({length:51},(_,i)=>i),hints:{16:2,32:1,50:3},quality:'high',muted:true,volume:.23,resumeLevel:50})]]);
 const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},options={campaignRevision:CREATIVE_CAMPAIGN_REVISION,roomRevisions:{50:'echo-horizon-v1'}};
 const p=new LabPreferences(storage,options);assert.equal(p.value.completed.length,50);assert.deepEqual(p.value.hints,{16:2,32:1});assert.equal(p.value.quality,'high');assert.equal(p.value.volume,.23);assert.equal(p.value.resumeLevel,50);
 p.complete(50);const again=new LabPreferences(storage,options);assert.equal(again.value.completed.length,51);assert.equal(again.value.muted,true);
});
