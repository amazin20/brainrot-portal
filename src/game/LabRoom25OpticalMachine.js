import * as THREE from 'three';
import {Body,Box,Material,Vec3} from 'cannon-es';
import {createOrientedBoxContact,syncOrientedBoxContact} from './LabOrientedBoxContact.js';

const C=(x=0,y=0,z=0)=>new Vec3(x,y,z),V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=THREE.MathUtils.clamp;

/** Room25's real guided carriage and spring pressure deck.
 * The optical drive supplies finite external work; pressure-controlled rack
 * actuators also use an explicit external supply. They are active hardware,
 * not a claim of passive gearing. Normal operation never writes body poses,
 * velocities or an achieved height. Only explicit reset restores start poses. */
export function buildRoom25OpticalMachine(k,pad,blades,{traceCurrentLight}={}){
 const g=k.game,w=k.world,bodies=[],parts=[],registrations=new Map(),homeY=.04;
 const budget={carriageMass:6,deckMass:1,shutterMass:4,stroke:9,
  deckSpring:1000,deckDamping:40,deckUnloadedOffset:.1,gravity:19.5,
  motorForce:260,motorPower:400,carriageDamping:64,
  pressureDriveForce:80,pressureDrivePower:120,shutterSpring:10,shutterDamping:30,
  shutterSpringForceCap:100,shutterDampingForceCap:90,shutterForceCap:270};
 let owner=null,carriage=null,deck=null,fixed=null,subsystem=null,postStep=null,disposed=false;
 let motorEnabled=false,forceStep=-1,contactStep=-1,normalLoad=0,loadContacts=0,lastForce=null;
 let motorWork=0,rackWork=0,forceSamples=[],forceCount=0;
 const forceApplications=new Map(),shutters=[];
 const mat=new Material({friction:.12,restitution:0});
 const padFloor=w.floors.find(f=>f.mesh===pad.surface.mesh);
 const plate={mesh:pad.surface.mesh,collider:pad.surface.collider,half:C(2.4,.1,2.4),offset:C(),kind:'deck'};
 parts.push(plate);
 function part(name,position,size,kind,offset=null){
  const mesh=w.box(position,size,w.materials.trim,false);mesh.name=name;
  const collider={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true,kinematic:true};
  g.colliders.push(collider);g.cameraBlockers.push(mesh);g.aimBlockers.push(mesh);
  const p={mesh,collider,half:C(...size.map(n=>n/2)),offset:offset??C(...position),kind};parts.push(p);return p;
 }
 part('Room25 optical freight carriage',[-7,-.14,12],[4.5,.08,4.5],'carriage',C(0,-.18,0));
 part('Room25 travelling optical mast',[-3.5,2.04,12.65],[.14,4.10,.14],'carriage',C(3.5,2,.65));
 part('Room25 travelling optical crossarm',[-2.85,4.14,12.65],[1.44,.10,.12],'carriage',C(4.15,4.10,.65));
 for(const x of [-2.75,2.75]){
  part('Room25 guided carriage stop ear',[-7+x,homeY,12],[.20,.16,.45],'carriage',C(x,0,0));
  part('Room25 founded lower stop',[-7+x,-.14,12],[.35,.20,.6],'fixed');
  part('Room25 founded upper stop',[-7+x,9.22,12],[.35,.20,.6],'fixed');
  // These founded rails stay outside the pressure deck and cargo aperture.
  part('Room25 founded freight rail',[-7+x,4.5,12.55],[.16,9.6,.16],'fixed');
 }
 for(const [i,b]of blades.entries()){
  const half=new THREE.Box3().setFromObject(b.mesh).getSize(V()).multiplyScalar(.5);
  const p={mesh:b.mesh,collider:b.collider,half:C(half.x,half.y,half.z),offset:C(),kind:'shutter',index:i};parts.push(p);b.part=p;
  // Finite travel stops contact the real overhead lug, not the whole blade.
  // They stay above both mandatory lower/upper walking and carrying paths.
  const lug=part('Room25 shutter travel lug',[b.base.x,b.base.y+3.35,b.base.z],[.25,.15,.25],'shutter',C(0,3.35,0));lug.index=i;
  for(const z of [b.base.z-b.sign*.245,b.base.z+b.sign*(8+.245)])
   part('Room25 founded shutter end stop',[b.base.x,b.base.y+3.35,z],[.65,.30,.24],'fixed');
 }
 function bind(p,body){
  const shape=new Box(p.half);shape.collisionFilterGroup=8;
  body.addShape(shape,p.offset);
  p.body=body;p.shapeIndex=body.shapes.length-1;
  p.collider.orientedBox=createOrientedBoxContact(body,V(...p.half.toArray()),V(...p.offset.toArray()),owner.world.stepnumber);
  owner.registerBodyBox(p.collider.mesh.uuid,{body,shapeIndex:p.shapeIndex,orientedBox:p.collider.orientedBox});
  registrations.set(p.collider.mesh.uuid,owner.bodyBoxes.get(p.collider.mesh.uuid));
 }
 function body(mass,position,axis=null){
  const b=new Body({mass,position,material:mat,fixedRotation:true,allowSleep:false,
   linearDamping:0,angularDamping:0,collisionFilterGroup:1,collisionFilterMask:3,
   ...(axis?{linearFactor:axis}:{})});owner.world.addBody(b);bodies.push(b);return b;
 }
 function originalFree(){return!disposed&&owner===g.physics&&g.cargo===cell.originalCargo&&owner?.cargoBody===cell.originalCargoBody
  &&cell.originalCargoBody?.world===owner.world&&owner.world.bodies.includes(cell.originalCargoBody)
  &&cell.originalCargoBody.type===Body.DYNAMIC&&cell.originalCargoBody.mass===3.2&&cell.originalCargoBody.shapes.length===1
  &&cell.originalCargoBody.shapes[0]===cell.originalCargoShape&&!g.heldCube&&!owner.carryTarget
  &&cell.originalCargoBody.collisionResponse!==false&&cell.originalCargoShape.collisionResponse!==false;}
 function owns(p){const e=owner?.bodyBoxes.get(p.collider.mesh.uuid);return e===registrations.get(p.collider.mesh.uuid)
  &&e?.body===p.body&&e.shape===p.body?.shapes[p.shapeIndex]&&p.collider.enabled!==false
  &&owner.inspectBodyBox(p.collider.mesh.uuid,{orientedBox:p.collider.orientedBox,bounds:p.collider.box,enabled:!p.apertureOpened}).valid;}
 function sampleLoad(){
  contactStep=owner.world.stepnumber;normalLoad=loadContacts=0;
  if(!originalFree()||!owns(plate)||plate.apertureOpened)return;
  for(const c of owner.world.contacts){
   const cargo=cell.originalCargoBody;
   if(c.enabled===false||!(c.multiplier>1e-6))continue;
   if(!((c.bi===cargo&&c.si===cell.originalCargoShape&&c.bj===deck&&c.sj===deck.shapes[plate.shapeIndex])
    ||(c.bj===cargo&&c.sj===cell.originalCargoShape&&c.bi===deck&&c.si===deck.shapes[plate.shapeIndex])))continue;
   const y=(c.bi===cargo?-1:1)*c.ni.y;
   if(y>.65){normalLoad+=y*c.multiplier;loadContacts++;}
  }
 }
 function sync(reset=false){
  if(!owner||disposed)return;
  for(const p of parts){const b=p.body;if(!b)continue;
   if(p===plate){pad.surface.group.position.set(b.position.x,b.position.y+.1,b.position.z);pad.surface.group.updateWorldMatrix(true,true);padFloor.y=b.position.y+.1;}
   else{const o=b.quaternion.vmult(p.offset);p.mesh.position.set(b.position.x+o.x,b.position.y+o.y,b.position.z+o.z);p.mesh.quaternion.copy(b.quaternion);p.mesh.updateWorldMatrix(true,false);}
   p.collider.box.setFromObject(p.mesh);syncOrientedBoxContact(p.collider.orientedBox,b,owner.world.stepnumber,reset);
  }
 }
 function force(dt){
  if(!(dt>0)||!cell.ensure()||disposed)return;const step=owner.world.stepnumber;if(forceStep===step)return;forceStep=step;
  forceApplications.set(step,(forceApplications.get(step)??0)+1);if(forceApplications.size>2048)forceApplications.delete(forceApplications.keys().next().value);
  sync();const light=traceCurrentLight?.(cell)??{motor:false};
  // Match the existing production aperture test for these owned compound
  // shapes. Group8 keeps mechanical stop/deck contacts while excluding the
  // cargo's default shape group1 only inside the actual paired aperture.
  // This opens collision; the ordinary portal system alone transports cargo.
  for(const p of parts){const held=!!g.heldCube||!!owner.carryTarget;
   const centre=held?g.playerPosition.clone().add(V(0,1.2,0)):V().copy(owner.cargoBody.position);
   const opened=g.portalOpensCollider(p.collider,centre,held ? .43 : .39,held ? 2.4 : 0,held ? null : owner.cargoBody.quaternion);
   const mask=opened?8:-1,shape=p.body.shapes[p.shapeIndex];
   if(shape.collisionFilterMask!==mask){shape.collisionFilterMask=mask;owner.cargoBody.wakeUp();owner.world.broadphase.dirty=true;}
   p.apertureOpened=opened;
  }
  const beforeCarriageY=carriage.force.y,beforeDeckY=deck.force.y,beforeFixedY=fixed.force.y,beforeFixedZ=fixed.force.z;
  const relative=deck.position.y-carriage.position.y,relativeVelocity=deck.velocity.y-carriage.velocity.y;
  const spring=budget.deckSpring*(budget.deckUnloadedOffset+budget.deckMass*budget.gravity/budget.deckSpring-relative);
  const springDrag=-budget.deckDamping*relativeVelocity,deckForce=spring+springDrag;
  deck.force.y+=deckForce;carriage.force.y-=deckForce;
  const compression=Math.max(0,budget.deckUnloadedOffset-relative);
  const loadFraction=clamp(compression/(3.2*budget.gravity/budget.deckSpring),0,1);
  let rackSourcePower=0,dragPower=0;
  const rack=[];
  for(const [i,b]of shutters.entries()){
   const blade=blades[i],q=blade.sign*(b.position.z-blade.base.z),v=blade.sign*b.velocity.z;
   const drive=Math.min(budget.pressureDriveForce*loadFraction,budget.pressureDrivePower/Math.max(v,.001));
   const returnSpring=clamp(-budget.shutterSpring*q,-budget.shutterSpringForceCap,budget.shutterSpringForceCap);
   const drag=clamp(-budget.shutterDamping*v,-budget.shutterDampingForceCap,budget.shutterDampingForceCap);
   const along=drive+returnSpring+drag,actual=blade.sign*along;
   const before=b.force.z;b.force.z+=actual;fixed.force.z-=actual;
   rackSourcePower+=drive*v;dragPower+=drag*v;
   rack.push({q,v,drive,drivePower:drive*v,returnSpring,drag,actualForceZ:b.force.z-before});
  }
  const v=carriage.velocity.y;
  const motor=motorEnabled&&light.motor?Math.min(budget.motorForce,budget.motorPower/Math.max(v,.001)):0;
  // A sleeping original load must wake when its actual contacting support
  // starts moving. This changes sleep state only, never cargo pose/velocity.
  if(originalFree()&&contactStep===step&&loadContacts>0&&(motor>0||Math.abs(v)>.005))cell.originalCargoBody.wakeUp();
  const carriageDrag=-budget.carriageDamping*v,total=motor+carriageDrag;
  carriage.force.y+=total;fixed.force.y-=total;
  motorWork+=motor*v*dt;rackWork+=rackSourcePower*dt;forceCount++;
  lastForce={worldStep:step,dt,motorEnabled,motorLit:light.motor===true,mirror:light.mirror??null,motorReceiver:light.motorReceiver??null,
   raySegments:light.segments??[],carriageY:carriage.position.y,carriageVelocityY:v,deckY:deck.position.y,
   deckSpringForce:spring,deckDragForce:springDrag,deckRelativeVelocity:relativeVelocity,
   deckDampingPower:springDrag*relativeVelocity,compression,loadFraction,motorForce:motor,motorPower:motor*v,
   carriageDampingForce:carriageDrag,carriageDampingPower:carriageDrag*v,
   actualCarriageAppliedForceY:carriage.force.y-beforeCarriageY,actualDeckAppliedForceY:deck.force.y-beforeDeckY,
   foundedReactionY:fixed.force.y-beforeFixedY,forceBalanceY:(carriage.force.y-beforeCarriageY)+(deck.force.y-beforeDeckY)+(fixed.force.y-beforeFixedY),
   sourceRackPower:rackSourcePower,rackDampingPower:dragPower,foundedReactionZ:fixed.force.z-beforeFixedZ,
   forceBalanceZ:rack.reduce((sum,row)=>sum+row.actualForceZ,0)+(fixed.force.z-beforeFixedZ),foundedVelocity:fixed.velocity.toArray(),rack};
  if(forceSamples.length<8||step%120===0){forceSamples.push(lastForce);if(forceSamples.length>128)forceSamples.shift();}
 }
 function place(b,p){b.position.copy(p);b.quaternion.set(0,0,0,1);b.velocity.setZero();b.angularVelocity.setZero();b.force.setZero();b.torque.setZero();b.previousPosition.copy(p);b.interpolatedPosition.copy(p);b.previousQuaternion.copy(b.quaternion);b.interpolatedQuaternion.copy(b.quaternion);b.aabbNeedsUpdate=true;b.wakeUp();}
 const cell={budget,parts,blades,forceApplications,
  get owner(){return owner;},get carriageBody(){return carriage;},get deckBody(){return deck;},get fixedBody(){return fixed;},get shutterBodies(){return shutters;},get bodies(){return bodies;},
  get height(){return carriage?carriage.position.y-homeY:0;},get velocity(){return carriage?.velocity.y??0;},get motorEnabled(){return motorEnabled;},
  get pressureFraction(){return carriage&&deck?clamp((budget.deckUnloadedOffset-(deck.position.y-carriage.position.y))/(3.2*budget.gravity/budget.deckSpring),0,1):0;},
  get loaded(){return originalFree()&&contactStep===owner.world.stepnumber&&loadContacts>0&&normalLoad>1e-6;},
  get normalLoad(){return cell.loaded?normalLoad:0;},get loadStep(){return contactStep;},
  ensure(){
   if(disposed||!g.physics?.cargoBody||(owner&&owner!==g.physics))return false;if(owner)return true;
   owner=g.physics;cell.originalCargo=g.cargo;cell.originalCargoBody=owner.cargoBody;cell.originalCargoShape=owner.cargoBody.shapes[0];
   for(const p of parts)owner.removeStaticBox(p.collider.mesh.uuid);
   carriage=body(budget.carriageMass,C(-7,homeY,12),C(0,1,0));deck=body(budget.deckMass,C(-7,homeY+budget.deckUnloadedOffset,12),C(0,1,0));fixed=body(0,C());
   for(const p of parts){if(p.kind==='carriage')bind(p,carriage);else if(p.kind==='deck')bind(p,deck);else if(p.kind==='fixed')bind(p,fixed);}
   for(const [i,blade]of blades.entries()){const b=body(budget.shutterMass,C(...blade.base.toArray()),C(0,0,1));shutters.push(b);for(const p of parts)if(p.kind==='shutter'&&p.index===i)bind(p,b);}
   subsystem={update:()=>force(owner.world.dt)};owner.world.subsystems.push(subsystem);
   postStep=()=>{sync();sampleLoad();};owner.world.addEventListener('postStep',postStep);sync(true);return true;
  },
  syncPose:sync,
  enableMotor(){if(!cell.ensure())return false;motorEnabled=true;return true;},
  disableMotor(){motorEnabled=false;},
  reset(){if(!cell.ensure())return;place(carriage,C(-7,homeY,12));place(deck,C(-7,homeY+budget.deckUnloadedOffset,12));for(const[i,b]of shutters.entries())place(b,C(...blades[i].base.toArray()));motorEnabled=false;forceStep=contactStep=-1;normalLoad=loadContacts=0;forceCount=motorWork=rackWork=0;forceSamples=[];lastForce=null;forceApplications.clear();owner.world.broadphase.dirty=true;sync(true);},
  diagnostics(){return{scope:'Room25 continuous optical carriage',ready:cell.ensure(),worldStep:owner?.world.stepnumber??-1,
   height:cell.height,velocity:cell.velocity,motorEnabled,loaded:cell.loaded,normalLoad:cell.normalLoad,contactStep,loadContacts,
   bodyIds:bodies.map(b=>b.id),bodyMasses:bodies.map(b=>b.mass),originalCargoBodyId:cell.originalCargoBody?.id,
   ownershipValid:!!owner&&parts.every(owns),forceCount,motorWork,rackWork,lastForce,forceSamples,
   productionAccepted:false,nativeAccepted:false,fullRoomAccepted:false,passiveShutterTransmission:false};},
  dispose(){if(disposed)return;disposed=true;if(!owner)return;owner.world.removeEventListener('postStep',postStep);
   const i=owner.world.subsystems.indexOf(subsystem);if(i>=0)owner.world.subsystems.splice(i,1);
   for(const p of parts){const id=p.collider.mesh.uuid,entry=owner.bodyBoxes.get(id);if(entry===registrations.get(id)&&entry?.body===p.body&&entry.shape===p.body.shapes[p.shapeIndex])owner.removeBodyBox(id);if(p.collider.orientedBox?.body===p.body){p.collider.enabled=false;delete p.collider.orientedBox;}}
   for(const b of bodies)if(b.world===owner.world)owner.world.removeBody(b);
  }};
 pad.loaded=()=>cell.loaded;pad.player=()=>false;
 k.state.counterweightHoist=cell;k.resets.push(()=>cell.reset());k.ticks.push(()=>{cell.ensure();cell.syncPose();pad.pressed=cell.loaded;pad.progress=clamp(cell.normalLoad/(3.2*budget.gravity),0,1);});
 return cell;
}

