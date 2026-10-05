/** Verify the pinned 51-room publication without modifying its candidate bytes.
 * Run after deployment; --local-only checks an assembled site without Chrome.
 * Large MP4s and historical files are hashed as streams, with at most four
 * simultaneous public requests. Never use response.arrayBuffer() for them. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {expeditionJobNames,expeditionArtifactPins,expeditionRecordingLevels,expeditionRecordingGroups,assertExpeditionConfig,assertPublishableExpedition,assertExpeditionInfo,assertRecording,safeRelative,readJSON} from './lib/expedition-proof.mjs';
import {waitForStartMenu,activate} from './lib/singularity-ui-check.mjs';

const HASH=/^[a-f0-9]{64}$/;
const COMMIT=/^[a-f0-9]{40}$/;
const settingsKey='brainrot-foundation-v1:brainrot-portal.preferences.v24';
const alternateRoutes=new Map([[48,'staged-cargo'],[49,'unlit-mirror'],[50,'free-cargo-bridge'],[51,'prearmed-relay']]);
const supplementalLevels=Array.from({length:40},(_,index)=>index+1).filter(level=>![14,28].includes(level));
const historicalRecordingSource='8f63b6270b97fd0f1cb9d0cd9b07ef31bc3af4f6';
const allRecordings=release=>[...release.newRecordings,...(release.alternateRecordings||[])];
const supplementalEvidenceFiles=release=>release.supplementalRecordingProof?.captureSourceEvidence||[];
const generatedPresentationPaths=config=>['walkthroughs.js','walkthroughs.html','walkthroughs/manifest.json','walkthroughs/history.html',...['preview-release.json','walkthrough.html','recording-evidence.json','native-evidence.json','ui-evidence.json'].map(file=>config.previewPath+'/'+file)].sort();

export async function hashLocalFile(filename){
 const hash=createHash('sha256');let bytes=0;
 for await(const chunk of fs.createReadStream(filename)){hash.update(chunk);bytes+=chunk.length;}
 return {bytes,sha256:hash.digest('hex')};
}
async function localManifest(directory){
 const paths=[];
 function visit(current){for(const entry of fs.readdirSync(current,{withFileTypes:true})){
  const filename=path.join(current,entry.name);assert.ok(!entry.isSymbolicLink(),'Candidate symlink: '+filename);
  if(entry.isDirectory())visit(filename);else{assert.ok(entry.isFile(),'Unsupported candidate entry');paths.push(safeRelative(path.relative(directory,filename).split(path.sep).join('/')));}
 }}
 visit(directory);const result=[];
 for(const relative of paths.sort((a,b)=>a.localeCompare(b)))result.push({path:relative,...await hashLocalFile(path.join(directory,relative))});
 return result;
}
function validateFile(file,key='path'){
 assert.ok(file&&typeof file==='object');safeRelative(file[key]);assert.ok(!/[?#]/.test(file[key]),'URL metacharacter in publication path');
 assert.ok(Number.isSafeInteger(file.bytes)&&file.bytes>=0,'Invalid file size: '+file[key]);assert.match(file.sha256,HASH,'Invalid file digest: '+file[key]);
}
export function assertMatchingInventoryFile(previous,file,label=file.path){
 assert.equal(previous.sha256,file.sha256,'Conflicting publication hashes: '+label);
 if(previous.bytes!==undefined&&file.bytes!==undefined)assert.equal(previous.bytes,file.bytes,'Conflicting publication sizes: '+label);
}
function publicFile(base,relative){
 safeRelative(relative);assert.ok(!/[?#]/.test(relative));
 const reference=new URL(base),url=new URL(relative,reference);
 assert.equal(url.origin,reference.origin,'Publication file escaped its origin');
 assert.ok(reference.pathname.endsWith('/')&&url.pathname.startsWith(reference.pathname),'Publication file escaped its base directory');
 return url;
}
function recordingFiles(record){return [
 {path:record.src,bytes:record.bytes,sha256:record.sha256},
 {path:record.poster,sha256:record.posterSHA256},
 {path:record.finishPoster,sha256:record.finishPosterSHA256},
 {path:record.evidence,sha256:record.evidenceSHA256},
 ];}
function compareRecording(record,evidence,info){
 assertRecording(evidence,info,record.level,{alternative:record.alternative});
 for(const key of ['level','title','sourceCommit','bytes','sha256','width','height','fps','frameCount','durationSeconds','continuous'])assert.equal(evidence[key],record[key],'Recording evidence mismatch: '+key+' for room '+record.level);
 assert.equal(record.src,'walkthroughs/'+evidence.video);assert.equal(record.poster,'walkthroughs/'+evidence.poster);
 assert.equal(record.finishPoster,'walkthroughs/'+evidence.finishPoster);assert.equal(record.evidence,'walkthroughs/level-'+String(record.level).padStart(2,'0')+(record.alternative?'-alternate':'')+'.json');
 if(record.alternative){assert.equal(evidence.alternative,record.alternative);assert.equal(evidence.route.alternative,record.alternative);}
 if(record.provenance)assert.equal(record.provenance.method,evidence.method,'Recording method changed for room '+record.level);
}
export function assertSupplementalRecordingProof(release,config,{prepublication=false,publicationRun,controllerSHA}={}){
 assert.deepEqual(config.supplementalRecordingLevels,supplementalLevels,'Every legacy room outside the thirteen source recordings needs separate current-publication capture proof');
 assert.match(config.sourceRecorderSHA256,HASH,'The unchanged source recorder must be independently pinned');
 assert.match(config.sourceGameBuildInputsSHA256,HASH,'The accepted game-build inputs must be independently pinned');
 assert.deepEqual(expeditionRecordingLevels(config),[14,28,...Array.from({length:11},(_,index)=>index+41)],'The thirteen source acceptance recordings cannot be replaced by publication supplements');
 assert.deepEqual(release.supplementalRecordingLevels,supplementalLevels);
 const proof=release.supplementalRecordingProof;assert.ok(proof,'Missing current-publication-run supplemental recording proof');
 assert.equal(proof.mode,'current-publication-run');assert.equal(proof.sourceCommit,config.sourceCommit);assert.equal(proof.candidateRun,config.candidateRun);
 assert.ok(Number.isSafeInteger(proof.publicationRun)&&proof.publicationRun>0,'Supplemental captures need their real publication run');
 assert.match(proof.controllerSHA,COMMIT,'Supplemental captures need the publication controller commit');
 if(!(prepublication&&release.publicationRun===null))assert.equal(String(proof.publicationRun),String(release.publicationRun),'Supplemental captures must belong to this publication run');
 if(publicationRun!==undefined)assert.equal(String(proof.publicationRun),String(publicationRun),'Supplemental captures belong to another workflow run');
 if(controllerSHA!==undefined)assert.equal(proof.controllerSHA,controllerSHA,'Supplemental captures belong to another controller commit');
 assert.equal(proof.acceptedJobs?.length,supplementalLevels.length);assert.equal(proof.artifactManifest?.length,supplementalLevels.length);assert.equal(proof.captureSourceEvidence?.length,supplementalLevels.length);
 const ids=new Set(),artifactIds=new Set();
 const candidateInfo=release.exactCandidateFiles.find(file=>file.path==='build-info.json');assert.ok(candidateInfo,'Missing exact candidate build metadata digest');
 for(const level of supplementalLevels){
  const jobs=proof.acceptedJobs.filter(job=>job.name===`Continuous supplemental walkthrough (${level})`);assert.equal(jobs.length,1,'Missing or duplicated supplemental capture job');
  const job=jobs[0];assert.equal(job.conclusion,'success');assert.ok(Number.isSafeInteger(job.id)&&job.id>0);assert.ok(!ids.has(job.id),'Duplicated supplemental job ID');ids.add(job.id);
  const artifacts=proof.artifactManifest.filter(artifact=>artifact.name===`expedition-supplemental-walkthrough-${level}`);assert.equal(artifacts.length,1,'Missing or duplicated supplemental capture artifact');
  const artifact=artifacts[0];assert.ok(Number.isSafeInteger(artifact.id)&&artifact.id>0);assert.ok(!artifactIds.has(artifact.id),'Duplicated supplemental artifact ID');artifactIds.add(artifact.id);assert.match(artifact.digest,/^sha256:[a-f0-9]{64}$/);assert.equal(artifact.publicationRun,proof.publicationRun);assert.equal(artifact.controllerSHA,proof.controllerSHA);
  const captures=proof.captureSourceEvidence.filter(capture=>capture.level===level);assert.equal(captures.length,1,'Missing or duplicated unchanged source capture proof');
  const capture=captures[0];validateFile(capture);assert.ok(capture.bytes>0);assert.equal(capture.path,`walkthroughs/level-${String(level).padStart(2,'0')}-source-evidence.json`);
  assert.equal(capture.sourceCommit,config.sourceCommit);assert.equal(capture.publicationRun,proof.publicationRun);assert.equal(capture.controllerSHA,proof.controllerSHA);
  assert.deepEqual(capture.candidateArtifact,config.candidateArtifact);assert.equal(capture.buildInfoSHA256,candidateInfo.sha256);
  for(const key of ['sourceScriptSHA256','sourceScriptAfterSHA256','canonicalScriptSHA256'])assert.equal(capture[key],config.sourceRecorderSHA256,'Supplemental recorder differs from the unchanged accepted source script');
  assert.equal(capture.gameBuildInputsBeforeSHA256,config.sourceGameBuildInputsSHA256,'Supplemental capture used different game-build inputs from the accepted source');assert.equal(capture.gameBuildInputsAfterSHA256,capture.gameBuildInputsBeforeSHA256,'The source runtime changed during supplemental capture');
  assert.equal(capture.workingTreeCleanBefore,true);assert.equal(capture.workingTreeCleanAfter,true);
  const recordings=release.newRecordings.filter(record=>record.level===level);assert.equal(recordings.length,1);const provenance=recordings[0].provenance;
  assert.equal(provenance?.kind,'publication-supplemental-native-recording');assert.equal(provenance.publicationRun,proof.publicationRun);assert.equal(provenance.controllerSHA,proof.controllerSHA);assert.equal(provenance.artifactId,artifact.id);
  assert.deepEqual(provenance.captureSourceEvidence,{path:capture.path,bytes:capture.bytes,sha256:capture.sha256});
 }
 return proof;
}
function compareSupplementalSourceEvidence(file,actual){
 const metadata=Object.fromEntries(Object.entries(file).filter(([key])=>!['path','bytes','sha256'].includes(key)));
 assert.deepEqual(actual,metadata,'Published supplemental source attestation differs from its pinned proof: '+file.path);
}
function assertRelease(release,config,{reviewOnly=false,prepublication=false}={}){
 for(const key of ['sourceCommit','candidateRun','previousSourceCommit','previousPublicationRun','previewPath'])assert.equal(release[key],config[key],'Release pin changed: '+key);
 assert.equal(typeof release.version,'string');
 if(reviewOnly){assert.equal(release.publishable,false);assert.equal(release.publicationRun,null);}
 else{
  assertPublishableExpedition(config);assert.equal(release.publishable,true);
  // An accepted local assembly has no deployment run yet. Only explicit
  // prepublication verification may retain that honest null; public checks
  // still require the real numeric publication run from their pinned proof.
  if(!(prepublication&&release.publicationRun===null))assert.match(String(release.publicationRun),/^[1-9]\d*$/);
 }
 assert.deepEqual(release.acceptance,{automated:!reviewOnly,humanPlaytest:false,physicalDeviceBenchmark:false,liveYandex:false});
 assert.match(release.rootGalleryManifestSHA256,HASH);assert.match(release.previewReleaseSHA256,HASH);
 for(const key of ['exactCandidateFiles','preservedFiles','archivedFiles']){
  assert.ok(Array.isArray(release[key])&&release[key].length>0,'Missing publication inventory: '+key);
  const names=new Set();for(const file of release[key]){validateFile(file);assert.ok(!names.has(file.path),'Duplicate inventory path: '+file.path);names.add(file.path);if(key==='archivedFiles')safeRelative(file.archivedPath);}
 }
 const recordedLevels=expeditionRecordingLevels(config);
 if(!reviewOnly)assertSupplementalRecordingProof(release,config,{prepublication,publicationRun:process.env.GITHUB_RUN_ID,controllerSHA:process.env.GITHUB_SHA});
 assert.deepEqual(release.newRecordings.map(r=>r.level).sort((a,b)=>a-b),reviewOnly?recordedLevels:[...recordedLevels,...supplementalLevels].sort((a,b)=>a-b));
 if(!reviewOnly){assert.equal(release.alternateRecordings?.length,4);assert.deepEqual(release.alternateRecordings.map(r=>[r.level,r.alternative]).sort((a,b)=>a[0]-b[0]),[...alternateRoutes]);}
 if(!reviewOnly){
  validateFile(release.historicalVideoIndex);assert.equal(release.historicalVideoIndex.path,'walkthroughs/history.html');assert.ok(release.historicalVideoIndex.bytes>0,'The archived video index must be published');
  assert.ok(Array.isArray(release.generatedPresentationFiles),'Missing generated presentation inventory');assert.deepEqual(release.generatedPresentationFiles.map(file=>file.path).sort(),generatedPresentationPaths(config),'Every generated presentation file needs exact byte proof');
  for(const file of release.generatedPresentationFiles){validateFile(file);assert.ok(file.bytes>0,'Generated presentation file is empty: '+file.path);}
  for(const [relative,sha256]of [['walkthroughs/manifest.json',release.rootGalleryManifestSHA256],[config.previewPath+'/preview-release.json',release.previewReleaseSHA256],['walkthroughs/history.html',release.historicalVideoIndex.sha256]])assert.equal(release.generatedPresentationFiles.find(file=>file.path===relative).sha256,sha256,'Conflicting generated presentation digest: '+relative);
  const historical=release.historicalRuntime;assert.ok(historical,'Missing self-contained historical runtime');
  assert.equal(historical.sourceCommit,config.previousSourceCommit);safeRelative(historical.rootPath);safeRelative(historical.previewPath);
  assert.equal(historical.rootPath,'publication-history/'+config.previousSourceCommit);assert.equal(historical.previewPath,historical.rootPath+'/'+config.previewPath);
  assert.ok(Array.isArray(historical.files)&&historical.files.length>0);const files=new Set();
  for(const file of historical.files){validateFile(file);assert.ok(file.path.startsWith(historical.rootPath+'/'),'Historical runtime file escaped its archive');assert.ok(!files.has(file.path),'Duplicate historical runtime file');files.add(file.path);
   const archived=release.archivedFiles.find(entry=>entry.archivedPath===file.path);assert.ok(archived,'Historical runtime is not covered by its archive inventory: '+file.path);assert.equal(archived.sha256,file.sha256);assert.equal(archived.bytes,file.bytes);
  }
  for(const base of [historical.rootPath,historical.previewPath])for(const name of ['index.html','build-info.json'])assert.ok(files.has(base+'/'+name),'Historical runtime is missing '+base+'/'+name);
 }
 for(const record of allRecordings(release)){
  validateFile({path:record.src,bytes:record.bytes,sha256:record.sha256});
  for(const file of recordingFiles(record)){safeRelative(file.path);assert.match(file.sha256,HASH);}
  assert.equal(record.sourceCommit,config.sourceCommit);assert.equal(record.continuous,true);assert.ok(record.bytes>1024);
  if(!reviewOnly&&(record.alternative||!supplementalLevels.includes(record.level))){
   const group=record.alternative?1:expeditionRecordingGroups(config).findIndex(levels=>levels.split(' ').map(Number).includes(record.level));assert.ok(group>=0);
   const pin=expeditionArtifactPins(config)['expedition-walkthroughs-'+group];assert.ok(pin);
   assert.equal(record.provenance?.kind,'exact-candidate-native-recording');assert.equal(record.provenance.candidateRun,config.candidateRun);assert.equal(record.provenance.artifactId,pin.id,'Source acceptance recording was replaced by a supplemental artifact');
  }
 }
 const jobs=expeditionJobNames(config);assert.equal(release.acceptedJobs.length,jobs.length);
 for(const name of jobs){const matches=release.acceptedJobs.filter(job=>job.name===name);assert.equal(matches.length,1,'Missing or duplicated acceptance job: '+name);assert.equal(matches[0].conclusion,'success');assert.ok(Number.isSafeInteger(matches[0].id)&&matches[0].id>0);}
 assert.ok(Array.isArray(release.artifactManifest));
 for(const [name,pin]of Object.entries(expeditionArtifactPins(config))){
  const matches=release.artifactManifest.filter(a=>a.name===name);assert.equal(matches.length,1,'Missing or duplicated accepted artifact: '+name);
  assert.equal(matches[0].id,pin.id);assert.equal(matches[0].digest,pin.digest);
  assert.equal(matches[0].sourceCommit,config.sourceCommit);assert.equal(matches[0].candidateRun,config.candidateRun);
 }
 return release;
}

export async function verifyLocalPublication({config,candidateDir,siteDir,releasePath,reviewOnly=false,prepublication=false}){
 assert.ok(!(reviewOnly&&prepublication),'Historical review and publishable prepublication are separate verification modes');
 assert.ok(!prepublication||(siteDir&&fs.existsSync(siteDir)&&fs.statSync(siteDir).isDirectory()),'Prepublication verification requires the full assembled SITE_DIR');
 assertExpeditionConfig(config);const release=assertRelease(readJSON(releasePath),config,{reviewOnly,prepublication});
 const info=assertExpeditionInfo(readJSON(path.join(candidateDir,'build-info.json')),config);
 assert.equal(release.version,info.version);
 assert.deepEqual(await localManifest(candidateDir),release.exactCandidateFiles,'The publication inventory differs from the exact accepted candidate');
 let localFiles=0;
 if(siteDir&&fs.existsSync(siteDir)){
  const inventory=[...release.exactCandidateFiles,...release.exactCandidateFiles.map(f=>({...f,path:config.previewPath+'/'+f.path})),...release.preservedFiles,...release.archivedFiles.map(f=>({...f,path:f.archivedPath})),...(release.historicalRuntime?.files||[]),...(release.historicalVideoIndex?[release.historicalVideoIndex]:[]),...(release.generatedPresentationFiles||[]),...allRecordings(release).flatMap(recordingFiles),...supplementalEvidenceFiles(release),{path:'walkthroughs/manifest.json',sha256:release.rootGalleryManifestSHA256},{path:config.previewPath+'/preview-release.json',sha256:release.previewReleaseSHA256}];
  const seen=new Map();
  for(const file of inventory){
   safeRelative(file.path);const previous=seen.get(file.path);
   if(previous){assertMatchingInventoryFile(previous,file);continue;}
   seen.set(file.path,file);const actual=await hashLocalFile(path.join(siteDir,file.path));
   assert.equal(actual.sha256,file.sha256,'Assembled file digest changed: '+file.path);
   if(file.bytes!==undefined)assert.equal(actual.bytes,file.bytes,'Assembled file size changed: '+file.path);localFiles++;
  }
  const gallery=readJSON(path.join(siteDir,'walkthroughs/manifest.json'));assertGallery(gallery,release);
  for(const record of allRecordings(release))compareRecording(record,readJSON(path.join(siteDir,record.evidence)),info);
  for(const file of supplementalEvidenceFiles(release))compareSupplementalSourceEvidence(file,readJSON(path.join(siteDir,file.path)));
  if(release.historicalRuntime)for(const base of [release.historicalRuntime.rootPath,release.historicalRuntime.previewPath]){const old=readJSON(path.join(siteDir,base,'build-info.json'));assert.equal(old.commit,config.previousSourceCommit);assert.equal(old.levels,41);}
 }
 return {release,info,localFiles};
}

export function assertGallery(gallery,release){
 assert.ok([1,2].includes(gallery.version));assert.equal(gallery.sourceCommit,release.sourceCommit);
 assert.equal(gallery.levels.length,51);assert.deepEqual(gallery.levels.map(e=>e.level).sort((a,b)=>a-b),Array.from({length:51},(_,i)=>i+1));
 for(const record of release.newRecordings){const entry=gallery.levels.find(e=>e.level===record.level);for(const [key,value]of Object.entries(record))assert.deepEqual(entry[key],value,'Gallery metadata differs from accepted recording '+record.level+': '+key);}
 for(const record of release.alternateRecordings||[])assert.deepEqual(gallery.levels.find(e=>e.level===record.level)?.alternative,record,'Gallery alternative differs from accepted route '+record.level);
 if(release.publishable){
  const currentLevels=new Set(release.newRecordings.map(record=>record.level)),historicalLevels=gallery.levels.filter(record=>!currentLevels.has(record.level)).map(record=>record.level).sort((a,b)=>a-b);
  assert.deepEqual(historicalLevels,[]);assert.deepEqual(gallery.historicalRecordingLevels,[]);
  assert.deepEqual(gallery.recordingSources,{current:51,alternatives:4,archived:41,archivedCompatibility:'not asserted'});
  assert.equal(gallery.historicalRecordings?.length,41);assert.deepEqual(gallery.historicalRecordings.map(record=>record.level).sort((a,b)=>a-b),Array.from({length:41},(_,index)=>index+1));
  for(const entry of gallery.historicalRecordings){
   assert.equal(entry.sourceCommit,entry.level===41?release.previousSourceCommit:historicalRecordingSource,'An old movie was relabeled as the newer publication/runtime source');
   const movie=release.archivedFiles.find(file=>file.archivedPath===entry.archivedSrc);assert.ok(movie,'A historical movie lacks exact archived-byte proof');assert.equal(movie.path,entry.src);assert.equal(movie.sha256,entry.sha256);assert.equal(movie.bytes,entry.bytes);
   const poster=release.archivedFiles.find(file=>file.archivedPath===entry.archivedPoster);assert.ok(poster,'A historical poster lacks exact archived-byte proof');assert.equal(poster.path,entry.poster);
   assert.ok(entry.archivedSrc.startsWith('publication-history/'+release.previousSourceCommit+'/'),'An old movie escaped its prior-publication archive');assert.ok(entry.archivedPoster.startsWith('publication-history/'+release.previousSourceCommit+'/'));
  }
 }
}

/** The fetch body is consumed chunk-by-chunk, even for the largest videos. */
export async function hashPublicFile(url){
 const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(180000)});
 assert.equal(response.status,200,'HTTP '+response.status+': '+url);assert.ok(response.body,'Missing body: '+url);
 const hash=createHash('sha256');let bytes=0;
 for await(const chunk of response.body){hash.update(chunk);bytes+=chunk.byteLength;}
 return {bytes,sha256:hash.digest('hex')};
}
async function smallJSON(url){
 const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(90000)});
 assert.equal(response.status,200,'HTTP '+response.status+': '+url);
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.byteLength;assert.ok(size<=16*1024*1024,'Metadata unexpectedly exceeds 16 MiB');chunks.push(chunk);}
 const bytes=Buffer.concat(chunks);return {value:JSON.parse(bytes.toString('utf8')),bytes,sha256:createHash('sha256').update(bytes).digest('hex')};
}
async function bounded(items,work,limit=4){
 let next=0;const results=Array(items.length);
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const index=next++;results[index]=await work(items[index],index);}}));return results;
}
async function waitForRelease(root,expected){
 let last;
 for(let attempt=0;attempt<60;attempt++){
  try{const url=publicFile(root,'expedition-release.json');url.searchParams.set('verify',String(Date.now()));const result=await smallJSON(url);if(result.value.sourceCommit===expected.sourceCommit&&String(result.value.publicationRun)===String(expected.publicationRun))return result;last='A previous publication is still served';}catch(error){last=String(error);}
  if(attempt<59)await new Promise(resolve=>setTimeout(resolve,5000));
 }
 throw Error('The pinned public expedition release did not become available: '+last);
}
async function verifyPublicBytes(root,preview,release,info,report){
 const manifest=await smallJSON(publicFile(root,'expedition-release.json'));assert.deepEqual(manifest.value,release,'The public acceptance manifest differs from the local release');
 for(const base of [root,preview])assert.deepEqual((await smallJSON(publicFile(base,'build-info.json'))).value,info,'Public build metadata differs from the original accepted candidate');
 const previewRelease=await smallJSON(publicFile(preview,'preview-release.json'));assert.equal(previewRelease.sha256,release.previewReleaseSHA256);
 assert.equal(previewRelease.value.sourceCommit,release.sourceCommit);
 const gallery=await smallJSON(publicFile(root,'walkthroughs/manifest.json'));assert.equal(gallery.sha256,release.rootGalleryManifestSHA256);assertGallery(gallery.value,release);
 for(const base of [release.historicalRuntime.rootPath,release.historicalRuntime.previewPath]){const old=(await smallJSON(publicFile(root,base+'/build-info.json'))).value;assert.equal(old.commit,release.previousSourceCommit);assert.equal(old.levels,41);}
 const inventory=[
  ...release.exactCandidateFiles.flatMap(file=>[{base:root,file,kind:'primaryCandidate'},{base:preview,file,kind:'permalinkCandidate'}]),
  ...release.preservedFiles.map(file=>({base:root,file,kind:'preserved'})),
  ...release.archivedFiles.map(file=>({base:root,file:{...file,path:file.archivedPath},kind:'archived'})),
  ...release.historicalRuntime.files.map(file=>({base:root,file,kind:'historicalRuntime'})),
  {base:root,file:release.historicalVideoIndex,kind:'historicalVideoIndex'},
  ...release.generatedPresentationFiles.map(file=>({base:root,file,kind:'generatedPresentation'})),
  ...allRecordings(release).flatMap(record=>recordingFiles(record).map(file=>({base:root,file,kind:record.alternative?'alternateRecording':'newRecording'}))),
  ...supplementalEvidenceFiles(release).map(file=>({base:root,file,kind:'supplementalSourceEvidence'})),
 ];
 const unique=new Map();for(const item of inventory){const url=publicFile(item.base,item.file.path).href,previous=unique.get(url);if(previous){assertMatchingInventoryFile(previous.file,item.file,url);continue;}unique.set(url,{...item,url});}
 report.hashes={candidateFiles:release.exactCandidateFiles.length,primaryCandidateFiles:release.exactCandidateFiles.length,permalinkCandidateFiles:release.exactCandidateFiles.length,preservedFiles:release.preservedFiles.length,archivedFiles:release.archivedFiles.length,historicalRuntimeFiles:release.historicalRuntime.files.length,historicalVideoIndexFiles:1,generatedPresentationFiles:release.generatedPresentationFiles.length,newRecordings:release.newRecordings.length,sourceAcceptanceRecordings:release.newRecordings.length-supplementalLevels.length,supplementalRecordings:supplementalLevels.length,supplementalSourceEvidenceFiles:supplementalEvidenceFiles(release).length,alternateRecordings:release.alternateRecordings?.length||0,uniqueFiles:unique.size,verifiedFiles:0,verifiedBytes:0,maximumConcurrentRequests:4};
 await bounded([...unique.values()],async({url,file})=>{
  const fetchURL=new URL(url);fetchURL.searchParams.set('verify',String(release.publicationRun));const actual=await hashPublicFile(fetchURL);
  assert.equal(actual.sha256,file.sha256,'Public digest changed: '+url);if(file.bytes!==undefined)assert.equal(actual.bytes,file.bytes,'Public size changed: '+url);
  report.hashes.verifiedFiles++;report.hashes.verifiedBytes+=actual.bytes;
  if(report.hashes.verifiedFiles%25===0)console.log('Public expedition file hashes:',report.hashes.verifiedFiles+'/'+unique.size);
 });
 report.newEvidence=[];
 for(const record of allRecordings(release)){const evidence=await smallJSON(publicFile(root,record.evidence));assert.equal(evidence.sha256,record.evidenceSHA256);compareRecording(record,evidence.value,info);report.newEvidence.push({level:record.level,alternative:record.alternative||null,continuous:true,routePass:true,frames:record.frameCount,sha256:record.sha256});}
 report.supplementalSourceEvidence=[];
 for(const file of supplementalEvidenceFiles(release)){const evidence=await smallJSON(publicFile(root,file.path));assert.equal(evidence.sha256,file.sha256);assert.equal(evidence.bytes.length,file.bytes);compareSupplementalSourceEvidence(file,evidence.value);report.supplementalSourceEvidence.push({level:file.level,sourceCommit:file.sourceCommit,publicationRun:file.publicationRun,controllerSHA:file.controllerSHA,sha256:file.sha256,unchangedSourceRecorder:true,unchangedGameBuildInputs:true});}
 await bounded(allRecordings(release),async record=>{
  for(const start of [0,record.bytes-1024]){
   const url=publicFile(root,record.src),end=start+1023;
   const response=await fetch(url,{headers:{Range:`bytes=${start}-${end}`},cache:'no-store',signal:AbortSignal.timeout(90000)});
   assert.equal(response.status,206,'Public MP4 must support byte-range seeking: '+url);
   assert.match(response.headers.get('content-type')||'',/^video\/mp4(?:$|;)/i);
   assert.equal(response.headers.get('content-range'),`bytes ${start}-${end}/${record.bytes}`);
   const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,1024);if(start===0)assert.equal(bytes.toString('ascii',4,8),'ftyp');
  }
 });
 report.newVideoRangeChecks=allRecordings(release).length*2;return gallery.value;
}

