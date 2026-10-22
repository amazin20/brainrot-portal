import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabCamera} from '../src/game/LabCamera.js';
import {MECHANISM_CAMERA_OFFSETS,MECHANISM_CAMERA_BUDGET,MECHANISM_CAMERA_FOV,mechanismCameraArea} from '../src/game/LabMechanismCamera.js';
import {ROOM17_RECOVERY_CAMERA_OFFSETS,room17RecoveryCameraEnabled,room17RecoveryCameraArea,room17LegacyRecoveryCameraArea,room17RecoveryCameraWeight,room17RecoveryAspectWeight,room17RecoveryPortraitBlend,room17RecoveryCameraBlend,ROOM17_RECOVERY_FRAMING_ASPECT} from '../src/game/LabRoom17CameraPolicy.js';
import {observeRoom17CameraPrefix} from './helpers/lab-room17-camera-prefix.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
const level={id:'foundation-cable-supported-architecture',creativeEarly:17},V=(...p)=>new THREE.Vector3(...p);
const baseline=new Map();
function currentPolicyOffPrefix(aspect=16/9){if(!baseline.has(aspect))baseline.set(aspect,observeRoom17CameraPrefix({aspect,disableLocalPolicy:true}));return baseline.get(aspect);}
const losses=r=>r.samples.filter(s=>s.points.every(p=>Math.abs(p[0])>1||Math.abs(p[1])>1)).map(s=>s.frame);
function maxDelta(a,b){assert.equal(a.length,b.length);let delta=0;for(let i=0;i<a.length;i++)delta=Math.max(delta,Math.abs(a[i]-b[i]));return delta;}
function controlsEqual(a,b){
 assert.equal(a.controls.length,b.controls.length);let delta=0;
 for(let i=0;i<a.controls.length;i++){const x=a.controls[i],y=b.controls[i];assert.equal(x.frame,y.frame);assert.deepEqual(x.keys,y.keys);delta=Math.max(delta,maxDelta([...x.move,x.yaw,x.pitch],[...y.move,y.yaw,y.pitch]));}
 assert.ok(delta<1e-10,`Same ordinary control prefix changed by ${delta}`);return delta;
}
function summary(r){return {aspect:r.aspect,visual:r.visualFrames,physics:r.physicsSteps,range:[r.samples[0].frame,r.samples.at(-1).frame],worstBodyReference:r.worstReference,worstSourceVertex:r.worstSourceVertex,minSourceDepth:r.minSourceDepth,maxFov:r.maxFov,maxCandidates:r.maxCandidates,maxFinalSweepDisplacement:r.maxFinalSweepDisplacement,maxEyeStep:r.maxEyeStep,maxRecoveryFovStep:r.maxRecoveryFovStep,maxRecoveryEyeStep:r.maxRecoveryEyeStep,maxRecoveryMotionDisplacement:r.maxRecoveryMotionDisplacement,bodyLossFrames:losses(r),modeEntry:r.samples.find(s=>s.active)?.frame,modeExit:r.samples.find(s=>s.frame>1630&&!s.active)?.frame,at1630:r.samples.find(s=>s.frame===1630)};}


