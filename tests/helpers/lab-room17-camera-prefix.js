import * as THREE from 'three';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../../scripts/lab-headless.mjs';
import {runV8Journey} from '../../src/game/LabV8Journey.js';

/** The current ordinary-input prefix, from native Play through both sides of
 * the lower recovery turn. No world pose is staged or reset after Play.
 * The current negative control disables only the local camera policy. A
 * separately declared historical comparator restores the former authored
 * look before Play and retains its original first-walk control sequence.
 */
export async function observeRoom17CameraPrefix({aspect=16/9,disableLocalPolicy=false,aspectChanges=[],denseVertexRanges=[],historicalInitialView=false,replayInput=null}={}){
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.camera.aspect=aspect;g.camera.updateProjectionMatrix();await g.selectLevel(16,!historicalInitialView);
 const authoredView={...g.firstLevel.spawnView};
 if(historicalInitialView){
  assert.equal(g.state,'ready');assert.equal(g.physics.world.stepnumber,0);
  g.firstLevel.spawnView={yaw:.2,pitch:-.08};g.resetRun(true);
 }
 if(disableLocalPolicy)g.cameraRig.configureMechanismFraming({enabled:false});
 const original={player:g.playerGroup,cargo:g.cargo,group:g.cargo.group,body:g.physics.cargoBody,shape:g.physics.cargoBody.shapes[0],world:g.physics.world,camera:g.camera,rig:g.cameraRig},meshes=[];
 g.playerGroup.traverse(mesh=>{if(mesh.isMesh)meshes.push({mesh,geometry:mesh.geometry,position:mesh.geometry.attributes.position.array,index:mesh.geometry.index?.array,materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(material=>({material,opacity:material.opacity,transparent:material.transparent,visible:material.visible,depthWrite:material.depthWrite}))});});
 assert.equal(g.physics.world.stepnumber,0);assert.equal(g.elapsed,0);assert.deepEqual(g.playerPosition.toArray(),[-22,6,12]);assert.deepEqual(g.cargo.position.toArray(),[-18,6.57,10]);
 const report={scope:historicalInitialView?'Declared previous-presentation and previous-driver CPU control comparator; not the current native Play bearing. No WebGL or hardware evidence.':'Bounded current native-start CPU route and projection; no WebGL, hardware or exhaustive camera acceptance.',initialLook:{historicalFixture:historicalInitialView,currentAuthored:authoredView,actual:{yaw:g.yaw,pitch:g.pitch},firstMouthInspection:!historicalInitialView},aspect,aspectChanges,disableLocalPolicy,controls:[],complete:false,visualFrames:0,physicsSteps:0,resets:0,respawns:0,samples:[],meshSamples:[],playerVertices:meshes.reduce((n,m)=>n+m.mesh.geometry.attributes.position.count,0),worstReference:0,worstSourceVertex:0,minSourceDepth:Infinity,maxFov:0,maxCandidates:0,maxCenterRayError:0,maxFinalSweepDisplacement:0,maxEyeStep:0,maxRecoveryFovStep:0,maxRecoveryEyeStep:0,maxRecoveryMotionDisplacement:0,recoveryFrames:[]};
 // A closed-loop aiming driver reads the rendered camera. Running that driver
 // twice is therefore not a same-input comparison of two camera policies.
 // Record ordinary controls and actions at their original call boundaries,
 // then replay those inputs through the complete production simulation. No
 // actor, camera, physics state or solved condition is copied into the replay.
 const inputTape=[],inputState=()=>({move:g.input.getMove().toArray(),yaw:g.yaw,pitch:g.pitch,keys:[...g.input.keys].sort(),jumpQueued:g.input.jumpQueued,interactQueued:g.interactQueued});
 const end=Symbol('bounded-camera-prefix'),visual=g.updateVisuals,physics=g.updatePlaying,fire=g.firePortal,interact=g.interact,move=g.input.getMove,reset=g.resetRun,respawn=g.respawn,cargoReset=g.physics.resetCargo;
 let insidePhysics=false,replayedEvents=0;
 const remember=(type,args)=>{if(!replayInput)inputTape.push({type,args,input:inputState()});};
 g.updatePlaying=function(...args){remember('physics',args);insidePhysics=true;try{return physics.apply(this,args);}finally{insidePhysics=false;}};
 g.firePortal=function(...args){if(!insidePhysics)remember('fire',args);return fire.apply(this,args);};
 g.interact=function(...args){if(!insidePhysics)remember('interact',args);return interact.apply(this,args);};
 g.resetRun=function(){report.resets++;throw Error('Prefix reset after Play');};g.respawn=function(){report.respawns++;throw Error('Prefix respawned after Play');};g.physics.resetCargo=function(){report.resets++;throw Error('Prefix reset original cargo');};
 const point=new THREE.Vector3(),local=new THREE.Vector3();
 g.updateVisuals=function(...args){
  remember('visual',args);
  const nextFrame=report.visualFrames+1;
  const resize=aspectChanges.find(change=>change.frame===nextFrame);if(resize){this.camera.aspect=resize.aspect;this.camera.updateProjectionMatrix();}
  report.controls.push({frame:nextFrame,move:this.input.getMove().toArray(),yaw:this.yaw,pitch:this.pitch,keys:[...this.input.keys].sort()});
  const previousEye=this.camera.position.clone(),previousFov=this.camera.fov,previousWeight=this.cameraRig.room17RecoveryWeight??0;visual.apply(this,args);report.visualFrames++;
  const weight=this.cameraRig.room17RecoveryWeight??0;
  if(weight>0||previousWeight>0){
   const swept=this.camera.position.clone();this.cameraRig.constrain(previousEye,swept,Math.max(previousFov,this.camera.fov));
   const fovStep=Math.abs(this.camera.fov-previousFov),eyeStep=previousEye.distanceTo(this.camera.position),motionDisplacement=swept.distanceTo(this.camera.position);
   report.maxRecoveryFovStep=Math.max(report.maxRecoveryFovStep,fovStep);report.maxRecoveryEyeStep=Math.max(report.maxRecoveryEyeStep,eyeStep);report.maxRecoveryMotionDisplacement=Math.max(report.maxRecoveryMotionDisplacement,motionDisplacement);
   report.recoveryFrames.push({frame:report.visualFrames,weight,player:this.playerPosition.toArray(),yaw:this.yaw,pitch:this.pitch,renderYaw:this.cameraRig.yaw,renderPitch:this.cameraRig.pitch,fov:this.camera.fov,fovStep,eyeStep,motionDisplacement});
  }
  assert.equal(this.playerGroup,original.player);assert.equal(this.cargo,original.cargo);assert.equal(this.cargo.group,original.group);assert.equal(this.physics.cargoBody,original.body);assert.equal(this.physics.cargoBody.shapes[0],original.shape);assert.equal(this.physics.world,original.world);assert.equal(this.camera,original.camera);assert.equal(this.cameraRig,original.rig);
  assert.equal(this.physics.world.stepnumber,report.visualFrames*2,'Ordinary prefix must retain two real physics steps per visual frame');
  for(const m of meshes){assert.equal(m.mesh.geometry,m.geometry);assert.equal(m.geometry.attributes.position.array,m.position);assert.equal(m.geometry.index?.array,m.index);const materials=Array.isArray(m.mesh.material)?m.mesh.material:[m.mesh.material];assert.equal(materials.length,m.materials.length);for(let i=0;i<materials.length;i++){const current=materials[i],saved=m.materials[i];assert.equal(current,saved.material);for(const key of ['opacity','transparent','visible','depthWrite'])assert.equal(current[key],saved[key]);}}
  if(report.visualFrames>=1300){
   this.scene.updateMatrixWorld(true);
   const points=[0,1.32,2.8].map(y=>point.copy(this.playerPosition).add(new THREE.Vector3(0,y,0)).project(this.camera).toArray());
   const edge=Math.max(...points.flatMap(p=>[Math.abs(p[0]),Math.abs(p[1])]));report.worstReference=Math.max(report.worstReference,edge);
   const rig=this.cameraRig,swept=this.camera.position.clone();
   rig.constrain(rig.playerPivot,swept,rig.mechanismFramingActive?96:this.camera.fov);
   report.maxFinalSweepDisplacement=Math.max(report.maxFinalSweepDisplacement,swept.distanceTo(this.camera.position));
   report.maxEyeStep=Math.max(report.maxEyeStep,previousEye.distanceTo(this.camera.position));
   const center=point.copy(rig.lookPoint).project(this.camera),centerError=Math.hypot(center.x,center.y);report.maxCenterRayError=Math.max(report.maxCenterRayError,centerError);
   report.maxFov=Math.max(report.maxFov,this.camera.fov);report.maxCandidates=Math.max(report.maxCandidates,rig.mechanismStats.candidates);
   const sample={frame:report.visualFrames,worldStep:this.physics.world.stepnumber,player:this.playerPosition.toArray(),eye:this.camera.position.toArray(),quaternion:this.camera.quaternion.toArray(),lookPoint:rig.lookPoint.toArray(),points,active:rig.mechanismFramingActive,ramp:rig.rampFraming,fov:this.camera.fov,aspect:this.camera.aspect,near:this.camera.near,centerError,candidates:rig.mechanismStats.candidates};report.samples.push(sample);
   // Check every original animated player/gun vertex at the actual movie's
   // twelve-fps cadence, together with per-visual-frame body references above.
   if(report.visualFrames%5===0||denseVertexRanges.some(([a,b])=>report.visualFrames>=a&&report.visualFrames<=b)){
    let extent=0,minDepth=Infinity,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const {mesh}of meshes)for(let index=0;index<mesh.geometry.attributes.position.count;index++){
     mesh.getVertexPosition(index,point).applyMatrix4(mesh.matrixWorld);local.copy(point).applyMatrix4(this.camera.matrixWorldInverse);minDepth=Math.min(minDepth,-local.z);point.project(this.camera);extent=Math.max(extent,Math.abs(point.x),Math.abs(point.y));minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);
    }
    report.worstSourceVertex=Math.max(report.worstSourceVertex,extent);report.minSourceDepth=Math.min(report.minSourceDepth,minDepth);report.meshSamples.push({frame:report.visualFrames,extent,minDepth,bounds:{minX,maxX,minY,maxY}});
   }
  }
  if(report.visualFrames>=2000)throw end;
 };
 try{
  if(replayInput){
   assert.ok(Array.isArray(replayInput)&&replayInput.length>0,'Replay requires a captured ordinary-input prefix');
   for(const event of replayInput){
    const {type,args,input}=event;assert.ok(['physics','visual','fire','interact'].includes(type));
    g.input.getMove=()=>new THREE.Vector2(...input.move);g.input.keys=new Set(input.keys);
    g.input.jumpQueued=input.jumpQueued;g.interactQueued=input.interactQueued;g.yaw=input.yaw;g.pitch=input.pitch;
    replayedEvents++;
    if(type==='physics')g.updatePlaying(...args);else if(type==='visual')g.updateVisuals(...args);
    else if(type==='fire')g.firePortal(...args);else g.interact(...args);
   }
   assert.fail('Captured input prefix did not reach its original bounded endpoint');
  }else await runV8Journey(g,{journeyOptions:{nativeStart:true,firstMouthInspection:!historicalInitialView}});
 }catch(error){if(error!==end)throw error;report.complete=true;}
 finally{g.updateVisuals=visual;g.updatePlaying=physics;g.firePortal=fire;g.interact=interact;g.input.getMove=move;g.resetRun=reset;g.respawn=respawn;g.physics.resetCargo=cargoReset;report.inputTape=replayInput??inputTape;report.replayedEvents=replayedEvents;report.physicsSteps=g.physics.world.stepnumber;report.finalState=g.state;report.sameOriginal=g.playerGroup===original.player&&g.cargo===original.cargo&&g.physics.cargoBody===original.body&&g.physics.cargoBody.shapes[0]===original.shape;report.bodyMass=original.body.mass;report.shapeHalfExtents=[original.shape.halfExtents.x,original.shape.halfExtents.y,original.shape.halfExtents.z];g.physics.dispose();g.portals.dispose();}
 return report;
}
