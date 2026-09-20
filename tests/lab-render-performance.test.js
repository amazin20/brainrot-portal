import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LabGame } from '../src/game/LabGame.js';
import { LabPortals, cropPortalProjection, makePortalFrame, applyPortalObliqueClipping } from '../src/game/LabPortals.js';

const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const close = (a,b,message) => assert.ok(Math.abs(a-b)<1e-8, `${message}: ${a} != ${b}`);

test('cropped wall, floor and oblique portal cameras preserve every screen pixel and clipping depth', () => {
  for (const normal of [V(0,0,1), V(0,1,0), V(1,.3,.2).normalize()]) {
    const frame = makePortalFrame(V(0,1.5,0),normal);
    const camera = new THREE.PerspectiveCamera(63,16/9,.1,100);
    camera.position.copy(frame.position).addScaledVector(normal,-3);
    camera.up.copy(V(0,1,0).applyQuaternion(frame.quaternion));
    camera.lookAt(frame.position); camera.updateMatrixWorld(true);
    applyPortalObliqueClipping(camera,frame);
    for (const [width,height] of [[1280,720],[390,844]]) {
      for (const rect of [{x:0,y:0,width,height},{x:width*.2,y:height*.3,width:width*.4,height:height*.5}]) {
        const cropped = cropPortalProjection(camera.projectionMatrix,rect,width,height);
        for (let x=-2;x<=2;x++) for (let y=-2;y<=2;y++) for (const z of [-.02,.2,8]) {
          const point = V(x*.4,y*.3,z).applyQuaternion(frame.quaternion).add(frame.position);
          const eye = new THREE.Vector4(point.x,point.y,point.z,1).applyMatrix4(camera.matrixWorldInverse);
          const full = eye.clone().applyMatrix4(camera.projectionMatrix);
          const part = eye.clone().applyMatrix4(cropped);
          close((part.x/part.w*.5+.5)*rect.width+rect.x,(full.x/full.w*.5+.5)*width,'pixel x');
          close((part.y/part.w*.5+.5)*rect.height+rect.y,(full.y/full.w*.5+.5)*height,'pixel y');
          close(part.z/part.w,full.z/full.w,'oblique depth');
          // The nested aperture shader reverses that same viewport transform.
          close((part.x/part.w*.5+.5)*rect.width/width+rect.x/width,full.x/full.w*.5+.5,'nested u');
          close((part.y/part.w*.5+.5)*rect.height/height+rect.y/height,full.y/full.w*.5+.5,'nested v');
        }
      }
    }
  }
});

test('aperture frustum removes invisible destination geometry without removing window contents', () => {
  const camera = new THREE.PerspectiveCamera(60,16/9,.1,100);
  const projection = cropPortalProjection(camera.projectionMatrix,{x:500,y:220,width:280,height:280},1280,720);
  const full = new THREE.Frustum().setFromProjectionMatrix(camera.projectionMatrix);
  const cropped = new THREE.Frustum().setFromProjectionMatrix(projection);
  const inside = new THREE.Sphere(V(0,0,-10),.4), outside = new THREE.Sphere(V(8,0,-10),.4);
  assert.ok(full.intersectsSphere(inside) && full.intersectsSphere(outside));
  assert.ok(cropped.intersectsSphere(inside));
  assert.equal(cropped.intersectsSphere(outside),false);
});

test('portal replacements reuse prepared GPU resources while independent physical frames stay fresh', () => {
  const scene = new THREE.Scene(), initialized = [];
  const renderer = { getDrawingBufferSize: t=>t.set(1280,720), initRenderTarget: t=>initialized.push(t) };
  const portals = new LabPortals({scene,renderer});
  portals.prepare();
  assert.equal(initialized.length,3);
  assert.equal(scene.children.length,2);
  assert.ok(scene.children.every(group=>!group.visible),'materials can compile during loading without showing a portal');
  const initial = portals.place(0,V(0,1.5,0),V(0,0,1));
  const geometries = [], materials = []; let disposed = 0;
  initial.group.traverse(object=>{if(object.geometry){geometries.push(object.geometry);materials.push(object.material);object.geometry.addEventListener('dispose',()=>disposed++);}});
  for (let i=0;i<50;i++) {
    const placed = portals.place(0,V(i,1.5,0),V(0,0,1));
    assert.notEqual(placed,initial,'physics retains its own frame identity');
    const current=[];placed.group.traverse(object=>{if(object.geometry)current.push(object.geometry);});
    assert.deepEqual(current,geometries);assert.equal(placed.surface.material,materials[0]);
  }
  assert.equal(disposed,0);
  portals.clear();assert.equal(portals.ready,false);
  portals.dispose();assert.equal(disposed,3);assert.equal(scene.children.length,0);
});

test('main and nested views share one current scene pose, including restoration after render failure', () => {
  const scene = new THREE.Scene(), root = new THREE.Group(), mesh = new THREE.Mesh();
  scene.add(root);root.add(mesh);let updates=0;
  const original=scene.updateMatrixWorld;
  scene.updateMatrixWorld=function(...args){updates++;return original.apply(this,args);};
  const renderer = { clippingPlanes: [], render(s) {
    if(s.matrixWorldAutoUpdate)s.updateMatrixWorld();
    close(mesh.matrixWorld.elements[12],3,'same new world position in every pass');
  }};
  const game = {scene,renderer,cameraRig:{mainClippingPlanes:[]},portals:{render(){renderer.render(scene);renderer.render(scene);}}};
  root.position.x=3;LabGame.prototype.render.call(game);
  assert.equal(updates,1);assert.equal(scene.matrixWorldAutoUpdate,true);
  game.portals.render=()=>{throw new Error('context lost');};
  const clipping=renderer.clippingPlanes;
  assert.throws(()=>LabGame.prototype.render.call(game),/context lost/);
  assert.equal(scene.matrixWorldAutoUpdate,true);assert.equal(renderer.clippingPlanes,clipping);
});

test('portal pass exceptions restore the uncropped lens and screen UV mapping', () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const renderer={setRenderTarget(){},setViewport(){},setScissor(){},setScissorTest(){},clear(){},render(){throw new Error('context lost');}};
  const portals=new LabPortals({scene,renderer,camera});
  const projection=camera.projectionMatrix.clone(),inverse=camera.projectionMatrixInverse.clone();
  assert.throws(()=>portals._draw({width:1280,height:720},camera,{x:100,y:120,width:240,height:320}),/context lost/);
  assert.ok(camera.projectionMatrix.equals(projection));assert.ok(camera.projectionMatrixInverse.equals(inverse));
  for(const visual of portals._visuals)assert.deepEqual(visual.surface.material.uniforms.viewUvTransform.value.toArray(),[0,0,1,1]);
  portals.dispose();
});

test('high-DPI portal viewport and scissor address physical texture pixels exactly once', () => {
  for(const ratio of [1,1.25,1.5,2,3]){
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),seen=[];
    const renderer={getPixelRatio:()=>ratio,setRenderTarget(){},
      setViewport(...values){seen.push(values.map(v=>Math.round(v*ratio)));},
      setScissor(...values){seen.push(values.map(v=>Math.round(v*ratio)));},setScissorTest(){},clear(){},render(){}};
    const portals=new LabPortals({scene,renderer,camera});
    portals._draw({width:960,height:540},camera,{x:117,y:89,width:421,height:283});
    assert.deepEqual(seen,[[117,89,421,283],[117,89,421,283]],`DPR ${ratio}`);
    portals.dispose();
  }
});
