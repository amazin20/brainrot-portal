import * as THREE from 'three';
import {Workshop,V,tracePortalRay} from './LabWorkshopKit.js';
import {airAcceleration} from './LabAirForces.js';
import {LabAirflowVisual} from './LabAirflowVisual.js';

export const ROOM16_SPEC={
 id:'aerial-archipelago',title:'Воздушный архипелаг',
 concept:'Островные террасы, укрытия и постоянный воздух через порталы',
 description:'Пройди с другом островные террасы. Свяжи поток воздуха с белым островом и поднимись к верхней галерее.',
 hints:['Внизу безопасный двор: после промаха можно вернуться к широкой южной лестнице.',
  'Ветер дует постоянно. За сплошной стеной тихо; белая поверхность позволяет направить поток через портал.',
  'Дойди по островам до продуваемой террасы. Портал на её стене направит воздух вверх из белого острова. Наверху выйди из струи к галерее.'],
 accent:0x92ddde,assets:[1,2,11,22,23,24],
};

/** No switches, receivers or progression flags: the architecture, ordinary
 * jump and one permanently moving body of air are the complete puzzle. */
export function buildRoom16(game,index=15){
 const k=new Workshop(game,ROOM16_SPEC,index),w=k.world;
 // The entrance forecourt leaves the full ordinary camera boom behind the
 // stair approach. No camera timing or player visibility override is needed.
 k.shell({minX:-23,maxX:23,minZ:-28,maxZ:36},22);
 w.materials.wall.color.setHex(0x738e94);w.materials.floor.color.setHex(0x738788);
 w.materials.trim.color.setHex(0x30494e);w.materials.lamp.color.setHex(0xe6ffff);
 game.scene.background=new THREE.Color(0xb8d5db);if(game.scene.fog)game.scene.fog.color.setHex(0xb8d5db);
 w.root.name='Воздушный архипелаг / open island court';
 const stone=new THREE.MeshStandardMaterial({color:0xa8b9b5,roughness:.78});
 const pale=new THREE.MeshStandardMaterial({color:0xc4d7cd,roughness:.7});
 const islandData=[[-14,18,3],[-4,16.5,3.35],[6,15,3.7],[16,13.5,4.05],[16,3.5,4.4],[16,-6.5,4.75],[5.8,-6.5,5.1]];
 const islands=[];
 function island(name,x,z,y,width=7.8,depth=7.8,portal=false){
  const top=w.floor(x-width/2,x+width/2,z-depth/2,z+depth/2,y,{name,portal});
  const footing=.55;
  // Recessed edge girders leave the ceramic portal face and its backing clear.
  for(const sx of [-1,1])w.box([x+sx*(width/2-.18),y-.31,z],[.36,.48,depth],stone);
  for(const sz of [-1,1])w.box([x,y-.31,z+sz*(depth/2-.18)],[width,.48,.36],stone);
  for(const sx of [-1,1])for(const sz of [-1,1]){
   const cx=x+sx*(width/2-.65),cz=z+sz*(depth/2-.65);
   w.box([cx,(y-.55)/2,cz],[.5,y-.55,.5],stone);
   w.box([cx,.12,cz],[footing+.35,.24,footing+.35],w.materials.trim);
  }
  const rec={name,x,z,y,width,depth,top};islands.push(rec);return rec;
 }
 islandData.forEach(([x,z,y],i)=>island('Остров '+(i+1),x,z,y));
 // Broad, sealed treads: no negative depth, duplicate top or floating riser.
 for(let i=0;i<12;i++){
  const a=27-i*.43,b=a-.43,y=(i+1)*.25;
  w.floor(-17,-11,b,a,y,{name:'Южная лестница '+i});
  w.box([-14,(y-.12)/2,(a+b)/2],[6,y-.12,.43],stone);
 }
 w.floor(-17,-11,21.9,22.05,3,{name:'Стык лестницы'});
 // Shelter walls alternate with open jumping lanes. They are physical cover
 // for both capsules and air, with broad openings toward the next island.
 for(const i of [0,2,4]){
  const a=islands[i],side=i===0?-1:1;
  if(i===2){
   w.box([a.x,a.y+1.5,a.z+3.72],[5.4,3,.16],pale);
   w.box([a.x-1,a.y+3.08,a.z+2.8],[3.5,.16,2],pale);
  }else{
   w.box([a.x+side*3.72,a.y+1.5,a.z],[.16,3,5.4],pale);
   w.box([a.x+side*2.8,a.y+3.08,a.z],[2,.16,3.5],pale);
  }
 }
 // A side ceramic field can be repurposed from the middle of the route; its
 // high position still requires reaching the island chain from the courtyard.
 k.panel('island-shelter',[16,6.95,-10.42],[0,0,1],7.1,4.3);
 k.panel('wind-catch',[5.8,7.25,-2.53],[0,0,-1],7.6,4.3);
 const lift=island('Белый воздушный остров',-8,-6.5,5.1,8,8,true);
 k.panels['air-island']=lift.top;
 // A high destination is reachable by sustained redirected air, not a secret
 // impulse or a gate. The clear front edge permits steering out of the plume.
 island('Верхняя галерея',-8,-14,13.25,10,7.4);
 for(const x of [-12.92,-3.08])w.box([x,13.9,-14],[.16,1.3,7.4],pale);
 w.box([-8,13.9,-17.62],[10,1.3,.16],pale);
 for(const x of [-12,-4]){
  w.box([x,16,-17.1],[.32,5.5,.32],stone);
  w.box([x,18.8,-15.1],[.4,.32,4.3],stone);
 }
 w.box([-8,18.8,-17.1],[8.4,.32,.4],stone);
 // A built-in ventilation opening communicates an environmental current.
 // Its housing is outside the active path; every grate bar is actual geometry.
 const origin=V(5.8,7.25,-17),direction=V(0,0,1);
 w.box([5.8,6,-17.9],[5,12,.8],stone);
 w.box([5.8,7.25,-17.4],[4.1,4.1,.25],w.materials.trim);
 for(let i=-3;i<=3;i++)w.box([5.8+i*.48,7.25,-17.22],[.085,3.6,.08],pale,false);
 for(const y of [5.35,9.15])w.box([5.8,y,-17.1],[4.1,.18,.4],pale);
 const flow=new LabAirflowVisual(w.root,{capacity:168,radius:1.65,speed:6});
 const air={origin,direction,segments:[],flow,speed:14,enabled:true};k.state.ambientAir=air;
 const update=dt=>{air.segments=tracePortalRay(game,origin,direction,{medium:'air',length:70});flow.step(dt,1);flow.setPath(air.segments,game.portals?.portals||[]);};
 k.ticks.push(update);k.renders.push(a=>flow.render(a,game.quality?.shadows===false?'low':'balanced'));
 k.resets.push(()=>{air.enabled=true;air.segments=[];flow.reset();});
 const acceleration=(p,v)=>airAcceleration(air.segments,p,v,{strength:1,speed:air.speed,radius:flow.radius,response:5,maximum:70});
 k.forces.push(()=>{if(game.heldCube||!game.physics?.cargoBody)return;const b=game.physics.cargoBody,a=acceleration(game.cargo.position,game.cargo.velocity);b.force.x+=a.x*b.mass;b.force.y+=a.y*b.mass;b.force.z+=a.z*b.mass;if(a.lengthSq())b.wakeUp();});
 // Repeated clerestories and attached ribs make the large room a bright court,
 // while the lower floor remains a readable, continuous recovery promenade.
 for(const z of [-23,-13,-3,7,17])for(const x of [-22.8,22.8]){
  w.box([x,12,z],[.22,15,.38],stone);
  w.box([x*0.993,17,z],[.06,5.5,6],new THREE.MeshBasicMaterial({color:0xb4dadd}),false);
 }
 for(const x of [-19.5,-.5,20.5])w.box([x,.011,-1],[.045,.02,48],w.materials.accent,false);
 Object.assign(k.state,{islands,routeJumps:6,permanentWind:true});
 return k.finish([-14,0,28],[-12.8,.55,28],[-8,13.25,-14],{
  workshop:k,platforming:true,playerAcceleration:(p,v)=>acceleration(p.clone().add(V(0,1.1,0)),v),
 });
}

