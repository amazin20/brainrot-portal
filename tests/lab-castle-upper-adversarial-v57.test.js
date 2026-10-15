import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body,Box,Vec3} from 'cannon-es';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {SingularityKit} from '../src/game/LabSingularityKit.js';
import {buildTower41UpperLift} from '../src/game/LabTower41UpperLift.js';

// Independent mechanical fault fixtures supplement the normal castle route.
// Their direct hand input / foreign mass are not ordinary-play bypass proofs.
const DT=1/120;
function fixture(){
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[],cargo:new THREE.Object3D(),heldCube:null,
  playerPosition:new THREE.Vector3(-30,0,0),playerVelocity:new THREE.Vector3(),playerGrounded:true};
 const kit=new SingularityKit(game);kit.floor(-32,32,-32,32,-25);
 const cell=buildTower41UpperLift(game,kit,{centre:[0,0,0]});
 game.physics=new LabPhysics();for(const c of game.colliders)game.physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:c.kinematic});
 game.physics.createCargo({position:[24,2,14]});cell.ensure();
 const world=game.physics.world;
 const step=(seconds=DT)=>{for(let i=0;i<Math.ceil(seconds/DT);i++)game.physics.step(DT);};
 const until=(predicate,seconds,message)=>{for(let i=0;i<Math.ceil(seconds/DT);i++){if(predicate())return;step();}assert.ok(predicate(),message+' '+JSON.stringify(cell.diagnostics()));};
 function retain(){
  until(()=>cell.height>6.4&&cell.diagnostics().direction===1,24,'Real hydraulic car did not reach its upper hand-input window');
  assert.equal(cell.armCatch(),true);
  until(()=>cell.retained,5,'Actual dynamic deck did not settle on the swung physical shelf');
  assert.ok(cell.diagnostics().catchForce>0);assert.ok(cell.diagnostics().catchContacts>0);
 }
 return{game,kit,cell,world,step,until,retain,dispose(){cell.dispose();kit.dispose();game.physics.dispose();}};
}
const record=(name,value)=>console.log('CASTLE_UPPER_V57_ADVERSARIAL '+JSON.stringify({name,kind:'declared-mechanical-fault-fixture',publicationAccepted:false,ordinaryPlayerBypassClaimed:false,...value}));

test('41 upper fresh fault attacks: foreign joint endpoints, replaced support and registry removal cannot reuse a valid catch witness',()=>{
 const f=fixture(),{cell:c,world}=f;
 try{
  f.retain();const positive=c.diagnostics();assert.equal(c.retained,true);
  const foreign=new Body({mass:1,position:new Vec3(30,0,30)});foreign.addShape(new Box(new Vec3(.7,.11,.28)));world.addBody(foreign);
  const results=[];
  function attack(name,change,restore){
   assert.equal(c.retained,true,'Each fault starts with the authentic positive physical control');
   const step=world.stepnumber;change();
   try{assert.equal(c.latched,false,name+' retained a stale contact proof');assert.equal(c.retained,false,name+' retained a stale readiness proof');assert.equal(world.stepnumber,step);results.push(name);}
   finally{restore();}
   assert.equal(c.retained,true,'Restoring the exact unchanged physical component should restore the current valid witness');
  }
  const guide=c.constraints.find(j=>j.bodyB===c.liftBody),oldGuideB=guide.bodyB;
  attack('guide rewired to a foreign rigid body',()=>{guide.bodyB=foreign;},()=>{guide.bodyB=oldGuideB;});
  const hinge=c.constraints.find(j=>j.bodyB===c.pawlBody),oldHingeA=hinge.bodyA;
  attack('shelf hinge rewired away from its founded anchor',()=>{hinge.bodyA=foreign;},()=>{hinge.bodyA=oldHingeA;});
  const equation=hinge.equations[0],oldEquationB=equation.bj;
  attack('hinge equation points to a foreign body',()=>{equation.bj=foreign;},()=>{equation.bj=oldEquationB;});
  const registry=f.game.physics.bodyBoxes.get(c.deckPart.mesh.uuid);
  attack('owned deck registry removed',()=>{f.game.physics.bodyBoxes.delete(c.deckPart.mesh.uuid);},()=>{f.game.physics.bodyBoxes.set(c.deckPart.mesh.uuid,registry);});
  const oldShape=c.pawlBody.shapes[0],replacement=new Box(oldShape.halfExtents.clone());
  attack('support replaced by an equal-sized foreign shape',()=>{c.pawlBody.shapes[0]=replacement;},()=>{c.pawlBody.shapes[0]=oldShape;});
  const oldResponse=oldShape.collisionResponse;
  attack('actual supporting shelf collision disabled',()=>{oldShape.collisionResponse=false;},()=>{oldShape.collisionResponse=oldResponse;});
  const oldMask=c.pawlBody.collisionFilterMask;
  attack('shelf removed from the lift collision pair',()=>{c.pawlBody.collisionFilterMask=0;},()=>{c.pawlBody.collisionFilterMask=oldMask;});
  const bodyIndex=world.bodies.indexOf(c.pawlBody);world.removeBody(c.pawlBody);
  try{assert.equal(c.retained,false);results.push('actual shelf body removed from world');}finally{world.addBody(c.pawlBody);}
  assert.ok(bodyIndex>=0);assert.equal(c.retained,true);
  world.removeBody(foreign);
  record('invalid-component-cuts',{worldStep:world.stepnumber,positiveCatchForce:positive.catchForce,actualCutsRejected:results.length,attacks:results});
 }finally{f.dispose();}
});

