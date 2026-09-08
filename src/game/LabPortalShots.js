import * as THREE from 'three';
import { SHOT_COLORS as colors, createChargeSlot, createImpactSlot, renderCharge, renderImpact } from './LabPortalShotVisuals.js';
const V=()=>new THREE.Vector3();
/** Visible portal charges. Swept impacts run on the simulation clock and use
 * live blockers (including moved doors); drawing never advances a charge.
 * A rejected hit preserves the previous portal. No camera/physics actor writes. */
export class LabPortalShots {
 constructor(game){
  this.game=game;this.root=new THREE.Group();this.root.name='Portal charge effects';game.scene.add(this.root);
  this.serial=[0,0];this.placedSerial=[0,0];this.epoch=0;this.queue=[];this.buffered=null;this.active=[];this.pulses=[];this.time=0;this.lastImpact=null;this.lastRequest=null;this.lastOutcome=null;this.cooldown=0;
  this.ray=new THREE.Raycaster();
  this.pool=Array.from({length:6},()=>createChargeSlot(this.root));
  this.impactPool=Array.from({length:8},()=>createImpactSlot(this.root));
 }
 request(index){
  const g=this.game;
  const remaining=Math.max(this.cooldown,this.queue[0]?.delay??0),busy=remaining>0||this.queue.length>0;
  // A discrete click just before the weapon is ready is intentional input.
  // Keep only one such click, with its own target, during the last 80 ms.
  const blocked=![0,1].includes(index)?'channel':g.state!=='playing'?'paused':g.externalBlocked?'external':g.heldCube?'hands-full':this.buffered?'buffer-full':busy&&remaining>.08?(this.cooldown>0?'cooldown':'preparing'):null;
  if(blocked){this.lastRequest={accepted:false,index,reason:blocked};return false;}
  g.scene.updateMatrixWorld(true);g.camera.updateWorldMatrix(true,false);this.ray.near=0;this.ray.far=Infinity;this.ray.setFromCamera(new THREE.Vector2(),g.camera);
  const hit=this.firstHit(),point=hit?.point.clone()||this.ray.ray.at(65,V());
  const facing=Math.atan2(point.x-g.playerPosition.x,point.z-g.playerPosition.z);
  const turn=Math.abs(Math.atan2(Math.sin(facing-g.facing),Math.cos(facing-g.facing)));
  const sequence=++this.serial[index];
  // A click during the windup must not restart it forever. Once accepted,
  // a charge keeps its target and completes its visible flight independently.
  const wait=Math.max(.23,Math.min(.30,turn/14),g.heldDevice?.holsterProgress*.32||0);
  const shot={index,sequence,epoch:this.epoch,point,facing,delay:wait,bufferedInput:busy};
  if(busy){this.buffered=shot;this.lastOutcome={state:'buffered',index,sequence,epoch:this.epoch};}
  else this.prepare(shot);
  this.lastRequest={accepted:true,index,sequence,epoch:this.epoch,...(busy?{buffered:true}:{})};
  return true;
 }
 prepare(shot){
  this.cooldown=.20;this.queue.push(shot);
  this.lastOutcome={state:'preparing',index:shot.index,sequence:shot.sequence,epoch:shot.epoch};
  this.game.shotFacing=shot.facing;this.game.shotPoseTime=shot.delay+.38;this.game.shotAimPoint=shot.point.clone();
 }
 cancelBuffered(reason){
  const canceled=this.buffered||this.queue.find(s=>s.bufferedInput);
  if(!canceled)return;
  this.buffered=null;this.queue=this.queue.filter(s=>!s.bufferedInput);
  if(!this.queue.length){this.game.shotPoseTime=0;this.game.shotAimPoint=null;}
  this.lastOutcome={state:'canceled',reason,index:canceled.index,sequence:canceled.sequence,epoch:canceled.epoch};
 }
 validateBuffered(){
  const g=this.game,reason=g.state!=='playing'?'paused':g.externalBlocked?'external':g.heldCube?'hands-full':!this.root.parent?'superseded':null;
  if(reason)this.cancelBuffered(reason);
 }
 firstHit(){
  const g=this.game;
  return this.ray.intersectObjects(g.aimBlockers,true).find(h=>{
   if(!(h.object.visible||h.object.userData.collisionProxy)||!g.isActiveBlocker(h.object))return false;
   // Registered support AABBs enclose empty space in front of a tilted panel.
   // The owning mesh is already in the same ray query and supplies its REAL
   // first face, including the back and edges. Exempt only that exact proxy;
   // unrelated walls, frames and furniture keep their original hit order.
   const support=h.object.userData.collisionProxy&&g.colliders.find(c=>c.mesh===h.object)?.frontPlane?.();
   if(support?.normal&&this.ray.ray.direction.dot(support.normal)<-.02){
    const owners=g.portalPanels.filter(panel=>panel!==h.object&&(panel.userData.portalColliderId===h.object.uuid||panel.userData.portalBackingIds?.includes(h.object.uuid))
     &&g.aimBlockers.includes(panel)&&g.isActiveBlocker(panel));
    if(owners.length){
     // The front can lie beyond this fixed tick's segment. Prove that the
     // same ray reaches its precise front before exempting the enclosing box.
     const ownerRay=new THREE.Raycaster(this.ray.ray.origin,this.ray.ray.direction,0,Infinity);
     const face=ownerRay.intersectObjects(owners,false)[0];
     if(face&&Math.abs(face.point.clone().sub(support.center).dot(support.normal))<.04
      &&face.face?.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(face.object.matrixWorld)).normalize().dot(support.normal)>.15)return false;
    }
   }
   return true;
  });
 }
 launch(s){
  const g=this.game;
  if(g.heldCube||(s.epoch??this.epoch)!==this.epoch||!this.root.parent){
   this.lastOutcome={state:'canceled',reason:g.heldCube?'hands-full':'superseded',index:s.index,sequence:s.sequence,epoch:s.epoch};return;
  }
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
  const direction=s.point.clone().sub(origin),distance=direction.length();
  if(distance<.001){this.lastOutcome={state:'canceled',reason:'muzzle-contact',index:s.index,sequence:s.sequence,epoch:s.epoch};g.callbacks?.onToast?.('Перед стволом нужно свободное место');g.audio?.rejectShot?.(s.index);return;}direction.normalize();
  const slot=this.pool.find(p=>!this.active.some(a=>a.slot===p));if(!slot){this.lastOutcome={state:'canceled',reason:'capacity',index:s.index,sequence:s.sequence,epoch:s.epoch};return;}
  // Use the animated muzzle, or its near-side constrained point at contact.
  const speed=distance/THREE.MathUtils.clamp(distance/75,.055,.65);
  const shot={...s,epoch:this.epoch,slot,start:origin.clone(),position:origin.clone(),previous:origin.clone(),direction,speed,travel:0,range:Math.min(85,distance+5)};
  this.active.push(shot);this.lastOutcome={state:'flying',index:s.index,sequence:s.sequence,epoch:this.epoch};
  slot.material.color.setHex(colors[s.index]);slot.group.visible=true;
  g.animator?.triggerShot?.(1.25);g.heldDevice?.fire(s.index);g.audio?.shot?.(s.index);
  return shot;
 }
 impact(shot,hit){
  const g=this.game;let valid=false,reason=!hit.object?'miss':hit.object.userData.portalable?'placement':'surface';
  const normal=hit.face?.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize()||shot.direction.clone().negate();
  // Only a newer SUCCESSFUL placement supersedes an older arrival. Comparing
  // against the latest click starves every charge in an ordinary rapid burst.
  if(shot.sequence<this.placedSerial[shot.index]||shot.epoch!==this.epoch)reason='superseded';
  else if(hit.object?.userData.portalable){
   const frame=hit.object.userData.portalFrame?.()||hit.object.userData;
   // Static tiled panels have the same single usable face as moving panels.
   if(frame.normal&&normal.dot(frame.normal)>.15&&shot.direction.dot(frame.normal)<-.02)valid=g.placeOnPanel(shot.index,hit.object,hit.point);
   else reason='back-face';
  }
  if(valid){reason='placed';this.placedSerial[shot.index]=shot.sequence;}
  if(reason==='surface')g.callbacks?.onToast?.('Заряд попал в препятствие. Нужна свободная белая поверхность');
  if(reason==='back-face')g.callbacks?.onToast?.('Установи проход на лицевую поверхность панели');
  if(reason==='miss')g.callbacks?.onToast?.('Заряд рассеялся: поверхность слишком далеко');
  if(valid)g.audio?.portal?.(shot.index);else g.audio?.rejectShot?.(shot.index);
  let fx=this.impactPool.find(p=>!this.pulses.some(a=>a.slot===p));
  if(fx){fx.mesh.position.copy(hit.point).addScaledVector(normal,.018);fx.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);fx.mat.color.setHex(colors[shot.index]);this.pulses.push({slot:fx,age:0,valid,index:shot.index});}
  this.lastImpact={valid,index:shot.index,position:hit.point.toArray(),sequence:shot.sequence,surface:hit.object?.name||'',reason};
  this.lastOutcome={state:valid?'placed':'rejected',reason,index:shot.index,sequence:shot.sequence,epoch:shot.epoch};
  shot.slot.group.visible=false;
 }
 step(dt){
  if(!Number.isFinite(dt)||dt<0)throw new RangeError('Shot time must be finite and nonnegative');
  this.validateBuffered();
  if(!dt||this.game.state!=='playing'||this.game.externalBlocked||!this.root.parent)return;
  this.time+=dt;this.cooldown=Math.max(0,this.cooldown-dt);
  if(this.queue.length||this.active.length)this.game.scene.updateMatrixWorld(true);
  for(const p of this.pulses)p.age+=dt;
  for(const s of this.queue){s.delay-=dt;if(s.delay<=0){const shot=this.launch(s);if(shot)shot.firstStep=Math.max(0,-s.delay);}}
  this.queue=this.queue.filter(q=>q.delay>0);
  if(this.buffered&&!this.queue.length&&!this.cooldown){const shot=this.buffered;this.buffered=null;this.prepare(shot);}
  for(let i=this.active.length-1;i>=0;i--){const s=this.active[i];s.previous.copy(s.position);
   const flightTime=s.firstStep??dt;delete s.firstStep;if(flightTime<=0)continue;
   const move=Math.min(s.speed*flightTime,s.range-s.travel);this.ray.set(s.position,s.direction);this.ray.near=0;this.ray.far=move+.001;
   const hit=this.firstHit();
   if(hit){this.impact(s,hit);this.active.splice(i,1);continue;}
   s.position.addScaledVector(s.direction,move);s.travel+=move;
   if(s.travel>=s.range){
    // A sky shot has an explicit terminal result and a same-colour collapse.
    this.impact(s,{point:s.position});this.active.splice(i,1);
   }
  }
  this.ray.far=Infinity;
  for(const p of this.pulses.filter(p=>p.age>.32))p.slot.mesh.visible=false;
  this.pulses=this.pulses.filter(p=>p.age<=.32);
 }
 render(alpha=1){
  this.validateBuffered();
  for(const s of this.active){s.slot.group.position.lerpVectors(s.previous,s.position,alpha);renderCharge(s.slot,s,this.time);}
  for(const p of this.pulses)renderImpact(p);
 }
  reset(){this.epoch++;this.serial=[0,0];this.placedSerial=[0,0];this.queue=[];this.buffered=null;this.active=[];this.pulses=[];this.time=this.cooldown=0;this.lastImpact=this.lastRequest=this.lastOutcome=null;for(const p of this.pool)p.group.visible=false;for(const p of this.impactPool)p.mesh.visible=false;}
 get diagnostics(){return{pending:this.queue.length+Number(Boolean(this.buffered)),flying:this.active.length,lastImpact:this.lastImpact};}
}
