import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {SingularityKit,V} from '../src/game/LabSingularityKit.js';
import {buildCastleCrownRotation} from '../src/game/LabCastleCrownRotation.js';
import {prepareCrownSpatialRoom,traverseCrownSpatialRoom} from '../src/game/LabSingularityJourney.js';

const UP=V(0,1,0),angle=x=>Math.atan2(Math.sin(x),Math.cos(x));

// This is an explicitly isolated, initially available Crown room fixture.
// It never grants the production castle's eleven prerequisite achievements.
// After normal fixture initialization, every pose and mechanism change comes
// from production movement, aimed shots, E and the shared production route.
async function roomFixture(){
 const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(40,true);
 game.firstLevel.dispose();
 assert.equal(game.physics.bodyBoxes.size,0,'Old owned mechanisms must be disposed before the isolated fixture');
 const k=new SingularityKit(game),room={def:{id:'crown',at:[0,0,0],w:32,d:38,h:19},P:(x,z=0,y=0)=>[x,y,z]},events=[];
 k.floor(-16,16,-19,19,0);
 for(const x of [-16.25,16.25])k.box([x,9.5,0],[.5,19,38.5],k.m.wall);
 for(const z of [-19.25,19.25])k.box([0,9.5,z],[32.5,19,.5],k.m.wall);
 let won=false;
 const standing=(p,r=1.2)=>game.playerGrounded&&Math.hypot(game.playerPosition.x-p[0],game.playerPosition.z-p[2])<r&&Math.abs(game.playerPosition.y-p[1])<.3;
 const branch=buildCastleCrownRotation({game,k,room,standing,available:()=>true,
  complete:(id,proof)=>{events.push({id,proof});won=true;},
  plate:(p,size,material)=>k.box([p[0],p[1]+.065,p[2]],[size-.2,.035,size-.2],material,{solid:false,dynamic:true}),sign:()=>null});
 const level={id:'isolated-crown-spatial-fixture',title:'Isolated Crown ordinary route',singularity:true,contextHandlesCarry:true,momentum:true,
  spawn:V(13,0,13),cargoSpawn:V(11,.57,13),spawnView:{yaw:0,pitch:-.12},terminals:k.terminals,rooms:new Map([['crown',room]]),machines:new Map([['crown',branch]]),
  getLaunch:()=>null,getObjective:()=> 'Isolated Crown ordinary route',getContextLesson:()=>null,isWon:()=>won,
  cargoOnAnyPad:()=>branch.state.loaded,passiveCompanionSupport:branch.passiveSupport,playerAcceleration:()=>V(),
  update:dt=>{branch.update(dt);k.syncDynamic(dt);},renderUpdate:()=>branch.syncPose(),
  interact(){const t=k.nearest();if(!t)return false;if(t.action()===false)return false;game.animator.triggerOperate?.();return true;},
  nearbyInteraction(){const t=k.nearest();return t?{kind:t.kind,label:'E',text:t.lesson}:null;},
  reset(){won=false;events.length=0;branch.reset();k.resetControls();},diagnostics:branch.diagnostics,
  dispose(){branch.dispose();k.dispose();}};
 game.firstLevel=level;game.mechanisms=level;
 for(const c of k.colliders)game.physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:c.kinematic});
 game.indexColliders();game.resetRun(true);game.updateVisuals(1/60,1);
 return{game,level,k,branch,room,events};
}

