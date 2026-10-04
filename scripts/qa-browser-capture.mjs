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
  const shot=await bounded(page.evaluate(()=>{
   const g=window.__NESI_DEMO_GAME__;if(!g?.renderer)throw Error('No live game renderer for canvas capture');
   g.render();const canvas=g.renderer.domElement;
   return {data:canvas.toDataURL('image/jpeg',.85),width:canvas.width,height:canvas.height,
    calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};
  }),timeoutMs,'Actual WebGL canvas readback');
  if(!shot.data.startsWith('data:image/jpeg;base64,')||shot.calls<1||shot.triangles<1)throw Error('Renderer did not provide a real scene frame');
  fs.writeFileSync(file,Buffer.from(shot.data.split(',')[1],'base64'));
  return {ok:true,method:'actual WebGL canvas',includesHTML:false,file,pixels:pixels(file),
   renderer:{width:shot.width,height:shot.height,calls:shot.calls,triangles:shot.triangles},issues};
 }catch(error){issues.push(String(error));if(fs.existsSync(file))fs.renameSync(file,file+'.invalid');return {ok:false,file,issues};}
}
