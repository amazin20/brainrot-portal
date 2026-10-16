import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Vec3} from 'cannon-es';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {SingularityKit} from '../src/game/LabSingularityKit.js';
import {buildTower41UpperLift} from '../src/game/LabTower41UpperLift.js';
import {buildTower41UpperReadability} from '../src/game/LabTower41UpperReadability.js';
const DT=1/120,V=(...v)=>new THREE.Vector3(...v);
function fixture({ensure=true,centre=[11,7,-18]}={}){
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[],cargo:new THREE.Object3D(),heldCube:null},k=new SingularityKit(game),cell=buildTower41UpperLift(game,k,{centre});
 game.physics=new LabPhysics();for(const c of game.colliders)game.physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:c.kinematic});game.physics.createCargo({position:[centre[0]+30,centre[1],centre[2]+30]});if(ensure)cell.ensure();
 let art=null;const step=()=>{game.physics.step(DT);art?.update();},until=p=>{for(let i=0;i<2600&&!p();i++)step();assert.ok(p(),JSON.stringify(cell.diagnostics()));};
 return{game,k,cell,build(){art=buildTower41UpperReadability({k,cell});return art;},get art(){return art;},step,until,catchCar(){until(()=>cell.height>6.4&&cell.diagnostics().direction===1);assert.equal(cell.armCatch(),true);until(()=>cell.retained);},dispose(){art?.dispose();cell.dispose();k.dispose();game.physics.dispose();}};
}
const bodyState=b=>({id:b.id,type:b.type,mass:b.mass,p:b.position.toArray(),q:b.quaternion.toArray(),v:b.velocity.toArray(),w:b.angularVelocity.toArray(),f:b.force.toArray(),t:b.torque.toArray(),shapeIds:b.shapes.map(s=>s.id),offsets:b.shapeOffsets.map(v=>v.toArray()),mask:b.collisionFilterMask,response:b.collisionResponse});
function physicsState(f){return{bodies:f.game.physics.world.bodies.map(bodyState),constraints:f.game.physics.world.constraints.map(c=>({id:c.id,a:c.bodyA.id,b:c.bodyB.id,e:c.equations.map(e=>({id:e.id,enabled:e.enabled,min:e.minForce,max:e.maxForce,bi:e.bi.id,bj:e.bj.id}))})),step:f.game.physics.world.stepnumber,cell:f.cell.owner?f.cell.diagnostics():null,colliders:f.game.colliders.map(c=>({id:c.mesh.uuid,p:c.mesh.position.toArray(),q:c.mesh.quaternion.toArray(),scale:c.mesh.scale.toArray(),bounds:[c.box.min.toArray(),c.box.max.toArray()],children:c.mesh.children.map(c=>c.uuid)}))};}
function registries(f){return[...['colliders','floors','cameraBlockers','aimBlockers','portalPanels'].map(key=>[key,[...f.game[key]]]),...['solids','bodyBoxes','cargoSweepBoxes'].map(key=>[key,[...f.game.physics[key].entries()]]),['bodies',[...f.game.physics.world.bodies]],['joints',[...f.game.physics.world.constraints]],['subsystems',[...f.game.physics.world.subsystems]],['terminals',[...f.k.terminals]],['compounds',[...f.k.compounds]]];}

test('upper readability neither initializes physics nor adds a physical surface, blocker or camera obstruction',()=>{
 const f=fixture({ensure:false});try{const before=registries(f),pose=physicsState(f),art=f.build();assert.equal(f.cell.owner,null);art.update();assert.deepEqual(registries(f),before);assert.deepEqual(physicsState(f),pose);assert.equal(art.diagnostics().kind,'uninitialized');assert.equal(art.diagnostics().pressure,false);assert.equal(art.diagnostics().supported,false);assert.ok(art.batches.length<=12);assert.ok(art.mounts.length<70);assert.equal(art.diagnostics().maxProjection,.005);f.cell.ensure();f.until(()=>f.cell.liftBody.velocity.y<-.1);art.update();assert.equal(art.diagnostics().kind,'descending');}finally{f.dispose();}
});

