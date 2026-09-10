import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body,Sphere,World,Vec3} from 'cannon-es';
import {V} from '../src/game/LabPuzzleMechanics.js';
import {makePortalFrame} from '../src/game/LabPortals.js';
import {buildTransferFunnel} from '../src/game/LabTransferFunnel.js';

function fixture(options={}){
 const game={colliders:[],portals:{ready:false,portals:[]}},root=new THREE.Group();
 const world={root,materials:{trim:new THREE.MeshStandardMaterial({color:0x28353a})},
  box(position,size,material,solid=true,parent=root){
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.fromArray(position);parent.add(mesh);
   mesh.updateWorldMatrix(true,true);if(solid)game.colliders.push({mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true});return mesh;
  }};
 const kit={game,world,ticks:[],renders:[],resets:[]};
 return {game,kit,field:buildTransferFunnel(kit,{origin:V(0,1,0),direction:V(1,0,0),...options})};
}

test('funnel suspends a real dynamic body, accelerates gradually and reverses without snapping',()=>{
 const {field}=fixture();
 const physics=new World({gravity:new Vec3(0,-19.5,0)});
 const body=new Body({mass:3,shape:new Sphere(.4),position:new Vec3(10,1.65,.7),velocity:new Vec3(0,.5,.4),linearDamping:0});physics.addBody(body);
 const step=n=>{for(let i=0;i<n;i++){
  const acceleration=field.acceleration(V().copy(body.position),V().copy(body.velocity),.4);
  body.force.vadd(new Vec3(acceleration.x*body.mass,acceleration.y*body.mass,acceleration.z*body.mass),body.force);physics.step(1/120);
 }};
 step(1);assert.ok(body.velocity.x>0&&body.velocity.x<1,'A field must not assign terminal speed on entry');
 step(239);
 assert.ok(body.position.x>20,'The ordinary rigid body did not travel through the field');
 assert.ok(Math.abs(body.position.y-1)<.03&&Math.abs(body.position.z)<.03,'Radial force did not centre the suspended body');
 assert.ok(Math.abs(body.velocity.x-7)<.01);
 const beforePosition=body.position.clone(),beforeVelocity=body.velocity.clone();field.reversed=true;field.update(1/120);
 assert.deepEqual(body.position,beforePosition);assert.deepEqual(body.velocity,beforeVelocity);
 step(1);assert.ok(body.velocity.x>0&&body.velocity.x<beforeVelocity.x,'Reversing must brake before turning the body around');
 step(239);assert.ok(body.velocity.x< -6.9);assert.ok(body.position.x<beforePosition.x-8);
 assert.ok(Math.abs(body.position.y-1)<.03);
});

test('ordinary 2.8 m/s² air steering can leave the softer player suspension while cargo remains centred',()=>{
 for(const sign of [-1,1]){
  const {field}=fixture(),physics=new World({gravity:new Vec3(0,-19.5,0)});
  const player=new Body({mass:1,shape:new Sphere(.45),position:new Vec3(10,1,0),velocity:new Vec3(7,0,0),linearDamping:0});
  const cargo=new Body({mass:3,shape:new Sphere(.4),position:new Vec3(5,1,.3),linearDamping:0});
  physics.addBody(player);physics.addBody(cargo);let leftAt=null;
  for(let step=0;step<360;step++){
   // Production airborne steering adds acceleration before sampling the field.
   player.velocity.z+=sign*2.8/120;
   for(const body of [player,cargo]){
    const a=field.acceleration(V().copy(body.position),V().copy(body.velocity),body===player?.45:.4,
     body===player?{centering:.8,damping:2}:undefined);
    body.force.vadd(new Vec3(a.x*body.mass,a.y*body.mass,a.z*body.mass),body.force);
   }
   physics.step(1/120);
   if(leftAt===null&&Math.abs(player.position.z)>field.radius-.45)leftAt=(step+1)/120;
  }
  assert.ok(leftAt!==null&&leftAt>1&&leftAt<3,`Uncontrollable tube: player exited after ${leftAt}s`);
  assert.ok(Math.abs(player.position.z)>field.radius-.45);
  assert.ok(player.position.y<.8,'Leaving the stream must restore ordinary gravity');
  assert.ok(Math.abs(cargo.position.z)<.01&&Math.abs(cargo.position.y-1)<.01,'Player steering must not weaken free-cargo suspension');
 }
});

