/** Publish only a complete, verified set of default-campaign walkthroughs. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const source=path.resolve(process.env.INPUT_DIR||'qa/walkthrough-input');
const dist=path.resolve(process.env.DIST_DIR||'dist');
const target=path.join(dist,'walkthroughs');
const expected=(process.env.EXPECTED_LEVELS||Array.from({length:40},(_,i)=>i+1).join(','))
 .split(',').map(Number).sort((a,b)=>a-b);
assert.ok(expected.length>0&&expected.every(n=>Number.isInteger(n)&&n>=1&&n<=40));
assert.equal(new Set(expected).size,expected.length,'Level list must be unique');
const build=JSON.parse(fs.readFileSync(path.join(dist,'build-info.json'),'utf8'));
assert.equal(build.features.defaultEdition,'foundation');
assert.equal(build.levels,40);
const hashFile=async file=>{const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');};
const width=854,height=480,fps=12;
const levels=[];let totalVideoBytes=0;
fs.mkdirSync(target,{recursive:true});
for(const level of expected){
 const stem=`level-${String(level).padStart(2,'0')}`;
 const record=JSON.parse(fs.readFileSync(path.join(source,`${stem}.json`),'utf8'));
 assert.equal(record.sourceCommit,build.commit,`Stale recording of room ${level}`);
 assert.equal(record.level,level);
 assert.equal(record.edition,'foundation');
 assert.equal(record.route?.pass,true);
 assert.equal(record.route.level,level);
 assert.equal(record.route.resets,0);assert.equal(record.route.respawns,0);
 assert.equal(record.continuous,true);
 assert.equal(record.firstFrame.visualFrame,0);
 assert.equal(record.lastFrame.state,'won');
 assert.equal(record.fps,fps);assert.equal(record.width,width);assert.equal(record.height,height);
 assert.ok(Number.isInteger(record.frameCount)&&record.frameCount>60);
 assert.ok(Math.abs(record.durationSeconds-record.frameCount/fps)<.001);
 assert.equal(record.video,`${stem}.mp4`);assert.equal(record.poster,`${stem}.jpg`);
 assert.ok(typeof record.title==='string'&&record.title.trim().length>1);
 assert.ok(record.milestones?.length>0);
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
  width,height,fps,bytes:movieBytes,sha256:record.sha256});
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
