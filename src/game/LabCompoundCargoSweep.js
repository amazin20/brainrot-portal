import {Box, Quaternion, Vec3} from 'cannon-es';

const EPS=1e-10;
export const COMPOUND_CARGO_SWEEP_SKIN=1e-5;
const AXES=[new Vec3(1,0,0),new Vec3(0,1,0),new Vec3(0,0,1)];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const finite=v=>[v.x,v.y,v.z].every(Number.isFinite);
const finiteQuaternion=q=>finite(q)&&Number.isFinite(q.w);
const dot=(a,b)=>a.dot(b);
const extent=(box,n)=>box.half.x*Math.abs(dot(box.axes[0],n))+box.half.y*Math.abs(dot(box.axes[1],n))+box.half.z*Math.abs(dot(box.axes[2],n));
const angle=(a,b)=>2*Math.acos(clamp(Math.abs(a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w),0,1));

/** The descriptor is the actual Cannon shape transform, never its compound
 * AABB. The public registry validates ownership/type before calling this. */
export function compoundCargoBoxPose(body,shapeIndex,position=body.position,quaternion=body.quaternion){
 const shape=body.shapes[shapeIndex];
 if(!(shape instanceof Box))throw new TypeError('Compound cargo sweep requires a real Cannon Box');
 const offset=body.shapeOffsets[shapeIndex],local=body.shapeOrientations[shapeIndex];
 if(!finite(position)||!finiteQuaternion(quaternion)||!finite(offset)||!finiteQuaternion(local))throw new TypeError('Compound cargo sweep requires finite actual shape transforms');
 const rotation=quaternion.mult(local);rotation.normalize();
 const center=quaternion.vmult(offset).vadd(position);
 return {body,shapeIndex,shape,center,quaternion:rotation,half:shape.halfExtents.clone(),axes:AXES.map(a=>rotation.vmult(a))};
}

function axes(a,b){
 const result=[...a.axes,...b.axes];
 for(const x of a.axes)for(const y of b.axes){const n=x.cross(y);if(n.lengthSquared()>1e-16){n.normalize();result.push(n);}}
 return result;
}
/** Full normalized 15-axis OBB narrowphase. Positive gap is a certified
 * separating-plane clearance, not an inferred physical contact equation. */
export function compoundCargoBoxSeparation(a,b){
 const delta=a.center.vsub(b.center);let gap=-Infinity,normal=null;
 for(const n of axes(a,b)){
  const signed=delta.dot(n),separation=Math.abs(signed)-extent(a,n)-extent(b,n);
  if(separation>gap){gap=separation;normal=n.scale(signed>=0?1:-1);}
 }
 return {gap,normal};
}
function interpolate(a,b,t){
 const quaternion=new Quaternion();a.quaternion.slerp(b.quaternion,t,quaternion);quaternion.normalize();
 const center=new Vec3();a.center.lerp(b.center,t,center);
 return {...a,center,quaternion,axes:AXES.map(n=>quaternion.vmult(n))};
}
// Maximum projected support over the complete shortest quaternion arc.
// Each rotated axis projects as A cos(theta)+B sin(theta)+C. Its sign changes
// split the radius into smooth trigonometric pieces with analytic extrema.
function angularExtentMaximum(start,end,n){
 const delta=end.quaternion.mult(start.quaternion.conjugate());delta.normalize();if(delta.w<0){delta.x*=-1;delta.y*=-1;delta.z*=-1;delta.w*=-1;}
 const theta=2*Math.acos(clamp(delta.w,0,1)),sine=Math.sqrt(Math.max(0,1-delta.w*delta.w));if(sine<1e-10)return extent(start,n);
 const k=new Vec3(delta.x/sine,delta.y/sine,delta.z/sine),half=[start.half.x,start.half.y,start.half.z],terms=start.axes.map(e=>{const c=n.dot(k)*k.dot(e);return {a:n.dot(e)-c,b:n.dot(k.cross(e)),c};}),cuts=[0,theta];
 for(const term of terms){const radius=Math.hypot(term.a,term.b);if(radius<EPS||Math.abs(term.c)>radius)continue;const phase=Math.atan2(term.b,term.a),offset=Math.acos(clamp(-term.c/radius,-1,1));for(const sign of [-1,1])for(let turn=-1;turn<=1;turn++){const x=phase+sign*offset+turn*Math.PI*2;if(x>0&&x<theta)cuts.push(x);}}
 cuts.sort((a,b)=>a-b);let maximum=0;
 const actual=x=>terms.reduce((sum,t,i)=>sum+half[i]*Math.abs(t.a*Math.cos(x)+t.b*Math.sin(x)+t.c),0);
 for(let i=0;i<cuts.length-1;i++){
  const lo=cuts[i],hi=cuts[i+1],mid=(lo+hi)/2;let a=0,b=0;
  terms.forEach((t,j)=>{const sign=t.a*Math.cos(mid)+t.b*Math.sin(mid)+t.c>=0?1:-1;a+=half[j]*sign*t.a;b+=half[j]*sign*t.b;});
  maximum=Math.max(maximum,actual(lo),actual(hi));const phase=Math.atan2(b,a);for(let turn=-1;turn<=1;turn++){const x=phase+turn*Math.PI;if(x>lo&&x<hi)maximum=Math.max(maximum,actual(x));}
 }
 return maximum+1e-12;
}
function linearSweep(a,end,b){
 const motion=end.center.vsub(a.center),relative=a.center.vsub(b.center);let enter=0,leave=1,normal=null;
 for(const n of axes(a,b)){
  const distance=relative.dot(n),rate=motion.dot(n),size=extent(a,n)+extent(b,n);
  // A trajectory tangent to a separating face has no strict intersection.
  if(Math.abs(rate)<EPS){if(Math.abs(distance)>=size-EPS)return null;continue;}
  let near=(-size-distance)/rate,far=(size-distance)/rate;if(near>far)[near,far]=[far,near];
  if(near>=enter-EPS){enter=Math.max(enter,near);normal=n.scale(rate>0?-1:1);}leave=Math.min(leave,far);
  if(enter>=leave-EPS||leave<=0||enter>=1)return null;
 }
 if(!normal)return null;
 // This is a true box intersection interval, not a broadphase corner hit.
 const middle=interpolate(a,end,(enter+leave)/2);
 if(compoundCargoBoxSeparation(middle,b).gap>=-EPS)return null;
 return {t:Math.max(0,enter),normal,rotating:false};
}

