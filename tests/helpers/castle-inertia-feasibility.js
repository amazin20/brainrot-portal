import * as THREE from 'three';
import {Body,Box,Constraint,Equation,HingeConstraint,Material,Quaternion,Sphere,Vec3,World} from 'cannon-es';
import {createCastleMovingEntrySupport,castleMovingFrameVelocity} from '../../src/game/LabCastleMovingFrameTransport.js';
import {makePortalFrame,portalCrossing} from '../../src/game/LabPortals.js';
import {createOrientedBoxContact,syncOrientedBoxContact,resolveCapsuleBoxMotion} from '../../src/game/LabOrientedBoxContact.js';

const C=(x=0,y=0,z=0)=>new Vec3(x,y,z),V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const G=19.5,DT=1/120,AX=-10,BX=-2.4,RADIUS=.43,HEIGHT=2.4;
class GuideEquation extends Equation{
 constructor(body,anchor,axis,target){super(body,anchor,-1e6,1e6);this.axis=axis;this.target=target;this.jacobianElementA.spatial[axis]=1;this.jacobianElementB.spatial[axis]=-1;this.setSpookParams(1e9,4,DT);}
 computeB(h){return-this.a*(this.bi.position[this.axis]-this.bj.position[this.axis]-this.target)-this.b*this.computeGW()-h*this.computeGiMf();}
}
class HorizontalGuide extends Constraint{
 constructor(body,anchor){super(body,anchor,{collideConnected:false});for(const a of ['y','z'])this.equations.push(new GuideEquation(body,anchor,a,body.position[a]-anchor.position[a]));}
 update(){}
}
const kinetic=b=>{const w=b.quaternion.conjugate().vmult(b.angularVelocity);return .5*b.mass*b.velocity.lengthSquared()+.5*(b.inertia.x*w.x*w.x+b.inertia.y*w.y*w.y+b.inertia.z*w.z*w.z);};
const energy=b=>kinetic(b)+b.mass*G*b.position.y;

/** Assetless feasibility world. Initial bodies are explicit test fixtures, not
 * ordinary game setup. Passenger remains the production mass-zero convention. */
