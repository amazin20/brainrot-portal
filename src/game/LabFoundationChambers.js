import * as THREE from 'three';
import {ResearchChamber} from './LabResearchArt.js';
import {labInstrument} from './LabHumanLab.js';
import {createLightBridge} from './LabLightBridge.js';
import {StoredMotionDrive} from './LabResearchChambers.js';
import {tracePortalRay,rayTouches,beamDrawing} from './LabPuzzleMechanics.js';
const V=(...p)=>new THREE.Vector3(...p);
const spec=(id,title,concept,description,accent,hints,assets=[1,2,11,22])=>({id:'foundation-'+id,title,concept,description,accent,assets,hints});
export const FOUNDATION_SPECS=Object.freeze([
 spec('first-connection','По ту сторону','One visible height difference teaches a linked pair and bringing a companion.','Выход близко, но этаж выше. Светлая керамика соединяет разные места.',0x64cec2,
 ['Светлая плита над галереей находится на другом этаже.','Создай пару: один портал рядом с собой, другой — над галереей.','Возьми друга клавишей E и пройди через связь. На руках стрелять нельзя — друга можно поставить обратно.']),
 spec('solid-light','Свет под ногами','The portal carries a useful surface, not only the traveller.','Проектор светит в керамику. Найди способ продолжить его дорогу.',0x70d9e4,
 ['Посмотри, куда упирается свет от проектора.','Вход перехватывает свет, а выход задаёт направление моста.','Можно идти прямо или использовать твёрдый служебный остров, чтобы переставить мост. Снизу есть пандус.'],[1,2,11]),
 spec('moving-address','Адрес в движении','An aperture keeps the moving surface; riding and returning to the entrance are both legitimate.','Служебная кабина ходит между галереями. Её портал — такой же пассажир.',0xefbd75,
 ['Портал в кабине перемещается вместе с ней.','Кабиной управляют пульт на её настиле и пульт на левой галерее.','Можно ехать вместе с другом, отправить его одного с боковой галереи или послать пустую кабину. Нижний вход всегда ведёт в её новое положение.']),
 spec('earned-momentum','Цена высоты','Discover the difference between entering a portal and entering with falling speed.','Высота падения превращается в полёт. Низкий этаж не наказывает за пробу.',0xdd8376,
 ['Наклонный щит меняет направление скорости, но сам не разгоняет.','Сравни шаг в напольный портал и падение в него с верхней площадки.','Пандус ведёт к высоте для перелёта. Перед падением подготовь оба портала и возьми друга.'],[1,2,11]),
 spec('borrowed-power','Одной парой','The same two apertures must serve air, retained motion and a projected path in different orders.','Воздух, маховик и свет делят одну пару порталов. Ищи то, что сохраняется после разрыва связи.',0xddb271,
 ['Воздух должен попасть в лицевую решётку маховика. Кабина движется под весом.','Маховик ещё вращается без подачи, а червячный привод удерживает высоту.','Освободив пару, перенаправь свет через разрыв. Можно сначала подняться, а можно заранее подготовить мост и использовать запас вращения.']),
]);

