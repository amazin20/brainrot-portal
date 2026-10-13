import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabCamera} from '../src/game/LabCamera.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

const V=(...p)=>new THREE.Vector3(...p);

test('prospective cap sweep rejects a narrow-lens escape without writing the actual lens',()=>{
  // Pure collision fixture for the actual1380 late-widening failure. These
  // explicit geometric poses establish the volume check, not an input route.
  const camera=new THREE.PerspectiveCamera(117.65133620414372,16/9,.1,380);
  const wall=new THREE.Mesh(new THREE.BoxGeometry(.2,2,.5),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  wall.position.set(.525,1.32,5);wall.updateMatrixWorld(true);
  const rig=new LabCamera({camera,blockers:[wall]}),pivot=V(0,1.32,0),requested=V(0,1.32,10);
  const fov=camera.fov,projection=camera.projectionMatrix.toArray(),eye=camera.position.toArray(),q=camera.quaternion.toArray();
  const current=requested.clone();assert.equal(rig.constrain(pivot,current),false);assert.ok(current.equals(requested));
  const prospective=requested.clone();assert.equal(rig.constrain(pivot,prospective,120),true);assert.ok(prospective.distanceTo(requested)>1);
  assert.equal(camera.fov,fov);assert.deepEqual(camera.projectionMatrix.toArray(),projection);
  assert.deepEqual(camera.position.toArray(),eye);assert.deepEqual(camera.quaternion.toArray(),q);
  wall.geometry.dispose();wall.material.dispose();
});

test('private current camera queries remove a stale closed footprint while retaining the actual leaf and other walls',()=>{
  // Explicit geometric fixture for the diagnosed stale proxy. It is not an
  // ordinary input route, animation sample or native visibility acceptance.
  const source=new THREE.Mesh(new THREE.BoxGeometry(8.5,6.5,.65),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  source.position.set(0,3.27,.85);source.visible=false;source.userData.collisionProxy=true;source.updateMatrixWorld(true);
  const blockers=[source],camera=new THREE.PerspectiveCamera(120,16/9,.1,380),pivot=V(1.550462259632848,1.32,.779120216257171);
  const original={position:source.position.toArray(),quaternion:source.quaternion.toArray(),scale:source.scale.toArray(),geometry:source.geometry};
  const descriptor={half:V(4.25,3.25,.325),current:{center:V(-7.2,3.27,.85),quaternion:new THREE.Quaternion()}};
  const hits=[];
  const rig=new LabCamera({camera,blockers,currentBlocker:object=>object===source?descriptor:null,
    isBlocker:(object,hit)=>{hits.push({source:object===source,point:hit.point.toArray()});return true;}});
  const requested=pivot.clone().add(V(0,0,6)),stale=requested.clone();
  assert.equal(rig.constrain(pivot,stale),true);assert.ok(stale.distanceTo(pivot)<1e-8);
  rig.configureSilhouette({enabled:true,confined:true,foundation20:true});rig.updateCurrentBlockers();
  const current=requested.clone();assert.equal(rig.constrain(pivot,current),false);assert.ok(current.equals(requested));
  const towardActualLeaf=descriptor.current.center.clone();hits.length=0;
  assert.equal(rig.constrain(pivot,towardActualLeaf),true);assert.ok(towardActualLeaf.distanceTo(descriptor.current.center)>1);
  assert.ok(hits.length>0&&hits.every(hit=>hit.source),'Original portal/enabled predicate must receive the registered source object');
  assert.equal(rig.blockers,blockers);assert.equal(blockers[0],source);
  const derived=rig.queryBlockers[0];assert.notEqual(derived,source);assert.equal(derived.parent,null);
  assert.deepEqual(source.position.toArray(),original.position);assert.deepEqual(source.quaternion.toArray(),original.quaternion);
  assert.deepEqual(source.scale.toArray(),original.scale);assert.equal(source.geometry,original.geometry);
  const wall=new THREE.Mesh(new THREE.BoxGeometry(2,4,.5),source.material);wall.position.set(pivot.x,1.32,5);wall.updateMatrixWorld(true);blockers.push(wall);
  rig.updateCurrentBlockers();assert.equal(rig.queryBlockers[1],wall);
  const blockedByWall=requested.clone();assert.equal(rig.constrain(pivot,blockedByWall),true);assert.ok(blockedByWall.distanceTo(requested)>1);
  blockers.pop();rig.configureSilhouette({enabled:true,confined:true});rig.updateCurrentBlockers();
  assert.equal(rig.foundation20Framing,false);assert.equal(rig.queryBlockers,blockers);
  const restored=requested.clone();assert.equal(rig.constrain(pivot,restored),true);assert.ok(restored.distanceTo(pivot)<1e-8);
  source.geometry.dispose();source.material.dispose();wall.geometry.dispose();derived.geometry.dispose();
});

test('the production Foundation20 descriptor resolver rejects stale, detached or cross-edition ownership',async()=>{
  const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(19,true);
  try{
    for(let n=0;n<6;n++){g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,1);}
    const colliders=g.colliders.filter(c=>c.mesh.userData.collisionProxy&&c.orientedBox);
    assert.equal(colliders.length,21);
    for(const collider of colliders)assert.equal(g.foundation20CameraDescriptor(collider.mesh),collider.orientedBox);
    const c=colliders[0],entry=g.physics.bodyBoxes.get(c.mesh.uuid),descriptor=c.orientedBox;
    const queryBefore={position:c.mesh.position.toArray(),quaternion:c.mesh.quaternion.toArray(),scale:c.mesh.scale.toArray()};
    // Deliberately invalid metadata fixtures test the fail-closed query guard;
    // all are restored before any production physics/visual update.
    const step=descriptor.step;descriptor.step--;assert.equal(g.foundation20CameraDescriptor(c.mesh),null);descriptor.step=step;
    const owned=entry.orientedBox;entry.orientedBox={...owned};assert.equal(g.foundation20CameraDescriptor(c.mesh),null);entry.orientedBox=owned;
    const index=entry.shapeIndex;entry.shapeIndex=-1;assert.equal(g.foundation20CameraDescriptor(c.mesh),null);entry.shapeIndex=index;
    const half=descriptor.half.x;descriptor.half.x=NaN;assert.equal(g.foundation20CameraDescriptor(c.mesh),null);descriptor.half.x=half;
    const enabled=c.enabled;c.enabled=false;assert.equal(g.foundation20CameraDescriptor(c.mesh),null);c.enabled=enabled;
    g.chamberEdition='classic';assert.equal(g.foundation20CameraDescriptor(c.mesh),null);g.chamberEdition='foundation';
    const level=g.levelIndex;g.levelIndex=18;assert.equal(g.foundation20CameraDescriptor(c.mesh),null);g.levelIndex=level;
    assert.equal(g.foundation20CameraDescriptor(c.mesh),descriptor);
    assert.deepEqual(c.mesh.position.toArray(),queryBefore.position);assert.deepEqual(c.mesh.quaternion.toArray(),queryBefore.quaternion);assert.deepEqual(c.mesh.scale.toArray(),queryBefore.scale);
  }finally{g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();}
});
