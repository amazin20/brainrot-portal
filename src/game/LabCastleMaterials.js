import * as THREE from 'three';

// Quiet architectural colour and a separate machine colour for each hall.
// Bright ceramic remains reserved for an actual portal address.
export const CASTLE_WING_FINISHES=Object.freeze({
  freight:{wall:0xd5cbb1,face:0xf0e2ba,accent:0xc7994d,floor:0xe4ded0},
  sluice:{wall:0xaacdc2,face:0xd8eee3,accent:0x4a9c88,floor:0xd4e3dc},
  optics:{wall:0xb3cbdd,face:0xe0ecf7,accent:0x518bbb,floor:0xdce4ec},
  hoist:{wall:0xcdbb9d,face:0xf0dfbf,accent:0xbc8846,floor:0xe7dfce},
  archive:{wall:0xd1b3b5,face:0xefdbd8,accent:0xb06374,floor:0xe4d8d6},
  flywheel:{wall:0xc6bead,face:0xefe3c7,accent:0xb69352,floor:0xe3dfd3},
  magnet:{wall:0xbdb5d8,face:0xe6dff6,accent:0x8972bb,floor:0xe1ddec},
  migrant:{wall:0xabcfc8,face:0xd9eee8,accent:0x4e9e96,floor:0xd6e6e2},
  pendulum:{wall:0xcbb4c3,face:0xebddea,accent:0xa46893,floor:0xe6dce5},
  inertia:{wall:0xaec9d2,face:0xdceff1,accent:0x548f9f,floor:0xd8e6e9},
  crown:{wall:0xd8caa8,face:0xf6ecd1,accent:0xc09a52,floor:0xeee7d6},
});

// Low-frequency finishes remain quiet at oblique angles. No one-pixel grain,
// repeated dark grid or downloaded texture is needed for the material scale.
function finishTexture(k,game,kind){
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let value=250;
    if(kind==='wood')value=241+3*Math.sin((x+2*Math.sin(y*Math.PI/64))*Math.PI/32)+2*Math.sin(x*Math.PI/64);
    else if(kind==='floor')value=250+2*Math.cos(x*Math.PI/64)*Math.cos(y*Math.PI/64);
    else value=251+1.5*Math.cos(x*Math.PI/64)*Math.cos(y*Math.PI/64);
    const i=(y*size+x)*4,v=Math.round(THREE.MathUtils.clamp(value,0,255));
    data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.name='Castle '+kind+' / quiet mipmapped finish';
  texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.anisotropy=Math.min(4,game.renderer?.capabilities?.getMaxAnisotropy?.()??1);
  texture.needsUpdate=true;k.textures.push(texture);return texture;
}

export function applyCastleMaterials({game,k,rooms}){
  const wood=finishTexture(k,game,'wood'),floor=finishTexture(k,game,'floor'),plaster=finishTexture(k,game,'plaster');
  const timber=k.mat(0x947a61,.78,.015);timber.name='Castle structural cedar';timber.map=wood;
  const soffit=k.mat(0x415363,.79,.08);soffit.name='Castle recessed roof soffit';
  k.m.floor.map=floor;k.m.floor.color.setHex(0xe5e0d3);k.m.floor.roughness=.79;k.m.floor.metalness=.02;
  k.m.wall.map=plaster;k.m.wall.color.setHex(0xbdc7cc);k.m.wall.roughness=.83;k.m.wall.metalness=.02;
  k.m.ceramic.map=null;k.m.ceramic.color.setHex(0xf4f1e6);k.m.ceramic.roughness=.58;k.m.ceramic.metalness=.035;
  k.m.ceramic.emissive.setHex(0);k.m.ceramic.name='Portal address / clean ivory ceramic';
  let posts=0,beams=0;
  const span=new THREE.Vector3();
  for(const mesh of k.static){
    const collider=mesh.userData.collider;
    if(!collider||collider.kinematic||mesh.material===k.m.ceramic)continue;
    const s=collider.box.getSize(span);
    if(mesh.material===k.m.dark&&s.y<=.85&&Math.min(s.x,s.z)>=8&&mesh.position.y>=12){
      mesh.material=soffit;mesh.userData.castleRoofFinish=true;continue;
    }
    const isPost=s.y>=10&&s.x<=1.65&&s.z<=1.65;
    const isBeam=s.y<=.8&&((s.x>=10&&s.z<=1.65)||(s.z>=10&&s.x<=1.65));
    if(!isPost&&!isBeam)continue;
    mesh.material=timber;mesh.userData.castleStructuralFinish=true;
    if(isPost)posts++;else beams++;
  }
  const wingMaterials=new Map(),wingFaces=new Map(),wingAccents=new Map();
  for(const room of rooms.values()){
    const palette=CASTLE_WING_FINISHES[room.def.id]??CASTLE_WING_FINISHES.freight;
    const tint=k.mat(palette.wall,.83,.025);tint.name='Castle wing wall / '+room.def.id;tint.map=plaster;
    const face=k.mat(palette.face,.72,.065);face.vertexColors=true;face.name='Castle wing enamel / '+room.def.id;
    const accent=k.mat(palette.accent,.60,.24);accent.vertexColors=true;accent.name='Castle wing structural accent / '+room.def.id;
    wingMaterials.set(room.def.id,tint);wingFaces.set(room.def.id,face);wingAccents.set(room.def.id,accent);
    for(const mesh of k.static){
      if(mesh.material!==k.m.wall)continue;
      const p=mesh.position,s=mesh.scale;
      if(p.y<room.def.at[1]+1||p.y>room.def.at[1]+room.def.h+1)continue;
      if(p.x<room.b.x0-.8||p.x>room.b.x1+.8||p.z<room.b.z0-.8||p.z>room.b.z1+.8)continue;
      if(Math.max(s.x,s.z)<6)continue;
      mesh.material=tint;
    }
    // Regions in the existing unioned floor: no extra top plane, collider or
    // support is created, and real pits remain open. Machine decks keep their
    // own finish because the region only applies to the common floor material.
    const deck=k.mat(palette.floor,.80,.02);deck.name='Castle cast-in floor / '+room.def.id;deck.map=floor;
    k.floorInlays.push({minX:room.b.x0+.28,maxX:room.b.x1-.28,minZ:room.b.z0+.28,maxZ:room.b.z1-.28,y:room.def.at[1],material:deck,baseOnly:true});
  }
  return {posts,beams,downloadBytes:0,textureCount:3,texturePixels:3*128*128,wingMaterials,wingFaces,wingAccents};
}
