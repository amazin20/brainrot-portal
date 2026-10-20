import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';

// Isolated P3 diagnostic only. Never changes Source, the package, the frozen
// server, the real observer, a receipt, or a publisher configuration.
const MODEL='models/runtime/model-01-player.glb';
const CANONICAL='https://amazin20.github.io/brainrot-portal/campaign-v61/'+MODEL;
const EXPECTED={bytes:549756,sha256:'e5b09ff0281377b679d6fdd505fa1ed89550bb662e94e7f593ed67ee50a66a91'};
const NO_ACCEPTANCE={diagnosticClassification:'LOCALDIAGNOSTIC',sourceAccepted:false,publicationAccepted:false,humanAccepted:false,publicAccepted:false};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const errorText=error=>String(error?.stack||error);
const save=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
async function deadline(promise,ms,label){
 let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timed out after '+ms+'ms')),ms);})]);}
 finally{clearTimeout(timer);}
}
const eventNames=['Network.requestWillBeSent','Network.responseReceived','Network.dataReceived','Network.loadingFinished','Network.loadingFailed'];

export function classifyMatrix(cases,header){
 const expectedGroups=['no-store-stream','no-cache-stream','public-stream','no-store-array-buffer','truncate-stream','abort-stream'];
 const structureValid=cases.length===12&&new Set(cases.map(row=>row.id)).size===12&&cases.every(row=>
  expectedGroups.includes(row.group)&&[1,2].includes(row.repeat)&&row.id===row.group+'-'+row.repeat&&row.pass===true&&
  Array.isArray(row.errors)&&row.errors.length===0&&Array.isArray(row.pageErrors)&&row.pageErrors.length===0);
 const groups=Object.fromEntries(expectedGroups.map(group=>[group,cases.filter(row=>row.group===group)]));
 const both=(group,predicate)=>groups[group].length===2&&groups[group].every(predicate);
 const controls=both('truncate-stream',row=>row.realTransportNegative===true)&&both('abort-stream',row=>row.realTransportNegative===true);
 const baseline=both('no-store-stream',row=>row.app?.exactModel===true&&row.app?.success===true&&row.originalResponse?.success===false&&row.originalResponse?.cacheControl==='no-store'&&
   row.originalResponse?.status===200&&row.originalResponse?.fromCache===false&&row.originalResponse?.fromServiceWorker===false&&
   row.nativeTerminal?.loadingFailed?.errorText==='net::ERR_ABORTED'&&row.nativeTerminal.failedCount===1&&row.nativeTerminal.finishedCount===0&&
   row.puppeteerTerminal?.event==='requestfailed'&&row.puppeteerTerminal?.failure?.errorText==='net::ERR_ABORTED'&&
   typeof row.originalResponse.error==='string'&&row.originalResponse.error.includes('No data found for resource with given identifier'));
 const comparators=['no-cache-stream','public-stream','no-store-array-buffer'].every(group=>both(group,row=>row.strictOriginalSuccess===true));
 const bound=header?.url===CANONICAL&&header?.sourceDistRelativePath===MODEL&&header?.status===200&&header?.matchesExactC===true&&header?.bytes===EXPECTED.bytes&&header?.sha256===EXPECTED.sha256&&
   typeof header.cacheControl==='string'&&header.cacheControl.length>0&&!header.cacheControl.toLowerCase().split(',').some(x=>x.trim()==='no-store');
 const decisive=structureValid&&controls&&baseline&&comparators&&bound;
 return {decisive,cacheControl:decisive?header.cacheControl:null,negativeControlsPassed:controls,
  baselineCases:groups['no-store-stream'].map(row=>row.id),requiredPublicCases:groups['public-stream'].map(row=>row.id),
  reason:decisive?'Both no-store/actual-reader trials reached exact application EOF but failed the original native/Puppeteer terminal and body; all paired no-cache, observed-public-header and native-arrayBuffer controls succeeded; genuine truncated and aborted transfers failed. This establishes an observed cache-policy/runtime interaction, not its Chromium implementation cause.':
   'The complete paired controls did not establish the required cache-policy distinction. Preserve all failures; no public-header observer mount is authorized by this diagnostic.'};
}

