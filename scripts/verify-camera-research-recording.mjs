import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {sha256} from './lib/release-manifest.mjs';
const out=process.env.OUT_DIR,level=Number(process.env.LEVEL),alternative=process.env.ALTERNATIVE_ROUTE||null;
assert.ok((level===17&&alternative==='lower-branch')||(level===50&&!alternative));
const stem=`level-${String(level).padStart(2,'0')}${alternative?'-alternate':''}`;
const report=JSON.parse(fs.readFileSync(path.join(out,stem+'.json'))),identity=report.cameraResearch;
assert.equal(report.sourceCommit,process.env.BUILD_COMMIT);assert.equal(report.level,level);assert.equal(report.alternative||null,alternative);
assert.equal(report.route.pass,true);assert.equal(report.route.resets,0);assert.equal(report.route.respawns,0);
assert.equal(report.continuous,true);assert.equal(report.pixelCheck.allNonblank,true);assert.equal(report.lastFrame.state,'won');
assert.equal(identity.state,'won');assert.equal(identity.originalReferencesEveryFrame,true);
assert.equal(identity.animationLoopPausedAtInstall,true,'Pause and install must share the observation boundary');
for(const field of ['sameCargo','sameBody','samePlayerMesh'])assert.equal(identity[field],true);
for(const field of ['cargoUUID','cargoBodyId','playerMeshUUID']){
 assert.equal(identity.start[field],identity.finish[field]);assert.equal(report.firstFrame[field],identity.start[field]);assert.equal(report.lastFrame[field],identity.start[field]);
}
assert.deepEqual(identity.initialization,{resetRunCalls:1,resetCargoCalls:1,respawnFalseCalls:1,beforeFirstPositiveVisualFrame:true,excludedFromRouteCounters:true});
assert.equal(identity.resetRunCalls,1);assert.equal(identity.resetCargoCalls,1);assert.equal(identity.respawnCalls,1);assert.equal(identity.initializationRespawnFalseCalls,1);assert.equal(identity.routeRespawnCalls,0);
assert.equal(identity.routeResets,0);assert.equal(identity.routeRespawns,0);assert.equal(identity.routeFrames,report.route.frames);
assert.equal(identity.cargoTransports,level===17?2:1);assert.equal(identity.playerTransports,0);
assert.ok(identity.observedVisualFrames>=identity.routeFrames&&identity.observedVisualFrames<=identity.routeFrames+60/report.fps);
assert.equal(sha256(fs.readFileSync(path.join(out,report.video))),report.sha256);
const result={sourceCommit:report.sourceCommit,level,alternative,pass:true,routeFrames:report.route.frames,observedVisualFrames:identity.observedVisualFrames,captureFrames:report.frameCount,originalReferencesEveryFrame:true,cargoTransports:identity.cargoTransports,playerTransports:identity.playerTransports,routeResets:0,routeRespawns:0,initialization:identity.initialization,videoSha256:report.sha256,scope:'Fresh targeted production WebGL recording with normal route camera; visual/art/readability review remains separate. No full51/live/device/human acceptance.'};
fs.writeFileSync(path.join(out,'recording-contract.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
