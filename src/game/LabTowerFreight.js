import * as THREE from 'three';
import {towerPoint,towerCoordinates} from './LabTowerLayout.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=THREE.MathUtils.clamp;

/** A warehouse above a real loading bay. The player can carry the original
 * companion up either stair, or place it on the lower hoist and climb alone.
 * In both cases the same body has to settle on the upper delivery plate and
 * be recovered before the wing's existing gate can open. */
export function buildTowerFreight({game,room,localBox,localFloor,materials}){
 const def=room.definition,{shell,dark,step,accent,amber,mint,glass}=materials;
 const box=(s,n,y,along,height,across,material,options)=>
  localBox(room,s,n,y,along,height,across,material,options);
 const deck=(s0,s1,n0,n1,y,material)=>localFloor(room,s0,s1,n0,n1,y,material);
 deck(11.4,27.6,6.03,25.6,0);
 deck(17.3,23.5,9.8,22.8,4.0,step);
 deck(11.8,27.1,22.5,25.6,4.0,step);
 box(19.5,25.72,3.8,16.3,7.6,.3,shell);
 for(const s of [11.25,27.75])box(s,15.85,3.8,.3,7.6,19.8,shell);
 box(19.5,15.8,7.72,16.4,.18,19.9,shell);
 // Two real stair flights connect opposite mouths. A carried companion can
 // take either route; the magnetic rail offers a separate split-traveller way.
 for(const s of [13.0,25.5]){
  for(let i=0;i<16;i++){
   const n=7.0+i,top=(i+1)*.25;
   deck(s-1.28,s+1.28,n,n+1,top,i%2?step:dark);
  }
  for(const side of [-1,1])box(s+side*1.37,15.0,2.25,.16,4.5,16.2,shell);
  box(s,15.1,4.7,2.75,.11,16.3,accent,{solid:false,camera:false,aim:false});
 }
 // A low retaining rim surrounds the upper cargo deck, leaving a deliberate
 // opening where the hoist's original rigid body enters from its shaft.
 for(const n of [11.25,20.4])box(17.25,n,4.55,.22,1.1,2.65,dark);
 box(20.4,9.72,4.52,6.0,1.04,.2,dark);
 box(16.0,18.45,2.5,.45,5.0,.45,shell);
 box(16.0,18.45,5.1,.75,.18,.75,accent,{solid:false,camera:false,aim:false});
 const sender=V(...towerPoint(def,16.0,15.25,def.baseY));
 const receiver=V(...towerPoint(def,21.55,16.0,def.baseY+4.0));
 box(16.0,15.25,.035,3.2,.05,3.2,dark,{solid:false,camera:false,aim:false});
 const senderLamp=box(16.0,15.25,.072,2.65,.045,2.65,amber,{solid:false,camera:false,aim:false});
 box(21.55,16.0,4.035,3.2,.05,3.2,dark,{solid:false,camera:false,aim:false});
 const receiverLamp=box(21.55,16.0,4.072,2.65,.045,2.65,amber,{solid:false,camera:false,aim:false});
 // Recessed track segments show the real transfer path above the open shaft.
 for(const s of [16.2,17.4,18.6,19.8,21])
  box(s,16.0,4.095,.08,.035,2.05,accent,{solid:false,camera:false,aim:false});
 let armed=false,delivered=false;
 function update(controlOn){
  const body=game.physics?.cargoBody;
  if(controlOn&&body&&!game.heldCube){
   const c=towerCoordinates(def,body.position);
   if(c.s>14.2&&c.s<17.7&&c.n>13.3&&c.n<17.2&&body.position.y<def.baseY+1.25
    &&game.physics.grounded&&Math.hypot(body.velocity.x,body.velocity.y,body.velocity.z)<1.1)
    armed=true;
  }
  delivered=!!game.cargoOnPad?.(receiver,1.35);
  senderLamp.material=armed?mint:amber;receiverLamp.material=delivered?mint:amber;
  return {armed,delivered};
 }
 function applyCargoForces(){
  const body=game.physics?.cargoBody;
  if(!armed||!body||game.heldCube||game.velocityCompanion?.connected)return;
  const c=towerCoordinates(def,body.position),base=def.baseY;
  if(c.s<13.8||c.s>23.3||c.n<12.8||c.n>18.6||body.position.y<base+.18||body.position.y>base+6.1)return;
  const [dx,dz]=def.direction,along=body.velocity.x*dx+body.velocity.z*dz;
  const lateral=body.velocity.x*(-dz)+body.velocity.z*dx;
  const shaft=c.s<17.3,raised=body.position.y>base+4.76;
  const targetS=shaft&&!raised?16.0:21.55,targetN=shaft&&!raised?15.25:16.0;
  const aS=clamp((targetS-c.s)*(shaft?18:20)-along*8,-48,48);
  const aN=clamp((targetN-c.n)*16-lateral*8,-36,36);
  body.force.x+=body.mass*(dx*aS-dz*aN);
  body.force.z+=body.mass*(dz*aS+dx*aN);
  // Only lift while the cargo is inside the open shaft. Once it reaches the
  // upper deck, normal gravity lets the original body settle on the plate.
  if(shaft){
   const targetY=base+4.85;
   body.force.y+=body.mass*clamp(19.5+(targetY-body.position.y)*15-body.velocity.y*8,0,67);
  }
  body.wakeUp();
 }
 function reset(){armed=delivered=false;senderLamp.material=receiverLamp.material=amber;}
 return {sender,receiver,dynamicMeshes:[senderLamp,receiverLamp],update,applyCargoForces,reset,
  getState:()=>({armed,delivered})};
}
