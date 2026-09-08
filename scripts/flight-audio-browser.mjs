import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

/** Isolated production WebAudio check, not a recorded gameplay route.
 * Loads the ordinary room and obtains its production audio constructor. Only
 * the separate sound controller receives supplied speeds; no actor, camera,
 * physics, portal or simulation state is assigned or advanced by this probe.
 */
export async function runFlightAudioBrowser({browser,baseUrl='http://127.0.0.1:4173/',out='flight-audio-evidence',capture=false}={}){
  assert.ok(browser,'A real CI Chromium browser is required');
  fs.mkdirSync(out,{recursive:true});
  const report={pass:false,baseUrl,kind:'Isolated production WebAudio graph check; not gameplay footage',
    analysisTap:'Flight gain only, before existing effects/master volume',errors:[]};
  const page=await browser.newPage();page.setDefaultTimeout(120000);
  page.on('pageerror',error=>report.errors.push(String(error)));
  try{
    const url=new URL(baseUrl);url.searchParams.set('debug','1');url.searchParams.set('level','1');
    await page.goto(url.href,{waitUntil:'networkidle2'});
    await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
    await page.evaluate(()=>{
      const Controller=window.__NESI_DEMO_GAME__.audio.constructor;
      window.__BRAINROT_FLIGHT_AUDIO_PROBE__=new Controller();
      document.querySelector('#play-button').addEventListener('click',()=>{
        const audio=window.__BRAINROT_FLIGHT_AUDIO_PROBE__;audio.unlock();audio.block('menu',false);
      },{once:true});
    });
    await page.click('#play-button');
    await page.waitForFunction(()=>window.__BRAINROT_FLIGHT_AUDIO_PROBE__?.context?.state==='running');
    const evidence=await page.evaluate(async capture=>{
      const audio=window.__BRAINROT_FLIGHT_AUDIO_PROBE__,context=audio.context;
      const result={pass:false,sampleRate:context.sampleRate,stages:[],lifecycle:[]};
      const analyser=context.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=0;
      audio.flightGain.connect(analyser);
      const samples=new Float32Array(analyser.fftSize),deadline=performance.now()+20000;
      const wait=ms=>new Promise((resolve,reject)=>setTimeout(()=>performance.now()>deadline?reject(new Error('Isolated audio probe exceeded 20 seconds')):resolve(),ms));
      const state=async expected=>{while(context.state!==expected)await wait(25);};
      const check=(condition,message)=>{if(!condition)throw new Error(message);};
      let recorder,destination,captureGain;const chunks=[];
      const measure=async label=>{
        let square=0,peak=0,count=0,finite=true;
        for(let block=0;block<8;block++){
          analyser.getFloatTimeDomainData(samples);
          for(const sample of samples){finite&&=Number.isFinite(sample);square+=sample*sample;peak=Math.max(peak,Math.abs(sample));count++;}
          await wait(25);
        }
        const stage={label,rms:Math.sqrt(square/count),peak,finite,contextTime:context.currentTime};result.stages.push(stage);
        check(finite&&stage.peak<.08,`${label}: nonfinite or unexpectedly loud isolated signal`);return stage;
      };
      try{
        if(capture&&typeof MediaRecorder==='function'){
          destination=context.createMediaStreamDestination();captureGain=context.createGain();
          captureGain.gain.value=audio.fx.gain.value*audio.volume;
          audio.flightGain.connect(captureGain).connect(destination);
          const mimeType=['audio/webm;codecs=opus','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type));
          check(!!mimeType,'Browser cannot record the isolated audio sample');
          recorder=new MediaRecorder(destination.stream,{mimeType});
          recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};recorder.start();
          result.recording={mimeType,tap:'Flight only, scaled by existing effect/master gains at default volume; isolated check, not gameplay'};
        }
        audio.flight(9.2,false);await wait(150);
        const ordinary=await measure('ordinary jump');check(ordinary.rms<1e-7,'An ordinary jump should not make flight noise');
        audio.flight(26,false);await wait(350);
        const fast=await measure('26 m/s flight');check(fast.rms>1e-4,'Fast flight produced no rendered audio');
        audio.flight(32,false);await wait(350);
        const maximum=await measure('32 m/s flight');check(maximum.rms>fast.rms*1.05,'Higher speed did not strengthen the actual rendered noise');
        audio.flight(0,true);await wait(400);
        const landed=await measure('grounded fade');check(landed.rms<maximum.rms*.005,'Flight audio remained audible after landing');
        for(const kind of ['mute','pause','zero-volume']){
          audio.flight(32,false);await wait(150);
          if(kind==='mute')audio.configure({muted:true});
          else if(kind==='pause')audio.block('isolated-probe',true);
          else audio.configure({volume:0});
          await state('suspended');
          const stopped={kind,state:context.state,masterGain:audio.master.gain.value,flightGain:audio.flightGain.gain.value};
          result.lifecycle.push(stopped);
          check(stopped.state==='suspended'&&stopped.masterGain===0&&stopped.flightGain===0,`${kind} did not silence/suspend the real context`);
          if(kind==='mute')audio.configure({muted:false});
          else if(kind==='pause')audio.block('isolated-probe',false);
          else audio.configure({volume:.65});
          await state('running');await wait(180);
          check(context.state==='running',`${kind} did not resume the existing context`);
          const resumed=await measure(`${kind} resumed without movement`);
          check(resumed.rms<1e-7,`${kind} restored stale flight audio`);
        }
        check(audio.context===context,'Audio lifecycle replaced the original context');
        result.pass=true;
      }catch(error){result.error=String(error);}
      finally{
        if(recorder?.state==='recording'){
          const stopped=new Promise(resolve=>{recorder.onstop=resolve;});recorder.stop();await stopped;
          const blob=new Blob(chunks,{type:recorder.mimeType});
          result.recording.data=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
          destination.stream.getTracks().forEach(track=>track.stop());captureGain.disconnect();
        }
        analyser.disconnect();audio.dispose();delete window.__BRAINROT_FLIGHT_AUDIO_PROBE__;
        const closeDeadline=performance.now()+1500;
        while(context.state!=='closed'&&performance.now()<closeDeadline)await new Promise(resolve=>setTimeout(resolve,25));
        result.disposed=context.state==='closed';
      }
      return result;
    },capture);
    if(evidence.recording?.data){
      const bytes=Buffer.from(evidence.recording.data.split(',')[1],'base64');delete evidence.recording.data;
      fs.writeFileSync(path.join(out,'isolated-flight-audio.webm'),bytes);
      evidence.recording.file='isolated-flight-audio.webm';evidence.recording.bytes=bytes.length;
    }
    Object.assign(report,evidence);
    assert.equal(report.errors.length,0,`Page errors: ${report.errors.join('; ')}`);
    assert.equal(report.pass,true,report.error||'Real WebAudio probe did not pass');
    assert.equal(report.disposed,true,'Isolated AudioContext was not closed');
    console.log(`FLIGHT AUDIO VERIFIED ${JSON.stringify(report.stages.map(({label,rms,peak})=>({label,rms,peak})))}`);
    return report;
  }catch(error){report.pass=false;report.error=String(error);throw error;}
  finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await page.close();}
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const {default:puppeteer}=await import('puppeteer-core');
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,
    timeout:60000,protocolTimeout:120000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{await runFlightAudioBrowser({browser,baseUrl:process.env.FLIGHT_AUDIO_URL||'http://127.0.0.1:4173/',
    out:process.env.FLIGHT_AUDIO_OUT||'flight-audio-evidence',capture:process.env.FLIGHT_AUDIO_CAPTURE!=='0'});}
  finally{await browser.close();}
}
