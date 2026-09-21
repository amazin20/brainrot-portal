import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

const V=(...a)=>new THREE.Vector3(...a),Q=()=>new THREE.Quaternion();
const styles={garden:[0xd47762,0x245c63,0x5d996e,0x384a45],carnival:[0xd97598,0x315a81,0xe9b95a,0x263e49],lagoon:[0xe89276,0x285f79,0x69bbb0,0x284a51],inversion:[0x9b88bb,0x41547f,0xe1c15d,0x383a51],launch:[0xe99053,0x315e85,0xe6c35d,0x334d56]};
/** Coarse forms, folded edges and a restrained four-material palette. No
 * transparent shells, coplanar decals or unbounded triangle colliders. */
export class SolidAssembly{
 constructor(name,style='garden'){
  this.root=new THREE.Group();this.root.name=name;this.root.userData.keepMaterial=true;
  this.root.userData.solidModel=true;this.root.userData.collisionParts=[];
  this.bins=[[],[],[],[]];
  this.materials=(styles[style]??styles.garden).map((color,i)=>new THREE.MeshStandardMaterial({name:['Enamel','Anodised frame','Accent','Recess'][i],color,roughness:[.47,.52,.56,.86][i],metalness:[.04,.35,.03,.01][i]}));
 }
 add(geometry,material=0,p=[0,0,0],q=Q(),s=[1,1,1],solid=true){
  const matrix=new THREE.Matrix4().compose(V(...p),q,V(...s));
  const g=geometry.index?geometry.toNonIndexed():geometry.clone();geometry.dispose();g.applyMatrix4(matrix);
  for(const key of Object.keys(g.attributes))if(!['position','normal'].includes(key))g.deleteAttribute(key);
  if(!g.attributes.normal)g.computeVertexNormals();this.bins[material].push(g);
  if(solid){g.computeBoundingBox();this.bounds(g.boundingBox);}
  return this;
 }
 bounds(b){this.root.userData.collisionParts.push({min:b.min.toArray(),max:b.max.toArray()});return this;}
 box(p,s,mat=1,bevel=.04,solid=true){return this.add(new RoundedBoxGeometry(...s,2,Math.min(bevel,...s.map(x=>x*.2))),mat,p,Q(),[1,1,1],solid);}
 beam(a,b,r=.12,mat=1){const d=V(...b).sub(V(...a));return this.add(new THREE.CylinderGeometry(r,r,d.length(),12),mat,V(...a).add(V(...b)).multiplyScalar(.5).toArray(),Q().setFromUnitVectors(V(0,1,0),d.normalize()));}
 turned(profile,mat=0,p=[0,0,0],q=Q(),solid=true){return this.add(new THREE.LatheGeometry(profile.map(v=>new THREE.Vector2(...v)),48),mat,p,q,[1,1,1],solid);}
 arc(radius,band,depth,mat=1,p=[0,0,0],q=Q(),start=0,length=Math.PI*2,solid=true){
  const shape=new THREE.Shape(),outer=radius+band/2,inner=radius-band/2;
  const n=Math.max(12,Math.ceil(length*16));
  if(Math.abs(length-Math.PI*2)<1e-9){
   shape.absarc(0,0,outer,0,Math.PI*2,false);
   const hole=new THREE.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);shape.holes.push(hole);
  }else{
   for(let i=0;i<=n;i++){const a=start+length*i/n,x=outer*Math.cos(a),y=outer*Math.sin(a);i?shape.lineTo(x,y):shape.moveTo(x,y);}
   for(let i=n;i>=0;i--){const a=start+length*i/n;shape.lineTo(inner*Math.cos(a),inner*Math.sin(a));}shape.closePath();
  }
  const bevel=Math.min(.035,band*.15,depth*.12),g=new THREE.ExtrudeGeometry(shape,{depth:depth-2*bevel,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,curveSegments:32,steps:1});g.translate(0,0,-depth/2+bevel);
  this.add(g,mat,p,q,[1,1,1],false);
  if(solid){
   // Each short arc is bounded separately. The empty aperture is NEVER a
   // collider. A full torus AABB would seal the flight/puzzle opening.
   const steps=Math.max(2,Math.ceil(length*3)),matrix=new THREE.Matrix4().compose(V(...p),q,V(1,1,1));
   for(let i=0;i<steps;i++){
    const b=new THREE.Box3();for(let j=0;j<=8;j++)for(const r of [inner-bevel,outer+bevel])for(const z of [-depth/2,depth/2]){
     const a=start+length*(i+j/8)/steps;b.expandByPoint(V(Math.cos(a)*r,Math.sin(a)*r,z).applyMatrix4(matrix));
    }this.bounds(b);
   }
  }return this;
 }
 finish(){
  for(let i=0;i<4;i++){
   if(!this.bins[i].length){this.materials[i].dispose();continue;}
   const combined=mergeGeometries(this.bins[i],false),g=mergeVertices(combined,1e-5);combined.dispose();this.bins[i].forEach(g=>g.dispose());
   removeCollapsedFaces(g);
   g.computeBoundingBox();g.computeBoundingSphere();
   const mesh=new THREE.Mesh(g,this.materials[i]);mesh.name=this.root.name+' / '+this.materials[i].name;mesh.castShadow=true;mesh.receiveShadow=true;this.root.add(mesh);
  }
  return this.root;
 }
}

