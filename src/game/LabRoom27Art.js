import * as THREE from 'three';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
/** One kinetic carnival silhouette: paired barrel canopies, blue bridgework,
 * yellow drums and broad, consistent colour blocks. Decorative repetition is
 * instanced; none of these meshes replaces a gameplay collider or portal. */
export function dressRoom27(k){
 const w=k.world,root=new THREE.Group();root.name='Conveyor city carnival architecture';root.userData.keepMaterial=true;w.root.add(root);
 const blue=new THREE.MeshStandardMaterial({color:0x2f588e,roughness:.42,metalness:.28});
 const pink=new THREE.MeshStandardMaterial({color:0xf077a8,roughness:.58,metalness:.12,side:THREE.DoubleSide});
 const cream=new THREE.MeshStandardMaterial({color:0xffd365,roughness:.5,metalness:.18});
 const teal=new THREE.MeshStandardMaterial({color:0x27aeb9,roughness:.43,metalness:.26});
 const boxes=[];
 const beam=(a,b,width=.18)=>{const x=V(...a),y=V(...b),d=y.clone().sub(x);boxes.push({p:x.add(y).multiplyScalar(.5),q:new THREE.Quaternion().setFromUnitVectors(V(0,1,0),d.clone().normalize()),s:V(width,d.length(),width)});};
 // Arches stay above the weapon sightlines; narrow supports sit outside both
 // belt edges. Their visual modules expose rollers instead of hiding them.
 const archGeometry=new THREE.TorusGeometry(4.15,.15,6,24,Math.PI),canopyGeometry=new THREE.CylinderGeometry(4.15,4.15,5,24,1,true,-Math.PI/2,Math.PI);
 for(const z of [-8,3,12]){const arch=new THREE.Mesh(archGeometry,cream);arch.position.set(-13,2.4,z);root.add(arch);for(const x of [-17.15,-8.85])beam([x,0,z],[x,2.4,z],.2);}
 for(const z of [-5.5,5.5]){const roof=new THREE.Mesh(canopyGeometry,pink);roof.rotation.x=-Math.PI/2;roof.position.set(-13,2.4,z);root.add(roof);}
 // The suspended city has visible columns and triangular bracing, so its
 // permanent islands read as construction rather than floating slabs.
 for(const [x,z,y] of [[7.1,8.5,8],[16.8,8.5,8],[22.6,13.5,8],[22.6,-20.5,8],[10.3,-17.5,8],[-24.4,-5.4,8],[-24.4,5.4,8],[-9.6,-5.4,8],[-9.6,5.4,8],[6.4,-21.5,16],[9.6,-13,16]]){
  beam([x,0,z],[x,y-.22,z],.35);beam([x,Math.max(.5,y-3),z],[x+.9,y-.25,z],.18);
 }
 for(const z of [-5.5,5.5])beam([-24.5,8,z],[-24.5,14,z],.3);
 const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),blue,boxes.length),matrix=new THREE.Matrix4();boxes.forEach((b,i)=>{matrix.compose(b.p,b.q,b.s);mesh.setMatrixAt(i,matrix);});mesh.name='Instanced blue structural bridgework';mesh.computeBoundingSphere();root.add(mesh);
 // Four large enamel belt drums make direction controls feel connected to
 // an actual common transmission. They avoid rotating per-object matrices.
 const drums=new THREE.InstancedMesh(new THREE.CylinderGeometry(.72,.72,1.05,16),teal,4),drumCaps=new THREE.InstancedMesh(new THREE.CylinderGeometry(.48,.48,1.08,12),cream,4),q=new THREE.Quaternion().setFromAxisAngle(V(0,0,1),Math.PI/2);
 [[-16.45,.8,-14.1],[-16.45,.8,14.1],[18.7,8.8,-18.3],[18.7,8.8,8.3]].forEach((p,i)=>{matrix.compose(V(...p),q,V(1,1,1));drums.setMatrixAt(i,matrix);drumCaps.setMatrixAt(i,matrix);});
 drums.computeBoundingSphere();drumCaps.computeBoundingSphere();root.add(drums,drumCaps);
 // The receiving island has its own asymmetric marquee, visible throughout
 // the city. Its horizontal opening frames the eventual landing direction.
 const marquee=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),pink);marquee.position.set(-24.5,14,0);marquee.scale.set(.65,1.15,12.2);root.add(marquee);
 return {root,staticDrawCalls:9,hasAnimatedArt:false};
}
