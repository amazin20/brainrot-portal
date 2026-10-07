import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {warmPortalRendering} from '../src/game/LabPortalWarmup.js';

const isRenderable=o=>o.isMesh||o.isLine||o.isPoints||o.isSprite;
const kinds=[()=>new THREE.Mesh(),()=>new THREE.Line(),()=>new THREE.Points(),()=>new THREE.Sprite()];
const transforms=o=>({position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray()});
const snapshot=o=>({visible:o.visible,frustumCulled:o.frustumCulled,layers:o.layers.mask,parent:o.parent,
 children:[...o.children],geometry:o.geometry,material:o.material,transform:transforms(o),
 lod:o.isLOD?o.autoUpdate:undefined,shadow:o.shadow?.needsUpdate,shadowAuto:o.shadow?.autoUpdate});

function fixture({failDraw=0,loseAfterDraw=0,shadowNeeds=false}={}){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),eligible=[],excluded=[];
 camera.position.set(7,3,-2);camera.rotation.set(.2,.7,0);camera.layers.enable(2);
 const add=(o,parent=scene)=>{o.layers.set(2);o.castShadow=true;parent.add(o);eligible.push(o);return o;};
 for(let i=0;i<52;i++){const o=add(kinds[i%4]());o.position.set(i*.1,1,-i);}
 // A renderable parent belongs to another batch from its child and live light.
 const meshParent=add(new THREE.Mesh()),nested=add(new THREE.Mesh(),meshParent);
 meshParent.position.set(3,2,-1);nested.position.set(-2,4,1);
 const light=new THREE.PointLight();light.castShadow=true;light.shadow.autoUpdate=false;
 light.shadow.needsUpdate=false;meshParent.add(light);
 const hidden=new THREE.Group();hidden.visible=false;scene.add(hidden);
 add(new THREE.Mesh(),hidden);add(new THREE.Points(),hidden);
 const hiddenLight=new THREE.PointLight();hiddenLight.castShadow=true;hiddenLight.shadow.autoUpdate=false;
 hidden.add(hiddenLight);
 // A hidden light may be an ancestor of warmed geometry; its layer mask must
 // keep it out of the renderer's light list even while traversing that child.
 const lightParent=new THREE.PointLight();lightParent.visible=false;scene.add(lightParent);
 add(new THREE.Mesh(),lightParent);
 const skinned=add(new THREE.SkinnedMesh()),bone=new THREE.Bone();skinned.add(bone);
 skinned.bind(new THREE.Skeleton([bone]));
 const lod=new THREE.LOD();lod.autoUpdate=true;scene.add(lod);
 const lodNear=add(new THREE.Mesh(),lod),lodFar=add(new THREE.Line(),lod);
 lod.addLevel(lodNear,0);lod.addLevel(lodFar,20);lodFar.visible=false;
 const proxy=new THREE.Mesh();proxy.userData.collisionProxy=true;proxy.visible=false;
 const proxyChild=new THREE.Mesh();proxy.add(proxyChild);scene.add(proxy);excluded.push(proxy,proxyChild);
 const proxyGroup=new THREE.Group();proxyGroup.userData.collisionProxy=true;
 const groupChild=new THREE.Mesh();proxyGroup.add(groupChild);scene.add(proxyGroup);excluded.push(groupChild);
 scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 const states=new Map();scene.traverse(o=>states.set(o,snapshot(o)));const cameraState=snapshot(camera);
 // Any assignment to model or camera transforms would throw in this fixture.
 for(const o of [...states.keys(),camera]){Object.freeze(o.position);Object.freeze(o.quaternion);Object.freeze(o.scale);}
 const savedTarget={name:'original target'},planes=[new THREE.Plane(new THREE.Vector3(1,0,0),5)];
 const viewport=new THREE.Vector4(2,4,800,600),scissor=new THREE.Vector4(3,5,790,580);
 let target=savedTarget,face=2,mip=3,view=viewport.clone(),rect=scissor.clone(),scissorTest=false;
 let draws=0,finished=0,flushed=0,disposed=0,prepared=0,lost=false,warmTarget;
 const calls=[],events=[];
 const gl={flush(){flushed++;events.push('flush');},finish(){finished++;events.push('finish');},isContextLost:()=>lost};
 const renderer={clippingPlanes:planes,shadowMap:{autoUpdate:false,needsUpdate:shadowNeeds},info:{programs:[]},
  getContext:()=>gl,getRenderTarget:()=>target,getActiveCubeFace:()=>face,getActiveMipmapLevel:()=>mip,
  getViewport:v=>v.copy(view),getScissor:v=>v.copy(rect),getScissorTest:()=>scissorTest,getPixelRatio:()=>2,
  setRenderTarget(t,f=0,m=0){target=t;face=f;mip=m;},
  setViewport(...v){view=v.length===1?v[0].clone():new THREE.Vector4(...v);},
  setScissor(...v){rect=v.length===1?v[0].clone():new THREE.Vector4(...v);},setScissorTest:v=>{scissorTest=v;},
  render(s,c){
   draws++;events.push('draw');assert.equal(s,scene);assert.equal(c,camera);
   assert.equal(lod.autoUpdate,false);assert.equal(renderer.shadowMap.autoUpdate,false);
   assert.deepEqual(view.toArray(),[0,0,8,8]);assert.deepEqual(rect.toArray(),[0,0,8,8]);assert.equal(scissorTest,true);
   const queued=[],lit=[];scene.traverseVisible(o=>{if(!o.layers.test(camera.layers))return;
    if(isRenderable(o))queued.push(o);if(o.isLight)lit.push(o);});
   assert.deepEqual(lit,[light]);assert(queued.length<=24,'only one bounded batch may be submitted');
   assert(queued.every(o=>eligible.includes(o)),'collision proxies must never reach the draw list');
   const depth=renderer.shadowMap.needsUpdate;
   if(depth){assert.equal(light.shadow.needsUpdate,true);assert.equal(light.shadow.autoUpdate,false);
    light.shadow.needsUpdate=false;renderer.shadowMap.needsUpdate=false;}
   if(target&&!warmTarget){warmTarget=target;target.addEventListener('dispose',()=>disposed++);}
   calls.push({objects:queued,target:target===null?'canvas':'linear',cut:renderer.clippingPlanes!==planes,depth});
   if(draws===failDraw)throw new Error('test draw failure');
   if(draws===loseAfterDraw)lost=true;
  }
 };
 const game={renderer,scene,camera,portals:{prepare(){prepared++;},targets:[{texture:{type:THREE.UnsignedByteType}}]},portalActors:{prepare(){prepared++;}}};
 return {game,renderer,scene,camera,eligible,excluded,states,cameraState,light,hiddenLight,lightParent,calls,events,
  read:()=>({draws,finished,flushed,disposed,prepared,target,face,mip,view,rect,scissorTest,warmTarget}),
  restoreAssertions(success){
   for(const [o,s]of states){assert.equal(o.visible,s.visible);assert.equal(o.frustumCulled,s.frustumCulled);
    assert.equal(o.layers.mask,s.layers);assert.equal(o.parent,s.parent);assert.deepEqual(o.children,s.children);
    assert.equal(o.geometry,s.geometry);assert.equal(o.material,s.material);assert.deepEqual(transforms(o),s.transform);
    if(o.isLOD)assert.equal(o.autoUpdate,s.lod);
    if(o.shadow){assert.equal(o.shadow.autoUpdate,s.shadowAuto);assert.equal(o.shadow.needsUpdate,success&&o===light?true:s.shadow);}}
   assert.deepEqual(transforms(camera),cameraState.transform);assert.equal(camera.layers.mask,cameraState.layers);
   assert.equal(renderer.clippingPlanes,planes);assert.equal(renderer.shadowMap.autoUpdate,false);
   assert.equal(renderer.shadowMap.needsUpdate,success?true:shadowNeeds);
   assert.equal(target,savedTarget);assert.equal(face,2);assert.equal(mip,3);
   assert.deepEqual(view,viewport);assert.deepEqual(rect,scissor);assert.equal(scissorTest,false);
  }};
}

