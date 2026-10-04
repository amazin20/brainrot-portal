import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

async function bounded(promise,ms,label){
 let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out after '+ms+'ms')),ms);})]);}
 finally{clearTimeout(timer);}
}
function pixels(file){
 const code=`import json,sys\nfrom PIL import Image,ImageStat\np=Image.open(sys.argv[1]).convert('RGB')\ns=p.resize((64,36))\nprint(json.dumps({'width':p.width,'height':p.height,'colors':len(s.getcolors(2305) or []),'maxChannelStd':max(ImageStat.Stat(s).stddev)}))`;
 const result=spawnSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python',['-c',code,file],{encoding:'utf8'});
 if(result.status!==0)throw Error('Image pixel validation failed: '+result.stderr.trim());
 const out=JSON.parse(result.stdout);
 if(out.width<100||out.height<100||out.colors<4||out.maxChannelStd<1)throw Error('Blank or invalid image readback: '+JSON.stringify(out));
 return out;
}

// Queue the canvas read in the same browser task as the real render: the
// default drawing buffer need not survive a subsequent compositor frame.
// A pixel-pack buffer holds that exact image while the browser remains able to
// answer CDP and the GPU finishes. A fence avoids a synchronous GPU/CPU wait
// inside getBufferSubData. This path changes neither game state nor render size.
async function asynchronousCanvas(page,{timeoutMs,fenceTimeoutMs=60000}){
 const key='capture-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 const prefix='[QA pixel-pack '+key+'] ',progress=[];
 const onConsole=message=>{const value=message.text();if(value.startsWith(prefix)){try{progress.push({...JSON.parse(value.slice(prefix.length)),nodeElapsedMs:performance.now()-started});}catch{}}};
 page.on('console',onConsole);
 const started=performance.now();let queued=true;
 try{
  const enqueueStarted=performance.now();
  const frame=await bounded(page.evaluate(({key,prefix})=>{
   const started=performance.now(),phase=name=>console.debug(prefix+JSON.stringify({phase:name,browserElapsedMs:performance.now()-started}));
   phase('entered-browser-task');
   const g=window.__NESI_DEMO_GAME__;if(!g?.renderer)throw Error('No live game renderer for canvas capture');
   const renderer=g.renderer,gl=renderer.getContext();
   if(typeof gl.fenceSync!=='function'||typeof gl.getBufferSubData!=='function')return {supported:false};
   if(gl.isContextLost())throw Error('WebGL context lost before pixel-pack capture');
   if(renderer.getRenderTarget()!==null)throw Error('Canvas capture requires the actual default framebuffer');
   // This campaign does not use pixel-pack buffers outside this serial capture
   // helper. It owns that binding and always leaves it null. Querying GL state
   // here can itself synchronously drain the outstanding software GPU queue.
   if(window.__NESI_QA_PIXEL_READBACKS__?.size)throw Error('A pixel-pack capture is already active');
   let buffer,sync;
   try{
    const before=[g.state,g.elapsed,...g.playerPosition.toArray(),...g.cargo.position.toArray()];
    phase('before-render');const renderStarted=performance.now();g.render();const rendered=performance.now();phase('after-render');
    const canvas=renderer.domElement,width=canvas.width,height=canvas.height;
    if(width<100||height<100||renderer.info.render.calls<1||renderer.info.render.triangles<1)throw Error('Renderer did not provide a real scene frame');
    if(renderer.getRenderTarget()!==null)throw Error('Renderer did not finish on its actual canvas');
    buffer=gl.createBuffer();if(!buffer)throw Error('Cannot allocate pixel-pack buffer');
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,buffer);gl.bufferData(gl.PIXEL_PACK_BUFFER,width*height*4,gl.STREAM_READ);
    phase('before-readPixels');
    gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,0);
    phase('after-readPixels');gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
    sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)throw Error('Cannot create pixel-pack completion fence');
    gl.flush();
    const enqueued=performance.now();
    phase('after-enqueue');
    if(JSON.stringify(before)!==JSON.stringify([g.state,g.elapsed,...g.playerPosition.toArray(),...g.cargo.position.toArray()]))throw Error('Readback advanced gameplay');
    const metadata={width,height,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
     frame:{levelIndex:g.levelIndex,state:g.state,elapsed:g.elapsed,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),camera:g.camera.position.toArray(),
      cargoUUID:g.cargo.group.uuid,cargoBodyId:g.physics.cargoBody.id},
     timings:{renderEnqueueMs:rendered-renderStarted,pixelPackEnqueueMs:enqueued-rendered}};
    (window.__NESI_QA_PIXEL_READBACKS__??=new Map()).set(key,{buffer,sync,enqueued,metadata});
    return {supported:true,...metadata};
   }catch(error){if(sync)gl.deleteSync(sync);if(buffer)gl.deleteBuffer(buffer);throw error;}
   finally{gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);}
  },{key,prefix}),60000,'Actual WebGL pixel-pack enqueue');
  const enqueueAwaitMs=performance.now()-enqueueStarted;
  if(!frame.supported){queued=false;return frame;}
  const waitStarted=performance.now(),deadline=waitStarted+fenceTimeoutMs;let ready=false,polls=0;
  while(performance.now()<deadline){
   const remaining=deadline-performance.now();
   ready=await bounded(page.evaluate(key=>{
    const g=window.__NESI_DEMO_GAME__,gl=g.renderer.getContext(),frame=window.__NESI_QA_PIXEL_READBACKS__?.get(key);
    if(!frame)throw Error('Pixel-pack capture no longer exists');
    if(gl.isContextLost())throw Error('WebGL context lost while waiting for pixel-pack capture');
    const result=gl.clientWaitSync(frame.sync,0,0);
    if(result===gl.WAIT_FAILED)throw Error('Pixel-pack completion fence failed');
    return result===gl.ALREADY_SIGNALED||result===gl.CONDITION_SATISFIED;
   },key),Math.min(5000,remaining),'Actual WebGL fence poll');
   polls++;if(ready)break;
   await new Promise(resolve=>setTimeout(resolve,Math.min(100,Math.max(0,deadline-performance.now()))));
  }
  if(!ready)throw Error('Actual WebGL completion fence timed out after '+fenceTimeoutMs+'ms');
  const fenceWaitMs=performance.now()-waitStarted;
  const copyStarted=performance.now();
  const shot=await bounded(page.evaluate(key=>{
   const g=window.__NESI_DEMO_GAME__,gl=g.renderer.getContext(),frames=window.__NESI_QA_PIXEL_READBACKS__,frame=frames?.get(key);
   if(!frame)throw Error('Pixel-pack capture no longer exists');
   try{
    if(gl.isContextLost())throw Error('WebGL context lost before pixel-pack copy');
    const {width,height}=frame.metadata,copyStarted=performance.now(),bytes=new Uint8Array(width*height*4);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,frame.buffer);gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,bytes);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);const copied=performance.now();
    const flipped=new Uint8ClampedArray(bytes.length),stride=width*4;
    for(let y=0;y<height;y++)flipped.set(bytes.subarray(y*stride,(y+1)*stride),(height-1-y)*stride);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    canvas.getContext('2d').putImageData(new ImageData(flipped,width,height),0,0);
    const data=canvas.toDataURL('image/jpeg',.85),encoded=performance.now();
    return {...frame.metadata,data,timings:{...frame.metadata.timings,copyMs:copied-copyStarted,flipAndEncodeMs:encoded-copied,queueToEncodedMs:encoded-frame.enqueued}};
   }finally{
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);gl.deleteBuffer(frame.buffer);gl.deleteSync(frame.sync);frames.delete(key);
    if(frames.size===0)delete window.__NESI_QA_PIXEL_READBACKS__;
   }
  },key),timeoutMs,'Completed WebGL pixel-pack copy');
  queued=false;
  shot.timings={...shot.timings,enqueueAwaitMs,fenceWaitMs,fencePolls:polls,copyAwaitMs:performance.now()-copyStarted,totalMs:performance.now()-started};
  return {supported:true,...shot,progress};
 }catch(error){error.captureProgress=progress;throw error;
 }finally{
  page.off('console',onConsole);
  // A timed-out CDP evaluate is not cancelled by Promise.race. Cleanup is
  // bounded too; callers retire a wedged browser after a failed capture.
  if(queued)await bounded(page.evaluate(key=>{
   const frames=window.__NESI_QA_PIXEL_READBACKS__,frame=frames?.get(key);if(!frame)return;
   const gl=window.__NESI_DEMO_GAME__?.renderer.getContext();
   if(gl){gl.deleteBuffer(frame.buffer);gl.deleteSync(frame.sync);}frames.delete(key);
   if(frames.size===0)delete window.__NESI_QA_PIXEL_READBACKS__;
  },key),2000,'Pixel-pack cleanup').catch(()=>{});
 }
}

