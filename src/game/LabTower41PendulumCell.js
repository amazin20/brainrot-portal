import * as THREE from 'three';
import {Body,Box,HingeConstraint,Material,Spring,Vec3} from 'cannon-es';
import {createOrientedBoxContact,syncOrientedBoxContact} from './LabOrientedBoxContact.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),C=(x=0,y=0,z=0)=>new Vec3(x,y,z),DT=1/120;
const angleOf=body=>body?Math.atan2(2*(body.quaternion.w*body.quaternion.z+body.quaternion.x*body.quaternion.y),1-2*(body.quaternion.y**2+body.quaternion.z**2)):0;

/** A gravity-driven drawbridge and a separately hinged physical catch. The
 * bridge mass frame is its actual compound centre of mass, away from the
 * hinge, so Cannon gravity (not an authored pose or velocity) moves the span.
 * A passive over-centre spring keeps the catch in either mechanical seat;
 * the player's only catch input is a finite angular impulse. */
export function buildTower41PendulumCell(game,k,options={}){
 const centre=options.centre??[48,36,37],floorY=options.floorY??centre[1],origin=V(centre[0],floorY,centre[2]),m=k.m;
 if(!Array.isArray(centre)||centre.length!==3||!centre.every(Number.isFinite)||!Number.isFinite(floorY))throw new TypeError('A finite drawbridge placement is required');
 const bridgeParts=[],pawlParts=[],fixedParts=[],bodies=[],constraints=[],hinges=[],cargoSweepIds=[],bodyBoxIds=[];
 const bridgePivot=C(centre[0]-14,floorY-.2,centre[2]),pawlPivot=C(centre[0]-1.7,floorY+.35,centre[2]-1.55);
 const raisedAngle=.42,openPawlAngle=Math.PI/2,handAngularImpulse=options.handAngularImpulse??1.2;
 if(!(handAngularImpulse>0&&handAngularImpulse<=1.2))throw new RangeError('Catch hand impulse must be positive and bounded');
 let owner=null,anchor=null,fixedBody=null,bridgeBody=null,pawlBody=null,pawlSpring=null,disposed=false,onPostStep=null,forceSubsystem=null,lastForceStep=-1,lastSampleStep=-1;
 let contactStep=-1,normalLoad=0,loadCount=0,pawlNormalForce=0,pawlContactCount=0,seatNormalForce=0,seatContactCount=0,loadedStep=-1,firstLoadedStep=-1,loadedTicks=0,loadedNormalImpulse=0,retainedTicks=0,retainedStartStep=-1,readyStep=-1,handCount=0,lastHandStep=-1000,lastLoadedNormalForce=0,loadedWitnessFirst=null,loadedWitnessLast=null,catchWitness=null;
 const material=new Material({friction:.18,restitution:0});
 function part(list,name,offset,size,mat,mass=0){
  const mesh=k.box(origin.clone().add(V(...offset)).toArray(),size,mat,{dynamic:true});mesh.name=name;
  const p={mesh,collider:mesh.userData.collider,authoredOffset:C(...offset),offset:C(...offset),half:C(...size.map(n=>n/2)),mass};list.push(p);return p;
 }
 const deckPart=part(bridgeParts,'41 gravity drawbridge deck',[-8,-.2,0],[12,.4,4],m.rose,4.5);
 part(bridgeParts,'41 genuine drawbridge counterweight',[-17,-.9,0],[2,1.4,3.5],m.copper,13.4);
 part(bridgeParts,'41 counterweight rigid arm',[-15.8,-.2,0],[3.6,.3,.42],m.steel,.6);
 const cupPart=part(bridgeParts,'41 original cargo gravity cup',[-6,.12,1],[2.2,.24,1.8],m.copper,.2),cupShapeIndex=bridgeParts.length-1;
 for(const [off,size]of [
  [[-7.04,.465,1],[.12,.45,1.8]],[[-4.96,.465,1],[.12,.45,1.8]],
  [[-6,.465,.16],[1.96,.45,.12]],[[-6,.465,1.84],[1.96,.45,.12]],
 ])part(bridgeParts,'41 actual cargo cup wall',off,size,m.steel,.1);
 // The catch closes above the span only while cargo has lowered its end.
 // Its right-hand heel bears on the fixed seat when the bridge tries to lift.
 const pawlPart=part(pawlParts,'41 hinged drawbridge retaining catch',[-2.4,.35,-1.55],[1.4,.22,.56],m.mint,.20);
 part(pawlParts,'41 retaining catch seat heel',[-1.32,.35,-1.55],[.50,.24,.56],m.steel,.08);
 part(fixedParts,'41 actual drawbridge lower travel stop',[-3.4,-1.94,0],[1.5,.25,3.6],m.dark);
 part(fixedParts,'41 actual counterweight upper travel stop',[-17,-3.26,0],[2.2,.30,3.7],m.dark);
 part(fixedParts,'41 retaining catch founded heel seat',[-1.24,.13,-1.55],[.50,.20,.64],m.dark);
 part(fixedParts,'41 retaining catch hanging travel stop',[-1.46,-.85,-1.55],[.20,1.30,.64],m.dark);
 for(const z of [-2.25,2.25])part(fixedParts,'41 drawbridge hinge bearing',[-14,-.35,z],[.6,.7,.38],m.ivory);
 part(fixedParts,'41 passive bridge rotary hydraulic damper',[-14,-.35,2.50],[1.2,1.1,.30],m.copper);
 part(fixedParts,'41 fixed retaining catch axle',[-1.7,.35,-2.10],[.22,.22,.30],m.ivory);
 // Real mass-weighted coordinates, with parallel-axis inertia for every
 // visible member. Cannon's uniform compound AABB approximation would put
 // the counterweight at an implausible centre and obscure its gravity torque.
 function compoundFrame(parts){const mass=parts.reduce((s,p)=>s+p.mass,0),position=C();for(const p of parts)position.vadd(p.authoredOffset.scale(p.mass/mass),position);return{mass,position};}
 const bridgeFrame=compoundFrame(bridgeParts),pawlFrame=compoundFrame(pawlParts),bridgeCOMOffset=bridgeFrame.position.vsub(C(-14,-.2,0)),pawlCOMOffset=pawlFrame.position.vsub(C(-1.7,.35,-1.55));
 for(const p of bridgeParts)p.offset=p.authoredOffset.vsub(bridgeFrame.position);for(const p of pawlParts)p.offset=p.authoredOffset.vsub(pawlFrame.position);
 const springMesh=k.box([0,0,0],[.07,1,.07],m.ivory,{solid:false,dynamic:true});springMesh.name='41 passive over-centre catch spring';
 function setMassInertia(body,parts){
  const inertia=C();for(const p of parts){const{x,y,z}=p.offset,h=p.half;inertia.x+=p.mass*((h.y*h.y+h.z*h.z)/3+y*y+z*z);inertia.y+=p.mass*((h.x*h.x+h.z*h.z)/3+x*x+z*z);inertia.z+=p.mass*((h.x*h.x+h.y*h.y)/3+x*x+y*y);}
  body.inertia.copy(inertia);body.invInertia.set(1/inertia.x,1/inertia.y,1/inertia.z);body.updateInertiaWorld(true);
 }
 function addBody(b,name){b.labTower41Cell=name;owner.world.addBody(b);bodies.push(b);return b;}
 function addConstraint(c){c.collideConnected=false;c.equations=c.equations.filter(e=>e!==c.motorEquation);for(const e of c.equations)e.setSpookParams(1e8,4,DT);owner.world.addConstraint(c);constraints.push(c);hinges.push(c);return c;}
 function descriptor(p,b){
  p.collider.orientedBox=createOrientedBoxContact(b,V(p.half.x,p.half.y,p.half.z),V(p.offset.x,p.offset.y,p.offset.z),owner.world.stepnumber);
  owner.registerBodyBox(p.mesh.uuid,{body:b,shapeIndex:b.shapes.length-1,orientedBox:p.collider.orientedBox});bodyBoxIds.push(p.mesh.uuid);
 }
 function syncPart(p,b,reset){const q=b.quaternion,offset=q.vmult(p.offset);p.mesh.position.set(b.position.x+offset.x,b.position.y+offset.y,b.position.z+offset.z);p.mesh.quaternion.set(q.x,q.y,q.z,q.w);p.mesh.updateWorldMatrix(true,false);p.collider.box.setFromObject(p.mesh);syncOrientedBoxContact(p.collider.orientedBox,b,owner.world.stepnumber,reset);}
 function placeAtHinge(b,pivot,COM,a){b.quaternion.setFromAxisAngle(C(0,0,1),a);b.position.copy(pivot.vadd(b.quaternion.vmult(COM)));b.velocity.setZero();b.angularVelocity.setZero();b.force.setZero();b.torque.setZero();b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);b.previousQuaternion.copy(b.quaternion);b.interpolatedQuaternion.copy(b.quaternion);b.aabbNeedsUpdate=true;b.updateInertiaWorld(true);b.wakeUp();}
 function pairCanCollide(a,sa,b,sb){return!disposed&&owner&&a&&b&&sa&&sb&&owner.world.bodies.includes(a)&&owner.world.bodies.includes(b)&&a.collisionResponse!==false&&b.collisionResponse!==false&&sa.collisionResponse!==false&&sb.collisionResponse!==false&&(a.collisionFilterGroup&b.collisionFilterMask)!==0&&(b.collisionFilterGroup&a.collisionFilterMask)!==0&&(sa.collisionFilterGroup&sb.collisionFilterMask)!==0&&(sb.collisionFilterGroup&sa.collisionFilterMask)!==0;}
 function liveCargoIdentity(){return!disposed&&owner&&game.cargo===cell.originalCargo&&owner.cargoBody===cell.originalCargoBody&&cell.originalCargoBody?.type===Body.DYNAMIC&&cell.originalCargoBody.mass>0&&cell.originalCargoBody.shapes[0]===cell.originalCargoShape&&pairCanCollide(cell.originalCargoBody,cell.originalCargoShape,bridgeBody,bridgeBody?.shapes[cupShapeIndex]);}
 function freeCargo(){return liveCargoIdentity()&&!game.heldCube&&!owner.carryTarget;}
 function liveOwned(b,index){
  if(disposed||!owner||!b||!bodies.every(body=>body.world===owner.world&&owner.world.bodies.includes(body))||b.collisionResponse===false||b.shapes[index]?.collisionResponse===false||!constraints.every((c,i)=>owner.world.constraints.includes(c)&&c.bodyA===anchor&&c.bodyB===(i===0?bridgeBody:pawlBody)&&c.equations.length===5&&!c.equations.includes(c.motorEquation)))return false;
  const p=(b===bridgeBody?bridgeParts:b===pawlBody?pawlParts:b===fixedBody?fixedParts:[])[index],entry=p&&owner.bodyBoxes.get(p.mesh.uuid);
  return Boolean(p&&p.collider.enabled!==false&&entry?.body===b&&entry.shapeIndex===index&&entry.shape===b.shapes[index]&&entry.orientedBox===p.collider.orientedBox&&owner.inspectBodyBox(p.mesh.uuid,{orientedBox:p.collider.orientedBox,bounds:p.collider.box,enabled:true}).valid);
 }
 function exactContacts(a,sa,b,sb){return owner?.world.contacts.filter(c=>[c.bi,c.bj].includes(a)&&[c.bi,c.bj].includes(b)&&[c.si,c.sj].includes(sa)&&[c.si,c.sj].includes(sb))??[];}
 function rawCupContacts(){return exactContacts(cell.originalCargoBody,cell.originalCargoShape,bridgeBody,bridgeBody?.shapes[cupShapeIndex]);}
 function cargoCupGeometry(){
  const cargo=cell.originalCargoBody,shape=cell.originalCargoShape;if(!cargo||!bridgeBody||!(shape instanceof Box)||cargo.shapes[0]!==shape)return null;
  const shapePosition=cargo.position.vadd(cargo.quaternion.vmult(cargo.shapeOffsets[0])),shapeRotation=cargo.quaternion.mult(cargo.shapeOrientations[0]);
  const local=bridgeBody.quaternion.conjugate().vmult(shapePosition.vsub(bridgeBody.position)).vadd(bridgeFrame.position),relative=new THREE.Quaternion().copy(bridgeBody.quaternion).invert().multiply(new THREE.Quaternion().copy(shapeRotation)),rotation=new THREE.Matrix4().makeRotationFromQuaternion(relative).elements,h=shape.halfExtents;
  const extent=V(Math.abs(rotation[0])*h.x+Math.abs(rotation[4])*h.y+Math.abs(rotation[8])*h.z,Math.abs(rotation[1])*h.x+Math.abs(rotation[5])*h.y+Math.abs(rotation[9])*h.z,Math.abs(rotation[2])*h.x+Math.abs(rotation[6])*h.y+Math.abs(rotation[10])*h.z);
  return[...local.toArray(),...extent.toArray()].every(Number.isFinite)?{local,extent}:null;
 }
 function currentCupSupport(){
  const geometry=cargoCupGeometry();if(!geometry)return false;const{local,extent}=geometry;
  // A portal correction can re-pose cargo after this step's contact solver.
  // The real original Box must still overlap the finite cup face now, within
  // a bounded 120 Hz landing skin; a retained old multiplier alone is stale.
  return bridgeBody.quaternion.vmult(C(0,1,0)).y>.65&&Math.abs(local.y-extent.y-.24)<=.10&&Math.abs(local.x+6)<=1.1+extent.x&&Math.abs(local.z-1)<=.9+extent.z;
 }
 function cargoClearedCup(){
  const geometry=cargoCupGeometry();if(!geometry)return false;const{local,extent}=geometry;
  // Includes the actual tray and four finite walls. A held flag, a disabled
  // collision response or a one-tick loss of solver contacts is not unloading.
  return Math.abs(local.x+6)>1.1+extent.x+.03||Math.abs(local.z-1)>.9+extent.z+.03||local.y>.69+extent.y+.03||local.y<0-extent.y-.03;
 }
 function sampleContacts(){
  const step=owner.world.stepnumber;if(step===lastSampleStep)return;lastSampleStep=step;contactStep=step;normalLoad=loadCount=pawlNormalForce=pawlContactCount=seatNormalForce=seatContactCount=0;
  if(freeCargo()&&liveOwned(bridgeBody,cupShapeIndex))for(const c of owner.world.contacts){
   if(c.enabled===false||![c.bi,c.bj].includes(cell.originalCargoBody)||![c.bi,c.bj].includes(bridgeBody)||![c.si,c.sj].includes(cell.originalCargoShape)||![c.si,c.sj].includes(bridgeBody.shapes[cupShapeIndex])||!(c.multiplier>1e-6))continue;
   const normalY=(c.bi===cell.originalCargoBody?-1:1)*c.ni.y;if(normalY>.65){normalLoad+=normalY*c.multiplier;loadCount++;}
  }
  if(liveOwned(bridgeBody,0)&&liveOwned(pawlBody,0)&&pairCanCollide(bridgeBody,bridgeBody.shapes[0],pawlBody,pawlBody.shapes[0]))for(const c of owner.world.contacts){
   if(c.enabled===false||![c.bi,c.bj].includes(bridgeBody)||![c.bi,c.bj].includes(pawlBody)||![c.si,c.sj].includes(bridgeBody.shapes[0])||![c.si,c.sj].includes(pawlBody.shapes[0])||!(c.multiplier>1e-6))continue;
   // The retaining arm must exert a downward reaction on the raising deck.
   const normalY=(c.bi===bridgeBody?-1:1)*c.ni.y;if(normalY<-.65){pawlNormalForce+=-normalY*c.multiplier;pawlContactCount++;}
  }
  if(liveOwned(pawlBody,1)&&liveOwned(fixedBody,2)&&pairCanCollide(pawlBody,pawlBody.shapes[1],fixedBody,fixedBody.shapes[2]))for(const c of exactContacts(pawlBody,pawlBody.shapes[1],fixedBody,fixedBody.shapes[2])){if(c.enabled!==false&&c.multiplier>1e-6){const normalY=(c.bi===pawlBody?-1:1)*c.ni.y;if(normalY>.65){seatNormalForce+=normalY*c.multiplier;seatContactCount++;}}}
  if(cell.loadContact){loadedStep=step;if(firstLoadedStep<0)firstLoadedStep=step;loadedTicks++;loadedNormalImpulse+=normalLoad*DT;lastLoadedNormalForce=normalLoad;loadedWitnessLast=Object.freeze({worldStep:step,originalCargoBodyId:cell.originalCargoBody.id,originalCargoShapeId:cell.originalCargoShape.id,cupBodyId:bridgeBody.id,cupShapeId:bridgeBody.shapes[cupShapeIndex].id,normalForce:normalLoad,contactCount:loadCount,freeOriginal:true,bridgeAngle:cell.angle});loadedWitnessFirst??=loadedWitnessLast;}
  if(loadedStep>=0&&catchWitness?.loadedAtStep>=firstLoadedStep&&catchWitness?.qualifiedLoad===true&&liveCargoIdentity()&&!rawCupContacts().length&&cargoClearedCup()&&cell.latched){if(retainedTicks===0)retainedStartStep=step;retainedTicks++;if(retainedTicks===24)readyStep=step;}else{retainedTicks=0;retainedStartStep=readyStep=-1;}
 }
 function initialPoint(p){const q=new THREE.Quaternion().setFromAxisAngle(V(0,0,1),raisedAngle);return V(...p).sub(V(-14,-.2,0)).applyQuaternion(q).add(V(bridgePivot.x,bridgePivot.y,bridgePivot.z));}
 function atPoint(p){if(!bridgeBody)return initialPoint(p);const point=C(...p).vsub(bridgeFrame.position),world=bridgeBody.position.vadd(bridgeBody.quaternion.vmult(point));return V(world.x,world.y,world.z);}
 const cell={
  centre:origin,bridgePivot,pawlPivot,bridgeCOMOffset,pawlCOMOffset,bridgeParts,pawlParts,fixedParts,deckPart,pawlPart,cupPart,cupShapeIndex,deckShapeIndex:0,raisedAngle,handAngularImpulse,
  get owner(){return owner;},get bodies(){return bodies;},get constraints(){return constraints;},get hinges(){return hinges;},get anchor(){return anchor;},get fixedBody(){return fixedBody;},get bridgeBody(){return bridgeBody;},get pawlBody(){return pawlBody;},get pawlSpring(){return pawlSpring;},
  get angle(){return angleOf(bridgeBody);},get pawlAngle(){return angleOf(pawlBody);},get orientedBox(){return deckPart.collider.orientedBox??null;},get surface(){return cell.orientedBox;},
  get initialCupPosition(){return initialPoint([-6,.24,1]);},get initialLoadCargoPosition(){return initialPoint([-6,.63,1]);},get cupPosition(){return atPoint([-6,.24,1]);},get loadCargoPosition(){return atPoint([-6,.63,1]);},get loadPosition(){return cell.cupPosition;},
  get loadedStep(){return loadedStep;},get loadNormalForce(){return cell.loadContact?normalLoad:0;},get loadContact(){return freeCargo()&&liveOwned(bridgeBody,cupShapeIndex)&&contactStep===owner.world.stepnumber&&loadCount>0&&normalLoad>1e-6&&currentCupSupport();},
  get originalCargoRawContact(){return rawCupContacts().length>0;},get originalCargoRawContactCount(){return rawCupContacts().length;},get originalCargoClearedCup(){return cargoClearedCup();},
  get canArmCatch(){return!disposed&&owner&&liveOwned(pawlBody,1)&&(cell.pawlAngle>.9||Math.abs(cell.pawlAngle)<.3)&&owner.world.stepnumber-lastHandStep>=60;},get catchArmed(){return!disposed&&owner&&handCount>0&&contactStep===owner.world.stepnumber&&Math.abs(cell.pawlAngle)<.04&&seatContactCount>0&&seatNormalForce>1e-6&&liveOwned(pawlBody,1)&&liveOwned(fixedBody,2)&&pairCanCollide(pawlBody,pawlBody.shapes[1],fixedBody,fixedBody.shapes[2]);},
  get latched(){return cell.catchArmed&&contactStep===owner.world.stepnumber&&liveOwned(bridgeBody,0)&&liveOwned(pawlBody,0)&&pairCanCollide(bridgeBody,bridgeBody.shapes[0],pawlBody,pawlBody.shapes[0])&&pawlContactCount>0&&pawlNormalForce>1e-6&&Math.abs(cell.angle)<.055&&Math.abs(cell.pawlAngle)<.07&&Math.abs(bridgeBody.angularVelocity.z)<.10;},
  get unloadedRetained(){return liveCargoIdentity()&&loadedStep>=0&&catchWitness?.qualifiedLoad===true&&!cell.originalCargoRawContact&&cell.originalCargoClearedCup&&cell.latched&&retainedTicks>=24;},get readyForCrossing(){return freeCargo()&&cell.unloadedRetained;},
  ensure(){
   if(disposed||!game.physics?.cargoBody)return false;if(owner===game.physics)return true;if(owner)throw new Error('Pendulum cell cannot change physics owner without disposal');owner=game.physics;cell.originalCargo=game.cargo;cell.originalCargoBody=owner.cargoBody;cell.originalCargoShape=owner.cargoBody.shapes[0];
   for(const p of [...bridgeParts,...pawlParts,...fixedParts])owner.removeStaticBox(p.mesh.uuid);
   anchor=addBody(new Body({mass:0,position:origin.clone(),collisionFilterGroup:1,collisionFilterMask:0}),'drawbridge and retaining catch foundation');
   fixedBody=addBody(new Body({mass:0,position:C(origin.x,origin.y,origin.z),material,collisionFilterGroup:1,collisionFilterMask:3}),'drawbridge finite mechanical stops');
   for(const[index,p]of fixedParts.entries()){fixedBody.addShape(new Box(p.half),p.offset);descriptor(p,fixedBody);owner.registerCargoSweepBox(p.mesh.uuid,{body:fixedBody,shapeIndex:index});cargoSweepIds.push(p.mesh.uuid);}
   bridgeBody=addBody(new Body({mass:bridgeFrame.mass,position:C(origin.x+bridgeFrame.position.x,origin.y+bridgeFrame.position.y,origin.z+bridgeFrame.position.z),allowSleep:false,linearDamping:0,angularDamping:0,material,collisionFilterGroup:1,collisionFilterMask:3}),'gravity-driven drawbridge and genuine counterweight');
   for(const p of bridgeParts){bridgeBody.addShape(new Box(p.half),p.offset);descriptor(p,bridgeBody);}setMassInertia(bridgeBody,bridgeParts);
   addConstraint(new HingeConstraint(anchor,bridgeBody,{pivotA:bridgePivot.vsub(anchor.position),pivotB:bridgeCOMOffset.negate(),axisA:C(0,0,1),axisB:C(0,0,1),maxForce:1e6,collideConnected:false}));
   pawlBody=addBody(new Body({mass:pawlFrame.mass,position:C(origin.x+pawlFrame.position.x,origin.y+pawlFrame.position.y,origin.z+pawlFrame.position.z),allowSleep:false,linearDamping:0,angularDamping:0,material,collisionFilterGroup:1,collisionFilterMask:3}),'independently hinged retaining catch');
   for(const p of pawlParts){pawlBody.addShape(new Box(p.half),p.offset);descriptor(p,pawlBody);}setMassInertia(pawlBody,pawlParts);
   addConstraint(new HingeConstraint(anchor,pawlBody,{pivotA:pawlPivot.vsub(anchor.position),pivotB:pawlCOMOffset.negate(),axisA:C(0,0,1),axisB:C(0,0,1),maxForce:1e6,collideConnected:false}));
   pawlSpring=new Spring(anchor,pawlBody,{worldAnchorA:C(pawlPivot.x-.32,pawlPivot.y-.32,pawlPivot.z),localAnchorB:C(.40,0,0).vsub(pawlCOMOffset),restLength:.20,stiffness:40,damping:1.5});
   placeAtHinge(bridgeBody,bridgePivot,bridgeCOMOffset,raisedAngle);placeAtHinge(pawlBody,pawlPivot,pawlCOMOffset,openPawlAngle);
   // A rendered frame can execute several 120 Hz steps. Cannon updates its
   // subsystems before collision detection and constraint solving (its
   // preStep event is later). This owned subsystem and the frame hook share
   // one cache, so each actual interval receives one passive force application.
   forceSubsystem={update:()=>cell.updateForces(owner.world.dt)};owner.world.subsystems.push(forceSubsystem);
   onPostStep=()=>{cell.syncPose();sampleContacts();cupPart.mesh.material=cell.loadContact?m.live:m.copper;};owner.world.addEventListener('postStep',onPostStep);cell.syncPose(true);return true;
  },
  armCatch(){
   if(!cell.ensure()||!cell.canArmCatch)return false;
   const closing=cell.pawlAngle>.9,direction=closing?-1:1,qualifiedLoad=closing&&cell.loadContact&&cell.angle<-.08,angularMomentumBefore=pawlBody.inertia.z*pawlBody.angularVelocity.z;
   const arm=.4,impulse=-direction*handAngularImpulse/(2*arm);pawlBody.applyImpulse(C(impulse,0,0),C(0,arm,0));pawlBody.applyImpulse(C(-impulse,0,0),C(0,-arm,0));pawlBody.wakeUp();handCount++;lastHandStep=owner.world.stepnumber;
   catchWitness=Object.freeze({worldStep:lastHandStep,handCount,action:closing?'close':'release',qualifiedLoad,loadContact:cell.loadContact,loadedStep,loadedAtStep:qualifiedLoad?loadedStep:-1,loadNormalForce:qualifiedLoad?normalLoad:0,originalCargoBodyId:cell.originalCargoBody.id,originalCargoShapeId:cell.originalCargoShape.id,cupBodyId:bridgeBody.id,cupShapeId:bridgeBody.shapes[cupShapeIndex].id,pawlBodyId:pawlBody.id,angularImpulse:direction*handAngularImpulse,angularMomentumBefore,angularMomentumAfter:pawlBody.inertia.z*pawlBody.angularVelocity.z,bridgeAngle:cell.angle});return true;
  },
  updateForces(dt){
   if(!Number.isFinite(dt)||!(dt>0)||!cell.ensure())return;const step=owner.world.stepnumber;if(lastForceStep===step)return;lastForceStep=step;pawlSpring.applyForce();
   // Bearing friction is strictly dissipative; the bridge's only positive
   // work is actual gravity on its eccentric mass and the free original load.
   bridgeBody.torque.z-=600*bridgeBody.angularVelocity.z;pawlBody.torque.z-=.10*pawlBody.angularVelocity.z;
   if(cell.loadContact)cell.originalCargoBody.wakeUp();
  },
  syncPose(reset=false){if(!cell.ensure())return;for(const p of bridgeParts)syncPart(p,bridgeBody,reset);for(const p of pawlParts)syncPart(p,pawlBody,reset);for(const p of fixedParts)syncPart(p,fixedBody,reset);const a=C(),b=C();pawlSpring.getWorldAnchorA(a);pawlSpring.getWorldAnchorB(b);const delta=V(b.x-a.x,b.y-a.y,b.z-a.z);springMesh.position.set(a.x,a.y,a.z);springMesh.scale.set(1,delta.length(),1);springMesh.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());cupPart.mesh.material=cell.loadContact?m.live:m.copper;},
  reset(){if(!cell.ensure())return;placeAtHinge(bridgeBody,bridgePivot,bridgeCOMOffset,raisedAngle);placeAtHinge(pawlBody,pawlPivot,pawlCOMOffset,openPawlAngle);contactStep=lastForceStep=lastSampleStep=loadedStep=firstLoadedStep=retainedStartStep=readyStep=-1;normalLoad=loadCount=pawlNormalForce=pawlContactCount=seatNormalForce=seatContactCount=loadedTicks=loadedNormalImpulse=retainedTicks=handCount=lastLoadedNormalForce=0;loadedWitnessFirst=loadedWitnessLast=catchWitness=null;lastHandStep=-1000;owner.world.broadphase.dirty=true;cell.syncPose(true);},
  diagnostics(){
   if(!cell.ensure())return{ready:false,disposed};const a=C(),b=C();pawlSpring.getWorldAnchorA(a);pawlSpring.getWorldAnchorB(b);const springLength=a.distanceTo(b),gravity=-owner.world.gravity.y;
   const kinetic=[bridgeBody,pawlBody].reduce((s,body)=>s+.5*body.mass*body.velocity.lengthSquared()+.5*body.inertia.z*body.angularVelocity.z**2,0),gravityPotential=[bridgeBody,pawlBody].reduce((s,body)=>s+body.mass*gravity*(body.position.y-floorY),0),springPotential=.5*pawlSpring.stiffness*(springLength-pawlSpring.restLength)**2;
   return{ready:true,disposed,worldStep:owner.world.stepnumber,angle:cell.angle,pawlAngle:cell.pawlAngle,latched:cell.latched,catchArmed:cell.catchArmed,canArmCatch:cell.canArmCatch,loadContact:cell.loadContact,firstLoadedStep,loadedStep,loadedTicks,loadedNormalImpulse,lastLoadedNormalForce,loadedWitness:{first:loadedWitnessFirst?{...loadedWitnessFirst}:null,last:loadedWitnessLast?{...loadedWitnessLast}:null},loadedWitnessFirst:loadedWitnessFirst?{...loadedWitnessFirst}:null,loadedWitnessLast:loadedWitnessLast?{...loadedWitnessLast}:null,catchWitness:catchWitness?{...catchWitness}:null,lastHandStep,loadNormalForce:cell.loadNormalForce,loadContactCount:loadCount,contactStep,pawlNormalForce,pawlContactCount,seatNormalForce,seatContactCount,originalCargoRawContact:cell.originalCargoRawContact,originalCargoRawContactCount:cell.originalCargoRawContactCount,originalCargoClearedCup:cell.originalCargoClearedCup,retainedTicks,retainedStartStep,unloadedRetainedSince:retainedStartStep,firstRetainedStep:retainedStartStep,readyStep,unloadedRetained:cell.unloadedRetained,readyForCrossing:cell.readyForCrossing,handCount,handAngularImpulse,kinetic,gravityPotential,potential:gravityPotential+springPotential,springPotential,springLength,cupPosition:cell.cupPosition.toArray(),loadCargoPosition:cell.loadCargoPosition.toArray(),bodyIds:bodies.map(b=>b.id),bodiesPresent:bodies.every(b=>owner.world.bodies.includes(b)),constraintIds:constraints.map(c=>c.id),constraintsPresent:constraints.every(c=>owner.world.constraints.includes(c)),constraintEquationCounts:constraints.map(c=>c.equations.length),constraintMotorEnabled:constraints.map(c=>c.motorEquation?.enabled===true),constraintMotorEquationPresent:constraints.map(c=>c.equations.includes(c.motorEquation)),originalCargoBodyId:cell.originalCargoBody.id,originalCargoShapeId:cell.originalCargoShape.id,originalCargoPresent:owner.world.bodies.includes(cell.originalCargoBody),originalCargoIdentityValid:liveCargoIdentity(),originalCargoFree:freeCargo(),currentCollisionValid:liveCargoIdentity()&&pairCanCollide(bridgeBody,bridgeBody.shapes[0],pawlBody,pawlBody.shapes[0])&&pairCanCollide(pawlBody,pawlBody.shapes[1],fixedBody,fixedBody.shapes[2]),bridge:{id:bridgeBody.id,type:bridgeBody.type,mass:bridgeBody.mass,position:bridgeBody.position.toArray(),quaternion:bridgeBody.quaternion.toArray(),velocity:bridgeBody.velocity.toArray(),angularVelocity:bridgeBody.angularVelocity.toArray(),inertia:bridgeBody.inertia.toArray(),COMOffset:bridgeCOMOffset.toArray(),shapeIds:bridgeBody.shapes.map(s=>s.id)},pawl:{id:pawlBody.id,type:pawlBody.type,mass:pawlBody.mass,position:pawlBody.position.toArray(),quaternion:pawlBody.quaternion.toArray(),velocity:pawlBody.velocity.toArray(),angularVelocity:pawlBody.angularVelocity.toArray(),inertia:pawlBody.inertia.toArray(),shapeIds:pawlBody.shapes.map(s=>s.id)},cupBodyId:bridgeBody.id,cupShapeId:bridgeBody.shapes[cupShapeIndex].id,deckShapeId:bridgeBody.shapes[0].id,pawlShapeId:pawlBody.shapes[0].id,pawlHeelShapeId:pawlBody.shapes[1].id,seatBodyId:fixedBody.id,seatShapeId:fixedBody.shapes[2].id};
  },
  dispose(){if(disposed)return;disposed=true;if(owner){if(onPostStep)owner.world.removeEventListener('postStep',onPostStep);const subsystemIndex=owner.world.subsystems.indexOf(forceSubsystem);if(subsystemIndex>=0)owner.world.subsystems.splice(subsystemIndex,1);for(const id of bodyBoxIds)owner.removeBodyBox(id);bodyBoxIds.length=0;for(const id of cargoSweepIds)owner.removeCargoSweepBox(id);cargoSweepIds.length=0;for(const c of constraints)owner.world.removeConstraint(c);for(const b of bodies)owner.world.removeBody(b);for(const p of [...bridgeParts,...pawlParts,...fixedParts]){p.collider.enabled=false;delete p.collider.orientedBox;}}},
 };
 return cell;
}
