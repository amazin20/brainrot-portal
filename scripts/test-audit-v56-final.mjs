import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {PINS,assertArtifact,assertTerminal,assertArchived,assertHTTP} from './audit-v56-final.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const clone=value=>structuredClone(value);
function synthetic(){
 const run={id:PINS.publicationRun,head_sha:PINS.publisherCommit,head_branch:'main',event:'push',run_attempt:1,
  path:'.github/workflows/publish-campaign-v56.yml',status:'completed',conclusion:'failure',
  repository:{full_name:PINS.repository},html_url:'https://github.com/'+PINS.repository+'/actions/runs/'+PINS.publicationRun};
 const jobs=clone(PINS.originalJobs);
 return {run,jobs};
}
function fixture(){
 const directory=process.env.V56_AUDIT_PROVIDER_FIXTURE;
 const f=directory?{run:JSON.parse(fs.readFileSync(path.join(directory,'run.json'))),jobs:JSON.parse(fs.readFileSync(path.join(directory,'jobs.json')))}:synthetic();
 if(!Array.isArray(f.jobs))f.jobs=f.jobs.jobs;
 if(directory){f.log=fs.readFileSync(process.env.V56_AUDIT_VERIFIER_LOG||path.join(root,'fixtures/original-verify.log'));f.pins=PINS;}
 else{
  // Unit-only transport bytes; these pins are never used by the audit producer.
  f.log=Buffer.from('TypeError: fetch failed\nUND_ERR_SOCKET\nat async Object.guard\nat async aggregate\n"checked": 2119\n');
  f.pins={...PINS,originalVerifierLog:{bytes:f.log.length,sha256:createHash('sha256').update(f.log).digest('hex')}};
 }return f;
}
function archived(){
 const f=fixture();f.run.status='in_progress';f.run.conclusion=null;
 const verifier=f.jobs.find(job=>job.name==='verify');verifier.status='in_progress';verifier.conclusion=null;return f;
}
function http(){return {pass:true,phase:'published',sourceCommit:PINS.sourceCommit,sourceAccepted:true,publicationAccepted:false,
 publicationRun:PINS.publicationRun,publicationRunAttempt:1,publisherCommit:PINS.publisherCommit,
 checked:PINS.siteFiles,bytes:PINS.siteBytes,siteFilesSha256:PINS.siteInventorySha256,
 checkedFilesSha256:PINS.siteInventorySha256,mainSiteUnchanged:true};}

