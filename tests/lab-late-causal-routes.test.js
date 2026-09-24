import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

test('room 18 stages its companion before opening the hidden exit, then rejoins it without repeating the first launch',async()=>{
 const game=await createHeadlessGame();
 try{
  game.chamberEdition='classic';await game.selectLevel(17,false);
  const companion=game.cargo,body=game.physics.cargoBody,observations=[];
  const report=await runV8Journey(game,{journeyOptions:{order:'retrieve-first'},onMilestone:mark=>{
   if(mark.name.startsWith('retrieve and stage')||mark.name.startsWith('hidden exit addressed')){
    observations.push({name:mark.name,cargo:mark.cargo,held:!!game.heldCube,portals:game.portals.portals.map(portal=>portal.position.toArray())});
   }
  }});
  assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);
  assert.equal(game.cargo,companion);assert.equal(game.physics.cargoBody,body);
  assert.equal(observations.length,2);
  assert.ok(observations.every(e=>!e.held&&e.cargo[1]>10.9&&e.cargo[0]>-4));
  assert.ok(observations[0].portals[0][0]<-19&&observations[0].portals[1][2]<10);
  assert.ok(observations[1].portals[1][2]>18);
  assert.equal(report.teleports,3);
 }finally{game.physics.dispose();game.portals.dispose();}
});

test('room 26 reverses the independent current before removing the companion that powers the other stream',async()=>{
 const game=await createHeadlessGame();
 try{
  game.chamberEdition='classic';await game.selectLevel(25,false);
  const companion=game.cargo,body=game.physics.cargoBody,observations=[];
  const report=await runV8Journey(game,{journeyOptions:{route:'reverse-first'},onMilestone:mark=>{
   if(mark.name.startsWith('reverse the independent')||mark.name.startsWith('borrow the lift')){
    observations.push({name:mark.name,loaded:game.firstLevel.state.load.loaded(),shutterOpen:game.firstLevel.state.shutter.open,crossingReversed:game.firstLevel.state.crossingFlow.reversed,cargoY:game.cargo.position.y});
   }
  }});
  assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);
  assert.equal(game.cargo,companion);assert.equal(game.physics.cargoBody,body);
  assert.equal(observations.length,2);
  assert.deepEqual(observations.map(e=>[e.loaded,e.shutterOpen,e.crossingReversed]),[[true,true,false],[false,false,false]]);
  assert.ok(observations[1].cargoY>16);
  assert.ok(game.physics.portalTransports>0);
 }finally{game.physics.dispose();game.portals.dispose();}
});

test('room 33 sends the original companion through the first portal before the player, then completes a shared second flight',async()=>{
 const game=await createHeadlessGame();
 try{
  game.chamberEdition='classic';await game.selectLevel(32,false);
  const companion=game.cargo,body=game.physics.cargoBody;
  const report=await runV8Journey(game,{journeyOptions:{route:'companion-first'}});
  assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);
  assert.equal(game.cargo,companion);assert.equal(game.physics.cargoBody,body);
  const first=report.milestones.find(m=>m.name==='The original companion reaches the intermediate gallery before the player');
  const reunited=report.milestones.find(m=>m.name==='Reunited with the original companion after separate first flights');
  assert.ok(first&&reunited);assert.equal(first.teleports,0);assert.equal(reunited.teleports,1);
  assert.ok(first.cargo[1]>15&&first.player[1]<15);
  assert.equal(report.teleports,2);assert.ok(game.physics.portalTransports>=1);
  assert.ok(game.firstLevel.clearance.decks.some(deck=>deck.name==='Companion receiving shelf'&&deck.y===15&&deck.minX<0&&deck.maxX>6));
 }finally{game.physics.dispose();game.portals.dispose();}
});
