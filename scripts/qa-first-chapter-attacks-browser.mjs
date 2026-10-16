/** Actual frozen-package browser attacks. One new storage context and genuine
 * native Play per bounded case; only a pinned QA module request is intercepted. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {freezeFirstChapterInputs,bindFirstChapterPackage} from './qa-first-chapter-native.mjs';
import {serveFrozenCampaign} from './lib/frozen-campaign-server.mjs';
import {waitForStartMenu,activate} from './lib/singularity-ui-check.mjs';
import {summarizeEarlyChapterAttacks,assertEarlyChapterAttacks} from './lib/first-chapter-early-attacks.mjs';
import {assertFirstChapterLateAttacks} from './lib/first-chapter-late-attacks.mjs';
import {FIRST_CHAPTER_OPEN_SCOPES} from './lib/first-chapter-native-proof.mjs';
import {FIRST_CHAPTER_ATTACK_HARNESS_FILES,firstChapterAttackCatalogue,assertFirstChapterAttacksBrowserDiagnostic} from './lib/first-chapter-attack-browser.mjs';
export {FIRST_CHAPTER_ATTACK_HARNESS_FILES,assertFirstChapterAttacksBrowserDiagnostic} from './lib/first-chapter-attack-browser.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const write=(out,name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');
const gitBytes=(root,name)=>execFileSync('git',['show','HEAD:'+name],{cwd:root,maxBuffer:32000000});
const fileRow=(root,name)=>{const bytes=fs.readFileSync(path.join(root,name));return{path:name,bytes:bytes.length,sha256:sha(bytes)};};
function freezeAttackInputs(sourceRoot,controllerRoot){
 const frozen=freezeFirstChapterInputs(sourceRoot,controllerRoot);
 const files=[...new Set([...frozen.controller.files.map(f=>f.path),...FIRST_CHAPTER_ATTACK_HARNESS_FILES])].sort().map(name=>{
  assert.deepEqual(fs.readFileSync(path.join(controllerRoot,name)),gitBytes(controllerRoot,name),'Frozen controller harness must match HEAD: '+name);return fileRow(controllerRoot,name);
 });
 // The SOURCE cases and helpers, rather than an older controller checkout's
 // game code, are what esbuild will use. Bind those QA files independently.
 const sourceHarnessFiles=FIRST_CHAPTER_ATTACK_HARNESS_FILES.map(name=>{assert.deepEqual(fs.readFileSync(path.join(sourceRoot,name)),gitBytes(sourceRoot,name),'Current source attack harness differs from HEAD: '+name);return fileRow(sourceRoot,name);});
 return{...frozen,controller:{...frozen.controller,files,filesSha256:sha(JSON.stringify(files))},sourceHarness:{files:sourceHarnessFiles,filesSha256:sha(JSON.stringify(sourceHarnessFiles))}};
}

/** The only external module is the exact compiled production driver already
 * verified in the complete HTTP package. Every other transitive harness input,
 * including installed dependency bytes, gets an explicit immutable inventory. */
