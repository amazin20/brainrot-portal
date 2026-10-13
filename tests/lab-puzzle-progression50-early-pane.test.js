import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runCampaignShortcutCase} from '../scripts/qa-campaign-shortcuts.mjs';

test('50 first weighted cup cannot install the early upper passenger address that skipped the opposite cup',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';game.puzzleProgression=true;
 try{
  await game.selectLevel(49,false);const cargo=game.cargo,body=game.physics.cargoBody;
  const report=await runCampaignShortcutCase(game,'folded-rift-first-cup-direct-upper-address');
  assert.equal(report.attackReached,true,'the real first-cup and west-gallery prefix must finish before judging the attack');
  assert.equal(report.outcome,'finite_attack_observed',report.error);
  assert.equal(report.forbiddenUpperAddressReached,undefined);
  assert.equal(report.final.won,false);
  assert.equal(report.sameCompanion,true);assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);
  assert.ok(report.shots.length>=7,'all four original gallery views and three real lower service views must execute');
  assert.ok(report.shots.every(s=>s.accepted),'each claimed blocked address requires an actual accepted projectile input');
  assert.ok(report.shots.every(s=>!(s.correct&&s.impact?.valid)),'the upper pane must not be addressed before any opposite-cup contact');
  const originalImpact=new THREE.Vector3().fromArray(report.shots[0].impact.position);
  assert.equal(report.shots[0].impact.reason,'surface');
  assert.ok(game.firstLevel.upperCasing.some(mesh=>new THREE.Box3().setFromObject(mesh).expandByScalar(.0001).containsPoint(originalImpact)),'the original killing view must hit the visible physical casing');
  assert.equal(report.final.rotor.loadedB,false);
 }finally{game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();}
});
