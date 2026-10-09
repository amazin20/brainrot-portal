import * as THREE from 'three';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
function frame(w,h){const s=new THREE.Shape();const loop=(x,y)=>[[-x+.6,-y],[x-.6,-y],[x,-y+.6],[x,y-.6],[x-.6,y],[-x+.6,y],[-x,y-.6],[-x,-y+.6]];loop(w/2,h/2).forEach((p,i)=>i?s.lineTo(...p):s.moveTo(...p));s.closePath();const hole=new THREE.Path();loop(w/2-.65,h/2-.65).reverse().forEach((p,i)=>i?hole.lineTo(...p):hole.moveTo(...p));hole.closePath();s.holes.push(hole);const g=new THREE.ExtrudeGeometry(s,{depth:.4,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:1});g.translate(0,0,-.2);return g;}
export function dressPuzzleProgression49(k,{entryDeck,gallery,goalDeck,carriage,mirror}){
 const mint=new THREE.MeshStandardMaterial({name:'49 / folded sea glass architecture',color:0x529d95,roughness:.58,metalness:.10}),clay=new THREE.MeshStandardMaterial({name:'49 / terracotta optical housings',color:0xcf8f71,roughness:.61,metalness:.1}),bone=new THREE.MeshStandardMaterial({name:'49 / mineral folded coffers',color:0xcdd4c5,roughness:.83,metalness:.02});
 k.m.shell.color.setHex(0x529d95);k.m.secondary.color.setHex(0xcf8f71);
 for(const [p,w,h,n,mat]of [[[-13,17.2,-14.03],10,7,[0,0,1],clay],[[-36.5,14,20],12,10,[1,0,0],mint],[[31,13,14.2],11,9,[0,0,-1],clay]])k.geometry(frame(w,h),mat,p,Q().setFromUnitVectors(V(0,0,1),V(...n)),{name:'49 / faceted architectural frame'});
 for(const d of [entryDeck,gallery,goalDeck]){const a=d.record;k.block([(a.minX+a.maxX)/2,a.y-.9,a.maxZ-.14],[a.maxX-a.minX-.8,.3,.13],d===goalDeck?clay:mint,false);}
 for(const [x,z]of [[-28,21],[3,-8],[31,7]]){k.block([x,27.5,z],[11,.5,7],'dark',false);k.geometry(frame(10.2,6.2),bone,[x,27.15,z],Q().setFromAxisAngle(V(1,0,0),Math.PI/2));k.block([x,26.95,z],[8.4,.06,4.4],'white',false);}
 // A manufactured rail makes the guided physical degree of freedom readable.
 for(const z of [1,6,11])k.block([0,4.8,z],[67,.32,.56],'metal',true);
 for(const x of [-30,-18,-6,6,18,30])for(const z of [1,11])k.block([x,.32,z],[.6,8.64,.6],'dark',true);
 k.block([-7,3.9,6],[3.0,1.6,2.2],mint,true);
 k.wire([[-14.91,5.7,-18],[-14.91,5.7,-25],[-7,5.7,-25],[-7,5.7,6]],()=>carriage.powerA||carriage.powerB);
 // Brake shoes and the mirror rim travel with their actual rigid assemblies.
 const anchor=new THREE.Group();anchor.position.set(-14,10.5,-18);k.world.root.add(anchor);
 k.block([0,-.65,0],[1.6,.5,2.4],clay,false,anchor);
 k.geometry(new THREE.CylinderGeometry(.16,.16,1.8,16),'metal',[0,0,0],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{parent:anchor,batch:false,name:'49 / stationary hinge shaft'});
 const mirrorPads=[];for(const z of [-1,1])mirrorPads.push(k.block([0,0,z*.9],[.65,.65,.3],clay,false,anchor));
 k.renders.push(()=>mirrorPads.forEach((m,i)=>m.position.z=(i?1:-1)*(mirror.clamped?.4:.9)));
 for(const x of [-4.5,4.5]){k.block([x,-3.0,6],[.24,.16,10.8],mint,false,carriage.group);k.block([x,-2,6],[.32,2.8,.32],mint,false,carriage.group);}
 let done=false;const dispose=()=>{if(done)return;done=true;for(const m of [mint,clay,bone])m.dispose();};const restore=k.restoreLight.bind(k);k.restoreLight=()=>{dispose();restore();};
 return {style:'folded mint and terracotta optical laboratory',extraShadowLights:0,downloadBytes:0,dispose};
}