export async function compileFirstChapterAttackHarness({sourceRoot,base,journey}){
 const {build,version}=await import('esbuild'),entry='scripts/lib/first-chapter-attack-browser.mjs',journeyURL=new URL(journey.path,base).href,externalSource=path.resolve(sourceRoot,'src/game/LabV8Journey.js');
 const result=await build({absWorkingDir:sourceRoot,stdin:{contents:"export { observeFirstChapterBrowserAttack } from './scripts/lib/first-chapter-attack-browser.mjs';",resolveDir:sourceRoot,sourcefile:'__v60_attack_entry__.mjs'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,metafile:true,sourcemap:false,legalComments:'none',minify:false,plugins:[{name:'only-exact-compiled-production-journey',setup(builder){builder.onResolve({filter:/LabV8Journey\.js$/},args=>{const resolved=path.resolve(args.resolveDir,args.path);assert.equal(resolved,externalSource,'No alternate ordinary-input journey');return{path:journeyURL,external:true};});}}]});
 assert.equal(result.outputFiles.length,1);const bytes=Buffer.from(result.outputFiles[0].contents),inputs=Object.keys(result.metafile.inputs).filter(name=>name!=='__v60_attack_entry__.mjs').sort().map(name=>{
  const filename=path.resolve(sourceRoot,name);assert.ok(filename.startsWith(sourceRoot+path.sep),'Harness dependency escaped source checkout');const relative=path.relative(sourceRoot,filename).split(path.sep).join('/'),body=fs.readFileSync(filename),dependency=relative.startsWith('node_modules/');
  if(!dependency)assert.deepEqual(body,gitBytes(sourceRoot,relative),'Bundled source helper differs from source HEAD: '+relative);
  return{path:relative,bytes:body.length,sha256:sha(body),kind:dependency?'installed-package':'source-HEAD'};
 });
 assert.ok(inputs.some(f=>f.path===entry));assert.ok(inputs.some(f=>f.path==='scripts/lib/first-chapter-early-attacks.mjs'));assert.ok(inputs.some(f=>f.path==='scripts/lib/first-chapter-late-attacks.mjs'));
 const imports=Object.values(result.metafile.outputs).flatMap(output=>output.imports);assert.ok(imports.length>0);assert.ok(imports.every(item=>item.external&&item.path===journeyURL),'The harness must not load unbuilt source modules');
 return{bytes,descriptor:{entry,filename:'attack-harness.js',bytes:bytes.length,sha256:sha(bytes),inputs,inputsSha256:sha(JSON.stringify(inputs)),esbuildVersion:version,
  productionJourney:{url:journeyURL,bytes:journey.bytes,sha256:journey.sha256},scope:'Frozen SOURCE QA observers; only actual compiled production ordinary-input driver external. No build-time source module is served as the game.'}};
}

function decodeJPGs(directory,names){
 const python="import json,sys\nfrom PIL import Image,ImageStat\nrows=[]\nfor name in json.loads(sys.argv[2]):\n im=Image.open(sys.argv[1]+'/'+name);assert im.format=='JPEG';im.load();assert im.size==(640,360);small=im.convert('RGB').resize((64,36));colors=len(small.getcolors(2305) or []);std=max(ImageStat.Stat(small).stddev);assert colors>=4 and std>=1;rows.append({'filename':name,'width':640,'height':360,'decoded':True,'colors':colors,'maxChannelStd':std})\nprint(json.dumps(rows))";
 return JSON.parse(execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-c',python,directory,JSON.stringify(names)],{encoding:'utf8'})).map(row=>{const bytes=fs.readFileSync(path.join(directory,row.filename));return{...row,bytes:bytes.length,sha256:sha(bytes)};});
}
function saveCanvas(out,caseIndex,capture){
 assert.ok(capture&&/^data:image\/jpeg;base64,/.test(capture.jpeg),'Actual start/end canvas is required');const bytes=Buffer.from(capture.jpeg.slice(capture.jpeg.indexOf(',')+1),'base64');assert.ok(bytes.length>100&&bytes.length<2000000);assert.equal(bytes[0],255);assert.equal(bytes[1],216);assert.equal(bytes.at(-2),255);assert.equal(bytes.at(-1),217);
 const filename=`case-${String(caseIndex+1).padStart(2,'0')}-${capture.phase}.jpg`;fs.writeFileSync(path.join(out,filename),bytes);const{jpeg,...metadata}=capture;return{...metadata,filename,bytes:bytes.length,sha256:sha(bytes)};
}

export async function runFirstChapterAttacksBrowserQA(){
 const group=process.env.GROUP;assert.ok(group==='early'||group==='later','GROUP must be early or later');
 const sourceRoot=path.resolve(process.env.SOURCE_DIR||'.'),controllerRoot=path.resolve(process.env.CONTROLLER_DIR||'.'),buildRoot=path.resolve(process.env.BUILD_DIR||'dist'),out=path.resolve(process.env.OUT_DIR||'qa/first-chapter-attacks-'+group);
 fs.mkdirSync(out,{recursive:true});assert.deepEqual(fs.readdirSync(out),[],'Use a fresh artifact directory; stale media may not masquerade as current evidence');
 const base=new URL(process.env.PAGE_URL||'http://127.0.0.1:4173/campaign-v60/');assert.ok(['http:','https:'].includes(base.protocol));assert.equal(base.search,'');assert.equal(base.hash,'');assert.ok(/^\/(?:brainrot-portal\/)?campaign-v60\/$/.test(base.pathname),'Exact isolated campaign-v60 package mount required');
 let browser=null,server=null,binding=null,harness=null,browserInfo=null,stage='frozen-source-package',pureReport=null,report=null;const errors=[],caseObservations=[];
 try{
  binding=bindFirstChapterPackage(freezeAttackInputs(sourceRoot,controllerRoot),sourceRoot,buildRoot);write(out,'binding.json',binding);
  const info=JSON.parse(fs.readFileSync(path.join(buildRoot,'build-info.json')));assert.equal(info.version,'v60-first-chapter');assert.equal(info.commit,binding.source.commit);
  const sourceReview={runId:Number(process.env.SOURCE_REVIEW_RUN_ID||info.run),runAttempt:Number(process.env.SOURCE_REVIEW_RUN_ATTEMPT||(String(info.run)===process.env.GITHUB_RUN_ID?process.env.GITHUB_RUN_ATTEMPT:0))};
  assert.ok(Number.isSafeInteger(sourceReview.runId)&&sourceReview.runId>0&&Number.isSafeInteger(sourceReview.runAttempt)&&sourceReview.runAttempt>0,'Explicit SOURCE review run and attempt are required');assert.equal(String(sourceReview.runId),String(info.run));
  const captureRun={runId:Number(process.env.GITHUB_RUN_ID||0),runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT||0)};
  if(process.env.START_SERVER==='1'){assert.equal(base.protocol,'http:');assert.equal(base.hostname,'127.0.0.1');server=await serveFrozenCampaign(buildRoot,{port:Number(base.port||80),namespace:'campaign-v60'});const outside=await fetch(new URL('/outside-current-package.js',base),{cache:'no-store'});assert.equal(outside.status,404);}
  stage='complete-served-http-package';const served=[];
  for(const file of [...binding.package.files,{path:'build-info.json',bytes:binding.package.buildInfoBytes,sha256:binding.package.buildInfoSha256}]){const response=await fetch(new URL(file.path,base),{cache:'no-store'});assert.equal(response.status,200,'Actual package member HTTP200 required: '+file.path);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,file.bytes);assert.equal(sha(bytes),file.sha256);served.push({...file,status:200});}
  const servedPackage={sourceCommit:binding.source.commit,sourceTree:binding.source.tree,captureOrigin:base.origin,capturePath:base.pathname,allHTTPFilesVerified:true,files:served,...FIRST_CHAPTER_OPEN_SCOPES};write(out,'served-package.json',servedPackage);
  stage='frozen-QA-harness-compilation';harness=await compileFirstChapterAttackHarness({sourceRoot,base,journey:binding.package.journey});
  const harnessURL=new URL('/__v60-attack-harness__/'+harness.descriptor.sha256+'.js',base.origin).href;Object.assign(harness.descriptor,{sourceHead:binding.source.commit,url:harnessURL,onlyInterceptedRequest:harnessURL});fs.writeFileSync(path.join(out,'attack-harness.js'),harness.bytes);write(out,'attack-harness-inputs.json',harness.descriptor);
  stage='native-browser-launch';const{default:puppeteer}=await import('puppeteer-core');browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:2400000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});browserInfo={product:await browser.version(),userAgent:await browser.userAgent()};write(out,'native-browser.json',browserInfo);
  for(const [caseIndex,item]of firstChapterAttackCatalogue(group).entries()){
   stage='native-case-'+item.caseId;const context=await browser.createBrowserContext(),page=await context.newPage(),caseErrors=[],requests=[];
   try{
    page.setDefaultTimeout(180000);await page.setViewport({width:640,height:360,deviceScaleFactor:1});page.on('pageerror',error=>caseErrors.push(String(error)));page.on('error',error=>caseErrors.push('Renderer: '+String(error)));
    await page.setRequestInterception(true);page.on('request',request=>{if(request.url()===harnessURL){requests.push({url:request.url(),bytes:harness.bytes.length,sha256:harness.descriptor.sha256});void request.respond({status:200,contentType:'text/javascript; charset=utf-8',headers:{'Cache-Control':'no-store','Content-Length':String(harness.bytes.length)},body:harness.bytes}).catch(error=>caseErrors.push('Harness response: '+String(error)));}else void request.continue().catch(error=>caseErrors.push('Unmodified request: '+String(error)));});
    const url=new URL(base);url.searchParams.set('edition','foundation');url.searchParams.set('level',String(item.index+1));url.searchParams.set('debug','1');await page.goto(url.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);assert.equal(await page.$eval('#level-select',e=>Number(e.value)),item.index);await page.select('#quality-select','low');
    await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__,r=g.renderer,original=r.setAnimationLoop;r.setAnimationLoop=function(callback){return original.call(this,callback===g.animate?null:callback);};window.__FIRST_CHAPTER_ATTACK_SCHEDULER__=original;});
    await activate(page,'#play-button');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
    const ui=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop=window.__FIRST_CHAPTER_ATTACK_SCHEDULER__;delete window.__FIRST_CHAPTER_ATTACK_SCHEDULER__;return{control:'native #play-button click',edition:g.chamberEdition,level:g.levelIndex+1,id:g.firstLevel.id,state:g.state,normalSpawn:g.playerPosition.distanceTo(g.firstLevel.spawn)<1e-8,normalCargoSpawn:g.cargo.position.distanceTo(g.firstLevel.cargoSpawn)<1e-8,worldStep:g.physics.world.stepnumber,elapsed:g.elapsed,portalsReady:g.portals.ready,teleports:g.teleportCount,scheduler:'Automatic production callback suppressed before first playing step; every ordinary attack physics/visual update driven explicitly.'};});
    assert.equal(ui.normalSpawn,true);assert.equal(ui.normalCargoSpawn,true);assert.equal(ui.worldStep,0);assert.equal(ui.elapsed,0);assert.equal(ui.portalsReady,false);assert.equal(ui.teleports,0);
    const result=await page.evaluate(async({harnessURL,group,caseId})=>{const module=await import(harnessURL);return module.observeFirstChapterBrowserAttack({group,caseId});},{harnessURL,group,caseId:item.caseId});
    assert.equal(requests.length,1,'Exactly one explicitly pinned QA resource may be substituted');result.ui=ui;result.harnessRequests=requests;result.errors=caseErrors;
    result.captures.start=saveCanvas(out,caseIndex,result.captures.start);result.captures.end=saveCanvas(out,caseIndex,result.captures.end);caseObservations.push(result);
    if(result.error)errors.push({caseId:item.caseId,error:result.error});for(const error of caseErrors)errors.push({caseId:item.caseId,error});
    write(out,`case-${String(caseIndex+1).padStart(2,'0')}-observation.json`,result);console.log('FIRST_CHAPTER_ACTUAL_BROWSER_ATTACK',group,caseIndex+1,item.caseId,result.clock.postSteps,result.error?'approach-failed':result.observation?.verdict||'observed');
   }catch(error){errors.push({caseId:item.caseId,error:String(error?.stack??error)});write(out,`case-${String(caseIndex+1).padStart(2,'0')}-failure.json`,{caseId:item.caseId,index:item.index,error:String(error?.stack??error),errors:caseErrors,harnessRequests:requests,...FIRST_CHAPTER_OPEN_SCOPES});}
   finally{await context.close();}
  }
  stage='immutable-pure-case-gates';const observations=caseObservations.map(row=>row.observation);
  pureReport=group==='early'?summarizeEarlyChapterAttacks(observations):{group:'later',edition:'foundation',cases:observations};write(out,group+'-attacks-report.json',pureReport);
  const pureErrors=[];try{if(group==='early')assertEarlyChapterAttacks(pureReport);else assertFirstChapterLateAttacks(pureReport);}catch(error){pureErrors.push(String(error?.stack??error));errors.push({gate:'immutable-pure-observer',error:String(error?.stack??error)});}
  stage='closed-original-canvas-decode';const media=caseObservations.flatMap(r=>[r.captures.start.filename,r.captures.end.filename]),closedMedia=decodeJPGs(out,media);
  stage='frozen-input-recheck';const after=freezeAttackInputs(sourceRoot,controllerRoot);assert.deepEqual(after.source,binding.source);assert.deepEqual(after.sourceInputs,binding.sourceInputs);assert.deepEqual(after.controller,binding.controller);assert.deepEqual(after.sourceHarness,binding.sourceHarness);assert.deepEqual(bindFirstChapterPackage(binding,sourceRoot,buildRoot).package,binding.package);
  const recompiled=await compileFirstChapterAttackHarness({sourceRoot,base,journey:binding.package.journey});assert.deepEqual(recompiled.bytes,harness.bytes);assert.deepEqual(recompiled.descriptor.inputs,harness.descriptor.inputs);
  report={schemaVersion:1,kind:'actual-first-chapter-ordinary-attacks-browser-diagnostic',pass:errors.length===0&&pureErrors.length===0,group,...FIRST_CHAPTER_OPEN_SCOPES,
   source:binding.source,controller:binding.controller,package:binding.package,sourceReview,captureRun,providerRun:{commit:process.env.GITHUB_SHA||binding.controller.commit,...captureRun},captureOrigin:base.origin,capturePath:base.pathname,
   sourceWorkingBytesUnchanged:true,controllerWorkingBytesUnchanged:true,harnessWorkingBytesUnchanged:true,completeServedPackageVerified:true,
   servedPackage:{filename:'served-package.json',files:served.length},harness:harness.descriptor,browser:browserInfo,
   pureReport:{filename:group+'-attacks-report.json',cases:observations.length,pass:pureErrors.length===0},caseObservations,closedMedia,errors,
   humanPlaytest:false,hardwareFPSMeasured:false,cameraAccepted:false,allRenderFramesMeasured:false,
   method:'Fresh normal UI Play for each exact frozen ordinary-input attack, with actual compiled production driver, original actors/cargo and start/end native WebGL canvas. Complete production HTTP package remains unmodified.',
   limitations:['Only the catalogued finite attempts are measured; unsuccessful attempts do not establish universal exploit protection.','Rejected portal shots, failed approaches, interrupts and any actual win remain explicit failures requiring review.','Software WebGL and scripted input do not establish human discovery, physical-device FPS or full-chapter acceptance.']};
  write(out,'first-chapter-attacks-browser-report.json',report);
  // Close every writer before enumerating the entire artifact, not a selected
  // subset of images. The inventory itself is covered by the enclosing ZIP.
  const inventory={files:fs.readdirSync(out).sort().map(name=>{const filename=path.join(out,name);assert.equal(fs.lstatSync(filename).isFile(),true);const bytes=fs.readFileSync(filename);return{name,bytes:bytes.length,sha256:sha(bytes)};}),scope:'Every closed byte in this browser attack artifact; inventory excluded only from its own nonrecursive list.',...FIRST_CHAPTER_OPEN_SCOPES};
  write(out,'closed-media-member-inventory.json',inventory);
  assertFirstChapterAttacksBrowserDiagnostic(report,{group,source:binding.source,controller:binding.controller,package:binding.package,captureOrigin:base.origin,pureReport,closedInventory:inventory});
  console.log('FIRST_CHAPTER_ATTACKS_DIAGNOSTIC_COMPLETE',group,binding.source.commit,caseObservations.length,sha(fs.readFileSync(path.join(out,'first-chapter-attacks-browser-report.json'))));return report;
 }catch(error){write(out,'first-chapter-attacks-browser-failure.json',{kind:'actual-first-chapter-browser-attacks-failure',pass:false,group,stage,source:binding?.source??null,controller:binding?.controller??null,error:String(error?.stack??error),errors,caseObservations,pureReport,...FIRST_CHAPTER_OPEN_SCOPES});throw error;}
 finally{if(browser)await browser.close();if(server)await new Promise((resolve,reject)=>server.server.close(error=>error?reject(error):resolve()));}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await runFirstChapterAttacksBrowserQA();
