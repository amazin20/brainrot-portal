import test from 'node:test';
import assert from 'node:assert/strict';
import {LabPlatform} from '../src/game/LabPlatform.js';

function fixture(checkpoint=()=>true){
  const events=[],locks=new Set();let callbacks,now=300001;
  const sdk={features:{GameplayAPI:{start:()=>events.push('start'),stop:()=>events.push('stop')}},adv:{
    showFullscreenAdv(options){callbacks=options.callbacks;events.push('fullscreen');},
    showRewardedVideo(options){callbacks=options.callbacks;events.push('rewarded');},
  }};
  const platform=new LabPlatform({sdk,demo:false,now:()=>now,saveProgress(){events.push('save');return checkpoint(platform);},hold(reason,active){events.push([reason,active]);active?locks.add(reason):locks.delete(reason);},timeout:500});
  return{platform,events,locks,get callbacks(){return callbacks;},setTime:value=>now=value};
}

for(const rewarded of [false,true])test(`checkpoint precedes the real ${rewarded?'rewarded':'fullscreen'} SDK submission and owns complete callbacks`,async()=>{
  const f=fixture();let rewards=0;
  const pending=rewarded?f.platform.hint(()=>rewards++):f.platform.interstitial('next');
  assert.equal(f.events[0],'save');assert.equal(f.events.at(-1),rewarded?'rewarded':'fullscreen');
  assert.deepEqual(Object.keys(f.callbacks).sort(),rewarded?['onClose','onError','onOpen','onRewarded']:['onClose','onError','onOpen']);
  f.callbacks.onOpen();if(rewarded){f.callbacks.onRewarded();f.callbacks.onRewarded();}
  f.callbacks.onClose(true);const result=await pending;
  assert.equal(result.shown,true);assert.equal(rewards,rewarded?1:0);assert.equal(f.platform.busy,false);assert.equal(f.locks.size,0);
});

for(const [name,checkpoint]of [['false',()=>false],['throw',()=>{throw Error('save blocked');}],['unconfirmed',()=>undefined],['async',()=>Promise.reject(Error('async save is not confirmed'))]])test(`a ${name} checkpoint skips ads and grants nothing without leaking holds`,async()=>{
  for(const rewarded of [false,true]){
    const f=fixture(checkpoint);let rewards=0;
    const result=await(rewarded?f.platform.hint(()=>rewards++):f.platform.interstitial('next'));
    assert.equal(result.reason,'save-unavailable');assert.equal(result.shown,false);assert.equal(result.rewarded,false);
    assert.deepEqual(f.events,['save']);assert.equal(f.platform.busy,false);assert.equal(f.platform.adLocks.size,0);assert.equal(f.locks.size,0);assert.equal(rewards,0);
  }
  await new Promise(resolve=>setImmediate(resolve));
});

test('a checkpoint cannot reenter an advert before the outer request reserves it',async()=>{
  let nested;
  const f=fixture(platform=>{nested=platform.hint(()=>assert.fail('nested reward'));return true;});
  const pending=f.platform.interstitial('next');assert.equal((await nested).reason,'busy');
  assert.equal(f.events.filter(x=>x==='save').length,1);assert.equal(f.events.filter(x=>x==='fullscreen').length,1);
  f.callbacks.onClose(false);await pending;
});

test('disposal during a checkpoint cancels submission and frees its reservation',async()=>{
  const f=fixture(platform=>{platform.dispose();return true;});
  const result=await f.platform.interstitial('next');assert.equal(result.reason,'disposed');
  assert.ok(!f.events.includes('fullscreen'));assert.equal(f.platform.busy,false);assert.equal(f.platform.adLocks.size,0);
});

test('unavailable, demo and cooldown transitions do not checkpoint or spend a restart attempt',async()=>{
  let saved=0;
  const demo=new LabPlatform({demo:true,saveProgress:()=>{saved++;return false;}});
  await demo.interstitial('next');assert.equal((await demo.hint(()=>{})).reason,'free-demo');
  const unavailable=new LabPlatform({demo:false,saveProgress:()=>{saved++;return true;}});await unavailable.interstitial('next');await unavailable.hint(()=>{});
  assert.equal(saved,0);
  let canSave=false;const f=fixture(()=>canSave);f.setTime(600002);
  const attempted=f.platform.lastRestartAttempt;
  assert.equal((await f.platform.interstitial('restart')).reason,'save-unavailable');assert.equal(f.platform.lastRestartAttempt,attempted);
  canSave=true;const pending=f.platform.interstitial('restart');assert.ok(f.events.includes('fullscreen'));
  f.callbacks.onClose(false);await pending;
  assert.equal((await f.platform.interstitial('restart')).reason,'cooldown');
});

test('a late callback after an accepted checkpoint cannot release a newer advert',async()=>{
  const f=fixture();f.platform.timeout=5;
  const expired=f.platform.hint(()=>assert.fail('late reward')),old=f.callbacks;await expired;
  f.platform.timeout=500;const current=f.platform.hint(()=>{}),next=f.callbacks;next.onOpen();
  old.onOpen();old.onRewarded();old.onClose();assert.equal(f.platform.busy,true);assert.equal(f.locks.has('ad'),true);
  next.onRewarded();next.onClose();await current;assert.equal(f.locks.size,0);assert.equal(f.events.filter(x=>x==='save').length,2);
});
