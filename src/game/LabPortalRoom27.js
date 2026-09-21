import {Workshop} from './LabWorkshopKit.js';
import {buildRoom27Conveyors} from './LabRoom27Conveyors.js';
import {configureChapterWorld} from './LabChapterArt.js';
import {dressRoom27} from './LabRoom27Art.js';
export const ROOM27_SPEC={id:'conveyor-city',title:'Город обратных лент',concept:'Скорость движущегося пола становится высотой, а затем мостом; два обхода раскрывают оборотную сторону одного города',description:'Лента умеет больше, чем возить груз. Найди, куда может уйти её скорость.',accent:0xffb938,assets:[1,2,11,22,23,24],hints:['На цветной ленте движешься и ты, и оставленный друг. Белый пол внизу можно рассмотреть с обеих сторон.','Портал сохраняет скорость. Боковая галерея позволяет сохранить высоту, когда пара понадобится для другого пути.','Верхний обход открывает обратную сторону высокой белой стены. На дальнем острове нет портальной панели: туда нужно принести скорость с другой ленты.']};
export function buildRoom27(game,index=26){
 const k=new Workshop(game,ROOM27_SPEC,index),w=k.world;configureChapterWorld(w,'carnival',{openSky:true});w.highFidelity=true;k.bounds={minX:-26,maxX:24,minZ:-25,maxZ:23};k.ceiling=29;w.walls(k.bounds,29,-1);
 const deck=(name,x0,x1,z0,z1,y)=>w.floor(x0,x1,z0,z1,y,{name});
 const block=(p,s)=>w.box(p,s,w.materials.wall);
 deck('City shared recovery plaza',-26,24,-25,23,0);
 const belts=buildRoom27Conveyors(k);
 belts.belt('Saffron outbound ground belt',-13,-15,15,.08);
 // The side lanes allow both ends of a running belt to be inspected without
 // riding it. Both routes meet a broad, stationary experiment plaza.
 k.panel('ground-intake',[-13,2.38,-15.2],[0,0,1],5.6,4.6);
 const launch=k.panel('sky-well',[4,.025,3],[0,1,0],6,6);
 k.panel('gravity-post',[-4.6,.025,-10],[0,1,0],6,6);
 deck('Permanent sky-well balcony',6.5,17,-1,9,8);
 deck('Eastern upper return street',17,23,-22,14,8);
 deck('Upper freight loop south quay',8,17,9,14,8);
 deck('Upper belt inner inspection quay',10,13,-19,9,8);
 belts.belt('Turquoise upper return belt',15.3,-19,9,8.08,{width:4.6,speed:28});
 k.panel('upper-intake',[15.3,10.38,-19.2],[0,0,1],5.6,4.6);
 // An eight-metre stair is a folded observation route, not a powered lift.
 // Its upper court reveals the reverse-facing receiver behind a deep sill.
 for(let i=0;i<32;i++)deck('Folded observation steps',19,23,-10-i*.38,-9.62-i*.38,8+(i+1)*.25);
 deck('Cobalt observatory back street',3,23,-25,-22.16,16);
 deck('Reverse receiver approach',6,10,-22.16,3.5,16);
 deck('Quiet western observation spur',0,6,-12,-8,16);
 deck('Receiver launch hood floor',3,6,.8,3.5,16);
 k.panel('reverse-outlet',[10,18.3,0],[-1,0,0],5.8,4.6);
 block([10.3,14.5,0],[.4,29,7]);
 // This long, deep sill hides the bright face from every low plaza sight.
 block([8,15.75,0],[4,.35,7]);
 block([4.5,15.75,2.15],[3,.35,2.7]);
 block([6.5,24.4,3.7],[7,9.2,.35]);
 block([6.5,24.4,-3.7],[7,9.2,.35]);
 block([6.5,21,0],[7,.35,7.8]);
 deck('Far painted receiving island',-25,-9,-6,6,8);
 // No staircase or ceramic exists on this island; a slow portal exit falls
 // safely into the plaza, while the belt's retained momentum spans the gap.
 block([-25.2,10.3,0],[.35,4.6,12]);
 k.control('ground-reverse',[-19,0,15],()=>{belts.reversed=!belts.reversed;},'E — реверс всех лент');
 k.control('ground-brake',[-19,0,10],()=>{belts.braked=!belts.braked;},'E — общий тормоз лент');
 k.control('upper-reverse',[22,8,13],()=>{belts.reversed=!belts.reversed;},'E — реверс всех лент');
 k.control('upper-brake',[8.8,8,13],()=>{belts.braked=!belts.braked;},'E — общий тормоз лент');
 const roomArt=dressRoom27(k);
 const level=k.finish([-20,0,20],[-17,.55,20],[-18,8,0],{workshop:k,spec:ROOM27_SPEC,portalPuzzle:true,playerAcceleration:(p,v)=>belts.acceleration(p,v,{grounded:game.playerGrounded})});
 level.spawnView={yaw:0,pitch:-.12};
 level.roomArt=roomArt;
 level.puzzleGeometry={footprint:50*48,goalHeight:8,safeFloor:0,noProgressFlags:true,orders:['upper-belt-crossing','gravity-return-crossing'],portalRoles:{'ground-intake':'collect real contact speed from the reversible lower belt','sky-well':'turn the same horizontal momentum into a vertical launch','upper-intake':'borrow the portal pair after retaining height on the permanent city street','reverse-outlet':'the folded high street reveals a shielded outward face that transforms belt momentum into a bridge','gravity-post':'an alternative grounded address converts the sixteen-metre observation loop into a gravity-powered final crossing'},deductions:['a moving floor accelerates both travellers without holding them','reversal changes which end of the loop feeds a portal','up-facing ceramic rotates belt speed into height','a permanent side street preserves height after removing the launch pair','the rear observation loop exposes an address invisible from below','a walking-speed portal exit cannot cross the final open gap','the quiet upper spur can supply speed through height instead of a second motor'],stableCargoPockets:['Permanent sky-well balcony','Upper freight loop south quay']};
 level.conceptLesson={position:[-19,0,10],range:4,key:'↔',text:'Лента передаёт скорость только при касании. На боковой площадке можно остановиться, развернуться и спокойно выбрать выход.'};
 return level;
}
export {runRoom27} from './LabRoom27Journey.js';
