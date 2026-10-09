import * as THREE from 'three';
import {Body,Box,Vec3,Material,HingeConstraint,LockConstraint} from 'cannon-es';
import {ResearchChamber} from './LabResearchArt.js';
import {tracePortalRay,beamDrawing,ringDevice} from './LabPuzzleMechanics.js';
import {buildTransferFunnel} from './LabTransferFunnel.js';
import {dressPuzzleProgression49} from './LabPuzzleProgression49Art.js';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
export const PROGRESSION49_SPEC=Object.freeze({id:'puzzle-progression49-optical-transfer',title:'Оптическая пересадка',accent:0xf2bf8a,assets:[1,2,11,22,23,24],
 concept:'Оригинальный груз наклоняет настоящий шарнир зеркала. Отражённый свет двигает физическую каретку; механические зажимы сохраняют опору, пока единственная пара работает с грузом и пассажиром.',
 description:'Два закрытых оптических приёмника питают рельсовую каретку. Под ней — сухой служебный возврат; напротив — постоянная галерея и общий док.',
 hints:['Грузовая чаша и зеркало закреплены на одном шарнире: вес меняет отражение. Свет проходит через ту же пару, что и путешественники.','Каретка движется, пока её настоящий приёмник видит отражённый луч. Постоянная галерея сохраняет достигнутый ракурс.','Зажим держит текущую физическую опору. Вынутый груз освобождает вес, но механический зажим зеркала сохраняет отражение; каретку нужно отпустить для дальнейшего хода.']});

/** A receiver must see the segment immediately following a real reflection,
 * travelling into its lens, before any opaque wall. No portal names/colours. */
export function reflectedReceiverLit(segments,position,incoming,{radius=.70,minDot=.999}={}){
 for(let i=1;i<segments.length;i++){
  const s=segments[i];if(segments[i-1].kind!=='mirror'||s.direction.dot(incoming)<minDot)continue;
  const u=position.clone().sub(s.a).dot(s.direction);if(u<.02||u>s.length+.005)continue;
  if(s.a.clone().addScaledVector(s.direction,u).distanceTo(position)<radius)return true;
 }return false;
}
/** The oblique optical plate is opaque in its actual local rectangular volume,
 * rather than the empty wedge enclosed by its player broad-phase AABB. All
 * other structures keep the production ray tracer and actual portal mapping. */