async function noDebugGlobals(page){
 const globals=await page.evaluate(()=>Object.fromEntries([...new Set([...Object.getOwnPropertyNames(window).filter(key=>key.startsWith('__NESI_')), ...['__NESI_DEMO_GAME__','__NESI_DEMO_DIAGNOSTICS__','__NESI_RUN_LEVEL_ROUTE__','__NESI_RUN_FLOOR_PORTAL_ROUTE__','__NESI_RUN_PORTAL_EDGE_ROUTE__','__NESI_RUN_BALANCE_BYPASS__','__NESI_RUN_ANIMATION_ROUTE__','__NESI_PLATFORM__','__NESI_PREFS__']])].map(key=>[key,typeof window[key]])));
 for(const [key,value]of Object.entries(globals))assert.equal(value,'undefined','Ordinary public play exposes QA global '+key);return globals;
}
async function waitPlaying(page,level){await page.waitForFunction(level=>document.documentElement.dataset.runtimeState==='playing'&&Number(document.documentElement.dataset.levelIndex)===level-1,{},level);assert.equal(await page.$eval('#level-number',e=>Number(e.textContent)),level);await noDebugGlobals(page);}
async function nativePlay(page,touch,level){
 await waitForStartMenu(page);
 await page.$eval('#play-button',e=>e.addEventListener('click',event=>{document.documentElement.dataset.publicPlayTrusted=String(event.isTrusted);},{capture:true,once:true}));
 await activate(page,'#play-button',touch);await waitPlaying(page,level);
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.publicPlayTrusted),'true','Play must be activated through a native trusted event');
}
async function pause(page,touch=false){
 if(touch)await activate(page,'.lab-mobile button:nth-child(4)',true);else await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused'&&getComputedStyle(document.querySelector('#pause-screen')).opacity==='1');
}
async function returnToMap(page,touch=false){await activate(page,'#level-menu-button',touch);await waitForStartMenu(page);await page.waitForFunction(()=>document.activeElement?.id==='play-button');}
async function chooseRoom(page,level,touch=false){
 const sector=level===41?4:level>=42?5:Math.floor((level-1)/10);
 await activate(page,`.sector-tabs [data-sector="${sector}"]`,touch);await activate(page,`.room-node[data-level="${level}"]`,touch);
 assert.equal(await page.$eval('#level-select',e=>Number(e.value)),level-1);
 assert.equal(await page.$eval(`.room-node[data-level="${level}"]`,e=>e.getAttribute('aria-pressed')),'true');
 assert.equal(await page.$eval('#tower-start-note',e=>!e.hidden),level===41);
 const title=await page.$eval('#selected-room-title',e=>e.textContent.trim());assert.ok(title.length>1);return title;
}
async function inspectAllCards(page,touch){
 assert.equal(await page.$eval('#level-select',e=>e.hidden),true);assert.equal(await page.$$eval('#level-select option',e=>e.length),51);
 const sectors=await page.$$eval('.sector-tabs [data-sector]',buttons=>buttons.map(b=>Number(b.dataset.sector)));assert.deepEqual(sectors,[0,1,2,3,4,5]);
 const cards=[];
 for(const sector of sectors){await activate(page,`.sector-tabs [data-sector="${sector}"]`,touch);cards.push(...await page.$$eval('.sector-nodes .room-node',buttons=>buttons.map(button=>({level:Number(button.dataset.level),title:button.querySelector('.room-node-title')?.textContent.trim(),label:button.getAttribute('aria-label'),pressed:button.getAttribute('aria-pressed')}))));}
 assert.deepEqual(cards.map(c=>c.level).sort((a,b)=>a-b),Array.from({length:51},(_,i)=>i+1));
 assert.ok(cards.every(c=>c.title&&c.label&&['false','true'].includes(c.pressed)),'Campaign card labels and pressed state must be complete');return cards;
}
async function touchBounds(page){
 const selectors=['#joystick','#sprint-button','#jump-button',...Array.from({length:4},(_,i)=>`.lab-mobile button:nth-child(${i+1})`)];
 const bounds=await page.evaluate(selectors=>selectors.map(selector=>{const e=document.querySelector(selector),r=e?.getBoundingClientRect();return{selector,width:r?.width,height:r?.height,inViewport:!!r&&r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:!!r&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}),selectors);
 for(const b of bounds){assert.ok(b.inViewport&&b.hit,'Mobile control is clipped or obstructed: '+b.selector);assert.ok(b.width>=40&&b.height>=40,'Mobile control is smaller than 40 pixels: '+b.selector);}return bounds;
}
async function configureNativeSettings(page){
 await page.focus('#quality-select');await page.keyboard.press('Home');await page.keyboard.press('Tab');
 assert.equal(await page.$eval('#quality-select',e=>e.value),'low');
 if(!await page.$eval('#mute-toggle',e=>e.checked))await activate(page,'#mute-toggle');
 if(await page.$eval('#tutorial-toggle',e=>e.checked))await activate(page,'#tutorial-toggle');
 await page.focus('#volume-control');await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('Tab');
 assert.equal(await page.$eval('#volume-control',e=>Number(e.value)),2);
}
async function verifyOrdinaryUI(browser,{root,preview,release,out,report}){
 report.ordinary={desktop:null,mobile:[],permalink:null,qaGlobalsAbsent:true};
 const viewports=[{width:960,height:720,mobile:false},{width:390,height:844,mobile:true},{width:844,height:390,mobile:true}];
 for(const viewport of viewports){
  const context=await browser.createBrowserContext(),page=await context.newPage();report.activePage=page;
  page.setDefaultTimeout(180000);page.on('pageerror',error=>report.errors.push(String(error)));page.on('error',error=>report.errors.push('Renderer: '+String(error)));
  await page.setViewport({...viewport,deviceScaleFactor:1,isMobile:viewport.mobile,hasTouch:viewport.mobile});
  const url=new URL(root);url.search='?level=1';await page.goto(url.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);
  assert.equal(await page.evaluate(()=>document.body.dataset.chamberEdition),'foundation');await noDebugGlobals(page);
  const result={width:viewport.width,height:viewport.height,defaultEdition:'foundation',qaGlobalsAbsent:true,cards:await inspectAllCards(page,viewport.mobile),plays:[]};
  if(!viewport.mobile){
   await page.focus('.sector-tabs [data-sector="5"]');await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.sector),'0');
   await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.sector),'5');
   await activate(page,'.sector-tabs [data-sector="0"]');await page.focus('.room-node[data-level="5"]');await page.keyboard.press('Enter');
   assert.equal(await page.$eval('#level-select',e=>e.value),'4');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.level),'5');result.keyboardSectorAndRoomSelection=true;
  }else{
   assert.equal(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches),true);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector('#start-screen').scrollWidth<=document.querySelector('#start-screen').clientWidth+2),'Mobile menu overflows horizontally');
  }
  for(const level of [1,41,42,51]){
   const title=await chooseRoom(page,level,viewport.mobile);
   if(level===51)await page.screenshot({path:path.join(out,`menu-${viewport.width}x${viewport.height}-51.png`)});
   await nativePlay(page,viewport.mobile,level);
   assert.equal(new URL(page.url()).pathname,root.pathname,'Ordinary Play navigated away from the primary game');
   assert.match(await page.$eval('#chamber',e=>e.textContent),new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
   assert.equal(await page.$eval('#tower-run-clock',e=>e.hidden),true);
   if(viewport.mobile)result.mobileControlBounds=await touchBounds(page);
   await page.screenshot({path:path.join(out,`playing-${viewport.width}x${viewport.height}-${String(level).padStart(2,'0')}.png`)});
   result.plays.push({level,title,nativeTrustedPlay:true});await pause(page,viewport.mobile);
   assert.equal(await page.$eval('#hint-button',e=>e.hidden),true);
   if(level===1&&!viewport.mobile){
    await configureNativeSettings(page);result.settingsChangedThroughControls=true;
    await page.focus('#resume-button');await page.keyboard.press('Enter');await waitPlaying(page,level);result.keyboardResume=true;await pause(page);
   }
   if(level===42){await activate(page,'#restart-button',viewport.mobile);await waitPlaying(page,level);result.pauseRestart=true;await pause(page,viewport.mobile);}
   await returnToMap(page,viewport.mobile);
  }
  if(!viewport.mobile){
   const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),settingsKey);
   assert.equal(saved.resumeLevel,50);assert.equal(saved.quality,'low');assert.equal(saved.muted,true);assert.equal(saved.tutorial,false);assert.equal(saved.volume,.02);
   const reloadURL=new URL(root);await page.goto(reloadURL.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);await noDebugGlobals(page);
   assert.equal(await page.$eval('#level-select',e=>Number(e.value)),50);
   assert.equal(await page.$eval('.room-node[data-level="51"]',e=>e.getAttribute('aria-pressed')),'true');
   assert.equal(await page.$eval('#quality-select',e=>e.value),'low');assert.equal(await page.$eval('#mute-toggle',e=>e.checked),true);
   assert.equal(await page.$eval('#tutorial-toggle',e=>e.checked),false);assert.equal(await page.$eval('#volume-control',e=>Number(e.value)),2);
   await nativePlay(page,false,51);result.persistedSelectionAndSettingsAfterReload={resumeLevel:51,quality:'low',muted:true,tutorial:false,volume:.02};report.ordinary.desktop=result;
  }else report.ordinary.mobile.push(result);
  await context.close();report.activePage=null;
 }
 const context=await browser.createBrowserContext(),page=await context.newPage();report.activePage=page;page.setDefaultTimeout(180000);page.on('pageerror',error=>report.errors.push(String(error)));
 await page.setViewport({width:960,height:540,deviceScaleFactor:1});const permalink=new URL(preview);permalink.search='?level=51';
 await page.goto(permalink.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);await noDebugGlobals(page);assert.equal(await page.$eval('#level-select',e=>Number(e.value)),50);await nativePlay(page,false,51);
 await page.screenshot({path:path.join(out,'permalink-ordinary-room-51.png')});report.ordinary.permalink={url:permalink.href,level:51,nativeTrustedPlay:true,qaGlobalsAbsent:true};
 await context.close();report.activePage=null;
 if(process.env.VERIFY_FINAL_ROUTE==='1'){
  const page=await browser.newPage();report.activePage=page;page.setDefaultTimeout(180000);page.on('pageerror',error=>report.errors.push(String(error)));
  const diagnostic=new URL(root);diagnostic.search='?level=51&debug=1';await page.goto(diagnostic.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);await activate(page,'#play-button');
  await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');const route=await page.evaluate(()=>window.__NESI_RUN_LEVEL_ROUTE__());
  assert.equal(route.pass,true);assert.equal(route.level,51);assert.equal(route.resets,0);assert.equal(route.respawns,0);report.optInFinalRoute=route;await page.close();report.activePage=null;
 }
}
async function decodedFrame(page){
 const frame=await page.$eval('#video',video=>{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;const context=canvas.getContext('2d');context.drawImage(video,0,0,160,90);const pixels=context.getImageData(0,0,160,90).data;let minimum=255,maximum=0;const colors=new Set();for(let i=0;i<pixels.length;i+=4){const luminance=(pixels[i]*54+pixels[i+1]*183+pixels[i+2]*19)/256;minimum=Math.min(minimum,luminance);maximum=Math.max(maximum,luminance);colors.add((pixels[i]>>4)*256+(pixels[i+1]>>4)*16+(pixels[i+2]>>4));}return{time:video.currentTime,width:video.videoWidth,height:video.videoHeight,readyState:video.readyState,luminanceRange:maximum-minimum,quantizedColors:colors.size};});
 assert.ok(frame.luminanceRange>12&&frame.quantizedColors>12,'The decoded public video frame is blank');return frame;
}
async function verifyGalleryRecording(page,{root,record,out,stem,fractions=[.2,.6,.99]}){
 assert.equal(await page.$eval('#watch-heading',e=>e.textContent),record.title);
 assert.doesNotMatch(await page.$eval('#player-message',e=>e.textContent),/АРХИВ|историческ|предыдущей версии/i,'A current accepted video is presented as a historical recording');
 await page.$eval('#video',video=>{video.preload='auto';video.muted=true;video.load();});
 await page.waitForFunction(()=>{const video=document.querySelector('#video');return !video.error&&Number.isFinite(video.duration)&&video.duration>0&&video.readyState>=1;});
 assert.equal(await page.$eval('#video',video=>new URL(video.currentSrc).pathname),publicFile(root,record.src).pathname);
 assert.ok(Math.abs(await page.$eval('#video',video=>video.duration)-record.durationSeconds)<.12,'The public video duration changed for room '+record.level);
 const playback=await page.$eval('#video',async video=>{video.muted=true;await video.play();const before=video.currentTime;await new Promise(resolve=>setTimeout(resolve,1000));video.pause();return video.currentTime-before;});
 assert.ok(playback>.1,'Selected recording must actually play for room '+record.level);
 const frames=[];
 for(const fraction of fractions){
  const destination=record.durationSeconds*fraction;await page.$eval('#video',(video,time)=>{video.pause();video.currentTime=time;},destination);
  await page.waitForFunction(time=>{const video=document.querySelector('#video');return !video.error&&!video.seeking&&video.readyState>=2&&Math.abs(video.currentTime-time)<.12;},{timeout:90000},destination);
  const frame=await decodedFrame(page);assert.equal(frame.width,record.width);assert.equal(frame.height,record.height);frames.push(frame);
  await page.screenshot({path:path.join(out,stem+'-'+Math.round(fraction*100)+'.png')});
 }
 return {level:record.level,sourceCommit:record.sourceCommit,sha256:record.sha256,actualPlaybackSeconds:playback,decodedSeekFrames:frames};
}
async function selectCanonicalGalleryRecord(page,level){
 await page.$eval(`.level-card[data-level="${level}"]`,card=>card.addEventListener('click',event=>{document.documentElement.dataset.publicCanonicalTrusted=String(event.isTrusted);},{capture:true,once:true}));
 await activate(page,`.level-card[data-level="${level}"]`);assert.equal(await page.evaluate(()=>document.documentElement.dataset.publicCanonicalTrusted),'true');
 assert.equal(new URL(page.url()).searchParams.get('level'),String(level));assert.notEqual(new URL(page.url()).searchParams.get('route'),'alternate');
 assert.equal(await page.$eval('#alternate-route',button=>button.dataset.variant),'canonical');
 assert.equal(await page.$eval('#alternate-route',button=>button.hidden),!alternateRoutes.has(level));
 assert.equal(await page.$eval('#play-level',entry=>new URL(entry.href).searchParams.get('level')),String(level));
}
async function verifyHistoricalRuntime(browser,{root,release,out,report}){
 const historical=release.historicalRuntime,archive=new URL(historical.rootPath+'/',root);
 const context=await browser.createBrowserContext(),page=await context.newPage();report.activePage=page;
 page.setDefaultTimeout(180000);page.on('pageerror',error=>report.errors.push(String(error)));page.on('error',error=>report.errors.push('Historical renderer: '+String(error)));
 await page.setViewport({width:960,height:540,deviceScaleFactor:1});const first=new URL(archive);first.search='?edition=foundation&level=1';
 await page.goto(first.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);await noDebugGlobals(page);
 assert.equal(await page.$$eval('#level-select option',entries=>entries.length),41,'The historical game must retain its actual 41-room menu');
 assert.equal(await page.$eval('#level-select',select=>Number(select.value)),0);
 const old=await page.evaluate(async()=>{const response=await fetch('build-info.json',{cache:'no-store'});if(!response.ok)throw Error('Historical build metadata is unavailable');return response.json();});assert.equal(old.commit,historical.sourceCommit);assert.equal(old.levels,41);
 await nativePlay(page,false,1);await page.screenshot({path:path.join(out,'historical-runtime-room-01.png')});await pause(page);await returnToMap(page);
 await page.select('#level-select','40');await nativePlay(page,false,41);assert.equal(new URL(page.url()).pathname,archive.pathname);
 await page.screenshot({path:path.join(out,'historical-runtime-room-41.png')});
 const finale=new URL(archive);finale.search='?edition=foundation&level=41';await page.goto(finale.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);await noDebugGlobals(page);
 assert.equal(await page.$eval('#level-select',select=>Number(select.value)),40);await nativePlay(page,false,41);
 await page.reload({waitUntil:'domcontentloaded'});await waitForStartMenu(page);await noDebugGlobals(page);assert.equal(await page.$eval('#level-select',select=>Number(select.value)),40);await nativePlay(page,false,41);
 await page.screenshot({path:path.join(out,'historical-runtime-room-41-reloaded.png')});
 report.historicalRuntime={sourceCommit:historical.sourceCommit,url:archive.href,runtimeFiles:historical.files.length,menuRooms:41,ordinaryPlayRooms:[1,41],nativeTrustedPlay:true,qaGlobalsAbsent:true,deepLinkRoom41:true,reloadedRoom41Playable:true};
 await context.close();report.activePage=null;
}
async function verifyGallery(browser,{root,release,out,report}){
 const context=await browser.createBrowserContext(),page=await context.newPage();report.activePage=page;page.setDefaultTimeout(180000);page.on('pageerror',error=>report.errors.push(String(error)));
 await page.setViewport({width:1280,height:800,deviceScaleFactor:1});await page.goto(new URL('walkthroughs.html?level=51',root).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelectorAll('.level-card').length===51&&document.querySelectorAll('.level-card.is-pending').length===0);
 assert.deepEqual(await page.$$eval('.level-card',cards=>cards.map(c=>Number(c.dataset.level)).sort((a,b)=>a-b)),Array.from({length:51},(_,i)=>i+1));
 assert.match(await page.$eval('#ready-count',e=>e.textContent),/51\s*\/\s*51/);
 for(const record of release.newRecordings)assert.doesNotMatch(await page.$eval(`.level-card[data-level="${record.level}"]`,e=>e.textContent),/АРХИВ/i,'A new accepted recording is labeled as historical');
 const record=release.newRecordings.find(r=>r.level===51);
 await selectCanonicalGalleryRecord(page,51);
 report.gallery={url:page.url(),cards:51,readyCards:51,...await verifyGalleryRecording(page,{root,record,out,stem:'gallery-room-51-frame'})};
 report.gallery.canonicalRecordings=[{nativeTrustedSelection:true,level:record.level,sourceCommit:record.sourceCommit,sha256:record.sha256,actualPlaybackSeconds:report.gallery.actualPlaybackSeconds,decodedSeekFrames:report.gallery.decodedSeekFrames}];
 for(const canonical of release.newRecordings.filter(entry=>entry.level!==51).sort((a,b)=>a.level-b.level)){
  await selectCanonicalGalleryRecord(page,canonical.level);
  report.gallery.canonicalRecordings.push({nativeTrustedSelection:true,...await verifyGalleryRecording(page,{root,record:canonical,out,stem:`gallery-room-${String(canonical.level).padStart(2,'0')}-canonical-frame`})});
  console.log('Public gallery canonical playback verified:',canonical.level);
 }
 assert.equal(report.gallery.canonicalRecordings.length,51);report.gallery.supplementalCanonicalRecordings=report.gallery.canonicalRecordings.filter(entry=>supplementalLevels.includes(entry.level));
 report.gallery.alternates=[];
 for(const alternate of release.alternateRecordings||[]){
  await activate(page,`.level-card[data-level="${alternate.level}"]`);
  await page.waitForFunction(()=>{const button=document.querySelector('#alternate-route');return button&&!button.hidden&&!button.disabled&&button.dataset.variant==='canonical';});
  await page.$eval('#alternate-route',button=>button.addEventListener('click',event=>{document.documentElement.dataset.publicAlternateTrusted=String(event.isTrusted);},{capture:true,once:true}));
  await activate(page,'#alternate-route');assert.equal(await page.evaluate(()=>document.documentElement.dataset.publicAlternateTrusted),'true');
  await page.waitForFunction(src=>{const video=document.querySelector('#video');return video?.getAttribute('src')&&new URL(video.src).pathname===src&&document.querySelector('#alternate-route')?.dataset.variant==='alternate';},{},publicFile(root,alternate.src).pathname);
  assert.equal(new URL(page.url()).searchParams.get('route'),'alternate');assert.equal(new URL(page.url()).searchParams.get('level'),String(alternate.level));
  report.gallery.alternates.push({alternative:alternate.alternative,nativeTrustedSelection:true,...await verifyGalleryRecording(page,{root,record:alternate,out,stem:`gallery-room-${alternate.level}-alternate`})});
 }
 if(release.alternateRecordings?.length){
  await page.reload({waitUntil:'domcontentloaded'});
  const alternate=release.alternateRecordings.at(-1);
  await page.waitForFunction(src=>{const video=document.querySelector('#video'),button=document.querySelector('#alternate-route');return video?.getAttribute('src')&&new URL(video.src).pathname===src&&button?.dataset.variant==='alternate';},{},publicFile(root,alternate.src).pathname);
  report.gallery.alternativeSelectionRestoredAfterReload=true;
 }
 report.gallery.currentCanonicalRecordings=51;report.gallery.currentAlternativeRecordings=4;report.gallery.decodedRecordings=report.gallery.canonicalRecordings.length+report.gallery.alternates.length;report.gallery.decodedFrames=3*report.gallery.decodedRecordings;assert.equal(report.gallery.decodedRecordings,55);
 await context.close();report.activePage=null;
}