// Lathed pole cells collapse to a point; remove only zero-area triangles,
// retaining all nondegenerate surfaces and the authored split normals.
function removeCollapsedFaces(g){
 const p=g.attributes.position,idx=g.index.array,kept=[],a=V(),b=V(),c=V();
 for(let i=0;i<idx.length;i+=3){a.fromBufferAttribute(p,idx[i]);b.fromBufferAttribute(p,idx[i+1]).sub(a);c.fromBufferAttribute(p,idx[i+2]).sub(a);if(b.cross(c).lengthSq()>1e-18)kept.push(idx[i],idx[i+1],idx[i+2]);}
 g.setIndex(kept);
}

/** Bind the authored compound shape to the game's existing player, Cannon,
 * camera and aim registries. Physics is updated only from fixed-step poses. */
export function bindSolidModel(game,model,{kinematic=false}={}){
 const parts=model.userData.collisionParts;if(!Array.isArray(parts)||!parts.length)throw new Error(`Missing solid envelope: ${model.name}`);
 model.updateWorldMatrix(true,true);let previous=model.matrixWorld.clone();
 const boxes=parts.map(p=>new THREE.Box3(V(...p.min),V(...p.max)));
 const colliders=boxes.map(b=>{
  const c=game.collisionProxy(b.clone().applyMatrix4(model.matrixWorld),{kinematic});
  c.solidModel=model.uuid;c.mesh.name=model.name+' / physical envelope';c.mesh.userData.solidModelOwner=model.uuid;
  return c;
 });
 const sync=(dt=0,force=false)=>{
  model.updateWorldMatrix(true,false);if(!force&&previous.equals(model.matrixWorld))return;
  previous.copy(model.matrixWorld);
  boxes.forEach((b,i)=>game.syncCollision(colliders[i],b.clone().applyMatrix4(model.matrixWorld),dt));
 };
 return {model,colliders,sync};
}
export function placeSolidModel(k,model,p=[0,0,0],{parent=k.world.root,quaternion,scale=1,kinematic=false}={}){
 model.position.fromArray(p);if(quaternion)model.quaternion.copy(quaternion);model.scale.setScalar(scale);parent.add(model);
 const binding=bindSolidModel(k.game,model,{kinematic});
 (k.solidModels??=[]).push(binding);return binding;
}

