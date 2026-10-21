import * as THREE from 'three';
import {manufacturedBulkheadGeometry} from './LabManufacturedFinish.js';

const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion(),UP=V(0,1,0);
export const EARLY_AUDIT_REVISION='early-machine-construction-v66';
const METAL=0x9eafb3,DARK=0x294b59,PAINT=0x5b8998,BRASS=0xd1a768;

/** A closed structural I-section, contained in the former rectangular post.
 * The flanges retain all six extreme planes, so authored contact bounds and
 * a controller's setFromObject measurements do not grow with the art. */
export function earlyStructuralSection(width,height,depth){
 if(![width,height,depth].every(n=>Number.isFinite(n)&&n>0))throw new RangeError('Positive structural dimensions required');
 const flange=depth*.23,web=width*.30,x=width/2,z=depth/2;
 const pts=[[-x,-z],[x,-z],[x,-z+flange],[web/2,-z+flange],[web/2,z-flange],[x,z-flange],
  [x,z],[-x,z],[-x,z-flange],[-web/2,z-flange],[-web/2,-z+flange],[-x,-z+flange]];
 const shape=new THREE.Shape(pts.map(p=>new THREE.Vector2(...p)));
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1,curveSegments:1});
 geometry.translate(0,0,-height/2);geometry.rotateX(Math.PI/2);
 geometry.name='Rolled structural section / integral flanges and web';
 geometry.parameters={width,height,depth};geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return geometry;
}

function resources(){return {geometry:[],materials:[],replacements:[],followers:[],instancePaint:[],stats:{structuralSections:0,foldedChassis:0,materialRoles:0,mirrorBearings:0,floorFieldTiles:0,extraColliders:0,extraLights:0}};}
function ownMaterial(owner,source,color,{vertexColors=false}={}){
 const material=source.clone();material.name='Early audit / founded machine metal';
 material.color.setHex(color);material.roughness=.53;material.metalness=.46;
 material.vertexColors=vertexColors;material.envMapIntensity=.65;
 owner.materials.push(material);return material;
}
function replace(owner,mesh,geometry,material){
 if(geometry!==mesh.geometry&&owner.protected?.has(mesh)){
  // The old mesh is also a physical/aim owner. Keep every one of its source
  // triangles and its child list intact; only its drawing is delegated to a
  // sibling, just like the existing manufactured second-chapter coat.
  const hidden=mesh.material.clone();hidden.visible=false;owner.materials.push(hidden);
  owner.replacements.push({mesh,geometry:mesh.geometry,material:mesh.material,replacementGeometry:mesh.geometry,replacementMaterial:hidden});
  mesh.material=hidden;
  const mount=new THREE.Group();mount.matrixAutoUpdate=false;mount.name='Early audit / measured structural owner';
  mesh.updateWorldMatrix(true,false);owner.renderRoot.updateWorldMatrix(true,false);
  mount.matrix.copy(owner.renderRoot.matrixWorld).invert().multiply(mesh.matrixWorld);owner.renderRoot.add(mount);
  const visual=new THREE.Mesh(geometry,material);visual.name='Early audit / integral structural profile';visual.castShadow=mesh.castShadow;visual.receiveShadow=mesh.receiveShadow;
  visual.userData.visualOnly=true;mount.add(visual);owner.geometry.push(geometry);
  if(owner.dynamic?.has(mesh))owner.followers.push({target:mesh,mount});
  return;
 }
 owner.replacements.push({mesh,geometry:mesh.geometry,material:mesh.material,replacementGeometry:geometry,replacementMaterial:material});
 if(geometry!==mesh.geometry)owner.geometry.push(geometry);
 mesh.geometry=geometry;mesh.material=material;mesh.userData.visualAuditEarly=true;
}
function profilePosts(root,owner,{onlyFolded=false}={}){
 const nodes=[];root.traverse(mesh=>{
  const p=mesh.geometry?.parameters;
  if(!mesh.isMesh||mesh.isInstancedMesh||mesh.userData?.collisionProxy||mesh.userData?.portalTile||mesh.userData?.visualAuditEarly||!mesh.visible||
   Array.isArray(mesh.material)||mesh.material?.visible===false||mesh.material?.transparent||!p||![p.width,p.height,p.depth].every(Number.isFinite))return;
  if(onlyFolded&&!/^Folded (dark|shell) casing$/.test(mesh.name))return;
  if(p.height<2.5||p.width<.13||p.depth<.13||Math.max(p.width,p.depth)>.81||p.height/Math.max(p.width,p.depth)<5)return;
  // Surface frames are intentionally solid: keep the manufactured porcelain
  // surround and all imported mechanism masters outside this selection.
  for(let n=mesh.parent;n&&n!==root;n=n.parent)if(n.userData?.assetId||n.name==='Frame'||n.name==='Moving')return;
  nodes.push(mesh);
 });
 for(const mesh of nodes.slice(0,44)){
  const p=mesh.geometry.parameters;
  replace(owner,mesh,earlyStructuralSection(p.width,p.height,p.depth),ownMaterial(owner,mesh.material,DARK));owner.stats.structuralSections++;
 }
}

