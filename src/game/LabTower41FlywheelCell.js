import * as THREE from 'three';
import {Body,Box,Constraint,Equation,HingeConstraint,Material,Vec3} from 'cannon-es';
import {createOrientedBoxContact,syncOrientedBoxContact} from './LabOrientedBoxContact.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),C=(x=0,y=0,z=0)=>new Vec3(x,y,z),DT=1/120;
const RATIOS=Object.freeze([.5,2/3,1.5]);

// A passive, power-conserving gear equation: r*wA + wB = 0. Its
// Jacobian transmits equal work through the selected gearing; it supplies no
// desired speed or positional drive, and therefore cannot create momentum.
class GearEquation extends Equation{
 constructor(a,b,ratio){super(a,b,-1e5,1e5);this.ratio=ratio;this.scratch=C();}
 computeB(h){this.jacobianElementA.rotational.set(0,0,this.ratio);this.jacobianElementB.rotational.set(0,0,1);return-this.computeGW()*this.b-h*this.computeGiMf();}
 computeGiMGt(){const a=this.jacobianElementA.rotational,b=this.jacobianElementB.rotational;this.bi.invInertiaWorldSolve.vmult(a,this.scratch);const value=a.dot(this.scratch);this.bj.invInertiaWorldSolve.vmult(b,this.scratch);return value+b.dot(this.scratch);}
}
class GearConstraint extends Constraint{
 constructor(a,b,ratio){super(a,b,{collideConnected:false});this.gearEquation=new GearEquation(a,b,ratio);this.equations.push(this.gearEquation);}
 update(){}
}

/** Three freely hinged rigid flywheels, a passive selectable transmission,
 * and a gravity-loaded friction clutch. The only input is a bounded hand
 * impulse. The load force is measured on the original cargo's Cannon contact
 * with the actual tray shape, never from a pad-distance puzzle flag. */