test('body-linked upper finishes track translated and rotated real compound frames without parenting beneath collider meshes',()=>{
 const f=fixture();try{const art=f.build();assert.equal(art.root.visualRefs,art.visualRefs);assert.equal(Object.getOwnPropertyDescriptor(art.root,'visualRefs').writable,false);assert.ok(Object.isFrozen(art.visualRefs));assert.equal(art.visualRefs.deck,f.cell.deckPart.mesh);assert.equal(art.visualRefs.shelf,f.cell.pawlParts[0].mesh);assert.deepEqual(art.visualRefs.guides,f.cell.fixedParts.slice(6,8).map(p=>p.mesh));assert.equal(art.visualRefs.pressureIndicator.material.name,'Upper lift / actual pressure');for(const [n,body]of [f.cell.liftBody,f.cell.pawlBody,f.cell.fixedBody].entries()){body.position.vadd(new Vec3(2*n,1+n,-3*n),body.position);body.quaternion.setFromAxisAngle(new Vec3(0,1,0),.2+n*.37);}f.cell.syncPose();art.update();art.root.updateWorldMatrix(true,true);
  const matrix=new THREE.Matrix4();for(const mount of art.mounts){const body=mount.kind==='lift'?f.cell.liftBody:mount.kind==='pawl'?f.cell.pawlBody:f.cell.fixedBody,part=(mount.kind==='lift'?f.cell.liftParts:mount.kind==='pawl'?f.cell.pawlParts:f.cell.fixedParts)[mount.shapeIndex],group=art.root.children.find(g=>g.name.endsWith('/ '+mount.kind));
   const actual=V(...mount.local).applyMatrix4(group.matrixWorld),rotated=body.quaternion.vmult(new Vec3(...mount.local)),expected=V(body.position.x+rotated.x,body.position.y+rotated.y,body.position.z+rotated.z);assert.ok(actual.distanceTo(expected)<1e-9);
   assert.equal(part.mesh.children.length,0);const h=part.half,rotation=new THREE.Matrix4().makeRotationX(mount.rotation),half=V(...mount.size).multiplyScalar(.5),extent=V(Math.abs(rotation.elements[0])*half.x+Math.abs(rotation.elements[4])*half.y+Math.abs(rotation.elements[8])*half.z,Math.abs(rotation.elements[1])*half.x+Math.abs(rotation.elements[5])*half.y+Math.abs(rotation.elements[9])*half.z,Math.abs(rotation.elements[2])*half.x+Math.abs(rotation.elements[6])*half.y+Math.abs(rotation.elements[10])*half.z);
   for(const [i,key]of ['x','y','z'].entries())assert.ok(Math.abs(mount.offset[i])+extent[key]<=h[key]+.00500001,'A finish projects beyond its shallow actual host: '+mount.role);
  }
  for(const batch of art.batches){assert.equal(batch.userData.presentationOnly,true);batch.getMatrixAt(0,matrix);assert.ok(matrix.elements.every(Number.isFinite));assert.equal(f.game.colliders.some(c=>c.mesh===batch),false);}
 }finally{f.dispose();}
});

test('actual motion, current caught contact and pressure loss control upper world-space cues without granting progress',()=>{
 const f=fixture();try{const art=f.build();f.until(()=>f.cell.liftBody.velocity.y<-.1);assert.equal(art.diagnostics().kind,'descending');f.until(()=>f.cell.liftBody.velocity.y>.1);assert.equal(art.diagnostics().kind,'rising');f.catchCar();assert.equal(art.diagnostics().kind,'supported');assert.equal(art.diagnostics().pressure,true);assert.equal(f.cell.rideComplete,false);
  const before=physicsState(f),registry=registries(f);for(let i=0;i<100;i++)art.update(i%2?.1:0);assert.deepEqual(physicsState(f),before);assert.deepEqual(registries(f),registry);
  f.cell.pawlBody.collisionResponse=false;art.update();assert.equal(art.diagnostics().supported,false);f.cell.pawlBody.collisionResponse=true;art.update();assert.equal(art.diagnostics().supported,true);
  const entry=f.game.physics.bodyBoxes.get(f.cell.deckPart.mesh.uuid);f.game.physics.removeBodyBox(f.cell.deckPart.mesh.uuid);art.update();assert.equal(art.diagnostics().supported,false);f.game.physics.bodyBoxes.set(f.cell.deckPart.mesh.uuid,entry);art.update();assert.equal(art.diagnostics().supported,true);
  f.cell.powered=false;f.step();assert.equal(art.diagnostics().pressure,false);for(let i=0;i<240;i++)f.step();assert.equal(art.diagnostics().supported,true);f.cell.reset();art.update();assert.equal(art.diagnostics().supported,false);assert.equal(art.diagnostics().pressure,false);assert.equal(art.diagnostics().kind,'rest');
 }finally{f.dispose();}
});

test('upper finishes restore only their own material assignments and dispose their resources exactly once',()=>{
 const f=fixture();try{const original=new Map([...f.cell.liftParts,...f.cell.pawlParts,...f.cell.fixedParts].map(p=>[p.mesh,p.mesh.material])),before=registries(f),pose=physicsState(f),art=f.build();
  let geometryDisposals=0,materialDisposals=0,batchDisposals=0;const geometry=art.batches[0].geometry;geometry.addEventListener('dispose',()=>geometryDisposals++);for(const m of art.materials)m.addEventListener('dispose',()=>materialDisposals++);for(const m of art.batches)m.addEventListener('dispose',()=>batchDisposals++);
  art.dispose();art.dispose();assert.equal(art.root.parent,null);assert.equal(art.disposed,true);assert.equal(geometryDisposals,1);assert.equal(materialDisposals,art.materials.length);assert.equal(batchDisposals,art.batches.length);for(const [mesh,material]of original)assert.equal(mesh.material,material);assert.deepEqual(registries(f),before);assert.deepEqual(physicsState(f),pose);
 }finally{f.dispose();}
});
