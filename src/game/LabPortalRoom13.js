import {Workshop} from './LabWorkshopKit.js';
import {opticalLift,weightedOptics} from './LabRoom13Mechanics.js';
export const ROOM13_SPEC={id:'optical-paradox',title:'Оптический парадокс',concept:'Один луч и живой противовес меняют доступные стороны оптического узла',description:'Свету и другу нужен один и тот же проход. Найди, когда его можно перестроить.',hints:['Путь луча зависит от того, кто стоит на зеркальной опоре.','Порталы нужны и свету, и вам. Верхний обход позволяет сохранить достигнутую высоту.','Нагруженное зеркало направляет свет к южной кабине. С верхнего обхода посмотри вниз на опору друга: напольный портал может освободить груз, когда ты уже за преградой.'],accent:0xf1c981,assets:[1,2,11,23,24]};
export function buildRoom13(game,index=12){
 const k=new Workshop(game,ROOM13_SPEC,index),w=k.world;k.bounds={minX:-20,maxX:20,minZ:-19,maxZ:19};k.ceiling=22;w.walls(k.bounds,22,-5);
 w.materials.wall.color.setHex(0x3f4a52);w.materials.floor.color.setHex(0x798388);
 const deck=(name,x0,x1,z0,z1,y)=>{const f=w.floor(x0,x1,z0,z1,y,{name});w.box([(x0+x1)/2,y-.27,(z0+z1)/2],[x1-x0,.28,z1-z0],w.materials.trim);return f;};
 deck('West lower return',-20,-7,-19,13,0);deck('South arrival passage',-20,20,13,19,0);
 deck('North recovery passage',-7,20,-19,-13,0);deck('East recovery passage',15,20,-13,13,0);
 deck('Central recovery basin',-7,15,-13,13,-4);
 // This central mass fills the unused centre and separates the two optical arms.
 w.box([4,2,0],[18,12,11],w.materials.wall);
 // A compact returning stair brings mistakes back to the same arrival court.
 for(let i=0;i<16;i++){const z=9+i*.25;deck('Basin recovery stair',11,15,z,z+.25,-4+(i+1)*.25);}
 deck('West optical approach',-18,-12,-16.7,-4,6);deck('North cage entrance',-12,-8,-9,-4,6);deck('North cage return',-12,-8,-16.7,-13,6);
 deck('West optical return',-18,-12,4,15,6);deck('South cage entrance',-12,-8,4,9,6);deck('South cage return',-12,-8,13,15,6);deck('Mirror neck',-15,-8,-4,4,6);
 w.box([-13,6.7,-16.9],[7,1.4,.25],w.materials.wall);
 w.box([-18.8,3,0],[2.4,6,24],w.materials.wall);
 deck('North upper observation',-13,-7,-16,-13,12);deck('South upper observation',-13,-7,13,16,12);
 deck('North suspended gallery',-7,8,-16,-13,12);
 deck('South suspended gallery',-7,15,13,16,12);
 deck('Exit side gallery',12,15,7,13,12);deck('Receiving chamber',7,15,1,7,12);
 // The entrance to the receiving chamber turns back behind a full opaque wall.
 w.box([9.5,11.2,8],[5,21.6,.45],w.materials.wall);
 w.box([6.8,5.8,4],[.4,11.6,8],w.materials.wall);
 w.box([6.8,18.25,4],[.4,7.5,8],w.materials.wall);
 w.box([6.8,13.05,1.5],[.4,2.9,3],w.materials.wall);
 w.box([6.8,13.05,7.5],[.4,2.9,1],w.materials.wall);
 w.box([12.2,16.4,3],[.35,8.8,4],w.materials.wall);
 w.box([8.6,17,3.8],[3.6,10,.3],w.materials.wall);
 // Upper galleries have ordinary 1.4 m rails, with a complete dividing block
 // preventing the north observation route from dropping into the final chamber.
 for(const z of [-12.8,12.8])w.box([3,12.7,z],[18,1.4,.18],w.materials.wall);
 w.box([16,11,-5],[2,22,8],w.materials.wall);
 // Beam intake is in a physically narrow optical duct. The ray can enter;
 // the 2.4 m traveller cannot use it as a shortcut into the upper routes.
 w.box([15,3.8,-12],[.4,7.6,6],w.materials.wall);
 w.box([15,15.65,-12],[.4,12.7,6],w.materials.wall);
 for(const z of [-15.1,-8.9])w.box([17.5,11,z],[5,22,.25],w.materials.wall);
 k.panel('access-low',[-19.97,2.3,15],[1,0,0],5.6,4.6);
 k.panel('access-high',[-13,9.3,-14.8],[0,0,-1],5.6,4.6);
 k.panel('light-intake',[19.5,8,-12],[-1,0,0],5.6,4.6);
 k.panel('light-output',[-17.5,8,0],[1,0,0],5.6,4.6);
 const pad=k.pad('mirror-cradle',[-10,6,0],4,4);
 k.panel('receiving-return',[9,14.3,.8],[0,0,1],3.2,4.6);
 const north=opticalLift(k,'north-cage',[-10,6,-11],{top:12}),south=opticalLift(k,'south-cage',[-10,6,11],{top:12});weightedOptics(k,pad,north,south);
 // A sight shaft is open vertically between the final chamber and the loaded
 // cradle. Its walls occupy the rest of the chamber edge, so it is not a walk.
 const level=k.finish([10,0,16],[12,.55,16],[9,12,2.5],{workshop:k,portalPuzzle:true});
 level.puzzleGeometry={footprint:40*38,orders:['cargo-first','scout-first'],portalRoles:{'access-low':'leave and return to the folded optical shelf','access-high':'reach the mirror and move the original load','light-intake':'capture the physical source ray','light-output':'redirect the source into the weighted mirror','mirror-cradle':'carry load, change reflection, later free the same friend','receiving-return':'recover the friend after releasing the optical route'},deductions:['portals are shared between light and bodies','weight changes the actual reflection angle','retain height before replacing the powered portal pair']};return level;
}
export {runRoom13} from './LabRoom13Journey.js';
