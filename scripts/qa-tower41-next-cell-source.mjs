/** Read-only source/package/evidence receipts for the isolated next-cell CI.
 * This verifier never publishes, rewrites build metadata or declares the
 * requested replacement 500-stage tower complete. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildSourceInputs,walkFiles} from './lib/release-manifest.mjs';
import {assertPendulumPhysicalProof} from './lib/tower41-pendulum-proof.mjs';
import {assertUpgradeEvidence} from './lib/singularity-upgrade-proof.mjs';
import {checkBuild,sourceIdentity,assertObservedRoute,oldSavePrefixes,qualificationKey} from './qa-tower41-ratchet-browser.mjs';
import {CAMPAIGN_ASSET_IDS} from '../src/game/labAssets.js';
import {TOWER41_PREVIEW_STORAGE_PREFIX,TOWER41_PREVIEW_LEGACY_STORAGE_PREFIXES,isTower41NativePreviewPath} from '../src/game/LabTower41Preview.js';
import {readPhysicalReviewEntry} from '../src/game/LabPhysicalReviewEntry.js';

export const PINS=Object.freeze({branch:'upgrade/foundation20-physical-20261013-r4',sourceParent:'5e552e9c3ac248b535d619741f15e99e29979cbf',main:'a74b64fe6d861baa94bbba7c6311794e6d520534',legacyPreviewSource:'58a71ddfc9bf704bef4c97fe13d16401c5a5f9f2',previousPreviewSource:'5e552e9c3ac248b535d619741f15e99e29979cbf',acceptedSource:'0e257837ca157d59d29c2e892e9a81e4f21fc5a1',canonicalSource:'8d2c01eacd86fe9235a35e7ec5f624ba62c3b29e',repository:'amazin20/brainrot-portal',publicBase:'https://amazin20.github.io/brainrot-portal/'});
export const SOURCE_REVIEW_JOBS=Object.freeze(['build','cpu','native-contact','native-castle','native-foundation20','review-summary']);
export const SOURCE_REVIEW_REQUIRED_JOBS=Object.freeze(SOURCE_REVIEW_JOBS.filter(job=>job!=='review-summary'));
export const SOURCE_REVIEW_ARTIFACT_KINDS=Object.freeze(['build','source','cpu','native-contact','native-castle','native-foundation20','summary']);
export const SOURCE_REVIEW_VERIFIERS=Object.freeze(['.github/workflows/tower41-next-cell-review.yml','scripts/qa-tower41-next-cell-source.mjs','scripts/qa-tower41-ratchet-browser.mjs','scripts/record-tower41-ratchet-walkthrough.mjs','scripts/singularity-browser.mjs','scripts/singularity-adversarial-audit.mjs','scripts/lib/singularity-upgrade-proof.mjs','scripts/lib/tower41-pendulum-proof.mjs','scripts/qa-foundation20-native.mjs','scripts/lib/foundation20-native-proof.mjs','scripts/lib/native-portal-material-identity.mjs','scripts/lib/tower41-native-camera-observer.mjs','scripts/lib/release-manifest.mjs','scripts/lib/singularity-ui-check.mjs','scripts/stamp-build.mjs','src/game/LabPhysicalReviewEntry.js','src/game/LabSingularityJourney.js','scripts/test-active-game.mjs']);
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const sourceFile='qa/tower41-next-cell-build/source.json',packageFile='qa/tower41-next-cell-build/package.json';
function snapshot(){
 const identity=sourceIdentity();assert.equal(git('rev-parse','HEAD'),identity.sourceCommit,'Exact current checkout required');
 assert.equal(git('rev-parse','HEAD^'),PINS.sourceParent,'The preview source must directly descend from the frozen physical-cell source');
 assert.equal(git('status','--porcelain','--untracked-files=no'),'','Committed source must remain unchanged');
 if(process.env.GITHUB_REF)assert.equal(process.env.GITHUB_REF,'refs/heads/'+PINS.branch,'Only the isolated review branch is permitted');
 const inputs=buildSourceInputs(),verifiers=SOURCE_REVIEW_VERIFIERS.map(file=>({file,sha256:sha256(fs.readFileSync(file))}));
 return {...identity,tree:git('rev-parse','HEAD^{tree}'),sourceInputsSha256:sha256(JSON.stringify(inputs)),sourceInputFiles:inputs.length,verifiers,reviewContract:{jobs:[...SOURCE_REVIEW_JOBS],artifactKinds:[...SOURCE_REVIEW_ARTIFACT_KINDS]}};
}
function verifySource(){const actual=snapshot(),frozen=read(sourceFile);for(const key of ['sourceCommit','sourceReview','tree','sourceInputsSha256','sourceInputFiles','verifiers','reviewContract'])assert.deepEqual(actual[key],frozen[key],'Frozen source mismatch: '+key);return frozen;}
export async function get(url,{github=false,fetcher=globalThis.fetch,wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds)),now=Date.now,logRetry=receipt=>console.warn('TOWER41_READ_ONLY_RETRY',JSON.stringify(receipt))}={}){
 const headers={Accept:'application/vnd.github+json','User-Agent':'tower41-next-cell-read-only-review'};
 if(github&&process.env.GITHUB_TOKEN)headers.Authorization='Bearer '+process.env.GITHUB_TOKEN;
 const transientStatus=new Set([408,429,500,502,503,504]),transientCode=new Set(['ECONNRESET','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET']);
 const address=new URL(url),retry=async(attempt,status,response=null)=>{
  let delayMs=1000*2**(attempt-1);const raw=response?.headers?.get('retry-after');
  if(typeof raw==='string'&&raw.trim()){
   const text=raw.trim(),milliseconds=/^\d+$/.test(text)?Number(text)*1000:Date.parse(text)-now();
   if(Number.isFinite(milliseconds))delayMs=Math.max(delayMs,Math.min(5000,Math.max(0,milliseconds)));
  }
  logRetry({url:address.origin+address.pathname,status,attempt,nextAttempt:attempt+1,maximumAttempts:4,delayMs});await wait(delayMs);
 };
 for(let attempt=1;attempt<=4;attempt++){
  let response,bytes;
  try{
   response=await fetcher(url,{method:'GET',headers,cache:'no-store',signal:AbortSignal.timeout(30000)});
   if(response.ok)bytes=Buffer.from(await response.arrayBuffer());
  }catch(error){
   const code=error?.code||error?.cause?.code,transient=error?.name==='TimeoutError'||error?.cause?.name==='TimeoutError'||transientCode.has(code);
   if(!transient||attempt===4)throw error;
   await retry(attempt,transientCode.has(code)?code:'TimeoutError');continue;
  }
  if(!response.ok&&transientStatus.has(response.status)&&attempt<4){
   try{await response.body?.cancel();}catch{}
   await retry(attempt,response.status,response);continue;
  }
  assert.ok(response.ok,'Read-only baseline request failed: '+response.status+' '+address.pathname);
  // Parsing and all downstream pinned identity gates stay outside retry logic.
  return {data:JSON.parse(bytes),bytes:bytes.length,sha256:sha256(bytes)};
 }
}
async function guard(){
 const identity=sourceIdentity(),query='?tower41review='+identity.sourceReview.runId+'-'+identity.sourceReview.runAttempt+'-'+Date.now();
 const [main,head,accepted,canonical,legacyPreview,previousPreview]=await Promise.all([
  get('https://api.github.com/repos/'+PINS.repository+'/git/ref/heads/main',{github:true}),
  get('https://api.github.com/repos/'+PINS.repository+'/git/ref/heads/'+PINS.branch,{github:true}),
  get(PINS.publicBase+'puzzle-progression-finale/build-info.json'+query),get(PINS.publicBase+'build-info.json'+query),get(PINS.publicBase+'tower41-native/build-info.json'+query),get(PINS.publicBase+'tower41-native-v2/build-info.json'+query)]);
 assert.equal(main.data.object.sha,PINS.main,'Main changed during this isolated review');assert.equal(head.data.object.sha,identity.sourceCommit,'The isolated review branch advanced');
 assert.equal(accepted.data.commit,PINS.acceptedSource,'Accepted isolated namespace changed');assert.equal(canonical.data.commit,PINS.canonicalSource,'Accepted canonical campaign changed');assert.equal(legacyPreview.data.commit,PINS.legacyPreviewSource,'The accepted previous native preview changed');assert.equal(previousPreview.data.commit,PINS.previousPreviewSource,'The accepted pendulum native preview changed');
 return {pass:true,...identity,main:PINS.main,acceptedSource:PINS.acceptedSource,canonicalSource:PINS.canonicalSource,acceptedMetadata:{bytes:accepted.bytes,sha256:accepted.sha256},canonicalMetadata:{bytes:canonical.bytes,sha256:canonical.sha256},legacyPreviewSource:PINS.legacyPreviewSource,legacyPreviewMetadata:{bytes:legacyPreview.bytes,sha256:legacyPreview.sha256},previousPreviewSource:PINS.previousPreviewSource,previousPreviewMetadata:{bytes:previousPreview.bytes,sha256:previousPreview.sha256},checkedAt:new Date().toISOString(),scope:'Read-only main ref and the four explicitly pinned public metadata files; no whole-site byte claim.',publicationAccepted:false};
}
export function verifyRuntimeModels({sourceBytes,productionBytes,readOriginal,readProduction,pinnedSourceBytes=null,readPinnedOriginal=null}){
 const source=JSON.parse(sourceBytes),production=JSON.parse(productionBytes);
 assert.equal(Boolean(pinnedSourceBytes),Boolean(readPinnedOriginal),'Pinned catalogue and pinned GLB bytes must be provided together');
 if(pinnedSourceBytes)assert.equal(sha256(sourceBytes),sha256(pinnedSourceBytes),'Original source runtime catalogue must match the pinned accepted parent bytes');
 assert.equal(production.models.length,14);assert.equal(new Set(source.models.map(model=>model.id)).size,source.models.length,'Original catalogue IDs must be unique');
 assert.equal(new Set(production.models.map(model=>model.id)).size,14,'Production model IDs must be unique');
 assert.deepEqual(production.models.map(model=>model.id).sort((a,b)=>a-b),[...CAMPAIGN_ASSET_IDS].sort((a,b)=>a-b),'All original campaign model IDs required');
 const records=production.models.map(model=>{
  const original=source.models.find(row=>row.id===model.id);assert.ok(original,'Production model missing from original catalogue: '+model.id);
  const canonical=({id,filename,outputSHA256,outputBytes})=>({id,filename,outputSHA256,outputBytes});
  assert.deepEqual(canonical(model),canonical(original),'Production manifest replaced an original model record: '+model.id);
  assert.match(model.filename,/^[A-Za-z0-9_-]+\.glb$/,'Model filename must stay inside runtime directory');
  const originalFile=readOriginal(model.filename),productionFile=readProduction(model.filename);
  for(const bytes of [originalFile,productionFile,...(readPinnedOriginal?[readPinnedOriginal(model.filename)]:[])]){assert.equal(bytes.length,original.outputBytes);assert.equal(sha256(bytes),original.outputSHA256,'Original runtime model bytes required: '+model.id);}
  return canonical(original);
 }).sort((a,b)=>a.id-b.id);
 return {sourceManifestSha256:sha256(sourceBytes),productionManifestSha256:sha256(productionBytes),canonicalRecordsSha256:sha256(JSON.stringify(records)),canonicalRecords:records};
}
function packageReceipt(){
 const source=verifySource(),{info,nativePackage}=checkBuild();assert.equal(info.version,'v54-unified-campaign');assert.equal(info.levels,51);assert.equal(info.verified,false);
 const files=walkFiles('dist'),totalBytes=files.reduce((n,file)=>n+fs.statSync(file).size,0);assert.ok(totalBytes>0&&totalBytes<=100_000_000,'The complete production package must be <=100 MB');
 const runtimeModels=verifyRuntimeModels({sourceBytes:fs.readFileSync('public/models/runtime/manifest.json'),productionBytes:fs.readFileSync('dist/models/runtime/manifest.json'),readOriginal:filename=>fs.readFileSync(path.join('public/models/runtime',filename)),readProduction:filename=>fs.readFileSync(path.join('dist/models/runtime',filename)),pinnedSourceBytes:execFileSync('git',['show',PINS.sourceParent+':public/models/runtime/manifest.json']),readPinnedOriginal:filename=>execFileSync('git',['show',PINS.sourceParent+':public/models/runtime/'+filename],{maxBuffer:20_000_000})});
 runtimeModels.pinnedOriginals={sourceCommit:PINS.sourceParent,manifestSha256:runtimeModels.sourceManifestSha256,modelCount:runtimeModels.canonicalRecords.length};
 return {pass:true,sourceCommit:source.sourceCommit,sourceReview:source.sourceReview,tree:source.tree,sourceInputsSha256:source.sourceInputsSha256,version:info.version,totalBytes,buildInfoSha256:sha256(fs.readFileSync('dist/build-info.json')),runtimeModels,nativePackage,fullTowerAccepted:false,publicationAccepted:false};
}
function verifyPackage(){const actual=packageReceipt(),frozen=read(packageFile);assert.deepEqual(actual,frozen,'One exact build artifact must serve every independent review job');return actual;}
export function parseTap(log){
 const field=name=>{const rows=[...log.matchAll(new RegExp('^# '+name+' (\\d+)\\r?$','gm'))];assert.equal(rows.length,1,'One actual final TAP '+name+' footer required');return Number(rows[0][1]);};
 const actual=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(name=>[name,field(name)]));
 assert.ok(Number.isSafeInteger(actual.tests)&&actual.tests>0);assert.equal(actual.tests,actual.pass,'Every actual registered test must pass');
 for(const name of ['fail','cancelled','skipped','todo'])assert.equal(actual[name],0,'No '+name+' regressions accepted');return actual;
}
export function assertRequiredReviewJobs(jobs){
 assert.ok(jobs&&typeof jobs==='object'&&!Array.isArray(jobs),'Actual required review job results must be an object');
 assert.deepEqual(Object.keys(jobs).sort(),[...SOURCE_REVIEW_REQUIRED_JOBS].sort(),'Every exact required source review job must be present without substitutions');
 assert.ok(Object.values(jobs).every(result=>result==='success'),'Review remains incomplete until every independent required job succeeds');
 return jobs;
}
export function assertFoundation20CaptureTelemetry(bytes,proof){
 const text=bytes.toString('utf8');assert.ok(text.endsWith('\n'),'Complete native telemetry must terminate its final captured row');
 const rows=text.slice(0,-1).split('\n').map(line=>{assert.ok(line.length>0,'No blank or omitted native telemetry row');return JSON.parse(line);});
 assert.equal(rows.length,proof.video.frames);assert.equal(proof.telemetry.samples,rows.length);assert.equal(proof.video.stride,60/proof.video.fps);
 const lastFrame=proof.route.frames-1,terminal=lastFrame%proof.video.stride!==0;assert.equal(proof.video.terminalSample,terminal);assert.equal(proof.video.lastVisualFrame,lastFrame);
 assert.equal(rows.length,Math.floor(lastFrame/proof.video.stride)+1+(terminal?1:0));
 let worldStepOffset=null;
 for(const [index,row]of rows.entries()){
  const final=terminal&&index===rows.length-1;assert.equal(row.index,index);assert.equal(row.terminal,final);assert.equal(row.state.visualFrame,final?lastFrame:index*proof.video.stride);
  assert.equal(row.state.cargoBodyId,proof.route.cargoBodyId);assert.equal(row.state.cargoMass,3.2);assert.equal(row.state.cargoDynamic,true);assert.equal(row.state.edition,'foundation');assert.equal(row.state.level,20);assert.equal(row.state.id,'foundation-portal-tension');
  assert.ok(Number.isFinite(row.state.seconds)&&row.state.seconds>0);const steps=Math.round(row.state.seconds*120);assert.ok(Math.abs(steps-row.state.seconds*120)<1e-7);assert.equal(steps,index===rows.length-1?proof.route.physicsSteps:2*(row.state.visualFrame+1));
  assert.ok(Number.isSafeInteger(row.state.worldStep)&&row.state.worldStep>=steps);const offset=row.state.worldStep-steps;worldStepOffset??=offset;assert.equal(offset,worldStepOffset,'Every captured row must preserve the actual world/route clock offset');
 }
 assert.deepEqual(rows[0].state,proof.video.first);assert.deepEqual(rows.at(-1).state,proof.video.last);assert.equal(rows.at(-1).state.state,'won');assert.equal(rows.at(-1).state.seconds,proof.route.seconds);return {samples:rows.length,lastVisualFrame:lastFrame,terminalSample:terminal,worldStepOffset};
}
function exactDirectoryInventory(directory){return walkFiles(directory).map(file=>({path:path.relative(directory,file).split(path.sep).join('/'),bytes:fs.statSync(file).size,sha256:sha256(fs.readFileSync(file))}));}
export function assertServedPackageProof(proof,{sourceCommit,sourceReview,files}){
 assert.equal(proof?.pass,true);assert.equal(proof.sourceCommit,sourceCommit);assert.deepEqual(proof.sourceReview,sourceReview);
 assert.deepEqual(proof.files,files,'Every served production byte must equal the reviewed package');return proof;
}
function servedPackage(directory,output){
 const frozen=verifyPackage(),files=exactDirectoryInventory('dist'),served=exactDirectoryInventory(directory);
 assert.deepEqual(served,files,'The namespace server must serve every exact reviewed production byte');
 const proof={pass:true,...sourceIdentity(),files:served,scope:'An exact copy of the one reviewed production package served under the declared ordinary native namespace.'};
 write(output,proof);return proof;
}
function cpu(logfile){
 const packageProof=verifyPackage(),bytes=fs.readFileSync(logfile),actual=parseTap(bytes.toString('utf8'));
 const receipt={pass:true,...sourceIdentity(),packageFilesSha256:packageProof.nativePackage.packageFilesSha256,actual,log:{file:path.basename(logfile),bytes:bytes.length,sha256:sha256(bytes)},scope:'Full npm test actual final TAP totals, with no stale fixed registration count.',fullTowerAccepted:false,publicationAccepted:false};
 write('qa/tower41-next-cell-cpu/report.json',receipt);console.log('TOWER41_NEXT_CPU',JSON.stringify(receipt));
}
function contact(){
 const frozen=verifyPackage(),native=read('qa/tower41-next-cell-contact/report.json'),movie=read('qa/tower41-next-cell-contact-movie/tower41-ratchet-qualification.json');
 for(const proof of [native,movie]){assert.equal(proof.pass,true);assert.equal(proof.sourceCommit,frozen.sourceCommit);assert.deepEqual(proof.sourceReview,frozen.sourceReview);assert.deepEqual(proof.nativePackage,frozen.nativePackage);assertObservedRoute(proof.observed,'qualification');assert.deepEqual(proof.errors,[]);assert.equal(proof.publicationAccepted,false);}
 for(const proof of [native,movie])assert.equal(proof.observed.cameraReview.outsideSamples.length,0,'Every measured bounded native sample must frame all live original-player vertices');
 assert.equal(movie.video.fps,4);assert.equal(movie.video.width,640);assert.equal(movie.video.height,360);assert.equal(movie.video.pixelCheck.fullMP4Decode,true);
 const moviePath=path.join('qa/tower41-next-cell-contact-movie',movie.video.filename),bytes=fs.readFileSync(moviePath);assert.equal(sha256(bytes),movie.video.sha256);assert.equal(bytes.length,movie.video.bytes);
 write('qa/tower41-next-cell-contact/binding.json',{pass:true,...sourceIdentity(),packageFilesSha256:frozen.nativePackage.packageFilesSha256,nativeReportSha256:sha256(fs.readFileSync('qa/tower41-next-cell-contact/report.json')),recordingReportSha256:sha256(fs.readFileSync('qa/tower41-next-cell-contact-movie/tower41-ratchet-qualification.json')),videoSha256:movie.video.sha256,allBoundedNativeSamplesInLens:true,fullCameraAccepted:false,fullTowerAccepted:false,publicationAccepted:false});
 console.log('TOWER41_NEXT_CONTACT PASS',frozen.sourceCommit);
}
export function assertPreviewSaveIsolation(isolation){
 const playerURL=new URL(isolation?.playerURL),reviewURL=new URL(isolation?.reviewURL),physicalEntry=readPhysicalReviewEntry(playerURL.pathname);
 assert.ok(!physicalEntry||physicalEntry.tower,'A castle save proof cannot substitute the Foundation20 entry');
 const namespace=physicalEntry?.storagePrefix||TOWER41_PREVIEW_STORAGE_PREFIX;
 const key='brainrot-portal.preferences.v24',prefixes=[...oldSavePrefixes,qualificationKey.slice(0,-key.length),...TOWER41_PREVIEW_LEGACY_STORAGE_PREFIXES,...(physicalEntry?.tower?[TOWER41_PREVIEW_STORAGE_PREFIX,'brainrot-foundation20-physical-v1:']:[])],phases=['after-load','after-settings','after-play','after-pause','after-resume','after-win','after-replay','after-reload'];
 assert.equal(isolation?.pass,true,'The current whole-castle proof must include successful preview save isolation');assert.equal(isolation.namespace,namespace);assert.equal(isolation.ownKey,namespace+key);assert.deepEqual(isolation.legacyPrefixes,prefixes);
 const baseline=isolation.legacySnapshot;assert.ok(baseline&&typeof baseline==='object');for(const prefix of prefixes)assert.equal(typeof baseline[prefix+key],'string');
 assert.ok(Object.keys(baseline).every(name=>prefixes.some(prefix=>name.startsWith(prefix))));const baselineHash=sha256(JSON.stringify(baseline));
 assert.ok(['http:','https:'].includes(playerURL.protocol));assert.equal(reviewURL.origin,playerURL.origin);assert.equal(reviewURL.pathname,playerURL.pathname);
 for(const [name,value]of [['edition','foundation'],['level','41'],['tower41preview','1']]){assert.equal(playerURL.searchParams.get(name),value);assert.equal(reviewURL.searchParams.get(name),value);}
 for(const name of ['debug','smoke','tower41ratchet','pilot'])assert.equal(playerURL.searchParams.has(name),false);assert.equal(reviewURL.searchParams.get('debug'),'1');
 const bare=isolation.bareEntry;
 if(!isTower41NativePreviewPath(playerURL.pathname)&&!physicalEntry?.tower)assert.deepEqual(bare,{applicable:false,reason:'The configured browser review base is outside the standalone tower41-native entry namespace.'},'A local-root review cannot invent a public bare-entry observation');
 else{
  assert.equal(bare?.applicable,true,'A native namespace review requires its actual bare-entry observation');assert.equal(bare.pass,true);
  const bareURL=new URL(bare.url);assert.equal(bareURL.origin,playerURL.origin);assert.equal(bareURL.pathname,playerURL.pathname);assert.equal(bareURL.search,'');assert.equal(bareURL.hash,'');assert.equal(bare.pathname,bareURL.pathname);assert.equal(bare.search,'');
  assert.equal(bare.state,'ready');assert.equal(bare.level,41);assert.equal(bare.preview,true);assert.equal(bare.edition,'foundation');assert.deepEqual(bare.startChoices,[40]);assert.deepEqual(bare.settingsChoices,[40]);assert.equal(bare.editionNavigationPresent,false);assert.deepEqual(bare.editionNavigationAnchors,[]);
  for(const name of ['debugGameHook','debugPreferencesHook','ratchetHook'])assert.equal(bare[name],'undefined');assert.equal(bare.oldBytesUnchanged,true);assert.equal(bare.legacySnapshotSha256,baselineHash);assert.equal(bare.ownKey,namespace+key);assert.match(bare.ownPreferencesSha256,/^[a-f0-9]{64}$/);
  const settings=bare.settings;assert.equal(settings.control,'native-menu-quality-select');assert.notEqual(settings.changedTo,settings.restoredTo);assert.equal(settings.ownQualityChanged,settings.changedTo);assert.equal(settings.ownQualityRestored,settings.restoredTo);
  for(const name of ['beforeSha256','changedSha256','restoredSha256'])assert.match(settings[name],/^[a-f0-9]{64}$/);assert.notEqual(settings.beforeSha256,settings.changedSha256);assert.equal(settings.beforeSha256,settings.restoredSha256);assert.equal(bare.ownPreferencesSha256,settings.restoredSha256);
 }
 assert.deepEqual(isolation.phases.map(observed=>observed.phase),phases,'Every load/settings/control/completion/replay/reload transition must preserve legacy bytes');
 const states=['ready','ready','playing','paused','playing','won','playing','ready'];
 for(const [i,observed]of isolation.phases.entries()){
  assert.equal(observed.state,states[i]);assert.equal(observed.level,41);assert.equal(observed.preview,true);assert.equal(observed.ratchetCell,false);assert.deepEqual(observed.startChoices,[40]);assert.deepEqual(observed.settingsChoices,[40]);
  assert.equal(observed.editionNavigationPresent,false,'Every measured preview phase must omit old edition navigation');assert.deepEqual(observed.editionNavigationAnchors,[]);
  assert.equal(observed.oldBytesUnchanged,true);assert.equal(observed.legacySnapshotSha256,baselineHash);assert.equal(observed.namespaceUsed,true);assert.match(observed.ownPreferencesSha256,/^[a-f0-9]{64}$/);assert.equal(observed.ownResumeLevel,40);
  assert.deepEqual(observed.ownCompleted,i<5?[]:[40]);
 }
 const controls=isolation.controls;assert.equal(controls.settings.control,'native-menu-quality-select');assert.notEqual(controls.settings.changedTo,controls.settings.restoredTo);assert.equal(isolation.phases[1].ownQuality,controls.settings.restoredTo);
 assert.equal(controls.pauseResume.pass,true);assert.equal(controls.pauseResume.pauseControl,'native-escape-or-hud');assert.equal(controls.pauseResume.resumeControl,'focused-native-enter');assert.equal(typeof controls.pauseResume.pointerLockExitFallback,'boolean');assert.equal(controls.pauseResume.pausedState,'paused');assert.equal(controls.pauseResume.resumedState,'playing');
 assert.equal(controls.replay.pass,true);assert.equal(controls.replay.button,'#play-again-button');assert.match(controls.replay.label,/Пройти ещё раз/);assert.equal(controls.replay.level,41);assert.equal(controls.replay.state,'playing');assert.deepEqual(controls.replay.solved,[]);assert.equal(controls.replay.atSpawn,true);
 assert.deepEqual(controls.reload,{pass:true,state:'ready',level:41,completed:[40],resumeLevel:40});
 if(physicalEntry?.tower){
  const peer=isolation.crossEntry;assert.equal(peer?.pass,true);const peerURL=new URL(peer.url);assert.equal(peerURL.origin,playerURL.origin);assert.equal(peerURL.pathname,playerURL.pathname.replace('tower41-native-v3','foundation20-physical-v1'));assert.equal(peerURL.search,'');assert.equal(peerURL.hash,'');assert.equal(peer.pathname,peerURL.pathname);assert.equal(peer.search,'');assert.equal(peer.hash,'');
  assert.equal(peer.entry,'foundation20-physical-v1');assert.equal(peer.level,20);assert.equal(peer.state,'ready');assert.equal(peer.edition,'foundation');assert.deepEqual(peer.startChoices,[19]);assert.deepEqual(peer.settingsChoices,[19]);assert.equal(peer.editionNavigationPresent,false);assert.deepEqual(peer.editionNavigationAnchors,[]);
  for(const key of ['debugGameHook','debugPreferencesHook','debugRouteHook'])assert.equal(peer[key],'undefined');assert.equal(peer.own41BytesUnchanged,true);assert.equal(peer.peerBytesUnchanged,true);assert.equal(peer.reloadVerified,true);assert.match(peer.sourceCommit,/^[a-f0-9]{40}$/);assert.equal(peer.legacySnapshotSha256,baselineHash);assert.equal(peer.own41Sha256,isolation.phases.at(-1).ownPreferencesSha256);
 }
 return isolation;
}
async function castle(){
 const frozen=verifyPackage(),info=read('dist/build-info.json'),proof=read('qa/tower41-next-cell-castle/evidence.json');assertUpgradeEvidence(proof,info,{record:true});
 assertServedPackageProof(read('qa/tower41-next-cell-castle/served-package.json'),{...sourceIdentity(),files:exactDirectoryInventory('dist')});
 assertServedPackageProof(read('qa/tower41-next-cell-castle/peer-served-package.json'),{...sourceIdentity(),files:exactDirectoryInventory('dist')});
 const isolation=assertPreviewSaveIsolation(proof.previewSaveIsolation);
 assert.equal(readPhysicalReviewEntry(new URL(isolation.playerURL).pathname)?.id,'tower41-native-v3','The current whole-castle review must use its actual new standalone entry');assert.equal(isolation.namespace,'brainrot-tower41-native-v3:');assert.equal(isolation.crossEntry.sourceCommit,frozen.sourceCommit);
 const cameraDescriptor=proof.cameraObservation;assert.equal(cameraDescriptor?.file,'camera-observation.json','The complete castle must retain its compact live-skin observation');
 const cameraBytes=fs.readFileSync(path.join('qa/tower41-next-cell-castle',cameraDescriptor.file));assert.ok(cameraBytes.length>0&&cameraBytes.length<=25_000_000);assert.equal(cameraBytes.length,cameraDescriptor.bytes);assert.equal(sha256(cameraBytes),cameraDescriptor.sha256);
 const camera=JSON.parse(cameraBytes),cameraPins={sourceCommit:frozen.sourceCommit,tree:frozen.tree,sourceInputsSha256:frozen.sourceInputsSha256,packageFilesSha256:frozen.nativePackage.packageFilesSha256,sourceReview:frozen.sourceReview,journeySha256:sha256(fs.readFileSync('src/game/LabSingularityJourney.js')),browserSeamSha256:sha256(fs.readFileSync('scripts/singularity-browser.mjs'))};
 assert.deepEqual(camera.sourcePins,cameraPins);assert.deepEqual(camera.sourceIdentity,cameraPins);
 const {assertTower41NativeCameraObservation}=await import('./lib/tower41-native-camera-observer.mjs');
 const cameraSummary=assertTower41NativeCameraObservation(camera,{sourceIdentity:cameraPins,bodyId:proof.observed.bodyId,video:proof.video,result:proof.result});
 assert.deepEqual(cameraDescriptor,{file:'camera-observation.json',bytes:cameraBytes.length,sha256:sha256(cameraBytes),...cameraSummary},'Actual byte-bound camera summary must match every retained optical sample');
 const pendulum=assertPendulumPhysicalProof(proof.observed.events.find(event=>event.id==='pendulum')?.proof,proof.observed.bodyId);
 const flywheel=proof.observed.events.find(event=>event.id==='flywheel')?.proof;
 assert.ok(flywheel,'The completed ordinary route must include the real flywheel proof');
 assert.equal(flywheel.originalCargo,true);assert.equal(flywheel.physicalAngularMomentum,true);
 assert.equal(flywheel.originalCargoBodyId,proof.observed.bodyId,'The clutch must use the same original body as the whole route');
 assert.equal(flywheel.ratio,1);assert.equal(flywheel.ratioValue,2/3);assert.equal(flywheel.clutch,true);assert.equal(flywheel.brake,false);
 assert.equal(flywheel.loadContact,true);assert.ok(flywheel.loadContactCount>0&&flywheel.loadNormalForce>0);
 assert.equal(flywheel.contactStep,flywheel.worldStep,'Proof must observe current actual supporting contact');
 assert.ok(flywheel.output>4.9&&flywheel.output<6.1&&flywheel.stable>=2&&flywheel.energy>0);
 assert.equal(flywheel.readyForProof,true);assert.deepEqual(flywheel.constraintEquationCounts,[5,5,5,1,1]);
 assert.equal(flywheel.rotors.length,3);assert.ok(flywheel.rotors.every(rotor=>rotor.angularVelocity.every(Number.isFinite)&&rotor.inertia[2]>0));
 assert.equal(proof.sourceCommit,frozen.sourceCommit);assert.equal(proof.video.fps,4);assert.equal(proof.video.width,640);assert.equal(proof.video.height,360);assert.deepEqual(proof.capture.nativeCanvas,{width:640,height:360});
 const movie=path.join('qa/tower41-next-cell-castle',proof.video.filename),bytes=fs.readFileSync(movie);assert.equal(sha256(bytes),proof.video.sha256);
 const metadata=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_streams','-show_format','-of','json',movie],{encoding:'utf8',timeout:300000})),stream=metadata.streams.find(s=>s.codec_type==='video');
 assert.equal(stream.codec_name,'h264');assert.equal(stream.width,proof.video.width);assert.equal(stream.height,proof.video.height);assert.equal(Number(stream.nb_frames),proof.video.frames);assert.equal(stream.avg_frame_rate,proof.video.fps+'/1');assert.ok(Math.abs(Number(metadata.format.duration)-proof.video.durationSeconds)<.12);
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-xerror','-i',movie,'-f','null','-'],{timeout:300000,stdio:'inherit'});
 write('qa/tower41-next-cell-castle/binding.json',{pass:true,...sourceIdentity(),packageFilesSha256:frozen.nativePackage.packageFilesSha256,buildInfoSha256:frozen.buildInfoSha256,evidenceSha256:sha256(fs.readFileSync('qa/tower41-next-cell-castle/evidence.json')),mechanisms:11,sameCargo:true,resets:0,pendulum,cameraObservation:cameraDescriptor,previewSaveIsolation:{pass:true,namespace:isolation.namespace,oldBytesUnchanged:true,phases:isolation.phases.length,replayLevel:41,crossEntry:{pass:true,level:20,entry:'foundation20-physical-v1',own41BytesUnchanged:true,peerBytesUnchanged:true,reloadVerified:true}},video:{file:proof.video.filename,bytes:bytes.length,sha256:proof.video.sha256,fullMP4Decode:true},scope:'Complete current ordinary eleven-mechanism castle with separate preview saves; not the requested replacement 500-stage tower.',fullTowerAccepted:false,publicationAccepted:false});console.log('TOWER41_NEXT_CASTLE PASS',frozen.sourceCommit,proof.result.seconds);
}
async function foundation20(){
 const frozen=verifyPackage(),identity=sourceIdentity(),directory='qa/tower41-next-cell-foundation20',reportFile=path.join(directory,'foundation20-native-report.json');
 const proof=read(reportFile),{assertFoundation20NativeReport}=await import('./lib/foundation20-native-proof.mjs');
 assertServedPackageProof(read(path.join(directory,'served-package.json')),{...identity,files:exactDirectoryInventory('dist')});
 assertServedPackageProof(read(path.join(directory,'peer-served-package.json')),{...identity,files:exactDirectoryInventory('dist')});
 assert.equal(proof.video?.filename,'foundation20-physical.mp4');assert.equal(proof.telemetry?.filename,'foundation20-telemetry.jsonl');
 const movie=path.join(directory,proof.video.filename),movieBytes=fs.readFileSync(movie),telemetryBytes=fs.readFileSync(path.join(directory,proof.telemetry.filename));
 assert.equal(movieBytes.length,proof.video.bytes);assert.equal(sha256(movieBytes),proof.video.sha256);
 assert.equal(telemetryBytes.length,proof.telemetry.bytes);assert.equal(sha256(telemetryBytes),proof.telemetry.sha256);
 const telemetryCoverage=assertFoundation20CaptureTelemetry(telemetryBytes,proof);
 const pixel=proof.video.pixelCheck;assert.equal(pixel.logFilename,'foundation20-native-pixels.log');const pixelBytes=fs.readFileSync(path.join(directory,pixel.logFilename));assert.equal(pixelBytes.length,pixel.logBytes);assert.equal(sha256(pixelBytes),pixel.logSha256);
 const pixelText=pixelBytes.toString('utf8'),minima=[...pixelText.matchAll(/lavfi\.signalstats\.YMIN=(\d+)/g)].map(row=>Number(row[1])),maxima=[...pixelText.matchAll(/lavfi\.signalstats\.YMAX=(\d+)/g)].map(row=>Number(row[1]));
 assert.equal(minima.length,proof.video.frames);assert.equal(maxima.length,proof.video.frames);const ranges=maxima.map((value,index)=>value-minima[index]);assert.ok(ranges.every(value=>value>12));assert.equal(Math.min(...ranges),pixel.minimumLuminanceRange);
 const movieMetadata=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_streams','-show_format','-of','json',movie],{encoding:'utf8',timeout:300000}));
 assertFoundation20NativeReport(proof,{sourceCommit:frozen.sourceCommit,sourceReview:frozen.sourceReview,nativePackage:frozen.nativePackage,movieMetadata});
 assert.equal(proof.video.fps,4);assert.equal(proof.video.width,640);assert.equal(proof.video.height,360);
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-xerror','-i',movie,'-f','null','-'],{timeout:300000,stdio:'inherit'});
 const receipt={pass:true,...identity,packageFilesSha256:frozen.nativePackage.packageFilesSha256,buildInfoSha256:frozen.buildInfoSha256,reportSha256:sha256(fs.readFileSync(reportFile)),servedPackageSha256:sha256(fs.readFileSync(path.join(directory,'served-package.json'))),peerServedPackageSha256:sha256(fs.readFileSync(path.join(directory,'peer-served-package.json'))),edition:proof.route.edition,level:proof.route.level,roomId:proof.route.id,sameCargo:true,cargoBodyId:proof.route.cargoBodyId,resets:0,
  telemetry:{file:proof.telemetry.filename,bytes:telemetryBytes.length,sha256:proof.telemetry.sha256,...telemetryCoverage},pixelLog:{file:pixel.logFilename,bytes:pixelBytes.length,sha256:pixel.logSha256,frames:proof.video.frames,allNonblank:true,minimumLuminanceRange:Math.min(...ranges)},
  video:{file:proof.video.filename,bytes:movieBytes.length,sha256:proof.video.sha256,fullMP4Decode:true},
  previewSaveIsolation:{pass:true,namespace:proof.saveIsolation.namespace,oldBytesUnchanged:true,phases:proof.saveIsolation.phases.length,replayLevel:20,crossEntry:{pass:true,level:41,entry:'tower41-native-v3',own20BytesUnchanged:true,peerBytesUnchanged:true,reloadVerified:true}},
  scope:'Complete ordinary Foundation20 physical near-hook, unilateral cable, two-leaf train, far contact retention and original cargo return with separate saves; not a human playtest or a complete 500-stage tower.',fullTowerAccepted:false,publicationAccepted:false};
 write(path.join(directory,'binding.json'),receipt);console.log('TOWER41_NEXT_FOUNDATION20 PASS',frozen.sourceCommit,proof.route.seconds);
}
function status(name,directory,...extraDirectories){
 const state=process.env.REVIEW_JOB_STATUS||'unknown',logs=[directory,...extraDirectories].flatMap(folder=>walkFiles(folder)).filter(file=>file.endsWith('.log')).map(file=>({file:path.relative(directory,file),bytes:fs.statSync(file).size,sha256:sha256(fs.readFileSync(file))}));
 const receipt={job:name,status:state,...sourceIdentity(),logs,fullTowerAccepted:false,publicationAccepted:false};write(path.join(directory,'job-status.json'),receipt);console.log('TOWER41_NEXT_JOB',JSON.stringify({job:name,status:state,...sourceIdentity(),logs:logs.length}));
}
async function main(){
 const [command,...args]=process.argv.slice(2);
 if(command==='freeze'){const source=snapshot(),baseline=await guard();write(sourceFile,{...source,baseline});console.log('TOWER41_NEXT_SOURCE',JSON.stringify({...source,verifiers:source.verifiers.length,main:PINS.main}));}
 else if(command==='source')verifySource();
 else if(command==='package'){const receipt=packageReceipt();write(packageFile,receipt);console.log('TOWER41_NEXT_PACKAGE',JSON.stringify({sourceCommit:receipt.sourceCommit,totalBytes:receipt.totalBytes,models:receipt.nativePackage.modelHashes.length,packageFilesSha256:receipt.nativePackage.packageFilesSha256}));}
 else if(command==='verify-package')verifyPackage();
 else if(command==='served-package')servedPackage(args[0],args[1]);
 else if(command==='cpu')cpu(args[0]);
 else if(command==='contact')contact();
 else if(command==='castle')await castle();
 else if(command==='foundation20')await foundation20();
 else if(command==='status')status(...args);
 else if(command==='guard'){const frozen=verifySource(),current=await guard();for(const key of ['main','acceptedSource','canonicalSource','acceptedMetadata','canonicalMetadata','legacyPreviewSource','legacyPreviewMetadata','previousPreviewSource','previousPreviewMetadata'])assert.deepEqual(current[key],frozen.baseline[key],'Read-only baseline changed: '+key);write('qa/tower41-next-cell-summary/baseline.json',current);}
 else if(command==='summary'){
  const jobs=JSON.parse(process.env.REVIEW_JOB_RESULTS||'{}');for(const [job,result]of Object.entries(jobs))console.log('TOWER41_NEXT_JOB',JSON.stringify({job,status:result,...sourceIdentity()}));
  write('qa/tower41-next-cell-summary/jobs.json',{...sourceIdentity(),jobs,allRequiredJobsPassed:Object.keys(jobs).sort().join(',')===[...SOURCE_REVIEW_REQUIRED_JOBS].sort().join(',')&&Object.values(jobs).every(result=>result==='success'),fullTowerAccepted:false,publicationAccepted:false});
  assertRequiredReviewJobs(jobs);
 }else throw Error('Use freeze, source, package, verify-package, served-package, cpu, contact, castle, foundation20, status, guard or summary');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
