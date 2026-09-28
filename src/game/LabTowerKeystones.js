import * as THREE from 'three';
import {tracePortalRay} from './LabPuzzleMechanics.js';
import {towerCoordinates,towerPoint} from './LabTowerLayout.js';
import {towerReceiverHit} from './LabTowerMechanisms.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const UP=V(0,1,0),clamp=THREE.MathUtils.clamp;

/** Ordered electrical feeds beyond the three already solved wing gates.
 * Every contact needs a fresh, live physical output rather than the wing's
 * stored success bit. Different decks route through different branches. */
export const KEYSTONE_FEED_MODES=Object.freeze([
 [{branch:0,mode:'beamA',s:34,n:0},{branch:2,mode:'transit',s:30,n:0},{branch:1,mode:'cargo',s:33,n:0}],
 [{branch:1,mode:'beamB',s:34,n:0},{branch:0,mode:'airA',s:31,n:0}],
 [{branch:2,mode:'kinetic',s:34,n:0},{branch:0,mode:'cargo',s:31,n:0},{branch:1,mode:'transit',s:32,n:0}],
 [{branch:2,mode:'beamB',s:34,n:0},{branch:0,mode:'beamA',s:32,n:0}],
 [{branch:1,mode:'transit',s:34,n:0},{branch:2,mode:'gravityCargo',s:31,n:0}],
 [{branch:2,mode:'transit',s:34,n:0},{branch:0,mode:'airA',s:31,n:0},{branch:1,mode:'kinetic',s:33,n:0}],
].map(list=>Object.freeze(list.map(feed=>Object.freeze(feed)))));

export const KEYSTONE_SPECS=Object.freeze([
 {id:'spectrum',name:'СПЕКТРАЛЬНАЯ СБОРКА',sequence:['beamA','beamB']},
 {id:'counterbalance',name:'ЖИВАЯ ПРОТИВОВЕСНАЯ ПАРА',sequence:['weight','balance','clamp']},
 {id:'crosswind',name:'РАЗГОННЫЙ ВЕТРОКОЛЛЕКТОР',sequence:['air','momentum']},
 {id:'inversion',name:'ИНВЕРСИЯ ГРУЗА',sequence:['gravity','transit','vent']},
 {id:'braid',name:'ПОВОРОТ СПЕКТРА',sequence:['mirror','beamA','beamB']},
 {id:'crown',name:'КОРОННАЯ СБОРКА',sequence:['weight','beamA','air','momentum','transit','clamp']},
]);

function lamp(group,point,normal,radius,color,resources){
 const root=new THREE.Group();root.position.copy(point);
 root.quaternion.setFromUnitVectors(V(0,0,1),normal);group.add(root);
 const edge=new THREE.Mesh(new THREE.TorusGeometry(radius,.075,8,28),
  new THREE.MeshStandardMaterial({color:0xc2d6d8,roughness:.28,metalness:.7}));root.add(edge);
 const glow=new THREE.Mesh(new THREE.TorusGeometry(radius-.12,.03,6,28),
  new THREE.MeshBasicMaterial({color}));glow.position.z=.04;root.add(glow);
 resources.push(edge,glow);
 return {position:point,normal,radius,glow,set(active){glow.material.color.setHex(active?0xa2ffe6:color);}};
}

function line(group,color,resources){
 const geometry=new THREE.CylinderGeometry(1,1,1,8);
 const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.86,depthWrite:false});
 resources.push(geometry,material);
 const pieces=Array.from({length:8},()=>{const mesh=new THREE.Mesh(geometry,material);mesh.visible=false;group.add(mesh);return mesh;});
 return {update(segments){pieces.forEach((mesh,index)=>{
  const segment=segments[index];mesh.visible=!!segment&&segment.length>.025;
  if(!mesh.visible)return;
  mesh.position.copy(segment.a).add(segment.b).multiplyScalar(.5);
  mesh.scale.set(.032,segment.length,.032);
  mesh.quaternion.setFromUnitVectors(UP,segment.direction);
 });}};
}

/** Six central machines and their real electrical links into the wing rooms.
 * This helper never changes player/cargo poses, portals or game progression.
 * A deck remains locked until all three wing gates are solved and its own
 * feed network plus local physical puzzle have been completed. */
