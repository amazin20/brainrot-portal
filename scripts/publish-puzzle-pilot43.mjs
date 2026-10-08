/** Exact-source metadata and stale-publication guards for the isolated pilot. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const BASELINE_RUN=37744513446;
const BASELINE_PUBLISHER='39d5311d2620a632bb65194921de53add238c74d';
const BASELINE_SOURCE='8d2c01eacd86fe9235a35e7ec5f624ba62c3b29e';
const BASELINE_ARTIFACT={id:11534473854,name:'github-pages',digest:'sha256:dd50e80a81d368debae5147a32a8880be78661a1c0968d09639aa2ebd68a17c9',size_in_bytes:450828352};
const BRANCH='upgrade/puzzle-pilot-20261008';
const PUBLIC_BASE='https://amazin20.github.io/brainrot-portal/';
const hash=value=>createHash('sha256').update(value).digest('hex');
const write=(filename,value)=>{fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,JSON.stringify(value,null,2)+'\n');};
const exactSource=()=>{
 const source=process.env.BUILD_COMMIT||process.env.GITHUB_SHA;
 assert.match(source||'',/^[a-f0-9]{40}$/,'An exact checked-out source commit is required');
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source);
 assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'','Stamp a committed candidate');
 return source;
};

async function stamp(directory){
 const source=exactSource();
 execFileSync(process.execPath,['scripts/stamp-build.mjs','v54-unified-campaign',directory],{stdio:'inherit',env:{...process.env,BUILD_COMMIT:source}});
 const {campaignSpec}=await import('../src/game/LabCampaignLevels.js');
 const spec=campaignSpec({chamberEdition:'foundation',puzzlePilot43:true},42);
 const retained=campaignSpec({chamberEdition:'foundation'},42);
 assert.ok(spec?.id&&spec.title);assert.notEqual(spec.id,retained.id,'The opt-in pilot must differ from retained room 43');
 const filename=path.join(directory,'build-info.json'),info=JSON.parse(fs.readFileSync(filename));
 Object.assign(info,{version:'v54-puzzle-pilot43-v1',gameplayVersion:'v54-puzzle-pilot43-v1',artVersion:'v54-puzzle-pilot43-v1',
  status:'isolated-puzzle-pilot',verified:false,
  verificationScope:'One opt-in room prototype. Native browser checks cover this pilot; the existing public game and its videos are preserved byte for byte. This is not acceptance of the full master specification.'});
 info.features.puzzlePilot43={level:43,id:spec.id,title:spec.title,specSha256:hash(JSON.stringify(spec)),revision:'puzzle-pilot43-v1',optIn:true,
  query:'?edition=foundation&level=43&pilot=43',storagePrefix:'brainrot-puzzle-pilot43-v1:',retainedId:retained.id};
 const recordingFile=path.join(directory,'evidence/level-43.json');
 if(fs.existsSync(recordingFile)){
  const recording=JSON.parse(fs.readFileSync(recordingFile));
  assert.equal(recording.sourceCommit,source);assert.equal(recording.level,43);assert.equal(recording.route.pass,true);
  assert.equal(recording.sha256,hash(fs.readFileSync(path.join(directory,'evidence/level-43.mp4'))));
  info.features.puzzlePilot43.currentWalkthrough={video:'evidence/level-43.mp4',report:'evidence/level-43.json',poster:'evidence/level-43.jpg',
   sourceCommit:source,sha256:recording.sha256,durationSeconds:recording.durationSeconds,fps:recording.fps,
   method:recording.method,continuous:true};
 }
 info.videoCatalogue.policy='Previous public recordings remain at their original paths and keep their original identity. They do not demonstrate the new opt-in pilot.';
 write(filename,info);
 console.log(`Stamped isolated pilot ${source}; ${spec.title}`);
}

function copyEvidence(directory){
 const source=exactSource();
 const browserRoot='qa/puzzle-pilot43-browser',recordingRoot='qa/puzzle-pilot43-walkthrough';
 const browser=JSON.parse(fs.readFileSync(path.join(browserRoot,'report.json')));
 assert.equal(browser.pass,true,'Native browser review must pass before publishing its screenshots');
 assert.equal(browser.sourceCommit,source,'Browser evidence must describe this exact source');
 const recording=JSON.parse(fs.readFileSync(path.join(recordingRoot,'level-43.json')));
 assert.equal(recording.level,43);assert.equal(recording.sourceCommit,source);assert.equal(recording.route.pass,true);
 assert.equal(recording.continuous,true);assert.equal(recording.firstFrame.visualFrame,0);assert.equal(recording.lastFrame.state,'won');
 assert.equal(recording.route.resets,0);assert.equal(recording.route.respawns,0);assert.equal(recording.pixelCheck.allNonblank,true);
 assert.equal(recording.fps,4);assert.equal(recording.width,640);assert.equal(recording.height,360);
 assert.equal(recording.sha256,hash(fs.readFileSync(path.join(recordingRoot,'level-43.mp4'))));
 const destination=path.join(directory,'evidence');assert.equal(fs.existsSync(destination),false,'Evidence must be assembled once from this exact review');
 fs.mkdirSync(destination,{recursive:true});
 fs.copyFileSync(path.join(browserRoot,'report.json'),path.join(destination,'browser-report.json'));
 for(const filename of fs.readdirSync(browserRoot))if(/\.(?:png|jpe?g)$/.test(filename)){
  assert.equal(fs.lstatSync(path.join(browserRoot,filename)).isFile(),true);
  fs.copyFileSync(path.join(browserRoot,filename),path.join(destination,'browser-'+filename));
 }
 for(const filename of ['level-43.mp4','level-43.json','level-43.jpg','level-43-finish.jpg']){
  assert.equal(fs.lstatSync(path.join(recordingRoot,filename)).isFile(),true);
  fs.copyFileSync(path.join(recordingRoot,filename),path.join(destination,filename));
 }
 console.log('Copied only exact-source browser screenshots, reports and one complete pilot recording; no frame directories');
}

async function githubGet(resource){
 const token=process.env.GITHUB_TOKEN;
 assert.ok(token,'GITHUB_TOKEN is required for publication provenance');
 const response=await fetch('https://api.github.com/repos/amazin20/brainrot-portal/'+resource,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(60000)});
 assert.ok(response.ok,'GitHub provenance HTTP '+response.status+': '+resource);
 return response.json();
}

async function guard(phase){
 assert.ok(['prepare','deploy'].includes(phase));
 assert.equal(process.env.GITHUB_REPOSITORY,'amazin20/brainrot-portal');
 assert.equal(process.env.GITHUB_REF,'refs/heads/'+BRANCH);
 const source=process.env.GITHUB_SHA;
 assert.match(source||'',/^[a-f0-9]{40}$/);
 const [main,head,run,artifacts,deployments]=await Promise.all([
  githubGet('git/ref/heads/main'),githubGet('git/ref/heads/'+BRANCH),githubGet('actions/runs/'+BASELINE_RUN),
  githubGet('actions/runs/'+BASELINE_RUN+'/artifacts?name=github-pages&per_page=100'),
  githubGet('deployments?environment=github-pages&per_page=100'),
 ]);
 assert.equal(main.object.sha,BASELINE_PUBLISHER,'Main changed after the accepted baseline; reconcile its publication before adding this pilot');
 assert.equal(head.object.sha,source,'A newer pilot source exists; this obsolete run must not deploy');
 assert.equal(run.head_sha,BASELINE_PUBLISHER);assert.equal(run.head_branch,'main');assert.equal(run.run_attempt,1);
 assert.equal(run.path,'.github/workflows/publish-unified-campaign.yml');assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
 const matching=artifacts.artifacts.filter(row=>row.name==='github-pages');
 assert.equal(matching.length,1,'Exactly one accepted Pages artifact is required');
 const artifact=matching[0];
 for(const [key,value]of Object.entries(BASELINE_ARTIFACT))assert.equal(artifact[key],value,'Baseline artifact '+key);
 assert.equal(artifact.expired,false,'The accepted Pages artifact expired; recover its exact public inventory before continuing');
 assert.equal(artifact.workflow_run.id,BASELINE_RUN);assert.equal(artifact.workflow_run.head_sha,BASELINE_PUBLISHER);
 let accepted=null;const inspected=[];
 const newest=[...deployments].sort((a,b)=>b.id-a.id);
 for(const deployment of newest){
  const statuses=await githubGet('deployments/'+deployment.id+'/statuses?per_page=100');
  const status=[...statuses].sort((a,b)=>b.id-a.id)[0];
  inspected.push({id:deployment.id,sha:deployment.sha,ref:deployment.ref,state:status?.state||null,logUrl:status?.log_url||null});
  // GitHub creates this job's environment deployment before its first step.
  // Identify it through its Actions log URL, never ignore a foreign publisher.
  const ownLog=status?.log_url&&new RegExp('/actions/runs/'+process.env.GITHUB_RUN_ID+'(?:/|$)').test(status.log_url);
  if(deployment.sha===source&&ownLog)continue;
  if(!status||['queued','pending','in_progress'].includes(status.state))throw Error('Another Pages deployment is pending: '+deployment.id);
  if(status.state==='failure'||status.state==='error')continue;
  if(status.state==='success'){
   assert.equal(deployment.sha,BASELINE_PUBLISHER,'A later Pages publication exists; refuse to replace it with the pinned baseline');
   accepted={id:deployment.id,sha:deployment.sha,statusId:status.id,environmentUrl:status.environment_url};break;
  }
 }
 assert.ok(accepted,'No active successful Pages deployment matches the accepted baseline');
 const response=await fetch(PUBLIC_BASE+'build-info.json?pilot-source-guard='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(60000)});
 assert.ok(response.ok,'The public baseline metadata is unavailable');
 const metadata=await response.json();
 assert.equal(metadata.commit,BASELINE_SOURCE,'The public game source changed');
 assert.equal(metadata.publisherCommit,BASELINE_PUBLISHER,'The public publisher changed');
 if(phase==='deploy'){
  const proof=JSON.parse(fs.readFileSync('proof/manifest.json'));
  assert.equal(proof.sourceCommit,source);assert.equal(proof.baselinePublisherCommit,BASELINE_PUBLISHER);
  assert.equal(proof.baselineSourceCommit,BASELINE_SOURCE);assert.equal(proof.mainSiteUnchanged,true);
  const predeploy=JSON.parse(fs.readFileSync('proof/predeploy-public-bytes.json'));
  assert.equal(predeploy.pass,true);assert.equal(predeploy.checked,proof.preservedFiles.length);
 }
 write('proof/github-guard-'+phase+'.json',{pass:true,phase,sourceCommit:source,baselineRun:BASELINE_RUN,baselinePublisherCommit:BASELINE_PUBLISHER,
  baselineSourceCommit:BASELINE_SOURCE,artifact,acceptedDeployment:accepted,inspectedDeployments:inspected,checkedAt:new Date().toISOString()});
 console.log('Exact baseline and latest Pages deployment checked: '+phase);
}

const [command,argument]=process.argv.slice(2);
if(command==='stamp')await stamp(argument||'dist');
else if(command==='evidence')copyEvidence(argument||'dist');
else if(command==='guard')await guard(argument);
else throw Error('Usage: publish-puzzle-pilot43.mjs stamp|evidence [dist] | guard prepare|deploy');
