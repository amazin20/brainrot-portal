import * as THREE from 'three';
import {Workshop} from './LabWorkshopKit.js';
import {buildRoom12Architecture} from './LabRoom12Architecture.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const ROOM12_SPEC={id:'folded-junction',title:'Узел падений',concept:'Шесть поверхностей, два путешественника и пересекающиеся пути в одном узле',description:'Выход рядом — этажом выше. Найди путь для себя и друга.',hints:['Одна шахта может отправить вас в разные стороны. Посмотри, куда ведут пространства над головой и под ногами.','Низкий проход подходит свободному другу. Верхний уступ и грузовой край используют один и тот же пол.','Подготовь доставку друга через низкий проём. Падение с верхнего уступа в пару напольных порталов даст новый ракурс. В воздухе перенеси потраченный вход на высокую боковую стену. Путь можно сначала исследовать самому.'],accent:0xd8b77b,assets:[1,2,11,23,24]};
/** Three interwoven levels, six functional ceramics and no progression latch. */
export function buildRoom12(game,index=11){
 const k=new Workshop(game,ROOM12_SPEC,index),w=k.world;
 k.bounds={minX:-18,maxX:18,minZ:-15,maxZ:17};k.ceiling=26;
 w.walls(k.bounds,26,-1);
 w.materials.wall.color.setHex(0x49595b);w.materials.floor.color.setHex(0x788782);
 w.floor(-18,15,9,17,0,{name:'Lower south return'});
 w.floor(-18,-7,-15,9,0,{name:'Lower west passage'});
 w.floor(-7,7,-10,9,0,{name:'Central return well'});
 w.floor(7,15,-10,9,0,{name:'Under the receiving dock'});
 // The west landing has a real foundation instead of an empty basement cul-de-sac.
 w.box([-12.5,3.3,-11.25],[11,6.6,7.5],w.materials.wall);
 w.box([16.5,13,1],[3,26,32],w.materials.wall);
 w.box([9.15,13,-12.5],[11.7,26,5],w.materials.wall);
 const deck=(name,x0,x1,z0,z1,y)=>{const f=w.floor(x0,x1,z0,z1,y,{name});w.box([(x0+x1)/2,y-.27,(z0+z1)/2],[x1-x0,.28,z1-z0],w.materials.trim);return f;};
 const stair=(name,x0,x1,z0,z1,low,high,axis='z')=>{
  const n=Math.ceil((high-low)/.26);
  for(let i=0;i<n;i++){
   const a=i/n,b=(i+1)/n,y=low+(high-low)*b;
   const xa=axis==='x'?x0+(x1-x0)*a:x0,xb=axis==='x'?x0+(x1-x0)*b:x1;
   const za=axis==='z'?z0+(z1-z0)*a:z0,zb=axis==='z'?z0+(z1-z0)*b:z1;
   w.floor(Math.min(xa,xb),Math.max(xa,xb),Math.min(za,zb),Math.max(za,zb),y,{name});
   w.box([(xa+xb)/2,(low+y-.16)/2,(za+zb)/2],[Math.abs(xb-xa)-.025,y-low-.16,Math.abs(zb-za)-.025],w.materials.trim);
  }
 };
 // The west walk passes under the final pocket, then folds over its own shaft.
 deck('West landing',-17.5,-8,-14.3,-7,7);
 deck('Underpass ledge',-16.8,-13.6,-7,13,7);
 deck('Shared freight lip',-16.8,-7,11.5,16,7);
 stair('North cross stair',-14,-5,-14.3,-11,7,11,'x');
 deck('North stair turn',-5,3,-14.3,-9,11);
 stair('Spine stair',0,3,-9,-3.3,11,14.6);
 deck('Folded stair turn',0,6.5,-3.3,-1.8,14.6);
 stair('Folded return stair',3.5,6.5,-3.3,-9,14.6,18);
 deck('Upper crossing turn',3.5,9,-10,-9,18);
 deck('Over the freight tube',7,9,-9,14,18);
 w.box([6.8,20.25,2.225],[.3,4.5,18.45],w.materials.wall);
 // The upper walk is a continuous enclosed service corridor. Its east side
 // cannot become a short drop directly onto the receiving dock below.
 w.box([9.2,20.25,3.5],[.3,4.5,27],w.materials.wall);
 w.box([6.7,17.25,-5.15],[.3,10.5,6.7],w.materials.wall);
 deck('Same-shaft high lip',-12,9,11.5,16,18);
 // A low sight slot exposes the shared return floor while the complete wall
 // keeps the standing traveller on the high lip. The shared drop stays open.
 w.box([-1.75,20.25,11.3],[10.5,4.5,.3],w.materials.wall);
 w.box([6.725,20.25,11.3],[.45,4.5,.3],w.materials.wall);
 w.box([5,17.3,11.3],[3,.4,.3],w.materials.wall);
 w.box([5,21.05,11.3],[3,2.9,.3],w.materials.wall);
 w.box([-2.5,7.5,2.5],[5,15,7],w.materials.wall);
 deck('Receiving dock',7,15,-2,8,9);
 deck('Freight throat floor',7,13,-9,-2,9);
 // Dock foundations also mask freight from the lower return passage.
 w.box([10,4.4,-8.8],[6,8.8,.4],w.materials.wall);
 w.box([7.15,4.4,-5.5],[.3,8.8,7],w.materials.wall);
 w.box([12.85,4.4,-5.5],[.3,8.8,7],w.materials.wall);
 w.box([10,13.9,.4],[6.3,6.7,.6],w.materials.wall);
 w.box([13.15,12.8,-4.3],[.3,7.6,10],w.materials.wall);
 w.box([6.85,9.7,-4.3],[.3,1.4,10],w.materials.wall);
 w.box([6.85,14.25,-4.3],[.3,4.9,10],w.materials.wall);
 w.box([10,16.7,-4.3],[6.6,.25,10],w.materials.wall);
 w.box([11,10,7.8],[8,2,.4],w.materials.wall);
 for(const x of [7.05,14.85])w.box([x,9.7,4.25],[.2,1.4,7.1],w.materials.wall);
 // A recessed perch catches weak exits; the front lip remains above it.
 deck('Launch pocket recovery',-18,-9,0,6,17);
 for(const z of [0,6])w.box([-9,21.5,z],[18,9,.35],w.materials.wall);
 w.box([-9,17.75,3],[.35,1.5,6],w.materials.wall);
 w.box([-9,25,3],[.35,2,6],w.materials.wall);
 w.box([-17.75,19,3],[.4,4,5.6],w.materials.wall);
 k.panel('access-low',[-17.97,2.3,12],[1,0,0],5.6,4.6);
 k.panel('access-high',[-12,9.3,-10.65],[0,0,1],5.6,4.6);
 k.panel('shared-drop',[-10,.025,9],[0,1,0],6,6);
 k.panel('return',[4,.025,3],[0,1,0],5.4,6);
 k.panel('cargo',[10,11.35,-9],[0,0,1],5.6,4.6);
 k.panel('final',[-17.5,21,3],[1,0,0],5.6,4.6);
 buildRoom12Architecture(w);
 const level=k.finish([10,0,11],[12,.55,11],[10,9,4],{workshop:k,portalPuzzle:true});
 level.puzzleGeometry={safeFloor:0,dropHeight:18,freightHeight:7,goalHeight:9,normalGaps:0,cargoWindow:{z:.4,minY:9,maxY:10.55},launchWindow:{x:-9,minY:18.5,maxY:24},returnSightWindow:{z:11.3,x:[3.5,6.5],y:[17.5,19.6]},footprint:36*32,
  portalRoles:{'access-low':'enter and return to folded ledge','access-high':'shared observation and freight route','shared-drop':'both cargo drop and player energy','return':'viewpoint, second fall and recovery','cargo':'independent rigid-body delivery','final':'perpendicular flight and recovery'},
  deductions:['reuse one shaft for two travellers','read intersecting routes in section','change the spent portal while airborne'],orders:['cargo-first','scout-first']};
 return level;
}
export {runRoom12} from './LabRoom12Journey.js';
