import * as THREE from 'three';
import {ResearchChamber} from './LabResearchArt.js';
import {gate,tracePortalRay,rayTouches,beamDrawing} from './LabPuzzleMechanics.js';

const V=(...v)=>new THREE.Vector3(...v);
const assets=[1,2,11,22,23,24];
export const POST_A_SPECS=Object.freeze([
 {id:'post-relay-docks',title:'Пересадка',concept:'Неподвижный остров сохраняет маршрут, пока груз переключает адрес двух независимых платформ.',description:'Груз вызывает первый причал. Закрепи его маршрут, верни спутника через пол и отправь второй причал к выходу.',accent:0x8de3c3,assets,hints:['Оставь спутника на круглой напольной панели: его вес вызывает первый подъёмник. Сам встань на его настил.','На средней площадке зажми тормоз. Напольная панель у старта ведёт сюда через вторую портальную стену.','Когда друг снова с тобой, второй подъёмник доставит обоих на выход. Обе кабины возвращаются своими пультами.']},
 {id:'post-cross-lock',title:'Обратный шлюз',concept:'Один груз меняет состояние двух настоящих створок: первую открывает, вторую освобождает.',description:'Один груз удерживает входной шлюз. Проход за ним есть, но у выхода створки работают наоборот.',accent:0xffc57c,assets,hints:['Положи друга на напольную платформу у входа: откроются первые створки.','За створками простреливается обратная сторона платформы. Верни друга через порталы, тогда выходной шлюз освободится.','Если вернёшься до извлечения друга, первая дверь удерживает проход, пока ты находишься в проёме.']},
 {id:'post-switchyard',title:'Стрелочная',concept:'Два разных весовых причала у одной кабины; промежуточный док нужен, чтобы изменить направление.',description:'Одна каретка связывает два берега, но второй маршрут начинается только на неподвижной пересадке.',accent:0x8bc9f5,assets,hints:['Помести друга на первый причал. Вес перемещает широкую каретку к острову.','Закрепи каретку у промежуточной галереи и выведи друга напольным порталом со старой платформы.','Перемести его на второй причал острова. После пересадки оставайся на каретке и возвращай его с нового адреса.']},
 {id:'post-counterweight',title:'Противовес',concept:'Две противоположные площадки связаны грузом и механическим стопором; остановить на нужной высоте можно вручную.',description:'Когда друг нагружает противовес, левый настил идёт вверх, а правый вниз. Стопор сохраняет достигнутую высоту.',accent:0xd9bded,assets,hints:['Встань на левую площадку; перенеси спутника на правую грузовую платформу.','На промежуточной галерее зажми стопор. Если убрать груз раньше, обе платформы вернутся.','Напольный портал правой платформы позволяет достать друга после фиксации механизма. Затем доберитесь к выходу вместе.']},
 {id:'post-air-switch',title:'Переадресация',concept:'Непрерывный поток проходит настоящие порталы; два приёмника последовательно открывают разные физические шлюзы.',description:'Поток от вентилятора может питать только один приёмник за раз. В безопасной средней галерее перестрой его путь.',accent:0x9ce7ed,assets,hints:['Соедини источник воздуха с первой приёмной решёткой: первый шлюз откроется, пока поступает поток.','Оставь друга у входа, пройди на постоянную середину и перемести выходной портал на вторую решётку.','Первый шлюз закроется за тобой, второй откроется. Напольный адрес у входа вернёт друга через порталы.']},
]);

function finish(k,spawn,cargo,goal,extra,geometry){
 const l=k.finishResearch(spawn,cargo,goal,{postCampaign:true,...extra});
 l.puzzleGeometry={noProgressFlags:true,recoveryFloor:k.base,footprint:(k.bounds.maxX-k.bounds.minX)*(k.bounds.maxZ-k.bounds.minZ),...geometry};
 return l;
}
function dockReadout(k,p,read){k.display(p,read,15,1.8);}
function finalSign(k,n,text,p){k.label(`${n} / ${text}`,p,[0,0,1],15,1.05);}
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

