/** Genuine balanced-quality interior renders for every requested room.
 * Native Play and the ordinary start camera are preserved. Subsequent views
 * use declared TEST cameras, with initial mechanisms and unchanged scene/fog.
 * Each room gets a fresh browser; no failed attempt is silently retried. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bindPlatformReviewPackages,parsePlatformRouteLevels,serveYandexReviewPackage} from './qa-campaign-platform-route.mjs';
import {campaignAccessFixture} from './lib/campaign-access-fixture.mjs';
import {waitForStartMenu,activate} from './lib/singularity-ui-check.mjs';
import {captureBrowserFrame} from './qa-browser-capture.mjs';
import {sha256,walkFiles} from './lib/release-manifest.mjs';
import {foundationDisplayNumber,FOUNDATION_SEQUENCE} from '../src/game/LabCampaignSequence.js';
import {RELEASE_VERSION} from '../src/game/ReleaseIdentity.js';

const cameraFile='tools/visual-audit-v65-reference-cameras.json';
const scopes={humanVisualAccepted:false,sourceAccepted:false,publicationAccepted:false,liveSdkAccepted:false,moderationAccepted:false,hardwareFpsMeasured:false};
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');

export function validateVisualAuditCameras(value){
 assert.equal(value.kind,'declared-v65-visual-reference-cameras');assert.match(value.sourceCommit,/^[a-f0-9]{40}$/);
 assert.equal(value.levels.length,51);assert.equal(new Set(value.levels.map(row=>row.stableLevel)).size,51);
 for(const row of value.levels){
  assert.ok(Number.isInteger(row.stableLevel)&&row.stableLevel>=1&&row.stableLevel<=51);
  assert.equal(row.displayNumber,foundationDisplayNumber(row.stableLevel-1));
  assert.ok(row.views.length>=3);assert.equal(new Set(row.views.map(view=>view.kind)).size,row.views.length);
  for(const view of row.views){
   assert.match(view.kind,/^[a-z0-9-]+$/);assert.notEqual(view.kind,'player-start');
   for(const key of ['camera',...(view.target?['target']:['quaternion'])])assert.ok(Array.isArray(view[key])&&view[key].length===(key==='quaternion'?4:3)&&view[key].every(Number.isFinite));
   assert.ok(Number.isFinite(view.fov)&&view.fov>=40&&view.fov<=100);
  }
 }
 return value;
}

/** The capture browser receives only frozen package files and the declared
 * SDK mock. The observer hashes actual CDP response bodies; it does not mock
 * network responses or require the checker's separate source-scan requests. */
function observeCaptureResponses(page,{base,binding,sdk}){
 const root=new URL(base),files=new Map(binding.review.files.map(row=>[row.path,row]));
 files.set('build-info.json',{bytes:binding.review.buildInfoBytes,sha256:binding.review.buildInfoSha256});
 const rows=[],failures=[],pending=new Set();
 const handler=response=>{
  const job=(async()=>{
   const url=new URL(response.url());if(['data:','blob:'].includes(url.protocol))return;
   assert.equal(url.origin,root.origin,'Unexpected capture origin');
   if(url.pathname.endsWith('/favicon.ico')&&response.status()===404)return;
   const isSdk=url.pathname==='/sdk.js';assert.ok(isSdk||url.pathname.startsWith(root.pathname));
   const relative=isSdk?'/sdk.js':decodeURIComponent(url.pathname.slice(root.pathname.length))||'index.html',expected=isSdk?sdk:files.get(relative);
   assert.ok(expected,'Capture response is absent from frozen inventory: '+relative);
   assert.ok([...url.searchParams].every(([key,value])=>relative==='index.html'&&['edition','level','debug'].includes(key)||key==='v'&&/^models\/runtime\/[^/]+\.glb$/.test(relative)&&value===expected.sha256.slice(0,12)),'Unexpected capture response query');
   assert.equal(response.status(),200);const bytes=await response.buffer();assert.equal(bytes.length,expected.bytes);assert.equal(sha256(bytes),expected.sha256);
   rows.push({path:relative,url:url.href,bytes:bytes.length,sha256:sha256(bytes),status:200,fromCache:response.fromCache(),explicitMockSdk:isSdk});
  })().catch(error=>failures.push(response.url()+': '+String(error.stack||error)));
  pending.add(job);void job.finally(()=>pending.delete(job));
 };
 page.on('response',handler);
 return{async finish(){
  await page.waitForNetworkIdle({idleTime:250,timeout:180000});while(pending.size)await Promise.all([...pending]);page.off('response',handler);
  assert.deepEqual(failures,[]);assert.ok(rows.some(row=>row.path==='index.html')&&rows.some(row=>row.explicitMockSdk)&&rows.some(row=>row.path.endsWith('.glb')));
  return{allReceivedBytesMatched:true,responseCount:rows.length,rows};
 }};
}

