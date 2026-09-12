import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {resolvePortalPlacement} from '../src/game/LabPortals.js';
const game=await createHeadlessGame(),V=(...a)=>new THREE.Vector3(...a);
after(()=>{game.physics.dispose();game.portals.dispose();});
// These are deliberately posed negative fixtures on reachable source floors,
// never solution evidence. All later movement, jumps and contacts use the
// production capsule, acceleration, gravity, floor registry and colliders.
function pose(x,y,z){game.resetRun(true);game.playerPosition.set(x,y,z);game.previousPlayerPosition.copy(game.playerPosition);game.playerGrounded=true;game.yaw=0;game.input.keys.add('ShiftLeft');}
const namedFloors=names=>game.firstLevel.world.surfaces.filter(s=>s.floor&&names.some(n=>s.name===n)).map(s=>s.floor);
function standsOn(floors){const p=game.playerPosition;return game.playerGrounded&&floors.some(f=>Math.abs(p.y-f.y)<.02&&p.x>=f.minX-.01&&p.x<=f.maxX+.01&&p.z>=f.minZ-.01&&p.z<=f.maxZ+.01);}
test('high-lip sprint, jump and diagonal departures cannot land on the far receiver or inspection route',async()=>{
 await game.selectLevel(17,false);const oldMove=game.input.getMove;
 const protectedFloors=namedFloors(['Perpendicular receiver','Reverse freight gallery','Freight receiving shelf','Medium return lip','Inspection stair','Back-of-entrance inspection walk']);
 let falls=0;
 try{for(const x of [-3.5,-1.5,1.5])for(const direction of [[-1,-1],[0,-1],[1,-1],[1,0],[0,1]])for(const jump of [false,true]){
  pose(x,20,11);const movement=new THREE.Vector2(...direction).normalize();game.input.getMove=()=>movement;let jumped=false,descended=false;
  for(let frame=0;frame<480;frame++){
   if(jump&&!jumped&&frame===22){game.input.jumpQueued=true;jumped=true;}
   game.updatePlayer(1/120);if(game.playerPosition.y<12)descended=true;
   assert.equal(standsOn(protectedFloors),false,`High-lip bypass: ${JSON.stringify({x,direction,jump,position:game.playerPosition.toArray()})}`);
  }
  if(descended)falls++;assert.equal(game.teleportCount,0);
 }}finally{game.input.getMove=oldMove;game.input.keys.clear();}
 assert.ok(falls>=4,'The probes must include real departures and falls rather than merely pushing a wall');
});
test('the catch recovery is not reversible from the ordinary upper corridor',async()=>{
 await game.selectLevel(17,false);const oldMove=game.input.getMove;
 const protectedFloors=namedFloors(['Catch corridor return','Catch north reconnect','Catch return rise','Catch return bridge','Low-energy catch','Freight receiving shelf','Medium return lip']);
 try{for(const z of [-16,-17])for(const jump of [false,true]){
  pose(1,20,z);game.input.getMove=()=>new THREE.Vector2(-1,0);let jumped=false,lowest=20;
  for(let frame=0;frame<600;frame++){
   if(jump&&!jumped&&game.playerPosition.x<-1.3){game.input.jumpQueued=true;jumped=true;}
   game.updatePlayer(1/120);lowest=Math.min(lowest,game.playerPosition.y);
   assert.equal(standsOn(protectedFloors),false,`Reverse catch entry: ${JSON.stringify({z,jump,position:game.playerPosition.toArray()})}`);
  }
  assert.ok(lowest<.1,'A rejected backwards jump returns to the continuous foundation');
 }}finally{game.input.getMove=oldMove;game.input.keys.clear();}
});
function accepts(origin,target,panel){
 const ray=game.portalShots.ray;ray.set(origin,target.clone().sub(origin).normalize());ray.near=0;ray.far=Infinity;
 const hit=game.portalShots.firstHit();if(hit?.object!==panel.mesh)return false;
 const normal=hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize(),front=panel.getFrame().normal;
 return normal.dot(front)>.15&&ray.ray.direction.dot(front)<-.02&&resolvePortalPlacement(panel.mesh,hit.point,{blockers:game.colliders}).ok;
}
test('the inspection roof cannot see through the lower home sight throat',async()=>{
 await game.selectLevel(17,false);game.scene.updateMatrixWorld(true);const p=game.firstLevel.panels.home,f=p.getFrame();
 for(const x of [3.4,4,4.6])for(const z of [23.5,24.5,25.5])for(const h of [18.8,19.6,20.5])for(const dy of [-.8,0,.8]){
  assert.equal(accepts(V(x,h,z),f.center.clone().add(V(0,dy,0)),p),false,`Roof sight bypass at ${[x,h,z]}`);
 }
 assert.ok(accepts(V(4,14.7,25),f.center,p),'The later lower inspection corridor must retain its physical sightline');
});

test('the rejected low-energy catch reconnects through its one-way upper return without a reset',async()=>{
 await game.selectLevel(17,false);
 const report=await runV8Journey(game,{scenario:d=>{
  // Positive recovery fixture only: the full launch route is tested elsewhere.
  // After this named catch pose, all input and physical contacts are ordinary.
  game.playerPosition.set(-21,15,0);game.previousPlayerPosition.copy(game.playerPosition);game.playerVelocity.set(0,0,0);game.playerGrounded=true;
  d.walk(-21,-6);d.walk(-21,-19.5);assert.ok(game.playerPosition.y>23.9);
  d.walk(-4.5,-19.5);d.walk(-4.5,-16.5);d.walk(-1.5,-16.5);
  d.until(()=>game.playerGrounded&&Math.abs(game.playerPosition.y-20)<.02,5,'Catch reconnects to the ordinary upper corridor');
  assert.equal(game.state,'playing');assert.equal(game.teleportCount,0);
 }});
 assert.equal(report.resets+report.respawns,0);
});
