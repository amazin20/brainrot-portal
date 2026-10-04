import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
import {assertUpgradeInfo,assertUpgradeEvidence,upgradePreviewPath} from './lib/singularity-upgrade-proof.mjs';
import {verifySingularityUI,waitForStartMenu,playFromStartMenu} from './lib/singularity-ui-check.mjs';

const config=JSON.parse(fs.readFileSync(process.env.RELEASE_CONFIG||'tools/singularity-upgrade-release.json','utf8'));
const root=new URL(process.env.PAGE_URL||'https://amazin20.github.io/brainrot-portal/');
const preview=new URL(upgradePreviewPath(config)+'/',root),out=path.resolve('publication-proof');fs.mkdirSync(out,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function bytes(url){const r=await fetch(url);assert.equal(r.status,200,`HTTP ${r.status}: ${url}`);return Buffer.from(await r.arrayBuffer());}
let release;
for(let attempt=0;attempt<60;attempt++){
 try{const u=new URL('preview-release.json',preview);u.searchParams.set('verify',String(Date.now()));const r=await fetch(u);if(r.ok){const value=await r.json();if(value.sourceCommit===config.sourceCommit&&value.mode===config.mode){release=value;break;}}}catch{}
 await new Promise(resolve=>setTimeout(resolve,5000));
}
assert.ok(release,'The exact upgraded preview did not become publicly available');
const candidate=JSON.parse(fs.readFileSync('candidate/build-info.json','utf8')),info=JSON.parse(await bytes(new URL('build-info.json',preview))),tower=assertUpgradeInfo(info);
assert.deepEqual(info,candidate);assert.equal(info.commit,config.sourceCommit);assert.equal(release.completedMachines,tower.stages);assert.equal(release.independentHalls,tower.independentHalls);
const rootInfo=JSON.parse(await bytes(new URL('build-info.json',root)));assert.deepEqual(rootInfo,candidate,'The primary game must be the exact verified upgraded package');
const promotion=release.rootPromotion;assert.ok(promotion);assert.equal(promotion.sourceCommit,info.commit);assert.equal(promotion.originalRootCommit,config.baseCommit);
const base=release.baseProvenance;assert.ok(base);assert.equal(base.rootCommit,config.baseCommit);assert.equal(base.originalCampaignRun,config.baseRun);
assert.equal(base.publisherRun,36580171792);assert.equal(base.publisherCommit,'a3878d7f17c69319178238db2106a6c41d87cd84');assert.equal(base.originalArtifactId,11039257191);
assert.equal(base.preservedBySourceCommit,config.sourceCommit);assert.equal(base.preservedByRun,String(config.candidateRun));assert.equal(base.archiveSHA256,'7c310c2220d9ae7839d6bddd030f52e1c7730091ade768805975d605f5b8352d');
const candidateFiles=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?candidateFiles(path.join(dir,e.name)):[path.join(dir,e.name)]);
const expectedFiles=candidateFiles('candidate').map(p=>({path:path.relative('candidate',p),sha256:hash(fs.readFileSync(p)),bytes:fs.statSync(p).size})).sort((a,b)=>a.path.localeCompare(b.path));
assert.deepEqual(promotion.exactCandidateFiles,expectedFiles);
for(const f of expectedFiles)assert.equal(hash(await bytes(new URL(f.path,root))),f.sha256,'The public primary file differs from the verified package: '+f.path);
assert.equal(hash(await bytes(new URL('index.html',root))),promotion.promotedIndexSHA256);
assert.equal(hash(await bytes(new URL('build-info.json',root))),promotion.promotedBuildInfoSHA256);
for(let i=0;i<promotion.retainedMedia.length;i+=4)await Promise.all(promotion.retainedMedia.slice(i,i+4).map(async f=>assert.equal(hash(await bytes(new URL(f.path,root))),f.sha256,'An approved retained recording/gallery file changed: '+f.path)));
const galleryBytes=await bytes(new URL('walkthroughs/manifest.json',root)),gallery=JSON.parse(galleryBytes);
assert.equal(hash(galleryBytes),promotion.rootGalleryManifestSHA256);
for(const retained of promotion.retainedGalleryEntries){const e=gallery.levels.find(e=>e.level===retained.level);assert.ok(e);assert.equal(hash(Buffer.from(JSON.stringify(e))),retained.sha256,'A retained gallery entry changed');}
assert.deepEqual(gallery.levels.find(e=>e.level===41),promotion.finale);
const native=JSON.parse(await bytes(new URL('native-evidence.json',preview)));assertUpgradeEvidence(native,info);
const html=await bytes(new URL('index.html',preview));assert.equal(hash(html),hash(fs.readFileSync('candidate/index.html')));
const bundle=html.toString().match(/src="([^"]+\.js)"/);assert.ok(bundle);
assert.equal(hash(await bytes(new URL(bundle[1],preview))),hash(fs.readFileSync(path.join('candidate',bundle[1]))));
const manifest=JSON.parse(await bytes(new URL('models/runtime/manifest.json',preview)));
for(const model of manifest.models)assert.equal(hash(await bytes(new URL('models/runtime/'+model.filename,preview))),model.outputSHA256);
const proof={sourceCommit:info.commit,version:info.version,mode:config.mode,url:root.href,towerPermalink:preview.href,originalRootCommit:config.baseCommit,
 primaryCandidateFiles:expectedFiles.length,retainedMediaHashes:promotion.retainedMedia.length,retainedGalleryEntries:promotion.retainedGalleryEntries.length,
 completedMachines:tower.stages,modelHashes:manifest.models.length,video:null,errors:[]};
