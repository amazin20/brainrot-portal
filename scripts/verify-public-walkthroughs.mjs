/** Verify GitHub Pages serves the entire gallery and seekable MP4 ranges. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const base=new URL(process.env.PAGE_URL||'https://amazin20.github.io/brainrot-portal/');
const manifestUrl=new URL('walkthroughs/manifest.json',base);
const galleryUrl=new URL('walkthroughs.html',base);
const gallery=await fetch(galleryUrl,{cache:'no-store'});
assert.equal(gallery.status,200,'Gallery must be publicly reachable');
assert.match(gallery.headers.get('content-type')||'',/text\/html/i);
const response=await fetch(manifestUrl,{cache:'no-store'});
assert.equal(response.status,200,'The published manifest must exist');
const manifest=await response.json();
assert.equal(manifest.version,1);
if(process.env.BUILD_COMMIT)assert.equal(manifest.sourceCommit,process.env.BUILD_COMMIT);
assert.equal(manifest.levels?.length,41,'Publish forty approved room recordings and the complete Tower');
const approval=JSON.parse(fs.readFileSync('docs/approved-walkthroughs-40.json','utf8'));
fs.mkdirSync('qa/public-walkthroughs',{recursive:true});
for(let start=0;start<41;start+=5){
 await Promise.all(manifest.levels.slice(start,start+5).map(async(entry,offset)=>{
  const level=start+offset+1,stem=`level-${String(level).padStart(2,'0')}`;
  assert.equal(entry.level,level);
  assert.equal(entry.src,`walkthroughs/${stem}.mp4`);
  assert.ok(entry.durationSeconds>5);
  if(level<=40){
   const approved=approval.originalManifest.levels[level-1];
   assert.equal(entry.sha256,approved.sha256,'Previously approved videos must remain byte-identical');
   assert.equal(entry.bytes,approved.bytes);
   assert.equal(entry.sourceCommit,approval.originalManifest.sourceCommit);
   assert.equal(entry.reused,true);
   assert.equal(entry.provenance.verificationRunId,approval.verificationRunId);
  }else{
   assert.equal(entry.sourceCommit,manifest.sourceCommit);
   assert.equal(entry.stages,18);assert.equal(entry.decks,6);assert.equal(entry.branchesPerDeck,3);assert.equal(entry.keystones,6);
   assert.equal(entry.checkpoints,false);
   assert.equal(entry.continuous,true);
   assert.ok(entry.durationSeconds>=900);assert.ok(entry.activeSeconds>=900);
   assert.ok(entry.activeInputSeconds>=900);assert.ok(entry.movingSeconds>0);
   assert.ok(entry.teleports>0);
   assert.ok(entry.maxIdleSeconds<=5);assert.ok(entry.distanceMeters>90);
  }
  const url=new URL(entry.src,base);
  const partial=await fetch(url,{headers:{Range:'bytes=0-1023'},cache:'no-store'});
  assert.equal(partial.status,206,`Room ${level} must support HTTP byte-range seeking`);
  assert.match(partial.headers.get('content-type')||'',/^video\/mp4(?:$|;)/i);
  assert.match(partial.headers.get('content-range')||'',/^bytes 0-1023\/\d+$/);
  const bytes=Buffer.from(await partial.arrayBuffer());
  assert.equal(bytes.length,1024);assert.equal(bytes.toString('ascii',4,8),'ftyp');
  assert.equal(Number(partial.headers.get('content-range').split('/')[1]),entry.bytes);
  const tailStart=entry.bytes-1024;
  const tail=await fetch(url,{headers:{Range:`bytes=${tailStart}-${entry.bytes-1}`},cache:'no-store'});
  assert.equal(tail.status,206,`Room ${level} tail must be seekable`);
  assert.equal(tail.headers.get('content-range'),`bytes ${tailStart}-${entry.bytes-1}/${entry.bytes}`);
  assert.equal((await tail.arrayBuffer()).byteLength,1024);
 }));
 console.log(`Public MP4 beginning and tail ranges verified through room ${Math.min(start+5,41)}`);
}
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:720});
 await page.goto(galleryUrl.href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>document.querySelectorAll('.level-card').length===41&&document.querySelectorAll('.level-card.is-pending').length===0);
 await page.screenshot({path:'qa/public-walkthroughs/gallery.png'});
 for(const level of [1,40,41]){
  await page.click(`.level-card[data-level="${level}"]`);
  await page.waitForFunction(n=>{
   const video=document.querySelector('#video');return video?.readyState>=1&&new URL(video.currentSrc).pathname.endsWith(`/level-${String(n).padStart(2,'0')}.mp4`);
  },{timeout:90000},level);
  const result=await page.evaluate(async()=>{
   const video=document.querySelector('#video');
   if(!video.canPlayType('video/mp4; codecs="avc1.42E01E"'))throw Error('Browser lacks H.264 playback');
   video.muted=true;
   await video.play();
   const playStart=video.currentTime;
   await new Promise(resolve=>setTimeout(resolve,600));
   const advanced=video.currentTime-playStart;
   // Decode the final frame, rather than only checking the first few seconds.
   const destination=Math.max(0,video.duration-.04);
   const sought=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Video seek timed out')),30000);
    video.addEventListener('seeked',()=>{clearTimeout(timer);resolve(true);},{once:true});
    video.addEventListener('error',()=>{clearTimeout(timer);reject(Error(`Video error ${video.error?.code}`));},{once:true});
   });
   video.pause();video.currentTime=destination;await sought;
   return {width:video.videoWidth,height:video.videoHeight,duration:video.duration,time:video.currentTime,destination,advanced,readyState:video.readyState};
  });
  assert.equal(result.width,854);assert.equal(result.height,480);
  assert.ok(result.advanced>.1,'Published video must actually play');
  assert.ok(result.readyState>=2,'The final video frame must decode');
  assert.ok(Math.abs(result.time-result.destination)<.1,'Published playback must seek to the final frame');
  assert.ok(Math.abs(result.duration-manifest.levels[level-1].durationSeconds)<.1);
  await page.screenshot({path:`qa/public-walkthroughs/level-${String(level).padStart(2,'0')}.png`});
  console.log('Chromium gallery playback and seek verified',level,result);
 }
}finally{await browser.close();}
