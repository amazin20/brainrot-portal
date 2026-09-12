import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom17,room17Depart} from '../src/game/LabRoom17Journey.js';
import {resolvePortalPlacement} from '../src/game/LabPortals.js';
const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});
for(const [order,aspect,interruptBrake] of [['cargo-first',16/9,false],['scout-first',1.6,true]])test(`moving address ${order} completes with the original cargo and a physically travelling portal`,async()=>{
 await game.selectLevel(16,false);game.camera.aspect=aspect;game.camera.updateProjectionMatrix();
 const body=game.physics.cargoBody,group=game.cargo.group,cuts=[];
 const report=await runV8Journey(game,{scenario:d=>runRoom17(d,{order,interruptBrake}),onMilestone:m=>{
  if(m.name==='the brake holds an empty carriage'||m.name==='a new sight replaces the arrival portal')cuts.push({name:m.name,carriage:game.firstLevel.state.address.position.toArray(),portal:game.portals.portals[1].position.toArray(),locked:game.firstLevel.state.address.locked,player:m.player,cargo:m.cargo});
 }});
 assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);assert.equal(game.physics.cargoBody,body);assert.equal(game.cargo.group,group);assert.ok(report.teleports>=4);
 assert.equal(cuts.length,2);assert.ok(cuts[0].locked&&cuts[0].carriage[0]>13.99&&cuts[0].cargo[1]<1,'Only the observer crosses while the friend powers departure');
 assert.ok(cuts[1].carriage[0]<-13.99&&cuts[1].cargo[0]<-10&&cuts[1].cargo[1]>7&&cuts[1].player[1]>=14,'The same friend returns on the actual carriage while the player discovers the receiver');
 assert.ok(Math.abs(cuts[0].portal[0]-cuts[1].portal[0]-28)<.001,'One portal really translates the complete rail stroke');
 if(order==='scout-first')assert.ok(report.milestones.some(m=>m.name==='the first berth has no upper return'));
 if(interruptBrake)assert.ok(report.milestones.some(m=>m.name==='the return stroke can be stopped and resumed'));
});
test('falling from the far berth returns through a reachable recovery panel without a reset',async()=>{
 await game.selectLevel(16,false);
 const report=await runV8Journey(game,{scenario:d=>{
  room17Depart(d);d.walk(21,20);d.walk(21,23);d.until(()=>game.playerGrounded&&game.playerPosition.y<.1,6,'East catch landing');
  d.aim(0,d.level.panels.recovery.getFrame().center);d.enter(d.level.panels.recovery);d.until(()=>game.playerGrounded&&game.playerPosition.y>6.9,6,'East recovery returns to the same carriage');
  assert.ok(d.level.state.address.locked&&d.level.pads[0].loaded());assert.equal(game.state,'playing');
 }});
 assert.equal(report.resets+report.respawns,0);assert.ok(report.teleports>=2);
});
function accepts(origin,target,panel){
 const ray=game.portalShots.ray;ray.set(origin,target.clone().sub(origin).normalize());ray.near=0;ray.far=Infinity;
 const hit=game.portalShots.firstHit();if(hit?.object!==panel.mesh)return false;
 const normal=hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize(),front=panel.getFrame().normal;
 return normal.dot(front)>.15&&ray.ray.direction.dot(front)<-.02&&resolvePortalPlacement(panel.mesh,hit.point,{blockers:game.colliders}).ok;
}
test('low courts and both carriage berths cannot shoot the reversed goal receiver early',async()=>{
 await game.selectLevel(16,false);game.scene.updateMatrixWorld(true);
 const p=game.firstLevel.panels['upper-receiver'],f=p.getFrame(),targets=[];
 for(const x of [-1.7,0,1.7])for(const y of [-.7,0,.7])targets.push(f.center.clone().add(new THREE.Vector3(x,y,0)));
 let rays=0;const failures=[];
 for(const [x0,x1,z0,z1,y] of [[-23,-3,-31,23,0],[3,23,-31,23,0],[-23,-21,8,12,3],[21,23,10,12,3],[-16,-12,7,13,7],[12,16,7,13,7]]){
  for(let x=x0;x<=x1;x+=2)for(let z=z0;z<=z1;z+=2)for(const h of [1.5,2.2,3.5])for(const target of targets){
   const o=new THREE.Vector3(x,y+h,z);rays++;if(accepts(o,target,p)&&failures.length<5)failures.push({origin:o.toArray(),target:target.toArray()});
  }
 }
 assert.ok(rays>10000);assert.deepEqual(failures,[],'Early final destination shots');
 assert.ok(accepts(new THREE.Vector3(-16,16,-30.5),f.center.clone().add(new THREE.Vector3(0,1.1,0)),p),'Upper reverse viewpoint must expose the receiver');
});
test('all ceramics have physical uses and permanent surfaces avoid coincident floor rectangles',async()=>{
 await game.selectLevel(16,false);const l=game.firstLevel;
 assert.deepEqual(Object.keys(l.puzzleGeometry.portalRoles).sort(),Object.keys(l.panels).sort());
 const fixed=l.world.surfaces.filter(s=>s.floor&&!s.collider.kinematic).map(s=>({name:s.name,...s.floor}));
 for(let i=0;i<fixed.length;i++)for(let j=i+1;j<fixed.length;j++){
  const a=fixed[i],b=fixed[j];if(Math.abs(a.y-b.y)>.001)continue;
  assert.ok(Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX)<=.001||Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ)<=.001,`${a.name} overlaps ${b.name}`);
 }
});
test('production jumps cannot reverse the five metre observation drop from the initial carriage',async()=>{
 await game.selectLevel(16,false);game.resetRun(true);
 // This is an adversarial pose on the reachable first carriage, not part of
 // either solution. Every jump and collision after it uses the real capsule.
 game.playerPosition.set(-14,7,9);game.previousPlayerPosition.copy(game.playerPosition);game.playerGrounded=true;game.yaw=0;
 const priorMove=game.input.getMove;game.input.getMove=()=>new THREE.Vector2(0,-1);let highest=7;
 try{for(let i=0;i<480;i++){if(i%90===0)game.input.jumpQueued=true;game.updatePlayer(1/120);highest=Math.max(highest,game.playerPosition.y);assert.ok(game.playerPosition.y<11.9);}}finally{game.input.getMove=priorMove;game.input.keys.clear();}
 assert.ok(highest>8,'Negative fixture must actually exercise jumping');assert.equal(game.state,'playing');
});
