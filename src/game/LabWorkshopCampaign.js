import * as THREE from 'three';
import {Workshop,V,wall,glass} from './LabWorkshopKit.js';
import {Body,Box,Vec3,Material,Quaternion} from 'cannon-es';
import {cargoLoadsPlate} from './LabPlateContact.js';
const specs=[
 ['spring-mail','Пружинная почта','Гравитация и механическая защёлка','Высота падения сжимает настоящий пружинный поршень.',[32],['Друг может падать из потолочного портала. Пружина внизу принимает удар.','Обычный вес недостаточен: нужен разгон падением. Белое поле над поршнем — потолок, а не стена.','Свяжи пол загрузочной зоны с потолком над поршнем. Поставь друга на вход, дождись защёлки и забери его у сжатой пружины.']],
 ['freight-ferry','Грузовой паром','Перевозка под низким перекрытием','Пассажирский путь и путь небольшого груза здесь различаются.',[37],['На верхней станции есть грузовая каретка. Низкий тоннель не рассчитан на человека.','Отправь друга на каретке. Загруженная каретка отодвинет крышку станции при стыковке.','Поднимись по лестнице или порталами на погрузочный балкон с другом. Поставь его на каретку, отправь рейс рычагом, затем создай новую пару на открывшейся станции.']],
 ['stored-wind','Запас ветра','Инерция маховика и работа привода','Сначала раскрути маховик, потом подключи нагрузку.',[31,35,39],['Воздух проходит через порталы и вращает турбину. Видимый маховик сохраняет вращение.','Рычаг у турбины подключает подъёмный механизм. Соединение без вращения ничего не поднимет.','Направь поток через пару на турбину, включи вентилятор и затем сцепление. Дождись, пока привод поднимет затвор.']],
 ['carousel-address','Карусель адресов','Движущаяся ориентация портала','Одна вращающаяся панель обслуживает разные изолированные балконы.',[38],['Портал закрепляется на панели и поворачивается вместе с ней.','Друг и выход находятся на разных балконах. После первого рейса вернись к рычагу.','Поставь выход на лицевую сторону барабана и вход внизу. Поверни его к другу, забери друга, вернись, поставь друга, поверни ещё раз и отправляйся к выходу.']],
 ['hold-the-height','Тормоз высоты','Противовес и механический тормоз','Подними площадку весом друга и закрепи её прежде, чем вернуть груз.',[33,39],['Друг на плите поднимает площадку. Снятие веса возвращает её вниз.','Наверху есть тормоз лебёдки. Он удерживает реальное положение привода, а не запоминает нажатие плиты.','Подготовь вход и выход на подвижной панели, нагрузи плиту, поднимись. Затяни верхний тормоз, затем верни друга порталом в плите.']],
 ['gentle-crane','Бережный кран','Захват и транспортировка физического груза','Вытащи друга из низкого отсека механическим захватом.',[36,39],['Прозрачная крышка не пропускает руки. Захват может поднять крышку вместе с грузом.','Рычаг последовательно опускает захват, поднимает и переносит его. Пружинный хват не телепортирует друга.','Войди порталами в операторскую, опусти захват и дождись контакта. Затем подними, перенеси к приёмной чаше и отпусти.']],
 ['air-shutters','Жалюзи','Проходимость воздуха и механические заслонки','Открывай нужный воздуховод, а не рисуй направление силы.',[31,35],['Стеклянные заслонки останавливают воздух, хотя за ними всё видно.','За боковым проходом есть второй рычаг. Одна открытая заслонка ещё не делает сквозной канал.','Направь воздух к турбине и открой обе заслонки с разных сторон канала. Сквозной поток раскрутит подключённый привод.']],
 ['load-exchange','Перестановка опор','Подвижная точка обзора','Подними панель к сервисному окну и проложи путь за перегородку.',[37],['Подвижная секция несёт портальную панель. Поднимаясь, она открывает сервисное окно.','Окно пропускает выстрел, но его высоты недостаточно для игрока. Портал нужен и после подъёма.','Поставь выход на подвижную панель, подними её и пройди с другом. Оставь друга на площадке; с левого края видна белая стена за окном. Переставь пару между панелью и этой стеной, забери друга и пройди.']],
 ['wind-ferry','Парусный док','Сила ветра и масса платформы','Направь ветер в парус реальной подвижной платформы.',[31,37,39],['Платформа едет под действием потока. Пропустил рейс — верни её лебёдкой у ближнего причала.','Портальная пара меняет путь воздуха. Нужен поток вдоль рельса, не поперёк.','Свяжи воздухозаборную стену с боковой стеной у рельса. Включи вентилятор, забери друга и сядь на платформу; на другом берегу выйди к двери.']],
 ['sorting-table','Поворотный сортировщик','Ролики и ориентация механизма','Поверни стол до загрузки. Неверный выход возвращает груз в зал.',[38],['Ролики толкают свободный груз в сторону открытого борта стола.','Приёмная чаша стоит у единственного жёлобa. С других сторон груз упадёт на пол, где его можно подобрать.','Поверни ролики к жёлобу и включи привод. Подай друга на стол через портал, дождись доставки в чашу, обойди стол и забери друга.']],
 ['soft-landing','Мягкая посадка','Упругий отскок','Наклонная подушка отбрасывает друга к боковому поршню.',[32,33],['Упругая чаша возвращает часть скорости падения. Слабое падение даёт небольшой отскок.','Приёмник смещён в сторону. Падая, друг проходит рядом; отражаясь от наклонной подушки, нажимает поршень снизу.','Поставь вход под другом, а выход на потолке над подушкой. Дождись отскока и щелчка бокового поршня, подбери друга и пройди к открывшемуся выходу.']],
 ['shared-workshop','Общая мастерская','Передача энергии и освобождение груза','Преврати портальную пару из линии питания в дорогу для двоих.',[31,35,33,39],['Ветер питает привод, а тормоз сохраняет поднятую площадку. Это разные задачи.','На сервисном помосте справа удобно увидеть поднятую панель. После настройки питания та же портальная пара должна стать маршрутом для вас двоих.','Направь ветер в турбину и подключи сцепление. Поднимись на правый помост, чтобы поставить портал на поднятую левую панель. Пройди наверх и затяни тормоз. Вернись той же парой за другом и пройди к выходу вместе.']],
];
export const WORKSHOP_CAMPAIGN=Object.freeze(specs.map(([id,title,concept,description,assets,hints],i)=>({id,title,concept,description,assets:[1,2,11,22,23,24,...assets],hints,accent:[0xf0ba7a,0x8de1cb,0xc7abeb,0x8bcce4,0xc2d687,0xf4c4a3][i%6]})));
function plateFrame(p,w=2,h=2){return{center:V(...p),normal:V(0,1,0),right:V(1,0,0),up:V(0,0,1),halfWidth:w/2,halfHeight:h/2};}
export function buildWorkshopCampaign(game,index){
 const spec=WORKSHOP_CAMPAIGN[index-8];if(!spec)throw Error('Unknown workshop');const k=new Workshop(game,spec,index),w=k.world;
 let spawn=[2,0,11],cargo=[0,.55,9],goal=[0,0,-16];
 const spans={8:12,9:12,10:14,11:12,12:12,13:15,14:14,15:12,16:12,17:13,18:14,19:15};const half=spans[index];const bounds={minX:-half,maxX:half,minZ:index===19?-22:-19,maxZ:15};k.shell(bounds,index===18?14:12);
 const baseWalls=()=>{k.panel('work-left',[-11.75,2.3,8],[1,0,0],11);k.panel('work-right',[11.75,2.3,8],[-1,0,0],11);k.panel('work-front',[0,2.3,14.75],[0,0,-1],23);};
 const closedExit=condition=>{const d=k.door(-12);k.ticks.push(dt=>d.update(condition(),dt,k.time));return d;};
 const latch=(name,p,condition)=>{const art=w.box([p[0],p[1],p[2]],[.6,.2,.7],w.materials.accent,false);const state={engaged:false};k.state[name]=state;k.ticks.push(()=>{if(condition())state.engaged=true;art.rotation.z=state.engaged?-.6:0;});k.resets.push(()=>state.engaged=false);return state;};
 if(index===8){
  baseWalls();const s=k.spring('piston',[0,.0,-5]);k.panel('drop-ceiling',[0,9,-5],[0,-1,0],7,6);k.panel('loading-floor',[-7,.025,6],[0,1,0],5,5);
  // Open-top spring test enclosure. A held body must not turn the new
  // stable grip into an infinite-force hand press. All four visible sides
  // protect the piston; real spring compression retracts the guards so the
  // same friend can be collected. No portal-use flag is involved.
  const guards=[];
  for(const [p,size]of [[[-2.2,1.6,-5],[.1,3.2,4.5]],[[2.2,1.6,-5],[.1,3.2,4.5]],[[0,1.6,-7.25],[4.5,3.2,.1]],[[0,1.6,-2.75],[4.5,3.2,.1]]]){
    const mesh=glass(w,p,size),c=game.colliders.find(c=>c.mesh===mesh);c.kinematic=true;guards.push({mesh,c,base:p[1]});
  }
  k.state.springGuards=guards;
  k.ticks.push(dt=>{for(const a of guards){a.mesh.position.y=THREE.MathUtils.damp(a.mesh.position.y,s.latched?a.base-3.3:a.base,4,dt);game.syncCollision(a.c,new THREE.Box3().setFromObject(a.mesh),dt);}});
  k.resets.push(()=>{for(const a of guards)a.mesh.position.y=a.base;});
  k.control('release',[-5,0,-5],()=>s.reset(),'E — освободить механическую защёлку для нового опыта.');closedExit(()=>s.latched);
  k.wire([[1.6,.06,-5],[4,.06,-5],[4,.06,-11.5],[0,.06,-11.5]],()=>s.latched);
 }else if(index===9){
  baseWalls();w.floor(-12,-4,0,9,3);w.stairs(-11,-8,-6,0,0,3);w.floor(4,10,0,7,3);
  k.panel('loading-dock',[-11.7,5.1,5],[1,0,0],7);k.panel('unloading-dock',[9.7,5.1,3],[-1,0,0],6);
  const cart=k.slider('freight',[-6,3.3,3],[6,3.3,3],{width:3.2,depth:3.2,portal:false,asset:37,assetSize:3.2});cart.rate=.12;
  w.box([0,2.4,3],[15,.25,.24]);for(const z of [1.05,4.95])w.box([1,3.65,z],[9.8,1.3,.18]);
  const hood=glass(w,[3,4.62,3],[10.8,.18,4]),hc=game.colliders.find(c=>c.mesh===hood);hc.kinematic=true;
  const lock=latch('dock-lock',[7.8,3.1,3],()=>cart.progress>.985&&cart.loaded());
  k.control('dispatch',[-7,3,7.2],()=>cart.target=cart.target?0:1,'E — отправить каретку или вернуть на погрузку.');
  k.ticks.push(dt=>{hood.position.z=THREE.MathUtils.damp(hood.position.z,lock.engaged?-3:3,3,dt);game.syncCollision(hc,new THREE.Box3().setFromObject(hood),dt);});k.resets.push(()=>hood.position.z=3);
  closedExit(()=>lock.engaged);
 }else if(index===10){
  baseWalls();k.panel('wind-intake',[11.7,2.1,5],[-1,0,0],10);k.panel('wind-outlet',[0,2.1,-1],[0,0,-1],8);
  const fan=k.fan('blower',[-9.8,2.1,5],[1,0,0]),t=k.turbine('flywheel',[0,2.1,-8]);k.staticFixture(39,[5,0,-8],2.2);
  k.control('fan-switch',[-7,0,10],()=>fan.enabled=!fan.enabled,'E — включить нагнетатель.');k.control('clutch',[6,0,-4],()=>t.clutch=!t.clutch,'E — соединить маховик с подъёмным приводом.');
  k.ticks.unshift(()=>t.power=fan.touch(t.position));const lock=latch('ratchet',[2,1,-9.5],()=>t.wheel.work>70);closedExit(()=>lock.engaged);
  k.wire([[1,1,-8],[5,1,-8],[5,.07,-11.5],[0,.07,-11.5]],()=>t.clutch);
 }else if(index===11){
  // Three radially separated destinations, not a sequence of copied rooms.
  spawn=[-5,0,11];cargo=[8,6.55,0];goal=[0,6,-9];baseWalls();
  w.floor(3.45,11,-3,3,6);w.floor(-3,3,-12,-3.45,6);w.box([0,2.5,0],[4.8,5,4.8]);
  const art=k.fixture(38,[0,0,0],5),rot=new THREE.Group();rot.position.set(0,8.1,0);w.root.add(rot);
  const p=k.panel('carousel',[0,0,3.2],[0,0,1],4.5,4.2,rot,true);p.collider.frontPlane=p.getFrame;let value=0,previous=0;const state={target:0,progress:0};k.state.carousel=state;
  k.control('rotation',[-7,0,6],()=>state.target=(state.target+1)%4,'E — повернуть барабан на четверть оборота. Портал следует за панелью.');
  k.ticks.push(dt=>{previous=value;const target=state.target*Math.PI/2;value+=Math.atan2(Math.sin(target-value),Math.cos(target-value))*(1-Math.exp(-4*dt));state.progress=value;rot.rotation.y=value;art.spin(value,'y');rot.updateWorldMatrix(true,true);p.collider.box.setFromObject(p.mesh);game.physics?.updateStaticBox(p.mesh.uuid,p.collider.box,dt);});
  k.renders.push(a=>rot.rotation.y=THREE.MathUtils.lerp(previous,value,a));k.resets.push(()=>{state.target=value=previous=0;});
  // The outer walls have low ceramic work surfaces, not upper bypass exits.
 }else if(index===12){
  baseWalls();const load=k.pad('weight',[7,0,5],4,4);const lift=k.slider('brake-lift',[-7,0,0],[-7,7,0],{width:4,depth:4,wallSide:true,asset:33,assetSize:3.8});
  w.floor(-9,1,-10,-2,7);goal=[-4,7,-7];
  const brakeDrum=k.staticFixture(39,[-1,7,-5],2);k.ticks.push(()=>brakeDrum.spin(lift.progress*15,'y'));k.control('brake',[-2.5,7,-3.8],()=>lift.locked=!lift.locked,'E — затянуть тормоз лебёдки. Зафиксированная высота не зависит от груза.');
  k.ticks.unshift(()=>lift.target=load.loaded()?1:0);
  // A waist-high working aperture admits shots to the load, but no ladder.
  k.wire([[7,.05,5],[7,.05,0],[-7,.05,0]],()=>load.loaded());
 }else if(index===13){
  baseWalls();cargo=[-5,.55,-3];const claw=k.fixture(36,[-5,1.4,-3],3.8),drum=k.staticFixture(39,[-8,0,-5],2.4);const center=V(-5,1.3,-3),target=center.clone();
  const hood=glass(w,[-5,1.48,-3],[5,.16,5]),hc=game.colliders.find(c=>c.mesh===hood);hc.kinematic=true;
  for(const x of [-7.5,-2.5])w.box([x,.7,-3],[.15,1.4,5]);for(const z of [-5.5,-.5])w.box([-5,.7,z],[5,1.4,.15]);
  const receiver=k.pad('crane-cup',[6,0,-5],3.5,3.5);const state={step:0,attached:false,caught:false};k.state.crane=state;
  k.control('crane-handle',[2,0,5],()=>{state.step=(state.step+1)%5;if(state.step===4)state.attached=false;},'E — захват, подъём, перенос, отпускание. Следи за настоящим грузом.');
  k.ticks.push(dt=>{
   const dest=state.step===0?V(-5,2.8,-3):state.step===1?V(-5,.43,-3):state.step===2?V(-5,5,-3):state.step===3?V(6,5,-5):V(6,1.1,-5);
   target.lerp(dest,1-Math.exp(-1.5*dt));if(state.step===1&&game.cargo&&!game.heldCube&&target.distanceTo(game.cargo.position)<.55){state.attached=true;state.caught=true;}
   claw.art.position.copy(target).add(V(0,.4,0));claw.spin(state.attached?-.25:.25,'x');drum.spin(k.time*(state.step?1:0),'y');
   hood.position.x=THREE.MathUtils.damp(hood.position.x,state.caught?-11:-5,3,dt);game.syncCollision(hc,new THREE.Box3().setFromObject(hood),dt);
  });k.forces.push(()=>{if(!state.attached||game.heldCube||!game.physics)return;const b=game.physics.cargoBody,d=target.clone().sub(game.cargo.position);b.force.x+=b.mass*(d.x*55-b.velocity.x*13);b.force.y+=b.mass*(19.5+d.y*55-b.velocity.y*13);b.force.z+=b.mass*(d.z*55-b.velocity.z*13);b.wakeUp();});
  const lock=latch('cup-lock',[8,0.3,-5],()=>receiver.loaded());closedExit(()=>lock.engaged);
  k.resets.push(()=>{state.step=0;state.attached=state.caught=false;target.copy(center);hood.position.x=-5;});
  // A raised operator balcony requires a portal transfer, with free placement.
  w.floor(-1,5,2,8,3);const handle=k.state['crane-handleControl'];handle.art.position.y+=3;handle.position.y+=3;game.syncCollision(handle.collider,new THREE.Box3().setFromObject(handle.art),0);k.panel('operator',[4.8,5.1,5],[-1,0,0],5);
 }else if(index===14){
  baseWalls();k.panel('wind-intake',[11.7,2.1,8],[-1,0,0],8);k.panel('duct-mouth',[0,2.1,1],[0,0,-1],6);
  const fan=k.fan('blower',[-10,2.1,8],[1,0,0]),t=k.turbine('flywheel',[0,2.1,-9]);t.clutch=true;
  for(const x of [-2,2])glass(w,[x,2,-5.25],[.15,4,6.7]);
  const shutters=[-2,-6].map((z,i)=>{const mesh=glass(w,[0,2,z],[4,4,.14]),c=game.colliders.find(c=>c.mesh===mesh);c.kinematic=true;const s={mesh,c,open:false};k.control('shutter-'+i,[i?5:-5,0,z+1],()=>s.open=!s.open,'E — открыть или закрыть поперечную заслонку. Воздух не проходит через закрытую.');return s;});
  k.state.shutters=shutters;k.control('fan-switch',[-7,0,11],()=>fan.enabled=!fan.enabled,'E — включить подачу воздуха.');
  k.ticks.unshift(()=>t.power=fan.touch(t.position));k.ticks.push(dt=>{for(const s of shutters){s.mesh.position.y=THREE.MathUtils.damp(s.mesh.position.y,s.open?6.5:2,3,dt);game.syncCollision(s.c,new THREE.Box3().setFromObject(s.mesh),dt);}});k.resets.push(()=>{t.clutch=true;for(const s of shutters){s.open=false;s.mesh.position.y=2;}});
  const lock=latch('duct-lock',[3,1,-9],()=>t.wheel.work>45);closedExit(()=>lock.engaged);
 }else if(index===15){
  baseWalls();spawn=[-7,0,10];const bridge=k.slider('drawbridge',[0,-.1,2],[0,5,2],{width:4,depth:9,asset:37,assetSize:5,portal:true});bridge.rate=.13;
  w.floor(-10,10,-10,-3,5);k.panel('bridge-wall',[-9.7,7.1,-6],[1,0,0],7);goal=[5,5,-7];
  // Back-to-back lifting leaves make the interior dock invisible until moved.
  const shield=w.box([0,5,-2.8],[22,10,.24]),sc=game.colliders.find(c=>c.mesh===shield); // world.box registers it.
  const ctrl=k.control('bridge-drive',[-8,0,4],()=>bridge.target=bridge.target?0:1,'E — поднять секцию моста. Подъём освобождает обзор дальней стены.');
  k.ticks.push(dt=>{shield.position.y=THREE.MathUtils.damp(shield.position.y,bridge.progress>.95?16:5,3,dt);game.syncCollision(sc,new THREE.Box3().setFromObject(shield),dt);});k.resets.push(()=>shield.position.y=5);
  // A low guard prevents riding the lifting slab to the high deck. Portal
  // placement, not an invisible use-counter, completes the new connection.
  w.box([0,3.3,-2.95],[24,6.6,.22]);w.box([0,10.2,-2.95],[24,3.6,.22]);
 }else if(index===16){
  // A traversable basin below the route makes every missed boarding recoverable.
  k.panel('basin-return',[-11.75,2.3,-9],[1,0,0],7);spawn=[-9,3,7];cargo=[-8,3.55,6];w.floor(-12,-6,-5,11,3);w.floor(6,12,-6,9,3);goal=[9,3,-4];
  const raft=k.slider('sail',[-7.5,3.25,2],[8,3.25,2],{width:3.5,depth:4,portal:false,asset:37,assetSize:3.3});raft.rate=1;
  const sail=w.box([1.6,2,0],[.15,3,3],w.materials.floor,false,raft.group);const fan=k.fan('blower',[-10,5.1,10],[1,0,0]);
  k.panel('supply',[11.7,5.1,10],[-1,0,0],7);k.panel('rail-air',[-11.7,5.1,2],[1,0,0],7);
  k.control('sail-fan',[-10,3,4.5],()=>fan.enabled=!fan.enabled,'E — поток в парус. Платформа набирает скорость постепенно.');let position=0,velocity=0;
  const motion={recalling:false,velocity:0};k.state.sailPhysics=motion;
  const winch=k.staticFixture(39,[-10.5,3,-1.9],1.45);
  const cable=w.box([-8.8,3.5,2],[2.4,.035,.035],w.materials.trim,false);
  k.control('sail-return',[-10,3,.1],()=>motion.recalling=!motion.recalling,'E — вернуть каретку тросовой лебёдкой. Повторное нажатие освобождает трос.');
  k.ticks.unshift(dt=>{
   const wind=fan.touch(raft.position.clone().add(V(0,2,0)));
   const load=(raft.loaded()?3.2:0)+(game.playerGrounded&&Math.abs(game.playerPosition.y-3.25)<.2&&game.playerPosition.distanceTo(raft.position)<2.5?3.2:0);
   const force=motion.recalling?-10:wind?6:0;
   velocity+=(force/(9+load)-velocity*.15)*dt;
   position=THREE.MathUtils.clamp(position+velocity*dt/15.5,0,1);
   if((position===0&&velocity<0)||(position===1&&velocity>0))velocity=0;
   if(position===0&&motion.recalling)motion.recalling=false;
   raft.target=position;motion.velocity=velocity;
  });
  k.ticks.push(()=>{winch.spin(position*24,'y');cable.position.x=(-10.3+raft.position.x)/2;cable.scale.x=(raft.position.x+10.3)/2.4;});
  k.resets.push(()=>{position=velocity=0;motion.recalling=false;motion.velocity=0;});w.stairs(-11,-8,-12,-5,0,3);
 }else if(index===17){
  baseWalls();const table=k.fixture(38,[0,0,2],4.4);const deck=w.floor(-2.2,2.2,-.2,4.2,2.5);k.panel('feed',[0,4.8,4.1],[0,0,-1],4.2,4.6);
  k.panel('load-floor',[-7,.025,7],[0,1,0],5,5);
  const receiver=k.pad('sort-cup',[0,0,-4.6],3,3);const state={index:0,running:false};k.state.sorter=state;
  k.control('sort-angle',[-5,0,0],()=>state.index=(state.index+1)%4,'E — повернуть роликовый стол. Открытый борт показывает направление.');k.control('sort-motor',[5,0,0],()=>state.running=!state.running,'E — включить ролики. Ошибочная отправка не уничтожает друга.');
  const dirs=[V(1,0,0),V(0,0,-1),V(-1,0,0),V(0,0,1)];let angle=0;k.ticks.push(dt=>{angle=THREE.MathUtils.damp(angle,state.index*Math.PI/2,4,dt);table.spin(angle,'y');});
  k.forces.push(()=>{if(game.heldCube||!state.running)return;const p=game.cargo.position;if(Math.abs(p.x)<2.25&&Math.abs(p.z-2)<2.25&&p.y>2.6&&p.y<3.2){const b=game.physics.cargoBody,d=dirs[state.index];b.force.x+=b.mass*(d.x*8-b.velocity.x)*10;b.force.z+=b.mass*(d.z*8-b.velocity.z)*10;b.wakeUp();}});
  const lock=latch('sort-lock',[2.1,.4,-7],()=>receiver.loaded());closedExit(()=>lock.engaged);k.resets.push(()=>{state.index=0;state.running=false;angle=0;});
  // A covered receiving chute admits rolling cargo but not a standing player
  // or a hand-carried shortcut straight onto the pressure cup. Its access
  // shields physically rise after the cup catches the load, for retrieval.
  const shields=[];
  for(const [p,size] of [[[1.65,2.65,-3.5],[.13,5.3,6.6]],[[-1.65,2.65,-3.5],[.13,5.3,6.6]],[[0,2.65,-6.8],[3.4,5.3,.13]],[[0,5.3,-3.5],[3.4,.13,6.6]]]){
   const mesh=glass(w,p,size),c=game.colliders.find(c=>c.mesh===mesh);c.kinematic=true;shields.push({mesh,c,y:p[1]});
  }
  for(const [y,h]of [[1.075,2.15],[4.75,1.1]]){
   const mesh=glass(w,[0,y,-.28],[3.4,h,.13]),c=game.colliders.find(c=>c.mesh===mesh);c.kinematic=true;shields.push({mesh,c,y});
  }
  k.state.sorterShields=shields;
  k.ticks.push(dt=>{for(const q of shields){q.mesh.position.y=THREE.MathUtils.damp(q.mesh.position.y,lock.engaged?q.y+6:q.y,4,dt);game.syncCollision(q.c,new THREE.Box3().setFromObject(q.mesh),dt);}});
  k.resets.push(()=>{for(const q of shields)q.mesh.position.y=q.y;});
 }else if(index===18){
  baseWalls();const springArt=k.fixture(32,[-3,-.1,-4],3.7,Math.PI/2);
  k.panel('ceiling-drop',[-3,10,-4],[0,-1,0],5,5);k.panel('feed-floor',[-7,.025,7],[0,1,0],5,5);
  const angle=-.20,normal=V(-Math.sin(angle),Math.cos(angle),0);
  const bounce=w.surface({name:'Rubber rebound bed',position:[-3,.55,-4],normal:normal.toArray(),width:5,height:5});
  bounce.group.traverse(o=>{if(o.isInstancedMesh)o.material=new THREE.MeshStandardMaterial({color:0x627b87,roughness:.96});});
  bounce.collider.walkablePlane=true;
  const bed={minX:-5.4,maxX:-.6,minZ:-6.4,maxZ:-1.6,y:.55,mesh:bounce.mesh,enabled:true,heightAt:(x,z)=>.55+Math.tan(angle)*(x+3),normalAt:()=>normal.clone()};game.floors.push(bed);
  const column=k.fixture(33,[-.2,0,-4],2.1),cap=w.box([-2.5,2.0,-4],[1.5,.22,2.2],w.materials.ceramic,false);
  const pawl=w.box([-1.6,2.0,-4],[.35,.24,.7],w.materials.accent,false);let body,owner;const r={latched:false,rise:0,maxAfter:0};k.state.rebound=r;
  function ensure(){if(!game.physics||owner===game.physics)return;owner=game.physics;
   game.physics.removeStaticBox(bounce.mesh.uuid);const item=new Body({mass:0,position:new Vec3(-3,.45,-4),shape:new Box(new Vec3(2.5,.10,2.5)),material:new Material({friction:.02,restitution:.96}),collisionFilterGroup:1,collisionFilterMask:2});item.quaternion.setFromAxisAngle(new Vec3(0,0,1),angle);game.physics.world.addBody(item);
   body=new Body({mass:.2,position:new Vec3(-2.5,2.0,-4),shape:new Box(new Vec3(.75,.11,1.1)),fixedRotation:true,linearFactor:new Vec3(0,1,0),material:new Material({friction:.01,restitution:.02}),collisionFilterGroup:1,collisionFilterMask:2});game.physics.world.addBody(body);
  }
  k.forces.push(()=>{ensure();if(!body)return;r.rise=Math.max(0,body.position.y-2.0);if(r.rise>.12)r.latched=true;
   if(r.latched){body.type=Body.STATIC;body.position.y=2.18;body.velocity.setZero();}else{body.type=Body.DYNAMIC;body.force.y+=.2*19.5-r.rise*45-body.velocity.y*4;if(body.position.y<2.0){body.position.y=2.0;body.velocity.y=Math.max(0,body.velocity.y);}}
  });k.ticks.push(()=>{cap.position.y=body?.position.y||2.0;column.slide(V(0,r.rise*.2,0));pawl.rotation.x=r.latched?.7:0;springArt.slide(V(0,Math.sin(k.time*2)*.004,0));});
  k.resets.push(()=>{ensure();r.latched=false;r.rise=0;if(body){body.type=Body.DYNAMIC;body.position.set(-2.5,2.0,-4);body.velocity.setZero();body.force.setZero();}});
  // The rebound receiver is protected by a real glass-sided test well. A
  // carried friend cannot be waved into the low plunger from outside. The
  // ceiling is open to falling cargo; the shields lift after the pawl catches.
  const shields=[];
  for(const [p,size] of [[[-6.2,2.2,-4],[.15,4.4,6.6]],[[.2,2.2,-4],[.15,4.4,6.6]],[[-3,2.2,-7.3],[6.5,4.4,.15]],[[-3,2.2,-.7],[6.5,4.4,.15]]]){
   const mesh=glass(w,p,size),c=game.colliders.find(c=>c.mesh===mesh);c.kinematic=true;shields.push({mesh,c,y:p[1]});
  }
  k.ticks.push(dt=>{for(const s of shields){s.mesh.position.y=THREE.MathUtils.damp(s.mesh.position.y,r.latched?s.y+5:s.y,4,dt);game.syncCollision(s.c,new THREE.Box3().setFromObject(s.mesh),dt);}});
  k.resets.push(()=>{for(const s of shields)s.mesh.position.y=s.y;});
  closedExit(()=>r.latched);
  k.wire([[-1.6,2,-4],[6,2,-4],[6,.06,-4],[6,.06,-11.5],[0,.06,-11.5]],()=>r.latched);
 }else{
  baseWalls();spawn=[7,0,11];cargo=[-8,.55,8];w.floor(8,11.4,2,7,3);w.stairs(9,11,-5,2,0,3);k.panel('wind-intake',[11.7,2.1,10.5],[-1,0,0],9);k.panel('power-route',[0,2.1,-1],[0,0,-1],7);
  const fan=k.fan('blower',[-10,2.1,10.5],[1,0,0]),t=k.turbine('flywheel',[0,2.1,-8]);const lift=k.slider('foundry-lift',[-7,0,-1],[-7,7,-1],{width:4,depth:5,asset:33,assetSize:3.8,wallSide:true});
  w.floor(-10,3,-11,-3.5,7);const driveDrum=k.staticFixture(39,[0,7,-7],2.2);k.ticks.push(()=>driveDrum.spin(lift.progress*18,'y'));
  k.control('power-switch',[8,0,8],()=>fan.enabled=!fan.enabled,'E — включить нагнетатель.');k.control('drive-clutch',[6,0,-5],()=>t.clutch=!t.clutch,'E — передать энергию маховика подъёмнику.');
  k.control('foundry-brake',[-2,7,-6],()=>lift.locked=!lift.locked,'E — удерживать колонну тормозом, пока портальная пара занята другим рейсом.');
  k.ticks.unshift(()=>{t.power=fan.touch(t.position);lift.target=t.wheel.omega>2?Math.min(1,t.wheel.work/90):0;});
  goal=[1,7,-9];
 }
 const level=k.finish(spawn,cargo,goal);level.workshop=k;return level;
}
