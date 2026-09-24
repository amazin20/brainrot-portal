import * as THREE from 'three';
import {Workshop} from './LabWorkshopKit.js';
import {opticalLift} from './LabRoom13Mechanics.js';
import {buildRoom25Optics} from './LabRoom25Optics.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
import {SolidAssembly,placeSolidModel} from './LabSolidModels.js';
export const ROOM25_SPEC={id:'opposed-shadows',title:'Обратная сторона тени',concept:'Один противовес открывает первый луч и перекрывает второй',description:'Свету мешает сама машина. Друг должен уйти с опоры, прежде чем откроется следующая высота.',accent:0xcab48c,assets:[1,2,11,22,23,24],hints:['Две тёмные заслонки связаны одним противовесом. Груз сдвигает их в противоположные стороны.','Сначала сохрани достигнутую высоту на неподвижной галерее. Снятый с опоры друг меняет настоящий путь света.','Освещённый первый приёмник питает также привод весовой платформы. С верхней галереи можно поднять её вместе с другом и забрать его с бокового балкона или переправить через порталы.']};

/** Large structural bays and the real 9m/18m deck edges form an optical
 * instrument, not a sequence of indistinguishable white corridors. Everything
 * here is thin finish against existing physical walls or below actual floors.
 * There are no free-standing, visible-but-passable columns in the walkway. */
