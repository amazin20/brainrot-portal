import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gameplayContract} from './lab-art-contract.js';

const sha=value=>createHash('sha256').update(value).digest('hex');
const scalar=value=>typeof value==='number'&&!Number.isFinite(value)?{$number:String(value)}:Object.is(value,-0)?{$number:'-0'}:value===undefined?{$undefined:true}:value;
const vector=value=>value?.toArray?.()??value;
const functionPin=value=>sha(Function.prototype.toString.call(value));
const exactData=value=>Array.isArray(value)?value.map(exactData):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[key,exactData(v)])):scalar(value);
const snapshotPrototype=object=>Object.fromEntries(Object.getOwnPropertyNames(Object.getPrototypeOf(object)).sort().flatMap(key=>{const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(object),key);return typeof d.value==='function'?[[key,functionPin(d.value)]]:[];}));
const bytesOf=array=>Buffer.from(array.buffer,array.byteOffset,array.byteLength);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fresh ordinary zero-input room38, with its current real freight-door fix.
 * This is not the historical pre-freight architecture fixture. Only engine
 * allocation ids/UUID references receive deterministic owner aliases; complete
 * raw allocation receipts accompany the contract. Physical own fields, graph
 * links, body/shape parameters, query geometry and original GLB bytes remain.
 */
