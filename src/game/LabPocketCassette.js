import * as THREE from 'three';
import { attachPocketLoadLink } from './LabPocketLoadLink.js';
import { createPocketSuspension } from './LabPocketSuspension.js';
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
 // The oblique square's backing reaches x=-14.15. Recess the central
 // inspection window, not the whole side jamb: a full rectangular expansion
 // would obstruct the established shot from the departure gallery to the brake.
 // This folded profile changes real visible skins AND their collisions.
 const rearX=-14.35, cheekLeft=rearX-.07, cheekRight=-12.475;
 const casing=(name,p,size,mat=shell)=>{
  const mesh=part(p,size,mat);mesh.name=name;
  mesh.userData.cassetteEnclosure=true;return mesh;
 };
 casing('Cassette rear plinth / solid',[rearX,2.25,-6],[.14,4.5,6]);
 casing('Cassette rear header / solid',[rearX,20.75,-6],[.14,6.5,6]);
 // Side pockets stay on their previous x axis, supporting the existing guides.
 for(const z of [-10.0875,-1.9125])
  casing('Cassette rear window jamb / solid',[-12.8,12,z],[.65,24,2.175]);
 const pane=w.box([rearX,11,-6],[.14,13,6],glass);
 pane.name='Counterweight inspection glass / solid';pane.userData.cassetteEnclosure=true;
 for(const z of [-9,-3]){
  casing('Cassette rear folded cheek / solid',[(cheekLeft+cheekRight)/2,12,z],[cheekRight-cheekLeft,24,.16]);
  casing('Cassette rear vertical glazing rail / solid',[rearX,11,z],[.14,13,.13],metal);
 }
 for(const y of [4.5,17.5])casing('Cassette rear horizontal glazing rail / solid',[rearX,y,-6],[.14,.13,6],metal);
 // Both side skins clear the moving rim by >15 cm. Their x extents and the
 // protected return at x=-2.05 remain unchanged. No invisible shot veto.
 casing('Cassette north enclosure / solid',[-9,12,-10.9],[8.3,24,.55]);
 casing('Cassette upper side return / solid',[-7.6,18,-1.1],[11.1,12,.55]);
 // Two output mouths are literal openings in one continuous dark casing.
 part([-5,3,-6],[.65,6,9.4]);
 part([-5,16.5,-6],[.65,3,9.4]);
 part([-5,26.5,-6],[.65,5,9.4]);
 // Edge rails around the output bays do not occupy their flight aperture.
 for(const y of [6,15,18,24])part([-4.64,y,-6],[.06,.10,9.25],accent,false);
 const suspension=createPocketSuspension({shell,metal,accent});w.root.add(suspension.root);
 const brake=part([-13.3,6.5,-10],[.8,.24,1.2],accent,false);
 let height=high,previous=high;
 const state={face,root,low,high,height,braked:true,loaded:false,suspension,
  toggleBrake(){state.braked=!state.braked;g.audio?.mechanism?.('switch');},
  pose(y){root.position.y=y;root.updateWorldMatrix(true,true);suspension.pose(y);
   brake.position.x=state.braked?-13:-13.8;
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
 state.pose(high);
 attachPocketLoadLink(k,seat);
 return state;
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
