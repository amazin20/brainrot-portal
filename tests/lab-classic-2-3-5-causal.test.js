import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

test('classic room 2 sends cargo first, closes the gate, then follows through the same plate',async()=>{
 game.chamberEdition='classic';await game.selectLevel(1,false);
 const body=game.physics.cargoBody;
 const r=await runV8Journey(game,{journeyOptions:{route:'cargo-first-vent'},onMilestone:m=>{
  if(m.name==='companion crosses first and the real weighted gate closes'){
   assert.equal(game.firstLevel.gates[0].opened,false);
   assert.ok(m.player[2]>0&&m.cargo[2]<0);
  }
  if(m.name==='player follows through the floor portal after the gate closes'){
   assert.equal(game.firstLevel.gates[0].opened,false);
   assert.ok(m.player[2]<0&&m.cargo[2]<0);
  }
 }});
 assert.equal(r.pass,true);assert.equal(game.state,'won');
 assert.equal(r.resets+r.respawns,0);assert.equal(game.physics.cargoBody,body);
 assert.ok(r.teleports>=1);
 assert.ok(game.portals.portals[1]?.position.distanceTo(game.firstLevel.panels['vent-ceiling'].getFrame().center)<1.5);
});

test('classic room 3 sends its free companion to a connected catch before the player travels',async()=>{
 game.chamberEdition='classic';await game.selectLevel(2,false);
 const body=game.physics.cargoBody;
 const r=await runV8Journey(game,{journeyOptions:{route:'send-friend-first'},onMilestone:m=>{
  if(m.name==='free companion arrives on freight ledge before player travels'){
   assert.ok(m.player[1]<.1&&m.player[2]>0);
   assert.ok(m.cargo[0]<-1&&m.cargo[1]>1.3&&m.cargo[2]<-8);
   assert.equal(game.heldCube,null);
  }
  if(m.name==='player makes the later velocity crossing to retrieve original companion'){
   assert.ok(m.player[1]>.9&&m.player[2]<-8);
   assert.ok(m.cargo[1]>1.3);
  }
 }});
 assert.equal(r.pass,true);assert.equal(game.state,'won');
 assert.equal(r.resets+r.respawns,0);assert.equal(game.physics.cargoBody,body);
 assert.ok(r.teleports>=1);
});

test('classic room 5 chooses an overhead arrival rather than a tilted launch',async()=>{
 game.chamberEdition='classic';await game.selectLevel(4,false);
 const body=game.physics.cargoBody;
 const r=await runV8Journey(game,{journeyOptions:{route:'roof-drop'}});
 assert.equal(r.pass,true);assert.equal(game.state,'won');
 assert.equal(r.resets+r.respawns,0);assert.equal(game.physics.cargoBody,body);
 assert.ok(r.teleports>=1);
 assert.ok(r.milestones.some(m=>m.name==='vertical roof exit reaches island without changing launcher angle'));
 assert.equal(game.firstLevel.receiverPanel.target,0);
 assert.equal(game.firstLevel.receiverPanel.progress,0);
 assert.ok(game.portals.portals[1]?.position.distanceTo(game.firstLevel.panels['island-ceiling'].getFrame().center)<1.5);
});

for(const index of [1,2,4])test(`classic room ${index+1} keeps its original ordinary-input solution`,async()=>{
 game.chamberEdition='classic';await game.selectLevel(index,false);
 const r=await runV8Journey(game);
 assert.equal(r.pass,true);assert.equal(game.state,'won');assert.equal(r.resets+r.respawns,0);
});
