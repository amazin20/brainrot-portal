import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {Body} from 'cannon-es';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runFoundation20PhysicalJourney} from '../src/game/LabFoundation20PhysicalJourney.js';

// These are solver/ownership fixtures at the actual Foundation builder. The
// ordinary-input full route is independently recorded by the native harness.
const game=await createHeadlessGame();game.chamberEdition='foundation';
after(()=>{game.physics?.dispose();game.portals?.dispose();});
const DT=1/120;
async function room(playing=false){await game.selectLevel(19,playing);assert.equal(game.chamberEdition,'foundation');assert.equal(game.levelIndex,19);assert.equal(game.firstLevel.id,'foundation-portal-tension');assert.equal(game.firstLevel.creativeEarly,20);return game.firstLevel;}
function step(n=1){for(let i=0;i<n;i++)game.updatePlaying(DT);}

test('Foundation20 entry, return, tie and retaining tooth are shapes on the same actual massive train',async()=>{
 const l=await room(),h=l.nearHook,p=game.physics;
 assert.equal(h.gateBody.type,Body.DYNAMIC);assert.equal(h.gateBody.mass,8);
 for(const part of [l.leaf,l.returnLeaf,l.tie,l.tooth]){
  const entry=p.bodyBoxes.get(part.collider.mesh.uuid);assert.equal(entry.body,h.gateBody);assert.equal(entry.shape,h.gateBody.shapes[entry.shapeIndex]);
  assert.equal(p.solids.has(part.collider.mesh.uuid),false,'An obsolete static proxy must not obstruct its moving physical shape');
  assert.ok(p.inspectBodyBox(part.collider.mesh.uuid,{bounds:part.collider.box,orientedBox:part.collider.orientedBox,enabled:true}).valid);
 }
 assert.equal(l.stopFinger.body.type,Body.DYNAMIC);assert.equal(l.stopFinger.body.mass,1);
 assert.deepEqual(h.constraints.map(c=>c.equations.length),[5,5]);
 assert.ok(h.constraints.every(c=>!c.equations.includes(c.motorEquation)&&!c.motorEquation.enabled));
 assert.ok(h.liveOwnership().valid);assert.ok(l.stopFinger.diagnostics().liveOwnership);
});

test('Foundation20 the true loaded bearing rejects 120 Hz repeated identical finite E for 30 seconds',async()=>{
 const l=await room(),h=l.nearHook;step(600);let d=h.diagnostics();
 assert.ok(d.bearingForce>7.5&&d.bearingForce<8.5,'The real bearing must carry the eight-newton closing preload');
 let maximumOpening=-Infinity,maximumAngle=-Infinity;
 for(let n=0;n<3600;n++){assert.equal(h.hand(),true);step();d=h.diagnostics();maximumOpening=Math.max(maximumOpening,d.opening);maximumAngle=Math.max(maximumAngle,d.hookAngle);}
 assert.equal(d.handCount,3600);assert.ok(maximumOpening<.004);assert.ok(maximumAngle<.01);
 assert.ok(d.slip.maxAbsTorque<=4+1e-12);assert.ok(d.slip.maxTotalCouplingPower<=1e-10);
 assert.equal(d.tension,0);assert.ok(d.ownedPartsValid&&d.slip.liveOwnership);
});

test('Foundation20 the ordinary delivered original cargo unloads the bearing but remains physically captive until a new finite hand input',async()=>{
 const l=await room(true),h=l.nearHook,cargo=game.cargo,body=game.physics.cargoBody;
 const prefix=await runFoundation20PhysicalJourney(game,{stopAt:'cargo-hanging'});
 assert.equal(prefix.resets+prefix.respawns+prefix.cargoResets,0);assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);assert.equal(body.mass,3.2);
 const before=h.diagnostics().handCount;let maxQ=-Infinity,maxAngle=0,contactSteps=0,impulse=0;
 for(let n=0;n<1800;n++){step();const d=h.diagnostics();maxQ=Math.max(maxQ,d.opening);maxAngle=Math.max(maxAngle,Math.abs(d.hookAngle));if(d.captureForce>0){contactSteps++;impulse+=d.captureForce*DT;}}
 const d=h.diagnostics();assert.equal(d.handCount,before);assert.ok(maxQ>.58&&maxQ<.70);assert.ok(maxAngle<.05);
 assert.equal(d.bearingForce,0);assert.ok(d.tension>55&&d.captureForce>20);assert.ok(contactSteps>1500&&impulse>100);
 assert.ok(d.ownedPartsValid&&d.slip.liveOwnership);assert.equal(game.state,'playing');
});

