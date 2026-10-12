// Synthetic centre-ray/perspective boundary cases, not native camera evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertTower41NativeCameraObservation}from'../scripts/lib/tower41-native-camera-observer.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./helpers/tower41-camera-validator-shot-fixture.json',import.meta.url),'utf8'));
const size=o=>{for(let i=0;i<4;i++)o.outputJSONBytes=Buffer.byteLength(JSON.stringify(o));};
const clone=()=>{const f=structuredClone(fixture);size(f.observation);return f;};
test('a synthetic original world target reprojects to the request-time centre ray',()=>{const f=clone();assert.equal(assertTower41NativeCameraObservation(f.observation,f.args).pass,true);});
const mutations={
 shrinkPlayerRoot:o=>o.records[1].player.renderedScale=[.01,.01,.01],
 omitCapturedWorldTarget:o=>delete o.shotRequests[0].capturedTarget,
 omitRequestLens:o=>delete o.shotRequests[0].lens,
 omitActualCaptureRay:o=>delete o.shotRequests[0].actualCaptureRay,
 inconsistentWorldTarget:o=>o.shotRequests[0].capturedTarget=[-50,40,8],
 spliceRequestEye:o=>o.shotRequests[0].lens.eye=[500,0,0],
 inconsistentRayDirection:o=>o.shotRequests[0].actualCaptureRay.direction=[1,0,0],
 missingTargetNdcZ:o=>o.shotRequests[0].capturedTargetNdc=[0,0],
 requestClockOutsideObservedFrames:o=>o.shotRequests[0].requestWorldStep=90000,
 nonconsecutiveObservedFrames:o=>o.shotRequests[0].beforeNextVisualFrame=16,
 requestIndexContradictsInput:o=>o.shotRequests[0].lastRequestObserved.index=1,
};
for(const[name,mutate]of Object.entries(mutations))test('synthetic shot proof rejects '+name,()=>{const f=clone();mutate(f.observation);size(f.observation);assert.throws(()=>assertTower41NativeCameraObservation(f.observation,f.args));});
test('synthetic shot proof rejects an identical spliced request even when outer shot count agrees',()=>{const f=clone();f.observation.shotRequests.push(structuredClone(f.observation.shotRequests[0]));f.args.result.shots=2;size(f.observation);assert.throws(()=>assertTower41NativeCameraObservation(f.observation,f.args));});
test('actual source serials are independent for the two portal input channels',()=>{const f=clone(),second=structuredClone(f.observation.shotRequests[0]);second.inputChannel=1;second.lastRequestObserved.index=1;f.observation.shotRequests.push(second);f.args.result.shots=2;size(f.observation);assert.equal(assertTower41NativeCameraObservation(f.observation,f.args).pass,true);});
