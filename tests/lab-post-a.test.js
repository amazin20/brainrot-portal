import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runPostA} from '../src/game/LabPostJourneyA.js';
import {POST_A_SPECS} from '../src/game/LabPostCampaignA.js';
async function room(n){const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(n-1,false);return g;}
function close(g){g.physics?.dispose();g.portals?.dispose();}
const alternate={31:'inspect-rack-first',32:'inspect-optics-first',33:'aim-before-charge',34:'inspect-unsealed-first',35:'carry-after-first-latch'};
for(let n=31;n<=35;n++)for(const route of [undefined,alternate[n]])test(`late room ${n}: ${route||'canonical'} uses the original physical companion`,async()=>{
 const g=await room(n),cargo=g.cargo,body=g.physics.cargoBody.id;
 try{const r=await runV8Journey(g,{journeyOptions:route?{route}:{}});assert.equal(r.pass,true);assert.equal(g.state,'won');assert.equal(r.resets+r.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody.id,body);assert.equal(g.firstLevel.id,POST_A_SPECS[n-31].id);assert.ok(g.firstLevel.workshop.enclosed);assert.ok(g.firstLevel.puzzleGeometry.noProgressFlags);
  if(n===31){assert.ok(g.firstLevel.rack.stroke>12.95);assert.ok(g.firstLevel.rack.latched);assert.ok(g.firstLevel.inspection.progress>.9);}
  if(n===32)assert.ok(g.firstLevel.optics.latched);
  if(n===33)assert.ok(r.milestones.some(m=>m.name.includes('Real spring contact')));
  if(n===34){assert.equal(g.firstLevel.pressureState.mode,1);assert.ok(g.firstLevel.pressureState.pressure<95);}
  g.resetRun(true);assert.equal(g.state,'playing');assert.equal(g.physics.cargoBody.id,body);assert.equal(g.portals.ready,false);
  if(n===31){assert.equal(g.firstLevel.rack.stroke,0);assert.equal(g.firstLevel.rack.latched,false);}
  if(n===32)assert.equal(g.firstLevel.optics.latched,false);
  if(n===33){assert.equal(g.firstLevel.spring.held,false);assert.equal(g.firstLevel.spring.compression,0);}
 }finally{close(g);}
});
test('31: air alone cannot move the guided mass or its mechanically linked crossing',async()=>{const g=await room(31);try{const r=await runV8Journey(g,{scenario:d=>{runPostA(d,{route:'inspect-rack-first',stopBeforeCargoDelivery:true});assert.ok(g.firstLevel.rack.stroke<.02);assert.ok(g.firstLevel.bridge.position.x<-18.9);assert.equal(g.physics.portalTransports,0);assert.equal(g.firstLevel.inspection.progress,0);assert.equal(g.state,'playing');}});assert.equal(r.resets+r.respawns,0);}finally{close(g);}});
test('32: two lit height sensors without real cargo opacity keep the differential diaphragm closed',async()=>{const g=await room(32);try{await runV8Journey(g,{scenario:d=>{runPostA(d,{route:'inspect-optics-first',stopBeforeCargoDelivery:true});assert.deepEqual(g.firstLevel.optics.raw,[true,true]);assert.deepEqual(g.firstLevel.optics.shadow,[false,false]);assert.equal(g.firstLevel.optics.valid,false);assert.ok(g.firstLevel.diaphragm.progress<.01);assert.equal(g.physics.portalTransports,0);}});}finally{close(g);}});
test('33: a real compressed and loaded spring remains inert until its outer release is operated',async()=>{const g=await room(33);try{await runV8Journey(g,{scenario:d=>{runPostA(d,{stopBeforeRelease:true});const s=g.firstLevel.spring;assert.ok(s.compression>.65);assert.ok(s.held);assert.ok(s.loaded());assert.equal(g.physics.portalTransports,0);assert.equal(g.firstLevel.catcher.loaded(),false);assert.ok(g.firstLevel.door.progress<.01);const y=g.cargo.position.y;d.wait(2);assert.ok(Math.abs(g.cargo.position.y-y)<.05);assert.equal(g.state,'playing');}});}finally{close(g);}});
for(const [n,z]of [[32,-8],[33,-8],[35,9]])for(const x of [-22,22])test(`${n}: sprint and jump cannot pass the closed ${x<0?'west':'east'} partition`,async()=>{const g=await room(n);try{await runV8Journey(g,{scenario:d=>{d.walk(n===32&&x<0?-12:x,z+4);g.input.keys.add('ShiftLeft');for(let i=0;i<150;i++){if(i%45===0)g.input.jumpQueued=true;d.worldMove(0,-1);d.frame();}d.stop();assert.ok(g.playerPosition.z>z+.4);assert.equal(g.state,'playing');assert.equal(g.physics.portalTransports,0);}});}finally{close(g);}});
