import * as THREE from 'three';
import {ResearchChamber} from './LabResearchArt.js';
import {gate,tracePortalRay,rayTouches,beamDrawing} from './LabPuzzleMechanics.js';
import {cargoOccludes,clipCargoRay,freightHood,lateShutter} from './LabLateCampaignMechanisms.js';
import {CREATIVE_COUNTERWEIGHT_SPEC,buildCreative34} from './LabCreativeCounterweightRoom.js';
import {buildInverseSpring} from './LabLateCampaignSpringRoom.js';
import {buildFreightRake} from './LabLateCampaignRoomsA.js';

const V=(...v)=>new THREE.Vector3(...v);
const assets=[1,2,11,22,23,24];
export const POST_A_SPECS=Object.freeze([
 {id:'post-freight-rake',title:'Грузовой рейк',concept:'Воздух движет спутника, спутник толкает настоящий ползун, а ползун передвигает поперечный мост.',description:'Одна пара сначала доставляет груз, затем подаёт воздух на его корпус. С наблюдательной галереи верни тот же груз после движения рейки.',accent:0x8de3c3,assets,hints:['Низкий грузовой адрес пропускает друга, но не человека. Направь туда свободного друга через белый пол.','Воздух не толкает рейку сам: её движет контакт свободного спутника. Переставь вход на белую панель перед вентилятором.','Полный ход удерживает храповик и открывает смотровой кожух. Перепрыгни низкий упор, забери друга и поднимись по западному пандусу.']},
 {id:'post-thin-shadow',title:'Тонкая тень',concept:'Маленький непрозрачный спутник перекрывает нижний луч, но пропускает верхний. Грузовой адрес и оптика занимают одну пару.',description:'Сначала доставь друга под низкий кожух. Затем сравни две настоящие тени и найди фиксатор за диафрагмой.',accent:0xffc57c,assets,hints:['Низкий кожух пропускает свободного друга, но не человека. Белый пол отправляет его в грузовой адрес.','Пара нужна уже для света: два луча идут через одно устье на разных высотах. Верхний должен достигнуть прибора, нижний — встретить корпус друга.','За открывшейся диафрагмой есть механический фиксатор. После него можно вернуть друга и пройти вдвоём.']},
 {id:'post-inverse-spring',title:'Обратная пружина',concept:'Сначала собственный вес наблюдателя сжимает настоящее пружинное ложе. Заряд выстреливает спутником вверх, а потолочный портал меняет направление.',description:'Сожми ложе, сохрани заряд механическим зажимом и загрузи друга. После отпускания он попадёт в низкий дальний приёмник.',accent:0x9dc8ed,assets,hints:['Вес человека сжимает видимую пружину сильнее веса друга. Зажим рядом с ложем сохраняет только достигнутое сжатие.','Сначала открой потолочный адрес и низкий грузовой выход. Поставь друга на сжатое ложе и отпусти пружину с наружного пульта.','Дальний приёмник открывает проход своим настоящим весом. По отдельной галерее доберись до фиксатора и забери того же друга.']},
 CREATIVE_COUNTERWEIGHT_SPEC,
 {id:'post-air-switch',title:'Переадресация',concept:'Непрерывный поток проходит настоящие порталы; два приёмника последовательно открывают разные физические шлюзы.',description:'Поток от вентилятора может питать только один приёмник за раз. В безопасной средней галерее перестрой его путь.',accent:0x9ce7ed,assets,hints:['Соедини источник воздуха с первой приёмной решёткой: первый шлюз откроется, пока поступает поток.','Оставь друга у входа, пройди на постоянную середину и зафиксируй открытый первый шлюз. Затем перемести выходной портал на вторую решётку.','Первый шлюз останется открытым на фиксаторе, второй откроется от нового потока. Напольный адрес у входа вернёт друга через порталы.']},
]);

function finish(k,spawn,cargo,goal,extra,geometry){
 const l=k.finishResearch(spawn,cargo,goal,{postCampaign:true,...extra});
 // Finish first: it installs the common floor texture and bakes world UVs on
 // every deck, including moving ones, before any material is specialized.
 for(const carrier of k.priorityCarriers??[]){
  const deck=carrier.group.children.find(child=>child.isMesh&&child.material===k.m.floor);
  if(!deck)throw new Error(`Missing moving floor for ${carrier.name}`);
  deck.material=deck.material.clone();
  deck.material.polygonOffset=true;
  deck.material.polygonOffsetFactor=-2;
  deck.material.polygonOffsetUnits=-2;
 }
 l.puzzleGeometry={noProgressFlags:true,recoveryFloor:k.base,footprint:(k.bounds.maxX-k.bounds.minX)*(k.bounds.maxZ-k.bounds.minZ),...geometry};
 return l;
}
function dockReadout(k,p,read){k.display(p,read,15,1.8);}
function finalSign(k,n,text,p){k.label(`${n} / ${text}`,p,[0,0,1],15,1.05);}
function prioritizeCarrierDeck(k,carrier){
 // A carriage must remain level with its stationary dock for walkable entry.
 // Give its deck a stable draw order where their top faces physically meet.
 // The mesh and its collision box stay at the original elevation.
 (k.priorityCarriers??=[]).push(carrier);
}
function undercarriage(k,car,top){
 // Cab suspension tracks are metal machine parts; the broad opening remains
 // traversable, while the deck and its moving collision remain authoritative.
 const cables=[];
 for(const dx of [-4.9,4.9]){
  const cable=k.geometry(new THREE.CylinderGeometry(.085,.085,1,8),'metal',[0,0,0],new THREE.Quaternion(),{batch:false,name:'Counterbalanced cabin hanger'});
  cables.push({cable,dx});
 }
 k.renders.push(()=>{for(const {cable,dx}of cables){const y=car.group.position.y;cable.position.set(car.group.position.x+dx,(top+y)/2,car.group.position.z+6);cable.scale.y=Math.max(.3,top-y);}});
}