export function createInertiaFeasibility({load='entry',camGap=.30}={}){
 const world=new World({gravity:C(0,-G,0)});world.solver.iterations=60;world.solver.tolerance=1e-10;
 const support=createCastleMovingEntrySupport(world,{centreY:5,halfStroke:6,supportX:AX,counterX:BX});
 // The room needs asymmetric travel A[-1,5], B[5,11]. Replace the standalone
 // prototype's symmetric stops with contact ears outside either cargo cup.
 for(const b of support.ownedBodies.slice(2))world.removeBody(b);
 const extra=[],constraints=[],material=new Material({friction:0,restitution:0}),add=b=>{world.addBody(b);extra.push(b);return b;};
 const fixed=(p,half)=>add(new Body({mass:0,position:C(...p),shape:new Box(C(...half)),material,collisionFilterGroup:1,collisionFilterMask:3}));
 const anchor=add(new Body({mass:0}));
 for(const body of [support.support,support.counter]){
  for(const sign of [-1,1])body.addShape(new Box(C(.2,.1,.4)),C(sign*1.6,0,0));
  body.addShape(new Box(C(.7,.1,.7)),C(0,.15,-3));
  for(const side of [-1,1])body.addShape(new Box(C(.08,.22,.7)),C(side*.76,.47,-3));
  body.addShape(new Box(C(.7,.22,.08)),C(0,.47,-3.76));
 }
 for(const [body,low,high]of [[support.support,-1,5],[support.counter,5,11]])for(const sign of [-1,1])for(const [y,up]of [[low,false],[high,true]])
  fixed([body.position.x+sign*1.6,y+(up?.35:-.35),0],[.22,.25,.5]);
 const cargo=load==='none'?null:add(new Body({mass:3.2,position:C(load==='counter'?BX:AX,5.64,-3),shape:new Box(C(.39,.39,.39)),material:new Material({friction:.64,restitution:0}),collisionFilterGroup:2,collisionFilterMask:1,linearDamping:0,angularDamping:0,allowSleep:false}));
 const pin=add(new Body({mass:1,position:C(AX-1.6,4.8,0),shape:new Box(C(.2,.1,.6)),material,fixedRotation:true,linearDamping:0,angularDamping:0,collisionFilterGroup:1,collisionFilterMask:1}));
 const pinGuide=new HorizontalGuide(pin,anchor);world.addConstraint(pinGuide);constraints.push(pinGuide);
 fixed([AX-2.5,4.8,0],[.1,.25,.7]);
 const door=add(new Body({mass:1.2,position:C(AX,8.8,0),material:new Material({friction:.45,restitution:0}),linearDamping:0,angularDamping:.01,collisionFilterGroup:1,collisionFilterMask:1}));
 door.addShape(new Box(C(.7,.1,.7)));door.addShape(new Box(C(.15,.1,.2)),C(.6,0,2.5));
 const hinge=new HingeConstraint(door,anchor,{pivotA:C(-.7,0,0),pivotB:C(AX-.7,8.8,0),axisA:C(0,0,1),axisB:C(0,0,1),collideConnected:false,maxForce:1e6});world.addConstraint(hinge);constraints.push(hinge);
 const pivot=C(AX+.6,8.1,2.5),q=new Quaternion();q.setFromAxisAngle(C(0,0,1),.05);
 const pawl=add(new Body({mass:.12,position:pivot.vadd(q.vmult(C(0,.2,0))),quaternion:q,shape:new Box(C(.05,.2,.15)),material,linearDamping:0,angularDamping:.01,collisionFilterGroup:1,collisionFilterMask:1}));
 pawl.addShape(new Sphere(.1),C(0,.3,0));
 pawl.addShape(new Box(C(.06,.45,.15)),C(.9,.55,0));
 pawl.addShape(new Box(C(.5,.06,.15)),C(.45,1.0,0));
 pawl.addShape(new Box(C(.12,.08,.2)),C(.9,1.0,0));
 pawl.addShape(new Box(C(.05,.12,.5)),C(0,0,.5));
 const pawlHinge=new HingeConstraint(pawl,anchor,{pivotA:C(0,-.2,0),pivotB:pivot,axisA:C(0,0,1),axisB:C(0,0,1),collideConnected:false,maxForce:1e6});world.addConstraint(pawlHinge);constraints.push(pawlHinge);
 fixed([pivot.x-.11,8.3,3.4],[.04,.13,.2]);
 // A finite 45-degree cam is an actual shape of A, never an arrival callback.
 const camQ=new Quaternion();camQ.setFromAxisAngle(C(0,0,1),Math.PI/4);
 const camHalf=C(.5,.12,.24),camBottomExtent=(camHalf.x+camHalf.y)*Math.SQRT1_2;
 support.support.addShape(new Box(camHalf),C(1.6,9.30+camGap+camBottomExtent-5,2.5),camQ);
 const moving=[support.support,support.counter,...extra.filter(b=>b.mass>0)];
 const doorBox=createOrientedBoxContact(door,V(.7,.1,.7),V(),0);
 let released=false,handJ=0;
 const sample=()=>({step:world.stepnumber,A:support.support.position.toArray(),B:support.counter.position.toArray(),vA:support.support.velocity.toArray(),vB:support.counter.velocity.toArray(),cargo:cargo?.position.toArray(),doorAngle:2*Math.atan2(door.quaternion.z,door.quaternion.w),pawlAngle:2*Math.atan2(pawl.quaternion.z,pawl.quaternion.w),pin:pin.position.toArray(),pinVelocity:pin.velocity.toArray(),energy:moving.reduce((s,b)=>s+energy(b),0),handJ});
 return{world,...support,cargo,pin,door,pawl,doorBox,moving,extra,constraints,sample,
  release(){if(released)return;released=true;const before=kinetic(pin);pin.applyImpulse(C(-1.2,0,0));handJ+=kinetic(pin)-before;},
  step(){world.step(DT);syncOrientedBoxContact(doorBox,door,world.stepnumber);},
  dispose(){for(const c of constraints)world.removeConstraint(c);for(const b of extra)world.removeBody(b);support.dispose();}
 };
}

export function probeInertiaMechanism(options={}){
 const f=createInertiaFeasibility(options),rows=[];let maxEnergy=-Infinity,initial;
 for(let i=0;i<120;i++)f.step();initial=f.sample();f.release();
 for(let i=0;i<600;i++){
  f.step();maxEnergy=Math.max(maxEnergy,f.sample().energy);if(i%12===0)rows.push(f.sample());
 }
 const result={initial,rows,maxEnergy,final:f.sample()};f.dispose();return result;
}