/** Translating boxes have an exact interval TOI. A rotating cargo uses a
 * separating-plane conservative advancement: no point can move faster than
 * |delta centre| + angular distance * box bounding radius per unit interval.
 * Thus a positive gap certifies the entire next advance as clear. Hits are
 * conservative only within the documented 10 micrometre motion skin. */
export function sweepCompoundCargoBox(start,end,guard){
 const travel=end.center.vsub(start.center),lengthSquared=travel.lengthSquared();
 const tClosest=lengthSquared>EPS?clamp(guard.center.vsub(start.center).dot(travel)/lengthSquared,0,1):0;
 const nearest=start.center.vadd(travel.scale(tClosest)),radius=start.half.length()+guard.half.length()+COMPOUND_CARGO_SWEEP_SKIN;
 if(nearest.distanceSquared(guard.center)>radius*radius)return null;
 const initial=compoundCargoBoxSeparation(start,guard);
 if(initial.gap<-EPS)return {t:0,normal:initial.normal,overlap:true,rotating:angle(start.quaternion,end.quaternion)>EPS};
 const angular=angle(start.quaternion,end.quaternion);
 if(angular<EPS)return linearSweep(start,end,guard);
 for(const n of [initial.normal,...axes(start,guard)]){
  const a=start.center.vsub(guard.center).dot(n),b=end.center.vsub(guard.center).dot(n);
  if(a*b>0&&Math.min(Math.abs(a),Math.abs(b))>extent(guard,n)+angularExtentMaximum(start,end,n)+COMPOUND_CARGO_SWEEP_SKIN)return null;
 }
 const bound=start.center.distanceTo(end.center)+angular*start.half.length();
 if(bound<EPS)return null;
 let t=0;
 for(let iteration=0;iteration<512;iteration++){
  const box=interpolate(start,end,t),hit=compoundCargoBoxSeparation(box,guard);
  if(hit.gap<=COMPOUND_CARGO_SWEEP_SKIN)return {t,normal:hit.normal,rotating:true,motionSkin:COMPOUND_CARGO_SWEEP_SKIN};
  if(t>=1)return null;
  t=Math.min(1,t+Math.max(1e-12,(hit.gap-COMPOUND_CARGO_SWEEP_SKIN)*.9/bound));
 }
 // Ordered, bounded interval refinement avoids abandoning an almost-tangent
 // long path merely because advancement consumed its iteration budget.
 const at=t=>({t,box:interpolate(start,end,t)});
 const stack=[[at(t),at(1)]];
 while(stack.length){
  const [left,right]=stack.pop(),width=right.t-left.t,l=compoundCargoBoxSeparation(left.box,guard),r=compoundCargoBoxSeparation(right.box,guard);
  if(l.gap<=COMPOUND_CARGO_SWEEP_SKIN)return {t:left.t,normal:l.normal,rotating:true,motionSkin:COMPOUND_CARGO_SWEEP_SKIN};
  if((l.gap+r.gap-bound*width)/2>COMPOUND_CARGO_SWEEP_SKIN)continue;
  if(bound*width<=COMPOUND_CARGO_SWEEP_SKIN*.25)return {t:left.t,normal:l.normal,rotating:true,motionSkin:COMPOUND_CARGO_SWEEP_SKIN};
  const middle=at((left.t+right.t)/2);stack.push([middle,right],[left,middle]);
 }
 return null;
}

