import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {campaignSpec} from '../src/game/LabCampaignLevels.js';

test('room16 starts with only its declared production models loaded',async()=>{
 const game=await createHeadlessGame();
 try{
  game.chamberEdition='classic';
  const declared=campaignSpec(game,15).assets,preloaded=game.assets;
  game.assets=new Map(declared.map(id=>[id,preloaded.get(id)]));
  assert.equal(game.assets.size,declared.length);
  assert.ok([...game.assets.values()].every(Boolean),'every declared model needs a GLB');
  await game.selectLevel(15,false);
  assert.equal(game.state,'ready');
  assert.ok(game.firstLevel.terminals.some(t=>t.kind==='portal-isolation'));
 }finally{game.physics?.dispose();game.portals?.dispose();}
});
