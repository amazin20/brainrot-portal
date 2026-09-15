import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
/** Reduced counterweighted actuator, driven only by real cargo contact and brake.
 * Not a dynamic mass/energy solver. No selected object IDs, portal or victory flags.
 * The portal frame is the moving ceramic's real world transform. */
export function buildPocketCassette(k,seat) {
 const g=k.game,w=k.world,root=new THREE.Group();root.name='Counterweighted portal cassette';w.root.add(root);
 const low=3.8,high=15.8,normal=[.45,Math.sqrt(1-.45**2),0];
 root.position.set(-10,high,-6);
 const face=k.panel('moving-cassette',[0,0,0],normal,6,6,root,true);
 face.collider.frontPlane=()=>face.getFrame();
 const shell=new THREE.MeshStandardMaterial({name:'Cassette coated graphite',color:0x36565d,roughness:.55,metalness:.28});
 const metal=new THREE.MeshStandardMaterial({name:'Cassette guide alloy',color:0x869d9e,roughness:.38,metalness:.64});
 const accent=new THREE.MeshStandardMaterial({name:'Cassette warm edge',color:0xc5a66a,roughness:.5,metalness:.25});
 const glass=new THREE.MeshStandardMaterial({name:'Protected counterweight inspection glass',color:0x83b4bd,roughness:.24,transparent:true,opacity:.24,depthWrite:false});
 const part=(p,s,mat=shell,solid=true,parent=w.root)=>{
  const m=w.box(p,s,mat,solid,parent),old=m.geometry;
  m.geometry=new RoundedBoxGeometry(...s,2,Math.min(.07,...s.map(v=>v*.22)));old.dispose();return m;
 };
 part([0,0,-.36],[6.55,6.55,.46],shell,false,face.group);
 for(const x of [-3.28,3.28])part([x,0,-.10],[.16,6.55,.30],accent,false,face.group);
 for(const y of [-3.28,3.28])part([0,y,-.10],[6.55,.16,.30],metal,false,face.group);
 for(const z of [-9.8,-2.2]) {
  part([-10,12.025,z],[.35,24.05,.35],metal);
  part([-10,.18,z],[1.2,.36,1.2],shell);
 }
 part([-10,24.3,-6],[2.4,.5,9.2],metal);
 // Rear inspection window: the weight can be seen from the brake bay, but
 // actual glass collision still closes the housing. Its frame is structural.
 part([-12.8,2.25,-6],[.65,4.5,9]);
 part([-12.8,20.75,-6],[.65,6.5,9]);
 for(const z of [-9.75,-2.25])part([-12.8,11,z],[.65,13,1.5]);
 const pane=w.box([-12.8,11,-6],[.14,13,6],glass);
 pane.name='Counterweight inspection glass / solid';
 for(const z of [-9,-3])part([-12.8,11,z],[.25,13,.13],metal);
 for(const y of [4.5,17.5])part([-12.8,y,-6],[.25,.13,6],metal);
 part([-9,12,-10.7],[8.3,24,.55]);
 part([-9,18,-1.3],[8.3,12,.55]);
 // Two output mouths are literal openings in one continuous dark casing.
 part([-5,3,-6],[.65,6,9.4]);
 part([-5,16.5,-6],[.65,3,9.4]);
 part([-5,26.5,-6],[.65,5,9.4]);
 // Edge rails around the output bays do not occupy their flight aperture.
 for(const y of [6,15,18,24])part([-4.64,y,-6],[.06,.10,9.25],accent,false);
 const weight=part([-11.9,4,-6],[.7,4,5.5],metal,false);
 const brake=part([-13.3,6.5,-10],[.8,.24,1.2],accent,false);
 const ropes=[],wheels=[];
 for(const z of [-9.65,-2.35]){
  const r=w.box([-10,20,z],[.055,1,.055],metal,false);ropes.push(r);
  const wheel=new THREE.Mesh(new THREE.TorusGeometry(.28,.065,8,24),accent);
  wheel.rotation.y=Math.PI/2;wheel.position.set(-10,24.05,z);w.root.add(wheel);wheels.push(wheel);
 }
 let height=high,previous=high;
 const state={face,root,low,high,height,braked:true,loaded:false,
  toggleBrake(){state.braked=!state.braked;g.audio?.mechanism?.('switch');},
  pose(y){root.position.y=y;root.updateWorldMatrix(true,true);weight.position.y=4+(high-y)*.78;
   brake.position.x=state.braked?-13:-13.8;
   for(const r of ropes){const length=24-y;r.position.y=y+length/2;r.scale.y=Math.max(.01,length);}
   for(const wheel of wheels)wheel.rotation.x=(high-y)/.28;
  },
 };
 k.ticks.push(dt=>{
  previous=height;state.loaded=seat.loaded();
  if(!state.braked){const target=state.loaded?low:high;height+=THREE.MathUtils.clamp(target-height,-3.5*dt,3.5*dt);}
  state.height=height;state.pose(height);
  face.collider.box.setFromObject(face.mesh);
  g.physics?.updateStaticBox(face.mesh.uuid,face.collider.box,dt);
 });
 k.renders.push(alpha=>state.pose(THREE.MathUtils.lerp(previous,height,alpha)));
 k.resets.push(()=>{height=previous=high;state.height=high;state.braked=true;state.loaded=false;state.pose(high);});
 state.pose(high);return state;
}

/** Mounted arrival marker, not another portal or interactive machine. */
export function addPocketExitMarker(k,[x,y,z]) {
 const w=k.world,frame=new THREE.MeshStandardMaterial({name:'Arrival painted frame',color:0xa77e4b,roughness:.5,metalness:.3});
 const lamp=new THREE.MeshBasicMaterial({color:0xb5ead8}),ink=new THREE.MeshBasicMaterial({color:0x1d3b3b});
 const part=(p,s,mat,solid=true)=>{const m=w.box(p,s,mat,solid),old=m.geometry;
  m.geometry=new RoundedBoxGeometry(...s,2,Math.min(.08,...s.map(n=>n*.22)));old.dispose();return m;};
 const back=z-1.4;
 for(const side of [-1,1]){
  part([x+side*2.2,y+1.9,back],[.32,3.8,.40],frame);
  part([x+side*2.01,y+1.9,back+.22],[.07,3.4,.045],lamp,false);
  part([x+side*2.2,y+.08,back],[.75,.16,.80],frame);
 }
 part([x,y+3.7,back],[4.72,.90,.40],frame);
 const glyphs=['11110/10001/11110/10001/11110','10001/10001/11101/10101/11101','10001/01010/00100/01010/10001','01110/10001/10001/10001/01110','01110/01010/01010/11111/10001'];
 const cells=[];glyphs.forEach((letter,n)=>letter.split('/').forEach((row,r)=>[...row].forEach((v,c)=>{if(v==='1')cells.push([n*6+c,r]);})));
 const display=new THREE.InstancedMesh(new THREE.BoxGeometry(.108,.108,.016),ink,cells.length),m=new THREE.Matrix4();
 cells.forEach(([col,row],i)=>{m.makeTranslation(x+(col-14)*.132,y+3.98-row*.132,back+.215);display.setMatrixAt(i,m);});
 display.name='Mounted ВЫХОД legend';display.computeBoundingSphere();w.root.add(display);
}
