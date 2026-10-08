import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../lab-headless.mjs';
import {runV8Journey} from '../../src/game/LabV8Journey.js';
import {installRoom21Aim} from '../../src/game/LabRoom21Journey.js';
import {CAMERA_PITCH_MIN,CAMERA_PITCH_MAX} from '../../src/game/LabCamera.js';

export async function runRoom50ResearchNegatives(){
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.room50FormResearch=true;await g.selectLevel(49,false);
 const l=g.firstLevel,cargo=g.cargo,body=g.physics.cargoBody,shots=[];let maximumJumpY=4;
 try{
  const result=await runV8Journey(g,{scenario:async d=>{
   installRoom21Aim(d);const initial=[l.form.first,l.form.second];d.wait(3);
   assert.deepEqual([l.form.first,l.form.second],initial);assert.equal(l.form.stroke,0);
   for(const [x,z]of [[-9,-2.5],[-4,-2.5],[0,-.7],[8,-2.5]]){
    d.walk(x,z);
    for(const targetX of [-4,-3,-2])for(const targetZ of [4.1,5.4])for(const jumping of [false,true]){
     const target=new THREE.Vector3(targetX,4.015,targetZ);d.look(target);
     if(jumping){
      g.input.jumpQueued=true;
      for(let n=0;n<18;n++){
       const p=target.clone().project(g.camera);g.yaw-=THREE.MathUtils.clamp(p.x,-1,1)*.18;g.pitch=THREE.MathUtils.clamp(g.pitch+THREE.MathUtils.clamp(p.y,-1,1)*.17,CAMERA_PITCH_MIN,CAMERA_PITCH_MAX);d.frame();maximumJumpY=Math.max(maximumJumpY,g.playerPosition.y);
      }
     }
     assert.ok(g.firePortal(0));d.until(()=>!g.portalShots.queue.length&&!g.portalShots.active.length,3,'Initial shot unresolved');
     const impact={...g.portalShots.lastImpact};shots.push({standing:[x,z],jumping,target:target.toArray(),impact,returnedAddress:g.portals.portals[0]?.surfaceId===l.retrieve.mesh.uuid});
     d.wait(.8);
    }
   }
   assert.equal(shots.filter(s=>s.returnedAddress).length,0,'Initial ordinary shot unexpectedly acquired bay R');
   assert.equal(g.teleportCount,0);assert.equal(g.physics.portalTransports,0);
   assert.deepEqual([l.form.first,l.form.second],initial);assert.equal(l.form.stroke,0);assert.equal(g.state,'playing');
  }});
  assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
  return {...result,scope:'Finite 48 real initial shots, including 24 jumps; unloaded spring/form remains unchanged. Not exhaustive bypass proof.',shots,maximumJumpY,initialReturnShots:shots.filter(s=>s.returnedAddress).length,cargoTransfers:g.physics.portalTransports,playerTransfers:g.teleportCount,identityPreserved:true};
 }finally{l.dispose?.();g.physics.dispose();g.portals.dispose();}
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{const r=await runRoom50ResearchNegatives();if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r,null,2));}catch(e){console.error(e.stack);process.exitCode=1;}}
