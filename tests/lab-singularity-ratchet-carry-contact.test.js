import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {SingularityKit} from '../src/game/LabSingularityKit.js';
import {buildTower41RatchetCell} from '../src/game/LabTower41RatchetCell.js';
import {constrainTower41HeldLoadTarget} from '../src/game/LabTower41CarryContact.js';
import {constrainBoxToOrientedCollider} from '../src/game/LabOrientedBoxContact.js';

const DT=1/120,V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),Q=()=>new THREE.Quaternion();
// Initial poses are authored conditions in an isolated physical fixture. The
// ordinary controller journey is a separate acceptance requirement.
function fixture(position=[0,2.2,0]){
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[],cargo:new THREE.Object3D(),tower41RatchetQualification:true};
 const kit=new SingularityKit(game);kit.floor(-3,3,-3,3,0);
 const cell=buildTower41RatchetCell(game,kit,{centre:[0,0,0]});
 game.physics=new LabPhysics();for(const c of game.colliders)game.physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:c.kinematic});
 const cargo=game.physics.createCargo({position});cell.ensure();game.heldCube=game.cargo;game.firstLevel={singularity:true,ratchetCell:cell};
 const collider=cell.rackParts[0].collider;collider.tower41LoadFace={cell,body:cell.rack,shapeIndex:0};
 return {game,kit,cell,cargo,collider,dispose(){cell.dispose();kit.dispose();game.physics.dispose();}};
}
const policy=(f,target=V(0,1,0),quaternion=Q())=>constrainTower41HeldLoadTarget(f.game,f.collider,V().copy(f.cargo.position),target,quaternion);
function actualTrayFrame(f){
 const rack=f.cell.rack,shape=rack.shapes[0],bodyQuaternion=Q().copy(rack.quaternion);
 const quaternion=bodyQuaternion.clone().multiply(Q().copy(rack.shapeOrientations[0]));
 return {centre:V().copy(rack.shapeOffsets[0]).applyQuaternion(bodyQuaternion).add(rack.position),half:V().copy(shape.halfExtents),front:V(0,0,1).applyQuaternion(quaternion)};
}

test('41 tagged top bounds the hand target from the actual shape without writing actors',()=>{
 const f=fixture();try{
  const before=[f.cargo,f.cell.rack].map(b=>({p:b.position.toArray(),v:b.velocity.toArray(),q:b.quaternion.toArray(),w:b.angularVelocity.toArray(),mass:b.mass,mask:b.collisionFilterMask}));
  const target=V(0,1,0),result=policy(f,target);
  assert.ok(result);assert.deepEqual(target.toArray(),[0,1,0]);
  assert.ok(Math.abs(result.y-.39-1.6+.0005)<1e-10);
  assert.deepEqual([f.cargo,f.cell.rack].map(b=>({p:b.position.toArray(),v:b.velocity.toArray(),q:b.quaternion.toArray(),w:b.angularVelocity.toArray(),mass:b.mass,mask:b.collisionFilterMask})),before);
  assert.equal(f.cargo.mass,3.2);assert.equal(f.cargo.shapes[0].halfExtents.y,.39);
  assert.equal(policy(f,V(0,2.4,0)),null,'A target clearing the top retains the ordinary policy');
 }finally{f.dispose();}
});

test('41 load-face policy rejects ordinary rooms, forged ownership and guard descriptors',()=>{
 const f=fixture();try{
  const reject=mutate=>{const undo=mutate();assert.equal(policy(f),null);undo();};
  reject(()=>{f.game.tower41RatchetQualification=false;return()=>f.game.tower41RatchetQualification=true;});
  reject(()=>{f.game.firstLevel.singularity=false;return()=>f.game.firstLevel.singularity=true;});
  reject(()=>{f.game.heldCube=null;return()=>f.game.heldCube=f.game.cargo;});
  reject(()=>{const old=f.collider.tower41LoadFace;f.collider.tower41LoadFace={...old,body:f.cell.stops};return()=>f.collider.tower41LoadFace=old;});
  reject(()=>{const old=f.collider.tower41LoadFace;f.collider.tower41LoadFace={...old,shapeIndex:1};return()=>f.collider.tower41LoadFace=old;});
  reject(()=>{const old=f.cell.originalCargoBody;f.cell.originalCargoBody=f.cell.rack;return()=>f.cell.originalCargoBody=old;});
  reject(()=>{f.collider.enabled=false;return()=>f.collider.enabled=true;});
  reject(()=>{f.cell.rack.collisionResponse=false;return()=>f.cell.rack.collisionResponse=true;});
  reject(()=>{const old=f.collider.orientedBox;f.collider.orientedBox={...old,body:f.cell.stops};return()=>f.collider.orientedBox=old;});
  reject(()=>{const old=f.collider.orientedBox.current;f.collider.orientedBox.current={...old,center:old.center.clone().add(V(0,.01,0))};return()=>f.collider.orientedBox.current=old;});
  const guard=f.cell.stopParts.at(-1).collider;guard.tower41LoadFace={cell:f.cell,body:f.cell.rack,shapeIndex:0};
  assert.equal(constrainTower41HeldLoadTarget(f.game,guard,V().copy(f.cargo.position),V(0,1,0),Q()),null);
 }finally{f.dispose();}
});

