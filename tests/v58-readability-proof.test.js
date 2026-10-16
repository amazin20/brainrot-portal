import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
 assertVisibleRole,assertCausalReadability,CAUSAL_CAPTURE,CAUSAL_HARNESS_FILES,
} from '../scripts/lib/v58-readability-proof.mjs';
import {ROOM25_OPEN_SCOPES} from '../scripts/lib/room25-native-proof.mjs';

// Small synthetic validator controls, never evidence of a native recording.
const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const clone=value=>structuredClone(value);
const BODY=7,SHAPE=8;
const ROOM_PHASES=['loaded-support','lit-gallery','dark-return','relight-ascent'];
const MILESTONES=[
 'retargeted portal removes current freight mirror supply and gravity returns the original support',
 'ordinary lower-floor portal restores light and raises the same original load',
 'first optical receiver raised the loaded counterweight onto a physical balcony',
 'balcony retrieval reverses both linked shadows without a cargo portal',
 'reverse overlook reveals the starting room',
];

function visibleRole(role='moving-mirror'){
 const points=[[100.5,100.5],[108.5,100.5],[100.5,108.5],[108.5,108.5],[116.5,100.5]];
 const samples=points.map((pixel,i)=>{
  const target={meshUUID:role+'-actual-mesh',instanceId:null,faceIndex:i,materialIndex:0,distance:4.2,worldPoint:[i*.1,1,-4],cameraDepth:4};
  return {pixel,ndc:[0,0],target,firstHit:i<3?clone(target):{...clone(target),meshUUID:'original-opaque-player',distance:2},firstHitIsTarget:i<3,uncertain:false,reasons:[]};
 });
 return {role,targetMeshUUIDs:[role+'-actual-mesh'],bboxPixels:{minX:80,minY:80,maxX:180,maxY:160,width:100,height:80},gridStepPixels:8,
  projectedFootprintPixelsEstimate:4000,projectedSamples:5,firstHitTargetSamples:3,visibleFraction:3/5,samples,
  uncertain:{frameUnsupported:false,samples:0,reasons:[]}};
}

function roomRoute(){
 const physicsSteps=20000,lastVisualFrame=10000,frames=lastVisualFrame+1,seconds=physicsSteps/120;
 return {kind:'room25-required-ordinary-input-diagnostic-route',edition:'foundation',level:25,index:24,id:'opposed-shadows',pass:true,complete:true,
  ...ROOM25_OPEN_SCOPES,resets:0,respawns:0,cargoResets:0,levelResets:0,machineResets:0,
  frames,lastVisualFrame,physicsSteps,seconds,postStepStart:0,postStepFinish:physicsSteps,firstStatePhysicsSteps:0,
  bodyId:BODY,shapeId:SHAPE,cargoMass:3.2,shots:6,interactions:6,jumpInputs:2,teleports:1,
  lastState:{state:'won',held:true,visualFrame:lastVisualFrame,physicsSteps,seconds,cargoBodyId:BODY,cargoShapeId:SHAPE},
  observed:{postSteps:physicsSteps,forceSamples:physicsSteps,lastWorldStep:physicsSteps,forceCountStart:0,forceCountFinish:physicsSteps,identityChecks:physicsSteps+frames,
   loadedContactSteps:1000,positiveMotorForceSteps:1000,movingMirrorReflectionSteps:1000,firstReceiverSteps:1000,secondReceiverSteps:1000,motorOffDescendingSteps:100,
   maxHeight:9,maxMotorPower:300,maxMotorForce:200,maxForceBalanceY:0,maxForceBalanceZ:0,maxDampingPower:0,
   externalMotorWorkStart:0,externalMotorWorkFinish:4000,activeShutterRackWorkFinish:100,
   twoLegacyPassengerLiftsKinematic:false,passengerLiftBodiesDynamic:true,passengerForceSamples:2*physicsSteps,passiveShutterTransmissionClaimed:false,
   passengerPositiveMotorSteps:[1000,1000],maxPassengerMotorPower:[500,500],maxPassengerMotorForce:[300,300]},
  milestones:MILESTONES.map((name,i)=>({name,cargoBodyId:BODY,cargoShapeId:SHAPE,cargoMass:3.2,physicsSteps:12000+i*1000,seconds:(12000+i*1000)/120}))};
}

