import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {gameplayContract,digest} from './helpers/lab-art-contract.js';
import {originalRoom6Contract} from './helpers/lab-early-construction-contract.js';

const V=(...p)=>new THREE.Vector3(...p);
const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/early-art-v35-contract.json',import.meta.url))).rooms.find(r=>r.level===6);
async function room(){const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(5,true);return g;}
function dispose(g){g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();}
function parts(g){const root=g.firstLevel.world.root;return{
 pilot:g.firstLevel.mechanismArt.earlyOptics.signalStems.pilot,
 exit:g.firstLevel.mechanismArt.earlyOptics.signalStems.exit,
 core:root.getObjectByName('Room six / traced optical core'),
};}
function assertDrawing(g){
 const l=g.firstLevel,p=parts(g),s=l.state;
 assert.equal(p.pilot.material.color.getHex(),s.pilotLit?0xb5f0c1:0xb28d6c);
 assert.equal(p.exit.material.color.getHex(),s.lit?0x9af4bd:0xa38b6b);
 for(const [i,mesh]of p.core.children.entries()){
  const segment=s.segments?.[i];assert.equal(mesh.visible,Boolean(segment));if(!segment)continue;
  assert.ok(mesh.position.distanceTo(segment.a.clone().add(segment.b).multiplyScalar(.5))<1e-7);
  assert.ok(Math.abs(mesh.scale.y-segment.length)<1e-7);
  assert.equal(mesh.scale.x,.03);assert.equal(mesh.scale.z,.03);
  assert.ok(V(0,1,0).applyQuaternion(mesh.quaternion).distanceTo(segment.direction)<1e-7);
 }
}

test('room-six signal stems meet their real receivers with only the explicitly audited query poses changed',async()=>{
 const g=await room();try{
  const l=g.firstLevel,p=parts(g);l.renderUpdate(1);g.scene.updateMatrixWorld(true);
  assert.equal(digest(originalRoom6Contract(gameplayContract(g))),baseline.contract);
  const pilotTop=new THREE.Box3().setFromObject(l.mechanismArt.earlyOptics.pilot.group).max.y;
  const sensorTop=new THREE.Box3().setFromObject(l.earlyMechanismArt.getObjectByName('Early optics / receiving lens mount')).max.y;
  for(const [stem,top]of [[p.pilot,pilotTop],[p.exit,sensorTop]]){
   assert.ok(stem?.isMesh);const b=new THREE.Box3().setFromObject(stem);
   assert.equal(stem.geometry.type,'BoxGeometry');
   assert.deepEqual(['width','height','depth'].map(axis=>stem.geometry.parameters[axis]),[.16,1.45,.15]);
   assert.equal(stem.geometry.attributes.position.count,24);assert.equal(stem.geometry.index.count,36);
   assert.ok(Math.abs(b.min.y-top)<1e-6,'The existing light stem must meet the finished receiver rather than hover above it');
   assert.ok(b.max.y>4.1,'The receiver signal must remain above the reflector cross-head and the character');
   assert.equal(g.colliders.some(c=>c.mesh===stem),false);
   assert.equal(g.aimBlockers.filter(m=>m===stem).length,1);assert.equal(g.cameraBlockers.filter(m=>m===stem).length,1);
   assert.ok(stem.getWorldPosition(V()).distanceTo(b.getCenter(V()))<1e-7,'The visible signal and both actual query owners must have the same live pose');
  }
  const oldCoreDiameter=.13,currentCoreDiameter=p.core.children[0].geometry.parameters.radiusTop*.03*2;
  assert.ok(currentCoreDiameter<oldCoreDiameter/2);assert.equal(p.core.children.length,7);
  assert.equal(g.colliders.some(c=>p.core.children.includes(c.mesh)),false);
  g.updatePlaying(1/120);g.updateVisuals(1/60,1);assertDrawing(g);
 }finally{dispose(g);}
});

test('the optical query-pose allowance rejects phantom, suppressed, extra or unapproved query owners and all unrelated physical changes',async()=>{
 const g=await room();try{
  const contract=gameplayContract(g),matches=r=>r.matrix[12]===0&&r.matrix[14]===-10.5;
  const check=c=>assert.equal(digest(originalRoom6Contract(c)),baseline.contract);
  check(contract);
  for(const mutate of [
   c=>c.camera.find(matches).matrix[13]+=.01,
   c=>c.aim.find(matches).matrix[13]=4.15,
   c=>c.camera.push(structuredClone(c.camera.find(matches))),
   c=>c.aim.splice(c.aim.findIndex(matches),1),
   c=>c.camera.find(matches).visible=false,
   c=>c.aim.find(matches).matrix[0]=1.01,
   c=>c.colliders[0].box.min[0]-=.1,
   c=>c.panels['light-outlet'].center[1]+=.1,
  ]){const altered=structuredClone(contract);mutate(altered);assert.throws(()=>check(altered),assert.AssertionError);}
 }finally{dispose(g);}
});

test('ordinary optical-first route drives both mounted signals and the thinner core from the real live light path',async()=>{
 const g=await room();try{
  const cargo=g.cargo,body=g.physics.cargoBody,shape=body.shapes[0],update=g.updateVisuals;
  let pilotFrame=null,exitFrame=null,frames=0;
  g.updateVisuals=function(...args){const value=update.apply(this,args);frames++;
   assert.equal(this.cargo,cargo);assert.equal(this.physics.cargoBody,body);assert.equal(body.shapes[0],shape);assertDrawing(this);
   if(this.firstLevel.state.pilotLit)pilotFrame??=frames;if(this.firstLevel.state.lit)exitFrame??=frames;return value;
  };
  const report=await runV8Journey(g,{journeyOptions:{order:'light-first',nativeStart:true}});
  assert.equal(report.pass,true);assert.equal(g.state,'won');assert.equal(report.resets+report.respawns,0);
  assert.ok(pilotFrame!==null&&exitFrame!==null&&pilotFrame<exitFrame,'A real portal-routed pilot path must precede the exit receiver');
  assert.ok(report.milestones.some(m=>m.name==='unturned optical path lights the pilot receiver before the mirror turns'));
  assert.ok(report.milestones.some(m=>m.name==='beam physically traversed pair and reflected to receiver'));
  console.info('Room-six optical visual witness',JSON.stringify({frames:report.frames,pilotFrame,exitFrame,bodyId:body.id,shapeId:shape.id,resets:report.resets,respawns:report.respawns}));
 }finally{dispose(g);}
});
