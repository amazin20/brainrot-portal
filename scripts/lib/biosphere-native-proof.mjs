import assert from 'node:assert/strict';

export const BIOSPHERE_CAPTURE=Object.freeze({fps:12,stride:5,width:640,height:360});
export const BIOSPHERE_VIEWPORTS=Object.freeze({
 landscape:BIOSPHERE_CAPTURE,
 portrait:Object.freeze({fps:12,stride:5,width:390,height:844}),
 classic:Object.freeze({fps:12,stride:5,width:800,height:600}),
});
/** The viewport is an explicit release case, never an arbitrary producer option.
 * Changed chapter films retain the original640x360 contract. Only room17 gets
 * the three independently named, full normal-Play viewport observations. */
export function biosphereCapture(room,viewport='landscape'){
 assert.ok(Number.isInteger(room)&&(room===17||room>=21&&room<=30),'Exact biosphere or camera17 room required');
 assert.ok(typeof viewport==='string'&&Object.hasOwn(BIOSPHERE_VIEWPORTS,viewport),'Exact native viewport allowlist required');
 assert.ok(room===17||viewport==='landscape','Other chapter rooms retain the original landscape capture');
 return BIOSPHERE_VIEWPORTS[viewport];
}
export const BIOSPHERE_BOUNDS=Object.freeze({visualFrames:18000,physicsSteps:36000,movieBytes:40000000,jpegWireBytes:120000000,telemetryBytes:12000000,metadataBytes:8000000,artifactBytes:80000000});
export const BIOSPHERE_OPEN_SCOPES=Object.freeze({sourceCiAccepted:false,nativeAccepted:false,publicationAccepted:false,fullChapterAccepted:false,humanAccepted:false,allBypassesAccepted:false});
export const BIOSPHERE_HARNESS_FILES=Object.freeze([
 'scripts/qa-biosphere-native.mjs','scripts/lib/biosphere-native-proof.mjs','tests/biosphere-native-proof.test.js',
 'scripts/lib/native-portal-material-identity.mjs','scripts/lib/singularity-ui-check.mjs','scripts/lib/release-manifest.mjs','scripts/lib/frozen-campaign-server.mjs',
]);
export const BIOSPHERE_NATIVE_HARNESS_FILES=BIOSPHERE_HARNESS_FILES;
const integer=(v,min=0)=>assert.ok(Number.isSafeInteger(v)&&v>=min),sha=v=>assert.match(v,/^[a-f0-9]{64}$/),finiteVector=(v,n)=>{assert.equal(v.length,n);assert.ok(v.every(Number.isFinite));};

/** Independently check a complete declared route and its exact native cadence.
 * Mechanism snapshots are retained as observations; a phase count is never
 * substituted for the current production isWon predicate. */