function finish(k,spawn,cargo,goal,extra,learning){
 const l=k.finishResearch(spawn,cargo,goal,{...extra,foundationChamber:true});
 l.contextHandlesCarry=true;l.researchChamber=false;l.learning=learning;
 l.puzzleGeometry={noProgressFlags:true,footprint:(k.bounds.maxX-k.bounds.minX)*(k.bounds.maxZ-k.bounds.minZ),goalHeight:goal[1],
  recoveryFloor:k.base,orders:learning.routes,portalRoles:Object.fromEntries(Object.keys(k.panels).map(n=>[n,learning.roles[n]]))};
 l.getContextLesson=()=>lesson(k.game,l);return l;
}
function lesson(g,l){
 const seen=g.tutorial.seen,n=l.index,near=g.playerPosition.distanceTo(g.cargo.position)<4;
 if(n===0&&!seen.has('foundation-move'))return ['foundation-move',globalThis.matchMedia?.('(pointer:coarse)')?.matches?'◉':'W A S D','Осмотрись и пройди несколько шагов. Выход и белые плиты можно увидеть с пола.',g.playerPosition.distanceTo(V(...l.spawn))>1.5];
 if(!g.heldCube&&near&&!seen.has('foundation-carry'))return ['foundation-carry','E','Это твой спутник. E — взять или поставить. Перед выстрелом поставь его на твёрдую площадку.',Boolean(g.heldCube)];
 if(g.heldCube){seen.add('foundation-carry');return ['foundation-carrying','E',n===0?'Друг у тебя. Через связанную пару можно пройти вместе. E — поставить.':'Друг у тебя. Перед работой с пушкой или пультом поставь его на постоянный настил.',false];}
 if(n===0){
  if(!g.portals.ready)return ['foundation-pair','ЛКМ · ПКМ','Две кнопки создают два конца одной связи. Светлая керамика принимает портал; окрашенный корпус — нет.',false];
  if(g.teleportCount===0)return ['foundation-cross','↔','Посмотри сквозь портал: там другой этаж. Связь работает в обе стороны — можно вернуться за другом.',false];
  if(!near&&l.cargoHoist?.target===1&&g.cargo.position.y>1)return l.cargoHoist.at(1)
   ?['foundation-collect','E','Друг поднялся на платформе. Подойди к нему и возьми E.',false]
   :['foundation-hoist-moving','↗','Платформа поднимает друга. Дождись её на верхнем этаже.',false];
  const action=l.nearbyInteraction?.();
  if(action&&l.cargoHoist?.target===0)return [action.kind,'E',action.text,false];
  if(!near&&g.cargo.position.y<2)return ['foundation-reunite','↔','Друг остался внизу. Вернись через портал или подними его грузовой платформой.',false];
  return null;
 }
 const messages=[null,['СВЕТ','Свет проходит через порталы и держит вес. Разрыв связи убирает мост, но не твёрдые площадки.'],['E','Кабина управляется пультом. При смене причала портал остаётся на её панели. Не нужно торопиться.'],['ПАДЕНИЕ','Портал сохраняет скорость. Направление задаёт наклон щита, а разгон даёт высота падения.'],['НАБЛЮДАЙ','Кабина поднимается под весом. Маховик сохраняет вращение, а привод — высоту. Свет и воздух используют ту же пару.']];
 const m=messages[n];return ['foundation-rule-'+n,m[0],m[1],false];
}
function title(k,n,p,w=15){k.label(`${String(n+1).padStart(2,'0')} / ${FOUNDATION_SPECS[n].title.toUpperCase()}`,p,[0,0,1],w,1.15);}
function addLight(k,origin,direction){
 const b=createLightBridge(k,{origin,direction,span:[0,0,1],width:4.8,length:95,name:'Physical projected walkway'});
 return b;
}
function ownLight(l,light){const dispose=l.dispose;l.dispose=()=>{light.dispose();dispose();};}
function flowMotor(k,{fanAt,sourceAt,receiverAt,wheelAt,cabin}){
 const g=k.game,drive=new StoredMotionDrive();
 k.panel('air-source',sourceAt,[0,0,1]);k.panel('air-receiver',receiverAt,[0,0,1]);
 const fan=k.projector(fanAt,[0,0,-1],{rotating:true,radius:1.05}),wheel=k.projector(wheelAt,[0,0,-1],{radius:1.45});
 const beam=beamDrawing(k.world,0xb5e6eb,.06);
 k.ticks.unshift(dt=>{
  const segments=tracePortalRay(g,fan.position.clone().addScaledVector(fan.normal,.04),fan.normal,{length:110,medium:'air'});
  const powered=segments.some(s=>s.direction.dot(wheel.normal)<-.9&&rayTouches([s],wheel.position,.75));
  const f=cabin.floor,aboard=p=>p&&p.x>f.minX+.1&&p.x<f.maxX-.1&&p.z>f.minZ+.1&&p.z<f.maxZ-.1&&Math.abs(p.y-f.y)<.75;
  drive.step(dt,powered,(g.playerGrounded&&aboard(g.playerPosition))||(!g.heldCube&&aboard(g.cargo?.position)));
  cabin.stations[1].y=drive.heights[0];cabin.target=1;beam.update(segments);
 });
 k.renders.push(()=>{wheel.rotor.rotation.z=drive.wheel.angle;});
 k.resets.push(()=>{drive.reset();cabin.stations[0].y=cabin.stations[1].y=0;cabin.reset();});
 return drive;
}

