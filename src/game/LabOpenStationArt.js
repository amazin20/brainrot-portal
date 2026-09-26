import {mapDeckUV} from './LabDeckUV.js';
import {encloseLab} from './LabHumanLab.js';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {SolidAssembly,placeSolidModel} from './LabSolidModels.js';
const V=(...v)=>new THREE.Vector3(...v),Q=()=>new THREE.Quaternion();

/** World-mapped floor finish: one opaque surface, mip-filtered joints and
 * broad printed inspection marks. No second almost-coplanar deck mesh. */
export function applyDeckFinish(k){
 const n=256,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const edge=Math.min(x,y,n-1-x,n-1-y),joint=edge<1?0.53:edge<2?.78:1;
  const grain=.006*Math.sin(x*2.1+y*3.7)+.004*Math.cos(x*.73-y*1.2);
  const stamp=x>19&&x<63&&y>19&&y<23||x>19&&x<23&&y>19&&y<43;
  const t=Math.max(0,Math.min(1,(stamp?.75:.90+grain)*joint)),i=4*(y*n+x);
  data[i]=Math.round(255*t);data[i+1]=Math.round(255*t);data[i+2]=Math.round(255*t);data[i+3]=255;
 }
 const map=new THREE.DataTexture(data,n,n);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;
 map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.anisotropy=4;map.needsUpdate=true;
 k.m.floor.map=map;k.m.floor.needsUpdate=true;
 k.world.root.updateWorldMatrix(true,true);
 k.world.root.traverse(m=>{if(m.isMesh&&m.material===k.m.floor)mapDeckUV(m);});
 k.ownedTextures??=[];k.ownedTextures.push(map);
}

export function addSky(k){
 encloseLab(k,{base:k.spec.id==='open-communicating-lifts'?-2:-9,roof:k.ceiling});
}

function closedHull(width,depth){
 const cut=Math.min(2,width/8,depth/8),ring=(w,d,y)=>[[-w/2+cut,y,-d/2],[w/2-cut,y,-d/2],[w/2,y,-d/2+cut],[w/2,y,d/2-cut],[w/2-cut,y,d/2],[-w/2+cut,y,d/2],[-w/2,y,d/2-cut],[-w/2,y,-d/2+cut]];
 const a=ring(width,depth,-.58),b=ring(width-1.8,depth-1.8,-2.5),positions=[];
 const tri=(...p)=>positions.push(...p.flat());
 for(let i=0;i<8;i++){let j=(i+1)%8;tri(a[i],b[i],b[j]);tri(a[i],b[j],a[j]);tri([0,-.58,0],a[j],a[i]);tri([0,-2.5,0],b[i],b[j]);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(positions.length/3*2),2));return g;
}

export function reinforceDeck(k,deck,{legs=true}={}){
 const {minX,maxX,minZ,maxZ,y}=deck,w=maxX-minX,d=maxZ-minZ,x=(minX+maxX)/2,z=(minZ+maxZ)/2;
 k.geometry(closedHull(w-.18,d-.18),'shell',[x,y,z],Q(),{solid:true,name:'Closed load-bearing hull / '+deck.name});
 deck.portalBackingColliders?.push(k.envelopes.at(-1));
 // Factory access ribs sit on the hull's vertical band, not on its walking face.
 for(let p=minX+2.4;p<maxX-1;p+=2.8)for(const s of [-1,1]){
  k.block([p,y-1.05,z+s*(d/2-.37)],[1.75,.46,.16],'dark',false);
  for(let f=-.54;f<.7;f+=.36)k.block([p+f,y-1.05,z+s*(d/2-.27)],[.11,.42,.09],'metal',false);
 }
 if(legs&&y>-.1)for(const sx of [-1,1])k.column(x+sx*(w/2-2.4),maxZ-2.4,-9,y-2.4,1.2);
}

function bearing(k,p,radius=1.6,depth=.7,normal=[0,0,1],parent=k.world.root){
 const q=Q().setFromUnitVectors(V(0,1,0),V(...normal));
 k.geometry(new THREE.CylinderGeometry(radius,radius,depth,48),'dark',p,q,{parent,solid:parent===k.world.root,name:'Sealed bearing housing'});
 const v=V(...p).addScaledVector(V(...normal),depth*.57);
 k.geometry(new THREE.CylinderGeometry(radius*.76,radius*.76,.16,48),'metal',v.toArray(),q,{parent});
 k.geometry(new THREE.CylinderGeometry(radius*.34,radius*.34,.27,24),'shell',v.clone().addScaledVector(V(...normal),.14).toArray(),q,{parent});
}

