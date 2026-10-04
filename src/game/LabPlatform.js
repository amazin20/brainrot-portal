/** Yandex Games integration, verified against official SDK documentation.
 * Outside the Yandex build we never simulate an advert or claim ad revenue. */
export async function loadYandexSDK({document:doc=globalThis.document,scope=globalThis,timeout=10000}={}){
  if(!scope.YaGames)await new Promise((resolve,reject)=>{
    const script=doc.createElement('script');script.src='/sdk.js';script.async=true;
    let settled=false;
    const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);script.onload=script.onerror=null;
      if(error){script.remove?.();reject(error);}else resolve();};
    const timer=setTimeout(()=>finish(new Error('Не удалось загрузить SDK Яндекс Игр. Повтори загрузку.')),timeout);
    script.onload=()=>finish();script.onerror=()=>finish(new Error('SDK Яндекс Игр недоступен. Повтори загрузку.'));doc.head.append(script);
  });
  if(typeof scope.YaGames?.init!=='function')throw new Error('SDK Яндекс Игр не загружен. Повтори загрузку.');
  let timer;
  try{
    const sdk=await Promise.race([Promise.resolve().then(()=>scope.YaGames.init()),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('SDK Яндекс Игр не ответил. Повтори загрузку.')),timeout);})]);
    if(!sdk||typeof sdk.features?.LoadingAPI?.ready!=='function')throw new Error('SDK Яндекс Игр не завершил подготовку. Повтори загрузку.');
    return sdk;
  }
  finally{clearTimeout(timer);}
}
export class LabPlatform {
  constructor({sdk=null,demo=true,hold=()=>{},now=()=>Date.now(),timeout=15000}={}){
    this.sdk=sdk;this.demo=demo;this.hold=hold;this.now=now;this.timeout=timeout;this.busy=false;this.playing=false;this.adLocks=new Set();this.requestSerial=0;
    this.lastAdAt=now();this.lastRestartAttempt=now();this.readySent=false;this.disposed=false;this.requests=new Map();this.fullscreenPending=null;
    this.onPause=()=>this.hold('sdk',true);this.onResume=()=>this.hold('sdk',false);
    sdk?.on?.('game_api_pause',this.onPause);sdk?.on?.('game_api_resume',this.onResume);
  }
  ready(){
    if(this.disposed||this.readySent)return false;
    if(this.demo){this.readySent=true;return false;}
    const api=this.sdk?.features?.LoadingAPI;
    if(typeof api?.ready!=='function')throw new Error('SDK Яндекс Игр не готов. Повтори загрузку.');
    api.ready();this.readySent=true;return true;
  }
  gameplay(active){
    active=Boolean(active)&&!this.disposed;
    if(this.playing===active)return false;
    const api=this.sdk?.features?.GameplayAPI,method=active?'start':'stop';
    // Missing optional gameplay markup never counts as a successful SDK call.
    if(!this.demo&&typeof api?.[method]!=='function')return false;
    if(!this.demo)try{api[method]();}catch(error){this.lastGameplayError=String(error?.message||error);return false;}
    this.playing=active;return true;
  }
  enterFullscreen(){
    const screen=this.sdk?.screen?.fullscreen;
    const mobile=this.sdk?.deviceInfo?.isMobile?.()||this.sdk?.deviceInfo?.isTablet?.();
    if(this.disposed||this.demo||!mobile||typeof screen?.request!=='function')return Promise.resolve({entered:false,reason:'not-mobile'});
    if(screen.status==='on')return Promise.resolve({entered:true,reason:'already-fullscreen'});
    if(this.fullscreenPending)return this.fullscreenPending;
    // Called directly by the first Play gesture. A denied request never blocks play.
    try{this.fullscreenPending=Promise.resolve(screen.request()).then(()=>({entered:screen.status==='on',reason:'requested'}),()=>({entered:false,reason:'unavailable'})).finally(()=>{this.fullscreenPending=null;});}
    catch{return Promise.resolve({entered:false,reason:'unavailable'});}
    return this.fullscreenPending;
  }
  async interstitial(reason){
    if(this.disposed)return {shown:false,reason:'disposed'};
    if(!['next','restart'].includes(reason))return {shown:false,reason:'invalid-transition'};
    if(this.demo||!this.sdk?.adv?.showFullscreenAdv)return {shown:false,reason:this.demo?'demo':'unavailable'};
    if(reason==='restart'){
      if(this.now()-Math.max(this.lastAdAt,this.lastRestartAttempt)<300000)return {shown:false,reason:'cooldown'};
      this.lastRestartAttempt=this.now();
    }
    return this.request(false);
  }
  async hint(reward){
    if(this.disposed)return {rewarded:false,reason:'disposed'};
    if(this.busy||this.adLocks.size)return {rewarded:false,reason:'busy'};
    if(this.demo){reward();return {rewarded:true,reason:'free-demo'};}
    if(!this.sdk?.adv?.showRewardedVideo)return {rewarded:false,reason:'unavailable'};
    return this.request(true,reward);
  }
  request(rewarded,onReward=()=>{}){
    if(this.disposed)return Promise.resolve({rewarded:false,shown:false,reason:'disposed'});
    if(this.busy||this.adLocks.size)return Promise.resolve({rewarded:false,shown:false,reason:'busy'});
    const requestId=++this.requestSerial;
    const lock=active=>{active?this.adLocks.add(requestId):this.adLocks.delete(requestId);this.hold('ad',this.adLocks.size>0);};
    this.busy=true;lock(true);this.gameplay(false);
    return new Promise(resolve=>{
      let settled=false,opened=false,earned=false,rewardClaimed=false,rewardFailed=false;
      const finish=(reason,shown=opened)=>{
        if(settled)return;settled=true;clearTimeout(timer);this.requests.delete(requestId);this.busy=false;lock(false);
        if(shown)this.lastAdAt=this.now();resolve({shown,rewarded:earned,reason});
      };
      // Never run this watchdog after onOpen: it must not resume under a real ad.
      const timer=setTimeout(()=>finish('timeout',false),this.timeout);
      this.requests.set(requestId,()=>finish('disposed'));
      const callbacks={
        onOpen:()=>{if(settled)return;opened=true;clearTimeout(timer);lock(true);},
        onRewarded:()=>{if(!settled&&!rewardClaimed){rewardClaimed=true;try{onReward();earned=true;}catch{rewardFailed=true;}}},
        onClose:wasShown=>{if(settled){lock(false);return;}finish(rewardFailed?'reward-handler-error':'closed',rewarded?opened:!!wasShown);},
        onError:()=>{if(settled){lock(false);return;}finish('error',opened);},
      };
      try{const result=rewarded?this.sdk.adv.showRewardedVideo({callbacks}):this.sdk.adv.showFullscreenAdv({callbacks});
        result?.catch?.(()=>finish('error',opened));}catch{finish('error',false);}
    });
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;
    this.sdk?.off?.('game_api_pause',this.onPause);this.sdk?.off?.('game_api_resume',this.onResume);this.gameplay(false);
    for(const finish of [...this.requests.values()])finish();
    this.hold('sdk',false);
  }
}
