import * as THREE from 'three';
import {ResearchChamber} from './LabResearchArt.js';
import {movingMechanismBlock} from './LabLateCampaignMechanisms.js';
import {SiphonCircuit} from './LabSiphonCircuit.js';
const V=(...a)=>new THREE.Vector3(...a),Q=()=>new THREE.Quaternion();
export const SIPHON_OBSERVATORY_SPEC=Object.freeze({id:'siphon-observatory',title:'Сифонная обсерватория',accent:0x99bbff,assets:[1,2,11,22],
 concept:'Объём погружённого спутника поднимает жидкость над коленом сифона. Заполненная колонна продолжает течь ниже прежней отметки; вода поднимает пассажирский гидроцилиндр. Та же пара после запуска служит возвращению вместе с грузом.',
 description:'Жидкость стоит ниже прозрачного колена. Гидравлический лифт пуст, а верхний архив разделён разрывом. Найди, как запустить поток и освободить пару порталов.',
 hints:['Уровень жидкости зависит не от нажатой кнопки, а от объёма погружённого тела. Колено должно заполниться без воздуха.',
 'Когда колено заполнено, вода идёт к нижнему цилиндру даже после падения уровня. Обратный клапан удерживает лифт; сервисный насос возвращает воду наверх.',
 'Отправь спутника через загрузочный пол в верхнюю ёмкость, поднимись на гидролифте и верни друга из открытого бака. Перенастрой пару на две верхние галереи.']});

