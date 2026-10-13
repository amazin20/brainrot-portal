import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflateSync} from 'node:zlib';
import test from 'node:test';
import {assertOriginalFailedProvider,assertArchivedProducerRun} from './lib/campaign-v55-readonly-provider.mjs';

// These are authentic saved provider controls. No synthetic green run is used.
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const clone=value=>JSON.parse(JSON.stringify(value));
const release=JSON.parse(fs.readFileSync(path.join(repository,'tools/campaign-v55-release.json'),'utf8'));
let original,archived,sourceProviderRun,verifierLog;
if(process.env.CAMPAIGN_V55_PROVIDER_CONTROLS){
 const controls=path.resolve(process.env.CAMPAIGN_V55_PROVIDER_CONTROLS),read=name=>JSON.parse(fs.readFileSync(path.join(controls,name),'utf8'));
 original={run:read('final-run-control.json'),jobs:read('final-jobs-control.json').jobs,
  artifacts:read('final-artifacts-control.json').artifacts,gitCommit:read('publisher-git-commit.json'),
  log:Buffer.from(read('log-115271204608-provider.json').content,'utf8')};
 archived=read('11807157833/provider-before.json').run;sourceProviderRun=read('11807211981/provider/source-run.json');
 verifierLog={bytes:436092,sha256:'65bc0e1d0bba4c63c41311acf50234075708f7f4f37aff6a7c457272c20b2298'};
}else{
 const config=JSON.parse(fs.readFileSync(path.join(repository,'tools/campaign-v55-readonly.json'),'utf8')),provider=config.originalProvider;
 original={run:provider.run,jobs:provider.jobs,artifacts:provider.artifacts,gitCommit:provider.gitCommit,
  log:inflateSync(Buffer.from(config.originalVerifierLogDeflateBase64,'base64'),{maxOutputLength:436092})};
 verifierLog=provider.verifierLog;archived=config.archivedEntryProducerRun;sourceProviderRun=config.sourceProviderRun;
}
const pins={sourceCommit:release.sourceCommit,sourceTree:release.sourceTree,sourceParent:release.sourceParent,sourceReview:release.sourceReview,
 originalProvider:{run:clone(original.run),jobs:clone(original.jobs),artifacts:clone(original.artifacts),gitCommit:clone(original.gitCommit),
 verifierLog:clone(verifierLog)}};
function mutated(change,{alsoPins=false}={}){
 const actual={...clone({...original,log:undefined}),log:Buffer.from(original.log)},expected=clone(pins);change(actual,expected);
 if(alsoPins)for(const key of ['run','jobs','artifacts','gitCommit'])expected.originalProvider[key]=clone(actual[key]);
 return [actual,expected];
}
function rejects(name,change,options){test(name,()=>{const [actual,expected]=mutated(change,options);assert.throws(()=>assertOriginalFailedProvider(actual,expected));});}