export function currentRoom38Contract(game,{sourceRoot=fileURLToPath(new URL('../../',import.meta.url))}={}){
 const g=game,p=g.physics,w=p.world,l=g.firstLevel;
 assert.equal(l.id,'post-separated-freight');assert.equal(l.index,37);assert.equal(g.levelIndex,37);assert.equal(g.chamberEdition,'foundation');
 assert.equal(g.puzzleProgression,true);assert.equal(g.campaignSequencePresentation,true);assert.equal(g.room23PhysicalPrototype,true);
 assert.equal(w.stepnumber,0);assert.equal(w.time,0);assert.equal(g.elapsed,0);assert.equal(g.teleportCount,0);assert.equal(p.portalTransports,0);assert.equal(g.heldCube,null);assert.equal(g.portals.ready,false);assert.ok(g.portals.portals.every(v=>!v));
 assert.deepEqual(vector(l.spawn),[9,0,17]);assert.deepEqual(vector(l.cargoSpawn),[7,.6,14]);assert.deepEqual(l.spawnView,{yaw:-.1,pitch:-.22});assert.deepEqual(g.playerPosition.toArray(),[9,0,17]);assert.deepEqual(g.cargo.position.toArray(),[7,.6,14]);
 const cargo=p.cargoBody,shape=cargo.shapes[0],original={body:cargo,shape,cargo:g.cargo,physics:p,world:w,main:g.animator.rig.mesh,gun:g.weapon,buddy:g.cargo.visual};
 assert.equal(cargo.mass,3.2);assert.equal(cargo.type,1);assert.equal(cargo.shapes.length,1);assert.equal(shape.type,4);assert.deepEqual([shape.halfExtents.x,shape.halfExtents.y,shape.halfExtents.z],[.39,.39,.39]);
 assert.equal(cargo.world,w);assert.equal(shape.body,cargo);assert.ok(w.bodies.includes(cargo));
 g.scene.updateMatrixWorld(true);
 const sourceFiles=['src/game/LabPostCampaignB.js','src/game/LabRoom38FreightExit.js','src/game/LabPostJourneyB.js','src/game/LabGame.js','src/game/LabPhysics.js','src/game/LabSolidModels.js','src/game/ReleaseIdentity.js','tests/helpers/lab-room38-freight-contract.js','tests/helpers/lab-art-contract.js','node_modules/cannon-es/package.json','node_modules/cannon-es/dist/cannon-es.cjs.js','node_modules/cannon-es/dist/cannon-es.js','node_modules/three/package.json','node_modules/three/build/three.module.js','node_modules/three/build/three.core.js'];
 const sourcePins=Object.fromEntries(sourceFiles.map(name=>[name,sha(fs.readFileSync(path.join(sourceRoot,name)))]));
 const queryMeshes=[],queryAliases=new Map(),uuidAliases=new Map(),queryMembership={};
 function query(mesh,label){assert.ok(mesh?.isObject3D,'Actual query/physical mesh owner '+label);if(!queryAliases.has(mesh)){const alias='query:'+queryMeshes.length;queryAliases.set(mesh,alias);uuidAliases.set(mesh.uuid,alias);queryMeshes.push(mesh);}return queryAliases.get(mesh);}
 queryMembership.colliders=g.colliders.map((c,i)=>query(c.mesh,'collider:'+i));
 queryMembership.camera=g.cameraBlockers.map((m,i)=>query(m,'camera:'+i));
 queryMembership.aim=g.aimBlockers.map((m,i)=>query(m,'aim:'+i));
 queryMembership.panels=g.portalPanels.map((m,i)=>query(m,'portal:'+i));
 queryMembership.floors=g.floors.map((f,i)=>f.mesh?query(f.mesh,'floor:'+i):null);
 queryMembership.ramps=g.ramps.map((r,i)=>r.mesh?query(r.mesh,'ramp:'+i):null);
 for(const [name,panel]of Object.entries(l.panels))query(panel.mesh,'named-panel:'+name);
 // Current mechanical objects may reference a visible part which is not a
 // query owner. Give that original part a semantic order, not a scene-wide
 // traversal index which would be shifted by unrelated new decoration.
 const mechanismMeshes=[],mechanismAliases=new Map();
 function collectMechanical(value,at,seen=new Set()){
  if(!value||typeof value!=='object'||seen.has(value)||value===g||value===p||value===w)return;seen.add(value);
  if(value.isObject3D){if(!queryAliases.has(value)&&!mechanismAliases.has(value)){mechanismAliases.set(value,'mechanical:'+mechanismMeshes.length);uuidAliases.set(value.uuid,mechanismAliases.get(value));mechanismMeshes.push(value);}value.children.forEach((child,i)=>collectMechanical(child,at+'/'+i,seen));return;}
  if(Array.isArray(value)){value.forEach((v,i)=>collectMechanical(v,at+'/'+i,seen));return;}
  if(Object.getPrototypeOf(value)===Object.prototype)for(const key of Object.keys(value).sort())collectMechanical(value[key],at+'/'+key,seen);
 }
 collectMechanical({freight:l.freight,exit:l.freightExit},'room38');
 // Bind each compound solid model through its actual registered collider
 // references. These owner UUIDs are real mechanical links, not decoration.
 const solidBindings=(l.workshop.solidModels??[]).map((binding,index)=>{
  assert.ok(binding.model?.isObject3D&&Array.isArray(binding.colliders)&&binding.colliders.length>0,'Actual compound solid-model binding '+index);
  for(const collider of binding.colliders){assert.ok(g.colliders.includes(collider),'Solid-model envelope remains in the real registry');assert.equal(collider.solidModel,binding.model.uuid);assert.equal(collider.mesh.userData.solidModelOwner,binding.model.uuid);}
  collectMechanical(binding.model,'bound-solid-model:'+index);return binding;
 });
 const bodyAliases=new Map(w.bodies.map((body,i)=>[body,'body:'+i])),bodyIdAliases=new Map(w.bodies.map((body,i)=>[String(body.id),'body:'+i]));
 const ShapeBase=Object.getPrototypeOf(shape.constructor.prototype).constructor,Material=cargo.material.constructor,ContactMaterial=w.defaultContactMaterial.constructor,Body=cargo.constructor;
 const semanticAliases=new Map(bodyAliases),rawAllocations={bodies:w.bodies.map((body,i)=>({owner:'body:'+i,id:body.id,index:body.index})),shapes:[],materials:[],contactMaterials:[],equations:[],queryMeshes:queryMeshes.map(mesh=>({owner:queryAliases.get(mesh),uuid:mesh.uuid,id:mesh.id,name:mesh.name})),mechanicalMeshes:mechanismMeshes.map(mesh=>({owner:mechanismAliases.get(mesh),uuid:mesh.uuid,id:mesh.id,name:mesh.name}))};
 const counters={shape:0,material:0,contactMaterial:0,equation:0,detachedBody:0};
 function identity(owner){
  if(semanticAliases.has(owner))return semanticAliases.get(owner);
  let kind,receipt;
  if(owner instanceof Body){kind='detachedBody';receipt='bodies';}
  else if(owner instanceof ShapeBase){kind='shape';receipt='shapes';}
  else if(owner instanceof Material){kind='material';receipt='materials';}
  else if(owner instanceof ContactMaterial){kind='contactMaterial';receipt='contactMaterials';}
  else if(/Equation$/.test(owner.constructor?.name??'')&&typeof owner.id==='number'){kind='equation';receipt='equations';}
  if(!kind)return null;
  const alias=kind+':'+counters[kind]++;semanticAliases.set(owner,alias);rawAllocations[receipt].push({owner:alias,id:owner.id,type:owner.constructor.name});return alias;
 }
 const materialOwners=new Map(),geometryOwners=new Map(),originalMeshAliases=new Map();
 rawAllocations.renderGeometries=[];rawAllocations.renderMaterials=[];
 function attributes(geometry){
  if(!geometry)return null;
  if(!geometryOwners.has(geometry)){const owner='geometry:'+geometryOwners.size;geometryOwners.set(geometry,owner);rawAllocations.renderGeometries.push({owner,uuid:geometry.uuid,id:geometry.id,type:geometry.type});}
  const fields=Object.entries(geometry.attributes).map(([name,a])=>({name,itemSize:a.itemSize,count:a.count,normalized:a.normalized,interleaved:Boolean(a.isInterleavedBufferAttribute),offset:a.offset??null,stride:a.data?.stride??null,meshPerAttribute:a.meshPerAttribute??null,arrayType:(a.array??a.data?.array).constructor.name,bytes:(a.array??a.data?.array).byteLength,sha256:sha(bytesOf(a.array??a.data.array))}));
  const morphs=Object.entries(geometry.morphAttributes).map(([name,items])=>({name,items:items.map(a=>({itemSize:a.itemSize,count:a.count,normalized:a.normalized,arrayType:(a.array??a.data?.array).constructor.name,bytes:(a.array??a.data?.array).byteLength,sha256:sha(bytesOf(a.array??a.data.array))}))}));
  return{owner:geometryOwners.get(geometry),type:geometry.type,attributes:fields,morphs,morphTargetsRelative:geometry.morphTargetsRelative,index:geometry.index?{count:geometry.index.count,itemSize:geometry.index.itemSize,normalized:geometry.index.normalized,arrayType:geometry.index.array.constructor.name,bytes:geometry.index.array.byteLength,sha256:sha(bytesOf(geometry.index.array))}:null,groups:geometry.groups.map(v=>({...v})),drawRange:{...geometry.drawRange},boundingBox:geometry.boundingBox?{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()}:null,boundingSphere:geometry.boundingSphere?{center:geometry.boundingSphere.center.toArray(),radius:geometry.boundingSphere.radius}:null};
 }
 function material(material,{originalGlb=false}={}){
  if(Array.isArray(material))return material.map(m=>materialSnapshot(m,originalGlb));
  return materialSnapshot(material,originalGlb);
 }
 function materialSnapshot(m,originalGlb){
  if(!m)return null;if(!materialOwners.has(m)){const owner='render-material:'+materialOwners.size;materialOwners.set(m,owner);rawAllocations.renderMaterials.push({owner,uuid:m.uuid,id:m.id,type:m.type});}
  const result={owner:materialOwners.get(m),type:m.type,name:m.name,visible:m.visible,side:m.side,shadowSide:m.shadowSide,transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest,depthTest:m.depthTest,depthWrite:m.depthWrite,clipIntersection:m.clipIntersection,clipShadows:m.clipShadows,clippingPlanes:(m.clippingPlanes??[]).map(plane=>[...plane.normal.toArray(),plane.constant])};
  if(originalGlb)Object.assign(result,{color:m.color?.toArray()??null,emissive:m.emissive?.toArray()??null,emissiveIntensity:m.emissiveIntensity??null,roughness:m.roughness??null,metalness:m.metalness??null,wireframe:m.wireframe,vertexColors:m.vertexColors,skinning:m.skinning??null,morphTargets:m.morphTargets??null,morphNormals:m.morphNormals??null});
  return result;
 }
 function linkedOwner(id,label){if(id===undefined||id===null)return null;assert.ok(typeof id==='string'&&uuidAliases.has(id),'Known actual owner for '+label);return uuidAliases.get(id);}
 function meshSnapshot(mesh,{originalGlb=false,children=true}={}){
  const ancestry=[];for(let parent=mesh;parent;parent=parent.parent)ancestry.push(parent.visible);
  const result={owner:queryAliases.get(mesh)??mechanismAliases.get(mesh)??originalMeshAliases.get(mesh)??null,type:mesh.type,name:mesh.name,visible:mesh.visible,ancestorVisibility:ancestry,position:mesh.position.toArray(),quaternion:mesh.quaternion.toArray(),scale:mesh.scale.toArray(),matrix:mesh.matrix.toArray(),matrixWorld:mesh.matrixWorld.toArray(),matrixAutoUpdate:mesh.matrixAutoUpdate,layers:mesh.layers.mask,raycastSource:typeof mesh.raycast==='function'?functionPin(mesh.raycast):null,portalable:mesh.userData.portalable??null,collisionProxy:mesh.userData.collisionProxy??null,portalSize:mesh.userData.portalSize??null,solidModel:mesh.userData.solidModel??null,collisionParts:mesh.userData.collisionParts??null,solidModelOwner:linkedOwner(mesh.userData.solidModelOwner,'solid-model envelope'),portalBacking:(mesh.userData.portalBackingIds??[]).map(id=>{assert.ok(uuidAliases.has(id),'Known backing collision owner');return uuidAliases.get(id);})};
  if(mesh.isMesh){result.geometry=attributes(mesh.geometry);result.material=material(mesh.material,{originalGlb});result.morph=mesh.morphTargetInfluences?.slice()??null;result.getVertexPositionSource=functionPin(mesh.getVertexPosition);result.skin=mesh.skeleton?{bones:mesh.skeleton.bones.map(b=>({name:b.name,position:b.position.toArray(),quaternion:b.quaternion.toArray(),scale:b.scale.toArray()})),inverses:mesh.skeleton.boneInverses.map(m=>m.toArray()),bindMatrix:mesh.bindMatrix.toArray(),bindMatrixInverse:mesh.bindMatrixInverse.toArray()}:null;}
  if(children){result.raycastDescendants=[];mesh.traverse(child=>{if(child!==mesh&&child.isMesh)result.raycastDescendants.push(meshSnapshot(child,{originalGlb,children:false}));});}
  return result;
 }
 // The physical graph records every own property and every link. External
 // query/visible-part references point at their complete snapshots above.
 const nodes=[],seen=new Map();
 function encode(value,at='root'){
  if(value===null||typeof value!=='object'&&typeof value!=='function'){
   if(typeof value==='string'&&UUID.test(value)){assert.ok(uuidAliases.has(value),'Every physical UUID resolves to its actual query/part owner: '+at);return{$allocation:uuidAliases.get(value)};}
   return scalar(value);
  }
  if(value===g)return{$external:'actual-game-owner'};
  if(queryAliases.has(value))return{$external:queryAliases.get(value)};
  if(mechanismAliases.has(value))return{$external:mechanismAliases.get(value)};
  for(const name of ['Date','RegExp','Promise','WeakRef','FinalizationRegistry','SharedArrayBuffer'])if(typeof globalThis[name]==='function')assert.ok(!(value instanceof globalThis[name]),'Opaque native '+name+' requires a separately reviewed lossless encoding: '+at);
  if(seen.has(value))return{$ref:seen.get(value)};
  const index=nodes.length;seen.set(value,index);const node={index,type:value.constructor?.name??'null-prototype',properties:[]};nodes.push(node);
  if(typeof value==='function')node.functionSource=functionPin(value);
  assert.equal(Object.getOwnPropertySymbols(value).length,0,'No unrecorded symbol-owned physical fields: '+at);
  if(value instanceof WeakSet){assert.equal(value,p.usedPortalVelocityTransfers,'Only the pinned fresh transit-receipt WeakSet may be opaque');node.freshWeakSet={provenance:'new LabPhysics constructor, normal reset, zero world steps and zero portal transfers; no arbitrary iterable reconstruction',physicsSource:sourcePins['src/game/LabPhysics.js'],portalTransports:p.portalTransports,worldStep:w.stepnumber};}
  assert.ok(!(value instanceof WeakMap),'An opaque physical WeakMap requires a separate ownership proof');
  if(value instanceof ArrayBuffer){node.bytes=[...new Uint8Array(value)];node.byteLength=value.byteLength;node.maxByteLength=value.maxByteLength;node.resizable=value.resizable;}
  if(ArrayBuffer.isView(value)){node.view={byteOffset:value.byteOffset,byteLength:value.byteLength,buffer:encode(value.buffer,at+'/buffer')};if(value instanceof DataView)node.bytes=[...new Uint8Array(value.buffer,value.byteOffset,value.byteLength)];else node.typedValues=Array.from(value,scalar);}
  if(value instanceof Map)node.entries=[...value].map(([key,v],i)=>[encode(key,at+'/mapkey/'+i),encode(v,at+'/mapvalue/'+i)]);
  if(value instanceof Set)node.entries=[...value].map((v,i)=>encode(v,at+'/set/'+i));
  const alias=identity(value);if(alias)node.allocationOwner=alias;
  const keys=Object.getOwnPropertyNames(value).sort((a,b)=>value===w.idToBodyMap?(bodyIdAliases.get(a)??a).localeCompare(bodyIdAliases.get(b)??b):a.localeCompare(b));
  for(const key of keys){
   const descriptor=Object.getOwnPropertyDescriptor(value,key);let normalizedKey=key;
   if(value===w.idToBodyMap){assert.ok(bodyIdAliases.has(key),'Actual world body-id lookup must point at a live indexed owner');normalizedKey=bodyIdAliases.get(key);}
   if(!Object.hasOwn(descriptor,'value')){node.properties.push([normalizedKey,{get:descriptor.get?encode(descriptor.get,at+'/'+key+'/get'):null,set:descriptor.set?encode(descriptor.set,at+'/'+key+'/set'):null,enumerable:descriptor.enumerable,configurable:descriptor.configurable}]);continue;}
   const data=key==='id'&&alias?{$allocation:alias}:encode(descriptor.value,at+'/'+key);
   node.properties.push([normalizedKey,{value:data,writable:descriptor.writable,enumerable:descriptor.enumerable,configurable:descriptor.configurable}]);
  }
  return{$ref:index};
 }
 const physicsRoot=encode(p,'physics'),mechanismsRoot=encode({freight:l.freight,freightExit:l.freightExit,solidModels:solidBindings},'mechanisms'),registryRoot=encode({colliders:g.colliders,floors:g.floors,ramps:g.ramps,camera:g.cameraBlockers,aim:g.aimBlockers,portals:g.portalPanels},'queryRegistries');
 const originalVisuals=[],originalMeshRefs=[];
 const roots=[['original-main',g.animator.rig.mesh],['original-device',g.weapon],['original-companion',g.cargo.visual],...[...g.assets.entries()].sort(([a],[b])=>a-b).map(([id,root])=>['loaded-asset:'+id,root])];
 rawAllocations.originalMeshes=[];
 for(const [role,root]of roots){assert.ok(root?.traverse);const members=[];root.traverse(mesh=>{if(!mesh.isMesh)return;if(!originalMeshAliases.has(mesh)){const owner='original-mesh:'+originalMeshAliases.size;originalMeshAliases.set(mesh,owner);rawAllocations.originalMeshes.push({owner,uuid:mesh.uuid,id:mesh.id,name:mesh.name});}members.push(meshSnapshot(mesh,{originalGlb:true,children:false}));originalMeshRefs.push({mesh,geometry:mesh.geometry,material:mesh.material,skeleton:mesh.skeleton,index:mesh.geometry.index,attributes:Object.entries(mesh.geometry.attributes).map(([name,a])=>({name,a,array:a.array??a.data?.array}))});});assert.ok(members.length>0,'Every original GLB role is positive: '+role);originalVisuals.push({role,members});}
 const contract={kind:'current-room38-complete-zero-input-contract-v1',sourcePins,functionPins:{game:snapshotPrototype(g),physics:snapshotPrototype(p)},runtimeFlags:{chamberEdition:g.chamberEdition,puzzleProgression:g.puzzleProgression,campaignSequencePresentation:g.campaignSequencePresentation,room23PhysicalPrototype:g.room23PhysicalPrototype},gameplay:gameplayContract(g),physicalGraph:{root:physicsRoot,mechanisms:mechanismsRoot,queryRegistries:registryRoot,nodes},queryMembership,queryOwners:queryMeshes.map(mesh=>meshSnapshot(mesh)),mechanicalOwners:mechanismMeshes.map(mesh=>meshSnapshot(mesh)),originalVisuals,counts:{bodies:w.bodies.length,solids:p.solids.size,bodyBoxes:p.bodyBoxes.size,cargoSweepBoxes:p.cargoSweepBoxes.size,constraints:w.constraints.length,queryOwners:queryMeshes.length,originalRoleRows:originalVisuals.length},cargoOwner:bodyAliases.get(cargo)};
 assert.equal(g.physics,original.physics);assert.equal(g.physics.world,original.world);assert.equal(g.physics.cargoBody,original.body);assert.equal(original.body.shapes[0],original.shape);assert.equal(g.cargo,original.cargo);assert.equal(g.animator.rig.mesh,original.main);assert.equal(g.weapon,original.gun);assert.equal(g.cargo.visual,original.buddy);
 for(const r of originalMeshRefs){assert.equal(r.mesh.geometry,r.geometry);assert.equal(r.mesh.material,r.material);assert.equal(r.mesh.skeleton,r.skeleton);assert.equal(r.geometry.index,r.index);for(const a of r.attributes){assert.equal(r.geometry.attributes[a.name],a.a);assert.equal(a.a.array??a.a.data?.array,a.array);}}
 assert.equal(w.stepnumber,0);assert.equal(w.time,0);assert.equal(g.elapsed,0);
 return{contract:exactData(contract),rawAllocations:exactData(rawAllocations)};
}

