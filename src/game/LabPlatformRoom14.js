import * as THREE from 'three';
import {Workshop} from './LabWorkshopKit.js';

export const ROOM14_SPEC={id:'folded-flight-gallery',title:'Галерея перелётов',concept:'Два поворота инерции и разорванные балконы',description:'Высота разгоняет падение; порталы поворачивают скорость. Перенеси друга через две галереи и цепочку балконов.',hints:['Белая стена выпускает тебя поперёк первого зала. Нужна скорость падения с верхнего помоста.','После первого перелёта двигайся по отдельным балконам. У дальнего края начинается второй разгон, теперь вдоль другого зала.','Подготовь пол под первым помостом и стену напротив острова. Падай с другом, перепрыгни четыре разрыва, затем соедини второй колодец со стеной северной галереи. После второго перелёта останутся три прыжка к выходу.'],accent:0xf0c485,assets:[1,2,11,22,23,24]};

/** A folded inhabited gallery: all supports are physical, every miss reaches
 * a continuous service floor, and the exit tests only the two real actors. */
export function buildRoom14(game,index=13){
 const k=new Workshop(game,ROOM14_SPEC,index),w=k.world;
 const bounds={minX:-27,maxX:27,minZ:-27,maxZ:27};k.shell(bounds,18);
 w.materials.wall.color.setHex(0x535b5d);w.materials.floor.color.setHex(0x788382);
 const deck=(name,x0,x1,z0,z1,y)=>{
  const s=w.floor(x0,x1,z0,z1,y,{name});
  w.box([(x0+x1)/2,y-.28,(z0+z1)/2],[x1-x0,.32,z1-z0],w.materials.trim);
  for(const x of [x0+.45,x1-.45])for(const z of [z0+.45,z1-.45])
   w.box([x,(y-.44)/2,z],[.28,y-.44,.28],w.materials.trim);
  // Recessed luminous end caps identify the thickness without drawing arrows.
  for(const x of [x0+.06,x1-.06])w.box([x,y-.10,(z0+z1)/2],[.035,.055,z1-z0-.3],w.materials.accent,false);
  return s;
 };
 const stairs=(x0,x1,z0,z1,low,high)=>{
  const count=Math.ceil((high-low)/.26),dz=(z1-z0)/count;
  for(let i=0;i<count;i++){
   const a=z0+i*dz,b=a+dz,y=low+(high-low)*(i+1)/count;
   w.floor(x0,x1,Math.min(a,b),Math.max(a,b),y,{name:'Gallery service stair'});
   w.box([(x0+x1)/2,(y-.14)/2,(a+b)/2],[x1-x0,y-.14,Math.abs(dz)],w.materials.trim);
  }
 };
 deck('First fall overlook',-25,-14,20,25,7);stairs(-25,-22,3,20,0,7);
 const first=deck('East landing',1,9,11,19,5);
 const balcony1=deck('Long window balcony',2,8,5,9,5.4);
 const balcony2=deck('Crossing balcony',2,9,-1,3,5.8);
 const balcony3=deck('Corner balcony',5,12,-7,-3,6.2);
 const second=deck('North fall overlook',8,23,-14,-9,6.6);
 deck('North gallery landing',-1,9,-22,-15,6.5);
 deck('Window island',-8,-3,-22,-17,7);
 deck('Archive island',-15,-10,-21,-16,7.4);
 deck('Exit loggia',-25,-17,-24,-12,7.8);
 k.panel('gallery-drop-east',[-17,.025,17.5],[0,1,0],7,8);
 k.panel('gallery-launch-east',[-10,9,15],[1,0,0],8,6);
 k.panel('gallery-drop-north',[19,.025,-16.5],[0,1,0],7,7);
 k.panel('gallery-launch-north',[4,10,-6],[0,0,-1],8,6);
 // Solid masonry piers below the ceramic walls and slim frame uprights.
 w.box([-10.22,3,15],[.35,6,8],w.materials.wall);
 w.box([4,3.5,-5.78],[8,7,.35],w.materials.wall);
 for(const z of [10.8,19.2])w.box([-10.25,7.1,z],[.6,14.2,.45],w.materials.trim);
 for(const x of [-.2,8.2])w.box([x,7.7,-5.75],[.45,15.4,.6],w.materials.trim);
 w.box([-10.25,12.2,15],[.6,.4,8.8],w.materials.trim);
 w.box([4,13.2,-5.75],[8.8,.4,.6],w.materials.trim);
 // The central wall folds the sightline without closing the lower return aisle.
 w.surface({name:'Gallery divider',position:[-3,7,2],normal:[1,0,0],width:14,height:14});
 for(const x of [-26,26])for(const z of [-24,-12,0,12,24]){
  w.box([x,8,z],[.6,16,.6],w.materials.trim);
  w.box([x,15.5,z],[1.4,.3,4.4],w.materials.wall,false);
 }
 for(const z of [-24,-12,0,12,24])w.box([0,16.6,z],[52,.35,.35],w.materials.trim,false);
 // Inset service lane returns every fallen traveller to the stair.
 for(const z of [-24,-12,0,12,24])w.box([-20,.008,z],[.045,.012,9],w.materials.accent,false);
 const level=k.finish([-4,0,24],[-2,.55,24],[-21,7.8,-18],{workshop:k,platforming:true});
 level.platformRoute={jumps:7,gravityTransfers:2,landings:[first,balcony1,balcony2,balcony3,second],safeFloor:0};
 return level;
}