// Writes the real model in multiple paced chunks. The truncation closes the TCP
// response before its declared Content-Length; abort uses the browser's actual
// AbortController. Server write counts describe attempted writes, not delivery.
export async function createMatrixServer(model){
 const observations=new Map();
 const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'}).end('<!doctype html><title>LOCALDIAGNOSTIC network body matrix</title>');return;}
  let spec;try{spec=JSON.parse(Buffer.from(new URL(req.url,'http://localhost').pathname.slice(1),'base64url').toString('utf8'));}catch{}
  if(!spec||!spec.id||!['normal','truncate','abort'].includes(spec.transport)||typeof spec.cacheControl!=='string'||/[\r\n]/.test(spec.cacheControl)){res.writeHead(404).end();return;}
  const observation={id:spec.id,requestURL:req.url,requestHeaders:req.headers,cacheControl:spec.cacheControl,expectedBytes:model.length,
   expectedSha256:sha(model),transport:spec.transport,attemptedBytes:0,chunks:[],events:[]};observations.set(spec.id,observation);
  req.on('aborted',()=>observation.events.push({event:'request-aborted',at:performance.now()}));
  res.on('finish',()=>observation.events.push({event:'response-finish',at:performance.now()}));
  res.on('close',()=>observation.events.push({event:'response-close',at:performance.now(),writableFinished:res.writableFinished}));
  res.on('error',error=>observation.events.push({event:'response-error',error:errorText(error),at:performance.now()}));
  res.writeHead(200,{'Content-Type':'model/gltf-binary','Content-Length':model.length,'Cache-Control':spec.cacheControl});
  (async()=>{
   const limit=spec.transport==='truncate'?Math.floor(model.length/2):model.length;
   for(let offset=0;offset<limit;offset+=65536){
    if(res.destroyed)break;const chunk=model.subarray(offset,Math.min(offset+65536,limit));
    observation.chunks.push(chunk.length);observation.attemptedBytes+=chunk.length;
    res.write(chunk);await sleep(offset===0?60:8);
   }
   if(!res.destroyed){if(spec.transport==='truncate'){observation.intentionalTruncation=true;res.destroy();}else res.end();}
  })().catch(error=>{observation.serverError=errorText(error);res.destroy(error);});
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {server,observations,base:`http://127.0.0.1:${server.address().port}/`};
}

async function canonicalBinding(model,out){
 // A separate, one-shot canonical control. It never substitutes for a failed
 // original request, and no conditional request/retry/alternate URL is used.
 const started=new Date().toISOString();
 const response=await fetch(CANONICAL,{redirect:'error',signal:AbortSignal.timeout(60000)});
 const bytes=Buffer.from(await response.arrayBuffer());
 const binding={...NO_ACCEPTANCE,url:CANONICAL,status:response.status,started,finished:new Date().toISOString(),
  headers:Object.fromEntries(response.headers),bytes:bytes.length,sha256:sha(bytes),cacheControl:response.headers.get('cache-control'),
  sourceDistRelativePath:MODEL,matchesExactC:bytes.equals(model),bodyFile:'original-canonical-v61-model.glb',
  semantics:'One original read-only canonical v61 response. Header/unchanged-byte control only; never proof of any other request body.'};
 fs.writeFileSync(path.join(out,binding.bodyFile),bytes);save(path.join(out,'canonical-v61-response-headers.json'),binding);
 assert.equal(binding.status,200);assert.equal(binding.bytes,EXPECTED.bytes);assert.equal(binding.sha256,EXPECTED.sha256);assert.equal(binding.matchesExactC,true);
 assert.ok(typeof binding.cacheControl==='string'&&binding.cacheControl.length>0&&binding.cacheControl.length<=512&&!/[\r\n]/.test(binding.cacheControl));
 return binding;
}