test('room17 recovery framing is confined to the measured recovery incline and lower rear turn',()=>{
 assert.equal(room17RecoveryCameraEnabled(level,16),true);
 assert.equal(mechanismCameraArea(level,16,V(-22,-10,52.2),1.6),true);
 for(const aspect of [390/844,4/3,1.599999,16/9])assert.equal(room17RecoveryCameraArea(level,16,V(-22,-10,52.2),aspect),true);
 for(const aspect of [0,-1,NaN,Infinity])assert.equal(room17RecoveryCameraArea(level,16,V(-22,-10,52.2),aspect),false);
 assert.equal(ROOM17_RECOVERY_FRAMING_ASPECT,.45);for(const [z,blend]of [[29,0],[30,0],[38,.5],[46,1],[54,1]])assert.equal(room17RecoveryCameraBlend(V(-22,-10,z)),blend);
 assert.equal(room17RecoveryCameraWeight(V(-22,-10,52.2),.45,-.08),1);
 for(const [yaw,pitch]of [[.2,-.08],[-Math.PI*.75,.35],[Math.PI,.35],[.45,-.7],[.45,.6],[NaN,0]])assert.equal(room17RecoveryCameraWeight(V(-22,-10,52.2),yaw,pitch),0);
 for(const p of [V(-29.5,-10,52),V(-16,-10,52),V(-22,-10,20),V(-22,-10,54),V(-22,-10.5,52),V(-22,6.5,52)])assert.equal(room17RecoveryCameraWeight(p,.45,-.08),0);
 for(const aspect of [16/9,1.6,NaN,Infinity,0])assert.equal(room17RecoveryAspectWeight(aspect),0);
 assert.equal(room17RecoveryAspectWeight(4/3),1);assert.equal(room17RecoveryAspectWeight(390/844),1);assert.equal(room17RecoveryPortraitBlend(4/3),0);assert.equal(room17RecoveryPortraitBlend(390/844),1);
 assert.equal(room17LegacyRecoveryCameraArea(V(-22,-10,52),16/9),true);assert.equal(room17LegacyRecoveryCameraArea(V(-22,-10,52),4/3),false);assert.equal(room17LegacyRecoveryCameraArea(V(-22,-10,40),16/9),false);
 assert.equal(room17RecoveryCameraEnabled(level,16),true,'Level opt-in must remain independent of the initial aspect');
 for(let index=0;index<51;index++)if(index!==16)assert.equal(room17RecoveryCameraEnabled(level,index),false);
 for(const p of [V(-30,-10,52),V(-15.9,-10,52),V(-22,-10,19.9),V(-22,-10,54.1),V(-22,-10.6,52),V(-22,6.6,52),V(0,6,0)])assert.equal(room17RecoveryCameraArea(level,16,p),false);
 assert.equal(room17RecoveryCameraEnabled({...level,id:'different'},16),false);assert.equal(room17RecoveryCameraEnabled({...level,creativeEarly:undefined},16),false);
 assert.equal(mechanismCameraArea({id:'opposed-shadows',state:{optical:{machine:{}}}},24,V(),390/844),true);
 const room={b:{x0:10,x1:30,z0:-20,z1:0},def:{at:[20,18,-10],h:22}},castle={singularity:true,rooms:new Map([['pendulum',room]]),machines:new Map([['pendulum',{state:{upperCell:{deckPart:{mesh:{position:V(27,24,-10)},half:V(6,.2,2)}}}}]])};
 assert.equal(mechanismCameraArea(castle,40,V(20,18,-10),390/844),true);assert.equal(mechanismCameraArea(castle,40,V(9,18,-10)),false);
});

test('only the two frozen twelve-recipe configurations are accepted',()=>{
 const rig=new LabCamera({camera:new THREE.PerspectiveCamera(62,16/9,.1,180)});
 assert.equal(rig.mechanismOffsets,MECHANISM_CAMERA_OFFSETS);
 assert.deepEqual(MECHANISM_CAMERA_OFFSETS,[6.5,8].flatMap(rear=>[3,-3].flatMap(side=>[0,1.8,3.2].map(rise=>({rear,side,rise})))));
 assert.equal(ROOM17_RECOVERY_CAMERA_OFFSETS.length,MECHANISM_CAMERA_BUDGET);assert.equal(Object.isFrozen(ROOM17_RECOVERY_CAMERA_OFFSETS),true);
 for(const p of ROOM17_RECOVERY_CAMERA_OFFSETS){assert.equal(Object.isFrozen(p),true);assert.ok([p.rear,p.side,p.rise].every(Number.isFinite));assert.ok([3.5,4.5].includes(p.rear)&&Math.abs(p.side)===8&&[11,13].includes(p.recoveryRear)&&p.recoverySide===22.5&&p.rise>=0&&p.rise<=3.2);}
 for(const offsets of [null,[],[...ROOM17_RECOVERY_CAMERA_OFFSETS],[...ROOM17_RECOVERY_CAMERA_OFFSETS,{rear:3,side:8,rise:0}],[{rear:Infinity,side:8,rise:0}],new Array(12)])assert.throws(()=>rig.configureMechanismFraming({enabled:true,offsets}),/two frozen twelve/);
 assert.equal(rig.mechanismOffsets,MECHANISM_CAMERA_OFFSETS);rig.configureMechanismFraming({enabled:true,offsets:ROOM17_RECOVERY_CAMERA_OFFSETS});assert.equal(rig.mechanismOffsets,ROOM17_RECOVERY_CAMERA_OFFSETS);rig.configureMechanismFraming({enabled:true});assert.equal(rig.mechanismOffsets,MECHANISM_CAMERA_OFFSETS);
});

