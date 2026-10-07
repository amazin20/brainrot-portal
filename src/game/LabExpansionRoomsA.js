import * as THREE from 'three';
import {ResearchChamber} from './LabResearchArt.js';
import {tracePortalRay,rayTouches,beamDrawing} from './LabPuzzleMechanics.js';
import {lateShutter,movingMechanismBlock} from './LabLateCampaignMechanisms.js';
import {cargoLoadsPlate} from './LabPlateContact.js';

const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
const assets=[1,2,11,22,23,24];
const spec=(id,title,concept,description,accent,hints)=>({id:'expansion-'+id,title,concept,description,accent,assets,hints});
export const EXPANSION_A_SPECS=Object.freeze([
 spec('differential-valves','Разность давлений','Two opposed live air branches share the original removable rigid check-valve body. Signed pressure difference continuously moves a three-berth shuttle; the second branch is physically accessible only from its positive berth, and the same moving address becomes the final traveller transfer.','Два встречных воздушных контура двигают одну каретку. Прибор показывает направление перепада; второй клапанный двор расположен выше стартовой площадки.',0x78d5b3,
 ['Гибкие магистрали связывают каретку с двумя разными клапанными седлами. Свободный корпус уменьшает утечку того контура, которого касается.','Каретка следует разности двух настоящих давлений. Среднее положение и крайние причалы имеют разные пути и обзор.','У верхнего двора второй воздушный адрес обращён вверх. Светлая пассажирская поверхность ездит вместе с кареткой; нижний пол и широкий пандус позволяют восстановить опыт.']),
 spec('faraday-loop','Петля Фарадея','The original free rigid companion repeatedly falls through a spatial portal loop; motion through a contactless magnetic coil creates measured induced current and opposing drag. Accumulated electrical work runs a live actuator before the pair is repurposed for both travellers.','В кольце генератора нет электрических контактов. Приборы показывают движение магнитного сердечника и запас энергии; выход виден в изолированном отсеке.',0xe8be72,
 ['Неподвижный корпус в магнитном кольце не создаёт тока. При движении через поле генератор отнимает часть его механической энергии.','Светлые поверхности расположены друг над другом. Падение может продолжаться через пару порталов; шкала показывает настоящую скорость и наведённый ток.','Потребитель расходует накопленную энергию. Осмотр изолированного отсека доступен через низкое окно, а генератор можно выключить и восстановить тем же корпусом.']),
 spec('centrifugal-governor','Центробежный регулятор','Air torque accelerates a centrifugal governor. Original cargo contact supplies frictional braking; the middle speed band aligns a real sliding sleeve before the downstream pawl holds it.','Подвижные грузы расходятся при разгоне. Проход связан с положением манжеты, а шкала выделяет узкий рабочий диапазон.',0xf09f78,
 ['Без нагрузки воздушный привод раскручивает регулятор слишком сильно. Манжета открывает проход лишь в средней части своего хода.','Спутник на тормозной колодке добавляет настоящее трение. Глубина его контакта меняет сопротивление.','Фиксатор за манжетой удерживает её физическое положение. После него можно выключить поток и вернуть тормозящий корпус.']),
 spec('trimaran','Центр тяжести','A wind-driven ferry must be trimmed by the actual positions of its observer and original loose companion; the moving cargo-height portal routes wind rather than shortcuts a traveller.','На другом берегу ждёт выход. Между причалами — паром, парус и прибор, чувствительный к расположению пассажиров.',0x80cddc,
 ['Белое гнездо на пароме имеет низкий грузовой проём: это адрес ветра, а не проход для человека.','Спутник и пассажир должны находиться по разные стороны палубы. Прибор показывает крен и полезную тягу.','С палубы можно сойти на нижний сервисный пол и вернуться по западному пандусу. Причал справа остаётся выше этого пола.']),
 spec('tuned-damper','Настроенный демпфер','A driven mass-spring inspection bed moves continuously. Original free cargo makes a frictional damper; the stable mechanical bridge opens only when real vibration and live optical power agree.','Пружинное ложе дрожит рядом с проваленным мостом. Частотная шкала и оптический прижим относятся к одному устройству.',0xb7a5e8,
 ['Колебания передаются мосту через тягу. Подвешенный или удерживаемый спутник не касается демпфирующего настила.','На широком ложе свободный корпус добавляет трение. Частотный пульт меняет возбуждение, а не отмечает выполненный этап.','На приёмной стороне есть механическая струбцина. Она удерживает прижим, после чего спутника можно забрать и пройти вдвоём.']),
]);

