import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabCamera} from '../src/game/LabCamera.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

const V=(...p)=>new THREE.Vector3(...p);

test('an escape offset is freshly swept at120 and fitted to the current actor and look point',()=>{
  // Explicit query fixture, not an ordinary animated route or native proof.
  const camera=new THREE.PerspectiveCamera(62,16/9,.1,380);
  let inspections=0;
  const rig=new LabCamera({camera,currentBlockersValid:()=>{inspections++;return true;}});
  rig.configureSilhouette({enabled:true,confined:true,foundation20:true});
  rig.playerPivot.set(0,1.32,0);rig.lookPoint.set(0,1.32,-16);
  rig.foundation20EscapeOffset=V(0,0,6);
  const original=rig.constrain,lens={fov:camera.fov,eye:camera.position.toArray(),q:camera.quaternion.toArray(),projection:camera.projectionMatrix.toArray()},sweeps=[];
  rig.constrain=function(...args){sweeps.push(args[2]);return original.apply(this,args);};
  assert.deepEqual(rig.reusableFoundation20Escape().toArray(),[0,1.32,6]);
  rig.playerPivot.set(3,2.32,5);rig.lookPoint.set(3,2.32,-11);
  assert.deepEqual(rig.reusableFoundation20Escape().toArray(),[3,2.32,11]);
  assert.equal(inspections,2);assert.deepEqual(sweeps,[120,120]);
  assert.deepEqual({fov:camera.fov,eye:camera.position.toArray(),q:camera.quaternion.toArray(),projection:camera.projectionMatrix.toArray()},lens);
  // The same legal empty-space eye is unusable when the actual optical axis
  // turns away from the actor. A previous accepted FOV is never reused.
  rig.lookPoint.set(3,2.32,30);
  assert.equal(rig.reusableFoundation20Escape(),null);assert.equal(rig.foundation20EscapeOffset,null);
});

test('a freshly moved owned leaf or new wall invalidates the previous escape',()=>{
  const source=new THREE.Mesh(new THREE.BoxGeometry(2,4,.5),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  source.position.set(-7,1.32,3);source.visible=false;source.updateMatrixWorld(true);
  const descriptor={half:V(1,2,.25),current:{center:V(-7,1.32,3),quaternion:new THREE.Quaternion()}};
  const camera=new THREE.PerspectiveCamera(62,16/9,.1,380),blockers=[source];
  const rig=new LabCamera({camera,blockers,currentBlocker:o=>o===source?descriptor:null,currentBlockersValid:()=>true});
  rig.configureSilhouette({enabled:true,confined:true,foundation20:true});rig.playerPivot.set(0,1.32,0);rig.lookPoint.set(0,1.32,-16);
  rig.updateCurrentBlockers();rig.foundation20EscapeOffset=V(0,0,6);
  assert.ok(rig.reusableFoundation20Escape());
  descriptor.current.center.x=0;rig.updateCurrentBlockers();
  assert.equal(rig.reusableFoundation20Escape(),null);assert.equal(rig.foundation20EscapeOffset,null);
  assert.deepEqual(source.position.toArray(),[-7,1.32,3]);
  descriptor.current.center.x=-7;
  const wall=new THREE.Mesh(new THREE.BoxGeometry(2,4,.5),source.material);wall.position.set(0,1.32,3);wall.updateMatrixWorld(true);blockers.push(wall);
  rig.updateCurrentBlockers();rig.foundation20EscapeOffset=V(0,0,6);
  assert.equal(rig.reusableFoundation20Escape(),null);assert.equal(rig.foundation20EscapeOffset,null);
  source.geometry.dispose();wall.geometry.dispose();source.material.dispose();rig.queryBlockers[0].geometry.dispose();
});

test('the ordinary production ownership guard rejects stale boxes before cached candidate queries',async()=>{
  const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(19,true);
  try{
    for(let n=0;n<6;n++){g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,1);}
    const rig=g.cameraRig,owned=g.colliders.filter(c=>c.orientedBox);
    assert.equal(owned.length,21);assert.equal(rig.currentBlockersValid(),true);
    const descriptor=owned[0].orientedBox,step=descriptor.step;descriptor.step--;
    assert.equal(rig.currentBlockersValid(),false);
    rig.foundation20EscapeOffset=V(0,0,6);const original=rig.constrain;let queries=0;
    rig.constrain=function(...args){queries++;return original.apply(this,args);};
    assert.equal(rig.reusableFoundation20Escape(),null);assert.equal(rig.foundation20EscapeOffset,null);assert.equal(queries,0);
    rig.constrain=original;descriptor.step=step;
    assert.equal(rig.currentBlockersValid(),true);
    await g.selectLevel(40,true);assert.equal(g.cameraRig.currentBlockersValid,null);
    assert.equal(g.cameraRig.reusableFoundation20Escape(),null);
  }finally{g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();}
});