/** OpenChamber merges its immutable hulls before returning a level. Finish
 * those actual hull meshes while they still exist; no overlay skins or new
 * geometry outside their physical boxes are introduced after the merge. */
export function prepareVisualAuditEarlyKit(kit){
 if(kit.game?.chamberEdition!=='foundation'||![0,1,2,3,4,16].includes(kit.index)||kit.visualAuditEarlyPrepared)return;
 const owner=resources();kit.visualAuditEarlyPrepared=owner;
 profilePosts(kit.world.root,owner,{onlyFolded:true});
 for(const [material,meshes]of [...kit.artBins]){
  for(const mesh of [...meshes]){
   const p=mesh.geometry?.parameters;
   if(!p||mesh.name!=='Folded dark casing'||p.height<.65||p.height>1.12||Math.min(p.width,p.depth)<6)continue;
   const geometry=manufacturedBulkheadGeometry(p.width,p.depth,p.height);geometry.rotateX(-Math.PI/2);
   geometry.parameters={width:p.width,height:p.height,depth:p.depth};geometry.name='Closed underdeck girder / recessed load chassis';
   const replacement=ownMaterial(owner,material,PAINT,{vertexColors:true});
   replace(owner,mesh,geometry,replacement);owner.stats.foldedChassis++;
   const i=meshes.indexOf(mesh);if(i>=0)meshes.splice(i,1);
   kit.artBins.set(replacement,[mesh]);
  }
 }
 // Colour the actual travelling lower chassis, not its porcelain panel or
 // its floor. The car now separates visibly from the static pale gantry.
 const carriers=[kit.state?.['travelling-address'],kit.state?.['stored-power-cabin'],kit.state?.['companion-hoist']].filter(Boolean);
 for(const carrier of carriers)carrier.group?.traverse(mesh=>{
  const p=mesh.geometry?.parameters;
  if(!mesh.isMesh||mesh.userData?.collisionProxy||mesh.userData?.visualAuditEarly||!p||p.height<.55||p.height>.85||p.width<10||p.depth<10)return;
  const geometry=manufacturedBulkheadGeometry(p.width,p.depth,p.height);geometry.rotateX(-Math.PI/2);geometry.parameters={width:p.width,height:p.height,depth:p.depth};
  replace(owner,mesh,geometry,ownMaterial(owner,mesh.material,DARK,{vertexColors:true}));owner.stats.foldedChassis++;
 });
 return owner;
}

function restoreBalanceRoles(level,owner){
 const rig=level.state?.rig;if(!rig?.root)return;
 const roles=[[/bearing race|retaining cap|Trim-weight guide collar/i,BRASS],[/Load tray|Continuous structural box beam|Narrow central walking spine/i,DARK],
  [/A-frame|Tray protective edge|Axle saddle/i,0xb8c7c5],[/axle|spring|counterweight guide|bearing seal/i,METAL]];
 rig.root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.userData?.collisionProxy||Array.isArray(mesh.material))return;
  const role=roles.find(([pattern])=>pattern.test(mesh.name));if(!role)return;
  replace(owner,mesh,mesh.geometry,ownMaterial(owner,mesh.material,role[1]));owner.stats.materialRoles++;
 });
}

