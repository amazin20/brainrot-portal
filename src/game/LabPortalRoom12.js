import * as THREE from 'three';
import {Workshop} from './LabWorkshopKit.js';
import {CAMERA_PITCH_MIN,CAMERA_PITCH_MAX} from './LabCamera.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const check=(ok,message)=>{if(!ok)throw Error(message);};

export const ROOM12_SPEC={id:'reverse-perspective',title:'Обратная перспектива',concept:'Один атриум, два путешественника и повторное использование импульса',description:'Доставь друга на верхнюю галерею. Изучи другой ракурс: грузовой путь и твой путь здесь различаются.',hints:['Высокая галерея показывает то, чего не видно со двора. Белая керамика сохраняет свои свойства с любого доступного ракурса.','С другом в руках пушкой не воспользоваться. Грузовое окно низкое, зато свободный друг сохраняет скорость после портала.','Отправь друга через грузовое окно. Падение с верхней площадки подбросит тебя над центральным полом: в воздухе откроется вид на дальнюю стену. Перенеси туда портал из первого колодца, сохранив второй под своим падением.'],accent:0xd4b47d,assets:[1,2,11,22,23,24]};

/** A single physical freight atrium. Height, visibility and the existing
 * hands-full rule provide the dependencies; there is no progression latch. */
