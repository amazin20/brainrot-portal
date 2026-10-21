import * as THREE from 'three';
import {manufacturedBulkheadGeometry} from './LabManufacturedFinish.js';

const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();

/** Finish the actual rendered fixed partitions left by the tiled rooms.
 * OpenChamber already finishes its static meshes before merging them, so this
 * intentionally does not search invisible pre-batch sources or whole models.
 * A recess replaces the original box; no second skin is laid on its face. */
function finishVisiblePartitions(game,level,roots){
 const portal=new Set(game.portalPanels||[]),assetGeometries=new Set(),materials=new Map(),uses=new Map();
 for(const asset of game.assets?.values?.()||[])asset.traverse(n=>{if(n.geometry)assetGeometries.add(n.geometry);});
 for(const root of roots)root.traverse(n=>{if(n.geometry)uses.set(n.geometry,(uses.get(n.geometry)||0)+1);});
 let panels=0;
 for(const root of roots)root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isInstancedMesh||!mesh.visible||mesh.userData.collisionProxy||portal.has(mesh)
   ||mesh.userData.visualAuditLateShape||mesh.userData.visualAuditEarlyShape||mesh.userData.visualAuditMiddleShape
   ||mesh.userData.manufacturedFinish||assetGeometries.has(mesh.geometry))return;
  const p=mesh.geometry?.parameters,source=mesh.material;
  if(mesh.geometry?.type!=='BoxGeometry'||!p||!source?.isMeshStandardMaterial||Array.isArray(source))return;
  const role=source.userData?.architecturalRole;
  if(!['wall','shell','paint'].includes(role)&&!/structural laboratory wall|wall cassette|structural shell|machine family/i.test(source.name))return;
  if(p.height<3.2||Math.max(p.width,p.depth)<5.5||Math.min(p.width,p.depth)<.25||Math.min(p.width,p.depth)>1.8)return;
  if(!materials.has(source)){
   const material=source.clone();material.vertexColors=true;material.roughness=Math.max(.74,material.roughness);
   material.name=source.name||'Commissioned mineral partition';materials.set(source,material);
  }
  const x=p.width<p.depth,geometry=manufacturedBulkheadGeometry(x?p.depth:p.width,p.height,x?p.width:p.depth);
  if(x)geometry.rotateY(Math.PI/2);geometry.parameters={...p};
  const old=mesh.geometry;mesh.geometry=geometry;mesh.material=materials.get(source);
  mesh.userData.visualAuditPartition=true;
  // Primitive boxes created by game.box are normally unique. A shared one is
  // retained for its other owner; no shared cache resource is ever disposed.
  if(uses.get(old)===1)old.dispose();panels++;
 });
 return panels;
}

/** Long in-world text needs a manufactured display body. The old floating
 * planes remain the readable front: their text, transform and live texture
 * updates are untouched. The six parts behind/around each face are submitted
 * in one static instance bank, and are not added to physical/ray registries. */
function instrumentHousings(game,level,roots){
 const candidates=[],world=level.world||level.workshop?.world,parent=level.structure||world?.root;
 if(!parent)return null;
 for(const root of roots)root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.visible||mesh.parent!==parent||mesh.geometry?.type!=='PlaneGeometry'
    ||!/^(Station wayfinding \/|Process instrument)/.test(mesh.name))return;
  const p=mesh.geometry.parameters;if(!p||p.width<2||p.height<.3||p.width>18||p.height>5)return;
  mesh.updateWorldMatrix(true,false);const normal=V(0,0,1).transformDirection(mesh.matrixWorld);
  if(Math.abs(normal.y)>.35)return;
  candidates.push(mesh);
 });
 if(!candidates.length)return null;
 const entries=[],matrix=new THREE.Matrix4(),local=new THREE.Matrix4();
 for(const mesh of candidates.slice(0,24)){
  const {width:w,height:h}=mesh.geometry.parameters;
  const add=(p,size,color)=>{
   local.compose(V(...p),Q(),V(...size));matrix.multiplyMatrices(mesh.matrixWorld,local);
   entries.push({matrix:matrix.clone(),color});
  };
  add([0,0,-.085],[w+.18,h+.18,.14],0x243e49);
  for(const side of [-1,1]){
   add([side*(w/2+.025),0,-.005],[.105,h+.12,.12],0x8c9d9d);
   add([0,side*(h/2+.025),-.005],[w-.05,.09,.12],0x526c73);
  }
  add([-w/2+.10,0,-.004],[.055,Math.max(.15,h-.20),.05],0xbd965e);
 }
 const group=new THREE.Group();group.name='Commissioned instrument housings';group.userData.visualOnly=true;group.userData.keepMaterial=true;
 const geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial({name:'Instrument housing / satin service metals',color:0xffffff,roughness:.72,metalness:.28});
 const batch=new THREE.InstancedMesh(geometry,material,entries.length),color=new THREE.Color();
 batch.name='Instrument housings / fixed instance bank';batch.userData.visualOnly=true;batch.receiveShadow=true;batch.castShadow=false;
 game.scene.updateWorldMatrix(true,false);const inverse=game.scene.matrixWorld.clone().invert();
 entries.forEach((e,i)=>{batch.setMatrixAt(i,matrix.multiplyMatrices(inverse,e.matrix));batch.setColorAt(i,color.setHex(e.color));});
 batch.instanceMatrix.needsUpdate=true;batch.instanceColor.needsUpdate=true;batch.computeBoundingBox();batch.computeBoundingSphere();
 group.add(batch);game.scene.add(group);
 return {root:group,batch,geometry,material,instruments:Math.min(24,candidates.length),instances:entries.length};
}

/** Final visual-only pass after the chapter/theme finish. This pass has no
 * autonomous animation, physics state, portal address or per-frame callback. */
export function finishVisualAudit(game,level,index,roots=[]){
 if(game.chamberEdition!=='foundation'||level.visualAuditFinish)return level;
 const unique=[...new Set(roots.length?roots:[level.structure||level.world?.root||level.workshop?.world?.root].filter(Boolean))];
 // Castle geometry has its own wing-specific commissioned pass.
 const partitions=level.tower?0:finishVisiblePartitions(game,level,unique);
 const instruments=instrumentHousings(game,level,unique);
 const diagnostics=Object.freeze({revision:66,index,partitions,instruments:instruments?.instruments||0,instrumentInstances:instruments?.instances||0,
  extraLights:0,extraColliders:0,extraFloors:0,perFrameCallbacks:0});
 let disposed=false;const dispose=level.dispose;
 level.dispose=function(...args){
  if(disposed)return;disposed=true;
  if(instruments){instruments.root.removeFromParent();instruments.root.clear();instruments.batch.dispose();instruments.geometry.dispose();instruments.material.dispose();}
  return dispose?.apply(this,args);
 };
 level.visualAuditFinish={diagnostics,root:instruments?.root||null,get disposed(){return disposed;}};
 return level;
}
