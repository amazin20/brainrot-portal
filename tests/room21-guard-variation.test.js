import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {probeRoom21ClosedGuard} from '../scripts/room21-guard-probe.mjs';
const game=await createHeadlessGame();await game.selectLevel(20,false);
after(()=>{game.physics.dispose();game.portals.dispose();});
for(const offset of [-1.4,0,1.4])for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const steer of [-1,0,1])
 test(`closed-guard contact fixture: exit offset=${offset}, orientation=${yaw}, air steer=${steer}`,()=>{
  const result=probeRoom21ClosedGuard(game,{offset,yaw,steer});
  assert.equal(result.transferred,true,'A missed entry must not be reported as blocked bypass');
  assert.equal(result.landed,true);assert.equal(result.maxGuard,0);assert.equal(result.held,true);
  assert.equal(result.bypass,false);assert.equal(result.pass,true);
 });
