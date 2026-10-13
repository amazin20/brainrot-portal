import * as THREE from 'three';
import {Body,Box,Constraint,ContactMaterial,Cylinder,Equation,HingeConstraint,Material,Quaternion,Vec3} from 'cannon-es';
import {createOrientedBoxContact,syncOrientedBoxContact} from './LabOrientedBoxContact.js';
import {buildRoom23DynamicTraveller} from './LabRoom23DynamicTraveller.js';
import {captureRoom23BodyOwner,room23BodyOwnerValid,captureRoom23ConstraintOwner,room23ConstraintOwnerValid} from './LabRoom23Ownership.js';

const C=(x=0,y=0,z=0)=>new Vec3(x,y,z),V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),DT=1/120,DRIVE_Y=24,DRIVE_Z=8;

/** Ideal, inextensible wound cable. This equation constrains material cable
 * length against ACTUAL drum angle; it never chooses a destination height. */
class WindingEquation extends Equation{
 constructor(car,drum,sign,radius,home,angle){super(car,drum,-100000*DT,100000*DT);this.sign=sign;this.radius=radius;this.home=home;this.angle=angle;
  this.jacobianElementA.spatial.set(0,1,0);this.jacobianElementB.rotational.set(-sign*radius,0,0);this.setSpookParams(1e9,4,DT);}
 computeB(h){const error=this.bi.position.y-this.home-this.sign*this.radius*this.angle();return-this.a*error-this.b*this.computeGW()-h*this.computeGiMf();}
 computeGiMGt(){const a=this.jacobianElementA,b=this.jacobianElementB,tmp=C();this.bi.invInertiaWorldSolve.vmult(a.rotational,tmp);let n=this.bi.invMassSolve*a.spatial.lengthSquared()+tmp.dot(a.rotational);this.bj.invInertiaWorldSolve.vmult(b.rotational,tmp);return n+this.bj.invMassSolve*b.spatial.lengthSquared()+tmp.dot(b.rotational);}
}
class WindingConstraint extends Constraint{
 constructor(car,drum,sign,radius,home,angle){super(car,drum,{collideConnected:false});this.equations.push(new WindingEquation(car,drum,sign,radius,home,angle));}
 update(){}
}
/** Contact-normal bounded Coulomb torque. Cannon's generic friction uses
 * gravity/reduced mass, which does not model a preloaded disc or brake. This
 * owned velocity equation uses the latest genuinely solved normal contacts,
 * their real radii and a finite coefficient; no brake/clutch flag locks it. */
class DiscFrictionEquation extends Equation{
 constructor(a,b){super(a,b,0,0);this.jacobianElementA.rotational.set(1,0,0);this.jacobianElementB.rotational.set(-1,0,0);this.setSpookParams(1e9,4,DT);}
 computeB(h){return-this.b*this.computeGW()-h*this.computeGiMf();}
 computeGiMGt(){const v=C();this.bi.invInertiaWorldSolve.vmult(this.jacobianElementA.rotational,v);let n=v.dot(this.jacobianElementA.rotational);this.bj.invInertiaWorldSolve.vmult(this.jacobianElementB.rotational,v);return n+v.dot(this.jacobianElementB.rotational);}
}
class DiscFrictionConstraint extends Constraint{constructor(a,b){super(a,b,{collideConnected:true});this.equations.push(new DiscFrictionEquation(a,b));}update(){}}
class ShaftAxisEquation extends Equation{
 constructor(a,b,key,anchor){super(a,b,-100000*DT,100000*DT);this.key=key;this.anchor=anchor;this.jacobianElementA.spatial[key]=1;this.jacobianElementB.spatial[key]=-1;this.setSpookParams(1e10,4,DT);}
 computeB(h){return-this.a*(this.bi.position[this.key]-this.bj.position[this.key]-this.anchor)-this.b*this.computeGW()-h*this.computeGiMf();}
}
class ShaftAxialGuide extends Constraint{
 constructor(a,b){super(a,b,{collideConnected:false});this.equations.push(new ShaftAxisEquation(a,b,'y',DRIVE_Y),new ShaftAxisEquation(a,b,'z',DRIVE_Z));}
 update(){}
}

/** Isolated Room23 prototype. Two massive cars and spring freight pans,
 * finite externally powered drum, contact friction clutch and common jaws.
 * Passenger/held cargo loads are actual dynamic bodies, not an aboard flag.
 * All ordinary motion is force/constraint/contact integration in Cannon. */
