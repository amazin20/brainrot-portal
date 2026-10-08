/** Ordinary public controls and real media decoding for the accepted v54 build.
 * Run only after publication. The publication byte verifier separately covers
 * the complete runtime/video inventory; this probe does not rebuild or alter it.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {waitForStartMenu} from './lib/singularity-ui-check.mjs';
import {nativeActivate,assertMatrix,MATRIX_LEVELS,MATRIX_VIEWPORTS} from './lib/unified-public-input.mjs';
import {launchBrowserWithStartupRetry} from './lib/browser-startup.mjs';

const DEFAULT_SOURCE='578c31ebee7fd2ef01af5de8e673589c67e9daf0';
const SETTINGS='brainrot-foundation-v1:brainrot-portal.preferences.v24';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const recordings=[
 {id:'17',src:'walkthroughs/v54-level-17.mp4',duration:108.36666666666666},
 {id:'17-lower',src:'walkthroughs/v54-level-17-lower.mp4',duration:116.91666666666667},
 {id:'1',src:'walkthroughs/v54-level-1.mp4',duration:8.833333333333334},
];

function resource(base,relative){
 const url=new URL(relative,base);
 assert.equal(url.origin,base.origin,'Public resource escaped the expected origin');
 assert.ok(url.pathname.startsWith(base.pathname),'Public resource escaped its base');
 return url;
}
async function jsonResource(url){
 const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(90000)});
 assert.equal(response.status,200,'HTTP '+response.status+': '+url);
 const bytes=Buffer.from(await response.arrayBuffer());
 assert.ok(bytes.length<8*1024*1024,'Oversized browser metadata: '+url);
 return {value:JSON.parse(bytes.toString('utf8')),bytes:bytes.length,sha256:digest(bytes)};
}
async function availableLink(url){
 const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(90000)});
 assert.equal(response.status,200,'Broken public link: '+url);
 const result={url:String(url),status:response.status,type:response.headers.get('content-type')};
 await response.body?.cancel();return result;
}
async function captureFailure(page,report,out){
 if(report.failureState||page.isClosed())return;
 report.failureState=await page.evaluate(()=>{
  const ranges=value=>Array.from({length:value.length},(_,index)=>({start:value.start(index),end:value.end(index)}));
  return {url:location.href,state:document.documentElement.dataset.runtimeState,levelIndex:document.documentElement.dataset.levelIndex,selected:document.querySelector('#level-select')?.value,hidden:document.hidden,focused:document.hasFocus(),externalPause:document.body.dataset.externalPause,error:document.querySelector('#error-detail')?.textContent,
   media:[...document.querySelectorAll('video')].map(video=>({recording:video.dataset.recording||null,src:video.currentSrc||video.src,error:video.error?{code:video.error.code,message:video.error.message}:null,duration:video.duration,currentTime:video.currentTime,seeking:video.seeking,paused:video.paused,readyState:video.readyState,networkState:video.networkState,width:video.videoWidth,height:video.videoHeight,seekable:ranges(video.seekable),buffered:ranges(video.buffered)}))};
 }).catch(()=>null);
 await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
}
async function noDebugGlobals(page){
 const globals=await page.evaluate(()=>Object.getOwnPropertyNames(window).filter(key=>key.startsWith('__NESI_')&&window[key]!==undefined));
 assert.deepEqual(globals,[],'Ordinary public play exposes QA globals');return true;
}
async function trustedActivate(page,selector,touch=false){
 return nativeActivate(page,selector,touch);
}
async function waitPlaying(page,level=17){
 await page.waitForFunction(level=>{
  const data=document.documentElement.dataset;
  return data.runtimeState==='playing'&&Number(data.levelIndex)===level-1&&data.gameReady==='true';
 },{},level);
 assert.equal(await page.$eval('#level-number',element=>Number(element.textContent)),level);
 assert.equal(await page.$eval('#level-select',element=>Number(element.value)),level-1);
 await page.waitForFunction(()=>document.querySelector('#game canvas')?.width>0);
}
async function nativePause(page,touch){
 if(touch)await trustedActivate(page,'.lab-mobile button:nth-child(4)',true);
 else await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused'&&getComputedStyle(document.querySelector('#pause-screen')).opacity==='1');
}
async function touchBounds(page){
 const selectors=['#joystick','#sprint-button','#jump-button',...Array.from({length:4},(_,i)=>`.lab-mobile button:nth-child(${i+1})`)];
 const bounds=await page.evaluate(selectors=>selectors.map(selector=>{
  const element=document.querySelector(selector),rect=element?.getBoundingClientRect();
  return {selector,x:rect?.x,y:rect?.y,width:rect?.width,height:rect?.height,
   inViewport:!!rect&&rect.x>=0&&rect.y>=0&&rect.right<=innerWidth+1&&rect.bottom<=innerHeight+1,
   hit:!!rect&&element.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2))};
 }),selectors);
 for(const item of bounds){assert.ok(item.inViewport&&item.hit,'Touch control clipped/obstructed: '+item.selector);assert.ok(item.width>=44&&item.height>=44,'Touch control too small: '+item.selector);}
 return bounds;
}
async function ordinaryMenuPlay(browser,{base,identity,viewport,level,out,report}){
 const context=await browser.createBrowserContext(),page=await context.newPage();
 report.activePage=page;page.setDefaultTimeout(180000);page.setDefaultNavigationTimeout(180000);
 const failures=[],modelResponses=[];
 page.on('pageerror',error=>{const value=String(error);failures.push(value);report.errors.push(value);});
 page.on('error',error=>{const value='Renderer: '+String(error);failures.push(value);report.errors.push(value);});
 page.on('response',response=>{if(/\/models\/runtime\/model-(?:01-player|02-cargo|11-portal-gun)\.glb(?:[?#]|$)/.test(response.url()))modelResponses.push({url:response.url(),status:response.status()});});
 const touch=viewport.touch,stem=(base.pathname.endsWith('/chapter-atlas/')?'chapter':'root')+`-${viewport.width}x${viewport.height}-level-${level}`;
 const inputEvidence=[];
 const input=async selector=>{const evidence=await trustedActivate(page,selector,touch);inputEvidence.push(evidence);return evidence;};
 const selectRoom=async room=>{
  const sector=room===41?4:room>=42?5:Math.floor((room-1)/10);
  await input(`.sector-tabs [data-sector="${sector}"]`);await input(`.room-node[data-level="${room}"]`);
  assert.equal(await page.$eval('#level-select',element=>Number(element.value)),room-1);
  assert.equal(await page.$eval(`.room-node[data-level="${room}"]`,element=>element.getAttribute('aria-pressed')),'true');
 };
 try{
  await page.setViewport({width:viewport.width,height:viewport.height,deviceScaleFactor:1,isMobile:touch,hasTouch:touch});
  // Mute/low quality are reproducible preferences; room selection and all
  // actions below still come from real mouse/touch input in an ordinary page.
  await page.evaluateOnNewDocument(key=>localStorage.setItem(key,JSON.stringify({quality:'low',muted:true,tutorial:false})),SETTINGS);
  const url=new URL(base);url.searchParams.set('level',String(level));url.searchParams.set('verify',identity.value.commit);
  await page.goto(url.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);await noDebugGlobals(page);
  assert.equal(await page.evaluate(()=>document.body.dataset.chamberEdition),'foundation');
  assert.equal(await page.$$eval('#level-select option',items=>items.length),51);
  assert.equal(await page.$eval('#level-select',element=>Number(element.value)),level-1,'Explicit room link must select its room');
  const menuInfo=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,menuWidth:document.querySelector('#start-screen').clientWidth,menuScrollWidth:document.querySelector('#start-screen').scrollWidth,coarse:matchMedia('(pointer: coarse)').matches}));
  assert.ok(menuInfo.scrollWidth<=menuInfo.width+1&&menuInfo.menuScrollWidth<=menuInfo.menuWidth+2,'Campaign menu overflows horizontally');
  if(touch)assert.equal(menuInfo.coarse,true);
  // An explicit URL retains the intended room across reload. Selecting another
  // room and returning through native map clicks proves selection still works.
  await selectRoom(level===1?2:1);await selectRoom(level);
  const title=await page.$eval('#selected-room-title',element=>element.textContent.trim());assert.ok(title.length>1);
  const playText=await page.$eval('#play-button',element=>element.textContent.trim());
  if(level===41)assert.match(playText,/замок/i);else assert.match(playText,new RegExp(String(level)));
  await page.screenshot({path:path.join(out,stem+'-menu.png')});
  const links=await page.$$eval('#start-screen a[href]',elements=>[...new Set(elements.map(element=>element.href))].filter(url=>/^https?:/.test(url)));
  const linkChecks=[];
  for(const href of links){const link=new URL(href);if(link.origin===base.origin&&!link.hash)linkChecks.push(await availableLink(link));}
  await input('#play-button');await waitPlaying(page,level);await noDebugGlobals(page);
  assert.equal(new URL(page.url()).pathname,base.pathname,'Ordinary Play navigated away from its requested game');
  assert.ok((await page.$eval('#chamber',element=>element.textContent)).includes(title),'Selected room and in-game title differ');
  assert.equal(await page.$eval('#tower-run-clock',element=>element.hidden),true);
  assert.equal(await page.$eval('#hint-button',element=>element.hidden),true);
  const runtime=await page.evaluate(()=>({state:document.documentElement.dataset.runtimeState,level:Number(document.documentElement.dataset.levelIndex)+1,modelsLoaded:Number(document.documentElement.dataset.modelsLoaded),canvas:{width:document.querySelector('#game canvas').width,height:document.querySelector('#game canvas').height}}));
  assert.ok(runtime.modelsLoaded>=3,'Original actors did not load');
  for(const id of ['01-player','02-cargo','11-portal-gun'])assert.ok(modelResponses.some(response=>response.status===200&&response.url.includes('model-'+id+'.glb')),'Missing original model response '+id);
  const controls=touch?await touchBounds(page):null;
  await page.screenshot({path:path.join(out,stem+'-playing.png')});
  await nativePause(page,touch);await input('#restart-button');await waitPlaying(page,level);
  await delay(500);assert.equal(await page.evaluate(()=>document.documentElement.dataset.runtimeState),'playing','Restart did not remain playing');
  await nativePause(page,touch);await input('#resume-button');await waitPlaying(page,level);
  await nativePause(page,touch);await input('#level-menu-button');await waitForStartMenu(page);
  assert.equal(await page.$eval('#level-select',element=>Number(element.value)),level-1,'Return to map lost the selected room');
  assert.equal(await page.$eval(`.room-node[data-level="${level}"]`,element=>element.getAttribute('aria-pressed')),'true');
  await input('#play-button');await waitPlaying(page,level);await noDebugGlobals(page);
  await page.reload({waitUntil:'domcontentloaded'});await waitForStartMenu(page);await noDebugGlobals(page);
  assert.equal(await page.$eval('#level-select',element=>Number(element.value)),level-1,'Reload lost explicit target room');
  assert.equal(await page.$eval(`.room-node[data-level="${level}"]`,element=>element.getAttribute('aria-pressed')),'true');
  await input('#play-button');await waitPlaying(page,level);await noDebugGlobals(page);
  if(touch)await touchBounds(page);
  await page.screenshot({path:path.join(out,stem+'-reloaded-playing.png')});
  const publicInfo=await page.evaluate(async()=>{const response=await fetch('build-info.json',{cache:'no-store'});if(response.status!==200)throw Error('Build metadata unavailable');return response.json();});
  assert.deepEqual(publicInfo,identity.value,'Browser served different build metadata');
  assert.deepEqual(failures,[]);
  return {url:url.href,level,...viewport,title,selectedThroughMap:true,nativeTrustedPlay:true,ordinaryQAGlobalsAbsent:true,pauseRestartResumeReturnPlay:true,reloadAndReplay:true,inputEvidence,menu:menuInfo,runtime,originalModelResponses:modelResponses,mobileControls:controls,links:linkChecks,buildInfoSHA256:identity.sha256};
 }catch(error){await captureFailure(page,report,out);throw error;}
 finally{await context.close();report.activePage=null;}
}

async function activeOriginalModels(browser,{base,identity,out,report}){
 // Opt-in diagnostics are read only. They follow native Play and never assign
 // actor transforms, puzzle flags, game state, or the render loop.
 const context=await browser.createBrowserContext(),page=await context.newPage();report.activePage=page;
 page.setDefaultTimeout(180000);page.on('pageerror',error=>report.errors.push(String(error)));
 try{
  await page.setViewport({width:960,height:720,deviceScaleFactor:1});
  await page.evaluateOnNewDocument(key=>localStorage.setItem(key,JSON.stringify({quality:'low',muted:true,tutorial:false})),SETTINGS);
  const url=new URL(base);url.search='?level=17&debug=1';await page.goto(url.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);
  await trustedActivate(page,'#play-button');await waitPlaying(page);
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.renderFrames>2);
  const before=await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderFrames);await delay(500);
  const proof=await page.evaluate(()=>{
   const game=window.__NESI_DEMO_GAME__,equal=(a,b)=>!!a&&!!b&&a.length===b.length&&a.every((value,index)=>value===b[index]);
   const visible=object=>{for(let node=object;node;node=node.parent)if(node.visible===false)return false;return true;};
   const rows=[];
   for(const id of [1,2,11]){
    const source=game.assets.get(id),sourceMeshes=[];source?.traverse(node=>{if(node.isMesh)sourceMeshes.push(node);});
    const roots=[];game.scene.traverse(node=>{if(node.userData.assetId===id)roots.push(node);});
    const matches=[];
    for(const root of roots)root.traverse(mesh=>{
     if(!mesh.isMesh||!visible(mesh))return;
     const p=mesh.geometry.getAttribute('position'),index=mesh.geometry.index;
     const original=sourceMeshes.find(sourceMesh=>equal(p?.array,sourceMesh.geometry.getAttribute('position')?.array)&&((!index&&!sourceMesh.geometry.index)||equal(index?.array,sourceMesh.geometry.index?.array)));
     if(original)matches.push({name:mesh.name,sourceName:original.name,vertices:p.count,triangles:index?index.count/3:p.count/3,skinned:Boolean(mesh.isSkinnedMesh),sameMaterial:mesh.material===original.material});
    });
    rows.push({id,sourceLoaded:!!source,activeRoots:roots.length,visibleOriginalMeshes:matches});
   }
   const d=game.diagnostics();return {state:game.state,level:game.levelIndex+1,renderFrames:d.renderFrames,animationFrames:d.animationFrames,missingModels:d.missingModels,playerAppearance:game.playerVisual.userData.playerAppearanceMode,cargoIdentity:d.cargo.identity,cargoVisible:d.cargo.visible,rows};
  });
  assert.equal(proof.state,'playing');assert.equal(proof.level,17);assert.ok(proof.renderFrames>before,'Live public render loop did not advance');
  assert.ok(proof.animationFrames>0);assert.deepEqual(proof.missingModels,[]);assert.equal(proof.cargoVisible,true);
  for(const row of proof.rows){assert.equal(row.sourceLoaded,true);assert.ok(row.activeRoots>0);assert.ok(row.visibleOriginalMeshes.some(mesh=>mesh.vertices>0&&mesh.triangles>0),'Original visible geometry absent for model '+row.id);}
  await page.screenshot({path:path.join(out,(base.pathname.endsWith('/chapter-atlas/')?'chapter':'root')+'-original-models-17.png')});
  return {url:url.href,sourceCommit:identity.value.commit,inspection:'read-only opt-in diagnostics after native Play',...proof};
 }catch(error){await captureFailure(page,report,out);throw error;}
 finally{await context.close();report.activePage=null;}
}

async function videoSelector(page,id){
 const selector=`[data-recording="${id}"]`;
 assert.equal(await page.$$eval(selector,elements=>elements.length),1,'Missing/duplicated current recording '+id);
 return await page.$eval(selector,element=>element.tagName==='VIDEO')?selector:selector+' video';
}
async function decodedVideoFrame(page,selector){
 return page.$eval(selector,video=>{
  const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
  const context=canvas.getContext('2d');context.drawImage(video,0,0,160,90);
  const pixels=context.getImageData(0,0,160,90).data,colors=new Set();let min=255,max=0;
  for(let i=0;i<pixels.length;i+=4){const luminance=(pixels[i]*54+pixels[i+1]*183+pixels[i+2]*19)/256;min=Math.min(min,luminance);max=Math.max(max,luminance);colors.add((pixels[i]>>4)*256+(pixels[i+1]>>4)*16+(pixels[i+2]>>4));}
  return {currentTime:video.currentTime,duration:video.duration,width:video.videoWidth,height:video.videoHeight,readyState:video.readyState,luminanceRange:max-min,quantizedColors:colors.size};
 });
}
async function mediaState(page,selector){
 return page.$eval(selector,video=>{
  const ranges=value=>Array.from({length:value.length},(_,index)=>({start:value.start(index),end:value.end(index)}));
  return {src:video.currentSrc||video.src,currentTime:video.currentTime,seeking:video.seeking,paused:video.paused,duration:video.duration,readyState:video.readyState,networkState:video.networkState,width:video.videoWidth,height:video.videoHeight,error:video.error?{code:video.error.code,message:video.error.message}:null,seekable:ranges(video.seekable),buffered:ranges(video.buffered)};
 });
}
export async function verifyGallery(browser,{root,out,report}){
 const context=await browser.createBrowserContext(),page=await context.newPage();report.activePage=page;
 page.setDefaultTimeout(180000);page.on('pageerror',error=>report.errors.push(String(error)));
 try{
  await page.setViewport({width:1280,height:800,deviceScaleFactor:1});
  const gallery=new URL('walkthroughs.html',root);await page.goto(gallery.href,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-recording="17"]');
  const result={url:gallery.href,currentRecordings:[],historicalGalleries:[],progress:{stage:'current-recordings'}};report.gallery=result;
  for(const record of recordings){
   const recording={id:record.id,completed:false,decodedSeekFrames:[],seekAttempts:[]};result.currentRecordings.push(recording);
   result.progress={stage:'current-metadata',recording:record.id};console.log('Public gallery metadata',record.id);
   const selector=await videoSelector(page,record.id);await page.waitForSelector(selector);
   const label=await page.$eval(`[data-recording="${record.id}"]`,element=>(element.closest('article,section')||element).textContent.trim());
   assert.doesNotMatch(label,/историческ(?:ая|ое|ий)\s+(?:запись|видео|прохождение)|архивн(?:ая|ое|ый)\s+(?:запись|видео|прохождение)/i,'Current video was labeled historical');
   await page.$eval(selector,video=>{video.preload='auto';video.muted=true;video.load();});
   await page.waitForFunction(selector=>{const video=document.querySelector(selector);return video&&!video.error&&Number.isFinite(video.duration)&&video.duration>0&&video.readyState>=1;},{timeout:120000},selector);
   const metadata=await page.$eval(selector,video=>({src:video.currentSrc,duration:video.duration,width:video.videoWidth,height:video.videoHeight,error:video.error?.message||null}));
   Object.assign(recording,metadata);
   assert.equal(new URL(metadata.src).pathname,resource(root,record.src).pathname,'Gallery chose the wrong video');
   assert.ok(Math.abs(metadata.duration-record.duration)<.15,'Published media duration differs from accepted capture '+record.id);
   result.progress={stage:'current-playback',recording:record.id};
   const playback=await page.$eval(selector,async video=>{video.currentTime=0;await video.play();const before=video.currentTime;await new Promise(resolve=>setTimeout(resolve,1200));video.pause();return {advance:video.currentTime-before,paused:video.paused};});
   assert.ok(playback.advance>.1,'Public recording did not actually play: '+record.id);
   recording.actualPlaybackSeconds=playback.advance;recording.afterPlayback=await mediaState(page,selector);
   console.log('Public gallery playback',record.id,JSON.stringify({advance:playback.advance,state:recording.afterPlayback}));
   for(const fraction of [.2,.9]){
    const time=metadata.duration*fraction,attempt={fraction,requestedTime:time,before:await mediaState(page,selector),completed:false};recording.seekAttempts.push(attempt);
    result.progress={stage:'current-seek',recording:record.id,fraction,requestedTime:time};
    await page.$eval(selector,(video,time)=>{video.pause();video.currentTime=time;},time);
    attempt.afterAssignment=await mediaState(page,selector);console.log('Public gallery seek requested',record.id,JSON.stringify(attempt));
    await page.waitForFunction((selector,time)=>{const video=document.querySelector(selector);return !video.error&&!video.seeking&&video.readyState>=2&&Math.abs(video.currentTime-time)<.12;},{timeout:90000},selector,time);
    attempt.afterReady=await mediaState(page,selector);
    const frame=await decodedVideoFrame(page,selector);assert.ok(frame.width>0&&frame.height>0&&frame.luminanceRange>12&&frame.quantizedColors>12,'Decoded public video frame is blank: '+record.id);
    recording.decodedSeekFrames.push(frame);attempt.completed=true;console.log('Public gallery seek decoded',record.id,JSON.stringify({fraction,requestedTime:time,frame}));
    await page.screenshot({path:path.join(out,`gallery-${record.id}-frame-${Math.round(fraction*100)}.png`)});
   }
   recording.completed=true;
  }
  const archivePaths=['walkthroughs-v50.html','chapter-atlas/walkthroughs-v53.html'];
  const links=await page.$$eval('a[href]',elements=>elements.map(element=>({href:element.href,text:element.textContent.trim(),sectionHeading:element.closest('section,article,nav')?.querySelector('h1,h2,h3,h4')?.textContent.trim()||''})));
  for(const relative of archivePaths){
   result.progress={stage:'historical-gallery',relative};console.log('Public historical gallery',relative);
   const expected=resource(root,relative),link=links.find(link=>new URL(link.href).pathname===expected.pathname);
   assert.ok(link,'Missing preserved historical gallery link: '+relative);
   assert.match(link.text+' '+link.sectionHeading,/архив|историческ|предыдущ/i,'Historical gallery is not clearly labeled: '+relative);
   const availability=await availableLink(expected),archivePage=await context.newPage();report.activePage=archivePage;
   archivePage.setDefaultTimeout(90000);archivePage.on('pageerror',error=>report.errors.push(String(error)));
   try{
    await archivePage.goto(expected.href,{waitUntil:'domcontentloaded'});
    await archivePage.waitForFunction(()=>document.querySelector('video')||document.querySelectorAll('.level-card').length>0);
    const historical=await archivePage.evaluate(()=>({title:document.title,videoCount:document.querySelectorAll('video').length,cards:document.querySelectorAll('.level-card').length,videoSources:[...document.querySelectorAll('video')].map(video=>video.currentSrc||video.src||video.querySelector('source')?.src||'').filter(Boolean)}));
    for(const src of historical.videoSources)assert.equal(new URL(src).origin,root.origin,'Historical media left its preserved public origin');
    await archivePage.screenshot({path:path.join(out,'historical-'+(relative.includes('v53')?'v53':'v50')+'-gallery.png')});
    result.historicalGalleries.push({relative,label:link.text,sectionHeading:link.sectionHeading,...availability,...historical});
   }catch(error){await captureFailure(archivePage,report,out);throw error;}
   finally{await archivePage.close();report.activePage=page;}
  }
  await page.screenshot({path:path.join(out,'gallery-current-v54.png')});result.progress={stage:'complete'};return result;
 }catch(error){await captureFailure(page,report,out);throw error;}
 finally{await context.close();report.activePage=null;}
}

export async function main(){
 const source=process.env.SOURCE_SHA||DEFAULT_SOURCE;assert.match(source,/^[a-f0-9]{40}$/);
 const root=new URL(process.env.PUBLIC_BASE||'https://amazin20.github.io/brainrot-portal/');assert.ok(root.pathname.endsWith('/'),'PUBLIC_BASE must end in /');
 const chapter=new URL('chapter-atlas/',root),out=path.resolve(process.env.OUTPUT_DIR||process.env.OUT_DIR||'proof/unified-public-browser');fs.mkdirSync(out,{recursive:true});
 const report={pass:false,sourceCommit:source,root:root.href,chapter:chapter.href,scope:'public native desktop/touch menu controls, matching accepted build identities, active original actor meshes and real media decoding',limitations:['Software WebGL browser checks do not establish physical-device FPS or blind human playtest quality.','The separate publication byte verifier covers the complete accepted file inventory.'],errors:[],ordinary:[],activeOriginalModels:[]};
 let browser;
 try{
  const rootInfo=await jsonResource(resource(root,'build-info.json')),chapterInfo=await jsonResource(resource(chapter,'build-info.json'));
  for(const info of [rootInfo,chapterInfo]){assert.equal(info.value.commit,source,'Public game does not match accepted source');assert.equal(info.value.levels,51);assert.match(info.value.version,/^v54/);}
  assert.deepEqual(chapterInfo.value,rootInfo.value,'Root and chapter build metadata differ');assert.equal(chapterInfo.sha256,rootInfo.sha256,'Root and chapter build metadata bytes differ');
  report.identity={commit:source,version:rootInfo.value.version,levels:51,buildInfoSHA256:rootInfo.sha256,buildInfoBytes:rootInfo.bytes,rootAndChapterIdentical:true};
  const rootModels=await jsonResource(resource(root,'models/runtime/manifest.json')),chapterModels=await jsonResource(resource(chapter,'models/runtime/manifest.json'));
  assert.equal(rootModels.sha256,chapterModels.sha256,'Root and chapter original model manifests differ');
  for(const id of [1,2,11])assert.ok(rootModels.value.models.find(model=>model.id===id&&/^[a-f0-9]{64}$/.test(model.outputSHA256)),'Missing original model identity '+id);
  report.identity.modelManifestSHA256=rootModels.sha256;
  const {default:puppeteer,TimeoutError}=await import('puppeteer-core');report.browserStartup=[];
  browser=await launchBrowserWithStartupRetry({launch:options=>puppeteer.launch(options),TimeoutError,onAttempt:attempt=>report.browserStartup.push(attempt),options:{executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:720000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']}});
  report.gallery=await verifyGallery(browser,{root,out,report});
  for(const base of [root,chapter])for(const viewport of MATRIX_VIEWPORTS)for(const level of MATRIX_LEVELS){
   console.log('Public native controls',base.href,viewport.width+'x'+viewport.height,'room',level);
   report.ordinary.push(await ordinaryMenuPlay(browser,{base,identity:rootInfo,viewport,level,out,report}));
  }
  report.matrix=assertMatrix(report.ordinary,{root,chapter});
  for(const base of [root,chapter])report.activeOriginalModels.push(await activeOriginalModels(browser,{base,identity:rootInfo,out,report}));
  assert.deepEqual(report.errors,[]);report.pass=true;console.log('UNIFIED PUBLIC BROWSER VERIFIED',JSON.stringify({sourceCommit:source,plays:report.ordinary.length,currentVideos:report.gallery.currentRecordings.length,historicalGalleries:report.gallery.historicalGalleries.length}));
 }catch(error){
  report.error=String(error);report.stack=error.stack;
  if(report.activePage)await captureFailure(report.activePage,report,out);
  throw error;
 }finally{delete report.activePage;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();}
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
