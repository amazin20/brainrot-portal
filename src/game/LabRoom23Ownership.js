import {Body,Box,Constraint,ConvexPolyhedron,Cylinder,Equation,Quaternion,Sphere,Vec3} from 'cannon-es';

// These records keep authored local facts and object identity. They deliberately
// do not freeze the live Cannon objects, a body's integrated pose, contacts,
// world-space inertia/caches, or a solver's per-step equation list.
const bodyRecords=new WeakSet(),constraintRecords=new WeakSet();
const finite=Number.isFinite,integer=Number.isSafeInteger;
const frozen=Object.freeze;

function once(list,item){
 if(!Array.isArray(list))return false;
 let count=0;for(let i=0;i<list.length;i++)if(list[i]===item&&++count>1)return false;
 return count===1;
}
function ownedBody(body,world){return body instanceof Body&&body.world===world&&!!world&&once(world.bodies,body);}
function id(value){return integer(value)&&value>=0;}
function mask(value){return integer(value);}
function material(value){return value===null||(typeof value==='object'&&value!==null);}
function finiteBodyState(body){return[body.position,body.quaternion,body.velocity,body.angularVelocity,body.force,body.torque].every(v=>v&&[v.x,v.y,v.z,...('w'in v?[v.w]:[])].every(finite));}
function vectorSnapshot(value,quaternion=false){
 if(!(value instanceof(quaternion?Quaternion:Vec3)))return null;
 const values=quaternion?[value.x,value.y,value.z,value.w]:[value.x,value.y,value.z];
 if(!values.every(finite))return null;
 return frozen({reference:value,constructor:value.constructor,prototype:Object.getPrototypeOf(value),values:frozen(values)});
}
function vectorValid(value,row){
 if(!row||value!==row.reference||value.constructor!==row.constructor||Object.getPrototypeOf(value)!==row.prototype)return false;
 const numbers=row.values;
 return value.x===numbers[0]&&value.y===numbers[1]&&value.z===numbers[2]
  &&(numbers.length===3||value.w===numbers[3]);
}
function vectorsSnapshot(values,{nullable=false}={}){
 if(nullable&&values===null)return frozen({reference:null,rows:null});
 if(!Array.isArray(values))return null;
 const rows=[];
 for(const value of values){const row=vectorSnapshot(value);if(!row)return null;rows.push(row);}
 return frozen({reference:values,rows:frozen(rows)});
}
function vectorsValid(values,row){
 if(!row||values!==row.reference)return false;
 if(row.rows===null)return values===null;
 if(!Array.isArray(values)||values.length!==row.rows.length)return false;
 for(let i=0;i<values.length;i++)if(!vectorValid(values[i],row.rows[i]))return false;
 return true;
}
function fixedFieldsSnapshot(object,keys){
 if(!Array.isArray(keys)||new Set(keys).size!==keys.length)return null;
 const rows=[];
 for(const key of keys){
  if(typeof key!=='string'||!Object.hasOwn(object,key))return null;
  const value=object[key];
  if(!(typeof value==='number'?finite(value):['string','boolean','function'].includes(typeof value)))return null;
  rows.push(frozen({key,value}));
 }
 return frozen(rows);
}
function fixedFieldsValid(object,rows){return rows.every(({key,value})=>Object.hasOwn(object,key)&&object[key]===value);}
function fixedVectorsSnapshot(object,keys){
 if(!Array.isArray(keys)||new Set(keys).size!==keys.length)return null;
 const rows=[];
 for(const key of keys){
  if(typeof key!=='string'||!Object.hasOwn(object,key))return null;
  const vector=vectorSnapshot(object[key]);if(!vector)return null;
  rows.push(frozen({key,vector}));
 }
 return frozen(rows);
}
function fixedVectorsValid(object,rows){return rows.every(({key,vector})=>Object.hasOwn(object,key)&&vectorValid(object[key],vector));}
function jacobianSnapshot(element){
 if(!element)return null;
 const spatial=vectorSnapshot(element.spatial),rotational=vectorSnapshot(element.rotational);
 return spatial&&rotational?frozen({reference:element,spatial,rotational}):null;
}
function jacobianValid(element,row){return!!row&&element===row.reference&&vectorValid(element.spatial,row.spatial)&&vectorValid(element.rotational,row.rotational);}
function facesSnapshot(faces,vertexCount){
 if(!Array.isArray(faces)||faces.length===0)return null;
 const rows=[];
 for(const face of faces){
  if(!Array.isArray(face)||face.length<3||new Set(face).size!==face.length
   ||!face.every(n=>integer(n)&&n>=0&&n<vertexCount))return null;
  rows.push(frozen({reference:face,values:frozen(face.slice())}));
 }
 return frozen({reference:faces,rows:frozen(rows)});
}
function facesValid(faces,row){
 if(!row||faces!==row.reference||!Array.isArray(faces)||faces.length!==row.rows.length)return false;
 for(let i=0;i<faces.length;i++){
  const face=faces[i],saved=row.rows[i];
  if(face!==saved.reference||face.length!==saved.values.length)return false;
  for(let j=0;j<face.length;j++)if(face[j]!==saved.values[j])return false;
 }
 return true;
}
function convexSnapshot(shape){
 if(!(shape instanceof ConvexPolyhedron)||!id(shape.id)||!integer(shape.type)
  ||!finite(shape.boundingSphereRadius)||shape.boundingSphereRadius<0)return null;
 const vertices=vectorsSnapshot(shape.vertices),faceNormals=vectorsSnapshot(shape.faceNormals),
  uniqueAxes=vectorsSnapshot(shape.uniqueAxes,{nullable:true}),uniqueEdges=vectorsSnapshot(shape.uniqueEdges);
 if(!vertices||vertices.rows.length<4||!faceNormals||!uniqueAxes||!uniqueEdges)return null;
 const faces=facesSnapshot(shape.faces,vertices.rows.length);
 if(!faces||faceNormals.rows.length!==faces.rows.length)return null;
 return frozen({reference:shape,constructor:shape.constructor,prototype:Object.getPrototypeOf(shape),id:shape.id,type:shape.type,
  boundingSphereRadius:shape.boundingSphereRadius,vertices,faces,faceNormals,uniqueAxes,uniqueEdges});
}
function convexValid(shape,row){
 return!!row&&shape===row.reference&&shape.constructor===row.constructor&&Object.getPrototypeOf(shape)===row.prototype
  &&shape.id===row.id&&shape.type===row.type&&shape.boundingSphereRadius===row.boundingSphereRadius
  &&vectorsValid(shape.vertices,row.vertices)&&facesValid(shape.faces,row.faces)
  &&vectorsValid(shape.faceNormals,row.faceNormals)&&vectorsValid(shape.uniqueAxes,row.uniqueAxes)
  &&vectorsValid(shape.uniqueEdges,row.uniqueEdges);
}
function geometrySnapshot(shape){
 if(shape instanceof Box){
  const halfExtents=vectorSnapshot(shape.halfExtents),convex=convexSnapshot(shape.convexPolyhedronRepresentation);
  if(!halfExtents||halfExtents.values.some(n=>n<0)||!convex)return null;
  return frozen({kind:'box',halfExtents,convex});
 }
 if(shape instanceof Sphere){
  return finite(shape.radius)&&shape.radius>=0?frozen({kind:'sphere',radius:shape.radius}):null;
 }
 if(shape instanceof Cylinder){
  const convex=convexSnapshot(shape);
  if(!convex||!finite(shape.radiusTop)||shape.radiusTop<0||!finite(shape.radiusBottom)||shape.radiusBottom<0
   ||!finite(shape.height)||shape.height<=0||!integer(shape.numSegments)||shape.numSegments<3)return null;
  return frozen({kind:'cylinder',radiusTop:shape.radiusTop,radiusBottom:shape.radiusBottom,
   height:shape.height,numSegments:shape.numSegments,convex});
 }
 return null;
}
function geometryValid(shape,row){
 if(row.kind==='box')return shape instanceof Box&&vectorValid(shape.halfExtents,row.halfExtents)
  &&convexValid(shape.convexPolyhedronRepresentation,row.convex);
 if(row.kind==='sphere')return shape instanceof Sphere&&shape.radius===row.radius;
 if(row.kind==='cylinder')return shape instanceof Cylinder&&shape.radiusTop===row.radiusTop
  &&shape.radiusBottom===row.radiusBottom&&shape.height===row.height&&shape.numSegments===row.numSegments
  &&convexValid(shape,row.convex);
 return false;
}
function shapeSnapshot(shape,body,offset,orientation){
 if(!shape||shape.body!==body||!id(shape.id)||!integer(shape.type)||typeof shape.collisionResponse!=='boolean'
  ||!mask(shape.collisionFilterGroup)||!mask(shape.collisionFilterMask)||!material(shape.material)
  ||!finite(shape.boundingSphereRadius)||shape.boundingSphereRadius<0)return null;
 const localOffset=vectorSnapshot(offset),localOrientation=vectorSnapshot(orientation,true),geometry=geometrySnapshot(shape);
 if(!localOffset||!localOrientation||!geometry)return null;
 return frozen({shape,constructor:shape.constructor,prototype:Object.getPrototypeOf(shape),id:shape.id,type:shape.type,
  body,localOffset,localOrientation,geometry,material:shape.material,boundingSphereRadius:shape.boundingSphereRadius,
  collisionResponse:shape.collisionResponse,collisionFilterGroup:shape.collisionFilterGroup,collisionFilterMask:shape.collisionFilterMask});
}

