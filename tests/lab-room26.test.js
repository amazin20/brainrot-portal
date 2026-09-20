import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom26} from '../src/game/LabRoom26Journey.js';
import {crossflowAcceleration,ROOM26_SPEC} from '../src/game/LabPortalRoom26.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});
for(const [name,options] of [['normal',{}],['inspect the unpowered shaft first',{inspectFirst:true}],['missed first landing and repeated reversal',{firstFall:true,reverse:true}]]){
 test(`room26 ${name}: ordinary input carries one original companion through both live fields`,async()=>{
  await game.selectLevel(25,false);const body=game.physics.cargoBody;
  const report=await runV8Journey(game,{scenario:d=>runRoom26(d,options)});
  assert.equal(report.pass,true);assert.equal(game.state,'won');
  assert.equal(report.respawns+report.resets,0);assert.equal(game.physics.cargoBody,body);
  assert.ok(game.physics.portalTransports>=1,'The actual companion must traverse a portal');
  assert.equal(game.firstLevel.state.load.loaded(),false);
  assert.equal(game.firstLevel.state.shutter.open,false);
  assert.equal(game.firstLevel.state.crossingFlow.reversed,false);
  assert.ok(report.milestones.some(m=>m.name==='borrow the lift portals to recover their own power source'&&m.cargo[1]>16));
  if(options.firstFall)assert.ok(report.milestones.some(m=>m.name==='a missed gallery returns to the shared foundation'&&m.player[1]<.1));
 });
}

test('room26 load-operated obstruction stops the actual lower ray without disabling the independent stream',async()=>{
 await game.selectLevel(25,false);
 const report=await runV8Journey(game,{scenario:d=>{
  const {game,level,walk,pickup,look,wait}=d,s=level.state,p=level.panels;
  assert.equal(s.shutter.open,false);assert.equal(s.liftFlow.enabled,true);
  assert.ok(Math.abs(s.liftFlow.segments[0].b.x+18.175)<.03);
  walk(game.cargo.position.x+1,game.cargo.position.z);pickup();walk(-17,23);
  look(p['valve-load'].getFrame().center.clone().add(new THREE.Vector3(0,2,0)));walk(-17,22);game.interact();wait(2);
  assert.ok(s.load.loaded());assert.ok(s.shutter.open);
  assert.ok(s.liftFlow.segments[0].b.x>-8);
  walk(game.cargo.position.x+1,game.cargo.position.z);pickup();walk(-20,17);wait(3);
  assert.equal(s.load.loaded(),false);assert.equal(s.shutter.open,false);
  assert.ok(Math.abs(s.liftFlow.segments[0].b.x+18.175)<.03);
  assert.ok(s.crossingFlow.segments[0].length>40);
 }});
 assert.equal(report.resets+report.respawns,0);
});

test('room26 overlapping fields compensate gravity once while adding their real horizontal forces',()=>{
 const point=new THREE.Vector3(),velocity=new THREE.Vector3(),fields=[{acceleration:()=>new THREE.Vector3(2,19.5,0)},{acceleration:()=>new THREE.Vector3(0,19.5,3)}];
 assert.deepEqual(crossflowAcceleration(fields,point,velocity,.46).toArray(),[2,19.5,3]);
 assert.deepEqual(crossflowAcceleration([],point,velocity,.46).toArray(),[0,0,0]);
});

test('room26 has five purposeful portal faces and no progression flags; joint arrival is still required',async()=>{
 await game.selectLevel(25,false);const l=game.firstLevel;
 assert.equal(game.portalPanels.length,5);assert.equal(l.puzzleGeometry.noProgressFlags,true);
 assert.deepEqual(ROOM26_SPEC.assets,[1,2,11,22,23,24]);
 game.playerPosition.copy(l.goal.position);game.playerGrounded=true;assert.equal(l.isWon(),false);
 game.cargo.position.copy(l.goal.position).y+=.4;assert.equal(l.isWon(),true);
 game.playerGrounded=false;assert.equal(l.isWon(),false);
});
