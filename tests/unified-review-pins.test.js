import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {main,prepareReviewPins,REPOSITORY} from '../scripts/prepare-unified-review-pins.mjs';
import {PUBLICATION_TARGET as TARGET} from '../scripts/lib/unified-publication-config.mjs';

const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const target=structuredClone(TARGET),pending={sourceCommit:target.sourceCommit,runId:7000001,runAttempt:1,workflowPath:'.github/workflows/unified-campaign-review.yml'};
 const workflow=fs.readFileSync(new URL('../.github/workflows/publish-unified-campaign.yml',import.meta.url),'utf8').replace(/^  REVIEW_RUN: .*$/m,"  REVIEW_RUN: '7000001'");
 const sourceWorkflow=Buffer.from('fixture verified-build bytes'),reviewWorkflow=Buffer.from('fixture caller bytes');
 target.sourceWorkflowSha256=hash(sourceWorkflow);target.reviewWorkflowSha256=hash(reviewWorkflow);
 const run={id:pending.runId,head_sha:target.sourceCommit,path:pending.workflowPath,run_attempt:1,status:'completed',conclusion:'success',
  repository:{full_name:REPOSITORY},head_commit:{tree_id:target.sourceTree},updated_at:'2026-10-08T10:00:00Z',
  referenced_workflows:[{path:REPOSITORY+'/.github/workflows/verified-build.yml@'+target.sourceCommit,sha:target.sourceCommit}]};
 const jobs=target.expectedJobNames.map((name,index)=>({id:index+1,name,run_id:run.id,head_sha:run.head_sha,run_attempt:1,status:'completed',conclusion:'success',completed_at:run.updated_at}));
 const inputs=[...target.inputArtifactsCore,...target.recordings.map(record=>({directory:record.directory,name:record.artifactName}))];
 const archives=new Map(inputs.map(input=>[input.directory,Buffer.from('immutable ZIP fixture '+input.name)]));
 const artifacts=inputs.map((input,index)=>({id:100+index,name:input.name,size_in_bytes:archives.get(input.directory).length,
  digest:'sha256:'+hash(archives.get(input.directory)),expired:false,workflow_run:{id:run.id,head_sha:run.head_sha}}));
 // Unrelated diagnostic artifacts are listed but cannot replace a required input.
 artifacts.push({id:999,name:'browser-failure-diagnostics',workflow_run:{id:run.id,head_sha:run.head_sha}});
 const content=(bytes,file)=>({encoding:'base64',path:'.github/workflows/'+file,content:bytes.toString('base64')});
 const responses=new Map([
  ['run.json',run],['run-final.json',structuredClone(run)],['commit.json',{sha:target.sourceCommit,tree:{sha:target.sourceTree}}],
  ['source-workflow.json',content(sourceWorkflow,'verified-build.yml')],['review-workflow.json',content(reviewWorkflow,'unified-campaign-review.yml')],
  ['jobs-page-1.json',{total_count:jobs.length,jobs}],['artifacts-page-1.json',{total_count:artifacts.length,artifacts}],
  ...artifacts.filter(row=>row.id!==999).map(row=>['artifact-'+row.id+'.json',structuredClone(row)])]);
 const logs=new Map(jobs.map(job=>[job.id,Buffer.from('2026-10-08T09:00:00Z git log -1 --format=%H\n2026-10-08T09:00:01Z '+target.sourceCommit+'\n') ]));
 const requested=[],saved=[];
 return {target,pending,workflow,responses,archives,logs,requested,saved,jobs,artifacts,run,
  api:async(endpoint,name)=>{requested.push({endpoint,name});assert.ok(responses.has(name),'Unexpected API request '+name);return structuredClone(responses.get(name));},
  archive:async pin=>archives.get(pin.directory),log:async job=>logs.get(job.id),save:async(name,data)=>saved.push({name,data})};
}

function filteredFixture(){
 const f=fixture();f.artifactMetadataMode='filtered-run';
 const inputs=[...f.target.inputArtifactsCore,...f.target.recordings.map(record=>({directory:record.directory,name:record.artifactName}))];
 for(const input of inputs){
  const artifact=structuredClone(f.artifacts.find(row=>row.name===input.name));
  const providerResponse={total_count:1,artifacts:[artifact]};
  f.responses.delete('artifact-'+artifact.id+'.json');
  f.responses.set('artifact-name-'+input.directory+'.json',{
   adapterProvenance:{method:'github_fetch',repo_full_name:REPOSITORY,run_id:f.pending.runId,name:input.name,
    request_url:'https://api.github.com/repos/'+REPOSITORY+'/actions/runs/'+f.pending.runId+'/artifacts?name='+encodeURIComponent(input.name)+'&per_page=100&page=1',
    projection:'unmodified-json-content'},originalProviderResponse:JSON.stringify(providerResponse),providerResponse});
 }
 return f;
}

