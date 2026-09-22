import * as THREE from 'three';
import {OpenChamber} from './LabOpenArchitecture.js';
import {applyDeckFinish,reinforceDeck,sign} from './LabOpenStationArt.js';
import {encloseLab,labInstrument} from './LabHumanLab.js';
const V=(...v)=>new THREE.Vector3(...v),Q=()=>new THREE.Quaternion();
export const HYDRAULIC_SPEC={id:'open-communicating-lifts',title:'Сообщающиеся камеры',concept:'Один запас воды меняет высоты двух площадей. Высота портального выхода важнее цвета.',description:'Выход над левым резервуаром. Оба настила стоят на воде: соедини белые отверстия и посмотри, куда она потечёт.',accent:0x62e6d1,assets:[1,2,11,22,23,24],hints:['Два нижних отверстия выравнивают уровни: обе платформы встречаются с центральной галереей.','Высокий сухой выход принимает воду, пока низкий источник остаётся затопленным. Так почти весь запас можно перенести в одну башню.','Разрыв портальной связи сохраняет воду там, где она находится. Переноси друга на той платформе, которую собираешься поднять.']};

/** Exact integration of q = coefficient * sqrt(h1 - h2), split at the instant
 * a dry receiving aperture submerges. Equal plan areas, constant displaced mass. */
export class CommunicatingLifts{
 constructor(capacity=12){if(!Number.isFinite(capacity)||capacity<=0)throw new RangeError('Positive finite capacity required');this.capacity=capacity;this.reset();}
 reset(){this.levels=[this.capacity,0];this.flow=0;this.transferred=0;}
 step(dt,ends=null){
  if(!Number.isFinite(dt)||dt<0)throw new RangeError('Finite nonnegative dt required');
  if(ends!==null&&(!Array.isArray(ends)||ends.length!==2||ends.some(e=>!e||!Number.isInteger(e.basin)||e.basin<0||e.basin>1||!Number.isFinite(e.sill)||e.sill<0)))throw new RangeError('Invalid hydraulic endpoints');
  this.flow=0;if(!dt||!ends||ends[0].basin===ends[1].basin)return;
  let remaining=dt,moved=0;
  for(let phase=0;phase<4&&remaining>1e-10;phase++){
   const [a,b]=ends,difference=Math.max(0,this.levels[a.basin]-a.sill)-Math.max(0,this.levels[b.basin]-b.sill);
   if(Math.abs(difference)<1e-10)break;
   const source=difference>0?a:b,target=difference>0?b:a,head=Math.abs(difference),dry=Math.max(0,target.sill-this.levels[target.basin]);
   const mult=dry>1e-10?1:2,root=Math.sqrt(head),after=Math.max(0,root-.23*mult*remaining);
   const amount=Math.min((head-after*after)/mult,dry>1e-10?dry:Infinity,this.capacity-this.levels[target.basin]);
   if(amount<1e-12)break;
   const elapsed=2*(root-Math.sqrt(Math.max(0,head-mult*amount)))/(.46*mult);
   this.levels[source.basin]-=amount;this.levels[target.basin]+=amount;this.transferred+=amount;moved+=(difference>0?1:-1)*amount;remaining-=elapsed;
  }
  this.flow=moved/dt;
 }
}

/** Explain the physical reason, including experiments that do not transfer water.
 * Portal colour and prescribed route order do not determine this feedback. */
export function hydraulicConnectionText(levels,ends,flowToEast=0){
 if(!ends?.[0]||!ends?.[1])return 'НЕТ СОЕДИНЕНИЯ';
 if(ends[0].basin===ends[1].basin)return 'ОБА ОТВЕРСТИЯ В РЕЗЕРВУАРЕ '+(ends[0].basin?'Б':'А');
 const heads=ends.map(e=>Math.max(0,levels[e.basin]-e.sill));
 if(Math.abs(flowToEast)<.005){
  if(Math.max(...heads)<.001)return 'ВОДА НИЖЕ ОБОИХ ОТВЕРСТИЙ';
  if(Math.abs(heads[0]-heads[1])<.025)return 'ДАВЛЕНИЕ У ОТВЕРСТИЙ ВЫРОВНЕНО';
  return 'ПОТОК ЗАМЕДЛЯЕТСЯ';
 }
 return flowToEast>0?'ВОДА: А → Б':'ВОДА: Б → А';
}

