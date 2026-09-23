import * as THREE from 'three';
import {ResearchChamber} from './LabResearchArt.js';
import {createLightBridge} from './LabLightBridge.js';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
const spec=(id,title,description,accent,hints)=>({id:'foundation-'+id,title,concept:description,description,accent,assets:[1,2,11,22,23,24],hints});
export const SECOND_CHAPTER_SPECS=Object.freeze([
 spec('counterweight','Вес решения','Обе кабины связаны одним тросом. Тормоз сохраняет положение, но не создаёт подъёмную силу.',0xdda658,[
  'Посмотри на трос и шкалы: когда одна кабина опускается, другая поднимается. Тормоз удерживает обе.',
  'Друг сильнее нагружает механизм, чем ты. Можно оставить его противовесом и ехать вверх, а можно спуститься вместе с ним в другой кабине.',
  'Перед тем как забрать противовес, зажми тормоз. Портал на поднятой кабине сохраняет обратный путь.']),
 spec('moving-light-address','Смена назначения','Один портал направляет свет и переносит тебя. Перестраивай связь с постоянных площадок, пока панель меняет причал.',0x65d9d5,[
  'Сначала свет ведёт к пульту в центре. Панель на рельсе меняет причал вместе с порталом.',
  'За панелью на центральной площадке есть другая лицевая сторона. Осмотри её пешком, а не пытайся стрелять в обратную сторону керамики.',
  'После перемещения панели преврати пару в переход к дальнему причалу. Встань на твёрдый настил и снова направь через эту пару свет.']),
]);

/** A damped, constrained balance. Brake and end stops dissipate motion; neither
 * can add potential energy. The two positions always sum to the cable travel. */
