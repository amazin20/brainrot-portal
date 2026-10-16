import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {earlyChapterAttacks,runEarlyChapterAttacks,observeEarlyChapterAttack,assertEarlyChapterAttacks,summarizeEarlyChapterAttacks} from '../scripts/lib/first-chapter-early-attacks.mjs';

// The negatives mutate the actual ordinary-input result from the test below;
// there is no synthetic success DTO standing in for a physics observation.
let observed;
async function report(){
 observed??=(async()=>{
  const game=await createHeadlessGame();
  try{return await runEarlyChapterAttacks({game});}
  finally{game.physics.dispose();game.portals.dispose();}
 })();return observed;
}

test('ten actual early-chapter attacks retain original cargo and omit the challenged support or drive',async()=>{
 const r=await report();assert.equal(assertEarlyChapterAttacks(r),r);
 assert.deepEqual(r.cases.map(c=>[c.level,c.name]),earlyChapterAttacks.map(c=>[c.level,c.name]));
 assert.deepEqual(summarizeEarlyChapterAttacks(r.cases).counts,r.counts);
});

test('a fresh normal Play attack observes its original actors without invoking level selection or reset',async()=>{
 const game=await createHeadlessGame();
 try{
  game.chamberEdition='foundation';await game.selectLevel(0,true);
  const select=game.selectLevel,reset=game.resetRun,cargoReset=game.physics.resetCargo;
  game.selectLevel=()=>{throw Error('Observer must not select another room');};
  game.resetRun=()=>{throw Error('Observer must not reset normal Play');};
  game.physics.resetCargo=()=>{throw Error('Observer must not stage its original cargo');};
  const r=await observeEarlyChapterAttack(game,earlyChapterAttacks[0],{nativeStart:true});
  game.selectLevel=select;game.resetRun=reset;game.physics.resetCargo=cargoReset;
  assert.equal(r.error,null);assert.equal(r.nativeStart,true);assert.equal(r.sameOriginalCargo,true);
  assert.deepEqual(r.evidence.resetEvents,[]);assert.equal(r.journeyResets+r.journeyRespawns,0);
 }finally{game.physics.dispose();game.portals.dispose();}
});

for(const [name,mutate]of[
 ['missing addressed attack',r=>{r.cases.pop();r.counts.cases--;}],
 ['duplicate replaces a distinct attempt',r=>{r.cases[1]=structuredClone(r.cases[0]);}],
 ['genuine new win requires review',r=>{r.cases[0].won=true;r.cases[0].verdict='completed-requires-causal-review';}],
 ['interrupted approach cannot become protection',r=>{r.cases[0].error='The player did not reach the target';}],
 ['replacement cargo body',r=>{r.cases[0].identity.final.body++;}],
 ['reset during the attempted route',r=>{r.cases[0].evidence.resetEvents.push({kind:'respawn',started:true,physicsSteps:400});}],
 ['CPU reset mislabelled as fresh native Play',r=>{r.cases[0].nativeStart=true;}],
 ['missing trajectory segment',r=>{r.cases[0].evidence.trajectory.splice(2,1);}],
 ['nonfinite observed motion',r=>{r.cases[0].evidence.trajectory[0].velocity[0]=NaN;}],
 ['forged final actor pose',r=>{r.cases[0].final.player[0]+=1;}],
 ['missing all-projectile witness',r=>{r.cases[2].evidence.projectileOutcomes.pop();}],
 ['wrong actual addressed ceramic',r=>{r.cases[2].evidence.shots[1].actualSurfaceId='other-real-sheet';}],
 ['source portal took a different real ceramic',r=>{r.cases[2].evidence.projectileOutcomes[0].valid=false;}],
 ['drive was actually powered',r=>{r.cases[8].evidence.airObserved=true;}],
 ['passenger cabin actually rose',r=>{r.cases[8].evidence.maxCabinHeight=.1;}],
 ['carriage actually moved',r=>{r.cases[4].evidence.maxCarTravel=.1;}],
 ['direct-transit attempt never traversed',r=>{r.cases[2].final.teleports=0;r.cases[2].evidence.events.at(-1).teleports=0;}],
 ['false global acceptance claim',r=>{r.accepted=true;}],
])test('early chapter proof rejects '+name,async()=>{
 const r=structuredClone(await report());mutate(r);assert.throws(()=>assertEarlyChapterAttacks(r),/Early chapter attack proof:/);
});
