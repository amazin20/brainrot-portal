import * as THREE from 'three';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),EPS=1e-7,SKIN=1e-4;
const AXES=[V(1,0,0),V(0,1,0),V(0,0,1)];
const pose=()=>({center:V(),quaternion:new THREE.Quaternion(),bounds:new THREE.Box3()});
const copyPose=(to,from)=>{to.center.copy(from.center);to.quaternion.copy(from.quaternion);to.bounds.copy(from.bounds);return to;};
const lerpPose=(a,b,t)=>({center:a.center.clone().lerp(b.center,t),quaternion:a.quaternion.clone().slerp(b.quaternion,t)});
function frameBounds(frame,half){
 if(frame.bounds)return frame.bounds;
 const rotation=new THREE.Matrix4().makeRotationFromQuaternion(frame.quaternion).elements,extent=V(Math.abs(rotation[0])*half.x+Math.abs(rotation[4])*half.y+Math.abs(rotation[8])*half.z,Math.abs(rotation[1])*half.x+Math.abs(rotation[5])*half.y+Math.abs(rotation[9])*half.z,Math.abs(rotation[2])*half.x+Math.abs(rotation[6])*half.y+Math.abs(rotation[10])*half.z);
 return new THREE.Box3(frame.center.clone().sub(extent),frame.center.clone().add(extent));
}

/** Opt-in character geometry for an existing real body; never adds a body or
 * changes Cannon contacts. History advances only on a new physics step. */
export function createOrientedBoxContact(body,half,offset=V(),step=0){
 const box={body,half:half.clone(),offset:offset.clone(),previous:pose(),current:pose(),step};
 syncOrientedBoxContact(box,body,step,true);return box;
}
export function syncOrientedBoxContact(box,body,step,reset=false){
 if(reset||box.step!==step){copyPose(box.previous,box.current);box.step=step;}
 box.body=body;box.current.quaternion.copy(body.quaternion);box.current.center.copy(box.offset).applyQuaternion(box.current.quaternion).add(body.position);
 const rotation=new THREE.Matrix4().makeRotationFromQuaternion(box.current.quaternion).elements,h=box.half,extent=V(Math.abs(rotation[0])*h.x+Math.abs(rotation[4])*h.y+Math.abs(rotation[8])*h.z,Math.abs(rotation[1])*h.x+Math.abs(rotation[5])*h.y+Math.abs(rotation[9])*h.z,Math.abs(rotation[2])*h.x+Math.abs(rotation[6])*h.y+Math.abs(rotation[10])*h.z);
 box.current.bounds.set(box.current.center.clone().sub(extent),box.current.center.clone().add(extent));
 if(reset)copyPose(box.previous,box.current);return box;
}

/** Exact closest pair between a segment and an axis-aligned box. The squared
 * distance is quadratic between the six coordinate/face crossing times. */
