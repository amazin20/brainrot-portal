import * as THREE from 'three';
import {architecturalCassetteGeometry} from './LabArchitecturalModels.js';
import {V} from './LabSingularityKit.js';
import {applyCastleMaterials} from './LabCastleMaterials.js';
import {buildCastleMechanismDetails} from './LabCastleMechanismDetails.js';

/** Art belongs to the already physical castle envelope. Large fittings occupy
 * real solids; only recessed seams and small fasteners are visual-only. */
export function buildSingularityArt({game,k,rooms,machines,edges,solved}){
 const m=k.m,geo=k.geo(architecturalCassetteGeometry({corner:.028,inset:.018}));geo.userData.architecturalBatch=true;
 const coat=k.mat(0xe0dccc,.73,.05);coat.vertexColors=true;
 const dusk=k.mat(0x35424e,.8,.13),alloy=k.mat(0xa6a8a3,.57,.37),maroon=k.mat(0x674353,.79,.1);
 // Warm mineral walls and satin faces contrast with cool shaded steel. Large
 // quiet faces retain the hierarchy; signal colour is reserved for controls.
 m.wall.color.setHex(0x78838b);m.floor.color.setHex(0xc9c8b8);m.floor.roughness=.87;m.dark.color.setHex(0x27313d);
 m.steel.color.setHex(0x53616b);m.steel.roughness=.65;m.copper.color.setHex(0xb58b61);m.copper.roughness=.57;
 const accents={freight:m.copper,sluice:m.mint,optics:m.cyan,hoist:m.copper,archive:maroon,flywheel:m.copper,magnet:m.violet,migrant:m.mint,pendulum:m.rose,inertia:m.cyan,crown:m.copper};
 const inset=(p,size,material=coat)=>k.mesh(geo,material,p,size);
 for(const r of rooms.values()){
  const{def,b}=r,[x,y,z]=def.at,accent=accents[def.id];
  // Broad relief faces have a real bevel and a dark recess behind them. They
  // sit above walking height and do not cover a portal or alter its material.
  for(const side of [-1,1]){
   for(const t of [-.31,.31]){
    inset([x+side*(def.w/2-.19),y+4.4,z+t*def.d],[.10,3.45,Math.min(8,def.d*.22)]);
    k.decor([x+side*(def.w/2-.10),y+1.1,z+t*def.d],[.09,.20,Math.min(8,def.d*.22)],accent);
   }
   inset([x+side*(def.w/2-.2),y+def.h-1.3,z],[.12,1.6,def.d-2.2],dusk);
  }
  // Lintel shoes and seam keep the entrance visibly attached to both piers.
  const isX=def.entry==='e'||def.entry==='w';
  for(const sign of [-1,1]){
   const p=[r.door[0]+(isX?0:sign*3.6),y+2.5,r.door[2]+(isX?sign*3.6:0)];
   inset(p,isX?[.18,4.8,.30]:[.30,4.8,.18],alloy);
   k.decor([p[0],y+.25,p[2]],isX?[.23,.24,.55]:[.55,.24,.23],dusk);
  }
  for(const dx of [-def.w*.32,def.w*.32]){
   k.decor([x+dx,y+def.h-.12,z],[.18,.08,def.d*.62],m.lamp);
   inset([x+dx,y+def.h-.32,z],[.55,.16,def.d*.68],dusk);
  }
  // Each wing uses a different large structural silhouette rather than a new
  // collection of tiny unrelated props. All lie in existing shell envelopes.
  if(def.id==='archive')for(let i=0;i<4;i++)inset([x-def.w/2+.15,y+3,z+(i-1.5)*5],[.12,4.8,3.8],maroon);
  if(def.id==='hoist')for(const dx of [-4,4])for(const dy of [4,10,16,22])inset([x+dx,y+dy,z],[.66,.65,.70],alloy);
  if(def.id==='sluice')for(const dx of [-14,0,14])k.decor([x+dx,y+11,z-10],[1.6,.3,1.6],dusk);
  if(def.id==='inertia')for(const dy of [2,6,10])inset([x-def.w/2+.15,y+dy,z],[.11,.45,def.d*.72],accent);
  // Separate supported roof silhouettes are visible across the same atrium.
  // Their tops stay below any directly overlaid playable storey.
  const roofs={freight:[[.72,.66,.65,.84,0,0]],hoist:[[.76,.82,.9,1.0,0,0],[.47,.66,.8,1.85,0,0],[.20,.55,.65,2.58,0,0]],archive:[[.74,.72,.75,1.0,0,0],[.48,.54,.65,1.72,-2,0]],pendulum:[[.78,.65,.8,1.0,0,3],[.50,.44,.7,1.8,3,3]],crown:[[.83,.8,.85,1.0,0,0],[.60,.65,.8,1.85,0,0],[.35,.49,.65,2.57,0,0]]};
  for(const[sw,sd,sh,dy,dx,dz]of roofs[def.id]??[]){
   k.box([x+dx,y+def.h+dy,z+dz],[def.w*sw,sh,def.d*sd],dusk);
   k.decor([x+dx,y+def.h+dy+sh/2+.025,z+dz],[def.w*sw+.24,.05,def.d*sd+.24],accent);
  }
  if(def.id==='flywheel')for(const side of [-1,1]){
   k.box([x+side*6,y+def.h+1.1,z],[.7,1.7,def.d*.67],dusk);
   k.box([x+side*6,y+def.h+2.05,z],[1.7,.25,def.d*.73],accent);
  }
 }
 // Solid balcony decks receive underside support beams. They terminate in
 // existing vertical ribs, giving every span a visible construction joint.
 for(const[a,b]of edges){if(Math.abs(a[1]-b[1])>.01||Math.max(Math.abs(a[0]-b[0]),Math.abs(a[2]-b[2]))<8)continue;
  const alongX=Math.abs(a[0]-b[0])>Math.abs(a[2]-b[2]),p=[(a[0]+b[0])/2,a[1]-.68,(a[2]+b[2])/2];
  k.box(p,alongX?[Math.abs(a[0]-b[0]),.56,.7]:[.7,.56,Math.abs(a[2]-b[2])],dusk);
  for(const t of [.2,.8])inset([a[0]+(b[0]-a[0])*t,a[1]-.64,a[2]+(b[2]-a[2])*t],alongX?[.42,.50,1.1]:[1.1,.50,.42],alloy);
 }
 // A hanging light well occupies the central void above ordinary transit. It
 // is backed by physical beams and does not introduce floating walkway props.
 for(const y of [13,31,49,67,89]){
  k.box([5,y,-8],[15,.6,.6],dusk);k.box([5,y,8],[15,.6,.6],dusk);
  for(const x of [-2,12])k.box([x,y,0],[.6,.6,16],dusk);
  k.decor([5,y-.35,-8],[11,.06,.06],m.lamp);
 }
 const mechanisms=buildCastleMechanismDetails({game,k,rooms,machines});
 applyCastleMaterials({game,k,rooms});
 const lamps=new Map();for(const r of rooms.values()){const lamp=k.box([r.door[0],r.door[1]+4.6,r.door[2]],[.4,.10,.12],m.idle,{solid:false,dynamic:true});lamps.set(r.def.id,lamp);}
 return{update(){mechanisms.update();for(const[id,mesh]of lamps)mesh.material=solved.has(id)?m.live:m.idle;},dispose(){mechanisms.dispose();},profile:'folded-castle-five-storeys',geometrySource:'authored-bevelled-cassettes-and-physical-ribs'};
}