function readFrameState(){
 const g=window.__NESI_DEMO_GAME__,level=g.firstLevel;
 return{levelIndex:g.levelIndex,id:level.id,title:level.title,state:g.state,worldStep:g.physics.world.stepnumber,elapsed:g.elapsed,
  player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),cargoUUID:g.cargo.group.uuid,cargoBodyId:g.physics.cargoBody.id,
  camera:{position:g.camera.position.toArray(),quaternion:g.camera.quaternion.toArray(),fov:g.camera.fov,near:g.camera.near,far:g.camera.far},
  quality:{...g.quality},shadowsEnabled:g.renderer.shadowMap.enabled,
  fog:g.scene.fog?{type:g.scene.fog.type,near:g.scene.fog.near,far:g.scene.fog.far,color:g.scene.fog.color.getHex()}:null,
  viewport:{width:g.renderer.domElement.width,height:g.renderer.domElement.height},
  visualAudit:{global:level.visualAuditFinish?.diagnostics??null,early:level.visualAuditEarly?.stats??null,
   middle:level.visualAuditMiddle?.stats??null,late:level.visualAuditLateBound??null,castle:level.visualAuditCastle??null}};
}

async function retire(browser){
 const proc=browser.process();let timer;
 try{await Promise.race([browser.close(),new Promise(resolve=>{timer=setTimeout(resolve,5000);})]);}
 finally{clearTimeout(timer);if(proc?.exitCode===null)proc.kill('SIGKILL');}
}

