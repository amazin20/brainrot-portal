import * as THREE from 'three';
import {Workshop,V} from './LabWorkshopKit.js';
import {configureChapterWorld} from './LabChapterArt.js';
import {buildRoom30Art} from './LabRoom30Art.js';

export const ROOM30_SPEC={id:'sunward-limit',title:'Предел',concept:'Запуск в главном исследовательском ангаре: две дуги к разным островам, сохранённая высота и поворот выходного полотна',description:'Исследуй ангар, выбери дугу и возьми друга в самый большой полёт.',accent:0xffce65,assets:[1,2,11,22,23,24],hints:['Высокий колодец даёт импульс. Северная и восточная белые чаши ведут на два отдельных острова; на каждом свой второй колодец.','На промежуточном острове можно сохранить высоту, спокойно переставить порталы и повернуть свой последний выход. Если промахнулся, нижний технический этаж и пара возвратных панелей позволяют подняться обратно.','Закрепи друга клавишей E. Соедини пол первого колодца с одной из двух наклонных чаш, разбегись и отпусти движение в падении. На выбранном острове поверни выход вверх, соедини с ним местный колодец и повтори полёт.']};

export function buildRoom30(game,index=29){
 const k=new Workshop(game,ROOM30_SPEC,index),w=k.world;configureChapterWorld(w,'launch');
 // Keep the shell around the actual two launch arcs, their islands and the
 // lower recovery route. The flight panels retain their original coordinates.
 k.bounds={minX:-50,maxX:228,minZ:-88,maxZ:72};k.ceiling=84;
 const hangarWidth=k.bounds.maxX-k.bounds.minX,hangarDepth=k.bounds.maxZ-k.bounds.minZ;
 const hangarCenter=[(k.bounds.minX+k.bounds.maxX)/2,(k.bounds.minZ+k.bounds.maxZ)/2];
 // Both ballistic paths peak below 70 m (the guide collars below 77 m).
 // Closing the unused thirty metres above them makes this feel like a working
 // launch hall instead of an empty painted skybox, without narrowing a shot.
 const roof=w.box([hangarCenter[0],k.ceiling+1,hangarCenter[1]],[hangarWidth+2,2,hangarDepth+2],w.materials.wall);
 roof.name='Solid hangar roof';
 for(const x of [k.bounds.minX-.7,k.bounds.maxX+.7]){
  const side=w.box([x,k.ceiling/2,hangarCenter[1]],[1.4,k.ceiling+2,hangarDepth+2],w.materials.wall);
  side.name='Solid hangar side wall';
 }
 for(const z of [k.bounds.minZ-.7,k.bounds.maxZ+.7]){
  const end=w.box([hangarCenter[0],k.ceiling/2,z],[hangarWidth+2,k.ceiling+2,1.4],w.materials.wall);
  end.name='Solid hangar end wall';
 }
 for(const z of [-76,-42,-8,26,60]){
  w.box([hangarCenter[0],k.ceiling-2.6,z],[hangarWidth,1.2,1.0],w.materials.trim);
  w.box([hangarCenter[0],k.ceiling-3.25,z],[44,.12,.65],w.materials.lamp,false);
 }
 const deck=(name,x0,x1,z0,z1,y)=>w.floor(x0,x1,z0,z1,y,{name});
 // A continuous physical service deck catches misses. Returning from it uses the
 // same two ordinary portals; there are no checkpoint warps or route flags.
 const recovery=w.box([hangarCenter[0],-.3,hangarCenter[1]],[hangarWidth,.6,hangarDepth],w.materials.floor);recovery.name='Lower hangar service deck';
 const recoveryFloor={...k.bounds,y:0,mesh:recovery,enabled:true};game.floors.push(recoveryFloor);w.floors.push(recoveryFloor);
 deck('Launch garden hub',-23.5,28,-22,26,52);
 deck('West hub gallery',-32,-23.5,-22,15,52);
 deck('Return portal rear footing',-32,-28,15,26,52);
 deck('West well viewing balcony',-32,-22,-42,-22,52);
 deck('Northern dive lip',-4.5,4.5,-25,-22,52);
 deck('Shared observation island',44,80,-3,35,40);
 deck('Island well viewing balcony',32,44,24,54,40);
 deck('Second dive lip',55.5,64.5,35,38,40);
 // The eastern first arc lands here instead of returning to the shared
 // island. The gap between x=80 and x=95 remains open to the service deck.
 deck('Eastern observation island',95,138,-3,35,40);
 deck('Eastern well viewing balcony',95,106,35,54,40);
 deck('Eastern second dive lip',115.5,124.5,35,38,40);
 deck('Sunward arrival island',183,218,2,42,28);
 // A screen hides the final outlet from every ground-supported point in the
 // opening hub. The two first arcs arrive on opposite sides of its near end.
 const sightlineScreen=w.box([120,46,-53],[1.1,92,64],new THREE.MeshStandardMaterial({color:0x326caf,roughness:.58,metalness:.14}));
 sightlineScreen.name='Hub-to-outlet sightline screen';
 sightlineScreen.userData.keepMaterial=true;
 // Walk around either side of this planted observatory to see the first
 // receivers, which now carry the pair to separate observation islands.
 w.box([-1,56,7],[16,8,12],w.materials.wall);
 w.box([-21,54,-6],[4,4,9],w.materials.trim);
 w.box([19,54,8],[4,4,9],w.materials.trim);
 const panel=(name,pos,normal,width=9,height=10,moving=false)=>{
  const p=k.panel(name,pos,normal,width,height,w.root,moving);
  Object.assign(p.mesh.userData,{velocitySnapCenter:true,portalSize:{width:2.2,height:2.8},portalUp:Math.abs(normal[1])>.9?V(0,0,-1):V(0,1,0)});
  p.collider.frontPlane=()=>p.getFrame();p.mesh.userData.portalColliderId=p.mesh.uuid;
  const backing=game.colliders.find(c=>c.mesh===p.backing);
  if(backing){backing.frontPlane=()=>p.getFrame();p.mesh.userData.portalBackingIds=[p.backing.uuid];}
  return p;
 };
 const first=panel('first-well',[0,16,-32],[0,1,0]);
 const north=panel('north-arc',[60,55,-62],[0,.62,Math.sqrt(1-.62**2)]);
 const east=panel('east-arc',[188,55,20],[-Math.sqrt(1-.62**2),.62,0]);
 const second=panel('second-well',[60,6,45],[0,1,0]);
 second.mesh.userData.portalUp=V(0,0,1);
 const eastSecond=panel('east-second-well',[120,6,45],[0,1,0]);
 eastSecond.mesh.userData.portalUp=V(0,0,1);
 const final=panel('sunward-outlet',[200,43,-68],[0,0,1],10,11,true);
 const eastFinal=panel('east-sunward-outlet',[100,52,34],[1,0,0],10,11,true);
 const lowerReturn=panel('lower-return',[-32,3.5,16],[1,0,0],6,7);
 const hubReturn=panel('hub-return',[-27,58.5,20],[1,0,0],6,7);
 for(const p of [first,second,eastSecond]){
  const c=p.getFrame().center;
  const f={minX:c.x-4.5,maxX:c.x+4.5,minZ:c.z-5,maxZ:c.z+5,y:c.y,mesh:p.mesh,enabled:true};
  game.floors.push(f);w.floors.push(f);
 }
 const tilt={angle:0,target:0},eastTilt={angle:0,target:0};k.state.tilt=tilt;k.state.eastTilt=eastTilt;
 const syncMovingPanel=(p,dt)=>{
  p.group.updateWorldMatrix(true,true);p.collider.box.setFromObject(p.mesh);
  game.physics?.updateStaticBox(p.mesh.uuid,p.collider.box,dt);
  const backing=game.colliders.find(c=>c.mesh===p.backing);
  if(backing){backing.box.setFromObject(p.backing);game.physics?.updateStaticBox(backing.mesh.uuid,backing.box,dt);}
 };
 const updateTilt=dt=>{
  tilt.angle=THREE.MathUtils.damp(tilt.angle,tilt.target,3,dt);
  final.group.quaternion.setFromUnitVectors(V(0,0,1),V(0,Math.sin(tilt.angle),Math.cos(tilt.angle)));
  syncMovingPanel(final,dt);
  eastTilt.angle=THREE.MathUtils.damp(eastTilt.angle,eastTilt.target,3,dt);
  eastFinal.group.quaternion.setFromUnitVectors(V(0,0,1),V(Math.cos(eastTilt.angle),Math.sin(eastTilt.angle),0));
  syncMovingPanel(eastFinal,dt);
 };
 k.control('outlet-angle',[48,40,23],()=>{tilt.target=tilt.target>0?0:Math.asin(.68);},'E — повернуть чашу последнего полёта');
 k.control('east-outlet-angle',[102,40,23],()=>{eastTilt.target=eastTilt.target>0?0:Math.asin(.68);},'E — повернуть восточную чашу к финишу');
 k.ticks.push(updateTilt);k.resets.push(()=>{tilt.angle=tilt.target=eastTilt.angle=eastTilt.target=0;updateTilt(0);});
 const wells=[{panel:first,top:52},{panel:second,top:40},{panel:eastSecond,top:40}];
 const acceleration=(p,v)=>{
  if(game.playerGrounded&&Math.hypot(v.x,v.z)>15.5)return V(-v.x*8,0,-v.z*8);
  for(const well of wells){const c=well.panel.getFrame().center;
   if(p.y<well.top-.03&&p.y>c.y-.5&&Math.abs(p.x-c.x)<9&&Math.abs(p.z-c.z)<17)
    return V(THREE.MathUtils.clamp((c.x-p.x)*20-v.x*8,-80,80),0,THREE.MathUtils.clamp((c.z-p.z)*20-v.z*8,-80,80));
  }
  return V();
 };
 const flightTarget=()=>{
  for(let slot=0;slot<2;slot++)for(const well of wells)if(game.portalSurfaceIds?.[slot]===well.panel.mesh.uuid)return {panel:well.panel.mesh,slot};
  return null;
 };
 // Start well within the launch garden: the old x=-23 start was only half a
 // metre from its western drop, putting the player's feet on the visual rim.
 const level=k.finish([-17,52,16],[-14.5,52.6,16],[200,28,31],{workshop:k,portalPuzzle:true,kineticCourse:true,playerAcceleration:acceleration,
  getFlightTarget:flightTarget,getShotTargets:()=>Object.values(k.panels).flatMap(p=>[0,1].map(slot=>({panel:p.mesh,slot}))),
  getContextLesson:()=>game.velocityCompanion?.connected&&!game.playerGrounded?['room30-focus',globalThis.matchMedia?.('(pointer:coarse)')?.matches?'↘':'Q',globalThis.matchMedia?.('(pointer:coarse)')?.matches?'Отпусти джойстик: импульс уже набран. Кольца ведут к широкой площадке.':'Отпусти движение: импульс уже набран. Удерживай Q, если нужно прицелиться в полёте.',false]:!game.velocityCompanion?.connected?['room30-stabilizer','E','Закрепи друга рядом: руки останутся свободны для порталов.',false]:game.playerPosition.y<3?['room30-return','↔','Промах — это нижний технический этаж. Две белые возвратные панели поднимут вас обратно.',false]:game.playerPosition.x<30?['room30-choice','↘','Две наклонные чаши ведут на разные острова. Выбери свою траекторию до прыжка.',false]:game.playerPosition.x<145?['room30-outlet','E','На каждом острове свой пульт, колодец и последняя чаша. Поверни свой выход к финишу.',false]:null,
 });
 level.spawnView={yaw:0,pitch:-.1};
 level.conceptLesson={position:[0,52,-16],range:35,key:'Q',text:'В полёте удерживай Q, чтобы спокойно навести камеру. Скорость вернётся, когда отпустишь.'};
 level.puzzleGeometry={footprint:hangarWidth*hangarDepth,noProgressFlags:true,goalHeight:28,recoveryFloor:0,firstRoutes:['north-arc','east-arc'],portalRoles:{'first-well':'gravity reservoir for either first route','north-arc':'north-to-south trajectory onto the central island','east-arc':'east-to-west trajectory onto the separate eastern island','second-well':'central second gravity reservoir','east-second-well':'eastern second gravity reservoir','sunward-outlet':'north route rotated final launch','east-sunward-outlet':'east route rotated final launch from another angle','lower-return':'shared recoverable floor','hub-return':'return to launch garden'},deductions:['two first arcs reach separate fixed islands at the same retained height','each island has its own second gravity well and physically rotated outlet','the final outlets are hidden from the initial ground-supported hub','different final portal normals yield different ballistic approaches','only real joint arrival at the finish wins']};
 level.flightGeometry={wells,first,north,east,second,eastSecond,final,eastFinal,lowerReturn,hubReturn};
 const diagnostics=level.diagnostics;level.diagnostics=()=>({...diagnostics(),kineticCourse:true,epicMode:Boolean(game.epicMode),tilt:tilt.angle,eastTilt:eastTilt.angle,connected:Boolean(game.velocityCompanion?.connected),peakSpeed:level.peakSpeed||0});
 k.ticks.push(()=>{level.peakSpeed=Math.max(level.peakSpeed||0,game.playerVelocity.length());});k.resets.push(()=>{level.peakSpeed=0;});
 const art=buildRoom30Art(level);const render=level.renderUpdate;level.renderUpdate=(a=1,time)=>{render(a);art.update(a,time);};
 return level;
}
export {runRoom30} from './LabRoom30Journey.js';