function finish(k,spawn,cargo,goal,extra,roles,orders){
 const l=k.finishResearch(spawn,cargo,goal,{...extra,expansionA:true,researchChamber:false,foundationChamber:false});
 l.puzzleGeometry={noProgressFlags:true,noCheckpoints:true,recoveryFloor:k.base,footprint:(k.bounds.maxX-k.bounds.minX)*(k.bounds.maxZ-k.bounds.minZ),portalRoles:roles,orders};
 l.getContextLesson=()=>['expansion-a-'+l.index,'ЛКМ / ПКМ · E',k.spec.description,false];
 return l;
}
function air(k,source,normal,targets){
 const e=k.projector(source,normal,{rotating:true,radius:.85}),drawing=beamDrawing(k.world,0xb4e9dc,.045),state={segments:[],powered:targets.map(()=>false)};
 k.ticks.push(()=>{
  state.segments=tracePortalRay(k.game,e.position.clone().addScaledVector(e.normal,.04),e.normal,{length:150,medium:'air'});
  state.powered=targets.map(t=>state.segments.some(s=>s.kind==='portal')&&rayTouches(state.segments,V(...t),.55));drawing.update(state.segments);
 });return state;
}
function light(k,source,normal,target){
 const e=k.projector(source,normal,{radius:.75}),drawing=beamDrawing(k.world,0xf0dc9c,.045),state={segments:[],powered:false};
 k.ticks.push(()=>{state.segments=tracePortalRay(k.game,e.position.clone().addScaledVector(e.normal,.04),e.normal,{length:150});state.powered=state.segments.some(s=>s.kind==='portal')&&rayTouches(state.segments,V(...target),.5);drawing.update(state.segments);});return state;
}
/** Full-roof partitions remain closed at their ends and above each actuator.
 * A closed leaf can neither be jumped nor slipped around its outer frame. */
function partition(k,z,{width=7,height=4.8,name='Manufactured actuator door'}={}){
 const b=k.bounds,base=k.base,top=k.ceiling,x=width/2;
 for(const [a,c]of [[b.minX,-x],[x,b.maxX]])k.block([(a+c)/2,(base+top)/2,z],[c-a,top-base,.72],'shell');
 k.block([0,(height+top)/2,z],[width,top-height,.72],'dark');
 for(const xx of [-x-.18,x+.18]){k.block([xx,height/2,z+.39],[.30,height,.30],'metal',false);k.block([xx,height/2,z+.56],[.045,height-.5,.05],'light',false);}
 const door=lateShutter(k,name,[0,height/2,z],[width,height,.8],[width+1,0,0]);
 // Actual door seam, rollers and tracks move with the actual leaf.
 for(const dx of [-width/2+.3,width/2-.3])k.block([dx,0,.44],[.09,height-.45,.06],'metal',false,door.mesh);
 return door;
}
function seat(k,name,p,{width=8,depth=8,mat='metal'}={}){
 const [x,y,z]=p;
 const mesh=k.block([x,y-.14,z],[width,.28,depth],mat);mesh.name=name;
 const collider=k.envelopes.at(-1),floor={minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2,y,mesh:collider.mesh,enabled:true};k.game.floors.push(floor);
 for(const xx of [-width/2+.20,width/2-.20])k.block([x+xx,y-.38,z],[.28,.48,depth-.4],'secondary');
 const frame=()=>({center:V(x,y,z),normal:V(0,1,0),right:V(1,0,0),up:V(0,0,1),halfWidth:width/2,halfHeight:depth/2});
 const result={mesh,collider,floor,position:V(...p),loaded:()=>cargoLoadsPlate(k.game.cargo,k.game.heldCube,result.frame()),frame,surface:{width,height:depth,getFrame:frame}};
 k.pads.push(result);return result;
}
function pipe(k,points,r=.14){
 for(let i=1;i<points.length;i++){
  const a=V(...points[i-1]),b=V(...points[i]),d=b.clone().sub(a),m=a.clone().add(b).multiplyScalar(.5);
  k.geometry(new THREE.CylinderGeometry(r,r,d.length(),12),'metal',m.toArray(),Q().setFromUnitVectors(V(0,1,0),d.normalize()),{name:'Insulated process pipe'});
  for(const p of [a,b])k.geometry(new THREE.SphereGeometry(r*1.28,8,6),'secondary',p.toArray(),Q(),{name:'Flanged pipe coupling'});
 }
}
function heading(k,n,p,w=25){k.label(`${n} / ${EXPANSION_A_SPECS[n-42].title.toUpperCase()}`,p,[0,0,1],w,1.1);}

/** 42: this actuator has two live opposed chambers, no accumulator isolation
 * and no retaining latch. The original check-valve must change courts; the
 * signed difference continuously changes a real moving passenger address. */
