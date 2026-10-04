import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

// The former staged floor→ceiling delivery skipped disappearance of support.
// Retained observation orders must perform the actual gravity drop instead.
for(const aspect of [16/9,9/16])for(const order of ['cargo-first','scout-first'])
test(`room16 ${order} drops the original friend by extinguishing support at aspect ${aspect}`,async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';
 try{
  await game.selectLevel(15,false);
  game.camera.aspect=aspect;game.camera.updateProjectionMatrix();
  const identity=game.cargo.group.uuid,body=game.physics.cargoBody.id;
  let transportsAtSupport,restHeight,dropped=false;
  const report=await runV8Journey(game,{journeyOptions:{order},onMilestone:({name})=>{
   if(name==='companion waits on borrowed support'){
    assert.equal(game.heldCube,null);
    assert.ok(game.cargo.position.y>7,'the original body must first stand on projected support');
    assert.equal(game.firstLevel.pads[0].loaded(),false);
    restHeight=game.cargo.position.y;transportsAtSupport=game.physics.portalTransports;
   }
   if(name==='the original friend falls from extinguished support into the open gravity well'){
    assert.ok(restHeight>7);
    assert.equal(game.physics.portalTransports,transportsAtSupport,'freight must fall physically, not be injected by a portal');
    assert.ok(game.cargo.position.y<2.8,'the original body must reach the actual lower basin');
    assert.ok(game.firstLevel.pads[0].loaded(),'its real contact must power the lift');
    assert.ok(Math.abs(game.playerPosition.y-2)<.25);
    dropped=true;
   }
  }});
  assert.equal(report.pass,true);
  assert.equal(report.resets,0);
  assert.equal(report.respawns,0);
  assert.equal(game.state,'won');
  assert.ok(dropped);
  assert.equal(game.cargo.group.uuid,identity);
  assert.equal(game.physics.cargoBody.id,body);
 }finally{game.physics.dispose();game.portals.dispose();}
});
