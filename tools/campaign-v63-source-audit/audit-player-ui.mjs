/** Strict offline revalidation of the provider-retained current consumer UI
 * proof. This module does not run a browser or grant release acceptance. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {decodeEvidencePNG} from './audit-png.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const scopes={sourceAccepted:false,publicationAccepted:false,liveSdkAccepted:false,moderationAccepted:false,physicalPhonePerformanceAccepted:false};
const controllerPaths=['scripts/qa-player-access-browser.mjs','scripts/lib/player-access-browser-proof.mjs','scripts/lib/campaign-browser-contract.mjs','scripts/lib/campaign-preferences-fixture.mjs','scripts/lib/singularity-ui-check.mjs','scripts/lib/frozen-campaign-server.mjs','scripts/lib/release-manifest.mjs','scripts/lib/browser-response-lifecycle.mjs'];
const pngNames=['fresh-guest-atlas.png','first-room-real-win.png','compact-escape-pause.png','mobile-controls-portrait.png','mobile-controls-landscape.png'];
const artifactNames=[...pngNames,'report.json','binding.json','served-package.json','closed-file-inventory.json'].sort();
const object=(value,label)=>assert.ok(value&&typeof value==='object'&&!Array.isArray(value),label+' must be an object');
const integer=(value,label,min=0)=>assert.ok(Number.isSafeInteger(value)&&value>=min,label+' must be a safe integer >= '+min);
const digest=(value,label)=>assert.match(value||'',/^[0-9a-f]{64}$/,label+' must be a SHA256');
const assertScopes=value=>{for(const[key,wanted]of Object.entries(scopes))assert.equal(value[key],wanted,'Unexpected acceptance claim: '+key);};
/** JSON.parse silently keeps the final duplicate key. Audit retained bytes
 * with explicit duplicate/nonfinite/depth rejection before using their data. */
export function parsePlayerEvidenceJSON(text){
 assert.equal(typeof text,'string');assert.ok(Buffer.byteLength(text)<=32*1024*1024,'Evidence JSON exceeds the byte budget');
 let at=0,nodes=0;const whitespace=()=>{while(/[\t\n\r ]/.test(text[at]||'X'))at++;};
 const string=()=>{assert.equal(text[at],'"','Expected a JSON string');const start=at++;while(at<text.length){const code=text.charCodeAt(at);assert.ok(code>=32,'Control byte in JSON string');if(text[at]==='\\'){at+=2;continue;}if(text[at++]==='"')return JSON.parse(text.slice(start,at));}assert.fail('Unterminated JSON string');};
 const value=(depth=0)=>{
  assert.ok(depth<=100&&++nodes<=1000000,'Evidence JSON exceeds nesting/node bounds');whitespace();const c=text[at];
  if(c==='"')return string();
  if(c==='{'){
   at++;whitespace();const result=Object.create(null),keys=new Set();if(text[at]==='}'){at++;return result;}
   while(true){whitespace();const key=string();assert.equal(keys.has(key),false,'Duplicate evidence JSON key: '+key);keys.add(key);whitespace();assert.equal(text[at++],':','Missing JSON object colon');result[key]=value(depth+1);whitespace();const delimiter=text[at++];if(delimiter==='}')return result;assert.equal(delimiter,',','Missing JSON object separator');}
  }
  if(c==='['){at++;whitespace();const result=[];if(text[at]===']'){at++;return result;}while(true){result.push(value(depth+1));whitespace();const delimiter=text[at++];if(delimiter===']')return result;assert.equal(delimiter,',','Missing JSON array separator');}}
  for(const[token,result]of[['true',true],['false',false],['null',null]])if(text.startsWith(token,at)){at+=token.length;return result;}
  const match=text.slice(at).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);assert.ok(match,'Invalid evidence JSON token');at+=match[0].length;const result=Number(match[0]);assert.ok(Number.isFinite(result),'Nonfinite evidence JSON number');return result;
 };
 value();whitespace();assert.equal(at,text.length,'Trailing evidence JSON data');return JSON.parse(text);
}
const readJSON=filename=>parsePlayerEvidenceJSON(fs.readFileSync(filename,'utf8'));
const fileRow=(root,name)=>{assert.equal(typeof name,'string');assert.ok(name.length>0&&!name.includes('\\')&&!path.isAbsolute(name)&&!name.split('/').some(part=>!part||part==='.'||part==='..'),'Unsafe artifact member');const filename=path.join(root,name),stat=fs.lstatSync(filename);assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'Actual regular artifact file required: '+name);const bytes=fs.readFileSync(filename);return{path:name,bytes:bytes.length,sha256:hash(bytes)};};
const walk=root=>fs.readdirSync(root,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>{assert.equal(entry.isSymbolicLink(),false,'Symlinks are not retained evidence');const full=path.join(root,entry.name);return entry.isDirectory()?walk(full).map(name=>entry.name+'/'+name):[entry.name];}).sort();
const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32000000}).trim();

