import * as THREE from 'three';
import {V} from './LabWorkshopKit.js';

/** A bounded acceleration field, applied to the original Cannon body only.
 * Control changes force direction; it never changes an actor pose or gravity. */
export function inversionAcceleration(field,position,velocity){
 if(!field.enabled||!field.bounds.containsPoint(position))return V();
 const speed=field.up?(field.id==='crown'&&position.x<15?0:3.8):-3.8;
 const a=V(0,19.5+THREE.MathUtils.clamp(speed-velocity.y,-7,7)*4,0);
 if(field.up&&field.drift){
  a.x=THREE.MathUtils.clamp((field.targetX-position.x)*2.4-velocity.x*3,-10,10);
  a.z=THREE.MathUtils.clamp((field.targetZ-position.z)*2.4-velocity.z*3,-10,10);
 }else{a.x=-velocity.x*2;a.z=-velocity.z*2;}
 return a;
}
export function buildRoom29Gravity(k){
 const game=k.game,w=k.world;
 const source={id:'root',enabled:true,up:false,bounds:new THREE.Box3(V(-15,0,5),V(-9,17,11)),drift:true,targetX:-12,targetZ:8};
 const crown={id:'crown',enabled:true,up:true,bounds:new THREE.Box3(V(5,8,-19),V(20,17,-7)),drift:true,targetX:16,targetZ:-13};
 const fields=[source,crown],matrix=new THREE.Matrix4();
 const geom=new THREE.ConeGeometry(.13,.43,4),material=new THREE.MeshBasicMaterial({color:0xe7e884});
 const arrows=new THREE.InstancedMesh(geom,material,40);arrows.userData.keepMaterial=true;arrows.frustumCulled=false;w.root.add(arrows);
 let previousDirections='';
 k.ticks.push(()=>{
  const directions=fields.map(f=>Number(f.up)).join('');if(directions===previousDirections)return;previousDirections=directions;
  let index=0;
  for(const f of fields)for(let n=0;n<20;n++){
   const y=f.bounds.min.y+1+(n%5)*((f.bounds.max.y-f.bounds.min.y-2)/4),angle=Math.floor(n/5)*Math.PI/2;
   const x=f.id==='root'?-12+Math.cos(angle)*2.75:12.5+Math.cos(angle)*6.7,z=f.id==='root'?8+Math.sin(angle)*2.75:-13+Math.sin(angle)*5.5;
   matrix.compose(V(x,y,z),new THREE.Quaternion().setFromAxisAngle(V(1,0,0),f.up?0:Math.PI),V(1,1,1));arrows.setMatrixAt(index++,matrix);
  }
  arrows.instanceMatrix.needsUpdate=true;
 });
 k.forces.push(()=>{
  if(game.heldCube||!game.physics?.cargoBody)return;
  const body=game.physics.cargoBody,p=V(body.position.x,body.position.y,body.position.z),v=V(body.velocity.x,body.velocity.y,body.velocity.z);
  for(const f of fields){const a=inversionAcceleration(f,p,v);if(!a.lengthSq())continue;body.wakeUp();body.force.x+=a.x*body.mass;body.force.y+=a.y*body.mass;body.force.z+=a.z*body.mass;}
 });
 k.resets.push(()=>{source.up=false;crown.up=true;});
 k.state.gravity={source,crown,fields};return k.state.gravity;
}
