import * as THREE from 'three';
import {Workshop,V} from './LabWorkshopKit.js';
import {buildRoom28Tides} from './LabRoom28Tides.js';
import {configureChapterWorld} from './LabChapterArt.js';
import {buildRoom28Art} from './LabRoom28Art.js';

export const ROOM28_SPEC={id:'tidal-observatory',title:'Обсерватория приливов',concept:'Один объём воды меняет географию двух островов',description:'У воды нет лишнего объёма. Найди высоту, на которой острова встретятся.',accent:0x3de6d1,assets:[1,2,11,19,22,23,24],hints:['Нижние коллекторы уравнивают уровни. Высокое устье переливает почти всё в один бассейн.','Средняя арка и верхняя обсерватория — разные пути. Пустой бассейн тоже становится проходом.','Белое устье внутри кораллового колодца видно с его понтона. Перенеси туда воду из другого бассейна уже после посадки.']};

export function buildRoom28(game,index=27){
 const k=new Workshop(game,ROOM28_SPEC,index),w=k.world;
 configureChapterWorld(w,'lagoon');
 k.bounds={minX:-26,maxX:26,minZ:-23,maxZ:23};k.ceiling=17;
 w.walls(k.bounds,14,-1);w.floor(-26,26,-23,23,0,{name:'Safe lagoon foundation'});
 const deck=(name,x0,x1,z0,z1,y)=>w.floor(x0,x1,z0,z1,y,{name});
 // Two ways onto the same archipelago: an equal tide meets the lower garden,
 // or a full tide reaches the observatory and its descending promenade.
 deck('Equal tide landing',8,19,4,8,3);
 deck('Low tide recovery stair',19.2,20.4,-1.5,1.5,.3);deck('Low tide recovery landing',18.1,19.2,-1.5,1.5,.6);
 deck('Garden over the lagoon',-8,8,4,8,3);
 deck('Coral middle landing',-10,-8,-2,8,3);
 deck('Observatory tide landing',10,20,-9,-4,5.3);
 deck('Observatory north promenade',-5,20,-15,-9,5.3);
 for(let i=0;i<10;i++)deck('Observatory descending promenade '+i,-5,-1,-9+i*.6,-8.4+i*.6,5.3-(i+1)*.23);
 deck('Promenade garden return',-5,-1,-3,4,3);
 // West basin is a coral well. Its low and middle side mouths open different
 // approaches as the floating floor moves; the upper lip is the destination.
 const coral=new THREE.MeshStandardMaterial({color:0xff8978,roughness:.64});
 const wellBox=(p,s)=>{const m=w.box(p,s,coral);m.userData.keepMaterial=true;return m;};
 wellBox([-14,6,-6],[10.4,12,.4]);wellBox([-14,6,6],[10.4,12,.4]);
 // East edge: low door and an upper garden door, divided by a true lintel.
 wellBox([-9,6,-4.5],[.4,12,3]);wellBox([-9,6,4.5],[.4,12,3]);
 wellBox([-9,2.95,0],[.4,.25,6]);wellBox([-9,9.1,0],[.4,5.8,6]);
 deck('Coral low doorstep',-10.1,-8,-2.8,2.8,.3);deck('Coral inner low doorstep',-11.3,-10.1,-2.8,2.8,.6);
 deck('Coral summit garden',-24,-18.6,-5,5,5.3);
 // The destination's western wall has a broad upper doorway, never a ray
 // slot. Its lower solid skirt prevents walking beneath the goal and winning.
 wellBox([-19,2.55,0],[.4,5.1,12]);wellBox([-19,10.5,0],[.4,3,12]);
 const lowA=k.panel('coral-low',[-14,2.2,7.2],[0,0,1],5.6,4.6);
 const lowB=k.panel('lagoon-low',[14,2.2,-5.6],[0,0,1],5.6,4.6);
 const highB=k.panel('lagoon-fall',[14,9.6,-5.6],[0,0,1],5.6,4.6);
 const highA=k.panel('coral-fall',[-14,9.6,-5.6],[0,0,1],5.6,4.6);
 const overflow=k.panel('coral-overflow',[-14,9.6,6.25],[0,0,1],5.6,4.6);
 // Collector housings have broad clear shooting slots, but their horizontal
 // ribs physically exclude a standing capsule. They are plumbing, not doors.
 for(const [x,z] of [[-14,7.2],[14,-5.6]]){
  for(const sx of [-3.05,3.05])wellBox([x+sx,2.7,z+.5],[.3,5.4,1.4]);
  wellBox([x,5.13,z+.5],[6.4,.25,1.4]);
  for(const y of [.55,1.05,3.3,4.8])wellBox([x,y,z+1],[6.4,.20,.24]);
 }
 const a=k.slider('coral-float',[-14,0,0],[-14,6,0],{width:8.8,depth:10.8,portal:false,asset:19,assetSize:3.2});
 const b=k.slider('lagoon-float',[14,0,0],[14,6,0],{width:8.8,depth:7.8,portal:false,asset:19,assetSize:3.2});
 const tide=buildRoom28Tides(k,{a,b,ports:[{panel:lowA,basin:0},{panel:lowB,basin:1},{panel:highA,basin:0},{panel:overflow,basin:0},{panel:highB,basin:1}]});
 buildRoom28Art(k);
 const level=k.finish([0,0,17],[3,.55,16],[-22,5.3,0],{workshop:k,portalPuzzle:true});
 level.puzzleGeometry={footprint:52*46,goalHeight:5.3,noProgressFlags:true,safeFloor:0,orders:['equal-tide-garden','full-tide-observatory'],fluid:tide,portalRoles:{'coral-overflow':'refill the west island from the lower recovery garden','coral-low':'withdraw water from the west basin','lagoon-low':'equalize both basins or return the eastern reserve','lagoon-fall':'pour freely above the eastern tide','coral-fall':'refill the west basin from inside its newly accessible well'},deductions:['water volume moves instead of appearing','a low connection stops at equal heights','a high outlet changes the equilibrium and exposes another route','the drained basin is an entrance instead of a failure','the same portal pair can restore the occupied west island']};
 return level;
}
export {runRoom28} from './LabRoom28Journey.js';
