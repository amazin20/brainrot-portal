import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SingularityKit,V} from '../src/game/LabSingularityKit.js';
import {LabGame} from '../src/game/LabGame.js';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {LabPortals} from '../src/game/LabPortals.js';
import {buildTowerLevel} from '../src/game/LabSingularityLevel.js';

function fixture(){
 const game={scene:new THREE.Scene(),colliders:[],cameraBlockers:[],aimBlockers:[],floors:[],portalPanels:[],
  playerPosition:V(),previousPlayerPosition:V(),playerGrounded:false,portals:{ready:false},physics:new LabPhysics({gravity:0}),
  colliderForMesh:LabGame.prototype.colliderForMesh,isActiveBlocker:LabGame.prototype.isActiveBlocker};
 const kit=new SingularityKit(game);
 return {game,kit,register(){for(const c of game.colliders)game.physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:c.kinematic,enabled:c.enabled});},
  dispose(){kit.dispose();game.physics.dispose();}};
}
function rayHit(game,p,d,objects=game.aimBlockers){
 game.scene.updateMatrixWorld(true);return new THREE.Raycaster(V(...p),V(...d)).intersectObjects(objects,true).find(hit=>game.isActiveBlocker(hit.object));
}

test('An ordinary high-speed capsule cannot skip a thin wall in either direction and retains tangential movement',()=>{
 const f=fixture(),{game,kit}=f;
 try{
  kit.box([0,1.5,0],[20,3,.02]);
  for(const sign of [-1,1]){
   const previous=V(0,0,sign*2),position=V(1,0,-sign*2),velocity=V(12,0,-sign*48);
   LabGame.prototype.resolveBody.call(game,position,previous,velocity,.43,2.4);
   assert.ok(sign*position.z>.4399,'Both clear endpoints still have a wall between them');
   assert.ok(Math.abs(position.x-1)<1e-9,'A contact must preserve travel parallel to the wall');
   assert.equal(velocity.z,0);assert.equal(velocity.x,12);
  }
 }finally{f.dispose();}
});

test('Fast ordinary contacts land on thin floors and stop below thin ceilings',()=>{
 const f=fixture(),{game,kit}=f;
 try{
  kit.box([0,3,0],[8,.02,8]);
  const falling=V(0,-1,0),fallVelocity=V(0,-80,0);
  LabGame.prototype.resolveBody.call(game,falling,V(0,6,0),fallVelocity,.43,2.4);
  assert.ok(Math.abs(falling.y-3.01)<1e-8);assert.equal(fallVelocity.y,0);assert.equal(game.groundedByCollider,true);
  const rising=V(0,6,0),riseVelocity=V(0,80,0);
  LabGame.prototype.resolveBody.call(game,rising,V(0,-1,0),riseVelocity,.43,2.4);
  assert.ok(Math.abs(rising.y-.59)<1e-8);assert.equal(riseVelocity.y,0);
 }finally{f.dispose();}
});

test('Fast capsule sampling retains true drum corners and open ring centres',()=>{
 const f=fixture(),{game,kit}=f;
 try{
  kit.drum([0,1.2,0],2,2.4);
  const corner=V(1.9,0,1.9),expected=corner.clone();
  LabGame.prototype.resolveBody.call(game,corner,V(1.9,0,4),V(0,0,-48),.43,2.4);
  assert.ok(corner.distanceTo(expected)<1e-8,'A swept square must not fill the clear circular corner');
  game.colliders.length=0;kit.ring([0,1.5,0],3,kit.m.copper,{normal:[0,0,1],tube:.2});
  const aperture=V(0,0,-2),velocity=V(0,0,-48);
  LabGame.prototype.resolveBody.call(game,aperture,V(0,0,2),velocity,.43,2.4);
  assert.ok(aperture.distanceTo(V(0,0,-2))<1e-8);assert.equal(velocity.z,-48);
 }finally{f.dispose();}
});

