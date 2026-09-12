import * as THREE from 'three';
import {createMachinedProjector,createMachinedTurbine,createMachinedChassis,createMachinedGimbal} from './LabMachinedModels.js';

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
  const ceramic=new THREE.MeshPhysicalMaterial({color:0xf2f0e8,roughness:.42,metalness:.025,clearcoat:.24,clearcoatRoughness:.58,roughnessMap:ceramicNoise,bumpMap:ceramicNoise,bumpScale:.0015});
  const graphite=new THREE.MeshStandardMaterial({color:0x252d35,roughness:.57,metalness:.48,roughnessMap:metalNoise,bumpMap:metalNoise,bumpScale:.003});
  const steel=new THREE.MeshStandardMaterial({color:0x66747c,roughness:.34,metalness:.78,roughnessMap:metalNoise,bumpMap:metalNoise,bumpScale:.002});
  const blackSteel=new THREE.MeshStandardMaterial({color:0x151b20,roughness:.42,metalness:.76,roughnessMap:metalNoise});
  const rubber=new THREE.MeshStandardMaterial({color:0x171a1c,roughness:.9,metalness:.02});
  const brass=new THREE.MeshStandardMaterial({color:0xb48750,roughness:.31,metalness:.76,roughnessMap:metalNoise});
  const hazard=new THREE.MeshStandardMaterial({color:0xd2a344,roughness:.62,metalness:.18});
  const lamp=new THREE.MeshBasicMaterial({color:level.spec?.accent??0xa8e5df,toneMapped:true});
  const glass=new THREE.MeshPhysicalMaterial({color:0x8db9c5,roughness:.12,metalness:.05,transmission:.28,transparent:true,opacity:.32,depthWrite:false,clearcoat:.9,clearcoatRoughness:.08});
  const set={ceramic,graphite,steel,blackSteel,rubber,brass,hazard,lamp,glass,textures:[ceramicNoise,metalNoise]};
  // The level lifecycle owns generated materials, but deliberately leaves
  // shared GLB textures alone. These two procedural maps belong to this level.
  let texturesDisposed=false;
  ceramic.addEventListener('dispose',()=>{
    if(texturesDisposed)return;texturesDisposed=true;
    for(const texture of set.textures)texture.dispose();
  });
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

export function addMachineFrame(parent,options={}){
  const root=createMachinedChassis(options);root.name='Browser 3D machine chassis';parent.add(root);return root;
}

export function addGuideTower(parent,{x=0,z=0,height=8,baseY=0}={}){
  const m=materialsFromParent(parent),root=new THREE.Group();root.name='Browser 3D guide rail';root.userData.visualOnly=true;parent.add(root);
  for(const dx of [-.12,.12])beam(root,[x+dx,baseY,z],[x+dx,baseY+height,z],.055,m.steel,8);
  for(let y=baseY+.35;y<baseY+height;y+=.7)box(root,[x,y,z],[.42,.055,.16],m.blackSteel);
  for(let y=baseY+.7;y<baseY+height;y+=1.4){torus(root,[x,y,z],.19,.035,m.brass,'z',14);cylinder(root,[x,y,z],.055,.28,m.blackSteel,'z',8);}
  return root;
}

export function addOpticalGimbal(parent,options={}){
  const root=createMachinedGimbal(options);root.name='Browser 3D optical gimbal';parent.add(root);return root;
}

export function addLightProjector(world,{position,direction=[0,0,-1],radius=1.15,accent=0x7ee9ef}={}){
  const root=createMachinedProjector({radius,accent});root.name='Browser 3D hard-light projector';
  root.position.fromArray(position);root.quaternion.setFromUnitVectors(V(0,0,1),V(...direction).normalize());world.root.add(root);return root;
}

export function addFunnelEmitter(world,{position,direction=[1,0,0],radius=2.15,accent=0x7edee8}={}){
  const root=createMachinedTurbine({radius,accent});root.name='Browser 3D transfer-field turbine';
  root.position.fromArray(position);root.quaternion.setFromUnitVectors(V(0,0,1),V(...direction).normalize());world.root.add(root);return root;
}

function enhanceWorldMaterials(level,m){
  const w=level.world;
  // Keep one canonical ceramic for authored tiles and any later moving panel.
  // Changing only existing tile meshes leaves world.materials.ceramic stale.
  const previousCeramic=w.materials.ceramic;
  w.materials.ceramic=m.ceramic;
  w.root.traverse(node=>{
    if(!node.isMesh)return;
    if(Array.isArray(node.material))node.material=node.material.map(mat=>mat===previousCeramic?m.ceramic:mat);
    else if(node.material===previousCeramic)node.material=m.ceramic;
  });
  if(previousCeramic!==m.ceramic)previousCeramic.dispose();
  Object.assign(w.materials.ceramic,{color:new THREE.Color(0xf1efe8),roughness:.43,metalness:.025,roughnessMap:m.textures[0],bumpMap:m.textures[0],bumpScale:.0015});
  Object.assign(w.materials.wall,{roughness:.66,metalness:.24,roughnessMap:m.textures[1],bumpMap:m.textures[1],bumpScale:.003});
  Object.assign(w.materials.floor,{roughness:.58,metalness:.20,roughnessMap:m.textures[1],bumpMap:m.textures[1],bumpScale:.002});
  Object.assign(w.materials.trim,{roughness:.38,metalness:.68,roughnessMap:m.textures[1],bumpMap:m.textures[1],bumpScale:.002});
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
    const group=new THREE.Group();group.name=`Portal machinery frame / ${s.name}`;group.userData.visualOnly=true;s.group.add(group);
    // A surface's local XY plane is the usable aperture. Parenting the frame
    // here follows lift travel, pressure-plate depression and panel rotation.
    group.position.z=-.12;
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
  art.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(art);
  // Imported models are Y-up; the surface plane uses +Z for its normal.
  // Place their highest point behind the plane before attaching to the deck.
  art.quaternion.setFromUnitVectors(UP,V(0,0,1));
  art.position.set(0,0,-b.max.y-gap);
  surface.group.add(art);
}

