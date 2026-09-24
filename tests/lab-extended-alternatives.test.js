import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

for(const {number,order,milestone,early} of [
 {number:6,order:'light-first',milestone:'unturned optical path lights the pilot receiver before the mirror turns',
  early:g=>{assert.equal(g.firstLevel.state.pilotLit,true);assert.equal(g.firstLevel.state.target,0);assert.equal(g.portals.ready,true);}},
 {number:7,order:'load-first',milestone:'loaded friend sets the moving portal launch angle',
  early:g=>{assert.ok(g.firstLevel.state.angle>.36);assert.equal(g.portals.ready,false);}},
 {number:8,order:'air-first',milestone:'fan running before portals route its air',
  early:g=>{assert.equal(g.firstLevel.state.enabled,true);assert.equal(g.portals.ready,false);}},
])test(`classic room ${number} completes its distinct ${order} action order`,async()=>{
 await game.selectLevel(number-1,false);
 const originalFriend=game.cargo,originalBody=game.physics.cargoBody;
 let observed=false;
 const report=await runV8Journey(game,{journeyOptions:{order},onMilestone:m=>{
  if(m.name===milestone){early(game);observed=true;}
 }});
 assert.ok(observed,`The second causal order was not exercised in room ${number}`);
 assert.equal(report.pass,true);assert.equal(game.state,'won');
 assert.equal(report.resets+report.respawns,0);
 assert.equal(game.cargo,originalFriend);assert.equal(game.physics.cargoBody,originalBody);
});

test('room 6 outside servo stays inactive until a real portal-routed beam reaches its pilot',async()=>{
 await game.selectLevel(5,false);game.resetRun(true);
 const level=game.firstLevel;
 game.playerPosition.set(3,0,-7);
 assert.equal(level.state.pilotLit,false);
 assert.equal(game.interact(),true);
 assert.equal(level.state.target,0);
 assert.equal(level.state.mirror,0);
 assert.equal(level.state.lit,false);
});

test('room 8 has a second physical route: wind carries player and friend through the portal',async()=>{
 await game.selectLevel(7,false);
 const canonical=await runV8Journey(game);
 assert.equal(canonical.pass,true);assert.equal(canonical.teleports,0);
 await game.selectLevel(7,false);
 const originalFriend=game.cargo,originalBody=game.physics.cargoBody;
 const observations=[];
 const alternate=await runV8Journey(game,{journeyOptions:{order:'wind-through'},onMilestone:(step,g)=>{
  if(step.name.includes('horizontal fan stream')||step.name.includes('fan alone pushes'))
   observations.push({step,held:g.heldCube===originalFriend,velocity:g.playerVelocity.clone()});
 }});
 assert.equal(alternate.pass,true);assert.equal(game.state,'won');
 assert.equal(alternate.teleports,1);
 assert.equal(alternate.resets+alternate.respawns,0);
 assert.equal(game.cargo,originalFriend);assert.equal(game.physics.cargoBody,originalBody);
 assert.equal(observations.length,2);
 assert.equal(observations[0].step.teleports,0);
 assert.equal(observations[1].step.teleports,1);
 assert.equal(observations[0].held,true);assert.equal(observations[1].held,true);
 assert.ok(observations[1].velocity.y>0);
});

test('room 7 can lock its real rocker and repeat the gravity launch while carrying the friend',async()=>{
 await game.selectLevel(6,false);
 const canonical=await runV8Journey(game);
 assert.equal(canonical.pass,true);assert.equal(canonical.teleports,1);
 assert.ok(canonical.milestones.some(step=>step.name==='retrieved the original friend through the load tray'));
 await game.selectLevel(6,false);
 const originalFriend=game.cargo,originalBody=game.physics.cargoBody;
 const events=[];
 const alternate=await runV8Journey(game,{journeyOptions:{order:'braked-return'},onMilestone:(step,g)=>{
  if(step.name.includes('brake holds')||step.name.includes('friend removed')||step.name.includes('second loaded landed'))
   events.push({step,braked:g.firstLevel.state.braked,angle:g.firstLevel.state.angle,
    held:g.heldCube===originalFriend,portalIds:[...g.portalSurfaceIds]});
 }});
 assert.equal(alternate.pass,true);assert.equal(game.state,'won');
 assert.equal(alternate.teleports,2);
 assert.equal(alternate.resets+alternate.respawns,0);
 assert.equal(game.cargo,originalFriend);assert.equal(game.physics.cargoBody,originalBody);
 assert.equal(events.length,3);
 assert.ok(events.every(event=>event.braked&&event.angle>.34));
 assert.equal(events[0].held,false);
 assert.equal(events[1].held,true);
 assert.equal(events[2].held,true);
 assert.equal(events[2].step.teleports,2);
 assert.equal(events[1].portalIds.includes(game.firstLevel.panels['lever-receiver'].mesh.uuid),false);
 assert.equal(alternate.milestones.some(step=>step.name.includes('retrieved the original friend through the load tray')),false);
});
