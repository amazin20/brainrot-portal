import {Workshop} from './LabWorkshopKit.js';
import {createLightBridge} from './LabLightBridge.js';
export const ROOM14_SPEC={id:'light-weave',title:'Световая вязь',concept:'Переплести мост, опору и стену одним потоком твёрдого света',description:'Опора меняет направление вместе с порталами. Найди место для вас обоих.',hints:['Свет держит вес, но мост использует ту же пару порталов, что и вы. Ищи устойчивый остров.','В узком перегибе вы не пройдёте вместе. Верхняя ниша может принять друга отдельно.','Оставь друга на полу острова. Подготовь верхний приёмник и отправь его через напольный портал. Затем с нижнего острова верни свет в источник и поднимись за другом.'],accent:0x7ed6e2,assets:[1,2,11,23,24]};
export function buildRoom14(game,index=13){
 const k=new Workshop(game,ROOM14_SPEC,index),w=k.world;
 k.bounds={minX:-20,maxX:20,minZ:-28,maxZ:16};k.ceiling=25;w.walls(k.bounds,25,-1);
 const deck=(name,x0,x1,z0,z1,y)=>{w.floor(x0,x1,z0,z1,y,{name});w.box([(x0+x1)/2,y-.35,(z0+z1)/2],[x1-x0,.4,z1-z0],w.materials.trim);};
 // A lower recovery ring serves the two crossings; the deep north is occupied
 // by the exit foundation rather than an empty walkable basement.
 deck('South return court',-20,20,6,16,0);deck('West recovery passage',-20,-12,-28,6,0);deck('Crossing recovery',-12,12,-14,6,0);
 w.box([16,12.5,-11],[8,25,34],w.materials.wall);deck('North crossing catch',0,12,-28,-14,-3);for(let i=0;i<12;i++){const z=-20+i*.5;deck('Catch return stair',9,12,z,z+.5,-3+(i+1)*.25);}w.box([-6,12.5,-21],[12,25,14],w.materials.wall);
 deck('West light landing',-19,-13,-3,3,6);w.box([-18.7,3,0],[.5,6,6],w.materials.wall);
 deck('Central weaving island',-3,3,-3,3,7.4);w.box([0,7.8,2.95],[6,.8,.2],w.materials.wall);
 for(const x of [-3.15,.15])w.box([x,16.2,-7.5],[.3,17.6,9],w.materials.wall);
 for(const [x,wide] of [[-2.53,.94],[-.47,.94]])w.box([x,16.2,-3.25],[wide,17.6,.5],w.materials.wall);
 // Its folded stair returns above the first bridge. Neither crossing has a
 // walkable substitute; stable islands let the pair be transported separately.
 for(let i=0;i<20;i++){const z=-3-i*.45,y=7.4+(i+1)*.23;deck('Folded stair',-3,0,z-.45,z,y);}deck('North stair turn',-3,6,-14,-12,12);deck('Receiver approach',0,6,-12,-4.4,12);
 // Low sights are physically screened; only the upper return reveals the face.
 w.box([3,6,-4.2],[6,12,.4],w.materials.wall);
 for(const x of [-.2,6.2])w.box([x,17,-7],[.4,10,6.4],w.materials.wall);
 w.box([3,12,-10.2],[6,1.6,.4],w.materials.wall);deck('Receiver outer toe',0,6,-11.4,-10.8,12.27);deck('Receiver outer lip',0,6,-10.8,-10.4,12.54);deck('Receiver inner toe',0,6,-9.6,-9,12.27);deck('Receiver inner lip',0,6,-10,-9.6,12.54);
 w.box([3,20.1,-10.2],[6,8.2,.4],w.materials.wall);
 w.box([3,17.5,-4.05],[6,11,.3],w.materials.wall);
 deck('Far receiving bay',0,7,-27.5,-24,13.4);w.box([3.5,6.6,-25.75],[7,13.2,3.5],w.materials.wall);
 w.box([3.5,14.4,-27.35],[7,2,.3],w.materials.wall);
 // An overlooked return alcove turns the same light sheet upright. It is a
 // real movable wall, and also a safe portal return to the lower ring.
 
 k.panel('access',[-19.97,2.3,12],[1,0,0],5.6,4.6);
 k.panel('weave-west',[-18.5,8.3,0],[1,0,0],5.6,4.6);
 k.panel('light-source',[-10,6,-10],[0,0,1],5.6,4.6);
 k.panel('weave-north',[3,14.3,-4.3],[0,0,-1],5.6,4.6);
 k.panel('return-floor',[-9,.025,10],[0,1,0],5.6,5.6);
 // This floor is an alternate recovery route from the central island and a
 // launch into the high receiver when paired after reaching its northern view.
 k.panel('island-floor',[0,7.425,0],[0,1,0],5.6,5.6);
 const bridge=createLightBridge(k,{origin:[-10,5.1,-7],direction:[0,0,-1],span:[1,0,0],width:2.1,name:'Woven solid light'});
 w.box([-10,5.1,-6.75],[2.4,.45,.5],w.materials.trim);w.box([-10,5.1,-6.97],[2.2,.12,.08],w.materials.accent,false);w.box([-10,2.5,-8.8],[5.6,5,.35],w.materials.wall);w.box([-10,16.1,-8.8],[5.6,17.8,.35],w.materials.wall);
 const level=k.finish([-15,0,12],[-13,.55,12],[3.5,13.4,-25.6],{workshop:k,portalPuzzle:true,dispose:()=>bridge.dispose()});
 level.puzzleGeometry={footprint:1760,safeFloor:0,goalHeight:13.4,portalRoles:{access:'return access to the light landing','weave-west':'first bridge across the lower crossing','light-source':'capture the physical light sheet','weave-north':'perpendicular upper bridge across the deep north','return-floor':'turn the sheet into a wall and return below','island-floor':'required independent cargo delivery from the stable island'},deductions:['one portal pair serves both support and transport','the narrow fold requires independent cargo delivery','restore the emitter from a lower sight and reuse the upper route'],orders:['cargo-first','scout-first']};
 return level;
}
export {runRoom14} from './LabRoom14Journey.js';