function opticsCradle(level,owner,root){
 const pivot=level.state?.optical?.pivot;if(!pivot)return;
 const mount=new THREE.Group();mount.name='Weighted optical cradle / actual mirror pose';mount.matrixAutoUpdate=false;root.add(mount);
 owner.followers.push({target:pivot,mount});
 const metal=new THREE.MeshStandardMaterial({name:'Early audit / optical bearing alloy',color:BRASS,roughness:.4,metalness:.7});owner.materials.push(metal);
 // The mirror works in the Y/Z plane; the housing surrounds that same
 // reflector and its open centre never covers the reflecting face.
 const geometry=new THREE.TorusGeometry(1.34,.115,8,40);geometry.rotateY(Math.PI/2);owner.geometry.push(geometry);
 const ring=new THREE.Mesh(geometry,metal);ring.name='Weighted mirror / continuous open trunnion housing';ring.receiveShadow=true;mount.add(ring);
 const cheekGeometry=new THREE.BoxGeometry(.20,.64,.30);owner.geometry.push(cheekGeometry);
 for(const z of [-1.36,1.36]){
  const cheek=new THREE.Mesh(cheekGeometry,metal);cheek.position.set(0,0,z);cheek.name='Weighted mirror / outboard bearing cheek';mount.add(cheek);
 }
 owner.stats.mirrorBearings++;
}

function finishGlass(level,owner){
 const changed=new Map();level.world.root.traverse(mesh=>{
  if(!mesh.isMesh||Array.isArray(mesh.material)||!mesh.material?.isMeshStandardMaterial||!mesh.material.transparent||mesh.material.opacity>.45||mesh.material.opacity<=0)return;
  const source=mesh.material;
  if(!changed.has(source)){
   const material=source.clone();material.name='Early audit / edged safety glazing';material.color.setHex(0x6eafb5);
   material.opacity=Math.max(.32,material.opacity);material.roughness=.23;material.metalness=.18;owner.materials.push(material);changed.set(source,material);
  }
  replace(owner,mesh,mesh.geometry,changed.get(source));owner.stats.materialRoles++;
 });
}

