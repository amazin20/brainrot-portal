import * as THREE from 'three';
const V=(...p)=>new THREE.Vector3(...p),Z=V(0,0,1);
function foldedFrame(w,h,d,r){
 const loop=(x,y,c)=>[[-x+c,-y],[x-c,-y],[x,-y+c],[x,y-c],[x-c,y],[-x+c,y],[-x,y-c],[-x,-y+c]];
 const shape=new THREE.Shape(),outer=loop(w/2,h/2,Math.min(1.2,w*.12,h*.12));outer.forEach((p,i)=>i?shape.lineTo(...p):shape.moveTo(...p));shape.closePath();
 const hole=new THREE.Path();loop(w/2-r,h/2-r,Math.max(.1,Math.min(1.2,w*.12,h*.12)-r*.6)).reverse().forEach((p,i)=>i?hole.lineTo(...p):hole.moveTo(...p));hole.closePath();shape.holes.push(hole);
 const g=new THREE.ExtrudeGeometry(shape,{depth:d,steps:1,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:1,curveSegments:1});g.translate(0,0,-d/2);return g;
}
/** Large enamel collars and folded service cassettes clad the physical
 * architecture. Artwork supplies no collision, portal candidates or aim wall. */
export function dressPuzzleProgression45(k,r){
 const mint=new THREE.MeshStandardMaterial({name:'Countercurrent / sea-glass enamel',color:0x529d95,roughness:.56,metalness:.12});
 const terra=new THREE.MeshStandardMaterial({name:'Countercurrent / warm receiving enamel',color:0xc98d73,roughness:.59,metalness:.10});
 const bone=new THREE.MeshStandardMaterial({name:'Countercurrent / mineral coffers',color:0xc9d5c3,roughness:.82,metalness:.03});
 const amber=new THREE.MeshBasicMaterial({name:'Countercurrent / shielded lamp',color:0xffca76});
 const materials=[mint,terra,bone,amber];
 const arch=(p,w,h,mat,n=[0,0,1],depth=.35,rim=.75)=>k.geometry(foldedFrame(w,h,depth,rim),mat,p,new THREE.Quaternion().setFromUnitVectors(Z,V(...n)),{name:'Countercurrent / broad folded architectural collar'});
 const part=(p,s,mat)=>k.block(p,s,mat,false,k.world.root,.07);
 arch([-18,7.1,-8.52],12.1,15,mint);arch([-18,7.1,-8.27],10.2,13.1,k.m.dark,[0,0,1],.12,.16);
 part([-18,11.65,-8.33],[8.1,.48,.21],terra);
 // Source and high receiver have different full-size housings, readable from
 // the first courtyard. The large white shooting sheets stay unobstructed.
 arch([26.2,4.1,18],15,12,mint,[-1,0,0]);
 arch([-28.3,16,-16],15,24,terra,[1,0,0]);
 part([-28.05,26.1,-16],[.2,.15,9.8],amber);
 arch([20,13.8,-3.65],14.2,23.7,terra,[0,0,-1]);
 part([20,24.6,-3.87],[9.2,.12,.13],amber);
 for(const z of [-22,-4,16]){
  arch([28.75,5.3,z],13,10,mint,[-1,0,0],.18,.65);
  for(const dz of [-3,-1,1,3])part([28.57,5.2,z+dz],[.1,5.1,.24],k.m.metal);
 }
 // Broad under-deck fascia remains beneath the original running slabs.
 for(const [deck,tint]of [[r.gallery,mint],[r.arm,mint],[r.apron,terra],[r.receive,terra],[r.goalDeck,terra]]){
  const d=deck.record,x=(d.minX+d.maxX)/2,z=d.maxZ-.21;
  part([x,d.y-.89,z],[d.maxX-d.minX-.82,.33,.14],tint);
 }
 // Roof-owned coffer lights use no extra shadow targets or animation passes.
 const lights=[];
 for(const [x,z,target,color]of [[-16,20,[-15,0,19],0xd6fff0],[-23,-9,[-23,14,-9],0xd6fff0],[19,-10,[20,15,-8],0xffdfad]]){
  arch([x,28.3,z],10.4,5.4,bone,[0,-1,0],.24,.65);
  part([x,28.17,z],[8.9,.07,3.9],k.m.white);
  const light=new THREE.SpotLight(color,22,35,Math.PI*.36,.82,1);light.position.set(x,27.95,z);light.target.position.fromArray(target);light.castShadow=false;k.world.root.add(light,light.target);lights.push(light);
 }
 const state=new THREE.MeshBasicMaterial({name:'Countercurrent / live weight diffuser',color:0xf0bd74});materials.push(state);
 part([-25.3,.33,22],[.1,.04,4.5],state);
 k.renders.push(()=>state.color.setHex(r.door.pressed?0x89eac7:0xf0bd74));
 let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;lights.forEach(l=>{l.removeFromParent();l.target.removeFromParent();l.dispose();});materials.forEach(m=>m.dispose());};
 const restore=k.restoreLight.bind(k);k.restoreLight=()=>{dispose();restore();};
 const art={style:'folded sea-glass extraction court and terracotta suspended receiver',extraShadowLights:0,downloadBytes:0,lights:lights.length,dispose,get disposed(){return disposed;}};
 k.world.root.userData.puzzleProgression45Art=art;return art;
}
