import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom12,room12Access,room12Climb,room12Fling} from '../src/game/LabRoom12Journey.js';

const game=await createHeadlessGame();
const V=(...p)=>new THREE.Vector3(...p);
after(()=>{game.physics.dispose();game.portals.dispose();});
async function reach(d,label){
 const stop=Symbol(label);let reached=false;
 try{await runRoom12({...d,mark(name){d.mark(name);if(name===label){reached=true;throw stop;}}});}
 catch(error){if(error!==stop)throw error;}
 assert.ok(reached,'Ordinary controls reach '+label);
}
function missReturn(d){
 for(let n=0;n<180&&!game.playerGrounded;n++){d.worldMove(1,0);d.frame();}
 d.stop();d.until(()=>game.playerGrounded,4,'A missed return reaches a real floor');
 assert.ok(game.playerPosition.y<.1,'The player lands in the lower passage');
 assert.ok(game.cargo.position.y>8.9,'The delivered friend remains on the dock');
}
function retry(d){
 if(game.playerPosition.x<-7)d.walk(-8,12);
 d.walk(4,12);d.walk(10,14.5);room12Access(d);
 d.walk(-9,-7.2);d.aim(0,V(-10,.025,9.8));room12Climb(d);room12Fling(d);
 d.walk(THREE.MathUtils.clamp(game.cargo.position.x-1.1,8,14),THREE.MathUtils.clamp(game.cargo.position.z,1.5,7));
 if(game.state==='playing')d.pickup();d.walk(10,4);
 d.until(()=>game.state==='won',3,'The same delivered friend completes the retry');
}

test('missing the airborne rewire returns through the lower passage and completes without redelivering the friend',async()=>{
 await game.selectLevel(11,false);
 const body=game.physics.cargoBody,group=game.cargo.group;
 let freightTransfers;
 const report=await runV8Journey(game,{scenario:async d=>{
  await reach(d,'return rises through the junction');freightTransfers=game.physics.portalTransports;
  missReturn(d);retry(d);
 }});
 assert.equal(report.pass,true);assert.equal(report.resets+report.respawns,0);
 assert.equal(game.physics.cargoBody,body);assert.equal(game.cargo.group,group);
 assert.equal(game.physics.portalTransports,freightTransfers,'The waiting friend is never resent or respawned');
 assert.equal(game.state,'won');
});

test('a weak late entry reaches the recovery shelf and a normal jump returns to the lower passage',async()=>{
 await game.selectLevel(11,false);
 const body=game.physics.cargoBody;
 const report=await runV8Journey(game,{scenario:async d=>{
  await reach(d,'spent portal becomes the lateral exit');missReturn(d);
  d.walk(6,5.5);d.walk(4,5.5);
  const before=game.teleportCount;
  for(let n=0;n<300&&game.teleportCount===before;n++){d.worldMove(0,-.3);d.frame();}
  d.stop();assert.equal(game.teleportCount,before+1,JSON.stringify({position:game.playerPosition.toArray(),portal:game.portals.portals[1].position.toArray()}));
  assert.ok(game.lastPortalTravel.speed<10,'The local floor entry has little stored energy');
  d.until(()=>game.playerGrounded,4,'The weak exit lands on the actual recovery shelf');
  assert.ok(Math.abs(game.playerPosition.y-17)<.1&&game.playerPosition.x<-9);
  assert.equal(game.state,'playing');
  d.walk(-10.6,3);game.input.jumpQueued=true;
  for(let n=0;n<150;n++){d.worldMove(1,0);d.frame();if(game.playerPosition.x>-8.2)break;}
  d.stop();assert.ok(game.playerPosition.x>-8.2,'A normal jump clears the real front sill: '+game.playerPosition.toArray());
  d.until(()=>game.playerGrounded&&game.playerPosition.y<.1,4,'Drop from the pocket to the lower passage');
  retry(d);
 }});
 assert.equal(report.pass,true);assert.equal(report.resets+report.respawns,0);
 assert.equal(game.physics.cargoBody,body);assert.equal(game.state,'won');
});
