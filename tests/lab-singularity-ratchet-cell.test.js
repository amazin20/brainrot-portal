import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body,HingeConstraint,LockConstraint} from 'cannon-es';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {SingularityKit} from '../src/game/LabSingularityKit.js';
import {buildTower41RatchetCell} from '../src/game/LabTower41RatchetCell.js';

const DT=1/120;
// Authored initial conditions belong to this isolated Cannon fixture. The
// production input fixture separately proves jump/E access with the real actor.
function fixture(options={},cargoPosition=[0,2.2,0]){
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[],cargo:new THREE.Object3D()};
 const kit=new SingularityKit(game);kit.floor(-3,3,-3,3,0);
 const cell=buildTower41RatchetCell(game,kit,{centre:[0,0,0],...options});
 assert.equal(cell.ensure(),false,'The level precedes the physics owner');
 game.physics=new LabPhysics();for(const c of game.colliders)game.physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:c.kinematic});
 game.physics.createCargo({position:cargoPosition});cell.ensure();
 const body=game.physics.cargoBody,measure={cargoRack:0,pawlTooth:0,maxPenetration:0,maxGuideDrift:0,maxGuideAngle:0,minimumY:1.5};
 const sample=()=>{
  for(const c of game.physics.world.contacts){
   const a=c.bi.position.vadd(c.ri),b=c.bj.position.vadd(c.rj),penetration=Math.max(0,-c.ni.dot(b.vsub(a)));
   if([c.bi,c.bj].some(b=>cell.bodies.includes(b)))measure.maxPenetration=Math.max(measure.maxPenetration,penetration);
   if([c.bi,c.bj].includes(body)&&[c.bi,c.bj].includes(cell.rack))measure.cargoRack++;
   if(cell.pawl&&[c.bi,c.bj].includes(cell.pawl)&&[c.bi,c.bj].includes(cell.rack)&&cell.teeth.some(t=>t.shape===c.si||t.shape===c.sj))measure.pawlTooth++;
  }
 };
 game.physics.world.addEventListener('preStep',sample);
 measure.minimumRackAABB=Infinity;
 const step=(seconds=DT)=>{for(let i=0;i<Math.round(seconds/DT);i++){cell.updateForces(DT);game.physics.step(DT);cell.rack.updateAABB();measure.minimumRackAABB=Math.min(measure.minimumRackAABB,cell.rack.aabb.lowerBound.y);measure.minimumY=Math.min(measure.minimumY,cell.rack.position.y);measure.maxGuideDrift=Math.max(measure.maxGuideDrift,Math.hypot(cell.rack.position.x-cell.rackOrigin.x,cell.rack.position.z-cell.rackOrigin.z));measure.maxGuideAngle=Math.max(measure.maxGuideAngle,2*Math.acos(Math.min(1,Math.abs(cell.rack.quaternion.w))));}};
 const until=(condition,seconds=4)=>{for(let i=0;i<seconds/DT&&!condition();i++)step();assert.ok(condition(),JSON.stringify({cell:cell.diagnostics(),cargo:body.position.toArray(),measure}));};
 const extract=()=>{game.physics.setCarryTarget([0,2.1,1.8]);step(3);};
 return{game,kit,cell,body,measure,step,until,extract,dispose(){game.physics.world.removeEventListener('preStep',sample);cell.dispose();kit.dispose();game.physics.dispose();}};
}

test('41 true cargo contact moves the rack; physical pawl retains two unloaded shoulders',()=>{
 const f=fixture();try{
  const {cell,game,body,measure,step,until,extract}=f;
  assert.equal(cell.rack.type,Body.DYNAMIC);assert.equal(cell.pawl.type,Body.DYNAMIC);
  assert.ok(cell.guide instanceof LockConstraint);assert.ok(cell.hinge instanceof HingeConstraint);
  until(()=>cell.diagnostics().rack.travel>.4);assert.ok(measure.cargoRack>0);extract();
  const first=cell.diagnostics().rack.travel;assert.ok(first>.12&&first<.23);assert.ok(Math.abs(cell.rack.velocity.y)<.005);assert.ok(measure.pawlTooth>20);
  const contactsBefore=measure.cargoRack;
  game.physics.setCarryTarget([0,2.1,0]);step(.4);game.physics.release();
  until(()=>cell.diagnostics().rack.travel>.67);extract();
  const second=cell.diagnostics().rack.travel;assert.ok(second>first+.20&&second<first+.31);assert.ok(Math.abs(cell.rack.velocity.y)<.005);assert.ok(measure.cargoRack>contactsBefore);
  assert.equal(game.physics.cargoBody,body);assert.equal(cell.originalCargoBody,body);
  assert.ok(measure.maxGuideDrift<.002);assert.ok(measure.maxGuideAngle<.005);
  assert.ok(measure.maxPenetration<.035,JSON.stringify(measure));
  console.info('41 physical ratchet cycle',JSON.stringify({first,second,measure,bodyId:body.id}));
 }finally{f.dispose();}
});

