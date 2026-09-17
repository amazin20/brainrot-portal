import * as T from 'three';

// Read-only inspection of actual visible vertices. Instanced source tiles need
// their per-instance transform too; an untransformed template is not evidence.
export function visitVisibleTriangles(root, visit) {
 root.updateWorldMatrix(true,true);
 root.traverseVisible(mesh=>{
  if(!mesh.isMesh) return;
  const p=mesh.geometry.attributes.position, idx=mesh.geometry.index;
  const instance=new T.Matrix4(), matrix=new T.Matrix4();
  const a=new T.Vector3(), b=new T.Vector3(), c=new T.Vector3();
  for(let i=0;i<(mesh.isInstancedMesh?mesh.count:1);i++) {
   matrix.copy(mesh.matrixWorld);
   if(mesh.isInstancedMesh){mesh.getMatrixAt(i,instance);matrix.multiply(instance);}
   for(let n=0;n<(idx?.count??p.count);n+=3){
    const at=j=>idx?idx.getX(n+j):n+j;
    a.fromBufferAttribute(p,at(0)).applyMatrix4(matrix);
    b.fromBufferAttribute(p,at(1)).applyMatrix4(matrix);
    c.fromBufferAttribute(p,at(2)).applyMatrix4(matrix);
    visit(a,b,c,mesh);
   }
  }
 });
}
export function visibleBounds(root) {
 const box=new T.Box3();visitVisibleTriangles(root,(a,b,c)=>{box.expandByPoint(a);box.expandByPoint(b);box.expandByPoint(c);});return box;
}
export function glassPlaneCrossings(face,glass) {
 const pane=new T.Box3().setFromObject(glass), x=glass.getWorldPosition(new T.Vector3()).x;
 const hits=[], point=new T.Vector3();
 visitVisibleTriangles(face,(a,b,c,mesh)=>{
  for(const [u,v]of [[a,b],[b,c],[c,a]]) {
   if((u.x-x)*(v.x-x)>=0) continue;
   point.copy(u).lerp(v,(x-u.x)/(v.x-u.x));
   if(point.y>pane.min.y+1e-5&&point.y<pane.max.y-1e-5&&point.z>pane.min.z+1e-5&&point.z<pane.max.z-1e-5)
    hits.push({mesh:mesh.name||'cassette backing/rim',point:point.toArray()});
  }
 });
 return hits;
}
