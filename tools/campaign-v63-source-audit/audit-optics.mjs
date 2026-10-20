/** Read-only offline audit of the ten independently captured Optics movies.
 * Provider ZIP closure and the clean frozen Source checkout are audited by the
 * caller. This module issues no release, native, camera or platform acceptance.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {parsePlayerEvidenceJSON} from './audit-player-ui.mjs';
import {assertFrozenResponseQuery} from './audit-common.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(root,args)=>execFileSync('git',args,{cwd:root,maxBuffer:128_000_000});
const gitText=(root,args)=>git(root,args).toString('utf8').trim();
const nativeScopes=['sourceCiAccepted','nativeAccepted','publicationAccepted','fullChapterAccepted','humanAccepted','allBypassesAccepted'];
const platformScopes=['sourceAccepted','publicationAccepted','liveSdkAccepted','moderationAccepted'];
const platformControllers=['scripts/qa-campaign-platform-route.mjs','scripts/lib/yandex-debug-checker.mjs','scripts/lib/yandex-review-sdk.mjs','scripts/lib/campaign-access-fixture.mjs','scripts/qa-browser-capture.mjs',
 'qa/vendor/yandex-games-debug-checker/debugcheck.js','qa/vendor/yandex-games-debug-checker/LICENSE','qa/vendor/yandex-games-debug-checker/upstream.json'];

function falseScopes(value,keys=nativeScopes){for(const key of keys)assert.equal(value[key],false,'No acceptance may be promoted: '+key);}
function plainFile(filename){const stat=fs.lstatSync(filename);assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'Plain evidence file required: '+filename);return stat;}
function bytes(filename){plainFile(filename);return fs.readFileSync(filename);}
function json(filename){const data=bytes(filename),text=data.toString('utf8');assert.deepEqual(Buffer.from(text),data,'Invalid UTF-8 evidence');return parsePlayerEvidenceJSON(text);}
function metadata(filename){const data=bytes(filename);return{bytes:data.length,sha256:sha(data)};}
function directory(root,name){assert.ok(!name.includes('/')&&!name.includes('\\'));const full=path.join(root,name),stat=fs.lstatSync(full);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink());return full;}
function committed(root,commit,name){const actual=bytes(path.join(root,name)),expected=git(root,['show',commit+':'+name]);assert.deepEqual(actual,expected,'Source controller/model working bytes differ: '+name);return{path:name,bytes:actual.length,sha256:sha(actual)};}
function controller(root,commit,tree,names,value,{runId,runAttempt}={}){
 assert.equal(value.commit,commit);assert.equal(value.tree,tree);assert.equal(value.trackedWorkingTreeClean,true);
 assert.equal(new Set(names).size,names.length);
 const files=names.map(name=>committed(root,commit,name));assert.deepEqual(value.files,files);assert.equal(value.filesSha256,sha(JSON.stringify(files)));
 if(runId!==undefined){assert.equal(value.runId,runId);assert.equal(value.runAttempt,runAttempt);}return files;
}
function packageMember(value,mode){
 return{mode,commit:value.commit,buildInfoBytes:value.buildInfoBytes,buildInfoSha256:value.buildInfoSha256,sourceInputsSha256:value.sourceInputsSha256,
  packageFilesSha256:value.packageFilesSha256,files:value.files,fileCount:value.files.length,totalBytes:value.files.reduce((n,f)=>n+f.bytes,0)};
}
function provenance(value,{commit,runId,runAttempt}){
 for(const key of ['sourceReview','captureRun','providerRun']){assert.equal(value[key].runId,runId);assert.equal(value[key].runAttempt,runAttempt);}
 assert.equal(value.providerRun.commit,commit);
}
function byteReference(value,filename){assert.deepEqual({bytes:value.bytes,sha256:value.sha256},metadata(filename),'Byte reference differs: '+filename);}
function jsonLines(filename){
 const data=bytes(filename),text=data.toString('utf8');assert.deepEqual(Buffer.from(text),data);assert.ok(text.endsWith('\n'));
 const lines=text.slice(0,-1).split('\n');assert.ok(lines.length>0&&lines.every(Boolean),'Telemetry must contain exactly one nonempty JSON row per line');return lines.map(line=>parsePlayerEvidenceJSON(line));
}

/** Rebind every retained actual-response observation to verified package bytes,
 * including the original checker's cache-busted source scans and declared SDK.
 * This validates retained observations; it does not perform new HTTP requests. */
