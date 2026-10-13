import test from 'node:test';
import assert from 'node:assert/strict';
import {nativePointerOrigin} from '../scripts/lib/native-pointer-origin.mjs';

const move=fields=>({type:'mousemove',trusted:true,...fields});

test('the CI cursor at the Play button remains the native absolute origin when no recenter occurred',()=>{
  // Actual failed CI prelude: moving to the already positioned Play button
  // reported zero movement, but its client coordinates still identify origin.
  const events=[move({movementX:0,movementY:0,clientX:1081,clientY:579,locked:false}),
    {type:'pointerlockchange',trusted:true,locked:true}];
  assert.deepEqual(nativePointerOrigin(events),{x:1081,y:579,unlockedEvent:0,lockedMovementX:0,lockedMovementY:0});
});

test('a Chromium recenter before pointer lock supplies a new zero origin from its unlocked client position',()=>{
  const events=[move({movementX:1081,movementY:568,clientX:1081,clientY:568,locked:false}),
    move({movementX:-1081,movementY:-568,clientX:0,clientY:0,locked:false}),
    {type:'pointerlockchange',trusted:true,locked:true},
    move({movementX:0,movementY:0,clientX:0,clientY:0,locked:true})];
  assert.deepEqual(nativePointerOrigin(events),{x:0,y:0,unlockedEvent:1,lockedMovementX:0,lockedMovementY:0});
});

test('a recenter after pointer lock moves the origin to zero despite unchanged locked client coordinates',()=>{
  // Actual local Chromium139 room23 trace. Using locked clientX/clientY here
  // would command a second large move instead of the intended small look.
  const events=[move({movementX:1073,movementY:568,clientX:1073,clientY:568,locked:false}),
    {type:'pointerlockchange',trusted:true,locked:true},
    move({movementX:-1073,movementY:-568,clientX:1073,clientY:568,locked:true}),
    move({movementX:0,movementY:0,clientX:1073,clientY:568,locked:true})];
  assert.deepEqual(nativePointerOrigin(events),{x:0,y:0,unlockedEvent:0,lockedMovementX:-1073,lockedMovementY:-568});
});

test('later trusted movement is integrated and an unlocked observation replaces the previous lock history',()=>{
  const events=[move({clientX:800,clientY:500,locked:false}),move({movementX:-800,movementY:-500,locked:true}),
    move({movementX:18,movementY:9,locked:true})];
  assert.equal(nativePointerOrigin(events).x,18);assert.equal(nativePointerOrigin(events).y,9);
  events.push({type:'pointerlockchange',trusted:true,locked:false},move({clientX:109.5,clientY:42.25,locked:false}),
    move({movementX:4,movementY:-3,locked:true}),move({trusted:false,clientX:999,clientY:999,locked:false}));
  assert.deepEqual(nativePointerOrigin(events),{x:113.5,y:39.25,unlockedEvent:4,lockedMovementX:4,lockedMovementY:-3});
});

test('missing native observations and invalid coordinates fail rather than manufacturing a zero origin',()=>{
  for(const events of [[],[move({trusted:false,clientX:0,clientY:0,locked:false})],
    [move({clientX:0,locked:false})],[move({clientX:Infinity,clientY:0,locked:false})],
    [move({clientX:0,clientY:0,locked:false}),move({movementX:NaN,movementY:0,locked:true})]])
    assert.throws(()=>nativePointerOrigin(events));
  assert.throws(()=>nativePointerOrigin(null),TypeError);
});
