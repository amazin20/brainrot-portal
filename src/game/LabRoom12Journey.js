import * as THREE from 'three';
import {CAMERA_PITCH_MIN,CAMERA_PITCH_MAX} from './LabCamera.js';
import {installPreciseLateAim} from './LabLateCampaignAim.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const check=(ok,message)=>{if(!ok)throw Error(message);};
export function aimRoom12(d,index,point){
 // The long portrait boom magnifies the broad route's NDC tolerance enough
 // to raise the ground aperture above a standing capsule. Settle ordinary
 // look input on the real ceramic centre before the observed charged shot.
 if(d.game.camera.aspect<1){const precise={...d};installPreciseLateAim(precise);precise.look(point);}
 d.aim(index,point);
}
function aimAccess(d,index,panel){
 aimRoom12(d,index,panel.getFrame().center);
 check(d.game.portals.portals[index]?.surfaceId===panel.mesh.uuid,'Folded access shot hit a different ceramic');
}
export function room12FreightAim(d,point=d.level.panels.cargo.getFrame().center){
 // The west return is the genuine front-side sight into the freight throat.
 // Return around its floor corner before approaching the high drop address.
 if(d.game.camera.aspect<1){d.walk(-15,-8);d.walk(-15,-6);}
 aimRoom12(d,1,point);
 check(d.game.portals.portals[1]?.surfaceId===d.level.panels.cargo.mesh.uuid,'Freight sight missed its actual receiver');
 if(d.game.camera.aspect<1){d.walk(-15,-8);d.walk(-9,-8);}
}
export function room12CollectFreight(d){
 const c=d.game.cargo.position;
 // The free companion may explore the real ledge while the pair is aimed.
 // Approach from its inward side near the south edge, not beyond the deck.
 d.walk(THREE.MathUtils.clamp(c.x,-15.8,-8),THREE.MathUtils.clamp(c.z+(c.z>14.4?-1.1:1.1),12.2,15.2));
 d.pickup();
}
function lineUpFreight(d){
 if(d.game.camera.aspect>=1){d.walk(-10,11.65);return;}
 // Brake on the loading line, then approach the edge straight. The full
 // original box must fit the real ellipse; a diagonal carry cannot borrow
 // the aperture's rounded corners when the portal is aimed exactly.
 for(const z of [14,11.55]){
  let settled=false;
  for(let n=0;n<600;n++){
   const p=d.game.playerPosition,v=d.game.playerVelocity,dx=-10-p.x,dz=z-p.z;
   if(Math.hypot(dx,dz)<.012&&Math.hypot(v.x,v.z)<.04){settled=true;break;}
   d.worldMove(THREE.MathUtils.clamp(dx*2-v.x*1.2,-1,1),THREE.MathUtils.clamp(dz*2-v.z*1.2,-1,1));d.frame();
  }
  d.stop();check(settled,'Ordinary shaft freight alignment did not settle');
 }
}
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
 aimAccess(d,0,p['access-low']);aimAccess(d,1,p['access-high']);
 if(carry){
  walk(-14.5,14.5);walk(11,14.5);
  walk(game.cargo.position.x-.9,game.cargo.position.z);
  pickup();walk(11,14.5);walk(-14.5,14.5);walk(-14.5,12);
 }
 enter(p['access-low']);until(()=>game.playerGrounded,3,'Shared ledge landing');mark('folded underpass');
}
export function room12Freight(d){
 const {game,level,walk,aim,pickup,wait,frame,worldMove,stop,until,mark}=d,p=level.panels;
 walk(-15,-8);walk(-15,14);walk(-10,14);wait(.4);game.interact();wait(.8);
 walk(-15,14);walk(-15,-8);walk(-9,-8);room12FreightAim(d);walk(-9,-7.2);aimRoom12(d,0,V(-10,.025,9.8));
 walk(-15,-8);walk(-15,14);walk(-10,14);
 room12CollectFreight(d);lineUpFreight(d);
 for(let n=0;n<10;n++){worldMove(0,-.12);frame();}stop();wait(.4);mark('shared shaft delivery');const cargoBefore=game.physics.portalTransports;game.interact();
 until(()=>game.physics.portalTransports>cargoBefore,5,'Friend enters shared drop');
 until(()=>game.cargo.position.z>1.2&&game.cargo.position.y>8.9,5,'Friend crosses the low throat');
 wait(2);check(game.cargo.position.y>8.9,'Friend must remain on the real dock');mark('friend reaches the crossing dock');
}
export function room12Climb(d){
 const {walk,aim,mark}=d;
 if(d.game.playerPosition.z<0)walk(-15.5,-8);
 walk(-15.5,14);walk(-15.5,-12.5);walk(1.5,-12.5);walk(1.5,-2.5);walk(5,-2.5);walk(5,-9.5);walk(8,-9.5);walk(8,14);
 walk(5.5,12.05);aimRoom12(d,1,V(4,.025,1));walk(5.5,14);walk(-10,14);mark('crossing flight');
}
export function room12Fling(d){
 const {game,level,walk,frame,worldMove,stop,until,mark}=d,p=level.panels;
 walk(-10,11.65);const before=game.teleportCount;
 for(let n=0;n<300&&game.teleportCount===before;n++){worldMove(0,-.32);frame();}stop();check(game.teleportCount>before,'High fall missed shared drop');mark('return rises through the junction');
 const returnCenter=game.portals.portals[1].position;
 aimMoving(d,0,p.final.getFrame().center,{seconds:3,keepPosition:{x:returnCenter.x,z:returnCenter.z},fireWhen:()=>game.playerPosition.y>18.8});mark('spent portal becomes the lateral exit');
 stop();until(()=>game.teleportCount>=before+2,4,'Second fall missed');mark('perpendicular crossing');
 until(()=>game.playerGrounded,4,'Receiving dock landing');
 // A slightly higher exit can first touch the receiving rail. Step onto the
 // actual dock with ordinary movement before checking the landing surface.
 if(game.playerPosition.x>=7&&game.playerPosition.x<15&&game.playerPosition.y>9.15&&game.playerPosition.y<=10.5){walk(12,4);until(()=>game.playerGrounded&&Math.abs(game.playerPosition.y-9)<.15,3,'Step inside receiving rail');}
 check(Math.abs(game.playerPosition.y-9)<.15&&game.playerPosition.x>=7,'Missed dock: '+game.playerPosition.toArray());
}
export function room12DockReturn(d){
 const {game,walk,frame,worldMove,stop,until,mark}=d;
 walk(8.5,5.5);game.input.jumpQueued=true;
 for(let n=0;n<150;n++){worldMove(-1,0);frame();if(game.playerPosition.x<6.25&&game.playerPosition.y<8.8)break;}
 stop();until(()=>game.playerGrounded&&game.playerPosition.y<.1,4,'Return beneath the crossing');
 walk(4,12);walk(10,14.5);mark('scout returns through the lower passage');
}
export async function runRoom12(d,{order='cargo-first'}={}){
 check(['cargo-first','scout-first','remote-freight'].includes(order),'Unknown route order');
 if(order==='remote-freight'){
  const {game,level,walk,aim,until,mark}=d,p=level.panels;
  room12Access(d);
  check(game.cargo.position.y<1&&!game.heldCube,'Remote route must leave the original companion at the entrance');
  walk(-15,-8);walk(-9,-8);room12FreightAim(d,p.cargo.getFrame().center.clone().add({x:.7,y:0,z:0}));
  walk(-15,-8);walk(-15,14);walk(-8,14);walk(-7.8,12.3);
  const before=game.physics.portalTransports;
  aimRoom12(d,0,p['entry-freight'].getFrame().center);
  until(()=>game.physics.portalTransports>before&&game.cargo.position.y>8.9,6,'Original friend did not cross the remote freight address');
  mark('companion delivered directly from the entrance to the receiving dock');
  walk(-15,14);walk(-15,-8);walk(-9,-7.2);aimRoom12(d,0,V(-10,.025,9.8));
  room12Climb(d);room12Fling(d);
  walk(THREE.MathUtils.clamp(game.cargo.position.x-1.1,8,14),THREE.MathUtils.clamp(game.cargo.position.z,1.5,7));
  if(game.state==='playing')d.pickup();walk(10,4);until(()=>game.state==='won',3,'Remote freight reunion');
  mark('player joins remotely delivered companion');return;
 }
 if(order==='scout-first'){
  room12Access(d);
  d.walk(-9,-7.2);aimRoom12(d,0,V(-10,.025,9.8));
  room12Climb(d);room12Fling(d);d.mark('scout reaches the empty dock');
  check(!d.game.heldCube&&d.game.cargo.position.y<1,'The friend stays below during exploration');
  room12DockReturn(d);
 }
 room12Access(d,{carry:true,wandering:order==='scout-first'});room12Freight(d);room12Climb(d);room12Fling(d);
 const {game,walk,pickup,until,mark}=d;
 walk(THREE.MathUtils.clamp(game.cargo.position.x-1.1,8,14),THREE.MathUtils.clamp(game.cargo.position.z,1.5,7));if(game.state==='playing')pickup();walk(10,4);until(()=>game.state==='won',3,'Reunited at the dock');mark('reunited above the entrance');
}
