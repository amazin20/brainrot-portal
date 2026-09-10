import * as THREE from 'three';

/** Room-local static batching. Collision/aim/support meshes retain their exact
 * transforms; only their redundant render submissions are replaced. Moving
 * decks and portal anchors are deliberately never merged or detached. */
export function finishCounterweightArchitecture(level){
 const w=level.world,root=w.root,batches=new Map(),matrix=new THREE.Matrix4(),tint=new THREE.Color();
 root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert();
 const cube=new THREE.BoxGeometry(1,1,1);
 const add=(geometry,material,transform,color)=>{
  const key=geometry.uuid+':'+material.uuid;
  if(!batches.has(key))batches.set(key,{geometry,material,items:[]});
  batches.get(key).items.push({matrix:transform.clone(),color:color.clone()});
 };
 let originals=0,instances=0;
 for(const s of w.surfaces){
  if(s.collider.kinematic||s.group.parent!==root)continue;
  for(const mesh of s.group.children){
   if(!mesh.isInstancedMesh||!mesh.visible||Array.isArray(mesh.material))continue;
   for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,matrix);matrix.premultiply(mesh.matrixWorld).premultiply(inverse);
    tint.setHex(0xffffff);if(mesh.instanceColor)mesh.getColorAt(i,tint);
    add(mesh.geometry,mesh.material,matrix,tint);instances++;
   }
   mesh.visible=false;originals++;
  }
  const backing=s.backing;
  if(backing?.visible&&backing.geometry?.type==='BoxGeometry'){
   const {width,height,depth}=backing.geometry.parameters;
   matrix.copy(backing.matrixWorld).premultiply(inverse).multiply(new THREE.Matrix4().makeScale(width,height,depth));
   add(cube,backing.material,matrix,tint.setHex(0xffffff));backing.visible=false;originals++;
  }
 }
 const group=new THREE.Group();group.name='Counterweight static render batches';group.userData.visualOnly=true;root.add(group);
 for(const {geometry,material,items} of batches.values()){
  const mesh=new THREE.InstancedMesh(geometry,material,items.length);mesh.name='Batched ceramic or structural modules';mesh.receiveShadow=true;
  items.forEach((item,i)=>{mesh.setMatrixAt(i,item.matrix);mesh.setColorAt(i,item.color);});
  mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);
 }
 // Seamed casing panels follow real box faces. They are graphite, not extra
 // portal targets. There is no added collider and no seam-shaped collision.
 const cases=[];const mat=new THREE.MeshStandardMaterial({color:0x87938d,roughness:.8,metalness:.12});
 for(const c of w.game.colliders){
  const mesh=c.mesh,p=mesh.geometry?.parameters;
  if(c.kinematic||mesh.parent!==root||!p||p.height<2||p.width<.2||p.depth<.2||Math.max(p.width,p.depth)<4)continue;
  for(const [axis,length,thickness] of [['x',p.depth,p.width],['z',p.width,p.depth]]){
   if(length<3||thickness<.2)continue;
   const cols=Math.ceil(length/2.5),rows=Math.ceil(p.height/2.5),cw=length/cols,ch=p.height/rows;
   for(const sign of [-1,1])for(let x=0;x<cols;x++)for(let y=0;y<rows;y++){
    const at=new THREE.Vector3(),scale=new THREE.Vector3();
    at[axis]=sign*(thickness/2+.003);at[axis==='x'?'z':'x']=-length/2+cw*(x+.5);at.y=-p.height/2+ch*(y+.5);
    scale.set(axis==='x'?.004:cw-.035,ch-.035,axis==='z'?.004:cw-.035);
    const m=new THREE.Matrix4().compose(at,new THREE.Quaternion(),scale).premultiply(mesh.matrixWorld).premultiply(inverse);cases.push(m);
   }
  }
 }
 if(cases.length){const mesh=new THREE.InstancedMesh(cube,mat,cases.length);mesh.name='Seamed counterweight casings';mesh.receiveShadow=true;cases.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingSphere();group.add(mesh);}
 level.renderBatching={sourceDraws:originals,batches:batches.size,instances,casingPanels:cases.length};
 return level;
}
