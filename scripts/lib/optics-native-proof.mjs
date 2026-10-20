import assert from 'node:assert/strict';

export const OPTICS_CAPTURE=Object.freeze({fps:12,stride:5,width:640,height:360});
export const OPTICS_VIEWPORTS=Object.freeze({
 landscape:OPTICS_CAPTURE,
});
/** The ten independent Optics films retain one exact landscape contract. */
export function opticsCapture(room,viewport='landscape'){
 assert.ok(Number.isInteger(room)&&room>=31&&room<=40,'Exact Optics31–40 room required');
 assert.ok(typeof viewport==='string'&&Object.hasOwn(OPTICS_VIEWPORTS,viewport),'Exact native viewport allowlist required');
 return OPTICS_VIEWPORTS[viewport];
}
/** Declare desktop input before navigation; the observer never resizes the
 * renderer or camera to make a capture fit. */
export function opticsBrowserProfile(room,viewport='landscape'){
 const capture=opticsCapture(room,viewport);
 return Object.freeze({width:capture.width,height:capture.height,deviceScaleFactor:1,isMobile:false,hasTouch:false});
}
export function assertOpticsViewportObservation(value,{room,viewport}={}){
 const profile=opticsBrowserProfile(room,viewport);
 assert.ok(value&&typeof value==='object','Actual browser viewport observation required');
 for(const key of ['innerWidth','containerWidth','canvasWidth'])assert.equal(value[key],profile.width,'Actual '+key+' differs from exact native viewport');
 for(const key of ['innerHeight','containerHeight','canvasHeight'])assert.equal(value[key],profile.height,'Actual '+key+' differs from exact native viewport');
 assert.equal(value.devicePixelRatio,1);assert.equal(value.rendererPixelRatio,1);assert.equal(value.cameraAspect,profile.width/profile.height);
 for(const key of ['pointerCoarse','pointerFine','pointerNone'])assert.equal(typeof value[key],'boolean');
 assert.equal(value.pointerCoarse,profile.hasTouch,'Actual pointer mode differs from native browser profile');
 assert.ok(Number.isSafeInteger(value.maxTouchPoints)&&value.maxTouchPoints>=0);
 if(profile.hasTouch){assert.equal(value.pointerFine,false);assert.equal(value.pointerNone,false);assert.ok(value.maxTouchPoints>0);}
 else{assert.ok(value.pointerFine!==value.pointerNone);assert.equal(value.maxTouchPoints,0);}
 return value;
}
export const OPTICS_BOUNDS=Object.freeze({visualFrames:18000,physicsSteps:36000,movieBytes:40000000,jpegWireBytes:120000000,telemetryBytes:12000000,metadataBytes:8000000,artifactBytes:80000000});
export const OPTICS_OPEN_SCOPES=Object.freeze({sourceCiAccepted:false,nativeAccepted:false,publicationAccepted:false,fullChapterAccepted:false,humanAccepted:false,allBypassesAccepted:false});
export const OPTICS_HARNESS_FILES=Object.freeze([
 'scripts/qa-optics-native.mjs','scripts/lib/optics-native-proof.mjs','tests/optics-native-proof.test.js',
 'scripts/lib/native-portal-material-identity.mjs','scripts/lib/singularity-ui-check.mjs','scripts/lib/release-manifest.mjs','scripts/lib/frozen-campaign-server.mjs',
 'scripts/qa-campaign-platform-route.mjs','scripts/qa-browser-capture.mjs','scripts/lib/campaign-access-fixture.mjs','scripts/lib/campaign-preferences-fixture.mjs',
 'scripts/lib/yandex-debug-checker.mjs','scripts/lib/yandex-review-sdk.mjs',
 'qa/vendor/yandex-games-debug-checker/debugcheck.js','qa/vendor/yandex-games-debug-checker/LICENSE','qa/vendor/yandex-games-debug-checker/upstream.json',
]);
export const OPTICS_NATIVE_HARNESS_FILES=OPTICS_HARNESS_FILES;
const integer=(v,min=0)=>assert.ok(Number.isSafeInteger(v)&&v>=min),sha=v=>assert.match(v,/^[a-f0-9]{64}$/),finiteVector=(v,n)=>{assert.equal(v.length,n);assert.ok(v.every(Number.isFinite));};

