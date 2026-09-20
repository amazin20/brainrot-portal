import {Workshop} from './LabWorkshopKit.js';
import {buildRoom23Balance} from './LabRoom23Mechanics.js';
export const ROOM23_SPEC={id:'counterweight-reversal',title:'Вес возвращения',concept:'Один груз опускает дальнюю кабину и поднимает ближнюю; постоянный карман освобождает тот же противовес для обратного рейса',description:'Кабины связаны. Чтобы подняться вместе, сначала придётся развести груз, опору и пассажира по разным местам.',accent:0xd9bb87,assets:[1,2,11,22,23,24],hints:['Грузовой приёмник направлен в дальнюю кабину. Ступень высоты сохраняется на неподвижной галерее.','Тормоз удерживает обе кабины, пока ты меняешь место друга. Поднять его внутри кабины недостаточно: она всё ещё несёт тот же вес.','Оставь друга на белом полу постоянного кармана, войди в разгруженную дальнюю кабину и отпусти тормоз. С верхнего обхода можно вернуть друга через пол кармана.']};
export function buildRoom23(game,index=22){
 const k=new Workshop(game,ROOM23_SPEC,index),w=k.world;w.highFidelity=true;k.bounds={minX:-23,maxX:23,minZ:-23,maxZ:22};k.ceiling=29;w.walls(k.bounds,29,-1);
 const deck=(name,x0,x1,z0,z1,y)=>{w.floor(x0,x1,z0,z1,y,{name});w.box([(x0+x1)/2,y-.28,(z0+z1)/2],[x1-x0,.32,z1-z0],w.materials.trim);};
 const block=(p,s)=>w.box(p,s,w.materials.wall);
 deck('Counterweight recovery court',-23,23,-23,22,0);
 deck('West permanent disembarkation',-16,-6,-4,-.5,10);
 deck('Folded middle return',-20,20,-12,-4,10);
 deck('East permanent disembarkation',5,16,-4,-.5,10);
 deck('East side boarding ledge',5,8,-4,6,10);
 // The middle receiving pocket faces away from the low start; the upper
 // gallery is the first view that can see the floor inside its casing.
 deck('Freight storage pocket',-3,3,-11,-5,10);
 block([0,11.0,-4.8],[6.4,2,.35]);block([0,11.0,-11.2],[6.4,2,.35]);
 const pocket=k.panel('middle-pocket',[0,10.025,-8],[0,1,0],5.6,5.6);
 const balance=buildRoom23Balance(k);
 // A cargo-only throat points onto the original distant carriage. Its low
 // hood is solid: a standing traveller cannot materialise through it.
 k.panel('freight-throat',[11,21.0,-1.5],[0,0,1],5.6,4.6);
 block([11,10,-1.85],[6.4,20,.6]);block([11,25.45,1.8],[6.4,7.1,3.5]);
 for(const x of [7.65,14.35])block([x,24.5,.8],[.3,9,5.5]);
 // Low floor views into the upper arrival are sealed. The reverse wall
 // receiver can be seen only after riding the unloaded car to its top stop.
 deck('High car exit apron',7,17,6.6,10,20);
 deck('Upper return around the shaft',15,22,-19,10,20);
 deck('High receiving gallery',-5,22,-23,-17,20);
 block([14.8,9.9,-3.5],[.35,19.8,27]);
 block([0,14.5,-17],[10,29,.4]);block([-5.2,14.5,-20],[.4,29,6]);block([5.2,9.9,-20],[.4,19.8,6]);block([5.2,26.5,-20],[.4,5,6]);
 k.panel('high-return',[-4.85,22.3,-20],[1,0,0],5.6,4.6);
 // A reversible clamp is available from the middle landing and the empty
 // ascending car, so no timing jump or invisible latch is needed.
 k.control('balance-brake',[7.4,10,4.5],()=>{balance.braked=!balance.braked;},'E — тормоз обеих кабин');
 k.control('ground-brake-release',[-18,0,11],()=>{balance.braked=false;},'E — освободить общий тормоз для возврата кабин');
 const level=k.finish([-17,0,15],[-11,.6,3],[0,20,-20],{workshop:k,spec:ROOM23_SPEC,portalPuzzle:true,balance,cargoOnAnyPad:()=>balance.west.loaded()||balance.east.loaded()||k.pads.some(p=>p.loaded())||(!game.heldCube&&Math.abs(game.cargo.position.y-10.45)<.3&&Math.abs(game.cargo.position.x)<3&&game.cargo.position.z<-5&&game.cargo.position.z>-11)});
 level.spawnView={yaw:0,pitch:-.15};
 level.mechanismArt={liftSurfaces:['west-load-car','east-load-car']};
 level.puzzleGeometry={footprint:46*45,occupiedHeights:[0,10,20],orders:['receiver-first','floor-first'],noProgressFlags:true,portalRoles:{'west-load-car':'floor aperture below the original load on the near car','east-load-car':'the same distant weighted carriage later carries the player upward','freight-throat':'cargo-only delivery to the distant high car','middle-pocket':'permanent storage preserves cargo while the counterweight reverses','high-return':'final retrieval from the reverse high gallery'},deductions:['opposite car motion exchanges height instead of creating an unlocked stage','send the original load ahead while riding its opposite car','a physical brake preserves both occupied heights','lifting the load inside its car does not unload the transmission','the fixed middle pocket frees the same high car for its return','retrieve the original load through its resting floor from the newly reached viewpoint']};
 return level;
}
export {runRoom23} from './LabRoom23Journey.js';
