import * as THREE from 'three';

/** Batch only immutable, non-interactive surface finishes. The original
 * collision/aim meshes, authored frames and moving surfaces retain identity.
 * Spatial buckets keep distant stairs independently culled in portal views. */
export function batchStaticSurfaceFinishes(level, {cellSize=4}={}) {
  if (!level?.world || level.staticSurfaceBatches) return level;
  const world=level.world, game=level.game??world.game;
  const protectedMeshes=new Set([
    ...(game.colliders??[]).map(c=>c.mesh), ...(game.cameraBlockers??[]),
    ...(game.aimBlockers??[]), ...(game.portalPanels??[]),
  ]);
  world.root.updateWorldMatrix(true,true);
  const inverse=world.root.matrixWorld.clone().invert(), groups=new Map();
  const unitBox=new THREE.BoxGeometry(1,1,1), local=new THREE.Matrix4();
  const point=new THREE.Vector3();
  for (const surface of world.surfaces) {
    if (surface.portal || surface.collider?.kinematic || !surface.group.visible || surface.group.parent!==world.root
      || surface.group.userData.keepMaterial) continue;
    const meshes=[surface.backing,...surface.group.children.filter(n=>n.isInstancedMesh)];
    for (const mesh of meshes) {
      if (!mesh?.visible || protectedMeshes.has(mesh) || Array.isArray(mesh.material)
        || mesh.material?.transparent || mesh.material?.visible===false) continue;
      // Keep detailed imported treads independently culled. Combining their
      // bounds saves a draw but submits thousands of hidden vertices whenever
      // any neighbouring step enters the camera. Cheap backings benefit most.
      const triangles=(mesh.geometry.index?.count??mesh.geometry.attributes.position?.count??0)/3;
      if(mesh.isInstancedMesh&&triangles>256)continue;
      const p=mesh.geometry.parameters;
      const simpleBox=mesh.geometry.type==='BoxGeometry'&&p.widthSegments===1&&p.heightSegments===1&&p.depthSegments===1;
      const geometry=simpleBox?unitBox:mesh.geometry;
      local.multiplyMatrices(inverse,mesh.matrixWorld);
      point.setFromMatrixPosition(local);
      const cell=[point.x,point.y,point.z].map(x=>Math.floor(x/cellSize)).join('/');
      const key=[geometry.uuid,mesh.material.uuid,cell,mesh.castShadow,mesh.receiveShadow,mesh.renderOrder,mesh.layers.mask].join(':');
      if (!groups.has(key)) groups.set(key,{geometry,material:mesh.material,sources:[]});
      groups.get(key).sources.push({mesh,matrix:local.clone(),box:simpleBox?p:null});
    }
  }
  const root=new THREE.Group();root.name='Spatially batched static surface finishes';
  root.userData.visualOnly=true;world.root.add(root);
  const stats={sourceDraws:0,batches:0,instances:0,savedDraws:0,cellSize};
  const matrix=new THREE.Matrix4(),instance=new THREE.Matrix4(),scale=new THREE.Matrix4(),white=new THREE.Color(0xffffff),color=new THREE.Color();
  let usesBox=false;
  for (const {geometry,material,sources} of groups.values()) {
    if (sources.length<2) continue;
    const count=sources.reduce((n,{mesh})=>n+(mesh.isInstancedMesh?mesh.count:1),0);
    if (!count) continue;
    const first=sources[0].mesh,batch=new THREE.InstancedMesh(geometry,material,count);
    batch.name='Static surface finish batch';batch.userData.visualOnly=true;
    batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;
    batch.renderOrder=first.renderOrder;batch.layers.mask=first.layers.mask;
    const colored=sources.some(({mesh})=>mesh.instanceColor);let index=0;
    for (const {mesh,matrix:base,box} of sources) {
      const n=mesh.isInstancedMesh?mesh.count:1;
      for(let i=0;i<n;i++) {
        matrix.copy(base);
        if(mesh.isInstancedMesh){mesh.getMatrixAt(i,instance);matrix.multiply(instance);}
        if(box){scale.makeScale(box.width,box.height,box.depth);matrix.multiply(scale);}
        batch.setMatrixAt(index,matrix);
        if(colored){if(mesh.instanceColor)mesh.getColorAt(i,color);else color.copy(white);batch.setColorAt(index,color);}
        index++;
      }
      mesh.visible=false;mesh.userData.staticBatchSource=true;
      // Preserve source geometry for level ownership and authored inspections.
      mesh.updateMatrix();mesh.matrixAutoUpdate=false;
    }
    batch.computeBoundingBox();batch.computeBoundingSphere();batch.matrixAutoUpdate=false;
    root.add(batch);usesBox ||= geometry===unitBox;
    stats.sourceDraws+=sources.length;stats.batches++;stats.instances+=count;
  }
  if(!usesBox)unitBox.dispose();
  stats.savedDraws=stats.sourceDraws-stats.batches;
  root.userData.stats=stats;level.staticSurfaceBatches=root;
  return level;
}
