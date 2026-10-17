import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {SECOND_CHAPTER_EARLY_ATTACKS,observeSecondChapterEarlyAttack,summarizeSecondChapterEarlyAttacks,assertSecondChapterEarlyAttacks} from '../scripts/lib/second-chapter-early-attacks.mjs';

let game,report;
before(async()=>{
 game=await createHeadlessGame();game.chamberEdition='foundation';const cases=[];
 for(const entry of SECOND_CHAPTER_EARLY_ATTACKS){await game.selectLevel(entry.level-1,true);cases.push(await observeSecondChapterEarlyAttack(game,entry,{nativeStart:true}));}
 report=summarizeSecondChapterEarlyAttacks(cases);
});
after(()=>{game?.physics.dispose();game?.portals.dispose();});

test('ten finite normal-control attacks retain original actors, real approaches and complete charged impacts',()=>{
 assertSecondChapterEarlyAttacks(report);
 assert.deepEqual([...new Set(report.cases.map(c=>c.level))],[11,12,13,14,15]);
 assert.ok(report.cases.every(c=>c.targetFrames>=120&&c.jumpInputs>0&&c.initial.worldStep===0));
});

for(const [name,poison]of [
 ['approach failure',r=>{r.cases[0].approachComplete=false;}],
 ['missing target input',r=>{r.cases[0].targetFrames=0;}],
 ['no actual jump',r=>{r.cases[0].jumpInputs=0;}],
 ['caught setup error',r=>{r.cases[0].error='Walking blocked before target';}],
 ['new full room win',r=>{r.cases[0].completed=true;r.cases[0].final.won=true;}],
 ['fixture reset after Play',r=>{r.cases[0].resets=1;}],
 ['late start',r=>{r.cases[0].normalSpawn=false;}],
 ['non-native driver start',r=>{r.cases[0].nativeStart=false;}],
 ['replacement actor',r=>{r.cases[0].sameCargo=false;}],
 ['replacement rigid body',r=>{r.cases[0].sameBody=false;}],
 ['replacement mesh buffers',r=>{r.cases[0].sameGeometry=false;}],
 ['rejected charged shot',r=>{const c=r.cases.find(c=>c.shots.length);c.shots[0].impact.valid=false;}],
 ['missing charged impact',r=>{const c=r.cases.find(c=>c.shots.length);c.shots[0].impact=null;}],
 ['different valid ceramic',r=>{const c=r.cases.find(c=>c.shots.length);c.shots[0].actualSurfaceId='different-valid-panel';}],
 ['unrecorded charged shot',r=>{const c=r.cases.find(c=>c.shots.length);c.shots.pop();}],
 ['caught charge error',r=>{const c=r.cases.find(c=>c.shots.length);c.shots[0].error='not aimed';}],
 ['world clock divergence',r=>{r.cases[0].worldStepDelta++;}],
 ['simulated duration forgery',r=>{r.cases[0].simulationSeconds+=1;}],
 ['visual clock divergence',r=>{r.cases[0].journeyFrames++;}],
 ['nonfinite rigid-body velocity',r=>{r.cases[0].final.cargoVelocity[0]=Infinity;}],
 ['duplicate entry replacing coverage',r=>{r.cases[1]=structuredClone(r.cases[0]);}],
 ['missing room case',r=>{r.cases.pop();}],
 ['fabricated summary count',r=>{r.counts.physicsSteps++;}],
 ['missing retained trajectory sample',r=>{r.cases[0].trajectory.pop();}],
 ['forged trajectory clock',r=>{r.cases[0].trajectory[1].worldStep++;}],
 ['incomplete terminal milestone',r=>{r.cases[0].milestones.pop();}],
 ['unreviewed powered drive',r=>{const c=r.cases[0];c.final.causes.ratchet=true;c.milestones.at(-1).causes.ratchet=true;}],
 ['mirror release no longer lowers the same cage',r=>{const c=r.cases[4],y=c.milestones.find(m=>m.name==='live southern lift has not completed its ascent').causes.southCage;c.final.causes.southCage=y;c.milestones.at(-1).causes.southCage=y;}],
 ['carried body secretly supports the stair',r=>{const c=r.cases[6];c.final.causes.stairSupported=true;c.milestones.at(-1).causes.stairSupported=true;}],
 ['early original-body retrieval',r=>{const c=r.cases[8];c.final.held=true;c.milestones.at(-1).held=true;}],
 ['unrequested elevated transverse field',r=>{const c=r.cases[9],s={a:[0,20,0],b:[10,20,0],direction:[1,0,0]};c.final.causes.funnelSegments.push(s);c.milestones.at(-1).causes.funnelSegments.push(structuredClone(s));}],
])test('the raw proof gate rejects '+name,()=>{const poisoned=structuredClone(report);poison(poisoned);assert.throws(()=>assertSecondChapterEarlyAttacks(poisoned));});

test('catalogue observers reject cloned dispatch entries before simulation',async()=>{
 await game.selectLevel(10,true);const step=game.physics.world.stepnumber;
 await assert.rejects(()=>observeSecondChapterEarlyAttack(game,{...SECOND_CHAPTER_EARLY_ATTACKS[0]},{nativeStart:true}),/actual second chapter early catalogue/);
 assert.equal(game.physics.world.stepnumber,step);
});
