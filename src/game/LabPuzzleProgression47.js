import * as THREE from 'three';
import {Body,Box,Vec3,Material} from 'cannon-es';
import {ResearchChamber} from './LabResearchArt.js';
import {movingMechanismBlock} from './LabLateCampaignMechanisms.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
import {dressPuzzleProgression47} from './LabPuzzleProgression47Art.js';
const V=(...p)=>new THREE.Vector3(...p);
export const PROGRESSION47_SPEC=Object.freeze({
 id:'puzzle-progression47-impact-archive',title:'Ударный архив',accent:0xf0b88d,assets:[1,2,11,22,23,24],
 concept:'Один настоящий удар открывает архив. Спутник питает привод подвижного адреса, а настоящий выдвижной стопор сохраняет его положение после возвращения груза.',
 description:'Высокая грузовая галерея, стеклокерамическая перегородка и направляемый поршень образуют одну пространственную задачу. Верхний выход ждёт обоих путешественников.',
 hints:['Слабые удары не складываются. Высокая галерея и низкий грузовой адрес позволяют превратить падение свободного спутника в сильный удар.',
 'За керамикой видна направляющая верхнего белого адреса. Груз на минеральном приёмнике питает настоящий привод; без груза пружина возвращает его назад.',
 'Дальний пульт вводит настоящий поперечный стопор за поршень. Стопор можно убрать; пока он удерживает ход, верни спутника и используй совместившийся адрес.'],
});
function syncProxy(c,m){m.updateWorldMatrix(true,false);const box=new THREE.Box3().setFromObject(m);if(!c.geometrySize){c.mesh.geometry.computeBoundingBox();c.geometrySize=c.mesh.geometry.boundingBox.getSize(V());}const size=box.getSize(V());box.getCenter(c.mesh.position);c.mesh.quaternion.identity();c.mesh.scale.set(size.x/c.geometrySize.x,size.y/c.geometrySize.y,size.z/c.geometrySize.z);c.mesh.updateWorldMatrix(true,false);c.box.copy(box);}
function moving(k,name,p,s,mat){const mesh=movingMechanismBlock(k,name,p,s,mat),collider=k.game.collisionProxy(new THREE.Box3().setFromObject(mesh),{kinematic:true});return {mesh,collider};}
function partition(k,z,left,right,top){const {minX,maxX}=k.bounds,H=k.ceiling;
 for(const [x0,x1,y0,y1] of [[minX,left,0,H],[right,maxX,0,H],[left,right,top,H]])k.block([(x0+x1)/2,(y0+y1)/2,z],[x1-x0,y1-y0,.66],'shell');
}
/** Every mechanism is driven by a live body, actual contact or a reversible
 * switch. No visit flags or actor coordinates are used by room logic. */
