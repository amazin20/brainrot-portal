import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
let game;
async function room(n){game??=await createHeadlessGame();game.chamberEdition='open';await game.selectLevel(n-1,false);game.resetRun(true);return game;}
for(const angle of [0,45,90,135,180,225,270,315])test(`actual room 24: approach a shifted floor aperture from ${angle} degrees`,async()=>{
 const g=await room(24),pad=g.firstLevel.panels['ground-load'],car=g.firstLevel.car.panel,c=pad.getFrame().center.clone().add(new THREE.Vector3(.65,0,-.55));
 for(const [i,s,p]of [[0,pad,c],[1,car,car.getFrame().center]]){const result=g.portals.placeOnPanel(i,s.mesh,p);assert.equal(result.ok,true);g.portalSurfaceIds[i]=s.mesh.uuid;}
 assert.ok(g.portals.portals[0].backingIds.size>1,'The deep deck must be owned, not globally ignored');
 const a=angle*Math.PI/180;g.playerPosition.set(c.x+Math.cos(a)*3,.2,c.z+Math.sin(a)*3);g.previousPlayerPosition.copy(g.playerPosition);g.playerVelocity.set(0,0,0);g.yaw=0;
 g.input.getMove=()=>{const dx=c.x-g.playerPosition.x,dz=c.z-g.playerPosition.z;return Math.hypot(dx,dz)<.15?new THREE.Vector2():new THREE.Vector2(dx,dz).normalize().multiplyScalar(.55);};
 for(let i=0;i<600&&!g.teleportCount;i++)g.updatePlaying(1/120);
 assert.equal(g.teleportCount,1,'Portal throat must not snag on the manufactured hull');assert.equal(g.respawnCount||0,0);
});
test('room 28 tells the actual hydraulic state and keeps its compact laboratory enclosure',async()=>{
 const g=await room(28),l=g.firstLevel;assert.equal(l.puzzleGeometry.footprint,2820);assert.ok(l.workshop.enclosed);assert.equal(l.workshop.roomEnvelope.roof,18);
 assert.match(l.getObjective(),/НЕТ СОЕДИНЕНИЯ/);assert.match(l.getObjective(),/А: 8.0/);
 for(const [i,name]of [[0,'west-low'],[1,'east-low']]){const p=l.panels[name];assert.equal(g.portals.placeOnPanel(i,p.mesh,p.getFrame().center.clone().add(new THREE.Vector3(0,-.45,0))).ok,true);g.portalSurfaceIds[i]=p.mesh.uuid;}
 for(let i=0;i<120;i++)g.updatePlaying(1/120);assert.ok(l.tides.levels[1]>0);assert.match(l.getObjective(),/ВОДА: А → Б/);
 const before=[...l.tides.levels];g.clearPortals();for(let i=0;i<120;i++)g.updatePlaying(1/120);assert.deepEqual(l.tides.levels,before);assert.match(l.getObjective(),/НЕТ СОЕДИНЕНИЯ/);
});
