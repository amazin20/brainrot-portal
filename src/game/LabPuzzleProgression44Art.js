import * as THREE from 'three';
import {manufacturedBulkheadGeometry} from './LabManufacturedFinish.js';
/** Broad mint/terracotta architecture; no art-only gameplay collision. */
export function dressPuzzleProgression44(k,{entry,middle,north,freight,exit}){
 const mint=new THREE.MeshStandardMaterial({name:'Progression44 / mint folded enamel',color:0x539b91,roughness:.6,metalness:.12});
 const coral=new THREE.MeshStandardMaterial({name:'Progression44 / terracotta bay enamel',color:0xcb8c71,roughness:.61,metalness:.11});
 k.m.shell.color.setHex(0x66a196);k.m.secondary.color.setHex(0xcb8c71);
 // Integral folds replace the visible casings inside their original boxes;
 // the authored physical windows and all collider registries stay unchanged.
 for(const mesh of k.world.root.children){
  if(!mesh.isMesh||mesh.userData.collisionProxy||mesh.material!==k.m.shell)continue;
  const p=mesh.geometry.parameters;if(!p||p.height<4)continue;
  const thinX=p.width<1&&p.depth>4,thinZ=p.depth<1&&p.width>4;if(!thinX&&!thinZ)continue;
  const old=mesh.geometry;mesh.geometry=manufacturedBulkheadGeometry(thinX?p.depth:p.width,p.height,thinX?p.width:p.depth);
  mesh.geometry.deleteAttribute('color');if(thinX)mesh.geometry.rotateY(Math.PI/2);old.dispose();
 }
 const restore=k.restoreLight.bind(k);k.restoreLight=()=>{mint.dispose();coral.dispose();restore();};
 const band=(p,s,mat)=>k.block(p,s,mat,false,k.world.root,.12);
 for(const [deck,tint]of [[entry,mint],[middle,mint],[north,mint],[freight,coral],[exit,coral]]){
  const d=deck.record,x=(d.minX+d.maxX)/2,z=(d.minZ+d.maxZ)/2;
  band([x,d.y-.84,d.maxZ-.18],[d.maxX-d.minX-.8,.36,.18],tint);
  for(const sx of [-1,1])band([x+sx*(d.maxX-d.minX)/2,d.y-.85,z],[.17,.34,d.maxZ-d.minZ-.8],tint);
 }
 for(const x of [-24,0,24]){
  band([x,25.8,-21],[10,1.0,6],x===24?coral:mint);
  band([x,25.20,-21],[8,.16,3.8],k.m.white);
  for(const dx of [-4,4])band([x+dx,26.45,-21],[.4,1.1,3.8],k.m.metal);
 }
 for(const z of [21,-4,-21]){
  band([-31.2,12,z],[.24,7,10],mint);
  band([31.2,12,z],[.24,7,10],coral);
 }
 k.label('СЛУЖЕБНЫЙ ВОЗВРАТ',[-30.8,1.8,7],[1,0,0],9,.7);
}
