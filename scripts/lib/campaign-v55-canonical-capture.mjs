// Semantic capture callbacks from the exact published54cf tree. No capture or
// envelope is rewritten. The caller authenticates archived provider run snapshots
// separately from the truthful failed final original run and new read-only producer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {SEQUENCE,sha,inventory,assertFrozenCheckout,assertNativeReport,assertOverviewReport,assertMenuReport,assertAnimationReport,assertStorageReport} from './campaign-v55-proof.mjs';
import {validatePublicCapture} from './campaign-v55-public-proof.mjs';
import {assertBareRuntime,assertIsolatedStorage} from '../qa-campaign-v55-public-entry.mjs';
import {roleInfo,assertBrowserObservation,assertObservedPayload} from '../publish-campaign-v55-run.mjs';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const campaignURL=level=>'https://amazin20.github.io/brainrot-portal/campaign-v55/?edition=foundation&level='+level+'&debug=1';
function exactSource(root,spec){assertFrozenCheckout(root,spec);return root;}
function sourceBinding(){const binding=read('proof/source-binding.json');assert.equal(binding.pass,true);assert.equal(binding.sourceAccepted,true);assert.equal(binding.publicationAccepted,false);return binding;}
function candidateBytes(binding){const bytes=fs.readFileSync('proof/review-artifacts/campaign-polish-dist/build-info.json'),row=binding.candidateFiles.find(row=>row.path==='build-info.json');assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);return bytes;}
function bareSemantics(report,{directory,spec,origin,expectedURLs}){
 assert.equal(report.kind,'campaign-v55-bare-entry-and-historical-save-isolation');assert.equal(report.localPreparation,false);assert.equal(report.publicationAccepted,false);assert.equal(report.url,spec.publicURL);
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
export async function validateCanonicalCaptures(ctx,role,{folder='proof/public-'+role,run,job,origin,validate=false}={}){
 const spec=ctx.pins(),binding=sourceBinding(),bytes=candidateBytes(binding),info=roleInfo(role),v=await validators(ctx,spec,binding),receipts=[];
 const subcases=info.key==='native'?[{part:'native',root:folder+'/payload',mode:'campaign',urls:info.levels.map(campaignURL)}]:role==='entry'?
  [{part:'entry',root:folder+'/payload',mode:'bare',urls:[spec.publicURL]}]:[
   {part:'menu',root:folder+'/payload/menu',mode:'campaign',urls:[campaignURL(1)]},
   {part:'architecture',root:folder+'/payload/architecture',mode:'campaign',urls:SEQUENCE.map(campaignURL)},
   {part:'animation',root:folder+'/payload/animation',mode:'campaign',urls:[campaignURL(9)]},
   {part:'storage',root:folder+'/payload/storage',mode:'storage-debug',urls:[spec.publicURL+'?debug=1']}];
 assert.ok(run&&job&&origin,'Authenticated archived run and fresh producer job required');assert.equal(validate,true,'Recovery only validates immutable original envelopes');
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
  const envelope=validatePublicCapture(read(envelopePath),options);assert.equal(validate,true);receipts.push(envelope);
 }
 exactSource('source',spec);return receipts;
}
