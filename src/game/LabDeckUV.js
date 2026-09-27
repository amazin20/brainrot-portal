import * as THREE from 'three';

/** Bake a six-metre finish into each face in its initial world pose. UVs remain
 * attached to moving decks. Dominant-face projection also gives vertical rims
 * two texture dimensions instead of collapsing them into striped lines. */
export function mapDeckUV(mesh,tileSize=6){
 mesh.updateWorldMatrix(true,false);
 let geometry=mesh.geometry;
 if(geometry.index){geometry=geometry.toNonIndexed();mesh.geometry=geometry;}
 const positions=geometry.attributes.position;
 const uv=new THREE.Float32BufferAttribute(new Float32Array(positions.count*2),2);
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 const ab=new THREE.Vector3(),ac=new THREE.Vector3(),normal=new THREE.Vector3();
 for(let i=0;i<positions.count;i+=3){
  a.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
  b.fromBufferAttribute(positions,i+1).applyMatrix4(mesh.matrixWorld);
  c.fromBufferAttribute(positions,i+2).applyMatrix4(mesh.matrixWorld);
  normal.crossVectors(ab.subVectors(b,a),ac.subVectors(c,a));
  const x=Math.abs(normal.x),y=Math.abs(normal.y),z=Math.abs(normal.z);
  const axes=y>=x&&y>=z?['x','z']:x>=z?['z','y']:['x','y'];
  for(const [offset,p]of [a,b,c].entries())uv.setXY(i+offset,p[axes[0]]/tileSize,p[axes[1]]/tileSize);
 }
 geometry.setAttribute('uv',uv);
}
