import * as THREE from 'three';
import {
 TOWER_STAGE_COUNT,TOWER_DECK_COUNT,TOWER_RISE,TOWER_STAGES,TOWER_DECKS,
 towerPoint,towerCoordinates,
} from './LabTowerLayout.js';
import {TOWER_ROUTE_OBSTACLES,towerDeckRoute} from './LabTowerRoutes.js';
import {createTowerMechanism} from './LabTowerMechanisms.js';
import {createTowerKeystones,KEYSTONE_FEED_MODES,KEYSTONE_SPECS} from './LabTowerKeystones.js';
import {decorateTower} from './LabTowerArt.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const UP=V(0,1,0);
const near=(a,b,r)=>a.distanceToSquared(b)<r*r;
const feedLabel=Object.freeze({beamA:'луч A',beamB:'луч B',airA:'воздушный поток',
 cargo:'груз',gravityCargo:'груз в подъёмнике',kinetic:'разгон',transit:'проход через портал'});
export const TOWER_SPEC=Object.freeze({
 id:'tower-of-the-breach',name:'БАШНЯ РАЗЛОМА',title:'БАШНЯ РАЗЛОМА',
 description:'Шесть ярусов, 18 машинных крыльев и шесть центральных узлов. Исследуй ветви каждого яруса в своём порядке, затем свяжи их механизмы в центре и открой лестницу. Ошибка возвращает к подножию; контрольных точек нет.',
 assets:[1,2,11],accent:0x61d5d4,
 hints:[
  'Следи за проводами от механизмов к внутренней створке. Свет и воздух проходят сквозь настоящую пару порталов; для выстрела сначала поставь друга.',
  'В каждом ярусе три машинных крыла. Открытые створки остаются открытыми до конца попытки; порядок обхода выбираешь сам.',
  'После трёх крыльев соедини их выходы в центральном узле. Только его решение откроет южный переход; коронная комната находится за восточным шлюзом боковой галереи. Падение и рестарт обнуляют всю башню.',
 ],
});

/** A persistent, physical world: all rooms stay built so a portal, a beam or
 * the one original companion never refers to an unloaded collision surface.
 * Eighteen real puzzle rooms are bounded enough to keep this cheaper and more
 * robust than streaming the old 500 near-identical corridor segments.
 */
