import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {inversionAcceleration} from '../src/game/LabRoom29Gravity.js';
const game=await createHeadlessGame();after(()=>{game.physics.dispose();game.portals.dispose();});
for(const [name,options,aspect] of [
 ['ceiling split 16:9',{},16/9],['ceiling split 16:10',{},1.6],
 ['direct garden catch 16:9',{gardenCatch:true},16/9],['direct garden catch 16:10',{gardenCatch:true},1.6],
 ['reversible ceiling recovery',{recover:true,undercroft:true},1.6],
])test(`room29 ${name}: the free companion trips the visible shutter before joint arrival`,async()=>{
 game.chamberEdition='foundation';await game.selectLevel(28,false);game.camera.aspect=aspect;game.camera.updateProjectionMatrix();
 const body=game.physics.cargoBody,friend=game.cargo;
 const report=await runV8Journey(game,{journeyOptions:options});
 const latch=game.firstLevel.state.gardenLatch;
 assert.equal(report.pass,true);assert.equal(game.state,'won');assert.equal(game.physics.cargoBody,body);assert.equal(game.cargo,friend);
 assert.equal(report.respawns+report.resets,0);
 assert.equal(latch.engaged,true);assert.ok(latch.progress>.99&&latch.shutter.position.y>16.5);
 if(options.gardenCatch)assert.ok(report.milestones.some(m=>m.name.includes('reversed crown gravity catches')));
 else assert.ok(report.milestones.some(m=>m.name.includes('passage too low')&&m.cargo[1]>15));
});
for(const aspect of [16/9,1.6])test(`room29 carried promenade shortcut is physically shuttered at aspect ${aspect}`,async()=>{
 game.chamberEdition='foundation';await game.selectLevel(28,false);game.camera.aspect=aspect;game.camera.updateProjectionMatrix();
 const body=game.physics.cargoBody,friend=game.cargo;
 await assert.rejects(runV8Journey(game,{journeyOptions:{carryRoute:true}}),/Portal impact rejected.*Garden return sliding shutter/);
 const latch=game.firstLevel.state.gardenLatch;
 assert.equal(game.state,'playing');assert.equal(game.physics.cargoBody,body);assert.equal(game.cargo,friend);
 assert.equal(latch.engaged,false);assert.equal(latch.progress,0);assert.equal(game.firstLevel.state.gravity.source.up,false);
 assert.equal(game.portalShots.lastImpact?.surface,'Garden return sliding shutter');
 assert.equal(game.portalShots.lastImpact?.valid,false);
});
test('room29 gravity force is finite, local and reversible',()=>{
 const f={enabled:true,up:true,bounds:new THREE.Box3(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,10,1))},v=new THREE.Vector3(),p=new THREE.Vector3(0,4,0);
 assert.ok(inversionAcceleration(f,p,v).y>19.5);f.up=false;assert.ok(inversionAcceleration(f,p,v).y<19.5);assert.equal(inversionAcceleration(f,new THREE.Vector3(2,4,0),v).length(),0);f.enabled=false;assert.equal(inversionAcceleration(f,p,v).length(),0);
});
