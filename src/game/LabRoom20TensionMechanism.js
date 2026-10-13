import * as THREE from 'three';
import {Body,Box,HingeConstraint,Material,Spring,Vec3} from 'cannon-es';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createOrientedBoxContact,syncOrientedBoxContact} from './LabOrientedBoxContact.js';

const C=(x=0,y=0,z=0)=>new Vec3(x,y,z),V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),DT=1/120;
const angle=b=>Math.atan2(2*(b.quaternion.w*b.quaternion.z+b.quaternion.x*b.quaternion.y),1-2*(b.quaternion.y**2+b.quaternion.z**2));

/** The ordinary chamber's entire two-door train is one massive sliding body.
 * Cable forces use current actual portal centres and equal endpoint tension.
 * A freely hinged loaded hook permits only its small captive pretravel; the
 * separate finite hand rotor releases it through a passive slip coupling.
 * The far retaining finger is another massive guided body with physical end
 * stops. No normal operation writes a body pose, clamps travel or latches an
 * opening flag. Explicit reset alone restores the manufactured start poses. */
export function buildRoom20TensionMechanism(game,k,{currentCablePath,handAngularImpulse=.7}={}){
 const gateParts=[],hookParts=[],fixedParts=[],bodies=[],constraints=[],bodyBoxIds=[],sweepIds=[],bodyBoxOwnership=new Map(),sweepOwnership=new Map(),bodyProperties=new Map();
 const pivot=C(3,2,1.7),gateEye=C(3,3,1.36),closingBase=8;
 const cableBudget={restLength:19.5,maxExtension:15.4,stiffness:110,damping:8,virtualLength:1.7,maxTension:180,unilateral:true,slackRule:'L<=restLength transmits exactly zero spring/damper force',closingBase,closingSlope:1.2,gateDamping:1.1,openingShockDamping:43.9,openingDampingTotal:45,trainMass:8,stroke:7.2};
 const material=new Material({friction:.025,restitution:0});
 let owner=null,gate=null,hook=null,fixed=null,anchor=null,hinge=null,spring=null,subsystem=null,postStep=null,disposed=false;
 let cablePath=null,lastCableForce=null,lastTrainForce=null;
 let forceStep=-1,sampleStep=-1,contactStep=-1,bearingForce=0,bearingContacts=0,captureForce=0,captureContacts=0,seatForce=0,seatContacts=0,tension=0,stretch=0,handCount=0,lastHand=null,cableWork=0,interval=null;
 const forceApplications=new Map();
 function worldPart(list,name,position,size,mass=0){
  const mesh=k.geometry(new RoundedBoxGeometry(...size,1,.025),'metal',position,new THREE.Quaternion(),{batch:false,name});
  const collider=game.collisionProxy(new THREE.Box3().setFromObject(mesh),{kinematic:true});
  game.cameraBlockers.push(mesh);game.aimBlockers.push(mesh);
  const p={mesh,collider,authored:C(...position),offset:C(...position),half:C(...size.map(n=>n/2)),mass};list.push(p);return p;
 }
 function part(list,name,position,size,mass=0){return worldPart(list,name,[3-position[0],position[1],position[2]+1.7],size,mass);}
 const bearingLug=part(gateParts,'Loaded gate bearing lug',[0,1.6,0],[.2,.2,.2]);
 // Cargo pretravel bears wholly above the hinge axis. Its horizontal load
 // presses the hook into its founded closed seat rather than turning it
 // toward release during a portal-exit force burst. The same finite hand
 // rotor can lift this face after the bearing arm is unloaded.
 const captureLug=part(gateParts,'Captive gate pretravel lug',[0,2.04,0],[.2,.04,.2]);
 const leaf=worldPart(gateParts,'Tension-driven horizontal bulkhead',[0,3.27,.85],[8.5,6.5,.65]);leaf.mesh.material=k.m.secondary;
 const returnLeaf=worldPart(gateParts,'Rigidly linked return-court bulkhead',[16,3.27,.85],[8.5,6.5,.65]);returnLeaf.mesh.material=k.m.secondary;
 const tie=worldPart(gateParts,'Solid overhead connection between both leaves',[8,6.27,.85],[24.5,.28,.5]);
 const tooth=worldPart(gateParts,'Actual far-side retaining tooth',[3.7,2.2,.25],[.30,1,.30]);
 const bearingArm=part(hookParts,'Loaded near-hook bearing arm',[-.16,1.6,0],[.12,.4,.3],.06);
 const capturePost=part(hookParts,'Captive near-hook opening stop',[.8,2.06,0],[.16,.08,.3],.06);
 part(hookParts,'Rigid hook back connector',[.265,2,.5],[1.18,.12,.12],.06);
 part(hookParts,'Near connector neck',[-.30,1.90,.35],[.12,.4,.4],.02);
 part(hookParts,'Bearing-arm neck connection',[-.25,1.73,.25],[.24,.08,.4],.015);
 const seatArm=part(hookParts,'Far connector neck',[.8,2,.35],[.16,.16,.4],.02);
 const moment=hookParts.reduce((sum,p)=>sum+p.mass*(3-p.authored.x),0);
 part(hookParts,'Gravity-balancing near-hook counterweight',[-.65,2,.5],[.24,.24,.24],moment/.65);
 worldPart(fixedParts,'Founded closed train end stop',[4.35,2.87,.85],[.1,5.7,.70]);
 worldPart(fixedParts,'Founded open train end stop',[-11.65,2.87,.85],[.4,5.7,.70]);
 const closedSeat=part(fixedParts,'Actual hook closed seat',[.8,1.83,.27],[.3,.18,.10]);
 part(fixedParts,'Actual hook open end stop',[-.95,2.24,0],[.18,.4,.4]);
 const hookMass=hookParts.reduce((s,p)=>s+p.mass,0),hookCOM=C();for(const p of hookParts)hookCOM.vadd(p.authored.scale(p.mass/hookMass),hookCOM);
 const COMOffset=hookCOM.vsub(pivot);for(const p of hookParts)p.offset=p.authored.vsub(hookCOM);
 function addBody(body,name){body.labRoom20Mechanism=name;owner.world.addBody(body);bodies.push(body);bodyProperties.set(body,{type:body.type,mass:body.mass});return body;}
 function descriptor(p,b){p.collider.orientedBox=createOrientedBoxContact(b,V(p.half.x,p.half.y,p.half.z),V(p.offset.x,p.offset.y,p.offset.z),owner.world.stepnumber);owner.registerBodyBox(p.collider.mesh.uuid,{body:b,shapeIndex:b.shapes.length-1,orientedBox:p.collider.orientedBox});bodyBoxIds.push(p.collider.mesh.uuid);const entry=owner.bodyBoxes.get(p.collider.mesh.uuid);bodyBoxOwnership.set(p.collider.mesh.uuid,{entry,body:b,shapeIndex:entry.shapeIndex,shape:entry.shape});}
 function removeOwned(map,ownership,id,remove){const own=ownership.get(id),entry=map.get(id);if(own&&entry===own.entry&&entry.body===own.body&&entry.shapeIndex===own.shapeIndex&&entry.shape===own.shape)remove(id);}
 function liveOwnership(inspectContacts=true){const errors=[];if(disposed||!owner||owner!==game.physics)errors.push('physics-owner');if(!owner)return{valid:false,errors};const world=owner.world;
  for(const b of bodies){if(b.world!==world||!world.bodies.includes(b))errors.push('body-not-in-world:'+b.id);const expected=bodyProperties.get(b);if(!expected||b.type!==expected.type||b.mass!==expected.mass)errors.push('authored-body-type-mass:'+b.id);}
  if(!anchor||anchor.mass!==0||anchor.type!==Body.STATIC||anchor.shapes.length!==0)errors.push('hinge-foundation');
  if(!hinge||!world.constraints.includes(hinge)||hinge.bodyA!==anchor||hinge.bodyB!==hook||hinge.equations.length!==5||hinge.equations.some(e=>e.enabled===false)||hinge.equations.includes(hinge.motorEquation)||hinge.motorEquation.enabled)errors.push('hinge-ownership');
  for(const [parts,b]of [[gateParts,gate],[hookParts,hook],[fixedParts,fixed]]){if(!b||b.shapes.length!==parts.length)errors.push('compound-shape-count');for(const p of parts){const own=bodyBoxOwnership.get(p.collider.mesh.uuid),entry=owner.bodyBoxes.get(p.collider.mesh.uuid);if(!own||entry!==own.entry||entry.body!==b||entry.shapeIndex!==own.shapeIndex||entry.shape!==own.shape||b.shapes[own.shapeIndex]!==own.shape||own.shape.body!==b||entry.orientedBox!==p.collider.orientedBox)errors.push('shape-registration:'+p.collider.mesh.uuid);else if(inspectContacts&&(p.collider.enabled===false||!owner.inspectBodyBox(p.collider.mesh.uuid,{orientedBox:p.collider.orientedBox,bounds:p.collider.box,enabled:true}).valid))errors.push('live-contact:'+p.collider.mesh.uuid);}}
  if(inspectContacts&&(!canCollide(gate,gate?.shapes[0],hook,hook?.shapes[0])||!canCollide(hook,hook?.shapes[0],fixed,fixed?.shapes[0])))errors.push('mechanism-contact-masks');
  return{valid:errors.length===0,errors};
 }
 function applyForces(dt){if(disposed||!owner||owner!==game.physics||!Number.isFinite(dt)||!(dt>0)||!cell.ensure()){tension=stretch=0;interval=null;return;}const step=owner.world.stepnumber;if(forceStep===step)return;forceStep=step;forceApplications.set(step,(forceApplications.get(step)??0)+1);if(forceApplications.size>4096)forceApplications.delete(forceApplications.keys().next().value);tension=stretch=0;interval=null;if(!liveOwnership(false).valid)return;
  // A founded check valve throttles only the opening stroke. Its force
  // opposes the actual velocity and is dissipative in either direction;
  // the closing stroke retains the ordinary low drag. No travel, cargo or
  // readiness predicate enters this permanently authored material law.
  const vx=gate.velocity.x,closingSpringForce=closingBase-1.2*gate.position.x;
  const baselineDrag=-1.1*vx,openingShockDrag=-43.9*Math.min(vx,0);
  const trainForce=closingSpringForce+baselineDrag+openingShockDrag,beforeGateForce=gate.force.x,beforeFixedForce=fixed.force.x;
  gate.force.x+=trainForce;fixed.force.x-=trainForce;
  lastTrainForce={worldStep:step,velocityX:vx,closingSpringForce,baselineDampingCoefficient:1.1,openingShockDampingCoefficient:43.9,baselineDrag,openingShockDrag,
    openingShockPower:openingShockDrag*vx,totalViscousPower:(baselineDrag+openingShockDrag)*vx,
    actualGateAppliedForce:gate.force.x-beforeGateForce,actualFoundedAppliedForce:fixed.force.x-beforeFixedForce,
    foundedReactionPower:(fixed.force.x-beforeFixedForce)*fixed.velocity.x,forceBalance:(gate.force.x-beforeGateForce)+(fixed.force.x-beforeFixedForce)};
  spring.applyForce();hook.torque.z-=.035*hook.angularVelocity.z;
  cablePath=null;lastCableForce=null;
  if(originalIdentity()){
   const cargo=cell.originalCargoBody,path=currentCablePath?.(gate.position.vadd(gateEye),cargo.position);
   if(path){
    const near=C(...path.near),far=C(...path.far),length=path.length,rate=cargo.velocity.dot(far)-gate.velocity.dot(near);
    cablePath={...path,worldStep:step,rate,reachable:length<=cableBudget.restLength+cableBudget.maxExtension};
    if(cablePath.reachable){stretch=Math.max(0,length-cableBudget.restLength);const unclampedTension=stretch>0?Math.max(0,cableBudget.stiffness*stretch+cableBudget.damping*rate):0;tension=Math.min(cableBudget.maxTension,unclampedTension);const nearForce=near.scale(tension),farForce=far.scale(-tension);gate.force.vadd(nearForce,gate.force);cargo.force.vadd(farForce,cargo.force);const power=nearForce.dot(gate.velocity)+farForce.dot(cargo.velocity);lastCableForce={worldStep:step,unilateral:true,slack:stretch===0,extension:stretch,unclampedTension,capApplied:unclampedTension>cableBudget.maxTension,nearForce:nearForce.toArray(),farForce:farForce.toArray(),gatePower:nearForce.dot(gate.velocity),cargoPower:farForce.dot(cargo.velocity),totalEndpointPower:power,negativeTensionPathRate:-tension*rate,openingPull:-nearForce.x,endpointMagnitudeError:Math.abs(nearForce.length()-farForce.length())};if(tension>0){cargo.wakeUp();gate.wakeUp();}interval={step,tension,gatePosition:gate.position.clone(),near:near.clone()};}
   }
  }
 }
 function addShapes(parts,b){for(const p of parts){b.addShape(new Box(p.half),p.offset);descriptor(p,b);}}
 function syncPart(p,b,reset=false){const q=b.quaternion,o=q.vmult(p.offset);p.mesh.position.set(b.position.x+o.x,b.position.y+o.y,b.position.z+o.z);p.mesh.quaternion.set(q.x,q.y,q.z,q.w);p.mesh.updateWorldMatrix(true,false);p.collider.box.setFromObject(p.mesh);syncOrientedBoxContact(p.collider.orientedBox,b,owner.world.stepnumber,reset);}
 function place(body,position,q=null){body.position.copy(position);body.quaternion.copy(q??new THREE.Quaternion());body.velocity.setZero();body.angularVelocity.setZero();body.force.setZero();body.torque.setZero();body.previousPosition.copy(body.position);body.interpolatedPosition.copy(body.position);body.previousQuaternion.copy(body.quaternion);body.interpolatedQuaternion.copy(body.quaternion);body.aabbNeedsUpdate=true;body.updateInertiaWorld(true);body.wakeUp();}
 function canCollide(a,sa,b,sb){return!disposed&&owner&&owner===game.physics&&a&&b&&sa&&sb&&a.world===owner.world&&b.world===owner.world&&owner.world.bodies.includes(a)&&owner.world.bodies.includes(b)&&a.collisionResponse!==false&&b.collisionResponse!==false&&sa.collisionResponse!==false&&sb.collisionResponse!==false&&(a.collisionFilterGroup&b.collisionFilterMask)!==0&&(b.collisionFilterGroup&a.collisionFilterMask)!==0&&(sa.collisionFilterGroup&sb.collisionFilterMask)!==0&&(sb.collisionFilterGroup&sa.collisionFilterMask)!==0;}
 function originalIdentity(){const b=cell.originalCargoBody,s=cell.originalCargoShape;return !disposed&&owner===game.physics&&game.cargo===cell.originalCargo&&owner.cargoBody===b&&b?.type===Body.DYNAMIC&&b.mass>0&&b.shapes[0]===s&&b.world===owner.world&&owner.world.bodies.includes(b);}
 function freeOriginal(){const b=cell.originalCargoBody,s=cell.originalCargoShape;return!disposed&&owner&&game.cargo===cell.originalCargo&&owner.cargoBody===b&&b?.type===Body.DYNAMIC&&b.mass>0&&b.shapes[0]===s&&b.world===owner.world&&owner.world.bodies.includes(b)&&!game.heldCube&&!owner.carryTarget&&canCollide(b,s,gate,gate?.shapes[0]);}
 function owned(part,b){const p=owner?.bodyBoxes.get(part.collider.mesh.uuid),own=bodyBoxOwnership.get(part.collider.mesh.uuid);return!!own&&p===own.entry&&p.body===b&&p.shapeIndex===own.shapeIndex&&p.shape===own.shape&&p.shape===b.shapes[p.shapeIndex]&&p.orientedBox===part.collider.orientedBox&&part.collider.enabled!==false&&owner.inspectBodyBox(part.collider.mesh.uuid,{orientedBox:part.collider.orientedBox,bounds:part.collider.box,enabled:true}).valid;}
 function contacts(a,sa,b,sb){return owner.world.contacts.filter(c=>c.enabled!==false&&c.multiplier>1e-6&&((c.bi===a&&c.si===sa&&c.bj===b&&c.sj===sb)||(c.bi===b&&c.si===sb&&c.bj===a&&c.sj===sa)));}
 function currentFace(kind){const gp=kind==='bearing'?bearingLug:captureLug,hp=kind==='bearing'?bearingArm:capturePost;if(!owner||contactStep!==owner.world.stepnumber||!owned(gp,gate)||!owned(hp,hook)||!canCollide(gate,gate.shapes[gateParts.indexOf(gp)],hook,hook.shapes[hookParts.indexOf(hp)]))return false;const a=gp.collider.orientedBox.current.bounds,b=hp.collider.orientedBox.current.bounds,gap=kind==='bearing'?b.min.x-a.max.x:a.min.x-b.max.x;return Math.abs(gap)<.012&&a.min.y<b.max.y&&a.max.y>b.min.y&&a.min.z<b.max.z&&a.max.z>b.min.z;}
 function sample(){const step=owner.world.stepnumber;if(step===sampleStep)return;sampleStep=contactStep=step;if(interval&&interval.step===step-1)cableWork+=interval.tension*gate.position.vsub(interval.gatePosition).dot(interval.near);bearingForce=bearingContacts=captureForce=captureContacts=seatForce=seatContacts=0;
  for(const[cargoPart,hookPart,kind]of [[bearingLug,bearingArm,'bearing'],[captureLug,capturePost,'capture']]){const gi=gateParts.indexOf(cargoPart),hi=hookParts.indexOf(hookPart);if(!owned(cargoPart,gate)||!owned(hookPart,hook)||!canCollide(gate,gate.shapes[gi],hook,hook.shapes[hi]))continue;for(const c of contacts(gate,gate.shapes[gi],hook,hook.shapes[hi])){const nx=-(c.bi===gate?-1:1)*c.ni.x;if(kind==='bearing'&&nx>.65){bearingForce+=nx*c.multiplier;bearingContacts++;}if(kind==='capture'&&nx<-.65){captureForce+=-nx*c.multiplier;captureContacts++;}}}
  const si=fixedParts.indexOf(closedSeat),hi=hookParts.indexOf(seatArm);if(owned(closedSeat,fixed)&&owned(seatArm,hook)&&canCollide(hook,hook.shapes[hi],fixed,fixed.shapes[si]))for(const c of contacts(hook,hook.shapes[hi],fixed,fixed.shapes[si])){const ny=(c.bi===hook?-1:1)*c.ni.y;if(ny>.65){seatForce+=ny*c.multiplier;seatContacts++;}}
 }
 const cell={scope:'ordinary Foundation Room20 current-aperture cable and physical train/hook',gateParts,hookParts,fixedParts,leaf,returnLeaf,tie,tooth,bearingLug,captureLug,bearingArm,capturePost,seatArm,closedSeat,pivot,COMOffset,handAngularImpulse,forceApplications,
  get owner(){return owner;},get bodies(){return bodies;},get constraints(){return constraints;},get gateBody(){return gate;},get hookBody(){return hook;},get fixedBody(){return fixed;},get hinge(){return hinge;},get hookAngle(){return hook?-angle(hook):0;},get opening(){return -(gate?.position.x??0)||0;},get originalFree(){return freeOriginal();},liveOwnership,
  ensure(){if(disposed||!game.physics?.cargoBody||(owner&&owner!==game.physics))return false;if(owner===game.physics)return true;owner=game.physics;cell.originalCargo=game.cargo;cell.originalCargoBody=owner.cargoBody;cell.originalCargoShape=owner.cargoBody.shapes[0];for(const p of [...gateParts,...hookParts,...fixedParts])owner.removeStaticBox(p.collider.mesh.uuid);
   anchor=addBody(new Body({mass:0,position:pivot,collisionFilterGroup:1,collisionFilterMask:0}),'shapeless hinge foundation');
   fixed=addBody(new Body({mass:0,material,collisionFilterGroup:1,collisionFilterMask:3}),'permanently founded stops');addShapes(fixedParts,fixed);for(const[i,p]of fixedParts.entries()){owner.registerCargoSweepBox(p.collider.mesh.uuid,{body:fixed,shapeIndex:i});sweepIds.push(p.collider.mesh.uuid);const entry=owner.cargoSweepBoxes.get(p.collider.mesh.uuid);sweepOwnership.set(p.collider.mesh.uuid,{entry,body:fixed,shapeIndex:i,shape:entry.shape});}
   gate=addBody(new Body({mass:8,linearFactor:C(1,0,0),fixedRotation:true,allowSleep:false,linearDamping:0,material,collisionFilterGroup:1,collisionFilterMask:3}),'guided massive train');addShapes(gateParts,gate);
   hook=addBody(new Body({mass:hookMass,position:hookCOM,allowSleep:false,linearDamping:0,angularDamping:0,material,collisionFilterGroup:1,collisionFilterMask:3}),'actual captive hinged hook');addShapes(hookParts,hook);
   const inertia=C();for(const p of hookParts){const h=p.half,o=p.offset;inertia.x+=p.mass*((h.y*h.y+h.z*h.z)/3+o.y*o.y+o.z*o.z);inertia.y+=p.mass*((h.x*h.x+h.z*h.z)/3+o.x*o.x+o.z*o.z);inertia.z+=p.mass*((h.x*h.x+h.y*h.y)/3+o.x*o.x+o.y*o.y);}hook.inertia.copy(inertia);hook.invInertia.set(1/inertia.x,1/inertia.y,1/inertia.z);hook.updateInertiaWorld(true);
   hinge=new HingeConstraint(anchor,hook,{pivotA:C(),pivotB:COMOffset.negate(),axisA:C(0,0,-1),axisB:C(0,0,-1),maxForce:1e6,collideConnected:false});hinge.equations=hinge.equations.filter(e=>e!==hinge.motorEquation);for(const e of hinge.equations)e.setSpookParams(1e8,4,DT);owner.world.addConstraint(hinge);constraints.push(hinge);
   spring=new Spring(anchor,hook,{worldAnchorA:pivot.vadd(C(.25,-.025,0)),localAnchorB:C(-.35,0,0).vsub(COMOffset),restLength:.1,stiffness:40,damping:.04});
   subsystem={update:()=>applyForces(owner.world.dt)};owner.world.subsystems.push(subsystem);postStep=()=>{cell.syncPose();sample();};owner.world.addEventListener('postStep',postStep);cell.syncPose(true);return true;
  },
  // Frame preparation never queues forces. Only the registered subsystem may
  // apply them immediately before the actual collision/constraint solver.
  updateForces(dt){if(Number.isFinite(dt)&&dt>0)cell.ensure();},
  syncPose(reset=false){if(!cell.ensure())return;for(const p of gateParts)syncPart(p,gate,reset);for(const p of hookParts)syncPart(p,hook,reset);for(const p of fixedParts)syncPart(p,fixed,reset);},
  reset(){if(!cell.ensure())return;place(gate,C());place(hook,hookCOM);forceStep=sampleStep=contactStep=-1;bearingForce=bearingContacts=captureForce=captureContacts=seatForce=seatContacts=tension=stretch=handCount=cableWork=0;lastHand=interval=null;cablePath=lastCableForce=lastTrainForce=null;forceApplications.clear();owner.world.broadphase.dirty=true;cell.syncPose(true);},
  diagnostics(){const bearingCurrent=currentFace('bearing'),captureCurrent=currentFace('capture');return{scope:cell.scope,budget:{...cableBudget,gateEyeLocal:gateEye.toArray(),forceClock:'actual-world-subsystem',chirality:'opening−X/release−Z'},cablePath,lastCableForce,lastTrainForce,disposed,worldStep:owner?.world.stepnumber??-1,contactStep,opening:cell.opening,hookAngle:cell.hookAngle,gateVelocity:gate?.velocity.toArray(),hookAngularVelocity:hook?.angularVelocity.toArray(),bearingForce:bearingCurrent?bearingForce:0,bearingContacts:bearingCurrent?bearingContacts:0,rawBearingForce:bearingForce,rawBearingContacts:bearingContacts,bearingGeometryCurrent:bearingCurrent,captureForce:captureCurrent?captureForce:0,captureContacts:captureCurrent?captureContacts:0,rawCaptureForce:captureForce,rawCaptureContacts:captureContacts,captureGeometryCurrent:captureCurrent,seatForce,seatContacts,tension,stretch,cableWork,handCount,lastHand:lastHand?{...lastHand}:null,originalFree:freeOriginal(),originalCargoBodyId:cell.originalCargoBody?.id,originalCargoShapeId:cell.originalCargoShape?.id,bodyIds:bodies.map(b=>b.id),bodyTypes:bodies.map(b=>b.type),bodiesPresent:!!owner&&bodies.every(b=>b.world===owner.world&&owner.world.bodies.includes(b)),constraintIds:constraints.map(c=>c.id),constraintEquationCounts:constraints.map(c=>c.equations.length),motorEquationPresent:constraints.map(c=>c.equations.includes(c.motorEquation)),motorEnabled:constraints.map(c=>c.motorEquation?.enabled===true),ownedPartsValid:!!owner&&[...gateParts.map(p=>[p,gate]),...hookParts.map(p=>[p,hook]),...fixedParts.map(p=>[p,fixed])].every(([p,b])=>owned(p,b)),cargoPosition:cell.originalCargoBody?.position.toArray(),gatePosition:gate?.position.toArray(),hookPosition:hook?.position.toArray(),hookQuaternion:hook?.quaternion.toArray()};},
  stopCallbacks(){if(!owner)return;owner.world.removeEventListener('postStep',postStep);const i=owner.world.subsystems.indexOf(subsystem);if(i>=0)owner.world.subsystems.splice(i,1);},
  dispose(){if(disposed)return;disposed=true;if(!owner)return;cell.stopCallbacks();for(const id of bodyBoxIds)removeOwned(owner.bodyBoxes,bodyBoxOwnership,id,key=>owner.removeBodyBox(key));for(const id of sweepIds)removeOwned(owner.cargoSweepBoxes,sweepOwnership,id,key=>owner.removeCargoSweepBox(key));for(const c of constraints)owner.world.removeConstraint(c);for(const b of bodies)owner.world.removeBody(b);for(const p of [...gateParts,...hookParts,...fixedParts]){p.collider.enabled=false;delete p.collider.orientedBox;}},
 };
 return cell;
}
