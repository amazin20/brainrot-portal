import * as THREE from 'three';
import {Workshop,V} from './LabWorkshopKit.js';
import {buildTransferFunnel} from './LabTransferFunnel.js';
import {cargoLoadsPlate} from './LabPlateContact.js';

export const ROOM26_SPEC={id:'crossflow-foundry',title:'Перекрёстная тяга',concept:'Два пересекающихся потока, один живой груз и дважды заимствованная портальная магистраль',description:'Сохрани высоту, освободи магистраль и забери того, кто держит её открытой.',accent:0xe2ad79,assets:[1,2,11,22,23,24],hints:['Заслонка открыта, пока плита нагружена. Один и тот же поток можно направить в разные шахты.','Постоянная галерея сохраняет достигнутую высоту, когда порталы меняют назначение. Второй белый пол виден сверху.','Наверху освободи пару от подъёмного потока и извлеки друга прямо из его опоры. Поперечный поток останется работающим; его реверс находится на верхнем причале.']};

/** Add real field accelerations while cancelling gravity only once where two
 * visible streams intersect. There is no attachment or position correction. */
export function crossflowAcceleration(fields,position,velocity,radius,options){
 const result=V();let active=0;
 for(const field of fields){const force=field.acceleration(position,velocity,radius,options);if(force.lengthSq()>1e-8){result.add(force);active++;}}
 if(active>1)result.y-=19.5*(active-1);
 return result;
}

