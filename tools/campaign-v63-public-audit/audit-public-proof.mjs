/** Read-only revalidation of retained Public artifacts. No download, build,
 * browser, publication command, or acceptance receipt is executed here. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const REPO='amazin20/brainrot-portal',PREFIX='campaign-v63/',BASE='https://amazin20.github.io/brainrot-portal/',URL=BASE+PREFIX;
const GROUPS={early:Array.from({length:10},(_,i)=>i+1),energy:Array.from({length:10},(_,i)=>i+11),living:Array.from({length:10},(_,i)=>i+21),optics:Array.from({length:10},(_,i)=>i+31),fracture:Array.from({length:10},(_,i)=>i+42),castle:[41]};
const SCOPES={sourceAccepted:false,publicationAccepted:false,liveSdkAccepted:false,moderationAccepted:false,physicalPhonePerformanceAccepted:false};
const BASELINE={files:2605,bytes:690702631,inventorySha256:'2ecbf5a2b61c5b0fd8366f833c6670672f3447a16db3fd36464088291421190e'};
const BASELINE_ID=7190324410,BASELINE_SHA='c5814892d6a40ffc911e0ed62df022f82990cb4a';
const CATALOG_SHA='e5d36ae12354ec7fea8c86a187d5a044fdf29ecec669789b8fe85b9f12c17994';
const RESET_SCOPE='reported journey counters after legacy fixture initialization; the initial fixture reset is outside these counters; specialized drivers retain their own stricter proofs';
const DEPLOYMENT_SCOPE='Original complete paginated GitHub API response bytes observed in the final CI job; no independent post-CI deployment GET is claimed.';
const FINAL_LIMITATIONS=['Automated ordinary inputs and software WebGL; no human/device/live-Yandex acceptance.','Legacy51 initial fixture reset is outside the reported route counters; strict zero-step native start is not claimed for that cohort.','Historical media were fetched and hashed; this does not establish new recording or complete decode of those histories.','Original checker results apply to a separately bound test SDK package, not real advertising fill or moderation.','Final publisher job and complete provider artifacts require independent terminal review.'];
const RECOVERY_KIND='byte-identical-republish-after-public-observer-failure';
const RECOVERY_DEPLOYMENT={id:7198668659,sha:'7feee7351bc2be2cdee708cae0e7a305bca6567c'};
const hash=value=>createHash('sha256').update(value).digest('hex');
const encoded=value=>JSON.stringify(value);
const integer=(value,label,min=0)=>assert.ok(Number.isSafeInteger(value)&&value>=min,label+' must be a safe integer >= '+min);
const digest=value=>assert.match(value||'',/^[0-9a-f]{64}$/);
const object=value=>assert.ok(value&&typeof value==='object'&&!Array.isArray(value));

/** JSON.parse alone accepts duplicate identity keys and overflowing numbers. */
export function parsePublicEvidenceJSON(text){
 assert.equal(typeof text,'string');assert.ok(Buffer.byteLength(text)<=25_000_000,'Oversized Public JSON');
 let at=0,nodes=0;const ws=()=>{while(/[\t\n\r ]/.test(text[at]||'X'))at++;};
 const string=()=>{assert.equal(text[at], '"');const start=at++;while(at<text.length){assert.ok(text.charCodeAt(at)>=32);if(text[at]==='\\'){at+=2;continue;}if(text[at++]==='"')return JSON.parse(text.slice(start,at));}assert.fail('Unterminated JSON string');};
 const value=(depth=0)=>{assert.ok(depth<=100&&++nodes<=1_000_000,'Oversized JSON structure');ws();const c=text[at];
  if(c==='"')return string();
  if(c==='{'){at++;ws();const keys=new Set();if(text[at]==='}'){at++;return;}for(;;){ws();const key=string();assert.ok(!keys.has(key),'Duplicate Public JSON key: '+key);keys.add(key);ws();assert.equal(text[at++],':');value(depth+1);ws();const next=text[at++];if(next==='}')return;assert.equal(next,',');}}
  if(c==='['){at++;ws();if(text[at]===']'){at++;return;}for(;;){value(depth+1);ws();const next=text[at++];if(next===']')return;assert.equal(next,',');}}
  for(const token of ['true','false','null'])if(text.startsWith(token,at)){at+=token.length;return;}
  const match=text.slice(at).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);assert.ok(match,'Invalid JSON token');at+=match[0].length;assert.ok(Number.isFinite(Number(match[0])),'Nonfinite Public JSON');
 };value();ws();assert.equal(at,text.length,'Trailing Public JSON');return JSON.parse(text);
}
const read=file=>parsePublicEvidenceJSON(fs.readFileSync(file,'utf8'));
function safeName(name){assert.equal(typeof name,'string');assert.ok(name&&!name.includes('\\')&&!path.isAbsolute(name)&&!/^\w:/.test(name)&&![...name].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)&&!name.split('/').some(p=>!p||p==='.'||p==='..'),'Unsafe Public artifact path');return name;}
function rowFor(root,name){safeName(name);const file=path.join(root,name),stat=fs.lstatSync(file);assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'Regular retained file required: '+name);const bytes=fs.readFileSync(file);return{path:name,bytes:bytes.length,sha256:hash(bytes)};}
function inventory(root){const result=[];function visit(dir,prefix=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){assert.equal(entry.isSymbolicLink(),false,'Retained symlink');const name=prefix+entry.name;if(entry.isDirectory())visit(path.join(dir,entry.name),name+'/');else result.push(rowFor(root,name));}}visit(root);return result.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);}
export function assertPublicInventory(rows,limit=800_000_000){
 assert.ok(Array.isArray(rows)&&rows.length>0&&rows.length<=10000);const names=[];let bytes=0;
 for(const row of rows){object(row);assert.deepEqual(Object.keys(row).sort(),['bytes','path','sha256']);names.push(safeName(row.path));integer(row.bytes,'Member bytes');assert.ok(row.bytes<=limit);bytes+=row.bytes;digest(row.sha256);}
 assert.deepEqual(names,[...new Set(names)].sort(),'Inventory must be unique and sorted');assert.ok(bytes<=limit);
 const namesSet=new Set(names);for(const name of names)for(let i=1;i<name.split('/').length;i++)assert.ok(!namesSet.has(name.split('/').slice(0,i).join('/')),'Inventory file/directory collision');return rows;
}
const summary=rows=>({files:rows.length,bytes:rows.reduce((sum,row)=>sum+row.bytes,0),inventorySha256:hash(encoded(rows))});
const httpSummary=rows=>({...summary(rows),method:'complete HTTP GET, exact length and SHA-256 for every file'});
function providerPages(input,field){
 const directory=path.join(input,'provider',field),names=fs.readdirSync(directory).sort();assert.ok(names.length>0);assert.deepEqual(names,names.map((_,i)=>'page-'+String(i+1).padStart(3,'0')+'.json'));
 let count;const rows=[];for(const name of names){rowFor(directory,name);const page=read(path.join(directory,name));integer(page.total_count,'Provider total',1);if(count===undefined)count=page.total_count;assert.equal(page.total_count,count);assert.ok(Array.isArray(page[field])&&page[field].length>0);rows.push(...page[field]);}
 assert.equal(rows.length,count);assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);return rows;
}
export function assertPublicProviderBindings({jobs,artifacts,finalJobs,pagesArtifact,runId,runAttempt,commit}){
 const names=['prepare','deploy','public-http','player',...Object.keys(GROUPS).map(group=>'native ('+group+')')];
 assert.equal(jobs.length,11);assert.deepEqual(jobs.map(row=>row.name).sort(),[...names,'verify'].sort());assert.equal(new Set(jobs.map(row=>row.id)).size,jobs.length);
 for(const row of jobs){integer(row.id,'Provider job ID',1);assert.equal(row.run_id,runId);assert.equal(row.run_attempt,runAttempt);assert.equal(row.head_sha,commit);assert.equal(row.status,'completed');assert.equal(row.conclusion,'success');}
 assert.equal(finalJobs.length,10);assert.deepEqual(finalJobs.map(row=>row.name).sort(),names.sort());assert.equal(new Set(finalJobs.map(row=>row.id)).size,finalJobs.length);const byId=new Map(jobs.map(row=>[row.id,row]));
 for(const row of finalJobs)assert.deepEqual(row,byId.get(row.id),'Final producer snapshot differs from the actual terminal provider job');
 const pages=artifacts.filter(row=>row.name==='github-pages');assert.equal(pages.length,1);assert.deepEqual(pagesArtifact,pages[0],'Before-deploy Pages pin differs from the actual provider artifact row');
 return{jobs:jobs.length,finalProducerJobs:finalJobs.length,pagesArtifactId:pages[0].id};
}
export function assertSourceProviderIdentity({config,provider}){
 const run=provider.run;assert.equal(run.id,config.sourceRun);assert.equal(run.run_attempt,config.sourceAttempt);assert.equal(run.head_sha,config.sourceCommit);assert.equal(run.head_branch,config.sourceBranch);assert.equal(run.path.split('@')[0],config.sourceWorkflow);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
 const jobs=provider.jobs;assert.ok(Array.isArray(jobs));assert.deepEqual(jobs.map(row=>row.name).sort(),[...config.expectedJobs].sort());assert.equal(new Set(jobs.map(row=>row.id)).size,jobs.length);
 for(const row of jobs){integer(row.id,'Source job ID',1);assert.equal(row.run_id,config.sourceRun);assert.equal(row.run_attempt,config.sourceAttempt);assert.equal(row.head_sha,config.sourceCommit);assert.equal(row.status,'completed');assert.equal(row.conclusion,'success');}
 assert.deepEqual(provider.artifacts.map(row=>Object.fromEntries(['id','name','size_in_bytes','digest'].map(key=>[key,row[key]]))).sort((a,b)=>a.id-b.id),[...config.sourceArtifacts].sort((a,b)=>a.id-b.id));
 for(const row of provider.artifacts){assert.equal(row.expired,false);assert.equal(row.workflow_run.id,config.sourceRun);assert.equal(row.workflow_run.head_sha,config.sourceCommit);}return{runId:config.sourceRun,runAttempt:config.sourceAttempt,jobs:jobs.length,artifacts:provider.artifacts.length};
}

