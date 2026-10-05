import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {assertExpeditionConfig,assertPublishableExpedition,assertExpeditionJobs,assertExpeditionArtifacts,assertExpeditionInfo,assertRecording,assertAlternativeRecordings,EXPEDITION_ALTERNATIVES,assertNewAdversarialProofs,assertMovingCollisionProof,assertAlternativeRouteProofs,expeditionHistoricalRuntimeFiles,assertPreservedFiles,expeditionRecordingLevels,expeditionRecordingGroups,expeditionPublishedRecordingLevels,expeditionSupplementalRecordingLevels,expeditionSupplementalArtifactName,assertSupplementalPublicationProof,assertSupplementalCaptureEvidence,expeditionPresentationPaths,fileHash,fileManifest,readJSON,safeRelative} from './lib/expedition-proof.mjs';
import {expeditionGalleryScript,expeditionGalleryHTML,expeditionHistoricalVideoHTML} from './lib/expedition-gallery.mjs';

const input=path.resolve(process.env.RELEASE_INPUT_DIR||'release-input');
const site=path.resolve(process.env.SITE_DIR||'site');
const proofDirectory=path.resolve(process.env.PUBLICATION_PROOF_DIR||'publication-proof');
const config=assertExpeditionConfig(readJSON(process.env.RELEASE_CONFIG||'tools/expedition-release.json'),readJSON('tools/singularity-upgrade-release.json'));
const reviewOnly=process.env.PUBLICATION_REVIEW_ONLY==='1';if(!reviewOnly)assertPublishableExpedition(config);
const proof=readJSON(path.join(input,'github-proof.json'));
const acceptedJobs=assertExpeditionJobs(proof.candidateRun,proof.candidateJobs,config);
const artifactManifest=assertExpeditionArtifacts(proof.candidateArtifacts,config);
let supplementalRecordingProof=null;
if(!reviewOnly)supplementalRecordingProof=assertSupplementalPublicationProof(proof,config,{publicationRun:Number(process.env.GITHUB_RUN_ID),controllerSHA:process.env.GITHUB_SHA});
const supplementalArtifacts=supplementalRecordingProof?.artifactManifest||[];
const allArtifacts=[...artifactManifest,...supplementalArtifacts];
assert.equal(proof.previousRun.id,config.previousPublicationRun);assert.equal(proof.previousRun.conclusion,'success');assert.equal(proof.previousRun.status,'completed');
assert.equal(proof.previousRun.path,'.github/workflows/publish-singularity-upgrade.yml');assert.equal(proof.previousRun.head_branch,'main');
const baseArtifacts=proof.previousArtifacts.filter(a=>a.id===config.previousArtifact.id);
assert.equal(baseArtifacts.length,1);assert.equal(baseArtifacts[0].name,config.previousArtifact.name);assert.equal(baseArtifacts[0].digest,config.previousArtifact.digest);assert.equal(baseArtifacts[0].expired,false);
assert.equal(baseArtifacts[0].workflow_run.id,config.previousPublicationRun);