export function buildRoom12(game,index=11){
 const k=new Workshop(game,ROOM12_SPEC,index),w=k.world;
 k.shell({minX:-31,maxX:31,minZ:-35,maxZ:37},30);
 w.materials.wall.color.setHex(0x465860);w.materials.floor.color.setHex(0x687980);
 const deck=(name,x0,x1,z0,z1,y)=>{
  const s=w.floor(x0,x1,z0,z1,y,{name});
  w.box([(x0+x1)/2,y-.33,(z0+z1)/2],[x1-x0-.08,.34,z1-z0-.08],w.materials.trim);
  if(y>1)for(const x of[x0+.38,x1-.38])for(const z of[z0+.38,z1-.38])w.box([x,(y-.51)/2,z],[.44,y-.51,.44],w.materials.trim);
  return s;
 };
 const stairs=(name,x0,x1,z0,z1,low,high)=>{
  const count=Math.ceil((high-low)/.26),dz=(z1-z0)/count;
  for(let i=0;i<count;i++){
   const a=z0+i*dz,b=a+dz,y=low+(high-low)*(i+1)/count;
   w.floor(x0,x1,Math.min(a,b),Math.max(a,b),y,{name});
   w.box([(x0+x1)/2,(low+y-.16)/2,(a+b)/2],[x1-x0-.08,y-low-.16,Math.abs(dz)-.025],w.materials.trim);
  }
 };
 deck('Observation balcony',-29,-16,8,20,8);
 stairs('High return stair',-29,-25,8,-26,8,22);
 deck('Gravity reservoir overlook',-29,-12,-32,-26,22);
 deck('Freight release apron',-16,-8,18,23,6);
 stairs('Freight service stair',-11,-8,33,23,0,6);
 deck('Arrival gallery',12,29,0,26,12);
 deck('Freight receiving floor',21,29,-3,0,12);
 // The main wall is an actual optical baffle. Its tall window is visible
 // from the airborne centre, but its jamb hides the final face from both
 // observation and gravity-reservoir platforms.
 w.box([12,15,-23.9],[.65,30,22.2],w.materials.wall);
 w.box([12,15,-4.125],[.65,30,8.75],w.materials.wall);
 w.box([12,11,-10.9],[.65,22,4.8],w.materials.wall);
 w.box([12,28,-10.9],[.65,4,4.8],w.materials.wall);
 // A second deep jamb excludes oblique views from the upper western rooms.
 w.box([9,15,-20.75],[.55,30,24.5],w.materials.wall);
 w.box([9,15,-.1],[.55,30,8.2],w.materials.wall);
 w.box([9,11,-6.35],[.55,22,4.3],w.materials.wall);
 w.box([9,29,-6.35],[.55,2,4.3],w.materials.wall);
 // The tall launch bay opens only at flight height. No ground corridor
 // leads behind its optical baffles; a ceramic pit floor enables recovery.
 w.box([20.6,15,-13],[.5,30,26],w.materials.wall);
 w.box([16.5,15,-26],[8.2,30,.5],w.materials.wall);
 w.box([16.5,9.1,0],[8.4,18.2,.5],w.materials.wall);
 w.box([16.5,28,0],[8.4,4,.5],w.materials.wall);
 // A low, broad freight arch accepts the companion's rigid box; its
 // lintel physically excludes the standing player capsule.
 w.box([24,16,14],[7,5.3,.65],w.materials.wall);
 // Jamb cladding stands 25 mm proud of the continuous sidewall;
 // coincident outer faces flickered at the receiving-gallery viewpoint.
 w.box([20.65,13.4,14],[.70,2.8,4],w.materials.trim);
 w.box([27.35,13.4,14],[.70,2.8,4],w.materials.trim);
 w.box([20.65,12.8,9.5],[.65,1.6,9],w.materials.wall);
 w.box([20.65,17.4,9.5],[.65,4.4,9],w.materials.wall);
 w.box([27.35,15.8,9.5],[.65,7.6,9],w.materials.wall);
 w.box([24,19.45,9.5],[7,.3,9],w.materials.wall);
 w.box([24,18.15,5.65],[7,2.7,.4],w.materials.wall);
 // The freight panel is screened from the ground by the gallery's body.
 w.box([28.8,6,12],[.4,12,27.5],w.materials.wall);
 w.box([20.5,6,0],[.4,12,6],w.materials.wall);
 w.box([24.6,6,-2.9],[8.6,12,.3],w.materials.wall);
 // The same receiving gallery gives cargo a real stopping wall.
 w.box([20.5,13.05,25.4],[17,2.1,.5],w.materials.wall);
 w.box([12.3,12.2,13],[.35,.4,25],w.materials.trim);
 w.box([28.7,12.5,13],[.35,1,25],w.materials.trim);
 k.panel('entry',[-23,2.2,36.97],[0,0,-1],9,4.6);
 k.panel('observation',[-22,13.2,17],[0,0,1],9,4.6);
 k.panel('freight-floor',[-12,.025,16],[0,1,0],8,8);
 k.panel('freight-exit',[24,14.5,6],[0,0,1],7,4.6);
 k.panel('reservoir-floor',[-16,.025,-22],[0,1,0],8,8);
 k.panel('return-floor',[4,.025,4],[0,1,0],10,10);
 k.panel('far-exit',[16.5,24,-20],[0,0,1],7,4.6);
 k.panel('launch-bay-floor',[16.5,.025,-16],[0,1,0],7,16);
 // Solid ceramic-wall foundations and distinct structural bays.
 for(const x of[-26.3,-17.7])w.box([x,6.6,16.74],[.4,13.2,.5],w.materials.trim);
 w.box([16.5,10.85,-20.27],[7,21.7,.35],w.materials.wall);
 for(const z of[-29,-17,-5,7,19,31])for(const x of[-30,30]){
  w.box([x,14.6,z],[.55,29.2,.65],w.materials.trim);
  w.box([x,26,z],[1.4,.35,5],w.materials.accent,false);
 }
 for(const z of[-29,-17,-5,7,19,31])w.box([0,29.2,z],[60,.4,.55],w.materials.trim,false);
 // Thin inset expansion strips are recessed below the walkable face.
 for(const x of[-6,9])w.box([x,.007,0],[.055,.01,62],w.materials.accent,false);
 const level=k.finish([-23,0,26],[-20,.55,27],[21,12,21],{workshop:k,portalPuzzle:true});
 level.puzzleGeometry={safeFloor:0,reservoirHeight:22,freightHeight:6,goalHeight:12,normalGaps:0,airWindow:{x:12,z:[-13.3,-8.5],y:[22,26]},cargoWindow:{z:14,minY:12,maxY:13.35},deductions:['change the observation point','send the friend independently','reuse the airborne return']};
 return level;
}

function aimMoving(d,index,point,{seconds=4,keepPosition=null,fireWhen=()=>true}={}){
 const {game,frame}=d;let fired=false;
 for(let n=0;n<seconds*60;n++){
  if(keepPosition){const p=game.playerPosition,v=game.playerVelocity;const x=THREE.MathUtils.clamp((keepPosition.x-p.x)*1.8-v.x*1.2,-1,1),z=THREE.MathUtils.clamp((keepPosition.z-p.z)*1.8-v.z*1.2,-1,1);d.worldMove(x,z);}
  game.scene.updateMatrixWorld(true);
  
  const direction=point.clone().sub(game.camera.position),forward=game.camera.getWorldDirection(V());
  if(direction.dot(forward)<0)game.yaw+=.11;
  else {const ndc=point.clone().project(game.camera);game.yaw-=THREE.MathUtils.clamp(ndc.x,-1,1)*.16;game.pitch=THREE.MathUtils.clamp(game.pitch+THREE.MathUtils.clamp(ndc.y,-1,1)*.14,CAMERA_PITCH_MIN,CAMERA_PITCH_MAX);
   if(!fired&&Math.abs(ndc.x)<.028&&Math.abs(ndc.y)<.028&&fireWhen()){check(game.firePortal(index),'Airborne shot rejected');fired=true;}}
  frame();
  if(fired&&game.portalShots.queue.length===0&&game.portalShots.active.length===0){check(game.portalShots.lastImpact?.valid,'Airborne impact failed: '+JSON.stringify(game.portalShots.lastImpact));return;}
 }
 throw Error('Moving aim timeout '+index+' at '+game.playerPosition.toArray()+' toward '+point.toArray());
}