export function buildTower41FlywheelCell(game,k,options={}){
 const centre=options.centre??[-48,18,-37],origin=V(...centre),m=k.m;
 const rotorDefs=[{x:-8,r:3.9,mass:4.5,material:m.copper},{x:0,r:2.6,mass:1,material:m.ivory},{x:7,r:3.2,mass:1,material:m.cyan}];
 const rotorParts=rotorDefs.map(()=>[]),fixedParts=[],bodies=[],constraints=[],hinges=[],cargoSweepIds=[],bodyBoxIds=[];
 const rotorOrigins=rotorDefs.map(d=>C(centre[0]+d.x,centre[1]+4,centre[2]-11));
 const loadPosition=V(centre[0]+11,centre[1]+.28,centre[2]+5),loadCargoPosition=loadPosition.clone().add(V(0,.39,0));
 let owner=null,anchor=null,fixedBody=null,rotors=[],gear=null,idlerGear=null,disposed=false,onPostStep=null,lastForceStep=-1;
 let ratio=0,clutch=false,brake=false,contactStep=-1,normalLoad=0,contactCount=0,crankCount=0,brakeWork=0,loadWork=0;
 const handAngularImpulse=options.handAngularImpulse??88.3;
 if(!(handAngularImpulse>0&&handAngularImpulse<=120))throw new RangeError('Hand impulse must be positive and bounded');
 function part(list,name,base,offset,size,material){
  const mesh=k.box(base.clone().add(V(...offset)).toArray(),size,material,{dynamic:true});mesh.name=name;
  const p={mesh,collider:mesh.userData.collider,offset:C(...offset),half:C(...size.map(n=>n/2))};list.push(p);return p;
 }
 for(const [i,d]of rotorDefs.entries()){
  const base=V(rotorOrigins[i].x,rotorOrigins[i].y,rotorOrigins[i].z),r=d.r,list=rotorParts[i];
  // Every visible moving member is the same box used by the rigid compound.
  // The squared rims leave open, physically honest gaps between their spokes.
  part(list,`41 inertial rotor ${i+1} horizontal spoke`,base,[0,0,0],[r*2,.26,.36],d.material);
  part(list,`41 inertial rotor ${i+1} vertical spoke`,base,[0,0,0],[.26,r*2,.36],d.material);
  for(const sign of [-1,1]){
   part(list,`41 inertial rotor ${i+1} rim`,base,[0,sign*r*.66,0],[r*1.4,.20,.36],d.material);
   part(list,`41 inertial rotor ${i+1} rim`,base,[sign*r*.66,0,0],[.20,r*1.4,.36],d.material);
  }
  part(list,`41 inertial rotor ${i+1} hub`,base,[0,0,0],[.7,.7,.58],m.dark);
 }
 // A founded housing keeps the high-energy rotating members behind a real
 // front pane. The open loading tray remains on the normal room floor.
 const glass=k.mat(0x9bc5cd,.52,.05);glass.transparent=true;glass.opacity=.20;
 for(const [offset,size,mat]of [
  [[-.5,.12,-11],[25,.24,3.5],m.dark],
  [[-12.7,4,-11],[.22,8,3.5],m.steel],[[11.7,4,-11],[.22,8,3.5],m.steel],
  [[-.5,8.08,-11],[25,.16,3.5],m.steel],
  [[-.5,4,-9.35],[25,8,.16],glass],[[-.5,4,-12.65],[25,8,.16],glass],
 ])part(fixedParts,'41 founded flywheel guard',origin,offset,size,mat);
 for(const d of rotorDefs){
  part(fixedParts,'41 flywheel bearing pedestal',origin,[d.x,1.9,-11.7],[.42,3.8,.42],m.steel);
  part(fixedParts,'41 fixed bearing axle',origin,[d.x,4,-11.45],[.20,.20,1.1],m.ivory);
 }
 part(fixedParts,'41 fixed transmission shaft housing',origin,[-.5,4,-12.2],[15.8,.72,.64],m.dark);
 // One compound shape owns the only cargo loading face. Its top is 0.28m above floor.
 // The front edge and sides stay open for normal E carry/release access.
 const trayPart=part(fixedParts,'41 gravity-loaded clutch tray',origin,[11,.14,5],[2.4,.28,2.2],m.copper);
 trayPart.mesh.userData.gameplayRole='Original free cargo presses the physical clutch load face';
 const trayShapeIndex=fixedParts.length-1;
 part(fixedParts,'41 clutch load transmission casing',origin,[11,.20,3.72],[2.4,.40,.32],m.dark);
 // Fixed linkage sits below the accessible tray, not across the carry path.
 part(fixedParts,'41 gravity clutch linkage',origin,[11,.10,-1.75],[.20,.20,10.5],m.steel);

 function addBody(b,name){b.labTower41Cell=name;owner.world.addBody(b);bodies.push(b);return b;}
 function addConstraint(c){c.collideConnected=false;for(const e of c.equations){e.setSpookParams(c instanceof GearConstraint?1e10:1e8,4,DT);if(c instanceof GearConstraint)e.b=1;}owner.world.addConstraint(c);constraints.push(c);return c;}
 function descriptor(p,b){
  p.collider.orientedBox=createOrientedBoxContact(b,V(p.half.x,p.half.y,p.half.z),V(p.offset.x,p.offset.y,p.offset.z),owner.world.stepnumber);
  // Player capsules, cameras and aimed shots keep this visible box. Its
  // contact registry binds that same geometry to the existing compound
  // Cannon shape instead of introducing a second static collision body.
  owner.registerBodyBox(p.mesh.uuid,{body:b,shapeIndex:b.shapes.length-1,orientedBox:p.collider.orientedBox});bodyBoxIds.push(p.mesh.uuid);
 }
 function syncPart(p,b,reset){const q=b.quaternion,offset=q.vmult(p.offset);p.mesh.position.set(b.position.x+offset.x,b.position.y+offset.y,b.position.z+offset.z);p.mesh.quaternion.set(q.x,q.y,q.z,q.w);p.mesh.updateWorldMatrix(true,false);p.collider.box.setFromObject(p.mesh);syncOrientedBoxContact(p.collider.orientedBox,b,owner.world.stepnumber,reset);}
 function place(b,p){b.position.copy(p);b.quaternion.set(0,0,0,1);b.velocity.setZero();b.angularVelocity.setZero();b.force.setZero();b.torque.setZero();b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);b.previousQuaternion.copy(b.quaternion);b.interpolatedQuaternion.copy(b.quaternion);b.aabbNeedsUpdate=true;b.wakeUp();}
 function originalFreeCargo(){return!disposed&&owner&&game.cargo===cell.originalCargo&&owner.cargoBody===cell.originalCargoBody&&owner.world.bodies.includes(cell.originalCargoBody)&&cell.originalCargoBody.collisionResponse!==false&&cell.originalCargoBody.shapes[0]?.collisionResponse!==false&&fixedBody.collisionResponse!==false&&fixedBody.shapes[trayShapeIndex].collisionResponse!==false&&!game.heldCube&&!owner.carryTarget;}
 function sampleLoad(){
  normalLoad=0;contactCount=0;contactStep=owner.world.stepnumber;
  if(!originalFreeCargo())return;
  for(const c of owner.world.contacts){
   if(c.enabled===false||![c.bi,c.bj].includes(cell.originalCargoBody)||![c.bi,c.bj].includes(fixedBody)||![c.si,c.sj].includes(fixedBody.shapes[trayShapeIndex])||!(c.multiplier>1e-6))continue;
   const normalY=(c.bi===cell.originalCargoBody?-1:1)*c.ni.y;
   if(normalY>.65){normalLoad+=normalY*c.multiplier;contactCount++;}
  }
 }
 const cell={
  centre:origin,ratios:RATIOS,loadPosition,loadCargoPosition,trayPart,trayShapeIndex,rotorParts,fixedParts,rotorOrigins,handAngularImpulse,
  get owner(){return owner;},get bodies(){return bodies;},get constraints(){return constraints;},get hinges(){return hinges;},get rotors(){return rotors;},get rotor(){return rotors[0]??null;},get outputRotor(){return rotors[1]??null;},get anchor(){return anchor;},get fixedBody(){return fixedBody;},get gearConstraint(){return gear;},
  get omega(){return rotors[0]?.angularVelocity.z??0;},get output(){return-(rotors[1]?.angularVelocity.z??0)||0;},get ratio(){return ratio;},get ratioValue(){return RATIOS[ratio];},get clutch(){return clutch;},get brake(){return brake;},
  get loadContact(){return originalFreeCargo()&&contactStep===owner.world.stepnumber&&contactCount>0&&normalLoad>1e-6;},
  get loadNormalForce(){return cell.loadContact?normalLoad:0;},
  get readyForProof(){return cell.clutch&&!cell.brake&&cell.ratio===1&&cell.loadContact&&cell.output>4.9&&cell.output<6.1;},
  get energy(){return rotors.reduce((sum,b)=>sum+.5*b.inertia.z*b.angularVelocity.z**2,0);},
  ensure(){
   if(disposed||!game.physics?.cargoBody)return false;if(owner===game.physics)return true;
   if(owner)throw new Error('Flywheel cell cannot change physics owner without disposal');owner=game.physics;
   cell.originalCargo=game.cargo;cell.originalCargoBody=owner.cargoBody;
   for(const p of [...rotorParts.flat(),...fixedParts])owner.removeStaticBox(p.mesh.uuid);
   const material=new Material({friction:.35,restitution:0});
   anchor=addBody(new Body({mass:0,position:C(...centre),collisionFilterGroup:1,collisionFilterMask:0}),'flywheel bearing foundation');
   fixedBody=addBody(new Body({mass:0,position:C(...centre),material,collisionFilterGroup:1,collisionFilterMask:3}),'flywheel founded guards and load tray');
   for(const [index,p]of fixedParts.entries()){
    fixedBody.addShape(new Box(p.half),p.offset);descriptor(p,fixedBody);
    // Safety guards receive CCD. The broad open loading face must enter the
    // ordinary narrowphase: a swept support skin alone is not a load impulse.
    if(index!==trayShapeIndex){owner.registerCargoSweepBox(p.mesh.uuid,{body:fixedBody,shapeIndex:index});cargoSweepIds.push(p.mesh.uuid);}
   }
   rotors=rotorDefs.map((d,i)=>{
    const b=addBody(new Body({mass:d.mass,position:rotorOrigins[i].clone(),allowSleep:false,linearDamping:0,angularDamping:0,material,collisionFilterGroup:1,collisionFilterMask:2}),`inertial flywheel ${i+1}`);
    for(const p of rotorParts[i]){b.addShape(new Box(p.half),p.offset);descriptor(p,b);}
    const hinge=new HingeConstraint(anchor,b,{pivotA:rotorOrigins[i].vsub(anchor.position),pivotB:C(),axisA:C(0,0,1),axisB:C(0,0,1),maxForce:1e6,collideConnected:false});hinge.equations=hinge.equations.filter(e=>e!==hinge.motorEquation);hinges.push(addConstraint(hinge));return b;
   });
   gear=addConstraint(new GearConstraint(rotors[0],rotors[1],RATIOS[ratio]));idlerGear=addConstraint(new GearConstraint(rotors[1],rotors[2],.8));
   onPostStep=()=>{sampleLoad();cell.syncPose();};owner.world.addEventListener('postStep',onPostStep);cell.syncPose(true);return true;
  },
  crank(){
   if(!cell.ensure()||Math.abs(cell.omega)>14)return false;
   // A force couple is a physical hand input with zero net linear impulse.
   // No update assigns a target angular velocity to any body.
   const arm=2,impulse=handAngularImpulse/(2*arm);
   rotors[0].applyImpulse(C(-impulse,0,0),C(0,arm,0));rotors[0].applyImpulse(C(impulse,0,0),C(0,-arm,0));
   for(const b of rotors)b.wakeUp();crankCount++;return true;
  },
  cycleRatio(){if(!cell.ensure())return false;ratio=(ratio+1)%RATIOS.length;gear.gearEquation.ratio=RATIOS[ratio];for(const b of rotors)b.wakeUp();return true;},
  toggleClutch(){if(!cell.ensure())return false;clutch=!clutch;return true;},
  toggleBrake(){if(!cell.ensure())return false;brake=!brake;for(const b of rotors)b.wakeUp();return true;},
  updateForces(dt){
   if(!(dt>0)||!cell.ensure())return;const step=owner.world.stepnumber;if(lastForceStep===step)return;lastForceStep=step;
   const w=cell.omega,r=RATIOS[ratio],effectiveInertia=rotors[0].inertia.z+r*r*(rotors[1].inertia.z+.64*rotors[2].inertia.z);
   // Bearing drag, friction clutch and service brake all dissipate actual
   // rigid-body kinetic energy. There is no spring and no powered motor.
   rotors[0].torque.z-=.009*rotors[0].inertia.z*w;
   if(cell.loadContact)cell.originalCargoBody.wakeUp();
   if(clutch&&cell.loadContact){const wo=rotors[1].angularVelocity.z,torque=Math.min(cell.loadNormalForce*.012,Math.abs(wo)*effectiveInertia/(Math.max(r*r,1e-6)*dt));rotors[1].torque.z-=Math.sign(wo)*torque;loadWork+=torque*Math.abs(wo)*dt;}
   if(brake&&Math.abs(w)>1e-9){const torque=Math.min(110,Math.abs(w)*effectiveInertia/dt);rotors[0].torque.z-=Math.sign(w)*torque;brakeWork+=torque*Math.abs(w)*dt;}
  },
  syncPose(reset=false){if(!cell.ensure())return;for(const [i,list]of rotorParts.entries())for(const p of list)syncPart(p,rotors[i],reset);for(const p of fixedParts)syncPart(p,fixedBody,reset);trayPart.mesh.material=cell.loadContact?m.live:m.copper;},
  reset(){if(!cell.ensure())return;ratio=0;clutch=brake=false;normalLoad=contactCount=crankCount=brakeWork=loadWork=0;contactStep=lastForceStep=-1;gear.gearEquation.ratio=RATIOS[0];for(const [i,b]of rotors.entries())place(b,rotorOrigins[i]);owner.world.broadphase.dirty=true;cell.syncPose(true);},
  diagnostics(){if(!cell.ensure())return{ready:false,disposed};return{ready:true,disposed,worldStep:owner.world.stepnumber,omega:cell.omega,output:cell.output,ratio,ratioValue:RATIOS[ratio],clutch,brake,loadContact:cell.loadContact,loadNormalForce:cell.loadNormalForce,loadContactCount:contactCount,contactStep,readyForProof:cell.readyForProof,energy:cell.energy,crankCount,brakeWork,loadWork,handAngularImpulse,bodyIds:bodies.map(b=>b.id),constraintEquationCounts:constraints.map(c=>c.equations.length),originalCargoBodyId:cell.originalCargoBody.id,trayBodyId:fixedBody.id,trayShapeId:fixedBody.shapes[trayShapeIndex].id,rotors:rotors.map(b=>({id:b.id,position:b.position.toArray(),angularVelocity:b.angularVelocity.toArray(),inertia:b.inertia.toArray(),torque:b.torque.toArray()}))};},
  dispose(){if(disposed)return;disposed=true;if(owner){if(onPostStep)owner.world.removeEventListener('postStep',onPostStep);for(const id of bodyBoxIds)owner.removeBodyBox(id);bodyBoxIds.length=0;for(const id of cargoSweepIds)owner.removeCargoSweepBox(id);cargoSweepIds.length=0;for(const c of constraints)owner.world.removeConstraint(c);for(const b of bodies)owner.world.removeBody(b);for(const p of [...rotorParts.flat(),...fixedParts]){p.collider.enabled=false;delete p.collider.orientedBox;}}},
 };
 return cell;
}
