import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runCampaignShortcutCase} from '../scripts/qa-campaign-shortcuts.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';

test('38: a running maximum-reach dispatch cannot turn the cargo hoist into a player elevator',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';Object.assign(g,ACTIVE_FOUNDATION_RUNTIME_FLAGS);
 try{
  await g.selectLevel(37,false);
  const report=await runCampaignShortcutCase(g,'freight-dispatch-running-board'),proof=report.freightBoarding;
  assert.equal(report.outcome,'finite_attack_observed',report.error);
  assert.equal(report.attackReached,true);assert.equal(report.sameCompanion,true);assert.equal(report.sameCargoShape,true);
  assert.equal(proof.consoleActivated,true);assert.equal(proof.jumpQueued,true);
  assert.ok(proof.sprintSpeedAtActivation>10,'The former exploit needs a genuinely running approach');
  assert.equal(proof.boarded,false);assert.ok(proof.maxPlayerHeight>1,'The attempted board must contain an actual jump');
  assert.equal(proof.liftHeightBefore,0);assert.equal(proof.liftHeightAfter,15);
  assert.ok(proof.after.cargo[1]>14,'The original loose cargo still completes its normal freight ascent');
  assert.equal(proof.after.teleports,0);assert.equal(proof.after.cargoTransports,0);assert.equal(proof.after.won,false);
  assert.equal(report.resets,0);assert.equal(report.respawns,0);
 }finally{g.firstLevel?.dispose?.();g.physics.dispose();g.portals.dispose();}
});
