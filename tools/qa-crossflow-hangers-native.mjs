import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {campaignAccessFixture} from '../scripts/lib/campaign-access-fixture.mjs';
import {CROSSFLOW_BASELINE_COMMIT,assertKnownCrossflowBaselineFailure,acceptCrossflowComparison} from '../scripts/lib/crossflow-baseline-policy.mjs';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
const route=process.env.ROUTE||'retrieve-first';assert.ok(['retrieve-first','air-freight'].includes(route));
const out=process.env.OUT_DIR||`qa/crossflow-hangers-${route}`;
const baselineDirectory=process.env.CROSSFLOW_BASELINE_DIR||'baseline';
assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Never replace previous evidence');fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const fixture=campaignAccessFixture({levelIndex:25,pathname:'/campaign-v67/'});fixture.preferences.quality='balanced';fixture.raw=JSON.stringify(fixture.preferences);
const baselineCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:baselineDirectory,encoding:'utf8'}).trim();
assert.equal(baselineCommit,CROSSFLOW_BASELINE_COMMIT,'Never classify a different historical source as the retained negative control');
const report={sourceCommit:process.env.BUILD_COMMIT,baselineCommit,fixture,route,rows:[],pass:false,
 scope:'Two frozen production builds, camera-only matched inspections, then ordinary input from genuine Play at zero physics steps. Original actors throughout, no route resets, no target completion preseed. Software WebGL is not physical-device FPS or human playtesting.'};
