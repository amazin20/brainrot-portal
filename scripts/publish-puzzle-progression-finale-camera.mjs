/** Exact-source review receipts and publication guards for the isolated finale rooms 50–51. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

// Frozen corrective source scope, test floor and evidence contracts; actual CI must pass.
export const SOURCE_FREEZE_READY=true;
export const PINS=Object.freeze({
 repository:'amazin20/brainrot-portal',artifactStem:'puzzle-progression-finale-camera',branch:'upgrade/finale-camera-transition-20261011',
 sourceBase:'65207e98b463c03fa7614e04c2865aa471a37f7e',minimumTests:1678,
 priorPilotSource:'415b2da2cfe162fa9bf8f55803977ba2b5dd9bb6',priorPilotPublisher:'3b80abcfa59c6cc73b28392e6f997d32df35a51c',
 priorProgressionSource:'3aa725337737979ebd1fa6a4bb18b49d809e27fd',priorProgressionReview:{runId:37886420411,runAttempt:1},
 priorProgressionPublisher:'edb11aecfeb634b62addba95e2898cfca0799a79',priorProgressionPublicationRun:37889948751,
 priorNextSource:'b4ca1630ec41f4a93877233ac35b7e9c7e04a19f',priorNextReview:{runId:37918564404,runAttempt:1},
 priorNextPublisher:'0a22c3b1a1456cccccca3759c336ed8a22fad857',priorNextPublicationRun:37923054511,
 priorFinaleSource:'65207e98b463c03fa7614e04c2865aa471a37f7e',priorFinaleReview:{runId:38089244970,runAttempt:1},
 priorFinalePublisher:'372e483111542dc4f505e30356fb0999bb5a6f15',priorFinalePublicationRun:38093246009,
 baselineRun:38093246009,baselineAttempt:1,baselinePublisher:'372e483111542dc4f505e30356fb0999bb5a6f15',
 canonicalSource:'8d2c01eacd86fe9235a35e7ec5f624ba62c3b29e',canonicalPublisher:'39d5311d2620a632bb65194921de53add238c74d',
 baselineFiles:1623,baselineBytes:531150862,preservedFiles:1507,preservedBytes:518160875,priorFinaleFiles:116,priorFinaleBytes:12989987,
 baselineArtifact:{id:11685320033,name:'github-pages',size_in_bytes:494852251,digest:'sha256:2001c3acd5b0a96a63bce484209ebc68b7639c6eef5d31a27b98767345fe76fc'},
 reviewPath:'.github/workflows/puzzle-progression-finale-camera-review.yml',controllerPath:'.github/workflows/publish-puzzle-progression-finale.yml',
 baselinePath:'.github/workflows/publish-puzzle-progression-finale.yml',
 publicBase:'https://amazin20.github.io/brainrot-portal/',version:'v54-puzzle-progression-finale-v1',levels:[50,51],playableLevels:[43,44,45,46,47,48,49,50,51],namespace:'puzzle-progression-finale/',
 revision:'puzzle-progression-finale-v1',query:'?edition=foundation&level=50&pilot=progression',storagePrefix:'brainrot-puzzle-progression-finale-v1:',
});
export const SOURCE_CHANGES=Object.freeze([
 ...['src/game/LabCamera.js','tests/lab-camera-finale-framing.test.js','src/game/LabPuzzleProgression50BeamJourney.js'].map(path=>({path,status:'M'})),
 ...['scripts/qa-puzzle-progression-finale-camera-browser.mjs','scripts/record-finale-camera-walkthrough.mjs','.github/workflows/puzzle-progression-finale-camera-review.yml','scripts/publish-puzzle-progression-finale-camera.mjs','scripts/publish-puzzle-progression-finale-camera.py','scripts/test-publish-puzzle-progression-finale-camera.mjs','scripts/test-publish-puzzle-progression-finale-camera.py','docs/puzzle-progression-finale-camera-publication.md'].map(path=>({path,status:'A'})),
].map(row=>Object.freeze({...row,mode:'100644',type:'blob'})));
export function checkSourceChanges(changes){
 assert.ok(Array.isArray(changes));assert.equal(changes.length,SOURCE_CHANGES.length,'The finale follow-up must change exactly the frozen reviewed paths');
 const sorted=changes.map(row=>({path:row.path,status:row.status,mode:row.mode,type:row.type})).sort((a,b)=>a.path.localeCompare(b.path)),expected=[...SOURCE_CHANGES].sort((a,b)=>a.path.localeCompare(b.path));
 assert.deepEqual(sorted,expected,'Only the frozen ordinary follow-up paths are allowed against the accepted finale source');
}
const sha=value=>createHash('sha256').update(value).digest('hex');
const write=(filename,value)=>{fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,JSON.stringify(value,null,2)+'\n');};
const read=filename=>JSON.parse(fs.readFileSync(filename));
function packageInventory(directory){
 const walk=parent=>fs.readdirSync(parent,{withFileTypes:true}).flatMap(entry=>{const filename=path.join(parent,entry.name);assert.equal(entry.isSymbolicLink(),false,'Unexpected package link');if(entry.isDirectory())return walk(filename);assert.equal(entry.isFile(),true,'A package contains only ordinary files');return [filename];});
 return walk(directory).sort().filter(file=>!['build-info.json','release-manifest.json'].includes(path.relative(directory,file))).map(file=>({path:path.relative(directory,file).split(path.sep).join('/'),bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))}));
}
const positive=value=>{assert.ok(typeof value==='number'||(typeof value==='string'&&/^[1-9][0-9]*$/.test(value)),'An exact numeric identifier is required');const number=Number(value);assert.ok(Number.isSafeInteger(number)&&number>0,'An exact positive integer is required');return number;};
export function reviewedArtifactName(kind,runId,runAttempt){
 assert.ok(['build','cpu','baseline','production','review-proof'].includes(kind),'A known source-review artifact kind is required');return `${PINS.artifactStem}-${kind}-${positive(runId)}-${positive(runAttempt)}`;
}
const sourceIdentity=()=>{const source=process.env.BUILD_COMMIT||process.env.GITHUB_SHA;assert.match(source||'',/^[a-f0-9]{40}$/);return source;};
const reviewIdentity=()=>({runId:positive(process.env.SOURCE_REVIEW_RUN_ID||process.env.GITHUB_RUN_ID),runAttempt:positive(process.env.SOURCE_REVIEW_RUN_ATTEMPT||process.env.GITHUB_RUN_ATTEMPT)});
const currentIdentity=()=>({sourceCommit:sourceIdentity(),sourceReview:reviewIdentity()});
export function checkIdentity(report,identity){assert.equal(report.sourceCommit,identity.sourceCommit,'Proof must describe the exact candidate');assert.deepEqual(report.sourceReview,identity.sourceReview,'Proof must come from the same review attempt');}
export const CAMERA_TARGET_REGION=Object.freeze({center:[9.926224685,6.28,-10.4976406],halfExtents:[1.15,1.25,1.15],teleports:3});
const vertexProjectionSource='every live skinned original-player vertex at this actual native visual sample';
const nativeCameraScope='Every active native visual step inside the fixed physical east-gallery falling/retraction region after the third transport; not all portal, route, render, movie frames or physical devices.';
const movieCameraScope='Every actual encoded sample at the declared capture rate uses all original live skinned vertices. Closure is gated only in the fixed east-gallery region; unrecorded render frames, occlusion, devices and full camera acceptance are separate.';
const cameraVector=value=>assert.ok(Array.isArray(value)&&value.length===3&&value.every(Number.isFinite),'Actual finite camera/player positions are required');
const inCameraGallery=sample=>sample.teleports===CAMERA_TARGET_REGION.teleports&&CAMERA_TARGET_REGION.center.every((c,i)=>Math.abs(sample.player[i]-c)<=CAMERA_TARGET_REGION.halfExtents[i]);
export function checkBodyVertexProjection(projection){
 assert.equal(projection?.vertices,96753,'Measure all original live vertices, not a bounds proxy');assert.equal(projection.source,vertexProjectionSource);
 for(const key of ['minX','maxX','minY','maxY','minDepth'])assert.ok(Number.isFinite(projection[key]),'Finite live vertex projection '+key);
 assert.ok(projection.minX<=projection.maxX&&projection.minY<=projection.maxY);
 for(const key of ['outsideLensCount','behindCount'])assert.ok(Number.isSafeInteger(projection[key])&&projection[key]>=0&&projection[key]<=96753,'Actual vertex count '+key);
 assert.ok(projection.behindCount<=projection.outsideLensCount);assert.equal(projection.behindCount===0,projection.minDepth>0,'Behind count and actual camera depth disagree');
 const inside=projection.outsideLensCount===0;assert.equal(projection.insideLens,inside,'Recompute inclusion from live vertex count');
 if(inside)assert.ok(projection.minX>=-1&&projection.maxX<=1&&projection.minY>=-1&&projection.maxY<=1,'An included body cannot extend outside the lens');
 return inside;
}
function checkCameraSample(sample,route){
 assert.ok(sample&&typeof sample==='object');cameraVector(sample.player);cameraVector(sample.camera);
 assert.ok(Number.isFinite(sample.cameraFov)&&sample.cameraFov>0&&sample.cameraFov<180);
 assert.ok(Number.isSafeInteger(sample.teleports)&&sample.teleports>=0&&sample.teleports<=route.teleports,'Sample portal context must belong to the actual route');
 return checkBodyVertexProjection(sample.bodyVertexProjection);
}
export function checkCameraTransition(review,route,level){
 if(level===51){assert.deepEqual(review,{notApplicable:true,level:51});return;}
 assert.equal(level,50);assert.equal(review?.target,'room50-third-portal-east-gallery');assert.deepEqual(review.targetRegion,CAMERA_TARGET_REGION);assert.equal(review.scope,nativeCameraScope);
 assert.equal(review.measuredVerticesPerSample,96753);assert.ok(Array.isArray(review.samples)&&review.samples.length>=3,'Actual target-region native samples cannot be empty');
 assert.equal(review.sampleCount,review.samples.length);assert.equal(review.targetRegionSampleCount,review.samples.length);
 let previous=0;const outside=[];
 for(const sample of review.samples){
  assert.ok(Number.isSafeInteger(sample.routeFrame)&&sample.routeFrame>previous&&sample.routeFrame<=route.frames,'Native samples must use increasing actual route frames');previous=sample.routeFrame;
  const inside=checkCameraSample(sample,route);assert.equal(inCameraGallery(sample),true,'A native target sample must lie in the exact physical gallery region');if(!inside)outside.push(sample.routeFrame);
 }
 assert.deepEqual(review.outsideVertexSamples,outside);assert.deepEqual(review.targetRegionOutsideSamples,outside);assert.equal(review.pass,outside.length===0);assert.equal(review.pass,true,'The bounded actual gallery body must fit within the lens');
}
export function checkCameraMovie(review,recording,level){
 assert.ok(Number.isSafeInteger(recording.frameCount)&&recording.frameCount>20);assert.equal(recording.fps,4);
 assert.ok(PINS.levels.includes(level));assert.equal(review?.scope,movieCameraScope);assert.deepEqual(review.targetRegion,CAMERA_TARGET_REGION);assert.equal(review.measuredVerticesPerSample,96753);assert.equal(review.bones,15);
 assert.ok(Array.isArray(review.samples));assert.equal(review.sampleCount,recording.frameCount);assert.equal(review.samples.length,recording.frameCount,'Measure every actual encoded movie sample');assert.equal(review.galleryApplicable,level===50);
 const outside=[],gallery=[],galleryOutside=[];
 for(const [index,sample]of review.samples.entries()){
  assert.equal(sample.encodedFrame,index,'Encoded samples must be contiguous');assert.equal(sample.visualFrame,index*(60/recording.fps),'Each encoded sample must bind to its actual visual frame');
  const inside=checkCameraSample(sample,recording.route);if(!inside)outside.push(sample.visualFrame);
  if(level===50&&inCameraGallery(sample)){gallery.push(sample.visualFrame);if(!inside)galleryOutside.push(sample.visualFrame);}
 }
 assert.deepEqual(review.outsideSamples,outside);assert.equal(review.allSamplesInside,outside.length===0,'Recompute all-sample diagnostic; it is not global camera acceptance');
 assert.equal(review.galleryTargetSampleCount,gallery.length);assert.deepEqual(review.galleryTargetOutsideSamples,galleryOutside);
 const pass=level!==50||(gallery.length>=1&&galleryOutside.length===0);assert.equal(review.pass,pass);assert.equal(pass,true,'At least one actual movie sample must prove the bounded gallery body fits');
}
function exactSource(){
 assert.equal(SOURCE_FREEZE_READY,true,'The camera release source, active-test floor and evidence contracts are not frozen');
 const source=sourceIdentity();
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source,'Check out the exact source');
 assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'','Review a committed candidate');
 assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=all','--','src','public','index.html','vite.config.js','package.json','package-lock.json'],{encoding:'utf8'}).trim(),'','Commit every build input before review');
 execFileSync('git',['merge-base','--is-ancestor',PINS.sourceBase,source]);
 const changed=execFileSync('git',['diff','--no-renames','--name-status','-z',PINS.sourceBase,source],{encoding:'utf8'}).split('\0');assert.equal(changed.pop(),'');assert.equal(changed.length%2,0);const rows=[];
 for(let index=0;index<changed.length;index+=2){const status=changed[index],file=changed[index+1],entry=execFileSync('git',['ls-tree','-z',source,'--',file],{encoding:'utf8'}),match=entry.match(/^([0-9]{6}) ([a-z]+) [a-f0-9]{40}\t([^\0]+)\0$/);if(match)assert.equal(match[3],file);rows.push({path:file,status,mode:match?.[1]||null,type:match?.[2]||null});}
 checkSourceChanges(rows);
 const preserved=['src/game/LabPuzzlePilot43.js','src/game/LabPuzzlePilot43Art.js','src/game/LabPuzzlePilot43Journey.js',...['44','45','46','47','48','49'].flatMap(level=>['','Art','Journey'].map(suffix=>`src/game/LabPuzzleProgression${level}${suffix}.js`)),
  '.github/workflows/publish-puzzle-progression.yml','.github/workflows/puzzle-progression-review.yml','.github/workflows/puzzle-progression-next-review.yml','docs/puzzle-progression-next-publication.md',
  '.github/workflows/puzzle-progression-finale-review.yml','docs/puzzle-progression-finale-publication.md','scripts/qa-puzzle-progression-finale-browser.mjs','scripts/record-foundation-walkthrough.mjs',
  ...['','-next','-finale'].flatMap(suffix=>['scripts/publish-puzzle-progression'+suffix+'.mjs','scripts/publish-puzzle-progression'+suffix+'.py','scripts/test-publish-puzzle-progression'+suffix+'.mjs','scripts/test-publish-puzzle-progression'+suffix+'.py'])];
 for(const file of preserved)
  assert.equal(execFileSync('git',['diff','--exit-code',PINS.sourceBase,source,'--',file],{encoding:'utf8'}).trim(),'','Retain accepted room runtime, art and journey byte for byte: '+file);
 return source;
}
function sourceProof(){const source=exactSource(),identity=currentIdentity();write('qa/puzzle-progression-finale-camera-source.json',{pass:true,...identity,sourceBase:PINS.sourceBase,exactReviewedSourceDiff:true,sourceChanges:SOURCE_CHANGES,retainedRooms43To49ByteUnchanged:true,retainedPreviousPublicationPipelinesByteUnchanged:true});console.log(`PROGRESSION_FINALE_SOURCE ${source} REVIEW ${identity.sourceReview.runId}/${identity.sourceReview.runAttempt}`);}

export function checkRecording(recording,identity,level,movie){
 checkIdentity(recording,identity);assert.equal(recording.level,level);assert.equal(recording.route?.level,level);assert.equal(recording.route?.pass,true);
 assert.equal(recording.continuous,true);assert.equal(recording.firstFrame?.visualFrame,0);assert.equal(recording.lastFrame?.state,'won');
 assert.equal(recording.route.resets,0);assert.equal(recording.route.respawns,0);assert.ok(Number.isSafeInteger(recording.route.teleports)&&recording.route.teleports>=0,'Real portal traversals must be counted');
 assert.equal(recording.pixelCheck?.allNonblank,true);assert.equal(recording.fps,4);assert.equal(recording.width,640);assert.equal(recording.height,360);
 assert.ok(recording.frameCount>20&&recording.durationSeconds>5);assert.equal(recording.sha256,sha(fs.readFileSync(movie)));assert.equal(recording.bytes,fs.statSync(movie).size);
 assert.ok(recording.milestones?.length>=3,'A complete journey needs observed milestones');
 checkCameraMovie(recording.cameraSampleReview,recording,level);
}
function attachRecording(directory,level){
 exactSource();assert.ok(PINS.levels.includes(level));const filename=path.join(directory,`level-${level}.json`),recording=read(filename),movie=path.join(directory,`level-${level}.mp4`);
 assert.equal(recording.sourceCommit,sourceIdentity());recording.sourceReview=reviewIdentity();recording.nativePackage=verifyBasePackage('dist');checkRecording(recording,currentIdentity(),level,movie);
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height,avg_frame_rate,nb_frames','-show_entries','format=duration,size','-of','json',movie],{encoding:'utf8',timeout:60000}));
 assert.equal(probe.streams.length,1);const stream=probe.streams[0];assert.equal(stream.codec_name,'h264');assert.equal(stream.width,640);assert.equal(stream.height,360);
 assert.equal(Number(stream.nb_frames),recording.frameCount);assert.equal(stream.avg_frame_rate,'4/1');assert.ok(Math.abs(Number(probe.format.duration)-recording.durationSeconds)<.1);
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-xerror','-i',movie,'-f','null','-'],{stdio:'inherit',timeout:300000});
 recording.decode={pass:true,method:'The entire final H.264 movie decoded by FFmpeg with -xerror',probe};write(filename,recording);
 console.log(`PROGRESSION_FINALE_MOVIE ${level} ${recording.sha256}`);
}
export function checkCpuLog(log){
 assert.equal(typeof log,'string');const summary={};
 for(const field of ['tests','pass','fail','cancelled','skipped','todo']){const matches=[...log.matchAll(new RegExp('^# '+field+' ([0-9]+)\\s*$','gm'))];assert.equal(matches.length,1,'Exactly one actual TAP total is required: '+field);const value=Number(matches[0][1]);assert.ok(Number.isSafeInteger(value)&&value>=0,'A TAP total must be a safe integer');summary[field]=value;}
 assert.ok(summary.tests>=PINS.minimumTests,'Run the complete retained active suite plus follow-up regressions');assert.equal(summary.pass,summary.tests);for(const field of ['fail','cancelled','skipped','todo'])assert.equal(summary[field],0,'The complete active suite must pass without '+field);
 return {testCount:summary.tests,passed:summary.pass,failed:summary.fail,cancelled:summary.cancelled,skipped:summary.skipped,todo:summary.todo,logSha256:sha(log),allActiveGameTests:true};
}
function cpuProof(logFile){
 exactSource();const log=fs.readFileSync(logFile,'utf8');write('qa/puzzle-progression-finale-cpu/report.json',{pass:true,...currentIdentity(),...checkCpuLog(log)});
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
 assert.equal(model.playerVertices,96753,'Keep every vertex of the original player model');assert.equal(model.bones,15,'Keep the original player skeleton');
 assert.ok(typeof model.playerRootUuid==='string'&&model.playerRootUuid&&typeof model.cargoUuid==='string'&&model.cargoUuid);assert.ok(Number.isSafeInteger(model.cargoBodyId));
 assert.deepEqual(model.initialization,{resetRun:1,resetCargo:1,respawn:1},'One declared initialization before the first route frame');assert.equal(model.routeResets,0);assert.equal(model.routeRespawns,0);
 assert.equal(report.originalProgressUnchanged,true);assert.equal(report.previousPilotProgressUnchanged,true);assert.equal(report.previousProgressionUnchanged,true);assert.equal(report.previousProgressionNextUnchanged,true);checkMobileTouch(report.mobileTouchInput);assert.equal(report.pauseResumePassed,true);assert.equal(report.replayPassed,true);assert.equal(report.mobileControls,true,'Native mobile controls must remain usable');assert.equal(report.nextRoomPassed,true,'The native next-room control must advance to the expected room');assert.ok(report.pixels?.length>=3);
 checkCameraTransition(report.cameraTransitionReview,report.route,level);
}
export function checkBuildInventory(info,rows,identity){
 assert.equal(info.commit,identity.sourceCommit);assert.deepEqual(info.sourceReview,identity.sourceReview);assert.equal(info.version,PINS.version);const scope=info.features?.puzzleProgression;assert.equal(scope?.optIn,true);assert.deepEqual(scope.levels,PINS.levels);assert.deepEqual(scope.reviewedLevels,PINS.levels);assert.deepEqual(scope.playableLevels,PINS.playableLevels);for(const field of ['revision','query','storagePrefix'])assert.equal(scope[field],PINS[field],'The exact finale metadata '+field+' must match');assert.deepEqual(rows,info.files,'The downloaded native build differs from its stamped inventory');assert.equal(sha(JSON.stringify(rows)),info.packageFilesSha256,'The downloaded native build inventory digest differs');
 return {pass:true,...identity,filesSha256:info.packageFilesSha256,files:rows};
}
function verifyBasePackage(directory){
 exactSource();const info=read(path.join(directory,'build-info.json')),rows=packageInventory(directory);assert.equal(rows.some(row=>row.path.startsWith('evidence/')),false,'Verify the shared tested build before adding evidence');const proof=checkBuildInventory(info,rows,currentIdentity());console.log(`PROGRESSION_FINALE_NATIVE_PACKAGE ${proof.filesSha256}`);return proof;
}
function bindBrowser(directory,level){
 const proof=verifyBasePackage('dist'),filename=path.join(directory,'report.json'),report=read(filename);checkBrowser(report,currentIdentity(),level);report.nativePackage=proof;write(filename,report);
}
function copyEvidence(directory){
 exactSource();const identity=currentIdentity(),cpu=read('qa/puzzle-progression-finale-cpu/report.json'),basePackage=verifyBasePackage(directory);checkIdentity(cpu,identity);assert.equal(cpu.pass,true);assert.ok(Number.isSafeInteger(cpu.testCount)&&cpu.testCount>=PINS.minimumTests);assert.equal(cpu.passed,cpu.testCount);for(const field of ['failed','cancelled','skipped','todo'])assert.equal(cpu[field],0);assert.equal(cpu.allActiveGameTests,true);assert.match(cpu.logSha256||'',/^[a-f0-9]{64}$/);
 const destination=path.join(directory,'evidence');assert.equal(fs.existsSync(destination),false,'Assemble exact review evidence only once');fs.mkdirSync(destination,{recursive:true});
 const native=[],recordings=[];
 for(const level of PINS.levels){
  const browserRoot=`qa/puzzle-progression-finale-browser-${level}`,recordingRoot=`qa/puzzle-progression-finale-walkthrough-${level}`;
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
  verificationScope:'Two opt-in finale puzzle rooms. Exact-source native routes and recordings cover levels 50–51. The accepted whole site, room 43 pilot and rooms 44–49 progression are retained byte for byte. Playable rooms 43–51 are available; fresh native proof covers 50–51 only. Full campaign or master specification acceptance is not claimed.'});
 info.features.puzzleProgression={levels:PINS.levels,reviewedLevels:PINS.levels,playableLevels:PINS.playableLevels,rooms,revision:PINS.revision,optIn:true,query:PINS.query,storagePrefix:PINS.storagePrefix};
 const receiptFile=path.join(directory,'evidence/review-receipt.json');if(fs.existsSync(receiptFile)){
  const receipt=read(receiptFile);checkIdentity(receipt,identity);assert.equal(receipt.basePackage?.pass,true);checkIdentity(receipt.basePackage,identity);const baseRows=info.files.filter(row=>!row.path.startsWith('evidence/'));assert.deepEqual(baseRows,receipt.basePackage.files,'Final code and assets must match the one build consumed by every native review');assert.equal(sha(JSON.stringify(baseRows)),receipt.basePackage.filesSha256);info.features.puzzleProgression.testedGamePackageSha256=receipt.basePackage.filesSha256;
 }
 for(const room of rooms){const recordingFile=path.join(directory,`evidence/level-${room.level}.json`);if(fs.existsSync(recordingFile)){
  const recording=read(recordingFile);checkRecording(recording,identity,room.level,path.join(directory,`evidence/level-${room.level}.mp4`));
  room.currentWalkthrough={video:`evidence/level-${room.level}.mp4`,report:`evidence/level-${room.level}.json`,poster:`evidence/level-${room.level}.jpg`,...identity,sha256:recording.sha256,durationSeconds:recording.durationSeconds,fps:recording.fps,method:recording.method,continuous:true};
 }}
 info.videoCatalogue.policy='All earlier recordings retain their original source, versions and paths. New exact-source recordings demonstrate only opt-in progression rooms 50–51.';write(filename,info);
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
 const names=['build','cpu','native (50)','native (51)','package','gate'];assert.equal(jobs.length,names.length);assert.deepEqual(jobs.map(job=>job.name).sort(),names.sort());
 for(const job of jobs){assert.equal(job.run_id,run.id);assert.equal(job.run_attempt,run.run_attempt);assert.equal(job.head_sha,identity.sourceCommit);assert.equal(job.status,'completed');assert.equal(job.conclusion,'success');}
}
export function checkPublisherHeads(main,head,comparison,identity,publisher){
 assert.equal(main.object.sha,publisher,'A newer publisher exists; this stale controller must not deploy');assert.equal(head.object.sha,identity.sourceCommit,'A newer source exists; this stale candidate must not deploy');assert.ok(['ahead','identical'].includes(comparison.status),'Candidate must descend from the accepted finale source');
}
export function checkControllerCommit(commit,revision){
 assert.equal(commit.sha,revision);assert.equal(commit.parents.length,1);assert.equal(commit.files.length,1,'The main controller must only change the new publication workflow');const file=commit.files[0],parent=commit.parents[0].sha;
 assert.equal(file.filename,PINS.controllerPath);assert.equal(file.status,'modified','Only the existing isolated publication controller may be modified');assert.equal(parent,PINS.baselinePublisher,'The follow-up controller must directly descend from the accepted main publisher');return {commit:revision,parent,status:file.status};
}
async function reviewGuard(){
 const identity=currentIdentity(),run=await githubGet('actions/runs/'+identity.sourceReview.runId),jobsResult=await githubGet(`actions/runs/${run.id}/attempts/${identity.sourceReview.runAttempt}/jobs?per_page=100`);validateReview(run,jobsResult.jobs,identity);
 const logs=[];
 for(const job of jobsResult.jobs){
  const response=await fetch(`https://api.github.com/repos/${PINS.repository}/actions/jobs/${job.id}/logs`,{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(60000)});assert.ok(response.ok,'Current-attempt source review log unavailable');const log=await response.text();
  assert.ok(log.includes(`PROGRESSION_FINALE_SOURCE ${identity.sourceCommit} REVIEW ${run.id}/${run.run_attempt}`),'Every proof job must check out and verify the exact source: '+job.name);logs.push({id:job.id,name:job.name,sha256:sha(log)});
 }
 const artifactsResult=await githubGet('actions/runs/'+run.id+'/artifacts?per_page=100'),matching=artifactsResult.artifacts.filter(artifact=>artifact.name===reviewedArtifactName('production',run.id,run.run_attempt));
 assert.equal(matching.length,1,'Exactly one package from the accepted current attempt is required');const artifact=matching[0];assert.equal(artifact.expired,false);assert.equal(artifact.workflow_run.id,run.id);assert.equal(artifact.workflow_run.head_sha,identity.sourceCommit);assert.match(artifact.digest||'',/^sha256:[a-f0-9]{64}$/);
 const latest=await githubGet('actions/runs/'+run.id);validateReview(latest,jobsResult.jobs,identity);
 write('proof/source-review-gate.json',{pass:true,...identity,run,jobs:jobsResult.jobs,jobLogHashes:logs,artifact});
}
export function checkPriorFinaleMetadata(metadata,status){
 assert.equal(metadata.commit,PINS.priorFinaleSource);assert.equal(metadata.publisherCommit,null);assert.deepEqual(metadata.sourceReview,PINS.priorFinaleReview);assert.equal(metadata.version,PINS.version);
 const scope=metadata.features?.puzzleProgression;assert.equal(scope?.optIn,true);for(const field of ['levels','reviewedLevels'])assert.deepEqual(scope[field],PINS.levels);assert.deepEqual(scope.playableLevels,PINS.playableLevels);for(const field of ['revision','query','storagePrefix'])assert.equal(scope[field],PINS[field]);
 assert.ok(Array.isArray(scope.rooms));assert.deepEqual(scope.rooms.map(room=>room.level),PINS.levels);for(const room of scope.rooms)checkIdentity(room.currentWalkthrough,{sourceCommit:PINS.priorFinaleSource,sourceReview:PINS.priorFinaleReview});
 assert.equal(status.sourceCommit,PINS.priorFinaleSource);assert.deepEqual(status.sourceReview,PINS.priorFinaleReview);assert.equal(status.publisherCommit,PINS.priorFinalePublisher);assert.equal(status.publicationRun,PINS.priorFinalePublicationRun);
 assert.equal(status.path,PINS.namespace);assert.equal(status.optIn,true);assert.equal(status.mainSiteUnchanged,true);assert.equal(status.query,PINS.query);for(const field of ['levels','reviewedLevels'])assert.deepEqual(status[field],PINS.levels);assert.deepEqual(status.playableLevels,PINS.playableLevels);
 assert.deepEqual(status.rooms,scope.rooms.map(({level,id,title,currentWalkthrough})=>({level,id,title,currentWalkthrough})));
}
export function checkPreservedMetadata(canonical,pilot,pilotStatus,progression,progressionStatus,next,nextStatus,finale,finaleStatus){
 assert.equal(canonical.commit,PINS.canonicalSource);assert.equal(canonical.publisherCommit,null);
 assert.equal(pilot.commit,PINS.priorPilotSource);assert.equal(pilot.publisherCommit,null);assert.equal(pilotStatus.sourceCommit,PINS.priorPilotSource);assert.equal(pilotStatus.publisherCommit,PINS.priorPilotPublisher);
 assert.equal(progression.commit,PINS.priorProgressionSource);assert.equal(progression.publisherCommit,null);assert.deepEqual(progression.sourceReview,PINS.priorProgressionReview);
 assert.equal(progressionStatus.sourceCommit,PINS.priorProgressionSource);assert.equal(progressionStatus.publisherCommit,PINS.priorProgressionPublisher);assert.equal(progressionStatus.publicationRun,PINS.priorProgressionPublicationRun);assert.deepEqual(progressionStatus.sourceReview,PINS.priorProgressionReview);
 assert.equal(next.commit,PINS.priorNextSource);assert.equal(next.publisherCommit,null);assert.deepEqual(next.sourceReview,PINS.priorNextReview);
 assert.equal(nextStatus.sourceCommit,PINS.priorNextSource);assert.equal(nextStatus.publisherCommit,PINS.priorNextPublisher);assert.equal(nextStatus.publicationRun,PINS.priorNextPublicationRun);assert.deepEqual(nextStatus.sourceReview,PINS.priorNextReview);
 checkPriorFinaleMetadata(finale,finaleStatus);
}
const priorFinaleIdentity=()=>({sourceCommit:PINS.priorFinaleSource,sourceReview:PINS.priorFinaleReview,publisherCommit:PINS.priorFinalePublisher,publicationRun:PINS.priorFinalePublicationRun});
function checkedPublicationRows(rows,count,bytes,label){
 assert.ok(Array.isArray(rows));assert.equal(rows.length,count,label+' file count');const names=new Set();let total=0;
 for(const row of rows){assert.deepEqual(Object.keys(row).sort(),['bytes','path','sha256']);assert.equal(typeof row.path,'string');assert.ok(row.path&&!/[\\\x00-\x1f\x7f]/.test(row.path)&&!row.path.startsWith('/')&&!/^[A-Za-z]:/.test(row.path)&&row.path.split('/').every(part=>part&&part!=='.'&&part!=='..'),label+' unsafe path');assert.equal(names.has(row.path),false,label+' duplicate path');names.add(row.path);assert.ok(Number.isSafeInteger(row.bytes)&&row.bytes>=0);total+=row.bytes;assert.match(row.sha256,/^[a-f0-9]{64}$/);}
 assert.equal(total,bytes,label+' byte count');return new Map(rows.map(row=>[row.path,row]));
}
export function checkDeploymentProofs(proof,preflight,prior,identity,publisher){
 checkIdentity(proof,identity);assert.equal(proof.publicationRun,positive(identity.publicationRun),'Publication proof belongs to another run');assert.equal(proof.publisherCommit,publisher);assert.equal(proof.phase,'published');assert.equal(proof.baselinePublisherCommit,PINS.baselinePublisher);assert.equal(proof.baselinePublicationRun,PINS.baselineRun);assert.equal(proof.baselineSourceCommit,PINS.priorFinaleSource);assert.equal(proof.mainSiteUnchanged,true);assert.deepEqual(proof.priorFinale,priorFinaleIdentity());
 const baseline=checkedPublicationRows(proof.baselineFiles,PINS.baselineFiles,PINS.baselineBytes,'Full accepted baseline'),outside=checkedPublicationRows(proof.preservedFiles,PINS.preservedFiles,PINS.preservedBytes,'Preserved outside'),replaced=checkedPublicationRows(proof.priorFinaleFiles,PINS.priorFinaleFiles,PINS.priorFinaleBytes,'Prior finale');
 assert.ok([...outside.keys()].every(name=>!name.startsWith(PINS.namespace)));assert.ok([...replaced.keys()].every(name=>name.startsWith(PINS.namespace)));assert.equal(outside.size+replaced.size,baseline.size);for(const [name,row]of [...outside,...replaced])assert.deepEqual(baseline.get(name),row,'Accepted inventory partition changed');
 assert.equal(proof.preservedBytes,PINS.preservedBytes);assert.equal(proof.baselineBytes,PINS.baselineBytes);assert.equal(proof.priorFinaleBytes,PINS.priorFinaleBytes);assert.equal(proof.baselineFilesSha256,sha(JSON.stringify(proof.baselineFiles)));
 const rows=value=>checkedPublicationRows(value,value?.length,value?.reduce((sum,row)=>sum+row.bytes,0),'Current publication');
 const progression=rows(proof.progressionFiles),candidate=rows(proof.candidateFiles),site=rows(proof.siteFiles);assert.ok(progression.size>0&&candidate.size>0);assert.ok([...progression.keys()].every(name=>name.startsWith(PINS.namespace)),'Current inventory escaped the namespace');
 for(const [name,row]of candidate)assert.deepEqual(progression.get(PINS.namespace+name),{...row,path:PINS.namespace+name},'Current candidate inventory differs');const generated=[...progression.keys()].filter(name=>!candidate.has(name.slice(PINS.namespace.length))).sort();assert.deepEqual(generated,[PINS.namespace+'preview-status.json',PINS.namespace+'walkthroughs.html']);assert.equal(proof.progressionBytes,proof.progressionFiles.reduce((sum,row)=>sum+row.bytes,0));
 assert.equal(site.size,outside.size+progression.size,'Current site inventory is stale');for(const [name,row]of [...outside,...progression])assert.deepEqual(site.get(name),row,'Current site inventory changed');
 checkIdentity(prior,priorFinaleIdentity());assert.equal(prior.publisherCommit,PINS.priorFinalePublisher);assert.equal(prior.publicationRun,PINS.priorFinalePublicationRun);assert.equal(prior.path,PINS.namespace);assert.equal(prior.bytes,PINS.priorFinaleBytes);assert.deepEqual(prior.files,proof.priorFinaleFiles);
 checkIdentity(preflight,identity);assert.equal(preflight.publisherCommit,publisher);assert.equal(preflight.publicationRun,proof.publicationRun);assert.equal(preflight.phase,'preflight');assert.equal(preflight.pass,true);assert.equal(preflight.mainSiteUnchanged,true);assert.equal(preflight.checked,PINS.baselineFiles);assert.equal(preflight.bytes,PINS.baselineBytes);assert.equal(preflight.baselineFilesSha256,proof.baselineFilesSha256,'Preflight checked a stale inventory');
}
export function checkDeploymentRows(rows,publisher,publicationRun){
 const accepted=[];for(const row of rows){const ownLog=row.logUrl&&new RegExp('/actions/runs/'+positive(publicationRun)+'(?:/|$)').test(row.logUrl);if(row.sha===publisher&&ownLog)continue;
  assert.ok(row.state&&!['queued','pending','in_progress'].includes(row.state),'Another Pages publication is pending');if(['failure','error','inactive'].includes(row.state))continue;
  assert.equal(row.state,'success','Unknown Pages deployment state');assert.equal(row.sha,PINS.baselinePublisher,'A later Pages publication exists; preserve its full inventory before continuing');assert.ok(row.logUrl&&new RegExp('/actions/runs/'+PINS.baselineRun+'(?:/|$)').test(row.logUrl),'The accepted deployment must belong to the pinned baseline publication');accepted.push(row);break;
 }assert.equal(accepted.length,1,'An active successful accepted Pages deployment is required');return accepted[0];
}
async function guard(phase){
 exactSource();
 assert.ok(['prepare','deploy'].includes(phase));assert.equal(process.env.GITHUB_REPOSITORY,PINS.repository);assert.equal(process.env.GITHUB_REF,'refs/heads/main');
 const identity=currentIdentity(),publisher=process.env.PROGRESSION_PUBLISHER_COMMIT;assert.match(publisher||'',/^[a-f0-9]{40}$/);assert.equal(publisher,process.env.GITHUB_SHA,'The controller must be this exact main workflow commit');
 const [main,head,run,artifacts,deployments,comparison]=await Promise.all([githubGet('git/ref/heads/main'),githubGet('git/ref/heads/'+PINS.branch),githubGet('actions/runs/'+PINS.baselineRun),githubGet('actions/runs/'+PINS.baselineRun+'/artifacts?name=github-pages&per_page=100'),githubGet('deployments?environment=github-pages&per_page=100'),githubGet('compare/'+PINS.sourceBase+'...'+identity.sourceCommit)]);
 checkPublisherHeads(main,head,comparison,identity,publisher);assert.notEqual(publisher,PINS.baselinePublisher,'A new direct-child controller is required');
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
 const metadata=await Promise.all([pages('build-info.json'),pages('puzzle-pilot/build-info.json'),pages('puzzle-pilot/preview-status.json'),pages('puzzle-progression/build-info.json'),pages('puzzle-progression/preview-status.json'),pages('puzzle-progression-next/build-info.json'),pages('puzzle-progression-next/preview-status.json'),pages(PINS.namespace+'build-info.json'),pages(PINS.namespace+'preview-status.json')]);checkPreservedMetadata(...metadata);
 await reviewGuard();
 if(phase==='deploy'){
  checkDeploymentProofs(read('proof/manifest.json'),read('proof/predeploy-public-bytes.json'),read('proof/prior-finale-manifest.json'),{...identity,publicationRun:positive(process.env.GITHUB_RUN_ID)},publisher);
 }
 write('proof/github-guard-'+phase+'.json',{pass:true,phase,...identity,publisherCommit:publisher,baselineRun:PINS.baselineRun,baselinePublisherCommit:PINS.baselinePublisher,artifact,currentMain:main,currentSourceHead:head,sourceComparison:comparison,baselinePublication:run,controllerChain:chain,acceptedDeployment,inspectedDeployments:inspected,checkedAt:new Date().toISOString()});
 console.log('Exact source, review attempt and latest publisher checked: '+phase);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const [command,arg,level]=process.argv.slice(2);
 if(command==='source')sourceProof();else if(command==='stamp')await stamp(arg||'dist');else if(command==='evidence')copyEvidence(arg||'dist');else if(command==='package')verifyBasePackage(arg||'dist');else if(command==='bind-browser')bindBrowser(arg,Number(level));else if(command==='recording')attachRecording(arg,Number(level));else if(command==='cpu')cpuProof(arg);else if(command==='review')await reviewGuard();else if(command==='retain-baseline')await retainBaseline(arg||'baseline-retained');else if(command==='download-reviewed')await downloadReviewed(arg||'review-inputs');else if(command==='guard')await guard(arg);else throw Error('Usage: publish-puzzle-progression-finale-camera.mjs source | stamp|evidence|package [dist] | bind-browser DIR LEVEL | recording DIR LEVEL | cpu LOG | review | retain-baseline [DIR] | download-reviewed [DIR] | guard prepare|deploy');
}
