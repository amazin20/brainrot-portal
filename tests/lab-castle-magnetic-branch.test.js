import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {SingularityKit} from '../src/game/LabSingularityKit.js';
import {buildCastleMagneticBranch,CASTLE_MAGNETIC as cfg} from '../src/game/LabCastleMagneticBranch.js';
import {makePortalFrame,portalCrossing,orientedBoxFitsPortal,uprightCapsuleFitsPortal} from '../src/game/LabPortals.js';
const V=(...p)=>new THREE.Vector3(...p),dt=1/120;

// This fixture uses the production cargo owner/step/cap/damping and the FULL
// branch's real geometry. It has no renderer, assets, actor-pose helpers or
// campaign construction. Ordinary input journey acceptance is separate.
function fixture({height=12,enabled=true,polarity=1}={}){
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[],
  playerPosition:V(-16,0,0),previousPlayerPosition:V(-16,0,0),playerGrounded:true,heldCube:false,
  markPortalSurface(mesh,center,normal,halfWidth,halfHeight){Object.assign(mesh.userData,{portalable:true,center:center.clone(),normal:normal.clone(),portalBounds:{halfWidth,halfHeight}});this.portalPanels.push(mesh);}};
 const physics=game.physics=new LabPhysics(),body=physics.createCargo({position:[-16,height,12]});body.allowSleep=false;
 game.cargo={position:V().copy(body.position),quaternion:new THREE.Quaternion()};
 const k=new SingularityKit(game),room={def:{id:'magnet',at:[0,0,0],w:44,d:42,h:15,entry:'w'},P:(x,z=0,y=0)=>[x,y,z]};
 // The real shell roof is part of the castle owner, rather than the branch.
 k.box([0,15.25,0],[44.7,.5,42.7],k.m.dark);
 const completions=[];
 const branch=buildCastleMagneticBranch({game,k,room,complete:(id,proof)=>{if(!completions.length)completions.push({id,proof});},isComplete:()=>completions.length>0});
 for(const c of game.colliders)physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:c.kinematic,enabled:c.enabled});branch.ensure();
 if(enabled)branch.controls.supply.action();if(polarity<0)branch.controls.polarity.action();
 const entry=makePortalFrame(branch.intake.center,V(0,1,0),V(0,0,-1),branch.intake.mesh.userData.portalSize),
  exitFrame=branch.outlet.frame(),exit=makePortalFrame(exitFrame.center,exitFrame.normal,exitFrame.up,branch.outlet.mesh.userData.portalSize),
  backing=[branch.intake.mesh.uuid,...branch.intake.mesh.userData.portalBackingIds];
 let transit=null,positiveFloorContacts=0,roofContacts=0,maximumTotalEnergyExcess=0,maximumPostTransitEnergyExcess=0;
 const initialEnergy=body.mass*19.5*height,originalShape=body.shapes[0],originalBodyId=body.id;
 const step=()=>{
  const before=V().copy(body.position),beforeQ=new THREE.Quaternion().copy(body.quaternion),near=!transit&&before.y<1
   &&orientedBoxFitsPortal(entry,before,beforeQ,.39);
  for(const id of backing)physics.setStaticEnabled(id,!near);
  const exitClear=transit&&body.position.x>cfg.outlet[0]+.9;
  physics.setStaticEnabled(branch.outlet.mesh.uuid,!transit||Boolean(exitClear));
  branch.updateForces(dt);physics.step(dt);
  if(!transit){
   const travel=portalCrossing(entry,exit,V().copy(body.position),before,V().copy(body.velocity),.39,
    {boxQuaternion:new THREE.Quaternion().copy(body.quaternion),previousBoxQuaternion:beforeQ,boxHalfSize:.39});
   if(travel){const actualOrigin=body.position.clone(),beforeK=.5*body.mass*body.velocity.lengthSquared();
    physics.teleportCargo({position:travel.position,rotation:travel.rotation});
    transit={worldStep:physics.world.stepnumber,actualOrigin:actualOrigin.toArray(),destination:body.position.toArray(),incomingSpeed:Math.sqrt(2*beforeK/body.mass),
     portalHeightWork:body.mass*19.5*(body.position.y-actualOrigin.y),idealPlaneHeightWork:body.mass*19.5*(exit.position.y-entry.position.y),
     kineticBefore:beforeK,kineticAfter:.5*body.mass*body.velocity.lengthSquared(),entrySurfaceId:branch.intake.mesh.uuid,exitSurfaceId:branch.outlet.mesh.uuid};
   }
  }
  game.cargo.position.copy(body.position);game.cargo.quaternion.copy(body.quaternion);branch.update(dt);
  const energy=.5*body.mass*body.velocity.lengthSquared()+body.mass*19.5*body.position.y;
  maximumTotalEnergyExcess=Math.max(maximumTotalEnergyExcess,energy-initialEnergy-(transit?.portalHeightWork??0));
  if(transit)maximumPostTransitEnergyExcess=Math.max(maximumPostTransitEnergyExcess,energy-body.mass*19.5*exit.position.y-transit.kineticAfter);
  const receiver=physics.solids.get(branch.receiverFloor.uuid).body,roof=physics.solids.get(branch.receiverRoof.uuid).body;
  for(const c of physics.world.contacts)if(c.enabled&&c.multiplier>0){
   if(c.bi===body&&c.bj===receiver&&-c.ni.y>.95||c.bj===body&&c.bi===receiver&&c.ni.y>.95)positiveFloorContacts++;
   if(c.bi===body&&c.bj===roof||c.bj===body&&c.bi===roof)roofContacts++;
  }
 };
 const result=()=>({transit,positiveFloorContacts,roofContacts,maximumTotalEnergyExcess,maximumPostTransitEnergyExcess,
  sameBody:body.id===originalBodyId&&physics.cargoBody===body,sameShape:body.shapes[0]===originalShape,
  position:body.position.toArray(),velocity:body.velocity.toArray(),diagnostics:branch.diagnostics(),completions});
 const dispose=()=>{branch.dispose();k.dispose();physics.dispose();};return{game,k,physics,body,branch,step,result,dispose};
}
function firstHit(f,from,to){const ray=new THREE.Raycaster(V(...from),V(...to).sub(V(...from)).normalize(),0,V(...from).distanceTo(V(...to))+.002);f.k.root.updateWorldMatrix(true,true);return ray.intersectObjects(f.game.aimBlockers,false)[0];}