/** Capture the actual renderer. A timed-out CDP screenshot must neither hold
 * Puppeteer's screenshot mutex nor prevent the ordinary input route. Canvas
 * fallback explicitly excludes HTML overlays and verifies nonblank pixels. */
export async function captureBrowserFrame(page,file,{timeoutMs=10000,canvasOnly=false}={}){
 const issues=[];let client;
 if(!canvasOnly){
 try{
  client=await bounded(page.createCDPSession(),timeoutMs,'CDP screenshot session');
  const shot=await bounded(client.send('Page.captureScreenshot',{format:'jpeg',quality:85,
   fromSurface:false,captureBeyondViewport:false}),timeoutMs,'CDP viewport capture');
  fs.writeFileSync(file,Buffer.from(shot.data,'base64'));
  return {ok:true,method:'CDP viewport',includesHTML:true,file,pixels:pixels(file)};
 }catch(error){issues.push(String(error));}
 finally{if(client)await bounded(client.detach(),2000,'CDP screenshot detach').catch(()=>{});}
 }
 try{
  let shot=await asynchronousCanvas(page,{timeoutMs});
  const asynchronous=shot.supported;
  if(!asynchronous)shot=await bounded(page.evaluate(()=>{
   const g=window.__NESI_DEMO_GAME__;if(!g?.renderer)throw Error('No live game renderer for canvas capture');
   g.render();const canvas=g.renderer.domElement;
   return {data:canvas.toDataURL('image/jpeg',.85),width:canvas.width,height:canvas.height,
    calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};
  }),timeoutMs,'Actual WebGL canvas readback');
  if(!shot.data.startsWith('data:image/jpeg;base64,')||shot.calls<1||shot.triangles<1)throw Error('Renderer did not provide a real scene frame');
  fs.writeFileSync(file,Buffer.from(shot.data.split(',')[1],'base64'));
  return {ok:true,method:asynchronous?'actual WebGL2 pixel-pack buffer':'actual WebGL canvas (WebGL2 async unsupported)',includesHTML:false,file,pixels:pixels(file),
   renderer:{width:shot.width,height:shot.height,calls:shot.calls,triangles:shot.triangles},
   ...(asynchronous?{frame:shot.frame,timings:shot.timings,progress:shot.progress}:{}),issues};
 }catch(error){issues.push(String(error));if(fs.existsSync(file))fs.renameSync(file,file+'.invalid');return {ok:false,file,issues,...(error.captureProgress?{progress:error.captureProgress}:{})};}
}
