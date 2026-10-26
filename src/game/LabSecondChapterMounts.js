import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const PAINT=0x78958e,METAL=0xbcc4b6,COPPER=0xb78050,DARK=0x344f50;
function colored(geometry,color){
 const g=geometry.index?geometry.toNonIndexed():geometry;if(g!==geometry)geometry.dispose();
 const c=new THREE.Color(color),a=new Float32Array(g.attributes.position.count*3);
 for(let i=0;i<a.length;i+=3)a.set([c.r,c.g,c.b],i);
 g.setAttribute('color',new THREE.BufferAttribute(a,3));return g;
}

/** Fixed castings join optical devices to their actual rails, floor or wall.
 * Every closed piece is its own visible camera/aim owner and real static Box.
 * No box encloses the empty space below a cantilever or between two standards.
 * All original actors, optical centres and moving lift assemblies survive. */
export function installSecondChapterMounts(game,level,parent){
 if(![12,13].includes(level.index))return{meshes:[],castings:[],colliders:[],material:null,dispose(){}};
 const meshes=[],castings=[],colliders=[],material=new THREE.MeshStandardMaterial({name:'Energy machinery / cast mounting metal',vertexColors:true,roughness:.53,metalness:.46});
 const add=(name,boxes,metadata)=>{
  const casting={name,meshes:[],metadata};castings.push(casting);
  boxes.forEach(([p,size,color,label,r=.012])=>{
   const geometry=colored(new RoundedBoxGeometry(...size,1,Math.min(r,...size.map(n=>n/6))),color);geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const mesh=new THREE.Mesh(geometry,material);mesh.position.fromArray(p);mesh.name=`${name} / ${label}`;mesh.receiveShadow=true;mesh.castShadow=false;mesh.userData={secondChapterMount:true,...metadata};parent.add(mesh);mesh.updateWorldMatrix(true,false);
   const collider={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true};game.colliders.push(collider);colliders.push(collider);
   game.cameraBlockers.push(mesh);game.aimBlockers.push(mesh);meshes.push(mesh);casting.meshes.push(mesh);
   // Normal room construction runs before LabPhysics exists. Reinstalling a
   // presentation on a surviving room must own the same real bodies as well.
   game.physics?.addStaticBox(mesh.uuid,collider.box);
  });return casting;
 };
 if(level.index===12){
  for(const sign of [-1,1]){
   const x=-10+sign*1.73;
   add(`13 / north optical receiver ${sign<0?'left':'right'} cast arm`,[
    [[x,8,-8.78],[1.30,.22,.36],PAINT,'load arm'],
    [[-10+sign*2.28,8,-8.745],[.22,.38,.18],DARK,'rail collar'],
    [[-10+sign*1.15,8,-8.925],[.20,.34,.07],COPPER,'receiver saddle'],
    [[x,8.115,-8.78],[.92,.035,.20],METAL,'upper return',.005],
   ],{mountRole:'receiver-arm',side:'north',sign,guide:[-10+sign*2.28,9,-8.7],ringFront:[-10+sign*1.10,8,-8.9134],clearOpticalRadius:1.05});
  }
  // The southern rails are four metres behind the receiver. Short standards
  // bear on the permanent entrance deck instead of spanning the moving cab.
  // Both castings touch the front quadrant of the actual ring. Their entire
  // thickness clears the cabin's full 6–12 m sweep, including its edge trim.
  for(const sign of [-1,1]){
   const x=-10+sign*1.15;
   add(`13 / south optical receiver ${sign<0?'left':'right'} grounded standard`,[
    [[x,6.035,8.78],[.36,.09,.34],DARK,'grounded foot'],
    [[x,6.90,8.87],[.14,1.80,.14],PAINT,'standard'],
    [[x,7.85,8.925],[.22,.30,.07],COPPER,'receiver saddle'],
   ],{mountRole:'receiver-standard',side:'south',sign,floorY:6,ringFront:[-10+sign*1.10,7.9,8.9162],clearOpticalRadius:1.05});
  }
 }
 if(level.index===13){
  for(const sign of [-1,1]){
   const x=-10+sign*.82;
   add(`14 / light-sheet projector ${sign<0?'left':'right'} wall bracket`,[
    [[x,4.56,-8.63],[.28,.72,.24],DARK,'wall plate'],
    [[x,4.86,-7.61],[.18,.16,2.02],PAINT,'cantilever'],
    [[x,4.90,-6.79],[.31,.08,.34],COPPER,'projector saddle'],
    [[x,4.56,-8.493],[.12,.45,.045],METAL,'plate insert',.004],
    [[x,4.67,-8.18],[.16,.25,.88],DARK,'closed root haunch'],
   ],{mountRole:'projector-bracket',sign,wallFaceZ:-8.625,wallTopY:5,projectorBottomY:4.875});
  }
 }
 if(game.physics)game.indexColliders?.();
 let disposed=false;
 return {meshes,castings,colliders,material,dispose(){
  if(disposed)return;disposed=true;
  for(const mesh of meshes){
   game.physics?.removeStaticBox(mesh.uuid);
   for(const registry of [game.cameraBlockers,game.aimBlockers]){const i=registry.indexOf(mesh);if(i!==-1)registry.splice(i,1);}
   const i=game.colliders.findIndex(c=>c.mesh===mesh);if(i!==-1)game.colliders.splice(i,1);
   mesh.removeFromParent();mesh.geometry.dispose();
  }
  if(game.physics)game.indexColliders?.();material.dispose();
 }};
}
