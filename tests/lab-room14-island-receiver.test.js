import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {makePortalFrame,orientedBoxFitsPortal,uprightCapsuleFitsPortal} from '../src/game/LabPortals.js';
import {assertRoom14DeflectorGeometry} from './helpers/lab-room14-deflector-contract.js';

// The retired cube-only island address is preserved in the372089a history.
// Current14 has a light-only aperture: neither actor can replace that field.
// Actual ordinary carried/charged attacks are in the current journey suite.
let g;
before(async()=>{g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(13,false);});
after(()=>{if(g)disposeLabLevel(g);});
test('current14 optical half-sizes0.30×1.10m mean a full0.60×2.20m aperture, excluding every complete original cube orientation and the upright player',()=>{
 assertRoom14DeflectorGeometry(g);
 for(const name of ['contact-intake','contact-turn']){
  const panel=g.firstLevel.panels[name],f=panel.getFrame(),portal=makePortalFrame(f.center,f.normal,f.up,panel.mesh.userData.portalSize);
  assert.equal(portal.width,.3);assert.equal(portal.height,1.1);
  for(let x=0;x<4;x++)for(let y=0;y<4;y++)for(let z=0;z<4;z++){
   const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(x*Math.PI/8,y*Math.PI/8,z*Math.PI/8));assert.equal(orientedBoxFitsPortal(portal,portal.position,q,.39),false);
  }
  assert.equal(uprightCapsuleFitsPortal(portal,2.4,.44),false);
 }
});
test('current14 separate passenger apertures retain full human clearance instead of inheriting the optical mouth size',()=>{
 for(const name of ['passenger-departure','passenger-arrival']){
  const panel=g.firstLevel.panels[name],f=panel.getFrame(),portal=makePortalFrame(f.center,f.normal,f.up,panel.mesh.userData.portalSize);
  assert.equal(uprightCapsuleFitsPortal(portal,2.4,.44),true);assert.ok(portal.width>.44&&portal.height>1.2);
 }
 assert.equal(g.firstLevel.panels['island-receiver'],undefined,'The retired independent island cargo address must not reappear');
});
