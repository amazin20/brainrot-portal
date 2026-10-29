import * as THREE from 'three';
import { Workshop, Flywheel, V, tracePortalRay } from './LabWorkshopKit.js';
import { airAcceleration } from './LabAirForces.js';
import { LabAirflowVisual } from './LabAirflowVisual.js';
import { cargoLoadsPlate } from './LabPlateContact.js';
import { terminalAccessible } from './LabPuzzleMechanics.js';
import { WindClutchDrive, windDoorParameter } from './LabWindClutchDrive.js';

/** Room 11 only. Existing source meshes, air tracing and door are retained.
 * A mechanically exclusive input/output clutch exposes stored rotation.
 * User's model roles: round model 31 is the blower; louvred model 35 is
 * the receiving drive. Only the blower's front impeller rotates. */
export function generatorSkin(game) {
  const source = game.model(31, 1);
  source.updateWorldMatrix(true, true);
  const art = new THREE.Group(); art.userData.assetId = 31;
  const fixed = new THREE.Group(); fixed.name = 'Frame'; art.add(fixed);
  const rotor = new THREE.Group(); rotor.name = 'Moving';
  rotor.position.set(-.00096, .39807, .432875); art.add(rotor);
  let sourceTriangles = 0, movingTriangles = 0;
  source.traverse(node => {
    if (!node.isMesh) return;
    const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
    const p = geometry.attributes.position, idx = geometry.index;
    const still = [], moving = [];
    for (let i = 0; i < idx.count; i += 3) {
      const ids = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)];
      const center = ids.reduce((v, j) => v.add(new THREE.Vector3().fromBufferAttribute(p, j)), V()).multiplyScalar(1 / 3);
      // Native unit-size model: front impeller is +Z. Housing/stand and
      // the sealed -Z motor cap remain fixed. No triangles are dropped.
      const radius = Math.hypot(center.x + .00096, center.y - .39807);
      const color = geometry.attributes.color;
      const paint = color ? ids.reduce((sum, j) => sum + .2126 * color.getX(j) + .7152 * color.getY(j) + .0722 * color.getZ(j), 0) / 3 : 0;
      // The white intake rim meets blade tips in the same mesh. Keep its
      // painted faces fixed; rotating the whole radial slice tears that rim.
      const spins = center.z > .20 && radius < .275 && (radius < .14 || paint < .18);
      (spins ? moving : still).push(...ids); sourceTriangles++;
    }
    for (const [indices, parent] of [[still, fixed], [moving, rotor]]) {
      if (!indices.length) continue;
      const piece = geometry.clone(); piece.setIndex(indices);
      if (parent === rotor) piece.translate(-rotor.position.x, -rotor.position.y, -rotor.position.z);
      piece.computeBoundingBox(); piece.computeBoundingSphere();
      const mesh = new THREE.Mesh(piece, node.material); mesh.receiveShadow = true; parent.add(mesh);
    }
    movingTriangles += moving.length / 3; geometry.dispose();
  });
  art.userData.partition = { sourceTriangles, movingTriangles };
  return { id: 31, art, pivot: rotor, fixed, spin: angle => { rotor.rotation.z = angle; } };
}

/** A receiver admits only air reaching its FRONT disc; passing behind the
 * machine or hitting its housing is not interchangeable with driving it. */
export function receivesFrontAir(segments, inlet, normal, radius) {
  return segments.some(s => {
    const den = s.direction.dot(normal);
    if (den >= -.5) return false;
    const distance = inlet.clone().sub(s.a).dot(normal) / den;
    if (distance < 0 || distance > s.length + .025) return false;
    return s.a.clone().addScaledVector(s.direction, distance).distanceTo(inlet) < radius;
  });
}

