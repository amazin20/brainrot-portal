import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {FOUNDATION_BUILDERS} from '../src/game/LabFoundationChambers.js';
import {buildExtendedCampaign} from '../src/game/LabExtendedCampaign.js';
import {buildWorkshopCampaign} from '../src/game/LabWorkshopCampaign.js';
import {buildReadableWindRoom} from '../src/game/LabWindRoom.js';
import {buildRoom12} from '../src/game/LabPortalRoom12.js';
import {buildRoom13} from '../src/game/LabPortalRoom13.js';
import {buildRoom14} from '../src/game/LabPortalRoom14.js';
import {buildRoom15} from '../src/game/LabPortalRoom15.js';
import {buildRoom16} from '../src/game/LabPortalRoom16.js';
import {buildCreative17} from '../src/game/LabCreativeRoom17.js';
import {CAMPAIGN,finishBrowserArt} from '../src/game/LabCampaignLevels.js';
import {finishVisualAuditEarly,earlyStructuralSection} from '../src/game/LabVisualAuditEarly.js';
import {serviceMassGeometry,treadChassisGeometry} from '../src/game/LabEarlyMachineConstruction.js';
import {gameplayContract} from './helpers/lab-art-contract.js';
import {originalRoom9Contract,originalRoom11Contract} from './helpers/lab-early-construction-contract.js';

const game=await createHeadlessGame();game.chamberEdition='foundation';
after(()=>disposeLabLevel(game));
const late=[buildRoom12,buildRoom13,buildRoom14,buildRoom15,buildRoom16];
function bare(index){
 disposeLabLevel(game);game.levelIndex=index;
 const before=new Set(game.scene.children);
 const l=index<5?FOUNDATION_BUILDERS[index](game,index):index<8?finishBrowserArt(buildExtendedCampaign(game,index)):
  index<10?finishBrowserArt(buildWorkshopCampaign(game,index)):index===10?finishBrowserArt(buildReadableWindRoom(game,CAMPAIGN[index])):
  index<16?finishBrowserArt(late[index-11](game,index)):buildCreative17(game,index);
 game.firstLevel=l;game.levelRoots=game.scene.children.filter(n=>!before.has(n));return l;
}

test('rolled supports retain the exact closed source extents with finite hard normals',()=>{
 for(const size of [[.13,2.5,.81],[.22,12,.24],[.35,7,.35],[.65,6,.65]]){
  const geometry=earlyStructuralSection(...size),b=geometry.boundingBox;
  for(let axis=0;axis<3;axis++){
   assert.ok(Math.abs(b.min.getComponent(axis)+size[axis]/2)<1e-6);
   assert.ok(Math.abs(b.max.getComponent(axis)-size[axis]/2)<1e-6);
  }
  assert.ok(geometry.attributes.position.array.every(Number.isFinite));
  assert.ok(geometry.attributes.normal.array.every(Number.isFinite));geometry.dispose();
 }
});

test('fabricated process bodies retain walking roofs and all frame extrema while forming actual service recesses',()=>{
 for(const size of [[18,12,11],[8,25,34],[6.4,1.4,.65],[7,5.6,6]]){
  const g=serviceMassGeometry(...size),b=g.boundingBox,p=g.attributes.position;
  for(let a=0;a<3;a++){
   assert.ok(Math.abs(b.min.getComponent(a)+size[a]/2)<1e-6);
   assert.ok(Math.abs(b.max.getComponent(a)-size[a]/2)<1e-6);
   for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getComponent(i,a))<=size[a]/2+1e-6);
  }
  assert.ok(g.attributes.normal.array.every(Number.isFinite));
  const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const hit=new THREE.Raycaster(new THREE.Vector3(0,size[1]/2+1,0),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0];
  assert.ok(Math.abs(hit.point.y-size[1]/2)<1e-6,'The physical walking roof must remain the rendered roof');
  const depths=new Set();for(let i=0;i<p.count;i++)if(p.getZ(i)>size[2]/2-.30&&Math.abs(p.getX(i))<size[0]/2-.01)depths.add(Math.round(p.getZ(i)*1e5));
  assert.ok(depths.size>=4,'The service frame, covers, stiffeners and vent well must have genuinely different depths');
  g.dispose();mesh.material.dispose();
 }
});

