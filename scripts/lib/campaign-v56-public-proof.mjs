import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const PUBLIC_REPOSITORY='amazin20/brainrot-portal';
export const PUBLIC_CAMPAIGN_URL='https://amazin20.github.io/brainrot-portal/campaign-v56/';
export const R5=Object.freeze({publisher:'bd7481014483ccaaca64923388bdc87e2cafa7ea',tree:'049d65f5a812596f1f5fb191f5ade3ccb82f48df',
 parent:'4ba2c891597394edae778c17ec2a266d8dba691a',sourceCommit:'3f2e83127dfd5800068854a98843d73eb9377609',sourceTree:'8a00a9e62642865d83c71039d72bf028dea46256',
 sourceReview:Object.freeze({runId:38348119403,runAttempt:1}),publicationRun:38366134401,publicationRunAttempt:1,
 files:1957,bytes:633671648,inventorySha256:'d76664e04f5ac2f2b161d9af10da1aa2299df13cfec51a243659d2b732be13c6',
 packageBindingSha256:'0bde8ddd7794257843d8b4e9348ff957aebe06b42178a2720d3188b2fe575992',
 fullArtifactId:11801377347,fullArtifactBytes:796719991,fullArtifactSha256:'5b4e57f6667eeec47e5e304d310eb5ae99cc7403d22a66bd908b15e2c1670085',
 publicJobId:115192507489,deploymentId:7033225463,publicLogBytes:174630,publicLogSha256:'10fb6338dd7fe70358bad49e2ee4ff96bc74f3440bf5d0868a4aaef9d32d4c2e',
 assemblyJobId:115191601101,assemblyLogBytes:371794,assemblyLogSha256:'fc63c030f2fed532ce517f89967f90ca9ac54bde42bc1c3d8956ee8687df7417',
 frozenHelperSha256:'f1f14455349910603180f495e728b2cbe9f1cc2b034ca48a602a88ebd5ad9b0c',
 rescueBranch:'audit/r5-public-packet-20261013',rescueWorkflow:'.github/workflows/audit-r5-public-packet.yml'});
