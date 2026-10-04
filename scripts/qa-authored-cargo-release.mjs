import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {orientedBoxFitsPortal,portalBacksCollider} from '../src/game/LabPortals.js';

const DT=1/120,ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SIDES=['near-right','near-left'],DEPTHS=[1,.8,.6,.5,.4,.3,.2,.1];
const SEQUENCES=['release-clear','release-1tick-clear','release-2ticks-clear','release-5ticks-clear','release-no-clear','clear-release'];
const SELF=fileURLToPath(import.meta.url),harnessHash=()=>crypto.createHash('sha256').update(fs.readFileSync(SELF)).digest('hex');
export const authoredReleaseCaseDefinitions=Object.freeze(SIDES.flatMap(sourceName=>DEPTHS.flatMap(triggerDistance=>SEQUENCES.map(sequence=>Object.freeze({sourceName,triggerDistance,sequence})))));
function sourceHash(){const h=crypto.createHash('sha256');function visit(rel){for(const name of fs.readdirSync(path.join(ROOT,rel)).sort()){const file=rel+'/'+name;if(fs.statSync(path.join(ROOT,file)).isDirectory())visit(file);else if(file.endsWith('.js'))h.update(file+'\0').update(fs.readFileSync(path.join(ROOT,file)));}}visit('src/game');return h.digest('hex');}
function save(file,report){if(!file)return;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');}
function projectionRange(box,portal){const values=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])values.push(new THREE.Vector3(x,y,z).sub(portal.position).dot(portal.normal));return {min:Math.min(...values),max:Math.max(...values)};}

/** Actual authored room, original actors, production inputs only. The distance
 * target chooses when to stop ordinary walking; snapshots never move actors. */
