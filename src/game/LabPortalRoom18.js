import * as THREE from 'three';
import {Workshop} from './LabWorkshopKit.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const ROOM18_SPEC={id:'double-bottom',title:'Двойное дно',concept:'Два этажа одной шахты и обратный путь через собственный грузовой маршрут',description:'Выход остался за спиной. Один колодец ещё не закончил свою работу.',accent:0xd4b378,assets:[1,2,11,23,24],hints:['Высота — свойство маршрута. Одна и та же шахта может дать два разных пути.','В низком канале пройдёт друг. Лестница возвращается к той же шахте выше; за подъёмом скрыт поперечный путь.','Отправь друга через низкий канал. С верхнего края падай в пару напольных порталов, затем замени потраченный вход на боковую поверхность в полёте. С новой галереи осмотри выход с обратной стороны и вернись за другом.']};
export function buildRoom18(game,index=17){
 const k=new Workshop(game,ROOM18_SPEC,index),w=k.world;
 k.bounds={minX:-24,maxX:24,minZ:-24,maxZ:29};k.ceiling=30;
 w.walls(k.bounds,30,-1);w.floor(-24,24,-24,29,0,{name:'Continuous return foundation'});
 w.materials.wall.color.setHex(0x44545b);w.materials.floor.color.setHex(0x74817f);
 const deck=(name,x0,x1,z0,z1,y)=>w.floor(x0,x1,z0,z1,y,{name});
 const block=(p,s)=>w.box(p,s,w.materials.wall);
 const stair=(name,x0,x1,z0,z1,low,high)=>{const n=Math.ceil((high-low)/.25);for(let i=0;i<n;i++){const za=z0+(z1-z0)*i/n,zb=z0+(z1-z0)*(i+1)/n;deck(name,x0,x1,Math.min(za,zb),Math.max(za,zb),low+(high-low)*(i+1)/n);}};
 // The loading floor and upper corridor share a well, but never a shortcut to the receiver.
 deck('Freight loading floor',-5,5,9,15,8);deck('Loading crosswalk',-21,22,15,18,8);
 stair('Return foundation stair',-21,-18,28,18,0,8);
 stair('Rising east service corridor',18,22,15,-15,8,20);
 deck('Upper north turn',-3,22,-18,-15,20);deck('Upper return corridor',-3,-.3,-15,9,20);
 deck('Same well upper lip',-4,4,9,13,20);
 for(const x of [17.8,22.2])block([x,19,-1],[.3,22,32]);
 // The 1.5m waist-height sight gaps pass rays, but never the 2.4m capsule.
 for(const x of [-3.2,.2])block([x,23.05,-3.75],[.3,3.1,22.5]);
 block([9.5,22.3,-18.2],[25.5,4.6,.3]);block([9.5,22.3,-14.8],[18.5,4.6,.3]);
 block([0,22.3,13.2],[8.4,4.6,.3]);block([-4.2,22.3,11],[.3,4.6,4.5]);
 // This suspended divider hides the transverse exit until the rebound changes the viewpoint.
 block([-13.7,24.75,4.2],[20.6,10.5,.4]);
 // A cargo corridor: tall launch pocket, then one physically low throat.
 deck('Freight receiving shelf',-15,-9,-18,-1,11);
 block([-15.2,8,-11.5],[.3,16,13]);block([-8.8,8,-11.5],[.3,16,13]);
 block([-12,7.5,-18.2],[6.6,15,.3]);
 block([-12,15.025,-10.5],[6.4,4.75,.3]); // Bottom 12.65, cargo fits, player capsule does not.
 block([-12,18,-11.5],[6.6,.3,13]);
 // The turning gallery doubles back along the exterior of the freight tunnel.
 deck('Perpendicular receiver',-4,17,-3,3,11);
 deck('Reverse freight gallery',-9,-4,-3,-1,11);
 deck('Medium return lip',-22,-15,-5,-3,11);
 // Low-energy horizontal exits land safely in a recessed pocket, below its front sill.
 deck('Low-energy catch',-23.5,-16,-3,3,15);
 block([-15.9,15.2,0],[.3,.4,6]);block([-15.9,25.75,0],[.3,8.5,6]);
 block([-19.8,22,3.2],[7.7,14,.3]);block([-17.45,22,-3.2],[3,14,.3]);
 // Safe steps from the rejected-launch pocket return to the shared upper corridor.
 deck('Catch return bridge',-23,-19,-8,-3,15);
 // The 24m crest drops 4m to the ordinary corridor: recovery cannot be reversed.
 stair('Catch return rise',-23,-19,-8,-18,15,24);
 deck('Catch north reconnect',-23,-3,-21,-18,24);deck('Catch corridor return',-6,-3,-18,-15,24);
 block([-11,22.5,-11.8],[16,5,.3]);
 // Behind the entrance is a sealed receiving room. A standing capsule cannot
 // enter its 1.4m sight slot, but the far gallery can place a portal through it.
 deck('Hidden exit floor',8,17,19,29,7);
 block([12.5,9.2,18.8],[9.4,18.4,.4]);
 block([17.3,11,23.7],[.4,22,10]);
 block([7.8,7,23.7],[.4,14,10]);block([7.8,22.7,23.7],[.4,14.6,10]);
 block([12.5,21,23.7],[9.4,.4,10]);
 stair('Inspection stair',3,5,3,8,11,13);deck('Back-of-entrance inspection walk',3,5,8,26,13);
 block([2.8,20.5,16.25],[.3,19,19.5]);block([5.2,20.5,14.75],[.3,19,16.5]);
 block([5.2,12.5,24.5],[.3,3,3]);block([5.2,22.7,24.5],[.3,14.6,3]);
 block([4,17.2,16.25],[2.7,.3,19.5]);block([4,23.6,6.5],[2.7,12.8,.3]);
 block([6.4,7,24.5],[2.4,14,3]);block([6.4,22.7,24.5],[2.4,14.6,3]);
 // The suspended baffle makes a straight high-lip drop land on the return
 // foundation. Only the rebound rises on its northern side.
 block([-5.2,21.45,7.5],[3.6,17.1,.4]);block([1.7,21.45,7.5],[2.6,17.1,.4]);
 block([4,23,7.5],[2,14,.4]);block([11.5,21.45,7.5],[13,17.1,.4]);
 
 // All portals are functional: two uses of the common well, one rebound,
 // cargo delivery, a transverse flight, and the final medium return drop.
 k.panel('shared-well',[1.5,.025,7],[0,1,0],6,6);
 k.panel('rebound',[12,.025,6],[0,1,0],6,6);
 k.panel('freight',[-12,13.35,-17.97],[0,0,1],5.6,4.6);
 k.panel('turn',[-23.45,18.7,0],[1,0,0],5.6,3.8);
 k.panel('return-well',[-20,.025,0],[0,1,0],6,6);
 k.panel('home',[12.5,14.2,19.03],[0,0,1],5.6,4.6);
 const shelves=[{center:V(-12,11,-4.5),normal:V(0,1,0),right:V(1,0,0),up:V(0,0,1),halfWidth:3,halfHeight:3.5},{center:V(0,8,14),normal:V(0,1,0),right:V(1,0,0),up:V(0,0,1),halfWidth:5,halfHeight:4}];
 const level=k.finish([0,8,15],[1.8,8.55,14],[12.5,7,25],{workshop:k,portalPuzzle:true,cargoOnAnyPad:()=>shelves.some(f=>cargoLoadsPlate(game.cargo,game.heldCube,f))});
 level.puzzleGeometry={safeFloor:0,freightHeight:8,dropHeight:20,goalHeight:7,normalGaps:0,cargoWindow:{z:-10.5,minY:11,maxY:12.65},launchWindow:{x:-15.9,minY:15.4,maxY:21.5},footprint:48*53,portalRoles:{'shared-well':'one drop for cargo and player','rebound':'vertical change of viewpoint','freight':'cargo-only delivery','turn':'perpendicular access to the reverse gallery','return-well':'medium return fall carrying cargo','home':'exit behind the original entrance'},deductions:['one shaft has two energy states','separate the travellers through a low cargo throat','replace the spent portal during ascent','approach the freight receiver from its reverse gallery','shoot into the exit from a later sight slot','bring the same cargo back through a third fall'],orders:['cargo-first']};
 return level;
}