test('A high-speed ordinary approach respects the production portal aperture and its solid shoulder',()=>{
 const f=fixture(),{game,kit}=f;
 game.portals=new LabPortals({scene:game.scene});game.portalSurfaceIds=[];game.portalOpensCollider=LabGame.prototype.portalOpensCollider;
 try{
  const wall=kit.box([0,1.2,0],[12,6,.02]);game.portalSurfaceIds[0]=wall.uuid;
  game.portals.place(0,V(0,1.2,.01),V(0,0,1));game.portals.place(1,V(10,1.2,0),V(1,0,0));
  const aperture=V(0,0,-2),velocity=V(0,0,-48);
  LabGame.prototype.resolveBody.call(game,aperture,V(0,0,2),velocity,.43,2.4,true);
  assert.ok(aperture.z<-1.99);assert.equal(velocity.z,-48);
  const shoulder=V(3,0,-2),shoulderVelocity=V(0,0,-48);
  LabGame.prototype.resolveBody.call(game,shoulder,V(3,0,2),shoulderVelocity,.43,2.4,true);
  assert.ok(shoulder.z>.4399);assert.equal(shoulderVelocity.z,0);
 }finally{game.portals.dispose();f.dispose();}
});

test('A sliding mechanism sweeps the persistent companion on every axis and ignores a disabled door',()=>{
 for(const axis of ['x','y','z'])for(const sign of [-1,1]){
  const physics=new LabPhysics({gravity:0}),bounds=at=>{
   const min={x:-3,y:-3,z:-3},max={x:3,y:3,z:3};min[axis]=at-.01;max[axis]=at+.01;return {min,max};
  };
  try{
   physics.addStaticBox('sliding-wall',bounds(-sign*2),{kinematic:true});
   const cargo=physics.createCargo({position:[0,0,0],size:.78}),id=cargo.id;
   physics.updateStaticBox('sliding-wall',bounds(sign*2),1/120);physics.step(1/120);
   assert.ok(sign*cargo.position[axis]>2.37,`A ${axis} wall must push cargo onto its leading face, not change sides through it`);
   assert.equal(physics.cargoBody.id,id);assert.ok(sign*cargo.velocity[axis]>0);assert.ok(cargo.velocity.length()<=physics.maxLinearSpeed+1e-8);
   physics.updateStaticBox('sliding-wall',bounds(-sign*2),0,false);physics.resetCargo({position:[0,0,0]});
   physics.updateStaticBox('sliding-wall',bounds(sign*2),1/120,false);physics.step(1/120);
   assert.ok(cargo.position.length()<1e-8,'A genuinely open/disabled door has no swept contact');
  }finally{physics.dispose();}
 }
});

test('A physical torus blocks its visible rim and retains a real ray and cargo aperture',()=>{
 const f=fixture(),{game,kit}=f;
 try{
  const ring=kit.ring([0,2.4,0],2,kit.m.copper,{normal:[0,0,1],tube:.24});f.register();
  assert.ok(rayHit(game,[2,2.4,3],[0,0,-1]),'A portal shot must hit the metal rim');
  assert.ok(rayHit(game,[2,2.4,3],[0,0,-1],game.cameraBlockers),'The camera must stop on the same rim');
  assert.equal(rayHit(game,[0,2.4,3],[0,0,-1]),undefined,'The opening must not be replaced by a full-disc blocker');
  const previous=V(2,1.2,1),position=V(2,1.2,.05),velocity=V(0,0,-6);
  LabGame.prototype.resolveBody.call(game,position,previous,velocity,.43,2.4);
  assert.ok(position.z>.65,'A player cannot walk through the ring tube');
  const body=game.physics.createCargo({position:[0,2.4,2],velocity:[0,0,-8],size:.78});
  for(let i=0;i<50;i++)game.physics.step(.01);
  assert.ok(body.position.z<-1,'The real rigid companion can pass through the opening');
  game.physics.resetCargo({position:[2,2.4,2],velocity:[0,0,-8]});
  for(let i=0;i<22;i++)game.physics.step(.01);
  assert.ok(body.position.z>.52,'The companion must contact the same visible rim');
  kit.enable(ring,false);assert.equal(rayHit(game,[2,2.4,3],[0,0,-1]),undefined);
  assert.ok(ring.userData.compound.parts.every(p=>game.physics.solids.get(p.proxy.uuid).body.collisionFilterMask===0));
 }finally{f.dispose();}
});

