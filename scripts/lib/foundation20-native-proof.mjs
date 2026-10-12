import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const FOUNDATION20_PREFIX='brainrot-foundation20-physical-v1:';
export const FOUNDATION20_LEGACY_PREFIXES=Object.freeze([
 'brainrot-foundation-v1:','brainrot-puzzle-pilot43-v1:','brainrot-puzzle-progression-v1:',
 'brainrot-puzzle-progression-next-v1:','brainrot-puzzle-progression-finale-v1:',
 'brainrot-tower41-ratchet-qualification-v1:','brainrot-tower41-native-v1:','brainrot-tower41-native-v2:','brainrot-tower41-native-v3:',
]);
export const FOUNDATION20_MARKS=Object.freeze({
 blocked:'same finite E slips while the near hook carries the closing spring',
 hanging:'true current cable tension unloads the physically loaded near hook',
 released:'same finite E withdraws the now unloaded near hook',
 opened:'actual cable force advances the same two-leaf gate train',
 retained:'far solid contact retains the gate train after actual cable force falls to zero',
 recovered:'same original cargo recovered through the grounded side service opening',
 won:'both travellers return through the physically retained linked door',
});

export function assertFoundation20Route(report) {
 assert.equal(report?.kind,'ordinary-foundation20-physical-route');assert.equal(report.edition,'foundation');
 assert.equal(report.level,20);assert.equal(report.id,'foundation-portal-tension');assert.equal(report.pass,true);
 assert.equal(report.sameCompanion,true);assert.equal(report.cargoMass,3.2);
 for(const name of ['resets','respawns','cargoResets'])assert.equal(report[name],0);
 assert.ok(Number.isSafeInteger(report.frames)&&report.frames>300);
 assert.ok(Number.isSafeInteger(report.physicsSteps)&&report.physicsSteps>0&&report.physicsSteps<=report.frames*2);
 assert.equal(report.seconds,report.physicsSteps/120);assert.ok(report.shots>=3&&report.interactions>=5);
 const observed=new Map(report.milestones.map(m=>[m.name,m]));
 const m={};for(const [key,name]of Object.entries(FOUNDATION20_MARKS)){assert.ok(observed.has(name),'Missing ordinary physical milestone '+name);m[key]=observed.get(name);}
 assert.ok(m.blocked.frame<m.hanging.frame&&m.hanging.frame<m.released.frame&&m.released.frame<m.opened.frame&&m.opened.frame<m.retained.frame&&m.retained.frame<m.recovered.frame&&m.recovered.frame<m.won.frame);
 for(const point of [report.start,...report.milestones,report.finish]){
  assert.equal(point.cargoBodyId,report.cargoBodyId);assert.equal(point.cargoMass,3.2);assert.equal(point.cargoDynamic,true);
  assert.equal(point.edition,'foundation');assert.equal(point.level,20);assert.equal(point.id,report.id);
 }
 assert.ok(m.blocked.rope.opening<.15&&Math.abs(m.blocked.nearHook.angle)<.2);
 assert.ok(m.blocked.nearHook.lastHand.bearingForce>1,'The first actual E must act while the bearing carries load');
 assert.equal(m.blocked.nearHook.handCount,1);
 assert.ok(m.hanging.rope.opening>.48&&m.hanging.rope.opening<.8&&m.hanging.rope.tension>0&&m.hanging.rope.currentPair);
 assert.equal(m.hanging.held,false);assert.equal(m.hanging.nearHook.originalFree,true);assert.ok(m.hanging.nearHook.bearingForce<1);
 assert.equal(m.hanging.nearHook.handCount,1);
 assert.equal(m.hanging.rope.unilateral,true);assert.equal(m.hanging.rope.slack,false);
 assert.equal(m.released.nearHook.handCount,2);assert.ok(m.released.nearHook.lastHand.bearingForce<1);
 assert.equal(m.blocked.nearHook.lastHand.angularImpulseMagnitude,.7);assert.equal(m.released.nearHook.lastHand.angularImpulseMagnitude,.7);
 assert.ok(m.released.nearHook.angle>.2);assert.ok(m.opened.rope.opening>6.95);assert.equal(m.opened.nearHook.handCount,2);
 assert.equal(m.retained.rope.tension,0);assert.equal(m.retained.rope.currentPair,false);assert.ok(m.retained.rope.opening>6.6);
 assert.ok(m.retained.farContact?.retainingContacts>0&&m.retained.farContact.retainingForce>0,'The real CANNON tooth/finger contact must retain the force-free train');
 assert.equal(m.retained.farContact.liveOwnership,true);assert.equal(m.recovered.held,true);
 assert.equal(report.finish.state,'won');assert.equal(report.finish.held,true);assert.equal(m.won.state,'won');
 return report;
}

