import * as THREE from 'three';
import {Workshop} from './LabWorkshopKit.js';
import {buildSpringMailRoom,buildFreightBridgeRoom} from './LabWorkshopRooms.js';
const specs=[
 ['spring-mail','Пружинная почта','Гравитация и механическая защёлка','Высота падения сжимает настоящий пружинный поршень.',[32],['Друг может падать из потолочного портала. Пружина внизу принимает удар.','Обычный вес недостаточен: нужен разгон падением. Белое поле над поршнем — потолок, а не стена.','Свяжи пол загрузочной зоны с потолком над поршнем. Поставь друга на вход, дождись защёлки и забери его у сжатой пружины.']],
 ['freight-ferry','Телескопический док','Перевозка выдвижным пролётом','Кассета закреплена на берегу; узкий пролёт доставляет груз под защитный кожух.',[37],['Кассета неподвижна: выдвигается только узкий настил. Низкий кожух пропускает друга.','Поставь друга у переднего края втянутого пролёта. На другом конце его вес освободит защитный кожух.','Поднимись на левый берег, положи друга у переднего края пролёта и включи выдвижение. После срабатывания приёмника забери друга с открывшегося берега.']],
 ['stored-wind','Запас ветра','Инерция маховика и работа привода','Сначала раскрути маховик, потом подключи нагрузку.',[31,35,39],['Воздух проходит через порталы и вращает турбину. Видимый маховик сохраняет вращение.','Рычаг у турбины подключает подъёмный механизм. Соединение без вращения ничего не поднимет.','Направь поток через пару на турбину, включи вентилятор и затем сцепление. Дождись, пока привод поднимет затвор.']],

];
export const WORKSHOP_CAMPAIGN=Object.freeze(specs.map(([id,title,concept,description,assets,hints],i)=>({id,title,concept,description,assets:[1,2,11,22,23,24,...assets],hints,accent:[0xf0ba7a,0x8de1cb,0xc7abeb,0x8bcce4,0xc2d687,0xf4c4a3][i%6]})));
export function buildWorkshopCampaign(game,index){
 const spec=WORKSHOP_CAMPAIGN[index-8];if(!spec)throw Error('Unknown workshop');const k=new Workshop(game,spec,index),w=k.world;
 let spawn=[2,0,11],cargo=[0,.55,9],goal=[0,0,-16];
 const half=index===10?14:12;const bounds={minX:-half,maxX:half,minZ:-19,maxZ:15};k.shell(bounds,12);
 const baseWalls=()=>{k.panel('work-left',[-11.75,2.3,8],[1,0,0],11);k.panel('work-right',[11.75,2.3,8],[-1,0,0],11);k.panel('work-front',[0,2.3,14.75],[0,0,-1],23);};
 const closedExit=condition=>{const d=k.door(-12);k.ticks.push(dt=>d.update(condition(),dt,k.time));return d;};
 const latch=(name,p,condition)=>{const art=w.box([p[0],p[1],p[2]],[.6,.2,.7],w.materials.accent,false);const state={engaged:false};k.state[name]=state;k.ticks.push(()=>{if(condition())state.engaged=true;art.rotation.z=state.engaged?-.6:0;});k.resets.push(()=>state.engaged=false);return state;};
 if(index===8){
  buildSpringMailRoom(k,{baseWalls,closedExit});
 }else if(index===9){
  // Arrive beside the stair approach so the ordinary starting camera shows
  // the cassette and receiving bank instead of facing the foundation wall.
  spawn=[-6.8,0,11];cargo=[-5.5,.55,9.5];
  buildFreightBridgeRoom(k,{baseWalls,closedExit});
 }else if(index===10){
  baseWalls();k.panel('wind-intake',[11.7,2.1,5],[-1,0,0],10);k.panel('wind-outlet',[0,2.1,-1],[0,0,-1],8);
  const fan=k.fan('blower',[-9.8,2.1,5],[1,0,0]),t=k.turbine('flywheel',[0,2.1,-8]);k.staticFixture(39,[5,0,-8],2.2);
  k.control('fan-switch',[-7,0,10],()=>fan.enabled=!fan.enabled,'E — включить нагнетатель.');k.control('clutch',[6,0,-4],()=>t.clutch=!t.clutch,'E — соединить маховик с подъёмным приводом.');
  k.ticks.unshift(()=>t.power=fan.touch(t.position));const lock=latch('ratchet',[2,1,-9.5],()=>t.wheel.work>70);closedExit(()=>lock.engaged);
  k.wire([[1,1,-8],[5,1,-8],[5,.07,-11.5],[0,.07,-11.5]],()=>t.clutch);
 }
 const level=k.finish(spawn,cargo,goal);level.workshop=k;return level;
}
