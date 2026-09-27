import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {ResearchChamber} from './LabResearchArt.js';
import {StoredMotionDrive} from './LabResearchChambers.js';
import {createLightBridge} from './LabLightBridge.js';
import {tracePortalRay,rayTouches,beamDrawing} from './LabPuzzleMechanics.js';

const V=(...p)=>new THREE.Vector3(...p);

export const POST_B_SPECS=Object.freeze([
 {id:'post-wind-light-relay',title:'Перестановка в пролёте',concept:'Мотор хранит движение, а два портала приходится освободить для последовательных световых мостов.',description:'Подними кабину направленным потоком, а затем перестрой световой путь на твёрдой развязке.',accent:0x82d9d5,assets:[1,2,11,22,23,24],hints:['Вентилятор и передняя решётка мотора смотрят на разные керамические панели.','Поднятая кабина удерживается механической передачей даже после смены порталов.','На твёрдой промежуточной площадке переставь дальний портал: только один световой мост может работать в каждый момент.']},
 {id:'post-three-berths',title:'Три причала',concept:'Портальная панель едет с одной настоящей кабиной между тремя доками. Промежуточный пульт открывает последний перегон.',description:'Войди в кабину через неподвижный портал, высадись у среднего дока и отправь её к последнему.',accent:0xe4ae74,assets:[1,2,11,22,23,24],hints:['Портал остаётся на борту подвижной кабины. Сначала доберись до первого причала.','Боковой пульт отправляет кабину к средней галерее. На самой галерее расположен следующий пульт.','Можно перевезти друга вместе с собой или сначала отправить на кабине и встретить через неподвижный портал.']},
 {id:'post-separated-freight',title:'Два маршрута',concept:'Один путешественник прыгает через шахту, другой ждёт на настоящем грузовом подъёмнике. Пульт находится только после перелёта.',description:'Отправь спутника на грузовую платформу, пройди в другое крыло к месту падения и запусти подъёмник с дальнего балкона.',accent:0xf0bc86,assets:[1,2,11,22,23,24],hints:['Спутник может ехать на пустой грузовой платформе, если поставить его на её настоящий настил.','Пульт подъёмника находится у высокой приёмной галереи. Туда ведёт балкон падения и наклонный портальный выход.','При промахе нижний сервисный ярус и настоящий широкий подъём возвращают к исходному балкону.']},
 {id:'post-two-projectors',title:'Смена источника',concept:'Мосты строятся двумя настоящими проекторами в противоположных направлениях, но одной портальной парой.',description:'Сначала достигни постоянной галереи. Затем используй второй источник, чтобы повернуть к выходу.',accent:0x9ccadd,assets:[1,2,11,22,23,24],hints:['Первый проектор подсвечивает левую панель. Его луч нужно вывести к промежуточному настилу.','Перестановку делай только на твёрдом промежуточном настиле: первый мост исчезнет, когда переставишь порталы.','Обрати внимание на второй проектор на галерее: его луч должен выйти из панели у поворота к выходу.']},
 {id:'post-station-heart',title:'Сердце станции',concept:'Движение и свет одновременно делят одну пару порталов; груз открывает физический финишный причал.',description:'Разгони маховик потоком, поднимись к промежуточному доку и перенаправь источник света через последний разрыв.',accent:0xf4ca81,assets:[1,2,11,22,23,24],hints:['Поток через порталы вращает маховик. Пассажиры нагружают подъёмник.','После подъёма мотор удерживает высоту: переставь пару порталов для проекции моста.','Последний участок начинается на постоянной площадке; спутник должен прийти к выходу вместе с тобой.']},
]);

