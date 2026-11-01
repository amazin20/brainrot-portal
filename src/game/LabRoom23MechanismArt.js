import * as THREE from 'three';

export const ROOM23_MECHANISM_ART_REVISION='room23-closed-observation-panels-v1';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
const PANELS=[
 {position:[3.1,10,-1.85],size:[6.4,20,.6],name:'Freight shaft observation backing'},
 {position:[14.8,9.9,-3.5],size:[.35,19.8,27],name:'East closed observation partition'},
];

/** Two closed, glazed observation walls expose the existing massive cabins.
 * The original boxes remain the sole physical/camera/aim/light owners, with
 * their exact triangles and subtrees. All visible parts are sibling batches
 * contained inside those two measured boxes; every window has a closed pane.
 * The rear screens concealing the return receiver are deliberately untouched.
 */
export function buildRoom23MechanismArt(k,targets){
 if(k.game.chamberEdition!=='foundation'||k.index!==22)return null;
 if(k.room23MechanismArt&&!k.room23MechanismArt.disposed)return k.room23MechanismArt;
 if(targets?.length!==PANELS.length)throw new Error('Room23 needs exactly its two closed observation walls');
 const root=new THREE.Group();root.name='Room23 / closed cabin observation construction';
 root.userData={visualOnly:true,keepMaterial:true,revision:ROOM23_MECHANISM_ART_REVISION};k.world.root.add(root);
 const geometry=new THREE.BoxGeometry(1,1,1);
 const materials={
  frame:new THREE.MeshStandardMaterial({name:'Room23 observation frame / cast bronze and enamel',color:0xffffff,roughness:.48,metalness:.36}),
  glass:new THREE.MeshStandardMaterial({name:'Room23 closed observation glass',color:0x94b7b3,roughness:.25,metalness:.12,transparent:true,opacity:.34,depthWrite:false}),
 };
 for(const material of Object.values(materials))material.userData.keepMaterial=true;
 const mounts=[],banks={frame:[],glass:[]},hidden=[];
 const stats={revision:ROOM23_MECHANISM_ART_REVISION,closedPanels:2,glassPanes:2,parts:0,batches:0,extraColliders:0,extraFloors:0,extraLights:0,queryGeometryChanges:0,independentClocks:0};
 const unitBounds=new THREE.Box3(V(-.5,-.5,-.5),V(.5,.5,.5));
 function part(owner,kind,position,size,color,rotation=Q()){
  const matrix=new THREE.Matrix4().compose(position,rotation,V(...size));
  const bounds=unitBounds.clone().applyMatrix4(matrix);
  if(!owner.bounds.clone().expandByScalar(.000001).containsBox(bounds))throw new Error('Room23 observation finish escaped its original closed wall');
  const record={owner,kind,matrix,bounds,color};owner.parts.push(record);banks[kind].push(record);stats.parts++;return record;
 }
 for(let i=0;i<PANELS.length;i++){
  const spec=PANELS[i],target=targets[i],p=target?.geometry?.parameters;
  if(!target?.isMesh||target.isInstancedMesh||target.parent!==k.world.root||target.userData.portalable||target.userData.portalTile
   ||!p||V(p.width,p.height,p.depth).distanceTo(V(...spec.size))>.000001||target.position.distanceTo(V(...spec.position))>.000001)
   throw new Error(`Room23 observation wall differs from its authored owner: ${spec.name}`);
  target.geometry.computeBoundingBox();
  const owner={target,name:spec.name,bounds:target.geometry.boundingBox.clone(),parts:[]};mounts.push(owner);
  const original=target.material;
  if(!original?.isMeshStandardMaterial||Array.isArray(original))throw new Error('Room23 observation wall needs its original closed material');
  const replacement=original.clone();replacement.name='Room23 observation glass / unchanged hidden query owner';replacement.visible=false;
  hidden.push({target,original,replacement,keepMaterial:target.userData.keepMaterial,owner:target.userData.room23ObservationOwner});
  target.material=replacement;target.userData.keepMaterial=true;target.userData.room23ObservationOwner=root.uuid;
  // These are ordinary LabTileWorld boxes. Retain compatibility with a kit
  // that batches static render sources without ever batching the hidden owner.
  for(const list of k.artBins?.values?.()||[]){const n=list.indexOf(target);if(n>=0)list.splice(n,1);}
  const s=owner.bounds.getSize(V()),c=owner.bounds.getCenter(V()),axis=s.x<s.z?0:2;
  const normal=axis===0?V(1,0,0):V(0,0,1),right=axis===0?V(0,0,-1):V(1,0,0),up=V(0,1,0);
  const rotation=Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,normal));
  const w=Math.abs(s.dot(right)),h=s.y,d=Math.abs(s.dot(normal)),rim=.24,beam=.12;
  const b=(kind,x,y,z,width,height,depth,color)=>part(owner,kind,c.clone().addScaledVector(right,x).addScaledVector(up,y).addScaledVector(normal,z),[width,height,depth],color,rotation);
  const dark=0x34565a,bronze=0xb58d5e,frost=0xa7c0b4;
  // A complete closed slab fills the framed opening. It is visibly tinted
  // and marked, never a missing wall backed by an invisible solid collider.
  // The visible closed faces stay 2mm inside their actual query planes.
  // A deep decorative recess would make centre contact appear invisible.
  b('glass',0,0,0,w-rim*2,h-rim*2,d-.004,0xffffff);
  for(const side of [-1,1])b('frame',side*(w-rim)/2,0,0,rim,h-.004,d-.004,dark);
  for(const side of [-1,1])b('frame',0,side*(h-rim)/2,0,w-rim*2,rim,d-.004,dark);
  const columns=Math.max(2,Math.ceil(w/5.5)),rows=Math.ceil(h/5);
  for(let n=1;n<columns;n++)b('frame',-w/2+rim+(w-rim*2)*n/columns,0,0,beam,h-rim*2,d*.90,bronze);
  for(let n=1;n<rows;n++)b('frame',0,-h/2+rim+(h-rim*2)*n/rows,0,w-rim*2,beam,d*.90,bronze);
  b('frame',0,-h/2+.43,0,w-rim*2,.62,d*.94,dark);
  // Two narrow ceramic-green safety bands make the closed glazing legible
  // at standing height from either side without imitating portal ceramic.
  for(const y of [1.30,1.51])for(const side of [-1,1])
   b('frame',0,-h/2+y,side*(d/2-.0015),w-rim*2,.055,.001,frost);
  for(let n=0;n<columns;n++)for(const side of [-1,1]){
   const x=-w/2+rim+(w-rim*2)*(n+.5)/columns;
   b('frame',x,-h/2+1.405,side*(d/2-.0015),.16,.16,.001,bronze);
  }
 }
 for(const [kind,entries]of Object.entries(banks)){
  const mesh=new THREE.InstancedMesh(geometry,materials[kind],entries.length);
  mesh.name=`Room23 closed observation / ${kind}`;mesh.userData={visualOnly:true,keepMaterial:true};mesh.castShadow=false;mesh.receiveShadow=true;
  mesh.frustumCulled=false;root.add(mesh);entries.forEach((entry,index)=>{entry.mesh=mesh;entry.index=index;mesh.setColorAt(index,new THREE.Color(entry.color));});
  mesh.instanceColor.needsUpdate=true;stats.batches++;
 }
 const inverse=new THREE.Matrix4(),pose=new THREE.Matrix4(),matrix=new THREE.Matrix4();let disposed=false;
 function sync(){
  if(disposed)return;root.updateWorldMatrix(true,false);inverse.copy(root.matrixWorld).invert();
  for(const owner of mounts){owner.target.updateWorldMatrix(true,false);pose.multiplyMatrices(inverse,owner.target.matrixWorld);
   for(const entry of owner.parts)entry.mesh.setMatrixAt(entry.index,matrix.multiplyMatrices(pose,entry.matrix));}
  for(const entries of Object.values(banks))entries[0].mesh.instanceMatrix.needsUpdate=true;
 }
 function dispose(){
  if(disposed)return;disposed=true;root.removeFromParent();
  for(const record of hidden){
   if(record.target.material===record.replacement)record.target.material=record.original;
   if(record.target.userData.room23ObservationOwner===root.uuid){
    if(record.keepMaterial===undefined)delete record.target.userData.keepMaterial;else record.target.userData.keepMaterial=record.keepMaterial;
    if(record.owner===undefined)delete record.target.userData.room23ObservationOwner;else record.target.userData.room23ObservationOwner=record.owner;
   }
   record.replacement.dispose();
  }
  for(const entries of Object.values(banks))entries[0].mesh.dispose();root.clear();geometry.dispose();for(const material of Object.values(materials))material.dispose();
  if(k.room23MechanismArt===art)delete k.room23MechanismArt;
 }
 root.mounts=mounts;root.userData.stats=stats;root.dispose=dispose;
 root.ownedResources=[geometry,...Object.values(materials),...hidden.map(row=>row.replacement),...Object.values(banks).map(entries=>entries[0].mesh)];
 const art={root,mounts,stats,sync,dispose,get disposed(){return disposed;}};k.room23MechanismArt=art;sync();return art;
}
