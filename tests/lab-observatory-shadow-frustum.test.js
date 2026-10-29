import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {QUALITY_PRESETS,applyLabQuality} from '../src/game/LabPreferences.js';
import {installObservatoryShadows,observatoryShadowPlan} from '../src/game/LabObservatoryShadows.js';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';

const keys=['left','right','bottom','top','near','far'];
const cameraState=light=>Object.fromEntries(keys.map(key=>[key,light.shadow.camera[key]]));
const flags=scene=>{const rows=[];scene.traverse(mesh=>{if(mesh.isMesh)rows.push([mesh,mesh.castShadow,mesh.receiveShadow]);});return rows;};
function fixture(){
 const light=new THREE.DirectionalLight();light.position.set(-16.12,20,14);light.target.position.set(0,-1,0);
 Object.assign(light.shadow.camera,{left:-80,right:80,bottom:-80,top:80,near:1,far:200});light.shadow.bias=-.00015;light.shadow.normalBias=.04;light.shadow.mapSize.set(1024,1024);light.castShadow=true;
 const level={index:30,workshop:{bounds:{minX:-31,maxX:31,minZ:-28,maxZ:28},base:-4,ceiling:23}};
 const game={chamberEdition:'foundation',keyLight:light,firstLevel:level};return{game,light,level};
}

test('room-fitting retains the light bearing and covers the original front-lit room without pretending to cover its rear depth',()=>{
 const {game,light,level}=fixture(),position=light.position.clone(),target=light.target.position.clone();
 const owner=installObservatoryShadows(game,level),r=owner.report;
 assert.deepEqual(cameraState(light),{left:-46,right:46,bottom:-36,top:51,near:1,far:68});
 assert.ok(light.position.equals(position)&&light.target.position.equals(target),'Fitting must not move the key above the closed roof');
 assert.equal(r.coverage.preservesAuthoredNearPlane,true);assert.equal(r.coverage.fullRoomDepthCovered,false);assert.ok(r.coverage.rearmostDepth<1);
 assert.ok(r.worldTexel<160/1024);assert.equal(r.normalBias,.04);assert.equal(r.wallNormalBias,.134765625);assert.ok(r.wallNormalBias<.15);
 assert.equal(r.receiverPolicy,'vertical-service-bay-only');assert.equal(r.depthBiasWorld,-.00015*199);
 assert.equal(r.bias*(r.camera.far-r.camera.near),-.00015*199);
 const point=new THREE.Vector3();
 for(const corner of r.coverage.corners){
  point.fromArray(corner).applyMatrix4(light.shadow.camera.projectionMatrix);
  assert.ok(Math.abs(point.x)<1&&Math.abs(point.y)<1,'An authored room corner escaped the fitted horizontal/vertical volume');
  if(-corner[2]>=1)assert.ok(point.z>=-1&&point.z<=1,'Fitting removed a point in the original forward shadow volume');
 }
 assert.equal(light.castShadow,true);owner.release();
});

test('preset refresh preserves warmed maps, respects disabled low shadows and restores only owned state',()=>{
 const {game,light,level}=fixture(),original={camera:cameraState(light),bias:light.shadow.bias,normalBias:light.shadow.normalBias};
 const owner=installObservatoryShadows(game,level),balanced=owner.report.wallNormalBias;
 let disposals=0;const warm=new THREE.WebGLRenderTarget(1024,1024);warm.addEventListener('dispose',()=>disposals++);light.shadow.map=warm;
 applyLabQuality(game,'balanced');assert.equal(light.shadow.map,warm);assert.equal(disposals,0);
 assert.equal(light.castShadow,true);assert.equal(owner.report.wallNormalBias,balanced);assert.equal(light.shadow.normalBias,.04);
 applyLabQuality(game,'high');assert.equal(disposals,1);assert.equal(light.shadow.map,null);assert.deepEqual(light.shadow.mapSize.toArray(),[2048,2048]);
 assert.equal(owner.report.wallNormalBias,balanced/2);assert.equal(light.shadow.normalBias,.04);
 assert.equal(owner.report.bias*(owner.report.camera.far-owner.report.camera.near),-.00015*199);
 applyLabQuality(game,'low');assert.equal(light.castShadow,false);assert.equal(game.quality.shadows,false);assert.deepEqual(light.shadow.mapSize.toArray(),[512,512]);
 assert.ok(owner.report.wallNormalBias<=.15);assert.equal(light.shadow.normalBias,.04);assert.equal(light.shadow.map,null);
 owner.release();owner.release();assert.equal(owner.disposed,true);assert.equal(level.observatoryShadow,undefined);
 assert.deepEqual(cameraState(light),original.camera);assert.equal(light.shadow.bias,original.bias);assert.equal(light.shadow.normalBias,original.normalBias);
 assert.equal(light.shadow.needsUpdate,true);assert.equal(disposals,1);assert.equal(light.castShadow,false);assert.deepEqual(light.shadow.mapSize.toArray(),[512,512]);
 const restored=cameraState(light);owner.refresh();assert.deepEqual(cameraState(light),restored);
});

