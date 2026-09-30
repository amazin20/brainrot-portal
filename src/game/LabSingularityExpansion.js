import * as THREE from 'three';
import {V,clamp} from './LabSingularityKit.js';
import {tracePortalRay,rayTouches} from './LabPuzzleMechanics.js';

/** These are physical duct connections, rather than a preselected combination.
 * Either branch, or the longer path through both, can feed the receiver. */
export function traceManifoldRoute(valves){
 const outputs=[['vent','b','c'],['vent','c','sink'],['vent','sink','b']];
 if(valves.length!==3||valves.some(v=>!Number.isInteger(v)||v<0||v>2))throw new RangeError('Invalid duct orientation');
 const path=['feed','a'],seen=new Set();let node='a';
 while(!['vent','sink'].includes(node)){
  if(seen.has(node))return {path,terminal:'cycle',powered:false};
  seen.add(node);node=outputs['abc'.indexOf(node)][valves['abc'.indexOf(node)]];path.push(node);
 }
 return {path,terminal:node,powered:node==='sink'};
}

/** A damped lever has an actual moment from the traveller's position. The
 * weight on the short arm can raise the deck; moving outward reverses it. */
export function integrateFulcrum(state,{occupied=false,leverArm=0,armed=false,locked=false},dt){
 if(!(dt>0)||locked)return;
 const torque=armed&&occupied?5-0.4*leverArm:-4;
 state.velocity+=((torque-.3*state.travel)-3.1*state.velocity)*dt;
 state.velocity=clamp(state.velocity,-.44,.44);state.travel=clamp(state.travel+state.velocity*dt,0,1);
 if(state.travel===0&&state.velocity<0||state.travel===1&&state.velocity>0)state.velocity=0;
 state.torque=torque;
}

/** Three independent west annexes. Every raised support and shutter is moved
 * through the construction kit, preserving player and cargo collision. */