test('exact original failed verifier remains failure while all ten producers succeeded',()=>{
 const f=fixture(),r=assertTerminal(f.run,f.jobs,f.log,f.pins);
 assert.equal(r.originalCIConclusion,'failure');assert.equal(r.successfulProducerJobs,10);assert.equal(r.failedStep,9);assert.equal(r.failedVerifierJob,PINS.verifierJobId);
});
test('terminal run cannot be replaced by success, an active run, another attempt, SOURCE, branch or workflow',()=>{
 for(const [key,value]of [['id',PINS.publicationRun+1],['head_sha',PINS.sourceCommit],['head_branch',PINS.branch],['event','workflow_dispatch'],['run_attempt',2],['status','in_progress'],['conclusion','success'],['path',PINS.workflow]]){
  const f=fixture();f.run[key]=value;assert.throws(()=>assertTerminal(f.run,f.jobs,f.log,f.pins),key);
 }
});
test('terminal cohort rejects missing, duplicate, renamed and wrong-origin producers',()=>{
 for(const mutation of ['missing','duplicate-id','duplicate-name','renamed','run','head','attempt','status','failure']){
  const f=fixture();
  if(mutation==='missing')f.jobs.pop();
  if(mutation==='duplicate-id')f.jobs[1].id=f.jobs[0].id;
  if(mutation==='duplicate-name')f.jobs[1].name=f.jobs[0].name;
  if(mutation==='renamed')f.jobs[1].name='Unknown generic success';
  if(mutation==='run')f.jobs[0].run_id++;
  if(mutation==='head')f.jobs[0].head_sha=PINS.sourceCommit;
  if(mutation==='attempt')f.jobs[0].run_attempt=2;
  if(mutation==='status')f.jobs[0].status='in_progress';
  if(mutation==='failure')f.jobs[0].conclusion='failure';
  assert.throws(()=>assertTerminal(f.run,f.jobs,f.log,f.pins),mutation);
 }
});
test('each original verifier preparation step and the only failed step remain mandatory',()=>{
 for(let number=1;number<=9;number++)for(const mutation of ['removed','conclusion','name']){
  const f=fixture(),verifier=f.jobs.find(job=>job.name==='verify'),step=verifier.steps.find(step=>step.number===number);
  if(mutation==='removed')verifier.steps=verifier.steps.filter(step=>step.number!==number);
  if(mutation==='conclusion')step.conclusion=number===9?'success':'skipped';
  if(mutation==='name')step.name='Different step';
  assert.throws(()=>assertTerminal(f.run,f.jobs,f.log,f.pins),number+' '+mutation);
 }
});
test('failed verifier identity, successful evidence upload and exclusive failure are required',()=>{
 for(const mutation of ['id','upload-missing','upload-skipped','second-failure']){
  const f=fixture(),verifier=f.jobs.find(job=>job.name==='verify');
  if(mutation==='id')verifier.id++;
  if(mutation==='upload-missing')verifier.steps=verifier.steps.filter(step=>step.number!==10);
  if(mutation==='upload-skipped')verifier.steps.find(step=>step.number===10).conclusion='skipped';
  if(mutation==='second-failure')verifier.steps.find(step=>step.number===8).conclusion='failure';
  assert.throws(()=>assertTerminal(f.run,f.jobs,f.log,f.pins),mutation);
 }
});
test('complete provider failure log cannot be truncated, corrupted or replaced with matching error markers',()=>{
 for(const mutation of ['truncated','corrupt','markers']){
  const f=fixture();
  if(mutation==='truncated')f.log=f.log.subarray(1);
  if(mutation==='corrupt'){f.log=Buffer.from(f.log);f.log[0]^=1;}
  if(mutation==='markers')f.log=Buffer.from('TypeError: fetch failed UND_ERR_SOCKET at async Object.guard at async aggregate "checked": 2119');
  assert.throws(()=>assertTerminal(f.run,f.jobs,f.log,f.pins),mutation);
 }
});
test('historical in-progress snapshot is accepted separately and never relabelled terminal success',()=>{
 const f=archived();assertArchived(f.run,f.jobs);
 const fresh=fixture();assert.throws(()=>assertArchived(fresh.run,fresh.jobs));
 assert.equal(fresh.run.status,'completed');assert.equal(fresh.run.conclusion,'failure');
});
test('archived immutable publication run identity rejects source, audit, wrong attempt and completed verifier',()=>{
 for(const [key,value]of [['id',PINS.publicationRun+1],['head_sha',PINS.sourceCommit],['run_attempt',2],['status','completed'],['conclusion','success'],['head_branch',PINS.branch],['event','workflow_dispatch'],['path',PINS.workflow]]){
  const f=archived();f.run[key]=value;assert.throws(()=>assertArchived(f.run,f.jobs),key);
 }
 const f=archived();f.jobs.find(job=>job.name==='verify').status='completed';assert.throws(()=>assertArchived(f.run,f.jobs));
});
test('every pinned artifact uses exact provider identity, digest, size and original producer',()=>{
 for(const pin of PINS.artifacts){assertArtifact(clone(pin),pin);
  for(const [key,value]of [['id',pin.id+1],['name',pin.name+'-substitute'],['size_in_bytes',pin.size_in_bytes+1],['digest','sha256:'+'0'.repeat(64)],['expired',true]]){
   const wrong=clone(pin);wrong[key]=value;assert.throws(()=>assertArtifact(wrong,pin),key);
  }
  for(const key of ['id','head_sha','head_branch','repository_id','head_repository_id']){
   const wrong=clone(pin);wrong.workflow_run[key]=typeof wrong.workflow_run[key]==='number'?wrong.workflow_run[key]+1:'wrong';assert.throws(()=>assertArtifact(wrong,pin),key);
  }
 }
});
test('complete HTTP audit rejects any changed identity, accepted boundary or inventory field',()=>{
 assertHTTP(http());
 for(const [key,value]of [['pass',false],['phase','preparation'],['sourceCommit',PINS.publisherCommit],['sourceAccepted',false],['publicationAccepted',true],['publicationRun',PINS.publicationRun+1],['publicationRunAttempt',2],['publisherCommit',PINS.sourceCommit],['checked',PINS.siteFiles-1],['bytes',PINS.siteBytes-1],['siteFilesSha256','0'.repeat(64)],['checkedFilesSha256','0'.repeat(64)],['mainSiteUnchanged',false]]){
  const wrong=http();wrong[key]=value;assert.throws(()=>assertHTTP(wrong),key);
 }
});
test('audit workflow is an isolated read-only branch push with no publisher mutation or deployment',()=>{
 const text=fs.readFileSync(path.join(root,'.github/workflows/audit-v56-final-readonly.yml'),'utf8');
 assert.match(text,/on:\s*\n\s+push:\s*\n\s+branches:\s*\[audit\/v56-final-20261015\]/);
 assert.doesNotMatch(text,/workflow_run:|workflow_dispatch:|pull_request|schedule:/);
 const permissions=/^permissions:\s*\n([\s\S]*?)(?=^\S)/m.exec(text)?.[1];assert.ok(permissions);
 assert.deepEqual(permissions.trim().split(/\n/).map(line=>line.trim()).sort(),['actions: read','contents: read','deployments: read']);
 assert.doesNotMatch(text,/pages:\s*write|contents:\s*write|id-token:|actions:\s*write|deploy-pages|upload-pages-artifact|configure-pages|git\s+(?:push|tag)|gh\s+(?:run\s+rerun|workflow\s+run)|cancel-in-progress:\s*true/);
 assert.match(text,/group:\s*audit-v56-final-readonly/);assert.match(text,/cancel-in-progress:\s*false/);
 assert.equal((text.match(/persist-credentials:\s*false/g)||[]).length,3);
 assert.match(text,new RegExp('ref: '+PINS.publisherCommit));assert.match(text,new RegExp('ref: '+PINS.sourceCommit));
 assert.match(text,/node --test scripts\/test-audit-v56-final\.mjs/);assert.match(text,/node scripts\/audit-v56-final\.mjs/);
 assert.match(text,/actions\/upload-artifact@v4/);
});
