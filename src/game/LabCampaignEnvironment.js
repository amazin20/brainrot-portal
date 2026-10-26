import * as THREE from 'three';
import {architecturalRectOverlapsPortal} from './LabArchitecturalModels.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),Z=V(0,0,1),UP=V(0,1,0);
// These enclosed later rooms were inspected against their finished solids.
// Their old mounts were partly buried in cornices or machinery bulkheads.
const REVIEWED_ENCLOSED_FIELDS=new Set(['conductive-cargo-circuit','foundation-portal-tension',
 'post-thin-shadow','post-pneumatic-reservoir','post-magnetic-u-channel','post-thermal-memory']);
export const CAMPAIGN_ORNAMENTS=Object.freeze({
 discovery:'Open research calibration arcs',dynamo:'Copper induction fins',biosphere:'Botanical mineral relief',
 observatory:'Engraved orbital instruments',fracture:'Faceted geological relief',castle:'Gilded castle lancets',
});

function wallFrames(bounds,base,roof,depth=0){
 const {minX,maxX,minZ,maxZ}=bounds,x=(minX+maxX)/2,z=(minZ+maxZ)/2,y=(base+roof)/2;
 return [
  {center:V(x,y,minZ+depth),normal:Z.clone(),span:maxX-minX},
  {center:V(minX+depth,y,z),normal:V(1,0,0),span:maxZ-minZ},
  {center:V(maxX-depth,y,z),normal:V(-1,0,0),span:maxZ-minZ},
  {center:V(x,y,maxZ-depth),normal:V(0,0,-1),span:maxX-minX},
 ].map(f=>({...f,up:UP.clone(),right:new THREE.Vector3().crossVectors(UP,f.normal),height:roof-base}));
}

function protectedFrames(game,level){
 const frames=[],seen=new Set();
 for(const surface of Object.values(level.panels||{}))if(surface?.getFrame){frames.push(surface.getFrame());seen.add(surface.mesh);}
 for(const mesh of game.portalPanels||[]){
  if(seen.has(mesh))continue;
  const f=mesh.userData.portalFrame?.();
  if(f){frames.push(f);continue;}
  const d=mesh.userData;if(d?.center&&d.normal)frames.push({center:d.center,normal:d.normal,
   up:d.portalUp||UP, right:new THREE.Vector3().crossVectors(d.portalUp||UP,d.normal),halfWidth:d.portalBounds?.halfWidth,halfHeight:d.portalBounds?.halfHeight});
 }
 // In-world labels and instruments keep their exact authored visibility.
 // Plane signs can have a fixed texture or a changing process reading.
 const q=new THREE.Quaternion();
 (level.structure||level.world?.root)?.traverse(node=>{
  if(!node.isMesh||node.geometry?.type!=='PlaneGeometry'||!node.visible)return;
  const p=node.geometry.parameters;if(!p)return;
  node.getWorldQuaternion(q);frames.push({center:node.getWorldPosition(V()),normal:Z.clone().applyQuaternion(q),
   right:V(1,0,0).applyQuaternion(q),up:UP.clone().applyQuaternion(q),halfWidth:p.width/2,halfHeight:p.height/2});
 });
 return frames;
}

function supportedFootprint(rect,boxes){
 if(!boxes)return true;
 // The mount is a few centimetres outside the finish. Project its complete
 // field into the genuine slab; a doorway, glazed band or missing pier can
 // never be mistaken for a continuous wall by its enclosing bounds.
 return boxes.some(box=>[-1,1].every(x=>[-1,1].every(y=>box.containsPoint(rect.center.clone()
  .addScaledVector(rect.right,x*rect.halfWidth).addScaledVector(rect.up,y*rect.halfHeight).addScaledVector(rect.normal,-.10)))));
}