export async function runVisualAuditCapture({sourceRoot=process.cwd(),directory=process.env.YANDEX_REVIEW_DIR||'dist-yandex-review',consumerDirectory=process.env.CONSUMER_DIR||'dist',outputDirectory=process.env.OUT_DIR||'qa/v66-visual',levels=parsePlatformRouteLevels(process.env.LEVELS),workers=Number(process.env.VISUAL_WORKERS||1)}={}){
 assert.ok(Number.isSafeInteger(workers)&&workers>=1&&workers<=2,'At most two independent fresh-room browsers');
 const root=path.resolve(sourceRoot),out=path.resolve(outputDirectory);assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Never overwrite prior visual evidence');fs.mkdirSync(out,{recursive:true});
 const binding=bindPlatformReviewPackages({sourceRoot:root,directory,consumerDirectory,localDiagnostic:process.env.LOCAL_DIAGNOSTIC==='1'}),cameraBytes=fs.readFileSync(path.join(root,cameraFile)),cameras=validateVisualAuditCameras(JSON.parse(cameraBytes));
 const controllers=['scripts/qa-visual-audit-capture.mjs',cameraFile].map(filename=>{
  const bytes=fs.readFileSync(path.join(root,filename));assert.deepEqual(bytes,execFileSync('git',['show','HEAD:'+filename],{cwd:root}));return{path:filename,bytes:bytes.length,sha256:sha256(bytes)};
 });
 const report={kind:'actual-balanced-room-visual-capture',pass:false,...scopes,version:RELEASE_VERSION,binding,controllers,levels,workers,
  cameraReference:{sourceCommit:cameras.sourceCommit,sha256:sha256(cameraBytes),fogPreserved:true},
  scope:'Ordinary native Play, ordinary player-start camera plus explicit fixed TEST interior cameras. Initial mechanism state is frozen at elapsed0. All world objects, materials, lights and fog remain unchanged. Captures do not establish animation, collision correctness or human visual acceptance. Separate original-checker route reports cover gameplay.',rows:[],errors:[]};
 const save=()=>write(path.join(out,'visual-capture-report.json'),report),mount=await serveYandexReviewPackage(directory);report.sdk=mount.sdk;save();
 const{default:puppeteer}=await import('puppeteer-core');let next=0;
 async function capture(level){
  const roomOut=path.join(out,'room-'+String(level).padStart(2,'0'));fs.mkdirSync(roomOut);const errors=[];
  const row={stableLevel:level,displayNumber:foundationDisplayNumber(level-1),pass:false,...scopes,views:[],errors};report.rows.push(row);save();let browser,page;
  try{
   browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:process.env.CHROME_HEADLESS==='shell'?'shell':true,protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
   page=await browser.newPage();page.setDefaultTimeout(180000);await page.setCacheEnabled(false);await page.setViewport({width:1280,height:720,deviceScaleFactor:1});
   await page._client().send('Network.enable',{maxTotalBufferSize:134217728,maxResourceBufferSize:67108864,enableDurableMessages:true});
   page.on('pageerror',error=>errors.push(String(error.stack||error)));page.on('error',error=>errors.push('Renderer: '+String(error)));
   const fixture=campaignAccessFixture({levelIndex:level-1,pathname:mount.pathname});fixture.preferences={...fixture.preferences,quality:'balanced'};fixture.raw=JSON.stringify(fixture.preferences);row.fixture=fixture;
   assert.deepEqual(fixture.completed,FOUNDATION_SEQUENCE.slice(0,FOUNDATION_SEQUENCE.indexOf(level-1)));assert.ok(!fixture.completed.includes(level-1));
   await page.evaluateOnNewDocument(({key,raw})=>{if(window!==window.top)return;localStorage.clear();localStorage.setItem(key,raw);},{key:fixture.key,raw:fixture.raw});
   const network=observeCaptureResponses(page,{base:mount.url,binding,sdk:mount.sdk}),url=new URL(mount.url);url.searchParams.set('edition','foundation');url.searchParams.set('level',String(level));url.searchParams.set('debug','1');row.url=url.href;
   await page.goto(url.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);await page.waitForFunction(()=>window.__NESI_PLATFORM__?.readySent);
   await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__,original=g.renderer.setAnimationLoop;original.call(g.renderer,null);g.renderer.setAnimationLoop=function(callback){return original.call(this,callback===g.animate?null:callback);};});
   await activate(page,'#play-button');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
   await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.updateVisuals(0,1,0);g.render();});row.start=await page.evaluate(readFrameState);
   assert.equal(row.start.levelIndex,level-1);assert.equal(row.start.elapsed,0);assert.equal(row.start.worldStep,0);assert.equal(row.start.shadowsEnabled,true);assert.equal(row.start.quality.shadowSize,1024);assert.deepEqual(row.start.viewport,{width:1280,height:720});
   row.nativeHUD=await captureBrowserFrame(page,path.join(roomOut,'player-start-hud.jpg'),{timeoutMs:60000,canvasOnly:false});assert.equal(row.nativeHUD.ok,true);assert.equal(row.nativeHUD.includesHTML,true,'Native HUD evidence cannot be replaced by a canvas-only fallback');
   const views=[{kind:'player-start'},...cameras.levels.find(row=>row.stableLevel===level).views];
   for(const view of views){
    if(view.kind!=='player-start')await page.evaluate(view=>{const g=window.__NESI_DEMO_GAME__,camera=g.camera;camera.position.fromArray(view.camera);if(view.target)camera.lookAt(camera.position.clone().fromArray(view.target));else camera.quaternion.fromArray(view.quaternion);camera.fov=view.fov;camera.updateProjectionMatrix();g.cameraRig.mainClippingPlanes=[];},{...view});
    const actual=await page.evaluate(readFrameState);assert.deepEqual(actual.fog,row.start.fog,'Camera-only capture must preserve authored fog');
    const filename=view.kind+'.jpg',capture=await captureBrowserFrame(page,path.join(roomOut,filename),{timeoutMs:60000,canvasOnly:true});assert.equal(capture.ok,true,JSON.stringify(capture));
    row.views.push({file:filename,kind:view.kind,metadata:actual,reference:view.kind==='player-start'?null:view,modifications:view.kind==='player-start'?[]:['TEST camera position/orientation/FOV','camera transition clipping cleared'],capture});save();console.log('VISUAL_VIEW_CAPTURED',level,row.displayNumber,view.kind);
   }
   row.end=await page.evaluate(readFrameState);for(const key of ['levelIndex','state','worldStep','elapsed','player','cargo','cargoUUID','cargoBodyId','quality','shadowsEnabled','fog'])assert.deepEqual(row.end[key],row.start[key],'Visual capture mutated '+key);
   row.network=await network.finish();assert.deepEqual(errors,[]);row.pass=true;write(path.join(roomOut,'meta.json'),row);console.log('VISUAL_ROOM_CAPTURED',level,row.displayNumber,row.views.length);save();
  }catch(error){row.failure=String(error.stack||error);report.errors.push({stableLevel:level,error:row.failure});write(path.join(roomOut,'meta.json'),row);save();}
  finally{if(browser)await retire(browser);}
 }
 try{
  await Promise.all(Array.from({length:Math.min(workers,levels.length)},async()=>{while(next<levels.length)await capture(levels[next++]);}));
  report.rows.sort((a,b)=>a.stableLevel-b.stableLevel);report.pass=report.rows.length===levels.length&&report.rows.every(row=>row.pass)&&report.errors.length===0;
 }finally{
  await new Promise(resolve=>mount.server.close(resolve));
  const files=walkFiles(out).filter(filename=>path.basename(filename)!=='visual-capture-report.json').map(filename=>{const bytes=fs.readFileSync(filename);return{path:path.relative(out,filename).split(path.sep).join('/'),bytes:bytes.length,sha256:sha256(bytes)};});
  const images=files.filter(row=>/\.jpg$/.test(row.path));report.artifacts={files,filesSha256:sha256(JSON.stringify(files)),imageCount:images.length,uniqueImageHashes:new Set(images.map(row=>row.sha256)).size};save();
 }
 assert.equal(report.pass,true,'Some genuine visual captures failed; retain all failures and use a new output directory for a later attempt');return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await runVisualAuditCapture();
