import * as THREE from 'three';
import {OpenChamber} from './LabOpenArchitecture.js';
import {addSky,applyDeckFinish,reinforceDeck,sign} from './LabOpenStationArt.js';
const V=(...v)=>new THREE.Vector3(...v),Q=()=>new THREE.Quaternion();
export const HYDRAULIC_SPEC={id:'open-communicating-lifts',title:'Гидравлический собор',concept:'Один запас воды меняет высоты двух площадей. Высота портального выхода важнее цвета.',description:'Два подъёмника делят один запас воды. Меняй высоту соединения, а не ищи кнопку включения.',accent:0x62e6d1,assets:[1,2,11,22,23,24],hints:['Два нижних отверстия выравнивают уровни: обе платформы встречаются с центральной галереей.','Высокий сухой выход принимает воду, пока низкий источник остаётся затопленным. Так почти весь запас можно перенести в одну башню.','Разрыв портальной связи сохраняет воду там, где она находится. Переноси друга на той платформе, которую собираешься поднять.']};

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

function glazedLift(k,x,name){
 const car=k.carrier(name,[[x,0,-12],[x,12,-12]],{width:16,depth:16,portal:false});
 const glass=new THREE.MeshStandardMaterial({name:'Hydraulic inspection glazing',color:0x6ad6cc,roughness:.16,transparent:true,opacity:.20,depthWrite:false});
 const waterMat=new THREE.MeshStandardMaterial({name:'Contained hydraulic fluid',color:0x1fbcb4,roughness:.18,metalness:.08,transparent:true,opacity:.68,depthWrite:false});
 const water=k.game.box(x,-1,-4,13.4,1,13.4,waterMat,{parent:k.world.root,solid:false,camera:false,aim:false});water.name='Conserved hydraulic fluid / '+name;water.castShadow=false;
 const walls=[];
 for(const [dx,dz,w,d]of [[-6.85,0,.18,13.7],[6.85,0,.18,13.7],[0,-6.85,13.7,.18],[0,6.85,13.7,.18]]){
  const m=k.game.box(x+dx,-1,-4+dz,w,1,d,glass,{parent:k.world.root,solid:false,camera:false,aim:false});
  m.castShadow=false;const c=k.game.collisionProxy(new THREE.Box3().setFromObject(m),{kinematic:true});walls.push({m,c});
 }
 for(const dx of [-18,18])k.column(x+dx,-24,-2,23,.55);
 k.block([x,22,-24],[37,1.0,1.2],'shell');
 k.block([x,-2.7,-4],[17,1.3,17],'dark');
 const sync=(dt=0)=>{const h=Math.max(.3,car.position.y+1.3),y=-1.9+h/2;water.position.y=y;water.scale.y=Math.max(.04,car.position.y+1.2);for(const {m,c}of walls){m.position.y=y;m.scale.y=h;k.game.syncCollision(c,new THREE.Box3().setFromObject(m),dt);}};
 k.ticks.push(sync);k.renders.push(()=>{const h=Math.max(.3,car.group.position.y+1.3),y=-1.9+h/2;water.position.y=y;water.scale.y=Math.max(.04,car.group.position.y+1.2);for(const {m}of walls){m.position.y=y;m.scale.y=h;}});
 return car;
}

