import * as THREE from 'three';
import {architecturalCassetteGeometry,clipArchitecturalRect} from './LabArchitecturalModels.js';
import {V} from './LabSingularityKit.js';
import {applyCastleMaterials} from './LabCastleMaterials.js';
import {buildCastleMechanismDetails} from './LabCastleMechanismDetails.js';

/** Art belongs to the already physical castle envelope. Large fittings occupy
 * real solids; only recessed seams and small fasteners are visual-only. */
export function buildSingularityArt({game,k,rooms,machines,edges,solved}){
 const m=k.m,geo=k.geo(architecturalCassetteGeometry({corner:.065,inset:.024}));geo.userData.architecturalBatch=true;
 const coat=k.mat(0xeee8d9,.73,.05);coat.vertexColors=true;
 const dusk=k.mat(0x354f63,.78,.13),alloy=k.mat(0xb9c3c5,.53,.35),maroon=k.mat(0x9a6277,.75,.1);
 // Matte mineral shells, cedar structure and satin machinery have distinct
 // values even in low quality. Saturated state lamps retain their meaning.
 m.wall.color.setHex(0xbdc7cc);m.floor.color.setHex(0xe5e0d3);m.floor.roughness=.79;m.dark.color.setHex(0x253f54);
 m.steel.color.setHex(0x748b98);m.steel.roughness=.61;m.copper.color.setHex(0xd4aa69);m.copper.roughness=.53;
 m.ivory.color.setHex(0xe7e9df);m.ivory.roughness=.70;m.ivory.metalness=.08;
 const finishes=applyCastleMaterials({game,k,rooms});
 const accents={freight:m.copper,sluice:m.mint,optics:m.cyan,hoist:m.copper,archive:maroon,flywheel:m.copper,magnet:m.violet,migrant:m.mint,pendulum:m.rose,inertia:m.cyan,crown:m.copper};
 const inset=(p,size,material=coat)=>k.mesh(geo,material,p,size);
 // Side-wall relief is clipped around actual ceramic addresses. All shapes
 // are a shallow skin on the existing wall; nothing enters collision or aim
 // registries, and no added floor can create a route around a puzzle.
 const portalFrames=k.panels.map(mesh=>{
  const f=mesh.userData.portalFrame?.();
  if(f)return{...f};
  const q=mesh.quaternion;
  return{center:mesh.userData.center,normal:mesh.userData.normal,right:V(1,0,0).applyQuaternion(q),up:V(0,1,0).applyQuaternion(q),halfWidth:mesh.userData.portalBounds?.halfWidth??mesh.scale.x/2,halfHeight:mesh.userData.portalBounds?.halfHeight??mesh.scale.y/2};
 }).filter(f=>f.center&&f.normal);
 function wallFace(r,side,offset,height,span,centreY,material){
  const [x,y,z]=r.def.at,frame={center:V(x+side*(r.def.w/2-.19),y,z),right:V(0,0,side),up:V(0,1,0),normal:V(-side,0,0)};
  const x0=offset*side-span/2,x1=offset*side+span/2;
  // Relief must leave the same entrance openings as the physical shell:
  // 6.8 m wide, from each entry landing to its 5 m lintel. The hoist also
  // has its authored upper landing; these cuts never change physical solids.
  const openings=[...portalFrames];
  const entrySide=r.def.entry==='w'?-1:r.def.entry==='e'?1:0;
  if(side===entrySide)for(const landing of [0,...(r.def.upperDoor?[r.def.upperDoor]:[])]){
   openings.push({...frame,center:V(r.door[0],y+landing+2.5,r.door[2]),halfWidth:3.4,halfHeight:2.5});
  }
  const pieces=clipArchitecturalRect({x0,x1,y0:centreY-height/2,y1:centreY+height/2},frame,openings);
  for(const p of pieces){
   const mesh=inset(frame.center.clone().addScaledVector(frame.right,(p.x0+p.x1)/2).addScaledVector(frame.up,(p.y0+p.y1)/2).toArray(),[p.x1-p.x0,p.y1-p.y0,.10],material);
   mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.right,frame.up,frame.normal));
   mesh.name='Castle attached wall relief / '+r.def.id;
  }
 }
 const profiles={
  freight:[[-.31,4.8,4.4,3.65],[0,4.8,4.4,3.65],[.31,4.8,4.4,3.65]],
  sluice:[[-.28,9,2.5,4.4],[.28,9,2.5,4.4]],
  optics:[[-.27,12,1.55,3.1],[.27,12,1.55,4.6]],
  hoist:[[-.33,5.8,4.6,3.65],[.33,5.8,4.6,3.65]],
  archive:[[-.32,4.7,4.8,3.5],[-.10,3.1,4.0,3.1],[.12,3.1,4.0,3.1],[.34,4.7,4.8,3.5]],
  flywheel:[[-.25,10,3.4,3.65],[.25,10,3.4,3.65]],
  magnet:[[-.30,6.2,3.7,3.85],[0,3.5,4.5,3.45],[.30,6.2,3.7,3.85]],
  migrant:[[-.28,11,1.6,3.2],[.28,11,1.6,3.2],[-.28,11,1.1,5],[.28,11,1.1,5]],
  pendulum:[[-.30,5.2,4.8,3.5],[.30,5.2,4.8,3.5]],
  inertia:[[-.30,8.8,1.3,2.8],[.30,8.8,1.3,4.5]],
  crown:[[-.28,7.2,4.6,3.7],[.28,7.2,4.6,3.7]],
 };
 for(const r of rooms.values()){
  const{def,b}=r,[x,y,z]=def.at,accent=finishes.wingAccents.get(def.id)??accents[def.id],face=finishes.wingFaces.get(def.id)??coat;
  // Broad relief faces have a real bevel and a dark recess behind them. Their
  // wall skins leave authored entrance and portal openings clear.
  for(const side of [-1,1]){
   for(const [offset,span,height,centreY]of profiles[def.id]??profiles.freight){
    wallFace(r,side,offset*def.d,height,span,centreY,face);
   }
   wallFace(r,side,0,1.6,def.d-2.2,def.h-1.3,dusk);
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
  // The archive's tall leaf pattern is already carried by its wall relief;
  // avoid a second layer of coplanar panels over the same large face.
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
 const lamps=new Map();for(const r of rooms.values()){const lamp=k.box([r.door[0],r.door[1]+4.6,r.door[2]],[.4,.10,.12],m.idle,{solid:false,dynamic:true});lamps.set(r.def.id,lamp);}
 return{update(){mechanisms.update();for(const[id,mesh]of lamps)mesh.material=solved.has(id)?m.live:m.idle;},dispose(){mechanisms.dispose();},profile:'folded-castle-five-storeys',geometrySource:'authored-bevelled-cassettes-and-physical-ribs',artDirection:'eleven-wing-mineral-cedar-and-satin',finishes};
}
