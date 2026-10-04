import assert from 'node:assert/strict';
import {LabPlatform,loadYandexSDK} from '../src/game/LabPlatform.js';

const checked=[];
async function check(name,run){await run();checked.push(name);}
function fixture({timeout=50}={}){
  const events=new Map(),locks=new Set(),calls=[],rewards=[];let callbacks;
  const sdk={environment:{i18n:{lang:'ru'}},deviceInfo:{isMobile:()=>false,isTablet:()=>false},
    features:{LoadingAPI:{ready(){calls.push('ready');}},GameplayAPI:{start(){calls.push('start');},stop(){calls.push('stop');}}},
    on:(name,callback)=>events.set(name,callback),off:name=>events.delete(name),
    adv:{showFullscreenAdv({callbacks:c}){callbacks=c;calls.push('fullscreen');},showRewardedVideo({callbacks:c}){callbacks=c;calls.push('rewarded');}}};
  let platform;let requestedPlaying=false;
  const audio={blocked:false},sync=()=>{audio.blocked=locks.size>0||!requestedPlaying;platform?.gameplay(requestedPlaying&&!locks.size);};
  platform=new LabPlatform({sdk,demo:false,timeout,hold:(reason,active)=>{active?locks.add(reason):locks.delete(reason);sync();}});
  return {platform,sdk,events,locks,calls,audio,rewards,get callbacks(){return callbacks;},play(){requestedPlaying=true;sync();},pause(){requestedPlaying=false;sync();},hold(reason,active){active?locks.add(reason):locks.delete(reason);sync();}};
}

