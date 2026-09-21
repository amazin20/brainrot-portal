import * as THREE from 'three';

/** Two real communicating volumes. Local aperture height, submersion and
 * hydrostatic head determine the sign and the maximum possible transfer. */
export class Room28TideVolumes{
 constructor(){this.reset();}
 reset(){this.levels=[6,0];this.total=6;this.flow=0;this.transferred=0;}
 step(dt,connection=null){
  if(!Number.isFinite(dt)||dt<0)throw new RangeError('Nonnegative finite time required');
  this.flow=0;if(!connection||connection[0].basin===connection[1].basin||!dt)return;
  const [a,b]=connection,headA=Math.max(0,this.levels[a.basin]-a.sill),headB=Math.max(0,this.levels[b.basin]-b.sill),difference=headA-headB;
  if(Math.abs(difference)<1e-8)return;
  const source=difference>0?a:b,target=difference>0?b:a,sourceHead=Math.max(headA,headB),targetHead=Math.min(headA,headB);
  // Crossing the receiving sill changes the hydrostatic law. Substeps make
  // arbitrary update durations agree without overshooting equilibrium.
  const amount=Math.min(.22*Math.sqrt(Math.abs(difference))*dt,sourceHead,(sourceHead-targetHead)/(targetHead>0?2:1),6-this.levels[target.basin]);
  this.levels[source.basin]-=amount;this.levels[target.basin]+=amount;this.flow=(difference>0?1:-1)*amount/dt;this.transferred+=amount;
 }
}

export function buildRoom28Tides(k,{a,b,ports}){
 const {game,world:w}=k,state=new Room28TideVolumes(),floats=[a,b];k.state.tides=state;
 const waterMat=new THREE.MeshStandardMaterial({color:0x13cfcf,emissive:0x075f77,emissiveIntensity:.3,transparent:true,opacity:.54,roughness:.26,metalness:.24,depthWrite:false});
 const waters=[-14,14].map(x=>{const m=w.box([x,0,0],[8.6,.10,x<0?10.6:7.6],waterMat,false);m.userData.keepMaterial=true;return m;});
 const columns=ports.map(({panel})=>{const f=panel.getFrame(),m=w.box([f.center.x,f.center.y,f.center.z+.16],[.11,2,.11],new THREE.MeshBasicMaterial({color:0x71fff0}),false);m.userData.keepMaterial=true;return m;});
 const endpoint=p=>{
  if(!p)return null;const spec=ports.find(x=>x.panel.mesh.uuid===p.surfaceId);if(!spec)return null;
  const right=new THREE.Vector3(1,0,0).applyQuaternion(p.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(p.quaternion);
  const vertical=Math.hypot(right.y*p.width,up.y*p.height);
  return {basin:spec.basin,sill:Math.max(0,p.position.y-vertical),portal:p,spec};
 };
 k.ticks.unshift(dt=>{
  const ends=game.portals.portals.map(endpoint),connected=ends.length===2&&ends.every(Boolean);state.step(dt,connected?ends:null);state.connection=connected?ends:null;
  floats.forEach((f,i)=>{f.target=state.levels[i]/6;f.rate=.5;waters[i].position.y=state.levels[i]-.055;});
  columns.forEach((c,i)=>{const active=connected&&ends.some(e=>e.spec===ports[i])&&Math.abs(state.flow)>.0001;c.visible=active;if(active)c.scale.y=.25+Math.min(1.8,Math.abs(state.flow)*2);});
 });
 k.resets.push(()=>{state.reset();a.target=1;a.rate=Infinity;a.update(1);a.rate=.5;b.target=0;b.update(0);});
 return state;
}
