import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabGame} from '../src/game/LabGame.js';
import {LabPortals} from '../src/game/LabPortals.js';
import {updateKineticVelocity} from '../src/game/LabKineticMovement.js';
import {sweepRampContact,canStepAcrossRampEnd} from '../src/game/LabRampContact.js';
import {sampleRampSurface} from '../src/game/LabPhysics.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRampExploration} from '../src/game/LabRampExplorationJourney.js';
const V=(...v)=>new THREE.Vector3(...v);
function fixture(kinetic){
 const g=new LabGame({container:null,touch:false}),move=new THREE.Vector2();
 Object.assign(g,{epicMode:kinetic,scene:new THREE.Scene(),state:'playing',move,playerGroup:new THREE.Group(),playerGrounded:true,
  firstLevel:{momentum:false},cameraRig:{reset(){}},audio:{jump(){},land(){}},animator:{triggerJump(){},triggerLanding(){}},
  input:{keys:new Set(),getMove:()=>move,consumeJump:()=>false}});
 g.portals=new LabPortals({scene:g.scene});g.respawn=()=>{throw Error('Unexpected respawn');};return g;
}
test('near-rest reversal follows input rather than accelerating the old tiny drift',()=>{
 for(const hz of [30,60,120,240])for(const drift of [.001,.04,.15,.29])for(const yaw of [0,.7,2.4]){
  const g=fixture(true);g.yaw=yaw;g.playerVelocity.copy(V(0,0,drift).applyAxisAngle(V(0,1,0),yaw));
  const wish=V(0,0,-1).applyAxisAngle(V(0,1,0),yaw);updateKineticVelocity(g,1/hz,new THREE.Vector2(0,-1));
  assert.ok(g.playerVelocity.dot(wish)>0,`drift ${drift}, ${hz}Hz`);g.portals.dispose();
 }
});
for(const kinetic of [false,true])for(const highAt of ['minZ','maxZ'])test(`walk back from a flush high landing: kinetic=${kinetic}, end=${highAt}`,()=>{
 for(const hz of [30,60,120,240]){
  const g=fixture(kinetic),r={minX:-6,maxX:6,minZ:-12,maxZ:12,lowY:0,highY:8,highAt};g.ramps.push(r);
  const sign=highAt==='maxZ'?1:-1,z=sign*12;
  g.floors.push({minX:-6,maxX:6,minZ:sign>0?12:-24,maxZ:sign>0?24:-12,y:8});
  g.playerPosition.set(0,8,z+sign*1.5);g.move.set(0,-sign);
  for(let i=0;i<hz*2;i++){
   g.updatePlayer(1/hz);
   if(Math.abs(g.playerPosition.z)<11.9)assert.ok(g.playerPosition.y>=sampleRampSurface(r,g.playerPosition.z).height-.01);
  }
  assert.ok(Math.abs(g.playerPosition.z)<10,`Blocked at ${g.playerPosition.toArray()}, ${hz}Hz`);g.portals.dispose();
 }
});
test('ramp end step exception cannot admit airborne, high-speed penetrating or low underside entry',()=>{
 const r={minX:-3,maxX:3,minZ:0,maxZ:10,lowY:0,highY:5,highAt:'maxZ'};
 const from=V(0,5,11),to=V(0,4.99,10.3),hit=sweepRampContact(r,from,to,.43,2.4);
 assert.equal(hit.kind,'ramp-end');assert.equal(canStepAcrossRampEnd(hit,from,to,true),true);
 assert.equal(canStepAcrossRampEnd(hit,from,to,false),false);
 assert.equal(canStepAcrossRampEnd(hit,V(0,1,11),V(0,1,9),true),false);
 assert.equal(canStepAcrossRampEnd(hit,from,V(0,1,8),true),false);
 const side=sweepRampContact(r,V(-5,1,8),V(0,1,8),.43,2.4);
 assert.equal(canStepAcrossRampEnd(side,V(-5,1,8),V(0,1,8),true),false);
});
test('room 30 explores both inclines, restarts after jumping, and returns from spawn without teleport or reset',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='open';await g.selectLevel(29,false);let stats;
 const report=await runV8Journey(g,{scenario:d=>{stats=runRampExploration(d);}});
 assert.equal(report.pass,true);assert.equal(report.teleports,0);assert.equal(report.resets,0);assert.equal(report.respawns,0);
 assert.equal(stats.rampSamples,480);assert.ok(stats.minimumSurfaceGap>=-.015);
 assert.ok(Math.hypot(g.playerPosition.x+29,g.playerPosition.z-31)<.3);
});
