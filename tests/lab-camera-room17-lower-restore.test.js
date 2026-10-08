import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {observeRoom17CameraRestore,assertRoom17RestoreVisible} from '../scripts/lib/room17-camera-restore-audit.mjs';

// Measured unchanged L ordinary journey. These are physical/timing invariants,
// not camera answers generated from the proposed view or native pixel proof.
const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/room17-lower-restore-l8d2c01e.json',import.meta.url)));
for(const expected of baseline.cases)test(`17 lower restore keeps original animated body visible, ${expected.width}x${expected.height}, swap=${expected.swapColours}`,async()=>{
 const row=await observeRoom17CameraRestore({...expected,windowFrames:360});
 assertRoom17RestoreVisible(row);
 assert.deepEqual(row.originalSkinnedRegions,{FootL:7612,FootR:7961,Body:22829,Head:19353},'Check the real production skin regions');
 const landing=row.samples.filter(s=>s.afterLanding!==null&&s.afterLanding>=0&&s.afterLanding<=180);
 assert.equal(landing.length,181);
 assert.ok(landing.every(s=>s.collisionHits.length===0),'The initial restore must avoid its actual column contraction');
 assert.ok(landing.slice(1).every((s,i)=>Math.abs(s.camera.distanceToPivot-landing[i].camera.distanceToPivot)<.12),'No abrupt lower landing zoom');
 assert.equal(row.frames,expected.frames);assert.equal(row.landingFrame,expected.landingFrame);
 assert.deepEqual(row.actions,expected.actions,'Shot and E requests retain their exact ordinary input steps');
 assert.deepEqual(row.milestones.map(({name,frame})=>({name,frame})),expected.milestones);
 assert.equal(row.physicalSequenceQuantized1e6Sha256,expected.physicalSequenceQuantized1e6Sha256,'60Hz player/cargo/beam path must remain identical at 1e-6 quantization');
 assert.equal(row.portalImpacts.length,expected.portalImpacts.length);
 for(let i=0;i<row.portalImpacts.length;i++){
  const {position,...actual}=row.portalImpacts[i],{position:original,...impact}=expected.portalImpacts[i];
  assert.deepEqual(actual,impact,'Impact step, colour, surface and sequence must remain exact');
  assert.ok(position.every((value,j)=>Math.abs(value-original[j])<=1e-12),'Impact coordinate must differ by floating-point roundoff only');
 }
});
