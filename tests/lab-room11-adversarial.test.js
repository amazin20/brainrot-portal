import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {terminalAccessible} from '../src/game/LabPuzzleMechanics.js';

const game=await createHeadlessGame(),V=(...p)=>new THREE.Vector3(...p);
after(()=>{game.physics.dispose();game.portals.dispose();});

async function fixture(){
 await game.selectLevel(10,false);game.resetRun(true);
 const level=game.firstLevel,state=level.state;
 return {level,state,drive:state.outputDrive,terminal:state['drive-clutchControl']};
}
function frontFeed(level){
 for(const [index,name]of [[0,'wind-intake'],[1,'wind-outlet']]){
  const panel=level.panels[name];
  assert.equal(game.placeOnPanel(index,panel.mesh,panel.getFrame().center),true);
 }
}
function step(level,seconds,observe=()=>{}){
 for(let n=0;n<Math.ceil(seconds*120);n++){level.update(1/120);observe();}
}
function approach(terminal){
 game.playerPosition.copy(terminal.position).add(V(0,-.8,2.1));
 game.previousPlayerPosition.copy(game.playerPosition);
}

test('room 11: engaging an empty output before airflow cannot trickle live input work through repeated pulses',async()=>{
 const {level,state,drive,terminal}=await fixture();frontFeed(level);approach(terminal);
 assert.ok(terminalAccessible(game,terminal));terminal.action();assert.equal(drive.clutch,true);
 let observedInlet=false;
 for(let pulse=0;pulse<8;pulse++){
  state.blower.enabled=true;
  step(level,1.5,()=>{
   observedInlet ||= state.flywheel.power;
   assert.equal(drive.stroke,0,'A pre-engaged empty clutch received live feed work');
   assert.equal(drive.lastOutputWork,0,'Air pulses accumulated useful output before any charged clutch engagement');
   assert.ok(!drive.clutch||drive.inputTorque===0,'Input and output transmissions engaged together');
  });
  state.blower.enabled=false;step(level,2.5);
 }
 assert.ok(observedInlet,'The negative fixture must actually route air onto the inlet');
 assert.equal(state.door.progress,0);assert.equal(state.ratchet.engaged,false);
 assert.ok(state.flywheel.wheel.energy>0,'The isolated input must still store the real supplied energy');
});

test('room 11: actual closed cover and housing occlude the clutch from every sampled exterior hand position',async t=>{
 const {level,state,drive,terminal}=await fixture();frontFeed(level);state.blower.enabled=true;step(level,4);
 assert.ok(state.flywheel.power);assert.equal(drive.leverClear(),false);
 const original=game.playerPosition.clone();let inspected=0;
 const free=(p)=>!game.colliders.some(c=>c.enabled!==false&&c.box.max.y>p.y+.1&&c.box.min.y<p.y+2.4
  &&p.x>c.box.min.x-.44&&p.x<c.box.max.x+.44&&p.z>c.box.min.z-.44&&p.z<c.box.max.z+.44);
 try{
  // Include the ordinary 7.8 m/s jump apex (~1.56 m at g=19.5),
  // plus its edge near the closed cover's reachable front clearance.
  for(const height of [0,.4,.9,1.4,1.65,1.8])for(const radius of [.8,1.2,1.3,1.6,2.05,2.3])for(let a=0;a<96;a++){
   const angle=a*Math.PI*2/96,p=V(terminal.position.x+Math.cos(angle)*radius,height,terminal.position.z+Math.sin(angle)*radius);
   if(!free(p)||p.clone().add(V(0,.9,0)).distanceTo(terminal.position)>=2.35)continue;
   game.playerPosition.copy(p);inspected++;
   assert.equal(terminalAccessible(game,terminal),false,`Guard can be reached through its closed enclosure from ${p.toArray()}`);
   terminal.action();assert.equal(drive.clutch,false,'Direct action must obey the same physical guard');
  }
 }finally{game.playerPosition.copy(original);game.previousPlayerPosition.copy(original);}
 assert.ok(inspected>100,`Only ${inspected} physically unobstructed hand positions inspected`);
 t.diagnostic(`${inspected} physically unobstructed exterior hand positions rejected by actual collider rays`);
 assert.equal(drive.stroke,0);assert.equal(state.door.progress,0);
});