export function traceProgression49Light(game,origin,direction,mirror,plate){
 const segments=tracePortalRay(game,origin,direction,{length:180,reflectors:[mirror],bounces:8});
 plate.group.updateWorldMatrix(true,false);
 const inverse=plate.group.matrixWorld.clone().invert(),volume=new THREE.Box3(V(-plate.width/2,-plate.height/2,-.24),V(plate.width/2,plate.height/2,0));
 for(let i=0;i<segments.length;i++){
  const s=segments[i],ray=new THREE.Ray(s.a.clone().applyMatrix4(inverse),s.direction.clone().transformDirection(inverse)),localHit=ray.intersectBox(volume,V());
  if(!localHit)continue;const hit=localHit.applyMatrix4(plate.group.matrixWorld),distance=hit.clone().sub(s.a).dot(s.direction);
  if(distance<=.012||distance>s.length+.005)continue;
  // A true incoming portal segment ends on the optical face. Its aperture is
  // handled by the production tracer before any continuation is generated.
  const portal=game.portals.portals.find(p=>p?.surfaceId===plate.mesh.uuid);
  if(s.kind==='portal'&&portal&&s.b.distanceTo(portal.position)<Math.max(portal.width,portal.height)+.01&&Math.abs(s.b.clone().sub(portal.position).dot(portal.normal))<.001)continue;
  return [...segments.slice(0,i),{...s,b:hit,length:distance,kind:'wall'}];
 }
 return segments;
}
function proxy(k,mesh,name){mesh.updateWorldMatrix(true,false);const c={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true,kinematic:true};mesh.name=name;k.game.colliders.push(c);k.game.cameraBlockers.push(mesh);k.game.aimBlockers.push(mesh);return c;}
function guidedCarriage(k){
 const g=k.game,group=new THREE.Group();group.name='49 / actual force driven rail carriage';k.world.root.add(group);group.position.set(-24,8.15,0);
 const floorMesh=k.block([0,-.4,6],[12,.8,12],'floor',false,group),floorCollider=proxy(k,floorMesh,'49 / physical carriage walking deck');
 const frontLip=k.block([0,.1,12],[12,.2,.24],'metal',false,group);
 const walls=[proxy(k,frontLip,'49 / low physical freight retaining threshold')];for(const [p,s]of [[[-6,1.5,6],[.5,3,12]],[[-6,5.65,6],[.5,.7,12]],[[6,.1,6],[.5,.2,12]],[[6,4.15,6],[.5,3.7,12]]]){const mesh=k.block(p,s,'shell',false,group);walls.push(proxy(k,mesh,'49 / carriage side cheek'));}
 const roof=k.block([0,6.2,6],[12,.4,12],'secondary',false,group);walls.push(proxy(k,roof,'49 / enclosed carriage roof'));
 const rearLeft=k.block([-5,3,.2],[2,6,.45],'shell',false,group),rearRight=k.block([5,3,.2],[2,6,.45],'shell',false,group);walls.push(proxy(k,rearLeft,'49 / rear portal cheek'),proxy(k,rearRight,'49 / rear portal cheek'));
 const gateMesh=k.block([0,.15,-.35],[8,.3,.42],'secondary',false,group),gateCollider=proxy(k,gateMesh,'49 / light powered rear lower leaf');const gateMiddle=k.block([0,2.2,-.35],[8,.2,.42],'metal',false,group),gateMiddleCollider=proxy(k,gateMiddle,'49 / real rear inspection mullion');const gateTop=k.block([0,4.65,-.35],[8,2.7,.42],'secondary',false,group),gateTopCollider=proxy(k,gateTop,'49 / light powered rear upper leaf');
 const passenger=k.panel('passenger',[5.69,2.7,3.7],[-1,0,0],7.7,5.4,group,true);
 const freight=k.panel('carriage-freight',[5.69,1.18,10.5],[-1,0,0],6,2.1,group,true);freight.mesh.userData.portalSize={width:2,height:.85};
 const floor={minX:-30,maxX:-18,minZ:0,maxZ:12,y:8.15,mesh:floorMesh,enabled:true};g.floors.push(floor);k.world.floors.push(floor);
 const caliper=k.block([0,-3.5,6],[2.0,.55,4],'metal',false,group),brakePads=[];
 for(const x of [-1,1])brakePads.push(k.block([0,-3.2,6+x*1.0],[3.4,.55,.35],'secondary',false,group));
 const current=V(-24,8.15,0),previous=current.clone();
 const c={body:null,anchor:null,lock:null,owner:null,group,floor,passenger,freight,position:current,braked:false,gateProgress:0,powerA:false,powerB:false,
  ensure(){if(!g.physics||this.owner===g.physics)return;this.owner=g.physics;
   for(const p of [floorCollider,...walls])g.physics.removeStaticBox(p.mesh.uuid);
   this.body=new Body({mass:45,position:new Vec3(-24,8.15,0),fixedRotation:true,linearFactor:new Vec3(1,0,0),linearDamping:.03,allowSleep:false,material:new Material({friction:.85,restitution:0}),collisionFilterGroup:1,collisionFilterMask:3});
   this.body.addShape(new Box(new Vec3(6,.4,6)),new Vec3(0,-.4,6));this.body.addShape(new Box(new Vec3(6,.1,.12)),new Vec3(0,.1,12));
   this.body.addShape(new Box(new Vec3(.25,1.5,6)),new Vec3(-6,1.5,6));this.body.addShape(new Box(new Vec3(.25,.35,6)),new Vec3(-6,5.65,6));this.body.addShape(new Box(new Vec3(.25,.1,6)),new Vec3(6,.1,6));this.body.addShape(new Box(new Vec3(.25,1.85,6)),new Vec3(6,4.15,6));
   this.body.addShape(new Box(new Vec3(6,.2,6)),new Vec3(0,6.2,6));
   for(const x of [-5,5])this.body.addShape(new Box(new Vec3(1,3,.225)),new Vec3(x,3,.2));
   this.owner.world.addBody(this.body);this.anchor=new Body({mass:0,collisionFilterMask:0});this.owner.world.addBody(this.anchor);
   this.stops=[];for(const x of [-30.35,30.35]){const stop=new Body({mass:0,position:new Vec3(x,7.6,6),shape:new Box(new Vec3(.25,.2,6)),collisionFilterGroup:1,collisionFilterMask:1});this.owner.world.addBody(stop);this.stops.push(stop);}
  },toggleBrake(){this.ensure();if(this.lock){this.owner.world.removeConstraint(this.lock);this.lock=null;this.braked=false;}else{this.anchor.position.copy(this.body.position);this.anchor.quaternion.copy(this.body.quaternion);this.lock=new LockConstraint(this.anchor,this.body,{maxForce:2e5,collideConnected:false});this.owner.world.addConstraint(this.lock);this.braked=true;}this.body.wakeUp();},
  forces(){this.ensure();const b=this.body;if(!b)return;const target=this.powerB?24:this.powerA?0:-24;b.force.x+=(target-b.position.x)*95-b.velocity.x*140;},
  update(dt){this.ensure();if(!this.body)return;previous.copy(current);current.set(this.body.position.x,this.body.position.y,this.body.position.z);const delta=current.clone().sub(previous),p=g.playerPosition;
   // Continuous support motion follows the actual physical body displacement.
   if(dt&&g.playerGrounded&&Math.abs(p.y-floor.y)<.04&&p.x>floor.minX+.001&&p.x<floor.maxX-.001&&p.z>floor.minZ+.001&&p.z<floor.maxZ-.001){p.add(delta);g.previousPlayerPosition.add(delta);}
   group.position.copy(current);this.gateProgress=THREE.MathUtils.damp(this.gateProgress,this.powerA?1:0,5,dt);gateMesh.position.x=10*this.gateProgress;gateTop.position.x=gateMesh.position.x;gateMiddle.position.x=gateMesh.position.x;
   
   group.updateWorldMatrix(true,true);floor.minX=current.x-6;floor.maxX=current.x+6;floor.minZ=current.z;floor.maxZ=current.z+12;floor.y=current.y;
   for(const p of [floorCollider,...walls]){p.box.setFromObject(p.mesh);g.physics.removeStaticBox(p.mesh.uuid);}
   for(const p of [gateCollider,gateTopCollider,gateMiddleCollider]){p.box.setFromObject(p.mesh);g.physics.updateStaticBox(p.mesh.uuid,p.box,dt,p.enabled);}passenger.sync(dt);freight.sync(dt);
   brakePads.forEach((p,i)=>p.position.z=6+(i?1:-1)*(this.braked?.42:1.0));caliper.material=k.m.metal;
  },loaded(){if(g.heldCube||!this.body)return false;return this.owner.world.contacts.some(c=>(c.bi===this.body&&c.bj===g.physics.cargoBody)||(c.bj===this.body&&c.bi===g.physics.cargoBody));},
  reset(){this.ensure();if(this.lock)this.owner.world.removeConstraint(this.lock);this.lock=null;this.braked=this.powerA=this.powerB=false;this.gateProgress=0;this.body.position.set(-24,8.15,0);this.body.quaternion.set(0,0,0,1);this.body.velocity.setZero();this.body.force.setZero();current.set(-24,8.15,0);previous.copy(current);this.toggleBrake();this.update(0);},
  dispose(){if(!this.owner)return;if(this.lock)this.owner.world.removeConstraint(this.lock);for(const b of [this.body,this.anchor,...this.stops])this.owner.world.removeBody(b);this.owner=null;}
 };
 k.forces.push(()=>c.forces());k.ticks.push(dt=>c.update(dt));k.resets.push(()=>c.reset());k.state.carriage=c;return c;
}
function hingedMirror(k){
 const g=k.game,root=new THREE.Group();root.name='49 / rigid mirror and original weight cradle';k.world.root.add(root);root.position.set(-14,10.5,-18);
 const tray=k.block([1.8,0,0],[3.6,.28,3.2],'metal',false,root);const trayCollider=proxy(k,tray,'49 / actual hinged cargo tray');trayCollider.ignorePropagation=true;
 const mirrorMat=new THREE.MeshStandardMaterial({name:'49 / polished real hinged mirror',color:0xe0f6e6,metalness:.93,roughness:.12,side:THREE.DoubleSide});
 const normal=V(-Math.SQRT1_2,Math.SQRT1_2,0).applyAxisAngle(V(0,0,1),.18);
 const mirror=k.geometry(new THREE.CylinderGeometry(1.7,1.7,.09,32),mirrorMat,[-1.3,2,0],Q().setFromUnitVectors(V(0,1,0),normal),{parent:root,batch:false,name:'49 / actual reflecting face'});
 for(const x of [-.2,3.6])k.block([x,.38,0],[.23,.75,3.25],'secondary',false,root);for(const z of [-1.72,1.72])k.block([1.8,.4,z],[3.6,.9,.24],'secondary',false,root);k.block([-10.8,9.55,-18],[.8,.36,2],'metal');
 const m={body:null,anchor:null,hinge:null,lock:null,owner:null,root,mirror,normal:normal.clone(),position:V(-15.3,12.5,-18),radius:1.65,angle:0,clamped:false,
  ensure(){if(!g.physics||this.owner===g.physics)return;this.owner=g.physics;g.physics.removeStaticBox(tray.uuid);
   this.anchor=new Body({mass:0,position:new Vec3(-14,10.5,-18),collisionFilterMask:0});
   this.body=new Body({mass:8,position:new Vec3(-14,10.5,-18),angularDamping:.25,allowSleep:false,material:new Material({friction:1.3,restitution:0}),collisionFilterGroup:1,collisionFilterMask:3});
   this.body.addShape(new Box(new Vec3(1.8,.14,1.6)),new Vec3(1.8,0,0));
   for(const x of [-.2,3.6])this.body.addShape(new Box(new Vec3(.115,.375,1.625)),new Vec3(x,.38,0));for(const z of [-1.72,1.72])this.body.addShape(new Box(new Vec3(1.8,.45,.12)),new Vec3(1.8,.4,z));
   this.stop=new Body({mass:0,position:new Vec3(-10.8,9.55,-18),shape:new Box(new Vec3(.4,.18,1)),collisionFilterGroup:1,collisionFilterMask:1});this.owner.world.addBody(this.stop);this.owner.world.addBody(this.anchor);this.owner.world.addBody(this.body);this.hinge=new HingeConstraint(this.anchor,this.body,{pivotA:new Vec3(),pivotB:new Vec3(),axisA:new Vec3(0,0,1),axisB:new Vec3(0,0,1),maxForce:1e6,collideConnected:false});this.owner.world.addConstraint(this.hinge);
  },toggleClamp(){this.ensure();if(this.lock){this.owner.world.removeConstraint(this.lock);this.lock=null;this.clamped=false;}else{this.lock=new LockConstraint(this.anchor,this.body,{maxForce:1e6,collideConnected:false});this.owner.world.addConstraint(this.lock);this.clamped=true;}this.body.wakeUp();},
  forces(){this.ensure();this.body.torque.z+=-680*this.angle-130*this.body.angularVelocity.z;},
  update(){this.ensure();if(!this.body)return;root.position.set(this.body.position.x,this.body.position.y,this.body.position.z);root.quaternion.set(this.body.quaternion.x,this.body.quaternion.y,this.body.quaternion.z,this.body.quaternion.w);root.updateWorldMatrix(true,true);this.angle=new THREE.Euler().setFromQuaternion(root.quaternion,'XYZ').z;this.normal.copy(normal).applyQuaternion(root.quaternion);this.position.set(-1.3,2,0).applyQuaternion(root.quaternion).add(root.position);trayCollider.box.setFromObject(tray);g.physics.removeStaticBox(tray.uuid);},
  loaded(){return !g.heldCube&&this.owner?.world.contacts.some(c=>(c.bi===this.body&&c.bj===g.physics.cargoBody)||(c.bj===this.body&&c.bi===g.physics.cargoBody));},
  reset(){this.ensure();if(this.lock)this.owner.world.removeConstraint(this.lock);this.lock=null;this.clamped=false;this.body.position.set(-14,10.5,-18);this.body.quaternion.set(0,0,0,1);this.body.velocity.setZero();this.body.angularVelocity.setZero();this.body.force.setZero();this.body.torque.setZero();this.update();},
  dispose(){if(!this.owner)return;if(this.lock)this.owner.world.removeConstraint(this.lock);this.owner.world.removeConstraint(this.hinge);this.owner.world.removeBody(this.body);this.owner.world.removeBody(this.anchor);this.owner.world.removeBody(this.stop);mirrorMat.dispose();this.owner=null;}
 };k.forces.push(()=>m.forces());k.ticks.push(()=>m.update());k.resets.push(()=>m.reset());k.state.mirror=m;return m;
}
function receiver(k,name,p,direction){
 const incoming=V(...direction).normalize(),position=V(...p),normal=incoming.clone().negate();const device=ringDevice(k.world,p,normal.toArray(),0x8fe8c5,.9);
 // A short opaque cardinal tube follows the dominant incident axis.
 // Every visible wall is its exact collision box, including the closed back.
 const axis=['x','y','z'].reduce((a,b)=>Math.abs(incoming[a])>Math.abs(incoming[b])?a:b),cross=['x','y','z'].filter(a=>a!==axis),housing=[];
 for(let i=0;i<4;i++){
  const center=position.clone().addScaledVector(incoming,-1+(i+.5)*.25);
  for(let n=0;n<2;n++)for(const side of [-1,1]){
   const at=center.clone(),size=V(2.1,2.1,2.1);at[cross[n]]+=side*1.05;size[cross[n]]=.22;size[axis]=Math.abs(incoming[axis])*.25;
   const wall=k.block(at.toArray(),size.toArray(),'dark');wall.name=name+' / opaque receiver tube';housing.push(wall);
  }
 }
 const backSize=V(2.1,2.1,2.1);backSize[axis]=.2;const back=k.block(position.clone().addScaledVector(incoming,.25).toArray(),backSize.toArray(),'metal');back.name=name+' / closed receiver back';housing.push(back);
 const r={name,position,incoming,normal,device,housing,lit:false};return r;
}
export function buildPuzzleProgression49(game,index=48){
 const k=new ResearchChamber(game,PROGRESSION49_SPEC,index,'tidal',{minX:-46,maxX:38,minZ:-33,maxZ:31},-4,29);
 const entryDeck=k.deck('Optical departure court',-36,-16,10,28,8);k.deck('Western optical viewing walk',-36,-28,-25,10,8);const gallery=k.deck('Permanent opposite optical gallery',-4,10,-14,1,8),goalDeck=k.deck('Final joint optical dock',26,36,0,18,8);
 k.ramp('Dry broad departure return',-45,-37,-12,10,-4,8);k.deck('Dry return landing',-45,-28,10,18,8);
 const cargoInput=k.loadPad('cargo-feed',[-29,8,20],7);cargoInput.surface.mesh.userData.portalSize={width:2,height:2};
 const carriage=guidedCarriage(k),mirror=hingedMirror(k);
 // An enclosed cargo pocket has a low visible inspection throat. Its original
 // companion remains beyond hand reach and beneath an actual solid roof.
 k.block([-11.4,9.45,-18],[3.8,.4,7],'dark');
 k.block([-17,11.9,-18],[.6,5.4,7],'shell');k.block([-8.2,10.45,-18],[.6,2.5,7],'shell');k.block([-8.2,14.45,-18],[.6,1.0,7],'shell');
 k.block([-13,14.95,-18],[8,.4,7.6],'secondary');
 k.block([-13,9.7,-14.4],[8,.4,.5],'shell');k.block([-13,11.5,-14.4],[8,.1,.5],'metal');
 k.block([-13,9.7,-21.6],[8,.4,.5],'shell');k.block([-13,13.25,-21.6],[8,3.3,.5],'secondary');
 const freight=k.panel('mirror-freight',[-11.7,11.5,-19.81],[0,0,1],5,2.1);freight.mesh.userData.portalSize={width:2,height:.85};
 const cargoArrival=freight;
 // Light reaches the overhanging head through the real side window. Its
 // first vertical reflection clears the cargo chassis on the left; each
 // receiver accepts a finite reflected segment in its physical lens direction.
 const source=k.panel('optical-source',[-30,14,-12],[0,0,1],6.6,5.0);source.mesh.userData.portalSize={width:1.8,height:.7};
 k.projector([-30,14,-5],[0,0,-1],{radius:.55});
 const outletA=k.panel('optical-branch-a',[-7.1,12.5,-18],[-1,0,0],5,4);outletA.mesh.userData.portalSize={width:.85,height:.6};
 const outletBPosition=V(2,17,26),loadedMirror=V(-14.91,12.70,-18),incidentB=loadedMirror.clone().sub(outletBPosition).normalize();
 const outletB=k.panel('optical-branch-b',outletBPosition.toArray(),incidentB.toArray(),5,4);outletB.mesh.userData.portalSize={width:1.4,height:.7};
 outletB.collider.opticallyTransparent=true; // exact opaque local plate is traced below
 // A real deep optical hood admits the later northward carriage view,
 // while its lower lip blocks steep shots from the dry recovery floor.
 // Cardinal stepped walls have the same visible geometry and exact collision
 // boxes. Their centreline follows the oblique optical head without rotated
 // AABB wedges inside the opening.
 for(let i=0;i<12;i++){
  const c=outletBPosition.clone().addScaledVector(incidentB,(i+.5)*.5),depth=Math.abs(incidentB.z)*.5;
  for(const [offset,size]of [[[2.9,0,0],[.55,5,depth]],[[-2.9,0,0],[.55,5,depth]],[[0,2.5,0],[5.8,.55,depth]],[[0,-2.5,0],[5.8,.55,depth]]])k.block(c.clone().add(V(...offset)).toArray(),size,'secondary');
 }
const receiverA=receiver(k,'First optical receiver',[-14.91,6,-18],[0,-1,0]),reflectedB=incidentB.clone().reflect(V(-Math.SQRT1_2,Math.SQRT1_2,0)),receiverB=receiver(k,'Second optical receiver',loadedMirror.clone().addScaledVector(reflectedB,8).toArray(),reflectedB.toArray());
 const drawing=beamDrawing(k.world,0xa6f0c8,.035),optics={source:V(-30,14,-5.05),direction:V(0,0,-1),segments:[],receiverA,receiverB,
  update(){this.segments=traceProgression49Light(game,this.source,this.direction,mirror,outletB);receiverA.lit=reflectedReceiverLit(this.segments,receiverA.position,receiverA.incoming);receiverB.lit=reflectedReceiverLit(this.segments,receiverB.position,receiverB.incoming);carriage.powerA=receiverA.lit;carriage.powerB=receiverB.lit;drawing.update(this.segments);receiverA.device.glow.material.color.setHex(receiverA.lit?0x9af5c7:0x52615e);receiverB.device.glow.material.color.setHex(receiverB.lit?0x9af5c7:0x52615e);}};
 // This high screen hides branch B from the original western court while
 // leaving the lower first optical branch genuinely observable.
 k.block([-11,19.4,20],[.8,14,20],'shell');
 const galleryEntry=k.panel('gallery-passenger',[8.5,10.7,-3],[0,0,-1],7.7,5.4);
 // A north-facing physical inspection bay masks the first court's transverse
 // views. Its open head-on approach lies on the permanent gallery.
 for(const x of [5,12])k.block([x,11,-5.75],[.4,6,5.5],'shell');
 k.block([8.5,14.3,-5.75],[7.4,.3,5.5],'secondary');
 const field=buildTransferFunnel(k,{origin:[-4.6,9.33,10.5],direction:[1,0,0],radius:2.0,speed:5});
 field.enabled=false;field.reversed=true;
 const clamp=k.control('mirror-clamp',[4,8,-10],()=>mirror.toggleClamp(),'E — сжать / отпустить реальные шарнирные колодки зеркала.');
 const brake=k.control('rail-brake',[4,8,-5],()=>carriage.toggleBrake(),'E — сжать / отпустить механический рельсовый зажим.');
 const extraction=k.control('freight-field',[0,8,-10],()=>{field.enabled=!field.enabled;field.reversed=true;field.update(0);},'E — включить / выключить обратный грузовой канал.');
 const aboardBrake=k.control('onboard-brake',[0,8.15,4],()=>carriage.toggleBrake(),'E — сжать / отпустить тот же рельсовый зажим.');
 const aboardTerminalOrigin=aboardBrake.position.clone();
 k.ticks.push(()=>{aboardBrake.position.copy(aboardTerminalOrigin).add(V(carriage.position.x,0,0));aboardBrake.art.position.x=carriage.position.x;aboardBrake.art.updateWorldMatrix(true,true);game.syncCollision(aboardBrake.collider,new THREE.Box3().setFromObject(aboardBrake.art),0);optics.update();});
 k.resets.push(()=>{field.enabled=false;field.reversed=true;field.update(0);});
 k.forces.push(()=>{if(game.heldCube||!game.physics?.cargoBody)return;const b=game.physics.cargoBody,a=field.acceleration(V(b.position.x,b.position.y,b.position.z),V(b.velocity.x,b.velocity.y,b.velocity.z),.39);if(a.lengthSq()){b.wakeUp();b.force.x+=a.x*b.mass;b.force.y+=a.y*b.mass;b.force.z+=a.z*b.mass;}});
 k.label('49 / ОПТИЧЕСКАЯ ПЕРЕСАДКА',[-36.5,17,20],[1,0,0],13,1.1);k.label('ШАРНИР / ГРУЗОВАЯ ЧАША',[-13,16.6,-14.05],[0,0,1],10,.65);
 k.label('ПОСТОЯННАЯ ГАЛЕРЕЯ',[3,8.035,-7],[0,1,0],9,.7);k.label('ОБЩИЙ ДОК',[31,13.5,14.5],[0,0,-1],8,.8);
 const art=dressPuzzleProgression49(k,{entryDeck,gallery,goalDeck,carriage,mirror,receiverA,receiverB});
 const l=k.finishResearch([-28,8,25],[-31,8.6,24],[31,8,7],{puzzleProgression:49,puzzleProgression49:true,carriage,mirror,optics,receiverA,receiverB,source,outletA,outletB,cargoInput,cargoArrival,freight,galleryEntry,field,clamp,brake,extraction,aboardBrake,art,spawnView:{yaw:.3,pitch:0},cargoOnAnyPad:()=>mirror.loaded()||carriage.loaded()||cargoInput.loaded()});
 const dispose=l.dispose;l.dispose=()=>{carriage.dispose();mirror.dispose();dispose();};
 l.getObjective=()=>`Оба приёмника реагируют на настоящее отражение. ${carriage.braked?'Рельсовый зажим сжат.':'Рельс свободен.'} ${mirror.clamped?'Шарнир удерживается колодками.':'Чаша вращает зеркало своим весом.'}`;
 l.getContextLesson=()=>['progression49-optical-transfer','ЛКМ / ПКМ','Вес наклоняет настоящий шарнир. Одна пара работает со светом, грузом и пассажиром; свет питает силу рельсового двигателя, а механический зажим удерживает текущую физическую опору.',false];
 l.puzzleGeometry={noProgressFlags:true,phaseCount:10,recoveryFloor:-4,goalHeight:8,cargoThroatHeight:1.55,dependencies:['deliver-original-load-to-true-hinged-tray','route-reflected-light-to-directional-first-receiver','ride-force-driven-carriage','retain-permanent-new-viewpoint','clamp-physical-mirror-before-removing-weight','engage-real-reversible-rail-brake','extract-original-weight-through-low-freight-pair','board-through-moving-passenger-portal','reroute-real-reflection-to-second-receiver-and-release-brake','arrive-at-joint-dock-with-original-cargo']};
 return l;
}
