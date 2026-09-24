import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

for(const aspect of [16/9,1.6])test(`room16 staged-portal delivers the original companion after boarding the lift at aspect ${aspect}`,async()=>{
 const game=await createHeadlessGame();
 try{
  await game.selectLevel(15,false);
  game.camera.aspect=aspect;game.camera.updateProjectionMatrix();
  const identity=game.cargo.group.uuid,body=game.physics.cargoBody.id;
  const isolation=game.firstLevel.terminals.find(t=>t.kind==='portal-isolation');
  assert.ok(isolation,'the island needs a player-accessible terminal to disconnect old portals');
  const originalAction=isolation.action;
  let activations=0;
  isolation.action=()=>{activations++;return originalAction();};
  let staged=false,delivered=false,transportsAtLift=-1;
  const report=await runV8Journey(game,{journeyOptions:{order:'staged-portal'},onMilestone:({name})=>{
   if(name==='the friend waits on an unpaired island-floor portal'){
    staged=true;
    assert.equal(game.heldCube,null);
    assert.equal(game.portals.ready,false,'cargo should wait until the player reaches the lift');
    assert.ok(game.cargo.position.y>7.7,'cargo stands on the permanent high ledge');
   }
   if(name==='the observer reaches the lift before enabling the cargo outlet'){
    assert.ok(staged);
    assert.ok(Math.abs(game.playerPosition.y-2)<.25);
    assert.ok(game.playerPosition.distanceTo(game.cargo.position)>5);
    assert.equal(game.firstLevel.pads[0].loaded(),false);
    transportsAtLift=game.physics.portalTransports;
   }
   if(name==='the original friend fell through the new outlet onto the counterweight'){
    assert.ok(transportsAtLift>=0);
    assert.ok(game.physics.portalTransports>transportsAtLift,'original body must traverse the new pair');
    assert.ok(game.firstLevel.pads[0].loaded(),'real cargo activates the counterweight');
    delivered=true;
   }
  }});
  assert.equal(report.pass,true);
  assert.equal(report.resets,0);
  assert.equal(report.respawns,0);
  assert.equal(game.state,'won');
  assert.ok(staged&&delivered);
  assert.equal(activations,1,'the alternative must use the in-world terminal');
  assert.equal(game.cargo.group.uuid,identity);
  assert.equal(game.physics.cargoBody.id,body);
 }finally{game.physics.dispose();game.portals.dispose();}
});
