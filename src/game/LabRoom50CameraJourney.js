import * as THREE from 'three';

/** Camera inputs for the recording route after both portal shots have landed.
 * Use existing visual frames, after their movement input has been consumed.
 * The elevated outlet aim is useful for shooting, then leaves the bridge and
 * the traveller's feet below the lens throughout the rest of the route.
 */
export function watchRoom50Travel(d,travel){
 const g=d.game,visual=g.updateVisuals;
 g.updateVisuals=function(...args){
  if(args[0]>0){
   const p=g.playerPosition,v=g.playerVelocity;
   let yaw=g.yaw,pitch=-.20;
   if(p.y>10&&p.x< -11){
    // From the impact balcony, a high rear lens looks over its edge at the
    // actual hinged wall. This also keeps the full traveller in the frame.
    const bridge=new THREE.Vector3(0,0,-12).sub(p);
    yaw=Math.atan2(-bridge.x,-bridge.z);pitch=-.70;
   }else if(Math.hypot(v.x,v.z)>.1){
    yaw=Math.atan2(-v.x,-v.z);
   }
   const turn=Math.atan2(Math.sin(yaw-g.yaw),Math.cos(yaw-g.yaw));
   g.yaw+=THREE.MathUtils.clamp(turn,-.04,.04);
   g.pitch+=THREE.MathUtils.clamp(pitch-g.pitch,-.025,.025);
  }
  return visual.apply(this,args);
 };
 try{return travel();}finally{g.updateVisuals=visual;}
}