test('Round vessel collision follows its silhouette instead of blocking the empty AABB corners',()=>{
 const f=fixture(),{game,kit}=f;
 try{
  kit.drum([0,2,0],2,4);f.register();
  assert.ok(rayHit(game,[0,6,0],[0,-1,0]));
  assert.equal(rayHit(game,[1.9,6,1.9],[0,-1,0]),undefined);
  const previous=V(1.9,0,1.9),position=previous.clone(),velocity=V();
  LabGame.prototype.resolveBody.call(game,position,previous,velocity,.43,2.4);
  assert.ok(position.distanceTo(previous)<1e-10,'The circular machine has no invisible square corner');
  const inside=V(1.8,0,0);LabGame.prototype.resolveBody.call(game,inside,V(3,0,0),V(-6,0,0),.43,2.4);
  assert.ok(inside.x>2.4,'A player is stopped by the real vessel side');
 }finally{f.dispose();}
});

test('Horizontal lift rings and magnetic side rings preserve the companion aperture on every axis',()=>{
 for(const normal of [[1,0,0],[0,1,0],[0,0,1]]){
  const f=fixture(),{game,kit}=f;
  try{
   kit.ring([0,0,0],2,kit.m.violet,{normal,tube:.24});f.register();
   const direction=V(...normal),body=game.physics.createCargo({position:direction.clone().multiplyScalar(2),velocity:direction.clone().multiplyScalar(-8),size:.78});
   for(let i=0;i<50;i++)game.physics.step(.01);
   assert.ok(V(body.position.x,body.position.y,body.position.z).dot(direction)<-1,`The ${normal} ring must retain its physical opening`);
  }finally{f.dispose();}
 }
});

test('The magnetic horseshoe has a visible lower opening and real contact on its upper winding',()=>{
 const f=fixture(),{game,kit}=f;
 try{
  const coil=kit.ring([0,4.8,0],2,kit.m.cyan,{normal:[1,0,0],tube:.24,arc:Math.PI});f.register();
  assert.equal(rayHit(game,[3,2.8,0],[-1,0,0]),undefined,'The bottom gap must be empty for rays as well as cargo');
  assert.ok(rayHit(game,[3,6.8,0],[-1,0,0]),'The visible upper winding remains solid');
  const bounds=new THREE.Box3().setFromObject(coil);assert.ok(bounds.min.y>4.55,'The lower opening is part of the actual rendered geometry');
  const body=game.physics.createCargo({position:[0,.4,0],velocity:[0,8,0],size:.78});
  for(let i=0;i<65;i++)game.physics.step(.01);
  assert.ok(body.position.y>4.8,'The companion can rise from the sender through the lower opening');
  for(let i=0;i<35;i++)game.physics.step(.01);
  assert.ok(body.position.y<6.3,'The companion cannot pass through the upper winding');
 }finally{f.dispose();}
});

test('The receiver horseshoe leaves headroom for an ordinary player retrieving the companion from the upper gallery',()=>{
 const f=fixture(),{game,kit}=f;
 try{
  kit.ring([0,4.8,0],2.9,kit.m.cyan,{normal:[1,0,0],tube:.24,arc:Math.PI});
  for(let x=1;x>=-1;x-=.025){
   const previous=V(x+.025,4.2,1.407),position=V(x,4.2,1.407),velocity=V(-7,0,0);
   LabGame.prototype.resolveBody.call(game,position,previous,velocity,.43,2.4);
   assert.ok(position.distanceTo(V(x,4.2,1.407))<1e-10,'The coil must allow the complete gallery pickup approach');
   assert.equal(velocity.x,-7,'The winding must not arrest movement inside its real opening');
  }
 }finally{f.dispose();}
});

