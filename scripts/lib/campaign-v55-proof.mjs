import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const GROUPS=Object.freeze({early:Array.from({length:10},(_,i)=>i+1),energy:Array.from({length:10},(_,i)=>i+11),
 living:Array.from({length:10},(_,i)=>i+21),optics:Array.from({length:10},(_,i)=>i+31),fracture:Array.from({length:10},(_,i)=>i+42),castle:[41]});
export const SEQUENCE=Object.freeze([...GROUPS.early,...GROUPS.energy,...GROUPS.living,...GROUPS.optics,...GROUPS.fracture,41]);
export const SHORTCUT_CASES=Object.freeze(['empty-direct-sprint','held-direct-sprint','held-corner-jumps','early-release-finish-directed-shots']);
export const CASTLE_STAGES=Object.freeze(['freight','sluice','optics','hoist','archive','flywheel','magnet','migrant','pendulum','inertia','crown']);
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const digestRows=rows=>sha(Buffer.from(JSON.stringify(rows)));
const positive=n=>Number.isFinite(n)&&n>0;
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);

export function inventory(root,{maximum=100_000_000}={}){
 root=path.resolve(root);assert.ok(fs.statSync(root).isDirectory());let bytes=0;const rows=[];
 function visit(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
  const file=path.join(directory,entry.name),st=fs.lstatSync(file);assert.equal(st.isSymbolicLink(),false,'Symlink in frozen bytes');
  if(st.isDirectory())visit(file);else{assert.equal(st.isFile(),true,'Special file in frozen bytes');const relative=path.relative(root,file).split(path.sep).join('/');
   assert.ok(relative&&!relative.startsWith('../')&&!relative.includes('\\'));bytes+=st.size;assert.ok(bytes<=maximum,'Frozen bytes exceed resource limit');
   rows.push({path:relative,bytes:st.size,sha256:sha(fs.readFileSync(file))});}}
 }visit(root);return rows.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
