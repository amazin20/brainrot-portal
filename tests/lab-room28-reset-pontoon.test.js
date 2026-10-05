import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const g=await createHeadlessGame();g.chamberEdition='foundation';
after(()=>{g.physics.dispose();g.portals.dispose();});
const V=()=>new THREE.Vector3();
const difference=(a,b)=>Math.max(a.min.distanceTo(b.min),a.max.distanceTo(b.max));
function bodyBounds(body){
 const result=new THREE.Box3(),q=new THREE.Quaternion().copy(body.quaternion),position=V().copy(body.position);
 body.shapes.forEach((shape,i)=>{
  assert.ok(shape.halfExtents,'Pontoon must have its actual rigid box shape');
  const h=shape.halfExtents,sq=new THREE.Quaternion().copy(body.shapeOrientations[i]),offset=V().copy(body.shapeOffsets[i]);
  for(const x of [-h.x,h.x])for(const y of [-h.y,h.y])for(const z of [-h.z,h.z])result.expandByPoint(new THREE.Vector3(x,y,z).applyQuaternion(sq).add(offset).applyQuaternion(q).add(position));
 });return result;
}

test('room28 Play reset and public restart publish both pontoon bodies immediately, with no phantom rise and the ordinary water route intact',async()=>{
 await g.selectLevel(27,false);
 const pontoonColliders=g.colliders.filter(c=>c.mesh.name==='Sealed tidal pontoon / physical envelope');
 assert.equal(pontoonColliders.length,2,'Both visible pontoon hulls need their real physical envelopes');
 const cargo=g.cargo,cargoGroup=g.cargo.group,cargoBody=g.physics.cargoBody;
 const originals=pontoonColliders.map(c=>({c,mesh:c.mesh,geometry:c.mesh.geometry,visibleModel:g.scene.getObjectByProperty('uuid',c.solidModel),body:g.physics.solids.get(c.mesh.uuid).body}));
 function inspect(label,{stationary=false}={}){
  assert.equal(g.cargo,cargo);assert.equal(g.cargo.group,cargoGroup);assert.equal(g.physics.cargoBody,cargoBody);
  for(const {c,mesh,geometry,visibleModel,body}of originals){
   assert.equal(c.mesh,mesh);assert.equal(mesh.geometry,geometry);assert.equal(g.physics.solids.get(mesh.uuid).body,body);
   assert.ok(visibleModel?.visible,'The collider must belong to the original visible pontoon model');
   const visible=new THREE.Box3().setFromObject(visibleModel),physical=bodyBounds(body),gap=difference(visible,physical);
   assert.ok(difference(visible,c.box)<1e-4,`${label}: visible pontoon/collider gap`);
   assert.ok(gap<1e-4,`${label}: actual Cannon body lags visible pontoon by ${gap} m`);
   if(stationary)assert.ok(body.velocity.length()<1e-5,`${label}: a reset pontoon must not rise invisibly underneath its stationary art`);
  }
 }
 function frames(label){
  for(let n=1;n<=120;n++){g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,0);inspect(`${label} frame ${n}`,{stationary:true});}
 }
 // Deliberately inspect before any simulation step; waiting for the body to
 // catch up would conceal the reset discrepancy this regression protects.
 g.resetRun(true);inspect('Play reset before first tick',{stationary:true});frames('Play');
 g.restart();inspect('public restart before first tick',{stationary:true});frames('restart');
 const visuals=g.updateVisuals;let routeFrames=0;
 g.updateVisuals=function(...args){const result=visuals.apply(this,args);routeFrames++;inspect(`ordinary route frame ${routeFrames}`);return result;};
 let journey;
 try{journey=await runV8Journey(g,{onMilestone:m=>inspect('ordinary route milestone '+m.name)});}
 finally{g.updateVisuals=visuals;}
 assert.equal(journey.pass,true);assert.equal(journey.resets+journey.respawns,0);assert.equal(g.state,'won');
 assert.ok(journey.milestones.some(m=>m.name==='the same water returns beneath both travellers'));
 inspect('ordinary route finish');
});
