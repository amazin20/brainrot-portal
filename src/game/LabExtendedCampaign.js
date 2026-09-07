import {suppliedArt} from './LabWorkshopKit.js';
import * as THREE from 'three';
import {LabTileWorld} from './LabTileWorld.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
import {V,inRect,tracePortalRay,rayTouches,beamDrawing,glass,wall,gate,consoleNode,terminalAccessible,ringDevice,rotorDevice,integrateBalance,impactPiston} from './LabPuzzleMechanics.js';
export const EXTENDED_CAMPAIGN=Object.freeze([
 {id:'crossed-light',title:'Перекрёстный свет',description:'Калибровочная кабина, зеркало и свет, проходящий через порталы.',assets:[1,2,11,22,24],concept:'Оптика',hints:['Свет проходит через связанную пару так же, как предмет. Серебристый диск отражает луч.','До отражателя нельзя дотянуться снаружи кабины, но в её окне видна портальная панель.','Сначала войди в кабину и поверни зеркало. Вернись, свяжи панель напротив излучателя с панелью перед зеркалом. Свет должен попасть в круглый приёмник.']},
 {id:'moment-arm',title:'Точка опоры',description:'Один мост, подвижный противовес и настоящий момент силы.',assets:[1,2,11,22,23,24,34],concept:'Равновесие рычага',hints:['Один и тот же вес сильнее поворачивает мост, когда находится дальше от оси. Игрок тоже нагружает мост.','Противовес можно передвинуть терминалом. Одного противовеса не хватает удержать дальний конец под твоим весом.','Сдвинь противовес и оставь друга на дальнем плече. С промежуточной галереи отправь друга в верхний док. Затем перенеси вход на стену галереи и пройди сам.']},
 {id:'wind-column',title:'Ветер за углом',description:'Перенаправь воздушную струю и поймай восходящий поток.',assets:[1,2,11,22,23,24,31],concept:'Сила воздушного потока',hints:['Вентилятор создаёт постоянную силу, а не разовый прыжок. Частицы показывают направление воздуха.','Напольный выход превратит горизонтальную струю в восходящую. Высокая площадка находится сбоку от потока.','Свяжи панель напротив вентилятора с плитой внизу шахты. Включи нагнетание, возьми друга, войди в поток и на высоте уйди к верхней площадке.']},
 {id:'impact-workshop',title:'Работа удара',description:'Ролики разгоняют груз. Его импульс сжимает пружину и защёлкивает затвор.',assets:[1,2,11,22,24],concept:'Кинетическая энергия и упругость',hints:['Пружинный затвор находится в низком канале. Слабого толчка недостаточно сжать пружину до защёлки.','Ролики придают другу скорость. Портальная пара должна направить этот импульс в торец поршня.','Настрой пару с выхода роликов в канал перед поршнем, включи движение вперёд и отпусти друга на загрузочном столе. После удара откроется крышка канала — забери друга.']},
 {id:'vector-vault',title:'Векторный сейф',description:'Управляй полем в закрытом лабиринте и подготовь путь извлечения друга.',assets:[1,2,11,22,23,24],concept:'Дистанционное управление силами',hints:['Под стеклом действует направленное поле. Оно толкает свободного друга по стрелке, но не переносит его мгновенно.','Сначала рассмотри проходы сверху и подготовь портал в открытом колодце. Крышка не пропускает руки.','На терминале меняй направление: вправо, к дальней стене, влево, к дальней стене, вправо, к колодцу. Свяжи дно колодца с панелью на верхней галерее.']},
]);
const PALETTES=[{wall:0x454953,floor:0x727c87,accent:0xefc783,sky:0x4c5560},{wall:0x45524d,floor:0x778378,accent:0x88d6b4,sky:0x515b53},{wall:0x374a60,floor:0x617588,accent:0x81cce6,sky:0x48596c},{wall:0x514840,floor:0x837265,accent:0xefb77c,sky:0x60554c},{wall:0x454554,floor:0x767387,accent:0xc0abe8,sky:0x565369}];