export function sign(k,text,p,normal=[0,0,1],width=5,height=1){
 if(typeof document==='undefined'||!document.createElement)return;
 const canvas=document.createElement('canvas');if(!canvas.getContext)return;canvas.width=1024;canvas.height=Math.round(1024*height/width);const c=canvas.getContext('2d');if(!c)return;
 c.fillStyle='#172b36';c.fillRect(0,0,canvas.width,canvas.height);c.font=`600 ${Math.round(canvas.height*.54)}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fae8c0';c.fillText(text,canvas.width/2,canvas.height*.52,canvas.width*.92);
 const t=new THREE.CanvasTexture(canvas);t.anisotropy=4;k.ownedTextures??=[];k.ownedTextures.push(t);
 const mat=new THREE.MeshStandardMaterial({map:t,roughness:.55});const g=new THREE.PlaneGeometry(width,height);k.geometry(g,mat,p,Q().setFromUnitVectors(V(0,0,1),V(...normal)),{batch:false,name:'Station wayfinding / '+text});
}

/** A closed radial traction machine with a guarded rotor, heavy mounting feet,
 * bolt circles and ribbed shell. The dial follows actual carriage displacement. */
function tractionMachine(k,car){
 const assembly=new SolidAssembly('Annular traction drive','launch');
 const face=Q().setFromAxisAngle(V(1,0,0),Math.PI/2);
 assembly.turned([[0,-1.8],[8,-1.8],[9,-1.1],[9,.1],[8.6,.6],[6.8,.9],[0,.9]],0,[0,0,0],face);
 assembly.arc(8.5,.65,.55,1,[0,0,1.1]);assembly.arc(7.8,.10,.28,2,[0,0,1.25]);
 for(let i=0;i<16;i++){
  const a=i*Math.PI/8,q=Q().setFromAxisAngle(V(0,0,1),a);
  assembly.add(new RoundedBoxGeometry(2.5,1.35,1.0,1,.22),0,[Math.cos(a)*10,Math.sin(a)*10,0],q);
  assembly.add(new THREE.CylinderGeometry(.19,.19,.16,6),1,[Math.cos(a)*8.5,Math.sin(a)*8.5,1.45],face,[1,1,1],false);
 }
 const model=assembly.finish();k.rematerial(model);placeSolidModel(k,model,[0,17,-42]);
 for(const x of [-7,7])k.column(x,-42,-9,12,1.4);
 // Rotor sits in front of a solid guard backing. It never opens a player route.
 const rotor=new THREE.Group();rotor.position.set(0,17,-40.5);rotor.name='Driven traction flywheel';k.world.root.add(rotor);
 bearing(k,[0,0,0],2.3,.8,[0,0,1],rotor);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,q=Q().setFromAxisAngle(V(0,0,1),a+.24);
  k.geometry(new RoundedBoxGeometry(6,1.1,.38,2,.25),'metal',[Math.cos(a)*4.5,Math.sin(a)*4.5,0],q,{parent:rotor,batch:false,name:'Balanced rotor spoke'});
 }
 const guard=k.geometry(new RoundedBoxGeometry(15.7,15.7,.18,1,.06),new THREE.MeshStandardMaterial({color:0x97c7cc,roughness:.15,metalness:.05,transparent:true,opacity:.10,depthWrite:false}),[0,17,-40.12],Q(),{batch:false,name:'Flywheel safety glazing'});
 const proxy=k.game.collisionProxy(new THREE.Box3().setFromObject(guard));proxy.mesh.name='Flywheel safety glazing';
 k.renders.push(()=>{rotor.rotation.z=(car.position.x+car.position.y*1.7+car.position.z)/15;});
 k.block([0,5.2,-40.7],[20,2.2,3.3],'dark');sign(k,'TRANSFER / 24',[0,5.2,-38.99],[0,0,1],9,1.1);
}

function hoistHead(k,car){
 const root=new THREE.Group();root.name='Four-point travelling hoist';k.world.root.add(root);
 k.block([0,0,6],[14,1.7,14],'dark',false,root,.38);
 k.block([0,1.1,6],[10.8,.95,10.8],'shell',false,root,.30);
 for(const x of [-5.1,5.1]){
  bearing(k,[x,-.1,1],1.1,2.0,[1,0,0],root);bearing(k,[x,-.1,10.8],1.1,2.0,[1,0,0],root);
  for(const z of [1,10.8])k.block([x,-1.3,z],[1.3,1.4,1.3],'secondary',false,root,.17);
 }
 for(let z=2;z<11;z+=1.2)k.block([0,1.64,z],[6,.14,.42],'metal',false,root,.035);
 for(const x of [-6.8,6.8])k.block([x,-.12,6],[.12,.24,10.5],'light',false,root,.035);
 root.updateWorldMatrix(true,true);
 // The beam/hoist is above every traversable surface. The envelope follows it
 // to keep airborne actors and the camera from crossing the actual housing.
 const c=k.game.collisionProxy(new THREE.Box3(V(-7,-1.9,-1),V(7,1.75,13)),{kinematic:true});
 const update=(dt=0)=>{root.position.set(car.group.position.x,48,car.group.position.z);root.updateWorldMatrix(true,true);k.game.syncCollision(c,new THREE.Box3(V(-7,-1.9,-1),V(7,1.75,13)).translate(root.position),dt);};
 k.ticks.push(update);k.renders.push(()=>{root.position.set(car.group.position.x,48,car.group.position.z);});update();
}

export function finishOrbitalArchitecture(k,car){
 encloseLab(k,{base:-9,roof:55,bounds:{minX:-56,maxX:56,minZ:-50,maxZ:54}});
 const decks=k.decks.filter(d=>d.name==='Departure plaza'||d.name==='Western sorting terrace'||d.name==='Eastern destination terrace');
 decks.forEach(d=>reinforceDeck(k,d));
 tractionMachine(k,car);hoistHead(k,car);
 // Tapered column caps and bolted support saddles carry the perimeter trusses.
 for(const x of [-50,50])for(const z of [-36,38]){
  k.block([x,49.3,z],[3.5,4.4,3.5],'dark');
  k.block([x,52,z],[4.5,1.2,5.0],'secondary');
  for(const dz of [-1.15,1.15])k.geometry(new THREE.CylinderGeometry(.28,.28,.22,6),'metal',[x,52.75,z+dz],Q(),{solid:false});
 }
 // Deep open-web trusses, all located overhead; the main volume stays open.
 for(const z of [-36,38]){
  k.block([0,48.8,z],[102,.6,1.0],'dark');
  for(let x=-46;x<48;x+=8){const a=V(x,49,z),b=V(x+6,52,z),v=b.clone().sub(a);k.geometry(new RoundedBoxGeometry(.32,v.length(),.35,1,.04),'metal',a.add(b).multiplyScalar(.5).toArray(),Q().setFromUnitVectors(V(0,1,0),v.normalize()),{solid:true});}
 }
 // Each pier has a distinct large-scale colour, not alternating tiny tiles.
 for(const [x,y,z,w,title]of [[0,0,41.7,29,'01 / DISPATCH'],[-30,10,23.7,26,'02 / TRANSFER'],[30,24,7.7,26,'03 / ARRIVAL']]){
  k.block([x,y-.92,z],[w,.55,.24],'secondary');sign(k,title,[x,y-.88,z+.14],[0,0,1],Math.min(w-2,10),.44);
 }
 for(const z of [-47,51])k.block([0,-8.2,z],[108,1.6,.6],'shell');
 for(const x of [-54,54])k.block([x,-8.2,2],[.6,1.6,98],'shell');
 applyDeckFinish(k);
}

/** Perimeter structure frames a hundred-metre open volume. No interior maze,
 * no slender passage is used as a progression lock. Glazing is intentional. */
export function addHangarEnvelope(k){
 const windowMat=new THREE.MeshStandardMaterial({name:'Laminated panoramic glass',color:0x75b2c2,roughness:.14,metalness:.22,transparent:true,opacity:.20,depthWrite:false});
 for(const [x,z,yaw,length]of [[0,-49,0,108],[-55,1,Math.PI/2,100],[55,1,-Math.PI/2,100]]){
  const q=Q().setFromAxisAngle(V(0,1,0),yaw),point=(u,y,v)=>V(u,y,v).applyQuaternion(q).add(V(x,0,z)).toArray();
  const part=(u,y,v,w,h,d,mat='shell',solid=true)=>k.geometry(new RoundedBoxGeometry(w,h,d,1,Math.min(.24,d*.18)),mat,point(u,y,v),q,{solid,name:'Hangar perimeter assembly'});
  part(0,-4,0,length,10,1.7,'dark');part(0,40,0,length,3,3.2);part(0,6.2,0,length,2.2,2.4);
  const count=Math.round(length/18),bay=length/count;
  for(let j=0;j<=count;j++){const u=-length/2+j*bay;part(u,22,0,1.9,36,2.0,'dark');part(u,39,1.2,3.2,4,1.5,'secondary');}
  for(let j=0;j<count;j++){
   const u=-length/2+(j+.5)*bay;part(u,23,-.16,bay-2.3,30,.14,windowMat).castShadow=false;
   part(u,37.4,.24,bay-2.6,1.05,.45,'secondary');part(u,8.6,.24,bay-2.6,1.05,.45,'secondary');
   for(const y of [15,30])part(u,y,.14,bay-2.4,.20,.24,'metal');
   part(u,36.1,.44,bay-4,.10,.10,'light',false);
  }
 }
}