/** Capture once, after all authored shapes and mass properties are installed.
 * A malformed or non-owned body produces null. The snapshot freezes only its
 * own records; all live object references remain usable by the simulation. */
export function captureRoom23BodyOwner(body,world){
 try{
  if(!ownedBody(body,world)||!finiteBodyState(body)||!id(body.id)||!integer(body.type)||!finite(body.mass)||body.mass<0
   ||!finite(body.invMass)||body.invMass<0||typeof body.fixedRotation!=='boolean'
   ||typeof body.collisionResponse!=='boolean'||!mask(body.collisionFilterGroup)||!mask(body.collisionFilterMask)
   ||!finite(body.linearDamping)||!finite(body.angularDamping)||!material(body.material)||!Array.isArray(body.shapes)||!Array.isArray(body.shapeOffsets)
   ||!Array.isArray(body.shapeOrientations)||body.shapes.length!==body.shapeOffsets.length
   ||body.shapes.length!==body.shapeOrientations.length||new Set(body.shapes).size!==body.shapes.length)return null;
  const inertia=vectorSnapshot(body.inertia),invInertia=vectorSnapshot(body.invInertia),
   linearFactor=vectorSnapshot(body.linearFactor),angularFactor=vectorSnapshot(body.angularFactor);
  if(!inertia||!invInertia||!linearFactor||!angularFactor)return null;
  const shapes=[];
  for(let i=0;i<body.shapes.length;i++){
   const row=shapeSnapshot(body.shapes[i],body,body.shapeOffsets[i],body.shapeOrientations[i]);
   if(!row)return null;shapes.push(row);
  }
  if(new Set(shapes.map(row=>row.id)).size!==shapes.length)return null;
  const record=frozen({kind:'room23-body-owner',body,world,constructor:body.constructor,prototype:Object.getPrototypeOf(body),id:body.id,
   shapesArray:body.shapes,shapeOffsetsArray:body.shapeOffsets,shapeOrientationsArray:body.shapeOrientations,shapes:frozen(shapes),
   mass:body.mass,type:body.type,invMass:body.invMass,inertia,invInertia,fixedRotation:body.fixedRotation,linearFactor,angularFactor,linearDamping:body.linearDamping,angularDamping:body.angularDamping,
   material:body.material,collisionResponse:body.collisionResponse,collisionFilterGroup:body.collisionFilterGroup,collisionFilterMask:body.collisionFilterMask});
  bodyRecords.add(record);return record;
 }catch{return null;}
}