export function buildRoom26(game,index=25){
 const k=new Workshop(game,ROOM26_SPEC,index),w=k.world;
 k.bounds={minX:-24,maxX:24,minZ:-24,maxZ:24};k.ceiling=25;w.walls(k.bounds,25,-1);
 w.materials.wall.color.setHex(0x414b50);w.materials.floor.color.setHex(0x747a76);
 const deck=(name,x0,x1,z0,z1,y)=>w.floor(x0,x1,z0,z1,y,{name});
 deck('Foundry recovery foundation',-24,24,-24,24,0);
 // Each permanent platform is lower than the next inaccessible floor. The
 // lower foundation catches both bodies and never changes puzzle state.
 deck('First shaft retaining balcony',-16,-8,-1,6.8,8);
 deck('West folded service gallery',-24,-16,-18,5,8);
 deck('North service gallery',-24,18,-23,-16,8);
 deck('Relay approach',10.5,18,-23,-5,8);
 deck('Upper inspection dock',4,18,-23,-11,16);
 deck('Crossflow side retaining dock',14.5,19,-19,2,16);
 deck('Upper north retaining link',-24,4,-23,-19,16);
 deck('Return observation arm',-24,-20,-19,12,16);
 deck('Far receiving dock',6,20,13,23,16);
 // Tall bulkheads hide the second up-facing ceramic until the observer has
 // walked around the first gallery. They cannot be jumped from the foundation.
 w.box([-6,12,-8],[.4,24,16],w.materials.wall);
 w.box([6,4,-4.6],[24,8,.4],w.materials.wall);
 // A full-height spine leaves only the high conveyor tunnel. Neither the
 // ground nor the eight-metre gallery can walk into the final receiving dock.
 w.box([14,8,7],[20,16,.4],w.materials.wall);
 w.box([-7.5,21,7],[23,8,.4],w.materials.wall);
 w.box([21,21,7],[6,8,.4],w.materials.wall);
 w.box([12,24,7],[16,2,.4],w.materials.wall);
 // Shafts have visible upper stops; they let novices leave a flowing column
 // without racing an exact height, and do not create climbable shortcuts.
 w.box([-12,13.8,8],[5.5,.4,5.5],w.materials.trim);
 w.box([12,23,-8],[5.5,.4,5.5],w.materials.trim);
 const lower=k.panel('first-shaft',[-12,.025,8],[0,1,0],5.6,5.6);
 const relay=k.panel('relay-shaft',[12,8.025,-8],[0,1,0],5.6,5.6);
 k.panel('pressure-intake',[-7.6,2.6,-12],[-1,0,0],5.6,5.2);
 const load=k.pad('valve-load',[-17,0,21],5.6,5.6);k.state.load=load;
 k.panel('freight-receiver',[7,18.3,-18.8],[0,0,1],5.6,4.6);
 // A deep dogleg receiving bay cannot be addressed from either lower floor.
 w.box([7,8.75,-11.8],[6.4,17.5,.35],w.materials.wall);
 w.box([3.8,12.5,-15.4],[.35,25,7.2],w.materials.wall);
 w.box([10.2,8,-15.4],[.35,16,7.2],w.materials.wall);
 w.box([10.2,23,-15.4],[.35,4,7.2],w.materials.wall);
 w.box([8.7,12.5,-17.5],[.3,25,3],w.materials.wall);
 w.box([7,22,-15.4],[6.4,.35,7.2],w.materials.wall);
 // The plate drives one damped sliding guillotine. Collision and ray tracing
 // use its actual interpolated box; the source itself remains permanently on.
 const shutterMesh=w.box([-18,2.6,-12],[.35,5.2,5.4],w.materials.wall);
 const shutterCollider=game.colliders.find(c=>c.mesh===shutterMesh);shutterCollider.kinematic=true;
 const shutter={height:2.6,velocity:0,open:false,mesh:shutterMesh,collider:shutterCollider};k.state.shutter=shutter;
 const updateShutter=dt=>{
  const target=load.loaded()||load.player()?8.3:2.6;
  shutter.velocity+=THREE.MathUtils.clamp((target-shutter.height)*12-shutter.velocity*7,-18,18)*dt;
  shutter.height=THREE.MathUtils.clamp(shutter.height+shutter.velocity*dt,2.6,8.3);
  if((shutter.height===2.6&&shutter.velocity<0)||(shutter.height===8.3&&shutter.velocity>0))shutter.velocity=0;
  shutterMesh.position.y=shutter.height;shutterMesh.updateWorldMatrix(true,true);shutterCollider.box.setFromObject(shutterMesh);
  game.physics?.updateStaticBox(shutterMesh.uuid,shutterCollider.box,dt);shutter.open=shutterCollider.box.min.y>2.7;
 };
 k.ticks.push(updateShutter);k.resets.push(()=>{shutter.height=2.6;shutter.velocity=0;updateShutter(0);});
 for(const z of [-14.85,-9.15])w.box([-18,5,z],[.5,10,.25],w.materials.trim);
 k.wire([[-17,.2,21],[-21,.2,21],[-21,.2,-12],[-18,.2,-12]],()=>load.loaded()||load.player());
 const lift=buildTransferFunnel(k,{origin:[-22,2.6,-12],direction:[1,0,0],radius:1.9,speed:5});
 const crossing=buildTransferFunnel(k,{origin:[12,19.7,-22],direction:[0,0,1],radius:2.25,speed:6});
 crossing.reversed=true;k.resets.push(()=>{crossing.reversed=true;});
 k.state.liftFlow=lift;k.state.crossingFlow=crossing;
 const reverse=k.control('crossflow-reverse',[17,16,-16],()=>{crossing.reversed=!crossing.reversed;},'E — реверс поперечного потока');
 const fields=[lift,crossing];
 k.forces.push(()=>{if(game.heldCube||!game.physics?.cargoBody)return;const b=game.physics.cargoBody,a=crossflowAcceleration(fields,V(b.position.x,b.position.y,b.position.z),V(b.velocity.x,b.velocity.y,b.velocity.z),.5);if(a.lengthSq()){b.wakeUp();b.force.x+=a.x*b.mass;b.force.y+=a.y*b.mass;b.force.z+=a.z*b.mass;}});
 const level=k.finish([-19,0,10],[-20,.55,17],[17,16,19],{workshop:k,portalPuzzle:true,playerAcceleration:(p,v)=>crossflowAcceleration(fields,p.clone().add(V(0,1.2,0)),v,.46,{centering:.8,damping:2}),cargoOnAnyPad:()=>load.loaded()||cargoLoadsPlate(game.cargo,game.heldCube,relay.getFrame())});
 level.mechanismArt={turbines:fields};
 level.puzzleGeometry={footprint:48*48,goalHeight:16,safeFloor:0,noProgressFlags:true,orders:['load-first','inspect-first'],portalRoles:{'pressure-intake':'collect the stream behind the real load-operated shutter','first-shaft':'retain the first eight metres on a permanent balcony','relay-shaft':'reuse the source from a second elevated floor','valve-load':'the original companion both powers the shutter and becomes the final retrieval source','freight-receiver':'retrieve the load after preserving the final height'},deductions:['a live load opens an actual air obstruction','a fixed balcony retains height after a portal changes','the second floor is visible only from the attained gallery','a crossing flow can carry the observer past the intended retaining dock','the power source is also the cargo to retrieve through the same pair','removing the load closes only its physical air branch','the independent perpendicular stream carries both travellers across the last closed spine']};
 level.conceptLesson={position:[17,16,-16],range:4,key:'↔',text:'Поперечный поток независим от нижней заслонки. Реверс меняет силу; он не переносит тебя мгновенно.'};
 return level;
}
export {runRoom26} from './LabRoom26Journey.js';
