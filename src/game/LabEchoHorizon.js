import * as THREE from 'three';
import {ResearchChamber} from './LabResearchArt.js';
import {TravellingPulseField} from './LabTravellingPulse.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
import {gate} from './LabPuzzleMechanics.js';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();

export const ECHO_HORIZON_SPEC=Object.freeze({
 id:'echo-horizon',title:'Эхо горизонта',accent:0x7be4dc,assets:[1,2,11,22,23,24],
 concept:'Импульс продолжает лететь после перестановки портала. Два пути разной длины должны одновременно отклонить связанные мембраны. Груз питает ударник, а не возит портальный адрес.',
 description:'Один ударник, два резонатора и разные расстояния. Уже отправленный импульс не исчезает вместе с порталом. Выход откроется, когда обе мембраны сработают вместе.',
 hints:['Кольца движутся по настоящему пути: дальнему резонатору требуется больше времени. Белые решётки пропускают импульс, но не путешественников.',
 'Мембраны быстро возвращаются в покой. Одно попадание не запоминается навсегда. Плита возле ударника запасает энергию под нагрузкой.',
 'Сначала отправь импульс по длинной ветви. Когда он покинет портал, перенастрой ту же пару на короткую ветвь и отправь второй. Одновременное отклонение проталкивает общий фиксатор.']
});

/** Complete replacement of room51. No carrier, travelling aperture, berth
 * switch or relay clutch survives from the removed room. */
