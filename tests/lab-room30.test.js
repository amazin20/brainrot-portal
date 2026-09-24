import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
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
 const first=report.milestones.find(m=>m.name.includes('physical arc reaches'));
 assert.ok(first&&first.player[1]>39.8);
 assert.ok(options.east?first.player[0]>95:first.player[0]<81,'The first arcs must land on separate islands');
 assert.equal(game.portalSurfaceIds[0],game.firstLevel.panels[options.east?'east-second-well':'second-well'].mesh.uuid);
 assert.equal(game.portalSurfaceIds[1],game.firstLevel.panels[options.east?'east-sunward-outlet':'sunward-outlet'].mesh.uuid);
 assert.ok(options.east?game.firstLevel.state.eastTilt.angle>.7:game.firstLevel.state.tilt.angle>.7);
 assert.ok(options.east?game.firstLevel.state.tilt.angle<.01:game.firstLevel.state.eastTilt.angle<.01,
  'Each ending depends on its own physical outlet control');
 if(options.recovery)assert.ok(report.milestones.some(m=>m.name.includes('ordinary portals recover')));
});

test('room30 has a shared physical finish and no route checklist or preset portals',async()=>{
 await game.selectLevel(29,false);game.resetRun(true);const l=game.firstLevel;
 assert.equal(l.puzzleGeometry.noProgressFlags,true);assert.deepEqual(l.puzzleGeometry.firstRoutes,['north-arc','east-arc']);
 assert.equal(game.portals.ready,false);assert.deepEqual(game.portalSurfaceIds,[null,null]);assert.equal(game.portalPanels.length,9);
 assert.equal(ROOM30_SPEC.title,'Предел');assert.equal(l.launchArt.paths.length,4);
 assert.ok(l.world.floors.filter(f=>f.y===40).every(f=>f.maxX<=80||f.minX>=95),
  'The two observation islands cannot be joined by an ordinary deck');
 game.playerPosition.copy(l.goal.position);game.playerGrounded=true;assert.equal(l.isWon(),false,'Solo arrival must not finish');
 game.cargo.position.copy(l.goal.position).y+=.4;assert.equal(l.isWon(),true,'Physical joint arrival must not require hidden travel flags');
 game.playerGrounded=false;assert.equal(l.isWon(),false);
});

test('room30 shell fits the real flight course and still screens the last outlet from the opening hub',async()=>{
 await game.selectLevel(29,false);game.resetRun(true);const l=game.firstLevel,b=l.bounds;
 assert.equal(b.maxX-b.minX,278);assert.equal(b.maxZ-b.minZ,160);
 assert.equal(l.puzzleGeometry.footprint,278*160);
 const service=l.world.floors.find(f=>f.mesh.name==='Lower hangar service deck');
 assert.ok(service);assert.deepEqual([service.minX,service.maxX,service.minZ,service.maxZ],[b.minX,b.maxX,b.minZ,b.maxZ]);
 const roof=l.world.root.getObjectByName('Solid hangar roof');
 assert.ok(roof,'Flight hall must have an actual ceiling');
 roof.updateWorldMatrix(true,false);
 const roofBottom=new THREE.Box3().setFromObject(roof).min.y;
 const highestCollar=Math.max(...l.launchArt.paths.flatMap(path=>path.rings.map(ring=>{
  ring.updateWorldMatrix(true,false);return new THREE.Box3().setFromObject(ring).max.y;
 })));
 assert.ok(roofBottom-highestCollar>5,'The highest real flight collar needs clear headroom');
 assert.ok(roofBottom-highestCollar<20,'The roof must frame the flown course rather than a huge empty void');
 for(const floor of l.world.floors){
  assert.ok(floor.minX>=b.minX&&floor.maxX<=b.maxX,`Floor outside hangar X: ${floor.mesh.name}`);
  assert.ok(floor.minZ>=b.minZ&&floor.maxZ<=b.maxZ,`Floor outside hangar Z: ${floor.mesh.name}`);
 }
 const screen=l.world.root.getObjectByName('Hub-to-outlet sightline screen');
 assert.ok(screen);
 screen.updateWorldMatrix(true,false);const box=new THREE.Box3().setFromObject(screen),outlet=l.panels['sunward-outlet'].getFrame().center;
 for(const x of [-32,28])for(const z of [-22,26]){
  const eye=new THREE.Vector3(x,53,z),ray=new THREE.Ray(eye,outlet.clone().sub(eye).normalize());
  const hit=ray.intersectBox(box,new THREE.Vector3());
  assert.ok(hit&&hit.distanceTo(eye)<outlet.distanceTo(eye),`Final outlet visible from opening hub at ${x},${z}`);
 }
});