/** Default masks are the captured authored masks. Only the caller that owns an
 * aperture/carry state may supply its current expected mask: bodyMask is a
 * number or callback(body), and shapeMask is callback(shape,index). */
export function room23BodyOwnerValid(record,options={}){
 try{
  if(!record||!bodyRecords.has(record)||!options||typeof options!=='object')return false;
  const {bodyMask,shapeMask}=options,{body,world}=record;
  if(bodyMask!==undefined&&typeof bodyMask!=='number'&&typeof bodyMask!=='function')return false;
  if(shapeMask!==undefined&&typeof shapeMask!=='function')return false;
  const expectedBodyMask=bodyMask===undefined?record.collisionFilterMask:typeof bodyMask==='function'?bodyMask(body):bodyMask;
  if(!mask(expectedBodyMask)||!ownedBody(body,world)||!finiteBodyState(body)||body.constructor!==record.constructor
   ||Object.getPrototypeOf(body)!==record.prototype||body.id!==record.id||body.mass!==record.mass||body.type!==record.type
   ||body.invMass!==record.invMass||body.fixedRotation!==record.fixedRotation||body.material!==record.material||body.linearDamping!==record.linearDamping||body.angularDamping!==record.angularDamping
   ||body.collisionResponse!==record.collisionResponse||body.collisionFilterGroup!==record.collisionFilterGroup
   ||body.collisionFilterMask!==expectedBodyMask||!vectorValid(body.inertia,record.inertia)
   ||!vectorValid(body.invInertia,record.invInertia)||!vectorValid(body.linearFactor,record.linearFactor)
   ||!vectorValid(body.angularFactor,record.angularFactor)||body.shapes!==record.shapesArray
   ||body.shapeOffsets!==record.shapeOffsetsArray||body.shapeOrientations!==record.shapeOrientationsArray
   ||body.shapes.length!==record.shapes.length||body.shapeOffsets.length!==record.shapes.length
   ||body.shapeOrientations.length!==record.shapes.length)return false;
  for(let i=0;i<record.shapes.length;i++){
   const row=record.shapes[i],shape=body.shapes[i],expectedShapeMask=shapeMask===undefined?row.collisionFilterMask:shapeMask(shape,i);
   if(!mask(expectedShapeMask)||shape!==row.shape||shape.body!==body||shape.constructor!==row.constructor
    ||Object.getPrototypeOf(shape)!==row.prototype||shape.id!==row.id||shape.type!==row.type||shape.material!==row.material
    ||shape.collisionResponse!==row.collisionResponse||shape.collisionFilterGroup!==row.collisionFilterGroup
    ||shape.collisionFilterMask!==expectedShapeMask||shape.boundingSphereRadius!==row.boundingSphereRadius
    ||!vectorValid(body.shapeOffsets[i],row.localOffset)||!vectorValid(body.shapeOrientations[i],row.localOrientation)
    ||!geometryValid(shape,row.geometry))return false;
  }
  return true;
 }catch{return false;}
}

