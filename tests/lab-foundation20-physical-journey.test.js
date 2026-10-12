import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runFoundation20PhysicalJourney} from '../src/game/LabFoundation20PhysicalJourney.js';
import {assertFoundation20Route,FOUNDATION20_MARKS} from '../scripts/lib/foundation20-native-proof.mjs';

const game=await createHeadlessGame();game.chamberEdition='foundation';
after(()=>{game.physics.dispose();game.portals.dispose();});
for(const options of [{order:'cargo-first'},{order:'scout-first',recovery:true},{order:'cargo-first',recovery:true,recoveryPhase:'after-near-release'}]){
 test(`actual Foundation20 ordinary ${options.order}${options.recovery?' erasure and restoration '+(options.recoveryPhase??'before-near-release'):''} keeps the original companion and both real catches`,async()=>{
  await game.selectLevel(19,true);
  assert.equal(game.chamberEdition,'foundation');assert.equal(game.levelIndex,19);assert.equal(game.firstLevel.creativeEarly,20);
  assert.equal(game.firstLevel.id,'foundation-portal-tension');
  const original=game.cargo,body=game.physics.cargoBody,world=game.physics.world,initialStep=world.stepnumber;
  let postSteps=0,previous=initialStep,retainingSteps=0;const onStep=()=>{
   assert.equal(world.stepnumber,previous+1);previous=world.stepnumber;postSteps++;
   assert.equal(game.physics.cargoBody,body);assert.equal(body.mass,3.2);assert.equal(body.type,1);
   const d=game.firstLevel.stopFinger.diagnostics();if(game.firstLevel.rope.tension===0&&d.retainingContacts>0){retainingSteps++;assert.ok(d.retainingForce>0);assert.equal(d.liveOwnership,true);}
  };
  world.addEventListener('postStep',onStep);
  try{
   const report=await runFoundation20PhysicalJourney(game,options);assertFoundation20Route(report);
   assert.equal(postSteps,report.physicsSteps);assert.equal(world.stepnumber-initialStep,report.physicsSteps);
   assert.equal(game.cargo,original);assert.equal(game.physics.cargoBody,body);assert.ok(retainingSteps>120);
   assert.equal(game.state,'won');assert.equal(game.heldCube,original);
   const events=new Map(report.milestones.map(m=>[m.name,m]));
   assert.equal(events.get(FOUNDATION20_MARKS.retained).rope.currentPair,false);
   if(options.recovery){
    const afterRelease=options.recoveryPhase==='after-near-release';
    const cut=events.get(afterRelease?'ordinary post-release recovery shot removes tension; the unretained spring returns the same train':'ordinary recovery shot removes tension; the still closed near hook and spring return the gate');
    const restored=events.get(afterRelease?'restored current pair reopens the already released hook and same train without a new E or reset':'restored current pair reloads the same original free cargo without a reset');
    assert.ok(cut&&restored&&cut.frame<restored.frame);assert.equal(cut.rope.tension,0);assert.ok(cut.rope.opening<.15);
    assert.equal(cut.cargoBodyId,body.id);assert.equal(restored.cargoBodyId,body.id);assert.ok(restored.rope.tension>0);
    if(afterRelease){assert.equal(cut.nearHook.handCount,2);assert.equal(restored.nearHook.handCount,2);assert.ok(restored.rope.opening>6.95);}
   }
  }finally{world.removeEventListener('postStep',onStep);}
 });
}
