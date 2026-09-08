import * as THREE from 'three';
import { Workshop } from './LabWorkshopKit.js';
export const ROOM12_SPEC = {
 id:'rift-atrium',title:'Разлом',concept:'Расколотый атриум: карнизы, высота падения и длинный перелёт',
 description:'Пройдите разорванные карнизы вместе с другом. Превратите высоту в скорость и перелетите на другую сторону атриума.',
 hints:['На карнизах есть место для разбега. Прыгайте с другом через настоящие разрывы настила.','Керамика внизу колодца принимает скорость падения. Наклонная керамика у разлома направляет её к дальнему берегу.','Нижний обход безопасен и возвращает к лестнице. После перелёта продолжайте по восточной галерее.'],
 accent:0x8cd9d0,assets:[1,2,11,22,23,24]
};
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const ROOM12_LEDGES = Object.freeze(Array.from({length:7},(_,i)=>({x:-17+(i%2?.55:0),z:14-i*5.4,y:5.5+i}))); 
/** The whole lower court is a recovery route. Only the upper ledges reach the
 * fall well, and its speed is redirected by an ordinary static portal face. */
export function buildRoom12(game,index=11){
 const k=new Workshop(game,ROOM12_SPEC,index),w=k.world;
 const bounds={minX:-24,maxX:24,minZ:-30,maxZ:30};k.shell(bounds,23);
 w.materials.wall.color.setHex(0x4b5961);w.materials.floor.color.setHex(0x6d7b7d);w.materials.trim.color.setHex(0x253a45);
 const rust=new THREE.MeshStandardMaterial({color:0x957d61,roughness:.84,metalness:.13});
 const dark=new THREE.MeshStandardMaterial({color:0x334550,roughness:.72,metalness:.18});
 const deck=(x0,x1,z0,z1,y,name)=>{
  const a=w.floor(x0,x1,z0,z1,y,{name});
  w.box([(x0+x1)/2,y-.36,(z0+z1)/2],[x1-x0,.40,z1-z0],dark);
  // The bright front edge identifies a landing, without a floating arrow.
  w.box([(x0+x1)/2,y-.06,z1-.08],[x1-x0-.18,.045,.05],w.materials.accent,false);
  return a;
 };
 function stair(x0,x1,front,back,top){
  const n=Math.ceil(top/.28),dz=(front-back)/n;
  for(let i=0;i<n;i++){
   const z1=front-i*dz,z0=z1-dz,y=top*(i+1)/n;
   w.floor(x0,x1,z0,z1,y,{name:'West return stair'});
   w.box([(x0+x1)/2,(y-.13)/2,(z0+z1)/2],[x1-x0,Math.max(.03,y-.13),dz-.02],dark);
  }
 }
 stair(-20,-15,27,16,5.5);
 for(const [i,p] of ROOM12_LEDGES.entries()){
  const half=i===6?3.0:2.55;
  if(i<6)deck(p.x-half,p.x+half,p.z-2,p.z+2,p.y,`Broken west gallery ${i+1}`);
  // Wide cantilever ribs visibly connect every remnant to the side wall;
  // their tops stay below the walkable surface, so they cannot bridge gaps.
  for(const z of [p.z-1.35,p.z+1.35]){
   w.box([(-24+p.x)/2,p.y-.76,z],[p.x+24,.4,.26],rust);
   w.box([-23.8,p.y-1.4,z],[.38,1.7,.45],dark);
  }
  w.box([p.x-half-.06,p.y+.62,p.z],[.12,1.24,3.7],dark);
 }
 // The overlook is the final ledge. A real unguarded inner edge overhangs
 // the floor address; neither an actuator nor a scripted impulse is used.
 deck(-20,-13,-21,-16.4,11.5,'Fall overlook');
 for(const z of [-20.9])w.box([-16.5,12.1,z],[6.9,1.2,.12],dark);
 k.panel('rift-fall',[-10.4,.025,-18.5],[0,1,0],5.2,5.6);
 const fling=k.panel('rift-fling',[-4.5,3.2,-18.5],[.64278761,.766044443,0],5.6,5.2);
 fling.collider.frontPlane=fling.getFrame;
 fling.collider.walkablePlane=true;fling.collider.solidUnderside=true;
 const slopeFloor={minX:fling.collider.box.min.x,maxX:fling.collider.box.max.x,minZ:fling.collider.box.min.z,maxZ:fling.collider.box.max.z,y:3.2,mesh:fling.mesh,enabled:true,
  heightAt(x,z){const f=fling.getFrame(),y=f.center.y-(x-f.center.x)*f.normal.x/f.normal.y,local=V(x,y,z).sub(f.center);return Math.abs(local.dot(f.right))<=f.halfWidth&&Math.abs(local.dot(f.up))<=f.halfHeight?y:null;},
  normalAt:()=>fling.getFrame().normal};
 game.floors.push(slopeFloor);w.floors.push(slopeFloor);
 // Cannon receives the same oriented 20 cm ceramic backing as the player
 // plane. This avoids an invisible upright box around the inclined face.
 k.resets.push(()=>{
  const item=game.physics?.solids.get(fling.mesh.uuid);if(!item)return;
  const body=item.body,shape=body.shapes[0];shape.halfExtents.set(fling.width/2,fling.height/2,.1);
  shape.updateConvexPolyhedronRepresentation();shape.updateBoundingSphereRadius();
  const position=fling.mesh.getWorldPosition(V()),rotation=fling.mesh.getWorldQuaternion(new THREE.Quaternion());
  body.position.copy(position);body.quaternion.copy(rotation);body.previousPosition.copy(body.position);body.previousQuaternion.copy(body.quaternion);
  body.updateBoundingRadius();body.updateMassProperties();body.aabbNeedsUpdate=true;game.physics.world.broadphase.dirty=true;
 });
 // Ceramic is carried by a fixed architectural ramp, visibly grounded.
 // Narrow supports remain behind its front plane and do not fill the hole.
 const q=fling.group.quaternion;
 for(const sx of [-2.92,2.92]){
  const local=V(sx,0,-.3),point=local.applyQuaternion(q).add(fling.group.position);
  const beam=w.box(point.toArray(),[.17,5.7,.22],rust,false);beam.quaternion.copy(q);
 }
 w.box([-5.45,1.3,-18.5],[2.8,2.6,4.8],dark);
 // The far bank is intentionally beyond ordinary jump range. Its underside
 // hides the top; there is no high wall address that skips the gravity arc.
 deck(8,20,-24,-12,8.2,'Eastern receiving court');
 for(const x of [8.45,19.55])for(const z of [-23.5,-12.5])w.box([x,3.81,z],[.64,7.62,.64],rust);
 for(const x of [8.35,19.65])w.box([x,8.77,-18],[.12,1.14,11.8],dark);
 w.box([14,8.77,-24],[12,1.14,.12],dark);
 // Three broad, offset remnants continue along the opposite canyon wall.
 const east=[{x:15.5,z:-7.7,y:8.2},{x:17.1,z:-1.7,y:8.2},{x:15.5,z:4.3,y:8.2}];
 for(const [i,p] of east.entries()){
  deck(p.x-3,p.x+3,p.z-2.3,p.z+2.3,p.y,`Eastern stepping gallery ${i+1}`);
  for(const z of [p.z-1.5,p.z+1.5])w.box([(p.x+24)/2,7.63,z],[24-p.x,.34,.34],rust);
  w.box([p.x+3.05,8.8,p.z],[.12,1.2,4.4],dark);
 }
 deck(11,21,8,18,8.2,'Exit terrace');
 for(const x of [11.4,20.6])for(const z of [8.4,17.6])w.box([x,3.82,z],[.6,7.64,.6],rust);
 for(const x of [10.95,21.05])w.box([x,8.8,13],[.12,1.2,10],dark);
 w.box([16,8.8,18.05],[10,1.2,.12],dark);
 // Inactive structural ribs and service balconies give the tall court scale.
 // The lower ribbon remains unobstructed so every missed jump is recoverable.
 for(const z of [-26,-9,8,25]){
  for(const x of [-23.6,23.6]){
   w.box([x,10.7,z],[.55,21.4,.65],rust);
   w.box([x+(x<0?.36:-.36),11,z],[.12,7,.15],w.materials.lamp,false);
  }
  w.box([0,21.8,z],[47.5,.65,.65],dark,false);
 }
 // Recessed canyon drainage strip is cosmetic and has a continuous collider
 // underneath. It never respawns a player or destroys their companion.
 for(const z of [-24,-16,-8,0,8,16,24]){
  w.box([2,.009,z],[3,.018,6.8],dark,false);
  for(const x of [.7,3.3])w.box([x,.022,z],[.06,.024,6.6],w.materials.accent,false);
 }
 k.panel('west-recovery',[-23.97,2.4,9],[1,0,0],12,4.8);
 k.panel('east-recovery',[23.97,2.4,10],[-1,0,0],12,4.8);
 k.panel('arrival-wall',[-15,2.4,29.97],[0,0,-1],14,4.8);
 k.panel('far-court-wall',[14,2.4,-29.97],[0,0,1],14,4.8);
 return k.finish([-17,0,28.2],[-18.5,.55,27.8],[16,8.2,14.5],{
  workshop:k,platforming:true,
  diagnostics:()=>({level:index+1,id:ROOM12_SPEC.id,concept:ROOM12_SPEC.concept,portalSurfaces:game.portalPanels.length,models:[],noCheckpoints:true,platforming:true,gravityOnly:true,ledges:10})
 });
}
const check=(v,m)=>{if(!v)throw new Error(m);};
/** An ordinary running jump. Steering follows the visible landing center;
 * Space is consumed by the same buffered input as the player's keyboard. */
