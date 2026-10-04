import * as THREE from 'three';
import {SingularityKit,V,clamp} from './LabSingularityKit.js';
import {SINGULARITY_ROOMS,SINGULARITY_SPEC,validateSingularityLayout} from './LabSingularityLayout.js';
import {buildSingularityArt} from './LabSingularityArt.js';
import {tracePortalRay,rayTouches} from './LabPuzzleMechanics.js';
export {SINGULARITY_SPEC as TOWER_SPEC};
const UP=V(0,1,0),close=(p,q,r=1.25)=>Math.hypot(p.x-q[0],p.z-q[2])<r&&Math.abs(p.y-q[1])<1.5;
export function pourVolumes(volumes,capacities,from,to){if(from===to||![from,to].every(i=>Number.isInteger(i)&&i>=0&&i<volumes.length))throw new RangeError('Invalid tank');const copy=[...volumes],amount=Math.max(0,Math.min(copy[from],capacities[to]-copy[to]));copy[from]-=amount;copy[to]+=amount;return copy;}

/** The folded castle is a complete replacement of the old sixteen halls.
 * Solids, real supported decks and ordinary portals own every transition. */
export function buildTowerLevel(game,index=40){
 validateSingularityLayout();const k=new SingularityKit(game),m=k.m;
 k.root.name='FOLDED CASTLE / five interlaced storeys';
 const prior={background:game.scene.background,fog:game.scene.fog};
 game.scene.background=new THREE.Color(0x222c38);game.scene.fog=new THREE.Fog(0x222c38,95,225);
 const fill=new THREE.HemisphereLight(0xd5e9ed,0x52404e,.85);game.scene.add(fill);
 const sideFill=new THREE.DirectionalLight(0xffd9b4,1.4);sideFill.position.set(-55,98,32);sideFill.target.position.set(0,30,0);game.scene.add(sideFill,sideFill.target);
 const rooms=new Map(),machines=new Map(),events=[],solved=new Set(),gates=[],signs=[],carriedTransits=new Map();
 let time=0,lastTransit=null,won=false,resetting=false,disposed=false;
 const glazing=k.mat(0x8eaead,.65,.05);glazing.transparent=true;glazing.opacity=.24;glazing.depthWrite=false;glazing.name='Castle fixed safety glazing';
 const available=id=>SINGULARITY_ROOMS.find(r=>r.id===id).requires.every(dep=>solved.has(dep));
 function complete(id,proof){if(resetting||solved.has(id)||!available(id))return;const r=SINGULARITY_ROOMS.find(r=>r.id===id);solved.add(id);events.push({id,rule:r.rule,seconds:time,player:game.playerPosition.toArray(),cargo:game.cargo?.position.toArray(),proof});game.audio?.mechanism?.('switch');game.emitHud?.();}
 const standing=(p,r=1.2)=>game.playerGrounded&&close(game.playerPosition,p,r)&&Math.abs(game.playerPosition.y-p[1])<.3;
 const loaded=(p,r=1.15)=>!game.heldCube&&game.cargoOnPad?.(V(...p),r);
 function sign(text,p,width=7,normal=[0,0,1],rows=1){
  if(typeof globalThis.document?.createElement!=='function')return null;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=rows>1?rows*96:192;const ctx=canvas.getContext('2d');if(!ctx)return null;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.anisotropy=Math.min(8,game.renderer?.capabilities?.getMaxAnisotropy?.()??4);
  const material=new THREE.MeshBasicMaterial({map:texture});k.materials.add(material);k.textures.push(texture);
  const mesh=k.mesh(k.geo(new THREE.PlaneGeometry(width,width*canvas.height/1024)),material,p,[1,1,1],{dynamic:true});mesh.quaternion.setFromUnitVectors(V(0,0,1),V(...normal));
  let previous='';const update=t=>{if(t===previous)return;previous=t;ctx.fillStyle='#22303b';ctx.fillRect(0,0,1024,canvas.height);ctx.fillStyle='#f5e5cb';ctx.font=`bold ${rows>1?32:36}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';const lines=t.split('\n');lines.forEach((line,i)=>ctx.fillText(line,512,(i+.5)*canvas.height/lines.length,970));texture.needsUpdate=true;};update(text);signs.push({update});return{mesh,update};
 }
 function plate(p,size=2,color=m.copper){k.decor([p[0],p[1]+.028,p[2]],[size,.045,size],m.dark);return k.box([p[0],p[1]+.065,p[2]],[size-.2,.035,size-.2],color,{solid:false,dynamic:true});}
 function goal(id,p,predicate,proof){const lamp=plate(p,2.9);return dt=>{const ready=predicate();lamp.material=ready?m.live:m.idle;if(ready&&standing(p,1.3))complete(id,proof());};}
 function localControl(r,id,x,z,action,text,y=0){return k.control(`${r.def.id}:${id}`,r.P(x,z,y),()=>available(r.def.id)?action():false,text,m[r.def.color]);}
 function beam(){const meshes=Array.from({length:7},()=>k.drum([0,0,0],.025,1,m.lamp,{dynamic:true}));meshes.forEach(a=>a.visible=false);return segments=>meshes.forEach((a,i)=>{const s=segments[i];a.visible=!!s;if(!s)return;a.position.copy(s.a).add(s.b).multiplyScalar(.5);a.scale.set(.028,s.length,.028);a.quaternion.setFromUnitVectors(UP,s.direction);});}
 const base=r=>k.floor(r.b.x0,r.b.x1,r.b.z0,r.b.z1,r.def.at[1]);
 const register=(id,machine)=>{machines.set(id,machine);return machine;};

 // One sealed exterior and a low service void. All high decks are joined to
 // its ribs and columns; the exposed atrium is inside the building.
 k.floor(-83,83,-73,73,-14,m.dark);
 for(const x of [-83,83])k.box([x,43,0],[1.2,114,146],m.wall);
 for(const z of [-73,73])k.box([0,43,z],[166,114,1.2],m.wall);
 k.box([0,100,0],[167,.8,147],m.dark);
 for(const x of [-77,-19,19,77])for(const z of [-67,-10,10,67])k.box([x,42,z],[1.25,112,1.25],m.steel);
 // A staircase changes side and travel direction at every storey. Horizontal
 // galleries have deliberate turns and look over the lower rooms.
 const edges=[];
 function edge(a,b,w=5,rails=false){edges.push([a,b]);k.corridor(a,b,w,{rails});}
 for(const y of [0,18,36,54,72]){
  const left=-6,right=14;
  edge([left,y,39],[right,y,39],6);edge([left,y,-61],[right,y,-61],6);
  if(y===0||y===36){edge([left,y,39],[left,y,-35],6);edge([left,y,-61],[left,y,-52],6);}
  else if(y===18||y===54){edge([left,y,39],[left,y,18],6);edge([left,y,-61],[left,y,-52],6);edge([left,y,18],[0,y,18],6);}
  else edge([left,y,39],[left,y,-61],6);
  if(y===36||y===72){edge([right,y,-61],[right,y,-13],6);edge([right,y,39],[right,y,57],6);edge([0,y,-13],[right,y,-13],6);}
  else edge([right,y,39],[right,y,-61],6);
  edge([0,y,39],[0,y,-61],6);
  edge([0,y,39],[0,y,57],6);if(y!==18&&y!==54)edge([14,y,39],[14,y,57],6);edge([0,y,57],[14,y,57],6);
  edge([0,y,-61],[0,y,-52],6);edge([0,y,-52],[left,y,-52],6);
  // Genuine cross-storey supports, out of the walkable envelope.
  for(const z of [-61,39])k.box([(left+right)/2,y-.78,z],[right-left+1,.8,.65],m.dark);
 }
 edge([0,0,54],[0,0,39],6,false);
 edge([-6,0,-52],[-6,18,18],6,false);
 edge([14,18,57],[14,36,-13],6,false);
 edge([-14,36,-52],[-6,36,-52],6,false);
 edge([-6,36,-52],[-6,54,18],6,false);
 edge([14,54,57],[14,72,-13],6,false);
 // Common landings prevent stair lips or rail ends becoming hidden blockers.
 for(const p of edges.flat())k.floor(p[0]-3.1,p[0]+3.1,p[2]-3.1,p[2]+3.1,p[1]);
 function shell(def){
  const[x,y,z]=def.at,{w,d,h}=def,b={x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2};
  const door=def.entry==='e'?[b.x1,y,z]:def.entry==='w'?[b.x0,y,z]:[x,y,b.z1];
  for(const side of ['n','s','w','e']){
   const vertical=side==='w'||side==='e',length=vertical?d:w,fixed=side==='w'?b.x0:side==='e'?b.x1:side==='n'?b.z0:b.z1;
   if(def.id==='archive'&&(side==='s'||side==='w')){
    const centre=side==='s'?3:-3,opening=.6;
    for(const[a,c]of [[-length/2,centre-opening],[centre+opening,length/2]])k.box(vertical?[fixed,y+h/2,z+(a+c)/2]:[x+(a+c)/2,y+h/2,fixed],vertical?[.5,h,c-a]:[c-a,h,.5],m.wall);
    k.box(vertical?[fixed,y+(h+9.7)/2,z+centre]:[x+centre,y+(h+9.7)/2,fixed],vertical?[.5,h-9.7,1.2]:[1.2,h-9.7,.5],m.wall);
   }else if(side===def.entry){
    for(const[a,c]of [[-length/2,-3.4],[3.4,length/2]])k.box(vertical?[fixed,y+h/2,z+(a+c)/2]:[x+(a+c)/2,y+h/2,fixed],vertical?[.5,h,c-a]:[c-a,h,.5],m.wall);
    if(def.upperDoor){k.box(vertical?[fixed,y+11.5,z]:[x,y+11.5,fixed],vertical?[.5,13,6.8]:[6.8,13,.5],m.wall);k.box(vertical?[fixed,y+25,z]:[x,y+25,fixed],vertical?[.5,4,6.8]:[6.8,4,.5],m.wall);}
    else k.box(vertical?[fixed,y+(h+5)/2,z]:[x,y+(h+5)/2,fixed],vertical?[.5,h-5,6.8]:[6.8,h-5,.5],m.wall);
   }else{
    // High horizontal apertures reveal adjacent galleries. Their sill is far
    // above an ordinary jump and their real piers retain the wall structure.
    k.box(vertical?[fixed,y+3.4,z]:[x,y+3.4,fixed],vertical?[.5,6.8,length]:[length,6.8,.5],m.wall);
    k.box(vertical?[fixed,y+(h+10)/2,z]:[x,y+(h+10)/2,fixed],vertical?[.5,h-10,length]:[length,h-10,.5],m.wall);
    for(const s of [-1,1])k.box(vertical?[fixed,y+8.4,z+s*(length/2-1)]:[x+s*(length/2-1),y+8.4,fixed],vertical?[.5,3.2,2]:[2,3.2,.5],m.steel);
    // This visibly framed, fixed glazing preserves views through the high
    // band without turning a fall from another gallery into a puzzle bypass.
    const pane=k.box(vertical?[fixed,y+8.4,z]:[x,y+8.4,fixed],vertical?[.12,3.2,length-4]:[length-4,3.2,.12],glazing);pane.name='Castle fixed glazed viewing band';
    for(const dy of [6.85,9.95])k.box(vertical?[fixed,y+dy,z]:[x,y+dy,fixed],vertical?[.22,.10,length-4]:[length-4,.10,.22],m.steel);
   }
  }
  k.box([x,y+h+.25,z],[w+.7,.5,d+.7],m.dark);
  const r={def,b,door,P:(a,c=0,dy=0)=>[x+a,y+dy,z+c],V:(a,c=0,dy=0)=>V(x+a,y+dy,z+c)};rooms.set(def.id,r);
  const n=def.entry==='e'?[1,0,0]:def.entry==='w'?[-1,0,0]:[0,0,1];sign(def.name,V(...door).add(V(0,4.25,0)).addScaledVector(V(...n),.32).toArray(),6.4,n);
  if(def.id!=='crown'){
   const main=def.entry==='e'?(((y===0||y===36)&&z<-35)||((y===18||y===54)&&z<18)?0:-6):14;edge([main,y,z],door,5,false);
   if(def.upperDoor)edge([14,y+def.upperDoor,z],[door[0],y+def.upperDoor,z],5,false);
  }else{edge([-6,72,27],door,5,false);}
  if(def.requires.length){const side=def.entry==='e'||def.entry==='w',parts=[-1,1].map(s=>k.box([door[0]+(side?0:s*1.6),y+2.35,door[2]+(side?s*1.6:0)],side?[.46,4.7,3.2]:[3.2,4.7,.46],m.dark,{dynamic:true}));const short={freight:'ГРУЗОВОЙ ШЛЮЗ',sluice:'ЗАТВОРОВЫЙ ДВОР',optics:'РАСКОЛОТЫЙ ФОНАРЬ',hoist:'ПРОТИВОВЕС',archive:'АРХИВ',flywheel:'МАХОВОЙ ХОР',magnet:'МАГНИТНЫЙ ГРУЗ',migrant:'ПОДВИЖНАЯ ДВЕРЬ',pendulum:'ДВА ПРОЛЁТА',inertia:'БАЛКОН ПАДЕНИЯ'};
   const label=()=>{const entries=def.requires.map(id=>`${solved.has(id)?'✓':'○'} ${short[id]??id}: ${solved.has(id)?'РАБОТАЕТ':'ЖДЁТ'}`);if(entries.length>2)return Array.from({length:Math.ceil(entries.length/2)},(_,i)=>entries.slice(i*2,i*2+2).join('     ')).join('\n');return entries.join('   +   ');};
   const indicator=sign(label(),V(...door).add(V(0,def.id==='crown'?7.4:6.1,0)).addScaledVector(V(...n),.32).toArray(),def.id==='crown'?10:9,n,def.id==='crown'?5:1);
   gates.push({id:def.id,r,parts,side,progress:0,indicator,label});}
  return r;
 }
 for(const def of SINGULARITY_ROOMS)shell(def);

 // The freight bay has a genuine load-bearing separation and a narrow aiming
 // window. Player and companion must traverse the installed portal together.
 {
  const r=rooms.get('freight'),{P}=r;base(r);
  for(const[a,b]of [[-18,-10.7],[-9.3,18]])k.box(P(0,(a+b)/2,5),[.65,10,b-a],m.steel);
  k.box(P(0,-10,.75),[.65,1.5,1.4],m.steel);k.box(P(0,-10,6.65),[.65,6.7,1.4],m.steel);
  const intake=k.panel('freight near jaw',P(8,7,2.4),[1,0,0]),outlet=k.panel('freight sealed receiving jaw',P(-11,-10,2.4),[1,0,0]);
  const receiver=P(-10,8);plate(receiver,3.3,m.copper);const latch=k.control('freight:return',P(-10,12),()=>solved.has('freight'),'Открыть возвратный грузовой уловитель',m.copper);
  const finish=goal('freight',receiver,()=>Boolean(game.cargo)&&game.cargo.position.distanceTo(V(...receiver).add(V(0,.57,0)))<3,()=>({sameBody:true,carriedPortalCrossings:carriedTransits.get('freight'),physicalWall:true}));
  register('freight',{state:{intake,outlet,receiver},update:finish,reset(){}});
 }
 // Hydraulic pressure supports a recessed span: conserve the complete stock,
 // fill two unequal tanks equally and physically walk across the raised deck.
 {
  const r=rooms.get('sluice'),{P}=r;
  k.floor(r.b.x0,r.b.x1,r.b.z0,r.def.at[2]+14,0);k.floor(r.b.x0,r.b.x1,r.def.at[2]+20,r.b.z1,0);
  const bridge=k.floor(r.def.at[0]-2.5,r.def.at[0]+2.5,r.def.at[2]+14,r.def.at[2]+20,-5,m.ivory,{dynamic:true});
  const capacities=[10,7,3],volumes=[10,0,0];let flow=null,height=-5;const fills=[];
  for(let i=0;i<3;i++){const x=-14+i*14;k.drum(P(x,-10,capacities[i]/2),3,capacities[i],m.steel);fills.push(k.box(P(x,-6.94,volumes[i]/2+.1),[3.8,Math.max(.08,volumes[i]),.10],m.cyan,{solid:false,dynamic:true}));sign(String(capacities[i]),P(x,-6.85,11.4),2.5);}
  for(const[j,[a,b]]of [[0,1],[1,2],[2,0],[0,2],[2,1],[1,0]].entries()){const x=-15+(j%3)*15,z=j<3?2:10;localControl(r,`${a}-${b}`,x,z,()=>{if(flow)return false;const target=pourVolumes(volumes,capacities,a,b);if(target.every((v,i)=>v===volumes[i]))return false;flow={a,b,target};return true;},`Открыть перелив ${a+1} → ${b+1}`);sign(`${a+1} → ${b+1}`,P(x,z-.42,1.8),2.3);}
  const gauge=sign('10 / 0 / 0',P(0,-6.7,12.7),9);
  register('sluice',{state:{volumes,capacities,get flowing(){return !!flow;},get height(){return height;}},update(dt){if(flow){const amount=Math.min(5*dt,volumes[flow.a]-flow.target[flow.a]);volumes[flow.a]-=amount;volumes[flow.b]+=amount;if(amount<1e-8)flow=null;}fills.forEach((f,i)=>{f.scale.y=Math.max(.08,volumes[i]);f.position.y=Math.max(.08,volumes[i])/2+.1;});gauge?.update(volumes.map(v=>v.toFixed(1)).join(' / '));const equal=!flow&&Math.abs(volumes[0]-5)<.01&&Math.abs(volumes[1]-5)<.01&&volumes[2]<.01;height=THREE.MathUtils.damp(height,equal?0:-5,4,dt);k.move(bridge,P(0,17,height-.2),dt);if(equal&&standing(P(0,22),1.3))complete('sluice',{conserved:10,volumes:[...volumes],raisedSpan:true});},reset(){volumes.splice(0,3,10,0,0);flow=null;height=-5;}});
 }
 // The hoist's upper door is eighteen metres above its lower entrance. No
 // staircase connects its own load bay to its upper receiving gallery.
 {
  const r=rooms.get('hoist'),{P}=r;const baseDeck=base(r);let height=0,locked=false,armed=false,liftUsed=false;
  const pad=P(-11,-11),padVisual=plate(pad,3.4),lift=k.floor(r.def.at[0]-3,r.def.at[0]+3,r.def.at[2]-3,r.def.at[2]+3,0,m.ivory,{dynamic:true});
  k.floor(r.def.at[0]-18,r.def.at[0]+16.2,r.def.at[2]+6,r.def.at[2]+20,18,m.ivory);k.corridor(P(0,0,18),P(0,9,18),6,{rails:false});k.corridor(P(-18,0,18),P(-18,10,18),5,{rails:false});k.corridor(P(-23,0,18),P(-18,0,18),5,{rails:false});
  for(const x of [-4,4])k.box(P(x,0,11.5),[.55,23,.55],m.steel);k.box(P(0,0,24),[10,.75,3],m.copper);
  const weight=k.box(P(-7,0,20),[2.1,4.1,2.1],m.steel,{dynamic:true,round:true});
  const intake=k.panel('hoist counterweight floor',P(-11,-11,.035),[0,1,0],4,4);intake.mesh.userData.portalBackingIds=[baseDeck.uuid];
  const outlet=k.panel('hoist upper catcher',P(-12,17,20.4),[0,0,-1],4.8,4.8);
  localControl(r,'lift',1,0,()=>{if(!loaded(pad,1.5))return false;armed=!armed;return true;},'Подключить грузовую клеть');
  localControl(r,'pawl',-5,11,()=>{if(height>17.8&&game.playerPosition.y>17.6){locked=true;return true;}return false;},'Защёлкнуть верхний уловитель',18);
  register('hoist',{state:{pad,intake,outlet,get height(){return height;},get locked(){return locked;}},update(dt){const load=loaded(pad,1.5);padVisual.material=load?m.live:m.idle;const target=(load&&armed)||locked?18:0;height+=clamp(target-height,-4*dt,4*dt);k.move(lift,P(0,0,height-.2),dt);k.move(weight,P(-7,0,22-height*.8),dt);if(standing(P(0,0,height),2)&&height>17.5)liftUsed=true;if(locked&&!game.heldCube&&game.cargo.position.y>18.2&&game.cargo.position.y<20&&Math.abs(game.cargo.position.x-(r.def.at[0]-12))<3&&game.physics.grounded)complete('hoist',{height,locked,liftUsed,cargoPortalTransports:game.physics.portalTransports});},reset(){height=0;locked=armed=liftUsed=false;}});
 }
// 3. The live ray is traced through geometry and portals, then reflected.
 {
  const r=rooms.get('optics'),{P}=r;base(r);let turned=false,angle=0,lit=0;const draw=beam();
  const intake=k.panel('quarry intake',P(-8,-5,2.4),[-1,0,0],5,4.8),outlet=k.panel('quarry output',P(17,5,2.4),[-1,0,0],5,4.8);
  k.box(P(-5,-8,4),[.55,8,16],m.steel);k.box(P(8,1,2.7),[10,5.4,.5],m.wall);
  const mirror=k.box(P(0,5,2.4),[2.8,3.1,.12],m.ivory,{dynamic:true});
  // The explicit reflector plane below owns light propagation; its physical
  // housing still blocks the player, cargo, camera and portal shots.
  mirror.userData.collider.ignorePropagation=true;
  k.box(P(0,5,.7),[.5,1.4,.5],m.copper);
  const receiver=k.ring(P(0,-12,2.4),1,m.copper,{normal:[0,0,1],dynamic:true});k.box(P(0,-12,1),[.4,2,.4],m.steel);
  localControl(r,'mirror',-17,9,()=>{turned=!turned;},'Развернуть отражатель');
  register('optics',{state:{get turned(){return turned;},get lit(){return lit;},intake,outlet},update(dt){angle=THREE.MathUtils.damp(angle,turned?1:0,9,dt);const normal=V(1,0,1-2*angle).normalize();mirror.quaternion.setFromUnitVectors(V(0,0,1),normal);
   const segments=tracePortalRay(game,V(...P(-26,-5,2.4)),V(1,0,0),{length:130,reflectors:[{position:V(...P(0,5,2.4)),normal,radius:1.4}]});draw(segments);
   const hit=segments.some(s=>s.kind==='portal')&&segments.some(s=>s.kind==='mirror')&&rayTouches(segments,V(...P(0,-12,2.4)),.8);lit=hit?lit+dt:0;receiver.material=hit?m.live:m.copper;if(lit>1)complete('optics',{portalReflection:true,exposure:lit});},reset(){turned=false;angle=lit=0;}});
 }

// 9. Two actual sliding walls permute a bent archive, with reversible controls.
 {
  const r=rooms.get('archive'),{P}=r;base(r);let A=false,B=false,ta=0,tb=0;
  const a=k.box(P(3,0,4.7),[.6,9.4,21],m.rose,{dynamic:true});const b=k.box(P(-10,-3,4.7),[17,9.4,.6],m.steel,{dynamic:true});
  k.box(P(3,-13.25,4.7),[.6,9.4,5.5],m.wall);k.box(P(3.6,6.35,4.7),[.6,9.4,19.3],m.wall);
  k.box(P(-19.75,-3,4.7),[2.5,9.4,.6],m.wall);k.box(P(.75,-3,4.7),[4.5,9.4,.6],m.wall);
  k.box(P(-4,11,4.7),[19,9.4,.6],m.wall);k.box(P(-17,4,4.7),[.5,9.4,14],m.wall);
  localControl(r,'slide-a',14,9,()=>{A=!A;},'Сдвинуть восточный архив');
  localControl(r,'slide-b',-7,-11,()=>{B=!B;},'Перенести поперечную секцию');
  const finish=goal('archive',P(-15,7),()=>true,()=>({eastMoved:A,crossMoved:B}));
  register('archive',{state:{get A(){return A;},get B(){return B;}},update(dt){ta=THREE.MathUtils.damp(ta,A?1:0,3,dt);tb=THREE.MathUtils.damp(tb,B?1:0,3,dt);k.move(a,P(3,ta*15,4.7),dt);k.move(b,P(-10-tb*9,-3,4.7),dt);finish(dt);},reset(){A=B=false;ta=tb=0;}});
 }

// 7. Rotational energy and a ratio selector; braking consumes stored energy.
 {
  const r=rooms.get('flywheel'),{P}=r;base(r);let omega=0,angle=0,ratio=0,clutch=false,brake=false,stable=0;
  const ratios=[.5,2/3,1.5],wheels=[k.gear(P(-8,-11,4),3.9,24,m.copper),k.gear(P(0,-11,4),2.6,16,m.ivory),k.gear(P(7,-11,4),3.2,20,m.cyan)];
  for(const x of [-8,0,7])k.box(P(x,-12,2),[.7,4,.7],m.steel);
  localControl(r,'crank',-11,5,()=>{omega=Math.min(15,omega+2);},'Вложить импульс в маховик');
  localControl(r,'ratio',0,7,()=>{ratio=(ratio+1)%3;},'Сдвинуть передаточную пару');
  localControl(r,'clutch',11,5,()=>{clutch=!clutch;},'Подключить / отключить нагрузку');
  localControl(r,'brake',0,15,()=>{brake=!brake;},'Тормоз маховика');
  const gauge=sign('ОТНОШЕНИЕ · СКОРОСТЬ',P(0,-8,10),12);
  register('flywheel',{state:{get omega(){return omega;},get ratio(){return ratio;},get clutch(){return clutch;},get brake(){return brake;},get output(){return omega*ratios[ratio];}},
   update(dt){omega=Math.max(0,omega*Math.exp(-.009*dt)-(brake?2.2:clutch?.025:0)*dt);angle+=omega*dt;wheels[0].rotation.z=angle;wheels[1].rotation.z=-angle*ratios[ratio];wheels[2].rotation.z=angle*ratios[ratio]*.8;
    const output=omega*ratios[ratio];gauge?.update(`${['1:2','2:3','3:2'][ratio]}   ${output.toFixed(1)} / 5.5   ${clutch?'НАГРУЗКА':'ХОЛОСТОЙ'}`);
    stable=clutch&&!brake&&ratio===1&&output>4.9&&output<6.1?stable+dt:0;if(stable>2)complete('flywheel',{ratio:ratios[ratio],output,stable,energy:omega*omega*12.5});},reset(){omega=angle=ratio=stable=0;clutch=brake=false;}});
 }

// 6. Magnetic force carries the one real body around a solid shield.
 {
  const r=rooms.get('magnet'),{P}=r;base(r);let magnet=-1,passed=false;const targets=[P(-12,0,4.8),P(0,11,4.8),P(12,0,4.8)];
  k.box(P(0,0,3),[7,6,13],m.steel);k.box(P(0,0,6.2),[8,.4,14],m.copper);
  // The free body fits the elevated loading slit; the player's capsule does
  // not. The receiver mechanically opens a separate service door afterwards.
  for(const[a,b]of [[-21,-16],[-12,9.5],[12.5,21]])k.box(P(0,(a+b)/2,7.5),[.65,15,b-a],m.wall);
  k.box(P(0,11,2),[.65,4,3],m.steel);k.box(P(0,11,10.4),[.65,9.2,3],m.steel);
  const serviceDoor=k.box(P(0,-14,7.5),[.65,15,4],m.copper,{dynamic:true});let serviceProgress=0;
  for(let i=0;i<3;i++){k.ring(targets[i],3,m[i===1?'copper':'cyan'],{normal:[1,0,0],tube:.24,arc:Math.PI});k.box(P(-12+i*12,17,3),[.45,6,.45],m.steel);
   localControl(r,'coil-'+i,-16,[-15,-8,8][i],()=>{magnet=magnet===i?-1:i;},`Магнитная катушка ${i+1}`);}
  k.floor(r.def.at[0]+8,r.def.at[0]+18,r.def.at[2]-4,r.def.at[2]+4,r.def.at[1]+4.2,m.ivory);
  k.stairs(P(18,17),P(18,3,4.2),3);
  const sender=P(-12,0);plate(sender,3.6);const receiver=P(12,0,4.2);plate(receiver,3.2);
  register('magnet',{state:{targets,sender,receiver,serviceDoor,get serviceProgress(){return serviceProgress;},get magnet(){return magnet;},get passed(){return passed;}},update(dt){serviceProgress=THREE.MathUtils.damp(serviceProgress,solved.has('magnet')?1:0,4,dt);k.move(serviceDoor,P(0,-14,7.5+serviceProgress*17),dt);const b=game.cargo?.position;if(!b)return;if(!game.heldCube&&b.y>r.def.at[1]+3.8&&b.z>r.def.at[2]+8&&Math.abs(b.x-r.def.at[0])<3)passed=true;
   if(loaded(receiver,1.7)&&game.physics.grounded){complete('magnet',{freeBodyDetour:passed,magnet,physicalCargoSlit:true});magnet=-1;}},force(){const b=game.physics?.cargoBody;if(!b||game.heldCube||magnet<0)return;const target=targets[magnet];if(Math.hypot(b.position.x-r.def.at[0],b.position.z-r.def.at[2])>32)return;
   for(const axis of ['x','z'])b.force[axis]+=b.mass*clamp((target[axis==='x'?0:2]-b.position[axis])*9-b.velocity[axis]*7,-28,28);
   b.force.y+=b.mass*clamp(19.5+(target[1]-b.position.y)*12-b.velocity.y*8,0,70);b.wakeUp();},reset(){magnet=-1;passed=false;serviceProgress=0;}});
 }

// 10. A portal belongs to its rail carriage and follows the physical surface.
 {
  const r=rooms.get('migrant'),{P}=r;let target=0,travel=0;
  k.floor(r.b.x0,r.def.at[0]-4,r.b.z0,r.b.z1,36);k.floor(r.def.at[0]+7,r.b.x1,r.b.z0,r.b.z1,39);
  const platform=k.floor(r.def.at[0]-9,r.def.at[0]-3,r.def.at[2]-4,r.def.at[2]+4,39,m.ivory,{dynamic:true});
  const moving=k.panel('rail-mounted exit',P(-6,0,5.4),[-1,0,0],4.8,4.8,{moving:true});const intake=k.panel('fixed return',P(-14,12,2.4),[1,0,0]);
  k.box(P(1,-8,4.5),[.6,9,28],m.steel);k.decor(P(0,0,10),[30,.4,.5],m.copper);
  localControl(r,'rail',-12,-13,()=>{target=target?0:1;},'Отправить каретку на другую сторону экрана');
  const finish=goal('migrant',P(12,10,3),()=>travel>.98&&Boolean(game.cargo)&&game.cargo.position.distanceTo(V(...P(12,10,3)).add(V(0,.57,0)))<3,()=>({travel,transportedOnMovingExit:true}));
  register('migrant',{state:{moving,intake,get travel(){return travel;}},update(dt){travel+=clamp(target-travel,-.16*dt,.16*dt);const x=-6+travel*17;k.move(platform,P(x,0,2.8),dt);moving.move(P(x,0,5.4),dt);finish(dt);},reset(){target=travel=0;}});
 }

// 11. Fall momentum, not a launch flag. The gap is crossed in free flight.
 {
  const r=rooms.get('inertia'),{P}=r;k.floor(r.def.at[0]+30,r.b.x1,r.def.at[2]-3,r.def.at[2]+13,54);let flew=false,entryCount=0,maxSpeed=0,returnProgress=0;
  k.floor(r.b.x0,r.def.at[0]+20,r.def.at[2]+7,r.def.at[2]+13,54);k.floor(r.b.x0,r.def.at[0]+23,r.def.at[2]+13,r.b.z1,54);k.floor(r.def.at[0]+27,r.b.x1,r.def.at[2]+7,r.b.z1,54);k.floor(r.def.at[0]+23,r.def.at[0]+27,r.def.at[2]+13,r.b.z1,54);k.floor(r.b.x0,r.def.at[0]-20,r.b.z0,r.b.z1,54);
  k.floor(r.def.at[0]-20,r.def.at[0]-3.5,r.b.z0,r.def.at[2]-2,54);
  k.floor(r.def.at[0]+1.5,r.def.at[0]+5,r.b.z0,r.def.at[2]-2,54);
  k.floor(r.def.at[0]-3.5,r.def.at[0]+1.5,r.b.z0,r.def.at[2]-11.5,54);
  k.floor(r.def.at[0]-3.5,r.def.at[0]+1.5,r.def.at[2]-6.5,r.def.at[2]-2,54);
  // Intake floor is the only collision skin under its aperture.
  const intake=k.panel('gravity well floor',P(-1,-9,.02),[0,1,0],5,5);
  k.floor(r.def.at[0]-3.5,r.def.at[0]+1.5,r.def.at[2]-11.5,r.def.at[2]-6.5,54);
  const intakeFloor=k.floors.at(-1);intake.mesh.userData.portalBackingIds=[intakeFloor.mesh.uuid];
  const outlet=k.panel('horizontal launch',P(-17,0,9.4),[1,0,0]);
  k.floor(r.def.at[0]+6,r.def.at[0]+26.7,r.def.at[2]-3,r.def.at[2]+4,50.5,m.ivory);
  k.box(P(27.5,-6.5,6.4),[.65,19,25],m.steel);
  k.box(P(12.5,6,6.4),[15,19,.55],m.wall);k.box(P(25.75,6,6.4),[3.5,19,.55],m.wall);
  const returnDoor=k.box(P(22,6,6.4),[4,19,.55],m.copper,{dynamic:true});
  k.stairs(P(22,4,-3.5),P(22,13,0),3.6);
  k.stairs(P(-27,10),P(-27,-14,12),4);
  k.corridor(P(-27,-14,12),P(-1,-14,12),4,{rails:true});k.floor(r.def.at[0]-3,r.def.at[0]+1,r.def.at[2]-14,r.def.at[2]-11.1,66,m.ivory);
  const finish=goal('inertia',P(21,0,-3.5),()=>true,()=>({maxSpeed,portalEntries:entryCount,landed:true}));
  register('inertia',{state:{intake,outlet,returnDoor,get returnProgress(){return returnProgress;},get flew(){return flew;},get maxSpeed(){return maxSpeed;}},transit(){entryCount++;maxSpeed=Math.max(maxSpeed,game.playerVelocity.length());},update(dt){if(!game.playerGrounded&&lastTransit?.id==='inertia'){maxSpeed=Math.max(maxSpeed,game.playerVelocity.length());if(game.playerPosition.x>r.def.at[0]+2)flew=true;}finish(dt);returnProgress=THREE.MathUtils.damp(returnProgress,solved.has('inertia')?1:0,4,dt);k.move(returnDoor,P(22,6,6.4+21.6*returnProgress),dt);},reset(){flew=false;entryCount=maxSpeed=returnProgress=0;}});
 }
  // Two supported moving spans expose different catch positions. The first
 // bridges the lower void; the second becomes a diagonal-height return link.
 {
  const r=rooms.get('pendulum'),{P}=r;k.floor(r.def.at[0]+19,r.b.x1,r.def.at[2]-3,r.def.at[2]+3,36);k.floor(r.def.at[0]+23.1,r.b.x1,r.b.z0,r.def.at[2]+3,36);let phase=0,A=false,B=false,ya=0,yb=6;const latchA=P(-17,-10),latchB=P(15,11,6);
  k.floor(r.b.x0,r.b.x1,r.b.z0,r.def.at[2]-5,36);k.floor(r.b.x0,r.b.x1,r.def.at[2]+5,r.b.z1,36);
  k.floor(r.def.at[0]-22,r.def.at[0]-15,r.def.at[2]-5,r.def.at[2]+5,36);k.floor(r.def.at[0]+12,r.def.at[0]+22,r.def.at[2]+5,r.b.z1,42);
  const a=k.floor(r.def.at[0]-14,r.def.at[0]-2,r.def.at[2]-2,r.def.at[2]+2,36,m.rose,{dynamic:true});
  const b=k.floor(r.def.at[0]+1,r.def.at[0]+13,r.def.at[2]-2,r.def.at[2]+2,42,m.ivory,{dynamic:true});
  k.corridor(P(-19,-10),P(-19,0),5,{rails:false});k.floor(r.def.at[0]-4,r.def.at[0]+3,r.def.at[2]-4,r.def.at[2]+4,36,m.copper);
  k.stairs(P(19,-13),P(19,11,6),4);
  // The return stair is an enclosed service shaft. Its upper side door is six
  // metres above the gallery; the lower door opens from the upper catch.
  k.box(P(22.5,0,7.5),[.5,15,30],m.wall);
  for(const[a,b]of [[-15,9],[13,15]])k.box(P(16.5,(a+b)/2,7.5),[.5,15,b-a],m.wall);
  k.box(P(16.5,11,3),[.5,6,4],m.wall);k.box(P(16.5,11,13),[.5,4,4],m.wall);
  k.box(P(19.5,15,7.5),[6.5,15,.5],m.wall);
  const stairDoor=k.box(P(19.5,-15,7.5),[6.5,15,.5],m.copper,{dynamic:true});let stairProgress=0;
  // The low atrium guards make the two supported spans the actual approach to
  // the middle island, while the raised span clears the south guard.
  k.box(P(0,-4.6,2.4),[28,4.8,.4],m.steel);k.box(P(-1.75,4.6,2.4),[24.5,4.8,.4],m.steel);
  localControl(r,'catch-a',-17,-10,()=>{if(ya<.22){A=true;return true;}return false;},'Поймать нижний пролёт');
  localControl(r,'catch-b',15,11,()=>{if(A&&yb>5.78){B=true;return true;}return false;},'Поймать верхний пролёт',6);
  const finish=goal('pendulum',P(15,9.5,6),()=>A&&B,()=>({twoPhysicalCatches:true,phase,heights:[ya,yb]}));
  register('pendulum',{state:{stairDoor,get stairProgress(){return stairProgress;},get A(){return A;},get B(){return B;},get ya(){return ya;},get yb(){return yb;}},update(dt){stairProgress=THREE.MathUtils.damp(stairProgress,B?1:0,4,dt);k.move(stairDoor,P(19.5,-15,7.5+stairProgress*17),dt);phase+=dt*.65;ya=A?0:3*(1-Math.cos(phase));yb=B?6:3*(1+Math.cos(phase));k.move(a,P(-8,0,ya-.2),dt);k.move(b,P(7,0,yb-.2),dt);finish(dt);},reset(){phase=0;A=B=false;ya=0;yb=6;stairProgress=0;}});
 }
 // Crown has a second physically sealed receiver, reached with the one pair
 // of portals. A held companion does not satisfy its independent load socket.
 const crown=rooms.get('crown'),C=crown.P;base(crown);
 for(const[a,b]of [[-19,-10.7],[-9.3,19]])k.box(C(0,(a+b)/2,5.4),[.7,10.8,b-a],m.dark);
 k.box(C(0,-10,.7),[.7,1.4,1.4],m.dark);k.box(C(0,-10,6.8),[.7,6.4,1.4],m.dark);
 const crownNear=k.panel('crown outer docking door',C(8,7,2.4),[1,0,0]);
 const crownPortal=k.panel('crown sealed docking door',C(-10,-10,2.4),[1,0,0]);
 const socket=C(-9,6),contact=C(-9,12);plate(socket,3.5,m.copper);plate(contact,2.8,m.rose);
 register('crown',{state:{socket,contact,intake:crownNear,outlet:crownPortal},update(){if(loaded(socket,1.55)&&standing(contact,1.3)){complete('crown',{independentLoads:true,originalCargo:true,carriedPortalCrossings:carriedTransits.get('crown')});won=solved.has('crown');}},reset(){}});
 const spawn=V(0,0,54),cargoSpawn=V(2,.57,54);
 const basePortal=k.panel('castle ground return',[2,2.4,49],[-1,0,0]);
 const upperPortal=k.panel('castle upper return',[2,74.4,49],[-1,0,0]);
 function roomAt(p){return SINGULARITY_ROOMS.find(r=>Math.abs(p.x-r.at[0])<r.w/2+.8&&Math.abs(p.z-r.at[2])<r.d/2+.8&&p.y>r.at[1]-6&&p.y<r.at[1]+r.h+1);}
 function update(dt){time+=dt;for(const[id,machine]of machines)if(available(id))machine.update?.(dt);for(const g of gates){g.indicator?.update(g.label());g.progress=THREE.MathUtils.damp(g.progress,available(g.id)?1:0,5,dt);g.parts.forEach((mesh,i)=>{const s=i?1:-1;k.move(mesh,[g.r.door[0]+(g.side?0:s*(1.6+3.5*g.progress)),g.r.door[1]+2.35,g.r.door[2]+(g.side?s*(1.6+3.5*g.progress):0)],dt);});}k.syncDynamic(dt);}
 function reset(){resetting=true;try{time=0;solved.clear();events.length=0;carriedTransits.clear();lastTransit=null;won=false;for(const machine of machines.values())machine.reset?.();k.resetControls();for(const machine of machines.values())machine.update?.(0);gates.forEach(g=>g.progress=0);update(0);}finally{resetting=false;}}
 const art=buildSingularityArt({game,k,rooms,machines,edges,solved});k.batch();
 const level={id:SINGULARITY_SPEC.id,index,game,spec:SINGULARITY_SPEC,title:'41 / '+SINGULARITY_SPEC.title,singularity:true,tower:true,towerChallenge:true,contextHandlesCarry:true,momentum:true,viewDistance:245,spawn,cargoSpawn,spawnView:{yaw:0,pitch:-.12},launchPad:null,terminals:k.terminals,pads:[],gates:[],panels:{crownPortal,basePortal,upperPortal},rooms,machines,edges,structure:k.root,
  get completedStages(){return solved.size;},totalStages:SINGULARITY_ROOMS.length,get progress(){return solved.size;},getLaunch:()=>null,reset,update,isWon:()=>won,
  getTowerMetrics:()=>({id:SINGULARITY_SPEC.id,completedStages:solved.size,totalStages:SINGULARITY_ROOMS.length,solvedIds:[...solved],events:events.map(e=>({...e})),checkpoints:false,seconds:time,won,carriedPortalCrossings:Object.fromEntries(carriedTransits)}),
  getObjective(){const r=roomAt(game.playerPosition);return r?`${r.name}${solved.has(r.id)?' · МЕХАНИЗМ РАБОТАЕТ':''}`:'СКЛАДЧАТЫЙ ЗАМОК · НАЙДИ СВЯЗЬ ГАЛЕРЕЙ';},
  getContextLesson(){const r=roomAt(game.playerPosition);return['folded-castle','E · ЛКМ · ПКМ',r?available(r.id)?r.hint:`Для открытия нужны: ${r.requires.filter(id=>!solved.has(id)).map(id=>SINGULARITY_ROOMS.find(d=>d.id===id).name).join(' + ')}. Их состояния видны на табличке над входом.`:'Пять высот связаны лестницами и галереями. Один друг и одна пара порталов проходят весь путь вместе. Перезапуск сбрасывает замок.',false];},
  nearbyInteraction(){const t=k.nearest();return t?{kind:t.kind,label:'E',text:t.lesson}:null;},
  interact(){const t=k.nearest();if(!t)return false;const result=t.action();if(result===false)return false;game.audio?.mechanism?.('switch');game.animator?.triggerOperate?.();return true;},
  cargoOnAnyPad(){const p=game.cargo?.position;if(!p)return false;return loaded(machines.get('hoist').state.pad,1.6)||loaded(socket,1.8)||['freight','magnet','migrant'].includes(roomAt(p)?.id);},
  playerAcceleration:()=>V(),applyCargoForces(){if(available('magnet'))machines.get('magnet').force();},
  onTeleport(){const r=roomAt(game.playerPosition);lastTransit={id:r?.id??'atrium',seconds:time};if(game.heldCube&&r)carriedTransits.set(r.id,(carriedTransits.get(r.id)??0)+1);if(r?.id==='inertia')machines.get('inertia').transit();return true;},
  renderUpdate(){art.update();},diagnostics(){return{...this.getTowerMetrics(),uniqueRules:SINGULARITY_ROOMS.map(r=>r.rule),rooms:SINGULARITY_ROOMS.length,portalSurfaces:k.panels.length,heightBands:[0,18,36,54,72],connectedCastle:true};},
  dispose(){if(disposed)return;disposed=true;art.dispose();k.dispose();fill.removeFromParent();sideFill.removeFromParent();sideFill.target.removeFromParent();fill.dispose();sideFill.dispose();game.scene.background=prior.background;game.scene.fog=prior.fog;},
 };return level;
}
