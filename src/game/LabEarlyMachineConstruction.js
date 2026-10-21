import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const V=(...p)=>new THREE.Vector3(...p);
const C={frame:0x365564,core:0x243c48,enamel:0xb9c8c6,service:0x759aa6,metal:0x9eafb0,copper:0xbe8e5c};

function boxPiece(parts,p,size,color){
 const g=new THREE.BoxGeometry(...size).toNonIndexed();g.translate(...p);
 const c=new THREE.Color(color),a=new Float32Array(g.attributes.position.count*3);
 for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}
 g.setAttribute('color',new THREE.BufferAttribute(a,3));parts.push(g);
}
function merge(parts,name,parameters){
 const g=mergeGeometries(parts);for(const p of parts)p.dispose();
 g.name=name;g.parameters=parameters;g.computeBoundingBox();g.computeBoundingSphere();return g;
}

function coloredShell(vertices,faces,name,parameters){
 const positions=[],colors=[];
 for(const [indices,color]of faces){
  const c=new THREE.Color(color);
  for(let i=1;i<indices.length-1;i++){
   const a=V(...vertices[indices[0]]),b=V(...vertices[indices[i]]),d=V(...vertices[indices[i+1]]);
   if(b.sub(a).cross(d.sub(a)).lengthSq()<1e-20)continue;
   for(const j of [0,i,i+1]){positions.push(...vertices[indices[j]]);colors.push(c.r,c.g,c.b);}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 g.computeVertexNormals();g.name=name;g.parameters=parameters;g.computeBoundingBox();g.computeBoundingSphere();return g;
}

/** A closed, faceted load pier, rather than an open web viewed edge-on. The
 * socket and foot reach the old box planes; its waist remains inside them.
 * Connected shell faces share edges, without stacked coplanar cover boxes. */
export function earlyFoundedPierGeometry(width,height,depth){
 const vertices=[],faces=[],profile=[[-.5,1],[-.5+Math.min(.075,.3/height),1],[-.5+Math.min(.10,.4/height),.88],[.5-Math.min(.12,.5/height),.88],[.5-Math.min(.075,.3/height),1],[.5,1]];
 const ring=[[-.36,-.5],[.36,-.5],[.5,-.36],[.5,.36],[.36,.5],[-.36,.5],[-.5,.36],[-.5,-.36]];
 for(const [y,s]of profile)for(const [x,z]of ring)vertices.push([x*width*s,y*height,z*depth*s]);
 faces.push([[7,6,5,4,3,2,1,0],C.frame]);
 for(let j=0;j<profile.length-1;j++)for(let i=0;i<8;i++){
  const k=(i+1)%8;
  faces.push([[j*8+i,j*8+k,(j+1)*8+k,(j+1)*8+i],j===0||j===4?C.frame:i%2?C.metal:C.enamel]);
 }
 faces.push([[40,41,42,43,44,45,46,47],C.metal]);
 return coloredShell(vertices,faces.map(([indices,color])=>[indices.slice().reverse(),color]),'Founded load pier / closed octagonal body and integral end sockets',{width,height,depth});
}

export function earlyEmitterBarrelGeometry(radius,height){
 const profile=[[-.5,.78],[-.40,1],[-.29,1],[-.23,.86],[.23,.86],[.29,1],[.41,1],[.5,.78]],vertices=[],faces=[];
 for(const [y,r]of profile)for(let i=0;i<8;i++){const t=i*Math.PI/4;vertices.push([Math.sin(t)*radius*r,y*height,Math.cos(t)*radius*r]);}
 faces.push([[7,6,5,4,3,2,1,0],C.frame]);
 for(let j=0;j<profile.length-1;j++)for(let i=0;i<8;i++){const k=(i+1)%8;faces.push([[j*8+i,j*8+k,(j+1)*8+k,(j+1)*8+i],j===0||j===6?C.metal:j===1||j===5?C.frame:j===2||j===4?C.copper:C.service]);}
 faces.push([[56,57,58,59,60,61,62,63],C.metal]);
 return coloredShell(vertices,faces,'Projector source / faceted barrel, cast collars and tapered end housings',{radiusTop:radius,radiusBottom:radius,height});
}

/** Unit light volume: a flat full-width walking roof, luminous edge fields,
 * and a genuinely bevelled underside. Axis changes follow the source box;
 * every face stays inside the same 14 cm physical ribbon. */
export function projectedWalkwayGeometry(lengthAxis=0,normalAxis=1){
 if(![0,1,2].includes(lengthAxis)||![0,1,2].includes(normalAxis)||lengthAxis===normalAxis)throw new RangeError('Distinct cardinal length and normal axes required');
 const acrossAxis=[0,1,2].find(a=>a!==lengthAxis&&a!==normalAxis),vertices=[],faces=[];
 const ring=[[-.5,.5],[-.46,.5],[-.42,.5],[.42,.5],[.46,.5],[.5,.5],[.5,-.08],[.44,-.5],[-.44,-.5],[-.5,-.08]];
 for(const l of [-.5,.5])for(const [a,n]of ring){const p=[0,0,0];p[lengthAxis]=l;p[normalAxis]=n;p[acrossAxis]=a;vertices.push(p);}
 // Build each surface once. Top pigment is part of the load roof, with no
 // second coplanar decal or animated line floating above the traveller.
 const shades=[0x178ba5,0xa4f8f4,0x128ca6,0xa4f8f4,0x178ba5,0x4ac9d5,0x1b718a,0x0c526e,0x1b718a,0x4ac9d5];
 for(let i=0;i<10;i++){const k=(i+1)%10;faces.push([[i,k,k+10,i+10],shades[i]]);}
 faces.push([[9,8,7,6,5,4,3,2,1,0],0x2ab6cd]);faces.push([[10,11,12,13,14,15,16,17,18,19],0x2ab6cd]);
 const g=coloredShell(vertices,faces,'Projected load ribbon / integral edge fields and faceted solid underside',{width:1,height:1,depth:1});
 // Axis permutations can reverse the handedness of this closed shell.
 const p=g.attributes.position,n=g.attributes.normal,center=V(),normal=V();let outward=0;
 for(let i=0;i<p.count;i+=3){center.fromBufferAttribute(p,i).add(V().fromBufferAttribute(p,i+1)).add(V().fromBufferAttribute(p,i+2)).multiplyScalar(1/3);normal.fromBufferAttribute(n,i);outward+=center.dot(normal);}
 if(outward<0){for(const attribute of Object.values(g.attributes))for(let i=0;i<attribute.count;i+=3)for(let c=0;c<attribute.itemSize;c++){const a=attribute.array[i*attribute.itemSize+c];attribute.array[i*attribute.itemSize+c]=attribute.array[(i+2)*attribute.itemSize+c];attribute.array[(i+2)*attribute.itemSize+c]=a;}g.computeVertexNormals();}
 g.userData={lengthAxis,normalAxis};return g;
}

function diagonalPiece(parts,from,to,width,depth,color,axis=2){
 const a=new THREE.Vector2(...from),b=new THREE.Vector2(...to),d=b.clone().sub(a),mid=a.add(b).multiplyScalar(.5);
 const g=new THREE.BoxGeometry(d.length(),width,depth).toNonIndexed();g.rotateZ(Math.atan2(d.y,d.x));g.translate(mid.x,mid.y,0);
 if(axis===0)g.rotateY(Math.PI/2);
 const c=new THREE.Color(color),col=new Float32Array(g.attributes.position.count*3);
 for(let i=0;i<col.length;i+=3)col.set([c.r,c.g,c.b],i);
 g.setAttribute('color',new THREE.BufferAttribute(col,3));parts.push(g);return g;
}

/** Full-size box-girder fascia on the source chassis. Recessed diagonal webs
 * are part of the closed side, not extra braces in a walking or fall path.
 * The top/bottom plates and four end posts retain every authored extremum. */
export function earlyBoxGirderGeometry(width,height,depth){
 if(![width,height,depth].every(n=>Number.isFinite(n)&&n>0))throw new RangeError('Positive box-girder dimensions required');
 const parts=[],flange=Math.min(.16,height*.19),well=Math.min(.12,width*.025,depth*.025),webH=height-2*flange;
 boxPiece(parts,[0,(height-flange)/2,0],[width,flange,depth],C.metal);
 boxPiece(parts,[0,-(height-flange)/2,0],[width,flange,depth],C.frame);
 boxPiece(parts,[0,0,0],[width-2*well,webH,depth-2*well],C.core);
 // Each corner is one closed post. Per-face end posts used to overlap here
 // and submit duplicate exterior triangles on the same load-bearing plane.
 for(const x of [-1,1])for(const z of [-1,1])boxPiece(parts,[x*(width-well)/2,0,z*(depth-well)/2],[well,webH,well],C.frame);
 for(const axis of [0,2]){
  const span=axis===2?width:depth,thickness=axis===2?depth:width,bays=Math.max(1,Math.min(10,Math.ceil(span/3.8))),bay=span/bays;
  for(const sign of [-1,1]){
   const n=sign*(thickness/2-well*.43),add=(x,y,w,h,d,col)=>boxPiece(parts,axis===2?[x,y,n]:[n,y,x],axis===2?[w,h,d]:[d,h,w],col);
   const post=Math.min(.13,bay*.045);
   for(let i=1;i<bays;i++)add(-span/2+i*bay,0,post,webH,well*.8,C.service);
   for(let i=0;i<bays;i++){
    const margin=Math.min(.18,bay*.14),lo=-span/2+i*bay+margin,hi=lo+bay-2*margin;
    const rib=diagonalPiece(parts,[lo,-webH*.33],[hi,webH*.33],Math.min(.095,webH*.13),well*.66,i%3===0?C.copper:C.service,axis);
    rib.translate(axis===2?0:n,0,axis===2?n:0);
   }
  }
 }
 return merge(parts,'Integral platform box girder / closed diagonal web and load flanges',{width,height,depth});
}

/** Folded skins on a real thin partition: a broad dark sill, unequal service
 * bays and a diagonal load return stop it reading as an untextured cardboard
 * sheet. Every skin is contained by the original physical rectangle. */
export function earlyPartitionGeometry(width,height,depth){
 if(![width,height,depth].every(n=>Number.isFinite(n)&&n>0))throw new RangeError('Positive partition dimensions required');
 const axis=width<depth?0:2,span=axis===2?width:depth,thick=axis===2?depth:width;
 const parts=[],rim=Math.min(.18,span*.07,height*.07),well=Math.min(.07,thick*.22);
 const add=(u,y,n,w,h,d,col)=>boxPiece(parts,axis===2?[u,y,n]:[n,y,u],axis===2?[w,h,d]:[d,h,w],col);
 // Single non-overlapping perimeter: the dark core stops short of every
 // external edge instead of sharing its side planes with the rim.
 add(0,0,0,span-2*rim,height-2*rim,thick*.64,C.core);
 for(const s of [-1,1])add(s*(span-rim)/2,0,0,rim,height,thick,C.frame);
 for(const s of [-1,1])add(0,s*(height-rim)/2,0,span-2*rim,rim,thick,C.metal);
 for(const sign of [-1,1]){
  const n=sign*(thick/2-well/2);
  const bays=Math.max(1,Math.min(4,Math.round(span/4.5))),bay=(span-2*rim)/bays;
  for(let i=0;i<bays;i++){
   const center=-span/2+rim+(i+.5)*bay;
   add(center,0,sign*(thick/2-well*.83),bay-.055,height-2*rim,well*.24,i%2?C.service:C.enamel);
   add(center,-height*.19,n,bay-.055,Math.min(.2,height*.06),well*.75,C.frame);
   if(height>3&&bay>1.8){
    const dh=Math.min(height*.23,2.4),dw=bay*.72;
    const rib=diagonalPiece(parts,[center-dw/2,-dh/2],[center+dw/2,dh/2],Math.min(.13,height*.025),well*.65,C.copper,axis);
    rib.translate(axis===2?0:n,0,axis===2?n:0);
   }
  }
 }
 return merge(parts,'Folded working partition / closed fields, load returns and integral frame',{width,height,depth});
}

/** Broad structural masses become closed service enclosures, rather than a
 * repeated cupboard texture. Four fabricated vertical faces share a solid
 * core. The walking top and all outer frame planes retain the original box.
 * Shallow returns are too small to admit either traveller into the recess. */
export function serviceMassGeometry(width,height,depth){
 if(![width,height,depth].every(n=>Number.isFinite(n)&&n>.6))throw new RangeError('A substantial closed chassis is required');
 const parts=[],well=Math.min(.18,Math.min(width,depth)*.08),rim=Math.min(.42,width*.06,depth*.06,height*.07);
 boxPiece(parts,[0,0,0],[width-2*well,height-2*rim,depth-2*well],C.core);
 // One continuous roof remains at exactly the authored floor/contact plane.
 boxPiece(parts,[0,(height-rim)/2,0],[width,rim,depth],C.enamel);
 boxPiece(parts,[0,-(height-rim)/2,0],[width,rim,depth],C.frame);
 // One shared corner post owns the two adjacent exterior sides. The former
 // two independent face posts overlapped on both visible corner planes.
 for(const x of [-1,1])for(const z of [-1,1])boxPiece(parts,[x*(width-well)/2,0,z*(depth-well)/2],[well,height-2*rim,well],C.frame);
 const face=(axis,sign)=>{
  const span=axis===2?width:depth,thick=axis===2?depth:width;
  const add=(u,y,n,w,h,d,color)=>boxPiece(parts,axis===2?[u,y,sign*n]:[sign*n,y,u],axis===2?[w,h,d]:[d,h,w],color);
  const outer=thick/2,bodyHeight=height-2*rim;
  const edge=Math.max(rim,well);
  if(edge>well+1e-7)for(const s of [-1,1])add(s*(span-edge-well)/2,0,outer-well/2,edge-well,bodyHeight,well,C.frame);
  // An offset service spine divides the body into a large removable process
  // cover and a narrow mechanical bay. They have different actual depths.
  const usable=span-2*edge,spine=-usable*.22,rail=Math.min(.28,usable*.055);
  add(spine,0,outer-well/2,rail,bodyHeight,well,C.metal);
  const fields=[[-usable/2,spine-rail/2,C.service,.78],[spine+rail/2,usable/2,C.enamel,.42]];
  for(const [lo,hi,color,recess]of fields){
   const w=hi-lo-.045;if(w<=.04)continue;
   const n=outer-well*recess-.025;
   add((lo+hi)/2,0,n,w,bodyHeight,.045,color);
   // A broad plinth, a waist rail and an upper removable service cassette
   // replace the previous equal grid of tiny doors and repeated louvres.
   const band=Math.min(.30,bodyHeight*.075),waist=-bodyHeight*.14;
   add((lo+hi)/2,waist,outer-well*.25,w,band,well*.34,C.frame);
   if(w>1.3&&bodyHeight>2){
    const ventW=Math.min(w*.72,8.8),ventH=Math.min(bodyHeight*.23,3.0),vy=bodyHeight*.25;
    add((lo+hi)/2,vy,outer-well*.61,ventW,ventH,.035,C.core);
    for(let i=0;i<4;i++)add((lo+hi)/2,vy+ventH*(i-1.5)/4,outer-well*.40,ventW-.04,Math.min(.095,ventH*.12),.055,C.metal);
   }
   if(w>3&&bodyHeight>3){
    // A single broad diagonal return carries the lower cover into the actual
    // spine. It remains recessed, with no extra volume beside the machine.
    const h=Math.min(bodyHeight*.35,5.2),center=(lo+hi)/2;
    const rib=diagonalPiece(parts,[center-w*.34,-h*.55],[center+w*.34,h*.38],Math.min(.22,h*.065),well*.30,C.service,axis);
    // The diagonal passes behind the waist rail; their exposed fronts must
    // not occupy the same plane at their visible crossing.
    rib.translate(axis===2?0:sign*(outer-well*.30),-bodyHeight*.22,axis===2?sign*(outer-well*.30):0);
   }
  }
 };
 for(const axis of [0,2])for(const sign of [-1,1])face(axis,sign);
 return merge(parts,'Fabricated process enclosure / continuous frame, offset spine and recessed service bays',{width,height,depth});
}

/** A tread has an integral central pan and two continuous inclined edge
 * channels. Their slope follows the next tread; every vertex stays in this
 * tread's original solid casing, including both extreme contact planes. */
export function treadChassisGeometry(width,height,depth,rise){
 const parts=[],edge=Math.min(.24,width*.085),beam=Math.max(.055,height-Math.abs(rise)-.025);
 if(beam<=0||Math.abs(rise)>=height)throw new RangeError('The inclined channel must fit in the original tread casing');
 boxPiece(parts,[0,0,0],[width-2*edge,height,depth],C.core);
 for(const s of [-1,1]){
  const g=new THREE.BoxGeometry(edge,beam,depth).toNonIndexed(),p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+rise*p.getZ(i)/depth);
  g.translate(s*(width-edge)/2,0,0);
  const c=new THREE.Color(C.frame),a=new Float32Array(p.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}
  g.setAttribute('color',new THREE.BufferAttribute(a,3));g.computeVertexNormals();parts.push(g);
 }
 return merge(parts,'Folded stair / closed pan with continuous inclined side channels',{width,height,depth});
}

function foundedStairGeometry(width,height,depth,rise,substantial=false){
 const parts=[],edge=substantial?Math.min(.50,width*.16):Math.min(.28,width*.09),top=height/2;
 boxPiece(parts,[0,0,0],[width-2*edge,height,depth],substantial?C.service:C.core);
 for(const s of [-1,1]){
  // A closed triangular side cheek carries all treads. Its sloping top is
  // recessed into the old stepped foundation; the bottom remains founded.
  const front=Math.max(-height/2+.015,top-Math.abs(rise)-.025),back=top-.025;
  const shape=new THREE.Shape([new THREE.Vector2(-depth/2,-height/2),new THREE.Vector2(depth/2,-height/2),
   new THREE.Vector2(depth/2,front),new THREE.Vector2(-depth/2,back)]);
  const g=new THREE.ExtrudeGeometry(shape,{depth:edge,bevelEnabled:false,steps:1,curveSegments:1});
  // Shape X is the stair's depth, extrusion is its narrow width.
  g.rotateY(-Math.PI/2);g.translate(s<0?-width/2+edge:width/2,0,0);
  const c=new THREE.Color(substantial?C.enamel:C.frame),a=new Float32Array(g.attributes.position.count*3);
  for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(a,3));
  // mergeGeometries expects the same non-indexed position/normal/uv streams.
  parts.push(g.index?g.toNonIndexed():g);
 }
 return merge(parts,'Founded stair / continuous load cheeks and solid central plinth',{width,height,depth});
}

