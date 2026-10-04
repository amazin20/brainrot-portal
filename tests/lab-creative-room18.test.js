import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runCreative18} from '../src/game/LabCreativeRoom18Journey.js';
import {creative18Attacks,creative18EarlyAttacks} from '../scripts/lib/creative-room18-attacks.mjs';
async function room(aspect=16/9){const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(17,false);g.camera.aspect=aspect;g.camera.updateProjectionMatrix();assert.equal(g.firstLevel.creativeEarly,18);return g;}
function dispose(g){g.firstLevel?.dispose();g.physics?.dispose();g.portals?.dispose();}
for(const aspect of [16/9,1.6,390/844])for(const route of (aspect===390/844?['contact-then-power']:['contact-then-power','power-before-contact','reverse-partial-stroke']))test(`18 electrical: ${route}, aspect ${aspect}, original pair and no reset`,async()=>{
 const g=await room(aspect);try{const report=await runV8Journey(g,{scenario:d=>runCreative18(d,{route})});assert.equal(g.state,'won');assert.equal(report.resets+report.respawns,0);assert.ok(g.firstLevel.circuit.stroke>6.49);assert.equal(g.firstLevel.circuit.current,0);assert.ok(report.milestones.some(m=>m.name.includes('Cannon contacts')));
 }finally{dispose(g);}
});
for(const a of [...creative18Attacks,...creative18EarlyAttacks])test('18 electrical omission/edge: '+a.name,async()=>{const g=await room();try{const r=await runV8Journey(g,{scenario:d=>a.run(d)});assert.equal(r.resets+r.respawns,0);assert.equal(g.state,'playing');}finally{dispose(g);}});
test('18 series continuity: an observed single real contact carries no current despite forward supply',async()=>{
 const g=await room(),update=g.updatePlaying;let singles=0,bothSeen=false;try{g.updatePlaying=function(dt){update.call(this,dt);const s=this.firstLevel.circuit;if(s.contacts.every(Boolean))bothSeen=true;if(!bothSeen&&s.mode===1&&s.contacts.filter(Boolean).length===1){singles++;assert.equal(s.current,0);assert.equal(s.stroke,0);}};
  await runV8Journey(g,{scenario:d=>runCreative18(d,{route:'power-before-contact'})});assert.ok(singles>0,'The off-centre delivered cargo must physically touch one electrode before the opposite spring reaches it');
 }finally{g.updatePlaying=update;dispose(g);}
});
test('18 screw and linked hatch: actual contact causality, continuous swept geometry, render purity and reset',async()=>{
 const g=await room();try{const l=g.firstLevel,s=l.circuit,fixed=g.colliders.filter(c=>c.enabled!==false&&!c.kinematic);
  const overlap=(a,b)=>['x','y','z'].every(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])>1e-5);
  for(const part of [l.door,...l.hatch]){const end=part.collider.box.clone().translate(new THREE.Vector3(part===l.door?6.5:-6.5,0,0)),swept=part.collider.box.clone().union(end);for(const c of fixed)assert.ok(!overlap(swept,c.box),'Full physical stroke collides with '+c.mesh.name);}
  const report=await runV8Journey(g,{scenario:d=>{runCreative18(d,{stopBeforePower:true});assert.deepEqual(s.contacts,[true,true]);assert.ok(g.physics.world.contacts.some(c=>c.bi===g.physics.cargoBody||c.bj===g.physics.cargoBody));assert.equal(s.current,0);
   const snap=()=>JSON.stringify({state:g.state,elapsed:g.elapsed,p:g.playerPosition.toArray(),c:g.cargo.position.toArray(),stroke:s.stroke,mode:s.mode,current:s.current});const before=snap();for(const a of [0,.25,.5,1])l.renderUpdate(a);assert.equal(snap(),before);
  }});assert.equal(report.resets+report.respawns,0);g.resetRun();assert.equal(s.stroke,0);assert.equal(s.mode,0);assert.deepEqual(s.contacts,[false,false]);
 }finally{dispose(g);}
});