export function assertFoundation20SaveIsolation(isolation){
 assert.equal(isolation?.pass,true);assert.equal(isolation.namespace,FOUNDATION20_PREFIX);
 assert.deepEqual(isolation.legacyPrefixes,[...FOUNDATION20_LEGACY_PREFIXES]);
 assert.equal(isolation.ownKey,FOUNDATION20_PREFIX+'brainrot-portal.preferences.v24');
 const baseline=isolation.legacySnapshot;assert.ok(baseline&&typeof baseline==='object'&&!Array.isArray(baseline));
 for(const prefix of FOUNDATION20_LEGACY_PREFIXES)assert.equal(typeof baseline[prefix+'brainrot-portal.preferences.v24'],'string');
 assert.ok(Object.keys(baseline).every(key=>FOUNDATION20_LEGACY_PREFIXES.some(prefix=>key.startsWith(prefix))));
 assert.equal(createHash('sha256').update(JSON.stringify(baseline)).digest('hex'),isolation.legacySnapshotSha256);
 const playerURL=new URL(isolation.playerURL),reviewURL=new URL(isolation.reviewURL);
 for(const url of [playerURL,reviewURL]){assert.equal(url.username,'');assert.equal(url.password,'');}
 assert.ok(['http:','https:'].includes(playerURL.protocol));assert.match(playerURL.pathname,/\/(?:brainrot-portal\/)?foundation20-physical-v1\/?(?:index\.html)?$/);
 assert.equal(playerURL.search,'');assert.equal(playerURL.hash,'');assert.equal(reviewURL.origin,playerURL.origin);assert.equal(reviewURL.pathname,playerURL.pathname);
 assert.equal(reviewURL.hash,'');assert.equal(reviewURL.search,'?debug=1');
 const bare=isolation.bareEntry;assert.equal(bare?.pass,true);assert.equal(bare.search,'');assert.equal(bare.state,'ready');
 assert.equal(bare.applicable,true);assert.equal(bare.url,playerURL.href);assert.equal(bare.pathname,playerURL.pathname);assert.equal(bare.hash,'');assert.equal(bare.oldBytesUnchanged,true);
 assert.equal(bare.level,20);assert.equal(bare.edition,'foundation');assert.equal(bare.entry,'foundation20-physical-v1');
 assert.deepEqual(bare.startChoices,[19]);assert.deepEqual(bare.settingsChoices,[19]);assert.equal(bare.editionNavigationPresent,false);assert.deepEqual(bare.editionNavigationAnchors,[]);
 assert.equal(bare.debugGameHook,'undefined');assert.equal(bare.debugPreferencesHook,'undefined');assert.equal(bare.debugRouteHook,'undefined');
 assert.equal(bare.legacySnapshotSha256,isolation.legacySnapshotSha256);assert.equal(bare.settings.beforeSha256,bare.settings.restoredSha256);assert.notEqual(bare.settings.beforeSha256,bare.settings.changedSha256);
 assert.equal(bare.ownKey,isolation.ownKey);assert.equal(bare.ownPreferencesSha256,bare.settings.restoredSha256);
 assert.equal(bare.settings.control,'native-menu-quality-select');assert.notEqual(bare.settings.changedTo,bare.settings.restoredTo);
 for(const name of ['beforeSha256','changedSha256','restoredSha256'])assert.match(bare.settings[name],/^[a-f0-9]{64}$/);
 const phases=['after-load','after-settings','after-play','after-pause','after-resume','after-win','after-replay','after-reload'];
 const states=['ready','ready','playing','paused','playing','won','playing','ready'];
 assert.deepEqual(isolation.phases.map(p=>p.phase),phases);
 for(const [index,p]of isolation.phases.entries()){
  assert.equal(p.state,states[index]);assert.equal(p.level,20);assert.equal(p.edition,'foundation');assert.equal(p.entry,'foundation20-physical-v1');
  assert.deepEqual(p.startChoices,[19]);assert.deepEqual(p.settingsChoices,[19]);assert.equal(p.editionNavigationPresent,false);assert.deepEqual(p.editionNavigationAnchors,[]);
  assert.equal(p.oldBytesUnchanged,true);assert.equal(p.legacySnapshotSha256,isolation.legacySnapshotSha256);
  assert.equal(p.namespaceUsed,true);assert.equal(p.ownResumeLevel,19);assert.deepEqual(p.ownCompleted,index<5?[]:[19]);
  assert.match(p.ownPreferencesSha256,/^[a-f0-9]{64}$/);
 }
 assert.equal(isolation.controls.settings.control,'native-menu-quality-select');assert.notEqual(isolation.controls.settings.changedTo,isolation.controls.settings.restoredTo);
 assert.equal(isolation.controls.pauseResume.pass,true);assert.equal(isolation.controls.pauseResume.pauseControl,'native-escape-or-hud');assert.equal(isolation.controls.pauseResume.resumeControl,'focused-native-enter');assert.equal(typeof isolation.controls.pauseResume.pointerLockExitFallback,'boolean');
 assert.equal(isolation.controls.replay.pass,true);assert.equal(isolation.controls.replay.atSpawn,true);assert.equal(isolation.controls.replay.button,'#play-again-button');assert.match(isolation.controls.replay.label,/Пройти ещё раз/);assert.equal(isolation.controls.replay.handCount,0);assert.ok(Math.abs(isolation.controls.replay.opening)<.01);
 assert.deepEqual(isolation.controls.reload,{pass:true,state:'ready',level:20,completed:[19],resumeLevel:19});
 const peer=isolation.crossEntry;assert.equal(peer?.pass,true);const peerURL=new URL(peer.url);
 assert.equal(peerURL.origin,playerURL.origin);assert.equal(peerURL.pathname,playerURL.pathname.replace('foundation20-physical-v1','tower41-native-v3'));assert.equal(peerURL.search,'');assert.equal(peerURL.hash,'');
 assert.equal(peerURL.username,'');assert.equal(peerURL.password,'');
 assert.equal(peer.entry,'tower41-native-v3');assert.equal(peer.level,41);assert.equal(peer.state,'ready');assert.deepEqual(peer.startChoices,[40]);assert.deepEqual(peer.settingsChoices,[40]);
 assert.equal(peer.debugGameHook,'undefined');assert.equal(peer.debugPreferencesHook,'undefined');assert.equal(peer.debugRouteHook,'undefined');assert.equal(peer.own20BytesUnchanged,true);assert.equal(peer.peerBytesUnchanged,true);assert.equal(peer.reloadVerified,true);
 assert.equal(peer.legacySnapshotSha256,isolation.legacySnapshotSha256);assert.equal(peer.own20Sha256,isolation.phases.at(-1).ownPreferencesSha256);
 return isolation;
}

