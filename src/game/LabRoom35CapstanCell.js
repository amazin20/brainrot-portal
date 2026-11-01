import {World,Body,Box,Cylinder,Quaternion,Vec3,HingeConstraint,Material,ContactMaterial} from 'cannon-es';
import {createRoom35CapstanGuide,traceRoom35Capstan,projectRoom35Capstan,dampRoom35CapstanTensions,ropeVector as V} from './LabRoom35CapstanGeometry.js';

const C=a=>new Vec3(...a),xyz=v=>[v.x,v.y,v.z],G=19.5;
const distance=(a,b)=>V.length(V.sub(a,b));

/** Small assetless mechanics cell only. This is not a shipped chamber or a
 * full-game route. The game avatar is mass0; an optional separate dynamic
 * contact body is explicitly a test surrogate, never a claimed player load. */
export function createRoom35CapstanCell({world:existingWorld=null,cargoBody:existingCargo=null,dt=1/120,theta=4.8,manualPower=240,manualForce=405,stiffness=3000,mu=.4,ropeViscosity=2*Math.sqrt(stiffness*3.2)}={}){
 if(existingWorld&&!existingCargo)throw new Error('An existing game world requires its original cargo body');
 const world=existingWorld??new World({gravity:new Vec3(0,-G,0),allowSleep:true}),ownedBodies=new Set();
 if(!existingWorld){world.solver.iterations=18;world.solver.tolerance=1e-8;Object.assign(world.defaultContactMaterial,{friction:.64,restitution:.08,contactEquationStiffness:1e8,contactEquationRelaxation:4,frictionEquationStiffness:1e8,frictionEquationRelaxation:4});}
 if(existingCargo&&(existingCargo.world!==world||existingCargo.mass!==3.2||!existingCargo.shapes[0]?.halfExtents?.almostEquals(new Vec3(.39,.39,.39))))throw new Error('Retain the actual original3.2kg/.78m cargo shape in its existing world');
 const own=b=>{world.addBody(b);ownedBodies.add(b);return b;};
 const mat=new Material({friction:.64,restitution:.08}),hingePoint=new Vec3(0,6,10),length=16,width=8,thickness=.32;
 const bridge=new Body({mass:16,shape:new Box(new Vec3(width/2,thickness/2,length/2)),material:mat,allowSleep:false,linearDamping:0,angularDamping:0});
 bridge.quaternion.setFromAxisAngle(new Vec3(1,0,0),-.90);
 bridge.position.copy(hingePoint.vadd(bridge.quaternion.vmult(new Vec3(0,-thickness/2,-length/2))));
 const fixed=new Body({mass:0,position:hingePoint,collisionFilterMask:0});own(fixed);own(bridge);
 const joint=new HingeConstraint(fixed,bridge,{pivotA:new Vec3(),pivotB:new Vec3(0,thickness/2,length/2),axisA:new Vec3(1,0,0),axisB:new Vec3(1,0,0),maxForce:1e7,collideConnected:false});
 joint.equations=joint.equations.filter(e=>e!==joint.motorEquation);
 for(const equation of joint.equations)equation.setSpookParams(1e10,4,dt);
 world.addConstraint(joint);
 const stops=[];
 function stop(position,half){const b=new Body({mass:0,position:C(position),shape:new Box(C(half)),material:mat});own(b);stops.push(b);return b;}
 // Ears meet upper stops only on upward overtravel. Falling ears separate;
 // the stops cannot act as an unmodeled downward latch.
 for(const x of [-4.3,4.3]){
  bridge.addShape(new Box(new Vec3(.30,.20,.30)),new Vec3(x,.11,9));
  stop([x,5.63,11],[.35,.12,.35]);
 }
 const lower=hingePoint.vadd(bridge.quaternion.vmult(new Vec3(0,-thickness,-length)));
 stop([0,lower.y-.35,lower.z],[4.6,.35,.75]);stop([0,-10.3,0],[35,.3,60]);
 const cargo=existingCargo??own(new Body({mass:3.2,position:new Vec3(-18,6.39,16),shape:new Box(new Vec3(.39,.39,.39)),material:new Material({friction:1,restitution:1}),allowSleep:true,sleepSpeedLimit:.11,sleepTimeLimit:.7,linearDamping:.035,angularDamping:.16,collisionFilterGroup:2,collisionFilterMask:5}));
 const contactMaterial=new ContactMaterial(cargo.material,mat,{friction:.64,restitution:.08,contactEquationStiffness:1e8,contactEquationRelaxation:4,frictionEquationStiffness:1e8,frictionEquationRelaxation:4});world.addContactMaterial(contactMaterial);
 const originalShape=cargo.shapes[0],guide=createRoom35CapstanGuide(),fairlead=[0,20,10],tailExit=[-18,17,16],eyeLocal=new Vec3(0,.71,-8),contactSurrogates=[];
 const keeper=new Body({mass:0,position:C(guide.center),material:mat});
 keeper.addShape(new Cylinder(guide.radius-guide.ropeRadius,guide.radius-guide.ropeRadius,.8,32),new Vec3(0,0,.10),new Quaternion().setFromAxisAngle(new Vec3(1,0,0),Math.PI/2));
 for(const p of guide.solidParts)keeper.addShape(new Box(C(p.half)),C(V.sub(p.center,guide.center)),new Quaternion().setFromAxisAngle(new Vec3(0,0,1),p.angle));
 // Four founded blocks leave the entry collar's exact .11m square eye.
 const collar=guide.entryCollar,qCollar=new Quaternion().setFromVectors(new Vec3(0,0,1),C(collar.axis));
 for(const [offset,half]of [[[.13,0,0],[.075,.205,.08]],[[-.13,0,0],[.075,.205,.08]],[[0,.13,0],[.055,.075,.08]],[[0,-.13,0],[.055,.075,.08]]]){
  keeper.addShape(new Box(C(half)),C(V.sub(collar.center,guide.center)).vadd(qCollar.vmult(C(offset))),qCollar);
 }
 own(keeper);
 const control={position:[0,6,22],pressed:false},crank=[0,6,22],controlRange=1.3;
 let nearPortal=guide.portalAt(theta),path=traceRoom35Capstan(guide,nearPortal),slip=0,time=0,steps=0,manualApplications=0;
 const eye=()=>xyz(bridge.pointToWorldFrame(eyeLocal));
 const lengths=()=>({left:distance(eye(),fairlead)+distance(fairlead,guide.loadPoint)+(path?.length??0),right:distance(xyz(cargo.position),tailExit)});
 const initial=lengths(),rest={left:initial.left+.4,right:distance([-18,6.39,16],tailExit)+.8},maxElasticExtension=.65;
 const ledger={manualWork:0,manualPositiveWork:0,manualNegativeWork:0,fixtureInsertionWork:0,capstanHeat:0,disconnectHeat:0,passiveDampingLoss:0,ropeDampingLoss:0,
  portalGeometryWork:0,maxPortalGeometryWork:0,maxSlipEnergyGain:0,maxResidual:0,minResidual:0,maxResidualAt:null,springDiscretizationWork:0,integratorAndConstraintWork:0,
  maxLeftStretch:0,maxRightStretch:0,maxTotalStretch:0,maxConeViolation:0,maxManualPower:0,minManualPower:0,maxManualForce:0,steps:0};
 let tensions={leftTension:0,rightTension:0,elasticEnergy:0,ratio:Math.exp(mu*path.curvatureTurn)},lastManual={active:false,force:0,power:0};
 function ropeEnergy(l=lengths()){
  if(!path)return 0;
  return .5*stiffness*(Math.max(0,l.left-rest.left-slip)**2+Math.max(0,l.right-rest.right+slip)**2);
 }
 function bodyEnergy(b){
  const w=b.angularVelocity,local=b.quaternion.conjugate().vmult(w),rot=.5*(b.inertia.x*local.x**2+b.inertia.y*local.y**2+b.inertia.z*local.z**2);
  return .5*b.mass*b.velocity.lengthSquared()+rot+b.mass*G*b.position.y;
 }
 const bodiesEnergy=()=>[bridge,cargo,...contactSurrogates].reduce((s,b)=>s+bodyEnergy(b),0);
 const potentialEnergy=()=>G*[bridge,cargo,...contactSurrogates].reduce((s,b)=>s+b.mass*b.position.y,0);
 const mechanical=()=>bodiesEnergy()+ropeEnergy();
 const initialEnergy=mechanical();let maxAngle=angle();
 const initialBridgeY=bridge.position.y,initialLoadSpan=distance(eye(),fairlead);
 function energyBarrier(targetAngle){
  // A budget calculation, never a pose setter. Generously allow the whole
  // initial slack and maximum physical elastic reach to help cargo gravity.
  const q=new Quaternion().setFromAxisAngle(new Vec3(1,0,0),targetAngle),com=hingePoint.vadd(q.vmult(new Vec3(0,-thickness/2,-length/2)));
  const hingeToCOM=new Vec3(0,-thickness/2,-length/2),hingeToEye=hingeToCOM.vadd(eyeLocal);
  const B=hingePoint.vadd(q.vmult(hingeToEye)),initialSlack=Math.max(0,rest.left+rest.right-initial.left-initial.right),drop=initialSlack+maxElasticExtension+initialLoadSpan-distance(xyz(B),fairlead);
  const bridgePotential=bridge.mass*G*(com.y-initialBridgeY),maxCargoGravityCredit=Math.max(0,cargo.mass*G*drop);
  return {targetAngle,bridgePotential,maxCargoGravityCredit,minimumNetExternalWork:bridgePotential-maxCargoGravityCredit};
 }
 function angle(){const q=bridge.quaternion;return Math.atan2(2*(q.w*q.x+q.y*q.z),1-2*(q.x*q.x+q.y*q.y));}
 function setPortal(next){
  const oldEnergy=ropeEnergy(),oldPath=path,newPath=traceRoom35Capstan(guide,next);
  if(!newPath){nearPortal=next;path=null;ledger.disconnectHeat+=oldEnergy;tensions={leftTension:0,rightTension:0,elasticEnergy:0,ratio:1};return false;}
  path=newPath;const l=lengths();
  if(!oldPath){
   // A disconnected finite rope can be threaded only while slack reaches
   // both physical ends. This is a local length condition, not a hold flag.
   if(l.left+l.right>rest.left+rest.right+1e-9){path=null;nearPortal=next;return false;}
   slip=Math.max(l.left-rest.left,Math.min(rest.right-l.right,slip));
  }
  const change=ropeEnergy(l)-oldEnergy;
  ledger.portalGeometryWork+=change;ledger.maxPortalGeometryWork=Math.max(ledger.maxPortalGeometryWork,Math.abs(change));nearPortal=next;return true;
 }
 function step(count=1){for(let n=0;n<count;n++){
  const beforeEye=eye(),beforeCargo=xyz(cargo.position),beforeAngle=angle(),l=lengths();
  let bridgeRope=[0,0,0],cargoRope=[0,0,0],bridgeViscosity=[0,0,0],cargoViscosity=[0,0,0];
  if(path&&l.left+l.right<=rest.left+rest.right+maxElasticExtension){
   const r=projectRoom35Capstan({leftLength:l.left,rightLength:l.right,leftRest:rest.left,rightRest:rest.right,slip,stiffness,mu,curvatureTurn:path.curvatureTurn});
   ledger.capstanHeat+=r.frictionHeat;ledger.maxSlipEnergyGain=Math.max(ledger.maxSlipEnergyGain,-r.frictionHeat);slip=r.slip;tensions=r;
   const nLeft=V.unit(V.sub(fairlead,beforeEye)),nRight=V.unit(V.sub(tailExit,beforeCargo));
   const leftRate=-V.dot(nLeft,xyz(bridge.getVelocityAtWorldPoint(C(beforeEye),new Vec3()))),rightRate=-V.dot(nRight,xyz(cargo.velocity));
   const damp=dampRoom35CapstanTensions(r,leftRate,rightRate,ropeViscosity);
   const eLeft=Math.max(0,l.left-rest.left-slip),eRight=Math.max(0,l.right-rest.right+slip);
   ledger.maxLeftStretch=Math.max(ledger.maxLeftStretch,eLeft);ledger.maxRightStretch=Math.max(ledger.maxRightStretch,eRight);ledger.maxTotalStretch=Math.max(ledger.maxTotalStretch,eLeft+eRight);
   ledger.maxConeViolation=Math.max(ledger.maxConeViolation,damp.leftTension-r.ratio*damp.rightTension,damp.rightTension-r.ratio*damp.leftTension);
   bridgeRope=V.scale(nLeft,r.leftTension);cargoRope=V.scale(nRight,r.rightTension);
   bridgeViscosity=V.scale(nLeft,damp.leftTension-r.leftTension);cargoViscosity=V.scale(nRight,damp.rightTension-r.rightTension);
   bridge.applyForce(C(V.add(bridgeRope,bridgeViscosity)),C(beforeEye).vsub(bridge.position));cargo.applyForce(C(V.add(cargoRope,cargoViscosity)));
  }else if(path){ledger.disconnectHeat+=ropeEnergy(l);path=null;tensions={leftTension:0,rightTension:0,elasticEnergy:0,ratio:1};}
  const atControl=control.pressed&&distance(control.position,crank)<=controlRange;
  const direction=V.unit(V.sub(fairlead,beforeEye)),eyeVelocity=bridge.getVelocityAtWorldPoint(C(beforeEye),new Vec3()),velocity=V.dot(direction,xyz(eyeVelocity));
  const arm=C(beforeEye).vsub(bridge.position),normal=C(direction),cross=arm.cross(normal),response=bridge.invInertiaWorld.vmult(cross).cross(arm);
  const effectiveInverseMass=bridge.invMass+normal.dot(response),budget=manualPower*dt;
  const positiveLimit=(-velocity+Math.sqrt(velocity*velocity+2*effectiveInverseMass*budget))/effectiveInverseMass;
  const impulse=atControl?Math.min(manualForce*dt,positiveLimit,velocity<0?budget/Math.max(.00001,-velocity):Infinity):0;
  const beforeHandEnergy=bodyEnergy(bridge);
  if(impulse){bridge.applyImpulse(C(V.scale(direction,impulse)),arm);manualApplications++;}
  const work=bodyEnergy(bridge)-beforeHandEnergy,magnitude=impulse/dt;
  const dampingTorque=-1200*bridge.angularVelocity.x,cargoDamping=cargo.velocity.scale(-1.6);
  bridge.torque.x+=dampingTorque;cargo.applyForce(cargoDamping);
  const springBefore=ropeEnergy(),potentialBefore=potentialEnergy(),kineticBefore=bodiesEnergy()-potentialBefore;
  world.step(dt);time+=dt;steps++;
  ledger.manualWork+=work;ledger.manualPositiveWork+=Math.max(0,work);ledger.manualNegativeWork+=Math.min(0,work);
  const dEye=V.sub(eye(),beforeEye),dCargo=V.sub(xyz(cargo.position),beforeCargo),ropeWork=V.dot(bridgeRope,dEye)+V.dot(cargoRope,dCargo);
  const bodyDampingWork=dampingTorque*(angle()-beforeAngle)+cargoDamping.dot(C(dCargo)),ropeDampingWork=V.dot(bridgeViscosity,dEye)+V.dot(cargoViscosity,dCargo);
  ledger.passiveDampingLoss-=bodyDampingWork;ledger.ropeDampingLoss-=ropeDampingWork;
  const potentialChange=potentialEnergy()-potentialBefore,kineticAfter=bodiesEnergy()-potentialEnergy();
  ledger.springDiscretizationWork+=ropeWork+ropeEnergy()-springBefore;
  ledger.integratorAndConstraintWork+=kineticAfter-kineticBefore+potentialChange-ropeWork-bodyDampingWork-ropeDampingWork;
  const residual=mechanical()+ledger.capstanHeat+ledger.disconnectHeat+ledger.passiveDampingLoss+ledger.ropeDampingLoss-initialEnergy-ledger.manualWork-ledger.fixtureInsertionWork-ledger.portalGeometryWork;
  if(residual>ledger.maxResidual){ledger.maxResidual=residual;ledger.maxResidualAt={time,angle:angle(),springDiscretizationWork:ledger.springDiscretizationWork,integratorAndConstraintWork:ledger.integratorAndConstraintWork};}
  ledger.minResidual=Math.min(ledger.minResidual,residual);ledger.steps=steps;
  lastManual={active:atControl,force:magnitude,power:work/dt,work,controlDistance:distance(control.position,crank)};maxAngle=Math.max(maxAngle,angle());
  ledger.maxManualPower=Math.max(ledger.maxManualPower,lastManual.power);ledger.minManualPower=Math.min(ledger.minManualPower,lastManual.power);ledger.maxManualForce=Math.max(ledger.maxManualForce,magnitude);
 }return diagnostics();}
 function surrogateContacts(){return contactSurrogates.map(body=>{let normalForce=0,contacts=0;for(const c of world.contacts)if(c.enabled!==false&&c.multiplier>0&&[c.bi,c.bj].includes(body)&&[c.bi,c.bj].includes(bridge)){const ny=(c.bi===body?-1:1)*c.ni.y;if(ny>.5){normalForce+=ny*c.multiplier;contacts++;}}return {bodyId:body.id,mass:body.mass,contacts,normalForce,position:xyz(body.position)};});}
 function addContactSurrogate(){
  const p=bridge.pointToWorldFrame(new Vec3(0,1.38,-6)),body=new Body({mass:3.2,position:p,shape:new Box(new Vec3(.4,1.2,.4)),material:mat,linearDamping:0,angularDamping:0,allowSleep:false});
  contactSurrogates.push(body);own(body);ledger.fixtureInsertionWork+=bodyEnergy(body);return body;
 }
 function diagnostics(){const residual=mechanical()+ledger.capstanHeat+ledger.disconnectHeat+ledger.passiveDampingLoss+ledger.ropeDampingLoss-initialEnergy-ledger.manualWork-ledger.fixtureInsertionWork-ledger.portalGeometryWork;return {scope:'assetless passive prototype; no production/game-player load claim',time,steps,dt,angle:angle(),maxAngle,energyResidual:residual,
  originalCargoBodyId:cargo.id,originalCargoShapeId:originalShape.id,cargoBodyId:cargo.id,cargoShapeId:cargo.shapes[0].id,cargoMass:cargo.mass,cargoPosition:xyz(cargo.position),cargoVelocity:xyz(cargo.velocity),
  bridgePosition:xyz(bridge.position),bridgeAngularVelocity:xyz(bridge.angularVelocity),theta:path?.theta??null,curvatureTurn:path?.curvatureTurn??null,
  pathLength:path?.length??null,crossingClearance:path?path.crossing.distance-2*guide.ropeRadius:null,restLength:rest.left+rest.right,slip,tensions:{...tensions},mechanicalEnergy:mechanical(),initialEnergy,
  ledger:{...ledger},lastManual:{...lastManual},manualApplications,motorEquationPresent:joint.equations.includes(joint.motorEquation),
  keeperBodyId:keeper.id,keeperShapeCount:keeper.shapes.length,keeperInWorld:keeper.world===world,surrogateContacts:surrogateContacts(),energyBarriers:[energyBarrier(-.5),energyBarrier(0)],
  control:{position:[...control.position],pressed:control.pressed},budget:{gravity:G,bridgeMass:bridge.mass,length,width,thickness,originalMass:3.2,originalCargoProvided:!!existingCargo,worldProvided:!!existingWorld,solverIterations:world.solver.iterations,solverTolerance:world.solver.tolerance,cargoLinearDamping:cargo.linearDamping,cargoAngularDamping:cargo.angularDamping,contactEquationStiffness:contactMaterial.contactEquationStiffness,mu,stiffness,ropeViscosity,ropeDiameter:guide.ropeRadius*2,maxElasticExtension,manualPower,manualForce,controlRange,crank:[...crank],gamePlayerMass:0,surrogatePlayerMass:contactSurrogates.reduce((s,b)=>s+b.mass,0)}};}
 return {world,bridge,cargo,originalShape,guide,control,crank,ledger,step,angle,diagnostics,setPortal,mechanical,rest,addContactSurrogate,energyBarrier,
  dispose(){world.removeConstraint(joint);for(const b of ownedBodies)if(b.world===world)world.removeBody(b);world.removeContactMaterial(contactMaterial);}};
}