test('Rotation and scale changes sync collision even when a moving mechanism keeps the same position',()=>{
 const f=fixture(),{game,kit}=f;
 try{
  const box=kit.box([0,2,0],[4,1,.5],kit.m.steel,{dynamic:true});f.register();
  box.rotation.y=Math.PI/2;kit.move(box,[0,2,0],1/60);
  assert.ok(Math.abs(box.userData.collider.box.getSize(V()).z-4)<1e-9);
  assert.ok(Math.abs(game.physics.solids.get(box.uuid).half.z-2)<1e-9);
  box.scale.y=3;kit.syncDynamic(1/60);
  assert.ok(Math.abs(game.physics.solids.get(box.uuid).half.y-1.5)<1e-9);
  assert.ok(rayHit(game,[0,3,4],[0,0,-1]),'The changed silhouette also blocks aim rays');
 }finally{f.dispose();}
});

test('Transmission wheel blocks a traveller while pure axle spin does not rebuild its rigid contacts',()=>{
 const f=fixture(),{game,kit}=f;
 try{
  const gear=kit.gear([0,3,0],3,20);f.register();
  assert.ok(rayHit(game,[0,3,3],[0,0,-1]),'A visible gear hub is solid');
  const previous=V(0,2,1),position=V(0,2,.03),velocity=V(0,0,-7);
  LabGame.prototype.resolveBody.call(game,position,previous,velocity,.43,2.4);
  assert.ok(position.z>.59);
  let updates=0;const update=game.physics.updateStaticBox.bind(game.physics);game.physics.updateStaticBox=(...args)=>{updates++;return update(...args);};
  for(let i=0;i<120;i++){gear.rotation.z=i/120*5;kit.syncDynamic(1/120);}
  assert.equal(updates,0,'A spinning circular contact envelope needs no per-tick body reshaping');
  kit.move(gear,[4,3,0],1/60);assert.ok(updates>0);assert.ok(rayHit(game,[4,3,3],[0,0,-1]));
  assert.equal(rayHit(game,[0,3,3],[0,0,-1]),undefined,'The old gear pose must stop blocking');
 }finally{f.dispose();}
});

test('Overlapping floor junctions have one top and no coincident internal side faces',()=>{
 const f=fixture(),{kit}=f;
 try{
  kit.floor(0,4,0,4);kit.floor(2,6,1,3);kit.batch();
  const floor=kit.root.children.find(m=>m.name==='Unioned floors / no coincident tops'),p=floor.geometry.attributes.position;
  let top=0,sides=0;const a=V(),b=V(),c=V(),normal=V();
  for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);normal.crossVectors(b.clone().sub(a),c.clone().sub(a));const area=normal.length()/2;
   if(Math.abs(normal.y)>1e-9&&a.y===0)top+=area;else if(Math.abs(normal.y)<1e-9)sides+=area;
  }
  assert.ok(Math.abs(top-20)<1e-6,'The union footprint is exactly twenty square units');
  assert.ok(Math.abs(sides-8)<1e-6,'Only the union perimeter has vertical side surfaces');
  assert.equal(kit.m.floor.map,null,'The floor no longer repeats one-pixel noise and borders');
  assert.ok(kit.m.copper.roughness>=.44,'Metal highlights have enough roughness to remain stable at distance');
 }finally{f.dispose();}
});