function glazedLift(k,x,name){
 const car=k.carrier(name,[[x,0,-12],[x,8,-12]],{width:12,depth:12,portal:false});
 const glass=new THREE.MeshStandardMaterial({name:'Hydraulic inspection glazing',color:0x6ad6cc,roughness:.16,transparent:true,opacity:.16,depthWrite:false});
 const waterMat=new THREE.MeshStandardMaterial({name:'Contained hydraulic fluid',color:0x1fbcb4,roughness:.22,metalness:.06,transparent:true,opacity:.72,depthWrite:false});
 const water=k.game.box(x,-1,-6,10.4,1,10.4,waterMat,{parent:k.world.root,solid:false,camera:false,aim:false});water.name='Conserved hydraulic fluid / '+name;water.castShadow=false;
 const walls=[];
 for(const [dx,dz,w,d]of [[-5.35,0,.18,10.7],[5.35,0,.18,10.7],[0,-5.35,10.7,.18],[0,5.35,10.7,.18]]){
  const m=k.game.box(x+dx,-1,-6+dz,w,1,d,glass,{parent:k.world.root,solid:false,camera:false,aim:false});m.castShadow=false;
  const c=k.game.collisionProxy(new THREE.Box3().setFromObject(m),{kinematic:true});walls.push({m,c});
 }
 k.block([x,-2.65,-6],[13,1.3,13],'dark');
 const sync=(dt=0)=>{const h=Math.max(.3,car.position.y+1.3),y=-1.9+h/2;water.position.y=y;water.scale.y=Math.max(.04,car.position.y+1.2);for(const {m,c}of walls){m.position.y=y;m.scale.y=h;k.game.syncCollision(c,new THREE.Box3().setFromObject(m),dt);}};
 k.ticks.push(sync);k.renders.push(()=>{const h=Math.max(.3,car.group.position.y+1.3),y=-1.9+h/2;water.position.y=y;water.scale.y=Math.max(.04,car.group.position.y+1.2);for(const {m}of walls){m.position.y=y;m.scale.y=h;}});
 return car;
}

