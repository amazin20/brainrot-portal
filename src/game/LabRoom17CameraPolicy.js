// The dry recovery incline meets the rear wall at a sharp service turn.
// A short rear boom retracts there; retain bounded lateral shoulders while
// traversing that original lower court, before returning to the normal view.
// This measured landscape correction leaves narrower layouts on their existing
// camera policy; eligibility is checked against the current aspect every frame.
// The bounded entry lens must expand before its lateral shoulder settles.
// Other rooms retain their existing lens response.
export const ROOM17_RECOVERY_LENS_RESPONSE=48;

export const ROOM17_RECOVERY_CAMERA_OFFSETS=Object.freeze([3.5,4.5].flatMap(rear=>
 [8,-8].flatMap(side=>[0,1.8,3.2].map(rise=>Object.freeze({rear,side,rise})))));

export function room17RecoveryCameraEnabled(level,index){
 return index===16&&level?.creativeEarly===17&&level.id==='foundation-cable-supported-architecture';
}

export function room17RecoveryCameraArea(level,index,target,aspect=16/9){
 return room17RecoveryCameraEnabled(level,index)&&Number.isFinite(aspect)&&aspect>=1.6&&target.x>=-29.5&&target.x<=-16
  &&target.z>=46&&target.z<=54&&target.y>=-10.5&&target.y<=-6;
}
