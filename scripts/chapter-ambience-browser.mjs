import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';

/** Render the production room-tone module using Chromium's real WebAudio DSP.
 * This is an isolated audio check, not simulated or recorded gameplay. The
 * small static server loads only the module and its campaign-order imports. */
export async function runChapterAmbienceBrowser({browser,out='chapter-audio-evidence'}={}){
  assert.ok(browser,'A real Chromium browser is required');
  const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
  const server=http.createServer((request,response)=>{
    const name=new URL(request.url,'http://127.0.0.1').pathname;
    if(name==='/'){response.setHeader('Content-Type','text/html');response.end('<!doctype html><title>Isolated chapter audio check</title>');return;}
    const file=path.resolve(root,`.${name}`);
    if(!file.startsWith(`${root}${path.sep}`)||!name.endsWith('.js')){response.writeHead(404);response.end();return;}
    try{response.setHeader('Content-Type','text/javascript');response.end(fs.readFileSync(file));}
    catch{response.writeHead(404);response.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const page=await browser.newPage(),report={pass:false,kind:'Isolated production chapter ambience rendered by real OfflineAudioContext; not gameplay',errors:[]};
  page.on('pageerror',error=>report.errors.push(String(error)));page.setDefaultTimeout(60000);
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    Object.assign(report,await page.evaluate(async()=>{
      const {LabChapterAmbience}=await import('/src/game/LabChapterAmbience.js');
      const sampleRate=22050,duration=12;
      const check=(condition,message)=>{if(!condition)throw new Error(message);};
      const graph=(index,volume=.65,seconds=duration)=>{
        const context=new OfflineAudioContext(2,sampleRate*seconds,sampleRate),master=context.createGain();
        master.gain.value=volume;master.connect(context.destination);
        const noise=context.createBuffer(1,sampleRate,sampleRate),data=noise.getChannelData(0);
        let seed=71473;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*.5;}
        const ambience=new LabChapterAmbience(context,noise,master,index);
        return {context,ambience};
      };
      const measure=buffer=>{
        const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
        let energy=0,peak=0,stereo=0,derivative=0;
        for(let i=1;i<left.length;i++){
          const a=left[i],b=right[i];check(Number.isFinite(a)&&Number.isFinite(b),'Nonfinite rendered ambience');
          energy+=a*a+b*b;peak=Math.max(peak,Math.abs(a),Math.abs(b));
          stereo+=(a-b)**2;derivative+=(a-left[i-1])**2;
        }
        return {rms:Math.sqrt(energy/(left.length*2)),peak,stereoDifferenceRms:Math.sqrt(stereo/left.length),derivativeRms:Math.sqrt(derivative/left.length)};
      };
      const stages=[],renders=[];
      for(const [index,id] of [[0,'discovery'],[10,'dynamo'],[20,'biosphere'],[30,'observatory'],[41,'fracture'],[40,'castle']]){
        const {context,ambience}=graph(index);check(ambience.id===id,`Incorrect stable chapter mapping for ${id}`);
        const buffer=await context.startRendering(),measurement=measure(buffer);
        check(measurement.rms>1e-4&&measurement.peak<.02,`${id} is silent or exceeds the quiet room-tone ceiling`);
        check(measurement.stereoDifferenceRms>1e-5,`${id} lost its subtle stereo width`);
        stages.push({index,id,...measurement});renders.push(buffer.getChannelData(0));ambience.dispose();
      }
      const correlations=[];
      for(let a=0;a<renders.length;a++)for(let b=a+1;b<renders.length;b++){
        let sum=0,aa=0,bb=0;
        for(let i=0;i<renders[a].length;i++){sum+=renders[a][i]*renders[b][i];aa+=renders[a][i]**2;bb+=renders[b][i]**2;}
        const correlation=Math.abs(sum/Math.sqrt(aa*bb));
        check(correlation<.7,`${stages[a].id}/${stages[b].id} produced nearly the same room tone`);
        correlations.push({a:stages[a].id,b:stages[b].id,correlation});
      }
      const silent=graph(40,0,2),silence=measure(await silent.context.startRendering());silent.ambience.dispose();
      check(silence.peak===0,'The existing master mute must silence every ambience source');
      const changing=graph(0,.65,6),sources=[...changing.ambience.sources],nodes=changing.ambience.nodes.length;
      const pause=changing.context.suspend(2.5),rendering=changing.context.startRendering();
      await pause;const switchTime=changing.context.currentTime;changing.ambience.setChapter(40);
      check(changing.ambience.nodes.length===nodes&&changing.ambience.sources.every((source,index)=>source===sources[index]),'Chapter switching replaced persistent audio nodes');
      await changing.context.resume();const changed=await rendering,transition=measure(changed);
      const samples=changed.getChannelData(0),boundary=Math.floor(switchTime*sampleRate);
      let boundaryStep=0;for(let i=boundary-128;i<boundary+128;i++)boundaryStep=Math.max(boundaryStep,Math.abs(samples[i]-samples[i-1]));
      check(boundaryStep<.005&&transition.peak<.02,'Chapter transition introduced a click or loud transient');
      changing.ambience.dispose();
      return {pass:true,sampleRate,duration,stages,correlations,mutedPeak:silence.peak,transition:{switchTime,boundaryStep,...transition}};
    }));
    assert.equal(report.errors.length,0,`Page errors: ${report.errors.join('; ')}`);assert.equal(report.pass,true);
    console.log(`CHAPTER AMBIENCE VERIFIED ${JSON.stringify(report.stages.map(({id,rms,peak})=>({id,rms,peak})))}`);
    return report;
  }catch(error){report.pass=false;report.error=String(error);throw error;}
  finally{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await page.close();await new Promise(resolve=>server.close(resolve));}
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const {default:puppeteer}=await import('puppeteer-core');
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,
    timeout:60000,protocolTimeout:120000,args:['--no-sandbox','--disable-dev-shm-usage']});
  try{await runChapterAmbienceBrowser({browser,out:process.env.CHAPTER_AUDIO_OUT||'chapter-audio-evidence'});}
  finally{await browser.close();}
}