function finish(k,spawn,cargo,goal,extra,roles,orders){
 const l=k.finishResearch(spawn,cargo,goal,{...extra,postCampaign:true,researchChamber:false,foundationChamber:false});
 l.puzzleGeometry={noProgressFlags:true,footprint:(k.bounds.maxX-k.bounds.minX)*(k.bounds.maxZ-k.bounds.minZ),goalHeight:goal[1],recoveryFloor:k.base,portalRoles:roles,orders};
 l.getContextLesson=()=>['post-room-'+l.index,'ЛКМ / ПКМ · E',l.spec.description,false];
 return l;
}
function light(k,origin,direction,width=4.8){return createLightBridge(k,{origin,direction,span:[0,0,1],width,length:110,name:'Projected load-bearing bridge'});}
function ownLight(l,...lights){const dispose=l.dispose;l.dispose=()=>{lights.forEach(b=>b.dispose());dispose();};}
function motor(k,{fanAt,sourceAt,receiverAt,wheelAt,cabin}){
 const g=k.game,drive=new StoredMotionDrive();
 k.panel('air-source',sourceAt,[0,0,1]);k.panel('air-receiver',receiverAt,[0,0,1]);
 const fan=k.projector(fanAt,[0,0,-1],{radius:1.05,rotating:true}),wheel=k.projector(wheelAt,[0,0,-1],{radius:1.45});
 const drawing=beamDrawing(k.world,0xb5e6eb,.06);
 k.ticks.unshift(dt=>{
  const segments=tracePortalRay(g,fan.position.clone().addScaledVector(fan.normal,.04),fan.normal,{length:110,medium:'air'});
  const powered=segments.some(s=>s.direction.dot(wheel.normal)<-.9&&rayTouches([s],wheel.position,.75));
  const f=cabin.floor,aboard=p=>p&&p.x>f.minX+.1&&p.x<f.maxX-.1&&p.z>f.minZ+.1&&p.z<f.maxZ-.1&&Math.abs(p.y-f.y)<.75;
  drive.step(dt,powered,(g.playerGrounded&&aboard(g.playerPosition))||(!g.heldCube&&aboard(g.cargo?.position)));
  cabin.stations[1].y=drive.heights[0];cabin.target=1;drawing.update(segments);
 });
 k.renders.push(()=>{wheel.rotor.rotation.z=drive.wheel.angle;});
 k.resets.push(()=>{drive.reset();cabin.stations[0].y=cabin.stations[1].y=0;cabin.reset();});
 return drive;
}

/** A wall-mounted readout of the real motor and exit ratchet. It sits behind
 * the upper switching deck, outside every walking and portal surface. */
function stationHeart(k,drive,latched){
 const root=new THREE.Group();root.name='Station heart / guarded drive';root.position.set(0,13,-26.25);k.world.root.add(root);
 const face=new THREE.Quaternion().setFromAxisAngle(V(1,0,0),Math.PI/2),flat=new THREE.Quaternion();
 const part=(geometry,material,p,q=flat,parent=root,name='Station heart assembly')=>
  k.geometry(geometry,material,p,q,{parent,batch:false,name});
 part(new THREE.CylinderGeometry(4.3,4.3,.24,48),'dark',[0,0,-.14],face);
 part(new THREE.CylinderGeometry(4.04,4.04,.13,48),'shell',[0,0,.04],face);
 part(new THREE.CylinderGeometry(3.68,3.68,.10,48),'dark',[0,0,.15],face);
 part(new THREE.TorusGeometry(4.08,.24,8,48),'metal',[0,0,.22]);
 part(new THREE.TorusGeometry(3.48,.10,6,48),'light',[0,0,.23]);
 for(let i=0;i<12;i++){
  const angle=i*Math.PI/6;
  part(new RoundedBoxGeometry(.55,.92,.24,2,.08),'metal',[Math.sin(angle)*3.78,Math.cos(angle)*3.78,.34],
   new THREE.Quaternion().setFromAxisAngle(V(0,0,1),-angle));
 }
 const rotor=new THREE.Group();rotor.name='Driven heart rotor';root.add(rotor);
 for(let i=0;i<8;i++){
  const angle=i*Math.PI/4;
  part(new RoundedBoxGeometry(.48,2.48,.26,2,.09),'secondary',[Math.sin(angle)*2.13,Math.cos(angle)*2.13,.29],
   new THREE.Quaternion().setFromAxisAngle(V(0,0,1),-angle),rotor,'Station heart rotor blade');
 }
 part(new THREE.CylinderGeometry(1.05,1.05,.27,32),'metal',[0,0,.43],face,rotor);
 const status=new THREE.MeshBasicMaterial({name:'Station exit ratchet indicator',color:0xf0ba6a,toneMapped:false});
 part(new THREE.TorusGeometry(.73,.11,8,32),status,[0,0,.62],flat,rotor,'Exit ratchet indicator');
 const restore=k.restoreLight.bind(k);k.restoreLight=()=>{status.dispose();restore();};
 k.renders.push(()=>{rotor.rotation.z=drive.wheel.angle;status.color.setHex(latched()?0x86e6c7:0xf0ba6a);});
}

/** 36: an elevated motor feed, then two orthogonal light routes. The player
 * changes direction on the permanently supported centre island. */
