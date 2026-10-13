import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const REPOSITORY='amazin20/brainrot-portal',REPOSITORY_ID=1354625251;
const PUBLISHER='ba3218f7855e7cbff8170ec1f692a0fd786794a6';
const TREE='54cf0213eec0551c2c88b7a5fee7cd17dbb9e2b3';
const PARENT='bd7481014483ccaaca64923388bdc87e2cafa7ea';
const RUN=38387082981,VERIFY=115271204608,WORKFLOW='.github/workflows/publish-campaign-v55.yml';
const SOURCE=Object.freeze({sourceCommit:'ba5c86fd07facd9613f5e6e8efb9709bd2ef9e89',sourceTree:'1cd58611f9247c661b460c3a99f890a6e63a8715',sourceParent:'1160c296e024e34ac19b1d78247d9168eb7a18a7'});
const REVIEW=Object.freeze({runId:38377149910,runAttempt:1});
const LOG=Object.freeze({bytes:436092,sha256:'65bc0e1d0bba4c63c41311acf50234075708f7f4f37aff6a7c457272c20b2298'});
const JOBS=Object.freeze({assemble:115261416218,deploy:115262787304,entry:115263589982,presentation:115263589990,
 'native (living, 21,22,23,24,25,26,27,28,29,30)':115263590028,
 'native (fracture, 42,43,44,45,46,47,48,49,50,51)':115263590096,
 'native (castle, 41)':115263590102,'native (early, 1,2,3,4,5,6,7,8,9,10)':115263590156,
 'native (energy, 11,12,13,14,15,16,17,18,19,20)':115263590273,
 'native (optics, 31,32,33,34,35,36,37,38,39,40)':115263590314,verify:VERIFY});
