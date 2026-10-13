import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createTower41NativeCameraObserverApi,expandTower41NativeCameraObservation,assertTower41NativeCameraObservation,TOWER41_NATIVE_CAMERA_OBSERVER_BROWSER_FACTORY} from '../scripts/lib/tower41-native-camera-observer.mjs';

// Protocol/size fixtures only. Source numbers came from actual old baseline
// poses; eligibility/material scaffolds and repeated rows are not native proof.
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/tower41-native-camera-lossless-size.json',import.meta.url)));
const clone=x=>JSON.parse(JSON.stringify(x)),bytes=x=>Buffer.byteLength(JSON.stringify(x));
const api=createTower41NativeCameraObserverApi(fixture.pins),header=fixture.encoding;
const identity={meshes:clone(header.meshDictionary),initialAppearanceSha256:header.recordConstants.appearanceSha256,finalAppearanceSha256:header.recordConstants.appearanceSha256};
const report=()=>({kind:'size-and-codec-only-not-native-proof',sourceIdentity:fixture.pins,identity:clone(identity),config:{width:640,height:360},recordEncoding:clone(header),records:fixture.rows.map(row=>api.compactRecord(row,header))});

test('actual long-number fixture rows round-trip every number and original key order without mutation',()=>{
 for(let i=0;i<fixture.rows.length;i++){
  const row=clone(fixture.rows[i]),before=JSON.stringify(row),packed=api.compactRecord(row,header),expanded=api.expandRecord(packed,header);
  assert.equal(JSON.stringify(expanded),fixture.expectedOriginalJSON[i]);assert.equal(JSON.stringify(row),before);
  assert.deepEqual(expanded,row);assert.equal(packed.visualFrame,row.visualFrame);
  assert.deepEqual(packed.encodedBinding,row.encodedBinding);assert.equal(packed.camera.fov,row.camera.fov);
  for(const key of ['vertices','bones','insideLens','outsideLensCount','behindCount','nearCount'])assert.equal(packed.bodyVertexProjection[key],row.bodyVertexProjection[key]);
  assert.ok(bytes(packed)<bytes(row)*.75);
 }
});

test('serialized native factory and Node expansion use the identical strict lossless schema',()=>{
 const restored=(0,eval)('('+TOWER41_NATIVE_CAMERA_OBSERVER_BROWSER_FACTORY+')')(fixture.pins),raw=report(),before=JSON.stringify(raw);
 assert.deepEqual(restored.compactRecord(fixture.rows[0],header),api.compactRecord(fixture.rows[0],header));
 const expanded=expandTower41NativeCameraObservation(raw,{sourceIdentity:fixture.pins});
 assert.deepEqual(expanded.records,fixture.rows);assert.equal(JSON.stringify(raw),before);
 assert.throws(()=>assertTower41NativeCameraObservation(raw,{sourceIdentity:fixture.pins}),/actual complete native observer/);
});

const decoderMutants={
 unknownEncoding:r=>r.recordEncoding.kind='unknown',
 foreignHeaderField:r=>r.recordEncoding.extra=true,
 changedHeaderSchema:r=>r.recordEncoding.extremaTuple[0]='meshUuid',
 changedMeasuredHash:r=>r.recordEncoding.recordConstants.appearanceSha256='0'.repeat(64),
 changedBothIdentityHashes:r=>{r.identity.initialAppearanceSha256='0'.repeat(64);r.identity.finalAppearanceSha256='0'.repeat(64);},
 changedIdentityMesh:r=>r.identity.meshes[0].meshUuid='different-original-object',
 changedIdentityVertexCount:r=>r.identity.meshes[0].vertices--,
 changedStoredDictionary:r=>r.recordEncoding.meshDictionary[0].meshUuid='different-original-object',
 changedSourcePin:r=>r.recordEncoding.recordConstants.sourceCommit='0'.repeat(40),
 changedCanvas:r=>r.recordEncoding.recordConstants.nativeCanvas.width=1,
 falseLiftedPurity:r=>r.recordEncoding.recordConstants.readPurity.physicalStateUnchanged=false,
 changedScope:r=>r.recordEncoding.recordConstants.rowScope='camera accepted',
 foreignRowField:r=>r.records[0].scope='camera accepted',
 missingTupleValue:r=>r.records[0].bodyVertexProjection.extremaWitnesses.minY.pop(),
 addedTupleValue:r=>r.records[0].bodyVertexProjection.extremaWitnesses.minY.push(0),
 fractionalMeshIndex:r=>r.records[0].bodyVertexProjection.extremaWitnesses.minY[0]=.5,
 missingMeshIndex:r=>r.records[0].bodyVertexProjection.extremaWitnesses.minY[0]=4,
 negativeVertex:r=>r.records[0].bodyVertexProjection.extremaWitnesses.minY[1]=-1,
 vertexPastOriginalMesh:r=>{const t=r.records[0].bodyVertexProjection.extremaWitnesses.minY;t[1]=r.recordEncoding.meshDictionary[t[0]].vertices;},
 missingExtrema:r=>delete r.records[0].bodyVertexProjection.extremaWitnesses.minY,
 nonfiniteWorld:r=>r.records[0].bodyVertexProjection.extremaWitnesses.minY[2][0]=Infinity,
 missingNdcZ:r=>r.records[0].bodyVertexProjection.extremaWitnesses.minY[3].pop(),
 missingEligibilityBoolean:r=>r.records[0].bodyVertexProjection.renderEligibility[0].pop(),
 nonbooleanEligibility:r=>r.records[0].bodyVertexProjection.renderEligibility[0][1]=1,
 aliasEligibilityMesh:r=>r.records[0].bodyVertexProjection.renderEligibility[1][0]=0,
 duplicateLiftedBodySource:r=>r.records[0].bodyVertexProjection.source='misleading source',
 relabelledCapture:r=>r.records[0].encodedBinding.source='guessed from stride',
 splicedCaptureFrame:r=>r.records[0].encodedBinding.visualFrame++,
 terminalLabelMismatch:r=>r.records[0].windowId='actual-terminal-native-capture',
};
for(const [name,mutate]of Object.entries(decoderMutants))test('lossless decoder rejects '+name,()=>{
 const raw=report();mutate(raw);assert.throws(()=>expandTower41NativeCameraObservation(raw,{sourceIdentity:fixture.pins}));
});

