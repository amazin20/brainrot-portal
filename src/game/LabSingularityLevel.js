import * as THREE from 'three';
import {SingularityKit,V,clamp} from './LabSingularityKit.js';
import {SINGULARITY_ROOMS,SINGULARITY_SPEC,validateSingularityLayout} from './LabSingularityLayout.js';
import {buildSingularityArt} from './LabSingularityArt.js';
import {tracePortalRay,rayTouches} from './LabPuzzleMechanics.js';
export {SINGULARITY_SPEC as TOWER_SPEC};
const UP=V(0,1,0);
const close=(p,q,r=1.25)=>Math.hypot(p.x-q[0],p.z-q[2])<r&&Math.abs(p.y-q[1])<1.5;
const dest=(s)=>s.toArray?.()??s;
export function pourVolumes(volumes,capacities,from,to){
 if(from===to||![from,to].every(i=>Number.isInteger(i)&&i>=0&&i<volumes.length))throw new RangeError('Invalid tank');
 const copy=[...volumes],amount=Math.max(0,Math.min(copy[from],capacities[to]-copy[to]));copy[from]-=amount;copy[to]+=amount;return copy;
}

/** A new level, not an extension of the old Tower's repeated recipe loop. */
export function buildTowerLevel(game,index=40){
 validateSingularityLayout();const k=new SingularityKit(game),m=k.m;
 const prior={background:game.scene.background,fog:game.scene.fog};
 game.scene.background=new THREE.Color(0x304656);game.scene.fog=new THREE.Fog(0x304656,110,330);
 const rooms=new Map(),machines=new Map(),events=[],solved=new Set(),gates=[],signs=[];
 let time=0,lastTransit=null,won=false,disposed=false;
 const point=(r,x,z=0,y=0)=>rooms.get(r).P(x,z,y);
 function complete(id,proof){if(solved.has(id))return;const r=SINGULARITY_ROOMS.find(r=>r.id===id);if(!r.requires.every(dep=>solved.has(dep)))return;
  solved.add(id);events.push({id,rule:r.rule,seconds:time,player:game.playerPosition.toArray(),cargo:game.cargo?.position.toArray(),proof});game.audio?.mechanism?.('switch');game.emitHud?.();}
 const available=id=>SINGULARITY_ROOMS.find(r=>r.id===id).requires.every(dep=>solved.has(dep));
 const standing=(p,r=1.2)=>game.playerGrounded&&close(game.playerPosition,p,r)&&Math.abs(game.playerPosition.y-p[1])<.3;
 const loaded=(p,r=1.15)=>!game.heldCube&&game.cargoOnPad?.(V(...p),r);
 function sign(text,p,width=7,normal=[0,0,1]){
  if(typeof document?.createElement!=='function')return null;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;
  const ctx=canvas.getContext('2d');if(!ctx)return null;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});k.materials.add(material);
  const mesh=k.mesh(k.geo(new THREE.PlaneGeometry(width,width*192/1024)),material,p,[1,1,1],{dynamic:true});mesh.quaternion.setFromUnitVectors(V(0,0,1),V(...normal));
  let previous='';const update=t=>{if(t===previous)return;previous=t;ctx.fillStyle='#1b303a';ctx.fillRect(0,0,1024,192);ctx.strokeStyle='#8cd9db';ctx.lineWidth=5;ctx.strokeRect(5,5,1014,182);ctx.font='bold 46px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f5eacb';ctx.fillText(t,512,96,980);texture.needsUpdate=true;};update(text);signs.push({texture,update});return {mesh,update};
 }
 function plate(p,size=2,color=m.copper){k.decor([p[0],p[1]+.028,p[2]],[size,.045,size],m.dark);return k.box([p[0],p[1]+.065,p[2]],[size-.2,.035,size-.2],color,{solid:false,dynamic:true});}
 function goal(id,p,predicate,proof){const lamp=plate(p,2.9);return dt=>{lamp.material=predicate()?m.live:m.idle;if(predicate()&&standing(p,1.3))complete(id,proof());};}
 function localControl(r,id,x,z,action,text,y=0){return k.control(`${r.def.id}:${id}`,r.P(x,z,y),()=>{if(!available(r.def.id))return false;return action();},text,m[r.def.color]);}
 function beam(){const meshes=Array.from({length:7},()=>k.drum([0,0,0],.025,1,m.lamp,{dynamic:true}));meshes.forEach(a=>a.visible=false);return segments=>meshes.forEach((a,i)=>{const s=segments[i];a.visible=!!s;if(!s)return;a.position.copy(s.a).add(s.b).multiplyScalar(.5);a.scale.set(.028,s.length,.028);a.quaternion.setFromUnitVectors(UP,s.direction);});}
 function base(r){return k.floor(r.b.x0,r.b.x1,r.b.z0,r.b.z1,r.def.at[1]);}
 function register(id,machine){machines.set(id,machine);return machine;}

 // A load-bearing building surrounds the whole connected complex. Ground
 // galleries span a real maintenance undercroft rather than floating in sky.
 k.floor(-118,118,-126,126,-16,m.dark);
 for(const x of [-118,118])k.box([x,39,0],[1.4,110,252],m.wall);
 for(const z of [-126,126])k.box([0,39,z],[236,110,1.4],m.wall);
 k.box([0,94,0],[237,1,253],m.dark);
 for(const x of [-112,-38,38,112])for(const z of [-118,-66,66,118]){
  k.box([x,38,z],[1.5,108,1.5],m.steel);k.decor([x+.8,38,z],[.09,90,.18],m.cyan);
 }
 k.floor(-8,8,-87,73,0);k.floor(-37,37,-7,7,0);
 const edges=[[[0,0,-77],[45,10,-77]],[[45,10,-77],[45,10,-95]],[[45,10,-95],[66,10,-95]],[[0,0,-40],[-43,0,-40]],[[0,0,-36],[43,0,-36]],[[0,0,37],[-65,0,37]],[[0,0,38],[64,0,38]],
  [[0,0,65],[-37,0,65]],[[-37,0,65],[-37,0,97]],[[-37,0,97],[-43,0,97]],
  [[0,0,65],[37,0,65]],[[37,0,65],[37,0,98]],[[37,0,98],[43,0,98]],
  [[-37,0,-40],[-37,0,37]],[[37,0,-36],[37,0,38]],
  [[0,0,-10],[20,0,-10]],[[20,0,-10],[20,14,-69]],[[20,14,-69],[29,14,-69]],[[29,14,-69],[29,14,-42]],[[29,14,-42],[9,14,-42]],
  [[29,14,-42],[75,27,-42]],[[75,27,-42],[75,27,-20]],[[75,27,-20],[18,27,-20]],[[18,27,-20],[18,27,10]],[[18,27,10],[25,27,10]],
  [[18,27,10],[18,34,36]],[[18,34,36],[-18,42,36]],[[-18,42,36],[-18,42,-18]],[[-18,42,-18],[0,42,-18]],[[0,42,-18],[0,42,-24]],
  [[-18,42,36],[-70,49,36]],[[-70,49,36],[-70,55,-20]],[[-70,55,-20],[-19,55,-20]],[[-19,55,-20],[-19,55,4]],[[-19,55,4],[-25,55,4]],
 ];
 edges.forEach(([a,b])=>k.corridor(a,b,5,{rails:a[1]>0&&a[1]===b[1]}));
 // Wide junction aprons prevent a staircase railing becoming a hidden gate.
 for(const p of [[45,10,-77],[45,10,-95],[20,0,-10],[20,14,-69],[29,14,-69],[29,14,-42],[75,27,-42],[75,27,-20],[18,27,-20],[18,27,10],[18,34,36],[-18,42,36],[-18,42,-18],[0,42,-18],[-70,49,36],[-70,55,-20],[-19,55,-20],[-19,55,4]])k.floor(p[0]-3.4,p[0]+3.4,p[2]-3.4,p[2]+3.4,p[1]);
 for(const def of SINGULARITY_ROOMS){
  const r=k.room(def);rooms.set(def.id,r);const n=def.entry==='e'?[1,0,0]:def.entry==='w'?[-1,0,0]:def.entry==='n'?[0,0,-1]:[0,0,1];
  sign(def.name,V(...r.door).add(V(0,4.4,0)).addScaledVector(V(...n),.32).toArray(),6.4,n);
  if(def.requires.length){const side=def.entry==='e'||def.entry==='w',parts=[-1,1].map(s=>k.box([r.door[0]+(side?0:s*1.6),r.door[1]+2.35,r.door[2]+(side?s*1.6:0)],side?[.44,4.7,3.2]:[3.2,4.7,.44],m.dark,{dynamic:true}));
   const marker=sign(def.requires.map(id=>SINGULARITY_ROOMS.find(r=>r.id===id).name).join(' + '),V(...r.door).add(V(0,3.4,0)).addScaledVector(V(...n),.36).toArray(),5.8,n);
   gates.push({id:def.id,r,parts,progress:0,side,marker});
  }
  // Foundations, not floating boxes: lower halls have visible concrete piers.
  if(def.at[1]===0)for(const sx of [-1,1])for(const sz of [-1,1])k.box([def.at[0]+sx*(def.w/2-2),-8,def.at[2]+sz*(def.d/2-2)],[2.4,16,2.4],m.wall);
 }

 // 1. Coupled azimuth rings: actual missing bridge segments, not colour keys.
 {
  const r=rooms.get('orrery'),{P}=r,y=r.def.at[1],a=[1,2,3],bridges=[],angles=[...a];
  k.floor(r.b.x0,r.b.x1,r.b.z0,r.def.at[2]-5,y);k.floor(r.b.x0,r.b.x1,r.def.at[2]+5,r.b.z1,y);
  k.floor(r.def.at[0]-23,r.def.at[0]-18,r.b.z0,r.b.z1,y);k.floor(r.def.at[0]+18,r.def.at[0]+23,r.b.z0,r.b.z1,y);
  for(let i=0;i<3;i++){
   const x=-12+i*12;k.ring(P(x,0,1.7),5.2,m[i===1?'copper':'violet'],{tube:.28});
   bridges.push(k.floor(r.def.at[0]+x-5.8,r.def.at[0]+x+5.8,r.def.at[2]-2,r.def.at[2]+2,y,m.ivory,{dynamic:true}));
   localControl(r,'orbit-'+i,-14+i*14,14,()=>{a[i]=(a[i]+1)%4;if(i<2)a[i+1]=(a[i+1]+1)%4;},`Повернуть орбиту ${i+1}; соседняя передача тоже сдвинется`);
  }
  for(const z of [-13,13])k.box(P(-18,z,8.5),[.5,17,16],m.wall);
  const telescope=k.drum(P(-20,-3.5,3),1.4,4.2,m.steel);k.ring(P(-20,-3.5,5.1),1.6,m.copper,{normal:[1,0,0],tube:.22});
  const finish=goal('orrery',P(-20,0),()=>a.every(v=>v%2===0),()=>({azimuths:[...a],crossed:true}));
  register('orrery',{state:{azimuths:a},update(dt){a.forEach((v,i)=>{angles[i]=THREE.MathUtils.damp(angles[i],v,8,dt);const b=bridges[i];b.rotation.y=angles[i]*Math.PI/2;b.updateWorldMatrix(true,false);const c=b.userData.collider;c.box.setFromObject(b);game.physics?.updateStaticBox(b.uuid,c.box,dt,true);const f=b.userData.floor;f.minX=c.box.min.x;f.maxX=c.box.max.x;f.minZ=c.box.min.z;f.maxZ=c.box.max.z;f.enabled=Math.abs(angles[i]-v)<.025;});finish(dt);},reset(){a.splice(0,3,1,2,3);angles.splice(0,3,1,2,3);}});
 }
 // 2. A true counterweight elevator; remove its source from a permanent ledge.
 {
  const r=rooms.get('drydock'),{P}=r;const baseDeck=base(r);let height=0,locked=false,liftUsed=false,armed=false;
  const pad=P(-11,-11),padVisual=plate(pad,3.4),lift=k.floor(...[r.def.at[0]-3,r.def.at[0]+3,r.def.at[2]-3,r.def.at[2]+3],0,m.ivory,{dynamic:true});
  k.floor(r.def.at[0]-18,r.def.at[0]+16.2,r.def.at[2]+6,r.def.at[2]+20,8,m.ivory);
  k.floor(r.def.at[0]+15.8,r.def.at[0]+19.8,r.def.at[2]+4.5,r.def.at[2]+7.2,8,m.ivory);
  k.corridor(P(0,0,8),P(0,8,8),6,{rails:false});
  k.stairs(P(18,21),P(18,6,8),3.2);
  for(const x of [-4,4])k.box(P(x,0,6.4),[.5,12.8,.5],m.steel);
  k.box(P(0,0,12.5),[9,.65,2],m.copper);
  const weight=k.box(P(-7,0,7),[2.1,3.1,2.1],m.steel,{dynamic:true,round:true});
  const floorPortal=k.panel('dock load intake',P(-11,-11,.035),[0,1,0],4,4);
  floorPortal.mesh.userData.portalBackingIds=[baseDeck.uuid];
  const receiving=k.panel('dock upper outlet',P(-12,17,10.4),[0,0,-1],4.8,4.8);
  localControl(r,'lift',1,0,()=>{if(!loaded(pad,1.5))return false;armed=!armed;return true;},'Пуск противовесной платформы');
  localControl(r,'pawl',-5,11,()=>{if(height>7.8&&game.playerPosition.y>7.6){locked=true;return true;}return false;},'Защёлкнуть верхний механический упор',8);
  register('drydock',{state:{get height(){return height;},get locked(){return locked;},pad,panels:{floorPortal,receiving}},
   update(dt){const load=loaded(pad,1.5);padVisual.material=load?m.live:m.idle;const target=(load&&armed)||locked?8:0;height+=clamp(target-height,-3*dt,3*dt);k.move(lift,P(0,0,height-.2),dt);k.move(weight,P(-7,0,10-height*.7),dt);
    if(standing(P(0,0,height),2)&&height>7.5)liftUsed=true;
    if(locked&&liftUsed&&!game.heldCube&&game.cargo.position.y>8.3&&game.cargo.position.y<10&&Math.abs(game.cargo.position.x-(r.def.at[0]-12))<3&&game.physics.grounded)complete('drydock',{liftUsed,locked,height,cargoTransfer:game.physics.portalTransports});},reset(){height=0;locked=liftUsed=armed=false;}});
 }
 // 3. The live ray is traced through geometry and portals, then reflected.
 {
  const r=rooms.get('optics'),{P}=r;base(r);let turned=false,angle=0,lit=0;const draw=beam();
  const intake=k.panel('quarry intake',P(-8,-5,2.4),[-1,0,0],5,4.8),outlet=k.panel('quarry output',P(17,5,2.4),[-1,0,0],5,4.8);
  k.box(P(-5,-8,4),[.55,8,16],m.steel);k.box(P(8,1,2.7),[10,5.4,.5],m.wall);
  const mirror=k.box(P(0,5,2.4),[2.8,3.1,.12],m.ivory,{solid:false,dynamic:true});
  k.box(P(0,5,.7),[.5,1.4,.5],m.copper);
  const receiver=k.ring(P(0,-12,2.4),1,m.copper,{normal:[0,0,1],dynamic:true});k.box(P(0,-12,1),[.4,2,.4],m.steel);
  localControl(r,'mirror',-17,9,()=>{turned=!turned;},'Развернуть отражатель');
  register('optics',{state:{get turned(){return turned;},get lit(){return lit;},intake,outlet},update(dt){angle=THREE.MathUtils.damp(angle,turned?1:0,9,dt);const normal=V(1,0,1-2*angle).normalize();mirror.quaternion.setFromUnitVectors(V(0,0,1),normal);
   const segments=tracePortalRay(game,V(...P(-26,-5,2.4)),V(1,0,0),{length:130,reflectors:[{position:V(...P(0,5,2.4)),normal,radius:1.4}]});draw(segments);
   const hit=segments.some(s=>s.kind==='portal')&&segments.some(s=>s.kind==='mirror')&&rayTouches(segments,V(...P(0,-12,2.4)),.8);lit=hit?lit+dt:0;receiver.material=hit?m.live:m.copper;if(lit>1)complete('optics',{portalReflection:true,exposure:lit});},reset(){turned=false;angle=lit=0;}});
 }
 // 4. Conserved fluid, three unequal vessels, physical bridge raised by head.
 {
  const r=rooms.get('reservoir'),{P}=r;
  k.floor(r.b.x0,r.b.x1,r.b.z0,r.def.at[2]+14,0);k.floor(r.b.x0,r.b.x1,r.def.at[2]+20,r.b.z1,0);
  const bridge=k.floor(r.def.at[0]-2.5,r.def.at[0]+2.5,r.def.at[2]+14,r.def.at[2]+20,-5,m.ivory,{dynamic:true});
  k.stairs(P(19,20,-5),P(19,23,0),3);
  const capacities=[8,5,3],volumes=[8,0,0];let flow=null,bridgeHeight=-5;
  const fills=[];for(let i=0;i<3;i++){
   const x=-14+i*14;k.drum(P(x,-10,capacities[i]/2),3,capacities[i],m.steel);fills.push(k.box(P(x,-6.94,volumes[i]/2+.1),[3.8,Math.max(.08,volumes[i]),.10],m.cyan,{solid:false,dynamic:true}));
   sign(String(capacities[i]),P(x,-6.85,9),2.5);
  }
  const buttons=[];for(const [j,[a,b]]of [[0,1],[1,2],[2,0],[0,2],[2,1],[1,0]].entries()){
   const x=-15+(j%3)*15,z=j<3?2:10;buttons.push(localControl(r,`${a}-${b}`,x,z,()=>{if(flow)return false;const target=pourVolumes(volumes,capacities,a,b);if(target.every((v,i)=>v===volumes[i]))return false;flow={a,b,target};return true;},`Перелить ${a+1} → ${b+1}`));
   sign(`${a+1} → ${b+1}`,P(x,z-.42,1.8),2.3);
  }
  const monitor=sign('8 / 0 / 0',P(0,-6.7,10.4),7);
  register('reservoir',{state:{volumes,capacities,buttons,get flowing(){return !!flow;}},update(dt){if(flow){const amount=Math.min(4*dt,volumes[flow.a]-flow.target[flow.a]);volumes[flow.a]-=amount;volumes[flow.b]+=amount;if(amount<1e-8)flow=null;}
   fills.forEach((f,i)=>{f.scale.y=Math.max(.08,volumes[i]);f.position.y=r.def.at[1]+Math.max(.08,volumes[i])/2+.1;});monitor?.update(volumes.map(v=>v.toFixed(1)).join(' / '));
   const balanced=!flow&&Math.abs(volumes[0]-4)<.01&&Math.abs(volumes[1]-4)<.01&&volumes[2]<.01;bridgeHeight=THREE.MathUtils.damp(bridgeHeight,balanced?0:-5,4,dt);k.move(bridge,P(0,17,bridgeHeight-.2),dt);
   if(balanced&&standing(P(0,22),1.4))complete('reservoir',{capacities,volumes:[...volumes],conserved:volumes.reduce((a,b)=>a+b,0)});},reset(){volumes.splice(0,3,8,0,0);flow=null;bridgeHeight=-5;}});
 }
 // 5. Spatial recording: a replay occupies a plate only along the real trace.
 {
  const r=rooms.get('echo'),{P}=r;base(r);let recording=false,replaying=false,recordTime=0,replayTime=0,overlap=0;const samples=[];
  const A=P(-19,-9),B=P(22,12),aVisual=plate(A,3.5),bVisual=plate(B,3.5);
  const mat=k.mat(0x92e7f1,.5,.1);mat.transparent=true;mat.opacity=.48;
  const ghost=k.mesh(k.geo(new THREE.CapsuleGeometry(.35,1.05,4,8)),mat,P(-19,-9,1),[1,1,1],{dynamic:true});ghost.visible=false;
  const lineGeometry=k.geo(new THREE.BufferGeometry()),line=new THREE.Line(lineGeometry,k.mat(0x81dce9,1,0,0,true));k.root.add(line);
  const input=k.panel('memory near',P(-26,-15,2.4),[1,0,0]),output=k.panel('memory far',P(27,12,2.4),[-1,0,0]);
  localControl(r,'record',-23,3,()=>{if(recording){recording=false;lineGeometry.setAttribute('position',new THREE.Float32BufferAttribute(samples.filter((_,i)=>i%8===0).flatMap(s=>[s.p[0],s.p[1]+.12,s.p[2]]),3));lineGeometry.computeBoundingSphere();line.visible=true;}
   else{recording=true;replaying=false;recordTime=0;samples.length=0;}},'Запись / остановка собственного маршрута');
  localControl(r,'replay',-20,5,()=>{if(samples.length<20||recording)return false;replaying=!replaying;replayTime=0;return true;},'Воспроизвести сохранённый путь');
  const monitor=sign('ЗАПИСЬ → ЭХО + ТЫ',P(0,-20,4),11);
  register('echo',{state:{A,B,input,output,get recording(){return recording;},get replaying(){return replaying;},get samples(){return samples.length;}},update(dt){
   if(recording){recordTime+=dt;if(samples.length===0||recordTime-samples.at(-1).t>1/30)samples.push({t:recordTime,p:game.playerPosition.toArray()});if(recordTime>35)recording=false;}
   ghost.visible=replaying&&samples.length>1;let active=false;
   if(ghost.visible){replayTime=(replayTime+dt)%samples.at(-1).t;const s=samples[Math.min(samples.length-1,Math.floor(replayTime*30))];ghost.position.fromArray(s.p).y+=.9;active=close(V(...s.p),A,1.55)&&Math.abs(s.p[1]-A[1])<.3;}
   aVisual.material=active?m.live:m.idle;bVisual.material=standing(B,1.55)?m.live:m.idle;overlap=active&&standing(B,1.55)?overlap+dt:0;
   monitor?.update(recording?'ЗАПИСЫВАЕТСЯ ТВОЁ ДВИЖЕНИЕ':replaying?'ЭХО И ТЫ ДОЛЖНЫ СОВПАСТЬ':'ЗАПИСЬ → ЭХО + ТЫ');if(overlap>1.1)complete('echo',{recordedSamples:samples.length,recordTime,simultaneousSeconds:overlap});},reset(){recording=replaying=false;recordTime=replayTime=overlap=0;samples.length=0;ghost.visible=false;line.visible=false;lineGeometry.setAttribute('position',new THREE.Float32BufferAttribute([],3));}});
 }
 // 6. Magnetic force carries the one real body around a solid shield.
 {
  const r=rooms.get('magnet'),{P}=r;base(r);let magnet=-1,passed=false;const targets=[P(-12,0,4.8),P(0,11,4.8),P(12,0,4.8)];
  k.box(P(0,0,3),[7,6,13],m.steel);k.box(P(0,0,6.2),[8,.4,14],m.copper);
  for(let i=0;i<3;i++){k.ring(targets[i],2,m[i===1?'copper':'cyan'],{normal:[1,0,0],tube:.24});k.box(P(-12+i*12,17,3),[.45,6,.45],m.steel);
   localControl(r,'coil-'+i,-14+i*14,-15,()=>{magnet=magnet===i?-1:i;},`Магнитная катушка ${i+1}`);}
  k.floor(r.def.at[0]+8,r.def.at[0]+18,r.def.at[2]-4,r.def.at[2]+4,4.2,m.ivory);
  k.stairs(P(18,17),P(18,3,4.2),3);
  const sender=P(-12,0);plate(sender,3.6);const receiver=P(12,0,4.2);plate(receiver,3.2);
  register('magnet',{state:{targets,sender,receiver,get magnet(){return magnet;},get passed(){return passed;}},update(){const b=game.cargo?.position;if(!b)return;if(!game.heldCube&&b.y>3.8&&b.z>r.def.at[2]+8&&Math.abs(b.x-r.def.at[0])<3)passed=true;
   if(passed&&loaded(receiver,1.7)){complete('magnet',{freeBodyDetour:true,magnet});magnet=-1;}},force(){const b=game.physics?.cargoBody;if(!b||game.heldCube||magnet<0)return;const target=targets[magnet];if(Math.hypot(b.position.x-r.def.at[0],b.position.z-r.def.at[2])>32)return;
   for(const axis of ['x','z'])b.force[axis]+=b.mass*clamp((target[axis==='x'?0:2]-b.position[axis])*9-b.velocity[axis]*7,-28,28);
   b.force.y+=b.mass*clamp(19.5+(target[1]-b.position.y)*12-b.velocity.y*8,0,70);b.wakeUp();},reset(){magnet=-1;passed=false;}});
 }
 // 7. Rotational energy and a ratio selector; braking consumes stored energy.
 {
  const r=rooms.get('transmission'),{P}=r;base(r);let omega=0,angle=0,ratio=0,clutch=false,brake=false,stable=0;
  const ratios=[.5,2/3,1.5],wheels=[k.gear(P(-8,-11,4),3.9,24,m.copper),k.gear(P(0,-11,4),2.6,16,m.ivory),k.gear(P(7,-11,4),3.2,20,m.cyan)];
  for(const x of [-8,0,7])k.box(P(x,-12,2),[.7,4,.7],m.steel);
  localControl(r,'crank',-11,5,()=>{omega=Math.min(15,omega+2);},'Вложить импульс в маховик');
  localControl(r,'ratio',0,7,()=>{ratio=(ratio+1)%3;},'Сдвинуть передаточную пару');
  localControl(r,'clutch',11,5,()=>{clutch=!clutch;},'Подключить / отключить нагрузку');
  localControl(r,'brake',0,15,()=>{brake=!brake;},'Тормоз маховика');
  const gauge=sign('ОТНОШЕНИЕ · СКОРОСТЬ',P(0,-8,10),12);
  register('transmission',{state:{get omega(){return omega;},get ratio(){return ratio;},get clutch(){return clutch;},get brake(){return brake;},get output(){return omega*ratios[ratio];}},
   update(dt){omega=Math.max(0,omega*Math.exp(-.009*dt)-(brake?2.2:clutch?.025:0)*dt);angle+=omega*dt;wheels[0].rotation.z=angle;wheels[1].rotation.z=-angle*ratios[ratio];wheels[2].rotation.z=angle*ratios[ratio]*.8;
    const output=omega*ratios[ratio];gauge?.update(`${['1:2','2:3','3:2'][ratio]}   ${output.toFixed(1)} / 5.5   ${clutch?'НАГРУЗКА':'ХОЛОСТОЙ'}`);
    stable=clutch&&!brake&&ratio===1&&output>4.9&&output<6.1?stable+dt:0;if(stable>2)complete('transmission',{ratio:ratios[ratio],output,stable,energy:omega*omega*12.5});},reset(){omega=angle=ratio=stable=0;clutch=brake=false;}});
 }
 // 8. A player-only capacitor makes the long U gallery insufficient on foot.
 {
  const r=rooms.get('accumulator'),{P}=r;base(r);let charge=0;const pad=P(-10,-13),end=P(11,12),visual=plate(pad,3.5);
  k.box(P(0,-2,4),[.6,8,29],m.wall);k.box(P(6,9,4),[12,8,.5],m.wall);
  const input=k.panel('capacitor shortcut input',P(-15,-11,2.4),[1,0,0]),output=k.panel('capacitor shortcut output',P(15,13,2.4),[-1,0,0]);
  const gauge=sign('ЗАРЯД',P(-8,-21,4),7);
  localControl(r,'discharge',11,14,()=>{if(charge>.18&&lastTransit?.id==='accumulator'){complete('accumulator',{remainingCharge:charge,portalShortcut:true});return true;}return false;},'Разрядить накопитель в удалённый контакт');
  register('accumulator',{state:{pad,end,input,output,get charge(){return charge;}},update(dt){charge=clamp(charge+(standing(pad,1.6)?dt*.75:-dt*.095),0,1);visual.material=charge>.9?m.live:m.idle;gauge?.update('ЗАРЯД '+Math.round(charge*100));},reset(){charge=0;}});
 }
 // 9. Two actual sliding walls permute a bent archive, with reversible controls.
 {
  const r=rooms.get('archive'),{P}=r;base(r);let A=false,B=false,ta=0,tb=0;
  const a=k.box(P(3,0,4.7),[.6,9.4,21],m.rose,{dynamic:true});const b=k.box(P(-10,-3,4.7),[17,9.4,.6],m.steel,{dynamic:true});
  k.box(P(-4,11,4.7),[19,9.4,.6],m.wall);k.box(P(-17,4,4.7),[.5,9.4,14],m.wall);
  localControl(r,'slide-a',14,9,()=>{A=!A;},'Сдвинуть восточный архив');
  localControl(r,'slide-b',-7,-11,()=>{B=!B;},'Перенести поперечную секцию');
  const finish=goal('archive',P(-15,7),()=>A&&B,()=>({eastMoved:A,crossMoved:B}));
  register('archive',{state:{get A(){return A;},get B(){return B;}},update(dt){ta=THREE.MathUtils.damp(ta,A?1:0,3,dt);tb=THREE.MathUtils.damp(tb,B?1:0,3,dt);k.move(a,P(3,ta*15,4.7),dt);k.move(b,P(-10-tb*9,-3,4.7),dt);finish(dt);},reset(){A=B=false;ta=tb=0;}});
 }
 // 10. A portal belongs to its rail carriage and follows the physical surface.
 {
  const r=rooms.get('migrant'),{P}=r;let target=0,travel=0;
  k.floor(r.b.x0,r.def.at[0]-4,r.b.z0,r.b.z1,27);k.floor(r.def.at[0]+7,r.b.x1,r.b.z0,r.b.z1,30);
  const platform=k.floor(r.def.at[0]-9,r.def.at[0]-3,r.def.at[2]-4,r.def.at[2]+4,30,m.ivory,{dynamic:true});
  const moving=k.panel('rail-mounted exit',P(-6,0,5.4),[-1,0,0],4.8,4.8,{moving:true});const intake=k.panel('fixed return',P(-14,12,2.4),[1,0,0]);
  k.box(P(1,-8,4.5),[.6,9,28],m.steel);k.decor(P(0,0,10),[30,.4,.5],m.copper);
  localControl(r,'rail',-12,-13,()=>{target=target?0:1;},'Отправить каретку на другую сторону экрана');
  const finish=goal('migrant',P(12,10,3),()=>travel>.98&&lastTransit?.id==='migrant',()=>({travel,transportedOnMovingExit:true}));
  register('migrant',{state:{moving,intake,get travel(){return travel;}},update(dt){travel+=clamp(target-travel,-.16*dt,.16*dt);const x=-6+travel*17;k.move(platform,P(x,0,2.8),dt);moving.move(P(x,0,5.4),dt);finish(dt);},reset(){target=travel=0;}});
 }
 // The parallax lock is solved by an actual camera ray crossing all three
 // displaced physical apertures. A lever state alone never opens the lock.
 {
  const r=rooms.get('parallax'),{P}=r;base(r);let nearIndex=0,middleIndex=0,exposure=0;
  const choices=[[-3.5,0,3.5],[4,0,-4]],centres=[-3.5,4,0],xs=[-8,2,13],frames=[];
  const pad=P(-18,0);const padLight=plate(pad,3.2,m.rose);
  for(let i=0;i<3;i++){
   const parts=[];for(const z of [-1.9,1.9])parts.push({mesh:k.box(P(xs[i],centres[i]+z,2.4),[.65,4.8,.4],m[['copper','cyan','rose'][i]],{dynamic:true,round:true}),z,y:2.4});
   parts.push({mesh:k.box(P(xs[i],centres[i],4.8),[.65,.4,4.2],m[['copper','cyan','rose'][i]],{dynamic:true,round:true}),z:0,y:4.8});
   k.decor(P(xs[i],0,5.6),[1,.22,33],m.steel);
   frames.push(parts);
  }
  localControl(r,'near',-14,-12,()=>{nearIndex=(nearIndex+1)%3;},'Передвинуть ближнюю рамку');
  localControl(r,'middle',7,12,()=>{middleIndex=(middleIndex+1)%3;},'Передвинуть среднюю рамку');
  const target=sign('СОВМЕСТИ ПРОСВЕТЫ',P(19,0,3),8,[-1,0,0]);
  const light=k.box(P(19,0,2.4),[.1,.8,.8],m.rose,{solid:false,dynamic:true});
  register('parallax',{state:{pad,target:P(19,0,2.4),get alignedSeconds(){return exposure;}},update(dt){
   centres[0]=THREE.MathUtils.damp(centres[0],choices[0][nearIndex],5,dt);centres[1]=THREE.MathUtils.damp(centres[1],choices[1][middleIndex],5,dt);
   frames.forEach((parts,i)=>parts.forEach(p=>k.move(p.mesh,P(xs[i],centres[i]+p.z,p.y),dt)));
   const eye=game.camera.position,direction=game.camera.getWorldDirection(V());
   const through=standing(pad,1.35)&&direction.x>.2&&xs.every((x,i)=>{
    const t=(r.def.at[0]+x-eye.x)/direction.x;if(t<=0)return false;
    const y=eye.y+t*direction.y,z=eye.z+t*direction.z;
    return Math.abs(z-(r.def.at[2]+centres[i]))<1.45&&y>r.def.at[1]+.25&&y<r.def.at[1]+4.55;
   });
   exposure=through?exposure+dt:0;padLight.material=through?m.live:m.rose;light.material=through?m.live:m.rose;
   if(exposure>1.1)complete('parallax',{cameraRayThroughThreePhysicalWindows:true,exposure,offsets:[...centres]});
  },reset(){nearIndex=middleIndex=0;centres.splice(0,3,-3.5,4,0);exposure=0;}});
 }
 // 11. Fall momentum, not a launch flag. The gap is crossed in free flight.
 {
  const r=rooms.get('inertia'),{P}=r;let flew=false,entryCount=0,maxSpeed=0;
  k.floor(r.b.x0,r.def.at[0]+23,r.def.at[2]+7,r.b.z1,42);k.floor(r.def.at[0]+27,r.b.x1,r.def.at[2]+7,r.b.z1,42);k.floor(r.def.at[0]+23,r.def.at[0]+27,r.def.at[2]+13,r.b.z1,42);k.floor(r.b.x0,r.def.at[0]-20,r.b.z0,r.b.z1,42);
  k.floor(r.def.at[0]-20,r.def.at[0]-3.5,r.b.z0,r.def.at[2]-2,42);
  k.floor(r.def.at[0]+1.5,r.def.at[0]+5,r.b.z0,r.def.at[2]-2,42);
  k.floor(r.def.at[0]-3.5,r.def.at[0]+1.5,r.b.z0,r.def.at[2]-11.5,42);
  k.floor(r.def.at[0]-3.5,r.def.at[0]+1.5,r.def.at[2]-6.5,r.def.at[2]-2,42);
  // Intake floor is the only collision skin under its aperture.
  const intake=k.panel('gravity well floor',P(-1,-9,.02),[0,1,0],5,5);
  k.floor(r.def.at[0]-3.5,r.def.at[0]+1.5,r.def.at[2]-11.5,r.def.at[2]-6.5,42);
  const intakeFloor=k.floors.at(-1);intake.mesh.userData.portalBackingIds=[intakeFloor.mesh.uuid];
  const outlet=k.panel('horizontal launch',P(-17,0,9.4),[1,0,0]);
  k.floor(r.def.at[0]+6,r.def.at[0]+28,r.def.at[2]-3,r.def.at[2]+4,38.5,m.ivory);
  k.stairs(P(25,4,-3.5),P(25,13,0),4);
  k.stairs(P(-27,10),P(-27,-14,12),4);
  k.corridor(P(-27,-14,12),P(-1,-14,12),4,{rails:true});k.floor(r.def.at[0]-3,r.def.at[0]+1,r.def.at[2]-14,r.def.at[2]-11.1,54,m.ivory);
  const finish=goal('inertia',P(21,0,-3.5),()=>flew&&maxSpeed>15,()=>({maxSpeed,portalEntries:entryCount,landed:true}));
  register('inertia',{state:{intake,outlet,get flew(){return flew;},get maxSpeed(){return maxSpeed;}},transit(){entryCount++;maxSpeed=Math.max(maxSpeed,game.playerVelocity.length());},update(dt){if(!game.playerGrounded&&lastTransit?.id==='inertia'){maxSpeed=Math.max(maxSpeed,game.playerVelocity.length());if(game.playerPosition.x>r.def.at[0]+2)flew=true;}finish(dt);},reset(){flew=false;entryCount=maxSpeed=0;}});
 }
 // 12. A directional field lifts the unheld player; the upper gallery retains height.
 {
  const r=rooms.get('inversion'),{P}=r;base(r);let up=false,rose=false;
  const shaft=P(0,0);k.floor(r.def.at[0]-15,r.def.at[0]+15,r.def.at[2]+7,r.def.at[2]+17,69,m.ivory);
  k.corridor(P(10,10,14),P(17,0,14),4,{rails:false});
  for(const x of [-4,4])for(const z of [-4,4])k.box(P(x,z,9),[.5,18,.5],m.steel);
  for(const y of [1,5,9,13,17])k.ring(P(0,0,y),5,m.violet,{tube:.13});
  const disc=plate(shaft,6,m.violet);localControl(r,'polarity',10,-12,()=>{up=!up;},'Изменить полярность вертикального поля');
  const finish=goal('inversion',P(9,12,14),()=>rose,()=>({fieldAscent:true,permanentUpperGallery:true}));
  register('inversion',{state:{shaft,get up(){return up;},get rose(){return rose;}},acceleration(p,v){if(up&&Math.abs(p.x-shaft[0])<5&&Math.abs(p.z-shaft[2])<6&&p.y>55.2&&p.y<72)return V(clamp((shaft[0]-p.x)*2-v.x*.4,-5,5),31,0);return V();},update(dt){disc.material=up?m.live:m.violet;if(up&&!game.playerGrounded&&game.playerPosition.y>68&&close(game.playerPosition,P(0,0,14),6))rose=true;finish(dt);},reset(){up=rose=false;}});
 }
 // The crown is the destination of the entire connected machine, not a
 // thirteenth copy of a wing. Retrieve the original companion before arrival.
 k.floor(-14,14,-14,14,72,m.ivory);
 k.floor(-4,4,-14,-7,73.6,m.ivory);k.stairs([0,73.6,-7],[0,72,-1],5);
 const crownPortal=k.panel('crown receiver',[0,76,-12],[0,0,1],6,5.4);
 k.floor(6,17,7,16,0);
 const basePortal=k.panel('reactor base',[12,2.4,10],[-1,0,0],5,4.8);
 const upperPortal=k.panel('inversion upper return',point('inversion',12,15,16.4),[0,0,-1],5,4.8);
 const upperRest=point('inversion',12,10,14);plate(upperRest,3.5,m.copper);
 for(const dx of [-1.8,1.8])k.box([upperRest[0]+dx,upperRest[1]+.09,upperRest[2]],[.12,.18,3.7],m.copper);
 for(const y of [74,80,86])k.ring([0,y,0],11,m[y===80?'copper':'cyan'],{tube:.22});
 for(const x of [-12,12])for(const z of [-12,12])k.box([x,45,z],[.7,90,.7],m.steel);
 const core=k.drum([0,80,0],2.5,3.2,m.cyan,{dynamic:true});
 const crownSign=sign('ВСЕ ЛИНИИ ДОЛЖНЫ ПИТАТЬ ВЕРШИНУ',[0,76,11.7],15,[0,0,-1]);
 const spawn=V(0,0,12),cargoSpawn=V(2,.57,12);
 function roomAt(p){return SINGULARITY_ROOMS.find(r=>Math.abs(p.x-r.at[0])<r.w/2+.8&&Math.abs(p.z-r.at[2])<r.d/2+.8&&p.y>r.at[1]-7&&p.y<r.at[1]+r.h+1);}
 function update(dt){
  time+=dt;
  for(const [id,mechanism]of machines)if(available(id))mechanism.update?.(dt);
  for(const g of gates){const open=available(g.id);g.progress=THREE.MathUtils.damp(g.progress,open?1:0,5,dt);g.parts.forEach((mesh,i)=>{const s=i?1:-1;const p=[g.r.door[0]+(g.side?0:s*(1.6+3.5*g.progress)),g.r.door[1]+2.35,g.r.door[2]+(g.side?s*(1.6+3.5*g.progress):0)];k.move(mesh,p,dt);});}
  core.rotation.y=time*.22;core.rotation.z=Math.sin(time*.4)*.06;
  crownSign?.update(solved.size===SINGULARITY_ROOMS.length?'ЯДРО ГОТОВО · ВЕРНИТЕСЬ ВДВОЁМ':'ВЕРШИНА ЖДЁТ ОСТАВШИЕСЯ ЛИНИИ');
  if(solved.size===SINGULARITY_ROOMS.length&&standing([0,72,5],3)&&game.cargo&&Math.abs(game.cargo.position.y-72)<2&&game.cargo.position.distanceTo(game.playerPosition)<3.4)won=true;
 }
 function reset(){time=0;solved.clear();events.length=0;lastTransit=null;won=false;for(const machine of machines.values())machine.reset?.();gates.forEach(g=>{g.progress=0;});update(0);}
 const art=buildSingularityArt({game,k,rooms,edges,solved});
 k.batch();
 const level={id:SINGULARITY_SPEC.id,index,game,spec:SINGULARITY_SPEC,title:'41 / '+SINGULARITY_SPEC.title,
  singularity:true,tower:true,towerChallenge:true,contextHandlesCarry:true,momentum:true,viewDistance:360,spawn,cargoSpawn,spawnView:{yaw:0,pitch:-.12},
  launchPad:null,terminals:k.terminals,pads:[],gates:[],panels:{crownPortal,basePortal,upperPortal},rooms,machines,edges,structure:k.root,
  get completedStages(){return solved.size;},totalStages:SINGULARITY_ROOMS.length,get progress(){return solved.size;},getLaunch:()=>null,reset,update,isWon:()=>won,
  getTowerMetrics:()=>({id:SINGULARITY_SPEC.id,completedStages:solved.size,totalStages:SINGULARITY_ROOMS.length,solvedIds:[...solved],events:events.map(e=>({...e})),checkpoints:false,seconds:time,won}),
  getObjective(){const room=roomAt(game.playerPosition);if(room)return solved.has(room.id)?`${room.name} · МЕХАНИЗМ РАБОТАЕТ`:room.name;return game.playerPosition.y>68?'ВЕРШИНА · ВЕРНУТЬСЯ ВДВОЁМ':'МАШИННЫЙ СОБОР · ВЫБЕРИ СВОЙ МАРШРУТ';},
  getContextLesson(){const room=roomAt(game.playerPosition);return ['singularity','E · ЛКМ · ПКМ',room?available(room.id)?room.hint:'Питание приходит из залов: '+room.requires.map(id=>SINGULARITY_ROOMS.find(r=>r.id===id).name).join(', '):'Девять самостоятельных залов доступны в любом порядке. Верхние проходы связаны с разными механизмами. Падение и перезапуск обнуляют всю попытку.',false];},
  nearbyInteraction(){const t=k.nearest();return t?{kind:t.kind,label:'E',text:t.lesson}:null;},
  interact(){const t=k.nearest();if(!t)return false;const result=t.action();if(result===false)return false;game.audio?.mechanism?.('switch');game.animator?.triggerOperate?.();return true;},
  cargoOnAnyPad:()=>loaded(upperRest,1.6)||['drydock','magnet'].some(id=>{const r=roomAt(game.cargo?.position??V());return r?.id===id;}),
  playerAcceleration(p,v){return machines.get('inversion').acceleration(p,v);},applyCargoForces(){machines.get('magnet').force();},
  onTeleport(event){const r=roomAt(game.playerPosition);lastTransit={id:r?.id??'atrium',seconds:time};if(r?.id==='inertia')machines.get('inertia').transit();return true;},
  renderUpdate(){art.update();},diagnostics(){return {...this.getTowerMetrics(),uniqueRules:SINGULARITY_ROOMS.map(r=>r.rule),rooms:SINGULARITY_ROOMS.length,portalSurfaces:k.panels.length};},
  dispose(){if(disposed)return;disposed=true;art.dispose();signs.forEach(s=>s.texture.dispose());k.dispose();game.scene.background=prior.background;game.scene.fog=prior.fog;},
 };
 return level;
}