export async function runAuthoredReleaseCases({sides=SIDES,depths=DEPTHS,sequences=SEQUENCES,outputPath=null,onCase=()=>{}}={}){
 assert.ok(sides.length&&depths.length&&sequences.length,'At least one concrete authored case is required');
 assert.ok(sides.every(s=>SIDES.includes(s))&&sequences.every(s=>SEQUENCES.includes(s))&&depths.every(d=>Number.isFinite(d)&&d>0&&d<1.35),'Unsupported authored release case input');
 const report={scope:'Authored foundation room 1, original cargo/body. Actual move, camera, E, projectile fire and clear inputs. No actor position, velocity, portal plane, mechanism state or win flag assignments. Initial normal level selection/Play reset precede each attempt.',physicsHz:120,settleTicks:120,definitions:sides.flatMap(sourceName=>depths.flatMap(triggerDistance=>sequences.map(sequence=>({sourceName,triggerDistance,sequence})))),started:new Date().toISOString(),beforeHash:sourceHash(),beforeHarnessHash:harnessHash(),cases:[]};
 const g=await createHeadlessGame();g.chamberEdition='foundation';
 try{
  for(const sourceName of sides)for(const triggerDistance of depths)for(const sequence of sequences){
   await g.selectLevel(0,false);
   const row={id:`room1-${sourceName}-front-${triggerDistance}-${sequence}`,level:1,sourceName,triggerDistance,sequence,inputs:[],events:[],error:null,clipDetected:false,wholeBoxBehindWithOwnerFront:false};
   const originalUpdate=g.updatePlaying;let physicsTicks=0;
   g.updatePlaying=function(dt){physicsTicks++;return originalUpdate.call(this,dt);};
   try{
    const journey=await runV8Journey(g,{scenario:async d=>{
     const panels=d.level.panels,sourcePanel=panels[sourceName],destination=panels[sourceName==='near-right'?'near-left':'near-right'];
     row.inputs.push({action:'fire-pair',targets:[sourcePanel.getFrame().center.toArray(),destination.getFrame().center.toArray()]});
     d.aim(0,sourcePanel.getFrame().center);d.aim(1,destination.getFrame().center);
     const originalBody=g.physics.cargoBody.id,originalCargo=g.cargo.group.uuid;
     row.originalIdentity={bodyId:originalBody,cargoUuid:originalCargo};
     row.inputs.push({action:'walk-to-original-cargo',target:[g.cargo.position.x+1,g.cargo.position.z]});d.walk(g.cargo.position.x+1,g.cargo.position.z);d.pickup();row.inputs.push({action:'E-pickup'});
     const frame=g.portals.portals[0],normal=frame.normal.clone(),position=frame.position.clone();
     const distance=p=>new THREE.Vector3().copy(p).sub(position).dot(normal);
     const owned=g.colliders.filter(c=>c.enabled!==false&&(c.mesh.uuid===g.portalSurfaceIds[0]||frame.backingIds?.has(c.mesh.uuid)||c.portalOwner?.userData.portalColliderId===g.portalSurfaceIds[0]||portalBacksCollider(frame,c.box)));
     assert.ok(owned.length,'Authored source must own at least one actual backing collider');
     const ranges=owned.map(c=>({id:c.mesh.uuid,name:c.mesh.name,primary:c.mesh.uuid===g.portalSurfaceIds[0]||c.portalOwner?.userData.portalColliderId===g.portalSurfaceIds[0],box:{min:c.box.min.toArray(),max:c.box.max.toArray()},...projectionRange(c.box,frame)}));
     const primary=ranges.filter(r=>r.primary);assert.ok(primary.length,'Authored source must have its explicit primary support');
     // Other owned casings may sit beside the aperture. Their far back face
     // cannot define which side of the actual struck panel owns the cargo.
     const backFace=Math.min(...primary.map(r=>r.min));
     row.source={position:position.toArray(),normal:normal.toArray(),width:frame.width,height:frame.height,backing:ranges,backFaceDistance:backFace,contactTolerance:.03};
     function snapshot(){
      const body=g.physics.cargoBody,q=new THREE.Quaternion().copy(body.quaternion),n=normal.clone().applyQuaternion(q.clone().invert());
      const extent=g.physics.cargoSize/2*(Math.abs(n.x)+Math.abs(n.y)+Math.abs(n.z)),cargoDistance=distance(body.position),playerDistance=distance(g.playerPosition);
      assert.ok([...g.playerPosition.toArray(),...g.cargo.position.toArray(),body.position.x,body.position.y,body.position.z,body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w,body.velocity.x,body.velocity.y,body.velocity.z,cargoDistance,playerDistance,extent].every(Number.isFinite),'Non-finite actor state cannot qualify as a blocked exploit');
      const held=Boolean(g.heldCube),noTransit=g.teleportCount===0&&g.physics.portalTransports===0;
      const wholeBoxBehindSource=cargoDistance+extent<-.002,wholeBoxBehindBackingExact=cargoDistance+extent<backFace-.002;
      // A settled Cannon contact may penetrate a support by ordinary solver
      // slop. Keep the exact value, while allowing 3 cm for side classification.
      const wholeBoxBehindBacking=cargoDistance+extent<backFace+.03;
      return {tick:physicsTicks,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),body:[body.position.x,body.position.y,body.position.z],quaternion:[body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w],velocity:[body.velocity.x,body.velocity.y,body.velocity.z],playerDistance,cargoDistance,extent,wholeBoxBehindSource,wholeBoxBehindBacking,wholeBoxBehindBackingExact,playerTeleports:g.teleportCount,cargoTransports:g.physics.portalTransports,held,grounded:g.physics.grounded,bodyId:body.id,uuid:g.cargo.group.uuid,fit:orientedBoxFitsPortal(frame,g.cargo.position,body.quaternion),clip:!held&&noTransit&&playerDistance>0&&wholeBoxBehindSource&&cargoDistance<backFace&&wholeBoxBehindBacking};
     }
     function observe(label){const s=snapshot();if(label)row.events.push({at:label,...s});if(s.clip){row.clipDetected=true;row.wholeBoxBehindWithOwnerFront=true;row.firstClip??=s;}return s;}
     function tick(){if(g.state==='playing')g.updatePlaying(DT);g.updateVisuals(DT,1);assert.equal(g.physics.cargoBody.id,originalBody,'Original rigid body changed');assert.equal(g.cargo.group.uuid,originalCargo,'Original cargo changed');observe();}
     const front=position.clone().addScaledVector(normal,1.35);row.inputs.push({action:'walk-to-source-front',target:[front.x,front.z]});d.walk(front.x,front.z);
     const approachStart=physicsTicks;let reached=false;
     // Ease into deep test positions so a stopped owner does not accidentally
     // traverse during the delay. This is a real analogue movement input.
     for(let n=0;n<480;n++){
      const gap=distance(g.playerPosition)-triggerDistance;
      if(gap<=.012&&distance(g.playerPosition)>0){reached=true;break;}
      const pace=Math.min(1,Math.max(.035,gap*5));d.worldMove(-normal.x*pace,-normal.z*pace);tick();
      if(g.teleportCount)break;
     }
     d.stop();row.inputs.push({action:'move-toward-source-until-depth',requestedDistance:triggerDistance,ticks:physicsTicks-approachStart});row.setup=observe('partial-held');
     assert.ok(reached&&g.teleportCount===0,'Setup failed to stop in front of the source before any player traversal');
     assert.ok(row.setup.fit,'Original held box must actually fit the authored source aperture');
     assert.equal(g.physics.portalTransports,0,'Setup must not transport the original cargo');row.setupReached=true;
     if(sequence==='clear-release'){
      row.inputs.push({action:'clear-pair'});assert.equal(g.clearPortals(),true);observe('clear-before-release');
      row.inputs.push({action:'E-release'});assert.equal(g.interact(),true);assert.ok(!g.heldCube);observe('released-after-clear');
     }else{
      row.inputs.push({action:'E-release'});assert.equal(g.interact(),true);assert.ok(!g.heldCube);observe('released-before-delay');
      const delay=sequence==='release-1tick-clear'?1:sequence==='release-2ticks-clear'?2:sequence==='release-5ticks-clear'?5:0;
      row.delayTicks=delay;
      for(let n=0;n<delay;n++){tick();observe('release-delay-tick-'+(n+1));}
      if(sequence!=='release-no-clear'){row.inputs.push({action:'clear-pair',afterPhysicsTicks:delay});assert.equal(g.clearPortals(),true);observe('cleared-after-release');}
     }
     let minimumDistance=Infinity,maximumDistance=-Infinity;
     for(let n=0;n<120;n++){tick();const s=snapshot();minimumDistance=Math.min(minimumDistance,s.cargoDistance);maximumDistance=Math.max(maximumDistance,s.cargoDistance);if([0,1,4,29,59,119].includes(n))observe('settle-tick-'+(n+1));}
     row.final=observe('final');row.minimumFreeDistance=minimumDistance;row.maximumFreeDistance=maximumDistance;
     row.sameOriginalBody=g.physics.cargoBody.id===originalBody&&g.cargo.group.uuid===originalCargo;
     row.outcome=row.clipDetected?'original-whole-box-behind-backing-without-transit':g.teleportCount||g.physics.portalTransports?'legitimate-counted-portal-transit':row.final.cargoDistance>=row.final.extent-.035?'same-front-side':'finite-no-whole-box-clip';
    }});
    row.journey={frames:journey.frames,physicsTicks,resets:journey.resets,respawns:journey.respawns};
    assert.equal(journey.resets,0,'A cargo reset cannot qualify as an authored release recovery');
    assert.equal(journey.respawns,0,'A player respawn cannot qualify as an authored release recovery');
   }catch(error){row.error=String(error);row.outcome='setup-or-driver-error';}
   finally{g.updatePlaying=originalUpdate;}
   row.pass=!row.error&&row.setupReached===true&&!row.clipDetected&&row.sameOriginalBody===true&&row.journey?.resets===0&&row.journey?.respawns===0;
   report.cases.push(row);onCase(row);save(outputPath,report);
  }
 }finally{g.physics.dispose();g.portals.dispose();}
 report.finished=new Date().toISOString();report.afterHash=sourceHash();report.afterHarnessHash=harnessHash();report.sourceUnchanged=report.beforeHash===report.afterHash;report.harnessUnchanged=report.beforeHarnessHash===report.afterHarnessHash;
 report.summary={cases:report.cases.length,clips:report.cases.filter(r=>r.clipDetected).length,errors:report.cases.filter(r=>r.error||!r.setupReached).length,legitimateTransits:report.cases.filter(r=>r.outcome==='legitimate-counted-portal-transit').length};
 report.pass=report.sourceUnchanged&&report.harnessUnchanged&&report.cases.length===report.definitions.length&&report.cases.every(r=>r.pass);save(outputPath,report);return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const outputPath=path.resolve(process.env.OUT||path.join(ROOT,'qa/authored-release-expanded.json'));
 const result=await runAuthoredReleaseCases({outputPath,...process.env.SIDES?{sides:process.env.SIDES.split(',')}:{},...process.env.DEPTHS?{depths:process.env.DEPTHS.split(',').map(Number)}:{},...process.env.SEQUENCES?{sequences:process.env.SEQUENCES.split(',')}:{},onCase:r=>console.log(r.pass?'PASS':'FAIL',r.id,r.outcome,r.final?.cargoDistance,r.error||'')});
 console.log('AUTHORED RELEASE',JSON.stringify(result.summary),'sourceUnchanged',result.sourceUnchanged);
 if(!result.sourceUnchanged||!result.harnessUnchanged||result.summary.errors||(!result.pass&&!process.argv.includes('--beforeReport')))process.exitCode=1;
}