export function buildExpansion42(g,index=41){
 const k=new ResearchChamber(g,EXPANSION_A_SPECS[0],index,'tidal',{minX:-40,maxX:40,minZ:-18,maxZ:42},-4,23);
 k.deck('Central valve loading court',-10,20,6,28,3);
 k.ramp('Central dry recovery',-8,0,28,40,3,-4);
 k.deck('Positive pressure receiving court',26,38,-6,6,3);
 k.ramp('Positive valve court incline',28,36,6,30,3,9.4);
 k.deck('Elevated second valve court',24,38,30,40,9);
 k.deck('Negative pressure departure court',-38,-26,-6,6,3);
 const shuttle=k.carrier('differential-shuttle',[[0,3,-6],[0,3,-6]],{width:18,depth:12,portal:false});shuttle.speed=3.5;shuttle.target=1;
 const frameA=()=>({center:V(shuttle.position.x-2,3,0),normal:V(0,1,0),right:V(1,0,0),up:V(0,0,1),halfWidth:1.5,halfHeight:2});
 const valveA={position:V(-2,3,0),frame:frameA,surface:{width:3,height:4,getFrame:frameA},loaded:()=>cargoLoadsPlate(g.cargo,g.heldCube,frameA())};k.pads.push(valveA);
 k.geometry(new THREE.TorusGeometry(.27,.08,8,24),'rubber',[-2,.035,6],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{parent:shuttle.group,batch:false,name:'Moving branch A valve gasket'});
 for(const x of [-3.5,-.5])k.block([x,.015,6],[.08,.025,4],'metal',false,shuttle.group);
 const valveB=seat(k,'Branch B removable check-valve court',[26.5,9.16,35],{width:3,depth:4});
 k.geometry(new THREE.TorusGeometry(.27,.08,8,24),'rubber',[26.5,9.185,35],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{name:'Fixed branch B valve gasket'});
 shuttle.loaded=()=>valveA.loaded();
 const input=k.panel('shared-air-intake',[6,6.2,18],[1,0,0],4,2.6);input.mesh.userData.portalSize={width:1.4,height:.65};
 const mouthA=k.panel('positive-air-address',[4,3.2,0],[0,0,1],4,2.6,shuttle.group,true);mouthA.mesh.userData.portalSize={width:1.4,height:.65};
 const mouthB=k.loadPad('negative-air-address',[33,9,34],8).surface;
 const passenger=k.panel('moving-passenger-address',[-8.2,2.5,.2],[0,0,1],8,5.8,shuttle.group,true);
 const receiverA=k.projector([4,6.2,3],[0,0,-1],{radius:.6}),receiverCollider=g.colliders.at(-1);receiverCollider.kinematic=true;shuttle.group.attach(receiverA.root);
 const receiverB=k.projector([33,15,34],[0,-1,0],{radius:.6});
 const emitter=k.projector([20,6.2,18],[-1,0,0],{radius:.8,rotating:true}),drawing=beamDrawing(k.world,0xa8e4d5,.045);
 const pressure={left:0,right:0,difference:0,coverA:0,coverB:0,flowA:false,flowB:false};
 const coverage=(s,p)=>s.loaded()?THREE.MathUtils.clamp((.56-Math.abs(g.cargo.position.x-p.x))/.12,0,1)*THREE.MathUtils.clamp((.56-Math.abs(g.cargo.position.z-p.z))/.12,0,1):0;
 k.ticks.unshift(dt=>{
  shuttle.group.updateWorldMatrix(true,true);receiverA.position.copy(receiverA.root.getWorldPosition(V()));
  g.syncCollision(receiverCollider,new THREE.Box3(V(-.84,-.84,-2.1),V(.84,.84,-.4)).applyMatrix4(receiverA.root.matrixWorld),dt);
  const segments=tracePortalRay(g,emitter.position.clone().addScaledVector(emitter.normal,.04),emitter.normal,{length:180,medium:'air'});drawing.update(segments);
  pressure.flowA=segments.some(s=>s.kind==='portal')&&rayTouches(segments,receiverA.position,.55);
  pressure.flowB=segments.some(s=>s.kind==='portal')&&rayTouches(segments,receiverB.position,.55);
  pressure.coverA=coverage(valveA,frameA().center);pressure.coverB=coverage(valveB,valveB.position);
  pressure.left=THREE.MathUtils.clamp(pressure.left+dt*((pressure.flowA?22:0)-(2-1.84*pressure.coverA)*pressure.left),0,100);
  pressure.right=THREE.MathUtils.clamp(pressure.right+dt*((pressure.flowB?22:0)-(2-1.84*pressure.coverB)*pressure.right),0,100);
  pressure.difference=pressure.left-pressure.right;
  // Real seal friction has a 30-kPa breakaway load. With no applied
  // force the carriage has no return spring: it simply stops at its actual
  // position. No saved berth, stage flag or latch is consulted.
  const drive=Math.sign(pressure.difference)*Math.max(0,Math.abs(pressure.difference)-30);
  shuttle.stations[1].x=drive?Math.sign(drive)*20:shuttle.position.x;shuttle.target=1;
  shuttle.speed=Math.min(3.5,Math.abs(drive)*.075);
  valveA.position.copy(frameA().center);
 });
 // Both cylinder rods mirror the signed continuous stroke.
 const rod=movingMechanismBlock(k,'Differential cylinder crosshead',[0,1,-9],[2,.55,.55],'metal');
 k.ticks.push(dt=>{rod.position.x=shuttle.position.x;mouthA.sync(dt);passenger.sync(dt);});
 pipe(k,[[26.5,9.4,35],[24,9.4,35],[24,1,35],[24,1,-9],[-24,1,-9]],.12);
 k.control('differential-vent',[12,3,11],()=>{pressure.left=pressure.right=0;},'E — открыть служебный сброс обоих воздушных контуров.');
 k.resets.push(()=>{Object.assign(pressure,{left:0,right:0,difference:0,coverA:0,coverB:0,flowA:false,flowB:false});shuttle.stations[1].x=0;shuttle.target=1;});
 k.display([0,16,-16.6],()=>`A ${pressure.left.toFixed(0)} кПа / B ${pressure.right.toFixed(0)} кПа\nПЕРЕПАД ${pressure.difference.toFixed(0)} кПа / ХОД ${shuttle.position.x.toFixed(1)} м`,26,2);
 k.label('КЛАПАННЫЙ ДВОР B',[31,12,39],[0,0,-1],12,.65);heading(k,42,[0,20,-16.6]);
 return finish(k,[-3,3,25],[-5,3.6,22],[-32,3,0],{valveA,valveB,input,mouthA,mouthB,passenger,shuttle,pressure,spawnView:{yaw:.12,pitch:-.07}},
 {'shared-air-intake':'cargo-height fan intake supplies a live opposed pneumatic branch','positive-air-address':'follows the shuttle and supplies branch A','negative-air-address':'upward-facing address of elevated court B cannot be reached from start or lower recovery floor','moving-passenger-address':'the signed moving address becomes final transport after physically transferring the same check-valve A to B'},['positive-then-negative','observe-open-branches']);
}