export function assertAppendOnlyInventory({baseline,candidate,union,provenance}){
 assertPublicInventory(baseline);assertPublicInventory(candidate,100_000_000);assertPublicInventory(union);
 assert.ok(!baseline.some(row=>row.path.startsWith(PREFIX)),'Baseline already contains new namespace');
 assert.equal(provenance.path,PREFIX+'publication-provenance.json');assertPublicInventory([provenance]);
 const expected=[...baseline,...candidate.map(row=>({...row,path:PREFIX+row.path})),provenance].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 assert.deepEqual(union,expected,'Public union changed historical bytes or candidate membership');return summary(union);
}

/** Historical catalog identity remains fixed. A recovery has a separate,
 * newer deployment lease; it cannot redefine the 2605-file baseline. */
export function publicDeploymentLease(config){
 if(!Object.hasOwn(config,'recovery'))return{id:BASELINE_ID,sha:BASELINE_SHA};
 object(config.recovery);assert.equal(config.recovery.kind,RECOVERY_KIND);assert.equal(config.recovery.publicationAccepted,false);const lease=config.recovery.deployment;object(lease);
 assert.deepEqual(lease,RECOVERY_DEPLOYMENT,'Recovery must bind the exact failed attempt deployment lease');assert.equal(config.controllerParent,RECOVERY_DEPLOYMENT.sha,'Recovery must be the direct successor of the failed publisher');return{...lease};
}