export async function runRoom12(d){
 const {game,level,walk,aim,enter,pickup,wait,frame,worldMove,stop,until,mark}=d,p=level.panels;
 aim(0,p.entry.getFrame().center);aim(1,p.observation.getFrame().center);mark('observation flight');enter(p.entry);mark('a new viewpoint reveals the freight route');
 walk(-19,14);aim(1,V(25,14.5,6));
 // Return through the physical court; the cargo stays where it was left.
 walk(-15,14);until(()=>game.playerGrounded&&game.playerPosition.y<.1,4,'Observation return');
 walk(-12,22);aim(0,V(-12,.025,17.3));walk(-20,28.1);pickup();
 walk(-16,30);walk(-9.5,34);walk(-9.5,21);walk(-12,20);walk(-12,18.05);
 for(let n=0;n<12;n++){worldMove(0,-.12);frame();}stop();wait(.5);mark('freight release');game.interact();
 // Follow the released rigid body with ordinary mouse-look input. Changing
 // view only after E preserves the exact held-body release and its velocity.
 const watchFreight=()=>{
  game.scene.updateMatrixWorld(true);
  const point=game.cargo.position.clone(),direction=point.clone().sub(game.camera.position);
  if(direction.dot(game.camera.getWorldDirection(V()))<0){
   const desired=Math.atan2(-direction.x,-direction.z);
   game.yaw+=THREE.MathUtils.clamp(Math.atan2(Math.sin(desired-game.yaw),Math.cos(desired-game.yaw)),-.12,.12);
  }else{
   const ndc=point.project(game.camera);
   game.yaw-=THREE.MathUtils.clamp(ndc.x,-1,1)*.12;
   game.pitch=THREE.MathUtils.clamp(game.pitch+THREE.MathUtils.clamp(ndc.y,-1,1)*.12,CAMERA_PITCH_MIN,CAMERA_PITCH_MAX);
  }
 };
 until(()=>{watchFreight();return game.physics.portalTransports>0;},4,'The free friend did not enter freight portal');
 until(()=>{watchFreight();return game.cargo.position.z>15&&game.cargo.position.y>11.9;},4,'The friend missed the freight arch');
 for(let n=0;n<120;n++){watchFreight();frame();}mark('the same free companion crosses the low freight window');
 walk(-12,23.8);until(()=>game.playerGrounded&&game.playerPosition.y<.1,4,'Freight apron return');
 walk(-23,26);aim(0,p.entry.getFrame().center);aim(1,p.observation.getFrame().center);enter(p.entry);
 walk(-19,8.55);aim(0,V(-16,.025,-23.2));walk(-16.6,8.55);aim(1,p['return-floor'].getFrame().center);mark('the reservoir is configured as a vertical return');
 walk(-27,12);walk(-27,8.5);walk(-27,-28);walk(-16,-29);
 mark('final flight');walk(-16,-26.15);const before=game.teleportCount;
 for(let n=0;n<300&&game.teleportCount===before;n++){worldMove(0,.32);frame();}stop();
 check(game.teleportCount>before,'Reservoir fall missed');mark('gravity returns the player above the atrium');
 aimMoving(d,0,p['far-exit'].getFrame().center,{seconds:3,keepPosition:{x:4,z:4},fireWhen:()=>game.playerPosition.y>20.5});mark('the airborne angle exposes the final exit');
 stop();until(()=>game.teleportCount>=before+2,3,'Second gravity transfer missed');mark('stored falling speed turns toward the receiving gallery');
 until(()=>game.playerGrounded,4,'Final gallery landing');check(game.playerPosition.y>11.9,'Final gallery missed: '+game.playerPosition.toArray());
 walk(game.cargo.position.x-1.1,game.cargo.position.z);pickup();mark('reunited');
 walk(21,21);until(()=>game.state==='won',3,'Atrium exit');
}