test('air routing stops at glass and does not affect bodies beyond its visible end',()=>{
 const {field,game}=fixture();
 const shutter={box:new THREE.Box3(V(4,-3,-3),V(4.3,5,3)),enabled:true,opticallyTransparent:true};game.colliders.push(shutter);field.update(0);
 assert.equal(field.segments[0].kind,'wall');assert.equal(field.segments[0].length,4);
 assert.ok(field.acceleration(V(3,1,0),V()).x>0);
 assert.equal(field.acceleration(V(5,1,0),V()).lengthSq(),0);
 assert.equal(field.acceleration(V(-.05,1,0),V()).lengthSq(),0);
 shutter.enabled=false;field.update(0);assert.ok(field.acceleration(V(5,1,0),V()).x>0);
});

test('field routes and reverses through actual portal frames and reacts to portal replacement',()=>{
 const {field,game}=fixture();
 game.colliders.push({box:new THREE.Box3(V(6,-2,-3),V(6.2,4,3)),enabled:true});
 game.portals.ready=true;game.portals.portals=[makePortalFrame(V(5.99,1,0),V(-1,0,0)),makePortalFrame(V(-4,6,12),V(0,1,0))];
 field.update(0);
 assert.equal(field.segments.length,2);assert.equal(field.segments[0].kind,'portal');assert.ok(field.segments[1].direction.y>.9999);
 const ascent=field.acceleration(V(-4,9,12),V(),.4);assert.ok(ascent.y>19.5);assert.ok(Math.abs(ascent.x)<1e-8);
 field.reversed=true;field.update(0);assert.ok(field.acceleration(V(-4,9,12),V(),.4).y<0);
 assert.ok(field.acceleration(V(3,1,0),V(),.4).x<0);
 game.portals.portals[1]=makePortalFrame(V(-9,3,7),V(0,0,1));field.update(0);
 assert.equal(field.acceleration(V(-4,9,12),V(),.4).lengthSq(),0);
 assert.ok(field.acceleration(V(-9,3,10),V(),.4).z<0);
 game.portals.ready=false;field.update(0);assert.equal(field.segments.length,1);
 assert.equal(field.acceleration(V(-9,3,10),V(),.4).lengthSq(),0);
});

test('funnel respects its radius, body clearance and a thin wall parallel to its axis',()=>{
 const {field,game}=fixture();
 assert.equal(field.acceleration(V(2,1,2.11),V()).lengthSq(),0);
 assert.equal(field.acceleration(V(2,1,1.8),V(),.4).lengthSq(),0);
 assert.ok(field.acceleration(V(2,1,1),V(),.4).z<0);
 game.colliders.push({enabled:true,box:new THREE.Box3(V(1,-2,.4),V(8,4,.55)),opticallyTransparent:true});field.update(0);
 assert.ok(field.acceleration(V(2,1,.2),V(),.2).x>0);
 assert.equal(field.acceleration(V(2,1,.8),V(),.2).lengthSq(),0,'Parallel glass cannot transmit radial attraction');
 assert.equal(field.acceleration(V(2,1,.48),V(),.2).lengthSq(),0,'No force can originate inside a solid wall');
 const p=V(2,1,.1),v=V(15,0,0),copyP=p.clone(),copyV=v.clone();
 assert.ok(field.acceleration(p,v).x<0,'The field brakes excess momentum');assert.deepEqual(p,copyP);assert.deepEqual(v,copyV);
});

test('visible tube and workshop lifecycle use the same traced segments and shut down together',()=>{
 const {field,kit}=fixture();assert.equal(kit.ticks.length,1);assert.equal(kit.renders.length,1);assert.equal(kit.resets.length,1);
 const first=field.root.children[0];assert.equal(first.visible,true);
 const before=first.children[1].rotation.y;kit.ticks[0](.2);assert.notEqual(first.children[1].rotation.y,before);
 assert.equal(first.children[0].scale.y,field.segments[0].length);
 field.enabled=false;kit.ticks[0](1/120);assert.equal(field.root.visible,false);assert.deepEqual(field.segments,[]);
 assert.equal(field.acceleration(V(2,1,0),V()).lengthSq(),0);
 field.reversed=true;kit.resets[0]();assert.equal(field.enabled,true);assert.equal(field.reversed,false);assert.equal(field.root.visible,true);
 const particles=field.root.children.find(o=>o.isInstancedMesh);assert.equal(particles.count,180);
 const matrix=new THREE.Matrix4(),position=V();
 for(let i=0;i<particles.count;i++){
  particles.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);
  assert.ok(position.x>=0&&position.x<=100);
  assert.ok(Math.hypot(position.y-1,position.z)<field.radius);
 }
});
