import test from 'node:test';
import assert from 'node:assert/strict';
import {Vec3,Quaternion} from 'cannon-es';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

// Deliberate contact fixtures, not ordinary-input solutions. Exercise the live
// production level hook and its unchanged original cargo on both actual cells.
for(const id of ['flywheel','pendulum'])test(`${id}: the original tilted load supplies weight without an autonomous recovery motor`,async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(40,true);
 try{
  const level=game.firstLevel,cell=id==='flywheel'?level.machines.get(id).state:level.machines.get(id).state.cell;
  const body=game.physics.cargoBody,shape=body.shapes[0],p=cell.loadCargoPosition;
  body.position.set(p.x,p.y+.2,p.z);body.previousPosition.copy(body.position);body.interpolatedPosition.copy(body.position);
  const q=new Quaternion().setFromAxisAngle(new Vec3(0,0,1),Math.PI/2);
  body.quaternion.copy(q);body.previousQuaternion.copy(q);body.interpolatedQuaternion.copy(q);
  body.velocity.setZero();body.angularVelocity.setZero();body.force.setZero();body.torque.setZero();body.aabbNeedsUpdate=true;body.wakeUp();game.physics.world.broadphase.dirty=true;
  game.cargo.position.copy(body.position);game.cargo.quaternion.copy(body.quaternion);game.companionBehavior.reset();
  let supported=0;
  for(let i=0;i<120*4;i++){
   const contact=cell.loadContact;
   const passive=level.passiveCompanionSupport();
   if(contact){supported++;assert.equal(passive,true,'Real load contact must suppress upright recovery as well as wandering');}
   const force=body.force.toArray(),torque=body.torque.toArray();
   game.companionBehavior.update(1/120,{onPad:level.cargoOnAnyPad(),passiveSupport:passive});
   if(contact){assert.deepEqual(body.force.toArray(),force);assert.deepEqual(body.torque.toArray(),torque);assert.equal(game.companionBehavior.state,'waiting_on_pad');}
   game.physics.step(1/120);game.cargo.position.copy(body.position);game.cargo.quaternion.copy(body.quaternion);
  }
  assert.ok(supported>120,`Only ${supported} positive supporting samples`);
  assert.equal(game.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
  // Apparent position and a held identity never extend the passive exception.
  game.heldCube=game.cargo;assert.equal(cell.loadContact,false);assert.equal(level.passiveCompanionSupport(),false);
  game.heldCube=null;body.collisionResponse=false;assert.equal(level.passiveCompanionSupport(),false);
 }finally{game.firstLevel.dispose();game.physics.dispose();game.portals.dispose();}
});
