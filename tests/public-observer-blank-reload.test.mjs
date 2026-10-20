import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';

const source=fs.readFileSync(new URL('../scripts/observe-campaign-v63-public.mjs',import.meta.url),'utf8');
const start=source.indexOf('function installCandidateResponseBodyObserver('),end=source.indexOf('\nlet pageCount=0;',start);
assert.ok(start>=0&&end>start);
// Execute the actual wrapper without the publisher entry point or credentials.
const install=vm.runInNewContext('('+source.slice(start,end)+')',{assert,setTimeout,clearTimeout,URL,Buffer,DURABLE_RESPONSE_BUFFER:{enableDurableMessages:true}});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const base='https://candidate.invalid/campaign-v63/',body=Buffer.from('actual frozen candidate bytes');
const buildInfo=JSON.stringify({commit:'accepted-source'});

class Page extends EventEmitter{
 constructor(){super();this.current='about:blank';this.reloads=0;this.closed=false;this.nextBody=body;}
 url(){return this.current;}
 isClosed(){return this.closed;}
 async setCacheEnabled(){}
 _client(){return{send:async()=>{}};}
 async waitForNetworkIdle(){}
 async evaluate(_fn,url){return{url,status:200,body:buildInfo};}
 deliver(bytes=body){
  const request={};this.emit('request',request);
  this.emit('response',{url:()=>base,status:()=>200,fromCache:()=>false,buffer:async()=>{await Promise.resolve();this.emit('requestfinished',request);return bytes;}});
 }
 async goto(url){this.current=url;this.deliver(this.nextBody);return{kind:'candidate-navigation'};}
 async reload(){this.reloads++;if(this.current!== 'about:blank')this.deliver(this.nextBody);if(this.reloadDestination)this.current=this.reloadDestination;return null;}
 async close(){this.closed=true;}
}
function fixture(){
 const pages=[],pending=[],network=[],failures=[],stampReads=[];let count=0;
 const browser={newPage:async()=>{const p=new Page();pages.push(p);return p;},createBrowserContext:async()=>({newPage:async()=>{const p=new Page();pages.push(p);return p;},close:async()=>{}}),close:async()=>{for(const p of pages)p.closed=true;}};
 install(browser,{base,members:new Map([[base,{bytes:body.length,sha256:hash(body)}]]),sha:hash,prepared:{originalBuildInfoSha256:hash(buildInfo)},config:{sourceCommit:'accepted-source'},pending,network,failures,stampReads,onPage:()=>++count});
 return{browser,pending,network,failures,stampReads};
}

test('fresh mobile-emulation blank reload creates no candidate or stamp evidence',async()=>{
 const f=fixture(),page=await f.browser.newPage();
 assert.equal(await page.reload(),null);assert.equal(page.reloads,1);assert.equal(page.url(),'about:blank');
 assert.equal(f.pending.length,0);assert.deepEqual(f.network,[]);assert.deepEqual(f.stampReads,[]);assert.deepEqual(f.failures,[]);
 await page.goto(base);await page.reload();await f.browser.drainCandidateResponseBodies();
 assert.equal(page.reloads,2);assert.equal(f.network.length,2);assert.equal(f.stampReads.length,2);
 assert.ok(f.network.every(row=>row.sha256===hash(body)&&row.bytes===body.length));
});

test('pre-navigation reload rejects nonblank targets before invoking native reload',async()=>{
 for(const url of[base,'https://foreign.invalid/','data:text/html,foreign','about:blank#fragment','about:blank?query']){
  const f=fixture(),page=await f.browser.newPage();page.current=url;
  await assert.rejects(page.reload(),/Reload before a candidate navigation/,url);assert.equal(page.reloads,0,url);
  assert.equal(f.pending.length,0);assert.deepEqual(f.network,[]);assert.deepEqual(f.stampReads,[]);
 }
});

test('blank exception cannot hide candidate response tasks or preexisting stamp evidence',async()=>{
 const f=fixture(),page=await f.browser.newPage();page.deliver();
 await assert.rejects(page.reload(),/Blank target already received candidate bytes/);
 assert.equal(page.reloads,0);assert.equal(f.network.length,1);assert.deepEqual(f.stampReads,[]);
 const other=fixture(),otherPage=await other.browser.newPage();other.stampReads.push({page:1});
 await assert.rejects(otherPage.reload(),/Blank target already recorded a candidate stamp/);assert.equal(otherPage.reloads,0);
});

test('native blank reload may not navigate to a candidate or foreign document',async()=>{
 for(const url of[base,'https://foreign.invalid/']){
  const f=fixture(),page=await f.browser.newPage();page.reloadDestination=url;
  await assert.rejects(page.reload(),/exact fresh blank target/);assert.equal(page.reloads,1);
  assert.deepEqual(f.network,[]);assert.deepEqual(f.stampReads,[]);
 }
});

test('another page evidence does not stamp or invalidate a new blank mobile target',async()=>{
 const f=fixture(),first=await f.browser.newPage();await first.goto(base);await f.browser.drainCandidateResponseBodies();
 const second=await f.browser.newPage();await second.reload();
 assert.equal(f.pending.length,1);assert.equal(f.network.length,1);assert.equal(f.network[0].page,1);assert.equal(f.stampReads.length,1);assert.equal(f.stampReads[0].page,1);
 await second.goto(base);await f.browser.drainCandidateResponseBodies();assert.equal(f.network.at(-1).page,2);assert.equal(f.stampReads.at(-1).page,2);
});

test('started candidate reload retains body and source-stamp rejection',async()=>{
 const f=fixture(),page=await f.browser.newPage();await page.goto(base);page.nextBody=Buffer.from('changed');
 await page.reload();await assert.rejects(f.browser.drainCandidateResponseBodies(),/candidate response failed/);
 assert.equal(f.network.length,1);assert.equal(f.stampReads.length,2);assert.ok(f.failures.some(value=>value.includes('response body')));
 const wrongStamp=fixture(),other=await wrongStamp.browser.newPage();await other.goto(base);
 other.evaluate=async(_fn,url)=>({url,status:200,body:JSON.stringify({commit:'different-source'})});
 await assert.rejects(other.reload());assert.equal(wrongStamp.stampReads.length,1);
});
