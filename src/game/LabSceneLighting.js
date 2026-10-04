import * as THREE from 'three';
import {sampleRampSurface} from './LabPhysics.js';

// Broad, neutral room radiance. This is an authored studio probe, not a live
// reflection of another scene. It gives curved metal and the original actors
// a readable volume without introducing shadowed lights in the low profile.
export function installLabRadiance(game){
 if(!game.renderer||game.artRadiance)return;
 const w=128,h=64,data=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=(x+.5)/w,v=(y+.5)/h;
  const ceiling=Math.max(0,Math.sin((v-.5)*Math.PI));
  const wrap=a=>Math.min(Math.abs(u-a),1-Math.abs(u-a));
  const softbox=Math.exp(-Math.pow(wrap(.22)/.11,4)-Math.pow((v-.68)/.18,4));
  const bounce=Math.exp(-Math.pow(wrap(.72)/.2,4)-Math.pow((v-.56)/.26,4));
  const t=.16+.22*ceiling+.40*softbox+.13*bounce,i=(y*w+x)*4;
  data[i]=Math.round(t*255);data[i+1]=Math.round(t*.99*255);data[i+2]=Math.round(t*.96*255);data[i+3]=255;
 }
 const texture=new THREE.DataTexture(data,w,h,THREE.RGBAFormat);
 texture.name='Neutral laboratory broad-light probe';
 texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.LinearSRGBColorSpace;
 texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
 game.scene.environment=texture;game.scene.environmentIntensity=.65;
 game.artRadiance={texture,dispose(){if(game.scene.environment===texture)game.scene.environment=null;texture.dispose();}};
}

function contactTexture(){
 const size=64,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const r=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1),i=(y*size+x)*4;
  data[i]=12;data[i+1]=18;data[i+2]=24;
  data[i+3]=Math.round(255*Math.pow(Math.max(0,1-r*r),3));
 }
 const t=new THREE.DataTexture(data,size,size);t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;
}

/** Two small grounding marks, clipped by the real support query. They don't
 * cast shadows, block rays, expand solids or continue over an open portal. */
export function dressLabLighting(game){
 if(!game.renderer)return;
 installLabRadiance(game);
 const root=new THREE.Group();root.name='Laboratory silhouette and grounded contacts';game.scene.add(root);
 const castle=Boolean(game.firstLevel?.singularity),fill=new THREE.DirectionalLight(0xd4e8f2,castle?.32:.48);
 fill.position.set(35,24,-28);fill.target.position.set(0,4,0);root.add(fill,fill.target);
 if(game.keyLight){game.keyLight.intensity=castle?1.85:2.05;game.keyLight.color.setHex(0xffead0);}
 game.renderer.toneMappingExposure=1.02;
 const texture=contactTexture(),geo=new THREE.PlaneGeometry(1,1);
 const create=()=>{const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.24,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const mesh=new THREE.Mesh(geo,material);mesh.rotation.x=-Math.PI/2;mesh.userData.visualOnly=true;mesh.name='Soft contact on actual support';root.add(mesh);return mesh;};
 const player=create(),cargo=create();
 const up=new THREE.Vector3(0,1,0),normal=new THREE.Vector3(),offset=new THREE.Vector3(),planeNormal=new THREE.Vector3(0,0,1);
 const pose=(mesh,p,feet,rx,rz)=>{
  const y=game.floorHeight(p.x,p.z,feet+.15,true);
  const gap=y===null||y===undefined?Infinity:feet-y;
  mesh.visible=Number.isFinite(y)&&gap>=-.15&&gap<2.7;
  if(!mesh.visible)return;
  // A live floor hole is empty even though the physical backing still exists.
  normal.copy(up);
  for(const ramp of game.ramps){
   if(ramp.enabled===false||p.x<ramp.minX||p.x>ramp.maxX||p.z<ramp.minZ||p.z>ramp.maxZ)continue;
   const surface=sampleRampSurface(ramp,p.z);
   if(Math.abs(surface.height-y)<.01){normal.set(0,1,-surface.slope).normalize();break;}
  }
  mesh.quaternion.setFromUnitVectors(planeNormal,normal);
  mesh.position.set(p.x,y,p.z).add(offset.copy(normal).multiplyScalar(.025));
  mesh.scale.set(rx*(1+gap*.14),rz*(1+gap*.14),1);
  mesh.material.opacity=.24*Math.max(0,1-gap/2.7);
 };
 game.labLighting={update(){pose(player,game.playerPosition,game.playerPosition.y,1.55,1.14);pose(cargo,game.cargo.position,game.cargo.position.y-.39,1.08,.92);},dispose(){texture.dispose();fill.dispose();}};
 game.scene.userData.artLighting={probe:'broad neutral radiance',probePixels:128*64,downloadBytes:0,extraShadowLights:0,contactDraws:2,profile:castle?'castle-mineral-and-gold':'laboratory-enamel-and-nickel'};
}
