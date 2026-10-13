import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {serveFrozenCampaign} from './lib/frozen-campaign-server.mjs';
import {captureBrowserFrame} from './qa-browser-capture.mjs';
import {readStampedCampaignInfo} from './lib/campaign-browser-contract.mjs';
import {foundationCampaignPrefix,CAMPAIGN_PREFERENCE_KEY} from '../src/game/LabCampaignStorage.js';
import {SINGULARITY_ROOMS} from '../src/game/LabSingularityLayout.js';
import {CASTLE_WING_FINISHES} from '../src/game/LabCastleMaterials.js';

// Inspection changes only the camera. All opaque roofs, partitions, doors,
// actors and machinery retain their actual visibility and production poses.
function inspectWing(id,view){
 const g=window.__NESI_DEMO_GAME__,r=g.firstLevel.rooms.get(id),{b,def}=r;
 const V=(x=0,y=0,z=0)=>g.playerPosition.clone().set(x,y,z),base=def.at[1],roof=base+def.h;
 const actorState=()=>JSON.stringify([g.state,g.elapsed,...g.playerPosition.toArray(),...g.cargo.position.toArray(),g.physics.cargoBody.id]);
 const visibility=[];g.scene.traverse(o=>visibility.push([o.uuid,o.visible]));
 const before=actorState(),solid=g.colliders.filter(c=>c.enabled!==false&&!c.mesh.material?.transparent);
 const ray=g.raycaster.ray.clone(),hit=V(),clear=(eye,p)=>{
  const delta=p.clone().sub(eye),length=delta.length();ray.set(eye,delta.normalize());
  return !solid.some(c=>ray.intersectBox(c.box,hit)&&eye.distanceTo(hit)<length-.13);
 };
 const inside=p=>p.x>b.x0+.7&&p.x<b.x1-.7&&p.z>b.z0+.7&&p.z<b.z1-.7&&p.y>=base&&p.y<roof-1;
 const targets=[];
 for(const f of g.floors)if(f.enabled!==false&&f.y>=base-.1&&f.y<roof-2){
  const x0=Math.max(f.minX,b.x0),x1=Math.min(f.maxX,b.x1),z0=Math.max(f.minZ,b.z0),z1=Math.min(f.maxZ,b.z1);
  if(x1-x0<1||z1-z0<1)continue;
  const n=(x1-x0)*(z1-z0)>100?7:3;
  for(let u=0;u<n;u++)for(let v=0;v<n;v++){
   const p=V(x0+(x1-x0)*(u+.5)/n,f.y+.16,z0+(z1-z0)*(v+.5)/n);
   if(inside(p)&&!solid.some(c=>c.box.containsPoint(p)))targets.push({kind:'floor',point:p});
  }
 }
 for(const panel of g.portalPanels){
  const f=panel.userData.portalFrame?.()||{center:panel.userData.center,normal:panel.userData.normal};
  if(f.center&&f.normal){const point=f.center.clone().addScaledVector(f.normal,.16);if(inside(point))targets.push({kind:'portal',point});}
 }
 if(targets.length<3)throw Error('No actual interior inspection targets in '+id);
 const eyes=[];
 for(const y of [base+def.h*.63,roof-2.5,base+4.5])for(const [u,v]of [[.16,.16],[.84,.16],[.16,.84],[.84,.84],[.5,.16],[.5,.84]])
  eyes.push(V(b.x0+(b.x1-b.x0)*u,y,b.z0+(b.z1-b.z0)*v));
 g.scene.updateMatrixWorld(true);g.camera.fov=78;g.camera.far=245;g.camera.updateProjectionMatrix();
 const candidates=[];
 for(const eye of eyes){
  if(!inside(eye)||solid.some(c=>c.box.clone().expandByScalar(.25).containsPoint(eye)))continue;
  const visible=targets.filter(t=>clear(eye,t.point));if(visible.length<3)continue;
  const aim=visible.reduce((sum,t)=>sum.add(t.point),V()).multiplyScalar(1/visible.length);
  g.camera.position.copy(eye);g.camera.lookAt(aim);g.camera.updateMatrixWorld(true);
  const framed=visible.filter(t=>{const p=t.point.clone().project(g.camera);return Math.abs(p.x)<.90&&Math.abs(p.y)<.84&&p.z>-1&&p.z<1;});
  if(framed.filter(t=>t.kind==='floor').length>=3)candidates.push({eye,aim,framed,score:framed.reduce((sum,t)=>sum+(t.kind==='portal'?5:1),0)});
 }
 candidates.sort((a,b)=>b.score-a.score);
 if(!candidates.length)throw Error('No clear camera inside actual roof of '+id);
 const first=candidates[0],ordered=view?candidates.filter(c=>c.eye.distanceTo(first.eye)>Math.min(def.w,def.d)*.35):candidates;
 const meshes=[];g.scene.traverseVisible(o=>{if(o.isMesh&&!o.userData.collisionProxy)meshes.push(o);});
 let chosen;
 for(const c of ordered.slice(0,8)){
  const observed=c.framed.filter(t=>{
   const delta=t.point.clone().sub(c.eye);g.raycaster.set(c.eye,delta.clone().normalize());g.raycaster.far=delta.length()-.13;
   return !g.raycaster.intersectObjects(meshes,false).some(h=>{
    const m=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex??0]:h.object.material;
    return m?.visible!==false&&!(m?.transparent&&m.opacity<.95);
   });
  });
  if(observed.filter(t=>t.kind==='floor').length>=3){chosen={...c,observed};break;}
 }
 g.raycaster.far=Infinity;
 if(!chosen)throw Error('Rendered geometry occludes actual interior targets of '+id);
 g.camera.position.copy(chosen.eye);g.camera.lookAt(chosen.aim);g.camera.updateMatrixWorld(true);g.render();
 const afterVisibility=[];g.scene.traverse(o=>afterVisibility.push([o.uuid,o.visible]));
 if(before!==actorState()||JSON.stringify(visibility)!==JSON.stringify(afterVisibility))throw Error('Inspection changed gameplay or geometry visibility');
 return {id,name:def.name,view,kind:'camera-only-interior-inspection',bounds:{...b,base,roof},eye:chosen.eye.toArray(),target:chosen.aim.toArray(),roofClearance:roof-chosen.eye.y,
  visibleFloorPoints:chosen.observed.filter(t=>t.kind==='floor').length,visiblePortalPoints:chosen.observed.filter(t=>t.kind==='portal').length,
  observedTargets:chosen.observed.map(t=>({kind:t.kind,point:t.point.toArray()})),actorsUnchanged:true,geometryVisibilityChanged:false};
}

