import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion(),Z=V(0,0,1);
export const OBSERVATORY_ART_REVISION='v66-observatory-physical-machinery-2';

/** A second art pass for the ten observatory rooms. Large fittings now have
 * real manufactured depth and their own measured collision. Original portal
 * masters, optical axes, moving body shapes and walking floors are untouched.
 * Sibling visual followers never enlarge a solver's setFromObject(owner). */
function workshop(k){
 const mats={
  paint:new THREE.MeshStandardMaterial({name:'Observatory / petrol enamel',color:0x527c83,roughness:.58,metalness:.25}),
  dark:new THREE.MeshStandardMaterial({name:'Observatory / dark cast iron',color:0x243d49,roughness:.62,metalness:.45}),
  metal:new THREE.MeshStandardMaterial({name:'Observatory / machined alloy',color:0x9faea8,roughness:.39,metalness:.73}),
  copper:new THREE.MeshStandardMaterial({name:'Observatory / copper conductor',color:0xc48c53,roughness:.38,metalness:.72}),
  ivory:new THREE.MeshStandardMaterial({name:'Observatory / mineral casting',color:0xb9c7bf,roughness:.71,metalness:.12}),
 };
 for(const m of Object.values(mats))m.userData.keepMaterial=true;
 const stats={revision:OBSERVATORY_ART_REVISION,stableLevel:k.index+1,physicalParts:[],followers:0,liveReadings:0};
 const updates=[],renders=[];
 const raw=(g,p,mat='paint',name='machine member',{parent=k.world.root,batch=true,q=Q()}={})=>{
  const m=k.geometry(g,typeof mat==='string'?mats[mat]:mat,p,q,{parent,batch,name:'Observatory / '+name});
  m.userData.visualAuditObservatory=true;return m;
 };
 function collider(p,s,name){
  const box=new THREE.Box3().setFromCenterAndSize(V(...p),V(...s)),c=k.game.collisionProxy(box);
  c.mesh.name='Observatory / '+name+' / physical';c.visualAuditObservatory=true;
  stats.physicalParts.push({name,min:box.min.toArray(),max:box.max.toArray()});return c;
 }
 function box(p,s,mat='paint',name='machine member',{solid=true,...options}={}){
  const m=raw(new THREE.BoxGeometry(...s),p,mat,name,options);
  if(solid){if(options.parent&&options.parent!==k.world.root)throw new Error('Static observatory collision requires world coordinates');collider(p,s,name);}
  return m;
 }
 // A closed back, full-depth folded perimeter and deep recessed field. The
 // one physical box covers the actual closed casing; no large hollow AABB.
 function casing(p,s,name,{mat='paint',axis='z'}={}){
  const [a,b,c]=s,w=axis==='x'?c:a,h=b,d=axis==='x'?a:c;
  const q=axis==='x'?Q().setFromAxisAngle(V(0,1,0),Math.PI/2):Q(),parts=[];
  const add=(v,size,material)=>{
   const pos=V(...v).applyQuaternion(q).add(V(...p));
   const sizeWorld=axis==='x'?[size[2],size[1],size[0]]:size;
   const m=box(pos.toArray(),sizeWorld,material,name+' / formed '+material,{solid:false});parts.push(m);return m;
  };
  const rim=Math.min(.32,w*.12,h*.12);
  add([0,0,0],[w,h,d*.42],'dark');
  for(const sign of [-1,1])add([0,0,sign*d*.25],[w-2*rim,h-2*rim,d*.10],mat);
  for(const sign of [-1,1]){
   add([sign*(w-rim)/2,0,0],[rim,h,d],'metal');
   add([0,sign*(h-rim)/2,0],[w-2*rim,rim,d],'dark');
  }
  collider(p,s,name);return {p:V(...p),s,parts};
 }
 function pipe(a,b,width=.5,mat='metal',name='pressure conduit'){
  const delta=V(...b).sub(V(...a)),axis=delta.toArray().findIndex(x=>Math.abs(x)>.00001);
  if(axis<0||delta.toArray().filter(x=>Math.abs(x)>.00001).length!==1)throw new Error('Observable service conduits require axis-aligned physical members');
  const size=[width,width,width];size[axis]=Math.abs(delta.getComponent(axis));
  return box(V(...a).add(V(...b)).multiplyScalar(.5).toArray(),size,mat,name);
 }
 function visualDisk(p,r,depth,mat='metal',normal=[0,0,1],name='bearing face'){
  return raw(new THREE.CylinderGeometry(r,r,depth,32),p,mat,name,{q:Q().setFromUnitVectors(V(0,1,0),V(...normal))});
 }
 function follow(owner,local,size,mat,name,{solid=false}={}){
  const group=new THREE.Group();group.name='Observatory / actual '+name+' follower';k.world.root.add(group);
  const mesh=box(local,size,mat,name,{solid:false,parent:group,batch:false});
  const c=solid?k.game.collisionProxy(new THREE.Box3().setFromCenterAndSize(V(),V(...size)),{kinematic:true}):null;
  if(c){c.mesh.name='Observatory / '+name+' / moving physical';c.visualAuditObservatory=true;}
  const sync=dt=>{
   owner.updateWorldMatrix(true,false);group.matrix.copy(owner.matrixWorld);group.matrixAutoUpdate=false;group.matrixWorldNeedsUpdate=true;group.updateWorldMatrix(true,true);
   if(c)k.game.syncCollision(c,new THREE.Box3().setFromObject(mesh),dt);
  };
  updates.push(sync);sync(0);stats.followers++;return {group,mesh,collider:c};
 }
 function dial(p,r,read,{min=0,max=1,normal=[0,0,1]}={}){
  // This lies inside its owner's closed casing or a dedicated closed gauge.
  const group=new THREE.Group();group.position.fromArray(p);group.quaternion.setFromUnitVectors(Z,V(...normal));k.world.root.add(group);
  raw(new THREE.CylinderGeometry(r,r,.08,32),[0,0,0],'ivory','actual-value dial',{parent:group,batch:false,q:Q().setFromAxisAngle(V(1,0,0),Math.PI/2)});
  for(let i=0;i<9;i++){
   const t=-1.15+i*2.3/8;raw(new THREE.BoxGeometry(.045,r*.16,.02),[Math.sin(t)*r*.78,Math.cos(t)*r*.78,.052],'dark','engraved instrument scale',{parent:group,batch:false,q:Q().setFromAxisAngle(Z,-t)});
  }
  const needle=raw(new THREE.BoxGeometry(r*.09,r*.76,.035),[0,r*.30,.075],'copper','needle of actual mechanism',{parent:group,batch:false});
  const update=()=>{const a=1.15-2.3*THREE.MathUtils.clamp((read()-min)/(max-min),0,1);needle.rotation.z=a;needle.position.set(-Math.sin(a)*r*.30,Math.cos(a)*r*.30,.075);};
  renders.push(update);update();stats.liveReadings++;return group;
 }
 function finish(){
  if(updates.length){const sync=dt=>{for(const update of updates)update(dt);};k.ticks.push(sync);k.resets.push(()=>sync(0));}
  if(renders.length){const sync=()=>{for(const render of renders)render();};k.renders.push(sync);k.resets.push(sync);}
  k.visualAuditObservatory=stats;k.world.root.userData.visualAuditObservatory=stats;return stats;
 }
 return {k,mats,stats,updates,renders,raw,box,casing,pipe,visualDisk,follow,dial,finish};
}

