import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

// This observer adds network observations, never game controls or source edits.
const base='https://amazin20.github.io/brainrot-portal/campaign-v63/';
const DURABLE_RESPONSE_BUFFER=Object.freeze({maxTotalBufferSize:134217728,maxResourceBufferSize:67108864,enableDurableMessages:true});
const LEGACY_ROUTE_RESET_COUNTER_SCOPE='reported journey counters after legacy fixture initialization; the initial fixture reset is outside these counters; specialized drivers retain their own stricter proofs';
const root=process.cwd(),source=path.resolve(process.env.SOURCE_DIR||'source');
const config=JSON.parse(fs.readFileSync('tools/campaign-v63-release.json'));
const prepared=JSON.parse(fs.readFileSync('proof/preparation.json'));
const out=path.resolve(process.env.OUT_DIR||'proof/player');fs.mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(config.frozen,true);assert.equal(prepared.producer.GITHUB_SHA,process.env.GITHUB_SHA);
assert.equal(prepared.producer.GITHUB_RUN_ID,process.env.GITHUB_RUN_ID);
assert.equal(prepared.configSha256,sha(fs.readFileSync('tools/campaign-v63-release.json')));
const members=new Map(prepared.candidateFiles.map(r=>[new URL(r.path,base).href,r]));
members.set(base,members.get(new URL('index.html',base).href));
const mode=process.argv[2]||'player',pending=[],network=[],failures=[],stampReads=[];
assert.ok(['player','routes'].includes(mode));
const packageRoot=path.join(source,'node_modules/puppeteer-core');
const ppJSON=JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json')));
assert.equal(ppJSON.version,'24.16.0');
let entryPoint=ppJSON.exports?.['.']?.import;while(entryPoint&&typeof entryPoint==='object')entryPoint=entryPoint.default||entryPoint.node||entryPoint.import;
assert.equal(typeof entryPoint,'string');const modulePath=path.resolve(packageRoot,entryPoint);assert.ok(modulePath.startsWith(packageRoot+path.sep));
const driverName=mode==='player'?'scripts/qa-player-access-browser.mjs':'scripts/qa-creative-browser.mjs';
const driverURL=pathToFileURL(path.join(source,driverName)).href;
const resolved=spawnSync(process.execPath,['--experimental-import-meta-resolve','--input-type=module','-e',
 'process.stdout.write(import.meta.resolve("puppeteer-core",process.argv[1]))',driverURL],{encoding:'utf8'});
