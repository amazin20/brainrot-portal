/** Distinct delivery/dispatch routes in the real controller and Cannon world.
 * Only ordinary movement, jump/sprint, camera aim, E and portal shots affect
 * play. Read-only snapshots and source fingerprints are evidence, not inputs. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const sha=b=>createHash('sha256').update(b).digest('hex');
const output=process.env.OUT||'qa/expedition-alternates-50-51.json';
const harnessPath=fileURLToPath(import.meta.url);
function sources(){return Object.fromEntries(fs.readdirSync('src/game').filter(f=>f.endsWith('.js')).sort().map(f=>['src/game/'+f,sha(fs.readFileSync('src/game/'+f))]));}
const before=sources(),harnessBefore=sha(fs.readFileSync(harnessPath));
const report={scope:'Finite distinct ordinary-input route attempts in rooms 50 and 51. Headless controller/physics evidence; no WebGL or exhaustive route claim.',inputPolicy:'No assigned actor/body pose or velocity, mechanism state, portal frame, solved state or win flag. The normal Play initialization is excluded from per-route resets.',source:{commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),gameSources:before,gameSourcesSha256:sha(JSON.stringify(before)),harnessSha256:harnessBefore,headlessHarnessSha256:sha(fs.readFileSync('scripts/lab-headless.mjs')),started:new Date().toISOString()},routes:[],canonicalRoutes:[]};
const game=await createHeadlessGame();game.chamberEdition='foundation';let row;
function state(){const l=game.firstLevel;return {player:game.playerPosition.toArray(),cargo:game.cargo.position.toArray(),cargoUuid:game.cargo.group.uuid,cargoBodyId:game.physics.cargoBody.id,held:!!game.heldCube,grounded:game.playerGrounded,won:game.state==='won',playerTeleports:game.teleportCount,cargoTeleports:game.physics.portalTransports,...(l.top?{hingeAngle:l.top.angle,guardProgress:l.bumper.progress}:{}),...(l.shuttle?{shuttle:{position:l.shuttle.position.toArray(),target:l.shuttle.target,braked:l.shuttle.braked,loaded:!!l.clutch.loaded(),at:[0,1,2].map(i=>l.shuttle.at(i))}}:{})};}
function note(label,extra={}){row.events.push({label,...extra,physicsStep:row.physicsSteps,state:state()});}
function save(){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
const routes=[
 {room:50,name:'reuse-gravity-pair-to-send-free-cargo-over-fallen-bridge',alternative:'free-cargo-bridge',difference:'After physical toppling, reuse the unchanged gravity pair for a second free cargo delivery to the northern side. The observer crosses empty-handed and retrieves the same body.'},
 {room:51,name:'arm-transverse-dispatch-before-loading-and-ride-live-clutch',alternative:'prearmed-relay',difference:'Arm the empty, braked carrier before loading. Release original cargo to engage the pending dispatch and ride the carrier to east, without returning to the south control.'},
];
const canonicalRoutes=[50,51].map(room=>({room,name:'canonical',canonical:true}));

for(const route of [...routes,...canonicalRoutes]){
 if(process.env.ROOMS&&!process.env.ROOMS.split(',').map(Number).includes(route.room))continue;
 await game.selectLevel(route.room-1,false);const cargo=game.cargo,body=game.physics.cargoBody;row={room:route.room,name:route.name,alternative:route.alternative??null,canonical:!!route.canonical,difference:route.difference,originalCargoUuid:cargo.group.uuid,originalCargoBodyId:body.id,events:[],samples:[],physicsSteps:0,resets:0,respawns:0,sourceBefore:sha(JSON.stringify(sources())),harnessBefore:sha(fs.readFileSync(harnessPath)),started:new Date().toISOString()};(route.canonical?report.canonicalRoutes:report.routes).push(row);
 const update=game.updatePlaying;let proof,active=false;const respawn=game.respawn,resetCargo=game.physics.resetCargo,resetRun=game.resetRun;
 game.updatePlaying=function(dt){const result=update.call(this,dt);if(active){row.physicsSteps++;if(row.physicsSteps%120===0)row.samples.push({physicsStep:row.physicsSteps,state:state()});}return result;};
 game.respawn=function(...args){if(active)row.respawns++;return respawn.apply(this,args);};game.physics.resetCargo=function(...args){if(active)row.resets++;return resetCargo.apply(this,args);};game.resetRun=function(...args){if(active)row.resets++;const result=resetRun.apply(this,args);if(!active){active=true;note('Normal Play spawn');}return result;};
 try{proof=await runV8Journey(game,{journeyOptions:route.canonical?{}:{alternative:route.alternative},onMilestone:milestone=>note(milestone.name)});row.outcome=route.canonical?'completed-canonical-route':'completed-distinct-route';}
 catch(error){row.error=String(error.stack||error);row.outcome='route-or-driver-error';}
 finally{active=false;game.updatePlaying=update;game.respawn=respawn;game.physics.resetCargo=resetCargo;game.resetRun=resetRun;}
 row.final=state();row.sameOriginalCargo=game.cargo===cargo;row.sameOriginalBody=game.physics.cargoBody===body;row.frames=proof?.frames??Math.ceil(row.physicsSteps/2);row.sourceAfter=sha(JSON.stringify(sources()));row.harnessAfter=sha(fs.readFileSync(harnessPath));row.sourceStable=row.sourceBefore===row.sourceAfter;row.harnessStable=row.harnessBefore===row.harnessAfter;row.finished=new Date().toISOString();save();console.log(route.canonical?'CANONICAL':'ALTERNATE',route.room,route.name,row.outcome,row.error||'');
}
const after=sources(),all=[...report.routes,...report.canonicalRoutes];
report.source.finished=new Date().toISOString();report.source.changedGameFiles=Object.keys(before).filter(f=>before[f]!==after[f]);report.source.gameSourcesAfterSha256=sha(JSON.stringify(after));report.source.harnessAfterSha256=sha(fs.readFileSync(harnessPath));report.source.headlessHarnessAfterSha256=sha(fs.readFileSync('scripts/lab-headless.mjs'));report.source.sourceStable=report.source.changedGameFiles.length===0;report.source.harnessStable=report.source.harnessSha256===report.source.harnessAfterSha256&&report.source.headlessHarnessSha256===report.source.headlessHarnessAfterSha256;
report.summary={attempted:report.routes.length,completed:report.routes.filter(r=>r.final.won&&r.outcome==='completed-distinct-route').length,canonicalAttempted:report.canonicalRoutes.length,canonicalCompleted:report.canonicalRoutes.filter(r=>r.final.won&&r.outcome==='completed-canonical-route').length,errors:all.filter(r=>r.error).length,originalCargoPreserved:all.every(r=>r.sameOriginalCargo&&r.sameOriginalBody),resets:all.reduce((n,r)=>n+r.resets+r.respawns,0)};
report.pass=report.routes.length>0&&report.canonicalRoutes.length===report.routes.length&&report.source.sourceStable&&report.source.harnessStable&&all.every(r=>r.outcome===(r.canonical?'completed-canonical-route':'completed-distinct-route')&&r.final.won&&r.sameOriginalCargo&&r.sameOriginalBody&&r.resets===0&&r.respawns===0&&r.sourceStable&&r.harnessStable);
save();game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();if(!report.pass)process.exitCode=1;console.log(JSON.stringify(report.summary));