function roomFixture(){
 const commit='a'.repeat(40),tree='b'.repeat(40),rows=[],phases=[],movieMetadataByClip={},inputs=[];
 const camera={position:[-2,3,8],quaternion:[0,0,0,1],fov:60,near:.1,far:100,aspect:960/540};
 for(const [phaseIndex,id] of ROOM_PHASES.entries()){
  const firstWorldStep=5000+phaseIndex*2000;
  const roleRequirements=id==='loaded-support'?['original-cargo','moving-mirror']:['moving-mirror','current-drive'];
  const local=[];
  for(let index=0;index<24;index++){
   const encodedFrame=rows.length,worldStep=firstWorldStep+index*10,visualFrame=worldStep/2;
   const height=id==='dark-return'?7.5-index*.02:id==='relight-ascent'?5.5+index*.02:6+phaseIndex;
   const currentLight=id!=='dark-return',motorEnabled=true,motorForce=currentLight?100:0,drive=currentLight&&motorEnabled&&motorForce>0;
   const physics={state:'playing',worldStep,bodyId:BODY,shapeId:SHAPE,currentLight,
    mechanism:{height,velocity:id==='dark-return'?-.4:.4,motorEnabled,lastForce:{motorForce}},
    instruments:{state:{currentLight,enabled:motorEnabled,drive},driveColor:drive?0xffedbb:0x283e43,currentLightColor:currentLight?0xffd27d:0x283e43},
    targetWorld:{mirror:[1,height+2,-4],cargo:[0,height,0],reference:[3,0,-4]}};
   const row={clipId:id,index,encodedFrame,visualFrame,worldStep,physics,camera:clone(camera),imageSha256:digest('jpeg-'+encodedFrame),visibility:null};
   if(CAUSAL_CAPTURE.visibilityKeyframes.includes(index))row.visibility={clock:{encodedFrame,visualFrame,worldStep,renderFrame:visualFrame+1},
    camera:{...clone(camera),canvas:{width:960,height:540},mainClippingPlanes:[]},roles:roleRequirements.map(visibleRole),
    readPurity:{unchanged:true,noRender:true,noPhysicsStep:true,noLensOrSceneWrites:true}};
   rows.push(row);local.push(row);
  }
  phases.push({id,roleRequirements,frames:24,firstWorldStep,lastWorldStep:local.at(-1).worldStep,
   clip:{path:'clips/'+id+'.mp4',frames:24,bytes:10000,sha256:digest('movie-'+id),fullMP4Decode:true,pixelCheck:{frames:24,allNonblank:true,minimumLuminanceRange:32}},
   keyframes:CAUSAL_CAPTURE.visibilityKeyframes.map(index=>({index,path:'stills/'+id+'-'+index+'.jpg',bytes:1000,sha256:local[index].imageSha256,encodedFrame:local[index].encodedFrame}))});
  movieMetadataByClip[id]={streams:[{codec_name:'h264',codec_type:'video',width:960,height:540,r_frame_rate:'12/1',nb_frames:'24',duration:'2.000000'}]};
  inputs.push({kind:'look',value:[1,6,-4],firstWorldStep:firstWorldStep-4,lastWorldStep:firstWorldStep-2},
   {kind:'wait',value:2,firstWorldStep:firstWorldStep-2,lastWorldStep:firstWorldStep+238});
 }
 for(let i=0;i<10;i++)inputs.push({kind:'walk',value:[-7,6],firstWorldStep:3000+i*2,lastWorldStep:3002+i*2});
 inputs.push({kind:'aim',value:[1,[-17,13.6,23]],accepted:true,firstWorldStep:8950,lastWorldStep:8994},{kind:'wait',value:1,firstWorldStep:9500,lastWorldStep:9620},{kind:'wait',value:5,firstWorldStep:12000,lastWorldStep:12600});
 for(const[i,slot]of [0,0,1].entries())inputs.push({kind:'aim',value:[slot,[9,3,16]],accepted:true,firstWorldStep:10000+i*100,lastWorldStep:10010+i*100});
 inputs.sort((a,b)=>a.firstWorldStep-b.firstWorldStep);
 const files=CAUSAL_HARNESS_FILES.map((path,i)=>({path,bytes:100+i,sha256:digest(path)}));
 const report={kind:'v58-causal-readability',case:'room25',pass:true,geometricVisibilityAccepted:true,humanAccepted:false,cameraAccepted:false,hardwareFPSMeasured:false,publicationAccepted:false,errors:[],
  capture:clone(CAUSAL_CAPTURE),sourceWorkingBytesUnchanged:true,controllerWorkingBytesUnchanged:true,
  source:{commit,tree,sourceInputsSha256:digest('source-inputs'),sourceReview:{runId:123456,runAttempt:1}},
  controller:{commit,tree,trackedWorkingTreeClean:true,files,filesSha256:digest(JSON.stringify(files))},
  package:{commit,buildInfoSha256:digest('build-info'),packageFilesSha256:digest('package-files'),fileCount:80},
  ui:{normalSpawn:true,worldStep:0,portalsReady:false,state:'playing',edition:'foundation',level:25,control:'native #play-button click'},
  renderer:{isWebGLRenderer:true,contextLost:false,version:'WebGL 2.0 (OpenGL ES 3.0 Chromium)',unmaskedRenderer:'ANGLE (Google, Vulkan SwiftShader Device)'},browser:{product:'HeadlessChrome/140.0.7339.0'},
  modelIdentity:{playerVertices:96753,playerBones:15,sameOriginalActorHandles:true,sameOriginalBuffers:true,sameOriginalCargoShape:true,cargoMass:3.2,
   initialGeometrySha256:digest('original-geometry'),finalGeometrySha256:digest('original-geometry'),observedFrames:10001,bodyId:BODY,shapeId:SHAPE},
  phases,telemetry:{path:'telemetry.jsonl',sha256:digest(rows.map(r=>JSON.stringify(r)).join('\n')),bytes:Buffer.byteLength(JSON.stringify(rows)),samples:rows.length},inputs,route:roomRoute()};
 report.route.actions=inputs.filter(i=>i.kind==='aim').map(i=>({kind:'portal-charge',index:i.value[0],point:[...i.value[1]],worldStep:i.lastWorldStep,impact:{valid:true}}));
 return {report,rows,movieMetadataByClip};
}
const validate=f=>assertCausalReadability(f.report,{rows:f.rows,movieMetadataByClip:f.movieMetadataByClip});
const keyRows=(f,phase='loaded-support')=>f.rows.filter(r=>r.clipId===phase&&r.visibility);
function rejectsMutation(name,mutate){test(name,()=>{const f=roomFixture();mutate(f);assert.throws(()=>validate(f));});}

