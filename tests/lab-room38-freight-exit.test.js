import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Vec3} from 'cannon-es';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {readRoom38FreightLoad} from '../src/game/LabRoom38FreightExit.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runPostB} from '../src/game/LabPostJourneyB.js';
import {installPreciseLateAim} from '../src/game/LabLateCampaignAim.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {terminalAccessible} from '../src/game/LabPuzzleMechanics.js';

function supportFixture(){
 const physics=new LabPhysics(),body=physics.createCargo({position:[0,.39,0],size:.78,mass:3.2});
 const mesh=new THREE.Object3D();
 physics.addStaticBox(mesh.uuid,{min:[-6,-1,-6],max:[6,0,6]},{kinematic:true});
 const freight={floor:{mesh,y:0}},game={physics};
 return {physics,body,freight,game,step(n=120){for(let i=0;i<n;i++){body.wakeUp();physics.step(1/120);}},dispose(){physics.dispose();}};
}

test('38 motor couples to present original free-body deck force, not nearby or stale geometry',()=>{
 const f=supportFixture();try{
  f.step();const body=f.body,shape=body.shapes[0],load=readRoom38FreightLoad(f.game,f.freight);
  assert.ok(load.contacts>0&&load.normalForce>8);assert.equal(load.cargoBodyId,body.id);assert.equal(load.cargoShapeId,shape.id);
  assert.equal(load.deckBodyId,f.physics.solids.get(f.freight.floor.mesh.uuid).body.id);
  const mask=body.collisionFilterMask;body.collisionFilterMask=0;
  assert.equal(readRoom38FreightLoad(f.game,f.freight).contacts,0,'A disabled body pair cannot reuse old support equations');body.collisionFilterMask=mask;
  const shapeMask=shape.collisionFilterMask;shape.collisionFilterMask=0;
  assert.equal(readRoom38FreightLoad(f.game,f.freight).contacts,0,'A disabled shape pair cannot reuse old support equations');shape.collisionFilterMask=shapeMask;
  body.position.x+=20;assert.equal(readRoom38FreightLoad(f.game,f.freight).contacts,0,'Same-height remote cargo has no present deck support');body.position.x-=20;
  f.physics.setCarryTarget({x:0,y:.39,z:0});
  assert.equal(readRoom38FreightLoad(f.game,f.freight).contacts,0,'A real hand constraint must disengage the tread');
  f.physics.release();body.position.y+=1;body.aabbNeedsUpdate=true;
  assert.equal(readRoom38FreightLoad(f.game,f.freight).contacts,0,'Last-step equations cannot power an airborne body');
  body.position.y=.39;body.collisionResponse=false;
  assert.equal(readRoom38FreightLoad(f.game,f.freight).contacts,0);
  body.collisionResponse=true;f.physics.setStaticEnabled(f.freight.floor.mesh.uuid,false);
  assert.equal(readRoom38FreightLoad(f.game,f.freight).contacts,0);
  assert.equal(f.physics.cargoBody,body);assert.equal(body.shapes[0],shape);assert.equal(body.mass,3.2);
 }finally{f.dispose();}
});

async function game38(){
 const g=await createHeadlessGame();g.chamberEdition='foundation';Object.assign(g,ACTIVE_FOUNDATION_RUNTIME_FLAGS);
 await g.selectLevel(37,false);return g;
}
function dispose(g){g.firstLevel?.dispose?.();g.physics?.dispose();g.portals?.dispose();}
function identity(g){return {cargo:g.cargo,body:g.physics.cargoBody,shape:g.physics.cargoBody.shapes[0]};}
function same(g,id){assert.equal(g.cargo,id.cargo);assert.equal(g.physics.cargoBody,id.body);assert.equal(id.body.shapes[0],id.shape);assert.equal(id.body.mass,3.2);}
function putFreight(d){
 const g=d.game;
 for(let i=0;i<12&&!g.heldCube;i++){d.walk(g.cargo.position.x+1.35,g.cargo.position.z);g.interact();d.wait(.2);}
 assert.equal(g.heldCube,g.cargo);d.walk(11,2);d.stop();d.wait(.3);assert.equal(g.interact(),true);d.wait(.9);
 assert.equal(g.heldCube,null);assert.ok(g.firstLevel.freightExit.motor.read().normalForce>8);
}