test('leaving the local turn and resetting the camera discard local escape and lens state',()=>{
 const rig=new LabCamera({camera:new THREE.PerspectiveCamera(62,16/9,.1,180)});
 rig.configureMechanismFraming({enabled:true,offsets:ROOM17_RECOVERY_CAMERA_OFFSETS});rig.reset(V(-22,-10,52.2),0,0);
 for(const action of [()=>rig.update({dt:1/60,target:V(-22,-10,19.9),yaw:0,pitch:0,mechanismFraming:false}),()=>rig.reset(V(-22,-10,52.2),0,0)]){
  rig.mechanismEscape=ROOM17_RECOVERY_CAMERA_OFFSETS[0];rig.mechanismLensGoal=90;rig.mechanismHadObstruction=true;action();
  assert.equal(rig.mechanismEscape,null);assert.equal(rig.mechanismLensGoal,0);assert.equal(rig.mechanismHadObstruction,false);
 }
});

test('disabled and zero-time local camera updates do not arm transport recovery',()=>{
 const rig=new LabCamera({camera:new THREE.PerspectiveCamera(62,390/844,.1,180)}),target=V(-22,-10,52.2);
 rig.configureMechanismFraming({enabled:true,offsets:ROOM17_RECOVERY_CAMERA_OFFSETS});rig.reset(target,.45,-.08);
 assert.equal(rig.room17RecoveryTransportHold,0);assert.equal(rig.room17RecoveryWeight,0);
 rig.update({dt:0,target,yaw:.45,pitch:-.08,mechanismFraming:true});assert.equal(rig.room17RecoveryTransportHold,0);
 rig.update({dt:1/60,target,yaw:.45,pitch:-.08,mechanismFraming:true});assert.equal(rig.room17RecoveryTransportHold,.75);
 rig.configureMechanismFraming({enabled:false,offsets:ROOM17_RECOVERY_CAMERA_OFFSETS});rig.update({dt:1/60,target,yaw:.45,pitch:-.08,mechanismFraming:true});
 assert.equal(rig.mechanismFramingActive,false);assert.equal(rig.room17RecoveryWeight,0);assert.equal(rig.room17RecoveryTransportHold,0);
 rig.reset(target,.45,-.08);assert.equal(rig.room17RecoveryTransportHold,0);
});

test('unaffected actual rooms keep their original camera configuration',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';
 try{await g.selectLevel(16,false);assert.equal(g.cameraRig.mechanismOffsets,ROOM17_RECOVERY_CAMERA_OFFSETS);assert.equal(g.cameraRig.mechanismFramingEnabled,true);for(const number of [11,12,15,16,18,19,20,25,41]){await g.selectLevel(number-1,false);assert.equal(g.cameraRig.mechanismOffsets,MECHANISM_CAMERA_OFFSETS);assert.equal(g.cameraRig.mechanismFramingEnabled,[25,41].includes(number));if(number===20){assert.equal(g.cameraRig.foundation20Framing,true);assert.equal(g.cameraRig.fullBodyFraming,true);}}}
 finally{g.physics.dispose();g.portals.dispose();}
});

test('the declared historical initial look and driver retain the exact former missing-body witness',async()=>{
 const r=await observeRoom17CameraPrefix({disableLocalPolicy:true,historicalInitialView:true});assert.equal(r.complete,true);assert.equal(r.resets+r.respawns,0);assert.equal(r.sameOriginal,true);
 assert.deepEqual(r.initialLook,{historicalFixture:true,currentAuthored:{yaw:-.60,pitch:-.08},actual:{yaw:.2,pitch:-.08},firstMouthInspection:false});
 const loss=r.samples.find(s=>s.frame===1630);assert.ok(loss.points[1][1]<-2.8);assert.ok(Math.abs(loss.eye[1]-(-3.2042825912498936))<1e-8);assert.ok(r.worstSourceVertex>1);assert.equal(r.physicsSteps,r.visualFrames*2);
});

