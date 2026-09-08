import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
const g=await createHeadlessGame(),V=(...p)=>new THREE.Vector3(...p),results=[],bad=[];
function trial({start,carry=false,extra=0,repeat=true,counter=0,route=0,seconds=8,setup=null}){
 g.resetRun(true);const l=g.firstLevel;if(l.state.counterIndex!==undefined)l.state.counterIndex=counter;if(setup)setup(l);
 g.playerPosition.fromArray(start);g.playerPosition.y+=extra;g.previousPlayerPosition.copy(g.playerPosition);g.playerGrounded=true;g.coyoteTime=.1;g.yaw=0;
 g.physics.resetCargo(g.playerPosition.clone().add(V(0,1,.9)));g.cargo.position.copy(g.physics.sample(1).position);g.heldCube=carry?g.cargo:null;
 g.input.keys.add('ShiftLeft');g.input.jumpQueued=true;let maxY=g.playerPosition.y,reached=false,frames=0;
 g.input.getMove=()=>{const target=l.goal.position.clone();if(route===1&&frames<200)target.x=l.bounds.minX+.8;if(route===2&&frames<200)target.x=l.bounds.maxX-.8;const d=target.sub(g.playerPosition);d.y=0;d.normalize();return new THREE.Vector2(d.x,d.z);};
 for(let n=0;n<seconds*120;n++){frames=n;if(repeat&&n%8===0)g.input.jumpQueued=true;g.updatePlaying(1/120);maxY=Math.max(maxY,g.playerPosition.y);if(g.playerGrounded&&l.goal.contains(g.playerPosition)){reached=true;break;}}
 const r={level:g.levelIndex+1,start,carry,extra,repeat,counter,route,maxY,reached,teleports:g.teleportCount};results.push(r);if(reached)bad.push(r);
}
await g.selectLevel(6,false);
// Rebuilt room 7: actual spine, generous raised-tray edge fixtures, loading
// landing and the enclosed fall-tower landing. Old gallery coordinates no
// longer exercised any existing structure. The raised starts remain explicit
// adversarial allowances, never evidence of a playable positive route.
const starts=[[0,2.25,0],[0,3.9,4.1],[1.4,3.9,4.1],[2.1,3.3,4.7],[8,3.3,4.7],[-11.7,10,-11.2]];
for(const start of starts)for(const carry of [false,true])for(const extra of [0,.9])for(const counter of [0,1,2])for(const route of [0,1,2])trial({start,carry,extra,counter,route});
console.log('Seventh room full-physics trials:',results.length);
for(let index=8;index<11;index++){
 await g.selectLevel(index,false);
 for(const carry of [false,true])for(const repeat of [false,true])for(const route of [0,1,2])trial({start:g.firstLevel.spawn,carry,repeat,route,seconds:12});
}
// Rooms 12–20 were retired. This gate preserves all 216 seventh-room
// fixtures and all 36 retained workshop-room spawn trials. The new room 12
// has its own portal-puzzle route, recovery and negative-path checks.
fs.mkdirSync('qa',{recursive:true});fs.writeFileSync('qa/v17-adversarial.json',JSON.stringify({scope:'Full updatePlaying (actuators + player + same cargo body), with explicit negative starting fixtures. Not positive walkthroughs; bounded search, not exhaustive proof.',pass:bad.length===0,attempts:results.length,bypasses:bad,results},null,2));
console.log('Adversarial trials',results.length,'bypasses',bad.length);assert.equal(bad.length,0,JSON.stringify(bad.slice(0,5)));g.physics.dispose();g.portals.dispose();
