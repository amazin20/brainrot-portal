/** Finite production-input attacks; this report is evidence for these attempts,
 * not a mathematical claim that every imaginable shortcut has been excluded. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installRoom21Aim} from '../src/game/LabRoom21Journey.js';
import {runPostA} from '../src/game/LabPostJourneyA.js';
import {runPostB} from '../src/game/LabPostJourneyB.js';
const selection=process.argv.find(a=>a.startsWith('--levels='))?.slice(9),numbers=selection?selection.split(',').flatMap(v=>v.includes('-')?Array.from({length:Number(v.split('-')[1])-Number(v.split('-')[0])+1},(_,i)=>Number(v.split('-')[0])+i):[Number(v)]):Array.from({length:20},(_,i)=>i+21);
const canonicalOnly=process.argv.includes('--canonical-only'),attacksOnly=process.argv.includes('--attacks-only'),out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'qa/adversarial-late.json';
const results=[];
function state(g){const l=g.firstLevel,r={player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),won:g.state==='won',held:!!g.heldCube,cargoTransports:g.physics.portalTransports};if(l.rack)r.rack={stroke:l.rack.stroke,latched:l.rack.latched};if(l.optics)r.optics={...l.optics};if(l.spring)r.spring={compression:l.spring.compression,held:l.spring.held};if(l.pressureState)r.pressure={pressure:l.pressureState.pressure,coverage:l.pressureState.coverage,mode:l.pressureState.mode,doorTravel:l.pressureState.doorTravel};if(l.rotor)r.rotor={angle:l.rotor.angle};if(l.getMagnet)r.magnet=l.getMagnet();if(l.getCalibration)r.calibration=l.getCalibration();if(l.thermal)r.thermal={temperature:l.thermal.temperature,energy:l.thermal.energy,powered:l.thermal.powered,remote:l.thermal.remote,extension:l.thermal.extension};return r;}
function pickup(d){const c=d.game.cargo.position;d.walk(c.x+1.2,c.z);if(d.game.kineticMode&&d.game.velocityCompanion){assert.ok(d.game.interact());assert.ok(d.game.velocityCompanion.connected);d.wait(.5);}else d.pickup();}
function boundedWalk(d,x,z){try{d.walk(x,z,12);}catch(e){if(!/Blocked walking|Walk timed out/.test(e.message))throw e;return e.message;}return null;}
async function run(number,kind,scenario){const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(number-1,false);const started=Date.now();let result;try{const r=await runV8Journey(g,scenario?{scenario}:{});result={level:number,id:g.firstLevel.id,kind,pass:r.pass,frames:r.frames,resets:r.resets,respawns:r.respawns,seconds:(Date.now()-started)/1000,milestones:r.milestones,state:state(g)};}catch(e){result={level:number,id:g.firstLevel.id,kind,pass:false,error:e.message,seconds:(Date.now()-started)/1000,state:state(g)};}finally{g.physics.dispose();g.portals.dispose();}results.push(result);console.log(result.pass?'PASS':'FAIL',number,kind,result.error||'');fs.mkdirSync('qa',{recursive:true});fs.writeFileSync(out,JSON.stringify({pass:results.every(r=>r.pass),scope:'Finite ordinary-input canonical routes and early-exit/load-skipping/portal-finish/sprint-jump attempts. No actor poses or mechanism targets are assigned.',results},null,2)+'\n');}
for(const n of numbers){
 if(!attacksOnly)await run(n,'canonical');
 if(canonicalOnly)continue;
 await run(n,'carry-skips-load-sprint-jump',d=>{const g=d.game,goal=d.level.goal.position;
 if(n===35){
  const original=g.cargo,body=g.physics.cargoBody;
  const blocked=boundedWalk(d,g.cargo.position.x+1.2,g.cargo.position.z);
  assert.ok(blocked,'The closed physical first sluice must block the far cargo approach');
  g.input.keys.add('ShiftLeft');for(let i=0;i<240;i++){if(i%40===0)g.input.jumpQueued=true;d.worldMove(0,-1);d.frame();}d.stop();
  assert.equal(g.interact(),false);assert.equal(g.heldCube,null);
  boundedWalk(d,goal.x,goal.z);assert.equal(g.state,'playing');assert.equal(g.cargo,original);assert.equal(g.physics.cargoBody,body);
  assert.equal(g.physics.portalTransports,0);assert.equal(d.level.isFirstLatched(),false);assert.equal(d.level.isLatched(),false);
  d.mark('Actual cargo approach and sprint-jump blocked by closed sluice before sealed far bay; early entry goal cannot complete without original cargo');return;
 }
 pickup(d);const blocked=boundedWalk(d,goal.x,goal.z);g.input.keys.add('ShiftLeft');for(let i=0;i<200&&g.state==='playing';i++){if(i%40===0)g.input.jumpQueued=true;const v=goal.clone().sub(g.playerPosition);v.y=0;v.normalize();d.worldMove(v.x,v.z);d.frame();}d.stop();assert.equal(g.state,'playing','Carrying the original body directly must not replace the room mechanism');assert.ok(g.heldCube||g.velocityCompanion?.connected);d.mark(`Early direct carry, sprint and repeated jumps arrested${blocked?' by a real obstacle':''}`);});
 await run(n,'portal-to-finish-before-load',d=>{const g=d.game,goal=d.level.goal.position.clone();goal.y+=1.2;installRoom21Aim(d);d.look(goal);assert.ok(g.firePortal(1));d.until(()=>!g.portalShots.queue.length&&!g.portalShots.active.length,3,'Early finish charge did not resolve');const finishImpact={...g.portalShots.lastImpact};const floor=Object.values(d.level.panels).filter(p=>p.getFrame().normal.y>.95).sort((a,b)=>a.getFrame().center.distanceToSquared(g.playerPosition)-b.getFrame().center.distanceToSquared(g.playerPosition))[0];if(floor){try{d.aim(0,floor.getFrame().center);}catch(e){if(!/Rejected shot/.test(e.message))throw e;}}
 if(n===35){
  const blocked=boundedWalk(d,g.cargo.position.x+1.2,g.cargo.position.z);assert.ok(blocked);
  assert.equal(g.interact(),false);assert.equal(g.state,'playing');assert.equal(g.physics.portalTransports,0);
  assert.equal(d.level.isFirstLatched(),false);assert.equal(d.level.isLatched(),false);
  d.mark('Real finish-directed shot and attempted far-floor shot cannot expose or collect the sealed original cargo through closed sluices');return;
 }
 pickup(d);if(floor)boundedWalk(d,floor.getFrame().center.x,floor.getFrame().center.z);boundedWalk(d,goal.x,goal.z);assert.equal(g.state,'playing','Early finish-directed projectiles must not skip the causal route');d.mark(`Finish charge ${finishImpact.valid?'intercepted by '+finishImpact.surface:'rejected: '+finishImpact.reason}; actual travel remains incomplete`);});
}
const stages={
 31:d=>{runPostA(d,{route:'inspect-rack-first',stopBeforeCargoDelivery:true});assert.ok(d.level.rack.stroke<.02);assert.equal(d.level.rack.latched,false);assert.equal(d.game.physics.portalTransports,0);d.mark('Empty airflow cannot perform mechanical rack work');},
 32:d=>{runPostA(d,{route:'inspect-optics-first',stopBeforeCargoDelivery:true});assert.deepEqual(d.level.optics.raw,[true,true]);assert.deepEqual(d.level.optics.shadow,[false,false]);assert.equal(d.level.optics.valid,false);assert.ok(d.level.diaphragm.progress<.01);d.mark('Equal raw light cannot substitute for cargo-height opacity');},
 33:d=>{runPostA(d,{stopBeforeRelease:true});assert.ok(d.level.spring.compression>.65&&d.level.spring.held);assert.ok(d.level.spring.loaded());d.wait(2);assert.equal(d.game.physics.portalTransports,0);assert.equal(d.level.catcher.loaded(),false);assert.ok(d.level.door.progress<.01);d.mark('Stored elastic deformation remains physical and inert under its clamp');},
 34:d=>{runPostA(d,{stopBeforeCharge:true});assert.ok(d.level.pressureState.pressure<3);assert.ok(d.level.pressureState.coverage<.01);assert.ok(d.level.pressureState.doorTravel<.1);d.mark('An exposed geometric leak cannot accumulate working pressure');},
 37:d=>{runPostB(d,{route:'prepare-fields-first',stopBeforeFeed:true});d.wait(2);assert.equal(d.level.receiver.loaded(),false);assert.ok(d.level.door.progress<.01);d.mark('Fields without original cargo cannot load the receiver');},
 39:d=>{runPostB(d,{stopBeforeDiversion:true});const initial=d.level.thermal.energy;d.wait(25);assert.equal(d.level.thermal.powered,false);assert.equal(d.level.thermal.remote,true);assert.ok(d.level.thermal.energy<initial*.3);assert.ok(d.level.first.progress<.3);assert.ok(d.level.second.progress>.9);pickup(d);assert.ok(boundedWalk(d,0,-21));assert.equal(d.game.state,'playing');d.mark('Remote power does not preserve the cold first door');},
 40:d=>{runPostB(d,{stopBeforeWeight:true});assert.equal(d.level.getCalibration().lit,false);assert.equal(d.level.getCalibration().clamped,false);assert.ok(d.level.door.progress<.01);d.mark('One common adjustment cannot remove opposite slit offsets without cargo moment');},
};
if(!canonicalOnly)for(const n of numbers)if(stages[n])await run(n,'stage-causal-negative',stages[n]);
const pass=results.every(r=>r.pass);console.log(`Late rooms: ${results.filter(r=>r.pass).length}/${results.length} passed. Report ${out}`);if(!pass)process.exitCode=1;
