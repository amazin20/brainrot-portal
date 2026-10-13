import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {readStampedCampaignInfo,assertCampaignBrowserState} from './lib/campaign-browser-contract.mjs';
import {animationFrameStatistics,validateAnimationFrames} from './lib/animation-frame-quality.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {foundationCampaignPrefix,CAMPAIGN_PREFERENCE_KEY} from '../src/game/LabCampaignStorage.js';

const out=path.resolve(process.env.EVIDENCE_OUT||'smoke-artifacts/animation-presentation');
fs.mkdirSync(out,{recursive:true});
const report={sourceCommit:process.env.BUILD_COMMIT??null,scope:'Production WebGL room 9; ordinary movement/pickup/jump/stop controls. Software WebGL is visual evidence, not a hardware FPS measurement.',errors:[],routes:[],angleCaptures:[]};
const base=new URL(process.env.DEMO_URL||'http://127.0.0.1:4193/');
let server;
if(process.env.START_SERVER==='1'){
  // Parallel source work must not HMR-reload a continuous evidence recording.
  const serverCode=`import {createServer} from 'vite';const server=await createServer({server:{host:'127.0.0.1',port:${Number(base.port)},strictPort:true,hmr:false,watch:null}});await server.listen();`;
  server=process.env.SERVER_MODE==='preview'
    ?spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(base.port),'--strictPort'],{stdio:'ignore'})
    :spawn(process.execPath,['--input-type=module','-e',serverCode],{stdio:'ignore'});
  for(let i=0;i<100;i++){
    try{if((await fetch(base)).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,50));
  }
}
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,protocolTimeout:180000,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-zygote']});
try{
  report.package=await readStampedCampaignInfo(base);
  const page=await browser.newPage();await page.setViewport({width:960,height:540,deviceScaleFactor:1});
  page.on('pageerror',error=>report.errors.push(String(error.stack||error)));
  await page.evaluateOnNewDocument(key=>localStorage.setItem(key,JSON.stringify({quality:'low',muted:true})),foundationCampaignPrefix(base.pathname)+CAMPAIGN_PREFERENCE_KEY);
  const url=new URL(base);
  url.searchParams.set('edition','foundation');url.searchParams.set('level','9');url.searchParams.set('debug','1');
  await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready',{timeout:120000});
  report.runtime=await page.evaluate(flagNames=>{
   const g=window.__NESI_DEMO_GAME__;
   return {levelIndex:g.levelIndex,edition:g.chamberEdition,id:g.firstLevel.id,flags:Object.fromEntries(flagNames.map(key=>[key,g[key]])),
    hudNumber:Number(document.querySelector('#level-number').textContent),
    optionNumber:Number(document.querySelector(`#level-select option[value="${g.levelIndex}"]`).textContent.match(/^\d+/)?.[0])};
  },Object.keys(ACTIVE_FOUNDATION_RUNTIME_FLAGS));
  assertCampaignBrowserState(report.runtime,9);
  await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
  for(const carrying of process.env.CARRYING==='1'?[true]:process.env.CARRYING==='0'?[false]:[false,true]){
    const name=carrying?'held-friend-jump':'free-jump',folder=path.join(out,name);
    fs.rmSync(folder,{recursive:true,force:true});fs.mkdirSync(folder,{recursive:true});
    const result=await page.evaluate(async carrying=>{
      const g=window.__NESI_DEMO_GAME__,frames=[],angleCaptures=[];
      // These stills inspect the genuine held pose with a temporary camera.
      // They never contribute frames or milestones to the ordinary route.
      const inspectHeldViews=(stage,sample)=>{
        if(g.heldCube!==g.cargo||!g.playerGrounded)throw Error('Held inspection needs the original friend on a grounded player');
        const camera=g.camera,cargo=g.cargo,body=g.physics.cargoBody,shapes=[...body.shapes],proxyOwner=g.physics.playerProxy,proxy=proxyOwner?.body;
        const pose=object=>({position:object.position.toArray(),quaternion:object.quaternion.toArray(),scale:object.scale.toArray()});
        const bodyPose=b=>b?{id:b.id,type:b.type,mass:b.mass,collisionResponse:b.collisionResponse,collisionFilterGroup:b.collisionFilterGroup,collisionFilterMask:b.collisionFilterMask,
          position:[b.position.x,b.position.y,b.position.z],quaternion:[b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w],
          velocity:[b.velocity.x,b.velocity.y,b.velocity.z],angularVelocity:[b.angularVelocity.x,b.angularVelocity.y,b.angularVelocity.z],
          shapes:b.shapes.map((s,i)=>({id:s.id,type:s.type,radius:s.radius??null,half:s.halfExtents?[s.halfExtents.x,s.halfExtents.y,s.halfExtents.z]:null,
            offset:[b.shapeOffsets[i].x,b.shapeOffsets[i].y,b.shapeOffsets[i].z],orientation:[b.shapeOrientations[i].x,b.shapeOrientations[i].y,b.shapeOrientations[i].z,b.shapeOrientations[i].w]}))}:null;
        const physicalState=()=>({worldStep:g.physics.world.stepnumber,worldTime:g.physics.world.time,physicsSteps:g.physics.steps,
          elapsed:g.elapsed,visualTime:g.visualTime,held:g.heldCube===cargo,cargoIdentity:cargo.group.uuid,
          player:{position:g.playerPosition.toArray(),velocity:g.playerVelocity.toArray(),grounded:g.playerGrounded,group:pose(g.playerGroup)},
          cargo:{position:cargo.position.toArray(),velocity:cargo.velocity.toArray(),quaternion:cargo.quaternion.toArray(),group:pose(cargo.group)},
          body:bodyPose(g.physics.cargoBody),playerProxy:bodyPose(g.physics.playerProxy?.body)});
        const matrices=['matrix','matrixWorld','matrixWorldInverse','projectionMatrix','projectionMatrixInverse'];
        const saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),up:camera.up.clone(),scale:camera.scale.clone(),
          matrixWorldNeedsUpdate:camera.matrixWorldNeedsUpdate,matrices:Object.fromEntries(matrices.map(key=>[key,camera[key].clone()]))};
        const cameraState=()=>({position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),up:camera.up.toArray(),scale:camera.scale.toArray(),
          fov:camera.fov,aspect:camera.aspect,zoom:camera.zoom,near:camera.near,far:camera.far,matrixWorldNeedsUpdate:camera.matrixWorldNeedsUpdate,
          matrices:Object.fromEntries(matrices.map(key=>[key,camera[key].toArray()]))});
        const originalCamera=JSON.stringify(cameraState()),before=physicalState(),actorNodes=new Set();
        g.playerGroup.traverse(node=>actorNodes.add(node));cargo.group.traverse(node=>actorNodes.add(node));g.scene.updateMatrixWorld(true);
        const opaque=[];g.scene.traverse(node=>{
          if(!node.isMesh||actorNodes.has(node))return;
          for(let ancestor=node;ancestor;ancestor=ancestor.parent)if(!ancestor.visible)return;
          const materials=Array.isArray(node.material)?node.material:[node.material];
          if(materials.some(material=>material?.visible!==false&&material?.colorWrite!==false&&(material?.opacity??1)>.95&&!material?.transparent))opaque.push(node);
        });
        const Bounds=g.colliders[0].box.constructor,friendBounds=new Bounds().setFromObject(cargo.group),actorBounds=new Bounds().setFromObject(g.playerGroup).union(friendBounds);
        const target=actorBounds.getCenter(camera.position.clone()),forward=cargo.position.clone().sub(g.playerPosition);forward.y=0;forward.normalize();
        const left=forward.clone().set(forward.z,0,-forward.x),right=left.clone().negate();
        const Raycaster=g.raycaster.constructor,meshRay=new Raycaster(),Vec3=body.position.constructor;
        const physicalRayClear=(from,to)=>{
          let blocked=false;g.physics.world.raycastAll(new Vec3(from.x,from.y,from.z),new Vec3(to.x,to.y,to.z),
            {skipBackfaces:false,checkCollisionResponse:false},hit=>{
              if(hit.body!==body&&hit.body!==proxy&&hit.body.collisionResponse!==false&&hit.shape.collisionResponse!==false
                &&hit.body.collisionFilterMask!==0&&hit.shape.collisionFilterMask!==0)blocked=true;
            });return !blocked;
        };
        const points=[target,cargo.group.getWorldPosition(camera.position.clone())];
        for(const x of [actorBounds.min.x,actorBounds.max.x])for(const y of [actorBounds.min.y,actorBounds.max.y])for(const z of [actorBounds.min.z,actorBounds.max.z])
          points.push(camera.position.clone().set(x,y,z));
        const shots=[];
        for(const [view,direction] of [['front',forward],['left',left],['right',right]]){
          let chosen;
          try{
            for(const distance of [3.6,3.2,2.8,2.4]){
              const position=target.clone().addScaledVector(direction,distance);position.y+=.15;
              if(g.colliders.some(c=>c.enabled!==false&&c.box.clone().expandByScalar(.12).containsPoint(position)))continue;
              if(!physicalRayClear(position,target))continue;
              let blocked=false;
              for(const point of points){
                const delta=point.clone().sub(position),length=delta.length();meshRay.set(position,delta.normalize());meshRay.far=Math.max(0,length-.05);
                if(meshRay.intersectObjects(opaque,false).length){blocked=true;break;}
              }
              if(blocked)continue;
              camera.position.copy(position);camera.lookAt(target);camera.updateMatrixWorld(true);
              if(points.some(point=>{const ndc=point.clone().project(camera);return Math.abs(ndc.x)>.94||Math.abs(ndc.y)>.94||ndc.z<=-1||ndc.z>=1;}))continue;
              chosen=position;break;
            }
            if(!chosen)throw Error('No unobstructed genuine held-pose '+view+' inspection camera');
            g.render();shots.push({stage,view,scope:'camera-only inspection, not route/movie',sample,
              cameraPosition:chosen.toArray(),cameraTarget:target.toArray(),width:960,height:540,
              geometry:{physicalRayClear:true,enabledColliderClearance:.12,opaqueMeshRays:points.length,actorBoundsInFrustum:true,
                actorBounds:{min:actorBounds.min.toArray(),max:actorBounds.max.toArray()},friendBounds:{min:friendBounds.min.toArray(),max:friendBounds.max.toArray()}},
              jpeg:g.renderer.domElement.toDataURL('image/jpeg',.95).split(',')[1]});
          }finally{
            camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);camera.up.copy(saved.up);camera.scale.copy(saved.scale);
            for(const key of matrices)camera[key].copy(saved.matrices[key]);camera.matrixWorldNeedsUpdate=saved.matrixWorldNeedsUpdate;
            if(JSON.stringify(cameraState())!==originalCamera)throw Error('Held inspection did not restore the exact camera');
            const after=physicalState();
            if(g.cargo!==cargo||g.physics.cargoBody!==body||g.physics.playerProxy!==proxyOwner||g.physics.playerProxy?.body!==proxy||g.heldCube!==cargo
              ||shapes.some((shape,i)=>body.shapes[i]!==shape)||body.shapes.length!==shapes.length||JSON.stringify(after)!==JSON.stringify(before))
              throw Error('Held camera inspection changed a physical actor or step');
            if(shots.at(-1)?.view===view)Object.assign(shots.at(-1),{physicalBefore:before,physicalAfter:after,physicalStateUnchanged:true,cameraRestored:true});
          }
        }
        g.render();return shots;
      };
      window.__NESI_CAPTURE_ANIMATION_FRAME__=sample=>{
        g.render();
        frames.push({sample,jpeg:g.renderer.domElement.toDataURL('image/jpeg',.82).split(',')[1]});
        if(carrying&&sample.frame===0)angleCaptures.push(...inspectHeldViews('held-start',{frame:0,time:0,physicsSteps:8,meaning:'first actual ordinary-motion sample, after eight120Hz steps'}));
      };
      try{
        const route=await window.__NESI_RUN_ANIMATION_ROUTE__({fps:15,carrying});
        if(carrying)angleCaptures.push(...inspectHeldViews('held-grounded-finish',{frame:47,time:3.2,physicsSteps:384,meaning:'settled grounded finish after the ordinary route'}));
        return {route,frames,angleCaptures,contextLost:g.renderer.getContext().isContextLost()};
      }
      finally{delete window.__NESI_CAPTURE_ANIMATION_FRAME__;}
    },carrying);
    if(result.contextLost||!result.route.route.pass)throw Error(name+' did not finish in the production renderer');
    assert.equal(result.frames.length,result.route.motion.frames,'Animation capture omitted production frame callbacks');
    assert.ok(new Set(result.frames.map(frame=>frame.jpeg)).size>=8,'Animation evidence repeats a frozen renderer frame');
    for(const [i,frame] of result.frames.entries())fs.writeFileSync(path.join(folder,String(i).padStart(4,'0')+'.jpg'),Buffer.from(frame.jpeg,'base64'));
    const pixels=validateAnimationFrames(folder,result.frames.length);
    const video=path.join(out,name+'.mp4');
    const encode=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','15','-i',folder+'/%04d.jpg','-c:v','libx264','-crf','20','-pix_fmt','yuv420p',video],{encoding:'utf8'});
    if(encode.status!==0)throw Error(encode.stderr);
    report.routes.push({name,video,frames:result.frames.length,pixels,...result.route});
    for(const capture of result.angleCaptures){
      const {jpeg,...metadata}=capture,file=metadata.stage+'-'+metadata.view+'.jpg',bytes=Buffer.from(jpeg,'base64');
      fs.writeFileSync(path.join(out,file),bytes);
      const decoded=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-i',path.join(out,file),'-vf','scale=64:36,signalstats,metadata=mode=print:file=-','-f','null','-'],{encoding:'utf8',maxBuffer:1024*1024});
      if(decoded.error)throw new Error('Held inspection decoder could not start: '+decoded.error.message,{cause:decoded.error});
      assert.equal(decoded.status,0,'Held inspection image decoding failed: '+decoded.stderr);
      const pixels=animationFrameStatistics(decoded.stdout,{expectedFrames:1,minimumFrames:1});
      const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',path.join(out,file)],{encoding:'utf8'});
      if(probe.error)throw new Error('Held inspection dimension decoder could not start: '+probe.error.message,{cause:probe.error});
      assert.equal(probe.status,0,'Held inspection dimension decoding failed: '+probe.stderr);
      assert.deepEqual(JSON.parse(probe.stdout).streams.map(({width,height})=>({width,height})),[{width:960,height:540}],'Held inspection pixels have incorrect dimensions');
      assert.deepEqual(metadata.physicalBefore,metadata.physicalAfter,'Held inspection physical snapshots differ');
      report.angleCaptures.push({...metadata,file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),pixels,
        physicalBeforeSha256:createHash('sha256').update(JSON.stringify(metadata.physicalBefore)).digest('hex'),
        physicalAfterSha256:createHash('sha256').update(JSON.stringify(metadata.physicalAfter)).digest('hex')});
    }
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({name,frames:result.frames.length,motion:result.route.motion}));
  }
  if(process.env.CARRYING!=='0')assert.deepEqual(report.angleCaptures.map(c=>c.stage+'/'+c.view).sort(),
    ['held-start','held-grounded-finish'].flatMap(stage=>['front','left','right'].map(view=>stage+'/'+view)).sort(),'Held inspection omitted a required angle');
  if(report.errors.length)throw Error(report.errors.join('\n'));
  report.pass=true;
}catch(error){report.pass=false;report.failure=String(error.stack||error);throw error;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();server?.kill();}
