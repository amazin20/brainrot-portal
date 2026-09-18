import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {CAMPAIGN} from '../src/game/LabCampaignLevels.js';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';

const out=process.env.EVIDENCE_OUT||'smoke-artifacts/portals-campaign';
fs.mkdirSync(out,{recursive:true});
const levels=process.env.PERF_LEVELS ? process.env.PERF_LEVELS.split(',').map(n=>Number(n)-1) : CAMPAIGN.map((_,i)=>i);
assert.ok(levels.every(i=>Number.isInteger(i)&&i>=0&&i<CAMPAIGN.length));
const report={source:process.env.SOURCE_COMMIT||null,
 scope:'All requested ordinary campaign routes, production CPU and real geometry, no WebGL. NOT user FPS. Headless assets are preloaded; heap is not cold browser loading or GPU memory.',
 environment:{node:process.version,cpu:os.cpus()[0]?.model,platform:process.platform},routes:[],resources:[],pass:false};
const stats=a=>{const b=[...a].sort((x,y)=>x-y);return {count:b.length,median:b[Math.floor(b.length*.5)]??0,p95:b[Math.floor(b.length*.95)]??0,max:b.at(-1)??0,total:b.reduce((a,b)=>a+b,0)};};
function resources(game){
 const gs=new Set(),ms=new Set();let meshes=0,instances=0,triangles=0;
 game.scene.traverse(n=>{if(n.geometry)gs.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])if(m)ms.add(m);
  if(n.isMesh){meshes++;if(n.isInstancedMesh)instances+=n.count;triangles+=(n.geometry.index?.count??n.geometry.attributes.position?.count??0)/3*(n.isInstancedMesh?n.count:1);}});
 return {geometry:gs.size,materials:ms.size,meshes,instances,allStoredTriangles:triangles,
  roots:game.scene.children.length,colliders:game.colliders.length,bodies:game.physics.world.bodies.length,
  actors:game.portalActors.actors.size,heapBytes:process.memoryUsage().heapUsed};
}
const game=await createHeadlessGame();
try{
 for(const index of levels){
  await game.selectLevel(index,false);
  const hash=crypto.createHash('sha256'),samples=[];
  const originalVisual=game.updateVisuals,originalPlaying=game.updatePlaying,originalSync=game.portals.syncMovingSurfaces;
  let fixed=0,sync=0,syncCalls=0;
  game.updatePlaying=function(...a){const t=performance.now();try{return originalPlaying.apply(this,a);}finally{fixed+=performance.now()-t;}};
  game.portals.syncMovingSurfaces=function(...a){const t=performance.now();syncCalls++;try{return originalSync.apply(this,a);}finally{sync+=performance.now()-t;}};
  game.updateVisuals=function(...a){const t=performance.now();const v=originalVisual.apply(this,a);
   const visual=performance.now()-t,at=performance.now();this.portalActors.update();this.portals.update(this.visualTime);
   samples.push({fixed,visual,renderActorSync:performance.now()-at,sync,syncCalls});fixed=sync=syncCalls=0;
   hash.update(JSON.stringify([...this.playerPosition,...this.playerVelocity,...this.cargo.position,...this.camera.position,...this.camera.quaternion,this.camera.fov,this.teleportCount,this.state,!!this.heldCube]));return v;};
  let route;
  try{route=await runV8Journey(game);}finally{game.updateVisuals=originalVisual;game.updatePlaying=originalPlaying;game.portals.syncMovingSurfaces=originalSync;}
  assert.ok(route.pass&&route.resets===0&&route.respawns===0);
  const warm=samples.slice(120),r={level:index+1,route,digest:hash.digest('hex'),
   fixedMs:stats(warm.map(s=>s.fixed)),visualMs:stats(warm.map(s=>s.visual)),portalSyncMs:stats(warm.map(s=>s.sync)),
   actorSyncMs:stats(warm.map(s=>s.renderActorSync)),syncCalls:warm.reduce((n,s)=>n+s.syncCalls,0),resources:resources(game)};
  report.routes.push(r);fs.writeFileSync(`${out}/audit.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({level:r.level,frames:route.frames,pass:route.pass,fixed:r.fixedMs.total,sync:r.portalSyncMs.total,visual:r.visualMs.total,digest:r.digest}));
 }
 // Two identical clean room-switch cycles: scene resources, not a claim that
 // every byte of renderer/driver memory has reached a plateau.
 for(let cycle=0;cycle<2;cycle++)for(const index of CAMPAIGN.map((_,i)=>i)){
  await game.selectLevel(index,false);global.gc?.();report.resources.push({cycle,level:index+1,...resources(game)});
 }
 for(let i=0;i<CAMPAIGN.length;i++){
  const {cycle:a,heapBytes:ah,...ar}=report.resources[i],{cycle:b,heapBytes:bh,...br}=report.resources[i+CAMPAIGN.length];assert.deepEqual(ar,br);
 }
 report.pass=true;
}finally{fs.writeFileSync(`${out}/audit.json`,JSON.stringify(report,null,2));disposeLabLevel(game);}
