import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

const EXPECTED_IMPORTED=new Map([[12,[]],[13,[19,29]],[14,[37]],[15,[31,35]]]);

for(const room of [12,13,14,15])test(`room ${room} browser-3d art is detailed but gameplay-neutral`,async()=>{
 const game=await createHeadlessGame({levelIndex:room-1,courseOnly:true});
 try{
  const level=game.firstLevel,art=level.browser3DArt;
  assert.ok(art&&art.userData.visualOnly,'advanced room must have the visual-only art root');
  assert.equal(art.userData.version,31);
  assert.ok(art.userData.stats.portalFrames>=4,'portal machinery frames should cover authored targets');
  assert.ok(art.userData.stats.deckBraces>=2,'raised architecture should have real under-deck engineering');

  // High-fidelity rooms use the optimized source GLB tile geometry through
  // instancing, not hundreds of independent copies and not the white-box tile.
  const detailedSurfaces=level.world.surfaces.filter(s=>s.group.children.some(n=>n.isInstancedMesh&&n.geometry!==level.world.tileGeometry));
  assert.equal(detailedSurfaces.length,level.world.surfaces.length);

  const visual=[];level.world.root.traverse(n=>{if(n.userData?.visualOnly)visual.push(n);});
  const visualMeshes=new Set();for(const node of visual)node.traverse(n=>{if(n.isMesh)visualMeshes.add(n);});
  for(const collider of game.colliders)assert.equal(visualMeshes.has(collider.mesh),false,'art mesh entered collision registry');
  for(const mesh of game.cameraBlockers)assert.equal(visualMeshes.has(mesh),false,'art mesh became a camera blocker');
  for(const mesh of game.aimBlockers)assert.equal(visualMeshes.has(mesh),false,'art mesh became an aim blocker');
  for(const floor of game.floors)assert.equal(visualMeshes.has(floor.mesh),false,'art mesh became a walking floor');

  const ids=new Set();level.world.root.traverse(n=>{if(Number.isInteger(n.userData?.assetId))ids.add(n.userData.assetId);});
  for(const id of EXPECTED_IMPORTED.get(room))assert.ok(ids.has(id),`room ${room} must use imported mechanism asset ${id}`);

  const bounds=new THREE.Box3().setFromObject(level.world.root),size=bounds.getSize(new THREE.Vector3());
  assert.ok([...size.toArray()].every(Number.isFinite));assert.ok(size.x>10&&size.z>10);
 }finally{game.physics.dispose();game.portals.dispose();}
});