function vertices(box){
 const out=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])out.push(box.quaternion.vmult(new Vec3(x*box.half.x,y*box.half.y,z*box.half.z)).vadd(box.center));return out;
}
function nearestPoint(point,box){
 const local=box.quaternion.conjugate().vmult(point.vsub(box.center));
 local.set(clamp(local.x,-box.half.x,box.half.x),clamp(local.y,-box.half.y,box.half.y),clamp(local.z,-box.half.z,box.half.z));
 return box.quaternion.vmult(local).vadd(box.center);
}
function edges(box){const v=vertices(box),out=[];for(let i=0;i<8;i++)for(const bit of [1,2,4])if(!(i&bit))out.push([v[i],v[i|bit]]);return out;}
function segmentPair(a,b,c,d){
 const u=b.vsub(a),v=d.vsub(c),w=a.vsub(c),uu=u.dot(u),uv=u.dot(v),vv=v.dot(v),uw=u.dot(w),vw=v.dot(w),denominator=uu*vv-uv*uv;
 let s=denominator>EPS?clamp((uv*vw-vv*uw)/denominator,0,1):0,t=(uv*s+vw)/vv;
 if(t<0){t=0;s=clamp(-uw/uu,0,1);}else if(t>1){t=1;s=clamp((uv-uw)/uu,0,1);}
 return [a.vadd(u.scale(s)),c.vadd(v.scale(t))];
}
// Convex polyhedron closest pairs occur on vertex/face or edge/edge features.
function closestFeatures(a,b){
 let minimum=Infinity,candidates=[];
 const consider=(cargo,guard)=>{const distance=cargo.distanceSquared(guard);if(distance<minimum-1e-14){minimum=distance;candidates=[{cargo,guard}];}else if(Math.abs(distance-minimum)<=1e-14)candidates.push({cargo,guard});};
 for(const p of vertices(a))consider(p,nearestPoint(p,b));for(const p of vertices(b))consider(nearestPoint(p,a),p);
 for(const x of edges(a))for(const y of edges(b))consider(...segmentPair(...x,...y));
 // The nearest feature set is convex. Its centroid is a genuine face/edge
 // contact point; taking the first tied vertex invents torque on a centred
 // flat-face impact and fights the native angular speed cap.
 const cargo=new Vec3(),guard=new Vec3();for(const pair of candidates){cargo.vadd(pair.cargo,cargo);guard.vadd(pair.guard,guard);}cargo.scale(1/candidates.length,cargo);guard.scale(1/candidates.length,guard);
 return {cargo,guard,distance:minimum,closestFeaturePairs:candidates.length};
}
function respond(body,guard,box,normal){
 const pair=closestFeatures(box,guard),r=pair.cargo.vsub(body.position);
 const cargoVelocity=body.angularVelocity.cross(r).vadd(body.velocity),guardR=pair.guard.vsub(guard.body.position),guardVelocity=guard.body.angularVelocity.cross(guardR).vadd(guard.body.velocity);
 const inward=cargoVelocity.vsub(guardVelocity).dot(normal);
 const common={relativeNormalVelocityBefore:inward,point:pair.cargo.toArray(),leverArm:r.toArray(),guardPointVelocity:guardVelocity.toArray(),closestFeaturePairs:pair.closestFeaturePairs};
 if(inward>=0)return {normalImpulse:0,...common};
 const torqueAxis=r.cross(normal),angular=body.invInertiaWorld.vmult(torqueAxis),effectiveMass=body.invMass+angular.cross(r).dot(normal);
 if(!(effectiveMass>EPS))return {normalImpulse:0,...common};
 const impulse=-inward/effectiveMass;
 body.velocity.vadd(normal.scale(impulse*body.invMass),body.velocity);
 body.angularVelocity.vadd(angular.scale(impulse),body.angularVelocity);
 return {normalImpulse:impulse,...common};
}

