import * as THREE from 'three';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const Z=V(0,0,1);

function tuneMaterial(source){
  const m=source?.clone?.()??new THREE.MeshStandardMaterial({color:0xa8afb1});
  if('roughness' in m)m.roughness=THREE.MathUtils.clamp(m.roughness??.62,.34,.72);
  if('metalness' in m)m.metalness=THREE.MathUtils.clamp(m.metalness??.08,.04,.34);
  if('envMapIntensity' in m)m.envMapIntensity=1.15;
  if(m.color)m.color.multiplyScalar(1.08);
  if(m.map)m.map.anisotropy=Math.max(4,m.map.anisotropy||1);
  return m;
}

function overlapsPortal(level,center,normal){
  for(const panel of Object.values(level.panels||{})){
    if(!panel?.getFrame)continue;
    const f=panel.getFrame(),alignment=Math.abs(normal.dot(f.normal));
    if(alignment<.985)continue;
    const rel=center.clone().sub(f.center),plane=Math.abs(rel.dot(f.normal));
    if(plane>.28)continue;
    if(Math.abs(rel.dot(f.right))<f.halfWidth+.38&&Math.abs(rel.dot(f.up))<f.halfHeight+.38)return true;
  }
  return false;
}

/**
 * Skins the large collision-safe structural masses with the repository's real
 * optimized wall-panel GLB (asset 24). Collision, portal targets, floor records
 * and the authored room coordinates are never touched. Panels are batched into
 * one InstancedMesh per source submesh, so thousands of visible modules do not
 * become thousands of draw calls.
 */
function addRealPanelCladding(level,root){
  const w=level.world,g=level.game||w.game;
  if(!g.assets?.has(24))return {instances:0,batches:0,sourceBoxes:0};
  const template=w.template(24);if(!template?.length)return {instances:0,batches:0,sourceBoxes:0};
  const buckets=template.map(()=>[]),materials=template.map(part=>tuneMaterial(part.material));
  const rootInv=w.root.matrixWorld.clone().invert(),normalMatrix=new THREE.Matrix3(),q=new THREE.Quaternion(),scale=new THREE.Vector3(),pos=new THREE.Vector3();
  let instances=0,sourceBoxes=0;
  w.root.updateWorldMatrix(true,true);
  const facesFor=p=>[
    {axis:'z',sign:1,width:p.width,height:p.height,offset:p.depth/2-.038,rotation:0},
    {axis:'z',sign:-1,width:p.width,height:p.height,offset:-p.depth/2+.038,rotation:Math.PI},
    {axis:'x',sign:1,width:p.depth,height:p.height,offset:p.width/2-.038,rotation:Math.PI/2},
    {axis:'x',sign:-1,width:p.depth,height:p.height,offset:-p.width/2+.038,rotation:-Math.PI/2},
  ];
  for(const collider of g.colliders){
    const mesh=collider.mesh,p=mesh?.geometry?.parameters;
    if(!mesh?.visible||mesh.userData?.collisionProxy||collider.kinematic||!p||![p.width,p.height,p.depth].every(Number.isFinite))continue;
    // Thin rails, ledges and already-detailed props keep their own shape.
    if(p.height<1.5||Math.max(p.width,p.depth)<2.5)continue;
    mesh.updateWorldMatrix(true,false);normalMatrix.getNormalMatrix(mesh.matrixWorld);sourceBoxes++;
    for(const face of facesFor(p)){
      if(face.width<1.2||face.height<1.4)continue;
      const cols=Math.max(1,Math.ceil(face.width/2.65)),rows=Math.max(1,Math.ceil(face.height/2.65));
      const cw=face.width/cols,ch=face.height/rows;
      q.setFromAxisAngle(V(0,1,0),face.rotation);
      for(let ix=0;ix<cols;ix++)for(let iy=0;iy<rows;iy++){
        const horizontal=-face.width/2+cw*(ix+.5),vertical=-face.height/2+ch*(iy+.5);
        if(face.axis==='z')pos.set(horizontal,vertical,face.offset);else pos.set(face.offset,vertical,-horizontal*face.sign);
        const worldCenter=pos.clone().applyMatrix4(mesh.matrixWorld);
        const localNormal=face.axis==='z'?V(0,0,face.sign):V(face.sign,0,0),worldNormal=localNormal.applyMatrix3(normalMatrix).normalize();
        if(overlapsPortal(level,worldCenter,worldNormal))continue;
        scale.set(cw-.055,ch-.055,.08);
        const local=new THREE.Matrix4().compose(pos,q,scale),base=rootInv.clone().multiply(mesh.matrixWorld).multiply(local);
        template.forEach((part,i)=>buckets[i].push(base.clone().multiply(part.matrix)));
        instances++;
      }
    }
  }
  buckets.forEach((matrices,i)=>{
    if(!matrices.length)return;
    const mesh=new THREE.InstancedMesh(template[i].geometry,materials[i],matrices.length);
    mesh.name='Real GLB structural panel cladding';mesh.userData.visualOnly=true;mesh.receiveShadow=true;
    matrices.forEach((m,j)=>mesh.setMatrixAt(j,m));mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
  });
  return {instances,batches:buckets.filter(b=>b.length).length,sourceBoxes};
}