export function assertCurrentRoom38Contract(game,fixture,options){
 assert.equal(fixture.kind,'room38-current-freight-before-after-immutable-fixture-v1');
 assert.equal(fixture.procedure.baselineArtCheckpoint,'2dcd961ccf7cf2aaf7057357d379e02a4fff7be2');
 assert.deepEqual(fixture.procedure.restoredFiles,['src/game/LabOpticsArchitecture.js','src/game/LabVisualAuditObservatory.js']);
 assert.deepEqual(fixture.procedure.removedNewArtFiles,['src/game/LabObservatoryWallProfiles.js','src/game/LabObservatoryRoomFinishes.js']);
 assert.equal(fixture.procedure.freshSeparateProcesses,true);assert.equal(fixture.procedure.normalSetup,true);assert.equal(fixture.procedure.equalFullContractBytes,true);
 const fixtureContractBytes=Buffer.from(JSON.stringify(fixture.contract,null,2)+'\n');
 assert.equal(sha(fixtureContractBytes),fixture.procedure.fullContractSha256,'Immutable fixture metadata must bind the entire unfiltered contract');assert.equal(fixtureContractBytes.length,fixture.procedure.fullContractBytes);
 const actual=currentRoom38Contract(game,options);
 assert.deepEqual(actual.contract,fixture.contract,'Entire current38 physical/query/original-GLB contract must match the isolated pre-art capture; no field removal or selective hash comparison');
 return actual;
}