function constrainAfterNativeCaps(body,corrections,maxLinearSpeed,maxAngularSpeed){
 const cap=(v,max)=>{if(v.length()>max)v.scale(max/v.length(),v);};
 cap(body.velocity,maxLinearSpeed);cap(body.angularVelocity,maxAngularSpeed);let count=0;
 for(let pass=0;pass<12;pass++){
  let changed=false;
  for(const row of corrections){
   const n=new Vec3(...row.normal),r=new Vec3(...row.leverArm),guardVelocity=new Vec3(...row.guardPointVelocity),angular=body.angularVelocity.cross(r).vsub(guardVelocity).dot(n),normal=body.velocity.dot(n),required=-angular;
   if(normal+angular>=-1e-9)continue;
   const normalSpeed=clamp(required,-maxLinearSpeed,maxLinearSpeed),tangent=body.velocity.vsub(n.scale(normal)),available=Math.sqrt(Math.max(0,maxLinearSpeed**2-normalSpeed**2));cap(tangent,available);
   tangent.vadd(n.scale(normalSpeed),body.velocity);changed=true;count++;
  }
  if(!changed)break;
 }
 const inward=row=>body.angularVelocity.cross(new Vec3(...row.leverArm)).vadd(body.velocity).vsub(new Vec3(...row.guardPointVelocity)).dot(new Vec3(...row.normal));
 const fallback=corrections.some(row=>inward(row)<-1e-8);
 if(fallback){body.velocity.setZero();body.angularVelocity.setZero();}
 for(const row of corrections)row.relativeNormalVelocityAfterNativeLimits=inward(row);
 return {speedCapAdmissibilityCorrections:count,velocityConstraintFallback:fallback};
}

/** Collision correction for opt-in fixed real Box shapes only. The persistent
 * cargo, native carry/release and dynamic actuators are never substituted.
 * Returned rows are CCD responses, explicitly separate from Cannon contacts. */