function addLighting(level,root){
  const b=level.bounds||level.workshop?.bounds||{minX:-20,maxX:20,minZ:-20,maxZ:20};
  const ceiling=level.workshop?.ceiling??level.ceiling??24,cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2;
  const ambient=new THREE.AmbientLight(0xdde8ea,.72);ambient.name='Soft industrial bounce';root.add(ambient);
  const hemi=new THREE.HemisphereLight(0xeaf4f4,0x1b242a,1.05);hemi.name='Ceiling bounce';root.add(hemi);
  const key=new THREE.DirectionalLight(0xfff2d6,1.05);key.name='Warm service key';key.position.set(cx-8,ceiling-2,cz+7);key.castShadow=false;
  const target=new THREE.Object3D();target.position.set(cx,Math.max(4,ceiling*.38),cz);root.add(target);key.target=target;root.add(key);
  const accent=level.spec?.accent??0x88d9df;
  const points=[[-.23,.34],[.28,-.21]].map(([dx,dz],i)=>{
    const light=new THREE.PointLight(accent,i?5.5:6.5,18,2);light.name='Mechanism readability fill';light.position.set(THREE.MathUtils.lerp(b.minX,b.maxX,.5+dx),ceiling*.48,THREE.MathUtils.lerp(b.minZ,b.maxZ,.5+dz));light.castShadow=false;root.add(light);return light;
  });
  return {ambient,hemi,key,points};
}

function brightenBackings(level){
  const w=level.world,m=w.root.userData.browserArtMaterials;
  if(m){
    m.graphite.color.setHex(0x3b4650);m.steel.color.setHex(0x77858d);m.blackSteel.color.setHex(0x202931);m.ceramic.color.setHex(0xf7f3e9);
    for(const mat of [m.graphite,m.steel,m.blackSteel]){if('emissive' in mat){mat.emissive.setHex(0x10171b);mat.emissiveIntensity=.12;}mat.needsUpdate=true;}
    m.ceramic.needsUpdate=true;
  }
  if(w.materials.wall?.color){w.materials.wall.color.setHex(0x3f4a52);w.materials.wall.emissive?.setHex(0x11191e);w.materials.wall.emissiveIntensity=.14;w.materials.wall.needsUpdate=true;}
  if(w.materials.floor?.color){w.materials.floor.color.setHex(0x59656b);w.materials.floor.emissive?.setHex(0x12191c);w.materials.floor.emissiveIntensity=.09;w.materials.floor.needsUpdate=true;}
  if(w.materials.trim?.color){w.materials.trim.color.setHex(0x26313a);w.materials.trim.needsUpdate=true;}
  level.game.scene.background=new THREE.Color(0x19232a);
  if(level.game.scene.fog)level.game.scene.fog.color.setHex(0x19232a);
}

function addServiceBands(level,root){
  const b=level.bounds||level.workshop?.bounds;if(!b)return 0;
  const mat=new THREE.MeshStandardMaterial({color:0x2a343c,metalness:.62,roughness:.4}),lamp=new THREE.MeshBasicMaterial({color:level.spec?.accent??0x8fdde2});
  const geom=new THREE.BoxGeometry(1,1,1),items=[];
  const add=(p,s,m)=>items.push({p,s,m});
  const y=(level.workshop?.ceiling??level.ceiling??24)*.72;
  for(const x of [b.minX+.16,b.maxX-.16])for(let z=b.minZ+2;z<b.maxZ-2;z+=5.2){add([x,y,z],[.11,.42,3.4],mat);add([x+(x<0?.06:-.06),y,z],[.018,.07,2.5],lamp);}
  for(const z of [b.minZ+.16,b.maxZ-.16])for(let x=b.minX+2;x<b.maxX-2;x+=5.2){add([x,y-.75,z],[3.4,.42,.11],mat);add([x,y-.75,z+(z<0?.06:-.06)],[2.5,.07,.018],lamp);}
  const byMat=new Map();for(const item of items){if(!byMat.has(item.m))byMat.set(item.m,[]);byMat.get(item.m).push(item);}
  for(const [material,list] of byMat){const im=new THREE.InstancedMesh(geom,material,list.length),matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),p=new THREE.Vector3();im.name='Industrial service bands';im.userData.visualOnly=true;list.forEach((it,i)=>{matrix.compose(p.fromArray(it.p),q,s.fromArray(it.s));im.setMatrixAt(i,matrix);});im.computeBoundingSphere();root.add(im);}
  return items.length;
}

export function applyPremiumBrowser3DArt(level){
  if(!level?.world||level.index<11||level.index>14)return level;
  level.game=level.game||level.workshop?.game||level.world.game;
  brightenBackings(level);
  const root=new THREE.Group();root.name='Premium browser 3D environment layer';root.userData.visualOnly=true;root.userData.version=32;level.world.root.add(root);
  const cladding=addRealPanelCladding(level,root),serviceBands=addServiceBands(level,root);addLighting(level,root);
  root.userData.stats={...cladding,serviceBands};level.premiumBrowser3DArt=root;
  return level;
}