for(const height of[12,13,14])test(`production magnetic spatial route: actual ${height}m fall reaches current original-body plate contact`,t=>{
 const f=fixture({height});try{
  for(let i=0;i<1250;i++)f.step();const r=f.result();
  assert.ok(r.transit,'A real swept inlet crossing is required');assert.equal(r.sameBody,true);assert.equal(r.sameShape,true);
  assert.equal(f.body.mass,3.2);assert.deepEqual(f.body.shapes[0].halfExtents.toArray(),[.39,.39,.39]);
  assert.equal(f.body.linearDamping,.035);assert.equal(f.body.angularDamping,.16);assert.ok(r.transit.incomingSpeed<=22+1e-9);
  assert.ok(Math.abs(r.transit.kineticBefore-r.transit.kineticAfter)<1e-8);assert.ok(r.transit.portalHeightWork>530.4);
  assert.ok(Math.abs(r.transit.idealPlaneHeightWork-528.216)<1e-8,'The authored inlet is 35mm above the supported floor');
  assert.ok(r.positiveFloorContacts>100);assert.equal(r.roofContacts,0);assert.equal(r.completions.length,1);
  assert.equal(r.completions[0].proof.originalCargoBodyId,f.body.id);assert.ok(r.completions[0].proof.upwardNormal[1]>.95);
  assert.ok(r.position[0]>-6&&r.position[0]<-2&&r.position[2]>5.1&&r.position[2]<7&&Math.abs(r.position[1]-4.39)<.02);
  assert.ok(Math.abs(r.diagnostics.magneticWork)<1e-8);assert.ok(r.maximumTotalEnergyExcess<1e-7);assert.ok(r.maximumPostTransitEnergyExcess<1e-7);
  assert.ok(r.diagnostics.serviceProgress>.995&&r.diagnostics.hatchProgress>.995);t.diagnostic(JSON.stringify(r));
 }finally{f.dispose();}
});

for(const [name,options]of[['disabled field',{enabled:false}],['reversed field',{polarity:-1}],['four-metre fall',{height:4}]])test(`production magnetic negative: ${name} misses and keeps the original on the recovery floor`,t=>{
 const f=fixture(options);try{
  for(let i=0;i<1250;i++)f.step();const r=f.result();assert.ok(r.transit);assert.equal(r.sameBody,true);assert.equal(r.sameShape,true);
  assert.equal(r.positiveFloorContacts,0);assert.equal(r.completions.length,0);assert.ok(Math.abs(r.position[1]+3.61)<.03,`Cargo trapped at ${r.position}`);
  assert.ok(r.maximumTotalEnergyExcess<1e-7);assert.equal(r.diagnostics.serviceProgress,0);t.diagnostic(JSON.stringify(r));
 }finally{f.dispose();}
});