function buildPlanter(style='garden'){
 const a=new SolidAssembly('Fluted botanical planter',style);
 // A hollow rim, stepped ceramic body, recessed earth and separate leaves.
 a.turned([[0,0],[.65,0],[.76,.09],[.82,.78],[.87,.86],[.87,1.03],[.72,1.03],[.69,.90],[0,.90]],0);
 a.turned([[.81,.77],[.89,.77],[.92,.83],[.92,.91],[.89,.96],[.82,.96],[.81,.77]],1,[0,0,0],Q(),false);
 a.turned([[0,.91],[.70,.91],[.70,.935],[0,.935]],3,[0,0,0],Q(),false);
 for(let n=0;n<8;n++){const t=n*Math.PI/4;a.box([Math.cos(t)*.79,.42,Math.sin(t)*.79],[.055,.52,.055],1,.018,false);}
 a.beam([0,.91,0],[0,1.72,0],.10,1);
 for(let tier=0;tier<3;tier++)for(let i=0;i<7;i++){
  const angle=i*Math.PI*2/7+tier*.65,len=1.40-tier*.2;
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-.18,.2,-.32,len*.65,0,len);shape.bezierCurveTo(.32,len*.65,.18,.2,0,0);
  const g=new THREE.ExtrudeGeometry(shape,{depth:.075,steps:1,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:2,curveSegments:8});g.translate(0,0,-.0375);
  // Broad convex leaf blades: actual volume and smooth controlled highlights.
  const q=Q().setFromEuler(new THREE.Euler(.65-tier*.2,angle,0,'YXZ'));
  a.add(g,2,[Math.sin(angle)*.20,1.34+tier*.37,Math.cos(angle)*.20],q,[1,1,1],false);
 }
 // Foliage envelope follows the crown, rather than an invisible full-height box.
 const crown=new THREE.Box3();for(const leaf of a.bins[2]){leaf.computeBoundingBox();crown.union(leaf.boundingBox);}a.bounds(crown);
 return a.finish();
}

function buildDrive(style='carnival'){
 const a=new SolidAssembly('Finned conveyor gearmotor',style),q=Q().setFromAxisAngle(V(0,0,1),Math.PI/2);
 a.box([0,-.56,0],[1.60,.20,1.26],1,.055);
 a.box([-.35,-.24,0],[.45,.50,.90],1);a.box([.35,-.24,0],[.45,.50,.90],1);
 a.turned([[0,-.65],[.42,-.65],[.56,-.50],[.56,.43],[.49,.57],[0,.57]],0,[0,0,0],q);
 for(let i=0;i<6;i++)a.turned([[.53,-.035],[.63,-.035],[.65,-.012],[.65,.012],[.63,.035],[.53,.035],[.53,-.035]],1,[-.35+i*.12,0,0],q,false);
 a.turned([[0,-.14],[.38,-.14],[.44,-.08],[.44,.08],[.38,.14],[0,.14]],2,[.68,0,0],q);
 a.turned([[0,-.12],[.16,-.12],[.16,.12],[0,.12]],1,[.86,0,0],q);
 a.box([-.10,.54,0],[.56,.22,.45],1);a.box([-.1,.67,0],[.46,.035,.33],2,.015,false);
 for(const x of [-.53,.53])for(const z of [-.44,.44])a.add(new THREE.CylinderGeometry(.07,.07,.035,6),2,[x,-.44,z],Q(),[1,1,1],false);
 return a.finish();
}

function buildCanopy(style='carnival'){
 const a=new SolidAssembly('Ribbed barrel canopy',style);
 for(const x of [-4.15,4.15])for(const z of [-2.6,2.6]){
  a.box([x,-1.17,z],[.28,2.34,.32],1,.045);a.box([x,-2.30,z],[.65,.2,.7],1,.04);
  a.box([x,-.12,z],[.46,.34,.50],2,.06);
 }
 for(const z of [-2.6,2.6])a.arc(4.15,.27,.36,1,[0,0,z],Q(),0,Math.PI);
 for(let i=0;i<9;i++)a.arc(4.15,.13,5.12,i%3===1?2:0,[0,0,0],Q(),i*Math.PI/9+.008,Math.PI/9-.016);
 // Longitudinal structural purlins support, but do not cross, the opening.
 for(const t of [Math.PI/6,Math.PI/2,Math.PI*5/6])a.beam([Math.cos(t)*4.00,Math.sin(t)*4.00,-2.6],[Math.cos(t)*4.00,Math.sin(t)*4.00,2.6],.065,1);
 return a.finish();
}

