import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runPostB} from '../src/game/LabPostJourneyB.js';
import {POST_B_SPECS} from '../src/game/LabPostCampaignB.js';
async function room(n){const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(n-1,false);return g;}
function close(g){g.physics?.dispose();g.portals?.dispose();}
const alternate={36:'scout-impact-first',37:'prepare-fields-first',38:'send-freight-early',39:'receiver-first',40:'trim-then-balance'};
for(let n=36;n<=40;n++)for(const route of [undefined,alternate[n]])test(`late room ${n}: ${route||'canonical'} completes its current physical mechanism`,async()=>{
 const g=await room(n),cargo=g.cargo,body=g.physics.cargoBody.id;
 try{const r=await runV8Journey(g,{journeyOptions:route?{route}:{}});assert.equal(r.pass,true);assert.equal(g.state,'won');assert.equal(r.resets+r.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody.id,body);assert.equal(g.firstLevel.id,POST_B_SPECS[n-36].id);assert.ok(g.firstLevel.workshop.enclosed);assert.ok(g.firstLevel.puzzleGeometry.noProgressFlags);
  g.resetRun(true);assert.equal(g.state,'playing');assert.equal(g.physics.cargoBody.id,body);assert.equal(g.portals.ready,false);assert.ok(g.cargo.position.distanceTo(new THREE.Vector3(...g.firstLevel.cargoSpawn))<.001);
  if(n===36){assert.equal(g.firstLevel.rotor.angle,0);assert.ok(g.firstLevel.bridge.at(0));}
  if(n===37){assert.equal(g.firstLevel.getMagnet(),-1);assert.equal(g.firstLevel.isLatched(),false);assert.equal(g.firstLevel.door.progress,0);}
  if(n===39){assert.equal(g.firstLevel.thermal.temperature,20);assert.equal(g.firstLevel.thermal.extension,0);assert.equal(g.firstLevel.second.progress,0);}
  if(n===40){const c=g.firstLevel.getCalibration();assert.equal(c.trim,1.5);assert.equal(c.arm,0);assert.equal(c.clamped,false);assert.equal(c.lit,false);}
 }finally{close(g);}
});
for(const n of [38,39])test(`${n}: an actual failed approach can be recovered using ordinary movement and portal input`,async()=>{const g=await room(n);try{const r=await runV8Journey(g,{journeyOptions:{recover:true}});assert.equal(g.state,'won');assert.equal(r.resets+r.respawns,0);assert.ok(r.milestones.some(m=>/recover|missed/i.test(m.name)));}finally{close(g);}});
test('39: rerouted optical power consumes conserved thermal energy and physically withdraws the first opening',async()=>{const g=await room(39);try{await runV8Journey(g,{scenario:d=>{runPostB(d,{stopBeforeDiversion:true});const l=g.firstLevel,hot=l.thermal.temperature,energy=l.thermal.energy;assert.equal(l.thermal.powered,false);assert.equal(l.thermal.remote,true);d.wait(20);assert.ok(l.thermal.temperature<hot*.6);assert.ok(l.thermal.energy<energy*.6);assert.ok(l.first.progress<.45);assert.ok(l.second.progress>.9);assert.ok(new THREE.Box3().setFromObject(l.first.mesh).equals(l.first.collider.box));assert.equal(g.state,'playing');}});}finally{close(g);}});
test('38: fixed manufactured walking decks have no overlapping coplanar top faces',async()=>{const g=await room(38);try{const decks=g.firstLevel.workshop.decks;for(let i=0;i<decks.length;i++)for(let j=i+1;j<decks.length;j++){const a=decks[i],b=decks[j];if(Math.abs(a.y-b.y)>.001)continue;assert.ok(Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX)<.001||Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ)<.001,`${a.name} overlaps ${b.name}`);}}finally{close(g);}});
