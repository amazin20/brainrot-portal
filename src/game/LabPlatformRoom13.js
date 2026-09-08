import * as THREE from 'three';
import {Workshop} from './LabWorkshopKit.js';

export const ROOM13_SPEC = {
 id:'vertical-terraces',title:'Вертикальные террасы',
 concept:'Спираль террас и портальная смена высоты',
 description:'Поднимись с другом по разорванным террасам и открой новый ракурс на верхние керамические стены.',
 hints:['Белые стены связывают разные ярусы. Обходя двор по террасам, ты увидишь новые поверхности.',
  'Перед прыжком выбирай широкую площадку приземления. Нижний двор позволяет вернуться после промаха.',
  'Поднимись по западной лестнице, пройди нижнюю дугу и свяжи её с северной галереей. Верхняя дуга открывает проход к саду на крыше.'],
 accent:0xade2c5,assets:[1,2,11,22,23,24],
};

export function buildRoom13(game,index=12){
 const k=new Workshop(game,ROOM13_SPEC,index);
 k.shell({minX:-22,maxX:22,minZ:-25,maxZ:23},22);
 const w=k.world;
 w.materials.wall.color.setHex(0x6e877b);w.materials.floor.color.setHex(0x697e75);
 w.materials.trim.color.setHex(0x324941);game.scene.background=new THREE.Color(0x8fa99e);
 if(game.scene.fog)game.scene.fog.color.setHex(0x8fa99e);
 const stone=new THREE.MeshStandardMaterial({color:0xb9c7b4,roughness:.94});
 const soil=new THREE.MeshStandardMaterial({color:0x344b37,roughness:1});
 const foliage=new THREE.MeshStandardMaterial({color:0x6d9770,roughness:.95});
 const leafGeometry=new THREE.IcosahedronGeometry(.5,1);
 const terraces=[];
 function terrace(name,x0,x1,z0,z1,y){
  const f=w.floor(x0,x1,z0,z1,y,{name});
  // Recess the slab sides 5 cm behind the tile backing. Their vertical
  // height ranges overlap, so equal footprints caused a flickering fascia.
  w.box([(x0+x1)/2,y-.31,(z0+z1)/2],[x1-x0-.1,.4,z1-z0-.1],stone);
  const xs=x1-x0>6?[x0+.65,x1-.65]:[(x0+x1)/2];
  for(const x of xs)for(const z of [z0+.65,z1-.65]){
   w.box([x,(y-.51)/2,z],[.42,y-.51,.42],w.materials.trim);
   w.box([x,.09,z],[.8,.18,.8],stone);
  }
  // Wide planted terraces have visible columns, slab fascia and inset edge
  // lamps. The face is recessed from the sole collision/visual floor plane.
  for(const z of [z0+.07,z1-.07])w.box([(x0+x1)/2,y-.15,z],[x1-x0-.3,.08,.035],w.materials.accent,false);
  terraces.push({name,x0,x1,z0,z1,y});return f;
 }
 function planter(x,y,z,length=2.2){
  w.box([x,y+.24,z],[length,.48,.8],stone);
  w.box([x,y+.485,z],[length-.14,.03,.64],soil,false);
  for(let i=0;i<5;i++){
   const leaf=new THREE.Mesh(leafGeometry,foliage);leaf.scale.set(.72,.9+(i%3)*.25,.62);
   leaf.position.set(x-length*.38+i*length*.19,y+.77+(i%2)*.08,z);w.root.add(leaf);
  }
 }
 function wallAt(p,size){return w.box(p,size,stone);}
 // The recovery court stays continuous: every missed landing ends on a real
 // floor, and the west stair remains reachable with the original companion.
 terrace('west arrival terrace',-19,-13,5,13,2.4);
 terrace('lower north-south terrace',-11.1,-6.1,5,13,3.15);
 terrace('south garden terrace',-11.1,-4,14.8,20,3.9);
 terrace('lower viewing gallery',-2.2,5.8,14.8,20,4.65);
 const steps=10;
 for(let i=0;i<steps;i++){
  const z0=21-(i+1)*.8,z1=21-i*.8,y=(i+1)*2.4/steps;
  w.floor(-19,-15,z0,z1,y,{name:'west recovery stair'});
  w.box([-17,y/2-.08,(z0+z1)/2],[4,Math.max(.08,y-.16),.8],stone);
 }
 k.panel('terrace-entry',[1.8,6.95,20],[0,0,-1],8,4.6);
 terrace('north receiving gallery',-13,-5,-20,-11,8);
 k.panel('north-gallery',[-9,10.3,-20],[0,0,1],8,4.6);
 // Deep recess and high front apron hide this panel from the recovery court.
 // Its right doorway is offset from the ceramic: sightlines open only after
 // walking around the raised lower terraces, without any switch state.
 wallAt([-9,4.6,-10.9],[8.3,9.2,.2]);
 wallAt([-13.1,6.35,-15.5],[.2,12.7,9.2]);
 wallAt([-4.9,6.35,-16.8],[.2,12.7,6.4]);
 terrace('north middle terrace',-3.2,2,-14,-9,8.75);
 terrace('north-east terrace',3.8,9.8,-14,-9,9.5);
 terrace('east viewing gallery',3.8,12.8,-7.2,0,10.25);
 k.panel('high-entry',[12.8,12.55,-3.6],[-1,0,0],7.2,4.6);
 terrace('roof garden',-20,-12,-5.5,3.5,15);
 k.panel('roof-garden',[-20,17.3,-1],[1,0,0],9,4.6);
 wallAt([-11.9,7.8,-1],[.2,15.6,9.2]);
 wallAt([-16,9.8,-5.6],[8.2,19.6,.2]);
 wallAt([-16,9.8,3.6],[8.2,19.6,.2]);
 // Skylight piers and vertical translucent-looking luminous insets give each
 // height a shared architectural datum instead of floating puzzle islands.
 for(const x of [-21.7,21.7])for(const z of [-21,-5,11]){
  w.box([x,11,z],[.4,22,.55],stone);
  w.box([x+(x<0?.23:-.23),13,z],[.035,10,.1],w.materials.lamp,false);
 }
 for(const [x,y,z,len]of [[-18,2.4,6.4,1.4],[-8.6,3.15,6.2,2.5],[-8,3.9,19.1,3.2],
  [2.6,4.65,15.55,2.8],[-10,8,-18.9,2.8],[.3,8.75,-13.2,2.0],
  [7.3,9.5,-13.2,2.8],[6,10.25,-.85,2.8],[-16.1,15,2.6,3.5],
  [-5,0,-3,4],[4,0,7,4]])planter(x,y,z,len);
 // Broad spare ceramic zones serve experimentation and ordinary return trips.
 k.panel('court-west',[-21.97,2.3,17],[1,0,0],10,4.6);
 k.panel('court-east',[21.97,2.3,9],[-1,0,0],13,4.6);
 k.panel('court-north',[10,2.3,-24.97],[0,0,1],12,4.6);
 k.state.terraces=terraces;
 // Start in the open west aisle. Its rear clearance accommodates the normal
 // 6.5 m shoulder boom without moving walls or exposing new upper sightlines.
 return k.finish([-13,0,16],[-13,.55,14],[-14.7,15,-1],{workshop:k,platforming:true});
}