export function opticsMediaMembers(room){
 opticsCapture(room);const tag=String(room).padStart(2,'0');
 return ['binding.json','served-package.json','native-browser.json','native-ui-play.json',`room-${tag}-full.mp4`,`room-${tag}-telemetry.jsonl`,`room-${tag}-native-pixels.log`,
  ...[1,2,3].map(n=>`room-${tag}-keyframe-${String(n).padStart(2,'0')}.png`),'optics-native-report.json','ffprobe.json','closed-media-member-inventory.json'].sort();
}
export function assertOpticsMediaMembers(names,room,{beforeInventory=false}={}){
 const expected=opticsMediaMembers(room).filter(name=>!beforeInventory||name!=='closed-media-member-inventory.json');
 assert.deepEqual([...names].sort(),expected,'Exact closed Optics media membership required');return names;
}
export function assertOpticsPlatformPackageBinding(binding){
 const pair=binding.platformPackages;assert.equal(pair.kind,'yandex-review-campaign-package-binding');
 for(const key of ['sourceAccepted','publicationAccepted','liveSdkAccepted','moderationAccepted'])assert.equal(pair[key],false);
 assert.equal(binding.package.mode,'yandex-review-test');assert.equal(pair.review.mode,'yandex-review-test');assert.equal(pair.consumer.mode,'consumer');
 for(const member of [pair.source,pair.review,pair.consumer]){assert.equal(member.commit,binding.source.commit);assert.equal(member.sourceInputsSha256,binding.source.sourceInputsSha256);}
 assert.equal(pair.source.tree,binding.source.tree);assert.equal(binding.package.packageFilesSha256,pair.review.packageFilesSha256);
 sha(pair.consumer.packageFilesSha256);sha(pair.review.packageFilesSha256);assert.notEqual(pair.consumer.packageFilesSha256,pair.review.packageFilesSha256,'TEST package bytes must not be relabelled as consumer bytes');
 return binding;
}

/** Independently check a complete declared route and its exact native cadence.
 * Mechanism snapshots are retained as observations; a phase count is never
 * substituted for the current production isWon predicate. */
