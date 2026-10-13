import * as THREE from 'three';
const Q=()=>new THREE.Quaternion(),V=(...p)=>new THREE.Vector3(...p);
export function dressPuzzleProgression50(k,{departure,galleryA,galleryB,goalDeck,rotor}){
 const spindle=k.geometry(new THREE.CylinderGeometry(1.2,1.2,5.3,32),'metal',[0,16,0],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{batch:false,name:'50 / actual common bearing spindle'});
 for(const z of [-2.3,2.3]){k.geometry(new THREE.TorusGeometry(1.3,.14,8,32),'secondary',[0,16,z],Q(),{batch:false,name:'50 / brass axle bearing'});k.column(0,z,-4,14.7,.65);}
 // A visible spring winding surrounds the same axle. It contains no
 // separate animation: the force law is on the physical rotor itself.
 const line=[];for(let i=0;i<=240;i++){const t=i/240*10*Math.PI;line.push(V(Math.cos(t)*1.5,16+Math.sin(t)*1.5,-2+i/240*4));}
 const spring=k.geometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(line),240,.085,6,false),'light',[0,0,0],Q(),{batch:false,name:'50 / continuous torsional spring'});
 // A manufactured angle scale surrounds the real axle. Its pointer belongs
 // to the physical rotor root, so it cannot animate ahead of the mechanism.
 const scalePoints=Array.from({length:41},(_,i)=>{const a=-1.5+i*3/40;return V(Math.cos(a)*2.15,16+Math.sin(a)*2.15,2.82);});
 const angleScale=k.geometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(scalePoints),40,.065,6,false),'metal',[0,0,0],Q(),{batch:false,name:'50 / fixed physical axle angle scale'});
 for(let i=0;i<=12;i++){const a=-1.5+i*.25;k.geometry(new THREE.CylinderGeometry(.035,.035,i%3===0?.35:.18,6),'secondary',[Math.cos(a)*2.15,16+Math.sin(a)*2.15,2.82],Q().setFromAxisAngle(V(0,0,1),a-Math.PI/2),{name:'50 / engraved axle scale tick'});}
 const pointer=k.geometry(new THREE.CylinderGeometry(.055,.055,2.02,8),'secondary',[1.04,0,2.85],Q().setFromAxisAngle(V(0,0,1),-Math.PI/2),{parent:rotor.root,batch:false,name:'50 / pointer rigidly fixed to actual rotor'});
 const link=(from,to,name)=>{const a=V(...from),b=V(...to),delta=b.clone().sub(a);return k.geometry(new THREE.CylinderGeometry(.13,.13,delta.length(),12),'metal',a.clone().add(b).multiplyScalar(.5).toArray(),Q().setFromUnitVectors(V(0,1,0),delta.normalize()),{parent:rotor.root,batch:false,name});};
 link([0,0,0],[0,0,12],'50 / common counterbalance axle extension');
 link([0,0,12],[0,-10.5,12],'50 / permanent rigid counterweight connection');
 link([0,0,-1],[-7,6,-9.8],'50 / first pane outer bearing link');
 link([0,0,-1],[7,6,-17.8],'50 / second pane outer bearing link');
 for(const cup of rotor.cups){for(const z of [-1.1,1.1])k.block([0,.25,z],[.17,1.4,.17],'metal',false,cup.group);k.block([0,.9,0],[.25,.2,2.3],'metal',false,cup.group);}
 // Low enamel strips show the contact that actually supplies the load. They
 // sit on the existing floor edges and introduce no collision or aim proxy.
 const loadTrim=rotor.cups.map((cup,i)=>{
  const material=new THREE.MeshStandardMaterial({name:'50 / live '+cup.name+' contact enamel',color:i?0xa5d9c4:0xe8b775,emissive:i?0x75c9ae:0xe8ac57,emissiveIntensity:.06,roughness:.5,metalness:.22});
  const depth=cup.name==='b'?8:2.4;
  const meshes=[-1,1].map(side=>k.geometry(new THREE.BoxGeometry(.055,.045,depth-.25),material,[side*1.56,-.815,0],Q(),{parent:cup.group,batch:false,name:'50 / live weight contact floor trim'}));
  return{cup,material,meshes};
 });
 let previousTime=k.game.visualTime??0;
 k.renders.push(()=>{const now=k.game.visualTime??0,dt=Math.max(0,Math.min(.1,now-previousTime));previousTime=now;for(const trim of loadTrim){const goal=rotor.loaded(trim.cup.name) ? .5 : .06;trim.material.emissiveIntensity=THREE.MathUtils.lerp(trim.material.emissiveIntensity,goal,1-Math.exp(-dt*10));}});
 k.resets.push(()=>{previousTime=k.game.visualTime??0;loadTrim.forEach(t=>{t.material.emissiveIntensity=.06;});});
 let disposed=false;const restore=k.restoreLight.bind(k);k.restoreLight=()=>{if(!disposed){disposed=true;loadTrim.forEach(t=>t.material.dispose());}restore();};
 for(const deck of [departure,galleryA,galleryB,goalDeck]){const f=deck.floor;for(const x of [f.minX+.7,f.maxX-.7])k.block([x,f.y-1.1,(f.minZ+f.maxZ)/2],[.26,.35,f.maxZ-f.minZ-1.4],'secondary',false);}
 // Mineral gold niche frames sit on the actual rear wall, outside the
 // passenger capsule and cup retrieval throat.
 for(const x of [-24,24]){k.block([x,12,-30.7],[1.0,25,1.2],'secondary');k.block([x,24.5,-30.1],[5,.3,.4],'metal',false);}
 k.label('ОБЩИЙ ВЕРХНИЙ ВЫХОД',[11,26,-21.5],[0,0,1],10,.8);
 return {spindle,spring,angleScale,pointer,loadTrim,originalActors:true,downloadBytes:0,extraShadowLights:0,theme:'mineral gold / mint porcelain / terracotta casings'};
}