export function buildSingularityExpansion({game,k,rooms,complete,standing,localControl,sign,plate,goal,base,register,edges}){
 const m=k.m,UP=V(0,1,0);
 const annexEdges=[[[0,0,-77],[-126,0,-77]],[[-126,0,-77],[-126,0,128]],[[-126,0,128],[37,0,128]],[[37,0,128],[37,0,65]]];
 for(const id of ['manifold','eclipse','fulcrum'])annexEdges.push([[-126,0,rooms.get(id).door[2]],rooms.get(id).door]);
 for(const edge of annexEdges){edges.push(edge);k.corridor(...edge,5,{rails:false});}
 for(const p of [[-126,0,-77],[-126,0,128],[37,0,128]])k.floor(p[0]-3.4,p[0]+3.4,p[2]-3.4,p[2]+3.4,p[1]);

 // The airflow tree can be rebuilt in more than one valid topology. The
 // visible pipes are the same connections that the route solver follows.
 {
  const r=rooms.get('manifold'),{P}=r;base(r);const valves=[0,0,0];let pressure=0,gateTravel=0;
  const nodes={feed:P(21,-11,4),a:P(12,-11,4),b:P(0,-11,4),c:P(-7,3,4),vent:P(10,11,4),sink:P(-21,-11,4)};
  const paths=[['feed','a'],['a','vent'],['a','b'],['a','c'],['b','vent'],['b','c'],['b','sink'],['c','vent'],['c','sink'],['c','b']];
  const pipePairs=new Set();const pipes=paths.filter(([a,b])=>{const key=[a,b].sort().join(':');if(pipePairs.has(key))return false;pipePairs.add(key);return true;}).map(([a,b])=>{
   const from=V(...nodes[a]),to=V(...nodes[b]),mesh=k.drum(from.clone().add(to).multiplyScalar(.5).toArray(),.18,from.distanceTo(to),m.steel,{solid:false,dynamic:true});
   mesh.quaternion.setFromUnitVectors(UP,to.clone().sub(from).normalize());return {a,b,mesh};
  });
  const selectors=[];for(let i=0;i<3;i++){
   const id='abc'[i],p=nodes[id];k.box([p[0],1.1,p[2]],[1,2.2,1],m.dark,{round:true});
   selectors.push(k.gear(p,1.2,12,m.mint));
   localControl(r,'duct-'+id,[-1,10,-6][i],[7,7,13][i],()=>{valves[i]=(valves[i]+1)%3;},'Повернуть тройник '+id.toUpperCase()+'; проследи открытый канал');
   sign(id.toUpperCase(),[p[0],p[1]+1.6,p[2]],1.8);
  }
  // The receiver bay is physically enclosed, with one pressure-operated door.
  for(const [z,d]of [[-7,32],[18,10]])k.box(P(-17,z,5.2),[.6,10.4,d],m.wall);
  k.box(P(-17,12,8),[.6,5.4,8],m.wall);
  const gate=k.box(P(-17,12,2.6),[.58,5.2,7.5],m.mint,{dynamic:true,round:true});
  const receiver=k.gear(P(-21,-11,4),2.3,18,m.copper),fan=k.gear(P(21,-11,4),2.1,15,m.mint);
  const gauge=sign('ПОТОК УХОДИТ В СБРОС',P(7,-21,6.8),12);
  const finish=goal('manifold',P(-21,12),()=>pressure>.9,()=>({ducts:[...valves],route:traceManifoldRoute(valves).path,pressure}));
  register('manifold',{state:{valves,get pressure(){return pressure;},get route(){return traceManifoldRoute(valves);}},update(dt){
   const route=traceManifoldRoute(valves);pressure=THREE.MathUtils.damp(pressure,route.powered?1:0,2.4,dt);
   gateTravel=THREE.MathUtils.damp(gateTravel,pressure>.9?1:0,4,dt);k.move(gate,P(-17,12+gateTravel*8,2.6),dt);
   pipes.forEach(p=>{const flowing=route.path.some((node,i)=>node===p.a&&route.path[i+1]===p.b||node===p.b&&route.path[i+1]===p.a);p.mesh.material=flowing?m.live:m.steel;});
   selectors.forEach((selector,i)=>selector.rotation.z=THREE.MathUtils.damp(selector.rotation.z,valves[i]*Math.PI*2/3,6,dt));
   receiver.rotation.z+=pressure*dt*4;fan.rotation.z+=dt*3;
   gauge?.update(route.powered?'ТУРБИНА ПИТАЕТСЯ · '+Math.round(pressure*100)+'%':route.terminal==='cycle'?'ЗАМКНУТЫЙ КРУГ · ВЫХОДА НЕТ':'ПОТОК УХОДИТ В СБРОС');finish(dt);
  },reset(){valves.splice(0,3,0,0,0);pressure=gateTravel=0;selectors.forEach(selector=>selector.rotation.z=0);receiver.rotation.z=fan.rotation.z=0;}});
 }

 // This lock asks for darkness, not a reflected beam. Two solid screens must
 // extinguish the outer receivers without eclipsing the central witness.
 {
  const r=rooms.get('eclipse'),{P}=r;let first=0,second=4,bridgeHeight=-5,shadowSeconds=0;
  k.floor(r.def.at[0]-10,r.b.x1,r.b.z0,r.b.z1,0);k.floor(r.b.x0,r.def.at[0]-19,r.b.z0,r.b.z1,0);
  const bridge=k.floor(r.def.at[0]-19,r.def.at[0]-10,r.def.at[2]-2,r.def.at[2]+2,-5,m.ivory,{dynamic:true});
  const positions=[-14,-7,0,7,14],screenZ=[-14,14];
  const screens=[7,-6].map((x,i)=>k.box(P(x,screenZ[i],2.5),[.6,5,3.6],m.dark,{dynamic:true,round:true}));
  for(const x of [7,-6]){
   k.box(P(x,0,6),[.65,.3,41],m.steel);
   for(const z of [-20,20])k.box(P(x,z,3),[.42,6,.42],m.steel);
  }
  localControl(r,'screen-a',14,18,()=>{first=(first+1)%5;},'Передвинуть ближний теневой экран');
  localControl(r,'screen-b',-3,18,()=>{second=(second+1)%5;},'Передвинуть дальний теневой экран');
  const receivers=[-7,0,7].map((z,i)=>{
   k.box(P(-23,z,2),[.4,4,.4],m.steel);
   const disc=k.ring(P(-22.6,z,3.2),.6,m[i===1?'mint':'rose'],{normal:[1,0,0],tube:.09,solid:false,dynamic:true});
   // Source lamps hang from the ceiling, leaving the actual entry axis clear.
   k.box(P(22,z,7.4),[.32,8,.32],m.steel);k.box(P(22,z,3.2),[.45,.35,.45],m.copper,{round:true});
   return {target:V(...P(-22.6,z,3.2)),disc};
  });
  const beams=Array.from({length:3},()=>Array.from({length:4},()=>k.drum([0,0,0],.025,1,m.lamp,{solid:false,dynamic:true})));
  const monitor=sign('ТЕНЬ · СВЕТ · ТЕНЬ',P(14,-22,5.8),11);
  const finish=goal('eclipse',P(-22,0),()=>shadowSeconds>.75&&bridgeHeight>-.1,()=>({screenPositions:[...screenZ],twoPhysicalShadows:true,witnessLit:true,shadowSeconds}));
  const panels={input:k.panel('eclipse east return',P(23,18,2.4),[-1,0,0]),output:k.panel('eclipse west return',P(-23,18,2.4),[1,0,0])};
  register('eclipse',{state:{panels,get first(){return first;},get second(){return second;},get shadowSeconds(){return shadowSeconds;},get bridgeHeight(){return bridgeHeight;}},update(dt){
   screenZ[0]=THREE.MathUtils.damp(screenZ[0],positions[first],5,dt);screenZ[1]=THREE.MathUtils.damp(screenZ[1],positions[second],5,dt);
   screens.forEach((screen,i)=>k.move(screen,P(i===0?7:-6,screenZ[i],2.5),dt));
   const lit=receivers.map((receiver,i)=>{
    const z=[-7,0,7][i],segments=tracePortalRay(game,V(...P(21.7,z,3.2)),V(-1,0,0),{length:45});
    beams[i].forEach((mesh,j)=>{const s=segments[j];mesh.visible=!!s;if(!s)return;mesh.position.copy(s.a).add(s.b).multiplyScalar(.5);mesh.scale.set(.025,s.length,.025);mesh.quaternion.setFromUnitVectors(UP,s.direction);});
    const illuminated=rayTouches(segments,receiver.target,.35);receiver.disc.material=illuminated?m.live:m.rose;return illuminated;
   });
   const correct=!lit[0]&&lit[1]&&!lit[2];shadowSeconds=correct?shadowSeconds+dt:0;
   const target=shadowSeconds>.75?0:-5;bridgeHeight+=clamp(target-bridgeHeight,-2.2*dt,2.2*dt);k.move(bridge,P(-14.5,0,bridgeHeight-.2),dt);
   monitor?.update(lit.map(v=>v?'СВЕТ':'ТЕНЬ').join(' · '));finish(dt);
  },reset(){first=0;second=4;screenZ.splice(0,2,-14,14);bridgeHeight=-5;shadowSeconds=0;}});
 }

 // One long lever deck, one coupled counterweight, and the traveller's real
 // changing distance from the pivot. There is no cargo pad or timed recipe.
 {
  const r=rooms.get('fulcrum'),{P}=r;const motion={travel:0,velocity:0,torque:0};let armed=false,locked=false,rode=false,maxArm=0,minArm=Infinity;
  // The moving deck has its own skin; a coincident fixed floor would shimmer
  // at the lower stop and hide the actual moving support from the traveller.
  k.floor(r.b.x0,r.b.x1,r.b.z0,r.def.at[2]-3,0);k.floor(r.b.x0,r.b.x1,r.def.at[2]+3,r.b.z1,0);
  k.floor(r.b.x0,r.def.at[0]-18,r.def.at[2]-3,r.def.at[2]+3,0);k.floor(r.def.at[0]+3,r.b.x1,r.def.at[2]-3,r.def.at[2]+3,0);
  const deck=k.floor(r.def.at[0]-18,r.def.at[0]+3,r.def.at[2]-3,r.def.at[2]+3,0,m.ivory,{dynamic:true});
  const counter=k.box(P(-22,0,12),[2.2,3.2,3.2],m.copper,{dynamic:true,round:true});
  for(const x of [-20,4])for(const z of [-4,4])k.box(P(x,z,6.5),[.5,13,.5],m.steel);
  k.box(P(-8,0,14),[31,.6,8],m.copper);
  const wheels=[-20,4].map(x=>k.gear(P(x,-4,12),1.9,16,m.copper));
  const link=k.drum(P(-22,0,8),.10,12,m.steel,{solid:false,dynamic:true});
  k.floor(r.def.at[0]+3,r.def.at[0]+15,r.def.at[2]-6,r.def.at[2]+6,8,m.ivory);
  for(const z of [-6,6])k.box(P(9,z,8.55),[12,1.1,.2],m.steel);
  localControl(r,'clutch',1,5,()=>{armed=!armed;return true;},'Зацепить / освободить тягу коромысла');
  // The clamp hangs over the inner arm, so the traveller can keep applying
  // the lifting moment while reaching it. A control on the fixed gallery
  // would make the deck fall away as soon as the traveller tried to clamp it.
  localControl(r,'brake',0,2,()=>{if(motion.travel<.97)return false;locked=!locked;return true;},'Зафиксировать / отпустить верхний механический упор',8);
  const meter=sign('ПЛЕЧО МЕНЯЕТ МОМЕНТ СИЛЫ',P(-9,-21,6),13);
  const finish=goal('fulcrum',P(13,0,8),()=>locked&&rode,()=>({rodeRealDeck:rode,height:motion.travel*8,leverArmRange:[minArm,maxArm],mechanicalBrake:locked}));
  register('fulcrum',{state:{get travel(){return motion.travel;},get velocity(){return motion.velocity;},get torque(){return motion.torque;},get armed(){return armed;},get locked(){return locked;},get rode(){return rode;}},update(dt){
   const p=game.playerPosition,occupied=standing(P(-7.5,0,motion.travel*8),11)&&Math.abs(p.z-r.def.at[2])<2.8&&p.x<r.def.at[0]+3.01&&p.x>r.def.at[0]-18.01;
   const arm=Math.max(.1,r.def.at[0]+3-p.x);
   if(occupied&&armed){maxArm=Math.max(maxArm,arm);minArm=Math.min(minArm,arm);if(motion.travel>.75)rode=true;}
   integrateFulcrum(motion,{occupied,leverArm:arm,armed,locked},dt);
   k.move(deck,P(-7.5,0,motion.travel*8-.2),dt);k.move(counter,P(-22,0,12-motion.travel*8),dt);
   wheels.forEach(w=>w.rotation.z=-motion.travel*Math.PI*2);link.position.y=r.def.at[1]+10-motion.travel*4;link.scale.y=4+motion.travel*8;
   meter?.update(locked?'ВЕРХНИЙ УПОР ЗАФИКСИРОВАН':occupied?`ПЛЕЧО ${arm.toFixed(1)} · МОМЕНТ ${motion.torque.toFixed(1)}`:'КОРОМЫСЛО ЖДЁТ НАГРУЗКУ');finish(dt);
  },reset(){motion.travel=motion.velocity=motion.torque=0;armed=locked=rode=false;maxArm=0;minArm=Infinity;}});
 }
}
