import * as THREE from 'three';
import {Body,Box,Material,Vec3} from 'cannon-es';
import {LabPhysics} from '../../src/game/LabPhysics.js';
import {SingularityKit} from '../../src/game/LabSingularityKit.js';
import {buildRoom20NearHookPrototype} from '../../src/game/LabRoom20NearHookPrototype.js';
import {buildRoom20NearHookStrokePrototype} from '../../src/game/LabRoom20NearHookStrokePrototype.js';

export const DT=1/120;
/** Isolated solver fixture. A real sliding tray holds the original free body
 * until a finite tray impulse removes support. No body pose, motor, collision
 * response or qualifying flag is changed during a measured sequence. */
export function createHookFixture(options={}){
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[],cargo:new THREE.Object3D(),heldCube:null};
 const kit=new SingularityKit(game),cell=(options.strokeDrive?buildRoom20NearHookStrokePrototype:buildRoom20NearHookPrototype)(game,kit,options);
 game.physics=new LabPhysics();game.physics.createCargo({position:[10,5.35,0]});cell.ensure();
 const world=game.physics.world,cargo=game.physics.cargoBody;
 const tray=new Body({mass:2,position:new Vec3(10,4.86,0),linearFactor:new Vec3(1,0,0),fixedRotation:true,linearDamping:.025,allowSleep:false,material:new Material({friction:0,restitution:0}),collisionFilterGroup:1,collisionFilterMask:2});tray.addShape(new Box(new Vec3(.6,.1,.6)));world.addBody(tray);
 const trace=[],raw={bearingSteps:0,bearingImpulse:0,captureSteps:0,captureImpulse:0,maxOpening:0,maxHookAngle:0,maxBearingDepth:0,maxHingeDrift:0,forceSteps:new Set()};
 function step(count=1,{record=true,frameSteps=1}={}){for(let n=0;n<count;n+=frameSteps){cell.updateForces(DT*frameSteps);cell.updateForces(DT*frameSteps);game.physics.step(DT*frameSteps);const d=cell.diagnostics();raw.maxOpening=Math.max(raw.maxOpening,d.opening);raw.maxHookAngle=Math.max(raw.maxHookAngle,d.hookAngle);const h=cell.hinge,pa=h.bodyA.position.vadd(h.bodyA.quaternion.vmult(h.pivotA)),pb=h.bodyB.position.vadd(h.bodyB.quaternion.vmult(h.pivotB));raw.maxHingeDrift=Math.max(raw.maxHingeDrift,pa.distanceTo(pb));const gi=cell.gateParts.indexOf(cell.bearingLug),hi=cell.hookParts.indexOf(cell.bearingArm);let bearing=0,capture=0;for(const c of world.contacts){if(c.enabled===false||!(c.multiplier>1e-6))continue;const isPair=(a,sa,b,sb)=>(c.bi===a&&c.si===sa&&c.bj===b&&c.sj===sb)||(c.bi===b&&c.si===sb&&c.bj===a&&c.sj===sa);if(isPair(cell.gateBody,cell.gateBody.shapes[gi],cell.hookBody,cell.hookBody.shapes[hi])){const nx=(c.bi===cell.gateBody?-1:1)*c.ni.x;if(nx>.65){bearing+=nx*c.multiplier;const a=c.bi.position.vadd(c.ri),b=c.bj.position.vadd(c.rj);raw.maxBearingDepth=Math.max(raw.maxBearingDepth,Math.max(0,-c.ni.dot(b.vsub(a))));}}const gc=cell.gateParts.indexOf(cell.captureLug),hc=cell.hookParts.indexOf(cell.capturePost);if(isPair(cell.gateBody,cell.gateBody.shapes[gc],cell.hookBody,cell.hookBody.shapes[hc])){const nx=(c.bi===cell.gateBody?-1:1)*c.ni.x;if(nx<-.65)capture+=-nx*c.multiplier;}}
  if(bearing>0){raw.bearingSteps++;raw.bearingImpulse+=bearing*DT*frameSteps;}if(capture>0){raw.captureSteps++;raw.captureImpulse+=capture*DT*frameSteps;}if(record)trace.push({...d,rawBearingForce:bearing,rawCaptureForce:capture,trayPosition:tray.position.toArray()});
 }}
 function releaseTray(){tray.applyImpulse(new Vec3(8,0,0));tray.wakeUp();}
 function until(fn,count=1200){for(let n=0;n<count;n++){if(fn())return true;step();}return fn();}
 return{game,kit,cell,world,cargo,tray,trace,raw,step,releaseTray,until,dispose(){cell.dispose();world.removeBody(tray);kit.dispose();game.physics.dispose();}};
}
