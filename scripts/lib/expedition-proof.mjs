import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const EXPEDITION_SOURCE='3e0205ebe41804f71eab6792e5d220795fc1028e';
export const EXPEDITION_RUN=37237965678;
export const EXPEDITION_VERSION='v50-expedition';
export const EXPEDITION_ARTIFACTS=Object.freeze({
  "expedition-walkthroughs-2": {
    "id": 11317384892,
    "digest": "sha256:1b67d73a769bffcd00362510893390ef7aa58be7dd5f93e5993f446aa211695b"
  },
  "expedition-walkthroughs-0": {
    "id": 11316855736,
    "digest": "sha256:c721cc1a4fa8713dab49a1c0a2b817530e138a9316bbf21d8f2f99a75aa43561"
  },
  "expedition-routes-foundation": {
    "id": 11316850051,
    "digest": "sha256:d93b7710da968431802bf09ab47e8d64811acf22d58047ede95875418b4b0447"
  },
  "expedition-webgl-5": {
    "id": 11316681350,
    "digest": "sha256:cc6f1c4be023ca262daf4fbbd46071fead531f4f54c4c239ec44182e35d81e84"
  },
  "expedition-resources": {
    "id": 11316624657,
    "digest": "sha256:31d3fa04da803f8480309dd4dde9ef806f47816574eba8e835d85cdaf619d8a6"
  },
  "expedition-webgl-6": {
    "id": 11316462627,
    "digest": "sha256:cc7322bc6d48a4f9933f6079a60538439ee240184cedcfe653e60351a7a93089"
  },
  "expedition-webgl-0": {
    "id": 11316437675,
    "digest": "sha256:5298a9e068beb30c9bb1d90d9fa137d6e8846175be0c28c42965afe1c6483835"
  },
  "expedition-routes-classic": {
    "id": 11316348919,
    "digest": "sha256:fb24831c985c1ff90f7f34c9feb54f6f2cb5f3f82e402c4625381c533ec6faa8"
  },
  "expedition-new-attacks": {
    "id": 11316128276,
    "digest": "sha256:297d3c1b73985a1746437c6ca2f0296ea65848d6f61e9782a2ef83dd44c40854"
  },
  "expedition-webgl-3": {
    "id": 11316088873,
    "digest": "sha256:8895cc72f38b326b25a6bb716120a12098399a26da3e28e5dbd9115809ad1f91"
  },
  "expedition-webgl-2": {
    "id": 11315973385,
    "digest": "sha256:9af582a46883404f0021c921044cb47e9a4e7d7b984d288a68691b20c4d78cf4"
  },
  "expedition-walkthroughs-1": {
    "id": 11315903753,
    "digest": "sha256:e88adbda9e31074969bdb1b2d8497c6d7eb867dc360f64d1ace96bc6ad6e1535"
  },
  "expedition-routes-open": {
    "id": 11315848249,
    "digest": "sha256:218e4807136ee437b520adcebb13975c62cb74997a8c1ba6ecec4d82f15af480"
  },
  "expedition-production": {
    "id": 11315828214,
    "digest": "sha256:a0a17feb4dda8454e10536abecf42986c040e76a282a6fafbcb0192e544635d0"
  },
  "expedition-yandex-upload": {
    "id": 11315728444,
    "digest": "sha256:5d71c49a996e5831f46d04ffc52b9aff57618b26e62dc02676277a2999aaf745"
  },
  "expedition-webgl-1": {
    "id": 11315689214,
    "digest": "sha256:ed1a3447228b59f71802368574a18a59b0f683048c1e7df012fecea60f591a3b"
  },
  "expedition-interface": {
    "id": 11315549428,
    "digest": "sha256:57253199cd15e1872aa4fa1aa682eb2e4d7b0429b221a7eb588d2a9c4553a142"
  },
  "expedition-webgl-4": {
    "id": 11315514482,
    "digest": "sha256:81d4f3619122026339e4206d62b71a4390bdd017997f1698db1ce45a27f7cec7"
  }
});
export const EXPEDITION_JOBS=Object.freeze([
 'Full source regression suite','New authored collision and restart attacks',
 ...['foundation','classic','open'].map(edition=>'Retained and new ordinary routes ('+edition+')'),
 'Exact candidate and Yandex upload package','Menu, SDK lifecycle and mobile production interface',
 ...['1,2,3,4,5,6,7,8,9,10','11,12,13,14,15,16,17,18,19,20','21,22,23,24,25,26,27,28,29,30','31,32,33,34,35,36,37,38,39,40','42,43,44,45,46','47,48,49,50,51','41'].map(levels=>'Production WebGL routes ('+levels+')'),
 'Repeated production room and WebGL resource recovery',
 ...['42 43 44 45 46','47 48 49 50 51','41'].map(levels=>'Continuous new chapter walkthroughs ('+levels+')'),
 'Review every release gate',
]);
export function expeditionRecordingLevels(config){const levels=config.recordedLevels||Array.from({length:11},(_,i)=>i+41);assert.ok(Array.isArray(levels)&&levels.every(level=>Number.isInteger(level)&&level>=1&&level<=51));assert.equal(new Set(levels).size,levels.length);for(let level=41;level<=51;level++)assert.ok(levels.includes(level),'Every new/final room requires a current recording');return [...levels].sort((a,b)=>a-b);}
export const EXPEDITION_SUPPLEMENTAL_LEVELS=Object.freeze(Array.from({length:40},(_,i)=>i+1).filter(level=>![14,28].includes(level)));
export function expeditionSupplementalRecordingLevels(config){assert.deepEqual(config.supplementalRecordingLevels,EXPEDITION_SUPPLEMENTAL_LEVELS,'Every remaining room requires a fresh current-publication recording');for(const key of ['sourceRecorderSHA256','sourceGameBuildInputsSHA256'])assert.match(config[key],/^[a-f0-9]{64}$/);return [...EXPEDITION_SUPPLEMENTAL_LEVELS];}
export function expeditionPublishedRecordingLevels(config){const levels=[...expeditionRecordingLevels(config),...expeditionSupplementalRecordingLevels(config)].sort((a,b)=>a-b);assert.deepEqual(levels,Array.from({length:51},(_,i)=>i+1),'All51 current canonical recordings are required');return levels;}
export const expeditionSupplementalArtifactName=level=>'expedition-supplemental-walkthrough-'+level;
export const expeditionSupplementalJobName=level=>'Continuous supplemental walkthrough ('+level+')';
export const expeditionSupplementalStepName=level=>'Capture room '+level+' with the unchanged source recorder';
export function expeditionPresentationPaths(config){const prefix=safeRelative(config.previewPath);return ['walkthroughs.js','walkthroughs.html','walkthroughs/manifest.json','walkthroughs/history.html',...['preview-release.json','walkthrough.html','recording-evidence.json','native-evidence.json','ui-evidence.json'].map(file=>prefix+'/'+file)].sort();}
export function expeditionRecordingGroups(config){const groups=config.recordingGroups||['42 43 44 45 46','47 48 49 50 51','41'];assert.ok(Array.isArray(groups)&&groups.length===3);assert.ok(groups.every(group=>typeof group==='string'&&/^\d+( \d+)*$/.test(group)));const grouped=groups.flatMap(group=>group.split(' ').map(Number)).sort((a,b)=>a-b);assert.deepEqual(grouped,expeditionRecordingLevels(config),'Recording jobs must cover exactly the declared recordings');return groups;}
export function expeditionJobNames(config){return [...EXPEDITION_JOBS.filter(name=>!name.startsWith('Continuous new chapter walkthroughs (')),...expeditionRecordingGroups(config).map(group=>'Continuous new chapter walkthroughs ('+group+')')];}
export const fileHash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export const readJSON=file=>JSON.parse(fs.readFileSync(file,'utf8'));
export function safeRelative(value){
 assert.equal(typeof value,'string');assert.ok(value.length>0&&!value.includes('\\')&&!/[:%?#\u0000-\u001f\u007f]/.test(value),'Unsafe publication path');
 assert.ok(!path.posix.isAbsolute(value)&&value.split('/').every(part=>part&&part!=='.'&&part!=='..'),'Unsafe publication path: '+value);
 return value;
}
export function fileManifest(root){
 const visit=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const filename=path.join(directory,entry.name);assert.equal(entry.isSymbolicLink(),false,'Publication symlink: '+filename);
  assert.ok(entry.isFile()||entry.isDirectory(),'Unsupported publication entry');
  return entry.isDirectory()?visit(filename):[{path:safeRelative(path.relative(root,filename).split(path.sep).join('/')),bytes:fs.statSync(filename).size,sha256:fileHash(filename)}];
 });
 return visit(root).sort((a,b)=>a.path.localeCompare(b.path));
}
export function assertExpeditionConfig(config,previousConfig){
 assert.match(config.sourceCommit,/^[a-f0-9]{40}$/);assert.ok(Number.isSafeInteger(config.candidateRun)&&config.candidateRun>0);
 assert.equal(config.sourceBranch,'upgrade/release-expansion-20261004');assert.equal(config.previewPath,'tower-singularity');
 expeditionRecordingGroups(config);
 assert.match(config.previousSourceCommit,/^[a-f0-9]{40}$/);assert.ok(Number.isSafeInteger(config.previousPublicationRun)&&config.previousPublicationRun>0);
 if(previousConfig)assert.equal(config.previousSourceCommit,previousConfig.sourceCommit,'The previous publication configuration changed');
 const pins=expeditionArtifactPins(config);
 const pin=(artifact,name)=>{assert.equal(artifact.name,name);assert.equal(artifact.id,pins[name].id);assert.equal(artifact.digest,pins[name].digest);};
 pin(config.candidateArtifact,'expedition-production');
 assert.equal(config.recordingArtifacts.length,3);
 for(let i=0;i<3;i++)pin(config.recordingArtifacts[i],'expedition-walkthroughs-'+i);
 assert.equal(config.previousArtifact.name,'github-pages');assert.ok(Number.isSafeInteger(config.previousArtifact.id)&&config.previousArtifact.id>0);assert.match(config.previousArtifact.digest,/^sha256:[a-f0-9]{64}$/);
 return config;
}
export function expeditionArtifactPins(config){
 // The first candidate retains its fixed manifest for reproducible historical
 // assembly. New candidates must explicitly pin every artifact after all gates
 // pass; an unpinned replacement cannot inherit an older successful run.
 if(!config.acceptedArtifacts){assert.equal(config.sourceCommit,EXPEDITION_SOURCE,'New candidate requires the complete acceptedArtifacts manifest');assert.equal(config.candidateRun,EXPEDITION_RUN);return EXPEDITION_ARTIFACTS;}
 assert.equal(config.acceptedArtifacts.length,Object.keys(EXPEDITION_ARTIFACTS).length);
 const pins={};for(const artifact of config.acceptedArtifacts){assert.ok(Object.hasOwn(EXPEDITION_ARTIFACTS,artifact.name),'Unexpected artifact name');assert.ok(!Object.hasOwn(pins,artifact.name),'Duplicate artifact pin');assert.ok(Number.isSafeInteger(artifact.id)&&artifact.id>0);assert.match(artifact.digest,/^sha256:[a-f0-9]{64}$/);pins[artifact.name]={id:artifact.id,digest:artifact.digest};}
 assert.deepEqual(Object.keys(pins).sort(),Object.keys(EXPEDITION_ARTIFACTS).sort());return pins;
}
export function assertPublishableExpedition(config){assertExpeditionConfig(config);assert.ok(![EXPEDITION_SOURCE,'c5cec8810846f2dda363523c6b9d8c21ea1f7d26','1c804ce1c3abe401ec122dded23917e384ada2a8'].includes(config.sourceCommit),'Withdrawn candidate: repaired physical geometry, the audited room14 golden and complete acceptance are required');for(const level of [14,28])assert.ok(expeditionRecordingLevels(config).includes(level),'The repaired room '+level+' requires a new exact-candidate continuous recording');expeditionPublishedRecordingLevels(config);return config;}
export function assertSupplementalPublicationProof(proof,config,{publicationRun,controllerSHA}={}){
 const levels=expeditionSupplementalRecordingLevels(config),run=proof.publicationRun;assert.ok(Number.isSafeInteger(publicationRun)&&publicationRun>0,'A real current publication run is required');assert.match(controllerSHA,/^[a-f0-9]{40}$/);assert.equal(run.id,publicationRun);assert.equal(run.head_sha,controllerSHA);assert.equal(run.head_branch,'main');assert.equal(run.path,'.github/workflows/publish-expedition.yml');assert.ok(['in_progress','completed'].includes(run.status));assert.ok(run.conclusion===null||run.conclusion==='success');
 const acceptedJobs=[],artifactManifest=[];
 for(const level of levels){const matches=proof.publicationJobs.filter(job=>job.name===expeditionSupplementalJobName(level));assert.equal(matches.length,1,'Missing/duplicate supplemental recording job');const job=matches[0];assert.ok(Number.isSafeInteger(job.id)&&job.id>0);assert.equal(job.run_id,publicationRun);assert.equal(job.status,'completed');assert.equal(job.conclusion,'success');assert.ok(job.steps?.length&&job.steps.every(step=>['success','skipped'].includes(step.conclusion)));const captures=job.steps.filter(step=>step.name===expeditionSupplementalStepName(level));assert.equal(captures.length,1);assert.equal(captures[0].conclusion,'success','Supplemental recorder must actually run');acceptedJobs.push({id:job.id,name:job.name,conclusion:job.conclusion});
  const artifacts=proof.publicationArtifacts.filter(artifact=>artifact.name===expeditionSupplementalArtifactName(level));assert.equal(artifacts.length,1,'Missing/duplicate supplemental artifact');const artifact=artifacts[0];assert.ok(Number.isSafeInteger(artifact.id)&&artifact.id>0);assert.match(artifact.digest,/^sha256:[a-f0-9]{64}$/);assert.equal(artifact.expired,false);assert.equal(artifact.workflow_run.id,publicationRun);assert.equal(artifact.workflow_run.head_sha,controllerSHA);assert.equal(artifact.workflow_run.head_branch,'main');artifactManifest.push({id:artifact.id,name:artifact.name,digest:artifact.digest,publicationRun,controllerSHA});
 }
 assert.equal(new Set(acceptedJobs.map(job=>job.id)).size,levels.length);assert.equal(new Set(artifactManifest.map(artifact=>artifact.id)).size,levels.length);
 return {mode:'current-publication-run',sourceCommit:config.sourceCommit,candidateRun:config.candidateRun,publicationRun,controllerSHA,acceptedJobs,artifactManifest};
}
export function assertSupplementalCaptureEvidence(evidence,config,level,{publicationRun,controllerSHA,buildInfoSHA256}){
 assert.ok(expeditionSupplementalRecordingLevels(config).includes(level));assert.equal(evidence.level,level);assert.equal(evidence.sourceCommit,config.sourceCommit);assert.equal(evidence.publicationRun,publicationRun);assert.equal(evidence.controllerSHA,controllerSHA);assert.deepEqual(evidence.candidateArtifact,config.candidateArtifact);assert.equal(evidence.buildInfoSHA256,buildInfoSHA256);assert.match(evidence.buildInfoSHA256,/^[a-f0-9]{64}$/);
 for(const key of ['sourceScriptSHA256','sourceScriptAfterSHA256','canonicalScriptSHA256'])assert.equal(evidence[key],config.sourceRecorderSHA256,'The source recorder must remain byte-identical');for(const key of ['workingTreeCleanBefore','workingTreeCleanAfter'])assert.equal(evidence[key],true,'Capture source must be clean');assert.equal(evidence.gameBuildInputsBeforeSHA256,config.sourceGameBuildInputsSHA256,'Capture must use the pinned game-build inputs');assert.equal(evidence.gameBuildInputsAfterSHA256,evidence.gameBuildInputsBeforeSHA256,'Capture cannot change game-build inputs');return evidence;
}
export function assertExpeditionJobs(run,jobs,config){
 assertExpeditionConfig(config);
 assert.equal(run.id,config.candidateRun);assert.equal(run.head_sha,config.sourceCommit);assert.equal(run.head_branch,config.sourceBranch);
 assert.equal(run.path,'.github/workflows/expedition-release-review.yml');assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
 const expected=expeditionJobNames(config);assert.equal(jobs.length,expected.length,'All 19 exact candidate jobs are required');
 for(const name of expected){const matches=jobs.filter(job=>job.name===name);assert.equal(matches.length,1,'Missing/duplicate release job: '+name);const job=matches[0];assert.equal(job.run_id,run.id);assert.equal(job.status,'completed');assert.equal(job.conclusion,'success','Release gate did not pass: '+name);assert.ok(job.steps?.length>0&&job.steps.every(step=>['success','skipped'].includes(step.conclusion)),'Unfinished/failed release step: '+name);if(name==='Full source regression suite')assert.ok(job.steps.some(step=>step.name.includes('npm test')&&step.conclusion==='success'),'The full source suite must actually run');}
 return jobs.map(({id,name,conclusion})=>({id,name,conclusion}));
}
export function assertExpeditionArtifacts(artifacts,config){
 assertExpeditionConfig(config);
 const pins=expeditionArtifactPins(config);
 for(const [name,pin]of Object.entries(pins)){
  const matches=artifacts.filter(a=>a.name===name);assert.equal(matches.length,1,'Missing/duplicate candidate artifact: '+name);
  const artifact=matches[0];assert.equal(artifact.id,pin.id);assert.equal(artifact.digest,pin.digest);assert.equal(artifact.expired,false);
  assert.equal(artifact.workflow_run.id,config.candidateRun);assert.equal(artifact.workflow_run.head_sha,config.sourceCommit);assert.equal(artifact.workflow_run.head_branch,config.sourceBranch);
 }
 return artifacts.filter(a=>Object.hasOwn(pins,a.name));
}
export function assertExpeditionInfo(info,config){
 assert.equal(info.commit,config.sourceCommit);assert.equal(info.run,String(config.candidateRun));assert.equal(info.version,EXPEDITION_VERSION);assert.equal(info.artVersion,EXPEDITION_VERSION);assert.equal(info.levels,51);
 assert.equal(info.features.defaultEdition,'foundation');assert.deepEqual(info.features.foundation.rooms,Array.from({length:51},(_,i)=>i+1));
 assert.equal(info.features.foundation.newRooms.length,10);assert.deepEqual(info.features.foundation.newRooms.map(r=>r.level),Array.from({length:10},(_,i)=>i+42));
 assert.equal(new Set(info.features.foundation.newRooms.map(r=>r.id)).size,10);assert.equal(info.features.tower.level,41);assert.equal(info.features.tower.stages,11);assert.equal(info.features.tower.checkpoints,false);
 assert.deepEqual(info.acceptance,{humanPlaytest:false,physicalDeviceBenchmark:false,liveYandex:false});
 assert.equal(info.verified,false,'Preserve the original candidate metadata; publication acceptance is separate');
 return info;
}
export const EXPEDITION_ALTERNATIVES=Object.freeze([{level:48,alternative:'staged-cargo'},{level:49,alternative:'unlit-mirror'},{level:50,alternative:'free-cargo-bridge'},{level:51,alternative:'prearmed-relay'}]);
export function assertRecording(record,info,level,{alternative}={}){
 assert.equal(record.level,level);assert.equal(record.sourceCommit,info.commit);assert.equal(record.edition,'foundation');assert.equal(record.continuous,true);
 assert.equal(record.route.pass,true);assert.equal(record.route.level,level);assert.equal(record.route.resets,0);assert.equal(record.route.respawns,0);
 assert.equal(record.firstFrame.level,level);assert.equal(record.lastFrame.level,level);assert.equal(record.firstFrame.visualFrame,0);assert.equal(record.firstFrame.state,'playing');assert.equal(record.lastFrame.state,'won');for(const frame of [record.firstFrame,record.lastFrame])assert.ok(Number.isSafeInteger(frame.cargoBodyId)&&frame.cargoBodyId>=0,'Recording must identify the real companion body');assert.equal(record.lastFrame.cargoBodyId,record.firstFrame.cargoBodyId);
 assert.equal(record.fps,4);assert.equal(record.width,640);assert.equal(record.height,360);assert.ok(Number.isInteger(record.frameCount)&&record.frameCount>record.fps*5);
 assert.equal(record.lastFrame.visualFrame,(record.frameCount-1)*60/record.fps);assert.ok(Math.abs(record.durationSeconds-record.frameCount/record.fps)<.00001);
 assert.equal(record.pixelCheck.frames,record.frameCount);assert.equal(record.pixelCheck.allNonblank,true);assert.ok(record.pixelCheck.minimumLuminanceRange>12);
 assert.ok(record.milestones.length>0);assert.ok(typeof record.title==='string'&&record.title.trim().length>1);
 if(alternative){assert.ok(EXPEDITION_ALTERNATIVES.some(entry=>entry.level===level&&entry.alternative===alternative),'Unknown alternative route identity');assert.equal(record.alternative,alternative);assert.equal(record.route.alternative,alternative);}else assert.equal(record.alternative,undefined,'An alternative recording cannot replace the canonical recording');
 const stem='level-'+String(level).padStart(2,'0')+(alternative?'-alternate':'');assert.equal(record.video,stem+'.mp4');assert.equal(record.poster,stem+'.jpg');assert.equal(record.finishPoster,stem+'-finish.jpg');assert.match(record.sha256,/^[a-f0-9]{64}$/);
 if(level===41){assert.equal(record.route.cargoResets,0);assert.equal(record.route.sameCompanion,true);assert.equal(record.route.metrics.checkpoints,false);assert.equal(record.route.metrics.completedStages,info.features.tower.stages);}
 return record;
}
export function assertAlternativeRecordings(records,info){assert.equal(records.length,4,'All four native alternative recordings are required');assert.deepEqual(records.map(record=>record.level).sort((a,b)=>a-b),[48,49,50,51]);for(const expected of EXPEDITION_ALTERNATIVES){const selected=records.filter(record=>record.level===expected.level);assert.equal(selected.length,1);assertRecording(selected[0],info,expected.level,{alternative:expected.alternative});}return records;}
export function assertNewAdversarialProofs(targeted,expansion,config){
 assert.equal(targeted.pass,true);assert.equal(targeted.commit,config.sourceCommit);assert.equal(targeted.sourceStable,true);assert.equal(targeted.harnessStable,true);assert.deepEqual(targeted.summary,{cases:8,qualified:8,unqualified:0,causalCandidates:0});assert.equal(targeted.rows.length,8);
 const contacts=[];
 for(const row of targeted.rows){assert.equal(row.sourceStable,true);assert.equal(row.contactCoverageQualified,true);assert.equal(row.sameCargo,true);assert.equal(row.sameBody,true);assert.equal(row.resets,0);assert.equal(row.respawns,0);assert.equal(row.cargoResets,0);assert.equal(row.outcome,'finite-authored-contact-no-completion');assert.equal(row.final.state,'playing');assert.deepEqual(row.causalCandidates,[]);assert.ok(!row.error);if(row.kind==='underside-jump-release-regrab')assert.ok(row.releases>0&&row.regrabs>0);contacts.push(row.room+'/'+row.kind);}
 assert.deepEqual(contacts.sort(),[14,16,18,41].flatMap(room=>['inward-corner-grip-reversal','underside-jump-release-regrab'].map(kind=>room+'/'+kind)).sort());
 assert.equal(expansion.pass,true);assert.equal(expansion.source.commit,config.sourceCommit);assert.equal(expansion.source.sourceStable,true);assert.equal(expansion.source.harnessStable,true);assert.deepEqual(expansion.source.changedGameFiles,[]);assert.deepEqual(expansion.rooms.map(room=>room.number).sort((a,b)=>a-b),[47,48,49,50,51]);
 assert.deepEqual(expansion.summary,{attacks:15,blockedFinite:15,completed:0,setupOrDriverErrors:0,resetOrIdentityFailures:0,originalCargoPreserved:true});
 for(const room of expansion.rooms){assert.equal(room.attacks.length,3);assert.equal(new Set(room.attacks.map(row=>row.name)).size,3);for(const row of room.attacks){assert.equal(row.room,room.number);assert.equal(row.sourceStable,true);assert.equal(row.harnessStable,true);assert.equal(row.sameOriginalCargo,true);assert.equal(row.sameOriginalBody,true);assert.equal(row.resets,0);assert.equal(row.respawns,0);assert.equal(row.outcome,'blocked-in-finite-attempt');assert.equal(row.final.won,false);assert.ok(!row.error);}}
 return {targetedContacts:targeted.summary,expansionAttacks:expansion.summary};
}
const assertStableHash=(before,after)=>{assert.match(before,/^[a-f0-9]{64}$/);assert.equal(after,before,'The exercised source or harness changed');};
const assertBodyId=id=>assert.ok(Number.isSafeInteger(id)&&id>=0,'Proof must identify the original physical companion body');
export function assertMovingCollisionProof(report,config){
 assert.equal(report.pass,true);assert.equal(report.commit,config.sourceCommit);assert.equal(report.fullFoundation,true);assert.equal(report.sourceStable,true);assertStableHash(report.sourceBefore,report.sourceAfter);
 const rooms=Array.from({length:51},(_,i)=>i+1);assert.deepEqual([...report.requestedRooms].sort((a,b)=>a-b),rooms);assert.deepEqual(report.rows.map(row=>row.room).sort((a,b)=>a-b),rooms);
 assert.ok(report.sourceFiles.length>0&&report.sourceFiles.every(file=>/^src\/game\/[^/]+\.js$/.test(safeRelative(file))));assert.equal(new Set(report.sourceFiles).size,report.sourceFiles.length);
 for(const key of ['rooms','journeys','journeysPassed'])assert.equal(report.summary[key],key==='rooms'?51:4);for(const key of ['issueColliders','syncMismatchColliders'])assert.equal(report.summary[key],0);assert.equal(report.summary.identitiesStable,true);assert.equal(report.summary.sourceStable,true);
 const journeys=[];
 for(const row of report.rows){
  for(const key of ['identityStable','colliderMeshIdentitiesStable','colliderGeometryIdentitiesStable','physicalBodyIdentitiesStable'])assert.equal(row[key],true);assert.deepEqual(row.issues,[]);assert.equal(row.noInputResets,0);assert.equal(row.sourceAfter,report.sourceAfter);for(const key of ['maxPhysicalTargetError','maxPostStepPhysicalBodyError'])assert.ok(Number.isFinite(row[key])&&row[key]>=0&&row[key]<1e-4,'Physical collider target and post-step body must align');
  assert.ok(row.frames>=300);for(const sync of row.syncCalls){assert.equal(sync.identityStable,true);assert.ok(Number.isFinite(sync.maxPostMeshVsRequested)&&sync.maxPostMeshVsRequested<1e-4);assert.ok(!sync.firstMismatch);}
  if(row.journey){journeys.push(row.room);assert.equal(row.journey.pass,true);assert.equal(row.journey.resets,0);assert.equal(row.journey.respawns,0);assert.ok(row.journey.frames>0);}
 }
 assert.deepEqual(journeys.sort((a,b)=>a-b),[9,10,14,29]);
 const startup=report.room28StartupTrajectory;assertBodyId(startup.bodyId);assert.deepEqual(startup.passes.map(pass=>pass.name).sort(),['normal-play','ordinary-restart']);
 for(const pass of startup.passes){assert.equal(pass.firstSettledFrame,0);assert.equal(pass.state,'playing');assert.deepEqual(pass.samples.map(sample=>sample.frame),Array.from({length:121},(_,i)=>i));for(const sample of pass.samples){assert.equal(sample.identitiesStable,true);for(const key of ['colliderVsActualPhysicalError','meshVsActualPhysicalError'])assert.ok(Number.isFinite(sample[key])&&sample[key]>=0&&sample[key]<1e-4,'Room28 actual physical body must align from frame0');for(const key of ['meshBounds','colliderBounds','actualPhysicalBounds']){const bounds=sample[key];assert.ok(bounds.length===6&&bounds.every(Number.isFinite));assert.ok(bounds.slice(0,3).every((min,index)=>min<=bounds[index+3]),'Malformed physical bounds');}for(const [bounds,error]of [['meshBounds','meshVsActualPhysicalError'],['colliderBounds','colliderVsActualPhysicalError']]){const derived=Math.max(...sample[bounds].map((value,index)=>Math.abs(value-sample.actualPhysicalBounds[index])));assert.ok(derived<1e-4,'Room28 actual bound arrays must align from frame0');assert.ok(Math.abs(derived-sample[error])<1e-10,'Reported physical error contradicts the actual bounds');}}}
 return {movingCollision:report.summary,room28Startup:{passes:startup.passes.length,framesPerPass:121,firstSettledFrame:0,actualPhysicalBounds:true}};
}
export function assertAlternativeRouteProofs(early,late,config){
 assert.equal(early.pass,true);assert.equal(early.source.commit,config.sourceCommit);assert.equal(early.source.stable,true);assert.equal(early.source.harnessStable,true);assert.deepEqual(early.source.modifiedTrackedInputs,[]);assert.deepEqual(early.source.changedFiles,[]);assertStableHash(early.source.sourceInputsSha256,early.source.afterSha256);assertStableHash(early.source.harnessSha256,early.source.harnessAfterSha256);
 assert.deepEqual(early.summary,{attempts:5,completeDistinctRoutes:2,completeRooms:[48,49],finiteIncomplete:3,resetOrIdentityFailures:0,allOriginalBodiesPreserved:true});assert.equal(early.rows.length,5);
 const completed=[];
 for(const row of early.rows){assert.equal(row.sourceStable,true);assert.equal(row.sourceBefore,early.source.sourceInputsSha256);assert.equal(row.sourceAfter,early.source.afterSha256);assertBodyId(row.originalBodyId);assert.ok(typeof row.originalCargoUUID==='string'&&row.originalCargoUUID.length>0);assert.equal(row.initial.cargoBodyId,row.originalBodyId);assert.equal(row.final.cargoBodyId,row.originalBodyId);assert.equal(row.sameOriginalCargo,true);assert.equal(row.sameOriginalBody,true);assert.equal(row.resets,0);assert.equal(row.respawns,0);assert.equal(row.cargoResets,0);assert.ok(row.frames>0);
  if(row.expectedComplete){completed.push(row.room);const alternative=EXPEDITION_ALTERNATIVES.find(entry=>entry.level===row.room)?.alternative;assert.ok([48,49].includes(row.room));assert.equal(row.driver,'runV8Journey');assert.equal(row.journeyOptions.alternative,alternative);assert.equal(row.actualRoute.alternative,alternative);assert.equal(row.actualRoute.level,row.room);assert.equal(row.actualRoute.pass,true);assert.equal(row.actualRoute.resets,0);assert.equal(row.actualRoute.respawns,0);assert.equal(row.complete,true);assert.equal(row.final.state,'won');assert.equal(row.outcome,'complete-distinct-ordinary-input-route');assert.ok(!row.error);}
  else {assert.equal(row.expectedComplete,false);assert.equal(row.complete,false);assert.equal(row.final.state,'playing');assert.equal(row.outcome,'finite-preparation-or-physical-constraint');}
 }
 assert.deepEqual(completed.sort((a,b)=>a-b),[48,49]);
 assert.equal(late.pass,true);assert.equal(late.source.commit,config.sourceCommit);assert.equal(late.source.sourceStable,true);assert.equal(late.source.harnessStable,true);assert.deepEqual(late.source.changedGameFiles,[]);assertStableHash(late.source.gameSourcesSha256,late.source.gameSourcesAfterSha256);assertStableHash(late.source.harnessSha256,late.source.harnessAfterSha256);assertStableHash(late.source.headlessHarnessSha256,late.source.headlessHarnessAfterSha256);
 assert.deepEqual(late.summary,{attempted:2,completed:2,canonicalAttempted:2,canonicalCompleted:2,errors:0,originalCargoPreserved:true,resets:0});assert.deepEqual(late.routes.map(row=>row.room).sort((a,b)=>a-b),[50,51]);assert.deepEqual(late.canonicalRoutes.map(row=>row.room).sort((a,b)=>a-b),[50,51]);
 for(const [canonical,rows]of [[false,late.routes],[true,late.canonicalRoutes]])for(const row of rows){assert.equal(row.canonical,canonical);assert.equal(row.alternative,canonical?null:EXPEDITION_ALTERNATIVES.find(entry=>entry.level===row.room).alternative);assert.equal(row.outcome,canonical?'completed-canonical-route':'completed-distinct-route');assertBodyId(row.originalCargoBodyId);assert.ok(typeof row.originalCargoUuid==='string'&&row.originalCargoUuid.length>0);assert.equal(row.final.cargoBodyId,row.originalCargoBodyId);assert.equal(row.final.cargoUuid,row.originalCargoUuid);assert.equal(row.final.won,true);assert.equal(row.sameOriginalCargo,true);assert.equal(row.sameOriginalBody,true);assert.equal(row.resets,0);assert.equal(row.respawns,0);assert.equal(row.sourceStable,true);assert.equal(row.harnessStable,true);assert.equal(row.sourceBefore,late.source.gameSourcesSha256);assert.equal(row.sourceAfter,late.source.gameSourcesAfterSha256);assert.equal(row.harnessBefore,late.source.harnessSha256);assert.equal(row.harnessAfter,late.source.harnessAfterSha256);assert.ok(row.frames>0);assert.ok(!row.error);}
 return {alternativePreparation:early.summary,alternativeRoutes:late.summary,nativeAlternativeLevels:[48,49,50,51]};
}
export function expeditionHistoricalRuntimeFiles(before,previewPath){
 safeRelative(previewPath);const runtime=file=>file==='index.html'||file==='build-info.json'||['assets/','models/','draco/'].some(prefix=>file.startsWith(prefix));
 const rows=before.filter(file=>runtime(file.path)||(file.path.startsWith(previewPath+'/')&&runtime(file.path.slice(previewPath.length+1))));
 for(const prefix of ['',previewPath+'/']){for(const filename of ['index.html','build-info.json'])assert.ok(rows.some(file=>file.path===prefix+filename),'Missing historical runtime entry');for(const directory of ['assets/','models/','draco/'])assert.ok(rows.some(file=>file.path.startsWith(prefix+directory)),'Missing historical runtime dependency: '+prefix+directory);}
 return rows;
}
export function assertPreservedFiles(before,site,historyRoot){
 const retained=[],archived=[];
 for(const original of before){
  const current=path.join(site,original.path),archive=path.join(historyRoot,original.path);
  if(fs.existsSync(current)&&fileHash(current)===original.sha256)retained.push(original);
  else {assert.ok(fs.existsSync(archive),'Previous public file was lost: '+original.path);assert.equal(fileHash(archive),original.sha256,'Historical public file was changed: '+original.path);archived.push({...original,archivedPath:path.relative(site,archive).split(path.sep).join('/')});}
 }
 return {retained,archived};
}