const SUFFIX='-38387082981-1';
const ARTIFACTS=Object.freeze([
 ['campaign-v55-public-presentation'+SUFFIX,11808880945,15027824,'42d25bed9017db237bffaf677f92980d0880bcd8537b95f98667ec2eceeb8b33','presentation'],
 ['campaign-v55-public-native-living'+SUFFIX,11807810979,394440,'d80b7fe7c18ba60604fb6c1707ca1029009cda3732b4a04ae4b56a6916e48de6','native (living, 21,22,23,24,25,26,27,28,29,30)'],
 ['campaign-v55-public-native-castle'+SUFFIX,11807699055,34933,'dd5fc989aa3ba9bd4389bd54dc169da2255b4a8bd28a600e26806b6ce24a42ca','native (castle, 41)'],
 ['campaign-v55-public-native-early'+SUFFIX,11807693486,528860,'06c06a31a2b49ee55bff6f5bb80812d6cc6a0af40e441525af1c539719707df5','native (early, 1,2,3,4,5,6,7,8,9,10)'],
 ['campaign-v55-public-native-fracture'+SUFFIX,11807604227,446971,'cb413094a545446189b64e2a61e05ae0585d8889ef4213cf649bb6e9f647e767','native (fracture, 42,43,44,45,46,47,48,49,50,51)'],
 ['github-pages',11807226966,588873115,'25206b52b348fc5133fbf741a5f9afbba91ec3e1a39217f49f12e6862c8660d9','assemble'],
 ['campaign-v55-deploy'+SUFFIX,11807212363,5451850,'03e7a29f1fa70c3af479a14ebb821be9ea4a21b10287f899df6b9c4f34511f05','deploy'],
 ['campaign-v55-prepared'+SUFFIX,11807211981,5413309,'929f157a0b9a96fdd8f29109eff00ccaa87f181c9819b895fad24df3b2296284','assemble'],
 ['campaign-v55-public-entry'+SUFFIX,11807157833,757220,'0595bd050baa94fcd13f5e9a58794093561fbc619e95d0df351a0d7dc6bfca25','entry'],
 ['campaign-v55-public-native-optics'+SUFFIX,11806963667,375182,'44ef1137f48b0caf11f970b730205993864688711716cfc2454960be73d7bb3d','native (optics, 31,32,33,34,35,36,37,38,39,40)'],
 ['campaign-v55-public-native-energy'+SUFFIX,11806244956,449115,'fc17864d1e633201ce1fbac12e21bbee9a889b0e77f76748bab43d6280c18fae','native (energy, 11,12,13,14,15,16,17,18,19,20)'],
]);
const VERIFY_STEPS=Object.freeze([
 [1,'Set up job','success'],[2,'Run actions/checkout@v4','success'],[3,'Run actions/checkout@v4','success'],
 [4,'Run actions/setup-node@v4','success'],[5,'Install locked SOURCE4 dependencies','success'],
 [6,'Install independent image and movie decoders','success'],[7,'Download this PUBLIC run preparation','success'],
 [8,'Recheck the accepted deployment and complete current provider state','success'],
 [9,'Verify all11 actual jobs and all8 complete original PUBLIC capture packets','failure'],
 [10,'Run actions/upload-artifact@v4','failure'],[18,'Post Run actions/setup-node@v4','skipped'],
 [19,'Post Run actions/checkout@v4','success'],[20,'Post Run actions/checkout@v4','success'],[21,'Complete job','success'],
]);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
const runURL='https://github.com/'+REPOSITORY+'/actions/runs/'+RUN;
const api='https://api.github.com/repos/'+REPOSITORY;
function object(value,label){assert.ok(value&&typeof value==='object'&&!Array.isArray(value),label);return value;}
function time(value){assert.equal(typeof value,'string');const parsed=Date.parse(value);assert.ok(Number.isFinite(parsed),'Actual provider timestamp required');return parsed;}
function assertRunIdentity(run){
 object(run,'Actual original PUBLIC run required');assert.equal(run.id,RUN);assert.equal(run.head_sha,PUBLISHER);assert.equal(run.run_attempt,1);
 assert.equal(run.head_branch,'main');assert.equal(run.event,'push');assert.equal(run.path,WORKFLOW);assert.equal(run.html_url,runURL);assert.equal(run.url,api+'/actions/runs/'+RUN);
 for(const repo of [run.repository,run.head_repository]){assert.equal(repo?.id,REPOSITORY_ID);assert.equal(repo.full_name,REPOSITORY);}
 assert.equal(run.head_commit?.id,PUBLISHER);assert.equal(run.workflow_id,383114213);
 time(run.created_at);time(run.updated_at);time(run.run_started_at);return run;
}
function assertFinalRun(run){assertRunIdentity(run);assert.equal(run.status,'completed');assert.equal(run.conclusion,'failure');return run;}
function assertLog(log){
 assert.ok(Buffer.isBuffer(log)||typeof log==='string','Complete raw provider log bytes required');const bytes=Buffer.isBuffer(log)?log:Buffer.from(log,'utf8');
 assert.equal(bytes.length,LOG.bytes,'Complete original verifier log byte count');assert.equal(sha(bytes),LOG.sha256,'Complete original verifier log hash');
 const lines=bytes.toString('utf8').split(/\r?\n/).map(line=>line.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /,''));
 const assertion='AssertionError [ERR_ASSERTION]: PUBLIC capture envelope differs from fresh actual bytes/origin';
 assert.equal(lines.filter(line=>line===assertion).length,1);const start=lines.indexOf(assertion),end=lines.findIndex((line,index)=>index>start&&line.trimStart().startsWith('at validatePublicCapture '));assert.ok(end>start);
 const differenceLines=lines.slice(start+1,end).filter(line=>/^[+-]/.test(line)&&line!=='+ actual - expected');
 assert.deepEqual(differenceLines,[
  "+             filename: 'proof/public-presentation/payload/animation/free-jump.mp4',",
  "-             filename: 'proof/public-artifacts/presentation/payload/animation/free-jump.mp4',",
  "+             filename: 'proof/public-presentation/payload/animation/held-friend-jump.mp4',",
  "-             filename: 'proof/public-artifacts/presentation/payload/animation/held-friend-jump.mp4',",
 ],'Only the two canonical-versus-moved movie filenames may differ');
 assert.deepEqual(lines.filter(line=>line.startsWith('##[error]')),[
  '##[error]Process completed with exit code 1.',
  '##[error]No files were found with the provided path: proof/public-verification. No artifacts will be uploaded.',
 ]);return {bytes:bytes.length,sha256:sha(bytes),differenceLines};
}

