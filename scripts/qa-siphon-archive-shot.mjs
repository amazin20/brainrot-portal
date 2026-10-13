/** Reproduces the southern-hall archive shortcut using ordinary production
 * movement, camera aim, actual projectile flight and original cargo pickup.
 * EXPECT_BYPASS=1 is for the archived pre-fix proof only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installPreciseLateAim,aimLateSurface} from '../src/game/LabLateCampaignAim.js';

const g=await createHeadlessGame();g.chamberEdition='foundation';
const expectBypass=process.env.EXPECT_BYPASS==='1';
const out=process.env.OUT||'qa/siphon-archive-shot-after.json';
const report={scope:'Production headless simulation; ordinary input, no actor or mechanism state assignments after the normal Play reset. No browser rendering claim.',expectBypass,attempts:[]};
const snapshot=()=>({player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),held:!!g.heldCube,state:g.state,teleports:g.teleportCount,primed:g.firstLevel.circuit.primed,height:g.firstLevel.circuit.height,delivered:g.firstLevel.circuit.delivered,displacement:g.firstLevel.getDisplacement()});
try {
 await g.selectLevel(32,false);
 const cargo=g.cargo,body=g.physics.cargoBody;
 const route=await runV8Journey(g,{scenario:async d=>{
  installPreciseLateAim(d);d.walk(4,19);aimLateSurface(d,0,d.level.loading);d.walk(20,29);
  const point=new THREE.Vector3(20,15.55,-27.6);
  d.look(point);assert.ok(g.firePortal(1));d.until(()=>!g.portalShots.queue.length&&!g.portalShots.active.length,3,'Original exploit projectile resolution');
  const impact={...g.portalShots.lastImpact};report.attempts.push({name:'original-eastern-archive-top-edge-shot',point:point.toArray(),impact,...snapshot()});
  if(!expectBypass){assert.equal(impact.valid,false,'Original archive bypass still places a passenger portal');return;}
  assert.equal(impact.valid,true);assert.equal(g.portals.portals[1]?.surfaceId,d.level.arrival.mesh.uuid);
  // Walk around the opened floor aperture until the original cargo is held.
  d.walk(20,16.8);d.walk(11,16.8);d.pickup();d.walk(20,16.8);d.walk(20,25);d.walk(13,25);
  const before=g.teleportCount;
  for(let i=0;i<300&&g.teleportCount===before;i++){d.worldMove(0,-1);d.frame();}
  d.stop();d.wait(.7);assert.ok(g.teleportCount>before);assert.ok(g.heldCube);d.walk(20,-20);d.until(()=>g.state==='won',4,'Bypass did not complete');
  assert.equal(d.level.circuit.height,0);assert.equal(d.level.circuit.primed,false);assert.equal(d.level.circuit.delivered,0);assert.equal(d.level.getDisplacement(),0);
 }});
 report.route=route;report.final=snapshot();assert.equal(route.resets+route.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
 if(!expectBypass){
  // Also attack the new mounted faces, not merely coordinates now left empty.
  for(const [x,z,key]of [[13,29,'passage'],[20,29,'arrival']])for(const offset of [0,2.5]){
   await g.selectLevel(32,false);
   const attempt=await runV8Journey(g,{scenario:d=>{
    installPreciseLateAim(d);d.walk(x,z);const surface=d.level[key],point=surface.getFrame().center.clone().add(new THREE.Vector3(0,offset,0));d.look(point);assert.ok(g.firePortal(1));d.until(()=>!g.portalShots.queue.length&&!g.portalShots.active.length,3,'North-facing mounted archive shot');
    const impact={...g.portalShots.lastImpact};report.attempts.push({name:`new-${key}-backface-offset-${offset}`,point:point.toArray(),impact,...snapshot()});assert.equal(impact.valid,false,'A southern-hall shot opened the north-facing archive');assert.equal(d.level.circuit.height,0);assert.equal(g.state,'playing');
   }});assert.equal(attempt.resets+attempt.respawns,0);
  }
 }
 report.pass=true;
} finally {
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 g.firstLevel.dispose?.();g.physics.dispose();g.portals.dispose();console.log(JSON.stringify(report));
}