export function buildPost31(game,index=30){return buildFreightRake(game,index,POST_A_SPECS[0]);}

export function buildPost32(game,index=31){
 const k=new ResearchChamber(game,POST_A_SPECS[1],index,'optical',{minX:-26,maxX:26,minZ:-25,maxZ:25},-3,14);
 k.deck('Optical dispatch hall',-24,24,8,23,0);
 k.deck('Low shadow laboratory',-24,24,-8,8,0);
 k.deck('Diaphragm receiving hall',-24,24,-23,-8,0);
 // A partition continues into the recovery foundation. Its underside is not
 // a second human route below the optical interlock.
 k.block([0,-1.5,-8],[52,3,.65],'dark');
 const dispatch=k.loadPad('shadow-dispatch',[0,0,16],8);
 const relay=k.panel('shadow-mouth',[-22,1.325,-1],[1,0,0],4,2.14);
 relay.mesh.userData.portalSize={width:1.6,height:.94};
 const source=k.panel('double-ray-intake',[14,1.325,17],[1,0,0],4,2.14);
 source.mesh.userData.portalSize={width:1.6,height:.94};
 const hood=freightHood(k,{x0:-20,x1:-14,z0:-3,z1:1,ceiling:2.8,name:'ГРУЗ / ДВЕ ВЫСОТЫ'});
 k.block([-24,7,-1],[.5,14,4.5],'shell');
 k.block([-19,7,-3],[10,14,.4],'shell');
 const cargoGuides=[-1.65,-.35].map(z=>lateShutter(k,'Cargo shadow guide wall',[-18.6,.525,z],[4.4,1.05,.18],[0,16,0]));
 const access=lateShutter(k,'Cargo-shadow inspection cover',[-19,7,1],[10,14,.4],[0,16,0]);
 // Two small optical slits admit shots and the two beam axes, but neither a
 // carried .78 m body nor the observer. Only the actual cargo aperture enters
 // this enclosed receiving bay. The high slit is the available aiming line.
 for(const [y0,y1]of [[0,.32],[.78,1.10],[1.55,1.90],[2.30,14]])k.block([-14,(y0+y1)/2,-1],[.35,y1-y0,4],'shell');
 for(const z of [-2.5,.5])k.block([-14,1.7,z],[.35,3.4,1],'shell');
 // The shallow end stop catches cargo below the lower optical axis. It does
 // not itself cast the required shadow at y=.55.
 k.block([-17.8,.15,-1],[.22,.30,3.7],'metal');
 k.projector([21,1.325,17],[-1,0,0],{radius:1.05});
 const sensors=[V(-17,.55,-1),V(-17,2.10,-1)];
 for(const [i,s]of sensors.entries())k.projector(s.toArray(),[-1,0,0],{radius:i?.28:.20});
 const drawings=[beamDrawing(k.world,0xf4bc7a,.045),beamDrawing(k.world,0x8ce4ed,.045)];
 const diaphragm=gate(k.world,-8,52,14),optics={raw:[false,false],shadow:[false,false],valid:false,latched:false};
 k.ticks.push(dt=>{
  const paths=[.55,2.10].map(y=>tracePortalRay(game,V(20.96,y,17),V(-1,0,0),{length:100}));
  optics.raw=paths.map((segments,i)=>rayTouches(segments,sensors[i],.22));
  optics.shadow=paths.map(segments=>cargoOccludes(game,segments));
  optics.valid=optics.raw[0]&&optics.raw[1]&&optics.shadow[0]&&!optics.shadow[1];
  drawings.forEach((drawing,i)=>drawing.update(clipCargoRay(game,paths[i])));
  diaphragm.update(optics.valid||optics.latched,dt,k.time);
  access.target=optics.latched;access.update(dt);for(const guide of cargoGuides){guide.target=optics.latched;guide.update(dt);}
 });
 k.control('diaphragm-ratchet',[7,0,-13],()=>{if(diaphragm.progress>.9)optics.latched=true;},'E — закрепить настоящую открытую диафрагму.');
 k.resets.push(()=>{optics.raw=[false,false];optics.shadow=[false,false];optics.valid=optics.latched=false;diaphragm.reset();});
 k.renders.push(a=>diaphragm.render(a,k.time));
 dockReadout(k,[0,10.6,-24.1],()=>`ВЕРХНИЙ ${optics.raw[1]&&!optics.shadow[1]?'СВЕТ':'НЕТ СВЕТА'} / НИЖНИЙ ${optics.shadow[0]?'ТЕНЬ ДРУГА':'СВЕТ'} / ${optics.latched?'ФИКСАТОР':'ЖИВАЯ ДИАФРАГМА'}`);
 finalSign(k,32,'ТОНКАЯ ТЕНЬ',[0,12.5,24.2]);
 return finish(k,[-6,0,20],[-9,.6,18],[0,0,-19],{dispatch,relay,source,hood,diaphragm,optics,access,spawnView:{yaw:0,pitch:-.05}},
  {orders:['freight-before-light','inspect-optics-first'],portalRoles:{'shadow-dispatch':'transport the original opaque small rigid body into a low passage','shadow-mouth':'a shared aperture for freight and two light heights','double-ray-intake':'borrow both portals for two geometric parallel rays'},deductions:['the observer cannot enter the cargo-height hood','one small opaque body blocks only the lower ray','moving the portal pair from cargo to light leaves cargo on real support','the differential receiver moves a real door','the door can be mechanically retained before retrieving its own optical obstruction']});
}

