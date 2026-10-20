import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import {parsePublicEvidenceJSON,assertPublicInventory,assertAppendOnlyInventory,assertPublicNetwork,assertPublicProviderBindings,assertSourceProviderIdentity,runReadOnlyPublisherValidators,publicDeploymentLease,assertRecoveryBindings,auditDeploymentSnapshot,auditPublicProof} from './audit-public-proof.mjs';

// Synthetic protocol fixtures test audit mechanics, never provider evidence.
const hash=value=>createHash('sha256').update(value).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
const row=(name,content=name)=>({path:name,bytes:Buffer.byteLength(content),sha256:hash(content)});
const base='https://amazin20.github.io/brainrot-portal/campaign-v63/';

test('strict JSON preserves ordinary data and rejects ambiguous or unbounded identities',()=>{
 const text='{"sourceAccepted":false,"name":"комната","rows":[null,true,1.25e2],"escaped\\u0020key":"line\\nvalue"}';
 assert.deepEqual(parsePublicEvidenceJSON(text),JSON.parse(text));
 for(const bad of ['{"commit":"a","commit":"b"}','{"x":[{"pass":true,"p\\u0061ss":false}]}','{"x":1e999}','{"x":NaN}','{"x":01}','[1,]','{}{}','{"x":"unterminated}','['.repeat(102)+'0'+']'.repeat(102)])assert.throws(()=>parsePublicEvidenceJSON(bad));
});

test('inventory rejects duplicates, traversal, collisions, invalid numeric sizes and hashes',()=>{
 const valid=[row('a'),row('b')];assert.equal(assertPublicInventory(valid),valid);
 for(const bad of [valid.slice().reverse(),[valid[0],valid[0]],[row('../a')],[row('C:/a')],[row('a\\b')],[row('a\u0000b')],[row('a'),row('a/b')],[{...row('a'),bytes:true}],[{...row('a'),bytes:-1}],[{...row('a'),sha256:'x'}],[{...row('a'),extra:1}]])assert.throws(()=>assertPublicInventory(bad));
 assert.throws(()=>assertPublicInventory(valid,1));
});

test('append-only union preserves every baseline and candidate byte and one provenance file',()=>{
 const baseline=[row('index.html','old'),row('old/a.mp4','historical media')],candidate=[row('build-info.json','original stamp'),row('index.html','new')],provenance=row('campaign-v63/publication-provenance.json','provenance');
 const union=[...baseline,...candidate.map(item=>({...item,path:'campaign-v63/'+item.path})),provenance].sort((a,b)=>a.path<b.path?-1:1);
 const args={baseline,candidate,union,provenance},before=clone(args),result=assertAppendOnlyInventory(args);
 assert.equal(result.files,5);assert.equal(result.bytes,union.reduce((n,r)=>n+r.bytes,0));assert.equal(result.inventorySha256,hash(JSON.stringify(union)));assert.deepEqual(args,before);
 for(const mutate of [x=>x.union.shift(),x=>x.union.push(row('unexpected')),x=>x.union.find(r=>r.path==='index.html').sha256=hash('rewritten'),x=>x.union.find(r=>r.path==='campaign-v63/build-info.json').bytes++,x=>x.provenance.path='campaign-v63/other.json',x=>x.baseline.push(row('campaign-v63/old'))]){const bad=clone(args);mutate(bad);assert.throws(()=>assertAppendOnlyInventory(bad));}
});