export class CounterweightBalance{
 constructor(travel=8){if(!Number.isFinite(travel)||!(travel>0))throw new RangeError('Positive travel required');this.travel=travel;this.reset();}
 reset(){this.height=0;this.velocity=0;this.braked=true;this.loads=[0,0];}
 step(dt,left,right){
  if(![dt,left,right].every(Number.isFinite)||dt<0||left<0||right<0)throw new RangeError('Finite nonnegative step and loads required');
  this.loads=[left,right];if(this.braked){this.velocity=0;return;}
  const steps=Math.max(1,Math.ceil(dt*240)),h=dt/steps;
  for(let i=0;i<steps;i++){
   const acceleration=(right-left)*3/(2+left+right);
   this.velocity=THREE.MathUtils.clamp((this.velocity+acceleration*h)*Math.exp(-1.8*h),-.8,.8);
   const next=this.height+this.velocity*h;this.height=THREE.MathUtils.clamp(next,0,this.travel);
   if(next<=0||next>=this.travel)this.velocity=0;
  }
 }
 get heights(){return [this.height,this.travel-this.height];}
}
function finish(k,spawn,cargo,goal,extra,rule,roles){
 const l=k.finishResearch(spawn,cargo,goal,{...extra,foundationChamber:true,secondChapter:true});
 l.researchChamber=false;l.contextHandlesCarry=true;
 l.learning={introduces:extra.introduces||[],routes:extra.routes,roles};
 l.puzzleGeometry={noProgressFlags:true,orders:extra.routes,portalRoles:roles,recoveryFloor:k.base,goalHeight:goal[1],footprint:(k.bounds.maxX-k.bounds.minX)*(k.bounds.maxZ-k.bounds.minZ)};
 l.getContextLesson=()=>k.game.heldCube?['second-carry','E','Перед работой с пушкой или пультом оставь друга на постоянной опоре. E — поставить.',false]:['second-rule-'+k.index,'НАБЛЮДАЙ',rule,false];
 return l;
}
function consoleOnCarrier(k,car,name,local,action,text){
 const t=k.control(name,car.position.clone().add(V(...local)).toArray(),action,text);
 car.group.attach(t.art);t.collider.kinematic=true;
 const sync=dt=>{car.group.updateWorldMatrix(true,true);t.position.copy(car.position).add(V(...local)).y+=.8;k.game.syncCollision(t.collider,new THREE.Box3().setFromObject(t.art),dt);};
 k.ticks.push(sync);k.resets.push(()=>sync(0));return t;
}
function balanceRig(k,cars,balance){
 // A shared overhead shaft and sheaves express the same connection as the
 // mechanics; cables remain outside the boarding and portal apertures.
 k.block([0,17,-.5],[51,1.1,1.6],'dark');
 for(const x of [-25,25])k.support(x,-.5,17,.65);
 const ax=Q().setFromAxisAngle(V(0,0,1),Math.PI/2);
 k.geometry(new THREE.CylinderGeometry(.23,.23,47,20),'metal',[0,17.4,-.5],ax,{solid:true,name:'Common counterweight shaft'});
 const cables=[];
 for(const [i,c]of cars.entries())for(const side of [-1,1]){
  const x=c.position.x+side*5.3,z=c.position.z+5;
  k.block([x,17,(z-.5)/2],[.65,.7,z+.5],'dark');
  k.block([x,17.05,z],[1.9,.7,.55],'shell');
  const wheel=k.geometry(new THREE.TorusGeometry(.7,.12,8,24),'metal',[x,17.3,z],Q(),{batch:false,name:'Driven rope sheave'});
  const rope=k.geometry(new THREE.CylinderGeometry(.065,.065,1,10),'metal',[x,0,z],Q(),{batch:false,name:'Counterweight suspension cable'});
  const collider=k.game.collisionProxy(new THREE.Box3().setFromObject(rope),{kinematic:true});cables.push({car:c,rope,wheel,collider,x,z,i});
 }
 const sync=(dt,physical,alpha=1)=>{for(const h of cables){const pose=physical?h.car.position.y:h.car.group.position.y;const low=pose+.15,top=16.8;h.rope.position.set(h.x,(low+top)/2,h.z);h.rope.scale.y=top-low;h.wheel.rotation.z=(h.i?-1:1)*balance.height/.7;if(physical)k.game.syncCollision(h.collider,new THREE.Box3().setFromObject(h.rope),dt);}};
 k.ticks.push(dt=>sync(dt,true));k.resets.push(()=>sync(0,true));k.renders.push(alpha=>sync(0,false,alpha));
}
export function buildFoundation6(g,index=5){
 const k=new ResearchChamber(g,SECOND_CHAPTER_SPECS[0],index,'optical',{minX:-28,maxX:28,minZ:-23,maxZ:24},0,21);
 const a=k.carrier('balance-west',[[-16,0,-4],[-16,8,-4]],{width:16,depth:12});
 const b=k.carrier('balance-east',[[16,8,3],[16,0,3]],{width:16,depth:12});
 a.speed=b.speed=12;
 for(const [c,side]of [[a,1],[b,-1]]){c.panel.group.position.set(side*4,2.35,6);c.panel.group.quaternion.setFromUnitVectors(V(0,0,1),V(side,0,0));c.panel.sync(0);}
 k.deck('Upper exit and maintenance gallery',-24,4,-21,-4,8);
 k.panel('service-entry',[-26.3,2.5,15],[1,0,0],8,5.2);
 const balance=new CounterweightBalance();
 const aboard=(car,p,tolerance)=>p&&p.x>car.floor.minX+.15&&p.x<car.floor.maxX-.15&&p.z>car.floor.minZ+.15&&p.z<car.floor.maxZ-.15&&Math.abs(p.y-car.floor.y)<tolerance;
 const load=car=>{
  const player=g.playerGrounded&&aboard(car,g.playerPosition,.20);
  // Effective loads after the visible reduction gear, not a second cargo body.
  return (player?1:0)+((g.heldCube?player:aboard(car,g.cargo?.position,.8))?2:0);
 };
 k.ticks.unshift(dt=>{balance.step(dt,load(a),load(b));[a,b].forEach((c,i)=>{c.stations[1].y=balance.heights[i];c.target=1;});});
 k.resets.push(()=>{balance.reset();[a,b].forEach((c,i)=>{c.stations[0].y=c.stations[1].y=balance.heights[i];c.reset();});});
 const toggle=()=>{balance.braked=!balance.braked;};
 consoleOnCarrier(k,a,'west-brake',[0,0,9],toggle,'E — зажать / отпустить общий тормоз. Трос удерживает обе кабины.');
 consoleOnCarrier(k,b,'east-brake',[0,0,9],toggle,'E — общий тормоз. Поднятая кабина останется на месте, пока забираешь груз.');
 k.control('service-brake',[-5,0,15],toggle,'E — общий тормоз. Возвратная служебная ручка управляет тем же механизмом.');
 balanceRig(k,[a,b],balance);
 k.display([0,16,-21.65],()=>`${balance.braked?'ТОРМОЗ ЗАЖАТ':'ТОРМОЗ ОТПУЩЕН'} / НАГРУЗКА А ${balance.loads[0]} : Б ${balance.loads[1]}\nА ${balance.heights[0].toFixed(1)} м + Б ${balance.heights[1].toFixed(1)} м = 8 м`,24,2);
 for(const [x,text]of [[-16,'А / К ГАЛЕРЕЕ'],[16,'Б / ПРОТИВОВЕС']])k.label(text,[x,12,x<0?-4:3],[0,0,1],10,1);
 k.label('06 / ВЕС РЕШЕНИЯ',[0,19,-21.65],[0,0,1],23,1.2);
 k.label('ДРУГ = 2 / ТЫ = 1 / ЭФФЕКТИВНАЯ НАГРУЗКА',[0,3,22.4],[0,0,-1],23,.8);

 return finish(k,[-5,0,20],[-9,.6,17],[-7,8,-15],{balance,cabins:[a,b],introduces:['shared gravitational load','mechanical brake'],routes:['counterweight-up','ride-down','fall-and-retrieve'],spawnView:{yaw:.03,pitch:-.10}},
  'Тяжёлая сторона опускается, другая поднимается. Тормоз удерживает обе; пульты на кабинах и внизу управляют одним тормозом.',
  {'service-entry':'ordinary lower-floor portal; no route unlock','balance-west':'portal travels on the cabin reaching the exit','balance-east':'portal on the counterweight cabin; can transport load or traveller'});
}