export function assertFoundation20NativeReport(report,{sourceCommit,movieMetadata,sourceReview,nativePackage}={}){
 assert.equal(report?.pass,true);assert.match(report.sourceCommit,/^[a-f0-9]{40}$/);if(sourceCommit)assert.equal(report.sourceCommit,sourceCommit);
 if(sourceReview)assert.deepEqual(report.sourceReview,sourceReview);if(nativePackage)assert.deepEqual(report.nativePackage,nativePackage);
 assert.equal(report.nativePackage.sourceCommit,report.sourceCommit);assert.match(report.nativePackage.packageFilesSha256,/^[a-f0-9]{64}$/);
 assertFoundation20Route(report.route);assertFoundation20SaveIsolation(report.saveIsolation);
 assert.equal(report.saveIsolation.crossEntry.sourceCommit,report.sourceCommit);
 assert.deepEqual(report.errors,[]);assert.equal(report.capture.method,'continuous production WebGL canvas readback at actual ordinary route frame intervals');
 const o=report.observed;assert.equal(o.samples,report.route.frames);assert.equal(o.bodyId,report.route.cargoBodyId);
 for(const name of ['samples','originalIdentityFailures','slackNonzeroForceSamples','slackSamples','completedPostSteps','forceSamples','postStepsStart','postStepsFinish','retainingContactSamples'])assert.ok(Number.isSafeInteger(o[name])&&o[name]>=0,'Actual finite integer observer counter '+name);
 for(const name of ['maxEndpointMagnitudeError','maxCouplingPower','maxRetainingForce'])assert.ok(Number.isFinite(o[name]),'Actual finite observer aggregate '+name);
 assert.equal(o.originalIdentityFailures,0);assert.equal(o.slackNonzeroForceSamples,0);assert.ok(Number.isSafeInteger(o.slackSamples)&&o.slackSamples>=0);
 assert.equal(o.completedPostSteps,report.route.physicsSteps);assert.equal(o.forceSamples,report.route.physicsSteps);
 assert.equal(o.postStepsFinish-o.postStepsStart,report.route.physicsSteps);
 assert.ok(o.maxEndpointMagnitudeError<1e-9);assert.ok(o.maxCouplingPower<=1e-9);
 assert.ok(o.retainingContactSamples>0&&o.maxRetainingForce>0);
 const model=o.modelIdentity;assert.equal(model?.pass,true);assert.equal(model.playerVertices,96753);assert.equal(model.bones,15);assert.equal(model.cargoMass,3.2);
 assert.equal(model.cargoBodyId,report.route.cargoBodyId);
 assert.equal(model.sameOriginalCargoShape,true);assert.ok(Number.isSafeInteger(model.cargoShapeId)&&model.cargoShapeId>=0);assert.deepEqual(model.cargoHalfExtents,[.39,.39,.39]);
 assert.equal(model.sameOriginalActorReferences,true);assert.equal(model.sameOriginalSkins,true);assert.equal(model.sameOriginalCargoVisual,true);assert.equal(model.sameOriginalWeapon,true);
 assert.equal(model.observedVisualFrames,report.route.frames);assert.match(model.initialGeometrySha256,/^[a-f0-9]{64}$/);assert.equal(model.finalGeometrySha256,model.initialGeometrySha256);
 const material=model.materialIdentity;assert.equal(material?.pass,true);assert.ok(Number.isSafeInteger(material.protectedMeshes)&&material.protectedMeshes>0);
 assert.equal(material.originalActorHandles,2);assert.ok(Number.isSafeInteger(material.invocations)&&material.invocations>=report.route.frames);
 assert.ok(Number.isSafeInteger(material.originalChecks)&&material.originalChecks>0);assert.ok(Number.isSafeInteger(material.ownedClippingChecks)&&material.ownedClippingChecks>0);
 const v=report.video;assert.equal(v.filename,'foundation20-physical.mp4');assert.match(v.sha256,/^[a-f0-9]{64}$/);assert.ok(v.bytes>1000);
 assert.ok(Number.isSafeInteger(v.frames)&&v.frames>20);assert.equal(v.fps,report.capture.fps);assert.ok([4,6,12,30,60].includes(v.fps));assert.equal(v.stride,60/v.fps);assert.equal(report.capture.stride,v.stride);assert.equal(v.width,report.capture.width);assert.equal(v.height,report.capture.height);
 assert.ok([v.width,v.height].every(n=>Number.isSafeInteger(n)&&n>=240&&n<=1920&&n%2===0));assert.ok(Number.isSafeInteger(v.bytes));
 assert.equal(v.durationSeconds,v.frames/v.fps);assert.ok(Math.abs(v.durationSeconds-report.route.frames/60)<=2/v.fps);
 assert.equal(v.simulationSeconds,report.route.seconds);assert.equal(v.first.visualFrame,0);assert.equal(v.first.state,'playing');assert.equal(v.last.state,'won');assert.equal(v.fullMP4Decode,true);
 assert.equal(v.lastVisualFrame,report.route.frames-1);assert.equal(v.last.visualFrame,v.lastVisualFrame);assert.equal(v.terminalSample,v.lastVisualFrame%v.stride!==0);
 assert.equal(v.last.seconds,report.route.seconds);
 for(const sample of [v.first,v.last]){assert.equal(sample.cargoBodyId,report.route.cargoBodyId);assert.equal(sample.cargoMass,3.2);assert.equal(sample.cargoDynamic,true);assert.equal(sample.edition,'foundation');assert.equal(sample.level,20);assert.equal(sample.id,report.route.id);}
 assert.equal(v.pixelCheck.frames,v.frames);assert.equal(v.pixelCheck.allNonblank,true);assert.ok(v.pixelCheck.minimumLuminanceRange>12);
 assert.equal(report.telemetry.filename,'foundation20-telemetry.jsonl');assert.match(report.telemetry.sha256,/^[a-f0-9]{64}$/);assert.ok(report.telemetry.bytes>1000);
 assert.ok(Number.isSafeInteger(report.telemetry.bytes));assert.equal(report.telemetry.samples,v.frames);
 if(movieMetadata){const video=movieMetadata.streams.find(s=>s.codec_type==='video');assert.equal(video.codec_name,'h264');assert.equal(video.width,v.width);assert.equal(video.height,v.height);assert.equal(Number(video.nb_frames),v.frames);assert.equal(video.avg_frame_rate,`${v.fps}/1`);assert.ok(Math.abs(Number(movieMetadata.format.duration)-v.durationSeconds)<.12);}
 assert.equal(report.publicationAccepted,false);assert.equal(report.humanPlaytest,false);assert.equal(report.hardwareFPSMeasured,false);
 return report;
}
