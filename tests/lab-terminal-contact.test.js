import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
const g=await createHeadlessGame();
test('mirror controls cannot be reached through a cabin wall but work from inside',async()=>{
 await g.selectLevel(5,false);
 for(const p of [[-8,0,-7.6],[-10.6,0,-5.8],[-8,0,-1.4],[-4.4,0,-5.8]]){
  g.resetRun(true);g.playerPosition.fromArray(p);g.previousPlayerPosition.copy(g.playerPosition);
  assert.equal(g.firstLevel.interact(),false);assert.equal(g.firstLevel.state.target,0);
  assert.equal(g.firstLevel.nearbyInteraction(),null);
 }
 g.playerPosition.set(-7.8,0,-4.6);assert.equal(g.firstLevel.interact(),true);assert.equal(g.firstLevel.state.target,1);
 g.physics.dispose();g.portals.dispose();
});
