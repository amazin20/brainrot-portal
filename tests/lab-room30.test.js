import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {ROOM30_SPEC} from '../src/game/LabPortalRoom30.js';
const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});
for(const [name,aspect,options] of [
 ['north arc',1.6,{}],['east arc',16/9,{east:true}],['north arc after exploring both wings',16/9,{inspectFirst:true}],
 ['east arc after physical recovery',1.6,{east:true,recovery:true}],
])test(`room30 ${name}: real input takes the original companion through a spatial finale`,async()=>{
 await game.selectLevel(29,false);game.camera.aspect=aspect;game.camera.updateProjectionMatrix();const body=game.physics.cargoBody,cargo=game.cargo;
 const report=await runV8Journey(game,{journeyOptions:options});
 assert.equal(report.pass,true);assert.equal(game.state,'won');assert.equal(game.epicMode??false,false);assert.equal(game.kineticMode,true);
 assert.equal(report.respawns+report.resets,0);assert.equal(game.physics.cargoBody,body);assert.equal(game.cargo,cargo);
 assert.equal(game.velocityCompanion.connected,true);assert.equal(game.velocityCompanion.isNear(),true);
 assert.equal(report.teleports,options.recovery?3:2);assert.ok(game.firstLevel.peakSpeed>38,'The finale lost its gravity-generated speed');
 assert.ok(report.milestones.some(m=>m.name.includes(options.east?'east-west':'north-south')));
 if(options.recovery)assert.ok(report.milestones.some(m=>m.name.includes('ordinary portals recover')));
});

test('room30 has a shared physical finish and no route checklist or preset portals',async()=>{
 await game.selectLevel(29,false);game.resetRun(true);const l=game.firstLevel;
 assert.equal(l.puzzleGeometry.noProgressFlags,true);assert.deepEqual(l.puzzleGeometry.firstRoutes,['north-arc','east-arc']);
 assert.equal(game.portals.ready,false);assert.deepEqual(game.portalSurfaceIds,[null,null]);assert.equal(game.portalPanels.length,7);
 assert.equal(ROOM30_SPEC.title,'Предел');assert.equal(l.launchArt.paths.length,3);
 game.playerPosition.copy(l.goal.position);game.playerGrounded=true;assert.equal(l.isWon(),false,'Solo arrival must not finish');
 game.cargo.position.copy(l.goal.position).y+=.4;assert.equal(l.isWon(),true,'Physical joint arrival must not require hidden travel flags');
 game.playerGrounded=false;assert.equal(l.isWon(),false);
});
