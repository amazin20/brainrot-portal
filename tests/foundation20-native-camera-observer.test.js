import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Matrix4} from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {foundation20PhysicalSample} from '../src/game/LabFoundation20PhysicalJourney.js';
import {createNativePortalMaterialIdentityGuard} from '../scripts/lib/native-portal-material-identity.mjs';
import {createFoundation20NativeCameraObserverApi,FOUNDATION20_NATIVE_CAMERA_OBSERVER_BROWSER_FACTORY} from '../scripts/lib/foundation20-native-camera-observer.mjs';
import {assertFoundation20NativeCameraObservation,expandFoundation20NativeCameraObservation} from '../scripts/lib/foundation20-native-camera-proof.mjs';
const pins={sourceCommit:'a'.repeat(40),tree:'b'.repeat(40),sourceInputsSha256:'c'.repeat(64),packageFilesSha256:'d'.repeat(64),journeySha256:'e'.repeat(64),browserSeamSha256:'f'.repeat(64),cameraObserverSha256:'1'.repeat(64),cameraProofSha256:'2'.repeat(64),sourceReview:{runId:123,runAttempt:2}};
const build={commit:pins.sourceCommit,sourceInputsSha256:pins.sourceInputsSha256,packageFilesSha256:pins.packageFilesSha256};
const api=createFoundation20NativeCameraObserverApi(pins),copy=x=>JSON.parse(JSON.stringify(x));

