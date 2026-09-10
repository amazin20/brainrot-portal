import * as THREE from 'three';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const check=(ok,message)=>{if(!ok)throw Error(message);};
export function room15Extract(d){
 const {game,level,walk,aim,wait,until,mark}=d,p=level.panels;
 walk(-12,17);if(!level.state.funnel.reversed){game.interact();wait(.2);}aim(0,V(18,1.9,14));walk(-12,18.3);walk(-20,18.3);walk(-20,8);walk(-14.5,8);mark('reverse freight extraction');aim(1,V(-14.5,3,-17.6));walk(-20,8);walk(-20,18.3);walk(-12,18.3);walk(-12,17);wait(.3);
 check(level.state.funnel.reversed,'Reversal control inaccessible');
 until(()=>game.cargo.position.z>10,12,'Original friend was not pulled through the freight portal');
 until(()=>game.cargo.position.x< -14,10,'Friend returns to the source');wait(.5);
 mark('friend returns through the source lane');
 walk(-12,18.3);walk(-15.5,18.3);for(let n=0;n<300&&game.playerPosition.distanceTo(game.cargo.position)>1.8;n++){d.worldMove(0,-1);d.frame();}d.stop();d.pickup();for(let n=0;n<250;n++){d.worldMove(0,1);d.frame();if(game.playerPosition.z>17.2)break;}d.stop();walk(-15.5,18.3);walk(-10,18);game.interact();wait(1);
}
export function room15Ascend(d,{carry=false}={}){
 const {game,level,walk,aim,pickup,frame,worldMove,stop,until,mark}=d,p=level.panels;
 walk(-12,17);aim(0,V(18,1.9,14));walk(-12,18.3);walk(-20,18.3);walk(-20,9);walk(-8,10);aim(1,p.lift.getFrame().center);
 if(level.state.funnel.reversed){walk(-20,9);walk(-20,18.3);walk(-14,18.3);game.interact();d.wait(.05);}
 if(carry){walk(game.cargo.position.x,game.cargo.position.z-.8);pickup();walk(-12,18.3);walk(-20,18.3);walk(-20,9);}
 const rising=level.state.funnel.segments.find(s=>s.direction.y>.8);check(rising,'Missing rising field '+JSON.stringify(game.portals.portals.map(p=>p.position.toArray()))+' segments '+JSON.stringify(level.state.funnel.segments.map(s=>[s.a.toArray(),s.b.toArray()])));const axis=rising.a.clone();walk(axis.x,10);walk(axis.x,axis.z+1);mark('ascending countercurrent');
 for(let n=0;n<700;n++){
  const q=game.playerPosition;worldMove(THREE.MathUtils.clamp((axis.x-q.x)*2,-1,1),THREE.MathUtils.clamp((axis.z-q.z)*2,-1,1));frame();
  if(q.y>12.5)break;
 }
 check(game.playerPosition.y>12,'Field did not lift player');
 for(let n=0;n<180;n++){worldMove(0,-1);frame();if(game.playerPosition.z<3.4)break;}
 stop();until(()=>game.playerGrounded,6,'Upper pocket landing');check(Math.abs(game.playerPosition.y-12)<.2,'Wrong upper pocket: '+game.playerPosition.toArray());
 walk(-5,2.5);if(carry){game.interact();d.wait(.6);}mark('upper pocket and new viewpoint');
}
export function room15Cross(d){
 const {game,level,walk,aim,frame,worldMove,stop,until,mark}=d,p=level.panels;
 walk(-5,1);aim(1,p.crossing.getFrame().center);
 // Return through the same open shaft; the old vertical field has been spent.
 walk(-8,3.5);for(let n=0;n<180;n++){worldMove(0,1);frame();if(game.playerPosition.z>6.1)break;}stop();until(()=>game.playerGrounded&&game.playerPosition.y<1,6,'Descent to source lane');
 walk(-20,6);walk(-20,18.3);walk(15,18.3);walk(16,17);const before=game.teleportCount;for(let n=0;n<300&&game.teleportCount===before;n++){worldMove(.25,-.6);frame();}stop();check(game.teleportCount>before,'Source lane entry missed');mark('airborne lane exchange');
 until(()=>game.playerPosition.x>11,8,'Transverse field stalled');
 // Leaving the visible cylinder is a physical fall, not a scripted landing.
 for(let n=0;n<150;n++){worldMove(0,1);frame();if(game.playerPosition.z>-9.2)break;}
 stop();until(()=>game.playerGrounded&&Math.abs(game.playerPosition.y-14)<.2,6,'Receiver landing');mark('landed above the dividing spine');
}
export async function runRoom15(d,{order='cargo-first'}={}){
 check(['cargo-first','scout-first'].includes(order),'Unknown room15 order');
 if(order==='scout-first'){
  room15Ascend(d);room15Cross(d);d.mark('scout finds the empty receiver');
  d.walk(9,-7.6);for(let n=0;n<130;n++){d.worldMove(0,1);d.frame();if(d.game.playerPosition.z>-5)break;}d.stop();d.until(()=>d.game.playerGrounded&&d.game.playerPosition.y<1,5,'Scout lower return');d.walk(9,-18);d.walk(-2.25,-18);d.walk(-2.25,9);d.walk(-8,9);d.walk(-20,9);d.walk(-20,18.3);d.walk(-12,18.3);d.walk(-12,17);
 }
 room15Extract(d);room15Ascend(d,{carry:true});room15Cross(d);
 const {game,level,walk,aim,until,mark}=d;
 walk(15,-9);aim(0,level.panels.receiver.getFrame().center);aim(1,level.panels.perch.getFrame().center);
 until(()=>game.cargo.position.y>13&&game.cargo.position.x>10,5,'Friend retrieval from the upper perch');
 walk(14,-12);until(()=>game.state==='won',4,'Friend and player reunite');mark('countercurrent reunited');
}
