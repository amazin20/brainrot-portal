import * as THREE from 'three';
const V=(...a)=>new THREE.Vector3(...a);
/** Reduced counterweighted actuator, driven only by real cargo contact and brake.
 * Not a dynamic mass/energy solver. No selected object IDs, portal or victory flags.
 * The portal frame is the moving ceramic's real world transform. */
export function buildPocketCassette(k,seat) {
 const g=k.game,w=k.world,root=new THREE.Group();root.name='Counterweighted portal cassette';w.root.add(root);
 const low=3.8,high=15.8,normal=[.45,Math.sqrt(1-.45**2),0];
 root.position.set(-10,high,-6);
 const face=k.panel('moving-cassette',[0,0,0],normal,6,6,root,true);
 face.collider.frontPlane=()=>face.getFrame();
 // Thick working panel, rails, rollers and suspended counterweight; all locally owned.
 const metal=new THREE.MeshStandardMaterial({color:0x48666c,roughness:.44,metalness:.60});
 const accent=new THREE.MeshStandardMaterial({color:0xd5b781,roughness:.5,metalness:.25});
 w.box([0,0,-.32],[6.4,6.4,.40],metal,false,face.group);
 for(const x of [-3.28,3.28])w.box([x,0,-.12],[.16,6.5,.30],accent,false,face.group);
 for(const z of [-9.8,-2.2]) {
  w.box([-10,10,z],[.35,20,.35],metal);
  w.box([-10,.18,z],[1.2,.36,1.2],metal);
 }
 w.box([-10,24.3,-6],[2.4,.5,9.2],metal);
 w.box([-12.8,12,-6],[.65,24,9],w.materials.wall);
 w.box([-9,12,-10.7],[8.3,24,.55],w.materials.wall);
 w.box([-9,18,-1.3],[8.3,12,.55],w.materials.wall);
 // Two generous output mouths are literal openings in one casing.
 // Lower shots cannot reach the high ceramic through the intermediate floor.
 w.box([-5.0,3.0,-6],[.65,6.0,9.4],w.materials.wall);
 w.box([-5.0,16.5,-6],[.65,3.0,9.4],w.materials.wall);
 w.box([-5.0,26.5,-6],[.65,5.0,9.4],w.materials.wall);
 const weight=w.box([-11.9,4,-6],[.7,4,5.5],metal,false);
 const brake=w.box([-13.3,6.5,-10],[.8,.24,1.2],accent,false);
 const ropes=[];
 for(const z of [-9.65,-2.35]){
  const r=w.box([-10,20,z],[.055,1,.055],metal,false);ropes.push({r,z});
 }
 let height=high,previous=high;
 const state={face,root,low,high,height,braked:true,loaded:false,
  toggleBrake(){state.braked=!state.braked;g.audio?.mechanism?.('switch');},
  pose(y){root.position.y=y;root.updateWorldMatrix(true,true);weight.position.y=4+(high-y)*.78;
   brake.position.x=state.braked?-13.0:-13.8;
   for(const {r} of ropes){const length=24-y;r.position.y=y+length/2;r.scale.y=Math.max(.01,length);}},
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
