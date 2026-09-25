import * as THREE from 'three';
const V=(...v)=>new THREE.Vector3(...v);

/** Solid factory envelope, not a sky dome or an invisible out-of-bounds wall.
 * Usable chamber bounds stay clear; roof lighting is inside the building. */
export function encloseLab(k,{base=-9,roof=k.ceiling??40,bounds=k.bounds}={}){
 const {minX,maxX,minZ,maxZ}=bounds,w=maxX-minX,d=maxZ-minZ,h=roof-base;
 k.enclosed=true;k.roomEnvelope={...bounds,base,roof};
 k.game.scene.background=new THREE.Color(0x29383e);
 k.game.scene.fog=new THREE.Fog(0x40525a,170,360);
 const wall=new THREE.MeshStandardMaterial({name:'Structural laboratory wall',color:0x778a8d,roughness:.79,metalness:.08,envMap:k.env,envMapIntensity:.28});
 // Large mineral cassettes sit behind the actual load-bearing ribs. Their
 // shallow relief gives long rooms a scale without adding colliders, aim
 // blockers, portal candidates or a second near-coplanar wall skin.
 const cladding=new THREE.MeshStandardMaterial({name:'Inset mineral wall cassettes',color:0xa2b3ad,roughness:.82,metalness:.03});
 const restore=k.restoreLight.bind(k);
 k.restoreLight=()=>{wall.dispose();cladding.dispose();restore();};
 k.block([(minX+maxX)/2,base-1.8,(minZ+maxZ)/2],[w,2,d],'dark');
 // Every wall is a closed load-bearing slab. Recessed bays are independent
 // volumes, not nearly coincident transparent skins.
 for(const [x,z,span,alongX]of [[(minX+maxX)/2,minZ,w,true],[(minX+maxX)/2,maxZ,w,true],[minX,(minZ+maxZ)/2,d,false],[maxX,(minZ+maxZ)/2,d,false]]){
  k.block([x,base+h/2,z],alongX?[span,h,1.2]:[1.2,h,span],wall);
  const inward=alongX?(z===minZ?1:-1):(x===minX?1:-1),n=Math.ceil(span/10);
  const bay=span/n,rows=Math.max(1,Math.min(3,Math.ceil(h/14))),usable=Math.max(2,h-4.4),rowH=usable/rows;
  for(let i=0;i<n;i++){
   const at=-span/2+(i+.5)*bay;
   const p=alongX?[x+at,0,z+inward*.68]:[x+inward*.68,0,z+at];
   for(let row=0;row<rows;row++){
    p[1]=base+2.1+(row+.5)*rowH;
    k.block(p,alongX?[bay-.72,rowH-.28,.08]:[.08,rowH-.28,bay-.72],cladding,false);
   }
   // The darker lower service panel is a single practical band per bay.
   p[1]=base+1.13;
   k.block(p,alongX?[bay-.72,1.38,.12]:[.12,1.38,bay-.72],'dark',false);
  }
  for(let i=0;i<=n;i++){
   const at=-span/2+i*span/n,p=alongX?[x+at,base+h/2,z+inward*.75]:[x+inward*.75,base+h/2,z+at];
   k.block(p,alongX?[.42,h,1.0]:[1.0,h,.42],'dark');
  }
  for(const y of [base+2,roof-2.6]){
   k.block([x+(alongX?0:inward*.76),y,z+(alongX?inward*.76:0)],alongX?[span-.8,.7,.25]:[.25,.7,span-.8],'shell');
  }
 }
 const ceiling=k.block([(minX+maxX)/2,roof+.6,(minZ+maxZ)/2],[w,1.2,d],wall);ceiling.name='Closed laboratory roof';
 const bays=Math.max(2,Math.ceil(d/16));
 for(let i=0;i<bays;i++){
  const z=minZ+(i+.5)*d/bays;
  k.block([(minX+maxX)/2,roof-.65,z],[w-2,.9,1.2],'dark');
  // Separate shielded housings and warm diffusers keep the ceiling legible
  // from below. Their positions never coincide with the roof underside.
  for(const x of [minX+w*.29,minX+w*.71]){
   k.block([x,roof-1.22,z],[Math.min(5,w*.25),.23,2.4],'dark',false);
   k.block([x,roof-1.36,z],[Math.min(4.4,w*.22),.045,1.72],'white',false);
  }
 }
 const key=k.game.keyLight;if(key){key.position.set(minX+w*.24,roof-3,maxZ-d*.25);key.target.position.set((minX+maxX)/2,base+3,(minZ+maxZ)/2);key.intensity=2.1;}
}

/** A real in-world instrument. Repaints only when a rounded reading changes,
 * at most 5 Hz, rather than uploading a canvas texture every animation frame. */
export function labInstrument(k,p,{width=8,height=2,read,normal=[0,0,1],name='Process instrument'}={}){
 const instrument={text:'',updates:0};let elapsed=.2;
 if(!globalThis.document?.createElement){k.ticks.push(()=>{instrument.text=read();});return instrument;}
 const canvas=document.createElement('canvas');if(!canvas.getContext)return instrument;
 canvas.width=1024;canvas.height=Math.round(1024*height/width);const c=canvas.getContext('2d');if(!c)return instrument;
 const texture=new THREE.CanvasTexture(canvas);texture.anisotropy=4;k.ownedTextures??=[];k.ownedTextures.push(texture);
 const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
 const q=new THREE.Quaternion().setFromUnitVectors(V(0,0,1),V(...normal));
 k.geometry(new THREE.PlaneGeometry(width,height),material,p,q,{batch:false,name});
 const update=dt=>{elapsed+=dt;if(elapsed<.2)return;elapsed=0;const text=read();if(text===instrument.text)return;
  instrument.text=text;instrument.updates++;
  const W=canvas.width,H=canvas.height,header=Math.min(42,H*.24),gutter=Math.max(22,W*.055);
  c.fillStyle='#12222b';c.fillRect(0,0,W,H);
  c.fillStyle='#28454b';c.fillRect(0,0,W,Math.max(2,H*.028));
  c.fillStyle='#79d1c6';c.fillRect(0,0,Math.max(5,W*.008),H);
  c.fillStyle='#67d9c6';c.fillRect(gutter,header*.42,header*.26,header*.26);
  c.fillStyle='#96afa9';c.font=`600 ${Math.max(10,Math.round(header*.32))}px sans-serif`;
  c.textBaseline='middle';c.textAlign='left';c.fillText('ИССЛЕДОВАТЕЛЬСКИЙ КОНТУР',gutter+header*.44,header*.55,W*.65);
  const lines=text.split('\n'),bodyH=H-header,lh=bodyH/lines.length;
  c.font=`600 ${Math.max(13,Math.round(Math.min(68,lh*.57)))}px sans-serif`;
  lines.forEach((line,i)=>{c.fillStyle=i===0?'#ffe1a2':'#d3e8e4';c.fillText(line,gutter,header+lh*(i+.5),W-2*gutter);});
  texture.needsUpdate=true;};
 k.ticks.push(update);update(.2);return instrument;
}
