import * as THREE from 'three';
import {ResearchChamber} from './LabResearchArt.js';
import {tracePortalRay,rayTouches,beamDrawing} from './LabPuzzleMechanics.js';
import {cargoOccludes,lateShutter} from './LabLateCampaignMechanisms.js';
const V=(...p)=>new THREE.Vector3(...p);
export const THERMAL_MEMORY_SPEC={id:'post-thermal-memory',title:'Тепловая память',concept:'Луч нагревает расширительный шток. Перенаправление той же мощности открывает дальнюю дверь, но оставленный шток начинает остывать.',description:'Сохрани достаточно тепла, затем отдай питающий луч дальнему приёмнику. Вернуться к нагреву можно перестановкой портала выше световой оси.',accent:0xe6a477,assets:[1,2,11,22,23,24],hints:['Пока луч заканчивается на белом коллекторе, термометр растёт, шток расширяется и поднимает первую дверь.','Портал на коллекторе отбирает его мощность. Другой адрес выводит луч к дальнему приёмнику; первая дверь держится только запасённым теплом.','Если запас кончился, переставь портал на верх белого коллектора: луч снова нагреет шток. Двери не запоминают прохождение.']};

function partition(k,z){
 const height=4.4;
 k.block([15.4,8,z],[23.8,16,.65],'shell');
 if(z===4){for(const [a,b]of [[-27.3,-14],[-6,-3.5]])k.block([(a+b)/2,8,z],[b-a,16,.65],'shell');k.block([-10,.825,z],[8,1.65,.65],'shell');k.block([-10,9.15,z],[8,13.7,.65],'shell');}
 else k.block([-15.4,8,z],[23.8,16,.65],'shell');
 k.block([0,10.2,z],[7,11.6,.65],'dark');
 return lateShutter(k,'Thermal door leaf',[0,height/2,z],[7,height,.7],[0,6.4,0]);
}

/** A conserved heat store, not a countdown or a sequence marker. The
 * collector absorbs only rays that terminate on its material; routing the
 * same ray through its portal takes away that input power immediately. */
export function buildThermalMemory(g,index=38){
 const k=new ResearchChamber(g,THERMAL_MEMORY_SPEC,index,'optical',{minX:-28,maxX:28,minZ:-27,maxZ:27},0,16);
 const heater=k.panel('thermal-collector',[-12,4.3,17],[1,0,0],8,8);
 const outlet=k.panel('thermal-remote-mouth',[-20,3.2,-5],[1,0,0],4,3.0);outlet.mesh.userData.portalSize={width:1.4,height:.65};
 const emitter=k.projector([16,3.2,17],[-1,0,0],{radius:.9});
 const receiver=k.projector([18,3.2,-5],[-1,0,0],{radius:.55});
 const first=partition(k,4),second=partition(k,-10);
 const rod=k.block([10,1.8,4],[3,.35,.35],'metal',false);rod.name='Continuously expanding thermal rod';
 const sleeve=k.block([8.2,1.8,4],[.7,1.0,1.0],'shell');
 const pointer=k.block([11.5,1.8,4],[.25,.8,.8],'secondary',false);
 // The displayed amplification linkage and its thermal bar are alongside
 // the crossing, never across the walking aperture or a portal shot line.
 k.block([5.3,1.8,4],[4,.18,.18],'metal',false);
 const bar=k.block([-25.2,5.3,17],[.20,6,.4],'light',false);bar.name='Thermal energy thermometer';
 const drawing=beamDrawing(k.world,0xf4b173,.045);
 const thermal={temperature:20,ambient:20,capacity:800,inputPower:32000,lossCoefficient:44,powered:false,remote:false,extension:0,segments:[],energy:0};
 k.ticks.push(dt=>{
  thermal.segments=tracePortalRay(g,emitter.position.clone().addScaledVector(emitter.normal,.04),emitter.normal,{length:130});
  const last=thermal.segments.at(-1),heatPoint=V(-12,3.2,17);
  thermal.powered=!!last&&last.kind==='wall'&&last.b.distanceTo(heatPoint)<.45&&!cargoOccludes(g,thermal.segments);
  thermal.remote=rayTouches(thermal.segments,receiver.position,.42)&&!cargoOccludes(g,thermal.segments);
  const input=thermal.powered?thermal.inputPower:0,loss=thermal.lossCoefficient*(thermal.temperature-thermal.ambient);
  thermal.temperature=Math.max(thermal.ambient,thermal.temperature+(input-loss)*dt/thermal.capacity);
  thermal.energy=thermal.capacity*(thermal.temperature-thermal.ambient);
  thermal.extension=THREE.MathUtils.clamp((thermal.temperature-80)/280,0,1);
  // Expansion drives the actual pose, including partial openings. There is
  // no won-state timer, hidden stage or retained door-open flag.
  first.progress=thermal.extension;first.target=false;
  first.mesh.position.set(0,2.2+6.4*first.progress,4);first.mesh.updateWorldMatrix(true,false);g.syncCollision(first.collider,new THREE.Box3().setFromObject(first.mesh),dt);
  second.target=thermal.remote;second.update(dt);
  rod.scale.x=1+thermal.extension*.8;rod.position.x=10+thermal.extension*1.2;pointer.position.x=11.5+thermal.extension*2.4;
  bar.scale.y=.03+.97*THREE.MathUtils.clamp((thermal.temperature-20)/450,0,1);bar.position.y=2.3+3*bar.scale.y;
  bar.material.color.set(0x8bbed2).lerp(new THREE.Color(0xf08d4e),thermal.extension);
  drawing.update(thermal.segments);
 });
 k.resets.push(()=>{thermal.temperature=20;thermal.energy=0;thermal.extension=0;thermal.powered=thermal.remote=false;});
 k.display([0,12,-26.1],()=>`ШТОК ${thermal.temperature.toFixed(0)} °C / ${Math.round(thermal.energy/1000)} кДж\n${thermal.powered?'НАГРЕВ ШТОКА':thermal.remote?'МОЩНОСТЬ НА ДАЛЬНЕМ ПРИЁМНИКЕ':'ОСТЫВАНИЕ'}`,26,2);
 k.label('39 / ТЕПЛОВАЯ ПАМЯТЬ',[0,14,26.1],[0,0,-1],25,1.1);
 k.label('ВЕРХ АДРЕСА ВОЗВРАЩАЕТ НАГРЕВ',[-11.9,8.8,17],[1,0,0],10,.65);
 const l=k.finishResearch([-5,0,22],[-9,.6,21],[0,0,-21],{postCampaign:true,heater,outlet,emitter,receiver,first,second,thermal,spawnView:{yaw:.2,pitch:-.06}});
 l.puzzleGeometry={noProgressFlags:true,recoveryFloor:0,portalRoles:{'thermal-collector':'takes real optical input power away from an expanding heat store','thermal-remote-mouth':'delivers that same power to a second physical door'},orders:['heat-then-route','receiver-first'],deductions:['only a ray terminating on the material adds thermal energy','loss continues while power is sent elsewhere','extension continuously controls the first real door','the second door needs current remote illumination','raising the interception aperture restores a failed thermal charge']};
 return l;
}
