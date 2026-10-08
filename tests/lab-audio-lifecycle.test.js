import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioController} from '../src/game/AudioController.js';

// WebAudio changes its visible state in a queued task, not at the instant
// suspend()/resume() returns. Keep that boundary explicit; no audio hardware
// or browser performance is measured by this fixture.
function fixture(state='running') {
  const requests=[],parameter={value:0,cancelScheduledValues(){},setValueAtTime(value){this.value=value;}};
  const context={state,currentTime:0,
    resume(){return request('running');},suspend(){return request('suspended');},
    close(){this.state='closed';return Promise.resolve();},
  };
  function request(target){return new Promise((resolve,reject)=>requests.push({target,
    finish(){context.state=target;resolve();},fail(){reject(new Error('Audio device unavailable'));}}));}
  const audio=new AudioController();audio.context=context;audio.master={gain:parameter};audio.blocks.clear();
  const settle=async()=>{const next=requests.shift();assert.ok(next,'An audio transition must be pending');next.finish();await new Promise(resolve=>setImmediate(resolve));return next.target;};
  return {audio,context,requests,parameter,settle};
}

test('resuming before a pending suspend settles restores audio without another settings change',async()=>{
  const f=fixture();f.audio.block('pause',true);
  assert.equal(f.context.state,'running','visible state has not changed yet');
  f.audio.block('pause',false);
  assert.equal(f.parameter.value,.65);
  await f.settle();
  assert.equal(f.requests.length,1,'the completed old pause must reconcile the current play state');
  assert.equal(await f.settle(),'running');
  assert.equal(f.context.state,'running');assert.equal(f.audio.audible,true);
});

test('a mute during pending resume leaves the context suspended and gain zero',async()=>{
  const f=fixture('suspended');f.audio.sync();f.audio.configure({muted:true});
  assert.equal(f.parameter.value,0);
  await f.settle();
  assert.equal(f.requests.length,1,'a late resume must respect the current mute');
  assert.equal(await f.settle(),'suspended');
  assert.equal(f.context.state,'suspended');assert.equal(f.parameter.value,0);assert.equal(f.audio.audible,false);
});

test('independent page and ad holds survive a late transition and repeated sync does not queue duplicates',async()=>{
  const f=fixture();f.audio.block('ad',true);f.audio.block('hidden',true);
  for(let i=0;i<50;i++)f.audio.sync();
  assert.equal(f.requests.length,1);
  f.audio.block('ad',false);await f.settle();
  assert.equal(f.context.state,'suspended');assert.equal(f.requests.length,0);assert.equal(f.parameter.value,0);
  f.audio.block('hidden',false);
  for(let i=0;i<50;i++)f.audio.sync();
  assert.equal(f.requests.length,1);await f.settle();assert.equal(f.context.state,'running');
});

test('disposal cannot let a late resume issue another transition against the closed context',async()=>{
  const f=fixture('suspended');f.audio.sync();f.audio.dispose();
  assert.equal(f.audio.context,null);
  await f.settle();assert.equal(f.requests.length,0);assert.equal(f.audio.context,null);
});

test('a rejected device transition does not spin retries; a later user action may retry',async()=>{
  const f=fixture('suspended');f.audio.sync();f.requests.shift().fail();
  await new Promise(resolve=>setImmediate(resolve));assert.equal(f.requests.length,0);
  f.audio.configure({volume:.4});assert.equal(f.requests.length,1);
  await f.settle();assert.equal(f.audio.audible,true);assert.equal(f.parameter.value,.4);
});
