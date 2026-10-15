import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {resolvePortalPlacement} from '../src/game/LabPortals.js';

test('Room25 declares every actual ceramic host while its physical freight deck remains a separate nonportal mechanism',async()=>{
 const game=await createHeadlessGame();
 try{
  await game.selectLevel(24,true);
  const level=game.firstLevel,names=['light-intake','lower-relay','freight-receiver','upper-relay','return-entry','home'].sort();
  const actual=level.world.surfaces.filter(surface=>surface.portal);
  assert.deepEqual(actual.map(surface=>surface.name).sort(),names);
  assert.deepEqual(Object.keys(level.panels).sort(),names);
  assert.deepEqual(Object.keys(level.puzzleGeometry.portalRoles).sort(),names);
  assert.deepEqual(new Set(game.portalPanels),new Set(actual.map(surface=>surface.mesh)));
  for(const surface of actual){
   assert.equal(level.panels[surface.name],surface);
   assert.equal(surface.mesh.userData.portalable,true);
   assert.ok(level.puzzleGeometry.portalRoles[surface.name].length>8);
  }
  const deck=level.mechanismSurfaces['shadow-counterweight'],machine=level.state.optical.machine;
  assert.equal(level.panels['shadow-counterweight'],undefined);
  assert.equal(level.puzzleGeometry.portalRoles['shadow-counterweight'],undefined);
  assert.equal(level.world.surfaces.includes(deck),true);
  assert.equal(level.pads[0].surface,deck);
  assert.ok(level.puzzleGeometry.mechanismRoles['shadow-counterweight'].length>8);
  assert.equal(deck.portal,false);assert.equal(deck.mesh.userData.portalable,undefined);
  assert.equal(game.portalPanels.includes(deck.mesh),false);
  assert.deepEqual(resolvePortalPlacement(deck.mesh,deck.getFrame().center),{ok:false,reason:'forbidden'});
  assert.ok(machine.parts.some(part=>part.mesh===deck.mesh&&part.collider===deck.collider&&part.body===machine.deckBody));
  assert.equal(game.physics.bodyBoxes.get(deck.mesh.uuid).body,machine.deckBody);
  assert.equal(game.physics.inspectBodyBox(deck.mesh.uuid,{bounds:deck.collider.box}).valid,true);
 }finally{game.firstLevel?.dispose?.();game.physics.dispose();game.portals.dispose();}
});
