import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {resolvePortalPlacement} from '../src/game/LabPortals.js';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

test('the freight ceramic fits complete portals at both visible edges without exempting its jambs',async()=>{
 await game.selectLevel(11,false);game.scene.updateMatrixWorld(true);
 const panel=game.firstLevel.panels['freight-exit'].mesh;
 for(const x of[21.01,21.5,22,23,24,25,26,26.99])for(const y of[13,14.5,16]){
  const result=resolvePortalPlacement(panel,new THREE.Vector3(x,y,6),{blockers:game.colliders});
  assert.equal(result.ok,true,`Ceramic edge ${x}/${y} remains obstructed: ${result.reason}`);
  assert.ok(result.position.x>=22.318-1e-6&&result.position.x<=25.682+1e-6);
 }
 // Keep the physical obstructions real: a legal panel cannot ignore a newly
 // occupied aperture simply because its own authored bounds were corrected.
 const obstacle={box:new THREE.Box3(new THREE.Vector3(23,13,6.15),new THREE.Vector3(25,16,6.6))};
 assert.equal(resolvePortalPlacement(panel,new THREE.Vector3(24,14.5,6),{blockers:[...game.colliders,obstacle]}).reason,'obstructed');
});

test('an ordinary shot from observation seats the freight portal where the former wide face clipped the jamb',async()=>{
 await game.selectLevel(11,false);
 const report=await runV8Journey(game,{scenario:async d=>{
  const p=d.level.panels;
  d.aim(0,p.entry.getFrame().center);d.aim(1,p.observation.getFrame().center);d.enter(p.entry);d.walk(-19,14);
  d.aim(1,new THREE.Vector3(24,14.5,6));
  assert.equal(game.portalShots.lastImpact.valid,true);
  assert.equal(game.portalShots.lastImpact.surface,'freight-exit / collision');
  assert.ok(game.portalShots.lastImpact.position[0]<22.1,'The ordinary camera ray must reproduce the former left-edge failure');
  assert.ok(game.portals.portals[1].position.x>=22.318-1e-6);
 }});
 assert.equal(report.pass,true);assert.equal(report.resets+report.respawns,0);
});
