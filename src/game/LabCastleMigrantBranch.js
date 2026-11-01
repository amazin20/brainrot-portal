import * as THREE from 'three';
import {Body,Box,LockConstraint,Material,Vec3} from 'cannon-es';
import {createOrientedBoxContact,syncOrientedBoxContact} from './LabOrientedBoxContact.js';
import {solveCastlePortalRecoil} from './LabCastlePortalRecoil.js';

const V=(...v)=>new THREE.Vector3(...v),C=(...v)=>new Vec3(...v);
export const CASTLE_MIGRANT=Object.freeze({near:-5.5,far:11,mass:12,deckY:3,bodyY:2.8,
 brakeN:4,dropY:11.5,cargoX:-15.9,cargoZ:12,mouthZ:-7});

/** The one original freight body recoils a finite-mass portal carrier. There
 * is no dispatch target/motor. A fixed, deep pair of real aiming baffles hides
 * the parked passenger address; translation exposes it through the diagonal
 * sight channel. The cargo channel is too low for an upright traveller. */
export function buildCastleMigrantBranch({game,k,room,standing,complete,plate,sign}){
 const r=room,{P}=r,m=k.m,cfg=CASTLE_MIGRANT,origin=V(...r.def.at),movingParts=[],fixedParts=[],ids=[],bodies=[],sweeps=[];
 let owner=null,carrier=null,anchor=null,fixed=null,guide=null,subsystem=null,post=null,disposed=false,
  forceStep=-1,brakeWork=0,lastBrake=null,resetTransportCount=0,lastObservedCount=-1,firstRecoil=null,lastRecoil=null;
 const token=Object.freeze({cell:'castle-migrant-recoil'});
 const floor=(name,x0,x1,z0,z1,y,mat=m.floor,options={})=>{const mesh=k.floor(origin.x+x0,origin.x+x1,origin.z+z0,origin.z+z1,origin.y+y,mat,options);mesh.name=name;return mesh;};
 const box=(name,x,z,y,w,h,d,mat=m.wall)=>{const mesh=k.box(P(x,z,y),[w,h,d],mat);mesh.name=name;return mesh;};
 floor('Migrant founded near bank inner strip',-14.9,-11.2,-23,23,0);
 floor('Migrant founded near bank outer strip',-17,-16.9,-23,23,0);
 floor('Migrant founded near bank north return',-16.9,-14.9,-23,-22,0);
 const nearBank=floor('Migrant founded near cargo bank',-16.9,-14.9,-12,23,0);
 floor('Migrant founded far receiving bank',7,17,-23,23,3,m.ivory);
 floor('Migrant lower dry recovery floor',-16.9,7,-23,23,-4,m.dark);
 k.stairs(P(-15.9,-22,-4),P(-15.9,-12,0),1.8,m.floor);
 // Full-height baffles have no walkable sill across the void. The two small
 // windows form a long diagonal sight channel aimed at the FAR address.
 for(const [x,sightZ,cameraZ,cameraY]of [[-11,16.5,-6,5.56],[-9,15,-6.36,5]]){
  // The camera and the actual muzzle have different real paths. Separate
  // 640mm charge/view ports expose the freight face to the raised shoulder
  // camera; neither the 780mm box nor the 860mm capsule fits those ports.
  const openings=[[-7.9,-6.1,2,4.2],[cameraZ-.32,cameraZ+.32,cameraY-.32,cameraY+.32],
    [sightZ-.6,sightZ+.6,1,3]],cuts=[...new Set([-23,23,...openings.flatMap(a=>a.slice(0,2))])].sort((a,b)=>a-b),pieces=[];
  for(let i=1;i<cuts.length;i++){
   const a=cuts[i-1],b=cuts[i],middle=(a+b)/2,holes=openings.filter(h=>middle>h[0]&&middle<h[1]).map(h=>[h[2],h[3]]).sort((a,b)=>a[0]-b[0]);let y=0;
   for(const [low,high]of [...holes,[15,15]]){
    if(low>y){const previous=pieces.find(p=>p[1]===a&&p[2]===y&&p[3]===low);if(previous)previous[1]=b;else pieces.push([a,b,y,low]);}
    y=Math.max(y,high);
   }
  }
  for(const [a,b,low,high]of pieces)box('Migrant load-bearing finite-channel baffle',x,(a+b)/2,(low+high)/2,.3,high-low,b-a);
 }
 // A real high tongue releases the original box over the small floor mouth.
 // Its X coordinate is outside BOTH stair flights, leaving a clear fall.
 k.stairs(P(-14.2,18),P(-14.2,-18,5.75),1.8,m.floor);
 floor('Migrant stair exchange',-15.1,-11.3,-19.1,-16.9,5.75);
 k.stairs(P(-12.2,-18,5.75),P(-12.2,18,cfg.dropY),1.8,m.ivory);
 floor('Migrant high release balcony',-16.7,-11.3,17,21,cfg.dropY,m.ivory);
 floor('Migrant open-ended freight release tongue',-16.7,-15.1,12.65,18,cfg.dropY,m.copper);
 for(const x of [-16.8,-15])box('Migrant release tongue side rail',x,15.2,cfg.dropY+.58,.16,1.16,4.8,m.steel);
 const cargoIntake=k.panel('migrant fixed gravity freight input',P(cfg.cargoX,cfg.cargoZ,.035),[0,1,0],2,2);
 cargoIntake.mesh.userData.portalSize={width:.65,height:.7};cargoIntake.mesh.userData.portalBackingIds=[nearBank.uuid];
 const intake=k.panel('migrant fixed passenger return',P(-16.1,18.9,2.4),[1,0,0]);
 // A founded open-front catcher receives the same body after the recoil.
 box('Migrant dry cargo catcher back',-16.45,-7,1.25,.25,2.5,3.1,m.copper);
 // Stop the cheeks before the near baffle, leaving a founded 1.35m service
 // approach around their open ends. The original box rests by the back wall.
 for(const z of [-8.55,-5.45])box('Migrant dry cargo catcher side',-14.475,z,.9,3.95,1.8,.16,m.steel);

 const platform=floor('Migrant actual finite-mass carrier deck',cfg.near-3,cfg.near+3,-4,4,3,m.ivory,{dynamic:true});
 platform.userData.castleMigrantCarrier=true;
 const moving=k.panel('migrant passenger address on recoil carrier',P(cfg.near,0,5.4),[-1,0,0],4.8,4.8,{moving:true});
 const freightMouth=k.panel('migrant small freight recoil mouth',P(cfg.near,cfg.mouthZ,4),[-1,0,0],2.4,1.4,{moving:true});
 freightMouth.mesh.userData.portalSize={width:.8,height:.6};
 const addMoving=(mesh,name)=>{
  mesh.name=name;mesh.updateWorldMatrix(true,false);const bounds=new THREE.Box3().setFromObject(mesh);
  const half=bounds.getSize(V()).multiplyScalar(.5),at=bounds.getCenter(V());
  const p={mesh,collider:mesh.userData.collider,half:C(half.x,half.y,half.z),
   offset:C(at.x-origin.x-cfg.near,at.y-origin.y-cfg.bodyY,at.z-origin.z),baseQuaternion:mesh.quaternion.clone()};movingParts.push(p);return p;
 };
 const deckPart=addMoving(platform,'Migrant actual 12 kg carrier walking deck');
 const passengerPart=addMoving(moving.mesh,'Migrant actual carrier passenger ceramic');
 const freightPart=addMoving(freightMouth.mesh,'Migrant actual carrier recoil ceramic');
 for(const [name,p,size]of [
  ['Migrant rigid freight outrigger',[cfg.near+.3,-3.5,3.3],[.24,.24,7]],
  ['Migrant freight mouth riser',[cfg.near+.3,-7,3.65],[.24,.7,.24]],
 ])addMoving(k.box(P(...p),size,m.steel,{dynamic:true}),name);
 const rail=k.decor(P(0,0,10),[30,.4,.5],m.copper);rail.name='Migrant overhead captive guide';
 const addFixed=(name,x,z,y,size)=>{
  const mesh=k.box(P(x,z,y),size,m.steel,{dynamic:true}),p={mesh,collider:mesh.userData.collider,
   half:C(...size.map(v=>v/2)),offset:C(x,y,z)};mesh.name=name;fixedParts.push(p);return p;
 };
 for(const z of [-3.3,3.3]){
  addFixed('Migrant actual near guide end stop',cfg.near-3.2,z,cfg.bodyY,[.4,.8,.8]);
  addFixed('Migrant actual far guide end stop',cfg.far+3.2,z,cfg.bodyY,[.4,.8,.8]);
 }
 const material=new Material({friction:.15,restitution:0});
 function add(body,name){body.labCastleMigrant=name;owner.world.addBody(body);bodies.push(body);return body;}
 function register(p,b,index){p.collider.orientedBox=createOrientedBoxContact(b,V(p.half.x,p.half.y,p.half.z),V(p.offset.x,p.offset.y,p.offset.z),owner.world.stepnumber);p.collider.kinematic=false;owner.registerBodyBox(p.mesh.uuid,{body:b,shapeIndex:index,orientedBox:p.collider.orientedBox});ids.push(p.mesh.uuid);}
 function sync(p,b,reset,dt){
  const offset=b.quaternion.vmult(p.offset),at=[b.position.x+offset.x,b.position.y+offset.y,b.position.z+offset.z];
  if(p.mesh===moving.mesh)moving.move(V(...at).addScaledVector(moving.normal,.12).toArray(),dt);
  else if(p.mesh===freightMouth.mesh)freightMouth.move(V(...at).addScaledVector(freightMouth.normal,.12).toArray(),dt);
  else k.move(p.mesh,at,dt);
  p.mesh.quaternion.copy(b.quaternion).multiply(p.baseQuaternion??new THREE.Quaternion());p.mesh.updateWorldMatrix(true,false);
  p.collider.box.setFromObject(p.mesh);syncOrientedBoxContact(p.collider.orientedBox,b,owner.world.stepnumber,reset);
 }
 function live(){return Boolean(!disposed&&owner&&carrier&&carrier.type===Body.DYNAMIC&&carrier.mass===cfg.mass
  &&bodies.every(b=>b.world===owner.world&&owner.world.bodies.includes(b))&&owner.world.constraints.includes(guide)
  &&guide.bodyA===anchor&&guide.bodyB===carrier&&carrier.fixedRotation===true
  &&guide.equations.length===5&&!guide.equations.includes(guide.equationX)&&guide.equations.every(eq=>eq.enabled!==false&&eq.bi===anchor&&eq.bj===carrier)
  &&movingParts.every((p,i)=>owner.bodyBoxes.get(p.mesh.uuid)?.body===carrier&&owner.bodyBoxes.get(p.mesh.uuid)?.shape===carrier.shapes[i]
   &&owner.inspectBodyBox(p.mesh.uuid,{orientedBox:p.collider.orientedBox,bounds:p.collider.box,enabled:p.collider.enabled}).valid)
  &&fixedParts.every((p,i)=>owner.bodyBoxes.get(p.mesh.uuid)?.body===fixed&&owner.bodyBoxes.get(p.mesh.uuid)?.shape===fixed.shapes[i]
   &&owner.inspectBodyBox(p.mesh.uuid,{orientedBox:p.collider.orientedBox,bounds:p.collider.box,enabled:p.collider.enabled}).valid));}
 function original(){return Boolean(owner&&game.cargo===branch.originalCargo&&owner.cargoBody===branch.originalCargoBody
  &&owner.cargoBody.shapes[0]===branch.originalCargoShape&&owner.cargoBody.world===owner.world&&!game.heldCube&&!owner.carryTarget);}
 const snapshot=b=>({position:b.position.clone(),quaternion:b.quaternion.clone(),velocity:b.velocity.clone(),mass:b.mass});
 const receiver=P(12,10,3);plate(receiver,2.9,m.mint);
 sign('ПАДЕНИЕ ДРУГА ОТДАЁТ ИМПУЛЬС КАРЕТКЕ\nПУСТЫЕ ПОРТАЛЫ НЕ ДВИГАЮТ ДВЕРЬ',P(-16.7,5,6.2),9,[1,0,0],2);
 sign('ДАЛЬНИЙ АДРЕС ВИДЕН ЧЕРЕЗ ДВА ОКНА\nВЕРНИ ДРУГА И ПЕРЕНАСТРОЙ ТУ ЖЕ ПАРУ',P(-11.18,18.7,7.6),7,[-1,0,0],2);
 const branch={moving,intake,cargoIntake,freightMouth,platform,deckPart,passengerPart,freightPart,movingParts,fixedParts,receiver,
  get owner(){return owner;},get carrierBody(){return carrier;},get fixedBody(){return fixed;},get guide(){return guide;},
  get travel(){return carrier?THREE.MathUtils.clamp((carrier.position.x-origin.x-cfg.near)/(cfg.far-cfg.near),0,1):0;},
  ensure(){if(disposed||!game.physics?.cargoBody)return false;if(owner===game.physics)return true;if(owner)throw Error('Migrant cannot change its physics owner');
   owner=game.physics;branch.originalCargo=game.cargo;branch.originalCargoBody=owner.cargoBody;branch.originalCargoShape=owner.cargoBody.shapes[0];
   for(const p of [...movingParts,...fixedParts])owner.removeStaticBox(p.mesh.uuid);
   anchor=add(new Body({mass:0,position:C(origin.x,origin.y+cfg.bodyY,origin.z),collisionFilterGroup:1,collisionFilterMask:0}),'grounded rail foundation');
   fixed=add(new Body({mass:0,position:C(...r.def.at),material,collisionFilterGroup:1,collisionFilterMask:3}),'finite physical rail end stops');
   for(const[i,p]of fixedParts.entries()){fixed.addShape(new Box(p.half),p.offset);register(p,fixed,i);owner.registerCargoSweepBox(p.mesh.uuid,{body:fixed,shapeIndex:i});sweeps.push(p.mesh.uuid);}
   carrier=add(new Body({mass:cfg.mass,position:C(origin.x+cfg.near,origin.y+cfg.bodyY,origin.z),allowSleep:false,fixedRotation:true,
    linearDamping:0,angularDamping:0,material,collisionFilterGroup:1,collisionFilterMask:3}),'finite-mass freely translating carrier');
   for(const[i,p]of movingParts.entries()){carrier.addShape(new Box(p.half),p.offset);register(p,carrier,i);}
   guide=new LockConstraint(anchor,carrier,{maxForce:1e6});guide.equations=guide.equations.filter(eq=>eq!==guide.equationX);owner.world.addConstraint(guide);
   subsystem={update:()=>branch.updateForces(owner.world.dt)};owner.world.subsystems.push(subsystem);
   post=()=>branch.syncPose(false,owner.world.dt);owner.world.addEventListener('postStep',post);branch.reset();return true;
  },
  // PURE: no force, impulse, pose edit, witness write, ensure, or progression.
  prepareCargoPortalVelocityTransfer({body,travel,entryFrame,exitFrame,entrySurfaceId,exitSurfaceId}){
   if(entrySurfaceId!==cargoIntake.mesh.uuid||exitSurfaceId!==freightMouth.mesh.uuid||!live()||!original()||body!==branch.originalCargoBody)return null;
   if(entryFrame.normal.y<.999||exitFrame.normal.x>-.999)throw new TypeError('Migrant freight mouth frames changed');
   const result=solveCastlePortalRecoil({cargoMass:body.mass,carrierMass:carrier.mass,incomingVelocity:body.velocity,
    carrierVelocity:carrier.velocity,transportRotation:travel.rotation,railAxis:C(1,0,0),exitNormal:exitFrame.normal});
   const before=snapshot(body),reaction=snapshot(carrier),point=travel.crossingPoint.clone().sub(entryFrame.position).applyQuaternion(travel.rotation).add(exitFrame.position),
    relativePoint=C(point.x-carrier.position.x,point.y-carrier.position.y,point.z-carrier.position.z),
    guideAngularImpulse=relativePoint.cross(result.carrierImpulse).negate(),ledger=Object.freeze({
    cargoMass:result.cargoMass,carrierMass:result.carrierMass,kineticBefore:result.kineticBefore,kineticAfter:result.kineticAfter,
    incomingVelocity:result.incomingVelocity.toArray(),outgoingVelocity:result.outgoingVelocity.toArray(),
    carrierVelocityBefore:result.carrierVelocityBefore.toArray(),carrierVelocityAfter:result.carrierVelocityAfter.toArray(),
    carrierImpulse:result.carrierImpulse.toArray(),fixedEntryImpulse:result.fixedEntryImpulse.toArray(),exitGuideImpulse:result.exitGuideImpulse.toArray(),
    carrierImpulsePoint:point.toArray(),carrierImpulseRelativePoint:relativePoint.toArray(),guideAngularSupportImpulse:guideAngularImpulse.toArray(),
    guideAngularSupportWork:0,guideRotationLocked:true,
    dynamicMomentumBefore:result.dynamicMomentumBefore.toArray(),dynamicMomentumAfter:result.dynamicMomentumAfter.toArray(),
    momentumResidual:result.momentumResidual.toArray(),fixedEntrySupportVelocity:[0,0,0],fixedEntrySupportWork:0,
    crossingPoint:travel.crossingPoint.toArray(),entrySurfaceId,exitSurfaceId,originalCargoBodyId:body.id,originalCargoShapeId:body.shapes[0].id,
    carrierBodyId:carrier.id,worldStep:owner.world.stepnumber,carrierPositionBefore:carrier.position.toArray()});
   return{sourceBody:body,sourceShape:body.shapes[0],sourceMass:body.mass,sourcePosition:before.position,
    sourceQuaternion:before.quaternion,sourceVelocity:before.velocity,world:owner.world,worldStep:owner.world.stepnumber,
    portalTransports:owner.portalTransports,entrySurfaceId,exitSurfaceId,velocity:result.outgoingVelocity,
    reaction:{body:carrier,...reaction,impulse:result.carrierImpulse,point},cellToken:token,ledger};
  },
  updateForces(dt){if(!(dt>0)||!branch.ensure()||forceStep===owner.world.stepnumber)return;forceStep=owner.world.stepnumber;
   // Finite Coulomb brake on the captive guide. It can only remove kinetic
   // energy; it supplies no spring, target force, dispatch or static motor.
   const v=carrier.velocity.x,force=-Math.sign(v)*Math.min(cfg.brakeN,carrier.mass*Math.abs(v)/dt);
   carrier.force.x+=force;brakeWork+=force*v*dt;lastBrake={worldStep:forceStep,force,velocity:v,power:force*v,dt};
  },
  syncPose(reset=false,dt=0){if(!branch.ensure())return;for(const p of movingParts)sync(p,carrier,reset,dt);for(const p of fixedParts)sync(p,fixed,reset,0);
   const record=owner.lastPortalVelocityTransfer;if(record?.plan.cellToken===token&&record.portalTransports>resetTransportCount&&record.portalTransports!==lastObservedCount){
    lastObservedCount=record.portalTransports;lastRecoil=Object.freeze({...record.plan.ledger,committed:true,portalTransports:record.portalTransports});firstRecoil??=lastRecoil;}
  },
  update(dt){branch.syncPose(false,dt);if(!carrier)return;
   if(branch.travel>.98&&Math.abs(carrier.velocity.x)<.2&&standing(receiver,1.3)&&game.cargo===branch.originalCargo
    &&owner.cargoBody===branch.originalCargoBody&&game.cargo.position.distanceTo(V(...receiver).add(V(0,.57,0)))<3)
    complete('migrant',{travel:branch.travel,physicalCarrier:true,carrierBodyId:carrier.id,carrierMass:carrier.mass,
     originalCargoBodyId:branch.originalCargoBody.id,firstRecoil,lastRecoil,brakeWork,carrierPosition:carrier.position.toArray()});
  },
  reset(){if(!branch.ensure())return;const at=C(origin.x+cfg.near,origin.y+cfg.bodyY,origin.z);carrier.position.copy(at);carrier.previousPosition.copy(at);carrier.interpolatedPosition.copy(at);
   carrier.quaternion.set(0,0,0,1);carrier.previousQuaternion.copy(carrier.quaternion);carrier.interpolatedQuaternion.copy(carrier.quaternion);
   carrier.velocity.setZero();carrier.angularVelocity.setZero();carrier.force.setZero();carrier.torque.setZero();carrier.aabbNeedsUpdate=true;carrier.wakeUp();
   forceStep=-1;brakeWork=0;lastBrake=firstRecoil=lastRecoil=null;resetTransportCount=owner.portalTransports;lastObservedCount=-1;branch.syncPose(true,0);owner.world.broadphase.dirty=true;
  },
  diagnostics(){return{ready:live(),disposed,travel:branch.travel,carrierBodyId:carrier?.id,carrierMass:carrier?.mass,
   carrierPosition:carrier?.position.toArray(),carrierVelocity:carrier?.velocity.toArray(),guideEquationCount:guide?.equations.length,
   guideFreeX:Boolean(guide&&!guide.equations.includes(guide.equationX)),brakeWork,lastBrake,firstRecoil,lastRecoil,
   originalCargoBodyId:branch.originalCargoBody?.id,registeredMovingParts:movingParts.map(p=>p.mesh.uuid),bodyIds:bodies.map(b=>b.id)};},
  dispose(){if(disposed)return;disposed=true;if(!owner)return;owner.world.removeEventListener('postStep',post);const i=owner.world.subsystems.indexOf(subsystem);if(i>=0)owner.world.subsystems.splice(i,1);
   for(const id of ids)owner.removeBodyBox(id);for(const id of sweeps)owner.removeCargoSweepBox(id);owner.world.removeConstraint(guide);for(const body of bodies)owner.world.removeBody(body);
   for(const p of [...movingParts,...fixedParts]){p.collider.enabled=false;delete p.collider.orientedBox;}}
 };return branch;
}
