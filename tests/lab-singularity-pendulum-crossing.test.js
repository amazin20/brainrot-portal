import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Box} from 'cannon-es';
import {LabGame} from '../src/game/LabGame.js';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {SingularityKit} from '../src/game/LabSingularityKit.js';
import {capsuleBoxGrounded,orientedBoxSupport} from '../src/game/LabOrientedBoxContact.js';
import {buildTower41PendulumCell} from '../src/game/LabTower41PendulumCell.js';
import {observeTower41PendulumCrossing} from '../src/game/LabSingularityLevel.js';

const DT=1/120,V=(...p)=>new THREE.Vector3(...p);
const record=()=>({phase:0,complete:false,lastStep:-1,nearLandingStep:null,nearLanding:null,firstStep:null,midStep:null,farStep:null,islandStep:null,deckSteps:0,previousFoot:null,checkpoints:[]});

// UNIT FIXTURE ONLY: actor poses below deliberately isolate the crossing
// observer. This is not an ordinary-input route or a human traversal proof.
// The original cargo starts above the actual cup, lowers the real bridge by
// gravity, and leaves through the production carry servo. No load/retention
// flag, body velocity, bridge pose, world clock or crossing credit is assigned.
function fixture(){
 const game={scene:new THREE.Scene(),colliders:[],floors:[],ramps:[],cameraBlockers:[],aimBlockers:[],portalPanels:[],cargo:new THREE.Object3D(),heldCube:null,playerPosition:V(),playerVelocity:V(),playerGrounded:false};
 game.floorHeight=LabGame.prototype.floorHeight;game.sampleFootSupport=LabGame.prototype.sampleFootSupport;
 const kit=new SingularityKit(game);kit.floor(-32,32,-32,32,-25);
 const cell=buildTower41PendulumCell(game,kit,{centre:[0,0,0]});game.physics=new LabPhysics();
 for(const c of game.colliders)game.physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:c.kinematic});
 const initial=cell.initialLoadCargoPosition.clone().add(V(0,.16,0));game.physics.createCargo({position:initial.toArray()});cell.ensure();
 const cargo=game.physics.cargoBody,world=game.physics.world;
 const step=(count=1)=>{for(let i=0;i<count;i++){const before=world.stepnumber;cell.updateForces(DT);game.physics.step(DT);assert.equal(world.stepnumber,before+1);}};
 const until=(predicate,seconds,label)=>{for(let i=0;i<seconds/DT&&!predicate();i++)step();assert.ok(predicate(),label+' '+JSON.stringify(cell.diagnostics()));};
 until(()=>cell.loadContact&&cell.angle<-.1,12,'The actual original cargo did not lower the hinged bridge');
 assert.equal(cell.armCatch(),true);step(168);game.heldCube=game.cargo;game.physics.setCarryTarget([-6,3,-4]);
 until(()=>cell.unloadedRetained,8,'The actual catch did not retain the physically cleared original load');game.heldCube=null;game.physics.release();step(240);
 assert.equal(cell.readyForCrossing,true);assert.ok(cell.loadedStep>0);assert.ok(cell.diagnostics().loadedNormalImpulse>0);
 const nearMesh=kit.floor(-18.7,-15,-5,-2.6,0),islandMesh=kit.floor(-1.5,3,-4,4,0);
 for(const mesh of[nearMesh,islandMesh])game.physics.addStaticBox(mesh.uuid,mesh.userData.collider.box);
 const islandFloor=islandMesh.userData.floor,box=()=>cell.deckPart.collider.orientedBox;
 const deckPoint=(x,z=-.6)=>V(x,box().half.y,z).applyQuaternion(box().current.quaternion).add(box().current.center);
 function pose(point,{velocity=null}={}){
  game.playerPosition.copy(point);
  const currentBox=box(),deck=currentBox?orientedBoxSupport(currentBox,point.x,point.z,point.y+.02):null,sample=game.sampleFootSupport(point.x,point.z,point.y+.03);
  if(velocity)game.playerVelocity.copy(V(...velocity));
  else if(deck&&Math.abs(deck.height-point.y)<.003)game.playerVelocity.copy(V().copy(cell.bridgeBody.angularVelocity).cross(point.clone().sub(V().copy(cell.bridgeBody.position))).add(V().copy(cell.bridgeBody.velocity)));
  else game.playerVelocity.set(0,0,0);
  game.playerGrounded=Boolean(sample&&Math.abs(sample.height-point.y)<.003&&(!deck||Math.abs(deck.height-point.y)>=.003||capsuleBoxGrounded(point,game.playerVelocity,.43,2.4,box())));
 }
 function observe(r,point,{advance=true,velocity=null}={}){
  if(advance)step();pose(typeof point==='function'?point():point,{velocity});
  return observeTower41PendulumCrossing(game,cell,r,islandFloor,[0,0,0]);
 }
 function start(r=record()){
  assert.equal(observe(r,V(-16,0,-3.5)),false);assert.equal(game.playerGrounded,true);
  assert.equal(observe(r,()=>deckPoint(-5.3)),false);assert.equal(game.playerGrounded,true);assert.equal(r.phase,1);return r;
 }
 function toFar(r=start()){
  for(let x=-5.22;x<=3.26;x+=.08){observe(r,()=>deckPoint(x));assert.equal(game.playerGrounded,true,'The unit capsule must rest on the current actual deck pose');}
  assert.equal(r.phase,3);assert.ok(r.deckSteps>=24);return r;
 }
 function toIsland(r){
  let x=game.playerPosition.x;
  while(x<-.62){x=Math.min(-.62,x+.08);observe(r,()=>{const support=game.sampleFootSupport(x,-.6,.6);return V(x,support&&support.height>=-.3?support.height:Math.max(0,game.playerPosition.y-.04),-.6);});}
  return r;
 }
 return{game,kit,cell,cargo,world,step,box,deckPoint,pose,observe,start,toFar,toIsland,islandFloor,dispose(){cell.dispose();kit.dispose();game.physics.dispose();}};
}

