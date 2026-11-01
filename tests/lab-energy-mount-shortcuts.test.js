import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {room13Access} from '../src/game/LabRoom13Journey.js';
import {room14InputControls} from '../src/game/LabRoom14Journey.js';

const views=[['wide',16/9],['portrait',390/844]];
function horizontalDistance(p,b){return Math.hypot(Math.max(b.min.x-p.x,0,p.x-b.max.x),Math.max(b.min.z-p.z,0,p.z-b.max.z));}
async function observe(number,view,aspect,kind,scenario){
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.camera.aspect=aspect;g.camera.updateProjectionMatrix();await g.selectLevel(number-1,true);
 const original={cargo:g.cargo,group:g.cargo.group,body:g.physics.cargoBody,shape:g.physics.cargoBody.shapes[0],world:g.physics.world};
 const mounts=g.colliders.filter(c=>c.mesh.userData.secondChapterMount),row={number,view,aspect,kind,attempted:false,phases:[],samples:[],groundContacts:[],sideContacts:[],unsupportedUpperContacts:[],error:null};
 row.originalIds={group:original.group.uuid,body:original.body.id,shape:original.shape.id};
 row.mounts=mounts.map(c=>({name:c.mesh.name,id:c.mesh.uuid,min:c.box.min.toArray(),max:c.box.max.toArray(),bodyId:g.physics.solids.get(c.mesh.uuid)?.body.id}));
 if(number===14){
  assert.equal(mounts.length,0,'Retired14brackets must not be reintroduced as shortcut supports');
  row.equipment=g.colliders.filter(c=>['14 / projector pedestal','14 / projector barrel'].includes(c.mesh.name)).map(c=>({name:c.mesh.name,id:c.mesh.uuid,bodyId:g.physics.solids.get(c.mesh.uuid)?.body.id}));
  assert.equal(row.equipment.length,2);assert.ok(row.equipment.every(m=>Number.isInteger(m.bodyId)));
 }else{assert.equal(mounts.length,14);assert.ok(row.mounts.every(m=>Number.isInteger(m.bodyId)));}
 let phase='prefix',steps=0,lastGround=null;
 const snapshot=()=>({phase,step:original.world.stepnumber,player:g.playerPosition.toArray(),velocity:g.playerVelocity.toArray(),grounded:g.playerGrounded,cargo:g.cargo.position.toArray(),held:!!g.heldCube,teleports:g.teleportCount,cargoTransports:g.physics.portalTransports});
 const postStep=()=>{
  assert.equal(g.cargo,original.cargo);assert.equal(g.cargo.group,original.group);assert.equal(g.physics.cargoBody,original.body);assert.equal(original.body.shapes[0],original.shape);assert.equal(g.physics.world,original.world);assert.equal(original.world.stepnumber,++steps);
  if(steps%12===0)row.samples.push(snapshot());
  const p=g.playerPosition;
  if(phase!=='prefix'&&number===14&&g.firstLevel.readability.cargoTarget.containsPoint(original.body.position))row.unsupportedUpperContacts.push(snapshot());
  if(g.playerGrounded){
   const contacts=g.colliders.filter(c=>c.enabled&&Math.abs(c.box.max.y-p.y)<.015&&horizontalDistance(p,c.box)<.431).map(c=>({id:c.mesh.uuid,name:c.mesh.name,mount:!!c.mesh.userData.secondChapterMount,top:c.box.max.y}));
   const key=phase+contacts.map(c=>c.id).sort().join(',');if(contacts.length&&key!==lastGround){row.groundContacts.push({...snapshot(),contacts});lastGround=key;}
   if(phase!=='prefix'&&(number===13&&p.y>11.8))row.unsupportedUpperContacts.push(snapshot());
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

// The retired14wall brackets and bridge landing no longer exist. Preserve
// the4view/carry probes by actually reaching the current founded projector,
// then attacking its real roof/low-freight target without the configured field.
for(const [view,aspect]of views)for(const carry of [false,true])
test(`14 ${view}: ${carry?'original carried pair':'free observer'} reaches the real projector but cannot replace the configured freight turn`,async()=>observe(14,view,aspect,carry?'held':'free',async(d,{begin,rush,row})=>{
 const g=d.game,t=room14InputControls(d),level=d.level;
 if(carry){for(let n=0;n<5&&!g.heldCube;n++){d.walk(g.cargo.position.x,g.cargo.position.z+1.2);g.interact();d.wait(.3);}assert.equal(g.heldCube,g.cargo);}
 d.walk(-13.6,4.8);begin('approach the actual current projector pedestal and barrel');rush(-13.6,7,360);
 assert.ok(row.groundContacts.some(s=>s.contacts.some(c=>c.name==='14 / projector pedestal'||c.name==='14 / projector barrel')),'The real current projector must be physically reached before calling its shortcut blocked');
 d.walk(-13.6,4.75);t.north();d.walk(-7.6,0);begin('actual low freight mouth reached from the projector support');
 rush(3,0,300);begin('attempt the sealed freight bay over the actual roof');rush(.55,-3.25,360);
 assert.equal(level.readability.fan.enabled,false);assert.equal(level.state.lightContact.segments.length,1);assert.equal(level.readability.cargoTarget.containsPoint(g.cargo.position),false);assert.equal(!!g.heldCube,carry);assert.equal(g.teleportCount,0);assert.equal(g.physics.portalTransports,0);
}));