export async function main(){
 const config=assertExpeditionConfig(readJSON(process.env.RELEASE_CONFIG||'tools/expedition-release.json'));
 const localOnly=process.argv.includes('--local-only'),reviewOnly=process.env.PUBLICATION_REVIEW_ONLY==='1';
 assert.ok(!reviewOnly||localOnly,'Historical review is only allowed with --local-only; it must never validate a public release');
 const candidateDir=path.resolve(process.env.CANDIDATE_DIR||'candidate'),siteDir=path.resolve(process.env.SITE_DIR||'site');
 const releasePath=path.resolve(process.env.LOCAL_RELEASE||path.join(siteDir,'expedition-release.json'));
 const out=path.resolve(process.env.OUT_DIR||'publication-proof/expedition');fs.mkdirSync(out,{recursive:true});
 const root=new URL(process.env.PAGE_URL||'https://amazin20.github.io/brainrot-portal/');assert.ok(root.pathname.endsWith('/'),'PAGE_URL must end in a slash');
 safeRelative(config.previewPath);const preview=new URL(config.previewPath+'/',root);
 const report={pass:false,sourceCommit:config.sourceCommit,candidateRun:config.candidateRun,url:root.href,permalink:preview.href,publishable:!reviewOnly,acceptance:{automated:!reviewOnly,humanPlaytest:false,physicalDeviceBenchmark:false,liveYandex:false},errors:[],scope:reviewOnly?'local historical byte review only; publication disabled':localOnly?'local assembled byte and recording proof':'public bytes, ordinary desktop/mobile controls and gallery playback'};
 let browser;
 try{
  const {release,info,localFiles}=await verifyLocalPublication({config,candidateDir,siteDir,releasePath,reviewOnly,prepublication:localOnly&&!reviewOnly});report.version=info.version;report.publicationRun=release.publicationRun;report.localFiles=localFiles;report.localCandidateFiles=release.exactCandidateFiles.length;
  if(localOnly)assert.ok(localFiles>0,'--local-only requires the complete assembled SITE_DIR');
  else{
   assert.deepEqual((await waitForRelease(root,release)).value,release,'The settled public release differs from the accepted local publication');
   await verifyPublicBytes(root,preview,release,info,report);
   const {default:puppeteer}=await import('puppeteer-core');
   browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:1_800_000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
   await verifyOrdinaryUI(browser,{root,preview,release,out,report});await verifyHistoricalRuntime(browser,{root,release,out,report});await verifyGallery(browser,{root,release,out,report});
  }
  assert.deepEqual(report.errors,[]);report.pass=true;console.log('EXPEDITION VERIFIED',JSON.stringify(report));
 }catch(error){
  report.error=String(error);report.stack=error.stack;
  if(report.activePage){report.failureState=await report.activePage.evaluate(()=>({url:location.href,runtime:document.documentElement.dataset.runtimeState,levelIndex:document.documentElement.dataset.levelIndex,selectedLevel:document.querySelector('#level-select')?.value,externalPause:document.body.dataset.externalPause,hidden:document.hidden,focused:document.hasFocus(),error:document.querySelector('#error-detail')?.textContent})).catch(()=>null);await report.activePage.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
  throw error;
 }finally{
  delete report.activePage;fs.writeFileSync(path.join(out,'public-proof.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
