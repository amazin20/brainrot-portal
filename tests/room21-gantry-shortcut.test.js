import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runRoom21GantryAttempt} from '../scripts/room21-gantry-attempt.mjs';
const game=await createHeadlessGame();await game.selectLevel(20,false);
after(()=>{game.physics.dispose();game.portals.dispose();});

test('ordinary two-jump gantry shortcut is blocked and walking recovery preserves the unpowered source',async()=>{
  const r=await runRoom21GantryAttempt(game);
  assert.equal(r.firstLanded,false);assert.equal(r.reachedHighSource,false);assert.equal(r.bypass,false);
  assert.equal(r.recovered,true);assert.equal(r.sourceLatched,false);assert.equal(r.bridge,0);
  assert.equal(r.route.resets,0);assert.equal(r.route.respawns,0);assert.equal(r.route.teleports,0);
});

test('housing bounds follow the visible frame; cached source transforms stay unchanged during bridge animation',()=>{
  const art=game.firstLevel.state.sourceDrive.presentation,visible=new THREE.Box3().setFromObject(art.frame);
  assert.ok(Math.abs(visible.min.y-.08)<1e-5);assert.ok(Math.abs(visible.max.y-12.08)<1e-5);
  assert.ok(art.housing.box.min.distanceTo(visible.min)<1e-6);
  assert.ok(art.housing.box.max.distanceTo(visible.max)<1e-6);
  assert.equal(art.frame.visible,true);
  // The cached source retains its transforms during this instance's animation.
  const source=game.assets.get(33),before=new THREE.Box3().setFromObject(source).clone();
  const matrices=[];source.traverse(o=>matrices.push(o.matrix.toArray()));
  for(const y of [0,3.5,7]){game.firstLevel.state.sourceDrive.bridge.group.position.y=y;art.render();}
  assert.ok(new THREE.Box3().setFromObject(source).equals(before));
  let index=0;source.traverse(o=>assert.deepEqual(o.matrix.toArray(),matrices[index++]));
  game.resetRun(true);
});