function buildGuideRing(radius=6,style='launch',band=.26,depth=.40){
 const a=new SolidAssembly('Segmented flight collar',style);
 a.arc(radius,band,depth,0);
 // Inner anodised lip is radially adjacent, not a coincident overlaid torus.
 a.arc(radius-band*.66,band*.26,depth*.65,1,[0,0,0],Q(),0,Math.PI*2,false);
 for(let i=0;i<4;i++){
  const t=i*Math.PI/2,r=radius+band*.15,q=Q().setFromAxisAngle(V(0,0,1),t);
  a.add(new RoundedBoxGeometry(band*1.55,.55,depth*1.3,2,.045),2,[Math.cos(t)*r,Math.sin(t)*r,0],q,[1,1,1],true);
 }
 return a.finish();
}

function buildCrystal(style='inversion'){
 const a=new SolidAssembly('Suspended field resonator',style);
 a.turned([[0,0],[.67,0],[.80,.12],[.80,.28],[.65,.42],[.52,.42],[.52,.48],[0,.48]],1);
 a.turned([[0,.48],[.28,.60],[.55,1.40],[.38,2.45],[0,3.10]],2);
 for(let i=0;i<3;i++){const t=i*Math.PI*2/3,x=Math.cos(t)*.61,z=Math.sin(t)*.61;a.beam([x,.3,z],[x,2.2,z],.065,0);a.beam([x,2.2,z],[x*.45,2.55,z*.45],.065,0);}
 for(const y of [.52,1.42])a.arc(.64,.10,.12,0,[0,y,0],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),0,Math.PI*2,false);
 a.bounds(new THREE.Box3(V(-.71,.42,-.71),V(.71,2.2,.71)));
 return a.finish();
}

function buildPontoon(width,depth,style='lagoon'){
 const a=new SolidAssembly('Sealed tidal pontoon',style);
 a.box([0,-.38,0],[width-.08,.60,depth-.08],0,.12);
 for(const x of [-1,1])a.box([x*(width/2-.25),-.40,0],[.32,.43,depth-.24],1,.075,false);
 for(const z of [-1,1])a.box([0,-.40,z*(depth/2-.20)],[width-.30,.38,.23],1,.055,false);
 for(const x of [-1,1])for(const z of [-1,1])a.box([x*(width/2-.32),-.32,z*(depth/2-.32)],[.5,.33,.5],2,.08,false);
 return a.finish();
}

