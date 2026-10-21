import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Quiet architectural colour and a separate machine colour for each hall.
// Bright ceramic remains reserved for an actual portal address.
export const CASTLE_WING_FINISHES=Object.freeze({
  freight:{wall:0x918a77,face:0xd8c9a8,accent:0xbc8f51,floor:0xcac3b0},
  sluice:{wall:0x65847a,face:0xb9cec1,accent:0x67b29d,floor:0xbecbc1},
  optics:{wall:0x647f91,face:0xc1d1d8,accent:0x86b9cf,floor:0xc1cbd0},
  hoist:{wall:0x8b7d67,face:0xd4c2a2,accent:0xc89a57,floor:0xcbc1ad},
  archive:{wall:0x8b6f76,face:0xd0b8b5,accent:0xbe8186,floor:0xc8babb},
  flywheel:{wall:0x7f7869,face:0xd5c5a4,accent:0xc7a05f,floor:0xcac3b3},
  magnet:{wall:0x756b87,face:0xc6bcd3,accent:0xaf94cc,floor:0xc5bfd0},
  migrant:{wall:0x648783,face:0xb9d1c8,accent:0x79b8ad,floor:0xbecdc7},
  pendulum:{wall:0x836d80,face:0xcbb8c8,accent:0xbb86a9,floor:0xc9bfca},
  inertia:{wall:0x627e8b,face:0xbcd1d4,accent:0x7eafbd,floor:0xbfccd0},
  impulse:{wall:0x687991,face:0xbecbd9,accent:0x94a9ce,floor:0xc2c9d3},
  crown:{wall:0x7d7255,face:0xe3d1a8,accent:0xd3ad66,floor:0xd4c8ac},
});

/** Broad closed coffers are carved INTO the existing wall volume. The full
 * outer frame retains all six original contact planes. This changes an actual
 * wall, rather than putting a second translucent skin over a plain box. */
export function castlePerimeterCofferGeometry(size,{monumental=false}={}){
  if(!size.every(n=>Number.isFinite(n)&&n>0))throw new RangeError('Positive castle wall dimensions required');
  const [sx,sy,sz]=size,axis=sx<sz?'x':'z',w=axis==='x'?sz:sx,h=sy,d=axis==='x'?sx:sz;
  const pieces=[],pier=Math.min(.62,w*.1),sill=Math.min(.64,h*.12),bays=monumental?1:Math.min(9,Math.max(1,Math.round(w/8.5)));
  const add=(x,y,z,a,b,c,tone)=>{
    if(Math.min(a,b,c)<=0)return;
    const g=new THREE.BoxGeometry(a,b,c).toNonIndexed(),colors=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3)colors.set([tone,tone,tone],i);
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.translate(x,y,z);pieces.push(g);
  };
  // A continuous back keeps every bay closed. Recess is at most 12 cm, much
  // less than a player's support tolerance, and cannot form a climbable shelf.
  const recess=Math.min(.12,d*.22),core=d-2*recess;
  // Partition the closed backing between the outer rails. A full-size box
  // underneath those rails would share their exterior side/top faces and
  // stipple at oblique views, even with perfectly stable depth precision.
  add(0,0,0,w-2*pier,h-2*sill,core,.70);
  for(const sign of [-1,1]){
    add(sign*(w-pier)/2,0,0,pier,h,d,1.08);
    add(0,sign*(h-sill)/2,0,w-2*pier,sill,d,.98);
  }
  const span=(w-2*pier)/bays;
  for(let i=1;i<bays;i++){
    const x=-w/2+pier+i*span;
    // The central shaft stops at its two capitals. Their front planes never
    // overlap, and the outer wall rails already supply the end-bay piers.
    add(x,0,0,pier,h-4*sill,d,.96);
    for(const sign of [-1,1])add(x,sign*(h/2-sill*1.5),0,Math.min(1.12,span*.28),sill,d,1.12);
  }
  // One heavy dado and one cornice establish the storey from a distance.
  const dado=-h/2+Math.min(3.15,h*.42);
  if(!monumental)for(let i=0;i<bays;i++){
    const left=-w/2+pier+i*span+(i?pier/2:0),right=-w/2+pier+(i+1)*span-(i<bays-1?pier/2:0);
    add((left+right)/2,dado,0,right-left,.28,d,.92);
  }
  const geometry=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());
  if(axis==='x')geometry.rotateY(Math.PI/2);
  geometry.scale(1/sx,1/sy,1/sz);geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.name='Castle perimeter / closed load-bearing stone coffers';
  geometry.parameters={width:1,height:1,depth:1};geometry.userData.architecturalBatch=true;
  return geometry;
}

