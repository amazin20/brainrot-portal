import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runTowerJourney} from '../src/game/LabTowerJourney.js';

test('five authored climbs carry the original companion through turns and actual jump gaps',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';
 await game.selectLevel(40,true);
 const level=game.firstLevel,companion=game.cargo,body=game.physics.cargoBody.id;
 try{
  const ascents=level.towerAscents;
  assert.equal(ascents.length,5);
  assert.equal(new Set(ascents.map(a=>a.name)).size,5);
  const [offset,returnGallery,broken,cross,loop]=ascents.map(a=>a.path);
  assert.ok(offset[1][0]>0&&offset[2][0]<0,'The first climb changes lanes on its raised shelf');
  assert.ok(returnGallery[1][2]>returnGallery[3][2],
   'The second climb reverses direction before crossing its upper bridge');
  assert.ok(cross[1][0]<cross[2][0]&&cross[3][0]>cross[4][0],
   'The fourth climb gains height on two opposed transverse flights');
  assert.ok(loop[1][2]>loop[3][2]&&loop[3][2]<loop.at(-1)[2],
   'The fifth climb doubles toward its entrance before crossing overhead');
  for(const z of [19,27.7])assert.equal(game.floors.some(f=>f.enabled!==false&&f.y>=16&&f.y<=24
   &&f.minX<=0&&f.maxX>=0&&f.minZ<=z&&f.maxZ>=z),false,
   `No collision floor may fill the required jump gap at z=${z}`);
  assert.equal(level.deckRoutes[2].filter(a=>a.kind==='jump').length,2);

  const route=await runTowerJourney(game,{stopAfterTransitionDeck:4});
  assert.equal(route.partial,true);
  assert.equal(route.stagesCompleted,15);
  assert.equal(route.keystoneEvents.length,5);
  assert.deepEqual(route.ascentEvents.map(e=>e.deck),[0,1,2,3,4]);
  for(const e of route.ascentEvents){
   assert.ok(Math.abs(e.player[1]-(e.deck+1)*8)<.25,`Deck ${e.deck+1} must be reached physically`);
   assert.equal(e.name,ascents[e.deck].name);
   assert.equal(e.cargo[1]>e.player[1],true,'The held companion reaches the upper hub too');
  }
  const jumps=route.inputEvents.filter(e=>e.type==='jump');
  assert.equal(jumps.length,5,'Windway, the ascent gaps and the press skybridge need physical jumps');
  assert.ok(jumps.some(e=>e.completedStages===7),'The Windway crosses its solid spillway in flight');
  const gapJumps=jumps.filter(e=>e.completedStages===9);
  assert.equal(gapJumps.length,2);
  assert.ok(Math.abs(gapJumps[0].player[2]-broken[1][2])<.5);
  assert.ok(Math.abs(gapJumps[1].player[2]-broken[3][2])<.5);
  assert.deepEqual(jumps.filter(e=>e.completedStages>=10).map(e=>e.completedStages),[10,11],
   'The press skybridge needs one jump before its reactor and one after it');
  assert.equal(route.respawns,0);assert.equal(route.resets,0);assert.equal(route.cargoResets,0);
  assert.equal(game.cargo,companion);assert.equal(game.physics.cargoBody.id,body);
  assert.ok(game.heldCube&&game.cargo.position.distanceTo(game.playerPosition)<3.2);
  assert.equal(game.playerGrounded,true);
  assert.equal(game.state,'playing');
 }finally{game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();}
});
