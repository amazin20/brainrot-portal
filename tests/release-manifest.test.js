import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createReleaseManifest,verifyReleasePackage,verifyReleaseMetadata,sha256} from '../scripts/lib/release-manifest.mjs';
import {RELEASE_VERSION,RELEASE_ORIGINS,ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {FOUNDATION_SEQUENCE,foundationDisplayNumber} from '../src/game/LabCampaignSequence.js';
import {campaignSpec} from '../src/game/LabCampaignLevels.js';

const fixture=()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'brainrot-manifest-'));
 fs.mkdirSync(path.join(directory,'assets'));fs.writeFileSync(path.join(directory,'index.html'),'<script src="./assets/game.js"></script>');
 fs.writeFileSync(path.join(directory,'assets/game.js'),'original');
 return {directory,commit:RELEASE_ORIGINS.game};
};
test('one source binds all 51 current definitions and all current replacements',()=>{
 const setup=fixture();try{
  const manifest=createReleaseManifest(setup);
  assert.equal(manifest.schemaVersion,2);assert.equal(manifest.version,'v55-castle-finale');assert.equal(manifest.editionVersion,'foundation-v4');
  assert.equal(manifest.version,RELEASE_VERSION);assert.equal(manifest.gameCommit,setup.commit);assert.equal(manifest.interfaceCommit,setup.commit);
  assert.deepEqual(manifest.rooms.map(room=>room.level),Array.from({length:51},(_,i)=>i+1));
  assert.equal(manifest.rooms[16].id,'foundation-cable-supported-architecture');
  assert.equal(manifest.rooms[16].definitionRevision,'cable-supported-architecture-v1');
  assert.equal(manifest.rooms[19].definitionRevision,'portal-tension-physical-v1');
  assert.equal(manifest.rooms[22].definitionRevision,'counterweight-dynamic-v1');
  assert.equal(manifest.rooms[50].definitionRevision,'lower-pendulum-physical-camera-v3');
  assert.equal(manifest.rooms[32].id,'siphon-observatory');assert.equal(manifest.rooms[49].id,'puzzle-progression51-mechanical-echo');
  assert.equal(manifest.rooms[50].id,'tower-singularity');assert.equal(manifest.rooms[50].stableLevel,41);
  assert.equal(manifest.rooms[50].stableId,'foundation-041');
  assert.equal(manifest.features.tower.stages,11);assert.equal(manifest.verified,false);
  assert.equal(new Set(manifest.rooms.map(room=>room.stableId)).size,51);
  assert.equal(manifest.features.foundation.chapters.length,6);
  assert.deepEqual(verifyReleasePackage(manifest,setup.directory),manifest.files);
 }finally{fs.rmSync(setup.directory,{recursive:true});}
});
test('inventory rejects same-size edits, additions and missing files',()=>{
 const setup=fixture();try{
  const manifest=createReleaseManifest(setup),file=path.join(setup.directory,'assets/game.js');
  fs.writeFileSync(file,'modified');assert.throws(()=>verifyReleasePackage(manifest,setup.directory),/Package files differ/);
  fs.writeFileSync(file,'original');fs.writeFileSync(path.join(setup.directory,'extra.txt'),'extra');
  assert.throws(()=>verifyReleasePackage(manifest,setup.directory),/Package files differ/);
  fs.unlinkSync(path.join(setup.directory,'extra.txt'));fs.unlinkSync(file);
  assert.throws(()=>verifyReleasePackage(manifest,setup.directory),/Package files differ/);
 }finally{fs.rmSync(setup.directory,{recursive:true});}
});
test('writing metadata does not change the game-file digest or falsify acceptance',()=>{
 const setup=fixture();try{
  const before=createReleaseManifest(setup);
  fs.writeFileSync(path.join(setup.directory,'build-info.json'),JSON.stringify(before));
  const after=createReleaseManifest(setup);
  assert.equal(before.packageFilesSha256,after.packageFilesSha256);assert.equal(before.sourceInputsSha256,after.sourceInputsSha256);
  assert.equal(after.publisherCommit,null);assert.equal(after.platformArchive,null);
  assert.deepEqual(after.acceptance,{humanPlaytest:false,physicalDeviceBenchmark:false,liveYandex:false});
  assert.ok(after.videoCatalogue.rooms.every(room=>room.status==='needs-current-recording'&&room.gameplayCompatibility===null&&room.visualCompatibility===null));
  assert.equal(after.features.replacedRooms.length,14);
  const finalOrdinaryReplacement=after.features.replacedRooms.find(room=>room.stableLevel===51);
  assert.equal(finalOrdinaryReplacement.level,50);assert.equal(finalOrdinaryReplacement.previousId,'echo-horizon');
  assert.equal(finalOrdinaryReplacement.id,'puzzle-progression51-mechanical-echo');
 }finally{fs.rmSync(setup.directory,{recursive:true});}
});

