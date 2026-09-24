import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runWorkshopJourney} from '../src/game/LabWorkshopJourney.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

for(const edition of ['foundation','classic'])test(`${edition} room 9 cannot close its spring guards around the original loose companion`,async()=>{
 game.chamberEdition=edition;await game.selectLevel(8,false);
 const originalBody=game.physics.cargoBody;
 let refused=false;
 const r=await runV8Journey(game,{scenario:d=>runWorkshopJourney({...d,mark(name){
  d.mark(name);
  if(name!=='gravity compressed the physical spring')return;
  d.walk(-4.98,-1.8);
  assert.match(d.level.nearbyInteraction()?.text??'',/Сначала забери друга/);
  assert.equal(game.interact(),true);
  d.wait(10);
  const s=d.level.state;
  assert.equal(s.piston.latched,true);
  assert.equal(s.door.open,true);
  assert.ok(s.springGuards.every(guard=>guard.mesh.position.y<0),'Glass must remain below the loaded cup');
  assert.ok(game.cargo.position.x>-1.8&&game.cargo.position.x<1.8);
  refused=true;
  d.mark('loaded spring refuses unsafe release');
 }})});
 assert.equal(refused,true);assert.equal(r.pass,true);assert.equal(game.state,'won');
 assert.equal(r.resets+r.respawns,0);assert.equal(game.physics.cargoBody,originalBody);
});

test('room 9 service sensor lets a carried player escape a soft landing and repeat the real impact',async()=>{
 game.chamberEdition='foundation';await game.selectLevel(8,false);
 const body=game.physics.cargoBody;
 const r=await runV8Journey(game,{scenario:d=>{
  const p=d.level.panels,s=d.level.state;
  d.aim(1,new THREE.Vector3(0,10.6,-6));
  const front=p['work-front'].getFrame().center.clone();front.y-=.2;d.aim(0,front);
  d.walk(0,8.7);d.pickup();d.walk(0,13.2);
  const before=game.teleportCount;
  for(let n=0;n<180&&game.teleportCount===before;n++){d.worldMove(0,1);d.frame();}
  d.stop();d.until(()=>game.playerGrounded,5,'Soft cup landing');d.wait(1);
  assert.equal(s.piston.latched,false);assert.ok(game.heldCube);
  assert.ok(s.springGuards.every(guard=>guard.mesh.position.y<0),'Service sensor opens the occupied cup');
  d.walk(0,-2.4);d.wait(1);
  assert.ok(game.playerPosition.z>-3&&game.heldCube);
  d.mark('escaped guarded cup with original load after harmless landing');
  d.walk(-4.75,6);
  for(let n=0;n<10;n++){d.worldMove(0,-.18);d.frame();}
  d.stop();d.wait(.2);game.interact();d.wait(1.1);
  d.walk(-3.8,9);d.aim(0,p['loading-floor'].getFrame().center);
  d.until(()=>s.piston.latched,7,'Repeat gravity drop');
  d.mark('same cargo latched the spring on the second attempt');
  d.walk(2.6,-2);d.walk(2.6,-8.9);d.walk(-3,-8.9);
  d.walk(2.6,-8.9);d.walk(2.6,-2);d.walk(-4,-2);
  d.walk(game.cargo.position.x,-2.7);d.walk(game.cargo.position.x,-3.32);d.pickup();
  d.walk(2.6,-2.7);d.walk(2.6,-7.6);d.walk(game.playerPosition.x,-9.5);
  d.walk(0,-9.5);d.walk(0,-16);d.until(()=>game.state==='won',3,'Joint exit');
 }});
 assert.equal(r.pass,true);assert.equal(game.state,'won');
 assert.equal(r.resets+r.respawns,0);assert.equal(game.physics.cargoBody,body);
 assert.ok(r.milestones.some(m=>m.name==='escaped guarded cup with original load after harmless landing'));
});
