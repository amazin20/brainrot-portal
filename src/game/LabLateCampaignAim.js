/** A valid impact on another white face is not evidence that an authored
 * route shot reached its intended aperture. Assert the production UUID. */
export function aimLateSurface(d,color,surface,point=surface.getFrame().center){
 d.aim(color,point);
 if(d.game.portals.portals[color]?.surfaceId!==surface.mesh.uuid)throw Error(`Portal ${color} reached ${d.game.portalShots.lastImpact?.surface} instead of ${surface.name}`);
}
import * as THREE from 'three';
import {CAMERA_PITCH_MIN,CAMERA_PITCH_MAX} from './LabCamera.js';
import {installRoom21Aim} from './LabRoom21Journey.js';

/** Wait for the ordinary camera to settle before firing at a cargo aperture.
 * The input still changes only yaw/pitch and advances production frames. */
export function installPreciseLateAim(d){
 installRoom21Aim(d);
 d.look=point=>{d.stop();for(let i=0;i<600;i++){
  const g=d.game;g.scene.updateMatrixWorld(true);
  if(point.clone().sub(g.camera.position).dot(g.camera.getWorldDirection(new THREE.Vector3()))<0){g.yaw+=.16;d.frame();continue;}
  const p=point.clone().project(g.camera);
  if(i>30&&Math.abs(p.x)<.00015&&Math.abs(p.y)<.00015)return;
  g.yaw-=THREE.MathUtils.clamp(p.x,-1,1)*.18;
  g.pitch=THREE.MathUtils.clamp(g.pitch+THREE.MathUtils.clamp(p.y,-1,1)*.17,CAMERA_PITCH_MIN,CAMERA_PITCH_MAX);d.frame();
 }};
}