for(const aspect of [16/9,1.6,4/3,390/844])test(`room17 ordinary recovery turn keeps original animated geometry visible at aspect${aspect}`,async t=>{
 const r=await observeRoom17CameraPrefix({aspect});assert.equal(r.complete,true);assert.equal(r.sameOriginal,true);assert.equal(r.resets+r.respawns,0);assert.equal(r.physicsSteps,r.visualFrames*2);assert.equal(r.finalState,'playing');assert.equal(r.playerVertices,96753);assert.equal(r.bodyMass,3.2);assert.deepEqual(r.shapeHalfExtents,[.39,.39,.39]);
 assert.ok(r.worstReference<.95,JSON.stringify(r.samples.filter(s=>s.points.some(p=>Math.abs(p[0])>=.95||Math.abs(p[1])>=.95))));
 assert.ok(r.worstSourceVertex<1,JSON.stringify(r.meshSamples.filter(s=>s.extent>=1)));assert.ok(r.minSourceDepth>.1);assert.ok(r.maxCenterRayError<1e-10);assert.ok(r.maxFov<=MECHANISM_CAMERA_FOV);assert.ok(r.maxCandidates<=MECHANISM_CAMERA_BUDGET);assert.ok(r.maxFinalSweepDisplacement<1e-8);assert.ok(r.maxRecoveryMotionDisplacement<1e-8);assert.ok(r.maxRecoveryFovStep<2);assert.ok(r.maxRecoveryEyeStep<1,`Camera moved ${r.maxRecoveryEyeStep}m in one new-policy visual update`);
 assert.ok(r.samples.some(s=>s.active));
 const before=await currentPolicyOffPrefix(aspect);assert.deepEqual(r.initialLook,{historicalFixture:false,currentAuthored:{yaw:-.60,pitch:-.08},actual:{yaw:-.60,pitch:-.08},firstMouthInspection:true});assert.deepEqual(before.initialLook,r.initialLook);const controlDelta=controlsEqual(r,before);assert.equal(r.samples.length,before.samples.length);for(let i=0;i<r.samples.length;i++)assert.ok(maxDelta(r.samples[i].player,before.samples[i].player)<1e-10);
 t.diagnostic(JSON.stringify({after:summary(r),before:summary(before),controlDelta}));
});

