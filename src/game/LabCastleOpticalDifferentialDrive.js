import {Body,Box,Material,Spring,Vec3} from 'cannon-es';

const C=(x=0,y=0,z=0)=>new Vec3(x,y,z);
const positive=x=>Number.isFinite(x)&&x>0;

/** Two matched opposed field-to-electric linear drives on one actual rack.
 * Equal complementary powers cancel before a rigid-body impulse is applied.
 * No heat/charge reservoir, field-history permission or cargo predicate.
 * This prototype is a1kg/1m input rack, NOT a three-metre passenger door.
 * A future transmission must include its real ratio and reflected load. */
export function createCastleOpticalDifferentialDrive({world,readPowers,position=[15,.25,-12],mass=1,gain=.75,efficiency=.4,stiffness=27,damping=14,stroke=1.05}={}){
 if(!world||typeof readPowers!=='function'||![mass,gain,efficiency,stiffness,damping,stroke].every(positive)||efficiency>1||world.gravity.x!==0||world.gravity.z!==0||!(world.gravity.y<0)||position.length!==3||!position.every(Number.isFinite))throw new TypeError('Finite vertical passive drive parameters required');
 const home=C(...position),material=new Material({friction:0,restitution:0}),shape=new Box(C(.25,.25,.25));
 const rack=new Body({mass,shape,position:home.clone(),material,linearDamping:0,angularDamping:0,linearFactor:C(0,1,0),angularFactor:C(),allowSleep:false});
 const lower=new Body({mass:0,shape:new Box(C(.65,.1,.65)),position:C(home.x,home.y-.35,home.z),material});
 const upper=new Body({mass:0,shape:new Box(C(.65,.1,.65)),position:C(home.x,home.y+stroke+.35,home.z),material});
 const anchor=new Body({mass:0,position:C(home.x,home.y-2,home.z),collisionFilterMask:0});
 const owned=[rack,lower,upper,anchor];for(const b of owned)world.addBody(b);
 const spring=new Spring(anchor,rack,{restLength:2,stiffness,damping});
 const ledger={absorbedFieldJ:0,differentialBudgetJ:0,motorWorkJ:0,motorHeatJ:0,positiveMotorWorkJ:0,brakingHeatJ:0,damperEstimateJ:0,resetWorkJ:0,resets:0};
 let pending=null,disposed=false,lastFinishedStep=world.stepnumber,lastImpulse=null,maxBudgetError=0;
 const kinetic=()=>.5*rack.mass*rack.velocity.lengthSquared();
 function energy(){
  const q=rack.position.y-home.y,extension=anchor.position.distanceTo(rack.position)-spring.restLength;
  return{kineticJ:kinetic(),gravityJ:rack.mass*(-world.gravity.y)*q,springJ:.5*spring.stiffness*extension**2,totalJ:kinetic()+rack.mass*(-world.gravity.y)*q+.5*spring.stiffness*extension**2};
 }
 const initialEnergy=energy().totalJ;
 function live(){if(disposed||owned.some(b=>b.world!==world||!world.bodies.includes(b))||rack.type!==Body.DYNAMIC||!positive(rack.mass)||Math.abs(rack.invMass-1/rack.mass)>1e-12||rack.shapes[0]!==shape||rack.linearFactor.x!==0||rack.linearFactor.y!==1||rack.linearFactor.z!==0||rack.angularFactor.lengthSquared()!==0||spring.bodyA!==anchor||spring.bodyB!==rack)throw new Error('Differential rack requires its unchanged actual dynamic owner and passive supports');}
 const drive={rack,shape,lower,upper,anchor,spring,owned,home,stroke,gain,efficiency,
  get disposed(){return disposed;},
  beforeStep(dt){
   live();if(!positive(dt)||dt>1/60||pending)throw new Error('Exactly one bounded actual rack step required');
   const field=readPowers(),plus=field.outputPlus,minus=field.outputMinus;
   if(![plus,minus].every(p=>Number.isFinite(p)&&p>=0)||plus+minus>80+1e-7)throw new RangeError('At most80W of actual complementary output may feed the rack');
   const delta=plus-minus,direction=Math.sign(delta),speed=rack.velocity.y,power=Math.abs(delta),budget=efficiency*power*dt;
   const desired=gain*power*dt/(1+gain*Math.abs(speed)/efficiency);
   // Exact ΔK=J*v+J²/(2M). Cap the physical impulse, including its from-rest
   // acceleration energy; force*oldVelocity would incorrectly charge zero.
   const limit=direction?rack.mass*(-direction*speed+Math.sqrt(speed**2+2*budget/rack.mass)):0;
   const impulse=direction*Math.min(desired,Math.max(0,limit)),beforeK=kinetic();
   rack.applyImpulse(C(0,impulse,0));const work=kinetic()-beforeK,error=work-budget;maxBudgetError=Math.max(maxBudgetError,error);
   if(work>budget+1e-8)throw new Error('Actual rack impulse exceeded available differential field energy');
   const input=(plus+minus)*dt,heat=input-work;if(heat< -1e-8)throw new Error('Negative field-transducer heat');
   ledger.absorbedFieldJ+=input;ledger.differentialBudgetJ+=budget;ledger.motorWorkJ+=work;ledger.motorHeatJ+=heat;ledger.positiveMotorWorkJ+=Math.max(0,work);ledger.brakingHeatJ+=Math.max(0,-work);
   lastImpulse={worldStep:world.stepnumber,plus,minus,delta,velocityBefore:speed,velocityAfter:rack.velocity.y,impulse,workJ:work,budgetJ:budget,heatJ:heat};
   ledger.damperEstimateJ+=spring.damping*rack.velocity.y**2*dt;spring.applyForce();pending={step:world.stepnumber,dt};
   return lastImpulse;
  },
  afterStep(){live();if(!pending||world.stepnumber!==pending.step+1||world.stepnumber===lastFinishedStep)throw new Error('One actual world step must precede rack sampling');pending=null;lastFinishedStep=world.stepnumber;return drive.readout();},
  readout(){live();return{worldStep:world.stepnumber,position:rack.position.toArray(),displacement:rack.position.y-home.y,velocity:rack.velocity.y,mass:rack.mass,forceAtRestPerWatt:gain,returnSpring:stiffness,returnDamper:damping,weightN:rack.mass*(-world.gravity.y),initialEnergy,energy:energy(),ledger:{...ledger},lastImpulse:lastImpulse?{...lastImpulse}:null,maxBudgetError,bodyId:rack.id,shapeId:shape.id};},
  reset(){
   live();if(pending)throw new Error('Reset requires an idle rack');const before=energy().totalJ;
   rack.position.copy(home);rack.previousPosition.copy(home);rack.interpolatedPosition.copy(home);rack.velocity.setZero();rack.angularVelocity.setZero();rack.force.setZero();rack.torque.setZero();rack.aabbNeedsUpdate=true;rack.wakeUp();world.broadphase.dirty=true;
   ledger.resetWorkJ+=energy().totalJ-before;ledger.resets++;lastImpulse=null;lastFinishedStep=world.stepnumber;return drive.readout();
  },
  dispose(){if(disposed)return;disposed=true;pending=null;for(const b of owned)world.removeBody(b);},
 };
 return drive;
}
