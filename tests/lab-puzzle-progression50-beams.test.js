import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runPuzzleProgression50BeamJourney} from '../src/game/LabPuzzleProgression50BeamJourney.js';

test('50 production beam inputs use the same causal A/B cargo journey, recover real falls and retain the ordinary joint finish',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.puzzleProgression=true;await g.selectLevel(49,false);
 const cargo=g.cargo,body=g.physics.cargoBody,player=g.playerGroup;let observed;
 try{
  const route=await runV8Journey(g,{scenario:d=>{observed=runPuzzleProgression50BeamJourney(d);}});
  assert.equal(route.pass,true);assert.equal(route.resets,0);assert.equal(route.respawns,0);
  assert.equal(observed.pass,true);assert.equal(g.state,'won');assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(g.playerGroup,player);
  assert.ok(observed.minAngle< -1.48&&observed.maxAngle>1.48);assert.equal(observed.loadedA,true);assert.equal(observed.loadedB,true);
  assert.ok(observed.actualFalls>=1);assert.ok(observed.recoveries>=1);assert.equal(observed.heldReleaseAndRegrab,true);
  assert.equal(observed.cargoTransfers.filter(c=>!c.held).length,2);assert.ok(observed.cargoTransfers.some(c=>c.held));
  assert.equal(observed.fakeBeamGrounding,0);assert.equal(observed.dividerOverlaps,0);assert.ok(observed.deepestBeamOverlap<.055);
  assert.ok(observed.independentShapeChecks>0,'Measured contacts and wedges must be checked against the actual Cannon shapes independently');
  const wedges=observed.phases.reduce((sum,p)=>sum+p.beams.reduce((n,b)=>n+b.emptyAabbFrames,0),0);
  assert.ok(wedges>0,'The actual inputs must sample empty air inside a whole beam AABB');
  const diagonal=observed.phases.find(p=>p.name==='B return main-beam empty diagonal AABB witness with original held cargo');
  assert.ok(diagonal?.beams[0].emptyAabbFrames>=8,'A bounded ordinary lateral approach must actually sample the returning main beam diagonal AABB wedge');
  assert.ok(observed.emptyWedges.some(p=>p.phase===diagonal.name&&p.beam===0&&p.held&&p.distance>.51&&Math.abs(p.distance-p.independentDistance)<1e-6));
  for(const beam of [0,1])assert.ok(observed.phases.reduce((sum,p)=>sum+p.beams[beam].touchingFrames,0)>0,`Ordinary inputs must actually touch beam ${beam}; proximity alone is insufficient`);
  assert.ok(observed.contacts.every(c=>c.point.every(Number.isFinite)&&c.normal.every(Number.isFinite)));
  console.info('50 production beam input coverage',JSON.stringify({...observed,routeFrames:route.frames,routeTeleports:route.teleports,routeResets:route.resets,routeRespawns:route.respawns}));
 }catch(error){console.info('50 production beam failure evidence',JSON.stringify(error.beamProbeReport));throw error;
 }finally{g.physics.dispose();g.portals.dispose();}
});
