import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

const V=(...v)=>new THREE.Vector3(...v),UP=V(0,1,0),angle=x=>Math.atan2(Math.sin(x),Math.cos(x));

// The new return doorway, not the historical aiming slit, is approached from
// an untouched spawn. Every actor pose comes from production movement, jump,
// ordinary E and simulation. No portal, actor transform or latch is assigned.
test('ordinary E spam, carried sprint-jumps and a free-cargo step attempt cannot cross the unloaded freight return', {timeout:300000},async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(40,true);
 const l=g.firstLevel,s=l.machines.get('freight').state,room=l.rooms.get('freight'),P=room.P;
 const cargo=g.cargo,body=g.physics.cargoBody,shape=body.shapes[0],move=new THREE.Vector2();
 const original={getMove:g.input.getMove,reset:g.resetRun,respawn:g.respawn,cargoReset:g.physics.resetCargo};
 const counters={frames:0,resets:0,respawns:0,cargoResets:0,jumps:0,controlInputs:0,heldFrames:0,freeFrames:0};
 const closed=s.leaves.map(m=>m.userData.collider.box.clone()),plane=closed[0].getCenter(V()).x;
 const samples={held:{minPlayerX:Infinity,minCargoX:Infinity,maxFeetY:0,nearLeafFrames:0},free:{minPlayerX:Infinity,minCargoX:Infinity,maxFeetY:0,nearLeafFrames:0}};
 let phase=null;
 g.input.getMove=()=>move.clone();
 g.resetRun=function(...a){counters.resets++;return original.reset.apply(this,a);};
 g.respawn=function(...a){counters.respawns++;return original.respawn.apply(this,a);};
 g.physics.resetCargo=function(...a){counters.cargoResets++;return original.cargoReset.apply(this,a);};
 function stop(){move.set(0,0);g.input.keys.clear();}
 function worldMove(x,z){const p=V(x,0,z).applyAxisAngle(UP,-g.yaw);move.set(p.x,p.z);}
 async function frame(){
  for(let j=0;j<2&&g.state==='playing';j++)g.updatePlaying(1/120);
  g.updateVisuals(1/60,1);counters.frames++;
  assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
  assert.equal(counters.resets+counters.respawns+counters.cargoResets,0,'The attack must retain its untouched ordinary attempt');
  assert.equal(g.state,'playing');assert.deepEqual(l.getTowerMetrics().solvedIds,[]);
  assert.equal(s.progress,0);assert.equal(s.boltLift,0);assert.equal(s.requestedOpen,false);assert.equal(s.innerLoaded,false);
  s.leaves.forEach((m,i)=>assert.ok(m.userData.collider.box.equals(closed[i]),'A locked leaf moved'));
  if(phase){
   const q=samples[phase];q.minPlayerX=Math.min(q.minPlayerX,g.playerPosition.x);q.minCargoX=Math.min(q.minCargoX,body.position.x);q.maxFeetY=Math.max(q.maxFeetY,g.playerPosition.y);
   assert.ok(g.playerPosition.z>room.P(0,6.2)[2]&&g.playerPosition.z<room.P(0,9.8)[2],
    'The attack must stay inside the return aperture, rather than testing an adjacent fixed pier');
   if(g.playerPosition.x-plane<.8)q.nearLeafFrames++;
   counters[phase==='held'?'heldFrames':'freeFrames']++;
   assert.ok(g.playerPosition.x>plane,'The player crossed the closed return plane');
   assert.ok(body.position.x>plane,'The original cargo crossed the closed return plane');
  }
 }
 async function wait(seconds){stop();for(let i=0;i<Math.ceil(seconds*60);i++)await frame();}
 async function walk(p,{sprint=true,tolerance=.22}={}){
  let best=Infinity,stuck=0;
  for(let i=0;i<5400;i++){
   const dx=p[0]-g.playerPosition.x,dz=p[2]-g.playerPosition.z,d=Math.hypot(dx,dz);
   if(d<tolerance){stop();return;}
   if(d<best-.005){best=d;stuck=0;}else stuck++;
   assert.ok(stuck<260,'Blocked ordinary setup walk '+JSON.stringify({target:p,at:g.playerPosition.toArray()}));
   g.yaw+=THREE.MathUtils.clamp(angle(Math.atan2(-dx,-dz)-g.yaw),-.065,.065);
   g.pitch+=THREE.MathUtils.clamp(-.14-g.pitch,-.025,.025);
   if(sprint)g.input.keys.add('ShiftLeft');else g.input.keys.delete('ShiftLeft');
   const speed=d<.65?Math.max(.16,d/.65):1;worldMove(dx/Math.max(d,.001)*speed,dz/Math.max(d,.001)*speed);await frame();
  }assert.fail('Ordinary setup walk timed out');
 }
 async function look(p){stop();p=V(...p);for(let i=0;i<300;i++){
  g.scene.updateMatrixWorld(true);
  if(p.clone().sub(g.camera.position).dot(g.camera.getWorldDirection(V()))<0){g.yaw+=.16;await frame();continue;}
  const q=p.clone().project(g.camera),tolerance=Math.min(.005,.035/Math.max(1,p.distanceTo(g.camera.position)));
  if(i>20&&Math.abs(q.x)<tolerance&&Math.abs(q.y)<tolerance)return;
  g.yaw-=THREE.MathUtils.clamp(q.x,-1,1)*.21;g.pitch=THREE.MathUtils.clamp(g.pitch+THREE.MathUtils.clamp(q.y,-1,1)*.19,-1.15,1.15);await frame();
 }assert.fail('Ordinary look did not converge');}
 async function pickup(){
  if(g.heldCube)return;
  const p=cargo.position;await walk([p.x,g.playerPosition.y,p.z+1.1],{sprint:false});
  assert.equal(g.interact(),true,'Ordinary original pickup rejected');assert.equal(g.heldCube,cargo);await wait(.35);
 }
 async function dropAt(p,dir){
  await walk([p[0]-dir[0]*3,0,p[2]-dir[1]*3],{sprint:false});
  await walk([p[0]-dir[0]*.85,0,p[2]-dir[1]*.85],{sprint:false});
  await look([p[0]+dir[0]*3,1,p[2]+dir[1]*3]);await wait(.4);
  assert.equal(g.heldCube,cargo);assert.equal(g.interact(),true);assert.equal(g.heldCube,null);await wait(1);
 }
 async function push(seconds){
  const target=V(...P(-4,8));g.input.keys.add('ShiftLeft');
  for(let i=0;i<seconds*60;i++){
   const d=target.clone().sub(g.playerPosition);d.y=0;d.normalize();
   g.yaw+=THREE.MathUtils.clamp(angle(Math.atan2(-d.x,-d.z)-g.yaw),-.065,.065);worldMove(d.x,d.z);
   if(i%45===12){g.input.jumpQueued=true;counters.jumps++;}await frame();
  }stop();await wait(.3);
 }
 try{
  await wait(.1);await pickup();await walk([0,0,39]);await walk(room.door);
  await walk(P(13,0));await walk(P(13,14));await dropAt(P(10,14),[-1,0]);
  await walk(P(4,14));await walk(P(4,13.5));
  const control=l.terminals.find(t=>t.id==='freight:return-outer'),rotation=control.actuator.rotation.x;
  assert.equal(l.nearbyInteraction()?.kind,'freight:return-outer','E spam must actually address the new outer return control');
  for(let i=0;i<12;i++){
   counters.controlInputs++;assert.equal(g.interact(),false,'An unloaded outer lever released the return lock');
   assert.equal(control.actuator.rotation.x,rotation);await wait(.12);
  }
  await walk(P(8,14));await pickup();await walk(P(3,8));
  phase='held';assert.equal(g.heldCube,cargo);await push(6);phase=null;
  assert.ok(samples.held.nearLeafFrames>30,'The carried sprint-jump must reach the new closed leaf');
  assert.ok(samples.held.maxFeetY>.2,'The carried attempt never actually jumped');
  await walk(P(3,8));await dropAt(P(1,8),[-1,0]);
  assert.equal(g.heldCube,null);
  const before=body.position.toArray();assert.ok(Math.abs(before[0]-plane)<2,'The free original was not placed beside the new closed leaf');
  phase='free';await push(8);phase=null;
  assert.ok(samples.free.nearLeafFrames>30,'The free-cargo step attempt must reach the closed leaf');
  assert.ok(samples.free.maxFeetY>.2,'The free-cargo attempt never actually jumped');
  assert.equal(g.heldCube,null);assert.equal(g.teleportCount,0);assert.equal(g.physics.portalTransports,0);
  assert.equal(l.getTowerMetrics().checkpoints,false);assert.equal(l.getTowerMetrics().events.length,0);
  console.info('Freight closed return ordinary witness',JSON.stringify({counters,samples,freeCargoBefore:before,finalPlayer:g.playerPosition.toArray(),finalCargo:body.position.toArray(),plane,scope:'finite attacks at the new closed return aperture; free cargo is an attempted step, not a claim of successful standing on it'}));
 }finally{
  stop();g.input.getMove=original.getMove;g.resetRun=original.reset;g.respawn=original.respawn;g.physics.resetCargo=original.cargoReset;
  l.dispose();g.physics.dispose();g.portals.dispose();
 }
});
