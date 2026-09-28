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
assert.equal(manifest.levels?.length,40,'Publish precisely 40 complete room recordings');
fs.mkdirSync('qa/public-walkthroughs',{recursive:true});
for(let start=0;start<40;start+=5){
 await Promise.all(manifest.levels.slice(start,start+5).map(async(entry,offset)=>{
  const level=start+offset+1,stem=`level-${String(level).padStart(2,'0')}`;
  assert.equal(entry.level,level);
  assert.equal(entry.src,`walkthroughs/${stem}.mp4`);
  assert.ok(entry.durationSeconds>5);
  const url=new URL(entry.src,base);
  const partial=await fetch(url,{headers:{Range:'bytes=0-1023'},cache:'no-store'});
  assert.equal(partial.status,206,`Room ${level} must support HTTP byte-range seeking`);
  assert.match(partial.headers.get('content-type')||'',/^video\/mp4(?:$|;)/i);
  assert.match(partial.headers.get('content-range')||'',/^bytes 0-1023\/\d+$/);
  const bytes=Buffer.from(await partial.arrayBuffer());
  assert.equal(bytes.length,1024);assert.equal(bytes.toString('ascii',4,8),'ftyp');
  assert.equal(Number(partial.headers.get('content-range').split('/')[1]),entry.bytes);
 }));
 console.log(`Public MP4 ranges verified through room ${Math.min(start+5,40)}`);
}
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:720});
 await page.goto(galleryUrl.href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>document.querySelectorAll('.level-card').length===40&&document.querySelectorAll('.level-card.is-pending').length===0);
 await page.screenshot({path:'qa/public-walkthroughs/gallery.png'});
 for(const level of [1,40]){
  await page.click(`.level-card[data-level="${level}"]`);
  await page.waitForFunction(n=>{
   const video=document.querySelector('#video');return video?.readyState>=1&&new URL(video.currentSrc).pathname.endsWith(`/level-${String(n).padStart(2,'0')}.mp4`);
  },{timeout:90000},level);
  const result=await page.evaluate(async()=>{
   const video=document.querySelector('#video');
   if(!video.canPlayType('video/mp4; codecs="avc1.42E01E"'))throw Error('Browser lacks H.264 playback');
   const destination=Math.max(.5,Math.min(3,video.duration/2));
   const sought=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Video seek timed out')),30000);
    video.addEventListener('seeked',()=>{clearTimeout(timer);resolve(true);},{once:true});
    video.addEventListener('error',()=>{clearTimeout(timer);reject(Error(`Video error ${video.error?.code}`));},{once:true});
   });
   video.pause();video.currentTime=destination;await sought;
   return {width:video.videoWidth,height:video.videoHeight,duration:video.duration,time:video.currentTime};
  });
  assert.equal(result.width,854);assert.equal(result.height,480);
  assert.ok(Math.abs(result.time-3)<2.6,'Published playback must seek within the video');
  await page.screenshot({path:`qa/public-walkthroughs/level-${String(level).padStart(2,'0')}.png`});
  console.log('Chromium gallery playback and seek verified',level,result);
 }
}finally{await browser.close();}
