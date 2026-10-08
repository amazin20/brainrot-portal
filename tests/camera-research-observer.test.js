import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installCameraResearchObserver} from '../scripts/lib/camera-research-observer.mjs';

test('Research observer preserves actual ordinary room50 route and discloses initialization',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(49,false);
 const original=game.updateVisuals,cargo=game.cargo,body=game.physics.cargoBody;
 const observer=installCameraResearchObserver({game,expose:false});
 try{
  const route=await runV8Journey(game),report=observer.finish(route);
  assert.equal(report.observedVisualFrames,5566);assert.equal(report.originalReferencesEveryFrame,true);
  assert.equal(report.start.cargoUUID,report.finish.cargoUUID);assert.equal(report.start.cargoBodyId,report.finish.cargoBodyId);
  assert.equal(report.resetRunCalls,1);assert.equal(report.resetCargoCalls,1);assert.equal(report.respawnCalls,1);
  assert.equal(report.initializationRespawnFalseCalls,1);assert.equal(report.routeRespawnCalls,0);
  assert.equal(report.cargoTransports,1);assert.equal(report.playerTransports,0);
  assert.equal(report.routeResets,0);assert.equal(report.routeRespawns,0);assert.equal(report.initialization.beforeFirstPositiveVisualFrame,true);
  assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);
  // A normal production reset after the route is delegated, and invalidates
  // the earlier no-reset envelope rather than being suppressed by the observer.
  game.resetRun(true);assert.equal(game.state,'playing');assert.equal(observer.snapshot().resetRunCalls,2);
  assert.throws(()=>observer.finish(route),/joint victory/);
 }finally{observer.dispose();assert.equal(game.updateVisuals,original);game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();}
});

test('Atomic pause/install prevents a real visual tick across the asynchronous pre-route gap',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(49,false);
 const original=game.updateVisuals,cargo=game.cargo,body=game.physics.cargoBody;
 let animationLoop=()=>game.updateVisuals(1/60,1);
 // A scheduling model executes the real engine visual callback after a turn
 // boundary. It models the CDP gap, not browser/GPU or rendered pixel proof.
 game.renderer={setAnimationLoop(callback){animationLoop=callback;}};
 const gap=()=>new Promise(resolve=>setImmediate(()=>{animationLoop?.();resolve();}));
 let observer=installCameraResearchObserver({game,expose:false});
 try{
  await gap();assert.equal(observer.snapshot().observedVisualFrames,1,'Control must actually execute the intervening positive engine frame');
  game.resetRun(true);
  assert.equal(observer.snapshot().initializationBeforeFirstFrame,false,'Unpaused initialization follows the observed frame');
  assert.equal(observer.snapshot().routeRespawnCalls,1,'The old ordering misclassifies the actual initialization respawn');
  observer.dispose();
  animationLoop=()=>game.updateVisuals(1/60,1);
  // Evaluate a serialized copy, as Puppeteer does, so the atomic operation
  // cannot accidentally depend on a Node/import closure.
  const installSerialized=(0,eval)(`(${installCameraResearchObserver.toString()})`);
  observer=installSerialized({game,expose:false,pauseAnimationLoop:true});
  await gap();assert.equal(observer.snapshot().observedVisualFrames,0,'No positive visual update may enter the stopped CDP gap');
  game.resetRun(true);
  const report=observer.snapshot();assert.equal(report.animationLoopPausedAtInstall,true);assert.equal(report.initializationBeforeFirstFrame,true);
  assert.equal(report.resetRunCalls,1);assert.equal(report.resetCargoCalls,1);assert.equal(report.initializationRespawnFalseCalls,1);assert.equal(report.routeRespawnCalls,0);
  assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);
 }finally{observer.dispose();assert.equal(game.updateVisuals,original);game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();}
});
