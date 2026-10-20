/** Actual consumer UI/storage proof. Only the separately labelled historical
 * migration case supplies completed rooms. The fresh-guest win uses the real
 * ordinary-input journey after an actual Play click at its normal spawn. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildSourceInputs,verifyReleaseMetadata,verifyReleasePackage,sha256} from './lib/release-manifest.mjs';
import {serveFrozenCampaign} from './lib/frozen-campaign-server.mjs';
import {assertStampedCampaignInfo,assertCampaignBrowserState} from './lib/campaign-browser-contract.mjs';
import {waitForStartMenu,activate} from './lib/singularity-ui-check.mjs';
import {assertAtlasAccess,assertCompactPause,assertMobileControls,assertMigrationPhase} from './lib/player-access-browser-proof.mjs';
import {V62_IMPORTED_PREFERENCES,v61HistoricalPreferenceFixture} from './lib/campaign-preferences-fixture.mjs';
import {FOUNDATION_SEQUENCE,foundationDisplayNumber} from '../src/game/LabCampaignSequence.js';
import {CAMPAIGN_PREFERENCE_KEY,CAMPAIGN_V62_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX,foundationCampaignPrefix} from '../src/game/LabCampaignStorage.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS,RELEASE_VERSION} from '../src/game/ReleaseIdentity.js';
import {campaignSpec} from '../src/game/LabCampaignLevels.js';

const git=(root,args)=>execFileSync('git',args,{cwd:root,maxBuffer:32000000,encoding:'utf8'}).trim();
const openScopes=Object.freeze({sourceAccepted:false,publicationAccepted:false,liveSdkAccepted:false,moderationAccepted:false,physicalPhonePerformanceAccepted:false});
const controllerPaths=['scripts/qa-player-access-browser.mjs','scripts/lib/player-access-browser-proof.mjs','scripts/lib/campaign-browser-contract.mjs','scripts/lib/campaign-preferences-fixture.mjs','scripts/lib/singularity-ui-check.mjs','scripts/lib/frozen-campaign-server.mjs','scripts/lib/release-manifest.mjs'];
const positive=(value,label)=>{const n=Number(value);assert.ok(Number.isSafeInteger(n)&&n>0,label+' must identify the actual CI run/attempt');return n;};

export function bindPlayerAccessPackage({sourceRoot=process.cwd(),directory='dist'}={}){
 const root=path.resolve(sourceRoot),commit=git(root,['rev-parse','HEAD']),tree=git(root,['rev-parse','HEAD^{tree}']);
 assert.match(commit,/^[a-f0-9]{40}$/);assert.match(tree,/^[a-f0-9]{40}$/);
 if(process.env.BUILD_COMMIT||process.env.GITHUB_SHA)assert.equal(commit,process.env.BUILD_COMMIT||process.env.GITHUB_SHA);
 assert.equal(git(root,['status','--porcelain','--untracked-files=no']),'','Commit source/controller before browser evidence');
 assert.equal(git(root,['status','--porcelain','--untracked-files=all','--','src','public','index.html','vite.config.js','package.json','package-lock.json']),'','Only committed production inputs are allowed');
 const sourceInputs=buildSourceInputs(root),sourceInputsSha256=sha256(JSON.stringify(sourceInputs));
 const build=path.resolve(directory),bytes=fs.readFileSync(path.join(build,'build-info.json')),info=JSON.parse(bytes);
 assertStampedCampaignInfo(info,commit);assert.equal(info.sourceInputsSha256,sourceInputsSha256);
 verifyReleaseMetadata(info,{directory:build,commit,root,run:process.env.SOURCE_REVIEW_RUN_ID||info.run||null});
 const files=verifyReleasePackage(info,build),controllers=controllerPaths.map(filename=>{
  const value=fs.readFileSync(path.join(root,filename));assert.deepEqual(value,execFileSync('git',['show','HEAD:'+filename],{cwd:root}));
  return{path:filename,bytes:value.length,sha256:sha256(value)};
 });
 assert.ok(!files.some(file=>/debugcheck|yandex-games-debug-checker/.test(file.path)),'Checker must not ship in the consumer game');
 return{kind:'current-consumer-player-access-package',...openScopes,
  source:{commit,tree,sourceInputsSha256,sourceInputFiles:sourceInputs.length},
  controller:{commit,tree,files:controllers,filesSha256:sha256(JSON.stringify(controllers)),trackedWorkingTreeClean:true},
  runId:positive(process.env.GITHUB_RUN_ID,'GITHUB_RUN_ID'),runAttempt:positive(process.env.GITHUB_RUN_ATTEMPT,'GITHUB_RUN_ATTEMPT'),
  package:{commit,version:info.version,buildInfoBytes:bytes.length,buildInfoSha256:sha256(bytes),packageFilesSha256:info.packageFilesSha256,files,fileCount:files.length,totalBytes:files.reduce((n,file)=>n+file.bytes,0)}};
}

export async function runPlayerAccessBrowserQA(){
 const root=path.resolve(process.env.SOURCE_DIR||'.'),directory=path.resolve(process.env.SITE_DIR||'dist');
 const out=path.resolve(process.env.OUT_DIR||'qa/player-access');fs.mkdirSync(out,{recursive:true});
 assert.deepEqual(fs.readdirSync(out),[],'Use a fresh output directory; stale images are not current proof');
 const report={kind:'actual-consumer-player-access-browser-proof',...openScopes,pass:false,errors:[],screenshots:[],forgedQueries:[],migration:[],mobile:[],browserResponses:[],
  scope:'Fresh guest access, one genuine room 1 ordinary-input victory and Next/reload/replay, compact Escape/Atlas return, separately labelled accepted-v62 save migration, and actual full-page mobile screenshots. Phone emulation does not measure hardware FPS.'};
 const write=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');
 const save=()=>write('report.json',report);
 let binding,browser,mounted,page,stage='source-package-binding';
 try{
  binding=bindPlayerAccessPackage({sourceRoot:root,directory});write('binding.json',binding);
  mounted=process.env.PAGE_URL?null:await serveFrozenCampaign(directory);
  const base=new URL(process.env.PAGE_URL||mounted.url);assert.equal(base.search,'');assert.equal(base.hash,'');
  const ownPrefix=foundationCampaignPrefix(base.pathname),ownKey=ownPrefix+CAMPAIGN_PREFERENCE_KEY;
  assert.notEqual(ownPrefix,FOUNDATION_STORAGE_PREFIX,'Use the actual isolated candidate campaign mount');
  assert.equal(ownPrefix,'brainrot-campaign-'+RELEASE_VERSION.split('-')[0]+':');
  report.url=base.href;report.sourceCommit=binding.source.commit;report.sourceTree=binding.source.tree;
  stage='complete-served-http-package';const served=[];
  for(const expected of[...binding.package.files,{path:'build-info.json',bytes:binding.package.buildInfoBytes,sha256:binding.package.buildInfoSha256}]){
   const response=await fetch(new URL(expected.path,base),{cache:'no-store'});assert.equal(response.status,200);
   const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,expected.bytes);assert.equal(sha256(bytes),expected.sha256,'Served package differs: '+expected.path);
   served.push({...expected,status:response.status});
  }
  write('served-package.json',{sourceCommit:binding.source.commit,sourceTree:binding.source.tree,allHTTPFilesVerified:true,files:served,...openScopes});
  stage='browser-launch';const{default:puppeteer}=await import('puppeteer-core');
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:process.env.CHROME_HEADLESS==='shell'?'shell':true,pipe:process.env.CHROME_PIPE==='1',protocolTimeout:180000,
   args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  report.browser={product:await browser.version(),userAgent:await browser.userAgent()};
  const expectedResponses=new Map([...binding.package.files,{path:'build-info.json',bytes:binding.package.buildInfoBytes,sha256:binding.package.buildInfoSha256}].map(file=>[file.path,file]));
  const open=async({query={},debug=true,touch=false,viewport={width:1024,height:768},historical=null}={})=>{
   const context=await browser.createBrowserContext(),p=await context.newPage();p.setDefaultTimeout(180000);
   await p.setCacheEnabled(false);
   await p.setViewport({...viewport,deviceScaleFactor:1,...(touch?{isMobile:true,hasTouch:true}:{})});
   p.on('pageerror',error=>report.errors.push(String(error.stack||error)));p.on('error',error=>report.errors.push('Renderer: '+String(error)));
   const responses=[],pending=new Set(),failures=[];
   const responseObserver=response=>{
    const job=(async()=>{
     const url=new URL(response.url());if(['data:','blob:'].includes(url.protocol))return;
     if(url.pathname.endsWith('/favicon.ico')&&response.status()===404)return;
     assert.equal(url.origin,base.origin,'Browser received an external response');assert.ok(url.pathname.startsWith(base.pathname),'Browser received a response outside the frozen mount');
     const relative=decodeURIComponent(url.pathname.slice(base.pathname.length))||'index.html',expected=expectedResponses.get(relative);
     assert.ok(expected,'Browser received a file absent from the frozen inventory: '+relative);assert.equal(response.status(),200);
     const bytes=await response.buffer();assert.equal(bytes.length,expected.bytes);assert.equal(sha256(bytes),expected.sha256,'Actual browser response differs: '+relative);
     responses.push({url:url.href,path:relative,status:response.status(),bytes:bytes.length,sha256:sha256(bytes)});
    })().catch(error=>failures.push(String(error.stack||error)));
    pending.add(job);void job.finally(()=>pending.delete(job));
   };
   p.on('response',responseObserver);
   let seed;
   if(historical)seed=await p.evaluateOnNewDocument(({key,raw})=>localStorage.setItem(key,raw),historical);
   await p.evaluateOnNewDocument(()=>{
    window.__PLAYER_ACCESS_STORAGE_WRITES__=[];
    for(const method of['setItem','removeItem','clear']){const original=Storage.prototype[method];Storage.prototype[method]=function(...args){window.__PLAYER_ACCESS_STORAGE_WRITES__.push({method,key:method==='clear'?'':String(args[0])});return original.apply(this,args);};}
   });
   const url=new URL(base);if(debug)url.searchParams.set('debug','1');for(const[key,value]of Object.entries(query))url.searchParams.set(key,value);
   await p.goto(url.href,{waitUntil:'domcontentloaded'});if(seed)await p.removeScriptToEvaluateOnNewDocument(seed.identifier);
   await p.bringToFront();await waitForStartMenu(p);return{context,page:p,url:url.href,responses,pending,failures,responseObserver};
  };
  const close=async session=>{
   await Promise.all([...session.pending]);session.page.off('response',session.responseObserver);
   assert.deepEqual(session.failures,[],'Browser did not receive the frozen package bytes');
   assert.ok(session.responses.some(row=>row.path==='index.html')&&session.responses.some(row=>row.path.endsWith('.js')),'Actual HTML and JavaScript response bodies required');
   report.browserResponses.push({url:session.url,allReceivedBytesMatched:true,responses:session.responses});await session.context.close();
  };
  const observe=async p=>p.evaluate(({ownKey,flagNames})=>{const g=window.__NESI_DEMO_GAME__;return{
   state:document.documentElement.dataset.runtimeState,index:Number(document.documentElement.dataset.levelIndex),selectedIndex:Number(document.querySelector('#level-select').value),
   optionCount:document.querySelector('#level-select').options.length,completed:g?[...window.__NESI_PREFS__.value.completed]:null,
   ownRaw:localStorage.getItem(ownKey),writes:window.__PLAYER_ACCESS_STORAGE_WRITES__.slice(),
   runtime:g?{levelIndex:g.levelIndex,edition:g.chamberEdition,id:g.firstLevel.id,flags:Object.fromEntries(flagNames.map(key=>[key,g[key]])),
    hudNumber:Number(document.querySelector('#level-number').textContent),optionNumber:Number(document.querySelector(`#level-select option[value="${g.levelIndex}"]`).textContent.match(/^\d+/)?.[0])}:null};},{ownKey,flagNames:Object.keys(ACTIVE_FOUNDATION_RUNTIME_FLAGS)});
  const atlas=async(p,completed=[])=>{
   const tabs=await p.$$eval('.sector-tabs button',buttons=>buttons.map(button=>button.dataset.sector)),rows=[];
   for(const sector of tabs){await activate(p,`.sector-tabs button[data-sector="${sector}"]`);rows.push(...await p.$$eval('.room-node',buttons=>buttons.map(button=>({index:Number(button.dataset.roomIndex),number:Number(button.dataset.level),disabled:button.disabled,ariaDisabled:button.getAttribute('aria-disabled'),completed:button.classList.contains('room-node--completed')}))));}
   rows.sort((a,b)=>FOUNDATION_SEQUENCE.indexOf(a.index)-FOUNDATION_SEQUENCE.indexOf(b.index));assertAtlasAccess(rows,completed);return rows;
  };
  const snap=async(p,name)=>{await p.waitForFunction(()=>[...document.querySelectorAll('.screen.screen--active')].every(screen=>getComputedStyle(screen).opacity==='1'));const file=path.join(out,name);await p.screenshot({path:file,fullPage:false});const bytes=fs.readFileSync(file);assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');const row={path:name,bytes:bytes.length,sha256:sha256(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),capture:'Puppeteer page.screenshot includes actual HTML UI'};report.screenshots.push(row);return row;};
  const play=async(p,touch=false)=>{await activate(p,'#play-button',touch);await p.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');};

  stage='ordinary-fresh-guest';let session=await open({debug:false});page=session.page;
  report.freshGuest={url:session.url,observation:await observe(page),atlas:await atlas(page)};
  assert.equal(report.freshGuest.observation.index,0);assert.equal(report.freshGuest.observation.selectedIndex,0);assert.equal(report.freshGuest.observation.optionCount,51);
  assert.equal(await page.evaluate(()=>typeof window.__NESI_DEMO_GAME__),'undefined','Ordinary public entry leaked the debug bridge');
  await snap(page,'fresh-guest-atlas.png');await close(session);

  stage='forged-public-queries';
  for(const query of[{level:'51'},{pilot:'43'},{pilot:'progression'},{tower41preview:'1'}]){
   session=await open({query});page=session.page;const value=await observe(page);
   assert.equal(value.index,0);assert.equal(value.selectedIndex,0);assert.equal(value.optionCount,51);assert.deepEqual(value.completed,[]);assertCampaignBrowserState(value.runtime,1);
   const nodes=await atlas(page);await play(page);const playing=await observe(page);assert.equal(playing.index,0);assertCampaignBrowserState(playing.runtime,1);
   report.forgedQueries.push({query,url:session.url,ready:value,atlas:nodes,playing});await close(session);
  }

  stage='closed-dom-selection';session=await open();page=session.page;
  await page.$eval('#level-select',select=>{select.value='50';});
  assert.equal(await page.$eval('#level-select',select=>Number(select.value)),50);
  await activate(page,'#play-button');
  await page.waitForFunction(()=>Number(document.querySelector('#level-select').value)===0&&['ready','playing'].includes(document.documentElement.dataset.runtimeState));
  report.closedDomSelection={requestedIndex:50,changeEventDispatched:false,afterForbiddenPlay:await observe(page)};
  assert.equal(report.closedDomSelection.afterForbiddenPlay.index,0);assert.deepEqual(report.closedDomSelection.afterForbiddenPlay.completed,[]);
  if(report.closedDomSelection.afterForbiddenPlay.state==='ready')await play(page);
  report.closedDomSelection.playing=await observe(page);assert.equal(report.closedDomSelection.playing.index,0);
  assert.deepEqual(report.closedDomSelection.playing.completed,[]);assertCampaignBrowserState(report.closedDomSelection.playing.runtime,1);await close(session);

  stage='real-first-room-win';session=await open();page=session.page;
  // Suppress only the scheduled render callback until the ordinary driver owns
  // the clock. No game state, spawn, actors, goals or preferences are assigned.
  await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__,r=g.renderer,original=r.setAnimationLoop;r.setAnimationLoop=function(callback){return original.call(this,callback===g.animate?null:callback);};window.__PLAYER_ACCESS_SCHEDULER__=original;});
  await play(page);
  await page.evaluate(()=>{window.__NESI_DEMO_GAME__.renderer.setAnimationLoop=window.__PLAYER_ACCESS_SCHEDULER__;delete window.__PLAYER_ACCESS_SCHEDULER__;});
  const before=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return{index:g.levelIndex,state:g.state,steps:g.physics.world.stepnumber,elapsed:g.elapsed,cargoUUID:g.cargo.group.uuid,bodyId:g.physics.cargoBody.id,shapeId:g.physics.cargoBody.shapes[0].id,completed:[...window.__NESI_PREFS__.value.completed]};});
  assert.equal(before.index,0);assert.equal(before.steps,0);assert.equal(before.elapsed,0);assert.deepEqual(before.completed,[]);
  const driver=await page.evaluate(async()=>window.__NESI_RUN_LEVEL_ROUTE__({nativeStart:true}));
  const after=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return{index:g.levelIndex,state:g.state,productionWon:g.firstLevel.isWon(),steps:g.physics.world.stepnumber,cargoUUID:g.cargo.group.uuid,bodyId:g.physics.cargoBody.id,shapeId:g.physics.cargoBody.shapes[0].id,completed:[...window.__NESI_PREFS__.value.completed]};});
  assert.equal(driver.pass,true);assert.equal(driver.resets,0);assert.equal(driver.respawns,0);assert.equal(after.state,'won');assert.equal(after.productionWon,true);assert.ok(after.steps>0);
  for(const key of['cargoUUID','bodyId','shapeId'])assert.equal(after[key],before[key]);assert.deepEqual(after.completed,[0]);
  report.firstRoomWin={fixture:false,schedulerOnly:'Ordinary Play at step zero, then actual compiled nativeStart route; no actor/goal/completion assignments',before,driver,after};await snap(page,'first-room-real-win.png');
  await activate(page,'#play-again-button');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
  report.next={observation:await observe(page)};assert.equal(report.next.observation.index,1);assert.deepEqual(report.next.observation.completed,[0]);assertCampaignBrowserState(report.next.observation.runtime,2);

  stage='escape-compact-pause';await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.physics.world.stepnumber>0);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');
  await page.waitForFunction(()=>document.activeElement?.id==='resume-button');
  report.pause=await page.evaluate(()=>{const r=document.querySelector('#pause-screen .pause-card').getBoundingClientRect(),hint=document.querySelector('#hint-button');return{state:document.documentElement.dataset.runtimeState,settingsSelectCount:document.querySelectorAll('#settings-level-select').length,levelMenuButtonCount:document.querySelectorAll('#level-menu-button').length,settingsOpen:document.querySelector('#pause-settings').open,hintVisible:!hint.hidden&&getComputedStyle(hint).visibility!=='hidden',focusId:document.activeElement.id,rect:{width:r.width,height:r.height},viewport:{width:innerWidth,height:innerHeight}};});
  assertCompactPause(report.pause);await snap(page,'compact-escape-pause.png');
  await page.keyboard.press('Tab');report.pause.nextFocusId=await page.evaluate(()=>document.activeElement.id);assert.equal(report.pause.nextFocusId,'restart-button');
  await activate(page,'#hint-button');report.pause.hint=await page.evaluate(()=>({open:!document.querySelector('#hint-detail').hidden,buttonVisible:!document.querySelector('#hint-unlock').hidden,text:document.querySelector('#ad-status').textContent}));
  assert.equal(report.pause.hint.open,true);assert.equal(report.pause.hint.buttonVisible,true);
  const identity=()=>page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return{index:g.levelIndex,state:g.state,steps:g.physics.world.stepnumber,cargoUUID:g.cargo.group.uuid,bodyId:g.physics.cargoBody.id,shapeId:g.physics.cargoBody.shapes[0].id};});
  const atlasBefore=await identity();await activate(page,'#level-menu-button');await waitForStartMenu(page);report.afterNextAtlas=await atlas(page,[0]);
  const inAtlas=await identity();assert.equal(inAtlas.state,'ready');for(const key of['index','steps','cargoUUID','bodyId','shapeId'])assert.equal(inAtlas[key],atlasBefore[key]);
  const assertContinued=(value,previous)=>{assert.equal(value.state,'playing');for(const key of['index','cargoUUID','bodyId','shapeId'])assert.equal(value[key],previous[key]);assert.ok(value.steps>previous.steps,'Returning from the Atlas did not continue the physics clock');};
  await activate(page,'#campaign-back-button');await page.waitForFunction(previous=>document.documentElement.dataset.runtimeState==='playing'&&window.__NESI_DEMO_GAME__.physics.world.stepnumber>previous,{},atlasBefore.steps);const viaBack=await identity();assertContinued(viaBack,atlasBefore);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');const secondBefore=await identity();
  await activate(page,'#level-menu-button');await waitForStartMenu(page);const secondInAtlas=await identity();
  for(const key of['index','steps','cargoUUID','bodyId','shapeId'])assert.equal(secondInAtlas[key],secondBefore[key]);
  await page.keyboard.press('Escape');await page.waitForFunction(previous=>document.documentElement.dataset.runtimeState==='playing'&&window.__NESI_DEMO_GAME__.physics.world.stepnumber>previous,{},secondBefore.steps);
  const viaEscape=await identity();assertContinued(viaEscape,secondBefore);report.atlasReturn={before:atlasBefore,inAtlas,viaBack,secondBefore,secondInAtlas,viaEscape,sameLevelAndActors:true,frozenPhysicsWhileAtlasOpen:true,continuingPhysicsAfterReturn:true};
  assert.equal((await observe(page)).index,1);

  stage='reload-and-completed-replay';await page.reload({waitUntil:'domcontentloaded'});await waitForStartMenu(page);
  report.reloaded={observation:await observe(page),atlas:await atlas(page,[0])};assert.equal(report.reloaded.observation.index,1);assert.deepEqual(report.reloaded.observation.completed,[0]);assertCampaignBrowserState(report.reloaded.observation.runtime,2);
  await activate(page,'.sector-tabs button[data-sector="0"]');await activate(page,'.room-node[data-room-index="0"]');await play(page);
  report.replay=await observe(page);assert.equal(report.replay.index,0);assert.deepEqual(report.replay.completed,[0]);assertCampaignBrowserState(report.replay.runtime,1);await close(session);

  stage='explicit-accepted-v62-migration-fixture';
  const historicalKey=CAMPAIGN_V62_STORAGE_PREFIX+CAMPAIGN_PREFERENCE_KEY,historicalRaw=JSON.stringify(v61HistoricalPreferenceFixture(V62_IMPORTED_PREFERENCES),null,2);
  assert.notEqual(historicalKey,ownKey,'Migration must import the prior release into the new candidate');
  report.migrationFixture={label:'Explicit accepted-v62 historical migration fixture; not fresh-guest playthrough evidence',key:historicalKey,bytes:Buffer.byteLength(historicalRaw),sha256:sha256(historicalRaw),completed:[...V62_IMPORTED_PREFERENCES.completed],targetIndex:2,targetCompleted:false};
  session=await open({historical:{key:historicalKey,raw:historicalRaw}});page=session.page;
  const migration=async phase=>{const value=await page.evaluate(({ownKey,historicalKey})=>({selectedIndex:Number(document.querySelector('#level-select').value),runtimePreferences:{...window.__NESI_PREFS__.value},ownRaw:localStorage.getItem(ownKey),writes:window.__PLAYER_ACCESS_STORAGE_WRITES__.slice(),historicalRaw:localStorage.getItem(historicalKey)}),{ownKey,historicalKey});assertMigrationPhase(value,{phase,ownKey,historicalRaw});report.migration.push({phase,...value});return value;};
  await migration('initial');report.migratedAtlas=await atlas(page,[...V62_IMPORTED_PREFERENCES.completed]);assertCampaignBrowserState((await observe(page)).runtime,3);
  await activate(page,'#menu-settings-button');await page.waitForFunction(()=>document.querySelector('#menu-settings').open);
  await page.$eval('#menu-volume',input=>{input.value='37';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await activate(page,'#menu-tutorial');await activate(page,'#menu-settings-done');await migration('settings');
  await play(page);await migration('playing');assertCampaignBrowserState((await observe(page)).runtime,3);
  await page.reload({waitUntil:'domcontentloaded'});await waitForStartMenu(page);await migration('reloaded');await close(session);

  stage='current-hints-metadata';report.hintCatalogue=FOUNDATION_SEQUENCE.map(index=>{const room=campaignSpec({chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS},index);assert.equal(room.hints.length,3);assert.equal(new Set(room.hints).size,3);assert.ok(room.hints.every(text=>typeof text==='string'&&text.trim().length>10));return{index,number:foundationDisplayNumber(index),id:room.id,tiers:room.hints.length,textSha256:sha256(JSON.stringify(room.hints))};});
  assert.equal(report.hintCatalogue.length,51);report.hintCatalogueScope='All current canonical room metadata has three tiers; actual paused hint entry was exercised above. Reward callback behavior and original checker observations belong to the separate TEST Yandex proof.';

  stage='actual-phone-html-controls';
  for(const viewport of[{width:390,height:844},{width:844,height:390}]){
   session=await open({debug:false,touch:true,viewport});page=session.page;await play(page,true);
   const value=await page.evaluate(()=>{
    const selectors=[['joystick','#joystick'],['sprint','#sprint-button'],['jump','#jump-button'],['portal-blue','.lab-mobile button:nth-child(1)'],['portal-orange','.lab-mobile button:nth-child(2)'],['interact','.lab-mobile button:nth-child(3)'],['pause','.lab-mobile button:nth-child(4)']];
    const controls=selectors.map(([name,selector])=>{const e=document.querySelector(selector),r=e.getBoundingClientRect(),s=getComputedStyle(e);return{name,selector,ariaLabel:e.getAttribute('aria-label'),x:r.x,y:r.y,width:r.width,height:r.height,visible:s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0&&!e.closest('[inert]'),hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
    const canvas=document.querySelector('#game canvas').getBoundingClientRect();return{state:document.documentElement.dataset.runtimeState,viewport:{width:innerWidth,height:innerHeight},touchPoints:navigator.maxTouchPoints,coarsePointer:matchMedia('(pointer: coarse)').matches,controls,canvas:{width:canvas.width,height:canvas.height},horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   assertMobileControls(value);assert.equal(value.horizontalOverflow,false);assert.ok(value.controls.every(control=>control.hit),'Phone HTML controls must be hit-testable');
   const screenshot=await snap(page,viewport.width<viewport.height?'mobile-controls-portrait.png':'mobile-controls-landscape.png');assert.equal(screenshot.width,viewport.width);assert.equal(screenshot.height,viewport.height);
   report.mobile.push({...value,screenshot:screenshot.path,debugBridge:await page.evaluate(()=>typeof window.__NESI_DEMO_GAME__)});await close(session);
  }
  stage='final-binding';assert.deepEqual(report.errors,[]);assert.equal(git(root,['rev-parse','HEAD']),binding.source.commit);assert.equal(git(root,['status','--porcelain','--untracked-files=no']),'');
  report.pass=true;report.stage='complete';save();
  const reportBytes=fs.readFileSync(path.join(out,'report.json'));binding.evidence={report:{path:'report.json',bytes:reportBytes.length,sha256:sha256(reportBytes)},screenshots:report.screenshots};write('binding.json',binding);
  const inventory=fs.readdirSync(out).sort().map(filename=>{const bytes=fs.readFileSync(path.join(out,filename));return{path:filename,bytes:bytes.length,sha256:sha256(bytes)};});
  write('closed-file-inventory.json',{kind:'closed-player-access-artifacts',...openScopes,sourceCommit:binding.source.commit,sourceTree:binding.source.tree,runId:binding.runId,runAttempt:binding.runAttempt,files:inventory,inventoryExcludesItself:true});
  console.log(JSON.stringify({pass:true,out,sourceCommit:binding.source.commit,packageFilesSha256:binding.package.packageFilesSha256,screenshots:report.screenshots.map(row=>row.path)}));return report;
 }catch(error){report.pass=false;report.stage=stage;report.failure=String(error.stack||error);if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});save();throw error;}
 finally{await browser?.close();if(mounted)await new Promise(resolve=>mounted.server.close(resolve));}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await runPlayerAccessBrowserQA();