test('packing never silently lifts a changed per-frame source/canvas/purity/scope or mesh identity',()=>{
 const mutations=[r=>r.sourceCommit='0'.repeat(40),r=>r.nativeCanvas.width=1,r=>r.readPurity.appearanceSha256='0'.repeat(64),r=>r.readPurity.attributeBytesUnchanged=false,r=>r.bodyVertexProjection.source='different',r=>r.bodyVertexProjection.renderEligibility[0].vertices--];
 for(const mutate of mutations){const row=clone(fixture.rows[0]);mutate(row);assert.throws(()=>api.compactRecord(row,header));}
});

test('entire conservative4600-row file with every binding,64shots,headers and five maximum-call records fits unchanged24M',()=>{
 const records=[];
 for(let index=0;index<4600;index++){
  const row=clone(fixture.rows[1]),terminal=index===4599,visualFrame=terminal?68984:index*15;
  row.visualFrame=visualFrame;row.worldStep=row.routePhysicsSteps=2*(visualFrame+1);row.worldStepOffset=0;row.routeSeconds=(visualFrame+1)/60;
  row.windowId=terminal?'actual-terminal-native-capture':'actual-native-capture';row.encodedBinding={encodedFrame:index,visualFrame,terminal,source:'actual encoder/capture event supplied by external harness'};
  for(const mesh of row.bodyVertexProjection.renderEligibility){mesh.objectVisible=false;mesh.materialVisible=false;mesh.layerMatch=false;mesh.renderEligible=false;}
  if(index<5){row.actualCameraCalls.constrainCalls=384;row.actualCameraCalls.pulledInCalls=384;row.actualCameraCalls.fitCalls=4;row.actualCameraCalls.fit=Array.from({length:4},()=>clone(row.actualCameraCalls.fit[0]));}
  records.push(api.compactRecord(row,header));
 }
 const synthetic={...report(),kind:'size-only-generated-envelope-not-native-proof',runtimeObserved:false,accepted:false,recordEncoding:header,records,encodedBindings:records.map(r=>r.encodedBinding),
  shotRequests:Array.from({length:64},()=>({explicitSizeScaffold:true,conservativeShotBytes:'x'.repeat(2000)})),conservativeHeaderSizeReserve:'x'.repeat(100000),outputJSONBytes:0};
 for(let i=0;i<3;i++)synthetic.outputJSONBytes=bytes(synthetic);
 assert.equal(synthetic.outputJSONBytes,bytes(synthetic));assert.ok(bytes(synthetic)<24000000);assert.ok(bytes(synthetic)>20000000);
 assert.throws(()=>assertTower41NativeCameraObservation(synthetic,{sourceIdentity:fixture.pins}),/actual complete native observer/);
});

test('stored complete output size is bounded before any tuple expansion',()=>{
 const raw=report();raw.actualOverLimitPayload='x'.repeat(24000000);
 assert.throws(()=>assertTower41NativeCameraObservation(raw,{sourceIdentity:fixture.pins}),/stored compact JSON exceeds24M/);
});