function closestSegmentBox(a,b,half){
 const d=b.clone().sub(a),cuts=[0,1];
 for(const key of ['x','y','z'])if(Math.abs(d[key])>EPS)for(const side of [-1,1]){const t=(side*half[key]-a[key])/d[key];if(t>0&&t<1)cuts.push(t);}
 cuts.sort((x,y)=>x-y);let best=null;
 const check=t=>{const segment=a.clone().addScaledVector(d,t),point=segment.clone().clamp(half.clone().negate(),half),distance=segment.distanceTo(point);if(!best||distance<best.distance)best={segment,point,distance};};
 for(let i=0;i<cuts.length-1;i++){
  const lo=cuts[i],hi=cuts[i+1],mid=(lo+hi)/2;let aa=0,ab=0;
  for(const key of ['x','y','z']){const p=a[key]+d[key]*mid,limit=p< -half[key]?-half[key]:p>half[key]?half[key]:null;if(limit!==null){aa+=d[key]*d[key];ab+=d[key]*(a[key]-limit);}}
  check(lo);check(hi);if(aa>EPS)check(THREE.MathUtils.clamp(-ab/aa,lo,hi));
 }return best;
}
export function capsuleBoxContact(foot,radius,height,box,frame=box.current){
 const inverse=frame.quaternion.clone().invert(),a=foot.clone().add(V(0,radius,0)).sub(frame.center).applyQuaternion(inverse),b=foot.clone().add(V(0,Math.max(radius,height-radius),0)).sub(frame.center).applyQuaternion(inverse);
 const hit=closestSegmentBox(a,b,box.half);let normal=hit.segment.clone().sub(hit.point),depth=radius-hit.distance;
 if(hit.distance>EPS)normal.multiplyScalar(1/hit.distance);
 else{
  // The centre segment is inside the solid. Separate along the nearest real
  // box face, using the entire segment extent rather than its centre alone.
  let best=Infinity;
  for(const [i,key]of ['x','y','z'].entries())for(const sign of [-1,1]){
   const amount=sign>0?box.half[key]-Math.min(a[key],b[key])+radius:Math.max(a[key],b[key])+box.half[key]+radius;
   if(amount<best){best=amount;normal.copy(AXES[i]).multiplyScalar(sign);hit.point.copy(hit.segment);hit.point[key]=sign*box.half[key];}
  }depth=best;
 }
 normal.applyQuaternion(frame.quaternion);return{distance:hit.distance,depth,normal,point:hit.point.applyQuaternion(frame.quaternion).add(frame.center)};
}
function pointVelocity(box,point,frame=box.current){
 const b=box.body;if(!b)return V();const origin=frame.center.clone().sub(box.offset.clone().applyQuaternion(frame.quaternion));return V().copy(b.angularVelocity??V()).cross(point.clone().sub(origin)).add(b.velocity??V());
}
function respond(velocity,box,contact,frame=box.current){
 const inward=velocity.clone().sub(pointVelocity(box,contact.point,frame)).dot(contact.normal);if(inward<0)velocity.addScaledVector(contact.normal,-inward);return inward;
}
export function capsuleBoxGrounded(foot,velocity,radius,height,box,fraction=1){
 const frame=fraction===1?box.current:lerpPose(box.previous,box.current,THREE.MathUtils.clamp(fraction,0,1)),support=capsuleBoxContact(foot,radius,height,box,frame),relative=velocity.clone().sub(pointVelocity(box,support.point,frame)).dot(support.normal);
 return support.depth>=-SKIN*2&&support.normal.y>=.65&&relative<=EPS;
}
/** Conservative advancement uses an upper bound on relative point speed.
 * Both endpoint-clear angular sweeps and grazing rounded corners are covered. */
function sweepCapsule(from,to,radius,height,box,a,b){
 const distance=from.distanceTo(to)+a.center.distanceTo(b.center)+a.quaternion.angleTo(b.quaternion)*box.half.length();
 const at=t=>{const frame=lerpPose(a,b,t);return{...capsuleBoxContact(from.clone().lerp(to,t),radius,height,box,frame),frame,t};};
 const linear=a.quaternion.angleTo(b.quaternion)<EPS;let minimum;
 const linearCrossing=()=>{
  if(!minimum){let lo=0,hi=1;for(let i=0;i<70;i++){const left=(2*lo+hi)/3,right=(lo+2*hi)/3;if(at(left).distance<at(right).distance)hi=right;else lo=left;}minimum=at((lo+hi)/2);}
  // A genuinely tangent rounded-corner path has no penetration. A skin
  // offset must not invent a transient diagonal normal and project metres
  // of remaining tangent travel sideways.
  if(minimum.depth<=1e-12)return null;
  const start=at(0);if(start.depth>0)return start;
  let lo=0,hi=minimum.t;for(let i=0;i<60;i++){const middle=(lo+hi)/2;if(at(middle).depth>=-1e-12)hi=middle;else lo=middle;}return at(hi);
 };
 let t=0;
 for(let i=0;i<256;i++){
  const hit=at(t);
  if(hit.depth>=-SKIN)return linear&&distance>EPS?linearCrossing():hit;if(t>=1||distance<EPS)return null;
  const advance=Math.max(EPS,(-hit.depth-SKIN)*.9/distance);if(t+advance>1){t=1;}else t+=advance;
 }
 if(linear){
  // For a translating capsule and fixed box orientation, distance to the
  // convex capsule/box configuration obstacle is convex along the path.
  // Find its minimum, then the first crossing. Long almost-tangent paths
  // cannot exhaust advancement and silently skip a later real contact.
  return linearCrossing();
 }
 // Rotating distance need not be convex. Ordered interval subdivision uses
 // the same proven relative-speed bound to reject only clear intervals.
 // Its conservative tolerance is bounded in world metres, not frame count.
 const stack=[[at(0),at(1)]];
 while(stack.length){
  const [left,right]=stack.pop(),width=right.t-left.t;
  if(left.depth>=-SKIN)return left;
  if((-left.depth-right.depth-distance*width)/2>SKIN)continue;
  if(distance*width<=SKIN*.25)return left;
  const middle=at((left.t+right.t)/2);stack.push([middle,right],[left,middle]);
 }return null;
}
/** Resolves one fixed interval, then its current-pose contacts. Subdivision
 * bounds rotation, while the per-slice sweep supplies the narrowphase TOI. */