// This is the successful baseline attack, including its original empty-hand
// portal preparation and continuous held-flight steering. No attack prep is
// omitted, and the final attempt targets the current joint goal.
function originalCarryFlight(d,{attack=null}={}){
 const g=d.game,l=g.firstLevel,p=l.panels;installPreciseLateAim(d);
 for(const [x,z] of [[11,12],[2,12],[-15,8.2]])d.walk(x,z);
 d.aim(0,p['well-entry'].getFrame().center);
 for(const [x,z] of [[-23,9],[-23,-16],[-15,-13.4]])d.walk(x,z);
 d.aim(1,p['angle-outlet'].getFrame().center);
 for(const [x,z] of [[-23,-16],[-23,9],[2,12],[11,12]])d.walk(x,z);
 for(let n=0;n<8&&!g.heldCube;n++){d.walk(g.cargo.position.x+1.25,g.cargo.position.z);g.interact();d.wait(.2);}
 assert.equal(g.heldCube,g.cargo);
 for(const [x,z] of [[11,12],[2,12],[-23,9],[-23,-16],[-15,-13.4],[-17,-12.1]])d.walk(x,z);
 d.wait(.4);const before=g.teleportCount;
 if(attack?.jump){g.input.keys.add('ShiftLeft');g.input.jumpQueued=true;}
 for(let n=0;n<360&&g.teleportCount===before;n++){
  if(attack?.jump){
   const entry=g.portals.portals[0].position,dx=entry.x-g.playerPosition.x,dz=entry.z-g.playerPosition.z;
   d.worldMove(THREE.MathUtils.clamp(dx*.6,-1,1),THREE.MathUtils.clamp(dz*.6,-1,1));
  }else d.worldMove(0,1);
  d.frame();
 }d.stop();
 d.until(()=>g.teleportCount>before,5,'Held original pair missed gravity portal');
 if(attack){
  let apex=g.playerPosition.y;g.input.keys.add('ShiftLeft');
  for(let n=0;n<480&&!g.playerGrounded&&g.state==='playing';n++){
   const dx=attack.target[0]-g.playerPosition.x,dz=attack.target[1]-g.playerPosition.z,r=Math.hypot(dx,dz);
   d.worldMove(dx/Math.max(.001,r),dz/Math.max(.001,r));d.frame();apex=Math.max(apex,g.playerPosition.y);
  }d.stop();d.until(()=>g.playerGrounded,6,'Strong held flight never reached physical support');
  assert.ok(apex>15);assert.equal(g.heldCube,g.cargo);assert.equal(l.freight.floor.y,0);assert.equal(l.freightExit.motor.stroke,0);
  d.mark(`${attack.name}: original held ballistic approach reaches apex ${apex.toFixed(3)}m while freight remains0`);
  return {apex};
 }
 d.until(()=>g.playerGrounded,6,'Held pair did not land on north dock');
 d.walk(15,-18);d.walk(16,-19);d.wait(.5);
 assert.ok(g.playerPosition.y>14.9);assert.equal(g.heldCube,g.cargo);assert.ok(g.teleportCount>before);
 assert.equal(l.freight.target,0);assert.equal(l.freight.floor.y,0);
}

for(const options of [{},{route:'send-freight-early'},{recover:true}])test(`38 genuine ${JSON.stringify(options)} retains original load and opens the actual dock-driven bay`,async()=>{
 const g=await game38(),id=identity(g);try{
  let supported=false;
  const r=await runV8Journey(g,{journeyOptions:options,onMilestone:()=>{supported ||= g.firstLevel.freightExit.motor.read().normalForce>8;}});
  assert.equal(r.pass,true);assert.equal(g.state,'won');assert.equal(r.resets+r.respawns,0);same(g,id);
  const l=g.firstLevel;assert.ok(supported);assert.ok(l.freight.at(1));assert.equal(l.freightExit.motor.stroke,1);
  assert.ok(l.freightExit.collider.box.min.y>g.playerPosition.y+2.4);
  assert.ok(new THREE.Box3().setFromObject(l.freightExit.leaf).equals(l.freightExit.collider.box));
  assert.ok(l.goal.contains(g.playerPosition)&&l.goal.contains(g.cargo.position));
  assert.ok(g.playerPosition.z>6,'The genuine finish must cross the new physical freight door');
 }finally{dispose(g);}
});