export function assertOpticsHTTPBindings(observation,{pageURL,review,sdk}={}){
 assert.equal(observation.kind,'actual-browser-response-body-hashes');assert.equal(observation.allReceivedBytesMatched,true);
 const base=new URL(pageURL);assert.equal(base.protocol,'http:');assert.equal(base.hostname,'127.0.0.1');assert.ok(base.port);assert.equal(base.pathname,'/campaign-v63/');
 const files=new Map(review.files.map(file=>[file.path,file]));assert.equal(files.size,review.files.length);
 files.set('build-info.json',{path:'build-info.json',bytes:review.buildInfoBytes,sha256:review.buildInfoSha256});
 assert.ok(Array.isArray(observation.responses)&&observation.responses.length>0);
 let total=0;
 for(const row of observation.responses){
  const url=new URL(row.url);assert.equal(url.origin,base.origin);
  const mock=url.pathname==='/sdk.js';assert.ok(mock||url.pathname.startsWith(base.pathname));
  const relative=mock?'/sdk.js':decodeURIComponent(url.pathname.slice(base.pathname.length))||'index.html';
  assert.equal(row.path,relative);assert.equal(row.status,200);assert.equal(row.mockSdk,mock);assert.equal(row.checkerSourceScan,url.searchParams.has('_dc'));assert.equal(typeof row.fromCache,'boolean');
  const expected=mock?sdk:files.get(relative);assert.ok(expected,'Response outside frozen inventory: '+relative);
  assertFrozenResponseQuery(url,relative,expected);
  assert.equal(row.bytes,expected.bytes);assert.equal(row.sha256,expected.sha256);total+=row.bytes;
 }
 assert.equal(observation.responseCount,observation.responses.length);assert.equal(observation.totalObservedBytes,total);
 for(const expected of ['index.html','/sdk.js'])assert.ok(observation.responses.some(row=>row.path===expected));
 assert.ok(observation.responses.some(row=>row.path==='index.html'&&row.checkerSourceScan));
 assert.ok(observation.responses.some(row=>row.path.endsWith('.js')&&row.checkerSourceScan));return observation;
}