// These fixtures use the real original game/physics/96753-vertex/15-bone skin,
// with an explicitly fake renderer/context for API/purity tests. They are NOT
// native evidence, a film, a complete route or a source acceptance receipt.
async function setup(beforeInstall=()=>{}){
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(19,true);
 const context={isContextLost:()=>false};g.renderer={explicitProtocolFixtureNotNative:true,isWebGLRenderer:true,getContext:()=>context,domElement:{width:640,height:360},info:{render:{frame:0}}};
 beforeInstall(g);
 const observer=await api.install({game:g,sourceIdentity:pins,buildInfo:build,materialGuardFactory:createNativePortalMaterialIdentityGuard});
 const prepareFixture=()=>{g.scene.updateMatrixWorld(true);g.camera.updateWorldMatrix(true,false);g.playerVisual.traverse(n=>{if(n.skeleton)n.skeleton.update();});g.renderer.info.render.frame++;};
 const step=()=>{g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,1);prepareFixture();const state={...foundation20PhysicalSample(g),visualFrame:0,frame:0,seconds:2/120};observer.observeFrame(state);return state;};
 const close=()=>{g.firstLevel?.dispose();g.physics?.dispose();g.portals?.dispose();};
 return {g,observer,prepareFixture,step,close};
}
let actualRow,encoding;
test('real original mutable-state fixture reads all vertices/bones without updating cached production state',async()=>{
 const f=await setup();try{const state=f.step(),before=JSON.stringify({camera:f.g.camera.toJSON(),player:f.g.playerPosition.toArray(),body:f.g.physics.cargoBody.position.toArray(),step:f.g.physics.world.stepnumber});
 const originals=[];for(const [obj,name]of [[f.g.scene,'updateMatrixWorld'],[f.g.camera,'updateWorldMatrix'],[f.g.camera,'updateMatrixWorld'],...(()=>{const s=new Set();f.g.playerVisual.traverse(n=>{if(n.skeleton)s.add(n.skeleton);});return [...s].map(s=>[s,'update']);})()]){originals.push([obj,name,obj[name]]);obj[name]=()=>{throw Error('Observer forced forbidden update');};}
 try{f.observer.capture({encodedFrame:0,visualFrame:0,terminal:false,state});}finally{for(const [obj,name,fn]of originals)obj[name]=fn;}
 assert.equal(JSON.stringify({camera:f.g.camera.toJSON(),player:f.g.playerPosition.toArray(),body:f.g.physics.cargoBody.position.toArray(),step:f.g.physics.world.stepnumber}),before);
 const raw=f.observer.partial();actualRow=api.expandRecord(raw.records[0],raw.recordEncoding);encoding=raw.recordEncoding;
 assert.equal(actualRow.projection.vertices,96753);assert.equal(actualRow.mainBodyProjection.vertices,69777);assert.equal(actualRow.bones.length,15);assert.equal(actualRow.readPurity.noForcedMatrixSkeletonRenderOrPhysicsUpdates,true);assert.equal(raw.accepted,false);
 }finally{f.close();}
});
test('serialized20 factory and strict lossless encoding retain every original number and field order',()=>{
 const browserApi=(0,eval)('('+FOUNDATION20_NATIVE_CAMERA_OBSERVER_BROWSER_FACTORY+')')(pins);
 const before=JSON.stringify(actualRow),compact=browserApi.compactRecord(actualRow,encoding),expanded=api.expandRecord(compact,encoding);
 assert.equal(JSON.stringify(expanded),before);assert.equal(JSON.stringify(actualRow),before);assert.deepEqual(browserApi.PINS,pins);assert.throws(()=>browserApi.validateEncoding({...encoding,kind:'tower41-lossless-native-records-v1'}));
});
test('camera diagnostic clocks reject skipped/repeated or invented terminal steps',()=>{
 const o=api.normalizeOptions(),a=api.advanceClock(null,{visualFrame:0,frame:0,seconds:2/120,state:'playing'},14,o),b=api.advanceClock(a,{visualFrame:1,seconds:4/120,state:'playing'},16,o);
 assert.equal(api.advanceClock(b,{visualFrame:2,seconds:5/120,state:'won'},17,o).worldStepOffset,12);
 for(const state of [{visualFrame:3,seconds:6/120,state:'playing'},{visualFrame:2,seconds:5/120,state:'playing'},{visualFrame:2,seconds:6.1/120,state:'playing'}])assert.throws(()=>api.advanceClock(b,state,18,o));
 assert.throws(()=>api.normalizeOptions({fps:12}));assert.throws(()=>api.normalizeOptions({maxPayloadBytes:25000001}));
});
test('codec rejects foreign schema, missing original bone/vertex identity and nonfinite lens witness',()=>{
 const mutants=[r=>r.encodedBinding.source='guessed from stride',r=>r.encodedBinding.worldStep++,r=>r.extra=true,r=>r.bones.pop(),r=>r.skinMatrices.pop(),r=>r.skinMatrices[0][1][0]=Infinity,r=>r.bones[0][0]=1,r=>r.bones[0][4][0]=Infinity,r=>r.eligibility.pop(),r=>r.eligibility[0][1]=1,r=>r.projection.extremaWitnesses.minY[0]=100,r=>r.projection.extremaWitnesses.minY[1]=96753,r=>r.projection.extremaWitnesses.minY[2][0]=Infinity];
 for(const mutate of mutants){const r=api.compactRecord(actualRow,encoding);mutate(r);assert.throws(()=>api.expandRecord(r,encoding));}
 const bad=copy(encoding);bad.constants.appearanceSha256='not-actual-sha';assert.throws(()=>api.validateEncoding(bad));assert.throws(()=>api.validateIdentity({...pins,cameraObserverSha256:'0'.repeat(64)},build));assert.throws(()=>api.validateIdentity({...pins,cameraProofSha256:'0'.repeat(64)},build));assert.throws(()=>api.validateIdentity({...pins,sourceReview:{runId:123,runAttempt:3}},build));
});
test('prepared current bone matrices and lens caches are required; observer never repairs them',async()=>{
 const f=await setup();try{const state=f.step(),skinned=[];f.g.playerVisual.traverse(n=>{if(n.skeleton)skinned.push(n);});const cache=skinned[0].skeleton.boneMatrices;
 skinned[0].skeleton.boneMatrices=null;assert.throws(()=>f.observer.capture({encodedFrame:0,visualFrame:0,terminal:false,state}),/boneMatrices unavailable/);skinned[0].skeleton.boneMatrices=cache;
 const val=cache[0];cache[0]+=1;assert.throws(()=>f.observer.capture({encodedFrame:0,visualFrame:0,terminal:false,state}),/boneMatrices contradict/);cache[0]=val;
 f.g.camera.projectionMatrixInverse.elements[0]+=1;assert.throws(()=>f.observer.capture({encodedFrame:0,visualFrame:0,terminal:false,state}),/lens inverse mismatch/);
 assert.equal(f.observer.status().records,0);
 }finally{f.close();}
});
test('removed world ownership, changed mask, replaced skin and loaded-asset references are rejected',async()=>{
 const f=await setup();try{const state=f.step(),body=f.g.physics.cargoBody;
 const mask=body.collisionFilterMask;body.collisionFilterMask=0;assert.throws(()=>f.observer.capture({encodedFrame:0,visualFrame:0,terminal:false,state}),/cargo ownership/);body.collisionFilterMask=mask;
 const originalWorld=body.world;body.world=null;assert.throws(()=>f.observer.capture({encodedFrame:0,visualFrame:0,terminal:false,state}),/cargo ownership/);body.world=originalWorld;
 const id=[...f.g.assets.keys()][0],model=f.g.assets.get(id);f.g.assets.set(id,{});assert.throws(()=>f.observer.capture({encodedFrame:0,visualFrame:0,terminal:false,state}),/loaded model membership/);f.g.assets.set(id,model);
 const skinned=[];f.g.playerVisual.traverse(n=>{if(n.skeleton)skinned.push(n);});const skeleton=skinned[0].skeleton;skinned[0].skeleton={...skeleton};assert.throws(()=>f.observer.capture({encodedFrame:0,visualFrame:0,terminal:false,state}),/geometry\/skin binding/);skinned[0].skeleton=skeleton;
 assert.equal(f.observer.status().records,0);
 }finally{f.close();}
});
for(const target of ['physical','camera','bone','rig'])test('actual mutable original '+target+' state cannot change during a vertex read',async()=>{
 let done=false;const f=await setup(g=>{let mesh;g.playerVisual.traverse(n=>{if(n.isSkinnedMesh&&!mesh)mesh=n;});const original=mesh.getVertexPosition;mesh.getVertexPosition=function(...args){const r=original.apply(this,args);if(!done){done=true;if(target==='physical')g.physics.cargoBody.position.x+=.1;if(target==='camera')g.camera.position.y+=.1;if(target==='bone')g.animator.bones.Body.position.x+=.1;if(target==='rig')g.cameraRig.focus.x+=.1;}return r;};});try{const state=f.step();assert.throws(()=>f.observer.capture({encodedFrame:0,visualFrame:0,terminal:false,state}),/read purity/);assert.equal(f.observer.status().records,0);}finally{f.close();}
});
test('the isolated runner observes only after its existing production render and defaults to unchanged ABI',()=>{
 const source=fs.readFileSync(new URL('../scripts/qa-foundation20-native.mjs',import.meta.url),'utf8');assert.match(source,/CAMERA_DIAGNOSTIC==='1'/);assert.ok(source.indexOf('g.render();materialGuard.assertMaterials();')<source.indexOf('cameraObserver?.capture('));assert.ok(source.indexOf('cameraObserver?.capture(')<source.indexOf('ctx.drawImage(g.renderer.domElement'));assert.doesNotMatch(FOUNDATION20_NATIVE_CAMERA_OBSERVER_BROWSER_FACTORY,/\.updateMatrixWorld\s*\(|\.updateWorldMatrix\s*\(|\.skeleton\.update\s*\(|\.render\s*\(|\.step\s*\(/);
});

// Repeated source numbers below are ONLY a long-number schema/size scaffold.
// Its clock, won labels, native report and telemetry are manufactured fixtures;
// none is saved or cited as an ordinary/native playthrough.
function protocolReport(samples=361,sourceRow=actualRow,sourceEncoding=encoding){
 const records=[],telemetry=[];for(let i=0;i<samples;i++){const r=copy(sourceRow),terminal=i===samples-1,vf=terminal?(samples-2)*15+7:i*15,n=2*(vf+1),state=terminal?'won':'playing';r.worldStep=r.routePhysicsSteps=n;r.worldStepOffset=0;r.routeSeconds=n/120;r.state=state;r.encodedBinding={encodedFrame:i,visualFrame:vf,driverFrame:vf,worldStep:n,routeSeconds:n/120,state,terminal,source:'actual post-render encoder capture event'};records.push(api.compactRecord(r,sourceEncoding));telemetry.push({index:i,terminal,state:{visualFrame:vf,frame:vf,worldStep:n,seconds:n/120,state,player:r.player,cargo:r.cargo}});}
 const last=telemetry.at(-1).state,frames=last.visualFrame+1;
 const observation={kind:'foundation20-native-camera-observation-v1',runtimeObserved:true,accepted:false,cameraAccepted:false,nativeOpticalAccepted:false,allRenderFramesObserved:false,pixelOcclusionAccepted:false,sourceIdentity:pins,config:api.normalizeOptions(),identity:{playerVertices:96753,bones:15,mainBodyMeshUuid:sourceEncoding.meshDictionary.find(m=>m.vertices===69777).meshUuid,meshes:sourceEncoding.meshDictionary,boneDictionary:sourceEncoding.boneDictionary,loadedAssetModels:[{id:1,rootUuid:'size-fixture'}],runtimeLoadedModelCount:1,packageRuntimeGLBCount:14,packageModelBytesExternallyPinned:true,initialAppearanceSha256:sourceEncoding.constants.appearanceSha256,finalAppearanceSha256:sourceEncoding.constants.appearanceSha256,sameOriginalActorAndSkinAndLoadedAssets:true,authoredMaterialIdentity:{pass:true}},recordEncoding:sourceEncoding,records,observedFrames:frames,driverRouteFrameCount:frames,finalLoopFrameIndex:frames-1,finalClock:{visualFrame:frames-1,worldStep:last.worldStep,worldStepOffset:0,routePhysicsSteps:last.worldStep,routeSeconds:last.seconds,state:'won'},outputJSONBytes:0,producerMeasuredOriginalVertices:true,independentIndexedSkinReconstruction:false,meshFlagEligibilityOnly:true,unsupportedClippingRefused:true,scope:api.scope};
 const nativeReport={sourceCommit:pins.sourceCommit,sourceReview:pins.sourceReview,nativePackage:{packageFilesSha256:pins.packageFilesSha256},route:{pass:true,id:'foundation-portal-tension',level:20,edition:'foundation',frames,physicsSteps:last.worldStep,seconds:last.seconds},video:{frames:samples,fps:4,stride:15,width:640,height:360,terminalSample:true,lastVisualFrame:last.visualFrame}};
 for(let i=0;i<8;i++)observation.outputJSONBytes=Buffer.byteLength(JSON.stringify(observation))+1;return {observation,nativeReport,telemetry};
}
const refreshSize=r=>{for(let i=0;i<8;i++)r.outputJSONBytes=Buffer.byteLength(JSON.stringify(r))+1;};
test('361 long-number lossless protocol records fit25M and bind every capture plus terminal without camera acceptance',()=>{
 const f=protocolReport(),v=assertFoundation20NativeCameraObservation(f.observation,{sourceIdentity:pins,nativeReport:f.nativeReport,telemetry:f.telemetry});
 assert.equal(v.samples,361);assert.equal(v.cameraAccepted,false);assert.ok(f.observation.outputJSONBytes<25000000);assert.equal(expandFoundation20NativeCameraObservation(f.observation,{sourceIdentity:pins}).records.length,361);
});
for(const [label,mutate]of Object.entries({
 wrongRoom:r=>r.kind='tower41-native-camera-observation-v1',
 falseAcceptance:r=>r.cameraAccepted=true,
 omittedCapture:r=>r.records.pop(),
 splicedBinding:r=>r.records[1].encodedBinding.visualFrame++,
 splicedWorld:r=>r.records[1].worldStep++,
 spoofedState:r=>r.records[1].encodedBinding.state='won',
 missingFinalClock:r=>r.finalClock.visualFrame--,
 falseScope:r=>r.scope='Actual Foundation20 encoded native capture proves every-render-frame, pixel occlusion, full-room and human camera acceptance.',
 wrongRoomScope:r=>r.scope='Actual Foundation20 encoded native capture proves native Tower41 room camera acceptance.',
 falseFinalWorldStep:r=>r.finalClock.worldStep++,
 falseFinalState:r=>r.finalClock.state='playing',
 extraFinalClockField:r=>r.finalClock.inferred=true,
 substitutedAppearance:r=>r.identity.finalAppearanceSha256='0'.repeat(64),
 substitutedLens:r=>r.records[1].camera.projectionInverse[0]+=1,
 substitutedFov:r=>r.records[1].camera.fov+=1,
 missingModel:r=>r.identity.runtimeLoadedModelCount++,
}))test('whole-file protocol rejects '+label,()=>{
 const f=protocolReport(3);mutate(f.observation);refreshSize(f.observation);assert.throws(()=>assertFoundation20NativeCameraObservation(f.observation,{sourceIdentity:pins,nativeReport:f.nativeReport,telemetry:f.telemetry}));
});
test('oversized whole file and source/capture receipts cannot pass bounded diagnostic validation',()=>{
 const f=protocolReport(3);assert.throws(()=>assertFoundation20NativeCameraObservation(f.observation,{sourceIdentity:{...pins,tree:'0'.repeat(40)},nativeReport:f.nativeReport,telemetry:f.telemetry}));
 f.observation.extraUnbounded='x'.repeat(25000000);refreshSize(f.observation);assert.throws(()=>assertFoundation20NativeCameraObservation(f.observation,{sourceIdentity:pins,nativeReport:f.nativeReport,telemetry:f.telemetry}),/exceeds25M/);
});
test('literal oldR4 captures keep actualoffset24 and terminal5392 distinct from driverCOUNT5393',()=>{
 // Clock regression only, read from the immutable oldR4 native telemetry.
 // It provides no new-camera projection, pixel or native execution evidence.
 const rows=new Map([[0,{step:26,seconds:2/120}],[3075,{step:6176,seconds:6152/120}],[5385,{step:10796,seconds:10772/120}],[5392,{step:10810,seconds:10786/120}]]),options=api.normalizeOptions();let clock=null;
 for(let vf=0;vf<5393;vf++){const n=2*(vf+1);clock=api.advanceClock(clock,{visualFrame:vf,frame:vf,seconds:n/120,state:vf===5392?'won':'playing'},24+n,options);if(rows.has(vf)){assert.equal(clock.worldStep,rows.get(vf).step);assert.equal(clock.routeSeconds,rows.get(vf).seconds);assert.equal(clock.worldStepOffset,24);}}
 assert.equal(clock.visualFrame,5392);assert.equal(clock.visualFrame+1,5393);assert.equal(clock.routePhysicsSteps,10786);
});
test('actual Three library padded GPU bone texture is read unchanged with all256 current entries',async()=>{
 const f=await setup();try{const state=f.step();let skinned;f.g.playerVisual.traverse(n=>{if(n.skeleton&&!skinned)skinned=n;});
 // Fixture preparation models WebGLRenderer's own normal cache allocation;
 // the observer never calls this method or repairs either matrix/cache.
 skinned.skeleton.computeBoneTexture();const cache=skinned.skeleton.boneMatrices,before=Array.from(cache);assert.equal(cache.length,256);
 f.observer.capture({encodedFrame:0,visualFrame:0,terminal:false,state});const r=api.expandRecord(f.observer.partial().records[0],f.observer.partial().recordEncoding);
 assert.deepEqual(r.skinMatrices[0].boneMatrices,before);assert.deepEqual(Array.from(cache),before);assert.equal(r.skinMatrices[0].boneMatrices.length,256);
 const bad=api.compactRecord(r,f.observer.partial().recordEncoding);bad.skinMatrices[0][1][255]=1;assert.throws(()=>api.expandRecord(bad,f.observer.partial().recordEncoding),/GPU padding/);
 }finally{f.close();}
});
test('a self-consistent extrema label cannot substitute an invented world-to-lens projection',()=>{
 const f=protocolReport(3),p=f.observation.records[1].projection;p.extremaWitnesses.minY[3][1]-=.1;p.minY-=.1;refreshSize(f.observation);
 assert.throws(()=>assertFoundation20NativeCameraObservation(f.observation,{sourceIdentity:pins,nativeReport:f.nativeReport,telemetry:f.telemetry}),/world\/lens\/NDC/);
});

for(const [name,mutate]of [
 ['player parent position',g=>g.playerGroup.position.x+=.1],
 ['cargo visual position',g=>g.cargo.visual.position.x+=.1],
 ['cargo parent quaternion',g=>g.cargo.group.quaternion.y+=.1],
 ['held-device state',g=>g.heldDevice.holsterProgress+=.1],
 ['loaded original root pose',g=>[...g.assets.values()][0].position.x+=.1],
 ['prepared skin cache reference',g=>{let mesh;g.playerVisual.traverse(n=>{if(n.skeleton&&!mesh)mesh=n;});mesh.skeleton.boneMatrices=mesh.skeleton.boneMatrices.slice();}],
 ])test('observer refuses a changed '+name+' during an original vertex read',async()=>{
 let mutated=false;const f=await setup(g=>{let mesh;g.playerVisual.traverse(n=>{if(n.isSkinnedMesh&&!mesh)mesh=n;});const original=mesh.getVertexPosition;mesh.getVertexPosition=function(...args){const value=original.apply(this,args);if(!mutated){mutated=true;mutate(g);}return value;};});
 try{const state=f.step();assert.throws(()=>f.observer.capture({encodedFrame:0,visualFrame:0,terminal:false,state}),/read purity|cache references/);assert.equal(mutated,true);assert.equal(f.observer.status().records,0);}finally{f.close();}
});

test('main clipping and authored player material planes are explicitly unsupported',async()=>{
 const f=await setup();try{const state=f.step(),plane=f.g.cameraRig.portalClipPlane.clone();plane.normal.set(0,1,0);plane.constant=-1000000;f.g.cameraRig.mainClippingPlanes.push(plane);assert.throws(()=>f.observer.capture({encodedFrame:0,visualFrame:0,terminal:false,state}),/unsupported main clipping/);assert.equal(f.observer.status().records,0);}finally{f.close();}
 const material=await setup(g=>{let mesh;g.playerVisual.traverse(n=>{if(n.isSkinnedMesh&&!mesh)mesh=n;});mesh.material.clippingPlanes=[g.cameraRig.portalClipPlane.clone()];});
 try{const state=material.step();assert.throws(()=>material.observer.capture({encodedFrame:0,visualFrame:0,terminal:false,state}),/unsupported player material clipping/);assert.equal(material.observer.status().records,0);}finally{material.close();}
});

test('measured original outside extrema cannot be turned into zero outside by changing counters',async()=>{
 const f=await setup();try{const state=f.step();f.g.camera.fov=5;f.g.camera.updateProjectionMatrix();f.observer.capture({encodedFrame:0,visualFrame:0,terminal:false,state});
 const raw=f.observer.partial(),row=api.expandRecord(raw.records[0],raw.recordEncoding);assert.ok(row.projection.minY<-1&&row.projection.outsideLensCount>0);
 const p=protocolReport(3,row,raw.recordEncoding);refreshSize(p.observation);const genuine=assertFoundation20NativeCameraObservation(p.observation,{sourceIdentity:pins,nativeReport:p.nativeReport,telemetry:p.telemetry});assert.equal(genuine.allOriginalSamplesInsideLens,false);
 for(const r of p.observation.records)for(const key of ['projection','mainBodyProjection','eligibleProjection'])if(r[key]){r[key].outsideLensCount=r[key].nearCount=r[key].behindCount=0;r[key].insideLens=true;}refreshSize(p.observation);
 assert.throws(()=>assertFoundation20NativeCameraObservation(p.observation,{sourceIdentity:pins,nativeReport:p.nativeReport,telemetry:p.telemetry}),/Zero outside/);
 }finally{f.close();}
});

for(const [name,mutate]of Object.entries({
 invertedBounds:r=>r.records[1].projection.minX=r.records[1].projection.maxX+1,
 impossibleNearCount:r=>r.records[1].projection.nearCount=1,
 impossibleOutsideCount:r=>{r.records[1].projection.outsideLensCount=1;r.records[1].projection.insideLens=false;},
 foreignMainWitness:r=>{const main=r.recordEncoding.meshDictionary.findIndex(m=>m.meshUuid===r.identity.mainBodyMeshUuid);r.records[1].mainBodyProjection.extremaWitnesses.minY[0]=main===0?1:0;r.records[1].mainBodyProjection.extremaWitnesses.minY[1]=0;},
 mainClipping:r=>r.records[1].camera.rig.clipping=[[0,1,0,-100]],
 materialClipping:r=>r.records[1].clipping.playerMaterials[0].materials[0].planes=[[0,1,0,-100]],
 nonunitLensQuaternion:r=>r.records[1].camera.quaternion[0]+=.1,
 nonunitBoneQuaternion:r=>r.records[1].bones[0][2][0]+=.1,
 missingRigVector:r=>delete r.records[1].camera.rig.vectors.playerPivot,
 missingReadPurity:r=>delete r.records[1].readPurity.preparedMatricesUnchanged,
 fakeIndependentReconstruction:r=>r.independentIndexedSkinReconstruction=true,
 offAxisCanonicalProjection:r=>{const c=r.records[1].camera;c.projection[8]=.1;c.projectionInverse=new Matrix4().fromArray(c.projection).invert().toArray();},
 coherentInverseWrongWorldPose:r=>{const c=r.records[1].camera;c.matrixWorld[0]+=.1;c.matrixWorldInverse=new Matrix4().fromArray(c.matrixWorld).invert().toArray();},
}))test('independent raw diagnostic guards reject '+name,()=>{
 const f=protocolReport(3);mutate(f.observation);refreshSize(f.observation);assert.throws(()=>assertFoundation20NativeCameraObservation(f.observation,{sourceIdentity:pins,nativeReport:f.nativeReport,telemetry:f.telemetry}));
});