function jump(d,x,z,y,label){
 const {game,walk,worldMove,frame,stop,mark}=d;
 const start=game.playerPosition.clone(),to=V(x,0,z),dir=to.clone().sub(start);dir.y=0;dir.normalize();
 game.input.keys.add('ShiftLeft');
 // Establish a run before pressing Space. The chosen takeoff is well inside
 // the current ledge so the same route works with the held friend's mass.
 for(let n=0;n<9;n++){worldMove(dir.x,dir.z);frame();}
 game.input.jumpQueued=true;game.input.keys.add('Space');
 let airborne=false;
 for(let n=0;n<150;n++){
  const delta=to.clone().sub(game.playerPosition);delta.y=0;
  const dist=delta.length();if(dist>.05){delta.normalize().multiplyScalar(Math.min(1,dist*1.8));worldMove(delta.x,delta.z);}else worldMove(0,0);
  frame();if(!game.playerGrounded)airborne=true;
  if(airborne&&game.playerGrounded){stop();check(Math.abs(game.playerPosition.y-y)<.12,`${label}: missed landing at ${game.playerPosition.toArray()}`);walk(x,z);mark(label);return;}
 }
 stop();throw new Error(`${label}: jump did not land from ${start.toArray()}`);
}
export async function runRoom12(d){
 const {game,level,walk,aim,frame,worldMove,stop,pickup,mark,until}=d,p=level.panels;
 // Aim both physical faces from the lower court before climbing. The player
 // carries the original friend throughout the route, including the flight.
 walk(-10.4,28);walk(-10.4,-14);aim(0,p['rift-fall'].getFrame().center);
 walk(1,-11.5);aim(1,p['rift-fling'].getFrame().center);
 walk(1,28);for(let n=0;n<3;n++){const friend=game.cargo.position.clone();walk(friend.x+1.05,friend.z);}pickup();walk(-17,28);walk(-17,26.4);walk(-17,14.7);
 mark('arrived at the broken western gallery');
 for(let i=1;i<ROOM12_LEDGES.length;i++){
  const a=ROOM12_LEDGES[i-1],b=ROOM12_LEDGES[i];
  walk(b.x,a.z-1.15);jump(d,b.x,b.z+.55,b.y,`western gap ${i}`);
 }
 walk(-16.45,-18.5);walk(-13.55,-18.5);
 const before=game.teleportCount;
 for(let n=0;n<240&&game.teleportCount===before;n++){worldMove(.43,0);frame();}
 stop();check(game.teleportCount>before,'Fall did not enter the prepared floor address');
 mark('gravity speed redirected across the atrium');
 until(()=>game.playerGrounded,6,'The gravity arc did not land');
 check(game.playerPosition.y>8.1&&game.playerPosition.x>8,'The flight missed the eastern court');mark('landed on the opposite bank');
 walk(15.5,-12.85);jump(d,15.5,-8.5,8.2,'eastern gap 1');
 walk(17.1,-6.25);jump(d,17.1,-2.5,8.2,'eastern gap 2');
 walk(15.5,-.25);jump(d,15.5,3.5,8.2,'eastern gap 3');
 walk(15.5,5.7);jump(d,15.5,8.8,8.2,'exit terrace gap');
 walk(16,14.5);
}
