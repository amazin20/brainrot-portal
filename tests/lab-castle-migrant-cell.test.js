import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body} from 'cannon-es';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {SingularityKit} from '../src/game/LabSingularityKit.js';
import {buildCastleMigrantBranch,CASTLE_MIGRANT as cfg} from '../src/game/LabCastleMigrantBranch.js';
import {makePortalFrame,portalCrossing,orientedBoxFitsPortal,uprightCapsuleFitsPortal} from '../src/game/LabPortals.js';
const V=(...v)=>new THREE.Vector3(...v);
// Small local construction fixture: no LabGame, assets, renderer or campaign.
function fixture({fall=false}={}){
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[],
  playerPosition:V(-16,0,0),previousPlayerPosition:V(-16,0,0),playerGrounded:true,heldCube:false,
  markPortalSurface(mesh,center,normal,halfWidth,halfHeight){Object.assign(mesh.userData,{portalable:true,center:center.clone(),normal:normal.clone(),portalBounds:{halfWidth,halfHeight}});this.portalPanels.push(mesh);}};
 const physics=game.physics=new LabPhysics(),body=physics.createCargo({position:fall?[cfg.cargoX,cfg.dropY+.8,cfg.cargoZ]:[-16,.4,21]});
 game.cargo={position:V(...body.position.toArray()),quaternion:new THREE.Quaternion()};
 const k=new SingularityKit(game),def={id:'migrant',at:[0,0,0],w:34,d:46,h:15,entry:'w'},room={def,P:(x,z=0,y=0)=>[x,y,z]};
 const branch=buildCastleMigrantBranch({game,k,room,standing:()=>false,complete:()=>assert.fail('Fixture cannot solve a room'),plate:()=>{},sign:()=>{}});
 for(const c of game.colliders)physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:c.kinematic,enabled:c.enabled});branch.ensure();
 const step=()=>{branch.updateForces(1/120);physics.step(1/120);game.cargo.position.copy(body.position);game.cargo.quaternion.copy(body.quaternion);branch.update(1/120);};
 const dispose=()=>{branch.dispose();k.dispose();physics.dispose();};return{game,k,physics,body,branch,step,dispose};
}
function firstHit(f,from,to){
 const ray=new THREE.Raycaster(V(...from),V(...to).sub(V(...from)).normalize(),0,V(...from).distanceTo(V(...to))-.02);
 f.k.root.updateWorldMatrix(true,true);return ray.intersectObjects(f.game.aimBlockers,false)[0];
}

test('Empty parked carrier has actual 12 kg ownership, contact stops, no motor and no initial passenger sight line',()=>{
 const f=fixture();try{
  for(let i=0;i<240;i++)f.step();const d=f.branch.diagnostics();assert.equal(d.ready,true);assert.equal(d.carrierMass,12);
  assert.equal(f.branch.carrierBody.type,Body.DYNAMIC);assert.equal(d.guideEquationCount,5);assert.equal(d.guideFreeX,true);
  assert.ok(Math.abs(d.carrierPosition[0]-cfg.near)<.002);assert.ok(d.travel<.0002);assert.equal(d.firstRecoil,null);
  assert.ok(f.branch.movingParts.every((p,i)=>f.physics.bodyBoxes.get(p.mesh.uuid)?.body===f.branch.carrierBody
   &&f.physics.bodyBoxes.get(p.mesh.uuid)?.shape===f.branch.carrierBody.shapes[i]));
  assert.ok(firstHit(f,[-14,1.8,18.75],[cfg.near,5,0]),'The parked passenger address must be physically hidden');
  assert.ok(!firstHit(f,[-14,1.8,18.75],[cfg.far,5,0]),'The far passenger address must align through both physical windows');
  assert.ok(!firstHit(f,[-14,1.4,18.75],[cfg.far,5,0]),'The ordinary shoulder-height projectile must also clear the sight channel');
  assert.ok(!firstHit(f,[-15.8,1.4,-7],[cfg.near,4,-7]),'The ordinary shoulder-height projectile must clear the separate freight channel');
  assert.ok(!firstHit(f,[-15.69815,6.81950,-5.20210],[cfg.near,4,-7]),'The measured production camera ray must pass its separate charge-only viewing ports');
  assert.ok(!firstHit(f,[-14.80079,.97203,-7.58420],[cfg.near,4,-7]),'The measured production muzzle ray must pass the low cargo channel');
  for(const y of [1.4,3,7,13.25,14.35])for(const z of [-22,-7,0,12,18.75,22])
   assert.ok(firstHit(f,[-15.6,y,z],[cfg.near,5,0]),`Parked passenger address exposed at ${y},${z}`);
  assert.ok(d.lastBrake.power<=0);assert.equal(f.branch.prepareCargoPortalVelocityTransfer({entrySurfaceId:'other',exitSurfaceId:'other'}),null);
  const drop=makePortalFrame(f.branch.cargoIntake.center,V(0,1,0),V(0,0,-1),f.branch.cargoIntake.mesh.userData.portalSize),
   mouth=f.branch.freightMouth.frame(),freight=makePortalFrame(mouth.center,mouth.normal,mouth.up,f.branch.freightMouth.mesh.userData.portalSize);
  assert.equal(uprightCapsuleFitsPortal(drop,2.4,.43),true,'A floor mouth retains the ordinary footprint contract');
  assert.equal(uprightCapsuleFitsPortal(freight,2.4,.43),false,'The real low freight outlet rejects an upright traveller');
 }finally{f.dispose();}
});

