import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const playwrightModule=process.env.PLAYWRIGHT_MODULE||(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES&&path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs'))||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(pathToFileURL(playwrightModule));
import {serveFrozenCampaign} from '../../../scripts/lib/frozen-campaign-server.mjs';
import {fetchModelBytes} from '../../../src/game/LabAssetLoader.js';

// CHROME_PATH=/path/to/chrome node diagnose.mjs /absolute/new/output-directory
assert.ok(process.argv[2]&&process.env.CHROME_PATH,'Provide a new output directory and CHROME_PATH');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),out=path.resolve(process.argv[2]),chrome=path.resolve(process.env.CHROME_PATH);
assert.ok(!fs.existsSync(out));fs.mkdirSync(out);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const models=JSON.parse(fs.readFileSync(path.join(root,'dist/models/runtime/manifest.json'))).models.filter(model=>[1,2,11,22].includes(model.id));
const report={scope:'Isolated actual model-byte transfers; no game or production modification. Exact production streamed fetch function versus arrayBuffer and CDP body observation.',chromeSha256:sha(fs.readFileSync(chrome)),loaderSha256:sha(fs.readFileSync(path.join(root,'src/game/LabAssetLoader.js'))),models,cases:[],pass:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
let frozen,bs,timer;
try{
 frozen=await serveFrozenCampaign(path.join(root,'dist'));
 bs=await chromium.launchServer({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 timer=setTimeout(()=>{report.deadline=true;void bs.kill();},45000);
 const browser=await chromium.connect(bs.wsEndpoint());
 for(const config of [
  {mode:'arrayBuffer',durable:false,readCdp:true,gc:false},
  {mode:'production-stream',durable:false,readCdp:true,gc:false},
  {mode:'production-stream',durable:false,readCdp:false,gc:true},
  {mode:'production-stream',durable:true,readCdp:true,gc:true},
 ]){
  const row={config,events:[],cdpBodies:[],pageResponses:[],pageFailures:[]},context=await browser.newContext(),page=await context.newPage();report.cases.push(row);const tasks=new Set(),cdp=await context.newCDPSession(page),requests=new Map();
  const retain=p=>{tasks.add(p);void p.finally(()=>tasks.delete(p));};
  cdp.on('Network.requestWillBeSent',event=>{if(!event.request.url.includes('.glb'))return;requests.set(event.requestId,event.request.url);row.events.push({kind:'request',requestId:event.requestId,url:event.request.url,timestamp:event.timestamp});});
  cdp.on('Network.responseReceived',event=>{if(!requests.has(event.requestId))return;row.events.push({kind:'response',requestId:event.requestId,status:event.response.status,timestamp:event.timestamp,mimeType:event.response.mimeType,fromDiskCache:event.response.fromDiskCache,fromServiceWorker:event.response.fromServiceWorker});});
  for(const eventName of ['Network.loadingFinished','Network.loadingFailed'])cdp.on(eventName,event=>{
   if(!requests.has(event.requestId))return;row.events.push({kind:eventName.split('.')[1],...event});
   if(config.readCdp)retain(cdp.send('Network.getResponseBody',{requestId:event.requestId}).then(body=>{const bytes=Buffer.from(body.body,body.base64Encoded?'base64':'utf8');row.cdpBodies.push({requestId:event.requestId,url:requests.get(event.requestId),bytes:bytes.length,sha256:sha(bytes)});}).catch(error=>row.cdpBodies.push({requestId:event.requestId,url:requests.get(event.requestId),error:String(error)})));
  });
  page.on('response',response=>{if(response.url().includes('.glb'))row.pageResponses.push({url:response.url(),status:response.status()});});
  page.on('requestfailed',request=>{if(request.url().includes('.glb'))row.pageFailures.push({url:request.url(),failure:request.failure()});});
  await cdp.send('Network.enable',config.durable?{maxTotalBufferSize:134217728,maxResourceBufferSize:67108864,enableDurableMessages:true}:{});
  await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await page.goto(frozen.url+'models/runtime/manifest.json',{waitUntil:'load'});
  const urls=models.map(model=>frozen.url+'models/runtime/'+model.filename+'?v='+model.outputSHA256.slice(0,12));
  row.actualBodies=await page.evaluate(async({mode,source,urls})=>{
   const exactFetch=(0,eval)('('+source+')');
   return Promise.all(urls.map(async url=>{
    const chunks=[];let buffer;
    if(mode==='production-stream')buffer=await exactFetch(url,{onBytes:bytes=>chunks.push(bytes)});
    else {const response=await fetch(url,{cache:'default'});if(!response.ok)throw Error('HTTP '+response.status);buffer=await response.arrayBuffer();}
    const hash=await crypto.subtle.digest('SHA-256',buffer);
    return {url,bytes:buffer.byteLength,sha256:[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join(''),chunks};
   }));
  },{mode:config.mode,source:fetchModelBytes.toString(),urls});
  if(config.gc)await cdp.send('HeapProfiler.collectGarbage');
  await page.waitForLoadState('networkidle');while(tasks.size)await Promise.all([...tasks]);
  for(const actual of row.actualBodies){const expected=models.find(model=>actual.url.includes('/'+model.filename+'?'));assert.equal(actual.bytes,expected.outputBytes);assert.equal(actual.sha256,expected.outputSHA256);}
  for(const body of row.cdpBodies)if(!body.error){const actual=row.actualBodies.find(item=>item.url===body.url);assert.ok(actual);assert.equal(body.bytes,actual.bytes);assert.equal(body.sha256,actual.sha256);}
  row.allActualComplete=true;save();await context.close();
 }
 report.pass=report.cases.every(row=>row.allActualComplete);
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{clearTimeout(timer);if(bs){await bs.close();report.browserExit={code:bs.process().exitCode,signal:bs.process().signalCode};}if(frozen)await new Promise(resolve=>frozen.server.close(resolve));save();}
console.log(JSON.stringify({pass:report.pass,error:report.error,cases:report.cases.map(row=>({config:row.config,failures:row.pageFailures.length,finished:row.events.filter(event=>event.kind==='loadingFinished').length,failed:row.events.filter(event=>event.kind==='loadingFailed').length,completeBodies:row.actualBodies?.length,cdpReadFailures:row.cdpBodies.filter(body=>body.error).length})),out}));