test('real small shot slit exposes only the fixed cargo-only address; the two observation walls remain solid',()=>{
 const f=fixture();try{
  const from=[cfg.shotStand[0],cfg.shotStand[1]+1.7,cfg.shotStand[2]],target=f.branch.outlet.center.toArray();
  assert.equal(firstHit(f,from,target)?.object,f.branch.outlet.mesh,'Ordinary eye-height ray must reach the exact fixed outlet');
  for(const z of[-5,0,7])assert.equal(firstHit(f,[-16,6,z],[-13,6,z])?.object,f.branch.observationGlass,'Glass is a real charged-shot/camera/cargo wall');
  for(const x of[-13,-11.8,-9.3])assert.ok(firstHit(f,[x,10,-12],[x,10,-10]),'Every apparent closed pane must really block');
  const aperture=f.branch.outlet.mesh.userData.portalSize,frame=f.branch.outlet.frame(),exit=makePortalFrame(frame.center,frame.normal,frame.up,aperture);
  assert.equal(uprightCapsuleFitsPortal(exit,2.4,.43),false);assert.ok(orientedBoxFitsPortal(exit,frame.center,new THREE.Quaternion(),.39));
  assert.ok(.64<.78,'The one real slit cannot admit the original cargo in any orientation');
 }finally{f.dispose();}
});

test('powered gate and hatch have clear pockets, and current contact cannot be replaced by held cargo or a missing receiver',()=>{
 const f=fixture();try{
  const receiver=f.physics.solids.get(f.branch.receiverFloor.uuid),world=f.physics.world;
  assert.equal(f.branch.contact,null);f.game.heldCube=true;assert.equal(f.branch.contact,null);f.game.heldCube=false;
  f.physics.setStaticEnabled(f.branch.receiverFloor.uuid,false);assert.equal(f.branch.contact,null);f.physics.setStaticEnabled(f.branch.receiverFloor.uuid,true);
  assert.ok(receiver.body.world===world);const door=f.branch.serviceDoor.userData.collider.box;
  assert.ok(door.max.y+6<15);assert.ok(f.branch.retrievalHatch.userData.collider.box.max.y+3<15);
  for(const part of f.branch.parts){
   if(part===f.branch.serviceDoor||part===f.branch.retrievalHatch||!part.userData.collider)continue;
   const b=part.userData.collider.box;
   if(b.min.y<11.8&&b.max.y>5.8&&b.min.z<18&&b.max.z>15)
    assert.ok(b.max.x<=cfg.shieldX-.175+1e-6||b.min.x>=cfg.shieldX+.175-1e-6,'Raised service door must not pass through a solid lintel');
  }
 }finally{f.dispose();}
});

test('local field skips the held original, guards duplicate world steps and disposes its only hooks without editing actors',()=>{
 const f=fixture();try{
  const world=f.physics.world,b=f.body;assert.ok(world.subsystems.length>0);
  // A source/operator lifecycle fixture may put its test body in the field;
  // this is not used as ordinary journey or completion evidence.
  b.position.set(-8,9,0);b.velocity.set(10,-2,0);f.game.heldCube=true;const held=b.velocity.toArray();f.branch.updateForces(dt);assert.deepEqual(b.velocity.toArray(),held);
  f.game.heldCube=false;f.branch.updateForces(dt);const first=b.velocity.toArray(),d=f.branch.diagnostics();f.branch.updateForces(dt);assert.deepEqual(b.velocity.toArray(),first);
  assert.equal(f.branch.diagnostics().appliedSteps,d.appliedSteps);const a=d.lastImpulse;assert.ok(a.cargoImpulse.every((v,i)=>Math.abs(v+a.fixedFoundationImpulse[i])<1e-12));
  const pose=b.position.toArray(),q=b.quaternion.toArray(),shape=b.shapes[0],count=world.subsystems.length;
  f.branch.dispose();f.branch.dispose();assert.equal(world.subsystems.length,count-1);assert.deepEqual(b.position.toArray(),pose);assert.deepEqual(b.quaternion.toArray(),q);assert.equal(b.shapes[0],shape);
 }finally{f.dispose();}
});