function shieldBackGeometry(width,height,depth){
 const p=[],edge=.23;
 boxPiece(p,[0,0,0],[width,height,depth*.40],C.core);
 for(const z of [-1,1]){
  const at=z*depth*.35;
  for(const s of [-1,1])boxPiece(p,[s*(width-edge)/2,0,at],[edge,height,depth*.30],C.frame);
  for(const s of [-1,1])boxPiece(p,[0,s*(height-edge)/2,at],[width-2*edge,edge,depth*.30],C.metal);
  boxPiece(p,[0,0,z*depth*.29],[width-2*edge,height-2*edge,depth*.16],C.service);
  boxPiece(p,[-width*.19,0,z*depth*.42],[.18,height-2*edge,depth*.16],C.metal);
  boxPiece(p,[width*.17,-height*.13,z*depth*.42],[width*.46,.16,depth*.16],C.copper);
 }
 return merge(p,'Optical shield / closed folded rear chassis and integral service returns',{width,height,depth});
}

function busGeometry(width,height,depth){
 const size=[width,height,depth],axis=size.indexOf(Math.max(...size)),parts=[],cross=[0,1,2].filter(a=>a!==axis);
 const s=size.slice();s[cross[0]]*=.72;s[cross[1]]*=.72;boxPiece(parts,[0,0,0],s,C.core);
 for(const a of cross)for(const sign of [-1,1]){
  const p=[0,0,0],span=size.slice(),edge=size[a]*.14;p[a]=sign*(size[a]-edge)/2;span[a]=edge;
  if(a===cross[1])span[cross[0]]*=.72;
  boxPiece(parts,p,span,a===cross[0]?C.service:C.metal);
 }
 return merge(parts,'Closed utility bus / folded cover and load-bearing returns',{width,height,depth});
}

