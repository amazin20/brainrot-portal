import * as THREE from 'three';
import {tracePortalRay} from './LabPuzzleMechanics.js';
import {transformPortalDirection} from './LabPortals.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
/** A finite sheet follows actual portal rays. The same enabled AABB is used
 * by the player, cargo, camera and muzzle; rerouting never leaves a floor. */
export function createLightBridge(kit,{origin,direction,span=[0,0,1],width=2.2,length=90,name='Solid light bridge'}={}){
 const game=kit.game,w=kit.world,material=new THREE.MeshStandardMaterial({color:0x76e5e8,emissive:0x2295a0,emissiveIntensity:.65,roughness:.4,metalness:.15,transparent:true,opacity:.82});
 const pieces=Array.from({length:6},(_,i)=>{
  const mesh=w.box([0,-40,0],[1,1,1],material,false);mesh.name=`${name} / ${i}`;mesh.visible=false;mesh.userData.portalClearance=false;
  const collider={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:false,ignorePropagation:true};
  const floor={mesh,minX:0,maxX:0,minZ:0,maxZ:0,y:-40,enabled:false};
  game.colliders.push(collider);game.floors.push(floor);w.floors.push(floor);game.cameraBlockers.push(mesh);game.aimBlockers.push(mesh);
  return {mesh,collider,floor};
 });
 let disposed=false,signature=null;
 const bridge={pieces,segments:[],update(){
  if(disposed)return;
  bridge.segments=tracePortalRay(game,V(...origin),V(...direction),{length,medium:'solid-light'});
  const key=bridge.segments.flatMap(s=>[...s.a.toArray(),...s.b.toArray(),s.kind]).join(':')+'|'+(game.portals?.ready?game.portals.portals.map(p=>p.quaternion.toArray().join(',')).join('|'):'off');
  if(key===signature&&game.physics===bridge.physicsOwner)return;signature=key;bridge.physicsOwner=game.physics;
  let across=V(...span).normalize();
  pieces.forEach((p,i)=>{
   const s=bridge.segments[i],active=Boolean(s&&s.length>.06);p.mesh.visible=p.collider.enabled=active;p.floor.enabled=false;
   if(active){
    const normal=new THREE.Vector3().crossVectors(s.direction,across).normalize();
    if(normal.y<0)normal.negate();
    const size=V(Math.abs(s.direction.x)*s.length+Math.abs(across.x)*width+Math.abs(normal.x)*.14,Math.abs(s.direction.y)*s.length+Math.abs(across.y)*width+Math.abs(normal.y)*.14,Math.abs(s.direction.z)*s.length+Math.abs(across.z)*width+Math.abs(normal.z)*.14);
    p.mesh.position.copy(s.a).add(s.b).multiplyScalar(.5).addScaledVector(normal,-.07);p.mesh.scale.copy(size);p.mesh.updateMatrixWorld(true);p.collider.box.setFromObject(p.mesh);
    if(Math.abs(normal.y)>.99){const b=p.collider.box;p.floor.minX=b.min.x;p.floor.maxX=b.max.x;p.floor.minZ=b.min.z;p.floor.maxZ=b.max.z;p.floor.y=b.max.y;p.floor.enabled=true;}
    game.physics?.updateStaticBox(p.mesh.uuid,p.collider.box,0,true);
    if(s.kind==='portal'&&game.portals.ready){const ps=game.portals.portals;const j=ps[0].position.distanceTo(s.b)<ps[1].position.distanceTo(s.b)?0:1;across=transformPortalDirection(across,ps[j],ps[1-j]).normalize();}
   }
   game.physics?.setStaticEnabled(p.mesh.uuid,active);
  });
 },dispose(){disposed=true;for(const p of pieces){p.collider.enabled=p.floor.enabled=p.mesh.visible=false;game.physics?.removeStaticBox(p.mesh.uuid);for(const a of [game.colliders,game.floors,w.floors,game.cameraBlockers,game.aimBlockers]){const item=a===game.colliders?p.collider:a===game.floors||a===w.floors?p.floor:p.mesh;const n=a.indexOf(item);if(n>=0)a.splice(n,1);}p.mesh.removeFromParent();p.mesh.geometry.dispose();}material.dispose();}};
 kit.ticks.push(()=>bridge.update());kit.resets.push(()=>bridge.update());kit.state.lightBridge=bridge;bridge.update();return bridge;
}
