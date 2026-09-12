import * as THREE from 'three';
import {Workshop} from './LabWorkshopKit.js';
import {opticalLift} from './LabRoom13Mechanics.js';
import {exchangeOptics} from './LabRoom20Optics.js';
import {buildTransferFunnel} from './LabTransferFunnel.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const ROOM20_SPEC={id:'braided-exchange',title:'Узел обмена',concept:'Три переплетённых высоты вокруг одного живого оптического противовеса',description:'Узел меняет путь, когда меняется нагрузка. Сохрани высоту, прежде чем обменять груз и свет.',hints:['Одна сторона зеркала двигает две связанные кабины. Другая ведёт между ними.','Белые полы верхних карманов видны только с достигнутой высоты. Их можно соединить с нагруженной опорой.','Унеси друга с зеркала, чтобы сменить оптическую ветвь; затем верни его на ту же опору из нового ракурса. Верхний поток проходит рядом с приёмной площадкой — из него можно выйти обычным движением.'],accent:0xe7c68a,assets:[1,2,11,22,23,24]};
export function buildRoom20(game,index=19){
 const k=new Workshop(game,ROOM20_SPEC,index),w=k.world;k.bounds={minX:-24,maxX:24,minZ:-22,maxZ:22};k.ceiling=30;w.walls(k.bounds,30,-1);
 w.materials.wall.color.setHex(0x454f58);w.materials.floor.color.setHex(0x7b898c);
 const deck=(name,x0,x1,z0,z1,y)=>{const f=w.floor(x0,x1,z0,z1,y,{name});w.box([(x0+x1)/2,y-.3,(z0+z1)/2],[x1-x0,.3,z1-z0],w.materials.trim);return f;};
 // The ground is the shared recovery circuit, rather than a lethal reset pit.
 deck('Shared lower exchange court',-24,24,-22,22,0);
 w.box([10,5.5,2],[16,11,20],w.materials.wall);
 // Folded eight-metre balcony links the loaded car to the unweighted car.
 deck('First car landing',-16,-10,14,18,8);
 deck('Western permanent balcony',-22,-16,-18,18,8);
 deck('Second car approach',-16,-10,-18,-14,8);
 // A stable freight pocket on the balcony is also a real portal-bearing floor.
 const pocket=k.panel('upper-pocket',[-18,8.025,4],[0,1,0],4,9);
 deck('Second observation ledge',-15,-6,-19,-14,16);
 deck('Upper return approach',-6,0,-19,-14,16);
 // The third cabin exits onto the underside of the original source view.
 deck('Final exchange deck',-16,0,-22,-14,22);
 const finalPocket=k.panel('final-pocket',[-12,22.025,-17],[0,1,0],4.6,6);
 // Source and mirror faces stay low: neither is a shortcut to a higher deck.
 k.panel('light-intake',[23.4,3,-14],[-1,0,0],5.6,6);
 k.panel('light-output',[-6,3,0],[-1,0,0],5.6,6);
 k.panel('gravity-return',[-14,2.3,3.4],[1,0,0],4.4,4.6);
 const cradle=k.pad('mirror-cradle',[-12,0,0],6,10);
 w.box([-8.5,.8,3.4],[.25,1.6,4],w.materials.trim);
 const first=opticalLift(k,'first-cage',[-12,0,12],{top:8}),second=opticalLift(k,'second-cage',[-12,8,-12],{top:16}),returnCar=opticalLift(k,'return-cage',[-2,16,-12],{top:22});
 const optical=exchangeOptics(k,cradle,first,second,returnCar);
 // The loaded branch spins two freight offloaders. Their stored angular
 // momentum survives borrowing the portals briefly, carrying arriving cargo
 // clear of the floor aperture before the motor coasts down. No latch/stage.
 const drive={speed:0};k.state.offloaderDrive=drive;const offloaders=[];
 k.ticks.push(dt=>{drive.speed=THREE.MathUtils.damp(drive.speed,optical.receivers[1]?3:0,optical.receivers[1]?.55:.12,dt);offloaders.forEach(f=>{f.enabled=drive.speed>.02;f.motorSpeed=drive.speed/3;});});k.resets.push(()=>{drive.speed=0;});
 offloaders.push(buildTransferFunnel(k,{origin:[-18,9,.5],direction:[0,0,1],radius:1.2,speed:6}));
 offloaders.push(buildTransferFunnel(k,{origin:[-12,23,-21],direction:[0,0,1],radius:1.2,speed:6}));
 w.box([-18,9.75,7],[4,1.7,.25],w.materials.wall);
 w.box([-12,23.75,-16],[4.6,1.7,.25],w.materials.wall);
 k.forces.push(()=>{if(game.heldCube||!game.physics?.cargoBody)return;const b=game.physics.cargoBody;for(const field of offloaders){const a=field.acceleration(V(b.position.x,b.position.y,b.position.z),V(b.velocity.x,b.velocity.y,b.velocity.z),.5).multiplyScalar(Math.min(1,drive.speed));if(a.lengthSq()){b.wakeUp();b.force.x+=a.x*b.mass;b.force.y+=a.y*b.mass;b.force.z+=a.z*b.mass;}}});

 // Solid, narrow guide columns make the common loaded branch readable.
 k.wire([[-12,2,9],[-15,2,9],[-15,2,12],[-15,1,12]],()=>optical.receivers[1]);
 k.wire([[-12,2,9],[-7,2,9],[-7,15,9],[-2,15,9],[-2,15,-12]],()=>optical.receivers[1]);
 k.wire([[-12,2,-9],[-15,2,-9],[-15,2,-12],[-15,7,-12]],()=>optical.receivers[0]);
 // The last crossing has no portal target at the destination. The traveller
 // must steer out of the actual suspended field and fall onto an offset bay.
 deck('Offset receiving bay',-6,7,-2,8,20);
 w.box([7.2,22.2,3],[.35,4.4,10],w.materials.wall);
 w.box([.5,20.7,8.2],[13,1.4,.35],w.materials.wall);
 const funnel=buildTransferFunnel(k,{origin:[-8,23.9,-21],direction:[0,0,1],radius:2.15,speed:6});k.state.funnel=funnel;
 // Optical work diverts the common air supply into freight offloaders.
 // Releasing that real branch opens the final transfer lane again.
 k.ticks.push(()=>{funnel.enabled=!optical.receivers[1];});
 k.control('reverse',[-4,22,-19],()=>{funnel.reversed=!funnel.reversed;},'E — изменить направление верхнего потока');
 k.forces.push(()=>{if(game.heldCube||!game.physics?.cargoBody)return;const b=game.physics.cargoBody,a=funnel.acceleration(V(b.position.x,b.position.y,b.position.z),V(b.velocity.x,b.velocity.y,b.velocity.z),.5);if(a.lengthSq()){b.wakeUp();b.force.x+=a.x*b.mass;b.force.y+=a.y*b.mass;b.force.z+=a.z*b.mass;}});
 const level=k.finish([-18,0,17],[-16,.55,17],[2,20,3],{workshop:k,portalPuzzle:true,cargoOnAnyPad:()=>[cradle.surface,pocket,finalPocket].some(s=>cargoLoadsPlate(game.cargo,game.heldCube,s.getFrame())),playerAcceleration:(p,v)=>funnel.acceleration(p.clone().add(V(0,1.2,0)),v,.46,{centering:.8,damping:2})});
 level.conceptLesson={position:[-18,8,3],range:5,key:'↻',text:'Инерция сохраняет вращение после потери питания. Малый поток переносит груз в карман и постепенно затихает.'};
 level.mechanismArt={projectors:[{position:optical.source.toArray(),direction:optical.direction.toArray(),radius:.5}],turbines:[funnel,...offloaders],liftSurfaces:['first-cage','second-cage','return-cage'],gimbals:[{pivot:optical.pivot,normalAxis:'x'}]};
 level.puzzleGeometry={footprint:48*44,goalHeight:20,orders:['cargo-first','scout-first'],noProgressFlags:true,portalRoles:{'light-intake':'collect the source ray for either live optical branch','light-output':'feed the spring-loaded reflector','mirror-cradle':'weight and unload the same physical reflector','gravity-return':'drop the travelling load back onto the original mirror through its low side throat','upper-pocket':'retain the original cargo while the optical branch changes','final-pocket':'recover the same counterweight before the last airborne crossing'},deductions:['one reflected ray chooses between two real motors','a permanent gallery preserves height when portals release power','flywheel momentum offloads cargo while the same portals are borrowed from its motor','the first receiving pocket becomes the next outgoing freight floor','the same original load is needed again after its removal opened the middle path','steer out of a real field and land below its axis'],stableCargoPockets:['upper-pocket','final-pocket']};
 return level;
}
export {runRoom20} from './LabRoom20Journey.js';
