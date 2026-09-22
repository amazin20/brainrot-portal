import * as THREE from 'three';
import {ResearchChamber} from './LabResearchArt.js';
import {createLightBridge} from './LabLightBridge.js';
import {tracePortalRay,rayTouches,beamDrawing} from './LabPuzzleMechanics.js';

const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
export const RESEARCH_SPECS=Object.freeze([
 {id:'research-light-interchange',title:'Световая развязка',concept:'Одна проекция становится двумя разными дорогами. Перестрой путь, оставаясь на настоящей опоре.',description:'Выход виден через разрыв. Проектор один; белые панели меняют направление его моста. Нижний этаж возвращает к началу.',accent:0x76e5e8,assets:[1,2,11,22,23,24],hints:['Портал напротив проектора переносит не только тебя, но и его свет. Мост выходит из второго портала.','В центре есть постоянная площадка. На ней можно безопасно переставить второй портал и изменить направление моста.','На выходной площадке нет керамики. До неё ведёт свет от панели на обратной стороне центральной развязки.']},
 {id:'research-stored-motion',title:'Запас хода',concept:'Порталы передают воздух; маховик сохраняет движение, а механический тормоз — положение.',description:'Два механизма используют один воздушный поток. Наблюдай за маховиком: его движение не исчезает вместе с порталом.',accent:0xffcf7b,assets:[1,2,11,22,23,24],hints:['Вентилятор дует в белую панель. Из второго портала воздух должен попасть в круглую приёмную решётку.','Маховик продолжает крутиться после разрыва связи. Червячный привод удерживает уже поднятую кабину.','На промежуточной галерее переключи передачу на второй подъёмник. Подготовь поток заранее или используй запас вращения.']},
 {id:'research-return-vector',title:'Обратный вектор',concept:'Один и тот же перепад высоты работает дважды: первый полёт открывает ракурс для обратного.',description:'Приёмная галерея выше старта. Угол белого щита задаёт направление, а глубина падения — высоту полёта. Внизу есть обратный путь.',accent:0xf8a782,assets:[1,2,11,22,23,24],hints:['Широкий пандус ведёт к первому падению. Сначала посмотри, куда направлен наклонный щит.','На средней галерее видна обратная сторона второй приёмной панели. С нижнего этажа её закрывает настоящий корпус.','Спутника можно перенести в руках. Перед перестановкой связи оставь его на настоящем настиле; при промахе внизу есть служебный возврат.']},
]);

