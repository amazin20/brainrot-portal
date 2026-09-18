import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

// Production CPU code and real model geometry; no renderer. NOT a GPU/FPS
// benchmark. Compare immutable source copies; skip 120 display warmup steps.
const level=Number(process.env.PERF_LEVEL||21),runs=Number(process.env.PERF_RUNS||1);
assert.ok(Number.isInteger(level)&&level>=1&&level<=21);
assert.ok(Number.isInteger(runs)&&runs>=1&&runs<=5);
const out=process.env.EVIDENCE_OUT||'smoke-artifacts/performance';fs.mkdirSync(out,{recursive:true});
const result={source:process.env.SOURCE_COMMIT||null,scope:'Node CPU timings, no WebGL; NOT user FPS or hardware acceptance',
 environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,cpus:os.cpus().length},level,runs:[]};
function stats(a){const s=[...a].sort((x,y)=>x-y);return{count:a.length,median:s[Math.floor(s.length*.5)]??0,p95:s[Math.min(s.length-1,Math.floor(s.length*.95))]??0,max:s.at(-1)??0,total:a.reduce((x,y)=>x+y,0)};}
for(let r=0;r<runs;r++){
 const game=await createHeadlessGame();await game.selectLevel(level-1,false);
 const rig=game.cameraRig,original=rig.update,intersect=rig.raycaster.intersectObjects;
 const originalVisual=game.updateVisuals,originalPlaying=game.updatePlaying;
 const rows=[],hash=crypto.createHash('sha256');let rays=0,roots=0,cameraMs=0,physicsMs=0;
 rig.raycaster.intersectObjects=function(objects,...args){rays++;roots+=objects.length;return intersect.call(this,objects,...args);};
 rig.update=function(...args){const t=performance.now();try{return original.apply(this,args);}finally{cameraMs+=performance.now()-t;}};
 game.updatePlaying=function(...args){const t=performance.now();try{return originalPlaying.apply(this,args);}finally{physicsMs+=performance.now()-t;}};
 game.updateVisuals=function(...args){
  rays=roots=cameraMs=0;const t=performance.now(),res=originalVisual.apply(this,args),visual=performance.now()-t;
  hash.update(JSON.stringify([...game.playerPosition,...game.playerVelocity,...game.cargo.position,...game.camera.position,...game.camera.quaternion,game.camera.fov,game.teleportCount,game.state,!!game.heldCube]));
  rows.push({camera:cameraMs,visual,physics:physicsMs,rays,roots,avoid:rig.avoidanceActive,inclined:rig.inclinedFraming,teleports:game.teleportCount});physicsMs=0;return res;
 };
 let route;
 try{route=await runV8Journey(game,{journeyOptions:{order:process.env.PERF_ORDER||'cargo-first'}});assert.ok(route.pass);}
 finally{rig.update=original;rig.raycaster.intersectObjects=intersect;game.updateVisuals=originalVisual;game.updatePlaying=originalPlaying;}
 const warm=rows.slice(120),avoid=warm.filter(s=>s.avoid),normal=warm.filter(s=>!s.avoid);
 const run={index:r,route,digest:hash.digest('hex'),blockers:rig.blockers.length,
 cameraMs:stats(warm.map(s=>s.camera)),avoidingCameraMs:stats(avoid.map(s=>s.camera)),normalCameraMs:stats(normal.map(s=>s.camera)),
 visualCpuMs:stats(warm.map(s=>s.visual)),physicsCpuMs:stats(warm.map(s=>s.physics)),
 rayCalls:stats(warm.map(s=>s.rays)),rootVisits:stats(warm.map(s=>s.roots)),samples:rows};
 result.runs.push(run);console.log(JSON.stringify({...run,samples:undefined,route:{pass:route.pass,frames:route.frames,resets:route.resets,respawns:route.respawns}}));
 game.firstLevel?.dispose?.();game.physics.dispose();game.portals.dispose();
}
fs.writeFileSync(`${out}/cpu-${level}.json`,JSON.stringify(result,null,2));