const out=path.resolve(process.env.OUT_DIR||'qa/castle-interiors');fs.mkdirSync(out,{recursive:true});
const mount=process.env.PAGE_URL?null:await serveFrozenCampaign(process.env.SITE_DIR||'dist');
const base=new URL(process.env.PAGE_URL||mount.url);
const report={sourceCommit:process.env.BUILD_COMMIT??null,url:base.href,pass:false,rows:[],errors:[],
 scope:'Two actual camera-only views inside each of eleven opaque-roof castle wings. These frames cover visible sectors and do not claim puzzle completion or every hidden surface.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
let browser;
try{
 report.package=await readStampedCampaignInfo(base);save();
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,protocolTimeout:240000,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();await page.setViewport({width:960,height:540,deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(String(e.stack||e)));
 await page.evaluateOnNewDocument(key=>localStorage.setItem(key,JSON.stringify({quality:'balanced',muted:true,tutorial:false})),foundationCampaignPrefix(base.pathname)+CAMPAIGN_PREFERENCE_KEY);
 const url=new URL(base);url.search='?edition=foundation&level=41&debug=1';await page.goto(url.href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready'&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1',{timeout:240000});
 await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
 report.architecture=await page.evaluate(()=>{
  const g=window.__NESI_DEMO_GAME__,art=g.firstLevel.castleInteriorArt,finishes={};
  g.scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.name&&/^Castle (wing wall|cast-in floor) \/ /.test(m.name))finishes[m.name]=m.color.getHex();});
  return {diagnostics:art?.diagnostics??null,finishes};
 });
 for(const [id,finish]of Object.entries(CASTLE_WING_FINISHES))for(const [name,key]of [['wing wall','wall'],['cast-in floor','floor']])
  assert.equal(report.architecture.finishes[`Castle ${name} / ${id}`],finish[key],`${id} ${key} was flattened to the common castle palette`);
 assert.equal(report.architecture.diagnostics?.wings,SINGULARITY_ROOMS.length,'Every castle wing must have backed interior architecture');
 assert.ok(report.architecture.diagnostics.batches<=3&&report.architecture.diagnostics.maxProjection<=.09);
 const wings=process.env.WINGS?SINGULARITY_ROOMS.filter(r=>process.env.WINGS.split(',').includes(r.id)):SINGULARITY_ROOMS;
 for(const wing of wings)for(const view of [0,1]){
  const row=await page.evaluate('('+inspectWing.toString()+')('+JSON.stringify(wing.id)+','+view+')');
  row.capture=await captureBrowserFrame(page,path.join(out,`${wing.id}-${view}.jpg`),{canvasOnly:true,timeoutMs:120000});
  assert.ok(row.capture.ok,'Actual interior pixel capture failed: '+wing.id);
  row.sha256=crypto.createHash('sha256').update(fs.readFileSync(row.capture.file)).digest('hex');
  row.pass=true;report.rows.push(row);save();console.log('INTERIOR',wing.id,view,row.visibleFloorPoints,row.visiblePortalPoints);
 }
 assert.equal(report.rows.length,wings.length*2);assert.deepEqual(report.errors,[]);report.pass=true;save();
}catch(error){report.error=String(error.stack||error);save();throw error;}
finally{await browser?.close();if(mount)await new Promise(resolve=>mount.server.close(resolve));save();}