// Archive hashes bind every extracted report/file to the successful CI. Verify
// the extracted tree too: hashing a ZIP alone would not detect a changed file
// alongside an otherwise correct archive.
for(const artifact of [...allArtifacts,baseArtifacts[0]])assert.equal('sha256:'+fileHash(path.join(input,'archives',artifact.name+'.zip')),artifact.digest,'Downloaded archive differs from pinned artifact: '+artifact.name);
const archiveTrees=JSON.parse(execFileSync('python3',['-c',String.raw`
import hashlib,json,pathlib,sys,zipfile
root=pathlib.Path(sys.argv[1]); result={}
for archive in sorted((root/'archives').glob('*.zip')):
 rows=[]; seen=set()
 with zipfile.ZipFile(archive) as z:
  for entry in z.infolist():
   if entry.is_dir(): continue
   name=entry.filename
   assert not name.startswith('/') and '\\' not in name and all(p not in ('','..','.') for p in name.split('/')), name
   assert name not in seen, name
   assert (entry.external_attr>>16)&0o170000 != 0o120000, name
   seen.add(name); h=hashlib.sha256()
   with z.open(entry) as f:
    for chunk in iter(lambda:f.read(1048576),b''): h.update(chunk)
   rows.append({'path':name,'bytes':entry.file_size,'sha256':h.hexdigest()})
 result[archive.stem]=sorted(rows,key=lambda row:row['path'])
print(json.dumps(result))
`,input],{encoding:'utf8',maxBuffer:8*1024*1024}));
const byPath=rows=>[...rows].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
for(const artifact of [...allArtifacts,baseArtifacts[0]])assert.deepEqual(byPath(fileManifest(path.join(input,artifact.name))),archiveTrees[artifact.name],'Extracted artifact changed: '+artifact.name);
const baseTar=path.join(input,config.previousArtifact.name,'artifact.tar');
const baseline=JSON.parse(execFileSync('python3',['-c',String.raw`
import hashlib,json,sys,tarfile
rows=[]; seen=set()
with tarfile.open(sys.argv[1]) as tar:
 for entry in tar:
  name=entry.name
  while name.startswith('./'): name=name[2:]
  if name in ('','.'): continue
  assert not name.startswith('/') and '\\' not in name and all(p not in ('','..','.') for p in name.split('/')),name
  assert entry.isfile() or entry.isdir(),name
  if entry.isdir(): continue
  assert name not in seen,name
  seen.add(name);h=hashlib.sha256()
  with tar.extractfile(entry) as f:
   for chunk in iter(lambda:f.read(1048576),b''):h.update(chunk)
  rows.append({'path':name,'bytes':entry.size,'sha256':h.hexdigest()})
print(json.dumps(sorted(rows,key=lambda row:row['path'])))
`,baseTar],{encoding:'utf8',maxBuffer:8*1024*1024}));
assert.deepEqual(byPath(fileManifest(site)),baseline,'The current publication base must be the exact pinned Pages archive');
assert.equal(readJSON(path.join(site,'build-info.json')).commit,config.previousSourceCommit);
assert.equal(readJSON(path.join(site,config.previewPath,'build-info.json')).commit,config.previousSourceCommit);
const candidate=path.join(input,'expedition-production'),info=assertExpeditionInfo(readJSON(path.join(candidate,'build-info.json')),config);
const exactCandidateFiles=fileManifest(candidate);
const previousGallery=readJSON(path.join(site,'walkthroughs/manifest.json'));
assert.equal(previousGallery.sourceCommit,config.previousSourceCommit);assert.deepEqual(previousGallery.levels.map(e=>e.level),Array.from({length:41},(_,i)=>i+1));
const recordedLevels=expeditionRecordingLevels(config),publishedLevels=reviewOnly?recordedLevels:expeditionPublishedRecordingLevels(config),recordingGroups=expeditionRecordingGroups(config),retainedEntries=previousGallery.levels.filter(e=>!publishedLevels.includes(e.level));
for(const entry of previousGallery.levels){safeRelative(entry.src);safeRelative(entry.poster);assert.equal(fileHash(path.join(site,entry.src)),entry.sha256,'Previous approved movie changed');assert.ok(fs.statSync(path.join(site,entry.poster)).size>1000);}
for(const file of exactCandidateFiles.filter(f=>f.path.startsWith('models/')||f.path.startsWith('draco/')))assert.equal(fileHash(path.join(site,file.path)),file.sha256,'Original model/decoder identity changed: '+file.path);

