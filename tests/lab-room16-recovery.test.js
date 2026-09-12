import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});
test('removing support before boarding the lift can be recovered through the real well with the original friend',async()=>{
 await game.selectLevel(15,false);const body=game.physics.cargoBody,group=game.cargo.group;
 const report=await runV8Journey(game,{scenario:d=>{
  const {level,walk,wait,aim,until,pickup,enter,mark}=d,p=level.panels;
  // Reach the island and make the actual early-release mistake through normal
  // controls. No player/cargo/portal poses or mechanism state are assigned.
  aim(0,p.arrival.getFrame().center);aim(1,p['first-address'].getFrame().center);
  walk(game.cargo.position.x-1,game.cargo.position.z);pickup();enter(p.arrival);
  walk(-17,2);game.interact();wait(.8);aim(0,p.source.getFrame().center);
  walk(game.cargo.position.x-1,game.cargo.position.z);pickup();walk(-16,1.75);wait(.15);game.input.jumpQueued=true;walk(-16,0);wait(.4);
  walk(-1.2,0);wait(.3);game.interact();wait(.6);walk(6,0);aim(1,p.arrival.getFrame().center);
  until(()=>level.state['counterweight-lift'].position.y>13.3,14,'The early release sends the lift up without its observer');
  assert.ok(game.playerPosition.y<8&&level.pads[0].loaded()&&!game.heldCube);mark('lift left without the observer');
  // Rebuild the same temporary support, walk over the well and remove it
  // again. The friend and its usable portal plate remain physically inside.
  aim(1,p['first-address'].getFrame().center);wait(.3);walk(0,0);aim(0,p.arrival.getFrame().center);
  until(()=>game.playerGrounded&&game.playerPosition.y<2.3,6,'The observer drops into the real counterweight well');
  walk(1.55,1.55);aim(1,p.counterweight.getFrame().center);wait(.3);
  if(game.cargo.position.y>1)pickup();
  const before=game.teleportCount;
  for(let frame=0;frame<360&&game.teleportCount===before;frame++){
   const toward=game.portals.portals[1].position.clone().sub(game.playerPosition);toward.y=0;toward.normalize().multiplyScalar(.7);
   d.worldMove(toward.x,toward.z);d.frame();
  }
  d.stop();assert.ok(game.teleportCount>before,'The observer and held friend must traverse the plate portal');
  until(()=>game.playerGrounded&&game.playerPosition.y<.1,6,'The pair returns to the starting court');wait(1);
  until(()=>level.state['counterweight-lift'].position.y<2.05,16,'The unloaded lift returns to its original dock');
  assert.ok(game.heldCube&&game.cargo.position.x<-13&&game.playerPosition.z>12);assert.equal(level.pads[0].loaded(),false);mark('original pair and lift recovered without restarting');
 }});
 assert.equal(report.pass,true);assert.equal(report.resets+report.respawns,0);assert.equal(game.physics.cargoBody,body);assert.equal(game.cargo.group,group);assert.equal(game.state,'playing');
});
