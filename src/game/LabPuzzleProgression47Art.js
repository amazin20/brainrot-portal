import * as THREE from 'three';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
function frame(w,h){const s=new THREE.Shape();for(const [i,p]of [[-w/2+1,-h/2],[w/2-1,-h/2],[w/2,-h/2+1],[w/2,h/2-1],[w/2-1,h/2],[-w/2+1,h/2],[-w/2,h/2-1],[-w/2,-h/2+1]].entries())i?s.lineTo(...p):s.moveTo(...p);s.closePath();const a=new THREE.Path();a.moveTo(-w/2+.65,-h/2+.65);a.lineTo(-w/2+.65,h/2-.65);a.lineTo(w/2-.65,h/2-.65);a.lineTo(w/2-.65,-h/2+.65);a.closePath();s.holes.push(a);return new THREE.ExtrudeGeometry(s,{depth:.45,bevelEnabled:false});}
/** Local mint/clay architectural dressing adds no collider or solution state. */
export function dressPuzzleProgression47(k,refs){
 const mint=new THREE.MeshStandardMaterial({name:'47 / sea glass archive enamel',color:0x599e94,roughness:.6,metalness:.1}),clay=new THREE.MeshStandardMaterial({name:'47 / terracotta drive enamel',color:0xcc8c72,roughness:.62,metalness:.08});
 k.m.shell.color.setHex(0x599e94);k.m.secondary.color.setHex(0xcc8c72);
 const arch=(p,w,h,m,n=[0,0,1])=>k.geometry(frame(w,h),m,p,Q().setFromUnitVectors(V(0,0,1),V(...n)),{name:'47 / folded archive surround'});
 arch([0,3,-3.52],8.2,6.1,clay);arch([8.3,8.3,-16.76],9.3,15.8,mint);
 for(const d of [refs.balcony,refs.goalDeck]){const a=d.record;k.block([(a.minX+a.maxX)/2,a.y-.8,a.maxZ-.05],[a.maxX-a.minX-.9,.28,.1],mint,false);}
 for(const z of [-20.85,-17.95])k.block([-.1,.42,z],[19.2,.18,.16],'metal',false);
 for(let x=-8;x<9;x+=2)k.block([x,.6,-21.3],[.5,.16,.16],clay,false);
 k.block([7.25,1.1,-26],[2.1,2.7,2.1],clay,false);k.block([7.25,1.1,-24.9],[1.35,2.4,.12],'dark',false);
 const lamp=new THREE.MeshBasicMaterial({name:'47 / live original cargo drive indicator',color:0x65786f});k.block([-16,.13,-11.75],[4.4,.08,.12],lamp,false);k.renders.push(()=>lamp.color.setHex(refs.drive.powered?0x95edd3:0x65786f));
 for(const [x,y,z]of [[-22,24,16],[0,24,1],[12,24,-12]]){k.block([x,y,z],[9,.45,4],'dark',false);k.block([x,y-.25,z],[7.8,.06,2.8],'white',false);}
 const owned=[mint,clay,lamp];let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;owned.forEach(m=>m.dispose());};const old=k.restoreLight.bind(k);k.restoreLight=()=>{dispose();old();};return {style:'folded mint ceramic impact archive and clay piston gallery',downloadBytes:0,extraShadowLights:0,dispose};
}