export function assertBiosphereCaptureRows(rows,route){
 assert.ok(Number.isInteger(route.level)&&(route.level===17||route.level>=21&&route.level<=30),'Exact biosphere or camera17 route required');assert.equal(route.index,route.level-1);assert.equal(route.edition,'foundation');
 assert.equal(route.kind,'biosphere-complete-ordinary-input-native-route');assert.equal(route.pass,true);assert.equal(route.complete,true);
 for(const[k,v]of Object.entries(BIOSPHERE_OPEN_SCOPES))assert.equal(route[k],v);
 assert.equal(route.initialState.state,'playing');assert.equal(route.initialState.visualFrame,0);assert.equal(route.initialState.worldStep,0);assert.equal(route.initialState.physicsSteps,0);
 integer(route.lastVisualFrame,1);assert.ok(route.lastVisualFrame<=BIOSPHERE_BOUNDS.visualFrames);assert.equal(route.frames,route.lastVisualFrame+1);
 integer(route.physicsSteps,1);assert.ok(route.physicsSteps<=BIOSPHERE_BOUNDS.physicsSteps);assert.ok(route.physicsSteps===route.lastVisualFrame*2||route.physicsSteps===route.lastVisualFrame*2-1);
 assert.equal(route.postStepStart,0);assert.equal(route.postStepFinish,route.physicsSteps);assert.equal(route.observed.postSteps,route.physicsSteps);assert.equal(route.seconds,route.physicsSteps/120);
 assert.equal(route.observed.visualUpdates,route.lastVisualFrame);integer(route.observed.identityChecks,route.physicsSteps+route.frames);
 for(const k of ['resetRun','respawn','resetCargo','levelReset'])assert.equal(route.resetCounts[k],0,'Native complete route may not reset: '+k);
 assert.equal(route.driver.pass,true);assert.equal(route.driver.level,route.level);assert.equal(route.driver.id,route.id);assert.equal(route.driver.frames,route.lastVisualFrame);assert.equal(route.driver.resets,0);assert.equal(route.driver.respawns,0);
 integer(route.bodyId);integer(route.shapeId);assert.equal(route.cargoMass,3.2);assert.equal(route.lastState.state,'won');assert.equal(route.lastState.actualProductionWinPredicate,true);
 const terminal=route.lastVisualFrame%BIOSPHERE_CAPTURE.stride!==0;
 assert.equal(rows.length,Math.floor(route.lastVisualFrame/BIOSPHERE_CAPTURE.stride)+1+(terminal?1:0));
 for(const [i,row]of rows.entries()){
  assert.equal(row.index,i);assert.equal(row.terminal,terminal&&i===rows.length-1);const s=row.state;
  assert.equal(s.visualFrame,row.terminal?route.lastVisualFrame:i*BIOSPHERE_CAPTURE.stride);assert.equal(s.worldStep,s.physicsSteps);assert.equal(s.seconds,s.physicsSteps/120);
  assert.ok(s.physicsSteps===s.visualFrame*2||i===rows.length-1&&s.physicsSteps===s.visualFrame*2-1);
  assert.equal(s.level,route.level);assert.equal(s.id,route.id);assert.equal(s.edition,'foundation');assert.equal(s.cargoBodyId,route.bodyId);assert.equal(s.cargoShapeId,route.shapeId);assert.equal(s.cargoMass,3.2);assert.equal(s.cargoDynamic,true);
  assert.ok(i===rows.length-1?s.state==='won':s.state==='playing');assert.equal(s.actualProductionWinPredicate,i===rows.length-1);
  for(const k of Object.keys(route.resetCounts))assert.equal(s.resetCounts[k],0);
  finiteVector(s.player,3);finiteVector(s.cargo,3);finiteVector(s.cargoVelocity,3);finiteVector(s.cargoQuaternion,4);finiteVector(s.camera,3);finiteVector(s.cameraQuaternion,4);assert.ok(Number.isFinite(s.cameraFov));
  assert.ok(s.mechanisms&&typeof s.mechanisms==='object');
 }
 assert.deepEqual(rows[0].state,route.initialState);assert.deepEqual(rows.at(-1).state,route.lastState);return rows;
}

/** Provider IDs use GitHub's full positive safe-integer range, independently
 * of finite simulation/frame budgets. Source review and capture may differ. */
export function assertBiosphereRunProvenance(value){
 for(const name of ['sourceReview','captureRun','providerRun']){
  const run=value?.[name];assert.ok(run&&Number.isSafeInteger(run.runId)&&run.runId>0&&Number.isSafeInteger(run.runAttempt)&&run.runAttempt>0,'Explicit positive safe-integer '+name+' run/attempt required');
 }
 assert.match(value.providerRun.commit,/^[a-f0-9]{40}$/);assert.equal(value.providerRun.runId,value.captureRun.runId);assert.equal(value.providerRun.runAttempt,value.captureRun.runAttempt);
 return value;
}