for(const attack of [
 {name:'upper/front and roof approach',target:[11,11],jump:true},
 {name:'west-side ballistic approach',target:[4.6,10],jump:true},
 {name:'east-side ballistic approach',target:[17.4,10],jump:true},
])test(`38 ${attack.name} uses an ordinary sprint/jump gravity flight and cannot enter the actual closed bay`,async()=>{
 const g=await game38(),id=identity(g);try{
  const r=await runV8Journey(g,{scenario:d=>{
   const proof=originalCarryFlight(d,{attack});
   const goal=g.firstLevel.goal;
   // Continue normal sprint/jump input toward the genuine goal after the
   // flight contacts a side, roof, lower support or return ramp.
   g.input.keys.add('ShiftLeft');
   for(let n=0;n<300&&g.state==='playing';n++){
    const dx=11-g.playerPosition.x,dz=11-g.playerPosition.z,r=Math.hypot(dx,dz);
    if(g.playerGrounded&&n%35===0)g.input.jumpQueued=true;
    d.worldMove(dx/Math.max(.001,r),dz/Math.max(.001,r));d.frame();
   }d.stop();
   assert.equal(g.state,'playing');assert.equal(g.firstLevel.freight.floor.y,0);assert.equal(g.firstLevel.freightExit.motor.stroke,0);
   assert.ok(!goal.contains(g.playerPosition)||!goal.contains(g.cargo.position));
   console.log('ROOM38_BALLISTIC_PROOF',JSON.stringify({attack:attack.name,apex:proof.apex,teleports:g.teleportCount,
    player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),held:g.heldCube===g.cargo,freight:g.firstLevel.freight.floor.y,won:g.state==='won'}));
   d.mark(`${attack.name}: current-goal sprint/jump attempt remains outside; apex=${proof.apex.toFixed(3)}`);
  }});
  assert.equal(r.resets+r.respawns,0);same(g,id);
 }finally{dispose(g);}
});

test('38 exact original carry-flight reaches its old target, but empty dispatch and a current-goal approach cannot bypass freight',async()=>{
 const g=await game38(),id=identity(g);try{
  const r=await runV8Journey(g,{scenario:d=>{
   originalCarryFlight(d);const l=g.firstLevel;
   d.walk(15.8,-19);assert.equal(g.interact(),true);d.wait(.5);
   assert.equal(l.freight.target,0);assert.equal(l.freight.floor.y,0);assert.equal(l.freightExit.motor.stroke,0);
   d.walk(11,-4);let blocked=false;
   try{d.walk(11,11,10);}catch(e){assert.match(String(e),/Blocked walking|Walk timed out/);blocked=true;}
   assert.ok(blocked||!l.goal.contains(g.playerPosition));assert.equal(g.state,'playing');
   assert.equal(l.freight.floor.y,0);assert.equal(l.freightExit.motor.stroke,0);
   d.mark('The original held flight reaches the gallery, while the actual closed freight bay remains inaccessible');
  }});
  assert.equal(r.pass,true);assert.equal(r.resets+r.respawns,0);same(g,id);assert.equal(g.state,'playing');
 }finally{dispose(g);}
});

test('38 scout-first held arrival can return normally, reload freight and finish without a reset',async()=>{
 const g=await game38(),id=identity(g);try{
  const r=await runV8Journey(g,{scenario:d=>{
   originalCarryFlight(d);
   // Clear the north catch's tall east end screen before leaving its apron;
   // the existing dry return ramp starts at z=-4 and receives this drop.
   d.walk(21,-7);d.walk(25,-6);d.walk(25,0);
   d.until(()=>g.playerGrounded&&g.playerPosition.y< -2.5,6,'Scout return missed the real dry service ramp');
   d.walk(25,16);d.walk(19,16);d.walk(11,12);d.stop();d.wait(.3);assert.equal(g.interact(),true);d.wait(.9);
   assert.equal(g.heldCube,null);runPostB(d);assert.equal(g.state,'won');
  }});
  assert.equal(r.resets+r.respawns,0);same(g,id);assert.equal(g.state,'won');
 }finally{dispose(g);}
});