export function buildPost31(game,index=30){
 const k=new ResearchChamber(game,POST_A_SPECS[0],index,'orbital',{minX:-27,maxX:27,minZ:-25,maxZ:23},-4,19);
 k.deck('First dock',-25,-7,-2,21,0);
 k.deck('Fixed exchange island',-6,7,-13,5,6);
 k.deck('Upper destination dock',11,25,-23,-8,10);
 k.ramp('West dry return',-25,-17,-15,-2,-4,0);
 const call=k.loadPad('entry-weight',[-18,0,12],8);
 const first=k.carrier('first-dock',[[-12,0,-9],[0,6,-9]],{width:12,depth:12,portal:false});first.speed=2.3;first.braked=true;
 const second=k.carrier('last-dock',[[8,6,-18],[8,10,-18]],{width:12,depth:12,portal:false});second.speed=2.2;
 k.ticks.unshift(()=>{first.target=call.loaded()?1:0;});
 k.ticks.unshift(()=>{const p=game.playerPosition,f=second.floor;if(game.playerGrounded&&Math.abs(p.y-f.y)<.15&&p.x>8.3&&p.x<f.maxX-.4&&p.z<-10&&p.z>f.minZ+.4)second.target=1;});
 k.resets.push(()=>{first.braked=true;});
 k.control('first-departure',[-12,0,2],()=>{first.braked=false;},'E — отпустить первый причал после загрузки.');
 // A physical brake preserves a bridge after the initiating mass leaves it.
 k.control('island-brake',[4.4,6,3],()=>{first.braked=!first.braked;},'E — зажать / отпустить механический тормоз первого причала.');
 k.control('upper-dispatch',[-2,6,-5],()=>{second.target=1;},'E — отправить второй причал к выходу.');
 k.control('island-recall',[0,6,-11],()=>{second.target=0;},'E — вернуть пустой второй причал на пересадку.');
 k.control('upper-recall',[13.5,10,-11],()=>{second.target=0;},'E — вернуть второй причал на пересадку.');
 k.panel('relay-receiver',[6.7,8.85,2],[-1,0,0]);
 k.label('ОСТРОВ / СТОПОР',[0,10.8,-24.1],[0,0,1],14,.78);
 k.label('ВЫХОД / ВТОРОЙ ПРИЧАЛ',[16,14,-24.1],[0,0,1],16,.9);
 dockReadout(k,[0,16,-24.1],()=>`I ${first.position.y.toFixed(1)} м ${first.braked?'ТОРМОЗ':'ДВИЖЕНИЕ'}   /   II ${second.position.y.toFixed(1)} м`);
 finalSign(k,31,'ПЕРЕСАДКА',[0,17.6,22.2]);
 undercarriage(k,first,16.2);undercarriage(k,second,16.2);
 return finish(k,[-19,0,18],[-21,.6,16],[18,10,-18],{first,second,call,spawnView:{yaw:.30,pitch:-.09}},
  {orders:['straight-transfer','empty-upper-first'],goalHeight:10,portalRoles:{'entry-weight':'cargo calls the first cabin; after braking, floor portal returns the same cargo','relay-receiver':'retrieve the original companion to the fixed island','first-dock':'weight-driven first transport','last-dock':'independent second transport'}});
}

export function buildPost32(game,index=31){
 const k=new ResearchChamber(game,POST_A_SPECS[1],index,'kinetic',{minX:-23,maxX:23,minZ:-25,maxZ:25},-3,14);
 k.deck('Start court',-21,21,6,23,0);
 k.deck('Center court',-21,21,-7,6,0);
 k.deck('Exit court',-21,21,-23,-7,0);
 const pad=k.loadPad('reverse-weight',[0,0,15],8),entry=gate(k.world,6,50,14),exit=gate(k.world,-7,50,14);
 k.ticks.push(dt=>{entry.update(pad.loaded(),dt,k.time);exit.update(!pad.loaded(),dt,k.time);});
 k.resets.push(()=>{entry.reset();exit.reset();});
 k.renders.push(a=>{entry.render(a,k.time);exit.render(a,k.time);});
 k.panel('return-mouth',[0,2.9,-3],[0,0,1]);
 k.block([-9,5.6,-5.9],[9,.4,1.2],'secondary');
 k.label('I / ДРУГ НА ПЛИТЕ',[0,7,6.5],[0,0,1],13,.75);
 k.label('II / ПЛИТА СВОБОДНА',[0,7,-6.5],[0,0,1],14,.75);
 dockReadout(k,[0,11.4,-24.1],()=>`ВХОД ${entry.progress>.8?'ОТКРЫТ':'ЗАКРЫТ'}  /  ВЫХОД ${exit.progress>.8?'ОТКРЫТ':'ЗАКРЫТ'}`);
 finalSign(k,32,'ОБРАТНЫЙ ШЛЮЗ',[0,12.5,24.2]);
 return finish(k,[-6,0,19],[-9,.6,18],[0,0,-18],{entry,exit,pad,spawnView:{yaw:0,pitch:-.05}},
  {orders:['load-then-return','prepare-return-first'],portalRoles:{'reverse-weight':'one real load swaps access to the two doorways','return-mouth':'receives the original companion after the first doorway'}});
}

