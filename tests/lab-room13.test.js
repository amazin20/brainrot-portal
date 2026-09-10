import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom13,room13Access,room13Light} from '../src/game/LabRoom13Journey.js';
const game=await createHeadlessGame();after(()=>{game.physics.dispose();game.portals.dispose();});
for(const [order,aspect] of [['cargo-first',16/9],['scout-first',1.6]])test(`optical paradox completes ${order} at ${aspect} using original bodies and real controls`,async()=>{
 await game.selectLevel(12,false);game.camera.aspect=aspect;game.camera.updateProjectionMatrix();const body=game.physics.cargoBody;
 const report=await runV8Journey(game,{scenario:d=>runRoom13(d,{order})});
 assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);assert.equal(game.physics.cargoBody,body);
 assert.equal(game.firstLevel.state.optical.receivers.some(Boolean),false,'Reunion releases the light pair; no permanent bridge/door state');
 const names=report.milestones.map(m=>m.name),scout=names.indexOf('scout reads both optical paths'),weight=names.indexOf('live weight turns the mirror');
 if(order==='scout-first'){
  assert.ok(scout>=0&&scout<weight);assert.ok(names.includes('scout returns below the mirror'));
  assert.ok(report.milestones[scout].player[1]>11.9&&report.milestones[scout].cargo[1]<1);
 }else assert.equal(scout,-1);
 assert.ok(report.milestones.find(m=>m.name==='the return side of the light').player[1]>11.9);
});
test('an occupied cage returns after a misplaced portal and the same friend can still be recovered',async()=>{
 await game.selectLevel(12,false);game.camera.aspect=1.6;game.camera.updateProjectionMatrix();
 const report=await runV8Journey(game,{scenario:d=>runRoom13(d,{interruptPower:true})});
 assert.equal(game.state,'won');assert.ok(report.milestones.some(m=>m.name==='lost light returns the occupied cage'));assert.equal(report.resets+report.respawns,0);
});
test('the unweighted physical mirror drives the north branch and cannot power the southern route',async()=>{
 await game.selectLevel(12,false);
 await runV8Journey(game,{scenario:d=>{
  room13Access(d,{carry:false});d.walk(-16,-15.2);d.walk(-16,-12);d.walk(-12,-6);room13Light(d,{branch:'north'});
  d.until(()=>game.playerPosition.y>11.98,12,'North cage');
  assert.deepEqual(game.firstLevel.state.optical.receivers,[true,false]);assert.equal(game.firstLevel.state['south-cage'].position.y,6);
  assert.ok(game.cargo.position.y<1);assert.equal(game.state,'playing');
 }});
});
test('every ceramic has a role and fixed structural floors do not overlap at the same height',async()=>{
 await game.selectLevel(12,false);const l=game.firstLevel;
 assert.deepEqual(Object.keys(l.puzzleGeometry.portalRoles).sort(),Object.keys(l.panels).sort());assert.equal(Object.keys(l.panels).length,6);
 const fixed=l.world.surfaces.filter(s=>s.floor&&!s.collider.kinematic).map(s=>s.floor);
 for(let i=0;i<fixed.length;i++)for(let j=i+1;j<fixed.length;j++){
  const a=fixed[i],b=fixed[j];if(Math.abs(a.y-b.y)>.001)continue;
  assert.ok(Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX)<=.001||Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ)<=.001,'Coincident structural floor rectangles');
 }
});
