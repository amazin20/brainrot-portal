import * as THREE from 'three';
import {Workshop} from './LabWorkshopKit.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
import {buildTransferFunnel} from './LabTransferFunnel.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const ROOM15_SPEC={id:'countercurrent-weave',title:'Противотечение',concept:'Обратимый поток, извлечение груза и пересечение воздушных путей',description:'Поле может тянуть и нести. Переплети его путь со своим.',hints:['Цвет и движение частиц показывают направление поля. Направление можно изменить у излучателя.','Низкий канал не пропускает тебя. Обратный поток вытянет друга через портал. Из верхнего кармана открывается другой ракурс.','Подними друга и оставь на верхнем кармане. Используй верхний поперечный поток для себя, выйди из него над приёмной площадкой, затем свяжи два пола, чтобы вернуть друга. Можно сначала исследовать верх самостоятельно.'],accent:0x75dcd4,assets:[1,2,11,22,23,24]};
export function buildRoom15(game,index=14){
 const k=new Workshop(game,ROOM15_SPEC,index),w=k.world;
 k.bounds={minX:-21,maxX:21,minZ:-19,maxZ:19};k.ceiling=28;w.walls(k.bounds,28,-1);
 w.materials.wall.color.setHex(0x465259);w.materials.floor.color.setHex(0x748987);
 const deck=(name,x0,x1,z0,z1,y)=>{w.floor(x0,x1,z0,z1,y,{name});w.box([(x0+x1)/2,y-.3,(z0+z1)/2],[x1-x0,.3,z1-z0],w.materials.trim);};
 // Every low court is either the emitter lane, recovery path or lift well.
 deck('Emitter and return court',-21,21,8,19,0);
 deck('Lift well and retrieval court',-12,1,-5,8,0);
 deck('North recovery passage',-21,21,-19,-5,0);
 deck('West return underpass',-21,-12,-5,8,0);
 deck('East landing foundation',1,21,-5,8,0);
 w.box([11,6,2],[20,12,12],w.materials.wall);
 // A visible freight pocket with a low throat. The initial body lies beyond
 // the throat; a traveller cannot carry it back through that 1.55m opening.
 // The rear well shares the north recovery foundation.
 deck('Freight pocket',-19,-10,-11,-7,2);
 w.box([-14.5,1,-9],[9,2,4],w.materials.wall);
 for(const x of [-19,-10])w.box([x,6,-12.5],[.3,8,11],w.materials.wall);
 w.box([-14.5,7.8,-12.5],[9,.3,11],w.materials.wall);
 w.box([-14.5,5.575,-10],[9,4.05,.4],w.materials.wall);
 // Observation slot permits portal fire and shows the trapped friend.
 w.box([-14.5,1,-6.8],[9,2,.3],w.materials.wall);
 w.box([-14.5,6.6,-6.8],[9,2.4,.3],w.materials.wall);
 // Stacked lift pocket: an open column is shared by player and free friend.
 deck('Upper lift landing',-12,-3,-5,0,12);
 deck('Upper observation lip',-12,-3,0,4,12);
 // Leave the actual shaft open instead of drawing a second opaque floor.
 // The shaft is adjacent to the lip, so steering is required to disembark.
 w.box([-7.5,7,-5.2],[9,14,.35],w.materials.wall);
 w.box([-12.2,7,-.5],[.35,14,9],w.materials.wall);
 // The freight ceramic shares the observation landing.
 // Side launch pocket is above, and behind, the freight enclosure.
 deck('Crossing emitter catch',-21,-12,-16,-8,14);
 w.box([-16.5,21,-16],[9,14,.35],w.materials.wall);
 w.box([-16.5,25,-8],[9,6,.35],w.materials.wall);
 w.box([-19,19.75,-8],[4,4.5,.4],w.materials.wall);
 w.box([-12,15.5,-12],[.3,3,8],w.materials.wall);
 // The north receiver is separated from the lift by a complete spine;
 // its floor can only be seen after the elevated transverse crossing.
 w.box([1,8.5,-10],[5,17,10],w.materials.wall);
 deck('North receiving bay',8,21,-17,-7,14);
 w.box([20.8,19,-12],[.35,10,10],w.materials.wall);
 w.box([14,15,-16.8],[12,2,.3],w.materials.wall);
 // Slit below the upper walk masks direct ground shots into the launch pocket.
 w.box([-16.5,1,-8],[9,2,.4],w.materials.wall);
 w.box([-16.5,10.525,-8],[9,13.95,.4],w.materials.wall);
 k.panel('intake',[18,2.7,14],[-1,0,0],6,4.8);
 k.panel('freight',[-14.5,2.7,-17.6],[0,0,1],6,4.8);
 k.panel('lift',[-8,.025,7],[0,1,0],6,5.5);
 k.panel('perch',[-5,12.025,2.5],[0,1,0],4,4.8);
 k.panel('crossing',[-20.4,20,-12],[1,0,0],6,4.8);
 k.panel('receiver',[14,14.025,-12],[0,1,0],6,6);
 const funnel=buildTransferFunnel(k,{origin:[-17,1.9,14],direction:[1,0,0],radius:2.15,speed:7});
 k.state.funnel=funnel;
 k.control('reverse',[-14,0,17],()=>{funnel.reversed=!funnel.reversed;},'E — изменить направление потока');
 k.forces.push(()=>{if(game.heldCube||!game.physics?.cargoBody)return;const b=game.physics.cargoBody,a=funnel.acceleration(V(b.position.x,b.position.y,b.position.z),V(b.velocity.x,b.velocity.y,b.velocity.z),.5);if(a.lengthSq()){b.wakeUp();b.force.x+=a.x*b.mass;b.force.y+=a.y*b.mass;b.force.z+=a.z*b.mass;}});
 const level=k.finish([-10,0,17],[-14.5,2.6,-8.7],[14,14,-12],{workshop:k,portalPuzzle:true,cargoOnAnyPad:()=>cargoLoadsPlate(game.cargo,game.heldCube,k.panels.perch.getFrame()),playerAcceleration:(p,v)=>funnel.acceleration(p.clone().add(V(0,1.2,0)),v,.46,{centering:.8,damping:2})});
 level.puzzleGeometry={footprint:42*38,cargoThroatHeight:1.55,goalHeight:14,portalRoles:{intake:'routes both push and pull from the real emitter',freight:'extracts the original friend through a low throat',lift:'raises player and friend into the shared observation pocket',perch:'holds the friend for retrieval after the crossing',crossing:'carries the player transversely above the dividing spine',receiver:'retrieves the friend from the upper perch'},orders:['cargo-first','scout-first'],deductions:['reverse a routed field to extract cargo','leave a vertical field at the useful height','reroute a field using a new viewpoint','separate travellers then reunite through a floor pair']};
 return level;
}
export {runRoom15} from './LabRoom15Journey.js';