/** The opening room is a two-storey transfer bay, not another anonymous tile
 * corridor. These are non-colliding cladding pieces attached to existing
 * walls, deck chassis and the actual freight platform. The three porcelain
 * targets, the open floor and both approaches to the gallery remain clear. */
function dressFirstConnection(k,hoist){
 // The standard recovery deck is rendered with a graphite top in every
 // chamber. Here it covers the entire opening floor, and it is coplanar with
 // the parked hoist. Replace only this room's visible top with a mineral deck
 // whose four pieces stop at the moving platform's actual 12 x 12 footprint.
 // Keep the original full-sized collision deck: the lower level stays solid
 // beneath the hoist even while it is upstairs.
 const service=k.world.root.getObjectByName('Continuous service and recovery floor');
 const bin=k.artBins.get(service?.material),index=bin?.indexOf(service)??-1;
 if(index<0)throw new Error('Opening room is missing its physical service floor');
 bin.splice(index,1);service.removeFromParent();service.geometry.dispose();
 const inset=.075;
 const slabs=[
  [-17,1-inset,-17,17], [13+inset,17,-17,17],
  [1-inset,13+inset,-17,2-inset], [1-inset,13+inset,14+inset,17],
 ];
 for(const [x0,x1,z0,z1]of slabs)k.block([(x0+x1)/2,-.30,(z0+z1)/2],[x1-x0,.60,z1-z0],'floor',false,k.world.root,.035);
 const dock=k.block([7,-.30,8],[12,.60,12],'floor',false,k.world.root,.035);
 const dockBin=k.artBins.get(dock.material),dockIndex=dockBin.indexOf(dock);
 dockBin.splice(dockIndex,1);dock.visible=false;
 k.renders.push(()=>{dock.visible=hoist.group.position.y>.12;});
 k.resets.push(()=>{dock.visible=false;});

 // A single warm arrival gate fills the rear wall behind the higher portal.
 // Its shallow backing sits behind the working porcelain at z=-16.25, while
 // the title mounts in front of the backing, above the portal's upper edge.
 k.block([0,8.1,-16.65],[20,9.1,.35],'dark',false);
 for(const x of [-10.1,10.1]){
  k.block([x,8.1,-16.38],[1.2,9.1,.46],'secondary',false);
  k.block([x,8.1,-16.08],[.13,7.2,.065],'light',false);
 }
 k.block([0,12.47,-16.38],[21.2,.85,.47],'secondary',false);
 k.block([0,12.02,-16.07],[15.5,.095,.08],'light',false);

 // The upper gallery is carried by a deep enamel fascia at its existing front
 // lip; the clear space underneath stays the same height and remains open.
 k.block([0,2.94,-5.49],[30.8,.96,.28],'secondary',false);
 k.block([0,3.54,-5.38],[30.8,.16,.34],'metal',false);
 for(const x of [-14.3,14.3]){
  k.block([x,2.94,-5.32],[.86,.83,.12],'dark',false);
  k.block([x,2.94,-5.22],[.13,.61,.075],'light',false);
 }
 k.block([0,2.94,-5.31],[7.5,.26,.075],'light',false);

 // Overhead side rails identify the two equivalent lower portal bays. They
 // are above the porcelain sheets, set back toward the existing side walls.
 for(const x of [-16.86,16.86]){
  k.block([x,7.2,6],[.22,.96,11.2],'secondary',false);
  k.block([x>0?x-.14:x+.14,6.56,6],[.055,.08,10.0],'light',false);
 }

 // The contrasting sill belongs to the original moving freight deck, so the
 // visible colour travels with the platform and never indicates a new route.
 k.block([0,-.42,.02],[11.35,.62,.23],'secondary',false,hoist.group,.04);
}