test('41 side and underside approaches keep native clearance; real top overhang is admitted',()=>{
 for(const position of [[0,1.06,1.3],[0,.8,0],[2,2.2,0]]){
  const f=fixture(position);try{
   assert.equal(policy(f),null);
   const start=V().copy(f.cargo.position),target=V(0,1.06,0);
   const normal=constrainBoxToOrientedCollider(f.collider.orientedBox,start,target,V(.425,.425,.425),Q());
   const selected=constrainTower41HeldLoadTarget(f.game,f.collider,start,target,Q())??normal;
   assert.deepEqual(selected.toArray(),normal.toArray());
  }finally{f.dispose();}
 }
 const f=fixture();try{
  const tray=actualTrayFrame(f),cargoHalf=f.cargo.shapes[0].halfExtents.z;
  const front=tray.centre.clone().addScaledVector(tray.front,tray.half.z);
  const overhang=front.clone().addScaledVector(tray.front,cargoHalf/2);overhang.y=1;
  const outside=front.clone().addScaledVector(tray.front,cargoHalf+.001);outside.y=1;
  assert.ok(overhang.clone().sub(tray.centre).dot(tray.front)+cargoHalf>tray.half.z,'The desired cargo really extends beyond the actual front edge');
  assert.ok(policy(f,overhang),'A real positive top overlap is enough; the desired cargo need not fit entirely on the tray');
  assert.equal(policy(f,outside),null,'A desired footprint beyond the actual physical tray is rejected');
  console.info('41 load-face physical footprint',JSON.stringify({trayCentre:tray.centre.toArray(),trayHalf:tray.half.toArray(),frontEdge:front.toArray(),cargoHalf,admittedOverhangTarget:overhang.toArray(),rejectedOutsideTarget:outside.toArray()}));
 }finally{f.dispose();}
});

test('41 bounded held hand target produces actual Cannon top-contact forces on the original rack',()=>{
 const f=fixture(),world=f.game.physics.world;let contacts=0,heldTicks=0,lastContactStep=null,verticalImpulse=0,maxDepth=0;
 const original=f.cargo;
 const pre=()=>{
  let held=false;
  for(const c of world.contacts){
   if(!((c.bi===f.cargo&&c.bj===f.cell.rack)||(c.bj===f.cargo&&c.bi===f.cell.rack)))continue;
   assert.ok(c.si===f.cell.rack.shapes[0]||c.sj===f.cell.rack.shapes[0],'The original tray shape owns the real contact');
   const forceOnRack=c.ni.y*(c.bi===f.cell.rack?-c.multiplier:c.multiplier);
   const a=c.bi.position.vadd(c.ri),b=c.bj.position.vadd(c.rj),depth=Math.max(0,-b.vsub(a).dot(c.ni));
   assert.ok(Number.isFinite(c.multiplier)&&c.multiplier>=0);maxDepth=Math.max(maxDepth,depth);
   if(c.multiplier>0&&forceOnRack<0){contacts++;verticalImpulse-=forceOnRack*DT;held=true;}
  }
  if(held){heldTicks++;lastContactStep=world.stepnumber+1;}
 };
 world.addEventListener('preStep',pre);
 try{
  for(let i=0;i<240;i++){
   const target=policy(f,V(0,1,0));assert.ok(target);
   assert.ok(target.y-.39>=f.collider.orientedBox.current.center.y+.1-.0005-1e-10);
   f.game.physics.setCarryTarget(target,{quaternion:Q(),dt:DT});f.cell.updateForces(DT);f.game.physics.step(DT);
  }
  assert.equal(f.game.physics.cargoBody,original);assert.equal(f.game.heldCube,f.game.cargo);assert.equal(f.cargo.mass,3.2);
  assert.ok(heldTicks>20&&contacts>20,'Actual held cargo generates sustained positive contact equations');
  assert.ok(verticalImpulse>0,'The measured contact forces apply a nonzero downward impulse to the real rack');
  assert.ok(lastContactStep>=world.stepnumber-2,'Actual contacts persist at the end of the bounded pressure window');
  assert.ok(maxDepth<.005,'True pre-integration contact penetration stays within 5 mm');
  console.info('41 held load-face physical fixture',JSON.stringify({ticks:240,heldTicks,contacts,verticalImpulseNewtonSeconds:verticalImpulse,maxContactDepth:maxDepth,rackTravel:f.cell.diagnostics().rack.travel,originalCargoId:original.id}));
 }finally{world.removeEventListener('preStep',pre);f.dispose();}
});

test('41 disabling the qualification preserves the native no-contact clearance in the same Cannon fixture',()=>{
 const f=fixture(),world=f.game.physics.world;let contacts=0;
 f.game.tower41RatchetQualification=false;
 const pre=()=>{for(const c of world.contacts)if((c.bi===f.cargo&&c.bj===f.cell.rack)||(c.bj===f.cargo&&c.bi===f.cell.rack))contacts++;};
 world.addEventListener('preStep',pre);
 try{
  for(let i=0;i<240;i++){
   const start=V().copy(f.cargo.position),desired=V(0,1,0);
   assert.equal(constrainTower41HeldLoadTarget(f.game,f.collider,start,desired,Q()),null);
   const target=constrainBoxToOrientedCollider(f.collider.orientedBox,start,desired,V(.425,.425,.425),Q());
   f.game.physics.setCarryTarget(target,{quaternion:Q(),dt:DT});f.cell.updateForces(DT);f.game.physics.step(DT);
  }
  assert.equal(contacts,0,'The existing 35 mm target shell prevents real cargo/rack contact');
  assert.ok(Math.abs(f.cell.diagnostics().rack.travel)<.0001);
  assert.ok(f.cargo.position.y-.39-f.collider.orientedBox.current.center.y-.1>.035);
 }finally{world.removeEventListener('preStep',pre);f.dispose();}
});
