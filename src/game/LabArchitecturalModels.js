import * as THREE from 'three';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

/** Clipped, folded sheet metal with a satin face and shaded edge.
 * The folds are part of the one opaque mesh: overlapping planes on large
 * rooms used to shimmer, especially through portals. */
export function architecturalCassetteGeometry({corner=.035,inset=.012}={}){
  const c=.5-corner;
  const points=[[-c,-.5],[c,-.5],[.5,-c],[.5,c],[c,.5],[-c,.5],[-.5,c],[-.5,-c]];
  const ring=(z,inset=0)=>points.map(([x,y])=>[x*(1-inset*2),y*(1-inset*2),z]);
  const back=ring(-.5),shoulder=ring(.1),front=ring(.5,inset);
  const vertices=[],uv=[],colors=[];
  const tri=(a,b,c,tints=[1,1,1])=>{for(const [i,p] of [a,b,c].entries()){
    vertices.push(...p);uv.push(p[0]+.5,p[1]+.5);
    colors.push(tints[i],tints[i],tints[i]);
  }};
  for(let i=0;i<8;i++){
    const j=(i+1)%8;
    tri([0,0,.5],front[i],front[j]);tri([0,0,-.5],back[j],back[i]);
    tri(back[i],back[j],shoulder[j],[.55,.55,.70]);tri(back[i],shoulder[j],shoulder[i],[.55,.70,.70]);
    tri(shoulder[i],shoulder[j],front[j],[.70,.70,1]);tri(shoulder[i],front[j],front[i],[.70,1,1]);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.name='Folded architectural cassette / 48 triangles';return geometry;
}

export function architecturalMaterials(accent){
  // Continuous finishes avoid a repeating grain at every cassette boundary.
  // The geometry supplies the broad bevel shading, even without reflections.
  const coat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.62,metalness:.075,vertexColors:true});
  const frame=new THREE.MeshStandardMaterial({color:0x394e5c,roughness:.52,metalness:.24});
  const steel=new THREE.MeshStandardMaterial({color:0xaab5af,roughness:.38,metalness:.42});
  const recess=new THREE.MeshStandardMaterial({color:0x293940,roughness:.84,metalness:.04});
  const lamp=new THREE.MeshBasicMaterial({color:accent??0xaddfe2,toneMapped:true});
  return {coat,frame,steel,recess,lamp};
}

/** One draw batch per material/geometry. Coarse cassettes are cheap enough to
 * share a chamber batch; hundreds of tiny spatial batches cost more in each
 * portal pass. Nothing enters physics, raycast or gameplay registries. */
export class ArchitecturalBatch {
  constructor(root,materials){
    this.root=root;this.materials=materials;this.groups=new Map();
    this.geometry=architecturalCassetteGeometry();this.box=new THREE.BoxGeometry(1,1,1);
    this.bolt=new THREE.CylinderGeometry(1,1,1,6,1);this.bolt.rotateX(Math.PI/2);
  }
  add(kind,frame,p,size,{color=0xffffff,geometry='cassette'}={}){
    const matrix=frame.clone().multiply(new THREE.Matrix4().compose(V(...p),new THREE.Quaternion(),V(...size)));
    const key=kind+'/'+geometry;
    if(!this.groups.has(key))this.groups.set(key,{kind,geometry,entries:[]});
    this.groups.get(key).entries.push({matrix,color});
  }
  finish(){
    let instances=0,triangles=0;
    for(const {kind,geometry,entries} of this.groups.values()){
      const source=geometry==='box'?this.box:geometry==='bolt'?this.bolt:this.geometry;
      const mesh=new THREE.InstancedMesh(source,this.materials[kind],entries.length);
      mesh.name=`Architectural ${kind} / ${geometry}`;mesh.userData.visualOnly=true;
      mesh.castShadow=false;mesh.receiveShadow=true;
      entries.forEach((entry,i)=>{mesh.setMatrixAt(i,entry.matrix);if(kind==='coat')mesh.setColorAt(i,new THREE.Color(entry.color));});
      mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      mesh.computeBoundingBox();mesh.computeBoundingSphere();this.root.add(mesh);
      instances+=entries.length;triangles+=entries.length*(source.index?.count??source.attributes.position.count)/3;
    }
    return {batches:this.groups.size,detailInstances:instances,triangles};
  }
}

/** Rectangle/rectangle separating-axis test, including corners and tangency.
 * Full footprints matter: checking only the module centre hides portal edges. */
export function architecturalRectOverlapsPortal(rect,portal,padding=.16){
  if(Math.abs(rect.normal.dot(portal.normal))<.985)return false;
  const delta=portal.center.clone().sub(rect.center);
  if(Math.abs(delta.dot(rect.normal))>.30)return false;
  for(const axis of [rect.right,rect.up,portal.right,portal.up]){
    const a=Math.abs(axis.dot(rect.right))*rect.halfWidth+Math.abs(axis.dot(rect.up))*rect.halfHeight;
    const b=Math.abs(axis.dot(portal.right))*(portal.halfWidth+padding)+Math.abs(axis.dot(portal.up))*(portal.halfHeight+padding);
    if(Math.abs(delta.dot(axis))>a+b)return false;
  }
  return true;
}

/** Clip around the projected portal frame. Conservatively bounding a rotated
 * portal creates a safe rectangular reveal, never a skin over its aperture. */
export function clipArchitecturalRect(rect,frame,portals){
  let pieces=[rect];
  for(const portal of portals){
    const center=frame.center.clone().addScaledVector(frame.right,(rect.x0+rect.x1)/2).addScaledVector(frame.up,(rect.y0+rect.y1)/2);
    if(!architecturalRectOverlapsPortal({...frame,center,halfWidth:(rect.x1-rect.x0)/2,halfHeight:(rect.y1-rect.y0)/2},portal))continue;
    const delta=portal.center.clone().sub(frame.center);
    const px=delta.dot(frame.right),py=delta.dot(frame.up);
    const rw=Math.abs(frame.right.dot(portal.right))*(portal.halfWidth+.16)+Math.abs(frame.right.dot(portal.up))*(portal.halfHeight+.16);
    const rh=Math.abs(frame.up.dot(portal.right))*(portal.halfWidth+.16)+Math.abs(frame.up.dot(portal.up))*(portal.halfHeight+.16);
    const next=[];
    for(const p of pieces){
      const x0=Math.max(p.x0,px-rw),x1=Math.min(p.x1,px+rw),y0=Math.max(p.y0,py-rh),y1=Math.min(p.y1,py+rh);
      if(x0>=x1||y0>=y1){next.push(p);continue;}
      if(p.x0<x0)next.push({...p,x1:x0});if(x1<p.x1)next.push({...p,x0:x1});
      if(p.y0<y0)next.push({x0,x1,y0:p.y0,y1:y0});if(y1<p.y1)next.push({x0,x1,y0:y1,y1:p.y1});
    }
    pieces=next;
  }
  return pieces.filter(p=>p.x1-p.x0>.12&&p.y1-p.y0>.12);
}
