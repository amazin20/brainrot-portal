import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const out=path.resolve('qa/render-options');fs.mkdirSync(out,{recursive:true});
const source='b1bf88fb90b85e3b0786c651fcd2ba2edcf92696';
const configs=[
 {id:'swiftshader-960',width:960,height:540,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']},
 {id:'swiftshader-640',width:640,height:360,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']},
 {id:'webgl-only-960',width:960,height:540,headless:true,args:['--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader','--disable-gpu-compositing']},
 {id:'opengl-headless-960',width:960,height:540,headless:true,args:['--use-gl=angle','--use-angle=gl','--use-cmd-decoder=passthrough']},
 {id:'opengl-xvfb-960',width:960,height:540,headless:false,args:['--use-gl=angle','--use-angle=gl','--use-cmd-decoder=passthrough']},
];
const results=[];
for(const config of configs){
 const result={...config,sourceCommit:source,errors:[]};let browser;
 try{
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:config.headless,protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage',...config.args]});
  const page=await browser.newPage();page.setDefaultTimeout(45000);await page.setViewport({width:config.width,height:config.height,deviceScaleFactor:1});
  page.on('pageerror',e=>result.errors.push(String(e)));
  await page.goto('http://127.0.0.1:4173/?edition=foundation&level=41&debug=1',{waitUntil:'networkidle2',timeout:45000});
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
  const info=await page.evaluate(async()=>{const r=await fetch('build-info.json');return r.json();});assert.equal(info.commit,source);
  await page.select('#quality-select','low');await page.waitForFunction(()=>{const m=document.querySelector('#start-screen');return m&&!m.inert&&getComputedStyle(m).opacity==='1';});await page.bringToFront();await page.click('#play-button');
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
  await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
  result.measurement=await page.evaluate(({width,height})=>{
   const g=window.__NESI_DEMO_GAME__,before=JSON.stringify([g.elapsed,...g.playerPosition.toArray(),g.firstLevel.completedStages]);
   const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d',{alpha:false});
   const gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
   const renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
   const take=()=>{g.render();ctx.drawImage(g.renderer.domElement,0,0,width,height);return c.toDataURL('image/jpeg',.83);};take();
   const times=[];let image;for(let i=0;i<8;i++){const t=performance.now();image=take();times.push(performance.now()-t);}
   const pixels=ctx.getImageData(0,0,width,height).data;let lo=255,hi=0;for(let i=0;i<pixels.length;i+=97*4){const l=(pixels[i]+pixels[i+1]+pixels[i+2])/3;lo=Math.min(lo,l);hi=Math.max(hi,l);}
   const after=JSON.stringify([g.elapsed,...g.playerPosition.toArray(),g.firstLevel.completedStages]);if(before!==after)throw Error('Benchmark changed gameplay');
   return {renderer,timesMs:times,meanMs:times.reduce((s,t)=>s+t,0)/times.length,drawCalls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,
    actualCanvas:[g.renderer.domElement.width,g.renderer.domElement.height],pixelRange:[lo,hi],image,unchangedGameplay:true};
  },config);
  fs.writeFileSync(path.join(out,config.id+'.jpg'),Buffer.from(result.measurement.image.split(',')[1],'base64'));delete result.measurement.image;
  assert.deepEqual(result.measurement.actualCanvas,[config.width,config.height]);assert.ok(result.measurement.pixelRange[1]-result.measurement.pixelRange[0]>40,'Empty render');assert.deepEqual(result.errors,[]);result.pass=true;
 }catch(error){result.pass=false;result.error=String(error);}
 finally{if(browser)await browser.close();results.push(result);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({method:'Frozen-start render/readback benchmark only. No game changes, walkthrough, publication or hardware FPS claim.',results},null,2));console.log('RENDER OPTION',JSON.stringify(result));}
}
assert.ok(results.some(r=>r.pass),'No valid rendering backend');
