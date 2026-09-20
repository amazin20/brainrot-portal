import {Workshop} from './LabWorkshopKit.js';
import {buildRoom22Shutters} from './LabRoom22Mechanics.js';
export const ROOM22_SPEC={id:'opposed-freight-lock',title:'Обратная сторона шлюза',concept:'Один груз меняет два прохода в противоположных направлениях; постоянная высота позволяет забрать источник нагрузки',description:'Нижний проход и верхний обзор связаны одним противовесом. Найди место, где можно сохранить высоту и вернуть друга.',accent:0xa2d2bd,assets:[1,2,11,22,23,24],hints:['Кабели связывают белую грузовую опору с двумя противоположными створками.','Верхняя галерея не зависит от груза. Из её окна видна та самая опора внизу.','Доставь друга на галерею через портал под ним: нижний проход закроется, зато откроется северный обзор. Конечная приёмная обращена к этому новому ракурсу.']};
export function buildRoom22(game,index=21){
 const k=new Workshop(game,ROOM22_SPEC,index),w=k.world;w.highFidelity=true;k.bounds={minX:-22,maxX:22,minZ:-24,maxZ:24};k.ceiling=24;w.walls(k.bounds,24,-1);
 const deck=(name,x0,x1,z0,z1,y)=>{w.floor(x0,x1,z0,z1,y,{name});w.box([(x0+x1)/2,y-.25,(z0+z1)/2],[x1-x0,.30,z1-z0],w.materials.trim);};
 const block=(p,s)=>w.box(p,s,w.materials.wall);
 deck('Continuous freight recovery court',-22,22,-24,24,0);
 // Three deliberate openings in the structural spine: ground passage,
 // steep retrieval view, and high reverse view. Everything else is solid.
 block([0,12,19.5],[.65,24,9]);block([0,15.3,12],[.65,17.4,6]);
 block([0,12,6.5],[.65,24,5]);block([0,1.45,0],[.65,2.9,8]);block([0,16,0],[.65,16,8]);
 block([0,12,-9.25],[.65,24,10.5]);
 block([0,5.65,-18],[.65,11.3,7]);block([0,20,-18],[.65,8,7]);
 block([0,12,-22.75],[.65,24,2.5]);
 deck('Permanent observation gallery',3,22,-24,8,7);
 // A genuine stair from the far side of the closed ground throat.
 for(let i=0;i<28;i++){const z=22-i*.5;deck('Freight inspection stair',16,21,z-.5,z,(i+1)*.25);block([18.5,(i+1)*.125,z-.25],[5,(i+1)*.25,.5]);}
 deck('Upper stair arrival',12,21,7,8,7);
 for(let i=0;i<12;i++){const z=-11-i*.5;deck('Reverse inspection stair',9,15,z-.5,z,7+(i+1)*.25);}
 deck('Reverse high viewpoint',3,22,-24,-17,10);
 block([12,3.5,-8],[20,7,.65]);block([12,19.1,-8],[20,9.8,.65]);
 // Arrival is enclosed above and behind; only the high east-facing aperture
 // is portalable. Its undersides cannot be climbed from the recovery floor.
 deck('Reverse upper receiving chamber',-22,-8,-23,-13,14);
 block([-15,6.9,-18],[14,13.8,10]);block([-21.8,18,-18],[.4,8,10]);
 block([-15,18,-23.2],[14,8,.4]);block([-15,18,-12.8],[14,8,.4]);
 const pad=k.pad('freight-weight',[-12,0,0],5.6,6.4);
 k.panel('upper-return',[21.65,9.3,3],[-1,0,0],6,4.6);
 k.panel('reverse-receiver',[-21.55,16.3,-18],[1,0,0],6,4.6);
 k.panel('lower-return',[-21.65,2.3,18],[1,0,0],5.6,4.6);
 const shutters=buildRoom22Shutters(k,pad);
 const level=k.finish([-17,0,18],[-15,.55,17],[-14,14,-18],{workshop:k,spec:ROOM22_SPEC,portalPuzzle:true,shutters});
 level.spawnView={yaw:-.25,pitch:-.1};
 level.puzzleGeometry={footprint:44*48,occupiedHeights:[0,7,14],orders:['weight-first','portal-first'],noProgressFlags:true,portalRoles:{'freight-weight':'the original live load becomes its own outgoing aperture','upper-return':'stable cargo receiving gallery and final player entry','reverse-receiver':'destination seen only through the high reverse inspection slot','lower-return':'recover from the shared lower court'},deductions:['a load opens one path and closes another','carrying the load removes the force that holds the first passage open','a permanent gallery preserves progress when the mechanism reverses','a portal below the original load retrieves it without a second object','the reverse high observation slot reveals a previously hidden destination']};
 return level;
}
export {runRoom22} from './LabRoom22Journey.js';