function networkFixture(){
 const rows=[row('assets/main.js'),row('build-info.json'),row('index.html')],stamp=rows[1].sha256;
 const network=[1,2].flatMap(page=>[rows[0],rows[2]].map(item=>({page,url:base+item.path,status:200,fromCache:false,bytes:item.bytes,sha256:item.sha256})));
 const stamps=[1,2].map(page=>({page,url:base+'build-info.json',status:200,sha256:stamp}));return{network,stamps,rows,stamp,pages:2};
}
test('network binds every page and build stamp to canonical original uncached package bytes',()=>{
 const args=networkFixture(),before=clone(args);assert.deepEqual(assertPublicNetwork(args),{pages:2,responses:4,stampReads:2});assert.deepEqual(args,before);
 const reload=clone(args);reload.entry=true;reload.stamps.push({...reload.stamps[0]});assert.equal(assertPublicNetwork(reload).stampReads,3);
 for(const mutate of [x=>x.network[0].url='https://example.test/main.js',x=>x.network[0].url+='?v=unknown',x=>x.network[0].fromCache=true,x=>x.network[0].status=304,x=>x.network[0].bytes++,x=>x.network[0].sha256=hash('wrong'),x=>x.network[0].page=0,x=>x.stamps[0].sha256=hash('rewritten stamp'),x=>x.stamps.pop(),x=>x.stamps.push({...x.stamps[0]}),x=>x.network=x.network.filter(r=>r.page===1)]){const bad=clone(args);mutate(bad);assert.throws(()=>assertPublicNetwork(bad));}
 const missing=clone(reload);missing.stamps=missing.stamps.filter(r=>r.page===1);assert.throws(()=>assertPublicNetwork(missing));
});

function deploymentFixture(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'public-snapshot-test-'));
 const producer={GITHUB_REPOSITORY:'amazin20/brainrot-portal',GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'991',GITHUB_RUN_ATTEMPT:'1'},sourceCommit='b'.repeat(40),sourceTree='c'.repeat(40),sourceReview={runId:990,runAttempt:1};
 const deployment={id:7190324412,sha:producer.GITHUB_SHA,environment:'github-pages'},statuses=[{id:11,state:'success',log_url:'https://github.com/amazin20/brainrot-portal/actions/runs/991/jobs/123'}];
 const bodies={deployments:[deployment,{id:7190324410,sha:'d'.repeat(40),environment:'github-pages'}],statuses};
 const manifest={schemaVersion:1,kind:'actual-v63-ci-deployment-api-snapshot',publicationAccepted:false,producer,sourceCommit,sourceTree,sourceReview,captureStartedAt:'2026-10-20T00:00:00.000Z',captureCompletedAt:'2026-10-20T00:00:01.000Z',deploymentId:deployment.id,resources:{},scope:'Original complete paginated GitHub API response bytes observed in the final CI job; no independent post-CI deployment GET is claimed.'};
 const options={producer,sourceCommit,sourceTree,sourceReview,commit:producer.GITHUB_SHA,runId:991,expected:{deployment,statuses}};
 function save(){
  for(const stem of ['deployments','statuses']){
   const endpoint=stem==='deployments'?'deployments?environment=github-pages':'deployments/'+manifest.deploymentId+'/statuses',name=stem+'-page-001.json',url='https://api.github.com/repos/amazin20/brainrot-portal/'+endpoint+(endpoint.includes('?')?'&':'?')+'per_page=100&page=1',raw=Buffer.from(JSON.stringify(bodies[stem])+'\n');
   fs.writeFileSync(path.join(directory,name),raw);manifest.resources[stem]={endpoint,items:bodies[stem].length,pages:[{path:name,page:1,requestURL:url,responseURL:url,status:200,requestedAt:'2026-10-20T00:00:00.100Z',completedAt:'2026-10-20T00:00:00.200Z',bytes:raw.length,sha256:hash(raw),items:bodies[stem].length}]};
  }
  fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest)+'\n');
 }
 save();return{directory,manifest,bodies,options,save,close:()=>fs.rmSync(directory,{recursive:true,force:true})};
}
test('canonical deployment snapshot binds complete original pages and retains its CI-only scope',()=>{
 const fixture=deploymentFixture();try{const before=clone(fixture.manifest),result=auditDeploymentSnapshot(fixture.directory,fixture.options);assert.equal(result.deploymentId,7190324412);assert.equal(result.independentPostCIDeploymentGet,false);assert.equal(result.workflowRetainedOriginalAPIBytes,true);assert.equal(result.rawFiles.length,3);assert.deepEqual(fixture.manifest,before);}finally{fixture.close();}
});