test('Foundation20 the formerly self-releasing legal low-outlet corner remains physically captive without any near hand input',async()=>{
 const l=await room(true),h=l.nearHook,cargo=game.cargo,body=game.physics.cargoBody;
 const prefix=await runFoundation20PhysicalJourney(game,{demonstrateLoadedHook:false,stopAt:'cargo-hanging',portalOffsets:{feed:[.3,0,-.3],outlet:[0,-.3,0]}});
 assert.equal(prefix.resets+prefix.respawns+prefix.cargoResets,0);assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);
 const source=game.portals.portals.find(p=>p.surfaceId===l.feed.surface.mesh.uuid),exit=game.portals.portals.find(p=>p.surfaceId===l.outlet.mesh.uuid);
 assert.ok(Math.abs(source.position.x+10.7)<.015&&Math.abs(source.position.z-11.7)<.015);assert.ok(Math.abs(exit.position.y-6.9)<.015);
 let maxQ=-Infinity,maxAngle=0,contactSteps=0,impulse=0;
 for(let n=0;n<1800;n++){step();const d=h.diagnostics();maxQ=Math.max(maxQ,d.opening);maxAngle=Math.max(maxAngle,Math.abs(d.hookAngle));if(d.captureForce>0){contactSteps++;impulse+=d.captureForce*DT;}}
 const d=h.diagnostics();assert.equal(d.handCount,0);assert.ok(maxQ>.58&&maxQ<.72);assert.ok(maxAngle<.045);
 assert.equal(d.bearingForce,0);assert.ok(d.tension>55&&d.captureForce>20);assert.ok(contactSteps>1500&&impulse>100);
 assert.ok(d.ownedPartsValid&&d.slip.liveOwnership);assert.equal(game.state,'playing');
});

test('Foundation20 actual solver force clock applies a passive directional dashpot with a founded reaction',async()=>{
 const l=await room(),h=l.nearHook,b=h.gateBody,driver=h.driverBody;
 const gateForce=b.force.clone(),hookTorque=h.hookBody.torque.clone(),driverTorque=driver.torque.clone();
 for(let i=0;i<9;i++)l.applyCargoForces(1/60);
 assert.ok(b.force.almostEquals(gateForce));assert.ok(h.hookBody.torque.almostEquals(hookTorque));assert.ok(driver.torque.almostEquals(driverTorque));
 step(3);assert.deepEqual([...h.forceApplications.values()],[1,1,1]);assert.deepEqual([...h.slipForceApplications.values()],[1,1,1]);
 // Explicit velocity fixtures probe the authored passive component, separately
 // from the ordinary-input capture/recovery and no-finger return proofs.
 const fixed=h.fixedBody,world=game.physics.world,readings=[];
 const observer={update(){readings.push({velocity:b.velocity.x,gateForce:b.force.x,foundedForce:fixed.force.x,foundedVelocity:fixed.velocity.x,diagnostic:h.diagnostics().lastTrainForce});}};
 world.subsystems.push(observer);
 try{
  for(const velocity of [-2,2]){l.reset();b.velocity.x=velocity;game.physics.step(DT);}
 }finally{world.subsystems.splice(world.subsystems.indexOf(observer),1);}
 assert.equal(readings.length,2);const [opening,closing]=readings;
 for(const reading of readings){
  assert.ok(Math.abs(reading.gateForce+reading.foundedForce)<1e-10,'The independently observed force must have an equal and opposite founded reaction');
  assert.equal(reading.foundedVelocity,0);assert.ok(reading.foundedForce*reading.foundedVelocity===0);
  const dissipativeForce=reading.gateForce-reading.diagnostic.closingSpringForce;
  assert.ok(dissipativeForce*reading.velocity<0,'The actual applied damping force must dissipate energy in either direction');
  assert.equal(reading.diagnostic.actualGateAppliedForce,reading.gateForce);assert.equal(reading.diagnostic.actualFoundedAppliedForce,reading.foundedForce);
 }
 const openingDrag=Math.abs(opening.gateForce-opening.diagnostic.closingSpringForce),closingDrag=Math.abs(closing.gateForce-closing.diagnostic.closingSpringForce);
 assert.ok(openingDrag>30*closingDrag,'The actual check valve must preserve fast ordinary closing while absorbing the opening shock');
});

