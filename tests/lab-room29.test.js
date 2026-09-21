import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom29} from '../src/game/LabRoom29Journey.js';
import {inversionAcceleration} from '../src/game/LabRoom29Gravity.js';
const game=await createHeadlessGame();after(()=>{game.physics.dispose();game.portals.dispose();});
for(const [name,options,aspect] of [['ceiling and floor split',{},16/9],['carry the observation route',{carryRoute:true},1.6],['reversible ceiling recovery',{recover:true},1.6]])test(`room29 ${name}`,async()=>{
 await game.selectLevel(28,false);game.camera.aspect=aspect;game.camera.updateProjectionMatrix();const body=game.physics.cargoBody;
 const report=await runV8Journey(game,{scenario:d=>runRoom29(d,options)});
 assert.equal(report.pass,true);assert.equal(game.state,'won');assert.equal(game.physics.cargoBody,body);assert.equal(report.respawns+report.resets,0);
 if(!options.carryRoute)assert.ok(report.milestones.some(m=>m.name.includes('passage too low')&&m.cargo[1]>15));
});
test('room29 gravity force is finite, local and reversible',()=>{
 const f={enabled:true,up:true,bounds:new THREE.Box3(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,10,1))},v=new THREE.Vector3(),p=new THREE.Vector3(0,4,0);
 assert.ok(inversionAcceleration(f,p,v).y>19.5);f.up=false;assert.ok(inversionAcceleration(f,p,v).y<19.5);assert.equal(inversionAcceleration(f,new THREE.Vector3(2,4,0),v).length(),0);f.enabled=false;assert.equal(inversionAcceleration(f,p,v).length(),0);
});