/** A failed origin supplies immutable bytes only. Every recovery proof and
 * provider gate still belongs to the new complete successful publisher run. */
export function assertRecoveryBindings({config,state,before,final,verified,provenance,currentProducer}){
 const lease=publicDeploymentLease(config);
 if(!Object.hasOwn(config,'recovery')){
  assert.equal(verified,null);for(const value of [state,before,final]){assert.equal(Object.hasOwn(value,'recovery'),false);assert.equal(Object.hasOwn(value,'recoveryHTTP'),false);}return null;
 }
 const origin=config.recovery;object(verified);assert.equal(verified.kind,RECOVERY_KIND);assert.equal(verified.publicationAccepted,false);
 integer(origin.runId,'Original failed run',1);integer(origin.runAttempt,'Original failed attempt',1);assert.match(origin.publisherCommit||'',/^[a-f0-9]{40}$/);
 const originalProducer={GITHUB_REPOSITORY:REPO,GITHUB_SHA:origin.publisherCommit,GITHUB_RUN_ID:String(origin.runId),GITHUB_RUN_ATTEMPT:String(origin.runAttempt)};
 assert.deepEqual(verified.originalProducer,originalProducer);assert.notEqual(currentProducer.GITHUB_SHA,originalProducer.GITHUB_SHA,'Recovery must use a fresh publisher commit');assert.notEqual(currentProducer.GITHUB_RUN_ID,originalProducer.GITHUB_RUN_ID,'Failed original run cannot be reused as a successful recovery');
 assert.deepEqual(verified.previousDeployment,lease);assert.deepEqual(verified.originalProvenance,provenance,'Recovery rewrote the original public provenance');assert.equal(verified.originalProvider.parsedObjectsNotRawResponseBytes,true,'Do not promote parsed origin provider objects to original HTTP bytes');
 assert.deepEqual(state.recovery,verified);assert.deepEqual(final.recovery,verified);assert.deepEqual(verified.unionFiles,state.unionFiles);assert.deepEqual(verified.union,summary(state.unionFiles));
 const expectedHTTP=httpSummary(state.unionFiles);assert.deepEqual(state.recoveryHTTP,expectedHTTP,'Recovery did not restore the exact complete union with a fresh HTTP check');assert.deepEqual(before.recoveryHTTP,expectedHTTP,'Recovery did not recheck the complete union immediately before deployment');assert.deepEqual(final.recoveryHTTP,state.recoveryHTTP);
 return{kind:RECOVERY_KIND,originalProducer,originalAttemptEligible:false,originalPublicAcceptance:false,identicalUnionConfirmed:true,previousDeployment:lease,originalProvenance:provenance,retainedOriginProviderIsParsed:true};
}

export function assertPublicNetwork({network,stamps,rows,stamp,pages,entry=false}){
 assertPublicInventory(rows,100_000_000);integer(pages,'Fresh pages',1);digest(stamp);
 const expected=new Map(rows.map(row=>[URL+row.path,row]));expected.set(URL,expected.get(URL+'index.html'));
 assert.ok(Array.isArray(network)&&network.length>0&&Array.isArray(stamps)&&stamps.length>0);
 for(const row of network){integer(row.page,'Response page',1);assert.ok(row.page<=pages);const wanted=expected.get(row.url);assert.ok(wanted,'Response outside canonical package');assert.equal(row.status,200);assert.equal(row.fromCache,false);assert.equal(row.bytes,wanted.bytes);assert.equal(row.sha256,wanted.sha256);}
 for(const row of stamps){integer(row.page,'Stamp page',1);assert.ok(row.page<=pages);assert.equal(row.url,URL+'build-info.json');assert.equal(row.status,200);assert.equal(row.sha256,stamp);}
 if(!entry)assert.deepEqual(stamps.map(row=>row.page),Array.from({length:pages},(_,i)=>i+1),'Reused or missing native page');
 assert.deepEqual([...new Set(stamps.map(row=>row.page))].sort((a,b)=>a-b),Array.from({length:pages},(_,i)=>i+1));
 for(let n=1;n<=pages;n++)assert.ok(network.some(row=>row.page===n&&(row.url===URL||row.url.endsWith('/index.html')||row.url.endsWith('.js'))),'Page lacks original HTML/JS response');
 return{pages,responses:network.length,stampReads:stamps.length};
}

