import * as THREE from 'three';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
/** A moving contact surface. The room supplies tangential friction only while
 * the real feet/body touch a belt; neither positions nor portal speed are set. */
export function buildRoom27Conveyors(k){
 const {game:g,world:w}=k,bands=[],system={bands,reversed:true,braked:false,phase:0};
 const rubber=new THREE.MeshStandardMaterial({color:0x156e91,roughness:.72,metalness:.12});
 const frame=new THREE.MeshStandardMaterial({color:0xffb938,roughness:.46,metalness:.3});
 const rollerMaterial=new THREE.MeshStandardMaterial({color:0x64dbd3,roughness:.38,metalness:.34});
 const stripes=new THREE.MeshStandardMaterial({color:0xffd467,roughness:.5,metalness:.18});
 const preserve=mesh=>{mesh.userData.keepMaterial=true;return mesh;};
 function belt(name,x,z0,z1,y,{speed=27,width=4.6,color=0x24bfc5}={}){
  const b={name,x,z0,z1,y,width,speed,direction:V(0,0,-1),active:true};bands.push(b);
  const deck=w.floor(x-width/2,x+width/2,z0,z1,y,{name});
  deck.group.traverse(o=>{if(o.isMesh&&!o.userData.collisionProxy){o.material=rubber;o.userData.keepMaterial=true;}});
  for(const side of [-1,1])preserve(w.box([x+side*(width/2+.14),y-.24,(z0+z1)/2],[.2,.48,z1-z0],frame,false));
  const count=Math.ceil((z1-z0)/.72),rollers=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.16,width,8),rollerMaterial,count),m=new THREE.Matrix4(),q=new THREE.Quaternion().setFromAxisAngle(V(0,0,1),Math.PI/2);
  for(let i=0;i<count;i++){m.compose(V(x,y-.23,z0+(i+.5)*(z1-z0)/count),q,V(1,1,1));rollers.setMatrixAt(i,m);}
  rollers.name=name+' visible underside rollers';preserve(rollers);w.root.add(rollers);rollers.computeBoundingSphere();
  const slats=new THREE.InstancedMesh(new THREE.BoxGeometry(width-.3,.025,.1),stripes,count);slats.name=name+' travelling belt slats';preserve(slats);w.root.add(slats);slats.frustumCulled=false;
  k.renders.push(()=>{for(let i=0;i<count;i++){const z=z0+((i+.5)*(z1-z0)/count+system.phase*(system.reversed?1:-1))%(z1-z0);m.makeTranslation(x,y+.017,z<z0?z+(z1-z0):z);slats.setMatrixAt(i,m);}slats.instanceMatrix.needsUpdate=true;});
  return b;
 }
 function contact(p,radius=0){return bands.find(b=>b.active&&Math.abs(p.y-b.y)<.18&&Math.abs(p.x-b.x)<b.width/2-radius*.35&&p.z>b.z0-.1&&p.z<b.z1+.1);}
 function acceleration(p,v,{cargo=false,grounded=true}={}){
  if(!grounded)return V();const b=contact(p,cargo?.5:.46);if(!b)return V();
  const target=system.braked?0:b.speed*(system.reversed?1:-1),a=V();
  // Finite contact traction overcomes ordinary walking damping. Steering
  // across the belt remains untouched, so the broad side alcoves are usable.
  a.z=THREE.MathUtils.clamp((target-v.z)*(cargo?35:95),-2200,2200);
  return a;
 }
 system.belt=belt;system.contact=contact;system.acceleration=acceleration;
 k.ticks.push(dt=>{if(!system.braked)system.phase+=dt*6;});
 k.forces.push(()=>{if(g.heldCube||!g.physics?.cargoBody)return;const b=g.physics.cargoBody,p=V(b.position.x,b.position.y-.5,b.position.z),v=V(b.velocity.x,b.velocity.y,b.velocity.z),a=acceleration(p,v,{cargo:true,grounded:Math.abs(v.y)<1});if(a.lengthSq()){b.wakeUp();b.force.z+=a.z*b.mass;}});
 k.resets.push(()=>{system.reversed=true;system.braked=false;system.phase=0;});
 k.state.conveyors=system;return system;
}
