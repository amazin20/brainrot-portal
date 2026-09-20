import * as THREE from 'three';
import {resolvePortalPlacement} from '../../src/game/LabPortals.js';
const V=(...values)=>new THREE.Vector3(...values);

/** Finite adversarial scan, not an ordinary playthrough or a proof that all
 * imaginable paths are impossible. Every accepted ray must strike the actual
 * front mesh first and pass the production aperture-placement validator. */
export function acceptsPortalShot(game,origin,target,panel){
 const frame=panel.getFrame(),ray=game.portalShots.ray;
 ray.set(origin,target.clone().sub(origin).normalize());ray.near=0;ray.far=Infinity;
 if(ray.ray.direction.dot(frame.normal)>=-.02)return false;
 const hit=game.portalShots.firstHit();if(hit?.object!==panel.mesh||!hit.face)return false;
 const normal=hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
 return normal.dot(frame.normal)>.15&&resolvePortalPlacement(panel.mesh,hit.point,{blockers:game.colliders}).ok;
}

export function standingCapsuleClear(game,feet){
 return !game.colliders.some(c=>{
  if(c.enabled===false||(c.walkablePlane&&!c.solidUnderside))return false;
  const b=c.box;if(b.max.y<feet.y+.32||b.min.y>feet.y+2.4-.01)return false;
  const dx=feet.x-THREE.MathUtils.clamp(feet.x,b.min.x,b.max.x),dz=feet.z-THREE.MathUtils.clamp(feet.z,b.min.z,b.max.z);
  return dx*dx+dz*dz<.43*.43;
 });
}

export function scanEarlyPortalSightlines(game,{panel:panelName,maxFloorY,step=3.5,excludeSurfaces=[]}){
 const level=game.firstLevel,panel=level.panels[panelName];
 if(!panel)throw Error(`Missing restricted portal surface: ${panelName}`);
 game.scene.updateMatrixWorld(true);
 const f=panel.getFrame(),bounds=panel.mesh.userData.portalBounds,targets=[];
 for(const x of [-1,0,1])for(const y of [-1,0,1])targets.push(f.center.clone()
  .addScaledVector(f.right,x*Math.max(0,bounds.halfWidth-1.19))
  .addScaledVector(f.up,y*Math.max(0,bounds.halfHeight-1.59)));
 let rays=0,positions=0;const hits=[],surfaces=new Set();
 for(const surface of level.world.surfaces){
  const sf=surface.getFrame();if(surface.portal||sf.normal.y<.99||sf.center.y>maxFloorY||excludeSurfaces.includes(surface.name))continue;
  const nx=Math.max(2,Math.ceil(surface.width/step)),nz=Math.max(2,Math.ceil(surface.height/step));
  for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){
   const feet=sf.center.clone().addScaledVector(sf.right,(ix/(nx-1)*2-1)*Math.max(0,surface.width/2-.46))
    .addScaledVector(sf.up,(iz/(nz-1)*2-1)*Math.max(0,surface.height/2-.46));
   if(!standingCapsuleClear(game,feet))continue;
   positions++;surfaces.add(surface.name);
   // Standing shoulder plus a deliberately generous jumping shoulder. A
   // candidate is only a suspected shortcut until attempted with real input.
   for(const height of [1.4,3.3])for(const target of targets){
    rays++;const origin=feet.clone().add(V(0,height,0));
    if(acceptsPortalShot(game,origin,target,panel))hits.push({surface:surface.name,feet:feet.toArray(),origin:origin.toArray(),target:target.toArray()});
   }
  }
 }
 return {panel:panelName,maxFloorY,step,rays,positions,surfaces:[...surfaces],hits};
}
