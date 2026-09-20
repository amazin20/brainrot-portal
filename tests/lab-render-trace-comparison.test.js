import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRenderTraces} from '../scripts/lib/compare-render-traces.mjs';

const pose=()=>[1,2,3,4,5,6,7,8,9,10,11,12,0,0,0,1,62,3,'playing',false];
test('render trace comparison measures harmless final-bit rounding without mutating evidence',()=>{
 const a=[pose(),pose()],b=structuredClone(a);b[1][0]+=1e-13;
 const result=compareRenderTraces(a,b);
 assert.ok(result.maxAbsoluteDifference>0&&result.maxAbsoluteDifference<1.1e-13);
 assert.equal(result.maxFrame,1);assert.equal(result.maxField,0);assert.equal(result.roundedValues,1);
 assert.notEqual(a[1][0],b[1][0]);assert.equal(result.absoluteTolerance,1e-9);
});
test('render trace rejects tiny but meaningful pose changes, discrete changes and missing frames',()=>{
 const a=[pose()],b=[pose()];b[0][9]+=1e-8;
 assert.throws(()=>compareRenderTraces(a,b),/route pose changed/);
 for(const [field,value]of [[17,3+1e-13],[18,'won'],[19,true]]){
  const c=[pose()];c[0][field]=value;
  assert.throws(()=>compareRenderTraces(a,c),/discrete route state/);
 }
 assert.throws(()=>compareRenderTraces(a,[]),/same number/);
 const c=[pose()];c[0][0]=NaN;assert.throws(()=>compareRenderTraces(a,c),/finite pose/);
 assert.throws(()=>compareRenderTraces(a,a,{absoluteTolerance:.1}),/strict/);
});
