import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

const EXPECTED_IMPORTED=new Map([[12,[]],[13,[19,29]],[14,[]],[15,[]]]);
const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

for(const room of [12,13,14,15])test(`room ${room} browser-3d art is detailed but gameplay-neutral`,async()=>{
 await game.selectLevel(room-1,false);
 const level=game.firstLevel,art=level.browser3DArt,premium=level.premiumBrowser3DArt;
 assert.ok(art&&art.userData.visualOnly,'advanced room must have the visual-only art root');
 assert.equal(art.userData.version,31);
 assert.ok(art.userData.stats.portalFrames>=4,'portal machinery frames should cover authored targets');
 assert.ok(art.userData.stats.deckBraces>=2,'raised architecture should have real under-deck engineering');
 assert.ok(premium&&premium.userData.visualOnly,'premium environment layer must remain visual-only');
 assert.equal(premium.userData.version,33);
 assert.ok(premium.userData.stats.instances>30,'large placeholder blocks must receive real modular GLB cladding');
 assert.ok(premium.userData.stats.batches>=1&&premium.userData.stats.sourceBoxes>=1);

 // High-fidelity rooms use the optimized source GLB tile geometry through
 // instancing, not hundreds of independent copies and not the white-box tile.
 const detailedSurfaces=level.world.surfaces.filter(s=>s.group.children.some(n=>n.isInstancedMesh&&n.geometry!==level.world.tileGeometry));
 assert.equal(detailedSurfaces.length,level.world.surfaces.length);
 for(const surface of level.world.surfaces.filter(s=>s.portal))surface.group.traverse(node=>{
  if(node.isInstancedMesh&&node.userData.portalTile)assert.equal(node.material,level.world.materials.ceramic,'portal tiles must use the canonical readable ceramic');
 });

 for(const surface of Object.values(level.panels)){
  const frame=surface.group.getObjectByName(`Portal machinery frame / ${surface.name}`);
  assert.ok(frame,'every portal surface retains its own machinery frame');
  const rest=surface.group.position.clone();surface.group.position.add(new THREE.Vector3(.31,.57,-.23));
  const pose=surface.getFrame(),expected=pose.center.clone().addScaledVector(pose.normal,-.12);
  assert.ok(frame.getWorldPosition(new THREE.Vector3()).distanceTo(expected)<1e-8,'frame must follow its moving portal panel');
  surface.group.position.copy(rest);surface.group.updateWorldMatrix(true,true);
  const inverse=surface.group.matrixWorld.clone().invert();
  frame.traverse(node=>{
   if(!node.isMesh)return;
   node.geometry.computeBoundingBox();
   const bounds=node.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(node.matrixWorld));
   assert.ok(bounds.max.x<=-surface.width/2||bounds.min.x>=surface.width/2||bounds.max.y<=-surface.height/2||bounds.min.y>=surface.height/2,'decorative frame must leave the entire usable aperture clear');
  });
 }

 const visual=[];level.world.root.traverse(n=>{if(n.userData?.visualOnly)visual.push(n);});
 const visualMeshes=new Set();for(const node of visual)node.traverse(n=>{if(n.isMesh)visualMeshes.add(n);});
 for(const collider of game.colliders)assert.equal(visualMeshes.has(collider.mesh),false,'art mesh entered collision registry');
 for(const mesh of game.cameraBlockers)assert.equal(visualMeshes.has(mesh),false,'art mesh became a camera blocker');
 for(const mesh of game.aimBlockers)assert.equal(visualMeshes.has(mesh),false,'art mesh became an aim blocker');
 for(const floor of game.floors)assert.equal(visualMeshes.has(floor.mesh),false,'art mesh became a walking floor');

 const ids=new Set();level.world.root.traverse(n=>{if(Number.isInteger(n.userData?.assetId))ids.add(n.userData.assetId);});
 for(const id of EXPECTED_IMPORTED.get(room))assert.ok(ids.has(id),`room ${room} must use imported mechanism asset ${id}`);
 if(room===14)assert.ok(!ids.has(37),'legacy bridge shell must not hide the projector lens');
 if(room===15){
  assert.ok(level.world.root.getObjectByName('transfer-rotor'),'the actual machined turbine replaces both overlapping legacy models');
  assert.ok(!ids.has(31)&&!ids.has(35),'redundant fan shells must not hide the turbine blades');
 }

 const bounds=new THREE.Box3().setFromObject(level.world.root),size=bounds.getSize(new THREE.Vector3());
 assert.ok([...size.toArray()].every(Number.isFinite));assert.ok(size.x>10&&size.z>10);
});

test('room 13 machinery stays upright below its moving deck and pressure surface',async()=>{
 await game.selectLevel(12,false);
 const level=game.firstLevel;
 for(const [surfaceName,modelName] of [['north-cage','north-cage / real lift chassis'],['south-cage','south-cage / real lift chassis'],['mirror-cradle','mirror cradle / real pressure mechanism']]){
  const surface=level.world.surfaces.find(s=>s.name===surfaceName),model=surface.group.getObjectByName(modelName);
  assert.ok(model);
  const normal=surface.getFrame().normal;
  const up=new THREE.Vector3(0,1,0).applyQuaternion(model.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(up.dot(normal)>1-1e-8,'Y-up imported mechanism must align with its deck normal');
  const chassis=surface.group.getObjectByName('Browser 3D machine chassis');
  if(chassis)assert.ok(new THREE.Box3().setFromObject(chassis).max.y<surface.getFrame().center.y-.04,'machined chassis must not project into the standing surface');
  const bounds=new THREE.Box3().setFromObject(model);
  assert.ok(bounds.max.y<surface.getFrame().center.y-.029,'mechanism housing must remain behind the walking and portal plane');
 }
});

test('changing rooms releases the procedural art textures once',async()=>{
 await game.selectLevel(11,false);
 const textures=game.firstLevel.world.root.userData.browserArtMaterials.textures;
 const disposed=textures.map(()=>0);
 textures.forEach((texture,i)=>texture.addEventListener('dispose',()=>disposed[i]++));
 await game.selectLevel(12,false);
 assert.deepEqual(disposed,[1,1]);
});
