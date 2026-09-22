import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabGame} from '../src/game/LabGame.js';
import {LabPortals,makePortalFrame,pointInsidePortal,portalIntersectsBox,portalBacksCollider} from '../src/game/LabPortals.js';
import {LabPhysics,sampleRampSurface} from '../src/game/LabPhysics.js';
import {sweepRampContact} from '../src/game/LabRampContact.js';
import {warmPortalPipeline} from '../src/game/LabRenderWarmup.js';
const V=(...v)=>new THREE.Vector3(...v);
function fixture(epic=true){
 const g=new LabGame({container:null,touch:false}),move=new THREE.Vector2();
 Object.assign(g,{epicMode:epic,scene:new THREE.Scene(),state:'playing',move,playerGroup:new THREE.Group(),playerGrounded:true,
  firstLevel:{momentum:false},cameraRig:{reset(){}},audio:{jump(){},land(){},tone(){},travel(){}},animator:{triggerJump(){},triggerLanding(){}},
  input:{keys:new Set(),getMove:()=>move,consumeJump:()=>{const j=g.jumpQueued;g.jumpQueued=false;return j;}}});
 g.portals=new LabPortals({scene:g.scene});g.respawn=()=>{throw Error('Unexpected respawn');};return g;
}
const ramp={minX:-6,maxX:6,minZ:-44,maxZ:16,lowY:8,highY:31,highAt:'minZ'};
function advance(g,t,hz=120,inspect=()=>{}){for(let i=0;i<t*hz;i++){g.updatePlayer(1/hz);inspect(g,i);}}
function box(g,lo,hi){const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());const c={mesh,box:new THREE.Box3(V(...lo),V(...hi)),enabled:true};g.colliders.push(c);return c;}
for(const epic of [false,true])for(const hz of [30,60,120,240]){
 test(`uphill jump lands on the inclined plane while rising: kinetic=${epic}, ${hz} Hz`,()=>{
  const g=fixture(epic);g.ramps.push({...ramp});g.playerPosition.set(0,sampleRampSurface(ramp,-8).height,-8);g.playerVelocity.set(0,0,-15);g.move.set(0,-1);g.input.keys.add('ShiftLeft');g.jumpQueued=true;
  let leftGround=false,landed=false,min=Infinity;
  advance(g,3,hz,()=>{leftGround ||= !g.playerGrounded;landed ||= leftGround&&g.playerGrounded;if(g.playerPosition.z>ramp.minZ&&g.playerPosition.z<ramp.maxZ)min=Math.min(min,g.playerPosition.y-sampleRampSurface(ramp,g.playerPosition.z).height);});
  assert.ok(leftGround);assert.ok(landed);assert.ok(min>=-.001,`below visible slope: ${min}`);g.portals.dispose();
 });
}
test('walking uphill joins a same-height flat landing instead of hitting its vertical edge',()=>{
 const g=fixture();g.ramps.push({...ramp});g.playerPosition.set(0,sampleRampSurface(ramp,-40).height,-40);g.move.set(0,-1);box(g,[-6,30.4,-56],[6,31,-44]);g.floors.push({minX:-6,maxX:6,minZ:-56,maxZ:-44,y:31});advance(g,1.5);
 assert.ok(g.playerPosition.z < -46);assert.ok(g.playerPosition.y>=30.99);g.portals.dispose();
});
test('ramp side, underside and descending airborne entry are solid; empty space remains empty',()=>{
 const r={minX:-3,maxX:3,minZ:0,maxZ:10,lowY:0,highY:5,highAt:'maxZ'};
 assert.equal(sweepRampContact(r,V(-5,1,8),V(0,1,8),.43,2.4)?.kind,'ramp-side');
 assert.equal(sweepRampContact(r,V(0,-4,8),V(0,0,8),.43,2.4)?.kind,'ramp-underside');
 assert.equal(sweepRampContact(r,V(0,9,8),V(0,2,8),.43,2.4)?.kind,'ramp-top');
 assert.equal(sweepRampContact(r,V(-5,9,8),V(0,9,8),.43,2.4),null);
 // A body below the ramp is not teleported to its upper surface.
 assert.equal(sweepRampContact(r,V(0,-4,8),V(0,-4,9),.43,2.4),null);
});
test('grounded downhill follows the support; jump still detaches from it',()=>{
 const g=fixture();g.ramps.push({...ramp});g.playerPosition.set(0,sampleRampSurface(ramp,-8).height,-8);g.yaw=Math.PI;g.move.set(0,-1);advance(g,.4);assert.equal(g.playerGrounded,true);assert.ok(Math.abs(g.playerPosition.y-sampleRampSurface(ramp,g.playerPosition.z).height)<.002);
 g.jumpQueued=true;advance(g,.15);assert.equal(g.playerGrounded,false);assert.ok(g.playerPosition.y>sampleRampSurface(ramp,g.playerPosition.z).height+.8);g.portals.dispose();
});
test('an explicit supporting hull opens only inside its aperture; an unrelated floor underneath does not',()=>{
 const g=fixture(false),support=box(g,[-6,-2.5,-6],[6,-.58,6]),other=box(g,[-6,-3.5,-6],[6,-3,6]);
 g.portals.place(0,V(0,.18,0),V(0,1,0));g.portals.place(1,V(20,4,0),V(0,0,1));g.portals.portals[0].backingIds=[support.mesh.uuid];
 assert.equal(g.portalOpensCollider(support,V(0,0,0),.43),true);
 assert.equal(g.portalOpensCollider(support,V(4,0,0),.43),false);
 assert.equal(g.portalOpensCollider(other,V(0,0,0),.43),false);g.portals.dispose();
});
test('8,000 rotated aperture/backing predicates preserve the prior eight-corner equations',()=>{
 let seed=7531;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32),rnd=(a,b)=>a+(b-a)*rand();
 for(let i=0;i<8000;i++){
  const f=makePortalFrame(V(rnd(-20,20),rnd(-20,20),rnd(-20,20)),V(rnd(-1,1),rnd(-1,1),rnd(-1,1)),V(rnd(-1,1),rnd(-1,1),rnd(-1,1)));
  const p=f.position.clone().add(V(rnd(-3,3),rnd(-3,3),rnd(-3,3))),r=rnd(0,.8),local=p.clone().sub(f.position).applyQuaternion(f.quaternion.clone().invert());
  assert.equal(pointInsidePortal(f,p,r),f.width>r&&f.height>r&&(local.x/(f.width-r))**2+(local.y/(f.height-r))**2<=1);
  const b=new THREE.Box3().setFromCenterAndSize(p,V(rnd(.01,6),rnd(.01,6),rnd(.01,6))),inv=f.quaternion.clone().invert(),corners=[];
  for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])corners.push(V(x,y,z).sub(f.position).applyQuaternion(inv));
  const lb=new THREE.Box3().setFromPoints(corners),px=V(1,0,0).applyQuaternion(f.quaternion),py=V(0,1,0).applyQuaternion(f.quaternion);
  let overlaps=true;for(const axis of ['x','y','z']){const c=f.position[axis]+f.normal[axis]*(-.31),e=Math.hypot(f.width*px[axis],f.height*py[axis])+Math.abs(f.normal[axis])*.39;if(c+e<b.min[axis]||c-e>b.max[axis])overlaps=false;}
  const clamp=THREE.MathUtils.clamp;overlaps &&= lb.max.z>=-.7&&lb.min.z<=.08&&(clamp(0,lb.min.x,lb.max.x)/f.width)**2+(clamp(0,lb.min.y,lb.max.y)/f.height)**2<=1;
  assert.equal(portalIntersectsBox(f,b),overlaps);
  assert.equal(portalBacksCollider(f,b),overlaps&&lb.max.z<=.08&&lb.max.z>=-.7&&lb.min.z<.08);
 }
});
test('an unchanged static collision mask does not wake cargo or dirty broadphase',()=>{
 let wakes=0;const item={body:{collisionFilterMask:2}},g={solids:new Map([['hull',item]]),world:{broadphase:{dirty:false}},cargoBody:{wakeUp(){wakes++;}}};
 // Find the live enabled mask through the production setter, not a duplicated constant.
 LabPhysics.prototype.setStaticEnabled.call(g,'hull',true);const previous=wakes;g.world.broadphase.dirty=false;
 for(let i=0;i<1000;i++)LabPhysics.prototype.setStaticEnabled.call(g,'hull',true);
 assert.equal(wakes,previous);assert.equal(g.world.broadphase.dirty,false);
 LabPhysics.prototype.setStaticEnabled.call(g,'hull',false);assert.equal(wakes,previous+1);assert.equal(g.world.broadphase.dirty,true);
});
test('render warmup restores render state and culling even when compilation throws',async()=>{
 const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());scene.add(mesh);
 const clipping=[],viewport=new THREE.Vector4(2,3,400,300),scissor=viewport.clone(),target={name:'original'};
 let current=target,testFlag=false;const r={clippingPlanes:clipping,shadowMap:{autoUpdate:true,needsUpdate:false},info:{programs:[]},getRenderTarget:()=>current,getViewport:v=>v.copy(viewport),getScissor:v=>v.copy(scissor),getScissorTest:()=>testFlag,setRenderTarget:t=>{current=t;},setViewport:v=>viewport.copy(v),setScissor:(...a)=>{if(a[0]?.isVector4)scissor.copy(a[0]);else scissor.set(...a);},setScissorTest:b=>testFlag=b,render:()=>{throw Error('synthetic driver failure');}};
 await assert.rejects(warmPortalPipeline({scene,renderer:r,portals:{targets:[{}]},camera:{}}),/driver failure/);
 assert.equal(current,target);assert.equal(r.clippingPlanes,clipping);assert.equal(r.shadowMap.autoUpdate,true);assert.equal(mesh.frustumCulled,true);assert.equal(testFlag,false);assert.deepEqual(scissor.toArray(),[2,3,400,300]);
});

test('sleeping cargo wakes when its reused light support moves away, not for unchanged or distant solids',()=>{
 const p=new LabPhysics();p.addStaticBox('support',{min:[-3,6.8,-2],max:[3,7.4,2]});
 p.addStaticBox('remote',{min:[40,-1,-2],max:[42,0,2]});
 const b=p.createCargo({position:[0,7.8,0]});for(let i=0;i<600;i++)p.step(1/120);
 assert.equal(p.sample().sleeping,true);
 p.updateStaticBox('support',{min:[-3,6.8,-2],max:[3,7.4,2]});assert.equal(p.sample().sleeping,true);
 p.updateStaticBox('remote',{min:[45,-1,-2],max:[47,0,2]});assert.equal(p.sample().sleeping,true);
 p.updateStaticBox('support',{min:[10,6.8,-2],max:[16,7.4,2]});assert.equal(p.sample().sleeping,false);
 for(let i=0;i<120;i++)p.step(1/120);assert.ok(b.position.y<2);p.dispose();
});
