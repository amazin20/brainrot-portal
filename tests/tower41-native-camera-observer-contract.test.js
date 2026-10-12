import test from 'node:test';
import assert from 'node:assert/strict';
import {createTower41NativeCameraObserverApi,TOWER41_NATIVE_CAMERA_OBSERVER_BROWSER_FACTORY} from '../scripts/lib/tower41-native-camera-observer.mjs';
const pins={sourceCommit:'a'.repeat(40),tree:'b'.repeat(40),sourceInputsSha256:'c'.repeat(64),packageFilesSha256:'d'.repeat(64),journeySha256:'e'.repeat(64),browserSeamSha256:'f'.repeat(64),sourceReview:{runId:123,runAttempt:2}};
const api=createTower41NativeCameraObserverApi(pins),config=api.normalizeOptions();
const build={commit:pins.sourceCommit,sourceInputsSha256:pins.sourceInputsSha256,packageFilesSha256:pins.packageFilesSha256};
test('native observation refuses a substituted exact source, package or attempt before reading the game',()=>{
 assert.deepEqual(api.validateIdentity(pins,build),pins);
 for(const key of ['sourceCommit','tree','sourceInputsSha256','packageFilesSha256'])assert.throws(()=>api.validateIdentity({...pins,[key]:'0'.repeat(pins[key].length)},build),/mismatch/);
 assert.throws(()=>api.validateIdentity({...pins,sourceReview:{runId:123,runAttempt:3}},build),/run\/attempt/);
 assert.throws(()=>api.validateIdentity(pins,{...build,packageFilesSha256:'0'.repeat(64)}),/package mismatch/);
 assert.throws(()=>createTower41NativeCameraObserverApi({...pins,tree:'not-a-tree'}),/Invalid actual source/);
});
test('native collector budgets include the last real off-stride terminal without truncation',()=>{
 assert.equal(config.maxFrames,90000);assert.equal(config.maxRecords,6001);assert.equal(config.stride,15);
 assert.throws(()=>api.normalizeOptions({maxRecords:6000}),/record budget/);
 assert.throws(()=>api.normalizeOptions({maxPayloadBytes:24000001}),/finite budget/);
 assert.equal(api.selectedWindow(0,config).id,'actual-native-capture');assert.equal(api.selectedWindow(1,config),null);assert.equal(api.selectedWindow(44205,config).id,'actual-native-capture');
});
test('native route clock retains exactly two physics steps except the actual final win within a visual frame',()=>{
 const first=api.advanceClock(null,{visualFrame:0,seconds:2/120,state:'playing'},12,config);
 const second=api.advanceClock(first,{visualFrame:1,seconds:4/120,state:'playing'},14,config);
 const final=api.advanceClock(second,{visualFrame:2,seconds:5/120,state:'won'},15,config);
 assert.equal(final.routePhysicsSteps,5);assert.equal(final.worldStepOffset,10);
 assert.throws(()=>api.advanceClock(second,{visualFrame:2,seconds:5/120,state:'playing'},15,config),/two real world steps/);
 assert.throws(()=>api.advanceClock(second,{visualFrame:2,seconds:6/120,state:'playing'},15,config),/omitted\/repeated/);
 assert.throws(()=>api.advanceClock(second,{visualFrame:3,seconds:6/120,state:'won'},16,config),/consecutive/);
});
test('native observer factory is self-contained and does not start or install anything on evaluation',()=>{
 const serialized=(0,eval)('('+TOWER41_NATIVE_CAMERA_OBSERVER_BROWSER_FACTORY+')');
 const restored=serialized(pins);assert.deepEqual(restored.PINS,pins);assert.equal(typeof restored.install,'function');
 assert.throws(()=>serialized(),/externally verified/);
});
test('projection counts actual behind-eye, near-plane and bottom-edge witnesses separately',()=>{
 const p=api.projectionAccumulator();
 for(const [ndc,depth]of [[[0,0,0],2],[[0,-1.01,0],2],[[0,0,0],-.1],[[0,0,-1.1],.01]])api.addProjection(p,{ndc,depth,near:.1,witness:{ndc,depth}});
 const result=api.finishProjection(p);assert.equal(result.vertices,4);assert.equal(result.outsideLensCount,3);assert.equal(result.behindCount,1);assert.equal(result.nearCount,2);assert.equal(result.extremaWitnesses.minY.ndc[1],-1.01);
});
