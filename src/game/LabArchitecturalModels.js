import * as THREE from 'three';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

/** A folded sheet-metal cassette, with clipped corners and an actual bevel.
 * Forty-eight triangles replace the tessellated sculpted tile. Normals are
 * split at the folds; the broad face stays flat under grazing light. */
export function architecturalCassetteGeometry(){
  const points=[[-.465,-.5],[.465,-.5],[.5,-.465],[.5,.465],[.465,.5],[-.465,.5],[-.5,.465],[-.5,-.465]];
  const ring=(z,inset=0)=>points.map(([x,y])=>[x*(1-inset*2),y*(1-inset*2),z]);
  const back=ring(-.5),shoulder=ring(.1),front=ring(.5,.012),vertices=[],uv=[];
  const tri=(a,b,c)=>{for(const p of [a,b,c]){vertices.push(...p);uv.push(p[0]+.5,p[1]+.5);}};
  for(let i=0;i<8;i++){
    const j=(i+1)%8;
    tri([0,0,.5],front[i],front[j]);tri([0,0,-.5],back[j],back[i]);
    tri(back[i],back[j],shoulder[j]);tri(back[i],shoulder[j],shoulder[i]);
    tri(shoulder[i],shoulder[j],front[j]);tri(shoulder[i],front[j],front[i]);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.name='Folded architectural cassette / 48 triangles';return geometry;
}

export function architecturalMaterials(accent){
  // Low-amplitude roughness variation, with no high-frequency normal noise.
  // Coated sheet is dielectric: the previous metallic black shell relied on
  // an environment map that the game does not have, and lost its midtones.
  const data=new Uint8Array(64*64*4);let seed=1907;
  for(let i=0;i<data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const value=244+(seed%9);data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;}
  const roughness=new THREE.DataTexture(data,64,64,THREE.RGBAFormat);
  roughness.wrapS=roughness.wrapT=THREE.RepeatWrapping;roughness.colorSpace=THREE.NoColorSpace;roughness.needsUpdate=true;
  const coat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.68,metalness:.08,roughnessMap:roughness});
  const frame=new THREE.MeshStandardMaterial({color:0x46555c,roughness:.58,metalness:.18});
  const steel=new THREE.MeshStandardMaterial({color:0x9ca8ab,roughness:.42,metalness:.36});
  const recess=new THREE.MeshStandardMaterial({color:0x293940,roughness:.84,metalness:.04});
  const lamp=new THREE.MeshBasicMaterial({color:accent??0xaddfe2,toneMapped:true});
  coat.addEventListener('dispose',()=>roughness.dispose());
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