function freightRack(a,l){
 const {box,casing}=a;
 casing([-15.5,2.05,11.575],[16.6,1.4,.75],'freight rack guide bed');
 for(let i=0;i<14;i++)box([-21+i,2.38,11.78],[.48,.48,.28],'copper','full-size rack tooth',{solid:false});
 for(const x of [-23.1,-7.9])casing([x,2.05,11.59],[1.2,1.38,.72],'rack end bearing',{mat:'ivory'});
 if(l.rack?.mesh){
  // The real cargo contact translates in X; this broad inspection shoe is
  // recessed in the closed guide bed and displays that exact displacement.
  const shoe=box([-21,2.05,11.70],[1.05,.88,.35],'ivory','rack inspection shoe',{solid:false,batch:false});
  a.updates.push(()=>{shoe.position.x=l.rack.mesh.position.x;});a.stats.followers++;
 }
}

function shadowPartition(a){
 for(const x of [-21,-9,9,21])a.casing([x,7,-8],[.95,14,1.75],'optical trunk structural mullion',{mat:'dark'});
 a.casing([0,4.8,-8],[52,1.4,1.75],'continuous optical gate header',{mat:'dark'});
 // Wide black fields stay dark for their optical role; the load frame now
 // has a metre-scale front return rather than a line drawn on a flat wall.
 for(const x of [-15,15])a.casing([x,10,-7.78],[10.5,5.7,1.1],'sealed optical partition bay',{mat:'dark'});
}

