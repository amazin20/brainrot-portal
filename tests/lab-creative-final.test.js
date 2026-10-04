import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runCreativeFinal} from '../src/game/LabCreativeFinalJourney.js';

async function room(n){const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(n-1,false);return g;}
function close(g){g.physics?.dispose();g.portals?.dispose();}
function pickup(d){const c=d.game.cargo.position;d.walk(c.x+1.2,c.z);d.pickup();}

test('36: carrying and running across the high gap cannot supply rotor angular momentum',async()=>{
 const g=await room(36);
 try{const report=await runV8Journey(g,{scenario:d=>{
  pickup(d);d.walk(-10.2,-13);g.input.keys.add('ShiftLeft');g.input.jumpQueued=true;
  for(let n=0;n<120;n++){d.worldMove(1,0);d.frame();}d.stop();d.wait(1);
  assert.equal(g.state,'playing');assert.ok(g.heldCube);
  assert.ok(g.playerPosition.y< -3.9,'The gap must have a genuine lower recovery floor');
  assert.equal(g.firstLevel.rotor.angle,0,'Held cargo cannot turn the protected dynamic rotor');
  assert.ok(g.firstLevel.bridge.at(0),'The unpowered bridge must remain out of its upper receiving dock');
 }});assert.equal(report.resets+report.respawns,0);}finally{close(g);}
});

test('37: direct carrying around the outer gallery meets the closed receiver door',async()=>{
 const g=await room(37);
 try{const report=await runV8Journey(g,{scenario:d=>{
  pickup(d);d.walk(-23,10);d.walk(-23,-10);d.walk(0,-10);
  assert.throws(()=>d.walk(0,-22),/Blocked walking|Walk timed out/);
  assert.equal(g.state,'playing');assert.ok(g.heldCube);
  assert.equal(g.firstLevel.receiver.loaded(),false);
  assert.ok(g.firstLevel.door.progress<.01);
  assert.ok(g.playerPosition.z> -11,'Receiver partition must physically stop the full-height player');
 }});assert.equal(report.resets+report.respawns,0);}finally{close(g);}
});

test('37: the inspection slot cannot be used to hand-feed the original body without portals',async()=>{
 const g=await room(37);
 try{const report=await runV8Journey(g,{scenario:d=>{
  pickup(d);d.walk(-16,6);d.walk(-16,5.1);
  for(let n=0;n<150;n++){d.worldMove(0,-1);d.frame();}d.stop();
  assert.ok(g.interact());assert.equal(g.heldCube,null);d.wait(2);
  assert.equal(g.physics.portalTransports,0);
  assert.ok(g.cargo.position.z>4.7,'Solid front bulkhead must keep the full cargo body outside its small portal-charge slot');
  assert.equal(g.firstLevel.receiver.loaded(),false);assert.equal(g.state,'playing');
 }});assert.equal(report.resets+report.respawns,0);}finally{close(g);}
});

test('40: portal illumination and common trim alone cannot replace the original cargo lever arm',async()=>{
 const g=await room(40);
 try{const report=await runV8Journey(g,{scenario:d=>{
  runCreativeFinal(d,{stopBeforeWeight:true});
  d.walk(-10,18);d.walk(-10,10);d.walk(6,9.2);
  for(let i=0;i<3;i++){assert.ok(g.interact());d.wait(.4);}d.wait(.8);
  assert.equal(g.firstLevel.getCalibration().trim,0);
  assert.equal(g.firstLevel.getCalibration().lit,false,'Disjoint real slits must block the ray without the differential cargo moment');
  d.walk(-5,9.2);assert.ok(g.interact());assert.equal(g.firstLevel.getCalibration().clamped,false);
  d.walk(-15,10);d.walk(-15,-15);d.walk(0,-15);
  assert.throws(()=>d.walk(0,-23),/Blocked walking|Walk timed out/);
  assert.ok(g.firstLevel.door.progress<.01);assert.equal(g.state,'playing');
 }});assert.equal(report.resets+report.respawns,0);}finally{close(g);}
});
