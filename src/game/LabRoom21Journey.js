import * as THREE from 'three';
import { CAMERA_PITCH_MIN, CAMERA_PITCH_MAX } from './LabCamera.js';
const check=(c,m)=>{if(!c)throw Error(m);};

// Local driver uses the actual player camera range, including downward aiming.
// It changes only yaw/pitch input and advances the ordinary simulation.
export function installRoom21Aim(d) {
 d.look=point=>{
  d.stop();
  for(let n=0;n<360;n++) {
   d.game.scene.updateMatrixWorld(true);
   if(point.clone().sub(d.game.camera.position).dot(d.game.camera.getWorldDirection(new THREE.Vector3()))<0){d.game.yaw+=.16;d.frame();continue;}
   const p=point.clone().project(d.game.camera);
   if(n>24&&Math.abs(p.x)<.005&&Math.abs(p.y)<.005)return;
   d.game.yaw-=THREE.MathUtils.clamp(p.x,-1,1)*.18;
   d.game.pitch=THREE.MathUtils.clamp(d.game.pitch+THREE.MathUtils.clamp(p.y,-1,1)*.17,CAMERA_PITCH_MIN,CAMERA_PITCH_MAX);d.frame();
  }
 };
 d.aim=(index,point)=>{
  d.look(point);check(d.game.firePortal(index),'Shot request rejected');
  d.until(()=>!d.game.portalShots.queue.length&&!d.game.portalShots.active.length,3,'Shot unresolved');
  check(d.game.portalShots.lastImpact?.valid,'Rejected shot '+JSON.stringify(d.game.portalShots.lastImpact));
 };
}

export function room21Brake(d) {
 const {game,level,walk,aim,enter,wait,mark}=d;
 walk(-10,14);
 aim(0,level.panels['departure-entry'].getFrame().center);
 walk(-14,13);
 aim(1,level.panels['brake-bay'].getFrame().center);
 enter(level.panels['departure-entry']);
 mark('inspection bay reached by ordinary portal traversal');
 walk(-15.5,-12.2);check(game.interact(),'Brake interaction missed');wait(.4);
 check(!level.cassette.braked,'Brake is still engaged');
 mark('physical cassette brake released');
 enter(level.panels['brake-bay']);
 walk(-10,13);
}
export function room21Freight(d,{offset=0}={}) {
 const {game,level,walk,aim,look,pickup,wait,until,mark}=d;
 walk(0,7.85);aim(1,level.panels['freight-mouth'].getFrame().center);
 walk(0,7.85);aim(0,level.panels['shared-well'].getFrame().center.clone().setZ(7.1));
 walk(-3,12.5);walk(game.cargo.position.x+1,game.cargo.position.z);pickup();
 walk(offset,12);look(game.playerPosition.clone().setZ(0));walk(offset,7.85);wait(.4);
 const before=game.physics.portalTransports;game.interact();
 until(()=>game.physics.portalTransports>before,6,'Freight did not traverse');
 mark('same free cargo falls through the low freight mouth');
 until(()=>level.state.cargoSeat.loaded(),6,'Freight receiver not loaded');
 mark('cargo weight holds receiver; delivery survives a portal change');
}
export function room21Fall(d,{fromService=false}={}) {
 const {game,walk,worldMove,frame,stop,until,mark}=d;
 walk(0,fromService?-3.1:8.05);
 const before=game.teleportCount;
 for(let i=0;i<360&&game.playerGrounded;i++){worldMove(0,fromService?.15:-.15);frame();}
 stop();until(()=>game.teleportCount>before,5,'Well entry missed');
 mark(fromService?'lower service fall through the raised SAME exit':'departure fall through the lowered cassette');
 until(()=>game.playerGrounded,8,'Cassette flight never landed');
 mark('permanent landing');
}
export async function runRoom21(d,{order='cargo-first',recovery=false,offset=0}={}) {
 installRoom21Aim(d);
 const {game,level,walk,aim,until,pickup,mark,wait}=d;
 check(['cargo-first','brake-first'].includes(order),'Unknown preparation order');
 check(Number.isFinite(offset)&&Math.abs(offset)<=.3,'Reviewed offset range');
 if(order==='cargo-first'){room21Freight(d,{offset});room21Brake(d);}else{room21Brake(d);room21Freight(d,{offset});}
 until(()=>level.cassette.height<level.cassette.low+.01,6,'Cassette did not lower');
 walk(0,7.85);
 aim(0,level.panels['shared-well'].getFrame().center.clone().setZ(7.1));
 aim(1,level.panels['moving-cassette'].getFrame().center);
 mark('portal installed on the actual lowered moving ceramic');
 room21Fall(d);
 check(game.playerPosition.y>6.9&&game.playerPosition.y<7.2,'First landing is not the service pocket '+game.playerPosition.toArray());
 if(recovery){game.clearPortals();wait(.3);walk(-1.9,-6);aim(1,level.panels['moving-cassette'].getFrame().center);mark('erased pair restored from permanent service pocket, with same cargo and load');}
 walk(0,-3.1);aim(0,level.panels['shared-well'].getFrame().center.clone().setZ(-1.5));
 mark('move only the entry to the service fall while the friend still supports the low exit');
 walk(21,-5);walk(21,7.6);walk(18,7.6);
 walk(game.cargo.position.x+1,game.cargo.position.z);pickup();
 mark('cargo recovered; the same prepared exit rises with its surface');
 walk(18,7.6);walk(21,7.6);walk(21,-5);walk(0,-5);
 until(()=>level.cassette.height>level.cassette.high-.01,6,'Unloaded cassette failed to rise');
 room21Fall(d,{fromService:true});
 check(game.playerPosition.y>17.9,'Upper balcony missed '+game.playerPosition.toArray());
 walk(12,-8);until(()=>game.state==='won',3,'Joint upper arrival');
 mark('both on upper permanent balcony');
}