export function buildFoundation1(g,index=0){
 const k=new ResearchChamber(g,FOUNDATION_SPECS[0],index,'orbital',{minX:-18,maxX:18,minZ:-18,maxZ:18},0,14);
 k.deck('Upper observation and exit gallery',-16,16,-16,-6,4);
 // The side freight platform lets a curious player bring the original friend
 // upstairs after scouting alone. Its dispatch console is reachable only from
 // the upper gallery, so the paired portals remain essential to both routes.
 k.deck('Upper freight landing',1,13,-6,2,4);
 const hoist=k.carrier('companion-hoist',[[7,0,2],[7,4,2]],{width:12,depth:12,portal:false});
 hoist.speed=2.5;
 k.control('freight-dispatch',[11,4,-12],()=>{hoist.target=1;},'E — поднять служебную платформу. Груз можно подготовить до перехода через портал.');
 k.panel('near-left',[-16.4,2.5,6],[1,0,0],8,5.2);
 k.panel('near-right',[16.4,2.5,6],[-1,0,0],8,5.2);
 k.panel('upper-view',[0,6.5,-16.25],[0,0,1],8,5.2);
 dressFirstConnection(k,hoist);
 // The under-gallery is a real reachable room, not empty space behind a wall.
 k.label('ГАЛЕРЕЯ / +4 м',[10,5,-5.83],[0,0,1],7,.65);
 k.label('КЕРАМИКА = ПОРТАЛ',[-17.16,6.3,6],[1,0,0],9,.65);
 title(k,0,[0,11,-16.18],20);
 const l=finish(k,[0,0,12],[-4,.6,9],[7,4,-11],{spawnView:{yaw:0,pitch:-.08},cargoHoist:hoist},
  {introduces:['linked pair','carry'],routes:['carry-through-pair','stage-freight-then-dispatch'],roles:{'near-left':'reachable left entry','near-right':'equivalent right entry, not a wrong answer','upper-view':'higher connected gallery'}});
 return l;
}
export function buildFoundation2(g,index=1){
 const k=new ResearchChamber(g,FOUNDATION_SPECS[1],index,'current',{minX:-27,maxX:24,minZ:-20,maxZ:20},-3,17);
 k.deck('Projector observation deck',-22,-10,2,18,3);
 k.deck('Service-side bridge approach',-14,-6,-12,-4,3);
 k.deck('Service-side link',-10,-2,-4,4,3);
 k.deck('Receiving laboratory deck',4,22,2,14,3);
 // This permanent island supports both travellers while they repurpose the
 // same projected bridge. The direct projected crossing stays a valid route.
 k.deck('Solid bridge-switching island',4,12,-13,-5,3);
 k.ramp('Dry lower return',-22,-14,-12,2,-3,3);
 k.panel('light-source',[-3,3.75,-14],[-1,0,0],8,4.82);
 k.panel('light-exit',[-25.4,3.75,8],[1,0,0],8,4.82);
 k.panel('service-exit',[-25.4,3.75,-9],[1,0,0],8,4.82);
 k.panel('island-turn',[8,3.75,-14.3],[0,0,1],8,4.82);
 k.support(8,-14.3,1.5,.65);
 k.projector([-12,3.20,-14],[1,0,0],{radius:.8});k.support(-13,-14,2.3,.5);
 k.block([-7,.8,-14],[10,.6,2.4],'dark');
 for(const z of [-18.3,-9.7])k.support(-2.6,z,2,.35);
 const light=addLight(k,[-11.98,3.20,-14],[1,0,0]);
 k.display([7,11,-19.25],()=>light.segments.length>1?'ПРОЕКЦИЯ СОЕДИНЕНА':'СВЕТ ОСТАНАВЛИВАЕТСЯ НА КЕРАМИКЕ',20,1.35);
 k.label('СЛУЖЕБНЫЙ ВОЗВРАТ',[-13.2,-.7,-12],[1,0,0],10,.65);title(k,1,[0,14,-19.25],22);
 const l=finish(k,[-16,3,15],[-19,3.6,13],[16,3,8],{light,spawnView:{yaw:.4,pitch:-.07}},
  {introduces:['light as support'],routes:['direct-light-crossing','island-switching'],roles:{'light-source':'intercept the projector','light-exit':'direct projection across the main gap','service-exit':'project to the permanent island','island-turn':'turn the same projection from the island toward the exit'}});ownLight(l,light);return l;
}
function cabinConsole(k,c,local){
 const at=c.position.clone().add(V(...local));const t=k.control('cabin-destination',at.toArray(),()=>{c.target=1-c.target;},'E — другой причал. Портал и пассажиры едут вместе.');
 c.group.attach(t.art);t.collider.kinematic=true;
 const sync=dt=>{c.group.updateWorldMatrix(true,true);t.position.copy(c.position).add(V(...local)).y+=.8;k.game.syncCollision(t.collider,new THREE.Box3().setFromObject(t.art),dt);};
 k.ticks.push(sync);k.resets.push(()=>sync(0));return t;
}
export function buildFoundation3(g,index=2){
 const k=new ResearchChamber(g,FOUNDATION_SPECS[2],index,'optical',{minX:-29,maxX:29,minZ:-24,maxZ:22},-3,24);
 k.deck('Lower dispatch',-27,-9,6,20,0);
 k.ramp('Dispatch return',-23,-15,-6,6,-3,0);
 k.deck('Left control gallery',-27,-5,-22,-10,6);
 k.deck('Right receiving gallery',5,27,-22,-10,10);
 const c=k.carrier('travelling-address',[[-16,6,-10],[16,10,-10]],{width:20,depth:12});c.speed=4;c.panel.group.position.z=6;c.panel.sync(0);
 // Four closed uprights and a travelling head frame carry the corner loads
 // into the overhead trolleys. The side guards are part of the same moving
 // collision volume; the open middle keeps the portal and both exits usable.
 const carStructure=[];
 const carPart=(p,size,finish)=>{
  const mesh=k.block(p,size,finish,false,c.group);
  c.group.updateWorldMatrix(true,true);
  const collider=g.collisionProxy(new THREE.Box3().setFromObject(mesh),{kinematic:true});
  carStructure.push({mesh,collider});return mesh;
 };
 for(const x of [-9.25,9.25]){
  for(const z of [2,10])carPart([x,3,z],[.65,6,.65],'shell');
  carPart([x,6.18,6],[.70,.70,8.7],'dark');
  carPart([x,1.22,6],[.42,2.05,7.1],'dark');
 }
 for(const z of [2,10])carPart([0,6.18,z],[18.8,.70,.72],'shell');
 const syncCarStructure=dt=>{
  c.group.updateWorldMatrix(true,true);
  for(const part of carStructure)g.syncCollision(part.collider,new THREE.Box3().setFromObject(part.mesh),dt);
 };
 k.ticks.push(syncCarStructure);k.resets.push(()=>syncCarStructure(0));
 // The car carries its own continuous edge markings; the fixed docks use a
 // different livery. Their alignment tells the player which surface moves.
 for(const x of [-8.8,8.8])k.block([x,.035,6],[.16,.035,10.4],'light',false,c.group,.012);
 for(const z of [1.1,10.9])k.block([0,.035,z],[17.4,.035,.16],'light',false,c.group,.012);
 k.panel('dispatch-entry',[-27.4,2.5,12],[1,0,0]);
 const t=cabinConsole(k,c,[3,0,10]);
 k.control('gallery-destination',[-21,6,-17],()=>{c.target=1-c.target;},'E — отправить кабину. Можно оставить на ней свободного друга, а самому вернуться к нижнему порталу.');
 // Two broad inlaid loading tracks frame the real floor approach from the
 // lower portal to the cab. They break up the empty foreground in the opening
 // camera without suggesting a second walkable surface or adding draw calls.
 for(const x of [-22,-10])k.block([x,.035,16.2],[.55,.035,10.8],'secondary',false);
 k.block([-16,.035,20.7],[12.5,.035,.55],'secondary',false);
 // Painted paths live a few centimetres above the real decks. They are
 // surface markings, never collision proxies or phantom stepping stones.
 for(const z of [11.35,12.65])k.block([-20,.035,z],[13,.035,.38],'secondary',false);
 for(const [x,y] of [[-16,6],[16,10]]){
  k.block([x,y+.04,-19],[8,.035,.12],'light',false);
  k.block([x,y+4,-23.26],[11,.50,.18],'secondary');
  k.block([x,y+3.55,-23.13],[9,.10,.12],'light',false);
 }
 k.label('01 / ОТПРАВКА',[-16,10.7,-23.1],[0,0,1],9,.70);
 k.label('02 / ПРИЁМ', [16,14.7,-23.1],[0,0,1],9,.70);
 k.label('ВХОД В КАБИНУ',[-26.9,6.5,12],[1,0,0],8,.62);
 // Rails are overhead real structures, not platforms across the flight lane.
 for(const z of [-8,0]){k.block([0,17,z],[54,.8,.7],'dark');for(const x of [-27,27])k.support(x,z,17,.5);}
 // Four driven hangers connect the actual cabin to the travelling hoists.
 const hangers=[];
 for(const dx of [-9.4,9.4])for(const z of [-8,0]){
  const mesh=k.geometry(new THREE.CylinderGeometry(.16,.16,1,10),'metal',[0,0,0],new THREE.Quaternion(),{batch:false,name:'Tensioned carriage suspension'});
  const trolley=k.block([0,17.55,z],[1.4,.5,1.1],'shell',false);
  const bin=k.artBins.get(trolley.material);bin.splice(bin.indexOf(trolley),1);
  const wheel=k.geometry(new THREE.CylinderGeometry(.48,.48,.20,14),'metal',[0,17.55,z+.60],new THREE.Quaternion().setFromAxisAngle(V(1,0,0),Math.PI/2),{batch:false,name:'Carriage rail roller'});
  const collider=g.collisionProxy(new THREE.Box3().setFromObject(mesh),{kinematic:true});
  hangers.push({mesh,trolley,wheel,collider,dx,z});
 }
 const syncHangers=(position,dt,physical)=>{for(const h of hangers){const low=position.y+6.2,high=16.65;h.mesh.scale.y=Math.max(.2,high-low);h.mesh.position.set(position.x+h.dx,(high+low)/2,h.z);h.trolley.position.x=h.wheel.position.x=position.x+h.dx;h.wheel.rotation.z=position.x*.25;h.mesh.updateMatrixWorld(true);if(physical)g.syncCollision(h.collider,new THREE.Box3().setFromObject(h.mesh),dt);}};
 k.ticks.push(dt=>syncHangers(c.position,dt,true));k.renders.push(()=>syncHangers(c.group.position,0,false));k.resets.push(()=>syncHangers(c.position,0,true));syncHangers(c.position,0,true);
 const looseCargoAboard=()=>{const p=g.cargo?.position,f=c.floor;return p&&!g.heldCube&&p.x>f.minX+.3&&p.x<f.maxX-.3&&p.z>f.minZ+.3&&p.z<f.maxZ-.3&&Math.abs(p.y-f.y)<1.5;};
 // Keep the original wall instrument's physical backing in the same place.
 // Its picture sits higher and to the right, clear of the moving car's frame
 // in the opening view; the lower carriage readout reports the loose load.
 k.block([0,13,-22.83],[19.3,2.8,.28],'dark');
 k.block([12,17.3,-22.83],[17.3,2.5,.28],'dark',false);
 labInstrument(k,[12,17.3,-22.64],{read:()=>c.at(c.target)?`КАБИНА У ПРИЧАЛА ${c.target?'II':'I'}`:`В ПУТИ К ПРИЧАЛУ ${c.target?'II':'I'}`,width:17,height:2.2,name:'Station berth and motion readout'});
 title(k,2,[0,21,-23.25],22);
 const canvas=globalThis.document?.createElement?.('canvas');
 if(canvas?.getContext){
  canvas.width=1024;canvas.height=144;
  const ctx=canvas.getContext('2d');
  if(ctx){
   const texture=new THREE.CanvasTexture(canvas);texture.anisotropy=4;
   k.ownedTextures??=[];k.ownedTextures.push(texture);
   const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
   // Hang the front readout from the solid chassis below the deck lip. In the
   // opening view it occupies a separate row below the distant wall screen.
   k.block([5.5,-1.27,11.89],[8.0,.95,.70],'dark',false,c.group);
   k.geometry(new THREE.PlaneGeometry(7.65,.69),material,[5.5,-1.27,12.26],new THREE.Quaternion(),{parent:c.group,batch:false,name:'Carriage front berth and cargo readout'});
   k.geometry(new THREE.PlaneGeometry(6.6,1.15),material,[-9.00,2.0,3.4],new THREE.Quaternion().setFromUnitVectors(V(0,0,1),V(1,0,0)),
    {parent:c.group,batch:false,name:'Carriage side berth and cargo readout'});
   let previous='';
   const repaint=()=>{
    const reading=`${c.at(c.target)?'ПРИЧАЛ':'В ПУТИ →'} ${c.target?'II':'I'}   /   ${looseCargoAboard()?'ГРУЗ':'ПУСТО'}`;
    if(reading===previous)return;
    previous=reading;ctx.fillStyle='#102b35';ctx.fillRect(0,0,1024,144);
    ctx.fillStyle=looseCargoAboard()?'#9bf0c8':'#f3d18e';ctx.fillRect(0,0,22,144);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 74px sans-serif';ctx.fillStyle='#fff4dd';
    ctx.fillText(reading,512,76,960);texture.needsUpdate=true;
   };
   k.ticks.push(repaint);repaint();
  }
 }
 const l=finish(k,[-16,0,16],[-19,.6,13],[16,10,-17],{car:c,cabinTerminal:t,spawnView:{yaw:0,pitch:.06}},
  {introduces:['moving portal anchor'],routes:['ride-with-companion','send-empty-and-return','dispatch-companion-first'],roles:{'travelling-address':'the same aperture follows its physical carrier and its original cargo','dispatch-entry':'stable lower address reaches the current car position'}});return l;
}
export function buildFoundation4(g,index=3){
 const k=new ResearchChamber(g,FOUNDATION_SPECS[3],index,'kinetic',{minX:-32,maxX:26,minZ:-26,maxZ:25},-4,30);
 k.deck('Lower launch inspection',-30,-14,8,23,0);
 k.deck('High drop deck',-30,-14,-20,-12,14);
 k.ramp('Fall-height access',-29,-21,-12,8,14,0);
 k.deck('Receiving apron',6,24,-24,-6,15);
 // A broad, real receiving shelf catches a separately launched companion.
 // It joins the main apron, so sending the companion first is a valid order.
 k.deck('Companion receiving shelf',-3,9,-18,-9,15);
 k.ramp('Recovery ascent',16,24,-4,15,-4,0);
 k.deck('Southern return',-14,24,15,23,0);
 const pit=k.loadPad('fall-entry',[-17,-4,-6],10);
 const outlet=k.panel('inclined-exit',[-8,10,-11],[.435889894,.9,0],9,7);
 k.support(-9,-16.3,8.8,.42);k.support(-9,-5.7,8.8,.42);
 // Four broad arrestor plates visibly divide the braking wall into bays.
 // Their closed steel faces and recessed chassis are both physical, while
 // their seams point across the apron instead of drawing attention offscreen.
 k.block([24.6,21,-15],[1,12,19],'dark');
 for(const [z,finish] of [[-21.8,'metal'],[-17.3,'shell'],[-12.8,'metal'],[-8.3,'shell']]){
  k.block([23.84,21,z],[.38,8.7,3.75],finish);
  k.block([23.58,21,z],[.16,5.2,.15],'dark');
 }
 for(const z of [-24,-19.5,-15,-10.5,-6])k.block([23.48,21,z],[.50,10.4,.35],'dark');
 for(const y of [16.5,25.5])k.block([23.48,y,-15],[.50,.36,18.5],'metal');
 // A height ruler is on a solid chute wall; no invisible bonus or checkpoint.
 for(const y of [0,4,8,12])k.label(`${y+4} м ПАДЕНИЯ`,[-31.18,y+2,-7],[1,0,0],7,.6);
 k.label('ПРИЁМ / +15 м',[15,17.3,-24.18],[0,0,1],13,1.1);title(k,3,[0,26,-25.25],24);
 const l=finish(k,[-22,0,19],[-24,.6,17],[16,15,-17],{fallPad:pit,outlet,spawnView:{yaw:.15,pitch:-.12}},
  {introduces:['falling momentum'],routes:['carry-together','companion-first'],recovery:['miss-and-rebuild'],roles:{'fall-entry':'receives genuine falling speed','inclined-exit':'turns momentum toward the raised receiving apron'}});return l;
}
export function buildFoundation5(g,index=4){
 const k=new ResearchChamber(g,FOUNDATION_SPECS[4],index,'gravity',{minX:-33,maxX:30,minZ:-27,maxZ:25},0,23);
 k.deck('Permanent motor gallery',-28,-12,-23,-10,6);
 k.deck('Opposite exit gallery',6,28,-25,-9,6);
 // A solid safety rail catches a nudged companion on the permanent waiting
 // gallery. The luminous crossing and the cabin mouth stay physically open.
 k.block([-20,6.55,-22.7],[15.6,1.1,.22],'metal');
 for(const x of [-27.7,-12.3])for(const [z,depth] of [[-21.5,2.2],[-11.8,2.5]])
  k.block([x,6.55,z],[.22,1.1,depth],'metal');
 const cabin=k.carrier('stored-power-cabin',[[-20,0,-10],[-20,6,-10]],{width:12,depth:12,portal:false});
 const drive=flowMotor(k,{fanAt:[21,3,21],sourceAt:[21,3,15],receiverAt:[-18,3,-25.7],wheelAt:[-18,3,-18],cabin});
 k.panel('light-source',[-13,6.75,11],[-1,0,0],8,4.82);k.panel('light-exit',[-31.4,6.75,-17],[1,0,0],8,4.82);
 k.projector([-23,6.20,11],[1,0,0],{radius:.85});k.support(-24,11,5.1,.55);
 for(const z of [6.7,15.3])k.support(-12.6,z,5.5,.35);
 const light=addLight(k,[-22.98,6.20,11],[1,0,0]);
 k.control('recall',[-11,0,7],()=>{drive.heights[0]=0;cabin.stations[1].y=0;},'E — опустить кабину. Возврат не сбрасывает друга или порталы.');
 for(const x of [-26.8,-13.2])k.support(x,-6,10,.34);
 k.block([-18,.6,-16.6],[4.5,1.2,3.2],'dark');
 k.display([0,19,-26.23],()=>`${drive.flow?'ПОДАЧА ВОЗДУХА':'БЕЗ ПОДАЧИ'} / МАХОВИК ${drive.wheel.omega.toFixed(1)} рад/с\nКАБИНА ${cabin.position.y.toFixed(1)} м / ${light.segments.length>1?'СВЕТ ПЕРЕДАЁТСЯ':'СВЕТ НЕ СОЕДИНЁН'}`,25,2);
 k.label('ПРИВОД УДЕРЖИВАЕТ ВЫСОТУ',[-20,9.5,-10.1],[0,0,1],14,.8);title(k,4,[0,21.5,-26.23],23);
 const l=finish(k,[2,0,18],[-1,.6,15],[18,6,-17],{drive,cabin,light,spawnView:{yaw:.25,pitch:-.14}},
  {introduces:['stored mechanical energy'],combines:['portals','load','light','persistent support'],routes:['lift-then-bridge','bridge-before-lift','fall-and-recall'],roles:{'air-source':'capture fan flow','air-receiver':'drive front grille','light-source':'capture projection with the now available pair','light-exit':'turn the projection across the final gap'}});ownLight(l,light);return l;
}
export const FOUNDATION_BUILDERS=[buildFoundation1,buildFoundation2,buildFoundation3,buildFoundation4,buildFoundation5];
