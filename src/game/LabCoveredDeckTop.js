import * as THREE from 'three';

/** Join a visible plinth to a complete deck already sealing its whole top.
 * The separate collision proxy stays a closed box. Only genuinely covered,
 * coplanar top triangles leave this render mesh; the deck is their owner.
 */
export function omitCoveredDeckTop(mesh,deck){
 if(!mesh?.isMesh||mesh.isInstancedMesh||mesh.userData?.collisionProxy||!mesh.geometry?.attributes.position)
  throw new TypeError('An independent plinth render mesh is required');
 mesh.updateWorldMatrix(true,false);
 const bounds=new THREE.Box3().setFromObject(mesh),epsilon=.00001;
 if(!deck||!['minX','maxX','minZ','maxZ','y'].every(k=>Number.isFinite(deck[k]))
  ||Math.abs(bounds.max.y-deck.y)>epsilon||deck.minX>bounds.min.x+epsilon||deck.maxX<bounds.max.x-epsilon
  ||deck.minZ>bounds.min.z+epsilon||deck.maxZ<bounds.max.z-epsilon)
  throw new RangeError('The existing deck must seal the entire coplanar top');
 const old=mesh.geometry,p=old.attributes.position,index=old.index,count=index?.count??p.count;
 const point=new THREE.Vector3(),keep=[];let removed=0;
 for(let i=0;i<count;i+=3){
  const ids=[0,1,2].map(n=>index?index.getX(i+n):i+n);
  if(ids.every(id=>Math.abs(point.fromBufferAttribute(p,id).applyMatrix4(mesh.matrixWorld).y-deck.y)<epsilon))removed++;
  else keep.push(...ids);
 }
 if(!removed)throw new RangeError('No covered coplanar triangles were found');
 const next=old.clone();next.setIndex(keep);next.parameters={...old.parameters};
 next.name='Joined plinth / top owned by '+deck.name;mesh.geometry=next;old.dispose();
 return {removedTriangles:removed,deckName:deck.name};
}