test('recovery deployment lease is separate from the unchanged historical baseline and requires a newer final deployment',()=>{
 assert.deepEqual(publicDeploymentLease({}),{id:7190324410,sha:'c5814892d6a40ffc911e0ed62df022f82990cb4a'});
 const config={controllerParent:'7feee7351bc2be2cdee708cae0e7a305bca6567c',recovery:{kind:'byte-identical-republish-after-public-observer-failure',publicationAccepted:false,deployment:{id:7198668659,sha:'7feee7351bc2be2cdee708cae0e7a305bca6567c'}}},before=clone(config);
 assert.deepEqual(publicDeploymentLease(config),config.recovery.deployment);assert.deepEqual(config,before);
 for(const bad of [{recovery:null},{recovery:{}},{...clone(config),controllerParent:'d19c595c7f177995ec93837ddbfc9806fa1a40fe'},{...clone(config),recovery:{...config.recovery,deployment:{id:7198668660,sha:config.controllerParent}}},{recovery:{deployment:{id:7190324410,sha:'a'.repeat(40)}}},{recovery:{deployment:{id:7198668659,sha:'not-a-commit'}}},{recovery:{deployment:{...config.recovery.deployment,extra:true}}}])assert.throws(()=>publicDeploymentLease(bad));
 const fixture=deploymentFixture();try{
  fixture.options.previousDeploymentId=config.recovery.deployment.id;
  assert.throws(()=>auditDeploymentSnapshot(fixture.directory,fixture.options),'The original baseline successor cannot satisfy a later recovery lease');
  fixture.manifest.deploymentId=config.recovery.deployment.id+1;fixture.bodies.deployments[0].id=fixture.manifest.deploymentId;fixture.save();
  assert.equal(auditDeploymentSnapshot(fixture.directory,fixture.options).deploymentId,7198668660);
 }finally{fixture.close();}
});

test('recovery preserves original provenance while requiring distinct fresh producer and complete union HTTP proofs',()=>{
 const kind='byte-identical-republish-after-public-observer-failure',oldCommit='7feee7351bc2be2cdee708cae0e7a305bca6567c';
 const config={controllerParent:oldCommit,recovery:{kind,publicationAccepted:false,publisherCommit:oldCommit,runId:39416100725,runAttempt:1,deployment:{id:7198668659,sha:oldCommit}}};
 const originalProducer={GITHUB_REPOSITORY:'amazin20/brainrot-portal',GITHUB_SHA:oldCommit,GITHUB_RUN_ID:'39416100725',GITHUB_RUN_ATTEMPT:'1'},currentProducer={...originalProducer,GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'39420000000'};
 const unionFiles=[row('campaign-v63/index.html','unchanged consumer'),row('campaign-v63/publication-provenance.json','unchanged original producer'),row('index.html','old root')],provenance=unionFiles[1],union={files:unionFiles.length,bytes:unionFiles.reduce((n,r)=>n+r.bytes,0),inventorySha256:hash(JSON.stringify(unionFiles))};
 const verified={kind,publicationAccepted:false,originalProducer,previousDeployment:config.recovery.deployment,originalProvenance:provenance,originalProvider:{parsedObjectsNotRawResponseBytes:true},union,unionFiles};
 const state={recovery:verified,unionFiles,recoveryHTTP:{...union,method:'complete HTTP GET, exact length and SHA-256 for every file'}},before={recoveryHTTP:clone(state.recoveryHTTP)},final={recovery:clone(verified),recoveryHTTP:clone(state.recoveryHTTP)};
 const args={config,state,before,final,verified,provenance,currentProducer},snapshot=clone(args),result=assertRecoveryBindings(args);
 assert.equal(result.originalAttemptEligible,false);assert.equal(result.originalPublicAcceptance,false);assert.equal(result.identicalUnionConfirmed,true);assert.deepEqual(result.originalProducer,originalProducer);assert.deepEqual(args,snapshot);
 for(const mutate of [x=>x.currentProducer.GITHUB_SHA=oldCommit,x=>x.currentProducer.GITHUB_RUN_ID='39416100725',x=>x.config.recovery.kind='ordinary-retry',x=>x.config.recovery.publicationAccepted=true,x=>x.verified.publicationAccepted=true,x=>x.verified.originalProducer.GITHUB_RUN_ID='other',x=>x.verified.originalProvenance.sha256=hash('rewritten producer'),x=>x.verified.originalProvider.parsedObjectsNotRawResponseBytes=false,x=>x.before.recoveryHTTP.files--,x=>x.state.recoveryHTTP.inventorySha256=hash('different union'),x=>x.final.recoveryHTTP.method='metadata only',x=>x.final.recovery.originalAttemptEligible=true,x=>x.verified.previousDeployment.id=7190324410,x=>x.verified.unionFiles.pop()]){const bad=clone(args);mutate(bad);assert.throws(()=>assertRecoveryBindings(bad));}
 assert.equal(assertRecoveryBindings({config:{},state:{},before:{},final:{},verified:null,provenance,currentProducer}),null);
 for(const value of [{state:{recovery:verified}},{before:{recoveryHTTP:state.recoveryHTTP}},{final:{recovery:verified}},{verified}])assert.throws(()=>assertRecoveryBindings({config:{},state:{},before:{},final:{},verified:null,provenance,currentProducer,...value}));
});