/** Bind every retained HTTP body to the exact observed request, not its URL.
 * Chrome's ERR_ABORTED is admissible only after this same request's complete
 * body was independently length/hash verified. Unread failures remain fatal. */
export function assertPlayerResponseLifecycle(context,{base,fileMap,durableBuffer}={}){
 object(context,'Actual browser response context');assert.equal(context.allReceivedBytesMatched,true);
 assert.deepEqual(context.capture,{kind:'actual-cdp-durable-response-buffer',...durableBuffer},'Actual durable CDP configuration differs from the committed controller');
 const lifecycle=context.lifecycle;object(lifecycle,'Actual response lifecycle');
 integer(lifecycle.documentGenerations,'Document generations',1);integer(lifecycle.activityGeneration,'Network activity generation',1);
 assert.equal(lifecycle.inflight,0,'Requests remain in flight');assert.equal(lifecycle.pending,0,'Response bodies remain pending');
 assert.ok(Array.isArray(lifecycle.drains)&&lifecycle.drains.length>=2,'Before-navigation and final context drains required');
 let generation=0,documentGeneration=0;
 for(const drain of lifecycle.drains){
  object(drain,'Actual settled response drain');assert.ok(['page.goto','page.reload','page.close','context.close','manual'].includes(drain.reason));
  integer(drain.documentGeneration,'Drain document generation');integer(drain.generation,'Drain starting activity');integer(drain.finishedGeneration,'Drain settled activity');
  assert.ok(drain.documentGeneration>=documentGeneration&&drain.documentGeneration<=lifecycle.documentGenerations);
  assert.ok(drain.generation>=generation&&drain.finishedGeneration>=drain.generation&&drain.finishedGeneration<=lifecycle.activityGeneration);
  assert.equal(drain.inflight,0);assert.equal(drain.pending,0);generation=drain.finishedGeneration;documentGeneration=drain.documentGeneration;
 }
 const final=lifecycle.drains.at(-1);assert.equal(final.reason,'context.close');assert.equal(final.documentGeneration,lifecycle.documentGenerations);assert.equal(final.finishedGeneration,lifecycle.activityGeneration);
 assert.ok(Array.isArray(lifecycle.requests)&&lifecycle.requests.length>0,'Actual request identity records required');
 assert.ok(Array.isArray(context.responses)&&context.responses.length>0,'Actual complete HTTP body records required');
 const requests=new Map(),identities=new Set();let skipped=0;
 for(const[index,request]of lifecycle.requests.entries()){
  object(request,'Actual request lifecycle record');assert.equal(request.requestOrdinal,index+1,'Request ordinals must preserve actual observation order');
  integer(request.documentGeneration,'Request document generation',1);assert.ok(request.documentGeneration<=lifecycle.documentGenerations);
  assert.ok(request.requestId===null||typeof request.requestId==='string'&&request.requestId.length>0);
  assert.equal(request.method,'GET');assert.ok(typeof request.resourceType==='string'&&request.resourceType.length>0);
  const url=new URL(request.url);assert.ok(request.failureText===null||request.failureText==='net::ERR_ABORTED','An actual request failed');
  if(request.verifiedBody!==null){
   assert.equal(typeof request.requestId,'string');const identity=request.documentGeneration+'\0'+request.requestId;
   assert.equal(identities.has(identity),false,'Ambiguous CDP request identity in one document');identities.add(identity);
   object(request.verifiedBody,'Complete body read proof');integer(request.verifiedBody.bytes,'Verified request body bytes',1);digest(request.verifiedBody.sha256,'Verified request body digest');
   assert.equal(request.verifiedBody.requestId,request.requestId,'Verified bytes belong to another actual request');assert.equal(request.responseStatus,200);
   assert.equal(request.outcome,request.failureText==='net::ERR_ABORTED'?'abortedWithCompleteVerifiedBody':'finishedWithCompleteVerifiedBody','Request failure was relabelled');
  }else{
   assert.equal(request.failureText,null,'An unread aborted request cannot be ignored');assert.equal(request.outcome,'finished','An unread response cannot count as verified');
   const ignored=['data:','blob:'].includes(url.protocol)||url.origin===base.origin&&url.pathname.endsWith('/favicon.ico')&&request.responseStatus===404;
   assert.ok(ignored,'Unverified ordinary HTTP request in a supposedly complete package observation');skipped++;
  }
  requests.set(request.requestOrdinal,request);
 }
 const seen=new Set(),counts={finishedWithCompleteVerifiedBody:0,abortedWithCompleteVerifiedBody:0};let cacheResponses=0;
 for(const response of context.responses){
  integer(response.requestOrdinal,'Response request ordinal',1);assert.equal(seen.has(response.requestOrdinal),false,'Duplicate actual response body record');seen.add(response.requestOrdinal);
  integer(response.documentGeneration,'Response document generation',1);assert.ok(typeof response.requestId==='string'&&response.requestId.length>0);assert.equal(typeof response.fromCache,'boolean');if(response.fromCache)cacheResponses++;
  const request=requests.get(response.requestOrdinal);assert.ok(request,'No exact observed request for this response body');
  assert.equal(request.requestId,response.requestId,'Response body matched another CDP request');assert.equal(request.documentGeneration,response.documentGeneration,'Response belongs to another document');assert.equal(request.url,response.url);
  assert.deepEqual(request.verifiedBody,{requestId:response.requestId,bytes:response.bytes,sha256:response.sha256},'Response bytes differ from this exact request body');
  assert.equal(response.requestOutcome,request.outcome);assert.equal(response.requestFailureText,request.failureText);assert.ok(Object.hasOwn(counts,request.outcome));counts[request.outcome]++;
  const expected=fileMap.get(response.path);assert.ok(expected,'Browser received a file outside the consumer package');assert.equal(response.status,200);assert.equal(response.bytes,expected.bytes);assert.equal(response.sha256,expected.sha256);
  const url=new URL(response.url);assert.equal(url.origin,base.origin);assert.ok(url.pathname.startsWith(base.pathname));assert.equal(decodeURIComponent(url.pathname.slice(base.pathname.length))||'index.html',response.path);
 }
 assert.equal(seen.size,lifecycle.requests.filter(request=>request.verifiedBody!==null).length,'Verified requests missing their actual response rows');
 assert.deepEqual(context.requestOutcomeCounts,counts,'Reported completed/aborted request counts differ from actual exact-request records');
 return{url:context.url,documentGenerations:lifecycle.documentGenerations,requests:lifecycle.requests.length,responses:context.responses.length,requestOutcomeCounts:counts,skippedNoncandidateRequests:skipped,fromCacheResponses:cacheResponses,settledDrains:lifecycle.drains.length};
}

