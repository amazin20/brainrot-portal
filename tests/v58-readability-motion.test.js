import test from 'node:test';
import assert from 'node:assert/strict';
import {assertVisibleMotion} from '../scripts/lib/v58-readability-proof.mjs';

// Synthetic overlap controls only: complete-route displacement and native
// canvas/hash bindings belong to the enclosing assertCausalReadability gate.
const CASES=[['room25','dark-return'],['room25','relight-ascent'],['castle','upper-ride']];
const clone=value=>structuredClone(value);
function role(name){
 const samples=[[100.5,100.5],[108.5,100.5],[100.5,108.5]].map((pixel,i)=>{
  const target={meshUUID:name+'-actual',instanceId:null,distance:3,worldPoint:[i,1,-3],cameraDepth:3};
  return {pixel,target,firstHit:clone(target),firstHitIsTarget:true,uncertain:false,reasons:[]};
 });
 return {role:name,targetMeshUUIDs:[name+'-actual'],bboxPixels:{minX:90,minY:90,maxX:130,maxY:130,width:40,height:40},
  projectedFootprintPixelsEstimate:1200,projectedSamples:3,firstHitTargetSamples:3,visibleFraction:1,samples,uncertain:{frameUnsupported:false,samples:0,reasons:[]}};
}
function fixture(caseId,id){
 const names=caseId==='room25'?['moving-mirror','current-drive']:['upper-deck','fixed-reference'];
 const phase={id,keyframes:[{index:0},{index:12},{index:23}]};
 const rows=Array.from({length:24},(_,index)=>{
  const worldStep=1000+index*10;
  return {clipId:id,index,worldStep,physics:{worldStep,currentLight:id!=='dark-return',grounded:true,
   mechanism:{worldStep,contactStep:worldStep,velocity:0,motorEnabled:true,lastForce:{motorForce:id==='dark-return'?0:100},
    currentCollisionValid:true,deckShapeId:80,rideTicks:24,rideLow:{worldStep:900,bodyId:70,shapeId:80,grounded:true},lift:{id:70,velocity:[0,0,0]}}},
   visibility:[0,12,23].includes(index)?{roles:names.map(role)}:null};
 });
 const moving=rows[12];if(caseId==='room25')moving.physics.mechanism.velocity=id==='dark-return'?-.4:.4;else moving.physics.mechanism.lift.velocity[1]=.4;
 return {caseId,phase,rows,names,moving};
}
const validate=f=>assertVisibleMotion(f.phase,f.rows,f.caseId);
const velocity=f=>f.caseId==='room25'?f.moving.physics.mechanism.velocity:f.moving.physics.mechanism.lift.velocity[1];
function setVelocity(f,value,row=f.moving){if(f.caseId==='room25')row.physics.mechanism.velocity=value;else row.physics.mechanism.lift.velocity[1]=value;}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

test('one measured selected keyframe with jointly visible actual roles and directed motion qualifies',()=>{
 for(const [caseId,id]of CASES){const f=fixture(caseId,id);freeze(f);assert.equal(validate(f),true);}
});

test('visible stopped keyframes cannot borrow motion from unmeasured intermediate frames',()=>{
 for(const [caseId,id]of CASES){const f=fixture(caseId,id),speed=velocity(f);setVelocity(f,0);setVelocity(f,speed,f.rows[6]);assert.equal(f.rows[6].visibility,null);assert.throws(()=>validate(f),/jointly visible keyframe/);}
});

test('a moving selected row without a retained visibility measurement cannot qualify',()=>{
 for(const [caseId,id]of CASES){const f=fixture(caseId,id);f.moving.visibility=null;assert.throws(()=>validate(f));}
});

test('motion outside the declared selected keyframes cannot qualify even with an extra visibility result',()=>{
 for(const [caseId,id]of CASES){const f=fixture(caseId,id),speed=velocity(f);setVelocity(f,0);setVelocity(f,speed,f.rows[6]);f.rows[6].visibility={roles:f.names.map(role)};assert.throws(()=>validate(f));}
});

test('each role visible on two different keys still needs both roles visible together during motion',()=>{
 for(const [caseId,id]of CASES){const f=fixture(caseId,id),speed=velocity(f);
  // The stopped key0 sees both roles; moving keys12/23 each see only one.
  f.rows[12].visibility.roles=[role(f.names[0])];f.rows[23].visibility.roles=[role(f.names[1])];setVelocity(f,speed,f.rows[23]);
  for(const name of f.names)assert.equal([0,12,23].filter(i=>f.rows[i].visibility.roles.some(r=>r.role===name)).length,2);
  assert.throws(()=>validate(f));
 }
});

test('wrong-direction moving geometry cannot satisfy the declared causal phase',()=>{
 for(const [caseId,id]of CASES){const f=fixture(caseId,id);setVelocity(f,-velocity(f));assert.throws(()=>validate(f));}
});