export function buildResearch31(game,index=30){
 const k=new ResearchChamber(game,RESEARCH_SPECS[0],index,'current',{minX:-29,maxX:29,minZ:-26,maxZ:22},-4,20);
 k.deck('Projector-side observation gallery',-26,-16,2,20,6);
 k.deck('Permanent switching island',-2,10,2,14,6);
 k.deck('Exit receiving gallery',-2,10,-25,-15,6);
 k.ramp('Service return ramp',-27,-19,-18,2,-4,6);
 const source=k.panel('light-source',[-15.8,6.75,-12],[-1,0,0]);
 const west=k.panel('west-bridge',[-28.25,6.75,8],[1,0,0]);
 const turn=k.panel('north-bridge',[4,6.75,16.25],[0,0,-1]);
 // The island's far cheek terminates the first bridge. It is visible, opaque,
 // and leaves its northern and southern routes genuinely open.
 k.block([10.6,10.2,8],[1.2,8.4,11.2],'secondary');
 k.projector([-23,6.12,-12],[1,0,0],{radius:.85});k.support(-24,-12,4.2,.6);
 // A service gantry carries the projector, but is not a walking shortcut.
 k.block([-19.8,3.6,-12],[9,.7,2.8],'dark');k.support(-16.5,-12,3.2,.6);
 const light=createLightBridge(k,{origin:[-22.98,6.12,-12],direction:[1,0,0],span:[0,0,1],width:5.2,length:105,name:'Reconfigurable wide light causeway'});
 const routeText=()=>{
  const projected=light.segments.find((s,i)=>i>0&&s.length>5);
  if(!projected)return 'СВЕТ УПИРАЕТСЯ В ПАНЕЛЬ / СВЯЗЬ НЕ СОБРАНА';
  const dy=Math.abs(projected.a.y-6);return dy>.38?'МОСТ НЕ НА УРОВНЕ НАСТИЛА / ИЗМЕНИ ВЫСОТУ ПОРТАЛА':Math.abs(projected.direction.z)>.8?'МОСТ К ВЫХОДНОЙ ГАЛЕРЕЕ':'МОСТ К ПОСТОЯННОЙ ПЛОЩАДКЕ';
 };
 k.display([4,15,-24.8],()=>routeText()+'\nСВЕТ — ВРЕМЕННАЯ ОПОРА / ТЁМНЫЙ НАСТИЛ — ПОСТОЯННЫЙ',21,2);
 k.label('31 / СВЕТОВАЯ РАЗВЯЗКА',[-28.32,12,12],[1,0,0],11,1.4);
 k.label('СЛУЖЕБНЫЙ ВОЗВРАТ',[ -18.4,-.8,-17.2],[0,0,1],9,.8);
 const l=k.finishResearch([-21,6,15],[-23,6.6,13],[4,6,-20],{light,spawnView:{yaw:.4,pitch:-.04}});
 const dispose=l.dispose;l.dispose=()=>{light.dispose();dispose();};
 l.getObjective=()=>routeText()+'. На центральном острове мост можно перестроить.';
 l.getContextLesson=()=>['light-sheet-rule','ЛКМ / ПКМ','Свет проходит через те же порталы. Пока меняешь связь, стой на тёмном постоянном настиле. Внизу есть обратный путь.',false];
 l.puzzleGeometry={orders:['carry-first','scout-first'],footprint:58*48,goalHeight:6,noProgressFlags:true,sourceCount:1,recoveryFloor:-4};return l;
}

/** Mechanical energy storage with a worm-drive transmission. A stopped drive
 * holds its position; neither elapsed time nor portal colour unlocks a stage. */
