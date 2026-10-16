import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vec3} from 'cannon-es';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {LabCompanionBehavior} from '../src/game/LabCompanionBehavior.js';

function fixture(){
 const physics=new LabPhysics();
 physics.addStaticBox('support',{min:[-4,-.4,-4],max:[4,0,4]});
 physics.createCargo({position:[0,.65,0],quaternion:new Quaternion().setFromAxisAngle(new Vec3(0,0,1),Math.PI/2)});
 return{physics,behavior:new LabCompanionBehavior(physics)};
}

test('a fallen original on a passive support receives neither an upright motor nor a clearance shuffle',()=>{
 const{physics,behavior}=fixture(),body=physics.cargoBody,shape=body.shapes[0];let supported=0;
 try{
  for(let i=0;i<120*8;i++){
   const contact=physics.world.contacts.some(c=>c.enabled!==false&&c.multiplier>0&&[c.bi,c.bj].includes(body)&&(c.bi===body?-c.ni.y:c.ni.y)>.65);
   behavior.update(1/120,{onPad:contact,passiveSupport:contact});
   if(contact){supported++;assert.equal(behavior.state,'waiting_on_pad');assert.equal(body.force.length(),0);assert.equal(body.torque.length(),0);}
   physics.step(1/120);
  }
  assert.ok(supported>200);assert.equal(physics.cargoBody,body);assert.equal(body.shapes[0],shape);
  assert.ok(Math.abs(body.quaternion.vmult(new Vec3(0,1,0)).y)<.1,'The naturally resting side must not be stood upright by a hidden motor');
  assert.ok(Math.abs(body.position.y-.39)<.03);
 }finally{physics.dispose();}
});

test('passive support preserves actual outside forces, rigid-body state and shape instead of cancelling energy',()=>{
 const{physics,behavior}=fixture(),b=physics.cargoBody,snapshot=()=>({position:b.position.toArray(),velocity:b.velocity.toArray(),quaternion:b.quaternion.toArray(),angularVelocity:b.angularVelocity.toArray(),force:b.force.toArray(),torque:b.torque.toArray(),mass:b.mass,type:b.type,shape:b.shapes[0]});
 try{
  b.force.set(3,-2,4);b.torque.set(1,2,3);b.velocity.set(.1,.2,.3);
  const before=snapshot();behavior.update(1/120,{passiveSupport:true});assert.deepEqual(snapshot(),before);
  behavior.update(1/120,{passiveSupport:true,held:true});assert.equal(behavior.state,'held');assert.deepEqual(snapshot(),before);
 }finally{physics.dispose();}
});
