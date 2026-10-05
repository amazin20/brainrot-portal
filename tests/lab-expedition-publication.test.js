import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {assertExpeditionConfig,assertPublishableExpedition,assertExpeditionJobs,assertExpeditionArtifacts,assertExpeditionInfo,assertRecording,assertAlternativeRecordings,EXPEDITION_ALTERNATIVES,assertNewAdversarialProofs,assertMovingCollisionProof,assertAlternativeRouteProofs,expeditionHistoricalRuntimeFiles,assertPreservedFiles,expeditionRecordingLevels,expeditionRecordingGroups,expeditionJobNames,expeditionSupplementalRecordingLevels,expeditionPublishedRecordingLevels,expeditionSupplementalArtifactName,expeditionSupplementalJobName,expeditionSupplementalStepName,assertSupplementalPublicationProof,assertSupplementalCaptureEvidence,EXPEDITION_SUPPLEMENTAL_LEVELS,fileManifest,safeRelative,EXPEDITION_ARTIFACTS} from '../scripts/lib/expedition-proof.mjs';
import {assertSupplementalRecordingProof,assertMatchingInventoryFile} from '../scripts/verify-expedition-public.mjs';
import {expeditionGalleryScript,expeditionGalleryHTML,expeditionHistoricalVideoHTML} from '../scripts/lib/expedition-gallery.mjs';

const copy=value=>structuredClone(value);
const historical=JSON.parse(fs.readFileSync(new URL('../tools/expedition-release.json',import.meta.url)));
function future(){
 return {...copy(historical),sourceCommit:'a'.repeat(40),candidateRun:123,candidateArtifact:{name:'expedition-production',...EXPEDITION_ARTIFACTS['expedition-production']},recordingArtifacts:[0,1,2].map(index=>({name:'expedition-walkthroughs-'+index,...EXPEDITION_ARTIFACTS['expedition-walkthroughs-'+index]})),acceptedArtifacts:Object.entries(EXPEDITION_ARTIFACTS).map(([name,pin])=>({name,...pin})),supplementalRecordingLevels:[...EXPEDITION_SUPPLEMENTAL_LEVELS],sourceRecorderSHA256:'c'.repeat(64),sourceGameBuildInputsSHA256:'d'.repeat(64),recordedLevels:[14,28,...Array.from({length:11},(_,i)=>41+i)],recordingGroups:['14 28 42 43 44 45 46','47 48 49 50 51','41']};
}
function run(config){return {id:config.candidateRun,head_sha:config.sourceCommit,head_branch:config.sourceBranch,path:'.github/workflows/expedition-release-review.yml',status:'completed',conclusion:'success'};}
function jobs(config){return expeditionJobNames(config).map((name,index)=>({id:1000+index,name,run_id:config.candidateRun,status:'completed',conclusion:'success',steps:[{name:'Run npm test',conclusion:'success'}]}));}
function artifacts(config){return config.acceptedArtifacts.map(pin=>({...pin,expired:false,workflow_run:{id:config.candidateRun,head_sha:config.sourceCommit,head_branch:config.sourceBranch}}));}
function info(config){return {commit:config.sourceCommit,run:String(config.candidateRun),version:'v50-expedition',artVersion:'v50-expedition',levels:51,verified:false,acceptance:{humanPlaytest:false,physicalDeviceBenchmark:false,liveYandex:false},features:{defaultEdition:'foundation',foundation:{rooms:Array.from({length:51},(_,i)=>i+1),newRooms:Array.from({length:10},(_,i)=>({level:42+i,id:'new-'+i}))},tower:{level:41,stages:11,checkpoints:false}}};}
function recording(build,level=41){return {level,sourceCommit:build.commit,edition:'foundation',continuous:true,route:{pass:true,level,resets:0,respawns:0,cargoResets:0,sameCompanion:true,metrics:{checkpoints:false,completedStages:11}},firstFrame:{level,visualFrame:0,state:'playing',cargoBodyId:8},lastFrame:{level,visualFrame:1485,state:'won',cargoBodyId:8},fps:4,width:640,height:360,frameCount:100,durationSeconds:25,pixelCheck:{frames:100,allNonblank:true,minimumLuminanceRange:21},milestones:[{name:'Solved',seconds:24}],title:'Castle',video:'level-'+String(level).padStart(2,'0')+'.mp4',poster:'level-'+String(level).padStart(2,'0')+'.jpg',finishPoster:'level-'+String(level).padStart(2,'0')+'-finish.jpg',sha256:'b'.repeat(64)};}

