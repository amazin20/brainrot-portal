import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {OBSERVED_PUBLIC_BASE,observerIdentity,assertObservedPageURL,createBrowserObserver,resolvePuppeteerModules,verifyActualPuppeteerImportIdentity,withoutObserverPreload,assertBrowserObservations} from './observe-campaign-v55-browser.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'observer-fixture-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const metadata=Buffer.from(JSON.stringify({commit:'a'.repeat(40),gameCommit:'a'.repeat(40),interfaceCommit:'a'.repeat(40),publisherCommit:null,run:'111',verified:false,version:'v55-castle-finale',sourceInputsSha256:'1'.repeat(64),packageFilesSha256:'2'.repeat(64)}));
 const env={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'amazin20/brainrot-portal',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'push',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'e'.repeat(40),GITHUB_JOB:'public',GITHUB_RUN_ID:'222',PUBLIC_OBSERVER_JOB_ID:'333',
  EXPECTED_SOURCE_COMMIT:'a'.repeat(40),EXPECTED_SOURCE_TREE:'b'.repeat(40),EXPECTED_SOURCE_PARENT:'c'.repeat(40),EXPECTED_SOURCE_RUN:'111',EXPECTED_SOURCE_ATTEMPT:'1',PUBLIC_BUILD_INFO_BYTES:String(metadata.length),PUBLIC_BUILD_INFO_SHA256:sha(metadata)};
 const identity=observerIdentity(env),output=path.join(directory,'observations.json'),observer=createBrowserObserver({identity,output});return {directory,metadata,env,identity,output,observer};
}
class FakePage extends EventEmitter{
 constructor(){super();this.currentURL='about:blank';this.game={state:'playing',cargoUUID:'original-actor',bodyId:7};this.calls=[];this.frame={url:()=>this.currentURL};this.pixel=Buffer.from('fake-screenshot-bytes');this.handle={screenshot:async()=>this.pixel};}
 url(){return this.currentURL;}
 mainFrame(){return this.frame;}
 async goto(url){this.calls.push(['goto',url]);this.currentURL=url;this.emit('framenavigated',this.frame);return this.gotoReturn;}
 async evaluate(fn,...args){this.calls.push(['evaluate',fn,args]);return this.evaluateReturn;}
 async evaluateHandle(){return this.handle;}
 async $eval(){return this.evaluateReturn;}
 async $$eval(){return this.evaluateReturn;}
 async screenshot(){this.calls.push(['screenshot']);return this.pixel;}
 async createCDPSession(){return this.session;}
 async $(selector){this.calls.push(['$',selector]);return this.handle;}
 async close(){this.calls.push(['close']);return 'page-close-result';}
}
class FakeBrowser{
 constructor(page){this.page=page;this.closeCalls=0;this.pageCalls=0;this.list=[page];}
 async newPage(){this.pageCalls++;return this.page;}
 async pages(){return this.list;}
 async close(){this.closeCalls++;return 'browser-close-result';}
}
async function prepareFake(t){const f=fixture(t),page=new FakePage(),browser=new FakeBrowser(page),options={headless:true},pp={launch:async received=>{assert.strictEqual(received,options);return browser;}};
 f.observer.patchPuppeteer(pp,'fake-esm-default');assert.strictEqual(await pp.launch(options),browser);assert.strictEqual(await browser.newPage(),page);return {...f,page,browser,pp};}
function nodeResponse(bytes,url=OBSERVED_PUBLIC_BASE+'build-info.json',status=200){const response=new Response(bytes,{status});Object.defineProperty(response,'url',{value:url});return response;}
async function observeMetadata(f,bytes=f.metadata,url=OBSERVED_PUBLIC_BASE+'build-info.json',status=200){const response=nodeResponse(bytes,url,status),target={fetch:async()=>response};f.observer.patchFetch(target);assert.strictEqual(await target.fetch(url),response);await f.observer.flush('test-http');return response;}