/** Only rendering/contact primitives are shared. Each builder below authors a
 * different topology, actuator, causal model and complete solution. No old
 * gate/lift/fling stages, mirrors of courses or mechanism-use victory flags. */
export function buildExtendedCampaign(game,index){
 const spec=EXTENDED_CAMPAIGN[index-5];if(!spec)throw new RangeError('Unknown chamber');
 const world=new LabTileWorld(game,PALETTES[index-5]),terminals=[],panels={},fixtures=[];
 let time=0,goal,bounds,spawn,cargoSpawn,update=()=>{},reset=()=>{},render=()=>{},applyCargoForces,playerAcceleration,mechanicalContact=()=>false;
 const state={};
 const patch=(name,p,n,w=4,h=4,parent=world.root,moving=false)=>(panels[name]=world.patch(name,p,n,w,h,parent,moving));
 const console=(p,fn,kind,lesson)=>consoleNode(world,terminals,p,fn,kind,lesson);
 const lowFriction=mesh=>{const b=game.physics?.solids.get(mesh.uuid)?.body;if(b)b.material.friction=.055;};
 if(index===5){
  bounds={minX:-12,maxX:12,minZ:-19,maxZ:13};spawn=[2,0,10];cargoSpawn=[1,.55,9];
  world.walls(bounds,10);world.floor(-12,12,-19,13);
  patch('cab-entry',[-11.8,2.1,9],[1,0,0]);patch('cab-inner',[-9.8,2.1,-4.5],[1,0,0]);
  // A real low service slot admits sightlines, not a standing player.
  world.box([-5,.62,-4.5],[.25,1.24,5]);world.box([-5,6.4,-4.5],[.25,7.2,5]);
  for(const z of [-7,-2])world.box([-7.5,5,z],[5,10,.25]);
  world.box([-10.05,5,-4.5],[.25,10,5]);
  for(const y of [1.25,2.8])world.box([-4.84,y,-4.5],[.06,.06,5],world.materials.accent,false);
  patch('light-intake',[11.8,2.1,6],[-1,0,0]);
  patch('light-outlet',[0,2.1,-3],[0,0,-1]);
  const emitter=ringDevice(world,[-10,2.1,6],[1,0,0],0x7ee5e9,.6);
  world.box([-10,.95,6],[.3,1.9,.3]);
  const mirror=ringDevice(world,[0,2.1,-8],[0,0,1],0xf0d694,.85);
  world.box([0,.9,-8],[.25,1.8,.25]);
  const sensor=ringDevice(world,[9.7,2.1,-8],[-1,0,0],0xa38b6b,.55);
  const ray=beamDrawing(world),door=gate(world,-13,24,10);
  const reflector={position:V(0,2.1,-8),normal:V(1,0,0),radius:.83};
  state.mirror=0;state.target=0;state.lit=false;state.door=door;
  console([-8,0,-5.8],()=>{state.target=state.target?0:1;game.audio?.mechanism?.('switch');},'mirror','E — повернуть зеркало. Луч отражается от диска и проходит через порталы.');
  goal=world.goal([0,0,-16.3],[4.6,4]);
  update=dt=>{state.mirror=THREE.MathUtils.damp(state.mirror,state.target,5,dt);const angle=state.mirror*Math.PI/4;reflector.normal.set(Math.cos(angle),0,Math.sin(angle));mirror.group.quaternion.setFromUnitVectors(V(0,0,1),reflector.normal);
   state.segments=tracePortalRay(game,V(-9.8,2.1,6),V(1,0,0),{reflectors:[reflector]});state.lit=rayTouches(state.segments,V(9.7,2.1,-8));sensor.glow.material.color.setHex(state.lit?0x9af4bd:0xa38b6b);ray.update(state.segments);door.update(state.lit,dt,time);};
  reset=()=>{state.mirror=state.target=0;state.lit=false;door.reset();};render=a=>door.render(a,time);
 }else if(index===6){
  bounds={minX:-13,maxX:13,minZ:-17,maxZ:15};spawn=[8,2.2,2];cargoSpawn=[6,2.75,1];world.walls(bounds,14,-4.5);
  world.floor(-13,13,-17,15,-4);world.floor(1.85,13,-3,3,2.2);world.floor(-10,7,-17,-10.4,5.5);
  // A recovery stair returns only to the entrance, never to the high exit.
  world.stairs(9,12,4,14,-4,2.2);world.floor(9,13,3,4,-4);
  const bridge=new THREE.Group();bridge.position.set(0,2.2,0);world.root.add(bridge);
  const deck=world.box([0,-.14,0],[3.8,.28,22],world.materials.floor,true,bridge);
  const collider=game.colliders.find(c=>c.mesh===deck);collider.kinematic=true;collider.walkablePlane=true;
  for(const x of [-1.85,1.85])world.box([x,.045,0],[.07,.09,22],world.materials.accent,false,bridge);
  for(let z=-10;z<=10;z+=2)world.box([0,.012,z],[3.7,.022,.035],world.materials.trim,false,bridge);
  for(const x of [-2.5,2.5])world.box([x,.4,0],[.35,3.6,1.1]);
  const axle=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,5.7,16),world.materials.trim);axle.rotation.z=Math.PI/2;axle.position.y=2;world.root.add(axle);
  const mass=world.box([0,-.8,-6],[2,.9,1.3],world.materials.trim,false,bridge);world.box([0,-.8,0],[.12,.12,16],world.materials.accent,false,bridge);
  const load=patch('lever-load',[0,.027,8.4],[0,1,0],3.2,3.8,bridge,true);load.collider.walkablePlane=true;game.colliders=game.colliders.filter(c=>c!==load.collider);load.mesh.userData.portalColliderId=collider.mesh.uuid;collider.frontPlane=()=>load.getFrame();
  const receiver=patch('lever-receiver',[6.8,11.1,-14],[ -1,0,0]);
  world.box([4.5,6,-11.55],[5,12,.25]);
  console([8,2.2,0],()=>{state.counterIndex=(state.counterIndex+1)%3;game.audio?.mechanism?.('switch');},'balance','E — сдвинуть противовес. Важны вес и расстояние от оси; игрок тоже нагружает мост.');
  Object.assign(state,{angle:0,omega:0,previousAngle:0,counterIndex:0,counterZ:-6,torque:0,bridge,load,collider});
  const heightAt=(x,z)=>Math.abs(x)<=1.9&&Math.abs(z)<=11*Math.cos(state.angle)?2.2-Math.tan(state.angle)*z:null;
  const f={minX:-1.9,maxX:1.9,minZ:-11,maxZ:11,y:2.2,mesh:deck,enabled:true,heightAt,normalAt:()=>V(0,Math.cos(state.angle),Math.sin(state.angle))};game.floors.push(f);
  const contact=()=>cargoLoadsPlate(game.cargo,game.heldCube,{center:V(0,2.2,0),normal:V(0,Math.cos(state.angle),Math.sin(state.angle)),right:V(-1,0,0),up:V(0,-Math.sin(state.angle),Math.cos(state.angle)),halfWidth:1.9,halfHeight:11});
  mechanicalContact=()=>contact(game.cargo.position);
  // A distinct upper dock is outside the deck's full tilt + jump envelope.
  // Reaching the lever landing is not reaching the exit: carry must be solved
  // with a portal transfer, including when bunny-hopping unloads the deck.
  world.floor(2.2,7,-17,-12,9);
  // A visible, enclosed arrival dock, not another reachable step on the lever.
  // Its service slot passes a portal shot, but is shorter than the 2.4 m body.
  // The full roof and side walls also block running around / corner climbing.
  world.box([2.08,2.675,-14.35],[.22,13.35,5.3]);
  world.box([2.08,12.75,-14.35],[.22,2.7,5.3]);
  world.box([7.12,5,-14.35],[.22,18,5.3]);
  world.box([4.6,13.2,-11.55],[5.3,2.4,.25]);
  for(const h of [9.35,11.4])world.box([2.06,h,-14.35],[.28,.055,5.3],world.materials.accent,false);
  state.exitWindow={bottom:9.35,top:11.4,x:2.08};
  // The user's balance model becomes the actual bridge, not idle scenery.
  // Bake only instance transforms into owned derivatives; cached source is intact.
  const authored=game.model(34,1);authored.rotation.y=Math.PI/2;authored.scale.set(22,.9/.3707,3.8/.2665);authored.position.y=1.3;authored.updateWorldMatrix(true,true);
  authored.traverse(n=>{if(!n.isMesh)return;const moving=n.parent.name==='Moving';const geo=n.geometry.clone().applyMatrix4(n.matrixWorld);if(moving)geo.translate(0,-2.2,0);const m=new THREE.Mesh(geo,n.material);m.receiveShadow=true;(moving?bridge:world.root).add(m);});
  deck.visible=false;deck.userData.collisionProxy=true;
  fixtures.push({id:34,role:'Actual gravity-balanced deck and stationary pivot'});

  goal=world.goal([4.6,9,-14.5],[4.4,4]);
  function pose(angle,dt){bridge.rotation.x=angle;bridge.updateWorldMatrix(true,true);collider.box.setFromObject(deck);load.collider.box.setFromObject(load.mesh);
   if(!game.physics)return;
   // Physical boxes rotate with the authored deck; never replace them by AABBs.
   for(const [c,mesh]of [[collider,deck],[load.collider,load.mesh]]){const item=game.physics.solids.get(c.mesh.uuid);if(!item)continue;const pos=mesh.getWorldPosition(V()),q=bridge.getWorldQuaternion(new THREE.Quaternion());
    item.body.position.copy(pos);item.body.quaternion.copy(q);item.body.angularVelocity.setZero();item.body.aabbNeedsUpdate=true;item.target.copy(pos);item.remaining=0;}
   game.physics.world.broadphase.dirty=true;
  }
  update=dt=>{state.previousAngle=state.angle;const py=heightAt(game.playerPosition.x,game.playerPosition.z),aboard=py!==null&&game.playerGrounded&&Math.abs(game.playerPosition.y-py)<.22;
   state.counterZ=THREE.MathUtils.damp(state.counterZ,[-6,0,6][state.counterIndex],2.4,dt);mass.position.z=state.counterZ;
   const cargoMoment=!game.heldCube&&contact(game.cargo.position)?3.2*game.cargo.position.z:0;
   const playerMoment=aboard?(3.2+(game.heldCube?3.2:0))*game.playerPosition.z:0;
   state.torque=19.5*(2.7*state.counterZ*Math.cos(state.angle)+cargoMoment+playerMoment);
   integrateBalance(state,state.torque,dt);pose(state.angle,dt);
   if(aboard&&dt){const next=heightAt(game.playerPosition.x,game.playerPosition.z);if(next!==null){game.playerPosition.y+=next-py;game.previousPlayerPosition.y+=next-py;}}
  };
  reset=()=>{Object.assign(state,{angle:0,omega:0,previousAngle:0,counterIndex:0,counterZ:-6});pose(0,0);};render=a=>{bridge.rotation.x=THREE.MathUtils.lerp(state.previousAngle,state.angle,a);};
 }else if(index===7){
  bounds={minX:-10,maxX:10,minZ:-13,maxZ:13};spawn=[-4,0,10];cargoSpawn=[-3,.55,8.5];world.walls(bounds,15);world.floor(-10,10,-13,13);
  world.floor(-4.2,4.2,-13,-3.1,7);goal=world.goal([0,7,-9],[4.8,4.5]);
  // Tall column, open only toward the high gallery. It is not an elevator.
  for(const x of [-3.1,3.1]){world.box([x,6,0],[.20,12,.20]);glass(world,[x,5,0],[.10,10,5.2]);}
  patch('air-intake',[9.8,2.1,7],[-1,0,0]);patch('air-up',[0,.025,0],[0,1,0],4,4);
  const sourceFan=suppliedArt(game,world,31,[-8.3,.60,7],3.2,-Math.PI/2);
  game.collisionProxy(new THREE.Box3().setFromObject(sourceFan.art));fixtures.push({id:31,role:'Original uploaded wind generator with independent rotor'});
  const drawing=beamDrawing(world,0x95ddec,.035);let fanPhase=0;
  const beads=new THREE.InstancedMesh(new THREE.SphereGeometry(.055,6,4),world.materials.accent,36);beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);beads.frustumCulled=false;world.root.add(beads);
  const m=new THREE.Matrix4();state.enabled=false;state.segments=[];
  console([6,0,9],()=>{state.enabled=!state.enabled;game.audio?.mechanism?.('switch');},'air','E — включить воздух. Связанная пара перенаправляет струю; поток действует непрерывно.');
  update=dt=>{fanPhase+=dt*(state.enabled?7:0);sourceFan.spin(fanPhase);state.segments=state.enabled?tracePortalRay(game,V(-6.55,2.1,7),V(1,0,0),{medium:'air'}):[];drawing.update(state.segments);
   beads.visible=state.enabled;const s=state.segments.at(-1);if(s){for(let i=0;i<36;i++){const u=((time*.8+i/36)%1),p=s.a.clone().addScaledVector(s.direction,u*s.length);p.x+=Math.sin(i*2.7)*1.25;p.z+=Math.cos(i*2.7)*1.25;m.makeTranslation(p.x,p.y,p.z);beads.setMatrixAt(i,m);}beads.instanceMatrix.needsUpdate=true;}};
  const acceleration=(position,velocity)=>{for(const s of state.segments){const offset=position.clone().sub(s.a),t=offset.dot(s.direction);if(t<0||t>s.length)continue;offset.addScaledVector(s.direction,-t);if(offset.length()>1.65)continue;return s.direction.clone().multiplyScalar(THREE.MathUtils.clamp((14-velocity.dot(s.direction))*5,-35,70));}return V();};
  playerAcceleration=(p,v)=>acceleration(p.clone().add(V(0,1.1,0)),v);
  applyCargoForces=()=>{if(game.heldCube)return;const b=game.physics.cargoBody,a=acceleration(game.cargo.position,game.cargo.velocity);b.force.x+=a.x*b.mass;b.force.y+=a.y*b.mass;b.force.z+=a.z*b.mass;if(a.lengthSq())b.wakeUp();};
  reset=()=>{state.enabled=false;state.segments=[];drawing.update([]);};
 }else if(index===8){
  bounds={minX:-13,maxX:13,minZ:-19,maxZ:14};spawn=[-8,1,11];cargoSpawn=[-9,1.55,10];world.walls(bounds,10);world.floor(-13,13,-19,14);
  world.floor(-13,-6,2,14,1);world.stairs(-12,-10,-1,2,0,1);const belt=world.floor(-10,8.8,4.6,7.8,1);state.direction=-1;
  const rollers=[];for(let x=-9.5;x<8.5;x+=.7){const r=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,3.05,10),world.materials.trim);r.rotation.x=Math.PI/2;r.position.set(x,.98,6.2);world.root.add(r);rollers.push(r);}
  for(const z of [4.55,7.85])world.box([2,1.2,z],[16,.42,.12]);
  glass(world,[1.85,3.2,6.2],[13.3,.12,3.5]);
  patch('belt-end',[9.8,2.2,6.2],[-1,0,0]);patch('impact-entry',[0,2.1,-2.8],[0,0,-1]);
  const lane=world.floor(-2,2,-11,-3,.02),piston=impactPiston(world,-8.5);state.piston=piston;
  for(const x of [-2.1,2.1])world.box([x,.65,-8],[.14,1.3,6]);
  const hood=glass(world,[0,2.25,-8],[4.3,.12,5.8]),hoodCollider=game.colliders.find(c=>c.mesh===hood);
  const door=gate(world,-12.3,26,10);state.door=door;
  console([-11,1,4],()=>{state.direction*=-1;game.audio?.mechanism?.('switch');},'belt','E — направление роликов. Скорость друга сжимает пружину; защёлка удержит затвор.');
  const arrow=new THREE.ArrowHelper(V(1,0,0),V(-7,1.05,5),2.5,0xf0bc7d,.5,.35);world.root.add(arrow);
  goal=world.goal([0,0,-16],[4.8,4.2]);
  update=dt=>{lowFriction(belt.mesh);lowFriction(lane.mesh);rollers.forEach(r=>r.rotation.y+=dt*state.direction*7);arrow.setDirection(V(state.direction,0,0));door.update(piston.latched,dt,time);
   const x=THREE.MathUtils.damp(hood.position.x,piston.latched?5:0,4,dt);hood.position.x=x;hoodCollider.box.setFromObject(hood);game.physics?.updateStaticBox(hood.uuid,hoodCollider.box,dt);};
  mechanicalContact=()=>inRect(game.cargo.position,[-10,10,4.6,7.8])||inRect(game.cargo.position,[-2,2,-11,-3]);
  applyCargoForces=()=>{piston.forces();if(game.heldCube)return;const p=game.cargo.position,b=game.physics.cargoBody;
   if(inRect(p,[-10,9.8,4.6,7.8])&&Math.abs(p.y-1.39)<.3){b.force.x+=b.mass*THREE.MathUtils.clamp((state.direction*12-b.velocity.x)*12,-65,65);b.wakeUp();}};
  reset=()=>{state.direction=-1;piston.reset();if(piston.body){piston.body.type=1;piston.body.updateMassProperties();}hood.position.x=0;door.reset();};render=a=>{piston.render();door.render(a,time);};
 }else{
  bounds={minX:-15,maxX:15,minZ:-15,maxZ:15};spawn=[-12,3,11];cargoSpawn=[-6,.55,6];world.walls(bounds,12,-4.5);world.floor(-15,15,-15,15,-4.2);
  world.floor(-15,15,9.6,15,3);world.floor(-15,-9.5,-15,-8.5,3);world.floor(-11.2,-9.5,-8.5,9.6,3);
  // A real stairwell is cut out of the west observation ring. Its upper end
  // returns to the entrance, not to the cargo well or completion area.
  world.stairs(-14.2,-11.5,-8.5,9.6,-4.2,3);world.floor(9.5,15,-15,9.6,3);world.floor(-9.5,9.5,-15,-9.6,3);
  const mazeFloor=world.floor(-8,8,-5,9,0);world.floor(-8,4,-9,-5,0);const well=world.floor(4,8,-9,-5,-4);
  // Transparent sealed cover makes the remote-object problem physically clear.
  glass(world,[0,1.52,2],[16.2,.10,14]);glass(world,[-2,1.52,-7],[12,.10,4]);
  world.box([0,.7,9],[16.2,1.4,.18]);world.box([-2,.7,-9],[12,1.4,.18]);world.box([6,-2,-9],[4,4,.18]);
  for(const x of [-8,7.2])world.box([x,.7,0],[.18,1.4,18]);
  world.box([-3,.7,3],[10,1.4,.2]);world.box([3,.7,-1],[10,1.4,.2]);world.box([-2.5,.7,-5],[11,1.4,.2]);
  // An observation spur looks into a dead-end, rather than another repeated room.
  world.box([-5,.7,7.7],[.18,1.4,2]);world.box([-6.5,.7,6.7],[3,1.4,.18]);
  patch('well',[6.4,-3.975,-7],[0,1,0],3.2,3.8);patch('collection',[14.8,5.1,-8],[-1,0,0]);
  const directions=[V(1,0,0),V(0,0,-1),V(-1,0,0),V(0,0,1)];state.direction=0;state.enabled=false;
  const pointer=new THREE.ArrowHelper(directions[0],V(0,2.0,6),2,0xcbb8f0,.65,.4);world.root.add(pointer);
  const device=ringDevice(world,[0,6.8,0],[0,-1,0],0xcbb8f0,1.15);world.box([0,9.5,0],[.18,5,.18],world.materials.trim,false);
  console([-1,3,11.3],()=>{if(!state.enabled)state.enabled=true;else state.direction=(state.direction+1)%4;game.audio?.mechanism?.('switch');},'vector','E — повернуть поле на 90°. Оно толкает друга по стрелке. Рассмотри проходы через стекло.');
  glass(world,[9.55,4.1,-8],[.12,2.2,7]);
  for(const z of [-11.5,-4.5])world.box([11.5,3.5,z],[3.8,1,.16]);
  goal=world.goal([11.8,3,-8],[4.4,6]);
  update=dt=>{lowFriction(mazeFloor.mesh);lowFriction(well.mesh);pointer.setDirection(directions[state.direction]);device.group.rotation.z=THREE.MathUtils.damp(device.group.rotation.z,-state.direction*Math.PI/2,5,dt);};
  mechanicalContact=()=>inRect(game.cargo.position,[-8,8,-9,9])||inRect(game.cargo.position,[9.5,15,-11.5,-4.5]);
  applyCargoForces=()=>{const p=game.cargo.position;if(game.heldCube||!state.enabled||!inRect(p,[-8,8,-9,9])||p.y<-.1)return;const d=directions[state.direction],b=game.physics.cargoBody;b.material.friction=0;
   b.force.x+=b.mass*(d.x*16-b.velocity.x*3.8);b.force.z+=b.mass*(d.z*16-b.velocity.z*3.8);b.wakeUp();};
  reset=()=>{state.enabled=false;state.direction=0;};
 }
 world.root.userData.distinctConcept=spec.concept;
 const near=()=>terminals.filter(t=>terminalAccessible(game,t)).sort((a,b)=>a.position.distanceToSquared(game.playerPosition)-b.position.distanceToSquared(game.playerPosition))[0];
 const level={id:spec.id,title:`${index+1} / ${spec.title}`,index,bounds,spawn,cargoSpawn,goal,world,structure:world.root,panels,terminals,state,pads:[],gates:state.door?[state.door]:[],fixtures,floors:world.floors,bridges:[],lift:null,receiverPanel:null,launchPad:null,momentum:true,hints:spec.hints,
  update(dt){time+=dt;update(dt);},reset(){time=0;reset();update(0);},renderUpdate(a=1){render(a);},applyCargoForces,playerAcceleration,
  interact(){const t=near();if(!t)return false;t.action();game.companionAnimator?.trigger?.('curiosity');return true;},
  nearbyInteraction(){const t=near();return t?{kind:t.kind,label:'E',text:t.lesson}:null;},cargoOnAnyPad:mechanicalContact,getLaunch:()=>null,getObjective:()=>spec.description,
  isWon:()=>game.playerGrounded&&goal.contains(game.playerPosition)&&!!game.cargo&&goal.contains(game.cargo.position)&&game.playerPosition.distanceTo(game.cargo.position)<3.3,
  diagnostics:()=>({level:index+1,id:spec.id,concept:spec.concept,uniqueTopology:true,noCheckpoints:true,portalSurfaces:game.portalPanels.length,goal:goal.position.toArray(),lit:state.lit,angle:state.angle,torque:state.torque,fan:state.enabled,piston:state.piston?.compression,latched:state.piston?.latched})};
 return level;
}