export function buildOpenHydraulics(game,index=27){
 const k=new OpenChamber(game,HYDRAULIC_SPEC,index,'tidal');
 k.bounds={minX:-30,maxX:30,minZ:-25,maxZ:22};k.ceiling=18;
 encloseLab(k,{base:-2,roof:18});
 k.deck('Service floor and recovery loop',-29,29,-24,21,-2,{color:'dark'});
 k.deck('Entry observation landing',8,26,0,18,0);
 k.deck('Equal-head crossing',-8,8,-8,0,4);
 k.deck('Central observation landing',-8,8,0,8,4);
 k.deck('Western upper exit',-29,-20,-10,2,8);
 k.ramp('Dry return from the service floor',21,29,0,16,-2,0);
 const a=glazedLift(k,-14,'west-reservoir'),b=glazedLift(k,14,'east-reservoir'),tides=new CommunicatingLifts(8),ports=[];
 for(const [i,x]of [[0,-5],[1,5]])for(const [kind,y]of [['low',2.85],['high',10.85]]){
  const panel=k.panel((i?'east':'west')+'-'+kind,[x,y,-18],[0,0,1],8,5.8);ports.push({basin:i,panel,kind});
  k.block([x,y,-18.7],[9.2,7,.8],'shell');
  sign(k,`${i?'Б':'А'} / ${kind==='low'?'НИЖНЕЕ':'ВЕРХНЕЕ'} СОЕДИНЕНИЕ`,[x,y+3.13,-17.84],[0,0,1],7.6,.42);
  const basinX=i?14:-14;
  k.geometry(new THREE.CylinderGeometry(.32,.32,Math.abs(basinX-x),16),'metal',[(basinX+x)/2,y,-20],Q().setFromAxisAngle(V(0,0,1),Math.PI/2),{solid:true,name:'Reservoir feed manifold'});
  k.geometry(new THREE.CylinderGeometry(.32,.32,5,16),'shell',[basinX,y,-17.5],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{solid:true,name:'Continuous reservoir connection'});
 }
 for(const x of [-14,14]){
  k.geometry(new THREE.CylinderGeometry(.32,.32,12.2,16),'shell',[x,4.8,-15],Q(),{solid:true,name:'Reservoir riser'});
  for(const y of [-1,2.85,7,10.85])k.geometry(new THREE.CylinderGeometry(.55,.55,.18,16),'metal',[x,y,-15],Q(),{solid:true,name:'Pipe flange'});
  k.block([x,-1.25,-15],[1.6,1.5,1.6],'dark');
 }
 for(const x of [-10,0,10])k.column(x,-20,-2,15,.55);
 k.block([0,14.8,-20],[22,1.2,1.5],'secondary');
 const endpoint=p=>{if(!p)return null;const spec=ports.find(e=>e.panel.mesh.uuid===p.surfaceId);if(!spec)return null;
  const right=V(1,0,0).applyQuaternion(p.quaternion),up=V(0,1,0).applyQuaternion(p.quaternion);
  return{basin:spec.basin,sill:Math.max(0,p.position.y-Math.hypot(right.y*p.width,up.y*p.height))};};
 let connected=false,flowToEast=0,latestEnds=[null,null];
 k.ticks.unshift(dt=>{const ends=game.portals.portals.map(endpoint);latestEnds=ends;connected=ends.length===2&&ends.every(Boolean)&&ends[0].basin!==ends[1].basin;
  tides.step(dt,connected?ends:null);flowToEast=connected?tides.flow*(ends[0].basin===0?1:-1):0;[a,b].forEach((f,i)=>{f.stations[1].y=tides.levels[i];f.target=1;f.speed=14;});});
 k.resets.push(()=>{tides.reset();for(const [i,f]of [a,b].entries()){f.stations[0].y=f.stations[1].y=tides.levels[i];f.reset();}});
 for(const d of k.decks.filter(d=>d.y>=4))reinforceDeck(k,d,{legs:false});
 const stateText=()=>hydraulicConnectionText(tides.levels,latestEnds,flowToEast);
 const status=labInstrument(k,[0,15,-18.98],{width:20,height:2,read:()=>stateText()+'\nБЕЛЫЕ ОТВЕРСТИЯ СОЕДИНЯЮТСЯ ПОРТАЛАМИ'});
 k.block([0,13.2,.3],[54,.55,.6],'dark');for(const x of [-26,26])k.column(x,.3,-2,13.5,.45);
 for(const x of [-14,14])k.block([x,11.8,.50],[10.3,2.3,.24],'dark',false);
 for(const [i,x]of [[0,-14],[1,14]])labInstrument(k,[x,11.8,.65],{width:10,height:2,read:()=>`${i?'Б':'А'} / НАСТИЛ ${tides.levels[i].toFixed(1)} м\n${i?'ОБЩИЙ ЗАПАС ВОДЫ':'ВЫХОД НА ВЫСОТЕ 8 м'}`});
 // Physical height marks make the change readable even with tutorials disabled.
 for(const x of [-21,21]){k.block([x,3.7,-11.8],[.3,11,.5],'dark');for(const y of [0,4,8])k.block([x,y,-11.45],[1.1,.12,.18],'white',false);}
 sign(k,'СЛУЖЕБНЫЙ ОБХОД →',[18,.9,17.8],[0,0,-1],12,1.0);
 applyDeckFinish(k);
 const l=k.finishOpen([16,0,12],[12,.6,10],[-24,8,-4],{floats:[a,b],tides,ports,hydraulicStatus:status,spawnView:{yaw:.12,pitch:-.12}});
 l.getObjective=()=>`${stateText()}. А: ${tides.levels[0].toFixed(1)} м; Б: ${tides.levels[1].toFixed(1)} м. Выход слева на 8 м.`;
 l.getContextLesson=()=>!connected?['hydraulic-cause','ЛКМ / ПКМ','Оба настила стоят на воде. Белые отверстия соединены с резервуарами трубами: поставь два портала и наблюдай за уровнем воды.',false]:null;
 l.puzzleGeometry={orders:['equal-head','full-east'],goalHeight:8,noProgressFlags:true,fluidCapacity:8,footprint:60*47,comparisonFootprint:128*98};return l;
}