const PACKET_LIMIT=100_000_000,METADATA_LIMIT=25_000_000,ENTRY_LIMIT=20_000;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const rowsSha=rows=>sha(Buffer.from(JSON.stringify(rows)));
const integer=(value,label,{zero=false,maximum=Number.MAX_SAFE_INTEGER}={})=>assert.ok(Number.isSafeInteger(value)&&value>=(zero?0:1)&&value<=maximum,label);
const hex=(value,size,label)=>assert.match(value||'',new RegExp('^[a-f0-9]{'+size+'}$'),label);
const sorted=values=>values.slice().sort((a,b)=>a<b?-1:a>b?1:0);
const clone=value=>JSON.parse(JSON.stringify(value));
const runURL=id=>'https://github.com/'+PUBLIC_REPOSITORY+'/actions/runs/'+id;
const jobURL=(run,id)=>runURL(run)+'/job/'+id;
function object(value,label){assert.ok(value&&typeof value==='object'&&!Array.isArray(value),label);return value;}
function safeName(value){
 assert.equal(typeof value,'string');assert.ok(value&&Buffer.byteLength(value)<=2048&&!/[\\\x00-\x1f\x7f]/.test(value)&&!value.startsWith('/')&&!/^[A-Za-z]:/.test(value),'Unsafe evidence path');
 const parts=value.split('/');assert.ok(parts.length<=64&&parts.every(p=>p&&p!=='.'&&p!=='..'),'Unsafe evidence path');
 assert.ok(!/[\uD800-\uDFFF]/u.test(value),'Invalid evidence path encoding');return value;
}
function ordinary(value,directory=false){
 const file=path.resolve(value);let cursor=path.parse(file).root;
 for(const part of file.slice(cursor.length).split(path.sep)){if(!part)continue;cursor=path.join(cursor,part);const st=fs.lstatSync(cursor);assert.equal(st.isSymbolicLink(),false,'Evidence symlink');}
 const st=fs.lstatSync(file);assert.equal(directory?st.isDirectory():st.isFile(),true,'Non-regular evidence path');return file;
}
function fileSha(file){
 file=ordinary(file);const hash=createHash('sha256'),fd=fs.openSync(file,'r'),chunk=Buffer.alloc(1024*1024);
 try{let bytes;while((bytes=fs.readSync(fd,chunk,0,chunk.length,null))>0)hash.update(chunk.subarray(0,bytes));}finally{fs.closeSync(fd);}return hash.digest('hex');
}
function readJSON(file){file=ordinary(file);assert.ok(fs.statSync(file).size<=METADATA_LIMIT,'Metadata byte limit');return JSON.parse(fs.readFileSync(file,'utf8'));}
export function publicProofInventory(directory,{maximum=PACKET_LIMIT}={}){
 directory=ordinary(directory,true);const rows=[];let bytes=0,entries=0;
 function walk(root){for(const name of fs.readdirSync(root).sort()){const file=path.join(root,name),st=fs.lstatSync(file);assert.ok(++entries<=ENTRY_LIMIT*2,'Evidence namespace limit');
  assert.equal(st.isSymbolicLink(),false,'Evidence symlink');safeName(path.relative(directory,file).split(path.sep).join('/'));
  if(st.isDirectory())walk(file);else{assert.equal(st.isFile(),true,'Evidence special file');integer(st.size,'Evidence size',{zero:true,maximum});bytes+=st.size;assert.ok(bytes<=maximum,'Evidence byte limit');
   rows.push({path:path.relative(directory,file).split(path.sep).join('/'),bytes:st.size,sha256:fileSha(file)});}}
 }walk(directory);rows.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);assert.ok(rows.length<=ENTRY_LIMIT);return rows;
}
function checkedRows(rows,{maximum=PACKET_LIMIT}={}){
 assert.ok(Array.isArray(rows)&&rows.length>0&&rows.length<=ENTRY_LIMIT,'Complete evidence inventory required');const names=new Set();let previous='',total=0;
 for(const row of rows){assert.deepEqual(Object.keys(row).sort(),['bytes','path','sha256']);safeName(row.path);assert.ok(row.path>previous&&!names.has(row.path),'Sorted unique evidence rows required');previous=row.path;names.add(row.path);
  integer(row.bytes,'Evidence row bytes',{zero:true,maximum});hex(row.sha256,64,'Evidence row hash');total+=row.bytes;assert.ok(total<=maximum,'Evidence inventory byte limit');}
 for(const name of names){const parts=name.split('/');for(let i=1;i<parts.length;i++)assert.equal(names.has(parts.slice(0,i).join('/')),false,'Evidence namespace collision');}return total;
}
function sourceStamp(spec){
 assert.equal(spec.repository,PUBLIC_REPOSITORY);for(const key of ['sourceCommit','sourceTree','sourceParent'])hex(spec[key],40,'Exact '+key);
 const review=object(spec.sourceReview,'SOURCE review required');integer(review.runId,'SOURCE run');integer(review.runAttempt,'SOURCE attempt');
 assert.deepEqual(Object.keys(review).sort(),['runAttempt','runId']);
 return clone({sourceCommit:spec.sourceCommit,sourceTree:spec.sourceTree,sourceParent:spec.sourceParent,sourceReview:review,sourceReviewURL:runURL(review.runId)});
}
function assertedPublicRun(run,publisher,runId){
 object(run,'Actual PUBLIC run required');assert.equal(run.id,runId);assert.equal(run.head_sha,publisher);assert.equal(run.head_branch,'main');assert.equal(run.event,'push');assert.equal(run.run_attempt,1);
 assert.equal(run.repository?.full_name,PUBLIC_REPOSITORY);assert.equal(run.html_url,runURL(runId));assert.ok(['queued','in_progress','completed'].includes(run.status));
 assert.equal(run.path,'.github/workflows/publish-campaign-v56.yml','Only the actual campaign publisher can produce PUBLIC proof');
 if(run.status==='completed')assert.equal(run.conclusion,'success','Failed PUBLIC producer cannot be accepted');return run;
}
/** Call before the browser process; pass this exact object back after capture. */
export function capturePublicOrigin({spec,run,job,expectedJob,env=process.env}){
 const source=sourceStamp(spec);assert.equal(env.GITHUB_ACTIONS,'true');assert.equal(env.GITHUB_REPOSITORY,PUBLIC_REPOSITORY);assert.equal(env.GITHUB_REF,'refs/heads/main');assert.equal(env.GITHUB_EVENT_NAME,'push');assert.equal(env.GITHUB_RUN_ATTEMPT,'1');
 hex(env.GITHUB_SHA,40,'Inherited PUBLIC SHA');assert.match(env.GITHUB_RUN_ID||'',/^[1-9][0-9]*$/);const runId=Number(env.GITHUB_RUN_ID);integer(runId,'Inherited PUBLIC run');
 assert.notEqual(runId,source.sourceReview.runId,'SOURCE run is not a PUBLIC producer');assert.notEqual(env.GITHUB_SHA,source.sourceCommit,'SOURCE commit is not a PUBLIC producer');
 assertedPublicRun(run,env.GITHUB_SHA,runId);object(expectedJob,'Known PUBLIC job required');assert.match(expectedJob.key||'',/^[A-Za-z0-9_-]+$/);assert.equal(env.GITHUB_JOB,expectedJob.key);
 integer(job?.id,'Actual PUBLIC job ID');assert.equal(job.run_id,runId);assert.equal(job.run_attempt,1);assert.equal(job.head_sha,env.GITHUB_SHA);assert.equal(job.name,expectedJob.name);assert.equal(job.html_url,jobURL(runId,job.id));
 assert.ok(['in_progress','completed'].includes(job.status));if(job.status==='completed')assert.equal(job.conclusion,'success');
 return Object.freeze({kind:'github-actions-public-capture',repository:PUBLIC_REPOSITORY,ref:'refs/heads/main',event:'push',publisherCommit:env.GITHUB_SHA,
  publicationRun:runId,publicationRunAttempt:1,workflow:run.path,jobKey:expectedJob.key,jobName:job.name,jobId:job.id,runURL:runURL(runId),jobURL:job.html_url});
}
function assertOrigin(origin,{spec,run,job,expectedJob}){
 const env={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:origin.repository,GITHUB_REF:origin.ref,GITHUB_EVENT_NAME:origin.event,GITHUB_RUN_ATTEMPT:String(origin.publicationRunAttempt),
  GITHUB_SHA:origin.publisherCommit,GITHUB_RUN_ID:String(origin.publicationRun),GITHUB_JOB:origin.jobKey};
 assert.deepEqual(origin,capturePublicOrigin({spec,run,job,expectedJob,env}));return origin;
}
function assertCaptureURL(value,base,mode){
 assert.equal(base,PUBLIC_CAMPAIGN_URL);assert.equal(typeof value,'string');const url=new URL(value);assert.equal(url.origin,'https://amazin20.github.io');assert.equal(url.pathname,'/brainrot-portal/campaign-v56/');assert.equal(url.hash,'');
 if(mode==='bare')assert.equal(url.href,base,'Actual bare PUBLIC URL required');else if(mode==='storage-debug'){assert.equal(url.search,'?debug=1','Exact actual storage observer query required');}else{assert.equal(mode,'campaign');const allowed=new Set(['edition','level','debug']);for(const key of url.searchParams.keys())assert.ok(allowed.has(key),'Unapproved PUBLIC capture query');
  assert.equal(url.searchParams.get('edition'),'foundation');assert.match(url.searchParams.get('level')||'',/^(?:[1-9]|[1-4][0-9]|5[01])$/);assert.equal(url.searchParams.get('debug'),'1');
  assert.equal([...url.searchParams].length,3,'Exact campaign query required');}
 return url.href;
}
function candidateMetadata(bytes,spec,candidateFiles){
 assert.ok(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=METADATA_LIMIT,'Actual candidate build-info bytes required');checkedRows(candidateFiles);
 const row=candidateFiles.find(r=>r.path==='build-info.json');assert.ok(row,'Candidate metadata missing');assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256,'Public metadata is not the exact SOURCE build');
 const value=JSON.parse(bytes);assert.equal(value.commit,spec.sourceCommit);assert.equal(value.gameCommit,spec.sourceCommit);assert.equal(value.interfaceCommit,spec.sourceCommit);assert.equal(value.publisherCommit,null);
 assert.equal(value.run,String(spec.sourceReview.runId));assert.equal(value.verified,false);assert.equal(value.version,'v56-living-campaign');hex(value.sourceInputsSha256,64,'Candidate SOURCE inputs');
 assert.deepEqual(value.runtimeConfig,{chamberEdition:'foundation',puzzleProgression:true,campaignSequencePresentation:true,room23PhysicalPrototype:true});
 assert.deepEqual(value.rooms.map(r=>r.stableLevel),[...Array.from({length:40},(_,i)=>i+1),...Array.from({length:10},(_,i)=>i+42),41]);assert.deepEqual(value.rooms.map(r=>r.level),Array.from({length:51},(_,i)=>i+1));
 const files=candidateFiles.filter(r=>!['build-info.json','release-manifest.json'].includes(r.path));assert.deepEqual(value.files,files);assert.equal(value.packageFilesSha256,rowsSha(files));return value;
}
/** A byte-preserving envelope; save it outside directory before artifact upload. */
export function wrapPublicCapture({directory,reportPath='report.json',origin,spec,run,job,expectedJob,buildInfoBytes,candidateFiles,expectedURLs,mode='campaign',assertReport}){
 const inputSnapshot=clone({origin,spec,run,job,expectedJob,candidateFiles,expectedURLs}),metadataSnapshot=Buffer.from(buildInfoBytes);
 assertOrigin(origin,{spec,run,job,expectedJob});sourceStamp(spec);const metadata=candidateMetadata(buildInfoBytes,spec,candidateFiles);safeName(reportPath);
 const files=publicProofInventory(directory);checkedRows(files);const reportRow=files.find(row=>row.path===reportPath);assert.ok(reportRow,'Actual PUBLIC report absent');assert.ok(reportRow.bytes<=METADATA_LIMIT);
 const report=readJSON(path.join(directory,reportPath));assert.equal(report.pass,true);assert.deepEqual(report.errors,[]);assert.equal(report.failure,undefined);if('sourceCommit'in report)assert.equal(report.sourceCommit,spec.sourceCommit);else assert.equal(report.package?.commit,spec.sourceCommit,'Frozen menu producer is bound through its unchanged package stamp');
 const reportSnapshot=clone(report),parsedMetadataSnapshot=clone(metadata);
 if('sourceTree'in report)assert.equal(report.sourceTree,spec.sourceTree);if('sourceReview'in report)assert.deepEqual(report.sourceReview,spec.sourceReview);
 if('localPreparation'in report)assert.equal(report.localPreparation,false);if('publicationAccepted'in report)assert.equal(report.publicationAccepted,false);
 if(mode==='bare')assert.ok('producerOrigin'in report,'Bare PUBLIC emitter must retain its actual producer');
 if('producerOrigin'in report)assert.deepEqual(report.producerOrigin,{kind:'github-actions',repository:PUBLIC_REPOSITORY,headSha:origin.publisherCommit,runId:origin.publicationRun,runAttempt:1,job:origin.jobKey},'Report producer must be the actual PUBLIC process');
 assert.deepEqual(report.package,{commit:metadata.commit,version:metadata.version,editionVersion:metadata.editionVersion,sourceInputsSha256:metadata.sourceInputsSha256});
 assert.ok(Array.isArray(expectedURLs)&&expectedURLs.length>0&&new Set(expectedURLs).size===expectedURLs.length);expectedURLs.forEach(url=>assertCaptureURL(url,spec.publicURL,mode));
 // Requested bases are configuration, while actualURLs must come from browser
 // observations retained and checked by the independent semantic callback.
 if('url'in report)assert.equal(report.url,spec.publicURL,'Wrong requested PUBLIC base');if('base'in report)assert.equal(report.base,spec.publicURL);
 assert.equal(typeof assertReport,'function','Independent report/URL/capture semantics required');const semantics=assertReport(report,{directory,metadata,requestedBaseURL:spec.publicURL,expectedURLs:clone(expectedURLs),origin});
 assert.ok(semantics&&semantics.pass===true,'Independent PUBLIC report semantics failed');assert.deepEqual(semantics.actualURLs,expectedURLs,'Actual browser URLs must be independently observed');
 const required=semantics.requiredFiles;assert.ok(Array.isArray(required)&&required.length>0);assert.equal(new Set(required).size,required.length);required.forEach(name=>assert.ok(files.some(row=>row.path===safeName(name)),'Required actual capture absent'));
 assert.deepEqual(publicProofInventory(directory),files,'Capture bytes changed while wrapping');
 assert.deepEqual(clone({origin,spec,run,job,expectedJob,candidateFiles,expectedURLs}),inputSnapshot,'Capture inputs changed during semantic callback');assert.deepEqual(buildInfoBytes,metadataSnapshot,'Candidate metadata changed during semantic callback');
 assert.deepEqual(report,reportSnapshot,'Semantic callback changed parsed report');assert.deepEqual(metadata,parsedMetadataSnapshot,'Semantic callback changed parsed metadata');
 candidateMetadata(buildInfoBytes,spec,candidateFiles);
 return {schemaVersion:1,kind:'campaign-v56-public-capture-envelope',pass:true,publicationAccepted:false,source:sourceStamp(spec),producerOrigin:clone(origin),
  requestedBaseURL:spec.publicURL,publicURLs:clone(expectedURLs),mode,report:clone(reportRow),candidateBuildInfo:{bytes:buildInfoBytes.length,sha256:sha(buildInfoBytes),sourceRun:spec.sourceReview.runId},
  files,bytes:files.reduce((n,row)=>n+row.bytes,0),inventorySha256:rowsSha(files),requiredFiles:clone(required),semantics:clone(semantics)};
}
export function validatePublicCapture(envelope,options){
 object(envelope,'PUBLIC envelope required');assert.equal(envelope.schemaVersion,1);assert.equal(envelope.kind,'campaign-v56-public-capture-envelope');assert.equal(envelope.pass,true);assert.equal(envelope.publicationAccepted,false);
 const actual=wrapPublicCapture({...options,reportPath:envelope.report.path,origin:envelope.producerOrigin});assert.deepEqual(envelope,actual,'PUBLIC capture envelope differs from fresh actual bytes/origin');return actual;
}

