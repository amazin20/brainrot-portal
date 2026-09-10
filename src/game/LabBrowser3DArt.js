import * as THREE from 'three';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const Q=new THREE.Quaternion();
const UP=V(0,1,0);

function noiseTexture(size=48,{bands=false}={}){
  const data=new Uint8Array(size*size*4);
  let seed=0x9e3779b9;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/0xffffffff;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const grain=bands?Math.sin((x+y*.16)*1.85)*18:0;
    const scratch=(x%17===0||y%23===0)?-16:0;
    const value=THREE.MathUtils.clamp(Math.round(154+(rand()-.5)*44+grain+scratch),38,230);
    data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
  }
  const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,5);t.needsUpdate=true;
  t.colorSpace=THREE.NoColorSpace;
  return t;
}

function materials(level){
  const w=level.world;
  if(w.root.userData.browserArtMaterials)return w.root.userData.browserArtMaterials;
  const ceramicNoise=noiseTexture(48),metalNoise=noiseTexture(48,{bands:true});
  const ceramic=new THREE.MeshPhysicalMaterial({color:0xf2f0e8,roughness:.42,metalness:.025,clearcoat:.24,clearcoatRoughness:.58,roughnessMap:ceramicNoise,bumpMap:ceramicNoise,bumpScale:.018});
  const graphite=new THREE.MeshStandardMaterial({color:0x252d35,roughness:.57,metalness:.48,roughnessMap:metalNoise,bumpMap:metalNoise,bumpScale:.025});
  const steel=new THREE.MeshStandardMaterial({color:0x66747c,roughness:.34,metalness:.78,roughnessMap:metalNoise,bumpMap:metalNoise,bumpScale:.014});
  const blackSteel=new THREE.MeshStandardMaterial({color:0x151b20,roughness:.42,metalness:.76,roughnessMap:metalNoise});
  const rubber=new THREE.MeshStandardMaterial({color:0x171a1c,roughness:.9,metalness:.02});
  const brass=new THREE.MeshStandardMaterial({color:0xb48750,roughness:.31,metalness:.76,roughnessMap:metalNoise});
  const hazard=new THREE.MeshStandardMaterial({color:0xd2a344,roughness:.62,metalness:.18});
  const lamp=new THREE.MeshBasicMaterial({color:level.spec?.accent??0xa8e5df,toneMapped:true});
  const glass=new THREE.MeshPhysicalMaterial({color:0x8db9c5,roughness:.12,metalness:.05,transmission:.28,transparent:true,opacity:.32,depthWrite:false,clearcoat:.9,clearcoatRoughness:.08});
  const set={ceramic,graphite,steel,blackSteel,rubber,brass,hazard,lamp,glass,textures:[ceramicNoise,metalNoise]};
  w.root.userData.browserArtMaterials=set;return set;
}

export function polishImportedModel(root,{metalBoost=.18}={}){
  const cache=new WeakMap();
  root.traverse(node=>{
    if(!node.isMesh)return;
    node.castShadow=false;node.receiveShadow=true;
    const list=Array.isArray(node.material)?node.material:[node.material];
    const converted=list.map(source=>{
      if(!source)return source;
      if(cache.has(source))return cache.get(source);
      const mat=source.clone();
      if('roughness' in mat)mat.roughness=THREE.MathUtils.clamp(mat.roughness??.65,.24,.78);
      if('metalness' in mat)mat.metalness=THREE.MathUtils.clamp((mat.metalness??0)+metalBoost,0,.92);
      if('envMapIntensity' in mat)mat.envMapIntensity=1.15;
      if(mat.map)mat.map.anisotropy=Math.max(mat.map.anisotropy||1,4);
      cache.set(source,mat);return mat;
    });
    node.material=Array.isArray(node.material)?converted:converted[0];
  });
  root.userData.visualOnly=true;return root;
}

function beam(parent,a,b,r,mat,segments=8){
  a=Array.isArray(a)?V(...a):a.clone();b=Array.isArray(b)?V(...b):b.clone();
  const d=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),segments,1,false),mat);
  mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(UP,d.clone().normalize());mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function box(parent,p,s,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(...s),mat);m.position.fromArray(p);m.receiveShadow=true;parent.add(m);return m;}
