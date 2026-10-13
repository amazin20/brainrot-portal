import assert from 'node:assert/strict';
import {createFoundation20NativeCameraObserverApi} from './foundation20-native-camera-observer.mjs';

/** Validates actual capture provenance and finite geometry diagnostics, not
 * pixel visibility or camera acceptance. Castle records cannot enter here. */
export function expandFoundation20NativeCameraObservation(report,{sourceIdentity}={}) {
 assert.equal(report?.kind,'foundation20-native-camera-observation-v1');
 const api=createFoundation20NativeCameraObserverApi(sourceIdentity??report.sourceIdentity);
 assert.deepEqual(report.sourceIdentity,api.PINS);api.validateEncoding(report.recordEncoding);
 assert.equal(report.recordEncoding.constants.sourceCommit,api.PINS.sourceCommit);
 assert.deepEqual(report.recordEncoding.meshDictionary,report.identity.meshes);
 assert.deepEqual(report.recordEncoding.boneDictionary,report.identity.boneDictionary);
 assert.equal(report.recordEncoding.constants.appearanceSha256,report.identity.initialAppearanceSha256);
 assert.equal(report.identity.initialAppearanceSha256,report.identity.finalAppearanceSha256);
 return {...report,records:report.records.map(row=>api.expandRecord(row,report.recordEncoding))};
}
export function assertFoundation20NativeCameraObservation(report,{sourceIdentity,nativeReport,telemetry}={}) {
 const bytes=Buffer.byteLength(JSON.stringify(report))+1;
 assert.ok(bytes<=25000000,'Complete native20 camera file exceeds25M');assert.equal(report.outputJSONBytes,bytes);
 assert.equal(report.runtimeObserved,true);assert.equal(report.accepted,false);assert.equal(report.cameraAccepted,false);
 assert.equal(report.nativeOpticalAccepted,false);assert.equal(report.allRenderFramesObserved,false);assert.equal(report.pixelOcclusionAccepted,false);
 assert.equal(report.producerMeasuredOriginalVertices,true);assert.equal(report.independentIndexedSkinReconstruction,false);
 assert.equal(report.meshFlagEligibilityOnly,true);assert.equal(report.unsupportedClippingRefused,true);
 const expanded=expandFoundation20NativeCameraObservation(report,{sourceIdentity});
 const api=createFoundation20NativeCameraObserverApi(sourceIdentity??report.sourceIdentity);
 assert.equal(report.scope,api.scope,'Exact bounded native20 diagnostic scope');
 assert.deepEqual(report.config,api.normalizeOptions(report.config));
 assert.deepEqual(report.recordEncoding.constants.nativeCanvas,{width:report.config.width,height:report.config.height});
 const id=report.identity;assert.equal(id.playerVertices,96753);assert.equal(id.bones,15);assert.equal(id.boneDictionary.length,15);
 assert.equal(id.meshes.reduce((n,m)=>n+m.vertices,0),96753);assert.equal(id.sameOriginalActorAndSkinAndLoadedAssets,true);
 assert.equal(id.runtimeLoadedModelCount,id.loadedAssetModels.length);assert.ok(id.runtimeLoadedModelCount>0);
 assert.equal(id.packageRuntimeGLBCount,14);assert.equal(id.packageModelBytesExternallyPinned,true);
 assert.match(id.initialAppearanceSha256,/^[a-f0-9]{64}$/);assert.equal(id.authoredMaterialIdentity.pass,true);
 assert.ok(Array.isArray(telemetry)&&telemetry.length===expanded.records.length,'Every actual encoder frame telemetry required');
 assert.ok(nativeReport&&nativeReport.route?.pass===true,'Actual native physical report required');
 assert.equal(nativeReport.sourceCommit,report.sourceIdentity.sourceCommit);assert.deepEqual(nativeReport.sourceReview,report.sourceIdentity.sourceReview);
 assert.equal(nativeReport.nativePackage.packageFilesSha256,report.sourceIdentity.packageFilesSha256);
 assert.equal(nativeReport.route.id,'foundation-portal-tension');assert.equal(nativeReport.route.level,20);assert.equal(nativeReport.route.edition,'foundation');
 assert.equal(nativeReport.video.frames,expanded.records.length);assert.equal(nativeReport.video.fps,4);assert.equal(nativeReport.video.stride,15);
 assert.equal(nativeReport.video.width,report.config.width);assert.equal(nativeReport.video.height,report.config.height);
 assert.equal(report.observedFrames,nativeReport.route.frames);assert.equal(report.driverRouteFrameCount,nativeReport.route.frames);assert.equal(report.finalLoopFrameIndex,nativeReport.route.frames-1);assert.equal(report.finalClock.visualFrame,nativeReport.route.frames-1);
 assert.equal(report.finalClock.routePhysicsSteps,nativeReport.route.physicsSteps);assert.equal(report.finalClock.routeSeconds,nativeReport.route.seconds);
 const offset=report.finalClock.worldStepOffset;let terminal=false;
 const finiteTuple=(x,n,label)=>assert.ok(Array.isArray(x)&&x.length===n&&x.every(Number.isFinite),label);
 const keyset=(x,keys,label)=>{assert.ok(x&&typeof x==='object'&&!Array.isArray(x),label);assert.deepEqual(Object.keys(x).sort(),[...keys].sort(),label+' full keys');};
 const product=(a,b)=>Array.from({length:16},(_,i)=>{const row=i%4,column=Math.floor(i/4);return [0,1,2,3].reduce((sum,k)=>sum+a[k*4+row]*b[column*4+k],0);});
 const projection=(p,expectedVertices,camera,allowedMeshes)=>{assert.ok(p&&Number.isSafeInteger(p.vertices)&&p.vertices>0);if(expectedVertices!==undefined)assert.equal(p.vertices,expectedVertices);
  for(const k of ['minX','maxX','minY','maxY','minDepth','maxDepth'])assert.ok(Number.isFinite(p[k]),'Finite actual '+k);
  for(const k of ['outsideLensCount','behindCount','nearCount'])assert.ok(Number.isSafeInteger(p[k])&&p[k]>=0&&p[k]<=p.vertices);
  assert.ok(p.minX<=p.maxX&&p.minY<=p.maxY&&p.minDepth<=p.maxDepth,'Ordered full projection ranges');
  assert.equal(p.insideLens,p.outsideLensCount===0);assert.ok(p.behindCount<=p.nearCount&&p.nearCount<=p.outsideLensCount,'Behind/near/outside count consistency');
  assert.equal(p.behindCount===0,p.minDepth>0,'Behind count/minimum depth consistency');assert.equal(p.nearCount===0,p.minDepth>camera.near,'Near count/minimum depth consistency');
  if(p.outsideLensCount===0)assert.ok(p.minX>=-1&&p.maxX<=1&&p.minY>=-1&&p.maxY<=1&&p.behindCount===0&&p.nearCount===0,'Zero outside contradicts full projection extrema');
  for(const [k,w]of Object.entries(p.extremaWitnesses)){finiteTuple(w.world,3,'world witness');finiteTuple(w.ndc,3,'NDC witness');assert.ok(Number.isFinite(w.depth));const actual=k==='minDepth'||k==='maxDepth'?w.depth:w.ndc[k.endsWith('X')?0:1];assert.equal(actual,p[k]);
   assert.ok(allowedMeshes.has(w.meshUuid),'Witness belongs to another projection mesh scope');
   assert.ok(w.ndc[0]>=p.minX&&w.ndc[0]<=p.maxX&&w.ndc[1]>=p.minY&&w.ndc[1]<=p.maxY&&w.depth>=p.minDepth&&w.depth<=p.maxDepth,'Witness outside declared extrema ranges');
   if(p.outsideLensCount===0)assert.ok(w.depth>camera.near&&w.ndc.every(v=>v>=-1&&v<=1),'Zero outside contradicts actual extrema witness');
   const apply=(m,v)=>[0,1,2,3].map(i=>m[i]*v[0]+m[4+i]*v[1]+m[8+i]*v[2]+m[12+i]*v[3]);
   const view=apply(camera.matrixWorldInverse,[...w.world,1]),clip=apply(camera.projection,view);assert.ok(Math.abs(-view[2]-w.depth)<1e-7,'Actual witness camera depth');assert.ok(w.ndc.every((v,i)=>Math.abs(v-clip[i]/clip[3])<1e-7),'Actual witness world/lens/NDC');
  }
  const outsideWitness=Object.values(p.extremaWitnesses).some(w=>w.depth<=camera.near||w.ndc.some(v=>v<-1||v>1));
  assert.equal(p.outsideLensCount===0,!outsideWitness,'Outside count/extrema consistency');
 };
 for(const [i,row]of expanded.records.entries()){
  const t=telemetry[i],b=row.encodedBinding;assert.equal(t.index,i);assert.equal(b.encodedFrame,i);assert.equal(b.visualFrame,t.state.visualFrame);
  assert.equal(b.driverFrame,t.state.frame);assert.equal(b.worldStep,t.state.worldStep);assert.equal(b.routeSeconds,t.state.seconds);assert.equal(b.state,t.state.state);assert.equal(b.terminal,t.terminal);
  assert.equal(row.worldStep-row.routePhysicsSteps,offset);assert.equal(row.worldStepOffset,offset);
  assert.equal(row.routeSeconds,row.routePhysicsSteps/120);assert.ok(row.routePhysicsSteps>0);
  assert.ok(row.routePhysicsSteps===2*(b.visualFrame+1)||(i===expanded.records.length-1&&row.state==='won'&&row.routePhysicsSteps===2*b.visualFrame+1),'Bound actual visual/physics step count');
  assert.equal(row.state,t.state.state);assert.deepEqual(row.player,t.state.player);assert.deepEqual(row.cargo,t.state.cargo);
  if(b.terminal){assert.equal(terminal,false);assert.equal(i,expanded.records.length-1);assert.equal(b.state,'won');assert.equal(b.visualFrame,nativeReport.route.frames-1);assert.ok(b.visualFrame<i*15&&i*15-b.visualFrame<15);terminal=true;}
  else assert.equal(b.visualFrame,i*15);
  const c=row.camera;for(const k of ['eye','up'])finiteTuple(c[k],3,k);finiteTuple(c.quaternion,4,'quaternion');
  keyset(c,['eye','quaternion','up','fov','aspect','near','far','matrixWorld','matrixWorldInverse','projection','projectionInverse','rig'],'actual full lens');
  keyset(c.rig,['vectors','springs','flags','clipping'],'actual full rig');
  keyset(c.rig.vectors,['focus','focusVelocity','goal','lastTarget','playerPivot','desired','lookPoint','forward','right','viewUp','boomDirection','avoidance','avoidanceVelocity'],'actual rig vectors');
  keyset(c.rig.springs,['yaw','pitch','yawVelocity','pitchVelocity','distance','distanceVelocity','fovVelocity','aimBlend','aimBlendVelocity','upwardBackoff','upwardBackoffVelocity','epicFraming','epicFramingVelocity'],'actual rig springs');
  keyset(c.rig.flags,['fullBodyFraming','confinedFraming','foundation20Framing','inclinedFraming','obstructed','avoidanceActive','portalFramingActive','rampFraming'],'actual rig flags');
  keyset(row.controls,['yaw','pitch','aimHeld'],'actual controls');assert.ok(Number.isFinite(row.controls.yaw)&&Number.isFinite(row.controls.pitch));assert.equal(typeof row.controls.aimHeld,'boolean');
  for(const k of ['matrixWorld','matrixWorldInverse','projection','projectionInverse'])finiteTuple(c[k],16,k);
  for(const k of ['fov','near','far','aspect'])assert.ok(Number.isFinite(c[k]));assert.ok(c.fov>0&&c.fov<=120&&c.near>0&&c.far>c.near);
  const norm=q=>q.reduce((sum,v)=>sum+v*v,0);assert.ok(Math.abs(norm(c.quaternion)-1)<1e-7,'Unit actual lens quaternion');assert.ok(Math.abs(norm(c.up)-1)<1e-7,'Unit actual lens up');
  assert.ok(Math.abs(c.aspect-report.config.width/report.config.height)<1e-8);for(const v of Object.values(c.rig.vectors))finiteTuple(v,3,'rig vector');
  for(const [a,z]of [[c.matrixWorld,c.matrixWorldInverse],[c.projection,c.projectionInverse]])assert.ok(product(a,z).every((x,j)=>Math.abs(x-(j%5===0?1:0))<1e-7),'Actual lens inverse relation');
  assert.ok(c.eye.every((x,j)=>Math.abs(x-c.matrixWorld[12+j])<1e-7),'Actual eye/world translation');
  const tan=Math.tan(c.fov*Math.PI/360);assert.ok(Math.abs(c.projection[0]-1/(tan*c.aspect))<1e-7&&Math.abs(c.projection[5]-1/tan)<1e-7,'Actual FOV/projection relation');
  const canonical=[1/(tan*c.aspect),0,0,0,0,1/tan,0,0,0,0,-(c.far+c.near)/(c.far-c.near),-1,0,0,-2*c.far*c.near/(c.far-c.near),0];
  assert.ok(c.projection.every((v,j)=>Math.abs(v-canonical[j])<1e-7),'Full canonical actual perspective');
  const [x,y,z,w]=c.quaternion,rotation=[1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w),0,2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w),0,2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y),0,...c.eye,1];
  assert.ok(c.matrixWorld.every((v,j)=>Math.abs(v-rotation[j])<1e-7),'Actual lens quaternion/world pose');
  for(const x of Object.values(c.rig.springs))assert.ok(Number.isFinite(x));for(const x of Object.values(c.rig.flags))assert.equal(typeof x,'boolean');
  assert.equal(row.bones.length,15);for(const bone of row.bones){finiteTuple(bone.position,3,'bone position');finiteTuple(bone.quaternion,4,'bone Q');finiteTuple(bone.scale,3,'bone scale');finiteTuple(bone.matrixWorld,16,'bone world');assert.ok(Math.abs(norm(bone.quaternion)-1)<1e-7,'Unit original bone quaternion');assert.ok(bone.scale.every(v=>Math.abs(v)>1e-9),'Nonzero original bone scale');assert.ok([3,7,11].every(j=>Math.abs(bone.matrixWorld[j])<1e-7)&&Math.abs(bone.matrixWorld[15]-1)<1e-7,'Affine original bone world');}
  assert.equal(row.skinMatrices.length,id.meshes.filter(m=>m.skinned).length);for(const skin of row.skinMatrices){const mesh=id.meshes.find(m=>m.meshUuid===skin.meshUuid);assert.ok(mesh?.skinned);const n=mesh.bones*16,size=Math.max(4,Math.ceil(Math.sqrt(mesh.bones*4)/4)*4);assert.ok([n,size*size*4].includes(skin.boneMatrices.length));finiteTuple(skin.boneMatrices,skin.boneMatrices.length,'actual GPU skin cache');assert.ok(skin.boneMatrices.slice(n).every(x=>x===0),'Actual existing GPU padding');}
  projection(row.projection,96753,c,new Set(id.meshes.map(m=>m.meshUuid)));const mainMesh=id.meshes.find(m=>m.meshUuid===id.mainBodyMeshUuid);assert.ok(mainMesh?.skinned&&mainMesh.vertices===69777);projection(row.mainBodyProjection,mainMesh.vertices,c,new Set([mainMesh.meshUuid]));
  const eligibleMeshes=row.eligibility.filter(m=>m.renderEligible),eligible=eligibleMeshes.reduce((n,m)=>n+m.vertices,0);if(eligible)projection(row.eligibleProjection,eligible,c,new Set(eligibleMeshes.map(m=>m.meshUuid)));else assert.equal(row.eligibleProjection,null);
  assert.deepEqual(c.rig.clipping,[],'Unsupported main clipping planes');assert.deepEqual(row.clipping.mainPlanes,[]);assert.equal(row.clipping.unsupportedClippingRefused,true);assert.equal(row.clipping.meshFlagEligibilityOnly,true);
  keyset(row.clipping,['mainPlanes','playerMaterials','unsupportedClippingRefused','meshFlagEligibilityOnly'],'clipping snapshots');
  assert.equal(row.clipping.playerMaterials.length,id.meshes.length);for(const [j,mesh]of row.clipping.playerMaterials.entries()){assert.equal(mesh.meshUuid,id.meshes[j].meshUuid);assert.ok(Array.isArray(mesh.materials)&&mesh.materials.length>0);for(const material of mesh.materials){assert.equal(typeof material.materialUuid,'string');assert.deepEqual(material.planes,[],'Unsupported player material clipping planes');assert.equal(typeof material.clipIntersection,'boolean');}}
  for(const m of row.eligibility)assert.equal(m.renderEligible,m.objectVisible&&m.materialVisible&&m.layerMatch);
  assert.equal(row.materialProvenance.pass,true);keyset(row.readPurity,['physicalStateUnchanged','lensAndLocalAppearancePoseUnchanged','preparedMatricesUnchanged','noForcedMatrixSkeletonRenderOrPhysicsUpdates'],'complete read purity');for(const v of Object.values(row.readPurity))assert.equal(v,true);
  for(const k of ['vertices','minX','maxX','minY','maxY','minDepth','maxDepth','outsideLensCount','behindCount','nearCount','requiredFov','halfWidth','halfHeight'])assert.ok(Number.isFinite(row.conservativeEnvelope[k]));
  assert.equal(row.conservativeEnvelope.vertices,8);assert.ok([.65,.85,1.35].includes(row.conservativeEnvelope.halfWidth));assert.equal(row.conservativeEnvelope.halfHeight,1.52);
 }
 assert.equal(terminal,nativeReport.video.terminalSample);const last=expanded.records.at(-1);assert.equal(last.encodedBinding.visualFrame,nativeReport.video.lastVisualFrame);
 assert.deepEqual(report.finalClock,{visualFrame:last.encodedBinding.visualFrame,worldStep:last.worldStep,worldStepOffset:last.worldStepOffset,routePhysicsSteps:last.routePhysicsSteps,routeSeconds:last.routeSeconds,state:last.state},'Final clock is the actual last expanded capture clock');
 return {diagnosticVerified:true,samples:expanded.records.length,allOriginalSamplesInsideLens:expanded.records.every(r=>r.projection.insideLens&&r.projection.outsideLensCount===0&&r.projection.behindCount===0&&r.projection.nearCount===0),allEligibleSamplesInsideLens:expanded.records.every(r=>!r.eligibleProjection||(r.eligibleProjection.insideLens&&r.eligibleProjection.behindCount===0&&r.eligibleProjection.nearCount===0)),independentIndexedSkinReconstruction:false,meshFlagEligibilityOnly:true,unsupportedClippingRefused:true,cameraAccepted:false,scope:report.scope};
}
