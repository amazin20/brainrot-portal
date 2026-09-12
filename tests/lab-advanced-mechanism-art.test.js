import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {LabGame} from '../src/game/LabGame.js';
import {Workshop} from '../src/game/LabWorkshopKit.js';
import {opticalLift} from '../src/game/LabRoom13Mechanics.js';
import {buildTransferFunnel} from '../src/game/LabTransferFunnel.js';
import {finishAdvancedRoom,advancedRoomPalette} from '../src/game/LabAdvancedArchitecture.js';
import {upgradeBrowser3DArt} from '../src/game/LabBrowser3DArt.js';
import {applyPremiumBrowser3DArt} from '../src/game/LabBrowser3DPremium.js';
import {applyAdvancedMechanismArt} from '../src/game/LabAdvancedMechanismArt.js';
import {applyMechanismReflections} from '../src/game/LabMechanismReflections.js';
import {createMachinedTurbine} from '../src/game/LabMachinedModels.js';

const assets=await createHeadlessGame();
after(()=>{assets.physics.dispose();assets.portals.dispose();});
const V=(...v)=>new THREE.Vector3(...v);
function chamber(index){
 const game=new LabGame({container:null,touch:false});
 game.assets=assets.assets;game.levelIndex=index;game.scene=new THREE.Scene();game.camera=assets.camera.clone();
 game.materials=Object.fromEntries(Object.entries(assets.materials).map(([key,material])=>[key,material.clone()]));
 game.cargo={position:V(10,.55,9),velocity:V(),quaternion:new THREE.Quaternion()};game.portals={ready:false};
 const spec={id:'art-contract-fixture',title:'Contract fixture',accent:0x7edee8,hints:[],description:'Physical render-contract fixture'};
 const kit=new Workshop(game,spec,index);kit.shell({minX:-14,maxX:14,minZ:-12,maxZ:12},18);
 return {game,kit,spec};
}