export function buildReadableWindRoom(game, spec) {
  const k = new Workshop(game, spec, 10), w = k.world;
  const bounds = { minX: -14, maxX: 14, minZ: -19, maxZ: 15 };
  k.shell(bounds, 9);
  w.materials.wall.color.setHex(0x3b4750);
  w.materials.floor.color.setHex(0x56616a);
  w.materials.trim.color.setHex(0x25303a);
  w.materials.ceramic.emissiveIntensity = .10;

  // Flush wall-mounted areas, no duplicate coplanar panels or opaque billboard
  // in the middle of the room. All stop BEFORE the locked doorway partition.
  k.panel('work-front', [0, 2.3, 14.975], [0, 0, -1], 27);
  k.panel('work-left', [-13.975, 2.3, 2], [1, 0, 0], 23);
  k.panel('work-right', [13.975, 2.3, 12], [-1, 0, 0], 5);
  k.panel('wind-intake', [13.975, 2.1, 4], [-1, 0, 0], 9);
  k.panel('wind-outlet', [13.975, 2.1, -5], [-1, 0, 0], 8);

  // Requested role swap: the round impeller model PRODUCES the air.
  // Keep its proven front-only partition, grounded feet and fixed painted rim.
  const blowerArt = generatorSkin(game);
  blowerArt.art.scale.setScalar(5.27596);
  blowerArt.art.rotation.y = Math.PI / 2;
  blowerArt.art.position.set(-8.3, 0, 4);
  blowerArt.art.userData.gameplayRole = 'Fan: emits air through its rotating front impeller';
  w.root.add(blowerArt.art); k.fixtures.push(blowerArt);
  const blowerBox = new THREE.Box3().setFromObject(blowerArt.art);
  game.collisionProxy(blowerBox);
  const origin = V(blowerBox.max.x + .04, 2.1, 4);
  const fan = { art: blowerArt, origin, direction: V(1, 0, 0), enabled: false, segments: [], rotorSpeed: 0, angle: 0 };
  k.state.blower = fan;

  // The louvred model RECEIVES the stream and drives the existing door.
  // Its grille and fixed housing are not a propeller; never spin the whole model.
  const turbineArt = k.staticFixture(35, [-5.4, 0, -5], 3.3, Math.PI / 2);
  turbineArt.art.userData.gameplayRole = 'Drive: receives airflow at the front grille and powers the door';
  const turbineBox = new THREE.Box3().setFromObject(turbineArt.art);
  const housing = game.colliders.at(-1);
  const inlet = V(turbineBox.max.x + .025, 2.1, -5);
  // Low-loss bearings leave time to walk, inspect the fork and collect the
  // companion. This changes this rotor only, not other campaign flywheels.
  const wheel = new Flywheel({ drag: .06 });
  const turbine = { art: turbineArt, wheel, position: inlet, normal: V(1, 0, 0), power: false, clutch: false, housing };
  k.state.flywheel = turbine;

  // A fixed, enclosed service bus belongs to the blower and exit drive.
  // It is outside both routed air paths and above every low portal mouth;
  // all four manufactured bodies are real solids, not floating decals.
  for(const [p,size]of [
    [[-11.6,6.55,-3.7],[.42,.42,15.4]],
    [[-11.6,4.325,4],[.24,4.45,.24]],
    [[-11.6,3.275,-11.4],[.24,6.55,.24]],
    [[-11.24,2.1,4],[.72,.24,.24]],
  ]){
    const bus=w.box(p,size,w.materials.trim);bus.name='Wind test service bus / closed power casing';bus.userData.earlyAuditBus=true;
  }

  // The original companion can turn the receiving grille toward a second
  // physical air path. Its load rests on the actual floor; the turntable and
  // receiver housing rotate together and keep one synchronized collision box.
  const plateFrame = { center: V(-5.2, 0, -1.4), normal: V(0, 1, 0),
    right: V(1, 0, 0), up: V(0, 0, 1), halfWidth: 1.25, halfHeight: 1.25 };
  const plateMaterial = new THREE.MeshStandardMaterial({ color: 0x9d8269, roughness: .55, metalness: .22 });
  const plate = w.box([-5.2, .012, -1.4], [2.5, .024, 2.5], plateMaterial, false);
  const driveTurn = { plate, angle: 0, loaded: () => cargoLoadsPlate(game.cargo, game.heldCube, plateFrame) };
  k.state.driveTurn = driveTurn;
  housing.kinematic = true;
  k.ticks.push(dt => {
    const target = driveTurn.loaded() ? Math.PI : 0;
    driveTurn.angle = THREE.MathUtils.damp(driveTurn.angle, target, 5, dt);
    turbineArt.art.rotation.y = Math.PI / 2 + driveTurn.angle;
    turbineArt.art.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(turbineArt.art);
    game.syncCollision(housing, bounds, dt);
    const reversed = driveTurn.angle > Math.PI / 2;
    inlet.set(reversed ? bounds.min.x - .025 : bounds.max.x + .025, 2.1, -5);
    turbine.normal.set(reversed ? -1 : 1, 0, 0);
    plateMaterial.color.setHex(driveTurn.loaded() ? 0x78d4bc : 0x9d8269);
  });
  k.wire([[-5.2,.052,-1.4],[-5.2,.052,-3.2],[-5.2,.052,-4.3]],() => driveTurn.loaded());

  // The existing swinging leaves now belong to a finite-work transmission.
  // Its pawl holds partial angles; live power cannot be connected to output.
  const door = k.door(-12);
  const pawl = w.box([-2.65, 1.7, -11.63], [.6, .2, .7], w.materials.accent, false);
  const outputDrive = new WindClutchDrive(wheel); k.state.outputDrive = outputDrive;
  const ratchet = { get engaged() { return outputDrive.stroke === 1; }, get progress() { return outputDrive.stroke; } };
  k.state.ratchet = ratchet;
  const fanControl = k.control('fan-switch', [-4.7, 0, 6], () => { fan.enabled = !fan.enabled; }, 'E — включить вентилятор.');
  const solid = (name, position, size, material = w.materials.trim) => {
    const mesh = w.box(position, size, material); mesh.name = 'Wind clutch / ' + name;
    mesh.userData.firstChapterStructuralRole = 'wind-clutch';
    return mesh;
  };
  const detail = (name, position, size, material = w.materials.trim, parent = w.root) => {
    const mesh = game.box(...position, ...size, material, { parent, camera: false, aim: false });
    mesh.name = 'Wind clutch / ' + name; mesh.userData.firstChapterStructuralRole = 'wind-clutch'; return mesh;
  };
  // This shroud is a physical enclosure, not an interaction-state permission.
  // Fixed sides/back/roof prevent reaching the fork from another direction.
  solid('left enclosure', [-3.70, 1.1, -8], [.15, 2.2, 1.65]);
  solid('right enclosure', [-1.60, 1.1, -8], [.15, 2.2, 1.65]);
  solid('rear enclosure', [-2.65, 1.1, -8.75], [1.95, 2.2, .15]);
  solid('enclosure roof', [-2.65, 2.2, -8.075], [2.25, .16, 1.35]);
  for (const [side, x] of [['left', -3.70], ['right', -1.60]])
    solid('guide rail ' + side, [x, 2.2, -7.25], [.10, 4.4, .20]);
  const coverMesh = solid('spring-return air shroud', [-2.65, 3.25, -7.25], [1.95, 2.1, .15], w.materials.floor);
  const coverCollider = game.colliders.find(c => c.mesh === coverMesh); coverCollider.kinematic = true;
  const leverSweepBox = new THREE.Box3(V(-2.92, .70, -7.50), V(-2.38, 1.65, -7.12));
  outputDrive.cover.mesh = coverMesh; outputDrive.cover.collider = coverCollider;
  outputDrive.leverSweepBox = leverSweepBox;
  const clutchControl = k.control('drive-clutch', [-2.65, 0, -8], () => {
    // The same physical hand ray guards direct calls as ordinary E input.
    if (!terminalAccessible(game, clutchControl) || coverCollider.box.intersectsBox(leverSweepBox)) return;
    outputDrive.toggleClutch(); turbine.clutch = outputDrive.clutch;
  }, 'E — подключить маховик к створкам.');
  clutchControl.collider.mesh.name = 'Wind clutch / command body';
  const fork = detail('coupling fork', [-2.65, 1.30, -7.50], [.50, .09, .54], w.materials.accent);
  const springs = [];
  for (const x of [-3.70, -1.60]) {
    const points = Array.from({ length: 145 }, (_, i) => {
      const t = i / 144, angle = t * 18 * Math.PI;
      return V(.10 * Math.cos(angle), t, .10 * Math.sin(angle));
    });
    const spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 144, .015, 5, false), w.materials.accent);
    spring.name = 'Wind clutch / return spring'; spring.position.set(x, 3.25, -7.25); w.root.add(spring); springs.push(spring);
  }
  // A visible shaft and external flywheel explain retained motion without
  // spinning the receiving GLB's louvres or adding an energy progress stick.
  solid('shaft casing', [-5.4, .18, -7.55], [.30, .36, 2.52]);
  solid('flywheel pedestal', [-5.4, .34, -8.8], [1.40, .68, .62]);
  solid('output shaft casing', [-3.98, .18, -8.8], [2.54, .36, .30]);
  const rotor = new THREE.Group(); rotor.name = 'Wind clutch / stored-motion rotor'; rotor.position.set(-5.4, 1.35, -8.8); w.root.add(rotor);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.63, .09, 8, 32), w.materials.floor); rim.name = 'Wind clutch / flywheel rim'; rotor.add(rim);
  for (let i = 0; i < 4; i++) { const spoke = detail('flywheel spoke ' + i, [0, 0, 0], [1.17, .09, .10], w.materials.accent, rotor); spoke.rotation.z = i * Math.PI / 4; }
  detail('flywheel hub', [0, 0, 0], [.24, .24, .30], w.materials.trim, rotor);
  const rotorCollider = game.collisionProxy(new THREE.Box3(V(-6.12, .63, -8.98), V(-4.68, 2.07, -8.62)));
  rotorCollider.mesh.name = 'Wind clutch / flywheel swept body';
  // The input collar lies within the existing receiver housing and rotates
  // with its turntable. Closing its visible vanes isolates the rotor from
  // upstream pressure before the output dog can transmit any work.
  const collar = new THREE.Group(); collar.name = 'Wind clutch / inlet collar'; w.root.add(collar);
  const vanes = [];
  for (let i = 0; i < 5; i++) vanes.push(detail('inlet vane ' + i, [0, (i - 2) * .28, 0], [1.40, .25, .045], w.materials.accent, collar));
  outputDrive.rotor = rotor; outputDrive.collar = collar; outputDrive.fork = fork;
  const syncDriveGeometry = dt => {
    coverMesh.position.y = 1.05 + outputDrive.cover.opening;
    coverMesh.updateWorldMatrix(true, true);
    game.syncCollision(coverCollider, new THREE.Box3().setFromObject(coverMesh), dt);
    collar.position.copy(inlet).addScaledVector(turbine.normal, -.03);
    collar.quaternion.setFromUnitVectors(V(0, 0, 1), turbine.normal);
    for (const vane of vanes) vane.rotation.x = outputDrive.clutch ? 0 : Math.PI / 2;
    fork.rotation.x = outputDrive.clutch ? 0 : Math.PI / 2;
    for (const spring of springs) { spring.position.y = 1.05 + outputDrive.cover.opening; spring.scale.y = 4.35 - spring.position.y; }
    door.previous = windDoorParameter(outputDrive.previousStroke);
    door.progress = windDoorParameter(outputDrive.stroke); door.open = outputDrive.stroke === 1;
    door.mechanism.update(door.progress, k.time);
    door.mechanism.getLeafBoxes().forEach((box, i) => game.syncCollision(door.colliders[i], box, dt));
  };
  // No boolean or doorway occupancy may manufacture the remaining stroke.
  door.update = (_open, dt) => syncDriveGeometry(dt);
  door.render = alpha => door.mechanism.update(windDoorParameter(THREE.MathUtils.lerp(outputDrive.previousStroke, outputDrive.stroke, alpha)), k.time);
  // A single grounded, continuous existing cable route, not a floating wire.
  k.wire([[turbineBox.min.x - .02, .065, -5], [turbineBox.min.x - .02, .065, -9], [-2.65, .065, -9], [-2.65, .065, -11.4], [-2.65, 1.7, -11.4]], () => turbine.power);

  // Soft, path-advected wisps replace opaque dots. They share the exact traced
  // blockers/portal mapping and a physical-time clock; no extra physics/labels.
  const airflow = new LabAirflowVisual(w.root, { radius: 1.35, speed: 7.2 });
  const dust = airflow.mesh; // retained diagnostics alias; no sphere instances
  let previousAngle = 0, previousPawl = 0, previousWheelAngle = 0;
  const lights = [];
  door.art.traverse(o => { if (o.isMesh && o.material.isMeshBasicMaterial) lights.push(o); });
  k.ticks.push(dt => {
    previousAngle = fan.angle; previousPawl = ratchet.progress; previousWheelAngle = wheel.angle;
    const target = fan.enabled ? 12 : 0, rate = fan.enabled ? 3.5 : 2.7, old = fan.rotorSpeed;
    fan.rotorSpeed = THREE.MathUtils.damp(old, target, rate, dt);
    fan.angle += target * dt + (old - target) * (1 - Math.exp(-rate * dt)) / rate;
    const strength = fan.rotorSpeed / 12;
    fan.segments = strength > .005 ? tracePortalRay(game, origin, fan.direction, { medium: 'air', length: 80 }) : [];
    airflow.step(dt, strength); airflow.setPath(fan.segments, game.portals?.portals || []);
    const ready = Math.min(driveTurn.angle, Math.PI - driveTurn.angle) < .04;
    turbine.power = ready && receivesFrontAir(fan.segments, inlet, turbine.normal, 1.0);
    outputDrive.step(turbine.power ? strength : 0, dt);
    turbine.clutch = outputDrive.clutch;
    syncDriveGeometry(dt);
    rotor.rotation.z = wheel.angle;
    fanControl.lesson = fan.enabled ? 'E — выключить вентилятор.' : 'E — включить вентилятор.';
    clutchControl.lesson = outputDrive.clutch ? 'E — отсоединить маховик от створок.' : 'E — подключить маховик к створкам.';
  });
  k.renders.push(alpha => {
    blowerArt.spin(THREE.MathUtils.lerp(previousAngle, fan.angle, alpha));
    rotor.rotation.z = THREE.MathUtils.lerp(previousWheelAngle, wheel.angle, alpha);
    pawl.rotation.z = -.6 * THREE.MathUtils.lerp(previousPawl, ratchet.progress, alpha);
    for (const light of lights) light.material.color.setHex(ratchet.engaged ? 0x82d6c1 : 0xd4a254);
    airflow.render(alpha, game.quality?.shadows === false ? 'low' : 'balanced');
  });
  k.resets.push(() => {
    fan.enabled = false;fan.touchingFriend=false; fan.segments = []; turbine.power = false; turbine.clutch = false; outputDrive.reset();
    previousPawl = previousAngle = previousWheelAngle = 0;
    driveTurn.angle = 0; turbineArt.art.rotation.y = Math.PI / 2;
    turbineArt.art.updateWorldMatrix(true, true);
    game.syncCollision(housing, new THREE.Box3().setFromObject(turbineArt.art), 0);
    inlet.set(new THREE.Box3().setFromObject(turbineArt.art).max.x + .025, 2.1, -5);
    turbine.normal.set(1, 0, 0); plateMaterial.color.setHex(0x9d8269);
    fan.rotorSpeed = fan.angle = 0; blowerArt.spin(0); pawl.rotation.z = 0; airflow.reset();
    rotor.rotation.z = 0; syncDriveGeometry(0);
  });
  const level = k.finish([-1, 0, 8], [1.5, .55, 7.5], [0, 0, -16], { workshop: k, readability: { inlet, housing, dust, airflow, pawl, fanControl, clutchControl, coverMesh, rotor, collar } });
  level.hints = [
    'Вращение маховика и ход створок разделены муфтой. Поток прижимает кожух к её рукояти.',
    'У маховика остаётся вращение после прекращения подачи. Друг на пластине поворачивает приёмник к другой стене.',
    'Раскрути маховик, прекрати поток и подключи муфту, когда пружина отведёт кожух. Слабого разгона хватит лишь на часть хода; можно зарядить снова.',
  ];
  // Context comes from the nearby existing control, not instructions painted
  // on the wall or a central overlay. No solution markers or forced ordering.
  level.getContextLesson = () => {
    const action = level.nearbyInteraction();
    return action ? ['room11-' + action.kind, 'E', action.text.replace(/^E — /, ''), false] : null;
  };
  const forceAt=(point,velocity,bodyRadius)=>airAcceleration(fan.segments,point,velocity,{strength:fan.rotorSpeed/12,radius:1.35,bodyRadius});
  level.playerAcceleration=(point,velocity)=>forceAt(point.clone().add(V(0,1.25,0)),velocity,.5);
  k.forces.push(()=>{
    if(game.heldCube)return;
    const body=game.physics.cargoBody, force=forceAt(game.cargo.position,game.cargo.velocity,.55);
    if(force.lengthSq()>1e-5){
      // Walking control must not oppose the air or keep the box friction-locked.
      body.material.friction=.06;
      if(!fan.touchingFriend)game.companionAnimator?.trigger('startle');fan.touchingFriend=true;
      body.force.x+=force.x*body.mass;body.force.y+=force.y*body.mass;body.force.z+=force.z*body.mass;body.wakeUp();
    }else fan.touchingFriend=false;
  });
  level.reset(); return level;
}
