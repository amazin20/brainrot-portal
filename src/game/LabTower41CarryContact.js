import * as THREE from 'three';
import {Body,Box} from 'cannon-es';

const EPS=1e-7,SKIN=1e-4,MAX_OVERDRIVE=.0005;
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const finiteVector=v=>v&&[v.x,v.y,v.z].every(Number.isFinite);
const validQuaternion=q=>q&&[q.x,q.y,q.z,q.w].every(Number.isFinite)&&Math.abs(q.x*q.x+q.y*q.y+q.z*q.z+q.w*q.w-1)<EPS;
const sameVector=(a,b)=>finiteVector(a)&&finiteVector(b)&&V().copy(a).distanceToSquared(b)<EPS*EPS;
function frame(body,index){
 const shape=body.shapes[index],offset=body.shapeOffsets[index],orientation=body.shapeOrientations[index];
 if(!(shape instanceof Box)||!finiteVector(offset)||!validQuaternion(orientation)||!validQuaternion(body.quaternion))return null;
 const bodyQuaternion=new THREE.Quaternion().copy(body.quaternion),q=bodyQuaternion.clone().multiply(new THREE.Quaternion().copy(orientation));
 return {shape,half:V().copy(shape.halfExtents),offset,quaternion:q,centre:V().copy(offset).applyQuaternion(bodyQuaternion).add(body.position),axes:[V(1,0,0),V(0,1,0),V(0,0,1)].map(a=>a.applyQuaternion(q))};
}
const extent=(half,q,n)=>[V(1,0,0),V(0,1,0),V(0,0,1)].reduce((sum,a,i)=>sum+half.getComponent(i)*Math.abs(a.applyQuaternion(q).dot(n)),0);
function overlapsTop(centre,half,q,tray){
 const relative=centre.clone().sub(tray.centre);
 return [0,2].every(i=>tray.half.getComponent(i)+extent(half,q,tray.axes[i])-Math.abs(relative.dot(tray.axes[i]))>SKIN);
}

/** A qualified tray top can receive actual held-body pressure. This only
 * bounds the desired hand target; Cannon still solves the original bodies.
 * Every ordinary wall, side/underside approach and invalid tag returns null
 * and therefore retains the caller's normal 35 mm carry-target clearance. */
export function constrainTower41HeldLoadTarget(game,collider,start,target,quaternion){
 const level=game.firstLevel,physics=game.physics,tag=collider.tower41LoadFace,cell=level?.ratchetCell;
 if(!game.tower41RatchetQualification||!level?.singularity||!cell||!tag||tag.cell!==cell
  ||cell.owner!==physics||cell.rackParts?.[0]?.collider!==collider||tag.body!==cell.rack||tag.shapeIndex!==0
  ||collider.enabled===false||game.heldCube!==game.cargo||cell.originalCargo!==game.cargo
  ||cell.originalCargoBody!==physics?.cargoBody||!finiteVector(start)||!finiteVector(target)||!validQuaternion(quaternion))return null;
 const rack=tag.body,cargo=physics.cargoBody,box=collider.orientedBox;
 if(rack.type!==Body.DYNAMIC||cargo.type!==Body.DYNAMIC||!physics.world.bodies.includes(rack)||!physics.world.bodies.includes(cargo)
  ||!box||box.body!==rack||rack.collisionResponse===false||cargo.collisionResponse===false
  ||!(rack.collisionFilterGroup&cargo.collisionFilterMask)||!(cargo.collisionFilterGroup&rack.collisionFilterMask))return null;
 const tray=frame(rack,0),actual=frame(cargo,0);
 if(!tray||!actual||tray.shape.collisionResponse===false||actual.shape.collisionResponse===false
  ||!sameVector(box.half,tray.half)||!sameVector(box.offset,tray.offset)||!sameVector(box.current?.center,tray.centre)
  ||!validQuaternion(box.current?.quaternion)||Math.abs(box.current.quaternion.dot(tray.quaternion))<1-EPS)return null;
 const normal=tray.axes[1],top=tray.centre.dot(normal)+tray.half.y;
 if(normal.y<.999)return null;
 const actualBottom=actual.centre.dot(normal)-extent(actual.half,actual.quaternion,normal);
 const desiredExtent=extent(actual.half,quaternion,normal),desiredBottom=target.dot(normal)-desiredExtent;
 // A side or underside arrival cannot acquire this top-face policy. A small
 // existing contact penetration is tolerated, not corrected on the body.
 if(actualBottom<top-.003||desiredBottom>=top+.035+SKIN
  ||target.dot(normal)>actual.centre.dot(normal)+EPS
  ||!overlapsTop(actual.centre,actual.half,actual.quaternion,tray)
  ||!overlapsTop(target,actual.half,quaternion,tray))return null;
 const result=target.clone();
 if(desiredBottom<top-MAX_OVERDRIVE)result.addScaledVector(normal,top-MAX_OVERDRIVE-desiredBottom);
 return result;
}