test('authentic complete original provider preserves CI failure and descriptor-only Pages',()=>{
 const before=JSON.stringify({original,pins}),receipt=assertOriginalFailedProvider(original,pins);
 assert.equal(receipt.pass,true);assert.equal(receipt.publicationAccepted,false);assert.equal(receipt.originalCIConclusion,'failure');assert.equal(receipt.successfulProducerJobs,10);assert.deepEqual(receipt.failedSteps,[9,10]);
 assert.equal(receipt.artifacts.length,11);assert.deepEqual(receipt.artifacts.filter(row=>row.descriptorOnly).map(row=>row.artifactName),['github-pages']);assert.equal(receipt.verifierLog.differenceLines.length,4);assert.equal(JSON.stringify({original,pins}),before);
});
test('actual capture-time archived provider is compared without rewriting either run',()=>{
 const before=JSON.stringify({archived,actual:original.run}),receipt=assertArchivedProducerRun(archived,original.run);
 assert.equal(receipt.actualConclusion,'failure');assert.equal(receipt.archivedConclusion,null);assert.equal(receipt.publicationAccepted,false);assert.equal(JSON.stringify({archived,actual:original.run}),before);
});
rejects('reject a relabelled successful original run',(a)=>{a.run.conclusion='success';},{alsoPins:true});
rejects('reject a different run attempt',(a)=>{a.run.run_attempt=2;},{alsoPins:true});
rejects('reject another workflow',(a)=>{a.run.path='.github/workflows/audit-campaign-v55.yml';},{alsoPins:true});
rejects('reject a different repository',(a)=>{a.run.repository.id+=1;},{alsoPins:true});
rejects('reject a substituted SOURCE API run',(a)=>{a.run=clone(sourceProviderRun);},{alsoPins:true});
rejects('reject changed Source4 identity even with exact original API controls',(_a,p)=>{p.sourceCommit=original.run.head_sha;});
rejects('reject changed Source4 review run',(_a,p)=>{p.sourceReview.runId=original.run.id;});
rejects('reject changed published git tree',(a)=>{a.gitCommit.tree.sha='1'.repeat(40);},{alsoPins:true});
rejects('reject changed original direct parent',(a)=>{a.gitCommit.parents[0].sha='2'.repeat(40);},{alsoPins:true});
rejects('reject an additional failed producer',(a)=>{a.jobs.find(j=>j.name==='presentation').conclusion='failure';},{alsoPins:true});
rejects('reject a skipped successful capture step',(a)=>{a.jobs.find(j=>j.name==='entry').steps.find(s=>s.name==='Run actions/upload-artifact@v4').conclusion='skipped';},{alsoPins:true});
rejects('reject another earlier verifier failure',(a)=>{a.jobs.find(j=>j.name==='verify').steps.find(s=>s.number===8).conclusion='failure';},{alsoPins:true});
rejects('reject hidden success for the aggregate failure',(a)=>{a.jobs.find(j=>j.name==='verify').steps.find(s=>s.number===9).conclusion='success';},{alsoPins:true});
rejects('reject changed verifier cleanup state',(a)=>{a.jobs.find(j=>j.name==='verify').steps.find(s=>s.number===18).conclusion='success';},{alsoPins:true});
rejects('reject a substituted verifier job',(a)=>{a.jobs.find(j=>j.name==='verify').id+=1;},{alsoPins:true});
rejects('reject a missing native producer',(a)=>{a.jobs.splice(a.jobs.findIndex(j=>j.name.includes('optics')),1);},{alsoPins:true});
rejects('reject duplicated provider job',(a)=>{a.jobs[0]=clone(a.jobs[1]);},{alsoPins:true});
rejects('reject an extra verifier step',(a)=>{a.jobs.find(j=>j.name==='verify').steps.push({number:22,name:'hidden failure',status:'completed',conclusion:'failure',started_at:'2026-10-13T11:26:42Z',completed_at:'2026-10-13T11:26:42Z'});},{alsoPins:true});
rejects('reject a missing original artifact',(a)=>{a.artifacts.pop();},{alsoPins:true});
rejects('reject a duplicated original artifact',(a)=>{a.artifacts[0]=clone(a.artifacts[1]);},{alsoPins:true});
rejects('reject an invented final verification artifact',(a)=>{a.artifacts.push({...clone(a.artifacts[0]),name:'campaign-v55-public-verification-38387082981-1'});},{alsoPins:true});
rejects('reject an expired artifact',(a)=>{a.artifacts[0].expired=true;},{alsoPins:true});
rejects('reject changed complete ZIP size',(a)=>{a.artifacts[0].size_in_bytes+=1;},{alsoPins:true});
rejects('reject changed ZIP digest even if re-pinned',(a)=>{a.artifacts[0].digest='sha256:'+'0'.repeat(64);},{alsoPins:true});
rejects('reject a substituted artifact producer run',(a)=>{a.artifacts[0].workflow_run.id=release.sourceReview.runId;},{alsoPins:true});
rejects('reject an artifact outside its real upload interval',(a)=>{a.artifacts[0].created_at='2026-10-13T10:00:00Z';},{alsoPins:true});
rejects('reject a truncated complete provider log',(a)=>{a.log=a.log.subarray(0,a.log.length-1);});
rejects('reject marker-only fabricated log',(a)=>{a.log=Buffer.from("AssertionError [ERR_ASSERTION]: PUBLIC capture envelope differs from fresh actual bytes/origin\nNo files were found with the provided path: proof/public-verification. No artifacts will be uploaded.\n");});
rejects('reject a changed filename difference',(a)=>{a.log=Buffer.from(a.log.toString('utf8').replace("filename: 'proof/public-presentation/payload/animation/free-jump.mp4'","filename: 'proof/public-presentation/payload/animation/substitute.mp4'"));});
rejects('reject another missing-bundle error path',(a)=>{a.log=Buffer.from(a.log.toString('utf8').replace('provided path: proof/public-verification','provided path: proof/other-packet'));});
rejects('reject a re-pinned substitute log descriptor',(_a,p)=>{p.originalProvider.verifierLog.sha256='0'.repeat(64);});
test('reject archived green status rather than preserve the real capture-time state',()=>{const value=clone(archived);value.status='completed';value.conclusion='success';assert.throws(()=>assertArchivedProducerRun(value,original.run));});
test('reject archived changed immutable metadata',()=>{const value=clone(archived);value.workflow_id+=1;assert.throws(()=>assertArchivedProducerRun(value,original.run));});
test('reject archived changed source/producer run',()=>{const value=clone(archived);value.id=release.sourceReview.runId;assert.throws(()=>assertArchivedProducerRun(value,original.run));});
test('reject backwards actual lifecycle timestamp',()=>{const value=clone(archived);value.updated_at='2026-10-13T12:00:00Z';assert.throws(()=>assertArchivedProducerRun(value,original.run));});
test('reject a status rewrite on the actual original API run',()=>{const value=clone(original.run);value.conclusion='success';assert.throws(()=>assertArchivedProducerRun(archived,value));});