const report=(artifact,relative)=>readJSON(path.join(input,artifact,relative));
const routes={};
for(const edition of ['foundation','classic','open']){
 const r=report('expedition-routes-'+edition,'routes.json');assert.equal(r.commit,config.sourceCommit);if(!reviewOnly){assert.equal(r.dirtyScope,'game-build-inputs');assert.equal(r.dirty,false);}assert.equal(r.summary.fail,0);assert.ok(r.rows.length>0&&r.rows.every(row=>row.pass));
 routes[edition]={summary:r.summary,gaps:r.gaps};
}
const recovery=report('expedition-routes-foundation','runs/expansion-a-recovery.json');assert.equal(recovery.summary.allPassed,true);assert.equal(recovery.summary.recoveryTrials,5);assert.equal(recovery.summary.unexpectedResets,0);assert.equal(recovery.summary.allOriginalBodiesPreserved,true);
const webgl=[];
for(let group=0;group<7;group++){
 const r=report('expedition-webgl-'+group,'report.json');assert.equal(r.pass,true);assert.equal(r.capturePass,true);assert.deepEqual(r.errors,[]);
 for(const row of r.rows){assert.equal(row.pass,true);assert.equal(row.gameplayPassed,true);assert.equal(row.capturePass,true);assert.equal(row.route.pass,true);assert.equal(row.route.state,'won');assert.equal(row.route.resets,0);assert.equal(row.route.respawns,0);assert.equal(row.route.sameCompanion,true);webgl.push(row.level);}
}
assert.deepEqual(webgl.sort((a,b)=>a-b),Array.from({length:51},(_,i)=>i+1),'Every room must finish in the accepted production WebGL');
const menu=report('expedition-interface','campaign-menu/report.json'),sdk=report('expedition-interface','expedition-sdk.json'),sdkBrowser=report('expedition-interface','yandex-browser/sdk-production-proof.json');
assert.equal(menu.pass,true);assert.equal(menu.viewports.length,6);assert.deepEqual(menu.errors,[]);assert.equal(sdk.pass,true);assert.equal(sdkBrowser.pass,true);assert.deepEqual(sdkBrowser.errors,[]);
const resources=report('expedition-resources','report.json');assert.equal(resources.pass,true);assert.equal(resources.build.info.commit,info.commit);assert.equal(resources.samples.length,90);assert.equal(resources.expansionSamples.length,20);assert.equal(resources.coverage.completedCycles,10);assert.equal(resources.controls.fracture.retiredWorld.bodies,0);assert.equal(resources.controls.fracture.retiredWorld.constraints,0);assert.equal(resources.controls.fracture.activation.liveFragmentBodies,16);assert.equal(resources.controls.context.loss.pointerLockReleased,true);assert.equal(resources.controls.context.reload.navigationType,'reload');assert.equal(resources.controls.context.final.level,12);assert.equal(resources.controls.context.final.state,'playing');assert.deepEqual(resources.errors,[]);assert.deepEqual(resources.failedRequests,[]);assert.deepEqual(resources.unexpectedConsoleErrors,[]);
const attacks=report('expedition-new-attacks','release-collision-attacks.json');assert.equal(attacks.commit,info.commit);assert.equal(attacks.sourceStable,true);assert.equal(attacks.rows.length,153);
assert.ok(attacks.rows.every(row=>['finite-contact-trial-no-completion','restart-cleared','approach-did-not-reach-contact','setup-ended-by-production-death'].includes(row.outcome)));
assert.equal(attacks.rows.filter(row=>row.outcome==='restart-cleared').length,51);
let newAttacks={};if(!reviewOnly)newAttacks={...assertNewAdversarialProofs(report('expedition-new-attacks','targeted-release-contacts.json'),report('expedition-new-attacks','speedrun-expansion-new.json'),config),...assertMovingCollisionProof(report('expedition-new-attacks','parented-collision-stability.json'),config),...assertAlternativeRouteProofs(report('expedition-new-attacks','expedition-alternates-47-49.json'),report('expedition-new-attacks','expedition-alternates-50-51.json'),config)};
const yandex=report('expedition-yandex-upload','qa/yandex-package.json');assert.equal(yandex.pass,true);assert.equal(yandex.sourceCommit,info.commit);assert.equal(yandex.workingTreeModified,false);assert.equal(yandex.levels,51);assert.ok(yandex.compressedBytes<=100*1024*1024&&yandex.unpackedBytes<=100*1024*1024);assert.equal(yandex.sha256,fileHash(path.join(input,'expedition-yandex-upload/artifacts/brainrot-portal-yandex.zip')));

