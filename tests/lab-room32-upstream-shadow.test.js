import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installPreciseLateAim} from '../src/game/LabLateCampaignAim.js';
import {lateSpeedrunAttacks} from '../scripts/qa-speedrun-late-new.mjs';

test('32: the reproduced upstream shadow speedrun cannot replace freight delivery',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(31,false);
 const cargo=g.cargo,body=g.physics.cargoBody,notes=[];
 try{
  const r=await runV8Journey(g,{scenario:async d=>{
   installPreciseLateAim(d);
   await lateSpeedrunAttacks[32][0][1](d,()=>{},text=>notes.push(text));
   assert.equal(g.state,'playing');assert.equal(g.firstLevel.optics.valid,false);
   assert.equal(g.firstLevel.optics.latched,false);assert.ok(g.firstLevel.diaphragm.progress<.01);
   assert.deepEqual(g.firstLevel.optics.raw,[true,true],'The physical trunk must preserve both actual light paths');
   assert.equal(g.physics.portalTransports,0);assert.equal(g.teleportCount,0);
  }});
  assert.ok(r.pass);assert.equal(r.resets+r.respawns,0);
  assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
  assert.ok(notes.some(t=>t.includes('upstream source ray')));
 }finally{g.physics.dispose();g.portals.dispose();}
});

test('32: the guarded elevated source still delivers both beam heights through real cargo hood',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(31,false);
 try{
  const observations=[];
  const r=await runV8Journey(g,{onMilestone:m=>{
   if(m.name==='A real cargo shadow separates the two height circuits')observations.push({
    raw:[...g.firstLevel.optics.raw],shadow:[...g.firstLevel.optics.shadow],cargo:g.cargo.position.toArray(),
    transports:g.physics.portalTransports,sourceHeight:g.firstLevel.source.getFrame().center.y,
   });
  }});
  assert.ok(r.pass);assert.equal(g.state,'won');assert.equal(r.resets+r.respawns,0);
  assert.equal(observations.length,1);assert.deepEqual(observations[0].raw,[true,true]);
  assert.deepEqual(observations[0].shadow,[true,false]);assert.ok(observations[0].transports>0);
  assert.ok(observations[0].cargo[0]<-14);assert.equal(observations[0].sourceHeight,3.325);
  assert.ok(g.firstLevel.optics.latched);
 }finally{g.physics.dispose();g.portals.dispose();}
});

test('32: dispatching cargo to the raised optical source cannot park an upstream shadow on its frame',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(31,false);
 try{
  const r=await runV8Journey(g,{scenario:async d=>{
   installPreciseLateAim(d);
   await lateSpeedrunAttacks[32][2][1](d,()=>{},()=>{});
   assert.ok(g.physics.portalTransports>0,'The alternative cargo destination must actually be attempted');
   assert.equal(g.state,'playing');assert.equal(g.firstLevel.optics.valid,false);
   assert.equal(g.firstLevel.optics.latched,false);assert.ok(g.firstLevel.diaphragm.progress<.01);
   assert.ok(g.cargo.position.y<.7,'The real source frame must not retain the body on its lower light axis');
  }});
  assert.ok(r.pass);assert.equal(r.resets+r.respawns,0);
 }finally{g.physics.dispose();g.portals.dispose();}
});
