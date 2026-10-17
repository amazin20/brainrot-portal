import fs from 'node:fs';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {SECOND_CHAPTER_LATE_ATTACKS,runSecondChapterLateAttack,assertSecondChapterLateAttacks} from '../scripts/lib/second-chapter-late-attacks.mjs';

const game=await createHeadlessGame();game.chamberEdition='foundation';
after(()=>{game.physics.dispose();game.portals.dispose();});
let proof;
test('ten finite ordinary-input attacks approach actual room16–20 barriers using the original actors and current causes',async()=>{
 const report={group:'later',edition:'foundation',scope:'Ten specified finite attempts only; no exhaustive bypass claim',cases:[]};
 for(const attack of SECOND_CHAPTER_LATE_ATTACKS){
  await game.selectLevel(attack.index,true);
  const cargo=game.cargo,body=game.physics.cargoBody,shape=body.shapes[0];let observation;
  const journey=await runV8Journey(game,{journeyOptions:{nativeStart:true},scenario:async d=>{observation=await runSecondChapterLateAttack(d,attack);}});
  observation.journey={pass:journey.pass,resets:journey.resets,respawns:journey.respawns,frames:journey.frames};
  assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
  report.cases.push(observation);
 }
 if(process.env.V61_LATE_REPORT)fs.writeFileSync(process.env.V61_LATE_REPORT,JSON.stringify(report,null,2)+'\n');
 proof=assertSecondChapterLateAttacks(report);
 assert.equal(proof.cases.length,10);assert.equal(proof.cases.filter(c=>c.won).length,0);
});

const mutations=[
 ['missing case',r=>r.cases.pop()],
 ['duplicate case',r=>{r.cases[1]=structuredClone(r.cases[0]);}],
 ['wrong edition',r=>{r.edition='open';}],
 ['unexpected victory',r=>{r.cases[0].won=true;}],
 ['changed cargo identity',r=>{r.cases[0].originalCargo=false;}],
 ['unattempted case',r=>{r.cases[0].attempted=false;}],
 ['case error',r=>{r.cases[0].error='Rejected portal impact';}],
 ['nonfinite actor',r=>{r.cases[0].player[0]=NaN;}],
 ['reset route',r=>{r.cases[0].journey.resets=1;}],
 ['respawn route',r=>{r.cases[0].journey.respawns=1;}],
 ['missing actual samples',r=>{r.cases[0].samples=[];}],
 ['broken world clock',r=>{r.cases[0].finish.worldStep--;}],
 ['incomplete jump',r=>{r.cases[0].attempt.rush.frames--;}],
 ['no actual jump takeoff',r=>{r.cases[0].attempt.rush.takeoffSamples=0;}],
 ['service plinth not approached',r=>{r.cases[0].attempt.rush.minZ=17;}],
 ['weight entered from below',r=>{r.cases[1].requiredCause.padLoaded=true;}],
 ['unsupported bridge reached receiving gallery',r=>{r.cases[2].attempt.rush.receivingGalleryContacts=1;}],
 ['erased pair still supports floor',r=>{r.cases[3].attempt.erased.currentCable=true;}],
 ['closed hatch yielded cargo',r=>{r.cases[4].attempt.pickupResults[0]=true;}],
 ['partial screw pulse never powered',r=>{r.cases[5].attempt.forward.current=0;}],
 ['partial screw pulse secretly opened door',r=>{r.cases[5].attempt.retained.stroke=6.5;}],
 ['missing roof collider',r=>{r.cases[6].attempt.roofCollider.enabled=false;}],
 ['roof pickup approach never landed',r=>{r.cases[6].attempt.before.playerGrounded=false;}],
 ['zero-drive claim contains real momentum',r=>{r.cases[7].attempt.before.wheelOmega=1;}],
 ['ferry reached far dock',r=>{r.cases[7].attempt.rush.farDockContacts=1;}],
 ['near hand input rejected',r=>{r.cases[8].attempt.handResults[0]=false;}],
 ['near hook no longer loaded',r=>{r.cases[8].attempt.after.bearingForce=0;}],
 ['far stop secretly used',r=>{r.cases[9].attempt.after.farHandCount=1;}],
 ['unretained train stayed open',r=>{r.cases[9].attempt.unsupported.opening=7;}],
 ['one electrical terminal powered motor',r=>{r.cases[4].oneContactPoweredSteps=1;}],
];
for(const [name,mutate]of mutations)test(`late evidence rejects ${name}`,()=>{assert.ok(proof,'Actual positive proof must complete first');const copy=structuredClone(proof);mutate(copy);assert.throws(()=>assertSecondChapterLateAttacks(copy));});

test('catalogue entries are immutable and a lookalike cannot replace a reviewed actual attack',async()=>{
 assert.ok(Object.isFrozen(SECOND_CHAPTER_LATE_ATTACKS));assert.ok(SECOND_CHAPTER_LATE_ATTACKS.every(Object.isFrozen));
 await assert.rejects(()=>runSecondChapterLateAttack({}, {...SECOND_CHAPTER_LATE_ATTACKS[0]}),/original catalogue entry/);
});
