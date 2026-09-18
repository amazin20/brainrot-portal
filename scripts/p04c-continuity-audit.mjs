// Read-only motion audit. A route pass is NOT camera-comfort acceptance.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
const out=process.env.EVIDENCE_OUT||'smoke-artifacts/p04c-motion';
fs.mkdirSync(out,{recursive:true});
const game=await createHeadlessGame();await game.selectLevel(20,false);
const original=game.updateVisuals,ray=new THREE.Raycaster();
const samples=[];let event=0,tick=999,previous=null;
game.updateVisuals=function(...args){
 original.apply(this,args);
 if(event!==this.teleportCount){event=this.teleportCount;tick=0;previous=null;}
 if((event===3||event===4)&&tick<120){
  const r=this.cameraRig,eye=this.camera.position.clone(),pivot=r.playerPivot.clone(),safe=eye.clone();
  r.constrain(pivot,safe);
  const sample={event,tick,camera:eye.toArray(),player:this.playerPosition.toArray(),held:!!this.heldCube,
    clip:r.mainClippingPlanes.length,endpointSweepError:safe.distanceTo(eye),stepDistance:0,centrePathHit:null};
  if(previous){
   const start=new THREE.Vector3().fromArray(previous.camera),delta=eye.clone().sub(start),length=delta.length();
   sample.stepDistance=length;
   // Exclude actual teleports and clip-state transitions. The centre segment
   // does not prove a near-plane swept volume, but a centre hit is sufficient
   // to identify one discontinuous passage through solid geometry.
   if(!sample.clip&&!previous.clip&&length>1e-5){
    ray.near=1e-5;ray.far=length-1e-5;ray.set(start,delta.multiplyScalar(1/length));
    const hit=ray.intersectObjects(r.blockers,true).find(h=>r.isBlocker(h.object,h));
    if(hit){const box=new THREE.Box3().setFromObject(hit.object);
     sample.centrePathHit={name:hit.object.name||hit.object.type,point:hit.point.toArray(),distance:hit.distance,
       bounds:{min:box.min.toArray(),max:box.max.toArray()}};
    }
   }
  }
  samples.push(sample);previous=sample;
 }
 tick++;
};
try{
 const route=await runV8Journey(game);
 const windows=[3,4].map(id=>{const rows=samples.filter(s=>s.event===id),late=rows.filter(s=>s.tick>=24);
  return {event:id,frames:rows.length,lateMaxCameraStep:Math.max(...late.map(s=>s.stepDistance)),
    unsafeEndpointFrames:rows.filter(s=>s.endpointSweepError>1e-7).length,
    lateCentreCrossings:late.filter(s=>s.centrePathHit).map(s=>({tick:s.tick,step:s.stepDistance,hit:s.centrePathHit}))};});
 const report={scope:'Ordinary known-solution room21 route; read-only camera centre-segment audit. Not video, hardware FPS, a human playtest or exhaustive collision proof.',
   sourceCommit:process.env.SOURCE_COMMIT||null,displayHz:60,physicsHz:120,route,windows,samples,
   centreSegmentContractPassed:windows.every(w=>w.lateCentreCrossings.length===0),
   cameraComfortAcceptance:'not_measured'};
 fs.writeFileSync(path.join(out,'motion-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(windows,null,2));
 if(!route.pass || (process.argv.includes('--require-safe') && !report.centreSegmentContractPassed))process.exitCode=1;
}finally{game.updateVisuals=original;game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();}
