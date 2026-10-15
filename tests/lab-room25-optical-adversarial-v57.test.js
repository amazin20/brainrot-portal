import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {Body,Box,Vec3} from 'cannon-es';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runRoom25NormalPlay} from './helpers/lab-room25-normal-play-driver.js';

// These cases distinguish actual ordinary input from explicitly declared
// engine fault fixtures. A synthetic body is never presented as a player path.
const game=await createHeadlessGame();
after(()=>{game.firstLevel?.dispose?.();game.physics.dispose();game.portals.dispose();});
const evidence=(name,value)=>console.log('ROOM25_V57_ADVERSARIAL '+JSON.stringify({name,publicationAccepted:false,exhaustiveBypassResistance:false,...value}));

async function loadOriginal(d){
 const {walk,pickup,wait,until,level}=d;
 walk(-14,9);pickup();walk(-14,8.7);walk(-7,8.7);
 game.input.jumpQueued=true;walk(-7,10);walk(-7,13.8);walk(-7,12.7);wait(.5);
 assert.equal(game.interact(),true);assert.equal(game.heldCube,null);wait(1.2);
 until(()=>level.state.optical.loaded&&level.state.optical.travel>.85,15,'Actual original body did not load and move the physical shutters');
}

test('25 fresh ordinary attack: taking the original load cannot retain one stale qualified contact interval',async()=>{
 await game.selectLevel(24,true);
 const original=game.cargo,body=game.physics.cargoBody,shape=body.shapes[0],observed={};
 const route=await runRoom25NormalPlay(game,{scenario:async d=>{
  await loadOriginal(d);
  const m=d.level.state.optical.machine,world=game.physics.world;
  observed.loaded={step:world.stepnumber,bodyId:body.id,normalForce:m.normalLoad,pressure:m.pressureFraction,travel:d.level.state.optical.travel};
  assert.equal(m.loaded,true);assert.ok(m.normalLoad>0);assert.equal(m.loadStep,world.stepnumber);
  // Normal E pickup happens before another solver step. The old positive
  // multiplier still exists in Cannon; held cargo must already be unqualified.
  const priorContacts=world.contacts.filter(c=>c.enabled!==false&&c.multiplier>0&&[c.bi,c.bj].includes(body)).length;
  assert.ok(priorContacts>0);
  assert.equal(game.interact(),true);assert.equal(game.heldCube,original);
  assert.equal(world.stepnumber,observed.loaded.step);
  assert.equal(m.loaded,false);assert.equal(m.normalLoad,0);
  let qualifiedWhileHeld=0;
  const inspect=()=>{if(m.loaded)qualifiedWhileHeld++;};world.addEventListener('postStep',inspect);
  try{d.until(()=>d.level.state.optical.travel<.15,15,'Physical shutters did not return after ordinary original pickup');}finally{world.removeEventListener('postStep',inspect);}
  assert.equal(qualifiedWhileHeld,0);assert.equal(m.motorEnabled,false);
  assert.ok(d.level.state.optical.travel<.15,'The real unloaded shutters must return rather than retaining the pickup interval');
  assert.equal(game.state,'playing');assert.equal(game.cargo,original);assert.equal(game.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
  observed.after={step:world.stepnumber,held:game.heldCube===original,qualifiedWhileHeld,travel:d.level.state.optical.travel,priorPositiveContactCount:priorContacts};
 }});
 assert.equal(route.resets+route.respawns+route.cargoResets,0);
 evidence('same-step-normal-pickup',{kind:'ordinary-input-attack',frames:route.frames,...observed});
});

test('25 fresh declared wrong-body fixture: a real foreign load is never reported as the original cargo',async()=>{
 await game.selectLevel(24,true);
 const m=game.firstLevel.state.optical.machine,world=game.physics.world,body=game.physics.cargoBody,original=game.cargo;
 m.ensure();
 // This is an adversarial identity fixture, not an achievable ordinary input.
 // The original body is never moved, replaced, resized or assigned to the cell.
 const fake=new Body({mass:body.mass,position:new Vec3(-7,m.deckBody.position.y+.1+.39+.03,12),
  shape:new Box(new Vec3(.39,.39,.39)),allowSleep:false,
  collisionFilterGroup:body.collisionFilterGroup,collisionFilterMask:body.collisionFilterMask});
 world.addBody(fake);
 let foreignPositiveSteps=0,foreignNormalImpulse=0,originalQualifiedSteps=0,maxPressure=0;
 const inspect=()=>{
  const contacts=world.contacts.filter(c=>c.enabled!==false&&c.multiplier>1e-6&&[c.bi,c.bj].includes(fake)&&[c.bi,c.bj].includes(m.deckBody));
  if(contacts.length){foreignPositiveSteps++;foreignNormalImpulse+=contacts.reduce((n,c)=>n+Math.abs(c.ni.y)*c.multiplier,0)*world.dt;}
  if(m.loaded)originalQualifiedSteps++;maxPressure=Math.max(maxPressure,m.pressureFraction);
 };
 world.addEventListener('postStep',inspect);
 try{await runRoom25NormalPlay(game,{scenario:d=>d.wait(5)});}
 finally{world.removeEventListener('postStep',inspect);world.removeBody(fake);}
 assert.ok(foreignPositiveSteps>100&&foreignNormalImpulse>10,'The impostor must actually bear on the pressure deck, not merely be nearby');
 assert.ok(maxPressure>.5,'The foreign physical mass must exercise the actual pressure mechanism');
 assert.equal(originalQualifiedSteps,0);assert.equal(m.loaded,false);assert.equal(m.normalLoad,0);
 assert.equal(game.physics.cargoBody,body);assert.equal(game.cargo,original);assert.equal(m.originalCargoBody,body);assert.notEqual(fake.id,body.id);
 assert.equal(game.state,'playing');assert.equal(game.portals.ready,false);assert.equal(m.motorEnabled,false);
 evidence('foreign-rigid-body-contact',{kind:'declared-fault-fixture',foreignBodyId:fake.id,originalBodyId:body.id,foreignPositiveSteps,foreignNormalImpulse,maxPressure,originalQualifiedSteps});
});

test('25 fresh timing fixture: excessive frame input remains bounded actual substeps and reset erases the previous drive work',async()=>{
 await game.selectLevel(24,true);
 const m=game.firstLevel.state.optical.machine,world=game.physics.world;m.ensure();
 const ids=m.bodies.map(b=>b.id),before=world.stepnumber,forceCount=m.diagnostics().forceCount;
 // Feed the production physics accumulator, rather than setting a mechanism
 // height or invoking its private force function with a fabricated clock.
 game.physics.step(1000);
 const steps=world.stepnumber-before,maximum=Math.ceil(game.physics.maxFrame/game.physics.fixedStep)+1;
 assert.ok(steps>0&&steps<=maximum,'A long rendered frame must not execute unbounded simulation');
 assert.equal(m.diagnostics().forceCount-forceCount,steps);
 assert.ok([...m.forceApplications.values()].every(n=>n===1));
 const current=m.diagnostics().lastForce;
 assert.equal(current.dt,game.physics.fixedStep);assert.equal(current.motorForce,0);assert.equal(current.motorPower,0);
 assert.ok(current.deckDampingPower<=1e-9&&current.carriageDampingPower<=1e-9&&current.rackDampingPower<=1e-9);
 for(const dt of [-1,NaN,Infinity])assert.throws(()=>game.physics.step(dt),RangeError);
 assert.equal(world.stepnumber,before+steps);
 game.resetRun(true);
 assert.equal(m.motorEnabled,false);assert.equal(m.loaded,false);assert.equal(m.diagnostics().motorWork,0);assert.equal(m.diagnostics().rackWork,0);
 assert.ok(Math.abs(m.height)<.01);assert.deepEqual(m.bodies.map(b=>b.id),ids);
 for(let i=0;i<12;i++)game.updatePlaying(1/120);
 assert.ok([...m.forceApplications.values()].every(n=>n===1));
 assert.ok(m.bodies.every(b=>[...b.position.toArray(),...b.velocity.toArray()].every(Number.isFinite)));
 evidence('bounded-frame-and-reset',{kind:'declared-engine-timing-fixture',excessFrameSeconds:1000,actualSteps:steps,maxAllowedSteps:maximum,bodyIds:ids,resetUsed:true,previousWorkRetained:false});
});
