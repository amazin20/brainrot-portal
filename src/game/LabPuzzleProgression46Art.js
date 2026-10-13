import * as THREE from 'three';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
function frameGeometry(w,h,d,r){
 const shape=new THREE.Shape();const loop=(width,height)=>{const x=width/2,y=height/2,c=Math.min(1.5,width*.12,height*.18);return[[-x+c,-y],[x-c,-y],[x,-y+c],[x,y-c],[x-c,y],[-x+c,y],[-x,y-c],[-x,-y+c]];};
 loop(w,h).forEach((p,i)=>i?shape.lineTo(...p):shape.moveTo(...p));shape.closePath();
 const hole=new THREE.Path();loop(w-2*r,h-2*r).reverse().forEach((p,i)=>i?hole.lineTo(...p):hole.moveTo(...p));hole.closePath();shape.holes.push(hole);
 const g=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:1,steps:1});g.translate(0,0,-d/2);return g;
}
/** Large architectural enamel and enclosed coffers follow the accepted pilot.
 * This pass adds no collision, aim blockers, portal candidates or gameplay. */
export function dressPuzzleProgression46(k,refs){
 const mint=new THREE.MeshStandardMaterial({name:'46 / folded sea glass architecture',color:0x529d95,roughness:.56,metalness:.12});
 const clay=new THREE.MeshStandardMaterial({name:'46 / terracotta receiver architecture',color:0xcf8f71,roughness:.59,metalness:.1});
 const bone=new THREE.MeshStandardMaterial({name:'46 / bone mineral soffit',color:0xc9d5c3,roughness:.84,metalness:.025});
 const owned=[mint,clay,bone];
 k.m.shell.color.setHex(0x529d95);k.m.secondary.color.setHex(0xcf8f71);
 const arch=(p,w,h,mat,normal=[0,0,1])=>k.geometry(frameGeometry(w,h,.45,.7),mat,p,Q().setFromUnitVectors(V(0,0,1),V(...normal)),{name:'46 / continuous folded architectural frame'});
 // The entire mint collar remains outside the real inspection throat. Its
 // inner edge clears y=15.25..17.10 and z=-29..-19, including bevels;
 // neither the low cargo passage nor its view contains art-only beams.
 arch([-16.55,19.3,-24],12.2,11.5,mint,[1,0,0]);
 arch([-29.40,19.0,8],12.0,10.0,clay,[1,0,0]);
 arch([10.9,20.0,8],10.2,9.2,clay,[-1,0,0]);
 for(const d of [refs.entryDeck,refs.islandDeck,refs.observationDeck,refs.goalDeck]){
  const a=d.record,x=(a.minX+a.maxX)/2,z=a.maxZ-.16,w=a.maxX-a.minX;
  k.block([x,a.y-.87,z],[w-.9,.31,.13],d===refs.goalDeck?clay:mint,false);
 }
 for(const [x,z]of [[-22,14],[4,-20],[15,15]]){
  const y=k.ceiling-1.9;
  k.block([x,y+.22,z],[11,.46,5.1],'dark',false);
  arch([x,y-.05,z],10.5,4.6,bone,[0,-1,0]);
  k.block([x,y-.30,z],[9.1,.065,3.1],'white',false);
  for(const dx of [-4.3,4.3])k.block([x+dx,k.ceiling-.75,z],[.28,1.5,3.7],'metal',false);
 }
 // A contained visual lamp reports the same live switch, with no abstract
 // progress display or additional gameplay requirement.
 const lamp=new THREE.MeshBasicMaterial({name:'46 / actual field power lamp',color:0xe6b87c});owned.push(lamp);
 k.block([1,16.28,5.2],[.12,.50,.10],lamp,false);
 k.renders.push(()=>lamp.color.setHex(refs.funnel.enabled?(refs.funnel.reversed?0xf5ad75:0x7edee8):0x6b7d78));
 const lights=[];
 for(const [p,target,color,intensity]of [[[-22,32,14],[-22,15,14],0xd6fff0,24],[[4,32,-20],[4,15,-20],0xd6fff0,24],[[15,32,15],[15,22,15],0xffdfad,16]]){
  const light=new THREE.SpotLight(color,intensity,42,Math.PI*.35,.8,1);light.position.fromArray(p);light.target.position.fromArray(target);light.castShadow=false;k.world.root.add(light,light.target);lights.push(light);
 }
 let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;owned.forEach(m=>m.dispose());for(const l of lights){l.removeFromParent();l.target.removeFromParent();l.dispose();}};
 const restore=k.restoreLight.bind(k);k.restoreLight=()=>{dispose();restore();};
 const art={style:'enclosed folded mint and terracotta support interchange',extraShadowLights:0,downloadBytes:0,dispose};k.world.root.userData.puzzleProgressionArt=art;return art;
}