function cylinder(parent,p,r,h,mat,axis='y',segments=14){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),mat);m.position.fromArray(p);
  if(axis==='x')m.rotation.z=Math.PI/2;else if(axis==='z')m.rotation.x=Math.PI/2;m.receiveShadow=true;parent.add(m);return m;
}
function torus(parent,p,r,t,mat,axis='z',segments=24){
  const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,8,segments),mat);m.position.fromArray(p);
  if(axis==='x')m.rotation.y=Math.PI/2;else if(axis==='y')m.rotation.x=Math.PI/2;parent.add(m);return m;
}
function boltRing(parent,p,axis,r,count,mat){
  const geometry=new THREE.CylinderGeometry(.055,.055,.065,8),mesh=new THREE.InstancedMesh(geometry,mat,count),matrix=new THREE.Matrix4();
  const q=axis==='x'?new THREE.Quaternion().setFromAxisAngle(V(0,0,1),Math.PI/2):axis==='z'?new THREE.Quaternion().setFromAxisAngle(V(1,0,0),Math.PI/2):Q.identity();
  for(let i=0;i<count;i++){
    const a=i/count*Math.PI*2,pos=V(...p);
    if(axis==='x'){pos.y+=Math.cos(a)*r;pos.z+=Math.sin(a)*r;}
    else if(axis==='y'){pos.x+=Math.cos(a)*r;pos.z+=Math.sin(a)*r;}
    else{pos.x+=Math.cos(a)*r;pos.y+=Math.sin(a)*r;}
    matrix.compose(pos,q,V(1,1,1));mesh.setMatrixAt(i,matrix);
  }
  mesh.computeBoundingSphere();parent.add(mesh);return mesh;
}

function materialsFromParent(parent,accent){
  let p=parent;while(p&&!p.userData?.browserArtMaterials)p=p.parent;
  if(p?.userData?.browserArtMaterials)return p.userData.browserArtMaterials;
  const steel=new THREE.MeshStandardMaterial({color:0x66747c,roughness:.34,metalness:.78}),blackSteel=new THREE.MeshStandardMaterial({color:0x151b20,roughness:.42,metalness:.76}),rubber=new THREE.MeshStandardMaterial({color:0x171a1c,roughness:.9}),hazard=new THREE.MeshStandardMaterial({color:0xd2a344,roughness:.62,metalness:.18}),brass=new THREE.MeshStandardMaterial({color:0xb48750,roughness:.31,metalness:.76}),lamp=new THREE.MeshBasicMaterial({color:accent??0x7edee8});
  return{steel,blackSteel,rubber,hazard,brass,lamp};
}

export function addMachineFrame(parent,{width=4,depth=4,height=.75,y=-.42,accent=0x7edee8}={}){
  const m=materialsFromParent(parent,accent),root=new THREE.Group();root.name='Browser 3D machine chassis';root.userData.visualOnly=true;parent.add(root);
  const x=width/2-.14,z=depth/2-.14;
  for(const sx of [-1,1])for(const sz of [-1,1])cylinder(root,[sx*x,y,sz*z],.105,height,m.steel,'y',10);
  for(const sz of [-1,1]){beam(root,[-x,y-height/2,sz*z],[x,y-height/2,sz*z],.095,m.blackSteel);beam(root,[-x,y+height/2,sz*z],[x,y+height/2,sz*z],.075,m.steel);}
  for(const sx of [-1,1]){beam(root,[sx*x,y-height/2,-z],[sx*x,y-height/2,z],.095,m.blackSteel);beam(root,[sx*x,y+height/2,-z],[sx*x,y+height/2,z],.075,m.steel);}
  for(const sx of [-1,1])for(const sz of [-1,1])cylinder(root,[sx*x,y+height*.53,sz*z],.16,.06,m.rubber,'y',14);
  for(const sz of [-1,1])for(let i=0;i<6;i++)box(root,[-width/2+.38+i*(width-.76)/5,y-height*.48,sz*(depth/2+.005)],[.28,.055,.022],i%2?m.blackSteel:m.hazard);
  return root;
}

