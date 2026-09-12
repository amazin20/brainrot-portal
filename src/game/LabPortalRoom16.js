import {Workshop} from './LabWorkshopKit.js';
import {createLightBridge} from './LabLightBridge.js';
import {opticalLift} from './LabRoom13Mechanics.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
export const ROOM16_SPEC={id:'vanishing-support',title:'Ложный пол',concept:'Исчезающая опора доставляет противовес; путь вверх начинается спуском',description:'Опора может быть способом доставки. Посмотри, что находится под ней.',hints:['Световая дорожка проходит прямо над колодцем противовеса. Кабель связывает его с кабиной.','Когда дорожка исчезнет, друг упадёт вниз. Где в этот момент должен быть ты?','Оставь друга на свету над колодцем, перейди на остров и спустись к кабине. Убери опору, уже стоя в кабине. Наверху можно освободить противовес и использовать свет для последнего перехода.'],accent:0xe7c28d,assets:[1,2,11,19,23,24,29]};
export function buildRoom16(game,index=15){
 const k=new Workshop(game,ROOM16_SPEC,index),w=k.world;
 k.bounds={minX:-22,maxX:22,minZ:-19,maxZ:19};k.ceiling=27;w.walls(k.bounds,27,-1);
 const deck=(name,x0,x1,z0,z1,y)=>{const f=w.floor(x0,x1,z0,z1,y,{name});w.box([(x0+x1)/2,y-.3,(z0+z1)/2],[x1-x0,.35,z1-z0],w.materials.trim);return f;};
 deck('Southern return court',-22,22,12,19,0);
 deck('West recovery loop',-22,-13,-19,12,0);
 deck('North recovery loop',-13,22,-19,-14,0);
 deck('Lower connected catch',-13,22,-14,12,0);
 deck('First light balcony',-21,-14,-3,3,6);
 w.box([-17.5,2.8,0],[7,5.6,6],w.materials.wall);
 deck('Dry crossing island',4,9,-3,3,7.4);
 w.box([6.5,3.5,0],[5,7,6],w.materials.wall);
 // A descending route is useful before the ascent: it reaches the separate
 // lift dock while the light still supports the original companion.
 for(let i=0;i<22;i++)deck('Descending island return',5,9,3+i*.43,3+(i+1)*.43,7.4-(i+1)*5.4/22);
 deck('Descending stair landing',5,15,12.46,14,2);
 deck('Dry lift approach',9,15,2,13,2);
 for(let i=0;i<8;i++)deck('Lower service stair',11,15,13+i*.4,13+(i+1)*.4,2-(i+1)*.25);
 deck('Counterweight basin',-3,3,-3,3,2);
 // The well is reached by gravity, not by carrying through a doorway. Its
 // roof overhang hides the plate from low and lateral portal sight lines.
 for(const x of [-3.15,3.15])w.box([x,3.4,0],[.3,6.8,6.6],w.materials.wall);
 for(const z of [-3.15,3.15])w.box([0,3.4,z],[6.6,6.8,.3],w.materials.wall);
 for(const x of [-2.4,2.4])w.box([x,6.7,0],[1.5,.35,6],w.materials.wall);
 for(const z of [-2.4,2.4])w.box([0,6.7,z],[3.3,.35,1.5],w.materials.wall);
 const pad=k.pad('counterweight',[0,2,0],4.6,4.6);
 const lift=opticalLift(k,'counterweight-lift',[12,2,0],{top:13.4,width:4.6,depth:4.6});
 k.ticks.push(()=>{lift.powered=pad.loaded()||pad.player();});
 k.wire([[0,2.3,3.35],[0,2.3,4],[10,2.3,4],[12,2.3,2.5]],()=>pad.loaded()||pad.player());
 deck('Upper lift disembarkation',9,15,2.3,4.1,13.4);
 const upperShelf=deck('Upper returning observation gallery',-17,15,4.1,7.5,13.4);
 deck('East upper service walk',15,21,-13,7.5,13.4);
 w.box([18,6.6,-3],[6,13.2,20],w.materials.wall);
 deck('Far return destination',-20,-12,-13,-7,13.4);
 w.box([-16,6.6,-10],[8,13.2,6],w.materials.wall);
 deck('Destination landing apron',-20,-12,-7,-5.5,13.4);
 w.box([-16,6.6,-6.25],[8,13.2,1.5],w.materials.wall);
 // The light source sits in a sight duct, offset from every walking route.
 w.box([-9.7,7.15,-10],[.35,14.3,6],w.materials.wall);
 w.box([-9.7,22.6,-10],[.35,8.8,6],w.materials.wall);
 w.box([-15,2.5,-11.5],[10,5,.3],w.materials.wall);
 w.box([-15,16,-11.5],[10,18,.3],w.materials.wall);
 k.panel('arrival',[-21.97,2.3,15],[1,0,0],5.6,4.6);
 k.panel('first-address',[-20.6,8.3,0],[1,0,0],5.6,4.6);
 k.panel('source',[-10,6,-10],[-1,0,0],5.6,4.6);
 const recovery=k.panel('upper-rest',[0,13.425,5.8],[0,1,0],4.8,3.4);
 k.panel('last-address',[21.4,15.7,-10],[-1,0,0],5.6,4.6);
 // Last-address sight duct: the deep sill excludes upward shots from the
 // lower courts. A high service slit reveals the face from the upper gallery;
 // the walking entrance turns around an opaque baffle instead of facing it.
 deck('High receiver sight-duct sill',3,21.7,-13.3,-6.7,14.3);
 w.box([12.35,22.5,-10],[18.7,9,6.9],w.materials.wall);
 w.box([12.35,20.65,-13.45],[18.7,12.7,.3],w.materials.wall);
 w.box([11.15,14.975,-6.7],[16.3,1.35,.3],w.materials.wall);
 w.box([11.15,21.65,-6.7],[16.3,10.7,.3],w.materials.wall);
 w.box([20.5,16.15,-8.3],[2.4,3.7,.3],w.materials.wall);
 for(let i=0;i<4;i++)deck('Receiver service entry steps',19.3,21.7,-5.5-i*.4,-5.1-i*.4,13.4+(i+1)*.225);
 // End of the receiver duct. Its west mouth leaves a fifteen-metre gap to
 // the destination, so its floor cannot replace the final routed light.
 const light=createLightBridge(k,{origin:[-11.5,5.1,-10],direction:[1,0,0],span:[0,0,1],width:2.5,name:'Borrowed light support'});k.state.lightBridge=light;
 const level=k.finish([-17,0,15],[-15,.6,15],[-16,13.4,-8],{workshop:k,portalPuzzle:true,dispose:()=>light.dispose(),cargoOnAnyPad:()=>pad.loaded()||cargoLoadsPlate(game.cargo,game.heldCube,upperShelf.getFrame())||cargoLoadsPlate(game.cargo,game.heldCube,recovery.getFrame())||light.pieces.some(p=>p.floor.enabled&&Math.abs(game.cargo.position.y-(p.floor.y+.5))<.3&&game.cargo.position.x>p.floor.minX&&game.cargo.position.x<p.floor.maxX&&game.cargo.position.z>p.floor.minZ&&game.cargo.position.z<p.floor.maxZ)});
 level.spawnView={yaw:1.5,pitch:.1};
 level.mechanismArt={projectors:[{position:[-11.5,5.1,-10],direction:[1,0,0],radius:.6}],liftSurfaces:['counterweight-lift','counterweight']};
 level.puzzleGeometry={footprint:44*38,goalHeight:13.4,safeFloor:0,portalRoles:{arrival:'return access to first elevated address','first-address':'light support above the counterweight well',source:'one physical light source reused at both heights',counterweight:'gravity delivery and later release of the same weight','upper-rest':'safe independent retrieval after abandoning powered ascent','last-address':'return crossing above the original source'},deductions:['light can be removed to deliver weight','keep the support while descending to a different dock','cargo powers the lift while player rides separately','retain height on permanent architecture before retrieving weight','revisit the source from its useful front side','reuse light for the return above the well'],orders:['cargo-first','scout-first']};
 return level;
}
