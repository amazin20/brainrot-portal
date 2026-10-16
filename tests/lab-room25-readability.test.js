import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {ROOM25_INSTRUMENT_COLORS as C} from '../src/game/LabRoom25Readability.js';

function assertOwnedMachineUnchanged(game){
 const level=game.firstLevel,m=level.state.optical.machine;
 assert.equal(m.diagnostics().ownershipValid,true);
 for(const car of [level.state['shadow-lift'],level.state['relay-lift']])assert.equal(car.diagnostics().liveOwnership,true);
 for(const part of [...m.parts,...level.state['shadow-lift'].parts,...level.state['relay-lift'].parts]){
  assert.ok(part.collider.box.equals(new THREE.Box3().setFromObject(part.mesh)));
  assert.equal(game.physics.bodyBoxes.get(part.mesh.uuid).body,part.body);
 }
}

test('Room25 metal finish stays inside real hosts, preserves white ceramic, and adds no physics or shot blockers',async()=>{
 const game=await createHeadlessGame();
 try{
  await game.selectLevel(24,true);const level=game.firstLevel,r=level.room25Readability;
  const world=game.physics.world,bodies=[...world.bodies],colliders=[...game.colliders],aim=[...game.aimBlockers],camera=[...game.cameraBlockers],portals=[...game.portalPanels];
  assert.equal(portals.length,6);assert.equal(r.receiverGlasses.length,2);
  assert.ok(Object.isFrozen(r.targets)&&Object.isFrozen(r.targets.beams));assert.equal(r.targets.beams.length,7);
  assert.ok(r.targets.beams.every(mesh=>mesh.parent===r.targets.beamRoot&&mesh.geometry.type==='CylinderGeometry'));
  assert.equal(r.targets.motorReceiver,level.state.optical.motorLamp.group);assert.equal(r.targets.movingMirror,level.state.optical.movingMirror.mesh);
  for(const surface of [r.freight.surface,...r.passengerDecks.map(deck=>deck.surface)]){
   const metal=surface.group.children.find(node=>node.isInstancedMesh);
   assert.equal(metal.material.color.getHex(),surface===r.freight.surface?C.metal:C.passenger);
   assert.equal(surface.portal,false);assert.equal(surface.mesh.userData.portalable,undefined);
  }
  for(const panel of Object.values(level.panels))panel.group.traverse(node=>{
   if(node.isInstancedMesh&&node.userData.portalTile)assert.equal(node.material,level.world.materials.ceramic);
  });
  for(const mount of r.mounts){
   mount.group.updateWorldMatrix(true,true);mount.host.updateWorldMatrix(true,true);
   const face=new THREE.Box3().setFromObject(mount.group),solid=new THREE.Box3().setFromObject(mount.host);
   assert.ok(solid.expandByScalar(.002).containsBox(face),'Instrument exceeds its existing solid face: '+mount.group.name);
   mount.group.traverse(node=>{if(node.isMesh){assert.equal(colliders.some(c=>c.mesh===node),false);assert.equal(aim.includes(node),false);assert.equal(camera.includes(node),false);assert.equal(portals.includes(node),false);}});
  }
  assert.ok(r.materials.every(material=>!material.transparent&&material.opacity===1&&material.depthTest));
  const m=level.state.optical.machine,step=world.stepnumber,forces=m.diagnostics().forceCount,poses=bodies.map(body=>body.position.toArray().concat(body.quaternion.toArray(),body.velocity.toArray()));
  for(let n=0;n<30;n++){r.update();level.renderUpdate(.5);}
  assert.equal(world.stepnumber,step);assert.equal(m.diagnostics().forceCount,forces);
  assert.deepEqual(world.bodies,bodies);assert.deepEqual(game.colliders,colliders);assert.deepEqual(game.aimBlockers,aim);assert.deepEqual(game.cameraBlockers,camera);assert.deepEqual(game.portalPanels,portals);
  assert.deepEqual(bodies.map(body=>body.position.toArray().concat(body.quaternion.toArray(),body.velocity.toArray())),poses);
  assertOwnedMachineUnchanged(game);
  r.dispose();assert.deepEqual(world.bodies,bodies);assert.deepEqual(game.colliders,colliders);assertOwnedMachineUnchanged(game);
 }finally{game.firstLevel?.dispose?.();game.physics.dispose();game.portals.dispose();}
});

test('Room25 instruments follow actual original load, live optical force, gravity return and restored light without a cosmetic clock',async()=>{
 const game=await createHeadlessGame();
 try{
  await game.selectLevel(24,true);const level=game.firstLevel,r=level.room25Readability,o=level.state.optical,m=o.machine;
  const body=game.physics.cargoBody,shape=body.shapes[0],position=[-7,.9,12];
  // Declared contact fixture: unchanged original body on the actual spring
  // deck. All subsequent movement and ray propagation use production physics.
  game.physics.resetCargo({position});game.cargo.position.fromArray(position);game.companionBehavior?.reanchor(game.cargo.position);
  const step=(count=1)=>{for(let n=0;n<count;n++)game.updatePlaying(1/120);r.update();};
  for(let n=0;n<1800&&o.travel<.86;n++)step();
  assert.equal(m.loaded,true);assert.equal(r.state.loaded,true);assert.equal(r.freight.loadMaterial.color.getHex(),C.load);
  const pair=()=>{for(const [index,name]of [[0,'light-intake'],[1,'lower-relay']]){const panel=level.panels[name];assert.equal(game.portals.placeOnPanel(index,panel.mesh,panel.getFrame().center).ok,true);game.portalSurfaceIds[index]=panel.mesh.uuid;}};
  pair();step(3);assert.equal(o.motorLit,true);assert.equal(r.state.currentLight,true);assert.equal(r.state.enabled,false);assert.equal(r.state.drive,false);
  level.state['counterweight-hoistControl'].action();step(180);
  assert.equal(r.state.enabled,true);assert.equal(r.state.drive,true);assert.ok(m.height>.5);
  for(const ruler of r.rulers)assert.ok(Math.abs(ruler.index.position.y-(m.height-4.5))<1e-9);
  const before=m.height;game.portals.clear();
  for(let n=0;n<120&&!(m.velocity<-.2&&m.height<before);n++)step();
  assert.equal(m.motorEnabled,true);assert.equal(r.state.enabled,true);assert.equal(r.state.currentLight,false);assert.equal(r.state.drive,false);
  assert.equal(m.diagnostics().lastForce.motorForce,0);assert.ok(m.velocity<-.2&&m.height<before);
  pair();step(180);assert.equal(r.state.currentLight,true);assert.equal(r.state.drive,true);assert.ok(m.velocity>.2);
  assert.equal(game.physics.cargoBody,body);assert.equal(body.shapes[0],shape);assertOwnedMachineUnchanged(game);
  for(const mount of r.mounts){mount.group.updateWorldMatrix(true,true);mount.host.updateWorldMatrix(true,true);assert.ok(new THREE.Box3().setFromObject(mount.host).expandByScalar(.002).containsBox(new THREE.Box3().setFromObject(mount.group)));}
 }finally{game.firstLevel?.dispose?.();game.physics.dispose();game.portals.dispose();}
});
