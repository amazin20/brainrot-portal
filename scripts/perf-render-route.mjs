import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

// Same actual route and meshes, two culling lenses at each identical pose.
// Counts potential Three draw submissions, NOT GPU time or user-device FPS.
const level=Number(process.env.PERF_LEVEL||21),out=process.env.EVIDENCE_OUT||'smoke-artifacts/render-performance';
fs.mkdirSync(out,{recursive:true});
const game=await createHeadlessGame();await game.selectLevel(level-1,false);
const rows=[],projection=new THREE.Matrix4(),frustum=new THREE.Frustum();
function submissions(scene,camera,projectionMatrix){
 projection.multiplyMatrices(projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);
 let calls=0,triangles=0;
 const visit=object=>{
  if(!object.visible)return;
  if(object.layers.test(camera.layers)&&(object.isMesh||object.isLine||object.isPoints||object.isSprite)){
   const visible=!object.frustumCulled||(object.isSprite?frustum.intersectsSprite(object):frustum.intersectsObject(object));
   if(visible){
    const geometry=object.geometry,materials=Array.isArray(object.material)?object.material:[object.material];
    const count=geometry?.index?.count??geometry?.attributes.position?.count??0;
    if(Array.isArray(object.material)){
     for(const group of geometry.groups)if(materials[group.materialIndex]?.visible){calls++;triangles+=object.isMesh?Math.min(count,group.count)/3*(object.isInstancedMesh?object.count:1):0;}
    }else if(materials[0]?.visible){calls++;triangles+=object.isMesh?Math.min(count,geometry.drawRange.count)/3*(object.isInstancedMesh?object.count:1):0;}
   }
  }
  for(const child of object.children)visit(child);
 };visit(scene);return{calls,triangles};
}
let target=null,viewport=new THREE.Vector4(0,0,1280,720),scissor=viewport.clone(),test=false,tick=0;
game.renderer={xr:{enabled:false},shadowMap:{autoUpdate:true},clippingPlanes:[],
 getDrawingBufferSize:t=>t.set(1280,720),getRenderTarget:()=>target,setRenderTarget:t=>{target=t;},
 getViewport:t=>t.copy(viewport),setViewport:(...a)=>{viewport=a.length===1?a[0].clone():new THREE.Vector4(...a);},
 getScissor:t=>t.copy(scissor),setScissor:(...a)=>{scissor=a.length===1?a[0].clone():new THREE.Vector4(...a);},
 getScissorTest:()=>test,setScissorTest:t=>{test=t;},clear(){},
 render(scene,camera){
  if(scene.matrixWorldAutoUpdate)scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  if(!target)return;
  const before=submissions(scene,camera,game.portals._passProjection);
  const after=submissions(scene,camera,camera.projectionMatrix);
  assert.ok(after.calls<=before.calls,'cropped frustum cannot add mesh submissions');
  rows.push({tick,teleports:game.teleportCount,kind:target===game.portals.bounceTarget?'nested':'primary',before,after});
 }};
game.portals.renderer=game.renderer;
const update=game.updateVisuals;
game.updateVisuals=function(...args){const result=update.apply(this,args);if(tick++%30===0)game.render();return result;};
try{
 const route=await runV8Journey(game);assert.ok(route.pass);
 const total=side=>rows.reduce((sum,row)=>({calls:sum.calls+row[side].calls,triangles:sum.triangles+row[side].triangles}),{calls:0,triangles:0});
 const before=total('before'),after=total('after');
 const report={scope:'Same-pose Node mesh-frustum submission counts; no WebGL, no FPS claim',level,route,
  portalPasses:rows.length,before,after,drawReduction:1-after.calls/before.calls,triangleReduction:1-after.triangles/before.triangles,rows};
 assert.ok(rows.length>10,'route must exercise real linked windows');
 fs.writeFileSync(`${out}/portal-culling-${level}.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,rows:undefined,route:{pass:route.pass,frames:route.frames,resets:route.resets,respawns:route.respawns}}));
}finally{game.updateVisuals=update;game.firstLevel?.dispose?.();game.physics.dispose();game.portals.dispose();}
