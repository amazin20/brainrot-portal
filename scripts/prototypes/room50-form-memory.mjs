/** Geometry feasibility prototype, NOT a replacement campaign builder.
 * Both leaves are rigid six-metre parts joined by actual endpoint geometry.
 * No actors, cargo bodies, portals, game states or permissions are changed.
 */
import * as THREE from 'three';
import {OBB} from 'three/addons/math/OBB.js';

const V=(...p)=>new THREE.Vector3(...p);
const length=6,width=3,thickness=.25,height=.2;
export const FORM_POSES=Object.freeze({
 initial:{first:Math.PI/12,second:Math.PI/2},
 short:{first:0,second:0},
 long:{first:-Math.PI/2,second:0},
});
export const RETRIEVAL_FRAME=Object.freeze({position:[0,.01,3],normal:[0,1,0],cargoSize:.78,clearance:.07});

function leaf(name,start,angle){
 const direction=V(Math.sin(angle),0,Math.cos(angle));
 const end=start.clone().addScaledVector(direction,length);
 const center=start.clone().add(end).multiplyScalar(.5).setY(height);
 const rotation=new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationY(angle));
 return {name,start:start.clone(),end,center,angle,obb:new OBB(center.clone(),V(width/2,thickness/2,length/2),rotation)};
}
export function formGeometry(pose){
 const first=leaf('first',V(0,0,0),pose.first),second=leaf('second',first.end,pose.second);
 return {leaves:[first,second],end:second.end};
}
export function retrievalAccess(geometry,{observer=[3,3.2,-2],retainedFrame=RETRIEVAL_FRAME}={}){
 const target=V(...retainedFrame.position),eye=V(...observer),direction=target.clone().sub(eye),length=direction.length();direction.normalize();
 const ray=new THREE.Ray(eye,direction),hit=V();
 const blockers=geometry.leaves.filter(part=>part.obb.intersectRay(ray,hit)&&hit.distanceTo(eye)<length-.001).map(part=>part.name);
 // Current LabGame cargo uses normal box extent +.07 exit clearance.
 // This static overlap is not a simulation of resolveCargoTransit: that
 // production sweep may move or reject a body and needs an ordinary probe.
 // A retained portal owns its backing, never this separate rigid leaf.
 const cargoCenter=target.clone().addScaledVector(V(...retainedFrame.normal),retainedFrame.cargoSize/2+retainedFrame.clearance);
 const cargo=new OBB(cargoCenter,V(retainedFrame.cargoSize/2,retainedFrame.cargoSize/2,retainedFrame.cargoSize/2),new THREE.Matrix3());
 const exitBlockers=geometry.leaves.filter(part=>part.obb.intersectsOBB(cargo)).map(part=>part.name);
 return {shotLine:{observer,blockedBy:blockers,clear:blockers.length===0},exitVolume:{center:cargoCenter.toArray(),size:retainedFrame.cargoSize,blockedBy:exitBlockers,clear:exitBlockers.length===0,productionTransitOutcome:'not simulated'},portalObjectPreserved:true};
}
export function floorGraph(geometry){
 // This is endpoint connectivity only. It omits capsule movement, falls,
 // jumps and clearance; its paths are not ordinary-input completion proof.
 const nodes={south:[0,0,0],joint:geometry.leaves[0].end.toArray(),tip:geometry.end.toArray(),west:[-6,0,6],return:[-6,0,12],north:[0,0,12]};
 const edges=[['south','joint'],['joint','tip'],['west','return'],['return','north']];
 for(const dock of ['west','return','north'])if(V(...nodes.tip).distanceTo(V(...nodes[dock]))<.001)edges.push(['tip',dock]);
 const queue=[['south']],visited=new Set(['south']);let route=null;
 while(queue.length){const path=queue.shift(),node=path.at(-1);if(node==='north'){route=path;break;}
  for(const edge of edges){const other=edge[0]===node?edge[1]:edge[1]===node?edge[0]:null;if(other&&!visited.has(other)){visited.add(other);queue.push([...path,other]);}}
 }
 return {nodes,edges,path:route,connected:!!route,length:route?route.slice(1).reduce((sum,node,i)=>sum+V(...nodes[node]).distanceTo(V(...nodes[route[i]])),0):null};
}
export function inspectForms(){
 const retainedFrame=RETRIEVAL_FRAME;
 const rows=Object.entries(FORM_POSES).map(([name,pose])=>{const geometry=formGeometry(pose);return {name,pose,leaves:geometry.leaves.map(({name,start,end,center,angle})=>({name,start:start.toArray(),end:end.toArray(),center:center.toArray(),angle})),floorGraph:floorGraph(geometry),access:retrievalAccess(geometry,{retainedFrame})};});
 const badPresetFloor={kind:'Rejected original paper sketch',assumption:'floor R visible and clear before assembly',deliveryPair:['external source S','retrieval floor R'],effect:'S→R can deliver the original cargo and preserve R. A second wall outlet is not a physical invariant.'};
 return {scope:'Bounded rigid-leaf geometry/access feasibility only. No game builder, mechanism drive, actor simulation, native rendering, cargo support or designer acceptance.',rows,retainedPortalAttack:{frame:retainedFrame,states:rows.map(r=>({form:r.name,newShotClear:r.access.shotLine.clear,retainedExitClear:r.access.exitVolume.clear})),deletedOrMoved:false,productionTransitOutcome:'not simulated'},rejectedSketch:badPresetFloor,open:['actual spring contact/continuous reversible linkage drive','ordinary positive routes and both energy-source configurations in this new geometry','early player/cargo portal bypasses','actual fixed bay and side-gallery envelopes','resolveCargoTransit outcome against the independent leaf','recover/refold portal endpoints with real controller','first discovery vs existing41/18/20/7/45/49 and all50-related pairs','human/native acceptance']};
}