export async function runRoom16(d){
 const {game,level,walk,wait,pickup,aim,until,worldMove,frame,stop,mark}=d;
 function jumpTo(x,z){
  const start=game.playerPosition.clone(),v=V(x-start.x,0,z-start.z).normalize();
  game.input.keys.add('ShiftLeft');for(let n=0;n<18;n++){worldMove(v.x,v.z);frame();}
  game.input.keys.add('Space');game.input.jumpQueued=true;let airborne=false;
  for(let n=0;n<120;n++){
   const delta=V(x-game.playerPosition.x,0,z-game.playerPosition.z),distance=delta.length();
   delta.normalize().multiplyScalar(Math.min(1,distance*1.6));worldMove(delta.x,delta.z);frame();
   if(n===0)game.input.keys.delete('Space');if(!game.playerGrounded)airborne=true;
   if(airborne&&game.playerGrounded){stop();if(game.playerPosition.y<start.y-.05)throw Error('Island jump fell into the lower court');walk(x,z);wait(.12);return;}
  }
  stop();throw Error('Island landing timed out');
 }
 walk(-13.4,27);pickup();walk(-14,26.5);walk(-14,18);
 walk(-11.8,17.4);jumpTo(-6.8,16.5);walk(-1.8,15.9);jumpTo(3.2,15);
 walk(8.2,14.4);jumpTo(13.2,13.5);walk(16,11.3);jumpTo(16,6.3);
 walk(16,1.3);jumpTo(16,-3.7);walk(13.8,-6.5);jumpTo(8.7,-6.5);
 mark('six island gaps crossed with the same friend');
 walk(8.6,-8);game.interact();wait(.8);aim(0,level.panels['wind-catch'].getFrame().center);
 aim(1,level.panels['air-island'].getFrame().center);
 pickup();
 mark('permanent airflow passes through the portal pair');
 const before=game.teleportCount;
 for(let n=0;n<360&&game.teleportCount===before;n++){
  worldMove(THREE.MathUtils.clamp((5.8-game.playerPosition.x)*2,-1,1),.3);frame();
 }
 stop();if(game.teleportCount===before)throw Error('The wind-fed wall portal was not entered');
 until(()=>game.playerPosition.y>14.2,5,'Redirected air did not lift player and friend');
 mark('sustained air raised both above the gallery');
 walk(-8,-14);wait(.3);
}