/** 43: the moving original body is the generator core. There are no
 * conducting contacts and no remote bypass: Faraday motion supplies work,
 * Lenz drag removes it from the free body, and the live door consumes it. */
export function buildExpansion43(g,index=42){
 const k=new ResearchChamber(g,EXPANSION_A_SPECS[1],index,'optical',{minX:-28,maxX:28,minZ:-27,maxZ:27},0,23);
 const loopPad=k.loadPad('induction-floor',[-15,0,13],8),floor=loopPad.surface;
 const ceiling=k.panel('induction-return',[-15,14,13],[0,-1,0],8,8);
 const door=partition(k,-1,{name:'Live induction consumer door'});
 const induction={emf:0,current:0,power:0,energy:0,velocity:0,inField:false,passes:0};
 const field=()=>{const b=g.physics?.cargoBody;if(!b||g.heldCube)return null;const p=b.position;
  return Math.hypot(p.x+15,p.z-13)<1.35&&Math.abs(p.y-6)<.85?b:null;};
 // A contactless toroidal coil surrounds a clear free-flight bore. Its
 // housing columns and feet have real collision away from that bore.
 for(const y of [5.2,5.55,5.9,6.25,6.6,6.95])for(let i=0;i<24;i++){
  const q=Q().setFromAxisAngle(V(1,0,0),Math.PI/2).multiply(Q().setFromAxisAngle(V(0,0,1),i*Math.PI/12));
  // Short contact arcs own the visible copper annulus while keeping its
  // central flight bore clear; a whole-torus AABB would falsely seal it.
  k.geometry(new THREE.TorusGeometry(1.35,.12,8,4,Math.PI/12),'metal',[-15,y,13],q,{solid:true,name:'Copper generator winding contact arc'});
 }
 for(const x of [-18.6,-11.4])k.block([x,3.3,13],[.45,6.6,.6],'secondary');
 const inspectionGlass=new THREE.MeshStandardMaterial({name:'Tempered generator inspection glass',color:0xb5dfd5,transparent:true,opacity:.12,roughness:.20,metalness:.05,depthWrite:false});
 const restore=k.restoreLight.bind(k);k.restoreLight=()=>{inspectionGlass.dispose();restore();};
 for(const x of [-16.45,-13.55]){const pane=k.block([x,6.85,13],[.20,7.9,3.1],inspectionGlass);pane.castShadow=false;}
 for(const z of [11.45,14.55]){const pane=k.block([-15,6.85,z],[2.7,7.9,.20],inspectionGlass);pane.castShadow=false;}
 // The solid inspection glass preserves the authored guide bore while the
 // visible copper and moving original core explain the contactless generator.
 for(const x of [-16.45,-13.55])for(const z of [11.45,14.55])k.block([x,6.85,z],[.13,7.9,.13],'metal',false);
 for(const y of [2.9,10.8]){
  for(const x of [-16.45,-13.55])k.block([x,y,13],[.13,.13,3.1],'metal',false);
  for(const z of [11.45,14.55])k.block([-15,y,z],[2.7,.13,.13],'metal',false);
 }
 pipe(k,[[-12.8,6,13],[-8,6,13],[-8,.8,13],[-8,.8,-1],[3,.8,-1]],.085);
 // With coupling 4 V/(m/s) and a 1-ohm load, F=-k²v and P=k²v².
 // The only source is the actual original Cannon body's velocity.
 k.forces.push(()=>{const b=field();if(b){b.force.y-=16*b.velocity.y;b.wakeUp();}});
 let previousInField=false;
 k.ticks.push(dt=>{
  const b=field();induction.inField=!!b;induction.velocity=b?.velocity.y||0;
  induction.emf=b?-4*b.velocity.y:0;induction.current=Math.abs(induction.emf);
  induction.power=induction.current*induction.current;
  induction.energy=THREE.MathUtils.clamp(induction.energy+dt*(induction.power-4-(door.progress>.05?155:0)),0,5600);
  if(induction.inField&&!previousInField&&dt>0)induction.passes++;previousInField=induction.inField;
  door.target=induction.energy>650;door.update(dt);
 });
 k.control('induction-discharge',[10,0,11],()=>{induction.energy=0;},'E — разрядить накопитель генератора.');
 // A sealed bay has a real low inspection window; the full-height player
 // cannot fit it. The same pair must change from generator to transport.
 for(const [a,b]of [[-28,-2],[2,28]])k.block([(a+b)/2,11.5,-14],[b-a,23,.75],'shell');
 k.block([0,1.05,-14],[4,2.1,.75],'dark');k.block([0,13.575,-14],[4,18.85,.75],'shell');
 for(const x of [-2.18,2.18])k.block([x,3.125,-13.56],[.25,2.55,.16],'metal',false);
 k.label('ИЗОЛИРОВАННЫЙ ОТСЕК / ОСМОТР',[-8,5.1,-13.54],[0,0,1],13,.65);
 const entry=k.panel('ground-transfer',[-24,2.5,-10],[1,0,0],8,5.8),upper=k.panel('upper-transfer',[0,4.2,-25.4],[0,0,1],8,5.8);
 k.resets.push(()=>{Object.assign(induction,{emf:0,current:0,power:0,energy:0,velocity:0,inField:false,passes:0});previousInField=false;});
 k.display([0,18,-25.2],()=>`ГЕНЕРАТОР ${induction.current.toFixed(1)} А / ${induction.power.toFixed(0)} Вт\nНАКОПИТЕЛЬ ${induction.energy.toFixed(0)} Дж / СКОРОСТЬ ${induction.velocity.toFixed(1)} м/с`,25,2);
 k.label('БЕСКОНТАКТНЫЙ МАГНИТНЫЙ ГЕНЕРАТОР',[-15,10.1,17.7],[0,0,-1],18,.65);heading(k,43,[0,21,-25.2]);
 return finish(k,[-4,0,23],[-9,.6,20],[10,0,-22],{floor,ceiling,loopPad,door,induction,entry,upper,spawnView:{yaw:.15,pitch:-.06}},
  {'induction-floor':'repeatedly returns a real falling original body','induction-return':'gravity accelerates the same free magnetic core through a contactless generator','ground-transfer':'the pair changes from recurring generator circuit to both-traveller transport','upper-transfer':'sealed laboratory bay visible through a low physical inspection window'},['circulate-then-recover','inspect-empty-field']);
}

