import test from 'node:test';
import assert from 'node:assert/strict';
import {compareEarlyArt,NATIVE_POSE_TOLERANCE} from '../scripts/compare-early-art.mjs';

function fixture(){return {pass:true,errors:[],renderer:'Test fixture',
 routes:[{level:1,id:'two-banks',pass:true,frames:342,respawns:0,resets:0,teleports:1,
  milestones:[{name:'crossed the trench',player:[-4.3,0,-9.2490922726945],cargo:[0,.5,-11.5],teleports:1}]}],
 renderSamples:[{level:1,elapsed:5500,player:[-4.3,0,-9.2490922726945],
  camera:{position:[-4.3,2,-7],quaternion:[0,0,0,1],projection:[1,0,0,0]},
  portals:[{position:[-5.8,2.1,9]},{position:[-5.8,2.1,-9]}],passes:3,calls:220,triangles:900000}]};}
test('native comparison tolerates final-bit pose noise while retaining different rendering costs',()=>{
 const before=fixture(),after=structuredClone(before);
 after.routes[0].milestones[0].player[2]=-9.249092272694483;
 after.renderSamples[0].camera.position[1]+=3e-12;
 after.renderSamples[0].triangles=850000;after.renderSamples[0].calls=180;
 const result=compareEarlyArt(before,after);
 assert.equal(result.pass,true);assert.ok(result.maxNumericDelta>0&&result.maxNumericDelta<NATIVE_POSE_TOLERANCE);
 assert.equal(result.maxNumericDeltaPath,'renderSamples.0.camera.position.1');
 assert.equal(result.samples[0].after.triangles,850000);
});

test('native comparison rejects a real pose change and every non-finite coordinate',()=>{
 for(const value of [-4.3+1e-6,NaN,Infinity,-Infinity]){
  const before=fixture(),after=structuredClone(before);after.renderSamples[0].player[0]=value;
  assert.throws(()=>compareEarlyArt(before,after),/renderSamples\.0\.player\.0/);
 }
});

test('frame counts, route order, identities and flags remain exact',()=>{
 for(const mutate of [
  report=>report.routes[0].frames++,
  report=>report.routes[0].frames+=1e-10,
  report=>report.routes[0].milestones[0].teleports++,
  report=>report.routes[0].milestones[0].name='different event',
  report=>report.routes[0].pass=false,
  report=>report.routes[0].id='different chamber',
  report=>report.routes[0].milestones.push(report.routes[0].milestones[0]),
  report=>report.renderSamples[0].portals.pop(),
  report=>report.renderSamples[0].camera.extra=0,
 ]){
  const before=fixture(),after=structuredClone(before);mutate(after);
  assert.throws(()=>compareEarlyArt(before,after));
 }
});
