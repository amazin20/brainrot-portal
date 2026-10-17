import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabCamera} from '../src/game/LabCamera.js';
import {MECHANISM_CAMERA_OFFSETS,MECHANISM_CAMERA_BUDGET,MECHANISM_CAMERA_FOV,mechanismCameraArea} from '../src/game/LabMechanismCamera.js';
import {ROOM17_RECOVERY_CAMERA_OFFSETS,room17RecoveryCameraEnabled,room17RecoveryCameraArea} from '../src/game/LabRoom17CameraPolicy.js';
import {observeRoom17CameraPrefix} from './helpers/lab-room17-camera-prefix.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
const level={id:'foundation-cable-supported-architecture',creativeEarly:17},V=(...p)=>new THREE.Vector3(...p);
const baseline=new Map();
function oldPrefix(aspect=16/9){if(!baseline.has(aspect))baseline.set(aspect,observeRoom17CameraPrefix({aspect,disableLocalPolicy:true}));return baseline.get(aspect);}
const losses=r=>r.samples.filter(s=>s.points.every(p=>Math.abs(p[0])>1||Math.abs(p[1])>1)).map(s=>s.frame);
function maxDelta(a,b){assert.equal(a.length,b.length);let delta=0;for(let i=0;i<a.length;i++)delta=Math.max(delta,Math.abs(a[i]-b[i]));return delta;}
function controlsEqual(a,b){
 assert.equal(a.controls.length,b.controls.length);let delta=0;
 for(let i=0;i<a.controls.length;i++){const x=a.controls[i],y=b.controls[i];assert.equal(x.frame,y.frame);assert.deepEqual(x.keys,y.keys);delta=Math.max(delta,maxDelta([...x.move,x.yaw,x.pitch],[...y.move,y.yaw,y.pitch]));}
 assert.ok(delta<1e-10,`Same ordinary control prefix changed by ${delta}`);return delta;
}
function summary(r){return {aspect:r.aspect,visual:r.visualFrames,physics:r.physicsSteps,range:[r.samples[0].frame,r.samples.at(-1).frame],worstBodyReference:r.worstReference,worstSourceVertex:r.worstSourceVertex,minSourceDepth:r.minSourceDepth,maxFov:r.maxFov,maxCandidates:r.maxCandidates,bodyLossFrames:losses(r),modeEntry:r.samples.find(s=>s.active)?.frame,modeExit:r.samples.find(s=>s.frame>1630&&!s.active)?.frame,at1630:r.samples.find(s=>s.frame===1630)};}


test('room17 recovery framing is confined to the measured lower rear turn',()=>{
 assert.equal(room17RecoveryCameraEnabled(level,16),true);
 assert.equal(mechanismCameraArea(level,16,V(-22,-10,52.2),1.6),true);
 for(const aspect of [390/844,4/3,1.599999,NaN,Infinity])assert.equal(room17RecoveryCameraArea(level,16,V(-22,-10,52.2),aspect),false);
 assert.equal(room17RecoveryCameraEnabled(level,16),true,'Level opt-in must remain independent of the initial aspect');
 for(let index=0;index<51;index++)if(index!==16)assert.equal(room17RecoveryCameraEnabled(level,index),false);
 for(const p of [V(-30,-10,52),V(-15.9,-10,52),V(-22,-10,45.9),V(-22,-10,54.1),V(-22,-10.6,52),V(-22,-5.9,52),V(0,6,0)])assert.equal(room17RecoveryCameraArea(level,16,p),false);
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
 for(const p of ROOM17_RECOVERY_CAMERA_OFFSETS){assert.equal(Object.isFrozen(p),true);assert.ok([p.rear,p.side,p.rise].every(Number.isFinite));assert.ok(p.rear>=3.5&&p.rear<=4.5&&Math.abs(p.side)===8&&p.rise>=0&&p.rise<=3.2);}
 for(const offsets of [null,[],[...ROOM17_RECOVERY_CAMERA_OFFSETS],[...ROOM17_RECOVERY_CAMERA_OFFSETS,{rear:3,side:8,rise:0}],[{rear:Infinity,side:8,rise:0}],new Array(12)])assert.throws(()=>rig.configureMechanismFraming({enabled:true,offsets}),/two frozen twelve/);
 assert.equal(rig.mechanismOffsets,MECHANISM_CAMERA_OFFSETS);rig.configureMechanismFraming({enabled:true,offsets:ROOM17_RECOVERY_CAMERA_OFFSETS});assert.equal(rig.mechanismOffsets,ROOM17_RECOVERY_CAMERA_OFFSETS);rig.configureMechanismFraming({enabled:true});assert.equal(rig.mechanismOffsets,MECHANISM_CAMERA_OFFSETS);
});

test('leaving the local turn and resetting the camera discard local escape and lens state',()=>{
 const rig=new LabCamera({camera:new THREE.PerspectiveCamera(62,16/9,.1,180)});
 rig.configureMechanismFraming({enabled:true,offsets:ROOM17_RECOVERY_CAMERA_OFFSETS});rig.reset(V(-22,-10,52.2),0,0);
 for(const action of [()=>rig.update({dt:1/60,target:V(-22,-10,45.9),yaw:0,pitch:0,mechanismFraming:false}),()=>rig.reset(V(-22,-10,52.2),0,0)]){
  rig.mechanismEscape=ROOM17_RECOVERY_CAMERA_OFFSETS[0];rig.mechanismLensGoal=90;rig.mechanismHadObstruction=true;action();
  assert.equal(rig.mechanismEscape,null);assert.equal(rig.mechanismLensGoal,0);assert.equal(rig.mechanismHadObstruction,false);
 }
});