function mountTo(owner,target,name){
 const mount=new THREE.Group();mount.name=name;mount.matrixAutoUpdate=false;owner.renderRoot.add(mount);
 owner.followers.push({target,mount});return mount;
}
function machineSkid(owner,target,material){
 target.updateWorldMatrix(true,true);const inverse=target.matrixWorld.clone().invert(),bounds=new THREE.Box3();
 target.traverse(n=>{if(!n.isMesh)return;n.geometry.computeBoundingBox();bounds.union(n.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(n.matrixWorld)));});
 const s=bounds.getSize(V()),c=bounds.getCenter(V()),h=s.y*.065,parts=[];
 // These load shoes occupy the existing machine's solid collision envelope.
 // The front bumper and corner returns are broad enough to read beyond the
 // model's two separate feet; no imported rotor/housing is hidden or moved.
 const bar=Math.min(s.x,s.z)*.11;
 for(const side of [-1,1])boxPiece(parts,[c.x+side*(s.x-bar)/2,bounds.min.y+h/2,c.z],[bar,h,s.z],C.frame);
 for(const side of [-1,1])boxPiece(parts,[c.x,bounds.min.y+h/2,c.z+side*(s.z-bar)/2],[s.x-2*bar,h,bar],C.frame);
 const g=merge(parts,'Machine skid / continuous founded outer load frame',{}),mesh=new THREE.Mesh(g,material());
 owner.geometry.push(g);mountTo(owner,target,'Machine skid / actual source pose').add(mesh);
 owner.stats.machineSkids++;
}