export function buildPost36(g,index=35){
 const k=new ResearchChamber(g,POST_B_SPECS[0],index,'gravity',{minX:-33,maxX:30,minZ:-41,maxZ:25},0,24);
 k.deck('Motor mezzanine',-28,-12,-23,-10,6);
 k.deck('Permanent relay island',-2,11,-19,-9,6);
 // The eleven-metre span is wider than a running jump. The perpendicular
 // light projection supplies actual support, with a dry service floor below.
 k.deck('Exit receiving balcony',-2,11,-39,-30,6);
 const cabin=k.carrier('rising-feed',[[-20,0,-10],[-20,6,-10]],{width:12,depth:12,portal:false});
 const drive=motor(k,{fanAt:[21,3,21],sourceAt:[21,3,15],receiverAt:[-18,3,-25.7],wheelAt:[-18,3,-18],cabin});
 k.panel('light-source',[-13,6.75,11],[-1,0,0],8,4.82);
 k.panel('island-beam',[-31.4,6.75,-17],[1,0,0],8,4.82);
 k.panel('last-turn',[5,6.75,-6.7],[0,0,-1],8,4.82);
 k.projector([-23,6.20,11],[1,0,0],{radius:.85});k.support(-24,11,5.1,.55);
 const bridge=light(k,[-22.98,6.20,11],[1,0,0]);
 k.control('motor-recall',[-11,0,7],()=>{drive.heights[0]=0;cabin.stations[1].y=0;},'E — опустить кабину. Спутник и порталы не сбрасываются.');
 k.display([0,20,-40.15],()=>`${drive.flow?'ПОТОК НА РЕШЁТКЕ':'НЕТ ПОТОКА'} / МАХОВИК ${drive.wheel.omega.toFixed(1)} рад/с\n${bridge.segments.length>1?'ЛУЧ ПРОХОДИТ ЧЕРЕЗ ПОРТАЛЫ':'ЛУЧ ПРЕРВАН'}`,24,2);
 k.label('36 / ПЕРЕСТАНОВКА В ПРОЛЁТЕ',[0,22,-40.1],[0,0,1],23,1.2);
 const l=finish(k,[2,0,18],[-1,.6,15],[5,6,-34],{drive,cabin,light:bridge,spawnView:{yaw:.22,pitch:-.12}},
  {'air-source':'capture the physical fan current','air-receiver':'feed the actual turbine front','light-source':'capture the single projector','island-beam':'first bridge from lifted gallery to permanent island','last-turn':'redirect the same light north from safe island'},['raise-then-relay','prepare-light-first']);
 ownLight(l,bridge);return l;
}

/** 37: three physical berths. A moving portal remains the sole address for
 * the car, while the middle console is reached on a real landing. */
