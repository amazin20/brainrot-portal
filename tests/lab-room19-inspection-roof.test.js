import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {room19Ascent} from '../src/game/LabRoom19Journey.js';
import {tracePortalRay,V} from '../src/game/LabPuzzleMechanics.js';
const game=await createHeadlessGame();game.chamberEdition='foundation';
after(()=>{game.physics.dispose();game.portals.dispose();});

test('room19 inspection roof transmits charges and light while stopping air and the pickup ray',async()=>{
 await game.selectLevel(18,false);game.scene.updateMatrixWorld(true);
 const l=game.firstLevel,roof=l.inspectionRoof,collider=game.colliders.find(c=>c.mesh===roof);
 assert.ok(collider&&collider.enabled!==false,'The entire visible pane remains a physical solid');
 assert.ok(game.cameraBlockers.includes(roof),'Pickup uses camera blockers; the roof cannot be ignored by hands');
 assert.equal(game.aimBlockers.includes(roof),false);
 for(const side of l.puzzleGeometry.glass.filter(p=>p!==roof))assert.ok(game.aimBlockers.includes(side),'Side glazing still rejects portal charges');
 const origin=V(0,9,0),down=V(0,-1,0);
 const light=tracePortalRay(game,origin,down,{medium:'light'}),air=tracePortalRay(game,origin,down,{medium:'air'});
 assert.ok(light[0].b.y<1,'The optical ray passes through the complete roof');
 assert.ok(air[0].b.y>6,'Physical airflow stops on that same pane');
 const ray=game.portalShots.ray;ray.set(origin,down);ray.near=0;ray.far=Infinity;
 assert.equal(game.portalShots.firstHit()?.object,l.panels['sealed-cradle'].mesh,'A real charge ray sees the existing white floor through the roof');
 const handRay=new THREE.Raycaster(origin,down,0,9);
 const handHit=handRay.intersectObjects(game.cameraBlockers,true).find(h=>game.isActiveBlocker(h.object));
 assert.equal(handHit?.object,roof,'Hands still meet the complete inspection pane first');
});

test('room19 former top-entry pickup shortcut lands on the sealed roof with the original free cargo still inside',async()=>{
 await game.selectLevel(18,false);const original=game.cargo,body=game.physics.cargoBody;
 let atLanding,afterPickup;
 const report=await runV8Journey(game,{scenario:d=>{
  room19Ascent(d);
  d.aim(1,d.level.panels['open-air-duct'].getFrame().center);
  d.until(()=>d.level.state.inertia.wheel.omega>30,40,'Ordinary flywheel charge');
  d.walk(9,-11);d.aim(1,d.level.panels['ferry-receiver'].getFrame().center);
  d.walk(0,-6);d.walk(0,-5.12);d.aim(0,V(-1.5,.025,1.5));
  assert.equal(game.physics.portalTransports,0,'The original conductor has not been delivered during setup');
  game.input.keys.add('ShiftLeft');
  for(let n=0;n<78;n++){d.worldMove(0,1);if(n===0)game.input.jumpQueued=true;d.frame();}
  d.stop();d.until(()=>game.playerGrounded,3,'Roof landing');
  atLanding=game.playerPosition.clone();
  assert.ok(atLanding.y>=6.2,'The former chamber entry now lands on actual roof geometry');
  d.walk(game.cargo.position.x+1.15,game.cargo.position.z);
  game.interact();d.wait(.3);afterPickup=!!game.heldCube;
  assert.equal(afterPickup,false,'Ordinary E cannot pick the companion through the roof');
  assert.equal(game.physics.portalTransports,0);
  assert.equal(game.teleportCount,0);
  assert.ok(game.cargo.position.y<1&&Math.abs(game.cargo.position.x)<1&&Math.abs(game.cargo.position.z)<1);
 }});
 assert.equal(game.state,'playing');assert.equal(report.resets+report.respawns,0);
 assert.equal(game.cargo,original);assert.equal(game.physics.cargoBody,body);
});