await check('SDK absence, init rejection and invalid SDK never signal successful ready',async()=>{
  await assert.rejects(loadYandexSDK({scope:{YaGames:{init:async()=>{throw Error('network');}}}}),/network/);
  await assert.rejects(loadYandexSDK({scope:{YaGames:{init:async()=>null}}}),/не завершил/);
  const platform=new LabPlatform({demo:false});assert.throws(()=>platform.ready(),/не готов/);assert.equal(platform.readySent,false);
  assert.equal(platform.gameplay(true),false);assert.equal(platform.playing,false);
});
await check('SDK script timeout releases handlers, removes failed resource and can be retried',async()=>{
  const scope={},scripts=[];
  const doc={createElement(){return {remove(){this.removed=true;}};},head:{append(script){scripts.push(script);}}};
  await assert.rejects(loadYandexSDK({document:doc,scope,timeout:5}),/не удалось загрузить/i);
  assert.equal(scripts[0].removed,true);assert.equal(scripts[0].onload,null);assert.equal(scripts[0].onerror,null);
  const pending=loadYandexSDK({document:doc,scope,timeout:50});
  scope.YaGames={init:async()=>fixture().sdk};scripts[1].onload();assert.ok(await pending);
});
await check('real readiness is sent once and gameplay markup matches independent visibility and SDK holds',async()=>{
  const f=fixture();f.platform.ready();f.platform.ready();f.play();f.events.get('game_api_pause')();
  assert.equal(f.audio.blocked,true);assert.equal(f.calls.at(-1),'stop');
  f.hold('hidden',true);f.events.get('game_api_resume')();assert.equal(f.audio.blocked,true);assert.equal(f.platform.playing,false);
  f.hold('hidden',false);assert.equal(f.platform.playing,true);assert.equal(f.audio.blocked,false);
  f.pause();f.events.get('game_api_pause')();f.events.get('game_api_resume')();assert.equal(f.platform.playing,false);
  assert.equal(f.calls.filter(call=>call==='ready').length,1);f.platform.dispose();assert.equal(f.events.size,0);
});
await check('failed ready is not committed and a gameplay API exception cannot interrupt audio holds',async()=>{
  const f=fixture();f.sdk.features.LoadingAPI.ready=()=>{throw Error('SDK readiness failed');};
  assert.throws(()=>f.platform.ready(),/readiness failed/);assert.equal(f.platform.readySent,false);
  f.play();f.sdk.features.GameplayAPI.stop=()=>{throw Error('SDK stop failed');};
  assert.doesNotThrow(()=>f.hold('sdk',true));assert.equal(f.audio.blocked,true);
  assert.equal(f.platform.lastGameplayError,'SDK stop failed');
  f.sdk.features.GameplayAPI.stop=()=>{};f.platform.dispose();
});
await check('ad opening stops sound and play; hidden tab and manual pause survive ad close',async()=>{
  const f=fixture();f.play();const pending=f.platform.interstitial('next');f.callbacks.onOpen();
  assert.equal(f.audio.blocked,true);assert.equal(f.platform.playing,false);
  f.hold('hidden',true);f.callbacks.onClose(true);assert.equal((await pending).shown,true);assert.equal(f.audio.blocked,true);
  f.pause();f.hold('hidden',false);assert.equal(f.platform.playing,false);f.platform.dispose();
});
await check('reward belongs only to a current onRewarded event, never close, rejection or timeout',async()=>{
  for(const outcome of ['close','error','timeout']){
    const f=fixture({timeout:5});let reward=0;const pending=f.platform.hint(()=>reward++);
    if(outcome==='close')f.callbacks.onClose();if(outcome==='error')f.callbacks.onError();
    assert.equal((await pending).rewarded,false);assert.equal(reward,0);const stale=f.callbacks;stale.onRewarded();assert.equal(reward,0);f.platform.dispose();
  }
  const f=fixture();let rewards=0;const pending=f.platform.hint(()=>rewards++);f.callbacks.onOpen();f.callbacks.onRewarded();f.callbacks.onRewarded();f.callbacks.onClose();
  assert.equal((await pending).rewarded,true);assert.equal(rewards,1);f.platform.dispose();
});
await check('an opened ad outlives the pre-open watchdog; disposing invalidates late reward',async()=>{
  const f=fixture({timeout:5});let rewards=0;const pending=f.platform.hint(()=>rewards++);f.callbacks.onOpen();
  await new Promise(resolve=>setTimeout(resolve,15));assert.equal(f.platform.busy,true);assert.equal(f.locks.has('ad'),true);
  f.platform.dispose();assert.equal((await pending).reason,'disposed');assert.equal(f.locks.has('ad'),false);
  f.callbacks.onRewarded();f.callbacks.onOpen();assert.equal(rewards,0);assert.equal(f.platform.busy,false);
});
await check('reward persistence failure is not reported as a granted reward and does not unlock beneath ad',async()=>{
  const f=fixture();const pending=f.platform.hint(()=>{throw Error('save unavailable');});f.callbacks.onOpen();f.callbacks.onRewarded();
  assert.equal(f.locks.has('ad'),true);f.callbacks.onClose();const result=await pending;assert.equal(result.rewarded,false);assert.equal(result.reason,'reward-handler-error');f.platform.dispose();
});
await check('mobile and tablet fullscreen runs at the gesture call, deduplicates and tolerates rejection',async()=>{
  const f=fixture();let requests=0,complete;
  f.sdk.deviceInfo.isMobile=()=>true;f.sdk.screen={fullscreen:{status:'off',request(){requests++;return new Promise(resolve=>complete=()=>{this.status='on';resolve();});}}};
  const request=f.platform.enterFullscreen();assert.equal(requests,1);assert.equal(f.platform.enterFullscreen(),request);complete();assert.equal((await request).entered,true);
  assert.equal((await f.platform.enterFullscreen()).reason,'already-fullscreen');assert.equal(requests,1);
  f.sdk.screen.fullscreen.status='off';f.sdk.screen.fullscreen.request=()=>Promise.reject(Error('gesture denied'));assert.equal((await f.platform.enterFullscreen()).reason,'unavailable');
  f.sdk.deviceInfo.isMobile=()=>false;f.sdk.deviceInfo.isTablet=()=>false;assert.equal((await f.platform.enterFullscreen()).reason,'not-mobile');
  f.sdk.deviceInfo.isTablet=()=>true;f.sdk.screen.fullscreen.request=function(){this.status='on';return Promise.resolve();};assert.equal((await f.platform.enterFullscreen()).entered,true);f.platform.dispose();
});
console.log(JSON.stringify({pass:true,scope:'SDK mocks and app pause/audio hold contract; not live ad delivery or moderation',checks:checked},null,2));