/** Replaces inverse-spring33; no spring, launch receiver or ratchet remains. */
export function buildSiphonObservatory(g,index=32,spec=SIPHON_OBSERVATORY_SPEC){
 const k=new ResearchChamber(g,spec,index,'orbital',{minX:-30,maxX:30,minZ:-30,maxZ:32},0,24),circuit=new SiphonCircuit();
 const tank={x:-16,z:-20,bottom:12,half:.8},top=10.2;
 const slab=(name,x0,x1,z0,z1,y)=>{
  const mesh=k.block([(x0+x1)/2,y-.2,(z0+z1)/2],[x1-x0,.4,z1-z0],'floor');mesh.name=name;const proxy=k.envelopes.at(-1);
  const floor={minX:x0,maxX:x1,minZ:z0,maxZ:z1,y,mesh:proxy.mesh,enabled:true};g.floors.push(floor);k.world.floors.push(floor);return floor;
 };
 k.deck('Hydraulic upper landing',-28,-8,0,12,top);
 const lift=k.carrier('Liquid driven archive lift',[[-2,0,0],[-2,0,0]],{portal:false});lift.speed=2.5;lift.target=1;
 k.ramp('Archive return stair-ramp',-27,-19,-13,5,13.6,top);
 // An actual upper-floor opening receives the cargo; its four surrounds do
 // not leave a solid invisible deck spanning the cistern's interior.
 slab('Archive cistern west apron',-28,-17,-28,-13,13.6);
 slab('Archive cistern east apron',-15,-10,-28,-13,13.6);
 slab('Archive cistern rear apron',-17,-15,-28,-21,13.6);
 slab('Archive cistern front apron',-17,-15,-19,-13,13.6);
 k.deck('Separated eastern archive',9,28,-29,-14,top);
 // This lower bulkhead blocks ground-level shots and routes. Its upper edge
 // is structural, not a invisible field tied to an imagined solved flag.
 const bulkhead=k.block([0,5.1,-8],[60,10.2,.8],'shell');bulkhead.name='Sealed partition / siphon lower bulkhead';k.envelopes.at(-1).mesh.name=bulkhead.name+' / collision';
 // Wide ledge above the lower hall, a manufactured ram and its telescopic rod.
 const ramBase=k.block([-2,.8,6],[1.6,1.6,1.6],'dark');ramBase.name='Hydraulic ram cylinder base';
 const rod=k.geometry(new THREE.CylinderGeometry(.23,.23,1,16),'metal',[-2,1,6],Q(),{batch:false,name:'Water driven telescopic piston rod'});
 const rodCollider=g.collisionProxy(new THREE.Box3().setFromObject(rod),{kinematic:true});
 k.ticks.push(dt=>{rod.scale.y=Math.max(.05,lift.position.y-.5);rod.position.y=.5+rod.scale.y/2;rod.updateWorldMatrix(true,false);g.syncCollision(rodCollider,new THREE.Box3().setFromObject(rod),dt);});
 // Supply tank is raised above the receiver, so gravitational head does the
 // lifting. Its walls and bottom physically enclose the original rigid cargo.
 const bottom=k.block([tank.x,11.82,tank.z],[2.2,.36,2.2],'dark');
 g.floors.push({minX:tank.x-.8,maxX:tank.x+.8,minZ:tank.z-.8,maxZ:tank.z+.8,y:12,mesh:k.envelopes.at(-1).mesh,enabled:true});
 const glass=new THREE.MeshStandardMaterial({name:'Cistern inspection glass',color:0x8bb8dc,roughness:.18,metalness:.04,transparent:true,opacity:.21,depthWrite:false});glass.userData.keepMaterial=true;
 for(const [dx,dz,sx,sz]of [[-.92,0,.24,2.08],[.92,0,.24,2.08],[0,-.92,1.6,.24],[0,.92,1.6,.24]])k.block([tank.x+dx,12.85,tank.z+dz],[sx,1.7,sz],glass,true);
 for(const x of [-1,1])for(const z of [-1,1])k.block([tank.x+x,12.95,tank.z+z],[.16,2.05,.16],'metal');
 // Perforated inspection basket: actual kinematic support recovers the
 // submerged body without reaching through the fixed glass or changing its pose.
 const basketMesh=movingMechanismBlock(k,'Perforated cistern inspection basket',[-16,11.94,-20],[1.54,.12,1.54]);
 const basketCollider=g.collisionProxy(new THREE.Box3().setFromObject(basketMesh),{kinematic:true});
 const basketFloor={minX:-16.77,maxX:-15.23,minZ:-20.77,maxZ:-19.23,y:12,mesh:basketCollider.mesh,enabled:true};g.floors.push(basketFloor);
 const basket={height:12,target:12};
 k.control('siphon-inspection-basket',[-21,13.6,-17],()=>{basket.target=basket.target<13?13.95:12;},'E — поднять / опустить перфорированную корзину; жидкость проходит сквозь неё.');
 k.label('СМОТРОВАЯ КОРЗИНА / ПОДЪЁМ',[-20,15.2,-16.6],[0,0,1],9,.45);
 k.ticks.push(dt=>{const delta=THREE.MathUtils.clamp(basket.target-basket.height,-dt*.8,dt*.8);basket.height+=delta;basketMesh.position.y=basket.height-.06;basketMesh.updateWorldMatrix(true,false);g.syncCollision(basketCollider,new THREE.Box3().setFromObject(basketMesh),dt);basketFloor.y=basket.height;});
 k.resets.push(()=>{basket.height=basket.target=12;basketMesh.position.y=11.94;basketMesh.updateWorldMatrix(true,false);g.syncCollision(basketCollider,new THREE.Box3().setFromObject(basketMesh),0);basketFloor.y=12;});
 const waterMaterial=new THREE.MeshStandardMaterial({name:'Observable conserved liquid',color:0x5488d9,roughness:.3,metalness:.08,transparent:true,opacity:.73,depthWrite:false});waterMaterial.userData.keepMaterial=true;
 const water=k.geometry(new THREE.BoxGeometry(1.55,1,1.55),waterMaterial,[tank.x,12.6,tank.z],Q(),{batch:false,name:'Cistern water; height from conserved source volume'});
 const tubePoints=[[-16.75,12.1,-20],[-17.55,12.1,-20],[-17.55,13.30,-20],[-18.2,13.30,-20],[-18.2,1.6,-20],[-2,1.6,-20],[-2,1.6,6]];
 const tubeMaterial=new THREE.MeshStandardMaterial({name:'Siphon liquid column',color:0x70d6f2,emissive:0x144963,emissiveIntensity:.6,roughness:.38});tubeMaterial.userData.keepMaterial=true;
 const tube=[];
 for(let i=1;i<tubePoints.length;i++){
  const a=V(...tubePoints[i-1]),b=V(...tubePoints[i]),length=a.distanceTo(b),p=a.clone().add(b).multiplyScalar(.5),q=Q().setFromUnitVectors(V(0,1,0),b.clone().sub(a).normalize());
  k.geometry(new THREE.CylinderGeometry(.14,.14,length,12),'metal',p.toArray(),q,{name:'Pressure line external sleeve',solid:true});
  tube.push(k.geometry(new THREE.CylinderGeometry(.065,.065,length,8),tubeMaterial,p.clone().add(V(0,0,.155)).toArray(),q,{batch:false,name:'Siphon inspection channel'}));
 }
 const loading=k.loadPad('siphon-loading',[13,0,21],7).surface;
 const drop=k.panel('siphon-cargo-inlet',[-16,18,-20],[0,-1,0],6,6);drop.mesh.userData.portalSize={width:1.4,height:.65};
 const passage=k.panel('siphon-archive-entry',[-24,16.45,-27.6],[0,0,1],7.6,5.8);
 const arrival=k.panel('siphon-archive-exit',[20,13.05,-27.6],[0,0,1],7.6,5.8);
 k.label('33 / СИФОННАЯ ОБСЕРВАТОРИЯ',[0,20,-28.5],[0,0,1],25,1.25);
 k.label('ГРУЗОВАЯ ШАХТА / ОТКРЫТЫЙ БАК',[-16,20.6,-20],[0,0,1],17,.8);
 k.label('ОБРАТНЫЙ КЛАПАН / ВОДА ДЕРЖИТ ЛИФТ',[-2,4.5,1],[0,0,1],17,.75);
 k.label('АРХИВ / ОБА ПУТЕШЕСТВЕННИКА',[20,17,-28.3],[0,0,1],16,.7);
 const pump=()=>{circuit.returning=!circuit.returning;g.audio?.mechanism?.('switch');};
 const resetControl=k.control('siphon-return-pump',[5.4,0,9],pump,'E — сервисный электронасос: вернуть воду в верхний бак / остановить возврат.');
 k.control('siphon-upper-pump',[-10,top,4],pump,'E — сервисный электронасос: опустить лифт возвратом воды в бак.');
 const sample=V(),cargoHalf=.39;let displaced=0,levelHeight=circuit.surface;
 // Fixed local samples estimate displaced cube volume, respecting its live
 // rotation and position. No cargo teleport, weight-pad flag or fake charge.
 const points=[];for(let x=0;x<5;x++)for(let y=0;y<5;y++)for(let z=0;z<5;z++)points.push(V((x+.5)/5*.78-cargoHalf,(y+.5)/5*.78-cargoHalf,(z+.5)/5*.78-cargoHalf));
 const measure=h=>{let n=0;for(const p of points){sample.copy(p).applyQuaternion(g.cargo.quaternion).add(g.cargo.position);if(Math.abs(sample.x-tank.x)<tank.half&&Math.abs(sample.z-tank.z)<tank.half&&sample.y>=tank.bottom&&sample.y<h)n++;}return n/points.length*.78**3;};
 k.ticks.unshift(dt=>{
  displaced=measure(levelHeight);levelHeight=circuit.base+(circuit.source+displaced)/circuit.area;
  displaced=measure(levelHeight);circuit.step(dt,displaced);levelHeight=circuit.surface;
  lift.stations[1].y=circuit.height;lift.target=1;
 });
 k.renders.push(()=>{
  water.scale.y=Math.max(.002,levelHeight-12);water.position.y=12+water.scale.y/2;
  tube.forEach(m=>{m.visible=circuit.tube>.001;m.scale.x=m.scale.z=Math.max(.08,circuit.tube/circuit.tubeCapacity);});
  rod.scale.y=Math.max(.05,lift.group.position.y-.5);rod.position.y=.5+rod.scale.y/2;
 });
 k.resets.push(()=>{circuit.reset();displaced=0;levelHeight=circuit.surface;lift.stations[1].y=0;lift.reset();});
 k.display([-10,17,-28.4],()=>`БАК ${circuit.surface.toFixed(2)} м / КОЛЕНО ${circuit.crest.toFixed(2)} м\n${circuit.primed?'КОЛОННА БЕЗ ВОЗДУХА':'В КОЛЕНЕ ВОЗДУХ'} / ЛИФТ ${circuit.height.toFixed(1)} м`,15,1.7);
 const l=k.finishResearch([9,0,15],[11,.6,18],[20,top,-20],{postCampaign:false,researchChamber:false,openChamber:false,siphonObservatory:true,circuit,lift,basket,bulkhead,tank,loading,drop,passage,arrival,resetControl,getDisplacement:()=>displaced,spawnView:{yaw:.32,pitch:.04}});
 l.puzzleGeometry={noProgressFlags:true,recoveryFloor:0,orders:['load-then-ride','miss-lift-and-recirculate'],portalRoles:{'siphon-loading':'send the original body into the elevated liquid','siphon-cargo-inlet':'small downward aperture, not a passenger shortcut','siphon-archive-entry':'freed pair crosses the upper archive','siphon-archive-exit':'return both travellers after the hydraulic ascent'},deductions:['volume displacement reaches the dry crest','a flooded column drains below its priming height','a check valve holds actual ram volume','the service motor recirculates water rather than resetting actors','reclaim the original cargo and reuse the same portal pair']};
 l.getContextLesson=()=>['siphon-observatory','ЛКМ / ПКМ · E',spec.description,false];return l;
}