export function buildPost37(g,index=36){
 const k=new ResearchChamber(g,POST_B_SPECS[1],index,'orbital',{minX:-29,maxX:29,minZ:-24,maxZ:22},-3,25);
 k.deck('Freight dispatch',-27,-9,6,20,0);
 k.ramp('Lower dispatch return',-23,-15,-6,6,-3,0);
 k.deck('First berth',-27,-5,-22,-10,6);
 k.deck('Intermediate switching dock',-5,5,-22,-10,8);
 k.deck('Final receiving dock',5,27,-22,-10,10);
 const c=k.carrier('three-berth-car',[[-16,6,-10],[0,8,-10],[16,10,-10]],{width:20,depth:12});c.speed=4;
 c.panel.group.position.z=6;c.panel.sync(0);
 k.panel('stationary-entry',[-27.4,2.5,12],[1,0,0]);
 let middleGear=false;
 const cabConsole=k.control('onboard-selector',[-13,6,0],()=>{
  if(c.at(0))c.target=1;
  else if(c.at(1)&&middleGear)c.target=2;
  else if(c.at(2))c.target=0;
 },'E — ход к следующему причалу. Между II и III включи передачу на среднем доке.');
 c.group.attach(cabConsole.art);cabConsole.collider.kinematic=true;
 const syncConsole=dt=>{
  c.group.updateWorldMatrix(true,true);
  cabConsole.position.copy(c.position).add(V(3,.8,10));
  g.syncCollision(cabConsole.collider,new THREE.Box3().setFromObject(cabConsole.art),dt);
 };
 k.ticks.push(syncConsole);k.resets.push(()=>{middleGear=false;syncConsole(0);});
 k.control('first-dispatch',[-21,6,-17],()=>{c.target=1;},'E — отправить кабину к среднему причалу.');
 k.control('middle-dispatch',[0,8,-17],()=>{middleGear=true;},'E — включить вторую передачу; затем возвращайся в кабину.');
 k.control('last-return',[21,10,-17],()=>{c.target=0;},'E — вернуть кабину к первому причалу вместе с грузом.');
 for(const [x,y] of [[-16,6],[0,8],[16,10]]){
  k.block([x,y+3.55,-23.04],[8,.22,.18],'secondary',false);
  k.label(`ПРИЧАЛ ${x<0?'I':x===0?'II':'III'}`,[x,y+4.3,-23.05],[0,0,1],8,.8);
 }
 k.display([0,21,-23.08],()=>`КАБИНА ${c.at(2)?'У ПРИЧАЛА III':c.at(1)?'У ПРИЧАЛА II':c.at(0)?'У ПРИЧАЛА I':'В ПУТИ'}\nПЕРЕДАЧА ${middleGear?'II / III':'I / II'} / ПОРТАЛ ЕДЕТ С КАБИНОЙ`,23,2);
 const l=finish(k,[-16,0,16],[-19,.6,13],[16,10,-17],{car:c,spawnView:{yaw:0,pitch:.04}},
  {'stationary-entry':'stable lower entry to the current moving portal address','three-berth-car':'moving address spans three genuinely separate docking heights'},['ride-all-berths','dispatch-cargo-first']);
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
 // Its entrance abuts the east feeder at z=6. The destination touches the
 // high unloading deck at z=-4. Weight sits on its own moving floor.
 const freight=k.carrier('original-cargo-hoist',[[11,0,-6],[11,15,-6]],{width:12,depth:12,portal:false});freight.speed=3;
 k.control('upper-dispatch',[17,15,-19],()=>{freight.target=1;},'E — поднять грузовую платформу со спутником.');
 k.control('lower-dispatch',[18,0,13],()=>{freight.target=1;},'E — отправить груз на верхний причал до своего перелёта.');
 k.control('upper-recall',[4,15,-21],()=>{freight.target=0;},'E — вернуть грузовую платформу на нижний причал.');
 k.block([24,21,-20],[1,11,12],'secondary');
 k.display([0,25,-27.16],()=>`ПЛАТФОРМА ${freight.at(1)?'У ВЕРХНЕГО ДОКА':freight.at(0)?'ВНИЗУ':'В ПУТИ'}\nПЕРЕЛЁТ И ПОДЪЁМНИК — ДВА ОТДЕЛЬНЫХ МАРШРУТА`,25,2);
 k.label('38 / ДВА МАРШРУТА',[-29.2,9,16],[1,0,0],16,1.2);
 const l=finish(k,[9,0,17],[7,.6,14],[16,15,-19],{fallPad:pit,outlet,freight,spawnView:{yaw:-.17,pitch:-.10}},
  {'well-entry':'receives the real western drop','angle-outlet':'converts western momentum toward north flight catch'},['carry-freight-then-launch','send-freight-early']);
 return l;
}

/** 39: two independently manufactured projectors are oppositely oriented.
 * The first reaches the island; the second takes its beam north to the goal. */
export function buildPost39(g,index=38){
 const k=new ResearchChamber(g,POST_B_SPECS[3],index,'current',{minX:-30,maxX:30,minZ:-27,maxZ:23},-4,20);
 k.deck('First projector gallery',-27,-15,0,20,6);
 k.deck('Permanent inspection island',-1,11,-1,13,6);
 k.deck('Exit gallery',-1,11,-25,-15,6);
 k.ramp('Dry recovery ascent',-27,-19,-17,0,-4,6);
 k.panel('source-one',[-15.8,6.75,-12],[-1,0,0]);
 k.panel('island-arrival',[-29.2,6.75,7],[1,0,0]);
 k.projector([-23,6.20,-12],[1,0,0],{radius:.85});
 const first=light(k,[-22.98,6.20,-12],[1,0,0],5.2);
 // The second source points south toward its own intercept. The portal on
 // the island points north across the exit-side gap after reconfiguration.
 k.panel('source-two',[17,6.75,5],[-1,0,0]);
 k.panel('exit-turn',[5,6.75,15],[0,0,-1]);
 k.projector([12,6.20,5],[1,0,0],{radius:.85});k.support(12,5,4.9,.52);
 const second=light(k,[12.02,6.20,5],[1,0,0],5.2);
 k.display([0,16,-26.22],()=>`${first.segments.length>1?'ИСТОЧНИК I / МОСТ':'ИСТОЧНИК I / НЕТ СВЯЗИ'}\n${second.segments.length>1?'ИСТОЧНИК II / МОСТ':'ИСТОЧНИК II / НЕТ СВЯЗИ'}`,22,2);
 k.label('39 / СМЕНА ИСТОЧНИКА',[-29.32,12,12],[1,0,0],17,1.3);
 const l=finish(k,[-21,6,15],[-23,6.6,13],[5,6,-20],{first,second,spawnView:{yaw:.4,pitch:-.05}},
  {'source-one':'intercept west source','island-arrival':'deliver first light bridge','source-two':'intercept east source after standing on permanent island','exit-turn':'turn second source north'},['companion-first','scout-first']);
 ownLight(l,first,second);return l;
}

