import test from 'node:test';import assert from 'node:assert/strict';
import {CommunicatingLifts} from '../src/game/LabOpenHydraulics.js';
const low=[{basin:0,sill:0},{basin:1,sill:0}],dry=[{basin:0,sill:.18},{basin:1,sill:12.18}];
test('equal-head hydraulic connection conserves exactly one finite supply',()=>{
 const t=new CommunicatingLifts();for(let i=0;i<4000;i++){t.step(1/120,low);assert.ok(Math.abs(t.levels[0]+t.levels[1]-12)<1e-10);assert.ok(t.levels.every(v=>v>=-1e-10&&v<=12+1e-10));}
 assert.ok(Math.abs(t.levels[0]-6)<1e-6&&Math.abs(t.levels[1]-6)<1e-6);
});
test('elevated receiving port transfers only until the source reaches its own aperture sill',()=>{
 const t=new CommunicatingLifts();t.step(60,dry);assert.ok(Math.abs(t.levels[0]-.18)<1e-8);assert.ok(Math.abs(t.levels[1]-11.82)<1e-8);
});
test('continuous discharge is invariant across 30,60,120 Hz and split dry/submerged phases',()=>{
 const ends=[{basin:0,sill:.45},{basin:1,sill:3.7}];const one=new CommunicatingLifts();one.step(17,ends);
 for(const hz of [30,60,120]){const t=new CommunicatingLifts();for(let n=0;n<17*hz;n++)t.step(1/hz,ends);assert.ok(Math.abs(t.levels[0]-one.levels[0])<1e-9);}
});
test('disconnection freezes state; reversing the actual aperture heights reverses flow; reset is complete',()=>{
 const t=new CommunicatingLifts();t.step(6,low);const held=t.levels.slice();t.step(30);assert.deepEqual(t.levels,held);assert.equal(t.flow,0);
 const west=t.levels[0];t.step(5,[{basin:0,sill:12.18},{basin:1,sill:.18}]);assert.ok(t.levels[0]>west);t.reset();assert.deepEqual(t.levels,[12,0]);assert.equal(t.transferred,0);
});
test('invalid time and port data are rejected, never injecting water',()=>{
 for(const value of [0,-1,NaN,Infinity])assert.throws(()=>new CommunicatingLifts(value),RangeError);
 for(const endpoints of [[],[{}],[null,null],{}])assert.throws(()=>new CommunicatingLifts().step(.1,endpoints),RangeError);
 for(const dt of [-1,NaN,Infinity])assert.throws(()=>new CommunicatingLifts().step(dt,low),RangeError);
 for(const end of [{basin:2,sill:0},{basin:0,sill:-1},{basin:0,sill:NaN}])assert.throws(()=>new CommunicatingLifts().step(.1,[end,{basin:1,sill:0}]),RangeError);
});