function completeWallField(rect,meshes){
 // Room 39 has a narrow service-bay edge between the sampled sightlines.
 // Test the complete reserved field against actual finite triangles, not
 // the enclosing box of a merged batch (which also contains open space).
 const inverse=new THREE.Matrix4().makeBasis(rect.right,rect.up,rect.normal).setPosition(rect.center).invert();
 const field=new THREE.Box3(V(-rect.halfWidth,-rect.halfHeight,.20),V(rect.halfWidth,rect.halfHeight,2));
 const local=new THREE.Matrix4(),matrix=new THREE.Matrix4(),bounds=new THREE.Box3(),triangle=new THREE.Triangle();
 for(const mesh of meshes){
  const geometry=mesh.geometry,positions=geometry?.attributes.position;if(!positions)continue;
  const index=geometry.index,count=index?.count??positions.count;
  if(!geometry.boundingBox)geometry.computeBoundingBox();
  const groups=Array.isArray(mesh.material)?geometry.groups:[{start:0,count,materialIndex:0}];
  for(let instance=0;instance<(mesh.isInstancedMesh?mesh.count:1);instance++){
   matrix.multiplyMatrices(inverse,mesh.matrixWorld);
   if(mesh.isInstancedMesh){mesh.getMatrixAt(instance,local);matrix.multiply(local);}
   bounds.copy(geometry.boundingBox).applyMatrix4(matrix);if(!bounds.intersectsBox(field))continue;
   for(const group of groups){
    const material=Array.isArray(mesh.material)?mesh.material[group.materialIndex]:mesh.material;
    if(!material||material.visible===false||material.transparent)continue;
    const start=Math.max(group.start,geometry.drawRange.start),end=Math.min(count,group.start+group.count,geometry.drawRange.start+geometry.drawRange.count);
    for(let i=start;i<end;i+=3){
     for(const [vertex,offset]of [[triangle.a,0],[triangle.b,1],[triangle.c,2]])vertex.fromBufferAttribute(positions,index?index.getX(i+offset):i+offset).applyMatrix4(matrix);
     if(field.intersectsTriangle(triangle))return false;
    }
   }
  }
 }
 return true;
}

function visibleWallField(rect,meshes,complete=false){
 // A finite patch needs a clear front, not just a wall behind its centre.
 // Check actual opaque triangles, including the manufactured instance skin.
 // This runs only while selecting the two fixed reviewed wall ornaments.
 const ray=new THREE.Raycaster(),point=V();
 for(const x of [-.8,0,.8])for(const y of [-.8,0,.8]){
  point.copy(rect.center).addScaledVector(rect.right,x*rect.halfWidth).addScaledVector(rect.up,y*rect.halfHeight);
  ray.set(point.addScaledVector(rect.normal,2),rect.normal.clone().negate());ray.near=0;ray.far=1.8;
  if(ray.intersectObjects(meshes,false).some(hit=>{
   const material=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material;
   return material?.visible!==false&&!material?.transparent;
  }))return false;
 }
 return !complete||completeWallField(rect,meshes);
}

function observedScreenFrames(level,kit,world){
 const frames=[],spawn=Array.isArray(level.spawn)?V().fromArray(level.spawn):V().copy(level.spawn||{});
 // These two fields were inspected from ordinary spawn views. Keep this
 // selection narrow: an arbitrary machine housing or white portal sheet is
 // not an architectural canvas, and moving gate leaves stay untouched.
 if(level.id==='post-air-switch')for(const s of world?.surfaces||[]){
  if(s.name!=='Sealed partition'||s.portal||s.collider?.kinematic||s.group?.parent!==world.root||s.width<9||s.height<7)continue;
  const f=s.getFrame();if(f.normal.z<.99)continue;
  frames.push({...f,span:s.width,height:s.height,fieldY:spawn.y+3.4,fieldX:spawn.dot(f.right),serviceField:true});
 }
 if(level.id==='puzzle-progression47-impact-archive')for(const c of kit?.envelopes||[]){
  const box=c.box,size=box.getSize(V()),center=box.getCenter(V());
  if(c.enabled===false||c.kinematic||c.mesh.name!=='Folded shell casing / collision'||size.x<9||size.y<7||size.z>.8||Math.abs(center.z+4)>.02)continue;
  frames.push({center:V(center.x,center.y,box.max.z+.025),normal:Z.clone(),right:V(1,0,0),up:UP.clone(),
   span:size.x,height:size.y,fieldY:spawn.y+3.4,fieldX:spawn.x,serviceField:true,supports:[box]});
 }
 return frames;
}

/** Ornament mounts come only from genuine fixed wall volumes. The entire
 * relief footprint is tested against portal and instrument apertures, not
 * just its centre. No floor, ramp, collider or portal registry is extended. */