async function runCrownOrdinaryCase({heldNegative=false}={}){
 const f=await roomFixture(),g=f.game,s=f.branch.state,body=g.physics.cargoBody,shape=body.shapes[0],cargo=g.cargo,move=new THREE.Vector2();
 const original={getMove:g.input.getMove,reset:g.resetRun,respawn:g.respawn,cargoReset:g.physics.resetCargo};
 const counters={frames:0,steps:0,shots:0,interactions:0,resets:0,respawns:0,cargoResets:0},stamps={},marks=[],used=[];
 const closedProbe={frames:0,jumpInputs:0,maxFeetY:0,maxZ:-Infinity,nearLeafFrames:0};
 const initial=s.rotors.map(r=>({body:r.body,shape:r.body.shapes[0],bounds:r.collider.box.clone()}));
 let previousPlayer=null,crossedGallery=null;
 g.input.getMove=()=>move.clone();
 g.resetRun=function(...a){counters.resets++;return original.reset.apply(this,a);};g.respawn=function(...a){counters.respawns++;return original.respawn.apply(this,a);};g.physics.resetCargo=function(...a){counters.cargoResets++;return original.cargoReset.apply(this,a);};
 const snap=()=>({frame:counters.frames,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),angles:s.rotors.map(r=>r.angle),held:g.heldCube===cargo,state:g.state});
 function stop(){move.set(0,0);g.input.keys.clear();}
 function worldMove(x,z){const p=V(x,0,z).applyAxisAngle(UP,-g.yaw);move.set(p.x,p.z);}
 async function frame(){
  for(let j=0;j<2&&g.state==='playing';j++){g.updatePlaying(1/120);counters.steps++;}
  g.updateVisuals(1/60,1);counters.frames++;
  assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
  assert.equal(counters.resets+counters.respawns+counters.cargoResets,0,'No route reset may replace an input');
  const step=g.physics.world.stepnumber;
  for(const [i,r]of s.rotors.entries()){
   assert.equal(r.body,initial[i].body);assert.equal(r.body.shapes[0],initial[i].shape);
   assert.equal(g.physics.solids.has(r.mesh.uuid),false,'Rotating collision cannot be a changing AABB body');
   assert.equal(g.physics.inspectBodyBox(r.mesh.uuid,{bounds:r.collider.box,orientedBox:r.collider.orientedBox,enabled:true}).valid,true,'Every ordinary frame retains the exact live rotated Box');
   if(r.angle>.001)stamps[i===0?'sightMotion':'passageMotion']??=step;
   if(Math.abs(r.angle-Math.PI/2)<1e-7)stamps[i===0?'sightOpen':'passageOpen']??=step;
  }
  if(g.teleportCount)stamps.portal??=step;
  if(s.loaded)stamps.load??=step;
  if(g.state==='won')stamps.won??=step;
  if(previousPlayer&&previousPlayer.z<4&&g.playerPosition.z>=4&&Math.abs(previousPlayer.x+5.8)<.3&&Math.abs(g.playerPosition.x+5.8)<.3&&g.heldCube===cargo)
   crossedGallery??={step,foot:g.playerPosition.toArray(),heldOriginal:true};
  previousPlayer=g.playerPosition.clone();
 }
 async function wait(seconds){stop();for(let i=0;i<Math.ceil(seconds*60);i++)await frame();}
 async function until(predicate,seconds,label){stop();for(let i=0;i<seconds*60&&!predicate();i++)await frame();assert.ok(predicate(),label+' '+JSON.stringify(snap()));}
 async function walk(p,{sprint=true,tolerance=.22,timeout=90}={}){
  p=p.toArray?.()??p;let best=Infinity,stuck=0;
  for(let i=0;i<timeout*60;i++){
   if(g.state==='won'){stop();return;}
   const dx=p[0]-g.playerPosition.x,dz=p[2]-g.playerPosition.z,d=Math.hypot(dx,dz);
   if(d<tolerance&&Math.abs(p[1]-g.playerPosition.y)<.65){stop();return;}
   if(d<best-.005){best=d;stuck=0;}else stuck++;
   assert.ok(stuck<260,'Blocked ordinary walk '+JSON.stringify({target:p,...snap()}));
   g.yaw+=THREE.MathUtils.clamp(angle(Math.atan2(-dx,-dz)-g.yaw),-.065,.065);g.pitch+=THREE.MathUtils.clamp(-.14-g.pitch,-.025,.025);
   if(sprint)g.input.keys.add('ShiftLeft');else g.input.keys.delete('ShiftLeft');
   const speed=d<.65?Math.max(.16,d/.65):1;worldMove(dx/Math.max(d,.001)*speed,dz/Math.max(d,.001)*speed);await frame();
  }assert.fail('Ordinary walk timed out '+JSON.stringify(snap()));
 }
 async function look(p){stop();p=V(...(p.toArray?.()??p));for(let i=0;i<300;i++){
  g.scene.updateMatrixWorld(true);if(p.clone().sub(g.camera.position).dot(g.camera.getWorldDirection(V()))<0){g.yaw+=.16;await frame();continue;}
  const q=p.clone().project(g.camera),tolerance=Math.min(.005,.035/Math.max(1,p.distanceTo(g.camera.position)));
  if(i>20&&Math.abs(q.x)<tolerance&&Math.abs(q.y)<tolerance)return;
  g.yaw-=THREE.MathUtils.clamp(q.x,-1,1)*.21;g.pitch=THREE.MathUtils.clamp(g.pitch+THREE.MathUtils.clamp(q.y,-1,1)*.19,-1.15,1.15);await frame();
 }assert.fail('Cannot aim '+JSON.stringify(snap()));}
 async function shoot(slot,p){assert.equal(g.heldCube,null);p=[...(p.toArray?.()??p)];p[1]-=.4;await look(p);assert.equal(g.firePortal(slot),true);counters.shots++;await until(()=>!g.portalShots.queue.length&&!g.portalShots.active.length,4,'Unresolved ordinary shot');assert.equal(g.portalShots.lastImpact?.valid,true,'Ordinary portal shot did not hit its actual panel '+JSON.stringify(g.portalShots.lastImpact));}
 async function use(id,{side=null}={}){
  if(id==='crown:passage'&&!heldNegative){
   // The original remains on the real south floor. Before opening B, take
   // an ordinary sprint/jump attack to the actual closed leaf inside its
   // aperture. Then retreat by a real clear path and operate the wheel.
   assert.equal(g.heldCube,null);await walk(f.room.P(-5.8,0));g.input.keys.add('ShiftLeft');
   for(let i=0;i<120;i++){
    g.yaw+=THREE.MathUtils.clamp(angle(Math.PI-g.yaw),-.065,.065);worldMove(0,1);
    if(i%45===12){g.input.jumpQueued=true;closedProbe.jumpInputs++;}
    await frame();closedProbe.frames++;closedProbe.maxFeetY=Math.max(closedProbe.maxFeetY,g.playerPosition.y);closedProbe.maxZ=Math.max(closedProbe.maxZ,g.playerPosition.z);
    if(g.playerPosition.z>3)closedProbe.nearLeafFrames++;
    assert.ok(g.playerPosition.x> -10.9&&g.playerPosition.x< -5.1,'The ordinary attack must be inside the new closed leaf width');
    assert.ok(g.playerPosition.z<3.5,'A sprint/jump crossed the closed transverse section');
    assert.equal(s.rotors[1].angle,0);assert.equal(s.rotors[1].target,0);assert.equal(f.events.length,0);assert.equal(g.state,'playing');
   }
   stop();assert.ok(closedProbe.nearLeafFrames>30,'The attack must genuinely reach the closed leaf');assert.ok(closedProbe.maxFeetY>.2,'The attack must genuinely jump');
   await walk(f.room.P(-5.8,0));await walk(f.room.P(-5.8,-5));await walk(f.room.P(-13,-5));
  }
  const t=f.level.terminals.find(t=>t.id===id);assert.ok(t);await walk([t.position.x,t.position.y-1,t.position.z+(side??(g.playerPosition.z<t.position.z?-1:1))*1.5]);assert.equal(g.heldCube,null);const before=t.actuator.rotation.x;assert.equal(g.interact(),true,'Ordinary E rejected '+id);assert.equal(g.heldCube,null);assert.notEqual(t.actuator.rotation.x,before,'A different input stole '+id);counters.interactions++;used.push(id);await wait(.28);
 }
 async function pickup(){for(let i=0;i<4&&!g.heldCube;i++){const p=g.cargo.position;if(g.playerPosition.clone().add(V(0,1.1,0)).distanceTo(p)>1.9)await walk([p.x,g.playerPosition.y,p.z+1.1]);if(g.interact()&&g.heldCube){counters.interactions++;await wait(.35);return;}await wait(.35);}assert.equal(g.heldCube,cargo,'Original pickup failed '+JSON.stringify(snap()));}
 async function dropAt(p,dir=[0,-1]){await walk([p[0]-dir[0]*3,p[1],p[2]-dir[1]*3],{sprint:false});await walk([p[0]-dir[0]*.85,p[1],p[2]-dir[1]*.85],{sprint:false});await look([p[0]+dir[0]*3,p[1]+1,p[2]+dir[1]*3]);await wait(.4);assert.equal(g.heldCube,cargo);assert.equal(g.interact(),true);counters.interactions++;await wait(1);}
 async function enter(panel){const p=panel.frame();await walk(p.center.clone().addScaledVector(p.normal,1.6).setY(p.center.y-2.4).toArray());const count=g.teleportCount;for(let i=0;i<240&&g.teleportCount===count;i++){worldMove(-p.normal.x,-p.normal.z);await frame();}stop();assert.ok(g.teleportCount>count,'Actual portal crossing failed');await wait(.2);}
 try{
  await wait(.1);await pickup();
  const route={state:s,P:f.room.P,walk,dropAt,use,until,shoot,pickup,enter,mark:name=>marks.push({name,...snap()}),won:()=>g.state==='won'};
  if(heldNegative){
   await prepareCrownSpatialRoom(route);assert.equal(g.heldCube,cargo);
   await walk(s.socket);await wait(.5);assert.equal(s.loaded,false);assert.equal(s.originalLoad,null);
   await walk(s.contact);await wait(2);
   assert.equal(g.heldCube,cargo);assert.equal(g.physics.carryTarget!==null,true);assert.equal(g.playerGrounded,true);
   assert.ok(Math.hypot(g.playerPosition.x-s.contact[0],g.playerPosition.z-s.contact[2])<1.3,'The actual player must reach the live final contact');
   assert.equal(s.loaded,false);assert.equal(s.originalLoad,null);assert.equal(f.events.length,0);assert.equal(g.state,'playing');
  }else{
   await traverseCrownSpatialRoom(route);
   assert.equal(g.state,'won');assert.equal(f.events.length,1);assert.equal(f.events[0].id,'crown');
  }
  assert.deepEqual(used,['crown:sight','crown:passage']);assert.equal(counters.shots,2);
  for(const name of ['sightMotion','sightOpen','portal','passageMotion','passageOpen'])assert.ok(stamps[name]!==undefined,'Missing observed '+name);
  assert.ok(stamps.sightMotion<stamps.sightOpen&&stamps.sightOpen<stamps.portal&&stamps.portal<stamps.passageMotion&&stamps.passageMotion<stamps.passageOpen);
  assert.ok(crossedGallery,'The held original must physically cross the opened north gallery');
  assert.ok(g.teleportCount>=1&&g.physics.portalTransports>=1,'Both original actors must genuinely traverse the portal pair');
  if(heldNegative){assert.equal(stamps.load,undefined);assert.equal(stamps.won,undefined);}
  else{
   assert.ok(stamps.load!==undefined&&stamps.won!==undefined&&stamps.passageOpen<stamps.load&&stamps.load<=stamps.won);
   const proof=f.events[0].proof,w=proof.originalLoad,support=g.physics.solids.get(s.receiverMesh.uuid).body;
   assert.equal(proof.independentLoads,true);assert.equal(proof.originalCargo,true);assert.equal(proof.spatialMechanism,true);assert.equal(proof.readsAchievements,false);
   assert.equal(w.originalCargoBodyId,body.id);assert.equal(w.originalCargoShapeId,shape.id);assert.equal(w.supportBodyId,support.id);assert.equal(w.supportShapeId,support.shapes[0].id);assert.ok(w.normalForce>0&&w.contacts>0);assert.equal(w.freeOriginal,true);assert.equal(g.heldCube,null);
  }
  console.info('Isolated Crown ordinary witness',JSON.stringify({scope:'initially available isolated production room, no full-castle prerequisite claim',heldNegative,counters,closedProbe,stamps,crossedGallery,marks,bodyId:body.id,shapeId:shape.id,proof:f.events[0]?.proof??null}));
  g.resetRun=original.reset;g.respawn=original.respawn;g.physics.resetCargo=original.cargoReset;g.resetRun(true);
  assert.equal(f.events.length,0);for(const [i,r]of s.rotors.entries()){assert.equal(r.angle,0);assert.equal(r.target,0);assert.equal(r.body,initial[i].body);assert.equal(r.body.shapes[0],initial[i].shape);assert.ok(r.collider.box.equals(initial[i].bounds));}
  assert.equal(g.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
 }finally{stop();g.input.getMove=original.getMove;g.resetRun=original.reset;g.respawn=original.respawn;g.physics.resetCargo=original.cargoReset;f.level.dispose();g.physics.dispose();g.portals.dispose();}
}

test('isolated Crown ordinary closed-section attack is blocked before the shared route wins with its original free load',{timeout:300000},()=>runCrownOrdinaryCase());
test('isolated Crown ordinary held-original visits to both final contacts cannot replace a free physical socket load',{timeout:300000},()=>runCrownOrdinaryCase({heldNegative:true}));