export function buildEchoHorizon(game,index=50,spec=ECHO_HORIZON_SPEC){
 const k=new ResearchChamber(game,spec,index,'current',{minX:-24,maxX:24,minZ:-30,maxZ:26},0,18);
 const source=V(4,4.4,19),direction=V(-1,0,0);
 const intake=k.panel('echo-source',[-3,4.4,19],[1,0,0],4.8,5.2);
 const long=k.panel('echo-long',[15,4.4,-8],[0,0,1],5.2,5.2);
 const short=k.panel('echo-short',[-15,4.4,11],[0,0,1],5.2,5.2);
 // Purpose-built signal apertures, clearly labelled as such; no invisible
 // force fields or flags prevent a traveller from skipping the sealed door.
 for(const p of [intake,long,short])p.mesh.userData.portalSize={width:.65,height:.65};
 const emitter=k.projector(source.toArray(),direction.toArray(),{radius:.85});
 k.block([5.2,1.7,19],[1.3,3.4,1.5],'secondary');
 const padCenter=V(8,.32,19),padNormal=V(0,1,0);
 const pad=k.block([8,.16,19],[3.6,.32,3.6],'metal');
 game.floors.push({minX:6.2,maxX:9.8,minZ:17.2,maxZ:20.8,y:.32,mesh:pad,enabled:true});
 const padFrame={center:padCenter,normal:padNormal,right:V(1,0,0),up:V(0,0,-1),halfWidth:1.8,halfHeight:1.8};
 const cargoLoaded=()=>cargoLoadsPlate(game.cargo,game.heldCube,padFrame);
 const playerLoaded=()=>game.playerGrounded&&Math.abs(game.playerPosition.y-.32)<.2&&Math.abs(game.playerPosition.x-8)<1.8&&Math.abs(game.playerPosition.z-19)<1.8;
 const charge={value:0,loaded:()=>cargoLoaded()||playerLoaded()};
 const door=gate(k.world,-12,48,18);
 const coincidence={membranes:[0,0],overlap:0,latched:false};
 const receiverPositions=[V(15,4.4,22),V(-15,4.4,22)];
 const heads=receiverPositions.map(p=>k.projector(p.toArray(),[0,0,-1],{radius:1.2}));
 const field=new TravellingPulseField(game,{speed:10,lifetime:10,maxPackets:8,onArrival(sensor){
  coincidence.membranes[sensor.index]=1;game.audio?.mechanism?.('switch');
 }});
 field.receivers=receiverPositions.map((position,index)=>({position,normal:V(0,0,-1),radius:1.2*.76,name:index?'short':'long',index}));
 // Manufactured guide rails make length visible. Nothing is a fake ray whose
 // destination changes retroactively when the player fires another portal.
 for(const [x,a,b]of [[15,-8,22],[-15,11,22]]){
  for(const side of [-1,1])k.block([x+side*.92,3.4,(a+b)/2],[.14,.14,b-a],'metal');
  for(let z=a+3;z<b;z+=5){
   k.block([x,1.55,z],[.35,3.1,.55],'dark');
   k.geometry(new THREE.TorusGeometry(.75,.045,6,24),'secondary',[x,4.4,z],Q(),{name:'Acoustic measuring hoop'});
  }
 }
 // Recessed gallery and solid bulkheads visually explain the exit boundary.
 for(const x of [-20.5,20.5])k.block([x,6,-22],[.9,12,12],'shell');
 k.label('51 / ЭХО ГОРИЗОНТА',[0,14,-28.5],[0,0,1],23,1.4);
 k.label('ДАЛЬНЯЯ ВЕТВЬ',[15,8.4,-8],[0,0,1],8,.65);
 k.label('БЛИЖНЯЯ ВЕТВЬ',[-15,8.4,11],[0,0,1],8,.65);
 k.label('РЕШЁТКИ ДЛЯ ИМПУЛЬСА',[0,12,-11.75],[0,0,1],20,.65);
 k.label('НАГРУЗКА / УДАРНИК',[8,2.2,23],[0,0,-1],7,.5);
 const fire=k.control('echo-striker',[0,0,16.5],()=>{
  if(charge.value<.98)return;
  if(field.emit(source,direction)){charge.value=0;game.audio?.mechanism?.('impact');}
 },'E — удар. Плита под нагрузкой восстанавливает запас ударника.');
 const bleeder=k.control('echo-drain',[-6,0,-8],()=>{
  // A visible maintenance valve reversibly returns the live apparatus, not
  // a checkpoint or saved solution. The same original cargo remains intact.
  field.reset();charge.value=0;coincidence.membranes=[0,0];coincidence.overlap=0;coincidence.latched=false;
 },'E — открыть сервисный сброс резонаторов и общего фиксатора.');
 k.wire([[8,.4,19],[8,.4,24],[5.2,.4,24],[5.2,3.6,24],[5.2,3.6,19]],charge.loaded);
 heads.forEach((h,i)=>k.wire([[h.position.x,3.5,22],[h.position.x,3.5,-10],[i?-1.3:1.3,3.5,-10]],()=>coincidence.membranes[i]>.15));
 k.display([0,9.5,-11.65],()=>`${coincidence.membranes[0]>.15?'ДАЛЬНЯЯ ОТКЛОНЕНА':'ДАЛЬНЯЯ В ПОКОЕ'}  /  ${coincidence.membranes[1]>.15?'БЛИЖНЯЯ ОТКЛОНЕНА':'БЛИЖНЯЯ В ПОКОЕ'}\n${coincidence.latched?'ОБЩИЙ ФИКСАТОР ПРОЙДЕН':charge.value>.98?'УДАРНИК ГОТОВ':'УДАРНИК ВОССТАНАВЛИВАЕТСЯ'}`,21,1.5);
 // Render packets from a fixed pool. Level changes never leak a material per
 // pulse, and no physics callback spawns a fresh browser object every frame.
 const ringGeometry=new THREE.TorusGeometry(.25,.065,6,20),ringMaterial=new THREE.MeshBasicMaterial({color:0xa8fff3});
 ringMaterial.userData.keepMaterial=true;
 const rings=Array.from({length:field.maxPackets},()=>{const m=new THREE.Mesh(ringGeometry,ringMaterial);m.visible=false;k.world.root.add(m);return m;});
 const arms=heads.map(h=>k.geometry(new THREE.BoxGeometry(.17,1.5,.25),'secondary',[h.position.x+1.5,4.4,21.5],Q(),{batch:false,name:'Receiver membrane lever'}));
 const latch=k.geometry(new THREE.BoxGeometry(1.2,.22,.48),'secondary',[0,4.7,-11.1],Q(),{batch:false,name:'Visible shared over-centre latch'});
 const meter=k.geometry(new THREE.BoxGeometry(.12,1.4,.15),'light',[2,2.1,16.5],Q(),{batch:false,name:'Striker charge needle'});
 k.ticks.push(dt=>{
  charge.value=Math.min(1,charge.value+(charge.loaded()?.8:0)*dt);
  coincidence.membranes=coincidence.membranes.map(v=>Math.max(0,v-dt/1.15));
  field.step(dt);
  const together=coincidence.membranes.every(v=>v>.18);
  coincidence.overlap=THREE.MathUtils.clamp(coincidence.overlap+(together?dt:-dt*2),0,.3);
  if(coincidence.overlap>=.3)coincidence.latched=true;
  door.update(coincidence.latched,dt,k.time);
 });
 k.renders.push(alpha=>{
  rings.forEach((m,i)=>{const p=field.packets[i];m.visible=!!p;if(!p)return;m.position.lerpVectors(p.previous,p.position,alpha);m.quaternion.setFromUnitVectors(V(0,0,1),p.direction);});
  arms.forEach((m,i)=>m.rotation.x=coincidence.membranes[i]*-.85);
  latch.rotation.z=coincidence.latched?-.9:-coincidence.overlap*2;
  meter.rotation.z=.7-charge.value*1.4;door.render(alpha,k.time);
 });
 k.resets.push(()=>{field.reset();charge.value=0;coincidence.membranes=[0,0];coincidence.overlap=0;coincidence.latched=false;door.reset();rings.forEach(r=>r.visible=false);});
 const level=k.finishResearch([-2,0,12],[8,.95,19],[0,0,-24],{
  expansionB:false,researchChamber:false,openChamber:false,echoHorizon:true,
  field,charge,coincidence,door,cargoLoaded,intake,long,short,fire,bleeder,spawnView:{yaw:0,pitch:-.06}
 });
 level.puzzleGeometry={noProgressFlags:true,recoveryFloor:0,footprint:2688,
  portalRoles:{'echo-source':'receives individual pressure packets','echo-long':'the long free-flight leg consumes time, not a saved receiver flag','echo-short':'reuses the released portal colour while the first packet is in free flight'},
  deductions:['an emitted packet has its own position and velocity','an erased aperture does not recall a departed packet','two different flight lengths require staggered departures','membranes must overlap in real time; serial hits decay','shared mechanical retention frees the original source load for reunion']};
 level.getContextLesson=()=>['echo-horizon','ЛКМ / ПКМ · E',spec.description,false];
 return level;
}
