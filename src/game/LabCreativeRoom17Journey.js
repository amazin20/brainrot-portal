import * as THREE from 'three';
import {installPreciseLateAim,aimLateSurface} from './LabLateCampaignAim.js';
import {CAMERA_PITCH_MIN,CAMERA_PITCH_MAX} from './LabCamera.js';
const V=(...p)=>new THREE.Vector3(...p),check=(v,m)=>{if(!v)throw Error(m);};
// Turn through normal look controls during frames already used for walking.
// An extra stationary inspection changed the free body's return phase. The
// receiver stays in view through landing; the original aim returns during the
// existing gallery walk before another portal is fired.
function watchSupportDuringTravel(d,point,travel,{lower=false}={}){
 const g=d.game,visual=g.updateVisuals,view={yaw:g.yaw,pitch:g.pitch};let returning=false,columnCleared=false;
 g.updateVisuals=function(...args){
  if(returning){
   // The lower landing's immediate return arc swept the ordinary camera
   // through the real support column (z=2.37..3.63). Look along the service
   // gallery until its existing walk clears the column plus the 6.65 m boom.
   // This one-way clearance keeps later walks from repeating the detour and
   // restores the original aim well before either return portal is fired.
   columnCleared ||= !lower||g.playerPosition.z>=11;
   const aroundColumn=lower&&!columnCleared;
   const yaw=aroundColumn?-Math.PI:view.yaw;
   const turn=Math.atan2(Math.sin(yaw-g.yaw),Math.cos(yaw-g.yaw));
   // Keep the level service view during the return turn. Raising the lens's
   // aim before its yaw settles clipped the torso at narrow camera aspects.
   const pitch=lower&&(aroundColumn||Math.abs(turn)>.08)?-.2:view.pitch;
   g.yaw+=THREE.MathUtils.clamp(turn,-.04,.04);
   g.pitch+=THREE.MathUtils.clamp(pitch-g.pitch,-.025,.025);
  }else{
   g.scene.updateMatrixWorld(true);
   const direction=point.clone().sub(g.camera.position);
   if(direction.dot(g.camera.getWorldDirection(V()))<0){
    const turn=Math.atan2(-direction.x,-direction.z)-g.yaw;
    g.yaw+=THREE.MathUtils.clamp(Math.atan2(Math.sin(turn),Math.cos(turn)),-.04,.04);
   }else{
    const p=point.clone().project(g.camera);
    g.yaw-=THREE.MathUtils.clamp(p.x*.18,-.04,.04);
    g.pitch=THREE.MathUtils.clamp(g.pitch+THREE.MathUtils.clamp(p.y*.17,-.025,.025),CAMERA_PITCH_MIN,CAMERA_PITCH_MAX);
   }
  }
  return visual.apply(this,args);
 };
 try{travel(()=>{returning=true;});}finally{g.updateVisuals=visual;}
}
export function support17Service(d){d.walk(-24,18);d.walk(-24,49.5);d.walk(-18,49.5);d.walk(-18,-11);}
export function support17Departure(d){d.walk(-18,52);d.walk(-24,52);d.walk(-24,18);}
export function prepareSupport17(d,{swapColours=false,stopAfter=null,route='upper-branch'}={}){
 installPreciseLateAim(d);const {game:g,level:l}=d,c0=swapColours?1:0,c1=1-c0;
 support17Service(d);aimLateSurface(d,c1,l.mouth);support17Departure(d);
 d.walk(g.cargo.position.x-1.3,g.cargo.position.z);d.pickup();d.walk(-16,13.0);d.look(V(-16,7,0));d.stop();d.wait(.3);check(g.interact()&&!g.heldCube,'Original endpoint release rejected');d.wait(.8);
 d.walk(-11,16);aimLateSurface(d,c0,l.feed.surface,g.cargo.position.clone().setY(l.feed.surface.getFrame().center.y));
 d.until(()=>g.physics.portalTransports>0&&g.cargo.position.y<-8,8,'Original endpoint did not enter the protected anchor');d.wait(1.2);d.mark('original free endpoint reaches the real ground anchor');
 if(stopAfter==='delivered')return;
 support17Service(d);d.walk(-18,3);aimLateSurface(d,c1,l.anchor);support17Departure(d);
 d.walk(-12,12);aimLateSurface(d,c0,route==='lower-branch'?l.lowLead:l.highLead);
 if(route==='lower-branch'){d.until(()=>l.beam.angle<-.32&&l.beam.angle>-.50&&l.beam.tension>30,12,'Lower current cable did not form the independent descent');d.wait(2);d.mark('current lower branch forms a separate descending route');}
 else{d.until(()=>l.beam.angle>-.04&&l.beam.tension>30,12,'Current upper cable did not support the architectural floor');d.mark('current upper branch supports the free architectural end');}
}
export function runCreative17(d,{route='upper-branch',alternative=null,swapColours=false,stopAfter=null,recovery=false}={}){
 if(alternative)route=alternative;check(['upper-branch','lower-branch'].includes(route),'Unknown support route');
 const {game:g,level:l}=d,c0=swapColours?1:0,c1=1-c0;
 prepareSupport17(d,{swapColours,stopAfter,route});if(stopAfter==='delivered')return;
 if(stopAfter==='supported')return;
 if(recovery){
  aimLateSurface(d,c0,l.feed.surface);d.until(()=>l.beam.angle<-.65,12,'Replacing the support charge did not drop the floor');d.walk(-6,0);d.walk(0,6);d.until(()=>g.playerGrounded&&g.playerPosition.y<-9.9,8,'Dry service landing missed');d.mark('support loss returns through the same dry floor without resetting either body');support17Departure(d);d.walk(-12,12);aimLateSurface(d,c0,route==='lower-branch'?l.lowLead:l.highLead);d.until(()=>l.beam.tension>30&&l.beam.angle>-.50,12,'Restored current pair did not recover support');d.wait(2);
 }
 watchSupportDuringTravel(d,V(20,route==='lower-branch'?-.45:6.75,0),restoreView=>{
 d.walk(-10,0);d.walk(-7,0);
 if(route==='lower-branch'){
  // Walk slowly enough to keep ordinary contact with the live descending
  // floor. Jump after gaining clearance below the permanent upper chassis.
  let landed=false,jumped=false,takeoff=false;
  for(let f=0;f<720&&!landed;f++){
   if(!jumped&&g.coyoteTime>.065&&g.playerPosition.x>6.5
     &&g.playerPosition.y<.60&&g.playerPosition.y>-1.5){
    g.input.keys.add('ShiftLeft');g.input.jumpQueued=true;jumped=true;
   }
   const lane=Math.max(-.25,Math.min(.25,-g.playerPosition.z*.8-g.playerVelocity.z*.2));
   const pace=jumped?1:.30;
   d.worldMove(pace*Math.sqrt(1-lane*lane),pace*lane);d.frame();
   takeoff ||= !g.playerGrounded&&g.playerVelocity.y>5;
   landed=g.playerGrounded&&g.playerPosition.x>12.4&&Math.abs(g.playerPosition.y+1.2)<.3;
  }
  d.stop();check(takeoff,'Actual ordinary late jump was never taken');
  check(landed,'Independent lower permanent landing missed at '+g.playerPosition.toArray()+' angle '+l.beam.angle);
  d.mark('observer leaves the live ramp onto the permanent lower gallery');
  restoreView();
  d.walk(16,20);d.walk(24,20);d.walk(24,4);d.walk(24,0);
 }else{d.walk(11,0);d.until(()=>g.playerGrounded&&g.playerPosition.x>10.1&&Math.abs(g.playerPosition.y-6)<.3,4,'Permanent upper landing missed');d.mark('observer leaves the live bridge onto permanent upper ground');restoreView();d.walk(23,0);}
 },{lower:route==='lower-branch'});
 if(stopAfter==='permanent')return;
 // Both colours are re-fired through actual controls. No stage bit preserves
 // the old support; its spring plungers physically return the free endpoint.
 d.walk(20,0);aimLateSurface(d,c1,l.cargoReceiver);d.until(()=>l.beam.angle<-.62,12,'Removing current support failed to return the original endpoint onto its clear floor');d.walk(16,16);d.walk(12.6,-3);d.until(()=>g.cargo.velocity.length()<.1,8,'The same returned endpoint did not settle on its actual support');aimLateSurface(d,c0,l.retrieval,g.cargo.position.clone().setY(l.retrieval.getFrame().center.y));
 // Opening the real floor can move the rigid body against the aperture rim.
 // Re-fire through the same controls beneath its current position; no body
 // pose, aperture size or supporting collider is changed by this recovery.
 for(let retry=0;retry<2&&g.physics.portalTransports<2;retry++){
  d.wait(1);
  if(g.physics.portalTransports<2)
   aimLateSurface(d,c0,l.retrieval,g.cargo.position.clone().setY(l.retrieval.getFrame().center.y));
 }
 d.until(()=>g.physics.portalTransports>1&&g.cargo.position.x>20&&g.cargo.position.y>6,8,'Original endpoint was not reclaimed through its actual floor');
 d.until(()=>l.beam.angle<-.62,12,'Borrowing the same pair failed to remove actual architectural support');d.mark('the unsupported floor falls behind the permanent landing');
 d.walk(16,20);d.walk(24,20);d.walk(24,4);
 // The known-route camera reaches permanent upper ground before inspecting
 // the returned original body. Ordinary look input keeps both travellers in
 // the final frame, including a narrow portrait viewport.
 d.look(g.cargo.position.clone());d.mark('same free endpoint inspected on the permanent receiving gallery');
 d.walk(g.cargo.position.x-1.25,g.cargo.position.z);if(g.state==='playing')d.pickup();d.walk(24,0);d.until(()=>g.state==='won',4,'Both original travellers did not reunite at the receiving gallery');d.mark('same original endpoint and observer leave together');
}