test('unaffected actual rooms keep their original camera configuration',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';
 try{await g.selectLevel(16,false);assert.equal(g.cameraRig.mechanismOffsets,ROOM17_RECOVERY_CAMERA_OFFSETS);assert.equal(g.cameraRig.mechanismFramingEnabled,true);for(const number of [11,12,15,16,18,19,20,25,41]){await g.selectLevel(number-1,false);assert.equal(g.cameraRig.mechanismOffsets,MECHANISM_CAMERA_OFFSETS);assert.equal(g.cameraRig.mechanismFramingEnabled,[25,41].includes(number));if(number===20){assert.equal(g.cameraRig.foundation20Framing,true);assert.equal(g.cameraRig.fullBodyFraming,true);}}}
 finally{g.physics.dispose();g.portals.dispose();}
});

test('the unchanged ordinary prefix exposes the old missing-body view when local policy is disabled',async()=>{
 const r=await oldPrefix();assert.equal(r.complete,true);assert.equal(r.resets+r.respawns,0);assert.equal(r.sameOriginal,true);
 const loss=r.samples.find(s=>s.frame===1630);assert.ok(loss.points[1][1]<-2.8);assert.ok(Math.abs(loss.eye[1]-(-3.2042825912498936))<1e-8);assert.ok(r.worstSourceVertex>1);assert.equal(r.physicsSteps,r.visualFrames*2);
});

for(const aspect of [16/9,1.6])test(`room17 ordinary landscape recovery turn keeps original animated geometry visible at aspect${aspect}`,async t=>{
 const r=await observeRoom17CameraPrefix({aspect});assert.equal(r.complete,true);assert.equal(r.sameOriginal,true);assert.equal(r.resets+r.respawns,0);assert.equal(r.physicsSteps,r.visualFrames*2);assert.equal(r.finalState,'playing');assert.equal(r.playerVertices,96753);assert.equal(r.bodyMass,3.2);assert.deepEqual(r.shapeHalfExtents,[.39,.39,.39]);
 assert.ok(r.worstReference<.95,JSON.stringify(r.samples.filter(s=>s.points.some(p=>Math.abs(p[0])>=.95||Math.abs(p[1])>=.95))));
 assert.ok(r.worstSourceVertex<1,JSON.stringify(r.meshSamples.filter(s=>s.extent>=1)));assert.ok(r.minSourceDepth>.1);assert.ok(r.maxCenterRayError<1e-10);assert.ok(r.maxFov<=MECHANISM_CAMERA_FOV);assert.ok(r.maxCandidates<=MECHANISM_CAMERA_BUDGET);
 assert.ok(r.samples.some(s=>s.active));assert.ok(r.samples.some(s=>!s.active&&s.frame<1450));assert.ok(r.samples.some(s=>!s.active&&s.frame>1900));
 const before=await oldPrefix(aspect);const controlDelta=controlsEqual(r,before);assert.equal(r.samples.length,before.samples.length);for(let i=0;i<r.samples.length;i++)assert.ok(maxDelta(r.samples[i].player,before.samples[i].player)<1e-10);
 t.diagnostic(JSON.stringify({after:summary(r),before:summary(before),controlDelta}));
});

for(const aspect of [390/844,4/3])test(`room17 narrow aspect${aspect} retains the original camera throughout the ordinary prefix`,async t=>{
 const before=await oldPrefix(aspect),after=await observeRoom17CameraPrefix({aspect});assert.equal(after.complete,true);assert.equal(after.resets+after.respawns,0);assert.equal(after.sameOriginal,true);assert.equal(after.visualFrames,2000);assert.equal(after.physicsSteps,4000);assert.equal(after.samples.some(s=>s.active),false);
 const controlDelta=controlsEqual(before,after);assert.equal(after.samples.length,before.samples.length);let cameraDelta=0,playerDelta=0;
 for(let i=0;i<after.samples.length;i++){
  const a=after.samples[i],b=before.samples[i];assert.equal(a.frame,b.frame);assert.equal(a.worldStep,b.worldStep);assert.equal(a.candidates,0);
  cameraDelta=Math.max(cameraDelta,maxDelta([...a.eye,...a.quaternion,a.fov],[...b.eye,...b.quaternion,b.fov]));playerDelta=Math.max(playerDelta,maxDelta(a.player,b.player));
 }
 assert.ok(cameraDelta<1e-10);assert.ok(playerDelta<1e-10);assert.deepEqual(losses(after),losses(before));
 t.diagnostic(JSON.stringify({after:summary(after),before:summary(before),cameraDelta,playerDelta,controlDelta}));
});

test('an ordinary in-zone orientation cycle clears the local policy without adding baseline body-loss frames',async t=>{
 const aspectChanges=[{frame:1600,aspect:390/844},{frame:1700,aspect:16/9}],before=await observeRoom17CameraPrefix({disableLocalPolicy:true,aspectChanges}),after=await observeRoom17CameraPrefix({aspectChanges});
 assert.equal(after.complete,true);assert.equal(after.sameOriginal,true);assert.equal(after.resets+after.respawns,0);assert.equal(after.visualFrames,2000);assert.equal(after.physicsSteps,4000);controlsEqual(before,after);
 assert.ok(after.samples.find(s=>s.frame===1599).active);for(const s of after.samples.filter(s=>s.frame>=1600&&s.frame<1700)){assert.equal(s.active,false);assert.equal(s.candidates,0);}
 assert.ok(after.samples.find(s=>s.frame===1700).active);assert.deepEqual(losses(after),losses(before));assert.ok(after.minSourceDepth>.1);assert.ok(after.worstSourceVertex<=before.worstSourceVertex);assert.ok(after.maxFov<=MECHANISM_CAMERA_FOV);
 t.diagnostic(JSON.stringify({after:summary(after),before:summary(before)}));
});