function hydraulicMachine(a,l){
 const {box,casing,pipe}=a;
 casing([4,1.3,4.5],[2.7,2.6,2.3],'hydraulic return pump skid');
 casing([4,2.48,4.5],[2.1,.22,1.8],'hydraulic skid top motor deck',{mat:'metal'});
 for(const z of [4.0,5.0])box([4,1.25,z],[1.75,1.0,.40],'metal','pump cylinder block');
 const points=[[-16.75,12.1,-20],[-17.55,12.1,-20],[-17.55,13.3,-20],[-18.2,13.3,-20],[-18.2,1.6,-20],[-2,1.6,-20],[-2,1.6,6]];
 for(let i=1;i<points.length;i++)pipe(points[i-1],points[i],.54,'paint','continuous hydraulic pressure trunk');
 for(const p of [[-18.2,1.6,-20],[-2,1.6,-20],[-2,1.6,6]])casing(p,[.94,.94,.94],'hydraulic elbow manifold',{mat:'metal'});
 // The return branch enters the founded service plinth. An exposed cross
 // pipe would obstruct either the boarded observer's cargo-inlet shot or
 // the lower hall's ordinary approach to the bulkhead.
 pipe([-2,-.75,4.5],[-2,1.6,4.5],.48,'metal','ram-side founded pressure riser');
 pipe([-2,-.75,4.5],[4,-.75,4.5],.48,'metal','pump-to-lift pressure connection inside service plinth');
 pipe([4,-.75,4.5],[4,1.3,4.5],.48,'metal','pump-side founded pressure riser');
 casing([-2,.92,6],[1.56,1.76,1.56],'load-bearing hydraulic ram head',{mat:'ivory'});
 a.dial([4,1.35,5.52],.62,()=>l.circuit?.height||0,{max:10.2});
 // The flow inspection stripe is represented on the visible front of the
 // enlarged real trunk; it still uses the original conserved-liquid state.
 for(const m of a.k.world.root.children.filter(o=>o.name==='Siphon inspection channel')){
  const old=m.geometry,axis=V(0,1,0).applyQuaternion(m.quaternion),normal=Math.abs(axis.z)>.9?V(1,0,0):V(0,0,1);
  m.position.z-=.155;m.position.addScaledVector(normal,.263);
  m.geometry=new THREE.BoxGeometry(.24,old.parameters.height,.012);old.dispose();
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(axis.clone().cross(normal),axis,normal));
 }
}

function pneumaticMachine(a,l){
 for(const x of [-9.5,-14.5])a.casing([x,3,4.5],[1.0,.90,.90],'closed pressure quick coupling',{axis:'x',mat:'metal'});
 a.casing([-7,3.35,3.30],[1.70,1.65,.65],'reservoir pressure instrument',{mat:'ivory'});
 a.dial([-7,3.35,3.52],.57,()=>l.pressureState?.pressure||0,{max:100});
 // The old free torus intersects the replacement vessel's lower flange;
 // remove that duplicate skin and use one closed, founded load cradle.
 for(const m of a.k.world.root.children.filter(o=>o.name==='Reservoir retaining ring'&&Math.abs(o.position.y-.3)<.02))m.visible=false;
 a.casing([-7,.36,2],[3.4,.72,3.4],'reservoir founded load cradle',{mat:'dark'});
}

