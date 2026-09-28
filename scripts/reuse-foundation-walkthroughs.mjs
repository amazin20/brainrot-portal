/** Reuse the forty already approved MP4s byte for byte; never re-record them. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const approval=JSON.parse(fs.readFileSync('docs/approved-walkthroughs-40.json','utf8'));
const manifest=approval.originalManifest;
assert.equal(createHash('sha256').update(JSON.stringify(manifest,null,2)+'\n').digest('hex'),approval.manifestSha256,'Approved manifest pin changed');
assert.equal(manifest.sourceCommit,'8f63b6270b97fd0f1cb9d0cd9b07ef31bc3af4f6');
assert.equal(approval.verificationRunId,36382749405);
assert.equal(manifest.levels.length,40);
const base=new URL(process.env.APPROVED_VIDEO_BASE_URL||approval.sourceBaseUrl);
const target=path.resolve(process.env.INPUT_DIR||'qa/walkthrough-input');
fs.mkdirSync(target,{recursive:true});
const hashFile=async file=>{const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');};

async function reuse(entry){
 const level=entry.level,stem=`level-${String(level).padStart(2,'0')}`;
 assert.equal(entry.src,`walkthroughs/${stem}.mp4`);
 assert.equal(entry.poster,`walkthroughs/${stem}.jpg`);
 const movie=path.join(target,`${stem}.mp4`),temporary=`${movie}.download`;
 if(!fs.existsSync(movie)||fs.statSync(movie).size!==entry.bytes||await hashFile(movie)!==entry.sha256){
  let lastError;
  for(let attempt=1;attempt<=3;attempt++){
   try{
    const response=await fetch(new URL(entry.src,base),{signal:AbortSignal.timeout(300000)});
    assert.equal(response.status,200,`Approved room ${level} download failed`);
    await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(temporary,{flags:'w'}));
    assert.equal(fs.statSync(temporary).size,entry.bytes,`Approved room ${level} byte count changed`);
    assert.equal(await hashFile(temporary),entry.sha256,`Approved room ${level} content changed`);
    fs.renameSync(temporary,movie);lastError=null;break;
   }catch(error){lastError=error;fs.rmSync(temporary,{force:true});}
  }
  if(lastError)throw lastError;
 }
 // Generate the preview from the pinned video, rather than trusting a second URL.
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',movie,'-frames:v','1','-q:v','3',path.join(target,`${stem}.jpg`)],{stdio:'inherit'});
 const record={...entry,edition:'foundation',sourceCommit:manifest.sourceCommit,
  video:`${stem}.mp4`,poster:`${stem}.jpg`,frameCount:Math.round(entry.durationSeconds*entry.fps),
  reused:true,provenance:{kind:'approved-existing-recording',manifestSha256:approval.manifestSha256,
   captureRunId:approval.captureRunId,verificationRunId:approval.verificationRunId}};
 fs.writeFileSync(path.join(target,`${stem}.json`),JSON.stringify(record,null,2)+'\n');
 console.log(`Reused approved room ${level}: ${entry.sha256}`);
}
for(let start=0;start<manifest.levels.length;start+=5){
 const results=await Promise.allSettled(manifest.levels.slice(start,start+5).map(reuse));
 const failures=results.filter(result=>result.status==='rejected').map(result=>result.reason);
 if(failures.length)throw new AggregateError(failures,'Approved walkthrough reuse failed');
}
console.log(`Reused 40 previously verified complete recordings from ${manifest.sourceCommit}.`);
