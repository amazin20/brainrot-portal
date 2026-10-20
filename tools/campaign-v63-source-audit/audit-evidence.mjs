/** Immutable Source validators applied to already provider-bound evidence.
 * Read-only: no browser, renderer, route execution or acceptance issuance. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {hash,read,scopes,fileRow,inventory,assertClosedFiles,decodedImages,assertNetwork,assertRewardedUI,assertNegativeChecker} from './audit-common.mjs';
import {auditPlayerUI} from './audit-player-ui.mjs';
import {auditOptics} from './audit-optics.mjs';

const groups={early:Array.from({length:10},(_,i)=>i+1),energy:Array.from({length:10},(_,i)=>i+11),living:Array.from({length:10},(_,i)=>i+21),optics:Array.from({length:10},(_,i)=>i+31),fracture:Array.from({length:10},(_,i)=>i+42),castle:[41]};
const resetCounterScope='reported journey counters after legacy fixture initialization; the initial fixture reset is outside these counters; specialized drivers retain their own stricter proofs';
const stamp=info=>({commit:info.commit,version:info.version,editionVersion:info.editionVersion,sourceInputsSha256:info.sourceInputsSha256});
const same=(actual,expected,message)=>assert.deepEqual(actual,expected,message);

export async function auditEvidence(context){
 const {source,evidence,commit,tree,runId,runAttempt,productionDirectory}=context;
 process.chdir(source);Object.assign(process.env,{BUILD_COMMIT:commit,GITHUB_SHA:commit,GITHUB_RUN_ID:String(runId),GITHUB_RUN_ATTEMPT:String(runAttempt),SOURCE_REVIEW_RUN_ID:String(runId),SOURCE_REVIEW_RUN_ATTEMPT:String(runAttempt)});
 const load=relative=>import(pathToFileURL(path.join(source,relative)));
 const {buildSourceInputs,verifyReleaseMetadata,verifyReleasePackage}=await load('scripts/lib/release-manifest.mjs');
 const {verifyCampaignPackage}=await load('scripts/v8-package-check.mjs');
 const {assertStampedCampaignInfo,assertCampaignBrowserState}=await load('scripts/lib/campaign-browser-contract.mjs');
 const {assertFoundation20Route}=await load('scripts/lib/foundation20-native-proof.mjs');
 const {assertPendulumPhysicalProof}=await load('scripts/lib/tower41-pendulum-proof.mjs');
 const {assertCastleImpulsePhysicalProof}=await load('scripts/lib/castle-impulse-native-proof.mjs');
 const {assertYandexCheckerDiagnostic,YANDEX_CHECKER_PIN,loadPinnedYandexChecker,bindOriginalYandexCopiedRows}=await load('scripts/lib/yandex-debug-checker.mjs');
 loadPinnedYandexChecker({sourceRoot:source});
 const {bindPlatformReviewPackages}=await load('scripts/qa-campaign-platform-route.mjs');
 const {bindProductionYandexRuntime}=await load('scripts/qa-player-production-sdk-browser.mjs');
 const {campaignAccessFixture}=await load('scripts/lib/campaign-access-fixture.mjs');
 const {FOUNDATION_SEQUENCE,foundationDisplayNumber}=await load('src/game/LabCampaignSequence.js');
 const {ACTIVE_FOUNDATION_RUNTIME_FLAGS,RELEASE_VERSION}=await load('src/game/ReleaseIdentity.js');
 const {campaignSpec}=await load('src/game/LabCampaignLevels.js');
 assert.equal(RELEASE_VERSION,'v63-player-access-optics');const sourceInputs=buildSourceInputs(source),sourceInputsSha256=hash(JSON.stringify(sourceInputs));
 function pkg(directory,mode){
  const bytes=fs.readFileSync(path.join(directory,'build-info.json')),info=read(path.join(directory,'build-info.json'));
  verifyReleaseMetadata(info,{directory,commit,root:source,run:String(runId)});const files=verifyReleasePackage(info,directory);
  assertStampedCampaignInfo(info,commit);assert.equal(info.verified,false);assert.equal(info.levels,51);assert.equal(info.sourceInputsSha256,sourceInputsSha256);
  same(inventory(directory),[...files,fileRow(directory,'build-info.json')].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0),'Unexpected package metadata/member');
  assert.ok(!files.some(file=>/debugcheck|yandex-games-debug-checker/.test(file.path)));
  return{directory,mode,commit,info,files,buildInfoBytes:bytes.length,buildInfoSha256:hash(bytes),packageFilesSha256:info.packageFilesSha256,sourceInputsSha256};
 }
 const consumer=pkg(path.join(evidence,'v63-dist'),'consumer'),review=pkg(path.join(evidence,'v63-yandex-review-dist'),'yandex-review-test');
 verifyCampaignPackage(consumer.directory);verifyCampaignPackage(review.directory);assert.notEqual(consumer.packageFilesSha256,review.packageFilesSha256);
 const candidateFiles=inventory(consumer.directory);assert.ok(candidateFiles.reduce((n,file)=>n+file.bytes,0)<=100_000_000);
 const build=read(path.join(evidence,'v63-build/report.json'));
 assert.equal(build.kind,'player-access-source-package');assert.equal(build.pass,true);assert.equal(build.sourceAccepted,false);assert.equal(build.publicationAccepted,false);
 assert.equal(build.sourceCommit,commit);assert.equal(build.sourceTree,tree);same(build.sourceReview,{runId,runAttempt});assert.equal(build.version,RELEASE_VERSION);
 same(build.dist,{files:candidateFiles,bytes:candidateFiles.reduce((n,file)=>n+file.bytes,0),inventorySha256:hash(JSON.stringify(candidateFiles))});
 const production=pkg(productionDirectory,'yandex-production');assert.ok(!production.files.some(file=>/Journey|debugcheck|yandex-games-debug-checker/.test(file.path)));
 const archiveFile=path.join(evidence,'v63-yandex/brainrot-portal-v63-yandex.zip'),archiveBytes=fs.readFileSync(archiveFile),packaged=read(path.join(evidence,'v63-yandex/report.json'));
 assert.equal(packaged.pass,true);assert.equal(packaged.sourceCommit,commit);assert.equal(packaged.sourceTree,tree);assert.equal(packaged.workingTreeModified,false);assert.equal(packaged.builtFromCurrentSource,true);
 assert.equal(packaged.compressedBytes,archiveBytes.length);assert.equal(packaged.sha256,hash(archiveBytes));assert.equal(packaged.sourceInputsSha256,sourceInputsSha256);assert.equal(packaged.limitBytes,100_000_000);
 assert.ok(packaged.compressedBytes<=packaged.limitBytes&&packaged.unpackedBytes<=packaged.limitBytes);
 const productionInventory=inventory(production.directory).map(({path:filename,...row})=>({filename,...row}));same(packaged.files,productionInventory);
 assert.equal(packaged.unpackedBytes,productionInventory.reduce((sum,row)=>sum+row.bytes,0));
 same(build.yandex,{filename:packaged.archiveFilename,bytes:archiveBytes.length,sha256:hash(archiveBytes),unpackedBytes:packaged.unpackedBytes});
 const parent=execFileSync('git',['rev-parse','HEAD^'],{cwd:source,encoding:'utf8'}).trim();assert.equal(build.sourceParent,parent);
 let ordinary=0,native=0,architecture=0;const nativeImages=[];
 const mechanismProof=(route,level,cargoBodyId)=>{
  if(level===20)assertFoundation20Route(route.foundation20Proof??route);
  if(level===41){
   same(route.milestones.filter(mark=>mark.name?.startsWith('Solved ')).map(mark=>mark.name.slice(7)),['freight','sluice','optics','hoist','archive','flywheel','magnet','migrant','pendulum','inertia','impulse','crown']);
   const pendulum=route.milestones.find(mark=>mark.name==='Solved pendulum')?.physicsProof;
   const bodyId=cargoBodyId??pendulum?.lowerPhysicalCell?.originalCargoBodyId;
   assertPendulumPhysicalProof(pendulum,bodyId);assert.equal(Object.hasOwn(pendulum,'upperCatchKinematic'),false);
   assertCastleImpulsePhysicalProof(route.milestones.find(mark=>mark.name==='Solved impulse')?.physicsProof,bodyId);
  }
 };
 for(const [part,levels]of Object.entries(groups)){
  const directory=path.join(evidence,'v63-ordinary-'+part),report=read(path.join(directory,'report.json'));
  assert.equal(report.sourceCommit,commit);assert.equal(report.pass,true);assert.equal(report.active,undefined);same(report.selected,levels);same(report.rows.map(row=>row.stableLevel),levels);
  same(report.runtime,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});
  for(const row of report.rows){
   assert.equal(row.pass,true);assert.equal(row.state,'won');assert.equal(row.error,undefined);assert.equal(row.number,foundationDisplayNumber(row.stableLevel-1));
   assert.equal(row.id,campaignSpec(report.runtime,row.stableLevel-1).id);assert.equal(row.sameOriginal,true);assert.equal(row.resets,0);assert.equal(row.respawns,0);assert.ok(row.frames>0);
   mechanismProof(row,row.stableLevel);ordinary++;
  }
 }
 async function browserReport(artifact,levels,mode){
  const directory=path.join(evidence,artifact),report=read(path.join(directory,'report.json')),checked=read(path.join(directory,'checked.json')),binding=read(path.join(directory,'consumer-package-binding.json'));
  assert.equal(report.sourceCommit,commit);same(report.package,stamp(consumer.info));assert.equal(report.mode,mode);assert.equal(report.pass,true);assert.equal(report.capturePass,true);assert.equal(report.strictCapture,true);same(report.errors,[]);assert.equal(report.active,undefined);same(report.rows.map(row=>row.level),levels);
  assert.equal(binding.kind,'frozen-consumer-browser-package-binding');assert.equal(binding.sourceCommit,commit);assert.equal(binding.sourceTree,tree);assert.equal(binding.sourceInputsSha256,sourceInputsSha256);assert.equal(binding.sourceInputFiles,sourceInputs.length);scopes(binding);
  for(const key of ['buildInfoBytes','buildInfoSha256','packageFilesSha256','files'])same(binding[key],consumer[key]);assert.equal(binding.mode,mode);assert.equal(binding.levels,levels.join(','));assert.equal(new URL(binding.url).pathname,'/campaign-v63/');
  const names=[],novelProofs=[];
  for(const row of report.rows){
   assert.equal(row.pass,true);assert.equal(row.capturePass,true);same(row.errors,[]);assert.equal(row.error,undefined);assertCampaignBrowserState(row.start,row.level);same(row.start.missingModels,[]);
   const fixture=campaignAccessFixture({levelIndex:row.level-1,pathname:'/campaign-v63/'}),quality=mode==='route'?'low':'balanced';fixture.preferences={...fixture.preferences,quality};fixture.raw=JSON.stringify(fixture.preferences);same(row.accessFixture,fixture,'Consumer route target fixture is not the exact unfinished canonical prefix');
   assert.equal(row.start.quality,quality);assert.equal(row.start.shadows,quality!=='low');
   if(mode==='route'){
    assert.equal(row.gameplayPassed,true);const route=row.route;assert.equal(route.pass,true);assert.equal(route.state,'won');assert.equal(route.sameCompanion,true);assert.equal(route.sameCargoShape,true);
    assert.equal(route.cargoUUID,row.start.cargoUUID);assert.equal(route.cargoBodyId,row.start.cargoBodyId);assert.ok(route.frames>0);assert.equal(route.resets??0,0);assert.equal(route.respawns??0,0);assert.equal(route.cargoResets??0,0);mechanismProof(route,row.level,row.start.cargoBodyId);
    same(Object.keys(row.captures),['finish']);const capture=row.captures.finish;assert.equal(capture.ok,true);assert.equal(capture.includesHTML,false);assert.ok(capture.renderer.calls>0&&capture.renderer.triangles>0);
    assert.equal(capture.frame.state,'won');assert.equal(capture.frame.levelIndex,row.level-1);assert.equal(capture.frame.cargoUUID,row.start.cargoUUID);assert.equal(capture.frame.cargoBodyId,row.start.cargoBodyId);names.push(`${row.level}-finish.jpg`);native++;
    if(row.level===41){const pendulum=route.milestones.find(mark=>mark.name==='Solved pendulum').physicsProof;novelProofs.push({level:41,...assertPendulumPhysicalProof(pendulum,row.start.cargoBodyId)});const impulse=route.milestones.find(mark=>mark.name==='Solved impulse').physicsProof;novelProofs.push({level:41,physicalOriginalCargoImpulse:true,originalCargoBodyId:row.start.cargoBodyId,originalCargoShapeId:impulse.impulseCell.originalCargoShapeId});}
   }else{
    assert.equal(report.inspectionQuality,'balanced');assert.equal(row.start.quality,'balanced');assert.equal(row.start.shadows,true);same(Object.keys(row.captures),['start','overview']);
    for(const kind of ['start','overview']){assert.equal(row.captures[kind].ok,true);names.push(`${row.level}-${kind}.jpg`);}
    const framing=row.framing,bounds=framing.bounds;assert.equal(framing.kind,'interior-camera-inspection');assert.equal(framing.geometryVisibilityChanged,false);
    for(const vector of [framing.eye,framing.target])assert.ok(Array.isArray(vector)&&vector.length===3&&vector.every(Number.isFinite));
    for(const key of ['minX','maxX','minZ','maxZ','base','roof'])assert.ok(Number.isFinite(bounds[key]));
    assert.ok(bounds.maxX>bounds.minX&&bounds.maxZ>bounds.minZ&&bounds.roof-bounds.base>=4);assert.ok(framing.eye[0]>bounds.minX&&framing.eye[0]<bounds.maxX&&framing.eye[2]>bounds.minZ&&framing.eye[2]<bounds.maxZ&&framing.eye[1]>bounds.base&&framing.eye[1]<bounds.roof-1);
    assert.ok(framing.roofClearance>1&&Math.abs(framing.roofClearance-(bounds.roof-framing.eye[1]))<1e-9);assert.ok(framing.visibleFloorPoints>=3);architecture++;
   }
  }
  assert.equal(checked.kind,'player-access-'+mode+'-check');assert.equal(checked.pass,true);assert.equal(checked.sourceAccepted,false);assert.equal(checked.publicationAccepted,false);assert.equal(checked.sourceCommit,commit);assert.equal(checked.sourceTree,tree);assert.equal(checked.sourceParent,parent);same(checked.sourceReview,{runId,runAttempt});assert.equal(checked.version,RELEASE_VERSION);same(checked.levels,levels);same(checked.novelProofs,novelProofs);
  same(checked.sourceReport,fileRow(directory,'report.json'));
  const decoded=decodedImages(directory,names);same(checked.decodedImages,decoded);nativeImages.push(...decoded.map(row=>({artifact,...row})));return decoded;
 }
 for(const [part,levels]of Object.entries(groups))await browserReport('v63-native-'+part,levels,'route');
 await browserReport('v63-architecture',groups.optics,'overview');assert.equal(ordinary,51);assert.equal(native,51);assert.equal(architecture,10);
 const expectedPlatform=JSON.parse(JSON.stringify(bindPlatformReviewPackages({sourceRoot:source,directory:review.directory,consumerDirectory:consumer.directory})));let platformRooms=0,rewardedTransactions=0;const checkerSummaries=[];
 function originalChecker(directory,identity){
  const report=read(path.join(directory,'yandex-debug-checker-report.json'));assert.equal(report.pass,true);same(report.identity,identity);
  assert.equal(fs.readFileSync(path.join(directory,'yandex-debug-checker-report.txt'),'utf8'),report.originalReport);
  const summary=assertYandexCheckerDiagnostic(report);same(report.summary,summary);assert.equal(summary.hardFailures,0);return{summary,report};
 }
 for(const [part,levels]of Object.entries(groups)){
  const directory=path.join(evidence,'v63-checker-platform-'+part),report=read(path.join(directory,'platform-route-report.json'));
  assert.equal(report.kind,'mock-yandex-original-checker-campaign-routes');assert.equal(report.pass,true);scopes(report);same(report.binding,expectedPlatform);same(report.levels,levels);same(report.rows.map(row=>row.level),levels);assertClosedFiles(directory,report.artifacts,'platform-route-report.json');
  for(const row of report.rows){
   scopes(row);assert.equal(row.pass,true);same(row.errors,[]);assert.equal(row.displayNumber,foundationDisplayNumber(row.level-1));
   const roomRoot=path.join(directory,'room-'+String(row.level).padStart(2,'0'));same(read(path.join(roomRoot,'route-report.json')),row);
   const fixture=campaignAccessFixture({levelIndex:row.level-1,pathname:'/campaign-v63/'});fixture.preferences={...fixture.preferences,muted:false,volume:.29};fixture.raw=JSON.stringify(fixture.preferences);same(row.fixture,fixture);
   for(const key of ['beforePlay','normalPlay','finished']){assert.equal(row[key].levelIndex,row.level-1);assert.equal(row[key].id,campaignSpec({chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS},row.level-1).id);assert.equal(row[key].platformDemo,false);}
   same(row.beforePlay.completed,fixture.completed);assert.equal(row.beforePlay.selectedLevel,row.level-1);
   assert.equal(row.normalPlay.worldStep,0);assert.equal(row.normalPlay.elapsed,0);assert.ok(row.normalPlay.normalPlayerSpawnDistance<1e-8&&row.normalPlay.normalCargoSpawnDistance<1e-8);
   assertRewardedUI(row.hintTransactions,row.level);rewardedTransactions+=3;
   assert.equal(row.route.pass,true);if(row.level===20)assertFoundation20Route(row.route);assert.equal(row.finished.state,'won');assert.equal(row.finished.actualProductionWin,true);assert.equal(row.finished.cargoUUID,row.normalPlay.cargoUUID);assert.equal(row.finished.cargoBodyId,row.normalPlay.cargoBodyId);assert.equal(row.finished.cargoMass,3.2);assert.equal(row.finalFrame.ok,true);decodedImages(roomRoot,['finished-canvas.jpg']);
   const identity={sourceCommit:commit,sourceTree:tree,sourceInputsSha256,runId,runAttempt,level:row.level,displayNumber:row.displayNumber,reviewPackageFilesSha256:review.packageFilesSha256,consumerPackageFilesSha256:consumer.packageFilesSha256,controllerFilesSha256:expectedPlatform.controller.filesSha256};
   const checked=originalChecker(path.join(roomRoot,'checker'),identity);same(row.checker.summary,checked.summary);assert.equal(row.checker.reportSha256,fileRow(roomRoot,'checker/yandex-debug-checker-report.json').sha256);assert.equal(row.checker.originalTextSha256,fileRow(roomRoot,'checker/yandex-debug-checker-report.txt').sha256);checkerSummaries.push({level:row.level,...checked.summary});
   assert.equal(row.sdk.platformDemo,false);for(const event of ['init','ready','start'])assert.ok(row.sdk.log.some(item=>item.event===event));
   assertNetwork(row.network,{url:row.url,package:review,sdk:report.sdk});platformRooms++;
  }
 }
 assert.equal(platformRooms,51);assert.equal(rewardedTransactions,153);
 const playerAccess=await auditPlayerUI({...context,consumer,sourceInputs,sourceInputsSha256});assert.equal(playerAccess.auditPassed,true);
 const opticsNative=await auditOptics({...context,consumer,review,sourceInputs,sourceInputsSha256});assert.equal(opticsNative.pass,true);
 const productionRoot=path.join(evidence,'v63-production-sdk'),sdkReport=read(path.join(productionRoot,'sdk-production-proof.json'));
 assert.equal(sdkReport.kind,'actual-production-yandex-sdk-browser-diagnostic');assert.equal(sdkReport.pass,true);scopes(sdkReport);same(sdkReport.errors,[]);assert.equal(sdkReport.failure,undefined);assert.equal(sdkReport.phase,undefined);
 const expectedProduction=bindProductionYandexRuntime({sourceRoot:source,directory:productionDirectory,archive:archiveFile,packageReport:path.join(evidence,'v63-yandex/report.json')});same(sdkReport.binding,expectedProduction);assertClosedFiles(productionRoot,sdkReport.artifacts,'sdk-production-proof.json');same(sdkReport.cases.map(row=>row.scenario),['sdk-rejected','desktop','mobile']);
 const noHooks=value=>{same(Object.keys(value.qaHooks).sort(),['__NESI_DEMO_GAME__','__NESI_PLATFORM__','__NESI_PREFS__','__NESI_RUN_LEVEL_ROUTE__'].sort());for(const type of Object.values(value.qaHooks))assert.equal(type,'undefined');assert.equal(value.walkthrough,false);assert.equal(value.obsoletePauseSelect,false);};
 const productionSummaries=[];
 for(const row of sdkReport.cases){
  assert.equal(row.pass,true);scopes(row);assertNetwork(row.network,{url:row.url,package:production,sdk:row.sdk});
  if(row.scenario==='sdk-rejected'){
   noHooks(row.failedStartup);assert.equal(row.failedStartup.state,'error');assert.match(row.failedStartup.error,/initialization rejected/);assert.equal(row.failedStartup.mock.log.filter(event=>['ready','start'].includes(event.event)).length,0);
   productionSummaries.push({scenario:row.scenario,...assertNegativeChecker(row.checker,{pin:YANDEX_CHECKER_PIN,url:row.url,originalText:fs.readFileSync(path.join(productionRoot,'sdk-rejected-original-checker.txt'),'utf8'),bindCopiedRows:bindOriginalYandexCopiedRows})});continue;
  }
  for(const value of Object.values(row).filter(value=>value&&typeof value==='object'&&value.qaHooks)){noHooks(value);assert.equal(value.levelIndex,0);assert.equal(value.edition,'foundation');assert.equal(value.mock.liveSdk,false);assert.equal(value.mock.liveAds,false);}
  assert.equal(row.menu.options,51);assert.equal(row.menu.selected,0);same(row.menu.enabledIndices,[0]);assert.equal(row.menu.documentLang,'ru');assert.equal(row.menu.mock.log.filter(event=>event.event==='ready').length,1);assert.equal(row.menu.mock.log.filter(event=>event.event==='sdk-language-get').length,1);
  assert.equal(row.play.state,'playing');assert.equal(row.play.audio[0].state,'running');assert.equal(row.play.mock.log.filter(event=>event.event==='fullscreen-request').length,row.scenario==='mobile'?1:0);
  assert.equal(row.sdkPaused.externalPause,'true');assert.equal(row.sdkPaused.audio[0].state,'suspended');assert.equal(row.sdkPaused.mock.log.at(-1).event,'stop');assert.equal(row.sdkResumed.externalPause,'false');assert.equal(row.sdkResumed.audio[0].state,'running');assert.equal(row.sdkResumed.mock.log.at(-1).event,'start');
  if(row.scenario==='desktop'){
   assert.equal(row.manualPause.state,'paused');assert.equal(row.manualPause.audio[0].state,'suspended');assert.equal(row.immediateRestart.levelIndex,0);assert.equal(row.immediateRestart.mock.log.filter(event=>event.event==='interstitial-open').length,row.manualPause.mock.log.filter(event=>event.event==='interstitial-open').length);
   assert.equal(row.atlas.state,'ready');same(row.atlas.enabledIndices,[0]);assert.equal(row.atlasBack.state,'playing');assert.equal(row.atlasBack.levelIndex,0);assert.equal(row.interstitialOpen.externalPause,'true');assert.equal(row.interstitialOpen.audio[0].state,'suspended');assert.equal(row.closedWhileBlurred.externalPause,'true');assert.equal(row.closedWhileBlurred.audio[0].state,'suspended');assert.equal(row.afterFocusResume.state,'playing');assert.equal(row.afterFocusResume.audio[0].state,'running');noHooks(row.reloaded);assert.equal(row.reloaded.selected,0);same(row.reloaded.enabledIndices,[0]);
  }
  const identity={sourceCommit:commit,sourceTree:tree,sourceInputsSha256,runId,runAttempt,level:1,productionPackageFilesSha256:production.packageFilesSha256,productionArchiveSha256:hash(archiveBytes),scenario:row.scenario};const checked=originalChecker(path.join(productionRoot,row.scenario+'-checker'),identity);same(row.checker,{summary:checked.summary,identity});decodedImages(productionRoot,[row.scenario+'-playing.png']);productionSummaries.push({scenario:row.scenario,...checked.summary});
 }
 return{pass:true,candidateFiles,sourceInputsSha256,sourceInputFiles:sourceInputs.length,
  ordinaryRoutes:{pass:true,rooms:ordinary,won:ordinary,resetCounterScope},
  nativeRoutes:{pass:true,gameplayPassed:native,capturesPassed:native,normalUiZeroStepStartProven:false,resetCounterScope},
  playerAccess:{pass:true,...playerAccess},rewardedUI:{pass:true,rooms:platformRooms,transactions:rewardedTransactions,liveAds:false},
  platformChecker:{pass:true,rooms:platformRooms,liveSdkAccepted:false,moderationAccepted:false,originalFindings:checkerSummaries},
  opticsNative,architecture:{pass:true,rooms:architecture,decodedImages:nativeImages.length-native},
  productionSDK:{pass:true,liveSdkAccepted:false,moderationAccepted:false,actualArchiveSha256:hash(archiveBytes),cases:productionSummaries}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);const result=await auditEvidence(JSON.parse(Buffer.concat(chunks)));process.stdout.write(JSON.stringify(result));}
 catch(error){process.stderr.write(String(error?.stack||error)+'\n');process.exitCode=1;}
}
