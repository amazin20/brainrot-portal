import * as THREE from 'three';
import {manufacturedBulkheadGeometry} from './LabManufacturedFinish.js';

const V=(...v)=>new THREE.Vector3(...v),Q=()=>new THREE.Quaternion();
const Z=V(0,0,1);

function cutLoop(width,height,cut){
 const x=width/2,y=height/2,c=Math.min(cut,width*.22,height*.22);
 return [[-x+c,-y],[x-c,-y],[x,-y+c],[x,y-c],[x-c,y],[-x+c,y],[-x,y-c],[-x,-y+c]];
}

/** A folded octagonal frame, with a genuinely open centre. The bevel belongs
 * to the manufactured profile rather than being another glowing overlay. */
function foldedFrame(width,height,depth,rim,cut=.8){
 const shape=new THREE.Shape(),outer=cutLoop(width,height,cut);
 outer.forEach((p,i)=>i?shape.lineTo(...p):shape.moveTo(...p));shape.closePath();
 const inner=cutLoop(width-2*rim,height-2*rim,Math.max(.12,cut-rim*.58)).reverse();
 const hole=new THREE.Path();inner.forEach((p,i)=>i?hole.lineTo(...p):hole.moveTo(...p));hole.closePath();shape.holes.push(hole);
 const bevel=Math.min(.06,rim*.14,depth*.16);
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:depth-2*bevel,steps:1,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1,curveSegments:1});
 geometry.translate(0,0,-depth/2+bevel);return geometry;
}

function foldedPanel(width,height,depth,cut=.6){
 const shape=new THREE.Shape();cutLoop(width,height,cut).forEach((p,i)=>i?shape.lineTo(...p):shape.moveTo(...p));shape.closePath();
 const bevel=Math.min(.06,depth*.16);
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:depth-2*bevel,steps:1,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1,curveSegments:1});
 geometry.translate(0,0,-depth/2+bevel);return geometry;
}

function chassisProfile(width,depth){
 const cut=Math.min(1.8,width*.12,depth*.12),points=[];
 const loop=(w,d,y,c)=>cutLoop(w,d,c).map(([x,z])=>[x,y,z]);
 const top=loop(width,depth,0,cut),bottom=loop(width-1.1,depth-1.1,-.9,Math.max(.3,cut-.4));
 const tri=(a,b,c)=>points.push(...a,...b,...c);
 for(let i=0;i<8;i++){
  const j=(i+1)%8;tri(top[i],bottom[i],bottom[j]);tri(top[i],bottom[j],top[j]);
  tri([0,0,0],top[j],top[i]);tri([0,-.9,0],bottom[i],bottom[j]);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.computeVertexNormals();
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(points.length/3*2),2));return geometry;
}

function removeBatchedMesh(k,mesh){
 if(!mesh)return;const bin=k.artBins.get(mesh.material),at=bin?.indexOf(mesh)??-1;
 if(at>=0)bin.splice(at,1);mesh.removeFromParent();mesh.geometry.dispose();
}

function foldedBulkhead(width,height,depth){
 const geometry=manufacturedBulkheadGeometry(width,height,depth);
 // The coloured finish is shared with uncoloured frame geometry. Integral
 // folds still have real depth and normals; no separate baked-light overlay.
 geometry.deleteAttribute('color');return geometry;
}

/** Artwork for the one authored spatial pilot. Large mint loading-bay frames,
 * a warm receiving gallery, and a readable lower service level replace the
 * generic room silhouette. All of this is cladding on existing wall/deck
 * volumes. It adds no colliders, floors, aim blockers or portal candidates. */