test('stair channels follow the actual rise continuously inside both original tread-body profiles',()=>{
 for(const [w,h,d,r]of [[3,.4,.45,-.23],[4,.35,.43,-5.4/22]]){
  const g=treadChassisGeometry(w,h,d,r),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
   assert.ok(Math.abs(p.getX(i))<=w/2+1e-6&&Math.abs(p.getY(i))<=h/2+1e-6&&Math.abs(p.getZ(i))<=d/2+1e-6);
  }
  const at=z=>{const ys=[];for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))>w*.47&&Math.abs(p.getZ(i)-z)<1e-6)ys.push(p.getY(i));return [Math.min(...ys),Math.max(...ys)];};
  const left=at(-d/2),right=at(d/2);
  for(let i=0;i<2;i++)assert.ok(Math.abs(right[i]-left[i]-r)<1e-6,'An adjacent tread translated by its actual rise must meet the same inclined side channel');
  assert.ok(g.attributes.normal.array.every(Number.isFinite));g.dispose();
 }
});

test('the approved gantry and service bus bounds cannot exempt extra obstacles, shifted solids or altered portal frames',()=>{
 for(const [index,normalize,prefix]of [[8,originalRoom9Contract,'Spring drop gantry / '],[10,originalRoom11Contract,'Wind test service bus / ']]){
  bare(index);const contract=gameplayContract(game),baseline=normalize(contract);
  for(const mutate of [
   c=>c.colliders.find(r=>r.mesh.name.startsWith(prefix)).box.min[1]-=.1,
   c=>c.colliders.push(structuredClone(c.colliders.find(r=>r.mesh.name.startsWith(prefix)))),
   c=>c.camera.find(r=>r.name.startsWith(prefix)).matrix[12]+=.1,
   c=>c.aim.splice(c.aim.findIndex(r=>r.name.startsWith(prefix)),1),
  ]){const altered=structuredClone(contract);mutate(altered);assert.throws(()=>normalize(altered),assert.AssertionError);}
  const altered=structuredClone(contract),name=Object.keys(altered.panels)[0];altered.panels[name].center[1]+=.1;
  assert.notDeepEqual(normalize(altered),baseline,'The structural exemption must retain every original portal frame');
 }
});

test('all seventeen real layouts preserve physical owners, portal frames and ray source triangles',()=>{
 for(let index=0;index<17;index++){
  const l=bare(index),before=gameplayContract(game);
  const sourceOwners=[...new Set([...game.colliders.map(c=>c.mesh),...game.aimBlockers,...game.cameraBlockers])].map(mesh=>({mesh,geometry:mesh.geometry,children:mesh.children.slice()}));
  finishVisualAuditEarly(game,l,index);
  game.levelRoots.push(l.visualAuditEarly.root);
  assert.deepEqual(gameplayContract(game),before,`Room ${index+1}: art changed a physical or interaction contract`);
  for(const saved of sourceOwners){assert.equal(saved.mesh.geometry,saved.geometry);assert.deepEqual(saved.mesh.children,saved.children);}
  assert.equal(l.visualAuditEarly.stats.extraColliders,0);assert.equal(l.visualAuditEarly.stats.extraLights,0);
  if([5,7,8,9,10,11,12,13,14,15].includes(index))assert.ok(l.visualAuditEarly.stats.floorFieldTiles>0,`Room ${index+1}: the visible finished floor must receive the actual work-bay pigment`);
  const art=l.visualAuditEarly,render=l.renderUpdate;finishVisualAuditEarly(game,l,index);
  assert.equal(l.visualAuditEarly,art);assert.equal(l.renderUpdate,render);
 }
});

test('weighted mirror bearing follows the real full pivot transform and render does not advance physics',()=>{
 const l=bare(12);finishVisualAuditEarly(game,l,12);const art=l.visualAuditEarly;
 game.levelRoots.push(art.root);assert.equal(art.followers.length,1);
 const {target,mount}=art.followers[0];
 target.position.add(new THREE.Vector3(.3,-.2,.6));target.rotation.set(.12,.73,-.08);target.scale.set(.94,1.04,.97);
 l.renderUpdate(.35);mount.updateWorldMatrix(true,false);target.updateWorldMatrix(true,false);
 for(let i=0;i<16;i++)assert.ok(Math.abs(mount.matrixWorld.elements[i]-target.matrixWorld.elements[i])<1e-10);
 const before=gameplayContract(game);for(let n=0;n<20;n++)l.renderUpdate(.35);
 assert.deepEqual(gameplayContract(game),before);
 const geometries=new Set(),materials=new Set();art.root.traverse(n=>{if(n.geometry)geometries.add(n.geometry);if(n.material)materials.add(n.material);});
 const counts=new Map([...geometries,...materials].map(r=>[r,0]));
 for(const resource of counts.keys())resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));
 disposeLabLevel(game);l.dispose();assert.ok([...counts.values()].every(n=>n===1));assert.equal(art.root.children.length,0);
});