/** 44: air torque and contact friction compete continuously. The governor's
 * sleeve follows speed; its pawl stores a real position, not a solved flag. */
export function buildExpansion44(g,index=43){
 const k=new ResearchChamber(g,EXPANSION_A_SPECS[2],index,'kinetic',{minX:-29,maxX:29,minZ:-25,maxZ:27},0,19);
 const brake=seat(k,'Friction shoe platen',[-15,.16,14]);
 const input=k.panel('governor-air-input',[10,3.2,19],[1,0,0],7,5.4),mouth=k.panel('governor-mouth',[-24,3.2,7],[1,0,0],7,5.4);
 const rotor=k.projector([-9,3.2,7],[-1,0,0],{radius:1.4});
 const flow=air(k,[24,3.2,19],[-1,0,0],[[-9,3.2,7]]),door=partition(k,-2,{name:'Centrifugal governor sleeve'});
 const governor={omega:0,angle:0,friction:0,contactDepth:0,sleeve:0,pawl:null};
 const weights=new THREE.Group();weights.position.copy(rotor.position);k.world.root.add(weights);
 for(const x of [-1,1]){k.geometry(new THREE.SphereGeometry(.34,12,8),'metal',[x*.6,0,0],Q(),{parent:weights,batch:false,name:'Moving governor flyweight'});k.block([x*.35,0,0],[.7,.13,.13],'metal',false,weights);}
 pipe(k,[[-15,.5,14],[-15,.5,7],[-9,.5,7]],.11);
 const pawl=movingMechanismBlock(k,'Governor retaining pawl',[7,1.2,-7],[1.2,.28,.35],'metal');
 k.control('governor-pawl',[7,0,-7],()=>{if(governor.pawl!==null)governor.pawl=null;else if(door.progress>.92)governor.pawl=door.progress;},'E — удержать манжету храповиком или освободить её.');
 k.control('governor-service-brake',[10,0,11],()=>{governor.omega=0;governor.pawl=null;},'E — служебный тормоз: остановить регулятор и освободить фиксатор.');
 k.ticks.push(dt=>{
  // The broad brake is a lever shoe: body position sets the real contact
  // pressure. Its shallow ends cannot supply enough friction to avoid
  // overspeed. This makes placement a continuous mechanical choice.
  governor.contactDepth=brake.loaded()?THREE.MathUtils.clamp(1-Math.abs(g.cargo.position.z-14)/3,0,1):0;
  governor.friction=brake.loaded()?1.1+1.8*governor.contactDepth:0;
  governor.omega=Math.max(0,governor.omega+dt*((flow.powered[0]?17:0)-(.9+governor.friction)*governor.omega));governor.angle+=governor.omega*dt;
  governor.sleeve=THREE.MathUtils.clamp(1-Math.abs(governor.omega-4.45)/1.7,0,1);
  door.target=governor.sleeve>.85;
  // The heavy sleeve has a slower physical response than the governor. A
  // fleeting unladen speed-band crossing cannot create a body-wide gap.
  door.progress=governor.pawl===null?THREE.MathUtils.damp(door.progress,door.target?1:0,1.4,dt):governor.pawl;
  door.mesh.position.set((7+1)*door.progress,2.4,-2);door.mesh.updateWorldMatrix(true,false);g.syncCollision(door.collider,new THREE.Box3().setFromObject(door.mesh),dt);
  rotor.rotor.rotation.z=governor.angle;weights.rotation.z=governor.angle;weights.children.forEach((o,i)=>{if(i%2===0)o.position.x=(i===0?-1:1)*(.6+Math.min(1,governor.omega/10)*1.2);});pawl.rotation.y=governor.pawl===null?-.7:0;
 });
 k.resets.push(()=>{governor.omega=governor.angle=governor.friction=governor.contactDepth=governor.sleeve=0;governor.pawl=null;});
 k.display([0,13,-23.7],()=>`РЕГУЛЯТОР ${governor.omega.toFixed(2)} рад/с / ТОРМОЖЕНИЕ ${governor.friction.toFixed(1)}\nМАНЖЕТА ${(governor.sleeve*100).toFixed(0)} % / ХРАПОВИК ${governor.pawl===null?'СВОБОДЕН':'ДЕРЖИТ'}`,25,2);
 k.label('РАБОЧИЙ ДИАПАЗОН / 4–5 рад/с',[-9,6.3,7],[0,0,1],14,.7);heading(k,44,[0,16.8,-23.7]);
 k.label('РЫЧАГ ТОРМОЗНОЙ КОЛОДКИ',[-15,4.3,18.6],[0,0,-1],15,.65);
 return finish(k,[-3,0,23],[-9,.6,20],[0,0,-20],{brake,input,mouth,flow,rotor,door,governor,spawnView:{yaw:.17,pitch:-.06}},
 {'governor-air-input':'fan supplies measurable angular work','governor-mouth':'real torque competes with cargo friction before the sleeve aligns'},['brake-before-air','observe-unladen-overspeed']);
}

