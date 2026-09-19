import * as THREE from 'three';
import { LabTileWorld } from './LabTileWorldBase.js';
import { buildVelocityScenery } from './LabVelocityScenery.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const CYAN=0x64faff, ORANGE=0xffb554, WHITE=0xe9f7ff;
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

 const chapter=Number(game.velocityChapter)===2?2:1;
 const count=chapter===2?4:3,drop=chapter===2?44:32,spacing=chapter===2?52:38;
 const stationShift=chapter===2?34:16,baseY=chapter===2?130:90,stepY=chapter===2?14:12;
 const exitForward=chapter===2?70:63,upward=chapter===2?.70:.60;
 const stations=Array.from({length:count+1},(_,i)=>({
  index:i,center:V(i*spacing,baseY-stepY*i,i%2?stationShift:0),forward:V(0,0,i%2?1:-1),
  halfWidth:11,back:24,front:16,
 }));
 const segments=[];
 const stationContains=(station,p,margin=0)=>Math.abs(p.x-station.center.x)<=station.halfWidth-margin
  &&p.clone().sub(station.center).dot(station.forward)>=-station.back+margin
  &&p.clone().sub(station.center).dot(station.forward)<=station.front-margin
  &&p.y>=station.center.y-.15&&p.y<station.center.y+2.4;
 for(const station of stations){
  const c=station.center,d=station.forward.z;
  const z0=Math.min(c.z-d*station.back,c.z+d*station.front),z1=Math.max(c.z-d*station.back,c.z+d*station.front);
  platform(c.x-station.halfWidth,c.x+station.halfWidth,z0,z1,c.y,`Safe station ${station.index+1}`);
  for(const side of [-1,1]){
   box([c.x+side*station.halfWidth,c.y+.52,(z0+z1)/2],[.18,1.04,z1-z0],mats.dark,true);
   box([c.x+side*station.halfWidth,c.y+1.1,(z0+z1)/2],[.12,.06,z1-z0],mats.white);
  }
  for(let along=-18;along<15;along+=4){
   const z=c.z+d*along;
   beam([c.x-1.5,c.y+.04,z-d],[c.x,c.y+.04,z+d],.12,mats.cyan);
   beam([c.x+1.5,c.y+.04,z-d],[c.x,c.y+.04,z+d],.12,mats.cyan);
  }
  label(station.index===count?'ВЫ ДОБРАЛИСЬ ВМЕСТЕ':`${station.index+1} / ПЛОЩАДКА`,[c.x,c.y+8,c.z-6*d],10);
  for(const side of [-1,1])beam([c.x+side*10,c.y-24,c.z],[c.x+side*10,c.y-.7,c.z],.55,mats.metal);
 }
 for(let i=0;i<count;i++){
  const station=stations[i],next=stations[i+1],c=station.center,d=station.forward.z;
  const intakeCenter=V(c.x,c.y-drop,c.z+d*24);
  const exitCenter=V(next.center.x,c.y+3,c.z+d*exitForward);
  const intake=panel(`intake${i+1}`,intakeCenter.toArray(),[0,1,0],`${i+1} / ВХОД`,'cyan',9,10);
  const exit=panel(`exit${i+1}`,exitCenter.toArray(),[0,upward,-d*Math.sqrt(1-upward*upward)],`${i+1} / ВЫХОД`,'orange',9,10);
  intake.mesh.userData.portalSize={width:2.2,height:2.8};exit.mesh.userData.portalSize={width:2.2,height:2.8};
  intake.mesh.userData.portalUp=V(0,0,-d);
  game.floors.push({minX:c.x-4.5,maxX:c.x+4.5,minZ:intakeCenter.z-5,maxZ:intakeCenter.z+5,y:intakeCenter.y,mesh:intake.mesh,enabled:true});
  const landing={center:next.center.clone(),halfWidth:next.halfWidth,halfLength:20,y:next.center.y,
   contains:p=>stationContains(next,p)};
  const segment={index:i,start:c.clone(),spawn:c.clone(),spawnView:{yaw:d===-1?0:Math.PI,pitch:-.08},
   runway:{...station,center:c.clone(),y:c.y},intake,exit,landing,drop};
  segments.push(segment);
  // Open induction collars visibly explain the small correction towards the
  // large blue aperture; the fall keeps its full gravity-generated energy.
  for(let offset=0;offset<=drop;offset+=8){
   const y=c.y-offset;
   const light=ring([c.x,y,intakeCenter.z],5.3,[0,1,0],'white',.09);
   light.material=new THREE.MeshBasicMaterial({color:WHITE,transparent:true,opacity:.3});
   light.userData.segment=i;shaftLights.push(light);
  }
  for(const side of [-1,1])beam([c.x+side*5.6,c.y-drop-2,intakeCenter.z],[c.x+side*5.6,c.y+2,intakeCenter.z],.22,mats.metal);
  label('СИНИЙ ВХОД УЖЕ ГОТОВ',[c.x,c.y+2,intakeCenter.z],9);
  label('ОДИН КЛИК → ВЫХОД',[exitCenter.x,exitCenter.y+8,exitCenter.z],11,'#ffd49c');
  const normal=exit.normal;
  const speed=Math.sqrt(2*19.5*(drop+1.2)),vx=normal.z*speed,vy=normal.y*speed;
  const flightDuration=(vy+Math.sqrt(vy*vy+39*(exitCenter.y-next.center.y)))/19.5;
  for(let k=1;k<=5;k++){
   const t=k*flightDuration/6;
   const point=exitCenter.clone().addScaledVector(normal,speed*t).add(V(0,-9.75*t*t,0));
   const o=ring(point.toArray(),6.3,[0,vy-19.5*t,vx],'white',.14);
   o.material=new THREE.MeshBasicMaterial({color:WHITE,transparent:true,opacity:.28});
   const arc=new THREE.Mesh(new THREE.TorusGeometry(6.7,.08,4,24,Math.PI*.58),mats.white);
   arc.position.copy(o.position);arc.quaternion.copy(o.quaternion);root.add(arc);
   guides.push({o,arc,stage:i,order:k,baseRotation:o.quaternion.clone()});
  }
  const back=exitCenter.clone().addScaledVector(normal,-1.4);
  ring(back.toArray(),6.1,normal.toArray(),'orange',.16);
  // Huge open gantries give parallax while keeping all solid beams away from
  // the actual trajectory, the portal throat and the landing deck.
  for(const side of [-1,1])beam([back.x+side*8,back.y-27,back.z],[back.x+side*8,back.y+13,back.z],.65,mats.metal);
  beam([back.x-8,back.y+13,back.z],[back.x+8,back.y+13,back.z],.65,mats.metal);
 }
 const finalStation=stations[count],goal={position:finalStation.center,contains:p=>stationContains(finalStation,p)};
 const scenery=buildVelocityScenery({root,segments,chapter,game});
 label(chapter===2?'ПРЕДЕЛ II / КАСКАД':'ПРЕДЕЛ I / ВМЕСТЕ В ПОТОК',[0,baseY+13,9],23,'#f0fbff');
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

 let time=0,seeded=false,segmentIndex=0,inFlight=false,finished=false,landingPause=0,strandedTime=0;
 const run={chapter,segments:count,segment:0,stage:0,name:'ЗАКРЕПИ ДРУГА',phase:'attach',chain:0,
  speed:0,peakSpeed:0,airborneShots:0,shots:0,finished:false,elapsed:0,transfers:[],checkpoints:0,retries:0,validRoute:true};
 game.velocityRun=run;
 const current=()=>segments[Math.min(segmentIndex,count-1)];
 const connected=()=>Boolean(game.velocityCompanion?.connected);
 const exitReady=()=>game.portalSurfaceIds?.[1]===current().exit.mesh.uuid&&Boolean(game.portals?.ready);
 function seed(){
  if(seeded||!game.portals||finished)return;
  const mesh=current().intake.mesh;
  const placed=game.portals.placeOnPanel(0,mesh,mesh.userData.center,{blockers:game.colliders,preferredUp:mesh.userData.portalUp});
  seeded=placed.ok;if(placed.ok)game.portalSurfaceIds[0]=mesh.uuid;
 }
 function clearSegment(){
  seeded=false;inFlight=false;landingPause=0;strandedTime=0;
  game.portalShots?.reset();game.portals?.clear();if(game.portalSurfaceIds)game.portalSurfaceIds=[null,null];seed();
 }
 function getCheckpoint(){
  const station=stations[Math.min(segmentIndex,count)],d=station.forward.z;
  return {position:station.center.clone(),yaw:d===-1?0:Math.PI,pitch:-.08,connected:connected(),index:segmentIndex};
 }
 function restoreCheckpoint(){
  run.retries++;finished=false;run.finished=false;clearSegment();refresh();return getCheckpoint();
 }
 function reset(){
  time=0;segmentIndex=0;finished=false;renderClock=0;lastVisualTime=null;nextBurst=0;
  for(const b of bursts){b.started=-Infinity;b.group.visible=false;b.material.opacity=0;}
  Object.assign(run,{segment:0,stage:0,name:'ЗАКРЕПИ ДРУГА',phase:'attach',chain:0,speed:0,peakSpeed:0,
   airborneShots:0,shots:0,finished:false,elapsed:0,transfers:[],checkpoints:0,retries:0,validRoute:true});clearSegment();
 }
 function refresh(){
  run.segment=segmentIndex;run.stage=segmentIndex;
  run.phase=finished?'complete':!connected()?'attach':inFlight?'flight':!exitReady()?'prepare':'dive';
  run.name=finished?'ВМЕСТЕ НА ФИНИШЕ':run.phase==='attach'?'ЗАКРЕПИ ДРУГА':run.phase==='prepare'?'ОТКРОЙ ВЫХОД':run.phase==='flight'?'ЛЕТИ ПО КОЛЬЦАМ':'СИНИЙ ВХОД';
 }
 function onTeleport(travel){
  const from=game.portals.portals[travel.entryIndex]?.surfaceId,to=game.portals.portals[travel.exitIndex]?.surfaceId;
  const segment=current();
  if(connected()&&!inFlight&&from===segment.intake.mesh.uuid&&to===segment.exit.mesh.uuid){
   inFlight=true;run.chain++;run.transfers.push({segment:segmentIndex,from:`intake${segmentIndex+1}`,to:`exit${segmentIndex+1}`,speed:travel.velocity.length(),time});
   impact(`exit${segmentIndex+1}`,travel.velocity.length());refresh();
   game.callbacks?.onToast?.('Отпусти движение — импульс донесёт вас до светящейся площадки.');game.emitHud?.();
  }else {
   game.restartCheckpoint?.('Повтори этот участок: друг и синий вход должны быть готовы.');
   return false;
  }
 }
 function recordShot(index,mesh,info={}){
  if(index!==1||mesh!==current().exit.mesh)return;
  run.shots++;if(info.wasAirborne??!game.playerGrounded)run.airborneShots++;refresh();
 }
 function update(dt){
  seed();if(game.state==='playing'){time+=dt;run.elapsed=time;}
  run.speed=game.playerVelocity?.length()??0;run.peakSpeed=Math.max(run.peakSpeed,run.speed);
  if(game.state==='playing'&&!finished){
   if(inFlight&&game.playerGrounded&&current().landing.contains(game.playerPosition)&&game.velocityCompanion?.isNear(game.playerPosition,3)){
    landingPause+=dt;
    if(landingPause>.06){
     segmentIndex++;run.checkpoints=segmentIndex;inFlight=false;
     if(segmentIndex>=count){finished=true;run.finished=true;}
     else clearSegment();
     game.audio?.checkpoint?.();game.callbacks?.onToast?.(finished?'Вы добрались вместе!':`Площадка ${segmentIndex+1} сохранена. Спокойно открой следующий выход.`);game.emitHud?.();
    }
   }else landingPause=0;
   const s=current();
   const stranded=!inFlight&&game.playerGrounded&&game.playerPosition.y<s.start.y-4;
   strandedTime=stranded?strandedTime+dt:0;
   if(strandedTime>.35)
    game.restartCheckpoint?.(connected()?'Сначала открой янтарный выход с безопасной площадки.':'Сначала закрепи брейнрота клавишей E.');
   else if(game.playerPosition.y<s.intake.group.position.y-8||game.playerPosition.y<8)
    game.restartCheckpoint?.('Не страшно — повторяем только этот участок.');
  }
  refresh();
 }
 function getGuidance(){
  refresh();const s=current(),checkpointLabel=`Площадка ${Math.min(segmentIndex+1,count+1)} / ${count+1}`;
  if(finished)return {title:'ВЫ ДОБРАЛИСЬ ВМЕСТЕ',text:'Брейнрот рядом. Скоростная глава пройдена!',target:goal.position.clone(),kind:'complete',slot:null,focus:Boolean(game.velocityFocus),checkpointLabel,companionConnected:connected()};
  if(!connected())return {title:'СНАЧАЛА ЗАКРЕПИ ДРУГА',text:'Подойди к брейнроту и нажми E. Стабилизатор держит его рядом, а руки остаются свободными.',target:game.cargo?.position?.clone()||V(-1.7,baseY+.6,1),kind:'friend',slot:null,focus:Boolean(game.velocityFocus),checkpointLabel,companionConnected:false};
  if(inFlight)return {title:'ЛЕТИТЕ ВМЕСТЕ',text:'Отпусти W — скорость уже набрана. Кольца ведут на широкую площадку; A / D слегка правят курс.',target:s.landing.center.clone().add(V(0,2,0)),kind:'land',slot:null,focus:Boolean(game.velocityFocus),checkpointLabel,companionConnected:true};
  if(!exitReady())return {title:'ОТКРОЙ ЯНТАРНЫЙ ВЫХОД',text:'Наведи взгляд на янтарную панель и нажми ЛКМ. Синий вход уже установлен. Можно целиться с площадки.',target:s.exit.group.position.clone(),kind:'shoot',slot:1,focus:Boolean(game.velocityFocus),checkpointLabel,companionConnected:true};
  return {title:'БЕГИ В СИНИЙ КОЛОДЕЦ',text:'Выход готов. W + Shift по стрелкам к синему колодцу. В падении отпусти W — кольца помогут попасть во вход.',target:s.intake.group.position.clone(),kind:'fly',slot:0,focus:Boolean(game.velocityFocus),checkpointLabel,companionConnected:true};
 }
 function renderUpdate(_alpha=1,visualTime){
  // Physics calls this without a visual time to restore moving supports.
  // This course has no moving support: advance effects only on rendered frames.
  if(disposed||!Number.isFinite(visualTime))return;
  const active=game.state==='playing'&&!game.externalBlocked,motion=motionEnabled();
  const step=lastVisualTime===null?0:THREE.MathUtils.clamp(visualTime-lastVisualTime,0,.1);
  lastVisualTime=visualTime;
  if(active&&motion)renderClock+=step;
  const stage=Math.min(count-1,run.segment),strength=Math.min(1,(run.speed||0)/52);
  scenery.update(renderClock,stage);
  const phase=renderClock*(.58+stage*.14+strength*.15);
  for(const a of animated)if(a.spin)a.o.rotation.z=motion?renderClock*a.spin:0;
  coreMaterial.opacity=.42+stage*.14;
  outlines.material.opacity=.38+stage*.105;
  for(let i=0;i<shaftLights.length;i++){
   const wave=motion&&active&&shaftLights[i].userData.segment===stage?(Math.cos((phase+i/shaftLights.length)*Math.PI*2)+1)*.5:0;
   shaftLights[i].material.opacity=shaftLights[i].userData.segment===stage?.3+wave*.5:.15;
  }
  const targetNames=finished?[]:[`intake${stage+1}`,`exit${stage+1}`];
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
  return finished&&game.playerGrounded&&goal.contains(game.playerPosition)&&Boolean(game.velocityCompanion?.isNear(game.playerPosition,3));
 }
 function playerAcceleration(p,v){
  const s=current(),c=s.intake.group.position;
  // The luminous station floor physically brakes excess landing speed; normal
  // sprinting remains untouched and the player can take time to aim again.
  if(game.playerGrounded&&Math.hypot(v.x,v.z)>15.5&&stations.some(st=>stationContains(st,p)))
   return V(-v.x*8,0,-v.z*8);
  if(inFlight||finished||p.y>s.start.y-.03||p.y<c.y-.5||Math.abs(p.x-c.x)>9||Math.abs(p.z-c.z)>17)return null;
  return V(THREE.MathUtils.clamp((c.x-p.x)*20-v.x*8,-80,80),0,THREE.MathUtils.clamp((c.z-p.z)*20-v.z*8,-80,80));
 }
 function dispose(){
  if(disposed)return;disposed=true;
  scenery.dispose();
  for(const b of bursts){b.group.visible=false;b.started=-Infinity;b.fragments.dispose();}
  signTextures.forEach(t=>t.dispose());
 }
 return {id:`velocity-chapter-${chapter}`,title:chapter===2?'ПРЕДЕЛ II / КАСКАД':'ПРЕДЕЛ I / ВМЕСТЕ В ПОТОК',index:0,chapter,world,structure:root,
  spawn:stations[0].center.toArray(),spawnView:{yaw:0,pitch:-.08},cargoSpawn:[-1.7,baseY+.6,1],
  bounds:{minX:-170,maxX:spacing*count+180,minZ:-200,maxZ:220},segments,stations,panels,pads:[],gates:[],bridges:[],terminals:[],fixtures,
  floors:world.floors,launchPad:null,lift:null,receiverPanel:null,momentum:true,
  update,reset,renderUpdate,onTeleport,recordShot,playerAcceleration,isWon,goal,dispose,getCheckpoint,restoreCheckpoint,getGuidance,
  getShotTargets:()=>finished||inFlight?[]:[{panel:current().exit.mesh,slot:1}],getRequiredShotSlot:()=>1,
  getFlightTarget:()=>finished||inFlight?null:{panel:current().intake.mesh,slot:0},
  getLesson:()=>({key:`velocity-${chapter}-${run.phase}`,text:getGuidance().text}),getObjective:()=>getGuidance().text,getLaunch:()=>null,
  interact:()=>false,nearbyInteraction:()=>game.velocityCompanion?.prompt||null,cargoOnAnyPad:()=>false,
  diagnostics:()=>({id:`velocity-chapter-${chapter}`,mode:'velocity',solo:false,realPortalPhysics:true,intakeDrop:drop,...run,
   companion:game.velocityCompanion?.diagnostics,checkpoint:getCheckpoint(),scenery:scenery.diagnostics,panels:Object.fromEntries(Object.entries(panels).map(([name,p])=>[name,{position:p.group.position.toArray(),normal:p.normal.toArray()}]))})};
}