function pixelRanges(text){
 const mins=[...text.matchAll(/lavfi\.signalstats\.YMIN=(\d+)/g)].map(match=>Number(match[1]));
 const maxs=[...text.matchAll(/lavfi\.signalstats\.YMAX=(\d+)/g)].map(match=>Number(match[1]));
 assert.ok(mins.length>0);assert.equal(mins.length,maxs.length);const ranges=maxs.map((max,index)=>max-mins[index]);assert.ok(ranges.every(n=>n>12),'A fully decoded movie frame is blank');
 return{mins,maxs,ranges,minimum:Math.min(...ranges)};
}
function actualMovie(filename,retainedPixels,retainedProbe,report){
 const probe=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_streams','-show_format','-of','json',filename],{encoding:'utf8',timeout:60_000,maxBuffer:8_000_000}));
 assert.deepEqual(probe.streams,retainedProbe.streams,'Actual ffprobe streams differ from retained report');
 const withoutFilename=value=>{const copy={...value};delete copy.filename;return copy;};
 assert.deepEqual(withoutFilename(probe.format),withoutFilename(retainedProbe.format),'Actual ffprobe format differs from retained report');
 // Metadata is streamed to stdout. Neither the movie nor any evidence file is
 // rewritten, and -xerror rejects a corrupt frame anywhere in the full movie.
 const decoded=execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-xerror','-i',filename,'-map','0:v:0','-vf','scale=160:90,signalstats,metadata=mode=print:file=-','-f','null','-'],{encoding:'utf8',timeout:300_000,maxBuffer:32_000_000});
 const actual=pixelRanges(decoded),retained=pixelRanges(retainedPixels);
 assert.equal(actual.ranges.length,report.video.frames);assert.equal(retained.ranges.length,report.video.frames);
 assert.deepEqual(actual.mins,retained.mins);assert.deepEqual(actual.maxs,retained.maxs);assert.equal(actual.minimum,report.video.pixelCheck.minimumLuminanceRange);
 return{probe,frames:actual.ranges.length,minimumLuminanceRange:actual.minimum};
}
function keyframePixels(movie,png,index,width,height){
 const signature=bytes(png);assert.deepEqual(signature.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
 assert.equal(signature.readUInt32BE(16),width);assert.equal(signature.readUInt32BE(20),height);
 const options={timeout:60_000,maxBuffer:16_000_000};
 const actual=execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-xerror','-i',movie,'-vf',`select=eq(n\\,${index})`,'-vsync','0','-frames:v','1','-f','rawvideo','-pix_fmt','rgba','pipe:1'],options);
 const retained=execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-xerror','-i',png,'-frames:v','1','-f','rawvideo','-pix_fmt','rgba','pipe:1'],options);
 assert.equal(actual.length,width*height*4);assert.deepEqual(actual,retained,'Retained keyframe pixels do not come from the declared encoded movie frame');
}

export async function auditOptics({source,evidence,commit,tree,runId,runAttempt,consumer,review,sourceInputs,sourceInputsSha256}){
 source=path.resolve(source);evidence=path.resolve(evidence);
 assert.match(commit,/^[a-f0-9]{40}$/);assert.match(tree,/^[a-f0-9]{40}$/);assert.equal(gitText(source,['rev-parse','HEAD']),commit);assert.equal(gitText(source,['rev-parse','HEAD^{tree}']),tree);
 assert.equal(gitText(source,['status','--porcelain','--untracked-files=no']),'','Audit the clean frozen Source checkout');
 for(const n of [runId,runAttempt])assert.ok(Number.isSafeInteger(n)&&n>0);
 assert.equal(sha(JSON.stringify(sourceInputs)),sourceInputsSha256);
 for(const pkg of [consumer,review]){assert.equal(pkg.commit,commit);assert.equal(pkg.info.commit,commit);assert.equal(pkg.sourceInputsSha256,sourceInputsSha256);assert.equal(pkg.info.sourceInputsSha256,sourceInputsSha256);assert.equal(pkg.packageFilesSha256,pkg.info.packageFilesSha256);assert.deepEqual(pkg.files,pkg.info.files);assert.equal(sha(JSON.stringify(pkg.files)),pkg.packageFilesSha256);assert.equal(String(pkg.info.run),String(runId));
  assert.deepEqual(json(path.join(pkg.directory,'build-info.json')),pkg.info);byteReference({bytes:pkg.buildInfoBytes,sha256:pkg.buildInfoSha256},path.join(pkg.directory,'build-info.json'));
 }
 assert.equal(consumer.mode,'consumer');assert.equal(review.mode,'yandex-review-test');assert.notEqual(consumer.packageFilesSha256,review.packageFilesSha256);
 // Imports come only from the exact source checkout whose HEAD and immutable
 // controller files are checked here and again against each native binding.
 for(const name of ['scripts/lib/optics-native-proof.mjs','scripts/lib/yandex-debug-checker.mjs','scripts/lib/yandex-review-sdk.mjs','scripts/lib/campaign-access-fixture.mjs'])committed(source,commit,name);
 const load=relative=>import(pathToFileURL(path.join(source,relative)).href);
 const proof=await load('scripts/lib/optics-native-proof.mjs'),checkerHelper=await load('scripts/lib/yandex-debug-checker.mjs'),sdkHelper=await load('scripts/lib/yandex-review-sdk.mjs'),fixtureHelper=await load('scripts/lib/campaign-access-fixture.mjs'),releaseHelper=await load('scripts/lib/release-manifest.mjs');
 assert.deepEqual(releaseHelper.buildSourceInputs(source),sourceInputs);
 const names=gitText(source,['ls-tree','-r','--name-only',commit]).split('\n').filter(name=>name.endsWith('.glb'));
 assert.equal(names.length,59);const originalModels=names.map(name=>committed(source,commit,name));
 const expectedSource={commit,tree,sourceInputsSha256,sourceInputFiles:sourceInputs.length,originalModels};
 const reviewMember=packageMember(review,'yandex-review-test'),consumerMember=packageMember(consumer,'consumer');
 const journeys=review.files.filter(file=>/^assets\/LabV8Journey-[A-Za-z0-9_-]+\.js$/.test(file.path));assert.equal(journeys.length,1);
 const expectedNativePackage={mode:'yandex-review-test',commit,buildInfoBytes:review.buildInfoBytes,buildInfoSha256:review.buildInfoSha256,packageFilesSha256:review.packageFilesSha256,fileCount:review.files.length,totalBytes:reviewMember.totalBytes,files:review.files,journey:journeys[0],originalRuntimeModels:14};
 const sdkBytes=Buffer.from(sdkHelper.createMockYandexSDKSource({mobile:false})),sdk={kind:'explicit-local-test-sdk',bytes:sdkBytes.length,sha256:sha(sdkBytes),liveSdk:false,liveAds:false};
 checkerHelper.loadPinnedYandexChecker({sourceRoot:source});
 const rooms=[];
 for(let room=31;room<=40;room++){
  const media=directory(evidence,'v63-optics-film-'+room),checkerDir=directory(evidence,'v63-optics-checker-'+room),tag=String(room);
  const members=fs.readdirSync(media).sort();proof.assertOpticsMediaMembers(members,room);const inventory=json(path.join(media,'closed-media-member-inventory.json'));falseScopes(inventory);
  const actual=members.filter(name=>name!=='closed-media-member-inventory.json').map(name=>({name,...metadata(path.join(media,name))}));
  assert.deepEqual(inventory.files,actual);assert.ok(members.reduce((n,name)=>n+plainFile(path.join(media,name)).size,0)<=proof.OPTICS_BOUNDS.artifactBytes);
  const binding=json(path.join(media,'binding.json')),report=json(path.join(media,'optics-native-report.json')),rows=jsonLines(path.join(media,`room-${tag}-telemetry.jsonl`));
  falseScopes(binding);assert.equal(binding.kind,'optics-current-native-input-freeze');assert.deepEqual(binding.source,expectedSource);assert.deepEqual(binding.sourceInputs,sourceInputs);assert.deepEqual(binding.package,expectedNativePackage);assert.deepEqual(binding.captureBounds,proof.OPTICS_BOUNDS);provenance(binding,{commit,runId,runAttempt});
  controller(source,commit,tree,proof.OPTICS_HARNESS_FILES,binding.controller,{runId,runAttempt});
  const pair=binding.platformPackages;falseScopes(pair,platformScopes);assert.equal(pair.kind,'yandex-review-campaign-package-binding');assert.deepEqual(pair.source,{commit,tree,sourceInputsSha256,sourceInputFiles:sourceInputs.length});
  assert.deepEqual(pair.review,reviewMember);assert.deepEqual(pair.consumer,consumerMember);assert.deepEqual(pair.journey,journeys[0]);assert.deepEqual(pair.checker,checkerHelper.YANDEX_CHECKER_PIN);
  controller(source,commit,tree,platformControllers,pair.controller);
  for(const [key,value]of Object.entries({runId,runAttempt,sourceReviewRunId:runId,sourceReviewRunAttempt:runAttempt}))assert.equal(pair[key],value);
  provenance(report,{commit,runId,runAttempt});assert.equal(report.route.level,room);assert.equal(report.captureViewport,'landscape');
  assert.deepEqual(json(path.join(media,'native-browser.json')),report.browser);assert.deepEqual(json(path.join(media,'native-ui-play.json')),report.ui);
  const served=json(path.join(media,'served-package.json'));falseScopes(served);assert.equal(served.sourceCommit,commit);assert.equal(served.sourceTree,tree);assert.equal(served.allHTTPFilesVerified,true);
  assert.deepEqual(served.files,[...review.files,{path:'build-info.json',bytes:review.buildInfoBytes,sha256:review.buildInfoSha256}].map(file=>({...file,status:200})));
  const movie=path.join(media,report.video.filename);assert.equal(report.video.filename,`room-${tag}-full.mp4`);assert.equal(report.telemetry.filename,`room-${tag}-telemetry.jsonl`);byteReference(report.video,movie);byteReference(report.telemetry,path.join(media,report.telemetry.filename));
  assert.equal(report.video.pixelCheck.filename,`room-${tag}-native-pixels.log`);byteReference(report.video.pixelCheck,path.join(media,report.video.pixelCheck.filename));
  const decoded=actualMovie(movie,bytes(path.join(media,report.video.pixelCheck.filename)).toString('utf8'),json(path.join(media,'ffprobe.json')),report);
  proof.assertOpticsNativeDiagnostic(report,{binding,rows,movieMetadata:decoded.probe});
  for(const keyframe of report.keyframes){byteReference(keyframe,path.join(media,keyframe.filename));keyframePixels(movie,path.join(media,keyframe.filename),keyframe.encodedFrame,report.capture.width,report.capture.height);}

  assert.deepEqual(fs.readdirSync(checkerDir).sort(),['optics-native-checker-context.json','optics-native-media-link.json','yandex-debug-checker-report.json','yandex-debug-checker-report.txt']);
  const checker=json(path.join(checkerDir,'yandex-debug-checker-report.json')),original=bytes(path.join(checkerDir,'yandex-debug-checker-report.txt')),context=json(path.join(checkerDir,'optics-native-checker-context.json')),link=json(path.join(checkerDir,'optics-native-media-link.json'));
  const summary=checkerHelper.assertYandexCheckerDiagnostic(checker);assert.equal(checker.pass,true);assert.deepEqual(checker.summary,summary);assert.deepEqual(original,Buffer.from(checker.originalReport));
  const identity={sourceCommit:commit,sourceTree:tree,sourceInputsSha256,runId,runAttempt,level:room,controllerFilesSha256:binding.controller.filesSha256,reviewPackageFilesSha256:review.packageFilesSha256,consumerPackageFilesSha256:consumer.packageFilesSha256,movieSha256:report.video.sha256};
  assert.deepEqual(checker.identity,identity);assert.deepEqual(context.identity,identity);assert.deepEqual(link.identity,identity);assert.equal(checker.observedPage.runtimeState,'won');
  const checkerRefs={reportSha256:metadata(path.join(checkerDir,'yandex-debug-checker-report.json')).sha256,originalTextSha256:sha(original),summary};
  assert.deepEqual(context.checker,checkerRefs);assert.deepEqual(link.checker,checkerRefs);assert.deepEqual(report.platformReview.checker,checkerRefs);
  assert.equal(context.kind,'optics-native-original-checker-context');falseScopes(context);falseScopes(link);assert.deepEqual(context.platformPackages,pair);assert.deepEqual(context.sdkDefinition,sdk);assert.deepEqual(report.platformReview.sdk,sdk);
  assert.deepEqual(context.checkerInstallation.pin,checkerHelper.YANDEX_CHECKER_PIN);
  const sdkObservation=context.sdkObservation;assert.equal(sdkObservation.kind,sdk.kind);assert.equal(sdkObservation.liveSdk,false);assert.equal(sdkObservation.liveAds,false);assert.equal(sdkObservation.platformDemo,false);
  const positions=['init','sdk-language-get','ready','start'].map(event=>sdkObservation.log.findIndex(row=>row.event===event));assert.ok(positions.every(n=>n>=0)&&positions.every((n,i)=>i===0||n>positions[i-1]),'Actual SDK initialization/language/ready/start order differs');
  for(const [i,event]of sdkObservation.log.entries()){assert.ok(Number.isFinite(event.time));if(i)assert.ok(event.time>=sdkObservation.log[i-1].time);}
  const pageURL=new URL(checker.observedPage.url);assert.equal(pageURL.searchParams.get('edition'),'foundation');assert.equal(pageURL.searchParams.get('level'),String(room));assert.equal(pageURL.searchParams.get('debug'),'1');
  const network=assertOpticsHTTPBindings(context.network,{pageURL:pageURL.href,review,sdk});assert.deepEqual(report.platformReview.network,{allReceivedBytesMatched:true,responseCount:network.responseCount});
  const fixture=fixtureHelper.campaignAccessFixture({levelIndex:room-1,pathname:'/campaign-v63/'});assert.deepEqual(context.accessFixture,fixture);
  assert.deepEqual(report.platformReview.access,{targetIndex:fixture.targetIndex,targetCompleted:false,constructorWrites:0,scope:fixture.scope});
  // Retain the producer's sibling directory label. The provider artifact is
  // separately named v63-optics-checker-N when it is downloaded for audit.
  assert.equal(report.platformReview.context.directory,'optics-checker-'+room);assert.equal(report.platformReview.context.filename,'optics-native-checker-context.json');byteReference(report.platformReview.context,path.join(checkerDir,'optics-native-checker-context.json'));
  assert.equal(link.contextSha256,report.platformReview.context.sha256);assert.equal(link.closedMediaInventorySha256,metadata(path.join(media,'closed-media-member-inventory.json')).sha256);assert.equal(link.nativeReportSha256,metadata(path.join(media,'optics-native-report.json')).sha256);
  rooms.push({room,id:report.route.id,mediaArtifact:path.basename(media),checkerArtifact:path.basename(checkerDir),videoSha256:report.video.sha256,frames:decoded.frames,physicsSteps:report.route.physicsSteps,simulationSeconds:report.route.seconds,
   closedMembers:members.length,fullDecode:true,keyframesCompared:report.keyframes.length,minimumLuminanceRange:decoded.minimumLuminanceRange,checker:summary,observedHTTPResponses:network.responseCount});
 }
 assert.equal(rooms.length,10);
 return{kind:'offline-optics-source-evidence-audit',pass:true,source:{commit,tree,runId,runAttempt,sourceInputsSha256},rooms,
  totals:{movies:rooms.length,frames:rooms.reduce((n,r)=>n+r.frames,0),physicsSteps:rooms.reduce((n,r)=>n+r.physicsSteps,0),keyframesCompared:rooms.reduce((n,r)=>n+r.keyframesCompared,0),hardFailures:rooms.reduce((n,r)=>n+r.checker.hardFailures,0),warnings:rooms.reduce((n,r)=>n+r.checker.warnings,0),notVerified:rooms.reduce((n,r)=>n+r.checker.notVerified,0)},
  sourceAccepted:false,sourceCiAccepted:false,publicationAccepted:false,nativeAccepted:false,liveSdkAccepted:false,moderationAccepted:false,cameraAccepted:false,humanAccepted:false,
  scope:'Offline byte/identity/cadence/media/checker audit of retained provider artifacts. It preserves original WARN and NOT VERIFIED and issues no acceptance.'};
}
