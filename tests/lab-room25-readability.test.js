import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {ROOM25_INSTRUMENT_COLORS as C} from '../src/game/LabRoom25Readability.js';
import {runRoom25NormalPlay} from './helpers/lab-room25-normal-play-driver.js';
import {runRoom25} from '../src/game/LabRoom25Journey.js';
import {createReadabilityObserver} from '../scripts/lib/v58-readability-observer.mjs';
import {assertVisibleRole} from '../scripts/lib/v58-readability-proof.mjs';

function firstPaintHit(scene,paint,objects){
 scene.updateMatrixWorld(true);const point=paint.localToWorld(new THREE.Vector3()),normal=new THREE.Vector3(0,0,1).transformDirection(paint.matrixWorld);
 return new THREE.Raycaster(point.clone().addScaledVector(normal,.02),normal.negate(),0,.03).intersectObjects(objects,false)[0]?.object;
}

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
   assert.ok(solid.expandByScalar(.001).containsBox(face),'Instrument exceeds its one-millimetre paint skin: '+mount.group.name);
   mount.group.traverse(node=>{if(node.isMesh){assert.equal(colliders.some(c=>c.mesh===node),false);assert.equal(aim.includes(node),false);assert.equal(camera.includes(node),false);assert.equal(portals.includes(node),false);}});
  }
  assert.ok(r.materials.every(material=>!material.transparent&&material.opacity===1&&material.depthTest));
  const crossarm=level.state.optical.machine.parts.find(part=>part.mesh.name==='Room25 travelling optical crossarm');
  const motorStrip=r.targets.drive.find(mesh=>mesh.name==='Actual optical motor drive');
  assert.equal(firstPaintHit(game.scene,motorStrip,[motorStrip,crossarm.mesh]),motorStrip,'The winding must be on the visible outside of the opaque crossarm');
  const mast=level.state.optical.machine.parts.find(part=>part.mesh.name==='Room25 travelling optical mast');
  const mastWindings=r.targets.drive.filter(mesh=>mesh.name==='Actual mast motor winding');assert.equal(mastWindings.length,2);
  for(const winding of mastWindings)assert.equal(firstPaintHit(game.scene,winding,[winding,mast.mesh]),winding,'Both conductor inlays must face out of the actual opaque mast');
  for(const ruler of r.rulers){
   const host=r.mounts.find(mount=>mount.group===ruler.marks).host;
   assert.equal(firstPaintHit(game.scene,ruler.index,[ruler.index,host]),ruler.index,'The rail index must be outside the opaque rail face');
  }
  const consoleHost=r.mounts.find(mount=>mount.group===r.consoleFace).host;
  for(const cell of [r.targets.switch[0],r.targets.currentLight.at(-1),r.targets.drive.find(mesh=>mesh.name==='Actual drive cell')])assert.equal(firstPaintHit(game.scene,cell,[cell,consoleHost]),cell,'Console glass must face out of its actual opaque host');
  assert.equal(r.targets.drive.includes(level.state.optical.motorLamp.lens),true,'The actual motor receiver lens is a readable force indicator');
  const m=level.state.optical.machine,step=world.stepnumber,forces=m.diagnostics().forceCount,poses=bodies.map(body=>body.position.toArray().concat(body.quaternion.toArray(),body.velocity.toArray()));
  for(let n=0;n<30;n++){r.update();level.renderUpdate(.5);}
  assert.equal(world.stepnumber,step);assert.equal(m.diagnostics().forceCount,forces);
  assert.deepEqual(world.bodies,bodies);assert.deepEqual(game.colliders,colliders);assert.deepEqual(game.aimBlockers,aim);assert.deepEqual(game.cameraBlockers,camera);assert.deepEqual(game.portalPanels,portals);
  assert.deepEqual(bodies.map(body=>body.position.toArray().concat(body.quaternion.toArray(),body.velocity.toArray())),poses);
  assertOwnedMachineUnchanged(game);
  r.dispose();assert.deepEqual(world.bodies,bodies);assert.deepEqual(game.colliders,colliders);assertOwnedMachineUnchanged(game);
 }finally{game.firstLevel?.dispose?.();game.physics.dispose();game.portals.dispose();}
});