test('three separated actual first-hit rays pass, including the correct rendered instance',()=>{
 const role=visibleRole();assert.equal(assertVisibleRole(role),true);
 for(const s of role.samples){s.target.instanceId=2;if(s.firstHitIsTarget)s.firstHit.instanceId=2;}
 assert.equal(assertVisibleRole(role),true);
});

test('first-hit mesh, target membership, instance and distance must match the actual target',async t=>{
 const mutations={
  'foreground actor advertised as target':r=>{r.samples[0].firstHit.meshUUID='original-player';},
  'wrong rendered instance':r=>{r.samples[0].firstHit.instanceId=1;},
  'hit belongs to an unregistered target mesh':r=>{r.targetMeshUUIDs=['different-target'];},
  'target is behind the reported first hit':r=>{r.samples[0].firstHit.distance-=.01;},
  'nonfinite distance':r=>{r.samples[0].target.distance=Infinity;r.samples[0].firstHit.distance=Infinity;},
 };
 for(const [name,mutate] of Object.entries(mutations))await t.test(name,()=>{const r=visibleRole();mutate(r);assert.throws(()=>assertVisibleRole(r));});
});

test('three hit records require three pairwise-separated screen locations',()=>{
 const r=visibleRole();r.samples=r.samples.slice(0,3);r.samples[2].pixel=clone(r.samples[0].pixel);r.projectedSamples=3;r.firstHitTargetSamples=3;r.visibleFraction=1;
 assert.throws(()=>assertVisibleRole(r),/separated/);
});