function finishShadowHall(k,optical){
 const w=k.world,a=new SolidAssembly('Opposed shadows / instrument hall finish','launch');
 a.materials[0].color.setHex(0x778995);a.materials[1].color.setHex(0x304550);
 a.materials[2].color.setHex(0xd6ae70);a.materials[3].color.setHex(0x44555e);
 const plate=(p,s,material=1)=>a.box(p,s,material,.025,false);
 // The west exterior face dominated the opening shot. Keep the authored tile
 // relief, change its finish to a cool machine-hall enamel, and give every
 // projecting rib a real collider attached to that already solid wall.
 const west=w.surfaces.find(surface=>surface.getFrame().normal.x>.9&&Math.abs(surface.getFrame().center.x+22)<.1);
 if(west){
  west.group.userData.keepMaterial=true;
  const enamel=new THREE.MeshStandardMaterial({color:0x547280,roughness:.71,metalness:.12});
  west.group.traverse(node=>{if(node.isInstancedMesh&&!node.userData.portalTile)node.material=enamel;});
 }
 const westRibs=new SolidAssembly('West hall wall / physical machine ribs','launch');
 westRibs.materials[1].color.setHex(0x2f4854);
 for(const z of [-20,-12,-4,4,12,20])westRibs.box([-21.88,12.4,z],[.28,24.5,.25],1,.045);
 for(const y of [1.7,8.7,17.8,24.5])westRibs.box([-21.88,y,1.5],[.26,.22,45.5],1,.045);
 placeSolidModel(k,westRibs.finish());
 // The same weight operates shutters at opposite heights. Vertical bays
 // behind them give each a recognizable motor well rather than a flat wall.
 for(const x of [-11.7,-6.55,-1.4,3.75,8.9,14.05,19.7])plate([x,4.5,-11.765],[.18,8.7,.18]);
 plate([4,8.82,-11.76],[31.8,.26,.18]);
 for(const x of [-7.7,-2.1,3.55])plate([x,18.0,-11.765],[.18,17.2,.18]);
 for(const x of [14.35,17,19.65])plate([x,18.0,-11.765],[.18,17.2,.18]);
 plate([-2,26.50,-11.755],[11.8,.36,.20]);
 plate([17,26.50,-11.755],[5.9,.36,.20]);
 // The reverse face of the upper screen is exactly what the player sees
 // while lining up the final relay. Give that real opaque screen a deep
 // instrument casing and live lower/upper receiver indicators.
 for(const x of [14.38,19.62])plate([x,13.5,-12.245],[.26,26.8,.17]);
 for(const y of [2.5,8.7,15.3,21.5,26.45])plate([17,y,-12.245],[5.15,.19,.17]);
 plate([17,19.1,-12.265],[4.12,3.45,.09],3);
 for(const [x,y] of [[15.75,18.55],[18.25,19.65]]){
  plate([x,y,-12.315],[.80,1.75,.09],1);
  plate([x,y-1.12,-12.330],[.92,.12,.07],2);
 }
 // The large return bulkhead fills the camera during the floor-portal shot.
 // Its lower and upper faces are physical; the 1.35 m sight slit between them
 // remains completely open and is framed by the same manufactured ribs.
 for(const z of [15.45,17.8,20.15,22.5,24.55]){
  plate([-10.50,7.0,z],[.15,13.8,.20],1);
  plate([-10.50,21.38,z],[.15,10.90,.20],1);
 }
 for(const y of [1.4,6.65,12.6,17.45,24.3])plate([-10.49,y,20],[.16,.20,9.8],y===12.6||y===17.45?2:1);
 // Matching soffits visually connect permanent landings without painting
 // over portal ceramic or adding walkable platforms at false heights.
 for(const [p,s] of [
  [[1,8.80,-11.945],[37.7,.28,.17]],
  [[13,8.80,-7.96],[13.8,.28,.17]],
  [[15.5,17.80,-8.95],[8.7,.27,.17]],
  [[-13,8.80,-17.94],[9.8,.25,.17]],
 ])plate(p,s,1);
 for(const [p,s] of [
  [[1,8.88,-11.845],[37.5,.045,.055]],
  [[13,8.88,-7.865],[13.7,.045,.055]],
  [[15.5,17.88,-8.855],[8.6,.045,.055]],
 ])plate(p,s,2);
 // Recessed four-corner seat around the actual freight plate. It is flush
 // with the floor and outside the ceramic mouth, so carrying a friend onto
 // the counterweight remains unrestricted.
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const x=-7+sx*3.05,z=12+sz*3.05;
  plate([x,.012,z+sz*.28],[.12,.018,.62],3);
  plate([x+sx*.28,.012,z],[.62,.018,.12],2);
 }
 const model=a.finish();model.userData.visualOnly=true;model.userData.solidModel=false;delete model.userData.collisionParts;w.root.add(model);
 const indicatorMaterials=[0,1].map(()=>new THREE.MeshBasicMaterial({color:0x263943}));
 for(const [i,x,y] of [[0,15.75,18.55],[1,18.25,19.65]]){
  const lens=w.box([x,y,-12.385],[.43,1.18,.035],indicatorMaterials[i],false);
  lens.name=i?'Upper optical receiver status':'Lower optical receiver status';lens.userData.keepMaterial=true;
 }
 k.ticks.push(()=>indicatorMaterials.forEach((material,i)=>material.color.setHex(optical.receivers[i]?0xffc35a:0x263943)));
 return model;
}
export function buildRoom25(game,index=24){
 const k=new Workshop(game,ROOM25_SPEC,index),w=k.world;k.shell({minX:-22,maxX:22,minZ:-22,maxZ:25},27);w.highFidelity=true;
 const deck=(name,a,b,c,d,y)=>w.floor(a,b,c,d,y,{name});
 const baffle=new THREE.MeshStandardMaterial({color:0x49636e,roughness:.63,metalness:.16});
 const returnWall=new THREE.MeshStandardMaterial({color:0x58727a,roughness:.73,metalness:.09});
 const backedScreen=(position,size,material=baffle)=>{
  const mesh=w.box(position,size,material);mesh.userData.keepMaterial=true;return mesh;
 };
 const pad=k.pad('shadow-counterweight',[-7,0,12],4.8,4.8);
 const hoist={height:0,target:0,velocity:0};k.state.counterweightHoist=hoist;
 const padFloor=w.floors.find(f=>f.mesh===pad.surface.mesh);
 // Replace this room's plate tick so its real portal face and floor collider
 // move together. The ordinary plate and every other room keep their tick.
 k.ticks.pop();
 k.ticks.push(dt=>{
  const oldFloorY=padFloor.y;
  const aboard=game.playerGrounded&&Math.abs(game.playerPosition.y-oldFloorY)<.2
   &&Math.abs(game.playerPosition.x+7)<2.4&&Math.abs(game.playerPosition.z-12)<2.4;
  pad.pressed=pad.loaded()||pad.player();
  pad.progress=THREE.MathUtils.damp(pad.progress,pad.pressed?1:0,12,dt);
  const acceleration=THREE.MathUtils.clamp((hoist.target-hoist.height)*2-hoist.velocity*3,-3,3);
  hoist.velocity=THREE.MathUtils.clamp(hoist.velocity+acceleration*dt,0,1.4);
  hoist.height=Math.min(9,hoist.height+hoist.velocity*dt);
  if(hoist.height===9)hoist.velocity=0;
  pad.surface.group.position.y=.18-.055*pad.progress+hoist.height;
  pad.surface.group.updateWorldMatrix(true,true);padFloor.y=pad.surface.group.position.y;
  if(aboard){game.playerPosition.y+=padFloor.y-oldFloorY;game.previousPlayerPosition.y+=padFloor.y-oldFloorY;}
  pad.surface.collider.box.setFromObject(pad.surface.mesh);
  game.physics?.updateStaticBox(pad.surface.mesh.uuid,pad.surface.collider.box,dt);
 });
 k.resets.push(()=>{hoist.height=hoist.target=hoist.velocity=0;});
 k.panel('light-intake',[9,3,16],[1,0,0],5.6,6);
 k.panel('lower-relay',[-18,3,-6],[1,0,0],5.6,6);
 k.panel('freight-receiver',[0,11.3,-15.4],[-1,0,0],3.4,4.6);
 k.panel('upper-relay',[5,11.3,-6],[1,0,0],5.6,4.6);
 k.panel('return-entry',[19.9,20.3,-15.4],[-1,0,0],3.4,4.6);
 k.panel('home',[-17,13.6,23],[1,0,0],3.4,4.6);
 const first=opticalLift(k,'shadow-lift',[-14,0,-10],{top:9,width:4,depth:4});
 const second=opticalLift(k,'relay-lift',[16,9,-10],{top:18,width:4,depth:4});
 deck('Permanent shadow landing',-18,-8,-18,-12,9);deck('Upper optical exchange',-8,20,-18,-12,9);
 deck('Relay observation arm',6,20,-12,-8,9);deck('High reverse overlook',11,20,-18,-9,18);deck('High inspection prow',11,14,-9,-5,18);
 deck('Shadow inspection bridge',-16,-5,-11,-8,9);deck('Counterweight inspection arm',-9,-5,-8,8,9);
 deck('Counterweight hoist side landing',-11,-9.45,8,12,9);
 backedScreen([-2,18,-12],[12,18,.3]);backedScreen([17,13.5,-12],[6,27,.3]);backedScreen([11.1,13.5,-13.75],[.3,27,8.5]);
 // Opaque base and raised side screens hide the upper receiver from every
 // lower-floor firing angle. The two paths meet on occupied galleries.
 backedScreen([4,4.5,-12],[32,9,.3]);
 w.box([5.8,4.5,-7],[.3,9,10],w.materials.wall);w.box([20.2,13.5,-10],[.3,27,16],w.materials.wall);
 backedScreen([6,13.5,-18.2],[28,27,.3]);
 w.box([-8.2,13.5,-16],[.3,27,4],w.materials.wall);
 // The second relay is behind its own solid backing; only the east side
 // of the first gallery gives a valid shot onto its front face.
 w.box([4.8,7,-6],[.3,14,6],w.materials.wall);
 // Exit lies behind the arrival view. Its 1.35m sight slit passes a shot
 // from the high overlook, never a standing player or a low-floor aim.
 deck('Home receiving chamber',-22,-11,15,25,7);
 backedScreen([-10.8,7.1,20],[.4,14.2,10],returnWall);
 backedScreen([-10.8,21.275,20],[.4,11.45,10],returnWall);
 w.box([-16.5,13.5,14.8],[11.4,27,.4],w.materials.wall);
 w.box([-16.5,21,20],[11.4,.3,10],w.materials.wall);
 const optical=buildRoom25Optics(k,pad,first,second);
 // The existing plate doubles as a guided freight hoist. Its motor can start
 // only after the *actual* first receiver is lit while the companion loads
 // the plate. The same moving collider supports the original physics body;
 // taking the friend off it then reverses both shutter blades as before.
 k.control('counterweight-hoist',[-8,9,7],()=>{
  if(optical.receivers[0]&&pad.loaded())hoist.target=9;
 },'E — свет нижнего приёмника поднимает весовую платформу к боковому балкону');
 for(const x of [-9.6,-4.4])w.box([x,4.5,12],[.12,9,.15],w.materials.trim,false);
 const shadowHall=finishShadowHall(k,optical);
 const level=k.finish([-17,0,10],[-15,.55,9],[-16,7,22],{workshop:k,portalPuzzle:true,cargoOnAnyPad:()=>cargoLoadsPlate(game.cargo,game.heldCube,pad.surface.getFrame())});
 level.shadowHall=shadowHall;
 level.mechanismArt={projectors:[{position:optical.source.toArray(),direction:optical.direction.toArray(),radius:.5}],liftSurfaces:['shadow-lift','relay-lift']};
 level.conceptLesson={position:[-7,0,12],range:4,key:'E',text:'Две заслонки соединены с одной опорой. Нагрузка освобождает один луч и перекрывает другой.'};
 level.puzzleGeometry={footprint:2068,goalHeight:7,orders:['portal-freight-transfer','receiver-powered-plate-hoist'],noProgressFlags:true,sightSlot:{x:-10.8,minY:14.2,maxY:15.55},portalRoles:{'light-intake':'one source for both physical optical circuits','lower-relay':'illuminate the first lift only after its shutter clears','shadow-counterweight':'weight opens the first beam, then leaves through this floor or rises on its receiver-powered hoist','freight-receiver':'retain the same original companion above the first crossing','upper-relay':'the second optical circuit is clear only when the counterweight is unloaded','return-entry':'return from the high reverse overlook','home':'reach the back of the start through its high sight slit'},deductions:['cargo removes a real opaque obstruction','leave a powered car on a permanent ledge','the first live receiver can raise the loaded counterweight itself','retrieval reverses two connected shutters','reuse the source through the upper relay after cargo retrieval','higher observation exposes the back of the starting room']};
 return level;
}
export {runRoom25} from './LabRoom25Journey.js';
