import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {LabGame} from '../src/game/LabGame.js';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {LabPortals} from '../src/game/LabPortals.js';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {CAMPAIGN,finishBrowserArt} from '../src/game/LabCampaignLevels.js';
import {buildLabCampaignLevel as buildIntroductory} from '../src/game/LabIntroductoryCampaign.js';
import {buildExtendedCampaign} from '../src/game/LabExtendedCampaign.js';
import {buildWorkshopCampaign} from '../src/game/LabWorkshopCampaign.js';
import {buildReadableWindRoom} from '../src/game/LabWindRoom.js';
import {addExplorationSurfaces} from '../src/game/LabExplorationSurfaces.js';
import {gameplayContract,digest,sceneWorkload} from './helpers/lab-art-contract.js';

const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/early-art-v35-contract.json',import.meta.url)));
const assets=await createHeadlessGame();
after(()=>disposeLabLevel(assets));
const V=(...p)=>new THREE.Vector3(...p);
const registries=['colliders','floors','portalPanels','cameraBlockers','aimBlockers'];

for(const expected of baseline.rooms)test(`room ${expected.level} matches the audited physical and interaction contract`,async()=>{
 if(assets.levelIndex!==expected.level-1)await assets.selectLevel(expected.level-1,false);
 assert.equal(digest(gameplayContract(assets)),expected.contract,
  'Authored colliders, portal frames, support geometry, camera blockers or interaction state changed');
 const workload=sceneWorkload(assets),level=assets.firstLevel;
 if(expected.level>11){
  assert.equal(workload.triangles,expected.workload.triangles,'Batching must retain every visible source triangle');
  assert.equal(workload.lights,expected.workload.lights,'Batching must retain the lighting');
  // Two hidden, preallocated portal visuals add six materials. They avoid
  // allocation/compilation at the first shot and are not architectural art.
  assert.equal(workload.materials,expected.workload.materials+6,'Only the reusable portal materials may be added');
  assert.ok(workload.visibleMeshes<=expected.workload.visibleMeshes,'Static batching must not add visible draw objects');
  assert.equal(level.earlyMechanismArt,undefined,'Early-room details leaked into a later room');
 }else{
  assert.ok(level.browser3DArt?.userData.visualOnly&&level.premiumBrowser3DArt?.userData.visualOnly);
  assert.ok(level.earlyMechanismArt?.userData.visualOnly);
  assert.ok(workload.triangles<expected.workload.triangles+50000,'Art exceeds the additional 50,000 source triangle budget, including instances');
  assert.ok(workload.visibleMeshes<expected.workload.visibleMeshes+120,'Detail should use shared batches rather than hundreds of new draws');
  assert.equal(workload.lights,expected.workload.lights+1,'The shared premium edge light is the only added light');
  for(const surface of level.world.surfaces.filter(s=>s.portal))surface.group.traverse(n=>{
   if(n.isInstancedMesh&&n.userData.portalTile)assert.equal(n.material,level.world.materials.ceramic,'Portal tiles must retain canonical readable ceramic');
  });
  const before=gameplayContract(assets),stats=sceneWorkload(assets);
  finishBrowserArt(level);
  assert.deepEqual(gameplayContract(assets),before,'Applying the art finish twice must not alter the level');
  assert.deepEqual(sceneWorkload(assets),stats,'Repeated art finishing must not duplicate geometry or materials');
 }
});