test('actual inherited PUBLIC identity cannot use SOURCE run/commit or a wrong main event/attempt/job',t=>{
 const f=fixture(t);assert.notEqual(f.identity.producerOrigin.publicationRun,f.identity.source.sourceReview.runId);assert.equal(f.identity.producerOrigin.jobURL,'https://github.com/amazin20/brainrot-portal/actions/runs/222/job/333');
 for(const [key,value]of[['GITHUB_RUN_ID','111'],['GITHUB_SHA','a'.repeat(40)],['GITHUB_RUN_ATTEMPT','2'],['GITHUB_REF','refs/heads/source'],['GITHUB_EVENT_NAME','workflow_dispatch'],['PUBLIC_OBSERVER_JOB_ID','0'],['GITHUB_WORKFLOW_REF','other/workflow']])assert.throws(()=>observerIdentity({...f.env,[key]:value}));
});
test('utility imports never accidentally initialize the preload and resolver subprocess strips only observer NODE_OPTIONS',()=>{
 const url=new URL('./observe-campaign-v55-browser.mjs',import.meta.url).href;
 const stdout=execFileSync(process.execPath,['--input-type=module','-e','import('+JSON.stringify(url)+').then(()=>process.stdout.write("UTILITY_IMPORT_ONLY_OK"))'],{encoding:'utf8',env:{...process.env,NODE_OPTIONS:'--max-old-space-size=512   --conditions=fixture'}});assert.equal(stdout,'UTILITY_IMPORT_ONLY_OK');
 assert.equal(withoutObserverPreload('--max-old-space-size=2048 --import '+url+' --conditions=custom'),'--max-old-space-size=2048 --conditions=custom');
 assert.equal(withoutObserverPreload('--import='+url+' --import ./different-preload.mjs'),'--import ./different-preload.mjs');
});
test('only true bare, storage-debug and exact approved campaign navigation pass',()=>{
 for(const url of [OBSERVED_PUBLIC_BASE,OBSERVED_PUBLIC_BASE+'?debug=1',OBSERVED_PUBLIC_BASE+'?edition=foundation&level=20&debug=1'])assert.equal(assertObservedPageURL(url),url);
 for(const url of ['http://127.0.0.1:4173/campaign-v55/',OBSERVED_PUBLIC_BASE.replace('amazin20.github.io','example.com'),OBSERVED_PUBLIC_BASE.replace('campaign-v55','tower41-native-v3'),OBSERVED_PUBLIC_BASE+'?debug=1&other=1',OBSERVED_PUBLIC_BASE+'?edition=open&level=20&debug=1',OBSERVED_PUBLIC_BASE+'?edition=foundation&level=52&debug=1',OBSERVED_PUBLIC_BASE+'?edition=foundation&level=20&debug=1&debug=1',OBSERVED_PUBLIC_BASE+'#room'])assert.throws(()=>assertObservedPageURL(url));
});
test('Puppeteer wrappers return identical browser/page/evaluate/capture objects and leave game state untouched',async t=>{
 const f=await prepareFake(t),game={...f.page.game};f.page.gotoReturn={kind:'original-http-response'};const url=OBSERVED_PUBLIC_BASE+'?edition=foundation&level=1&debug=1';assert.strictEqual(await f.page.goto(url),f.page.gotoReturn);
 const payload={frame:{state:'won',levelIndex:0,cargoUUID:'original-actor',cargoBodyId:7},data:'data:image/jpeg;base64,'+Buffer.from('original-return-pixels').toString('base64')};f.page.evaluateReturn=payload;
 const fn=()=>{throw Error('Observer must never execute/inject game JS itself');},args={token:'unaltered'};assert.strictEqual(await f.page.evaluate(fn,args),payload);assert.strictEqual(f.page.calls.at(-1)[1],fn);assert.strictEqual(f.page.calls.at(-1)[2][0],args);
 assert.strictEqual(await f.page.screenshot(),f.page.pixel);assert.strictEqual(await f.browser.pages(),f.browser.list);const handle=await f.page.$('#canvas');assert.strictEqual(handle,f.page.handle);assert.strictEqual(await handle.screenshot(),f.page.pixel);
 assert.deepEqual(f.page.game,game);assert.equal(f.page.currentURL,url);const response=await observeMetadata(f);assert.equal(await response.text(),f.metadata.toString(),'Observer must consume only Response.clone');
 assert.equal(await f.browser.close(),'browser-close-result');assert.equal(f.browser.closeCalls,1);f.observer.exit(0);const receipt=JSON.parse(fs.readFileSync(f.output));assertBrowserObservations(receipt,{identity:f.identity});assert.equal(receipt.counts.captures,3);assert.equal(receipt.counts.nodeMetadataResponses,1);assert.equal(receipt.counts.browserMetadataResponses,0);
});
test('reused native tabs retain first-room query while every later evaluate/capture records its actual URL',async t=>{
 const f=await prepareFake(t),url=OBSERVED_PUBLIC_BASE+'?edition=foundation&level=1&debug=1';await f.page.goto(url);
 for(const level of [0,19,40]){f.page.evaluateReturn={levelIndex:level,state:'won',cargoUUID:'original-actor',cargoBodyId:7};await f.page.evaluate(()=>null);await f.page.screenshot();}
 await observeMetadata(f);await f.observer.flush('reused-tab');const receipt=f.observer.exit(0);assertBrowserObservations(receipt,{identity:f.identity});assert.deepEqual(receipt.observedURLs,[url]);assert.deepEqual(receipt.observations.filter(row=>row.method==='evaluate'&&row.phase==='after').map(row=>row.frame.levelIndex),[0,19,40]);
 assert.ok(receipt.observations.filter(row=>['evaluate','screenshot'].includes(row.method)).every(row=>row.url===url));
});
test('nested animation JPEGs and CDP architecture screenshots retain all image hashes without altering returned values',async t=>{
 const f=await prepareFake(t);await f.page.goto(OBSERVED_PUBLIC_BASE+'?edition=foundation&level=9&debug=1');const frames=[0,1].map(sample=>({sample,jpeg:Buffer.from('frame-'+sample).toString('base64')})),angles=[{jpeg:Buffer.from('angle').toString('base64')}];
 const payload={route:{pass:true},frames,angleCaptures:angles,contextLost:false};f.page.evaluateReturn=payload;assert.strictEqual(await f.page.evaluate(()=>null),payload);
 const shot={data:Buffer.from('actual-cdp-bytes').toString('base64')},calls=[];f.page.session={send:async(...args)=>{calls.push(args);return shot;}};const session=await f.page.createCDPSession();assert.strictEqual(session,f.page.session);const options={format:'jpeg'};assert.strictEqual(await session.send('Page.captureScreenshot',options),shot);assert.strictEqual(calls[0][1],options);
 await observeMetadata(f);const receipt=f.observer.exit(0);assertBrowserObservations(receipt,{identity:f.identity});assert.equal(receipt.counts.captures,4);assert.deepEqual(receipt.observations.find(row=>row.method==='evaluate'&&row.phase==='after').captures.map(row=>row.sha256),['frame-0','frame-1','angle'].map(sha));assert.equal(receipt.observations.find(row=>row.method==='cdp.Page.captureScreenshot'&&row.phase==='after').capture.sha256,sha('actual-cdp-bytes'));
});
test('browser response bytes and Node HTTP metadata remain distinct and both bind the accepted SOURCE hash',async t=>{
 const f=await prepareFake(t);await f.page.goto(OBSERVED_PUBLIC_BASE);f.page.evaluateReturn={state:'ready'};await f.page.evaluate(()=>null);
 const url=OBSERVED_PUBLIC_BASE+'build-info.json',response={url:()=>url,request:()=>({url:()=>url}),status:()=>200,buffer:async()=>new Uint8Array(f.metadata)};f.page.emit('response',response);await observeMetadata(f);
 await f.observer.flush('both-http-transports');const receipt=f.observer.exit(0);assertBrowserObservations(receipt,{identity:f.identity});assert.deepEqual(receipt.metadataResponses.map(row=>row.transport).sort(),['browser-response','node-fetch']);
});
test('browser close waits for pending cloned metadata bodies and preserves original close return',async t=>{
 const f=await prepareFake(t);await f.page.goto(OBSERVED_PUBLIC_BASE);f.page.evaluateReturn={state:'ready'};await f.page.evaluate(()=>null);let release,originalClosed=false;
 const response={status:200,url:OBSERVED_PUBLIC_BASE+'build-info.json',clone:()=>({body:{getReader:()=>({read:()=>new Promise(resolve=>{release=()=>resolve({value:f.metadata,done:false});})})}})};
 let reads=0;response.clone=()=>({body:{getReader:()=>({read:()=>++reads===1?new Promise(resolve=>{release=()=>resolve({value:f.metadata,done:false});}):Promise.resolve({done:true})})}});
 const target={fetch:async()=>response};f.observer.patchFetch(target);await target.fetch(response.url);const close=f.browser.close().then(value=>{originalClosed=true;return value;});await Promise.resolve();assert.equal(originalClosed,false);assert.equal(f.browser.closeCalls,0);release();assert.equal(await close,'browser-close-result');
 assert.equal(f.observer.snapshot('closed').pendingHTTPReads,0);assert.equal(JSON.parse(fs.readFileSync(f.output)).metadataResponses.length,1);
});
test('stalled observer HTTP body has a finite deadline and never prevents original browser cleanup',async t=>{
 const f=fixture(t),observer=createBrowserObserver({identity:f.identity,output:f.output,httpTimeoutMs:20}),page=new FakePage(),browser=new FakeBrowser(page),pp={launch:async()=>browser};observer.patchPuppeteer(pp,'fake');await pp.launch();await browser.newPage();await page.goto(OBSERVED_PUBLIC_BASE);page.evaluateReturn={state:'ready'};await page.evaluate(()=>null);let cancellations=0;
 const response={url:OBSERVED_PUBLIC_BASE+'build-info.json',status:200,clone:()=>({body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:async()=>{cancellations++;}})}})},target={fetch:async()=>response};observer.patchFetch(target);assert.strictEqual(await target.fetch(response.url),response);
 const started=Date.now();assert.equal(await browser.close(),'browser-close-result');assert.equal(browser.closeCalls,1);assert.ok(Date.now()-started<1000);assert.ok(cancellations>0);const receipt=observer.exit(0);assert.equal(receipt.pass,false);assert.ok(receipt.errors.some(row=>row.phase==='http-timeout'));assert.throws(()=>assertBrowserObservations(receipt,{identity:f.identity}));
});
test('observer description/write errors do not replace successful source values or prevent browser close',async t=>{
 const f=await prepareFake(t);await f.page.goto(OBSERVED_PUBLIC_BASE);const payload={frames:Array.from({length:6002},()=>({jpeg:'eA=='}))};f.page.evaluateReturn=payload;assert.strictEqual(await f.page.evaluate(()=>null),payload);assert.ok(f.observer.snapshot('description-limit').errors.some(row=>row.phase==='capture-description'));
 fs.symlinkSync(path.join(f.directory,'unowned-target'),f.output);assert.equal(await f.browser.close(),'browser-close-result');assert.equal(f.browser.closeCalls,1);fs.unlinkSync(f.output);assert.equal(f.observer.exit(0).pass,false);
});
test('wrong metadata body/hash/HTTP status/origin rejects observations without changing the response',async t=>{
 for(const variant of ['bytes','hash','status','origin','redirect']){const f=await prepareFake(t);await f.page.goto(OBSERVED_PUBLIC_BASE);f.page.evaluateReturn={state:'ready'};await f.page.evaluate(()=>null);
  const bytes=variant==='bytes'?Buffer.from('short'):variant==='hash'?Buffer.from(f.metadata.toString().replace('technical-never-present','x')):f.metadata;
  const changed=variant==='hash'?Buffer.from(f.metadata.map((byte,index)=>index===0?byte^1:byte)):bytes;const url=variant==='origin'?'http://127.0.0.1:4173/build-info.json':OBSERVED_PUBLIC_BASE+'build-info.json';
  const response=nodeResponse(changed,variant==='redirect'?'https://example.com/build-info.json':url,variant==='status'?201:200),target={fetch:async()=>response};f.observer.patchFetch(target);assert.strictEqual(await target.fetch(url),response);const receipt=await f.observer.flush('bad-metadata');assert.equal(receipt.pass,false);assert.throws(()=>assertBrowserObservations(receipt,{identity:f.identity}));}
});
test('nonmetadata localhost readiness HTTP is ignored while wrong mainframe navigation still rejects',async t=>{
 const f=await prepareFake(t),target={fetch:async()=>new Response('ready')};f.observer.patchFetch(target);assert.equal(await(await target.fetch('http://127.0.0.1:4173/')).text(),'ready');assert.equal(f.observer.snapshot('readiness').errors.length,0);
 await f.page.goto('http://127.0.0.1:4173/campaign-v55/');f.page.evaluateReturn={state:'ready'};await f.page.evaluate(()=>null);await observeMetadata(f);const receipt=await f.observer.flush('bad-navigation');assert.equal(receipt.pass,false);assert.throws(()=>assertBrowserObservations(receipt,{identity:f.identity}));
});
test('separate ESM and CJS Puppeteer exports are both patched, including actual bare ESM driver resolution',async t=>{
 const f=fixture(t),source=path.join(f.directory,'source'),pkg=path.join(source,'node_modules/puppeteer-core');fs.mkdirSync(pkg,{recursive:true});fs.writeFileSync(path.join(source,'package.json'),'{"type":"module"}');
 fs.writeFileSync(path.join(pkg,'package.json'),JSON.stringify({name:'puppeteer-core',version:'24.16.0',type:'module',exports:{'.':{import:'./esm.mjs',require:'./cjs.cjs'}}}));
 fs.writeFileSync(path.join(pkg,'esm.mjs'),'export default {launch: async () => globalThis.__observerFakeBrowser};');fs.writeFileSync(path.join(pkg,'cjs.cjs'),'module.exports={launch: async () => globalThis.__observerFakeBrowser};');
 const modules=await resolvePuppeteerModules(source);assert.notStrictEqual(modules.esm,modules.cjs);f.observer.patchPuppeteer(modules.esm,'actual-esm-path');f.observer.patchPuppeteer(modules.cjs,'actual-cjs-path');
 const browser=new FakeBrowser(new FakePage());globalThis.__observerFakeBrowser=browser;t.after(()=>{delete globalThis.__observerFakeBrowser;});fs.writeFileSync(path.join(source,'driver.mjs'),"import puppeteer from 'puppeteer-core';export const browser=await puppeteer.launch({});");
 const driver=await import(pathToFileURL(path.join(source,'driver.mjs')).href);assert.strictEqual(driver.browser,browser);assert.equal(f.observer.snapshot('dual-exports').launchAttempts[0].module,'actual-esm-path');assert.strictEqual(await modules.cjs.launch({}),browser);assert.equal(f.observer.snapshot('dual-exports').counts.startedBrowsers,1);assert.equal(f.observer.snapshot('dual-exports').counts.launches,2);
 const control=await verifyActualPuppeteerImportIdentity({sourceDirectory:source});assert.equal(control.pass,true);assert.equal(control.browserLaunches,0);assert.equal(control.esmDefaultIsObserverTarget,true);
});
test('changed caller metadata pin and immutable snapshot edits cannot forge the retained observation binding',async t=>{
 const f=await prepareFake(t);await f.page.goto(OBSERVED_PUBLIC_BASE);f.page.evaluateReturn={state:'ready'};await f.page.evaluate(()=>null);await observeMetadata(f);await f.observer.flush('good');const receipt=f.observer.exit(0);assertBrowserObservations(receipt,{identity:f.identity});
 const snapshot=f.observer.snapshot('process-exit');snapshot.metadataResponses[0].sha256='0'.repeat(64);assert.equal(f.observer.snapshot('fresh-copy').metadataResponses[0].sha256,f.identity.expectedBuildInfo.sha256);assert.throws(()=>assertBrowserObservations(snapshot,{identity:f.identity}));
 f.identity.expectedBuildInfo.sha256='0'.repeat(64);assert.throws(()=>assertBrowserObservations(receipt,{identity:f.identity}));
});
test('observer budget, output symlink and partial exit record cannot claim successful complete observations',async t=>{
 const f=fixture(t);assert.throws(()=>createBrowserObserver({identity:f.identity,output:f.output,maximumBytes:26000000}));fs.symlinkSync(path.join(f.directory,'target'),f.output);assert.throws(()=>createBrowserObserver({identity:f.identity,output:f.output}));fs.unlinkSync(f.output);
 const receipt=f.observer.exit(1);assert.equal(receipt.pass,false);assert.throws(()=>assertBrowserObservations(receipt,{identity:f.identity}));
});
test('final consumers reject intermediate receipts and a later nonzero source exit',async t=>{
 const f=await prepareFake(t);await f.page.goto(OBSERVED_PUBLIC_BASE);f.page.evaluateReturn={state:'ready'};await f.page.evaluate(()=>null);await observeMetadata(f);const intermediate=await f.observer.flush('after-browser-close');assert.equal(intermediate.pass,true);assert.throws(()=>assertBrowserObservations(intermediate,{identity:f.identity}),/Finalized process/);
 assertBrowserObservations(f.observer.exit(0),{identity:f.identity});const failed=f.observer.exit(1);assert.equal(failed.pass,false);assert.equal(failed.exitCode,1);assert.equal(JSON.parse(fs.readFileSync(f.output)).exitCode,1);assert.throws(()=>assertBrowserObservations(failed,{identity:f.identity}));
});
