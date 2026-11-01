// Native room32 route observer, recovered from the 2026-11-01 checkpoint.
// Physics/model owners remain guarded per step. Expensive complete material and
// attribute inventories are checked at route boundaries and actual rendered marks;
// original typed buffers are SHA-256 checked before and after the whole route.
// This helper never changes an actor, mechanism, material value or camera pose.
export function suppressRoom32RouteRafAtReady(){
 const g=window.__NESI_DEMO_GAME__,screen=document.querySelector('#start-screen'),button=document.querySelector('#play-button');
 if(!(g?.state==='ready'&&button&&!button.disabled&&screen&&!screen.inert&&getComputedStyle(screen).opacity==='1'))return false;
 if(window.__QA_ROOM32_ROUTE_RAF__)return window.__QA_ROOM32_ROUTE_RAF__.owns(g);
 const owner=g.renderer,original=owner.setAnimationLoop,descriptor=Object.getOwnPropertyDescriptor(owner,'setAnimationLoop');
 if(typeof original!=='function'||descriptor&&(!descriptor.configurable||!descriptor.writable))throw Error('Route RAF owner is not restorable');
 original.call(owner,null);let restored=false,blockedGameLoops=0;
 const wrapper=function(callback){if(callback!==null&&callback!==g.animate)throw Error('Unexpected animation-loop owner');if(callback===g.animate)blockedGameLoops++;return original.call(this,null);};
 Object.defineProperty(owner,'setAnimationLoop',{value:wrapper,writable:true,configurable:true,enumerable:descriptor?.enumerable??false});
 window.__QA_ROOM32_ROUTE_RAF__={owns:game=>!restored&&game===g&&game.renderer===owner&&owner.setAnimationLoop===wrapper,
  read:()=>({restored,blockedGameLoops,policy:'Only the normal g.animate callback is suppressed; fixed-step shipped route owns simulation.'}),
  restore(){if(restored)return{restored:true};if(owner.setAnimationLoop!==wrapper)throw Error('Route RAF wrapper ownership changed');original.call(owner,null);if(descriptor)Object.defineProperty(owner,'setAnimationLoop',descriptor);else delete owner.setAnimationLoop;restored=true;if(owner.setAnimationLoop!==original)throw Error('Route RAF restoration failed');return{restored:true,loopRemainsStopped:true};}};
 return true;
}
export function installRoom32NativeWaypointProbe(limits){
 const g=window.__NESI_DEMO_GAME__,check=(ok,message)=>{if(!ok)throw Error('Native room32 route: '+message);},v=value=>value?.toArray?.()??null;
 check(limits?.maxPhysicsSteps===12000&&limits.maxVisualFrames===6000&&limits.maxPngBytes===25165824&&limits.maxSinglePngBytes===6291456,'exact bounded route limits');
 check(!window.__QA_ROOM32_ROUTE__&&!window.__QA_STATIC_OWNERS__,'fresh route collector, no static guard');
 check(g?.state==='playing'&&g.levelIndex===31&&g.firstLevel?.id==='post-thin-shadow'&&g.physics.world.stepnumber===0&&g.elapsed===0,'normal room32 Play before the first physical step');
 const scheduler=window.__QA_ROOM32_ROUTE_RAF__;check(scheduler?.owns(g),'reviewed ordinary-RAF suppression owner');
 const hook=window.__NESI_RUN_LEVEL_ROUTE__,canvas=document.querySelector('#game canvas[data-engine]'),encoder=HTMLCanvasElement.prototype.toDataURL;
 check(typeof hook==='function'&&g.renderer.domElement===canvas&&g.renderer.isWebGLRenderer&&canvas.toDataURL===encoder,'actual compiled route hook and original WebGL canvas encoder');
 check(canvas.width===1280&&canvas.height===720,'wide production drawing-buffer dimensions, no resize');
 const body=g.physics.cargoBody,shape=body.shapes[0],refs={physics:g.physics,world:g.physics.world,cargo:g.cargo,body,shape,material:body.material,level:g.firstLevel,assets:g.assets,input:g.input,player:g.playerVisual,main:g.animator.rig.mesh,gun:g.weapon,buddy:g.cargo.visual,renderer:g.renderer,camera:g.camera,rig:g.cameraRig,render:g.render,win:g.win};
 check(body.type===1&&body.mass===3.2&&body.shapes.length===1&&shape.type===4&&v(shape.halfExtents).every(n=>n===.39),'original dynamic3.2kg/.78m cargo Box');
 const behavior=g.companionBehavior;check(behavior?.physics===refs.physics,'original companion behavior owner');
 let expectedFriction=body.material.friction,inPhysics=false,behaviorCalls=0;
 const frictionObservations={normal:0,wandering:0,clearanceShuffle:0};
 const physical={shapes:body.shapes,offsets:body.shapeOffsets,orientations:body.shapeOrientations,offset:body.shapeOffsets[0],orientation:body.shapeOrientations[0],offsetValues:v(body.shapeOffsets[0]),orientationValues:v(body.shapeOrientations[0]),half:shape.halfExtents,shapeMaterial:shape.material,shapeCollisionResponse:shape.collisionResponse,bodyCollisionResponse:body.collisionResponse,friction:body.material.friction,restitution:body.material.restitution};
 check(physical.friction===1&&physical.restitution===1&&JSON.stringify(physical.offsetValues)==='[0,0,0]'&&JSON.stringify(physical.orientationValues)==='[0,0,0,1]','canonical original physical material and centered Box orientation');
 const loaded=[...g.assets.entries()],meshes=[],roles={},materials=new Set(),slots=[],resetCalls={resetRun:0,respawn:0,resetCargo:0,levelReset:0},counts={physics:0,visual:0,interact:0,pickups:0,releases:0,portalRequests:0};
 const inputMove=g.input.getMove,inputMoveDescriptor=Object.getOwnPropertyDescriptor(g.input,'getMove'),quality=JSON.stringify(g.quality),pixelRatio=g.renderer.getPixelRatio(),baseVisualTime=g.visualTime;
 const query={camera:[...g.cameraBlockers],aim:[...g.aimBlockers],panels:[...g.portalPanels],colliders:g.colliders.map(c=>({c,mesh:c.mesh}))};
 for(const [role,root]of [['original-main',refs.main],['original-device',refs.gun],['original-companion',refs.buddy],...loaded.map(([id,root])=>['loaded-asset-'+id,root])]){
  check(root?.traverse,'actual original model root '+role);roles[role]=0;root.traverse(mesh=>{if(!mesh.isMesh)return;roles[role]++;const prior=meshes.find(r=>r.mesh===mesh);if(prior){prior.roles.push(role);return;}
   const geometry=mesh.geometry,attributes=[...Object.entries(geometry.attributes),...Object.entries(geometry.morphAttributes).flatMap(([name,items])=>items.map((a,i)=>['$morph:'+name+':'+i,a]))].map(([name,a])=>({name,a,data:a.data,interleaved:Boolean(a.isInterleavedBufferAttribute),array:a.array??a.data?.array,count:a.count,itemSize:a.itemSize,normalized:a.normalized,stride:a.data?.stride,offset:a.offset}));
   check(attributes.some(a=>a.name==='position'&&a.count>0),'positive actual original position buffer');
   for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(material);
   meshes.push({mesh,roles:[role],geometry,material:mesh.material,skeleton:mesh.skeleton,bones:mesh.skeleton?.bones.slice()??[],inverses:mesh.skeleton?.boneInverses.slice()??[],bindMatrix:mesh.bindMatrix,bindMatrixInverse:mesh.bindMatrixInverse,getVertexPosition:mesh.getVertexPosition,attributes,attributeOwner:geometry.attributes,morphOwner:geometry.morphAttributes,morphLists:Object.fromEntries(Object.entries(geometry.morphAttributes)),attributeKeys:Object.keys(geometry.attributes).sort(),morphKeys:Object.keys(geometry.morphAttributes).sort(),morphCounts:Object.fromEntries(Object.entries(geometry.morphAttributes).map(([key,items])=>[key,items.length])),morphTargetsRelative:geometry.morphTargetsRelative,index:geometry.index,indexArray:geometry.index?.array,indexDescriptor:geometry.index?[geometry.index.count,geometry.index.itemSize,geometry.index.normalized,geometry.index.array.constructor.name,geometry.index.array.byteOffset,geometry.index.array.byteLength]:null});
  });
 }
 check(roles['original-main']>0&&roles['original-device']>0&&roles['original-companion']>0,'every actual original role has positive mesh membership');
 check(g.playerVisual.userData.assetId===1&&g.weapon.userData.assetId===11&&g.heldDevice.model===g.weapon&&g.heldDevice.sourceMesh.geometry===g.heldDevice.sourceGeometry&&g.heldDevice.sourceMesh.material===g.heldDevice.sourceMaterial&&meshes.some(r=>r.mesh===g.heldDevice.sourceMesh&&r.roles.includes('original-device')),'actual original GLB player/device and held-device source binding');
 const device={owner:g.heldDevice,sourceMesh:g.heldDevice.sourceMesh,geometry:g.heldDevice.sourceGeometry,material:g.heldDevice.sourceMaterial};
 const materialScalarKeys=['name','type','visible','opacity','transparent','alphaTest','alphaHash','alphaToCoverage','depthTest','depthWrite','colorWrite','side','shadowSide','vertexColors','flatShading','wireframe','wireframeLinewidth','roughness','metalness','emissiveIntensity','toneMapped','blending','blendSrc','blendDst','blendEquation','premultipliedAlpha','clipIntersection','clipShadows','polygonOffset','polygonOffsetFactor','polygonOffsetUnits','displacementScale','displacementBias','envMapIntensity','reflectivity','refractionRatio','aoMapIntensity','lightMapIntensity','bumpScale'];
 const textureKeys=['mapping','channel','wrapS','wrapT','magFilter','minFilter','anisotropy','format','type','colorSpace','flipY','premultiplyAlpha','unpackAlignment','generateMipmaps','matrixAutoUpdate','rotation'];
 const materialState=m=>({clippingPlanes:m.clippingPlanes?.map(plane=>[...plane.normal.toArray(),plane.constant])??null,scalars:materialScalarKeys.map(key=>[key,m[key]??null]),colors:Object.entries(m).filter(([,value])=>value?.isColor).map(([key,value])=>[key,value.toArray()]),vectors:Object.entries(m).filter(([,value])=>value?.isVector2||value?.isVector3).map(([key,value])=>[key,value.toArray()])});
 const materialOwners=[...materials].map(m=>({m,onBeforeCompile:m.onBeforeCompile,key:m.customProgramCacheKey,state:JSON.stringify(materialState(m)),clippingOwner:m.clippingPlanes,maps:Object.keys(m).filter(key=>key==='map'||key.endsWith('Map')).sort().map(key=>{const texture=m[key];return{key,texture,source:texture?.source,image:texture?.image,flags:texture?JSON.stringify(textureKeys.map(name=>[name,texture[name]??null])):null,vectors:texture?JSON.stringify(['offset','repeat','center'].map(name=>[name,texture[name]?.toArray?.()??null])):null};})}));
 let inFlight=false,started=false,restored=false,adapter=null,captureBytes=0,capture=null,captureInstalled=false;const milestones=[],images=[];
 const captureDescriptor=Object.getOwnPropertyDescriptor(window,'__NESI_CAPTURE_LEVEL_MARK__');check(!captureDescriptor,'fresh global compiled-hook capture slot');
 // Publish cleanup BEFORE the first owned method write. Even a setup failure
 // leaves the host an explicit rollback handle; no partial install is hidden.
 window.__QA_ROOM32_ROUTE__={restore,evidence:()=>({milestones,images,counts:{...counts},resetCalls:{...resetCalls},partialEvidenceOnly:true,wonObserved:g.state==='won'})};
 function replace(owner,key,make,kind='method'){
  const original=owner[key],descriptor=Object.getOwnPropertyDescriptor(owner,key);check(typeof original==='function'&&(!descriptor||descriptor.configurable&&descriptor.writable),'restorable method '+key);
  const wrapper=make(original);Object.defineProperty(owner,key,{value:wrapper,writable:true,configurable:true,enumerable:descriptor?.enumerable??false});slots.push({owner,key,original,descriptor,wrapper,kind});return wrapper;
 }
 for(const [owner,key,counter]of [[g,'resetRun','resetRun'],[g,'respawn','respawn'],[g.physics,'resetCargo','resetCargo'],[g.firstLevel,'reset','levelReset']])replace(owner,key,()=>function(){resetCalls[counter]++;throw Error('Forbidden actor/level reset '+counter);},key==='respawn'||key==='resetCargo'?'v8-forward':'reset');
 function owners(full=false){
  check(!restored&&scheduler.owns(g)&&!document.hidden&&!g.externalBlocked,'active owned route scheduler, visible unblocked document');
  check(g.physics===refs.physics&&g.physics.world===refs.world&&g.cargo===refs.cargo&&g.physics.cargoBody===body&&body.world===refs.world&&refs.world.bodies.includes(body),'same actual physics/cargo owner');
  check(body.type===1&&body.mass===3.2&&body.shapes.length===1&&body.shapes[0]===shape&&shape.body===body&&shape.type===4&&v(shape.halfExtents).every(n=>n===.39)&&body.material===refs.material&&body.linearDamping===.035&&body.angularDamping===.16,'same original cargo mass/material/Box');
  check(body.shapes===physical.shapes&&body.shapeOffsets===physical.offsets&&body.shapeOrientations===physical.orientations&&body.shapeOffsets.length===1&&body.shapeOrientations.length===1&&body.shapeOffsets[0]===physical.offset&&body.shapeOrientations[0]===physical.orientation&&JSON.stringify(v(physical.offset))===JSON.stringify(physical.offsetValues)&&JSON.stringify(v(physical.orientation))===JSON.stringify(physical.orientationValues)&&shape.halfExtents===physical.half&&shape.material===physical.shapeMaterial&&shape.collisionResponse===physical.shapeCollisionResponse&&body.collisionResponse===physical.bodyCollisionResponse&&body.material.friction===expectedFriction&&body.material.restitution===physical.restitution&&g.companionBehavior===behavior&&refs.physics.cargoMaterial===refs.material,'same actual physical material/shape offset/orientation/response owners and values');
  check(g.firstLevel===refs.level&&g.assets===refs.assets&&g.input===refs.input&&g.playerVisual===refs.player&&g.animator.rig.mesh===refs.main&&g.weapon===refs.gun&&g.cargo.visual===refs.buddy&&g.renderer===refs.renderer&&g.camera===refs.camera&&g.cameraRig===refs.rig&&g.render===refs.render&&g.win===refs.win,'same original scene/lens/renderer/input/method owners');
  check(g.heldDevice===device.owner&&g.heldDevice.model===refs.gun&&g.heldDevice.sourceMesh===device.sourceMesh&&device.sourceMesh.geometry===device.geometry&&device.sourceMesh.material===device.material&&g.playerVisual.userData.assetId===1&&g.weapon.userData.assetId===11,'same actual original device/player source binding');
  check(g.heldCube===null||g.heldCube===refs.cargo,'held object is the same original companion');
  check(g.assets.size===loaded.length&&loaded.every(([id,root])=>g.assets.get(id)===root),'same actual native decoded assets');
  check(g.renderer.domElement===canvas&&canvas.width===1280&&canvas.height===720&&canvas.toDataURL===encoder&&g.renderer.getPixelRatio()===pixelRatio&&JSON.stringify(g.quality)===quality&&!g.renderer.getContext().isContextLost(),'same production WebGL buffer/quality and live context');
  for(const r of meshes){
   check(r.mesh.geometry===r.geometry&&r.mesh.material===r.material&&r.mesh.skeleton===r.skeleton&&r.mesh.getVertexPosition===r.getVertexPosition&&r.mesh.bindMatrix===r.bindMatrix&&r.mesh.bindMatrixInverse===r.bindMatrixInverse&&r.geometry.index===r.index&&r.geometry.index?.array===r.indexArray,'same original model owner/index');
   if(!full)continue;
   check((r.skeleton?.bones.length??0)===r.bones.length&&(r.skeleton?.boneInverses.length??0)===r.inverses.length&&r.bones.every((bone,i)=>r.skeleton.bones[i]===bone)&&r.inverses.every((inverse,i)=>r.skeleton.boneInverses[i]===inverse),'same skeleton binding owners');
   check(r.geometry.attributes===r.attributeOwner&&r.geometry.morphAttributes===r.morphOwner&&JSON.stringify(Object.keys(r.geometry.attributes).sort())===JSON.stringify(r.attributeKeys)&&JSON.stringify(Object.keys(r.geometry.morphAttributes).sort())===JSON.stringify(r.morphKeys)&&r.morphKeys.every(key=>r.geometry.morphAttributes[key]===r.morphLists[key]&&r.geometry.morphAttributes[key].length===r.morphCounts[key])&&r.geometry.morphTargetsRelative===r.morphTargetsRelative,'complete original attribute/morph key and count inventory');
   check(JSON.stringify(r.geometry.index?[r.geometry.index.count,r.geometry.index.itemSize,r.geometry.index.normalized,r.geometry.index.array.constructor.name,r.geometry.index.array.byteOffset,r.geometry.index.array.byteLength]:null)===JSON.stringify(r.indexDescriptor),'same complete index descriptor');
   for(const a of r.attributes){const part=a.name.split(':'),n=part[0]==='$morph'?r.geometry.morphAttributes[part[1]][Number(part[2])]:r.geometry.attributes[a.name];check(n===a.a&&n.data===a.data&&Boolean(n.isInterleavedBufferAttribute)===a.interleaved&&(n.array??n.data?.array)===a.array&&n.count===a.count&&n.itemSize===a.itemSize&&n.normalized===a.normalized&&n.data?.stride===a.stride&&n.offset===a.offset,'same original attribute/morph descriptor');}
  }
  if(full)for(const r of materialOwners){
   check(r.m.onBeforeCompile===r.onBeforeCompile&&r.m.customProgramCacheKey===r.key&&r.m.clippingPlanes===r.clippingOwner&&JSON.stringify(materialState(r.m))===r.state,'same original model material callbacks/scalars/colors/render flags');
   check(JSON.stringify(Object.keys(r.m).filter(key=>key==='map'||key.endsWith('Map')).sort())===JSON.stringify(r.maps.map(row=>row.key)),'same original material map inventory');
   for(const map of r.maps){const texture=r.m[map.key];check(texture===map.texture&&texture?.source===map.source&&texture?.image===map.image,'same original map/decoded image owners');if(texture)check(JSON.stringify(textureKeys.map(name=>[name,texture[name]??null]))===map.flags&&JSON.stringify(['offset','repeat','center'].map(name=>[name,texture[name]?.toArray?.()??null]))===map.vectors,'same original texture flags/UV transform');}
  }
  for(const [key,list]of Object.entries({camera:g.cameraBlockers,aim:g.aimBlockers,panels:g.portalPanels}))check(list.length===query[key].length&&list.every((mesh,i)=>mesh===query[key][i]),'same room32 query member owners '+key);
  check(g.colliders.length===query.colliders.length&&g.colliders.every((c,i)=>c===query.colliders[i].c&&c.mesh===query.colliders[i].mesh),'same room32 collider owners; moving boxes/poses may evolve normally');
  if(inFlight&&g.input.getMove!==inputMove){if(!adapter)adapter={getMove:g.input.getMove,respawn:g.respawn,resetCargo:g.physics.resetCargo};check(g.input.getMove===adapter.getMove&&g.respawn===adapter.respawn&&g.physics.resetCargo===adapter.resetCargo,'same temporary shipped V8 input/forwarding adapter');}
  else check(g.input.getMove===inputMove,'original input provider restored');
  for(const slot of slots){const forwarded=inFlight&&adapter&&g.input.getMove===adapter.getMove&&slot.kind==='v8-forward';check(slot.owner[slot.key]===(forwarded?adapter[slot.key]:slot.wrapper),'same guarded method '+slot.key);}
  check(Object.values(resetCalls).every(n=>n===0)&&g.teleportCount===0,'zero actor/level resets and zero canonical observer teleports');
 }
 function decodedAssets(){return loaded.map(([id,root])=>{const meshRids=[];let positionVertices=0;root.traverse(mesh=>{if(mesh.isMesh){const rid=meshes.findIndex(r=>r.mesh===mesh);check(rid>=0,'positive decoded-source membership');meshRids.push(rid);positionVertices+=mesh.geometry.attributes.position.count;}});return{id,rootUuid:root.uuid,meshRids,positionVertices};});}
 function snapshot(){return{id:g.firstLevel.id,index:g.levelIndex,state:g.state,step:refs.world.stepnumber,time:refs.world.time,elapsed:g.elapsed,visualTime:g.visualTime,player:v(g.playerPosition),playerVelocity:v(g.playerVelocity),cargo:v(g.cargo.position),cargoBodyPosition:v(body.position),cargoQuaternion:v(body.quaternion),cargoVelocity:v(body.velocity),held:Boolean(g.heldCube),teleports:g.teleportCount,cargoTransports:g.physics.portalTransports,companionBehavior:behavior.state,frictionObservations:{...frictionObservations},behaviorCalls,yaw:g.yaw,pitch:g.pitch,camera:{p:v(g.camera.position),q:v(g.camera.quaternion),fov:g.camera.fov,aspect:g.camera.aspect,near:g.camera.near,far:g.camera.far,obstructed:g.cameraRig.obstructed},viewport:{width:canvas.width,height:canvas.height},quality:{...g.quality},modelRoles:{...roles},modelMembership:meshes.map((r,rid)=>({rid,roles:[...r.roles],positionVertices:r.geometry.attributes.position.count})),physicalCargo:{bodyId:body.id,shapeId:shape.id,mass:body.mass,half:v(shape.halfExtents),shapeOffset:v(physical.offset),shapeOrientation:v(physical.orientation),friction:body.material.friction,restitution:body.material.restitution},decodedAssets:decodedAssets(),mechanism:{raw:[...g.firstLevel.optics.raw],shadow:[...g.firstLevel.optics.shadow],valid:g.firstLevel.optics.valid,latched:g.firstLevel.optics.latched,diaphragm:g.firstLevel.diaphragm.progress,inspectionCover:g.firstLevel.access.progress},resetCalls:{...resetCalls},counts:{...counts}};}
 // LabCompanionBehavior intentionally sets friction to zero only while walking
 // or performing its short clearance shuffle. Observe the original update in
 // its actual playing call, instead of treating this behavior as tampering.
 replace(behavior,'update',original=>function(dt,options){
  check(inPhysics&&inFlight&&this===behavior&&dt===1/120,'original behavior runs inside the ordinary physical step');
  const result=original.call(this,dt,options),walking=behavior.state==='wandering',shuffle=behavior.state==='getting_up'&&behavior.standGoal!==null;
  check(!(options.held&&(walking||shuffle)),'held original companion never walks or shuffles');
  check(body.material.friction===((walking||shuffle)?0:1),'friction follows the original walking/clearance state');
  expectedFriction=body.material.friction;behaviorCalls++;frictionObservations[walking?'wandering':shuffle?'clearanceShuffle':'normal']++;
  return result;
 });
 replace(g,'updatePlaying',original=>function(dt){
  check(inFlight&&!inPhysics&&dt===1/120&&g.state==='playing'&&!g.externalBlocked&&!document.hidden,'normal fixed120Hz playing pipeline');owners();check(counts.physics<limits.maxPhysicsSteps,'bounded physics steps');
  const step=refs.world.stepnumber,elapsed=g.elapsed,calls=behaviorCalls;let value;
  try{inPhysics=true;value=original.call(this,dt);}finally{inPhysics=false;}
  counts.physics++;check(behaviorCalls===calls+1,'exactly one original companion behavior update per physics step');
  check(!g.cargoLaunchFrictionSuppress,'room32 route has no launch-friction bypass');
  check(refs.world.stepnumber===step+1&&Math.abs(g.elapsed-elapsed-dt*1000)<1e-6,'one real physical step/millisecond clock');owners();return value;
 });
 replace(g,'updateVisuals',original=>function(dt,alpha,cameraDt){check(inFlight&&dt===1/60&&alpha===1&&(cameraDt===undefined||cameraDt===dt),'normal reviewed60Hz visual pipeline/current ordinary camera');owners();check(counts.visual<limits.maxVisualFrames,'bounded visual frames');const step=refs.world.stepnumber,elapsed=g.elapsed;const value=original.apply(this,arguments);counts.visual++;check(refs.world.stepnumber===step&&g.elapsed===elapsed&&Math.abs(g.visualTime-baseVisualTime-counts.visual/60)<1e-6,'visual update does not add physics and uses seconds');owners();return value;});
 replace(g,'interact',original=>function(...args){owners();const held=Boolean(g.heldCube);counts.interact++;const value=original.apply(this,args);if(!held&&g.heldCube)counts.pickups++;if(held&&!g.heldCube)counts.releases++;owners();return value;});
 replace(g,'firePortal',original=>function(...args){owners();check(args[0]===0||args[0]===1,'normal charged portal slot');counts.portalRequests++;const value=original.apply(this,args);owners();return value;});
 const wanted=new Map([
  ['The original companion takes a freight aperture too low for its observer','01-freight-delivered'],
  ['A real cargo shadow separates the two height circuits','02-shadow-diaphragm'],
  ['A downstream physical ratchet retains the diaphragm before cargo retrieval','03-far-side-ratchet'],
  ['both at exit','04-final-won']
 ]);
 capture=function(mark){
  owners(true);const state=snapshot();milestones.push({name:mark.name,state});const key=wanted.get(mark.name);if(!key)return;
  check(!images.some(image=>image.key===key)&&images.length<4,'each requested waypoint exactly once');
  check(key==='04-final-won'?g.state==='won'&&g.firstLevel.isWon():g.state==='playing','real waypoint state/production WIN');
  const before=JSON.stringify(state),png=Reflect.apply(encoder,canvas,['image/png']);
  check(png.startsWith('data:image/png;base64,'),'original native canvas returned PNG');const payload=png.slice('data:image/png;base64,'.length);check(payload.length%4===0&&/^[A-Za-z0-9+/]+={0,2}$/.test(payload),'complete bounded base64 PNG');
  const bytes=payload.length/4*3-(payload.endsWith('==')?2:payload.endsWith('=')?1:0);check(bytes>1024&&bytes<=limits.maxSinglePngBytes&&captureBytes+bytes<=limits.maxPngBytes,'native PNG byte limits');
  owners(true);check(JSON.stringify(snapshot())===before,'synchronous native readback/PNG encoding advances no physical, visual or ordinary-camera clock');
  captureBytes+=bytes;images.push({key,name:mark.name,state,png,pngBytes:bytes,capture:'Original production WebGL canvas.toDataURL(image/png), synchronously after shipped g.render; canvas only, no DOM HUD'});
 };
 Object.defineProperty(window,'__NESI_CAPTURE_LEVEL_MARK__',{value:capture,writable:true,configurable:true,enumerable:false});captureInstalled=true;
 async function buffers(){check(!inFlight,'full original bytes only before/after canonical route');owners(true);const before=JSON.stringify(snapshot()),rows=[];for(const [rid,r]of meshes.entries())for(const a of [...r.attributes,...(r.indexArray?[{name:'$index',array:r.indexArray}]:[])]){const bytes=new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength),digest=await crypto.subtle.digest('SHA-256',bytes);rows.push({rid,attribute:a.name,bytes:bytes.byteLength,sha256:[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')});}owners(true);check(JSON.stringify(snapshot())===before,'asynchronous buffer hashing advances no stopped-route clocks');return rows;}
 function restore(){if(restored)return{restored:true};const errors=[];check(!inFlight,'never restore during route');for(const slot of [...slots].reverse()){try{check(slot.owner[slot.key]===slot.wrapper,'guard ownership before restore '+slot.key);if(slot.descriptor)Object.defineProperty(slot.owner,slot.key,slot.descriptor);else delete slot.owner[slot.key];check(slot.owner[slot.key]===slot.original,'original method restored '+slot.key);}catch(error){errors.push(String(error));}}
  try{if(captureInstalled){check(window.__NESI_CAPTURE_LEVEL_MARK__===capture,'capture owner before restore');delete window.__NESI_CAPTURE_LEVEL_MARK__;captureInstalled=false;}if(inputMoveDescriptor)Object.defineProperty(g.input,'getMove',inputMoveDescriptor);else delete g.input.getMove;check(g.input.getMove===inputMove,'exact original input descriptor/provider');}catch(error){errors.push(String(error));}
  check(errors.length===0,'all restoration completed: '+errors.join('; '));restored=true;return{restored:true,methods:slots.length,inputProviderRestored:true,captureSlotRestored:true};
 }
 const initial=snapshot();owners(true);
 Object.assign(window.__QA_ROOM32_ROUTE__,{read:()=>{owners(true);return snapshot();},buffers,restore,evidence:()=>({milestones,images,counts:{...counts},resetCalls:{...resetCalls},partialEvidenceOnly:true,wonObserved:g.state==='won'}),
  async run(){check(!started,'one complete canonical route, no retry or partial reset');owners(true);started=true;inFlight=true;let journey;try{check(window.__NESI_RUN_LEVEL_ROUTE__===hook,'same shipped hook');journey=await hook({nativeStart:true,route:'freight-before-light'});}finally{inFlight=false;}
   owners(true);check(journey.pass===true&&journey.resets===0&&journey.respawns===0&&g.state==='won'&&g.firstLevel.isWon()&&g.heldCube===refs.cargo,'complete natural production WIN with zero resets');
   check(refs.world.stepnumber===counts.physics&&Math.abs(refs.world.time-counts.physics/120)<1e-6,'complete physical-step clock inventory');
   check(counts.interact===4&&counts.pickups===2&&counts.releases===1&&counts.portalRequests===3&&g.physics.portalTransports>=1,'canonical actual E/charged-shot/cargo transport actions');
   check(images.length===4&&wanted.size===4&&[...wanted.values()].every(key=>images.some(image=>image.key===key)),'three intermediate original-camera images and same-task terminal WON PNG');
   return{journey,initial,final:snapshot(),milestones,images,counts:{...counts},resetCalls:{...resetCalls},scope:'Causal original-companion friction checks each physics step; model/physics ownership every step and complete immutable material/attribute descriptors at boundaries/milestones; typed-buffer SHA before/after. Unchanged shipped canonical route; actual updatePlaying120Hz/updateVisuals60Hz; native rendering at existing milestones/final only. Simulated fast QA, no device FPS/GPU timing/full-video or whole-room aesthetic acceptance.'};
  }});
 return initial;
}