test('only owned bay receivers extend the directional lookup; quality changes update its uniform without changing material or hooks',()=>{
 const {game,light,level}=fixture(),root=new THREE.Group();level.world={root};
 const bay=new THREE.MeshStandardMaterial({name:'Observatory / recessed structural service bays',vertexColors:true});
 const floor=new THREE.MeshStandardMaterial({name:'Honed mineral walking deck'}),actor=new THREE.MeshStandardMaterial({name:'Original actor material'});
 const meshes=[new THREE.Mesh(new THREE.BoxGeometry(),bay),new THREE.Mesh(new THREE.BoxGeometry(),floor),new THREE.Mesh(new THREE.BoxGeometry(),actor)];root.add(...meshes);
 let priorCalls=0,disposals=0;bay.addEventListener('dispose',()=>disposals++);
 const previous=function(shader){priorCalls++;shader.vertexShader='// original hook\n'+shader.vertexShader;};
 const cache=()=> 'original-bay-program';bay.onBeforeCompile=previous;bay.customProgramCacheKey=cache;
 const unowned=[floor,actor].map(material=>[material,material.onBeforeCompile,material.customProgramCacheKey]);
 const owner=installObservatoryShadows(game,level),compile=bay.onBeforeCompile,cacheKey=bay.customProgramCacheKey;
 assert.equal(owner.report.receiverMaterialCount,1);assert.equal(owner.report.receiverMeshCount,1);
 const shader={uniforms:{},vertexShader:'void main() {\n#include <shadowmap_vertex>\n}\n'};compile.call(bay,shader,null);
 assert.equal(priorCalls,1);assert.ok(shader.vertexShader.includes('// original hook'));
 assert.ok(!shader.vertexShader.includes('#include <shadowmap_vertex>'),'The installed receiver must expand the real installed Three.js chunk');
 assert.ok(shader.vertexShader.includes('abs(shadowWorldNormal.y)'),'Horizontal support faces need their original query position');
 assert.ok(shader.vertexShader.includes('shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias'),'Other shadow light types must remain unchanged');
 const extra=shader.uniforms.observatoryWallShadowExtra;assert.equal(extra.value,owner.report.wallNormalBias-.04);
 const version=bay.version;applyLabQuality(game,'high');assert.equal(bay.version,version);assert.equal(bay.onBeforeCompile,compile);assert.equal(bay.customProgramCacheKey,cacheKey);
 assert.equal(extra.value,owner.report.wallNormalBias-.04);assert.equal(light.shadow.normalBias,.04);
 assert.throws(()=>compile.call(bay,{uniforms:{},vertexShader:'void main() {}'},null),/original Three.js directional shadow receiver chunk/);
 for(let i=0;i<meshes.length;i++)assert.equal(meshes[i].material,[bay,floor,actor][i],'The receiver policy must not replace any material');
 for(const [material,hook,key]of unowned){assert.equal(material.onBeforeCompile,hook);assert.equal(material.customProgramCacheKey,key);}
 owner.release();owner.release();assert.equal(extra.value,0);assert.equal(bay.onBeforeCompile,previous);assert.equal(bay.customProgramCacheKey,cache);assert.equal(disposals,0);
 for(const mesh of meshes)mesh.geometry.dispose();bay.dispose();floor.dispose();actor.dispose();
});

test('the policy does not alter other editions, other rooms or missing lights',()=>{
 for(const [edition,index]of [['foundation',29],['foundation',40],['classic',30],['open',30]]){
  const {game,light,level}=fixture();game.chamberEdition=edition;level.index=index;const camera=cameraState(light);
  assert.equal(installObservatoryShadows(game,level),null);assert.deepEqual(cameraState(light),camera);assert.equal(light.shadow.normalBias,.04);
 }
 const {game,level}=fixture();delete game.keyLight;assert.equal(installObservatoryShadows(game,level),null);
 const {light}=fixture();assert.throws(()=>observatoryShadowPlan(light,{bounds:{},base:0,ceiling:20}),/finite enclosed room/);
});

let g;
before(async()=>{
 g=await createHeadlessGame();Object.assign(g,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});
 g.keyLight=new THREE.DirectionalLight();g.keyLight.position.set(-7,30,14);g.keyLight.target.position.set(0,0,-14.5);
 Object.assign(g.keyLight.shadow.camera,{left:-20,right:20,top:48,bottom:-48,near:1,far:100});g.keyLight.shadow.bias=-.00015;g.keyLight.shadow.normalBias=.04;
 g.scene.add(g.keyLight,g.keyLight.target);applyLabQuality(g,'balanced');
});
after(()=>disposeLabLevel(g));