/** Constraints belong to world.constraints. The owning builder declares its
 * fixed local definition explicitly; solver-written bearing/hand Jacobians
 * and contact-driven friction limits remain live. An angle callback is kept
 * by identity, never by its changing return value. */
export function captureRoom23ConstraintOwner(constraint,world,{fixedVectors=[],equationFields=[],fixedForceLimits=true,fixedJacobians=false}={}){
 try{
  if(!(constraint instanceof Constraint)||!world||!once(world.constraints,constraint)||!id(constraint.id)
   ||typeof constraint.collideConnected!=='boolean'||!ownedBody(constraint.bodyA,world)||!ownedBody(constraint.bodyB,world)
   ||!Array.isArray(constraint.equations)||constraint.equations.length===0
   ||new Set(constraint.equations).size!==constraint.equations.length
   ||typeof fixedForceLimits!=='boolean'||typeof fixedJacobians!=='boolean')return null;
  const vectors=fixedVectorsSnapshot(constraint,fixedVectors);if(!vectors)return null;
  const equations=[];
  for(const equation of constraint.equations){
   if(!(equation instanceof Equation)||!id(equation.id)||typeof equation.enabled!=='boolean'
    ||equation.bi!==constraint.bodyA||equation.bj!==constraint.bodyB||!finite(equation.minForce)
    ||!finite(equation.maxForce)||equation.minForce>equation.maxForce)return null;
   const fields=fixedFieldsSnapshot(equation,equationFields),jacobianA=fixedJacobians?jacobianSnapshot(equation.jacobianElementA):null,
    jacobianB=fixedJacobians?jacobianSnapshot(equation.jacobianElementB):null;
   if(!fields||(fixedJacobians&&(!jacobianA||!jacobianB)))return null;
   equations.push(frozen({equation,constructor:equation.constructor,prototype:Object.getPrototypeOf(equation),
    id:equation.id,bi:equation.bi,bj:equation.bj,enabled:equation.enabled,fields,
    limits:fixedForceLimits?frozen({min:equation.minForce,max:equation.maxForce}):null,jacobianA,jacobianB}));
  }
  if(new Set(equations.map(row=>row.id)).size!==equations.length)return null;
  const record=frozen({kind:'room23-constraint-owner',constraint,world,constructor:constraint.constructor,
   prototype:Object.getPrototypeOf(constraint),id:constraint.id,bodyA:constraint.bodyA,bodyB:constraint.bodyB,
   collideConnected:constraint.collideConnected,vectors,fixedJacobians,equationsArray:constraint.equations,equations:frozen(equations)});
  constraintRecords.add(record);return record;
 }catch{return null;}
}

