import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {resolvePortalPlacement} from '../src/game/LabPortals.js';
import {room14InputControls} from '../src/game/LabRoom14Journey.js';
import {assertRoom14DeflectorGeometry,assertRoom14FieldOwnership} from './helpers/lab-room14-deflector-contract.js';

const game = await createHeadlessGame();
after(() => { game.physics.dispose(); game.portals.dispose(); });

for (const number of [13, 14, 15]) test(`room ${number} has valid tiles and no duplicate coplanar walking decks`, async () => {
  await game.selectLevel(number - 1, false);
  const surfaces = game.firstLevel.world.surfaces, faces = new Map();
  for (const surface of surfaces) {
    assert.ok(Number.isFinite(surface.width) && surface.width > 0, `${surface.name}: invalid width`);
    assert.ok(Number.isFinite(surface.height) && surface.height > 0, `${surface.name}: invalid height`);
    const frame = surface.getFrame();
    const values = [...frame.center.toArray(), ...frame.normal.toArray(), surface.width, surface.height];
    assert.ok(values.every(Number.isFinite), `${surface.name}: nonfinite transform`);
    const key = values.map(value => value.toFixed(5)).join(',');
    assert.equal(faces.has(key), false, `${surface.name} duplicates the face of ${faces.get(key)}`);
    faces.set(key, surface.name);
  }
  // Ceramics intentionally overlay their backing. Moving optical lifts and
  // rerouted light sheets use separate live floor records and are not static decks.
  const floors = surfaces.filter(surface => surface.floor && !surface.portal);
  for (let i = 0; i < floors.length; i++) for (let j = i + 1; j < floors.length; j++) {
    const a = floors[i].floor, b = floors[j].floor;
    if (Math.abs(a.y - b.y) > 1e-6) continue;
    const dx = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const dz = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
    assert.ok(dx <= 1e-6 || dz <= 1e-6,
      `${floors[i].name} overlaps ${floors[j].name} by ${dx}×${dz} m at y=${a.y}`);
  }
});

test('room13 return ceramic is hidden from sampled lower and optical-shelf viewpoints by the physical chamber turn', async () => {
  await game.selectLevel(12, false); game.scene.updateMatrixWorld(true);
  const panel = game.firstLevel.panels['receiving-return'], frame = panel.getFrame();
  const acceptedRay = (origin, target) => {
    const ray = game.portalShots.ray;
    ray.set(origin, target.clone().sub(origin).normalize()); ray.near = 0; ray.far = Infinity;
    const hit = game.portalShots.firstHit();
    if (hit?.object !== panel.mesh) return false;
    const normal = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
    return normal.dot(frame.normal) > .15 && ray.ray.direction.dot(frame.normal) < -.02
      && resolvePortalPlacement(panel.mesh, hit.point, {blockers: game.colliders}).ok;
  };
  const targets = [];
  for (const x of [-.99, 0, .99]) for (const y of [-.99, 0, .99]) targets.push(frame.center.clone()
    .addScaledVector(frame.right, x * frame.halfWidth).addScaledVector(frame.up, y * frame.halfHeight));
  const samples = (a, b) => {
    if (b - a < 1.1) return [(a + b) / 2];
    const values = [b - .55]; for (let v = a + .55; v < b - .45; v += 3) values.push(v);
    return [...new Set(values)];
  };
  const free = (x, y, z) => !game.colliders.some(collider => {
    if (!collider.enabled) return false;
    const box = collider.box;
    if (box.max.y < y + .32 || box.min.y > y + 2.39) return false;
    const dx = x - THREE.MathUtils.clamp(x, box.min.x, box.max.x);
    const dz = z - THREE.MathUtils.clamp(z, box.min.z, box.max.z);
    return dx * dx + dz * dz < .43 * .43;
  });
  let rays = 0; const areas = new Set();
  // Bounded adversarial muzzle viewpoints derived from the real lower floors.
  // This negative visibility check is separate from the ordinary win routes.
  for (const surface of game.firstLevel.world.surfaces) {
    const floor = surface.floor;
    if (!floor || surface.portal || floor.y > 6) continue;
    for (const x of samples(floor.minX, floor.maxX)) for (const z of samples(floor.minZ, floor.maxZ)) {
      if (!free(x, floor.y, z)) continue;
      areas.add(surface.name);
      for (const height of [1.4, 3.3]) for (const target of targets) {
        const origin = new THREE.Vector3(x, floor.y + height, z);
        assert.equal(acceptedRay(origin, target), false,
          `Early return ceramic sight from ${surface.name}: ${origin.toArray()} to ${target.toArray()}`);
        rays++;
      }
    }
  }
  for (const name of ['South arrival passage', 'West lower return', 'West optical return']) assert.ok(areas.has(name));
  assert.ok(rays > 1000 && rays < 20000, `The bounded visibility grid ran ${rays} rays`);
  assert.ok(acceptedRay(frame.center.clone().addScaledVector(frame.normal, 1.5), frame.center),
    'The original ceramic remains usable from its actual receiving chamber');
});

