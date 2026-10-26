import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {room13Access} from '../src/game/LabRoom13Journey.js';

const views=[['wide',16/9],['portrait',390/844]];
function horizontalDistance(p,b){return Math.hypot(Math.max(b.min.x-p.x,0,p.x-b.max.x),Math.max(b.min.z-p.z,0,p.z-b.max.z));}
async function observe(number,view,aspect,kind,scenario){
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.camera.aspect=aspect;g.camera.updateProjectionMatrix();await g.selectLevel(number-1,true);
 const original={cargo:g.cargo,group:g.cargo.group,body:g.physics.cargoBody,shape:g.physics.cargoBody.shapes[0],world:g.physics.world};
 const mounts=g.colliders.filter(c=>c.mesh.userData.secondChapterMount),row={number,view,aspect,kind,attempted:false,phases:[],samples:[],groundContacts:[],sideContacts:[],unsupportedUpperContacts:[],error:null};
 row.originalIds={group:original.group.uuid,body:original.body.id,shape:original.shape.id};
 row.mounts=mounts.map(c=>({name:c.mesh.name,id:c.mesh.uuid,min:c.box.min.toArray(),max:c.box.max.toArray(),bodyId:g.physics.solids.get(c.mesh.uuid)?.body.id}));
 assert.equal(mounts.length,number===13?14:10);assert.ok(row.mounts.every(m=>Number.isInteger(m.bodyId)));
 let phase='prefix',steps=0,lastGround=null;
 const snapshot=()=>({phase,step:original.world.stepnumber,player:g.playerPosition.toArray(),velocity:g.playerVelocity.toArray(),grounded:g.playerGrounded,cargo:g.cargo.position.toArray(),held:!!g.heldCube,teleports:g.teleportCount,cargoTransports:g.physics.portalTransports});
 const postStep=()=>{
  assert.equal(g.cargo,original.cargo);assert.equal(g.cargo.group,original.group);assert.equal(g.physics.cargoBody,original.body);assert.equal(original.body.shapes[0],original.shape);assert.equal(g.physics.world,original.world);assert.equal(original.world.stepnumber,++steps);
  if(steps%12===0)row.samples.push(snapshot());
  const p=g.playerPosition;
  if(g.playerGrounded){
   const contacts=g.colliders.filter(c=>c.enabled&&Math.abs(c.box.max.y-p.y)<.015&&horizontalDistance(p,c.box)<.431).map(c=>({id:c.mesh.uuid,name:c.mesh.name,mount:!!c.mesh.userData.secondChapterMount,top:c.box.max.y}));
   const key=phase+contacts.map(c=>c.id).sort().join(',');if(contacts.length&&key!==lastGround){row.groundContacts.push({...snapshot(),contacts});lastGround=key;}
   if(phase!=='prefix'&&((number===13&&p.y>11.8)||(number===14&&p.y>7.3&&p.x>-3.2)))row.unsupportedUpperContacts.push(snapshot());
  }
  if(phase!=='prefix')for(const c of mounts){const clearance=horizontalDistance(p,c.box);if(clearance<.431&&p.y<c.box.max.y-.03&&p.y+2.4>c.box.min.y+.03&&!row.sideContacts.some(s=>s.id===c.mesh.uuid))row.sideContacts.push({...snapshot(),id:c.mesh.uuid,name:c.mesh.name,clearance});}
 };
 original.world.addEventListener('postStep',postStep);
 try{
  row.journey=await runV8Journey(g,{journeyOptions:{nativeStart:true},scenario:async d=>{
   const begin=name=>{phase=name;row.attempted=true;row.phases.push(snapshot());};
   const steer=(x,z,{brake=false}={})=>{const dx=x-g.playerPosition.x,dz=z-g.playerPosition.z,length=Math.hypot(dx,dz),pace=brake?Math.min(1,length*1.8):1;d.worldMove(dx/(length||1)*pace,dz/(length||1)*pace);g.input.keys.add('ShiftLeft');};
   const rush=(x,z,frames=300)=>{for(let n=0;n<frames;n++){steer(x,z);if(n%29===0)g.input.jumpQueued=true;d.frame();}d.stop();d.wait(.2);};
   await scenario(d,{begin,steer,rush,row,snapshot});
  }});
  assert.ok(row.attempted);assert.equal(g.state,'playing');assert.equal(row.journey.resets+row.journey.respawns,0);assert.equal(steps,row.journey.frames*2);assert.equal(row.unsupportedUpperContacts.length,0,'A new support reached an upper route without its real power');
  row.sameOriginal=true;row.physicsSteps=steps;row.final=snapshot();row.pass=true;
 }catch(e){row.error=String(e);row.final=snapshot();row.physicsSteps=steps;row.pass=false;throw e;}
 finally{if(process.env.ENERGY_MOUNT_REPORT)fs.appendFileSync(process.env.ENERGY_MOUNT_REPORT,JSON.stringify(row)+'\n');original.world.removeEventListener('postStep',postStep);g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();}
}

