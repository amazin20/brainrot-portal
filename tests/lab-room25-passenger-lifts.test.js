import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body,Box,Vec3} from 'cannon-es';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {LabTileWorld} from '../src/game/LabTileWorldBase.js';
import {opticalPhysicalLift} from '../src/game/LabRoom25PhysicalLift.js';
import {resolveCapsuleBoxMotion,capsuleBoxGrounded} from '../src/game/LabOrientedBoxContact.js';

const DT=1/120;
function fixture(){
 const g={scene:new THREE.Scene(),colliders:[],cameraBlockers:[],aimBlockers:[],floors:[]};
 g.box=(x,y,z,sx,sy,sz,material,{solid=true,parent=g.scene,camera=true,aim=true}={})=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);mesh.position.set(x,y,z);parent.add(mesh);mesh.updateWorldMatrix(true,false);
  if(solid)g.colliders.push({mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true});if(camera)g.cameraBlockers.push(mesh);if(aim)g.aimBlockers.push(mesh);return mesh;
 };
 const k={game:g,world:new LabTileWorld(g,{wall:0x333333,floor:0x666666,accent:0xffffff}),ticks:[],resets:[],state:{}};
 const physics=g.physics=new LabPhysics();physics.createCargo({position:[100,100,100]});
 const lift=opticalPhysicalLift(k,'passenger',[0,0,0],{top:9});assert.equal(lift.ensure(),true);
 const step=(n=1)=>{for(let i=0;i<n;i++)physics.step(DT);};
 const dispose=()=>{lift.dispose();physics.dispose();g.scene.traverse(o=>o.geometry?.dispose());for(const m of Object.values(k.world.materials))m.dispose();};
 return{g,k,physics,lift,step,dispose};
}

test('Room25 passenger car has one persistent guided dynamic body and permanent owned stops outside its original footprint',()=>{
 const f=fixture();try{
  assert.equal(f.lift.body.type,Body.DYNAMIC);assert.deepEqual(f.lift.body.linearFactor.toArray(),[0,1,0]);assert.equal(f.lift.fixedBody.type,Body.STATIC);
  for(const p of f.lift.parts){assert.equal(f.physics.solids.has(p.mesh.uuid),false);assert.equal(f.physics.bodyBoxes.get(p.mesh.uuid).body,p.body);assert.equal(f.physics.inspectBodyBox(p.mesh.uuid,{bounds:p.collider.box}).valid,true);if(p.mesh.name.includes('stop')||p.mesh.name.includes('rail'))assert.ok(p.collider.box.max.x< -2||p.collider.box.min.x>2);}
  assert.equal(f.lift.diagnostics().liveOwnership,true);
 }finally{f.dispose();}
});

test('bounded current motor meets actual upper stop contact, then darkness returns the same car against actual lower stops',()=>{
 const f=fixture();try{
  const ids=f.lift.bodies.map(b=>b.id);f.lift.powered=true;let maxPower=0,maxY=0;
  for(let i=0;i<900;i++){f.step();const d=f.lift.diagnostics();maxPower=Math.max(maxPower,Math.abs(d.lastForce.motorPower));maxY=Math.max(maxY,d.height);assert.ok(d.lastForce.dampingPower<=1e-10);assert.equal(d.lastForce.forceBalanceY,0);}
  assert.ok(maxY<9.03,`Maximum real stop excursion: ${maxY}`);assert.ok(f.lift.progress>.999);assert.ok(f.lift.diagnostics().endStopContacts>0);assert.ok(f.lift.diagnostics().endStopForce>200);assert.ok(maxPower<=f.lift.budget.motorPower+1e-8);
  f.lift.powered=false;f.step(120);assert.ok(f.lift.velocity< -1.19&&f.lift.velocity> -1.21);assert.equal(f.lift.diagnostics().lastForce.motorForce,0);
  f.step(1080);assert.ok(Math.abs(f.lift.position.y)<.001);assert.ok(f.lift.diagnostics().endStopForce>100);assert.deepEqual(f.lift.bodies.map(b=>b.id),ids);
  assert.equal(f.lift.forceApplications.size,2048);assert.ok([...f.lift.forceApplications.values()].every(n=>n===1));
 }finally{f.dispose();}
});

