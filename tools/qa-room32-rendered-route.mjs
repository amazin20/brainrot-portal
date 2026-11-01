/** Reproducible native room32 route capture from a built production packet.
 *
 * CHROME_PATH=/path/to/chrome node tools/qa-room32-rendered-route.mjs \
 *   --dist /absolute/path/to/dist --out /absolute/new/output/directory
 *
 * Uses the shipped ordinary-input route, normal Play spawns and original GLBs.
 * This is a bounded software-WebGL route check, not a human playtest, device
 * benchmark, complete room-appearance approval or publication gate.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {buildSourceInputs} from '../scripts/lib/release-manifest.mjs';
import {campaignAccessFixture} from '../scripts/lib/campaign-access-fixture.mjs';
import {serveFrozenCampaign} from '../scripts/lib/frozen-campaign-server.mjs';
import {DURABLE_RESPONSE_BUFFER} from '../scripts/lib/browser-response-lifecycle.mjs';
import {campaignSpec} from '../src/game/LabCampaignLevels.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {suppressRoom32RouteRafAtReady,installRoom32NativeWaypointProbe} from './lib/qa-room32-native-probe.mjs';
import {inspectNativePng} from './lib/qa-native-png.mjs';

const sourceRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
const limits={maxPhysicsSteps:12000,maxVisualFrames:6000,maxPngBytes:25165824,maxSinglePngBytes:6291456};

function inventory(root,prefix=''){
 return fs.readdirSync(path.join(root,prefix),{withFileTypes:true}).flatMap(entry=>{
  assert.equal(entry.isSymbolicLink(),false,'No symlink in production packet');
  const relative=prefix?prefix+'/'+entry.name:entry.name;
  if(entry.isDirectory())return inventory(root,relative);
  const bytes=fs.readFileSync(path.join(root,relative));
  return [{path:relative,bytes:bytes.length,sha256:sha(bytes)}];
 }).sort((a,b)=>a.path.localeCompare(b.path));
}

function parseArguments(args){
 const config={dist:path.join(sourceRoot,'dist'),out:null,chrome:process.env.CHROME_PATH,maxWallMs:180000,memoryLimitBytes:6*1024**3};
 for(let i=0;i<args.length;i++){
  assert.ok(['--dist','--out','--chrome'].includes(args[i]),'Known option required: '+args[i]);
  assert.ok(args[i+1]&&!args[i+1].startsWith('--'),'Option requires a path');
  config[args[i].slice(2)]=path.resolve(args[++i]);
 }
 assert.ok(config.out&&path.isAbsolute(config.out)&&!fs.existsSync(config.out),'Use a new absolute --out directory; previous attempts are never overwritten');
 assert.ok(config.chrome&&fs.statSync(config.chrome).isFile(),'Set CHROME_PATH or --chrome to an installed Chromium executable');
 config.chrome=path.resolve(config.chrome);config.dist=path.resolve(config.dist);
 assert.ok(fs.statSync(path.join(config.dist,'index.html')).isFile(),'Build production dist before capture');
 assert.ok(!config.out.startsWith(config.dist+path.sep),'Capture output must be outside the frozen production packet');
 return config;
}

async function playwright(){
 const modules=[process.env.PLAYWRIGHT_MODULE,process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES&&path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs'),'playwright','/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'].filter(Boolean);
 let last;
 for(const module of modules)try{return await import(path.isAbsolute(module)?pathToFileURL(module).href:module);}catch(error){last=error;}
 throw new Error('Install Playwright or set PLAYWRIGHT_MODULE to its index.mjs',{cause:last});
}

export async function runRoom32RenderedRoute(args=process.argv.slice(2)){
 const config=parseArguments(args),sourceManifest=buildSourceInputs(sourceRoot),distManifest=inventory(config.dist),files=new Map(distManifest.map(row=>[row.path,row]));
 fs.mkdirSync(config.out,{recursive:true});
 const report={kind:'room32-rendered-canonical-route-v4',startedAt:new Date().toISOString(),pass:false,routeCapturePass:false,receivedSourceBytesPass:false,verifiedSourceBytes:false,verifiedRouteEvidencePass:false,rawNoAbortNetworkPass:false,
  strictHistoricalNetworkAuditAccepted:false,humanVisualAccepted:false,all51Accepted:false,published:false,
  scope:'One native ordinary-input canonical route and four original WebGL PNGs. Model/physics ownership is checked each step; complete material/attribute descriptors at milestones and boundaries; original buffer SHA-256 before and after. Complete received source bytes use one durable CDP session and exact request IDs, without request interception. Raw aborted transfers remain recorded and keep rawNoAbortNetworkPass/pass false even when their exact complete original GLB or Draco decoder bytes and decoded model binding are proved. This does not replace the historical strict network lifecycle audit.',
  config,limits,sourceManifestSha256:sha(JSON.stringify(sourceManifest)),distManifestSha256:sha(JSON.stringify(distManifest)),
  controllerSha256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),probeSha256:sha(fs.readFileSync(path.join(sourceRoot,'tools/lib/qa-room32-native-probe.mjs'))),
  chromeSha256:sha(fs.readFileSync(config.chrome)),requests:[],responses:[],networkTrace:[],responseMetadata:[],sourceBodyErrors:[],byteCompleteAbortedGLBs:[],byteCompleteAbortedAssets:[],networkErrors:[],pageErrors:[],consoleErrors:[],images:[],errors:[],
  resource:{memoryLimitBytes:config.memoryLimitBytes,maxWallMs:config.maxWallMs,peakCgroupBytes:0,peakControllerRssBytes:0,aborted:false,deadline:false},closures:[]};
 write(path.join(config.out,'source-manifest.json'),sourceManifest);write(path.join(config.out,'dist-manifest.json'),distManifest);
 const save=()=>write(path.join(config.out,'report.json'),report);save();
 let server,browserServer,browser,page,owned,watchdog,deadline,closing=false,closed=false;
 const pending=new Set(),nativeRequests=new Map(),mount='/campaign-v67/';
 const ownAsset=url=>{
  const parsed=new URL(url);if(!server||parsed.origin!==`http://127.0.0.1:${server.address().port}`||!parsed.pathname.startsWith(mount))return null;
  const relative=decodeURIComponent(parsed.pathname.slice(mount.length))||'index.html';return files.get(relative)??null;
 };
 function saveImages(result){
  for(const frame of result?.images??[]){
   if(report.images.some(item=>item.key===frame.key))continue;
   assert.match(frame.key,/^0[1-4]-[a-z-]+$/);assert.match(frame.png,/^data:image\/png;base64,/);
   const bytes=Buffer.from(frame.png.slice('data:image/png;base64,'.length),'base64');assert.equal(bytes.length,frame.pngBytes);
   const png=inspectNativePng(bytes),filename=`room-32-${frame.key}.png`;
   fs.writeFileSync(path.join(config.out,filename),bytes);
   report.images.push({filename,key:frame.key,name:frame.name,state:frame.state,bytes:bytes.length,sha256:sha(bytes),png});
  }
  save();
 }
 async function closeOwned(reason){
  if(!browserServer||closed||closing)return;closing=true;let timer;
  try{await Promise.race([browserServer.close(),new Promise(resolve=>{timer=setTimeout(resolve,5000);})]);}
  finally{clearTimeout(timer);if(owned.exitCode===null&&owned.signalCode===null)await browserServer.kill();closed=owned.exitCode!==null||owned.signalCode!==null;report.closures.push({pid:owned.pid,reason,exitCode:owned.exitCode,signalCode:owned.signalCode,closed});closing=false;save();assert.ok(closed,'The exact owned Chromium process must exit');}
 }
 try{
  const {chromium}=await playwright();
  const frozen=await serveFrozenCampaign(config.dist);server=frozen.server;
  report.url=frozen.url+'?edition=foundation&level=32&debug=1';
  server.on('request',request=>{
   const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
   if(!pathname.startsWith(mount))return;
   const relative=pathname.slice(mount.length)||'index.html',expected=files.get(relative);
   if(expected)report.requests.push({url:new URL(request.url,frozen.url).href,method:request.method,path:relative,bytes:expected.bytes,sha256:expected.sha256});
  });
  let resourceBusy=false;
  watchdog=setInterval(async()=>{
   if(resourceBusy)return;resourceBusy=true;
   try{
    const used=Number(fs.readFileSync('/sys/fs/cgroup/memory.current','utf8'));
    report.resource.peakCgroupBytes=Math.max(report.resource.peakCgroupBytes,used);report.resource.peakControllerRssBytes=Math.max(report.resource.peakControllerRssBytes,process.memoryUsage().rss);
    if(used>config.memoryLimitBytes&&!report.resource.aborted){report.resource.aborted=true;save();if(browserServer&&!closed)await browserServer.kill();}
   }catch(error){report.errors.push('Resource monitor: '+String(error));}finally{resourceBusy=false;}
  },100);
  deadline=setTimeout(async()=>{report.resource.deadline=true;save();if(browserServer&&!closed)await browserServer.kill().catch(error=>report.errors.push(String(error)));},config.maxWallMs);
  browserServer=await chromium.launchServer({executablePath:config.chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--js-flags=--max-old-space-size=512']});
  owned=browserServer.process();report.browser={pid:owned.pid,spawnfile:owned.spawnfile};browser=await chromium.connect(browserServer.wsEndpoint());
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});page=await context.newPage();
  page.setDefaultTimeout(90000);page.setDefaultNavigationTimeout(90000);
  page.on('pageerror',error=>report.pageErrors.push(String(error.stack??error)));
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
  page.on('requestfailed',request=>report.networkErrors.push({kind:'requestfailed',url:request.url(),error:request.failure()?.errorText}));
  page.on('response',response=>{
   const expected=ownAsset(response.url());if(!expected)return;
   report.responseMetadata.push({url:response.url(),path:expected.path,status:response.status(),fromServiceWorker:response.fromServiceWorker()});
  });
  // Chromium can report ERR_ABORTED after a fully consumed streamed fetch.
  // Its ordinary body storage is then unavailable. Browser-owned durable
  // storage retains the ORIGINAL bytes for the SAME request ID. All enable,
  // event and read operations below use this single CDP session; no second
  // fetch, substitute buffer or rewritten terminal outcome is used.
  const cdp=await context.newCDPSession(page);report.durableResponseBuffer={...DURABLE_RESPONSE_BUFFER};
  cdp.on('Network.requestWillBeSent',event=>{
   const previous=nativeRequests.get(event.requestId);
   if(previous){report.sourceBodyErrors.push({requestId:event.requestId,error:'Duplicate/redirected actual request ID'});return;}
   const row={requestId:event.requestId,url:event.request.url,method:event.request.method,expected:ownAsset(event.request.url),redirected:Boolean(event.redirectResponse),responses:[],terminals:[]};
   nativeRequests.set(event.requestId,row);
   report.networkTrace.push({kind:'requestWillBeSent',requestId:row.requestId,url:row.url,method:row.method,redirected:row.redirected,timestamp:event.timestamp});
  });
  cdp.on('Network.responseReceived',event=>{
   const metadata={kind:'responseReceived',requestId:event.requestId,url:event.response.url,status:event.response.status,fromDiskCache:event.response.fromDiskCache??false,fromServiceWorker:event.response.fromServiceWorker??false,timestamp:event.timestamp};
   nativeRequests.get(event.requestId)?.responses.push(metadata);report.networkTrace.push(metadata);
  });
  for(const eventName of ['Network.loadingFinished','Network.loadingFailed'])cdp.on(eventName,event=>{
   const terminal={kind:eventName.slice('Network.'.length),...event};report.networkTrace.push(terminal);
   const row=nativeRequests.get(event.requestId);if(!row)return;row.terminals.push(terminal);if(!row.expected)return;
   if(row.readStarted){report.sourceBodyErrors.push({requestId:row.requestId,error:'More than one terminal event/body read'});return;}row.readStarted=true;
   const task=(async()=>{
    assert.equal(row.redirected,false);assert.equal(row.method,'GET');assert.equal(row.responses.length,1);assert.equal(row.terminals.length,1);
    const response=row.responses[0];assert.equal(response.status,200);assert.equal(response.url,row.url);assert.equal(response.fromDiskCache,false);assert.equal(response.fromServiceWorker,false);
    const original=await cdp.send('Network.getResponseBody',{requestId:row.requestId}),bytes=Buffer.from(original.body,original.base64Encoded?'base64':'utf8');
    assert.equal(bytes.length,row.expected.bytes);assert.equal(sha(bytes),row.expected.sha256,'Complete original received body for this exact CDP request');
    report.responses.push({requestId:row.requestId,url:row.url,path:row.expected.path,bytes:bytes.length,sha256:sha(bytes),status:200,terminal,bodySource:'Same durable CDP session Network.getResponseBody'});
   })().catch(error=>report.sourceBodyErrors.push({requestId:row.requestId,url:row.url,error:String(error.stack??error)}));
   pending.add(task);void task.finally(()=>pending.delete(task));
  });
  await cdp.send('Network.enable',DURABLE_RESPONSE_BUFFER);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  const fixture=campaignAccessFixture({levelIndex:31,pathname:mount});fixture.preferences.quality='balanced';fixture.raw=JSON.stringify(fixture.preferences);report.fixture=fixture;
  await page.addInitScript(({key,raw})=>localStorage.setItem(key,raw),fixture);
  await page.goto(report.url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(suppressRoom32RouteRafAtReady);
  await page.locator('#play-button').click();await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
  await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.updateVisuals(0,1,0);g.render();});
  report.before=await page.evaluate(installRoom32NativeWaypointProbe,limits);
  assert.equal(report.before.step,0);assert.equal(report.before.elapsed,0);assert.equal(report.before.id,'post-thin-shadow');
  report.originalBuffers=await page.evaluate(()=>window.__QA_ROOM32_ROUTE__.buffers());
  assert.deepEqual(await page.evaluate(()=>window.__QA_ROOM32_ROUTE__.read()),report.before,'Initial model hashing advances no physical/visual state');
  const spec=campaignSpec({chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS},31);
  assert.deepEqual(report.before.decodedAssets.map(asset=>asset.id).sort((a,b)=>a-b),[...spec.assets].sort((a,b)=>a-b));
  for(const asset of report.before.decodedAssets){assert.ok(asset.positionVertices>0&&asset.meshRids.length>0);for(const rid of asset.meshRids)assert.ok(report.originalBuffers.some(buffer=>buffer.rid===rid&&buffer.attribute==='position'&&buffer.bytes>0),'Every original decoded model has actual positive position bytes');}
  const result=await page.evaluate(()=>window.__QA_ROOM32_ROUTE__.run());saveImages(result);
  const {images,...route}=result;report.route=route;
  report.after=await page.evaluate(()=>window.__QA_ROOM32_ROUTE__.read());
  assert.deepEqual(report.after,route.final,'Transferring PNGs does not advance state');
  assert.deepEqual(await page.evaluate(()=>window.__QA_ROOM32_ROUTE__.buffers()),report.originalBuffers,'Every original model/index/morph buffer SHA remains unchanged');
  report.originalModelBuffersUnchanged=true;
  assert.equal(report.images.length,4);assert.equal(route.final.state,'won');assert.equal(route.journey.pass,true);
  assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),[...fixture.completed,31]);
  assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.consoleErrors,[]);
  // A later HTTP inspection failure must not erase the already completed
  // route/model/PNG result. Overall pass still requires both independent
  // sections, unchanged inputs, resource bounds and clean owned cleanup.
  report.routeCapturePass=true;save();
  await page.waitForLoadState('networkidle');while(pending.size)await Promise.all([...pending]);
  assert.deepEqual(report.sourceBodyErrors,[],'Every actual source body was retrieved successfully');
  const receivedIds=new Map(report.responses.map(row=>[row.requestId,row]));assert.equal(receivedIds.size,report.responses.length,'Unique actual body identity');
  const sourceRequests=[...nativeRequests.values()].filter(row=>row.expected);
  assert.equal(sourceRequests.length,report.responses.length,'Every source request has complete same-request byte proof');
  assert.equal(report.requests.length,sourceRequests.length,'No unmatched original server request');
  assert.equal(report.responseMetadata.length,report.responses.length,'Every source response has independent metadata');
  for(const request of sourceRequests){
   const proof=receivedIds.get(request.requestId);assert.ok(proof);assert.equal(proof.url,request.url);assert.equal(proof.path,request.expected.path);
   assert.equal(request.responses.length,1);assert.equal(request.terminals.length,1);
   const metadata=report.responseMetadata.filter(row=>row.url===request.url);assert.equal(metadata.length,1);assert.equal(metadata[0].status,200);assert.equal(metadata[0].fromServiceWorker,false);
   const served=report.requests.filter(row=>row.url===request.url);assert.equal(served.length,1,'Exact full URL has one original served request');assert.equal(served[0].method,'GET');
  }
  const received=new Set(report.responses.map(row=>row.path));
  for(const row of report.requests)assert.ok(received.has(row.path),'Every served asset has matching actual received bytes: '+row.path);
  const runtime=JSON.parse(fs.readFileSync(path.join(config.dist,'models/runtime/manifest.json'),'utf8'));
  for(const id of spec.assets){const model=runtime.models.find(model=>model.id===id);assert.ok(model);const filename='models/runtime/'+model.filename;assert.ok(received.has(filename),'Original declared GLB was received');assert.equal(files.get(filename).sha256,model.outputSHA256);}
  const aborted=report.networkTrace.filter(row=>row.kind==='loadingFailed');
  for(const terminal of aborted){
   const proof=receivedIds.get(terminal.requestId);assert.ok(proof,'An unverified failed request remains fatal');
   assert.equal(terminal.canceled,true);assert.equal(terminal.errorText,'net::ERR_ABORTED');assert.equal(proof.terminal.kind,'loadingFailed');assert.equal(terminal.type,'Fetch');
   // Three.FileLoader also consumes the Draco WASM through a ReadableStream.
   // Preserve its raw failed terminal as well, but verify the same original
   // decoder response and actual decoded compressed models independently.
   if(proof.path==='draco/draco_decoder.wasm'){
    const expected=files.get(proof.path);assert.equal(proof.status,200);assert.equal(proof.bytes,expected.bytes);assert.equal(proof.sha256,expected.sha256);
    const compressedModels=[];
    for(const id of spec.assets){
     const model=runtime.models.find(model=>model.id===id),buffer=fs.readFileSync(path.join(config.dist,'models/runtime',model.filename));
     assert.equal(buffer.toString('ascii',0,4),'glTF');assert.equal(buffer.readUInt32LE(4),2);assert.equal(buffer.toString('ascii',16,20),'JSON');
     const json=JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)));
     if(json.meshes?.some(mesh=>mesh.primitives.some(primitive=>primitive.extensions?.KHR_draco_mesh_compression))){
      const decoded=report.before.decodedAssets.find(asset=>asset.id===id);assert.ok(decoded?.positionVertices>0);compressedModels.push(id);
     }
    }
    assert.ok(compressedModels.length>0,'Original compressed GLBs actually decoded with this shipped decoder');
    report.byteCompleteAbortedAssets.push({...proof,compressedModels,failureRetained:true,outcome:'abortedWithCompleteVerifiedOriginalDracoDecoder'});
    continue;
   }
   const model=runtime.models.find(model=>'models/runtime/'+model.filename===proof.path);assert.ok(model,'Only an original GLB or its used Draco decoder has a byte-complete streamed outcome');
   assert.ok(spec.assets.includes(model.id));assert.equal(proof.bytes,model.outputBytes);assert.equal(proof.sha256,model.outputSHA256);assert.equal(proof.status,200);
   const decoded=report.before.decodedAssets.filter(asset=>asset.id===model.id);assert.equal(decoded.length,1);assert.ok(decoded[0].positionVertices>0&&decoded[0].meshRids.length>0);
   for(const rid of decoded[0].meshRids)assert.ok(report.originalBuffers.some(buffer=>buffer.rid===rid&&buffer.attribute==='position'&&buffer.bytes>0));
   const complete={...proof,modelId:model.id,decodedOriginalAsset:decoded[0],failureRetained:true,outcome:'abortedWithCompleteVerifiedOriginalGLB'};
   report.byteCompleteAbortedGLBs.push(complete);report.byteCompleteAbortedAssets.push(complete);
  }
  for(const failure of report.networkErrors){assert.equal(failure.error,'net::ERR_ABORTED');assert.equal(report.byteCompleteAbortedAssets.filter(row=>row.url===failure.url).length,1,'Every raw failed request binds to one complete original body');}
  assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.consoleErrors,[]);
  report.receivedSourceBytesPass=true;report.verifiedSourceBytes=true;
  report.rawNoAbortNetworkPass=aborted.length===0&&report.networkErrors.length===0;
 }catch(error){
  report.errors.push(String(error.stack??error));
  if(page&&!closed)try{const partial=await page.evaluate(()=>window.__QA_ROOM32_ROUTE__?.evidence?.());saveImages(partial);if(partial){const {images,...rest}=partial;report.partialRoute=rest;}}catch(partialError){report.errors.push('Read partial evidence: '+String(partialError));}
 }finally{
  clearInterval(watchdog);clearTimeout(deadline);
  if(page&&!closed)for(const [name,key]of [['routeProbe','__QA_ROOM32_ROUTE__'],['routeRaf','__QA_ROOM32_ROUTE_RAF__']])try{
   const restored=await Promise.race([page.evaluate(key=>window[key]?.restore?.()??{restored:true,notInstalled:true},key),new Promise((_,reject)=>setTimeout(()=>reject(Error('Restoration timeout')),5000).unref())]);
   assert.equal(restored.restored,true);report[name+'Restoration']=restored;
  }catch(error){report.errors.push(name+' restoration: '+String(error));}
  try{await closeOwned('route-finally');}catch(error){report.errors.push('Owned browser closure: '+String(error));}
  if(server)await new Promise(resolve=>server.close(resolve));
  try{assert.deepEqual(buildSourceInputs(sourceRoot),sourceManifest);assert.deepEqual(inventory(config.dist),distManifest);report.inputsUnchanged=true;}catch(error){report.inputsUnchanged=false;report.errors.push('Inputs changed: '+String(error));}
  report.verifiedRouteEvidencePass=report.routeCapturePass&&report.verifiedSourceBytes&&report.inputsUnchanged&&report.errors.length===0&&!report.resource.aborted&&!report.resource.deadline&&report.closures.length===1&&report.closures[0].closed;
  report.pass=report.verifiedRouteEvidencePass&&report.rawNoAbortNetworkPass;
  report.finishedAt=new Date().toISOString();save();
 }
 return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const report=await runRoom32RenderedRoute();console.log(JSON.stringify({pass:report.pass,routeCapturePass:report.routeCapturePass,verifiedSourceBytes:report.verifiedSourceBytes,verifiedRouteEvidencePass:report.verifiedRouteEvidencePass,rawNoAbortNetworkPass:report.rawNoAbortNetworkPass,byteCompleteAbortedGLBs:report.byteCompleteAbortedGLBs.length,images:report.images.length,steps:report.route?.final?.step,out:report.config.out}));if(!report.pass)process.exitCode=1;}
 catch(error){console.error(error.stack??error);process.exitCode=1;}
}