export class StoredMotionDrive {
 constructor(){this.wheel={omega:0,angle:0,energy:0};this.reset();}
 reset(){Object.assign(this.wheel,{omega:0,angle:0,energy:0});this.gear=0;this.heights=[0,6];this.flow=false;}
 step(dt,powered,engaged=true){
  if(!Number.isFinite(dt)||dt<0)throw new RangeError('Nonnegative finite timestep required');
  this.flow=Boolean(powered);const top=this.gear===0?6:12,current=this.heights[this.gear],load=engaged&&current<top-.001?2.2:0;
  // Heavy rotor: exact integration of I*w' = torque - load - viscous drag.
  // Stored energy decays gradually, giving time to walk and experiment.
  const inertia=12,drag=.18,equilibrium=((powered?24:0)-load)/drag,old=this.wheel.omega,rate=drag/inertia;
  let h=dt;if(equilibrium<0)h=Math.min(h,Math.max(0,-Math.log(-equilibrium/(old-equilibrium))/rate));
  const exp=Math.exp(-rate*h),turn=Math.max(0,equilibrium*h+(old-equilibrium)*(1-exp)/rate);
  this.wheel.omega=Math.min(36,Math.max(0,equilibrium+(old-equilibrium)*exp));
  this.wheel.angle+=turn;this.wheel.energy=.5*inertia*this.wheel.omega**2;
  if(engaged)this.heights[this.gear]=Math.min(top,current+Math.min(1.35,this.wheel.omega*.25)*dt);
 }
}
export function buildResearch32(game,index=31){
 const k=new ResearchChamber(game,RESEARCH_SPECS[1],index,'optical',{minX:-30,maxX:26,minZ:-28,maxZ:24},0,23);
 k.deck('Transmission service gallery',-2,10,-7,5,6);
 k.deck('Upper exit gallery',-2,10,-27,-19,12);
 const lower=k.carrier('first-drive-cabin',[[-8,0,-7],[-8,6,-7]],{width:12,depth:12,portal:false});
 const upper=k.carrier('second-drive-cabin',[[4,6,-19],[4,12,-19]],{width:12,depth:12,portal:false});
 // Physical shaft casings keep the machinery readable but do not seal the
 // cabin entrances or put a false full AABB across their open space.
 for(const [x,z,base,top]of [[-14.6,-6.4,0,8],[-1.4,-6.4,0,8],[-2.6,-18.4,0,14],[10.6,-18.4,0,14]])k.support(x,z,top,.34);
 const drive=new StoredMotionDrive();
 k.panel('air-source',[19,3,9],[0,0,1]);
 k.panel('turbine-feed',[-19,3,-23],[0,0,1]);
 const fan=k.projector([19,3,15],[0,0,-1],{rotating:true,radius:1.25});
 const wheel=k.projector([-19,3,-15],[0,0,-1],{radius:1.9});
 // Air reaches the front grille, not the box behind it. This ray is shared
 // with collision/portal mapping; target IDs do not select a powered state.
 const drawing=beamDrawing(k.world,0xb5e6eb,.055);let flowSegments=[];
 k.ticks.unshift(dt=>{
  flowSegments=tracePortalRay(game,fan.position.clone().addScaledVector(fan.normal,.04),fan.normal,{length:120,medium:'air'});
  const active=flowSegments.some(s=>s.direction.dot(wheel.normal)<-.9&&rayTouches([s],wheel.position,.75));
  const f=[lower,upper][drive.gear].floor,pp=game.playerPosition,cp=game.cargo?.position;
  const aboard=p=>p&&p.x>f.minX+.1&&p.x<f.maxX-.1&&p.z>f.minZ+.1&&p.z<f.maxZ-.1&&Math.abs(p.y-f.y)<.75;
  drive.step(dt,active,(game.playerGrounded&&aboard(pp))||(!game.heldCube&&aboard(cp)));drawing.update(flowSegments);
  [lower,upper].forEach((car,i)=>{car.stations[1].y=drive.heights[i];car.target=1;car.speed=3;});
 });
 k.renders.push(()=>{wheel.rotor.rotation.z=drive.wheel.angle;});
 k.resets.push(()=>{drive.reset();[lower,upper].forEach((car,i)=>{car.stations[0].y=car.stations[1].y=drive.heights[i];car.reset();});});
 k.control('transmission',[7.7,6,2.5],()=>{drive.gear=1-drive.gear;},'E — переключить передачу I / II. Червячная передача удерживает другой подъёмник.');
 // Both routes use the same mechanisms. The lower recall is a visible machine
 // control, not an invisible reset of the player or companion.
 k.control('lower-return',[-16,0,8],()=>{drive.heights[0]=0;lower.stations[1].y=0;},'E — опустить первую кабину к служебному этажу.');
 k.control('upper-return',[7.7,6,-4],()=>{drive.heights[1]=6;upper.stations[1].y=6;},'E — опустить вторую кабину к промежуточной галерее.');
 for(const x of [-19,19])k.block([x,1.15,x<0?-16.4:16.4],[4.8,2.3,3.1],'dark');
 // A continuous visible shaft and two gearboxes show where stored motion goes.
 k.geometry(new THREE.CylinderGeometry(.22,.22,14,20),'metal',[-12,3,-17],Q().setFromAxisAngle(V(0,0,1),Math.PI/2),{solid:true});
 k.block([-5,3,-17],[2.5,2.8,2.1],'shell');k.support(-5,-17,1.6,.7);
 k.display([0,18,-27.28],()=>`МАХОВИК: ${drive.wheel.omega.toFixed(1)} рад/с / ПЕРЕДАЧА ${drive.gear?'II':'I'}\n${drive.flow?'ПОТОК ПОПАДАЕТ В РЕШЁТКУ':drive.wheel.omega>.1?'ПОТОК ОТКЛЮЧЁН / РАБОТАЕТ ЗАПАС ВРАЩЕНИЯ':'НЕТ ПОТОКА / МАХОВИК ОСТАНОВЛЕН'}`,23,2.1);
 k.label('32 / ЗАПАС ХОДА',[0,5.1,23.32],[0,0,-1],17,1.4);
 k.label('ПОДАЧА ПОД НАГРУЗКОЙ',[-8,4.8,5.1],[0,0,1],9,.7);
 k.label('ПРИВОД I',[-8,8.6,-6.4],[0,0,1],8,.8);k.label('ПРИВОД II',[4,14.6,-18.4],[0,0,1],8,.8);
 const l=k.finishResearch([2,0,16],[-.2,.6,14],[4,12,-23],{drive,cabins:[lower,upper],spawnView:{yaw:0,pitch:-.12}});
 l.getObjective=()=>`${drive.flow?'Воздух приводит маховик.':'Соедини поток с приёмной решёткой.'} Передача ${drive.gear?'II':'I'}; кабины ${lower.position.y.toFixed(1)} / ${upper.position.y.toFixed(1)} м.`;
 l.getContextLesson=()=>['stored-motion-rule','ЛКМ / ПКМ','Воздух проходит через порталы. Кабина движется, когда на ней есть вес. Маховик сохраняет вращение, а передача удерживает высоту.',false];
 l.puzzleGeometry={orders:['powered-ascent','stored-energy'],footprint:56*52,goalHeight:12,noProgressFlags:true,recoveryFloor:0};return l;
}