function historicalIdentity(){return {sourceCommit:R5.sourceCommit,publisherCommit:R5.publisher,publicationRun:R5.publicationRun,sourceReview:clone(R5.sourceReview)};}
function exactR5Config(config){
 assert.equal(config.repository,PUBLIC_REPOSITORY);for(const key of ['publisher','tree','parent','sourceCommit','sourceTree','sourceReview','publicationRun','publicationRunAttempt'])assert.deepEqual(config[key],R5[key]);
 assert.equal(config.frozenHelperSha256,R5.frozenHelperSha256);assert.equal(config.siteFiles,R5.files);assert.equal(config.siteBytes,R5.bytes);assert.equal(config.siteInventorySha256,R5.inventorySha256);assert.equal(config.packageBindingSha256,R5.packageBindingSha256);
 assert.deepEqual(config.limits,{privateProofBytes:2_000_000_000,packetBytes:PACKET_LIMIT,metadataBytes:METADATA_LIMIT});
 assert.equal(config.artifact.id,R5.fullArtifactId);assert.equal(config.artifact.size_in_bytes,R5.fullArtifactBytes);assert.equal(config.artifact.digest,'sha256:'+R5.fullArtifactSha256);
 assert.equal(config.branch,R5.rescueBranch);assert.equal(config.workflow,R5.rescueWorkflow);return config;
}
function assertArtifact(artifact,{run,commit,name}){
 integer(artifact?.id,'Actual artifact ID');integer(artifact.size_in_bytes,'Actual artifact bytes',{maximum:2_000_000_000});assert.match(artifact.digest||'',/^sha256:[a-f0-9]{64}$/);assert.equal(artifact.expired,false);
 assert.equal(artifact.name,name);assert.equal(artifact.workflow_run?.id,run);assert.equal(artifact.workflow_run.head_sha,commit);assert.equal(artifact.workflow_run.repository_id,1354625251);assert.equal(artifact.workflow_run.head_repository_id,1354625251);
}
function r5Core(directory){
 const binding=readJSON(path.join(directory,'package-binding.json')),castle=readJSON(path.join(directory,'public-native/evidence.json')),room20=readJSON(path.join(directory,'public-foundation20/foundation20-native-report.json'));
 const names=['manifest.json','package-binding.json','public-bytes.json','public-native/evidence.json','public-native/camera-observation.json',
  'public-foundation20/foundation20-native-report.json','public-foundation20/foundation20-native-camera.json','public-foundation20/foundation20-telemetry.jsonl','public-foundation20/foundation20-native-pixels.log',
  'review-artifacts/native-foundation20/foundation20-native-report.json','review-artifacts/native-foundation20/binding.json','review-artifacts/native-foundation20/foundation20-native-camera.json','review-artifacts/native-foundation20/foundation20-telemetry.jsonl'];
 for(const [prefix,report]of[['public-native/',castle],['public-foundation20/',room20]]){assert.match(report.video?.filename||'',/^[A-Za-z0-9_-]+\.mp4$/);names.push(prefix+report.video.filename);}
 for(const suffix of ['source.json','package.json']){const rows=binding.artifacts?.source?.files;assert.ok(Array.isArray(rows));const found=rows.filter(row=>row.path===suffix||row.path.endsWith('/'+suffix));assert.equal(found.length,1,'Unique original SOURCE camera input required');names.push('review-artifacts/source/'+safeName(found[0].path));}
 return {names:sorted(names),binding,castle,room20};
}
/** Default independently executes every unchanged R5 semantic packet check. */
export function runFrozenR5PacketSemantics({directory,helperPath=fileURLToPath(new URL('../publish-tower41-native.py',import.meta.url))}){
 helperPath=ordinary(helperPath);assert.equal(fileSha(helperPath),R5.frozenHelperSha256,'Unchanged frozen R5 helper required');const core=r5Core(directory),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'campaign-v56-r5-'));
 try{const curated=path.join(temporary,'proof');fs.mkdirSync(curated);for(const name of core.names){const target=path.join(curated,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(ordinary(path.join(directory,name)),target);}
  const code='import importlib.util,sys,types\ns=importlib.util.spec_from_file_location("frozen_r5",sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\na=types.SimpleNamespace(proof=sys.argv[2],output=sys.argv[3],source=sys.argv[4],publisher=sys.argv[5],run=sys.argv[6],review_run=sys.argv[7],review_attempt="1")\nm.verification_bundle(a)';
  const result=execFileSync('python3',['-c',code,helperPath,curated,path.join(temporary,'packet'),R5.sourceCommit,R5.publisher,String(R5.publicationRun),String(R5.sourceReview.runId)],{encoding:'utf8',timeout:300_000,maxBuffer:METADATA_LIMIT});
  const receipt=JSON.parse(result.trim());assert.equal(receipt.pass,true);assert.equal(fileSha(helperPath),R5.frozenHelperSha256);return {pass:true,frozenHelperSha256:R5.frozenHelperSha256,historicalPublic:historicalIdentity(),siteFiles:R5.files,siteBytes:R5.bytes,siteInventorySha256:R5.inventorySha256};
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
export function decodeActualR5Movie({file,video}){
 file=ordinary(file);const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',file],{encoding:'utf8',timeout:300_000,maxBuffer:METADATA_LIMIT}));
 assert.equal(probe.streams.length,1);const stream=probe.streams[0];assert.equal(stream.codec_type,'video');assert.equal(stream.codec_name,'h264');assert.equal(stream.width,640);assert.equal(stream.height,360);assert.equal(stream.avg_frame_rate,'4/1');
 integer(video.frames,'Complete actual movie frame count');assert.equal(Number(stream.nb_read_frames),video.frames);assert.ok(Math.abs(Number(probe.format.duration)-video.durationSeconds)<.01,'Actual movie duration differs');
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-xerror','-i',file,'-f','null','-'],{stdio:'pipe',timeout:300_000,maxBuffer:METADATA_LIMIT});
 return {pass:true,sha256:fileSha(file),bytes:fs.statSync(file).size,frames:video.frames,width:640,height:360,fps:4,fullyDecoded:true};
}
/** ZIP is freshly authenticated; callback must read every member and CRC via the safe Python verifier. */
export async function validateExactR5Packet({directory,zip,artifact,config,verifyExtracted,assertSemantics=runFrozenR5PacketSemantics,decodeMovie=decodeActualR5Movie}){
 const configSnapshot=clone(config),artifactSnapshot=clone(artifact);
 exactR5Config(config);const producerRun=artifact.workflow_run?.id,producerCommit=artifact.workflow_run?.head_sha;integer(producerRun,'Actual rescue artifact run');hex(producerCommit,40,'Actual rescue artifact commit');
 assert.notEqual(producerRun,R5.publicationRun);assert.notEqual(producerRun,R5.sourceReview.runId);assert.notEqual(producerCommit,R5.publisher);assert.notEqual(producerCommit,R5.sourceCommit);assert.equal(artifact.workflow_run.head_branch,R5.rescueBranch);
 assertArtifact(artifact,{run:producerRun,commit:producerCommit,name:'r5-public-verification-packet-'+producerRun+'-1'});
 directory=ordinary(directory,true);zip=ordinary(zip);integer(artifact.size_in_bytes,'Bounded received packet ZIP',{maximum:PACKET_LIMIT});assert.equal(fs.statSync(zip).size,artifact.size_in_bytes);assert.equal('sha256:'+fileSha(zip),artifact.digest,'Received packet ZIP hash mismatch');
 assert.equal(typeof verifyExtracted,'function','Independent safe ZIP/member/CRC verifier required');const verified=await verifyExtracted({zip,directory,expectedBytes:artifact.size_in_bytes,expectedSha256:artifact.digest.slice(7)});
 assert.equal(verified?.pass,true);assert.equal(verified.zipBytes,artifact.size_in_bytes);assert.equal(verified.zipSha256,artifact.digest.slice(7));const initial=publicProofInventory(directory);assert.deepEqual(verified.files,initial,'ZIP verifier must cover every received member');
 assert.equal(verified.bytes,initial.reduce((n,r)=>n+r.bytes,0));assert.equal(verified.inventorySha256,rowsSha(initial));const descriptor=initial.find(r=>r.path==='verification-packet.json');assert.ok(descriptor&&descriptor.bytes<=METADATA_LIMIT);
 const packet=readJSON(path.join(directory,'verification-packet.json')),packetSnapshot=clone(packet),verifiedSnapshot=clone(verified);assert.equal(packet.schemaVersion,1);assert.equal(packet.kind,'foundation20-and-tower41-native-public-verification-packet');assert.equal(packet.pass,true);
 for(const [key,value]of Object.entries(historicalIdentity()))assert.deepEqual(packet[key],value,'Original PUBLIC tuple changed');assert.equal(packet.maximumBytes,PACKET_LIMIT);
 for(const key of ['fullPrivateProofRequiredForFinalAcceptance','independentPublicUnionReconstructionRequiredForCheckpointAcceptance'])assert.equal(packet[key],true);
 for(const key of ['fullPrivateArchiveBytesDownloaded','fullPrivateNestedArchiveAudited','privateArchiveAccepted','imagesIncluded','productionIncluded','sourceCodeIncluded','nestedArchivesIncluded'])assert.equal(packet[key],false,'Packet scope cannot be widened');
 const files=initial.filter(row=>row.path!=='verification-packet.json');assert.equal(checkedRows(packet.files),packet.bytes);assert.deepEqual(packet.files,files,'Deleted/extra/changed packet member');assert.equal(packet.filesSha256,rowsSha(files));assert.ok(packet.bytes+descriptor.bytes<=PACKET_LIMIT);
 for(const row of files)if(!row.path.endsWith('.mp4'))assert.ok(row.bytes<=METADATA_LIMIT,'R5 metadata byte limit');
 const core=r5Core(directory);core.names.forEach(name=>assert.ok(files.some(row=>row.path===name),'Mandatory original PUBLIC proof missing'));
 const rescue=readJSON(path.join(directory,'read-only-transport-rescue.json'));assert.equal(rescue.kind,'R5-public-proof-transport-rescue');assert.equal(rescue.pass,true);assert.equal(rescue.publicationAccepted,false);
 for(const [key,value]of Object.entries(historicalIdentity()))assert.deepEqual(rescue[key],value);assert.equal(rescue.publicationRunAttempt,1);assert.equal(rescue.originalCIConclusion,'failure');
 assert.deepEqual(rescue.originalArtifact,config.artifact);assert.equal(rescue.allOriginalMembersCRCChecked,true);for(const key of ['nestedArchivePayloadsAudited','newDeployment','newRouteCapture'])assert.equal(rescue[key],false);
 const transport={repository:PUBLIC_REPOSITORY,branch:R5.rescueBranch,commit:producerCommit,runId:producerRun,runAttempt:1,runURL:runURL(producerRun),scope:'Read-only transport producer; never a new public capture or deployment'};
 assert.deepEqual(rescue.transportProducer,transport);assert.deepEqual(rescue.freshHTTPProducer,transport);assert.equal(rescue.freshReadOnlyHTTPReceipt,'transport-current-public-bytes.json');
 checkedRows(rescue.allOriginalZipMembers,{maximum:2_000_000_000});assert.equal(rescue.allOriginalZipMembersSha256,rowsSha(rescue.allOriginalZipMembers));
 const originalRows=new Map(rescue.allOriginalZipMembers.map(row=>[row.path,row]));core.names.forEach(name=>assert.deepEqual(files.find(row=>row.path===name),originalRows.get(name),'Selected member is not bound to the original restored ZIP'));
 const freshHTTP=readJSON(path.join(directory,rescue.freshReadOnlyHTTPReceipt));for(const [key,value]of Object.entries(historicalIdentity()))assert.deepEqual(freshHTTP[key],value);assert.equal(freshHTTP.pass,true);assert.equal(freshHTTP.phase,'published');assert.equal(freshHTTP.checked,R5.files);assert.equal(freshHTTP.bytes,R5.bytes);assert.equal(freshHTTP.siteFilesSha256,R5.inventorySha256);
 const manifest=readJSON(path.join(directory,'manifest.json'));for(const [key,value]of Object.entries(historicalIdentity()))assert.deepEqual(manifest[key],value);
 assert.equal(manifest.phase,'published');assert.equal(manifest.siteFiles.length,R5.files);assert.equal(checkedRows(manifest.siteFiles,{maximum:700_000_000}),R5.bytes);assert.equal(rowsSha(manifest.siteFiles),R5.inventorySha256);assert.equal(manifest.siteBytes,R5.bytes);assert.equal(manifest.siteFilesSha256,R5.inventorySha256);
 assert.deepEqual(core.binding,manifest.packageBinding);assert.equal(fileSha(path.join(directory,'package-binding.json')),R5.packageBindingSha256);assert.equal(manifest.packageBindingSha256,R5.packageBindingSha256);
 const post=readJSON(path.join(directory,'public-bytes.json'));for(const [key,value]of Object.entries(historicalIdentity()))assert.deepEqual(post[key],value);assert.equal(post.pass,true);assert.equal(post.phase,'published');assert.equal(post.checked,R5.files);assert.equal(post.bytes,R5.bytes);assert.equal(post.siteFilesSha256,R5.inventorySha256);
 assert.equal(typeof assertSemantics,'function');const semantic=await assertSemantics({directory,config,packet});assert.equal(semantic?.pass,true);assert.equal(semantic.frozenHelperSha256,R5.frozenHelperSha256);assert.deepEqual(semantic.historicalPublic,historicalIdentity());
 assert.equal(semantic.siteFiles,R5.files);assert.equal(semantic.siteBytes,R5.bytes);assert.equal(semantic.siteInventorySha256,R5.inventorySha256);
 const semanticSnapshot=clone(semantic);
 assert.equal(typeof decodeMovie,'function');const movies=[];for(const [entry,prefix,report]of[['foundation20','public-foundation20/',core.room20],['tower41','public-native/',core.castle]]){
  const name=prefix+report.video.filename,row=files.find(row=>row.path===name);assert.equal(row.sha256,report.video.sha256);if('bytes'in report.video)assert.equal(row.bytes,report.video.bytes);
  const decoded=await decodeMovie({file:path.join(directory,name),video:clone(report.video),entry});assert.equal(decoded?.pass,true);assert.equal(decoded.fullyDecoded,true);assert.equal(decoded.bytes,row.bytes);assert.equal(decoded.sha256,row.sha256);assert.equal(decoded.frames,report.video.frames);assert.equal(decoded.width,640);assert.equal(decoded.height,360);assert.equal(decoded.fps,4);movies.push({entry,path:name,bytes:row.bytes,sha256:row.sha256,frames:decoded.frames,fullyDecoded:true});
 }
 assert.deepEqual(packet.completePublicMovies,movies.map(({entry,path,bytes,sha256})=>({entry,path,bytes,sha256})));assert.deepEqual(packet.completePublicMovie,packet.completePublicMovies[1]&&{path:packet.completePublicMovies[1].path,bytes:packet.completePublicMovies[1].bytes,sha256:packet.completePublicMovies[1].sha256});
 assert.deepEqual(publicProofInventory(directory),initial,'Received packet drift during independent audit');assert.equal(fs.statSync(zip).size,artifact.size_in_bytes);assert.equal('sha256:'+fileSha(zip),artifact.digest);
 assert.deepEqual(config,configSnapshot,'Packet callback changed frozen config');assert.deepEqual(artifact,artifactSnapshot,'Packet callback changed artifact pin');assert.deepEqual(packet,packetSnapshot,'Packet callback changed parsed receipt');assert.deepEqual(verified,verifiedSnapshot,'Packet callback changed CRC/member receipt');
 assert.deepEqual(semantic,semanticSnapshot,'Movie callback changed validated semantic receipt');
 return {pass:true,publicationAccepted:false,originalCIConclusion:'failure',originalFailureScope:'packet-transport-budget-only',historicalPublic:{...historicalIdentity(),sourceTree:R5.sourceTree,publicationRunAttempt:1},
  rescueTransport:transport,artifact:clone(artifact),packetSha256:descriptor.sha256,packetBytes:descriptor.bytes,packetInventorySha256:packet.filesSha256,receivedInventorySha256:rowsSha(initial),receivedBytes:initial.reduce((n,r)=>n+r.bytes,0),movies,semantics:semanticSnapshot};
}
function sortedJobs(jobs){return jobs.slice().sort((a,b)=>a.id-b.id);}
function logBuffer(log){assert.ok(Buffer.isBuffer(log?.data),'Complete raw provider log bytes required');return log.data;}
function assertLogRows(logs,pins){
 assert.ok(Array.isArray(logs)&&Array.isArray(pins));assert.equal(logs.length,pins.length);assert.equal(new Set(logs.map(log=>log.jobId)).size,pins.length);
 for(const pin of pins){integer(pin.jobId,'Log job ID');integer(pin.bytes,'Full provider log bytes',{maximum:20_000_000});hex(pin.sha256,64,'Full provider log hash');const found=logs.find(log=>log.jobId===pin.jobId);const bytes=logBuffer(found);assert.equal(bytes.length,pin.bytes);assert.equal(sha(bytes),pin.sha256,'Provider raw log changed');}
}
function assertExactHistoricalProvider(config,original){
 const run=original.run;for(const key of ['id','head_sha','head_branch','path','event','run_attempt','status','conclusion'])assert.deepEqual(run[key],config.run[key]);assert.equal(run.repository?.full_name,PUBLIC_REPOSITORY);assert.equal(run.id,R5.publicationRun);assert.equal(run.head_sha,R5.publisher);assert.equal(run.run_attempt,1);assert.equal(run.status,'completed');assert.equal(run.conclusion,'failure');
 assert.equal(run.head_branch,'main');assert.equal(run.path,'.github/workflows/publish-puzzle-progression-finale.yml');assert.equal(run.event,'push');
 assert.equal(original.gitCommit.sha,R5.publisher);assert.equal(original.gitCommit.tree.sha,R5.tree);assert.deepEqual(original.gitCommit.parents.map(row=>row.sha),[R5.parent]);
 const summary=job=>Object.fromEntries(['id','name','head_sha','run_id','run_attempt','status','conclusion','started_at','completed_at','steps'].map(key=>[key,job[key]]));
 assert.equal(original.jobs.length,2);assert.deepEqual(sortedJobs(original.jobs).map(summary),sortedJobs(config.jobs).map(summary));
 const publicJob=original.jobs.find(job=>job.id===R5.publicJobId),assembly=original.jobs.find(job=>job.id===R5.assemblyJobId);assert.ok(publicJob&&assembly);assert.equal(assembly.conclusion,'success');assert.equal(publicJob.conclusion,'failure');
 assert.equal(assembly.name,'Assemble the exact reviewed preview without changing the current site');assert.equal(publicJob.name,'Verify every existing byte, append the preview and execute its actual public ordinary journey');
 const failed=publicJob.steps.filter(step=>step.conclusion==='failure');assert.equal(failed.length,1);assert.equal(failed[0].number,17);assert.equal(failed[0].name,'Prepare the bounded independent verification packet after successful public acceptance');
 for(let number=7;number<=16;number++){const rows=publicJob.steps.filter(step=>step.number===number);assert.equal(rows.length,1);assert.equal(rows[0].status,'completed');assert.equal(rows[0].conclusion,'success');}
 assertLogRows(original.logs,[{jobId:R5.publicJobId,bytes:R5.publicLogBytes,sha256:R5.publicLogSha256},{jobId:R5.assemblyJobId,bytes:R5.assemblyLogBytes,sha256:R5.assemblyLogSha256}]);
 assert.ok(logBuffer(original.logs.find(log=>log.jobId===R5.publicJobId)).includes(Buffer.from('ValueError: Verification packet exceeds bounded transport budget')));
 assertArtifact(original.artifact,{run:R5.publicationRun,commit:R5.publisher,name:'tower41-native-publication-proof-38366134401-1'});
 for(const key of ['id','name','size_in_bytes','digest','expired','workflow_run'])assert.deepEqual(original.artifact[key],config.artifact[key]);
}
function assertLease(rows){
 assert.ok(Array.isArray(rows)&&rows.length>0);const current=rows.slice().sort((a,b)=>b.id-a.id)[0];integer(current.id,'Current deployment');assert.equal(current.id,R5.deploymentId,'Unknown newer deployment blocks this exact recovery');assert.equal(current.sha,R5.publisher);
 assert.ok(['success','failure','error','inactive'].includes(current.state));assert.equal(current.logUrl,jobURL(R5.publicationRun,R5.publicJobId),'Exact original deployment job required');return clone(current);
}
/** Narrow acceptance of original physical/byte proof; original CI remains failure. */
export function validateExactR5TransportAcceptance({config,original,rescue,packet,rootAudit,deployments}){
 exactR5Config(config);assertExactHistoricalProvider(config,original);const pin=object(config.rescue,'Actual successful rescue pins are required');assert.deepEqual(rescue.run,pin.run);assert.deepEqual(sortedJobs(rescue.jobs),sortedJobs(pin.jobs));assert.deepEqual(rescue.gitCommit,pin.gitCommit);
 const run=rescue.run;integer(run.id,'Actual rescue run');assert.notEqual(run.id,R5.publicationRun);assert.notEqual(run.id,R5.sourceReview.runId);hex(run.head_sha,40,'Actual rescue commit');assert.notEqual(run.head_sha,R5.publisher);assert.notEqual(run.head_sha,R5.sourceCommit);
 assert.equal(run.head_branch,R5.rescueBranch);assert.equal(run.path,R5.rescueWorkflow);assert.equal(run.event,'push');assert.equal(run.run_attempt,1);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');assert.equal(run.repository?.full_name,PUBLIC_REPOSITORY);assert.equal(run.html_url,runURL(run.id));
 assert.equal(rescue.gitCommit.sha,run.head_sha);hex(rescue.gitCommit.tree.sha,40,'Actual rescue tree');assert.deepEqual(rescue.gitCommit.parents.map(row=>row.sha),[R5.publisher]);
 assert.equal(rescue.jobs.length,1);const job=rescue.jobs[0];integer(job.id,'Actual rescue job');assert.equal(job.run_id,run.id);assert.equal(job.run_attempt,1);assert.equal(job.head_sha,run.head_sha);assert.equal(job.status,'completed');assert.equal(job.conclusion,'success');assert.equal(job.html_url,jobURL(run.id,job.id));
 assert.equal(job.name,'Independently restore the exact completed PUBLIC proof and retain bounded transport');
 assert.ok(Array.isArray(job.steps)&&job.steps.length>0);assert.equal(new Set(job.steps.map(step=>step.number)).size,job.steps.length);job.steps.forEach(step=>{integer(step.number,'Actual step number');assert.equal(step.status,'completed');assert.equal(step.conclusion,'success','Every rescue step must succeed');});
 const requiredSteps={2:'Run actions/checkout@v4',3:'Test the narrow read-only transport guard',4:'Install the declared movie decoder',
  5:'Authenticate the exact completed publication, restore all ZIP bytes and verify every member CRC',6:'Decode both actual PUBLIC movies and run the unchanged frozen semantic packet validator',
  7:'Retain the bounded original PUBLIC evidence with distinct read-only transport provenance',8:'Retain restore inventory and actual provider receipts including failures'};
 for(const [number,name]of Object.entries(requiredSteps))assert.equal(job.steps.find(step=>step.number===Number(number))?.name,name,'Required exact rescue operation missing');
 const uploads=job.steps.filter(step=>/actions\/upload-artifact@v4/.test(step.name)||step.name.startsWith('Retain '));assert.equal(uploads.length,2,'Both actual rescue artifact upload steps required');
 assert.equal(rescue.artifacts.length,2);assert.equal(new Set(rescue.artifacts.map(row=>row.id)).size,2);assert.deepEqual(rescue.artifacts.slice().sort((a,b)=>a.id-b.id),pin.artifacts.slice().sort((a,b)=>a.id-b.id));
 for(const [prefix,index]of[['r5-public-verification-packet-',0],['r5-public-transport-receipts-',1]]){const artifact=rescue.artifacts.find(row=>row.name===prefix+run.id+'-1');assert.ok(artifact);assertArtifact(artifact,{run:run.id,commit:run.head_sha,name:prefix+run.id+'-1'});
  const at=Date.parse(artifact.created_at),step=uploads[index];assert.ok(Number.isFinite(at)&&at>=Date.parse(step.started_at)-2000&&at<=Date.parse(step.completed_at)+2000,'Rescue artifact is not from its actual successful upload');}
 assertLogRows(rescue.logs,pin.logs);assert.deepEqual(pin.logs.map(row=>row.jobId),[job.id]);
 const uploadLog=logBuffer(rescue.logs[0]).toString('utf8');for(const artifact of rescue.artifacts){assert.ok(uploadLog.includes('Artifact '+artifact.name+' has been successfully uploaded! Final size is '+artifact.size_in_bytes+' bytes. Artifact ID is '+artifact.id),'Complete rescue job log must authenticate each upload');assert.ok(uploadLog.includes('SHA256 digest of uploaded artifact zip is '+artifact.digest.slice(7)));}
 assert.equal(packet.pass,true);assert.equal(packet.publicationAccepted,false);assert.equal(packet.originalCIConclusion,'failure');assert.equal(packet.originalFailureScope,'packet-transport-budget-only');assert.deepEqual(packet.historicalPublic,{...historicalIdentity(),sourceTree:R5.sourceTree,publicationRunAttempt:1});
 const artifact=rescue.artifacts.find(row=>row.name.startsWith('r5-public-verification-packet-'));assert.deepEqual(packet.artifact,artifact);
 assert.deepEqual(packet.rescueTransport,{repository:PUBLIC_REPOSITORY,branch:R5.rescueBranch,commit:run.head_sha,runId:run.id,runAttempt:1,runURL:runURL(run.id),scope:'Read-only transport producer; never a new public capture or deployment'});
 assert.ok(Buffer.isBuffer(rootAudit)&&rootAudit.length>0&&rootAudit.length<=METADATA_LIMIT,'Actual independent root audit bytes required');assert.equal(rootAudit.length,pin.rootAudit?.bytes);assert.equal(sha(rootAudit),pin.rootAudit.sha256);const audit=JSON.parse(rootAudit);
 assert.equal(audit.pass,true);assert.equal(audit.baselinePublicAccepted,true);assert.equal(audit.originalCIConclusion,'failure');assert.equal(audit.failureScope,'packet-transport-budget-only');assert.deepEqual(audit.historicalPublic,packet.historicalPublic);
 assert.deepEqual(audit.rescueTransport,{commit:run.head_sha,tree:rescue.gitCommit.tree.sha,runId:run.id,runAttempt:1});assert.deepEqual(audit.packet,{artifactId:artifact.id,digest:artifact.digest,inventorySha256:packet.packetInventorySha256,bytes:packet.packetBytes,sha256:packet.packetSha256});
 const lease=assertLease(deployments);return {pass:true,baselinePhysicalAndBytesAccepted:true,originalCIConclusion:'failure',originalFailureScope:'packet-transport-budget-only',
  historicalPublic:clone(packet.historicalPublic),rescueTransport:clone(audit.rescueTransport),packet:clone(audit.packet),rootAudit:{bytes:rootAudit.length,sha256:sha(rootAudit)},latestDeployment:lease,
  scope:'Exact original completed R5 PUBLIC physical/byte proof accepted through independently audited transport; original CI conclusion remains failure.'};
}

