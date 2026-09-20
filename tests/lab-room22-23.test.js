import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installRoom21Aim} from '../src/game/LabRoom21Journey.js';
const g=await createHeadlessGame();after(()=>{g.physics.dispose();g.portals.dispose();});
for(const options of [{order:'weight-first'},{order:'portal-first'},{recovery:true}])test(`room22 ordinary shutter exchange ${JSON.stringify(options)}`,async()=>{
 await g.selectLevel(21,false);const r=await runV8Journey(g,{journeyOptions:options});assert.equal(r.pass,true);assert.equal(r.resets+r.respawns,0);assert.equal(g.state,'won');assert.equal(r.teleports,1);assert.ok(g.physics.portalTransports>=1);assert.equal(g.firstLevel.shutters.loaded,false);assert.ok(g.playerPosition.y>=14);
});
for(const options of [{order:'receiver-first'},{order:'floor-first'},{recovery:true}])test(`room23 ordinary coupled counterweight journey ${JSON.stringify(options)}`,async()=>{
 await g.selectLevel(22,false);const r=await runV8Journey(g,{journeyOptions:options});assert.equal(r.pass,true);assert.equal(r.resets+r.respawns,0);assert.equal(g.state,'won');assert.ok(g.physics.portalTransports>=2);assert.ok(g.playerPosition.y>=20);assert.ok(g.cargo.position.y>=20);
});
test('room22 empty or hand-carried weight cannot open the ground throat',async()=>{
 await g.selectLevel(21,false);await runV8Journey(g,{scenario:d=>{d.walk(-16,17);d.pickup();d.walk(-12,1);d.wait(2);assert.equal(d.level.shutters.loaded,false);assert.equal(d.level.shutters.progress,0);d.walk(-3,12);for(let n=0;n<180;n++){d.worldMove(1,0);if(n%30===0)g.input.jumpQueued=true;d.frame();}assert.ok(g.playerPosition.x<-.65);assert.equal(g.state,'playing');}});
});
test('room23 carrying the freight inside its carriage keeps the transmission loaded',async()=>{
 await g.selectLevel(22,false);let observed=false;const r=await runV8Journey(g,{onMilestone:m=>{if(m.name.startsWith('permanent gallery'))observed=true;}});assert.equal(r.pass,true);assert.ok(observed);
 // Explicit negative fixture tests live contact rather than a successful route.
 g.resetRun(true);const b=g.firstLevel.balance;b.height=10;b.braked=false;b.west.setY(10,0);b.east.setY(10,0);g.playerPosition.set(11,10.025,4);g.previousPlayerPosition.copy(g.playerPosition);g.playerGrounded=true;g.heldCube=g.cargo;for(let i=0;i<120;i++)b.update(1/120);assert.equal(b.loaded,true);assert.ok(b.height>9.99);g.heldCube=null;
});
test('room23 visible recovery release frees an accidentally parked empty mechanism',async()=>{
 await g.selectLevel(22,false);g.firstLevel.balance.braked=true;await runV8Journey(g,{scenario:d=>{d.level.balance.braked=true;d.walk(-18,12.3);assert.equal(g.interact(),true);assert.equal(d.level.balance.braked,false);assert.equal(g.state,'playing');}});
});
test('room23 freight throat does not let an unloaded traveller walk straight onto the high exit apron',async()=>{
 await g.selectLevel(22,false);await runV8Journey(g,{scenario:d=>{installRoom21Aim(d);d.walk(-12,3);d.pickup();d.walk(-18,15);g.interact();d.wait(2);d.walk(-16,3);d.aim(1,d.level.panels['freight-throat'].getFrame().center);d.aim(0,d.level.panels['west-load-car'].getFrame().center);d.walk(-11,3);d.wait(1);for(let n=0;n<300;n++){d.worldMove(0,1);if(n%40===0)g.input.jumpQueued=true;d.frame();assert.ok(!(g.playerPosition.y>19.9&&g.playerPosition.z>6.7),'Low freight hood admitted a standing capsule to the upper exit');}assert.equal(g.state,'playing');}});
});
test('both room exits require the original physical cargo and grounded joint arrival',async()=>{
 for(const index of [21,22]){await g.selectLevel(index,false);g.resetRun(true);const l=g.firstLevel;g.playerPosition.copy(l.goal.position);g.playerGrounded=true;assert.equal(l.isWon(),false);g.cargo.position.copy(l.goal.position).add(new THREE.Vector3(0,.4,0));assert.equal(l.isWon(),true);g.playerGrounded=false;assert.equal(l.isWon(),false);}
});