// Low-frequency finishes remain quiet at oblique angles. No one-pixel grain,
// repeated dark grid or downloaded texture is needed for the material scale.
function finishTexture(k,game,kind){
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let value=250;
    if(kind==='wood')value=241+3*Math.sin((x+2*Math.sin(y*Math.PI/64))*Math.PI/32)+2*Math.sin(x*Math.PI/64);
    else if(kind==='floor'){
      // Unioned decks already carry continuous world UVs at four metres per
      // repeat. Broad staggered limestone slabs give that scale a readable
      // joint, rather than an almost uniform two-value wash on enormous rooms.
      const row=Math.floor(y/64),sx=(x+row*64)%128,sy=y%64;
      const edge=Math.min(sx,128-sx,sy,64-sy),t=THREE.MathUtils.clamp(edge/2.2,0,1);
      const stone=244+4*Math.cos(x*Math.PI/64)*Math.cos(y*Math.PI/64);
      value=219+(stone-219)*t*t*(3-2*t);
    }
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
  const timber=k.mat(0x705746,.78,.015);timber.name='Castle structural cedar';timber.map=wood;
  const soffit=k.mat(0x415363,.79,.08);soffit.name='Castle recessed roof soffit';
  k.m.floor.map=floor;k.m.floor.color.setHex(0xe5e0d3);k.m.floor.roughness=.79;k.m.floor.metalness=.02;
  k.m.wall.map=plaster;k.m.wall.color.setHex(0xbdc7cc);k.m.wall.roughness=.83;k.m.wall.metalness=.02;
  k.m.ceramic.map=null;k.m.ceramic.color.setHex(0xf4f1e6);k.m.ceramic.roughness=.58;k.m.ceramic.metalness=.035;
  k.m.ceramic.emissive.setHex(0);k.m.ceramic.name='Portal address / clean ivory ceramic';
  let posts=0,beams=0;const reinforcedColumns=[];
  const span=new THREE.Vector3();
  for(const mesh of k.static){
    const collider=mesh.userData.collider;
    if(!collider||collider.kinematic||mesh.material===k.m.ceramic)continue;
    const s=collider.box.getSize(span);
    if(mesh.material===k.m.dark&&s.y<=.85&&Math.min(s.x,s.z)>=8&&mesh.position.y>=12){
      mesh.material=soffit;mesh.userData.castleRoofFinish=true;continue;
    }
    // These sixteen exterior columns carry the whole five-storey atrium.
    // Their former 112:1.25 proportion read as orange sticks. The new width
    // remains outside every gallery and wing opening and is real collision,
    // not a thick visual shell around an invisible narrow contact.
    if(s.y>110&&Math.abs(s.x-1.25)<.001&&Math.abs(s.z-1.25)<.001&&
      [-77,-19,19,77].includes(mesh.position.x)&&[-67,-10,10,67].includes(mesh.position.z)){
      const before=collider.box.clone();mesh.scale.x=2.2;mesh.scale.z=2.2;k.sync(mesh,0,true);
      reinforcedColumns.push({position:mesh.position.toArray(),before:[...before.min.toArray(),...before.max.toArray()],after:[...collider.box.min.toArray(),...collider.box.max.toArray()]});
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
    const tint=k.mat(palette.wall,.83,.025);tint.name='Castle wing wall / '+room.def.id;tint.map=plaster;tint.vertexColors=true;
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
      const perimeter=[Math.abs(p.x-room.b.x0),Math.abs(p.x-room.b.x1),Math.abs(p.z-room.b.z0),Math.abs(p.z-room.b.z1)].some(distance=>distance<.8);
      if(perimeter&&s.y>2.2&&Math.min(s.x,s.z)<.8&&mesh.geometry===k.cube){
        const monumental=room.def.id==='crown'&&Math.abs(p.z-room.b.z1)<.8;
        mesh.geometry=k.geo(castlePerimeterCofferGeometry(s.toArray(),{monumental}));mesh.userData.castlePerimeterCoffer=true;
      }
    }
    // Regions in the existing unioned floor: no extra top plane, collider or
    // support is created, and real pits remain open. Machine decks keep their
    // own finish because the region only applies to the common floor material.
    const deck=k.mat(palette.floor,.80,.02);deck.name='Castle cast-in floor / '+room.def.id;deck.map=floor;
    k.floorInlays.push({minX:room.b.x0+.28,maxX:room.b.x1-.28,minZ:room.b.z0+.28,maxZ:room.b.z1-.28,y:room.def.at[1],material:deck,baseOnly:true});
  }
  k.root.userData.castleStructuralReinforcement=reinforcedColumns;
  return {posts,beams,reinforcedColumns,downloadBytes:0,textureCount:3,texturePixels:3*128*128,wingMaterials,wingFaces,wingAccents};
}
