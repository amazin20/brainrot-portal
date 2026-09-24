import * as THREE from 'three';
import {CAMERA_PITCH_MIN,CAMERA_PITCH_MAX} from './LabCamera.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const check=(ok,message)=>{if(!ok)throw Error(message);};
function aimRising(d,index,point){
 const {game,frame}=d;let fired=false;const target=game.portals.portals[1].position.clone();
 for(let n=0;n<240;n++){
  const p=game.playerPosition,v=game.playerVelocity;d.worldMove(THREE.MathUtils.clamp((target.x-p.x)*1.8-v.x*1.2,-1,1),THREE.MathUtils.clamp((target.z-p.z)*1.8-v.z*1.2,-1,1));
  game.scene.updateMatrixWorld(true);const delta=point.clone().sub(game.camera.position);
  if(delta.dot(game.camera.getWorldDirection(V()))<0)game.yaw+=.11;
  else{const ndc=point.clone().project(game.camera);game.yaw-=THREE.MathUtils.clamp(ndc.x,-1,1)*.16;game.pitch=THREE.MathUtils.clamp(game.pitch+THREE.MathUtils.clamp(ndc.y,-1,1)*.14,CAMERA_PITCH_MIN,CAMERA_PITCH_MAX);if(!fired&&p.y>15.5&&Math.abs(ndc.x)<.028&&Math.abs(ndc.y)<.028){check(game.firePortal(index),'Turning shot rejected');fired=true;}}
  frame();if(fired&&!game.portalShots.queue.length&&!game.portalShots.active.length){check(game.portalShots.lastImpact?.valid,'Turning impact: '+JSON.stringify(game.portalShots.lastImpact));return;}
 }
 throw Error('Turning aim timeout '+game.playerPosition.toArray());
}
export function room18Freight(d){
 const {game,level,walk,aim,pickup,wait,frame,worldMove,stop,until,mark}=d;
 walk(6,14);until(()=>game.playerGrounded,3,'Foundation landing');walk(6,8);aim(0,V(1.6,.025,8.2));walk(1,21);walk(1,28);walk(-19.5,28);walk(-19.5,16.5);walk(-12,16.5);aim(1,level.panels.freight.getFrame().center);walk(0,16.5);
 walk(1.8,15);pickup();walk(1.5,10);walk(1.5,9.12);
 for(let n=0;n<9;n++){worldMove(0,-.12);frame();}stop();wait(.3);
 const before=game.physics.portalTransports;game.interact();until(()=>game.physics.portalTransports>before,5,'Cargo enters the common well');
 mark('freight crosses the low throat');until(()=>game.cargo.position.z>-7.8&&game.cargo.position.y>10.9,5,'Cargo crosses its low throat');wait(2);
}
export function room18Climb(d,{direct=false}={}){
 const {walk,aim,level,mark}=d;
 walk(0,16.5);walk(20,16.5);walk(20,-17.5);walk(-1.5,-17.5);walk(-1.5,-14);walk(-.3,-14);
 if(!direct)aim(1,level.panels.rebound.getFrame().center);
 walk(-1.5,-14);if(direct){
  if(d.game.camera.aspect<1){walk(-1.5,-8);d.look(level.panels.turn.getFrame().center);}
  // At 16:10 the camera clips the high sight baffle from the west edge.
  // Move across the same permanent walkway to its unobstructed east edge.
  walk(d.game.camera.aspect>=1&&d.game.camera.aspect<1.7?-.6:-1.5,5);
 }
 if(direct){
  check(level.state.sightShutter.loaded&&level.state.sightShutter.progress>.95,'Original freight has not opened the upper sight shutter');
  const turn=level.panels.turn.getFrame().center;
  aim(1,d.game.camera.aspect>=1&&d.game.camera.aspect<1.7?turn.clone().add(V(0,-1.3,0)):turn);
  walk(-1.5,11);walk(1.5,11);
  mark('freight holds the sight shutter open while the turn is addressed from the upper lip');
 }else{walk(-1.5,11);walk(1.5,11);mark('same well from the upper return');}
}
export function room18DirectFlight(d){
 const {game,walk,worldMove,frame,stop,until,mark}=d;
 walk(1.5,9.15);const before=game.teleportCount;
 for(let n=0;n<300&&game.teleportCount===before;n++){worldMove(0,-.15);frame();}stop();
 check(game.teleportCount===before+1,'Direct upper fall missed the shared well');
 until(()=>game.playerGrounded,5,'Direct transverse gallery landing');
 check(game.playerPosition.y>10.9&&game.playerPosition.y<11.1&&game.playerPosition.x>-4,'Direct turn missed its permanent receiving gallery '+game.playerPosition.toArray());
 mark('pre-addressed single flight reaches the transverse gallery without a rebound shot');
}
export function room18Flight(d,{aimDelayFrames=0}={}){
 const {game,level,walk,worldMove,frame,stop,until,mark}=d;
 walk(1.5,9.15);const before=game.teleportCount;
 for(let n=0;n<300&&game.teleportCount===before;n++){worldMove(0,-.15);frame();}stop();check(game.teleportCount>before,'Upper fall missed shared well');
 const rebound=game.portals.portals[1].position;
 for(let n=0;n<aimDelayFrames;n++){const p=game.playerPosition,v=game.playerVelocity;worldMove(THREE.MathUtils.clamp((rebound.x-p.x)*1.8-v.x*1.2,-1,1),THREE.MathUtils.clamp((rebound.z-p.z)*1.8-v.z*1.2,-1,1));frame();}
 aimRising(d,0,level.panels.turn.getFrame().center);mark('spent portal turns the ascent');
 until(()=>game.teleportCount>=before+2,4,'Rebound missed its return');until(()=>game.playerGrounded,5,'Transverse gallery landing');
 check(game.playerPosition.y>10.9&&game.playerPosition.y<11.1&&game.playerPosition.x>-4,'Turning gallery missed '+game.playerPosition.toArray());
}
export function room18Return(d,{order='portal-first'}={}){
 const {game,level,walk,aim,pickup,wait,mark,frame,worldMove,stop,until}=d;
 check(['portal-first','retrieve-first','send-ahead'].includes(order),'Unknown return-gallery route');
 walk(12,0);walk(4,0);
 if(order==='retrieve-first'){
  // Keep the original friend on permanent support while the observer climbs
  // to the sight line and changes the other portal to the hidden exit.
  walk(4,-2);walk(-12,-2);walk(-14.85,-2);aim(0,V(-20,.025,-1.2));
  walk(game.cargo.position.x-1,game.cargo.position.z);pickup();walk(-12,-2);walk(7,0);
  // Stop before placing the live body. Releasing straight out of a walk
  // preserves the hand's lateral velocity and can send it off the gallery.
  wait(.4);
  check(game.interact()&&!game.heldCube,'Companion could not be staged on the real gallery');wait(1);
  check(game.cargo.position.y>10.9,'The staged companion fell off the return gallery');
  mark('retrieve and stage the original companion before addressing the hidden exit');
  walk(4,0);walk(4,25);aim(1,level.panels.home.getFrame().center);
  mark('hidden exit addressed after securing the companion on permanent support');
  walk(4,0);walk(game.cargo.position.x+1,game.cargo.position.z);pickup();walk(-12,-2);
 }else{
  walk(4,25);aim(1,level.panels.home.getFrame().center);
  walk(4,0);walk(4,-2);walk(-12,-2);walk(-14.85,-2);aim(0,V(-20,.025,order==='send-ahead'?0:-1.2));
  walk(game.cargo.position.x-1,game.cargo.position.z);pickup();
 }
 walk(-12,-4);walk(order==='send-ahead'?-21.2:-20,-4);mark('return flight behind the entrance');
 if(order==='send-ahead'){
  // The already prepared medium well becomes a separate freight flight. The
  // player stays on the lip until the original companion reaches safe ground.
  for(let n=0;n<90&&game.playerPosition.z< -3.35;n++){worldMove(0,1);frame();}stop();
  check(game.playerPosition.y>10.9&&game.heldCube,'Companion must launch from the real return lip');
  const delivered=game.physics.portalTransports;
  check(game.interact()&&!game.heldCube,'Could not send the original companion ahead');
  until(()=>game.physics.portalTransports>delivered,5,'The companion missed the medium return portal');
  until(()=>game.physics.grounded&&game.cargo.position.y>7,6,'Companion missed the hidden receiving floor');
  mark('original companion reaches the hidden exit ahead of the player');
 }
 const before=game.teleportCount;walk(-20,-3.15);
 for(let n=0;n<300&&game.teleportCount===before;n++){worldMove(0,.3);frame();}stop();check(game.teleportCount>before,'Medium return missed its well');
 until(()=>game.playerGrounded,5,'Hidden exit landing');walk(12.5,25);
 if(order==='send-ahead'&&game.state==='playing'){
  walk(game.cargo.position.x-1,game.cargo.position.z);
  // The reunited pair can already satisfy the real goal while approaching
  // the companion, especially in portrait framing. No pickup follows a win.
  if(game.state==='playing'){pickup();walk(12.5,25);}
 }
 until(()=>game.state==='won',3,'Reunited behind the entrance');
}
export async function runRoom18(d,{aimDelayFrames=0,order='portal-first'}={}){
 check(['portal-first','retrieve-first','send-ahead','direct-turn'].includes(order),'Unknown double-bottom route');
 room18Freight(d);
 if(order==='direct-turn'){
  room18Climb(d,{direct:true});room18DirectFlight(d);room18Return(d,{order:'portal-first'});
 }else{
  room18Climb(d);room18Flight(d,{aimDelayFrames});room18Return(d,{order});
 }
}