/** Canonical complete CI snapshot, not an independent post-CI provider GET. */
export function auditDeploymentSnapshot(directory,{producer,sourceCommit,sourceTree,sourceReview,commit,runId,expected,previousDeploymentId=BASELINE_ID}={}){
 const manifest=read(path.join(directory,'manifest.json'));
 assert.equal(manifest.schemaVersion,1);assert.equal(manifest.kind,'actual-v63-ci-deployment-api-snapshot');assert.equal(manifest.publicationAccepted,false);
 assert.equal(manifest.scope,DEPLOYMENT_SCOPE);
 assert.deepEqual(manifest.producer,producer);assert.equal(manifest.sourceCommit,sourceCommit);assert.equal(manifest.sourceTree,sourceTree);assert.deepEqual(manifest.sourceReview,sourceReview);
 const instant=value=>{assert.equal(typeof value,'string');assert.match(value,/(?:Z|[+-]\d\d:\d\d)$/,'Snapshot timestamp requires an explicit timezone');const result=Date.parse(value);assert.ok(Number.isFinite(result));return result;};
 const start=instant(manifest.captureStartedAt),end=instant(manifest.captureCompletedAt);assert.ok(end>=start);
 integer(previousDeploymentId,'Previous deployment lease',BASELINE_ID);integer(manifest.deploymentId,'Deployment ID',previousDeploymentId+1);assert.deepEqual(Object.keys(manifest.resources).sort(),['deployments','statuses']);
 const files=['manifest.json'];
 function collection(stem,endpoint){const resource=manifest.resources[stem];assert.equal(resource.endpoint,endpoint);assert.ok(Array.isArray(resource.pages)&&resource.pages.length>0&&resource.pages.length<=100);const values=[];
  for(const[index,row]of resource.pages.entries()){
   const page=index+1,name=stem+'-page-'+String(page).padStart(3,'0')+'.json',url='https://api.github.com/repos/'+REPO+'/'+endpoint+(endpoint.includes('?')?'&':'?')+'per_page=100&page='+page;
   assert.equal(row.path,name);assert.equal(row.page,page);assert.equal(row.requestURL,url);assert.equal(row.responseURL,url);assert.equal(row.status,200);assert.ok(instant(row.requestedAt)>=start&&instant(row.completedAt)>=instant(row.requestedAt)&&instant(row.completedAt)<=end);
   const actual=rowFor(directory,name);assert.equal(row.bytes,actual.bytes);assert.equal(row.sha256,actual.sha256);const body=read(path.join(directory,name));assert.ok(Array.isArray(body)&&body.length<=100);assert.equal(row.items,body.length);assert.ok(index===resource.pages.length-1?body.length<100:body.length===100,'Provider pagination did not close');values.push(...body);files.push(name);
  }
  assert.equal(resource.items,values.length);const ids=values.map(row=>row.id);ids.forEach(id=>integer(id,'Provider resource ID',1));assert.equal(new Set(ids).size,ids.length,'Duplicate deployment/status record');return values;
 }
 const deployments=collection('deployments','deployments?environment=github-pages'),statuses=collection('statuses','deployments/'+manifest.deploymentId+'/statuses');
 assert.ok(deployments.length>0&&statuses.length>0);const deployment=[...deployments].sort((a,b)=>b.id-a.id)[0];
 assert.deepEqual(statuses.map(row=>row.id),statuses.map(row=>row.id).sort((a,b)=>b-a),'Latest deployment status must be first');
 assert.equal(deployment.id,manifest.deploymentId);assert.equal(deployment.sha,commit);assert.equal(deployment.environment,'github-pages');assert.equal(statuses[0].state,'success');
 const runURL='https://github.com/'+REPO+'/actions/runs/'+runId;
 assert.ok(['log_url','target_url'].some(key=>typeof statuses[0][key]==='string'&&(statuses[0][key].replace(/\/+$/,'')===runURL||statuses[0][key].startsWith(runURL+'/'))),'Deployment is not owned by this publisher run');
 const actual={deployment,statuses};assert.deepEqual(actual,expected,'Final deployment differs from retained original API pages');
 assert.deepEqual(inventory(directory).map(row=>row.path),files.sort(),'Unexpected deployment snapshot member');assert.ok(inventory(directory).reduce((n,row)=>n+row.bytes,0)<=25_000_000);
 return{deploymentId:deployment.id,statuses:statuses.length,rawFiles:inventory(directory),independentPostCIDeploymentGet:false,workflowRetainedOriginalAPIBytes:true};
}

