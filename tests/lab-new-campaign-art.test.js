import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {LabGame} from '../src/game/LabGame.js';
import {buildRoom22} from '../src/game/LabPortalRoom22.js';
import {buildRoom23} from '../src/game/LabPortalRoom23.js';
import {buildRoom24} from '../src/game/LabPortalRoom24.js';
import {buildRoom25} from '../src/game/LabPortalRoom25.js';
import {buildRoom26} from '../src/game/LabPortalRoom26.js';
import {finishAdvancedRoom,advancedRoomPalette} from '../src/game/LabAdvancedArchitecture.js';
import {upgradeBrowser3DArt} from '../src/game/LabBrowser3DArt.js';
import {applyPremiumBrowser3DArt} from '../src/game/LabBrowser3DPremium.js';
import {applyMechanismReflections} from '../src/game/LabMechanismReflections.js';
import {architecturalRectOverlapsPortal} from '../src/game/LabArchitecturalModels.js';
import {gameplayContract} from './helpers/lab-art-contract.js';

const assets=await createHeadlessGame();
after(()=>{assets.physics.dispose();assets.portals.dispose();});
const builders=[buildRoom22,buildRoom23,buildRoom24,buildRoom25,buildRoom26];
const accents=[0xa2d2bd,0xd9bb87,0xc8bc87,0xcab48c,0xe2ad79];
const V=(...values)=>new THREE.Vector3(...values);
function rawRoom(room){
 const game=new LabGame({container:null,touch:false});
 game.assets=assets.assets;game.levelIndex=room-1;game.scene=new THREE.Scene();game.camera=assets.camera.clone();
 game.materials=Object.fromEntries(Object.entries(assets.materials).map(([key,material])=>[key,material.clone()]));
 game.cargo={position:V(100,100,100),velocity:V(),quaternion:new THREE.Quaternion()};
 game.portals={ready:false};game.audio=assets.audio;game.label=()=>new THREE.Object3D();
 const level=builders[room-22](game,room-1);game.firstLevel=level;
 return {game,level};
}
function artRayClear(meshes,origin,direction,length){
 const ray=new THREE.Raycaster(V(...origin),V(...direction),0,length);
 const hits=ray.intersectObjects(meshes,false).filter(hit=>hit.object.material?.visible!==false);
 assert.equal(hits.length,0,`new art covers the open sight line at ${origin}: ${hits[0]?.object.name}`);
}

for(let room=22;room<=26;room++)test(`room ${room} premium art preserves physical frames and visible apertures`,()=>{
 const {game,level}=rawRoom(room),world=level.world;
 const oldNodes=new Set();world.root.traverse(node=>oldNodes.add(node));
 const before=gameplayContract(game);
 const registries=Object.fromEntries(['colliders','portalPanels','floors','cameraBlockers','aimBlockers'].map(key=>[key,[...game[key]]]));
 finishAdvancedRoom(level);upgradeBrowser3DArt(level);applyPremiumBrowser3DArt(level);applyMechanismReflections(level);
 assert.deepEqual(gameplayContract(game),before,'art must not change physics, frames, viewing gaps or state');
 for(const [key,items] of Object.entries(registries))assert.deepEqual(game[key],items,`${key} identity/order changed`);
 const palette=advancedRoomPalette(room-1);
 assert.equal(palette.edge,accents[room-22]);
 assert.equal(world.root.userData.browserArtMaterials.lamp.color.getHex(),accents[room-22]);
 assert.equal(world.materials.wall.color.getHex(),palette.wall);
 assert.equal(game.scene.background.getHex(),palette.sky);
 assert.ok(level.browser3DArt?.userData.visualOnly);
 const premium=level.premiumBrowser3DArt;
 assert.ok(premium?.userData.stats.instances>30);
 assert.ok(premium.userData.stats.batches<=8,'cladding should remain a small fixed number of draw batches');
 assert.equal(premium.userData.stats.pointLights,0);
 for(const surface of world.surfaces)assert.ok(surface.group.children.some(node=>node.isInstancedMesh&&node.geometry!==world.tileGeometry),'all surfaces use the authored source kit');
 for(const coverage of premium.userData.architecturalCoverage){
  const rect={...coverage,center:V(...coverage.center),right:V(...coverage.right),up:V(...coverage.up),normal:V(...coverage.normal)};
  for(const surface of Object.values(level.panels))assert.equal(architecturalRectOverlapsPortal(rect,surface.getFrame(),0),false,`cladding covers portal ${surface.name}`);
 }
 world.root.updateWorldMatrix(true,true);
 const addedMeshes=[];world.root.traverse(node=>{if(node.isMesh&&!oldNodes.has(node))addedMeshes.push(node);});
 if(room===22){
  for(const z of [-3,0,3])for(const y of [3.2,5,7.8])artRayClear(addedMeshes,[-.7,y,z],[1,0,0],1.4);
  for(const z of [-21,-18,-15])for(const y of [11.5,13.5,15.8])artRayClear(addedMeshes,[-.7,y,z],[1,0,0],1.4);
 }
 if(room===23){
  assert.equal(level.advancedMechanismArt.userData.stats.liftChassis,2);
  for(const name of ['west-load-car','east-load-car']){
   const surface=level.panels[name],chassis=surface.group.getObjectByName('Browser 3D machine chassis');
   assert.ok(chassis);
   assert.ok(new THREE.Box3().setFromObject(chassis).max.y<surface.getFrame().center.y-.075,'chassis must stay behind the moving portal plane');
  }
 }
 if(room===25){
  for(const z of [16,20,24])for(const y of [14.35,14.9,15.4])artRayClear(addedMeshes,[-11.4,y,z],[1,0,0],1.2);
  assert.equal(level.advancedMechanismArt.userData.stats.projectors,1);
  assert.equal(level.advancedMechanismArt.userData.stats.liftChassis,2);
 }
 if(room===26){
  assert.equal(level.advancedMechanismArt.userData.stats.turbines,2);
  assert.ok(level.mechanismReflections.stats.meshes>0);
  for(const name of ['first-shaft','relay-shaft']){
   const f=level.panels[name].getFrame();
   artRayClear(addedMeshes,f.center.clone().addScaledVector(f.normal,.15).toArray(),f.normal.clone().negate().toArray(),.9);
  }
 }
 const children=world.root.children.length,ticks=level.workshop.ticks.length,renders=level.workshop.renders.length;
 upgradeBrowser3DArt(level);applyPremiumBrowser3DArt(level);applyMechanismReflections(level);
 assert.equal(world.root.children.length,children);assert.equal(level.workshop.ticks.length,ticks);assert.equal(level.workshop.renders.length,renders);
});

test('all five appended chambers have different industrial palettes',()=>{
 assert.equal(new Set(Array.from({length:5},(_,i)=>advancedRoomPalette(21+i).wall)).size,5);
});
