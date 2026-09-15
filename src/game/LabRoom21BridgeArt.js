import * as THREE from 'three';
import { createMachinedChassis } from './LabMachinedModels.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
/** Room-local gantry adaptation. Reuse the imported fixed frame, not an entire
 * ten-metre lift travelling underneath a four-metre-wide bridge. The source
 * asset/cache is untouched. Ropes and the actual deck follow the slider pose. */
export function dressRoom21Bridge(k,bridge){
 const root=new THREE.Group();root.name='Source bridge · stationary gantry and suspended chassis';
 root.userData.source='src/game/LabRoom21BridgeArt.js';k.world.root.add(root);
 const frame=bridge.art.art.getObjectByName('Frame');
 if(!frame)throw Error('Source lift is missing its fixed frame');
 k.world.root.updateWorldMatrix(true,true);root.attach(frame);
 let box=new THREE.Box3().setFromObject(frame),center=box.getCenter(V());
 frame.position.y+=.08-box.min.y;frame.position.z+=20-center.z;
 frame.updateWorldMatrix(true,true);box.setFromObject(frame);
 // The gantry stands behind the travel deck; its broad housing is solid.
 const housing=k.game.collisionProxy(box);housing.mesh.name='Source gantry / housing';
 bridge.art.art.visible=false; // Only the detached fixed frame is reused here.
 const chassis=createMachinedChassis({width:12,depth:4,height:.62,y:0,accent:k.spec.accent});
 chassis.name='Twelve-metre suspended source deck';
 chassis.position.y=-new THREE.Box3().setFromObject(chassis).max.y-.10;
 bridge.group.add(chassis);
 const steel=new THREE.MeshStandardMaterial({color:0x6e888e,metalness:.7,roughness:.34});
 const ropeMat=new THREE.MeshStandardMaterial({color:0x30484f,metalness:.6,roughness:.49});
 const ropes=[],drums=[];
 const rod=(a,b,radius,material)=>{
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,1,12),material);
  root.add(mesh);align(mesh,a,b);return mesh;
 };
 function align(mesh,a,b){const delta=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.scale.y=Math.max(.001,delta.length());mesh.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());}
 for(const z of [13.75,17.25]){
  rod(V(-33.3,8.3,z),V(-20.7,8.3,z),.11,steel);
  for(const x of [-32.6,-21.4]){
   const top=V(x,8.16,z),bottom=V(x,bridge.position.y-.15,z);
   ropes.push({mesh:rod(top,bottom,.045,ropeMat),top,x,z});
   const drum=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.25,20),steel);
   drum.position.set(x,8.28,z);drum.rotation.x=Math.PI/2;root.add(drum);drums.push(drum);
  }
 }
 // Cross braces connect front winding beam to the original rear gantry.
 for(const x of [-29.6,-24.4])rod(V(x,box.max.y-.15,18.3),V(x,8.3,13.75),.09,steel);
 const render=()=>{
  for(const rope of ropes)align(rope.mesh,rope.top,V(rope.x,bridge.group.position.y-.15,rope.z));
  for(const drum of drums)drum.rotation.y=bridge.group.position.y/.22;
 };
 k.renders.push(render);k.resets.push(render);render();
 const fixedPose=frame.matrixWorld.clone();root.userData.colliderIndependent=true;
 return {root,frame,housing,chassis,ropes,render,fixedPose};
}