test('deployment rejects stale identity, wrong owner, duplicate resources, incomplete pagination and changed bytes',()=>{
 const mutations=[
  f=>{f.manifest.publicationAccepted=true;},
  f=>{f.manifest.scope='Independent live deployment accepted';},
  f=>{f.manifest.captureStartedAt='2026-10-20T00:00:00.000';},
  f=>{f.manifest.sourceCommit='e'.repeat(40);},
  f=>{f.manifest.deploymentId=7190324410;},
  f=>{f.bodies.deployments[0].sha='e'.repeat(40);},
  f=>{f.bodies.deployments[0].environment='other';},
  f=>{f.bodies.statuses[0].state='pending';},
  f=>{f.bodies.statuses[0].log_url='https://github.com/amazin20/brainrot-portal/actions/runs/992';},
  f=>{f.bodies.deployments.push({...f.bodies.deployments[0]});},
  f=>{f.bodies.statuses.push({...f.bodies.statuses[0]});},
  f=>{f.bodies.statuses.push({...f.bodies.statuses[0],id:12});},
  f=>{f.bodies.deployments=Array.from({length:100},(_,i)=>({...f.bodies.deployments[0],id:7190324412+i}));},
 ];
 for(const mutate of mutations){const fixture=deploymentFixture();try{mutate(fixture);fixture.save();assert.throws(()=>auditDeploymentSnapshot(fixture.directory,fixture.options));}finally{fixture.close();}}
 const changes=[f=>fs.appendFileSync(path.join(f.directory,'statuses-page-001.json'),' '),f=>fs.writeFileSync(path.join(f.directory,'extra.json'),'[]'),f=>fs.symlinkSync('statuses-page-001.json',path.join(f.directory,'linked.json')),f=>{f.manifest.resources.statuses.pages[0].path='../outside';fs.writeFileSync(path.join(f.directory,'manifest.json'),JSON.stringify(f.manifest));}];
 for(const mutate of changes){const fixture=deploymentFixture();try{mutate(fixture);assert.throws(()=>auditDeploymentSnapshot(fixture.directory,fixture.options));}finally{fixture.close();}}
});

