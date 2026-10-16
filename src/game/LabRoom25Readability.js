import * as THREE from 'three';

const clamp=THREE.MathUtils.clamp;
// Opaque box faces need paint on their OUTSIDE, not inset in the box. Tiled
// surfaces end at local Z=-.003; every finish layer is <=.9 mm above its host.
const TILE_FIELD=-.0026,TILE_PAINT=-.0025,TILE_CELL=-.0023,TILE_INDEX=-.0021;
export const ROOM25_INSTRUMENT_COLORS=Object.freeze({metal:0x263b43,passenger:0x31545c,edge:0xc6954b,ink:0x14252d,off:0x283e43,light:0xffd27d,load:0x83d3bc,drive:0xffedbb});

/** Paint and instrument glass on the existing machine. All new geometry is
 * finish within an existing face, never a new support, aperture or blocker.
 * Owned collider meshes remain childless: their recursive Box3 is physical. */
export function buildRoom25Readability(k,{pad,optical,passengers}){
 const w=k.world,g=k.game,m=optical.machine,colors=ROOM25_INSTRUMENT_COLORS;
 const root=new THREE.Group();root.name='Opposed shadows / machine instruments';root.userData.visualOnly=true;root.userData.keepMaterial=true;w.root.add(root);
 const materials=[],geometries=[],mounts=[],groups=[root],restores=[],followers=[];
 let disposed=false;
 const material=(name,color,{metalness=.25,roughness=.56,glow=false}={})=>{
  const result=glow?new THREE.MeshBasicMaterial({color}):new THREE.MeshStandardMaterial({color,metalness,roughness});
  result.name=name;materials.push(result);return result;
 };
 const metal=material('R25 graphite enamel',colors.metal),passenger=material('R25 blue steel',colors.passenger),edge=material('R25 copper inlay',colors.edge,{metalness:.65,roughness:.36});
 const ink=material('R25 instrument recess',colors.ink);
 const lens=()=>material('R25 live instrument glass',colors.off,{glow:true});
 const keep=object=>{const before=object.userData.keepMaterial;object.userData.keepMaterial=true;restores.push(()=>{if(before===undefined)delete object.userData.keepMaterial;else object.userData.keepMaterial=before;});};
 const replace=(mesh,next)=>{const previous=mesh.material;mesh.material=next;restores.push(()=>{mesh.material=previous;});};
 function group(parent,name){const result=new THREE.Group();result.name=name;result.userData.visualOnly=true;result.userData.keepMaterial=true;parent.add(result);groups.push(result);return result;}
 function plane(parent,name,x,y,z,width,height,mat,angle=0){
  const geometry=new THREE.PlaneGeometry(width,height);geometries.push(geometry);
  const mesh=new THREE.Mesh(geometry,mat);mesh.name=name;mesh.position.set(x,y,z);mesh.rotation.z=angle;mesh.userData.visualOnly=true;parent.add(mesh);return mesh;
 }
 function surfaceFinish(surface,finish,{freight=false}={}){
  keep(surface.group);
  for(const node of surface.group.children)if(node.isInstancedMesh&&!node.userData.portalTile)replace(node,finish);
  replace(surface.backing,finish);
  const marks=group(surface.group,freight?'Freight metal tread / inlaid finish':'Passenger metal tread / inlaid finish');
  mounts.push({group:marks,host:surface.mesh});
  const halfX=surface.width/2,halfY=surface.height/2,z=TILE_PAINT;
  for(const sign of [-1,1]){
   plane(marks,'Copper metal edge',0,sign*(halfY-.12),z,surface.width-.24,.075,edge);
   plane(marks,'Copper metal edge',sign*(halfX-.12),0,z,.075,surface.height-.24,edge);
  }
  // Short oblique grip marks identify a manufactured metal tread. They are
  // ink inside its existing solid top, rather than another walkable object.
  for(const side of [-1,1])for(let n=-3;n<=3;n++)plane(marks,'Inset grip mark',side*(halfX-.35),n*.48,z,.32,.055,ink,Math.PI/4);
  if(!freight)return {surface,marks};
  const loadMaterial=lens(),loadLenses=[];
  for(const sx of [-1,1])for(const sy of [-1,1])loadLenses.push(plane(marks,'Original load contact glass',sx*1.89,sy*1.89,z,.22,.22,loadMaterial));
  return {surface,marks,loadMaterial,loadLenses};
 }
 const freight=surfaceFinish(pad.surface,metal,{freight:true});
 const passengerDecks=passengers.map(car=>surfaceFinish(car.surface,passenger));

 // Every optical inset remains its original white portal ceramic. The large
 // surrounding metal housing gains a dark field and copper perimeter only.
 const housings=w.surfaces.filter(surface=>surface.name.endsWith(' / metal optical housing'));
 const housingMarks=[];
 for(const surface of housings){
  keep(surface.group);for(const node of surface.group.children)if(node.isInstancedMesh&&!node.userData.portalTile)replace(node,metal);replace(surface.backing,metal);
  const marks=group(surface.group,'Optical housing / face inlay');mounts.push({group:marks,host:surface.mesh});housingMarks.push(marks);
  for(const sign of [-1,1]){
   plane(marks,'Copper optical casing edge',0,sign*(surface.height/2-.14),TILE_PAINT,surface.width-.28,.07,edge);
   plane(marks,'Copper optical casing edge',sign*(surface.width/2-.14),0,TILE_PAINT,.07,surface.height-.28,edge);
  }
 }
 const relay=housings.find(surface=>surface.name==='lower-relay / metal optical housing');
 const readout=group(relay.group,'Lower optical instrument / load light drive height');mounts.push({group:readout,host:relay.mesh});
 plane(readout,'Inset process instrument',0,-1.82,TILE_FIELD,4.55,1.08,ink);
 const loadGlass=lens(),lightGlass=lens(),driveGlass=lens(),lightCells=[],driveCells=[];
 // A cargo cradle, a beam on a cell and a motor winding are engraved on the
 // actual relay housing. These are machine symbols, with no route arrows.
 plane(readout,'Cargo contact cell',-1.65,-1.68,TILE_CELL,.31,.31,loadGlass);
 for(const x of [-1.91,-1.39])plane(readout,'Cargo cradle',x,-1.85,TILE_CELL,.055,.47,edge);
 plane(readout,'Cargo cradle',-1.65,-2.07,TILE_CELL,.57,.055,edge);
 for(const y of [-1.61,-1.81,-2.01])plane(readout,'Incident light engraving',-.78,y,TILE_CELL,.35,.045,edge);
 lightCells.push(plane(readout,'Current light cell',-.46,-1.81,TILE_CELL,.16,.63,lightGlass));
 for(const y of [-1.61,-1.81,-2.01])driveCells.push(plane(readout,'Motor winding cell',.55,y,TILE_CELL,.48,.075,driveGlass));
 plane(readout,'Travel datum',1.65,-1.81,TILE_CELL,.055,.77,edge);
 for(const y of [-2.15,-1.81,-1.47])plane(readout,'Travel datum tick',1.77,y,TILE_CELL,.22,.045,edge);
 const heightGlass=plane(readout,'Measured freight height',1.6,-2.15,TILE_INDEX,.27,.08,edge);

 // The existing narrow founded rails are the ruler, not a detached progress
 // panel. A small warm index follows the real carriage height on each rail.
 const rulers=[];
 for(const part of m.parts.filter(part=>part.mesh.name==='Room25 founded freight rail')){
  const marks=group(root,'Founded freight rail / measured stroke');marks.position.copy(part.mesh.position);marks.quaternion.copy(part.mesh.quaternion);mounts.push({group:marks,host:part.mesh});
  const face=group(marks,'Rail front engraving');face.position.z=-part.half.z-.0004;face.rotation.y=Math.PI;
  for(let n=0;n<=9;n++)plane(face,'Metre stroke engraving',0,n-4.5,0,n%3===0?.13:.075,.035,edge);
  const index=plane(face,'Live carriage height index',0,-4.5,.0003,.13,.14,driveGlass);rulers.push({marks,index});
 }
 const crossarm=m.parts.find(part=>part.mesh.name==='Room25 travelling optical crossarm');
 const motor=group(root,'Travelling motor / live winding finish');mounts.push({group:motor,host:crossarm.mesh});followers.push({group:motor,source:crossarm.mesh});
 const motorFace=group(motor,'Motor front glass');motorFace.position.z=-crossarm.half.z-.0005;motorFace.rotation.y=Math.PI;
 driveCells.push(plane(motorFace,'Actual optical motor drive',0,0,0,1.04,.055,driveGlass));
 // The motor's existing narrow mast is its live winding conductor. Paint
 // both exposed faces so its physical height remains readable from the
 // upper arm, below the real beam and the receiver's opaque rim.
 const mast=m.parts.find(part=>part.mesh.name==='Room25 travelling optical mast');
 const winding=group(root,'Travelling motor mast / live winding finish');mounts.push({group:winding,host:mast.mesh});followers.push({group:winding,source:mast.mesh});
 for(const side of ['front','west']){
  const face=group(winding,'Motor winding / '+side+' face');
  if(side==='front'){face.position.z=-mast.half.z-.0005;face.rotation.y=Math.PI;}
  else{face.position.x=-mast.half.x-.0005;face.rotation.y=-Math.PI/2;}
  driveCells.push(plane(face,'Actual mast motor winding',0,0,0,.10,2.8,driveGlass));
 }

 const control=k.state['counterweight-hoistControl'],bounds=control.collider.box;
 const consoleFace=group(root,'Ground switch / enabled and current light');
 consoleFace.position.set((bounds.min.x+bounds.max.x)/2,bounds.max.y-.34,bounds.max.z+.0004);
 mounts.push({group:consoleFace,host:control.collider.mesh});
 plane(consoleFace,'Ground switch instrument field',0,0,0,.57,.43,ink);
 const enabledGlass=lens();
 const switchCell=plane(consoleFace,'Switch permission cell',-.16,.025,.0003,.105,.23,enabledGlass);
 lightCells.push(plane(consoleFace,'Current light cell',.13,.025,.0003,.18,.18,lightGlass));
 driveCells.push(plane(consoleFace,'Actual drive cell',0,-.15,.0003,.39,.045,driveGlass));
 // The real moving receiver already has a full glass face. Its amber ring
 // still indicates incident light; the restored material on its actual lens
 // separately shows measured motor force and is legible from the upper arm.
 replace(optical.motorLamp.lens,driveGlass);keep(optical.motorLamp.group);driveCells.push(optical.motorLamp.lens);

 // Use the existing receiver glasses at their exact traced optical poses.
 // One bar identifies the first circuit and two bars the second circuit.
 const receiverGroups=w.root.children.filter(node=>node.isGroup&&node.children.some(child=>child.geometry?.type==='TorusGeometry'&&Math.abs(child.geometry.parameters.radius-.96)<1e-6));
 const receiverGlasses=receiverGroups.map((device,i)=>{
  const marks=group(device,i?'Upper receiver / twin glass':'Lower receiver / single glass'),signal=lens();
  for(let n=0;n<=i;n++)plane(marks,'Current receiver signal',(n-i/2)*.34,0,.0255,.17,1.03,signal);
  const glass=device.children.find(child=>child.geometry?.type==='CircleGeometry');
  if(glass){const finish=material('R25 receiver smoked metal',0x29454e,{metalness:.48,roughness:.3});replace(glass,finish);}
  keep(device);return{device,marks,signal};
 });
 const state={loaded:false,enabled:false,currentLight:false,drive:false,height:0,velocity:0,receivers:[false,false]};
 function update(){
  if(disposed)return;
  // Construction/render preparation never creates a body or advances the
  // world. Only an already-owned real machine has a force record to display.
  const actual=m.owner===g.physics&&m.carriageBody?m.diagnostics().lastForce:null;
  state.loaded=m.loaded;state.enabled=m.motorEnabled;state.currentLight=optical.motorLit;
  state.drive=Boolean(state.enabled&&state.currentLight&&actual?.motorForce>0);
  state.height=m.height;state.velocity=m.velocity;state.receivers=[...optical.receivers];
  freight.loadMaterial.color.setHex(state.loaded?colors.load:colors.off);loadGlass.color.copy(freight.loadMaterial.color);
  enabledGlass.color.setHex(state.enabled?colors.edge:colors.off);
  lightGlass.color.setHex(state.currentLight?colors.light:colors.off);driveGlass.color.setHex(state.drive?colors.drive:colors.off);
  const height=clamp(state.height,0,m.budget.stroke);heightGlass.position.y=-2.15+.68*height/m.budget.stroke;
  for(const ruler of rulers)ruler.index.position.y=height-4.5;
  for(const follow of followers){follow.group.position.copy(follow.source.position);follow.group.quaternion.copy(follow.source.quaternion);}
  receiverGlasses.forEach((glass,i)=>glass.signal.color.setHex(state.receivers[i]?colors.light:colors.off));
 }
 k.ticks.push(update);k.renders.push(update);k.resets.push(update);
 // Read-only references to genuine rendered geometry let a native observer
 // measure pixels without substituting projected mathematical ray segments.
 const beamRoot=w.root.children.find(node=>node.isGroup&&node.children.length===7&&node.children.every(child=>child.geometry?.type==='CylinderGeometry'&&child.geometry.parameters.radiusTop===1&&child.material?.color.getHex()===0xffbe55));
 const targets=Object.freeze({beamRoot,beams:Object.freeze(beamRoot?[...beamRoot.children]:[]),movingMirror:optical.movingMirror.mesh,motorReceiver:optical.motorLamp.group,
  receivers:Object.freeze(receiverGlasses.map(glass=>glass.device)),contact:Object.freeze([...freight.loadLenses]),currentLight:Object.freeze(lightCells),drive:Object.freeze(driveCells),switch:Object.freeze([switchCell]),height:Object.freeze([heightGlass,...rulers.map(ruler=>ruler.index)])});
 const result={root,state,freight,passengerDecks,housings,housingMarks,readout,receiverGlasses,rulers,motor,consoleFace,materials,mounts,targets,update,
  dispose(){if(disposed)return;disposed=true;for(const list of [k.ticks,k.renders,k.resets]){const index=list.indexOf(update);if(index>=0)list.splice(index,1);}for(const restore of restores.reverse())restore();for(const item of groups.reverse())item.removeFromParent();geometries.forEach(geometry=>geometry.dispose());materials.forEach(item=>item.dispose());}};
 update();return result;
}