export function campaignOrnamentSites(game,level,{limit=12}={}){
 const kit=level.workshop,world=level.world||kit?.world,frames=[];
 const reviewed=REVIEWED_ENCLOSED_FIELDS.has(level.id),frontSolids=[];
 if(reviewed&&world?.root){
  world.root.updateWorldMatrix(true,true);
  world.root.traverse(node=>{
   if(!node.isMesh||node.userData?.visualOnly||node.name.startsWith('Chapter ornament /'))return;
   for(let p=node;p;p=p.parent)if(!p.visible)return;
   frontSolids.push(node);
  });
 }
 if(kit?.roomEnvelope){
  const e=kit.roomEnvelope;frames.push(...wallFrames(e,e.base,e.roof,.77));
 }else if(level.tower&&level.rooms?.values){
  // Wing piers face the real atrium, where the player can see their finish.
  // The earlier north-wall mounts were hidden behind the same wing's front
  // wall. Reserve the whole low field below glazing and require solid support.
  for(const r of level.rooms.values()){
   const {b,def}=r,y=def.at[1],side=def.at[0]<0?1:-1,x=side>0?b.x1:b.x0,normal=V(side,0,0);
   const supports=(game.colliders||[]).filter(c=>c.enabled!==false&&!c.kinematic&&
    c.mesh.material?.name==='Castle wing wall / '+def.id&&Math.abs(c.box.getCenter(V()).x-x)<.01&&c.box.getSize(V()).x<.8).map(c=>c.box);
   if(!supports.length)continue;
   frames.push({center:V(x+side*.275,y+3.3,(b.z0+b.z1)/2),normal,right:V(0,0,-side),up:UP.clone(),
    span:b.z1-b.z0,height:6.6,supports});
  }
 }else if(level.flightGeometry&&level.bounds&&kit?.ceiling&&world?.root?.getObjectByName('Solid hangar roof')){
  frames.push(...wallFrames(level.bounds,0,kit.ceiling,0));
 }else for(const s of world?.surfaces||[]){
  if(s.portal||s.collider?.kinematic||s.width<9||s.height<7||s.group?.parent!==world.root||!/structural tiles/i.test(s.name))continue;
  const f=s.getFrame();if(Math.abs(f.normal.y)>.02)continue;
  frames.push({...f,span:s.width,height:s.height});
 }
 frames.unshift(...observedScreenFrames(level,kit,world));
 const excluded=protectedFrames(game,level),walls=[];
 for(const wall of frames){
  const bayCount=Math.max(1,Math.ceil(wall.span/10)),bay=wall.span/bayCount;
  const h=Math.min(3.8,wall.height*(level.tower?.60:.30)),w=Math.min(3.8,bay*.58);
  if(h<1.8||w<1.8)continue;
  // Bias the artwork to upper wall fields in laboratory rooms. Castle
  // reliefs use the closed 0–6.6 m wall band below fixed glazing instead.
  let cy=Number.isFinite(wall.fieldY)?THREE.MathUtils.clamp(wall.fieldY-wall.center.y,-wall.height/2+h/2+.22,wall.height/2-h/2-.22):
   level.tower?0:Math.min(wall.height*.20,wall.height/2-h/2-2);
  if((level.id==='foundation-first-connection'||reviewed)&&kit?.enclosed&&Number.isFinite(kit.roomEnvelope?.roof)){
   // encloseLab carries a real 0.7 m cornice at roof - 2.6. Its front
   // projects beyond these shallow carvings. Keep the complete reserved
   // field below that beam instead of letting it erase the upper arc/ticks.
   // Only the opening room and the reviewed later enclosures use this cap.
   const upper=kit.roomEnvelope.roof-2.95-.12-h/2-.22-wall.center.y;
   if(upper< -wall.height/2+h/2+.22)continue;
   cy=Math.min(cy,upper);
  }
  const field=Number.isFinite(wall.fieldX)?(wall.fieldX-wall.center.dot(wall.right)+wall.span/2)/bay-.5:(bayCount-1)/2;
  const candidates=[],bays=Array.from({length:bayCount},(_,i)=>i).sort((a,b)=>Math.abs(a-field)-Math.abs(b-field));
  for(const i of bays){
   const center=wall.center.clone().addScaledVector(wall.right,-wall.span/2+(i+.5)*bay).addScaledVector(wall.up,cy);
   const rect={...wall,center,halfWidth:w/2+.22,halfHeight:h/2+.22};
   const covered=excluded.some(p=>{
    if(Math.abs(p.center.clone().sub(center).dot(wall.normal))>3.2)return false;
    // Portal porcelain often stands forward of its load-bearing wall. Its
    // complete projection is reserved too, regardless of that mounting gap.
    const projected={...p,center:p.center.clone().addScaledVector(wall.normal,-p.center.clone().sub(center).dot(wall.normal))};
    return architecturalRectOverlapsPortal(rect,projected,.45);
   });
   if(covered||!supportedFootprint(rect,wall.supports)||(reviewed&&!visibleWallField(rect,frontSolids,level.id==='post-thermal-memory')))continue;
   candidates.push({...rect,width:w,height:h,wallDepth:.77,serviceField:wall.serviceField===true});
  }
  walls.push(candidates);
 }
 // Give every wall (and every castle wing) an identity before adding a second
 // ornament to one wall. A long hangar must not spend its entire budget on
 // the first twelve bays at one end of the building.
 const sites=[];
 for(let column=0;column<Math.max(0,...walls.map(w=>w.length));column++)for(const wall of walls){
  if(wall[column])sites.push(wall[column]);if(sites.length>=limit)return sites;
 }
 return sites;
}