/** Authenticate only this original failed run. This does not turn CI green. */
export function assertOriginalFailedProvider({run,jobs,artifacts,gitCommit,log},pins){
 object(pins,'Frozen read-only recovery pins required');const expected=object(pins.originalProvider,'Frozen originalProvider pins required');
 for(const [key,value]of Object.entries(SOURCE))assert.equal(pins[key],value,'Unchanged accepted Source4 '+key);assert.deepEqual(pins.sourceReview,REVIEW);
 assert.deepEqual(expected.verifierLog,LOG);assertFinalRun(run);
 assert.deepEqual(run,expected.run,'Original raw API run changed');assert.deepEqual(jobs,expected.jobs,'Original raw API jobs changed');
 assert.deepEqual(artifacts,expected.artifacts,'Original raw API artifacts changed');assert.deepEqual(gitCommit,expected.gitCommit,'Original raw API git commit changed');
 object(gitCommit,'Actual original git commit required');assert.equal(gitCommit.sha,PUBLISHER);assert.equal(gitCommit.tree?.sha,TREE);assert.equal(gitCommit.url,api+'/git/commits/'+PUBLISHER);
 assert.equal(gitCommit.html_url,'https://github.com/'+REPOSITORY+'/commit/'+PUBLISHER);assert.ok(Array.isArray(gitCommit.parents));assert.equal(gitCommit.parents.length,1);assert.equal(gitCommit.parents[0].sha,PARENT);
 assert.ok(Array.isArray(jobs));assert.equal(jobs.length,11);assert.equal(new Set(jobs.map(job=>job.id)).size,11);assert.deepEqual(jobs.map(job=>job.name).sort(),Object.keys(JOBS).sort());
 for(const job of jobs){assert.equal(job.id,JOBS[job.name]);assert.equal(job.run_id,RUN);assert.equal(job.run_attempt,1);assert.equal(job.head_sha,PUBLISHER);assert.equal(job.head_branch,'main');assert.equal(job.html_url,runURL+'/job/'+job.id);assert.equal(job.url,api+'/actions/jobs/'+job.id);assert.equal(job.status,'completed');assert.equal(job.conclusion,job.name==='verify'?'failure':'success');assert.ok(time(job.started_at)<=time(job.completed_at));
  assert.ok(Array.isArray(job.steps)&&job.steps.length>0);assert.equal(new Set(job.steps.map(step=>step.number)).size,job.steps.length);for(const step of job.steps){assert.equal(step.status,'completed');assert.ok(time(step.started_at)<=time(step.completed_at));if(job.name!=='verify')assert.equal(step.conclusion,'success','An original successful producer step changed');}
  if(job.name==='verify')assert.deepEqual(job.steps.map(step=>[step.number,step.name,step.conclusion]),VERIFY_STEPS);
 }
 assert.ok(Array.isArray(artifacts));assert.equal(artifacts.length,11);assert.equal(new Set(artifacts.map(row=>row.id)).size,11);assert.deepEqual(artifacts.map(row=>row.name).sort(),ARTIFACTS.map(row=>row[0]).sort());
 const associations=[];for(const [name,id,size,digest,jobName]of ARTIFACTS){const artifact=artifacts.find(row=>row.name===name),job=jobs.find(row=>row.name===jobName);assert.equal(artifact.id,id);assert.equal(artifact.size_in_bytes,size);assert.equal(artifact.digest,'sha256:'+digest);assert.equal(artifact.expired,false);
  assert.deepEqual(artifact.workflow_run,{id:RUN,repository_id:REPOSITORY_ID,head_repository_id:REPOSITORY_ID,head_branch:'main',head_sha:PUBLISHER});
  const uploadName=name==='github-pages'?'Upload the single complete Pages package':'Run actions/upload-artifact@v4',uploads=job.steps.filter(step=>step.name===uploadName&&step.conclusion==='success');assert.equal(uploads.length,1);const upload=uploads[0],created=time(artifact.created_at);assert.ok(created>=time(upload.started_at)-2000&&created<=time(upload.completed_at)+2000,'Artifact does not belong to its actual producer upload');
  associations.push({artifactId:id,artifactName:name,jobId:job.id,uploadStep:upload.number,descriptorOnly:name==='github-pages'});
 }
 const verifierLog=assertLog(log);
 return {kind:'exact-original-failed-campaign-v55-provider',pass:true,publicationAccepted:false,originalProviderAccepted:true,originalCIConclusion:'failure',publisherCommit:PUBLISHER,publisherTree:TREE,publisherParent:PARENT,publicationRun:RUN,publicationRunAttempt:1,source:{...SOURCE,sourceReview:clone(REVIEW)},verifierJobId:VERIFY,failedSteps:[9,10],successfulProducerJobs:10,artifacts:associations,verifierLog,scope:'Only the authenticated movie probe filename comparison and consequent missing verification-bundle upload failure are recognized. Original CI remains failure; this gate accepts no capture, site bytes, recovery transport or publication.'};
}

/** Compare real archived capture-time state with the separately failed API run. */
export function assertArchivedProducerRun(archived,actual){
 assertFinalRun(actual);assertRunIdentity(archived);assert.equal(archived.status,'in_progress');assert.equal(archived.conclusion,null);
 const withoutLifecycle=value=>Object.fromEntries(Object.entries(value).filter(([key])=>!['status','conclusion','updated_at'].includes(key)));
 assert.deepEqual(withoutLifecycle(archived),withoutLifecycle(actual),'Archived producer changed immutable actual run fields');assert.ok(time(archived.updated_at)<=time(actual.updated_at));
 return {kind:'exact-original-archived-producer-run',pass:true,publicationAccepted:false,publisherCommit:PUBLISHER,publicationRun:RUN,publicationRunAttempt:1,archivedStatus:'in_progress',archivedConclusion:null,actualStatus:'completed',actualConclusion:'failure',allowedLifecycleDifferences:['status','conclusion','updated_at']};
}
