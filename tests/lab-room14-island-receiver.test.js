import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom14} from '../src/game/LabRoom14Journey.js';
import {installRoom21Aim} from '../src/game/LabRoom21Journey.js';
import {makePortalFrame,orientedBoxFitsPortal,uprightCapsuleFitsPortal} from '../src/game/LabPortals.js';
const g=await createHeadlessGame();g.chamberEdition='foundation';
after(()=>{g.physics.dispose();g.portals.dispose();});

test('room14 manufactured island aperture admits the original cube but excludes the full upright player',async()=>{
 await g.selectLevel(13,false);const p=g.firstLevel.panels['island-receiver'],f=p.getFrame();
 const portal=makePortalFrame(f.center,f.normal,f.up,p.mesh.userData.portalSize);
 assert.ok(orientedBoxFitsPortal(portal,portal.position,new THREE.Quaternion(),.39),'The manufactured aperture still physically admits the 78 cm cargo');
 assert.equal(uprightCapsuleFitsPortal(portal,2.4,.43),false,'The complete upright player cannot replace the first light crossing');
});

test('room14 exact west-address island skip is rejected by physical aperture fit with the same held cargo',async()=>{
 await g.selectLevel(13,false);const original=g.cargo,body=g.physics.cargoBody;
 const report=await runV8Journey(g,{scenario:async d=>{
  installRoom21Aim(d);const CUT=Symbol('ordinary western landing');let reached=false;
  try{await runRoom14({...d,mark:name=>{d.mark(name);if(name==='light landing reached'){reached=true;throw CUT;}}});}
  catch(error){if(error!==CUT)throw error;}
  assert.ok(reached&&g.heldCube,'Ordinary original companion arrival at the west landing succeeded');
  g.interact();d.wait(.8);
  d.aim(1,d.level.panels['island-receiver'].getFrame().center);
  d.aim(0,d.level.panels['weave-west'].getFrame().center);
  const actualOutlet=g.portals.portals[1];
  assert.equal(actualOutlet.width,.8);assert.equal(actualOutlet.height,.8);
  assert.ok(orientedBoxFitsPortal(actualOutlet,actualOutlet.position,new THREE.Quaternion(),.39));
  assert.equal(uprightCapsuleFitsPortal(actualOutlet,2.4,.43),false);
  d.walk(g.cargo.position.x+1.15,g.cargo.position.z);d.pickup();
  const portalBefore=g.teleportCount,cargoBefore=g.physics.portalTransports;
  const f=d.level.panels['weave-west'].getFrame();
  d.walk(f.center.x+f.normal.x*1.35,f.center.z+f.normal.z*1.35);
  for(let n=0;n<240;n++){d.worldMove(-f.normal.x,-f.normal.z);d.frame();}
  d.stop();d.wait(.6);
  assert.equal(g.teleportCount,portalBefore,'The exact formerly winning entry no longer transports the player');
  assert.equal(g.physics.portalTransports,cargoBefore,'The held original body remains on its owner side');
  assert.ok(g.heldCube&&g.playerPosition.x< -13&&Math.abs(g.playerPosition.y-6)<.2);
  assert.equal(g.state,'playing');
 }});
 assert.equal(report.resets+report.respawns,0);assert.equal(g.cargo,original);assert.equal(g.physics.cargoBody,body);
});