export function buildTowerLevel(game,index=40){
 const root=new THREE.Group();root.name='The final tower / connected machine wings';game.scene.add(root);
 const unit=new THREE.BoxGeometry(1,1,1),materials=[];
 const mat=(color,roughness=.69,metalness=.21,emissive=0)=>{
  const m=new THREE.MeshStandardMaterial({color,roughness,metalness,emissive,emissiveIntensity:emissive?.18:0});materials.push(m);return m;
 };
 const glowing=color=>{const m=new THREE.MeshBasicMaterial({color});materials.push(m);return m;};
 const palettes=[0x44c2d8,0xffb05d,0xa59afa,0x73d3a9,0xe99ab4,0xf4d66e].map(c=>({accent:mat(c,.43,.35),glow:glowing(c)}));
 const m={shell:mat(0x263b48),dark:mat(0x172f3c),floor:mat(0x9bb6c1,.84,.08),step:mat(0xb8d0d0,.78,.10),
  portal:mat(0xf2f5e8,.54,.07,0x515f5b),glass:mat(0x345a6c,.32,.25),ivory:mat(0xd5e7e7),
  amber:glowing(0xffbf71),mint:glowing(0x88ffbc),red:glowing(0xff7070),light:glowing(0xfff6d9)};
 m.trim=m.dark;
 const background=game.scene.background?.clone?.()??game.scene.background;
 const fog=game.scene.fog?.clone?.()??game.scene.fog;
 const lightPose=game.keyLight?{position:game.keyLight.position.clone(),target:game.keyLight.target.position.clone()}:null;
 game.scene.background=new THREE.Color(0x334b58);game.scene.fog=new THREE.Fog(0x334b58,65,175);
 const all={meshes:[],colliders:[],floors:[]},rooms=[],stairs=[],keystonePanels=[];
 const crownGeometries=[];let crownCore=null,serviceGate=null;
 const globalOwner={group:root,meshes:[],colliders:[],floors:[]};
 const stageStates=TOWER_STAGES.map(()=>({signals:Object.create(null),solved:false,gateOpen:false,
  gateProgress:0,controlOn:false,entered:false,latestBeam:false,latestAir:false,cargoContact:false}));
 const relays=Array(TOWER_DECK_COUNT).fill(false),relayEvents=[],stageEvents=[];
 const keystoneSolved=Array(TOWER_DECK_COUNT).fill(false),keystoneEvents=[];
 let completed=0,elapsed=0,activeSeconds=0,distanceMeters=0,longestIdle=0,idle=0,
  lastPosition=null,won=false,disposed=false,failures=0,highestDeck=0,lastCompletion=0;

 function registerBox(owner,parent,position,size,material,{solid=true,camera=solid,aim=solid,visible=true,kinematic=false}={}){
  const mesh=new THREE.Mesh(unit,material);mesh.name='Tower structural member';mesh.position.fromArray(position);mesh.scale.fromArray(size);
  mesh.visible=visible;mesh.receiveShadow=true;parent.add(mesh);mesh.updateWorldMatrix(true,false);
  owner.meshes.push(mesh);all.meshes.push(mesh);
  if(solid){
   const collider={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true,kinematic};
   if(!visible)mesh.userData.collisionProxy=true;
   owner.colliders.push(collider);all.colliders.push(collider);game.colliders.push(collider);
   if(game.physics&&!game.physics.solids.has(mesh.uuid))game.physics.addStaticBox(mesh.uuid,collider.box,{kinematic});
  }
  if(camera)game.cameraBlockers.push(mesh);if(aim)game.aimBlockers.push(mesh);
  return mesh;
 }
 function worldBox(owner,position,size,material,options){return registerBox(owner,owner.group??root,position,size,material,options);}
 function floor(owner,x0,x1,z0,z1,y,material=m.floor){
  const mesh=worldBox(owner,[(x0+x1)/2,y-.2,(z0+z1)/2],[x1-x0,.4,z1-z0],material);
  const f={minX:x0,maxX:x1,minZ:z0,maxZ:z1,y,mesh,enabled:true};game.floors.push(f);owner.floors.push(f);all.floors.push(f);return mesh;
 }
 function localBox(room,s,n,y,along,height,across,material,options){
  const [dx,dz]=room.definition.direction,p=towerPoint(room.definition,s,n,room.definition.baseY+y);
  return worldBox(room,p,[Math.abs(dx)*along+Math.abs(dz)*across,height,Math.abs(dz)*along+Math.abs(dx)*across],material,options);
 }
 function localFloor(room,s0,s1,n0,n1,y,material=m.floor){
  const corners=[towerPoint(room.definition,s0,n0),towerPoint(room.definition,s0,n1),
   towerPoint(room.definition,s1,n0),towerPoint(room.definition,s1,n1)];
  floor(room,Math.min(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[0])),
   Math.min(...corners.map(p=>p[2])),Math.max(...corners.map(p=>p[2])),room.definition.baseY+y,material);
 }
 function localSide(room,n,s0,s1,y0,y1,material=m.shell,options){
  return localBox(room,(s0+s1)/2,n,(y0+y1)/2,s1-s0,y1-y0,.32,material,options);
 }
 function panel(room,s,sign,key){
  const def=room.definition,y=def.baseY+2.4;
  // The registered front plane lies 16 cm ahead of the solid backing.
  const mesh=localBox(room,s,sign*6.2,2.4,4.4,4.6,.32,m.portal);
  mesh.name=`${def.id} / ${key} / ivory portal face`;
  const [dx,dz]=def.direction,normal=V(sign*dz,0,-sign*dx);
  const center=V(...towerPoint(def,s,sign*6.04,y));
  game.markPortalSurface(mesh,center,normal,2.2,2.3);
  mesh.userData.portalColliderId=mesh.uuid;
  mesh.userData.towerWing=def.id;
  room.panels[key]=mesh;
  for(const offset of [-2.24,2.24])localBox(room,s+offset,sign*6.015,2.4,.065,4.75,.025,palettes[def.deck].glow,{solid:false,camera:false,aim:false});
  localBox(room,s,sign*6.2,6.3,4.4,3.2,.32,m.shell);
  localBox(room,s,sign*6.2,.05,4.4,.10,.32,m.shell);
  return mesh;
 }
 function makeKeystonePanel(deck,key,position,normal,width=4.4,height=4.6){
  const front=V(...position),n=V(...normal).normalize(),center=front.clone().addScaledVector(n,-.16);
  if(Math.abs(n.y)>.001||Math.max(Math.abs(n.x),Math.abs(n.z))<.999)throw new Error('Tower hub panel needs one axis-aligned wall face');
  const size=Math.abs(n.x)>.9?[.32,height,width]:[width,height,.32];
  const mesh=worldBox(globalOwner,center.toArray(),size,m.portal);
  mesh.name=`Tower keystone ${deck+1} / ${key} / ivory portal face`;
  game.markPortalSurface(mesh,front,n,width/2,height/2);
  mesh.userData.portalColliderId=mesh.uuid;mesh.userData.towerKeystone=deck;
  keystonePanels.push(mesh);return mesh;
 }
 function gate(room,s,material){
  const panels=[];
  for(const sign of [-1,1]){
   const leaf=localBox(room,s,sign*3.05,3.72,.20,7.43,6.1,material,{solid:false,camera:false,aim:false});
   const stripe=localBox(room,s-.12,sign*3.05,4.18,.035,.08,5.8,palettes[room.definition.deck].glow,{solid:false,camera:false,aim:false});
   panels.push({mesh:leaf,sign,n:3.05,y:3.72},{mesh:stripe,sign,n:3.05,y:4.18});
  }
  const proxy=localBox(room,s,0,3.76,.28,7.52,12.25,m.dark,{visible:false});
  const collider=room.colliders.at(-1);return {panels,proxy,collider,progress:0,s,room};
 }
 function setGate(gate,progress){
  gate.progress=progress;
  const {room,s}=gate;
  for(const part of gate.panels){
   const p=towerPoint(room.definition,s,part.sign*(part.n+progress*6.4),room.definition.baseY+part.y);
   part.mesh.position.fromArray(p);
  }
  const enabled=progress<.85;
  if(gate.collider.enabled!==enabled){gate.collider.enabled=enabled;game.physics?.setStaticEnabled(gate.proxy.uuid,enabled);}
 }
 function navigableGallery(room){
  const def=room.definition,c=palettes[def.deck],offset=def.reactorN;
  // These walls change a room's usable cross-section. Every opening is a
  // physical passage at least 4 m wide, including the double switchbacks.
  for(const baffle of TOWER_ROUTE_OBSTACLES[def.id]??[]){
   localBox(room,baffle.s,baffle.n,baffle.height/2,baffle.along,baffle.height,baffle.across,m.shell);
   localBox(room,baffle.s-.03,baffle.n,baffle.height-.04,baffle.along+.04,.08,baffle.across+.06,c.accent,{solid:false,camera:false,aim:false});
   const gap=baffle.n<0?4.4:-4.4;
   localBox(room,baffle.s,gap,.025,.09,.05,2.4,c.glow,{solid:false,camera:false,aim:false});
  }
  // An offset reactor gallery gives each wing a differently shaped final
  // chamber. The player can inspect the relay through the open central aisle.
  if(Math.abs(offset)>2){
   const opposite=-Math.sign(offset);
   localBox(room,37.2,opposite*5.0,2.25,4.8,4.5,2.05,m.dark);
   for(const s of [31,36])localBox(room,s,Math.sign(offset)*5.72,4.3,.22,6.5,.22,c.accent,{solid:false,camera:false,aim:false});
  }
 }

 function buildWing(definition){
  const group=new THREE.Group();group.name=`Wing ${definition.number} / ${definition.name}`;root.add(group);
  const room={definition,group,meshes:[],colliders:[],floors:[],panels:{},mechanism:null,gate:null,
   glow:null,plate:null,reactor:null,control:null};
  const c=palettes[definition.deck],state=stageStates[definition.index];
  localFloor(room,0,42,-6.25,6.25,0);
  localBox(room,21,0,7.72,42,.18,12.75,m.shell);
  if(definition.deck===0&&definition.branch===2){
   localSide(room,6.2,0,1.3,0,7.6);localSide(room,6.2,4.1,5.8,0,7.6);
   localSide(room,6.2,1.3,4.1,3.8,7.6);
  }else localSide(room,6.2,0,5.8,0,7.6);
  panel(room,8,1,'input');
  localSide(room,6.2,10.2,42,0,7.6);
  if(definition.deck===0&&definition.branch===0){
   localSide(room,-6.2,0,1.3,0,7.6);localSide(room,-6.2,4.1,11.8,0,7.6);
   localSide(room,-6.2,1.3,4.1,3.8,7.6);
  }else localSide(room,-6.2,0,11.8,0,7.6);
  panel(room,14,-1,'outputA');
  localSide(room,-6.2,16.2,17.8,0,7.6);
  panel(room,20,-1,'outputB');
  localSide(room,-6.2,22.2,42,0,7.6);
  localBox(room,42,0,3.8,.35,7.6,12.7,m.shell);
  room.gate=gate(room,28,c.accent);
  // The tray receives the *real* rigid companion; it never spawns a stand-in.
  localBox(room,5.1,0,.018,4.0,.036,4.0,m.dark,{solid:false,camera:false,aim:false});
  room.plate=localBox(room,5.1,0,.044,3.8,.018,3.8,m.amber,{solid:false,camera:false,aim:false});
  // Console is offset from its reachable standing point (s=5,n=-2): the
  // player cannot walk through its visible, collidable housing.
  room.control=localBox(room,5,-3.5,.65,.92,1.3,.85,c.accent);
  localBox(room,5,-3.5,1.31,.74,.055,.70,m.amber,{solid:false,camera:false,aim:false});
  localBox(room,38,definition.reactorN,.018,3.6,.036,3.6,m.dark,{solid:false,camera:false,aim:false});
  room.reactor=localBox(room,38,definition.reactorN,.043,3.25,.025,3.25,c.glow,{solid:false,camera:false,aim:false});
  for(const side of [-1.85,1.85])localBox(room,38,definition.reactorN+side,1.25,.22,2.5,.22,m.ivory,{solid:false,camera:false,aim:false});
  for(const s of [3,27,35])for(const n of [-5.8,5.8]){
   localBox(room,s,n,6.95,.20,.35,.20,m.ivory,{solid:false,camera:false,aim:false});
   localBox(room,s,n,6.45,.11,.60,.11,c.glow,{solid:false,camera:false,aim:false});
  }
  navigableGallery(room);
  room.mechanism=createTowerMechanism({game,definition,group,
   box:(position,size,material,options={})=>worldBox(room,position,size,material,{solid:false,camera:false,aim:false,...options}),
   materials:{...m,accent:c.accent,glow:c.glow}});
  rooms.push(room);
  if(state.gateOpen)setGate(room.gate,1);return room;
 }

 function deckShell(deck){
  const y=deck*TOWER_RISE,c=palettes[deck];
  floor(globalOwner,-10,10,-10,10,y);
  if(deck===TOWER_DECK_COUNT-1)worldBox(globalOwner,[0,y+7.73,0],[20,.18,20],m.shell);
  const wall=(position,size)=>worldBox(globalOwner,position,size,m.shell);
  // Three wing mouths and two different south openings: one for climbing,
  // one for returning from the previous storey's upper gallery.
  for(const z of [-8,8]){
   wall([9.86,y+3.8,z],[.28,7.6,4]);wall([-9.86,y+3.8,z],[.28,7.6,4]);
  }
  for(const x of [-8,8])wall([x,y+3.8,-9.86],[4,7.6,.28]);
  wall([-7,y+3.8,9.86],[6,7.6,.28]);
  if(deck===0)wall([7,y+3.8,9.86],[6,7.6,.28]);
  else wall([4.9,y+3.8,9.86],[.55,7.6,.28]);
  // The crown leaves by the upper return gallery at x=8. Close the central
  // mouth above the previous flight rather than flooring over its headroom.
  if(deck===TOWER_DECK_COUNT-1)wall([.25,y+3.8,9.86],[9.5,7.6,.28]);
  // A different mechanical colour from each relay runs along the central
  // hub's actually powered cables. They are recessed, never white targets.
  for(let branch=0;branch<3;branch++){
   const orientation=branch===0?[6.4,.09,0]:branch===1?[-6.4,.09,0]:[0,.09,-6.4];
   worldBox(globalOwner,[orientation[0],y+orientation[1],orientation[2]],branch===2?[.15,.025,7]:[7,.025,.15],c.glow,{solid:false,camera:false,aim:false});
  }
  for(const x of [-8.9,8.9])for(const z of [-8.9,8.9]){
   worldBox(globalOwner,[x,y+3.8,z],[.28,7.5,.28],m.ivory,{solid:false,camera:false,aim:false});
   worldBox(globalOwner,[x,y+7.15,z],[.10,.22,.10],c.glow,{solid:false,camera:false,aim:false});
  }
 }
 function buildStair(deck){
  const y=deck*TOWER_RISE,group=new THREE.Group();group.name=`Tower stair ${deck+1}`;root.add(group);
  const owner={group,meshes:[],colliders:[],floors:[]};
  if(deck<TOWER_DECK_COUNT-1)floor(owner,-4.0,4.0,9.75,11.2,y);
  if(deck===TOWER_DECK_COUNT-1){
   // Deck 5 already has the deck-4 return gallery x=5.1..11.2 at y=40.
   // A second central floor here would become a low ceiling above the last
   // ascending flight and trap the player beneath its treads. Instead a
   // separately gated crown chamber branches east of that clear gallery.
   floor(owner,11.0,21.0,24,36.8,y);
   worldBox(owner,[21.16,y+3.8,30.4],[.32,7.6,13.1],m.shell);
   worldBox(owner,[16.1,y+3.8,23.85],[10.2,7.6,.3],m.shell);
   worldBox(owner,[16.1,y+3.8,36.95],[10.2,7.6,.3],m.shell);
   worldBox(owner,[16.1,y+7.72,30.4],[10.2,.18,13.1],m.shell);
   worldBox(owner,[17,y+.025,30],[3.5,.05,3.5],m.dark,{solid:false,camera:false,aim:false});
   // The last goal has a visible six-feed machine, suspended clear of both
   // travellers. Its lit core follows the real sixth keystone, not a timer.
   const crownMaterial=mat(0x7f6952,.24,.63,0x4f311a);
   const orbGeometry=new THREE.IcosahedronGeometry(.70,1),ringGeometry=new THREE.TorusGeometry(1.34,.065,9,48);
   const floorRingGeometry=new THREE.TorusGeometry(1.53,.07,9,48);
   const cableGeometry=new THREE.CylinderGeometry(.035,.035,1,7);
   crownGeometries.push(orbGeometry,ringGeometry,floorRingGeometry,cableGeometry);
   const assembly=new THREE.Group();assembly.name='Tower crown / sixfold core';
   assembly.position.set(17,y+5.65,30);group.add(assembly);
   const orb=new THREE.Mesh(orbGeometry,crownMaterial);orb.name='Original companion crown receiver';assembly.add(orb);
   const rings=[];
   for(const [axis,angle]of [['x',0],['y',Math.PI/3],['z',Math.PI/5]]){
    const ring=new THREE.Mesh(ringGeometry,m.ivory);ring.rotation[axis]=angle;assembly.add(ring);rings.push(ring);
   }
   const floorRing=new THREE.Mesh(floorRingGeometry,crownMaterial);
   floorRing.rotation.x=-Math.PI/2;floorRing.position.set(17,y+.085,30);group.add(floorRing);
   for(let i=0;i<6;i++){
    const angle=i*Math.PI/3;
    const a=V(17+Math.cos(angle)*3.1,y+7.46,30+Math.sin(angle)*3.1);
    const b=V(17+Math.cos(angle)*.72,y+5.9,30+Math.sin(angle)*.72);
    const cable=new THREE.Mesh(cableGeometry,palettes[i].glow);
    cable.position.copy(a).add(b).multiplyScalar(.5);
    cable.quaternion.setFromUnitVectors(UP,b.clone().sub(a).normalize());
    cable.scale.y=a.distanceTo(b);group.add(cable);
   }
   crownCore={assembly,rings,material:crownMaterial};
  }else{
   const count=32,length=24/count;
   for(let i=0;i<count;i++){
    const z0=11.2+i*length,z1=z0+length,top=y+(i+1)*.25;
    floor(owner,-4,4,z0,z1,top,i%2?m.step:m.floor);
   }
   // One continuous pair of real collision walls per stair. Their upper
   // edge meets the next storey instead of overlapping its return corridor.
   for(const x of [-4.25,4.25])worldBox(owner,[x,y+4,21.9],[.30,8,22.5],m.shell);
   floor(owner,-4.0,11.2,35.2,36.8,y+8);
   floor(owner,5.1,11.2,9.5,36.8,y+8);
   for(const x of [5,11.3])worldBox(owner,[x,y+9.85,20.8],[.22,3.7,22.7],m.shell);
   worldBox(owner,[8.2,y+11.2,21],[5.9,.16,24],m.shell);
  }
  const leaves=[];
  const crown=deck===TOWER_DECK_COUNT-1;
  for(const sign of [-1,1]){
   const pos=crown?[12,y+3.78,34.3+sign*1.1]:[sign*2.04,y+3.78,11.45];
   const leaf=worldBox(owner,pos,crown?[.30,7.55,2.2]:[4.08,7.55,.30],palettes[deck].accent,{solid:false,camera:false,aim:false});
   worldBox(owner,crown?[12,y+3.8,34.3+sign*2.22]:[sign*3.95,y+3.8,11.45],
    crown?[.42,7.55,.18]:[.18,7.55,.42],m.dark);
   leaves.push({mesh:leaf,sign,pos});
  }
  const proxy=worldBox(owner,crown?[12,y+3.76,34.3]:[0,y+3.76,11.45],
   crown?[.31,7.52,4.42]:[7.85,7.52,.31],m.dark,{visible:false});
  const gateCollider=owner.colliders.at(-1);
  const stair={deck,owner,leaves,proxy,collider:gateCollider,progress:0,crown};stairs.push(stair);
  for(const z of [15,24,33])for(const x of crown?[5.3,10.9]:[-3.9,3.9]){
   worldBox(owner,[x,y+3,z],[.08,.30,.4],palettes[deck].glow,{solid:false,camera:false,aim:false});
  }
  return stair;
 }
 function setStairGate(stair,progress){
  stair.progress=progress;
  for(const {mesh,sign,pos}of stair.leaves)mesh.position.set(
   pos[0]+(stair.crown?0:sign*4.7*progress),pos[1],pos[2]+(stair.crown?sign*4.7*progress:0));
  const enabled=progress<.85;
  if(stair.collider.enabled!==enabled){stair.collider.enabled=enabled;game.physics?.setStaticEnabled(stair.proxy.uuid,enabled);}
 }
 function buildServiceLink(){
  // An optional, grounded east-to-north passage curls around the hub's NE
  // corner. Both mouths are in the first four metres of their wing, far
  // before either reactor gate. Its own gate charges from the *live* first
  // central feed, so it never offers an early shortcut to an unsolved wing.
  floor(globalOwner,6.0,14.4,-14.4,-6.0,0);
  worldBox(globalOwner,[14.55,3.8,-10.25],[.30,7.6,8.5],m.shell);
  worldBox(globalOwner,[10.25,3.8,-14.55],[8.5,7.6,.30],m.shell);
  worldBox(globalOwner,[10.25,7.72,-10.25],[8.6,.18,8.6],m.shell);
  for(const [x,z,sx,sz]of [[12.5,-7.4,.12,2.3],[11.4,-12.4,3.2,.12]]){
   worldBox(globalOwner,[x,.06,z],[sx,.025,sz],m.amber,{solid:false,camera:false,aim:false});
  }
  for(const [x,z,alongX]of [[14.35,-8.1,false],[8.1,-14.35,true]]){
   const size=alongX?[1.9,1.3,.08]:[.08,1.3,1.9];
   worldBox(globalOwner,[x,5.8,z],size,palettes[0].accent,{solid:false,camera:false,aim:false});
  }
  const leaves=[];
  for(const sign of [-1,1]){
   const pos=[12.2+sign*1.1,3.77,-10.10];
   const mesh=worldBox(globalOwner,pos,[2.2,7.54,.30],palettes[0].accent,{solid:false,camera:false,aim:false});
   mesh.name='Tower service link / powered leaf';leaves.push({mesh,pos,sign});
  }
  const indicator=worldBox(globalOwner,[12.2,.075,-9.40],[3.9,.025,.12],m.amber,
   {solid:false,camera:false,aim:false});
  indicator.name='Tower service link / live beam indicator';
  const proxy=worldBox(globalOwner,[12.2,3.76,-10.10],[4.42,7.52,.32],m.dark,{visible:false});
  proxy.name='Tower service link / physical interlock';
  serviceGate={leaves,indicator,proxy,collider:globalOwner.colliders.at(-1),progress:0};
 }
 function setServiceGate(progress){
  if(!serviceGate)return;
  serviceGate.progress=progress;
  for(const {mesh,pos,sign}of serviceGate.leaves)mesh.position.set(pos[0]+sign*3.3*progress,pos[1],pos[2]);
  const enabled=progress<.85;
  if(serviceGate.collider.enabled!==enabled){serviceGate.collider.enabled=enabled;
   game.physics?.setStaticEnabled(serviceGate.proxy.uuid,enabled);}
 }

 for(let deck=0;deck<TOWER_DECK_COUNT;deck++){
  deckShell(deck);
  for(const stage of TOWER_STAGES.slice(deck*3,deck*3+3))buildWing(stage);
  buildStair(deck);
 }
 buildServiceLink();
 const keystones=createTowerKeystones({game,root,rooms,materials:m,makePanel:makeKeystonePanel,
  box:(position,size,material,options={})=>worldBox(globalOwner,position,size,material,
   {solid:false,camera:false,aim:false,...options})});
 const towerArt=decorateTower({root,rooms,stairs});
 const dynamic=new Set([
  ...rooms.flatMap(room=>[room.plate,room.reactor,...room.gate.panels.map(p=>p.mesh)]),
  ...stairs.flatMap(stair=>stair.leaves.map(leaf=>leaf.mesh)),
  ...serviceGate.leaves.map(leaf=>leaf.mesh),serviceGate.indicator,
  ...keystones.dynamicMeshes,
 ]);
 const kinematicMeshes=new Set(all.colliders.filter(c=>c.kinematic).map(c=>c.mesh));
 const batches=[];
 function batchStaticArchitecture(){
  root.updateWorldMatrix(true,true);
  const groups=new Map();
  for(const mesh of all.meshes){
   if(!mesh.visible||dynamic.has(mesh)||kinematicMeshes.has(mesh)||mesh.userData.portalable)continue;
   if(!groups.has(mesh.material))groups.set(mesh.material,[]);
   groups.get(mesh.material).push(mesh);
  }
  for(const [material,meshes]of groups){
   const batch=new THREE.InstancedMesh(unit,material,meshes.length);
   batch.name='Tower batched static architecture';batch.receiveShadow=true;
   meshes.forEach((mesh,i)=>{
    mesh.updateWorldMatrix(true,false);
    batch.setMatrixAt(i,mesh.matrixWorld);
    mesh.visible=false;mesh.userData.collisionProxy=true;
   });
   batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();root.add(batch);batches.push(batch);
  }
 }
 batchStaticArchitecture();
 game.indexColliders?.();

 function stageForPlayer(){
  const p=game.playerPosition;
  const deck=THREE.MathUtils.clamp(Math.floor((p.y+.2)/TOWER_RISE),0,TOWER_DECK_COUNT-1);
  for(const def of TOWER_STAGES.slice(deck*3,deck*3+3)){
   const {s,n}=towerCoordinates(def,p);
   if(s>0&&s<42&&Math.abs(n)<6.6)return def;
  }
  return null;
 }
 function stageNearby(definition,position){
  if(!position||Math.abs(position.y-definition.baseY)>8)return false;
  const {s,n}=towerCoordinates(definition,position);
  return s>-1&&s<43&&Math.abs(n)<7;
 }
 function enteredControl(room){
  const control=V(...room.definition.control),hand=game.playerPosition.clone().addScaledVector(UP,.9);
  if(hand.distanceTo(control)>2.35)return false;
  const origin=hand,delta=control.clone().sub(origin),distance=delta.length(),ray=new THREE.Ray(origin,delta.normalize());
  return !game.colliders.some(c=>{
   if(c.enabled===false||c.mesh===room.control)return false;
   const hit=ray.intersectBox(c.box,V());return hit&&hit.distanceTo(origin)<distance-.08;
  });
 }
 function latch(definition,signal,active){
  const state=stageStates[definition.index],order=definition.puzzle.order;
  if(!active||state.signals[signal]||!order.includes(signal))return false;
  const prior=order.slice(0,order.indexOf(signal));
  if(prior.some(s=>!state.signals[s]))return false;
  state.signals[signal]=true;
  game.audio?.mechanism?.('switch');
  if(signal==='gravity'&&!definition.puzzle.requirements.includes('control')){
   rooms[definition.index].mechanism.setControl(true); // vent so the same cargo can be collected
  }
  return true;
 }
 function setWingSolved(room){
  const def=room.definition,state=stageStates[def.index];
  if(state.solved)return;
  state.solved=true;state.gateOpen=true;completed++;game.completedStages=completed;
  const event={stage:completed,id:def.id,deck:def.deck,branch:def.branch,
   seconds:elapsed,stageSeconds:elapsed-lastCompletion,position:game.playerPosition.toArray(),distanceMeters};
  stageEvents.push(event);lastCompletion=elapsed;
  room.reactor.material=m.mint;
  game.callbacks?.onToast?.(`${def.name}: машинное крыло подключено. Осталось ${TOWER_STAGE_COUNT-completed}.`);
  if(TOWER_STAGES.slice(def.deck*3,def.deck*3+3).every(s=>stageStates[s.index].solved)){
   relays[def.deck]=true;relayEvents.push({deck:def.deck,seconds:elapsed});
   game.callbacks?.onToast?.('Три линии поданы в центральный узел. Соедини их, чтобы открыть лестницу.');
  }
 }
 function failure(){
  if(disposed||game.state!=='playing')return;
  failures++;
  game.callbacks?.onToast?.('Срыв. Вся Башня начинается заново — контрольных точек нет.');
  game.resetRun(true);
 }
 function reset(){
  completed=0;won=false;elapsed=activeSeconds=distanceMeters=longestIdle=idle=0;
  lastCompletion=0;lastPosition=null;highestDeck=0;
  stageEvents.length=0;relayEvents.length=0;relays.fill(false);game.completedStages=0;
  keystoneEvents.length=0;keystoneSolved.fill(false);keystones.reset();
  for(const [i,state]of stageStates.entries()){
   state.signals=Object.create(null);state.solved=state.gateOpen=state.entered=state.controlOn=false;
   state.transit=false;state.controlComplete=false;
   state.gateProgress=0;state.latestBeam=state.latestAir=state.cargoContact=false;
   const room=rooms[i];room.mechanism.reset();setGate(room.gate,0);
   room.plate.material=m.amber;room.reactor.material=palettes[room.definition.deck].glow;
  }
  for(const stair of stairs)setStairGate(stair,0);
  setServiceGate(0);serviceGate.indicator.material=m.amber;
  if(crownCore){crownCore.material.color.setHex(0x7f6952);crownCore.material.emissive.setHex(0x4f311a);
   crownCore.material.emissiveIntensity=.18;crownCore.assembly.rotation.y=0;
   crownCore.rings[1].rotation.x=0;crownCore.rings[2].rotation.z=Math.PI/5;}
 }
 function update(dt){
  if(disposed||won||game.state!=='playing')return;
  towerArt.update(dt);
  if(crownCore){crownCore.assembly.rotation.y+=dt*.23;
   crownCore.rings[1].rotation.x+=dt*.31;crownCore.rings[2].rotation.z-=dt*.27;}
  elapsed+=dt;
  const p=game.playerPosition,cargo=game.cargo?.position;
  if(lastPosition){
   const d=p.distanceTo(lastPosition);
   if(d<3){distanceMeters+=d;if(d>dt*.15){activeSeconds+=dt;idle=0;}else{idle+=dt;longestIdle=Math.max(longestIdle,idle);}}
  }
  lastPosition??=p.clone();lastPosition.copy(p);
  highestDeck=Math.max(highestDeck,Math.min(5,Math.floor((p.y+.12)/TOWER_RISE)));
  if(p.y<highestDeck*TOWER_RISE-2.6||cargo.y<highestDeck*TOWER_RISE-3.2
   ||Math.abs(p.x)>55||p.z>38||p.z< -55||Math.abs(cargo.x)>55||cargo.z>38||cargo.z< -55){failure();return;}

  for(const room of rooms){
   const def=room.definition,state=stageStates[def.index];
   if(!stageNearby(def,p)&&!stageNearby(def,cargo))continue;
   state.entered=true;
   const actual=room.mechanism.update(dt)||{};
   state.latestBeam=Boolean(actual.beamA||actual.beamB);state.latestAir=Boolean(actual.airA);
   room.plate.material=game.cargoOnPad?.(V(...def.cargoPad),2.0)?m.mint:m.amber;
   const cargoLoaded=game.cargoOnPad?.(V(...def.cargoPad),2.0);
   const {s,n}=towerCoordinates(def,p);
   const kinetic=s>21.7&&s<23.1&&Math.abs(n)<2.4&&game.playerGrounded
    &&game.playerVelocity.x*def.direction[0]+game.playerVelocity.z*def.direction[1]>3.75;
   const raw={cargo:!!cargoLoaded,beamA:!!actual.beamA,beamB:!!actual.beamB,
    airA:!!actual.airA,gravity:!!actual.gravity,kinetic,transit:!!state.transit,
    mirror:!!state.controlOn,control:!!state.controlComplete};
   const alreadyLatched={...state.signals};
   const freshCargo=raw.cargo&&!state.cargoContact;
   state.cargoContact=raw.cargo;
   // Re-evaluate in the authored causal order so simultaneous physical
   // contacts still require their actual prior power source, never a timer.
   for(const signal of def.puzzle.order){
    const prerequisites=def.puzzle.order.slice(0,def.puzzle.order.indexOf(signal));
    const active=signal==='cargo'?freshCargo&&prerequisites.every(s=>alreadyLatched[s]):raw[signal];
    latch(def,signal,active);
   }
   if(def.puzzle.requirements.every(signal=>state.signals[signal]))state.gateOpen=true;
   state.gateProgress=THREE.MathUtils.damp(state.gateProgress,state.gateOpen?1:0,5,dt);
   if(Math.abs(state.gateProgress-(state.gateOpen?1:0))<.002)state.gateProgress=state.gateOpen?1:0;
   setGate(room.gate,state.gateProgress);
   if(state.gateOpen&&s>36.2&&s<40&&Math.abs(n-def.reactorN)<1.75&&game.playerGrounded
    &&p.y>=def.baseY-.12&&p.y<def.baseY+.28
    &&cargo&&cargo.distanceTo(p)<3.2)setWingSolved(room);
  }
  const solved=keystones.update(dt,relays);
  for(let deck=0;deck<TOWER_DECK_COUNT;deck++)if(solved[deck]&&!keystoneSolved[deck]){
   keystoneSolved[deck]=true;
   keystoneEvents.push({deck,id:KEYSTONE_SPECS[deck].id,seconds:elapsed,position:p.toArray()});
   if(deck===TOWER_DECK_COUNT-1&&crownCore){crownCore.material.color.setHex(0xb8ffe6);
    crownCore.material.emissive.setHex(0x41efbd);crownCore.material.emissiveIntensity=.85;}
   game.callbacks?.onToast?.(deck===TOWER_DECK_COUNT-1?
    'Коронный узел запитан. Восточный шлюз боковой галереи открыт.':'Центральный узел запитан. Южная лестница открыта.');
  }
  const linkPowered=keystones.getState(0).feeds[0];
  serviceGate.indicator.material=linkPowered?m.mint:m.amber;
  const linkProgress=THREE.MathUtils.damp(serviceGate.progress,linkPowered?1:0,5,dt);
  setServiceGate(Math.abs(linkProgress-(linkPowered?1:0))<.002?(linkPowered?1:0):linkProgress);
  for(const stair of stairs){
   const target=keystoneSolved[stair.deck]?1:0;
   const progress=THREE.MathUtils.damp(stair.progress,target,5,dt);
   setStairGate(stair,Math.abs(progress-target)<.002?target:progress);
  }
  if(keystoneSolved.every(Boolean)&&p.y>=5*TOWER_RISE-.15&&p.y<5*TOWER_RISE+.4
   &&Math.abs(p.x-17)<1.8&&p.z>28.3&&p.z<31.7&&cargo.distanceTo(p)<3.2){won=true;}
 }
 function onTeleport(event){
  const entry=game.portals?.portals?.[event.entryIndex],exit=game.portals?.portals?.[event.exitIndex];
  if(!entry||!exit)return;
  for(const room of rooms){
   const ids=Object.values(room.panels).map(mesh=>mesh.uuid);
   if(!ids.includes(entry.surfaceId)||!ids.includes(exit.surfaceId))continue;
   // A crossing is an event, not a permanent request that can be redeemed
   // after some unrelated prerequisite is powered later.
   if(latch(room.definition,'transit',true))stageStates[room.definition.index].transit=true;
   break;
  }
 }
 function interact(){
  const def=stageForPlayer();
  if(!def){const deck=Math.min(TOWER_DECK_COUNT-1,Math.max(0,Math.floor((game.playerPosition.y+.2)/TOWER_RISE)));
   return keystones.interact(deck);}
  const room=rooms[def.index];if(!enteredControl(room))return false;
  const state=stageStates[def.index],needs=def.puzzle.requirements;
  if(needs.includes('mirror')){
   state.controlOn=!state.controlOn;room.mechanism.setControl(state.controlOn);
   latch(def,'mirror',state.controlOn);
  }else if(needs.includes('gravity')){
   if(!state.signals.gravity)return false;
   state.controlOn=true;room.mechanism.setControl(true);
   state.controlComplete=true;latch(def,'control',true);
  }else{
   if(needs.includes('control')&&def.puzzle.order.slice(0,-1).some(s=>!state.signals[s]))return false;
   state.controlOn=!state.controlOn;room.mechanism.setControl(state.controlOn);
   state.controlComplete=state.controlOn;latch(def,'control',state.controlOn);
  }
  game.audio?.mechanism?.('switch');
  return true;
 }
 function metrics(){return {
  completedStages:completed,totalStages:TOWER_STAGE_COUNT,solvedIds:stageEvents.map(e=>e.id),
  stageEvents:stageEvents.map(e=>({...e,position:[...e.position]})),deckRelays:[...relays],
  relayEvents:relayEvents.map(e=>({...e})),keystoneSolved:[...keystoneSolved],
  keystoneEvents:keystoneEvents.map(e=>({...e,position:[...e.position]})),checkpoints:false,
  activeSeconds,distanceMeters,longestIdleSeconds:longestIdle,elapsedSeconds:elapsed,
  failures,teleports:game.teleportCount,residentStages:disposed?0:rooms.length,colliders:game.colliders.length,
  portalSurfaces:game.portalPanels.filter(p=>p.userData.towerWing||p.userData.towerKeystone!=null).length,
 };}

 const terminals=[...rooms.map(room=>({
  position:V(...towerPoint(room.definition,5,-2.9,room.definition.baseY+.9)),
  kind:'tower-console',room,
 })),...keystones.terminals];
 const keystoneRoutes=TOWER_DECKS.map(({deck})=>towerDeckRoute(deck,{
  stages:TOWER_STAGES.slice(deck*3,deck*3+3),feedModes:KEYSTONE_FEED_MODES[deck],
 }));
 const deckRoutes=TOWER_DECKS.map(({deck,baseY})=>deck===TOWER_DECK_COUNT-1?[]:[
  {kind:'walk',target:[0,baseY,7]},
  {kind:'walk',target:[0,baseY,10.2]},
  {kind:'walk',target:[0,baseY+8,34.9],timeout:55},
  {kind:'walk',target:[8,baseY+8,35.7]},
  {kind:'walk',target:[8,baseY+8,8]},
  {kind:'walk',target:[0,baseY+8,0]},
 ]);
 const finalRoute=[{kind:'walk',target:[0,40,7]},
  {kind:'walk',target:[8,40,7]},
  {kind:'walk',target:[8,40,34],timeout:45},
  {kind:'walk',target:[11.1,40,34.3]},
  {kind:'walk',target:[14,40,34.3]},
  {kind:'walk',target:[17,40,30]}];
 const level={id:TOWER_SPEC.id,index,game,title:'41 / '+TOWER_SPEC.title,spec:TOWER_SPEC,
  tower:true,towerChallenge:true,totalStages:TOWER_STAGE_COUNT,towerStages:TOWER_STAGES,
  towerRoute:TOWER_STAGES,routeStages:TOWER_STAGES,keystoneRoutes,deckRoutes,finalRoute,
  spawn:V(0,0,0),cargoSpawn:V(1.1,.57,.25),spawnView:{yaw:-Math.PI/2,pitch:-.14},
  contextHandlesCarry:true,viewDistance:180,terminals,pads:[],gates:[],panels:{},launchPad:null,
  get completedStages(){return completed;},get progress(){return completed;},
  getTowerMetrics:metrics,
  getTowerKeystoneState:deck=>keystones.getState(deck),
  getTowerServiceState:()=>({unlocked:keystones.getState(0).feeds[0],open:!serviceGate.collider.enabled}),
  getTowerStageState(i){
   const def=TOWER_STAGES[i],state=stageStates[i];if(!def||!state)return null;
   return {id:def.id,deck:def.deck,branch:def.branch,signals:{...state.signals},
    gateOpen:state.gateOpen,solved:state.solved,entered:state.entered,controlOn:state.controlOn};
  },
  getObjective(){
   const def=stageForPlayer();
   if(def){const state=stageStates[def.index];
    return `${def.name} · ${Object.keys(state.signals).length}/${def.puzzle.requirements.length} звеньев · КРЫЛЬЯ ${completed}/${TOWER_STAGE_COUNT}`;}
   const deck=Math.min(TOWER_DECK_COUNT-1,Math.floor((game.playerPosition.y+.2)/TOWER_RISE));
   const solved=TOWER_STAGES.slice(deck*3,deck*3+3).filter(s=>stageStates[s.index].solved).length;
   return keystoneSolved[deck]?(deck===5?'КОРОНА ПИТАЕТСЯ · ВОСТОЧНЫЙ ШЛЮЗ БОКОВОЙ ГАЛЕРЕИ':'ЛЕСТНИЦА ОТКРЫТА · ПОДНИМАЙСЯ ВДВОЁМ'):
    relays[deck]?(()=>{
     const state=keystones.getState(deck),next=state.feeds.indexOf(false);
     if(next>=0){const feed=state.feedModes[next],wing=TOWER_STAGES[deck*3+feed.branch];
      return `${state.name} · ${next}/${state.feeds.length} · ${wing.branchName}: ${feedLabel[feed.mode]}`;}
     return `${state.name} · ЦЕНТРАЛЬНАЯ СБОРКА ${Object.keys(state.signals).length}/${KEYSTONE_SPECS[deck].sequence.length}`;
    })():
    `ЯРУС ${deck+1}/6 · ИССЛЕДУЙ ТРИ КРЫЛА (${solved}/3) · БЕЗ КОНТРОЛЬНЫХ ТОЧЕК`;
  },
  getContextLesson(){
   const def=stageForPlayer();if(!def){const deck=Math.min(5,Math.max(0,Math.floor((game.playerPosition.y+.2)/TOWER_RISE)));
    if(deck===0&&game.playerPosition.x>6&&game.playerPosition.x<14.5
     &&game.playerPosition.z< -6&&game.playerPosition.z> -14.5){
     return ['tower-service','W A S D',serviceGate.collider.enabled?
      'Сервисный переход между востоком и севером заперт. Первый живой луч центрального узла питает его створку.':
      'Сервисный переход открыт: северное крыло доступно через соседний машинный отсек.',false];
    }
    const state=keystones.getState(deck),feed=state?.feedModes[state?.feeds.indexOf(false)];
    return ['tower-hub','W A S D',relays[deck]?(feed?
     `Следующий вход: ${TOWER_STAGES[deck*3+feed.branch].branchName}. Проведи живой сигнал «${feedLabel[feed.mode]}» до гнезда за створкой.`:
     `Гнёзда заряжены. Исследуй центральный узел «${state.name}»: его приёмники, груз и приводы связаны с настоящими порталами.`):
     'Выбери одно из трёх машинных крыльев. Открой их в любом порядке.',false];}
   const state=stageStates[def.index],key=def.puzzle.requirements.some(r=>['beamA','beamB','airA','transit'].includes(r))?'ЛКМ · ПКМ':'E';
   return [`tower-${def.id}`,key,state.solved?'Питание этого крыла уже поступает в центральный узел.':
    `${def.name}: проследи связь механизма со створкой. Поставь друга перед выстрелом; после решения забери его.`,false];
  },
  nearbyInteraction(){
   const def=stageForPlayer(),room=def&&rooms[def.index];
   if(room&&!game.heldCube&&enteredControl(room))return {kind:'tower-console',label:'E',text:'Переключить настоящий привод крыла'};
   if(!def&&!game.heldCube){const deck=Math.min(5,Math.max(0,Math.floor((game.playerPosition.y+.2)/TOWER_RISE)));
    const action=keystones.nearbyInteraction(deck);if(action)return action;}
   return !game.heldCube&&game.cargo&&near(game.playerPosition,game.cargo.position,2.2)?'E — взять друга':'';
  },
  interact,cargoOnAnyPad:()=>TOWER_STAGES.some(s=>game.cargoOnPad?.(V(...s.cargoPad),2))
   ||[1,3,5].some(deck=>game.cargoOnPad?.(V(0,deck*TOWER_RISE,deck===1||deck===5?-5.5:0),1.45)),
  getLaunch:()=>null,isWon:()=>won,reset,update,onTeleport,
  playerAcceleration(position,velocity){
   const central=keystones.playerAcceleration(position,velocity);if(central?.lengthSq?.()>0)return central;
   for(const room of rooms)if(stageNearby(room.definition,position)){
    const a=room.mechanism.playerAcceleration?.(position,velocity);if(a?.lengthSq?.()>0)return a;
   }
   return V();
  },
  applyCargoForces(dt){
   keystones.applyCargoForces(dt);
   for(const room of rooms)if(stageNearby(room.definition,game.cargo?.position))room.mechanism.applyCargoForces?.(dt);
  },
  diagnostics:()=>({id:TOWER_SPEC.id,tower:true,portalPuzzle:true,...metrics()}),
  renderUpdate(){
   if(game.keyLight){const y=game.playerPosition?.y??0;game.keyLight.position.set(-18,y+23,15);
    game.keyLight.target.position.set(0,y+3,-3);game.keyLight.target.updateMatrixWorld();}
  },
  dispose(){
   if(disposed)return;disposed=true;game.scene.background=background;game.scene.fog=fog;
   if(lightPose){game.keyLight.position.copy(lightPose.position);game.keyLight.target.position.copy(lightPose.target);}
   towerArt.dispose();
   keystones.dispose();
   for(const room of rooms)room.mechanism.dispose?.();
   for(const collider of all.colliders)game.physics?.removeStaticBox(collider.mesh.uuid);
   const remove=(array,removed)=>{const set=new Set(removed);let write=0;
    for(const value of array)if(!set.has(value))array[write++]=value;array.length=write;};
   remove(game.colliders,all.colliders);remove(game.floors,all.floors);
   remove(game.cameraBlockers,all.meshes);remove(game.aimBlockers,all.meshes);
   remove(game.portalPanels,[...rooms.flatMap(room=>Object.values(room.panels)),...keystonePanels]);
   root.removeFromParent();batches.forEach(batch=>batch.dispose());
   unit.dispose();crownGeometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
   game.indexColliders?.();
  },
 };
 return level;
}
