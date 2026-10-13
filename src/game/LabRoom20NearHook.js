import * as THREE from 'three';
import {Body,Box,HingeConstraint,Material,Vec3} from 'cannon-es';
import {createOrientedBoxContact,syncOrientedBoxContact} from './LabOrientedBoxContact.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {buildRoom20TensionMechanism} from './LabRoom20TensionMechanism.js';
const C=(x=0,y=0,z=0)=>new Vec3(x,y,z),V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),DT=1/120;

/** A passive slip coupling in the actual ordinary room. Every E gives a finite impulse to a real
 * freely hinged rotor. Only the actual solver subsystem transfers equal and
 * opposite bounded body torques. No motor, velocity target, load-ready input
 * gate, ignored E or cooldown is present. Live ownership is a physical guard. */
export function buildRoom20NearHook(game,k,{torqueCeiling=4,slipGain=2,handAngularImpulse=.7,...options}={}){
 if(!(torqueCeiling>0&&torqueCeiling<=4&&slipGain>0&&slipGain<=2&&handAngularImpulse>0&&handAngularImpulse<=.7))throw RangeError('Finite passive coupling and hand input required');
 const base=buildRoom20TensionMechanism(game,k,options),cell=Object.create(base),home=C(6,2,3.5),half=C(.35,.35,.1);
 const mesh=k.geometry(new RoundedBoxGeometry(.7,.7,.2,1,.03),'metal',home.toArray(),new THREE.Quaternion(),{batch:false,name:'Finite motor-free hook hand rotor'});const collider=game.collisionProxy(new THREE.Box3().setFromObject(mesh),{kinematic:true});game.cameraBlockers.push(mesh);game.aimBlockers.push(mesh);
 let owner=null,driver=null,driverRegistration=null,hinge=null,subsystem=null,postStep=null,disposed=false,lastForceStep=-1,lastSampleStep=-1,handCount=0,lastHand=null,manualWork=0,lastForce=null,maxAbsTorque=0,maxTotalPower=-Infinity,forceCount=0,forceSamples=[];
 const forceApplications=new Map();
 function liveOwnership(){
  const errors=[];
  if(disposed||!owner||owner!==game.physics||base.owner!==owner)errors.push('physics-owner');
  if(!owner)return{valid:false,errors};
  const world=owner.world,anchor=base.hinge?.bodyA,entry=owner.bodyBoxes.get(collider.mesh.uuid),own=driverRegistration;
  const inherited=base.liveOwnership();errors.push(...inherited.errors);
  if(!driver||driver.world!==world||!world.bodies.includes(driver)||driver.type!==Body.DYNAMIC||driver.mass!==1)errors.push('driver-not-in-world');
  if(!own||entry!==own.entry||entry?.body!==own.body||entry?.shapeIndex!==own.shapeIndex||entry?.shape!==own.shape||driver?.shapes.length!==1||driver.shapes[own.shapeIndex]!==own.shape||own.shape.body!==driver||entry.orientedBox!==collider.orientedBox)errors.push('driver-shape-registration');
  else if(collider.enabled===false||!owner.inspectBodyBox(collider.mesh.uuid,{bounds:collider.box,orientedBox:collider.orientedBox,enabled:true}).valid)errors.push('driver-live-contact');
  if(!anchor||anchor.world!==world||!world.bodies.includes(anchor)||anchor.type!==Body.STATIC||anchor.mass!==0||anchor.shapes.length!==0)errors.push('driver-foundation');
  if(!hinge||!world.constraints.includes(hinge)||hinge.bodyA!==anchor||hinge.bodyB!==driver||hinge.equations.length!==5||hinge.equations.some(e=>e.enabled===false)||hinge.equations.includes(hinge.motorEquation)||hinge.motorEquation.enabled)errors.push('driver-hinge-ownership');
  return{valid:errors.length===0,errors};
 }
 function applySlipForces(dt){
  if(disposed||!owner||!Number.isFinite(dt)||!(dt>0))return;
  const step=owner.world.stepnumber;if(lastForceStep===step)return;
  lastForceStep=step;forceApplications.set(step,(forceApplications.get(step)??0)+1);if(forceApplications.size>4096)forceApplications.delete(forceApplications.keys().next().value);
  const live=liveOwnership(),hook=base.hookBody,difference=driver.angularVelocity.z-hook.angularVelocity.z;
  const tau=live.valid?Math.max(-torqueCeiling,Math.min(torqueCeiling,slipGain*difference)):0;
  const beforeHook=hook.torque.z,beforeDrive=driver.torque.z;
  if(live.valid){hook.torque.z+=tau;driver.torque.z-=tau;}
  const actualHookTorque=hook.torque.z-beforeHook,actualDriverTorque=driver.torque.z-beforeDrive;
  const totalPower=actualHookTorque*hook.angularVelocity.z+actualDriverTorque*driver.angularVelocity.z;
  lastForce={worldStep:step,forceClock:'actual-world-subsystem',liveOwnership:live.valid,ownershipErrors:live.errors,tau,actualHookTorque,actualDriverTorque,totalTorque:actualHookTorque+actualDriverTorque,omegaDrive:driver.angularVelocity.z,omegaHook:hook.angularVelocity.z,totalCouplingPower:totalPower,torqueCeiling,slipGain};
  maxAbsTorque=Math.max(maxAbsTorque,Math.abs(actualHookTorque),Math.abs(actualDriverTorque));maxTotalPower=Math.max(maxTotalPower,totalPower);forceCount++;
  if(forceSamples.length<8||step%120===0){forceSamples.push({...lastForce,ownershipErrors:[...live.errors]});if(forceSamples.length>128)forceSamples.shift();}
  if(live.valid)driver.torque.z-=.2*driver.angularVelocity.z;
 }
 Object.defineProperties(cell,{driverBody:{get:()=>driver},driverHinge:{get:()=>hinge},driverMesh:{value:mesh},bodies:{get:()=>[...base.bodies,...[driver].filter(Boolean)]},constraints:{get:()=>[...base.constraints,...[hinge].filter(Boolean)]},slipForceApplications:{value:forceApplications}});
 cell.ensure=()=>{
  if(disposed||(owner&&owner!==game.physics)||!base.ensure())return false;
  if(owner===game.physics)return liveOwnership().valid;
  owner=game.physics;owner.removeStaticBox(collider.mesh.uuid);
  driver=new Body({mass:1,position:home,allowSleep:false,linearDamping:0,angularDamping:0,material:new Material({friction:.02,restitution:0}),collisionFilterGroup:1,collisionFilterMask:3});driver.addShape(new Box(half));owner.world.addBody(driver);
  collider.orientedBox=createOrientedBoxContact(driver,V(half.x,half.y,half.z),V(),owner.world.stepnumber);owner.registerBodyBox(collider.mesh.uuid,{body:driver,shapeIndex:0,orientedBox:collider.orientedBox});
  const entry=owner.bodyBoxes.get(collider.mesh.uuid);driverRegistration={entry,body:driver,shapeIndex:0,shape:entry.shape};
  hinge=new HingeConstraint(base.hinge.bodyA,driver,{pivotA:home.vsub(base.hinge.bodyA.position),pivotB:C(),axisA:C(0,0,-1),axisB:C(0,0,-1),maxForce:1e6,collideConnected:false});hinge.equations=hinge.equations.filter(e=>e!==hinge.motorEquation);for(const e of hinge.equations)e.setSpookParams(1e8,4,DT);owner.world.addConstraint(hinge);
  subsystem={update:()=>applySlipForces(owner.world.dt)};owner.world.subsystems.push(subsystem);
  postStep=()=>{cell.syncPose();lastSampleStep=owner.world.stepnumber;};owner.world.addEventListener('postStep',postStep);cell.syncPose(true);return liveOwnership().valid;
 };
 cell.hand=()=>{
  if(!cell.ensure())return false;
  const before=driver.inertia.z*driver.angularVelocity.z,kineticBefore=.5*driver.inertia.z*driver.angularVelocity.z**2,arm=.4,impulse=handAngularImpulse/(2*arm);
  driver.applyImpulse(C(impulse,0,0),C(0,arm,0));driver.applyImpulse(C(-impulse,0,0),C(0,-arm,0));driver.wakeUp();handCount++;
  const work=.5*driver.inertia.z*driver.angularVelocity.z**2-kineticBefore;manualWork+=work;
  lastHand={worldStep:owner.world.stepnumber,angularImpulse:-handAngularImpulse,angularImpulseMagnitude:handAngularImpulse,driverAngularMomentumBefore:before,driverAngularMomentumAfter:driver.inertia.z*driver.angularVelocity.z,actualDriverWork:work,bearingForce:base.diagnostics().bearingForce,hookAngle:base.hookAngle};return true;
 };
 // Public frame preparation queues neither base cable nor coupling torques.
 // Input may safely arrive after it: the subsystem reads current velocities.
 cell.updateForces=dt=>{base.updateForces(dt);if(Number.isFinite(dt)&&dt>0&&!owner)cell.ensure();};
 cell.syncPose=(reset=false)=>{base.syncPose(reset);if(!driver)return;mesh.position.copy(driver.position);mesh.quaternion.copy(driver.quaternion);mesh.updateWorldMatrix(true,false);collider.box.setFromObject(mesh);syncOrientedBoxContact(collider.orientedBox,driver,owner.world.stepnumber,reset);};
 cell.reset=()=>{base.reset();if(!cell.ensure())return;driver.position.copy(home);driver.quaternion.set(0,0,0,1);driver.velocity.setZero();driver.angularVelocity.setZero();driver.force.setZero();driver.torque.setZero();driver.previousPosition.copy(home);driver.interpolatedPosition.copy(home);driver.previousQuaternion.copy(driver.quaternion);driver.interpolatedQuaternion.copy(driver.quaternion);driver.aabbNeedsUpdate=true;driver.updateInertiaWorld(true);driver.wakeUp();lastForceStep=lastSampleStep=-1;handCount=manualWork=forceCount=maxAbsTorque=0;maxTotalPower=-Infinity;lastHand=lastForce=null;forceSamples=[];forceApplications.clear();owner.world.broadphase.dirty=true;cell.syncPose(true);};
 cell.diagnostics=()=>{
  const d=base.diagnostics(),live=liveOwnership();return{...d,scope:d.scope+'; passive torque-limited hand rotor alternative',handMode:'passive-slip-rotor',handCount,lastHand:lastHand?{...lastHand}:null,manualWork,bodyIds:cell.bodies.map(b=>b.id),bodyTypes:cell.bodies.map(b=>b.type),bodiesPresent:!!owner&&cell.bodies.every(b=>b.world===owner.world&&owner.world.bodies.includes(b)),constraintIds:cell.constraints.map(c=>c.id),constraintEquationCounts:cell.constraints.map(c=>c.equations.length),motorEquationPresent:cell.constraints.map(c=>c.equations.includes(c.motorEquation)),motorEnabled:cell.constraints.map(c=>c.motorEquation?.enabled===true),slip:{worldStep:owner?.world.stepnumber??-1,contactStep:lastSampleStep,torqueCeiling,slipGain,captureHeight:.08,driverOmega:driver?.angularVelocity.z,driverPosition:driver?.position.toArray(),driverQuaternion:driver?.quaternion.toArray(),driverInertia:driver?.inertia.toArray(),forceClock:'actual-world-subsystem',forceCount,maxAbsTorque,maxTotalCouplingPower:Number.isFinite(maxTotalPower)?maxTotalPower:null,lastForce:lastForce?{...lastForce,ownershipErrors:[...lastForce.ownershipErrors]}:null,forceSamples:forceSamples.map(s=>({...s,ownershipErrors:[...s.ownershipErrors]})),registryValid:!!owner&&owner.bodyBoxes.get(collider.mesh.uuid)===driverRegistration?.entry&&owner.inspectBodyBox(collider.mesh.uuid,{bounds:collider.box,orientedBox:collider.orientedBox,enabled:true}).valid,liveOwnership:live.valid,ownershipErrors:live.errors}};
 };
 cell.dispose=()=>{
  if(disposed)return;disposed=true;
  if(owner){owner.world.removeEventListener('postStep',postStep);const i=owner.world.subsystems.indexOf(subsystem);if(i>=0)owner.world.subsystems.splice(i,1);base.stopCallbacks();
   const entry=owner.bodyBoxes.get(collider.mesh.uuid),own=driverRegistration;if(own&&entry===own.entry&&entry.body===own.body&&entry.shapeIndex===own.shapeIndex&&entry.shape===own.shape)owner.removeBodyBox(collider.mesh.uuid);
   owner.world.removeConstraint(hinge);owner.world.removeBody(driver);collider.enabled=false;delete collider.orientedBox;
  }base.dispose();
 };
 return cell;
}
