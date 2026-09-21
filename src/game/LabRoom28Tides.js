import * as THREE from 'three';

/** Two real communicating volumes. Local aperture height, submersion and
 * hydrostatic head determine the sign and the maximum possible transfer. */
export class Room28TideVolumes{
 constructor(){this.reset();}
 reset(){this.levels=[6,0];this.total=6;this.flow=0;this.transferred=0;}
 step(dt,connection=null){
  if(!Number.isFinite(dt)||dt<0)throw new RangeError('Nonnegative finite time required');
  this.flow=0;if(!connection||connection[0].basin===connection[1].basin||!dt)return;
  const [a,b]=connection;let remaining=dt,moved=0;
  for(let phase=0;phase<3&&remaining>1e-10;phase++){
   const ha=Math.max(0,this.levels[a.basin]-a.sill),hb=Math.max(0,this.levels[b.basin]-b.sill),difference=ha-hb;
   if(Math.abs(difference)<1e-10)break;
   const source=difference>0?a:b,target=difference>0?b:a,head=Math.abs(difference),dryGap=Math.max(0,target.sill-this.levels[target.basin]);
   const multiplier=dryGap>1e-10?1:2,root=Math.sqrt(head),after=Math.max(0,root-.11*multiplier*remaining);
   // Exact integration of q = .22 sqrt(head). A receiving aperture becoming
   // submerged is a real change of law, so advance exactly to that boundary.
   const amount=Math.min((head-after*after)/multiplier,dryGap>1e-10?dryGap:Infinity,6-this.levels[target.basin]);
   if(amount<1e-12)break;
   const elapsed=2*(root-Math.sqrt(Math.max(0,head-multiplier*amount)))/(.22*multiplier);
   this.levels[source.basin]-=amount;this.levels[target.basin]+=amount;this.transferred+=amount;moved+=(difference>0?1:-1)*amount;remaining-=elapsed;
  }
  this.flow=moved/dt;
 }
}

export function buildRoom28Tides(k,{a,b,ports}){
 const {game,world:w}=k,state=new Room28TideVolumes(),floats=[a,b];k.state.tides=state;
 const waterMat=new THREE.MeshStandardMaterial({color:0x13cfcf,emissive:0x075f77,emissiveIntensity:.3,transparent:true,opacity:.44,roughness:.26,metalness:.12,depthWrite:false});
 const waters=[-14,14].map(x=>{const m=game.box(x,0,0,9.6,1,11.6,waterMat,{parent:w.root,solid:false,camera:false,aim:false});m.name='Conserved turquoise tide volume';m.userData.keepMaterial=true;return m;});
 const columns=ports.map(({panel})=>{const f=panel.getFrame(),m=game.box(f.center.x,f.center.y,f.center.z+.16,.11,2,.11,new THREE.MeshBasicMaterial({color:0x71fff0}),{parent:w.root,solid:false,camera:false,aim:false});m.userData.keepMaterial=true;return m;});
 const endpoint=p=>{
  if(!p)return null;const spec=ports.find(x=>x.panel.mesh.uuid===p.surfaceId);if(!spec)return null;
  const right=new THREE.Vector3(1,0,0).applyQuaternion(p.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(p.quaternion);
  const vertical=Math.hypot(right.y*p.width,up.y*p.height);
  return {basin:spec.basin,sill:Math.max(0,p.position.y-vertical),portal:p,spec};
 };
 k.ticks.unshift(dt=>{
  const ends=game.portals.portals.map(endpoint),connected=ends.length===2&&ends.every(Boolean);state.step(dt,connected?ends:null);state.connection=connected?ends:null;
  floats.forEach((f,i)=>{f.target=state.levels[i]/6;f.rate=.5;waters[i].scale.y=Math.max(.02,state.levels[i]-.025);waters[i].position.y=waters[i].scale.y/2+.008;});
  columns.forEach((c,i)=>{const active=connected&&ends.some(e=>e.spec===ports[i])&&Math.abs(state.flow)>.0001;c.visible=active;if(active)c.scale.y=.25+Math.min(1.8,Math.abs(state.flow)*2);});
 });
 k.resets.push(()=>{state.reset();a.target=1;a.rate=Infinity;a.update(1);a.rate=.5;b.target=0;b.update(0);});
 return state;
}