function intervals(frames){const out=[];for(const frame of frames){const last=out.at(-1);if(last&&frame===last[1]+1)last[1]=frame;else out.push([frame,frame]);}return out.map(([first,last])=>({first,last,frames:last-first+1,seconds:(last-first+1)/60}));}
for(const [label,aspect,aspectChanges]of [
 ['landscape to portrait and back',16/9,[{frame:1600,aspect:390/844},{frame:1700,aspect:16/9}]],
 ['phone landscape to portrait and back',844/390,[{frame:1600,aspect:390/844},{frame:1700,aspect:844/390}]],
 ['portrait to 4:3 and back',390/844,[{frame:1600,aspect:4/3},{frame:1700,aspect:390/844}]],
])test(`an ordinary in-zone orientation cycle ${label} has bounded measured recovery`,async t=>{
 const before=await observeRoom17CameraPrefix({aspect,disableLocalPolicy:true,aspectChanges}),after=await observeRoom17CameraPrefix({aspect,aspectChanges,denseVertexRanges:[[1590,1750]]});
 assert.equal(after.complete,true);assert.equal(after.sameOriginal,true);assert.equal(after.resets+after.respawns,0);assert.equal(after.visualFrames,2000);assert.equal(after.physicsSteps,4000);controlsEqual(before,after);
 assert.equal(after.playerVertices,96753);assert.ok(after.minSourceDepth>.1);assert.ok(after.maxFov<=MECHANISM_CAMERA_FOV);assert.ok(after.maxCandidates<=MECHANISM_CAMERA_BUDGET);assert.ok(after.maxFinalSweepDisplacement<1e-8);assert.ok(after.maxRecoveryMotionDisplacement<1e-8);assert.ok(after.maxCenterRayError<1e-10);
 const transitionWitnesses=aspectChanges.map(({frame})=>{
  const sample=after.samples.find(s=>s.frame===frame);assert.ok(sample);
  assert.equal(sample.active,true,'Viewport change must exercise the actual local recovery camera');
  assert.equal(room17RecoveryCameraArea(level,16,V(...sample.player),sample.aspect),true,
   'Viewport change must remain inside the measured physical recovery turn');
  return{frame,player:sample.player,active:sample.active,aspect:sample.aspect};
 });
 const inRecovery=frame=>frame>=1600&&frame<1650||frame>=1700&&frame<1750,bodyLoss=losses(after),vertexClips=after.meshSamples.filter(s=>s.extent>=1).map(s=>s.frame);
 assert.ok(bodyLoss.every(inRecovery),JSON.stringify(intervals(bodyLoss)));assert.ok(vertexClips.every(inRecovery),JSON.stringify(intervals(vertexClips)));
 for(let frame=1590;frame<=1750;frame++)assert.ok(after.meshSamples.some(s=>s.frame===frame),`No dense original-vertex projection for transition frame ${frame}`);
 const sampleByFrame=new Map(after.samples.map(s=>[s.frame,s]));let previousAspect=aspect;
 for(let index=0;index<aspectChanges.length;index++){
  const change=aspectChanges[index],end=aspectChanges[index+1]?.frame??after.visualFrames+1;
  if(change.aspect>previousAspect){
   // Include the release tail after the local policy turns off. Its last
   // shoulder or lens reset must not defer the snap until outside that mode.
   const widening=after.samples.filter(s=>s.frame>=change.frame&&s.frame<end).map(s=>{
    const previous=sampleByFrame.get(s.frame-1);assert.ok(previous,'No previous live eye for the widening transition');
    return {eyeStep:Math.hypot(...s.eye.map((value,index)=>value-previous.eye[index])),fovStep:Math.abs(s.fov-previous.fov)};
   });
   assert.ok(widening.length>0,'No measured recovery frames after viewport widening');
   assert.ok(widening.every(s=>s.eyeStep<1),`Viewport widening snapped the live eye: ${Math.max(...widening.map(s=>s.eyeStep))}m`);
   assert.ok(widening.every(s=>s.fovStep<2),`Viewport widening snapped the lens: ${Math.max(...widening.map(s=>s.fovStep))} degrees`);
  }
  previousAspect=change.aspect;
 }
 t.diagnostic(JSON.stringify({after:summary(after),before:summary(before),transitionWitnesses,bodyLossIntervals:intervals(bodyLoss),vertexClipIntervals:intervals(vertexClips)}));
});

test('room17 viewport release freezes with zero time and resets with a new scene',()=>{
 const camera=new THREE.PerspectiveCamera(62,390/844,.1,180),rig=new LabCamera({camera}),target=V(-22,-10,52.2);
 rig.configureMechanismFraming({enabled:true,offsets:ROOM17_RECOVERY_CAMERA_OFFSETS});rig.reset(target,.45,-.08);
 for(let n=0;n<120;n++)rig.update({dt:1/60,target,yaw:.45,pitch:-.08,mechanismFraming:true});
 const portraitAspect=rig.room17RecoveryLayoutAspect,eye=camera.position.clone(),fov=camera.fov;
 camera.aspect=16/9;camera.updateProjectionMatrix();rig.update({dt:0,target,yaw:.45,pitch:-.08,mechanismFraming:true});
 assert.equal(rig.room17RecoveryLayoutAspect,portraitAspect);assert.ok(camera.position.distanceTo(eye)<1e-8);assert.equal(camera.fov,fov);
 rig.update({dt:1/60,target,yaw:.45,pitch:-.08,mechanismFraming:true});
 assert.ok(rig.room17RecoveryLayoutAspect>portraitAspect&&rig.room17RecoveryLayoutAspect<camera.aspect);
 camera.aspect=360/800;camera.updateProjectionMatrix();rig.update({dt:1/60,target,yaw:.45,pitch:-.08,mechanismFraming:true});
 assert.equal(rig.room17RecoveryLayoutAspect,camera.aspect,'A narrower viewport must be used on its first live frame');
 camera.aspect=16/9;camera.updateProjectionMatrix();rig.reset(target,.45,-.08);assert.equal(rig.room17RecoveryLayoutAspect,camera.aspect);
});