test('41 removing the physical pawl lets the same spring return to the real upper stop',()=>{
 const f=fixture({pawl:false});try{
  f.until(()=>f.cell.diagnostics().rack.travel>.4);assert.ok(f.measure.cargoRack>0);f.extract();
  assert.equal(f.cell.pawl,null);assert.equal(f.cell.constraints.length,1);assert.equal(f.cell.springs.length,1);
  let minimum=Infinity,maximum=-Infinity,maxSpeed=0;for(let i=0;i<120;i++){f.step();minimum=Math.min(minimum,f.cell.rack.position.y);maximum=Math.max(maximum,f.cell.rack.position.y);maxSpeed=Math.max(maxSpeed,Math.abs(f.cell.rack.velocity.y));}
  assert.ok(Math.abs(f.cell.rack.position.y-1.5)<.003);assert.ok(maximum-minimum<.002);assert.ok(maxSpeed<.005,JSON.stringify({minimum,maximum,maxSpeed}));
 }finally{f.dispose();}
});

test('41 absent restoring spring cannot hold or return an empty gravity-loaded rack',()=>{
 const f=fixture({rackSpring:false},[2,.4,2]);try{
  f.step(3);assert.equal(f.measure.cargoRack,0);assert.equal(f.cell.springs.length,1);
  assert.ok(Math.abs(f.cell.rack.position.y-.5)<.003);assert.ok(Math.abs(f.cell.rack.velocity.y)<.005);
  assert.ok(f.measure.minimumY>.44,'The real lower stop bounds the gravity fall');
  assert.ok(f.measure.minimumRackAABB>0,'Even the transient real fall does not cross the uncut floor');
  f.cell.rack.updateAABB();assert.ok(f.cell.rack.aabb.lowerBound.y>.035,'The actual mechanism remains above the uncut existing floor');assert.ok(f.cell.rack.aabb.upperBound.y<2.8);
 }finally{f.dispose();}
});

test('41 lazy ownership, before-step forces, double reset and disposal retain the original cargo',()=>{
 const f=fixture({},[2,.4,2]);try{
  const {cell,game,body,step}=f,world=game.physics.world,owned=[...cell.bodies],joints=[...cell.constraints];
  assert.equal(owned.length,4);assert.deepEqual(joints.map(c=>c.equations.length),[5,5]);
  assert.equal(cell.guide.equations.includes(cell.guide.equationY),false);assert.equal(cell.hinge.equations.includes(cell.hinge.motorEquation),false);
  for(const part of [...cell.rackParts,...cell.stopParts,cell.pawlPart])assert.equal(game.physics.solids.has(part.mesh.uuid),false);
  const counts=[world.bodies.length,world.constraints.length,world._listeners.postStep.length];
  cell.ensure();cell.ensure();assert.deepEqual([world.bodies.length,world.constraints.length,world._listeners.postStep.length],counts);
  cell.updateForces(0);assert.equal(cell.rack.force.length(),0);cell.updateForces(DT);assert.ok(cell.rack.force.y>27.9&&cell.rack.force.y<28.1);
  const force=cell.rack.force.clone();cell.updateForces(DT);assert.equal(cell.rack.force.distanceTo(force),0);
  game.physics.step(DT);step(3);assert.ok(Math.abs(cell.rack.position.y-1.5)<.003,'The empty spring rack meets its actual upper stop');assert.equal(f.measure.cargoRack,0);
  const cargoPose=body.position.clone();cell.reset();cell.reset();assert.equal(body.position.distanceTo(cargoPose),0);assert.equal(game.physics.cargoBody,body);
  assert.deepEqual([world.bodies.length,world.constraints.length,world._listeners.postStep.length],counts);
  assert.ok(Math.abs(cell.rack.position.y-1.5)<1e-12);assert.equal(cell.rack.velocity.length(),0);assert.equal(cell.rack.force.length(),0);
  const before=cell.rackParts[0].collider.orientedBox.current.center.clone();cell.syncPose();cell.syncPose();assert.equal(cell.rackParts[0].collider.orientedBox.previous.center.distanceTo(before),0);
  cell.dispose();cell.dispose();assert.equal(cell.ensure(),false);assert.equal(game.physics.cargoBody,body);
  for(const b of owned)assert.equal(world.bodies.includes(b),false);for(const c of joints)assert.equal(world.constraints.includes(c),false);
  assert.deepEqual([world.bodies.length,world.constraints.length,world._listeners.postStep.length],[counts[0]-4,counts[1]-2,counts[2]-1]);
  cell.updateForces(DT);game.physics.step(DT);assert.equal(world.bodies.includes(body),true);
 }finally{f.dispose();}
});
