import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createReadabilityObserver} from '../scripts/lib/v58-readability-observer.mjs';

// Synthetic geometry-only controls; these never claim a native game recording.
function fixture(){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,640/360,.1,100);
 const target=new THREE.Mesh(new THREE.BoxGeometry(2,2,.1),new THREE.MeshBasicMaterial());target.position.z=-6;scene.add(target);
 const game={scene,camera,renderer:{domElement:{width:640,height:360},info:{render:{frame:1}},render(){throw Error('observer rendered');}},
  physics:{world:{stepnumber:1,bodies:[]}},cameraRig:{mainClippingPlanes:[]},state:'playing',yaw:0,pitch:0};
 const prepare=()=>{scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);scene.traverse(n=>n.skeleton?.update());};prepare();
 const observer=(roots=[target],options={})=>createReadabilityObserver(THREE,game,{roles:[{role:'actual-target',roots,bodyId:7,shapeId:8}],...options});
 const observe=o=>o.observe({encodedFrame:0,visualFrame:0,worldStep:1});
 function wall({x=0,width=3,material=new THREE.MeshBasicMaterial()}={}){const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,3,.1),material);mesh.position.set(x,0,-3);scene.add(mesh);prepare();return mesh;}
 return {scene,camera,target,game,prepare,observer,observe,wall};
}
test('actual clipped target triangles have bounded pixel-center samples and visible first hits',()=>{
 const f=fixture(),r=f.observe(f.observer()),v=r.roles[0];
 assert.ok(v.projectedSamples>0&&v.projectedSamples<=25);assert.equal(v.firstHitTargetSamples,v.projectedSamples);assert.equal(v.visibleFraction,1);
 assert.deepEqual(v.targetMeshUUIDs,[f.target.uuid]);assert.ok(v.bboxPixels.width>50&&v.bboxPixels.height>50);
 for(const s of v.samples){assert.equal(s.firstHitIsTarget,true);assert.equal(s.firstHit.meshUUID,f.target.uuid);assert.equal(s.target.meshUUID,f.target.uuid);assert.equal(s.pixel[0]%1,.5);assert.equal(s.pixel[1]%1,.5);}
 assert.equal(r.readPurity.unchanged,true);assert.equal(r.camera.canvas.width,640);assert.equal(v.bodyId,7);assert.equal(v.shapeId,8);
});
test('opaque original actor and wall are actual occluders despite in-frustum target projection',()=>{
 for(const name of ['original-player','ordinary-wall']){const f=fixture(),wall=f.wall();wall.name=name;const v=f.observe(f.observer()).roles[0];
  assert.ok(v.projectedSamples>0);assert.equal(v.visibleFraction,0);assert.equal(v.uncertain.samples,0);assert.ok(v.samples.every(s=>s.firstHit.meshUUID===wall.uuid&&!s.firstHitIsTarget));}
});
test('partial wall produces partial geometric visibility rather than a center-point pass',()=>{
 const f=fixture();f.wall({x:-.5,width:1});const v=f.observe(f.observer()).roles[0];assert.ok(v.visibleFraction>0&&v.visibleFraction<1);assert.ok(v.firstHitTargetSamples<v.projectedSamples);
});
test('behind-camera geometry has no projected footprint',()=>{
 const f=fixture();f.target.position.z=6;f.prepare();const v=f.observe(f.observer()).roles[0];assert.equal(v.bboxPixels,null);assert.equal(v.projectedSamples,0);assert.equal(v.visibleFraction,0);
});
test('sampling follows triangle footprint, never the empty area of its bounding rectangle',()=>{
 const f=fixture();f.scene.remove(f.target);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-2,-2,-6,2,-2,-6,-2,2,-6],3));
 const target=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));f.scene.add(target);f.prepare();const v=f.observe(f.observer([target])).roles[0];
 assert.ok(v.projectedSamples>0);for(const sample of v.samples){const [x,y]=sample.target.worldPoint;assert.ok(x+y<=1e-7,'empty upper-right bbox region must not supply a sample');}
 assert.ok(v.projectedFootprintPixelsEstimate<v.bboxPixels.width*v.bboxPixels.height*.6);
});
test('near-plane-crossing target clips to finite viewport pixels without behind-eye bounds',()=>{
 const f=fixture();f.scene.remove(f.target);const target=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));target.position.set(.15,0,-.15);f.scene.add(target);f.prepare();
 const v=f.observe(f.observer([target])).roles[0];assert.ok(v.projectedSamples>0);assert.ok(v.bboxPixels.minX>=-1e-6&&v.bboxPixels.maxX<=640+1e-6);
 for(const sample of v.samples)assert.ok(sample.target.cameraDepth>=f.camera.near);
});
test('actual wrong foreground instance blocks and its instanceId remains in the witness',()=>{
 const f=fixture(),instances=new THREE.InstancedMesh(new THREE.BoxGeometry(3,3,.1),new THREE.MeshBasicMaterial(),2);
 instances.setMatrixAt(0,new THREE.Matrix4().makeTranslation(8,0,-3));instances.setMatrixAt(1,new THREE.Matrix4().makeTranslation(0,0,-3));f.scene.add(instances);f.prepare();
 const v=f.observe(f.observer()).roles[0];assert.equal(v.visibleFraction,0);assert.ok(v.samples.every(s=>s.firstHit.meshUUID===instances.uuid&&s.firstHit.instanceId===1&&s.target.instanceId===null));
});
test('hidden ancestors, invisible materials and non-camera layers do not invent opaque blockers',()=>{
 for(const mode of ['ancestor','material','layer']){const f=fixture(),wall=f.wall();
  if(mode==='ancestor'){const group=new THREE.Group();f.scene.add(group);group.add(wall);group.visible=false;}
  if(mode==='material')wall.material.visible=false;if(mode==='layer')wall.layers.set(3);f.prepare();assert.equal(f.observe(f.observer()).roles[0].visibleFraction,1);}
 const f=fixture();f.target.material.visible=false;const v=f.observe(f.observer()).roles[0];assert.equal(v.projectedSamples,0);assert.deepEqual(v.targetMeshUUIDs,[]);
});
test('transparent, alpha-tested, shader, portal and clipped first hits are uncertain and blocked',()=>{
 for(const mode of ['glass','alpha','shader','portal','clipped']){const f=fixture(),material=mode==='shader'?new THREE.ShaderMaterial():new THREE.MeshBasicMaterial();
  if(mode==='glass'){material.transparent=true;material.opacity=.2;}if(mode==='alpha')material.alphaTest=.5;
  if(mode==='clipped')material.clippingPlanes=[new THREE.Plane(new THREE.Vector3(1,0,0),0)];
  const wall=f.wall({material});if(mode==='portal')wall.userData.portalRenderResource=true;
  const v=f.observe(f.observer()).roles[0];assert.equal(v.visibleFraction,0);assert.equal(v.uncertain.samples,v.projectedSamples);assert.ok(v.uncertain.reasons.length>0);}
});
test('main clipping is unsupported and never silently removed',()=>{
 const f=fixture(),plane=new THREE.Plane(new THREE.Vector3(1,0,0),0);f.game.cameraRig.mainClippingPlanes.push(plane);
 const v=f.observe(f.observer()).roles[0];assert.equal(v.uncertain.frameUnsupported,true);assert.equal(v.visibleFraction,0);assert.equal(f.game.cameraRig.mainClippingPlanes[0],plane);
});
test('backface and depth-test overlays respect the rendered material policy',()=>{
 const f=fixture();f.scene.remove(f.target);const target=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({side:THREE.BackSide}));target.position.z=-6;f.scene.add(target);f.prepare();
 assert.equal(f.observe(f.observer([target])).roles[0].projectedSamples,0);
 const z=fixture(),overlay=z.wall();overlay.position.z=-8;overlay.scale.set(5,5,1);overlay.material.depthTest=false;z.prepare();const v=z.observe(z.observer()).roles[0];assert.equal(v.visibleFraction,0);assert.ok(v.uncertain.reasons.includes('depth-test-overlay'));
});
test('current animated skin occludes even when its untouched live bounding sphere is stale elsewhere',()=>{
 const f=fixture(),geometry=new THREE.PlaneGeometry(3,3),count=geometry.attributes.position.count;
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(count*4),4));const weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),bone=new THREE.Bone();mesh.add(bone);mesh.position.z=-3;f.scene.add(mesh);mesh.bind(new THREE.Skeleton([bone]));
 bone.position.x=5;f.prepare();mesh.computeBoundingSphere();const sphere=mesh.boundingSphere,oldCenter=sphere.center.clone();bone.position.x=0;f.prepare();
 const v=f.observe(f.observer()).roles[0];assert.equal(v.visibleFraction,0);assert.ok(v.samples.every(s=>s.firstHit.meshUUID===mesh.uuid));assert.equal(mesh.boundingSphere,sphere);assert.deepEqual(sphere.center.toArray(),oldCenter.toArray());
});
test('observer does not render, prepare matrices, alter original bounds or edit the lens',()=>{
 const f=fixture(),before={camera:f.camera.position.toArray(),projection:f.camera.projectionMatrix.toArray(),target:f.target.matrixWorld.toArray(),sphere:f.target.geometry.boundingSphere,box:f.target.geometry.boundingBox};
 f.scene.updateMatrixWorld=()=>{throw Error('observer prepared scene');};f.camera.updateMatrixWorld=()=>{throw Error('observer prepared lens');};f.camera.lookAt=()=>{throw Error('observer set lens');};f.camera.updateProjectionMatrix=()=>{throw Error('observer changed projection');};
 f.observe(f.observer());assert.deepEqual(f.camera.position.toArray(),before.camera);assert.deepEqual(f.camera.projectionMatrix.toArray(),before.projection);assert.deepEqual(f.target.matrixWorld.toArray(),before.target);assert.equal(f.target.geometry.boundingSphere,before.sphere);assert.equal(f.target.geometry.boundingBox,before.box);
});
function authoredTarget(matrix){
 const f=fixture(),parent=new THREE.Group(),authored=new THREE.Group();parent.position.set(.2,-.1,0);parent.rotation.z=.08;
 f.scene.add(parent);parent.add(authored);authored.matrixAutoUpdate=false;authored.matrix.copy(matrix);authored.add(f.target);f.target.position.set(0,0,0);f.prepare();
 return {...f,parent,authored};
}
function transformSnapshot(f){
 const nodes=[];f.scene.traverse(n=>nodes.push(n));nodes.push(f.camera);
 return {nodes:nodes.map(n=>({uuid:n.uuid,position:n.position.toArray(),quaternion:n.quaternion.toArray(),scale:n.scale.toArray(),
  matrix:n.matrix.toArray(),matrixWorld:n.matrixWorld.toArray(),matrixAutoUpdate:n.matrixAutoUpdate,matrixWorldAutoUpdate:n.matrixWorldAutoUpdate,matrixWorldNeedsUpdate:n.matrixWorldNeedsUpdate})),
  cameraProjection:f.camera.projectionMatrix.toArray(),cameraInverse:f.camera.matrixWorldInverse.toArray(),renderFrame:f.game.renderer.info.render.frame,worldStep:f.game.physics.world.stepnumber};
}
function forbidPreparation(f){
 f.scene.traverse(n=>{n.updateMatrix=()=>{throw Error('observer wrote local matrix');};n.updateMatrixWorld=()=>{throw Error('observer prepared world matrix');};n.updateWorldMatrix=()=>{throw Error('observer prepared world matrix');};});
 f.camera.updateMatrixWorld=()=>{throw Error('observer prepared camera');};f.camera.updateProjectionMatrix=()=>{throw Error('observer changed lens');};
}
function assertHitsActualBox(f,role){
 const inverse=f.target.matrixWorld.clone().invert();
 assert.ok(role.projectedSamples>=3);assert.equal(role.visibleFraction,1);
 for(const sample of role.samples){const local=new THREE.Vector3(...sample.target.worldPoint).applyMatrix4(inverse);
  assert.equal(sample.firstHit.meshUUID,f.target.uuid);assert.ok(Math.abs(local.x)<=1+1e-6&&Math.abs(local.y)<=1+1e-6&&Math.abs(local.z)<=.05+1e-6,'ray witness must lie on the actual authored transformed box');}
}
test('prepared manually authored translation and rotation use actual matrices without rewriting TRS',()=>{
 const matrix=new THREE.Matrix4().makeTranslation(.4,.2,-6).multiply(new THREE.Matrix4().makeRotationZ(.35)).multiply(new THREE.Matrix4().makeRotationY(.2));
 const f=authoredTarget(matrix);assert.notDeepEqual(f.authored.matrix.toArray(),new THREE.Matrix4().compose(f.authored.position,f.authored.quaternion,f.authored.scale).toArray());
 const before=transformSnapshot(f),sphere=f.target.geometry.boundingSphere,box=f.target.geometry.boundingBox;forbidPreparation(f);
 const r=f.observe(f.observer());assertHitsActualBox(f,r.roles[0]);assert.equal(r.readPurity.unchanged,true);assert.deepEqual(transformSnapshot(f),before);
 assert.equal(f.target.geometry.boundingSphere,sphere);assert.equal(f.target.geometry.boundingBox,box);
});
test('a finite exact authored shear remains valid without a decomposable TRS assumption',()=>{
 const matrix=new THREE.Matrix4().set(1,.45,0,.2,0,1,.2,.1,0,0,1,-6,0,0,0,1),f=authoredTarget(matrix);
 const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();matrix.decompose(position,rotation,scale);
 assert.ok(new THREE.Matrix4().compose(position,rotation,scale).elements.some((n,i)=>Math.abs(n-matrix.elements[i])>1e-3),'control must contain actual shear');
 const before=transformSnapshot(f);forbidPreparation(f);const r=f.observe(f.observer());assertHitsActualBox(f,r.roles[0]);assert.deepEqual(transformSnapshot(f),before);
});
test('opaque actor and wall meshes under authored manual matrices still block actual target rays',()=>{
 for(const name of ['original-player','ordinary-wall']){const f=fixture(),group=new THREE.Group();group.matrixAutoUpdate=false;
  group.matrix.makeTranslation(.1,-.1,-3).multiply(new THREE.Matrix4().makeRotationZ(.3));f.scene.add(group);
  const occluder=new THREE.Mesh(new THREE.BoxGeometry(6,6,.1),new THREE.MeshBasicMaterial());occluder.name=name;occluder.matrixAutoUpdate=false;occluder.matrix.makeRotationY(.12);group.add(occluder);f.prepare();
  const before=transformSnapshot(f);forbidPreparation(f);const v=f.observe(f.observer()).roles[0];assert.ok(v.projectedSamples>0);assert.equal(v.visibleFraction,0);assert.equal(v.uncertain.samples,0);
  assert.ok(v.samples.every(s=>s.firstHit.meshUUID===occluder.uuid&&!s.firstHitIsTarget));assert.deepEqual(transformSnapshot(f),before);}
});
test('manual matrix ownership never exempts stale child or ancestor matrixWorld from rejection',()=>{
 for(const stale of ['child','ancestor']){const f=authoredTarget(new THREE.Matrix4().makeTranslation(.4,.2,-6));
  if(stale==='child')f.target.matrixWorld.elements[12]+=.25;
  else{f.authored.matrixWorld.elements[12]+=.25;f.target.matrixWorld.multiplyMatrices(f.authored.matrixWorld,f.target.matrix);}
  const before=transformSnapshot(f);forbidPreparation(f);assert.throws(()=>f.observe(f.observer()),/stale world matrix/);assert.deepEqual(transformSnapshot(f),before);}
});
test('nonfinite authored local or world matrices fail closed and stay untouched',()=>{
 for(const name of ['matrix','matrixWorld']){const f=authoredTarget(new THREE.Matrix4().makeTranslation(0,0,-6));f.authored[name].elements[12]=NaN;
  const before=transformSnapshot(f);forbidPreparation(f);assert.throws(()=>f.observe(f.observer()),/nonfinite|matrix/);assert.deepEqual(transformSnapshot(f),before);}
});
test('clock drift, repeated renders, stale matrices and nonfinite geometry fail closed',()=>{
 const f=fixture(),o=f.observer();assert.throws(()=>o.observe({encodedFrame:0,visualFrame:0,worldStep:2}),/clock/);f.observe(o);assert.throws(()=>o.observe({encodedFrame:1,visualFrame:1,worldStep:1}),/clock/);
 const stale=fixture();stale.target.position.x=1;assert.throws(()=>stale.observe(stale.observer()),/stale/);
 const nonfinite=fixture();nonfinite.target.geometry.attributes.position.setX(0,NaN);assert.throws(()=>nonfinite.observe(nonfinite.observer()),/nonfinite/);
 const drift=fixture(),original=drift.target.getVertexPosition;drift.target.getVertexPosition=function(...args){drift.game.physics.world.stepnumber++;return original.apply(this,args);};assert.throws(()=>drift.observe(drift.observer()),/purity|clock/);
});
test('ray budget is explicit and cannot be silently exceeded',()=>{
 const f=fixture();assert.throws(()=>f.observer([f.target],{maxSamplesPerRole:26}),/25/);assert.ok(f.observe(f.observer([f.target],{maxSamplesPerRole:4})).roles[0].samples.length<=4);
});
