import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {lateMachineHousingGeometry,lateToroidalWindingGeometry,finishVisualAuditLate} from '../src/game/LabVisualAuditLate.js';

test('manufactured mechanism reliefs preserve the complete source box for every mounting axis',()=>{
 for(const size of [[7,4.4,.7],[1,10,11.2],[12,.4,12],[2,.55,.55],[4,3,2.4]])for(const axis of ['x','y','z'])for(const kind of ['drive','sluice','weight','rail','pressure','thermal']){
  const g=lateMachineHousingGeometry(...size,{axis,kind});
  const box=g.boundingBox,actual=box.getSize(new THREE.Vector3());
  size.forEach((v,i)=>assert.ok(Math.abs(actual.getComponent(i)-v)<.00001,`${kind}/${axis} changed dimension${i}`));
  assert.ok(box.getCenter(new THREE.Vector3()).length()<.00001);
  for(const name of ['position','normal','uv','color'])assert.ok([...g.attributes[name].array].every(Number.isFinite),`invalid ${name}`);
  g.dispose();
 }
});

test('copper winding stays within the original torus envelope and retains its cargo opening',()=>{
 const r=1.35,t=.18,g=lateToroidalWindingGeometry(r,t),p=g.attributes.position;
 for(let i=0;i<p.count;i++){
  const radial=Math.hypot(p.getX(i),p.getY(i));
  assert.ok(radial<=r+t+.00001&&radial>=r-t-.00001);
  assert.ok(Math.abs(p.getZ(i))<=t+.00001);
 }
 g.dispose();
});

test('live late instruments stay inside original moving boxes and leave portal and collider registries intact',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.puzzleProgression=true;
 try{
  for(const n of [35,39,40,42]){
   await g.selectLevel(n-1,false);const l=g.firstLevel,roots=g.levelRoots||[l.world.root];
   const portals=[...g.portalPanels],colliders=[...g.colliders],before=new Map();
   for(const c of colliders)before.set(c,c.box.clone());
   finishVisualAuditLate(g,l,n-1,roots);
   assert.deepEqual(g.portalPanels,portals);assert.deepEqual(g.colliders,colliders);
   for(const c of colliders)assert.ok(c.box.equals(before.get(c)));
   l.renderUpdate(1);
   l.world.root.updateWorldMatrix(true,true);
   l.world.root.traverse(o=>{
    if(o.name!=='Recessed live machine instrument')return;
    const host=o.parent;host.geometry.computeBoundingBox();
    const local=new THREE.Box3();
    o.traverse(m=>{if(m.isMesh){m.geometry.computeBoundingBox();m.updateMatrix();local.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrix));}});
    o.updateMatrix();local.applyMatrix4(o.matrix);
    assert.ok(host.geometry.boundingBox.clone().expandByScalar(.00001).containsBox(local),'instrument exceeds source collision volume');
   });
  }
 }finally{g.physics?.dispose();g.portals?.dispose();}
});