export function buildFoundation7(g,index=6){
 const k=new ResearchChamber(g,SECOND_CHAPTER_SPECS[1],index,'current',{minX:-30,maxX:25,minZ:-28,maxZ:30},0,20);
 k.deck('Dispatch optical dock',-26.8,-14,4,28,5);
 k.deck('Permanent relay gallery',-3,13,0,20,5);
 k.deck('Remote optical dock',-26.8,-14,-20,2,5);
 k.deck('Far receiving gallery',-3,21,-20,-8,5);
 // A broad service stair runs across the chamber, outside the optical route.
 // Closed 25 cm risers keep each step in the existing grounded-step contract.
 for(let i=0;i<20;i++){
  const x=-4-(i+.5)*.5,y=(i+1)*.25;
  const m=k.block([x,y/2,24],[.5,y,8],'floor',true,k.world.root,.012),c=k.envelopes.at(-1);
  const f={minX:x-.25,maxX:x+.25,minZ:20,maxZ:28,y,mesh:c.mesh,enabled:true};
  g.floors.push(f);k.world.floors.push(f);m.name='Service stair / closed riser '+i;
 }
 k.label('ВОЗВРАТ К НАЧАЛУ',[ -3.2,1.4,24],[1,0,0],7,.65);
 k.panel('light-source',[-10,5.75,-24],[-1,0,0],8,4.82);
 k.projector([-21,5.20,-24],[1,0,0],{radius:.85});k.support(-22,-24,4.1,.6);
 k.block([-15,2.8,-24],[10,.65,2.4],'dark');
 const shuttle=k.panel('light-shuttle',[-27.8,5.75,10],[1,0,0],8,4.82,k.world.root,true);
 // The panel, its four frame sections and its collision proxies share one pose.
 const passage=k.panel('travel-shuttle',[-10,1.6,0],[0,0,1],7.6,5.2,shuttle.group,true);
 const stage={target:0,z:10,previous:10,at:i=>Math.abs(stage.z-[10,-14][i])<.02};
 const update=dt=>{stage.previous=stage.z;stage.z+=THREE.MathUtils.clamp([10,-14][stage.target]-stage.z,-3*dt,3*dt);shuttle.group.position.z=stage.z;shuttle.sync(dt);passage.sync(dt);};
 k.ticks.unshift(update);k.resets.push(()=>{stage.target=0;stage.z=stage.previous=10;update(0);});
 k.renders.push(alpha=>{shuttle.group.position.z=THREE.MathUtils.lerp(stage.previous,stage.z,alpha);});
 for(const y of [2.7,8.8]){k.block([-28.3,y,3],[.5,.45,45],'metal');for(const z of [-18,14])k.block([-28.6,y,z],[.45,1.6,1.3],'dark');}
 const portal=k.panel('relay-return',[6.6,7.35,10],[1,0,0],8,5.2);
 // Its back is intentionally opaque and collidable, not an invisible one-way
 // rule. Walking around the narrow cabinet reveals its working face.
 k.block([6.2,7.5,10],[.55,6.2,9.2],'secondary');
 k.control('optical-selector',[.5,5,13.3],()=>{stage.target=1-stage.target;},'E — другой причал панели. Свет и портал следуют за ней.');
 k.control('service-selector',[0,0,20],()=>{stage.target=0;},'E — вернуть панель к первому причалу. Свет и порталы не сбрасываются.');
 const light=createLightBridge(k,{origin:[-20.98,5.20,-24],direction:[1,0,0],span:[0,0,1],width:4.8,length:110,name:'Relocatable optical causeway'});
 k.display([0,15,-26.4],()=>`ПАНЕЛЬ: ${stage.at(stage.target)?(stage.target?'ДАЛЬНИЙ ПРИЧАЛ':'БЛИЖНИЙ ПРИЧАЛ'):'В ДВИЖЕНИИ'}\n${light.segments.length>1?'СВЕТОВАЯ ДОРОГА СОЕДИНЕНА':'СВЕТ НЕ СОЕДИНЕН'} / ТВЁРДЫЕ ПЛОЩАДКИ НЕ ИСЧЕЗАЮТ`,24,2);
 k.label('07 / СМЕНА НАЗНАЧЕНИЯ',[0,18,-26.4],[0,0,1],24,1.1);
 k.rail(-3,13,0,20,5,'south');
 k.label('ПОСТОЯННЫЙ НАСТИЛ / ДРУГ МОЖЕТ ЖДАТЬ',[0,7,18.8],[0,0,1],9,.65);
 k.label('ОБХОД К ЛИЦЕВОЙ СТОРОНЕ',[3,6.4,5.3],[0,0,1],9,.6);
 k.label('СЛУЖЕБНЫЙ ВОЗВРАТ',[-16.8,2,-11],[1,0,0],9,.75);
 const l=finish(k,[-21,5,17],[-24,5.6,16],[14,5,-14],{stage,light,shuttle,relay:portal,introduces:[],routes:['cargo-with-you','scout-then-return','extinguish-and-return'],spawnView:{yaw:.3,pitch:-.06}},
  'Панель на рельсе переносит и свет, и тебя. Прежде чем менять её адрес, найди постоянную опору и осмотри обе стороны центрального шкафа.',
  {'light-source':'intercept the one projector when a bridge is needed','light-shuttle':'low optical window travels between two real docks','travel-shuttle':'upper pedestrian window on the same rail carriage','relay-return':'reachable only from the working side, found by walking around the cabinet'});
 const dispose=l.dispose;l.dispose=()=>{light.dispose();dispose();};return l;
}
export const SECOND_CHAPTER_BUILDERS=[buildFoundation6,buildFoundation7];