test('Room25 instruments follow actual original load, optical force, gravity return and relight while founded references stay fixed',async()=>{
 const game=await createHeadlessGame();
 try{
  await game.selectLevel(24,true);const level=game.firstLevel,r=level.room25Readability,o=level.state.optical,m=o.machine;
  const body=game.physics.cargoBody,shape=body.shapes[0],position=[-7,.9,12];
  // These are the exact real founded meshes selected by the native recorder,
  // not the height readout or the sliding height indices painted beside them.
  const rails=m.parts.filter(part=>part.mesh.name==='Room25 founded freight rail');assert.equal(rails.length,2);
  for(const part of rails){assert.equal(part.kind,'fixed');assert.equal(part.body,m.fixedBody);assert.equal(game.scene.getObjectById(part.mesh.id),part.mesh);assert.equal(r.targets.height.includes(part.mesh),false);}
  const railWorld=()=>rails.map(part=>{part.mesh.updateWorldMatrix(true,false);return{matrix:[...part.mesh.matrixWorld.elements],bounds:part.collider.box.min.toArray().concat(part.collider.box.max.toArray()),body:part.body.id,shape:part.body.shapes[part.shapeIndex].id};});
  const fixed=railWorld(),initialIndexY=r.targets.height[0].position.y;
  assert.deepEqual(rails[0].mesh.getWorldPosition(new THREE.Vector3()).toArray(),[-9.75,4.5,12.55]);
  const fixedReference=()=>assert.deepEqual(railWorld(),fixed,'Actual founded rail geometry, bounds, body and shape remain the stationary world reference');
  // Declared contact fixture: unchanged original body on the actual spring
  // deck. All subsequent movement and ray propagation use production physics.
  game.physics.resetCargo({position});game.cargo.position.fromArray(position);game.companionBehavior?.reanchor(game.cargo.position);
  const step=(count=1)=>{for(let n=0;n<count;n++)game.updatePlaying(1/120);r.update();};
  for(let n=0;n<1800&&o.travel<.86;n++)step();
  fixedReference();
  assert.equal(m.loaded,true);assert.equal(r.state.loaded,true);assert.equal(r.freight.loadMaterial.color.getHex(),C.load);
  const pair=()=>{for(const [index,name]of [[0,'light-intake'],[1,'lower-relay']]){const panel=level.panels[name];assert.equal(game.portals.placeOnPanel(index,panel.mesh,panel.getFrame().center).ok,true);game.portalSurfaceIds[index]=panel.mesh.uuid;}};
  pair();step(3);assert.equal(o.motorLit,true);assert.equal(r.state.currentLight,true);assert.equal(r.state.enabled,false);assert.equal(r.state.drive,false);
  level.state['counterweight-hoistControl'].action();step(180);
  assert.equal(r.state.enabled,true);assert.equal(r.state.drive,true);assert.ok(m.height>.5);
  fixedReference();assert.ok(r.targets.height[0].position.y>initialIndexY+.01,'The measured height readout moves independently of the fixed reference');
  for(const ruler of r.rulers)assert.ok(Math.abs(ruler.index.position.y-(m.height-4.5))<1e-9);
  const before=m.height;game.portals.clear();
  for(let n=0;n<120&&!(m.velocity<-.2&&m.height<before);n++)step();
  assert.equal(m.motorEnabled,true);assert.equal(r.state.enabled,true);assert.equal(r.state.currentLight,false);assert.equal(r.state.drive,false);
  assert.equal(m.diagnostics().lastForce.motorForce,0);assert.ok(m.velocity<-.2&&m.height<before);
  fixedReference();
  pair();step(180);assert.equal(r.state.currentLight,true);assert.equal(r.state.drive,true);assert.ok(m.velocity>.2);
  fixedReference();
  assert.equal(game.physics.cargoBody,body);assert.equal(body.shapes[0],shape);assertOwnedMachineUnchanged(game);
  for(const mount of r.mounts){mount.group.updateWorldMatrix(true,true);mount.host.updateWorldMatrix(true,true);assert.ok(new THREE.Box3().setFromObject(mount.host).expandByScalar(.001).containsBox(new THREE.Box3().setFromObject(mount.group)));}
 }finally{game.firstLevel?.dispose?.();game.physics.dispose();game.portals.dispose();}
});