export function resolveCompoundCargoSweep(body,previous,registrations,{maxLinearSpeed=Infinity,maxAngularSpeed=Infinity}={}){
 const beforeCorrection={position:body.position.toArray(),quaternion:body.quaternion.toArray(),velocity:body.velocity.toArray(),angularVelocity:body.angularVelocity.toArray()};
 const guards=registrations.map(entry=>({id:entry.id,...compoundCargoBoxPose(entry.body,entry.shapeIndex)}));
 const cargoIndex=0,start=compoundCargoBoxPose(body,cargoIndex,previous.position,previous.quaternion),desired=compoundCargoBoxPose(body,cargoIndex);
 const isClear=box=>guards.every(guard=>compoundCargoBoxSeparation(box,guard).gap>=-EPS);
 let current=start,target=desired,timeCursor=0,timeRemaining=1,lastClear=isClear(start)?start:null;const corrections=[];
 for(let pass=0;pass<12;pass++){
  let first=null;
  for(const guard of guards){const hit=sweepCompoundCargoBox(current,target,guard);if(hit&&(!first||hit.t<first.hit.t))first={guard,hit};}
  if(!first)break;
  const {guard,hit}=first,endpoint=compoundCargoBoxSeparation(target,guard),at=interpolate(current,target,hit.t),contact=compoundCargoBoxSeparation(at,guard);
  const normal=hit.normal,depth=Math.max(0,-contact.gap);
  at.center.vadd(normal.scale(depth+COMPOUND_CARGO_SWEEP_SKIN*2),at.center);
  if(isClear(at))lastClear={...at,center:at.center.clone(),quaternion:at.quaternion.clone()};
  const rest=target.center.vsub(at.center),inward=rest.dot(normal);if(inward<0)rest.vsub(normal.scale(inward),rest);
  // Angular travel into the fixed obstacle ends at TOI. Tangent translation
  // remains; the next real fixed tick resumes the actual angular dynamics.
  const nextCenter=at.center.vadd(rest);target={...at,center:nextCenter};current=at;
  body.position.copy(at.center);body.quaternion.copy(at.quaternion);body.updateInertiaWorld(true);
  const response=respond(body,guard,at,normal);
  timeCursor+=timeRemaining*hit.t;timeRemaining*=1-hit.t;
  corrections.push({kind:'compound-box-CCD-response',registrationId:guard.id,guardBodyId:guard.body.id,shapeId:guard.shape.id,shapeIndex:guard.shapeIndex,toi:timeCursor,segmentTOI:hit.t,rotating:hit.rotating,initialOverlap:Boolean(hit.overlap),normal:normal.toArray(),penetrationBefore:Math.max(0,-endpoint.gap),impactPenetration:depth,motionSkin:COMPOUND_CARGO_SWEEP_SKIN,...response,cannonContactEquation:false});
 }
 if(!corrections.length){
  const maxResidualPenetration=Math.max(0,...guards.map(guard=>-compoundCargoBoxSeparation(desired,guard).gap));
  return {corrections,maxResidualPenetration,cannonContactEquationsAdded:0,beforeCorrection,afterCorrection:{...beforeCorrection}};
 }
 body.position.copy(target.center);body.quaternion.copy(target.quaternion);body.updateInertiaWorld(true);
 // Resolve any finite current-pose overlap caused by simultaneous contacts,
 // never assigning the body to an opposite side of its first impact plane.
 for(let pass=0;pass<12;pass++){
  let corrected=false;const box=compoundCargoBoxPose(body,cargoIndex);
  for(const guard of guards){const c=compoundCargoBoxSeparation(box,guard);if(c.gap<-EPS){body.position.vadd(c.normal.scale(-c.gap+COMPOUND_CARGO_SWEEP_SKIN*2),body.position);box.center.copy(body.position);corrected=true;}}
  if(!corrected)break;
 }
 if(corrections.length){body.aabbNeedsUpdate=true;body.wakeUp();}
 let final=compoundCargoBoxPose(body,cargoIndex),maxResidualPenetration=Math.max(0,...guards.map(guard=>-compoundCargoBoxSeparation(final,guard).gap));
 const maxResidualBeforeFallback=maxResidualPenetration;let budgetFallback=false;
 if(maxResidualPenetration>COMPOUND_CARGO_SWEEP_SKIN&&lastClear){
  body.position.copy(lastClear.center);body.quaternion.copy(lastClear.quaternion);body.updateInertiaWorld(true);budgetFallback=true;
  final=compoundCargoBoxPose(body,cargoIndex);maxResidualPenetration=Math.max(0,...guards.map(guard=>-compoundCargoBoxSeparation(final,guard).gap));
 }
 for(const row of corrections){const guard=guards.find(g=>g.id===row.registrationId);row.penetrationAfter=Math.max(0,-compoundCargoBoxSeparation(final,guard).gap);}
 const afterCorrection={position:body.position.toArray(),quaternion:body.quaternion.toArray(),velocity:body.velocity.toArray(),angularVelocity:body.angularVelocity.toArray()};
 const caps=Number.isFinite(maxLinearSpeed)&&Number.isFinite(maxAngularSpeed)?constrainAfterNativeCaps(body,corrections,maxLinearSpeed,maxAngularSpeed):{speedCapAdmissibilityCorrections:0,velocityConstraintFallback:false};
 afterCorrection.velocity=body.velocity.toArray();afterCorrection.angularVelocity=body.angularVelocity.toArray();
 const supported=guards.some(guard=>{
  const separation=compoundCargoBoxSeparation(final,guard);if(separation.gap>COMPOUND_CARGO_SWEEP_SKIN*3||separation.normal.y<=.45)return false;
  const pair=closestFeatures(final,guard);if(pair.distance>(COMPOUND_CARGO_SWEEP_SKIN*3)**2)return false;
  const cargoVelocity=body.angularVelocity.cross(pair.cargo.vsub(body.position)).vadd(body.velocity),guardVelocity=guard.body.angularVelocity.cross(pair.guard.vsub(guard.body.position)).vadd(guard.body.velocity);
  return cargoVelocity.vsub(guardVelocity).dot(separation.normal)<=EPS;
 });
 return {corrections,maxResidualPenetration,maxResidualBeforeFallback,budgetFallback,supported,...caps,cannonContactEquationsAdded:0,beforeCorrection,afterCorrection};
}