async function runCase(browser,mount,spec,actualFunction,out){
 const caseOut=path.join(out,spec.id);fs.mkdirSync(caseOut,{recursive:true});
 const row={...NO_ACCEPTANCE,...spec,pass:false,strictOriginalSuccess:false,app:null,originalResponse:null,nativeTerminal:null,puppeteerTerminal:null,
  rawCdpEvents:[],requestEvents:[],pageErrors:[],errors:[]};
 const context=await browser.createBrowserContext();let page;const clients=new Map();let bodyPromise=null,requestId=null,clientIdentity=null;
 const attach=client=>{
  if(clients.has(client))return clients.get(client).identity;
  const identity={sessionId:typeof client.id==='function'?client.id():null,diagnosticOrdinal:clients.size+1};
  const listeners=eventNames.map(name=>{const fn=event=>row.rawCdpEvents.push({event:name,session:identity,observedAt:performance.now(),value:event});client.on(name,fn);return[name,fn];});
  clients.set(client,{identity,listeners});return identity;
 };
 try{
  page=await context.newPage();await page.setCacheEnabled(false);
  row.pageTargetId=page.target()._targetId??null;
  const url=new URL(Buffer.from(JSON.stringify({id:spec.id,transport:spec.transport,cacheControl:spec.cacheControl})).toString('base64url'),mount.base).href;row.url=url;
  page.on('pageerror',error=>row.pageErrors.push(errorText(error)));
  page.on('request',request=>{
   const session=attach(request.client);
   if(request.url()!==url)return;
   assert.equal(requestId,null,'More than one original model request');requestId=request.id;clientIdentity=session;
   row.requestEvents.push({event:'request',requestId,session,url:request.url(),method:request.method(),headers:request.headers(),at:performance.now()});
  });
  const terminal=(event,request)=>{if(request.url()===url){row.puppeteerTerminal={event,requestId:request.id,session:attach(request.client),failure:request.failure(),at:performance.now()};row.requestEvents.push(row.puppeteerTerminal);}};
  page.on('requestfinished',request=>terminal('requestfinished',request));page.on('requestfailed',request=>terminal('requestfailed',request));
  page.on('response',response=>{
   if(response.url()!==url)return;
   const request=response.request(),session=attach(request.client);
   assert.equal(bodyPromise,null,'More than one original model response');
   row.originalResponse={url:response.url(),status:response.status(),headers:response.headers(),cacheControl:response.headers()['cache-control']??null,requestId:request.id,session,
    fromCache:response.fromCache(),fromServiceWorker:response.fromServiceWorker(),success:false,bodyReadAttempts:1};
   bodyPromise=(async()=>{
    try{const bytes=await response.buffer();Object.assign(row.originalResponse,{success:true,bytes:bytes.length,sha256:sha(bytes),bodyFile:'original-response.bin'});
     fs.writeFileSync(path.join(caseOut,'original-response.bin'),bytes);
    }catch(error){row.originalResponse.error=errorText(error);}
   })();
  });
  await page.goto(mount.base,{waitUntil:'load',timeout:30000});
  row.app=await deadline(page.evaluate(async({url,functionText,reader,abort})=>{
   const result={reader,success:false,eof:false,chunks:[],abortRequested:false,bytes:null,sha256:null,error:null};
   const controller=new AbortController();
   try{
    let buffer;
    if(reader==='actual-fetchModelBytes'){
     const actual=(0,eval)('('+functionText+')');
     buffer=await actual(url,{signal:controller.signal,onBytes:bytes=>{result.chunks.push(bytes);if(abort&&!result.abortRequested){result.abortRequested=true;controller.abort();}}});
    }else{
     const response=await fetch(url,{signal:controller.signal,cache:'default'});if(!response.ok)throw new Error('HTTP '+response.status);
     buffer=await response.arrayBuffer();
    }
    result.eof=true;result.bytes=buffer.byteLength;result.sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),v=>v.toString(16).padStart(2,'0')).join('');result.success=true;
   }catch(error){result.error={name:error.name,message:error.message,stack:error.stack};}
   return result;
  },{url,functionText:actualFunction,reader:spec.reader,abort:spec.transport==='abort'}),30000,'Application original fetch');
  row.app.exactModel=row.app.success&&row.app.bytes===EXPECTED.bytes&&row.app.sha256===EXPECTED.sha256;
  await deadline((async()=>{while(!row.puppeteerTerminal||!bodyPromise)await sleep(10);await bodyPromise;})(),30000,'Original request terminal/body');
  row.requestId=requestId;row.sameClient=clientIdentity;
  const sameEvents=row.rawCdpEvents.filter(event=>event.value.requestId===requestId&&event.session.diagnosticOrdinal===clientIdentity?.diagnosticOrdinal);
  const finished=sameEvents.filter(event=>event.event==='Network.loadingFinished'),failed=sameEvents.filter(event=>event.event==='Network.loadingFailed');
  row.nativeTerminal={loadingFinished:finished.at(-1)?.value??null,loadingFailed:failed.at(-1)?.value??null,finishedCount:finished.length,failedCount:failed.length};
  row.strictOriginalSuccess=row.app.exactModel===true&&row.originalResponse?.success===true&&row.originalResponse.bytes===EXPECTED.bytes&&row.originalResponse.sha256===EXPECTED.sha256&&
   row.originalResponse.status===200&&row.originalResponse.cacheControl===spec.cacheControl&&row.originalResponse.fromCache===false&&row.originalResponse.fromServiceWorker===false&&row.puppeteerTerminal?.event==='requestfinished'&&finished.length===1&&failed.length===0&&row.pageErrors.length===0;
  const originalExact=row.originalResponse?.success===true&&row.originalResponse.bytes===EXPECTED.bytes&&row.originalResponse.sha256===EXPECTED.sha256;
  row.realTransportNegative=spec.transport!=='normal'&&row.app.success===false&&!originalExact&&row.puppeteerTerminal?.event==='requestfailed'&&failed.length===1&&finished.length===0&&
   (spec.transport==='truncate'?row.app.error?.name==='TypeError':row.app.abortRequested===true&&row.app.error?.name==='AbortError');
  // Completion describes a measured case, including an honestly retained
  // baseline fault; it never promotes that original request to success.
  row.pass=row.errors.length===0&&!!row.nativeTerminal&&(spec.transport==='normal'||row.realTransportNegative);
 }catch(error){row.errors.push(errorText(error));}
 finally{
  if(bodyPromise)try{await deadline(bodyPromise,5000,'Final original body settlement');}catch(error){row.errors.push(errorText(error));}
  try{await context.close();}catch(error){row.errors.push(errorText(error));}
  for(const[client,{listeners}]of clients)for(const[name,fn]of listeners)client.off(name,fn);
  row.server=mount.observations.get(spec.id)??null;
  if(spec.transport!=='normal'){
   const applicationPartialBytes=row.app?.chunks?.reduce((sum,bytes)=>sum+bytes,0)??0;
   row.realTransportNegative=row.realTransportNegative===true&&applicationPartialBytes>0&&applicationPartialBytes<EXPECTED.bytes&&row.server?.attemptedBytes>0&&row.server.attemptedBytes<EXPECTED.bytes&&
    row.server.events.some(event=>event.event==='response-close'&&event.writableFinished===false)&&
    (spec.transport==='truncate'?row.server.intentionalTruncation===true:row.app?.abortRequested===true);
   row.pass=row.pass&&row.realTransportNegative;
  }
  row.pass=row.pass&&row.errors.length===0;save(path.join(caseOut,'case.json'),row);
 }
 return row;
}

