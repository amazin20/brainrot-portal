import * as THREE from 'three';
const V=(...v)=>new THREE.Vector3(...v);

/** Solid factory envelope, not a sky dome or an invisible out-of-bounds wall.
 * Usable chamber bounds stay clear; roof lighting is inside the building. */
export function encloseLab(k,{base=-9,roof=k.ceiling??40,bounds=k.bounds}={}){
 const {minX,maxX,minZ,maxZ}=bounds,w=maxX-minX,d=maxZ-minZ,h=roof-base;
 k.enclosed=true;k.roomEnvelope={...bounds,base,roof};
 k.game.scene.background=new THREE.Color(0x24343f);
 k.game.scene.fog=new THREE.Fog(0x324854,110,260);
 const wall=new THREE.MeshStandardMaterial({name:'Structural laboratory wall',color:0x57707b,roughness:.76,metalness:.12,envMap:k.env,envMapIntensity:.35});
 k.block([(minX+maxX)/2,base-1.8,(minZ+maxZ)/2],[w,2,d],'dark');
 // Every wall is a closed load-bearing slab. Recessed bays are independent
 // volumes, not nearly coincident transparent skins.
 for(const [x,z,span,alongX]of [[(minX+maxX)/2,minZ,w,true],[(minX+maxX)/2,maxZ,w,true],[minX,(minZ+maxZ)/2,d,false],[maxX,(minZ+maxZ)/2,d,false]]){
  k.block([x,base+h/2,z],alongX?[span,h,1.2]:[1.2,h,span],wall);
  const inward=alongX?(z===minZ?1:-1):(x===minX?1:-1),n=Math.ceil(span/10);
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
  k.block([(minX+maxX)/2,roof-1.2,z],[Math.min(w-6,22),.18,1.3],'white',false);
 }
 const key=k.game.keyLight;if(key){key.position.set(minX+w*.24,roof-3,maxZ-d*.25);key.target.position.set((minX+maxX)/2,base+3,(minZ+maxZ)/2);key.intensity=2.7;}
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
  instrument.text=text;instrument.updates++;c.fillStyle='#152936';c.fillRect(0,0,canvas.width,canvas.height);
  const lines=text.split('\n'),lh=canvas.height/(lines.length+0.45);c.textBaseline='middle';c.textAlign='center';c.font=`600 ${Math.round(lh*.60)}px sans-serif`;
  lines.forEach((line,i)=>{c.fillStyle=i===0?'#ffe2a1':'#d8eef1';c.fillText(line,canvas.width/2,lh*(i+.65),canvas.width*.94);});texture.needsUpdate=true;};
 k.ticks.push(update);update(.2);return instrument;
}