export async function auditPlayerUI({source,evidence,commit,tree,runId,runAttempt,consumer,sourceInputs,sourceInputsSha256}={}){
 source=path.resolve(source);evidence=path.resolve(evidence);assert.match(commit||'',/^[0-9a-f]{40}$/);assert.match(tree||'',/^[0-9a-f]{40}$/);
 runId=Number(runId);runAttempt=Number(runAttempt);integer(runId,'Provider run ID',1);integer(runAttempt,'Provider attempt',1);
 assert.equal(git(source,['rev-parse','HEAD']),commit,'Audit source checkout HEAD differs');assert.equal(git(source,['rev-parse','HEAD^{tree}']),tree,'Audit source checkout tree differs');
 assert.ok(Array.isArray(sourceInputs)&&sourceInputs.length>0);digest(sourceInputsSha256,'Actual source input digest');assert.equal(hash(JSON.stringify(sourceInputs)),sourceInputsSha256);
 object(consumer,'Verified consumer package');assert.equal(consumer.commit,commit);assert.equal(consumer.info.commit,commit);assert.equal(consumer.info.sourceInputsSha256,sourceInputsSha256);assert.equal(consumer.sourceInputsSha256,sourceInputsSha256);
 assert.deepEqual(consumer.files,consumer.info.files);assert.equal(consumer.packageFilesSha256,consumer.info.packageFilesSha256);assert.equal(hash(JSON.stringify(consumer.files)),consumer.packageFilesSha256);
 integer(consumer.buildInfoBytes,'Actual consumer build-info byte length',1);digest(consumer.buildInfoSha256,'Actual consumer build-info digest');
 const consumerInfoBytes=fs.readFileSync(path.join(consumer.directory,'build-info.json'));assert.equal(consumerInfoBytes.length,consumer.buildInfoBytes);assert.equal(hash(consumerInfoBytes),consumer.buildInfoSha256);assert.deepEqual(JSON.parse(consumerInfoBytes),consumer.info);
 for(const file of consumer.files)assert.deepEqual(fileRow(consumer.directory,file.path),file,'Verified consumer file differs from retained bytes');
 const artifact=path.join(evidence,'v63-player-ui');assert.ok(fs.lstatSync(artifact).isDirectory()&&!fs.lstatSync(artifact).isSymbolicLink());
 assert.deepEqual(walk(artifact),artifactNames,'Player UI artifact is not the exact closed success output');
 const inventory=readJSON(path.join(artifact,'closed-file-inventory.json')),binding=readJSON(path.join(artifact,'binding.json')),report=readJSON(path.join(artifact,'report.json')),served=readJSON(path.join(artifact,'served-package.json'));
 for(const document of[inventory,binding,report,served])assertScopes(document);
 assert.equal(inventory.kind,'closed-player-access-artifacts');assert.equal(inventory.sourceCommit,commit);assert.equal(inventory.sourceTree,tree);assert.equal(inventory.runId,runId);assert.equal(inventory.runAttempt,runAttempt);assert.equal(inventory.inventoryExcludesItself,true);
 const actualInventory=artifactNames.filter(name=>name!=='closed-file-inventory.json').map(name=>fileRow(artifact,name));assert.deepEqual(inventory.files,actualInventory,'Closed player UI inventory differs from actual provider members');
 assert.equal(binding.kind,'current-consumer-player-access-package');assert.deepEqual(binding.source,{commit,tree,sourceInputsSha256,sourceInputFiles:sourceInputs.length});assert.equal(binding.runId,runId);assert.equal(binding.runAttempt,runAttempt);
 const controllerFiles=controllerPaths.map(name=>{const bytes=fs.readFileSync(path.join(source,name));assert.deepEqual(bytes,execFileSync('git',['show','HEAD:'+name],{cwd:source,maxBuffer:32000000}),'Controller differs from Source commit: '+name);return{path:name,bytes:bytes.length,sha256:hash(bytes)};});
 assert.deepEqual(binding.controller,{commit,tree,files:controllerFiles,filesSha256:hash(JSON.stringify(controllerFiles)),trackedWorkingTreeClean:true});
 assert.deepEqual(binding.package,{commit,version:consumer.info.version,buildInfoBytes:consumer.buildInfoBytes,buildInfoSha256:consumer.buildInfoSha256,packageFilesSha256:consumer.packageFilesSha256,files:consumer.files,fileCount:consumer.files.length,totalBytes:consumer.files.reduce((n,file)=>n+file.bytes,0)});
 const expectedFiles=[...consumer.files,{path:'build-info.json',bytes:consumer.buildInfoBytes,sha256:consumer.buildInfoSha256}],fileMap=new Map(expectedFiles.map(file=>[file.path,file]));assert.equal(fileMap.size,expectedFiles.length);
 assert.deepEqual(served,{sourceCommit:commit,sourceTree:tree,allHTTPFilesVerified:true,files:expectedFiles.map(file=>({...file,status:200})),...scopes},'Complete served HTTP package observations differ');
 const load=async relative=>import(pathToFileURL(path.join(source,relative)).href);
 const[{assertAtlasAccess,assertCompactPause,assertMobileControls,assertMigrationPhase},{assertStampedCampaignInfo,assertCampaignBrowserState},{FOUNDATION_SEQUENCE,foundationDisplayNumber},{ACTIVE_FOUNDATION_RUNTIME_FLAGS,RELEASE_VERSION},{campaignSpec},{V62_IMPORTED_PREFERENCES,v61HistoricalPreferenceFixture},{CAMPAIGN_PREFERENCE_KEY,CAMPAIGN_V62_STORAGE_PREFIX,foundationCampaignPrefix},{buildSourceInputs,verifyReleaseMetadata},{DURABLE_RESPONSE_BUFFER}]=await Promise.all([
  load('scripts/lib/player-access-browser-proof.mjs'),load('scripts/lib/campaign-browser-contract.mjs'),load('src/game/LabCampaignSequence.js'),load('src/game/ReleaseIdentity.js'),load('src/game/LabCampaignLevels.js'),load('scripts/lib/campaign-preferences-fixture.mjs'),load('src/game/LabCampaignStorage.js'),load('scripts/lib/release-manifest.mjs'),load('scripts/lib/browser-response-lifecycle.mjs')]);
 assert.deepEqual(buildSourceInputs(source),sourceInputs,'Actual Source production inputs differ from the parent verified inventory');
 verifyReleaseMetadata(consumer.info,{directory:consumer.directory,commit,root:source,run:consumer.info.run});
 assertStampedCampaignInfo(consumer.info,commit);assert.equal(RELEASE_VERSION,consumer.info.version);
 assert.equal(report.kind,'actual-consumer-player-access-browser-proof');assert.equal(report.pass,true);assert.equal(report.stage,'complete');assert.deepEqual(report.errors,[]);assert.deepEqual(report.networkFailures??[],[]);assert.equal(report.sourceCommit,commit);assert.equal(report.sourceTree,tree);assert.equal(Object.hasOwn(report,'failure'),false);
 object(report.browser,'Actual browser identity');assert.match(report.browser.product,/Chrome|Chromium/i);assert.equal(typeof report.browser.userAgent,'string');assert.ok(report.browser.userAgent.length>20);
 const base=new URL(report.url);assert.ok(['http:','https:'].includes(base.protocol));assert.equal(base.search,'');assert.equal(base.hash,'');
 const ownPrefix=foundationCampaignPrefix(base.pathname),ownKey=ownPrefix+CAMPAIGN_PREFERENCE_KEY;assert.equal(ownPrefix,'brainrot-campaign-'+RELEASE_VERSION.split('-')[0]+':');assert.equal(ownPrefix,'brainrot-campaign-v63:');
 const debugURL=new URL(base);debugURL.searchParams.set('debug','1');
 const privateWrites=value=>{assert.ok(Array.isArray(value));assert.ok(value.every(write=>write&&write.method==='setItem'&&write.key===ownKey),'Browser wrote outside the private candidate preferences');};
 const observation=(value,{index,state,completed,debug=true,resume=index}={})=>{
  object(value,'Actual browser observation');assert.equal(value.index,index);assert.equal(value.selectedIndex,index);assert.equal(value.state,state);assert.equal(value.optionCount,51);privateWrites(value.writes);
  if(state==='playing')assert.ok(value.writes.length>0,'An actual Play action must retain private persistence instrumentation');
  if(debug){assert.deepEqual(value.completed,completed);assertCampaignBrowserState(value.runtime,index+1);}else{assert.equal(value.completed,null);assert.equal(value.runtime,null);}
  if(value.ownRaw!==null){assert.equal(typeof value.ownRaw,'string');const own=JSON.parse(value.ownRaw);assert.deepEqual(own.completed,completed);if(state==='playing'||state==='ready'&&completed.length)assert.equal(own.resumeLevel,resume);}
  else assert.ok(state==='ready'&&completed.length===0,'An actual action should persist candidate progress');
 };
 assert.equal(report.freshGuest.url,base.href);observation(report.freshGuest.observation,{index:0,state:'ready',completed:[],debug:false});assertAtlasAccess(report.freshGuest.atlas,[]);
 const queries=[{level:'51'},{pilot:'43'},{pilot:'progression'},{tower41preview:'1'}];assert.ok(Array.isArray(report.forgedQueries));assert.deepEqual(report.forgedQueries.map(row=>row.query),queries);
 const responseURLs=[base.href];
 for(const[rowIndex,query]of queries.entries()){
  const row=report.forgedQueries[rowIndex],url=new URL(debugURL);for(const[key,value]of Object.entries(query))url.searchParams.set(key,value);assert.equal(row.url,url.href);responseURLs.push(url.href);
  observation(row.ready,{index:0,state:'ready',completed:[]});assertAtlasAccess(row.atlas,[]);observation(row.playing,{index:0,state:'playing',completed:[]});assert.ok(row.playing.writes.length>row.ready.writes.length,'Play did not append an observed private write');assert.deepEqual(row.playing.writes.slice(0,row.ready.writes.length),row.ready.writes,'Play write log lost startup observations');
 }
 const dom=report.closedDomSelection;object(dom,'Closed DOM selection observation');assert.equal(dom.requestedIndex,50);assert.equal(dom.changeEventDispatched,false);assert.ok(['ready','playing'].includes(dom.afterForbiddenPlay.state));observation(dom.afterForbiddenPlay,{index:0,state:dom.afterForbiddenPlay.state,completed:[]});observation(dom.playing,{index:0,state:'playing',completed:[]});if(dom.afterForbiddenPlay.state==='ready'){assert.ok(dom.playing.writes.length>dom.afterForbiddenPlay.writes.length);assert.deepEqual(dom.playing.writes.slice(0,dom.afterForbiddenPlay.writes.length),dom.afterForbiddenPlay.writes);}responseURLs.push(debugURL.href);
 const win=report.firstRoomWin;object(win,'Genuine first room win');assert.equal(win.fixture,false);assert.equal(typeof win.schedulerOnly,'string');assert.ok(win.schedulerOnly.includes('no actor/goal/completion assignments'));
 const identity=value=>{object(value,'Actual game identity');integer(value.index,'Permanent room index');integer(value.steps,'Physics step');assert.equal(typeof value.cargoUUID,'string');assert.ok(value.cargoUUID.length>=10);integer(value.bodyId,'Cargo body ID');integer(value.shapeId,'Cargo shape ID');};
 identity(win.before);assert.equal(win.before.index,0);assert.equal(win.before.state,'playing');assert.equal(win.before.steps,0);assert.equal(win.before.elapsed,0);assert.deepEqual(win.before.completed,[]);
 identity(win.after);assert.equal(win.after.index,0);assert.equal(win.after.state,'won');assert.equal(win.after.productionWon,true);assert.ok(win.after.steps>0);assert.deepEqual(win.after.completed,[0]);
 for(const key of['cargoUUID','bodyId','shapeId'])assert.equal(win.after[key],win.before[key],'Original cargo identity changed during the actual win');
 const driver=win.driver;object(driver,'Actual compiled ordinary input driver');assert.equal(driver.pass,true);assert.equal(driver.level,1);assert.equal(driver.id,campaignSpec({chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS},0).id);assert.equal(driver.resets,0);assert.equal(driver.respawns,0);integer(driver.frames,'Ordinary driver frame count',1);integer(driver.teleports,'Ordinary portal transport count',1);assert.ok(Array.isArray(driver.milestones)&&driver.milestones.length>=2);
 for(const milestone of driver.milestones){assert.equal(typeof milestone.name,'string');for(const key of['player','cargo'])assert.ok(Array.isArray(milestone[key])&&milestone[key].length===3&&milestone[key].every(Number.isFinite));integer(milestone.teleports,'Milestone portal transports');}
 assert.equal(driver.milestones.at(-1).name,'both at exit');observation(report.next.observation,{index:1,state:'playing',completed:[0]});responseURLs.push(debugURL.href);
 assert.deepEqual(report.pause.viewport,{width:1024,height:768});assertCompactPause(report.pause);assert.equal(report.pause.nextFocusId,'restart-button');assert.equal(report.pause.hint.open,true);assert.equal(report.pause.hint.buttonVisible,true);assert.equal(typeof report.pause.hint.text,'string');assert.ok(report.pause.hint.text.length>20);assertAtlasAccess(report.afterNextAtlas,[0]);
 const returned=report.atlasReturn;assert.equal(returned.sameLevelAndActors,true);assert.equal(returned.frozenPhysicsWhileAtlasOpen,true);assert.equal(returned.continuingPhysicsAfterReturn,true);
 for(const key of['before','inAtlas','viaBack','secondBefore','secondInAtlas','viaEscape']){identity(returned[key]);assert.equal(returned[key].index,1);for(const field of['cargoUUID','bodyId','shapeId'])assert.equal(returned[key][field],returned.before[field]);}
 assert.equal(returned.before.state,'paused');assert.ok(returned.before.steps>0);assert.equal(returned.inAtlas.state,'ready');assert.equal(returned.inAtlas.steps,returned.before.steps);assert.equal(returned.viaBack.state,'playing');assert.ok(returned.viaBack.steps>returned.before.steps);
 assert.equal(returned.secondBefore.state,'paused');assert.ok(returned.secondBefore.steps>=returned.viaBack.steps);assert.equal(returned.secondInAtlas.state,'ready');assert.equal(returned.secondInAtlas.steps,returned.secondBefore.steps);assert.equal(returned.viaEscape.state,'playing');assert.ok(returned.viaEscape.steps>returned.secondBefore.steps);
 observation(report.reloaded.observation,{index:1,state:'ready',completed:[0]});assertAtlasAccess(report.reloaded.atlas,[0]);observation(report.replay,{index:0,state:'playing',completed:[0]});
 const historicalRaw=JSON.stringify(v61HistoricalPreferenceFixture(V62_IMPORTED_PREFERENCES),null,2),historicalKey=CAMPAIGN_V62_STORAGE_PREFIX+CAMPAIGN_PREFERENCE_KEY;
 assert.deepEqual(report.migrationFixture,{label:'Explicit accepted-v62 historical migration fixture; not fresh-guest playthrough evidence',key:historicalKey,bytes:Buffer.byteLength(historicalRaw),sha256:hash(historicalRaw),completed:[...V62_IMPORTED_PREFERENCES.completed],targetIndex:2,targetCompleted:false});
 assert.ok(Array.isArray(report.migration));assert.deepEqual(report.migration.map(row=>row.phase),['initial','settings','playing','reloaded']);for(const row of report.migration)assertMigrationPhase(row,{phase:row.phase,ownKey,historicalRaw});assertAtlasAccess(report.migratedAtlas,[...V62_IMPORTED_PREFERENCES.completed]);responseURLs.push(debugURL.href);
 const expectedHints=FOUNDATION_SEQUENCE.map(index=>{const room=campaignSpec({chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS},index);assert.equal(room.hints.length,3);assert.equal(new Set(room.hints).size,3);assert.ok(room.hints.every(text=>typeof text==='string'&&text.trim().length>10));return{index,number:foundationDisplayNumber(index),id:room.id,tiers:3,textSha256:hash(JSON.stringify(room.hints))};});assert.deepEqual(report.hintCatalogue,expectedHints,'Current Source hint metadata differs');
 assert.ok(Array.isArray(report.mobile)&&report.mobile.length===2);const viewports=[{width:390,height:844},{width:844,height:390}];
 for(const[index,row]of report.mobile.entries()){
  assert.deepEqual(row.viewport,viewports[index]);assertMobileControls(row);assert.equal(row.horizontalOverflow,false);assert.equal(row.debugBridge,'undefined');assert.ok(row.controls.every(control=>control.hit===true),'Phone buttons were not actual hit targets');assert.equal(row.screenshot,index===0?'mobile-controls-portrait.png':'mobile-controls-landscape.png');responseURLs.push(base.href);
 }
 assert.ok(Array.isArray(report.browserResponses));assert.equal(report.browserResponses.length,responseURLs.length,'Missing browser context response evidence');
 let responseCount=0;const browserResponseLifecycle=[],requestOutcomeCounts={finishedWithCompleteVerifiedBody:0,abortedWithCompleteVerifiedBody:0};
 for(const[index,context]of report.browserResponses.entries()){
  assert.equal(context.url,responseURLs[index]);assert.equal(context.allReceivedBytesMatched,true);assert.ok(Array.isArray(context.responses)&&context.responses.length>0);
  assert.ok(context.responses.some(row=>row.path==='index.html'));assert.ok(context.responses.some(row=>row.path.endsWith('.js')));assert.ok(context.responses.some(row=>row.path.endsWith('.css')));assert.ok(context.responses.some(row=>row.path.endsWith('.glb')));
  const lifecycle=assertPlayerResponseLifecycle(context,{base,fileMap,durableBuffer:DURABLE_RESPONSE_BUFFER});browserResponseLifecycle.push(lifecycle);responseCount+=lifecycle.responses;for(const key of Object.keys(requestOutcomeCounts))requestOutcomeCounts[key]+=lifecycle.requestOutcomeCounts[key];
 }
 assert.ok(report.browserResponses[6].responses.some(row=>/^assets\/LabV8Journey-[A-Za-z0-9_-]+\.js$/.test(row.path)),'Actual first-room browser did not receive the exact compiled driver');
 assert.ok(Array.isArray(report.screenshots));assert.deepEqual(report.screenshots.map(row=>row.path),pngNames);const decodedScreens=[];
 for(const[index,row]of report.screenshots.entries()){
  assert.deepEqual(row,{...fileRow(artifact,row.path),width:index<3?1024:index===3?390:844,height:index<3?768:index===3?844:390,capture:'Puppeteer page.screenshot includes actual HTML UI'});
  const decoded=decodeEvidencePNG(fs.readFileSync(path.join(artifact,row.path)),{width:row.width,height:row.height});assert.ok(decoded.nonUniformPixels>0);assert.ok(decoded.opaquePixels>0);decodedScreens.push({path:row.path,...decoded});
 }
 assert.deepEqual(binding.evidence,{report:fileRow(artifact,'report.json'),screenshots:report.screenshots},'Binding does not cover the actual report and screenshots');
 return{kind:'offline-current-player-ui-audit',auditPassed:true,...scopes,artifact:'v63-player-ui',sourceCommit:commit,sourceTree:tree,runId,runAttempt,sourceCheckoutChecked:true,controllerFiles:controllerFiles.length,packageFilesSha256:consumer.packageFilesSha256,closedArtifactFiles:artifactNames.length,servedHTTPFiles:expectedFiles.length,actualBrowserContexts:report.browserResponses.length,actualBrowserResponses:responseCount,requestOutcomeCounts,browserResponseLifecycle,atlasRooms:51,actualFirstRoomWin:{level:1,frames:driver.frames,teleports:driver.teleports,resetCounts:{reset:driver.resets,respawn:driver.respawns},sameOriginalCargo:true},migrationPhases:report.migration.map(row=>row.phase),hintRooms:expectedHints.length,hintTiers:expectedHints.length*3,decodedScreenshots:decodedScreens,scope:'Offline validation of retained provider observations, pinned Source validators, exact consumer response hashes/actual request identities and decoded full-page PNGs; ERR_ABORTED only with a complete independently verified body for that same CDP request/document. No fresh browser rerun, visual human acceptance, Source acceptance, publication or live-platform acceptance.'};
}