export function assertBiosphereNativeDiagnostic(report,{binding,rows,movieMetadata}={}){
 assert.equal(report.kind,'actual-biosphere-complete-native-browser-diagnostic');assert.equal(report.pass,true);assert.equal(report.nativeRecordingCompleted,true);
 for(const[k,v]of Object.entries(BIOSPHERE_OPEN_SCOPES))assert.equal(report[k],v);
 for(const k of ['humanPlaytest','hardwareFPSMeasured','allRenderFramesMeasured','cameraAccepted'])assert.equal(report[k],false);
 assertBiosphereRunProvenance(report);assertBiosphereRunProvenance(binding);for(const name of ['sourceReview','captureRun','providerRun'])assert.deepEqual(report[name],binding[name]);assert.equal(report.captureRun.runId,report.controller.runId);assert.equal(report.captureRun.runAttempt,report.controller.runAttempt);
 assert.deepEqual(report.source,binding.source);assert.deepEqual(report.controller,binding.controller);assert.deepEqual(report.package,binding.package);
 assert.match(report.source.commit,/^[a-f0-9]{40}$/);assert.match(report.source.tree,/^[a-f0-9]{40}$/);assert.equal(report.sourceWorkingBytesUnchanged,true);assert.equal(report.controllerWorkingBytesUnchanged,true);assert.equal(report.completeServedPackageVerified,true);
 assert.equal(typeof report.captureViewport,'string');const capture=biosphereCapture(report.route.level,report.captureViewport);assert.equal(report.captureViewport,binding.captureViewport);assert.deepEqual(report.capture,capture);assert.deepEqual(binding.capture,capture);assert.deepEqual(report.captureBounds,BIOSPHERE_BOUNDS);assertBiosphereCaptureRows(rows,report.route);
 const level=report.route.level,tag=String(level).padStart(2,'0'),ui=report.ui;
 assert.equal(ui.control,'native #play-button click');assert.equal(ui.normalSpawn,true);assert.equal(ui.normalCargoSpawn,true);assert.equal(ui.elapsed,0);assert.equal(ui.worldStep,0);assert.equal(ui.portalsReady,false);assert.equal(ui.teleports,0);assert.equal(ui.edition,'foundation');assert.equal(ui.level,level);assert.equal(ui.id,report.route.id);assert.equal(ui.state,'playing');
 for(const [actual,expected,distance]of [[ui.playerPosition,ui.expectedPlayerSpawn,ui.playerSpawnDistance],[ui.cargoPosition,ui.expectedCargoSpawn,ui.cargoSpawnDistance]]){finiteVector(actual,3);finiteVector(expected,3);assert.equal(distance,Math.hypot(...actual.map((n,i)=>n-expected[i])));assert.ok(distance<1e-8);}
 assert.match(report.browser.product,/^(?:HeadlessChrome|Chrome)\/\d+(?:\.\d+){3}$/);assert.match(report.browser.userAgent,/\b(?:HeadlessChrome|Chrome)\/\d+/);
 const renderer=report.renderer;assert.equal(renderer.isWebGLRenderer,true);assert.equal(renderer.contextLost,false);assert.match(renderer.version,/WebGL/);assert.equal(renderer.debugRendererInfoAvailable,true);assert.equal(typeof renderer.unmaskedVendor,'string');assert.ok(renderer.unmaskedVendor.length>0);assert.match(renderer.unmaskedRenderer,/ANGLE/i);assert.match(renderer.unmaskedRenderer,/SwiftShader/i);
 const v=report.video;integer(v.bytes,1);assert.ok(v.bytes<=BIOSPHERE_BOUNDS.movieBytes);sha(v.sha256);assert.equal(v.filename,`room-${tag}-full.mp4`);assert.equal(v.frames,rows.length);assert.equal(v.fps,12);assert.equal(v.width,capture.width);assert.equal(v.height,capture.height);assert.equal(v.durationSeconds,rows.length/12);assert.equal(v.simulationSeconds,report.route.seconds);assert.ok(Math.abs(v.durationSeconds-v.simulationSeconds)<=1/6);assert.equal(v.fullMP4Decode,true);assert.equal(v.terminalCaptured,rows.at(-1).terminal);assert.deepEqual(v.first,rows[0].state);assert.deepEqual(v.last,rows.at(-1).state);
 const streams=movieMetadata.streams;assert.equal(streams.length,1);const stream=streams[0];assert.equal(stream.codec_type,'video');assert.equal(stream.codec_name,'h264');assert.equal(stream.width,capture.width);assert.equal(stream.height,capture.height);assert.equal(stream.r_frame_rate,'12/1');assert.equal(Number(stream.nb_frames),rows.length);assert.ok(Math.abs(Number(stream.duration)-rows.length/12)<.00001);
 assert.equal(v.pixelCheck.frames,rows.length);assert.equal(v.pixelCheck.allNonblank,true);assert.ok(v.pixelCheck.minimumLuminanceRange>12);sha(v.pixelCheck.sha256);integer(v.pixelCheck.bytes,1);
 const t=report.telemetry;assert.equal(t.filename,`room-${tag}-telemetry.jsonl`);assert.equal(t.samples,rows.length);integer(t.bytes,1);assert.ok(t.bytes<=BIOSPHERE_BOUNDS.telemetryBytes);sha(t.sha256);
 const model=report.modelIdentity;assert.equal(model.playerVertices,96753);assert.equal(model.playerBones,15);assert.equal(model.cargoMass,3.2);assert.deepEqual(model.cargoHalfExtents,[.39,.39,.39]);for(const k of ['sameOriginalActorHandles','sameOriginalBuffers','sameOriginalCargoShape'])assert.equal(model[k],true);sha(model.initialGeometrySha256);assert.equal(model.finalGeometrySha256,model.initialGeometrySha256);assert.equal(model.observedVisualFrames,report.route.frames);assert.equal(model.materialIdentity.originalActorHandles,2);integer(model.materialIdentity.invocations,report.route.frames);
 assert.equal(report.keyframes.length,3);const expectedIndices=[Math.floor((rows.length-1)*.25),Math.floor((rows.length-1)*.6),rows.length-1];
 for(const[i,k]of report.keyframes.entries()){assert.equal(k.filename,`room-${tag}-keyframe-${String(i+1).padStart(2,'0')}.png`);assert.equal(k.encodedFrame,expectedIndices[i]);assert.equal(k.visualFrame,rows[k.encodedFrame].state.visualFrame);assert.equal(k.movieSha256,v.sha256);assert.equal(k.width,capture.width);assert.equal(k.height,capture.height);integer(k.bytes,1);sha(k.sha256);}
 assert.deepEqual(report.errors,[]);return report;
}
