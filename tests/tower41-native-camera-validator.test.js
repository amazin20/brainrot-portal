// Boundary tests from an independent review that reproduced validator blind
// spots. This deliberately synthetic JSON is NOT a game, native render or
// successful playthrough; only the exported Node proof validator is tested.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertTower41NativeCameraObservation} from '../scripts/lib/tower41-native-camera-observer.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./helpers/tower41-camera-validator-fixture.json',import.meta.url),'utf8'));
const copy=()=>structuredClone(fixture);
const size=observation=>{for(let i=0;i<4;i++)observation.outputJSONBytes=Buffer.byteLength(JSON.stringify(observation));};
test('pure synthetic Node fixture exercises complete regular and actual one-step terminal clock validation',()=>{
 const {observation,args}=copy();assert.equal(assertTower41NativeCameraObservation(observation,args).pass,true);
 assert.equal(observation.records.at(-1).routePhysicsSteps,61);assert.equal(observation.records.at(-1).visualFrame,30);
});
const mutations={
 outsideMinY:r=>r.records[1].bodyVertexProjection.minY=-1.4,
 invalidExtrema:r=>r.records[1].bodyVertexProjection.minDepth=NaN,
 missingWitness:r=>delete r.records[1].bodyVertexProjection.extremaWitnesses.minY,
 impossibleWitnessNdc:r=>r.records[1].bodyVertexProjection.extremaWitnesses.minY.ndc[1]=-1.4,
 worldWitnessMismatch:r=>r.records[1].bodyVertexProjection.extremaWitnesses.minY.world[1]+=.1,
 worldClockSkip:r=>r.records[1].worldStep+=7,
 routeClockSkip:r=>r.records[1].routePhysicsSteps+=7,
 clockOffsetChanged:r=>r.records[1].worldStepOffset+=1,
 sourcePinsSubstituted:r=>r.sourcePins.browserSeamSha256='0'.repeat(64),
 sourceIdentityJourneySubstituted:r=>r.sourceIdentity.journeySha256='0'.repeat(64),
 sourceIdentitySeamSubstituted:r=>r.sourceIdentity.browserSeamSha256='0'.repeat(64),
 unlimitedRecords:r=>r.config.maxRecords=900000,
 budgetExceeded:r=>r.config.maxPayloadBytes=1024,
 falseJSONBytes:r=>r.outputJSONBytes=1,
 cargoShapeChanged:r=>r.records[1].cargo.shapeId=101,
 missingRow:r=>r.records.splice(1,1),
 repeatedCapture:r=>r.encodedBindings[1].encodedFrame=0,
 tooWideFov:r=>r.records[1].camera.fov=121,
 invalidAspect:r=>r.records[1].camera.aspect=.01,
 impossibleCameraInverse:r=>r.records[1].camera.matrixWorldInverse.fill(0),
 missingPlayerPositions:r=>delete r.records[1].player,
 missingRenderEligibility:r=>delete r.records[1].bodyVertexProjection.renderEligibility,
 fullRoomAcceptanceClaim:r=>r.fullRoomAccepted=true,
 routeExceedsDeclaredFrames:r=>r.config.maxFrames=1,
 capturesExceedDeclaredRows:r=>{r.config.maxFrames=1;r.config.maxRecords=2;},
};
for(const [name,mutate]of Object.entries(mutations))test('synthetic camera proof rejects '+name,()=>{
 const {observation,args}=copy();mutate(observation);if(name!=='falseJSONBytes')size(observation);
 assert.throws(()=>assertTower41NativeCameraObservation(observation,args));
});