test('metadata verification rejects altered room definitions and configuration even when package bytes match',()=>{
 const setup=fixture();try{
  const original=createReleaseManifest(setup);verifyReleaseMetadata(original,setup);
  for(const mutate of [m=>{m.rooms[0].title='different';},m=>{m.edition='classic';},m=>{m.editionVersion='different';},m=>{m.sourceInputFiles++;},m=>{m.features.tower.checkpoints=true;},m=>{m.rooms[50].stableLevel=51;},m=>{m.runtimeConfig.puzzleProgression=false;},m=>{m.sourceInputs[0].sha256='0'.repeat(64);},m=>{m.features.foundation.newRooms.push(m.features.tower); }]){
   const changed=structuredClone(original);mutate(changed);
   verifyReleasePackage(changed,setup.directory);
   assert.throws(()=>verifyReleaseMetadata(changed,setup),/Release definitions or configuration differ/);
  }
 }finally{fs.rmSync(setup.directory,{recursive:true});}
});

test('metadata follows the actual root variants, five chapter boundaries and final castle rather than archive array offsets',()=>{
 const setup=fixture();try{
  const manifest=createReleaseManifest(setup),byStable=new Map(manifest.rooms.map(room=>[room.stableLevel,room]));
  assert.deepEqual(manifest.runtimeConfig,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});
  assert.deepEqual(manifest.rooms.map(room=>room.stableLevel),FOUNDATION_SEQUENCE.map(index=>index+1));
  for(const index of FOUNDATION_SEQUENCE){
   const room=byStable.get(index+1),spec=campaignSpec(manifest.runtimeConfig,index);
   assert.equal(room.level,foundationDisplayNumber(index));assert.equal(room.id,spec.id);
   assert.equal(room.specSha256,sha256(JSON.stringify(spec)));
  }
  assert.deepEqual(manifest.features.foundation.newRooms.map(room=>room.level),Array.from({length:10},(_,index)=>index+41));
  assert.deepEqual(manifest.features.foundation.newRooms.map(room=>room.stableLevel),Array.from({length:10},(_,index)=>index+42));
  assert.ok(!manifest.features.foundation.newRooms.some(room=>room.id==='tower-singularity'));
  assert.deepEqual(manifest.features.tower,{level:51,stableLevel:41,title:'СКЛАДЧАТЫЙ ЗАМОК',stages:11,checkpoints:false});
  assert.equal(manifest.features.foundation.castleEndsCampaign,true);
  assert.deepEqual(manifest.features.foundation.chapters.map(chapter=>manifest.rooms.filter(room=>room.theme===chapter.id).length),[10,10,10,10,10,1]);
  for(const stableLevel of [43,44,45,46,47,48,49,50,51])assert.equal(byStable.get(stableLevel).definitionRevision,`spatial-progression${stableLevel}-v1`);
  for(const entry of manifest.features.standaloneEntries.filter(entry=>entry.path.startsWith('tower41-'))){
   assert.equal(entry.level,41);assert.deepEqual(entry.levels,[41]);
  }
  for(const filename of ['src/game/ReleaseIdentity.js','src/game/LabCampaignSequence.js','src/game/LabCampaignEnvironment.js','src/game/LabPuzzleProgression51.js','src/main.js'])assert.ok(manifest.sourceInputs.some(input=>input.filename===filename),filename);
  assert.equal(manifest.sourceInputFiles,manifest.sourceInputs.length);
  assert.equal(manifest.sourceInputsSha256,sha256(JSON.stringify(manifest.sourceInputs)));
 }finally{fs.rmSync(setup.directory,{recursive:true});}
});
