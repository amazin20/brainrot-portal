// The original lower incline meets a closed rear wall. Preserve its accepted
// landscape shoulder outside the measured recovery view. In that view reserve
// a portrait-compatible composition before the wall closes behind the actor.
export const ROOM17_RECOVERY_LENS_RESPONSE=48;
export const ROOM17_RECOVERY_DISTANCE_RESPONSE=48;
export const ROOM17_RECOVERY_AVOIDANCE_RESPONSE=8;
export const ROOM17_RECOVERY_FRAMING_ASPECT=.45;
export const ROOM17_RECOVERY_CAMERA_OFFSETS=Object.freeze([3.5,4.5].flatMap(rear=>
 [8,-8].flatMap(side=>[0,1.8,3.2].map(rise=>Object.freeze({rear,side,rise,recoveryRear:rear===3.5?11:13,recoverySide:22.5})))));
const smooth=(x,a,b)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

export function room17RecoveryCameraEnabled(level,index){
 return index===16&&level?.creativeEarly===17&&level.id==='foundation-cable-supported-architecture';
}
export function room17RecoveryCameraArea(level,index,target,aspect=16/9){
 return room17RecoveryCameraEnabled(level,index)&&Number.isFinite(aspect)&&aspect>0&&target.x>=-29.5&&target.x<=-16
  &&target.z>=20&&target.z<=54&&target.y>=-10.5&&target.y<=6.5;
}
export function room17LegacyRecoveryCameraArea(target,aspect){
 return Number.isFinite(aspect)&&aspect>=1.6&&target.x>=-29.5&&target.x<=-16
  &&target.z>=46&&target.z<=54&&target.y>=-10.5&&target.y<=-6;
}

// Blend only the measured manual view; the spawn descent and opposite-looking
// views retain the accepted rig. These values never assign a control angle.
export function room17RecoveryCameraWeight(target,yaw,pitch){
 if(![target.x,target.y,target.z,yaw,pitch].every(Number.isFinite))return 0;
 const angle=Math.atan2(Math.sin(yaw),Math.cos(yaw));
 return smooth(angle,.30,.40)*(1-smooth(angle,.60,.80))
  *smooth(pitch,-.65,-.25)*(1-smooth(pitch,.20,.60))
  *smooth(target.x,-29.5,-28)*(1-smooth(target.x,-17.5,-16))
  *smooth(target.z,20,28)*(1-smooth(target.z,53,54))
  *smooth(target.y,-10.5,-10)*(1-smooth(target.y,5.5,6.5));
}
// Start with the ordinary shoulder and retreat around its framing envelope
// while the approach still has room behind it. The extra rear arc avoids
// cutting across the narrow view as the shoulder opens or closes.
export function room17RecoveryCameraBlend(target){return smooth(target.z,30,46);}

// The accepted wide composition remains exact. Narrow layouts prepare only
// this recovery view; portrait needs a longer wall-parallel shoulder than4:3.
export function room17RecoveryAspectWeight(aspect){
 return Number.isFinite(aspect)&&aspect>0 ? 1-smooth(aspect,1.45,1.6) : 0;
}
export function room17RecoveryPortraitBlend(aspect){
 return Number.isFinite(aspect)&&aspect>0 ? 1-smooth(aspect,.9,1.2) : 0;
}
