/** Native menu/copy/layout review. DEV access is used only to inspect cards;
 * this is not a production-unlock, gameplay, live-SDK or hardware acceptance.
 * SOURCE_ROOT, OUT_DIR, CHROME_PATH, PUPPETEER_MODULE and PORT are configurable.
 * Outputs must be new so failed or historical evidence cannot be overwritten. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';

const root=path.resolve(process.env.SOURCE_ROOT||process.cwd());
const out=path.resolve(process.env.OUT_DIR||path.join(root,'qa/campaign-menu-visual'));
const chrome=process.env.CHROME_PATH;
assert.ok(chrome&&fs.existsSync(chrome),'Set CHROME_PATH to the actual browser executable');
assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Use a new empty OUT_DIR');
fs.mkdirSync(out,{recursive:true});
const moduleName=process.env.PUPPETEER_MODULE||'puppeteer-core';
const puppeteer=(await import(path.isAbsolute(moduleName)?pathToFileURL(moduleName).href:moduleName)).default;
const port=Number(process.env.PORT||4293);
assert.ok(Number.isInteger(port)&&port>1024&&port<65536,'Valid unprivileged PORT required');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const walkFiles=directory=>fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>{
 const p=path.join(directory,entry.name);
 return entry.isDirectory()?walkFiles(p):entry.isFile()?[p]:[];
});
function sourceSnapshot(){
 const files=['src','public'].flatMap(name=>walkFiles(path.join(root,name)));
 for(const name of ['index.html','package.json','package-lock.json','vite.config.js']){
  const p=path.join(root,name);if(fs.existsSync(p))files.push(p);
 }
 return Object.fromEntries(files.sort().map(p=>[path.relative(root,p).split(path.sep).join('/'),digest(fs.readFileSync(p))]));
}
const commit=()=>{try{return execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch{return null;}};
const controller=fileURLToPath(import.meta.url);
const report={
 schemaVersion:1,kind:'native-development-campaign-menu-visual',capturedAt:new Date().toISOString(),
 scope:'Native menu clicks and real CSS text bounds. DEV access permits inspecting all 51 active cards; no production progression, gameplay completion, live SDK, human puzzle-discovery or physical-device acceptance.',
 sourceCommitStart:commit(),controllerSha256:digest(fs.readFileSync(controller)),sourceStart:sourceSnapshot(),
 titleRows:[],cardRows:[],clicks:[],screenshots:[],errors:[],overflows:[],pass:false,
};
const {campaignSpec}=await import(pathToFileURL(path.join(root,'src/game/LabCampaignLevels.js')).href);
const {ACTIVE_FOUNDATION_RUNTIME_FLAGS}=await import(pathToFileURL(path.join(root,'src/game/ReleaseIdentity.js')).href);
const specs=Array.from({length:51},(_,index)=>campaignSpec({chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS},index));
const views=[[1280,720],[390,844],[320,568],[820,900],[1100,720]];
let browser,page,server;
function boundsInPage(selector){
 const node=document.querySelector(selector);if(!node)throw Error('Missing '+selector);
 const b=node.getBoundingClientRect(),style=getComputedStyle(node),range=document.createRange();range.selectNodeContents(node);
 const lines=[...range.getClientRects()].filter(r=>r.width>.05&&r.height>.05).map(r=>({x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}));
 let left=Math.max(0,b.left+parseFloat(style.paddingLeft||0)),right=Math.min(innerWidth,b.right-parseFloat(style.paddingRight||0));
 const containers=[];let verticalClipped=false,canScrollVertically=false;
 for(let parent=node;parent;parent=parent.parentElement){
  const rect=parent.getBoundingClientRect(),css=getComputedStyle(parent);
  if(parent!==node&&rect.width>0&&css.display!=='contents'){
   const contentLeft=rect.left+parseFloat(css.borderLeftWidth||0)+parseFloat(css.paddingLeft||0);
   const contentRight=rect.right-parseFloat(css.borderRightWidth||0)-parseFloat(css.paddingRight||0);
   left=Math.max(left,contentLeft);right=Math.min(right,contentRight);
   containers.push({tag:parent.tagName,id:parent.id,className:parent.className,left:contentLeft,right:contentRight});
  }
  // Font Range em boxes can extend above a tight line-height without clipped
  // ink. Reject real hidden/clip overflow, not those normal font metrics.
  // Content inside a scrolling screen may be below the current viewport.
  if(!canScrollVertically&&['hidden','clip'].includes(css.overflowY)&&parent.scrollHeight>parent.clientHeight+1)verticalClipped=true;
  if(['auto','scroll'].includes(css.overflowY))canScrollVertically=true;
 }
 const horizontalOverflow=lines.some(r=>r.x<left-1||r.right>right+1);
 return{text:node.textContent,box:{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom},lines,
  visible:style.display!=='none'&&style.visibility!=='hidden',scrollWidth:node.scrollWidth,clientWidth:node.clientWidth,
  contentLimits:{left,right},containers,horizontalOverflow,verticalClipped,overflow:horizontalOverflow||verticalClipped};
}
async function nativeClick(selector){
 const before=await page.evaluate(()=>window.__menuNativeClicks.length);
 const point=await page.evaluate(async selector=>{
  const target=document.querySelector(selector);if(!target)throw Error('Missing click target '+selector);
  target.scrollIntoView({block:'center',inline:'center',behavior:'instant'});
  const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  await frame();const first=target.getBoundingClientRect();await frame();const b=target.getBoundingClientRect();
  if(Math.abs(first.x-b.x)>.5||Math.abs(first.y-b.y)>.5)throw Error('Moving click target '+selector);
  const x=b.x+b.width/2,y=b.y+b.height/2,hit=document.elementFromPoint(x,y);
  if(!(b.width>0&&b.height>0&&x>0&&y>0&&x<innerWidth&&y<innerHeight&&target.contains(hit)))throw Error('Native target is occluded '+selector+' at '+JSON.stringify({x,y,hit:hit?.className}));
  return{x,y,scroll:document.querySelector('#start-screen').scrollTop};
 },selector);
 await page.mouse.click(point.x,point.y);
 await page.waitForFunction(count=>window.__menuNativeClicks.length>count,{timeout:5000},before);
 const event=await page.evaluate(()=>window.__menuNativeClicks.at(-1));
 report.clicks.push({selector,...point,event});
 const matched=await page.evaluate(({selector,event})=>{
  const target=document.querySelector(selector);
  return target?.dataset.roomIndex!==undefined?String(event.roomIndex)===target.dataset.roomIndex:
   target?.dataset.sector!==undefined?String(event.sector)===target.dataset.sector:false;
 },{selector,event});
 assert.ok(matched,'Actual native click landed on a different target: '+selector+' '+JSON.stringify(event));
}
async function sectorSelect(sector){
 await nativeClick('.sector-tabs button[data-sector="'+sector+'"]');
 await page.waitForFunction(sector=>document.querySelector('.sector-tabs button[aria-selected="true"]')?.dataset.sector===String(sector),{timeout:5000},sector);
}
async function choose(index,width,height,completeSweep){
 await nativeClick('.room-node[data-room-index="'+index+'"]');
 await page.waitForFunction(index=>document.querySelector('#level-select').value===String(index),{timeout:5000},index);
 const card=await page.evaluate(boundsSource=>{
  const bounds=(0,eval)('('+boundsSource+')');
  return{title:document.querySelector('#selected-room-title').textContent,titleAria:document.querySelector('#selected-room-title').getAttribute('aria-label'),description:document.querySelector('#selected-room-description').textContent,
   number:document.querySelector('#selected-room-number').textContent,titleBounds:bounds('#selected-room-title'),descriptionBounds:bounds('#selected-room-description')};
 },boundsInPage.toString());
 assert.equal(card.title.replace(/\u00ad/g,''),specs[index].title);
 assert.equal(card.titleAria,specs[index].title);
 assert.equal(card.description,specs[index].description.split(/(?<=\.)\s+/)[0]);
 const number=index<40?index+1:index===40?51:index;
 assert.equal(card.number,'КОМНАТА '+String(number).padStart(2,'0'));
 for(const [field,bounds]of Object.entries({title:card.titleBounds,description:card.descriptionBounds})){
  if(!bounds.visible||bounds.overflow||bounds.box.width<=0||bounds.box.height<=0)report.overflows.push({width,height,index,field,bounds});
 }
 report.cardRows.push({width,height,index,completeSweep,...card});
}
async function capture(index,width,height){
 await page.$eval('.mission-panel',node=>node.scrollIntoView({block:'center',behavior:'instant'}));
 const name='room-'+(index+1)+'-'+width+'x'+height+'.png';
 await page.screenshot({path:path.join(out,name)});
 report.screenshots.push({name,width,height,index});
}
try{
 server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});
 const serverErrors=[];server.stderr.on('data',b=>serverErrors.push(String(b)));
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Vite startup timeout '+serverErrors.join(''))),30000);
  server.stdout.on('data',b=>{if(String(b).includes('Local:')){clearTimeout(timer);resolve();}});
  server.once('error',e=>{clearTimeout(timer);reject(e);});
  server.once('exit',code=>{clearTimeout(timer);reject(Error('Vite exit '+code+' '+serverErrors.join('')));});
 });
 browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:180000});
 page=await browser.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.setViewport({width:1280,height:720});
 await page.goto('http://127.0.0.1:'+port+'/?edition=foundation&level=1&debug=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready'&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1',{timeout:180000});
 // Stop only the background renderer; this review makes no gameplay claims.
 await page.evaluate(()=>{
  window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null);
  window.__menuNativeClicks=[];
  document.addEventListener('click',event=>{const room=event.target.closest('.room-node'),sector=event.target.closest('.sector-tabs button');window.__menuNativeClicks.push({roomIndex:room?.dataset.roomIndex??null,sector:sector?.dataset.sector??null,x:event.clientX,y:event.clientY,trusted:event.isTrusted});},true);
 });
 const sectors=await page.$$eval('.sector-tabs button[data-sector]',nodes=>nodes.map(n=>n.dataset.sector));
 // All atlas labels are measured after selecting their actual chapter; no
 // game state or selected-card value is assigned by the observer.
 for(const [width,height]of views){
  await page.setViewport({width,height});
  for(const sector of sectors){
   await sectorSelect(sector);
   const rows=await page.evaluate(boundsSource=>{
    const bounds=(0,eval)('('+boundsSource+')');
    return[...document.querySelectorAll('.room-node')].map(node=>({index:Number(node.dataset.roomIndex),aria:node.getAttribute('aria-label'),bounds:bounds('.room-node[data-room-index="'+node.dataset.roomIndex+'"] .room-node-title')}));
   },boundsInPage.toString());
   for(const row of rows){
    assert.equal(row.bounds.text.replace(/\u00ad/g,''),specs[row.index].title);
    assert.ok(row.aria.includes(specs[row.index].title));
    report.titleRows.push({width,height,...row});
    if(row.bounds.overflow||!row.bounds.visible)report.overflows.push({width,height,index:row.index,field:'atlas-title',bounds:row.bounds});
   }
   if(rows.some(row=>row.bounds.overflow))await page.screenshot({path:path.join(out,'overflow-'+width+'-sector-'+sector+'.png')});
  }
  assert.equal(report.titleRows.filter(r=>r.width===width).length,51);
  console.log(JSON.stringify({phase:'atlas-labels',width,count:51,overflows:report.overflows.filter(r=>r.width===width).length}));
 }
 assert.equal(report.overflows.length,0,'Atlas title overflow; inspect report.overflows');
 for(const [width,height]of views.slice(0,2)){
  await page.setViewport({width,height});
  for(const sector of sectors){
   await sectorSelect(sector);
   const indices=await page.$$eval('.room-node',nodes=>nodes.map(node=>Number(node.dataset.roomIndex)));
   for(const index of indices){await choose(index,width,height,true);if([14,17,33,39].includes(index))await capture(index,width,height);}
  }
  assert.equal(report.cardRows.filter(r=>r.width===width&&r.completeSweep).length,51);
  console.log(JSON.stringify({phase:'all-cards',width,count:51}));
 }
 for(const [width,height]of views.slice(2)){
  await page.setViewport({width,height});
  for(const [sector,index]of [[1,14],[3,33]]){await sectorSelect(sector);await choose(index,width,height,false);await capture(index,width,height);}
 }
 assert.equal(report.cardRows.filter(r=>r.completeSweep).length,102);
 assert.equal(report.titleRows.length,255);
 assert.equal(report.overflows.length,0,'Selected-card text overflow; inspect report.overflows');
 assert.deepEqual(report.errors,[]);
 assert.ok(report.clicks.every(row=>row.event.trusted),'All actions must be actual native clicks');
 report.pass=true;
}catch(error){
 report.failure=String(error.stack||error);
 if(page&&!page.isClosed())try{await page.screenshot({path:path.join(out,'failure.png')});}catch{}
 throw error;
}finally{
 report.sourceEnd=sourceSnapshot();report.sourceCommitEnd=commit();
 const paths=new Set([...Object.keys(report.sourceStart),...Object.keys(report.sourceEnd)]);
 report.sourceDrift=[...paths].filter(p=>report.sourceStart[p]!==report.sourceEnd[p]);
 report.controllerUnchanged=report.controllerSha256===digest(fs.readFileSync(controller));
 if(report.sourceDrift.length||!report.controllerUnchanged){report.pass=false;report.provenanceFailure='Source/controller bytes changed during observation';}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 if(browser)await browser.close();
 if(server)server.kill();
}
assert.ok(report.pass,report.provenanceFailure||report.failure);
console.log(JSON.stringify({pass:report.pass,allCardChecks:102,atlasTitleChecks:255,nativeClicks:report.clicks.length,screenshots:report.screenshots.length,sourceFiles:Object.keys(report.sourceStart).length,sourceDrift:report.sourceDrift.length,errors:report.errors.length}));