test('an unfrozen proposed publisher cannot produce a passing audit or change its retained config',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'unfrozen-public-test-'));
 try{
  fs.mkdirSync(path.join(directory,'tools'));const file=path.join(directory,'tools/campaign-v63-release.json'),raw=Buffer.from('{"frozen":false,"publicationAccepted":false}\n');fs.writeFileSync(file,raw);
  execFileSync('git',['init','--quiet',directory]);execFileSync('git',['add','--','tools/campaign-v63-release.json'],{cwd:directory});execFileSync('git',['-c','user.name=Audit Test','-c','user.email=audit@example.invalid','commit','--quiet','-m','protocol fixture'],{cwd:directory});
  const git=args=>execFileSync('git',args,{cwd:directory,encoding:'utf8'}).trim();
  await assert.rejects(auditPublicProof({publisher:directory,source:directory,evidence:directory,runId:991,runAttempt:1,commit:git(['rev-parse','HEAD']),tree:git(['rev-parse','HEAD^{tree}'])}),/Unfrozen proposal/);
  assert.deepEqual(fs.readFileSync(file),raw);assert.equal(git(['status','--porcelain']),'');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('final job and metadata-only Pages records equal the actual terminal provider objects',()=>{
 const commit='a'.repeat(40),names=['prepare','deploy','public-http','player',...['early','energy','living','optics','fracture','castle'].map(group=>'native ('+group+')'),'verify'];
 const jobs=names.map((name,index)=>({id:index+1,name,run_id:991,run_attempt:1,head_sha:commit,status:'completed',conclusion:'success',steps:[{number:1,name:'actual recorded step',status:'completed',conclusion:'success'}]}));
 const pagesArtifact={id:100,name:'github-pages',size_in_bytes:700000000,digest:'sha256:'+hash('provider metadata only'),expired:false,workflow_run:{id:991,head_sha:commit},created_at:'2026-10-20T00:00:00Z'};
 const args={jobs,artifacts:[pagesArtifact],finalJobs:clone(jobs.slice(0,-1)),pagesArtifact:clone(pagesArtifact),runId:991,runAttempt:1,commit},before=clone(args);
 assert.deepEqual(assertPublicProviderBindings(args),{jobs:11,finalProducerJobs:10,pagesArtifactId:100});assert.deepEqual(args,before);
 for(const mutate of [x=>x.pagesArtifact.created_at='2026-10-21T00:00:00Z',x=>x.pagesArtifact.digest='sha256:'+hash('other'),x=>x.finalJobs[0].id=900,x=>x.finalJobs[0].steps[0].name='rewritten',x=>x.finalJobs[0].extra='not retained',x=>x.jobs[0].conclusion='failure',x=>x.jobs[0].run_attempt=2,x=>x.finalJobs.pop(),x=>x.artifacts.push(clone(x.artifacts[0]))]){const bad=clone(args);mutate(bad);assert.throws(()=>assertPublicProviderBindings(bad));}
});

test('Source provider run, every job and artifact remain bound to the exact frozen Source attempt',()=>{
 const sourceCommit='b'.repeat(40),pin={id:456,name:'v63-dist',size_in_bytes:100,digest:'sha256:'+hash('source zip')};
 const config={sourceCommit,sourceRun:123,sourceAttempt:2,sourceBranch:'upgrade/campaign-access-20261020',sourceWorkflow:'.github/workflows/player-access-review.yml',expectedJobs:['build','player-ui'],sourceArtifacts:[pin]};
 const provider={run:{id:123,run_attempt:2,head_sha:sourceCommit,head_branch:config.sourceBranch,path:config.sourceWorkflow,status:'completed',conclusion:'success'},jobs:config.expectedJobs.map((name,index)=>({id:index+1,name,run_id:123,run_attempt:2,head_sha:sourceCommit,status:'completed',conclusion:'success'})),artifacts:[{...pin,expired:false,workflow_run:{id:123,head_sha:sourceCommit}}]};
 const args={config,provider},before=clone(args);assert.deepEqual(assertSourceProviderIdentity(args),{runId:123,runAttempt:2,jobs:2,artifacts:1});assert.deepEqual(args,before);
 for(const mutate of [x=>{x.provider.run.id=124;x.provider.artifacts[0].workflow_run.id=124;},x=>x.provider.jobs[0].run_id=124,x=>x.provider.jobs[0].run_attempt=1,x=>x.provider.jobs[0].head_sha='c'.repeat(40),x=>x.provider.jobs[1].id=x.provider.jobs[0].id,x=>x.provider.run.head_branch='main',x=>x.provider.run.path='different.yml',x=>x.provider.artifacts[0].workflow_run.head_sha='c'.repeat(40)]){const bad=clone(args);mutate(bad);assert.throws(()=>assertSourceProviderIdentity(bad));}
});

test('controlled publisher execution rejects filesystem writes, HTTP and child processes before any proof can pass',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'public-offline-guard-'));
 try{
  const program=path.join(directory,'publisher.py'),target=path.join(directory,'must-not-exist');
  const attempts=[`open(${JSON.stringify(target)},'wb').write(b'forbidden')`,`import urllib.request\nurllib.request.urlopen('https://example.invalid/')`,`import subprocess\nsubprocess.run(['definitely-not-an-allowed-browser'])`];
  for(const code of attempts){fs.writeFileSync(program,code+'\n');assert.throws(()=>runReadOnlyPublisherValidators({program,workingDirectory:directory,consumer:directory,producer:{}}),/forbids network, mutation, or execution/);assert.equal(fs.existsSync(target),false);}
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('controlled recovery delegates to both actual pure APIs without spoofing the fresh producer',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'public-recovery-api-test-'));
 try{
  const program=path.join(directory,'publisher.py'),old='7feee7351bc2be2cdee708cae0e7a305bca6567c',fresh='a'.repeat(40),producer={GITHUB_REPOSITORY:'amazin20/brainrot-portal',GITHUB_SHA:fresh,GITHUB_RUN_ID:'39420000000',GITHUB_RUN_ATTEMPT:'1'};
  // A minimal protocol module checks API invocation only. Empty image/groups
  // cannot satisfy auditPublicProof's real package, provider or56-image gates.
  const prefix=`import os,json,hashlib\nPREFIX='campaign-v63/'\nGROUPS={}\ndef sha(value):return hashlib.sha256(value).hexdigest()\ndef encoded(value):return json.dumps(value,separators=(',',':')).encode()\ndef producer():return {k:os.environ[k] for k in ('GITHUB_REPOSITORY','GITHUB_SHA','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT')}\ndef config():return {'recovery':{'kind':'byte-identical-republish-after-public-observer-failure'}}\ndef baseline(c):return []\ndef unchanged_state(c):return {'producer':producer(),'originalBuildInfoSha256':'stamp','candidateFiles':[],'recovery':{'kind':'byte-identical-republish-after-public-observer-failure','publicationAccepted':False}}\ndef validate_candidate(c,folder):return []\ndef validate_public_player(c,state):\n assert producer()['GITHUB_SHA']=='${fresh}' and state['producer']==producer()\n return {'screenshots':[]}\ndef validate_public_routes(c,state):return []\ndef publication_provenance(c,state):return {'producer':{'GITHUB_SHA':'${old}'}}\n`;
  const valid=prefix+`def validate_recovery_material(c,old,candidate_rows,original_stamp):\n assert producer()['GITHUB_SHA']=='${fresh}' and original_stamp=='stamp'\n return {'kind':'byte-identical-republish-after-public-observer-failure','publicationAccepted':False}\n`;
  fs.writeFileSync(program,valid);const result=runReadOnlyPublisherValidators({program,workingDirectory:directory,consumer:directory,producer});
  assert.deepEqual(result.recovery,{kind:'byte-identical-republish-after-public-observer-failure',publicationAccepted:false});assert.deepEqual(result.decodedImages,[]);
  const raw=JSON.stringify({producer:{GITHUB_SHA:old}},null,2)+'\n';assert.deepEqual(result.provenance,{path:'campaign-v63/publication-provenance.json',bytes:Buffer.byteLength(raw),sha256:hash(raw)});
  fs.writeFileSync(program,prefix+"def validate_recovery_material(*args):raise ValueError('Prior recovery material invalid')\n");assert.throws(()=>runReadOnlyPublisherValidators({program,workingDirectory:directory,consumer:directory,producer}),/Prior recovery material invalid/);
  fs.writeFileSync(program,prefix);assert.throws(()=>runReadOnlyPublisherValidators({program,workingDirectory:directory,consumer:directory,producer}),/Recovery requires its actual frozen pure validators/);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
