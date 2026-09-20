import {Workshop,V,glass} from './LabWorkshopKit.js';
import {buildRoom24Pneumatics} from './LabRoom24Pneumatics.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
export const ROOM24_SPEC={id:'reverse-pressure',title:'Обратное давление',concept:'Герметичный накопитель освобождает порталы для возвращения друга',description:'Воздух можно сохранить. Реши, какая часть машины должна остаться неподвижной, когда исчезнет связь.',accent:0xc8bc87,assets:[1,2,11,19,22,23,24,31],hints:['Вентилятор не достаёт до накопителя напрямую. Проследи трубы от круглого воздухоприёмника.','Закрытый клапан удерживает цилиндр, но не наполняет бак. Стрелка показывает настоящий запас.','С верхней галереи видны дно герметичной камеры и грузовой приёмник. Одна пара сначала перекачивает воздух, затем возвращает друга; второй клапан тратит сохранённый запас на переправу.']};
export function buildRoom24(game,index=23){
 const k=new Workshop(game,ROOM24_SPEC,index),w=k.world;k.shell({minX:-22,maxX:22,minZ:-20,maxZ:20},20);w.highFidelity=true;
 const deck=(name,a,b,c,d,y)=>w.floor(a,b,c,d,y,{name});
 // A complete recovery floor surrounds the machinery; every upper landing
 // has a distinct job, no kill pit or invisible checkpoint is required.
 deck('Lift retaining landing',-18,-8,-18,-12,8);deck('Folded pressure service gallery',-8,13,-18,-8,8);
 w.box([-8,4,-10],[.35,8,4],w.materials.wall);w.box([2.5,4,-8],[21,8,.35],w.materials.wall);
 w.box([13.2,10,-13],[.35,20,10],w.materials.wall);w.box([2.5,10,-18.2],[21,20,.35],w.materials.wall);
 // Ground views cannot shoot up into the service receiver from the side.
 w.box([-17.9,6,-8],[.3,12,8],w.materials.wall);
 w.box([-8.2,10,-16],[.35,20,4],w.materials.wall);
 const cargoFloor=k.panel('sealed-cargo',[0,.025,4],[0,1,0],5.6,5.6);
 const glassBox=[glass(w,[-4,2.6,4],[.2,5.2,8]),glass(w,[4,2.6,4],[.2,5.2,8]),glass(w,[0,2.6,0],[8,5.2,.2]),glass(w,[0,2.6,8],[8,5.2,.2])];
 for(const x of [-4,4])for(const z of [0,8])w.box([x,3,z],[.14,6,.14],w.materials.trim,false);
 k.panel('air-intake',[-9,2.3,12],[-1,0,0],5.6,4.6);
 k.panel('air-delivery',[-5,2.3,-5],[1,0,0],5.6,4.6);
 k.panel('freight-receiver',[0,10.3,-15.4],[-1,0,0],3.4,4.6);
 w.box([-2,10,-10.8],[12,20,.35],w.materials.wall);
 // Partition the fixed return around the gallery: same floor union, one
 // visible ceramic/metal layer at every point of their shared height.
 deck('Cargo inspection return',-16,-8,-9.5,-6.5,8);deck('Cargo inspection junction',-8,2,-8,-6.5,8);deck('Sealed chamber observation',-2,2,-6.5,-2,8);
 const fan=k.fan('compressor',[-18,2.3,12],[1,0,0],{radius:.85});fan.enabled=true;k.resets.push(()=>{fan.enabled=true;});
 const lift=k.slider('pressure-lift',[-14,0,-10],[-14,8,-10],{width:4,depth:4,portal:false,asset:19,assetSize:3});
 const ferry=k.slider('pressure-ferry',[8,8,-5],[8,8,10],{width:4,depth:6,portal:false,asset:19,assetSize:3.3});
 for(const x of [5.5,10.5])w.box([x,10,3],[.3,20,22],w.materials.wall);
 deck('Far pressure dock',5.5,22,13,20,8);w.box([16.4,4,13],[11.2,8,.3],w.materials.wall);
 const pressure=buildRoom24Pneumatics(k,fan,lift,ferry);
 const level=k.finish([-18,0,17],[0,.55,4],[17,8,17],{workshop:k,portalPuzzle:true,cargoOnAnyPad:()=>cargoLoadsPlate(game.cargo,game.heldCube,cargoFloor.getFrame())||ferry.loaded(),playerAcceleration:(p,v)=>fan.acceleration(p.clone().add(V(0,1.2,0)),v)});
 level.mechanismArt={turbines:[fan]};
 level.conceptLesson={position:[-11,8,-14.5],range:4,key:'E',text:'Закрытый клапан запирает воздух в цилиндре. Стрелка бака продолжает показывать оставшийся запас.'};
 level.puzzleGeometry={footprint:1760,goalHeight:8,orders:['charge-first','isolate-first'],noProgressFlags:true,glass:glassBox,portalRoles:{'air-intake':'capture the actual compressor jet','air-delivery':'fill the physically separate reservoir','sealed-cargo':'retrieve the original companion through the chamber floor','freight-receiver':'safe upper freight landing after releasing the air circuit'},deductions:['route air around sealed glass','fill a real finite reservoir before releasing its source','isolate the lifted cylinder to retain access','reuse one portal pair for the original companion','spend stored pressure on the far crossing'],pressure};
 return level;
}
export {runRoom24} from './LabRoom24Journey.js';
