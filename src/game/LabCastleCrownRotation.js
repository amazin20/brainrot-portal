import * as THREE from 'three';
import {Body,Box,Vec3} from 'cannon-es';
import {V,clamp} from './LabSingularityKit.js';
import {createOrientedBoxContact,syncOrientedBoxContact} from './LabOrientedBoxContact.js';
import {castleMachineCasingGeometry} from './LabVisualAuditCastle.js';

const QUARTER=Math.PI/2,HEIGHT=10.8,SKIN=.12;
/** Fixed portal addresses serve two different spatial changes: an opaque
 * aiming shutter, then a transverse passage. Every rotating skin is the
 * original registered Cannon Box, never its axis-aligned envelope. */
export function buildCastleCrownRotation({game,k,room,standing,complete,plate,sign,available=()=>true}){
 const {P}=room,m=k.m,parts=[],rotors=[];
 let owner=null,originalCargo=null,originalBody=null,originalShape=null,originalTray=null,post=null,disposed=false,finished=false;
 const fixed=(name,p,size,mat=m.dark)=>{const mesh=k.box(P(...p),size,mat);mesh.name='Crown spatial / '+name;parts.push(mesh);return mesh;};
 for(const[a,b]of [[-19,-10.7],[-9.3,19]])fixed('sealed east partition',[0,(a+b)/2,5.4],[.7,HEIGHT,b-a]);
 fixed('optical slit sill',[0,-10,.7],[.7,1.4,1.4]);fixed('optical slit lintel',[0,-10,7.05],[.7,7.5,1.4]);
 for(const[a,b]of [[-16,-11.3],[-4.7,0]])fixed('north gallery pier',[(a+b)/2,4,5.4],[b-a,HEIGHT,.5]);
 fixed('north gallery header',[-8,4,14.95],[6.6,8.1,.5]);
 const intake=k.panel('crown outer docking door',P(8,7,2.4),[1,0,0]);
 const outlet=k.panel('crown sealed docking door',P(-11,-10,2.4),[1,0,0]);
 for(const [id,p,size,axis]of [['sight',[-5,-7,5.4],[.30,HEIGHT,9.2],'x'],['passage',[-8,4,5.4],[6.2,HEIGHT,.30],'z']]){
  const mesh=k.box(P(...p),size,m.copper,{dynamic:true});mesh.name='Crown spatial / rotating '+id+' section';mesh.userData.keepMaterial=true;
  mesh.geometry=k.geo(castleMachineCasingGeometry(size,{axis,bays:2,sculpt:true}));mesh.material=k.mat(id==='sight'?0x937054:0x658483,.58,.4);mesh.material.vertexColors=true;
  const r={id,mesh,collider:mesh.userData.collider,half:V(...size).multiplyScalar(.5),pivot:V(...P(...p)),angle:0,target:0,blocked:false,body:null};
  r.radius=Math.hypot(r.half.x,r.half.z);
  r.warning=k.ring(P(p[0],p[1],.022),r.radius+SKIN,m.idle,{tube:.018,solid:false,dynamic:true});r.warning.name='Crown spatial / marked rotation clearance';rotors.push(r);
  // Above the whole blade envelope, a founded beam carries a real bearing.
  fixed(id+' founded head beam',[-8,p[1],11.55],[16,.4,.85],m.steel);
  fixed(id+' bearing housing',[p[0],p[1],11.2],[1.25,.6,1.25],m.dark);
  fixed(id+' bearing spindle',[p[0],p[1],10.85],[.3,.1,.3],m.copper);
 }
 const socket=P(-9,10,.14),contact=P(-9,15),receiverMesh=fixed('original load socket',[-9,10,.07],[3.2,.14,3.2],m.copper);
 const contactLamp=plate(contact,2.8,m.rose),socketLamps=[];
 for(const [x,z,sx,sz]of [[-10.66,10,.08,3.4],[-7.34,10,.08,3.4],[-9,8.34,3.24,.08],[-9,11.66,3.24,.08]])socketLamps.push(k.box(P(x,z,.0175),[sx,.035,sz],m.idle,{solid:false,dynamic:true}));
 sign?.('ПОВЕРНИ ЗАСЛОНКУ · ОТКРОЙ ЛИНИЮ К БЕЛОМУ ПРИЁМНИКУ',P(.52,-2,6),12,[1,0,0]);
 sign?.('ПОВОРОТ СЕКЦИИ МЕНЯЕТ ПРОХОД\nОСВОБОДИ ЗОНУ ВРАЩЕНИЯ',P(-13.65,3.70,7.8),4.3,[0,0,-1],2);
 function ensure(){
  if(disposed)return false;if(owner)return owner===game.physics;
  const physics=game.physics;if(!physics?.cargoBody||rotors.some(r=>!physics.solids.has(r.mesh.uuid))||!physics.solids.has(receiverMesh.uuid))return false;
  owner=physics;originalCargo=game.cargo;originalBody=physics.cargoBody;originalShape=originalBody.shapes[0];
  const tray=owner.solids.get(receiverMesh.uuid);originalTray={entry:tray,body:tray.body,shape:tray.body.shapes[0]};
  for(const r of rotors){
   owner.removeStaticBox(r.mesh.uuid);
   const b=r.body=new Body({mass:0,type:Body.KINEMATIC,position:new Vec3(r.pivot.x,r.pivot.y,r.pivot.z),material:owner.solidMaterial,collisionFilterGroup:1,collisionFilterMask:6});
   b.addShape(new Box(new Vec3(r.half.x,r.half.y,r.half.z)));b.quaternion.setFromAxisAngle(new Vec3(0,1,0),r.angle);owner.world.addBody(b);
   r.collider.orientedBox=createOrientedBoxContact(b,r.half,V(),owner.world.stepnumber);owner.registerBodyBox(r.mesh.uuid,{body:b,shapeIndex:0,orientedBox:r.collider.orientedBox});
  }
  post=()=>syncPose();owner.world.addEventListener('postStep',post);syncPose(true);return true;
 }
 function syncPose(reset=false){
  if(!ensure())return;
  for(const r of rotors){r.mesh.position.copy(r.body.position);r.mesh.quaternion.copy(r.body.quaternion);r.mesh.updateWorldMatrix(true,false);r.collider.box.setFromObject(r.mesh);syncOrientedBoxContact(r.collider.orientedBox,r.body,owner.world.stepnumber,reset);}
 }
 function originalLoad(){
  if(!ensure()||game.cargo!==originalCargo||owner.cargoBody!==originalBody||originalBody.shapes[0]!==originalShape||originalBody.type!==Body.DYNAMIC||!(originalBody.mass>0)||game.heldCube||owner.carryTarget||originalBody.world!==owner.world||!owner.world.bodies.includes(originalBody)||originalBody.collisionResponse===false||originalShape.collisionResponse===false)return null;
  const entry=owner.solids.get(receiverMesh.uuid),support=entry?.body,shape=support?.shapes[0],c=receiverMesh.userData.collider;
  if(entry!==originalTray.entry||support!==originalTray.body||shape!==originalTray.shape||!entry?.inWorld||support.world!==owner.world||!owner.world.bodies.includes(support)||support.collisionResponse===false||shape.collisionResponse===false||!c.enabled||!(support.collisionFilterMask&originalBody.collisionFilterGroup)||!(originalBody.collisionFilterMask&support.collisionFilterGroup)||!(shape.collisionFilterMask&originalShape.collisionFilterGroup)||!(originalShape.collisionFilterMask&shape.collisionFilterGroup))return null;
  if(c.box.getCenter(V()).distanceTo(V().copy(support.position))>1e-7||c.box.getSize(V()).multiplyScalar(.5).distanceTo(V().copy(shape.halfExtents))>1e-7||Math.abs(support.quaternion.x)+Math.abs(support.quaternion.y)+Math.abs(support.quaternion.z)>1e-7||support.shapeOffsets[0].length()>1e-7)return null;
  let force=0,contacts=0;
  for(const e of owner.world.contacts){if(e.enabled===false||!(e.multiplier>1e-6)||![e.bi,e.bj].includes(originalBody)||![e.bi,e.bj].includes(support)||![e.si,e.sj].includes(originalShape)||![e.si,e.sj].includes(shape))continue;const ny=(e.bi===originalBody?-1:1)*e.ni.y;if(ny>.65){force+=ny*e.multiplier;contacts++;}}
  originalBody.updateAABB();const a=originalBody.aabb;
  if(!contacts||!(force>0)||Math.abs(a.lowerBound.y-c.box.max.y)>.08||a.upperBound.x<c.box.min.x||a.lowerBound.x>c.box.max.x||a.upperBound.z<c.box.min.z||a.lowerBound.z>c.box.max.z)return null;
  return{worldStep:owner.world.stepnumber,originalCargoBodyId:originalBody.id,originalCargoShapeId:originalShape.id,supportBodyId:support.id,supportShapeId:shape.id,normalForce:force,contacts,freeOriginal:true};
 }
 function occupants(){
  const p=game.playerPosition,boxes=[];if(p)boxes.push(new THREE.Box3(V(p.x-.48,p.y,p.z-.48),V(p.x+.48,p.y+2.4,p.z+.48)));
  const b=game.physics?.cargoBody;if(b){b.updateAABB();boxes.push(new THREE.Box3(V().copy(b.aabb.lowerBound),V().copy(b.aabb.upperBound)).expandByScalar(.04));
   const t=game.physics.carryTarget,h=b.shapes[0]?.halfExtents;if(t&&h){const q=t.quaternion??b.quaternion,e=new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w)).elements,extent=V(Math.abs(e[0])*h.x+Math.abs(e[4])*h.y+Math.abs(e[8])*h.z,Math.abs(e[1])*h.x+Math.abs(e[5])*h.y+Math.abs(e[9])*h.z,Math.abs(e[2])*h.x+Math.abs(e[6])*h.y+Math.abs(e[10])*h.z).addScalar(.04),c=V().copy(t.position);boxes.push(new THREE.Box3(c.clone().sub(extent),c.clone().add(extent)));}
  }return boxes;
 }
 function occupied(r){return occupants().some(b=>{
  if(b.max.y<=r.pivot.y-r.half.y||b.min.y>=r.pivot.y+r.half.y)return false;
  const x=clamp(r.pivot.x,b.min.x,b.max.x),z=clamp(r.pivot.z,b.min.z,b.max.z);
  // Reserving the complete finite cylinder covers every intermediate angular
  // pose, including clear endpoints whose arc would strike an occupant.
  return Math.hypot(x-r.pivot.x,z-r.pivot.z)<r.radius+SKIN;
 });}
 function toggle(index){if(!available()||!ensure())return false;const r=rotors[index];if(!r)return false;r.target=r.target===0?QUARTER:0;return true;}
 const controls=[k.control('crown:sight',P(12,-14),()=>toggle(0),'Повернуть оптическую секцию · оставь зону вращения свободной',m.copper),k.control('crown:passage',P(-13,-1),()=>toggle(1),'Повернуть проход к северному приёмнику · оставь друга за разметкой',m.mint)];
 const state={intake,outlet,socket,contact,receiverMesh,rotors,parts,toggle,
  get loaded(){return Boolean(originalLoad());},get originalLoad(){return originalLoad();}};
 function update(dt){
  if(!ensure())return;
  for(const [i,r]of rotors.entries()){
   r.blocked=false;
   if(available()&&dt>0&&Number.isFinite(dt)&&Math.abs(r.target-r.angle)>1e-10){r.blocked=occupied(r);if(!r.blocked){r.angle+=clamp(r.target-r.angle,-Math.min(dt*.6,.08),Math.min(dt*.6,.08));r.body.quaternion.setFromAxisAngle(new Vec3(0,1,0),r.angle);r.body.aabbNeedsUpdate=true;owner.world.broadphase.dirty=true;}}
   controls[i].screen.material=r.blocked?m.rose:r.angle===r.target?m.live:m.cyan;
   r.warning.material=r.blocked?m.rose:m.idle;
  }
  syncPose();const witness=originalLoad();if(witness)originalBody.wakeUp();
  for(const lamp of socketLamps)lamp.material=witness?m.live:m.idle;contactLamp.material=witness?m.live:m.rose;
  if(!finished&&available()&&dt>0&&Number.isFinite(dt)&&witness&&standing(contact,1.3)){finished=true;complete('crown',{independentLoads:true,originalCargo:true,spatialMechanism:true,originalLoad:witness,rotorAngles:rotors.map(r=>r.angle),readsAchievements:false});}
 }
 function reset(){finished=false;for(const r of rotors){r.angle=r.target=0;r.blocked=false;if(r.body){r.body.quaternion.set(0,0,0,1);r.body.position.set(r.pivot.x,r.pivot.y,r.pivot.z);r.body.velocity.setZero();r.body.angularVelocity.setZero();r.body.aabbNeedsUpdate=true;}}syncPose(true);}
 function diagnostics(){return{ready:ensure(),disposed,originalLoad:originalLoad(),readsAchievements:false,checkpoint:false,rotors:rotors.map(r=>({id:r.id,angle:r.angle,target:r.target,blocked:r.blocked,bodyId:r.body?.id??null,shapeId:r.body?.shapes[0]?.id??null,exactCollision:r.body?owner.inspectBodyBox(r.mesh.uuid,{bounds:r.collider.box,orientedBox:r.collider.orientedBox,enabled:true}):null}))};}
 function dispose(){if(disposed)return;disposed=true;if(!owner)return;owner.world.removeEventListener('postStep',post);for(const r of rotors){owner.removeBodyBox(r.mesh.uuid);owner.world.removeBody(r.body);r.collider.enabled=false;delete r.collider.orientedBox;}}
 return{state,update,reset,syncPose,dispose,diagnostics,passiveSupport:()=>Boolean(originalLoad())};
}