for(const [view,aspect]of views)for(const side of ['south','north'])
test(`13 ${view}: real ${side} receiver mounts do not replace the unpowered lift`,async()=>observe(13,view,aspect,side,async(d,{begin,rush,row,snapshot})=>{
 room13Access(d,{carry:false});d.walk(-16,-15.2);d.walk(-16,-12);d.walk(-12,-6);
 const s=d.level.state;assert.deepEqual(s.optical.receivers,[false,false]);assert.equal(s.optical.loaded,false);assert.equal(s['north-cage'].position.y,6);assert.equal(s['south-cage'].position.y,6);
 if(side==='south'){
  d.walk(-12,-2);d.walk(-14,3);d.walk(-10,3);d.walk(-11.15,7.9);begin('approach the actual south standard foot');d.walk(-11.15,8.35);d.wait(.2);
  assert.ok(row.groundContacts.some(c=>c.contacts.some(m=>m.mount&&m.name.endsWith('grounded foot'))),'The attack must physically step onto the new founded foot');
  row.phases.push(snapshot());begin('jump against the standard and saddle');rush(-11.15,8.925);begin('jump from the reached south entrance toward its upper gallery');rush(-10,14.5);
 }else{
  d.walk(-11.73,-7.5);begin('jump against the actual north receiver arm');rush(-11.73,-8.78);
  assert.ok(row.sideContacts.some(c=>c.name.includes('north optical receiver')),'The attack must reach the real arm or collar side clearance');
  begin('jump from the reached north entrance toward its upper gallery');rush(-10,-14.5);
 }
 assert.deepEqual(s.optical.receivers,[false,false]);assert.equal(s.optical.loaded,false);assert.equal(s['north-cage'].position.y,6);assert.equal(s['south-cage'].position.y,6);assert.ok(d.game.cargo.position.y<1);assert.equal(d.game.heldCube,null);
}));

for(const [view,aspect]of views)for(const carry of [false,true])
test(`14 ${view}: ${carry?'original carried pair':'free observer'} reaches the projector but cannot replace the routed light crossing`,async()=>observe(14,view,aspect,carry?'held':'free',async(d,{begin,steer,rush,row,snapshot})=>{
 const g=d.game,p=d.level.panels,s=d.level.state;
 d.aim(0,p.access.getFrame().center);d.aim(1,p['weave-west'].getFrame().center);if(carry){d.walk(-14,12);d.pickup();}d.enter(p.access);d.walk(-16.5,0);d.walk(-14.3,-.6);d.wait(.2);
 assert.ok(g.playerGrounded&&Math.abs(g.playerPosition.y-6)<.02);assert.equal(s.lightBridge.segments.length,1);assert.equal(s.counterweightStair.supported,false);
 begin('sprint and jump from the real west landing');let jumped=false,landed=false;
 for(let n=0;n<240;n++){
  steer(-10.82,-6.79,{brake:true});if(!jumped&&g.playerPosition.z< -2.55){g.input.jumpQueued=true;jumped=true;row.phases.push({...snapshot(),event:'jump input'});}d.frame();
  if(jumped&&n>70&&g.playerGrounded){landed=true;row.phases.push({...snapshot(),event:'landed after jump'});break;}
 }
 d.stop();assert.ok(jumped&&landed,'The actual west-ledge jump did not finish');
 assert.ok(row.groundContacts.some(c=>c.phase!=='prefix'&&c.player[1]>=5.09&&c.player[1]<5.34&&c.player[0]>-12&&c.player[0]<-8&&c.player[2]<-6.4),'The real projector or its original light sheet must be reached before the attack');
 d.wait(.2);begin('attempt island from the reached support');rush(-1.5,0);begin('lower wall and bracket climb');for(const [x,z]of [[-10.82,-7.61],[-10.82,-8.35],[-9.18,-7.61]])rush(x,z,180);
 assert.equal(s.lightBridge.segments.length,1);assert.equal(s.counterweightStair.supported,false);assert.equal(s.counterweightStair.offset,-7.2);assert.equal(!!g.heldCube,carry);
}));