const PYTHON_PURE=String.raw`
import sys,json,os,pathlib,socket,subprocess,urllib.request
from PIL import Image,ImageStat
context=json.loads(sys.argv[1]);program=pathlib.Path(context['program']).read_bytes()
def deny(*args,**kwargs):raise RuntimeError('Offline Public audit forbids network, mutation, or execution')
def guard(event,args):
 if event in ('socket.connect','socket.bind','subprocess.Popen','os.system','os.exec','os.spawn','os.remove','os.rename','os.mkdir','os.rmdir','os.symlink','os.link'):deny()
 if event=='open' and len(args)>2 and isinstance(args[2],int) and args[2]&(os.O_WRONLY|os.O_RDWR|os.O_CREAT|os.O_TRUNC|os.O_APPEND):deny()
sys.addaudithook(guard)
socket.create_connection=deny;urllib.request.urlopen=deny;urllib.request.build_opener=deny
for key in ('run','Popen','call','check_call','check_output'):setattr(subprocess,key,deny)
g={'__name__':'offline_public_validator','__file__':context['program']};exec(compile(program,context['program'],'exec'),g)
for key in ('get','api','pages','lease','source_provider','verify_http','write','main','prepare','retain_api_pages'):g[key]=deny
c=g['config']();old=g['baseline'](c);state=g['unchanged_state'](c);candidate=g['validate_candidate'](c,context['consumer'])
recovery=None
if 'recovery' in c:
 assert callable(g.get('validate_recovery_material')) and callable(g.get('publication_provenance')),'Recovery requires its actual frozen pure validators'
 recovery=g['validate_recovery_material'](c,old,candidate,state['originalBuildInfoSha256'])
 assert state['recovery']==recovery
player=g['validate_public_player'](c,state);routes=g['validate_public_routes'](c,state)
if callable(g.get('publication_provenance')):value=g['publication_provenance'](c,state)
else:value={'publicationAccepted':False,'sourceCommit':c['sourceCommit'],'sourceTree':c['sourceTree'],'sourceReview':{'runId':c['sourceRun'],'runAttempt':c['sourceAttempt']},'sourceAcceptance':c['sourceAcceptance'],'sourceArtifacts':c['sourceArtifacts'],'producer':g['producer'](),'originalBuildInfoSha256':state['originalBuildInfoSha256'],'originalDistInventorySha256':g['sha'](g['encoded'](candidate)),'scope':'New consumer namespace only; all historical public files remain exact original bytes. Test SDK/checker packages are not shipped.'}
raw=(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n').encode();provenance={'path':g['PREFIX']+'publication-provenance.json','bytes':len(raw),'sha256':g['sha'](raw)}
images=[]
for folder,names in [('player',[r['path'] for r in player['screenshots']])]+[('native-'+key,[str(n)+'-finish.jpg' for n in levels]) for key,levels in g['GROUPS'].items()]:
 for name in names:
  file=pathlib.Path('proof')/folder/name
  with Image.open(file) as image:
   image.load();rgb=image.convert('RGB');small=rgb.resize((64,36));assert image.width>=100 and image.height>=100 and max(ImageStat.Stat(small).stddev)>1
   images.append({'path':folder+'/'+name,'width':image.width,'height':image.height,'format':image.format})
print(json.dumps({'candidate':candidate,'baseline':old,'player':player,'routes':routes,'provenance':provenance,'recovery':recovery,'decodedImages':images},ensure_ascii=False,separators=(',',':'),allow_nan=False))
`;

/** The Python module is read/executed only after full audit Git pinning. This
 * export also allows focused tests of the execution/mutation prohibitions. */
export function runReadOnlyPublisherValidators({program,workingDirectory,consumer,producer}){
 for(const file of [program,workingDirectory,consumer])assert.ok(typeof file==='string'&&path.isAbsolute(file));
 const result=spawnSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-B','-c',PYTHON_PURE,JSON.stringify({program,consumer})],{cwd:workingDirectory,env:{PATH:process.env.PATH,PYTHONDONTWRITEBYTECODE:'1',GITHUB_REF:'refs/heads/main',...producer},encoding:'utf8',maxBuffer:32_000_000,timeout:180000});
 assert.equal(result.error,undefined,'Local publisher validators did not complete');assert.equal(result.status,0,result.stderr||'Publisher pure validators rejected evidence');return parsePublicEvidenceJSON(result.stdout);
}