export function assertFrozenCheckout(root,expected){
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 assert.equal(git('rev-parse','HEAD'),expected.sourceCommit);assert.equal(git('rev-parse','HEAD^{tree}'),expected.sourceTree);
 assert.equal(git('rev-parse','HEAD^'),expected.sourceParent);assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 assert.equal(git('status','--porcelain','--untracked-files=all','--','src','public','index.html','vite.config.js','package.json','package-lock.json'),'');
 return true;
}
export async function assertSourcePackage(root,directory,expected){
 assertFrozenCheckout(root,expected);
 const helper=await import(pathToFileURL(path.join(root,'scripts/lib/release-manifest.mjs')));
 const manifest=JSON.parse(fs.readFileSync(path.join(directory,'build-info.json'),'utf8'));
 helper.verifyReleaseMetadata(manifest,{directory,commit:expected.sourceCommit,root,run:String(expected.sourceReview.runId)});
 assert.deepEqual(manifest.rooms.map(room=>room.stableLevel),SEQUENCE);assert.deepEqual(manifest.rooms.map(room=>room.level),Array.from({length:51},(_,i)=>i+1));
 const packageHelper=await import(pathToFileURL(path.join(root,'scripts/v8-package-check.mjs')));packageHelper.verifyCampaignPackage(directory);
 const files=inventory(directory);const active=files.filter(row=>/^models\/runtime\/model-\d+.*\.glb$/.test(row.path));assert.equal(active.length,14);
 assert.deepEqual(files.filter(row=>row.path.startsWith('draco/')).map(row=>row.path),['draco/draco_decoder.js','draco/draco_decoder.wasm','draco/draco_wasm_wrapper.js']);
 assert.deepEqual(active.map(row=>Number(row.path.match(/model-(\d+)/)[1])).sort((a,b)=>a-b),[1,2,11,19,22,23,24,28,29,31,32,35,37,39]);
 assert.ok(active.reduce((n,row)=>n+row.bytes,0)<4_000_000,'Active model budget changed');
 for(const row of [...active,...files.filter(row=>row.path.startsWith('draco/'))]){
  const originalPath=row.path.startsWith('models/')?'public/models/runtime/'+path.basename(row.path):'public/'+row.path;
  assert.equal(expected.modelOriginCommit,'3f2e83127dfd5800068854a98843d73eb9377609','The independently accepted R5 model origin is required');
  const parent=execFileSync('git',['show',expected.modelOriginCommit+':'+originalPath],{cwd:root,maxBuffer:20_000_000});
  assert.equal(parent.length,row.bytes);assert.equal(sha(parent),row.sha256,'Accepted R5 model/Draco bytes changed');
 }
 return {manifest,files,bytes:files.reduce((n,row)=>n+row.bytes,0),inventorySha256:digestRows(files)};
}
function roomFor(manifest,level){const room=manifest.rooms.find(room=>room.stableLevel===level);assert.ok(room);return room;}
export function assertReportedPackage(report,manifest){
 assert.deepEqual(report.package,{commit:manifest.commit,version:manifest.version,editionVersion:manifest.editionVersion,sourceInputsSha256:manifest.sourceInputsSha256});
}
export function assertCastleMilestones(milestones,{stages=CASTLE_STAGES}={}){
 assert.ok(Array.isArray(milestones));const solved=milestones.filter(mark=>typeof mark.name==='string'&&/^Solved /.test(mark.name));
 assert.deepEqual(solved.map(mark=>mark.name.slice(7)),stages,'The exact continuous castle stage prefix is required');
 for(let i=0;i<solved.length;i++){const mark=solved[i];assert.ok(Number.isFinite(mark.frame)&&mark.frame>=0);if(i)assert.ok(mark.frame>solved[i-1].frame);
  for(const key of ['player','cargo'])if(key in mark)assert.ok(vector(mark[key]),'Castle milestone has invalid actor coordinates');}
 return solved.length;
}
export function assertOrdinaryReport(report,levels,manifest,sourceCommit,{assertPhysical20}={}){
 assert.equal(report.sourceCommit,sourceCommit);assert.equal(report.pass,true);assert.equal(report.active,undefined);assert.equal(report.failure,undefined);
 assert.deepEqual(report.runtime,manifest.runtimeConfig);assert.deepEqual(report.selected,levels);assert.deepEqual(report.rows.map(row=>row.stableLevel),levels);
 for(const row of report.rows){const expected=roomFor(manifest,row.stableLevel);assert.equal(row.number,expected.level);assert.equal(row.id,expected.id);
  assert.equal(row.pass,true);assert.equal(row.state,'won');assert.equal(row.sameOriginal,true);assert.equal(row.resets,0);assert.equal(row.respawns,0);
  assert.ok(positive(row.frames));assert.ok(row.steps===null||positive(row.steps));assert.equal(row.error,undefined);assert.ok(Array.isArray(row.milestones)&&row.milestones.length>0);
  if(row.stableLevel===20){assert.equal(typeof assertPhysical20,'function');assertPhysical20(row.foundation20Proof);assert.equal(row.foundation20Proof.frames,row.frames);assert.equal(row.foundation20Proof.finish.state,row.state);assert.equal(row.foundation20Proof.cargoResets,0);}
  if(row.stableLevel===41)assertCastleMilestones(row.milestones);
 }return {rooms:levels.length,completeOriginalCompanionWins:true};
}
export function assertNativeReport(report,levels,manifest,sourceCommit,{assertRuntime,assertImage,assertPhysical20}={}){
 assert.equal(typeof assertRuntime,'function');assert.equal(typeof assertImage,'function');
 assertReportedPackage(report,manifest);
 assert.equal(report.sourceCommit,sourceCommit);assert.equal(report.mode,'route');assert.equal(report.strictCapture,true);
 assert.equal(report.pass,true);assert.equal(report.capturePass,true);assert.deepEqual(report.errors,[]);assert.equal(report.active,undefined);
 assert.deepEqual(report.rows.map(row=>row.level),levels);
 for(const row of report.rows){const expected=roomFor(manifest,row.level);assert.equal(row.pass,true);assert.equal(row.gameplayPassed,true);assert.equal(row.capturePass,true);
  assert.deepEqual(row.errors,[]);assert.equal(row.error,undefined);assertRuntime(row.start,row.level);assert.equal(row.visibleRoom,expected.level);assert.deepEqual(row.start.missingModels,[]);
  assert.equal(row.route.pass,true);assert.equal(row.route.state,'won');assert.equal(row.route.sameCompanion,true);assert.equal(row.route.sameCargoShape,true);assert.ok(positive(row.route.frames));
  assert.equal(row.route.cargoUUID,row.start.cargoUUID);assert.equal(row.route.cargoBodyId,row.start.cargoBodyId);assert.equal(row.route.resets??0,0);assert.equal(row.route.respawns??0,0);
  assert.deepEqual(Object.keys(row.captures),['finish']);const finish=row.captures.finish;assert.equal(finish.ok,true);assert.equal(finish.includesHTML,false);
  assert.ok(positive(finish.renderer?.calls)&&positive(finish.renderer?.triangles));assert.ok(finish.renderer.width>=100&&finish.renderer.height>=100);
  if(finish.frame){assert.equal(finish.frame.levelIndex,row.level-1);assert.equal(finish.frame.state,'won');assert.equal(finish.frame.cargoUUID,row.start.cargoUUID);assert.equal(finish.frame.cargoBodyId,row.start.cargoBodyId);assert.ok(vector(finish.frame.player)&&vector(finish.frame.cargo));}
  assertImage(row.level+'-finish.jpg',finish);
  if(row.level===20){assert.equal(typeof assertPhysical20,'function');assertPhysical20(row.route.foundation20Proof);assert.equal(row.route.cargoResets,0);assert.equal(row.route.foundation20Proof.frames,row.route.frames);assert.equal(row.route.foundation20Proof.cargoBodyId,row.start.cargoBodyId);}
  if(row.level===41)assertCastleMilestones(row.route.milestones);
 }return {rooms:levels.length,finishedProductionFrames:levels.length,routeMovies:0};
}
export function assertCpuReport(report,tap,providerLog,{part,allFiles,sourceCommit}){
 assert.equal(report.sourceCommit,sourceCommit);assert.equal(report.part,part);assert.equal(report.parts,6);assert.deepEqual(report.allFiles,allFiles);
 assert.deepEqual(report.files,allFiles.filter((_,i)=>i%6===part).map(file=>'tests/'+file));assert.equal(report.code,0);assert.equal(report.signal,null);assert.equal(report.pass,true);
 const counts=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(key=>{const values=[...tap.matchAll(new RegExp('^# '+key+' (\\d+)$','gm'))];assert.equal(values.length,1);return[key,Number(values[0][1])];}));
 assert.deepEqual(report.counts,counts);assert.ok(counts.tests>0);assert.equal(counts.pass,counts.tests);for(const key of ['fail','cancelled','skipped','todo'])assert.equal(counts[key],0);
 const stripped=providerLog.split(/\r?\n/).map(line=>line.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /,'')).join('\n');
 const lines=tap.trimEnd().split(/\r?\n/);let position=0;for(const line of lines){const at=stripped.indexOf(line,position);assert.ok(at>=position,'Complete CPU TAP is absent from actual provider stdout');position=at+line.length;}
 return {part,files:report.files.length,counts,tapBytes:Buffer.byteLength(tap),tapSha256:sha(Buffer.from(tap))};
}
function assertSourceHashes(report,expectedSources,expectedHarness){
 assert.deepEqual(report.sources,expectedSources);assert.deepEqual(report.sourcesAfter,expectedSources);assert.deepEqual(report.sourceDrift,[]);
 assert.equal(report.fingerprint,digestRows(expectedSources));assert.equal(report.harnessSha256,expectedHarness);assert.equal(report.harnessSha256After,expectedHarness);
 assert.equal(report.finished,true);assert.equal(report.pass,true);
}
export function assertShortcutReport(report,levels,manifest,sourceCommit,{sources,harnessSha256}){
 assertSourceHashes(report,sources,harnessSha256);assert.equal(report.sourceCommit,sourceCommit);assert.equal(report.edition,'foundation');
 const {chamberEdition,...flags}=manifest.runtimeConfig;assert.deepEqual(report.runtime,flags);
 assert.deepEqual(report.rows.map(row=>[row.level,row.name]),levels.flatMap(level=>SHORTCUT_CASES.map(name=>[level,name])));
 const recognized=['finite_attack_observed','legitimate_introductory_solution','production_death','setup_failure','attack_error','navigation_error'];
 const unproven=[],outcomes={};
 for(const row of report.rows){const expected=roomFor(manifest,row.level);assert.equal(row.id,expected.id);assert.ok(recognized.includes(row.outcome),'Unknown outcome or actual bypass blocks release');
  assert.equal(typeof row.attackReached,'boolean');assert.equal(row.sameCompanion,true);assert.ok(vector(row.final.player)&&vector(row.final.cargo));assert.equal(typeof row.final.won,'boolean');
  assert.ok(Array.isArray(row.checkpoints)&&Array.isArray(row.shots)&&Array.isArray(row.milestones));for(const point of row.checkpoints)assert.ok(vector(point.player)&&vector(point.cargo));
  if(row.outcome==='setup_failure'){assert.equal(row.attackReached,false);assert.ok(row.error);}
  else if(['attack_error','navigation_error'].includes(row.outcome)){assert.equal(row.attackReached,true);assert.ok(row.error);}
  else if(row.outcome==='production_death'){assert.equal(row.attackReached,true);assert.match(row.error||'',/unexpected reset/);assert.equal(row.final.won,false);}
  else{assert.equal(row.attackReached,true);assert.equal(row.error,undefined);assert.ok(positive(row.frames));assert.equal(row.resets??0,0);assert.equal(row.respawns??0,0);}
  if(row.final.won||row.outcome==='legitimate_introductory_solution'){
   assert.equal(row.level,1);assert.equal(row.name,'early-release-finish-directed-shots');assert.equal(row.outcome,'legitimate_introductory_solution');assert.equal(row.final.won,true);
   assert.ok(row.shots.some(shot=>shot.slot===0&&shot.accepted&&shot.correct&&shot.impact?.valid));assert.ok(row.shots.some(shot=>shot.slot===1&&shot.accepted&&shot.correct&&shot.impact?.valid));
   assert.ok(row.final.teleports>0&&row.final.cargoTransports>0,'Opening-room exception requires actual player and original-cargo portal transport');
  }else assert.equal(row.final.won,false);
  if(!row.attackReached||['setup_failure','attack_error','navigation_error'].includes(row.outcome))unproven.push({stableLevel:row.level,visibleRoom:expected.level,case:row.name,outcome:row.outcome,attackReached:row.attackReached,error:row.error,status:'UNPROVEN'});
  outcomes[row.outcome]=(outcomes[row.outcome]??0)+1;
 }
 const summary={total:report.rows.length,attackReached:report.rows.filter(row=>row.attackReached).length,bypassCandidates:[],setupFailures:outcomes.setup_failure??0,
  productionDeaths:outcomes.production_death??0,attackErrors:outcomes.attack_error??0};assert.deepEqual(report.summary,summary);
 return {scope:'Finite scheduled probes; setup/errors remain unproven, and absence of bypass is not exhaustive shortcut closure.',...summary,outcomes,unproven};
}
export function assertCastleShortcutReport(report,manifest,sourceCommit,{sources,harnessSha256,cases}){
 assertSourceHashes(report,sources,harnessSha256);assert.equal(report.sourceCommit,sourceCommit);assert.equal(report.stableLevel,41);assert.equal(report.campaignDisplayLevel,51);
 assert.equal(report.edition,'foundation');const {chamberEdition,...flags}=manifest.runtimeConfig;assert.deepEqual(report.runtime,flags);assert.deepEqual(report.rows.map(row=>row.name),cases);
 for(const row of report.rows){assert.equal(row.attackReached,true);assert.equal(row.executed,true);assert.equal(row.candidateBypass,false);assert.equal(row.sameCompanion,true);assert.equal(row.finiteActors,true);
  assert.equal(row.outcome,'finite_attack_observed');assert.equal(row.error,null);assert.ok(row.physicalBlockedProof);
  assert.equal(row.finish?.state,'playing');assert.ok(vector(row.finish.player)&&vector(row.finish.cargo));assert.ok(vector(row.attackStart.player)&&vector(row.attackStart.cargo));
  assert.equal(row.resets,0);assert.equal(row.respawns,0);assert.equal(row.cargoResets,0);if('forbiddenAddress'in row)assert.deepEqual(row.forbiddenAddress,[]);
  assert.notEqual(row.physicalCrownPenetration,true);assert.notEqual(row.cargoPassedDivider,true);assert.deepEqual(row.solvedDuringAttack,[]);
 }
 const [shots,jamb,slit]=report.rows;assert.deepEqual(shots.forbiddenAddress,[]);assert.equal(shots.physicalBlockedProof.forbiddenPanelsInstalled,0);assert.equal(shots.physicalBlockedProof.lockedCrownPhysicallyEntered,false);
 assert.equal(shots.physicalBlockedProof.shots.length,12);for(const shot of shots.physicalBlockedProof.shots){assert.equal(shot.valid,false);assert.equal(shot.impact?.valid,false);assert.ok(vector(shot.impact.position));}
 assert.equal(jamb.physicalBlockedProof.lockedCrownPhysicallyEntered,false);assert.equal(jamb.physicalBlockedProof.jambSamples.length,3);
 for(const sample of jamb.physicalBlockedProof.jambSamples){assert.equal(sample.physicalPenetration,false);assert.ok(vector(sample.player)&&vector(sample.cargo));}
 assert.equal(slit.physicalBlockedProof.cargoPassedDivider,false);assert.equal(slit.physicalBlockedProof.cargoTransportsBefore,slit.physicalBlockedProof.cargoTransportsAfter);
 assert.equal(slit.physicalBlockedProof.carriedCrownBefore,slit.physicalBlockedProof.carriedCrownAfter);assert.ok(vector(slit.physicalBlockedProof.slitFinalCargo));
 assert.deepEqual(slit.attackStart.solved,CASTLE_STAGES.slice(0,10));assert.deepEqual(slit.finish.solved,CASTLE_STAGES.slice(0,10));
 assert.deepEqual(report.summary,{total:3,reachedAttacks:3,bypassCandidates:[],setupFailures:[],attackErrors:[]});return {cases:3,reached:3,bypassCandidates:0};
}
export function assertStorageReport(report,manifest,sourceCommit,{actualPublic=false,publicURL}={}){
 assertReportedPackage(report,manifest);assert.equal(report.sourceCommit,sourceCommit);assert.equal(report.pass,true);assert.deepEqual(report.errors,[]);assert.equal(report.failure,undefined);
 assert.equal(report.checks.length,3);for(const [name,volume,tutorial]of [['imported',.21,true],['reloaded',.37,false]]){
  assert.deepEqual(report[name].completed,[0,1,6]);assert.deepEqual(report[name].hints,{1:2});assert.equal(report[name].resumeLevel,3);assert.equal(report[name].volume,volume);assert.equal(report[name].tutorial,tutorial);
 }
 const url=new URL(report.url);assert.equal(url.pathname,actualPublic?new URL(publicURL).pathname:'/campaign-v55/');
 if(actualPublic)assert.equal(url.href,publicURL);else assert.equal(url.hostname,'127.0.0.1');
 return {historicalImport:true,settingsPersisted:true,sourceDebugObserver:true,actualPublic};
}
export function assertOverviewReport(report,manifest,sourceCommit,{assertRuntime,assertImage,finalVisual=true}={}){
 assertReportedPackage(report,manifest);assert.equal(report.sourceCommit,sourceCommit);assert.equal(report.mode,'overview');assert.equal(report.pass,true);assert.equal(report.capturePass,true);assert.deepEqual(report.errors,[]);assert.equal(report.active,undefined);
 assert.deepEqual(report.rows.map(row=>row.level),SEQUENCE);
 if(finalVisual)assert.equal(report.inspectionQuality,'balanced','Final inspection must use the shipped balanced quality profile');
 for(const row of report.rows){assert.equal(row.pass,true);assert.equal(row.capturePass,true);assert.deepEqual(row.errors,[]);assertRuntime(row.start,row.level);assert.deepEqual(row.start.missingModels,[]);
  assert.deepEqual(Object.keys(row.captures),['start','overview']);for(const kind of ['start','overview']){assert.equal(row.captures[kind].ok,true);assertImage(row.level+'-'+kind+'.jpg',row.captures[kind]);}
  if(finalVisual){
   assert.equal(row.start.quality,'balanced');assert.equal(row.start.shadows,true);
   const f=row.framing;assert.equal(f?.kind,'interior-camera-inspection');assert.equal(f.geometryVisibilityChanged,false);
   for(const key of ['eye','target'])assert.ok(vector(f[key]),'Inspection has invalid camera vectors');
   const b=f.bounds;for(const key of ['minX','maxX','minZ','maxZ','base','roof'])assert.ok(Number.isFinite(b?.[key]));
   assert.ok(b.maxX>b.minX&&b.maxZ>b.minZ&&b.roof-b.base>=4);assert.ok(f.eye[0]>b.minX&&f.eye[0]<b.maxX&&f.eye[2]>b.minZ&&f.eye[2]<b.maxZ);
   assert.ok(f.eye[1]>b.base&&f.eye[1]<b.roof-1,'Final inspection camera is outside or above the genuine room interior');
   assert.ok(f.roofClearance>1&&Math.abs(f.roofClearance-(b.roof-f.eye[1]))<1e-9);assert.equal(f.fov,78);assert.ok(Number.isInteger(f.candidates)&&f.candidates>0);
   assert.ok(Number.isInteger(f.visibleFloorPoints)&&f.visibleFloorPoints>=3);assert.ok(Number.isInteger(f.visiblePortalPoints)&&f.visiblePortalPoints>=0);
   assert.ok(Array.isArray(f.observedTargets));assert.equal(f.observedTargets.filter(t=>t.kind==='floor').length,f.visibleFloorPoints);assert.equal(f.observedTargets.filter(t=>t.kind==='portal').length,f.visiblePortalPoints);
   for(const t of f.observedTargets){assert.ok(['floor','portal'].includes(t.kind));assert.ok(vector(t.point));assert.ok(t.point[0]>b.minX&&t.point[0]<b.maxX&&t.point[2]>b.minZ&&t.point[2]<b.maxZ&&t.point[1]>=b.base&&t.point[1]<b.roof);}
   for(const key of ['cameraPosition','cameraFocus','cameraPlayerPivot'])assert.ok(vector(row.start[key]),'Actual production startup camera observation is required');
   assert.equal(typeof row.start.cameraObstructed,'boolean');assert.ok(positive(row.start.cameraDistance)&&positive(row.start.cameraFocusDistance)&&positive(row.start.cameraFov));
   assert.ok(Math.abs(Math.hypot(...row.start.cameraPosition.map((n,i)=>n-row.start.cameraPlayerPivot[i]))-row.start.cameraDistance)<1e-6);
   assert.ok(Math.abs(Math.hypot(...row.start.cameraPosition.map((n,i)=>n-row.start.cameraFocus[i]))-row.start.cameraFocusDistance)<1e-6);
   if(row.level===48){assert.deepEqual(row.start.position,[-18,8,14]);assert.equal(row.start.cameraObstructed,false);assert.ok(row.start.cameraDistance>=6,'Authored stable48 production startup must retain its unobstructed physical camera boom');}
  }
 }return {rooms:51,actualArchitectureFrames:102,interiorVisualAccepted:finalVisual,inspectionQuality:report.inspectionQuality??'unreported',authoredStartup48Accepted:finalVisual,puzzleWinsClaimed:false,
  ...(finalVisual?{}:{limitation:'SOURCE3 roof-only exterior overviews are diagnostic and do not count as final interior visual acceptance.'})};
}
export function assertMenuReport(report,manifest,{assertImage}={}){
 assertReportedPackage(report,manifest);assert.equal(report.pass,true);assert.deepEqual(report.errors,[]);
 const sizes=[[1440,900],[1024,768],[360,800],[390,844],[412,915],[844,390]];assert.equal(report.viewports.length,sizes.length);
 for(let i=0;i<sizes.length;i++){const row=report.viewports[i],[width,height]=sizes[i];assert.equal(row.width,width);assert.equal(row.height,height);assert.equal(row.pass,true);assert.equal(row.reach?.pass,true);assert.ok(row.scrollWidth<=row.width+2);
  assertImage('menu-'+width+'x'+height+'.png',undefined,{width,height});
 }return {actualMenuFrames:6,viewports:sizes};
}
export function assertAnimationReport(report,manifest,sourceCommit,{assertRuntime,assertImage,assertMovie,finalVisual=true}={}){
 assertReportedPackage(report,manifest);assert.equal(report.sourceCommit,sourceCommit);assert.equal(report.pass,true);assert.deepEqual(report.errors,[]);assert.equal(report.failure,undefined);assertRuntime(report.runtime,9);
 assert.deepEqual(report.routes.map(row=>row.name),['free-jump','held-friend-jump']);
 const movies=[];
 for(const [i,row]of report.routes.entries()){assert.equal(row.frames,48);assert.equal(row.route.pass,true);assert.equal(row.route.resets,0);assert.equal(row.route.respawns,0);
  const motion=row.motion;assert.equal(motion.fps,15);assert.equal(motion.frames,48);assert.equal(motion.physicsSteps,384);assert.equal(motion.carrying,i===1);
  assert.equal(motion.jumps,1);assert.equal(motion.landings,1);assert.equal(motion.finalGrounded,true);assert.equal(motion.normalCamera,true);
  assert.ok(vector(motion.start)&&vector(motion.final)&&vector(motion.endVelocity));assert.ok(motion.maxHeight-motion.start[1]>.8);assert.ok(Math.hypot(motion.endVelocity[0],motion.endVelocity[2])<.03);
  if(i===1)assert.ok(motion.maxGripError<.06);assert.equal(row.pixels?.frames,48);assert.equal(row.pixels?.allNonblank,true);assert.ok(row.pixels.minimumLumaRange>=12);
  for(let n=0;n<48;n++)assertImage(row.name+'/'+String(n).padStart(4,'0')+'.jpg');
  movies.push(assertMovie(row.name+'.mp4',{frames:48,fps:15,width:960,height:540,duration:3.2}));
 }
 const inspections=[];
 if(finalVisual){
  assert.ok(Array.isArray(report.angleCaptures));assert.deepEqual(report.angleCaptures.map(row=>row.stage+'/'+row.view).sort(),['held-start','held-grounded-finish'].flatMap(stage=>['front','left','right'].map(view=>stage+'/'+view)).sort());
  assert.equal(new Set(report.angleCaptures.map(row=>row.file)).size,6);
  let cargoIdentity,bodyId,shapes;
  for(const row of report.angleCaptures){
   assert.match(row.file,/^[a-z0-9-]+\.jpg$/);assert.equal(row.scope,'camera-only inspection, not route/movie');assert.equal(row.width,960);assert.equal(row.height,540);
   assert.ok(vector(row.cameraPosition)&&vector(row.cameraTarget));assert.equal(row.physicalStateUnchanged,true);assert.equal(row.cameraRestored,true);
   const before=row.physicalBefore,after=row.physicalAfter;assert.deepEqual(before,after,'Camera-only inspection changed physical actors');assert.equal(row.physicalBeforeSha256,sha(Buffer.from(JSON.stringify(before))));assert.equal(row.physicalAfterSha256,sha(Buffer.from(JSON.stringify(after))));assert.equal(before.held,true);assert.equal(before.player.grounded,true);
   assert.ok(typeof before.cargoIdentity==='string'&&before.cargoIdentity.length>0);assert.ok(Number.isInteger(before.body.id));assert.ok(Array.isArray(before.body.shapes)&&before.body.shapes.length>0);
   if(cargoIdentity===undefined){cargoIdentity=before.cargoIdentity;bodyId=before.body.id;shapes=before.body.shapes;}else{assert.equal(before.cargoIdentity,cargoIdentity);assert.equal(before.body.id,bodyId);assert.deepEqual(before.body.shapes,shapes);}
   for(const key of ['worldStep','worldTime','physicsSteps','elapsed','visualTime'])assert.ok(Number.isFinite(before[key])&&before[key]>=0);
   assert.ok(vector(before.player.position)&&vector(before.player.velocity)&&vector(before.cargo.position)&&vector(before.cargo.velocity)&&vector(before.body.position)&&vector(before.body.velocity));
   assert.equal(row.geometry?.physicalRayClear,true);assert.equal(row.geometry?.actorBoundsInFrustum,true);assert.equal(row.geometry.enabledColliderClearance,.12);assert.ok(row.geometry.opaqueMeshRays>=10);
   const frame=row.stage==='held-start'?0:47,steps=row.stage==='held-start'?8:384;
   assert.equal(row.sample.frame,frame);assert.equal(row.sample.physicsSteps,steps);assert.equal(row.sample.time,row.stage==='held-start'?0:3.2);
   const receipt=assertImage(row.file,undefined,{width:960,height:540});assert.equal(receipt.bytes,row.bytes);assert.equal(receipt.sha256,row.sha256);inspections.push(receipt);
  }
 }
 return {productionAnimationMovies:2,decodedMovies:movies,animationSamples:96,heldAngleInspectionStills:inspections,heldAngleInspectionAccepted:finalVisual,hardwareFPSClaimed:false};
}