function createBatch(root,materials){
 const groups=new Map(),geometries=new Map(),matrix=new THREE.Matrix4(),p=V(),s=V(),q=new THREE.Quaternion();
 const geometry=kind=>{
  if(geometries.has(kind))return geometries.get(kind);
  const g=kind==='arc'?new THREE.TorusGeometry(1,.065,6,24,Math.PI*.90):kind==='ring'?new THREE.TorusGeometry(1,.065,6,32):kind==='leaf'?new THREE.SphereGeometry(1,10,8):
   kind==='facet'?new THREE.OctahedronGeometry(1,0):new THREE.BoxGeometry(1,1,1);
  if(kind==='leaf'){
   // A curved lance with a raised central fold, rather than five flat round
   // stickers. Its thickness remains inside the genuine wall relief budget.
   const p=g.attributes.position;
   for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    p.setXYZ(i,x*.65*(1-y*.15),y,z*.45+.36*(1-y*y)+.12*y);
   }
   p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  }
  geometries.set(kind,g);return g;
 };
 return {
  geometries,
  add(site,kind,material,at,size,angle=0){
   const key=kind+'/'+material;if(!groups.has(key))groups.set(key,{kind,material,entries:[]});
   p.fromArray(at);s.fromArray(size);q.setFromAxisAngle(Z,angle);
   const frame=new THREE.Matrix4().makeBasis(site.right,site.up,site.normal).setPosition(site.center);
   matrix.multiplyMatrices(frame,new THREE.Matrix4().compose(p,q,s));groups.get(key).entries.push(matrix.clone());
  },
  finish(){
   let instances=0,triangles=0;
   for(const {kind,material,entries}of groups.values()){
    const g=geometry(kind),mesh=new THREE.InstancedMesh(g,materials[material],entries.length);
    mesh.name=`Chapter ornament / ${kind} / ${material}`;mesh.userData.visualOnly=true;
    mesh.castShadow=false;mesh.receiveShadow=true;
    entries.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
    instances+=entries.length;triangles+=entries.length*(g.index?.count??g.attributes.position.count)/3;
   }
   return {batches:groups.size,instances,triangles};
  },
 };
}