test('ordinary upper-arm and relight floor viewpoints see actual motor-force paint before opaque machinery with separated pixel witnesses',async t=>{
 const game=await createHeadlessGame(),stop=Symbol('upper-arm inspected');let inspected=false;
 try{
  await game.selectLevel(24,true);
  await runRoom25NormalPlay(game,{scenario:async d=>{
   try{await runRoom25({...d,mark(name){
    d.mark(name);if(name!=='permanent gallery keeps height after losing light')return;
    d.walk(-14,-13);d.walk(-14,-10);d.walk(-7,-10);d.walk(-7,7.9);d.look(d.level.state.optical.movingMirror.position.clone());
    const r=d.level.room25Readability;r.update();assert.equal(r.state.drive,true);assert.equal(game.playerGrounded,true);assert.ok(Math.abs(game.playerPosition.y-9)<.02);
    // This CPU regression uses the real ordinary stance, camera, opaque
    // scene and authored triangles. It is not a native canvas/video claim.
    game.renderer={domElement:{width:960,height:540},info:{render:{frame:1}}};
    const observer=createReadabilityObserver(THREE,game,{roles:[{role:'current-drive',roots:r.targets.drive}]});
    let inspection=0;
    const observe=phase=>{
     r.update();game.scene.updateMatrixWorld(true);game.camera.updateMatrixWorld(true);game.scene.traverse(node=>node.skeleton?.update());
     game.renderer.info.render.frame=inspection+1;
     const result=observer.observe({encodedFrame:inspection,visualFrame:inspection++,worldStep:game.physics.world.stepnumber}),role=result.roles[0];
     try{assertVisibleRole(role);}catch(error){const ids=new Set(role.samples.map(s=>s.firstHit?.meshUUID)),names={};game.scene.traverse(node=>{if(ids.has(node.uuid))names[node.uuid]=node.name||node.geometry.type;});error.message+=' '+JSON.stringify({phase,eye:game.camera.position.toArray(),names,visibility:role});throw error;}
     t.diagnostic(JSON.stringify({phase,bbox:role.bboxPixels,footprint:role.projectedFootprintPixelsEstimate,firstHit:role.firstHitTargetSamples,samples:role.projectedSamples}));
     assert.equal(result.readPurity.unchanged,true);assertOwnedMachineUnchanged(game);
    };
    observe('upper-arm lit');
    // The same ordinary traveller clears the pair, steps off the real arm,
    // lands on the lower floor and fires both portals from reachable poses.
    d.look(d.level.state.optical.movingMirror.position.clone().add(new THREE.Vector3(0,-2.6,0)));
    assert.equal(game.clearPortals(),true);d.wait(2);
    d.walk(-3,7.9);d.wait(1);assert.equal(game.playerGrounded,true);assert.ok(game.playerPosition.y<.1);
    d.walk(-3,6);d.walk(17,6);d.walk(17,12);
    const source=d.level.panels['light-intake'].getFrame().center;
    d.aim(0,source);d.aim(0,source.clone().add(source.clone().sub(game.portals.portals[0].position)));
    d.walk(17,6);d.walk(-12,6);d.walk(-11.8,7.9);
    d.aim(1,d.level.panels['lower-relay'].getFrame().center);d.look(d.level.state.optical.movingMirror.position.clone());
    r.update();assert.equal(r.state.drive,true);assert.ok(game.playerPosition.y<.1);observe('floor relight');
    const restoredHeight=r.state.height;d.wait(2);r.update();assert.equal(r.state.drive,true);assert.ok(r.state.height>restoredHeight+.1);observe('floor actual ascent');
    inspected=true;throw stop;
   }});}catch(error){if(error!==stop)throw error;}
  }});
  assert.equal(inspected,true);
 }finally{game.firstLevel?.dispose?.();game.physics.dispose();game.portals.dispose();}
});