export function dressPuzzlePilot43(k,refs={}){
 const ownedMaterials=[
  new THREE.MeshStandardMaterial({name:'Pilot / sea-glass folded architecture',color:0x529d95,roughness:.55,metalness:.14}),
  new THREE.MeshStandardMaterial({name:'Pilot / warm terracotta gallery enamel',color:0xcf8f71,roughness:.59,metalness:.10}),
  new THREE.MeshStandardMaterial({name:'Pilot / bone mineral soffit',color:0xc9d5c3,roughness:.84,metalness:.025}),
  new THREE.MeshBasicMaterial({name:'Pilot / shielded amber instrument diffuser',color:0xffca76}),
 ];
 const [mint,coral,mineral,amber]=ownedMaterials;
 const arch=(p,width,height,mat,{normal=[0,0,1],depth=.52,rim=.9,cut=2.4,parent=k.world.root}={})=>
  k.geometry(foldedFrame(width,height,depth,rim,cut),mat,p,Q().setFromUnitVectors(Z,V(...normal)),{parent,batch:parent===k.world.root,name:'Pilot / continuous folded architectural frame'});
 const panel=(p,width,height,mat,{normal=[0,0,1],depth=.30,cut=.65,parent=k.world.root}={})=>
  k.geometry(foldedPanel(width,height,depth,cut),mat,p,Q().setFromUnitVectors(Z,V(...normal)),{parent,batch:parent===k.world.root,name:'Pilot / chamfered structural cassette'});
 const part=(p,s,mat=k.m.dark,bevel=.07)=>k.block(p,s,mat,false,k.world.root,bevel);

 // The first camera sees the button's north cheek before the remote wall art.
 // Treat that cheek as one actual instrument enclosure, inside its original
 // seven-by-twelve-metre box, instead of another featureless grey obstacle.
 const replaceWall=(p,size,material)=>{
  const old=k.world.root.children.find(o=>o.isMesh&&!o.userData?.collisionProxy&&
   o.position.toArray().every((v,i)=>Math.abs(v-p[i])<.001)&&
   ['width','height','depth'].every((key,i)=>Math.abs((o.geometry.parameters?.[key]??0)-size[i])<.001));
  if(!old)return false;removeBatchedMesh(k,old);
  const axis=size[0]<size[2]?'x':'z',width=axis==='x'?size[2]:size[0],depth=axis==='x'?size[0]:size[2];
  k.geometry(foldedBulkhead(width,size[1],depth),material,p,axis==='x'?Q().setFromAxisAngle(UP,Math.PI/2):Q(),{name:'Pilot / integral engineered observation casing'});
  return true;
 };
 const UP=V(0,1,0);
 if(replaceWall([-20.5,6,9],[7,12,.55],coral)){
  arch([-20.5,6,9.185],6.45,11.30,k.m.dark,{depth:.08,rim:.19,cut:.52});
  panel([-20.5,6,9.15],5.96,10.79,mint,{depth:.10,cut:.42});
  panel([-20.5,2.15,9.205],5.28,2.35,k.m.dark,{depth:.07,cut:.22});
  for(const x of [-22.45,-21.8,-21.15,-20.5,-19.85,-19.2,-18.55])
   part([x,2.15,9.252],[.23,1.57,.035],k.m.metal,.009);
  panel([-20.5,10.25,9.21],4.65,.63,coral,{depth:.07,cut:.17});
  // The large panel has an intentional flange and two assembly joints. A
  // single load indicator reports the existing real button's live state.
  for(const y of [4.1,8.05])part([-20.5,y,9.205],[5.28,.065,.035],k.m.dark,.008);
  const status=new THREE.MeshBasicMaterial({name:'Pilot / live weighted observation indicator',color:0xf0bd74});ownedMaterials.push(status);
  part([-17.48,6.2,9.225],[.10,7.8,.065],status,.015);
  let previous;
  const read=()=>{const loaded=Boolean(refs.button?.pressed);if(loaded!==previous){previous=loaded;status.color.setHex(loaded?0x89eac7:0xf0bd74);}};
  k.renders.push(read);k.resets.push(()=>{previous=undefined;read();});read();
  for(const x of [-23.53,-17.47])for(const y of [1.0,10.9])
   k.geometry(new THREE.CylinderGeometry(.11,.11,.05,8),k.m.metal,[x,y,9.24],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{name:'Pilot / instrument cheek fastening'});
 }

 // The observation building is coloured at the scale people actually see:
 // a folded mint foundation, a terracotta head housing, and a deep inspection
 // vestibule. Existing collision volumes and the whole y=12..22 sight window
 // stay exactly as authored. There is no new decorative beam across that ray.
 if(replaceWall([-18,4,-6],[20,16,1],mint)){
  arch([-18,4,-5.555],18.9,14.9,k.m.dark,{depth:.055,rim:.16,cut:.72});
  panel([-18,10.97,-5.70],18.8,1.15,coral,{depth:.32,cut:.29});
  panel([-18,-2.60,-5.70],18.8,1.55,k.m.dark,{depth:.32,cut:.3});
  for(const x of [-26.55,-9.45])panel([x,3.9,-5.67],1.05,10.5,mineral,{depth:.23,cut:.24});
 }
 if(replaceWall([-18,27,-6],[20,10,1],coral)){
  arch([-18,27,-5.555],18.9,8.9,k.m.dark,{depth:.055,rim:.16,cut:.65});
  panel([-18,30.18,-5.70],17.6,1.05,mineral,{depth:.32,cut:.25});
  part([-18,22.50,-5.56],[17.3,.10,.055],amber,.012);
 }
 replaceWall([-20,23.5,-8],[12,17,.6],coral);
 replaceWall([-20,23.5,-17],[12,17,.6],mint);
 replaceWall([-14,23.5,-12.5],[.6,17,9],mint);
 replaceWall([-26,27.5,-12.5],[.7,9,9],coral);

 // Give the existing moving shutter a folded front and inset channels inside
 // the exact same .7 m depth. Physics still measures this same leaf object.
 const leaf=refs.shutter?.leaf;
 if(leaf?.geometry&&leaf.parent===refs.shutter?.group){
  const old=leaf.geometry;leaf.geometry=foldedBulkhead(20,10,.7);leaf.material=mint;old.dispose();
  const parent=refs.shutter.group;
  arch([0,0,.265],18.9,8.9,k.m.dark,{depth:.06,rim:.16,cut:.62,parent});
  panel([0,0,.265],15.3,6.3,coral,{depth:.06,cut:.65,parent});
  for(const y of [-2.1,0,2.1])panel([0,y,.315],14.4,.27,k.m.dark,{depth:.035,cut:.08,parent});
 }

 // The tall rear loading bay is fixed to the real building. Its 28 m opening
 // stays behind the gallery panel at z=-24; it never becomes another route.
 arch([-17,12.1,-28.98],22,30,mint,{depth:.56,rim:1.1,cut:2.8});
 arch([-17,12.1,-28.62],19.55,27.55,k.m.dark,{depth:.12,rim:.15,cut:2.0});
 for(const x of [-27.4,-6.6]){
  panel([x,-2.3,-28.93],1.65,2.7,k.m.metal,{depth:.50,cut:.25});
  panel([x,23.8,-28.70],1.1,3.8,coral,{depth:.15,cut:.35});
 }
 part([-17,26.38,-28.65],[13.1,.13,.11],amber,.015);
 // A deep head cassette gives the chamber a distinctive silhouette even in
 // a distant third-person view. Broad surfaces keep the porcelain legible.
 panel([-17,28.85,-28.89],21.2,2.1,mineral,{depth:.36,cut:.55});
 for(const x of [-23.5,-10.5])part([x,28.85,-28.65],[2.25,.15,.12],k.m.metal,.02);

 // The destination belongs to another architectural bay, visibly higher and
 // warmer. The open frame is behind the receiving deck and grounded at -3 m.
 arch([15,12.3,26.99],20,30.6,coral,{normal:[0,0,-1],depth:.52,rim:1.0,cut:2.6});
 arch([15,12.3,26.66],17.8,28.35,k.m.dark,{normal:[0,0,-1],depth:.13,rim:.13,cut:1.9});
 panel([15,28.85,27.03],18.4,2.1,mineral,{normal:[0,0,-1],depth:.36,cut:.55});
 part([15,26.52,26.66],[12.3,.13,.11],amber,.015);
 for(const x of [5.8,24.2])panel([x,-2.1,27.00],1.55,3.0,k.m.metal,{normal:[0,0,-1],depth:.45,cut:.24});

 // Broad service cassettes on the EAST boundary describe the lower recovery
 // level. Their shallow front remains inside the existing wall rib envelope;
 // the ramp at the opposite wall and the falling/launching volumes stay open.
 for(const z of [-14,2,18]){
  panel([27.23,-.3,z],12.5,5.2,mint,{normal:[-1,0,0],depth:.16,cut:.9});
  panel([27.12,-.3,z],10.8,3.9,k.m.dark,{normal:[-1,0,0],depth:.12,cut:.65});
  for(const dz of [-3.0,-1.0,1.0,3.0])part([27.035,-.2,z+dz],[.10,2.65,.19],k.m.metal,.025);
  part([27.025,1.56,z],[.09,.095,8.5],amber,.012);
 }

 // Replace only the visible standard chassis, keeping its exact old physical
 // envelope. The folded hull sits inside y=[floor-1.4,floor-.5], so an actor or
 // shot never passes through a newly protruding decorative underside. Its top
 // remains behind the original running slab rather than becoming a floor skin.
 const decorated=[];
 for(const [deck,tint] of [[refs.entryDeck,mint],[refs.galleryDeck,mint],[refs.viewingDeck,mint],[refs.goalDeck,coral]]){
  const d=deck?.record??deck?.floor??deck;if(!d||!Number.isFinite(d.minX))continue;
  const w=d.maxX-d.minX,depth=d.maxZ-d.minZ,x=(d.minX+d.maxX)/2,z=(d.minZ+d.maxZ)/2;
  const old=k.world.root.children.find(o=>o.isMesh&&o.material===k.m.dark&&
   Math.abs(o.position.x-x)<.001&&Math.abs(o.position.y-(d.y-.9))<.001&&Math.abs(o.position.z-z)<.001&&
   Math.abs((o.geometry.parameters?.width??0)-(w-.65))<.001&&Math.abs((o.geometry.parameters?.depth??0)-(depth-.65))<.001);
  removeBatchedMesh(k,old);
  k.geometry(chassisProfile(w-.65,depth-.65),tint,[x,d.y-.5,z],Q(),{name:'Pilot / tapered closed platform sill'});
  // The front reveal replaces the existing structural side band, inside its
  // real envelope. The narrow nickel lip is recessed into that same band.
  const front=k.world.root.children.find(o=>o.isMesh&&o.material===k.m.shell&&
   Math.abs(o.position.x-x)<.001&&Math.abs(o.position.y-(d.y-.84))<.001&&Math.abs(o.position.z-(d.maxZ-.2))<.001&&
   Math.abs((o.geometry.parameters?.width??0)-(w-.8))<.001&&Math.abs((o.geometry.parameters?.height??0)-.38)<.001);
  removeBatchedMesh(k,front);
  panel([x,d.y-.84,d.maxZ-.20],w-.95,.36,tint,{depth:.18,cut:.13});
  part([x,d.y-.82,d.maxZ-.145],[Math.min(7,w-2),.095,.08],k.m.metal,.012);
  for(const sx of [-1,1])panel([x+sx*(w/2-1.4),d.y-.84,d.maxZ-.15],.72,.31,k.m.dark,{depth:.08,cut:.08});
  decorated.push(d.name??'pilot deck');
 }

 // Three overhead coffers separate the arrival, observation and destination
 // spaces. The lowest piece is y=29.7, above the complete tested flight lane.
 const roof=k.ceiling??32;
 const fixtures=[[-17,roof-1.75,15],[-17,roof-1.75,-19],[15,roof-1.75,15]];
 for(const [x,y,z] of fixtures){
  const q=Q().setFromUnitVectors(Z,V(0,-1,0));
  k.geometry(foldedPanel(12.2,5.4,.34,1.0),k.m.dark,[x,y+.06,z],q,{name:'Pilot / overhead shielded luminaire housing'});
  k.geometry(foldedFrame(11.7,4.9,.22,.55,.9),mineral,[x,y-.13,z],q,{name:'Pilot / chamfered coffer soffit'});
  k.geometry(foldedPanel(10.4,3.55,.065,.60),k.m.white,[x,y-.275,z],q,{name:'Pilot / inset broad luminaire diffuser'});
  // Each fixture is hung from the roof rather than suspended as an object.
  for(const dx of [-4.8,4.8])part([x+dx,roof-.80,z],[.30,1.7,3.8],k.m.metal,.04);
 }
 for(const z of [-27,25]){
  part([-1,roof-1.62,z],[54,.65,1.35],mint,.12);
  part([-1,roof-2.00,z],[49,.14,.74],k.m.metal,.025);
 }

 // The white load pad remains a normal portal target. Its amber rim is outside
 // the entire porcelain sheet and says 'instrument' without painting over it.
 const loadPanel=refs.panels?.['floor-button'];
 if(loadPanel?.group&&loadPanel.width&&loadPanel.height){
  arch([0,0,.17],loadPanel.width+1.43,loadPanel.height+1.43,amber,{depth:.08,rim:.12,cut:.33,parent:loadPanel.group});
 }

 // Two bounded, unshadowed spots come from the actual ceiling fixtures. Low
 // quality adds no shadow map, render target, image download or update loop.
 const lights=[];
 for(const [fixture,target,intensity,color] of [[fixtures[0],[-17,0,15],28,0xd6fff0],[fixtures[2],[15,22,15],15,0xffdfad]]){
  const light=new THREE.SpotLight(color,intensity,38,Math.PI*.37,.82,1);
  light.name='Pilot / architectural luminaire';light.position.fromArray(fixture);light.position.y-=.40;
  light.target.position.fromArray(target);light.castShadow=false;k.world.root.add(light,light.target);lights.push(light);
 }
 let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;for(const light of lights){light.removeFromParent();light.target.removeFromParent();light.dispose();}ownedMaterials.forEach(m=>m.dispose());};
 const restore=k.restoreLight.bind(k);k.restoreLight=()=>{dispose();restore();};
 const art={style:'folded sea-glass loading bay and terracotta receiving gallery',extraShadowLights:0,staticMaterials:ownedMaterials.length,downloadBytes:0,decoratedDecks:decorated,lights:lights.length,dispose};
 k.world.root.userData.puzzlePilotArt=art;return art;
}