export function addGuideTower(parent,{x=0,z=0,height=8,baseY=0}={}){
  const m=materialsFromParent(parent),root=new THREE.Group();root.name='Browser 3D guide rail';root.userData.visualOnly=true;parent.add(root);
  for(const dx of [-.12,.12])beam(root,[x+dx,baseY,z],[x+dx,baseY+height,z],.055,m.steel,8);
  for(let y=baseY+.35;y<baseY+height;y+=.7)box(root,[x,y,z],[.42,.055,.16],m.blackSteel);
  for(let y=baseY+.7;y<baseY+height;y+=1.4){torus(root,[x,y,z],.19,.035,m.brass,'z',14);cylinder(root,[x,y,z],.055,.28,m.blackSteel,'z',8);}
  return root;
}

export function addOpticalGimbal(parent,{accent=0xffc879}={}){
  const m=materialsFromParent(parent,accent),root=new THREE.Group();root.name='Browser 3D optical gimbal';root.userData.visualOnly=true;parent.add(root);
  torus(root,[0,0,0],1.46,.10,m.steel,'z',32);torus(root,[0,0,0],1.20,.055,m.brass,'z',28);
  cylinder(root,[-1.62,0,0],.18,.36,m.blackSteel,'x',14);cylinder(root,[1.62,0,0],.18,.36,m.blackSteel,'x',14);
  for(const x of [-1.62,1.62]){box(root,[x,-1.25,0],[.52,2.25,.56],m.blackSteel);boltRing(root,[x,0,0],'x',.26,8,m.brass);}
  cylinder(root,[1.92,-.45,0],.32,.55,m.steel,'x',18);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;box(root,[1.95,-.45+Math.cos(a)*.23,Math.sin(a)*.23],[.12,.06,.12],m.blackSteel);}
  return root;
}

export function addLightProjector(world,{position,direction=[0,0,-1],radius=1.15,accent=0x7ee9ef}={}){
  const root=new THREE.Group();root.name='Browser 3D hard-light projector';root.userData.visualOnly=true;root.position.fromArray(position);root.quaternion.setFromUnitVectors(V(0,0,1),V(...direction).normalize());world.root.add(root);
  const m=materialsFromParent(world.root,accent);
  cylinder(root,[0,0,-.32],radius*1.05,.55,m.blackSteel,'z',24);torus(root,[0,0,.01],radius,.13,m.steel,'z',32);torus(root,[0,0,.09],radius*.72,.055,m.lamp,'z',32);
  cylinder(root,[0,0,.04],radius*.62,.06,m.blackSteel,'z',24);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const fin=box(root,[Math.cos(a)*radius*.78,Math.sin(a)*radius*.78,-.23],[.38,.075,.42],i%3===0?m.hazard:m.steel);fin.rotation.z=a;}
  boltRing(root,[0,0,.13],'z',radius*.91,12,m.brass);
  return root;
}

export function addFunnelEmitter(world,{position,direction=[1,0,0],radius=2.15,accent=0x7edee8}={}){
  const root=new THREE.Group();root.name='Browser 3D transfer-field turbine';root.userData.visualOnly=true;root.position.fromArray(position);root.quaternion.setFromUnitVectors(V(0,0,1),V(...direction).normalize());world.root.add(root);
  const m=materialsFromParent(world.root,accent);
  cylinder(root,[0,0,-.42],radius*1.12,.72,m.blackSteel,'z',28);torus(root,[0,0,-.02],radius*1.02,.16,m.steel,'z',36);torus(root,[0,0,.08],radius*.86,.045,m.lamp,'z',32);
  cylinder(root,[0,0,-.02],radius*.22,.65,m.brass,'z',20);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(radius*.14,radius*.22,.35,18),m.blackSteel);hub.rotation.x=Math.PI/2;hub.position.z=.18;root.add(hub);
  for(let i=0;i<12;i++){const a=i*Math.PI/6,blade=box(root,[Math.cos(a)*radius*.48,Math.sin(a)*radius*.48,.12],[radius*.58,.12,.055],m.steel);blade.rotation.z=a+.38;}
  for(let i=0;i<8;i++){const a=i*Math.PI/4,fin=box(root,[Math.cos(a)*radius*1.08,Math.sin(a)*radius*1.08,-.48],[.55,.11,.62],i%2?m.steel:m.hazard);fin.rotation.z=a;}
  boltRing(root,[0,0,.18],'z',radius*.96,16,m.brass);
  return root;
}