test('41 upper fresh wrong-arrival fixture: foreign load cannot fabricate a player ride or a successful loaded release',()=>{
 const f=fixture(),{cell:c,world}=f;
 try{
  f.retain();assert.equal(c.rideComplete,false);const before=c.diagnostics(),original=f.game.physics.cargoBody;
  const fake=new Body({mass:original.mass,position:new Vec3(7,6.45,0),shape:new Box(new Vec3(.39,.39,.39)),allowSleep:false,
   collisionFilterGroup:original.collisionFilterGroup,collisionFilterMask:original.collisionFilterMask});
  world.addBody(fake);let positiveForeignSteps=0,maxCatchForce=before.catchForce;
  const inspect=()=>{
   const contacts=world.contacts.filter(e=>e.enabled!==false&&e.multiplier>1e-6&&[e.bi,e.bj].includes(fake)&&[e.bi,e.bj].includes(c.liftBody));
   if(contacts.length)positiveForeignSteps++;maxCatchForce=Math.max(maxCatchForce,c.diagnostics().catchForce);
  };
  world.addEventListener('postStep',inspect);
  try{f.step(3);}finally{world.removeEventListener('postStep',inspect);world.removeBody(fake);}
  assert.ok(positiveForeignSteps>120,'The impostor must physically load the actual upper deck');
  assert.ok(maxCatchForce>before.catchForce+20,'Its real load must exercise the physical catch, not only an overlap check');
  assert.equal(c.rideComplete,false);assert.equal(f.game.physics.cargoBody,original);
  // Declared supply disconnection removes real hydraulic force. The existing
  // unchanged shelf carries gravity. This is a catch-only mechanism:
  // repeated input under positive shelf contact is explicitly refused.
  c.powered=false;f.step(2);const dark=c.diagnostics();
  assert.equal(dark.lastForce,0);assert.equal(c.retained,true);assert.ok(dark.catchForce>60);assert.ok(Math.abs(c.height-6)<.1);
  const handsBefore=dark.handCount;
  assert.equal(c.armCatch(),false,'A jammed gravity-loaded shelf must not acknowledge a successful release');
  assert.equal(c.diagnostics().handCount,handsBefore);assert.equal(c.retained,true);
  c.powered=true;f.until(()=>c.latched&&c.diagnostics().catchForce<20,3,'Restored pressure did not unload the real shelf reaction');
  const restoredLoad=c.diagnostics().catchForce,handsRestored=c.diagnostics().handCount;
  assert.ok(restoredLoad>0);assert.equal(c.armCatch(),false,'The catch-only control must not promise a release under even reduced positive load');
  assert.equal(c.diagnostics().handCount,handsRestored);f.step(1);
  assert.equal(c.latched,true);assert.equal(c.retained,true);assert.equal(c.rideComplete,false);
  assert.ok(c.bodies.every(b=>[...b.position.toArray(),...b.velocity.toArray()].every(Number.isFinite)));
  record('foreign-arrival-power-cut-release',{originalBodyId:original.id,foreignBodyId:fake.id,positiveForeignSteps,maxCatchForce,
   darkCatchForce:dark.catchForce,darkHydraulicForce:dark.lastForce,darkReleaseRejected:true,restoredCatchForce:restoredLoad,restoredReleaseRejected:true,retainedHeight:c.height,playerRideAccepted:c.rideComplete});
 }finally{f.dispose();}
});

test('41 upper fresh early-hand fixture: an underside-blocked ascent can recover through a later finite hand input without reset',()=>{
 const f=fixture(),{cell:c,world}=f;
 try{
  f.until(()=>c.height<3,12,'The actual hydraulic car did not leave the upper catch before the early input');
  assert.equal(c.armCatch(),true);f.step(1);
  const underside=()=>world.contacts.filter(e=>e.enabled!==false&&e.multiplier>1e-6&&[e.bi,e.bj].includes(c.liftBody)&&[e.bi,e.bj].includes(c.pawlBody)
   &&(e.bi===c.liftBody?-1:1)*e.ni.y<-.65);
  f.until(()=>c.diagnostics().direction===1&&c.height>5&&c.height<5.6&&Math.abs(c.liftBody.velocity.y)<.08&&underside().length>0,20,
   'Early closed shelf did not establish an actual wrong-side physical stopping contact');
  const blocked={step:world.stepnumber,height:c.height,angle:c.pawlAngle,force:underside().reduce((n,e)=>n+e.multiplier,0)};
  assert.equal(c.latched,false);assert.equal(c.retained,false);assert.equal(c.rideComplete,false);
  assert.equal(c.armCatch(),true,'A wrong-side contact must allow a real corrective hand input');
  f.until(()=>c.height>6.4&&c.diagnostics().direction===1,12,'Corrective hand input did not recover the real full hydraulic stroke without reset');
  assert.equal(c.retained,false);assert.equal(c.rideComplete,false);
  record('early-close-wrong-side-recovery',{blocked,afterHand:{step:world.stepnumber,height:c.height,angle:c.pawlAngle},resetUsed:false,physicalHandInputs:c.diagnostics().handCount});
 }finally{f.dispose();}
});
