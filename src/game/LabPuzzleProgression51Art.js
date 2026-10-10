import * as THREE from 'three';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
function frame(w,h){const s=new THREE.Shape(),points=(x,y)=>[[-x+.6,-y],[x-.6,-y],[x,-y+.6],[x,y-.6],[x-.6,y],[-x+.6,y],[-x,y-.6],[-x,-y+.6]];points(w/2,h/2).forEach((p,i)=>i?s.lineTo(...p):s.moveTo(...p));s.closePath();const hole=new THREE.Path();points(w/2-.55,h/2-.55).reverse().forEach((p,i)=>i?hole.lineTo(...p):hole.moveTo(...p));hole.closePath();s.holes.push(hole);const g=new THREE.ExtrudeGeometry(s,{depth:.3,bevelEnabled:true,bevelThickness:.02,bevelSize:.02,bevelSegments:1});g.translate(0,0,-.15);return g;}
export function dressPuzzleProgression51(k,{apparatus:a}){
 const pearl=new THREE.MeshStandardMaterial({name:'51 / pearl folded laboratory',color:0xd5e0d7,roughness:.72,metalness:.07}),teal=new THREE.MeshStandardMaterial({name:'51 / turquoise mechanical housings',color:0x529e97,roughness:.56,metalness:.17});k.m.shell.color.setHex(0xb8ccc3);k.m.secondary.color.setHex(0x529e97);
 for(const [p,w,h]of [[[0,4.3,-11.5],8,10],[[0,4.3,-28.2],13,11]])k.geometry(frame(w,h),p[2]<-20?teal:pearl,p,Q(),{name:'51 / faceted pearl architectural opening'});
 for(const [x,z]of [[0,12],[0,-22],[-15,15],[15,-3]]){k.block([x,18.15,z],[9,.3,6],teal,false);k.geometry(frame(8.5,5.5),pearl,[x,17.95,z],Q().setFromAxisAngle(V(1,0,0),Math.PI/2));k.block([x,17.7,z],[6.7,.05,3.7],'white',false);}
 // The long rigid linkage is manufactured and above pedestrian headroom.
 // Its geometry follows the very same compound receiver/stopper bodies.
 const linkages=a.heads.map(r=>{const group=new THREE.Group();k.world.root.add(group);group.position.set(r.sign*15,4.4,22);k.block([r.sign*-12.8,3.95,-17],[.14,.14,34],teal,false,group);k.block([r.sign*-6.4,3.95,0],[12.8,.14,.14],teal,false,group);k.block([0,1.975,0],[.14,3.95,.14],teal,false,group);k.geometry(new THREE.TorusGeometry(.8,.10,8,28),'metal',[0,0,-.2],Q(),{parent:group,batch:false,name:'51 / moving real receiver collar'});return group;});
 const rope=new THREE.Group();k.world.root.add(rope);const strings=[k.block([0,12,-12],[.07,7,.07],'metal',false,rope),k.block([4,17.4,-12],[8,.07,.07],'metal',false,rope),k.block([8,14.2,-12],[.07,6,.07],'metal',false,rope)];
 for(const x of [0,8])k.geometry(new THREE.TorusGeometry(.42,.12,8,24),'metal',[x,17.4,-12],Q(),{name:'51 / manufactured counterweight pulley'});
 k.renders.push(()=>{linkages.forEach((m,i)=>{const b=a.heads[i].body;if(b)m.position.set(b.position.x,b.position.y,b.position.z);});if(!a.gate)return;const top=a.gate.position.y+4,weight=a.weight.position.y+1;strings[0].position.y=(17.4+top)/2;strings[0].scale.y=Math.max(.01,(17.4-top)/7);strings[2].position.y=(17.4+weight)/2;strings[2].scale.y=Math.max(.01,(17.4-weight)/6);});
 k.wire([[8,.3,19],[11,.3,19],[11,.3,24],[5.4,.3,24],[5.4,4.4,24],[5.4,4.4,19]],()=>a.powered());
 let done=false;const dispose=()=>{if(done)return;done=true;pearl.dispose();teal.dispose();};const restore=k.restoreLight.bind(k);k.restoreLight=()=>{dispose();restore();};return {style:'pearl and turquoise folded mechanical echo laboratory',downloadBytes:0,extraShadowLights:0,dispose};
}
