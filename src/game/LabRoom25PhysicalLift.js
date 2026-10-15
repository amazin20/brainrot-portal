import * as THREE from 'three';
import {Body,Box,Material,Vec3} from 'cannon-es';
import {createOrientedBoxContact,syncOrientedBoxContact} from './LabOrientedBoxContact.js';

const C=(x=0,y=0,z=0)=>new Vec3(x,y,z),V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

/** Room25 passenger motor. Cannon alone integrates its guided vertical body.
 * Current light supplies bounded force/work; darkness leaves gravity and the
 * same viscous damper. The two limits are contacts on visible outboard ears,
 * rather than a destination, position clamp or velocity prescription. */
export function opticalPhysicalLift(k,name,p,{top=12,width=4,depth=4}={}){
 if(!Array.isArray(p)||p.length!==3||![...p,top,width,depth].every(Number.isFinite)||top<=p[1]||width<=0||depth<=0)throw new RangeError('A finite ascending passenger lift stroke and positive deck are required');
 const g=k.game,w=k.world,group=new THREE.Group(),parts=[],bodies=[],registrations=new Map();
 const home=V(...p),stroke=top-p[1],budget=Object.freeze({mass:6,motorForce:360,motorPower:730,damping:97.5});
 group.name=name+' / physical passenger car';group.position.copy(home);w.root.add(group);
 const surface=w.surface({name,position:[0,0,0],normal:[0,1,0],width,height:depth,parent:group,moving:true});
 const backing=g.colliders.find(c=>c.mesh===surface.backing);
 const floor={minX:p[0]-width/2,maxX:p[0]+width/2,minZ:p[2]-depth/2,maxZ:p[2]+depth/2,y:p[1],mesh:surface.mesh,enabled:true};
 g.floors.push(floor);w.floors.push(floor);surface.floor=floor;
 const trim=w.box([0,-.25,0],[width,.4,depth],w.materials.trim,false,group);
 let owner=null,body=null,fixed=null,subsystem=null,postStep=null,disposed=false,forceStep=-1,lastForce=null,motorWork=0,forceCount=0;
 const forceApplications=new Map();
 function addPart(mesh,kind,collider=null){
  mesh.updateWorldMatrix(true,false);
  if(!collider){collider={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true,kinematic:kind==='car'};g.colliders.push(collider);g.cameraBlockers.push(mesh);g.aimBlockers.push(mesh);}
  collider.kinematic=true;
  const bounds=new THREE.Box3().setFromObject(mesh),half=bounds.getSize(V()).multiplyScalar(.5),center=bounds.getCenter(V());
  const part={mesh,collider,kind,half:C(...half.toArray()),offset:C(...center.sub(kind==='car'?home:V()).toArray())};parts.push(part);return part;
 }
 addPart(surface.mesh,'car',surface.collider);if(backing)addPart(surface.backing,'car',backing);addPart(trim,'car');
 // Ears and founded stops leave the entire original walkable rectangle free.
 for(const x of [-width/2-.36,width/2+.36]){
  const ear=w.box([x,0,depth/2+1.05],[.22,.16,.5],w.materials.trim,false,group);ear.name=name+' / travelling stop ear';addPart(ear,'car');
  for(const [y,label]of [[p[1]-.20,'lower'],[top+.20,'upper']]){
   const stop=w.box([p[0]+x,y,p[2]+depth/2+1.05],[.38,.24,.65],w.materials.trim,false);stop.name=name+' / founded '+label+' stop';addPart(stop,'fixed');
  }
 }
 for(const x of [p[0]-width/2-.28,p[0]+width/2+.28]){
  const rail=w.box([x,(p[1]+top)/2,p[2]+depth/2+.3],[.18,stroke+1,.2],w.materials.trim,false);rail.name=name+' / founded guide rail';addPart(rail,'fixed');
 }
 function registrationMatches(part){
  const own=registrations.get(part.mesh.uuid),entry=owner?.bodyBoxes.get(part.mesh.uuid);
  return!!own&&entry===own.entry&&entry.body===part.body&&entry.shapeIndex===part.shapeIndex&&entry.shape===own.shape&&part.body.shapes[part.shapeIndex]===own.shape&&part.collider.orientedBox===own.orientedBox;
 }
 function sync(reset=false){
  if(!owner||disposed||g.physics!==owner)return;
  group.position.copy(body.position);group.quaternion.copy(body.quaternion);group.updateWorldMatrix(true,true);floor.y=body.position.y;
  for(const part of parts){
   if(!registrationMatches(part))continue;
   part.mesh.updateWorldMatrix(true,false);part.collider.box.setFromObject(part.mesh);syncOrientedBoxContact(part.collider.orientedBox,part.body,owner.world.stepnumber,reset);
  }
 }
 function liveOwnership(){
  const errors=[];
  if(disposed||!owner||g.physics!==owner)errors.push('physics-owner');
  if(!body||body.type!==Body.DYNAMIC||body.mass!==budget.mass||body.collisionFilterGroup!==1||body.collisionFilterMask!==3||body.linearFactor.x!==0||body.linearFactor.y!==1||body.linearFactor.z!==0||!body.fixedRotation)errors.push('guided-dynamic-car');
  if(!fixed||fixed.type!==Body.STATIC||fixed.mass!==0||fixed.collisionFilterGroup!==1||fixed.collisionFilterMask!==3||fixed.position.lengthSquared()>1e-14||fixed.quaternion.x!==0||fixed.quaternion.y!==0||fixed.quaternion.z!==0||fixed.quaternion.w!==1)errors.push('founded-stops');
  if(owner)for(const part of parts){
   if(!registrationMatches(part))errors.push('registration:'+part.mesh.uuid);
   else if(part.collider.enabled===false||!owner.inspectBodyBox(part.mesh.uuid,{orientedBox:part.collider.orientedBox,bounds:part.collider.box,enabled:!part.apertureOpened}).valid)errors.push('live-contact:'+part.mesh.uuid);
  }
  return{valid:errors.length===0,errors};
 }
 function applyForce(dt){
  if(!(dt>0)||!car.ensure()||forceStep===owner.world.stepnumber)return;
  forceStep=owner.world.stepnumber;forceApplications.set(forceStep,(forceApplications.get(forceStep)??0)+1);if(forceApplications.size>2048)forceApplications.delete(forceApplications.keys().next().value);
  // The original ceramic floor remains an ordinary portal surface. Open
  // cargo contact only inside the production system's current paired mouth;
  // group8 preserves the car's physical rail/stop contacts through that cut.
  const held=!!g.heldCube||!!owner.carryTarget;
  const centre=held?g.playerPosition.clone().add(V(0,1.2,0)):V().copy(owner.cargoBody.position);
  for(const part of parts){
   const opened=g.portalOpensCollider?.(part.collider,centre,held ? .43 : .39,held?2.4:0,held?null:owner.cargoBody.quaternion)===true;
   const shape=part.body.shapes[part.shapeIndex],mask=opened?8:-1;
   if(shape.collisionFilterMask!==mask){shape.collisionFilterMask=mask;owner.cargoBody.wakeUp();owner.world.broadphase.dirty=true;}
   part.apertureOpened=opened;
  }
  const speed=body.velocity.y,motor=car.powered?Math.min(budget.motorForce,budget.motorPower/Math.max(Math.abs(speed),.001)):0,drag=-budget.damping*speed,total=motor+drag;
  body.force.y+=total;fixed.force.y-=total;
  // Existing original cargo can sleep on a stationary car. Wake its real
  // contact before its support moves; no cargo state is prescribed here.
  const cargo=owner.cargoBody;if(cargo&&(motor>0||Math.abs(speed)>.005)&&owner.world.contacts.some(c=>c.enabled!==false&&((c.bi===cargo&&c.bj===body)||(c.bj===cargo&&c.bi===body))))cargo.wakeUp();
  motorWork+=motor*speed*dt;forceCount++;
  lastForce={worldStep:forceStep,dt,powered:Boolean(car.powered),height:body.position.y-home.y,velocity:speed,motorForce:motor,motorPower:motor*speed,dampingForce:drag,dampingPower:drag*speed,appliedForceY:total,foundedReactionY:-total,forceBalanceY:0};
 }
 function placeAtHome(){
  body.position.set(...p);body.quaternion.set(0,0,0,1);body.velocity.setZero();body.angularVelocity.setZero();body.force.setZero();body.torque.setZero();
  body.previousPosition.copy(body.position);body.interpolatedPosition.copy(body.position);body.previousQuaternion.copy(body.quaternion);body.interpolatedQuaternion.copy(body.quaternion);body.aabbNeedsUpdate=true;body.wakeUp();
 }
 const tick=()=>{if(car.ensure())sync();},reset=()=>car.reset();
 const car={name,surface,floor,group,parts,bodies,budget,position:group.position,powered:false,forceApplications,
  get owner(){return owner;},get body(){return body;},get fixedBody(){return fixed;},get velocity(){return body?.velocity.y??0;},get progress(){return body?THREE.MathUtils.clamp((body.position.y-home.y)/stroke,0,1):0;},
  ensure(){
   if(disposed||!g.physics?.cargoBody||(owner&&owner!==g.physics))return false;
   if(owner)return liveOwnership().valid;
   owner=g.physics;const material=new Material({friction:.3,restitution:0});
   body=new Body({mass:budget.mass,position:C(...p),fixedRotation:true,linearFactor:C(0,1,0),linearDamping:0,angularDamping:0,allowSleep:false,material,collisionFilterGroup:1,collisionFilterMask:3});
   fixed=new Body({mass:0,material,collisionFilterGroup:1,collisionFilterMask:3});
   owner.world.addBody(body);owner.world.addBody(fixed);bodies.push(body,fixed);
   for(const part of parts){
    owner.removeStaticBox(part.mesh.uuid);part.body=part.kind==='car'?body:fixed;const shape=new Box(part.half);shape.collisionFilterGroup=8;part.body.addShape(shape,part.offset);part.shapeIndex=part.body.shapes.length-1;
    const orientedBox=createOrientedBoxContact(part.body,V(...part.half.toArray()),V(...part.offset.toArray()),owner.world.stepnumber);part.collider.orientedBox=orientedBox;
    owner.registerBodyBox(part.mesh.uuid,{body:part.body,shapeIndex:part.shapeIndex,orientedBox});registrations.set(part.mesh.uuid,{entry:owner.bodyBoxes.get(part.mesh.uuid),shape:part.body.shapes[part.shapeIndex],orientedBox});
   }
   subsystem={update:()=>applyForce(owner.world.dt)};owner.world.subsystems.push(subsystem);postStep=()=>sync();owner.world.addEventListener('postStep',postStep);sync(true);return liveOwnership().valid;
  },
  update(){tick();},sync,
  reset(){car.powered=false;if(!car.ensure())return;placeAtHome();forceStep=-1;forceCount=motorWork=0;lastForce=null;forceApplications.clear();owner.world.broadphase.dirty=true;sync(true);},
  liveOwnership,
  diagnostics(){
   const ready=car.ensure(),ownership=liveOwnership();
   const stops=owner?owner.world.contacts.filter(c=>c.enabled!==false&&c.multiplier>0&&((c.bi===body&&c.bj===fixed)||(c.bj===body&&c.bi===fixed))):[];
   return{scope:'Room25 physical passenger lift',ready,liveOwnership:ownership.valid,ownershipErrors:ownership.errors,worldStep:owner?.world.stepnumber??-1,powered:Boolean(car.powered),position:car.position.toArray(),height:body?body.position.y-home.y:0,velocity:car.velocity,progress:car.progress,bodyIds:bodies.map(b=>b.id),bodyMasses:bodies.map(b=>b.mass),endStopContacts:stops.length,endStopForce:stops.reduce((sum,c)=>sum+Math.abs(c.multiplier*c.ni.y),0),budget,forceCount,motorWork,lastForce};
  },
  dispose(){
   if(disposed)return;disposed=true;floor.enabled=false;
   const ti=k.ticks.indexOf(tick);if(ti>=0)k.ticks.splice(ti,1);const ri=k.resets.indexOf(reset);if(ri>=0)k.resets.splice(ri,1);
   if(!owner)return;owner.world.removeEventListener('postStep',postStep);const si=owner.world.subsystems.indexOf(subsystem);if(si>=0)owner.world.subsystems.splice(si,1);
   for(const part of parts){const own=registrations.get(part.mesh.uuid);if(registrationMatches(part))owner.removeBodyBox(part.mesh.uuid);if(part.collider.orientedBox===own?.orientedBox){part.collider.enabled=false;delete part.collider.orientedBox;}}
   for(const b of bodies)if(b.world===owner.world)owner.world.removeBody(b);
  },
 };
 k.ticks.push(tick);k.resets.push(reset);k.state[name]=car;return car;
}