export function buildResearch33(game,index=32){
 const k=new ResearchChamber(game,RESEARCH_SPECS[2],index,'kinetic',{minX:-32,maxX:32,minZ:-30,maxZ:26},-4,31);
 // Two moderate-height ballistic passes inside one physical test chamber.
 k.deck('Entry receiving court',-30,-14,8,24,0);
 k.deck('First drop balcony',-30,-14,-20,-12,14);
 k.ramp('First launch access',-29,-21,-12,8,14,0);
 k.deck('Intermediate inspection gallery',6,22,-26,-14,15);
 k.deck('Exit-side return gallery',-12,4,8,24,22);
 k.ramp('Recovery return',20,28,-4,16,-4,0);
 k.deck('Southern service return',-14,28,16,24,0);
 const pit=k.loadPad('first-fall',[-17,-4,-6],10);
 const outlet=k.panel('first-outlet',[-8,10,-11],[.435889894,.9,0],9,7);
 const second=k.loadPad('second-fall',[14,-4,0],8);
 const last=k.panel('second-outlet',[14,10,7],[-.435889894,.9,0],9,7);
 // Actual receiving catch walls turn excess horizontal momentum into a broad
 // landing. They are not completion triggers and never teleport the travellers.
 k.block([23,21,-20],[1,12,13],'secondary');
 k.block([-13,26,16],[1,10,17],'secondary');
 k.block([5,11.25,10],[2,14.5,28],'shell');
 k.block([5,0,6],[2,8,20],'shell');
 k.label('СЛУЖЕБНЫЙ ПРОХОД',[6.05,4.7,20],[1,0,0],7,.7);

 // The first tilted aperture launches across +X. Receiving area includes its
 // complete conservative ballistic envelope, with a clear recovery floor below.
 k.deck('Intermediate flight apron',6,22,-14,-6,15);
 k.deck('Exit flight apron',-12,4,0,8,22);
 // Second falling lane is reached by walking off the intermediate apron.
 // Both floors are real physical decks with owned portal backing.
 k.label('33 / ОБРАТНЫЙ ВЕКТОР',[-31.3,8,17],[1,0,0],14,1.4);
 k.label('ПРИЁМНИК ГОТОВ? / ЗАТЕМ ПАДЕНИЕ',[-29.15,17.7,-16],[1,0,0],10,.75);
 k.label('ВОЗВРАТ НА НИЖНЕМ ЭТАЖЕ',[29.15,2,-1],[-1,0,0],12,.8);
 k.label('ПАДЕНИЕ → ИМПУЛЬС',[0,28,-29.28],[0,0,1],25,1.8);

 const l=k.finishResearch([-22,0,19],[-24,.6,17],[-4,22,17],{fallPads:[pit,second],outlets:[outlet,last],spawnView:{yaw:.15,pitch:-.12}});
 l.puzzleGeometry={orders:['carry-first','explore-and-return'],footprint:64*56,goalHeight:22,noProgressFlags:true,recoveryFloor:-4};return l;
}
export const RESEARCH_BUILDERS=[buildResearch31,buildResearch32,buildResearch33];