test('room 11: legacy accumulated-work and ratchet markers cannot manufacture an unpowered gate stroke',async()=>{
 const {level,state,drive}=await fixture();
 state.flywheel.wheel.work=1e9;
 // A derived read-only alias rejects Reflect.set without strict-mode throws;
 // a legacy writable marker is equally unable to supply mechanical energy.
 Reflect.set(state.ratchet,'engaged',true);Reflect.set(state.ratchet,'progress',1);
 step(level,10);
 assert.equal(state.flywheel.wheel.energy,0);assert.equal(drive.lastOutputWork,0);assert.equal(drive.stroke,0);
 assert.equal(state.door.progress,0);assert.equal(state.door.open,false);
 for(const box of state.door.colliders){
  assert.ok(box.enabled!==false,'A forged historical marker disabled a real gate leaf');
 }
});

test('room 11: rendering alone cannot add stored energy, output work, travel, or physical cover motion',async()=>{
 const {level,state,drive}=await fixture();frontFeed(level);state.blower.enabled=true;step(level,3);
 const read=()=>JSON.stringify({energy:state.flywheel.wheel.energy,work:state.flywheel.wheel.work,
  stroke:drive.stroke,outputWork:drive.lastOutputWork,clutch:drive.clutch,cover:drive.cover.opening,
  door:state.door.progress,colliders:game.colliders.map(c=>[c.enabled,c.box.min.toArray(),c.box.max.toArray()]),
  targets:[...game.physics.solids].map(([id,s])=>[id,s.target.toArray(),s.remaining])});
 const before=read();
 for(let n=0;n<20;n++)for(const alpha of [0,.25,.5,1]){level.renderUpdate(alpha);assert.equal(read(),before);}
});

test('room 11: the moving guard has one visible owner shared by physical contacts, hand rays, camera and portal charges',async()=>{
 const {level,state,drive}=await fixture();frontFeed(level);
 const {mesh,collider}=drive.cover;
 assert.equal(mesh,collider.mesh);assert.equal(mesh.visible,true);assert.equal(collider.kinematic,true);
 assert.equal(game.colliders.filter(c=>c.mesh===mesh).length,1);
 assert.equal(game.cameraBlockers.filter(m=>m===mesh).length,1);
 assert.equal(game.aimBlockers.filter(m=>m===mesh).length,1);
 assert.equal(game.portalPanels.includes(mesh),false);
 const same=(a,b,label)=>assert.ok(a.distanceTo(b)<1e-6,label);
 const inspect=()=>{
  const box=new THREE.Box3().setFromObject(mesh),entry=game.physics.solids.get(mesh.uuid);
  assert.ok(entry&&entry.body.world===game.physics.world,'The cover must retain its real registered contact body');
  assert.equal(entry.body.collisionResponse,true);assert.notEqual(entry.body.collisionFilterMask,0);
  same(box.min,collider.box.min,'Guard drawing and player/hand bounds disagree');
  same(box.max,collider.box.max,'Guard drawing and player/hand bounds disagree');
  same(box.getCenter(V()),V(entry.target.x,entry.target.y,entry.target.z),'Cannon target and visible guard disagree');
  const half=entry.body.shapes[0].halfExtents;
  same(box.getSize(V()).multiplyScalar(.5),V(half.x,half.y,half.z),'Cannon contact shape and guard envelope disagree');
 };
 state.blower.enabled=true;step(level,3,inspect);
 assert.ok(drive.cover.opening<.01);
 state.blower.enabled=false;step(level,3,inspect);
 assert.ok(drive.leverClear());
});