function validateRecordingMedia(record,directory){
 const movie=path.join(directory,record.video);
 assert.equal(fileHash(movie),record.sha256);assert.equal(fs.statSync(movie).size,record.bytes);
 const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,pix_fmt,width,height,avg_frame_rate,nb_frames','-show_entries','format=duration,size','-of','json',movie],{encoding:'utf8'}));
 const stream=metadata.streams?.[0];assert.equal(stream?.codec_name,'h264');assert.equal(stream.pix_fmt,'yuv420p');assert.equal(stream.width,record.width);assert.equal(stream.height,record.height);assert.equal(stream.avg_frame_rate,record.fps+'/1');assert.equal(Number(stream.nb_frames),record.frameCount);assert.equal(Number(metadata.format.size),record.bytes);assert.ok(Math.abs(Number(metadata.format.duration)-record.durationSeconds)<.1);
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-xerror','-i',movie,'-f','null','-'],{timeout:180000,stdio:'pipe'});
 for(const image of [record.poster,record.finishPoster]){const bytes=fs.readFileSync(path.join(directory,image));assert.ok(bytes.length>1000);assert.equal(bytes[0],255);assert.equal(bytes[1],216);assert.equal(bytes.at(-2),255);assert.equal(bytes.at(-1),217);}
}
const records=[];
for(const level of recordedLevels){
 const artifact='expedition-walkthroughs-'+recordingGroups.findIndex(group=>group.split(' ').map(Number).includes(level));
 const directory=path.join(input,artifact),stem='level-'+String(level).padStart(2,'0');
 const record=assertRecording(readJSON(path.join(directory,stem+'.json')),info,level);validateRecordingMedia(record,directory);records.push({record,directory,artifact});
}
const captureSourceEvidence=[];
if(!reviewOnly)for(const level of expeditionSupplementalRecordingLevels(config)){
 const artifact=expeditionSupplementalArtifactName(level),directory=path.join(input,artifact),stem='level-'+String(level).padStart(2,'0');
 assert.deepEqual(fs.readdirSync(directory).sort(),[stem+'.json',stem+'.mp4',stem+'.jpg',stem+'-finish.jpg','capture-source-evidence.json'].sort(),'Only completed supplemental captures may be promoted');
 const record=assertRecording(readJSON(path.join(directory,stem+'.json')),info,level);validateRecordingMedia(record,directory);
 const filename=path.join(directory,'capture-source-evidence.json'),evidence=assertSupplementalCaptureEvidence(readJSON(filename),config,level,{publicationRun:supplementalRecordingProof.publicationRun,controllerSHA:supplementalRecordingProof.controllerSHA,buildInfoSHA256:fileHash(path.join(candidate,'build-info.json'))});
 const sourceEvidence={level,path:'walkthroughs/'+stem+'-source-evidence.json',bytes:fs.statSync(filename).size,sha256:fileHash(filename),...evidence};captureSourceEvidence.push(sourceEvidence);records.push({record,directory,artifact,sourceEvidence});
}
records.sort((a,b)=>a.record.level-b.record.level);assert.deepEqual(records.map(entry=>entry.record.level),publishedLevels);
if(supplementalRecordingProof)supplementalRecordingProof.captureSourceEvidence=captureSourceEvidence;
const alternateInputs=[];
if(!reviewOnly){
 for(const {level,alternative}of EXPEDITION_ALTERNATIVES){
  const artifact='expedition-walkthroughs-1',directory=path.join(input,artifact),stem='level-'+level+'-alternate';
  const record=assertRecording(readJSON(path.join(directory,stem+'.json')),info,level,{alternative});validateRecordingMedia(record,directory);alternateInputs.push({record,directory,artifact});
 }
 assertAlternativeRecordings(alternateInputs.map(entry=>entry.record),info);
}

