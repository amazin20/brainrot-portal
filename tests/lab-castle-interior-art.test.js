import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CASTLE_WING_FINISHES} from '../src/game/LabCastleMaterials.js';
import {castleInteriorFields,installCastleInteriorArt} from '../src/game/LabCastleInteriorArt.js';
import {architecturalRectOverlapsPortal} from '../src/game/LabArchitecturalModels.js';

const V=(...v)=>new THREE.Vector3(...v);
function fixture(){
 const scene=new THREE.Scene(),structure=new THREE.Group();scene.add(structure);
 const game={scene,colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[]},rooms=new Map();
 for(const [i,id]of Object.keys(CASTLE_WING_FINISHES).entries()){
  const x=i*40,def={id,at:[x,0,0],h:15};rooms.set(id,{def});
  const mat=new THREE.MeshStandardMaterial({name:'Castle wing wall / '+id,color:CASTLE_WING_FINISHES[id].wall});
  // Two independent slabs with a real doorway between them.
  for(const dx of [-9,9]){
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(12,15,.5),mat);mesh.position.set(x+dx,7.5,-18);structure.add(mesh);
   game.colliders.push({mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true,kinematic:false});
  }
 }
 const panel=new THREE.Mesh(new THREE.PlaneGeometry(4,5),new THREE.MeshBasicMaterial());panel.position.set(-9,4,-17.65);structure.add(panel);
 const portal={center:panel.position.clone(),normal:V(0,0,1),up:V(0,1,0),right:V(1,0,0),halfWidth:2,halfHeight:2.5};
 panel.userData.portalFrame=()=>portal;game.portalPanels.push(panel);
 let disposals=0;const level={tower:true,structure,rooms,dispose(){disposals++;}};
 return {game,level,portal,disposals:()=>disposals};
}

test('castle interior relief is completely supported, clears doors and portal apertures, and adds no physical surface',()=>{
 const f=fixture(),registries=Object.fromEntries(['colliders','floors','cameraBlockers','aimBlockers','portalPanels'].map(k=>[k,[...f.game[k]]]));
 installCastleInteriorArt(f.game,f.level);const art=f.level.castleInteriorArt;
 assert.equal(art.diagnostics.wings,12);assert.equal(art.diagnostics.batches,3);
 assert.ok(art.diagnostics.instances<800);assert.ok(art.diagnostics.triangles<10000);assert.equal(art.diagnostics.maxProjection,.089);
 for(const m of art.mounts){
  const center=V(...m.center),normal=V(...m.normal),right=V(...m.right);
  for(const x of [-1,1])for(const y of [-1,1])assert.ok(m.support.containsPoint(center.clone()
   .addScaledVector(right,x*m.halfWidth).addScaledVector(V(0,1,0),y*m.halfHeight).addScaledVector(normal,-.05)),'relief bridges a doorway or unsupported slab edge');
  assert.ok(m.projection<=.09,'finish projects beyond shallow wall skin');
  const projection={...f.portal,center:f.portal.center.clone().setZ(center.z)};
  assert.equal(architecturalRectOverlapsPortal({...m,center,normal,right,up:V(0,1,0)},projection,.45),false,'trim occludes a real portal aperture');
 }
 for(const [key,before]of Object.entries(registries))assert.deepEqual(f.game[key],before,'visual art changed '+key);
 f.level.dispose();
});

test('moving, disabled and non-wall volumes never receive interior relief',()=>{
 const f=fixture();f.game.colliders[0].kinematic=true;f.game.colliders[1].enabled=false;
 f.game.colliders[2].mesh.material=new THREE.MeshStandardMaterial({name:'Portal address / clean ivory ceramic'});
 const fields=castleInteriorFields(f.game,f.level);
 assert.equal(fields.length,f.level.rooms.size*2-3);assert.equal(fields.filter(s=>s.id==='freight').length,0);
 assert.equal(fields.filter(s=>s.id==='sluice').length,1);
});

test('interior batches install once and release their geometry, materials and instance buffers exactly once',()=>{
 const f=fixture();installCastleInteriorArt(f.game,f.level);const art=f.level.castleInteriorArt,root=art.root;
 installCastleInteriorArt(f.game,f.level);assert.equal(f.level.castleInteriorArt,art);
 const geometry=new Set(root.children.map(n=>n.geometry)),materials=new Set(root.children.map(n=>n.material));let geometries=0,finishes=0,batches=0;
 for(const g of geometry)g.addEventListener('dispose',()=>geometries++);for(const m of materials)m.addEventListener('dispose',()=>finishes++);
 for(const mesh of root.children)mesh.addEventListener('dispose',()=>batches++);
 f.level.dispose();f.level.dispose();
 assert.equal(geometries,1);assert.equal(finishes,3);assert.equal(batches,3);assert.equal(f.disposals(),1);assert.equal(root.parent,null);assert.equal(art.disposed,true);
});