test('38 removing real support mid-ascent stops and physically retains carriage height; cam follows current pose',async()=>{
 const g=await game38(),id=identity(g);try{
  const r=await runV8Journey(g,{scenario:d=>{
   const l=g.firstLevel;putFreight(d);d.walk(17,19);assert.equal(g.interact(),true);
   d.until(()=>l.freight.floor.y>5,6,'Actually loaded freight never rose');
   assert.ok(l.freightExit.motor.read().normalForce>8);
   // Explicit negative physics fixture: an impulse ejects the unchanged free
   // body. This is not a positive journey or a cargo pose assignment.
   id.body.applyImpulse(new Vec3(0,30,80));
   d.until(()=>!l.freightExit.motor.engaged,2,'Airborne cargo still powered the car');
   const height=l.freight.floor.y;d.wait(2);
   assert.ok(height>5&&height<14);assert.equal(l.freight.floor.y,height);assert.equal(l.freight.braked,true);
   assert.equal(l.freightExit.motor.stroke,0);assert.ok(id.body.position.distanceTo(new Vec3(11,height+.39,2))>2);
   assert.ok(new THREE.Box3().setFromObject(l.freightExit.leaf).equals(l.freightExit.collider.box));
  }});
  assert.equal(r.resets+r.respawns,0);same(g,id);
 }finally{dispose(g);}
});

test('38 final bay has continuous physical sides, rear, roof and a door-to-lintel overlap',async()=>{
 const g=await game38();try{
  const e=g.firstLevel.freightExit,boxes=e.parts.map(mesh=>({name:mesh.name,box:new THREE.Box3().setFromObject(mesh)}));
  const find=name=>boxes.filter(p=>p.name.includes(name)).map(p=>p.box);
  const sides=find('sealed exit side'),roof=find('sealed exit roof')[0],rear=find('sealed exit rear')[0],lintel=find('front door lintel')[0];
  assert.equal(sides.length,2);assert.ok(sides.every(b=>b.min.y<15&&b.max.y>28&&b.min.z<6&&b.max.z>=14));
  assert.ok(roof.min.x<5&&roof.max.x>17&&roof.min.z<6&&roof.max.z>=14&&roof.max.y>=28.79);
  assert.ok(29-roof.max.y<.39,'Neither full original body nor capsule fits above the roof');
  assert.ok(rear.min.y<15&&rear.max.y>28&&rear.min.x<5&&rear.max.x>17);
  assert.ok(e.collider.box.max.y>=lintel.min.y&&e.collider.box.min.y<=15);
  assert.ok(e.collider.enabled);assert.ok(g.physics.solids.get(e.collider.mesh.uuid)?.inWorld);
  for(const [i,mesh] of e.parts.entries()){
   const c=e.fixedColliders[i];assert.ok(g.colliders.includes(c)&&c.enabled!==false,mesh.name+' must be a real solid');
   assert.ok(c.box.equals(new THREE.Box3().setFromObject(mesh)),mesh.name+' must share its collision envelope');
   assert.ok(g.physics.solids.get(c.mesh.uuid)?.inWorld,mesh.name+' must own a live physical body');
  }
 }finally{dispose(g);}
});

test('38 every recovery/dispatch console has a fully founded footprint and a supported ordinary interaction stance',async()=>{
 const g=await game38(),saved=g.playerPosition.clone();try{
  const decks=g.firstLevel.workshop.decks;
  for(const t of g.firstLevel.terminals){
   const box=new THREE.Box3().setFromObject(t.art),y=box.min.y;
   const deck=decks.find(f=>Math.abs(f.y-y)<.03&&box.min.x>=f.minX+.01&&box.max.x<=f.maxX-.01&&box.min.z>=f.minZ+.01&&box.max.z<=f.maxZ-.01);
   assert.ok(deck,`${t.kind} needs its whole real model footprint on an existing deck`);
   const approaches=[[t.position.x,y,t.position.z+1.4],[t.position.x,y,t.position.z-1.4],[t.position.x+1.4,y,t.position.z],[t.position.x-1.4,y,t.position.z]];
   let reachable=false;
   for(const p of approaches){
    if(!decks.some(f=>Math.abs(f.y-y)<.03&&p[0]-.44>f.minX&&p[0]+.44<f.maxX&&p[2]-.44>f.minZ&&p[2]+.44<f.maxZ))continue;
    // Read-only geometric interaction fixture, not a positive journey. The
    // full normal routes use actual walking in their separate tests.
    g.playerPosition.fromArray(p);reachable ||= terminalAccessible(g,t);
   }
   assert.ok(reachable,`${t.kind} needs an unobstructed hand reach from a full supported capsule stance`);
  }
 }finally{g.playerPosition.copy(saved);dispose(g);}
});