function addRoomMechanisms(level,m){
  if(level.index===12){
    for(const name of ['north-cage','south-cage']){
      const surface=level.world.surfaces.find(s=>s.name===name);if(!surface)continue;
      const art=polishImportedModel(level.game.model(19,4.25));art.name=`${name} / real lift chassis`;fitBelowSurface(art,surface,.08);
      const frame=addMachineFrame(surface.group,{width:4,depth:4,height:.62,y:-.40,accent:level.spec?.accent});
      frame.quaternion.setFromUnitVectors(UP,V(0,0,1));
    }
    const pad=level.panels?.['mirror-cradle'];if(pad){const art=polishImportedModel(level.game.model(29,4.15));art.name='mirror cradle / real pressure mechanism';fitBelowSurface(art,pad);}
    // The authored bezel belongs to the existing optical pivot: it follows the
    // same spring-driven mirror angle without writing to the mechanical state.
    let mirrorPivot=null;
    level.world.root.traverse(node=>{
      const p=node.geometry?.parameters;
      if(node.isMesh&&p?.width===.11&&p.height===2.4&&p.depth===2.2)mirrorPivot=node.parent;
    });
    if(mirrorPivot){
      const gimbal=addOpticalGimbal(level.world.root,{accent:level.spec?.accent});
      gimbal.position.copy(mirrorPivot.position);gimbal.rotation.y=Math.PI/2;
      const ring=gimbal.getObjectByName('optical-ring');
      if(ring){ring.removeFromParent();ring.userData.source='src/game/LabMachinedModels.js';ring.rotation.y=Math.PI/2;mirrorPivot.add(ring);}
    }
    addLightProjector(level.world,{position:[14,8,-12],direction:[1,0,0],radius:.44,accent:level.spec?.accent});
    for(const z of [-11,11])for(const x of [-12.3,-7.7])addGuideTower(level.world.root,{x,z,height:7,baseY:5.5});
  }
  if(level.index===13){
    const bridge=imported(level,37,3.4,[-10,4.65,-6.6],0);if(bridge)bridge.rotation.x=.04;
  }
  if(level.index===14){
    const housing=addFunnelEmitter(level.world,{position:[-17,1.9,14],direction:[1,0,0],radius:2.15,accent:level.spec?.accent});
    const field=level.workshop?.state.funnel;
    if(field){
      // Replace the old opaque shell only in rendering. Its existing physical
      // backplate and every blocker registration remain unchanged.
      const shellMaterial=field.housing.material.clone();shellMaterial.visible=false;field.housing.material=shellMaterial;
      const rotor=housing.getObjectByName('transfer-rotor');
      const signals=new Set();housing.traverse(n=>{if(n.isMesh&&n.material?.name==='Recessed signal glass')signals.add(n.material);});
      let angle=0,speed=0,previous=0;
      level.workshop.ticks.push(dt=>{
        previous=angle;const target=field.enabled?(field.reversed?-2.4:2.4):0;
        const decay=Math.exp(-Math.max(0,dt)*3.5);
        angle+=target*dt+(speed-target)*(1-decay)/3.5;
        speed=target+(speed-target)*decay;
      });
      level.workshop.renders.push((alpha=1)=>{
        if(rotor)rotor.rotation.z=THREE.MathUtils.lerp(previous,angle,alpha);
        for(const material of signals){
          material.emissive?.setHex(field.reversed?0xf5ad75:0x7edee8);
          material.color.setHex(field.reversed?0xf5ad75:0x7edee8);
        }
      });
      level.workshop.resets.push(()=>{angle=previous=speed=0;if(rotor)rotor.rotation.z=0;});
    }
  }
}

export function upgradeBrowser3DArt(level){
  if(!level?.world||level.index<11||level.index>14)return level;
  level.game=level.game||level.workshop?.game;
  const m=materials(level);enhanceWorldMaterials(level,m);
  const root=new THREE.Group();root.name='Browser 3D artist environment pass';root.userData.visualOnly=true;root.userData.version=31;level.world.root.add(root);
  const deck=addDeckEngineering(level,root,m),portalFrames=addPortalFrames(level,root,m),conduits=addShellConduits(level,root,m);
  if(level.index===13)addLightProjector(level.world,{position:[-10,5.1,-7],direction:[0,0,-1],radius:1.1,accent:level.spec?.accent});
  addRoomMechanisms(level,m);
  root.userData.stats={deckBraces:deck.braces,deckLamps:deck.lamps,portalFrames,conduits};level.browser3DArt=root;return level;
}
