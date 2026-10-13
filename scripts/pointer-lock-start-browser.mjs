import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {playFromReachableMenu} from './lib/release-session-ui.mjs';
import {serveFrozenCampaign} from './lib/frozen-campaign-server.mjs';
import {readStampedCampaignInfo,assertCampaignBrowserState} from './lib/campaign-browser-contract.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {CAMERA_PITCH_MIN,CAMERA_PITCH_MAX} from '../src/game/LabCamera.js';

/** Native Play and mouse input on the real game. Reads input/camera state for
 * evidence; never assigns actor positions, camera angles, controls or time. */
export async function runPointerLockStartBrowser({browser,baseUrl='http://127.0.0.1:4173/',out='camera-start-evidence',levels=[5,23,5,23]}={}){
  assert.ok(browser,'A real Chromium browser is required');fs.mkdirSync(out,{recursive:true});
  const report={pass:false,sourceCommit:process.env.BUILD_COMMIT??null,kind:'Native trusted Play and genuine locked mouse movement; no camera or simulation assignments',baseUrl,rows:[],errors:[]};
  const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  try{
    report.package=await readStampedCampaignInfo(baseUrl);save();
    for(const [run,level] of levels.entries()){
      const page=await browser.newPage();page.setDefaultTimeout(120000);await page.setViewport({width:1280,height:800});
      page.on('pageerror',error=>report.errors.push(String(error)));
      try{
        await page.evaluateOnNewDocument(()=>{
          window.__CAMERA_START_PROBE__={events:[],byEvent:new WeakMap()};
          for(const type of ['mousemove','pointerlockchange'])window.addEventListener(type,event=>{
            const game=window.__NESI_DEMO_GAME__;
            const entry={type,trusted:event.isTrusted,timeStamp:event.timeStamp,now:performance.now(),
              movementX:event.movementX,movementY:event.movementY,locked:document.pointerLockElement===game?.renderer?.domElement,
              yaw:game?.yaw,pitch:game?.pitch,lastUnlockedMotion:game?.controls?.lastUnlockedMotion,pendingLockRebound:game?.controls?.pendingLockRebound};
            window.__CAMERA_START_PROBE__.events.push(entry);
            window.__CAMERA_START_PROBE__.byEvent.set(event,entry);
          },{capture:true});
        });
        const url=new URL(baseUrl);url.search=`?edition=foundation&level=${level}&debug=1`;
        await page.goto(url.href,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
        // Register after the production controls, in the same bubble phase.
        // A microtask from capture can run between native event listeners and
        // would describe the state before the actual mouse handler executed.
        await page.evaluate(()=>{
          for(const type of ['mousemove','pointerlockchange'])window.addEventListener(type,event=>{
            const game=window.__NESI_DEMO_GAME__,entry=window.__CAMERA_START_PROBE__.byEvent.get(event);
            if(entry)entry.after={yaw:game.yaw,pitch:game.pitch};
          });
        });
        const runtime=await page.evaluate(flagNames=>{const game=window.__NESI_DEMO_GAME__;return {levelIndex:game.levelIndex,edition:game.chamberEdition,id:game.firstLevel.id,
          flags:Object.fromEntries(flagNames.map(key=>[key,game[key]])),physicalRoom23:Boolean(game.firstLevel.room23PhysicalPrototype),
          hudNumber:Number(document.querySelector('#level-number').textContent),optionNumber:Number(document.querySelector(`#level-select option[value="${game.levelIndex}"]`).textContent.match(/^\d+/)?.[0])};},Object.keys(ACTIVE_FOUNDATION_RUNTIME_FLAGS));
        assertCampaignBrowserState(runtime,level);
        const expected=await page.evaluate(()=>{const game=window.__NESI_DEMO_GAME__;return {yaw:game.firstLevel.spawnView?.yaw??0,pitch:game.firstLevel.spawnView?.pitch??-.15,frames:game.renderFrames};});
        const play=await playFromReachableMenu(page);
        await page.waitForFunction(frames=>{const game=window.__NESI_DEMO_GAME__;return game.state==='playing'&&document.pointerLockElement===game.renderer.domElement&&game.renderFrames>=frames+4;},{},expected.frames);
        const before=await page.evaluate(()=>{const game=window.__NESI_DEMO_GAME__;return {yaw:game.yaw,pitch:game.pitch,frames:game.renderFrames,camera:game.camera.position.toArray(),events:window.__CAMERA_START_PROBE__.events.length};});
        const row={run,level,runtime,trustedPlay:play.trusted,expected,before};report.rows.push(row);save();
        assert.ok(Math.abs(before.yaw-expected.yaw)<1e-10&&Math.abs(before.pitch-expected.pitch)<1e-10,`Room ${level} changed spawn view without genuine camera input`);
        row.screenshot=`room-${level}-run-${run+1}-start.png`;await page.screenshot({path:path.join(out,row.screenshot)});
        // Headless Chromium recentres its native pointer at (0,0) on lock.
        // Move a small distance from that origin, not from the menu button's
        // former absolute coordinate. The actual trusted deltas are recorded.
        await page.mouse.move(18,9);
        await page.waitForFunction(events=>window.__CAMERA_START_PROBE__.events.slice(events).some(event=>event.type==='mousemove'&&event.trusted&&event.locked&&(event.movementX||event.movementY)),{},before.events);
        row.after=await page.evaluate(()=>{const game=window.__NESI_DEMO_GAME__;return {yaw:game.yaw,pitch:game.pitch,events:window.__CAMERA_START_PROBE__.events};});
        const movement=row.after.events.slice(before.events).filter(event=>event.type==='mousemove'&&event.trusted&&event.locked&&(event.movementX||event.movementY));
        assert.ok(movement.length>0&&Math.abs(movement[0].movementX)<=24&&Math.abs(movement[0].movementY)<=24,'The first genuine native look must be a small mouse movement');
        let yaw=before.yaw,pitch=before.pitch;
        for(const event of movement){
          yaw-=event.movementX*.002;pitch=Math.min(CAMERA_PITCH_MAX,Math.max(CAMERA_PITCH_MIN,pitch-event.movementY*.0018));
          assert.ok(Math.abs(event.after.yaw-yaw)<1e-10&&Math.abs(event.after.pitch-pitch)<1e-10,`Room ${level} discarded genuine mouse input or changed sensitivity`);
        }
        row.nativeLook=movement.map(({movementX,movementY,trusted})=>({movementX,movementY,trusted}));
        save();
        console.log(`NATIVE CAMERA START VERIFIED ${JSON.stringify({level,run,yaw:before.yaw,pitch:before.pitch,look:row.nativeLook})}`);
      }finally{await page.close();}
    }
    assert.equal(report.errors.length,0,`Page errors: ${report.errors.join('; ')}`);report.pass=true;return report;
  }catch(error){report.error=String(error);throw error;}
  finally{save();}
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const {default:puppeteer}=await import('puppeteer-core');
  const suppliedUrl=process.env.CAMERA_START_URL||process.env.PAGE_URL;
  const mounted=suppliedUrl?null:await serveFrozenCampaign(process.env.SITE_DIR||'dist');
  let browser;
  try{
    browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,
      timeout:60000,protocolTimeout:120000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    await runPointerLockStartBrowser({browser,baseUrl:suppliedUrl||mounted.url,out:process.env.OUT_DIR||process.env.CAMERA_START_OUT||'camera-start-evidence'});
  }finally{await browser?.close();if(mounted)await new Promise(resolve=>mounted.server.close(resolve));}
}
