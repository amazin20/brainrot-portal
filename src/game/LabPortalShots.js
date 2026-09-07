import * as THREE from 'three';
const V=()=>new THREE.Vector3(),colors=[0x54d7ff,0xffba68];
/** Visible portal charges. Swept impacts run on the simulation clock and use
 * live blockers (including moved doors); drawing never advances a charge.
 * A rejected hit preserves the previous portal. No camera/physics actor writes. */
export class LabPortalShots {
 constructor(game){
  this.game=game;this.root=new THREE.Group();this.root.name='Portal charge effects';game.scene.add(this.root);
  this.serial=[0,0];this.queue=[];this.active=[];this.pulses=[];this.time=0;this.lastImpact=null;this.cooldown=0;
  this.ray=new THREE.Raycaster();
  this.pool=Array.from({length:6},()=>{
   const group=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:colors[0],transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending});
   const core=new THREE.Mesh(new THREE.SphereGeometry(.072,10,6),material),tail=new THREE.Mesh(new THREE.CylinderGeometry(.015,.06,.48,8),material);tail.rotation.x=Math.PI/2;tail.position.z=-.22;group.add(core,tail);group.visible=false;this.root.add(group);return{group,material};
  });
  this.impactPool=Array.from({length:8},()=>{const mat=new THREE.MeshBasicMaterial({color:colors[0],transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});const mesh=new THREE.Mesh(new THREE.RingGeometry(.065,.095,24),mat);mesh.visible=false;this.root.add(mesh);return{mesh,mat};});
 }
 request(index){
  const g=this.game;
  if(![0,1].includes(index)||g.state!=='playing'||g.externalBlocked||g.heldCube||this.cooldown>0)return false;
  g.scene.updateMatrixWorld(true);this.ray.setFromCamera(new THREE.Vector2(),g.camera);
  const hit=this.firstHit(),point=hit?.point.clone()||this.ray.ray.at(65,V());
  const facing=Math.atan2(point.x-g.playerPosition.x,point.z-g.playerPosition.z);
  const turn=Math.abs(Math.atan2(Math.sin(facing-g.facing),Math.cos(facing-g.facing)));
  this.cooldown=.20;const sequence=++this.serial[index];
  this.queue=this.queue.filter(s=>s.index!==index);
  const wait=Math.max(.23,Math.min(.30,turn/14),g.heldDevice?.holsterProgress*.32||0);
  this.queue.push({index,sequence,point,delay:wait});
  g.shotFacing=facing;g.shotPoseTime=wait+.38;g.shotAimPoint=point.clone();
  return true;
 }
 firstHit(){
  return this.ray.intersectObjects(this.game.aimBlockers,true).find(h=>(h.object.visible||h.object.userData.collisionProxy)&&this.game.isActiveBlocker(h.object));
 }
 launch(s){
  const g=this.game;
  if(g.heldCube||s.sequence!==this.serial[s.index])return;
  const origin=g.heldDevice?.emitter?.getWorldPosition(V())||g.playerPosition.clone().add(new THREE.Vector3(0,1.4,0));
  // A long barrel can touch a wall although the player capsule is outside.
  // Start on the near side in that case: never spawn a charge beyond a wall.
  const shoulder=g.playerPosition.clone().add(new THREE.Vector3(0,1.4,0));
  const muzzlePath=origin.clone().sub(shoulder),muzzleDistance=muzzlePath.length();
  if(muzzleDistance>.001){
   muzzlePath.normalize();this.ray.set(shoulder,muzzlePath);this.ray.near=0;this.ray.far=muzzleDistance;
   const obstruction=this.firstHit();if(obstruction)origin.copy(obstruction.point).addScaledVector(muzzlePath,-.025);
  }
  this.ray.far=Infinity;
  const direction=s.point.clone().sub(origin),distance=direction.length();if(distance<.001)return;direction.normalize();
  const slot=this.pool.find(p=>!this.active.some(a=>a.slot===p));if(!slot)return;
  // Use the animated muzzle, or its near-side constrained point at contact.
  const speed=distance/THREE.MathUtils.clamp(distance/75,.055,.65);
  this.active.push({...s,slot,start:origin.clone(),position:origin.clone(),previous:origin.clone(),direction,speed,travel:0,range:Math.min(85,distance+5)});
  slot.material.color.setHex(colors[s.index]);slot.group.visible=true;
  g.animator?.triggerShot?.(1.25);g.heldDevice?.fire(s.index);g.audio?.shot?.(s.index);
 }
 impact(shot,hit){
  const g=this.game;let valid=false;
  if(hit.object.userData.portalable&&shot.sequence===this.serial[shot.index]){
   const frame=hit.object.userData.portalFrame?.();
   const normal=hit.face?.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
   if(!frame||(normal&&normal.dot(frame.normal)>.15&&shot.direction.dot(frame.normal)<-.02))valid=g.placeOnPanel(shot.index,hit.object,hit.point);
  }
  if(valid)g.audio?.portal?.(shot.index);else g.audio?.rejectShot?.();
  const normal=hit.face?.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize()||shot.direction.clone().negate();
  let fx=this.impactPool.find(p=>!this.pulses.some(a=>a.slot===p));
  if(fx){fx.mesh.position.copy(hit.point).addScaledVector(normal,.018);fx.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);fx.mat.color.setHex(valid?colors[shot.index]:0xf3d1a1);this.pulses.push({slot:fx,age:0,valid});}
  this.lastImpact={valid,index:shot.index,position:hit.point.toArray(),sequence:shot.sequence,surface:hit.object.name};
  shot.slot.group.visible=false;
 }
 step(dt){
  if(!Number.isFinite(dt)||dt<0)throw new RangeError('Shot time must be finite and nonnegative');
  if(!dt)return;this.time+=dt;this.cooldown=Math.max(0,this.cooldown-dt);
  for(const s of this.queue)s.delay-=dt;
  for(const s of this.queue.filter(q=>q.delay<=0))this.launch(s);
  this.queue=this.queue.filter(q=>q.delay>0);
  for(let i=this.active.length-1;i>=0;i--){const s=this.active[i];s.previous.copy(s.position);
   const move=Math.min(s.speed*dt,s.range-s.travel);this.ray.set(s.position,s.direction);this.ray.near=0;this.ray.far=move+.001;
   const hit=this.firstHit();
   if(hit){this.impact(s,hit);this.active.splice(i,1);continue;}
   s.position.addScaledVector(s.direction,move);s.travel+=move;
   if(s.travel>=s.range){s.slot.group.visible=false;this.active.splice(i,1);}
  }
  this.ray.far=Infinity;
  for(const p of this.pulses)p.age+=dt;
  for(const p of this.pulses.filter(p=>p.age>.32))p.slot.mesh.visible=false;
  this.pulses=this.pulses.filter(p=>p.age<=.32);
 }
 render(alpha=1){
  for(const s of this.active){s.slot.group.position.lerpVectors(s.previous,s.position,alpha);s.slot.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),s.direction);}
  for(const p of this.pulses){const t=p.age/.32;p.slot.mesh.visible=true;p.slot.mesh.scale.setScalar(1+t*(p.valid?8:4));p.slot.mat.opacity=(1-t)**2*.7;}
 }
 reset(){this.serial=[0,0];this.queue=[];this.active=[];this.pulses=[];this.time=this.cooldown=0;this.lastImpact=null;for(const p of this.pool)p.group.visible=false;for(const p of this.impactPool)p.mesh.visible=false;}
 get diagnostics(){return{pending:this.queue.length,flying:this.active.length,lastImpact:this.lastImpact};}
}