test('tiny or absent target footprints cannot claim readable screen occupancy',async t=>{
 const mutations={width:r=>{r.bboxPixels.width=7.99;},height:r=>{r.bboxPixels.height=7.99;},area:r=>{r.projectedFootprintPixelsEstimate=63.99;},missing:r=>{r.bboxPixels=null;},behindCamera:r=>{r.projectedSamples=0;r.firstHitTargetSamples=0;r.samples=[];r.visibleFraction=0;}};
 for(const [name,mutate]of Object.entries(mutations))await t.test(name,()=>{const r=visibleRole();mutate(r);assert.throws(()=>assertVisibleRole(r));});
});

test('nonfinite projected dimensions cannot satisfy an occupancy threshold',async t=>{
 for(const field of ['width','height','projectedFootprintPixelsEstimate'])await t.test(field,()=>{const r=visibleRole();if(field==='projectedFootprintPixelsEstimate')r[field]=Infinity;else r.bboxPixels[field]=Infinity;assert.throws(()=>assertVisibleRole(r));});
});

test('full original-actor occlusion and uncertain glass are rejected',()=>{
 const blocked=visibleRole();for(const s of blocked.samples){s.firstHitIsTarget=false;s.firstHit.meshUUID='original-opaque-player';s.firstHit.distance=2;}blocked.firstHitTargetSamples=0;blocked.visibleFraction=0;
 assert.throws(()=>assertVisibleRole(blocked));
 const glass=visibleRole();glass.samples[0].uncertain=true;glass.samples[0].reasons=['transparent-material'];assert.throws(()=>assertVisibleRole(glass));
 const clipped=visibleRole();clipped.uncertain.frameUnsupported=true;assert.throws(()=>assertVisibleRole(clipped));
});

test('aggregate visibility counts cannot replace measured, finite in-frame target hits',async t=>{
 const mutations={count:r=>{r.firstHitTargetSamples=4;},fraction:r=>{r.visibleFraction=.9;},length:r=>{r.projectedSamples=6;},pixel:r=>{r.samples[0].pixel[0]=960;},worldPoint:r=>{r.samples[0].target.worldPoint[1]=NaN;}};
 for(const [name,mutate]of Object.entries(mutations))await t.test(name,()=>{const r=visibleRole();mutate(r);assert.throws(()=>assertVisibleRole(r));});
});

test('complete synthetic Room25 contract validates four real-time clip windows and route',()=>{
 const f=roomFixture();assert.equal(f.rows.length,96);assert.equal(f.report.phases.length,4);assert.equal(validate(f),f.report);
});

test('one missed keyframe is tolerated but each role needs visibility on two independent keyframes',()=>{
 const f=roomFixture(),keys=keyRows(f);keys[0].visibility.roles=[];assert.equal(validate(f),f.report);
 keys[1].visibility.roles=[];assert.throws(()=>validate(f),/persistent role visibility/);
});