export function room23ConstraintOwnerValid(record){
 try{
  if(!record||!constraintRecords.has(record))return false;
  const {constraint,world}=record;
  if(!once(world.constraints,constraint)||constraint.constructor!==record.constructor
   ||Object.getPrototypeOf(constraint)!==record.prototype||constraint.id!==record.id
   ||constraint.bodyA!==record.bodyA||constraint.bodyB!==record.bodyB
   ||!ownedBody(record.bodyA,world)||!ownedBody(record.bodyB,world)
   ||constraint.collideConnected!==record.collideConnected||constraint.equations!==record.equationsArray
   ||constraint.equations.length!==record.equations.length||!fixedVectorsValid(constraint,record.vectors))return false;
  for(let i=0;i<record.equations.length;i++){
   const row=record.equations[i],equation=constraint.equations[i];
   if(equation!==row.equation||equation.constructor!==row.constructor||Object.getPrototypeOf(equation)!==row.prototype||!finite(equation.minForce)||!finite(equation.maxForce)||equation.minForce>equation.maxForce
    ||equation.id!==row.id||equation.bi!==row.bi||equation.bj!==row.bj||equation.enabled!==row.enabled
    ||!fixedFieldsValid(equation,row.fields)||(row.limits&&(equation.minForce!==row.limits.min||equation.maxForce!==row.limits.max))
    ||(record.fixedJacobians&&(!jacobianValid(equation.jacobianElementA,row.jacobianA)||!jacobianValid(equation.jacobianElementB,row.jacobianB))))return false;
  }
  return true;
 }catch{return false;}
}
