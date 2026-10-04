import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

// Every proof starts at Play and sends real controller, projectile and E inputs.
// The restart assertions follow a completed route, so they exercise broken,
// pinned, clamped, fallen and dispatched physical mechanisms, rather than an
// already pristine fixture. The companion object and rigid body stay original.
const sourceFiles=['LabExpansionRoomsB.js','LabExpansionJourneyB.js','LabGame.js','LabPhysics.js','LabPortals.js'];
const fingerprint=()=>createHash('sha256').update(sourceFiles.map(name=>name+'\n'+fs.readFileSync(new URL('../src/game/'+name,import.meta.url))).join('\n')).digest('hex');
const proof={scope:'Five complete ordinary-input routes followed by production restart of genuinely changed mechanisms.',sourceFiles,rows:[]};
const save=()=>{fs.mkdirSync(new URL('../qa/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../qa/expansion-b-release.json',import.meta.url),JSON.stringify(proof,null,2)+'\n');};

for(const room of [47,48,49,50,51])test(`${room}: same companion completes the physical route and a real restart clears the changed mechanism`,async()=>{
 const g=await createHeadlessGame(),row={room,sourceBefore:fingerprint(),started:new Date().toISOString()};
 try{
  g.chamberEdition='foundation';await g.selectLevel(room-1,false);const cargo=g.cargo,body=g.physics.cargoBody,l=g.firstLevel;
  row.journey=await runV8Journey(g);assert.equal(row.journey.pass,true);assert.equal(g.state,'won');
  assert.equal(row.journey.resets+row.journey.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
  if(room===47){assert.equal(l.fuse.broken,true);assert.equal(l.fuse.bodies.length,16);assert.ok(l.fuse.energy>=175);}
  if(room===48){assert.equal(l.press.pinned,true);assert.ok(l.press.gap>.68);assert.ok(l.roof.progress>.95);}
  if(room===49){assert.equal(l.head.clamped,true);assert.equal(l.head.lit,true);}
  if(room===50){assert.ok(l.top.angle< -1.43);assert.ok(l.bumper.progress>.95);}
  if(room===51){assert.ok(l.shuttle.at(2));assert.ok(g.physics.portalTransports>=1);assert.ok(g.teleportCount>=4);}
  row.cargoTransports=g.physics.portalTransports;
  g.resetRun(true);
  assert.equal(g.state,'playing');assert.equal(g.heldCube,null);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
  assert.equal(g.teleportCount,0);assert.equal(g.portals.ready,false);assert.equal(g.cargoPortalCooldown,0);
  // This physics counter measures the lifetime of the same rigid body;
  // restart clears the live route and cooldown rather than rewriting history.
  assert.equal(g.physics.portalTransports,row.cargoTransports);assert.ok(g.physics.cargoBody.velocity.length()<1e-8);
  assert.equal(g.portalShots.queue.length+g.portalShots.active.length,0);
  if(room===47){assert.equal(l.fuse.broken,false);assert.equal(l.fuse.energy,0);assert.equal(l.fuse.bodies.length,0);}
  if(room===48){assert.equal(l.press.pinned,false);assert.equal(l.press.running,false);assert.ok(Math.abs(l.press.body.position.x+2.4)<1e-8);assert.equal(l.roof.target,false);}
  if(room===49){assert.equal(l.head.clamped,false);assert.equal(l.head.lit,false);assert.equal(l.head.angle,0);}
  if(room===50){assert.ok(Math.abs(l.top.angle)<1e-8);assert.equal(l.bumper.target,false);assert.ok(Math.abs(l.top.body.position.y-7)<1e-8);}
  if(room===51){assert.ok(l.shuttle.at(0));assert.equal(l.shuttle.target,0);assert.equal(l.clutch.loaded(),false);}
  row.pass=true;row.restartCleared=true;row.sameCargo=true;row.sameBody=true;
 }catch(error){row.pass=false;row.error=String(error);throw error;}
 finally{row.sourceAfter=fingerprint();row.sourceStable=row.sourceBefore===row.sourceAfter;row.finished=new Date().toISOString();proof.rows.push(row);save();g.firstLevel?.dispose?.();g.physics?.dispose();g.portals?.dispose();}
});