const headerMutations={
 'rejects a broader human acceptance claim':f=>{f.report.humanAccepted=true;},
 'rejects a publication acceptance claim':f=>{f.report.publicationAccepted=true;},
 'rejects unrecorded source or controller writes':f=>{f.report.sourceWorkingBytesUnchanged=false;},
 'rejects malformed source identity':f=>{f.report.source.commit='HEAD';},
 'rejects controller and source commit mismatch':f=>{f.report.controller.commit='c'.repeat(40);},
 'rejects package and source commit mismatch':f=>{f.report.package.commit='c'.repeat(40);},
 'rejects absent actual source review':f=>{delete f.report.source.sourceReview;},
 'rejects invalid source review run identity':f=>{f.report.source.sourceReview.runId=0;},
 'rejects a rerun source review attempt':f=>{f.report.source.sourceReview.runAttempt=2;},
 'rejects controller harness member deletion':f=>{f.report.controller.files.splice(2,1);},
 'rejects controller harness path substitution':f=>{f.report.controller.files[0].path='scripts/other-runner.mjs';},
 'rejects malformed harness content identity':f=>{f.report.controller.files[0].sha256='not-a-digest';},
 'rejects changed original player buffers':f=>{f.report.modelIdentity.sameOriginalBuffers=false;},
 'rejects changed original cargo shape':f=>{f.report.modelIdentity.sameOriginalCargoShape=false;},
 'rejects final actor geometry drift':f=>{f.report.modelIdentity.finalGeometrySha256=digest('replacement');},
 'rejects a nonordinary initial spawn':f=>{f.report.ui.worldStep=1;},
 'rejects phase reordering':f=>{[f.report.phases[0],f.report.phases[1]]=[f.report.phases[1],f.report.phases[0]];},
 'rejects the removed fourth clip':f=>{f.report.phases.pop();},
 'rejects a padded movie count':f=>{f.report.phases[0].clip.frames=25;},
 'rejects an unsafe movie artifact path':f=>{f.report.phases[0].clip.path='clips/../loaded-support.mp4';},
 'rejects incomplete MP4 decoding':f=>{f.report.phases[0].clip.fullMP4Decode=false;},
 'rejects blank encoded frames':f=>{f.report.phases[0].clip.pixelCheck.allNonblank=false;},
 'rejects mismatched telemetry count':f=>{f.report.telemetry.samples--;},
 'rejects repeated encoded-frame identity':f=>{f.rows[2].encodedFrame=1;},
 'rejects physics body substitution':f=>{f.rows[5].physics.bodyId++;},
 'rejects physics clock drift':f=>{f.rows[5].physics.worldStep++;},
 'rejects an off-stride visual frame':f=>{f.rows[5].visualFrame++;},
 'rejects a compressed clip physics window':f=>{f.report.phases[0].lastWorldStep--;},
 'rejects malformed image identity':f=>{f.rows[5].imageSha256='';},
 'rejects keyframe image SHA substitution':f=>{f.report.phases[0].keyframes[0].sha256=digest('other-image');},
 'rejects keyframe image and encoded-frame mismatch':f=>{f.report.phases[0].keyframes[0].encodedFrame++;},
 'rejects a missing retained keyframe':f=>{f.report.phases[0].keyframes.pop();},
 'rejects keyframe observer clock drift':f=>{keyRows(f)[0].visibility.clock.worldStep++;},
 'rejects keyframe camera pose substitution':f=>{keyRows(f)[0].visibility.camera.position[0]++;},
 'rejects a nonfinite keyframe render clock':f=>{keyRows(f)[0].visibility.clock.renderFrame=NaN;},
 'rejects hidden main clipping planes':f=>{keyRows(f)[0].visibility.camera.mainClippingPlanes=[{normal:[1,0,0],constant:0}];},
 'rejects an observer that changes the game':f=>{keyRows(f)[0].visibility.readPurity.noPhysicsStep=false;},
 'rejects inherited visibility on unmeasured frames':f=>{f.rows[1].visibility=clone(f.rows[0].visibility);},
 'rejects required role deletion from a phase':f=>{f.report.phases[0].roleRequirements.pop();},
 'rejects required role deletion from all keyframes':f=>{for(const row of keyRows(f))row.visibility.roles=row.visibility.roles.filter(r=>r.role!=='original-cargo');},
 'rejects replacing waits with direct state setters':f=>{f.report.inputs.find(i=>i.kind==='wait').kind='setState';},
 'rejects an ordinary wait with a false duration':f=>{f.report.inputs.find(i=>i.kind==='wait').value=0;},
 'rejects route reset or respawn':f=>{f.report.route.respawns++;},
 'rejects route cargo identity mismatch':f=>{f.report.route.bodyId++;},
 'rejects missing physical route milestones':f=>{f.report.route.milestones.pop();},
 'rejects a static body pretending to be a gravity return':f=>{for(const r of f.rows.filter(r=>r.clipId==='dark-return')){r.physics.mechanism.height=7.5;r.physics.targetWorld.mirror[1]=9.5;}},
 'rejects dark gravity without loss of current light':f=>{for(const r of f.rows.filter(r=>r.clipId==='dark-return')){r.physics.currentLight=true;r.physics.instruments.state.currentLight=true;r.physics.instruments.currentLightColor=0xffd27d;}},
 'rejects relight without actual upward motion':f=>{for(const r of f.rows.filter(r=>r.clipId==='relight-ascent'))r.physics.mechanism.velocity=0;},
 'rejects a drive indicator disconnected from physical motor force':f=>{f.rows[5].physics.instruments.state.drive=false;},
 'rejects a current-light indicator with a false material color':f=>{f.rows[5].physics.instruments.currentLightColor=0xffedbb;},
 'rejects a moving supposed fixed reference':f=>{f.rows[5].physics.targetWorld.reference[1]++;},
 'rejects camera-only apparent mirror motion':f=>{f.rows[5].physics.targetWorld.mirror[1]++;},
 'rejects visible stopped dark keys when only unmeasured rows contain the falling event':f=>{for(const r of keyRows(f,'dark-return'))r.physics.mechanism.velocity=0;},
 'rejects visible stopped relight keys when only unmeasured rows contain the rising event':f=>{for(const r of keyRows(f,'relight-ascent'))r.physics.mechanism.velocity=0;},
};
for(const [name,mutate]of Object.entries(headerMutations))rejectsMutation(name,mutate);

