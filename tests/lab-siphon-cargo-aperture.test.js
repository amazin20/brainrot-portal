import test,{after} from 'node:test';import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';import {runV8Journey} from '../src/game/LabV8Journey.js';import {runSiphonObservatory} from '../src/game/LabSiphonObservatoryJourney.js';
const g=await createHeadlessGame();g.chamberEdition='foundation';after(()=>{g.firstLevel.dispose?.();g.physics.dispose();g.portals.dispose();});
for(const carrying of [false,true])test('33 cargo inlet cannot transport the observer '+(carrying?'carrying the original body':'alone'),async()=>{
 await g.selectLevel(32,false);const cargo=g.cargo,body=g.physics.cargoBody;
 const result=await runV8Journey(g,{scenario:async d=>{
  await runSiphonObservatory(d,{route:'miss-lift-and-recirculate',stopAfter:'dry'});
  if(carrying){d.walk(11,16.8);d.pickup();d.walk(20,16.8);}
  else d.walk(20,19);
  d.walk(20,25);d.walk(13,25);assert.ok(g.portals.ready);
  for(let i=0;i<300;i++){d.worldMove(0,-1);d.frame();}d.stop();
  assert.equal(g.teleportCount,0,'Observer crossed the supposedly cargo-only inlet');assert.equal(!!g.heldCube,carrying);assert.equal(g.state,'playing');assert.equal(d.level.circuit.height,0);assert.equal(d.level.circuit.primed,false);assert.equal(d.level.getDisplacement(),0);
 }});assert.equal(result.resets+result.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
});
