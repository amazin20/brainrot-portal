import fs from 'node:fs';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {BIOSPHERE_EARLY_ATTACKS,observeBiosphereEarlyAttack,summarizeBiosphereEarlyAttacks,assertBiosphereEarlyAttacks} from '../scripts/lib/biosphere-early-attacks.mjs';
import {BIOSPHERE_LATE_ATTACKS,runBiosphereLateAttack,summarizeBiosphereLateAttacks,assertBiosphereLateAttacks} from '../scripts/lib/biosphere-late-attacks.mjs';
const game=await createHeadlessGame();game.chamberEdition='foundation';game.room23PhysicalPrototype=true;
after(()=>{game.physics.dispose();game.portals.dispose();});
let reports;
test('twenty finite biosphere attacks reach actual targets from zero-step Play with untouched original actors',async()=>{
 reports=[];
 for(const [entries,observe,summarize,validate]of[[BIOSPHERE_EARLY_ATTACKS,observeBiosphereEarlyAttack,summarizeBiosphereEarlyAttacks,assertBiosphereEarlyAttacks],[BIOSPHERE_LATE_ATTACKS,runBiosphereLateAttack,summarizeBiosphereLateAttacks,assertBiosphereLateAttacks]]){
  const cases=[];for(const entry of entries){await game.selectLevel(entry.index,true);const row=await observe(game,entry);cases.push(row);console.log('BIOSPHERE_FINITE_CASE',entry.level,entry.name,JSON.stringify({pass:row.pass,error:row.error,targetFrames:row.targetFrames,final:row.final,attempt:row.attempt}));}
  const report=summarize(cases);reports.push(report);if(process.env.BIOSPHERE_ATTACK_REPORT)fs.writeFileSync(process.env.BIOSPHERE_ATTACK_REPORT+'-'+report.group+'.json',JSON.stringify(report,null,2)+'\n');validate(report);
 }
});
for(const [name,poison]of[
 ['missing coverage',r=>r.cases.pop()],['duplicate case',r=>{r.cases[1]=structuredClone(r.cases[0]);}],['unreached target',r=>{r.cases[0].targetStarted=false;}],['approach error',r=>{r.cases[0].error='Blocked walk before target';}],['reset',r=>{r.cases[0].resets=1;}],['late start',r=>{r.cases[0].normalSpawn=false;}],['new win',r=>{r.cases[0].won=true;}],['missing original body',r=>{r.cases[0].sameBody=false;}],['skipped clock',r=>{r.cases[0].physicsSteps++;}],['unresolved charged impact',r=>{const c=r.cases.find(c=>c.shots.length);c.shots[0].impact=null;}],['missing actual jump',r=>{r.cases[0].attempt.rush.takeoffs=0;}],['scope promoted',r=>{r.nativeAccepted=true;}],['truncated retained trajectory',r=>{r.cases[0].trajectory.pop();}],['nonfinite velocity',r=>{r.cases[0].final.velocity[0]=Infinity;}],
])test('finite raw evidence rejects '+name,()=>{assert.ok(reports?.length===2,'Actual full positive evidence required first');for(const [i,validate]of[assertBiosphereEarlyAttacks,assertBiosphereLateAttacks].entries()){const r=structuredClone(reports[i]);poison(r);assert.throws(()=>validate(r));}});
test('all ten same-source ordinary routes remain positive controls',async()=>{
for(let index=20;index<30;index++){await game.selectLevel(index,true);const r=await runV8Journey(game,{journeyOptions:{nativeStart:true}});assert.equal(r.pass,true);assert.equal(game.state,'won');assert.equal(r.resets,0);assert.equal(r.respawns,0);console.log('BIOSPHERE_POSITIVE_ORDINARY_CONTROL',index+1,r.frames);}
});

test('fresh normal Play rejects cloned definitions and prepared state before any attack simulation',async()=>{await game.selectLevel(20,true);const step=game.physics.world.stepnumber;await assert.rejects(()=>observeBiosphereEarlyAttack(game,{...BIOSPHERE_EARLY_ATTACKS[0]}),/immutable original catalogue/);assert.equal(game.physics.world.stepnumber,step);await game.selectLevel(25,true);const original=game.playerPosition.clone();game.playerPosition.x+=.5;const result=await runBiosphereLateAttack(game,BIOSPHERE_LATE_ATTACKS[0]);assert.equal(result.pass,false);assert.equal(result.normalSpawn,false);assert.match(result.error,/zero-step normal Play/);assert.equal(game.physics.world.stepnumber,0);game.playerPosition.copy(original);});

test('room25 omitted motor is false at actual target and terminal rather than merely failing to rise',()=>{
 assert.ok(reports?.length===2);for(const where of ['target','terminal']){const r=structuredClone(reports[0]),c=r.cases[9];if(where==='target')c.milestones.find(m=>m.phase==='target').causes.driveEnabled=true;else{c.final.causes.driveEnabled=true;c.milestones.at(-1).causes.driveEnabled=true;}assert.throws(()=>assertBiosphereEarlyAttacks(r),/motor input was not actually withheld/);}
});
test('room28 west skirt is bound by actual minimum x and jump height',()=>{
 assert.ok(reports?.length===2);for(const [axis,value]of [['minX',-20],['maxY',5.4]]){const r=structuredClone(reports[1]);r.cases[5].attempt.rush[axis==='minX'?'min':'max'][axis==='minX'?0:1]=value;assert.throws(()=>assertBiosphereLateAttacks(r),/middle occupied tide/);}
});

test('room27 and30 retain absence of sampled grounded far-island landings even if the final player later falls',()=>{
 assert.ok(reports?.length===2);for(const [caseIndex,player,message]of [[3,[-18,8,0],/unprepared final gap/],[9,[200,28,31],/unturned final ballistic/]]){const r=structuredClone(reports[1]),sample=r.cases[caseIndex].trajectory.find(s=>s.phase==='target');assert.ok(sample);sample.player=player;sample.grounded=true;assert.throws(()=>assertBiosphereLateAttacks(r),message);}
});
