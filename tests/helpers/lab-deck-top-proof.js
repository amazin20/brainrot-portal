import * as THREE from 'three';

// Measure actual rendered triangles, including triangles crossing the test
// rectangle. Counting centroids alone misses thin duplicate border strips.
export function renderedTopArea(root,rectangle,y){
 root.updateWorldMatrix(true,true);let area=0;
 const clip=(polygon,axis,edge,keepAbove)=>{
  const out=[];
  for(let i=0;i<polygon.length;i++){
   const a=polygon[i],b=polygon[(i+1)%polygon.length];
   const inside=p=>keepAbove?p[axis]>=edge:p[axis]<=edge,ia=inside(a),ib=inside(b);
   if(ia)out.push(a);
   if(ia!==ib){const t=(edge-a[axis])/(b[axis]-a[axis]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  return out;
 };
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isInstancedMesh||!mesh.visible||mesh.userData?.collisionProxy)return;
  if(Array.isArray(mesh.material)||mesh.material?.visible===false)return;
  for(let parent=mesh.parent;parent;parent=parent.parent)if(!parent.visible)return;
  const geometry=mesh.geometry,p=geometry.attributes.position,index=geometry.index;
  const start=geometry.drawRange.start,end=Math.min(index?.count??p.count,start+geometry.drawRange.count);
  const a=new THREE.Vector3(),b=a.clone(),c=a.clone(),n=a.clone();
  for(let i=start;i+2<end;i+=3){
   a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);
   b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);
   c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
   if([a,b,c].some(v=>Math.abs(v.y-y)>.0001))continue;
   n.crossVectors(b.clone().sub(a),c.clone().sub(a)).normalize();if(n.y<.999)continue;
   let polygon=[[a.x,a.z],[b.x,b.z],[c.x,c.z]];
   for(const [axis,edge,above]of [[0,rectangle.minX,true],[0,rectangle.maxX,false],[1,rectangle.minZ,true],[1,rectangle.maxZ,false]])polygon=clip(polygon,axis,edge,above);
   if(polygon.length>=3)area+=Math.abs(polygon.reduce((s,v,i)=>{const next=polygon[(i+1)%polygon.length];return s+v[0]*next[1]-next[0]*v[1];},0))/2;
  }
 });
 return area;
}
