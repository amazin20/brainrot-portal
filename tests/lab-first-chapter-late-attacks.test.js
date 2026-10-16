import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {FIRST_CHAPTER_LATE_ATTACKS,runFirstChapterLateAttack,assertFirstChapterLateAttacks} from '../scripts/lib/first-chapter-late-attacks.mjs';

const game=await createHeadlessGame();game.chamberEdition='foundation';
const captured={group:'later',edition:'foundation',cases:[]};
after(()=>{game.physics.dispose();game.portals.dispose();});
for(const attack of FIRST_CHAPTER_LATE_ATTACKS)test(`fresh ordinary attack ${attack.id}`,async()=>{
 await game.selectLevel(attack.index,false);let observation;
 const report=await runV8Journey(game,{scenario:async d=>{observation=await runFirstChapterLateAttack(d,attack);}});
 assert.equal(report.pass,true);assert.equal(report.resets+report.respawns,0);
 assert.equal(observation.originalCargo,true);assert.equal(observation.won,false,JSON.stringify(observation));
 assert.equal(observation.goalReached,false,JSON.stringify(observation));
 if(attack.kind==='cabin-slot')assert.equal(observation.cabinEntered,false,JSON.stringify(observation));
 if(attack.kind==='tower-roof')assert.equal(observation.towerWallCrossed,false,JSON.stringify(observation));
 if(attack.kind==='spring-guard'){
  assert.equal(observation.requiredCause.latched,false,JSON.stringify(observation));
  assert.equal(observation.cupEntered,false,JSON.stringify(observation));
 }
 if(attack.kind.startsWith('dock-'))assert.equal(observation.requiredCause.locked,false,JSON.stringify(observation));
 if(attack.kind==='dock-roof')assert.equal(observation.closedHoodEntered,false,JSON.stringify(observation));
 if(attack.kind==='dock-before-extension')assert.equal(observation.cargoArrived,true,JSON.stringify(observation));
 captured.cases.push({...observation,journey:{pass:report.pass,resets:report.resets,respawns:report.respawns,frames:report.frames}});
});

test('current pure late-attack gate accepts its actual closed production observations and rejects altered evidence',()=>{
 assert.equal(assertFirstChapterLateAttacks(captured).pass,true);
 if(process.env.FIRST_CHAPTER_LATE_ATTACK_OUTPUT)fs.writeFileSync(process.env.FIRST_CHAPTER_LATE_ATTACK_OUTPUT,JSON.stringify(captured,null,2));
 const mutations=[
  r=>r.group='early',r=>r.edition='classic',r=>r.cases.pop(),r=>r.cases[1]=r.cases[0],
  r=>r.cases[0].index=6,r=>r.cases[0].originalCargo=false,r=>r.cases[0].won=true,
  r=>r.cases[0].cargoHeld=false,
  r=>r.cases[0].goalReached=true,r=>r.cases[0].samples=1,r=>r.cases[0].maxY=NaN,
  r=>r.cases[0].player=[0,Infinity,0],r=>r.cases[0].teleportsBefore=1,
  r=>r.cases[0].journey.pass=false,r=>r.cases[0].journey.resets=1,
  r=>r.cases[0].journey.respawns=1,r=>r.cases[0].journey.frames=1,
  r=>r.cases[0].requiredCause.receiverLit=true,r=>r.cases[0].requiredCause.doorProgress=1,
  r=>r.cases.find(c=>c.id==='optical-cabin-jump-slot').cabinEntered=true,
  r=>r.cases.find(c=>c.id==='balance-tower-roof').maxX=-8,
  r=>r.cases.find(c=>c.id==='air-unpowered-pair').requiredCause.fanSpeed=.1,
  r=>r.cases.find(c=>c.id==='air-unpowered-pair').teleports=0,
  r=>r.cases.find(c=>c.id==='air-unrouted-live-fan').requiredCause.pairReady=true,
  r=>r.cases.find(c=>c.id==='air-founded-column-cargo-step').requiredCause.fanEnabled=true,
  r=>r.cases.find(c=>c.id==='spring-original-cargo-step').requiredCause.latched=true,
  r=>r.cases.find(c=>c.id==='spring-original-cargo-step').requiredCause.compression=.72,
  r=>r.cases.find(c=>c.id==='dock-receiver-before-extension').cargoArrived=false,
  r=>r.cases.find(c=>c.id==='dock-receiver-before-extension').requiredCause.bridgeProgress=1,
  r=>r.cases.find(c=>c.id==='dock-empty-roof-hatch').closedHoodEntered=true,
  r=>r.cases.find(c=>c.id==='dock-empty-roof-hatch').requiredCause.locked=true,
 ];
 for(const mutate of mutations){const altered=structuredClone(captured);mutate(altered);
  assert.throws(()=>assertFirstChapterLateAttacks(altered),/first-chapter-later:/);
 }
});
