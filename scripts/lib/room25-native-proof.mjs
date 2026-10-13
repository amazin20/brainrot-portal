import assert from 'node:assert/strict';
export const ROOM25_SOURCE=Object.freeze({commit:'5ccb9d9c3a9a55aad036e06379cdce76a8b10359',tree:'642b0e0cc5d4f131047bf7c0a24eafff788b155d',baseline:'5e552e9c3ac248b535d619741f15e99e29979cbf',branch:'research/room25-continuous-required-20261013'});
export const ROOM25_CAPTURE=Object.freeze({fps:4,stride:15,width:640,height:360});
export const ROOM25_BOUNDS=Object.freeze({physicsSteps:36000,movieBytes:64000000,jpegWireBytes:64000000,telemetryBytes:25000000,metadataBytes:25000000,artifactBytes:150000000});
export const ROOM25_OPEN_SCOPES=Object.freeze({productionAccepted:false,sourceCiAccepted:false,nativeAccepted:false,publicationAccepted:false,fullRoomAccepted:false,humanAccepted:false,allBypassesAccepted:false});
const sha=s=>assert.match(s,/^[a-f0-9]{64}$/),integer=(v,min=0)=>assert.ok(Number.isSafeInteger(v)&&v>=min),finite=v=>assert.ok(Number.isFinite(v));
export function assertRoom25RuntimeRenderer(renderer,browser){
 assert.match(browser.product,/^(?:HeadlessChrome|Chrome)\/\d+(?:\.\d+){3}$/);assert.match(browser.userAgent,/\b(?:HeadlessChrome|Chrome)\/\d+/);
 assert.equal(renderer.isWebGLRenderer,true);assert.equal(renderer.contextLost,false);assert.match(renderer.version,/WebGL/);
 assert.equal(renderer.debugRendererInfoAvailable,true,'Actual unmasked WebGL renderer required');assert.equal(typeof renderer.unmaskedVendor,'string');assert.ok(renderer.unmaskedVendor.length>0);
 assert.match(renderer.unmaskedRenderer,/ANGLE/i);assert.match(renderer.unmaskedRenderer,/SwiftShader/i,'Actual software renderer must match the requested native diagnostic environment');
 return true;
}
export function assertRoom25Route(r){
 assert.equal(r.kind,'room25-required-ordinary-input-diagnostic-route');assert.equal(r.edition,'foundation');assert.equal(r.level,25);assert.equal(r.index,24);assert.equal(r.id,'opposed-shadows');assert.equal(r.pass,true);assert.equal(r.complete,true);
 for(const[k,v]of Object.entries(ROOM25_OPEN_SCOPES))assert.equal(r[k],v,'Broader acceptance outside diagnostic scope: '+k);
 for(const k of ['resets','respawns','cargoResets','levelResets','machineResets'])assert.equal(r[k],0,'Actual route reset: '+k);
 integer(r.frames,100);integer(r.lastVisualFrame,99);assert.equal(r.frames,r.lastVisualFrame+1);integer(r.physicsSteps,20000);assert.ok(r.physicsSteps<=ROOM25_BOUNDS.physicsSteps);
 assert.ok(r.physicsSteps===r.lastVisualFrame*2||r.physicsSteps===r.lastVisualFrame*2-1);assert.equal(r.seconds,r.physicsSteps/120);assert.equal(r.postStepFinish-r.postStepStart,r.physicsSteps);assert.equal(r.firstStatePhysicsSteps,0);
 integer(r.bodyId);integer(r.shapeId);assert.equal(r.cargoMass,3.2);integer(r.shots,6);integer(r.interactions,6);integer(r.jumpInputs,2);assert.equal(r.teleports,1);
 assert.equal(r.lastState.state,'won');assert.equal(r.lastState.held,true);assert.equal(r.lastState.visualFrame,r.lastVisualFrame);assert.equal(r.lastState.physicsSteps,r.physicsSteps);assert.equal(r.lastState.seconds,r.seconds);assert.equal(r.lastState.cargoBodyId,r.bodyId);assert.equal(r.lastState.cargoShapeId,r.shapeId);
 const o=r.observed;assert.equal(o.postSteps,r.physicsSteps);assert.equal(o.forceSamples,r.physicsSteps);assert.equal(o.lastWorldStep,r.postStepFinish);assert.equal(o.forceCountFinish-o.forceCountStart,r.physicsSteps);integer(o.identityChecks,r.physicsSteps+r.frames);
 for(const k of ['loadedContactSteps','positiveMotorForceSteps','movingMirrorReflectionSteps','firstReceiverSteps','secondReceiverSteps'])integer(o[k],101);integer(o.motorOffDescendingSteps,21);
 finite(o.maxHeight);assert.ok(o.maxHeight>8.95&&o.maxHeight<9.1);finite(o.maxMotorPower);assert.ok(o.maxMotorPower>0&&o.maxMotorPower<=400+1e-8);finite(o.maxMotorForce);assert.ok(o.maxMotorForce>0&&o.maxMotorForce<=260+1e-8);
 for(const k of ['maxForceBalanceY','maxForceBalanceZ','maxDampingPower']){finite(o[k]);assert.ok(o[k]<=1e-8);}
 finite(o.externalMotorWorkFinish);finite(o.externalMotorWorkStart);assert.ok(o.externalMotorWorkFinish-o.externalMotorWorkStart>3000);finite(o.activeShutterRackWorkFinish);assert.ok(o.activeShutterRackWorkFinish>0);
 assert.equal(o.twoLegacyPassengerLiftsKinematic,true);assert.equal(o.passiveShutterTransmissionClaimed,false);
 const names=r.milestones.map(m=>m.name);for(const name of ['retargeted portal removes current freight mirror supply and gravity returns the original support','ordinary lower-floor portal restores light and raises the same original load','first optical receiver raised the loaded counterweight onto a physical balcony','balcony retrieval reverses both linked shadows without a cargo portal','reverse overlook reveals the starting room'])assert.equal(names.filter(n=>n===name).length,1);
 for(const m of r.milestones){assert.equal(m.cargoBodyId,r.bodyId);assert.equal(m.cargoShapeId,r.shapeId);assert.equal(m.cargoMass,3.2);assert.equal(m.seconds,m.physicsSteps/120);assert.ok(m.physicsSteps<=r.physicsSteps);}
 return r;
}
export function assertRoom25CaptureRows(rows,route){
 assertRoom25Route(route);const c=ROOM25_CAPTURE,regular=Math.floor(route.lastVisualFrame/c.stride)+1,terminal=route.lastVisualFrame%c.stride!==0;
 assert.equal(rows.length,regular+(terminal?1:0));for(const[index,row]of rows.entries()){
  assert.equal(row.index,index);assert.equal(Boolean(row.terminal),terminal&&index===rows.length-1);const s=row.state;
  assert.equal(s.visualFrame,row.terminal?route.lastVisualFrame:index*c.stride);assert.equal(s.worldStep,route.postStepStart+s.physicsSteps);assert.equal(s.seconds,s.physicsSteps/120);
  assert.ok(s.physicsSteps===s.visualFrame*2||row.terminal&&s.physicsSteps===s.visualFrame*2-1);assert.equal(s.cargoBodyId,route.bodyId);assert.equal(s.cargoShapeId,route.shapeId);assert.equal(s.cargoMass,3.2);assert.equal(s.cargoDynamic,true);assert.equal(s.edition,'foundation');assert.equal(s.level,25);assert.equal(s.id,route.id);
  if(index===0){assert.equal(s.visualFrame,0);assert.equal(s.physicsSteps,0);assert.equal(s.state,'playing');}if(index===rows.length-1){assert.equal(s.state,'won');assert.equal(s.physicsSteps,route.physicsSteps);}
  for(const v of Object.values(s.resetCounts))assert.equal(v,0);
 }
 return rows;
}
export function assertRoom25NativeDiagnostic(report,{binding,rows,movieMetadata}={}){
 assert.equal(report.kind,'actual-room25-required-native-browser-diagnostic');assert.equal(report.pass,true);assert.equal(report.nativeRecordingCompleted,true);
 for(const[k,v]of Object.entries(ROOM25_OPEN_SCOPES))assert.equal(report[k],v);assert.equal(report.cameraAccepted,false);assert.equal(report.hardwareFPSMeasured,false);assert.equal(report.allRenderFramesMeasured,false);
 assert.equal(report.source.commit,ROOM25_SOURCE.commit);assert.equal(report.source.tree,ROOM25_SOURCE.tree);assert.deepEqual(report.source,binding.source);assert.deepEqual(report.controller,binding.controller);assert.deepEqual(report.package,binding.package);
 assert.equal(report.sourceWorkingBytesUnchanged,true);assert.equal(report.controllerWorkingBytesUnchanged,true);assertRoom25RuntimeRenderer(report.renderer,report.browser);
 assert.equal(report.ui.control,'native #play-button click');assert.equal(report.ui.normalSpawn,true);assert.equal(report.ui.worldStep,0);assert.equal(report.ui.portalsReady,false);assert.equal(report.ui.edition,'foundation');assert.equal(report.ui.level,25);assert.equal(report.ui.id,'opposed-shadows');assert.equal(report.ui.state,'playing');
 assert.deepEqual(report.capture,ROOM25_CAPTURE);assert.equal(report.method,'actual production WebGL canvas readback at every declared capture interval plus a real off-stride terminal; no padded or substituted frames');
 assertRoom25Route(report.route);assertRoom25CaptureRows(rows,report.route);
 const v=report.video;integer(v.bytes,1);assert.ok(v.bytes<=ROOM25_BOUNDS.movieBytes);sha(v.sha256);assert.equal(v.filename,'room25-required.mp4');assert.equal(v.frames,rows.length);assert.equal(v.fps,4);assert.equal(v.width,640);assert.equal(v.height,360);assert.equal(v.durationSeconds,v.frames/4);assert.equal(v.simulationSeconds,report.route.seconds);assert.ok(Math.abs(v.durationSeconds-report.route.seconds)<=.5);assert.equal(v.fullMP4Decode,true);
 assert.equal(v.first.visualFrame,0);assert.deepEqual(v.first,rows[0].state);assert.deepEqual(v.last,rows.at(-1).state);
 const streams=movieMetadata.streams;assert.equal(streams.length,1);assert.equal(streams[0].codec_type,'video');assert.equal(streams[0].codec_name,'h264');assert.equal(Number(streams[0].nb_frames),rows.length);assert.equal(streams[0].width,640);assert.equal(streams[0].height,360);assert.equal(streams[0].r_frame_rate,'4/1');assert.ok(Math.abs(Number(streams[0].duration)-rows.length/4)<1e-6);
 assert.equal(v.pixelCheck.frames,rows.length);assert.equal(v.pixelCheck.allNonblank,true);assert.ok(v.pixelCheck.minimumLuminanceRange>12);sha(v.pixelCheck.sha256);integer(v.pixelCheck.bytes,1);
 assert.equal(report.telemetry.samples,rows.length);integer(report.telemetry.bytes,1);assert.ok(report.telemetry.bytes<=ROOM25_BOUNDS.telemetryBytes);sha(report.telemetry.sha256);assert.equal(report.telemetry.filename,'room25-telemetry.jsonl');
 const model=report.modelIdentity;assert.equal(model.playerVertices,96753);assert.equal(model.playerBones,15);assert.equal(model.sameOriginalActorHandles,true);assert.equal(model.sameOriginalBuffers,true);assert.equal(model.sameOriginalCargoShape,true);assert.equal(model.cargoMass,3.2);assert.deepEqual(model.cargoHalfExtents,[.39,.39,.39]);sha(model.initialGeometrySha256);assert.equal(model.finalGeometrySha256,model.initialGeometrySha256);assert.equal(model.observedVisualFrames,report.route.frames);assert.equal(model.materialIdentity.originalActorHandles,2);integer(model.materialIdentity.invocations,report.route.frames);
 assert.deepEqual(report.errors,[]);return report;
}