for(const [version,folder]of [['after','dist'],['before',path.join(baselineDirectory,'dist')]]){
 const files=fs.readdirSync(folder,{recursive:true}).filter(file=>fs.statSync(path.join(folder,file)).isFile()).sort();
 report[version+'Build']=Object.fromEntries(files.map(file=>[file,hash(fs.readFileSync(path.join(folder,file)))]));
}
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:240000,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const version of ['before','after'])for(const [view,width,height]of [['wide',1280,720],['portrait',390,844]]){
  const row={version,view,viewport:{width,height},errors:[],consoleErrors:[],images:[],pass:false};report.rows.push(row);
  const page=await browser.newPage();await page.setViewport({width,height});
  page.on('pageerror',e=>row.errors.push(String(e.stack||e)));page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});
  const image=(label,png)=>{const bytes=Buffer.from(png,'base64');assert.ok(bytes.length>10000);const file=`${version}-${view}-${label}.png`;fs.writeFileSync(path.join(out,file),bytes);row.images.push({file,sha256:hash(bytes),bytes:bytes.length});};
  try{
   await page.evaluateOnNewDocument(({key,raw})=>{localStorage.clear();localStorage.setItem(key,raw);},fixture);
   await page.goto(`http://127.0.0.1:${version==='before'?4174:4173}/campaign-v67/?edition=foundation&level=26&debug=1`,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready'&&!document.querySelector('#start-screen').inert&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1',{timeout:180000});
   await page.evaluate(()=>{const r=window.__NESI_DEMO_GAME__.renderer;window.__HANGER_LOOP__=r.setAnimationLoop;r.setAnimationLoop=function(){return window.__HANGER_LOOP__.call(this,null);};r.setAnimationLoop(null);});
   await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
   row.inspections=[];
   for(const inspection of [{label:'lower-stop',eye:[-20,18.8,17],target:[-12,19.4,8],fov:60},{label:'upper-stop',eye:[19,20.9,-.5],target:[12,24,-8],fov:60}]){
    const result=await page.evaluate(inspection=>{
     const g=window.__NESI_DEMO_GAME__,c=g.camera,world=()=>({id:g.firstLevel.id,steps:g.physics.world.stepnumber,elapsed:g.elapsed,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),state:g.state});
     const before=world(),original={p:c.position.clone(),q:c.quaternion.clone(),fov:c.fov};
     c.position.fromArray(inspection.eye);c.lookAt(...inspection.target);c.fov=inspection.fov;c.updateProjectionMatrix();c.updateMatrixWorld(true);g.render();
     const result={before,after:world(),camera:{p:c.position.toArray(),q:c.quaternion.toArray(),fov:c.fov},png:g.renderer.domElement.toDataURL('image/png').split(',')[1]};
     c.position.copy(original.p);c.quaternion.copy(original.q);c.fov=original.fov;c.updateProjectionMatrix();c.updateMatrixWorld(true);return result;
    },inspection);
    assert.equal(result.before.id,'crossflow-foundry');assert.equal(result.before.steps,0);assert.equal(result.before.elapsed,0);assert.equal(result.before.state,'playing');assert.deepEqual(result.before,result.after);
    image(inspection.label,result.png);delete result.png;row.inspections.push({label:inspection.label,...result});save();
   }
   assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),fixture.completed);
   row.mounts=await page.evaluate(()=>{
    const g=window.__NESI_DEMO_GAME__,layer=g.firstLevel.stopHangers;
    if(!layer)return{parts:0,castings:0,contacts:[]};
    g.scene.updateMatrixWorld(true);
    const bounds=mesh=>{mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);};
    const opaque=hit=>{for(let n=hit.object;n;n=n.parent)if(!n.visible)return false;const m=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material;return m?.visible!==false&&!m?.transparent&&!hit.object.userData.collisionProxy;};
    const vector=(x,y,z)=>g.playerPosition.clone().set(x,y,z),contacts=[];
    for(const m of layer.parts){
     for(let n=m;n;n=n.parent)if(!n.visible)throw Error('Hidden hanger');
     if(m.material.visible===false||m.material.transparent)throw Error('Non-opaque hanger');
     const entries=g.colliders.filter(c=>c.mesh===m),box=bounds(m);
     if(entries.length!==1||!entries[0].enabled||entries[0].box.min.distanceTo(box.min)>1e-6||entries[0].box.max.distanceTo(box.max)>1e-6)throw Error('Missing exact hanger contact');
     for(const registry of [g.cameraBlockers,g.aimBlockers])if(registry.filter(x=>x===m).length!==1)throw Error('Missing hanger query owner');
     const body=g.physics.solids.get(m.uuid)?.body;if(!body||body.mass!==0||body.collisionFilterMask===0)throw Error('Missing physical hanger');
     const extent=box.getSize(vector(0,0,0)).multiplyScalar(.5),half=body.shapes[0].halfExtents;
     if(vector(half.x,half.y,half.z).distanceTo(extent)>1e-6||vector(body.position.x,body.position.y,body.position.z).distanceTo(box.getCenter(vector(0,0,0)))>1e-6)throw Error('Hanger body differs from visible part');
    }
    const ceiling=g.firstLevel.world.surfaces.find(s=>s.name==='Non-portal ceiling tiles');
    for(const c of layer.castings){
     const shoe=bounds(c.shoe),rod=bounds(c.rod),plate=bounds(c.plate),stop=bounds(c.stop);
     if(!shoe.intersectsBox(stop)||!shoe.intersectsBox(rod)||!rod.intersectsBox(plate))throw Error('Disconnected hanger');
     const owner=g.firstLevel.biosphereArt.mounts.find(o=>o.target===c.stop);if(!owner)throw Error('Missing rendered stop owner');
     for(const [dx,dz]of [[0,0],[-.20,-.21],[-.20,.21],[.20,-.21],[.20,.21]]){
      const down=new g.raycaster.constructor(vector(c.shoe.position.x+dx,shoe.max.y+.05,c.shoe.position.z+dz),vector(0,-1,0),0,.3).intersectObject(g.firstLevel.biosphereArt,true).find(h=>opaque(h)&&owner.parts.some(part=>part.mesh===h.object&&part.index===h.instanceId));
      const up=new g.raycaster.constructor(vector(c.plate.position.x+dx,25,c.plate.position.z+dz),vector(0,1,0),0,.7).intersectObject(ceiling.group,true).find(opaque);
      if(!down||down.point.y<=shoe.min.y||down.point.y>=shoe.max.y||!up||up.point.y<=plate.min.y||up.point.y>=plate.max.y)throw Error('Hanger misses real roof or stop triangles');
      contacts.push({x:c.shoe.position.x+dx,z:c.shoe.position.z+dz,stopY:down.point.y,roofY:up.point.y});
     }
    }
    return{parts:layer.parts.length,castings:layer.castings.length,contacts};
   });
   if(version==='after'){assert.equal(row.mounts.parts,12);assert.equal(row.mounts.castings,4);assert.equal(row.mounts.contacts.length,20);}
   else assert.deepEqual(row.mounts,{parts:0,castings:0,contacts:[]});
   const result=await page.evaluate(async route=>{
    const g=window.__NESI_DEMO_GAME__,cargo=g.cargo,group=cargo.group,body=g.physics.cargoBody,shape=body.shapes[0],player=g.playerGroup,world=g.physics.world,update=g.updatePlaying,reset=g.resetRun,respawn=g.respawn,resetCargo=g.physics.resetCargo,clear=g.clearPortals;
    let updates=0,resets=0,respawns=0,cargoResets=0,deletions=0;const pictures=[];
    const sameOriginal=()=>g.playerGroup===player&&g.physics.world===world&&g.cargo===cargo&&g.cargo.group===group&&g.physics.cargoBody===body&&body.shapes[0]===shape;
    g.renderer.setAnimationLoop=window.__HANGER_LOOP__;delete window.__HANGER_LOOP__;
    g.resetRun=()=>{resets++;throw Error('Reset after native Play');};
    g.respawn=()=>{respawns++;throw Error('Respawn after native Play');};
    g.physics.resetCargo=()=>{cargoResets++;throw Error('Cargo reset after native Play');};
    g.clearPortals=()=>{deletions++;throw Error('Unavailable portal-pair deletion');};
    g.updatePlaying=function(...a){if(!sameOriginal())throw Error('Original physical actor replaced');updates++;return update.apply(this,a);};
    window.__NESI_CAPTURE_LEVEL_MARK__=mark=>pictures.push({mark,png:g.renderer.domElement.toDataURL('image/png').split(',')[1]});
    try{const result=await window.__NESI_RUN_LEVEL_ROUTE__({nativeStart:true,route});return{result,updates,resets,respawns,cargoResets,deletions,pictures,state:g.state,sameOriginal:sameOriginal()};}
    catch(e){return{error:String(e.stack||e),updates,resets,respawns,cargoResets,deletions,pictures,state:g.state,sameOriginal:sameOriginal(),player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray()};}
    finally{g.updatePlaying=update;g.resetRun=reset;g.respawn=respawn;g.physics.resetCargo=resetCargo;g.clearPortals=clear;delete window.__NESI_CAPTURE_LEVEL_MARK__;}
   },route);
   for(const [i,picture]of result.pictures.entries()){image(`route-${i+1}`,picture.png);delete picture.png;}row.route=result;save();
   if(version==='before'&&view==='portrait'){
    row.failure=result.error;
    row.baselineExpectation=assertKnownCrossflowBaselineFailure(row,{baselineCommit,route});
    assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),fixture.completed);
    // This historical route remains failed in the report. Only the exact
    // negative-control expectation passes, never the baseline's route.
    save();continue;
   }
   assert.equal(result.error,undefined);assert.equal(result.result.pass,true);assert.equal(result.resets+result.result.resets+result.result.respawns,0);assert.equal(result.state,'won');assert.equal(result.sameOriginal,true);
   assert.equal(result.respawns+result.cargoResets+result.deletions,0);
   assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),[...fixture.completed,25]);
   assert.deepEqual(row.errors,[]);assert.deepEqual(row.consoleErrors,[]);row.pass=true;
  }catch(e){row.failure=String(e.stack||e);console.error(version,view,route,row.failure);}finally{save();await page.close();}
 }
 report.visualComparisons=[];
 for(const view of ['wide','portrait']){
  const rows=report.rows.filter(r=>r.view===view);assert.equal(rows.length,2);
  assert.deepEqual(rows[0].inspections,rows[1].inspections,'Both versions must use identical inspection poses and authored start state');
  for(const label of ['lower-stop','upper-stop']){
   const before=rows[0].images.find(image=>image.file===`before-${view}-${label}.png`),after=rows[1].images.find(image=>image.file===`after-${view}-${label}.png`);
   assert.ok(before&&after);assert.notEqual(before.sha256,after.sha256,'The supposed rendered hanger update has identical pixels');
   report.visualComparisons.push({view,label,beforeSha256:before.sha256,afterSha256:after.sha256,identicalCameraAndWorld:true,pixelsChanged:true});
  }
 }
 Object.assign(report,acceptCrossflowComparison(report.rows,{baselineCommit,route}));save();
}finally{await browser.close();}
