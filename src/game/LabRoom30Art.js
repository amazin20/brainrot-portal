import * as THREE from 'three';
import {SolidAssembly,createGuideRing,placeSolidModel} from './LabSolidModels.js';
import {LabAirflowVisual} from './LabAirflowVisual.js';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();

// Projected directional cursors occupy the trajectory itself. They have no
// physical rim: a player following a guide must never hit an invisible gate.
function flightCursorGeometry(){
 const positions=[],uv=[],indices=[];
 for(const plane of [0,1])for(const sign of [-1,1]){
  const start=V(sign*1.05,0,-.86),end=V(0,0,.72),side=V(end.z-start.z,0,start.x-end.x).normalize().multiplyScalar(.16),base=positions.length/3;
  for(const [p,u,v]of [[start.clone().sub(side),0,0],[start.clone().add(side),0,1],[end.clone().sub(side),1,0],[end.clone().add(side),1,1]]){
   if(plane)p.set(0,p.x,p.z);positions.push(...p.toArray());uv.push(u,v);
  }
  indices.push(base,base+1,base+2,base+1,base+3,base+2);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

function foundIsland(steel,floor,supports){
 const {minX,maxX,minZ,maxZ,y}=floor,xs=[minX+3,maxX-3],zs=[minZ+3,maxZ-3];
 for(const x of xs)for(const z of zs){
  const shaftHeight=y-2.0;
  // A broad closed pier carries the real deck. Separate flanges and capitals
  // meet it with positive overlap, without fragile fifty-metre needle posts.
  steel.box([x,.40,z],[4.4,.80,4.0],1,.13);
  steel.box([x,.8+shaftHeight/2,z],[2.8,shaftHeight,2.6],0,.14);
  for(const side of [-1,1])steel.box([x+side*1.32,.8+shaftHeight/2,z],[.22,shaftHeight,2.84],1,.045);
  steel.box([x,y-1.20,z],[4.6,1.24,4.0],1,.12);
  steel.box([x,y-1.78,z],[3.8,.28,3.45],2,.05);
  for(let level=8;level<y-5;level+=9){
   for(const side of [-1,1])steel.box([x,level,z+side*1.315],[2.34,.22,.07],1,.02,false);
  }
  supports.push({x,z,base:0,top:y-.58,shaft:[2.8,2.6],foot:[4.4,4.0],deck:[minX,maxX,minZ,maxZ,y]});
 }
 // Deep load girders connect all four capitals. Their tops meet the soffit;
 // every added solid stays below the already occupied walking deck volume.
 for(const z of zs){
  steel.box([(xs[0]+xs[1])/2,y-1.80,z],[xs[1]-xs[0],2.4,1.16],1,.10);
  steel.box([(xs[0]+xs[1])/2,y-2.91,z],[xs[1]-xs[0],.24,1.8],0,.05);
 }
 for(const x of xs){
  steel.box([x,y-1.80,(zs[0]+zs[1])/2],[1.16,2.4,zs[1]-zs[0]],1,.10);
  steel.box([x,y-2.91,(zs[0]+zs[1])/2],[1.8,.24,zs[1]-zs[0]],0,.05);
 }
}

// The opening hub has three existing physical cores. Dress those exact
// footprints as launch equipment, so the player sees what the structures do
// instead of ornamental planters perched on featureless collision boxes.
function buildRouteConsole(name){
 const a=new SolidAssembly(name,'launch');
 a.materials[0].color.setHex(0xd9e6e5);
 a.materials[1].color.setHex(0x183a52);
 a.materials[2].color.setHex(0xffd37c);
 a.materials[3].color.setHex(0x294a5d);
 // All relief remains inside the existing four-by-nine-metre plinth. Its
 // exposed face looks toward the player at positive Z.
 a.box([0,0,0],[4.04,4.04,9.04],0,.11,false);
 for(const x of [-1.88,1.88]){
  a.box([x,.05,0],[.18,3.65,8.8],0,.04,false);
  for(const z of [-3.8,0,3.8])a.box([x,.70,z],[.22,.16,.42],2,.03,false);
 }
 a.box([0,1.88,0],[4.2,.24,9.3],0,.07,false);
 a.box([0,.15,4.57],[3.42,2.82,.11],3,.04,false);
 a.box([0,.10,4.64],[2.96,2.38,.045],1,.015,false);
 // Two rising flight paths form a physical schematic, visible before the
 // player chooses either launch bowl. No text texture or HUD is required.
 for(const side of [-1,1]){
  const coords=[[-1.20,-.82],[-.56,-.34],[.05,.12],[.68,.55],[1.16,.82]];
  for(let i=1;i<coords.length;i++){
   const [x0,y0]=coords[i-1],[x1,y1]=coords[i];
   const dx=x1-x0,dy=y1-y0,len=Math.hypot(dx,dy);
   const segment=new THREE.BoxGeometry(len,.085,.06);
   segment.rotateZ(Math.atan2(dy,dx)*side);
   a.add(segment,2,[side*(x0+x1)/2,(y0+y1)/2,4.69],Q(),[1,1,1],false);
  }
  a.box([side*1.23,.78,4.72],[.18,.25,.09],0,.025,false);
 }
 for(const z of [-3.5,-1.6,1.6,3.5])a.box([0,-1.86,z],[3.8,.16,.14],2,.025,false);
 return a.finish();
}

function buildLaunchCore(){
 const a=new SolidAssembly('Twin-route launch core','launch');
 a.materials[0].color.setHex(0xf2dec5);
 a.materials[0].emissive.setHex(0x57432f);
 a.materials[0].emissiveIntensity=.16;
 a.materials[1].color.setHex(0x285267);
 a.materials[2].color.setHex(0xffd37c);
 a.materials[3].color.setHex(0x4d7988);
 a.materials[3].emissive.setHex(0x193647);
 a.materials[3].emissiveIntensity=.16;
 // The eight-metre core is already solid in the puzzle. Only the exposed
 // machinery above that existing collision volume needs its own envelopes.
 a.box([0,0,0],[16.1,8.08,12.1],0,.15,false);
 for(const x of [-7.76,7.76])for(const z of [-5.75,5.75]){
  a.box([x,0,z],[.45,8.0,.42],1,.06,false);
  a.box([x,3.88,z],[.72,.25,.72],2,.04,false);
 }
 for(const side of [-1,1]){
  const z=side*6.09;
  for(const x of [-4.7,0,4.7]){
   a.box([x,-.18,z],[3.65,5.1,.13],3,.06,false);
   for(const y of [-1.9,-1.2,-.5,.2,.9,1.6])
    a.box([x,y,z+side*.08],[3.1,.06,.08],0,.015,false);
  }
  a.box([0,3.38,z+side*.08],[14.6,.16,.10],2,.02,false);
  a.box([0,-3.38,z+side*.08],[14.6,.16,.10],2,.02,false);
 }
 // The player starts west of the machine and sees its side from very close
 // range. Match the front's three readable bays on both side faces: a light
 // enamel shell, inset blue cells and continuous warm framing at eye height.
 for(const side of [-1,1]){
  const x=side*8.10;
  for(const z of [-3.5,0,3.5]){
   a.box([x,-.18,z],[.14,4.8,2.45],3,.055,false);
   for(const y of [-1.76,-.90,-.04,.82,1.68])
    a.box([x+side*.085,y,z],[.075,.055,2.15],0,.015,false);
  }
  for(const y of [-3.42,3.42])a.box([x+side*.085,y,0],[.10,.19,10.8],2,.025,false);
  for(const z of [-5.25,-1.75,1.75,5.25])a.box([x+side*.09,0,z],[.11,7.0,.20],1,.025,false);
 }
 // Ceiling-facing collectors connect the hub machine to the overhead
 // catwalk; four clear arms frame the well instead of a decorative crown.
 for(const x of [-5.3,5.3])for(const z of [-3.7,3.7]){
  a.box([x,7.1,z],[.75,6.4,.75],1,.08);
  a.box([x,10.25,z],[1.28,.24,1.28],2,.06);
 }
 for(const z of [-3.7,3.7])a.box([0,10.2,z],[12,.35,.88],0,.06);
 a.box([0,11.0,0],[9.6,1.10,5.7],1,.11);
 for(const x of [-4.2,-2.1,0,2.1,4.2])a.box([x,11.6,0],[.20,.11,5.1],2,.02,false);
 return a.finish();
}

/** Manufactured launch structures. The segmented collars are solid at their
 * rims, open in their centres and synchronized with the actual outlet pose. */
export function buildRoom30Art(level){
 const {world,flightGeometry:f,state,workshop:k}=level;
 const root=new THREE.Group();root.name='Sunward launch laboratory architecture';root.userData.keepMaterial=true;world.root.add(root);
 const steel=new SolidAssembly('Launch hall structure, cladding and flight markers','launch');
 steel.materials[0].color.setHex(0xd9e6e5);
 steel.materials[1].color.setHex(0x285267);
 steel.materials[2].color.setHex(0xffd37c);
 steel.materials[3].color.setHex(0x4d7988);
 const supports=[];
 for(const floor of world.floors){if(floor.y<20||!floor.mesh)continue;const {minX,maxX,minZ,maxZ,y}=floor;
  // Real broad soffits replace thin floating edge strips. The walking plane is unchanged.
  steel.box([(minX+maxX)/2,y-.42,(minZ+maxZ)/2],[maxX-minX,.64,maxZ-minZ],1,.08);
  if(maxX-minX>20&&maxZ-minZ>20)foundIsland(steel,floor,supports);
 }
 placeSolidModel(k,buildLaunchCore(),[-1,56,7],{parent:root});
 for(const p of [[-21,54,-6],[19,54,8]]){
  const routeConsole=buildRouteConsole('Launch path console');
  routeConsole.position.fromArray(p);root.add(routeConsole);
 }
 const wellFlows=[];
 for(const well of f.wells){const c=well.panel.getFrame().center;
  const flow=new LabAirflowVisual(root,{capacity:42,speed:17,radius:.75,opacity:.6});flow.mesh.name='Projected gravity-well descent';
  flow.wellPath=[{a:V(c.x,well.top-.5,c.z),direction:V(0,-1,0),length:well.top-c.y-1}];flow.setPath(flow.wellPath);wellFlows.push(flow);
  for(const dx of [-6.5,6.5])steel.beam([c.x+dx,c.y-1,c.z+3],[c.x+dx,well.top+1,c.z+3],.22,0);
 }
 const paths=[],clearances=[],cursorGeometry=flightCursorGeometry(),cursorMaterial=new THREE.ShaderMaterial({
  name:'Feathered trajectory projection',transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
  uniforms:{tint:{value:new THREE.Color(0xd5eee7)}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'uniform vec3 tint;varying vec2 vUv;void main(){float edge=max(0.,1.-abs(vUv.y*2.-1.));float a=.42*edge*edge*pow(max(0.,sin(vUv.x*3.14159265)),.5);if(a<.002)discard;gl_FragColor=vec4(tint,a);\n#include <colorspace_fragment>\n}',
 });
 const posePath=path=>{
  const frame=path.panel.getFrame(),normal=frame.normal,speed=Math.sqrt(39*(path.drop+1.2));
  const vy=normal.y*speed,time=(vy+Math.sqrt(vy*vy+39*(frame.center.y-path.landingY)))/19.5;
  for(let i=0;i<path.rings.length;i++){
   const t=time*(i+1)/(path.rings.length+1),mesh=path.rings[i];
   mesh.position.copy(frame.center).addScaledVector(normal,speed*t).add(V(0,-9.75*t*t,0));
   mesh.quaternion.setFromUnitVectors(V(0,0,1),normal.clone().multiplyScalar(speed).add(V(0,-19.5*t,0)).normalize());
  }
  const segments=[];
  for(let i=0;i<6;i++){
   const at=t=>frame.center.clone().addScaledVector(normal,speed*t).add(V(0,-9.75*t*t,0)),a=at(time*i/6),b=at(time*(i+1)/6),direction=b.sub(a),length=direction.length();
   segments.push({a,direction:direction.normalize(),length});
  }
  path.flow.setPath(segments);
 };
 for(const [name,panel,drop,landingY,style] of [['north',f.north,36,40,'launch'],['east',f.east,36,40,'lagoon'],['final',f.final,34,28,'launch'],['east-final',f.eastFinal,34,28,'lagoon']]){
  const flow=new LabAirflowVisual(root,{capacity:64,speed:18,radius:1.15,opacity:.64});flow.mesh.name=name+' / projected ballistic trace';
  const path={name,panel,drop,landingY,rings:[],bindings:[],flow};
  const lastArc=name==='final'||name==='east-final';
  for(let i=0;i<(lastArc?8:6);i++){const model=new THREE.Mesh(cursorGeometry,cursorMaterial);model.name=name+' / soft directional cursor';model.userData.projectedFlightGuide=true;model.castShadow=model.receiveShadow=false;root.add(model);path.rings.push(model);}
  posePath(path);
  // Receiver collars live in the same local frame as their physical panel.
  placeSolidModel(k,createGuideRing(7.5,style,.44,.65),[0,0,-1.3],{parent:panel.group,kinematic:lastArc});
  paths.push(path);clearances.push({name,radius:lastArc?6.6:5.6});
 }
 for(const x of [183,218]){
  steel.box([x,39,32],[2,22,3],0,.25);
  steel.box([x,50.4,32],[2.3,.6,3.3],2,.1);
 }
 steel.beam([183,49,32],[218,49,32],.58,1);
 placeSolidModel(k,createGuideRing(7,'launch',1.05,.95),[200,43,32],{parent:root});
 for(let i=0;i<12;i++){
  const t=i*Math.PI/6;steel.beam([200+Math.cos(t)*8.2,43+Math.sin(t)*8.2,32],[200+Math.cos(t)*9.5,43+Math.sin(t)*9.5,32],.20,2);
 }
 // Recessed machine bays turn the enormous blank walls into the enclosing
 // structure of a working launch hall. The relief is inset against the
 // existing shell and has no collision or portal surfaces.
 const {minX,maxX,minZ,maxZ}=level.bounds;
 for(const [z,towardRoom] of [[minZ+.20,1],[maxZ-.20,-1]])for(let x=minX+6;x<maxX-25;x+=24){
  steel.box([x,52,z],[1.1,57,1.65],1,.12,false);
  steel.box([x+11.7,77,z],[23.2,1.35,1.5],0,.08,false);
  steel.box([x+11.7,27,z],[23.2,1.2,1.5],0,.08,false);
  steel.box([x+11.7,51,z],[21.2,37,.36],3,.12,false);
  for(const offset of [-9.0,9.0])steel.box([x+11.7+offset,51,z+towardRoom*.24],[.35,37,.30],0,.04,false);
  for(const y of [36,52,67])steel.box([x+11.7,y,z+towardRoom*.31],[17.5,.15,.23],2,.025,false);
  steel.box([x+11.7,72,z+towardRoom*.28],[19,.54,.26],0,.045,false);
 }
 for(const [x,towardRoom] of [[minX+.20,1],[maxX-.20,-1]])for(let z=minZ+9;z<maxZ-23;z+=22){
  steel.box([x,52,z],[1.65,57,1.1],1,.12,false);
  steel.box([x,77,z+10.7],[1.5,1.35,21.1],0,.08,false);
  steel.box([x,27,z+10.7],[1.5,1.2,21.1],0,.08,false);
  steel.box([x,51,z+10.7],[.36,37,19],3,.12,false);
  for(const offset of [-8,8])steel.box([x+towardRoom*.24,51,z+10.7+offset],[.30,37,.32],0,.04,false);
  for(const y of [36,52,67])steel.box([x+towardRoom*.31,y,z+10.7],[.23,.15,15.3],2,.025,false);
  steel.box([x+towardRoom*.28,72,z+10.7],[.26,.54,17.4],0,.045,false);
 }
 // The large sightline screen remains one solid obstruction; recessed service
 // cells and longitudinal ribs show its construction on both visible faces.
 for(const side of [-1,1])for(const z of [-78,-64,-50,-36]){
  const x=120+side*.72;
  steel.box([x,55,z],[.35,50,.82],1,.07,false);
  steel.box([x,61,z+6.6],[.22,13,12.4],3,.07,false);
  steel.box([x+side*.18,69,z+6.6],[.12,.25,10.4],2,.02,false);
 }
 // Paired enamel rims belong to the actual three arrival floors. The north
 // and east alternatives keep their different directions and their own
 // outlet controls; these borders provide an overview while retaining the
 // original flat walkable surface and cargo contacts.
 for(const [x0,x1,z0,z1,y,material] of [
  [-23.5,28,-22,26,52,2],[44,80,-3,35,40,2],
  [95,138,-3,35,40,1],[183,218,2,42,28,2],
 ]){
  const centerX=(x0+x1)/2,centerZ=(z0+z1)/2;
  for(const z of [z0+.24,z1-.24])steel.box([centerX,y+.035,z],[x1-x0-.48,.055,.21],material,.02,false);
  for(const x of [x0+.24,x1-.24])steel.box([x,y+.035,centerZ],[.21,.055,z1-z0-.48],material,.02,false);
 }
 placeSolidModel(k,steel.finish(),[0,0,0],{parent:root});
 const moving=(k.solidModels??[]).filter(b=>b.colliders[0]?.kinematic);
 const flows=[...wellFlows,...paths.map(p=>p.flow)],update=()=>{for(const path of paths)if(path.name==='final'||path.name==='east-final')posePath(path);};
 // The final outlet actuator has already run when this callback executes.
 // Decorative rings no longer move in render-only time with stale colliders.
 k.ticks.push(dt=>{update();for(const binding of moving)binding.sync(dt);for(const flow of flows)flow.step(dt,1);});
 k.renders.push(alpha=>{for(const flow of flows)flow.render(alpha,level.workshop.game.qualityLevel||'balanced');});
 k.resets.push(()=>{for(const flow of flows)flow.reset();for(const path of paths)posePath(path);for(const flow of wellFlows)flow.setPath(flow.wellPath);for(const binding of moving)binding.sync(0,true);for(const flow of flows){flow.step(0,1);flow.render(1);}});
 update();for(const flow of flows){flow.step(0,1);flow.render(1);}
 level.launchArt={root,paths,clearances,supports,flows,update,drawCalls:root.children.length};return level.launchArt;
}
