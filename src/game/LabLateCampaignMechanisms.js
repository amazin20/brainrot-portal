import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const V=(...p)=>new THREE.Vector3(...p);

/** Same manufactured block as OpenChamber.block, kept outside the static
 * assembly so its live pose and owned geometry survive the room flush. */
export function movingMechanismBlock(k,name,p,size,material='secondary'){
 return k.geometry(new RoundedBoxGeometry(...size,1,Math.min(.08,...size.map(x=>x*.18))),material,p,new THREE.Quaternion(),{solid:false,batch:false,name});
}

/** Intersect the actual rotated rigid cargo box, rather than a receiver ID,
 * a proximity flag or a square enlargement of its world-space bounds. */
export function cargoOccludes(game,segments){
 const c=game.cargo;if(!c)return false;
 const inverse=(c.quaternion??new THREE.Quaternion()).clone().invert();
 const box=new THREE.Box3(V(-.39,-.39,-.39),V(.39,.39,.39));
 for(const s of segments){
  const a=s.a.clone().sub(c.position).applyQuaternion(inverse);
  const direction=s.direction.clone().applyQuaternion(inverse);
  const hit=new THREE.Ray(a,direction).intersectBox(box,V());
  if(hit&&hit.clone().sub(a).dot(direction)>.005&&hit.distanceTo(a)<s.length-.025)return true;
 }
 return false;
}

/** Render an absorbed light ray ending on the same rigid box used by the
 * optical circuit. The uncut path remains available to compare raw sensors. */
export function clipCargoRay(game,segments){
 const cargo=game.cargo;if(!cargo)return segments;
 const inverse=cargo.quaternion.clone().invert(),box=new THREE.Box3(V(-.39,-.39,-.39),V(.39,.39,.39));
 const visible=[];
 for(const s of segments){
  const a=s.a.clone().sub(cargo.position).applyQuaternion(inverse),dir=s.direction.clone().applyQuaternion(inverse);
  const hit=new THREE.Ray(a,dir).intersectBox(box,V()),distance=hit?.distanceTo(a);
  if(hit&&hit.clone().sub(a).dot(dir)>.005&&distance<s.length-.025){visible.push({...s,b:s.a.clone().addScaledVector(s.direction,distance),length:distance,kind:'cargo'});break;}
  visible.push(s);
 }
 return visible;
}

/** A displayed sliding shutter with the same physical box at every pose. */
export function lateShutter(k,name,p,size,offset){
 const mesh=movingMechanismBlock(k,name,p,size);
 const collider=k.game.collisionProxy(new THREE.Box3().setFromObject(mesh),{kinematic:true});
 const origin=V(...p),travel=V(...offset),state={mesh,collider,progress:0,target:false};
 state.update=dt=>{
  state.progress=THREE.MathUtils.damp(state.progress,state.target?1:0,5,dt);
  mesh.position.copy(origin).addScaledVector(travel,state.progress);mesh.updateWorldMatrix(true,false);
  k.game.syncCollision(collider,new THREE.Box3().setFromObject(mesh),dt);
 };
 state.reset=()=>{state.progress=0;state.target=false;state.update(0);};
 k.resets.push(state.reset);return state;
}

/** Authored hardware surrounding the freight passage. The actual aperture,
 * roof and manufactured observation slots enforce the selected clearances. */
export function freightHood(k,{x0,x1,z0,z1,ceiling=1.85,name='Low freight hood'}){
 k.block([(x0+x1)/2,ceiling+.12,(z0+z1)/2],[x1-x0,.24,z1-z0],'shell');
 for(const z of [z0,z1])k.block([(x0+x1)/2,.15,z],[x1-x0,.30,.18],'metal');
 k.label(name,[(x0+x1)/2,ceiling+.50,z1+.04],[0,0,1],Math.min(11,x1-x0),.6);
 return {minX:x0,maxX:x1,minZ:z0,maxZ:z1,ceiling};
}