function enhanceWorldMaterials(level,m){
  const w=level.world;
  Object.assign(w.materials.ceramic,{color:new THREE.Color(0xf1efe8),roughness:.43,metalness:.025,roughnessMap:m.textures[0],bumpMap:m.textures[0],bumpScale:.016});
  Object.assign(w.materials.wall,{roughness:.66,metalness:.24,roughnessMap:m.textures[1],bumpMap:m.textures[1],bumpScale:.02});
  Object.assign(w.materials.floor,{roughness:.58,metalness:.20,roughnessMap:m.textures[1],bumpMap:m.textures[1],bumpScale:.012});
  Object.assign(w.materials.trim,{roughness:.38,metalness:.68,roughnessMap:m.textures[1],bumpMap:m.textures[1],bumpScale:.012});
  for(const mat of [w.materials.ceramic,w.materials.wall,w.materials.floor,w.materials.trim])mat.needsUpdate=true;
  for(const s of w.surfaces){
    const target=s.portal?m.ceramic:Math.abs(s.normal.y)>.9?m.steel:m.graphite;
    s.group.traverse(node=>{if(node.isInstancedMesh&&!node.userData.portalTile&&!s.portal)node.material=target;if(node.isInstancedMesh&&node.userData.portalTile)node.material=m.ceramic;});
    if(s.backing?.material)s.backing.material=m.blackSteel;
  }
}

function addDeckEngineering(level,root,m){
  const floors=level.world.surfaces.filter(s=>s.floor&&!s.collider.kinematic&&s.floor.y>1.5&&!/stair/i.test(s.name));
  let braces=0,lamps=0;
  for(const s of floors){
    const f=s.floor,w=f.maxX-f.minX,d=f.maxZ-f.minZ;if(w<2||d<2)continue;
    const y=f.y-.42,longX=w>=d,span=longX?w:d,count=Math.max(1,Math.min(5,Math.ceil(span/6)));
    for(let i=0;i<count;i++){
      const u=-span/2+span*(i+.5)/count;
      if(longX){
        const cx=(f.minX+f.maxX)/2+u;
        beam(root,[cx-w/count*.42,y-.15,f.minZ+.18],[cx+w/count*.42,y+.15,f.maxZ-.18],.035,m.blackSteel,6);
        beam(root,[cx-w/count*.42,y+.15,f.maxZ-.18],[cx+w/count*.42,y-.15,f.minZ+.18],.035,m.steel,6);
      }else{
        const cz=(f.minZ+f.maxZ)/2+u;
        beam(root,[f.minX+.18,y-.15,cz-d/count*.42],[f.maxX-.18,y+.15,cz+d/count*.42],.035,m.blackSteel,6);
        beam(root,[f.maxX-.18,y-.15,cz-d/count*.42],[f.minX+.18,y+.15,cz+d/count*.42],.035,m.steel,6);
      }
      braces+=2;
    }
    if(w>4.5){box(root,[(f.minX+f.maxX)/2,f.y-.31,f.minZ+.035],[Math.min(w-1,5.2),.028,.03],m.lamp);lamps++;}
  }
  return{braces,lamps};
}

function addPortalFrames(level,root,m){
  let count=0;
  for(const s of Object.values(level.panels||{})){
    if(!s?.getFrame)continue;const f=s.getFrame(),pad=.18,depth=.08;
    const group=new THREE.Group();group.name=`Portal machinery frame / ${s.name}`;group.userData.visualOnly=true;root.add(group);
    const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.right,f.up,f.normal));group.quaternion.copy(q);group.position.copy(f.center).addScaledVector(f.normal,-.12);
    const w=f.halfWidth*2,h=f.halfHeight*2;
    for(const x of [-w/2-pad,w/2+pad])box(group,[x,0,0],[.18,h+.5,depth],m.steel);
    for(const y of [-h/2-pad,h/2+pad])box(group,[0,y,0],[w+.5,.18,depth],m.blackSteel);
    for(const sx of [-1,1])for(const sy of [-1,1])cylinder(group,[sx*(w/2+.18),sy*(h/2+.18),.02],.075,.07,m.brass,'z',8);
    count++;
  }
  return count;
}

