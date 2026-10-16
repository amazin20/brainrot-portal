import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import {serveFrozenCampaign} from './lib/frozen-campaign-server.mjs';
import {readStampedCampaignInfo,assertCampaignBrowserState} from './lib/campaign-browser-contract.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {CREATIVE_CAMPAIGN_REVISION} from '../src/game/LabPreferences.js';
import {isCampaignV55Path,isCampaignV56Path,isCampaignV57Path,isCampaignV58Path,isCampaignV59Path,foundationCampaignPrefix,FOUNDATION_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V57_STORAGE_PREFIX,CAMPAIGN_V58_STORAGE_PREFIX,CAMPAIGN_PREFERENCE_KEY} from '../src/game/LabCampaignStorage.js';

const out=path.resolve(process.env.OUT_DIR||'qa/campaign-save-isolation');fs.mkdirSync(out,{recursive:true});
const mounted=process.env.PAGE_URL?null:await serveFrozenCampaign(process.env.SITE_DIR||'dist');
const base=new URL(process.env.PAGE_URL||mounted.url);assert.ok(isCampaignV55Path(base.pathname)||isCampaignV56Path(base.pathname)||isCampaignV57Path(base.pathname)||isCampaignV58Path(base.pathname)||isCampaignV59Path(base.pathname),'Save isolation proof requires the actual candidate entry path');
const ownPrefix=foundationCampaignPrefix(base.pathname);
const oldPrefixes=['',FOUNDATION_STORAGE_PREFIX,'brainrot-open-rebuild-v1:','brainrot-puzzle-pilot43-v1:','brainrot-puzzle-progression-finale-v1:','brainrot-foundation20-physical-v1:','brainrot-tower41-native-v2:','brainrot-tower41-native-v3:'];
if(isCampaignV56Path(base.pathname)||isCampaignV57Path(base.pathname)||isCampaignV58Path(base.pathname)||isCampaignV59Path(base.pathname))oldPrefixes.push(CAMPAIGN_V55_STORAGE_PREFIX);
if(isCampaignV57Path(base.pathname)||isCampaignV58Path(base.pathname)||isCampaignV59Path(base.pathname))oldPrefixes.push(CAMPAIGN_V56_STORAGE_PREFIX);
if(isCampaignV58Path(base.pathname)||isCampaignV59Path(base.pathname))oldPrefixes.push(CAMPAIGN_V57_STORAGE_PREFIX);
if(isCampaignV59Path(base.pathname))oldPrefixes.push(CAMPAIGN_V58_STORAGE_PREFIX);
const importedPrefix=isCampaignV59Path(base.pathname)?CAMPAIGN_V58_STORAGE_PREFIX:isCampaignV58Path(base.pathname)?CAMPAIGN_V57_STORAGE_PREFIX:isCampaignV57Path(base.pathname)?CAMPAIGN_V56_STORAGE_PREFIX:isCampaignV56Path(base.pathname)?CAMPAIGN_V55_STORAGE_PREFIX:FOUNDATION_STORAGE_PREFIX;
const expectedImport={completed:isCampaignV59Path(base.pathname)?[0,1,6]:[0,1,6,9],hints:{1:2},resumeLevel:3,quality:'low',volume:.29,muted:true,tutorial:true};
const historicalImport=isCampaignV59Path(base.pathname)?{...expectedImport,completed:[...expectedImport.completed,40],hints:{...expectedImport.hints,40:3}}:expectedImport;
const records=oldPrefixes.map((prefix,index)=>[prefix+CAMPAIGN_PREFERENCE_KEY,JSON.stringify({campaignRevision:CREATIVE_CAMPAIGN_REVISION,
 ...(prefix===importedPrefix?historicalImport:{completed:[0],hints:{},resumeLevel:0,quality:'balanced',volume:.21,muted:false,tutorial:false}),historicalNamespace:index},null,2)]);