export function createTowerKeystones({game,root,box,makePanel,materials,rooms}){
 const resources=[],states=[],terminals=[],dynamicMeshes=[];
 let lastTeleport=game.teleportCount??0;
 const wing=(deck,branch)=>rooms.find(room=>room.definition.deck===deck&&room.definition.branch===branch);
 const world=(deck,x,y,z)=>V(x,deck*8+y,z);
 const visualBox=(point,size,material,solid=false)=>box(point.toArray(),size,material,
  {solid,camera:solid,aim:solid});
 function plate(position,size,color){
  visualBox(position.clone().addScaledVector(UP,.035),[size,.045,size],materials.dark);
  const face=visualBox(position.clone().addScaledVector(UP,.066),[size-.15,.022,size-.15],color);
  dynamicMeshes.push(face);
  return face;
 }
 for(let deck=0;deck<6;deck++){
  const spec=KEYSTONE_SPECS[deck],group=new THREE.Group();group.name=`Central keystone ${deck+1} / ${spec.id}`;root.add(group);
  const state={deck,id:spec.id,name:spec.name,group,ready:false,solved:false,feeds:KEYSTONE_FEED_MODES[deck].map(()=>false),
   signals:Object.create(null),consoleOn:false,transit:false,angular:0,rotorSpeed:0,rotorAngle:0,
   gravityArmed:false,gravityContact:false,panels:{},fixtures:[],emitter:null,beam:null,air:null,mirror:null,mirrorCollider:null};
  const y=deck*8;
  for(const [order,feed]of KEYSTONE_FEED_MODES[deck].entries()){
   const room=wing(deck,feed.branch),p=V(...towerPoint(room.definition,feed.s,feed.n,y));
   const tile=plate(p,1.55,materials.amber);
   const side=V(...towerPoint(room.definition,feed.s,feed.n+3.65,y+.62));
   const pillar=visualBox(side,[.20,1.18,.20],materials.dark,true);
   const beacon=lamp(group,side.clone().add(V(0,.60,0)),V(0,0,1),.24,0x59646f,resources);
   state.fixtures.push({tile,beacon,order,feed,room,pillar});
  }
  const needsPortal=[0,2,3,4,5].includes(deck);
  if(needsPortal){
   for(const [key,position,normal]of [
    ['input',[-6,y+2.4,-3],[1,0,0]],
    ['outputA',[6,y+2.4,-3],[-1,0,0]],
    ['outputB',[6,y+2.4,3],[-1,0,0]],
   ])if(key!=='outputB'||[0,4,5].includes(deck)){
    state.panels[key]=makePanel(deck,`keystone-${spec.id}-${key}`,position,normal,4.4,4.6);
   }
   state.emitter=world(deck,-2,2.4,-3);
   if(deck===2||deck===5){
    // Behind the beam rather than between the shooter's approach and the
    // white input panel; also outside the centre of the speed-run lane.
    visualBox(world(deck,-2,.58,-4.7),[.68,1.15,.68],materials.dark,true);
    visualBox(world(deck,-2,2.92,-3.85),[.16,.16,1.8],materials.dark,true);
   }else visualBox(world(deck,-2,.58,-3),[.68,1.15,.68],materials.dark,true);
   lamp(group,state.emitter,V(-1,0,0),.39,0xb99a6b,resources);
   state.beam=line(group,0xffd99a,resources);
   if(deck===2||deck===5)state.air=line(group,0x8be6ef,resources);
  }
  if([0,4,5].includes(deck)){
   state.receiverA=lamp(group,world(deck,2,2.4,deck===4?4.7:-3),
    deck===4?V(0,0,-1):V(1,0,0),.75,0x5b6162,resources);
   // Crown's second outlet is an air turbine, not a second optical target;
   // no duplicate ring or solid stand may occupy its velocity lane.
   if(deck!==5)state.receiverB=lamp(group,world(deck,2,2.4,3),V(1,0,0),.75,0x5b6162,resources);
   for(const p of [state.receiverA.position,state.receiverB?.position].filter(Boolean))
    visualBox(p.clone().add(V(0,-1.20,0)),[.22,1.13,.22],materials.dark,true);
  }
  if(deck===4){
   const position=world(deck,2,2.4,-3),surface=new THREE.MeshStandardMaterial({color:0xe4f1ed,metalness:.83,roughness:.13});
   resources.push(surface);
   state.mirror=box(position.toArray(),[1.3,1.45,.09],surface,
    {solid:true,camera:true,aim:true,kinematic:true});
   state.mirrorCollider=game.colliders.find(c=>c.mesh===state.mirror);
   if(state.mirrorCollider)state.mirrorCollider.ignorePropagation=true;
   visualBox(world(deck,2,.70,-3),[.28,1.25,.28],materials.dark,true);
  }
  if(deck===1||deck===5){
   state.cargoPad=world(deck,0,0,-5.5);
   state.cargoPlate=plate(state.cargoPad,2.2,materials.amber);
  }
  if(deck===1){
   state.playerPad=world(deck,0,0,5.5);
   state.playerPlate=plate(state.playerPad,2.2,materials.amber);
  }
  if(deck===2||deck===5){
   state.turbine=lamp(group,world(deck,2,2,deck===2?-3:3),V(1,0,0),.84,0x556e75,resources);
   state.blades=new THREE.Group();state.turbine.glow.parent.add(state.blades);
   for(let blade=0;blade<5;blade++){
    const spoke=new THREE.Mesh(new THREE.BoxGeometry(.21,.58,.055),
     new THREE.MeshStandardMaterial({color:0xb1d7d7,metalness:.5,roughness:.34}));
    spoke.position.y=.32;spoke.rotation.z=blade*Math.PI*2/5;state.blades.add(spoke);resources.push(spoke);
   }
   // D2's A-panel shot approaches from negative z, so its pylon stands on
   // the other side of the duct; D5's B-panel shot approaches from positive z.
   // Both leave the central wind lane open and support the rotor overhead.
   const offset=deck===2?-1.7:1.6;
   visualBox(state.turbine.position.clone().add(V(0,-1.10,offset)),[.24,1.22,.24],materials.dark,true);
   visualBox(state.turbine.position.clone().add(V(0,.67,offset/2)),[.16,.16,Math.abs(offset)+.05],materials.dark,true);
   state.speedPad=world(deck,-4,0,deck===2?-3:3);
   state.speedPlate=plate(state.speedPad,1.55,materials.amber);
  }
  if(deck===3){
   state.cargoPad=world(deck,0,0,0);state.cargoPlate=plate(state.cargoPad,2.5,materials.amber);
   state.upper=lamp(group,world(deck,0,3.5,0),V(0,-1,0),.82,0x586c79,resources);
   for(const x of [-1.8,1.8])for(const z of [-1.8,1.8])
    visualBox(world(deck,x,.56,z),[.19,1.12,.19],materials.dark,true);
  }
  if([1,3,4,5].includes(deck)){
   const at=deck===1?world(deck,4,.9,0):world(deck,0,.9,5);
   state.console=at;terminals.push({position:at,deck,kind:'keystone'});
   // The D1 console sits to the side of the east wing's required central
   // passage. Its hand target remains at x4,z0 without blocking traversal.
   const housing=deck===1?world(deck,4,.68,1.6):world(deck,1.6,.68,6);
   visualBox(housing,[.76,1.36,.76],materials.dark,true);
   const head=visualBox(housing.clone().add(V(0,.71,0)),[.53,.07,.53],materials.amber);
   state.consoleLight=head;dynamicMeshes.push(head);
  }
  const core=lamp(group,world(deck,0,5.85,0),V(0,-1,0),1.12,0x684f40,resources);
  state.core=core;states.push(state);
 }

 function wingCurrent(feed,room,state){
  const live=room.mechanism?.getSignals?.()??{};
  switch(feed.mode){
   case 'beamA':case 'beamB':case 'airA':return !!live[feed.mode];
   case 'cargo':return !game.heldCube&&!!game.cargoOnPad?.(V(...room.definition.cargoPad),2);
   case 'gravityCargo':return !!live.gravity&&!game.heldCube&&!!game.cargoOnPad?.(V(...room.definition.cargoPad),2);
   case 'kinetic':{
    const d=room.definition.direction,v=game.playerVelocity;
    return game.playerGrounded&&v.x*d[0]+v.z*d[1]>3.8;
   }
   case 'transit':return !!state.wingTransit?.[feed.branch];
   default:return false;
  }
 }
 function hubSignal(state,name,condition){
  if(condition)state.signals[name]=true;
  return !!state.signals[name];
 }
 function localOptics(state,dt){
  const d=state.deck,mirrorOn=V(-1,0,-1).normalize(),mirrorOff=V(-1,0,1).normalize();
  const position=world(d,2,2.4,-3);
  if(state.mirror){
   const target=state.consoleOn?1:0;
   state.angular=THREE.MathUtils.damp(state.angular,target,8,dt);
   const normal=mirrorOff.clone().lerp(mirrorOn,state.angular).normalize();
   state.mirror.quaternion.setFromUnitVectors(V(0,0,1),normal);
   state.mirror.updateWorldMatrix(true,false);
   if(state.mirrorCollider){state.mirrorCollider.box.setFromObject(state.mirror);
    game.physics?.updateStaticBox?.(state.mirror.uuid,state.mirrorCollider.box,dt);}
  }
  const reflectors=state.mirror?[{position,normal:mirrorOff.clone().lerp(mirrorOn,state.angular).normalize(),radius:.8}]:[];
  // Use the actual portal pair, wall colliders and the same rigid transform
  // that moves the player and original cargo. A matching panel ID alone does
  // not power anything when its ray is occluded or its aperture is off axis.
  const segments=tracePortalRay(game,state.emitter,V(-1,0,0),{length:65,bounces:8,reflectors,medium:'light'});
  const crossed=segments.some(segment=>segment.kind==='portal');
  state.beam?.update(segments);
  const a=crossed&&state.receiverA&&towerReceiverHit(segments,state.receiverA);
  const b=crossed&&state.receiverB&&towerReceiverHit(segments,state.receiverB);
  state.receiverA?.set(a);state.receiverB?.set(b);
  return {a,b};
 }
 function airFlow(state,dt){
  const d=state.deck,source=world(d,-2,2,-3),segments=tracePortalRay(game,source,V(-1,0,0),
   {length:65,bounces:7,medium:'air'});
  const flowing=segments.some(segment=>segment.kind==='portal')&&towerReceiverHit(segments,state.turbine);
  state.air.update(segments);
  state.rotorSpeed=clamp(state.rotorSpeed+(flowing?25-2.5*state.rotorSpeed:-4*state.rotorSpeed)*dt,0,12);
  state.rotorAngle+=state.rotorSpeed*dt;state.blades.rotation.z=state.rotorAngle;
  state.turbine.set(flowing&&state.rotorSpeed>2.5);
  state.airLive=flowing&&state.rotorSpeed>2.5;
  return state.airLive;
 }
 function detectTeleports(ready){
  if((game.teleportCount??0)===lastTeleport)return;
  lastTeleport=game.teleportCount;
  const entry=game.portalSurfaceIds?.[game.lastPortalTravel?.entry];
  const exit=game.portalSurfaceIds?.[game.lastPortalTravel?.exit];
  if(!entry||!exit)return;
  for(const state of states){
   const d=state.deck;if(!ready[d])continue;
   for(const [index,feed]of KEYSTONE_FEED_MODES[d].entries()){
    if(feed.mode!=='transit'||state.feeds[index]||state.feeds.slice(0,index).some(value=>!value))continue;
    const room=wing(d,feed.branch),ids=new Set(Object.values(room.panels).map(panel=>panel.uuid));
    if(ids.has(entry)&&ids.has(exit))(state.wingTransit??={})[feed.branch]=true;
   }
   const priorHubSignal=d===3?state.signals.gravity:d===5?state.signals.momentum:false;
   if(priorHubSignal&&state.feeds.every(Boolean)){
    const ids=new Set(Object.values(state.panels).map(panel=>panel.uuid));
    if(ids.has(entry)&&ids.has(exit))state.transit=true;
   }
  }
 }
 function chargeFeeds(state){
  const p=game.playerPosition;
  for(const [index,fixture]of state.fixtures.entries()){
   if(state.feeds[index]||state.feeds.slice(0,index).some(value=>!value))continue;
   const {feed,room}=fixture,local=towerCoordinates(room.definition,p);
   const atSocket=game.playerGrounded&&Math.abs(local.s-feed.s)<.90&&Math.abs(local.n-feed.n)<1.3
    &&Math.abs(p.y-room.definition.baseY)<.3;
   if(atSocket&&wingCurrent(feed,room,state))state.feeds[index]=true;
  }
  state.fixtures.forEach(({tile,beacon},i)=>{
   tile.material=state.feeds[i]?materials.mint:materials.amber;
   beacon.set(state.feeds[i]);
  });
 }
 function weight(state){return !game.heldCube&&!!game.cargoOnPad?.(state.cargoPad,1.45);}
 function playerPlate(state){const p=game.playerPosition,q=state.playerPad;
  return game.playerGrounded&&Math.hypot(p.x-q.x,p.z-q.z)<.95&&Math.abs(p.y-q.y)<.28;}
 function speed(state){const p=game.playerPosition,q=state.speedPad;
  return game.playerGrounded&&Math.hypot(p.x-q.x,p.z-q.z)<1.05&&Math.abs(p.y-q.y)<.28
   &&game.playerVelocity.x<-6;}
 function updateGravity(state){
  const p=game.cargo?.position,q=state.cargoPad;
  if(!game.heldCube&&p&&Math.hypot(p.x-q.x,p.z-q.z)<.9&&p.y>=q.y+3.42&&p.y<q.y+4.40)
   state.gravityContact=true;
  state.upper?.set(state.gravityContact);
  return state.gravityContact;
 }
 function update(dt,ready){
  detectTeleports(ready);
  for(const state of states){
   const d=state.deck;state.ready=!!ready[d];
   // A solved relay stays latched for this uninterrupted attempt. Its portal
   // rays need no further collision tracing on the subsequent five decks.
   if(!state.ready||state.solved)continue;
   chargeFeeds(state);
   if(!state.feeds.every(Boolean))continue;
   const s=state.signals;
   if(d===0){
    const beams=localOptics(state,dt);
    hubSignal(state,'beamA',beams.a);
    if(s.beamA)hubSignal(state,'beamB',beams.b);
   }else if(d===1){
    const cargo=weight(state),on=playerPlate(state);
    state.cargoPlate.material=cargo?materials.mint:materials.amber;
    state.playerPlate.material=on?materials.mint:materials.amber;
    hubSignal(state,'weight',cargo);
    if(s.weight)hubSignal(state,'balance',cargo&&on);
    if(s.balance)hubSignal(state,'clamp',state.consoleOn);
   }else if(d===2){
    const flowing=airFlow(state,dt);
    hubSignal(state,'air',flowing);
    state.speedPlate.material=speed(state)?materials.mint:materials.amber;
    if(s.air)hubSignal(state,'momentum',flowing&&speed(state));
   }else if(d===3){
    hubSignal(state,'gravity',updateGravity(state));
    if(s.gravity)hubSignal(state,'transit',state.transit);
    if(s.transit)hubSignal(state,'vent',state.consoleOn);
   }else if(d===4){
    const beams=localOptics(state,dt);
    hubSignal(state,'mirror',state.consoleOn);
    if(s.mirror)hubSignal(state,'beamA',beams.a);
    if(s.beamA)hubSignal(state,'beamB',beams.b);
   }else{
    const beams=localOptics(state,dt),flowing=airFlow(state,dt),cargo=weight(state);
    state.cargoPlate.material=cargo?materials.mint:materials.amber;
    hubSignal(state,'weight',cargo);
    if(s.weight)hubSignal(state,'beamA',beams.a);
    if(s.beamA)hubSignal(state,'air',flowing);
    if(s.air)hubSignal(state,'momentum',flowing&&speed(state));
    if(s.momentum)hubSignal(state,'transit',state.transit);
    if(s.transit)hubSignal(state,'clamp',state.consoleOn);
   }
   if(specSequence(state).every(name=>s[name]))state.solved=true;
   state.core.set(state.solved);
  }
  return states.map(state=>state.solved);
 }
 const specSequence=state=>KEYSTONE_SPECS[state.deck].sequence;
 function reset(){
  lastTeleport=game.teleportCount??0;
  for(const state of states){
   state.ready=state.solved=state.consoleOn=state.transit=state.gravityArmed=state.gravityContact=false;
   state.angular=state.rotorSpeed=state.rotorAngle=0;state.airLive=false;
   state.wingTransit=Object.create(null);state.signals=Object.create(null);state.feeds.fill(false);
   state.beam?.update([]);state.air?.update([]);state.receiverA?.set(false);state.receiverB?.set(false);
   state.turbine?.set(false);state.upper?.set(false);state.core.set(false);
   if(state.blades)state.blades.rotation.z=0;
   if(state.mirror){
    state.mirror.quaternion.setFromUnitVectors(V(0,0,1),V(-1,0,1).normalize());
    state.mirror.updateWorldMatrix(true,false);
    if(state.mirrorCollider){state.mirrorCollider.box.setFromObject(state.mirror);
     game.physics?.updateStaticBox?.(state.mirror.uuid,state.mirrorCollider.box,0);}
   }
   if(state.cargoPlate)state.cargoPlate.material=materials.amber;
   if(state.playerPlate)state.playerPlate.material=materials.amber;
   if(state.speedPlate)state.speedPlate.material=materials.amber;
   if(state.consoleLight)state.consoleLight.material=materials.amber;
   state.fixtures.forEach(({tile,beacon})=>{tile.material=materials.amber;beacon.set(false);});
  }
 }
 function interact(deck){
  const state=states[deck];if(!state||!state.ready||!state.feeds.every(Boolean)||!state.console)return false;
  const hand=game.playerPosition.clone().addScaledVector(UP,.9);
  if(hand.distanceTo(state.console)>2.1)return false;
  const s=state.signals;
  if(deck===1&&!s.balance||deck===3&&!s.transit||deck===4&&state.consoleOn
   ||deck===5&&!s.transit)return false;
  state.consoleOn=true;
  if(state.consoleLight)state.consoleLight.material=materials.mint;
  game.audio?.mechanism?.('switch');
  return true;
 }
 function nearbyInteraction(deck){
  const state=states[deck];if(!state?.console||!state.ready||!state.feeds.every(Boolean))return null;
  const hand=game.playerPosition.clone().addScaledVector(UP,.9);
  if(hand.distanceTo(state.console)>2.1)return null;
  return {kind:'tower-keystone-console',label:'E',text:`${state.name}: включить привод`};
 }
 function wind(state,p,v){
  if(!state.airLive)return V();
  const z=state.deck===2?-3:3,y=state.deck*8;
  if(p.x<-5||p.x>5.2||Math.abs(p.z-z)>1.8||p.y<y+.2||p.y>y+5.4)return V();
  return V(-clamp(17+v.x*1.1,0,23),0,clamp((z-p.z)*1.8-v.z*.45,-4,4));
 }
 function playerAcceleration(p,v){
  for(const state of [states[2],states[5]])if(state.ready&&state.feeds.every(Boolean)){
   const force=wind(state,p.clone().add(V(0,1.1,0)),v);
   if(force.lengthSq())return force;
  }
  return V();
 }
 function applyCargoForces(){
  const body=game.physics?.cargoBody;if(!body||game.heldCube||game.velocityCompanion?.connected)return;
  const gravity=states[3];
  if(gravity.ready&&gravity.feeds.every(Boolean)&&!gravity.gravityContact&&!gravity.consoleOn){
   const q=gravity.cargoPad,dx=q.x-body.position.x,dz=q.z-body.position.z;
   if(Math.abs(dx)<3.1&&Math.abs(dz)<3.1&&body.position.y>q.y+.20&&body.position.y<q.y+1.5){
    body.force.x+=body.mass*clamp(dx*15-body.velocity.x*7,-36,36);
    body.force.z+=body.mass*clamp(dz*15-body.velocity.z*7,-36,36);body.wakeUp();
   }
   if(!gravity.gravityArmed&&game.physics.grounded&&Math.hypot(dx,dz)<.85
    &&body.position.y<q.y+.82&&Math.hypot(body.velocity.x,body.velocity.y,body.velocity.z)<1.1)
    gravity.gravityArmed=true;
   if(gravity.gravityArmed&&Math.hypot(dx,dz)<1.15&&body.position.y<q.y+4.35){
    body.force.y+=body.mass*(19.5+10.5-clamp(body.velocity.y,0,5));
    body.force.x+=body.mass*clamp(dx*6-body.velocity.x*2,-8,8);
    body.force.z+=body.mass*clamp(dz*6-body.velocity.z*2,-8,8);body.wakeUp();
   }
  }
  for(const state of [states[2],states[5]])if(state.ready&&state.feeds.every(Boolean)){
   const force=wind(state,V(body.position.x,body.position.y,body.position.z),
    V(body.velocity.x,body.velocity.y,body.velocity.z));
   if(force.lengthSq()){body.force.x+=body.mass*force.x;body.force.z+=body.mass*force.z;body.wakeUp();}
  }
 }
 function getState(deck){
  const s=states[deck];if(!s)return null;
  return {id:s.id,name:s.name,ready:s.ready,solved:s.solved,feeds:[...s.feeds],signals:{...s.signals},
   controlOn:s.consoleOn,gravityArmed:s.gravityArmed,feedModes:KEYSTONE_FEED_MODES[deck]};
 }
 function dispose(){
  for(const state of states)state.group.removeFromParent();
  for(const resource of resources){
   if(resource.isMesh){resource.geometry.dispose();resource.material.dispose();}
   else resource.dispose();
  }
 }
 reset();
 return {update,reset,dispose,interact,nearbyInteraction,getState,terminals,dynamicMeshes,
  getControlPositions:()=>terminals.map(t=>t.position),playerAcceleration,applyCargoForces};
}
