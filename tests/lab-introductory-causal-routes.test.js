import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

async function journey(index,route){
 await game.selectLevel(index,false);
 const friend=game.cargo,body=game.physics.cargoBody,events=[];
 const report=await runV8Journey(game,{journeyOptions:route?{route}:{},onMilestone:(mark,g)=>{
  events.push({name:mark.name,player:g.playerPosition.clone(),cargo:g.cargo.position.clone(),
   held:g.heldCube===friend,teleports:g.teleportCount,liftY:g.firstLevel.lift?.y});
 }});
 assert.equal(report.pass,true);
 assert.equal(game.state,'won');
 assert.equal(report.respawns+report.resets,0);
 assert.equal(game.cargo,friend);
 assert.equal(game.physics.cargoBody,body);
 return {report,events};
}

test('classic 1 can cross by the wall portals or by falling into the real trench floor portal',async()=>{
 const wall=await journey(0);
 assert.equal(wall.report.teleports,1);
 assert.ok(wall.events.some(event=>event.name==='crossed the trench'));
 const floor=await journey(0,'trench-drop');
 assert.equal(floor.report.teleports,1);
 assert.equal(game.portalSurfaceIds[0],game.firstLevel.panels['trench-floor'].mesh.uuid);
 assert.ok(floor.events.some(event=>event.name==='falling through the trench floor reaches the opposite bank'));
 assert.equal(floor.events.some(event=>event.name==='crossed the trench'),false);
});

test('classic 4 can raise its empty portal before entry or carry its free companion upward on the real lift',async()=>{
 const raisedFirst=await journey(3);
 assert.equal(raisedFirst.report.teleports,1);
 const first=raisedFirst.events.find(event=>event.name==='portal rises with its panel');
 assert.ok(first&&first.liftY>4.98);
 assert.ok(first.player.y<.2);
 const ride=await journey(3,'ride-lift');
 assert.equal(ride.report.teleports,1);
 const lowEntry=ride.events.find(event=>event.name==='entered the moving portal before raising its lift');
 const lifted=ride.events.find(event=>event.name==='the player and free companion ride the moving portal platform together');
 assert.ok(lowEntry&&lifted);
 assert.ok(lowEntry.player.y<.2&&lowEntry.held);
 assert.ok(lifted.liftY>4.98&&lifted.player.y>4.9&&lifted.cargo.y>5.3);
 assert.equal(lifted.held,false);
});
