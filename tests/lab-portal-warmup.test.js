import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {warmPortalRendering} from '../src/game/LabPortalWarmup.js';

for(const fails of [false,true])test(`portal warmup restores hidden actors, lights and renderer state ${fails?'on draw failure':'after all variants'}`,async()=>{
 const scene=new THREE.Scene(),visible=new THREE.Mesh(),hidden=new THREE.Group(),part=new THREE.Mesh(),proxy=new THREE.Mesh(),light=new THREE.PointLight(),copyLight=new THREE.PointLight();
 hidden.visible=false;hidden.add(part,copyLight);scene.add(visible,hidden,proxy,light);proxy.visible=false;proxy.userData.collisionProxy=true;
 const camera=new THREE.PerspectiveCamera(),planes=[],viewport=new THREE.Vector4(2,4,800,600),scissor=new THREE.Vector4(3,5,790,580);let target=null,view=viewport.clone(),rect=scissor.clone(),scissorTest=false,draws=0,finished=0;
 const renderer={clippingPlanes:planes,shadowMap:{autoUpdate:true,needsUpdate:false},info:{programs:[]},
  getContext:()=>({finish:()=>finished++}),getRenderTarget:()=>target,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,
  getViewport:v=>v.copy(view),getScissor:v=>v.copy(rect),getScissorTest:()=>scissorTest,getPixelRatio:()=>1,
  setRenderTarget:t=>{target=t;},setViewport:(...v)=>{view=v.length===1?v[0].clone():new THREE.Vector4(...v);},setScissor:(...v)=>{rect=v.length===1?v[0].clone():new THREE.Vector4(...v);},setScissorTest:v=>{scissorTest=v;},
  render:()=>{draws++;assert.equal(hidden.visible,true);assert.equal(part.visible,true);assert.equal(proxy.visible,false);assert.equal(light.visible,true);assert.equal(copyLight.visible,false);if(fails)throw new Error('test draw failure');}
 };
 const game={renderer,scene,camera,portals:{prepare(){},targets:[{texture:{type:THREE.UnsignedByteType}}]},portalActors:{prepare(){}}};
 if(fails)await assert.rejects(warmPortalRendering(game),/test draw failure/);else await warmPortalRendering(game);
 assert.equal(draws,fails?1:4);assert.equal(finished,fails?0:1);assert.equal(hidden.visible,false);assert.equal(part.visible,true);assert.equal(proxy.visible,false);assert.equal(copyLight.visible,true);
 assert.equal(renderer.clippingPlanes,planes);assert.equal(renderer.shadowMap.autoUpdate,true);assert.equal(target,null);assert.deepEqual(view,viewport);assert.deepEqual(rect,scissor);assert.equal(scissorTest,false);assert.equal(visible.frustumCulled,true);
});
