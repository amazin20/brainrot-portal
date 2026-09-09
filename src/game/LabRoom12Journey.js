import * as THREE from 'three';
import {CAMERA_PITCH_MIN,CAMERA_PITCH_MAX} from './LabCamera.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const check=(ok,message)=>{if(!ok)throw Error(message);};
function aimMoving(d,index,point,{seconds=4,keepPosition=null,fireWhen=()=>true}={}){
 const {game,frame}=d;let fired=false;
 for(let n=0;n<seconds*60;n++){
  if(keepPosition){const p=game.playerPosition,v=game.playerVelocity;d.worldMove(THREE.MathUtils.clamp((keepPosition.x-p.x)*1.8-v.x*1.2,-1,1),THREE.MathUtils.clamp((keepPosition.z-p.z)*1.8-v.z*1.2,-1,1));}
  game.scene.updateMatrixWorld(true);
  const direction=point.clone().sub(game.camera.position),forward=game.camera.getWorldDirection(V());
  if(direction.dot(forward)<0)game.yaw+=.11;
  else {const ndc=point.clone().project(game.camera);game.yaw-=THREE.MathUtils.clamp(ndc.x,-1,1)*.16;game.pitch=THREE.MathUtils.clamp(game.pitch+THREE.MathUtils.clamp(ndc.y,-1,1)*.14,CAMERA_PITCH_MIN,CAMERA_PITCH_MAX);
   if(!fired&&Math.abs(ndc.x)<.028&&Math.abs(ndc.y)<.028&&fireWhen()){check(game.firePortal(index),'Airborne shot rejected');fired=true;}}
  frame();
  if(fired&&!game.portalShots.queue.length&&!game.portalShots.active.length){check(game.portalShots.lastImpact?.valid,'Airborne impact failed: '+JSON.stringify(game.portalShots.lastImpact));return;}
 }
 throw Error('Moving aim timeout '+index+' at '+game.playerPosition.toArray());
}
export function room12Access(d,{carry=false,wandering=false}={}){
 const {game,level,walk,aim,enter,pickup,until,mark}=d,p=level.panels;
 walk(10,14.5);walk(-14.5,14.5);walk(-14.5,12);
 aim(0,p['access-low'].getFrame().center);aim(1,p['access-high'].getFrame().center);
 if(carry){
  walk(-14.5,14.5);walk(11,14.5);
  if(wandering)walk(game.cargo.position.x-.9,game.cargo.position.z);else walk(11,11);
  pickup();walk(11,14.5);walk(-14.5,14.5);walk(-14.5,12);
 }
 enter(p['access-low']);until(()=>game.playerGrounded,3,'Shared ledge landing');mark('folded underpass');
}
export function room12Freight(d){
 const {game,level,walk,aim,pickup,wait,frame,worldMove,stop,until,mark}=d,p=level.panels;
 walk(-15,-8);walk(-15,14);walk(-10,14);wait(.4);game.interact();wait(.8);
 walk(-15,14);walk(-15,-8);walk(-9,-8);aim(1,p.cargo.getFrame().center);walk(-9,-7.2);aim(0,V(-10,.025,9.8));
 walk(-15,-8);walk(-15,14);walk(-10,14);
 walk(game.cargo.position.x,game.cargo.position.z+1.1);pickup();walk(-10,11.65);
 for(let n=0;n<10;n++){worldMove(0,-.12);frame();}stop();wait(.4);mark('shared shaft delivery');const cargoBefore=game.physics.portalTransports;game.interact();
 until(()=>game.physics.portalTransports>cargoBefore,5,'Friend enters shared drop');
 until(()=>game.cargo.position.z>1.2&&game.cargo.position.y>8.9,5,'Friend crosses the low throat');
 wait(2);check(game.cargo.position.y>8.9,'Friend must remain on the real dock');mark('friend reaches the crossing dock');
}
export function room12Climb(d){
 const {walk,aim,mark}=d;
 if(d.game.playerPosition.z<0)walk(-15.5,-8);
 walk(-15.5,14);walk(-15.5,-12.5);walk(1.5,-12.5);walk(1.5,-2.5);walk(5,-2.5);walk(5,-9.5);walk(8,-9.5);walk(8,14);
 walk(5.5,12.05);aim(1,V(4,.025,1));walk(5.5,14);walk(-10,14);mark('crossing flight');
}
export function room12Fling(d){
 const {game,level,walk,frame,worldMove,stop,until,mark}=d,p=level.panels;
 walk(-10,11.65);const before=game.teleportCount;
 for(let n=0;n<300&&game.teleportCount===before;n++){worldMove(0,-.32);frame();}stop();check(game.teleportCount>before,'High fall missed shared drop');mark('return rises through the junction');
 const returnCenter=game.portals.portals[1].position;
 aimMoving(d,0,p.final.getFrame().center,{seconds:3,keepPosition:{x:returnCenter.x,z:returnCenter.z},fireWhen:()=>game.playerPosition.y>18.8});mark('spent portal becomes the lateral exit');
 stop();until(()=>game.teleportCount>=before+2,4,'Second fall missed');mark('perpendicular crossing');
 until(()=>game.playerGrounded,4,'Receiving dock landing');check(Math.abs(game.playerPosition.y-9)<.15&&game.playerPosition.x>=7,'Missed dock: '+game.playerPosition.toArray());
}
export function room12DockReturn(d){
 const {game,walk,frame,worldMove,stop,until,mark}=d;
 walk(8.5,5.5);game.input.jumpQueued=true;
 for(let n=0;n<150;n++){worldMove(-1,0);frame();if(game.playerPosition.x<6.25&&game.playerPosition.y<8.8)break;}
 stop();until(()=>game.playerGrounded&&game.playerPosition.y<.1,4,'Return beneath the crossing');
 walk(4,12);walk(10,14.5);mark('scout returns through the lower passage');
}
export async function runRoom12(d,{order='cargo-first'}={}){
 check(order==='cargo-first'||order==='scout-first','Unknown route order');
 if(order==='scout-first'){
  room12Access(d);
  d.walk(-9,-7.2);d.aim(0,V(-10,.025,9.8));
  room12Climb(d);room12Fling(d);d.mark('scout reaches the empty dock');
  check(!d.game.heldCube&&d.game.cargo.position.y<1,'The friend stays below during exploration');
  room12DockReturn(d);
 }
 room12Access(d,{carry:true,wandering:order==='scout-first'});room12Freight(d);room12Climb(d);room12Fling(d);
 const {game,walk,pickup,until,mark}=d;
 walk(game.cargo.position.x-1.1,Math.max(1.5,game.cargo.position.z));if(game.state==='playing')pickup();walk(10,4);until(()=>game.state==='won',3,'Reunited at the dock');mark('reunited above the entrance');
}