const MASSES={
 11:[[-12.5,3.3,-11.25,11,6.6,7.5],[16.5,13,1,3,26,32],[9.15,13,-12.5,11.7,26,5],[-2.5,7.5,2.5,5,15,7]],
 12:[[4,2,0,18,12,11],[-18.8,3,0,2.4,6,24],[16,11,-5,2,22,8]],
 13:[[16,12.5,-11,8,25,34],[-6,12.5,-21,12,25,14],[3.5,6.6,-25.75,7,13.2,3.5]],
 14:[[11,6,2,20,12,12],[-14.5,1,-10,9,2,6],[-14.5,5.575,-10.5,9,4.05,5],[1,8.5,-10,5,17,10]],
 15:[[-17.5,2.8,0,7,5.6,6],[18,6.6,-3,6,13.2,20],[-16,6.6,-10,8,13.2,6],[12.35,22.5,-10,18.7,9,6.9]],
};

function retireCoat(level,target,owner){
 for(const old of level.secondChapterArt?.mounts??[])if(old.target===target){
  for(const part of old.parts){
   owner.retiredCoat.push({part,matrix:part.matrix.clone()});part.matrix.makeScale(0,0,0);
   part.mesh.setMatrixAt(part.index,part.matrix);part.mesh.instanceMatrix.needsUpdate=true;
  }
 }
}