test('clip clocks retain the actual two physics steps per visual frame at every interval',()=>{
 const f=roomFixture();f.rows[5].worldStep++;f.rows[5].physics.worldStep++;
 assert.throws(()=>validate(f));
});

test('ordinary observation input provenance rejects unmapped controls, clock rewinds and forged charges',async t=>{
 const mutations={
  'unavailable clear command':f=>{f.report.inputs.find(i=>i.kind==='aim').kind='clear';},
  'direct pair deletion alias':f=>{f.report.inputs.find(i=>i.kind==='aim').kind='clearPortals';},
  'out-of-order clock':f=>{f.report.inputs[2].firstWorldStep=0;},
  'wait with invented simulation steps':f=>{f.report.inputs.find(i=>i.kind==='wait').lastWorldStep++;},
  'nonfinite ordinary walking target':f=>{f.report.inputs.find(i=>i.kind==='walk').value[0]=NaN;},
  'walking pose instead of xz input':f=>{f.report.inputs.find(i=>i.kind==='walk').value=[0,9,0];},
  'unavailable portal slot':f=>{f.report.inputs.find(i=>i.kind==='aim').value[0]=2;},
  'rejected real charged shot':f=>{f.report.inputs.find(i=>i.kind==='aim').accepted=false;},
  'invented charged shot clock':f=>{f.report.inputs.find(i=>i.kind==='aim').lastWorldStep--;},
  'charged target differs from production action':f=>{f.report.inputs.find(i=>i.kind==='aim').value[1][0]+=.1;},
  'missing actual portal charge action':f=>{f.report.route.actions=[];},
  'unlogged cut and restore sequence':f=>{f.report.inputs=f.report.inputs.filter(i=>i.kind!=='aim');},
 };
 for(const[name,mutate]of Object.entries(mutations))await t.test(name,()=>{const f=roomFixture();mutate(f);assert.throws(()=>validate(f));});
});

test('visibility uses the same rendered camera lens as its bound image',async t=>{
 for(const field of ['fov','near','far','aspect'])await t.test(field,()=>{const f=roomFixture();keyRows(f)[0].visibility.camera[field]+=.01;assert.throws(()=>validate(f));});
});

test('ffprobe must describe exactly one full-resolution 12fps two-second h264 stream',async t=>{
 const mutations={codec:m=>{m.streams[0].codec_name='mpeg4';},audio:m=>{m.streams.push({codec_type:'audio'});},width:m=>{m.streams[0].width=640;},height:m=>{m.streams[0].height=360;},fps:m=>{m.streams[0].r_frame_rate='24/1';},frameCount:m=>{m.streams[0].nb_frames='23';},duration:m=>{m.streams[0].duration='1.9';}};
 for(const [name,mutate]of Object.entries(mutations))await t.test(name,()=>{const f=roomFixture();mutate(f.movieMetadataByClip['loaded-support']);assert.throws(()=>validate(f));});
});
