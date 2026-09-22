import * as THREE from 'three';
import {sampleRampSurface} from './LabPhysics.js';

const EPS=1e-7;
/** Sweep an upright character's foot reference through a closed ramp volume.
 * The top uses relative motion against the inclined plane, NOT velocity.y.
 * A rising jump can hit an uphill ramp before reaching its ballistic apex.
 * Side/end faces are expanded by the character radius; the underside by height.
 * Ramp profiles are convex slices, so their visible surface and contact agree. */
export function sweepRampContact(ramp,from,to,radius,height){
 if(ramp.enabled===false)return null;
 if(Math.max(from.x,to.x)<ramp.minX-radius||Math.min(from.x,to.x)>ramp.maxX+radius
  ||Math.max(from.z,to.z)<ramp.minZ-radius||Math.min(from.z,to.z)>ramp.maxZ+radius)return null;
 const samples=ramp.profile||[
  {z:ramp.minZ,y:sampleRampSurface(ramp,ramp.minZ).height},
  {z:ramp.maxZ,y:sampleRampSurface(ramp,ramp.maxZ).height}];
 const base=ramp.baseY??Math.min(...samples.map(p=>p.y))-.2;
 let closest=null;
 for(let i=0;i<samples.length-1;i++){
  const a=samples[i],b=samples[i+1],slope=(b.y-a.y)/(b.z-a.z);
  const planes=[
   [1,0,0,ramp.maxX+radius,'side'],[-1,0,0,-ramp.minX+radius,'side'],
   [0,0,1,b.z+(i===samples.length-2?radius:0),'end'],
   [0,0,-1,-a.z+(i===0?radius:0),'end'],
   [0,-1,0,-base+height,'underside'],[0,1,-slope,a.y-slope*a.z,'top']];
  let enter=-Infinity,leave=Infinity,face=null,rejected=false;
  for(const plane of planes){
   const [x,y,z,d]=plane,old=x*from.x+y*from.y+z*from.z-d,next=x*to.x+y*to.y+z*to.z-d;
   if(old>EPS&&next>EPS){rejected=true;break;}
   const change=next-old;
   if(Math.abs(change)<EPS){if(old>EPS){rejected=true;break;}continue;}
   const t=-old/change;
   if(change<0&&t>enter){enter=t;face=plane;}
   if(change>0)leave=Math.min(leave,t);
   if(enter>leave+EPS){rejected=true;break;}
  }
  if(rejected||!face||enter< -EPS||enter>1||leave<0)continue;
  // Internal profile slice ends are not vertical walls in the solid ramp.
  if(face[4]==='end'&&((face[2]<0&&i>0)||(face[2]>0&&i<samples.length-2)))continue;
  const normal=new THREE.Vector3(face[0],face[1],face[2]).normalize();
  const hit={t:Math.max(0,enter),normal,kind:'ramp-'+face[4],ramp};
  if(!closest||hit.t<closest.t)closest=hit;
 }
 return closest;
}

/** Non-kinetic rooms use the same ramp contacts, without changing their wall
 * controller. Do not rewind or teleport a player who starts below a ramp. */
export function resolveRampMotion(game,position,previous,velocity,radius,height){
 if(!game.ramps?.length)return false;
 const from=previous.clone(),target=position.clone();let grounded=false;
 for(let i=0;i<4;i++){
  const delta=target.clone().sub(from);if(delta.lengthSq()<1e-14)break;
  let contact=null;
  for(const ramp of game.ramps){const hit=sweepRampContact(ramp,from,target,radius,height);if(hit&&(!contact||hit.t<contact.t))contact=hit;}
  if(!contact){from.copy(target);break;}
  from.lerp(target,contact.t).addScaledVector(contact.normal,.0001);
  const remaining=delta.multiplyScalar(1-contact.t),inward=remaining.dot(contact.normal);
  if(inward<0)remaining.addScaledVector(contact.normal,-inward);
  target.copy(from).add(remaining);
  const speed=velocity.dot(contact.normal);if(speed<0)velocity.addScaledVector(contact.normal,-speed);
  grounded ||= contact.kind==='ramp-top';
 }
 position.copy(from);return grounded;
}

/** Keep an already grounded walk attached to a descending slope. This small
 * support snap never catches a jump, teleports across a gap or pulls from below. */
export function followRampGround(game,position,previous,velocity,wasGrounded){
 if(!wasGrounded||!game.playerGrounded)return false;
 for(const r of game.ramps||[]){
  if(r.enabled===false||position.x<r.minX||position.x>r.maxX||position.z<r.minZ||position.z>r.maxZ
   ||previous.x<r.minX||previous.x>r.maxX||previous.z<r.minZ||previous.z>r.maxZ)continue;
  const old=sampleRampSurface(r,previous.z),now=sampleRampSurface(r,position.z);
  const gap=position.y-now.height;
  // Upward ramp contact is owned by the sweep. Snapping down here would pull
  // an actor off a higher flat landing while its radius still overlaps the ramp.
  if(now.height>old.height+1e-8)continue;
  if(Math.abs(previous.y-old.height)>.08||gap<-.002||gap>.20
   ||velocity.y>now.slope*velocity.z+.3)continue;
  position.y=now.height;velocity.y=now.slope*velocity.z;return true;
 }
 return false;
}
