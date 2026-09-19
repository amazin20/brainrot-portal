import * as THREE from 'three';
import { LabTileWorld } from './LabTileWorldBase.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const CYAN=0x64faff, ORANGE=0xffb554, WHITE=0xe9f7ff;
const STEPS=[
 'SHIFT + W — разгон. Сойди в светящийся колодец; отпусти W в падении.',
 'В полёте: ПКМ в панель 03, затем ЛКМ в 02. Белая панель центрирует проход. Лети в 02.',
 'Ещё быстрее: ПКМ в панель 05, затем ЛКМ в 04. Лети в 04.',
 'Держи импульс. Приземлись на светящийся финишный мост.',
 'Цепь замкнута. R — ещё один заезд.',
];

/** A separate, authored momentum course. Every transfer goes through the same
 * swept portal/capsule solver as the campaign. No route event sets position or
 * velocity. The starting intake's visible induction collar centers a fall in
 * X/Z; all launch energy comes from gravity and ordinary player controls. */
export function buildVelocityArena(game){
 const palette={wall:0x0c111b,floor:0x28333e,accent:CYAN,sky:0x03060d};
 const world=new LabTileWorld(game,palette),root=world.root;
 root.name='VELOCITY / orbital relay';
 game.scene.background=new THREE.Color(palette.sky);
 game.scene.fog=new THREE.FogExp2(palette.sky,.0027);
 const mats={
  dark:new THREE.MeshStandardMaterial({color:0x080d16,metalness:.65,roughness:.38}),
  metal:new THREE.MeshStandardMaterial({color:0x66717f,metalness:.7,roughness:.28}),
  cyan:new THREE.MeshBasicMaterial({color:CYAN}),orange:new THREE.MeshBasicMaterial({color:ORANGE}),
  white:new THREE.MeshBasicMaterial({color:WHITE}),
 };
 world.materials.wall.color.setHex(0x151d28);world.materials.floor.color.setHex(0x334350);
 world.materials.trim.color.setHex(0x070c14);world.materials.ceramic.color.setHex(0xf1f4f5);
 world.materials.ceramic.emissive.setHex(0x293c53);world.materials.ceramic.emissiveIntensity=.45;
 const box=(p,s,m=mats.dark,solid=false)=>world.box(p,s,m,solid);
 const panels={},animated=[],fixtures=[],signTextures=[],guides=[],relayLights=[],shaftLights=[];
 const beamGeometry=new THREE.BoxGeometry(1,1,1),ringGeometries=new Map();
 const outlineVertices=[];
 const outlineBox=(x,y,z,sx,sy,sz)=>{
  const corners=[];
  for(let i=0;i<8;i++)corners.push([x+(i&1?1:-1)*sx/2,y+(i&2?1:-1)*sy/2,z+(i&4?1:-1)*sz/2]);
  for(let i=0;i<8;i++)for(const bit of [1,2,4])if(!(i&bit))outlineVertices.push(...corners[i],...corners[i|bit]);
 };
 const label=(text,p,size=6,color='#b7ffff')=>{
  const o=new THREE.Group();o.name=text;o.position.fromArray(p);root.add(o);
  if(!globalThis.document?.createElement)return o;
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=256;
  const context=canvas.getContext('2d');if(!context)return o;
  context.fillStyle='rgba(7,15,28,.90)';context.fillRect(0,16,1536,224);
  context.fillStyle=color;context.fillRect(0,16,8,224);context.fillRect(1528,16,8,224);
  context.font='700 94px Arial, sans-serif';context.textAlign='center';context.textBaseline='middle';
  context.fillText(text,768,133,1470);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;signTextures.push(texture);
  const sign=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
  sign.scale.set(size,size/6,1);o.add(sign);return o;
 };
 const beam=(a,b,width=.18,mat=mats.dark)=>{
  const d=V(...b).sub(V(...a)),m=new THREE.Mesh(beamGeometry,mat);m.scale.set(width,d.length(),width);
  m.position.copy(V(...a).add(V(...b)).multiplyScalar(.5));m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());root.add(m);return m;
 };
 const ring=(p,r,normal=[0,0,1],color='cyan',width=.055)=>{
  const key=`${r}/${width}`;
  if(!ringGeometries.has(key))ringGeometries.set(key,new THREE.TorusGeometry(r,width,5,48));
  const m=new THREE.Mesh(ringGeometries.get(key),mats[color]);m.position.fromArray(p);
  m.quaternion.setFromUnitVectors(V(0,0,1),V(...normal).normalize());root.add(m);return m;
 };
 const platform=(x0,x1,z0,z1,y,name)=>{
  const p=world.floor(x0,x1,z0,z1,y,{name});box([(x0+x1)/2,y-.5,(z0+z1)/2],[x1-x0,1,z1-z0],mats.dark);
  for(const x of [x0+.08,x1-.08])box([x,y+.035,(z0+z1)/2],[.1,.06,z1-z0],mats.white);
  outlineBox((x0+x1)/2,y-.5,(z0+z1)/2,x1-x0,1,z1-z0);
  return p;
 };
 function panel(name,position,normal,number,color='cyan',width=7,height=8){
  // Geometry is procedural and instanced: no extra asset download for a mode.
  const p=world.surface({name:`Relay ${number} / ${name}`,position,normal,width,height,portal:true});
  p.mesh.userData.portalUp=Math.abs(p.normal.y)>.9?V(0,0,-1):V(0,1,0);
  p.mesh.userData.velocityRole=name;p.mesh.userData.velocitySnapCenter=true;p.mesh.userData.velocityNumber=number;
  p.collider.frontPlane=()=>p.getFrame();p.mesh.userData.portalColliderId=p.mesh.uuid;
  // A tilted backing has a conservative AABB: link that specific backing to
  // its true support plane, exactly as the campaign's rotating panel does.
  const backing=game.colliders.find(c=>c.mesh===p.backing);
  if(backing){backing.frontPlane=()=>p.getFrame();p.mesh.userData.portalBackingIds=[p.backing.uuid];}
  panels[name]=p;
  const lightMaterial=new THREE.MeshBasicMaterial({color:color==='orange'?ORANGE:CYAN});
  relayLights.push({name,material:lightMaterial,color:new THREE.Color(color==='orange'?ORANGE:CYAN)});
  for(const x of [-width/2-.23,width/2+.23]){
   const rail=new THREE.Mesh(new THREE.BoxGeometry(.32,height+.8,.5),mats.metal);rail.position.set(x,0,-.16);p.group.add(rail);
   const light=new THREE.Mesh(beamGeometry,lightMaterial);light.scale.set(.13,height+.35,.08);light.position.set(x,0,.16);p.group.add(light);
  }
  // Center brackets teach the real portal aim point without a moving reticle.
  for(const x of [-1.75,1.75])for(const y of [-2,2]){
   const mark=new THREE.Mesh(new THREE.BoxGeometry(.36,.10,.03),mats[color]);mark.position.set(x,y,.035);p.group.add(mark);
  }
  const digit=label(number,[position[0],position[1]+height*.65,position[2]],5.2,color==='orange'?'#ffc47b':'#85faff',Math.atan2(normal[0],normal[2]));
  fixtures.push({role:`real portal ${name}`,id:number,art:p.group});
  return p;
 }

 // A generous high runway builds anticipation before the 44 m gravity fall.
 platform(-5,5,-4,32,44,'44 m acceleration runway');
 platform(-5,5,29,37,44,'companion observation terrace');
 for(const x of [-5.15,5.15]){
  box([x,44.65,14],[.2,1.3,36],mats.dark,true);
  box([x,45.32,14],[.11,.07,36],mats.white);
  for(let z=-2;z<34;z+=5)box([x,34,z],[.5,20,.5],mats.metal);
 }
 for(let z=0;z<30;z+=4){
  beam([-1.6,44.03,z+1.2],[0,44.03,z],.10,mats.cyan);beam([1.6,44.03,z+1.2],[0,44.03,z],.10,mats.cyan);
 }
 label('FASTER / FASTER / FASTER',[0,50,-10],18,'#e9f8ff');
 label('SHIFT + W',[0,45.8,5],5.5);
 label('01  /  ПАДЕНИЕ = СКОРОСТЬ',[0,42,-12.5],8);
 // The shaft collar is deliberately open: falling and portal aiming are visible.
 for(const y of [3,11,19,27,35,43]){
  const light=ring([0,y,-8],4.5,[0,1,0],'white',.10);
  light.material=new THREE.MeshBasicMaterial({color:WHITE,transparent:true,opacity:.35});shaftLights.push(light);
  for(const x of [-4.8,4.8])box([x,y,-8],[.15,.25,9.6],mats.metal);
 }
 for(const x of [-4.8,4.8])for(const z of [-12.8,-3.2])beam([x,-1,z],[x,44,z],.23,mats.metal);
 const intake=panel('intake',[0,.025,-8],[0,1,0],'01','cyan',8,8);
 game.floors.push({minX:-4,maxX:4,minZ:-12,maxZ:-4,y:.025,mesh:intake.mesh,enabled:true});
 panel('launch1',[0,18,-42],[0,.6,.8],'↑','orange');
 panel('catch1',[0,17.3,46],[0,0,-1],'02','cyan',9,12);
 panel('launch2',[-24,48,46],[.8074,.59,0],'03','orange');
 panel('catch2',[42,23.3,46],[-1,0,0],'04','cyan',9,12);
 panel('launch3',[42,59,84],[0,.59,-.8074],'05','orange');

 // Large mechanical cradles make the suspended panels read as machinery.
 for(const name of ['launch1','catch1','launch2','catch2','launch3']){
  const p=panels[name],c=p.group.position;
  const n=p.normal,back=c.clone().addScaledVector(n,-1.4);
  box([back.x,Math.max(1,back.y*.5),back.z],[2.2,Math.max(2,back.y),2.2],mats.dark);
  for(const dx of [-2.8,2.8])beam([back.x+dx,0,back.z],[back.x+dx,c.y+1,back.z],.32,mats.metal);
  ring(back.toArray(),5.8,n.toArray(),name.startsWith('launch')?'orange':'cyan',.16);
 }
 // Flight rings are guides, never invisible portals or collision gates.
 for(const [p,r,n] of [
  [[0,36,-20],5,[0,0,1]],[[0,35,9],6,[0,0,1]],[[0,26,32],5,[0,0,1]],
  [[-6,46,46],5,[1,0,0]],[[16,38,46],6,[1,0,0]],[[34,28,46],5,[1,0,0]],
  [[42,57,62],6,[0,0,1]],[[42,50,37],7,[0,0,1]],[[42,37,10],6,[0,0,1]],
 ]){
  const index=guides.length,stage=1+Math.floor(index/3);
  const o=ring(p,r,n,'white',.14);
  o.material=new THREE.MeshBasicMaterial({color:WHITE,transparent:true,opacity:.22});
  const arc=new THREE.Mesh(new THREE.TorusGeometry(r+.43,.085,4,24,Math.PI*.56),mats.white);
  arc.position.copy(o.position);arc.quaternion.copy(o.quaternion);root.add(arc);
  guides.push({o,arc,stage,order:index%3,baseRotation:o.quaternion.clone()});
  ring(p,r+.43,n,'white',.025);
 }
 platform(30,54,-24,14,35,'finish bridge');
 for(let z=-20;z<14;z+=8){
  box([42,35.035,z],[18,.05,.25],mats.white);
  beam([32,35,z],[32,46,z],.26,mats.metal);beam([52,35,z],[52,46,z],.26,mats.metal);
  beam([32,46,z],[52,46,z],.3,mats.metal);
 }
 label('VELOCITY / COMPLETE',[42,48,-22],17,'#dffaff');
 const goal=world.goal([42,35,-6],[20,30]);
 // A remote reactor and sparse towers give real parallax and vertical scale.
 for(let i=0;i<20;i++){
  const angle=i*Math.PI*2/20,r=135+(i%3)*13,x=35+Math.cos(angle)*r,z=-30+Math.sin(angle)*r,h=40+(i*17%73);
  const width=7+(i%3)*3;
  box([x,h*.5-20,z],[width,h,9],mats.dark);outlineBox(x,h*.5-20,z,width+.05,h+.05,9.05);
  box([x-3,h*.5-20,z+4.6],[.15,h*.82,.12],mats.white);
  for(let y=0;y<h-20;y+=12)box([x,y,z+4.6],[5,.12,.12],mats.metal);
 }
 for(const r of [22,25,32]){const o=ring([42,17,-45],r,[1,.4,.15],'white',.13);animated.push({o,spin:.025*(r%3+1)});}
 const coreMaterial=new THREE.MeshBasicMaterial({color:WHITE,wireframe:true,transparent:true,opacity:.5});
 const core=new THREE.Mesh(new THREE.IcosahedronGeometry(9,1),coreMaterial);
 core.position.set(42,17,-45);root.add(core);animated.push({o:core,spin:.15});
 const key=new THREE.PointLight(0xb8d4f1,90,130,1.3);key.position.set(38,72,-10);root.add(key);
 const fill=new THREE.HemisphereLight(0xdce9f5,0x111621,1.7);root.add(fill);
 const rim=new THREE.DirectionalLight(0xffffff,2.2);rim.position.set(-30,70,-35);root.add(rim);
 // One draw call traces the architecture: large silhouettes stay legible in
 // the dark. Portal ceramics and their cyan/orange identity remain readable.
 const outlineGeometry=new THREE.BufferGeometry();
 outlineGeometry.setAttribute('position',new THREE.Float32BufferAttribute(outlineVertices,3));
 const outlines=new THREE.LineSegments(outlineGeometry,new THREE.LineBasicMaterial({color:WHITE,transparent:true,opacity:.38}));
 outlines.name='White structural contours';root.add(outlines);

 // Three recycled impact groups. Real portal transfers trigger these; no
 // fragment, ring or light participates in collision or changes momentum.
 const burstRingGeometry=new THREE.TorusGeometry(1,.018,4,48);
 const fragmentGeometry=new THREE.OctahedronGeometry(1,0);
 const burstDummy=new THREE.Object3D(),spinQuaternion=new THREE.Quaternion(),spinAxis=V(0,0,1);
 const bursts=Array.from({length:3},(_,index)=>{
  const group=new THREE.Group();group.name=`Relay impact ${index+1}`;group.visible=false;root.add(group);
  const material=new THREE.MeshBasicMaterial({color:WHITE,transparent:true,opacity:0,depthWrite:false});
  const rings=Array.from({length:3},()=>{const mesh=new THREE.Mesh(burstRingGeometry,material);group.add(mesh);return mesh;});
  const fragments=new THREE.InstancedMesh(fragmentGeometry,material,18);fragments.frustumCulled=false;group.add(fragments);
  const seeds=Array.from({length:18},(_,i)=>({angle:i*2.399963229728653,radius:3.7+(i%4)*.4,speed:6+(i*7%11),size:.11+(i%3)*.035}));
  return {group,material,rings,fragments,seeds,started:-Infinity,strength:0};
 });
 let nextBurst=0,renderClock=0,lastVisualTime=null,disposed=false;
 const motionEnabled=()=>!(game.epicDirector?.options?.reducedMotion??game.epicOptions?.reducedMotion)
  &&(game.epicDirector?.options?.speedLines??game.epicOptions?.speedLines)!==false;
 function impact(panelName,speed){
  if(!motionEnabled()||disposed)return;
  const p=panels[panelName],burst=bursts[nextBurst++%bursts.length];
  burst.started=renderClock;burst.strength=.55+Math.min(1,Math.max(0,speed/52))*.45;
  burst.group.position.copy(p.group.position).addScaledVector(p.normal,.32);burst.group.quaternion.copy(p.group.quaternion);
  burst.group.visible=true;
 }

 let time=0,seeded=false;
 const run={stage:0,name:'РАЗГОН',chain:0,speed:0,peakSpeed:0,airborneShots:0,shots:0,finished:false,elapsed:0,transfers:[],validRoute:true};
 game.velocityRun=run;
 const names=['РАЗГОН','ВОЗДУШНАЯ СВЯЗЬ','ВТОРОЙ ИМПУЛЬС','ФИНИШНЫЙ ПОЛЁТ','ЦЕПЬ ЗАМКНУТА'];
 function seed(){
  if(seeded||!game.portals)return;
  seeded=true;
  for(const [slot,name] of [[0,'intake'],[1,'launch1']]){
   const mesh=panels[name].mesh;
   const placed=game.portals.placeOnPanel(slot,mesh,mesh.userData.center,{blockers:game.colliders,preferredUp:mesh.userData.portalUp});
   seeded=seeded&&placed.ok;if(placed.ok)game.portalSurfaceIds[slot]=mesh.uuid;
  }
 }
 function reset(){
  time=0;seeded=false;renderClock=0;lastVisualTime=null;nextBurst=0;
  for(const b of bursts){b.started=-Infinity;b.group.visible=false;b.material.opacity=0;}
  Object.assign(run,{stage:0,name:names[0],chain:0,speed:0,peakSpeed:0,airborneShots:0,shots:0,finished:false,elapsed:0,transfers:[],validRoute:true});seed();
 }
 function onTeleport(travel){
  const from=game.portals.portals[travel.entryIndex]?.surfaceId,to=game.portals.portals[travel.exitIndex]?.surfaceId;
  const routes=[['intake','launch1'],['catch1','launch2'],['catch2','launch3']];
  const expected=routes[run.stage];
  if(expected&&from===panels[expected[0]].mesh.uuid&&to===panels[expected[1]].mesh.uuid){
   run.stage++;run.chain++;run.name=names[run.stage];run.transfers.push({from:expected[0],to:expected[1],speed:travel.velocity.length(),time:time});
   impact(expected[1],travel.velocity.length());
   game.callbacks?.onToast?.(STEPS[run.stage]);
  }else{run.validRoute=false;game.callbacks?.onToast?.('Связь ушла с маршрута. R — быстрый рестарт.');}
 }
 function recordShot(index,mesh,info={}){
  run.shots++;if(info.wasAirborne??!game.playerGrounded)run.airborneShots++;
 }
 function update(dt){
  seed();if(game.state==='playing'){time+=dt;run.elapsed=time;}
  run.speed=game.playerVelocity?.length()??0;run.peakSpeed=Math.max(run.peakSpeed,run.speed);
 }
 function renderUpdate(_alpha=1,visualTime){
  // Physics calls this without a visual time to restore moving supports.
  // This course has no moving support: advance effects only on rendered frames.
  if(disposed||!Number.isFinite(visualTime))return;
  const active=game.state==='playing'&&!game.externalBlocked,motion=motionEnabled();
  const step=lastVisualTime===null?0:THREE.MathUtils.clamp(visualTime-lastVisualTime,0,.1);
  lastVisualTime=visualTime;
  if(active&&motion)renderClock+=step;
  const stage=Math.min(3,run.stage),strength=Math.min(1,(run.speed||0)/52);
  const phase=renderClock*(.58+stage*.14+strength*.15);
  for(const a of animated)if(a.spin)a.o.rotation.z=motion?renderClock*a.spin:0;
  coreMaterial.opacity=.42+stage*.14;
  outlines.material.opacity=.38+stage*.105;
  for(let i=0;i<shaftLights.length;i++){
   const wave=motion&&active&&stage===0?(Math.cos((phase+i/shaftLights.length)*Math.PI*2)+1)*.5:0;
   shaftLights[i].material.opacity=stage===0?.3+wave*.5:.15;
  }
  const targetNames=stage===0?['intake']:stage===1?['catch1','launch2']:stage===2?['catch2','launch3']:[];
  for(const light of relayLights){
   const target=targetNames.includes(light.name);
   const pulse=target&&motion&&active?.08*Math.sin(phase*Math.PI*2):0;
   light.material.color.copy(light.color).multiplyScalar(target?.9+pulse:.35);
  }
  for(const guide of guides){
   const current=guide.stage===stage;
   const wave=motion&&active&&current?(Math.cos((phase-guide.order*.24)*Math.PI*2)+1)*.5:0;
   guide.o.material.opacity=current?.52+wave*.38:guide.stage<stage?.16:.24;
   guide.arc.visible=current;
   // Each arc travels on its own ring and the brightness sequence points
   // along the flight corridor. All openings stay physically unchanged.
   spinQuaternion.setFromAxisAngle(spinAxis,motion?renderClock*(.65+stage*.15)-guide.order*.8:-guide.order*.8);
   guide.arc.quaternion.copy(guide.baseRotation).multiply(spinQuaternion);
  }
  for(const burst of bursts){
   const age=renderClock-burst.started,duration=1.15;
   if(!active||!motion||age<0||age>=duration){
    burst.group.visible=false;burst.started=-Infinity;continue;
   }
   burst.group.visible=true;
   burst.material.opacity=Math.pow(1-age/duration,1.45)*.82*burst.strength;
   for(let i=0;i<burst.rings.length;i++){
    const ring=burst.rings[i],localAge=Math.max(0,age-i*.07);
    ring.visible=age>=i*.07;
    ring.scale.setScalar(2.5+localAge*(15+i*5)*burst.strength);
    ring.position.z=localAge*(12+i*4);
   }
   for(let i=0;i<burst.seeds.length;i++){
    const seed=burst.seeds[i],radial=seed.radius+age*seed.speed;
    burstDummy.position.set(Math.cos(seed.angle)*radial,Math.sin(seed.angle)*radial,age*(12+i%5*3));
    burstDummy.rotation.set(seed.angle+age*(i%3-1),age*.6,seed.angle);
    burstDummy.scale.set(seed.size,seed.size*(2.4+i%4),seed.size*.55);
    burstDummy.updateMatrix();burst.fragments.setMatrixAt(i,burstDummy.matrix);
   }
   burst.fragments.instanceMatrix.needsUpdate=true;
  }
 }
 function isWon(){
  const won=run.validRoute&&run.stage>=3&&game.playerGrounded&&goal.contains(game.playerPosition)&&run.airborneShots>=4;
  if(won){run.stage=4;run.name=names[4];run.finished=true;}
  return won;
 }
 function playerAcceleration(p,v){
  if(run.stage!==0||p.y>43.9||p.y<.5||Math.abs(p.x)>4.7||p.z<-14||p.z>-.8)return null;
  // A visibly marked induction shaft damps only lateral drift; it never adds
  // vertical energy or snaps the player to the portal.
  return V(THREE.MathUtils.clamp(-p.x*28-v.x*10,-80,80),0,THREE.MathUtils.clamp((-8-p.z)*28-v.z*10,-80,80));
 }
 const hints=[STEPS[0],STEPS[1],STEPS[2]];
 function dispose(){
  if(disposed)return;disposed=true;
  for(const b of bursts){b.group.visible=false;b.started=-Infinity;b.fragments.dispose();}
  signTextures.forEach(t=>t.dispose());
  // Every geometry/material stays attached for the shared level disposer,
  // which deduplicates resources across pooled rings, beams and fragments.
 }
 return {id:'velocity-relay',title:'VELOCITY / FASTER FASTER',index:0,world,structure:root,spawn:[0,44,27],spawnView:{yaw:0,pitch:-.08},cargoSpawn:[3,44.55,33],
  bounds:{minX:-170,maxX:220,minZ:-220,maxZ:170},panels,pads:[],gates:[],bridges:[],terminals:[],fixtures,floors:world.floors,launchPad:null,lift:null,receiverPanel:null,momentum:true,
  update,reset,renderUpdate,onTeleport,recordShot,playerAcceleration,isWon,goal,hints,dispose,getLesson:()=>({key:`velocity-${run.stage}`,text:STEPS[run.stage]}),getObjective:()=>STEPS[run.stage],getLaunch:()=>null,
  interact:()=>false,nearbyInteraction:()=>null,cargoOnAnyPad:()=>false,
  diagnostics:()=>({id:'velocity-relay',mode:'velocity',solo:true,realPortalPhysics:true,intakeDrop:44,...run,panels:Object.fromEntries(Object.entries(panels).map(([name,p])=>[name,{position:p.group.position.toArray(),normal:p.normal.toArray()}]))})};
}