const oldRecord=Object.fromEntries(records),ownKey=ownPrefix+CAMPAIGN_PREFERENCE_KEY;
const report={sourceCommit:process.env.BUILD_COMMIT??null,url:base.href,pass:false,errors:[],checks:[],
 scope:'Frozen production bytes mounted at the candidate subpath; first import, ordinary Play, reload and menu settings. This UI/storage proof does not assert puzzle completion.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
let browser;
async function snapshot(page){return page.evaluate(({keys,ownKey})=>({historical:Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),own:localStorage.getItem(ownKey),writes:window.__CAMPAIGN_STORAGE_WRITES__??[]}),{keys:Object.keys(oldRecord),ownKey});}
function assertIsolated(value){
 assert.deepEqual(value.historical,oldRecord,'Candidate changed a historical save byte');
 assert.ok(value.writes.every(write=>write.method!=='clear'&&write.key.startsWith(ownPrefix)),'Candidate wrote outside its private save namespace');
}
async function ready(page){await page.bringToFront();await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready'&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1',{timeout:180000});}
async function runtime(page){return page.evaluate(flagNames=>{const g=window.__NESI_DEMO_GAME__;return{levelIndex:g.levelIndex,edition:g.chamberEdition,id:g.firstLevel.id,
 flags:Object.fromEntries(flagNames.map(key=>[key,g[key]])),hudNumber:Number(document.querySelector('#level-number').textContent),
 optionNumber:Number(document.querySelector(`#level-select option[value="${g.levelIndex}"]`).textContent.match(/^\d+/)?.[0])};},Object.keys(ACTIVE_FOUNDATION_RUNTIME_FLAGS));}
try{
 report.package=await readStampedCampaignInfo(base);save();
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,protocolTimeout:180000,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();await page.setViewport({width:1024,height:768,deviceScaleFactor:1});
 page.on('pageerror',error=>report.errors.push(String(error.stack||error)));
 const seed=await page.evaluateOnNewDocument(entries=>{for(const[key,value]of entries)localStorage.setItem(key,value);},records);
 await page.evaluateOnNewDocument(()=>{
  window.__CAMPAIGN_STORAGE_WRITES__=[];
  for(const method of ['setItem','removeItem','clear']){
   const original=Storage.prototype[method];Storage.prototype[method]=function(...args){
    window.__CAMPAIGN_STORAGE_WRITES__.push({method,key:method==='clear'?'':String(args[0])});return original.apply(this,args);
   };
  }
 });
 const url=new URL(base);url.searchParams.set('debug','1');await page.goto(url.href,{waitUntil:'domcontentloaded'});
 // A reload must inspect persisted bytes, never seed the historical fixture again.
 await page.removeScriptToEvaluateOnNewDocument(seed.identifier);await ready(page);
 report.imported=await page.evaluate(()=>({...window.__NESI_PREFS__.value}));
 for(const[key,value]of Object.entries(expectedImport))assert.deepEqual(report.imported[key],value,'Incorrect imported '+key);
 assertCampaignBrowserState(await runtime(page),4);
 const imported=await snapshot(page);assertIsolated(imported);assert.ok(imported.own,'Imported preferences were not saved to the private candidate namespace');
 report.checks.push('Newest historical namespace wins over distinct older saves; settings, progress and resume import without changing any historical key');save();
 await page.click('#menu-settings-button');await page.waitForFunction(()=>document.querySelector('#menu-settings').open);
 await page.$eval('#menu-volume',input=>{input.value='37';input.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.click('#menu-tutorial');await page.click('#menu-settings-done');
 const settings=await snapshot(page);assertIsolated(settings);assert.equal(JSON.parse(settings.own).volume,.37);assert.equal(JSON.parse(settings.own).tutorial,false);
 const frames=await page.evaluate(()=>window.__NESI_DEMO_GAME__.animationFrames);
 await page.$eval('#play-button',button=>button.scrollIntoView({block:'center'}));await page.click('#play-button');
 await page.waitForFunction(previous=>window.__NESI_DEMO_GAME__?.state==='playing'&&window.__NESI_DEMO_GAME__.animationFrames>previous,{timeout:120000},frames);
 assertCampaignBrowserState(await runtime(page),4);const started=await snapshot(page);assertIsolated(started);
 assert.equal(JSON.parse(started.own).resumeLevel,3);report.checks.push('Trusted Play starts the inherited room and saves only into the candidate namespace');save();
 await page.reload({waitUntil:'domcontentloaded'});await ready(page);
 report.reloaded=await page.evaluate(()=>({...window.__NESI_PREFS__.value}));
 assert.equal(report.reloaded.volume,.37);assert.equal(report.reloaded.tutorial,false);assert.equal(report.reloaded.resumeLevel,3);
 assert.deepEqual(report.reloaded.completed,expectedImport.completed);assert.deepEqual(report.reloaded.hints,expectedImport.hints);
 assertCampaignBrowserState(await runtime(page),4);assertIsolated(await snapshot(page));
 assert.equal(await page.$eval('#level-select',select=>select.value),'3');
 report.checks.push('Reload uses the own save and retains menu settings, progress and selected room');
 assert.deepEqual(report.errors,[]);report.pass=true;save();console.log(JSON.stringify(report));
}catch(error){report.failure=String(error.stack||error);save();throw error;}
finally{await browser?.close();if(mounted)await new Promise(resolve=>mounted.server.close(resolve));save();}
