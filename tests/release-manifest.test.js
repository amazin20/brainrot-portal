import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createReleaseManifest,verifyReleasePackage,verifyReleaseMetadata} from '../scripts/lib/release-manifest.mjs';
import {RELEASE_VERSION,RELEASE_ORIGINS} from '../src/game/ReleaseIdentity.js';

const fixture=()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'brainrot-manifest-'));
 fs.mkdirSync(path.join(directory,'assets'));fs.writeFileSync(path.join(directory,'index.html'),'<script src="./assets/game.js"></script>');
 fs.writeFileSync(path.join(directory,'assets/game.js'),'original');
 return {directory,commit:RELEASE_ORIGINS.game};
};
test('one source binds all 51 current definitions and all current replacements',()=>{
 const setup=fixture();try{
  const manifest=createReleaseManifest(setup);
  assert.equal(manifest.version,RELEASE_VERSION);assert.equal(manifest.gameCommit,setup.commit);assert.equal(manifest.interfaceCommit,setup.commit);
  assert.deepEqual(manifest.rooms.map(room=>room.level),Array.from({length:51},(_,i)=>i+1));
  assert.equal(manifest.rooms[16].id,'foundation-cable-supported-architecture');
  assert.equal(manifest.rooms[16].definitionRevision,'cable-supported-architecture-v1');
  assert.equal(manifest.rooms[32].id,'siphon-observatory');assert.equal(manifest.rooms[50].id,'echo-horizon');
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
  assert.equal(after.videoCatalogue.rooms[16].status,'needs-current-recording');
  assert.equal(after.videoCatalogue.rooms[16].gameplayCompatibility,null);
  assert.ok(after.videoCatalogue.rooms.filter(room=>room.level!==17).every(room=>room.status==='retained-recording-needs-current-visual-review'));
  assert.equal(after.features.replacedRooms.length,3);
 }finally{fs.rmSync(setup.directory,{recursive:true});}
});

test('metadata verification rejects altered room definitions and configuration even when package bytes match',()=>{
 const setup=fixture();try{
  const original=createReleaseManifest(setup);verifyReleaseMetadata(original,setup);
  for(const mutate of [m=>{m.rooms[0].title='different';},m=>{m.edition='classic';},m=>{m.editionVersion='different';},m=>{m.sourceInputFiles++;},m=>{m.features.tower.checkpoints=true;}]){
   const changed=structuredClone(original);mutate(changed);
   verifyReleasePackage(changed,setup.directory);
   assert.throws(()=>verifyReleaseMetadata(changed,setup),/Release definitions or configuration differ/);
  }
 }finally{fs.rmSync(setup.directory,{recursive:true});}
});
