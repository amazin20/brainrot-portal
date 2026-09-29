/** Publish the approved forty recordings and one freshly verified Tower run. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {TOWER_STAGES} from '../src/game/LabTowerLayout.js';

const source=path.resolve(process.env.INPUT_DIR||'qa/walkthrough-input');
const dist=path.resolve(process.env.DIST_DIR||'dist');
const target=path.join(dist,'walkthroughs');
const expected=(process.env.EXPECTED_LEVELS||Array.from({length:41},(_,i)=>i+1).join(','))
 .split(',').map(Number).sort((a,b)=>a-b);
assert.ok(expected.length>0&&expected.every(n=>Number.isInteger(n)&&n>=1&&n<=41));
assert.equal(new Set(expected).size,expected.length,'Level list must be unique');
const build=JSON.parse(fs.readFileSync(path.join(dist,'build-info.json'),'utf8'));
assert.equal(build.features.defaultEdition,'foundation');
assert.equal(build.levels,41);
const approval=JSON.parse(fs.readFileSync('docs/approved-walkthroughs-40.json','utf8'));
assert.equal(createHash('sha256').update(JSON.stringify(approval.originalManifest,null,2)+'\n').digest('hex'),approval.manifestSha256,'Approved manifest pin changed');
assert.equal(approval.originalManifest.levels.length,40);
const hashFile=async file=>{const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');};
const width=854,height=480,fps=12;
const keystoneIds=['spectrum','counterbalance','crosswind','inversion','braid','crown'];
const levels=[];let totalVideoBytes=0;
fs.mkdirSync(target,{recursive:true});
for(const level of expected){
 const stem=`level-${String(level).padStart(2,'0')}`;
 const record=JSON.parse(fs.readFileSync(path.join(source,`${stem}.json`),'utf8'));
 assert.equal(record.level,level);
 assert.equal(record.edition,'foundation');
 if(record.reused){
  assert.ok(level<=40,'Only the forty approved recordings may be reused');
  const approved=approval.originalManifest.levels[level-1];
  assert.equal(record.sourceCommit,approval.originalManifest.sourceCommit);
  for(const key of ['level','title','src','durationSeconds','width','height','fps','bytes','sha256']){
   assert.equal(record[key],approved[key],`Reused room ${level} differs from approved ${key}`);
  }
  assert.deepEqual(record.provenance,{kind:'approved-existing-recording',manifestSha256:approval.manifestSha256,
   captureRunId:approval.captureRunId,verificationRunId:approval.verificationRunId});
 }else{
  assert.equal(record.sourceCommit,build.commit,`Stale recording of room ${level}`);
  assert.equal(record.route?.pass,true);
  assert.equal(record.route.level,level);
  assert.equal(record.route.resets,0);assert.equal(record.route.respawns,0);
  assert.equal(record.continuous,true);
  assert.equal(record.firstFrame.visualFrame,0);
  assert.equal(record.lastFrame.state,'won');
  assert.ok(record.milestones?.length>0);
 }
 if(level===41){
  assert.equal(record.reused,undefined,'The final Tower must be freshly filmed from this exact revision');
  assert.equal(record.version,'v44-tower-variety','An older Tower recording cannot be used for this release');
  assert.equal(record.route.stagesCompleted,18);
  assert.equal(record.route.stageEvents.length,18);
  assert.equal(record.gameMetrics.totalStages,18);
  assert.equal(record.gameMetrics.completedStages,18);
  assert.equal(new Set(record.gameMetrics.solvedIds).size,18);
  assert.deepEqual(record.gameMetrics.deckRelays,[true,true,true,true,true,true]);
  assert.equal(record.gameMetrics.relayEvents.length,6);
  assert.equal(new Set(record.gameMetrics.relayEvents.map(event=>event.deck)).size,6);
  assert.deepEqual(record.gameMetrics.keystoneSolved,[true,true,true,true,true,true]);
  assert.equal(record.gameMetrics.keystoneEvents.length,6);
  assert.equal(record.route.keystoneEvents.length,6);
  assert.equal(record.observed.keystoneEvents.length,6);
  assert.deepEqual(record.route.keystoneEvents.map(event=>[event.deck,event.id]),record.observed.keystoneEvents.map(event=>[event.deck,event.id]));
  assert.deepEqual(record.gameMetrics.keystoneEvents.map(event=>[event.deck,event.id]),record.observed.keystoneEvents.map(event=>[event.deck,event.id]));
  for(const [deck,event] of record.observed.keystoneEvents.entries()){
   assert.equal(event.deck,deck,'The six central puzzles must be solved in ascending deck order');
   assert.equal(event.id,keystoneIds[deck],'The central puzzle identity must match its authored deck');
   const wings=record.observed.stageEvents.filter(wing=>wing.deck===deck);
   const relay=record.gameMetrics.relayEvents.find(item=>item.deck===deck);
   assert.equal(wings.length,3,'Each central puzzle needs all three authored wings');
   assert.ok(relay&&event.simulatedSeconds>relay.seconds&&event.simulatedSeconds>Math.max(...wings.map(wing=>wing.simulatedSeconds)),
    'The central puzzle must follow its live wing relay');
  }
  assert.equal(new Set(record.observed.stageEvents.map(({deck,branch})=>`${deck}:${branch}`)).size,18);
  assert.deepEqual(new Set(record.observed.stageEvents.map(event=>event.id)),new Set(TOWER_STAGES.map(stage=>stage.id)));
  for(const [index,event] of record.observed.stageEvents.entries()){
   assert.equal(event.stage,index+1,'The wing counter must advance exactly once per puzzle');
   const authored=TOWER_STAGES.find(stage=>stage.id===event.id);
   assert.equal(event.deck,authored.deck);assert.equal(event.branch,authored.branch);
  }
  assert.deepEqual(record.route.stageEvents.map(event=>event.id),record.observed.stageEvents.map(event=>event.id));
  assert.deepEqual(record.gameMetrics.solvedIds,record.observed.stageEvents.map(event=>event.id));
  assert.ok(record.route.shots>0&&record.route.interactions>1,'Tower route must use portals and puzzle controls');
  assert.equal(record.gameMetrics.checkpoints,false);
  assert.equal(record.firstFrame.completedStages,0);
  assert.equal(record.lastFrame.completedStages,18);
  assert.ok(record.durationSeconds>=900,'Tower video must last at least fifteen minutes');
  assert.ok(record.observed.activeSeconds>=900,'Tower must contain fifteen minutes of movement or aiming');
  assert.ok(record.route.activeInputSeconds>=900,'Tower input route must actively solve puzzles for fifteen minutes');
  assert.ok(record.observed.movingSeconds>0,'Tower video must show physical movement');
  assert.ok(record.observed.simulatedSeconds>=900);
  assert.ok(Math.abs(record.durationSeconds-record.observed.simulatedSeconds)<=1,'Video may not be slowed or padded');
  assert.ok(record.observed.distanceMeters>90,'Tower recording must traverse all eighteen physical wings');
  assert.ok(record.observed.maxIdleSeconds<=5,'Tower recording contains a prolonged idle interval');
  assert.ok(record.route.maxIdleSeconds<=5&&record.route.maxNoInputSeconds<=5,'Tower input route contains a prolonged idle interval');
  for(const key of ['resetCalls','respawnCalls','cargoResetCalls'])assert.equal(record.observed[key],0,`Tower ${key}`);
  assert.equal(record.observed.stageEvents.length,18);
  assert.ok(record.observed.teleports>0,'The Tower recording must include a real portal transfer');
  assert.equal(record.gameMetrics.teleports,record.observed.teleports);
 }
 assert.equal(record.fps,fps);assert.equal(record.width,width);assert.equal(record.height,height);
 assert.ok(Number.isInteger(record.frameCount)&&record.frameCount>60);
 assert.ok(Math.abs(record.durationSeconds-record.frameCount/fps)<.001);
 assert.equal(record.video,`${stem}.mp4`);assert.equal(record.poster,`${stem}.jpg`);
 assert.ok(typeof record.title==='string'&&record.title.trim().length>1);
 const movie=path.join(source,record.video),poster=path.join(source,record.poster);
 const movieBytes=fs.statSync(movie).size;
 assert.equal(record.bytes,movieBytes);
 assert.equal(record.sha256,await hashFile(movie),`Room ${level} MP4 SHA256 mismatch`);
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0',
  '-show_entries','stream=codec_name,width,height,avg_frame_rate,nb_frames,pix_fmt','-show_entries','format=duration,size',
  '-of','json',movie],{encoding:'utf8'}));
 const stream=probe.streams?.[0];
 assert.equal(stream?.codec_name,'h264');assert.equal(stream.pix_fmt,'yuv420p');
 assert.equal(stream.width,width);assert.equal(stream.height,height);
 assert.equal(Number(stream.nb_frames),record.frameCount);
 assert.equal(stream.avg_frame_rate,`${fps}/1`);
 assert.ok(Math.abs(Number(probe.format.duration)-record.durationSeconds)<.1);
 assert.equal(Number(probe.format.size),movieBytes);
 assert.ok(fs.statSync(poster).size>1000,`Missing first-frame preview for room ${level}`);
 fs.copyFileSync(movie,path.join(target,record.video));
 fs.copyFileSync(poster,path.join(target,record.poster));
 totalVideoBytes+=movieBytes;
 levels.push({level,title:record.title,src:`walkthroughs/${record.video}`,
  poster:`walkthroughs/${record.poster}`,durationSeconds:record.durationSeconds,
  width,height,fps,bytes:movieBytes,sha256:record.sha256,sourceCommit:record.sourceCommit,
  ...(record.reused?{reused:true,provenance:record.provenance}:{continuous:true}),
  ...(level===41?{stages:18,decks:6,branchesPerDeck:3,keystones:6,checkpoints:false,activeSeconds:record.observed.activeSeconds,
   activeInputSeconds:record.route.activeInputSeconds,movingSeconds:record.observed.movingSeconds,
   teleports:record.observed.teleports,maxIdleSeconds:record.observed.maxIdleSeconds,distanceMeters:record.observed.distanceMeters}:{} )});
}
// GitHub Pages published sites must stay substantially under one gigabyte.
// Keep a deliberately strict video budget: a future bloated level fails the
// publication gate instead of silently breaking public playback.
assert.ok(totalVideoBytes<=350*1024*1024,`Walkthroughs exceed 350 MiB: ${totalVideoBytes} bytes`);
for(const filename of ['walkthroughs.html','walkthroughs.css','walkthroughs.js']){
 fs.copyFileSync(filename,path.join(dist,filename));
}
const manifest={version:1,sourceCommit:build.commit,levels};
fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
function treeSize(directory){return fs.readdirSync(directory,{withFileTypes:true}).reduce((sum,entry)=>{
 const filename=path.join(directory,entry.name);
 return sum+(entry.isDirectory()?treeSize(filename):fs.statSync(filename).size);
},0);}
const siteBytes=treeSize(dist);
assert.ok(siteBytes<=500*1024*1024,`Published site exceeds 500 MiB: ${siteBytes} bytes`);
console.log(`Walkthroughs: ${levels.length} verified complete routes, ${(totalVideoBytes/1024/1024).toFixed(1)} MiB MP4, ${(siteBytes/1024/1024).toFixed(1)} MiB full site, build ${build.commit}.`);