test('Tower41 crossing unit accepts actual near→mid→far owned deck samples on distinct real steps followed by the founded island',()=>{
 const f=fixture();try{
  const r=f.toIsland(f.toFar());assert.equal(r.complete,true,JSON.stringify({record:r,foot:f.game.playerPosition.toArray(),cellReady:f.cell.readyForCrossing}));assert.equal(f.game.playerGrounded,true);
  assert.ok(r.nearLandingStep<r.firstStep&&r.firstStep<r.midStep&&r.midStep<r.farStep&&r.farStep<r.islandStep);assert.ok(r.deckSteps>=24);
  assert.deepEqual(r.checkpoints.map(c=>c.name),['near','mid','far','island']);
  for(const c of r.checkpoints.slice(0,3)){assert.equal(c.bodyId,f.cell.bridgeBody.id);assert.equal(c.shapeId,f.cell.bridgeBody.shapes[f.cell.deckShapeIndex].id);assert.equal(c.pose.step,c.worldStep);assert.equal(c.capsuleGrounded,true);assert.equal(c.footprintInside,true);assert.ok(Math.abs(c.supportGap)<.003);}
  const island=r.checkpoints.at(-1),body=f.game.physics.solids.get(f.islandFloor.mesh.uuid).body;assert.equal(island.bodyId,body.id);assert.equal(body.world,f.world);assert.equal(island.footprintInside,true);
  console.info('41 physical pendulum crossing UNIT ONLY',JSON.stringify({ordinaryJourney:false,manualUnitActorSamples:true,readyCell:f.cell.readyForCrossing,supportedDeckSteps:r.deckSteps,nearLanding:r.nearLanding,checkpoints:r.checkpoints}));
 }finally{f.dispose();}
});

test('Tower41 crossing unit rejects direct island coordinates, mid-span-first support and a long actor displacement',()=>{
 const f=fixture();try{
  const direct=record();assert.equal(f.observe(direct,V(-.62,0,-.6)),false);assert.equal(f.game.playerGrounded,true);assert.equal(direct.phase,0);
  const mid=record();f.observe(mid,V(-16,0,-3.5));f.observe(mid,()=>f.deckPoint(0));assert.equal(f.game.playerGrounded,true);assert.equal(mid.phase,0);
  const jumped=f.start();f.observe(jumped,()=>f.deckPoint(3.5));assert.equal(f.game.playerGrounded,true);assert.equal(jumped.phase,0);assert.equal(jumped.deckSteps,0);assert.equal(jumped.complete,false);
 }finally{f.dispose();}
});

test('Tower41 crossing unit cannot accumulate repeated same-step poses or survive a missing actual physics interval',()=>{
 const f=fixture();try{
  const same=f.start(),saved=JSON.stringify(same),step=f.world.stepnumber;
  for(const x of[-4,-.5,3.5])assert.equal(f.observe(same,()=>f.deckPoint(x),{advance:false}),false);
  assert.equal(f.world.stepnumber,step);assert.equal(JSON.stringify(same),saved);
  const gap=f.start();f.step(2);f.observe(gap,()=>f.deckPoint(-5.22),{advance:false});assert.equal(gap.phase,0);assert.equal(gap.complete,false);assert.equal(gap.deckSteps,0);
 }finally{f.dispose();}
});

