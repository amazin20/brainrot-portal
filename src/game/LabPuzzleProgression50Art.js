import * as THREE from 'three';
const Q=()=>new THREE.Quaternion(),V=(...p)=>new THREE.Vector3(...p);
export function dressPuzzleProgression50(k,{departure,galleryA,galleryB,goalDeck,rotor}){
 const spindle=k.geometry(new THREE.CylinderGeometry(1.2,1.2,5.3,32),'metal',[0,16,0],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{batch:false,name:'50 / actual common bearing spindle'});
 for(const z of [-2.3,2.3]){k.geometry(new THREE.TorusGeometry(1.3,.14,8,32),'secondary',[0,16,z],Q(),{batch:false,name:'50 / brass axle bearing'});k.column(0,z,-4,14.7,.65);}
 // A visible spring winding surrounds the same axle. It contains no
 // separate animation: the force law is on the physical rotor itself.
 const line=[];for(let i=0;i<=240;i++){const t=i/240*10*Math.PI;line.push(V(Math.cos(t)*1.5,16+Math.sin(t)*1.5,-2+i/240*4));}
 const spring=k.geometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(line),240,.085,6,false),'light',[0,0,0],Q(),{batch:false,name:'50 / continuous torsional spring'});
 const link=(from,to,name)=>{const a=V(...from),b=V(...to),delta=b.clone().sub(a);return k.geometry(new THREE.CylinderGeometry(.13,.13,delta.length(),12),'metal',a.clone().add(b).multiplyScalar(.5).toArray(),Q().setFromUnitVectors(V(0,1,0),delta.normalize()),{parent:rotor.root,batch:false,name});};
 link([0,0,0],[0,0,12],'50 / common counterbalance axle extension');
 link([0,0,12],[0,-10.5,12],'50 / permanent rigid counterweight connection');
 link([0,0,-1],[-7,6,-12.3],'50 / first pane outer bearing link');
 link([0,0,-1],[7,6,-15.3],'50 / second pane outer bearing link');
 for(const cup of rotor.cups){for(const z of [-1.1,1.1])k.block([0,.25,z],[.17,1.4,.17],'metal',false,cup.group);k.block([0,.9,0],[.25,.2,2.3],'metal',false,cup.group);}
 for(const deck of [departure,galleryA,galleryB,goalDeck]){const f=deck.floor;for(const x of [f.minX+.7,f.maxX-.7])k.block([x,f.y-1.1,(f.minZ+f.maxZ)/2],[.26,.35,f.maxZ-f.minZ-1.4],'secondary',false);}
 // Mineral gold niche frames sit on the actual rear wall, outside the
 // passenger capsule and cup retrieval throat.
 for(const x of [-24,24]){k.block([x,12,-30.7],[1.0,25,1.2],'secondary');k.block([x,24.5,-30.1],[5,.3,.4],'metal',false);}
 k.label('ОБЩИЙ ВЕРХНИЙ ВЫХОД',[11,26,-21.5],[0,0,1],10,.8);
 return {spindle,spring,originalActors:true,theme:'mineral gold / mint porcelain / terracotta casings'};
}