function sluiceDrive(a,l){
 if(l.spawnView)Object.assign(l.spawnView,{yaw:-.30,pitch:.12});
 for(const [z,gate] of [[9,l.first],[-7,l.second]]){
  for(const x of [-3.45,3.45])a.casing([x,3.0,z],[.95,6,1.65],'sluice side guide and drive foot',{mat:'ivory'});
  a.casing([0,5.9,z],[11.2,3,1.9],'closed common sluice drive housing');
  for(const x of [-3.6,3.6]){
   a.casing([x,5.9,z+.67],[2.4,2.1,.48],'sluice cable drum casing',{mat:'metal'});
   a.visualDisk([x,5.9,z+.80],.79,.14,'copper');
   const pieces=[new THREE.TorusGeometry(.63,.055,6,28)];
   for(let i=0;i<4;i++){const g=new THREE.BoxGeometry(1.18,.11,.065);g.rotateZ(i*Math.PI/4);pieces.push(g);}
   const gs=pieces.map(g=>g.index?g.toNonIndexed():g),wheel=mergeGeometries(gs,false);
   for(const g of new Set([...pieces,...gs]))g.dispose();
   const mesh=a.raw(wheel,[x,5.9,z+.887],'dark','gate-driven cable drum spokes',{batch:false});
   a.renders.push(()=>{mesh.rotation.z=(gate?.progress||0)*Math.PI*4;});
   a.visualDisk([x,5.9,z+.91],.15,.06,'metal');
  }
  a.dial([0,5.9,z+.83],.64,()=>gate?.progress||0);
 }
 // Real air receiver to the common header: a continuous, elevated service
 // trunk. It stays above heads and above all of the actual air portal axes.
 for(const [sourceZ,gateZ]of [[23,9],[4,-7]]){
  a.pipe([-19,4.2,sourceZ+1.35],[-19,7.75,sourceZ+1.35],.48,'metal','air receiver vertical transmission');
  a.pipe([-19,7.75,sourceZ+1.35],[-5.1,7.75,sourceZ+1.35],.48,'paint','sluice pressure header');
  a.pipe([-5.1,7.75,sourceZ+1.35],[-5.1,7.75,gateZ],.48,'paint','receiver-to-sluice pressure trunk');
  a.pipe([-5.1,6.6,gateZ],[-5.1,7.75,gateZ],.48,'paint','sluice header down-feed');
 }
}

function impactRotor(a,l){
 a.casing([-8,5.3,-5],[4,2.6,4],'rotor thrust gearbox',{mat:'dark'});
 // A bevel output in both recessed inspection faces makes the retained
 // spindle angle readable from either gallery, while the real vertical
 // spindle still enters the centre of the load-bearing gearbox.
 const teeth=[];
 for(let i=0;i<12;i++){
  const t=i*Math.PI/6,g=new THREE.BoxGeometry(.25,.40,.15);g.rotateZ(t-Math.PI/2);g.translate(Math.cos(t)*.78,Math.sin(t)*.78,0);teeth.push(g);
 }
 const geometry=mergeGeometries(teeth,false);teeth.forEach(g=>g.dispose());
 for(const side of [-1,1]){
  a.visualDisk([-8,5.3,-5+side*1.84],.77,.10,'metal',[0,0,1],'retained rotor bevel face');
  const toothMesh=a.raw(geometry.clone(),[-8,5.3,-5+side*1.85],'copper','large retained rotor bevel teeth',{batch:false});
  const key=a.raw(new THREE.BoxGeometry(.92,.14,.13),[-8,5.3,-5+side*1.85],'dark','retained rotor actual-angle key',{batch:false});
  a.renders.push(()=>{toothMesh.rotation.z=l.rotor?.angle||0;key.rotation.z=l.rotor?.angle||0;});
 }
 geometry.dispose();
 a.pipe([-8,3.55,-5],[-8,4.05,-5],.72,'metal','continuous rotor output spindle');
}

