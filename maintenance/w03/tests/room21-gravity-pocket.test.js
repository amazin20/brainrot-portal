import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {geometryContract} from '../scripts/w03-geometry-contract.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom21} from '../src/game/LabRoom21Journey.js';
import {runRoom21Recorded} from '../src/game/LabRoom21Recording.js';
import {CAMPAIGN} from '../src/game/LabCampaignLevels.js';
import {LabPreferences} from '../src/game/LabPreferences.js';
const g=await createHeadlessGame();
after(()=>{g.physics?.dispose();g.portals?.dispose();});
const results=new Map();
test('W03 retains exact gameplay geometry of all twenty accepted rooms',async()=>{
 const base=JSON.parse(fs.readFileSync(new URL('./fixtures/w03-protected-geometry.json',import.meta.url)));
 for(let i=0;i<20;i++){await g.selectLevel(i,false);g.resetRun(true);g.scene.updateMatrixWorld(true);assert.deepEqual(geometryContract(g),base.rooms[i],`protected room ${i+1}`);}
});
test('v36 completed progress survives append; the new room is not automatically solved',()=>{
 const saved={campaignRevision:'folded-junction-v28',completed:Array.from({length:20},(_,i)=>i),volume:.4,quality:'low'};
 const storage={getItem:()=>JSON.stringify(saved),setItem(){}};const p=new LabPreferences(storage);
 assert.deepEqual(p.value.completed,saved.completed);assert.ok(!p.value.completed.includes(20));
 assert.equal(CAMPAIGN[19].id,'braided-exchange');assert.equal(CAMPAIGN[20].id,'gravity-pocket');assert.equal(CAMPAIGN.length,21);
});
for(const options of [{order:'cargo-first'},{order:'scout-first'},
 {recovery:true,interrupt:true,eraseInFlight:true},{offsetX:-.5},{offsetX:.5},{approach:.1},{approach:.2}]){
 test(`room21 joint exit with ordinary input: ${JSON.stringify(options)}`,async()=>{
  await g.selectLevel(20,false);g.renderer={domElement:{requestPointerLock(){}}};
  const report=await runV8Journey(g,{scenario:async d=>runRoom21(d,options)});
  assert.equal(g.state,'won');assert.ok(report.pass);assert.equal(report.respawns,0);assert.equal(report.resets,0);
  assert.ok(g.heldCube,'The same companion is physically carried to the joint exit');
  results.set(JSON.stringify(options),report);delete g.renderer;
 });
}
test('native recording driver executes the identical ordinary route and physical states',async()=>{
 await g.selectLevel(20,false);let frames=0;
 const r=await runRoom21Recorded(g,{order:'cargo-first',onFrame:n=>{frames=n;}});
 const baseline=results.get('{"order":"cargo-first"}');
 assert.equal(r.frames,baseline.frames);assert.equal(frames,r.frames);assert.equal(r.milestones.length,baseline.milestones.length);
 for(let i=0;i<r.milestones.length;i++){
  const a=r.milestones[i],b=baseline.milestones[i];assert.equal(a.name,b.name);assert.equal(a.teleports,b.teleports);
  for(const key of ['player','cargo'])for(let j=0;j<3;j++)assert.ok(Math.abs(a[key][j]-b[key][j])<1e-8,'Recording changes physical state');
 }
});
test('room21 has no hidden launch bonus or prerequisite flag for joint physical arrival',async()=>{
 await g.selectLevel(20,false);const l=g.firstLevel;assert.equal(l.getLaunch(g.playerPosition),null);
 assert.equal(l.playerAcceleration,undefined);assert.equal(l.momentum,true);
 // Isolated predicate fixture, not a route/playthrough.
 g.playerPosition.copy(l.goal.position);g.playerGrounded=true;
 g.cargo.position.set(-3.8,4.55,12);assert.equal(l.isWon(),false,'Player alone cannot complete');
 g.cargo.position.copy(l.goal.position).y+=.4;assert.equal(l.isWon(),true,'No visited-button bookkeeping');
 g.playerGrounded=false;assert.equal(l.isWon(),false);
 const normal=l.panels.rise.getFrame().normal;assert.ok(normal.dot(new THREE.Vector3(0,Math.cos(Math.PI/9),Math.sin(Math.PI/9)))>.99999);
});