/** 45: wind acts on a moving sail only while its output ray actually reaches
 * the sail. The boat is useful only with two separated real load positions. */
export function buildExpansion45(g,index=44){
 const k=new ResearchChamber(g,EXPANSION_A_SPECS[3],index,'current',{minX:-34,maxX:34,minZ:-22,maxZ:32},-4,22);
 k.deck('Western wind loading quay',-32,-18,-14,12,3);
 k.deck('Eastern arrival quay',18,32,-14,12,3);
 k.ramp('Only western dry recovery',-31,-23,12,30,3,-4);
 const boat=k.carrier('trim-ferry',[[-12,3,-6],[12,3,-6]],{width:12,depth:12,portal:false});boat.speed=3.8;
 const mouth=k.panel('moving-wind-address',[-4,3.2,6],[1,0,0],4,2.6,boat.group,true);mouth.mesh.userData.portalSize={width:1.4,height:.65};
 const sail=k.projector([-8,6.2,0],[-1,0,0],{radius:.9}),sailCollider=g.colliders.at(-1);sailCollider.kinematic=true;boat.group.attach(sail.root);
 const input=k.panel('quay-wind-input',[-19,6.2,16],[-1,0,0],7,5.4);
 const emitter=k.projector([-30,6.2,16],[1,0,0],{radius:.9,rotating:true}),drawing=beamDrawing(k.world,0xaddce8,.045);
 const trim={roll:0,torque:0,powered:false,cargoAboard:false,playerAboard:false,traction:0};
 boat.loaded=()=>trim.cargoAboard;
 for(const x of [-5.4,5.4]){k.block([x,-.9,6],[1.0,1.6,11.7],'secondary',false,boat.group);k.block([x,.08,6],[.22,.16,10.8],'metal',false,boat.group);}
 // The vertical mast and two curved frame hoops have closed hardware but
 // leave the central deck and shoulder-camera sight line unobstructed.
 k.block([4.9,3.2,6],[.32,6.4,.32],'metal',false,boat.group);
 k.block([0,6.4,6],[10,.32,.32],'shell',false,boat.group);
 const inclinometer=new THREE.Group();inclinometer.position.set(4.9,4.2,6);boat.group.add(inclinometer);
 k.block([0,-.52,0],[.10,1.04,.10],'metal',false,inclinometer);
 k.geometry(new THREE.SphereGeometry(.23,10,8),'secondary',[0,-1.05,0],Q(),{parent:inclinometer,batch:false,name:'Ferry load-moment pendulum'});
 k.label('ПРАВЫЙ БОРТ',[-10,3.18,2],[0,1,0],4,.65);k.label('ЛЕВЫЙ БОРТ',[-14,3.18,2],[0,1,0],4,.65);
 k.ticks.unshift(dt=>{
  boat.group.updateWorldMatrix(true,true);sail.position.copy(sail.root.getWorldPosition(V()));
  g.syncCollision(sailCollider,new THREE.Box3(V(-1.26,-1.26,-2.1),V(1.26,1.26,-.4)).applyMatrix4(sail.root.matrixWorld),dt);
  const segments=tracePortalRay(g,emitter.position.clone().addScaledVector(emitter.normal,.04),emitter.normal,{length:150,medium:'air'});drawing.update(segments);
  const f=boat.floor,p=g.playerPosition,c=g.cargo.position,inside=q=>q.x>f.minX+.2&&q.x<f.maxX-.2&&q.z>f.minZ+.2&&q.z<f.maxZ-.2;
  trim.cargoAboard=!g.heldCube&&inside(c)&&Math.abs(c.y-.39-f.y)<.22;
  trim.playerAboard=g.playerGrounded&&inside(p)&&Math.abs(p.y-f.y)<.22;
  trim.torque=(trim.cargoAboard?(c.x-boat.position.x)*40:0)+(trim.playerAboard?(p.x-boat.position.x)*40:0);
  trim.roll=THREE.MathUtils.damp(trim.roll,trim.torque/160,5,dt);
  inclinometer.rotation.z=THREE.MathUtils.clamp(trim.roll,-.7,.7);
  trim.powered=segments.some(s=>s.kind==='portal')&&rayTouches(segments,sail.position,.65);
  trim.traction=trim.powered&&trim.cargoAboard&&trim.playerAboard?THREE.MathUtils.clamp(1-Math.abs(trim.roll)*3,0,1):0;
  boat.braked=trim.traction<.75;boat.speed=3.8*trim.traction;boat.target=1;
  // Visible pendulum is attached to the deck; the deck remains level enough
  // to serve as a broad movement/cargo collider in every quality profile.
 });
 k.resets.push(()=>{trim.roll=trim.torque=trim.traction=0;trim.powered=trim.cargoAboard=trim.playerAboard=false;boat.target=0;boat.braked=true;});
 k.display([0,15,-20.7],()=>`КРЕН ${(trim.roll*20).toFixed(1)}° / ТЯГА ${(trim.traction*100).toFixed(0)} %\nСПУТНИК ${trim.cargoAboard?'НА ПАЛУБЕ':'ВНЕ ПАЛУБЫ'} / ВЕТЕР ${trim.powered?'В ПАРУСЕ':'ПРОХОДИТ МИМО'}`,26,2);
 heading(k,45,[0,19,-20.7]);
 return finish(k,[-26,3,7],[-27,3.6,4],[25,3,-7],{boat,mouth,input,sail,trim,spawnView:{yaw:-.55,pitch:-.07}},
 {'quay-wind-input':'intercepts quay wind','moving-wind-address':'cargo-height moving outlet follows the trimmed ferry and always points at its sail'},['counterweight-then-wind','observe-unbalanced-thrust']);
}