function buildSolarObservatory(){
 const a=new SolidAssembly('Solar observatory crown','launch');
 a.turned([[0,-5.6],[2.4,-5.6],[3,-5],[2.4,-4.4],[1.9,-4.4],[1.9,-1.1],[3.7,-.7],[4,-.1],[4,.4],[3.7,.8],[0,.8]],1);
 // The original hub envelope remains unchanged; a stepped receiver replaces
 // the undifferentiated cap. Each collar and lens is a closed solid volume.
 a.bounds(new THREE.Box3(V(-3.8,.8,-3.8),V(3.8,2.2,3.8)));
 a.turned([[0,.80],[3.65,.80],[3.8,1],[3.70,1.25],[3.1,1.35],[0,1.35]],2,[0,0,0],Q(),false);
 a.turned([[0,1.34],[2.90,1.34],[3.02,1.43],[3.02,1.65],[2.85,1.73],[0,1.73]],1,[0,0,0],Q(),false);
 a.turned([[0,1.74],[2.58,1.74],[2.70,1.84],[2.62,2.04],[1.6,2.16],[0,2.20]],2,[0,0,0],Q(),false);
 for(let i=0;i<12;i++){
  const t=i*Math.PI/6;
  a.add(new THREE.CylinderGeometry(.115,.115,.10,6),1,[Math.cos(t)*3.35,1.35,Math.sin(t)*3.35],Q(),[1,1,1],false);
 }
 for(let i=0;i<8;i++){
  const t=i*Math.PI/4,q=Q().setFromAxisAngle(V(0,1,0),-t);
  const outline=new THREE.Shape();outline.moveTo(2.9,-.65);outline.lineTo(4.3,-1.0);outline.bezierCurveTo(7.5,-1.55,10.9,-1.2,12,-.25);outline.lineTo(11.4,.70);outline.bezierCurveTo(8.3,1.4,5,1.35,3,.60);outline.closePath();
  const options={depth:.38,steps:1,bevelEnabled:true,bevelSize:.08,bevelThickness:.06,bevelSegments:2,curveSegments:10};
  // Retain the exact old closed-fin envelope, independent of its finish.
  const envelope=new THREE.ExtrudeGeometry(outline,options);envelope.rotateX(-Math.PI/2);envelope.applyQuaternion(q);envelope.computeBoundingBox();a.bounds(envelope.boundingBox);envelope.dispose();
  const fieldPoints=outline.getPoints(10).map(p=>new THREE.Vector2(7.4+(p.x-7.4)*.79,p.y*.64));
  const field=new THREE.Shape(fieldPoints),opening=new THREE.Path(fieldPoints.slice().reverse());opening.closePath();outline.holes.push(opening);
  const frame=new THREE.ExtrudeGeometry(outline,options);frame.rotateX(-Math.PI/2);a.add(frame,0,[0,0,0],q,[1,1,1],false);
  // The collector top is recessed 15 cm below the frame lip, not painted on
  // another full face. This removes the coincident-skin failure mode entirely.
  const plate=new THREE.ExtrudeGeometry(field,{...options,depth:.18,bevelSize:.02,bevelThickness:.02,bevelSegments:1});plate.rotateX(-Math.PI/2);a.add(plate,1,[0,.05,0],q,[1,1,1],false);
  for(const x of [5.25,6.7,8.15,9.6]){
   const p=V(x,.285,0).applyQuaternion(q);
   a.add(new THREE.BoxGeometry(.052,.07,1.08),2,p.toArray(),q,[1,1,1],false);
  }
  const hinge=V(3.65,.37,0).applyQuaternion(q);
  a.add(new RoundedBoxGeometry(.62,.35,1.05,2,.06),1,hinge.toArray(),q,[1,1,1],false);
  for(const z of [-.35,.35])a.add(new THREE.CylinderGeometry(.095,.095,.06,6),2,V(3.65,.57,z).applyQuaternion(q).toArray(),Q(),[1,1,1],false);
  a.beam([Math.cos(t)*2.1,-2.2,Math.sin(t)*2.1],[Math.cos(t)*8.2,-.30,Math.sin(t)*8.2],.18,1);
 }
 a.arc(13.4,.40,.48,1,[0,-.25,0],Q().setFromAxisAngle(V(1,0,0),Math.PI/2));
 return a.finish();
}

const templates=new Map();
function cachedModel(key,make){if(!templates.has(key))templates.set(key,make());return templates.get(key).clone(true);}
export const createPlanter=(style='garden')=>cachedModel('planter:'+style,()=>buildPlanter(style));
export const createDrive=(style='carnival')=>cachedModel('drive:'+style,()=>buildDrive(style));
export const createCanopy=(style='carnival')=>cachedModel('canopy:'+style,()=>buildCanopy(style));
export const createGuideRing=(radius=6,style='launch',band=.26,depth=.40)=>cachedModel(`ring:${radius}:${style}:${band}:${depth}`,()=>buildGuideRing(radius,style,band,depth));
export const createCrystal=(style='inversion')=>cachedModel('crystal:'+style,()=>buildCrystal(style));
export const createPontoon=(width,depth,style='lagoon')=>cachedModel(`pontoon:${width}:${depth}:${style}`,()=>buildPontoon(width,depth,style));
export const createSolarObservatory=()=>cachedModel('solar',()=>buildSolarObservatory());