export function finishEarlyMachineConstruction(level,index,owner,replace,material){
 owner.retiredCoat??=[];owner.stats.serviceEnclosures=0;owner.stats.stairPans=0;owner.stats.integralGalleryGirders=0;owner.stats.machineSkids=0;owner.stats.bearingBlocks=0;owner.stats.opticalHousings=0;owner.stats.utilityBusBodies=0;owner.stats.workingPartitions=0;owner.stats.legibleCableBranches=0;
 const meshes=[];level.world.root.updateWorldMatrix(true,true);level.world.root.traverse(n=>{if(n.isMesh&&!n.isInstancedMesh&&!n.userData.collisionProxy)meshes.push(n);});
 for(const row of MASSES[index]??[]){
  const [x,y,z,w,h,d]=row,target=meshes.find(n=>{
   const p=n.geometry?.parameters;return p&&Math.abs(p.width-w)<.015&&Math.abs(p.height-h)<.015&&Math.abs(p.depth-d)<.015&&n.getWorldPosition(V()).distanceTo(V(x,y,z))<.035;
  });
  if(!target)throw new Error(`Missing room ${index+1} process mass at ${x},${y},${z}`);
  retireCoat(level,target,owner);replace(owner,target,serviceMassGeometry(w,h,d),material());owner.stats.serviceEnclosures++;
 }
 for(const mesh of meshes){
  const stair=mesh.userData.earlyAuditStair;if(!stair)continue;
  const p=mesh.geometry.parameters;retireCoat(level,mesh,owner);
  const g=stair.foundation?foundedStairGeometry(p.width,p.height,p.depth,stair.rise,index===6):treadChassisGeometry(p.width,p.height,p.depth,stair.rise);
  replace(owner,mesh,g,material());owner.stats.stairPans++;
 }
 // Only individually authored internal solids are selected. World tile
 // groups, porcelain masters, transparent screens and source GLB nodes stay
 // outside this pass. Their broad faces need a designed housing at gameplay
 // scale, rather than the tiny trim of the previous audit.
 const surfaceGroups=new Set((level.world.surfaces??[]).map(s=>s.group));
 for(const mesh of meshes){
  const p=mesh.geometry?.parameters;
  if(!p||![p.width,p.height,p.depth].every(Number.isFinite)||mesh.userData.visualAuditEarly||mesh.userData.firstChapterStructuralRole||mesh.material?.transparent||Array.isArray(mesh.material))continue;
  if(p.height<.9||Math.min(p.width,p.depth)>.7||Math.max(p.width,p.depth)<2.4)continue;
  let skip=false;for(let n=mesh;n&&n!==level.world.root;n=n.parent)if(surfaceGroups.has(n)||n.userData?.assetId||n.name==='Frame'||n.name==='Moving'){skip=true;break;}
  if(skip)continue;
  retireCoat(level,mesh,owner);replace(owner,mesh,earlyPartitionGeometry(p.width,p.height,p.depth),material());owner.stats.workingPartitions++;
 }
 if(index===5){
  const back=level.panels['light-outlet'].backing,p=back.geometry.parameters;
  replace(owner,back,shieldBackGeometry(p.width,p.height,p.depth),material());owner.stats.opticalHousings++;
  const emitter=level.mechanismArt.earlyOptics.emitter.group,mount=mountTo(owner,emitter,'Optical emitter / closed barrel at real source');
  const profile=[[.64,-.325],[.64,-.12],[.56,-.025],[.47,-.025],[.47,-.25],[.64,-.325]].map(p=>new THREE.Vector2(...p));
  const g=new THREE.LatheGeometry(profile,32);g.rotateX(Math.PI/2);owner.geometry.push(g);
  const m=new THREE.MeshStandardMaterial({color:C.frame,metalness:.62,roughness:.38});owner.materials.push(m);
  mount.add(new THREE.Mesh(g,m));owner.stats.opticalHousings++;
 }
 if(index===6){
  level.state.rig.fixed.traverse(mesh=>{
   if(!mesh.isMesh||mesh.name!=='Stationary bearing housing')return;
   const p=mesh.geometry.parameters,r=p.radiusTop;
   const g=new THREE.BoxGeometry(2*r,p.height,2*r);
   const m=new THREE.MeshStandardMaterial({color:C.service,roughness:.4,metalness:.65});owner.materials.push(m);
   replace(owner,mesh,g,m);owner.stats.bearingBlocks++;
  });
 }
 if(index===7)machineSkid(owner,level.state.sourceFan.art,material);
 if(index===10){machineSkid(owner,level.state.blower.art.art,material);machineSkid(owner,level.state.flywheel.art.art,material);}
 for(const mesh of meshes)if(mesh.userData.earlyAuditMachineHousing){
  const p=mesh.geometry.parameters;replace(owner,mesh,serviceMassGeometry(p.width,p.height,p.depth),material());owner.stats.serviceEnclosures++;
 }
 for(const mesh of meshes)if(mesh.userData.earlyAuditBus){
  const p=mesh.geometry.parameters;replace(owner,mesh,busGeometry(p.width,p.height,p.depth),material());owner.stats.utilityBusBodies++;
 }
 if(index===7){
  // The former thin rectangular beams become actual folded girders; the
  // original physical extents and every guard/landing plane stay unchanged.
  for(const mesh of level.mechanismArt?.airGalleryStructure??[]){
   const p=mesh.geometry.parameters;
   if(!/girder|solid .*guard/.test(mesh.name))continue;
   let g;
   if(p.width>.6&&p.depth>.6)continue;
   const long=p.width>p.depth;
   // Recesses on both broad faces expose a continuous load-bearing web.
   const a=long?p.width:p.depth,b=p.height,c=long?p.depth:p.width;
   const parts=[],flange=Math.min(b*.24,.10),web=c*.34;
   boxPiece(parts,[0,0,0],[a,b,web],C.service);
   for(const s of [-1,1])boxPiece(parts,[0,s*(b-flange)/2,0],[a,flange,c],C.frame);
   g=merge(parts,'Receiving gallery / folded girder and structural guard',{width:a,height:b,depth:c});
   if(!long)g.rotateY(Math.PI/2);g.parameters={width:p.width,height:p.height,depth:p.depth};
   replace(owner,mesh,g,material());owner.stats.integralGalleryGirders++;
  }
 }
 if(index===16){
  const beam=meshes.find(m=>m.name==='Continuously cable-supported walking floor');
  if(beam){
   beam.geometry.computeBoundingBox();const size=beam.geometry.boundingBox.getSize(V()),center=beam.geometry.boundingBox.getCenter(V());
   // Physics samples separate oriented pieces; this original aim mesh stays
   // intact, while its sibling girder follows the same physical beam pose.
   const g=earlyBoxGirderGeometry(size.x,size.y,size.z);g.translate(...center.toArray());
   owner.dynamic.add(beam);replace(owner,beam,g,material());owner.stats.integralGalleryGirders++;
  }
  for(const mesh of meshes){
   if(!/^(Near support branch|Far original-body branch|Fixed anchor fairlead branch|Inlet collar|Outlet collar)$/.test(mesh.name))continue;
   const m=new THREE.MeshStandardMaterial({name:'Cable support / visible braided copper',color:0xc78d43,emissive:0x4d2c0d,emissiveIntensity:.2,metalness:.62,roughness:.38});owner.materials.push(m);
   // This is a non-solid cable, not a walkable plate or a portal ray owner.
   const g=mesh.geometry.clone();g.scale(1.9,1,1.9);replace(owner,mesh,g,m);owner.stats.legibleCableBranches++;
  }
  const gauge=meshes.find(m=>{const p=m.geometry?.parameters;return p&&Math.abs(p.width-7.3)<.01&&Math.abs(p.height-1.9)<.01&&Math.abs(p.depth-.28)<.01;});
  if(gauge){replace(owner,gauge,earlyPartitionGeometry(7.3,1.9,.28),material());owner.stats.workingPartitions++;}
  const readout=meshes.find(m=>m.name==='Process instrument'),canvas=globalThis.document?.createElement?.('canvas'),c=canvas?.getContext?.('2d');
  if(readout&&c&&level.beam){
   canvas.width=1024;canvas.height=256;
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
   texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.anisotropy=8;
   const m=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});owner.materials.push(m);(owner.textures??=[]).push(texture);
   replace(owner,readout,readout.geometry,m);
   let stamp='',last=-Infinity;
   const draw=()=>{
    const time=level.workshop?.time??0,load=Math.round(level.beam.tension),angle=THREE.MathUtils.radToDeg(level.beam.angle).toFixed(1),next=load+':'+angle;
    if(next===stamp||time>=last&&time-last<.2)return;stamp=next;last=time;
    c.fillStyle='#172c35';c.fillRect(0,0,1024,256);c.fillStyle='#b7884c';c.fillRect(0,0,1024,10);
    c.fillStyle='#8ba8aa';c.font='600 26px sans-serif';c.textBaseline='middle';c.textAlign='left';c.fillText('НАГРУЗКА ОПОРЫ',38,42);c.fillText('НАКЛОН ПРОЛЁТА',570,42);
    c.font='600 79px sans-serif';c.fillStyle='#f4deb1';c.fillText(load+' Н',38,119,460);c.fillStyle='#c6e5df';c.fillText(angle+'°',570,119,410);
    const x=42,y=197,w=435;c.fillStyle='#38515b';c.fillRect(x,y,w,17);c.fillStyle='#cba56b';c.fillRect(x,y,w*THREE.MathUtils.clamp(load/900,0,1),17);
    c.fillStyle='#7f9b9c';for(let i=0;i<=6;i++)c.fillRect(x+w*i/6-1,223,2,i%3===0?14:8);
    c.strokeStyle='#4c6870';c.lineWidth=2;c.beginPath();c.moveTo(534,32);c.lineTo(534,225);c.stroke();
    c.fillStyle='#7f9b9c';c.font='500 23px sans-serif';c.fillText('0',38,240);c.fillText('900 Н',405,240);c.fillText('ФАКТИЧЕСКОЕ ПОЛОЖЕНИЕ',570,204,410);
    texture.needsUpdate=true;
   };
   (owner.renders??=[]).push(draw);draw();
  }
 }
}
