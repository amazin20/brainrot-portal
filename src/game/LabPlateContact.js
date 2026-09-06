import * as THREE from 'three';
const axes=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)];
/** Contact footprint against the actual moving top, not distance to its centre.
 * Project the rotated cargo box onto the plate's tangent axes. Partial edge
 * contact counts; a carried object, adjacent frame or hovering body does not. */
export function cargoLoadsPlate(cargo,held,frame,halfSize=.39){
 if(held||!cargo||!frame)return false;
 const delta=cargo.position.clone().sub(frame.center),q=cargo.quaternion||new THREE.Quaternion();
 const extent=axis=>halfSize*axes.reduce((sum,a)=>sum+Math.abs(a.clone().applyQuaternion(q).dot(axis)),0);
 const bottom=delta.dot(frame.normal)-extent(frame.normal);
 return bottom>=-.10&&bottom<=.13&&Math.abs(cargo.velocity.dot(frame.normal))<1.1
  &&Math.abs(delta.dot(frame.right))<frame.halfWidth+extent(frame.right)-.045
  &&Math.abs(delta.dot(frame.up))<frame.halfHeight+extent(frame.up)-.045;
}