// The former eastern-strip and folded-stair tests described the retired14.
// Current recovery attacks are ordinary scenarios in the new journey suite;
// these independent checks retain founded travel, separation and owner cleanup.
test('current14 actual service stairs join the founded observation and return courts under ordinary walking',async()=>{
 await game.selectLevel(13,false);
 const report=await runV8Journey(game,{scenario:async d=>{
  const t=room14InputControls(d);t.north();d.walk(12,5);d.wait(.3);
  assert.ok(game.playerGrounded&&Math.abs(game.playerPosition.y)<.02,'The observation court must have its actual authored support');
  t.west();d.wait(.3);assert.ok(game.playerGrounded&&Math.abs(game.playerPosition.y+.8)<.02,'The same ordinary stairs return to the real lower service floor');
 }});
 assert.equal(report.resets+report.respawns,0);
});

test('current14 independent separation checks reject a hidden gap plank, enlarged optical mouth and disabled glass',async()=>{
 await game.selectLevel(13,false);assertRoom14DeflectorGeometry(game);
 const panel=game.firstLevel.panels['contact-intake'],width=panel.mesh.userData.portalSize.width,glass=game.colliders.find(c=>c.mesh===game.firstLevel.readability.window);
 const poison=[
  [()=>game.floors.push({minX:-.7,maxX:1.8,minZ:-2.4,maxZ:-.8,y:0,enabled:true}),()=>game.floors.pop()],
  [()=>panel.mesh.userData.portalSize.width=.6,()=>panel.mesh.userData.portalSize.width=width],
  [()=>glass.enabled=false,()=>glass.enabled=true],
 ];
 for(const [mutate,restore]of poison){try{mutate();assert.throws(()=>assertRoom14DeflectorGeometry(game),assert.AssertionError);}finally{restore();}}
 assertRoom14DeflectorGeometry(game);
});

test('switching away from current14 removes every light and tilted fixed body/query/CCD owner without resurrection',async()=>{
 for(const nextLevel of [14,12,0]){
  await game.selectLevel(13,false);const level=game.firstLevel,field=level.readability.field;
  for(const [i,name]of ['contact-intake','contact-turn'].entries()){const panel=level.panels[name];assert.equal(game.placeOnPanel(i,panel.mesh,panel.getFrame().center.clone().setY(1.25)),true);}field.update();
  assert.ok(field.segments.length>1);assertRoom14FieldOwnership(game);
  const oldPhysics=game.physics,owned=field.owned.map(p=>({mesh:p.mesh,collider:p.collider,body:p.body}));
  await game.selectLevel(nextLevel,false);
  const counts=[game.colliders.length,game.floors.length,game.cameraBlockers.length,game.aimBlockers.length,game.physics.bodyBoxes.size,game.physics.cargoSweepBoxes.size];
  field.update();
  assert.deepEqual([game.colliders.length,game.floors.length,game.cameraBlockers.length,game.aimBlockers.length,game.physics.bodyBoxes.size,game.physics.cargoSweepBoxes.size],counts);
  for(const {mesh,collider,body}of owned){
   assert.equal(mesh.parent,null);assert.equal(oldPhysics.world.bodies.includes(body),false);assert.equal(oldPhysics.bodyBoxes.has(mesh.uuid),false);assert.equal(oldPhysics.cargoSweepBoxes.has(mesh.uuid),false);assert.equal(game.physics.bodyBoxes.has(mesh.uuid),false);assert.equal(game.physics.cargoSweepBoxes.has(mesh.uuid),false);assert.equal(game.colliders.includes(collider),false);assert.equal(game.cameraBlockers.includes(mesh),false);assert.equal(game.aimBlockers.includes(mesh),false);assert.equal(game.portalPanels.includes(mesh),false);
  }
 }
});
