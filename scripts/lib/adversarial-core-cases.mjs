import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabGame} from '../../src/game/LabGame.js';
import {LabPortals,orientedBoxFitsPortal,portalRotation} from '../../src/game/LabPortals.js';
import {LabPhysics} from '../../src/game/LabPhysics.js';
import {LabPreferences} from '../../src/game/LabPreferences.js';
import {LabPlayerAnimator} from '../../src/game/LabPlayerAnimator.js';

const H=1/120;
export function playerFixture({kinetic=false}={}){
 const g=new LabGame({container:null,touch:false}),move=new THREE.Vector2();
 Object.assign(g,{epicMode:kinetic,scene:new THREE.Scene(),state:'playing',move,
  playerGroup:new THREE.Group(),playerGrounded:false,firstLevel:{momentum:true},
  cameraRig:{reset(){}},audio:{jump(){},land(){},tone(){},travel(){}},
  animator:{triggerJump(){},triggerLanding(){}},
  input:{keys:new Set(),getMove:()=>move,consumeJump:()=>{const v=g.jumpQueued;g.jumpQueued=false;return v;}}});
 g.portals=new LabPortals({scene:g.scene});
 g.respawn=()=>{g.respawns=(g.respawns||0)+1;g.playerPosition.set(0,0,5);g.playerVelocity.set(0,0,0);};
 return g;
}
export function wall(g,x,y,z,w,h,d){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial());
 mesh.position.set(x,y,z);g.scene.add(mesh);mesh.updateWorldMatrix(true,false);
 g.colliders.push({mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true});return mesh;
}
export function portalPair(g){
 const backing=wall(g,0,5,0,10,10,.04);
 g.portals.place(0,new THREE.Vector3(0,5,.04),new THREE.Vector3(0,0,1));
 g.portals.place(1,new THREE.Vector3(20,5,0),new THREE.Vector3(1,0,0));
 g.portalSurfaceIds[0]=backing.uuid;
}
function advance(g,seconds,hz=120){
 let accumulator=0,steps=0;
 for(let frame=0;frame<Math.round(seconds*hz);frame++){
  accumulator+=1/hz;
  while(accumulator+1e-10>=H){g.updatePlayer(H);accumulator=Math.max(0,accumulator-H);steps++;}
 }
 return steps;
}
function finiteBody(body){assert.ok([...body.position.toArray(),...body.velocity.toArray(),...body.quaternion.toArray()].every(Number.isFinite));}
function animator(){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.25,.025,-.34,.26,.025,-.34,-.11,.01,-.2,.12,.01,-.2,0,-.25,-.52,0,.15,-.78],3));
 const visual=new THREE.Group();visual.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial()));
 return new LabPlayerAnimator({visual});
}
export const coreCases=[
 {id:'jump-windup-coyote-reuse',run(){
  const jump=secondPress=>{const g=playerFixture();try{
   g.playerGrounded=true;g.playerPosition.set(0,0,0);g.floors.push({minX:-100,maxX:100,minZ:-100,maxZ:100,y:0});let apex=0;
   for(let tick=0;tick<150;tick++){g.jumpQueued=tick===0||tick===secondPress;g.updatePlayer(H);apex=Math.max(apex,g.playerPosition.y);}
   return apex;
  }finally{g.portals.dispose();}};
  const single=jump(-1),attempts=[];
  for(const tick of [8,12,17]){const apex=jump(tick);assert.ok(Math.abs(apex-single)<1e-8,'a second press after launch must not reuse pre-launch coyote time');attempts.push({secondPressSeconds:tick*H,apex});}
  return {singleApex:single,attempts,physicsHz:120};
 }},
 {id:'ordinary-source-portal-barrier',run(){
  const g=playerFixture();try{portalPair(g);wall(g,0,5,.25,8,10,.02);
   g.playerPosition.set(0,3.8,.7);g.playerVelocity.set(0,0,-80);g.updatePlayer(H);
   assert.equal(g.teleportCount,0,'source barrier must arrest the player before a portal crossing');
   assert.ok(g.playerPosition.z>=.6899,'the complete capsule stays on the approach side');
   return {speed:80,physicsHz:120,teleports:g.teleportCount,position:g.playerPosition.toArray()};
  }finally{g.portals.dispose();}
 }},
 {id:'ordinary-destination-portal-wall',run(){
  const g=playerFixture();try{portalPair(g);wall(g,20.94,5,0,.02,10,8);
   g.playerPosition.set(0,3.8,.05);g.playerVelocity.set(0,0,-80);g.updatePlayer(H);
   assert.equal(g.teleportCount,1);assert.ok(g.playerPosition.x<=20.5001,'residual portal travel cannot enter or skip the destination wall');
   assert.ok(Math.abs(g.playerVelocity.x)<1e-8,'remove only impact-normal momentum');
   return {speed:80,physicsHz:120,position:g.playerPosition.toArray(),velocity:g.playerVelocity.toArray()};
  }finally{g.portals.dispose();}
 }},
 {id:'clear-portal-earned-momentum',run(){
  const result=[];
  for(const hz of [15,30,60,120,144]){const g=playerFixture();try{portalPair(g);g.playerPosition.set(0,3.8,.5);g.playerVelocity.set(0,0,-80);
   const steps=advance(g,1,hz);assert.equal(steps,120);assert.equal(g.teleportCount,1);assert.ok(g.playerPosition.x>95);
   assert.ok(Math.abs(g.playerVelocity.x-80)<1e-8,'clear transit preserves earned momentum');
   result.push({hz,steps,teleports:g.teleportCount,position:g.playerPosition.toArray()});
  }finally{g.portals.dispose();}}
  for(const r of result.slice(1))assert.deepEqual(r.position,result[0].position);
  return result;
 }},
 {id:'cargo-only-portal-keeps-player-floor-solid',run(){
  const setup=()=>{const g=playerFixture();
   const floor=wall(g,0,-.1,0,100,.2,100),backing=wall(g,20,5,0,.04,10,10);
   g.floors.push({minX:-50,maxX:50,minZ:-50,maxZ:50,y:0,mesh:floor});
   g.portals.place(0,new THREE.Vector3(0,.02,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),{width:2.8,height:2.1});
   g.portals.place(1,new THREE.Vector3(20.04,1.2,0),new THREE.Vector3(1,0,0),undefined,{width:.95,height:.65});
   g.portalSurfaceIds=[floor.uuid,backing.uuid];return g;
  };
  const g=setup();let minimumY=Infinity,nearestZ=Infinity;
  try{
   g.playerGrounded=true;g.playerPosition.set(0,0,2);g.input.keys.add('ShiftLeft');
   for(let tick=0;tick<480;tick++){
    g.move.set(0,tick%120<60?-1:1);g.jumpQueued=tick%24===0;g.updatePlayer(H);
    minimumY=Math.min(minimumY,g.playerPosition.y);nearestZ=Math.min(nearestZ,Math.abs(g.playerPosition.z));
    assert.equal(g.teleportCount,0,'a capsule must not enter a cargo-only destination through a large floor');assert.ok(g.playerPosition.y>=-.0001,'rejected capsule transfer keeps its floor physical');
   }
   assert.ok(nearestZ<.2,'actual sprint/jump attempts must cross the floor aperture footprint');
   const reverse=setup();try{
    reverse.playerPosition.set(20.7,0,0);reverse.playerVelocity.set(-80,0,0);reverse.updatePlayer(H);
    assert.equal(reverse.teleportCount,0,'the same cargo-only wall remains physical on a return attempt');assert.ok(reverse.playerPosition.x>20.44);
   }finally{reverse.portals.dispose();}
   const cargoGame=setup();try{
    cargoGame.physics=new LabPhysics({gravity:0});for(const c of cargoGame.colliders)cargoGame.physics.addStaticBox(c.mesh.uuid,c.box);
    cargoGame.cargo={position:new THREE.Vector3(0,.41,0),velocity:new THREE.Vector3(0,-8,0),quaternion:new THREE.Quaternion(),group:new THREE.Group()};
    const body=cargoGame.physics.createCargo({position:cargoGame.cargo.position,velocity:cargoGame.cargo.velocity}),id=body.id;
    cargoGame.companionAnimator={trigger(){}};cargoGame.playerPosition.set(1000,0,1000);cargoGame.firstLevel.cargoOnAnyPad=()=>false;cargoGame.firstLevel.getLaunch=()=>null;
    for(let i=0;i<12&&cargoGame.physics.portalTransports===0;i++)cargoGame.updateCubes(H);
    assert.equal(cargoGame.physics.portalTransports,1,'the same real free cargo must still cross its smaller outlet');assert.equal(body.id,id);assert.ok(body.position.x>20.04);
    return {minimumY,nearestZ,playerTeleports:g.teleportCount,freeCargoTransports:1};
   }finally{cargoGame.physics?.dispose();cargoGame.portals.dispose();}
  }finally{g.portals.dispose();}
 }},
 {id:'thin-wall-and-jump-spam',run(){
  const result=[];
  for(const hz of [15,30,60,120,144]){const g=playerFixture();try{wall(g,0,8,0,.02,16,20);g.playerPosition.set(-2,3,0);g.playerVelocity.set(80,7.8,11);
   g.move.set(1,-1);g.input.keys.add('ShiftLeft');g.jumpQueued=true;const steps=advance(g,.8,hz);
   assert.ok(g.playerPosition.x<=-.4399,'fast movement stays before the wall');
   assert.ok(g.playerPosition.z>0,'contact preserves motion tangent to the wall');
   result.push({hz,steps,position:g.playerPosition.toArray()});
  }finally{g.portals.dispose();}}
  return result;
 }},
 {id:'asymmetric-portal-cargo-edge-keeps-source-solid',run(){
  const g=playerFixture();try{
   const floor=wall(g,0,-.1,0,100,.2,100),backing=wall(g,20,5,0,.04,10,10);
   g.portals.place(0,new THREE.Vector3(0,.02,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),{width:2.8,height:2.1});
   g.portals.place(1,new THREE.Vector3(20.04,1.2,0),new THREE.Vector3(1,0,0),undefined,{width:.95,height:.65});g.portalSurfaceIds=[floor.uuid,backing.uuid];
   g.physics=new LabPhysics({gravity:0});for(const c of g.colliders)g.physics.addStaticBox(c.mesh.uuid,c.box);
   g.cargo={position:new THREE.Vector3(2,.41,0),velocity:new THREE.Vector3(0,-8,0),quaternion:new THREE.Quaternion(),group:new THREE.Group()};
   const body=g.physics.createCargo({position:g.cargo.position,velocity:g.cargo.velocity}),id=body.id;
   g.companionAnimator={trigger(){}};g.playerPosition.set(1000,0,1000);g.firstLevel.cargoOnAnyPad=()=>false;g.firstLevel.getLaunch=()=>null;
   let minimumY=Infinity;
   for(let i=0;i<60;i++){g.updateCubes(H);minimumY=Math.min(minimumY,body.position.y);assert.equal(g.physics.portalTransports,0,'an entry edge cannot map cargo outside the smaller destination ellipse');assert.ok(body.position.y>=.3743,'rejected cargo transfer keeps its source floor physical');}
   assert.equal(body.id,id);assert.ok(body.position.x<3);assert.ok(g.physics.solids.get(floor.uuid).body.collisionFilterMask>0);
   return {entryOffset:2,minimumY,sourcePosition:body.position.toArray(),portalTransports:0};
  }finally{g.physics?.dispose();g.portals.dispose();}
 }},
 {id:'tilted-cargo-aperture-keeps-source-solid',run(){
  const results=[];
  for(const tilted of [false,true]){
   const g=playerFixture();try{
    const floor=wall(g,0,-.1,0,100,.2,100),backing=wall(g,20,5,0,.04,10,10);
    g.portals.place(0,new THREE.Vector3(0,.02,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),{width:2.8,height:2.1});
    g.portals.place(1,new THREE.Vector3(20.04,1.2,0),new THREE.Vector3(1,0,0),undefined,{width:.95,height:.65});g.portalSurfaceIds=[floor.uuid,backing.uuid];
    const [entry,exit]=g.portals.portals,delta=portalRotation(entry,exit);
    const destinationQuaternion=tilted?new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,1,1).normalize(),new THREE.Vector3(0,1,0)):new THREE.Quaternion();
    const q=destinationQuaternion.clone().premultiply(delta.clone().invert());
    assert.equal(orientedBoxFitsPortal(entry,entry.position,q),true);
    assert.equal(orientedBoxFitsPortal(exit,exit.position,destinationQuaternion),!tilted);
    g.physics=new LabPhysics({gravity:0});for(const c of g.colliders)g.physics.addStaticBox(c.mesh.uuid,c.box);
    g.cargo={position:new THREE.Vector3(0,1,0),velocity:new THREE.Vector3(0,-8,0),quaternion:q.clone(),group:new THREE.Group()};
    const body=g.physics.createCargo({position:g.cargo.position,velocity:g.cargo.velocity,quaternion:q}),id=body.id;
    g.companionAnimator={trigger(){}};g.playerPosition.set(1000,0,1000);g.firstLevel.cargoOnAnyPad=()=>false;g.firstLevel.getLaunch=()=>null;
    let minimumY=Infinity,sourceEnabledAtFirstStep=false;
    for(let tick=0;tick<(tilted?12:30)&&g.physics.portalTransports===0;tick++){
     g.updateCubes(H);minimumY=Math.min(minimumY,body.position.y);
     if(tick===0)sourceEnabledAtFirstStep=g.physics.solids.get(floor.uuid).body.collisionFilterMask!==0;
    }
    assert.equal(body.id,id,'aperture admission must preserve the original rigid body');
    if(tilted){
     assert.ok(sourceEnabledAtFirstStep,'an unfit destination must keep the source backing physical before simulation');
     assert.equal(g.physics.portalTransports,0,'a centred body diagonal must not warp corners through the short destination');
     assert.ok(minimumY>.35,'the rejected original cargo must remain supported by its real source floor');
    }else{
     assert.equal(g.physics.portalTransports,1,'the upright original shape remains a valid cargo transfer');
     assert.ok(body.position.x>exit.position.x);
    }
    results.push({tilted,initialExitVerticalExtent:tilted?.39*Math.sqrt(3):.39,apertureHalfHeight:.65,
     sourceEnabledAtFirstStep,minimumY,portalTransports:g.physics.portalTransports,position:body.position.toArray(),bodyId:id});
   }finally{g.physics?.dispose();g.portals.dispose();}
  }
  return results;
 }},
 {id:'rotating-cargo-rejected-crossing-keeps-source-solid',run(){
  const results=[];
  for(const inclinationDegrees of [0,30,60]){
   const g=playerFixture();try{
   const source=wall(g,0,5,0,10,10,.04),destination=wall(g,20,5,0,.04,10,10);
   const sourceQuaternion=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),inclinationDegrees*Math.PI/180);
   const normal=new THREE.Vector3(0,0,1).applyQuaternion(sourceQuaternion);
   source.quaternion.copy(sourceQuaternion);source.updateWorldMatrix(true,false);g.colliderForMesh(source).box.setFromObject(source);
   g.portals.place(0,source.position.clone().addScaledVector(normal,.04),normal,undefined,{width:2.8,height:2.1});
   g.portals.place(1,new THREE.Vector3(20.04,5,0),new THREE.Vector3(1,0,0),undefined,{width:.95,height:.65});g.portalSurfaceIds=[source.uuid,destination.uuid];
   const [entry,exit]=g.portals.portals,delta=portalRotation(entry,exit),axis=new THREE.Vector3(-1,0,1).normalize();
   const mappedQuaternion=new THREE.Quaternion().setFromAxisAngle(axis,35.7*Math.PI/180);
   const q=mappedQuaternion.clone().premultiply(delta.clone().invert());
   const angularVelocity=axis.clone().applyQuaternion(delta.clone().invert()).multiplyScalar(18);
   assert.equal(orientedBoxFitsPortal(exit,exit.position,mappedQuaternion),true,'the pre-step shape really fits');
   g.physics=new LabPhysics({gravity:0});
   // Authored inclined backing uses a true oriented Cannon box; its render
   // collider is the corresponding world AABB, not a larger physical box.
   const sourceBody=g.physics.addStaticBox(source.uuid,{min:[-5,0,-.02],max:[5,10,.02]});
   sourceBody.quaternion.copy(sourceQuaternion);sourceBody.previousQuaternion.copy(sourceBody.quaternion);sourceBody.aabbNeedsUpdate=true;
   g.physics.addStaticBox(destination.uuid,g.colliderForMesh(destination).box);
   g.cargo={position:entry.position.clone().addScaledVector(entry.normal,.08),velocity:entry.normal.clone().multiplyScalar(-22),quaternion:q.clone(),group:new THREE.Group()};
   const body=g.physics.createCargo({position:g.cargo.position,velocity:g.cargo.velocity,quaternion:q,angularVelocity}),id=body.id;
   g.companionAnimator={trigger(){}};g.playerPosition.set(1000,0,1000);g.firstLevel.cargoOnAnyPad=()=>false;g.firstLevel.getLaunch=()=>null;
   const trace=[];for(let tick=0;tick<30;tick++){
    g.updateCubes(H);finiteBody(body);assert.equal(body.id,id);assert.equal(g.physics.portalTransports,0);
    const signedDistance=new THREE.Vector3().copy(body.position).sub(entry.position).dot(entry.normal);
    assert.ok(signedDistance>0,`a rotating box cannot escape through its temporarily opened ${inclinationDegrees} degree source backing`);
    if(tick===0)assert.ok(body.angularVelocity.length()>17.8,'the rejection contact retains acquired spin apart from ordinary damping');
    if(tick<4)trace.push({tick,position:body.position.toArray(),velocity:body.velocity.toArray(),angularVelocity:body.angularVelocity.toArray(),signedDistance,sourceMask:g.physics.solids.get(source.uuid).body.collisionFilterMask});
   }
   results.push({inclinationDegrees,initialMappedAngleDegrees:35.7,angularSpeed:18,linearSpeed:22,physicsHz:120,portalTransports:0,trace,position:body.position.toArray()});
   }finally{g.physics?.dispose();g.portals.dispose();}
  }
  return results;
 }},
 {id:'lateral-cargo-rejected-crossing-keeps-source-solid',run(){
  const g=playerFixture();try{
   const source=wall(g,0,5,0,10,10,.04),destination=wall(g,20,5,0,.04,10,10);
   g.portals.place(0,new THREE.Vector3(0,5,.04),new THREE.Vector3(0,0,1),undefined,{width:2.8,height:2.1});
   g.portals.place(1,new THREE.Vector3(20.04,5,0),new THREE.Vector3(1,0,0),undefined,{width:.95,height:.65});g.portalSurfaceIds=[source.uuid,destination.uuid];
   const [entry,exit]=g.portals.portals,delta=portalRotation(entry,exit),q=delta.clone().invert();
   const tangent=new THREE.Vector3(0,1,0).applyQuaternion(delta.clone().invert());
   const start=entry.position.clone().addScaledVector(tangent,.15).addScaledVector(entry.normal,.025);
   const mapped=exit.position.clone().add(new THREE.Vector3(0,.15,0));
   assert.equal(orientedBoxFitsPortal(exit,mapped,new THREE.Quaternion()),true,'the initial offset footprint genuinely fits');
   g.physics=new LabPhysics({gravity:0});for(const c of g.colliders)g.physics.addStaticBox(c.mesh.uuid,c.box);
   g.cargo={position:start,velocity:tangent.clone().multiplyScalar(80).addScaledVector(entry.normal,-22),quaternion:q.clone(),group:new THREE.Group()};
   const body=g.physics.createCargo({position:g.cargo.position,velocity:g.cargo.velocity,quaternion:q}),id=body.id;
   g.companionAnimator={trigger(){}};g.playerPosition.set(1000,0,1000);g.firstLevel.cargoOnAnyPad=()=>false;g.firstLevel.getLaunch=()=>null;
   g.updateCubes(H);
   const signedDistance=new THREE.Vector3().copy(body.position).sub(entry.position).dot(entry.normal);
   const tangentSpeed=new THREE.Vector3().copy(body.velocity).dot(tangent);
   assert.equal(g.physics.portalTransports,0,'the lateral motion must invalidate the actual narrow outlet footprint at TOI');
   assert.equal(body.id,id);assert.ok(signedDistance>=.3919,'a rejected crossing keeps the entire original box in front of its source backing');
   assert.ok(tangentSpeed>20,'source-plane contact retains the speed tangent to that plane');
   assert.ok(Math.abs(new THREE.Vector3().copy(body.velocity).dot(entry.normal))<1e-10);
   assert.ok(g.physics.solids.get(source.uuid).body.collisionFilterMask>0);
   return {initialTangentSpeed:80,initialNormalSpeed:22,productionSpeedLimit:g.physics.maxLinearSpeed,
    tangentSpeed,signedDistance,portalTransports:0,position:body.position.toArray(),velocity:body.velocity.toArray(),physicsHz:120};
  }finally{g.physics?.dispose();g.portals.dispose();}
 }},
 {id:'portal-replacement-and-backside',run(){
  const g=playerFixture();try{portalPair(g);g.playerPosition.set(0,3.8,-.5);g.playerVelocity.set(0,0,-80);g.updatePlayer(H);
   assert.equal(g.teleportCount,0,'an actor already behind a portal cannot create a crossing');
   for(let i=0;i<240;i++){
    g.portals.place(1,new THREE.Vector3(20+(i%3)*.2,5,0),new THREE.Vector3(1,0,0));
    g.portals.beginPhysicsStep();g.updatePlayer(H);g.portals.endPhysicsStep();
    assert.equal(g.teleportCount,0,'replacing a remote portal does not move an unrelated actor');
   }
   return {replacements:240,teleports:g.teleportCount};
  }finally{g.portals.dispose();}
 }},
 {id:'cargo-carry-release-corner-spam',run(){
  const result=[];
  for(const hz of [15,30,60,120,144]){
   const p=new LabPhysics();try{p.addStaticBox('floor',{min:[-12,-1,-12],max:[12,0,12]});p.addStaticBox('wall',{min:[0,0,-8],max:[.02,8,8]});
    const b=p.createCargo({position:[-1.3,1.1,0]}),id=b.id;let maxX=-Infinity,maxSpeed=0;
    for(let frame=0;frame<hz*2;frame++){
     const angle=frame*.41,q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle);
     p.setCarryTarget([1.3,1.1,Math.sin(angle)*.4],{quaternion:q,dt:1/hz});if(frame%5===4)p.release({velocity:[90,0,0]});p.step(1/hz);
     finiteBody(b);maxX=Math.max(maxX,b.position.x);maxSpeed=Math.max(maxSpeed,b.velocity.length());assert.equal(b.id,id);
    }
    assert.ok(maxX<-.3,'rapid grip rotation/release cannot pull cargo through a wall');
    assert.ok(maxSpeed<=p.maxLinearSpeed+1e-8,'release cannot accumulate explosive speed');
    assert.ok(b.position.y>.3,'cargo respects its supporting floor');result.push({hz,maxX,maxSpeed,id});
   }finally{p.dispose();}
  }return result;
 }},
 {id:'moving-door-through-cargo',run(){
  const result=[];
  for(const destination of [.5,1,4]){
   const p=new LabPhysics({gravity:0});try{
    const bounds=x=>({min:[x-.01,-2,-2],max:[x+.01,2,2]});
    p.addStaticBox('door',bounds(-1),{kinematic:true});const b=p.createCargo({position:[0,0,0]});
    p.updateStaticBox('door',bounds(destination),H);p.step(H);finiteBody(b);
    assert.ok(b.position.x>=destination+.37,'the moving thin leaf cannot cross the cargo between endpoints');
    assert.ok(b.velocity.length()<=p.maxLinearSpeed+1e-8);result.push({distance:destination+1,position:b.position.toArray(),sweptContacts:p.sweptContacts||0});
   }finally{p.dispose();}
  }return result;
 }},
 {id:'cargo-transit-rotated-corners',run(){
  const results=[];
  for(const angle of [0,Math.PI/6,Math.PI/4,Math.PI/3,Math.PI/2]){
   const p=new LabPhysics({gravity:0});try{
    p.addStaticBox('destination-wall',{min:[20.93,0,-5],max:[20.95,10,5]});
    p.addStaticBox('exit-backing',{min:[19.9,0,-5],max:[20,10,5]});
    const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle);
    const b=p.createCargo({position:[0,5,.05],quaternion:q,velocity:[0,2,-22],angularVelocity:[1,0,0]}),id=b.id;
    const delta=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2);
    const destinationQ=q.clone().premultiply(delta),normal=new THREE.Vector3(1,0,0).applyQuaternion(destinationQ.clone().invert());
    const extent=.39*(Math.abs(normal.x)+Math.abs(normal.y)+Math.abs(normal.z));
    const start={x:20+extent+.07,y:5,z:0};
    p.teleportCargo({position:start,rotation:delta});
    const angular=b.angularVelocity.clone(),beforeY=b.velocity.y;
    const result=p.resolveCargoTransit(start,{ignoreIds:['exit-backing']});
    assert.ok(b.position.x+result.extent.x<=20.930001,'all rotated corners stay before the destination wall on the transfer tick');
    assert.equal(b.id,id);assert.equal(p.portalTransports,1);assert.equal(b.velocity.y,beforeY);assert.deepEqual(b.angularVelocity,angular);
    assert.deepEqual(p.sample(0).position,p.sample(1).position,'no interpolated trail through the wall');
    if(angle!==0&&angle!==Math.PI/2)assert.equal(b.velocity.x,0);
    results.push({angle,contacts:result.contacts,position:b.position.toArray(),extent:result.extent.toArray()});
   }finally{p.dispose();}
  }return results;
 }},
 {id:'free-cargo-portal-corner-transit',run(){
  const results=[];
  for(const angle of [0,Math.PI/4]){
   const g=playerFixture();try{
    portalPair(g);const obstacle=wall(g,20.94,5,0,.02,10,8);
    g.physics=new LabPhysics({gravity:0});for(const c of g.colliders)g.physics.addStaticBox(c.mesh.uuid,c.box);
    const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle);
    g.cargo={position:new THREE.Vector3(0,5,.05),velocity:new THREE.Vector3(0,0,-22),quaternion:q,group:new THREE.Group()};
    const body=g.physics.createCargo({position:g.cargo.position,velocity:g.cargo.velocity,quaternion:q}),id=body.id;
    g.companionAnimator={trigger(){}};g.playerPosition.set(100,0,100);g.firstLevel.cargoOnAnyPad=()=>false;g.firstLevel.getLaunch=()=>null;
    g.updateCubes(H);
    const localNormal=new THREE.Vector3(1,0,0).applyQuaternion(g.cargo.quaternion.clone().invert());
    const extent=.39*(Math.abs(localNormal.x)+Math.abs(localNormal.y)+Math.abs(localNormal.z));
    assert.equal(g.physics.portalTransports,1);assert.equal(g.physics.cargoBody.id,id);
    assert.ok(g.cargo.position.x+extent<=g.colliderForMesh(obstacle).box.min.x+1e-5,'production updateCubes must resolve rotated corners on the portal tick');
    assert.deepEqual(g.cargo.position.toArray(),body.position.toArray(),'game cargo pose must match the corrected persistent body');
    results.push({angle,position:g.cargo.position.toArray(),extent,portalTransports:g.physics.portalTransports});
   }finally{g.physics?.dispose();g.portals.dispose();}
  }return results;
 }},
 {id:'preferences-exclude-puzzle-state',run(){
  const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
  const p=new LabPreferences(storage);p.save({resumeLevel:40,solvedIds:['everything'],checkpoints:true,playerPosition:[100,100,100],heldCube:true});
  const reloaded=new LabPreferences(storage);assert.equal(reloaded.value.resumeLevel,40);
  for(const k of ['solvedIds','checkpoints','playerPosition','heldCube'])assert.equal(k in reloaded.value,false,'save reload must not smuggle a live puzzle checkpoint');
  return {savedFields:Object.keys(reloaded.value),resumeLevel:40};
 }},
 {id:'authored-dynamic-mechanism-impulses',async run(){
  const {createHeadlessGame}=await import('../lab-headless.mjs');
  const g=await createHeadlessGame();g.chamberEdition='foundation';try{
   await g.selectLevel(35,false);const rotor=g.firstLevel.rotor;assert.ok(rotor,'the production angular room must expose its real mechanism');rotor.ensure();
   const p=g.physics,b=rotor.body,c=p.cargoBody,id=c.id;
   assert.ok(![...p.solids.values()].some(s=>s.body===b),'rotor must not have a duplicate static swept guard');
   // This exposed arm is clear of the gallery's real support column.
   p.world.gravity.setZero();p.resetCargo({position:[b.position.x-3.3,b.position.y,b.position.z-3],velocity:[0,0,22]});
   const from=c.position.clone();p.resolveCargoTransit(from);
   assert.equal(c.velocity.z,22,'portal residual correction must leave a dynamic impact lane open');
   let peakOmega=0,contacts=0;
   for(let i=0;i<90;i++){p.step(H);contacts+=p.world.contacts.filter(contact=>contact.bi===b||contact.bj===b).length;peakOmega=Math.max(peakOmega,Math.abs(b.angularVelocity.y));g.firstLevel.update(H);}
   assert.ok(contacts>0,'actual cargo must contact the actual authored dynamic rotor');assert.ok(peakOmega>.1,'contact must transfer angular momentum');assert.equal(c.id,id);
   const angular={contacts,peakOmega,retainedAngle:rotor.angle,cargoId:id};
   await g.selectLevel(8,false);const piston=g.firstLevel.state.piston;piston.ensure();
   assert.ok(![...g.physics.solids.values()].some(s=>s.body===piston.body),'guided piston stays a dynamic contact body');
   g.physics.resetCargo({position:[0,piston.restY+6.35,-5]});g.cargo.position.copy(g.physics.cargoBody.position);g.cargo.velocity.set(0,0,0);g.cargo.quaternion.identity();
   const pistonCargoId=g.physics.cargoBody.id;let peakCompression=0;
   for(let i=0;i<480;i++){g.updatePlaying(H);peakCompression=Math.max(peakCompression,piston.compression);}
   assert.ok(piston.latched,'a real falling impulse must still compress and latch the authored spring');assert.ok(peakCompression>.68);assert.equal(g.physics.cargoBody.id,pistonCargoId);
   return {angular,piston:{peakCompression,latched:piston.latched,cargoId:pistonCargoId}};
  }finally{g.firstLevel?.dispose?.();g.physics?.dispose();g.portals.dispose();}
 }},
 {id:'player-animation-at-15-fps',run(){
  const result=[];
  for(const hz of [15,30,60,120]){
   const a=animator();a.triggerInteraction('pickup');
   for(let frame=0;frame<hz*2;frame++)a.update({dt:1/hz,elapsed:(frame+1)/hz,speed:4.2,grounded:true,velocity:new THREE.Vector3(0,0,4.2)});
   result.push({hz,elapsed:a.elapsed,gait:a.gait,recoil:a.recoil,moveBlend:a.moveBlend,bones:Object.fromEntries(Object.entries(a.bones).map(([k,b])=>[k,b.quaternion.toArray()]))});
  }
  const baseline=result[2];
  for(const r of result){assert.ok(Math.abs(r.gait-baseline.gait)<1e-8,'low FPS must not lose gait distance');assert.ok(Math.abs(r.moveBlend-baseline.moveBlend)<1e-8);
   for(const [name,q]of Object.entries(r.bones))assert.ok(new THREE.Quaternion().fromArray(q).angleTo(new THREE.Quaternion().fromArray(baseline.bones[name]))<1e-6,'low FPS pose drift: '+name);}
  return result.map(({bones,...r})=>r);
 }},
];

export async function runCoreCases(){
 const results=[];
 for(const c of coreCases){const start=performance.now();try{results.push({id:c.id,pass:true,evidence:await c.run(),milliseconds:performance.now()-start});}catch(error){results.push({id:c.id,pass:false,error:String(error),milliseconds:performance.now()-start});}}
 return {scope:'Isolated production controller/physics/animator stress fixtures. Initial poses and 80 m/s impulses are explicit test inputs; this does not claim an authored level walkthrough or universal absence of shortcuts.',physicsHz:120,pass:results.every(r=>r.pass),results};
}