/** 46: the original body supplies dry-friction damping on a continuously
 * moving bed. A spring model and its measured velocity drive the crossing. */
export function buildExpansion46(g,index=45){
 const k=new ResearchChamber(g,EXPANSION_A_SPECS[4],index,'gravity',{minX:-31,maxX:31,minZ:-25,maxZ:29},-4,24);
 k.deck('Western tuning gallery',-29,-8,-21,11,4);
 k.deck('Eastern receiver gallery',8,29,-21,11,4);
 k.ramp('Western return and tuning approach',-28,-20,11,27,4,-4);
 const bed=seat(k,'Driven damping bed',[-18,4.16,4],{width:8,depth:8});
 const input=k.panel('damper-light-input',[-15,7.2,18],[-1,0,0],7,5.4),mouth=k.panel('magnetic-clamp-mouth',[-26,7.2,-15],[1,0,0],8,5.4);
 const target=[15,7.2,-15];k.projector(target,[-1,0,0],{radius:.65});
 const optical=light(k,[-28,7.2,18],[1,0,0],target);
 const bridge=k.carrier('vibration-linked-crossing',[[0,-4,-17],[0,4,-17]],{width:16,depth:12,portal:false});bridge.speed=7;
 const oscillator={x:.48,v:0,frequency:5.2,phase:0,rms:2.4,loaded:false,clamped:false,clampY:-4};
 const base=bed.position.y,origin=bed.mesh.position.clone();
 const dial=movingMechanismBlock(k,'Excitation frequency dial',[-10,5.2,7],[.12,.9,.9],'metal');
 k.control('damper-frequency',[-10,4,7],()=>{oscillator.frequency=oscillator.frequency>4?.75:5.2;},'E — изменить частоту возбуждения: 5.2 или 0.75 рад/с.');
 k.control('damper-receiver-clamp',[18,4,-17],()=>{if(oscillator.clamped)oscillator.clamped=false;else if(bridge.position.y>3.98) {oscillator.clamped=true;oscillator.clampY=bridge.position.y;}},'E — удержать поднятый мост струбциной или освободить прижим.');
 k.ticks.unshift(dt=>{
  oscillator.loaded=bed.loaded();oscillator.phase+=oscillator.frequency*dt;
  const damping=oscillator.loaded?8:1.0,forcing=Math.sin(oscillator.phase)*16;
  oscillator.v+=dt*(forcing-oscillator.x*26-damping*oscillator.v);oscillator.x=THREE.MathUtils.clamp(oscillator.x+oscillator.v*dt,-.55,.55);
  oscillator.rms=THREE.MathUtils.damp(oscillator.rms,Math.abs(oscillator.v),2.5,dt);
  const oldY=bed.floor.y,yy=base+oscillator.x*.15,dy=yy-oldY,p=g.playerPosition;
  if(g.playerGrounded&&Math.abs(p.y-oldY)<.18&&p.x>bed.floor.minX&&p.x<bed.floor.maxX&&p.z>bed.floor.minZ&&p.z<bed.floor.maxZ){p.y+=dy;g.previousPlayerPosition.y+=dy;}
  bed.mesh.position.copy(origin);bed.mesh.position.y+=yy-base;bed.floor.y=yy;bed.position.y=yy;
  g.syncCollision(bed.collider,new THREE.Box3().setFromObject(bed.mesh),dt);
  // Cargo contact belongs to the current top, not the original bed's height.
  bed.frame=()=>({center:V(-18,yy,4),normal:V(0,1,0),right:V(1,0,0),up:V(0,0,1),halfWidth:4,halfHeight:4});
  bridge.stations[1].y=oscillator.clamped?oscillator.clampY:optical.powered&&oscillator.loaded&&oscillator.rms<.55?4:-4;bridge.target=1;
  dial.rotation.x=(oscillator.frequency-.75)*.32;
 });
 // Rebind contact to the live top, preserving body-grounding checks.
 bed.loaded=()=>cargoLoadsPlate(g.cargo,g.heldCube,bed.frame());
 for(const x of [-21.3,-14.7])for(const z of [.7,7.3]){
  k.geometry(new THREE.CylinderGeometry(.22,.22,2.8,12),'metal',[x,2.55,z],Q(),{name:'Guided damper piston'});
  for(let i=0;i<6;i++)k.geometry(new THREE.TorusGeometry(.34,.075,6,16),'metal',[x,1.2+i*.36,z],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{name:'Visible suspension coil'});
 }
 k.resets.push(()=>{oscillator.x=.48;oscillator.v=oscillator.phase=0;oscillator.frequency=5.2;oscillator.rms=2.4;oscillator.loaded=oscillator.clamped=false;oscillator.clampY=-4;bed.mesh.position.copy(origin);bed.floor.y=base;bed.position.y=base;bridge.stations[1].y=-4;});
 k.display([0,16,-23.7],()=>`ЧАСТОТА ${oscillator.frequency.toFixed(1)} / КОЛЕБАНИЯ ${oscillator.rms.toFixed(2)} м/с\nПРИЖИМ ${oscillator.clamped?'ЗАЖАТ':'СВОБОДЕН'} / СВЕТ ${optical.powered?'В ПРИЁМНИКЕ':'НЕ ПОДКЛЮЧЁН'}`,26,2);
 heading(k,46,[0,21,-23.7]);
 return finish(k,[-24,4,8],[-24,4.6,5],[22,4,-15],{bed,input,mouth,optical,bridge,oscillator,spawnView:{yaw:.4,pitch:-.07}},
 {'damper-light-input':'supplies the live optical clamp','magnetic-clamp-mouth':'powers a bridge that remains unstable without genuine free-body bed friction'},['damp-before-light','light-before-damp']);
}

export const EXPANSION_A_BUILDERS=Object.freeze([buildExpansion42,buildExpansion43,buildExpansion44,buildExpansion45,buildExpansion46]);
