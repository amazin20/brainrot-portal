import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

test('34: restarting after releasing the counterweight restores its starting clamp',async()=>{
 const game=await createHeadlessGame();
 try{
  game.chamberEdition='foundation';
  await game.selectLevel(33,false);
  const level=game.firstLevel;
  level.state['start-counterweightControl'].action();
  assert.equal(level.getClamped(),false,'Release control must unlock the lift');
  game.resetRun(true);
  assert.equal(level.getClamped(),true,'Restart must restore the mechanical clamp');
  assert.equal(level.left.braked,true);
  assert.equal(level.right.braked,true);
  const report=await runV8Journey(game);
  assert.equal(report.pass,true,'The restarted puzzle must still be solvable');
  assert.equal(game.state,'won');
 }finally{game.physics.dispose();game.portals.dispose();}
});
