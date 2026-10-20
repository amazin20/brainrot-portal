/** Explicit TEST SDK. Callbacks exercise the compiled platform adapter; they
 * do not demonstrate Yandex SDK availability, ad delivery or a paid view. */
import assert from 'node:assert/strict';
import vm from 'node:vm';

export function createMockYandexSDKSource({mobile=false,language='ru',reject=false,startupPause=false,manualInterstitial=false}={}){
 for(const value of [mobile,reject,startupPause,manualInterstitial])assert.equal(typeof value,'boolean');assert.ok(['ru','en'].includes(language));
 const source=`(() => {
  'use strict';
  const events=Object.create(null),log=[];
  const record=(event,detail=null)=>log.push({event,detail,time:performance.now()});
  const mock={kind:'explicit-local-test-sdk',liveSdk:false,liveAds:false,log,events,rewardedOutcome:'reward',manualRewarded:false,duplicateRewarded:false,finishRewarded:null,finishInterstitial:null};
  Object.defineProperty(window,'__LAB_YANDEX_MOCK__',{value:mock});
  window.YaGames={init:async function(){
   record('init');
   ${reject?"throw Error('Explicit mock SDK initialization rejected');":''}
   const sdk={environment:{i18n:{get lang(){record('sdk-language-get');return ${JSON.stringify(language)};}}},
    deviceInfo:{isMobile:()=>${mobile},isTablet:()=>false},
    screen:{fullscreen:{status:'off',request(){record('fullscreen-request');this.status='on';return Promise.resolve();}}},
    on(name,callback){if(typeof callback!=='function')throw Error('Mock SDK handler must be a function');events[name]=callback;record('on',name);},
    off(name){delete events[name];record('off',name);},
    features:{LoadingAPI:{ready(){record('ready');${startupPause?"events.game_api_pause?.();setTimeout(()=>events.game_api_resume?.(),150);":''}}},GameplayAPI:{start(){record('start');},stop(){record('stop');}}},
    adv:{showFullscreenAdv({callbacks}){
     record('interstitial-open');let finished=false;mock.finishInterstitial=()=>{if(finished)return;finished=true;mock.finishInterstitial=null;record('interstitial-close');callbacks.onClose?.(true);};
     callbacks.onOpen?.();${manualInterstitial?'':'setTimeout(()=>mock.finishInterstitial?.(),30);'}
    },showRewardedVideo({callbacks}){
     record('rewarded-open',{outcome:mock.rewardedOutcome});let finished=false;
     const finish=()=>{if(finished)return;finished=true;mock.finishRewarded=null;
      if(mock.rewardedOutcome==='error'){record('rewarded-error');callbacks.onError?.(Error('Explicit mock rewarded error'));return;}
      if(mock.rewardedOutcome==='reward'){record('rewarded-confirmed');callbacks.onRewarded?.();
       if(mock.duplicateRewarded){record('rewarded-confirmed-duplicate');callbacks.onRewarded?.();}}
      record('rewarded-close');callbacks.onClose?.();};
     mock.finishRewarded=finish;callbacks.onOpen?.();if(!mock.manualRewarded)setTimeout(finish,30);
    }}};
   return sdk;
  }};
 })();\n`;
 new vm.Script(source,{filename:'explicit-test-sdk.js'});return source;
}

export function readMockYandexSDKObservation(){
 const mock=window.__LAB_YANDEX_MOCK__;
 if(mock?.kind!=='explicit-local-test-sdk'||mock.liveSdk!==false||mock.liveAds!==false)throw Error('Explicit local mock SDK absent');
 return {kind:mock.kind,liveSdk:mock.liveSdk,liveAds:mock.liveAds,log:mock.log.map(row=>({...row})),
  registeredEvents:Object.keys(mock.events).sort(),platformDemo:window.__NESI_PLATFORM__?.demo??null};
}
