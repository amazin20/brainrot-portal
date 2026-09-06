import fs from 'node:fs';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
const g=await createHeadlessGame();await g.selectLevel(6,false);
const results=[];
// Adversarial fixtures start on the highest reachable deck/landing, with a
// bonus height allowance. These are not presented as positive playthroughs.
for(const start of [[0,5.84,-10.3],[1.2,5.84,-10.3],[0,5.5,-13],[1.7,5.5,-14.5]])
for(const carry of [false,true])for(const extra of [0,.9])for(const repeat of [false,true]){
 g.resetRun(true);g.playerPosition.fromArray(start);g.playerPosition.y+=extra;g.previousPlayerPosition.copy(g.playerPosition);
 g.playerGrounded=true;g.coyoteTime=.1;g.yaw=0;g.heldCube=carry?g.cargo:null;
 const goal=g.firstLevel.goal.position,dir=goal.clone().sub(g.playerPosition);dir.y=0;dir.normalize();
 g.input.getMove=()=>new THREE.Vector2(dir.x,dir.z);g.input.keys.add('ShiftLeft');g.input.jumpQueued=true;g.playerVelocity.copy(dir).multiplyScalar(carry?4.5:5);
 let bypass=false,maxY=g.playerPosition.y;
 for(let n=0;n<900;n++){
  if(repeat&&n%8===0)g.input.jumpQueued=true;
  g.firstLevel.update(1/120);g.updatePlayer(1/120);maxY=Math.max(maxY,g.playerPosition.y);
  if(g.playerGrounded&&g.firstLevel.goal.contains(g.playerPosition)){bypass=true;break;}
 }
 results.push({start,carry,extra,repeat,maxY,bypass});
}
fs.writeFileSync('qa/v14-lever-jumps.json',JSON.stringify({scope:'32 bounded no-portal jumping and repeat-jumping attempts; not exhaustive exploit proof',results},null,2));
assert.ok(results.every(r=>!r.bypass));console.log('PASS',results.length,'seventh-course jumping attempts');g.physics.dispose();g.portals.dispose();
