import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const game=await createHeadlessGame();
game.chamberEdition='classic';
after(()=>{game.physics.dispose();game.portals.dispose();});

for(const aspect of [16/9,1.6])test(`room 17 sends the loose companion through the lowered carriage portal first at aspect ${aspect}`,async()=>{
 await game.selectLevel(16,false);
 game.camera.aspect=aspect;game.camera.updateProjectionMatrix();
 const body=game.physics.cargoBody,group=game.cargo.group,evidence=[];
 const report=await runV8Journey(game,{
  journeyOptions:{route:'cargo-first-momentum'},
  onMilestone:milestone=>{
   if(milestone.name!=='loose companion reached the upper receiver before the player')return;
   evidence.push({
    player:game.playerPosition.toArray(),cargo:game.cargo.position.toArray(),
    playerPortals:game.teleportCount,cargoPortals:game.physics.portalTransports,
    movingPortalY:game.portals.portals[1].position.y,held:game.heldCube,
   });
  },
 });
 assert.equal(report.pass,true);
 assert.equal(game.state,'won');
 assert.equal(report.respawns+report.resets,0);
 assert.equal(game.physics.cargoBody,body);
 assert.equal(game.cargo.group,group);
 assert.equal(evidence.length,1);
 const alone=evidence[0];
 assert.ok(alone.movingPortalY<9,'the portal was actually lowered for the companion');
 assert.ok(alone.player[1]>6.9&&alone.player[1]<7.1,'the player stayed on the original berth');
 assert.ok(alone.cargo[1]>18&&alone.cargo[2]<-18,'the companion entered the upper receiver independently');
 assert.equal(alone.held,null);
 assert.ok(alone.cargoPortals>=2,'the original cargo body crossed the portal');
 assert.ok(report.teleports>alone.playerPortals,'the player followed later');
});
