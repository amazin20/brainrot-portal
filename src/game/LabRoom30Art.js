import * as THREE from 'three';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

/** The finale reads as a sunny launch park, with two recognisable ribbons in
 * space and a distant sun gate. Decorative motion never enters physics. */
export function buildRoom30Art(level){
 const {world,flightGeometry:f,state}=level,root=new THREE.Group();root.name='Sunward launch park landmarks';root.userData.keepMaterial=true;root.userData.visualOnly=true;world.root.add(root);
 const colors={orange:0xf29759,cobalt:0x326caf,cyan:0x63c9d1,yellow:0xffdc65,cream:0xf7dfae,green:0x81b889};
 const mats=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color,roughness:.58,metalness:.14})]));
 const boxes=[],tubeGeometry=new THREE.CylinderGeometry(1,1,1,8),boxGeometry=new THREE.BoxGeometry(1,1,1);
 const batchBox=(p,s,color)=>boxes.push({p,s,color});
 const beam=(a,b,r=.25,mat=mats.cobalt)=>{const d=V(...b).sub(V(...a)),m=new THREE.Mesh(tubeGeometry,mat);m.position.copy(V(...a).add(V(...b)).multiplyScalar(.5));m.scale.set(r,d.length(),r);m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());root.add(m);return m;};
 const ring=(position,radius,normal,color='orange',tube=.16)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,6,64),mats[color]);m.position.copy(position);m.quaternion.setFromUnitVectors(V(0,0,1),normal.clone().normalize());root.add(m);return m;};
 const clearances=[];
 // Visible rims and supporting trusses stay below the real walkable plane.
 for(const floor of world.floors){if(floor.y<20||!floor.mesh)continue;const {minX,maxX,minZ,maxZ,y}=floor;
  for(const z of [minZ,maxZ])batchBox([(minX+maxX)/2,y-.35,z],[maxX-minX,.5,.35],colors.cobalt);
  for(const x of [minX,maxX])batchBox([x,y-.35,(minZ+maxZ)/2],[.35,.5,maxZ-minZ],colors.cobalt);
  if(maxX-minX>20&&maxZ-minZ>20){for(const x of [minX+3,maxX-3])for(const z of [minZ+3,maxZ-3]){
   // Pedestal meshes below the deck are deliberately slim and remote from the
   // authored foundation recovery walk; their support volumes are real.
   const support=world.box([x,y/2-1,z],[.85,y-2,.85],mats.cobalt);support.userData.keepMaterial=true;
   beam([x,Math.max(2,y-12),z],[x+(x<(minX+maxX)/2?5:-5),y-1,z],.24);
  }}
 }
 // Petal observatory grows directly from the solid opening hub sculpture.
 const flower=new THREE.Group();flower.position.set(-1,66,7);root.add(flower);
 const petalGeometry=new THREE.SphereGeometry(1,14,8),petals=new THREE.InstancedMesh(petalGeometry,mats.orange,12),dummy=new THREE.Object3D();
 for(let i=0;i<12;i++){const a=i*Math.PI/6;dummy.position.set(Math.cos(a)*8,0,Math.sin(a)*8);dummy.rotation.set(0,-a,0);dummy.scale.set(5,1.35,2);dummy.updateMatrix();petals.setMatrixAt(i,dummy.matrix);}flower.add(petals);
 const centre=new THREE.Mesh(new THREE.SphereGeometry(4,22,14),mats.yellow);centre.scale.y=.5;flower.add(centre);
 const observatoryRing=ring(V(-1,65.5,7),14,V(.1,1,.05),'cobalt',.3);
 for(const [x,z] of [[-21,-6],[19,8]]){const sphere=new THREE.Mesh(new THREE.SphereGeometry(2.2,12,8),mats.green);sphere.scale.set(1,1.4,1);sphere.position.set(x,58.3,z);root.add(sphere);ring(V(x,56.6,z),3.1,V(0,1,0),'yellow',.14);}
 // The collars visibly describe the well's gentle centring force. Apertures
 // remain empty: neither artwork nor collision crosses a travel corridor.
 for(const well of f.wells){const c=well.panel.getFrame().center;for(let y=c.y+4;y<well.top;y+=7)ring(V(c.x,y,c.z),5.7,V(0,1,0),'cyan',.10);
  for(const dx of [-6.5,6.5])beam([c.x+dx,c.y-1,c.z],[c.x+dx,well.top+1,c.z],.22,mats.orange);
 }
 const paths=[];
 for(const [name,panel,drop,landingY,color] of [['north',f.north,36,40,'yellow'],['east',f.east,36,40,'cyan'],['final',f.final,34,28,'orange']]){
  const rings=Array.from({length:name==='final'?8:6},()=>ring(V(),name==='final'?7:6,V(0,0,1),color,.14));
  paths.push({name,panel,drop,landingY,rings});
  const back=panel.getFrame().center.clone().addScaledVector(panel.getFrame().normal,-1.3);
  ring(back,7.5,panel.getFrame().normal,color,.38);
  // Broad satellite-dish silhouette sits behind the actual white receiver.
  for(const side of [-1,1])beam([back.x+side*8,back.y-8,back.z],[back.x+side*8,back.y+8,back.z],.46,mats.cobalt);
  clearances.push({name,radius:6});
 }
 // The end is recognisable from the observation island: a rising sun between
 // two enormous orange fins, never another misleading portal-white wall.
 for(const x of [183,218]){
  batchBox([x,39,32],[2,22,3],colors.orange);
  batchBox([x,50,32],[2.3,.65,3.3],colors.yellow);
 }
 beam([183,49,32],[218,49,32],.65,mats.cobalt);
 const sun=ring(V(200,43,32),7,V(0,0,1),'yellow',.72);ring(V(200,43,32),8.9,V(0,0,1),'orange',.25);
 for(let i=0;i<14;i++){const a=i*Math.PI*2/14;beam([200+Math.cos(a)*10,43+Math.sin(a)*10,32],[200+Math.cos(a)*11.8,43+Math.sin(a)*11.8,32],.18,mats.yellow);}
 // A thin unbroken coloured cable makes the angle control legible. It is a
 // visual cable, not the oversized diagonal AABB of a box-shaped cable run.
 const cablePoints=[V(48,40.15,23),V(47,40.15,23),V(47,40.15,-2),V(170,40.15,-2),V(170,43,-75),V(200,43,-75)];
 const cableMat=new THREE.LineBasicMaterial({color:colors.cobalt}),cable=new THREE.Line(new THREE.BufferGeometry().setFromPoints(cablePoints),cableMat);root.add(cable);
 // Sparse off-route planters and generous empty space preserve the sense of
 // height without hiding panels behind scenery or drawing a distant city.
 for(const [x,z,r] of [[-59,-65,13],[-57,53,10],[25,64,14],[112,63,13],[208,65,12],[224,-89,14]]){
  const mound=new THREE.Mesh(new THREE.SphereGeometry(r,14,7),mats.green);mound.scale.y=.10;mound.position.set(x,-.5,z);root.add(mound);
  ring(V(x,.12,z),r+2,V(0,1,0),'cream',.2);
 }
 const batch=new THREE.InstancedMesh(boxGeometry,new THREE.MeshStandardMaterial({color:0xffffff,roughness:.55,metalness:.12}),boxes.length);
 boxes.forEach((b,i)=>{dummy.position.fromArray(b.p);dummy.rotation.set(0,0,0);dummy.scale.fromArray(b.s);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);batch.setColorAt(i,new THREE.Color(b.color));});batch.computeBoundingSphere();root.add(batch);
 let lastTime=0;
 const update=(_alpha=1,visualTime)=>{
  if(Number.isFinite(visualTime))lastTime=visualTime;
  const reduced=world.game.epicOptions?.reducedMotion||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  flower.rotation.y=reduced?0:lastTime*.035;observatoryRing.rotation.y=reduced?0:lastTime*.045;
  for(const path of paths){const frame=path.panel.getFrame(),normal=frame.normal,speed=Math.sqrt(39*(path.drop+1.2));
   const vy=normal.y*speed,time=(vy+Math.sqrt(vy*vy+39*(frame.center.y-path.landingY)))/19.5;
   for(let i=0;i<path.rings.length;i++){const t=time*(i+1)/(path.rings.length+1),mesh=path.rings[i];mesh.position.copy(frame.center).addScaledVector(normal,speed*t).add(V(0,-9.75*t*t,0));mesh.quaternion.setFromUnitVectors(V(0,0,1),normal.clone().multiplyScalar(speed).add(V(0,-19.5*t,0)).normalize());}
  }
  cableMat.color.setHex(state.tilt.angle>.5?colors.yellow:colors.cobalt);
 };
 update();
 level.launchArt={root,paths,clearances,update,drawCalls:root.children.length};
 return level.launchArt;
}
