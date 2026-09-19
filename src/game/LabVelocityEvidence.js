import * as THREE from 'three';

const require=(value,message)=>{if(!value)throw new Error(message);};
/** Repeatable expert playthrough, usable in Node and WebGL QA. It changes only
 * keys and yaw/pitch, then fires ordinary timed projectiles. No position,
 * velocity, teleport counter, objective flag, or win state is injected.
 * Camera steering advances once per render frame alongside real physics. */
export async function runVelocityJourney(game,{onFrame=null,renderFps=60,maxSeconds=20}={}){
 require(game.epicMode&&game.firstLevel?.id==='velocity-relay','Velocity arena must be loaded first');
 require([30,40,60,120].includes(renderFps),'renderFps must divide 120');
 game.renderer?.setAnimationLoop(null);game.restart();
 const companion=game.cargo,body=game.physics.cargoBody,dt=1/120,renderEvery=120/renderFps;
 const requests=[],impacts=[],stages=[],frames=[];
 let previousStage=0,lastTeleport=0,shotCursor=0,lastImpact=null;
 game.input.keys.add('KeyW');game.input.keys.add('ShiftLeft');
 for(let tick=0;tick<120*maxSeconds;tick++){
  game.updatePlaying(dt);
  const time=(tick+1)*dt,stage=game.velocityRun.stage;
  if(game.playerPosition.z< -3.7)game.input.keys.clear();
  if(stage!==previousStage){
   require(stage>previousStage,`Run restarted unexpectedly at ${time.toFixed(3)}s`);
   stages.push({stage,time,position:game.playerPosition.toArray(),velocity:game.playerVelocity.toArray()});
   previousStage=stage;lastTeleport=time;
  }
  if(game.portalShots.lastImpact&&game.portalShots.lastImpact!==lastImpact){
   lastImpact=game.portalShots.lastImpact;impacts.push({...lastImpact,time});
   require(lastImpact.valid,`Projectile ${lastImpact.index} failed: ${lastImpact.reason}`);
  }
  if(tick%renderEvery===0||game.state==='won'){
   // Keep the review's view pointed along travel between mouse-aimed shots.
   // This is the same yaw/pitch control available to the player.
   if(stage===0&&game.playerPosition.y<43.9)game.pitch=THREE.MathUtils.damp(game.pitch,-.98,6,1/renderFps);
   let aimTarget=null;
   if(stage>=1&&stage<=2&&shotCursor<stage*2){
    const slot=1-shotCursor%2,name=slot===0?`catch${stage}`:`launch${stage+1}`,panel=game.firstLevel.panels[name];
    const desired=panel.group.position.clone().sub(game.camera.position).normalize();
    const forward=game.camera.getWorldDirection(new THREE.Vector3());
    const yawError=Math.atan2(-desired.x,-desired.z)-Math.atan2(-forward.x,-forward.z);
    const wrapped=Math.atan2(Math.sin(yawError),Math.cos(yawError));
    game.yaw+=THREE.MathUtils.clamp(wrapped*.45,-9/renderFps,9/renderFps);
    game.pitch=THREE.MathUtils.clamp(game.pitch+(Math.asin(desired.y)-Math.asin(forward.y))*.45,-1.15,1.15);
    aimTarget={slot,name,panel};
   }
   if(stage>=1&&!aimTarget&&(time-lastTeleport>.8||stage>=3)){
    const v=game.playerVelocity,targetYaw=Math.atan2(-v.x,-v.z),difference=Math.atan2(Math.sin(targetYaw-game.yaw),Math.cos(targetYaw-game.yaw));
    if(v.length()>1)game.yaw+=difference*(1-Math.exp(-7/renderFps));
    game.pitch=THREE.MathUtils.damp(game.pitch,-.16,6,1/renderFps);
   }
   game.updateVisuals(1/renderFps,1);
   if(aimTarget&&time-lastTeleport>.08&&game.portalShots.cooldown<=0){
    const {slot,name,panel}=aimTarget;
    game.scene.updateMatrixWorld(true);game.raycaster.setFromCamera(new THREE.Vector2(),game.camera);
    const hit=game.raycaster.intersectObjects(game.aimBlockers,true).find(h=>(h.object.visible||h.object.userData.collisionProxy)&&game.isActiveBlocker(h.object));
    if(hit?.object===panel.mesh&&hit.point.distanceTo(panel.group.position)<2){
     require(!game.playerGrounded,`Shot ${name} must be airborne`);
     require(game.firePortal(slot),`Ordinary fire input rejected for ${name}`);
     requests.push({name,slot,time,airborne:!game.playerGrounded,aimError:hit.point.distanceTo(panel.group.position),position:game.playerPosition.toArray()});shotCursor++;
    }
   }
   const frame={time,frame:Math.floor(tick/renderEvery),stage,game};
   if(onFrame)await onFrame(frame);
   if(frames.length===0||time-frames.at(-1).time>.24)frames.push({time,stage,position:game.playerPosition.toArray(),speed:game.playerVelocity.length()});
  }
  if(game.state==='won')break;
 }
 game.input.keys.clear();
 const diagnostics=game.firstLevel.diagnostics();
 require(game.state==='won'&&diagnostics.finished,'Expert route did not reach the finish');
 require(game.teleportCount===3&&diagnostics.chain===3,'Expected three real portal transfers');
 require(diagnostics.airborneShots===4&&requests.length===4&&impacts.length===4,'Expected four actual midair projectile placements');
 require(game.cargo===companion&&game.physics.cargoBody===body,'Companion identity changed');
 require(game.cargo.position.y>43,'Companion must remain safe on the start terrace');
 return {pass:true,mode:'velocity',simulation:'production 120 Hz',controls:'W + Shift, continuous camera steering at real render cadence, four real mouse shots, no position or velocity fixtures',seconds:diagnostics.elapsed,
  peakSpeed:diagnostics.peakSpeed,teleports:game.teleportCount,airborneShots:diagnostics.airborneShots,requests,impacts,stages,frames,
  companionRetained:true,finish:game.playerPosition.toArray(),diagnostics};
}
