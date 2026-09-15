import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Room21 R2 editable mechanism dressing. Colliders stay on separate source
 * meshes: subassemblies never change their bounds or the projectile registry. */
export function addRoom21RebuildArt(k, { drive, service }, bridge) {
  const root = new THREE.Group(); root.name = 'Gravity pocket R2 · load transmission';
  root.userData.visualOnly = true; root.userData.colliderIndependent = true; k.world.root.add(root);
  const shell = new THREE.MeshStandardMaterial({ color: 0x739b94, metalness: .28, roughness: .49 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xa5b9b8, metalness: .7, roughness: .33 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x29444b, metalness: .42, roughness: .55 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0xe6c289, metalness: .3, roughness: .45 });
  const unit = new RoundedBoxGeometry(1, 1, 1, 2, .06), m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const V = a => new THREE.Vector3(...a);
  function batch(parent, entries, material, name) {
    const mesh = new THREE.InstancedMesh(unit, material, entries.length); mesh.name = name;
    entries.forEach(([p, s], i) => mesh.setMatrixAt(i, m.compose(V(p), q, V(s))));
    mesh.receiveShadow = true; mesh.computeBoundingSphere(); parent.add(mesh); return mesh;
  }
  function rod(parent, a, b, r, material = steel) {
    a = V(a); b = V(b); const delta = b.clone().sub(a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, delta.length(), 12), material);
    mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(V([0,1,0]),delta.normalize());
    mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  const hood = new THREE.Group(); hood.name = 'Retracting freight inspection hood'; root.add(hood);
  const plates = [], ribs = [], lines = [];
  for (let x = -5; x <= 5; x += 2) for (let z = -3.55; z <= 3.55; z += 1.775) {
    plates.push([[x, 1.10, z], [1.92,.18,1.70]], [[x,-1.10,z],[1.92,.18,1.70]]);
  }
  for (const side of [-1,1]) {
    ribs.push([[side*5.91,0,0],[.18,2.35,9.45]],[[0,0,side*4.62],[12.02,2.35,.18]]);
    for(let x=-4.5;x<=4.5;x+=1.5)lines.push([[x,.25,side*4.725],[.9,.10,.035]]);
  }
  batch(hood,plates,shell,'Segmented top and underside shells');
  batch(hood,ribs,dark,'Continuous hood edge beams');batch(hood,lines,stripe,'Inset inspection edge markers');
  const hidden = service.mesh.material.clone(); hidden.visible = false; service.mesh.material = hidden;
  const track = [], bearings=[];
  for(const x of [4.15,16.35]) {
    track.push([[x,14.75,10.5],[.20,.22,23.5]]);
    for(const z of [0,10.5,21]) {
      track.push([[x,.2,z],[.9,.4,.9]],[[x,7.3,z],[.22,14.6,.24]],[[x,14.65,z],[.85,.45,.65]]);
    }
    for(const z of [-3.7,3.7])bearings.push([[x-10.25,.83,z],[.36,.60,.8]]);
  }
  batch(root,track,steel,'Grounded gantry and hood travel rails');batch(hood,bearings,steel,'Hood roller shoes');
  const carArt = new THREE.Group(); carArt.name='Source carriage cable yoke';root.add(carArt);
  batch(carArt,[[[0,-.38,0],[5,.42,4.9]],[[-2.4,-.55,0],[.2,.8,4.7]],[[2.4,-.55,0],[.2,.8,4.7]]],dark,'Carriage underframe');
  const brake = new THREE.Group(); brake.position.set(-23,7.85,16.7); root.add(brake);
  const lever=rod(brake,[0,0,0],[0,.60,0],.065,stripe);
  const shoes=batch(root,[[[-21.8,7.3,11.15],[.55,.8,.65]],[[-16.2,7.3,11.15],[.55,.8,.65]]],dark,'Brake calipers');
  const pulley = new THREE.Mesh(new THREE.TorusGeometry(.55,.08,8,24),steel);
  pulley.position.set(-19,21.7,11.15); root.add(pulley);
  const cables=[-21.8,-16.2].map(x=>rod(root,[x,7,11.15],[x,21.5,11.15],.045,dark));
  const returnArt = new THREE.Group(); returnArt.name='Counterstroke transfer deck underframe'; root.add(returnArt);
  batch(returnArt,[[[0,-.32,0],[4.95,.35,7.95]],[[-2.4,-.5,0],[.18,.7,8]],[[2.4,-.5,0],[.18,.7,8]]],dark,'Bridge continuous girders');
  batch(returnArt,[-3,-1.5,0,1.5,3].map(z=>[[0,-.42,z],[4.8,.45,.22]]),steel,'Bridge crossmembers');
  const update = () => {
    hood.position.copy(service.mesh.position); carArt.position.copy(drive.car.group.position);
    returnArt.position.copy(bridge.group.position);
    lever.rotation.z=drive.brake ? -.58 : .35;
    pulley.rotation.z=-drive.car.progress*10;
    for(const [i,cable] of cables.entries()) {
      const bottom=drive.car.group.position.y+.3, top=21.5;
      cable.position.y=(top+bottom)/2; cable.scale.y=Math.max(.02,(top-bottom)/14.5);
    }
  };
  k.renders.push(update);k.resets.push(update);update();
  return root;
}
