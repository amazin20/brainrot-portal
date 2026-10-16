import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {FOUNDATION_BUILDERS} from '../src/game/LabFoundationChambers.js';
import {buildExtendedCampaign} from '../src/game/LabExtendedCampaign.js';
import {buildWorkshopCampaign} from '../src/game/LabWorkshopCampaign.js';
import {finishBrowserArt} from '../src/game/LabCampaignLevels.js';
import {installFirstChapterArt} from '../src/game/LabFirstChapterArt.js';

let game;
async function room(index){
 game??=await createHeadlessGame();disposeLabLevel(game);game.levelIndex=index;game.chamberEdition='foundation';
 const before=new Set(game.scene.children),level=FOUNDATION_BUILDERS[index]?FOUNDATION_BUILDERS[index](game,index):finishBrowserArt(index<8?buildExtendedCampaign(game,index):buildWorkshopCampaign(game,index));
 game.firstLevel=level;game.levelRoots=game.scene.children.filter(r=>!before.has(r));return {game,level};
}
function physicalState(game,level){
 return {registries:['colliders','floors','ramps','cameraBlockers','aimBlockers','portalPanels'].map(key=>[key,[...game[key]]]),
  colliders:game.colliders.map(c=>({id:c.mesh.uuid,box:[c.box.min.toArray(),c.box.max.toArray()],kinematic:c.kinematic,
   children:c.mesh.children.slice(),position:c.mesh.position.toArray(),quaternion:c.mesh.quaternion.toArray(),scale:c.mesh.scale.toArray()})),
  panels:Object.values(level.panels).map(s=>({children:s.group.children.slice(),meshChildren:s.mesh.children.slice(),frame:s.getFrame(),material:s.mesh.material})),
  terminals:level.terminals.slice()};
}
function existingMeshes(root){const entries=[];root.traverse(n=>{if(n.isMesh)entries.push({mesh:n,geometry:n.geometry,material:n.material,children:n.children.slice()});});return entries;}
function assertExisting(entries){for(const e of entries){assert.equal(e.mesh.geometry,e.geometry);assert.equal(e.mesh.material,e.material);assert.deepEqual(e.mesh.children,e.children);}}
function assertInsideHost(part){
 const h=part.host,s=h.surface,side=part.role.startsWith('upright'),centre=side?[Math.sign(part.p[0])*(s.width/2+h.offset),0,h.front-(h.wide?.33:.04)]:[0,s.height/2+h.offset,h.front-(h.wide?.33:.04)];
 const extent=side?[h.width/2,(s.height+(h.wide?1.18:.5))/2,h.wide?.33:.04]:[(s.width+(h.wide?0:.5))/2,h.height/2,h.wide?.33:.04];
 // Entire closed box, rather than just its centre, stays in the existing
 // machine member. Only the finish's declared one-millimetre face is exposed.
 for(let axis=0;axis<3;axis++)assert.ok(Math.abs(part.p[axis]-centre[axis])+part.size[axis]/2<=extent[axis]+(axis===2?.001000001:1e-9),`${s.name}: ${part.role} extends outside chassis axis ${axis}`);
 // Nothing occupies the authored porcelain rectangle, even on a floor pad.
 assert.ok(Math.abs(part.p[0])-part.size[0]/2>s.width/2||Math.abs(part.p[1])-part.size[1]/2>s.height/2);
}
function matricesMatch(art,structure){
 const actual=new THREE.Matrix4(),expected=new THREE.Matrix4();art.root.updateWorldMatrix(true,true);
 for(const batch of art.batches){
  const dynamic=batch.name.includes('actual moving');
  // Match instances to their declared support and their local machining pose;
  // material colours alone cannot count as evidence that movement is bound.
  let i=0;
  for(const part of art.mounts){const moving=part.host.surface.collider?.kinematic===true||part.host.surface.group.parent!==structure;if(moving!==dynamic)continue;
   part.host.surface.group.updateWorldMatrix(true,false);expected.multiplyMatrices(part.host.surface.group.matrixWorld,part.local);
   batch.getMatrixAt(i++,actual);actual.premultiply(batch.matrixWorld);
   actual.elements.forEach((value,j)=>{assert.ok(Number.isFinite(value));assert.ok(Math.abs(value-expected.elements[j])<2e-5);});
  }
  assert.equal(i,batch.count);
 }
}

