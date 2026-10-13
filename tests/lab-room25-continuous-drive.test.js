import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {Body} from 'cannon-es';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const game=await createHeadlessGame();
after(()=>{game.firstLevel?.dispose?.();game.physics.dispose();game.portals.dispose();});

async function reachFirstGallery(d){
 const {walk,pickup,wait,until,aim,level}=d,p=level.panels;
 walk(-14,9);pickup();walk(-14,8.7);walk(-7,8.7);game.input.jumpQueued=true;walk(-7,10);walk(-7,13.8);walk(-7,12.7);wait(.5);
 assert.ok(game.interact());wait(1.2);assert.equal(game.heldCube,null);
 until(()=>level.state.optical.loaded&&level.state.optical.travel>.85,15,'Original load did not open the actual shutters');
 walk(-7,6);walk(17,6);walk(17,12);
 const centre=p['light-intake'].getFrame().center;
 aim(0,centre);aim(0,centre.clone().add(centre.clone().sub(game.portals.portals[0].position)));
 walk(17,6);walk(-20,6);walk(-20,-10);walk(-14,-10);walk(-15.2,-10.7);
 aim(1,p['lower-relay'].getFrame().center);
 until(()=>game.playerPosition.y>8.97,18,'Actual first optical lift did not reach its landing');
 walk(-14,-13);walk(-6,-13);walk(-7,-13);walk(-14,-13);walk(-14,-10);walk(-7,-10);walk(-7,7.9);
}

test('25 prototype: real light, moving mirror and original contact feed the bounded drive; interruption returns it',async()=>{
 await game.selectLevel(24,false);const cargo=game.cargo,body=game.physics.cargoBody;
 await runV8Journey(game,{scenario:async d=>{
  await reachFirstGallery(d);
  const o=d.level.state.optical,m=o.machine;
  assert.equal(m.originalCargoBody,body);assert.equal(m.carriageBody.type,Body.DYNAMIC);assert.equal(m.deckBody.type,Body.DYNAMIC);
  assert.equal(Object.hasOwn(m,'target'),false);assert.equal(m.loaded,true);
  assert.ok(o.segments.some(s=>s.kind==='mirror'));assert.equal(o.motorLit,true);
  const before=m.height;d.wait(2);assert.ok(Math.abs(m.height-before)<.03,'A live ray alone must not arm the actual E switch');
  assert.equal(m.diagnostics().lastForce.motorForce,0);
  assert.equal(game.interact(),true);
  try{d.until(()=>m.height>2,10,'Current light did not raise the original loaded support');}catch(error){error.message+=' '+JSON.stringify({height:m.height,velocity:m.velocity,motorEnabled:m.motorEnabled,lastForce:m.diagnostics().lastForce,loaded:m.loaded,normalLoad:m.normalLoad});throw error;}
  const lit=m.diagnostics().lastForce;
  assert.equal(lit.motorLit,true);assert.ok(lit.motorForce>0&&lit.motorForce<=m.budget.motorForce);
  assert.ok(lit.motorPower<=m.budget.motorPower+1e-8);
  assert.ok(lit.raySegments.filter(s=>s.kind==='mirror').length>=3);
  assert.ok(Math.abs(lit.mirror.position[1]-(lit.carriageY+3.96))<1e-10);
  assert.equal(m.loaded,true);assert.ok(m.normalLoad>0);
  assert.ok(lit.deckDampingPower<=1e-9&&lit.carriageDampingPower<=1e-9&&lit.rackDampingPower<=1e-9);
  assert.equal(lit.foundedReactionY,-(lit.motorForce+lit.carriageDampingForce));
  assert.ok(Math.abs(lit.forceBalanceY)<1e-9&&Math.abs(lit.forceBalanceZ)<1e-9);
  assert.deepEqual(lit.foundedVelocity,[0,0,0]);
  assert.ok(lit.sourceRackPower<=2*m.budget.pressureDrivePower+1e-8);
  // Reach the existing upper freight firing position by ordinary movement.
  // Reusing this relay cuts the real motor ray without hidden pair clearing.
  d.walk(-7,-10);d.walk(-14,-10);d.walk(-14,-13);d.walk(-6,-13);d.walk(-3,-14.5);
  d.until(()=>m.height>8.95,10,'The current reflected supply did not cover the full physical stroke');
  d.aim(1,d.level.panels['freight-receiver'].getFrame().center);
  const atCut=m.height;
  d.until(()=>m.velocity<-.2,4,'Lost light did not release the real carriage to gravity');
  const dark=m.diagnostics().lastForce;assert.equal(dark.motorLit,false);assert.equal(dark.motorForce,0);
  d.wait(.5);assert.ok(m.height<atCut);
  // The unlit first lift descends. Walk back off its permanent landing to
  // the original valid lower firing position rather than inventing a pose.
  d.wait(7);d.walk(-14,-13);d.walk(-20,-13);d.until(()=>game.playerGrounded,8,'Ordinary return to the lower firing court did not land');
  d.walk(-20,-10);d.walk(-14,-10);d.walk(-15.2,-10.7);d.aim(1,d.level.panels['lower-relay'].getFrame().center);
  d.until(()=>m.velocity>.2,5,'Restored real light did not restart the same physical bodies');
  assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);
  assert.equal(m.diagnostics().ownershipValid,true);
  assert.ok([...m.forceApplications.values()].every(n=>n===1));
 }});
});

test('25 prototype: repeated render preparation does not apply forces or create physical clock steps',async()=>{
 await game.selectLevel(24,false);
 const m=game.firstLevel.state.optical.machine;m.ensure();
 const step=game.physics.world.stepnumber,count=m.diagnostics().forceCount,position=m.carriageBody.position.clone();
 for(let i=0;i<20;i++){game.firstLevel.update(0);game.firstLevel.renderUpdate(.5);m.diagnostics();}
 assert.equal(game.physics.world.stepnumber,step);assert.equal(m.diagnostics().forceCount,count);
 assert.deepEqual(m.carriageBody.position.toArray(),position.toArray());
 const world=game.physics.world,owned=[...m.bodies],subsystems=world.subsystems.length,registry=game.physics.bodyBoxes.size;
 m.dispose();assert.ok(owned.every(b=>!world.bodies.includes(b)));assert.equal(world.subsystems.length,subsystems-1);
 assert.equal(game.physics.bodyBoxes.size,registry-m.parts.length);
});
