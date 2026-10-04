import * as THREE from 'three';

// Small deterministic, mipmapped finishes. They add no downloaded assets or
// decorative collision volumes; the existing construction owns every surface.
function finishTexture(k,game,kind){
  const size=128,data=new Uint8Array(size*size*4);
  let seed=kind==='wood'?713:kind==='floor'?491:137;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let value;
    if(kind==='wood'){
      const warp=x+2.3*Math.sin(y*.035)+.7*Math.sin(y*.11);
      const grain=Math.sin(warp*.56)+.45*Math.sin(warp*1.43);
      value=218+grain*9+(random()-.5)*5;
    }else if(kind==='floor'){
      // Broad, quiet board joins survive oblique viewing. No one-pixel grid.
      const join=x%32<2;
      value=join?188:230+5*Math.sin(x*.35+y*.013)+(random()-.5)*4;
    }else value=237+(random()-.5)*8+3*Math.sin(x*.08)*Math.sin(y*.1);
    const i=(y*size+x)*4,v=Math.round(THREE.MathUtils.clamp(value,0,255));
    data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.name='Castle '+kind+' / deterministic 128px finish';
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.anisotropy=Math.min(4,game.renderer?.capabilities?.getMaxAnisotropy?.()??1);
  texture.needsUpdate=true;k.textures.push(texture);return texture;
}

export function applyCastleMaterials({game,k,rooms}){
  const wood=finishTexture(k,game,'wood'),floor=finishTexture(k,game,'floor'),plaster=finishTexture(k,game,'plaster');
  const timber=k.mat(0x805d47,.86,.025);timber.name='Load-bearing smoked timber';timber.map=wood;
  const soffit=k.mat(0x635448,.88,.025,0x211910);soffit.name='Warm timber roof underside';soffit.map=wood;
  k.m.floor.map=floor;k.m.floor.color.setHex(0xcabc9f);k.m.floor.roughness=.88;
  k.m.wall.map=plaster;k.m.wall.color.setHex(0xa5a18e);k.m.wall.roughness=.85;
  k.m.ceramic.map=plaster;k.m.ceramic.color.setHex(0xf1f0df);
  // All selected posts/beams already have exact solid proxies. Hardware,
  // moving parts and ceramic portal addresses retain their own finishes.
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
  const wings={
    freight:0xa0a39a,sluice:0x8bada4,optics:0x92a8bb,hoist:0xb3a18b,
    archive:0xad919c,flywheel:0xa5947d,magnet:0x9b96b4,migrant:0x8fae9f,
    pendulum:0xab8992,inertia:0x91abb4,crown:0xc0aa83,
  };
  // Existing broad wall panels carry the wing colour, rather than adding a
  // second wall or floating trim over a portal. Tiny signal colours remain
  // reserved for controls and receivers.
  const wingMaterials=new Map();
  for(const room of rooms.values()){
    const tint=k.mat(wings[room.def.id]??0xa5a18e,.85,.04);tint.name='Castle wing / '+room.def.id;tint.map=plaster;
    wingMaterials.set(room.def.id,tint);
    for(const mesh of k.static){
      if(mesh.material!==k.m.wall)continue;
      const p=mesh.position,s=mesh.scale;
      if(p.y<room.def.at[1]+1||p.y>room.def.at[1]+room.def.h+1)continue;
      if(p.x<room.b.x0-.8||p.x>room.b.x1+.8||p.z<room.b.z0-.8||p.z>room.b.z1+.8)continue;
      if(Math.max(s.x,s.z)<6)continue;
      mesh.material=tint;
    }
  }
  return {posts,beams,downloadBytes:0,textureCount:3,texturePixels:3*128*128,wingMaterials};
}