function magneticChannel(a,l){
 const points=[[-16,-6],[16,-6],[16,-20]];
 points.forEach(([x,z],index)=>{
  // Every new solid begins at the existing roof: no hand-feed opening,
  // cargo sight slit or original field centre is changed.
  const receiver=index===2,atZ=receiver?z-2.6:z,legX=receiver?2.8:1.48;
  for(const side of [-1,1])a.casing([x+side*legX,receiver?2.95:3.65,atZ],[.62,receiver?5.9:2.8,1.05],'magnet return yoke '+index,{mat:'dark'});
  a.casing([x,5.45,atZ],[receiver?6.22:3.58,.9,1.25],'magnet pole bridge '+index,{mat:'dark'});
  const copper=a.mats.copper.clone();copper.name='Observatory / live field conductor '+index; copper.userData.keepMaterial=true;
  for(let i=0;i<7;i++)a.box([x+(i-3)*.31,5.45,atZ],[.18,.88,1.20],copper,'visible copper field winding '+index,{solid:false});
  a.renders.push(()=>{const active=l.getMagnet?.()===index;copper.emissive.setHex(active?0x256e66:0x000000);copper.emissiveIntensity=active?.7:0;});
 });
 // A broad lower cheek stays the original solid tunnel; top ribs already
 // installed by the late pass remain. These are actual pole assemblies.
}

function freightHoist(a,l){
 for(const x of [4.4,17.6]){
  a.casing([x,7.7,0],[1.0,23.4,1.4],'hoist continuous vertical guide',{mat:'dark'});
  a.box([x,7.7,-.48],[.35,23.2,.24],'metal','hoist machined guide face',{solid:false});
 }
 a.casing([11,18.8,0],[14.2,1.2,1.8],'founded hoist crosshead');
 a.casing([11,18.8,0],[4.2,1.16,1.75],'hoist traction gearbox',{mat:'metal'});
 for(const x of [4.95,17.05])if(l.freight?.group){
  // Shoes ride on the real carrier, not an independent animation. The guide
  // feet stand outside its 12 m floor and cannot turn into a second route.
  a.follow(l.freight.group,[x-11,-.72,6],[1.0,.64,1.15],'metal','hoist travelling guide shoe',{solid:true});
 }
}

function thermalEmitter(a,l){
 a.casing([17.75,1.2,17],[3.4,2.4,3.2],'thermal source founded pedestal',{mat:'dark'});
 a.casing([18.85,3.35,17],[1.9,2.9,3.2],'thermal emitter power and cooling body');
 for(let i=0;i<5;i++)a.box([18.85,2.30+i*.45,18.45],[1.70,.17,.26],'metal','emitter rear cooling fin',{solid:false});
 a.casing([19.2,1.2,17],[1.15,2.35,1.45],'emitter power feed foot',{mat:'metal'});
 // Optical head and its emitting normal remain the original projector.
 if(l.emitter)a.dial([18.85,3.35,18.45],.65,()=>l.thermal?.temperature||20,{min:20,max:470});
}

function differentialSlides(a,l){
 for(const s of l.shutters||[]){
  for(const x of [-10.4,10.4])a.casing([x,4.5,s.z],[1.0,9,1.8],'calibrator founded linear guide',{mat:'dark'});
  a.casing([0,8.9,s.z],[21.8,1.0,1.8],'calibrator fixed common crosshead');
  for(const y of [4.35,6.55])a.casing([0,y,s.z+.67],[20.2,.55,.64],'precision linear slide rail',{mat:'metal'});
  for(const part of [s.parts[2],s.parts[3]]){
   // The 2.2 m tall clevis links each actual translating jaw to both rails.
   // Its bottom is above the y=3 optical axis and supplies no low step.
   a.follow(part.mesh,[0,2.40,.76],[.78,2.45,.64],'copper','calibrated jaw travelling clevis',{solid:true});
   a.follow(part.mesh,[0,3.55,.76],[2.10,.60,.64],'ivory','calibrated jaw upper slide block',{solid:true});
  }
 }
}

export function dressVisualAuditObservatory(k,extra={}){
 const stable=k.index+1;if(stable<31||stable>40||k.visualAuditObservatory)return k.visualAuditObservatory??null;
 const a=workshop(k),builders={31:freightRack,32:shadowPartition,33:hydraulicMachine,34:pneumaticMachine,35:sluiceDrive,36:impactRotor,37:magneticChannel,38:freightHoist,39:thermalEmitter,40:differentialSlides};
 builders[stable](a,extra);return a.finish();
}