function addShellConduits(level,root,m){
  const b=level.bounds||level.workshop?.bounds;if(!b)return 0;const top=(level.workshop?.ceiling??level.ceiling??20)-1.1;
  const paths=[[V(b.minX+.18,top,b.minZ+2),V(b.minX+.18,top,b.maxZ-2)],[V(b.maxX-.18,top-.65,b.minZ+3),V(b.maxX-.18,top-.65,b.maxZ-3)]];
  let count=0;
  for(const [a,z] of paths)for(let o=-1;o<=1;o++){
    const off=V(a.x===z.x?0:o*.11,o*.06,a.z===z.z?0:o*.11);beam(root,a.clone().add(off),z.clone().add(off),.032,o===0?m.brass:m.blackSteel,7);count++;
  }
  return count;
}

function imported(level,id,size,position,yaw=0){
  if(!level.game?.assets?.has(id))return null;
  const art=polishImportedModel(level.game.model(id,size));art.position.fromArray(position);art.rotation.y=yaw;art.name=`Browser 3D imported mechanism ${id}`;level.world.root.add(art);return art;
}

function fitBelowSurface(art,surface,gap=.04){
  if(!art||!surface)return;
  art.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(art),h=b.max.y-b.min.y;
  art.position.copy(surface.getFrame().center);art.position.y-=h+gap;
}

function addRoomMechanisms(level,m){
  if(level.index===12){
    for(const name of ['north-cage','south-cage']){
      const surface=level.world.surfaces.find(s=>s.name===name);if(!surface)continue;
      const art=polishImportedModel(level.game.model(19,4.25));art.name=`${name} / real lift chassis`;art.updateWorldMatrix(true,true);
      const b=new THREE.Box3().setFromObject(art);art.position.y=-b.max.y-.08;surface.group.add(art);addMachineFrame(surface.group,{width:4,depth:4,height:.62,y:-.34,accent:level.spec?.accent});
    }
    const pad=level.panels?.['mirror-cradle'];if(pad){const art=polishImportedModel(level.game.model(29,4.15));art.name='mirror cradle / real pressure mechanism';art.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(art);art.position.y=-b.max.y-.04;pad.group.add(art);}
    const gimbal=new THREE.Group();gimbal.position.set(-10,8,0);level.world.root.add(gimbal);addOpticalGimbal(gimbal,{accent:level.spec?.accent});
    for(const z of [-11,11])for(const x of [-12.3,-7.7])addGuideTower(level.world.root,{x,z,height:7,baseY:5.5});
  }
  if(level.index===13){
    const bridge=imported(level,37,3.4,[-10,4.65,-6.6],0);if(bridge)bridge.rotation.x=.04;
  }
  if(level.index===14){
    imported(level,31,4.25,[-17,.35,14],-Math.PI/2);
    const turbine=imported(level,35,2.75,[-16.8,.55,14],-Math.PI/2);if(turbine)turbine.scale.multiplyScalar(.92);
    addFunnelEmitter(level.world,{position:[-17,1.9,14],direction:[1,0,0],radius:2.15,accent:level.spec?.accent});
  }
}

export function upgradeBrowser3DArt(level){
  if(!level?.world||level.index<11||level.index>14)return level;
  level.game=level.game||level.workshop?.game;
  const m=materials(level);enhanceWorldMaterials(level,m);
  const root=new THREE.Group();root.name='Browser 3D artist environment pass';root.userData.visualOnly=true;root.userData.version=31;level.world.root.add(root);
  const deck=addDeckEngineering(level,root,m),portalFrames=addPortalFrames(level,root,m),conduits=addShellConduits(level,root,m);
  if(level.index===11){addLightProjector(level.world,{position:[-10,18,13.7],direction:[0,0,-1],radius:.58,accent:level.spec?.accent});addLightProjector(level.world,{position:[9,9.4,-8.6],direction:[0,0,-1],radius:.52,accent:level.spec?.accent});}
  if(level.index===13)addLightProjector(level.world,{position:[-10,5.1,-7],direction:[0,0,-1],radius:1.1,accent:level.spec?.accent});
  addRoomMechanisms(level,m);
  root.userData.stats={deckBraces:deck.braces,deckLamps:deck.lamps,portalFrames,conduits};level.browser3DArt=root;return level;
}