assert.equal(resolved.status,0,resolved.stderr);assert.equal(resolved.stdout.trim(),pathToFileURL(modulePath).href,'Source driver and observer must use the same ESM Puppeteer');
const {default:puppeteer}=await import(pathToFileURL(modulePath).href);
const originalLaunch=puppeteer.launch.bind(puppeteer);
// All candidate response bodies belong to a live document/target. Drain the
// actual requests and dynamically appended body tasks before invalidating it.
function installCandidateResponseBodyObserver(browser,{base,members,sha,prepared,config,pending,network,failures,stampReads,onPage,onFailure=()=>{}}){
 const newPage=browser.newPage.bind(browser),createContext=browser.createBrowserContext.bind(browser),closeBrowser=browser.close.bind(browser);
 const states=new WeakMap(),livePages=new Set(),seenContexts=new WeakSet();
 const bounded=async(promise,deadline)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Candidate response drain exhausted its180000ms budget')),Math.max(1,deadline-Date.now()));})]);}finally{clearTimeout(timer);}};
 const recordFailure=(state,{stage,url,status,error})=>{
  const detail={stage,page:state.number,url,status,error:String(error.stack||error)},message=`Candidate ${stage} failed page=${detail.page} url=${detail.url} status=${detail.status}: ${detail.error}`;
  state.errors.push(message);failures.push(message);
  try{onFailure(detail);}catch(diagnosticError){const failure='Candidate network diagnostic could not be saved: '+String(diagnosticError.stack||diagnosticError);state.errors.push(failure);failures.push(failure);}
  return message;
 };
 const drain=async page=>{
  const state=states.get(page);if(!state)return;
  if(state.draining)return state.draining;
  state.draining=(async()=>{
   try{
    if(state.started||state.tasks.size||state.inflight.size){
     assert.equal(page.isClosed(),false,'Candidate target closed before its response bodies were drained');
     const deadline=Date.now()+180000;
     for(;;){
      assert.ok(Date.now()<deadline,'Candidate response drain deadline passed');
      await page.waitForNetworkIdle({idleTime:250,timeout:Math.max(1,deadline-Date.now())});
      const generation=state.generation;
      while(state.tasks.size)await bounded(Promise.all([...state.tasks]),deadline);
      if(state.inflight.size===0&&state.tasks.size===0&&state.generation===generation)break;
     }
    }
    assert.deepEqual(state.errors,[],'A candidate response failed before target invalidation');
   }catch(error){
    if(!state.drainFailure)state.drainFailure=recordFailure(state,{stage:'response drain',url:page.url(),status:null,error});
    throw error;
   }
  })();
  try{return await state.draining;}finally{state.draining=null;}
 };
 const closeAfterDrain=async(pages,close)=>{
  const current=pages.filter(page=>livePages.has(page));
  const results=await Promise.allSettled(current.map(drain));
  // Cleanup is still mandatory after a fatal read/drain error; it cannot turn
  // that error into successful evidence or leave a Chrome process orphaned.
  try{await close();}finally{for(const page of current)if(page.isClosed())livePages.delete(page);}
  const failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;
 };
 const observePage=async page=>{
  if(states.has(page))return page;
  const state={number:onPage(),started:false,tasks:new Set(),inflight:new Set(),generation:0,errors:[],draining:null,drainFailure:null};
  states.set(page,state);livePages.add(page);await page.setCacheEnabled(false);
  // Use the actual pinned Puppeteer request session read by response.buffer().
  // Browser-owned durable storage retains streamed GLBs without fetching or
  // substituting another body. A configuration failure remains fatal.
  const client=page._client();assert.equal(typeof client.send,'function');
  await client.send('Network.enable',DURABLE_RESPONSE_BUFFER);
  page.on('request',request=>{state.inflight.add(request);state.generation++;});
  for(const event of ['requestfinished','requestfailed'])page.on(event,request=>{state.inflight.delete(request);state.generation++;});
  page.on('response',response=>{
   const url=new URL(response.url());url.search='';url.hash='';const expected=members.get(url.href);
   if(!expected)return;state.generation++;
   const task=(async()=>{
    assert.equal(response.status(),200,'Candidate response is not an actual200');
    const bytes=await response.buffer();assert.equal(bytes.length,expected.bytes);assert.equal(sha(bytes),expected.sha256);
    network.push({page:state.number,url:url.href,status:response.status(),bytes:bytes.length,sha256:sha(bytes),fromCache:response.fromCache()});
   })().catch(error=>{recordFailure(state,{stage:'response body',url:url.href,status:response.status(),error});}).finally(()=>state.tasks.delete(task));
   state.tasks.add(task);pending.push(task);
  });
  const stamp=async()=>{
   const actual=await page.evaluate(async url=>{const r=await fetch(url,{cache:'no-store'});return{url:r.url,status:r.status,body:await r.text()};},new URL('build-info.json',base).href);
   assert.equal(actual.url,new URL('build-info.json',base).href);assert.equal(actual.status,200);
   assert.equal(sha(Buffer.from(actual.body)),prepared.originalBuildInfoSha256);assert.equal(JSON.parse(actual.body).commit,config.sourceCommit);
   stampReads.push({page:state.number,url:actual.url,status:actual.status,sha256:sha(Buffer.from(actual.body))});
  };
  const goto=page.goto.bind(page),reload=page.reload.bind(page),closePage=page.close.bind(page);
  page.goto=async(...args)=>{assert.ok(String(args[0]).startsWith(base),'Native driver attempted a different public origin');await drain(page);state.started=true;const result=await goto(...args);await stamp();return result;};
  page.reload=async(...args)=>{
   if(!state.started){
    // Puppeteer changes mobile emulation by reloading its fresh blank target.
    // That target has no candidate document or evidence to stamp.
    const assertUnusedBlank=()=>{
     assert.equal(page.url(),'about:blank','Pre-navigation reload requires the exact fresh blank target');
     assert.equal(state.tasks.size,0);assert.equal(state.inflight.size,0);
     assert.equal(network.some(row=>row.page===state.number),false,'Blank target already received candidate bytes');
     assert.equal(stampReads.some(row=>row.page===state.number),false,'Blank target already recorded a candidate stamp');
    };
    assert.equal(page.url(),'about:blank','Reload before a candidate navigation');
    await drain(page);assertUnusedBlank();
    const result=await reload(...args);await drain(page);assertUnusedBlank();return result;
   }
   await drain(page);const result=await reload(...args);await stamp();return result;
  };
  page.close=async(...args)=>closeAfterDrain([page],()=>closePage(...args));
  return page;
 };
 browser.newPage=async(...args)=>observePage(await newPage(...args));
 browser.createBrowserContext=async(...args)=>{
  const context=await createContext(...args);if(seenContexts.has(context))return context;seenContexts.add(context);
  const contextNewPage=context.newPage.bind(context),closeContext=context.close.bind(context),pages=new Set();
  context.newPage=async(...pageArgs)=>{const page=await contextNewPage(...pageArgs);pages.add(page);return observePage(page);};
  context.close=async(...closeArgs)=>closeAfterDrain([...pages],()=>closeContext(...closeArgs));return context;
 };
 browser.drainCandidateResponseBodies=async()=>{const results=await Promise.allSettled([...livePages].map(drain)),failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;};
 browser.close=async(...args)=>closeAfterDrain([...livePages],()=>closeBrowser(...args));
 return browser;
}
let pageCount=0;
puppeteer.launch=async options=>installCandidateResponseBodyObserver(await originalLaunch(options),{base,members,sha,prepared,config,pending,network,failures,stampReads,onPage:()=>++pageCount,onFailure:detail=>save('network-failure.json',{pass:false,publicationAccepted:false,...detail,network:[...network],browserStampReads:[...stampReads]})});
function save(file,value){fs.writeFileSync(path.join(out,file),JSON.stringify(value,null,2)+'\n');}
function decodeFrame(file,{relative=false}={}){
 const r=spawnSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-c',
  'import json,sys;from PIL import Image,ImageStat;i=Image.open(sys.argv[1]).convert("RGB");s=i.resize((64,36));assert i.width>=100 and i.height>=100 and max(ImageStat.Stat(s).stddev)>1;print(json.dumps({"width":i.width,"height":i.height}))',file],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const b=fs.readFileSync(file);return{path:relative?path.relative(out,file).split(path.sep).join('/'):path.basename(file),bytes:b.length,sha256:sha(b),pixels:JSON.parse(r.stdout)};
}
function member(name){
 assert.equal(typeof name,'string');assert.ok(name&&!name.includes('\\')&&!name.startsWith('/')&&!name.split('/').some(v=>!v||v==='.'||v==='..'));
 const p=path.resolve(out,name);assert.ok(p.startsWith(out+path.sep));assert.equal(fs.lstatSync(p).isFile(),true);assert.equal(fs.lstatSync(p).isSymbolicLink(),false);return p;
}
function fileRecord(name){const p=member(name),b=fs.readFileSync(p);return{path:name,bytes:b.length,sha256:sha(b)};}
function retainedImages(){
 const names=[];function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);assert.equal(entry.isSymbolicLink(),false);if(entry.isDirectory())visit(p);else{assert.equal(entry.isFile(),true);if(p.endsWith('.jpg'))names.push(p);}}}
 visit(path.join(out,'stills'));return names.sort().map(p=>decodeFrame(p,{relative:true}));
}
if(mode==='player'){
 const driver=path.join(source,driverName),driverSha=sha(fs.readFileSync(driver));
 Object.assign(process.env,{PAGE_URL:base,BUILD_COMMIT:config.sourceCommit,SOURCE_DIR:source,SITE_DIR:path.join(source,'dist'),
  SOURCE_REVIEW_RUN_ID:String(config.sourceRun),SOURCE_REVIEW_RUN_ATTEMPT:String(config.sourceAttempt),OUT_DIR:out});
 const {runPlayerAccessBrowserQA}=await import(pathToFileURL(driver).href);
 const report=await runPlayerAccessBrowserQA();await Promise.all(pending);assert.deepEqual(failures,[]);
 assert.equal(report.pass,true);assert.equal(report.sourceCommit,config.sourceCommit);assert.equal(report.url,base);
 const images=report.screenshots.map(row=>{const image=decodeFrame(path.join(out,row.path));assert.equal(image.bytes,row.bytes);assert.equal(image.sha256,row.sha256);return image;});
 assert.equal(driverSha,sha(fs.readFileSync(driver)));
 save('public-binding.json',{pass:true,publicationAccepted:false,producer:prepared.producer,sourceCommit:config.sourceCommit,
  publicURL:base,buildInfoSha256:prepared.originalBuildInfoSha256,driver:{path:driverName,sha256:driverSha},
  freshPages:pageCount,browserStampReads:stampReads,network,decodedImages:images,
  scope:'Unchanged frozen Source UI runner against actual Public consumer bytes; response bodies are retained and hashed before closing each target. SDK/reward callback cases remain separate test-platform evidence.'});
}
else if(mode==='routes'){
 const driver=path.join(source,'scripts/qa-creative-browser.mjs');
 const driverSha=sha(fs.readFileSync(driver));
 Object.assign(process.env,{PAGE_URL:base,BUILD_COMMIT:config.sourceCommit,START_SERVER:'0',CASE:'route',STRICT_CAPTURE:'1',REUSE_PAGE:'0',OUT_DIR:out});
 // The source's actual module and ordinary production hooks perform all moves.
 await import(pathToFileURL(driver).href);await Promise.all(pending);
 assert.deepEqual(failures,[]);const report=JSON.parse(fs.readFileSync(path.join(out,'report.json')));
 const levels=process.env.LEVELS.split(',').map(Number);assert.deepEqual(report.rows.map(r=>r.level),levels);
 assert.equal(report.sourceCommit,config.sourceCommit);assert.equal(report.package.commit,config.sourceCommit);assert.deepEqual(report.errors,[]);
 assert.equal(report.pass,true);assert.equal(report.capturePass,true);const images=[],novelProofs=[],impulsePhysicalProofs=[];
 for(const row of report.rows){
  const route=row.route,capture=row.captures.finish;
  assert.equal(row.pass,true);assert.equal(row.gameplayPassed,true);assert.equal(row.capturePass,true);assert.deepEqual(row.errors,[]);
  assert.equal(route.pass,true);assert.equal(route.state,'won');assert.equal(route.sameCompanion,true);assert.equal(route.sameCargoShape,true);
  assert.equal(route.cargoUUID,row.start.cargoUUID);assert.equal(route.cargoBodyId,row.start.cargoBodyId);
  assert.equal(route.resets??0,0);assert.equal(route.respawns??0,0);assert.equal(route.cargoResets??0,0);
  assert.equal(capture.ok,true);assert.equal(capture.includesHTML,false);assert.equal(capture.frame.state,'won');
  assert.equal(capture.frame.levelIndex,row.level-1);assert.equal(capture.frame.cargoUUID,row.start.cargoUUID);assert.equal(capture.frame.cargoBodyId,row.start.cargoBodyId);
  images.push(decodeFrame(path.join(out,`${row.level}-finish.jpg`)));
  if(row.level===41){
   const proof=route.milestones.find(m=>m.name==='Solved pendulum')?.physicsProof;
   assert.equal(proof?.physicalUpperCatch,true);assert.equal(proof?.twoPhysicalCatches,true);assert.equal(Object.hasOwn(proof,'upperCatchKinematic'),false);
   const {assertPendulumPhysicalProof}=await import(pathToFileURL(path.join(source,'scripts/lib/tower41-pendulum-proof.mjs')).href);
   novelProofs.push({level:41,...assertPendulumPhysicalProof(proof,row.start.cargoBodyId)});
   const {CASTLE_NATIVE_ORDER,assertCastleImpulsePhysicalProof}=await import(pathToFileURL(path.join(source,'scripts/lib/castle-impulse-native-proof.mjs')).href);
   const starts=route.milestones.filter(m=>m.name.startsWith('Start ')).map(m=>m.name.slice(6));
   const solved=route.milestones.filter(m=>m.name.startsWith('Solved ')).map(m=>m.name.slice(7));
   assert.deepEqual(starts,CASTLE_NATIVE_ORDER);assert.deepEqual(solved,CASTLE_NATIVE_ORDER);assert.equal(solved.length,12);
   const impulse=route.milestones.find(m=>m.name==='Solved impulse')?.physicsProof;
   assertCastleImpulsePhysicalProof(impulse,row.start.cargoBodyId);
   impulsePhysicalProofs.push({level:41,pass:true,originalCargoBodyId:row.start.cargoBodyId,
    originalCargoShapeId:impulse.impulseCell.originalCargoShapeId,worldStep:impulse.impulseCell.worldStep});
  }
 }
 assert.equal(pageCount,levels.length);assert.equal(stampReads.length,levels.length);
 for(let n=1;n<=pageCount;n++)assert.ok(network.some(r=>r.page===n&&r.url.endsWith('/index.html'))||network.some(r=>r.page===n&&r.url.endsWith('.js')));
 assert.equal(driverSha,sha(fs.readFileSync(driver)),'Observer modified the frozen source driver');
 save('public-binding.json',{pass:true,publicationAccepted:false,publicURL:base,sourceCommit:config.sourceCommit,producer:prepared.producer,
  driver:{path:'scripts/qa-creative-browser.mjs',sha256:driverSha},buildInfoSha256:prepared.originalBuildInfoSha256,
  freshPages:pageCount,browserStampReads:stampReads,network,decodedImages:images,novelProofs,impulsePhysicalProofs,
  normalUiZeroStepStartProven:false,resetCounterScope:LEGACY_ROUTE_RESET_COUNTER_SCOPE,
  scope:'Read-only response digest observer around the unchanged legacy Source route module;51 production WebGL finishes. The initial fixture reset precedes the reported journey counters; normal-UI zero-step starts are not established for this cohort. Specialized drivers retain their own stricter proofs.'});
}