// Broad work bays are pigment in the EXISTING mineral tiles. They organize
// the vacant foreground around the real devices without adding obstacles,
// thin floor decals, service props, implied platforms or solution arrows.
const WORK_BAYS=Object.freeze({
 5:[[-3.7,3.7,-11.8,-5.0,0,0x91bec6]],
 7:[[-3.7,3.7,-3.3,3.3,0,0x89b8bd],[-4.2,4.2,-12.8,-3.3,7,0xb8d6cd]],
 8:[[-7.2,3.5,-9.1,-1.3,0,0x91b5bf],[-10.5,-3.5,3.0,10.5,0,0xd8c7a4]],
 9:[[-11.5,-5.2,-1.7,5.7,1.82,0x96b6be],[2.4,8.7,-1.7,4.8,1.82,0xc8c5a9]],
 10:[[-11.4,-4.3,.8,7.2,0,0x92b8bd],[-8.6,-2.1,-8.2,-1.9,0,0xd1c09a]],
 11:[[7.1,14.9,-1.9,7.8,9,0xc8b39a]],
 12:[[-18,-8,-16.5,-4.1,6,0x91b9bf],[-18,-8,4.1,14.8,6,0xc3bb9c]],
 13:[[-19,-13,-3,3,6,0x8bb8c1],[-3,3,-3,3,7.4,0x8bb8c1],[.1,7.3,-11.8,-3,12,0xc4bd9f]],
 14:[[-20.8,-8.2,8.1,18.8,0,0x88b7bc],[8.1,20.7,-16.8,-7.1,14,0xbecaa5]],
 15:[[9.1,14.9,2.4,4,13.4,0x93bdc3],[-20,-12,-12.8,-7.1,13.4,0xc7bd9b]],
});
function paintWorkingBays(level,index,owner){
 const zones=WORK_BAYS[index];if(!zones)return;
 const world=level.world,targets=new Map(),matrix=new THREE.Matrix4(),pose=new THREE.Matrix4(),point=V(),tint=new THREE.Color();
 const key=m=>m.elements.map(n=>Math.round(n*1e5)).join(',');
 world.root.updateWorldMatrix(true,true);
 for(const surface of world.surfaces){
  if(!surface.floor||surface.portal||surface.collider?.kinematic)continue;
  const selected=zones.filter(z=>Math.abs(z[4]-surface.floor.y)<.04);if(!selected.length)continue;
  surface.group.traverse(mesh=>{
   if(!mesh.isInstancedMesh||mesh.userData.portalTile)return;
   mesh.geometry.computeBoundingBox();const center=mesh.geometry.boundingBox.getCenter(V());
   const bank=targets.get(mesh.geometry)||new Map();targets.set(mesh.geometry,bank);
   for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,matrix);pose.multiplyMatrices(mesh.matrixWorld,matrix);point.copy(center).applyMatrix4(pose);
    const zone=selected.find(z=>point.x>z[0]&&point.x<z[1]&&point.z>z[2]&&point.z<z[3]);
    if(zone)bank.set(key(pose),zone[5]);
   }
  });
 }
 world.root.traverse(mesh=>{
  const bank=targets.get(mesh.geometry),cassette=mesh.name==='Architectural coat / cassette';
  if(!mesh.isInstancedMesh||(!bank&&!cassette)||!mesh.visible||mesh.userData.portalTile)return;
  for(let n=mesh.parent;n;n=n.parent)if(!n.visible)return;
  let saved=false;
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);pose.multiplyMatrices(mesh.matrixWorld,matrix);
   let color=bank?.get(key(pose));
   if(color===undefined&&cassette&&V(0,0,1).transformDirection(pose).y>.99){
    point.setFromMatrixPosition(pose);
    const zone=zones.find(z=>Math.abs(point.y-z[4])<.14&&point.x>z[0]&&point.x<z[1]&&point.z>z[2]&&point.z<z[3]);color=zone?.[5];
   }
   if(color===undefined)continue;
   if(!saved){owner.instancePaint.push({mesh,attribute:mesh.instanceColor,values:mesh.instanceColor?.array.slice()});saved=true;}
   if(mesh.instanceColor)mesh.getColorAt(i,tint);else tint.setHex(0xffffff);
   mesh.setColorAt(i,tint.multiply(new THREE.Color(color)));owner.stats.floorFieldTiles++;
  }
  if(saved)mesh.instanceColor.needsUpdate=true;
 });
}

function finishEnergyMachineRoles(level,index,owner){
 const art=level.secondChapterArt;
 if(!art||![13,14].includes(index))return;
 const record=new Map();
 for(const mount of art.mounts??[]){
  if(index===13&&!/^14 \/ counterweighted tread/.test(mount.name))continue;
  if(index===14&&!/^15 \/ reversible field/.test(mount.name))continue;
  for(const part of mount.parts){
   if(!record.has(part.mesh)){record.set(part.mesh,true);owner.instancePaint.push({mesh:part.mesh,attribute:part.mesh.instanceColor,values:part.mesh.instanceColor.array.slice()});}
   // The copper brake and dark service well belong to the real moving tread
   // or source backplate. This preserves each original part, gauge and pose.
   const color=part.color===0xd3c3a7?0x729da7:part.color===0xb4774e?0xc58b55:part.color===0x293f3c?0x253f4f:METAL;
   part.mesh.setColorAt(part.index,new THREE.Color(color));owner.stats.materialRoles++;
  }
 }
 for(const mesh of record.keys())mesh.instanceColor.needsUpdate=true;
}

/** Final visual pass for the first seventeen rooms. All moving attachments
 * are scene siblings, so art cannot enlarge a machine measured by Box3 during
 * its physical update. No collider, portal registry, actor, state or clock is
 * written; even the structure profiles remain in their old closed extents. */