test('exact target completed attempt pins all 51 jobs and 11 checked archives without accepting unrelated diagnostics',async()=>{
 const f=fixture(),pins=await prepareReviewPins(f);
 assert.equal(pins.sourceCommit,TARGET.sourceCommit);assert.equal(pins.jobs.length,51);assert.equal(pins.artifacts.length,11);
 assert.equal(pins.metrics.currentRecordingInputs,7);assert.equal(pins.provenance.jobLogHashes.length,51);
 assert.equal(pins.artifacts.find(row=>row.directory==='recording-47-manual-impact').name,'campaign-current-recording-47-manual-impact');
 assert.ok(f.requested.some(row=>row.endpoint.includes('/attempts/1/jobs?per_page=100&page=1')));
 assert.ok(f.saved.some(row=>row.name==='run-final.json'));assert.equal(pins.conclusion,'success');
});

const mutations={
 'pending run':f=>{f.run.status='in_progress';f.run.conclusion=null;},
 'failed run':f=>{f.run.conclusion='failure';},
 'rerun':f=>{f.run.run_attempt=2;},
 'rejected K source':f=>{f.run.head_sha='ae819c7a5c700a0eaf39d3e9f5f0ae93d372f696';},
 'wrong tree':f=>{f.responses.get('commit.json').tree.sha='f'.repeat(40);},
 'wrong source workflow bytes':f=>{f.responses.get('source-workflow.json').content=Buffer.from('altered workflow').toString('base64');},
 'missing room47 movie':f=>{f.artifacts.splice(f.artifacts.findIndex(row=>row.name==='campaign-current-recording-47-manual-impact'),1);f.responses.get('artifacts-page-1.json').total_count--;},
 'missing job':f=>{f.jobs.pop();f.responses.get('jobs-page-1.json').total_count--;},
 'skipped job':f=>{f.jobs[0].conclusion='skipped';},
 'foreign job name':f=>{f.jobs[0].name='Successful unrelated work';},
 'duplicate job ID':f=>{f.jobs[1].id=f.jobs[0].id;},
 'foreign artifact run':f=>{f.responses.get('artifact-100.json').workflow_run.id=37725409355;},
 'expired artifact':f=>{f.artifacts[0].expired=true;f.responses.get('artifact-100.json').expired=true;},
 'swapped same-size artifact ZIP':f=>{const bytes=f.archives.get('browser');f.archives.set('browser',Buffer.alloc(bytes.length,120));},
 'wrong artifact detail digest':f=>{f.responses.get('artifact-100.json').digest='sha256:'+'f'.repeat(64);},
 'old I checkout log':f=>{f.logs.set(1,Buffer.from('git log -1 --format=%H\n8f2132cabdee6225bc9ebe34356a3bb1cf643dfe\n'));},
 'changed final run attempt':f=>{f.responses.get('run-final.json').run_attempt=2;},
 'stale publication source env':f=>{f.workflow=f.workflow.replace('SOURCE_SHA: '+TARGET.sourceCommit,'SOURCE_SHA: '+'f'.repeat(40));}
};
for(const [name,mutate] of Object.entries(mutations))test('pin preparation rejects '+name,async()=>{
 const f=fixture();mutate(f);await assert.rejects(prepareReviewPins(f));
});

test('explicit named-response mode binds eleven independent raw responses to full list and outer ZIP bytes',async()=>{
 const f=filteredFixture(),pins=await prepareReviewPins(f);
 assert.equal(pins.artifacts.length,11);assert.equal(pins.provenance.artifactMetadataMode,'filtered-run');
 assert.equal(pins.provenance.artifactMetadataReads.length,11);
 assert.ok(pins.provenance.artifactMetadataReads.every(row=>row.method==='github_fetch'&&/^[a-f0-9]{64}$/.test(row.originalResponseSha256)));
 assert.equal(f.requested.filter(row=>row.name.startsWith('artifact-name-')).length,11);
 assert.ok(!f.requested.some(row=>/\/actions\/artifacts\/\d+$/.test(row.endpoint)));
 assert.ok(f.saved.some(row=>row.name==='artifact-name-recording-47-manual-impact.json'));
});

const filteredMutations={
 'missing server total_count':e=>{delete e.providerResponse.total_count;},
 'nonunique server total_count':e=>{e.providerResponse.total_count=2;},
 'duplicate named rows':e=>{e.providerResponse.artifacts.push(structuredClone(e.providerResponse.artifacts[0]));},
 'object projected as artifact array':e=>{e.providerResponse.artifacts={0:e.providerResponse.artifacts[0],length:1};},
 'wrong named ID':e=>{e.providerResponse.artifacts[0].id++;},
 'wrong named artifact':e=>{e.providerResponse.artifacts[0].name='campaign-current-recording-47-manual-impact';},
 'wrong named source':e=>{e.providerResponse.artifacts[0].workflow_run.head_sha='8f2132cabdee6225bc9ebe34356a3bb1cf643dfe';},
 'wrong named run':e=>{e.providerResponse.artifacts[0].workflow_run.id=37725409355;},
 'wrong named digest':e=>{e.providerResponse.artifacts[0].digest='sha256:'+'f'.repeat(64);},
 'wrong named size':e=>{e.providerResponse.artifacts[0].size_in_bytes++;},
 'expired named artifact':e=>{e.providerResponse.artifacts[0].expired=true;},
 'wrong request method':e=>{e.adapterProvenance.method='copied-from-full-list';},
 'wrong request repository':e=>{e.adapterProvenance.repo_full_name='foreign/repo';},
 'wrong request run':e=>{e.adapterProvenance.run_id=37725409355;},
 'wrong request name':e=>{e.adapterProvenance.name='campaign-current-recording-47-manual-impact';},
 'unfiltered request URL':e=>{e.adapterProvenance.request_url=e.adapterProvenance.request_url.split('?')[0]+'?per_page=100&page=1';},
 'invented projection':e=>{e.adapterProvenance.projection='synthetic-per-id';}
};
for(const [name,mutate] of Object.entries(filteredMutations))test('named-response preparation rejects '+name,async()=>{
 const f=filteredFixture(),envelope=f.responses.get('artifact-name-browser.json');mutate(envelope);
 envelope.originalProviderResponse=JSON.stringify(envelope.providerResponse);
 await assert.rejects(prepareReviewPins(f));
});