test('reset, portal transport and disabled silhouette scope discard the old escape offset',()=>{
  const camera=new THREE.PerspectiveCamera(62,16/9,.1,380),rig=new LabCamera({camera,currentBlockersValid:()=>true});
  rig.configureSilhouette({enabled:true,confined:true,foundation20:true});rig.foundation20EscapeOffset=V(0,0,6);
  rig.reset(V(0,0,0));assert.equal(rig.foundation20EscapeOffset,null);
  rig.foundation20EscapeOffset=V(0,0,6);rig.applyPortalTransform(new THREE.Matrix4().makeTranslation(5,0,0));
  assert.equal(rig.foundation20EscapeOffset,null);
  rig.foundation20EscapeOffset=V(0,0,6);rig.configureSilhouette({enabled:true,confined:true});
  assert.equal(rig.foundation20EscapeOffset,null);assert.equal(rig.reusableFoundation20Escape(),null);
});

test('registered moving boxes cannot become unowned static blockers through missing collider metadata',async()=>{
  const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(19,true);
  try{
    for(let n=0;n<6;n++){g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,1);}
    const rig=g.cameraRig,collider=g.colliders.find(c=>c.orientedBox);
    const descriptor=collider.orientedBox,entry=g.physics.bodyBoxes.get(collider.mesh.uuid);
    assert.equal(entry.orientedBox,descriptor);assert.equal(rig.currentBlockersValid(),true);
    const original=rig.constrain;let queries=0;
    rig.constrain=function(...args){queries++;return original.apply(this,args);};
    // Missing/replaced metadata fixtures are restored before any update. The
    // actual registered physical entry and current descriptor remain intact.
    const foreign=g.colliders.find(c=>c.orientedBox&&c.orientedBox!==descriptor).orientedBox;
    for(const value of [undefined,null,{...descriptor},foreign]){
      if(value===undefined)delete collider.orientedBox;else collider.orientedBox=value;
      assert.equal(rig.currentBlockersValid(),false);
      rig.foundation20EscapeOffset=V(0,0,6);
      assert.equal(rig.reusableFoundation20Escape(),null);assert.equal(rig.foundation20EscapeOffset,null);
      assert.equal(queries,0);assert.equal(entry.orientedBox,descriptor);
    }
    collider.orientedBox=descriptor;rig.constrain=original;
    assert.equal(rig.currentBlockersValid(),true);
    const ordinary=g.colliders.filter(c=>!c.orientedBox);
    assert.ok(ordinary.length>0&&ordinary.every(c=>!g.physics.bodyBoxes.get(c.mesh.uuid)?.orientedBox));
    for(const edition of ['classic','epic']){g.chamberEdition=edition;await g.selectLevel(19,true);assert.equal(g.cameraRig.currentBlockersValid,null);}
  }finally{g.firstLevel.dispose?.();g.physics.dispose();g.portals.dispose();}
});
