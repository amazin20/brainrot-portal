import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom12,room12Fling} from '../src/game/LabRoom12Journey.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});
const V=(...p)=>new THREE.Vector3(...p);
async function untilMark(d,label){
 const reached=Symbol(label);let found=false;
 try {await runRoom12({...d,mark(name){d.mark(name);if(name===label){found=true;throw reached;}}});}
 catch(error){if(error!==reached)throw error;}
 assert.ok(found,'Ordinary controls must reach '+label);
}
function finish(d){
 d.walk(THREE.MathUtils.clamp(game.cargo.position.x-1.1,8,14),THREE.MathUtils.clamp(game.cargo.position.z,1.5,7));
 if(game.state==='playing')d.pickup();d.walk(10,4);
 d.until(()=>game.state==='won',3,'Both travellers reach the dock');
}

// Two ordinary timing samples, not a claim about all intermediate timings.
// All targeting still uses the third-person camera and moving animated muzzle.
for(const delayFrames of [0,12]) {
 test(`the airborne shot completes with the real weapon delay after ${delayFrames} extra flight frames`,async()=>{
  await game.selectLevel(11,false);
  const fire=game.firePortal;let click=null,placed=null,riseTime=0;
  game.firePortal=function(index){
   const accepted=fire.call(this,index),queued=this.portalShots.queue.at(-1);
   if(accepted&&index===0&&!this.playerGrounded&&this.playerPosition.y>18.8) {
    click={delay:queued?.delay,point:queued?.point.clone(),at:this.portalShots.time,
     elapsed:this.portalShots.time-riseTime,feet:this.playerPosition.clone()};
   }
   return accepted;
  };
  let report;
  try {
   report=await runV8Journey(game,{scenario:d=>runRoom12({...d,mark(name){
    d.mark(name);
    if(name==='return rises through the junction') {
     riseTime=game.portalShots.time;
     const target=game.portals.portals[1].position.clone();
     for(let i=0;i<delayFrames;i++) {
      const p=game.playerPosition,v=game.playerVelocity;
      d.worldMove(THREE.MathUtils.clamp((target.x-p.x)*1.8-v.x*1.2,-1,1),
       THREE.MathUtils.clamp((target.z-p.z)*1.8-v.z*1.2,-1,1));d.frame();
     }
    }
    if(name==='spent portal becomes the lateral exit')placed={...game.portalShots.lastImpact,at:game.portalShots.time};
   }})});
  } finally {game.firePortal=fire;}
  assert.ok(click?.delay>=.23,'Preserve the actual gun preparation time');
  assert.ok(click.elapsed>=delayFrames/60);
  assert.ok(Math.abs(click.point.x-game.firstLevel.panels.final.getFrame().center.x)<.001,
   'The real camera ray selects the high ceramic');
  assert.equal(placed?.valid,true);assert.equal(placed?.surface,'final / collision');
  assert.ok(placed.at-click.at>click.delay,'A physical charge flies after its windup');
  assert.equal(report.pass,true);assert.equal(report.resets+report.respawns,0);
  assert.equal(game.state,'won');
 });
}

test('a premature shot from the high lip hits real structure and preserves the working fall pair',async()=>{
 await game.selectLevel(11,false);
 const report=await runV8Journey(game,{scenario:async d=>{
  await untilMark(d,'crossing flight');
  const retained=game.portals.portals.map(p=>p.position.clone());
  assert.throws(()=>d.aim(0,d.level.panels.final.getFrame().center),/Portal impact rejected/);
  assert.equal(game.portalShots.lastImpact?.valid,false);
  for(let i=0;i<2;i++)assert.ok(game.portals.portals[i].position.distanceTo(retained[i])<1e-9);
  room12Fling(d);finish(d);
 }});
 assert.equal(report.pass,true);assert.equal(report.resets+report.respawns,0);assert.equal(game.state,'won');
});