export function resolveCapsuleBoxMotion(position,previous,velocity,radius,height,box,{sweep=true,fromFraction=0,toFraction=1}={}){
 const end=THREE.MathUtils.clamp(toFraction,0,1),start=THREE.MathUtils.clamp(fromFraction,0,end),b=end===1?box.current:lerpPose(box.previous,box.current,end),a=sweep?(start===0?box.previous:lerpPose(box.previous,box.current,start)):b,motion=a.center.distanceTo(b.center)+a.quaternion.angleTo(b.quaternion)*box.half.length();
 const bounds=frameBounds(a,box.half).clone().union(frameBounds(b,box.half)).expandByScalar(box.half.length()*(1-Math.cos(a.quaternion.angleTo(b.quaternion)/2)));
 const travel=new THREE.Box3().setFromPoints([previous,position]).expandByVector(V(radius,0,radius));travel.max.y+=height;
 if(!travel.intersectsBox(bounds))return{contacts:0,grounded:false};
 const steps=Math.max(1,Math.ceil(motion/(radius*.25))),desired=position.clone().sub(previous),p=previous.clone();let contacts=0;
 for(let i=0;i<steps;i++){
  const before=p.clone(),target=p.clone().addScaledVector(desired,1/steps),old=lerpPose(a,b,i/steps),next=lerpPose(a,b,(i+1)/steps);
  const hit=sweepCapsule(before,target,radius,height,box,old,next);
  if(hit){
   contacts++;p.copy(before).lerp(target,hit.t).addScaledVector(hit.normal,Math.max(0,hit.depth)+SKIN);
   const rest=target.sub(before).multiplyScalar(1-hit.t),inward=rest.dot(hit.normal);if(inward<0)rest.addScaledVector(hit.normal,-inward);p.add(rest);respond(velocity,box,hit,hit.frame);
  }else p.copy(target);
  for(let pass=0;pass<3;pass++){
   const c=capsuleBoxContact(p,radius,height,box,next);if(c.depth<=0)break;p.addScaledVector(c.normal,c.depth+SKIN);respond(velocity,box,c,next);contacts++;
  }
 }position.copy(p);
 // An earlier upward TOI is not support after leaving a finite beam edge.
 // Evaluate the actual final shape/pose and relative contact velocity.
 const grounded=capsuleBoxGrounded(position,velocity,radius,height,box,end);
 return{contacts,grounded};
}
/** Vertical support intersects real finite upward faces, never AABB max.y. */
export function orientedBoxSupport(box,x,z,maxY){
 if(x<box.current.bounds.min.x||x>box.current.bounds.max.x||z<box.current.bounds.min.z||z>box.current.bounds.max.z)return null;
 const frame=box.current;let best=null;
 for(const [i,key]of ['x','y','z'].entries())for(const sign of [-1,1]){
  const normal=AXES[i].clone().multiplyScalar(sign).applyQuaternion(frame.quaternion);if(normal.y<.65)continue;
  const center=AXES[i].clone().multiplyScalar(sign*box.half[key]).applyQuaternion(frame.quaternion).add(frame.center),height=center.y-(normal.x*(x-center.x)+normal.z*(z-center.z))/normal.y;
  if(height>maxY+.001)continue;const local=V(x,height,z).sub(frame.center).applyQuaternion(frame.quaternion.clone().invert());
  if(['x','y','z'].some(k=>Math.abs(local[k])>box.half[k]+EPS))continue;if(!best||height>best.height)best={height,normal};
 }return best;
}
function boxAxes(half,quaternion,box){
 const frame=box.current,a=AXES.map(v=>v.clone().applyQuaternion(quaternion)),b=AXES.map(v=>v.clone().applyQuaternion(frame.quaternion)),axes=[...a,...b];
 for(const x of a)for(const y of b){const n=x.clone().cross(y);if(n.lengthSq()>1e-12)axes.push(n.normalize());}
 return axes.map(axis=>({axis,extent:half.x*Math.abs(a[0].dot(axis))+half.y*Math.abs(a[1].dot(axis))+half.z*Math.abs(a[2].dot(axis))+box.half.x*Math.abs(b[0].dot(axis))+box.half.y*Math.abs(b[1].dot(axis))+box.half.z*Math.abs(b[2].dot(axis))}));
}
function boxContact(center,half,quaternion,box){
 const delta=center.clone().sub(box.current.center);
 let gap=-Infinity,depth=Infinity,normal=V();
 for(const {axis,extent} of boxAxes(half,quaternion,box)){
  const d=delta.dot(axis),separation=Math.abs(d)-extent;
  gap=Math.max(gap,separation);if(-separation<depth){depth=-separation;normal.copy(axis).multiplyScalar(d>=0?1:-1);}
 }return{gap,depth,normal};
}
export function boxIntersectsOrientedCollider(box,bounds){
 if(!bounds.intersectsBox(box.current.bounds))return false;
 return boxContact(bounds.getCenter(V()),bounds.getSize(V()).multiplyScalar(.5),new THREE.Quaternion(),box).gap<0;
}
/** Held target clearance is a box/box SAT sweep in the real beam frame. The
 * actual cargo servo/contact solver is untouched and keeps the original body. */