test('new machinery metadata follows real moving mechanisms without changing their physical registries',()=>{
 const {game,kit,spec}=chamber(19),w=kit.world;
 kit.panel('service',[-13.8,3,6],[1,0,0],5.6,4.6);
 const lift=opticalLift(kit,'test-lift',[-6,3,-5],{top:10});
 const surface=w.surfaces.find(s=>s.name==='test-lift');
 const field=buildTransferFunnel(kit,{origin:[-8,2,0],direction:[1,0,0],radius:2.15});
 const pivot=new THREE.Group();pivot.position.set(3,5,-4);pivot.rotation.y=.36;w.root.add(pivot);
 const mirror=w.box([0,0,0],[.11,2.4,2.2],new THREE.MeshStandardMaterial({metalness:.92,roughness:.12}),false,pivot);
 mirror.userData.mechanismMirror=true;
 const level=kit.finish([8,0,8],[10,.55,9],[8,0,-8],{workshop:kit,spec});
 level.mechanismArt={projectors:[{position:[-10,7,-8],direction:[1,0,0],radius:.6}],turbines:[field],liftSurfaces:[surface,'test-lift'],gimbals:[{pivot}]};
 const keys=['colliders','floors','portalPanels','cameraBlockers','aimBlockers'];
 const before=Object.fromEntries(keys.map(key=>[key,[...game[key]]]));
 const physicalBoxes=game.colliders.map(c=>c.box.clone());
 const force=field.acceleration(V(-2,2,0),V(),.5);
 finishAdvancedRoom(level);upgradeBrowser3DArt(level);applyPremiumBrowser3DArt(level);applyMechanismReflections(level);
 assert.deepEqual(level.advancedMechanismArt.userData.stats,{projectors:1,turbines:1,liftChassis:1,gimbals:1});
 for(const key of keys)assert.deepEqual(game[key],before[key],`${key} must keep the same objects and order`);
 game.colliders.forEach((c,i)=>assert.ok(c.box.equals(physicalBoxes[i])));
 assert.ok(field.acceleration(V(-2,2,0),V(),.5).equals(force));
 assert.equal(field.housing.visible,true);assert.equal(field.housing.material.visible,false);
 assert.ok(game.colliders.some(c=>c.mesh===field.housing));
 assert.equal(mirror.material.envMap,level.mechanismReflections.texture);
 assert.equal(level.mechanismReflections.stats.mirrors,1);
 const chassis=surface.group.getObjectByName('Browser 3D machine chassis');
 const checkDeck=()=>{
  w.root.updateWorldMatrix(true,true);
  assert.ok(new THREE.Box3().setFromObject(chassis).max.y<surface.getFrame().center.y-.075);
  const normal=surface.getFrame().normal;
  assert.ok(V(0,1,0).applyQuaternion(chassis.getWorldQuaternion(new THREE.Quaternion())).dot(normal)>.999999);
 };
 checkDeck();lift.powered=true;for(let i=0;i<90;i++)lift.update(1/60);checkDeck();
 const ring=pivot.getObjectByName('optical-ring'),base=level.advancedMechanismArt.getObjectByName('Browser 3D optical gimbal');
 w.root.updateWorldMatrix(true,true);const baseMatrix=base.matrixWorld.clone(),ringMatrix=ring.matrixWorld.clone();
 pivot.rotation.y+=.75;w.root.updateWorldMatrix(true,true);
 assert.ok(base.matrixWorld.equals(baseMatrix));assert.ok(!ring.matrixWorld.equals(ringMatrix));
 const turbine=level.advancedMechanismArt.getObjectByName('Browser 3D transfer-field turbine'),rotor=turbine.getObjectByName('transfer-rotor');
 for(let i=0;i<30;i++)level.update(1/60);
 level.renderUpdate(0);const prior=rotor.rotation.z;level.renderUpdate(1);assert.ok(rotor.rotation.z>prior);
 field.reversed=true;level.renderUpdate(1);
 const signals=[];turbine.traverse(n=>{if(n.material?.name==='Recessed signal glass')signals.push(n.material);});
 assert.ok(signals.length>0&&signals.every(m=>m.color.getHex()===0xf5ad75));
 const cached=createMachinedTurbine({radius:2.15,accent:spec.accent});
 cached.traverse(n=>{if(n.material?.name==='Recessed signal glass')assert.equal(n.material.color.getHex(),spec.accent,'animation must not tint the shared master');});
 const roots=w.root.children.length,ticks=kit.ticks.length;applyAdvancedMechanismArt(level);
 assert.equal(w.root.children.length,roots);assert.equal(kit.ticks.length,ticks);
});

test('rooms 16–20 retain distinct muted finishes and complete two-digit wall numbers',()=>{
 const colors=new Set();
 for(const [index,litCells] of [[15,20],[16,15],[17,21],[18,20],[19,20]]){
  const {game,kit,spec}=chamber(index);
  const lesson={text:'Author-owned lesson'},view={yaw:.35,pitch:.2};
  const level=kit.finish([0,0,8],[2,.55,8],[0,0,-8],{workshop:kit,spec,conceptLesson:lesson,spawnView:view});
  finishAdvancedRoom(level);
  assert.equal(level.conceptLesson,lesson);assert.equal(level.spawnView,view);
  const number=level.architecture.getObjectByName('Inlaid light inserts and room number');
  assert.equal(number.count,litCells,`room ${index+1} must paint both number glyphs`);
  upgradeBrowser3DArt(level);applyPremiumBrowser3DArt(level);
  const palette=advancedRoomPalette(index);colors.add(palette.wall);
  assert.equal(level.world.materials.wall.color.getHex(),palette.wall);
  assert.equal(game.scene.background.getHex(),palette.sky);
  assert.ok(level.premiumBrowser3DArt.userData.stats.instances>20);
  for(const surface of level.world.surfaces)assert.ok(surface.group.children.some(n=>n.isInstancedMesh&&n.geometry!==level.world.tileGeometry));
 }
 assert.equal(colors.size,5);
});
