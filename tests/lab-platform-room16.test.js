import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

test('archipelago: ordinary jumps and redirected ambient air deliver the original friend',async()=>{
 await game.selectLevel(15,false);
 const report=await runV8Journey(game);
 assert.ok(report.pass&&report.resets===0&&report.respawns===0);
 assert.equal(game.state,'won');assert.ok(game.heldCube);
 assert.ok(report.milestones.some(m=>m.name.includes('six island gaps')&&m.teleports===0));
 assert.ok(report.milestones.some(m=>m.name.includes('sustained air')&&m.player[1]>14));
 assert.ok(game.firstLevel.state.ambientAir.segments.some(s=>s.direction.y>.99));
 assert.equal(game.firstLevel.terminals.length,0);assert.equal(game.firstLevel.gates.length,0);
});

test('archipelago: a missed island has an ordinary return route without reset or checkpoint',async()=>{
 await game.selectLevel(15,false);
 const report=await runV8Journey(game,{scenario:async({walk,pickup,wait,until,mark})=>{
  walk(-13.4,27);pickup();walk(-14,26.5);walk(-14,18);
  walk(-14,11);until(()=>game.playerGrounded&&game.playerPosition.y<.1,3,'Lower court missed');
  mark('missed island recovered on the lower court');
  walk(-19.5,11);walk(-19.5,27.35);walk(-14,27.35);walk(-14,18);wait(.2);
  assert.ok(game.playerGrounded&&Math.abs(game.playerPosition.y-3)<.05&&game.heldCube);
  assert.equal(game.teleportCount,0);assert.equal(game.state,'playing');
 }});
 assert.ok(report.pass&&report.resets===0&&report.respawns===0);
});

test('archipelago: solid wind catch blocks air, and the sheltered island lane stays calm',async()=>{
 await game.selectLevel(15,false);game.resetRun(true);game.firstLevel.update(1/120);
 const level=game.firstLevel,air=level.state.ambientAir;
 assert.equal(air.segments.length,1);assert.equal(air.segments[0].kind,'wall');
 assert.ok(Math.abs(air.segments[0].b.z+2.53)<.03);
 const inWind=level.playerAcceleration(new THREE.Vector3(5.8,5.9,-7),new THREE.Vector3());
 const sheltered=level.playerAcceleration(new THREE.Vector3(8.6,5.1,-7),new THREE.Vector3());
 const behindWall=level.playerAcceleration(new THREE.Vector3(5.8,5.9,0),new THREE.Vector3());
 assert.ok(inWind.z>30);assert.equal(sheltered.lengthSq(),0);assert.equal(behindWall.lengthSq(),0);
 assert.ok(level.bounds.maxX-level.bounds.minX>=45&&level.bounds.maxZ-level.bounds.minZ>=55);
 assert.ok(level.goal.position.y>13);assert.equal(level.getLaunch(new THREE.Vector3()),null);
});