test('all three withdrawn candidates are blocked; replacements need a complete manifest and fresh room14/28 recordings',()=>{
 for(const sourceCommit of ['3e0205ebe41804f71eab6792e5d220795fc1028e','c5cec8810846f2dda363523c6b9d8c21ea1f7d26','1c804ce1c3abe401ec122dded23917e384ada2a8'])assert.throws(()=>assertPublishableExpedition({...future(),sourceCommit}),/Withdrawn|room 14/);
 const config=future();assertPublishableExpedition(config);
 const unpinned=copy(config);delete unpinned.acceptedArtifacts;assert.throws(()=>assertExpeditionConfig(unpinned),/complete acceptedArtifacts/);
 const incomplete=copy(config);incomplete.acceptedArtifacts.pop();assert.throws(()=>assertExpeditionConfig(incomplete));
 for(const level of [14,28]){const missing=copy(config);missing.recordedLevels=missing.recordedLevels.filter(value=>value!==level);missing.recordingGroups[0]=missing.recordingGroups[0].split(' ').filter(value=>Number(value)!==level).join(' ');assert.throws(()=>assertPublishableExpedition(missing),new RegExp('room '+level));}
});
test('all19 exact jobs must succeed and the source test step cannot be skipped',()=>{
 const config=future(),jobList=jobs(config),candidate=run(config);assert.equal(assertExpeditionJobs(candidate,jobList,config).length,19);
 assert.throws(()=>assertExpeditionJobs(candidate,jobList.slice(1),config),/19/);
 const failed=copy(jobList);failed[0].conclusion='failure';assert.throws(()=>assertExpeditionJobs(candidate,failed,config));
 const skipped=copy(jobList);skipped[0].steps[0].conclusion='skipped';assert.throws(()=>assertExpeditionJobs(candidate,skipped,config),/actually run/);
 const wrong=copy(candidate);wrong.head_sha='c'.repeat(40);assert.throws(()=>assertExpeditionJobs(wrong,jobList,config));
 const duplicate=copy(jobList);duplicate[1].name=duplicate[0].name;assert.throws(()=>assertExpeditionJobs(candidate,duplicate,config),/duplicate/);
});
test('artifact IDs, archive digests, source revision and expiry are all enforced',()=>{
 const config=future(),rows=artifacts(config);assert.equal(assertExpeditionArtifacts(rows,config).length,18);
 for(const mutation of [row=>row.id++,row=>row.digest='sha256:'+'c'.repeat(64),row=>row.expired=true,row=>row.workflow_run.head_sha='d'.repeat(40)]){
  const changed=copy(rows);mutation(changed[0]);assert.throws(()=>assertExpeditionArtifacts(changed,config));
 }
 assert.throws(()=>assertExpeditionArtifacts(rows.slice(1),config));
});
test('recording groups cover exact required levels and cannot omit or duplicate a room',()=>{
 const config=future();assert.equal(expeditionRecordingLevels(config).length,13);assert.equal(expeditionRecordingGroups(config).length,3);
 const missing=copy(config);missing.recordingGroups[0]='14 42 43 44 45';assert.throws(()=>expeditionRecordingGroups(missing));
 const duplicate=copy(config);duplicate.recordingGroups[0]+=' 14';assert.throws(()=>expeditionRecordingGroups(duplicate));
});
test('candidate metadata remains exact and cannot claim external acceptance',()=>{
 const config=future(),build=info(config);assertExpeditionInfo(build,config);
 for(const mutate of [value=>value.levels=41,value=>value.commit='e'.repeat(40),value=>value.verified=true,value=>value.acceptance.humanPlaytest=true,value=>value.features.foundation.rooms.pop()]){const changed=copy(build);mutate(changed);assert.throws(()=>assertExpeditionInfo(changed,config));}
});
test('continuous recordings reject resets, companion replacement, blank intervals and missing castle stages',()=>{
 const build=info(future()),record=recording(build);assertRecording(record,build,41);
 for(const mutate of [value=>value.route.resets=1,value=>value.lastFrame.cargoBodyId=9,value=>{delete value.firstFrame.cargoBodyId;delete value.lastFrame.cargoBodyId;},value=>value.pixelCheck.minimumLuminanceRange=12,value=>value.lastFrame.state='playing',value=>value.lastFrame.visualFrame++,value=>value.route.metrics.completedStages=10,value=>value.sourceCommit='f'.repeat(40)]){const changed=copy(record);mutate(changed);assert.throws(()=>assertRecording(changed,build,41));}
});
test('allfour nativealternative recordings have exact IDs/stems and preserve the original body',()=>{
 const build=info(future()),records=EXPEDITION_ALTERNATIVES.map(({level,alternative})=>{const record=recording(build,level),stem='level-'+level+'-alternate';return {...record,alternative,route:{...record.route,alternative},video:stem+'.mp4',poster:stem+'.jpg',finishPoster:stem+'-finish.jpg'};});
 assertAlternativeRecordings(records,build);assert.throws(()=>assertAlternativeRecordings(records.slice(1),build));
 const duplicate=copy(records);duplicate[1]=duplicate[0];assert.throws(()=>assertAlternativeRecordings(duplicate,build));
 for(const mutate of [record=>record.route.alternative='wrong-id',record=>record.alternative='prearmed-relay',record=>record.lastFrame.cargoBodyId++,record=>record.video='level-49.mp4',record=>record.poster='../level-49-alternate.jpg',record=>record.pixelCheck.minimumLuminanceRange=12,record=>record.route.respawns=1]){const changed=copy(records);mutate(changed[0]);assert.throws(()=>assertAlternativeRecordings(changed,build));}
 assert.throws(()=>assertRecording(records[0],build,48),'A native alternative cannot be passed off as the canonical recording');
});
test('preserved gallery gains51 levels and a native alternative button with shareable query',()=>{
 const source=fs.readFileSync(new URL('../walkthroughs.js',import.meta.url),'utf8'),script=expeditionGalleryScript(source);new Function(script);
 const html=expeditionGalleryHTML(fs.readFileSync(new URL('../walkthroughs.html',import.meta.url),'utf8'),{recordings:13,alternatives:4});
 assert.ok(script.includes('const TOTAL = 51;'));assert.ok(script.includes("document.querySelector('#alternate-route')"));assert.ok(script.includes("url.searchParams.set('route', 'alternate')"));assert.ok(script.includes('select(selected, false, initialAlternative)'));assert.ok(html.includes('id="alternate-route"'));assert.ok(html.includes('13 новых записей'));assert.ok(html.includes('4 альтернативных маршрута'));
 assert.throws(()=>expeditionGalleryScript(source.replace('const TOTAL = 41;','const TOTAL = 9;')),/Unexpected previous gallery/);
});
test('every changed public file must survive byte-for-byte at its archive path',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'expedition-preserve-'));try{
  fs.writeFileSync(path.join(directory,'old.mp4'),'old original bytes');fs.writeFileSync(path.join(directory,'keep.txt'),'keep');const baseline=fileManifest(directory),archive=path.join(directory,'history');fs.mkdirSync(archive);
  fs.copyFileSync(path.join(directory,'old.mp4'),path.join(archive,'old.mp4'));fs.writeFileSync(path.join(directory,'old.mp4'),'new recording');
  const result=assertPreservedFiles(baseline,directory,archive);assert.equal(result.retained.length,1);assert.equal(result.archived.length,1);
  fs.writeFileSync(path.join(archive,'old.mp4'),'changed history');assert.throws(()=>assertPreservedFiles(baseline,directory,archive),/Historical public file/);
  fs.rmSync(path.join(archive,'old.mp4'));assert.throws(()=>assertPreservedFiles(baseline,directory,archive),/was lost/);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('unsafe paths and symlinks cannot enter a publication manifest',()=>{
 for(const value of ['../movie.mp4','/index.html','a/../b','a\\b','a//b','a/./b','a\0b','%2e%2e/build-info.json','http:/example.invalid/pinned.js','video.mp4?x=y','video.mp4#fragment'])assert.throws(()=>safeRelative(value));
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'expedition-symlink-'));try{fs.symlinkSync('/etc/passwd',path.join(directory,'link'));assert.throws(()=>fileManifest(directory),/symlink/);}finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('historical runtime includes both complete old games without duplicating the video library',()=>{
 const files=['index.html','build-info.json','assets/index-old.js','assets/dynamic-old.js','models/runtime/original.glb','draco/draco_decoder.wasm'],baseline=[...files,...files.map(file=>'tower-singularity/'+file),'walkthroughs/level-01.mp4','walkthroughs/level-41.mp4','walkthroughs/manifest.json'].map(path=>({path,bytes:1,sha256:'a'.repeat(64)}));
 const runtime=expeditionHistoricalRuntimeFiles(baseline,'tower-singularity');assert.equal(runtime.length,12);assert.ok(runtime.every(file=>!file.path.startsWith('walkthroughs/')));assert.ok(runtime.some(file=>file.path==='tower-singularity/models/runtime/original.glb'));
 for(const path of ['index.html','tower-singularity/build-info.json','tower-singularity/draco/draco_decoder.wasm','models/runtime/original.glb'])assert.throws(()=>expeditionHistoricalRuntimeFiles(baseline.filter(file=>file.path!==path),'tower-singularity'));
});
test('new acceptance requires all8 qualified contacts and15 source-stable omission attacks',()=>{
 const config=future(),targeted={pass:true,commit:config.sourceCommit,sourceStable:true,harnessStable:true,summary:{cases:8,qualified:8,unqualified:0,causalCandidates:0},rows:[14,16,18,41].flatMap(room=>['inward-corner-grip-reversal','underside-jump-release-regrab'].map(kind=>({room,kind,sourceStable:true,contactCoverageQualified:true,sameCargo:true,sameBody:true,resets:0,respawns:0,cargoResets:0,outcome:'finite-authored-contact-no-completion',final:{state:'playing'},causalCandidates:[],error:null,releases:1,regrabs:1})))},expansion={pass:true,source:{commit:config.sourceCommit,sourceStable:true,harnessStable:true,changedGameFiles:[]},summary:{attacks:15,blockedFinite:15,completed:0,setupOrDriverErrors:0,resetOrIdentityFailures:0,originalCargoPreserved:true},rooms:[47,48,49,50,51].map(number=>({number,attacks:[0,1,2].map(index=>({room:number,name:'attack'+index,sourceStable:true,harnessStable:true,sameOriginalCargo:true,sameOriginalBody:true,resets:0,respawns:0,outcome:'blocked-in-finite-attempt',final:{won:false},error:null}))}))};
 assertNewAdversarialProofs(targeted,expansion,config);
 const partial=copy(targeted);partial.rows.pop();assert.throws(()=>assertNewAdversarialProofs(partial,expansion,config));
 const missed=copy(targeted);missed.rows[0].contactCoverageQualified=false;assert.throws(()=>assertNewAdversarialProofs(missed,expansion,config));
 const changed=copy(expansion);changed.source.sourceStable=false;assert.throws(()=>assertNewAdversarialProofs(targeted,changed,config));
 const cargo=copy(expansion);cargo.rooms[0].attacks[0].sameOriginalBody=false;assert.throws(()=>assertNewAdversarialProofs(targeted,cargo,config));
 const stale=copy(expansion);stale.source.commit='f'.repeat(40);assert.throws(()=>assertNewAdversarialProofs(targeted,stale,config));
});
function movingProof(config){
 const sha='1'.repeat(64),bounds=[-1,-1,-1,1,1,1],rooms=Array.from({length:51},(_,i)=>i+1);
 return {pass:true,commit:config.sourceCommit,fullFoundation:true,sourceStable:true,sourceBefore:sha,sourceAfter:sha,sourceFiles:['src/game/LabGame.js'],requestedRooms:rooms,summary:{rooms:51,journeys:4,journeysPassed:4,issueColliders:0,syncMismatchColliders:0,identitiesStable:true,sourceStable:true},rows:rooms.map(room=>({room,frames:300,noInputResets:0,sourceAfter:sha,maxPhysicalTargetError:0,maxPostStepPhysicalBodyError:0,identityStable:true,colliderMeshIdentitiesStable:true,colliderGeometryIdentitiesStable:true,physicalBodyIdentitiesStable:true,issues:[],syncCalls:[{identityStable:true,maxPostMeshVsRequested:0}],...([9,10,14,29].includes(room)?{journey:{pass:true,resets:0,respawns:0,frames:1000}}:{})})),room28StartupTrajectory:{bodyId:0,passes:['normal-play','ordinary-restart'].map(name=>({name,state:'playing',firstSettledFrame:0,samples:Array.from({length:121},(_,frame)=>({frame,identitiesStable:true,colliderVsActualPhysicalError:0,meshVsActualPhysicalError:0,meshBounds:[...bounds],colliderBounds:[...bounds],actualPhysicalBounds:[...bounds]}))}))}};
}
test('full51 moving-body proof requires powered journeys and actual room28 physical bounds from frame0',()=>{
 const config=future(),proof=movingProof(config);assertMovingCollisionProof(proof,config);
 for(const mutate of [value=>value.rows.pop(),value=>value.requestedRooms[0]=2,value=>value.rows[13].journey.pass=false,value=>value.rows[27].physicalBodyIdentitiesStable=false,value=>value.rows[27].maxPhysicalTargetError=6,value=>value.rows[27].maxPostStepPhysicalBodyError=6,value=>value.rows[0].syncCalls[0].maxPostMeshVsRequested=.001,value=>value.room28StartupTrajectory.passes[1].firstSettledFrame=1,value=>value.room28StartupTrajectory.passes[0].samples[0].colliderVsActualPhysicalError=6,value=>value.room28StartupTrajectory.passes[0].samples[0].actualPhysicalBounds=[5,-1,-1,7,1,1],value=>value.room28StartupTrajectory.passes[0].samples[0].colliderBounds=[1,-1,-1,-1,1,1],value=>value.room28StartupTrajectory.passes[0].samples[0].meshVsActualPhysicalError=NaN,value=>value.room28StartupTrajectory.passes[1].samples.pop(),value=>value.sourceAfter='2'.repeat(64),value=>value.pass=false,value=>value.fullFoundation=false]){const changed=copy(proof);mutate(changed);assert.throws(()=>assertMovingCollisionProof(changed,config));}
 assert.throws(()=>assertMovingCollisionProof(undefined,config));
});
function alternativeProofs(config){
 const sha='2'.repeat(64),harness='3'.repeat(64);
 const early={pass:true,source:{commit:config.sourceCommit,stable:true,harnessStable:true,modifiedTrackedInputs:[],changedFiles:[],sourceInputsSha256:sha,afterSha256:sha,harnessSha256:harness,harnessAfterSha256:harness},summary:{attempts:5,completeDistinctRoutes:2,completeRooms:[48,49],finiteIncomplete:3,resetOrIdentityFailures:0,allOriginalBodiesPreserved:true},rows:[47,48,48,48,49].map((room,index)=>{const expectedComplete=index===1||index===4,alternative=EXPEDITION_ALTERNATIVES.find(entry=>entry.level===room)?.alternative;return {room,sourceStable:true,sourceBefore:sha,sourceAfter:sha,originalBodyId:index,originalCargoUUID:'cargo-'+index,initial:{cargoBodyId:index},final:{cargoBodyId:index,state:expectedComplete?'won':'playing'},sameOriginalCargo:true,sameOriginalBody:true,resets:0,respawns:0,cargoResets:0,frames:1000,expectedComplete,complete:expectedComplete,outcome:expectedComplete?'complete-distinct-ordinary-input-route':'finite-preparation-or-physical-constraint',...(expectedComplete?{driver:'runV8Journey',journeyOptions:{alternative},actualRoute:{level:room,alternative,pass:true,resets:0,respawns:0}}:{error:'Finite physical constraint'})};})};
 const lateRow=(room,canonical)=>({room,canonical,alternative:canonical?null:EXPEDITION_ALTERNATIVES.find(entry=>entry.level===room).alternative,outcome:canonical?'completed-canonical-route':'completed-distinct-route',originalCargoBodyId:room,originalCargoUuid:'original-'+room,final:{cargoBodyId:room,cargoUuid:'original-'+room,won:true},sameOriginalCargo:true,sameOriginalBody:true,resets:0,respawns:0,sourceStable:true,harnessStable:true,sourceBefore:sha,sourceAfter:sha,harnessBefore:harness,harnessAfter:harness,frames:1000});
 const late={pass:true,source:{commit:config.sourceCommit,sourceStable:true,harnessStable:true,changedGameFiles:[],gameSourcesSha256:sha,gameSourcesAfterSha256:sha,harnessSha256:harness,harnessAfterSha256:harness,headlessHarnessSha256:harness,headlessHarnessAfterSha256:harness},summary:{attempted:2,completed:2,canonicalAttempted:2,canonicalCompleted:2,errors:0,originalCargoPreserved:true,resets:0},routes:[50,51].map(room=>lateRow(room,false)),canonicalRoutes:[50,51].map(room=>lateRow(room,true))};
 return {early,late};
}
test('four headless native alternatives require exact completed IDs and independent canonical50/51 proofs',()=>{
 const config=future(),{early,late}=alternativeProofs(config);assertAlternativeRouteProofs(early,late,config);
 for(const mutate of [value=>value.rows.pop(),value=>value.rows[1].actualRoute.alternative='unlit-mirror',value=>value.rows[1].actualRoute.pass=false,value=>value.rows[1].final.state='playing',value=>value.rows[4].final.cargoBodyId++,value=>{delete value.rows[1].originalBodyId;delete value.rows[1].initial.cargoBodyId;delete value.rows[1].final.cargoBodyId;},value=>value.rows[1].error='Driver failed',value=>value.source.modifiedTrackedInputs.push('src/game/LabGame.js'),value=>value.source.commit='f'.repeat(40)]){const changed=copy(early);mutate(changed);assert.throws(()=>assertAlternativeRouteProofs(changed,late,config));}
 for(const mutate of [value=>value.routes.pop(),value=>value.canonicalRoutes.pop(),value=>value.routes[0].alternative='prearmed-relay',value=>value.routes[1].sameOriginalBody=false,value=>value.canonicalRoutes[0].final.won=false,value=>value.source.headlessHarnessAfterSha256='4'.repeat(64),value=>value.routes[0].sourceAfter='4'.repeat(64)]){const changed=copy(late);mutate(changed);assert.throws(()=>assertAlternativeRouteProofs(early,changed,config));}
 assert.throws(()=>assertAlternativeRouteProofs(undefined,late,config));assert.throws(()=>assertAlternativeRouteProofs(early,undefined,config));
});
test('workflow performs exact-artifact assembly and rejects the withdrawn source before deployment',()=>{
 const workflow=fs.readFileSync(new URL('../.github/workflows/publish-expedition.yml',import.meta.url),'utf8');
 assert.ok(workflow.includes('paths: [tools/expedition-release.json]'));assert.ok(workflow.includes('group: pages'));assert.ok(workflow.includes('cancel-in-progress: false'));assert.ok(workflow.includes('assertPublishableExpedition'));assert.ok(workflow.includes('assertExpeditionJobs'));assert.ok(workflow.includes('assertExpeditionArtifacts'));assert.ok(workflow.includes('digest!==artifact.digest'));assert.ok(workflow.includes('node scripts/verify-expedition-public.mjs'));assert.ok(!workflow.includes('npm run build'));assert.ok(!workflow.includes('PUBLICATION_REVIEW_ONLY'));
});

function supplementalFixture(config){
 const publicationRun=456,controllerSHA='e'.repeat(40),levels=expeditionSupplementalRecordingLevels(config);
 return {context:{publicationRun,controllerSHA},proof:{publicationRun:{id:publicationRun,head_sha:controllerSHA,head_branch:'main',path:'.github/workflows/publish-expedition.yml',status:'in_progress',conclusion:null},publicationJobs:levels.map((level,index)=>({id:2000+index,name:expeditionSupplementalJobName(level),run_id:publicationRun,status:'completed',conclusion:'success',steps:[{name:expeditionSupplementalStepName(level),conclusion:'success'},{name:'Upload recording',conclusion:'success'}]})),publicationArtifacts:levels.map((level,index)=>({id:3000+index,name:expeditionSupplementalArtifactName(level),digest:'sha256:'+'f'.repeat(64),expired:false,workflow_run:{id:publicationRun,head_sha:controllerSHA,head_branch:'main'}}))}};
}
test('all51 canonical recordings require exactly38 current-run supplements without altering the frozen13',()=>{
 const config=future();assert.equal(expeditionRecordingLevels(config).length,13);assert.equal(expeditionSupplementalRecordingLevels(config).length,38);assert.deepEqual(expeditionPublishedRecordingLevels(config),Array.from({length:51},(_,i)=>i+1));
 for(const mutate of [value=>value.supplementalRecordingLevels.pop(),value=>value.supplementalRecordingLevels[0]=14,value=>value.supplementalRecordingLevels[0]=2,value=>delete value.sourceRecorderSHA256,value=>delete value.sourceGameBuildInputsSHA256]){const changed=copy(config);mutate(changed);assert.throws(()=>assertPublishableExpedition(changed));}
});
test('supplemental jobs and artifacts bind to the actual current publication run and controller SHA',()=>{
 const config=future(),{proof,context}=supplementalFixture(config),accepted=assertSupplementalPublicationProof(proof,config,context);assert.equal(accepted.acceptedJobs.length,38);assert.equal(accepted.artifactManifest.length,38);
 for(const mutate of [value=>value.publicationRun.id++,value=>value.publicationRun.head_sha='1'.repeat(40),value=>value.publicationRun.head_branch='other',value=>value.publicationRun.path='.github/workflows/other.yml',value=>value.publicationJobs.pop(),value=>value.publicationJobs[0].conclusion='failure',value=>value.publicationJobs[0].steps[0].conclusion='skipped',value=>value.publicationJobs[0].run_id++,value=>value.publicationJobs[1].name=value.publicationJobs[0].name,value=>value.publicationJobs[1].id=value.publicationJobs[0].id,value=>value.publicationArtifacts.pop(),value=>value.publicationArtifacts[0].expired=true,value=>value.publicationArtifacts[0].workflow_run.head_sha='2'.repeat(40),value=>value.publicationArtifacts[0].workflow_run.id++,value=>value.publicationArtifacts[0].digest='missing',value=>value.publicationArtifacts[1].id=value.publicationArtifacts[0].id,value=>value.publicationArtifacts[1].name=value.publicationArtifacts[0].name]){const changed=copy(proof);mutate(changed);assert.throws(()=>assertSupplementalPublicationProof(changed,config,context));}
 assert.throws(()=>assertSupplementalPublicationProof(proof,config,{...context,publicationRun:null}));
});
test('supplemental capture attests exact production, all pinned game inputs and unchanged recorder before/after',()=>{
 const config=future(),{context}=supplementalFixture(config),buildInfoSHA256='3'.repeat(64),evidence={level:1,sourceCommit:config.sourceCommit,publicationRun:context.publicationRun,controllerSHA:context.controllerSHA,candidateArtifact:config.candidateArtifact,buildInfoSHA256,sourceScriptSHA256:config.sourceRecorderSHA256,sourceScriptAfterSHA256:config.sourceRecorderSHA256,canonicalScriptSHA256:config.sourceRecorderSHA256,gameBuildInputsBeforeSHA256:config.sourceGameBuildInputsSHA256,gameBuildInputsAfterSHA256:config.sourceGameBuildInputsSHA256,workingTreeCleanBefore:true,workingTreeCleanAfter:true};
 assertSupplementalCaptureEvidence(evidence,config,1,{...context,buildInfoSHA256});assertRecording(recording(info(config),1),info(config),1);
 for(const mutate of [value=>value.level=14,value=>value.sourceCommit='4'.repeat(40),value=>value.publicationRun++,value=>value.controllerSHA='5'.repeat(40),value=>value.candidateArtifact.id++,value=>value.candidateArtifact.digest='sha256:'+'6'.repeat(64),value=>value.buildInfoSHA256='7'.repeat(64),value=>value.sourceScriptSHA256='8'.repeat(64),value=>value.sourceScriptAfterSHA256='8'.repeat(64),value=>value.canonicalScriptSHA256='8'.repeat(64),value=>value.gameBuildInputsBeforeSHA256='9'.repeat(64),value=>value.gameBuildInputsAfterSHA256='9'.repeat(64),value=>value.workingTreeCleanBefore=false,value=>value.workingTreeCleanAfter=false]){const changed=copy(evidence);mutate(changed);assert.throws(()=>assertSupplementalCaptureEvidence(changed,config,1,{...context,buildInfoSHA256}));}
});
test('supplemental controller verifies ZIP before extraction and rejects reused outputs and tracked harness changes',()=>{
 const capture=fs.readFileSync(new URL('../scripts/capture-expedition-supplement.mjs',import.meta.url),'utf8'),workflow=fs.readFileSync(new URL('../.github/workflows/publish-expedition.yml',import.meta.url),'utf8');
 assert.ok(capture.indexOf("fileHash(archive)")<capture.indexOf("execFileSync('python3'"));assert.ok(capture.includes("!fs.existsSync(out)"));assert.ok(capture.includes("'status','--porcelain','--untracked-files=no'"));assert.ok(capture.includes('BUILD_COMMIT:config.sourceCommit'));assert.ok(capture.includes("ALTERNATIVE_ROUTE:''"));assert.ok(workflow.includes('needs: [validate, supplemental]'));assert.ok(workflow.includes('fail-fast: false'));assert.ok(workflow.includes('max-parallel: 12'));assert.ok(workflow.includes('ref: ${{ needs.validate.outputs.source }}'));assert.ok(workflow.includes('assertSupplementalPublicationProof'));assert.ok(!workflow.includes('npm run build'));
});

test('historical video index preserves distinct sources and exposes all41 exact archive URLs',()=>{
 const entries=Array.from({length:41},(_,index)=>({level:index+1,title:index===0?'Old <room> & title':'Old room',sourceCommit:index===40?'a'.repeat(40):'b'.repeat(40),sha256:'c'.repeat(64),archivedSrc:'publication-history/'+'a'.repeat(40)+'/walkthroughs/level-'+String(index+1).padStart(2,'0')+'.mp4',archivedPoster:'publication-history/'+'a'.repeat(40)+'/walkthroughs/level-'+String(index+1).padStart(2,'0')+'.jpg'}));
 const html=expeditionHistoricalVideoHTML(entries,'a'.repeat(40));assert.equal((html.match(/<li>/g)||[]).length,41);assert.ok(html.includes('Old &lt;room&gt; &amp; title'));assert.ok(html.includes('Совместимость этих исторических маршрутов с текущими задачами комнат не заявлена'));assert.ok(html.includes('b'.repeat(40)));
 const unsafe=copy(entries);unsafe[0].archivedSrc='http:/external.invalid/movie.mp4';assert.throws(()=>expeditionHistoricalVideoHTML(unsafe,'a'.repeat(40)));assert.throws(()=>expeditionHistoricalVideoHTML(entries.slice(1),'a'.repeat(40)));
});

function supplementalReleaseFixture(config){
 const {proof,context}=supplementalFixture(config),accepted=assertSupplementalPublicationProof(proof,config,context),buildInfoSHA256='3'.repeat(64);
 accepted.captureSourceEvidence=EXPEDITION_SUPPLEMENTAL_LEVELS.map(level=>({level,path:'walkthroughs/level-'+String(level).padStart(2,'0')+'-source-evidence.json',bytes:600,sha256:'4'.repeat(64),sourceCommit:config.sourceCommit,publicationRun:context.publicationRun,controllerSHA:context.controllerSHA,candidateArtifact:copy(config.candidateArtifact),buildInfoSHA256,sourceScriptSHA256:config.sourceRecorderSHA256,sourceScriptAfterSHA256:config.sourceRecorderSHA256,canonicalScriptSHA256:config.sourceRecorderSHA256,gameBuildInputsBeforeSHA256:config.sourceGameBuildInputsSHA256,gameBuildInputsAfterSHA256:config.sourceGameBuildInputsSHA256,workingTreeCleanBefore:true,workingTreeCleanAfter:true}));
 return {context,release:{publicationRun:context.publicationRun,exactCandidateFiles:[{path:'build-info.json',bytes:200,sha256:buildInfoSHA256}],supplementalRecordingLevels:[...EXPEDITION_SUPPLEMENTAL_LEVELS],supplementalRecordingProof:accepted,newRecordings:accepted.captureSourceEvidence.map(capture=>({level:capture.level,provenance:{kind:'publication-supplemental-native-recording',publicationRun:context.publicationRun,controllerSHA:context.controllerSHA,artifactId:accepted.artifactManifest.find(artifact=>artifact.name===expeditionSupplementalArtifactName(capture.level)).id,captureSourceEvidence:{path:capture.path,bytes:capture.bytes,sha256:capture.sha256}}}))}};
}
test('public supplemental validator rejects stable-but-foreign input fingerprints and incomplete/current-run provenance',()=>{
 const config=future(),{release,context}=supplementalReleaseFixture(config);assertSupplementalRecordingProof(release,config,context);
 for(const mutate of [value=>{value.supplementalRecordingProof.captureSourceEvidence[0].gameBuildInputsBeforeSHA256='f'.repeat(64);value.supplementalRecordingProof.captureSourceEvidence[0].gameBuildInputsAfterSHA256='f'.repeat(64);},value=>value.supplementalRecordingProof.captureSourceEvidence.pop(),value=>value.supplementalRecordingProof.captureSourceEvidence[1]=value.supplementalRecordingProof.captureSourceEvidence[0],value=>value.supplementalRecordingProof.artifactManifest[0].publicationRun++,value=>value.supplementalRecordingProof.artifactManifest[0].controllerSHA='f'.repeat(40),value=>value.newRecordings[0].provenance.artifactId++,value=>value.supplementalRecordingProof.acceptedJobs[0].conclusion='skipped']){const changed=copy(release);mutate(changed);assert.throws(()=>assertSupplementalRecordingProof(changed,config,context));}
 assert.throws(()=>assertSupplementalRecordingProof(release,config,{...context,publicationRun:999}));assert.throws(()=>assertSupplementalRecordingProof(release,config,{...context,controllerSHA:'f'.repeat(40)}));
});
test('local and public inventory dedup reject contradictory defined sizes and digests',()=>{
 const original={path:'walkthroughs/history.html',bytes:1234,sha256:'a'.repeat(64)};
 assertMatchingInventoryFile(original,{...original});
 assertMatchingInventoryFile(original,{path:original.path,sha256:original.sha256});
 assertMatchingInventoryFile({path:original.path,sha256:original.sha256},original);
 assert.throws(()=>assertMatchingInventoryFile(original,{...original,bytes:1235}));
 assert.throws(()=>assertMatchingInventoryFile(original,{...original,sha256:'b'.repeat(64)}));
 const empty={path:'old-empty.json',bytes:0,sha256:'c'.repeat(64)};assertMatchingInventoryFile(empty,{...empty});assert.throws(()=>assertMatchingInventoryFile(empty,{...empty,bytes:1}));
});