export function buildRoom23PhysicalMachine(k,{spawn=[-17,0,15],travellerEnabled=true,initialDisplacement=0}={}){
 if(!Number.isFinite(initialDisplacement)||initialDisplacement<0||initialDisplacement>10)throw new RangeError('Declared initial cable displacement must be within physical stops');
 const g=k.game,w=k.world,parts=[],bodies=[],constraints=[],registrations=new Map(),equationDefaults=new Map(),contactMaterials=[];
 const bodyOwners=[],constraintOwners=[],partOwners=[],createdBodies=[],createdConstraints=[],constraintContracts=new Map(),apertureStates=new Map(),shapeMasks=new Map();
 const budget={carMass:20,panMass:2,actuatorMass:10,passengerMass:50,radius:.32,stroke:10,gravity:19.5,
  panSpring:1500,panDamping:30,panRest:.14,motorTorque:448,motorPower:1200,inputDrag:2,carDrag:60,
  forkForce:3000,forkPower:150,jawForce:3000,jawPower:150,contactFriction:.9};
 let owner=null,founded=null,input=null,drum=null,fork=null,jaws=[],disposed=false,subsystem=null,postStep=null,oldSolverIterations=null,oldSolverSolve=null,oldSolverDescriptor=null,solverWrapper=null;
 let clutchCommand=false,brakeCommand=true,motorSupply=true,lastAngle=0,angle=initialDisplacement/.32,forceStep=-1,contactStep=-1,forceCount=0;
 let motorWork=0,actuatorWork=0,dragWork=0,springWork=0,clutchFrictionWork=0,brakeFrictionWork=0,lastForce=null,samples=[];
 let clutchNormal=0,brakeNormal=0,clutchCapacity=0,brakeCapacity=0,clutchFriction=null,brakeFriction=null,sourceInput=0,fault=null;
 let ownedWorld=null,originalOwner=null;
 const material=new Material({friction:.8,restitution:0}),clutchMaterial=new Material({friction:0,restitution:0}),thrustMaterial=new Material({friction:0,restitution:0});
 const visual=new THREE.MeshStandardMaterial({color:0x597284,roughness:.52,metalness:.4});
 const traveller=travellerEnabled?buildRoom23DynamicTraveller(g,{spawn,mass:budget.passengerMass,owns:()=>g.firstLevel?.balance===cell}):null;
 function meshPart(name,p,size,kind,local=C(),index=0){
  const mesh=w.box(p,size,visual,false);mesh.name=name;mesh.userData.keepMaterial=true;
  const collider={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true,kinematic:false};g.colliders.push(collider);g.cameraBlockers.push(mesh);g.aimBlockers.push(mesh);
  const part={mesh,collider,half:C(...size.map(n=>n/2)),local,kind,index};parts.push(part);return part;
 }
 const cars=[{name:'west-load-car',x:-3.1,home:0,sign:1},{name:'east-load-car',x:3.1,home:20,sign:-1}].map((spec,index)=>{
  const initialY=spec.home+spec.sign*initialDisplacement;
  const group=new THREE.Group();group.position.set(spec.x,initialY,3);w.root.add(group);
  const surface=k.panel(spec.name,[0,0,0],[0,1,0],6,7,group,true);
  const floor={minX:spec.x-3,maxX:spec.x+3,minZ:-.5,maxZ:6.5,y:initialY,mesh:surface.mesh,enabled:true};g.floors.push(floor);w.floors.push(floor);
  // The body owns both the precise deck and its authored backing. No duplicate
  // kinematic backing may supply or remove energy behind the moving deck.
  for(const [mesh,collider,offset,half]of [[surface.mesh,surface.collider,C(0,-.1,0),C(3,.1,3.5)],
   [surface.backing,g.colliders.find(c=>c.mesh===surface.backing),C(0,-.105,0),C(3,.04,3.5)]]){
   if(collider)parts.push({mesh,collider,local:offset,half,kind:'car',index,authored:true});
  }
  for(const side of [index===0?-1:1]){
   meshPart('Room23 travelling guide stop ear',[spec.x+side*3.3,initialY+.05,6.7],[.20,.10,.35],'car',C(side*3.3,.05,3.7),index);
   const top=index===0?10:20;
   meshPart('Room23 founded upper guide stop',[spec.x+side*3.3,top+.20,6.7],[.35,.20,.55],'fixed');
  }
  const lower=index===0?0:10;
  meshPart('Room23 founded lower cabin stop',[spec.x,lower-.35,3],[6,.30,7],'fixed');
  const panX=index===0?-1.1:1.1;
  const pan=meshPart('Room23 sprung freight pan',[panX,initialY+budget.panRest,3],[2,.16,2.4],'pan',C(),index);
  // The 1.80 m mouth clears the original cube even when it rotates during
  // finite-handed transfer; the 2.40 m traveller cannot stand on the pan.
  meshPart('Room23 physical freight pan hood',[panX,initialY+1.86,3],[2.08,.12,2.60],'car',C(panX-spec.x,1.86,0),index);
  const record={...spec,initialY,index,group,surface,floor,pan,body:null,panBody:null,contacts:[],normalLoad:0,passengerLoad:0,
   loaded:()=>contactStep===owner?.world.stepnumber&&record.contacts.length>0&&record.normalLoad>1e-7};
  return record;
 });
 const driveRoot=new THREE.Group();driveRoot.name='Room23 common powered cable drum';w.root.add(driveRoot);
 // The common drum sits in a clear founded bay. Ideal fixed idlers keep the
 // vertical car cable legs at z=3; their remaining routing has fixed length.
 const cylinder=(name,x)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,.08,24),visual);mesh.rotation.z=-Math.PI/2;mesh.position.set(x,DRIVE_Y,DRIVE_Z);mesh.name=name;driveRoot.add(mesh);return mesh;};
 const inputMesh=cylinder('Room23 finite supply rotor',-.12),drumMesh=cylinder('Room23 common wound cable drum',.08);
 const forkPart=meshPart('Room23 powered clutch thrust fork',[.30,DRIVE_Y,DRIVE_Z],[.04,.68,.68],'fork');
 const jawParts=[-1,1].map((sign,index)=>meshPart('Room23 common brake friction shoe',[.025,DRIVE_Y,DRIVE_Z+sign*.50],[.20,.5,.10],'jaw',C(),index));
 function body(mass,p,linear=C(0,1,0),angular=C(),mat=material){const b=new Body({mass,position:p,allowSleep:false,linearDamping:0,angularDamping:0,
  fixedRotation:angular.lengthSquared()===0,linearFactor:linear,angularFactor:angular,material:mat,collisionFilterGroup:1,collisionFilterMask:1|2|4});owner.world.addBody(b);bodies.push(b);createdBodies.push(b);return b;}
 function bind(p,b){const shape=new Box(p.half);shape.collisionFilterGroup=8;b.addShape(shape,p.local);p.body=b;p.shape=shape;p.shapeIndex=b.shapes.length-1;
  p.collider.orientedBox=createOrientedBoxContact(b,V(...p.half.toArray()),V(...p.local.toArray()),owner.world.stepnumber);
  owner.registerBodyBox(p.mesh.uuid,{body:b,shapeIndex:p.shapeIndex,orientedBox:p.collider.orientedBox});registrations.set(p.mesh.uuid,owner.bodyBoxes.get(p.mesh.uuid));}
 function owns(p){try{const entry=owner?.bodyBoxes.get(p.mesh.uuid);return p.collider.enabled!==false&&entry===registrations.get(p.mesh.uuid)&&p.body?.shapes[p.shapeIndex]===p.shape
  &&entry?.body===p.body&&owner.inspectBodyBox(p.mesh.uuid,{orientedBox:p.collider.orientedBox,bounds:p.collider.box,enabled:!p.opened&&p.body.collisionFilterGroup!==16}).valid;}catch{return false;}}
 function structuralOwnership(){
  try{return!!owner&&!disposed&&owner===g.physics&&owner.world===ownedWorld&&g.firstLevel?.balance===cell
   &&owner.cargoBody===originalOwner?.body&&cell.originalCargoBody===originalOwner.body&&cell.originalCargoShape===originalOwner.body.shapes[0]
   &&owner.cargoSize===.78&&room23BodyOwnerValid(originalOwner,{bodyMask:()=>owner.carryTarget||owner.releasePlayerGrace?1:5})
   &&bodyOwners.every(Boolean)&&bodies.length===bodyOwners.length&&bodies.length===createdBodies.length&&bodies.every((b,i)=>b===bodyOwners[i].body&&b===createdBodies[i])
   &&bodyOwners.every(row=>room23BodyOwnerValid(row,{shapeMask:shape=>shapeMasks.get(shape)}))
   &&constraintOwners.every(Boolean)&&constraints.length===constraintOwners.length&&constraints.length===createdConstraints.length&&constraints.every((c,i)=>c===constraintOwners[i].constraint&&c===createdConstraints[i])
   &&constraintOwners.every(row=>room23ConstraintOwnerValid(row))
   &&cars.every((car,i)=>car.body===bodyOwners[1+i*2].body&&car.panBody===bodyOwners[2+i*2].body)
   &&parts.length===partOwners.length&&parts.every((p,i)=>{const a=partOwners[i];return p===a.part&&p.mesh===a.mesh&&p.mesh.uuid===a.id&&p.collider===a.collider&&p.body===a.body&&p.shape===a.shape&&p.shapeIndex===a.shapeIndex
     &&p.collider.enabled!==false&&p.collider.orientedBox===a.orientedBox&&p.collider.orientedBox.body===a.body
     &&owner.bodyBoxes.get(p.mesh.uuid)===a.registration&&(p.opened??false)===apertureStates.get(p.shape);})
   &&(!traveller||traveller.ownershipValid());}catch{return false;}
 }
 function stopOwnedForces(reason){
  fault??=reason;sourceInput=clutchNormal=brakeNormal=clutchCapacity=brakeCapacity=0;
  for(const row of constraintOwners)if(row){
   // A malformed constraint's update may dereference its changed endpoints
   // even when rows are disabled. Detach only that captured owned constraint;
   // no replacement, equation repair, body pose or foreign row is installed.
   if(!room23ConstraintOwnerValid(row)&&ownedWorld.constraints.includes(row.constraint))ownedWorld.removeConstraint(row.constraint);
   for(const e of new Set([...row.equations.map(v=>v.equation),...(Array.isArray(row.constraint.equations)?row.constraint.equations:[])]))if(e&&typeof e==='object'){try{e.enabled=false;}catch{if(ownedWorld.constraints.includes(row.constraint))ownedWorld.removeConstraint(row.constraint);}}
  }
  traveller?.stopOwnedForces(reason);
 }
 function updateAngle(){if(!drum)return angle;const current=Math.atan2(2*drum.quaternion.x*drum.quaternion.w,1-2*drum.quaternion.x**2);
  angle+=Math.atan2(Math.sin(current-lastAngle),Math.cos(current-lastAngle));lastAngle=current;return angle;}
 function sync(reset=false){
  if(!owner||disposed)return;
  for(const car of cars){if(!car.body)continue;car.group.position.set(car.body.position.x,car.body.position.y,car.body.position.z);car.group.quaternion.copy(car.body.quaternion);car.group.updateWorldMatrix(true,true);car.floor.y=car.body.position.y;}
  for(const p of parts){if(!p.body)continue;
   if(!p.authored){const o=p.body.quaternion.vmult(p.local);p.mesh.position.set(p.body.position.x+o.x,p.body.position.y+o.y,p.body.position.z+o.z);p.mesh.quaternion.copy(p.body.quaternion);p.mesh.updateWorldMatrix(true,false);}
   p.collider.box.setFromObject(p.mesh);syncOrientedBoxContact(p.collider.orientedBox,p.body,owner.world.stepnumber,reset);
  }
  if(input){inputMesh.position.copy(input.position);inputMesh.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(V(0,0,1),-Math.PI/2)).premultiply(new THREE.Quaternion().copy(input.quaternion));}
  if(drum){drumMesh.position.copy(drum.position);drumMesh.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(V(0,0,1),-Math.PI/2)).premultiply(new THREE.Quaternion().copy(drum.quaternion));}
 }
 function limited(force,velocity,maxForce,maxPower){const f=clamp(force,-maxForce,maxForce);return f*velocity>maxPower?Math.sign(f)*maxPower/Math.max(Math.abs(velocity),1e-9):f;}
 function actuator(b,key,target,stiffness,damping,maxForce,maxPower){const f=limited((target-b.position[key])*stiffness-b.velocity[key]*damping,b.velocity[key],maxForce,maxPower);
  b.force[key]+=f;founded.force[key]-=f;actuatorWork+=f*b.velocity[key]*DT;return{force:f,power:f*b.velocity[key],position:b.position[key],target};}
 function sourceFractions(){return cars.map(car=>Math.max(0,(budget.panRest-(car.panBody.position.y-car.body.position.y))/(3.2*budget.gravity/budget.panSpring)));}
 function force(dt){
  if(disposed)return;
  if(owner&&(owner!==g.physics||owner.world!==ownedWorld||g.firstLevel?.balance!==cell)){stopOwnedForces('current owned body/world no longer matches');return;}
  if(!(dt>0)||!cell.ensure()||forceStep===owner.world.stepnumber)return;
  if(!structuralOwnership()){stopOwnedForces('current owned body/shape/registry/constraint no longer matches');return;}
  forceStep=owner.world.stepnumber;sync();
  if(!parts.every(owns)){stopOwnedForces('current owned body/shape/registry/pose no longer matches');return;}
  const fresh=contactStep===owner.world.stepnumber;
  for(const [equation,capacity]of [[clutchFriction,clutchCapacity],[brakeFriction,brakeCapacity]]){equation.minForce=-(fresh?capacity:0)*dt;equation.maxForce=(fresh?capacity:0)*dt;}
  traveller?.applyForces(dt);
  const panRows=[];
  for(const car of cars){const rel=car.panBody.position.y-car.body.position.y,rv=car.panBody.velocity.y-car.body.velocity.y;
   const spring=budget.panSpring*(budget.panRest+budget.panMass*budget.gravity/budget.panSpring-rel),drag=-budget.panDamping*rv,f=spring+drag;
   car.panBody.force.y+=f;car.body.force.y-=f;springWork+=spring*rv*dt;dragWork+=drag*rv*dt;
   const carDrag=-budget.carDrag*car.body.velocity.y;car.body.force.y+=carDrag;founded.force.y-=carDrag;dragWork+=carDrag*car.body.velocity.y*dt;
   panRows.push({relative:rel,relativeVelocity:rv,springForce:spring,dragForce:drag,dampingPower:drag*rv,carDrag,carDampingPower:carDrag*car.body.velocity.y});
  }
  const fractions=sourceFractions();sourceInput=clamp(fractions[1]-fractions[0],-1,1);
  const torque=motorSupply?limited(budget.motorTorque*sourceInput,input.angularVelocity.x,budget.motorTorque,budget.motorPower):0;
  const inputDrag=-budget.inputDrag*input.angularVelocity.x;input.torque.x+=torque+inputDrag;founded.torque.x-=torque+inputDrag;
  motorWork+=torque*input.angularVelocity.x*dt;dragWork+=inputDrag*input.angularVelocity.x*dt;
  // Axial spring retracts the output plate when the powered fork withdraws.
  const retract=3000*(.08-drum.position.x)-30*drum.velocity.x;drum.force.x+=retract;founded.force.x-=retract;
  springWork+=3000*(.08-drum.position.x)*drum.velocity.x*dt;dragWork+=-30*drum.velocity.x**2*dt;
  const forkForce=actuator(fork,'x',clutchCommand?-.10:.30,40000,1000,budget.forkForce,budget.forkPower);
  const jawForces=jaws.map((b,i)=>actuator(b,'z',DRIVE_Z+(i===0?-1:1)*(brakeCommand?.38:.50),40000,1000,budget.jawForce,budget.jawPower));
  // A supported original may sleep while the common brake holds. Wake it
  // whenever its REAL support begins moving, including an unpowered return;
  // otherwise Cannon treats that sleeping load as an immovable constraint.
  for(const car of cars)if(car.contacts.length&&(Math.abs(torque)>1||Math.abs(car.body.velocity.y)>.001||Math.abs(car.panBody.velocity.y)>.001))owner.cargoBody.wakeUp();
  // Open only the original's genuinely paired aperture in owned moving boxes.
  // Player/cabin mechanical contacts remain solid; no whole-body collider toggle.
  for(const p of parts){if(!['car','pan'].includes(p.kind))continue;
   const centre=V().copy(owner.cargoBody.position),opened=g.portalOpensCollider?.(p.collider,centre,.39,0,owner.cargoBody.quaternion)===true;
   p.shape.collisionFilterMask=opened?8|4:-1;p.opened=opened;shapeMasks.set(p.shape,p.shape.collisionFilterMask);apertureStates.set(p.shape,opened);
  }
  forceCount++;lastForce={worldStep:forceStep,dt,sourceInput,fractions,motorTorque:torque,motorPower:torque*input.angularVelocity.x,
   inputAngularVelocity:input.angularVelocity.x,drumAngularVelocity:drum.angularVelocity.x,drumAngle:angle,
   westY:cars[0].body.position.y,eastY:cars[1].body.position.y,cableLengthError:cars[0].body.position.y+cars[1].body.position.y-20,
   panRows,forkForce,jawForces,clutchNormal,brakeNormal,clutchCapacity,brakeCapacity,frictionContactStep:contactStep,clutchCommand,brakeCommand,motorSupply};
  if(forceCount<8||forceStep%120===0){samples.push(lastForce);if(samples.length>128)samples.shift();}
 }
 function post(){
  if(!owner||disposed||fault)return;
  if(!structuralOwnership()){stopOwnedForces('current owned body/shape/registry/constraint no longer matches');return;}
  updateAngle();sync();contactStep=owner.world.stepnumber;clutchNormal=brakeNormal=clutchCapacity=brakeCapacity=0;
  for(const car of cars){car.contacts=[];car.normalLoad=car.passengerLoad=0;}
  for(const c of owner.world.contacts){if(c.enabled===false||c.multiplier<=1e-7)continue;
   if((c.bi===input&&c.bj===drum)||(c.bj===input&&c.bi===drum)){clutchNormal+=c.multiplier;const r=c.bi===drum?c.ri:c.rj;clutchCapacity+=budget.contactFriction*c.multiplier*Math.hypot(r.y,r.z);}
   if((c.bi===drum&&jaws.includes(c.bj))||(c.bj===drum&&jaws.includes(c.bi))){brakeNormal+=c.multiplier;const r=c.bi===drum?c.ri:c.rj;brakeCapacity+=budget.contactFriction*c.multiplier*Math.hypot(r.y,r.z);}
   for(const car of cars){
    const original=owner.cargoBody,n=(c.bi===original&&c.bj===car.panBody)?-c.ni.y:(c.bj===original&&c.bi===car.panBody)?c.ni.y:0;
    if(n>.65){car.normalLoad+=n*c.multiplier;car.contacts.push({worldStep:contactStep,force:n*c.multiplier,originalBodyId:original.id,panBodyId:car.panBody.id,originalShapeId:(c.bi===original?c.si:c.sj)?.id});}
    const passenger=traveller?.body,pn=(c.bi===passenger&&c.bj===car.body)?-c.ni.y:(c.bj===passenger&&c.bi===car.body)?c.ni.y:0;if(pn>.65)car.passengerLoad+=pn*c.multiplier;
   }
  }
  clutchFrictionWork+=clutchFriction.multiplier*clutchFriction.computeGW()*DT;
  brakeFrictionWork+=brakeFriction.multiplier*brakeFriction.computeGW()*DT;
  traveller?.postStep();
 }
 function resetBody(b,p){b.position.copy(p);b.previousPosition.copy(p);b.interpolatedPosition.copy(p);b.quaternion.set(0,0,0,1);b.previousQuaternion.copy(b.quaternion);b.interpolatedQuaternion.copy(b.quaternion);b.velocity.setZero();b.angularVelocity.setZero();b.force.setZero();b.torque.setZero();b.aabbNeedsUpdate=true;b.wakeUp();}
 const cell={budget,cars,west:cars[0],east:cars[1],parts,bodies,constraints,traveller,
  get owner(){return owner;},get inputRotor(){return input;},get drumBody(){return drum;},get forkBody(){return fork;},get jawBodies(){return jaws;},get foundedBody(){return founded;},
  get height(){return cars[0].body?.position.y??0;},get velocity(){return cars[0].body?.velocity.y??0;},get braked(){return contactStep===owner?.world.stepnumber&&brakeNormal>1;},
  get clutchEngaged(){return contactStep===owner?.world.stepnumber&&clutchNormal>1;},
  get clutchRequested(){return clutchCommand;},get brakeRequested(){return brakeCommand;},
  requestBrake(value){brakeCommand=!!value;},requestClutch(value){clutchCommand=!!value;},requestMotorSupply(value){motorSupply=!!value;},
  ownershipValid(){return!fault&&structuralOwnership()&&parts.every(owns);},
  ensure(){
   if(disposed||!g.physics?.cargoBody||(owner&&owner!==g.physics)||g.firstLevel?.balance!==cell)return false;if(owner)return!fault;
   owner=g.physics;ownedWorld=owner.world;cell.originalCargoBody=owner.cargoBody;cell.originalCargoShape=owner.cargoBody.shapes[0];
   const original=owner.cargoBody,shape=original.shapes[0];
   if(original.mass!==3.2||original.type!==Body.DYNAMIC||original.collisionFilterGroup!==2||original.collisionResponse!==true||original.shapes.length!==1||!(shape instanceof Box)
     ||shape.halfExtents.x!==.39||shape.halfExtents.y!==.39||shape.halfExtents.z!==.39||owner.cargoSize!==.78){fault='current owned body/shape original definition no longer matches';return false;}
   originalOwner=captureRoom23BodyOwner(original,ownedWorld);
   for(const p of parts)owner.removeStaticBox(p.mesh.uuid);
   founded=body(0,C(),C());
   for(const car of cars){car.body=body(budget.carMass,C(car.x,car.initialY,3));car.panBody=body(budget.panMass,C(car.pan.mesh.position.x,car.initialY+budget.panRest,3));}
   input=body(4,C(-.12,DRIVE_Y,DRIVE_Z),C(1,1,1),C(1,1,1),clutchMaterial);drum=body(8,C(.08,DRIVE_Y,DRIVE_Z),C(1,1,1),C(1,1,1),clutchMaterial);
   drum.quaternion.setFromAxisAngle(C(1,0,0),angle);drum.previousQuaternion.copy(drum.quaternion);drum.interpolatedQuaternion.copy(drum.quaternion);
   lastAngle=Math.atan2(Math.sin(angle),Math.cos(angle));
   const rotation=new Quaternion().setFromAxisAngle(C(0,0,1),-Math.PI/2);
   for(const b of [input,drum]){b.collisionFilterGroup=16;b.collisionFilterMask=1|16;const shape=new Cylinder(.4,.4,.08,16);b.addShape(shape,C(),rotation);b.room23Shape=shape;}
   // The nonrotating fork presses through an ideal axial thrust bearing;
   // it transfers normal preload and cannot act as an unintended disc brake.
   fork=body(budget.actuatorMass,C(.30,DRIVE_Y,DRIVE_Z),C(1,0,0),C(),thrustMaterial);fork.collisionFilterGroup=1|16;fork.collisionFilterMask=1|2|4|16;
   jaws=[-1,1].map(sign=>{const b=body(budget.actuatorMass,C(.025,DRIVE_Y,DRIVE_Z+sign*.50),C(0,0,1),C(),clutchMaterial);b.collisionFilterGroup=1|16;b.collisionFilterMask=1|2|4|16;return b;});
   for(const p of parts){const b=p.kind==='car'?cars[p.index].body:p.kind==='pan'?cars[p.index].panBody:p.kind==='fork'?fork:p.kind==='jaw'?jaws[p.index]:founded;
    if(p.kind==='fixed'){p.local=C(...p.mesh.position.toArray());}bind(p,b);}
   oldSolverIterations=owner.world.solver.iterations;owner.world.solver.iterations=60;
   oldSolverSolve=owner.world.solver.solve;oldSolverDescriptor=Object.getOwnPropertyDescriptor(owner.world.solver,'solve');
   solverWrapper=function(dt,world){
    // Generated friction limits use force units; GSSolver clamps impulses.
    // Convert only this Room23 world's fresh generic contact rows each step.
    for(const e of world.frictionEquations){e.minForce*=dt;e.maxForce*=dt;}
    return oldSolverSolve.call(this,dt,world);
   };owner.world.solver.solve=solverWrapper;
   const inputBearing=new HingeConstraint(input,founded,{pivotA:C(),pivotB:C(-.12,DRIVE_Y,DRIVE_Z),axisA:C(1,0,0),axisB:C(1,0,0),maxForce:100000*DT,collideConnected:false});
   const outputBearing=new HingeConstraint(drum,founded,{pivotA:C(),pivotB:C(.08,DRIVE_Y,DRIVE_Z),axisA:C(1,0,0),axisB:C(1,0,0),maxForce:100000*DT,collideConnected:false});
   // Only the two rotational bearing rows: the output plate retains its real
   // axial sliding stroke so the fork can establish/remove contact preload.
   outputBearing.equations=outputBearing.equations.slice(3);
   const shaftGuide=new ShaftAxialGuide(drum,founded);
   for(const c of [inputBearing,outputBearing,shaftGuide]){owner.world.addConstraint(c);constraints.push(c);createdConstraints.push(c);for(const e of c.equations)e.setSpookParams(1e10,4,DT);
    constraintContracts.set(c,c===shaftGuide?{equationFields:['key','anchor'],fixedJacobians:true}:{fixedVectors:['pivotA','pivotB','axisA','axisB']});}
   for(const car of cars){const c=new WindingConstraint(car.body,drum,car.sign,budget.radius,car.home,()=>updateAngle());owner.world.addConstraint(c);constraints.push(c);createdConstraints.push(c);
    constraintContracts.set(c,{equationFields:['sign','radius','home','angle'],fixedJacobians:true});}
   for(const [a,b,target]of [[input,drum,'clutch'],[drum,founded,'brake']]){const c=new DiscFrictionConstraint(a,b);owner.world.addConstraint(c);constraints.push(c);createdConstraints.push(c);
    constraintContracts.set(c,{fixedForceLimits:false,fixedJacobians:true});if(target==='clutch')clutchFriction=c.equations[0];else brakeFriction=c.equations[0];}
   // HingeConstraint includes a normally disabled zero-speed motor row.
   // Preserve each authored row state; enabling every row on reset creates
   // an unpowered shaft brake unrelated to the real clutch and brake jaws.
   for(const c of constraints)for(const e of c.equations)equationDefaults.set(e,e.enabled);
   for(const [a,b,friction]of [[clutchMaterial,clutchMaterial,0],[owner.cargoMaterial,material,.9],[thrustMaterial,clutchMaterial,0]]){const cm=new ContactMaterial(a,b,{friction,restitution:0,contactEquationStiffness:1e9,contactEquationRelaxation:4,frictionEquationStiffness:1e9,frictionEquationRelaxation:4});owner.world.addContactMaterial(cm);contactMaterials.push(cm);}
   traveller?.ensure();
   for(const b of bodies){for(const shape of b.shapes)shapeMasks.set(shape,shape.collisionFilterMask);bodyOwners.push(captureRoom23BodyOwner(b,ownedWorld));}
   for(const c of constraints)constraintOwners.push(captureRoom23ConstraintOwner(c,ownedWorld,constraintContracts.get(c)));
   for(const p of parts){shapeMasks.set(p.shape,p.shape.collisionFilterMask);apertureStates.set(p.shape,false);partOwners.push({part:p,id:p.mesh.uuid,mesh:p.mesh,collider:p.collider,body:p.body,shape:p.shape,shapeIndex:p.shapeIndex,orientedBox:p.collider.orientedBox,registration:registrations.get(p.mesh.uuid)});}
   subsystem={update:()=>force(owner.world.dt)};owner.world.subsystems.push(subsystem);postStep=post;owner.world.addEventListener('postStep',postStep);sync(true);return true;
  },
  syncPose:sync,
  energy(){
   if(!owner)return null;const records=[...bodies,owner.cargoBody,traveller?.body].filter(b=>b&&b.mass>0),inverse=new Quaternion();
   let kinetic=0,potential=0;
   for(const b of records){b.quaternion.conjugate(inverse);const omega=inverse.vmult(b.angularVelocity);kinetic+=.5*b.mass*b.velocity.lengthSquared()+.5*(b.inertia.x*omega.x**2+b.inertia.y*omega.y**2+b.inertia.z*omega.z**2);potential+=b.mass*budget.gravity*b.position.y;}
   let springs=.5*3000*(drum.position.x-.08)**2;
   for(const car of cars){const stretch=budget.panRest+budget.panMass*budget.gravity/budget.panSpring-(car.panBody.position.y-car.body.position.y);springs+=.5*budget.panSpring*stretch**2;}
   return{kinetic,potential,springs,total:kinetic+potential+springs,
    sourceWork:motorWork+actuatorWork+(traveller?.diagnostics().controlWork??0)+(traveller?.diagnostics().jumpWork??0)+(traveller?.diagnostics().handServoWork??0),
    recordedDragWork:dragWork,recordedClutchWork:clutchFrictionWork,recordedBrakeWork:brakeFrictionWork,
    workQuadrature:'force/torque times pre-step velocity at actual 120 Hz; numerical/contact residual is reported, not assumed zero'};
  },
  reset(){if(!cell.ensure()||!cell.ownershipValid())return;for(const car of cars){resetBody(car.body,C(car.x,car.initialY,3));resetBody(car.panBody,C(car.pan.mesh.position.x,car.initialY+budget.panRest,3));}
   resetBody(input,C(-.12,DRIVE_Y,DRIVE_Z));resetBody(drum,C(.08,DRIVE_Y,DRIVE_Z));resetBody(fork,C(.30,DRIVE_Y,DRIVE_Z));jaws.forEach((b,i)=>resetBody(b,C(.025,DRIVE_Y,DRIVE_Z+(i===0?-1:1)*.50)));
   angle=initialDisplacement/budget.radius;lastAngle=Math.atan2(Math.sin(angle),Math.cos(angle));drum.quaternion.setFromAxisAngle(C(1,0,0),angle);drum.previousQuaternion.copy(drum.quaternion);drum.interpolatedQuaternion.copy(drum.quaternion);
   clutchCommand=false;brakeCommand=true;motorSupply=true;forceStep=contactStep=-1;forceCount=clutchNormal=brakeNormal=clutchCapacity=brakeCapacity=sourceInput=0;
   motorWork=actuatorWork=dragWork=springWork=clutchFrictionWork=brakeFrictionWork=0;lastForce=null;samples=[];fault=null;for(const c of constraints)for(const e of c.equations)e.enabled=equationDefaults.get(e)===true;traveller?.reset();sync(true);},
  diagnostics(){return{scope:'unaccepted Room23 direct load-transfer prototype',ready:cell.ensure(),worldStep:owner?.world.stepnumber,contactStep,
   bodyIds:bodies.map(b=>b.id),bodyMasses:bodies.map(b=>b.mass),originalBodyId:cell.originalCargoBody?.id,originalShapeId:cell.originalCargoShape?.id,
   ownershipValid:owner?cell.ownershipValid():false,fault,forceCount,sourceInput,clutchCommand,brakeCommand,clutchNormal,brakeNormal,clutchCapacity,brakeCapacity,
   clutchTorque:clutchFriction?.multiplier,brakeTorque:brakeFriction?.multiplier,clutchSlipRate:clutchFriction?.computeGW(),
   west:{y:cars[0].body?.position.y,velocity:cars[0].body?.velocity.y,normalLoad:cars[0].normalLoad,passengerLoad:cars[0].passengerLoad,contacts:cars[0].contacts},
   east:{y:cars[1].body?.position.y,velocity:cars[1].body?.velocity.y,normalLoad:cars[1].normalLoad,passengerLoad:cars[1].passengerLoad,contacts:cars[1].contacts},
   motorWork,actuatorWork,dragWork,springWork,clutchFrictionWork,brakeFrictionWork,lastForce,samples,traveller:traveller?.diagnostics(),
   idealWoundCable:true,passivePoweredAscent:false,fullOrdinaryRouteAccepted:false,nativeAccepted:false,publicationAccepted:false};},
  dispose(){if(disposed)return;disposed=true;traveller?.dispose();if(!owner)return;
   ownedWorld.removeEventListener('postStep',postStep);const index=ownedWorld.subsystems.indexOf(subsystem);if(index>=0)ownedWorld.subsystems.splice(index,1);
   for(const c of createdConstraints)if(ownedWorld.constraints.includes(c))ownedWorld.removeConstraint(c);
   for(const p of partOwners){if(owner.bodyBoxes.get(p.id)===p.registration)owner.removeBodyBox(p.id);
    if(p.collider.orientedBox===p.orientedBox&&p.orientedBox.body===p.body){p.collider.enabled=false;delete p.collider.orientedBox;}}
   for(const b of createdBodies)if(b.world===ownedWorld)ownedWorld.removeBody(b);
   for(const cm of contactMaterials)ownedWorld.removeContactMaterial(cm);
   if(ownedWorld.solver.iterations===60)ownedWorld.solver.iterations=oldSolverIterations;
   if(ownedWorld.solver.solve===solverWrapper){if(oldSolverDescriptor)Object.defineProperty(ownedWorld.solver,'solve',oldSolverDescriptor);else delete ownedWorld.solver.solve;}
  }
 };
 k.state.balance=cell;k.resets.push(()=>cell.reset());k.ticks.push(()=>{cell.ensure();sync();});
 return cell;
}