export function finishVisualAuditEarly(game,level,index=level?.index){
 if(game.chamberEdition!=='foundation'||!Number.isInteger(index)||index<0||index>16||!level.world||level.visualAuditEarly)return level;
 const owner=level.workshop?.visualAuditEarlyPrepared??resources();
 const root=new THREE.Group();root.name='Early visual audit / machine construction';root.userData={visualOnly:true,keepMaterial:true,revision:EARLY_AUDIT_REVISION};game.scene.add(root);
 owner.renderRoot=root;owner.protected=new Set([...(game.colliders??[]).map(c=>c.mesh),...(game.aimBlockers??[]),...(game.cameraBlockers??[])]);owner.dynamic=new Set((game.colliders??[]).filter(c=>c.kinematic).map(c=>c.mesh));
 if(index>=5&&index<=15)profilePosts(level.world.root,owner);
 if(index===6)restoreBalanceRoles(level,owner);
 if(index===9)finishGlass(level,owner);
 paintWorkingBays(level,index,owner);finishEnergyMachineRoles(level,index,owner);
 if(index===10){
  // Retain the controller's own active colour updates. The stronger integral
  // border makes its existing turntable visible against the beige court.
  const plate=level.state?.driveTurn?.plate;
  if(plate?.geometry?.parameters){
   const p=plate.geometry.parameters,g=manufacturedBulkheadGeometry(p.width,p.depth,p.height);g.rotateX(-Math.PI/2);g.parameters={width:p.width,height:p.height,depth:p.depth};
   const original=plate.material;original.vertexColors=true;original.roughness=.48;original.metalness=.38;
   replace(owner,plate,g,original);owner.stats.foldedChassis++;
  }
 }
 if(index===12)opticsCradle(level,owner,root);
 const inverse=new THREE.Matrix4();let disposed=false;
 const sync=()=>{
  if(disposed)return;root.updateWorldMatrix(true,false);inverse.copy(root.matrixWorld).invert();
  for(const {target,mount}of owner.followers){target.updateWorldMatrix(true,false);mount.matrix.multiplyMatrices(inverse,target.matrixWorld);mount.matrixWorldNeedsUpdate=true;}
 };
 const oldRender=level.renderUpdate,oldReset=level.reset,oldDispose=level.dispose;
 const render=function(...args){const r=oldRender?.apply(this,args);sync();return r;};
 const reset=function(...args){const r=oldReset?.apply(this,args);sync();return r;};
 const release=()=>{
  if(disposed)return;disposed=true;root.removeFromParent();root.clear();
  // Pre-flush source meshes have been detached and their old geometries
  // disposed by OpenChamber. They are no longer render/collision owners.
  const flushed=new Set(),materialOrigins=new Map();
  for(const r of owner.replacements){
   if(r.replacementMaterial!==r.material)materialOrigins.set(r.replacementMaterial,r.material);
   if(!r.mesh.parent)flushed.add(r.replacementGeometry);
   if(!r.mesh.parent)continue;
   if(r.mesh.geometry===r.replacementGeometry)r.mesh.geometry=r.geometry;
   if(r.mesh.material===r.replacementMaterial)r.mesh.material=r.material;
  }
  // A pre-finish material can survive on the merged architecture even though
  // its source mesh was detached. Restore that reference before disposing our
  // copies so the generic room cleanup never owns an already-released copy.
  level.world.root.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const restore=m=>materialOrigins.get(m)??m;
   mesh.material=Array.isArray(mesh.material)?mesh.material.map(restore):restore(mesh.material);
  });
  for(const {mesh,attribute,values}of owner.instancePaint){
   mesh.instanceColor=attribute;if(attribute&&values){attribute.array.set(values);attribute.needsUpdate=true;}
  }
  for(const g of new Set(owner.geometry))if(!flushed.has(g))g.dispose();for(const m of new Set(owner.materials))m.dispose();
 };
 level.dispose=function(...args){if(disposed)return;release();return oldDispose?.apply(this,args);};
 if(owner.followers.length){level.renderUpdate=render;level.reset=reset;sync();}
 const stats=Object.freeze({revision:EARLY_AUDIT_REVISION,level:index+1,...owner.stats,followers:owner.followers.length});
 root.userData.stats=stats;level.visualAuditEarly={root,stats,followers:owner.followers};return level;
}