test('a real intervening solid arrests the powered passenger car before its nominal top',()=>{
 const f=fixture();try{
  const obstruction=new Body({mass:0,position:new Vec3(0,4,0),shape:new Box(new Vec3(2,.15,2)),collisionFilterGroup:1,collisionFilterMask:3});f.physics.world.addBody(obstruction);
  f.lift.powered=true;f.step(720);assert.ok(f.lift.position.y>3.84&&f.lift.position.y<3.86);assert.ok(f.physics.world.contacts.some(c=>c.multiplier>0&&((c.bi===f.lift.body&&c.bj===obstruction)||(c.bj===f.lift.body&&c.bi===obstruction))));
  f.physics.world.removeBody(obstruction);f.step(600);assert.ok(f.lift.position.y>8.99);
 }finally{f.dispose();}
});

test('ordinary shared oriented-box capsule contacts ride a rising passenger deck without lift-side player translation',()=>{
 const f=fixture();try{
  const foot=new THREE.Vector3(0,.0001,0),velocity=new THREE.Vector3(),box=f.lift.surface.collider.orientedBox;f.lift.powered=true;
  let supportedSteps=0;
  for(let n=0;n<650;n++){
   const previous=foot.clone();velocity.y-=19.5*DT;foot.addScaledVector(velocity,DT);f.step();resolveCapsuleBoxMotion(foot,previous,velocity,.43,2.4,box);if(capsuleBoxGrounded(foot,velocity,.43,2.4,box))supportedSteps++;
  }
  assert.ok(foot.y>8.99&&foot.y<9.01);assert.ok(supportedSteps>600);assert.ok(Math.abs(foot.x)<1e-10&&Math.abs(foot.z)<1e-10);
  // Both ordinary galleries leave through a deck side. Outboard stop hardware
  // must also clear the capsule as it crosses the original four-metre edge.
  for(let n=0;n<80;n++){const previous=foot.clone();foot.x+=.05;velocity.x=6;for(const part of f.lift.parts)resolveCapsuleBoxMotion(foot,previous,velocity,.43,2.4,part.collider.orientedBox);}
  assert.ok(foot.x>3.99,'Actual stop hardware must leave the ordinary side exit clear');
 }finally{f.dispose();}
});

test('reset retains body and registry identities; dispose removes the owned callbacks and registrations',()=>{
 const f=fixture();try{
  const ids=f.lift.bodies.map(b=>b.id),entries=f.lift.parts.map(p=>f.physics.bodyBoxes.get(p.mesh.uuid)),bodyCount=f.physics.world.bodies.length,systems=f.physics.world.subsystems.length;
  for(let n=0;n<3;n++){f.lift.powered=true;f.step(240);f.lift.reset();assert.equal(f.lift.position.y,0);assert.equal(f.lift.velocity,0);assert.equal(f.lift.powered,false);assert.deepEqual(f.lift.bodies.map(b=>b.id),ids);assert.deepEqual(f.lift.parts.map(p=>f.physics.bodyBoxes.get(p.mesh.uuid)),entries);assert.equal(f.physics.world.bodies.length,bodyCount);assert.equal(f.physics.world.subsystems.length,systems);}
  f.lift.dispose();assert.equal(f.physics.world.subsystems.length,systems-1);assert.equal(f.physics.world.bodies.length,bodyCount-2);for(const p of f.lift.parts)assert.equal(f.physics.bodyBoxes.has(p.mesh.uuid),false);assert.equal(f.lift.ensure(),false);assert.equal(f.k.ticks.length,0);assert.equal(f.k.resets.length,0);
 }finally{f.dispose();}
});