// Preserve every previous public byte. Changed files receive an immutable
// historical path before root/permalink/gallery bindings are updated.
const before=fileManifest(site),historyRoot=path.join(site,'publication-history',config.previousSourceCommit);
const archive=relative=>{const source=path.join(site,safeRelative(relative));if(!fs.existsSync(source))return;const target=path.join(historyRoot,relative);fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target))assert.equal(fileHash(target),fileHash(source),'Historical path cannot be overwritten');else fs.copyFileSync(source,target);};
// Keep the previous 41-room game executable at its immutable historical path.
// Its HTML and dynamic chunks use relative model/decoder URLs, so preserving
// those unchanged dependencies only at the new root would break the old game.
const historicalRuntimeFiles=expeditionHistoricalRuntimeFiles(before,config.previewPath);for(const file of historicalRuntimeFiles)archive(file.path);
const publish=(source,relative)=>{archive(relative);const target=path.join(site,safeRelative(relative));fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);};
const write=(relative,value)=>{archive(relative);const target=path.join(site,safeRelative(relative));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);};
for(const directory of ['assets',config.previewPath+'/assets']){
 const target=path.join(site,directory);if(fs.existsSync(target)){for(const file of fileManifest(target))archive(directory+'/'+file.path);fs.rmSync(target,{recursive:true});}
}
for(const file of exactCandidateFiles){publish(path.join(candidate,file.path),file.path);publish(path.join(candidate,file.path),config.previewPath+'/'+file.path);}
function publishRecording({record,directory,artifact,sourceEvidence}){
 const stem=record.video.slice(0,-4),src='walkthroughs/'+record.video,poster='walkthroughs/'+record.poster,finishPoster='walkthroughs/'+record.finishPoster,evidence='walkthroughs/'+stem+'.json';
 for(const [source,target]of [[record.video,src],[record.poster,poster],[record.finishPoster,finishPoster],[stem+'.json',evidence]])publish(path.join(directory,source),target);
 if(sourceEvidence)publish(path.join(directory,'capture-source-evidence.json'),sourceEvidence.path);
 const provenance=sourceEvidence?{kind:'publication-supplemental-native-recording',publicationRun:supplementalRecordingProof.publicationRun,controllerSHA:supplementalRecordingProof.controllerSHA,artifactId:supplementalArtifacts.find(a=>a.name===artifact).id,method:record.method,captureSourceEvidence:{path:sourceEvidence.path,bytes:sourceEvidence.bytes,sha256:sourceEvidence.sha256}}:{kind:'exact-candidate-native-recording',candidateRun:config.candidateRun,artifactId:artifactManifest.find(a=>a.name===artifact).id,method:record.method};
 return {level:record.level,title:record.title,...(record.alternative?{alternative:record.alternative}:{}),src,poster,finishPoster,evidence,sourceCommit:record.sourceCommit,bytes:record.bytes,sha256:record.sha256,width:record.width,height:record.height,fps:record.fps,frameCount:record.frameCount,durationSeconds:record.durationSeconds,continuous:true,posterSHA256:fileHash(path.join(site,poster)),finishPosterSHA256:fileHash(path.join(site,finishPoster)),evidenceSHA256:fileHash(path.join(site,evidence)),provenance};
}
const newRecordings=records.map(publishRecording),alternateRecordings=alternateInputs.map(publishRecording);
const currentGalleryEntries=newRecordings.map(record=>{const alternative=alternateRecordings.find(entry=>entry.level===record.level);return alternative?{...record,alternative}:record;});
const nextGallery={...previousGallery,sourceCommit:info.commit,supersededLevels:(previousGallery.supersededLevels||[]).filter(level=>!publishedLevels.includes(level)),historicalRecordingLevels:retainedEntries.map(entry=>entry.level),levels:[...retainedEntries,...currentGalleryEntries].sort((a,b)=>a.level-b.level),historicalRecordings:previousGallery.levels.filter(entry=>publishedLevels.includes(entry.level)).map(entry=>({...entry,archivedSrc:path.relative(site,path.join(historyRoot,entry.src)).split(path.sep).join('/'),archivedPoster:path.relative(site,path.join(historyRoot,entry.poster)).split(path.sep).join('/')})),historicalFinale:{...previousGallery.levels[40],archivedSrc:path.relative(site,path.join(historyRoot,previousGallery.levels[40].src)).split(path.sep).join('/'),archivedPoster:path.relative(site,path.join(historyRoot,previousGallery.levels[40].poster)).split(path.sep).join('/')}};
if(!reviewOnly){delete nextGallery.retainedRecordingSourceCommit;nextGallery.recordingSources={current:51,alternatives:4,archived:41,archivedCompatibility:'not asserted'};nextGallery.archivedRecordingSourceCommits=[...new Set(previousGallery.levels.map(entry=>entry.sourceCommit))].sort();}
assert.deepEqual(nextGallery.levels.filter(e=>!publishedLevels.includes(e.level)),retainedEntries,'Historical recordings retain their original entry metadata');
write('walkthroughs/manifest.json',JSON.stringify(nextGallery,null,2)+'\n');
let historicalVideoIndex;
if(!reviewOnly){write('walkthroughs/history.html',expeditionHistoricalVideoHTML(nextGallery.historicalRecordings,config.previousSourceCommit));historicalVideoIndex={path:'walkthroughs/history.html',bytes:fs.statSync(path.join(site,'walkthroughs/history.html')).size,sha256:fileHash(path.join(site,'walkthroughs/history.html'))};}
const previousJS=fs.readFileSync(path.join(site,'walkthroughs.js'),'utf8');write('walkthroughs.js',expeditionGalleryScript(previousJS));
const previousHTML=fs.readFileSync(path.join(site,'walkthroughs.html'),'utf8');
write('walkthroughs.html',expeditionGalleryHTML(previousHTML,{recordings:newRecordings.length,alternatives:alternateRecordings.length}));
const castleInput=records.find(entry=>entry.record.level===41),castle=castleInput.record,newCastle=newRecordings.find(entry=>entry.level===41);
const previewRelease={sourceCommit:info.commit,version:info.version,candidateRun:config.candidateRun,publicationRun:process.env.GITHUB_RUN_ID||null,previewPath:config.previewPath,mode:'complete',nativeRouteVerified:true,mobileUIVerified:true,completedMachines:info.features.tower.stages,checkpoints:false,seconds:castle.route.seconds,activeSeconds:castle.route.activeSeconds,video:{filename:'../'+newCastle.src,sha256:newCastle.sha256,frames:newCastle.frameCount,fps:newCastle.fps,width:newCastle.width,height:newCastle.height,durationSeconds:newCastle.durationSeconds},method:castle.method};
write(config.previewPath+'/preview-release.json',JSON.stringify(previewRelease,null,2)+'\n');
publish(path.join(castleInput.directory,'level-41.json'),config.previewPath+'/recording-evidence.json');
publish(path.join(input,'expedition-webgl-6/report.json'),config.previewPath+'/native-evidence.json');
write(config.previewPath+'/ui-evidence.json',JSON.stringify({sourceCommit:info.commit,kind:'accepted-expedition-menu-and-mocked-SDK',menu,sdk,sdkBrowser},null,2)+'\n');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=seconds=>Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');
const chapters=castle.milestones.filter(mark=>mark.name.startsWith('Start '));
write(config.previewPath+'/walkthrough.html',`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Складчатый замок — прохождение</title><style>body{margin:0;background:#0e1c27;color:#e8f0ef;font:17px/1.6 system-ui}main{max-width:1100px;margin:auto;padding:36px 24px}a{color:#8debdc}video{width:100%;border-radius:16px;margin:24px 0}nav{display:flex;gap:20px;flex-wrap:wrap}.chapters{display:flex;gap:8px;flex-wrap:wrap}button{background:#183744;border:1px solid #426574;border-radius:8px;padding:10px;color:#e8f0ef;cursor:pointer;font:inherit}.note{color:#b7ccd4}</style></head><body><main><h1>Складчатый замок</h1><p>11 физических головоломок без контрольных точек. Непрерывное прохождение: ${clock(castle.durationSeconds)}.</p><nav><a href="./?edition=foundation&level=41">Играть в замок</a><a href="../">Основная кампания</a><a href="../walkthroughs.html?level=42">Новая глава 42–51</a></nav><video id="video" controls playsinline preload="metadata" poster="../${newCastle.poster}" src="../${newCastle.src}"></video><div class="chapters">${chapters.map(c=>`<button data-seek="${c.seconds}">${clock(c.seconds)} · ${escape(c.name.slice(6))}</button>`).join('')}</div><p class="note">Запись текущей версии через обычное управление и физику игры, в масштабе 1×, 4 кадра/с. Автоматический маршрут; частота записи не измеряет FPS устройства.</p><p><a href="recording-evidence.json">Исходный отчёт записи</a> · <a href="../expedition-release.json">Приёмка выпуска</a> · <a href="../${nextGallery.historicalFinale.archivedSrc}">Архив предыдущего прохождения замка</a></p></main><script>document.querySelectorAll('[data-seek]').forEach(b=>b.addEventListener('click',()=>{const v=document.querySelector('#video');v.currentTime=Number(b.dataset.seek);v.play().catch(()=>{});}));</script></body></html>`);
for(const file of exactCandidateFiles)for(const prefix of ['',config.previewPath+'/'])assert.equal(fileHash(path.join(site,prefix+file.path)),file.sha256,'Exact candidate byte changed during promotion');
const preserved=assertPreservedFiles(before,site,historyRoot);
const archivedRuntime=historicalRuntimeFiles.map(file=>{const archivedPath=path.relative(site,path.join(historyRoot,file.path)).split(path.sep).join('/');assert.equal(fileHash(path.join(site,archivedPath)),file.sha256);return {...file,archivedPath};});
preserved.archived=[...new Map([...preserved.archived,...archivedRuntime].map(file=>[file.path,file])).values()].sort((a,b)=>a.path.localeCompare(b.path));
const historicalRuntime={sourceCommit:config.previousSourceCommit,rootPath:path.relative(site,historyRoot).split(path.sep).join('/'),previewPath:path.relative(site,path.join(historyRoot,config.previewPath)).split(path.sep).join('/'),files:archivedRuntime.map(({archivedPath,bytes,sha256})=>({path:archivedPath,bytes,sha256}))};
for(const entry of retainedEntries){assert.equal(fileHash(path.join(site,entry.src)),entry.sha256);assert.equal(fileHash(path.join(site,entry.poster)),before.find(f=>f.path===entry.poster).sha256);}
const generatedPresentationFiles=reviewOnly?undefined:expeditionPresentationPaths(config).map(relative=>({path:relative,bytes:fs.statSync(path.join(site,relative)).size,sha256:fileHash(path.join(site,relative))}));
const release={sourceCommit:info.commit,version:info.version,candidateRun:config.candidateRun,previousSourceCommit:config.previousSourceCommit,previousPublicationRun:config.previousPublicationRun,previewPath:config.previewPath,publicationRun:process.env.GITHUB_RUN_ID||null,publishable:!reviewOnly,exactCandidateFiles,preservedFiles:preserved.retained,archivedFiles:preserved.archived,historicalRuntime,newRecordings,alternateRecordings,...(supplementalRecordingProof?{supplementalRecordingLevels:expeditionSupplementalRecordingLevels(config),supplementalRecordingProof,historicalVideoIndex,generatedPresentationFiles}:{}),rootGalleryManifestSHA256:fileHash(path.join(site,'walkthroughs/manifest.json')),previewReleaseSHA256:fileHash(path.join(site,config.previewPath,'preview-release.json')),acceptedJobs,artifactManifest:artifactManifest.map(({id,name,digest,workflow_run})=>({id,name,digest,sourceCommit:workflow_run.head_sha,candidateRun:workflow_run.id})),previousArtifact:baseArtifacts[0],checks:{routes,webglLevels:webgl,resources:resources.coverage,attackOutcomes:attacks.counts,...newAttacks,yandex:{sha256:yandex.sha256,compressedBytes:yandex.compressedBytes,unpackedBytes:yandex.unpackedBytes}},acceptance:{automated:!reviewOnly,humanPlaytest:false,physicalDeviceBenchmark:false,liveYandex:false},method:reviewOnly?'Local publication-mechanics review of a withdrawn candidate; cannot be deployed.':'Exact accepted CI bytes promoted without rebuild; historical recordings retain their original revision; the previous game runtime and every changed prior file are archived.'};
write('expedition-release.json',JSON.stringify(release,null,2)+'\n');
const siteBytes=fileManifest(site).reduce((sum,file)=>sum+file.bytes,0);assert.ok(siteBytes<=500*1024*1024,'Publication exceeds 500 MiB');
fs.mkdirSync(proofDirectory,{recursive:true});fs.writeFileSync(path.join(proofDirectory,'assembly.json'),JSON.stringify({...release,siteBytes},null,2)+'\n');fs.writeFileSync(path.join(proofDirectory,'expedition-release.json'),JSON.stringify(release,null,2)+'\n');
console.log(JSON.stringify({sourceCommit:info.commit,exactCandidateFiles:exactCandidateFiles.length,newRecordings:newRecordings.length,alternateRecordings:alternateRecordings.length,preservedFiles:preserved.retained.length,archivedFiles:preserved.archived.length,siteBytes}));