test('the exact velocity boundary is insufficient in either physical direction',()=>{
 for(const [caseId,id]of CASES){const f=fixture(caseId,id);setVelocity(f,id==='dark-return'?-.2:.2);assert.throws(()=>validate(f));}
});

test('an opaque actor or uncertain glass on either required moving role blocks the overlap claim',()=>{
 for(const [caseId,id]of CASES)for(const name of fixture(caseId,id).names)for(const mode of ['actor','glass']){
  const f=fixture(caseId,id),r=f.moving.visibility.roles.find(r=>r.role===name);
  if(mode==='actor'){for(const sample of r.samples){sample.firstHit.meshUUID='original-opaque-player';sample.firstHitIsTarget=false;}r.firstHitTargetSamples=0;r.visibleFraction=0;}
  else{r.samples[0].uncertain=true;r.samples[0].reasons=['transparent-material'];}
  assert.throws(()=>validate(f));
 }
});

test('an identically indexed moving row from another clip cannot satisfy this phase',()=>{
 for(const [caseId,id]of CASES){const f=fixture(caseId,id);f.moving.clipId='other-clip';assert.throws(()=>validate(f));}
});

test('dark motion requires lost current light and exactly zero physical motor force',()=>{
 for(const mutate of [p=>{p.currentLight=true;},p=>{p.mechanism.lastForce.motorForce=1;},p=>{p.mechanism.lastForce.motorForce=-1;}]){
  const f=fixture('room25','dark-return');mutate(f.moving.physics);assert.throws(()=>validate(f));
 }
});

test('relight motion requires current light, enabled motor and positive actual motor force',()=>{
 for(const mutate of [p=>{p.currentLight=false;},p=>{p.mechanism.motorEnabled=false;},p=>{p.mechanism.lastForce.motorForce=0;},p=>{p.mechanism.lastForce.motorForce=-1;}]){
  const f=fixture('room25','relight-ascent');mutate(f.moving.physics);assert.throws(()=>validate(f));
 }
});

test('Room25 light and motor booleans must be actual booleans rather than truthiness',()=>{
 for(const value of [undefined,0,null]){const f=fixture('room25','dark-return');f.moving.physics.currentLight=value;assert.throws(()=>validate(f));}
 for(const field of ['currentLight','motorEnabled'])for(const value of ['true',1]){
  const f=fixture('room25','relight-ascent');if(field==='currentLight')f.moving.physics[field]=value;else f.moving.physics.mechanism[field]=value;assert.throws(()=>validate(f));
 }
});

test('Castle motion needs current collision and mechanism clocks, grounded passenger and real ride progress',()=>{
 const mutations={
  ungrounded:p=>{p.grounded=false;},invalidCollision:p=>{p.mechanism.currentCollisionValid=false;},
  previousContact:p=>{p.mechanism.contactStep--;},futureContact:p=>{p.mechanism.contactStep++;},previousMechanism:p=>{p.mechanism.worldStep--;},
  absentRide:p=>{p.mechanism.rideLow=null;},zeroRideTicks:p=>{p.mechanism.rideTicks=0;},truthyCollision:p=>{p.mechanism.currentCollisionValid='true';},
  futureRide:p=>{p.mechanism.rideLow.worldStep=p.worldStep+1;},nonintegerRideClock:p=>{p.mechanism.rideLow.worldStep+=.5;},
  otherRideBody:p=>{p.mechanism.rideLow.bodyId++;},otherRideShape:p=>{p.mechanism.rideLow.shapeId++;},fractionalRideTicks:p=>{p.mechanism.rideTicks=.5;},
 };
 for(const mutate of Object.values(mutations)){const f=fixture('castle','upper-ride');mutate(f.moving.physics);assert.throws(()=>validate(f));}
});

test('nonfinite velocities, force or ride counts cannot be measured directed motion',()=>{
 for(const [caseId,id]of CASES){const f=fixture(caseId,id);setVelocity(f,id==='dark-return'?-Infinity:Infinity);assert.throws(()=>validate(f));}
 const force=fixture('room25','relight-ascent');force.moving.physics.mechanism.lastForce.motorForce=Infinity;assert.throws(()=>validate(force));
 const ticks=fixture('castle','upper-ride');ticks.moving.physics.mechanism.rideTicks=Infinity;assert.throws(()=>validate(ticks));
});

test('missing rows or a phase that does not describe the required moving event fail closed',()=>{
 for(const [caseId,id]of CASES){const f=fixture(caseId,id);f.rows=[];assert.throws(()=>validate(f));}
 const room=fixture('room25','dark-return');room.phase.id='loaded-support';assert.throws(()=>validate(room));
 const castle=fixture('castle','upper-ride');castle.phase.id='upper-after-ride';assert.throws(()=>validate(castle));
});
