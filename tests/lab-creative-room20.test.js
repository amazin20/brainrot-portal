import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {campaignSpec} from '../src/game/LabCampaignLevels.js';
import {CREATIVE_ROOM20_SPEC} from '../src/game/LabCreativeRoom20.js';
import {uprightCapsuleFitsPortal,orientedBoxFitsPortal} from '../src/game/LabPortals.js';
import {gameplayContract,digest} from './helpers/lab-art-contract.js';
import {creative20Attacks,creative20EarlyAttacks,creative20HeldOffset} from '../scripts/lib/creative-room20-attacks.mjs';
const g=await createHeadlessGame();g.chamberEdition='foundation';
after(()=>{g.physics?.dispose();g.portals?.dispose();});
async function room(aspect=16/9){await g.selectLevel(19,false);g.camera.aspect=aspect;g.camera.updateProjectionMatrix();assert.equal(g.firstLevel.creativeEarly,20);return g;}
for(const aspect of [16/9,1.6])for(const options of [{order:'cargo-first'},{order:'scout-first'},{order:'cargo-first',recovery:true}])test(`new20 ${JSON.stringify(options)} succeeds with the same physical companion at aspect ${aspect}`,async()=>{
 await room(aspect);const report=await runV8Journey(g,{journeyOptions:options});assert.equal(report.pass,true);assert.equal(g.state,'won');assert.equal(report.resets+report.respawns,0);assert.equal(report.teleports,0,'Freight-only frames cannot transport the player');assert.ok(report.milestones.some(m=>m.name.includes('retaining finger')));assert.ok(report.milestones.some(m=>m.name.includes('same original body recovered')));
});
for(const c of [...creative20Attacks,...creative20EarlyAttacks])test(c.name,async()=>{await room();const r=await runV8Journey(g,{scenario:c.run});assert.equal(r.resets+r.respawns,0);assert.equal(g.state,'playing');});
test('new20 manufactured apertures reject the full capsule and admit all centred rigid-box orientations',async()=>{
 await room();await runV8Journey(g,{scenario:async d=>{
  const {runCreative20}=await import('../src/game/LabCreativeRoom20Journey.js');await runCreative20(d,{stopAt:'pair-prepared'});
  for(const p of g.portals.portals){if(p.surfaceId===d.level.outlet.mesh.uuid)assert.equal(uprightCapsuleFitsPortal(p,2.4,.43),false);else assert.equal(uprightCapsuleFitsPortal(p,2.4,.43),true,'The source floor alone admits the vertical projection; the far aperture rejects the complete transfer');for(const a of [[0,0,0],[Math.PI/4,0,0],[.73,1.29,.48],[Math.PI/3,Math.PI/5,Math.PI/7]])assert.equal(orientedBoxFitsPortal(p,p.position,new THREE.Quaternion().setFromEuler(new THREE.Euler(...a)),.39),true);}
 }});
});
test('new20 visual interpolation cannot change its complete physical and interaction contract',async()=>{
 await room();assert.deepEqual(CREATIVE_ROOM20_SPEC.assets,[1,2,11,22]);assert.deepEqual(g.firstLevel.fixtures,[]);const expected=digest(gameplayContract(g));assert.equal(expected,'e090e57bb2a7887e01f73c510d03b161ea23693fe1074b90aa0e2761f9f5e5f3','Pinned new-room physical, portal, floor and interaction contract changed');
 for(const alpha of [0,.25,.5,.75,1]){g.firstLevel.renderUpdate(alpha);assert.equal(digest(gameplayContract(g)),expected);}
 for(const p of Object.values(g.firstLevel.panels)){assert.ok(p.getFrame().center.toArray().every(Number.isFinite));assert.equal(p.mesh.userData.portalSize.width,.8);}
 assert.deepEqual(g.firstLevel.puzzleGeometry.orders,['cargo-first','scout-first']);assert.equal(g.firstLevel.goal.position.z,23);
});

test('new20 every translated gate, tie, tooth and retaining pin has a real continuous sleeve through the fixed structure',async()=>{
 await room();const l=g.firstLevel,moving=[l.leaf,l.returnLeaf,l.tie,l.tooth,l.stopFinger],ids=new Set(moving.map(p=>p.collider.mesh.uuid));
 const positiveOverlap=(a,b)=>['x','y','z'].every(axis=>Math.min(a.max[axis],b.max[axis])-Math.max(a.min[axis],b.min[axis])>1e-5);
 for(const part of moving){
  const box=part.collider.box.clone(),delta=new THREE.Vector3(...(part===l.stopFinger?[0,0,1.05]:[-7.2,0,0]));
  const continuous=box.clone().union(box.clone().translate(delta));
  const conflicts=g.colliders.filter(c=>c.enabled!==false&&!ids.has(c.mesh.uuid)&&positiveOverlap(continuous,c.box)).map(c=>({name:c.mesh.name,min:c.box.min.toArray(),max:c.box.max.toArray()}));
  assert.deepEqual(conflicts,[],part.mesh.name+' must clear every fixed solid throughout the actual stroke');
  assert.ok(part.collider.mesh.userData.collisionProxy);
 }
 assert.ok(l.inspection.top-l.inspection.bottom<.78);
});

for(const offsets of [[-.8,.8],[.8,-.8]])test(`new20 held scaffold corners remain outside the real cable reach with actual portal offsets ${offsets}`,async()=>{
 await room();const r=await runV8Journey(g,{scenario:d=>creative20HeldOffset(d,...offsets)});assert.equal(r.resets+r.respawns,0);
});

test('new20 production startup model requests are all declared in the actual browser asset manifest',async()=>{
 const original=g.model,used=new Set();g.model=function(id,...args){used.add(id);return original.call(this,id,...args);};
 try{await room();const declared=new Set(campaignSpec(g,19).assets);assert.deepEqual([...used].sort((a,b)=>a-b),[1,2,11,22]);for(const id of used)assert.ok(declared.has(id),'Startup model '+id+' absent from browser manifest');}
 finally{g.model=original;}
});
