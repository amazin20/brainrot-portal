import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {GROUPS,SEQUENCE,sha,digestRows,inventory,assertFrozenCheckout,assertReportedPackage,
 assertNativeReport,assertOverviewReport,assertMenuReport,assertAnimationReport,assertStorageReport} from './lib/campaign-v56-proof.mjs';
import {capturePublicOrigin,wrapPublicCapture,validatePublicCapture,validateExactR5Packet} from './lib/campaign-v56-public-proof.mjs';
import {assertBareRuntime,assertIsolatedStorage} from './qa-campaign-v56-public-entry.mjs';
import {observerIdentity,assertBrowserObservations,verifyActualPuppeteerImportIdentity} from './observe-campaign-v56-browser.mjs';

const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');};
const shell=value=>"'"+String(value).replaceAll("'","'\\''")+"'";
export const PUBLIC_ROLES=Object.freeze([...Object.keys(GROUPS).map(part=>'native-'+part),'presentation','entry']);
export function roleInfo(role){
 if(role==='presentation'||role==='entry')return {role,key:role,name:role,levels:[]};
 const part=role.replace(/^native-/,'');assert.ok(role==='native-'+part&&part in GROUPS,'Unknown PUBLIC role');
 return {role,key:'native',name:'native ('+part+', '+GROUPS[part].join(',')+')',part,levels:GROUPS[part]};
}
const campaignURL=level=>'https://amazin20.github.io/brainrot-portal/campaign-v56/?edition=foundation&level='+level+'&debug=1';
function exactSource(root,spec){assertFrozenCheckout(root,spec);return root;}
function sourceBinding(){const binding=read('proof/source-binding.json');assert.equal(binding.pass,true);assert.equal(binding.sourceAccepted,true);assert.equal(binding.publicationAccepted,false);return binding;}
function candidateBytes(binding){const bytes=fs.readFileSync('proof/review-artifacts/campaign-polish-dist/build-info.json'),row=binding.candidateFiles.find(row=>row.path==='build-info.json');assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);return bytes;}
function verifiedZip(zip,directory,pin){return JSON.parse(execFileSync('python3',['scripts/publish-campaign-v56.py','verify-extracted','--zip',zip,'--directory',directory,
 '--expected-bytes',String(pin.size_in_bytes),'--expected-sha256',pin.digest.slice(7)],{encoding:'utf8',maxBuffer:25_000_000}));}