test('Cast-in finishes preserve real gaps and protected decks without overlapping top triangles',()=>{
 const f=fixture(),{kit}=f;
 try{
  kit.floor(0,4,0,4);kit.floor(6,10,0,4);kit.floor(0,2,0,2,0,kit.m.ivory);
  kit.floorInlays.push({minX:0,maxX:10,minZ:0,maxZ:4,y:0,material:kit.m.copper,baseOnly:true});
  kit.batch();let area=0,ivory=0;const tops=[];
  for(const mesh of kit.root.children.filter(m=>m.name==='Unioned floors / no coincident tops')){
   const p=mesh.geometry.attributes.position;
   for(let i=0;i<p.count;i+=3){const a=V().fromBufferAttribute(p,i),b=V().fromBufferAttribute(p,i+1),c=V().fromBufferAttribute(p,i+2);
    const n=b.clone().sub(a).cross(c.clone().sub(a));if(n.y<=0||a.y!==0)continue;
    const size=n.length()/2;area+=size;if(mesh.material===kit.m.ivory)ivory+=size;
    assert.ok(Math.max(a.x,b.x,c.x)<=4||Math.min(a.x,b.x,c.x)>=6,'A finish cannot cover the pit');tops.push([a,b,c]);
   }
  }
  assert.equal(area,32);assert.equal(ivory,4,'A mechanically distinct deck retains its own finish');
  const ray=new THREE.Raycaster(V(5,3,2),V(0,-1,0));
  assert.equal(ray.intersectObjects(kit.root.children.filter(m=>m.name==='Unioned floors / no coincident tops')).length,0);
  assert.ok(tops.length<=8,'Paint boundaries must coalesce into broad surfaces');
 }finally{f.dispose();}
});

test('A whole-attempt restart clears operated control visuals as well as mechanism state',()=>{
 const f=fixture(),{kit}=f;let operations=0;
 try{
  const t=kit.control('test',[0,0,0],()=>{operations++;},'Operate');
  t.action();assert.equal(operations,1);assert.equal(t.screen.material,kit.m.live);assert.notEqual(t.actuator.rotation.x,0);
  kit.resetControls();assert.equal(t.screen.material,kit.m.cyan);assert.equal(t.actuator.rotation.x,0);
  assert.equal(operations,1,'Resetting presentation must not accidentally invoke the control');
 }finally{f.dispose();}
});

test('The authored inversion chamber admits grounded entry into the shaft without an accidental chest-height rim',()=>{
 const f=fixture(),{game}=f,oldDocument=globalThis.document;let level;
 try{
  globalThis.document??={};game.markPortalSurface=LabGame.prototype.markPortalSurface;
  level=buildTowerLevel(game);const room=level.rooms.get('inversion');
  // Chamber access is a fixture precondition. This checks the real authored
  // solids, independent of puzzle unlocks and the complete ordinary route.
  for(let x=10;x>=0;x-=.1){
   const p=V(...room.P(x,0)),before=V(...room.P(x+.1,0)),velocity=V(-5,0,0),expected=p.clone();
   LabGame.prototype.resolveBody.call(game,p,before,velocity,.43,2.4);
   assert.ok(p.distanceTo(expected)<1e-8,'An ordinary grounded approach must reach the inversion launch disc');
  }
 }finally{level?.dispose();f.dispose();if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});

test('The authored crown receiver has a clear firing line from the inversion return gallery',()=>{
 const f=fixture(),{game}=f,oldDocument=globalThis.document;let level;
 try{
  globalThis.document??={};game.markPortalSurface=LabGame.prototype.markPortalSurface;level=buildTowerLevel(game);
  const eye=V(...level.rooms.get('inversion').P(18.7,.25,14)).add(V(0,1.4,0)),target=level.panels.crownPortal.center.clone().add(V(0,-.4,0));
  game.scene.updateMatrixWorld(true);const ray=new THREE.Raycaster(eye,target.clone().sub(eye).normalize());
  const first=ray.intersectObjects(game.aimBlockers,true).find(h=>(h.object.visible||h.object.userData.collisionProxy)&&game.isActiveBlocker(h.object));
  assert.equal(first?.object,level.panels.crownPortal.mesh,'A supporting crown ring must not intercept the required return shot');
  assert.ok(first.point.distanceTo(target)<1e-6,'The clear ray reaches the usable front of the actual portal panel');
 }finally{level?.dispose();f.dispose();if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});