export function assertOpticsCaptureRows(rows,route){
 assert.ok(Number.isInteger(route.level)&&route.level>=31&&route.level<=40,'Exact Optics31–40 route required');assert.equal(route.index,route.level-1);assert.equal(route.edition,'foundation');
 assert.equal(route.kind,'optics-complete-ordinary-input-native-route');assert.equal(route.pass,true);assert.equal(route.complete,true);
 for(const[k,v]of Object.entries(OPTICS_OPEN_SCOPES))assert.equal(route[k],v);
 assert.equal(route.initialState.state,'playing');assert.equal(route.initialState.visualFrame,0);assert.equal(route.initialState.worldStep,0);assert.equal(route.initialState.physicsSteps,0);
 integer(route.lastVisualFrame,1);assert.ok(route.lastVisualFrame<=OPTICS_BOUNDS.visualFrames);assert.equal(route.frames,route.lastVisualFrame+1);
 integer(route.physicsSteps,1);assert.ok(route.physicsSteps<=OPTICS_BOUNDS.physicsSteps);assert.ok(route.physicsSteps===route.lastVisualFrame*2||route.physicsSteps===route.lastVisualFrame*2-1);
 assert.equal(route.postStepStart,0);assert.equal(route.postStepFinish,route.physicsSteps);assert.equal(route.observed.postSteps,route.physicsSteps);assert.equal(route.seconds,route.physicsSteps/120);
 assert.equal(route.observed.visualUpdates,route.lastVisualFrame);integer(route.observed.identityChecks,route.physicsSteps+route.frames);
 for(const k of ['resetRun','respawn','resetCargo','levelReset'])assert.equal(route.resetCounts[k],0,'Native complete route may not reset: '+k);
 assert.equal(route.driver.pass,true);assert.equal(route.driver.level,route.level);assert.equal(route.driver.id,route.id);assert.equal(route.driver.frames,route.lastVisualFrame);assert.equal(route.driver.resets,0);assert.equal(route.driver.respawns,0);
 integer(route.bodyId);integer(route.shapeId);assert.equal(route.cargoMass,3.2);assert.equal(route.lastState.state,'won');assert.equal(route.lastState.actualProductionWinPredicate,true);
 const terminal=route.lastVisualFrame%OPTICS_CAPTURE.stride!==0;
 assert.equal(rows.length,Math.floor(route.lastVisualFrame/OPTICS_CAPTURE.stride)+1+(terminal?1:0));
 for(const [i,row]of rows.entries()){
  assert.equal(row.index,i);assert.equal(row.terminal,terminal&&i===rows.length-1);const s=row.state;
  assert.equal(s.visualFrame,row.terminal?route.lastVisualFrame:i*OPTICS_CAPTURE.stride);assert.equal(s.worldStep,s.physicsSteps);assert.equal(s.seconds,s.physicsSteps/120);
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
export function assertOpticsRunProvenance(value){
 for(const name of ['sourceReview','captureRun','providerRun']){
  const run=value?.[name];assert.ok(run&&Number.isSafeInteger(run.runId)&&run.runId>0&&Number.isSafeInteger(run.runAttempt)&&run.runAttempt>0,'Explicit positive safe-integer '+name+' run/attempt required');
 }
 assert.match(value.providerRun.commit,/^[a-f0-9]{40}$/);assert.equal(value.providerRun.runId,value.captureRun.runId);assert.equal(value.providerRun.runAttempt,value.captureRun.runAttempt);
 return value;
}

export function assertOpticsNativeDiagnostic(report,{binding,rows,movieMetadata}={}){
 assert.equal(report.kind,'actual-optics-complete-native-browser-diagnostic');assert.equal(report.pass,true);assert.equal(report.nativeRecordingCompleted,true);
 for(const[k,v]of Object.entries(OPTICS_OPEN_SCOPES))assert.equal(report[k],v);
 for(const k of ['humanPlaytest','hardwareFPSMeasured','allRenderFramesMeasured','cameraAccepted'])assert.equal(report[k],false);
 assertOpticsRunProvenance(report);assertOpticsRunProvenance(binding);for(const name of ['sourceReview','captureRun','providerRun'])assert.deepEqual(report[name],binding[name]);assert.equal(report.captureRun.runId,report.controller.runId);assert.equal(report.captureRun.runAttempt,report.controller.runAttempt);
 assert.deepEqual(report.source,binding.source);assert.deepEqual(report.controller,binding.controller);assert.deepEqual(report.package,binding.package);
 assertOpticsPlatformPackageBinding(binding);
 const platform=report.platformReview;assert.equal(platform.mode,'yandex-review-test');assert.equal(platform.consumerPackageFilesSha256,binding.platformPackages.consumer.packageFilesSha256);assert.equal(platform.reviewPackageFilesSha256,binding.package.packageFilesSha256);assert.equal(platform.sourceInputsSha256,binding.source.sourceInputsSha256);
 assert.equal(platform.sdk.kind,'explicit-local-test-sdk');assert.equal(platform.sdk.liveSdk,false);assert.equal(platform.sdk.liveAds,false);integer(platform.sdk.bytes,1);sha(platform.sdk.sha256);
 assert.equal(platform.checker.summary.checked,true);assert.equal(platform.checker.summary.hardFailures,0);assert.equal(platform.checker.summary.liveSdkAccepted,false);assert.equal(platform.checker.summary.moderationAccepted,false);sha(platform.checker.reportSha256);sha(platform.checker.originalTextSha256);sha(platform.context.sha256);
 assert.equal(platform.network.allReceivedBytesMatched,true);integer(platform.network.responseCount,1);assert.equal(platform.access.targetIndex,report.route.index);assert.equal(platform.access.targetCompleted,false);assert.equal(platform.access.constructorWrites,0);
 assert.match(report.source.commit,/^[a-f0-9]{40}$/);assert.match(report.source.tree,/^[a-f0-9]{40}$/);assert.equal(report.sourceWorkingBytesUnchanged,true);assert.equal(report.controllerWorkingBytesUnchanged,true);assert.equal(report.completeServedPackageVerified,true);
 assert.equal(typeof report.captureViewport,'string');const capture=opticsCapture(report.route.level,report.captureViewport);assert.equal(report.captureViewport,binding.captureViewport);assert.deepEqual(report.capture,capture);assert.deepEqual(binding.capture,capture);assert.deepEqual(report.captureBounds,OPTICS_BOUNDS);assertOpticsCaptureRows(rows,report.route);
 const level=report.route.level,tag=String(level).padStart(2,'0'),ui=report.ui;
 const profile=opticsBrowserProfile(level,report.captureViewport);assert.deepEqual(binding.browserProfile,profile);assert.deepEqual(report.browserProfile,profile);
 assertOpticsViewportObservation(report.viewportObservation.beforePlay,{room:level,viewport:report.captureViewport});assertOpticsViewportObservation(report.viewportObservation.playing,{room:level,viewport:report.captureViewport});assert.deepEqual(ui.viewport,report.viewportObservation.playing);
 assert.equal(ui.control,profile.hasTouch?'native #play-button tap':'native #play-button click');assert.equal(ui.normalSpawn,true);assert.equal(ui.normalCargoSpawn,true);assert.equal(ui.elapsed,0);assert.equal(ui.worldStep,0);assert.equal(ui.portalsReady,false);assert.equal(ui.teleports,0);assert.equal(ui.edition,'foundation');assert.equal(ui.level,level);assert.equal(ui.id,report.route.id);assert.equal(ui.state,'playing');
 for(const [actual,expected,distance]of [[ui.playerPosition,ui.expectedPlayerSpawn,ui.playerSpawnDistance],[ui.cargoPosition,ui.expectedCargoSpawn,ui.cargoSpawnDistance]]){finiteVector(actual,3);finiteVector(expected,3);assert.equal(distance,Math.hypot(...actual.map((n,i)=>n-expected[i])));assert.ok(distance<1e-8);}
 assert.match(report.browser.product,/^(?:HeadlessChrome|Chrome)\/\d+(?:\.\d+){3}$/);assert.match(report.browser.userAgent,/\b(?:HeadlessChrome|Chrome)\/\d+/);
 const renderer=report.renderer;assert.equal(renderer.isWebGLRenderer,true);assert.equal(renderer.contextLost,false);assert.match(renderer.version,/WebGL/);assert.equal(renderer.debugRendererInfoAvailable,true);assert.equal(typeof renderer.unmaskedVendor,'string');assert.ok(renderer.unmaskedVendor.length>0);assert.match(renderer.unmaskedRenderer,/ANGLE/i);assert.match(renderer.unmaskedRenderer,/SwiftShader/i);
 const v=report.video;integer(v.bytes,1);assert.ok(v.bytes<=OPTICS_BOUNDS.movieBytes);sha(v.sha256);assert.equal(v.filename,`room-${tag}-full.mp4`);assert.equal(v.frames,rows.length);assert.equal(v.fps,12);assert.equal(v.width,capture.width);assert.equal(v.height,capture.height);assert.equal(v.durationSeconds,rows.length/12);assert.equal(v.simulationSeconds,report.route.seconds);assert.ok(Math.abs(v.durationSeconds-v.simulationSeconds)<=1/6);assert.equal(v.fullMP4Decode,true);assert.equal(v.terminalCaptured,rows.at(-1).terminal);assert.deepEqual(v.first,rows[0].state);assert.deepEqual(v.last,rows.at(-1).state);
 const streams=movieMetadata.streams;assert.equal(streams.length,1);const stream=streams[0];assert.equal(stream.codec_type,'video');assert.equal(stream.codec_name,'h264');assert.equal(stream.width,capture.width);assert.equal(stream.height,capture.height);assert.equal(stream.r_frame_rate,'12/1');assert.equal(Number(stream.nb_frames),rows.length);assert.ok(Math.abs(Number(stream.duration)-rows.length/12)<.00001);
 assert.equal(v.pixelCheck.frames,rows.length);assert.equal(v.pixelCheck.allNonblank,true);assert.ok(v.pixelCheck.minimumLuminanceRange>12);sha(v.pixelCheck.sha256);integer(v.pixelCheck.bytes,1);
 const t=report.telemetry;assert.equal(t.filename,`room-${tag}-telemetry.jsonl`);assert.equal(t.samples,rows.length);integer(t.bytes,1);assert.ok(t.bytes<=OPTICS_BOUNDS.telemetryBytes);sha(t.sha256);
 const model=report.modelIdentity;assert.equal(model.playerVertices,96753);assert.equal(model.playerBones,15);assert.equal(model.cargoMass,3.2);assert.deepEqual(model.cargoHalfExtents,[.39,.39,.39]);for(const k of ['sameOriginalActorHandles','sameOriginalBuffers','sameOriginalCargoShape'])assert.equal(model[k],true);sha(model.initialGeometrySha256);assert.equal(model.finalGeometrySha256,model.initialGeometrySha256);assert.equal(model.observedVisualFrames,report.route.frames);assert.equal(model.materialIdentity.originalActorHandles,2);integer(model.materialIdentity.invocations,report.route.frames);
 assert.equal(report.keyframes.length,3);const expectedIndices=[Math.floor((rows.length-1)*.25),Math.floor((rows.length-1)*.6),rows.length-1];
 for(const[i,k]of report.keyframes.entries()){assert.equal(k.filename,`room-${tag}-keyframe-${String(i+1).padStart(2,'0')}.png`);assert.equal(k.encodedFrame,expectedIndices[i]);assert.equal(k.visualFrame,rows[k.encodedFrame].state.visualFrame);assert.equal(k.movieSha256,v.sha256);assert.equal(k.width,capture.width);assert.equal(k.height,capture.height);integer(k.bytes,1);sha(k.sha256);}
 assert.deepEqual(report.errors,[]);return report;
}