test('An actual gravity crossing commits the original-body recoil and contacts drive the carrier to its real far stop',t=>{
 const f=fixture({fall:true});try{
  const bodyId=f.body.id,shape=f.body.shapes[0],entry=makePortalFrame(f.branch.cargoIntake.center,V(0,1,0),V(0,0,-1),{width:.65,height:.7});
  const backing=f.game.colliders.filter(c=>c.mesh.uuid===f.branch.cargoIntake.mesh.uuid||f.branch.cargoIntake.mesh.userData.portalBackingIds.includes(c.mesh.uuid));
  let crossing=null,maxX=cfg.near,stopContacts=0;
  f.branch.carrierBody.addEventListener('collide',e=>{if(e.body===f.branch.fixedBody)stopContacts++;});
  for(let i=0;i<1440;i++){
   const before=V().copy(f.body.position),beforeQ=new THREE.Quaternion().copy(f.body.quaternion),near=before.y<1
    &&orientedBoxFitsPortal(entry,before,beforeQ,.39);
   for(const c of backing)f.physics.setStaticEnabled(c.mesh.uuid,!near||Boolean(crossing));f.step();
   if(!crossing){const frame=f.branch.freightMouth.frame(),exit=makePortalFrame(frame.center,frame.normal,frame.up,{width:.8,height:.6});
    const travel=portalCrossing(entry,exit,V().copy(f.body.position),before,V().copy(f.body.velocity),.39,
     {boxQuaternion:new THREE.Quaternion().copy(f.body.quaternion),previousBoxQuaternion:beforeQ,boxHalfSize:.39});
    if(travel){const context={body:f.body,travel,entryFrame:entry,exitFrame:exit,entrySurfaceId:f.branch.cargoIntake.mesh.uuid,exitSurfaceId:f.branch.freightMouth.mesh.uuid},
      snapshots=[f.body.position.toArray(),f.body.velocity.toArray(),f.branch.carrierBody.position.toArray(),f.branch.carrierBody.velocity.toArray()],plan=f.branch.prepareCargoPortalVelocityTransfer(context);
     assert.ok(plan);assert.deepEqual([f.body.position.toArray(),f.body.velocity.toArray(),f.branch.carrierBody.position.toArray(),f.branch.carrierBody.velocity.toArray()],snapshots,'Prepare must be pure');
     const clear=.46-travel.position.clone().sub(exit.position).dot(exit.normal);if(clear>0)travel.position.addScaledVector(exit.normal,clear);
     f.physics.teleportCargo({position:travel.position,rotation:travel.rotation,velocityTransfer:plan});crossing=plan.ledger;
    }
   }
   maxX=Math.max(maxX,f.branch.carrierBody.position.x);
  }
  const d=f.branch.diagnostics();assert.ok(crossing,'Gravity must produce a real swept aperture crossing');assert.equal(f.body.id,bodyId);assert.equal(f.body.shapes[0],shape);
  assert.ok(crossing.incomingVelocity[1]<-18);assert.ok(Math.abs(crossing.kineticAfter-crossing.kineticBefore)<1e-7);
  assert.ok(crossing.momentumResidual.every(v=>Math.abs(v)<1e-7));assert.ok(d.firstRecoil?.committed);
  const normalTorque=V(...crossing.carrierImpulseRelativePoint).cross(V(...crossing.carrierImpulse));
  assert.ok(normalTorque.add(V(...crossing.guideAngularSupportImpulse)).length()<1e-7,'The rotation-locked guide must balance the actual off-centre impulse');
  assert.equal(crossing.guideAngularSupportWork,0);assert.ok(f.branch.carrierBody.angularVelocity.length()<1e-8);
  assert.ok(stopContacts>0,'Far end is a live contact, not a clamp');assert.ok(maxX<=cfg.far+.025,`End stop penetration ${maxX-cfg.far}`);
  assert.ok(d.travel>.98);assert.ok(Math.abs(d.carrierVelocity[0])<.2);assert.ok(d.brakeWork<=0);
  assert.ok(f.body.position.x< -11.2&&Math.abs(f.body.position.z+7)<1.4&&f.body.position.y>.2&&f.body.position.y<1.5,'Same cargo must remain in the accessible dry catcher');
  t.diagnostic(JSON.stringify({crossing,carrierPosition:d.carrierPosition,carrierVelocity:d.carrierVelocity,brakeWork:d.brakeWork,
   stopContacts,maxStopPenetration:maxX-cfg.far,cargoPosition:f.body.position.toArray(),scope:'Local canonical crossing fixture; ordinary campaign input journey not yet run'}));
 }finally{f.dispose();}
});
