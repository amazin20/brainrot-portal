import * as THREE from 'three';
import {ResearchChamber} from './LabResearchArt.js';
import {CREATIVE_FINAL_SPECS,buildCreative36,buildCreative37,buildCreative40} from './LabCreativeFinalRooms.js';
import {THERMAL_MEMORY_SPEC,buildThermalMemory} from './LabLateCampaignThermalRoom.js';
import {installRoom38FreightExit} from './LabRoom38FreightExit.js';

const V=(...p)=>new THREE.Vector3(...p);

export const POST_B_SPECS=Object.freeze([
 CREATIVE_FINAL_SPECS[36],
 CREATIVE_FINAL_SPECS[37],
 {id:'post-separated-freight',title:'Два маршрута',concept:'Пассажирский полёт достигает пульта, а живой нажим исходного груза включает грузовой привод. Верхний причал механически отводит створку общего выхода.',description:'Пассажирская галерея смотрит на грузовой подъёмник и его верхний стыковочный кулачок.',accent:0xf0bc86,assets:[1,2,11,22,23,24],hints:['Настоящий вес свободного спутника на грузовом настиле включает привод. Пустая платформа сохраняет своё положение.','Нижний пульт отправляет груз заранее. Верхний поднимает его после твоего перелёта; сам подъём платформы отводит створку конечного отсека.','При промахе есть сухой сервисный подъём. Верхний пульт возвращает платформу для повторной загрузки.']},
 THERMAL_MEMORY_SPEC,
 CREATIVE_FINAL_SPECS[40],
]);

function finish(k,spawn,cargo,goal,extra,roles,orders){
 const l=k.finishResearch(spawn,cargo,goal,{...extra,postCampaign:true,researchChamber:false,foundationChamber:false});
 l.puzzleGeometry={noProgressFlags:true,footprint:(k.bounds.maxX-k.bounds.minX)*(k.bounds.maxZ-k.bounds.minZ),goalHeight:goal[1],recoveryFloor:k.base,portalRoles:roles,orders};
 l.getContextLesson=()=>['post-room-'+l.index,'ЛКМ / ПКМ · E',l.spec.description,false];
 return l;
}
/** 38: cargo first boards a freestanding vertical hoist in the east wing.
 * The player physically traverses to the west wing, earns flight height,
 * lands on the far balcony, and from there dispatches that same companion.
 * The two paths are spatially and mechanically separate until the last dock. */
export function buildPost38(g,index=37){
 const k=new ResearchChamber(g,POST_B_SPECS[2],index,'kinetic',{minX:-30,maxX:30,minZ:-28,maxZ:25},-4,29);
 k.deck('East freight entrance',6,21,6,23,0);
 k.deck('Cross-lab feeder',-14,6,8,17,0);
 k.deck('West observation court',-27,-14,7,23,0);
 k.deck('West acceleration balcony',-27,-14,-21,-11,14);
 k.ramp('West launch approach',-26,-18,-11,7,14,0);
 k.deck('North flight catch',5,23,-25,-15,15);
 k.deck('Catch shelf',-4,5,-19,-9,15);
 k.deck('Catch apron',5,23,-15,-6,15);
 // The freight floor itself docks flush with the apron at z=-6. Fixed decks
 // meet only along their edges; overlapping tops would shimmer in WebGL.
 k.block([11,15.05,-6.3],[11,.06,.18],'secondary',false);
 k.ramp('Lower service return',21,29,-4,17,-4,0);
 const pit=k.loadPad('well-entry',[-17,-4,-1.8],9);
 const outlet=k.panel('angle-outlet',[-8,10,-11],[.435889894,.9,0],9,7);
 // The rear-edge station z=-6 gives a true deck span z=-6..+6: its lower
 // entrance meets the feeder at +6, and its upper rear meets the apron at -6.
 const freight=k.carrier('original-cargo-hoist',[[11,0,-6],[11,15,-6]],{width:12,depth:12,portal:false});freight.speed=3;
 const freightExit=installRoom38FreightExit(k,freight);
 k.control('upper-dispatch',[17,15,-19],()=>{freightExit.motor.requestLift();},'E — поднять грузовую платформу со спутником.');
 // Dispatch from the rear of the loading court. At the former z=13 console,
 // a sprinting observer could press E at maximum hand reach, jump onto the
 // already rising floor and ride past the entire gravity crossing. The
 // visible console now leaves enough real travel distance for the hoist to
 // rise above jump height before anyone can reach its near edge.
 k.control('lower-dispatch',[18,0,19],()=>{freightExit.motor.requestLift();},'E — отправить груз на верхний причал до своего перелёта.');
 k.control('upper-recall',[6,15,-21],()=>{freight.target=0;},'E — вернуть грузовую платформу на нижний причал.');
 k.block([24,21,-20],[1,11,12],'secondary');
 k.display([0,25,-27.16],()=>`ПЛАТФОРМА ${freight.at(1)?'У ВЕРХНЕГО ДОКА':freight.at(0)?'ВНИЗУ':'В ПУТИ'}\n${freightExit.motor.engaged?'НАСТИЛ НАГРУЖЕН / ПРИВОД СЦЕПЛЕН':'НЕТ НАЖИМА / ЧЕРВЯК ДЕРЖИТ ВЫСОТУ'}`,25,2);
 k.label('38 / ДВА МАРШРУТА',[-29.2,9,16],[1,0,0],16,1.2);
 const l=finish(k,[9,0,17],[7,.6,14],[11,15,11],{fallPad:pit,outlet,freight,freightExit,spawnView:{yaw:-.1,pitch:-.22}},
  {'well-entry':'receives the real western drop','angle-outlet':'converts western momentum toward north flight catch'},['carry-freight-then-launch','send-freight-early']);
 return l;
}

export const buildPost39=buildThermalMemory;

export const buildPost36=buildCreative36;
export const buildPost37=buildCreative37;
export const buildPost40=buildCreative40;

export const POST_B_BUILDERS=Object.freeze([buildPost36,buildPost37,buildPost38,buildPost39,buildPost40]);