function frameObserver(t,events){
 const previous=globalThis.requestAnimationFrame;
 globalThis.requestAnimationFrame=resolve=>{events.push('frame');queueMicrotask(resolve);};
 t.after(()=>{if(previous===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=previous;});
}

test('incremental warmup covers all renderables in all four real output/clipping variants',async t=>{
 const f=fixture();frameObserver(t,f.events);await warmPortalRendering(f.game);
 const r=f.read(),batches=Math.ceil(f.eligible.length/24);
 assert.equal(r.draws,batches*4);assert.equal(r.flushed,r.draws);assert.equal(r.finished,1);
 assert.equal(r.prepared,2);assert.equal(r.disposed,1);
 assert.equal(r.warmTarget.width,16);assert.equal(r.warmTarget.height,16);
 assert.equal(r.warmTarget.texture.colorSpace,THREE.LinearSRGBColorSpace);
 for(const o of f.eligible){const variants=f.calls.filter(c=>c.objects.includes(o)).map(c=>`${c.target}:${c.cut}`);
  assert.deepEqual(variants,['linear:false','canvas:false','linear:true','canvas:true']);}
 for(let i=0;i<f.calls.length;i++)assert.equal(f.calls[i].depth,i%4===0,'each batch needs its own depth render');
 assert.deepEqual(f.events,[...Array.from({length:r.draws},()=>['draw','flush','frame']).flat(),'finish']);
 assert.deepEqual({...f.game.portalWarmup,milliseconds:0,variants:''},
  {milliseconds:0,programs:0,renderables:f.eligible.length,batches,batchSize:24,draws:r.draws,variants:''});
 f.restoreAssertions(true);
});

test('hidden lights retain their original inactive signature while their geometry warms',async()=>{
 const f=fixture();await warmPortalRendering(f.game);f.restoreAssertions(true);
 assert.equal(f.hiddenLight.parent.visible,false);assert.equal(f.hiddenLight.visible,true);
 assert.equal(f.lightParent.visible,false);
 assert(f.calls.every(c=>!c.objects.some(o=>f.excluded.includes(o))));
});

for(const shadowNeeds of [false,true])test(`failure in a later batch restores all state (prior shadow dirty=${shadowNeeds})`,async t=>{
 const f=fixture({failDraw:5,shadowNeeds});frameObserver(t,f.events);
 await assert.rejects(warmPortalRendering(f.game),/test draw failure/);
 const r=f.read();assert.equal(r.draws,5);assert.equal(r.flushed,4);assert.equal(r.finished,0);assert.equal(r.disposed,1);
 assert.equal(f.game.portalWarmup,undefined);f.restoreAssertions(false);
});

test('context loss after a draw rejects readiness and restores the original state',async()=>{
 const f=fixture({loseAfterDraw:2});await assert.rejects(warmPortalRendering(f.game),/WebGL context lost/);
 assert.equal(f.read().finished,0);assert.equal(f.read().disposed,1);assert.equal(f.game.portalWarmup,undefined);
 f.restoreAssertions(false);
});

test('headless rendering does not pretend to have warmed WebGL',async()=>{
 let prepared=0;const game={renderer:{},portals:{prepare(){prepared++;}},portalActors:{prepare(){prepared++;}}};
 await warmPortalRendering(game);assert.equal(prepared,2);assert.equal(game.portalWarmup,undefined);
});
