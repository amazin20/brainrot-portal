import * as THREE from 'three';
import {Body,Box,HingeConstraint,Material,Spring,Vec3} from 'cannon-es';
import {createOrientedBoxContact,syncOrientedBoxContact} from './LabOrientedBoxContact.js';

const C=(x=0,y=0,z=0)=>new Vec3(x,y,z),V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),DT=1/120;
const angle=b=>Math.atan2(2*(b.quaternion.w*b.quaternion.z+b.quaternion.x*b.quaternion.y),1-2*(b.quaternion.y**2+b.quaternion.z**2));

/** DIAGNOSTIC primitive only: a captive near hook and a guided spring door.
 * Two fixed fairleads stand in for a current portal cable; there is no room,
 * player route, far retaining finger, win predicate or publication acceptance.
 * All ordinary motion follows forces/contacts; only explicit reset restores
 * poses. A finite release impulse is applied identically under either load. */
export function buildRoom20NearHookPrototype(game,k,{handAngularImpulse=.7}={}){
 if(!(handAngularImpulse>0&&handAngularImpulse<=.7))throw new RangeError('Finite hook hand impulse required');
 const gateParts=[],hookParts=[],fixedParts=[],bodies=[],constraints=[],bodyBoxIds=[],sweepIds=[];
 const pivot=C(0,2,0),nearLead=C(6,2.7,0),farLead=C(10,6,0),gateEye=C(2,2.7,0);
 const material=new Material({friction:.025,restitution:0});
 let owner=null,gate=null,hook=null,fixed=null,anchor=null,hinge=null,spring=null,subsystem=null,postStep=null,disposed=false;
 let forceStep=-1,sampleStep=-1,contactStep=-1,bearingForce=0,bearingContacts=0,captureForce=0,captureContacts=0,seatForce=0,seatContacts=0,cableConnected=true,tension=0,stretch=0,handCount=0,lastHand=null,cableWork=0,interval=null;
 const forceApplications=new Map();
 function part(list,name,position,size,mass=0){const mesh=k.box(position,size,k.m.steel,{dynamic:true});mesh.name=name;const p={mesh,collider:mesh.userData.collider,authored:C(...position),offset:C(...position),half:C(...size.map(n=>n/2)),mass};list.push(p);return p;}
 const bearingLug=part(gateParts,'20 prototype gate bearing lug',[0,1.6,0],[.2,.2,.2]);
 const captureLug=part(gateParts,'20 prototype captive full-stroke lug',[0,2,0],[.2,.16,.2]);
 part(gateParts,'20 prototype actual guided door panel',[2,1.6,2],[3,3.2,.35]);
 const bearingArm=part(hookParts,'20 prototype loaded hook bearing arm',[-.16,1.6,0],[.12,.4,.3],.06);
 const capturePost=part(hookParts,'20 prototype captive opening stop',[.8,2,0],[.16,.16,.3],.06);
 part(hookParts,'20 prototype rigid back connector',[.265,2,.5],[1.18,.12,.12],.06);
 part(hookParts,'20 prototype near connector neck',[-.30,1.90,.35],[.12,.4,.4],.02);
 part(hookParts,'20 prototype load-arm neck connection',[-.25,1.73,.25],[.24,.08,.4],.015);
 const seatArm=part(hookParts,'20 prototype far connector neck',[.8,2,.35],[.16,.16,.4],.02);
 // Real counterweight balances the initial gravity moment around the hinge.
 const moment=hookParts.reduce((sum,p)=>sum+p.mass*p.authored.x,0);
 part(hookParts,'20 prototype hook counterweight',[-.65,2,.5],[.24,.24,.24],moment/.65);
 part(fixedParts,'20 prototype finite closed train stop',[.35,1.6,2],[.2,3.2,.45]);
 part(fixedParts,'20 prototype finite open train stop',[6,1.6,2],[.2,3.2,.45]);
 const closedSeat=part(fixedParts,'20 prototype actual hook closed seat',[.8,1.83,.27],[.3,.18,.10]);
 part(fixedParts,'20 prototype actual hook open stop',[-.95,2.24,0],[.18,.4,.4]);
 part(fixedParts,'20 prototype founded cargo recovery floor',[10,-6.2,0],[8,.4,8]);
 for(const z of [1.6,2.4])part(fixedParts,'20 prototype founded guide rail',[2.9,3.42,z],[6.2,.2,.2]);
 const hookMass=hookParts.reduce((s,p)=>s+p.mass,0),hookCOM=C();for(const p of hookParts)hookCOM.vadd(p.authored.scale(p.mass/hookMass),hookCOM);
 const COMOffset=hookCOM.vsub(pivot);for(const p of hookParts)p.offset=p.authored.vsub(hookCOM);
 function addBody(body,name){body.labPrototype20=name;owner.world.addBody(body);bodies.push(body);return body;}
 function descriptor(p,b){p.collider.orientedBox=createOrientedBoxContact(b,V(p.half.x,p.half.y,p.half.z),V(p.offset.x,p.offset.y,p.offset.z),owner.world.stepnumber);owner.registerBodyBox(p.mesh.uuid,{body:b,shapeIndex:b.shapes.length-1,orientedBox:p.collider.orientedBox});bodyBoxIds.push(p.mesh.uuid);}
 function addShapes(parts,b){for(const p of parts){b.addShape(new Box(p.half),p.offset);descriptor(p,b);}}
 function syncPart(p,b,reset=false){const q=b.quaternion,o=q.vmult(p.offset);p.mesh.position.set(b.position.x+o.x,b.position.y+o.y,b.position.z+o.z);p.mesh.quaternion.set(q.x,q.y,q.z,q.w);p.mesh.updateWorldMatrix(true,false);p.collider.box.setFromObject(p.mesh);syncOrientedBoxContact(p.collider.orientedBox,b,owner.world.stepnumber,reset);}
 function place(body,position,q=null){body.position.copy(position);body.quaternion.copy(q??new THREE.Quaternion());body.velocity.setZero();body.angularVelocity.setZero();body.force.setZero();body.torque.setZero();body.previousPosition.copy(body.position);body.interpolatedPosition.copy(body.position);body.previousQuaternion.copy(body.quaternion);body.interpolatedQuaternion.copy(body.quaternion);body.aabbNeedsUpdate=true;body.updateInertiaWorld(true);body.wakeUp();}
 function canCollide(a,sa,b,sb){return!disposed&&owner&&a&&b&&sa&&sb&&a.world===owner.world&&b.world===owner.world&&owner.world.bodies.includes(a)&&owner.world.bodies.includes(b)&&a.collisionResponse!==false&&b.collisionResponse!==false&&sa.collisionResponse!==false&&sb.collisionResponse!==false&&(a.collisionFilterGroup&b.collisionFilterMask)!==0&&(b.collisionFilterGroup&a.collisionFilterMask)!==0&&(sa.collisionFilterGroup&sb.collisionFilterMask)!==0&&(sb.collisionFilterGroup&sa.collisionFilterMask)!==0;}
 function freeOriginal(){const b=cell.originalCargoBody,s=cell.originalCargoShape;return!disposed&&owner&&game.cargo===cell.originalCargo&&owner.cargoBody===b&&b?.type===Body.DYNAMIC&&b.mass>0&&b.shapes[0]===s&&b.world===owner.world&&owner.world.bodies.includes(b)&&!game.heldCube&&!owner.carryTarget&&canCollide(b,s,gate,gate?.shapes[0]);}
 function owned(part,b){const p=owner?.bodyBoxes.get(part.mesh.uuid);return!!p&&p.body===b&&p.shape===b.shapes[p.shapeIndex]&&p.orientedBox===part.collider.orientedBox&&part.collider.enabled!==false&&owner.inspectBodyBox(part.mesh.uuid,{orientedBox:part.collider.orientedBox,bounds:part.collider.box,enabled:true}).valid;}
 function contacts(a,sa,b,sb){return owner.world.contacts.filter(c=>c.enabled!==false&&c.multiplier>1e-6&&((c.bi===a&&c.si===sa&&c.bj===b&&c.sj===sb)||(c.bi===b&&c.si===sb&&c.bj===a&&c.sj===sa)));}
 function currentFace(kind){const gp=kind==='bearing'?bearingLug:captureLug,hp=kind==='bearing'?bearingArm:capturePost;if(!owner||contactStep!==owner.world.stepnumber||!owned(gp,gate)||!owned(hp,hook)||!canCollide(gate,gate.shapes[gateParts.indexOf(gp)],hook,hook.shapes[hookParts.indexOf(hp)]))return false;const a=gp.collider.orientedBox.current.bounds,b=hp.collider.orientedBox.current.bounds,gap=kind==='bearing'?a.min.x-b.max.x:b.min.x-a.max.x;return Math.abs(gap)<.012&&a.min.y<b.max.y&&a.max.y>b.min.y&&a.min.z<b.max.z&&a.max.z>b.min.z;}
 function sample(){const step=owner.world.stepnumber;if(step===sampleStep)return;sampleStep=contactStep=step;if(interval&&interval.step===step-1)cableWork+=interval.tension*gate.position.vsub(interval.gatePosition).dot(interval.near);bearingForce=bearingContacts=captureForce=captureContacts=seatForce=seatContacts=0;
  for(const[cargoPart,hookPart,kind]of [[bearingLug,bearingArm,'bearing'],[captureLug,capturePost,'capture']]){const gi=gateParts.indexOf(cargoPart),hi=hookParts.indexOf(hookPart);if(!owned(cargoPart,gate)||!owned(hookPart,hook)||!canCollide(gate,gate.shapes[gi],hook,hook.shapes[hi]))continue;for(const c of contacts(gate,gate.shapes[gi],hook,hook.shapes[hi])){const nx=(c.bi===gate?-1:1)*c.ni.x;if(kind==='bearing'&&nx>.65){bearingForce+=nx*c.multiplier;bearingContacts++;}if(kind==='capture'&&nx<-.65){captureForce+=-nx*c.multiplier;captureContacts++;}}}
  const si=fixedParts.indexOf(closedSeat),hi=hookParts.indexOf(seatArm);if(owned(closedSeat,fixed)&&owned(seatArm,hook)&&canCollide(hook,hook.shapes[hi],fixed,fixed.shapes[si]))for(const c of contacts(hook,hook.shapes[hi],fixed,fixed.shapes[si])){const ny=(c.bi===hook?-1:1)*c.ni.y;if(ny>.65){seatForce+=ny*c.multiplier;seatContacts++;}}
 }
 const cell={scope:'DIAGNOSTIC near-hook primitive; no portal/player/far-finger/ordinary acceptance',gateParts,hookParts,fixedParts,bearingLug,captureLug,bearingArm,capturePost,seatArm,closedSeat,pivot,COMOffset,handAngularImpulse,forceApplications,
  get owner(){return owner;},get bodies(){return bodies;},get constraints(){return constraints;},get gateBody(){return gate;},get hookBody(){return hook;},get fixedBody(){return fixed;},get hinge(){return hinge;},get hookAngle(){return hook?angle(hook):0;},get opening(){return gate?.position.x??0;},get originalFree(){return freeOriginal();},
  ensure(){if(disposed||!game.physics?.cargoBody)return false;if(owner===game.physics)return true;if(owner)throw Error('Prototype cannot change physics owner');owner=game.physics;cell.originalCargo=game.cargo;cell.originalCargoBody=owner.cargoBody;cell.originalCargoShape=owner.cargoBody.shapes[0];for(const p of [...gateParts,...hookParts,...fixedParts])owner.removeStaticBox(p.mesh.uuid);
   anchor=addBody(new Body({mass:0,position:pivot,collisionFilterGroup:1,collisionFilterMask:0}),'shapeless hinge foundation');
   fixed=addBody(new Body({mass:0,material,collisionFilterGroup:1,collisionFilterMask:3}),'permanently founded stops');addShapes(fixedParts,fixed);for(const[i,p]of fixedParts.entries()){owner.registerCargoSweepBox(p.mesh.uuid,{body:fixed,shapeIndex:i});sweepIds.push(p.mesh.uuid);}
   gate=addBody(new Body({mass:8,linearFactor:C(1,0,0),fixedRotation:true,allowSleep:false,linearDamping:0,material,collisionFilterGroup:1,collisionFilterMask:3}),'guided massive train');addShapes(gateParts,gate);
   hook=addBody(new Body({mass:hookMass,position:hookCOM,allowSleep:false,linearDamping:0,angularDamping:0,material,collisionFilterGroup:1,collisionFilterMask:3}),'actual captive hinged hook');addShapes(hookParts,hook);
   const inertia=C();for(const p of hookParts){const h=p.half,o=p.offset;inertia.x+=p.mass*((h.y*h.y+h.z*h.z)/3+o.y*o.y+o.z*o.z);inertia.y+=p.mass*((h.x*h.x+h.z*h.z)/3+o.x*o.x+o.z*o.z);inertia.z+=p.mass*((h.x*h.x+h.y*h.y)/3+o.x*o.x+o.y*o.y);}hook.inertia.copy(inertia);hook.invInertia.set(1/inertia.x,1/inertia.y,1/inertia.z);hook.updateInertiaWorld(true);
   hinge=new HingeConstraint(anchor,hook,{pivotA:C(),pivotB:COMOffset.negate(),axisA:C(0,0,1),axisB:C(0,0,1),maxForce:1e6,collideConnected:false});hinge.equations=hinge.equations.filter(e=>e!==hinge.motorEquation);for(const e of hinge.equations)e.setSpookParams(1e8,4,DT);owner.world.addConstraint(hinge);constraints.push(hinge);
   spring=new Spring(anchor,hook,{worldAnchorA:pivot.vadd(C(-.25,-.025,0)),localAnchorB:C(.35,0,0).vsub(COMOffset),restLength:.1,stiffness:40,damping:.04});
   subsystem={update:()=>cell.updateForces(owner.world.dt)};owner.world.subsystems.push(subsystem);postStep=()=>{cell.syncPose();sample();};owner.world.addEventListener('postStep',postStep);cell.syncPose(true);return true;
  },
  hand(){if(!cell.ensure())return false;const before=hook.inertia.z*hook.angularVelocity.z,arm=.4,impulse=handAngularImpulse/(2*arm);hook.applyImpulse(C(-impulse,0,0),C(0,arm,0));hook.applyImpulse(C(impulse,0,0),C(0,-arm,0));hook.wakeUp();handCount++;lastHand={worldStep:owner.world.stepnumber,angularImpulse:handAngularImpulse,angularMomentumBefore:before,angularMomentumAfter:hook.inertia.z*hook.angularVelocity.z,bearingForce,captureForce,opening:cell.opening,hookAngle:cell.hookAngle,originalFree:freeOriginal()};return true;},
  cutCable(){cableConnected=false;},
  updateForces(dt){if(!Number.isFinite(dt)||!(dt>0)||!cell.ensure())return;const step=owner.world.stepnumber;if(forceStep===step)return;forceStep=step;forceApplications.set(step,(forceApplications.get(step)??0)+1);
   gate.force.x+=-(20+5*gate.position.x)-8*gate.velocity.x;spring.applyForce();hook.torque.z-=.035*hook.angularVelocity.z;tension=stretch=0;interval=null;
   if(cableConnected&&freeOriginal()){const cargo=cell.originalCargoBody,eye=gate.position.vadd(gateEye),near=nearLead.vsub(eye),far=cargo.position.vsub(farLead),a=near.length(),b=far.length();if(a>.01&&b>.01){near.scale(1/a,near);far.scale(1/b,far);stretch=Math.max(0,a+b-4.65);const rate=cargo.velocity.dot(far)-gate.velocity.dot(near);tension=Math.max(0,400*stretch+15*rate);gate.force.vadd(near.scale(tension),gate.force);cargo.force.vsub(far.scale(tension),cargo.force);if(tension>0){cargo.wakeUp();gate.wakeUp();}interval={step,tension,gatePosition:gate.position.clone(),near:near.clone()};}}
  },
  syncPose(reset=false){if(!cell.ensure())return;for(const p of gateParts)syncPart(p,gate,reset);for(const p of hookParts)syncPart(p,hook,reset);for(const p of fixedParts)syncPart(p,fixed,reset);},
  reset(){if(!cell.ensure())return;place(gate,C());place(hook,hookCOM);forceStep=sampleStep=contactStep=-1;bearingForce=bearingContacts=captureForce=captureContacts=seatForce=seatContacts=tension=stretch=handCount=cableWork=0;lastHand=interval=null;cableConnected=true;forceApplications.clear();owner.world.broadphase.dirty=true;cell.syncPose(true);},
  diagnostics(){const bearingCurrent=currentFace('bearing'),captureCurrent=currentFace('capture');return{scope:cell.scope,disposed,worldStep:owner?.world.stepnumber??-1,contactStep,opening:cell.opening,hookAngle:cell.hookAngle,gateVelocity:gate?.velocity.toArray(),hookAngularVelocity:hook?.angularVelocity.toArray(),bearingForce:bearingCurrent?bearingForce:0,bearingContacts:bearingCurrent?bearingContacts:0,rawBearingForce:bearingForce,rawBearingContacts:bearingContacts,bearingGeometryCurrent:bearingCurrent,captureForce:captureCurrent?captureForce:0,captureContacts:captureCurrent?captureContacts:0,rawCaptureForce:captureForce,rawCaptureContacts:captureContacts,captureGeometryCurrent:captureCurrent,seatForce,seatContacts,cableConnected,tension,stretch,cableWork,handCount,lastHand:lastHand?{...lastHand}:null,originalFree:freeOriginal(),originalCargoBodyId:cell.originalCargoBody?.id,originalCargoShapeId:cell.originalCargoShape?.id,bodyIds:bodies.map(b=>b.id),bodyTypes:bodies.map(b=>b.type),bodiesPresent:!!owner&&bodies.every(b=>b.world===owner.world&&owner.world.bodies.includes(b)),constraintIds:constraints.map(c=>c.id),constraintEquationCounts:constraints.map(c=>c.equations.length),motorEquationPresent:constraints.map(c=>c.equations.includes(c.motorEquation)),motorEnabled:constraints.map(c=>c.motorEquation?.enabled===true),ownedPartsValid:!!owner&&[...gateParts.map(p=>[p,gate]),...hookParts.map(p=>[p,hook]),...fixedParts.map(p=>[p,fixed])].every(([p,b])=>owned(p,b)),cargoPosition:cell.originalCargoBody?.position.toArray(),gatePosition:gate?.position.toArray(),hookPosition:hook?.position.toArray(),hookQuaternion:hook?.quaternion.toArray()};},
  stopCallbacks(){if(!owner)return;owner.world.removeEventListener('postStep',postStep);const i=owner.world.subsystems.indexOf(subsystem);if(i>=0)owner.world.subsystems.splice(i,1);},
  dispose(){if(disposed)return;disposed=true;if(!owner)return;cell.stopCallbacks();for(const id of bodyBoxIds)owner.removeBodyBox(id);for(const id of sweepIds)owner.removeCargoSweepBox(id);for(const c of constraints)owner.world.removeConstraint(c);for(const b of bodies)owner.world.removeBody(b);for(const p of [...gateParts,...hookParts,...fixedParts]){p.collider.enabled=false;delete p.collider.orientedBox;}},
 };
 return cell;
}