/** 40: the one motor first raises a pair, then the same two apertures become
 * the only load-bearing bridge to the upper receiving gallery. */
export function buildPost40(g,index=39){
 const k=new ResearchChamber(g,POST_B_SPECS[4],index,'optical',{minX:-34,maxX:31,minZ:-28,maxZ:26},0,24);
 k.deck('Motor terrace',-29,-11,-24,-10,6);
 k.deck('Narrow central switching causeway',-3,9,-22,-12,6);
 k.deck('Receiving gallery',9,29,-24,-10,6);
 const cabin=k.carrier('station-heart-cabin',[[-20,0,-10],[-20,6,-10]],{width:12,depth:12,portal:false});
 const drive=motor(k,{fanAt:[22,3,22],sourceAt:[22,3,16],receiverAt:[-18,3,-26],wheelAt:[-18,3,-18.3],cabin});
 k.panel('projector-capture',[-12,6.75,11],[-1,0,0],8,4.82);
 k.panel('first-light-destination',[-32.25,6.75,-17],[1,0,0],8,4.82);
 k.projector([-22,6.20,11],[1,0,0],{radius:.85});
 const bridge=light(k,[-21.98,6.20,11],[1,0,0],5.2);
 // The companion first holds the pressure plate on the real switching deck.
 // A ratchet locks the visible shutter open; carrying the same companion on
 // to the goal does not erase an already completed mechanical action.
 const plate=k.loadPad('central-load',[5,6,-17],3.2);
 const shutter=k.block([12.9,9,-17],[.85,6,14],'secondary',false);
 const shutterCollider=g.collisionProxy(new THREE.Box3().setFromObject(shutter),{kinematic:true});
 let ratchet=false,shutterHeight=9;
 stationHeart(k,drive,()=>ratchet);
 k.ticks.push(dt=>{
  if(plate.loaded())ratchet=true;
  shutterHeight=THREE.MathUtils.damp(shutterHeight,ratchet?17:9,5,dt);
  shutter.position.y=shutterHeight;shutter.updateMatrixWorld(true);
  g.syncCollision(shutterCollider,new THREE.Box3().setFromObject(shutter),dt);
 });
 k.resets.push(()=>{ratchet=false;shutterHeight=9;shutter.position.y=9;g.syncCollision(shutterCollider,new THREE.Box3().setFromObject(shutter),0);});
 k.control('counterweight-return',[-10,0,7],()=>{drive.heights[0]=0;cabin.stations[1].y=0;},'E — опустить кабину для нового подъёма.');
 k.display([0,20,-27.15],()=>`ПРИВОД ${drive.wheel.omega.toFixed(1)} рад/с / КАБИНА ${cabin.position.y.toFixed(1)} м\n${bridge.segments.length>1?'ПРОЕКЦИЯ ПРОХОДИТ':'ПРОЕКЦИЯ ПРЕРВАНА'} / СТВОРКА ${ratchet?'ОТКРЫТА':'ЗАКРЫТА'}`,25,2);
 k.label('40 / СЕРДЦЕ СТАНЦИИ',[0,22,-27.13],[0,0,1],21,1.1);
 const l=finish(k,[2,0,18],[-1,.6,15],[19,6,-17],{drive,cabin,light:bridge,plate,shutter,shutterCollider,spawnView:{yaw:.20,pitch:-.13}},
  {'air-source':'physical wind from fan','air-receiver':'feed worm-gear drive','projector-capture':'switch from air to light on stable terrace','first-light-destination':'make permanent approach to far gallery','central-load':'companion physically releases and latches visible shutter'},['motor-then-plate','bridge-prepared-first']);
 ownLight(l,bridge);return l;
}

export const POST_B_BUILDERS=Object.freeze([buildPost36,buildPost37,buildPost38,buildPost39,buildPost40]);