export async function runRoom13(d){
 const {game,level,walk,wait,pickup,aim,enter,mark}=d,p=level.panels;
 walk(-13,15);pickup();walk(-13,21.5);walk(-17,21.5);walk(-17,12);walk(-14.3,8);
 jump13(d,-13.48,8,-9.8,8,3.15,'first rising gap');
 walk(-8.5,11.7);jump13(d,-8.5,12.5,-8.5,16.3,3.9,'turn around the lower court');
 walk(-5.5,17.2);jump13(d,-4.5,17.2,-.8,17.2,4.65,'lower viewing gallery');
 mark('three carried jumps open the north gallery sightline');
 walk(1.8,17.2);game.interact();wait(1);walk(.5,18.2);
 aim(1,p['north-gallery'].getFrame().center.clone().add(new THREE.Vector3(0,.4,0)));aim(0,p['terrace-entry'].getFrame().center);
 collect13(d);
 enter(p['terrace-entry']);mark('portal crossing changes the court perspective');
 walk(-8,-12.35);walk(-6,-12.35);
 jump13(d,-5.48,-12.35,-1.9,-12.35,8.75,'north gallery gap');
 walk(.5,-11.2);jump13(d,1.5,-11.2,5.2,-11.2,9.5,'upper east terrace');
 walk(7.5,-10.4);jump13(d,7.5,-9.5,7.5,-5.8,10.25,'east viewing gallery');
 walk(11,-3.6);game.interact();wait(1);walk(10,-4.5);mark('six carried jumps reach the upper ceramic sightline');
 aim(1,p['roof-garden'].getFrame().center.clone().add(new THREE.Vector3(0,.4,0)));aim(0,p['high-entry'].getFrame().center);
 collect13(d);
 enter(p['high-entry']);mark('same friend arrives in the roof garden');walk(-14.7,-1);wait(.3);
}

function collect13(d){
 const c=d.game.cargo.position.clone(),a=d.game.playerPosition.clone().sub(c);a.y=0;
 if(a.length()<.01)a.z=1;a.normalize().multiplyScalar(1.1);
 d.walk(c.x+a.x,c.z+a.z);d.pickup();
}

/** Ordinary sprint run-up and Space; no pose/velocity or progression edits. */
export function jump13(d,fromX,fromZ,toX,toZ,height,label='terrace jump'){
 const {game,walk,worldMove,frame,stop,mark}=d;
 const dx=toX-fromX,dz=toZ-fromZ,length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
 walk(fromX-ux*.9,fromZ-uz*.9);stop();game.input.keys.add('ShiftLeft');
 for(let n=0;n<60;n++){
  worldMove(ux,uz);frame();
  if((game.playerPosition.x-fromX)*ux+(game.playerPosition.z-fromZ)*uz>=-.04)break;
 }
 game.input.jumpQueued=true;let airborne=false,landed=false;
 for(let n=0;n<100;n++){
  const distance=(toX-game.playerPosition.x)*ux+(toZ-game.playerPosition.z)*uz;
  worldMove(distance>.15?ux:0,distance>.15?uz:0);frame();
  if(!game.playerGrounded)airborne=true;
  if(airborne&&game.playerGrounded){landed=true;break;}
 }
 stop();
 if(!landed||Math.abs(game.playerPosition.y-height)>.16)throw new Error(`${label}: landing failed at ${game.playerPosition.toArray()}, expected ${height}`);
 mark(label);walk(toX,toZ);
}
