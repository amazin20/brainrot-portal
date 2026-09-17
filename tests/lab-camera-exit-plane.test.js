import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabCamera} from '../src/game/LabCamera.js';
import {makePortalFrame} from '../src/game/LabPortals.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

function fixture(t) {
  const camera = new THREE.PerspectiveCamera(62, 16/9, .1, 150);
  const blockers = [], rig = new LabCamera({camera, blockers});
  const exit = makePortalFrame(new THREE.Vector3(0,2,0), new THREE.Vector3(.45,Math.sqrt(1-.45**2),0));
  const local = (x,y,z) => new THREE.Vector3(x,y,z).applyQuaternion(exit.quaternion).add(exit.position);
  rig.reset(new THREE.Vector3(0,0,1));
  camera.position.copy(local(0,0,-5)); camera.lookAt(local(0,0,10)); camera.updateMatrixWorld(true);
  rig.portalExit = exit; rig.updatePortalClipping();
  function wall(z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(8,8,.2),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    m.position.copy(local(0,0,z));m.quaternion.copy(exit.quaternion);m.updateMatrixWorld(true);blockers.push(m);return m;
  }
  t.after(()=>blockers.forEach(m=>{m.geometry.dispose();m.material.dispose();}));
  return {camera,rig,exit,wall,local};
}

test('exit lens sweeps ignore only intersections discarded by the active render plane', t=>{
  const {rig,wall,local,exit} = fixture(t);wall(-2);
  const pivot = local(0,0,1), lens = local(0,0,-5);
  assert.equal(rig.mainClippingPlanes.length,1);
  assert.equal(rig.constrain(pivot,lens),false,'Invisible exit-side casing collapsed the boom');
  assert.deepEqual(lens.toArray(),local(0,0,-5).toArray());
  wall(.5);lens.copy(local(0,0,-5));
  assert.equal(rig.constrain(pivot,lens),true,'Visible foreground wall must remain solid');
  assert.ok(lens.clone().sub(exit.position).dot(exit.normal)>.6,'Near plane crossed the foreground wall');
});

test('clipping tests the hit point, not the whole collider or a room identifier',t=>{
  const {rig,local} = fixture(t);
  for(const z of [-3,-.01,.024])assert.equal(rig.clipsPortalHit(local(4,7,z)),true);
  for(const z of [.0251,.026,3])assert.equal(rig.clipsPortalHit(local(4,7,z)),false);
  assert.equal(rig.clipsPortalHit(null),false);
});

for(const retire of ['crossing','turn-away','removed','reset']) test(`ordinary wall collision returns when exit plane ends: ${retire}`,t=>{
  const {camera,rig,exit,wall,local}=fixture(t);wall(-2);
  if(retire==='crossing')camera.position.copy(local(0,0,.1));
  if(retire==='turn-away')camera.lookAt(local(0,0,-10));
  if(retire==='removed')exit.group=new THREE.Group();
  if(retire==='reset')rig.reset(new THREE.Vector3());
  camera.updateMatrixWorld(true);rig.updatePortalClipping();
  assert.equal(rig.mainClippingPlanes.length,0);
  assert.equal(rig.clipsPortalHit(local(0,0,-2)),false);
  const lens=local(0,0,-5);
  assert.equal(rig.constrain(local(0,0,1),lens),true);
  assert.ok(lens.clone().sub(exit.position).dot(exit.normal) > -1.9 + .24, 'Lens must stop beyond the wall face plus sweep radius');
});

test('flat wall and floor exits retain the previously tested camera contact policy',t=>{
  const {rig,camera}=fixture(t);
  for(const normal of [new THREE.Vector3(0,0,1),new THREE.Vector3(0,1,0)]){
    const exit=makePortalFrame(new THREE.Vector3(0,4,0),normal);
    camera.position.copy(exit.position).addScaledVector(normal,-5);
    camera.up.set(1,0,0);camera.lookAt(exit.position);camera.updateMatrixWorld(true);
    rig.portalExit=exit;rig.updatePortalClipping();
    assert.equal(rig.mainClippingPlanes.length,1);
    assert.equal(rig.isInclinedExitLens(),false);
    assert.equal(rig.clipsPortalHit(exit.position.clone().addScaledVector(normal,-2)),false);
  }
});

// The default near plane and actor's own portal-plane cut still apply. Sample
// actual skinned vertices, not a rest-pose box or an invented head location.
function visibleSkin(game) {
  game.scene.updateMatrixWorld(true);game.portalActors.update();
  const point=new THREE.Vector3();let retained=0,outside=0;
  game.playerGroup.traverse(mesh=>{
    if(!mesh.isMesh)return;
    for(let n=mesh;n;n=n.parent)if(!n.visible)return;
    if(mesh.isSkinnedMesh)mesh.skeleton.update();
    const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
    if(!material.visible)return;
    const planes=[...game.cameraRig.mainClippingPlanes,...(material.clippingPlanes||[])];
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
      mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
      if(planes.some(p=>p.distanceToPoint(point)<0))continue;
      retained++;point.project(game.camera);
      if(Math.abs(point.x)>1||Math.abs(point.y)>1||point.z < -1||point.z>1)outside++;
    }
  });return {retained,outside};
}

test('both ordinary room21 exits retain the emerging skin and re-sweep on plane retirement', async()=>{
  const g=await createHeadlessGame();await g.selectLevel(20,false);
  const update=g.updateVisuals;let previous=0,since=999,releaseFrames=0;
  const counts=new Map(),holds=new Map();let hadPlane=false;
  g.updateVisuals=function(...args){
    update.apply(this,args);
    if(this.teleportCount!==previous){previous=this.teleportCount;since=0;}
    if(previous>=3&&since<120){
      const rig=this.cameraRig,lens=this.camera.position.clone();
      rig.constrain(rig.playerPivot,lens);
      assert.ok(lens.distanceTo(this.camera.position)<1e-7,`Unswept final lens at event${previous},tick${since}`);
      if(hadPlane&&!rig.mainClippingPlanes.length)releaseFrames++;
      hadPlane=rig.mainClippingPlanes.length>0;
      if(since<24){
        const v=visibleSkin(this);counts.set(previous,(counts.get(previous)||0)+1);holds.set(previous,!!this.heldCube);
        assert.ok(v.retained>500,'Do not pass by hiding/clipping the entire player');
        assert.equal(v.outside,0,`Exit-lens recovery lost ${v.outside}/${v.retained} skin vertices at event${previous},tick${since}`);
      }
    }
    since++;
  };
  try{
    const result=await runV8Journey(g);
    assert.equal(result.pass,true);assert.equal(result.resets+result.respawns,0);
    assert.deepEqual([...counts.entries()],[[3,24],[4,24]]);
    assert.equal(holds.get(3),false);assert.equal(holds.get(4),true);
    assert.equal(releaseFrames,2,'Both exit lenses must return to ordinary collision');
  }finally{g.updateVisuals=update;g.firstLevel.dispose?.();g.physics.dispose();g.portals.dispose();}
});
