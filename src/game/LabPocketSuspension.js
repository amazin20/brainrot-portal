import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Presentation of the existing reduced actuator, NOT a new mass/energy solver.
// Two drum radii explain its retained 0.78 counterweight travel ratio. Split
// ballast stays in side pockets instead of crossing the moving ceramic.
export const SUSPENSION = Object.freeze({
  low: 3.8, high: 15.8, drumY: 23.5, driveRadius: .5, returnRadius: .39,
  driveX: -9.55, returnX: -12.2, driveZ: 3.8, drumZ: 3.3, returnZ: 2.91,
  weightZ: 3.98, weightY: 4, carriageEyeY: .30, weightEyeY: 2.20,
});

export function createPocketSuspension({ shell, metal, accent } = {}) {
  shell ??= new THREE.MeshStandardMaterial({ name:'Suspension graphite', color:0x36565d, roughness:.55, metalness:.28 });
  metal ??= new THREE.MeshStandardMaterial({ name:'Suspension alloy', color:0x869d9e, roughness:.38, metalness:.64 });
  accent ??= new THREE.MeshStandardMaterial({ name:'Suspension brass', color:0xc5a66a, roughness:.5, metalness:.25 });
  const root=new THREE.Group();root.name='Cassette / connected differential-drum suspension';
  const fixed=new THREE.Group(),carriage=new THREE.Group(),weights=new THREE.Group();
  fixed.name='Fixed bearings and ballast guides';carriage.name='Underslung ceramic carriage';weights.name='Split counterweight stacks';
  root.add(fixed,carriage,weights);
  const batches=new Map(),drums=[],ropes=[],weightSolids=[];
  function bake(parent,geometry,material,position,rotation=[0,0,0]) {
    const source=geometry.index?geometry.toNonIndexed():geometry;
    if(source!==geometry)geometry.dispose();
    source.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(1,1,1)));
    if(!batches.has(parent))batches.set(parent,new Map());
    const bucket=batches.get(parent);if(!bucket.has(material))bucket.set(material,[]);bucket.get(material).push(source);
  }
  const box=(p,s,mat,parent=fixed)=>bake(parent,new RoundedBoxGeometry(...s,1,Math.min(.055,...s.map(n=>n*.15))),mat,p);
  const pin=(p,r,h,mat,parent=fixed,rotation=[0,0,0])=>bake(parent,new THREE.CylinderGeometry(r,r,h,16),mat,p,rotation);
  const anchor=(parent,name,p)=>{const a=new THREE.Object3D();a.name=name;a.position.fromArray(p);parent.add(a);return a;};
  for(const side of [-1,1]) {
    const z=-6+side*SUSPENSION.drumZ;
    // Each bearing reaches the existing header/back wall. No floating pulleys.
    box([-10.8,24.0,z],[3.75,.25,.75],metal);
    for(const x of [-12.52,-9.14]) {
      box([x,23.70,z],[.22,.60,.65],shell);
      pin([x,23.5,z],.18,.30,metal,fixed,[0,0,Math.PI/2]);
    }
    const drum=new THREE.Group();drum.name=`Coupled drums ${side}`;drum.position.set(0,SUSPENSION.drumY,z);root.add(drum);drums.push(drum);
    pin([-10.88,0,0],.095,3.45,metal,drum,[0,0,Math.PI/2]);
    for(const [x,r] of [[SUSPENSION.driveX,SUSPENSION.driveRadius],[SUSPENSION.returnX,SUSPENSION.returnRadius]]) {
      const profile=[[.10,-.19],[r+.055,-.19],[r+.055,-.13],[r,-.09],[r,.09],[r+.055,.13],[r+.055,.19],[.10,.19]];
      bake(drum,new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),24),metal,[x,0,0],[0,0,Math.PI/2]);
      // Three broad spokes make rotation legible; no per-bolt render meshes.
      for(let i=0;i<3;i++) {
        const a=i*Math.PI*2/3;
        bake(drum,new THREE.BoxGeometry(.035,r*.70,.085),accent,[x+.205,Math.cos(a)*r*.51,Math.sin(a)*r*.51],[a,0,0]);
      }
    }
    const guideZ=-6+side*4.3;
    box([SUSPENSION.returnX,8.5,guideZ],[.12,16.5,.12],metal);
    box([SUSPENSION.returnX,.18,guideZ],[.42,.36,.42],shell);
    box([-12.43,16.35,guideZ],[.65,.28,.40],metal);

    // A pair of C-section sliding shoes surrounds, not fills, the existing rails.
    for(const x of [-.27,.27])box([x,-.55,side*3.8],[.12,.8,.62],metal,carriage);
    box([0,-.55,side*4.11],[.64,.8,.12],shell,carriage);
    box([0,-.68,side*3.2],[.38,.25,1.50],metal,carriage);
    box([0,-.43,side*2.55],[.60,.24,.50],shell,carriage);
    box([.27,-.48,side*3.8],[.55,.20,.24],accent,carriage);
    box([.45,-.12,side*3.8],[.18,.85,.22],metal,carriage);
    const from=anchor(carriage,`Cassette rope eye ${side}`,[.45,SUSPENSION.carriageEyeY,side*3.8]);

    // All ballast remains inside the rear side pockets, clear of the ceramic.
    for(let i=0;i<5;i++)box([0,-1.56+i*.78,side*SUSPENSION.weightZ],[.43,.70,.50],metal,weights);
    box([.245,0,side*SUSPENSION.weightZ],[.055,4.02,.21],shell,weights);
    box([0,2.05,side*SUSPENSION.weightZ],[.28,.30,.48],accent,weights);
    box([0,2.07,side*4.01],[.30,.32,.46],shell,weights);
    const to=anchor(weights,`Counterweight rope eye ${side}`,[0,SUSPENSION.weightEyeY,side*SUSPENSION.weightZ]);
    weightSolids.push({side,center:[0,0,side*SUSPENSION.weightZ],half:[.215,1.91,.25]});
    const driveTop=new THREE.Vector3(SUSPENSION.driveX,SUSPENSION.drumY,-6+side*SUSPENSION.driveZ);
    ropes.push({eye:from,top:driveTop,drumTangent:driveTop.clone(),radius:SUSPENSION.driveRadius,side,mesh:null});
    // Two fixed redirects put the return in the ballast side pocket. A return
    // hanging straight from the inner drum would still cut the inclined plate.
    const x=SUSPENSION.returnX,z0=-6+side*SUSPENSION.returnZ,z1=-6+side*SUSPENSION.weightZ;
    const points=[new THREE.Vector3(x,SUSPENSION.drumY,z0),new THREE.Vector3(x,22,z0)];
    const bend=.15;
    for(let i=1;i<=8;i++){const a=i*Math.PI/16;points.push(new THREE.Vector3(x,22-bend*Math.sin(a),z0+side*bend*(1-Math.cos(a))));}
    points.push(new THREE.Vector3(x,21.85,z1-side*bend));
    for(let i=1;i<=8;i++){const a=i*Math.PI/16;points.push(new THREE.Vector3(x,21.7+bend*Math.cos(a),z1-side*bend+side*bend*Math.sin(a)));}
    const path=new THREE.CurvePath();for(let i=1;i<points.length;i++)path.add(new THREE.LineCurve3(points[i-1],points[i]));
    bake(fixed,new THREE.TubeGeometry(path,36,.026,8,false),metal,[0,0,0]);
    for(const [y,zr]of [[22,z0+side*bend],[21.7,z1-side*bend]]) {
      pin([x,y,zr],bend,.10,metal,fixed,[0,0,Math.PI/2]);
      box([-12.43,y,zr],[.62,.13,.35],shell);
    }
    ropes.push({eye:to,top:points.at(-1),drumTangent:points[0],radius:SUSPENSION.returnRadius,side,mesh:null});
  }
  for(const [parent,byMaterial] of batches)for(const [material,parts] of byMaterial) {
    const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());
    if(!geometry)throw Error('Could not batch suspension geometry');
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,material);mesh.name=parent.name+' / '+material.name;
    mesh.castShadow=false;mesh.receiveShadow=true;parent.add(mesh);
  }
  // Four ordinary meshes avoid introducing an instancing-specific disposal contract.
  // They share geometry/material; pose changes lengths, never allocates geometry.
  const cableGeometry=new THREE.CylinderGeometry(.026,.026,1,8);
  for(const rope of ropes){rope.mesh=new THREE.Mesh(cableGeometry,metal);rope.mesh.name=rope.eye.name+' / taut cable';root.add(rope.mesh);}
  const bottom=new THREE.Vector3(),delta=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  const pose=height=>{
    if(!Number.isFinite(height)||height<SUSPENSION.low-1e-9||height>SUSPENSION.high+1e-9)throw new RangeError('Cassette height outside authored travel');
    carriage.position.set(-10,height,-6);
    weights.position.set(SUSPENSION.returnX,SUSPENSION.weightY+(SUSPENSION.high-height)*SUSPENSION.returnRadius/SUSPENSION.driveRadius,-6);
    root.updateWorldMatrix(true,true);
    for(const rope of ropes){
      rope.eye.getWorldPosition(bottom);root.worldToLocal(bottom);delta.subVectors(rope.top,bottom);
      rope.mesh.position.copy(bottom).add(rope.top).multiplyScalar(.5);
      rope.mesh.scale.set(1,delta.length(),1);rope.mesh.quaternion.setFromUnitVectors(up,delta.normalize());
    }
    drums.forEach((drum,i)=>{drum.rotation.x=(i===0?-1:1)*(SUSPENSION.high-height)/SUSPENSION.driveRadius;});
  };
  pose(SUSPENSION.high);
  return {root,fixed,carriage,weights,drums,ropes,weightSolids,pose,parameters:SUSPENSION};
}