export function buildPost33(game,index=32){
 const k=new ResearchChamber(game,POST_A_SPECS[2],index,'current',{minX:-27,maxX:27,minZ:-26,maxZ:23},-4,21);
 k.deck('Departure boardwalk',-25,-8,2,21,0);
 k.deck('Midpoint fixed gallery',-5,7,-15,5,6);
 k.deck('Receiving balcony',8,25,-23,-5,6);
 k.ramp('West return to departure',-25,-17,-12,2,-4,0);
 const near=k.loadPad('branch-a',[-18,0,12],8),far=k.loadPad('branch-b',[1,6,0],8);
 const car=k.carrier('switch-carriage',[[-13,0,-10],[0,6,-10],[15,6,-10]],{width:12,depth:12,portal:false});car.speed=3.2;car.braked=true;
 // Pads have immediate mechanical priority. The shunt brake keeps the car
 // where it stands while the passenger removes the load and changes address.
 k.ticks.unshift(()=>{car.target=far.loaded()?2:near.loaded()?1:0;});
 k.resets.push(()=>{car.braked=true;});
 k.control('first-departure',[-13,0,-1.3],()=>{car.braked=false;},'E — отпустить каретку после загрузки первой стрелки.');
 k.control('shunt-brake',[5,6,3.1],()=>{car.braked=!car.braked;},'E — остановить или отпустить стрелочную каретку.');
 k.control('second-departure',[0,6,-8],()=>{car.braked=false;},'E — отпустить каретку ко второму причалу.');
 k.panel('island-return',[-4.8,8.85,-12],[1,0,0]);
 k.panel('destination-return',[23.3,8.85,-15],[-1,0,0]);
 k.label('ПРИЧАЛ А / ОСТРОВ',[0,10.8,-24.8],[0,0,1],14,.82);
 k.label('ПРИЧАЛ Б / ВЫХОД',[16,10.8,-24.8],[0,0,1],14,.82);
 dockReadout(k,[0,18,-25],()=>`СТРЕЛКА: ${car.target===2?'ВЫХОД':car.target===1?'ОСТРОВ':'СТАРТ'} / ${car.braked?'СТОПОР ЗАЖАТ':'В ДВИЖЕНИИ'}`);
 finalSign(k,33,'СТРЕЛОЧНАЯ',[0,19.2,22.2]);undercarriage(k,car,17);
 return finish(k,[-19,0,18],[-21,.6,16],[18,6,-18],{car,near,far,spawnView:{yaw:.24,pitch:-.08}},
  {orders:['ride-then-send','friend-before-passenger'],goalHeight:6,portalRoles:{'branch-a':'first weight selects fixed island','island-return':'retrieves weight onto fixed island','branch-b':'second weight selects exit','destination-return':'retrieves the same loose companion at the destination dock'}});
}

export function buildPost34(game,index=33){
 const k=new ResearchChamber(game,POST_A_SPECS[3],index,'gravity',{minX:-25,maxX:25,minZ:-24,maxZ:24},-4,20);
 k.deck('West preparation',-23,-6,0,22,0);
 k.deck('East loading lane',6,23,0,22,0);
 k.deck('Left high gallery',-23,-7,-22,-5,8);
 k.deck('Right high gallery',7,23,-22,-8,8);
 k.ramp('Left maintenance climb',-24.5,-16.5,-10,0,-4,0);
 k.ramp('Right maintenance climb',15,23,-10,0,-4,0);
 const mass=k.loadPad('right-weight',[14,0,15],8);
 const left=k.carrier('west-counterweight',[[-15,0,-9],[-15,8,-9]],{width:12,depth:12,portal:false});
 const right=k.carrier('east-counterweight',[[15,8,-9],[15,0,-9]],{width:12,depth:12,portal:false});
 left.speed=right.speed=2.0;let locked=true;
 k.ticks.unshift(()=>{left.target=right.target=mass.loaded()?1:0;left.braked=right.braked=locked;});
 k.control('clamp',[-20,8,-19],()=>{locked=!locked;},'E — фиксатор останавливает оба настоящих настила.');
 k.control('start-counterweight',[-17,0,1.7],()=>{locked=false;},'E — отпустить противовес после погрузки.');
 k.panel('west-receiver',[-7.5,10.85,-15],[-1,0,0]);
 k.panel('east-service',[23.1,2.85,10],[-1,0,0]);
 k.label('МАССА → ПОДЪЁМ',[-14,4.0,22.2],[0,0,-1],14,.8);
 k.label('ПАРНЫЕ ПРОТИВОВЕСЫ',[0,16,-23.1],[0,0,1],19,1.1);
 dockReadout(k,[0,18,-23.1],()=>`ЗАПАД ${left.position.y.toFixed(1)} м / ВОСТОК ${right.position.y.toFixed(1)} м / ${locked?'ФИКСАТОР':'СВОБОДНЫЙ ХОД'}`);
 finalSign(k,34,'ПРОТИВОВЕС',[0,18.7,23.1]);undercarriage(k,left,17);undercarriage(k,right,17);
 return finish(k,[-19,0,18],[-21,.6,16],[-18,8,-17],{left,right,mass,getClamped:()=>locked,spawnView:{yaw:.25,pitch:-.06}},
  {orders:['load-then-clamp','explore-service-first'],goalHeight:8,portalRoles:{'right-weight':'weight rebalances both physical cabins','west-receiver':'retrieves original load after the counterweights are clamped','east-service':'optional recovery address for the right-hand lane'}});
}

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
