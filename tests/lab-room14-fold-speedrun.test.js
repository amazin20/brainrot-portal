import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {assertRoom14DeflectorGeometry} from './helpers/lab-room14-deflector-contract.js';

// The5retired jump/E/free-push folded-stair attacks are historical, not
// silently reported as attempts on this completely different room. Their
// current causal counterparts are the actual no/wrong-light recovery and
// carried/glass attacks in lab-room14-deflector-journey.test.js and the live
// current14 catalogue. This file independently protects their geometry causes.
test('current14 has a genuine gap larger than any orientation of the original cargo, not a folded-span shortcut',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(13,false);
 try{
  const {gap,cargoSpaceDiagonal}=assertRoom14DeflectorGeometry(g);assert.ok(gap>cargoSpaceDiagonal);assert.equal(g.firstLevel.state.counterweightStair,undefined);assert.equal(g.firstLevel.state.lightBridge,undefined);
  const legacy=JSON.parse(readFileSync(new URL('./fixtures/early-art-v35-contract.json',import.meta.url))).rooms.find(r=>r.level===14);
  assert.equal(legacy.contract,'86108a1859f9d7e532d20462c91915355fda34565fa266b3c4fb6503311e84e2');assert.equal(legacy.physicalAudit.revision,'counterweighted-folded-stair-2026-10-04');
 }finally{disposeLabLevel(g);}
});