export function constrainBoxToOrientedCollider(box,start,target,half,quaternion){
 if(!new THREE.Box3().setFromPoints([start,target]).expandByScalar(half.length()).intersectsBox(box.current.bounds))return target.clone();
 const result=target.clone(),delta=target.clone().sub(start),relative=start.clone().sub(box.current.center);let t=0,leave=1,hit=boxContact(start,half,quaternion,box);
 if(hit.gap>SKIN){
  hit=null;
  for(const {axis,extent}of boxAxes(half,quaternion,box)){
   const at=relative.dot(axis),rate=delta.dot(axis),size=extent+SKIN;
   if(Math.abs(rate)<EPS){if(Math.abs(at)>size)return result;continue;}
   let near=(-size-at)/rate,far=(size-at)/rate;if(near>far)[near,far]=[far,near];
   if(near>t){t=near;hit={normal:axis.clone().multiplyScalar(rate>0?-1:1)};}leave=Math.min(leave,far);if(t>leave||leave<0||t>1)return result;
  }
 }
 if(hit){
  const contact=start.clone().addScaledVector(delta,t),rest=delta.clone().multiplyScalar(1-t),inward=rest.dot(hit.normal);if(inward<0)rest.addScaledVector(hit.normal,-inward);result.copy(contact).add(rest);
 }
 for(let i=0;i<3;i++){const c=boxContact(result,half,quaternion,box);if(c.gap>=0)break;result.addScaledVector(c.normal,c.depth+SKIN);}return result;
}
