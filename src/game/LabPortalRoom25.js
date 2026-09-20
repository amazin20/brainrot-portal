import {Workshop} from './LabWorkshopKit.js';
import {opticalLift} from './LabRoom13Mechanics.js';
import {buildRoom25Optics} from './LabRoom25Optics.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
export const ROOM25_SPEC={id:'opposed-shadows',title:'Обратная сторона тени',concept:'Один противовес открывает первый луч и перекрывает второй',description:'Свету мешает сама машина. Друг должен уйти с опоры, прежде чем откроется следующая высота.',accent:0xcab48c,assets:[1,2,11,22,23,24],hints:['Две тёмные заслонки связаны одним противовесом. Груз сдвигает их в противоположные стороны.','Сначала сохрани достигнутую высоту на неподвижной галерее. Снятый с опоры друг меняет настоящий путь света.','Верхний приёмник виден только из бокового кармана. Перенеси друга с опоры, затем верни луч и осмотри обратную сторону стартового зала с самой верхней галереи.']};
export function buildRoom25(game,index=24){
 const k=new Workshop(game,ROOM25_SPEC,index),w=k.world;k.shell({minX:-22,maxX:22,minZ:-22,maxZ:25},27);w.highFidelity=true;
 const deck=(name,a,b,c,d,y)=>w.floor(a,b,c,d,y,{name});
 const pad=k.pad('shadow-counterweight',[-7,0,12],4.8,4.8);
 k.panel('light-intake',[9,3,16],[1,0,0],5.6,6);
 k.panel('lower-relay',[-18,3,-6],[1,0,0],5.6,6);
 k.panel('freight-receiver',[0,11.3,-15.4],[-1,0,0],3.4,4.6);
 k.panel('upper-relay',[5,11.3,-6],[1,0,0],5.6,4.6);
 k.panel('return-entry',[19.9,20.3,-15.4],[-1,0,0],3.4,4.6);
 k.panel('home',[-17,13.6,23],[1,0,0],3.4,4.6);
 const first=opticalLift(k,'shadow-lift',[-14,0,-10],{top:9,width:4,depth:4});
 const second=opticalLift(k,'relay-lift',[16,9,-10],{top:18,width:4,depth:4});
 deck('Permanent shadow landing',-18,-8,-18,-12,9);deck('Upper optical exchange',-8,20,-18,-12,9);
 deck('Relay observation arm',6,20,-12,-8,9);deck('High reverse overlook',11,20,-18,-9,18);deck('High inspection prow',11,14,-9,-5,18);
 deck('Shadow inspection bridge',-16,-5,-11,-8,9);deck('Counterweight inspection arm',-9,-5,-8,8,9);
 w.box([-2,18,-12],[12,18,.3],w.materials.wall);w.box([17,13.5,-12],[6,27,.3],w.materials.wall);w.box([11.1,13.5,-13.75],[.3,27,8.5],w.materials.wall);
 // Opaque base and raised side screens hide the upper receiver from every
 // lower-floor firing angle. The two paths meet on occupied galleries.
 w.box([4,4.5,-12],[32,9,.3],w.materials.wall);
 w.box([5.8,4.5,-7],[.3,9,10],w.materials.wall);w.box([20.2,13.5,-10],[.3,27,16],w.materials.wall);
 w.box([6,13.5,-18.2],[28,27,.3],w.materials.wall);
 w.box([-8.2,13.5,-16],[.3,27,4],w.materials.wall);
 // The second relay is behind its own solid backing; only the east side
 // of the first gallery gives a valid shot onto its front face.
 w.box([4.8,7,-6],[.3,14,6],w.materials.wall);
 // Exit lies behind the arrival view. Its 1.35m sight slit passes a shot
 // from the high overlook, never a standing player or a low-floor aim.
 deck('Home receiving chamber',-22,-11,15,25,7);
 w.box([-10.8,7.1,20],[.4,14.2,10],w.materials.wall);
 w.box([-10.8,21.275,20],[.4,11.45,10],w.materials.wall);
 w.box([-16.5,13.5,14.8],[11.4,27,.4],w.materials.wall);
 w.box([-16.5,21,20],[11.4,.3,10],w.materials.wall);
 const optical=buildRoom25Optics(k,pad,first,second);
 const level=k.finish([-17,0,10],[-15,.55,9],[-16,7,22],{workshop:k,portalPuzzle:true,cargoOnAnyPad:()=>cargoLoadsPlate(game.cargo,game.heldCube,pad.surface.getFrame())});
 level.mechanismArt={projectors:[{position:optical.source.toArray(),direction:optical.direction.toArray(),radius:.5}],liftSurfaces:['shadow-lift','relay-lift']};
 level.conceptLesson={position:[-7,0,12],range:4,key:'E',text:'Две заслонки соединены с одной опорой. Нагрузка освобождает один луч и перекрывает другой.'};
 level.puzzleGeometry={footprint:2068,goalHeight:7,orders:['weight-first','light-first'],noProgressFlags:true,sightSlot:{x:-10.8,minY:14.2,maxY:15.55},portalRoles:{'light-intake':'one source for both physical optical circuits','lower-relay':'illuminate the first lift only after its shutter clears','shadow-counterweight':'weight opens the first beam, then leaves through this floor','freight-receiver':'retain the same original companion above the first crossing','upper-relay':'the second optical circuit is clear only when the counterweight is unloaded','return-entry':'return from the high reverse overlook','home':'reach the back of the start through its high sight slit'},deductions:['cargo removes a real opaque obstruction','leave a powered car on a permanent ledge','retrieval reverses two connected shutters','reuse the source through the upper relay after cargo retrieval','higher observation exposes the back of the starting room']};
 return level;
}
export {runRoom25} from './LabRoom25Journey.js';