function buildMotif(batch,site,id){
 const a=(kind,material,p,s,angle=0)=>batch.add(site,kind,material,p,s,angle),unit=Math.min(site.width,site.height)/2;
 const rod=(x,y,length,angle=0,paint='frame')=>a('box',paint,[x*unit,y*unit,.045],[.07,length*unit,.065],angle);
 if(id==='biosphere'){
  rod(0,-.02,1.72);rod(-.27,-.02,.65,-.62);rod(.27,.30,.65,.62);
  for(const [x,y,r]of [[-.38,-.35,-.65],[.38,-.03,.65],[-.38,.31,-.65],[.32,.60,.58],[0,.74,0]])
   a('leaf','paint',[x*unit,y*unit,.068],[unit*.28,unit*.35,.14],r);
  a('box','frame',[0,-unit*.95,.038],[unit*.82,.085,.05]);
 }else if(id==='dynamo'){
  for(let i=0;i<5;i++)a('box','paint',[(i-2)*unit*.28,0,.040],[unit*.105,unit*(1.38-Math.abs(i-2)*.16),.065]);
  for(const y of [-.86,.86])a('box','frame',[0,y*unit,.047],[unit*1.56,.10,.065]);
  a('ring','frame',[0,0,.085],[unit*.38,unit*.38,.56]);
 }else if(id==='fracture'){
  for(const [x,y,s,r]of [[-.36,-.08,.61,-.23],[.23,.15,.73,.31],[.42,-.45,.36,-.29]])
   a('facet','paint',[x*unit,y*unit,.045],[unit*s*.40,unit*s,.045],r);
  rod(-.79,0,1.80,.07);rod(.79,0,1.80,-.07);
  a('box','frame',[0,-unit*.93,.035],[unit*1.58,.075,.04]);
 }else if(id==='castle'){
  // Three pointed lancets are open gilded ribs, never pale portal-like cards.
  for(const x of [-.53,0,.53]){
   const h=x===0?1.50:1.22;rod(x,-.12,h,0,'paint');
   for(const side of [-1,1])a('box','paint',[(x+side*.12)*unit,(h/2-.03)*unit,.042],[.06,unit*.34,.055],side*.55);
  }
  a('box','frame',[0,-unit*.92,.03],[unit*1.65,.12,.055]);
  a('facet','paint',[0,-unit*.93,.073],[unit*.13,unit*.18,.045]);
 }else if(id==='discovery'){
  // Offset open calibration arcs have no closed rim or ceramic centre. The
  // old concentric circles looked like inactive portal targets in room 8.
  a('arc','frame',[-unit*.06,unit*.06,.048],[unit*.78,unit*.78,.50],-.36);
  a('arc','paint',[-unit*.16,-unit*.28,.078],[unit*.46,unit*.46,.52],Math.PI*1.17);
  for(let i=0;i<3;i++){
   a('box','paint',[unit*.75,unit*(-.18+i*.23),.040],[unit*(.13+i*.04),.055,.05]);
   a('box','frame',[unit*(-.70+i*.24),unit*.90,.040],[.055,unit*(.12+i*.035),.05],-.18);
  }
  rod(-.90,-.44,.43,.08);
 }else {
  const orbital=id==='observatory';
  a('ring','frame',[0,0,.048],[unit*.80,unit*.80,.50]);
  a('ring','paint',[0,0,.078],[unit*.52,unit*(orbital?.24:.52),.52],orbital?.42:0);
  const n=orbital?(site.serviceField?5:7):4;
  for(let i=0;i<n;i++){
   const t=i/n*Math.PI*2;
   a('box','paint',[Math.sin(t)*unit*.88,Math.cos(t)*unit*.88,.04],[.07,unit*.17,.05],-t);
  }
  if(orbital&&site.serviceField)for(const y of [-.96,.96])a('box','paint',[0,y*unit,.04],[unit*1.8,.055,.05]);
  if(!orbital)for(const side of [-1,1])rod(side*.95,0,1.28);
 }
}

/** A chapter is visible in architecture, not only in a menu tint. All reliefs
 * share bounded instanced batches. Their shallow depth stays inside the
 * existing structural rib envelope; nothing can become a decorative ledge.
 * Animation moves dim ornamental beads, never a lamp, obstacle or signal. */