function check(ok,text){if(!ok)throw Error(text);}
/** Local ordinary jump helper: a real key press, movement and landing test. */
function jumpTo(d,x,z,label){
 const {game,frame,worldMove,stop}=d;check(game.playerGrounded,'Jump requires support: '+label);
 const takeoff=game.playerPosition.clone(),direction=new THREE.Vector3(x-takeoff.x,0,z-takeoff.z).normalize();
 d.walk(takeoff.x-direction.x*1.6,takeoff.z-direction.z*1.6);
 game.input.keys.add('ShiftLeft');
 for(let n=0;n<90;n++){
  const remaining=takeoff.clone().sub(game.playerPosition).dot(direction);
  if(remaining<.08)break;worldMove(direction.x,direction.z);frame();
 }
 const startY=game.playerPosition.y;let airborne=false,peak=startY;
 game.input.keys.add('Space');game.input.jumpQueued=true;
 for(let n=0;n<150;n++){
  const delta=new THREE.Vector3(x-game.playerPosition.x,0,z-game.playerPosition.z),distance=delta.length();
  if(distance>.08){delta.normalize().multiplyScalar(Math.min(1,distance*2.8));worldMove(delta.x,delta.z);}else worldMove(0,0);
  frame();game.input.keys.delete('Space');airborne||=!game.playerGrounded;peak=Math.max(peak,game.playerPosition.y);
  if(airborne&&game.playerGrounded){stop();check(game.playerPosition.y>startY-.2,'Missed balcony: '+label+' at '+game.playerPosition.toArray());check(peak>startY+.6,'Jump did not leave support');d.mark(label);return;}
 }
 throw Error('Landing timeout: '+label);
}
function fall(d,direction,label){
 const {game,worldMove,frame,stop,until}=d;const before=game.teleportCount;
 for(let n=0;n<300&&game.teleportCount===before;n++){worldMove(0,direction*.43);frame();}
 stop();check(game.teleportCount>before,'Fall missed portal: '+label);
 d.mark(label+' / gravity redirected');until(()=>game.playerGrounded,6,label+' landing');
 check(game.playerPosition.y>4.9,'Flight missed receiver: '+label+' at '+game.playerPosition.toArray());d.mark(label+' / landed');
}
export async function runRoom14(d){
 const {game,level,walk,aim,pickup,mark,until,wait}=d,p=level.panels;
 walk(-4,21);aim(1,p['gallery-launch-east'].getFrame().center);
 walk(-17,23);aim(0,p['gallery-drop-east'].getFrame().center);
 walk(-2,25.1);pickup();
 walk(-20,24);walk(-20,2);walk(-23.5,2);walk(-23.5,22);
 walk(-17,22);walk(-17,20.25);fall(d,-1,'first transverse flight');
 walk(5,11.5);jumpTo(d,5,8.1,'jump 1 / window balcony');
 walk(5,5.5);jumpTo(d,5,2.1,'jump 2 / crossing balcony');
 walk(7,-.5);jumpTo(d,7,-3.9,'jump 3 / corner balcony');
 walk(10,-6.5);jumpTo(d,10,-9.9,'jump 4 / north overlook');
 walk(17,-11.5);game.interact();wait(1);
 walk(19,-11);aim(1,p['gallery-launch-north'].getFrame().center);
 walk(22.5,-13.7);aim(0,p['gallery-drop-north'].getFrame().center);
 walk(game.cargo.position.x,game.cargo.position.z+1.1);pickup();walk(19,-13.75);fall(d,-1,'second longitudinal flight');
 walk(-.5,-19);jumpTo(d,-3.9,-19,'jump 5 / window island');
 walk(-7.5,-19);jumpTo(d,-10.9,-19,'jump 6 / archive island');
 walk(-14.5,-19);jumpTo(d,-17.9,-19,'jump 7 / exit loggia');
 walk(-21,-18);until(()=>game.state==='won',3,'Gallery exit');mark('both reached the loggia');
}
