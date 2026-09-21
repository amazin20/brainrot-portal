import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** A few large authored silhouettes, merged by finish. Decoration never enters
 * the collision/aim registries and adds no light, texture, or frame callback. */
export function buildRoom28Art(k){
 const w=k.world,root=new THREE.Group();root.name='Coral arches and tidal observatory';root.userData.keepMaterial=true;w.root.add(root);
 const materials={coral:new THREE.MeshStandardMaterial({color:0xff9d84,roughness:.58}),gold:new THREE.MeshStandardMaterial({color:0xf8d56c,roughness:.42,metalness:.2}),blue:new THREE.MeshStandardMaterial({color:0x266399,roughness:.50,metalness:.18}),aqua:new THREE.MeshStandardMaterial({color:0x41d3c5,roughness:.58}),pink:new THREE.MeshStandardMaterial({color:0xe987b8,roughness:.65})};
 // Visible mass under the walking surfaces replaces the appearance of paper
 // sheets. The new slab collision ends below the existing physical deck.
 for(const surface of w.surfaces){
  const f=surface.floor;if(!f||f.y<2||surface.collider.kinematic)continue;
  const slab=w.box([(f.minX+f.maxX)/2,f.y-.30,(f.minZ+f.maxZ)/2],[f.maxX-f.minX,.49,f.maxZ-f.minZ],materials.aqua,true);
  slab.name=surface.name+' island foundation';slab.userData.keepMaterial=true;
 }
 for(const [name,color] of [['coral-float','coral'],['lagoon-float','aqua']]){
  const float=k.state[name];const width=float.floor.maxX-float.floor.minX,depth=float.floor.maxZ-float.floor.minZ;
  const hull=w.box([0,-.35,0],[width-.06,.52,depth-.06],materials[color],false,float.group);hull.userData.keepMaterial=true;
 }
 const pieces=Object.fromEntries(Object.keys(materials).map(key=>[key,[]]));
 const add=(geometry,color,position,rotation=[0,0,0],scale=[1,1,1])=>{
  const transform=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale));
  pieces[color].push(geometry.applyMatrix4(transform));
 };
 // Broad rounded crowns make the coral well legible over the entire lagoon.
 for(const z of [-6.25,6.25]){
  add(new THREE.TorusGeometry(5.1,.30,7,30,Math.PI),'coral',[-14,10.6,z]);
  add(new THREE.TorusGeometry(4.55,.07,5,26,Math.PI),'gold',[-14,10.6,z+.08]);
 }
 // The middle route is a low arc; the upper route has the distinct armillary.
 for(const x of [-5,3])add(new THREE.TorusGeometry(2.3,.18,6,24,Math.PI),'aqua',[x,3,8.25]);
 for(const [angle,radius,color] of [[0,2.5,'gold'],[Math.PI/3,2.1,'blue'],[-Math.PI/3,1.6,'gold']])add(new THREE.TorusGeometry(radius,.095,6,36),color,[12,9.5,-12],[0,angle,.4]);
 add(new THREE.SphereGeometry(.62,14,10),'aqua',[12,9.5,-12]);
 add(new THREE.CylinderGeometry(.24,.42,3.5,8),'blue',[12,7.1,-12]);
 add(new THREE.CylinderGeometry(1.2,1.5,.26,12),'gold',[12,5.46,-12]);
 // Paired sculpted corals, kept on the ground beyond the walking routes.
 for(const [x,z] of [[-22,13],[-22,-15],[22,16],[22,-17],[0,-19]]){
  add(new THREE.CylinderGeometry(.28,.40,3.4,7),'coral',[x,1.7,z],[0,0,.08]);
  add(new THREE.SphereGeometry(.82,9,7),'pink',[x-.7,2.8,z],[0,0,0],[1.2,.75,.8]);
  add(new THREE.SphereGeometry(.90,9,7),'aqua',[x+.7,3.5,z+.15],[0,0,0],[1,.70,.9]);
  add(new THREE.TorusGeometry(.7,.17,6,16,Math.PI),'gold',[x,3.7,z+.2],[0,.3,0]);
 }
 // Foundation rings show the complete equal-sized basins even at low tide.
 for(const x of [-14,14]){
  add(new THREE.TorusGeometry(6.7,.10,5,42),'blue',[x,.12,0],[Math.PI/2,0,0],[.79,1,1]);
  for(let i=0;i<5;i++)add(new THREE.CylinderGeometry(.10,.10,.12,6),'gold',[x+5.25,.3+i*1.35,0]);
 }
 for(const [name,geometries] of Object.entries(pieces)){
  if(!geometries.length)continue;const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
  const mesh=new THREE.Mesh(merged,materials[name]);mesh.name='Tidal observatory '+name;mesh.receiveShadow=true;mesh.castShadow=false;root.add(mesh);
 }
 return root;
}