export function buildOpenHydraulics(game,index=27){
 const k=new OpenChamber(game,HYDRAULIC_SPEC,index,'tidal');k.bounds={minX:-64,maxX:64,minZ:-46,maxZ:52};addSky(k);
 k.deck('Dry recovery foundation',-62,62,-44,50,-2,{color:'dark'});
 k.deck('Southeast entry square',16,52,20,44,0);
 k.deck('Lower boarding pier',20,36,4,20,0);
 k.deck('Equal-head transverse gallery',-20,20,-4,4,6);
 k.deck('Central observation square',-12,12,4,28,6);
 k.deck('Western upper destination',-58,-36,-12,12,12);
 k.ramp('Wide dry return',40,50,4,20,-2,0);
 const a=glazedLift(k,-28,'west-reservoir'),b=glazedLift(k,28,'east-reservoir'),tides=new CommunicatingLifts();
 const ports=[];
 for(const [i,x]of [[0,-8],[1,8]])for(const [kind,y]of [['low',2.85],['high',14.85]]){
  const panel=k.panel((i?'east':'west')+'-'+kind,[x,y,-30],[0,0,1],8,5.8);ports.push({basin:i,panel,kind});
  k.block([x,y,-30.6],[9.6,7,.8],'shell');
  // Feed connections are behind the panel; they cannot occlude its aperture.
  const basinX=i?28:-28;
  k.geometry(new THREE.CylinderGeometry(.50,.50,Math.abs(basinX-x),24),'metal',[(basinX+x)/2,y,-32],Q().setFromAxisAngle(V(0,0,1),Math.PI/2),{solid:true,name:'Hydraulic manifold cross pipe'});
  k.geometry(new THREE.CylinderGeometry(.50,.50,18,24),'shell',[basinX,y,-23],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{solid:true,name:'Reservoir feed pipe'});
 }
 // Closed return risers join both ports to each reservoir rather than ending
 // above empty air. Flanged joints remain behind the walking and aiming lanes.
 for(const x of [-28,28]){
  k.geometry(new THREE.CylinderGeometry(.5,.5,16.4,24),'shell',[x,6.65,-14],Q(),{solid:true,name:'Continuous reservoir riser'});
  for(const y of [-1.2,2.85,8.5,14.85]){
   k.geometry(new THREE.CylinderGeometry(.8,.8,.20,24),'metal',[x,y,-14],Q(),{solid:true,name:'Bolted hydraulic flange'});
   for(let i=0;i<8;i++){const a=i*Math.PI/4;k.geometry(new THREE.CylinderGeometry(.075,.075,.08,6),'dark',[x+Math.cos(a)*.66,y+.15,-14+Math.sin(a)*.66],Q(),{name:'Flange bolt'});}
  }
  k.block([x,-1.1,-14],[2.2,1.8,2.2],'dark');
 }
 // A tall but open manifold gantry gives every aperture a permanent support.
 for(const x of [-14,0,14])k.column(x,-31,-2,20,.7);
 k.block([0,19.1,-31],[30,1.4,2.0],'secondary');
 sign(k,'HEAD EXCHANGE',[0,19.12,-29.98],[0,0,1],12,1.0);
 const endpoint=p=>{if(!p)return null;const spec=ports.find(e=>e.panel.mesh.uuid===p.surfaceId);if(!spec)return null;
  const right=V(1,0,0).applyQuaternion(p.quaternion),up=V(0,1,0).applyQuaternion(p.quaternion);
  return{basin:spec.basin,sill:Math.max(0,p.position.y-Math.hypot(right.y*p.width,up.y*p.height))};};
 k.ticks.unshift(dt=>{const ends=game.portals.portals.map(endpoint);tides.step(dt,ends.length===2&&ends.every(Boolean)?ends:null);[a,b].forEach((f,i)=>{f.stations[1].y=tides.levels[i];f.target=1;f.speed=14;});});
 k.resets.push(()=>{tides.reset();for(const [i,f]of [a,b].entries()){f.stations[0].y=f.stations[1].y=tides.levels[i];f.reset();}});
 for(const d of k.decks.filter(d=>d.y>=6))reinforceDeck(k,d,{legs:false});
 for(const x of [-56,56])for(const z of [-38,40])k.column(x,z,-2,30,1.15);
 for(const z of [-38,40])k.block([0,29.1,z],[114,1.7,2.2],'shell');
 for(const x of [-56,56]){k.block([x,29.1,1],[2.2,1.7,80],'shell');k.ring([x,17.5,-20],11,.8,1.4,Q().setFromAxisAngle(V(0,1,0),Math.PI/2));for(const z of [-29,-11])k.column(x,z,-2,11.5,.7);}
 k.ring([0,23,-38],15,1.0,2.0);for(const x of [-13,13])k.column(x,-38,-2,16,.75);
 applyDeckFinish(k);
 const l=k.finishOpen([30,0,32],[24,.6,27],[-48,12,0],{floats:[a,b],tides,ports,spawnView:{yaw:.05,pitch:-.21}});
 l.puzzleGeometry={orders:['equal-head','full-east'],goalHeight:12,noProgressFlags:true,fluidCapacity:12};return l;
}