test('Tower41 crossing unit rejects an actual airborne capsule and a finite foot point outside the full deck footprint',()=>{
 const f=fixture();try{
  const airborne=f.start();f.observe(airborne,()=>f.deckPoint(-5.22).add(V(0,.4,0)),{velocity:[0,3,0]});assert.equal(f.game.playerGrounded,false);assert.equal(airborne.phase,0);assert.equal(airborne.deckSteps,0);
  const edge=f.start();f.observe(edge,()=>f.deckPoint(-5.22,1.8));assert.ok(f.game.sampleFootSupport(f.game.playerPosition.x,f.game.playerPosition.z,f.game.playerPosition.y+.03));assert.equal(edge.phase,0);assert.equal(edge.complete,false,'A finite surface point alone cannot prove full capsule footprint support');
 }finally{f.dispose();}
});

test('Tower41 crossing unit rejects missing registration while the real caught deck and finite support remain',()=>{
 const f=fixture();try{
  const r=f.start(),part=f.cell.deckPart,entry=f.game.physics.bodyBoxes.get(part.mesh.uuid);f.game.physics.removeBodyBox(part.mesh.uuid);
  try{f.observe(r,()=>f.deckPoint(-5.22));assert.equal(f.game.playerGrounded,true);assert.equal(r.phase,0);assert.equal(r.complete,false);}finally{f.game.physics.bodyBoxes.set(part.mesh.uuid,entry);}
 }finally{f.dispose();}
});

test('Tower41 crossing unit rejects a stale owned pose and a registry shape that differs from the live Cannon shape',()=>{
 const f=fixture();try{
  const stale=f.start();f.step();f.pose(f.deckPoint(-5.22));const box=f.box(),step=box.step;box.step=step-1;
  try{assert.equal(observeTower41PendulumCrossing(f.game,f.cell,stale,f.islandFloor,[0,0,0]),false);assert.equal(stale.phase,0);}finally{box.step=step;}
  const mismatch=f.start(),entry=f.game.physics.bodyBoxes.get(f.cell.deckPart.mesh.uuid),original=entry.shape;entry.shape=new Box(original.halfExtents.clone());
  try{f.observe(mismatch,()=>f.deckPoint(-5.22));assert.equal(f.game.playerGrounded,true);assert.equal(mismatch.phase,0);assert.equal(mismatch.complete,false);}finally{entry.shape=original;}
 }finally{f.dispose();}
});

test('Tower41 crossing unit rejects removed actual bridge ownership and a missing actual deck shape',()=>{
 const f=fixture();try{
  const removed=f.start(),body=f.cell.bridgeBody;f.step();f.pose(f.deckPoint(-5.22));f.world.removeBody(body);
  try{assert.equal(observeTower41PendulumCrossing(f.game,f.cell,removed,f.islandFloor,[0,0,0]),false);assert.equal(removed.phase,0);}finally{f.world.addBody(body);}
  f.step(60);const missing=f.start(),shape=body.shapes[f.cell.deckShapeIndex],offset=body.shapeOffsets[f.cell.deckShapeIndex],orientation=body.shapeOrientations[f.cell.deckShapeIndex];f.step();f.pose(f.deckPoint(-5.22));body.removeShape(shape);
  try{assert.equal(observeTower41PendulumCrossing(f.game,f.cell,missing,f.islandFloor,[0,0,0]),false);assert.equal(missing.phase,0);assert.equal(missing.complete,false);}finally{body.addShape(shape,offset,orientation);}
 }finally{f.dispose();}
});

test('Tower41 crossing unit rejects island coordinates after a complete deck path when the actual founded island body is removed',()=>{
 const f=fixture();try{
  const r=f.toFar(),solid=f.game.physics.solids.get(f.islandFloor.mesh.uuid);f.world.removeBody(solid.body);f.toIsland(r);
  assert.equal(f.game.playerGrounded,true,'The unchanged visible floor still supplies the ordinary actor sampler, isolating missing Cannon ownership');assert.equal(r.complete,false);assert.equal(r.islandStep,null);
  assert.equal(f.world.bodies.includes(solid.body),false);assert.equal(r.checkpoints.some(c=>c.name==='island'),false);
 }finally{f.dispose();}
});

test('Tower41 crossing unit rejects missing live deck geometry and an original-companion identity substitution',()=>{
 const f=fixture();try{
  const missing=f.start(),part=f.cell.deckPart,box=part.collider.orientedBox;f.step();const nextFoot=f.deckPoint(-5.22);delete part.collider.orientedBox;
  try{f.observe(missing,nextFoot,{advance:false});assert.equal(missing.phase,0);assert.equal(missing.complete,false);}finally{part.collider.orientedBox=box;}
  const identity=f.start(),original=f.game.cargo;f.game.cargo=new THREE.Object3D();
  try{f.observe(identity,()=>f.deckPoint(-5.22));assert.equal(identity.phase,0);assert.equal(identity.complete,false);}finally{f.game.cargo=original;}
 }finally{f.dispose();}
});
