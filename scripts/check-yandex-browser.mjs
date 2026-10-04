import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const directory=path.resolve(process.env.YANDEX_DIR||'dist-yandex'),out=path.resolve(process.env.OUT_DIR||'qa/yandex-browser');
fs.mkdirSync(out,{recursive:true});
const prefix='/uploads/yandex-check/game/';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((request,response)=>{
  const pathname=new URL(request.url,'http://localhost').pathname;
  if(!pathname.startsWith(prefix)){response.writeHead(404);response.end();return;}
  const relative=decodeURIComponent(pathname.slice(prefix.length))||'index.html',filename=path.resolve(directory,relative);
  if(!filename.startsWith(directory+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){response.writeHead(404);response.end();return;}
  response.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream'});fs.createReadStream(filename).pipe(response);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}${prefix}`;
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
const report={pass:false,scope:'Actual production game UI/WebGL with mocked Yandex SDK, not platform ads, hardware FPS or moderation approval',url,checks:[],errors:[]};
const sdkSource=({mobile=false,reject=false,startupAd=false}={})=>`
window.__sdkLog=[];window.__sdkEvents={};window.__sdkLocaleReads=0;window.__adClose=null;
window.__audioContexts=[];const NativeAudio=window.AudioContext||window.webkitAudioContext;
if(NativeAudio)window.AudioContext=function(...args){const context=new NativeAudio(...args);window.__audioContexts.push(context);return context;};
window.YaGames={init:async()=>{
 ${reject?"throw Error('Mock SDK initialization rejected');":''}
 const sdk={environment:{i18n:{get lang(){window.__sdkLocaleReads++;return 'en';}}},
 deviceInfo:{isMobile:()=>${mobile},isTablet:()=>false},
 screen:{fullscreen:{status:'off',request(){window.__sdkLog.push('fullscreen-request');this.status='on';return Promise.resolve();}}},
 on:(name,callback)=>window.__sdkEvents[name]=callback,off:name=>delete window.__sdkEvents[name],
 features:{LoadingAPI:{ready(){window.__sdkLog.push('ready');${startupAd?"window.__sdkEvents.game_api_pause();setTimeout(()=>window.__sdkEvents.game_api_resume(),150);":''}}},
 GameplayAPI:{start(){window.__sdkLog.push('start');},stop(){window.__sdkLog.push('stop');}}},
 adv:{showFullscreenAdv({callbacks}){window.__sdkLog.push('ad-open');callbacks.onOpen();window.__adClose=()=>{callbacks.onClose(true);window.__sdkLog.push('ad-close');};},
 showRewardedVideo(){throw Error('No automatic rewarded advertising is allowed');}}};return sdk;
}};`;
async function pageWithSDK(options){
  new vm.Script(sdkSource(options));
  const page=await browser.newPage();page.setDefaultTimeout(120000);await page.setViewport(options.mobile?{width:390,height:844,isMobile:true,hasTouch:true}:{width:1024,height:768});
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))report.errors.push(`${response.status()} ${response.url()}`);});
  await page.setRequestInterception(true);page.on('request',request=>{
    if(new URL(request.url()).pathname==='/sdk.js')void request.respond({status:200,contentType:'application/javascript',body:sdkSource(options)});
    else void request.continue();
  });
  await page.goto(url+'?debug=1',{waitUntil:'networkidle2'});return page;
}
function phase(name){report.phase=name;fs.writeFileSync(path.join(out,'sdk-production-progress.json'),JSON.stringify(report,null,2)+'\n');}
async function clickReady(page,selector){
  await page.waitForFunction(selector=>{const button=document.querySelector(selector),screen=button?.closest('.screen'),rect=button?.getBoundingClientRect();return button&&!screen?.inert&&(!screen||getComputedStyle(screen).opacity==='1')&&button.contains(document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2));},{timeout:15000},selector);
  await page.click(selector);
}
try{
  phase('sdk-failure');
  const failed=await pageWithSDK({reject:true});
  await failed.waitForFunction(()=>document.documentElement.dataset.runtimeState==='error');
  assert.match(await failed.$eval('#error-detail',node=>node.textContent),/initialization rejected/);
  assert.deepEqual(await failed.evaluate(()=>window.__sdkLog),[]);assert.equal(await failed.evaluate(()=>window.__NESI_DEMO_GAME__),undefined);
  report.checks.push('Rejected SDK init shows retry screen and never reports ready/gameplay/demo');await failed.close();
  phase('desktop-ready');
  const desktop=await pageWithSDK({startupAd:true});
  await desktop.waitForFunction(()=>document.documentElement.dataset.runtimeState==='ready'&&document.body.dataset.externalPause==='false');
  assert.equal(await desktop.evaluate(()=>window.__sdkLog.filter(event=>event==='ready').length),1);
  assert.equal(await desktop.evaluate(()=>window.__sdkLocaleReads),1);
  assert.equal(await desktop.$eval('html',node=>node.lang),'ru');
  assert.equal(await desktop.$eval('#level-select',node=>node.options.length),41);
  assert.equal(await desktop.$('.walkthrough-link'),null);
  assert.equal(await desktop.evaluate(()=>window.__NESI_DEMO_GAME__),undefined,'Production query must not expose debug harness');
  phase('desktop-start-audio');
  await clickReady(desktop,'#play-button');await desktop.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
  await desktop.waitForFunction(()=>window.__audioContexts.length>0&&window.__audioContexts[0].state==='running');
  phase('desktop-sdk-pause');
  await desktop.evaluate(()=>window.__sdkEvents.game_api_pause());
  await desktop.waitForFunction(()=>document.body.dataset.externalPause==='true'&&window.__audioContexts[0].state==='suspended');
  assert.equal(await desktop.evaluate(()=>window.__sdkLog.at(-1)),'stop');
  await desktop.evaluate(()=>window.__sdkEvents.game_api_resume());
  await desktop.waitForFunction(()=>document.body.dataset.externalPause==='false'&&window.__audioContexts[0].state==='running');
  assert.equal(await desktop.evaluate(()=>window.__sdkLog.at(-1)),'start');
  assert.equal(await desktop.evaluate(()=>window.__sdkLog.includes('fullscreen-request')),false);
  // Opening the ordinary menu stops real audio. SDK resume must preserve this pause.
  await desktop.evaluate(()=>document.exitPointerLock?.());
  if(await desktop.$eval('html',node=>node.dataset.runtimeState)==='playing')await desktop.keyboard.press('Escape');
  await desktop.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');
  await desktop.evaluate(()=>{window.__sdkEvents.game_api_pause();window.__sdkEvents.game_api_resume();});
  assert.equal(await desktop.$eval('html',node=>node.dataset.runtimeState),'paused');
  await desktop.waitForFunction(()=>window.__audioContexts[0].state==='suspended');
  // A genuine room transition shows an interstitial; closing it after a blur
  // does not bypass the page hold or resume sound under the advertisement.
  phase('transition-ad');
  await desktop.select('#settings-level-select','1');
  await desktop.waitForFunction(()=>window.__adClose&&document.body.dataset.externalPause==='true');
  await desktop.waitForFunction(()=>window.__audioContexts[0].state==='suspended');
  await desktop.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.__adClose();});
  await desktop.waitForFunction(()=>document.documentElement.dataset.levelIndex==='1');
  assert.equal(await desktop.$eval('body',node=>node.dataset.externalPause),'true');
  await desktop.waitForFunction(()=>window.__audioContexts[0].state==='suspended');
  phase('transition-focus');
  await desktop.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await desktop.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused',{timeout:15000});
  phase('transition-resume');
  await clickReady(desktop,'#resume-button');await desktop.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing',{timeout:15000});
  report.desktopPlayLog=await desktop.evaluate(()=>window.__sdkLog);
  phase('save-reload');
  await desktop.reload({waitUntil:'networkidle2'});await desktop.waitForFunction(()=>document.documentElement.dataset.runtimeState==='ready');
  assert.equal(await desktop.$eval('#level-select',node=>node.value),'1','Selected room survives reload via actual local storage');
  await desktop.screenshot({path:path.join(out,'desktop-menu.png')});
  report.desktopLog=await desktop.evaluate(()=>window.__sdkLog);report.checks.push('41 rooms, SDK locale, no gallery/debug, start/stop, actual audio pause, interstitial/focus holds and local save reload');await desktop.close();
  phase('mobile-start');
  const mobile=await pageWithSDK({mobile:true});await mobile.waitForFunction(()=>document.documentElement.dataset.runtimeState==='ready');
  await mobile.tap('#play-button');await mobile.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
  assert.equal(await mobile.evaluate(()=>window.__sdkLog.filter(event=>event==='fullscreen-request').length),1);
  await mobile.evaluate(()=>window.__sdkEvents.game_api_pause());await mobile.waitForFunction(()=>document.body.dataset.externalPause==='true');
  await mobile.evaluate(()=>window.__sdkEvents.game_api_resume());await mobile.waitForFunction(()=>document.body.dataset.externalPause==='false');
  await mobile.screenshot({path:path.join(out,'mobile-playing.png')});report.mobileLog=await mobile.evaluate(()=>window.__sdkLog);
  report.checks.push('Mobile SDK fullscreen requested once by Play gesture and SDK holds release');await mobile.close();
  assert.deepEqual(report.errors,[]);report.pass=true;console.log(JSON.stringify(report,null,2));
}catch(error){report.failure=String(error);report.openPages=[];for(const page of await browser.pages()){report.openPages.push(await page.evaluate(()=>({url:location.href,state:document.documentElement.dataset.runtimeState,externalPause:document.body.dataset.externalPause,log:window.__sdkLog,audio:window.__audioContexts?.map(context=>context.state),error:document.querySelector('#error-detail')?.textContent})).catch(()=>null));}throw error;}
finally{fs.writeFileSync(path.join(out,'sdk-production-proof.json'),JSON.stringify(report,null,2)+'\n');await browser.close();await new Promise(resolve=>server.close(resolve));}