if(config.mode==='complete'){
 const recorded=JSON.parse(await bytes(new URL('recording-evidence.json',preview)));assertUpgradeEvidence(recorded,info,{record:true});
 assert.equal(release.video.sha256,recorded.video.sha256);const movie=await bytes(new URL(release.video.filename,preview));assert.equal(hash(movie),release.video.sha256);assert.equal(movie.length,release.video.bytes);
 assert.equal(new URL(release.video.filename,preview).href,new URL(promotion.finale.src,root).href,'The permalink and primary gallery must share the same verified recording');
 assert.equal(release.video.publishedPath,promotion.finale.src);assert.equal(promotion.finale.sha256,release.video.sha256);
 proof.video={sha256:hash(movie),bytes:movie.length,seekTimes:[]};
}
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:1_800_000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let page;
try{
 const ui=await verifySingularityUI(browser,{url:root,info,out:path.join(out,'public-ui')});
 Object.assign(proof,{ordinaryMenu:ui.ordinaryMenu,ordinaryPlay:ui.ordinaryPlay,mobile:ui.mobile,rootTowerStages:ui.towerStages,resetAfterSolvedPuzzle:ui.resetAfterSolvedPuzzle,reloadAfterSolvedPuzzle:ui.reloadAfterSolvedPuzzle,publicPuzzleSeconds:ui.publicPuzzleSeconds});
 page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width:960,height:540,deviceScaleFactor:1});page.on('pageerror',e=>proof.errors.push(String(e)));
 const first=new URL(root);first.search='?edition=foundation&level=1';await page.goto(first.href,{waitUntil:'domcontentloaded'});
 await waitForStartMenu(page);assert.equal(await page.$eval('#level-select',e=>Number(e.value)),0);
 assert.equal(await page.evaluate(()=>typeof window.__NESI_DEMO_GAME__),'undefined');await playFromStartMenu(page);
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.levelIndex),'0');proof.rootPlayLevel1=true;
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');await page.click('#level-menu-button');await waitForStartMenu(page);
 await page.select('#level-select','40');await playFromStartMenu(page);
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.levelIndex),'40');assert.match(await page.$eval('#chamber',e=>e.textContent),/СИНГУЛЯРНОСТИ/);assert.equal(new URL(page.url()).pathname,root.pathname);
 await page.screenshot({path:path.join(out,'primary-game-dropdown-41.png')});proof.rootDropdownLevel41=true;
 const unqualified=new URL(root);unqualified.search='?level=41&debug=1';await page.goto(unqualified.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);
 assert.equal(new URL(page.url()).pathname,root.pathname,'Primary finale deep links must remain on the primary game');
 const deep=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return {level:g.levelIndex+1,edition:g.chamberEdition,totalStages:g.firstLevel.totalStages,roomIds:[...g.firstLevel.rooms.keys()]};});
 assert.equal(deep.level,41);assert.equal(deep.edition,'foundation');assert.equal(deep.totalStages,tower.stages);assert.deepEqual(deep.roomIds.sort(),tower.rooms.map(r=>r.id).sort());proof.rootDefaultDeepLink=deep;
 await page.goto(new URL('?edition=foundation&level=41',preview).href,{waitUntil:'domcontentloaded'});await playFromStartMenu(page);
 assert.match(await page.$eval('#chamber',e=>e.textContent),/СИНГУЛЯРНОСТИ/);proof.towerPermalinkPlay=true;await page.close();page=null;
 page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width:960,height:540,deviceScaleFactor:1});page.on('pageerror',e=>proof.errors.push(String(e)));
 await page.goto(new URL('walkthrough.html',preview).href,{waitUntil:'domcontentloaded'});
 if(config.mode==='complete'){
  await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&Number.isFinite(v.duration)&&v.duration>900;});
  const duration=await page.$eval('video',v=>v.duration);assert.ok(Math.abs(duration-release.video.durationSeconds)<.12);
  for(const fraction of [.2,.6,.99]){
   const time=duration*fraction;await page.$eval('video',(v,time)=>{v.muted=true;v.currentTime=time;},time);
   await page.waitForFunction(time=>{const v=document.querySelector('video');return !v.error&&!v.seeking&&v.readyState>=2&&Math.abs(v.currentTime-time)<1;},{timeout:90000},time);
   proof.video.seekTimes.push(await page.$eval('video',v=>v.currentTime));
  }
  assert.equal(await page.$$eval('[data-seek]',a=>a.length),tower.stages);await page.screenshot({path:path.join(out,'public-video-seeking.png')});
  await page.goto(new URL('walkthroughs.html?level=41',root).href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#video')?.getAttribute('src')?.includes('walkthroughs/level-41.mp4'));
  await page.$eval('#video',v=>{v.preload='metadata';v.load();});await page.waitForFunction(()=>Number.isFinite(document.querySelector('#video').duration)&&document.querySelector('#video').duration>900);
  assert.ok(Math.abs(await page.$eval('#video',v=>v.duration)-release.video.durationSeconds)<.12);assert.match(await page.$eval('#watch-heading',e=>e.textContent),/Сингулярности/);
  const tail=release.video.durationSeconds*.99;await page.$eval('#video',(v,t)=>{v.muted=true;v.currentTime=t;},tail);
  await page.waitForFunction(t=>{const v=document.querySelector('#video');return !v.error&&!v.seeking&&v.readyState>=2&&Math.abs(v.currentTime-t)<1;},{timeout:90000},tail);
  proof.rootFinaleGallery={sourceCommit:promotion.finale.sourceCommit,sha256:promotion.finale.sha256,durationSeconds:release.video.durationSeconds,tailSeek:tail};
  await page.screenshot({path:path.join(out,'primary-gallery-new-finale.png')});
 }else assert.equal(await page.$('video'),null);
 assert.deepEqual(proof.errors,[]);proof.pass=true;console.log('PUBLIC UPGRADE VERIFIED',JSON.stringify(proof));
}catch(error){
 proof.pass=false;proof.error=String(error);
 if(page){
  proof.failureState=await page.evaluate(()=>({url:location.href,runtime:document.documentElement.dataset.runtimeState,levelIndex:document.documentElement.dataset.levelIndex,selectedLevel:document.querySelector('#level-select')?.value,externalPause:document.body.dataset.externalPause,hidden:document.hidden,focused:document.hasFocus(),menuOpacity:document.querySelector('#start-screen')&&getComputedStyle(document.querySelector('#start-screen')).opacity,error:document.querySelector('#error-detail')?.textContent})).catch(()=>null);
  await page.screenshot({path:path.join(out,'public-failure.png')}).catch(()=>{});
 }
 throw error;
}
finally{fs.writeFileSync(path.join(out,'public-proof.json'),JSON.stringify(proof,null,2)+'\n');await browser.close();}
