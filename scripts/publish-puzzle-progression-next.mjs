/** Exact-source review receipts and publication guards for the isolated rooms 47–49. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export const PINS=Object.freeze({
 repository:'amazin20/brainrot-portal',artifactStem:'puzzle-progression-next',branch:'upgrade/puzzle-progression-next-20261009',
 sourceBase:'3aa725337737979ebd1fa6a4bb18b49d809e27fd',
 priorPilotSource:'415b2da2cfe162fa9bf8f55803977ba2b5dd9bb6',priorPilotPublisher:'3b80abcfa59c6cc73b28392e6f997d32df35a51c',
 priorProgressionSource:'3aa725337737979ebd1fa6a4bb18b49d809e27fd',priorProgressionReview:{runId:37886420411,runAttempt:1},
 baselineRun:37889948751,baselineAttempt:1,baselinePublisher:'edb11aecfeb634b62addba95e2898cfca0799a79',
 canonicalSource:'8d2c01eacd86fe9235a35e7ec5f624ba62c3b29e',canonicalPublisher:'39d5311d2620a632bb65194921de53add238c74d',
 baselineFiles:1378,baselineBytes:501388060,
 baselineArtifact:{id:11597902241,name:'github-pages',size_in_bytes:470256087,digest:'sha256:60ffe8dd4a0b1b233de361be7a01d7814739440143f80dcca9c7bfb3495ca179'},
 reviewPath:'.github/workflows/puzzle-progression-next-review.yml',controllerPath:'.github/workflows/publish-puzzle-progression-next.yml',
 baselinePath:'.github/workflows/publish-puzzle-progression.yml',
 publicBase:'https://amazin20.github.io/brainrot-portal/',version:'v54-puzzle-progression-next-v1',levels:[47,48,49],playableLevels:[43,44,45,46,47,48,49],namespace:'puzzle-progression-next/',
});
const sha=value=>createHash('sha256').update(value).digest('hex');
const write=(filename,value)=>{fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,JSON.stringify(value,null,2)+'\n');};
const read=filename=>JSON.parse(fs.readFileSync(filename));
function packageInventory(directory){
 const walk=parent=>fs.readdirSync(parent,{withFileTypes:true}).flatMap(entry=>{const filename=path.join(parent,entry.name);assert.equal(entry.isSymbolicLink(),false,'Unexpected package link');if(entry.isDirectory())return walk(filename);assert.equal(entry.isFile(),true,'A package contains only ordinary files');return [filename];});
 return walk(directory).sort().filter(file=>!['build-info.json','release-manifest.json'].includes(path.relative(directory,file))).map(file=>({path:path.relative(directory,file).split(path.sep).join('/'),bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))}));
}
const positive=value=>{const number=Number(value);assert.ok(Number.isSafeInteger(number)&&number>0,'An exact positive integer is required');return number;};
export function reviewedArtifactName(kind,runId,runAttempt){
 assert.ok(['build','cpu','baseline','production','review-proof'].includes(kind),'A known source-review artifact kind is required');return `${PINS.artifactStem}-${kind}-${positive(runId)}-${positive(runAttempt)}`;
}
const sourceIdentity=()=>{const source=process.env.BUILD_COMMIT||process.env.GITHUB_SHA;assert.match(source||'',/^[a-f0-9]{40}$/);return source;};
const reviewIdentity=()=>({runId:positive(process.env.SOURCE_REVIEW_RUN_ID||process.env.GITHUB_RUN_ID),runAttempt:positive(process.env.SOURCE_REVIEW_RUN_ATTEMPT||process.env.GITHUB_RUN_ATTEMPT)});
const currentIdentity=()=>({sourceCommit:sourceIdentity(),sourceReview:reviewIdentity()});
export function checkIdentity(report,identity){assert.equal(report.sourceCommit,identity.sourceCommit,'Proof must describe the exact candidate');assert.deepEqual(report.sourceReview,identity.sourceReview,'Proof must come from the same review attempt');}
function exactSource(){
 const source=sourceIdentity();
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source,'Check out the exact source');
 assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'','Review a committed candidate');
 assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=all','--','src','public','index.html','vite.config.js','package.json','package-lock.json'],{encoding:'utf8'}).trim(),'','Commit every build input before review');
 execFileSync('git',['merge-base','--is-ancestor',PINS.sourceBase,source]);
 const preserved=['src/game/LabPuzzlePilot43.js','src/game/LabPuzzlePilot43Art.js','src/game/LabPuzzlePilot43Journey.js',...['44','45','46'].flatMap(level=>['','Art','Journey'].map(suffix=>`src/game/LabPuzzleProgression${level}${suffix}.js`))];
 for(const file of preserved)
  assert.equal(execFileSync('git',['diff','--exit-code',PINS.sourceBase,source,'--',file],{encoding:'utf8'}).trim(),'','Retain accepted room runtime, art and journey byte for byte: '+file);
 return source;
}
function sourceProof(){const source=exactSource(),identity=currentIdentity();write('qa/puzzle-progression-next-source.json',{pass:true,...identity,sourceBase:PINS.sourceBase,retainedRooms43To46ByteUnchanged:true});console.log(`PROGRESSION_NEXT_SOURCE ${source} REVIEW ${identity.sourceReview.runId}/${identity.sourceReview.runAttempt}`);}

export function checkRecording(recording,identity,level,movie){
 checkIdentity(recording,identity);assert.equal(recording.level,level);assert.equal(recording.route?.level,level);assert.equal(recording.route?.pass,true);
 assert.equal(recording.continuous,true);assert.equal(recording.firstFrame?.visualFrame,0);assert.equal(recording.lastFrame?.state,'won');
 assert.equal(recording.route.resets,0);assert.equal(recording.route.respawns,0);assert.ok(Number.isSafeInteger(recording.route.teleports)&&recording.route.teleports>=0,'Real portal traversals must be counted');
 assert.equal(recording.pixelCheck?.allNonblank,true);assert.equal(recording.fps,4);assert.equal(recording.width,640);assert.equal(recording.height,360);
 assert.ok(recording.frameCount>20&&recording.durationSeconds>5);assert.equal(recording.sha256,sha(fs.readFileSync(movie)));assert.equal(recording.bytes,fs.statSync(movie).size);
 assert.ok(recording.milestones?.length>=3,'A complete journey needs observed milestones');
}
function attachRecording(directory,level){
 exactSource();assert.ok(PINS.levels.includes(level));const filename=path.join(directory,`level-${level}.json`),recording=read(filename),movie=path.join(directory,`level-${level}.mp4`);
 assert.equal(recording.sourceCommit,sourceIdentity());recording.sourceReview=reviewIdentity();recording.nativePackage=verifyBasePackage('dist');checkRecording(recording,currentIdentity(),level,movie);
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height,avg_frame_rate,nb_frames','-show_entries','format=duration,size','-of','json',movie],{encoding:'utf8',timeout:60000}));
 assert.equal(probe.streams.length,1);const stream=probe.streams[0];assert.equal(stream.codec_name,'h264');assert.equal(stream.width,640);assert.equal(stream.height,360);
 assert.equal(Number(stream.nb_frames),recording.frameCount);assert.equal(stream.avg_frame_rate,'4/1');assert.ok(Math.abs(Number(probe.format.duration)-recording.durationSeconds)<.1);
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-xerror','-i',movie,'-f','null','-'],{stdio:'inherit',timeout:300000});
 recording.decode={pass:true,method:'The entire final H.264 movie decoded by FFmpeg with -xerror',probe};write(filename,recording);
 console.log(`PROGRESSION_NEXT_MOVIE ${level} ${recording.sha256}`);
}
function cpuProof(logFile){
 exactSource();const log=fs.readFileSync(logFile,'utf8');const count=Number(log.match(/^# tests (\d+)\s*$/m)?.[1]),passed=Number(log.match(/^# pass (\d+)\s*$/m)?.[1]);
 assert.ok(count>=1569,'Run the complete retained active suite plus progression regressions');assert.equal(passed,count);assert.match(log,/^# fail 0\s*$/m);assert.match(log,/^# cancelled 0\s*$/m);assert.match(log,/^# skipped 0\s*$/m);
 write('qa/puzzle-progression-next-cpu/report.json',{pass:true,...currentIdentity(),testCount:count,passed,failed:0,logSha256:sha(log),allActiveGameTests:true});
}
export function checkMobileTouch(touch){
 assert.equal(touch?.pass,true);assert.equal(touch.emulated,true);assert.equal(touch.coarsePointer,true);assert.deepEqual(touch.viewport,{width:390,height:844});
 const movement=touch.movement;assert.ok(movement&&Array.isArray(movement.input)&&movement.input.length===2&&movement.input.every(Number.isFinite),'Observe native joystick input');assert.ok(movement.input[0]>.3,'Actual native joystick must have a positive horizontal input');
 for(const key of ['before','after'])assert.ok(Array.isArray(movement[key])&&movement[key].length===3&&movement[key].every(Number.isFinite),'Observe actual player positions');
 assert.ok(Number.isFinite(movement.distance)&&movement.distance>.1,'The native joystick must move the actual player');const distance=Math.hypot(...movement.after.map((value,index)=>value-movement.before[index]));assert.ok(Math.abs(distance-movement.distance)<1e-8,'Touch movement distance must describe the observed player positions');
 assert.ok(Number.isFinite(movement.horizontalDistance)&&movement.horizontalDistance>.1,'The native joystick must move the actual player horizontally');const horizontalDistance=Math.hypot(movement.after[0]-movement.before[0],movement.after[2]-movement.before[2]);assert.ok(Math.abs(horizontalDistance-movement.horizontalDistance)<1e-8,'Touch horizontal distance must describe the observed player XZ positions');assert.equal(movement.state,'playing');
 assert.ok(Number.isFinite(touch.jumpStart)&&Number.isFinite(touch.jumpPeak)&&touch.jumpPeak>touch.jumpStart+.2,'Native jump must raise the actual player');
 for(const key of ['sprintToggle','pauseResume','stickReleased'])assert.equal(touch[key],true,'Native touch action: '+key);
}
export function checkBrowser(report,identity,level){
 checkIdentity(report,identity);assert.equal(report.pass,true);assert.equal(report.level,level);assert.equal(report.route?.pass,true);assert.equal(report.route.level,level);
 assert.equal(report.route.resets,0);assert.equal(report.route.respawns,0);assert.ok(Number.isSafeInteger(report.route.teleports)&&report.route.teleports>=0);assert.equal(report.modelIdentity?.pass,true,'Actual model identities must be checked');
 const model=report.modelIdentity;assert.equal(report.route.sameCompanion,true,'Keep the original companion and body throughout the observed route');
 assert.ok(Number.isSafeInteger(report.route.frames)&&report.route.frames>0);assert.equal(model.observedFrames,report.route.frames,'Observe every actual route frame');
 assert.ok(Number.isSafeInteger(model.playerVertices)&&model.playerVertices>0);assert.ok(Number.isSafeInteger(model.bones)&&model.bones>0);
 assert.ok(typeof model.playerRootUuid==='string'&&model.playerRootUuid&&typeof model.cargoUuid==='string'&&model.cargoUuid);assert.ok(Number.isSafeInteger(model.cargoBodyId));
 assert.deepEqual(model.initialization,{resetRun:1,resetCargo:1,respawn:1},'One declared initialization before the first route frame');assert.equal(model.routeResets,0);assert.equal(model.routeRespawns,0);
 assert.equal(report.originalProgressUnchanged,true);assert.equal(report.previousProgressionUnchanged,true);checkMobileTouch(report.mobileTouchInput);assert.equal(report.pauseResumePassed,true);assert.equal(report.replayPassed,true);assert.equal(report.mobileControls,true,'Native mobile controls must remain usable');assert.equal(report.nextRoomPassed,true,'The native next-room control must advance to the expected room');assert.ok(report.pixels?.length>=3);
}
export function checkBuildInventory(info,rows,identity){
 assert.equal(info.commit,identity.sourceCommit);assert.deepEqual(info.sourceReview,identity.sourceReview);assert.equal(info.version,PINS.version);assert.deepEqual(rows,info.files,'The downloaded native build differs from its stamped inventory');assert.equal(sha(JSON.stringify(rows)),info.packageFilesSha256,'The downloaded native build inventory digest differs');
 return {pass:true,...identity,filesSha256:info.packageFilesSha256,files:rows};
}
function verifyBasePackage(directory){
 exactSource();const info=read(path.join(directory,'build-info.json')),rows=packageInventory(directory);assert.equal(rows.some(row=>row.path.startsWith('evidence/')),false,'Verify the shared tested build before adding evidence');const proof=checkBuildInventory(info,rows,currentIdentity());console.log(`PROGRESSION_NEXT_NATIVE_PACKAGE ${proof.filesSha256}`);return proof;
}
function bindBrowser(directory,level){
 const proof=verifyBasePackage('dist'),filename=path.join(directory,'report.json'),report=read(filename);checkBrowser(report,currentIdentity(),level);report.nativePackage=proof;write(filename,report);
}
function copyEvidence(directory){
 exactSource();const identity=currentIdentity(),cpu=read('qa/puzzle-progression-next-cpu/report.json'),basePackage=verifyBasePackage(directory);checkIdentity(cpu,identity);assert.equal(cpu.pass,true);assert.ok(cpu.testCount>=1569);
 const destination=path.join(directory,'evidence');assert.equal(fs.existsSync(destination),false,'Assemble exact review evidence only once');fs.mkdirSync(destination,{recursive:true});
 const native=[],recordings=[];
 for(const level of PINS.levels){
  const browserRoot=`qa/puzzle-progression-next-browser-${level}`,recordingRoot=`qa/puzzle-progression-next-walkthrough-${level}`;
  const browser=read(path.join(browserRoot,'report.json'));checkBrowser(browser,identity,level);assert.deepEqual(browser.nativePackage,basePackage,'Native review and final package must use the same tested code and asset bytes');
  fs.copyFileSync(path.join(browserRoot,'report.json'),path.join(destination,`browser-report-${level}.json`));
  for(const filename of fs.readdirSync(browserRoot))if(/\.(?:png|jpe?g)$/.test(filename)){
   assert.equal(fs.lstatSync(path.join(browserRoot,filename)).isFile(),true);fs.copyFileSync(path.join(browserRoot,filename),path.join(destination,`browser-${level}-${filename}`));
  }
  const recording=read(path.join(recordingRoot,`level-${level}.json`));checkRecording(recording,identity,level,path.join(recordingRoot,`level-${level}.mp4`));assert.equal(recording.decode?.pass,true);assert.deepEqual(recording.nativePackage,basePackage,'The recording must use the same tested code and asset bytes');assert.equal(recording.route.teleports,browser.route.teleports,'Movie and native review must execute the same observed portal journey');
  for(const filename of [`level-${level}.mp4`,`level-${level}.json`,`level-${level}.jpg`,`level-${level}-finish.jpg`]){
   assert.equal(fs.lstatSync(path.join(recordingRoot,filename)).isFile(),true);fs.copyFileSync(path.join(recordingRoot,filename),path.join(destination,filename));
  }
  native.push({level,pass:true,...identity,report:`evidence/browser-report-${level}.json`});recordings.push({level,pass:true,...identity,sha256:recording.sha256,decode:recording.decode});
 }
 write(path.join(destination,'review-receipt.json'),{pass:true,...identity,requiredLevels:PINS.levels,basePackage,cpu,native,recordings});
}
async function stamp(directory){
 const source=exactSource(),identity=currentIdentity();execFileSync(process.execPath,['scripts/stamp-build.mjs','v54-unified-campaign',directory],{stdio:'inherit',env:{...process.env,BUILD_COMMIT:source}});
 const {campaignSpec}=await import('../src/game/LabCampaignLevels.js');
 const rooms=PINS.levels.map(level=>{const spec=campaignSpec({chamberEdition:'foundation',puzzleProgression:true},level-1),retained=campaignSpec({chamberEdition:'foundation'},level-1);assert.ok(spec?.id&&spec.title);assert.notEqual(spec.id,retained.id);return {level,id:spec.id,title:spec.title,specSha256:sha(JSON.stringify(spec)),retainedId:retained.id};});
 const filename=path.join(directory,'build-info.json'),info=read(filename);
 Object.assign(info,{version:PINS.version,gameplayVersion:PINS.version,artVersion:PINS.version,status:'isolated-puzzle-progression',verified:false,sourceReview:identity.sourceReview,
  verificationScope:'Three opt-in puzzle rooms. Exact-source native routes and recordings cover levels 47–49. The accepted whole site, room 43 pilot and rooms 44–46 progression are retained byte for byte. Playable rooms 43–49 are available; fresh native proof covers 47–49 only. Full campaign or master specification acceptance is not claimed.'});
 info.features.puzzleProgression={levels:PINS.levels,reviewedLevels:PINS.levels,playableLevels:PINS.playableLevels,rooms,revision:'puzzle-progression-next-v1',optIn:true,query:'?edition=foundation&level=47&pilot=progression',storagePrefix:'brainrot-puzzle-progression-next-v1:'};
 const receiptFile=path.join(directory,'evidence/review-receipt.json');if(fs.existsSync(receiptFile)){
  const receipt=read(receiptFile);checkIdentity(receipt,identity);assert.equal(receipt.basePackage?.pass,true);checkIdentity(receipt.basePackage,identity);const baseRows=info.files.filter(row=>!row.path.startsWith('evidence/'));assert.deepEqual(baseRows,receipt.basePackage.files,'Final code and assets must match the one build consumed by every native review');assert.equal(sha(JSON.stringify(baseRows)),receipt.basePackage.filesSha256);info.features.puzzleProgression.testedGamePackageSha256=receipt.basePackage.filesSha256;
 }
 for(const room of rooms){const recordingFile=path.join(directory,`evidence/level-${room.level}.json`);if(fs.existsSync(recordingFile)){
  const recording=read(recordingFile);checkRecording(recording,identity,room.level,path.join(directory,`evidence/level-${room.level}.mp4`));
  room.currentWalkthrough={video:`evidence/level-${room.level}.mp4`,report:`evidence/level-${room.level}.json`,poster:`evidence/level-${room.level}.jpg`,...identity,sha256:recording.sha256,durationSeconds:recording.durationSeconds,fps:recording.fps,method:recording.method,continuous:true};
 }}
 info.videoCatalogue.policy='All earlier recordings retain their original source, versions and paths. New exact-source recordings demonstrate only opt-in progression rooms 47–49.';write(filename,info);
 console.log(`Stamped isolated progression ${source}`);
}
async function githubGet(resource){
 assert.ok(process.env.GITHUB_TOKEN,'GITHUB_TOKEN is required for read-only provenance guards');const response=await fetch(`https://api.github.com/repos/${PINS.repository}/${resource}`,{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(60000)});assert.ok(response.ok,`GitHub provenance HTTP ${response.status}: ${resource}`);return response.json();
}
async function pages(resource){const response=await fetch(PINS.publicBase+resource+'?progression-guard='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(60000)});assert.ok(response.ok,'The accepted public metadata is unavailable: '+resource);return response.json();}
export function checkBaselineArtifact(artifact,{requireUnexpired=false}={}){for(const [key,value]of Object.entries(PINS.baselineArtifact))assert.equal(artifact[key],value,'Accepted baseline artifact '+key);assert.equal(artifact.workflow_run.id,PINS.baselineRun);assert.equal(artifact.workflow_run.head_sha,PINS.baselinePublisher);if(requireUnexpired)assert.equal(artifact.expired,false,'Retain the accepted archive before its original artifact expires');}
async function retainBaseline(directory){
 exactSource();const artifact=await githubGet('actions/artifacts/'+PINS.baselineArtifact.id);checkBaselineArtifact(artifact,{requireUnexpired:true});
 fs.mkdirSync(directory,{recursive:true});const destination=path.join(directory,'baseline.zip');assert.equal(fs.existsSync(destination),false);
 const response=await fetch(`https://api.github.com/repos/${PINS.repository}/actions/artifacts/${artifact.id}/zip`,{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(600000)});assert.ok(response.ok,'Accepted baseline archive unavailable');
 const hash=createHash('sha256');let length=0;const meter=new Transform({transform(bytes,encoding,done){length+=bytes.length;assert.ok(length<=PINS.baselineArtifact.size_in_bytes,'Oversized accepted ZIP');hash.update(bytes);done(null,bytes);}});
 await pipeline(Readable.fromWeb(response.body),meter,fs.createWriteStream(destination,{flags:'wx'}));assert.equal(length,PINS.baselineArtifact.size_in_bytes);assert.equal('sha256:'+hash.digest('hex'),PINS.baselineArtifact.digest);
 write(path.join(directory,'retention-receipt.json'),{pass:true,...currentIdentity(),baselineRun:PINS.baselineRun,baselinePublisherCommit:PINS.baselinePublisher,artifact,archiveBytes:length,archiveSha256:PINS.baselineArtifact.digest.slice(7)});
}
async function downloadReviewed(directory){
 const identity=currentIdentity(),run=await githubGet('actions/runs/'+identity.sourceReview.runId);assert.equal(run.run_attempt,identity.sourceReview.runAttempt);assert.equal(run.head_sha,identity.sourceCommit);assert.equal(run.conclusion,'success');
 const result=await githubGet('actions/runs/'+run.id+'/artifacts?per_page=100');fs.mkdirSync(directory,{recursive:true});const downloaded=[];
 for(const [kind,stem]of [['production','production'],['baseline','retained-baseline']]){
  const name=reviewedArtifactName(kind,run.id,run.run_attempt),matching=result.artifacts.filter(row=>row.name===name);assert.equal(matching.length,1,'Exactly one current-attempt input is required: '+name);const artifact=matching[0];
  assert.equal(artifact.expired,false);assert.equal(artifact.workflow_run.id,run.id);assert.equal(artifact.workflow_run.head_sha,identity.sourceCommit);assert.match(artifact.digest||'',/^sha256:[a-f0-9]{64}$/);assert.ok(artifact.size_in_bytes>0&&artifact.size_in_bytes<700*1024**2);
  const response=await fetch(`https://api.github.com/repos/${PINS.repository}/actions/artifacts/${artifact.id}/zip`,{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(600000)});assert.ok(response.ok,'Reviewed ZIP download unavailable');
  const hash=createHash('sha256');let length=0;const meter=new Transform({transform(bytes,encoding,done){length+=bytes.length;assert.ok(length<=artifact.size_in_bytes,'Reviewed ZIP grew beyond the accepted metadata');hash.update(bytes);done(null,bytes);}});
  const filename=path.join(directory,stem+'.zip');await pipeline(Readable.fromWeb(response.body),meter,fs.createWriteStream(filename,{flags:'wx'}));assert.equal(length,artifact.size_in_bytes);assert.equal('sha256:'+hash.digest('hex'),artifact.digest,'The downloaded review artifact differs from the current GitHub checksum');downloaded.push({kind,filename,artifact});
  console.log(`Downloaded checksum-verified ${name}: ${length} bytes`);
 }
 const latest=await githubGet('actions/runs/'+run.id);assert.equal(latest.run_attempt,run.run_attempt);assert.equal(latest.conclusion,'success');write('proof/downloaded-review-inputs.json',{pass:true,...identity,inputs:downloaded});
}
export function validateReview(run,jobs,identity){
 assert.equal(run.id,identity.sourceReview.runId);assert.equal(run.run_attempt,identity.sourceReview.runAttempt);assert.equal(run.head_sha,identity.sourceCommit);assert.equal(run.head_branch,PINS.branch);
 assert.equal(run.path,PINS.reviewPath);assert.equal(run.event,'push');assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
 const names=['build','cpu','native (47)','native (48)','native (49)','package','gate'];assert.equal(jobs.length,names.length);assert.deepEqual(jobs.map(job=>job.name).sort(),names.sort());
 for(const job of jobs){assert.equal(job.run_id,run.id);assert.equal(job.run_attempt,run.run_attempt);assert.equal(job.head_sha,identity.sourceCommit);assert.equal(job.status,'completed');assert.equal(job.conclusion,'success');}
}
export function checkPublisherHeads(main,head,comparison,identity,publisher){
 assert.equal(main.object.sha,publisher,'A newer publisher exists; this stale controller must not deploy');assert.equal(head.object.sha,identity.sourceCommit,'A newer source exists; this stale candidate must not deploy');assert.ok(['ahead','identical'].includes(comparison.status),'Candidate must descend from the accepted pilot source');
}
export function checkControllerCommit(commit,revision){
 assert.equal(commit.sha,revision);assert.equal(commit.parents.length,1);assert.equal(commit.files.length,1,'The main controller must only change the new publication workflow');const file=commit.files[0],parent=commit.parents[0].sha;
 assert.equal(file.filename,PINS.controllerPath);assert.equal(file.status,parent===PINS.baselinePublisher?'added':'modified');return {commit:revision,parent,status:file.status};
}
async function reviewGuard(){
 const identity=currentIdentity(),run=await githubGet('actions/runs/'+identity.sourceReview.runId),jobsResult=await githubGet(`actions/runs/${run.id}/attempts/${identity.sourceReview.runAttempt}/jobs?per_page=100`);validateReview(run,jobsResult.jobs,identity);
 const logs=[];
 for(const job of jobsResult.jobs){
  const response=await fetch(`https://api.github.com/repos/${PINS.repository}/actions/jobs/${job.id}/logs`,{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(60000)});assert.ok(response.ok,'Current-attempt source review log unavailable');const log=await response.text();
  assert.ok(log.includes(`PROGRESSION_NEXT_SOURCE ${identity.sourceCommit} REVIEW ${run.id}/${run.run_attempt}`),'Every proof job must check out and verify the exact source: '+job.name);logs.push({id:job.id,name:job.name,sha256:sha(log)});
 }
 const artifactsResult=await githubGet('actions/runs/'+run.id+'/artifacts?per_page=100'),matching=artifactsResult.artifacts.filter(artifact=>artifact.name===reviewedArtifactName('production',run.id,run.run_attempt));
 assert.equal(matching.length,1,'Exactly one package from the accepted current attempt is required');const artifact=matching[0];assert.equal(artifact.expired,false);assert.equal(artifact.workflow_run.id,run.id);assert.equal(artifact.workflow_run.head_sha,identity.sourceCommit);assert.match(artifact.digest||'',/^sha256:[a-f0-9]{64}$/);
 const latest=await githubGet('actions/runs/'+run.id);assert.equal(latest.run_attempt,run.run_attempt,'Review reran during inspection');assert.equal(latest.conclusion,'success');
 write('proof/source-review-gate.json',{pass:true,...identity,run,jobs:jobsResult.jobs,jobLogHashes:logs,artifact});
}
export function checkPreservedMetadata(canonical,pilot,pilotStatus,progression,progressionStatus){
 assert.equal(canonical.commit,PINS.canonicalSource);assert.equal(canonical.publisherCommit,null);
 assert.equal(pilot.commit,PINS.priorPilotSource);assert.equal(pilot.publisherCommit,null);assert.equal(pilotStatus.sourceCommit,PINS.priorPilotSource);assert.equal(pilotStatus.publisherCommit,PINS.priorPilotPublisher);
 assert.equal(progression.commit,PINS.priorProgressionSource);assert.equal(progression.publisherCommit,null);assert.deepEqual(progression.sourceReview,PINS.priorProgressionReview);
 assert.equal(progressionStatus.sourceCommit,PINS.priorProgressionSource);assert.equal(progressionStatus.publisherCommit,PINS.baselinePublisher);assert.equal(progressionStatus.publicationRun,PINS.baselineRun);assert.deepEqual(progressionStatus.sourceReview,PINS.priorProgressionReview);
}
export function checkDeploymentRows(rows,publisher,publicationRun){
 const accepted=[];for(const row of rows){const ownLog=row.logUrl&&new RegExp('/actions/runs/'+positive(publicationRun)+'(?:/|$)').test(row.logUrl);if(row.sha===publisher&&ownLog)continue;
  assert.ok(row.state&&!['queued','pending','in_progress'].includes(row.state),'Another Pages publication is pending');if(['failure','error','inactive'].includes(row.state))continue;
  assert.equal(row.state,'success','Unknown Pages deployment state');assert.equal(row.sha,PINS.baselinePublisher,'A later Pages publication exists; preserve its full inventory before continuing');accepted.push(row);break;
 }assert.equal(accepted.length,1,'An active successful accepted Pages deployment is required');return accepted[0];
}
async function guard(phase){
 assert.ok(['prepare','deploy'].includes(phase));assert.equal(process.env.GITHUB_REPOSITORY,PINS.repository);assert.equal(process.env.GITHUB_REF,'refs/heads/main');
 const identity=currentIdentity(),publisher=process.env.PROGRESSION_PUBLISHER_COMMIT;assert.match(publisher||'',/^[a-f0-9]{40}$/);assert.equal(publisher,process.env.GITHUB_SHA,'The controller must be this exact main workflow commit');
 const [main,head,run,artifacts,deployments,comparison]=await Promise.all([githubGet('git/ref/heads/main'),githubGet('git/ref/heads/'+PINS.branch),githubGet('actions/runs/'+PINS.baselineRun),githubGet('actions/runs/'+PINS.baselineRun+'/artifacts?name=github-pages&per_page=100'),githubGet('deployments?environment=github-pages&per_page=100'),githubGet('compare/'+PINS.sourceBase+'...'+identity.sourceCommit)]);
 checkPublisherHeads(main,head,comparison,identity,publisher);
 const chain=[];for(let revision=publisher,depth=0;revision!==PINS.baselinePublisher;depth++){
  assert.ok(depth<8,'Controller chain must reach the accepted publisher within eight commits');const commit=await githubGet('commits/'+revision),row=checkControllerCommit(commit,revision);chain.push(row);revision=row.parent;
 }
 assert.equal(run.head_sha,PINS.baselinePublisher);assert.equal(run.head_branch,'main');assert.equal(run.run_attempt,PINS.baselineAttempt);assert.equal(run.path,PINS.baselinePath);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
 const matching=artifacts.artifacts.filter(row=>row.name==='github-pages');assert.equal(matching.length,1);const artifact=matching[0];checkBaselineArtifact(artifact);
 // The original Pages artifact may expire after the review retained its exact
 // ZIP. Its fixed checksum is checked again before any TAR is extracted.
 const inspected=[];
 for(const deployment of [...deployments].sort((a,b)=>b.id-a.id)){
  const statuses=await githubGet('deployments/'+deployment.id+'/statuses?per_page=100'),status=[...statuses].sort((a,b)=>b.id-a.id)[0];const row={id:deployment.id,sha:deployment.sha,state:status?.state||null,logUrl:status?.log_url||null,statusId:status?.id||null};inspected.push(row);
  const ownLog=row.logUrl&&new RegExp('/actions/runs/'+positive(process.env.GITHUB_RUN_ID)+'(?:/|$)').test(row.logUrl);if(row.sha===publisher&&ownLog)continue;
  if(row.state==='success')break;
 }
 const acceptedDeployment=checkDeploymentRows(inspected,publisher,process.env.GITHUB_RUN_ID);
 const metadata=await Promise.all([pages('build-info.json'),pages('puzzle-pilot/build-info.json'),pages('puzzle-pilot/preview-status.json'),pages('puzzle-progression/build-info.json'),pages('puzzle-progression/preview-status.json')]);checkPreservedMetadata(...metadata);
 await reviewGuard();
 if(phase==='deploy'){
  const proof=read('proof/manifest.json');checkIdentity(proof,identity);assert.equal(proof.publisherCommit,publisher);assert.equal(proof.baselinePublisherCommit,PINS.baselinePublisher);assert.equal(proof.baselinePublicationRun,PINS.baselineRun);assert.equal(proof.mainSiteUnchanged,true);assert.equal(proof.preservedFiles.length,PINS.baselineFiles);assert.equal(proof.preservedBytes,PINS.baselineBytes);
  const preflight=read('proof/predeploy-public-bytes.json');checkIdentity(preflight,identity);assert.equal(preflight.pass,true);assert.equal(preflight.publisherCommit,publisher);assert.equal(preflight.checked,PINS.baselineFiles);assert.equal(preflight.bytes,PINS.baselineBytes);
 }
 write('proof/github-guard-'+phase+'.json',{pass:true,phase,...identity,publisherCommit:publisher,baselineRun:PINS.baselineRun,baselinePublisherCommit:PINS.baselinePublisher,artifact,controllerChain:chain,acceptedDeployment,inspectedDeployments:inspected,checkedAt:new Date().toISOString()});
 console.log('Exact source, review attempt and latest publisher checked: '+phase);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const [command,arg,level]=process.argv.slice(2);
 if(command==='source')sourceProof();else if(command==='stamp')await stamp(arg||'dist');else if(command==='evidence')copyEvidence(arg||'dist');else if(command==='package')verifyBasePackage(arg||'dist');else if(command==='bind-browser')bindBrowser(arg,Number(level));else if(command==='recording')attachRecording(arg,Number(level));else if(command==='cpu')cpuProof(arg);else if(command==='review')await reviewGuard();else if(command==='retain-baseline')await retainBaseline(arg||'baseline-retained');else if(command==='download-reviewed')await downloadReviewed(arg||'review-inputs');else if(command==='guard')await guard(arg);else throw Error('Usage: publish-puzzle-progression-next.mjs source | stamp|evidence|package [dist] | bind-browser DIR LEVEL | recording DIR LEVEL | cpu LOG | review | retain-baseline [DIR] | download-reviewed [DIR] | guard prepare|deploy');
}