export function buildPuzzleProgression47(g,index=46){
 const k=new ResearchChamber(g,PROGRESSION47_SPEC,index,'launch',{minX:-29,maxX:29,minZ:-31,maxZ:28},0,27);
 const balcony=k.deck('High freight acceleration balcony',-27,-11,8,24,12);
 k.ramp('Continuous mineral return incline',-11,-3,8,25,12,0);
 k.deck('Southern dry inspection landing',-11,-3,18,26,0);
 const well=k.loadPad('archive-gravity-well',[-16,0,6.2],8);
 const outlet=k.panel('archive-projectile-outlet',[0,3.4,5],[0,0,-1],7,6.8);outlet.mesh.userData.portalSize={width:1.8,height:1.1};
 k.block([0,1.105,4.75],[7,2.21,.5],'secondary');k.block([0,7.09,4.75],[7,5,.5],'secondary');
 partition(k,-4,-3.3,3.3,5.2);
 const ceramic=k.m.ceramic.clone();ceramic.name='47 / sacrificial glass ceramic';ceramic.color.setHex(0xabe0d6);ceramic.roughness=.25;
 const sheet=moving(k,'47 / original ceramic safety sheet',[0,2.6,-4],[6.6,5.2,.18],ceramic);
 const pieces=[];for(let row=0;row<4;row++)for(let col=0;col<4;col++){const a=moving(k,`47 / physical ceramic shard ${row}-${col}`,[-2.475+col*1.65,.65+row*1.3,-4],[1.60,1.25,.13],ceramic);a.mesh.visible=false;a.collider.enabled=false;pieces.push(a);}
 const fuse={owner:null,sheetBody:null,energy:0,broken:false,bodies:[],listener:null,ensure(){if(!g.physics||this.owner===g.physics)return;this.owner=g.physics;this.owner.removeStaticBox(sheet.collider.mesh.uuid);this.sheetBody=new Body({mass:0,type:Body.STATIC,position:new Vec3(0,2.6,-4),shape:new Box(new Vec3(3.3,2.6,.09)),material:new Material({friction:.5,restitution:.04}),collisionFilterGroup:1,collisionFilterMask:2});this.sheetBody.labId=sheet.collider.mesh.uuid;this.owner.world.addBody(this.sheetBody);
  this.listener=e=>{if(e.body.labId!==sheet.collider.mesh.uuid||this.broken||g.heldCube)return;const speed=Math.abs(e.contact.getImpactVelocityAlongNormal());this.energy=Math.max(this.energy,.5*e.target.mass*speed*speed);if(this.energy>=175)this.break(speed);};this.owner.cargoBody.addEventListener('collide',this.listener);},
  break(speed){this.broken=true;sheet.mesh.visible=false;sheet.collider.enabled=false;this.sheetBody.collisionFilterMask=0;this.owner.world.broadphase.dirty=true;
   for(let n=0;n<pieces.length;n++){const a=pieces[n];a.mesh.visible=true;a.collider.enabled=true;this.owner.removeStaticBox(a.collider.mesh.uuid);const b=new Body({mass:.12,shape:new Box(new Vec3(.80,.625,.065)),position:new Vec3(...a.mesh.position.toArray()),material:new Material({friction:.75,restitution:.04}),collisionFilterGroup:3,collisionFilterMask:3});b.velocity.set((n%4-1.5)*.8,1.2+n%3*.3,-Math.min(4,speed*.16));b.angularVelocity.set(n%3*.7,.5,.2);this.owner.world.addBody(b);this.bodies.push(b);}},
  update(){this.ensure();this.bodies.forEach((b,n)=>{const a=pieces[n];a.mesh.position.set(b.position.x,b.position.y,b.position.z);a.mesh.quaternion.set(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);syncProxy(a.collider,a.mesh);});},
  reset(){this.ensure();this.energy=0;this.broken=false;sheet.mesh.visible=true;sheet.collider.enabled=true;this.sheetBody.collisionFilterMask=2;this.owner.world.broadphase.dirty=true;this.bodies.forEach(b=>this.owner.world.removeBody(b));this.bodies=[];pieces.forEach((a,n)=>{a.mesh.visible=false;a.collider.enabled=false;this.owner.setStaticEnabled(a.collider.mesh.uuid,false);a.mesh.position.set(-2.475+n%4*1.65,.65+Math.floor(n/4)*1.3,-4);a.mesh.quaternion.identity();});},
 };
 k.ticks.push(()=>fuse.update());k.resets.push(()=>fuse.reset());
 // The drive receives the same free rigid companion on an unportalable
 // mineral support. Cargo behaviour stays quiet while its real weight loads it.
 const loadSupport={center:V(-16,0,-14),normal:V(0,1,0),right:V(1,0,0),up:V(0,0,-1),halfWidth:2.5,halfHeight:2.5};
 k.block([-16,.035,-14],[5,.07,5],'secondary',false);const loaded=()=>cargoLoadsPlate(g.cargo,g.heldCube,loadSupport);
 const goalDeck=k.deck('High aligned archive receiving gallery',3,17,-17,-7,8);
 // An opaque wall masks the address everywhere except its receiving window.
 for(const [x0,x1]of [[-28,4.6],[12.0,28]])k.block([(x0+x1)/2,13.5,-17.2],[x1-x0,27,.70],'shell');
 k.block([8.3,21.1,-17.2],[7.4,11.8,.70],'shell');
 k.block([8.3,.7,-17.2],[7.4,1.4,.70],'shell');
 const carriage=new THREE.Group();carriage.name='47 / actual dynamic piston address';carriage.position.set(-8,0,-19.4);k.world.root.add(carriage);
 const head=k.block([0,1.1,0],[1.4,2,2.2],'secondary',false,carriage);
 const mast=k.block([0,6.1,-.35],[.72,8.4,.72],'metal',false,carriage);
 const headCollider=g.collisionProxy(new THREE.Box3().setFromObject(head),{kinematic:true}),mastCollider=g.collisionProxy(new THREE.Box3().setFromObject(mast),{kinematic:true});
 const address=k.panel('archive-moving-address',[0,10.85,0],[0,0,1],7.6,5.8,carriage,true);
 // Physical end stops bound the stroke through contact, not coordinate clamps.
 k.block([-9.3,1.1,-19.4],[.35,2.2,3.2],'dark');const backStopCollider=k.envelopes.at(-1);
 k.block([9.15,1.1,-19.4],[.35,2.2,3.2],'dark');const frontStopCollider=k.envelopes.at(-1);
 const pinMesh=k.block([7.25,1.1,-24.5],[.42,2.2,2.6],'metal',false);
 const pinCollider=g.collisionProxy(new THREE.Box3().setFromObject(pinMesh),{kinematic:true});
 const drive={owner:null,body:null,pinBody:null,pinInserted:false,powered:false,contacts:0,ensure(){if(!g.physics||this.owner===g.physics)return;this.owner=g.physics;this.owner.removeStaticBox(pinCollider.mesh.uuid);this.owner.removeStaticBox(headCollider.mesh.uuid);this.owner.removeStaticBox(mastCollider.mesh.uuid);for(const c of [backStopCollider,frontStopCollider])this.owner.solids.get(c.mesh.uuid).body.collisionFilterMask=10;
   this.body=new Body({mass:6,position:new Vec3(-8,1.1,-19.4),shape:new Box(new Vec3(.7,1,1.1)),linearFactor:new Vec3(1,0,0),fixedRotation:true,linearDamping:.04,material:new Material({friction:.25,restitution:0}),collisionFilterGroup:9,collisionFilterMask:7});this.body.addShape(new Box(new Vec3(.36,4.2,.36)),new Vec3(0,5,-.35));this.owner.world.addBody(this.body);
   this.pinBody=new Body({mass:0,type:Body.KINEMATIC,allowSleep:false,position:new Vec3(7.25,1.1,-24.5),shape:new Box(new Vec3(.21,1.1,1.3)),material:new Material({friction:.5,restitution:0}),collisionFilterGroup:1,collisionFilterMask:10});this.owner.world.addBody(this.pinBody);
  },force(){this.ensure();const b=this.body;this.powered=loaded();b.wakeUp();b.force.y+=b.mass*19.5;b.force.x+=(this.powered?150:0)-7*(b.position.x+8)-8*b.velocity.x;
   const target=this.pinInserted?-19.4:-24.5,delta=target-this.pinBody.position.z;if(Math.abs(delta)>.001)this.pinBody.wakeUp();this.pinBody.velocity.z=Math.sign(delta)*Math.min(3,Math.abs(delta)*10);},
  update(){this.ensure();const b=this.body;carriage.position.x=b.position.x;carriage.updateWorldMatrix(true,true);address.sync(0);syncProxy(headCollider,head);syncProxy(mastCollider,mast);pinMesh.position.z=this.pinBody.position.z;syncProxy(pinCollider,pinMesh);
   this.contacts=this.owner.world.contacts.filter(c=>(c.bi===this.body&&c.bj===this.pinBody)||(c.bj===this.body&&c.bi===this.pinBody)).length;},
  reset(){this.ensure();this.pinInserted=this.powered=false;this.body.position.set(-8,1.1,-19.4);this.body.velocity.setZero();this.body.force.setZero();this.body.type=Body.DYNAMIC;this.pinBody.position.set(7.25,1.1,-24.5);this.pinBody.velocity.setZero();this.update();},
 };
 k.forces.push(()=>drive.force());k.ticks.push(()=>drive.update());k.resets.push(()=>drive.reset());
 const pinControl=k.control('archive-contact-stop',[22,0,-12],()=>{drive.pinInserted=!drive.pinInserted;},'E — ввести / убрать настоящий поперечный стопор. Без груза привод возвращается.');
 const entrance=k.panel('archive-observer-entry',[-25,2.85,-9],[1,0,0],7.6,5.8);
 k.wire([[-16,.13,-14],[-16,.13,-25],[-8,.13,-25],[-8,1.1,-19.4]],loaded);
 k.label('47 / УДАРНЫЙ АРХИВ',[-27.6,18,18],[1,0,0],15,1.0);
 k.label('КЕРАМИЧЕСКИЙ ПРЕДОХРАНИТЕЛЬ',[0,8,-3.45],[0,0,1],15,.8);
 k.label('ПРИЁМНИК ПРИВОДА',[-16,.09,-14],[0,1,0],4.3,.5);
 k.label('ПОПЕРЕЧНЫЙ СТОПОР',[22,3.3,-10.6],[0,0,-1],8,.7);
 k.label('ОБЩИЙ ВЫХОД',[10,12,-7.2],[0,0,-1],9,.8);
 const art=dressPuzzleProgression47(k,{balcony,goalDeck,drive,head,pinMesh,address,sheet});
 const l=k.finishResearch([-23,12,19],[-21,12.6,17],[10,8,-10],{puzzleProgression:47,well,outlet,fuse,sheet,pieces,drive,pinControl,entrance,address,loadSupport,loaded,art,cargoOnAnyPad:loaded,spawnView:{yaw:.1,pitch:-.08}});
 l.getContextLesson=()=>['progression47-impact-and-contact','ЛКМ / ПКМ · E','Керамика реагирует на силу одного удара; слабые касания не суммируются. E — взять спутника или работать с видимым устройством.',false];
 l.puzzleGeometry={noProgressFlags:true,noCheckpoints:true,recoveryFloor:0,phaseCount:9,dependencies:['inspect-the-high-drop','route-a-cargo-sized-impact-address','release-original-cargo-with-real-gravity','fracture-with-one-sufficient-contact','gain-the-open-archive-view','load-the-live-piston-motor','insert-the-removable-contact-stop','retrieve-original-cargo-and-release-the-motor','use-the-aligned-moving-address-together'],impactThresholdJ:175,pistonDynamic:true,pinContact:true,portalRoles:{'archive-gravity-well':'real cargo fall converts height into impulse','archive-projectile-outlet':'cargo sized kinetic outlet','archive-observer-entry':'standing joint return entrance','archive-moving-address':'large address attached to an actual driven dynamic body'}};
 const prior=l.dispose;let disposed=false;l.dispose=()=>{if(disposed)return;disposed=true;if(fuse.listener)fuse.owner?.cargoBody.removeEventListener('collide',fuse.listener);for(const b of [...fuse.bodies,fuse.sheetBody,drive.body,drive.pinBody].filter(Boolean))drive.owner?.world.removeBody(b);ceramic.dispose();prior();};
 return l;
}