test('Foundation20 a geometrically slack current cable supplies exactly zero damping force even with fast separating cargo',async()=>{
 const l=await room();
 assert.equal(game.placeOnPanel(0,l.feed.surface.mesh,l.feed.surface.getFrame().center),true);
 assert.equal(game.placeOnPanel(1,l.outlet.mesh,l.outlet.getFrame().center),true);
 const p=game.portals.portals[1],b=p.position.clone().addScaledVector(p.normal,.9);
 // Explicit fixture initialization is not an ordinary traversal claim.
 game.physics.resetCargo({position:[b.x,b.y-.05,b.z],velocity:[0,-10,0]});
 game.physics.step(DT);
 const d=l.nearHook.diagnostics();
 assert.ok(d.cablePath&&d.cablePath.length<d.budget.restLength);assert.ok(d.cablePath.rate>9);
 assert.equal(d.lastCableForce.unilateral,true);assert.equal(d.lastCableForce.slack,true);
 assert.equal(d.tension,0);assert.ok(d.lastCableForce.nearForce.every(n=>n===0));assert.ok(d.lastCableForce.farForce.every(n=>n===0));
});

test('Foundation20 a detached hand rotor cannot transmit a cached torque or accept a new hand impulse',async()=>{
 const l=await room(),h=l.nearHook,world=game.physics.world,driver=h.driverBody;
 assert.equal(h.hand(),true);world.removeBody(driver);
 assert.equal(h.hand(),false);step();const d=h.diagnostics();
 assert.equal(d.slip.lastForce.liveOwnership,false);assert.equal(d.slip.lastForce.actualHookTorque,0);assert.equal(d.slip.lastForce.actualDriverTorque,0);
 assert.ok(d.slip.ownershipErrors.includes('driver-not-in-world'));assert.equal(d.handCount,1);
});

test('Foundation20 reset restores the same bodies and dispose removes only their owned solver registrations',async()=>{
 const l=await room(),h=l.nearHook,p=game.physics,ids=h.bodies.map(b=>b.id),fingerId=l.stopFinger.body.id;
 step(60);h.hand();l.stopFinger.hand();step(30);l.reset();
 assert.deepEqual(h.bodies.map(b=>b.id),ids);assert.equal(l.stopFinger.body.id,fingerId);assert.equal(h.opening,0);assert.equal(h.diagnostics().handCount,0);
 assert.equal(l.stopFinger.travel,0);assert.ok(h.liveOwnership().valid);assert.ok(l.stopFinger.diagnostics().liveOwnership);
 const ownIds=h.gateParts.concat(h.hookParts,h.fixedParts).map(p=>p.collider.mesh.uuid),subsystems=p.world.subsystems.length;
 h.dispose();l.stopFinger.dispose();
 assert.ok(ids.every(id=>!p.world.bodies.some(b=>b.id===id)));assert.ok(!p.world.bodies.some(b=>b.id===fingerId));
 assert.ok(ownIds.every(id=>!p.bodyBoxes.has(id)));assert.ok(p.world.subsystems.length<subsystems);
});
