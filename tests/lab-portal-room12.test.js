import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {ROOM12_SPEC,runRoom12} from '../src/game/LabPortalRoom12.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});
async function untilMark(d,label){
 const stop=Symbol(label);let reached=false;
 try{await runRoom12({...d,mark:name=>{d.mark(name);if(name===label){reached=true;throw stop;}}});}
 catch(error){if(error!==stop)throw error;}
 assert.ok(reached,'Ordinary controls must reach '+label);
}

test('the atrium solves through freight, an airborne portal change and a second gravity transfer',async()=>{
 await game.selectLevel(11,false);
 assert.equal(game.firstLevel.id,ROOM12_SPEC.id);
 const body=game.physics.cargoBody,group=game.cargo.group;
 const report=await runV8Journey(game,{scenario:runRoom12});
 assert.equal(report.pass,true);assert.equal(game.state,'won');
 assert.equal(report.resets+report.respawns,0);
 assert.equal(game.physics.cargoBody,body);assert.equal(game.cargo.group,group);
 assert.equal(report.teleports,4);
 const freight=report.milestones.find(m=>m.name==='the same free companion crosses the low freight window');
 assert.ok(freight.cargo[1]>12&&freight.cargo[2]>14.7);
 const redirected=report.milestones.find(m=>m.name==='the airborne angle exposes the final exit');
 assert.ok(redirected.player[1]>19,'The new sightline must be used in actual flight');
 assert.equal(game.firstLevel.terminals.length,0);assert.equal(game.firstLevel.getLaunch(),null);
 assert.equal(game.firstLevel.puzzleGeometry.normalGaps,0);
});

test('missing the airborne shot lands in the court and returns to observation without a reset',async()=>{
 await game.selectLevel(11,false);
 const report=await runV8Journey(game,{scenario:async d=>{
  await untilMark(d,'gravity returns the player above the atrium');
  const cargo=game.cargo.group;
  d.until(()=>game.playerGrounded&&game.playerPosition.y<.1,6,'A missed shot must reach the physical court');
  assert.equal(game.cargo.group,cargo);assert.ok(game.cargo.position.y>11.9);
  d.walk(4,35);d.walk(-23,35);d.walk(-23,26);
  d.aim(0,game.firstLevel.panels.entry.getFrame().center);
  d.aim(1,game.firstLevel.panels.observation.getFrame().center);
  d.enter(game.firstLevel.panels.entry);
  d.until(()=>game.playerGrounded,2,'The observation floor catches the retry');
  assert.ok(Math.abs(game.playerPosition.y-8)<.1);
  assert.equal(game.state,'playing');
 }});
 assert.ok(report.pass);assert.equal(report.resets+report.respawns,0);
});

test('a low-energy attempt stays in the launch bay, then its floor portal returns to the observation route',async()=>{
 await game.selectLevel(11,false);
 const report=await runV8Journey(game,{scenario:async d=>{
  await untilMark(d,'the airborne angle exposes the final exit');
  // Deliberately drift away from the floor portal, using the normal air input.
  for(let n=0;n<90&&!game.playerGrounded;n++){d.worldMove(1,0);d.frame();}
  d.stop();d.until(()=>game.playerGrounded,3,'Ground recovery beside the return portal');
  assert.ok(game.playerPosition.y<.1);
  d.walk(7,7);d.walk(4,7);const before=game.teleportCount;
  for(let n=0;n<180&&game.teleportCount===before;n++){d.worldMove(0,-.3);d.frame();}
  d.stop();assert.ok(game.teleportCount>before);
  assert.ok(game.lastPortalTravel.speed<10,'Only the small local fall supplies entry speed');
  d.until(()=>game.playerGrounded,4,'Low-energy traveller must reach the bay floor');
  assert.ok(game.playerPosition.y<.1&&game.playerPosition.z<0,'The low-energy attempt stays below the flight aperture');
  assert.equal(game.state,'playing');assert.ok(game.cargo.position.y>11.9);
  // A panel's existence alone does not prove recovery: place the former far
  // exit on it and actually return through the untouched court-floor portal.
  d.aim(0,game.firstLevel.panels['launch-bay-floor'].getFrame().center);
  d.walk(17.1,-12);d.walk(17.1,-14);
  const trappedTransfers=game.teleportCount;
  for(let n=0;n<180&&game.teleportCount===trappedTransfers;n++){d.worldMove(0,-.3);d.frame();}
  d.stop();assert.equal(game.teleportCount,trappedTransfers+1);
  for(let n=0;n<90&&!game.playerGrounded;n++){d.worldMove(-1,0);d.frame();}
  d.stop();d.until(()=>game.playerGrounded&&game.playerPosition.y<.1,5,'Land beside the court return');
  assert.ok(game.playerPosition.x<9&&game.playerPosition.z>0,'The original traveller escapes the bay');
  // Step away before circling the open floor aperture to avoid re-entering it.
  d.walk(0,3);d.walk(0,35);d.walk(-23,35);d.walk(-23,26);
  d.aim(0,game.firstLevel.panels.entry.getFrame().center);
  d.aim(1,game.firstLevel.panels.observation.getFrame().center);
  d.enter(game.firstLevel.panels.entry);
  d.until(()=>game.playerGrounded,2,'The observation floor catches the bay retry');
  assert.ok(Math.abs(game.playerPosition.y-8)<.1);
  assert.ok(game.cargo.position.y>11.9,'The delivered original friend remains available');
  assert.equal(game.state,'playing');
 }});
 assert.ok(report.pass);assert.equal(report.resets+report.respawns,0);
});
