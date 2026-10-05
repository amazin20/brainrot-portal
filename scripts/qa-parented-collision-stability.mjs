import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

// Read-only observer: production build, Play spawn, fixed simulation and render
// updates. No actor/mechanism/portal/win state is assigned. syncCollision is
// wrapped only to measure the actual arguments and the original mesh identity.
const output='qa/parented-collision-stability.json';
const rooms=(process.env.ROOMS||Array.from({length:51},(_,i)=>i+1).join(',')).split(',').map(Number);
const seconds=Number(process.env.SECONDS||5),tol=1e-4;
// Actual parented visible syncCollision callers plus the repaired stair. These
// normal input routes exercise moving/open poses; idle checks alone do not.
const journeyRooms=new Set((process.env.JOURNEY_ROOMS||'9,10,14,29').split(',').filter(Boolean).map(Number));
const files=fs.readdirSync('src/game').filter(f=>f.endsWith('.js')).sort();
const sha=()=>createHash('sha256').update(files.map(f=>f+'\n'+fs.readFileSync('src/game/'+f)).join('\n')).digest('hex');
const sourceCalls=files.flatMap(file=>fs.readFileSync('src/game/'+file,'utf8').split('\n').flatMap((line,i)=>line.includes('syncCollision(')&&!line.trim().startsWith('//')?[{file,line:i+1,text:line.trim()}]:[]));
const report={scope:'Foundation rooms '+rooms.join(',')+': normal Play spawn and '+seconds+' seconds of no-input 120 Hz simulation with 60 Hz visual updates at alpha=1. Rooms '+[...journeyRooms].filter(n=>rooms.includes(n)).join(',')+' also use real input-only production journeys to exercise moving/open poses. Instrumented syncCollision checks its requested world AABB against the actual post-call original collider.mesh world bounds. Collider snapshots separately check actual visible-mesh bounds, original local transforms, physical target and actual body bounds from oriented real shape corners. This finite check is not a browser visual review or proof that every powered mechanism pose is safe.',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceBefore:sha(),started:new Date().toISOString(),sourceCalls,rows:[]};
report.requestedRooms=rooms;report.sourceFiles=files.map(f=>'src/game/'+f);
report.fingerprintAlgorithm='SHA256 of sorted src/game JS filenames plus newline plus UTF8 contents, joined with newlines; all current game modules included.';
report.fingerprintNameFormat='Basename only in hash stream, e.g. LabGame.js; sourceFiles lists repository paths for retrieval.';
report.fullFoundation=rooms.length===51&&Array.from({length:51},(_,i)=>i+1).every(n=>rooms.includes(n));
// Keep the documented fail-before/pass-after regression history when CI
// refreshes the current source-bound observation report after the commit.
report.regressions=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')).regressions||[]:[];
report.sourceReview=[
 {files:['LabGame.js'],functions:['collisionProxy','syncCollision'],finding:'collisionProxy creates an invisible scene-root AABB mesh; syncCollision writes world centre and scale into that mesh. Correct for scene-root proxies and visible meshes under an identity parent, unsafe for visible meshes under a transformed ancestor.'},
 {files:['LabRoom14CounterweightStair.js'],functions:['createRoom14CounterweightStair/step'],finding:'Repaired stair keeps authored local mesh transforms under its moving group and publishes mesh world bounds with updateStaticBox, without syncCollision. Idle and full input-only route are observed.'},
 {files:['LabWorkshopRooms.js','LabPortalRoom29.js'],functions:['glassLift','updateLatch'],finding:'Active foundation visible parented syncCollision meshes belong to the stationary identity Tiled architectural shell (rooms 9, 10 and 29). Their own local Y is intentionally driven; open/moving poses are observed by the actual journeys.'},
 {files:['LabBalanceChamber.js','LabBalanceRig.js'],functions:['pose','movingBox'],finding:'Rocker keeps authored local proxy positions and updates real oriented Cannon boxes/rotation; half extents are local and must not be compared as an unrotated world AABB. Observer computes oriented shape corners.'},
 {files:['LabFoundationChambers.js','LabOpenArchitecture.js','LabOpenHydraulics.js','LabSolidModels.js'],functions:['onCarrier','carStructure','syncHangers','carrier','panel.sync','glazedLift/sync','bindSolidModel/sync'],finding:'Moving visible parts retain their own parented transforms while separate scene-root collision proxies receive syncCollision world AABBs. Some actual mesh colliders instead publish world boxes directly.'},
 {files:['LabLateCampaignMechanisms.js','LabExpansionRoomsA.js','LabExpansionRoomsB.js','LabCreativeCounterweightRoom.js','LabCreativeFinalRooms.js','LabCreativeRoom18.js','LabCreativeRoom20.js'],functions:['movingMechanismBlock','lateShutter','moving','movingPart'],finding:'Mechanisms use separate root collisionProxy meshes for world AABBs; moving visible meshes are not the collider.mesh being recentered. Dynamic replacements/removals are recorded, not mistaken for an identity drift.'},
 {files:['LabFirstLevel.js','LabIntroductoryCampaign.js','LabWindRoom.js','LabPuzzleMechanics.js','LabResearchArt.js'],functions:['sync','housing','barrier leaf sync','backing'],finding:'World-space bounds feed separate root proxy meshes. Runtime instrumentation records the actual caller stacks and collider identities.'},
 {files:['LabPortalRoom18.js'],functions:['sightShutter'],finding:'Archive implementation uses an actual visible mesh beneath the identity tiled shell; active foundation 18 dispatches to the rebuilt creative circuit. Source inventory includes archive call sites; no archive execution claim.'},
];
const v=()=>new THREE.Vector3(),box=()=>new THREE.Box3();
const serialize=b=>b.min.toArray().concat(b.max.toArray());
const error=(a,b)=>Math.max(...a.min.toArray().concat(a.max.toArray()).map((x,i)=>Math.abs(x-b.min.toArray().concat(b.max.toArray())[i])));
const local=m=>m.position.toArray().concat(m.quaternion.toArray(),m.scale.toArray());
const difference=(a,b)=>Math.max(...a.map((x,i)=>Math.abs(x-b[i])));
const visible=m=>{for(let n=m;n;n=n.parent)if(n.visible===false)return false;return true;};
// Cannon boxes can intentionally rotate while item.half remains local-space.
// Measure the real shapes, offsets and orientations before comparing AABBs.
function physicalBounds(item,position=item.body.position){
 const out=box(),body=item.body,bq=new THREE.Quaternion().copy(body.quaternion),bp=v().copy(position);
 for(let i=0;i<body.shapes.length;i++){
  const shape=body.shapes[i],sq=new THREE.Quaternion().copy(body.shapeOrientations[i]),sp=v().copy(body.shapeOffsets[i]);
  const points=[];
  if(shape.halfExtents){const h=shape.halfExtents;for(const x of [-h.x,h.x])for(const y of [-h.y,h.y])for(const z of [-h.z,h.z])points.push(new THREE.Vector3(x,y,z));}
  else if(shape.vertices)points.push(...shape.vertices.map(p=>v().copy(p)));
  else throw new Error('Unsupported static collider shape '+shape.type);
  for(const p of points)out.expandByPoint(p.applyQuaternion(sq).add(sp).applyQuaternion(bq).add(bp));
 }
 return out;
}
const g=await createHeadlessGame();g.chamberEdition='foundation';
const originalSync=g.syncCollision,originalReset=g.resetRun;
let row=null,syncRecords=null,frame=0,phase='no-input';
g.resetRun=function(...args){if(row)row.resets++;return originalReset.apply(this,args);};
g.syncCollision=function(c,b,dt){
 if(!row)return originalSync.call(this,c,b,dt);
 const m=c.mesh,requested=b.clone(),before=box().setFromObject(m),priorLocal=local(m),parented=m.parent!==this.scene;
 let r=syncRecords.get(c);
 if(!r){r={uuid:m.uuid,name:m.name,proxy:!!m.userData.collisionProxy,visible:visible(m),parented,parentName:m.parent?.name||m.parent?.type,kinematic:!!c.kinematic,calls:0,noInputCalls:0,journeyCalls:0,maxPostMeshVsRequested:0,maxRequestedVsPreMesh:0,maxLocalDelta:0,identityStable:true,source:new Error().stack.split('\n').slice(2,5).map(s=>s.trim())};syncRecords.set(c,r);}
 const result=originalSync.call(this,c,b,dt),after=box().setFromObject(m),e=error(after,requested);
 r.calls++;r[phase==='journey'?'journeyCalls':'noInputCalls']++;r.identityStable&&=c.mesh===m;r.maxPostMeshVsRequested=Math.max(r.maxPostMeshVsRequested,e);r.maxRequestedVsPreMesh=Math.max(r.maxRequestedVsPreMesh,error(before,requested));r.maxLocalDelta=Math.max(r.maxLocalDelta,difference(priorLocal,local(m)));
 if(e>tol&&!r.firstMismatch){r.firstMismatch={frame,phase,dt,requested:serialize(requested),before:serialize(before),after:serialize(after),beforeLocal:priorLocal,afterLocal:local(m),parentWorld:m.parent?.matrixWorld.toArray()};}
 return result;
};
const save=()=>{fs.mkdirSync('qa',{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');};
async function inspectRoom28Startup(){
 row=null;await g.selectLevel(27,false);g.resetRun(true);
 const c=g.colliders.find(c=>c.mesh.name==='Sealed tidal pontoon / physical envelope'&&c.box.getCenter(v()).x<0),item=g.physics.solids.get(c.mesh.uuid),body=item.body,cargo=g.cargo,cargoBody=g.physics.cargoBody;
 const spawn=g.playerPosition.clone(),cargoSpawn=g.cargo.position.clone(),distance=p=>Math.hypot(p.x-THREE.MathUtils.clamp(p.x,c.box.min.x,c.box.max.x),p.z-THREE.MathUtils.clamp(p.z,c.box.min.z,c.box.max.z));
 const probe={scope:'Exact room28 normal Play spawn, two 120 Hz substeps and one 60 Hz render, 120 frames, then ordinary public restart and another 120 frames. No movement/actor/mechanism/portal assignments.',colliderUuid:c.mesh.uuid,bodyId:body.id,playerSpawn:spawn.toArray(),cargoSpawn:cargoSpawn.toArray(),nearestPontoonXZDistance:{player:distance(spawn),cargo:distance(cargoSpawn)},minimumOrdinarySprintAccessSeconds:distance(spawn)/5,passes:[]};
 const snap=frame=>{const meshBounds=box().setFromObject(c.mesh),actual=physicalBounds(item);return {frame,time:frame/60,meshBounds:serialize(meshBounds),colliderBounds:serialize(c.box),targetBounds:serialize(physicalBounds(item,item.target)),actualPhysicalBounds:serialize(actual),target:[item.target.x,item.target.y,item.target.z],body:[body.position.x,body.position.y,body.position.z],remaining:item.remaining,bodyVelocity:[body.velocity.x,body.velocity.y,body.velocity.z],meshVsActualPhysicalError:error(meshBounds,actual),colliderVsActualPhysicalError:error(c.box,actual),identitiesStable:g.physics.solids.get(c.mesh.uuid)?.body===body&&g.cargo===cargo&&g.physics.cargoBody===cargoBody};};
 for(const name of ['normal-play','ordinary-restart']){
  if(name==='ordinary-restart')g.restart();const samples=[snap(0)];
  for(let n=1;n<=120;n++){g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,0);samples.push(snap(n));}
  probe.passes.push({name,state:g.state,firstSettledFrame:samples.find(s=>s.colliderVsActualPhysicalError<tol)?.frame,samples});
 }
 report.room28StartupTrajectory=probe;
}
try{
 for(const room of rooms){
  row={room,frames:0,resets:0,syncCalls:[],parentedColliders:[],initialPendingKinematicTargets:[],issues:[]};syncRecords=new Map();frame=0;phase='no-input';
  await g.selectLevel(room-1,false);g.resetRun(true);row.id=g.firstLevel.id;row.title=g.firstLevel.title;
  if(g.state!=='playing')throw new Error('Normal Play reset did not start room '+room);
  row.resets=0;const cargo=g.cargo,body=g.physics.cargoBody,physics=g.physics;
  const snapshots=g.colliders.map(c=>{const m=c.mesh,b=box().setFromObject(m);return {c,mesh:m,geometry:m.geometry,uuid:m.uuid,body:physics.solids.get(m.uuid)?.body,local:local(m),parentWorld:m.parent?.matrixWorld.toArray(),baselineMeshError:error(b,c.box),maxMeshError:error(b,c.box),maxTargetError:0,maxBodyError:0,maxPostStepBodyError:0,maxLocalDelta:0,parentMoved:false,meshIdentityStable:true,geometryIdentityStable:true,bodyIdentityStable:true,removedPhysical:false};});
  row.colliderCount=snapshots.length;row.parentedColliderCount=snapshots.filter(s=>s.mesh.parent!==g.scene).length;
  function sample(){
   for(const s of snapshots){const {c,mesh:m}=s;s.meshIdentityStable&&=c.mesh===m;s.geometryIdentityStable&&=m.geometry===s.geometry;s.maxLocalDelta=Math.max(s.maxLocalDelta,difference(s.local,local(m)));s.parentMoved||=difference(s.parentWorld,m.parent?.matrixWorld.toArray()||[])>tol;
    const b=box().setFromObject(m),me=error(b,c.box);s.maxMeshError=Math.max(s.maxMeshError,me);
    const item=physics.solids.get(s.uuid);if(!item){s.removedPhysical=true;continue;}s.bodyIdentityStable&&=item.body===s.body;
    const target=physicalBounds(item,item.target);const te=error(target,c.box);s.maxTargetError=Math.max(s.maxTargetError,te);
    const actual=physicalBounds(item);const be=error(actual,c.box);s.maxBodyError=Math.max(s.maxBodyError,be);
    if(frame>0)s.maxPostStepBodyError=Math.max(s.maxPostStepBodyError,be);
    else if(be>tol&&item.remaining>0)row.initialPendingKinematicTargets.push({uuid:s.uuid,name:m.name,proxy:!!m.userData.collisionProxy,parented:m.parent!==g.scene,remaining:item.remaining,bodyError:be,targetBounds:serialize(target),bodyBounds:serialize(actual),explanation:'Normal room reset queued a kinematic target before its first physics substep; post-step errors are measured separately.'});
    const unexpected=me>Math.max(tol,s.baselineMeshError+tol)||te>tol||(frame>0&&be>tol)||!s.meshIdentityStable||!s.geometryIdentityStable||!s.bodyIdentityStable;
    if(unexpected&&!s.firstIssue)s.firstIssue={frame,phase,meshBounds:serialize(b),colliderBounds:serialize(c.box),physicalTargetBounds:serialize(target),physicalBodyBounds:serialize(actual),meshError:me,targetError:te,bodyError:be,local:local(m),parentWorld:m.parent?.matrixWorld.toArray()};
   }
  }
  sample();
  for(frame=1;frame<=Math.ceil(seconds*60);frame++){
   for(let sub=0;sub<2&&g.state==='playing';sub++)g.updatePlaying(1/120);
   g.updateVisuals(1/60,1);if(frame===1||frame%30===0||frame===Math.ceil(seconds*60))sample();row.frames=frame;
  }
  row.noInputResets=row.resets;
  if(journeyRooms.has(room)){
   phase='journey';frame=0;const visuals=g.updateVisuals;
   g.updateVisuals=function(...args){const result=visuals.apply(this,args);frame++;if(frame%30===0)sample();return result;};
   try{const result=await runV8Journey(g);row.journey={pass:result.pass,frames:result.frames,respawns:result.respawns,resets:result.resets,milestones:result.milestones.map(m=>m.name),teleports:result.teleports};}
   catch(e){row.journey={pass:false,error:String(e),frames:frame};}
   finally{g.updateVisuals=visuals;sample();}
  }
  row.syncCalls=[...syncRecords.values()];
  row.parentedColliders=snapshots.filter(s=>s.mesh.parent!==g.scene).map(s=>({uuid:s.uuid,name:s.mesh.name,proxy:!!s.mesh.userData.collisionProxy,visible:visible(s.mesh),parentName:s.mesh.parent?.name||s.mesh.parent?.type,kinematic:!!s.c.kinematic,frontPlane:!!s.c.frontPlane,walkablePlane:!!s.c.walkablePlane,baselineMeshError:s.baselineMeshError,maxMeshError:s.maxMeshError,maxTargetError:s.maxTargetError,maxBodyError:s.maxBodyError,maxLocalDelta:s.maxLocalDelta,parentMoved:s.parentMoved,meshIdentityStable:s.meshIdentityStable,bodyIdentityStable:s.bodyIdentityStable,removedPhysical:s.removedPhysical,...(s.firstIssue?{firstIssue:s.firstIssue}:{})}));
  row.issues=snapshots.filter(s=>s.firstIssue).map(s=>({uuid:s.uuid,name:s.mesh.name,proxy:!!s.mesh.userData.collisionProxy,parented:s.mesh.parent!==g.scene,...s.firstIssue}));
  row.identityStable=g.cargo===cargo&&g.physics.cargoBody===body&&g.physics===physics;
  row.colliderMeshIdentitiesStable=snapshots.every(s=>s.meshIdentityStable);
  row.colliderGeometryIdentitiesStable=snapshots.every(s=>s.geometryIdentityStable);
  row.physicalBodyIdentitiesStable=snapshots.every(s=>s.bodyIdentityStable);
  row.maxPhysicalTargetError=Math.max(...snapshots.map(s=>s.maxTargetError));
  row.maxPhysicalBodyError=Math.max(...snapshots.map(s=>s.maxBodyError));
  row.maxPostStepPhysicalBodyError=Math.max(...snapshots.map(s=>s.maxPostStepBodyError));
  row.state=g.state;row.sourceAfter=sha();report.rows.push(row);save();
  console.log(JSON.stringify({room,id:row.id,colliders:row.colliderCount,parented:row.parentedColliderCount,syncColliders:row.syncCalls.length,syncCalls:row.syncCalls.reduce((a,r)=>a+r.calls,0),parentedSync:row.syncCalls.filter(r=>r.parented).length,syncMismatch:row.syncCalls.filter(r=>r.firstMismatch).length,issues:row.issues.length,identity:row.identityStable}));
 }
 if(rooms.includes(28))await inspectRoom28Startup();
}finally{
 g.syncCollision=originalSync;g.resetRun=originalReset;g.physics.dispose();g.portals.dispose();
 report.finished=new Date().toISOString();report.sourceAfter=sha();report.sourceStable=report.sourceBefore===report.sourceAfter;
 report.summary={rooms:report.rows.length,noInputFrames:report.rows.reduce((a,r)=>a+r.frames,0),journeyFrames:report.rows.reduce((a,r)=>a+(r.journey?.frames||0),0),journeys:report.rows.filter(r=>r.journey).length,journeysPassed:report.rows.filter(r=>r.journey?.pass).length,colliders:report.rows.reduce((a,r)=>a+r.colliderCount,0),parentedColliders:report.rows.reduce((a,r)=>a+r.parentedColliderCount,0),syncCalls:report.rows.reduce((a,r)=>a+r.syncCalls.reduce((b,s)=>b+s.calls,0),0),noInputSyncCalls:report.rows.reduce((a,r)=>a+r.syncCalls.reduce((b,s)=>b+s.noInputCalls,0),0),journeySyncCalls:report.rows.reduce((a,r)=>a+r.syncCalls.reduce((b,s)=>b+s.journeyCalls,0),0),parentedSyncColliders:report.rows.reduce((a,r)=>a+r.syncCalls.filter(s=>s.parented).length,0),syncMismatchColliders:report.rows.reduce((a,r)=>a+r.syncCalls.filter(s=>s.firstMismatch).length,0),issueColliders:report.rows.reduce((a,r)=>a+r.issues.length,0),identitiesStable:report.rows.every(r=>r.identityStable&&r.colliderMeshIdentitiesStable&&r.colliderGeometryIdentitiesStable&&r.physicalBodyIdentitiesStable),sourceStable:report.sourceStable};
 report.pass=report.rows.length===rooms.length&&report.sourceStable&&report.summary.issueColliders===0&&report.summary.syncMismatchColliders===0&&report.summary.identitiesStable&&report.summary.journeysPassed===report.summary.journeys&&report.rows.every(r=>r.noInputResets===0)&&(!report.room28StartupTrajectory||report.room28StartupTrajectory.passes.every(p=>p.firstSettledFrame===0&&p.samples.every(s=>s.identitiesStable&&s.colliderVsActualPhysicalError<tol)));
 process.exitCode=report.pass?0:1;
 save();console.log('SUMMARY',JSON.stringify(report.summary));
}