function rawGame(index){
 const game=new LabGame({container:null,touch:false});
 game.assets=assets.assets;game.levelIndex=index;game.scene=new THREE.Scene();game.camera=assets.camera.clone();
 game.materials=Object.fromEntries(Object.entries(assets.materials).map(([name,m])=>[name,m.clone()]));
 game.audio=assets.audio;game.label=()=>new THREE.Object3D();
 game.cargo={position:V(100,100,100),velocity:V(),quaternion:new THREE.Quaternion()};
 game.portals=new LabPortals({scene:game.scene,camera:game.camera,renderer:null,maxResolution:64,samples:0});
 let level=index===10?buildReadableWindRoom(game,CAMPAIGN[index]):index>=8?buildWorkshopCampaign(game,index):
  index<5?buildIntroductory(game,index):buildExtendedCampaign(game,index);
 if(index<8)level=addExplorationSurfaces(game,level,index);
 game.firstLevel=level;game.playerPosition.fromArray(level.spawn);game.previousPlayerPosition.copy(game.playerPosition);
 game.cargo.position.fromArray(level.cargoSpawn);game.playerGrounded=false;
 game.physics=new LabPhysics({fixedStep:1/120});
 for(const c of game.colliders)game.physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:!!c.kinematic,enabled:c.enabled!==false});
 game.physics.createCargo({position:game.cargo.position,size:.78,mass:3.2});
 level.reset();game.levelRoots=[...game.scene.children];return game;
}

function stimulate(game,frame){
 const level=game.firstLevel;
 if(frame===0)level.terminals[0]?.action?.();
 if(level.pads[0]?.mechanism){
  const f=level.pads[0].mechanism.getLoadFrame();
  game.cargo.position.copy(f.center).addScaledVector(f.normal,.39);
 }
 level.update(1/60);level.renderUpdate((frame%5)/4);
}

for(const room of [2,4,5,6,7,8,9,10,11])test(`room ${room} render fittings preserve the original mechanisms throughout motion`,()=>{
 const plain=rawGame(room-1),detailed=rawGame(room-1);
 try{
  const references=Object.fromEntries(registries.map(key=>[key,[...detailed[key]]]));
  finishBrowserArt(detailed.firstLevel);
  for(const key of registries){
   assert.equal(detailed[key].length,references[key].length,`${key} acquired an art object`);
   references[key].forEach((value,i)=>assert.equal(detailed[key][i],value,`${key} identity/order changed`));
  }
  assert.deepEqual(gameplayContract(detailed),gameplayContract(plain),'The finish changed initial authored geometry');
  for(let frame=0;frame<180;frame++){
   stimulate(plain,frame);stimulate(detailed,frame);
   if(frame%30===0||frame===179)assert.deepEqual(gameplayContract(detailed),gameplayContract(plain),`Mechanics diverged at frame ${frame}`);
  }
  // New model roots stay outside the traversed collision and aim trees.
  const art=detailed.firstLevel.earlyMechanismArt,visuals=new Set();art.traverse(n=>visuals.add(n));
  for(const key of registries)for(const entry of detailed[key])assert.equal(visuals.has(entry.mesh??entry),false);
  const targets={4:[['Early lift / moving chassis mount',detailed.firstLevel.lift?.group]],
   6:[['Early optics / moving mirror mount',detailed.firstLevel.mechanismArt?.earlyOptics?.mirror.group]],
   7:[['Balance rocker / moving load frame',detailed.firstLevel.state?.rig?.moving]],
   9:[['Spring press / moving impact chassis',detailed.firstLevel.state?.piston?.top]],
   10:[['Freight span / moving service frame',detailed.firstLevel.state?.freight?.model?.moving]]};
  for(const alpha of [0,.25,.5,.75,1]){
   detailed.firstLevel.renderUpdate(alpha);plain.firstLevel.renderUpdate(alpha);
   detailed.scene.updateMatrixWorld(true);
   for(const [name,target] of targets[room]??[]){
    const mount=art.getObjectByName(name);assert.ok(mount&&target,`Missing real pivot follower ${name}`);
    mount.matrixWorld.elements.forEach((v,i)=>assert.ok(Math.abs(v-target.matrixWorld.elements[i])<1e-9,`${name} failed to follow interpolation ${alpha}`));
   }
   assert.deepEqual(gameplayContract(detailed),gameplayContract(plain),'Visual interpolation changed the physical contract');
  }
 }finally{disposeLabLevel(plain);disposeLabLevel(detailed);}
});