export function assertBrowserObservation(observed,{spec,origin,buildInfoBytes,expectedURLs}){
 const env={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:spec.repository,GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'push',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:String(origin.publicationRun),GITHUB_SHA:origin.publisherCommit,GITHUB_JOB:origin.jobKey,
  EXPECTED_SOURCE_COMMIT:spec.sourceCommit,EXPECTED_SOURCE_TREE:spec.sourceTree,EXPECTED_SOURCE_PARENT:spec.sourceParent,EXPECTED_SOURCE_RUN:String(spec.sourceReview.runId),EXPECTED_SOURCE_ATTEMPT:String(spec.sourceReview.runAttempt),
  PUBLIC_OBSERVER_JOB_ID:String(origin.jobId),PUBLIC_BUILD_INFO_BYTES:String(buildInfoBytes.length),PUBLIC_BUILD_INFO_SHA256:sha(buildInfoBytes)};
 const identity=observerIdentity(env);assertBrowserObservations(observed,{identity});
 const urls=observed.observedURLs;assert.deepEqual([...new Set(urls)].sort(),expectedURLs.slice().sort(),'The actual browser never visited every expected PUBLIC room URL');
 return expectedURLs;
}
export function assertObservedPayload(observed,{directory,report,part,expectedURLs}){
 const events=observed.observations.filter(event=>event.phase==='after'&&event.approved&&expectedURLs.includes(event.url));
 const captures=events.flatMap(event=>[...(event.capture?[{...event.capture,event}]:[]),...(event.captures||[]).map(capture=>({...capture,event}))]);
 const retained=inventory(directory).filter(row=>/\.(?:jpg|png|webp)$/.test(row.path));
 for(const row of retained){const room=/^(\d+)-(?:start|overview|finish)\.jpg$/.exec(row.path);const expectedURL=room?campaignURL(Number(room[1])):undefined;
  const index=captures.findIndex(capture=>capture.bytes===row.bytes&&capture.sha256===row.sha256&&(!expectedURL||capture.event.url===expectedURL));
  assert.ok(index>=0,'Retained image was not observed from the actual PUBLIC browser: '+row.path);const [capture]=captures.splice(index,1);
  if(part==='native'){const start=report.rows.find(item=>item.level===Number(room[1])).start;assert.deepEqual(capture.event.frame,{levelIndex:start.levelIndex,state:'won',cargoUUID:start.cargoUUID,cargoBodyId:start.cargoBodyId},'Native finish pixels are not bound to the original winning PUBLIC body');}
 }
 const starts=Array.isArray(report.rows)?report.rows.map(row=>({state:row.start,url:campaignURL(row.level)})):report.runtime?[{state:report.runtime,url:expectedURLs[0]}]:[];
 for(const {state,url}of starts){assert.ok(events.some(event=>event.url===url&&event.frame&&['levelIndex','cargoUUID','cargoBodyId'].every(key=>state[key]===undefined||event.frame[key]===state[key])),'Reported room start was not observed at its actual PUBLIC URL');}
 return {observedRetainedImages:retained.length,observedRoomStarts:starts.length};
}
async function publicContext(ctx,role){
 const spec=ctx.pins(),now=ctx.current(),info=roleInfo(role);const [run,jobs]=await Promise.all([ctx.request('actions/runs/'+now.publicationRun),ctx.all('actions/runs/'+now.publicationRun+'/attempts/1/jobs','jobs')]);
 const matched=jobs.filter(job=>job.name===info.name);assert.equal(matched.length,1);const job=matched[0];
 return {spec,now,info,run,job,origin:capturePublicOrigin({spec,run,job,expectedJob:info})};
}
async function captureOrigin(ctx,role){
 const context=await publicContext(ctx,role),binding=sourceBinding(),bytes=candidateBytes(binding),root='proof/public-'+role;
 exactSource('source',context.spec);assert.deepEqual(binding.sourceReview,context.spec.sourceReview);assert.equal(binding.sourceCommit,context.spec.sourceCommit);assert.equal(binding.sourceTree,context.spec.sourceTree);
 write(root+'/origin.json',context.origin);write(root+'/provider-before.json',{run:context.run,job:context.job});
 const values={SOURCE_DIR:path.resolve('source'),EXPECTED_SOURCE_COMMIT:context.spec.sourceCommit,EXPECTED_SOURCE_TREE:context.spec.sourceTree,EXPECTED_SOURCE_PARENT:context.spec.sourceParent,
  EXPECTED_SOURCE_RUN:context.spec.sourceReview.runId,EXPECTED_SOURCE_ATTEMPT:context.spec.sourceReview.runAttempt,PUBLIC_OBSERVER_JOB_ID:context.job.id,
  PUBLIC_BUILD_INFO_BYTES:bytes.length,PUBLIC_BUILD_INFO_SHA256:sha(bytes)};
 fs.mkdirSync(root,{recursive:true});fs.writeFileSync(root+'/env.sh',Object.entries(values).map(([key,value])=>'export '+key+'='+shell(value)).join('\n')+'\n');
}
function bareSemantics(report,{directory,spec,origin,expectedURLs}){
 assert.equal(report.kind,'campaign-v56-bare-entry-and-historical-save-isolation');assert.equal(report.localPreparation,false);assert.equal(report.publicationAccepted,false);assert.equal(report.url,spec.publicURL);
 assert.deepEqual(report.producerOrigin,{kind:'github-actions',repository:spec.repository,headSha:origin.publisherCommit,runId:origin.publicationRun,runAttempt:1,job:origin.jobKey});
 assert.ok(report.runtimeObservations.length>=3);assert.deepEqual(report.storageObservations.map(row=>row.phase),['imported','settings','playing','reloaded']);for(const runtime of report.runtimeObservations){assert.ok(['ready','playing'].includes(runtime.runtimeState));assertBareRuntime(runtime,{state:runtime.runtimeState,expectedURL:spec.publicURL});}
 for(const value of report.storageObservations)assertIsolatedStorage(value,report.seededHistoricalRecords);assert.ok(report.checks.length>=3);assert.ok(report.captures.length>0);
 return {pass:true,actualURLs:expectedURLs,requiredFiles:['report.json',...report.captures.map(row=>row.file)],scope:'Actual bare entry, preserved old preferences, trusted Play and reload'};
}
async function validators(ctx,spec,binding){
 const root=exactSource('source',spec),metadata=JSON.parse(candidateBytes(binding));
 const {assertCampaignBrowserState}=await import(pathToFileURL(path.resolve(root,'scripts/lib/campaign-browser-contract.mjs')));
 const {assertFoundation20Route}=await import(pathToFileURL(path.resolve(root,'scripts/lib/foundation20-native-proof.mjs')));
 return {metadata,runtime:(state,level)=>assertCampaignBrowserState(state,level),physical20:assertFoundation20Route};
}
function requiredFiles(root){return inventory(root).map(row=>row.path);}
async function captureEnvelopes(ctx,role,{folder='proof/public-'+role,run,job,origin,validate=false}={}){
 const spec=ctx.pins(),binding=sourceBinding(),bytes=candidateBytes(binding),info=roleInfo(role),v=await validators(ctx,spec,binding),receipts=[];
 const subcases=info.key==='native'?[{part:'native',root:folder+'/payload',mode:'campaign',urls:info.levels.map(campaignURL)}]:role==='entry'?
  [{part:'entry',root:folder+'/payload',mode:'bare',urls:[spec.publicURL]}]:[
   {part:'menu',root:folder+'/payload/menu',mode:'campaign',urls:[campaignURL(1)]},
   {part:'architecture',root:folder+'/payload/architecture',mode:'campaign',urls:SEQUENCE.map(campaignURL)},
   {part:'animation',root:folder+'/payload/animation',mode:'campaign',urls:[campaignURL(9)]},
   {part:'storage',root:folder+'/payload/storage',mode:'storage-debug',urls:[spec.publicURL+'?debug=1']}];
 if(!run||!job){const context=await publicContext(ctx,role);run=context.run;job=context.job;origin=read(folder+'/origin.json');assert.deepEqual(origin,context.origin);}
 for(const item of subcases){const envelopePath=folder+'/envelope-'+item.part+'.json';const observations=read(folder+'/browser-'+item.part+'.json');
  const callback=report=>{
   assertBrowserObservation(observations,{spec,origin,buildInfoBytes:bytes,expectedURLs:item.urls});const images=[],image=ctx.imageChecker(item.root,images);let semantic;
   if(info.key==='native')semantic=assertNativeReport(report,info.levels,v.metadata,spec.sourceCommit,{assertRuntime:v.runtime,assertImage:image,assertPhysical20:v.physical20});
   else if(item.part==='menu')semantic=assertMenuReport(report,v.metadata,{assertImage:image});
   else if(item.part==='architecture')semantic=assertOverviewReport(report,v.metadata,spec.sourceCommit,{assertRuntime:v.runtime,assertImage:image});
   else if(item.part==='animation')semantic=assertAnimationReport(report,v.metadata,spec.sourceCommit,{assertRuntime:v.runtime,assertImage:image,assertMovie:ctx.movieChecker(item.root)});
   else if(item.part==='storage')semantic=assertStorageReport(report,v.metadata,spec.sourceCommit,{actualPublic:true,publicURL:spec.publicURL});
   else{for(const frame of report.captures){const decoded=image(frame.file,undefined);assert.equal(decoded.bytes,frame.bytes);assert.equal(decoded.sha256,frame.sha256);}semantic=bareSemantics(report,{directory:item.root,spec,origin,expectedURLs:item.urls});}
   const observedPayload=assertObservedPayload(observations,{directory:item.root,report,part:item.part,expectedURLs:item.urls});
   return {pass:true,actualURLs:item.urls,requiredFiles:requiredFiles(item.root),...semantic,actualDecodedImages:images,...observedPayload};
  };
  const options={directory:item.root,origin,spec,run,job,expectedJob:info,buildInfoBytes:bytes,candidateFiles:binding.candidateFiles,expectedURLs:item.urls,mode:item.mode,assertReport:callback};
  const envelope=validate?validatePublicCapture(read(envelopePath),options):wrapPublicCapture(options);if(!validate)write(envelopePath,envelope);receipts.push(envelope);
 }
 exactSource('source',spec);return receipts;
}
async function wrapCapture(ctx,role){const context=await publicContext(ctx,role);await captureEnvelopes(ctx,role,{run:context.run,job:context.job,origin:read('proof/public-'+role+'/origin.json')});write('proof/public-'+role+'/provider-after.json',{run:context.run,job:context.job});}
async function verifyBaseline(ctx){
 const spec=ctx.pins(),pin=spec.baseline.verificationArtifact;const receipt=verifiedZip('proof/downloads/'+pin.id+'.zip','proof/baseline-verification',pin);const manifest=read('proof/baseline-verification/publication-manifest.json');assert.equal(manifest.siteFiles.length,spec.baseline.files);assert.equal(manifest.siteBytes,spec.baseline.bytes);assert.equal(digestRows(manifest.siteFiles),spec.baseline.inventorySha256);assert.equal(manifest.siteFilesSha256,spec.baseline.inventorySha256);write('proof/baseline-received-packet-audit.json',{pass:true,publicationAccepted:false,artifactId:pin.id,zipSha256:receipt.zipSha256,files:spec.baseline.files,bytes:spec.baseline.bytes,inventorySha256:spec.baseline.inventorySha256});
}
export function assertPublicCohort(run,jobs,{now}){
 assert.equal(run.id,now.publicationRun);assert.equal(run.head_sha,now.publisherCommit);assert.equal(run.run_attempt,1);assert.equal(run.event,'push');assert.equal(run.head_branch,'main');assert.equal(run.path,'.github/workflows/publish-campaign-v56.yml');
 assert.equal(jobs.length,11);assert.equal(new Set(jobs.map(job=>job.id)).size,11);const names=['assemble','deploy',...PUBLIC_ROLES.map(role=>roleInfo(role).name),'verify'];assert.deepEqual(jobs.map(job=>job.name).sort(),names.sort());
 for(const job of jobs){assert.equal(job.run_id,run.id);assert.equal(job.run_attempt,1);assert.equal(job.head_sha,now.publisherCommit);if(job.name==='verify'){assert.equal(job.status,'in_progress');assert.equal(job.conclusion,null);}else{assert.equal(job.status,'completed');assert.equal(job.conclusion,'success');}}
}
export function assertProducerArtifact(pin,job,now){
 assert.equal(pin.expired,false);assert.equal(pin.workflow_run.id,now.publicationRun);assert.equal(pin.workflow_run.head_sha,now.publisherCommit);assert.equal(pin.workflow_run.head_branch,'main');assert.equal(pin.workflow_run.repository_id,1354625251);assert.equal(pin.workflow_run.head_repository_id,1354625251);assert.match(pin.digest,/^sha256:[a-f0-9]{64}$/);
 const uploads=job.steps.filter(step=>step.conclusion==='success'&&step.name==='Run actions/upload-artifact@v4');assert.equal(uploads.length,1);assert.ok(Date.parse(pin.created_at)>=Date.parse(uploads[0].started_at)-2000&&Date.parse(pin.created_at)<=Date.parse(uploads[0].completed_at)+2000);
}
export function preparePublicInput(){
 const root='proof/public-input';assert.equal(fs.existsSync(root),false);fs.mkdirSync(root,{recursive:true});
 for(const name of ['source-binding.json','package-binding.json','publication-manifest.json','guard-preparation.json','baseline-independent-acceptance-preparation.json','baseline-received-packet-audit.json'])fs.copyFileSync('proof/'+name,root+'/'+name);
 fs.copyFileSync('proof/actual-puppeteer-module-identity.json',root+'/actual-puppeteer-module-identity.json');
 for(const name of ['review-artifacts/campaign-polish-dist','job-logs/source','provider'])fs.cpSync('proof/'+name,root+'/'+name,{recursive:true});
 const rows=inventory(root,{maximum:25_000_000});write(root+'/public-input-closure.json',{kind:'bounded-complete-campaign-v56-public-input-closure',pass:true,publicationAccepted:false,files:rows,bytes:rows.reduce((n,row)=>n+row.bytes,0),inventorySha256:digestRows(rows),maximumBytes:25_000_000});inventory(root,{maximum:25_000_000});
}
async function aggregate(ctx){
 const spec=ctx.pins(),now=ctx.current(),[run,jobs,artifacts]=await Promise.all([ctx.request('actions/runs/'+now.publicationRun),ctx.all('actions/runs/'+now.publicationRun+'/attempts/1/jobs','jobs'),ctx.all('actions/runs/'+now.publicationRun+'/artifacts','artifacts')]);
 assertPublicCohort(run,jobs,{now});const images=[],envelopes=[],pins=[];let total=0;
 for(const role of PUBLIC_ROLES){const name='campaign-v56-public-'+role+'-'+now.publicationRun+'-1',matched=artifacts.filter(row=>row.name===name);assert.equal(matched.length,1);const pin=matched[0],info=roleInfo(role),job=jobs.find(job=>job.name===info.name);
  assertProducerArtifact(pin,job,now);
  total+=pin.size_in_bytes;assert.ok(total<=spec.limits.boundedVerificationBytes);const zip='proof/public-downloads/'+pin.id+'.zip',folder='proof/public-'+role;
  await ctx.downloadOne(pin,zip,spec.limits.boundedVerificationBytes);execFileSync('python3',['scripts/publish-campaign-v56.py','extract-zip','--zip',zip,'--output',folder,'--expected-bytes',String(pin.size_in_bytes),'--expected-sha256',pin.digest.slice(7)],{stdio:'inherit'});verifiedZip(zip,folder,pin);
  const origin=read(folder+'/origin.json');envelopes.push({role,artifact:pin,jobId:job.id,envelopes:await captureEnvelopes(ctx,role,{folder,run,job,origin,validate:true})});pins.push(pin);
 }
 const deployName='campaign-v56-deploy-'+now.publicationRun+'-1',deployArtifacts=artifacts.filter(row=>row.name===deployName);assert.equal(deployArtifacts.length,1);const deployArtifact=deployArtifacts[0];assertProducerArtifact(deployArtifact,jobs.find(job=>job.name==='deploy'),now);
 await ctx.downloadOne(deployArtifact,'proof/public-downloads/'+deployArtifact.id+'.zip',25_000_000);
 execFileSync('python3',['scripts/publish-campaign-v56.py','extract-zip','--zip','proof/public-downloads/'+deployArtifact.id+'.zip','--output','proof/deploy-proof','--expected-bytes',String(deployArtifact.size_in_bytes),'--expected-sha256',deployArtifact.digest.slice(7)],{stdio:'inherit'});
 verifiedZip('proof/public-downloads/'+deployArtifact.id+'.zip','proof/deploy-proof',deployArtifact);
 const manifest=read('proof/deploy-proof/publication-manifest.json'),post=read('proof/deploy-proof/public-bytes.json');assert.equal(post.pass,true);assert.equal(post.phase,'published');assert.equal(post.publicationRun,now.publicationRun);assert.equal(post.publicationRunAttempt,1);assert.equal(post.publisherCommit,now.publisherCommit);
 assert.equal(post.checked,manifest.siteFiles.length);assert.equal(post.bytes,manifest.siteBytes);assert.equal(post.siteFilesSha256,manifest.siteFilesSha256);
 const output='proof/public-verification';assert.equal(fs.existsSync(output),false);fs.mkdirSync(output,{recursive:true});
 for(const role of PUBLIC_ROLES)fs.cpSync('proof/public-'+role,output+'/public-'+role,{recursive:true});
 // Retain only explicit identifying metadata, all actual PUBLIC payloads and
 // complete actual PUBLIC job logs. Never include caches or production copies.
 for(const name of ['source-binding.json','package-binding.json','publication-manifest.json']){const file='proof/deploy-proof/'+name;assert.ok(fs.existsSync(file));fs.copyFileSync(file,output+'/'+name);}
 fs.copyFileSync('proof/deploy-proof/public-bytes.json',output+'/public-bytes.json');
 for(const job of jobs.filter(job=>job.name!=='verify')){const response=await ctx.request('actions/jobs/'+job.id+'/logs',{binary:true}),data=Buffer.from(await response.arrayBuffer());assert.ok(data.length>0&&data.length<20_000_000);fs.mkdirSync(output+'/job-logs',{recursive:true});fs.writeFileSync(output+'/job-logs/'+job.id+'.log',data);}
 write(output+'/provider-run-before-final.json',run);write(output+'/provider-jobs-before-final.json',jobs);write(output+'/provider-public-artifacts.json',[...pins,deployArtifact]);
 execFileSync('python3',['scripts/publish-campaign-v56.py','check-public','--manifest','proof/deploy-proof/publication-manifest.json','--output',output+'/public-final.json','--pins','tools/campaign-v56-release.json','--publisher',now.publisherCommit,'--run',String(now.publicationRun),'--attempt','1','--phase','published'],{stdio:'inherit'});
 await ctx.guard('final');fs.copyFileSync('proof/guard-final.json',output+'/guard-final.json');fs.copyFileSync('proof/provider/deployments-final.json',output+'/deployments-final.json');fs.copyFileSync('proof/provider/public-jobs-final.json',output+'/provider-jobs-final.json');fs.copyFileSync('proof/provider/public-run-final.json',output+'/provider-run-final.json');
 write(output+'/public-acceptance.json',{kind:'whole-campaign-v56-actual-PUBLIC-verification',pass:true,publicationAccepted:false,sourceAccepted:true,...now,sourceCommit:spec.sourceCommit,sourceTree:spec.sourceTree,sourceReview:spec.sourceReview,
  ordinaryNativePublicWins:51,publicRouteMovies:0,architectureFrames:102,menuFrames:6,actualAnimationMovies:2,actualHeldAngleStills:6,sourceFiniteProbeLimitations:sourceBinding().finiteShortcutAudit,
  captures:envelopes,siteFiles:manifest.siteFiles.length,siteBytes:manifest.siteBytes,siteInventorySha256:manifest.siteFilesSha256,baselinePreserved:{files:2038,bytes:640738913,inventorySha256:spec.baseline.inventorySha256},
  baselineRootAudit:spec.baseline.rootAudit,sourceRootAudit:spec.sourceRootAudit,
  scope:'All prior producer jobs are successful; this final verifier job is still in progress and cannot claim its own success. Root final actual11-job/provider/artifact audit is required.',
  limitations:['Finite SOURCE shortcut audit does not establish an exhaustive bypass guarantee.','Native51routes provide51finishedJPEGs rather than51route movies.','No hardware FPS, physical device benchmark or human playtest is claimed.']});
 const rows=inventory(output,{maximum:spec.limits.boundedVerificationBytes});write(output+'/verification-packet.json',{kind:'campaign-v56-public-verification-packet',schemaVersion:1,pass:true,publicationAccepted:false,...now,sourceCommit:spec.sourceCommit,sourceTree:spec.sourceTree,sourceReview:spec.sourceReview,files:rows,bytes:rows.reduce((n,row)=>n+row.bytes,0),inventorySha256:digestRows(rows),maximumBytes:spec.limits.boundedVerificationBytes});
 inventory(output,{maximum:spec.limits.boundedVerificationBytes});for(const pin of pins)verifiedZip('proof/public-downloads/'+pin.id+'.zip','proof/public-'+PUBLIC_ROLES.find(role=>pin.name==='campaign-v56-public-'+role+'-'+now.publicationRun+'-1'),pin);
}
export async function dispatchPublic(command,arg,ctx){
 if(command==='prepare-public-input')return preparePublicInput();
 if(command==='verify-browser-module'){const receipt=await verifyActualPuppeteerImportIdentity({sourceDirectory:path.resolve('source')});write('proof/actual-puppeteer-module-identity.json',receipt);return receipt;}
 if(command==='verify-baseline')return verifyBaseline(ctx);
 if(command==='capture-origin')return captureOrigin(ctx,arg);
 if(command==='wrap-capture')return wrapCapture(ctx,arg);
 if(command==='verify-public-aggregate')return aggregate(ctx);
 throw Error('Unknown campaign-v56 public controller command');
}