for(let index=30;index<40;index++)test(`ordinary observatory ${index+1} retains casters/receivers and a fixed room frustum across quality changes`,async()=>{
 await g.selectLevel(index,true);const l=g.firstLevel,owner=l.observatoryShadow;assert.ok(owner);assert.equal(l.opticsArchitecture.shadows,owner);
 // The normal first visual update synchronizes animated skin/bone matrices.
 // Inspect actual visible casters, including the original two travellers,
 // instead of treating an unrendered skin's cached bounds as its live pose.
 g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,1);g.scene.updateMatrixWorld(true);
 g.keyLight.updateWorldMatrix(true,false);g.keyLight.target.updateWorldMatrix(true,false);g.keyLight.shadow.updateMatrices(g.keyLight);
 const shadowPoint=new THREE.Vector3(),checkPoint=(x,y,z,name)=>{
  shadowPoint.set(x,y,z).project(g.keyLight.shadow.camera);
  assert.ok(Math.abs(shadowPoint.x)<=1.00001&&Math.abs(shadowPoint.y)<=1.00001&&shadowPoint.z<=1.00001,`${name} escaped fitted shadow XY/far coverage`);
  // The original near plane is deliberately unchanged; the report explicitly
  // retains rear-depth limitations rather than calling them full coverage.
 };
 g.scene.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.visible||!mesh.castShadow)return;
  for(let parent=mesh.parent;parent;parent=parent.parent)if(!parent.visible)return;
  const b=new THREE.Box3().setFromObject(mesh);
  for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])checkPoint(x,y,z,mesh.name);
 });
 for(const machine of Object.values(l.workshop.state))if(machine?.floor&&Array.isArray(machine.stations)&&machine.position){
  const f=machine.floor,p=machine.position;
  for(const station of machine.stations)for(const x of [f.minX-p.x,f.maxX-p.x])for(const z of [f.minZ-p.z,f.maxZ-p.z])for(const y of [0,3])
   checkPoint(station.x+x,station.y+y,station.z+z,machine.name+' station and standing traveller');
 }
 const inventory=flags(g.scene),pose=[...g.keyLight.position.toArray(),...g.keyLight.target.position.toArray()];
 assert.ok(inventory.some(([,cast,receive])=>cast&&receive),'The actual room lost all two-way shadow participants');
 for(const name of ['balanced','high','low','balanced']){
  applyLabQuality(g,name);const r=owner.report,profile=QUALITY_PRESETS[name];assert.deepEqual(r.mapSize,[profile.shadowSize,profile.shadowSize]);
  assert.equal(g.keyLight.castShadow,profile.shadows);assert.equal(g.quality.shadows,profile.shadows);
  assert.ok(r.camera.right-r.camera.left<160&&r.camera.top-r.camera.bottom<160);assert.equal(r.camera.near,1);assert.ok(r.camera.far<200);
  assert.ok(Number.isFinite(r.bias)&&r.bias<0);assert.equal(r.normalBias,.04);assert.equal(g.keyLight.shadow.normalBias,.04);
  assert.ok(r.wallNormalBias>=r.normalBias&&r.wallNormalBias<=.15);
  // The impact-rotor hall has no eligible wall-sized service-bay material.
  // Its fitted frustum must not imply an invented extra receiver cohort.
  assert.equal(r.receiverMaterialCount,index===35?0:1);
  assert.ok(Math.abs(r.bias*(r.camera.far-r.camera.near)-r.depthBiasWorld)<1e-12,'Fitted depth changed the original world-space receiver offset');
  assert.deepEqual([...g.keyLight.position.toArray(),...g.keyLight.target.position.toArray()],pose);
  for(const [mesh,cast,receive]of inventory){assert.equal(mesh.castShadow,cast);assert.equal(mesh.receiveShadow,receive);}
 }
 const camera=cameraState(g.keyLight);l.update(.1);l.renderUpdate(1);assert.deepEqual(cameraState(g.keyLight),camera,'Moving subjects must not make the shadow frustum crawl');
 const ownerAgain=installObservatoryShadows(g,l);assert.equal(ownerAgain,owner);
});

test('leaving the observatory restores the preceding key depth offsets without carrying a chapter policy into the next room',async()=>{
 await g.selectLevel(30,true);const owner=g.firstLevel.observatoryShadow;assert.ok(owner.report.wallNormalExtra>0);assert.notEqual(g.keyLight.shadow.bias,-.00015);
 await g.selectLevel(29,true);assert.equal(owner.disposed,true);assert.equal(g.firstLevel.observatoryShadow,undefined);
 assert.equal(g.keyLight.shadow.bias,-.00015);assert.equal(g.keyLight.shadow.normalBias,.04);
});