test('named-response projection must retain identical original provider JSON bytes',async()=>{
 const f=filteredFixture(),envelope=f.responses.get('artifact-name-browser.json');
 envelope.providerResponse.artifacts[0].digest='sha256:'+'f'.repeat(64);
 await assert.rejects(prepareReviewPins(f),/differs from original provider bytes/);
});

test('named-response metadata cannot accept swapped outer ZIP bytes',async()=>{
 const f=filteredFixture();f.archives.set('browser',Buffer.alloc(f.archives.get('browser').length,120));
 await assert.rejects(prepareReviewPins(f),/Wrong ZIP bytes/);
});

test('pagination checks all diagnostic artifact pages while selecting exactly the required archives',async()=>{
 const f=fixture(),required=f.artifacts.filter(row=>row.id!==999);
 const diagnostics=Array.from({length:90},(_,index)=>({id:2000+index,name:'diagnostic-'+index}));
 const all=[...required,...diagnostics];
 f.responses.set('artifacts-page-1.json',{total_count:all.length,artifacts:all.slice(0,100)});
 f.responses.set('artifacts-page-2.json',{total_count:all.length,artifacts:all.slice(100)});
 const pins=await prepareReviewPins(f);assert.equal(pins.artifacts.length,11);
 assert.ok(f.requested.some(row=>row.name==='artifacts-page-2.json'));
});

test('incomplete pagination cannot manufacture an accepted artifact inventory',async()=>{
 const f=fixture();f.responses.get('artifacts-page-1.json').total_count++;
 f.responses.set('artifacts-page-2.json',{total_count:f.artifacts.length+1,artifacts:[]});
 await assert.rejects(prepareReviewPins(f));
});

for(const mode of ['per-id','filtered-run'])test('offline '+mode+' CLI writes separate pins and preserves pending input bytes',async context=>{
 const f=mode==='filtered-run'?filteredFixture():fixture(),root=fs.mkdtempSync(path.join(os.tmpdir(),'unified-pins-cli-'));
 context.mock.method(console,'log',()=>{});
 try{
  const evidence=path.join(root,'evidence');fs.mkdirSync(path.join(evidence,'archives'),{recursive:true});
  for(const [name,data] of f.responses)fs.writeFileSync(path.join(evidence,name),JSON.stringify(data));
  for(const [directory,bytes] of f.archives)fs.writeFileSync(path.join(evidence,'archives',directory+'.zip'),bytes);
  for(const [id,bytes] of f.logs)fs.writeFileSync(path.join(evidence,'job-'+id+'.log'),bytes);
  const target=path.join(root,'target.json'),pending=path.join(root,'pending.json'),workflow=path.join(root,'workflow.yml'),output=path.join(root,'accepted.json');
  fs.writeFileSync(target,JSON.stringify(f.target));fs.writeFileSync(pending,JSON.stringify({...f.pending,conclusion:'pending'}));
  fs.writeFileSync(workflow,f.workflow);const original=fs.readFileSync(pending);
  await main(['--target',target,'--pending',pending,'--workflow',workflow,'--evidence-dir',evidence,'--proof-dir',path.join(root,'proof'),'--output',output,'--artifact-metadata-mode',mode]);
  const pins=JSON.parse(fs.readFileSync(output));assert.equal(pins.conclusion,'success');assert.equal(pins.jobs.length,51);assert.equal(pins.artifacts.length,11);
  assert.equal(pins.provenance.targetSha256,hash(fs.readFileSync(target)));assert.deepEqual(fs.readFileSync(pending),original);
  assert.ok(fs.existsSync(path.join(root,'proof','logs','job-51.log')));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('filtered connector mode cannot silently replace default online per-ID API reads',async()=>{
 await assert.rejects(main(['--artifact-metadata-mode','filtered-run']),/explicit evidence bundle/);
});

test('CLI refuses acceptance input overwrite before touching API or evidence',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'unified-pins-overwrite-'));
 try{
  const pending=path.join(root,'pending.json');fs.writeFileSync(pending,'unaltered pending bytes');
  await assert.rejects(main(['--pending',pending,'--output',pending]));assert.equal(fs.readFileSync(pending,'utf8'),'unaltered pending bytes');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