export function installCampaignEnvironment(game,level,theme){
 if(level.campaignEnvironment||!CAMPAIGN_ORNAMENTS[theme.id])return level;
 // One small set of chapter landmarks is enough. Repeating twelve emblems
 // across bare walls made the room kit look stamped and competed with the
 // machines. The castle retains its separate navigational wing identities.
 const sites=campaignOrnamentSites(game,level,{limit:theme.id==='castle'?(game.quality?.shadows===false?8:12):2});
 if(!sites.length)return level;
 const parent=level.structure||level.world?.root||level.workshop?.world?.root;if(!parent)return level;
 const root=new THREE.Group();root.name='Chapter architectural relief';root.userData.visualOnly=true;root.userData.keepMaterial=true;
 // Mounts are expressed in world coordinates, so a translated room root
 // must not apply its transform a second time to the finished batches.
 parent.updateWorldMatrix(true,false);root.matrix.copy(parent.matrixWorld).invert();root.matrixAutoUpdate=false;parent.add(root);
 const ornamentPaint=theme.id==='discovery'?0x8c6a48:theme.id==='observatory'?0xa6b3cf:theme.paint;
 const materials={
  frame:new THREE.MeshStandardMaterial({name:'Chapter ornament / mineral recess',color:theme.dark,roughness:.82,metalness:.08}),
  paint:new THREE.MeshStandardMaterial({name:'Chapter ornament / chapter enamel',color:ornamentPaint,roughness:.64,metalness:theme.id==='dynamo'||theme.id==='castle'?.48:.12}),
  bead:new THREE.MeshStandardMaterial({name:'Chapter ornament / quiet ambient bead',color:ornamentPaint,roughness:.48,metalness:.25,
   emissive:new THREE.Color(ornamentPaint),emissiveIntensity:.28}),
 };
 const batch=createBatch(root,materials);for(const site of sites)buildMotif(batch,site,theme.id);
 const stats=batch.finish(),beadGeometry=new THREE.SphereGeometry(1,7,5),beads=new THREE.InstancedMesh(beadGeometry,materials.bead,sites.length);
 beads.name='Chapter ambient motion / ornamental beads';beads.userData.visualOnly=true;beads.castShadow=false;
 beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(beads);
 const matrix=new THREE.Matrix4(),position=V(),scale=V(.085,.085,.065),q=new THREE.Quaternion();
 let previous=0,time=0,disposed=false;
 const motionPreference=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
 const reduced=()=>game.epicDirector?.options?.reducedMotion===true||game.epicOptions?.reducedMotion===true||motionPreference?.matches===true;
 const render=(alpha=1)=>{
  if(disposed)return;
  const t=reduced()?0:THREE.MathUtils.lerp(previous,time,THREE.MathUtils.clamp(alpha,0,1));
  for(let i=0;i<sites.length;i++){
   const site=sites[i],u=Math.min(site.width,site.height)/2,phase=t*.23+i*1.72;
   const calibrationAngle=-.36+Math.PI*.90*(.5+.5*Math.sin(phase));
   const x=theme.id==='discovery'?-u*.06+Math.cos(calibrationAngle)*u*.78:theme.id==='dynamo'?Math.sin(phase)*u*.54:theme.id==='biosphere'?Math.sin(phase)*u*.055:Math.sin(phase)*u*.69;
   const y=theme.id==='discovery'?u*.06+Math.sin(calibrationAngle)*u*.78:theme.id==='biosphere'?u*.64+Math.cos(phase*.8)*u*.025:theme.id==='castle'?Math.sin(phase*.5)*u*.30:Math.cos(phase)*u*.69;
   position.copy(site.center).addScaledVector(site.right,x).addScaledVector(site.up,y).addScaledVector(site.normal,.14);
   q.setFromUnitVectors(Z,site.normal);matrix.compose(position,q,scale);beads.setMatrixAt(i,matrix);
  }
  beads.instanceMatrix.needsUpdate=true;
 };
 render();beads.computeBoundingBox();beads.computeBoundingSphere();
 // All trajectories remain within each reserved footprint; one fixed bound
 // avoids recomputing bounds while a bead moves around its sculpture.
 const bounds=new THREE.Box3();for(const s of sites){const p=s.center,r=Math.hypot(s.halfWidth,s.halfHeight)+.2;bounds.expandByPoint(p.clone().addScalar(r));bounds.expandByPoint(p.clone().addScalar(-r));}
 beads.boundingBox=bounds;beads.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());
 const update=level.update,reset=level.reset,renderUpdate=level.renderUpdate,dispose=level.dispose;
 level.update=function(dt,...args){const result=update?.call(this,dt,...args);previous=time;if(!disposed&&Number.isFinite(dt)&&dt>0)time+=dt;return result;};
 level.renderUpdate=function(alpha=1,...args){const result=renderUpdate?.call(this,alpha,...args);render(alpha);return result;};
 level.reset=function(...args){const result=reset?.apply(this,args);previous=time=0;render();return result;};
 level.dispose=function(...args){
  if(disposed)return;disposed=true;
  // Detach before the shared level traverser runs: this pass exclusively owns
  // every new material and geometry, including the instancing buffers.
  root.removeFromParent();root.traverse(node=>{if(node.isInstancedMesh)node.dispose();});
  for(const g of batch.geometries.values())g.dispose();beadGeometry.dispose();for(const m of Object.values(materials))m.dispose();
  return dispose?.apply(this,args);
 };
 const diagnostics=Object.freeze({theme:theme.id,motif:CAMPAIGN_ORNAMENTS[theme.id],mounts:sites.length,
  batches:stats.batches+1,instances:stats.instances+sites.length,triangles:stats.triangles+sites.length*beadGeometry.index.count/3,
  extraLights:0,extraColliders:0,animatedInstances:sites.length,maxReliefDepth:.21});
 root.userData.stats=diagnostics;root.userData.mounts=sites.map(s=>({center:s.center.toArray(),normal:s.normal.toArray(),right:s.right.toArray(),up:s.up.toArray(),halfWidth:s.halfWidth,halfHeight:s.halfHeight}));
 level.campaignEnvironment={root,diagnostics,get elapsed(){return time;},get disposed(){return disposed;}};
 return level;
}