test('all ten actual rooms gain bounded frame finishes while original meshes, apertures and physical registries remain exact',async()=>{
 for(let index=0;index<10;index++){
  const {game:g,level:l}=await room(index),before=physicalState(g,l),original=existingMeshes(l.structure),sources=[...g.assets.values()].flatMap(existingMeshes);
  assert.equal(l.firstChapterArt,undefined);installFirstChapterArt(g,l,index);const art=l.firstChapterArt;assert.ok(art);
  assert.deepEqual(physicalState(g,l),before);assertExisting(original);assertExisting(sources);
  assert.ok(art.diagnostics.instances<=480);assert.ok(art.batches.length<=2);assert.ok(art.diagnostics.panels>0);
  art.mounts.forEach(assertInsideHost);
  const render=l.renderUpdate,reset=l.reset,dispose=l.dispose;installFirstChapterArt(g,l,index);
  assert.equal(l.renderUpdate,render);assert.equal(l.reset,reset);assert.equal(l.dispose,dispose);assert.equal(l.firstChapterArt,art);
  for(const batch of art.batches){assert.equal(batch.castShadow,false);assert.equal(batch.material.emissiveIntensity,1);assert.equal(batch.material.emissive.getHex(),0);assert.ok(batch.instanceMatrix.array.every(Number.isFinite));}
  art.update();assert.deepEqual(physicalState(g,l),before);
 }
});

test('the real translating carriage and rotating balance retain their interpolation, with no independent art motion',async()=>{
 for(const index of [2,6]){
  const {game:g,level:l}=await room(index);installFirstChapterArt(g,l,index);const art=l.firstChapterArt;
  assert.ok(art.diagnostics.movingPanels>0);
  const first=art.batches.find(b=>b.name.includes('actual moving')).instanceMatrix.array.slice();
  if(index===2)l.car.target=1;
  g.playerGrounded=false;g.playerPosition.set(70,30,70);g.cargo.position.set(65,35,65);
  for(let step=0;step<180;step++)l.update(1/120);
  for(const alpha of [0,.25,.75,1]){
   l.renderUpdate(alpha);matricesMatch(art,l.structure);const before=physicalState(g,l),state=JSON.stringify(l.diagnostics());
   const poses=art.batches.map(b=>Array.from(b.instanceMatrix.array));for(let i=0;i<20;i++)art.update();
   assert.deepEqual(physicalState(g,l),before);assert.equal(JSON.stringify(l.diagnostics()),state);assert.deepEqual(art.batches.map(b=>Array.from(b.instanceMatrix.array)),poses);
  }
  assert.notDeepEqual(art.batches.find(b=>b.name.includes('actual moving')).instanceMatrix.array,first);
  l.reset();l.renderUpdate(1);matricesMatch(art,l.structure);
 }
});

test('finish resources are owned once, detached before shared lifecycle traversal and absent outside the first chapter',async()=>{
 const {game:g,level:l}=await room(0),before=[...g.scene.children];
 for(const [edition,index]of [['classic',0],['open',0],['foundation',10],['foundation',40]]){
  g.chamberEdition=edition;assert.equal(installFirstChapterArt(g,l,index),l);assert.equal(l.firstChapterArt,undefined);assert.deepEqual(g.scene.children,before);
 }
 g.chamberEdition='foundation';installFirstChapterArt(g,l,0);const art=l.firstChapterArt;let geometry=0,material=0,instancing=0;
 art.batches[0].geometry.addEventListener('dispose',()=>geometry++);art.batches[0].material.addEventListener('dispose',()=>material++);art.batches.forEach(b=>b.addEventListener('dispose',()=>instancing++));
 // Production buildLevel snapshots every new scene root, including this
 // sibling. Detachment alone would leave those references to be traversed.
 g.levelRoots.push(art.root);
 const poses=art.batches.map(b=>Array.from(b.instanceMatrix.array));disposeLabLevel(g);l.dispose();art.update();
 assert.equal(art.disposed,true);assert.equal(art.root.parent,null);assert.equal(geometry,1);assert.equal(material,1);assert.equal(instancing,art.batches.length);assert.deepEqual(art.batches.map(b=>Array.from(b.instanceMatrix.array)),poses);
});