export async function runNetworkBodyMatrix({sourceRoot,dist,out,chromePath}){
 sourceRoot=path.resolve(sourceRoot);dist=path.resolve(dist);out=path.resolve(out);fs.mkdirSync(out,{recursive:true});
 const report={schemaVersion:1,kind:'v62-p3-original-network-body-matrix',...NO_ACCEPTANCE,pass:false,started:new Date().toISOString(),
  scope:'New isolated diagnostic only. Original same-client response bodies and native terminals remain distinct from application EOF. A separate canonical accepted-v61 GET supplies only a byte-bound cache-header control. No request is retried or replaced.',
  expectedModel:{...EXPECTED,sourceDistRelativePath:MODEL},cases:[],errors:[],publicHeaderBinding:null,
  decisiveCacheHeader:{decisive:false,cacheControl:null,negativeControlsPassed:false,reason:'Matrix has not completed.'}};
 let browser,mount;const persist=()=>save(path.join(out,'network-body-matrix.json'),report);persist();
 try{
  const model=fs.readFileSync(path.join(dist,MODEL));assert.equal(model.length,EXPECTED.bytes);assert.equal(sha(model),EXPECTED.sha256);
  const sourcePath=path.join(sourceRoot,'src/game/LabAssetLoader.js'),sourceBytes=fs.readFileSync(sourcePath);
  const {fetchModelBytes}=await import(pathToFileURL(sourcePath).href);assert.equal(typeof fetchModelBytes,'function');const actualFunction=fetchModelBytes.toString();
  report.actualSource={path:'src/game/LabAssetLoader.js',bytes:sourceBytes.length,sha256:sha(sourceBytes),function:'fetchModelBytes',functionBytes:Buffer.byteLength(actualFunction),functionSha256:sha(actualFunction),actualFunctionFile:'actual-fetchModelBytes.js'};
  fs.writeFileSync(path.join(out,'actual-fetchModelBytes.js'),actualFunction+'\n');
  const packageRoot=path.join(sourceRoot,'node_modules/puppeteer-core'),packageFile=path.join(packageRoot,'package.json');
  const packageBytes=fs.readFileSync(packageFile),pkg=JSON.parse(packageBytes);assert.equal(pkg.version,'24.16.0');
  let entry=pkg.exports?.['.']?.import;
  while(entry&&typeof entry==='object')entry=entry.default||entry.node||entry.import;
  assert.equal(typeof entry,'string');const entryFile=path.resolve(packageRoot,entry);assert.ok(entryFile.startsWith(packageRoot+path.sep));
  const puppeteer=(await import(pathToFileURL(entryFile).href)).default;
  report.puppeteer={name:pkg.name,version:pkg.version,packageBytes:packageBytes.length,packageSha256:sha(packageBytes),
   entry:path.relative(packageRoot,entryFile).split(path.sep).join('/'),entryBytes:fs.statSync(entryFile).size,entrySha256:sha(fs.readFileSync(entryFile))};
  report.publicHeaderBinding=await canonicalBinding(model,out);persist();
  browser=await puppeteer.launch({executablePath:chromePath,headless:true,protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const browserClient=await browser.target().createCDPSession();
  report.browser={version:await browser.version(),protocol:await browserClient.send('Browser.getVersion'),executablePath:chromePath};await browserClient.detach();
  mount=await createMatrixServer(model);report.localBase=mount.base;
  const specs=[];for(let repeat=1;repeat<=2;repeat++)for(const[group,cacheControl,reader,transport]of[
   ['no-store-stream','no-store','actual-fetchModelBytes','normal'],['no-cache-stream','no-cache','actual-fetchModelBytes','normal'],
   ['public-stream',report.publicHeaderBinding.cacheControl,'actual-fetchModelBytes','normal'],['no-store-array-buffer','no-store','native-arrayBuffer','normal'],
   ['truncate-stream','no-cache','actual-fetchModelBytes','truncate'],['abort-stream','no-cache','actual-fetchModelBytes','abort']])specs.push({id:group+'-'+repeat,group,repeat,cacheControl,reader,transport});
  for(const spec of specs){const row=await runCase(browser,mount,spec,actualFunction,out);report.cases.push(row);persist();console.log(JSON.stringify({diagnosticClassification:'LOCALDIAGNOSTIC',case:row.id,measured:row.pass,appExact:row.app?.exactModel??false,strictOriginalSuccess:row.strictOriginalSuccess,nativeTerminal:row.nativeTerminal}));}
  report.decisiveCacheHeader=classifyMatrix(report.cases,report.publicHeaderBinding);
  report.pass=report.cases.length===12&&report.cases.every(row=>row.pass)&&report.decisiveCacheHeader.negativeControlsPassed;
 }catch(error){report.errors.push(errorText(error));}
 finally{
  if(browser)try{await browser.close();}catch(error){report.errors.push(errorText(error));}
  if(mount)try{await new Promise((resolve,reject)=>mount.server.close(error=>error?reject(error):resolve()));}catch(error){report.errors.push(errorText(error));}
  report.pass=report.pass&&report.errors.length===0;report.finished=new Date().toISOString();persist();
 }
 return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const options={};for(let i=2;i<process.argv.length;i+=2){assert.ok(['--source-root','--dist','--out','--chrome-path'].includes(process.argv[i]),'Unknown argument');assert.ok(process.argv[i+1]&&!process.argv[i+1].startsWith('--'),'Missing argument');options[process.argv[i]]=process.argv[i+1];}
 for(const key of ['--source-root','--dist','--out','--chrome-path'])assert.ok(options[key],key+' required');
 const report=await runNetworkBodyMatrix({sourceRoot:options['--source-root'],dist:options['--dist'],out:options['--out'],chromePath:options['--chrome-path']});
 console.log(JSON.stringify({diagnosticClassification:'LOCALDIAGNOSTIC',pass:report.pass,decisiveCacheHeader:report.decisiveCacheHeader}));if(!report.pass)process.exitCode=1;
}