const git=(root,args)=>execFileSync('git',args,{cwd:root,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'},encoding:'utf8',maxBuffer:32_000_000}).trim();
function sameRetainedCopies(evidence,finalRoot){
 const pieces=[['v63-preparation',''],['v63-public-http',''],['v63-public-player','player/'],...Object.keys(GROUPS).map(group=>['v63-public-native-'+group,'native-'+group+'/'])];const expected=[];
 for(const[artifact,prefix]of pieces)for(const row of inventory(path.join(evidence,artifact))){const name=prefix+row.path;assert.deepEqual(rowFor(finalRoot,name),{...row,path:name},'Final artifact changed an earlier producer byte: '+name);expected.push(name);}
 const actual=inventory(finalRoot).map(row=>row.path),allowed=new Set([...expected,'final-publication.json',...inventory(path.join(finalRoot,'deployment-provider')).map(row=>'deployment-provider/'+row.path)]);
 assert.deepEqual(actual,[...allowed].sort(),'Final proof has extra or missing producer members');
 assert.deepEqual(inventory(path.join(evidence,'v63-deployment-lease')).map(row=>row.path),['before-deploy.json']);
}

export async function auditPublicProof({publisher,source,input,evidence,config,runId,runAttempt,commit,tree,consumer}={}){
 publisher=path.resolve(publisher);source=path.resolve(source);evidence=path.resolve(evidence);integer(runId,'Public run',1);integer(runAttempt,'Public attempt',1);assert.match(commit||'',/^[a-f0-9]{40}$/);assert.match(tree||'',/^[a-f0-9]{40}$/);
 assert.equal(git(publisher,['rev-parse','HEAD']),commit);assert.equal(git(publisher,['rev-parse','HEAD^{tree}']),tree);assert.equal(git(publisher,['status','--porcelain','--untracked-files=no']),'');
 const configPath=path.join(publisher,'tools/campaign-v63-release.json'),c=read(configPath);if(config!==undefined)assert.deepEqual(typeof config==='string'?read(path.resolve(config)):config,c);
 assert.equal(c.frozen,true,'Unfrozen proposal cannot be Public proof');assert.equal(c.publicationAccepted,false);assert.equal(c.repository,REPO);assert.equal(c.namespace,PREFIX);assert.equal(c.version,'v63-player-access-optics');assert.equal(c.sourceCommit,git(source,['rev-parse','HEAD']));assert.equal(c.sourceTree,git(source,['rev-parse','HEAD^{tree}']));assert.equal(git(source,['status','--porcelain','--untracked-files=no']),'');const lease=publicDeploymentLease(c);
 assert.ok(consumer&&typeof consumer.directory==='string'&&path.isAbsolute(consumer.directory),'Explicit absolute accepted consumer.directory required');const consumerDir=path.resolve(consumer.directory);
 const controllerNames=['scripts/publish-campaign-v63.py','scripts/observe-campaign-v63-public.mjs','.github/workflows/publish-campaign-v63.yml','tools/campaign-v63-release.json',c.sourceAcceptance.path,c.baselineCatalog];
 const controllers=controllerNames.map(name=>{const row=rowFor(publisher,name);assert.equal(row.sha256,hash(execFileSync('git',['show','HEAD:'+name],{cwd:publisher,maxBuffer:32_000_000})));return row;});
 assert.equal(rowFor(publisher,c.baselineCatalog).sha256,CATALOG_SHA);
 const finalRoot=path.join(evidence,'v63-final-public-proof');sameRetainedCopies(evidence,finalRoot);
 const state=read(path.join(finalRoot,'preparation.json')),final=read(path.join(finalRoot,'final-publication.json')),http=read(path.join(finalRoot,'public-http.json')),before=read(path.join(evidence,'v63-deployment-lease/before-deploy.json'));
 const producer={GITHUB_REPOSITORY:REPO,GITHUB_SHA:commit,GITHUB_RUN_ID:String(runId),GITHUB_RUN_ATTEMPT:String(runAttempt)},sourceReview={runId:c.sourceRun,runAttempt:c.sourceAttempt};
 assert.deepEqual(state.producer,producer);assert.equal(state.publicationAccepted,false);assert.equal(state.configSha256,hash(fs.readFileSync(configPath)));assert.deepEqual(http.producer,producer);assert.equal(http.pass,true);assert.equal(http.publicationAccepted,false);
 assert.equal(final.technicalChecksPassed,true);assert.equal(final.publicationAccepted,false);assert.equal(final.requiresIndependentRootAcceptance,true);assert.deepEqual(final.producer,producer);assert.equal(final.sourceCommit,c.sourceCommit);assert.equal(final.sourceTree,c.sourceTree);assert.deepEqual(final.sourceReview,sourceReview);assert.deepEqual(final.sourceArtifacts,c.sourceArtifacts);assert.deepEqual(final.nativeRouteScope,{normalUiZeroStepStartProven:false,resetCounterScope:RESET_SCOPE});assert.deepEqual(final.limitations,FINAL_LIMITATIONS);
 for(const value of [state.deploymentBefore,before.deployment]){assert.equal(value.deployment.id,lease.id);assert.equal(value.deployment.sha,lease.sha);assert.equal(value.statuses[0].state,'success');}
 assert.equal(before.publicationAccepted,false);const pagesArtifact=before.pagesArtifact;assert.equal(pagesArtifact.name,'github-pages');integer(pagesArtifact.id,'Pages artifact ID',1);integer(pagesArtifact.size_in_bytes,'Pages artifact size',1);assert.equal(pagesArtifact.expired,false);assert.match(pagesArtifact.digest||'',/^sha256:[0-9a-f]{64}$/);assert.equal(pagesArtifact.workflow_run.id,runId);assert.equal(pagesArtifact.workflow_run.head_sha,commit);
 assert.ok(typeof input==='string'&&path.isAbsolute(input),'Actual terminal provider input directory required');input=path.resolve(input);
 const providerBinding=assertPublicProviderBindings({jobs:providerPages(input,'jobs'),artifacts:providerPages(input,'artifacts'),finalJobs:final.publicJobs,pagesArtifact,runId,runAttempt,commit});
 assert.equal(fs.existsSync(path.join(input,'archives',pagesArtifact.id+'.zip')),false,'github-pages is metadata-only and must not be silently treated as downloaded');assert.equal(fs.existsSync(path.join(evidence,'github-pages')),false);
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'v63-public-proof-'));let verified;
 try{
  fs.symlinkSync(source,path.join(temporary,'source'),'dir');fs.symlinkSync(path.join(publisher,'tools'),path.join(temporary,'tools'),'dir');fs.symlinkSync(finalRoot,path.join(temporary,'proof'),'dir');
  verified=runReadOnlyPublisherValidators({program:path.join(publisher,'scripts/publish-campaign-v63.py'),workingDirectory:temporary,consumer:consumerDir,producer});
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
 assert.deepEqual(summary(verified.baseline),BASELINE);assert.deepEqual(state.baseline,httpSummary(verified.baseline));assert.deepEqual(state.candidateFiles,verified.candidate);assert.deepEqual(inventory(consumerDir),verified.candidate);
 const union=assertAppendOnlyInventory({baseline:verified.baseline,candidate:verified.candidate,union:state.unionFiles,provenance:verified.provenance});assert.deepEqual(http.union,{...union,method:'complete HTTP GET, exact length and SHA-256 for every file'});
 const recovery=assertRecoveryBindings({config:c,state,before,final,verified:verified.recovery,provenance:verified.provenance,currentProducer:producer});
 if(recovery){
  const expectedRecovery=['12261812300.zip','12262002314.zip','provider.json','v63-preparation/preparation.json','v63-public-http/public-http.json'].sort();assert.deepEqual(inventory(path.join(finalRoot,'recovery')).map(row=>row.path),expectedRecovery,'Recovery retained material is not the exact five-member closure');
  const originProvider=read(path.join(finalRoot,'recovery/provider.json'));assert.equal(originProvider.run.id,c.recovery.runId);assert.equal(originProvider.run.run_attempt,c.recovery.runAttempt);assert.equal(originProvider.run.head_sha,c.recovery.publisherCommit);assert.equal(originProvider.run.status,'completed');assert.equal(originProvider.run.conclusion,'failure');
 }
 const canaries=verified.baseline.filter(row=>['index.html','build-info.json','campaign-v62/build-info.json'].includes(row.path));assert.equal(canaries.length,3);assert.deepEqual(before.baseline,httpSummary(canaries));
 assert.equal(state.originalBuildInfoSha256,rowFor(consumerDir,'build-info.json').sha256);assert.equal(final.originalBuildInfoSha256,state.originalBuildInfoSha256);assert.equal(final.originalDistInventorySha256,summary(verified.candidate).inventorySha256);assert.equal(final.unionInventorySha256,union.inventorySha256);assert.equal(final.historicalFilesPreserved,BASELINE.files);assert.equal(final.historicalBytesPreserved,BASELINE.bytes);assert.deepEqual(final.publicRooms,Array.from({length:51},(_,i)=>i+1));assert.deepEqual(final.player,verified.player);assert.deepEqual(final.routeGroups,verified.routes);
 const jobs=['prepare','deploy','public-http','player',...Object.keys(GROUPS).map(group=>'native ('+group+')')];assert.deepEqual(final.publicJobs.map(row=>row.name).sort(),jobs.sort());for(const row of final.publicJobs){assert.equal(row.status,'completed');assert.equal(row.conclusion,'success');}
 const sourceProvider=state.sourceProvider;assertSourceProviderIdentity({config:c,provider:sourceProvider});assert.deepEqual(final.sourceJobs,sourceProvider.jobs);
 assert.equal(state.sourceArtifacts.length,c.sourceArtifacts.length);for(const[index,row]of state.sourceArtifacts.entries()){assert.deepEqual(row.provider,c.sourceArtifacts[index]);assertPublicInventory(row.files,2_000_000_000);assert.equal(row.inventorySha256,summary(row.files).inventorySha256);}assert.deepEqual(state.sourceArtifacts.find(row=>row.provider.name==='v63-dist').files,verified.candidate);
 const deployment=auditDeploymentSnapshot(path.join(finalRoot,'deployment-provider'),{producer,sourceCommit:c.sourceCommit,sourceTree:c.sourceTree,sourceReview,commit,runId,expected:final.deployment,previousDeploymentId:lease.id});assert.deepEqual(http.deployment.deployment,final.deployment.deployment);const finalStatuses=new Map(final.deployment.statuses.map(row=>[row.id,row]));for(const status of http.deployment.statuses)assert.deepEqual(finalStatuses.get(status.id),status,'Final status snapshot omitted or changed the earlier Public HTTP status');
 const load=relative=>import(pathToFileURL(path.join(source,relative)).href);
 const [{assertAtlasAccess,assertCompactPause,assertMobileControls,assertMigrationPhase},{V62_IMPORTED_PREFERENCES,v61HistoricalPreferenceFixture},{CAMPAIGN_V62_STORAGE_PREFIX,CAMPAIGN_PREFERENCE_KEY,CAMPAIGN_V63_STORAGE_PREFIX},{verifyReleaseMetadata},{assertPendulumPhysicalProof},{assertCastleImpulsePhysicalProof},{assertFoundation20Route}]=await Promise.all([load('scripts/lib/player-access-browser-proof.mjs'),load('scripts/lib/campaign-preferences-fixture.mjs'),load('src/game/LabCampaignStorage.js'),load('scripts/lib/release-manifest.mjs'),load('scripts/lib/tower41-pendulum-proof.mjs'),load('scripts/lib/castle-impulse-native-proof.mjs'),load('scripts/lib/foundation20-native-proof.mjs')]);
 verifyReleaseMetadata(read(path.join(consumerDir,'build-info.json')),{directory:consumerDir,root:source,commit:c.sourceCommit,run:String(c.sourceRun)});
 const report=read(path.join(finalRoot,'player/report.json')),playerBinding=read(path.join(finalRoot,'player/public-binding.json'));
 assertAtlasAccess(report.freshGuest.atlas,[]);for(const row of report.forgedQueries)assertAtlasAccess(row.atlas,[]);assertAtlasAccess(report.afterNextAtlas,[0]);assertAtlasAccess(report.reloaded.atlas,[0]);assertAtlasAccess(report.migratedAtlas,V62_IMPORTED_PREFERENCES.completed);assert.deepEqual(report.pause.viewport,{width:1024,height:768});assertCompactPause(report.pause);
 const historicalRaw=JSON.stringify(v61HistoricalPreferenceFixture(V62_IMPORTED_PREFERENCES),null,2),ownKey=CAMPAIGN_V63_STORAGE_PREFIX+CAMPAIGN_PREFERENCE_KEY;for(const phase of report.migration)assertMigrationPhase(phase,{phase:phase.phase,ownKey,historicalRaw});assert.equal(report.migrationFixture.key,CAMPAIGN_V62_STORAGE_PREFIX+CAMPAIGN_PREFERENCE_KEY);assert.equal(report.migrationFixture.sha256,hash(historicalRaw));
 for(const[index,row]of report.mobile.entries()){assertMobileControls(row);assert.deepEqual(row.viewport,index===0?{width:390,height:844}:{width:844,height:390});assert.equal(row.debugBridge,'undefined');assert.equal(row.horizontalOverflow,false);assert.ok(row.controls.every(control=>control.hit===true));}
 const win=report.firstRoomWin;assert.equal(win.fixture,false);assert.equal(win.before.index,0);assert.equal(win.before.steps,0);assert.equal(win.before.elapsed,0);assert.deepEqual(win.before.completed,[]);assert.equal(win.driver.pass,true);assert.equal(win.driver.resets,0);assert.equal(win.driver.respawns,0);assert.equal(win.after.index,0);assert.equal(win.after.state,'won');assert.equal(win.after.productionWon,true);assert.ok(win.after.steps>0);assert.deepEqual(win.after.completed,[0]);for(const key of ['cargoUUID','bodyId','shapeId'])assert.equal(win.after[key],win.before[key]);
 for(const[key,index,completed]of [['next',1,[0]],['reloaded',1,[0]],['replay',0,[0]]]){const row=report[key].observation||report[key];assert.equal(row.index,index);assert.deepEqual(row.completed,completed);}
 const playerNetwork=assertPublicNetwork({network:playerBinding.network,stamps:playerBinding.browserStampReads,rows:state.candidateFiles,stamp:state.originalBuildInfoSha256,pages:playerBinding.freshPages,entry:true});
 let routes=0;const networkGroups=[];
 for(const[group,levels]of Object.entries(GROUPS)){
  const directory=path.join(finalRoot,'native-'+group),native=read(path.join(directory,'report.json')),binding=read(path.join(directory,'public-binding.json'));assert.deepEqual(binding.driver,{path:'scripts/qa-creative-browser.mjs',sha256:rowFor(source,'scripts/qa-creative-browser.mjs').sha256});
  networkGroups.push({group,...assertPublicNetwork({network:binding.network,stamps:binding.browserStampReads,rows:state.candidateFiles,stamp:state.originalBuildInfoSha256,pages:levels.length})});
  for(const row of native.rows){assert.ok(row.route.frames>0);if(row.level===20)assertFoundation20Route(row.route.foundation20Proof??row.route);if(row.level===41){const marks=row.route.milestones;assertPendulumPhysicalProof(marks.find(mark=>mark.name==='Solved pendulum').physicsProof,row.start.cargoBodyId);assertCastleImpulsePhysicalProof(marks.find(mark=>mark.name==='Solved impulse').physicsProof,row.start.cargoBodyId);}routes++;}
 }
 assert.equal(routes,51);assert.equal(verified.decodedImages.length,56);for(const row of report.screenshots){const image=verified.decodedImages.find(image=>image.path==='player/'+row.path);assert.equal(image.format,'PNG');assert.equal(image.width,row.width);assert.equal(image.height,row.height);}
 return{kind:'offline-v63-public-terminal-proof-audit',pass:true,auditPassed:true,...SCOPES,publisher:{commit,tree,runId,runAttempt},source:{commit:c.sourceCommit,tree:c.sourceTree,...sourceReview},controllers,providerBinding,baseline:BASELINE,candidate:summary(verified.candidate),union,recovery,publicRooms:routes,playerNetwork,nativeNetworks:networkGroups,decodedImages:verified.decodedImages,deployment,githubPages:{provider:pagesArtifact,metadataOnlyNotDownloaded:true,bytesNotRead:true,zipDigestIndependentlyRecomputed:false,archiveCRCOrInventoryVerified:false},scope:'Offline validation of retained provider-bound producer artifacts with actual frozen publisher validators and Source pure contracts. No HTTP, build, browser, live mutation, independent post-CI deployment GET, or acceptance receipt.'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert.equal(process.argv[2],'--context','Use --context - with one JSON context on stdin');const context=parsePublicEvidenceJSON(fs.readFileSync(process.argv[3]&&process.argv[3]!=='-'?process.argv[3]:0,'utf8'));
 const result=await auditPublicProof(context);process.stdout.write(JSON.stringify(result)+'\n');
}
