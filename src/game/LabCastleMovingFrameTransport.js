import {Body, Box, Constraint, Equation, Material, Quaternion, Vec3} from 'cannon-es';

const finiteVector = (v, label) => {
  if (!v || ![v.x,v.y,v.z].every(Number.isFinite)) throw new RangeError(`${label} must be finite`);
  return new Vec3(v.x,v.y,v.z);
};

/** A taut pulley has yA+yB=constant. Its nonnegative reaction pulls both
 * suspended bodies upward; slack rope cannot push either body downward. */
class PulleyEquation extends Equation {
  constructor(a,b,sumY) {
    super(a,b,0,1e6);this.sumY=sumY;
    this.jacobianElementA.spatial.set(0,1,0);
    this.jacobianElementB.spatial.set(0,1,0);
    this.setSpookParams(1e9,4,1/120);
  }
  computeB(h) {
    const error=this.bi.position.y+this.bj.position.y-this.sumY;
    return -this.a*error-this.b*this.computeGW()-h*this.computeGiMf();
  }
}
class PulleyConstraint extends Constraint {
  constructor(a,b,sumY){super(a,b,{collideConnected:false});this.equations.push(new PulleyEquation(a,b,sumY));}
  update(){}
}

/** Local small-body prototype, not a room, scene replacement or traveller.
 * The original cargo's ordinary contact is the only added driving load.
 * Bodies keep their real masses and remain dynamic through the whole stroke.
 * Stops are actual contact bodies, never a coordinate or velocity clamp. */
export function createCastleMovingEntrySupport(world,{supportMass=10,counterMass=10,
  centreY=4,halfStroke=3,supportX=-2,counterX=2,z=0}={}) {
  if (!world?.addBody || ![supportMass,counterMass,halfStroke].every(v=>Number.isFinite(v)&&v>0)
    || ![centreY,supportX,counterX,z].every(Number.isFinite))
    throw new RangeError('A world and finite positive support parameters are required');
  const material=new Material({friction:.64,restitution:0}),owned=[],add=b=>{world.addBody(b);owned.push(b);return b;};
  const moving=(mass,x,half)=>add(new Body({mass,position:new Vec3(x,centreY,z),
    shape:new Box(half),fixedRotation:true,linearFactor:new Vec3(0,1,0),
    linearDamping:0,angularDamping:0,allowSleep:false,material,
    collisionFilterGroup:1,collisionFilterMask:3}));
  const support=moving(supportMass,supportX,new Vec3(1.2,.25,1.2));
  const counter=moving(counterMass,counterX,new Vec3(.6,.25,.6));
  const constraint=new PulleyConstraint(support,counter,2*centreY);world.addConstraint(constraint);
  for(const [x,hx]of [[supportX,1.2],[counterX,.6]])for(const sign of [-1,1])
    add(new Body({mass:0,position:new Vec3(x,centreY+sign*(halfStroke+.5),z),
      shape:new Box(new Vec3(hx,.25,1.2)),material,collisionFilterGroup:1,collisionFilterMask:3}));
  let disposed=false;
  return {world,support,counter,constraint,ownedBodies:owned,centreY,halfStroke,
    sample(){
      if(disposed)throw new Error('Moving entry support is disposed');
      return {supportBodyId:support.id,counterBodyId:counter.id,
        supportPosition:support.position.toArray(),counterPosition:counter.position.toArray(),
        supportVelocity:support.velocity.toArray(),counterVelocity:counter.velocity.toArray(),
        pulleyError:support.position.y+counter.position.y-2*centreY,
        supportMass:support.mass,counterMass:counter.mass,
        bothDynamic:support.type===Body.DYNAMIC&&counter.type===Body.DYNAMIC};
    },
    dispose(){if(disposed)return;disposed=true;world.removeConstraint(constraint);for(const body of owned)world.removeBody(body);}
  };
}

/** Scoped Galilean transform. This function is not used by ordinary portals.
 * It deliberately reports only velocity mapping, not full player-system
 * energy conservation: the production player proxy has no dynamic mass. */
export function castleMovingFrameVelocity({incomingVelocity,transportRotation,
  entryBody,entryPoint,exitBody=null,exitPoint=null}) {
  if (!entryBody || entryBody.type!==Body.DYNAMIC || !(entryBody.mass>0)
    || !entryBody.world || !entryBody.world.bodies.includes(entryBody))
    throw new TypeError('Entry velocity must come from a live dynamic support');
  if(exitBody&&(!exitBody.world||exitBody.world!==entryBody.world||!exitBody.world.bodies.includes(exitBody)))
    throw new TypeError('Exit body must belong to the same live world');
  const incoming=finiteVector(incomingVelocity,'Incoming velocity'),at=finiteVector(entryPoint,'Entry point');
  const q=transportRotation;
  if(!q||![q.x,q.y,q.z,q.w].every(Number.isFinite)||Math.abs(Math.hypot(q.x,q.y,q.z,q.w)-1)>1e-7)
    throw new RangeError('A unit transport rotation is required');
  const rotation=new Quaternion(q.x,q.y,q.z,q.w);rotation.normalize();
  const entryVelocity=new Vec3();entryBody.getVelocityAtWorldPoint(at,entryVelocity);
  const exitVelocity=new Vec3();if(exitBody)exitBody.getVelocityAtWorldPoint(finiteVector(exitPoint,'Exit point'),exitVelocity);
  const output=rotation.vmult(incoming.vsub(entryVelocity)).vadd(exitVelocity);
  return {outputVelocity:output,entryVelocity,exitVelocity,
    incomingVelocity:incoming,entryBodyId:entryBody.id,exitBodyId:exitBody?.id??null,
    worldStep:entryBody.world.stepnumber,scope:'Local moving-frame velocity only; poses, default transport, and energy ownership are untouched'};
}
