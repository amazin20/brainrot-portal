import {Body,Box,Material,Spring,Vec3} from 'cannon-es';
import {measureCastleCoherentField,castleFieldPhaseSamples} from './LabCastleCoherentField.js';

const C=(x=0,y=0,z=0)=>new Vec3(x,y,z),ROOT_HALF=.39;
const finitePositive=n=>Number.isFinite(n)&&n>0;
function place(body,position){body.position.copy(position);body.previousPosition.copy(position);body.interpolatedPosition.copy(position);body.quaternion.set(0,0,0,1);body.previousQuaternion.copy(body.quaternion);body.interpolatedQuaternion.copy(body.quaternion);body.velocity.setZero();body.angularVelocity.setZero();body.force.setZero();body.torque.setZero();body.aabbNeedsUpdate=true;body.wakeUp();}

/** Isolated prototype owner; no game imports, assets, world-step ownership,
 * query registries, portal changes, actor respawn or solved state.
 * Call beforeStep(dt), world.step(dt), afterStep() exactly once per step.
 * Cargo identity/contact is provenance ONLY; it never changes optical power.
 * The two reflecting planes follow the very same gravity-loaded rigid tray. */
export function createCastleOpticalDelayRig({world,originalCargoBody,originalCargoToken={},cargoState,sourcePower=80,wavelength=4,stiffness=62.4,damping=32,trayMass=4,homeHeight=5,referenceHeight=6,anchorHeight=9,fieldLayout}={}){
 if(!world||!originalCargoBody||!world.bodies.includes(originalCargoBody)||!originalCargoBody.shapes[0])throw new TypeError('Original cargo must already belong to the Cannon world');
 const supply=()=>{const p=typeof sourcePower==='function'?sourcePower():sourcePower;if(!Number.isFinite(p)||p<0||p>80)throw new RangeError('Field source must supply0..80real watts');return p;};supply();
 if(![stiffness,damping,trayMass,homeHeight,referenceHeight,anchorHeight,wavelength].every(finitePositive))throw new RangeError('Finite passive prototype dimensions/power required');
 if(world.gravity.x!==0||world.gravity.z!==0||!(world.gravity.y<0))throw new RangeError('Prototype requires vertical downward gravity');
 const originalShape=originalCargoBody.shapes[0],originalPosition=originalCargoBody.position.clone(),home=C(4,homeHeight,1),g=-world.gravity.y;
 const restLength=anchorHeight-homeHeight-trayMass*g/stiffness;
 if(!(restLength>0))throw new RangeError('Spring anchor must leave a positive real rest length');
 const material=new Material({friction:.6,restitution:0}),trayShape=new Box(C(1.2,.1,1.1));
 const tray=new Body({mass:trayMass,position:home.clone(),shape:trayShape,material,allowSleep:false,linearDamping:0,angularDamping:0,linearFactor:C(0,1,0),angularFactor:C()});
 const anchor=new Body({mass:0,position:C(4,anchorHeight,1),collisionFilterMask:0});
 world.addBody(tray);world.addBody(anchor);
 const spring=new Spring(anchor,tray,{restLength,stiffness,damping});
 const current=cargoState??(()=>({body:originalCargoBody,shape:originalCargoBody.shapes[0],token:originalCargoToken,held:false,carryTarget:null}));
 let disposed=false,pending=null,contact=null,lastFinishedStep=world.stepnumber,resetStep=world.stepnumber;
 const ledger={sourceInputJ:0,couplerInputJ:0,outputPlusJ:0,outputMinusJ:0,absorbedJ:0,springDampingJ:0,resetWorkJ:0,resets:0};
 const mirror=(id,center,normal)=>({id,kind:'mirror',center,normal,halfWidth:.65,halfHeight:.65});
 const input=(id,z)=>({id,kind:'input',center:[2,0,z],normal:[0,1,0],halfWidth:.4,halfHeight:.4});
 const delayPoint=x=>()=>tray.pointToWorldFrame(C(x-4,0,0));
 const delayNormal=n=>()=>tray.quaternion.vmult(C(...n));
 const a=mirror('reference-fold-a',[0,referenceHeight,-1],[1,-1,0]),b=mirror('reference-fold-b',[2,referenceHeight,-1],[-1,-1,0]);
 const c=mirror('delay-fold-a',delayPoint(0),delayNormal([1,-1,0])),d=mirror('delay-fold-b',delayPoint(2),delayNormal([-1,-1,0]));
 const referenceInput=input('reference-input',-1),delayInput=input('delay-input',1),defaultFaces=[a,b,c,d,referenceInput,delayInput];
 let layout;try{layout=fieldLayout?.({tray,world})??{faces:defaultFaces,arms:[{origin:[0,0,-1],direction:[0,1,0],faces:defaultFaces,inputId:referenceInput.id},{origin:[0,0,1],direction:[0,1,0],faces:defaultFaces,inputId:delayInput.id}]};if(!Array.isArray(layout.arms)||layout.arms.length!==2||!Array.isArray(layout.faces))throw new TypeError('Two actual traced arm layouts are required');}catch(error){world.removeBody(tray);world.removeBody(anchor);throw error;}
 const {arms,faces}=layout;
 function mechanicalEnergy(){
  if(disposed)throw new Error('Delay rig is disposed');
  let energy=0;const bodyIds=[];
  for(const body of world.bodies)if(body.type===Body.DYNAMIC&&body.mass>0){
   const local=body.quaternion.conjugate().vmult(body.angularVelocity);
   energy+=body.mass*(-world.gravity.dot(body.position)+.5*body.velocity.lengthSquared())+.5*(body.inertia.x*local.x**2+body.inertia.y*local.y**2+body.inertia.z*local.z**2);bodyIds.push(body.id);
  }
  const extension=anchor.position.distanceTo(tray.position)-spring.restLength;
  return{joules:energy+.5*spring.stiffness*extension**2,bodyIds,springJ:.5*spring.stiffness*extension**2};
 }
 const initialMechanicalEnergy=mechanicalEnergy().joules;
 function originalContact(){
  const state=current(),body=originalCargoBody,shape=originalShape;
  if(disposed||world.stepnumber<=resetStep||state.body!==body||state.shape!==shape||state.token!==originalCargoToken||state.held||state.carryTarget||body.world!==world||tray.world!==world||!world.bodies.includes(body)||!world.bodies.includes(tray)||body.type!==Body.DYNAMIC||Math.abs(body.mass-3.2)>1e-9||body.shapes[0]!==shape||body.collisionResponse===false||shape.collisionResponse===false||tray.collisionResponse===false||trayShape.collisionResponse===false||!shape.halfExtents||['x','y','z'].some(axis=>Math.abs(shape.halfExtents[axis]-ROOT_HALF)>1e-8)||!(body.collisionFilterMask&tray.collisionFilterGroup)||!(tray.collisionFilterMask&body.collisionFilterGroup))return null;
  let normalForce=0,contacts=0;
  for(const equation of world.contacts){
   if(equation.enabled===false||!(equation.multiplier>0)||![equation.bi,equation.bj].includes(body)||![equation.bi,equation.bj].includes(tray)||![equation.si,equation.sj].includes(shape)||![equation.si,equation.sj].includes(trayShape))continue;
   const ny=(equation.bi===body?-1:1)*equation.ni.y;if(ny>.65){normalForce+=ny*equation.multiplier;contacts++;}
  }
  return contacts?{worldStep:world.stepnumber,originalCargoBodyId:body.id,originalCargoShapeId:shape.id,trayBodyId:tray.id,trayShapeId:trayShape.id,mass:body.mass,normalForce,contacts}:null;
 }
 function readout(){
  if(disposed)throw new Error('Delay rig is disposed');
  const field=measureCastleCoherentField({arms,wavelength,sourcePower:supply()});
  return{...field,trayPosition:tray.position.toArray(),originalContact:contact?.worldStep===world.stepnumber?originalContact():null,mechanicalEnergy:mechanicalEnergy(),initialMechanicalEnergy,ledger:{...ledger},waveLandmarks:field.traces.map(trace=>castleFieldPhaseSamples(trace,{wavelength}))};
 }
 const rig={world,tray,trayShape,anchor,spring,arms,faces,originalCargoBody,originalCargoShape:originalShape,originalCargoToken,
  get disposed(){return disposed;},
  beforeStep(dt){
   if(disposed)throw new Error('Delay rig is disposed');
   if(!finitePositive(dt)||dt>1/60||pending)throw new RangeError('Exactly one bounded fixed step is required');
   pending={step:world.stepnumber,dt,field:measureCastleCoherentField({arms,wavelength,sourcePower:supply()})};spring.applyForce();
   const axis=tray.position.vsub(anchor.position);axis.normalize();const speed=tray.velocity.vsub(anchor.velocity).dot(axis);
   ledger.springDampingJ+=spring.damping*speed**2*dt;
  },
  afterStep(){
   if(disposed||!pending||world.stepnumber!==pending.step+1||world.stepnumber===lastFinishedStep)throw new Error('One actual Cannon step must precede optical sampling');
   const {dt,field}=pending;pending=null;lastFinishedStep=world.stepnumber;contact=originalContact();
   ledger.sourceInputJ+=field.sourcePower*dt;ledger.couplerInputJ+=field.inputPower*dt;ledger.outputPlusJ+=field.outputPlus*dt;ledger.outputMinusJ+=field.outputMinus*dt;ledger.absorbedJ+=field.absorbedBeforeCoupler*dt;
   return readout();
  },
  readout,mechanicalEnergy,
  reset({restoreOriginalCargo=false}={}){
   if(disposed||pending)throw new Error('Reset requires an idle live rig');
   const before=mechanicalEnergy().joules;place(tray,home);
   if(restoreOriginalCargo)place(originalCargoBody,originalPosition);
   ledger.resetWorkJ+=mechanicalEnergy().joules-before;ledger.resets++;contact=null;resetStep=world.stepnumber;lastFinishedStep=world.stepnumber;world.broadphase.dirty=true;
   return readout();
  },
  dispose(){if(disposed)return;disposed=true;pending=null;contact=null;world.removeBody(tray);world.removeBody(anchor);},
 };
 return rig;
}