export function buildPost33(game,index=32){return buildInverseSpring(game,index,POST_A_SPECS[2]);}
export const buildPost34=buildCreative34;

export function buildPost35(game,index=34){
 const k=new ResearchChamber(game,POST_A_SPECS[4],index,'optical',{minX:-26,maxX:26,minZ:-27,maxZ:25},-3,16);
 k.deck('Entry side',-24,24,9,23,0);
 k.deck('Stable recombination court',-24,24,-7,9,0);
 k.deck('Exit side',-24,24,-25,-7,0);
 const dispatch=k.loadPad('companion-address',[0,0,17],8),first=gate(k.world,9,56,16),second=gate(k.world,-7,56,16);
 const source=k.panel('air-origin',[19,3,17],[0,0,1]);
 const inlet=k.panel('first-receiver',[-19,3,17],[0,0,1]);
 const outlet=k.panel('second-receiver',[-19,3,-3],[0,0,1]);
 k.panel('center-return',[10,3,-3],[0,0,1]);
 const fan=k.projector([19,3,23],[0,0,-1],{rotating:true,radius:1.2});
 const wheelA=k.projector([-19,3,23],[0,0,-1],{rotating:true,radius:1.05});
 const wheelB=k.projector([-19,3,4],[0,0,-1],{rotating:true,radius:1.05});
 const drawing=beamDrawing(k.world,0xa8e4ed,.06);let powered=[false,false],latched=false,firstLatched=false;
 k.ticks.unshift(dt=>{
  const segments=tracePortalRay(game,fan.position.clone().addScaledVector(fan.normal,.04),fan.normal,{medium:'air',length:110});drawing.update(segments);
  powered=[wheelA,wheelB].map(w=>segments.some(s=>s.direction.dot(w.normal)<-.9&&rayTouches([s],w.position,.85)));
  first.update(powered[0]||firstLatched,dt,k.time);second.update(powered[1]||latched,dt,k.time);
 });
 k.resets.push(()=>{first.reset();second.reset();powered=[false,false];latched=firstLatched=false;});
 k.renders.push(a=>{first.render(a,k.time);second.render(a,k.time);});
 k.control('first-latch',[-6,0,3],()=>{if(first.progress>.8)firstLatched=!firstLatched;},'E — удержать первые открытые створки механическим фиксатором.');
 k.control('second-latch',[6,0,-3.5],()=>{if(second.progress>.8)latched=!latched;},'E — зафиксировать открытые вторые створки перед перестановкой порталов.');
 k.label('ПОТОК / ШЛЮЗ I',[0,10.8,9.2],[0,0,-1],14,.8);
 k.label('ПОТОК / ШЛЮЗ II',[0,10.8,-6.8],[0,0,1],14,.8);
 dockReadout(k,[0,13.5,-26.1],()=>`ПРИЁМНИК I ${powered[0]?'В ПОТОКЕ':'БЕЗ ВОЗДУХА'} / ПРИЁМНИК II ${powered[1]?'В ПОТОКЕ':'БЕЗ ВОЗДУХА'}`);
 finalSign(k,35,'ПЕРЕАДРЕСАЦИЯ',[0,14.2,24]);
 return finish(k,[-5,0,19],[-8,.6,17],[0,0,-20],{first,second,dispatch,powered:()=>powered,isLatched:()=>latched,isFirstLatched:()=>firstLatched,spawnView:{yaw:0,pitch:-.08}},
  {orders:['dispatch-after-rewire','carry-after-first-latch'],portalRoles:{'air-origin':'captures real fan ray','first-receiver':'opens first physical sluice while the fan connects','second-receiver':'opens second sluice after rerouting from stable middle court','companion-address':'loose companion can be dispatched through the floor aperture','center-return':'receives loose companion without reopening the first sluice'}});
}

export const POST_A_BUILDERS=Object.freeze([buildPost31,buildPost32,buildPost33,buildPost34,buildPost35]);
